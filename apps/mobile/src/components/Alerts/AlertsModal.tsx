import React, { useEffect, useMemo, useState } from 'react';
import {
  BackHandler,
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import AppIcon from '../AppIcon';
import type {
  HazardCategory,
  HazardRecord,
  HazardSeverity,
} from '../../../../../packages/shared/api-contract';

export type { HazardCategory, HazardRecord, HazardSeverity };
export type Hazard = HazardRecord & {
  image_url?: string;
  imageUrl?: string;
  imageUri?: string;
};

export interface AlertsModalProps {
  visible: boolean;
  onClose: () => void;
  hazards: Hazard[];
  userLocation?: { latitude: number; longitude: number };
  isDarkMode?: boolean;
  language?: 'en' | 'bn';
  onSelectHazard: (hazard: Hazard) => void;
  onOpenReport?: () => void;
}

const MODULE_ORDER: HazardCategory[] = [
  'extortion_spot',
  'unlit_alley',
  'waterlogging',
  'pothole_manhole',
  'unsafe_footbridge',
];

interface CategoryDisplayMeta {
  name: string;
  nameBn: string;
  defaultTitle: string;
  defaultTitleBn: string;
  color: string;
  lightColor: string;
  surface: string;
  lightSurface: string;
}

const CATEGORY_META: Record<HazardCategory, CategoryDisplayMeta> = {
  extortion_spot: {
    name: 'ChandaAlert',
    nameBn: 'চাঁদা সতর্কতা',
    defaultTitle: 'Forced collection reported',
    defaultTitleBn: 'চাঁদাবাজির অভিযোগ পাওয়া গেছে',
    color: '#F87171',
    lightColor: '#B91C1C',
    surface: 'rgba(239, 68, 68, 0.16)',
    lightSurface: '#FEF2F2',
  },
  unlit_alley: {
    name: 'Dark-Zone Safety',
    nameBn: 'অন্ধকার গলি',
    defaultTitle: 'Streetlight outage reported',
    defaultTitleBn: 'স্ট্রিট লাইট নষ্টের অভিযোগ',
    color: '#C084FC',
    lightColor: '#6D28D9',
    surface: 'rgba(168, 85, 247, 0.16)',
    lightSurface: '#F5F3FF',
  },
  waterlogging: {
    name: 'WaterLog',
    nameBn: 'জলাবদ্ধতা',
    defaultTitle: 'Road waterlogging reported',
    defaultTitleBn: 'রাস্তায় জলাবদ্ধতা দেখা গেছে',
    color: '#60A5FA',
    lightColor: '#2563EB',
    surface: 'rgba(59, 130, 246, 0.16)',
    lightSurface: '#EFF6FF',
  },
  pothole_manhole: {
    name: 'Road Hazard',
    nameBn: 'সড়ক ঝুঁকি',
    defaultTitle: 'Open manhole reported',
    defaultTitleBn: 'খোলা ম্যানহোল / গর্ত দেখা গেছে',
    color: '#F87171',
    lightColor: '#B45309',
    surface: 'rgba(248, 113, 113, 0.16)',
    lightSurface: '#FFFBEB',
  },
  unsafe_footbridge: {
    name: 'Safe Crossing',
    nameBn: 'নিরাপদ পারাপার',
    defaultTitle: 'Unsafe footbridge reported',
    defaultTitleBn: 'অনিরাপদ ফুটব্রিজের অভিযোগ',
    color: '#FB923C',
    lightColor: '#C2410C',
    surface: 'rgba(249, 115, 22, 0.16)',
    lightSurface: '#FFF7ED',
  },
};

function CategorySvgIcon({
  category,
  color,
  size = 15,
}: {
  category: HazardCategory;
  color: string;
  size?: number;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {category === 'extortion_spot' && (
        <>
          <Path d="M8.2 3h7.6L21 8.2v7.6L15.8 21H8.2L3 15.8V8.2L8.2 3Z" />
          <Path d="M12 7.5v5.5" />
          <Circle cx={12} cy={16.2} r={0.8} fill={color} />
        </>
      )}
      {category === 'unlit_alley' && (
        <>
          <Path d="M6 21V6.5a2.5 2.5 0 0 1 2.5-2.5H13" />
          <Path d="M10.5 4h5l1.5 2.5h-8L10.5 4Z" />
          <Path d="M4 21h5" />
          <Path d="M16.5 10.5a3.5 3.5 0 1 0 3.5 4.2 2.8 2.8 0 0 1-3.5-4.2Z" />
        </>
      )}
      {category === 'waterlogging' && (
        <>
          <Path d="M12 3.5 9.2 7.2a3.5 3.5 0 1 0 5.6 0L12 3.5Z" />
          <Path d="M2.5 15c1.6 1.4 3.8 1.4 5.4 0 1.6-1.4 3.8-1.4 5.4 0 1.6 1.4 3.8 1.4 5.4 0 1.1-1 2.1-1.2 2.8-.8" />
          <Path d="M2.5 19.5c1.6 1.4 3.8 1.4 5.4 0 1.6-1.4 3.8-1.4 5.4 0 1.6 1.4 3.8 1.4 5.4 0 1.1-1 2.1-1.2 2.8-.8" />
        </>
      )}
      {category === 'pothole_manhole' && (
        <>
          <Path d="M7.5 3.5 3.5 20.5M16.5 3.5l4 17" />
          <Ellipse cx={12} cy={14.5} rx={4.2} ry={2.6} />
          <Path d="M12 4.5v3.5" />
        </>
      )}
      {category === 'unsafe_footbridge' && (
        <>
          <Circle cx={12.5} cy={4.5} r={1.8} />
          <Path d="M9.5 11.5 11.5 8h2l2 3.5" />
          <Path d="m10.5 16.5 1.5-4.5 2 4.5" />
          <Path d="M3.5 20h3M10.5 20h3M17.5 20h3" />
        </>
      )}
    </Svg>
  );
}

function calcDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function formatTimeAgo(iso?: string, bn = false): string {
  if (!iso) return bn ? 'এইমাত্র' : 'just now';
  const diffMin = Math.max(
    1,
    Math.round((Date.now() - new Date(iso).getTime()) / 60000),
  );
  if (diffMin < 60) return bn ? `${diffMin} মি. আগে` : `${diffMin} min ago`;
  const hrs = Math.round(diffMin / 60);
  if (hrs < 24) return bn ? `${hrs} ঘন্টা আগে` : `${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  return bn ? `${days} দিন আগে` : `${days}d ago`;
}

export const AlertsModal: React.FC<AlertsModalProps> = ({
  visible,
  onClose,
  hazards,
  userLocation,
  isDarkMode = true,
  language = 'en',
  onSelectHazard,
  onOpenReport,
}) => {
  const isDark = Boolean(isDarkMode);
  const bn = language === 'bn';
  const [selectedCat, setSelectedCat] = useState<'all' | HazardCategory>('all');

  const sortedHazards = useMemo(() => {
    return [...hazards].sort((a, b) => {
      const getPriorityScore = (h: Hazard): number => {
        let score = 0;
        if (
          isDark &&
          (h.category === 'unlit_alley' || h.category === 'unsafe_footbridge')
        ) {
          score += 140;
        }
        if (h.severity === 'Critical') score += 90;
        else if (h.severity === 'Medium') score += 50;
        else score += 20;
        if (h.status === 'crowd_verified' || h.status === 'verified') score += 25;
        return score;
      };
      const diff = getPriorityScore(b) - getPriorityScore(a);
      if (diff !== 0) return diff;
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return timeB - timeA;
    });
  }, [hazards, isDark]);

  const visibleHazards = useMemo(() => {
    if (selectedCat === 'all') return sortedHazards;
    return sortedHazards.filter((h) => h.category === selectedCat);
  }, [sortedHazards, selectedCat]);

  const theme = useMemo(
    () =>
      isDark
        ? {
            bg: '#09101E',
            surface: '#111A2E',
            surfaceElevated: '#16223A',
            border: '#1E2D4A',
            borderStrong: '#293C60',
            text: '#F8FAFC',
            textSecondary: '#94A3B8',
            navBg: '#0B1222',
            primary: '#3B82F6',
            primarySurface: 'rgba(59, 130, 246, 0.18)',
          }
        : {
            bg: '#F8FAFC',
            surface: '#FFFFFF',
            surfaceElevated: '#F1F5F9',
            border: '#E2E8F0',
            borderStrong: '#CBD5E1',
            text: '#0F172A',
            textSecondary: '#64748B',
            navBg: '#FFFFFF',
            primary: '#2563EB',
            primarySurface: '#EFF6FF',
          },
    [isDark],
  );

  const getRiskPill = (severity: HazardSeverity) => {
    if (severity === 'Critical') {
      return {
        bg: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEF2F2',
        border: isDark ? 'rgba(248, 113, 113, 0.35)' : '#FECACA',
        text: isDark ? '#FCA5A5' : '#DC2626',
        label: bn ? 'উচ্চ ঝুঁকি' : 'High risk',
      };
    }
    if (severity === 'Medium') {
      return {
        bg: isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7',
        border: isDark ? 'rgba(251, 191, 36, 0.35)' : '#FDE68A',
        text: isDark ? '#FCD34D' : '#B45309',
        label: bn ? 'মাঝারি ঝুঁকি' : 'Moderate risk',
      };
    }
    return {
      bg: isDark ? 'rgba(16, 185, 129, 0.18)' : '#DCFCE7',
      border: isDark ? 'rgba(52, 211, 153, 0.35)' : '#BBF7D0',
      text: isDark ? '#6EE7B7' : '#15803D',
      label: bn ? 'কম ঝুঁকি' : 'Low risk',
    };
  };

  const getStatusBadge = (item: Hazard) => {
    const count = item.confirmations ?? 0;
    if (item.status === 'verified' || count >= 5) {
      return {
        bg: isDark ? 'rgba(16, 185, 129, 0.16)' : '#DCFCE7',
        border: isDark ? 'rgba(52, 211, 153, 0.35)' : '#86EFAC',
        text: isDark ? '#6EE7B7' : '#15803D',
        icon: 'checkmark' as const,
        label: bn ? 'যাচাইকৃত' : 'Verified',
      };
    }
    if (item.status === 'crowd_verified' || count >= 3) {
      return {
        bg: isDark ? 'rgba(59, 130, 246, 0.18)' : '#EFF6FF',
        border: isDark ? 'rgba(96, 165, 250, 0.35)' : '#BFDBFE',
        text: isDark ? '#93C5FD' : '#2563EB',
        icon: 'people-outline' as const,
        label: bn ? 'জনতা যাচাইকৃত' : 'Crowd-Verified',
      };
    }
    return {
      bg: isDark ? 'rgba(148, 163, 184, 0.14)' : '#F1F5F9',
      border: isDark ? 'rgba(148, 163, 184, 0.3)' : '#CBD5E1',
      text: isDark ? '#CBD5E1' : '#475569',
      icon: 'information-circle-outline' as const,
      label: bn ? 'রিপোর্টকৃত' : 'Reported',
    };
  };

  const topInset = Platform.OS === 'android' ? 14 : 52;

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>

        {/* Top Bar: ← Nearby Alerts */}
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
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path
                d="M19 12H5M12 19l-7-7 7-7"
                stroke={theme.text}
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </TouchableOpacity>
          <Text style={[styles.topTitle, { color: theme.text }]}>
            {bn ? 'আশপাশের সতর্কতা' : 'Nearby Alerts'}
          </Text>
        </View>

        {/* Horizontal Category Filter Pills */}
        <View style={styles.filterRowWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRowContent}
          >
            {MODULE_ORDER.map((cat) => {
              const meta = CATEGORY_META[cat];
              const active = selectedCat === cat;
              const accent = isDark ? meta.color : meta.lightColor;
              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() =>
                    setSelectedCat((prev) => (prev === cat ? 'all' : cat))
                  }
                  style={[
                    styles.catPill,
                    {
                      backgroundColor: active
                        ? isDark
                          ? meta.surface
                          : meta.lightSurface
                        : theme.surface,
                      borderColor: active ? accent : theme.borderStrong,
                    },
                  ]}
                  activeOpacity={0.8}
                >
                  <CategorySvgIcon category={cat} color={accent} size={15} />
                  <Text
                    style={[
                      styles.catPillText,
                      { color: active ? accent : theme.text },
                    ]}
                  >
                    {bn ? meta.nameBn : meta.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Night Mode Priority Banner (Figma SS4) */}
        {isDark && (
          <View style={styles.nightBanner}>
            <Text style={styles.nightBannerText}>
              {bn
                ? 'নাইট মোড সক্রিয়: অন্ধকার গলি ও ফুটব্রিজ সতর্কতা অগ্রাধিকার পাচ্ছে।'
                : 'Night mode active: Unlit alley & footbridge alerts prioritized.'}
            </Text>
          </View>
        )}

        {/* Full-Screen Scrollable Alerts List */}
        <FlatList
          data={visibleHazards}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          overScrollMode="never"
          removeClippedSubviews={false}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={7}
          scrollEventThrottle={16}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <AppIcon
                name="shield-checkmark-outline"
                size={46}
                color={theme.textSecondary}
              />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                {bn ? 'কোনো সক্রিয় সতর্কতা নেই' : 'No Nearby Alerts'}
              </Text>
              <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
                {bn
                  ? 'এই ক্যাটাগরিতে এখনো কোনো ঝুঁকি রিপোর্ট হয়নি।'
                  : 'No active hazards reported for this filter.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const meta =
              CATEGORY_META[item.category] || CATEGORY_META.pothole_manhole;
            const accent = isDark ? meta.color : meta.lightColor;
            const risk = getRiskPill(item.severity);
            const status = getStatusBadge(item);
            const isNightPriority =
              isDark &&
              (item.category === 'unlit_alley' ||
                item.category === 'unsafe_footbridge');

            const distMeters = userLocation
              ? calcDistanceMeters(
                  userLocation.latitude,
                  userLocation.longitude,
                  item.latitude,
                  item.longitude,
                )
              : null;
            const distText =
              distMeters !== null
                ? distMeters < 1000
                  ? `${distMeters} m away`
                  : `${(distMeters / 1000).toFixed(1)} km away`
                : 'Dhaka';
            const cleanedPlace = (item.landmark_context || '')
              .replace(/\[Ambient Light:[^\]]*\]/gi, '')
              .trim();
            const locationLine = `${cleanedPlace || 'Dhaka'}, Dhaka · ${distText} · ${formatTimeAgo(item.created_at, bn)}`;
            const confCount = item.confirmations ?? 0;

            return (
              <TouchableOpacity
                style={[
                  styles.alertCard,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                  },
                ]}
                onPress={() => {
                  onSelectHazard(item);
                }}
                activeOpacity={0.85}
              >
                <View style={styles.cardTopRow}>
                  <Text
                    style={[styles.cardCategoryText, { color: accent }]}
                    numberOfLines={1}
                  >
                    {bn ? meta.nameBn : meta.name}
                    {isNightPriority
                      ? bn
                        ? ' · রাতের অগ্রাধিকার'
                        : ' · Night Priority'
                      : ''}
                  </Text>
                  <View
                    style={[
                      styles.riskPill,
                      {
                        backgroundColor: risk.bg,
                        borderColor: risk.border,
                      },
                    ]}
                  >
                    <Text style={[styles.riskPillText, { color: risk.text }]}>
                      {risk.label}
                    </Text>
                  </View>
                </View>

                <Text
                  style={[styles.cardTitle, { color: theme.text }]}
                  numberOfLines={2}
                >
                  {bn ? meta.defaultTitleBn : meta.defaultTitle}
                </Text>

                <Text
                  style={[styles.cardMeta, { color: theme.textSecondary }]}
                  numberOfLines={1}
                >
                  {locationLine}
                </Text>

                <View style={styles.cardFooterRow}>
                  <View
                    style={[
                      styles.statusPill,
                      {
                        backgroundColor: status.bg,
                        borderColor: status.border,
                      },
                    ]}
                  >
                    <AppIcon name={status.icon} size={12} color={status.text} />
                    <Text
                      style={[styles.statusPillText, { color: status.text }]}
                    >
                      {status.label}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.confirmationsText,
                      { color: theme.textSecondary },
                    ]}
                  >
                    {confCount}{' '}
                    {bn ? 'নিশ্চিতকরণ' : confCount === 1 ? 'confirmation' : 'confirmations'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 72,
    zIndex: 40,
    elevation: 12,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingBottom: 14,
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
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  filterRowWrap: {
    height: 46,
    justifyContent: 'center',
  },
  filterRowContent: {
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 8,
  },
  catPill: {
    height: 36,
    paddingHorizontal: 13,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  catPillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  nightBanner: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.45)',
  },
  nightBannerText: {
    color: '#EDE9FE',
    fontSize: 12,
    fontWeight: '600',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 24,
    gap: 12,
  },
  alertCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardCategoryText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  riskPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  riskPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  cardMeta: {
    fontSize: 12.5,
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  confirmationsText: {
    fontSize: 12.5,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 70,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
  },
  bottomNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minWidth: 72,
  },
  navIconPill: {
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderRadius: 14,
  },
  navLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
});

export default AlertsModal;
