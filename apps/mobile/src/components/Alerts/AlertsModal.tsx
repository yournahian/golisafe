import React, { useMemo } from 'react';
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
export type HazardCategory =
  | 'pothole_manhole'
  | 'waterlogging'
  | 'unlit_alley'
  | 'unsafe_footbridge'
  | 'extortion_spot';

export type HazardSeverity = 'Low' | 'Medium' | 'Critical';

export interface Hazard {
  id: string;
  category: HazardCategory;
  severity: HazardSeverity;
  latitude: number;
  longitude: number;
  landmark_context?: string;
  sub_tag?: string;
  status: 'active' | 'pending' | 'verified' | 'crowd_verified' | 'resolved';
  created_at: string;
  confirmations?: number;
  confirmations_count?: number;
  confirmation_count?: number;
}

export type HazardRecord = Hazard;

export interface AlertsModalProps {
  visible: boolean;
  onClose: () => void;
  hazards: Hazard[];
  isDarkMode?: boolean;
  language?: 'en' | 'bn';
  onSelectHazard: (hazard: Hazard) => void;
}

interface CategoryDisplayMeta {
  name: string;
  nameBn: string;
  icon: string;
  color: string;
  lightColor: string;
  surface: string;
  lightSurface: string;
}

const CATEGORY_META: Record<HazardCategory, CategoryDisplayMeta> = {
  extortion_spot: {
    name: 'ChandaAlert',
    nameBn: 'চাঁদা সতর্কতা',
    icon: '🛑',
    color: '#EF4444',
    lightColor: '#B91C1C',
    surface: 'rgba(239, 68, 68, 0.18)',
    lightSurface: '#FEF2F2',
  },
  unlit_alley: {
    name: 'Dark-Zone Safety',
    nameBn: 'অন্ধকার গলি',
    icon: '💡',
    color: '#A855F7',
    lightColor: '#6D28D9',
    surface: 'rgba(168, 85, 247, 0.18)',
    lightSurface: '#F5F3FF',
  },
  waterlogging: {
    name: 'WaterLog',
    nameBn: 'জলাবদ্ধতা',
    icon: '🌊',
    color: '#3B82F6',
    lightColor: '#2563EB',
    surface: 'rgba(59, 130, 246, 0.18)',
    lightSurface: '#EFF6FF',
  },
  pothole_manhole: {
    name: 'Road Hazard',
    nameBn: 'সড়ক ঝুঁকি',
    icon: '🕳️',
    color: '#F59E0B',
    lightColor: '#B45309',
    surface: 'rgba(245, 158, 11, 0.18)',
    lightSurface: '#FFFBEB',
  },
  unsafe_footbridge: {
    name: 'Safe Crossing',
    nameBn: 'নিরাপদ পারাপার',
    icon: '🌉',
    color: '#FB923C',
    lightColor: '#C2410C',
    surface: 'rgba(249, 115, 22, 0.18)',
    lightSurface: '#FFF7ED',
  },
};

const UI_TEXT = {
  en: {
    title: 'Active Alerts',
    emptyTitle: 'No Active Alerts',
    emptySubtitle: 'No matching hazards reported in this area.',
    locateOnMap: 'Locate on Map',
    verifiedBadge: 'Crowd-Verified',
    confirmationSingular: '1 confirmation',
    confirmationPlural: 'confirmations',
    severityCritical: 'Critical Risk',
    severityMedium: 'Moderate Risk',
    severityLow: 'Low Risk',
  },
  bn: {
    title: 'সতর্কতা তালিকা',
    emptyTitle: 'কোনো সতর্কতা নেই',
    emptySubtitle: 'এই এলাকায় কোনো সক্রিয় ঝুঁকি পাওয়া যায়নি।',
    locateOnMap: 'মানচিত্রে দেখুন',
    verifiedBadge: 'যাচাইকৃত',
    confirmationSingular: '১ জন নিশ্চিত করেছেন',
    confirmationPlural: 'জন নিশ্চিত করেছেন',
    severityCritical: 'উচ্চ ঝুঁকি',
    severityMedium: 'মাঝারি ঝুঁকি',
    severityLow: 'স্বল্প ঝুঁকি',
  },
};

export const AlertsModal: React.FC<AlertsModalProps> = ({
  visible,
  onClose,
  hazards,
  isDarkMode = false,
  language = 'en',
  onSelectHazard,
}) => {
  const isDark = Boolean(isDarkMode);
  const copy = UI_TEXT[language] || UI_TEXT.en;

  // Sort hazards: High severity and crowd_verified appear at top
  const sortedHazards = useMemo(() => {
    return [...hazards].sort((a, b) => {
      const getPriorityScore = (h: Hazard): number => {
        let score = 0;
        // Severity weighting
        if (h.severity === 'Critical') score += 100;
        else if (h.severity === 'Medium') score += 50;
        else score += 10;

        // Verified bonus weighting
        if (h.status === 'crowd_verified') score += 30;
        return score;
      };

      const diff = getPriorityScore(b) - getPriorityScore(a);
      if (diff !== 0) return diff;

      // Secondary sort: most recent first
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return timeB - timeA;
    });
  }, [hazards]);

  const theme = useMemo(() => {
    if (isDark) {
      return {
        backdrop: 'rgba(11, 17, 32, 0.78)',
        sheetBg: '#131C31',
        sheetBorder: '#263554',
        dragHandle: '#334155',
        border: '#263554',
        textPrimary: '#F8FAFC',
        textSecondary: '#94A3B8',
        cardBg: '#1B2642',
        cardBorder: '#2E4066',
        countBadgeBg: 'rgba(59, 130, 246, 0.22)',
        countBadgeText: '#93C5FD',
        closeBtnBg: '#1B2642',
        closeBtnBorder: '#2E4066',
        closeBtnText: '#F1F5F9',
        verifiedBg: 'rgba(22, 163, 74, 0.22)',
        verifiedBorder: 'rgba(74, 222, 128, 0.45)',
        verifiedText: '#86EFAC',
        locateBtnBg: '#2563EB',
        locateBtnText: '#FFFFFF',
        locateBtnBorder: '#3B82F6',
        emptyIconColor: '#475569',
      };
    }

    return {
      backdrop: 'rgba(15, 23, 42, 0.45)',
      sheetBg: '#FFFFFF',
      sheetBorder: '#E2E8F0',
      dragHandle: '#CBD5E1',
      border: '#E2E8F0',
      textPrimary: '#0F172A',
      textSecondary: '#64748B',
      cardBg: '#F8FAFC',
      cardBorder: '#E2E8F0',
      countBadgeBg: '#EFF6FF',
      countBadgeText: '#2563EB',
      closeBtnBg: '#F1F5F9',
      closeBtnBorder: '#CBD5E1',
      closeBtnText: '#64748B',
      verifiedBg: '#DCFCE7',
      verifiedBorder: '#86EFAC',
      verifiedText: '#15803D',
      locateBtnBg: '#2563EB',
      locateBtnText: '#FFFFFF',
      locateBtnBorder: '#2563EB',
      emptyIconColor: '#CBD5E1',
    };
  }, [isDark]);

  const getSeverityStyle = (severity: HazardSeverity) => {
    if (severity === 'Critical') {
      return {
        bg: isDark ? 'rgba(239, 68, 68, 0.22)' : '#FEF2F2',
        border: isDark ? 'rgba(248, 113, 113, 0.45)' : '#FECACA',
        text: isDark ? '#FCA5A5' : '#DC2626',
        label: copy.severityCritical,
      };
    }
    if (severity === 'Medium') {
      return {
        bg: isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7',
        border: isDark ? 'rgba(251, 191, 36, 0.45)' : '#FDE68A',
        text: isDark ? '#FCD34D' : '#B45309',
        label: copy.severityMedium,
      };
    }
    return {
      bg: isDark ? 'rgba(34, 197, 94, 0.18)' : '#DCFCE7',
      border: isDark ? 'rgba(74, 222, 128, 0.45)' : '#BBF7D0',
      text: isDark ? '#86EFAC' : '#15803D',
      label: copy.severityLow,
    };
  };

  const getConfirmationString = (item: Hazard): string => {
    const rawCount =
      typeof item.confirmations === 'number'
        ? item.confirmations
        : typeof item.confirmations_count === 'number'
          ? item.confirmations_count
          : typeof item.confirmation_count === 'number'
            ? item.confirmation_count
            : item.status === 'crowd_verified'
              ? 3
              : 1;

    if (language === 'bn') {
      return rawCount === 1
        ? copy.confirmationSingular
        : `${rawCount} ${copy.confirmationPlural}`;
    }
    return rawCount === 1
      ? copy.confirmationSingular
      : `${rawCount} ${copy.confirmationPlural}`;
  };

  const handleLocate = (hazard: Hazard) => {
    onSelectHazard(hazard);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.backdrop, { backgroundColor: theme.backdrop }]}>
        <TouchableOpacity
          style={styles.backdropDismiss}
          activeOpacity={1}
          onPress={onClose}
        />

        <View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: theme.sheetBg,
              borderColor: theme.sheetBorder,
            },
          ]}
        >
          {/* Drag Handle */}
          <View
            style={[styles.dragHandle, { backgroundColor: theme.dragHandle }]}
          />

          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <View style={styles.titleGroup}>
              <Text style={[styles.title, { color: theme.textPrimary }]}>
                {copy.title}
              </Text>
              <View
                style={[
                  styles.countBadge,
                  { backgroundColor: theme.countBadgeBg },
                ]}
              >
                <Text
                  style={[
                    styles.countBadgeText,
                    { color: theme.countBadgeText },
                  ]}
                >
                  {sortedHazards.length}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={[
                styles.closeButton,
                {
                  backgroundColor: theme.closeBtnBg,
                  borderColor: theme.closeBtnBorder,
                },
              ]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Close alerts modal"
            >
              <Text style={[styles.closeButtonText, { color: theme.closeBtnText }]}>
                ✕
              </Text>
            </TouchableOpacity>
          </View>

          {/* List of Sorted Alerts */}
          <FlatList
            data={sortedHazards}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={48}
                  color={theme.emptyIconColor}
                />
                <Text
                  style={[styles.emptyTitle, { color: theme.textPrimary }]}
                >
                  {copy.emptyTitle}
                </Text>
                <Text
                  style={[
                    styles.emptySubtitle,
                    { color: theme.textSecondary },
                  ]}
                >
                  {copy.emptySubtitle}
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const meta =
                CATEGORY_META[item.category] || CATEGORY_META.pothole_manhole;
              const categoryColor = isDark ? meta.color : meta.lightColor;
              const categorySurface = isDark
                ? meta.surface
                : meta.lightSurface;
              const sevStyle = getSeverityStyle(item.severity);
              const confirmationLabel = getConfirmationString(item);
              const categoryName =
                language === 'bn' ? meta.nameBn : meta.name;
              const displayTitle =
                item.landmark_context?.trim() || categoryName;

              return (
                <View
                  style={[
                    styles.alertCard,
                    {
                      backgroundColor: theme.cardBg,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                >
                  {/* Card Top: Colored Category Badge + Status Badges */}
                  <View style={styles.cardHeaderRow}>
                    <View
                      style={[
                        styles.categoryBadge,
                        {
                          backgroundColor: categorySurface,
                          borderColor: categoryColor,
                        },
                      ]}
                    >
                      <Text style={styles.categoryIcon}>{meta.icon}</Text>
                      <Text
                        style={[
                          styles.categoryBadgeText,
                          { color: categoryColor },
                        ]}
                        numberOfLines={1}
                      >
                        {categoryName}
                      </Text>
                    </View>

                    <View style={styles.rightBadgesRow}>
                      {item.status === 'crowd_verified' && (
                        <View
                          style={[
                            styles.statusPill,
                            {
                              backgroundColor: theme.verifiedBg,
                              borderColor: theme.verifiedBorder,
                            },
                          ]}
                        >
                          <Ionicons
                            name="checkmark-circle"
                            size={12}
                            color={theme.verifiedText}
                          />
                          <Text
                            style={[
                              styles.statusPillText,
                              { color: theme.verifiedText },
                            ]}
                          >
                            {copy.verifiedBadge}
                          </Text>
                        </View>
                      )}

                      <View
                        style={[
                          styles.statusPill,
                          {
                            backgroundColor: sevStyle.bg,
                            borderColor: sevStyle.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusPillText,
                            { color: sevStyle.text },
                          ]}
                        >
                          {sevStyle.label}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Hazard Title */}
                  <Text
                    style={[styles.hazardTitle, { color: theme.textPrimary }]}
                    numberOfLines={2}
                  >
                    {displayTitle}
                  </Text>

                  {/* Subtag if present */}
                  {item.sub_tag ? (
                    <View style={styles.subtagBadge}>
                      <Text style={styles.subtagText}>{item.sub_tag}</Text>
                    </View>
                  ) : null}

                  {/* Details / Confirmation / Coords Row */}
                  <View style={styles.metaRow}>
                    <View style={styles.metaItem}>
                      <Ionicons
                        name="people-outline"
                        size={13}
                        color={theme.textSecondary}
                      />
                      <Text
                        style={[
                          styles.metaText,
                          { color: theme.textSecondary },
                        ]}
                      >
                        {confirmationLabel}
                      </Text>
                    </View>

                    <Text
                      style={[
                        styles.metaDivider,
                        { color: theme.textSecondary },
                      ]}
                    >
                      •
                    </Text>

                    <View style={styles.metaItem}>
                      <Ionicons
                        name="compass-outline"
                        size={13}
                        color={theme.textSecondary}
                      />
                      <Text
                        style={[
                          styles.metaText,
                          { color: theme.textSecondary },
                        ]}
                      >
                        {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
                      </Text>
                    </View>
                  </View>

                  {/* Action: Locate on Map */}
                  <TouchableOpacity
                    style={[
                      styles.locateButton,
                      {
                        backgroundColor: theme.locateBtnBg,
                        borderColor: theme.locateBtnBorder,
                      },
                    ]}
                    onPress={() => handleLocate(item)}
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name="location-sharp"
                      size={15}
                      color={theme.locateBtnText}
                    />
                    <Text
                      style={[
                        styles.locateButtonText,
                        { color: theme.locateBtnText },
                      ]}
                    >
                      {copy.locateOnMap}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropDismiss: {
    flex: 1,
  },
  sheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1.5,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 24,
    paddingBottom: 24,
  },
  dragHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
    letterSpacing: -0.2,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 20,
    gap: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 44,
    paddingHorizontal: 20,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  alertCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    gap: 10,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 5,
  },
  categoryIcon: {
    fontSize: 13,
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  rightBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 3,
    gap: 4,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  hazardTitle: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  subtagBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(251, 146, 60, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(251, 146, 60, 0.35)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  subtagText: {
    color: '#FB923C',
    fontSize: 11,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '500',
  },
  metaDivider: {
    fontSize: 12,
  },
  locateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
    marginTop: 2,
  },
  locateButtonText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
});

export default AlertsModal;
