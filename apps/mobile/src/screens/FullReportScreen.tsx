import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { LightSensor } from 'expo-sensors';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type {
  HazardCategory,
  HazardSeverity,
} from '../../../../packages/shared/api-contract';
import type { QuickReportHazardPayload } from '../components/Report/QuickReportModal';
import BottomNavBar from '../components/BottomNavBar';
import { TRANSLATIONS, type Language } from '../i18n/translations';
import {
  classifyWithAI,
  readFileAsBase64,
  uploadHazardImage,
  type AiClassificationResult,
} from '../services/storage';
import {
  CATEGORY_META,
  DARK_THEME,
  DHAKA_STREETS,
  LIGHT_THEME,
  MODULE_ORDER,
} from './mapConstants';
import { computeDistanceMeters } from './mapGeoUtils';

export interface FullReportDraft {
  category?: HazardCategory;
  severity?: HazardSeverity;
  latitude?: number;
  longitude?: number;
  landmarkContext?: string;
  imageUri?: string;
}

export interface FullReportScreenProps {
  visible: boolean;
  userLocation: { latitude: number; longitude: number };
  initialCoords?: { latitude: number; longitude: number } | null;
  initialLabel?: string | null;
  draft?: FullReportDraft | null;
  isDark?: boolean;
  language?: Language;
  onClose: () => void;
  onOpenAlerts: () => void;
  onSubmitHazard: (payload: QuickReportHazardPayload) => Promise<void>;
}

const LANDMARK_PRESETS = [
  {
    label: 'Block 34, New Grid Corner',
    latitude: 23.767,
    longitude: 90.424,
  },
  {
    label: 'Baridhara Block J, Road 12',
    latitude: 23.8035,
    longitude: 90.4227,
  },
  {
    label: 'Mohakhali Flyover Approach',
    latitude: 23.7778,
    longitude: 90.4057,
  },
  {
    label: 'Banasree Main Canal Road',
    latitude: 23.7639,
    longitude: 90.4314,
  },
  {
    label: 'Malibagh Railgate Crossing',
    latitude: 23.7495,
    longitude: 90.4128,
  },
];

const FOOTBRIDGE_SUBTAGS = [
  'Addicts/Snatchers at Night',
  'Hawker Blocked',
  'Broken Lighting',
];

const SEVERITIES: HazardSeverity[] = ['Low', 'Medium', 'Critical'];

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
          <Path d="M2.5 15c1.6 1.4 3.8 1.4 5.4 0 1.6-1.4 3.8-1.4 5.4 0 1.6 1.4 3.8 1.4 5.4 0" />
          <Path d="M2.5 19.5c1.6 1.4 3.8 1.4 5.4 0 1.6-1.4 3.8-1.4 5.4 0 1.6 1.4 3.8 1.4 5.4 0" />
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

function buildMiniMapHtml(lat: number, lng: number): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #mini-map { margin: 0; padding: 0; width: 100%; height: 100%; background: #E9E2D9; }
    .pin-head {
      width: 28px; height: 28px; border-radius: 50% 50% 50% 4px;
      background: #3B82F6; border: 2px solid #FFFFFF; transform: rotate(-45deg);
      box-shadow: 0 4px 10px rgba(37, 99, 235, 0.45);
      display: flex; align-items: center; justify-content: center;
    }
    .pin-core { width: 10px; height: 10px; border-radius: 50%; background: #FFFFFF; transform: rotate(45deg); }
  </style>
</head>
<body>
  <div id="mini-map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const map = L.map('mini-map', {
      center: [${lat}, ${lng}],
      zoom: 13,
      zoomControl: false,
      attributionControl: false
    });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(map);
    const pinIcon = L.divIcon({
      className: '',
      iconSize: [28, 32],
      iconAnchor: [14, 28],
      html: '<div class="pin-head"><div class="pin-core"></div></div>'
    });
    const marker = L.marker([${lat}, ${lng}], { icon: pinIcon, draggable: true }).addTo(map);
    function postCoords(pos) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'MINI_PIN',
          latitude: pos.lat,
          longitude: pos.lng
        }));
      }
    }
    marker.on('dragend', function(e) { postCoords(e.target.getLatLng()); });
    map.on('click', function(e) { marker.setLatLng(e.latlng); postCoords(e.latlng); });
    window.moveMiniPin = function(lat, lng) {
      marker.setLatLng([lat, lng]);
      map.setView([lat, lng], 13, { animate: true });
    };
  </script>
</body>
</html>`;
}

export default function FullReportScreen({
  visible,
  userLocation,
  initialCoords,
  initialLabel,
  draft,
  isDark = true,
  language = 'en',
  onClose,
  onOpenAlerts,
  onSubmitHazard,
}: FullReportScreenProps) {
  const theme = isDark ? DARK_THEME : LIGHT_THEME;
  const t = TRANSLATIONS[language];

  const [category, setCategory] = useState<HazardCategory>('pothole_manhole');
  const [severity, setSeverity] = useState<HazardSeverity>('Medium');
  const [subTag, setSubTag] = useState<string | undefined>('Open manhole');
  const [description, setDescription] = useState<string>('');
  const [waterDepth, setWaterDepth] = useState<'Ankle-deep' | 'Knee-deep' | 'Impassable'>('Knee-deep');
  const [surfaceCheck, setSurfaceCheck] = useState<string>('Open manhole verified');
  const [reportMode, setReportMode] = useState<'manual' | 'voice'>('manual');
  const [voiceLang, setVoiceLang] = useState<'Bangla' | 'Banglish' | 'English'>(
    'Bangla',
  );

  const [latitude, setLatitude] = useState<number>(userLocation.latitude);
  const [longitude, setLongitude] = useState<number>(userLocation.longitude);
  const [locationText, setLocationText] = useState<string>(
    LANDMARK_PRESETS[0].label,
  );
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Voice + AI state
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordSeconds, setRecordSeconds] = useState<number>(0);
  const [isClassifying, setIsClassifying] = useState<boolean>(false);
  const [aiResult, setAiResult] = useState<AiClassificationResult | null>(null);

  // FR-09 Lux sensor state for unlit_alley
  const [luxReading, setLuxReading] = useState<number | null>(null);
  const [sensorAvailable, setSensorAvailable] = useState<boolean | null>(null);

  const miniMapRef = useRef<WebView>(null);
  const [miniMapReady, setMiniMapReady] = useState<boolean>(false);

  const effectiveInitLat =
    draft?.latitude ?? initialCoords?.latitude ?? userLocation.latitude;
  const effectiveInitLng =
    draft?.longitude ?? initialCoords?.longitude ?? userLocation.longitude;

  useEffect(() => {
    if (!visible) {
      setMiniMapReady(false);
      return;
    }
    setLatitude(effectiveInitLat);
    setLongitude(effectiveInitLng);
    setCategory(draft?.category ?? 'pothole_manhole');
    setSeverity(draft?.severity ?? 'Medium');
    setImageUri(draft?.imageUri ?? null);
    setLocationText(
      draft?.landmarkContext?.trim() ||
        initialLabel?.trim() ||
        LANDMARK_PRESETS[0].label,
    );
    setSubTag(undefined);
    setAiResult(null);
    setReportMode('manual');
  }, [
    visible,
    draft,
    initialCoords,
    initialLabel,
    effectiveInitLat,
    effectiveInitLng,
  ]);

  useEffect(() => {
    if (!visible || !miniMapReady || !miniMapRef.current) return;
    miniMapRef.current.injectJavaScript(
      `window.moveMiniPin && window.moveMiniPin(${latitude}, ${longitude}); true;`,
    );
  }, [visible, miniMapReady, latitude, longitude]);

  // 15s voice recording timer
  useEffect(() => {
    if (!isRecording) return;
    const interval = setInterval(() => {
      setRecordSeconds((prev) => {
        if (prev + 1 >= 15) {
          handleStopRecording();
          return 15;
        }
        return prev + 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isRecording]);

  // Ambient Light Sensor for Dark-Zone Safety
  useEffect(() => {
    if (!visible || category !== 'unlit_alley') {
      setLuxReading(null);
      return;
    }
    let sub: { remove: () => void } | null = null;
    let active = true;
    LightSensor.isAvailableAsync()
      .then((avail) => {
        if (!active) return;
        setSensorAvailable(avail);
        if (avail) {
          LightSensor.setUpdateInterval(500);
          sub = LightSensor.addListener((d) => {
            if (active && typeof d.illuminance === 'number') {
              setLuxReading(Math.round(d.illuminance));
            }
          });
        }
      })
      .catch(() => {
        if (active) setSensorAvailable(false);
      });
    return () => {
      active = false;
      sub?.remove();
    };
  }, [visible, category]);

  // Dynamically pick the 5 nearest landmarks to the user's current GPS / selected pin
  const nearbyPresets = useMemo(() => {
    return [...DHAKA_STREETS]
      .sort(
        (a, b) =>
          computeDistanceMeters(
            effectiveInitLat,
            effectiveInitLng,
            a.latitude,
            a.longitude,
          ) -
          computeDistanceMeters(
            effectiveInitLat,
            effectiveInitLng,
            b.latitude,
            b.longitude,
          ),
      )
      .slice(0, 5);
  }, [effectiveInitLat, effectiveInitLng]);

  const distanceText = useMemo(() => {
    const meters = computeDistanceMeters(
      userLocation.latitude,
      userLocation.longitude,
      latitude,
      longitude,
    );
    return meters < 1000
      ? `${Math.max(20, meters)} m away`
      : `${(meters / 1000).toFixed(1)} km away`;
  }, [userLocation, latitude, longitude]);

  const miniMapHtml = useMemo(
    () => buildMiniMapHtml(effectiveInitLat, effectiveInitLng),
    [visible, effectiveInitLat, effectiveInitLng],
  );

  const handleSelectPreset = (preset: (typeof LANDMARK_PRESETS)[number]) => {
    setLocationText(preset.label);
    setLatitude(preset.latitude);
    setLongitude(preset.longitude);
    miniMapRef.current?.injectJavaScript(
      `window.moveMiniPin && window.moveMiniPin(${preset.latitude}, ${preset.longitude}); true;`,
    );
  };

  const handleMiniMapMessage = (event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (
        msg?.type === 'MINI_PIN' &&
        typeof msg.latitude === 'number' &&
        typeof msg.longitude === 'number'
      ) {
        setLatitude(msg.latitude);
        setLongitude(msg.longitude);
      }
    } catch {
      // Ignore malformed messages
    }
  };

  const handlePickPhoto = async (fromCamera: boolean) => {
    try {
      if (fromCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(
            language === 'bn' ? 'অনুমতি প্রয়োজন' : 'Permission Required',
            language === 'bn'
              ? 'ছবি তুলতে ক্যামেরার অনুমতি দিন।'
              : 'Please grant camera permission to capture photo evidence.',
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
          setIsClassifying(true);
          try {
            const aiRes = await classifyWithAI({
              imageBase64: asset.base64,
              text: locationText.trim() || undefined,
              currentCategory: category,
            });
            if (aiRes && !aiRes.fallback) {
              setAiResult(aiRes);
              setCategory(aiRes.category);
              setSeverity(aiRes.severity);
            }
          } finally {
            setIsClassifying(false);
          }
        }
      }
    } catch (err: any) {
      Alert.alert(
        language === 'bn' ? 'ত্রুটি' : 'Error',
        err?.message || 'Unable to attach photo. Please try again.',
      );
    }
  };

  const handleStartRecording = async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          language === 'bn' ? 'মাইক্রোফোন অনুমতি' : 'Microphone Permission',
          language === 'bn'
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
      setRecordSeconds(0);
      setIsRecording(true);
      setAiResult(null);
    } catch {
      Alert.alert('Recording Error', 'Could not start voice recording.');
    }
  };

  const handleStopRecording = async () => {
    setIsRecording(false);
    try {
      let recordedUri: string | null = null;
      if (recording) {
        await recording.stopAndUnloadAsync();
        recordedUri = recording.getURI();
        setRecording(null);
      }
      setIsClassifying(true);
      const audioBase64 = recordedUri ? await readFileAsBase64(recordedUri) : null;
      const res = await classifyWithAI({
        audioBase64: audioBase64 || undefined,
        audioMimeType: 'audio/mp4',
        text: locationText.trim() || undefined,
        currentCategory: category,
      });
      setIsClassifying(false);
      if (res && !res.fallback) {
        setAiResult(res);
        setCategory(res.category);
        setSeverity(res.severity);
        if (res.transcript) {
          setDescription(res.transcript);
        }
        if (res.landmark_context) {
          setLocationText(res.landmark_context);
        }
      } else {
        Alert.alert(
          language === 'bn' ? 'ভয়েস রেকর্ড সম্পন্ন' : 'Voice Recorded',
          language === 'bn'
            ? 'লাইভ AI ভয়েস বিশ্লেষণের জন্য সার্ভারে GEMINI_API_KEY প্রয়োজন — আপনার নির্বাচিত ক্যাটাগরি অপরিবর্তিত রাখা হয়েছে।'
            : 'Live AI voice analysis requires GEMINI_API_KEY on the backend — your selected category was preserved.',
        );
      }
    } catch {
      setIsClassifying(false);
    }
  };

  const handleSubmit = async () => {
    const trimmedLoc = locationText.trim();
    if (!trimmedLoc) {
      Alert.alert(
        language === 'bn' ? 'অবস্থান প্রয়োজন' : 'Location Required',
        language === 'bn'
          ? 'দয়া করে রাস্তা বা এলাকার নাম লিখুন।'
          : 'Please enter a street address or landmark.',
      );
      return;
    }

    try {
      setIsSubmitting(true);
      let uploadedUrl: string | undefined = imageUri ?? undefined;
      if (imageUri) {
        const remote = await uploadHazardImage(imageUri);
        if (remote) uploadedUrl = remote;
      }

      let finalSubTag = subTag;
      if (category === 'waterlogging') {
        finalSubTag = waterDepth;
      } else if (category === 'unlit_alley' && sensorAvailable && luxReading !== null) {
        finalSubTag = `${luxReading} lux (${luxReading < 15 ? 'Dark Alley Confirmed' : 'Well-Lit'})`;
      }

      const finalContext = description.trim()
        ? `${trimmedLoc} — ${description.trim()}`
        : trimmedLoc;

      await onSubmitHazard({
        category,
        severity,
        latitude,
        longitude,
        landmark_context: finalContext,
        sub_tag: finalSubTag,
        imageUri: uploadedUrl,
        image_url: uploadedUrl,
      });
      onClose();
    } catch (err) {
      Alert.alert(
        language === 'bn' ? 'সাবমিশন ব্যর্থ' : 'Submission Error',
        err instanceof Error ? err.message : 'Failed to submit hazard report.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const topInset = Platform.OS === 'android' ? 12 : 52;

  // Unmount modal body when hidden so Android ScrollView always measures fresh contentSize on open
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.screen, { backgroundColor: theme.bg }]}>
        <StatusBar
          barStyle={theme.statusBarStyle}
          backgroundColor={theme.bg}
        />

        {/* Top Bar: Back Button + "Report a hazard" */}
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
            {language === 'bn' ? 'ঝুঁকি রিপোর্ট করুন' : 'Report a hazard'}
          </Text>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          nestedScrollEnabled
          overScrollMode="never"
          scrollEventThrottle={16}
        >
          {/* Select Category — 5 Horizontal Cards matching Figma */}
          <Text style={[styles.sectionLabel, { color: theme.text }]}>
            {language === 'bn' ? 'ক্যাটাগরি নির্বাচন করুন' : 'Select category'}
          </Text>
          <View style={styles.categoryRow}>
            {MODULE_ORDER.map((catId) => {
              const meta = CATEGORY_META[catId];
              const active = category === catId;
              const accent = isDark ? meta.color : meta.lightColor;
              const surface = isDark ? meta.surface : meta.lightSurface;
              const shortTitle =
                catId === 'extortion_spot'
                  ? 'Chanda\nAlert'
                  : catId === 'unlit_alley'
                    ? 'Dark-Zone\nSafety'
                    : catId === 'waterlogging'
                      ? 'WaterLog'
                      : catId === 'pothole_manhole'
                        ? 'Road\nHazard'
                        : 'Safe\nCrossing';

              return (
                <TouchableOpacity
                  key={catId}
                  style={[
                    styles.catCard,
                    {
                      backgroundColor: active ? surface : theme.chipBg,
                      borderColor: active ? accent : theme.borderStrong,
                    },
                  ]}
                  onPress={() => setCategory(catId)}
                  activeOpacity={0.8}
                >
                  <CategorySvgIcon category={catId} color={accent} size={18} />
                  <Text
                    style={[
                      styles.catLabel,
                      { color: active ? theme.text : theme.chipText },
                    ]}
                    numberOfLines={2}
                  >
                    {shortTitle}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Location Card with Mini Map Preview, Input & Preset Chips */}
          <View
            style={[
              styles.locationCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <View style={styles.locationHeader}>
              <Text style={[styles.locationTitle, { color: theme.text }]}>
                {language === 'bn' ? 'অবস্থান' : 'Location'}
              </Text>
              <View
                style={[
                  styles.distanceBadge,
                  { backgroundColor: theme.primarySurface },
                ]}
              >
                <Text
                  style={[styles.distanceBadgeText, { color: theme.primaryText }]}
                >
                  {distanceText}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.miniMapWrap,
                { borderColor: theme.borderStrong },
              ]}
            >
              <WebView
                ref={miniMapRef}
                style={styles.miniMap}
                source={{ html: miniMapHtml }}
                originWhitelist={['*']}
                javaScriptEnabled
                scrollEnabled={false}
                nestedScrollEnabled={false}
                onLoadEnd={() => setMiniMapReady(true)}
                onMessage={handleMiniMapMessage}
              />
            </View>

            <View
              style={[
                styles.inputBox,
                {
                  backgroundColor: theme.searchBg,
                  borderColor: theme.borderStrong,
                },
              ]}
            >
              <Text
                style={[styles.inputLabel, { color: theme.textSecondary }]}
              >
                {language === 'bn' ? 'অবস্থান *' : 'Location *'}
              </Text>
              <TextInput
                style={[styles.textInput, { color: theme.text }]}
                value={locationText}
                onChangeText={setLocationText}
                placeholder={
                  language === 'bn'
                    ? 'রাস্তা বা এলাকার নাম লিখুন'
                    : 'Street address or landmark'
                }
                placeholderTextColor={theme.searchPlaceholder}
              />
            </View>

            <View style={styles.presetWrap}>
              {nearbyPresets.map((preset) => {
                const selected = locationText.trim() === preset.label;
                return (
                  <TouchableOpacity
                    key={preset.label}
                    style={[
                      styles.presetChip,
                      {
                        backgroundColor: selected
                          ? theme.primarySurface
                          : theme.surfaceElevated,
                        borderColor: selected
                          ? theme.primary
                          : theme.borderStrong,
                      },
                    ]}
                    onPress={() => handleSelectPreset(preset)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.presetChipText,
                        { color: selected ? theme.primaryText : theme.text },
                      ]}
                    >
                      {preset.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Manual Report vs Voice Report Segmented Tabs */}
          <View
            style={[
              styles.modeTabsWrap,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.modeTab,
                reportMode === 'manual' && {
                  backgroundColor: theme.primarySurface,
                  borderColor: theme.primary,
                },
              ]}
              onPress={() => setReportMode('manual')}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.modeTabText,
                  {
                    color:
                      reportMode === 'manual'
                        ? theme.primaryText
                        : theme.textSecondary,
                  },
                ]}
              >
                {language === 'bn' ? 'ম্যানুয়াল রিপোর্ট' : 'Manual report'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modeTab,
                reportMode === 'voice' && {
                  backgroundColor: theme.primarySurface,
                  borderColor: theme.primary,
                },
              ]}
              onPress={() => setReportMode('voice')}
              activeOpacity={0.85}
            >
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"
                  stroke={
                    reportMode === 'voice'
                      ? theme.primaryText
                      : theme.textSecondary
                  }
                  strokeWidth={2}
                />
                <Path
                  d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3"
                  stroke={
                    reportMode === 'voice'
                      ? theme.primaryText
                      : theme.textSecondary
                  }
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              </Svg>
              <Text
                style={[
                  styles.modeTabText,
                  {
                    color:
                      reportMode === 'voice'
                        ? theme.primaryText
                        : theme.textSecondary,
                  },
                ]}
              >
                {language === 'bn' ? 'ভয়েস রিপোর্ট' : 'Voice report'}
              </Text>
            </TouchableOpacity>
          </View>

          {reportMode === 'manual' ? (
            <View style={{ gap: 14 }}>
              {/* AI Draft Assist Card (Figma SS2) */}
              <View
                style={[
                  styles.detailsCard,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontSize: 13.5, fontWeight: '700' }}>
                    {language === 'bn' ? 'AI ড্রাফট অ্যাসিস্ট' : 'AI Draft Assist'}
                  </Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 11.5, marginTop: 2 }}>
                    {language === 'bn'
                      ? 'ট্রান্সক্রিপ্ট, ক্যাটাগরি ও লোকেশন অটো-ফিল করুন।'
                      : 'Auto-fill transcript, category and location.'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={{
                    backgroundColor: '#3B82F6',
                    paddingHorizontal: 14,
                    paddingVertical: 9,
                    borderRadius: 10,
                  }}
                  onPress={async () => {
                    if (!description.trim() && !locationText.trim()) return;
                    setIsClassifying(true);
                    try {
                      const res = await classifyWithAI({
                        text: `${description} ${locationText}`.trim(),
                        currentCategory: category,
                      });
                      if (res) {
                        setAiResult(res);
                        setCategory(res.category);
                        setSeverity(res.severity);
                      }
                    } finally {
                      setIsClassifying(false);
                    }
                  }}
                  disabled={isClassifying}
                  activeOpacity={0.85}
                >
                  {isClassifying ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={{ color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' }}>
                      {language === 'bn' ? 'রিভিউ করুন' : 'Review report'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Category-specific hazard type pills (Figma SS2: Road hazard type) */}
              <View style={{ gap: 8 }}>
                <Text style={{ color: theme.text, fontSize: 13.5, fontWeight: '700' }}>
                  {category === 'pothole_manhole'
                    ? language === 'bn'
                      ? 'সড়ক ঝুঁকির ধরন'
                      : 'Road hazard type'
                    : category === 'unsafe_footbridge'
                      ? 'Footbridge risk type'
                      : category === 'waterlogging'
                        ? 'Flood level'
                        : category === 'unlit_alley'
                          ? 'Lighting issue'
                          : 'Extortion type'}
                </Text>
                <View style={styles.severityRow}>
                  {(category === 'pothole_manhole'
                    ? ['Pothole', 'Open manhole', 'Road damage']
                    : category === 'unsafe_footbridge'
                      ? FOOTBRIDGE_SUBTAGS
                      : category === 'waterlogging'
                        ? ['Ankle-deep', 'Knee-deep', 'Impassable']
                        : category === 'unlit_alley'
                          ? ['No lights', 'Broken lamp', 'Pitch dark']
                          : ['Illegal toll', 'Snatcher spot', 'Night threat']
                  ).map((opt) => {
                    const active = subTag === opt;
                    return (
                      <TouchableOpacity
                        key={opt}
                        style={[
                          styles.severityChip,
                          {
                            backgroundColor: active
                              ? 'rgba(239, 68, 68, 0.16)'
                              : theme.surfaceElevated,
                            borderColor: active ? '#EF4444' : theme.borderStrong,
                          },
                        ]}
                        onPress={() => setSubTag(opt)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.severityChipText,
                            { color: active ? '#FCA5A5' : theme.text },
                          ]}
                          numberOfLines={1}
                        >
                          {opt}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Description * multi-line box (Figma SS2) */}
              <View
                style={[
                  styles.inputBox,
                  {
                    backgroundColor: theme.searchBg,
                    borderColor: theme.borderStrong,
                    minHeight: 88,
                  },
                ]}
              >
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                  {language === 'bn' ? 'বিবরণ *' : 'Description *'}
                </Text>
                <TextInput
                  style={[styles.textInput, { color: theme.text, minHeight: 54, textAlignVertical: 'top' }]}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  placeholder={
                    language === 'bn'
                      ? 'রাস্তার ঝুঁকিটি সংক্ষেপে বর্ণনা করুন'
                      : 'Describe the road hazard'
                  }
                  placeholderTextColor={theme.searchPlaceholder}
                />
              </View>

              {/* Amber Safety Callout (Figma SS2) */}
              <View
                style={{
                  backgroundColor: 'rgba(245, 158, 11, 0.14)',
                  borderColor: 'rgba(245, 158, 11, 0.35)',
                  borderWidth: 1,
                  borderRadius: 10,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                }}
              >
                <Text style={{ color: '#FCD34D', fontSize: 12.5, fontWeight: '600' }}>
                  {language === 'bn'
                    ? 'খোলা গর্ত বা ঝুঁকিপূর্ণ স্থান থেকে নিরাপদ দূরত্ব বজায় রাখুন।'
                    : 'Keep clear of open hazards.'}
                </Text>
              </View>

              {/* Severity Level row */}
              <View style={{ gap: 8 }}>
                <Text style={[styles.subSectionLabel, { color: theme.textSecondary }]}>
                  {language === 'bn' ? 'ঝুঁকির মাত্রা' : 'SEVERITY LEVEL'}
                </Text>
                <View style={styles.severityRow}>
                  {SEVERITIES.map((sev) => {
                    const active = severity === sev;
                    const sevColor =
                      sev === 'Critical'
                        ? '#EF4444'
                        : sev === 'Medium'
                          ? '#F59E0B'
                          : '#10B981';
                    return (
                      <TouchableOpacity
                        key={sev}
                        style={[
                          styles.severityChip,
                          {
                            backgroundColor: active
                              ? `${sevColor}26`
                              : theme.surfaceElevated,
                            borderColor: active ? sevColor : theme.borderStrong,
                          },
                        ]}
                        onPress={() => setSeverity(sev)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.severityChipText,
                            { color: active ? sevColor : theme.text },
                          ]}
                        >
                          {sev}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {category === 'unlit_alley' && (
                <View
                  style={[
                    styles.luxBox,
                    {
                      backgroundColor: theme.surfaceElevated,
                      borderColor:
                        luxReading !== null && luxReading < 15
                          ? '#A855F7'
                          : theme.borderStrong,
                    },
                  ]}
                >
                  <Text style={[styles.luxTitle, { color: theme.text }]}>
                    {sensorAvailable && luxReading !== null
                      ? `Ambient Light: ${luxReading} lux (${luxReading < 15 ? 'Dark Alley Confirmed' : 'Lit'})`
                      : 'Street Illumination Check (Manual Fallback Active)'}
                  </Text>
                </View>
              )}

              {/* Add photo (optional) Card matching Figma SS2 */}
              <View
                style={[
                  styles.detailsCard,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                  },
                ]}
              >
                {imageUri ? (
                  <Image
                    source={{ uri: imageUri }}
                    style={{ width: 64, height: 64, borderRadius: 10 }}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 10,
                      backgroundColor: theme.surfaceElevated,
                      borderWidth: 1,
                      borderColor: theme.borderStrong,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: theme.textSecondary, fontSize: 11, fontWeight: '700' }}>
                      PHOTO
                    </Text>
                  </View>
                )}

                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: '#60A5FA', fontSize: 13, fontWeight: '700' }}>
                    {language === 'bn' ? 'ছবি যুক্ত করুন (ঐচ্ছিক)' : 'Add photo (optional)'}
                  </Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 11.5 }}>
                    {imageUri
                      ? language === 'bn'
                        ? 'ছবি সংযুক্ত হয়েছে'
                        : 'Photo attached'
                      : language === 'bn'
                        ? 'ক্যামেরা বা গ্যালারি থেকে দিন'
                        : 'Attach from camera or gallery'}
                  </Text>
                  <Text style={{ color: '#34D399', fontSize: 11, fontWeight: '600' }}>
                    GPS tagged: {latitude.toFixed(4)}°N, {longitude.toFixed(4)}°E
                  </Text>
                </View>

                <View style={{ gap: 6 }}>
                  <TouchableOpacity
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 8,
                      backgroundColor: theme.surfaceElevated,
                      borderWidth: 1,
                      borderColor: theme.borderStrong,
                      alignItems: 'center',
                    }}
                    onPress={() => handlePickPhoto(true)}
                  >
                    <Text style={{ color: theme.text, fontSize: 11.5, fontWeight: '600' }}>
                      {imageUri ? 'Camera' : 'Camera'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 8,
                      backgroundColor: theme.surfaceElevated,
                      borderWidth: 1,
                      borderColor: theme.borderStrong,
                      alignItems: 'center',
                    }}
                    onPress={() =>
                      imageUri ? setImageUri(null) : handlePickPhoto(false)
                    }
                  >
                    <Text style={{ color: theme.text, fontSize: 11.5, fontWeight: '600' }}>
                      {imageUri ? 'Remove' : 'Gallery'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Photo classification Card (Figma SS2) */}
              <View
                style={[
                  styles.detailsCard,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                    gap: 10,
                  },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: theme.text, fontSize: 13.5, fontWeight: '700' }}>
                    {language === 'bn' ? 'ছবির শ্রেণিবিন্যাস' : 'Photo classification'}
                  </Text>
                  <View
                    style={{
                      backgroundColor: '#F8FAFC',
                      paddingHorizontal: 10,
                      paddingVertical: 3,
                      borderRadius: 999,
                    }}
                  >
                    <Text style={{ color: '#0F172A', fontSize: 11, fontWeight: '700' }}>
                      Reviewable
                    </Text>
                  </View>
                </View>

                <Text style={{ color: theme.textSecondary, fontSize: 11.5 }}>
                  Waterlogging depth:
                </Text>
                <View style={styles.presetWrap}>
                  {(['Ankle-deep', 'Knee-deep', 'Impassable'] as const).map((d) => {
                    const active = waterDepth === d;
                    return (
                      <TouchableOpacity
                        key={d}
                        onPress={() => setWaterDepth(d)}
                        style={[
                          styles.presetChip,
                          {
                            backgroundColor: active
                              ? theme.primarySurface
                              : theme.surfaceElevated,
                            borderColor: active ? theme.primary : theme.borderStrong,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.presetChipText,
                            { color: active ? theme.primaryText : theme.text },
                          ]}
                        >
                          {d}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={{ color: theme.textSecondary, fontSize: 11.5, marginTop: 2 }}>
                  Surface verification:
                </Text>
                <View style={styles.presetWrap}>
                  {[
                    'Open manhole verified',
                    'Road crater / pothole verified',
                    'Submerged hazard suspected',
                    'No visible crater',
                  ].map((s) => {
                    const active = surfaceCheck === s;
                    return (
                      <TouchableOpacity
                        key={s}
                        onPress={() => setSurfaceCheck(s)}
                        style={[
                          styles.presetChip,
                          {
                            backgroundColor: active
                              ? theme.primarySurface
                              : theme.surfaceElevated,
                            borderColor: active ? theme.primary : theme.borderStrong,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.presetChipText,
                            { color: active ? theme.primaryText : theme.text },
                          ]}
                        >
                          {s}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <Text style={{ color: theme.textSecondary, fontSize: 11.5, lineHeight: 16 }}>
                {language === 'bn'
                  ? 'বেনামী রিপোর্ট। শুধুমাত্র সময়, ক্যাটাগরি এবং কমিউনিটি কনফার্মেশন সংখ্যা প্রকাশ্যে দেখাবে।'
                  : 'Anonymous report. Only the timestamp, category, and community confirmation count appear publicly.'}
              </Text>
            </View>
          ) : (
            <View
              style={[
                styles.detailsCard,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <View style={styles.voiceTopRow}>
                <Text style={[styles.locationTitle, { color: theme.text }]}>
                  {language === 'bn'
                    ? 'ভয়েস রিপোর্ট রেকর্ড করুন'
                    : 'Tap to record a voice report'}
                </Text>
                <View
                  style={[
                    styles.timerBadge,
                    {
                      backgroundColor: theme.surfaceElevated,
                      borderColor: theme.borderStrong,
                    },
                  ]}
                >
                  <Text style={[styles.timerText, { color: theme.text }]}>
                    00:{String(recordSeconds).padStart(2, '0')} / 00:15
                  </Text>
                </View>
              </View>

              <View style={styles.voiceLangRow}>
                {(['Bangla', 'Banglish', 'English'] as const).map((l) => {
                  const active = voiceLang === l;
                  return (
                    <TouchableOpacity
                      key={l}
                      style={[
                        styles.presetChip,
                        {
                          backgroundColor: active
                            ? theme.primarySurface
                            : theme.surfaceElevated,
                          borderColor: active
                            ? theme.primary
                            : theme.borderStrong,
                        },
                      ]}
                      onPress={() => setVoiceLang(l)}
                    >
                      <Text
                        style={[
                          styles.presetChipText,
                          { color: active ? theme.primaryText : theme.text },
                        ]}
                      >
                        {l}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[
                  styles.voiceRecBtn,
                  { backgroundColor: isRecording ? '#EF4444' : '#3B82F6' },
                ]}
                onPress={
                  isRecording ? handleStopRecording : handleStartRecording
                }
                disabled={isClassifying}
                activeOpacity={0.85}
              >
                {isClassifying ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.voiceRecBtnText}>
                    {isRecording
                      ? '⏹ Stop & Analyze with AI'
                      : '🎙️ Record voice report (15s max)'}
                  </Text>
                )}
              </TouchableOpacity>

              {aiResult && (
                <View
                  style={[
                    styles.aiBox,
                    {
                      backgroundColor: theme.verifiedBg,
                      borderColor: theme.verifiedBorder,
                    },
                  ]}
                >
                  <Text
                    style={[styles.aiBoxText, { color: theme.verifiedText }]}
                  >
                    ✨ AI Detected: {CATEGORY_META[aiResult.category]?.name} (
                    {aiResult.severity})
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Big Blue "Submit report" Button matching Figma */}
          <TouchableOpacity
            style={[styles.submitBtn, isSubmitting && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.submitBtnText}>
                {language === 'bn' ? 'রিপোর্ট জমা দিন' : 'Submit report'}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>

        {/* Universal Bottom Navigation Bar */}
        <BottomNavBar
          activeTab="report"
          isDark={isDark}
          language={language}
          onPressMap={onClose}
          onPressAlerts={() => {
            onOpenAlerts();
            setTimeout(() => onClose(), 120);
          }}
          onPressReport={() => {}}
        />
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
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 14,
  },
  sectionLabel: {
    fontSize: 13.5,
    fontWeight: '600',
    marginBottom: -6,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 6,
  },
  catCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  catLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 13,
  },
  locationCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  locationTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  distanceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  distanceBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  miniMapWrap: {
    height: 118,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
  },
  miniMap: {
    flex: 1,
  },
  inputBox: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 2,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  textInput: {
    fontSize: 14,
    fontWeight: '500',
    paddingVertical: 2,
  },
  presetWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  presetChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  presetChipText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  modeTabsWrap: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
  },
  modeTab: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  modeTabText: {
    fontSize: 13,
    fontWeight: '700',
  },
  detailsCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  subSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  severityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  severityChip: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  severityChipText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  subtagSection: {
    gap: 6,
  },
  luxBox: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  luxTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  photoRow: {
    flexDirection: 'row',
    gap: 8,
  },
  photoBtn: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  previewWrap: {
    height: 110,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  previewImg: {
    width: '100%',
    height: '100%',
  },
  removeImgBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeImgText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  voiceTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  timerBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  timerText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  voiceLangRow: {
    flexDirection: 'row',
    gap: 8,
  },
  voiceRecBtn: {
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceRecBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
  aiBox: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  aiBoxText: {
    fontSize: 12,
    fontWeight: '700',
  },
  submitBtn: {
    height: 50,
    borderRadius: 14,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 10,
    elevation: 6,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
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
