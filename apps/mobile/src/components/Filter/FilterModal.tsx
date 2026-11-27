import React from 'react';
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { HazardCategory } from '../../../../../packages/shared/api-contract';
import type { Language } from '../../i18n/translations';

export interface HazardFilterState {
  severity: 'all' | 'high' | 'medium' | 'low';
  verifiedOnly: boolean;
  maxDistanceKm: number | null;
  trust?: 'all' | 'reported' | 'crowd_verified' | 'verified';
  status?: 'all' | 'active' | 'resolved' | 'expired';
}

export const DEFAULT_HAZARD_FILTERS: HazardFilterState = {
  severity: 'all',
  verifiedOnly: false,
  maxDistanceKm: null,
  trust: 'all',
  status: 'all',
};

export interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  filters?: HazardFilterState;
  onApply: (newFilters: HazardFilterState) => void;
  viewMode?: 'all' | 'pedestrian_night' | 'driver_biker';
  onChangeViewMode?: (mode: 'all' | 'pedestrian_night' | 'driver_biker') => void;
  categoryFilter?: 'all' | HazardCategory;
  onChangeCategoryFilter?: (cat: 'all' | HazardCategory) => void;
  isDark?: boolean;
  language?: Language;
}

export const FilterModal: React.FC<FilterModalProps> = ({
  visible,
  onClose,
  filters = DEFAULT_HAZARD_FILTERS,
  onApply,
  viewMode = 'all',
  onChangeViewMode,
  categoryFilter = 'all',
  onChangeCategoryFilter,
  isDark = true,
  language = 'en',
}) => {
  const bn = language === 'bn';
  const trustValue = filters.trust ?? (filters.verifiedOnly ? 'crowd_verified' : 'all');
  const statusValue = filters.status ?? 'all';

  const theme = isDark
    ? {
        backdrop: 'rgba(6, 11, 23, 0.45)',
        cardBg: '#0E172A',
        cardBorder: '#1F3050',
        pillBg: '#162138',
        pillBorder: '#283A5E',
        pillText: '#CBD5E1',
        activeBg: 'rgba(59, 130, 246, 0.2)',
        activeBorder: '#3B82F6',
        activeText: '#93C5FD',
        title: '#F8FAFC',
        closeBg: '#162138',
        closeBorder: '#283A5E',
        closeText: '#E2E8F0',
      }
    : {
        backdrop: 'rgba(15, 23, 42, 0.3)',
        cardBg: '#FFFFFF',
        cardBorder: '#CBD5E1',
        pillBg: '#F1F5F9',
        pillBorder: '#CBD5E1',
        pillText: '#334155',
        activeBg: '#EFF6FF',
        activeBorder: '#2563EB',
        activeText: '#2563EB',
        title: '#0F172A',
        closeBg: '#F1F5F9',
        closeBorder: '#CBD5E1',
        closeText: '#334155',
      };

  const renderPill = (
    key: string,
    label: string,
    active: boolean,
    onPress: () => void,
  ) => (
    <TouchableOpacity
      key={key}
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.pill,
        {
          backgroundColor: active ? theme.activeBg : theme.pillBg,
          borderColor: active ? theme.activeBorder : theme.pillBorder,
        },
      ]}
    >
      <Text
        style={[
          styles.pillText,
          { color: active ? theme.activeText : theme.pillText },
          active && { fontWeight: '700' },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  const topOffset = Platform.OS === 'android' ? 148 : 186;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={[styles.backdrop, { backgroundColor: theme.backdrop }]}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => {}}
          style={[
            styles.popoverCard,
            {
              marginTop: topOffset,
              backgroundColor: theme.cardBg,
              borderColor: theme.cardBorder,
            },
          ]}
        >
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: theme.title }]}>
              {bn ? 'ফিল্টার' : 'Filters'}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={[
                styles.closeBtn,
                {
                  backgroundColor: theme.closeBg,
                  borderColor: theme.closeBorder,
                },
              ]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.closeText, { color: theme.closeText }]}>
                ✕
              </Text>
            </TouchableOpacity>
          </View>

          {/* Row 1: Mode (All | Night walk | Driver) */}
          <View style={styles.pillRow}>
            {renderPill('mode-all', bn ? 'সব' : 'All', viewMode === 'all', () =>
              onChangeViewMode?.('all'),
            )}
            {renderPill(
              'mode-night',
              bn ? 'নাইট ওয়াক' : 'Night walk',
              viewMode === 'pedestrian_night',
              () => onChangeViewMode?.('pedestrian_night'),
            )}
            {renderPill(
              'mode-driver',
              bn ? 'ড্রাইভার' : 'Driver',
              viewMode === 'driver_biker',
              () => onChangeViewMode?.('driver_biker'),
            )}
          </View>

          {/* Row 2: Trust (All trust | Reported | Crowd-Verified | Verified) */}
          <View style={styles.pillRow}>
            {renderPill(
              'trust-all',
              bn ? 'সব ট্রাস্ট' : 'All trust',
              trustValue === 'all',
              () => onApply({ ...filters, trust: 'all', verifiedOnly: false }),
            )}
            {renderPill(
              'trust-reported',
              bn ? 'রিপোর্টকৃত' : 'Reported',
              trustValue === 'reported',
              () =>
                onApply({ ...filters, trust: 'reported', verifiedOnly: false }),
            )}
            {renderPill(
              'trust-crowd',
              bn ? 'জনতা যাচাইকৃত' : 'Crowd-Verified',
              trustValue === 'crowd_verified',
              () =>
                onApply({
                  ...filters,
                  trust: 'crowd_verified',
                  verifiedOnly: true,
                }),
            )}
            {renderPill(
              'trust-verified',
              bn ? 'যাচাইকৃত' : 'Verified',
              trustValue === 'verified',
              () =>
                onApply({ ...filters, trust: 'verified', verifiedOnly: true }),
            )}
          </View>

          {/* Row 3: Status (All status | Active | Resolved | Expired) */}
          <View style={styles.pillRow}>
            {renderPill(
              'status-all',
              bn ? 'সব স্ট্যাটাস' : 'All status',
              statusValue === 'all',
              () => onApply({ ...filters, status: 'all' }),
            )}
            {renderPill(
              'status-active',
              bn ? 'সক্রিয়' : 'Active',
              statusValue === 'active',
              () => onApply({ ...filters, status: 'active' }),
            )}
            {renderPill(
              'status-resolved',
              bn ? 'সমাধান হয়েছে' : 'Resolved',
              statusValue === 'resolved',
              () => onApply({ ...filters, status: 'resolved' }),
            )}
            {renderPill(
              'status-expired',
              bn ? 'মেয়াদোত্তীর্ণ' : 'Expired',
              statusValue === 'expired',
              () => onApply({ ...filters, status: 'expired' }),
            )}
          </View>

          {/* Row 4: Categories */}
          <View style={styles.pillRow}>
            {renderPill(
              'cat-all',
              bn ? 'সব ক্যাটাগরি' : 'All categories',
              categoryFilter === 'all',
              () => onChangeCategoryFilter?.('all'),
            )}
            {renderPill(
              'cat-chanda',
              'ChandaAlert',
              categoryFilter === 'extortion_spot',
              () => onChangeCategoryFilter?.('extortion_spot'),
            )}
            {renderPill(
              'cat-dark',
              'Dark-Zone Safety',
              categoryFilter === 'unlit_alley',
              () => onChangeCategoryFilter?.('unlit_alley'),
            )}
            {renderPill(
              'cat-water',
              'WaterLog',
              categoryFilter === 'waterlogging',
              () => onChangeCategoryFilter?.('waterlogging'),
            )}
            {renderPill(
              'cat-road',
              'Road Hazard',
              categoryFilter === 'pothole_manhole',
              () => onChangeCategoryFilter?.('pothole_manhole'),
            )}
            {renderPill(
              'cat-crossing',
              'Safe Crossing',
              categoryFilter === 'unsafe_footbridge',
              () => onChangeCategoryFilter?.('unsafe_footbridge'),
            )}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    paddingHorizontal: 14,
  },
  popoverCard: {
    borderRadius: 20,
    borderWidth: 1.2,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.48,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 12.5,
    fontWeight: '500',
  },
});

export default FilterModal;
