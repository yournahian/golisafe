import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { LightSensor } from 'expo-sensors';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import AppIcon from '../AppIcon';
import {
  HazardCategory,
  HazardSeverity,
  CreateHazardRequest,
} from '../../../../../packages/shared/api-contract';
import {
  uploadHazardImage,
  classifyWithAI,
  readFileAsBase64,
  type AiClassificationResult,
} from '../../services/storage';

export type QuickReportHazardPayload = CreateHazardRequest & {
  imageUri?: string;
  image_url?: string;
};

export interface QuickReportModalProps {
  visible: boolean;
  currentLocation: { latitude: number; longitude: number };
  initialCoords?: { latitude: number; longitude: number } | null;
  locationLabel?: string | null;
  distanceText?: string | null;
  onClose: () => void;
  onSubmitHazard: (payload: QuickReportHazardPayload) => Promise<void>;
  onOpenFullReport?: (draft: {
    category: HazardCategory;
    severity: HazardSeverity;
    latitude: number;
    longitude: number;
    landmarkContext: string;
    imageUri?: string;
  }) => void;
  isDark?: boolean;
  language?: 'en' | 'bn';
}

interface CategoryTileMeta {
  id: HazardCategory;
  title: string;
  titleBn: string;
  sub: string;
  subBn: string;
  accent: string;
  iconBg: string;
}

const CATEGORIES: CategoryTileMeta[] = [
  {
    id: 'extortion_spot',
    title: 'Chanda\nAlert',
    titleBn: 'চাঁদা\nসতর্কতা',
    sub: 'Extortion\nspot',
    subBn: 'চাঁদাবাজি',
    accent: '#F87171',
    iconBg: 'rgba(239, 68, 68, 0.16)',
  },
  {
    id: 'unlit_alley',
    title: 'Dark-Zone\nSafety',
    titleBn: 'অন্ধকার\nগলি',
    sub: 'Unlit alley',
    subBn: 'আলো নেই',
    accent: '#C084FC',
    iconBg: 'rgba(168, 85, 247, 0.16)',
  },
  {
    id: 'waterlogging',
    title: 'WaterLog',
    titleBn: 'জলাবদ্ধতা',
    sub: 'Flood depth',
    subBn: 'পানি জমা',
    accent: '#60A5FA',
    iconBg: 'rgba(59, 130, 246, 0.16)',
  },
  {
    id: 'pothole_manhole',
    title: 'Road\nHazard',
    titleBn: 'সড়ক\nঝুঁকি',
    sub: 'Open\nmanhole',
    subBn: 'খোলা গর্ত',
    accent: '#F87171',
    iconBg: 'rgba(248, 113, 113, 0.16)',
  },
  {
    id: 'unsafe_footbridge',
    title: 'Safe\nCrossing',
    titleBn: 'নিরাপদ\nপারাপার',
    sub: 'Crossing\nrisk',
    subBn: 'ফুটব্রিজ',
    accent: '#FB923C',
    iconBg: 'rgba(249, 115, 22, 0.16)',
  },
];

function CategorySvgIcon({
  category,
  color,
  size = 18,
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

export const QuickReportModal: React.FC<QuickReportModalProps> = ({
  visible,
  currentLocation,
  initialCoords,
  locationLabel,
  distanceText,
  onClose,
  onSubmitHazard,
  onOpenFullReport,
  isDark = true,
  language = 'en',
}) => {
  const bn = language === 'bn';
  const [selectedCategory, setSelectedCategory] =
    useState<HazardCategory>('pothole_manhole');
  const [hasTappedCategory, setHasTappedCategory] = useState<boolean>(false);
  const [selectedSeverity, setSelectedSeverity] =
    useState<HazardSeverity>('Medium');
  const [voiceLang, setVoiceLang] = useState<'Bangla' | 'Banglish' | 'English'>(
    'Bangla',
  );
  const [landmarkContext, setLandmarkContext] = useState<string>('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordDuration, setRecordDuration] = useState<number>(0);
  const [classifyingSource, setClassifyingSource] = useState<
    'voice' | 'photo' | null
  >(null);
  const [aiDraft, setAiDraft] = useState<AiClassificationResult | null>(null);
  const [luxReading, setLuxReading] = useState<number | null>(null);

  const effectiveCoords = initialCoords ?? currentLocation;
  const latitude = effectiveCoords.latitude;
  const longitude = effectiveCoords.longitude;

  useEffect(() => {
    if (!visible) {
      setHasTappedCategory(false);
      setAiDraft(null);
      setImageUri(null);
      setLandmarkContext('');
    }
  }, [visible]);

  useEffect(() => {
    return () => {
      if (recording) {
        recording.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, [recording]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordDuration((prev) => {
          if (prev + 1 >= 15) {
            stopVoiceRecording();
            return 15;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      setRecordDuration(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  useEffect(() => {
    let sub: { remove: () => void } | null = null;
    let active = true;
    if (visible && selectedCategory === 'unlit_alley') {
      LightSensor.isAvailableAsync()
        .then((avail) => {
          if (!active || !avail) return;
          LightSensor.setUpdateInterval(600);
          sub = LightSensor.addListener((d) => {
            if (active && typeof d.illuminance === 'number') {
              setLuxReading(Math.round(d.illuminance));
            }
          });
        })
        .catch(() => {});
    } else {
      setLuxReading(null);
    }
    return () => {
      active = false;
      sub?.remove();
    };
  }, [visible, selectedCategory]);

  const handlePhotoChoice = () => {
    Alert.alert(
      bn ? 'ছবি যুক্ত করুন' : 'Add Photo',
      bn ? 'ছবি তোলার মাধ্যম নির্বাচন করুন' : 'Choose photo source',
      [
        {
          text: bn ? 'ক্যামেরা' : 'Take Photo',
          onPress: () => pickImage(true),
        },
        {
          text: bn ? 'গ্যালারি' : 'Choose Gallery',
          onPress: () => pickImage(false),
        },
        { text: bn ? 'বাতিল' : 'Cancel', style: 'cancel' },
      ],
    );
  };

  const pickImage = async (fromCamera: boolean) => {
    try {
      if (fromCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(
            bn ? 'অনুমতি প্রয়োজন' : 'Permission Required',
            bn
              ? 'ছবি তুলতে ক্যামেরার অনুমতি দিন।'
              : 'Please grant camera permission to take a photo.',
          );
          return;
        }
      }
      const res = fromCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: false,
            quality: 0.7,
            base64: true,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: false,
            quality: 0.7,
            base64: true,
          });
      if (!res.canceled && res.assets?.[0]?.uri) {
        const asset = res.assets[0];
        setImageUri(asset.uri);
        if (asset.base64) {
          setClassifyingSource('photo');
          try {
            const aiRes = await classifyWithAI({
              imageBase64: asset.base64,
              text: landmarkContext.trim() || undefined,
              currentCategory: selectedCategory,
            });
            if (aiRes && !aiRes.fallback) {
              setSelectedCategory(aiRes.category);
              setSelectedSeverity(aiRes.severity);
              setHasTappedCategory(true);
              setAiDraft(aiRes);
            }
          } finally {
            setClassifyingSource(null);
          }
        }
      }
    } catch (err: any) {
      Alert.alert(
        bn ? 'ত্রুটি' : 'Error',
        err?.message || 'Unable to attach photo. Please try again.',
      );
    }
  };

  const startVoiceRecording = async () => {
    try {
      setAiDraft(null);
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          bn ? 'অনুমতি প্রয়োজন' : 'Microphone Permission',
          bn
            ? 'ভয়েস রিপোর্ট রেকর্ড করতে মাইক্রোফোনের অনুমতি দিন।'
            : 'Please grant microphone access to record a voice report.',
        );
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      setRecording(rec);
      setRecordDuration(0);
      setIsRecording(true);
    } catch {
      Alert.alert('Recording Error', 'Unable to start audio recording.');
    }
  };

  const stopVoiceRecording = async () => {
    if (!recording) return;
    try {
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (uri) {
        setClassifyingSource('voice');
        const audioBase64 = await readFileAsBase64(uri);
        const res = await classifyWithAI({
          audioBase64: audioBase64 || undefined,
          audioMimeType: 'audio/mp4',
          text: landmarkContext.trim() || undefined,
          currentCategory: selectedCategory,
        });
        setClassifyingSource(null);
        if (res && !res.fallback) {
          setSelectedCategory(res.category);
          setSelectedSeverity(res.severity);
          setHasTappedCategory(true);
          if (res.transcript) {
            setLandmarkContext(res.transcript);
          }
          setAiDraft(res);
        }
      }
    } catch {
      setIsRecording(false);
      setClassifyingSource(null);
      setRecording(null);
    }
  };

  const handleQuickSubmit = async () => {
    try {
      setIsSubmitting(true);
      let uploadedUrl = imageUri ?? undefined;
      if (imageUri) {
        const remote = await uploadHazardImage(imageUri);
        if (remote) uploadedUrl = remote;
      }
      let finalLandmark =
        landmarkContext.trim() || locationLabel?.trim() || undefined;
      let finalSubTag: string | undefined;
      if (selectedCategory === 'unlit_alley' && luxReading !== null) {
        finalSubTag = `${luxReading} lux (${luxReading < 15 ? 'Dark Alley Confirmed' : 'Well-Lit'})`;
      }
      await onSubmitHazard({
        category: selectedCategory,
        severity: selectedSeverity,
        latitude,
        longitude,
        landmark_context: finalLandmark,
        sub_tag: finalSubTag,
        imageUri: uploadedUrl,
        image_url: uploadedUrl,
      });
      onClose();
    } catch (err: any) {
      Alert.alert(
        bn ? 'সাবমিশন ব্যর্থ' : 'Submission Error',
        err?.message || 'Could not submit hazard report.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const subtitleText = locationLabel
    ? `${locationLabel}${distanceText ? ` · ${distanceText}` : ''}`
    : `${latitude.toFixed(4)}°N, ${longitude.toFixed(4)}°E`;

  const theme = isDark
    ? {
        sheetBg: '#10182B',
        sheetBorder: '#1E2D4A',
        cardBg: '#152036',
        cardBorder: '#243556',
        text: '#F8FAFC',
        textSub: '#94A3B8',
        closeBg: '#18243E',
        closeBorder: '#283B60',
      }
    : {
        sheetBg: '#FFFFFF',
        sheetBorder: '#CBD5E1',
        cardBg: '#F8FAFC',
        cardBorder: '#E2E8F0',
        text: '#0F172A',
        textSub: '#64748B',
        closeBg: '#F1F5F9',
        closeBorder: '#CBD5E1',
      };

  const canQuickSubmit = hasTappedCategory || Boolean(imageUri) || Boolean(aiDraft);

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

        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.sheetBg,
              borderColor: theme.sheetBorder,
            },
          ]}
        >
          {/* Sleek grabber handle for premium bottom HUD */}
          <View style={styles.grabberHandle} />

          {/* Header: Quick Report + Near <location> + Close */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: theme.text }]}>
                {bn ? 'দ্রুত রিপোর্ট' : 'Quick Report'}
              </Text>
              <Text
                style={[styles.subtitle, { color: theme.textSub }]}
                numberOfLines={1}
              >
                {subtitleText}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[
                styles.closeBtn,
                {
                  backgroundColor: theme.closeBg,
                  borderColor: theme.closeBorder,
                },
              ]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={[styles.closeText, { color: theme.text }]}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Select hazard category — 5 crisp vertical Figma cards */}
          <Text style={[styles.sectionLabel, { color: theme.textSub }]}>
            {bn ? 'ঝুঁকির ক্যাটাগরি নির্বাচন করুন' : 'Select hazard category'}
          </Text>
          <View style={styles.catRow}>
            {CATEGORIES.map((cat) => {
              const active = hasTappedCategory && selectedCategory === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.catCard,
                    {
                      backgroundColor: active ? cat.iconBg : theme.cardBg,
                      borderColor: active ? cat.accent : theme.cardBorder,
                    },
                  ]}
                  onPress={() => {
                    setSelectedCategory(cat.id);
                    setHasTappedCategory(true);
                  }}
                  activeOpacity={0.8}
                >
                  <View
                    style={[styles.catIconBox, { backgroundColor: cat.iconBg }]}
                  >
                    <CategorySvgIcon
                      category={cat.id}
                      color={cat.accent}
                      size={18}
                    />
                  </View>
                  <Text
                    style={[styles.catTitle, { color: theme.text }]}
                    numberOfLines={2}
                  >
                    {bn ? cat.titleBn : cat.title}
                  </Text>
                  <Text
                    style={[styles.catSub, { color: theme.textSub }]}
                    numberOfLines={2}
                  >
                    {bn ? cat.subBn : cat.sub}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Voice Report Card matching Figma SS1 */}
          <View
            style={[
              styles.voiceCard,
              {
                backgroundColor: theme.cardBg,
                borderColor: theme.cardBorder,
              },
            ]}
          >
            <View style={styles.voiceTopRow}>
              <Text style={[styles.voiceTitle, { color: theme.text }]}>
                {bn
                  ? 'ভয়েস রিপোর্ট রেকর্ড করতে ট্যাপ করুন'
                  : 'Tap to record a voice report'}
              </Text>
              <View style={styles.timerBadge}>
                <Text style={styles.timerBadgeText}>
                  00:{String(recordDuration).padStart(2, '0')} / 00:15
                </Text>
              </View>
            </View>

            <View style={styles.langRow}>
              {(['Bangla', 'Banglish', 'English'] as const).map((lang) => {
                const active = voiceLang === lang;
                return (
                  <TouchableOpacity
                    key={lang}
                    onPress={() => setVoiceLang(lang)}
                    style={[
                      styles.langPill,
                      active && styles.langPillActive,
                    ]}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.langPillText,
                        active && styles.langPillTextActive,
                      ]}
                    >
                      {lang}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[
                styles.recordBtn,
                isRecording && { backgroundColor: '#EF4444' },
              ]}
              onPress={isRecording ? stopVoiceRecording : startVoiceRecording}
              disabled={classifyingSource !== null}
              activeOpacity={0.85}
            >
              {classifyingSource !== null ? (
                <>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.recordBtnText}>
                    {classifyingSource === 'photo'
                      ? bn
                        ? 'এআই ছবি বিশ্লেষণ চলছে…'
                        : 'AI Analyzing Photo…'
                      : bn
                        ? 'এআই ভয়েস বিশ্লেষণ চলছে…'
                        : 'AI Analyzing Voice…'}
                  </Text>
                </>
              ) : isRecording ? (
                <>
                  <AppIcon name="stop-circle" size={18} color="#FFFFFF" />
                  <Text style={styles.recordBtnText}>
                    {bn
                      ? `রেকর্ডিং বন্ধ করুন (${15 - recordDuration}s)`
                      : `Stop recording (${15 - recordDuration}s left)`}
                  </Text>
                </>
              ) : (
                <>
                  <AppIcon name="mic" size={17} color="#FFFFFF" />
                  <Text style={styles.recordBtnText}>
                    {bn
                      ? 'ভয়েস রিপোর্ট রেকর্ড করুন (সর্বোচ্চ ১৫ সে.)'
                      : 'Record voice report (15s max)'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Compact AI Detection / Photo Preview Pill */}
          {(aiDraft || imageUri) && (
            <View style={styles.attachmentRow}>
              {imageUri && (
                <Image
                  source={{ uri: imageUri }}
                  style={styles.thumbPreview}
                  resizeMode="cover"
                />
              )}
              <View style={{ flex: 1 }}>
                {aiDraft ? (
                  <Text style={styles.aiDetectedLine} numberOfLines={2}>
                    ✨ AI: {CATEGORIES.find((c) => c.id === aiDraft.category)?.title.replace('\n', ' ')} · {aiDraft.severity}
                    {aiDraft.transcript ? ` — "${aiDraft.transcript}"` : ''}
                  </Text>
                ) : (
                  <Text style={styles.aiDetectedLine}>
                    📷 {bn ? 'ছবি সংযুক্ত করা হয়েছে' : 'Photo attached & GPS tagged'}
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* Bottom Row: Add Photo + Full Report Form (Figma SS1) */}
          <View style={styles.bottomBtnRow}>
            <TouchableOpacity
              style={[
                styles.secondaryActionBtn,
                {
                  backgroundColor: theme.cardBg,
                  borderColor: theme.cardBorder,
                },
              ]}
              onPress={handlePhotoChoice}
              activeOpacity={0.85}
            >
              <AppIcon name="camera" size={16} color={theme.text} />
              <Text style={[styles.secondaryActionText, { color: theme.text }]}>
                {imageUri
                  ? bn
                    ? 'ছবি বদলান'
                    : 'Change Photo'
                  : bn
                    ? 'ছবি যুক্ত করুন'
                    : 'Add Photo'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.fullFormBtn}
              onPress={() => {
                onOpenFullReport?.({
                  category: selectedCategory,
                  severity: selectedSeverity,
                  latitude,
                  longitude,
                  landmarkContext:
                    landmarkContext.trim() || locationLabel?.trim() || '',
                  imageUri: imageUri ?? undefined,
                });
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.fullFormBtnText}>
                {bn ? 'সম্পূর্ণ রিপোর্ট ফর্ম' : 'Full Report Form'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Instant 1-tap Submit appears once category/voice/photo is chosen */}
          {canQuickSubmit && (
            <TouchableOpacity
              style={styles.quickSubmitBtn}
              onPress={handleQuickSubmit}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.quickSubmitText}>
                  {bn ? 'এখনই সাবমিট করুন' : 'Submit Quick Report'}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(6, 11, 23, 0.58)',
    justifyContent: 'flex-end',
  },
  backdropDismiss: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1.2,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 18,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.48,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: -8 },
    elevation: 20,
  },
  grabberHandle: {
    width: 38,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(148, 163, 184, 0.38)',
    alignSelf: 'center',
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12.5,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 15,
    fontWeight: '700',
  },
  sectionLabel: {
    fontSize: 12.5,
    fontWeight: '500',
    marginTop: 2,
  },
  catRow: {
    flexDirection: 'row',
    gap: 6,
  },
  catCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    gap: 6,
  },
  catIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catTitle: {
    fontSize: 10.5,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 13,
  },
  catSub: {
    fontSize: 9.5,
    textAlign: 'center',
    lineHeight: 12,
  },
  voiceCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  voiceTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  voiceTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    flex: 1,
  },
  timerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderWidth: 1,
    borderColor: '#293C60',
  },
  timerBadgeText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
  },
  langRow: {
    flexDirection: 'row',
    gap: 8,
  },
  langPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#283A5E',
    backgroundColor: '#111A2E',
  },
  langPillActive: {
    borderColor: '#3B82F6',
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  langPillText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  langPillTextActive: {
    color: '#93C5FD',
  },
  recordBtn: {
    height: 48,
    borderRadius: 13,
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#3B82F6',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  recordBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  attachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.35)',
  },
  thumbPreview: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  aiDetectedLine: {
    color: '#BFDBFE',
    fontSize: 12,
    fontWeight: '600',
  },
  bottomBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryActionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryActionText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  fullFormBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#3B82F6',
    backgroundColor: 'rgba(59, 130, 246, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullFormBtnText: {
    color: '#93C5FD',
    fontSize: 13.5,
    fontWeight: '700',
  },
  quickSubmitBtn: {
    height: 44,
    borderRadius: 12,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickSubmitText: {
    color: '#06281E',
    fontSize: 14,
    fontWeight: '800',
  },
});

export default QuickReportModal;
