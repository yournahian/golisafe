import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import {
  HazardCategory,
  HazardSeverity,
  CreateHazardRequest,
} from '../../../../../packages/shared/api-contract';

export type QuickReportHazardPayload = CreateHazardRequest & {
  imageUri?: string;
};

export interface QuickReportModalProps {
  visible: boolean;
  currentLocation: { latitude: number; longitude: number };
  initialCoords?: { latitude: number; longitude: number } | null;
  onClose: () => void;
  onSubmitHazard: (payload: QuickReportHazardPayload) => Promise<void>;
  isDark?: boolean;
  language?: 'en' | 'bn';
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
  isDark = true,
  language = 'en',
}) => {
  const [selectedCategory, setSelectedCategory] = useState<HazardCategory>('pothole_manhole');
  const [selectedSeverity, setSelectedSeverity] = useState<HazardSeverity>('Medium');
  const [selectedSubtag, setSelectedSubtag] = useState<string | undefined>(undefined);
  const [landmarkContext, setLandmarkContext] = useState<string>('');
  const [imageUri, setImageUri] = useState<string | null>(null);
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

  const handlePickFromGallery = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          language === 'bn' ? 'অনুমতি প্রয়োজন' : 'Permission Required',
          language === 'bn'
            ? 'ছবি আপলোড করতে ফটো লাইব্রেরির অনুমতি দিন।'
            : 'Please grant media library access to attach photo evidence.'
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImageUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert(
        language === 'bn' ? 'ত্রুটি' : 'Error',
        language === 'bn'
          ? 'ছবি নির্বাচন করতে ব্যর্থ হয়েছে।'
          : 'Unable to select image. Please try again.'
      );
    }
  };

  const handleTakePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          language === 'bn' ? 'অনুমতি প্রয়োজন' : 'Permission Required',
          language === 'bn'
            ? 'ছবি তুলতে ক্যামেরার অনুমতি প্রয়োজন।'
            : 'Please grant camera access to take photo evidence.'
        );
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImageUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert(
        language === 'bn' ? 'ত্রুটি' : 'Error',
        language === 'bn'
          ? 'ছবি ক্যাপচার করতে ব্যর্থ হয়েছে।'
          : 'Unable to capture photo. Please try again.'
      );
    }
  };

  const handleComingSoonNotice = () => {
    Alert.alert(
      language === 'bn' ? 'শীঘ্রই আসছে' : 'Coming Soon',
      language === 'bn'
        ? 'ভয়েস নোট ও এআই ক্লাসিফিকেশন পরবর্তী সংস্করণে সক্রিয় হবে।'
        : 'Voice Note and Photo AI classification will be enabled in the next phase.'
    );
  };

  const handleSubmit = async () => {
    if (!selectedCategory) {
      Alert.alert(
        language === 'bn' ? 'প্রয়োজন' : 'Required',
        language === 'bn'
          ? 'দয়া করে একটি ঝুঁকির ক্যাটাগরি নির্বাচন করুন।'
          : 'Please select a hazard category.'
      );
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
        imageUri: imageUri || undefined,
      });

      // Reset form states on successful submission
      setLandmarkContext('');
      setSelectedSubtag(undefined);
      setSelectedSeverity('Medium');
      setImageUri(null);
      onClose();
    } catch (error) {
      Alert.alert(
        language === 'bn' ? 'সাবমিশন ব্যর্থ' : 'Submission Error',
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
                <Text style={styles.title}>
                  {language === 'bn' ? 'দ্রুত রিপোর্ট' : 'Quick Report'}
                </Text>
                {isPinDropped && (
                  <View style={styles.pinBadge}>
                    <Text style={styles.pinBadgeText}>
                      {language === 'bn' ? '📍 মানচিত্রে পিন করা' : '📍 Pin dropped from map'}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.subtitle}>
                {latitude.toFixed(4)}°N, {longitude.toFixed(4)}°E &middot;{' '}
                {isPinDropped
                  ? language === 'bn'
                    ? 'নির্বাচিত স্থান'
                    : 'Pinned map coordinates'
                  : language === 'bn'
                  ? 'রিপোর্ট করতে ট্যাপ করুন'
                  : 'Tap to report'}
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
            {/* Category Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                {language === 'bn' ? 'ঝুঁকির ক্যাটাগরি নির্বাচন' : 'Select Hazard Category'}
              </Text>
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

            {/* Footbridge Sub-Tags (Conditional) */}
            {selectedCategory === 'unsafe_footbridge' && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>
                  {language === 'bn'
                    ? 'ফুটব্রিজ ঝুঁকি সাব-ট্যাগ'
                    : 'Footbridge / Crossing Risk Sub-Tags'}
                </Text>
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

            {/* Severity Level */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                {language === 'bn' ? 'ঝুঁকির মাত্রা' : 'Severity Level'}
              </Text>
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

                  const label =
                    language === 'bn'
                      ? sev === 'Low'
                        ? 'কম ঝুঁকি'
                        : sev === 'Medium'
                        ? 'মাঝারি'
                        : 'উচ্চ ঝুঁকি'
                      : sev;

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
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Photo Evidence Section (Camera / Gallery) */}
            <View style={styles.section}>
              <View style={styles.sectionLabelRow}>
                <Text style={styles.sectionLabel}>
                  {language === 'bn'
                    ? 'ছবির প্রমাণ যোগ করুন (ক্যামেরা / গ্যালারি)'
                    : 'Add Photo Evidence (Camera / Gallery)'}
                </Text>
                {imageUri && (
                  <TouchableOpacity
                    onPress={() => setImageUri(null)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.removePhotoText}>
                      {language === 'bn' ? 'মুছে ফেলুন' : 'Remove'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {imageUri ? (
                <View style={styles.photoPreviewWrapper}>
                  <Image
                    source={{ uri: imageUri }}
                    style={styles.photoPreviewImage}
                    resizeMode="cover"
                  />
                  <View style={styles.photoPreviewOverlay}>
                    <Ionicons name="checkmark-circle" size={14} color="#86EFAC" />
                    <Text style={styles.photoPreviewOverlayText}>
                      {language === 'bn' ? 'ছবি সংযুক্ত হয়েছে' : 'Photo Attached'}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.photoActionRow}>
                  <TouchableOpacity
                    style={styles.photoPickerBtn}
                    onPress={handleTakePhoto}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="camera-outline" size={18} color="#93C5FD" />
                    <Text style={styles.photoPickerBtnText}>
                      {language === 'bn' ? 'ক্যামেরা দিয়ে ছবি তুলুন' : 'Take Photo'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.photoPickerBtn}
                    onPress={handlePickFromGallery}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="images-outline" size={18} color="#93C5FD" />
                    <Text style={styles.photoPickerBtnText}>
                      {language === 'bn' ? 'গ্যালারি থেকে নির্বাচন' : 'Choose Gallery'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Landmark Context */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                {language === 'bn'
                  ? 'নিকটস্থ ল্যান্ডমার্ক / বর্ণনা (ঐচ্ছিক)'
                  : 'Landmark / Context (Optional)'}
              </Text>
              <TextInput
                style={styles.textInput}
                placeholder={
                  language === 'bn'
                    ? 'যেমন: ফুটব্রিজ গেটের কাছে, চায়ের দোকানের পাশে...'
                    : 'e.g., Near footbridge gate, tea stall on left...'
                }
                placeholderTextColor="#64748B"
                value={landmarkContext}
                onChangeText={setLandmarkContext}
                multiline={false}
              />
            </View>

            {/* Voice Note Demo Button */}
            <View style={styles.demoButtonsRow}>
              <TouchableOpacity
                style={styles.demoButton}
                onPress={handleComingSoonNotice}
                activeOpacity={0.7}
              >
                <Ionicons name="mic-outline" size={16} color="#94A3B8" />
                <Text style={styles.demoButtonText}>
                  {language === 'bn'
                    ? 'ভয়েস নোট (শীঘ্রই আসছে)'
                    : 'Voice Note (Coming Soon)'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Submit Button */}
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
                  <Text style={styles.submitButtonText}>
                    {language === 'bn' ? 'রিপোর্ট পাঠানো হচ্ছে…' : 'Submitting Report…'}
                  </Text>
                </View>
              ) : (
                <Text style={styles.submitButtonText}>
                  {language === 'bn' ? 'ঝুঁকি রিপোর্ট জমা দিন' : 'Submit Hazard Report'}
                </Text>
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
    maxHeight: '90%',
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
    borderBottomColor: '#1E293B',
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
    padding: 4,
    marginLeft: 8,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#94A3B8',
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
  sectionLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: '#94A3B8',
    letterSpacing: 0.3,
  },
  removePhotoText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F87171',
  },
  categoryGrid: {
    flexDirection: 'row',
    gap: 6,
  },
  categoryTile: {
    flex: 1,
    minHeight: 88,
    backgroundColor: '#1E293B',
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
    backgroundColor: '#1E293B',
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
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  severityText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  photoActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  photoPickerBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2E4066',
    backgroundColor: '#1E293B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  photoPickerBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#93C5FD',
  },
  photoPreviewWrapper: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#3B82F6',
    height: 140,
    position: 'relative',
  },
  photoPreviewImage: {
    width: '100%',
    height: '100%',
  },
  photoPreviewOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  photoPreviewOverlayText: {
    color: '#86EFAC',
    fontSize: 11,
    fontWeight: '600',
  },
  textInput: {
    height: 44,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#263554',
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    color: '#F8FAFC',
    fontSize: 13,
  },
  demoButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  demoButton: {
    flex: 1,
    height: 40,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#263554',
    backgroundColor: '#1E293B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  demoButtonText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#94A3B8',
    textAlign: 'center',
  },
  submitButton: {
    height: 46,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
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
