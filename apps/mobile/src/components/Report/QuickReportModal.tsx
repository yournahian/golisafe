import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {
  HazardCategory,
  HazardSeverity,
  CreateHazardRequest,
} from '../../../../../packages/shared/api-contract';

export interface QuickReportModalProps {
  visible: boolean;
  currentLocation: { latitude: number; longitude: number };
  initialCoords?: { latitude: number; longitude: number } | null;
  onClose: () => void;
  onSubmitHazard: (payload: CreateHazardRequest) => Promise<void>;
}

interface CategoryOption {
  id: HazardCategory;
  label: string;
  shortLabel: string;
  icon: string;
  accent: string;
  surface: string;
}

const CATEGORIES: CategoryOption[] = [
  {
    id: 'pothole_manhole',
    label: 'Pothole / Open Manhole',
    shortLabel: 'Pothole /\nManhole',
    icon: '🕳️',
    accent: '#F59E0B',
    surface: 'rgba(245, 158, 11, 0.18)',
  },
  {
    id: 'waterlogging',
    label: 'Waterlogging Depth',
    shortLabel: 'Waterlogging\nDepth',
    icon: '🌊',
    accent: '#3B82F6',
    surface: 'rgba(59, 130, 246, 0.18)',
  },
  {
    id: 'unlit_alley',
    label: 'Unlit / Dark Alley',
    shortLabel: 'Unlit / Dark\nAlley',
    icon: '💡',
    accent: '#A855F7',
    surface: 'rgba(168, 85, 247, 0.18)',
  },
  {
    id: 'unsafe_footbridge',
    label: 'Unsafe Footbridge',
    shortLabel: 'Unsafe\nFootbridge',
    icon: '🌉',
    accent: '#FB923C',
    surface: 'rgba(251, 146, 60, 0.18)',
  },
  {
    id: 'extortion_spot',
    label: 'Extortion Choke-Point',
    shortLabel: 'Extortion\nChoke-Point',
    icon: '🛑',
    accent: '#EF4444',
    surface: 'rgba(239, 68, 68, 0.18)',
  },
];

const FOOTBRIDGE_SUBTAGS = [
  'Addicts/Snatchers at Night',
  'Hawker Blocked',
  'Broken Lighting',
];

const SEVERITIES: HazardSeverity[] = ['Low', 'Medium', 'Critical'];

export const QuickReportModal: React.FC<QuickReportModalProps> = ({
  visible,
  currentLocation,
  initialCoords,
  onClose,
  onSubmitHazard,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<HazardCategory>('pothole_manhole');
  const [selectedSeverity, setSelectedSeverity] = useState<HazardSeverity>('Medium');
  const [selectedSubtag, setSelectedSubtag] = useState<string | undefined>(undefined);
  const [landmarkContext, setLandmarkContext] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const effectiveInitial = initialCoords ?? currentLocation;
  const [latitude, setLatitude] = useState<number>(effectiveInitial.latitude);
  const [longitude, setLongitude] = useState<number>(effectiveInitial.longitude);

  useEffect(() => {
    if (initialCoords) {
      setLatitude(initialCoords.latitude);
      setLongitude(initialCoords.longitude);
    } else if (currentLocation) {
      setLatitude(currentLocation.latitude);
      setLongitude(currentLocation.longitude);
    }
  }, [initialCoords, currentLocation, visible]);

  const isPinDropped = Boolean(initialCoords);

  const handleCategorySelect = (category: HazardCategory) => {
    setSelectedCategory(category);
    if (category !== 'unsafe_footbridge') {
      setSelectedSubtag(undefined);
    }
  };

  const handleSubtagToggle = (subtag: string) => {
    setSelectedSubtag((prev) => (prev === subtag ? undefined : subtag));
  };

  const handleComingSoonNotice = () => {
    Alert.alert(
      'Coming Soon',
      'Voice and Photo AI classification will be enabled in the next phase.'
    );
  };

  const handleSubmit = async () => {
    if (!selectedCategory) {
      Alert.alert('Required', 'Please select a hazard category.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmitHazard({
        category: selectedCategory,
        severity: selectedSeverity,
        latitude,
        longitude,
        landmark_context: landmarkContext.trim() || undefined,
        sub_tag: selectedCategory === 'unsafe_footbridge' ? selectedSubtag : undefined,
      });

      // Reset form states on successful submission
      setLandmarkContext('');
      setSelectedSubtag(undefined);
      setSelectedSeverity('Medium');
      onClose();
    } catch (error) {
      Alert.alert(
        'Submission Error',
        error instanceof Error ? error.message : 'Failed to submit report. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <TouchableOpacity
          style={styles.backdropDismiss}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={styles.sheetContainer}>
          <View style={styles.dragHandle} />

          <View style={styles.header}>
            <View style={styles.titleGroup}>
              <View style={styles.titleRow}>
                <Text style={styles.title}>Quick Report</Text>
                {isPinDropped && (
                  <View style={styles.pinBadge}>
                    <Text style={styles.pinBadgeText}>📍 Pin dropped from map</Text>
                  </View>
                )}
              </View>
              <Text style={styles.subtitle}>
                {latitude.toFixed(4)}°N, {longitude.toFixed(4)}°E &middot;{' '}
                {isPinDropped ? 'Pinned map coordinates' : 'Tap to report'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.closeButton}
              accessibilityLabel="Close quick report modal"
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Select Hazard Category</Text>
              <View style={styles.categoryGrid}>
                {CATEGORIES.map((cat) => {
                  const isSelected = selectedCategory === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.categoryTile,
                        isSelected && {
                          borderColor: cat.accent,
                          backgroundColor: cat.surface,
                        },
                      ]}
                      onPress={() => handleCategorySelect(cat.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.categoryIcon}>{cat.icon}</Text>
                      <Text
                        style={[
                          styles.categoryTileText,
                          isSelected && { color: cat.accent, fontWeight: '700' },
                        ]}
                        numberOfLines={2}
                      >
                        {cat.shortLabel}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Section: Footbridge Risk Sub-Tags (Conditional) */}
            {selectedCategory === 'unsafe_footbridge' && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Footbridge / Crossing Risk Sub-Tags</Text>
                <View style={styles.subtagsContainer}>
                  {FOOTBRIDGE_SUBTAGS.map((subtag) => {
                    const isSubtagActive = selectedSubtag === subtag;
                    return (
                      <TouchableOpacity
                        key={subtag}
                        style={[
                          styles.subtagPill,
                          isSubtagActive && styles.subtagPillActive,
                        ]}
                        onPress={() => handleSubtagToggle(subtag)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.subtagText,
                            isSubtagActive && styles.subtagTextActive,
                          ]}
                        >
                          {subtag}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Section: Severity Level */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Severity Level</Text>
              <View style={styles.severityRow}>
                {SEVERITIES.map((sev) => {
                  const isSelected = selectedSeverity === sev;
                  const sevColor =
                    sev === 'Low'
                      ? '#22C55E'
                      : sev === 'Medium'
                      ? '#F59E0B'
                      : '#EF4444';
                  const sevSurface =
                    sev === 'Low'
                      ? 'rgba(34, 197, 94, 0.18)'
                      : sev === 'Medium'
                      ? 'rgba(245, 158, 11, 0.18)'
                      : 'rgba(239, 68, 68, 0.18)';

                  return (
                    <TouchableOpacity
                      key={sev}
                      style={[
                        styles.severityPill,
                        isSelected && {
                          borderColor: sevColor,
                          backgroundColor: sevSurface,
                        },
                      ]}
                      onPress={() => setSelectedSeverity(sev)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.severityText,
                          isSelected && { color: sevColor, fontWeight: '700' },
                        ]}
                      >
                        {sev}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Landmark / Context (Optional)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g., Near footbridge gate, tea stall on left..."
                placeholderTextColor="#64748B"
                value={landmarkContext}
                onChangeText={setLandmarkContext}
                multiline={false}
              />
            </View>

            <View style={styles.demoButtonsRow}>
              <TouchableOpacity
                style={styles.demoButton}
                onPress={handleComingSoonNotice}
                activeOpacity={0.7}
              >
                <Text style={styles.demoButtonText}>🎤 Voice Note (Coming Soon)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.demoButton}
                onPress={handleComingSoonNotice}
                activeOpacity={0.7}
              >
                <Text style={styles.demoButtonText}>📷 Photo (Coming Soon)</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[
                styles.submitButton,
                isSubmitting && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting}
              activeOpacity={0.8}
            >
              {isSubmitting ? (
                <View style={styles.submittingRow}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.submitButtonText}>Submitting Report…</Text>
                </View>
              ) : (
                <Text style={styles.submitButtonText}>Submit Hazard Report</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'flex-end',
  },
  backdropDismiss: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: '#131C31',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1.5,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#263554',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
    maxHeight: '88%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 20,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#334155',
    alignSelf: 'center',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#263554',
  },
  titleGroup: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  title: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  pinBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.35)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  pinBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#93C5FD',
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 16,
    color: '#94A3B8',
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2E4066',
    backgroundColor: '#1B2642',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  closeButtonText: {
    fontSize: 16,
    color: '#F1F5F9',
    fontWeight: '600',
  },
  scrollContent: {
    paddingTop: 12,
    paddingBottom: 10,
    gap: 14,
  },
  section: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: '#94A3B8',
    letterSpacing: 0.3,
  },
  categoryGrid: {
    flexDirection: 'row',
    gap: 6,
  },
  categoryTile: {
    flex: 1,
    minHeight: 88,
    backgroundColor: '#1B2642',
    borderWidth: 1.5,
    borderColor: '#263554',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  categoryIcon: {
    fontSize: 20,
  },
  categoryTileText: {
    fontSize: 10,
    lineHeight: 12.5,
    fontWeight: '600',
    color: '#F8FAFC',
    textAlign: 'center',
  },
  subtagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  subtagPill: {
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#263554',
    backgroundColor: '#1B2642',
  },
  subtagPillActive: {
    borderColor: '#FB923C',
    backgroundColor: 'rgba(249, 115, 22, 0.22)',
  },
  subtagText: {
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  subtagTextActive: {
    color: '#FDBA74',
    fontWeight: '700',
  },
  severityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  severityPill: {
    flex: 1,
    height: 40,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#263554',
    backgroundColor: '#1B2642',
    alignItems: 'center',
    justifyContent: 'center',
  },
  severityText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  textInput: {
    height: 44,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#263554',
    backgroundColor: '#0F172A',
    paddingHorizontal: 12,
    color: '#F8FAFC',
    fontSize: 13,
  },
  demoButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  demoButton: {
    flex: 1,
    height: 42,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#263554',
    backgroundColor: '#1B2642',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  demoButtonText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#F8FAFC',
    textAlign: 'center',
  },
  submitButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submittingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default QuickReportModal;
