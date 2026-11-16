import React, { useEffect, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Language } from '../../i18n/translations';

export interface HazardFilterState {
  severity: 'all' | 'high' | 'medium' | 'low';
  verifiedOnly: boolean;
  maxDistanceKm: number | null;
}

export const DEFAULT_HAZARD_FILTERS: HazardFilterState = {
  severity: 'all',
  verifiedOnly: false,
  maxDistanceKm: null,
};

export interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  filters?: HazardFilterState;
  onApply: (newFilters: HazardFilterState) => void;
  isDark?: boolean;
  language?: Language;
}

const UI_COPY = {
  en: {
    title: 'Filter Hazards',
    severitySection: 'RISK SEVERITY',
    verificationSection: 'VERIFICATION STATUS',
    distanceSection: 'DISTANCE RADIUS',
    severityAll: 'All',
    severityHigh: 'High Risk',
    severityMedium: 'Medium Risk',
    severityLow: 'Low Risk',
    allReports: 'All Reports',
    verifiedOnly: 'Crowd-Verified Only ✅',
    distanceAll: 'All Dhaka',
    distance1km: 'Within 1 km',
    distance3km: 'Within 3 km',
    distance5km: 'Within 5 km',
    reset: 'Reset',
    apply: 'Apply Filters',
  },
  bn: {
    title: 'ঝুঁকি ফিল্টার',
    severitySection: 'ঝুঁকির মাত্রা',
    verificationSection: 'যাচাইয়ের অবস্থা',
    distanceSection: 'দূরত্ব সীমা',
    severityAll: 'সব',
    severityHigh: 'উচ্চ ঝুঁকি',
    severityMedium: 'মাঝারি ঝুঁকি',
    severityLow: 'কম ঝুঁকি',
    allReports: 'সব রিপোর্ট',
    verifiedOnly: 'জনতা যাচাইকৃত কেবল ✅',
    distanceAll: 'সমগ্র ঢাকা',
    distance1km: '১ কিমি এর মধ্যে',
    distance3km: '৩ কিমি এর মধ্যে',
    distance5km: '৫ কিমি এর মধ্যে',
    reset: 'রিসেট',
    apply: 'ফিল্টার প্রয়োগ',
  },
};

export const FilterModal: React.FC<FilterModalProps> = ({
  visible,
  onClose,
  filters = DEFAULT_HAZARD_FILTERS,
  onApply,
  isDark = true,
  language = 'en',
}) => {
  const [draftFilters, setDraftFilters] = useState<HazardFilterState>(filters);

  useEffect(() => {
    if (visible) {
      setDraftFilters(filters);
    }
  }, [visible, filters]);

  const copy = UI_COPY[language] || UI_COPY.en;

  const theme = isDark
    ? {
        backdrop: 'rgba(15, 23, 42, 0.75)',
        sheetBg: '#161D2C',
        cardBg: '#1E293B',
        cardBorder: '#334155',
        activeChipBg: 'rgba(59, 130, 246, 0.22)',
        activeChipBorder: '#3B82F6',
        activeChipText: '#60A5FA',
        chipText: '#CBD5E1',
        textPrimary: '#F8FAFC',
        textSecondary: '#94A3B8',
        border: '#263554',
        dragHandle: '#334155',
        resetBtnBg: '#1E293B',
        resetBtnBorder: '#334155',
        resetBtnText: '#E2E8F0',
        applyBtnBg: '#3B82F6',
        applyBtnText: '#FFFFFF',
        closeBtnBg: '#1E293B',
        closeBtnBorder: '#334155',
        closeBtnText: '#F1F5F9',
      }
    : {
        backdrop: 'rgba(15, 23, 42, 0.45)',
        sheetBg: '#FFFFFF',
        cardBg: '#F8FAFC',
        cardBorder: '#E2E8F0',
        activeChipBg: '#EFF6FF',
        activeChipBorder: '#2563EB',
        activeChipText: '#2563EB',
        chipText: '#475569',
        textPrimary: '#0F172A',
        textSecondary: '#64748B',
        border: '#E2E8F0',
        dragHandle: '#CBD5E1',
        resetBtnBg: '#F1F5F9',
        resetBtnBorder: '#E2E8F0',
        resetBtnText: '#475569',
        applyBtnBg: '#3B82F6',
        applyBtnText: '#FFFFFF',
        closeBtnBg: '#F1F5F9',
        closeBtnBorder: '#CBD5E1',
        closeBtnText: '#64748B',
      };

  const handleReset = () => {
    setDraftFilters(DEFAULT_HAZARD_FILTERS);
  };

  const handleApply = () => {
    onApply(draftFilters);
    onClose();
  };

  const severityOptions: Array<{
    id: HazardFilterState['severity'];
    label: string;
    icon?: string;
  }> = [
    { id: 'all', label: copy.severityAll },
    { id: 'high', label: copy.severityHigh },
    { id: 'medium', label: copy.severityMedium },
    { id: 'low', label: copy.severityLow },
  ];

  const distanceOptions: Array<{
    id: HazardFilterState['maxDistanceKm'];
    label: string;
  }> = [
    { id: null, label: copy.distanceAll },
    { id: 1, label: copy.distance1km },
    { id: 3, label: copy.distance3km },
    { id: 5, label: copy.distance5km },
  ];

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
              borderColor: theme.border,
            },
          ]}
        >
          {/* Top Drag Indicator */}
          <View
            style={[styles.dragHandle, { backgroundColor: theme.dragHandle }]}
          />

          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <View style={styles.titleRow}>
              <Ionicons
                name="options-outline"
                size={20}
                color={theme.activeChipText}
              />
              <Text style={[styles.title, { color: theme.textPrimary }]}>
                {copy.title}
              </Text>
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
              accessibilityLabel="Close filter modal"
            >
              <Text
                style={[styles.closeButtonText, { color: theme.closeBtnText }]}
              >
                ✕
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* 1. Risk Severity Chips */}
            <View style={styles.section}>
              <Text
                style={[styles.sectionLabel, { color: theme.textSecondary }]}
              >
                {copy.severitySection}
              </Text>
              <View style={styles.chipRow}>
                {severityOptions.map((opt) => {
                  const isActive = draftFilters.severity === opt.id;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: theme.cardBg,
                          borderColor: theme.cardBorder,
                        },
                        isActive && {
                          backgroundColor: theme.activeChipBg,
                          borderColor: theme.activeChipBorder,
                        },
                      ]}
                      onPress={() =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          severity: opt.id,
                        }))
                      }
                      activeOpacity={0.75}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: theme.chipText },
                          isActive && {
                            color: theme.activeChipText,
                            fontWeight: '700',
                          },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 2. Verification Toggle */}
            <View style={styles.section}>
              <Text
                style={[styles.sectionLabel, { color: theme.textSecondary }]}
              >
                {copy.verificationSection}
              </Text>
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[
                    styles.toggleBtn,
                    {
                      backgroundColor: theme.cardBg,
                      borderColor: theme.cardBorder,
                    },
                    !draftFilters.verifiedOnly && {
                      backgroundColor: theme.activeChipBg,
                      borderColor: theme.activeChipBorder,
                    },
                  ]}
                  onPress={() =>
                    setDraftFilters((prev) => ({
                      ...prev,
                      verifiedOnly: false,
                    }))
                  }
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.toggleText,
                      { color: theme.chipText },
                      !draftFilters.verifiedOnly && {
                        color: theme.activeChipText,
                        fontWeight: '700',
                      },
                    ]}
                  >
                    {copy.allReports}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.toggleBtn,
                    {
                      backgroundColor: theme.cardBg,
                      borderColor: theme.cardBorder,
                    },
                    draftFilters.verifiedOnly && {
                      backgroundColor: theme.activeChipBg,
                      borderColor: theme.activeChipBorder,
                    },
                  ]}
                  onPress={() =>
                    setDraftFilters((prev) => ({
                      ...prev,
                      verifiedOnly: true,
                    }))
                  }
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.toggleText,
                      { color: theme.chipText },
                      draftFilters.verifiedOnly && {
                        color: theme.activeChipText,
                        fontWeight: '700',
                      },
                    ]}
                  >
                    {copy.verifiedOnly}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 3. Distance Radius Chips */}
            <View style={styles.section}>
              <Text
                style={[styles.sectionLabel, { color: theme.textSecondary }]}
              >
                {copy.distanceSection}
              </Text>
              <View style={styles.chipRow}>
                {distanceOptions.map((opt) => {
                  const isActive = draftFilters.maxDistanceKm === opt.id;
                  return (
                    <TouchableOpacity
                      key={String(opt.id)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: theme.cardBg,
                          borderColor: theme.cardBorder,
                        },
                        isActive && {
                          backgroundColor: theme.activeChipBg,
                          borderColor: theme.activeChipBorder,
                        },
                      ]}
                      onPress={() =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          maxDistanceKm: opt.id,
                        }))
                      }
                      activeOpacity={0.75}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: theme.chipText },
                          isActive && {
                            color: theme.activeChipText,
                            fontWeight: '700',
                          },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* 4. Bottom Action Row: Reset & Apply Filters */}
          <View style={[styles.actionRow, { borderTopColor: theme.border }]}>
            <TouchableOpacity
              style={[
                styles.resetButton,
                {
                  backgroundColor: theme.resetBtnBg,
                  borderColor: theme.resetBtnBorder,
                },
              ]}
              onPress={handleReset}
              activeOpacity={0.8}
            >
              <Ionicons
                name="refresh-outline"
                size={16}
                color={theme.resetBtnText}
              />
              <Text
                style={[styles.resetButtonText, { color: theme.resetBtnText }]}
              >
                {copy.reset}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.applyButton,
                {
                  backgroundColor: theme.applyBtnBg,
                },
              ]}
              onPress={handleApply}
              activeOpacity={0.85}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={18}
                color={theme.applyBtnText}
              />
              <Text
                style={[styles.applyButtonText, { color: theme.applyBtnText }]}
              >
                {copy.apply}
              </Text>
            </TouchableOpacity>
          </View>
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
    paddingBottom: 28,
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 18,
  },
  section: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleText: {
    fontSize: 12.5,
    fontWeight: '600',
    textAlign: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  resetButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  applyButton: {
    flex: 2,
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  applyButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
});

export default FilterModal;
