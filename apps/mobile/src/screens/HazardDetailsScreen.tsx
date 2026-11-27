import React from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { HazardRecord } from '../../../../packages/shared/api-contract';
import AppIcon from '../components/AppIcon';
import { TRANSLATIONS, type Language } from '../i18n/translations';
import { CATEGORY_META, DARK_THEME, LIGHT_THEME } from './mapConstants';
import { computeDistanceMeters } from './mapGeoUtils';

export interface HazardDetailsScreenProps {
  visible: boolean;
  hazard: HazardRecord | null;
  userLocation: { latitude: number; longitude: number };
  isTestMode: boolean;
  isDark?: boolean;
  language?: Language;
  confirming?: boolean;
  resolving?: boolean;
  routeLoading?: boolean;
  onClose: () => void;
  onOpenAlerts: () => void;
  onOpenReport: () => void;
  onConfirm: (hazard: HazardRecord) => void;
  onResolve: (hazard: HazardRecord) => void;
  onFindSafeRoute: (hazard: HazardRecord) => void;
  onFocusOnMap: (hazard: HazardRecord) => void;
}

export default function HazardDetailsScreen({
  visible,
  hazard,
  userLocation,
  isTestMode,
  isDark = true,
  language = 'en',
  confirming = false,
  resolving = false,
  routeLoading = false,
  onClose,
  onOpenAlerts,
  onOpenReport,
  onConfirm,
  onResolve,
  onFindSafeRoute,
  onFocusOnMap,
}: HazardDetailsScreenProps) {
  if (!hazard) return null;

  const theme = isDark ? DARK_THEME : LIGHT_THEME;
  const t = TRANSLATIONS[language];
  const meta = CATEGORY_META[hazard.category] || CATEGORY_META.pothole_manhole;
  const accent = isDark ? meta.color : meta.lightColor;
  const surface = isDark ? meta.surface : meta.lightSurface;

  const distMeters = computeDistanceMeters(
    userLocation.latitude,
    userLocation.longitude,
    hazard.latitude,
    hazard.longitude,
  );
  const distLabel =
    distMeters < 1000
      ? `${distMeters}m away`
      : `${(distMeters / 1000).toFixed(1)} km away`;

  const confirmationsCount =
    hazard.confirmations ?? (hazard.status === 'crowd_verified' ? 3 : 1);
  const resolvedCount = hazard.resolved_count ?? 0;
  const isVerified =
    hazard.status === 'crowd_verified' || confirmationsCount >= 3;
  const isEphemeral =
    hazard.category === 'waterlogging' ||
    hazard.category === 'extortion_spot' ||
    hazard.category === 'unlit_alley';
  const isVoteLocked = !isTestMode && distMeters > 150;

  const topInset = Platform.OS === 'android' ? 12 : 52;

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={[styles.screen, { backgroundColor: theme.bg }]}>
        <StatusBar
          barStyle={theme.statusBarStyle}
          backgroundColor={theme.bg}
        />

        {/* Top Bar: ← Hazard details */}
        <View style={[styles.topBar, { paddingTop: topInset }]}>
          <TouchableOpacity
            style={[
              styles.backBtn,
              {
                backgroundColor: theme.surfaceElevated,
                borderColor: theme.borderStrong,
              },
            ]}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <AppIcon name="arrow-back" size={18} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.topTitle, { color: theme.text }]}>
            {language === 'bn' ? 'ঝুঁকির বিস্তারিত' : 'Hazard details'}
          </Text>
          {isTestMode && (
            <View style={styles.testBadge}>
              <Text style={styles.testBadgeText}>TEST</Text>
            </View>
          )}
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          overScrollMode="never"
          scrollEventThrottle={16}
        >
          {/* Main Info Card */}
          <View
            style={[
              styles.card,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <View style={styles.badgeRow}>
              <View
                style={[
                  styles.categoryChip,
                  { backgroundColor: surface, borderColor: accent },
                ]}
              >
                <Text style={[styles.categoryChipText, { color: accent }]}>
                  {language === 'bn' ? meta.nameBn : meta.name}
                </Text>
              </View>

              <View style={styles.rightBadges}>
                {isVerified && (
                  <View
                    style={[
                      styles.pill,
                      {
                        backgroundColor: theme.verifiedBg,
                        borderColor: theme.verifiedBorder,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.pillText, { color: theme.verifiedText }]}
                    >
                      {t.actions.crowdVerified}
                    </Text>
                  </View>
                )}
                <View
                  style={[
                    styles.pill,
                    {
                      backgroundColor: theme.riskBg,
                      borderColor: theme.riskBorder,
                    },
                  ]}
                >
                  <Text style={[styles.pillText, { color: theme.riskText }]}>
                    {hazard.severity}
                  </Text>
                </View>
              </View>
            </View>

            <Text style={[styles.title, { color: theme.text }]}>
              {hazard.landmark_context || meta.name}
            </Text>

            <Text style={[styles.metaLine, { color: theme.textSecondary }]}>
              {t.cityBadge} · {distLabel} · {confirmationsCount}{' '}
              {confirmationsCount === 1 ? 'confirmation' : 'confirmations'}
            </Text>

            {hazard.sub_tag ? (
              <View
                style={[
                  styles.subtagPill,
                  {
                    backgroundColor: theme.surfaceElevated,
                    borderColor: theme.borderStrong,
                  },
                ]}
              >
                <Text style={[styles.subtagText, { color: theme.text }]}>
                  {hazard.sub_tag}
                </Text>
              </View>
            ) : null}

            <Text style={[styles.lifecycleMeta, { color: theme.textSecondary }]}>
              GPS: {hazard.latitude.toFixed(4)}°N, {hazard.longitude.toFixed(4)}°E ·{' '}
              {isEphemeral
                ? 'Ephemeral (12h auto-archive)'
                : 'Structural (active until 3/3 Resolved)'}
            </Text>
          </View>

          {/* FR-17: Footbridge vs Zebra Crossing Comparison Card */}
          {hazard.category === 'unsafe_footbridge' && (
            <View
              style={[
                styles.card,
                {
                  backgroundColor: theme.surface,
                  borderColor: '#FB923C',
                },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                {language === 'bn'
                  ? '🌉 ফুটব্রিজ বনাম জেব্রা ক্রসিং তুলনা'
                  : '🌉 Footbridge vs. Zebra Crossing Comparison'}
              </Text>
              <View style={styles.compareRow}>
                <View
                  style={[
                    styles.compareBox,
                    {
                      backgroundColor: 'rgba(249, 115, 22, 0.14)',
                      borderColor: '#FB923C',
                    },
                  ]}
                >
                  <Text style={[styles.compareTitle, { color: '#FB923C' }]}>
                    ⚠️ Footbridge
                  </Text>
                  <Text style={[styles.compareNote, { color: theme.text }]}>
                    {hazard.sub_tag || 'Low lighting / hawker congestion at night'}
                  </Text>
                </View>
                <View
                  style={[
                    styles.compareBox,
                    {
                      backgroundColor: 'rgba(16, 185, 129, 0.14)',
                      borderColor: '#10B981',
                    },
                  ]}
                >
                  <Text style={[styles.compareTitle, { color: '#34D399' }]}>
                    ✅ Zebra Crossing
                  </Text>
                  <Text style={[styles.compareNote, { color: theme.text }]}>
                    Well-lit surface crossing with active traffic visibility
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Photo Evidence Section */}
          <View
            style={[
              styles.card,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <View style={styles.evidenceHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                {language === 'bn' ? 'ছবির প্রমাণ' : 'Photo evidence'}
              </Text>
              <Text style={[styles.metaLine, { color: theme.textSecondary }]}>
                {hazard.image_url ? '1 photo' : 'No photo attached'}
              </Text>
            </View>
            {hazard.image_url ? (
              <Image
                source={{ uri: hazard.image_url }}
                style={styles.evidenceImage}
                resizeMode="cover"
              />
            ) : (
              <View
                style={[
                  styles.emptyPhotoBox,
                  {
                    backgroundColor: theme.surfaceElevated,
                    borderColor: theme.borderStrong,
                  },
                ]}
              >
                <AppIcon name="camera-outline" size={24} color={theme.textSecondary} />
                <Text style={[styles.metaLine, { color: theme.textSecondary }]}>
                  {language === 'bn'
                    ? 'এই রিপোর্টে কোনো ছবি যুক্ত করা হয়নি'
                    : 'No photo uploaded for this report yet'}
                </Text>
              </View>
            )}
          </View>

          {/* Community Verification & Lifecycle Actions */}
          <View
            style={[
              styles.card,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              {language === 'bn' ? 'কমিউনিটি যাচাইকরণ' : 'Community Verification'}
            </Text>

            <View
              style={[
                styles.statusBar,
                {
                  backgroundColor: isTestMode
                    ? theme.primarySurface
                    : distMeters <= 150
                      ? theme.verifiedBg
                      : theme.noticeBg,
                  borderColor: isTestMode
                    ? theme.primary
                    : distMeters <= 150
                      ? theme.verifiedBorder
                      : theme.noticeBorder,
                },
              ]}
            >
              <AppIcon
                name="location-outline"
                size={15}
                color={
                  isTestMode
                    ? theme.primaryText
                    : distMeters <= 150
                      ? theme.verifiedText
                      : theme.noticeText
                }
              />
              <Text
                style={[
                  styles.statusBarText,
                  {
                    color: isTestMode
                      ? theme.primaryText
                      : distMeters <= 150
                        ? theme.verifiedText
                        : theme.noticeText,
                  },
                ]}
              >
                {isTestMode
                  ? `🧪 Test Mode Bypass Active (${distLabel})`
                  : distMeters <= 150
                    ? `✅ Within 150m (${distLabel}) — Voting unlocked`
                    : `🔒 Move within 150m to vote (${distLabel})`}
              </Text>
            </View>

            <View style={styles.voteRow}>
              <TouchableOpacity
                style={[
                  styles.voteBtn,
                  {
                    backgroundColor: theme.verifiedBg,
                    borderColor: theme.verifiedBorder,
                    opacity: isVoteLocked ? 0.48 : 1,
                  },
                ]}
                onPress={() => onConfirm(hazard)}
                disabled={confirming}
                activeOpacity={0.85}
              >
                {confirming ? (
                  <ActivityIndicator size="small" color={theme.verifiedText} />
                ) : (
                  <Text
                    style={[styles.voteBtnText, { color: theme.verifiedText }]}
                  >
                    👍 Still There ({confirmationsCount}/3)
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.voteBtn,
                  {
                    backgroundColor: theme.surfaceElevated,
                    borderColor: theme.borderStrong,
                    opacity: isVoteLocked ? 0.48 : 1,
                  },
                ]}
                onPress={() => onResolve(hazard)}
                disabled={resolving}
                activeOpacity={0.85}
              >
                {resolving ? (
                  <ActivityIndicator size="small" color={theme.text} />
                ) : (
                  <Text style={[styles.voteBtnText, { color: theme.text }]}>
                    ✅ Resolved ({resolvedCount}/3)
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Route & Map Actions */}
          <View style={styles.footerActions}>
            <TouchableOpacity
              style={[
                styles.primaryActionBtn,
                { backgroundColor: '#10B981' },
              ]}
              onPress={() => {
                onClose();
                onFindSafeRoute(hazard);
              }}
              disabled={routeLoading}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryActionText}>
                🛡️ {language === 'bn' ? 'নিরাপদ বিকল্প পথ দেখুন' : 'Find Safe Detour Route'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.secondaryActionBtn,
                {
                  backgroundColor: theme.primarySurface,
                  borderColor: theme.primary,
                },
              ]}
              onPress={() => {
                onClose();
                onFocusOnMap(hazard);
              }}
              activeOpacity={0.85}
            >
              <Text
                style={[styles.secondaryActionText, { color: theme.primaryText }]}
              >
                📍 {language === 'bn' ? 'ম্যাপে দেখুন' : 'View on Map'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Bottom 3-Tab Navigation Bar */}
        <View
          style={[
            styles.bottomNav,
            {
              backgroundColor: theme.bottomNavBg,
              borderTopColor: theme.border,
            },
          ]}
        >
          <TouchableOpacity style={styles.navItem} onPress={onClose}>
            <View style={styles.navIconPill}>
              <AppIcon name="compass-outline" size={20} color={theme.navInactive} />
            </View>
            <Text style={[styles.navLabel, { color: theme.navInactive }]}>
              {t.tabs.map}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            onPress={() => {
              onClose();
              onOpenAlerts();
            }}
          >
            <View
              style={[
                styles.navIconPill,
                { backgroundColor: theme.primarySurface },
              ]}
            >
              <AppIcon name="alert-circle-outline" size={20} color={theme.primary} />
            </View>
            <Text
              style={[
                styles.navLabel,
                { color: theme.primary, fontWeight: '600' },
              ]}
            >
              {t.tabs.alerts}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            onPress={() => {
              onClose();
              onOpenReport();
            }}
          >
            <View style={styles.navIconPill}>
              <AppIcon name="add" size={22} color={theme.navInactive} />
            </View>
            <Text style={[styles.navLabel, { color: theme.navInactive }]}>
              {t.tabs.report}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  testBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  testBadgeText: {
    color: '#FBBF24',
    fontSize: 10.5,
    fontWeight: '800',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 96,
    gap: 12,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  rightBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  metaLine: {
    fontSize: 12,
    fontWeight: '500',
  },
  subtagPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  subtagText: {
    fontSize: 12,
    fontWeight: '600',
  },
  lifecycleMeta: {
    fontSize: 11,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  compareRow: {
    flexDirection: 'row',
    gap: 8,
  },
  compareBox: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    gap: 4,
  },
  compareTitle: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  compareNote: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  evidenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  evidenceImage: {
    width: '100%',
    height: 190,
    borderRadius: 12,
  },
  emptyPhotoBox: {
    height: 92,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusBarText: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  voteRow: {
    flexDirection: 'row',
    gap: 8,
  },
  voteBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  voteBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  footerActions: {
    gap: 8,
  },
  primaryActionBtn: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionText: {
    color: '#06281E',
    fontSize: 14.5,
    fontWeight: '800',
  },
  secondaryActionBtn: {
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 72,
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 6,
    paddingBottom: 10,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  navIconPill: {
    width: 48,
    height: 26,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
});
