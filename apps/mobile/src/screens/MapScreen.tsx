import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as Speech from 'expo-speech';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type {
  HazardCategory,
  HazardRecord,
  SafeRouteOption,
} from '../../../../packages/shared/api-contract';
import AlertsModal from '../components/Alerts/AlertsModal';
import AuthModal, { type AuthUser } from '../components/Auth/AuthModal';
import {
  DEFAULT_HAZARD_FILTERS,
  FilterModal,
  type HazardFilterState,
} from '../components/Filter/FilterModal';
import ProfileModal from '../components/Profile/ProfileModal';
import QuickReportModal, {
  type QuickReportHazardPayload,
} from '../components/Report/QuickReportModal';
import { TRANSLATIONS, type Language } from '../i18n/translations';
import {
  confirmHazard,
  createHazard,
  fetchHazards,
  fetchSafeRoutes,
  resolveHazard,
} from '../services/api';
import {
  CATEGORY_META,
  DARK_THEME,
  DHAKA_CENTER,
  DHAKA_SEED_HAZARDS,
  DHAKA_STREETS,
  LIGHT_THEME,
  MODULE_ORDER,
  UI_COPY,
} from './mapConstants';
import {
  computeDistanceMeters,
  findNearbyCorridorHazards,
  resolveDhakaTappedLocation,
  type TappedLocationState,
} from './mapGeoUtils';
import { styles } from './MapScreen.styles';
import { LEAFLET_HTML } from './mapTemplate';

try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
} catch {
  // Notification handler optional on unsupported runtimes
}

const PROXIMITY_RADIUS_METERS = 100;

function isDeviceNightHours(): boolean {
  const hour = new Date().getHours();
  return hour >= 18 || hour < 6;
}

type ViewMode = 'all' | 'pedestrian_night' | 'driver_biker';
type CategoryFilter = 'all' | HazardCategory;
type BottomTab = 'map' | 'alerts' | 'report';

interface ProximityAlertState {
  hazard: HazardRecord;
  distanceMeters: number;
  isNightPriority: boolean;
}

type MapUiIconName =
  | 'user'
  | 'shield-user'
  | 'search'
  | 'options'
  | 'warning'
  | 'location'
  | 'add'
  | 'remove'
  | 'layers'
  | 'locate'
  | 'git-branch'
  | 'map'
  | 'notifications';

function MapUiIcon({
  name,
  size = 18,
  color = '#F8FAFC',
}: {
  name: MapUiIconName;
  size?: number;
  color?: string;
}) {
  switch (name) {
    case 'user':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={8} r={3.6} stroke={color} strokeWidth={2} />
          <Path
            d="M5 20a7 7 0 0 1 14 0"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
          />
        </Svg>
      );
    case 'shield-user':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 2.5 4.5 5.5v5.8c0 5 3.2 9.5 7.5 10.5 4.3-1 7.5-5.5 7.5-10.5V5.5L12 2.5Z"
            stroke={color}
            strokeWidth={1.9}
            strokeLinejoin="round"
          />
          <Path
            d="m9 12 2 2 4-4"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'search':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx={11} cy={11} r={7} stroke={color} strokeWidth={2} />
          <Path
            d="m16.5 16.5 4.5 4.5"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
          />
        </Svg>
      );
    case 'options':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M4 6h16M4 12h16M4 18h16"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
          />
          <Circle cx={9} cy={6} r={2} fill={color} />
          <Circle cx={15} cy={12} r={2} fill={color} />
          <Circle cx={9} cy={18} r={2} fill={color} />
        </Svg>
      );
    case 'warning':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"
            stroke={color}
            strokeWidth={1.9}
            strokeLinejoin="round"
          />
          <Path
            d="M12 9v4.2M12 16.8h.01"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
          />
        </Svg>
      );
    case 'location':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 2.5c-3.9 0-7 3.1-7 7 0 5.2 7 12 7 12s7-6.8 7-12c0-3.9-3.1-7-7-7Z"
            stroke={color}
            strokeWidth={1.9}
          />
          <Circle cx={12} cy={9.5} r={2.4} stroke={color} strokeWidth={1.9} />
        </Svg>
      );
    case 'add':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 5v14M5 12h14"
            stroke={color}
            strokeWidth={2.4}
            strokeLinecap="round"
          />
        </Svg>
      );
    case 'remove':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M5 12h14"
            stroke={color}
            strokeWidth={2.4}
            strokeLinecap="round"
          />
        </Svg>
      );
    case 'layers':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 3 2.5 7.8 12 12.6l9.5-4.8L12 3Z"
            stroke={color}
            strokeWidth={1.8}
            strokeLinejoin="round"
          />
          <Path
            d="m2.5 12.6 9.5 4.8 9.5-4.8M2.5 17.2 12 22l9.5-4.8"
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'locate':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={12} r={5} stroke={color} strokeWidth={2} />
          <Path
            d="M12 2v3M12 19v3M2 12h3M19 12h3"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
          />
        </Svg>
      );
    case 'git-branch':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx={6} cy={6} r={2.2} stroke={color} strokeWidth={1.9} />
          <Circle cx={6} cy={18} r={2.2} stroke={color} strokeWidth={1.9} />
          <Circle cx={18} cy={8.5} r={2.2} stroke={color} strokeWidth={1.9} />
          <Path
            d="M6 8.2v7.6M6 8.5c0 3 3 4.5 6 4.5h3.8"
            stroke={color}
            strokeWidth={1.9}
            strokeLinecap="round"
          />
        </Svg>
      );
    case 'map':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M9 4 3 6.8v13.2L9 17.2l6 2.8 6-2.8V4l-6 2.8L9 4Z"
            stroke={color}
            strokeWidth={1.8}
            strokeLinejoin="round"
          />
          <Path
            d="M9 4v13.2M15 6.8V20"
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
          />
        </Svg>
      );
    case 'notifications':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M13.7 21a2 2 0 0 1-3.4 0"
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
          />
        </Svg>
      );
  }
}

function HazardCategoryIcon({
  category,
  color,
  size = 16,
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

export default function MapScreen() {
  const [hazards, setHazards] = useState<HazardRecord[]>(DHAKA_SEED_HAZARDS);
  const [locale, setLocale] = useState<Language>('en');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchDropdownOpen, setSearchDropdownOpen] = useState<boolean>(false);
  const [filterModalOpen, setFilterModalOpen] = useState<boolean>(false);
  const [hazardFilters, setHazardFilters] = useState<HazardFilterState>(
    DEFAULT_HAZARD_FILTERS,
  );
  const [showDangerRings, setShowDangerRings] = useState<boolean>(false);
  const [layerToast, setLayerToast] = useState<string | null>(null);
  const [layersModalOpen, setLayersModalOpen] = useState<boolean>(false);
  const [alertsSheetOpen, setAlertsSheetOpen] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [highContrastMap, setHighContrastMap] = useState<boolean>(false);
  const [isNighttime, setIsNighttime] = useState<boolean>(() =>
    isDeviceNightHours(),
  );
  const [demoMode, setDemoMode] = useState<boolean>(false);
  const [selectedHazardId, setSelectedHazardId] = useState<string | null>(null);
  const [reportModalVisible, setReportModalVisible] = useState<boolean>(false);
  const [tappedLocation, setTappedLocation] =
    useState<TappedLocationState | null>(null);

  // Auth & Citizen Reputation State
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [profileModalOpen, setProfileModalOpen] = useState<boolean>(false);
  const [userReportsCount, setUserReportsCount] = useState<number>(0);

  // Multi-Route Risk Scoring & Live Toggle State
  const [routeOptions, setRouteOptions] = useState<SafeRouteOption[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>('safest');
  const [routeTargetLabel, setRouteTargetLabel] = useState<string>('');
  const [corridorHazardCount, setCorridorHazardCount] = useState<number>(0);
  const [routeLoading, setRouteLoading] = useState<boolean>(false);

  // Proximity Geofencing & Live Location State
  const [userLocation, setUserLocation] = useState(DHAKA_CENTER);
  const [gpsAccuracyMeters, setGpsAccuracyMeters] = useState<number | null>(
    null,
  );
  const [gpsBannerDismissed, setGpsBannerDismissed] = useState<boolean>(false);
  const [proximityAlert, setProximityAlert] =
    useState<ProximityAlertState | null>(null);
  const [failedThumbIds, setFailedThumbIds] = useState<Record<string, boolean>>(
    {},
  );

  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState(DHAKA_CENTER);
  const [webViewReady, setWebViewReady] = useState<boolean>(false);
  const webViewRef = useRef<WebView>(null);
  const layerToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastNotifiedHazardRef = useRef<string | null>(null);

  const theme = isNighttime ? DARK_THEME : LIGHT_THEME;
  const copy = UI_COPY[locale];
  const t = TRANSLATIONS[locale];

  const isUserTrusted = Boolean(
    currentUser && (currentUser.is_trusted || currentUser.trust_score >= 50),
  );
  const userTrustWeight = isUserTrusted ? 2 : 1;

  const loadHazards = useCallback(async () => {
    try {
      const data = await fetchHazards();
      if (Array.isArray(data) && data.length >= 8) {
        setHazards(data);
      } else if (Array.isArray(data) && data.length > 0) {
        const existingIds = new Set(data.map((d) => d.id));
        const merged = [
          ...data,
          ...DHAKA_SEED_HAZARDS.filter((s) => !existingIds.has(s.id)),
        ];
        setHazards(merged);
      } else {
        setHazards(DHAKA_SEED_HAZARDS);
      }
    } catch {
      setHazards((prev) => (prev.length > 0 ? prev : DHAKA_SEED_HAZARDS));
    }
  }, []);

  useEffect(() => {
    loadHazards();
  }, [loadHazards]);

  // Configure Android local notification channel
  useEffect(() => {
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('hazard-proximity', {
        name: 'Proximity Hazard Alerts',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 150, 250],
        lightColor: '#EF4444',
      }).catch(() => {});
    }
  }, []);

  const sendProximityLocalNotification = useCallback(
    async (hazard: HazardRecord, distanceMeters: number) => {
      try {
        const perm = await Notifications.getPermissionsAsync();
        let granted = perm.granted;
        if (!granted) {
          const req = await Notifications.requestPermissionsAsync();
          granted = req.granted;
        }
        if (!granted) return;

        const meta = CATEGORY_META[hazard.category];
        const place = hazard.landmark_context || meta?.name || 'Dhaka street';
        await Notifications.scheduleNotificationAsync({
          content: {
            title:
              locale === 'bn'
                ? `⚠️ সামনেই উচ্চ ঝুঁকি (${distanceMeters} মিটার)!`
                : `⚠️ High-Risk Hazard ${distanceMeters}m ahead!`,
            body: `${meta?.name || hazard.category} · ${place}`,
            sound: true,
          },
          trigger: null,
        });
      } catch {
        // Ignore notification runtime restrictions; in-app banner still displays
      }
    },
    [locale],
  );

  const speakProximityWarning = useCallback(
    (hazard: HazardRecord, distanceMeters: number, isNightPriority: boolean) => {
      try {
        Speech.stop();
        if (locale === 'bn') {
          const bnDist = distanceMeters <= 100 ? '১০০' : String(distanceMeters);
          const bnPrefix = isNightPriority
            ? 'রাতের জরুরি সতর্কতা! '
            : '';
          Speech.speak(
            `${bnPrefix}সাবধান! সামনে ${bnDist} মিটার দূরে ঝুঁকি আছে`,
            {
              language: 'bn-BD',
              rate: 0.95,
              pitch: 1.0,
            },
          );
        } else {
          const meta = CATEGORY_META[hazard.category];
          const nightTag = isNightPriority ? 'Night priority alert. ' : '';
          Speech.speak(
            `${nightTag}Caution! ${meta?.name || 'High-risk hazard'} ${distanceMeters} meters ahead.`,
            {
              language: 'en-US',
              rate: 0.98,
              pitch: 1.0,
            },
          );
        }
      } catch {
        // Ignore TTS engine errors on unsupported devices
      }
    },
    [locale],
  );

  const evaluateProximityGeofence = useCallback(
    (
      lat: number,
      lng: number,
      hazardList: HazardRecord[],
      forceNotify = false,
    ): ProximityAlertState | null => {
      const nightWindowActive = isNighttime || isDeviceNightHours();

      const candidateHazards = hazardList.filter((h) => {
        if (h.status === 'resolved' || h.status === 'expired') return false;
        const isHighSeverity =
          h.severity === 'Critical' || (h.severity as string) === 'High';
        const isNightCategory =
          nightWindowActive &&
          (h.category === 'unlit_alley' || h.category === 'unsafe_footbridge');
        return isHighSeverity || isNightCategory;
      });

      let chosen: HazardRecord | null = null;
      let chosenDist = Number.POSITIVE_INFINITY;
      let chosenIsNightPriority = false;
      let bestScore = Number.POSITIVE_INFINITY;

      for (const h of candidateHazards) {
        const d = computeDistanceMeters(lat, lng, h.latitude, h.longitude);
        if (d > PROXIMITY_RADIUS_METERS) continue;

        const isNightPriority =
          nightWindowActive &&
          (h.category === 'unlit_alley' || h.category === 'unsafe_footbridge');
        // Elevate night-priority hazards (unlit alleys & nighttime footbridges)
        // when multiple hazards fall inside the 100m geofence
        const priorityScore = isNightPriority ? d - 40 : d;

        if (priorityScore < bestScore) {
          bestScore = priorityScore;
          chosen = h;
          chosenDist = d;
          chosenIsNightPriority = isNightPriority;
        }
      }

      if (chosen && chosenDist <= PROXIMITY_RADIUS_METERS) {
        const distRounded = Math.max(10, Math.min(PROXIMITY_RADIUS_METERS, chosenDist));
        const alertObj: ProximityAlertState = {
          hazard: chosen,
          distanceMeters: distRounded,
          isNightPriority: chosenIsNightPriority,
        };
        setProximityAlert(alertObj);

        if (forceNotify || lastNotifiedHazardRef.current !== chosen.id) {
          lastNotifiedHazardRef.current = chosen.id;
          sendProximityLocalNotification(chosen, distRounded);
          speakProximityWarning(chosen, distRounded, chosenIsNightPriority);
        }
        return alertObj;
      }

      return null;
    },
    [isNighttime, sendProximityLocalNotification, speakProximityWarning],
  );

  // Watch live GPS foreground updates for automatic 100m proximity geofencing & accuracy checks
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    let mounted = true;

    (async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (!perm.granted || !mounted) return;

        sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 15,
            timeInterval: 8000,
          },
          (loc) => {
            if (!mounted) return;
            const nextCoords = {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            };
            setUserLocation(nextCoords);
            if (typeof loc.coords.accuracy === 'number') {
              setGpsAccuracyMeters(loc.coords.accuracy);
              if (loc.coords.accuracy <= 50) {
                setGpsBannerDismissed(false);
              }
            }
            webViewRef.current?.injectJavaScript(
              `window.updateUserLocation && window.updateUserLocation(${nextCoords.latitude}, ${nextCoords.longitude}); true;`,
            );
          },
        );
      } catch {
        // Fallback to DHAKA_CENTER if location services unavailable
      }
    })();

    return () => {
      mounted = false;
      sub?.remove();
    };
  }, []);

  // Re-evaluate proximity whenever userLocation or active hazards change
  useEffect(() => {
    evaluateProximityGeofence(
      userLocation.latitude,
      userLocation.longitude,
      hazards,
      false,
    );
  }, [userLocation, hazards, evaluateProximityGeofence]);

  const handleTriggerProximityCheck = useCallback(() => {
    const directHit = evaluateProximityGeofence(
      userLocation.latitude,
      userLocation.longitude,
      hazards,
      true,
    );
    if (directHit) {
      webViewRef.current?.injectJavaScript(
        `window.focusHazard && window.focusHazard(${directHit.hazard.latitude}, ${directHit.hazard.longitude}); true;`,
      );
      return;
    }

    // For live classroom/demo presentation when GPS is >100m from qualifying pins:
    // simulate user position ~85m ahead of the nearest active High/Critical or night-priority hazard
    const nightWindowActive = isNighttime || isDeviceNightHours();
    const eligibleHazards = hazards.filter((h) => {
      if (h.status === 'resolved' || h.status === 'expired') return false;
      const isHigh =
        h.severity === 'Critical' || (h.severity as string) === 'High';
      const isNightCat =
        nightWindowActive &&
        (h.category === 'unlit_alley' || h.category === 'unsafe_footbridge');
      return isHigh || isNightCat;
    });
    if (eligibleHazards.length === 0) return;

    const target = [...eligibleHazards].sort((a, b) => {
      const aNight =
        nightWindowActive &&
        (a.category === 'unlit_alley' || a.category === 'unsafe_footbridge')
          ? -350
          : 0;
      const bNight =
        nightWindowActive &&
        (b.category === 'unlit_alley' || b.category === 'unsafe_footbridge')
          ? -350
          : 0;
      const distA =
        computeDistanceMeters(
          mapCenter.latitude,
          mapCenter.longitude,
          a.latitude,
          a.longitude,
        ) + aNight;
      const distB =
        computeDistanceMeters(
          mapCenter.latitude,
          mapCenter.longitude,
          b.latitude,
          b.longitude,
        ) + bNight;
      return distA - distB;
    })[0];

    // ~0.00076 degrees latitude is ~85 meters Haversine (inside 100m geofence)
    const simLat = Number((target.latitude - 0.00076).toFixed(6));
    const simLng = target.longitude;
    setUserLocation({ latitude: simLat, longitude: simLng });
    webViewRef.current?.injectJavaScript(
      `window.updateUserLocation && window.updateUserLocation(${simLat}, ${simLng}); window.focusHazard && window.focusHazard(${target.latitude}, ${target.longitude}); true;`,
    );
    evaluateProximityGeofence(simLat, simLng, hazards, true);
  }, [userLocation, mapCenter, hazards, isNighttime, evaluateProximityGeofence]);

  const clearSafeRoute = useCallback(() => {
    setRouteOptions([]);
    setRouteTargetLabel('');
    setCorridorHazardCount(0);
    webViewRef.current?.injectJavaScript(
      'window.clearSafeRoute && window.clearSafeRoute(); true;',
    );
  }, []);

  const clearTappedPinOnMap = useCallback(() => {
    setTappedLocation(null);
    clearSafeRoute();
    webViewRef.current?.injectJavaScript(
      'window.clearTappedPin && window.clearTappedPin(); true;',
    );
  }, [clearSafeRoute]);

  const syncRoutesToWebView = useCallback(
    (
      options: SafeRouteOption[],
      activeId: string,
      shouldFitBounds: boolean,
    ) => {
      if (!webViewRef.current) return;
      if (options.length === 0) {
        webViewRef.current.injectJavaScript(
          'window.clearSafeRoute && window.clearSafeRoute(); true;',
        );
        return;
      }
      const payload = JSON.stringify(options);
      const idJson = JSON.stringify(activeId);
      webViewRef.current.injectJavaScript(
        `window.renderRouteOptions && window.renderRouteOptions(${payload}, ${idJson}, ${shouldFitBounds}); true;`,
      );
    },
    [],
  );

  const handleSelectRouteOption = useCallback(
    (optionId: string) => {
      setSelectedRouteId(optionId);
      syncRoutesToWebView(routeOptions, optionId, false);
    },
    [routeOptions, syncRoutesToWebView],
  );

  const handleFindSafeRoute = useCallback(
    async (destLat: number, destLng: number, targetLabel: string) => {
      setRouteLoading(true);
      const startLat = userLocation.latitude;
      const startLng = userLocation.longitude;

      const corridor = findNearbyCorridorHazards(
        startLat,
        startLng,
        destLat,
        destLng,
        hazards,
      );

      try {
        const fetchedOptions = await fetchSafeRoutes(
          startLat,
          startLng,
          destLat,
          destLng,
          hazards,
        );

        const defaultId =
          fetchedOptions.find((o) => o.id === 'safest')?.id ||
          fetchedOptions[0]?.id ||
          'safest';

        setCorridorHazardCount(corridor.length);
        setRouteTargetLabel(targetLabel);
        setRouteOptions(fetchedOptions);
        setSelectedRouteId(defaultId);
        setSelectedHazardId(null);

        syncRoutesToWebView(fetchedOptions, defaultId, true);
      } finally {
        setRouteLoading(false);
      }
    },
    [userLocation, hazards, syncRoutesToWebView],
  );

  const handleAuthSuccess = useCallback((user: AuthUser) => {
    if (user.id.startsWith('guest_')) {
      setCurrentUser(null);
      return;
    }
    const lowerEmail = user.email.toLowerCase();
    const autoGuardian =
      lowerEmail.includes('guardian') ||
      lowerEmail.includes('trusted') ||
      lowerEmail.includes('admin');
    const initialScore = autoGuardian
      ? Math.max(user.trust_score, 68)
      : user.trust_score;
    setCurrentUser({
      ...user,
      trust_score: initialScore,
      is_trusted: autoGuardian || user.is_trusted || initialScore >= 50,
    });
  }, []);

  const handleSubmitHazard = useCallback(
    async (payload: QuickReportHazardPayload) => {
      const reporterId = currentUser?.id ?? undefined;
      const attachedImage = payload.imageUri ?? undefined;

      let createdRecord: HazardRecord;
      try {
        createdRecord = await createHazard({
          category: payload.category,
          severity: payload.severity,
          latitude: payload.latitude,
          longitude: payload.longitude,
          landmark_context: payload.landmark_context,
          sub_tag: payload.sub_tag,
          image_url: attachedImage,
          reported_by: reporterId,
        });
        createdRecord = {
          ...createdRecord,
          image_url: createdRecord.image_url ?? attachedImage ?? null,
          reported_by: createdRecord.reported_by ?? reporterId ?? null,
        };
      } catch {
        createdRecord = {
          id: `local-${Date.now()}`,
          category: payload.category,
          severity: payload.severity ?? 'Medium',
          latitude: payload.latitude,
          longitude: payload.longitude,
          landmark_context: payload.landmark_context,
          sub_tag: payload.sub_tag,
          image_url: attachedImage ?? null,
          reported_by: reporterId ?? null,
          confirmations: userTrustWeight,
          status: 'active',
          created_at: new Date().toISOString(),
        };
      }

      if (currentUser) {
        setUserReportsCount((c) => c + 1);
        setCurrentUser((prev) => {
          if (!prev) return prev;
          const nextScore = Math.min(100, prev.trust_score + 10);
          return {
            ...prev,
            trust_score: nextScore,
            is_trusted: prev.is_trusted || nextScore >= 50,
          };
        });
      }

      setHazards((prev) => [createdRecord, ...prev]);
      clearTappedPinOnMap();
      setSelectedHazardId(createdRecord.id);
      setReportModalVisible(false);
      const queuedOffline = createdRecord.id.startsWith('offline-');
      Alert.alert(
        queuedOffline
          ? locale === 'bn'
            ? 'অফলাইনে সংরক্ষিত হয়েছে'
            : 'Saved Offline'
          : locale === 'bn'
            ? 'রিপোর্ট জমা হয়েছে'
            : 'Hazard Reported',
        queuedOffline
          ? locale === 'bn'
            ? 'ইন্টারনেট ফিরে এলে আপনার রিপোর্ট স্বয়ংক্রিয়ভাবে সিঙ্ক হবে।'
            : 'No connection detected. Your report is queued locally and will auto-sync when online.'
          : locale === 'bn'
            ? 'ধন্যবাদ! আপনার ঝুঁকির রিপোর্ট ম্যাপে যুক্ত হয়েছে।'
            : 'Thank you! Your hazard report is now visible on the Dhaka safety map.',
      );
    },
    [currentUser, userTrustWeight, clearTappedPinOnMap, locale],
  );

  const handleConfirmHazard = useCallback(
    async (hazard: HazardRecord) => {
      setConfirmingId(hazard.id);
      const currentCount =
        hazard.confirmations ?? (hazard.status === 'crowd_verified' ? 3 : 1);
      try {
        const updated = await confirmHazard(hazard.id, userTrustWeight);
        const nextCount =
          updated.confirmations ?? currentCount + userTrustWeight;
        const nextStatus =
          nextCount >= 3 ? 'crowd_verified' : (updated.status ?? hazard.status);
        setHazards((prev) =>
          prev.map((h) =>
            h.id === hazard.id
              ? {
                  ...h,
                  ...updated,
                  image_url: updated.image_url ?? h.image_url,
                  confirmations: nextCount,
                  status: nextStatus,
                }
              : h,
          ),
        );
      } catch {
        const nextCount = currentCount + userTrustWeight;
        const nextStatus = nextCount >= 3 ? 'crowd_verified' : hazard.status;
        setHazards((prev) =>
          prev.map((h) =>
            h.id === hazard.id
              ? { ...h, confirmations: nextCount, status: nextStatus }
              : h,
          ),
        );
      } finally {
        if (currentUser) {
          setCurrentUser((prev) => {
            if (!prev) return prev;
            const nextScore = Math.min(100, prev.trust_score + 4);
            return {
              ...prev,
              trust_score: nextScore,
              is_trusted: prev.is_trusted || nextScore >= 50,
            };
          });
        }
        setConfirmingId(null);
      }
    },
    [userTrustWeight, currentUser],
  );

  const handleResolveHazard = useCallback(
    async (hazard: HazardRecord) => {
      setResolvingId(hazard.id);
      const currentResolved = hazard.resolved_count ?? 0;
      try {
        const updated = await resolveHazard(hazard.id, userTrustWeight);
        const nextResolved =
          updated.resolved_count ?? currentResolved + userTrustWeight;
        const nextStatus =
          updated.status === 'resolved' || nextResolved >= 3
            ? 'resolved'
            : hazard.status;
        setHazards((prev) =>
          prev.map((h) =>
            h.id === hazard.id
              ? {
                  ...h,
                  ...updated,
                  image_url: updated.image_url ?? h.image_url,
                  resolved_count: nextResolved,
                  status: nextStatus,
                }
              : h,
          ),
        );
        if (nextStatus === 'resolved') {
          setSelectedHazardId(null);
        }
      } catch {
        const nextResolved = currentResolved + userTrustWeight;
        const nextStatus = nextResolved >= 3 ? 'resolved' : hazard.status;
        setHazards((prev) =>
          prev.map((h) =>
            h.id === hazard.id
              ? { ...h, resolved_count: nextResolved, status: nextStatus }
              : h,
          ),
        );
        if (nextStatus === 'resolved') {
          setSelectedHazardId(null);
        }
      } finally {
        setResolvingId(null);
      }
    },
    [userTrustWeight],
  );

  const handleToggleDangerRings = useCallback(() => {
    setShowDangerRings((prev) => {
      const next = !prev;
      const toastMsg =
        locale === 'bn'
          ? next
            ? 'বিপদসীমা রিং (২৫০ মি): চালু'
            : 'বিপদসীমা রিং: বন্ধ'
          : next
            ? 'Danger Radius Rings (250m): ON'
            : 'Danger Radius Rings: OFF';
      setLayerToast(toastMsg);
      if (layerToastTimerRef.current) {
        clearTimeout(layerToastTimerRef.current);
      }
      layerToastTimerRef.current = setTimeout(() => {
        setLayerToast(null);
      }, 2400);
      return next;
    });
  }, [locale]);

  const hasActiveModalFilters =
    hazardFilters.severity !== 'all' ||
    hazardFilters.verifiedOnly ||
    hazardFilters.maxDistanceKm !== null;

  const filteredHazards = useMemo(() => {
    let list = hazards.filter(
      (h) => h.status !== 'resolved' && h.status !== 'expired',
    );

    if (viewMode === 'pedestrian_night') {
      list = list.filter(
        (h) =>
          h.category === 'unlit_alley' ||
          h.category === 'unsafe_footbridge' ||
          h.category === 'extortion_spot',
      );
    } else if (viewMode === 'driver_biker') {
      list = list.filter(
        (h) =>
          h.category === 'pothole_manhole' ||
          h.category === 'waterlogging' ||
          h.category === 'extortion_spot',
      );
    }

    if (categoryFilter !== 'all') {
      list = list.filter((h) => h.category === categoryFilter);
    }

    if (hazardFilters.severity === 'high') {
      list = list.filter((h) => h.severity === 'Critical');
    } else if (hazardFilters.severity === 'medium') {
      list = list.filter((h) => h.severity === 'Medium');
    } else if (hazardFilters.severity === 'low') {
      list = list.filter((h) => h.severity === 'Low');
    }

    if (hazardFilters.verifiedOnly) {
      list = list.filter(
        (h) =>
          h.status === 'crowd_verified' ||
          h.status === 'verified' ||
          (h.confirmations ?? 0) >= 3,
      );
    }

    if (hazardFilters.maxDistanceKm !== null) {
      const maxMeters = hazardFilters.maxDistanceKm * 1000;
      list = list.filter(
        (h) =>
          computeDistanceMeters(
            userLocation.latitude,
            userLocation.longitude,
            h.latitude,
            h.longitude,
          ) <= maxMeters,
      );
    }

    const q = searchQuery.trim().toLowerCase();
    if (q.length > 0) {
      list = list.filter((h) => {
        const meta = CATEGORY_META[h.category];
        return (
          (h.landmark_context || '').toLowerCase().includes(q) ||
          (h.sub_tag || '').toLowerCase().includes(q) ||
          meta.name.toLowerCase().includes(q) ||
          meta.nameBn.toLowerCase().includes(q) ||
          h.severity.toLowerCase().includes(q)
        );
      });
    }

    return list;
  }, [
    hazards,
    viewMode,
    categoryFilter,
    hazardFilters,
    searchQuery,
    userLocation,
  ]);

  const searchSuggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length === 0) return [];

    const hazardMatches = hazards
      .filter((h) => h.status !== 'resolved' && h.status !== 'expired')
      .filter((h) => {
        const meta = CATEGORY_META[h.category];
        return (
          (h.landmark_context || '').toLowerCase().includes(q) ||
          (h.sub_tag || '').toLowerCase().includes(q) ||
          meta.name.toLowerCase().includes(q) ||
          meta.nameBn.toLowerCase().includes(q)
        );
      })
      .slice(0, 4)
      .map((h) => ({
        key: `hazard-${h.id}`,
        kind: 'hazard' as const,
        title: h.landmark_context || CATEGORY_META[h.category].name,
        subtitle: `${CATEGORY_META[h.category].name}${h.sub_tag ? ` · ${h.sub_tag}` : ''}`,
        latitude: h.latitude,
        longitude: h.longitude,
        hazard: h,
      }));

    const landmarkMatches = DHAKA_STREETS.filter((s) =>
      s.label.toLowerCase().includes(q),
    )
      .slice(0, 4)
      .map((s) => ({
        key: `landmark-${s.label}`,
        kind: 'landmark' as const,
        title: s.label,
        subtitle: 'Dhaka Landmark',
        latitude: s.latitude,
        longitude: s.longitude,
        hazard: null,
      }));

    return [...hazardMatches, ...landmarkMatches].slice(0, 6);
  }, [hazards, searchQuery]);

  const selectedHazard = useMemo(
    () => filteredHazards.find((h) => h.id === selectedHazardId) ?? null,
    [filteredHazards, selectedHazardId],
  );

  useEffect(() => {
    if (!webViewReady || !webViewRef.current) return;
    const payload = JSON.stringify(filteredHazards);
    webViewRef.current.injectJavaScript(
      `window.renderHazards && window.renderHazards(${payload}); true;`,
    );
  }, [filteredHazards, webViewReady]);

  useEffect(() => {
    if (!webViewReady || !webViewRef.current) return;
    const payload = JSON.stringify(filteredHazards);
    webViewRef.current.injectJavaScript(
      `window.renderDangerRings && window.renderDangerRings(${showDangerRings}, ${payload}); true;`,
    );
  }, [showDangerRings, filteredHazards, webViewReady]);

  useEffect(() => {
    if (!webViewReady || !webViewRef.current) return;
    webViewRef.current.injectJavaScript(
      `window.setMapTheme && window.setMapTheme(${isNighttime}, ${highContrastMap}); true;`,
    );
  }, [isNighttime, highContrastMap, webViewReady]);

  const handleWebViewMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data);
        if (
          msg?.type === 'region' &&
          typeof msg.latitude === 'number' &&
          typeof msg.longitude === 'number'
        ) {
          setMapCenter({ latitude: msg.latitude, longitude: msg.longitude });
        } else if (msg?.type === 'select' && typeof msg.id === 'string') {
          setTappedLocation(null);
          setRouteOptions([]);
          webViewRef.current?.injectJavaScript(
            'window.clearSafeRoute && window.clearSafeRoute(); true;',
          );
          setSelectedHazardId(msg.id);
        } else if (
          msg?.type === 'mapTap' &&
          typeof msg.latitude === 'number' &&
          typeof msg.longitude === 'number'
        ) {
          setSelectedHazardId(null);
          setRouteOptions([]);
          webViewRef.current?.injectJavaScript(
            'window.clearSafeRoute && window.clearSafeRoute(); true;',
          );
          setTappedLocation(
            resolveDhakaTappedLocation(
              msg.latitude,
              msg.longitude,
              userLocation,
            ),
          );
        }
      } catch {
        // Ignore malformed messages
      }
    },
    [userLocation],
  );

  const handleZoomIn = () => {
    webViewRef.current?.injectJavaScript('map.zoomIn(); true;');
  };

  const handleZoomOut = () => {
    webViewRef.current?.injectJavaScript('map.zoomOut(); true;');
  };

  const handleLocate = () => {
    setMapCenter(DHAKA_CENTER);
    setUserLocation(DHAKA_CENTER);
    webViewRef.current?.injectJavaScript(
      'window.recenterDhaka && window.recenterDhaka(); true;',
    );
  };

  const hasActiveFilter =
    viewMode !== 'all' ||
    categoryFilter !== 'all' ||
    searchQuery.trim().length > 0;

  const activeTab: BottomTab = reportModalVisible
    ? 'report'
    : alertsSheetOpen
      ? 'alerts'
      : 'map';

  const topInset = Platform.OS === 'android' ? 10 : 48;
  const hasActiveRoutes = routeOptions.length > 0;

  const safestOption = useMemo(
    () =>
      routeOptions.find(
        (r) => r.id === 'safest' || r.label === 'Safest Route',
      ) ?? routeOptions[0],
    [routeOptions],
  );
  const fastestOption = useMemo(
    () =>
      routeOptions.find(
        (r) => r.id === 'fastest' || r.label === 'Fastest Route',
      ) ?? routeOptions[1],
    [routeOptions],
  );
  const hazardsAvoidedCount = useMemo(() => {
    if (!safestOption) return 0;
    const diffFromFastest =
      (fastestOption?.hazardsNearRoute ?? 0) - safestOption.hazardsNearRoute;
    const diffFromCorridor = corridorHazardCount - safestOption.hazardsNearRoute;
    return Math.max(0, diffFromFastest, diffFromCorridor);
  }, [safestOption, fastestOption, corridorHazardCount]);

  return (
    <View style={[styles.container, { backgroundColor: theme.mapBg }]}>
      <StatusBar
        barStyle={theme.statusBarStyle}
        backgroundColor={theme.headerBg}
        translucent={false}
      />

      <WebView
        ref={webViewRef}
        style={[styles.map, { backgroundColor: theme.mapBg }]}
        source={{ html: LEAFLET_HTML }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        onLoadEnd={() => setWebViewReady(true)}
        onMessage={handleWebViewMessage}
      />

      {/* Top Header, Search Bar & Category Pills */}
      <View
        style={[
          styles.headerPanel,
          {
            backgroundColor: theme.headerBg,
            borderBottomColor: theme.border,
            paddingTop: topInset,
          },
        ]}
      >
        <View style={styles.appHeader}>
          <Text style={[styles.appTitle, { color: theme.text }]}>
            {copy.title}
          </Text>
          <View style={styles.headerRight}>
            {demoMode && (
              <View style={styles.demoBadge}>
                <Text style={styles.demoBadgeText}>DEMO</Text>
              </View>
            )}

            {/* Auth & Profile Header Button next to বাংলা pill */}
            <TouchableOpacity
              style={[
                styles.profileHeaderBtn,
                {
                  backgroundColor: currentUser
                    ? isUserTrusted
                      ? 'rgba(16, 185, 129, 0.18)'
                      : theme.primarySurface
                    : theme.pillBg,
                  borderColor: currentUser
                    ? isUserTrusted
                      ? '#10B981'
                      : theme.primary
                    : theme.borderStrong,
                },
              ]}
              onPress={() => {
                if (currentUser) {
                  setProfileModalOpen(true);
                } else {
                  setAuthModalOpen(true);
                }
              }}
              activeOpacity={0.8}
              accessibilityLabel="Open citizen profile or sign in"
            >
              <MapUiIcon
                name={isUserTrusted ? 'shield-user' : 'user'}
                size={13}
                color={
                  currentUser
                    ? isUserTrusted
                      ? '#34D399'
                      : theme.primary
                    : theme.localeText
                }
              />
              {currentUser ? (
                <>
                  <Text
                    style={[
                      styles.profileHeaderBtnText,
                      {
                        color: isUserTrusted ? '#34D399' : theme.primaryText,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {currentUser.display_name.split(' ')[0]}
                  </Text>
                  <View
                    style={[
                      styles.profileStatusDot,
                      {
                        backgroundColor: isUserTrusted ? '#10B981' : '#3B82F6',
                      },
                    ]}
                  />
                </>
              ) : (
                <Text
                  style={[
                    styles.profileHeaderBtnText,
                    { color: theme.localeText },
                  ]}
                >
                  {locale === 'bn' ? 'লগইন' : 'Sign In'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.localePill,
                {
                  backgroundColor: theme.pillBg,
                  borderColor: theme.borderStrong,
                },
              ]}
              onPress={() => setLocale((l) => (l === 'en' ? 'bn' : 'en'))}
              activeOpacity={0.8}
            >
              <Text style={[styles.localePillText, { color: theme.localeText }]}>
                {locale === 'en' ? 'বাংলা' : 'EN'}
              </Text>
            </TouchableOpacity>
            <View
              style={[
                styles.locationPill,
                {
                  backgroundColor: theme.pillBg,
                  borderColor: theme.borderStrong,
                },
              ]}
            >
              <Text style={[styles.locationText, { color: theme.pillText }]}>
                {t.cityBadge}
              </Text>
            </View>
          </View>
        </View>

        {/* Search Bar */}
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: theme.searchBg,
              borderColor: theme.border,
            },
          ]}
        >
          <MapUiIcon name="search" size={18} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder={t.searchPlaceholder}
            placeholderTextColor={theme.searchPlaceholder}
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              setSearchDropdownOpen(text.trim().length > 0);
            }}
            onFocus={() => {
              if (searchQuery.trim().length > 0) {
                setSearchDropdownOpen(true);
              }
            }}
            returnKeyType="search"
          />
          {searchQuery.trim().length > 0 && (
            <TouchableOpacity
              style={styles.searchClearBtn}
              onPress={() => {
                setSearchQuery('');
                setSearchDropdownOpen(false);
              }}
              activeOpacity={0.8}
            >
              <Text
                style={[styles.searchClearText, { color: theme.textSecondary }]}
              >
                {locale === 'bn' ? 'মুছুন' : 'Clear'}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[
              styles.searchFilterBtn,
              {
                backgroundColor: theme.filterBtnBg,
                borderColor: theme.filterBtnBorder,
              },
              (filterModalOpen || hasActiveModalFilters || hasActiveFilter) && {
                borderColor: theme.primary,
                backgroundColor: theme.primarySurface,
              },
            ]}
            onPress={() => {
              setLayersModalOpen(false);
              setSearchDropdownOpen(false);
              setFilterModalOpen(true);
            }}
            activeOpacity={0.8}
          >
            <MapUiIcon
              name="options"
              size={18}
              color={
                filterModalOpen || hasActiveModalFilters || hasActiveFilter
                  ? theme.primaryText
                  : theme.filterBtnIcon
              }
            />
            {hasActiveModalFilters && <View style={styles.filterActiveDot} />}
          </TouchableOpacity>
        </View>

        {/* Live Search Autocomplete Dropdown */}
        {searchDropdownOpen && searchSuggestions.length > 0 && (
          <View
            style={[
              styles.searchDropdown,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            {searchSuggestions.map((item, idx) => (
              <TouchableOpacity
                key={item.key}
                style={[
                  styles.searchSuggestionRow,
                  idx < searchSuggestions.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: theme.border,
                  },
                ]}
                onPress={() => {
                  setSearchDropdownOpen(false);
                  if (item.kind === 'hazard' && item.hazard) {
                    clearTappedPinOnMap();
                    setSelectedHazardId(item.hazard.id);
                    webViewRef.current?.injectJavaScript(
                      `window.clearTappedPin && window.clearTappedPin(); window.focusHazard && window.focusHazard(${item.latitude}, ${item.longitude}); true;`,
                    );
                  } else {
                    setSelectedHazardId(null);
                    clearSafeRoute();
                    setTappedLocation(
                      resolveDhakaTappedLocation(
                        item.latitude,
                        item.longitude,
                        userLocation,
                      ),
                    );
                    webViewRef.current?.injectJavaScript(
                      `window.placeTappedPin && window.placeTappedPin(${item.latitude}, ${item.longitude}); window.focusHazard && window.focusHazard(${item.latitude}, ${item.longitude}); true;`,
                    );
                  }
                }}
                activeOpacity={0.8}
              >
                <MapUiIcon
                  name={item.kind === 'hazard' ? 'warning' : 'location'}
                  size={16}
                  color={item.kind === 'hazard' ? '#F59E0B' : theme.primary}
                />
                <View style={styles.searchSuggestionTextWrap}>
                  <Text
                    style={[
                      styles.searchSuggestionTitle,
                      { color: theme.text },
                    ]}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                  <Text
                    style={[
                      styles.searchSuggestionSub,
                      { color: theme.textSecondary },
                    ]}
                    numberOfLines={1}
                  >
                    {item.subtitle}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Horizontal Category Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.moduleRow}
        >
          {MODULE_ORDER.map((catId) => {
            const meta = CATEGORY_META[catId];
            const active = categoryFilter === catId;
            const accent = isNighttime ? meta.color : meta.lightColor;
            const activeSurface = isNighttime
              ? meta.surface
              : meta.lightSurface;
            const pillLabel =
              catId === 'extortion_spot'
                ? t.categories['ChandaAlert']
                : catId === 'unlit_alley'
                  ? t.categories['Dark-Zone Safety']
                  : catId === 'waterlogging'
                    ? locale === 'bn'
                      ? t.categories.WaterLogging
                      : meta.name
                    : catId === 'pothole_manhole'
                      ? t.categories['Road Hazard']
                      : locale === 'bn'
                        ? meta.nameBn
                        : meta.name;

            return (
              <TouchableOpacity
                key={catId}
                style={[
                  styles.modulePill,
                  {
                    backgroundColor: theme.chipBg,
                    borderColor: theme.border,
                  },
                  active && {
                    borderColor: accent,
                    backgroundColor: activeSurface,
                  },
                ]}
                onPress={() =>
                  setCategoryFilter((prev) => (prev === catId ? 'all' : catId))
                }
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.moduleIconCircle,
                    { backgroundColor: activeSurface },
                  ]}
                >
                  <HazardCategoryIcon
                    category={catId}
                    color={accent}
                    size={15}
                  />
                </View>
                <Text
                  style={[
                    styles.modulePillText,
                    { color: theme.chipText },
                    active && { color: accent, fontWeight: '700' },
                  ]}
                >
                  {pillLabel}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Dismissible Live Proximity Geofencing Danger HUD Banner (FR-18, FR-19, FR-20, FR-21) */}
      {proximityAlert ? (
        <View style={[styles.proximityBanner, { top: topInset + 148 }]}>
          <View style={styles.proximityBannerTopRow}>
            <TouchableOpacity
              style={styles.proximityBannerContent}
              activeOpacity={0.85}
              onPress={() => {
                setSelectedHazardId(proximityAlert.hazard.id);
                webViewRef.current?.injectJavaScript(
                  `window.focusHazard && window.focusHazard(${proximityAlert.hazard.latitude}, ${proximityAlert.hazard.longitude}); true;`,
                );
              }}
            >
              <Text style={styles.proximityBannerTitle} numberOfLines={1}>
                {locale === 'bn'
                  ? `⚠️ সামনেই উচ্চ ঝুঁকি (${proximityAlert.distanceMeters}m দূরে)!`
                  : `⚠️ High-Risk Hazard ${proximityAlert.distanceMeters}m ahead!`}
              </Text>
              <Text style={styles.proximityBannerSub} numberOfLines={1}>
                {proximityAlert.hazard.landmark_context ||
                  CATEGORY_META[proximityAlert.hazard.category]?.name}
              </Text>
              {proximityAlert.isNightPriority && (
                <View style={styles.proximityNightBadge}>
                  <Text style={styles.proximityNightBadgeText}>
                    {locale === 'bn'
                      ? '🌙 রাতের অগ্রাধিকার সতর্কতা (৬PM–৬AM)'
                      : '🌙 Night Priority Alert (6PM–6AM)'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.proximityBannerClose}
              onPress={() => {
                Speech.stop();
                setProximityAlert(null);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.proximityBannerCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.proximityDetourBtn}
            activeOpacity={0.85}
            disabled={routeLoading}
            onPress={() => {
              const h = proximityAlert.hazard;
              // Compute a safe bypass destination ~350m beyond the hazard along current approach
              const dLat = h.latitude - userLocation.latitude;
              const dLng = h.longitude - userLocation.longitude;
              const mag = Math.sqrt(dLat * dLat + dLng * dLng) || 0.001;
              const destLat = Number((h.latitude + (dLat / mag) * 0.0032).toFixed(6));
              const destLng = Number((h.longitude + (dLng / mag) * 0.0032).toFixed(6));
              const bypassLabel =
                locale === 'bn'
                  ? `নিরাপদ বিকল্প (${h.landmark_context || CATEGORY_META[h.category]?.nameBn})`
                  : `Safe Bypass (${h.landmark_context || CATEGORY_META[h.category]?.name})`;
              setProximityAlert(null);
              handleFindSafeRoute(destLat, destLng, bypassLabel);
            }}
          >
            {routeLoading ? (
              <ActivityIndicator size="small" color="#06281E" />
            ) : (
              <>
                <MapUiIcon name="git-branch" size={14} color="#06281E" />
                <Text style={styles.proximityDetourBtnText}>
                  {locale === 'bn' ? '🛡️ নিরাপদ পথ নিন' : '🛡️ Take Safe Detour'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        /* Discreet Live Demo Proximity Check Pill */
        <TouchableOpacity
          style={[
            styles.testAlertChip,
            {
              top: topInset + 148,
              backgroundColor: isNighttime
                ? 'rgba(22, 29, 44, 0.92)'
                : 'rgba(255, 255, 255, 0.94)',
              borderColor: 'rgba(245, 158, 11, 0.45)',
            },
          ]}
          onPress={handleTriggerProximityCheck}
          activeOpacity={0.85}
        >
          <MapUiIcon name="warning" size={13} color="#F59E0B" />
          <Text style={[styles.testAlertChipText, { color: '#F59E0B' }]}>
            {locale === 'bn' ? 'টেস্ট অ্যালার্ট' : 'Test Alert'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Subtle Low GPS Accuracy Banner (>50m, NFR-18) */}
      {gpsAccuracyMeters !== null &&
        gpsAccuracyMeters > 50 &&
        !gpsBannerDismissed &&
        !proximityAlert && (
          <View
            style={[
              styles.lowGpsBanner,
              {
                top: topInset + 186,
                backgroundColor: theme.noticeBg,
                borderColor: theme.noticeBorder,
              },
            ]}
          >
            <MapUiIcon name="location" size={14} color={theme.noticeText} />
            <Text
              style={[styles.lowGpsBannerText, { color: theme.noticeText }]}
              numberOfLines={2}
            >
              {locale === 'bn'
                ? `কম GPS নির্ভুলতা (±${Math.round(gpsAccuracyMeters)}মি) — সঠিক পিন বসাতে ম্যাপে ট্যাপ করুন।`
                : `Low GPS accuracy (±${Math.round(gpsAccuracyMeters)}m) — tap the map manually to place pins accurately.`}
            </Text>
            <TouchableOpacity
              onPress={() => setGpsBannerDismissed(true)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Text
                style={[styles.lowGpsCloseText, { color: theme.noticeText }]}
              >
                ✕
              </Text>
            </TouchableOpacity>
          </View>
        )}

      {/* Layer Status Toast */}
      {layerToast && !proximityAlert && (
        <View
          style={[
            styles.layerToastBadge,
            {
              top: topInset + 186,
              backgroundColor: theme.surface,
              borderColor: showDangerRings ? '#EF4444' : theme.border,
            },
          ]}
        >
          <Text style={[styles.layerToastText, { color: theme.text }]}>
            {layerToast}
          </Text>
        </View>
      )}

      {/* Right-Side Floating Map Controls (Zoom +, Zoom -, Layers, Locate) */}
      <View style={[styles.mapControls, { top: topInset + 148 }]}>
        <TouchableOpacity
          style={[
            styles.mapControlBtn,
            {
              backgroundColor: theme.controlBg,
              borderColor: theme.controlBorder,
            },
          ]}
          onPress={handleZoomIn}
          activeOpacity={0.8}
        >
          <MapUiIcon name="add" size={20} color={theme.controlIcon} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.mapControlBtn,
            {
              backgroundColor: theme.controlBg,
              borderColor: theme.controlBorder,
            },
          ]}
          onPress={handleZoomOut}
          activeOpacity={0.8}
        >
          <MapUiIcon name="remove" size={20} color={theme.controlIcon} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.mapControlBtn,
            {
              backgroundColor: theme.controlBg,
              borderColor: theme.controlBorder,
            },
            showDangerRings && {
              borderColor: '#EF4444',
              backgroundColor: 'rgba(239, 68, 68, 0.2)',
            },
          ]}
          onPress={handleToggleDangerRings}
          onLongPress={() => setLayersModalOpen(true)}
          activeOpacity={0.8}
        >
          <MapUiIcon
            name="layers"
            size={19}
            color={showDangerRings ? '#F87171' : theme.controlIcon}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.mapControlBtn,
            {
              backgroundColor: theme.controlBg,
              borderColor: theme.controlBorder,
            },
          ]}
          onPress={handleLocate}
          activeOpacity={0.8}
        >
          <MapUiIcon name="locate" size={20} color={theme.controlIcon} />
        </TouchableOpacity>
      </View>

      {/* Floating Map Options Popover Card */}
      <Modal
        visible={layersModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setLayersModalOpen(false)}
      >
        <TouchableOpacity
          style={[styles.popoverBackdrop, { paddingTop: topInset + 148 }]}
          activeOpacity={1}
          onPress={() => setLayersModalOpen(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[
              styles.layersCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.layersHeader}>
              <Text style={[styles.layersTitle, { color: theme.text }]}>
                {copy.mapOptions}
              </Text>
              <TouchableOpacity
                style={[
                  styles.layersCloseBtn,
                  {
                    backgroundColor: theme.closeBtnBg,
                    borderColor: theme.borderStrong,
                  },
                ]}
                onPress={() => setLayersModalOpen(false)}
              >
                <Text
                  style={[styles.layersCloseText, { color: theme.closeBtnText }]}
                >
                  ×
                </Text>
              </TouchableOpacity>
            </View>

            <Text
              style={[
                styles.layersSectionLabel,
                { color: theme.textSecondary },
              ]}
            >
              {copy.viewMode}
            </Text>
            {(
              [
                { id: 'all', label: 'All hazards' },
                { id: 'pedestrian_night', label: 'Pedestrian night' },
                { id: 'driver_biker', label: 'Driver / Biker' },
              ] as const
            ).map((mode) => {
              const active = viewMode === mode.id;
              return (
                <TouchableOpacity
                  key={mode.id}
                  style={[
                    styles.layersOption,
                    {
                      backgroundColor: theme.surfaceElevated,
                      borderColor: theme.borderStrong,
                    },
                    active && {
                      borderColor: theme.primary,
                      backgroundColor: theme.primarySurface,
                    },
                  ]}
                  onPress={() => {
                    setViewMode(mode.id);
                    setLayersModalOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.layersOptionText,
                      { color: theme.text },
                      active && { color: theme.primaryText },
                    ]}
                  >
                    {mode.label}
                  </Text>
                </TouchableOpacity>
              );
            })}

            <Text
              style={[
                styles.layersSectionLabel,
                { color: theme.textSecondary },
              ]}
            >
              {copy.display}
            </Text>
            <TouchableOpacity
              style={[
                styles.layersOption,
                {
                  backgroundColor: theme.surfaceElevated,
                  borderColor: theme.borderStrong,
                },
                highContrastMap && {
                  borderColor: theme.primary,
                  backgroundColor: theme.primarySurface,
                },
              ]}
              onPress={() => setHighContrastMap((v) => !v)}
            >
              <Text
                style={[
                  styles.layersOptionText,
                  { color: theme.text },
                  highContrastMap && { color: theme.primaryText },
                ]}
              >
                {highContrastMap ? 'High contrast: On' : 'High contrast: Off'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.layersOption,
                {
                  backgroundColor: theme.surfaceElevated,
                  borderColor: theme.borderStrong,
                },
                isNighttime && {
                  borderColor: theme.primary,
                  backgroundColor: theme.primarySurface,
                },
              ]}
              onPress={() => setIsNighttime((v) => !v)}
            >
              <Text
                style={[
                  styles.layersOptionText,
                  { color: theme.text },
                  isNighttime && { color: theme.primaryText },
                ]}
              >
                {isNighttime
                  ? 'Night mode (6PM–6AM): On'
                  : 'Night mode (6PM–6AM): Off'}
              </Text>
            </TouchableOpacity>

            <Text
              style={[
                styles.layersSectionLabel,
                { color: theme.textSecondary },
              ]}
            >
              {copy.devTools}
            </Text>
            <TouchableOpacity
              style={[
                styles.layersOption,
                {
                  backgroundColor: theme.surfaceElevated,
                  borderColor: theme.borderStrong,
                },
                demoMode && {
                  borderColor: theme.primary,
                  backgroundColor: theme.primarySurface,
                },
              ]}
              onPress={() => setDemoMode((v) => !v)}
            >
              <Text
                style={[
                  styles.layersOptionText,
                  { color: theme.text },
                  demoMode && { color: theme.primaryText },
                ]}
              >
                {demoMode ? 'Demo Mode: On' : 'Demo Mode: Off'}
              </Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Sleek Floating Multi-Route Risk Selector Card (Safest vs Fastest) */}
      {hasActiveRoutes && !selectedHazard && (
        <View
          style={[
            styles.routeSelectorCard,
            {
              backgroundColor: theme.surface,
              borderColor:
                selectedRouteId === 'safest' ? '#10B981' : '#F59E0B',
            },
          ]}
        >
          <View style={styles.routeSelectorHeader}>
            <View style={styles.routeSelectorTitleWrap}>
              <Text
                style={[styles.routeSelectorTitle, { color: theme.text }]}
                numberOfLines={1}
              >
                {locale === 'bn' ? 'গন্তব্য: ' : 'Route to '}
                {routeTargetLabel}
              </Text>
              <Text
                style={[
                  styles.routeSelectorSub,
                  { color: theme.textSecondary },
                ]}
                numberOfLines={1}
              >
                {locale === 'bn'
                  ? 'লাইভ রুট তুলনা করতে নিচের কার্ডে ট্যাপ করুন'
                  : 'Tap below to toggle Safest vs Fastest route live'}
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.tappedLocationCloseBtn,
                {
                  backgroundColor: theme.closeBtnBg,
                  borderColor: theme.borderStrong,
                },
              ]}
              onPress={clearSafeRoute}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.tappedLocationCloseText,
                  { color: theme.closeBtnText },
                ]}
              >
                ×
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.routeOptionsRow}>
            {routeOptions.map((option) => {
              const isSafest =
                option.id === 'safest' || option.label === 'Safest Route';
              const isActive = option.id === selectedRouteId;
              const accentColor = isSafest
                ? '#10B981'
                : option.riskScore > 0
                  ? '#F59E0B'
                  : '#3B82F6';
              const activeBg = isSafest
                ? 'rgba(16, 185, 129, 0.16)'
                : option.riskScore > 0
                  ? 'rgba(245, 158, 11, 0.16)'
                  : 'rgba(59, 130, 246, 0.16)';
              const distKm = (Math.max(100, option.distanceMeters) / 1000).toFixed(
                1,
              );
              const durMin = Math.max(1, Math.round(option.durationSeconds / 60));

              return (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.routeOptionCard,
                    {
                      backgroundColor: isActive
                        ? activeBg
                        : theme.surfaceElevated,
                      borderColor: isActive ? accentColor : theme.borderStrong,
                    },
                  ]}
                  onPress={() => handleSelectRouteOption(option.id)}
                  activeOpacity={0.85}
                >
                  <View style={styles.routeOptionTopRow}>
                    <View
                      style={[
                        styles.routeColorDot,
                        { backgroundColor: accentColor },
                      ]}
                    />
                    <Text
                      style={[
                        styles.routeOptionLabel,
                        { color: isActive ? accentColor : theme.text },
                      ]}
                      numberOfLines={1}
                    >
                      {isSafest
                        ? locale === 'bn'
                          ? '🛡️ নিরাপদ পথ'
                          : '🛡️ Safest Route'
                        : locale === 'bn'
                          ? '⚡ দ্রুততম পথ'
                          : '⚡ Fastest Route'}
                    </Text>
                  </View>

                  <Text
                    style={[styles.routeOptionMetrics, { color: theme.text }]}
                    numberOfLines={1}
                  >
                    {durMin} min · {distKm} km
                  </Text>

                  <View style={styles.routeBadgeRow}>
                    <View
                      style={[
                        styles.routeRiskBadge,
                        {
                          backgroundColor:
                            option.riskScore === 0
                              ? 'rgba(16, 185, 129, 0.18)'
                              : 'rgba(245, 158, 11, 0.18)',
                          borderColor:
                            option.riskScore === 0
                              ? 'rgba(52, 211, 153, 0.45)'
                              : 'rgba(251, 191, 36, 0.45)',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.routeRiskBadgeText,
                          {
                            color:
                              option.riskScore === 0 ? '#34D399' : '#FBBF24',
                          },
                        ]}
                      >
                        Risk {option.riskScore}
                      </Text>
                    </View>

                    {isSafest ? (
                      <View style={styles.routeAvoidedBadge}>
                        <Text style={styles.routeAvoidedBadgeText}>
                          {hazardsAvoidedCount > 0
                            ? `${hazardsAvoidedCount} avoided`
                            : `${option.hazardsNearRoute} hazards`}
                        </Text>
                      </View>
                    ) : (
                      <View
                        style={[
                          styles.routeRiskBadge,
                          {
                            backgroundColor: theme.surface,
                            borderColor: theme.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.routeRiskBadgeText,
                            { color: theme.textSecondary },
                          ]}
                        >
                          {option.hazardsNearRoute} near
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Tapped Map Location Action Card */}
      {tappedLocation && !selectedHazard && !hasActiveRoutes && (
        <View
          style={[
            styles.tappedLocationCard,
            {
              backgroundColor: theme.surface,
              borderColor: theme.primary,
            },
          ]}
        >
          <View style={styles.tappedLocationTop}>
            <View style={styles.tappedLocationTitleGroup}>
              <Text
                style={[styles.tappedLocationTitle, { color: theme.text }]}
                numberOfLines={1}
              >
                {tappedLocation.label}
              </Text>
              <Text
                style={[
                  styles.tappedLocationMeta,
                  { color: theme.textSecondary },
                ]}
                numberOfLines={1}
              >
                {t.cityBadge} · {tappedLocation.distanceText} ·{' '}
                {tappedLocation.coordLabel}
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.tappedLocationCloseBtn,
                {
                  backgroundColor: theme.closeBtnBg,
                  borderColor: theme.borderStrong,
                },
              ]}
              onPress={clearTappedPinOnMap}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.tappedLocationCloseText,
                  { color: theme.closeBtnText },
                ]}
              >
                ×
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tappedLocationActions}>
            <TouchableOpacity
              style={[
                styles.tappedRouteBtn,
                {
                  borderColor: theme.primary,
                  backgroundColor: theme.primarySurface,
                },
              ]}
              onPress={() =>
                handleFindSafeRoute(
                  tappedLocation.latitude,
                  tappedLocation.longitude,
                  tappedLocation.label,
                )
              }
              disabled={routeLoading}
              activeOpacity={0.85}
            >
              {routeLoading ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <>
                  <MapUiIcon
                    name="git-branch"
                    size={16}
                    color={theme.primary}
                  />
                  <Text
                    style={[
                      styles.tappedRouteBtnText,
                      { color: theme.primary },
                    ]}
                  >
                    {t.actions.findRoute}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tappedReportBtn,
                {
                  backgroundColor: '#3B82F6',
                  borderColor: '#3B82F6',
                },
              ]}
              onPress={() => {
                setReportModalVisible(true);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.tappedReportBtnText}>
                {t.actions.reportHere}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Selected Hazard Bottom Card with Photo Evidence Thumbnail */}
      {selectedHazard && (() => {
        const meta = CATEGORY_META[selectedHazard.category];
        const accent = isNighttime ? meta?.color : meta?.lightColor;
        const riskLabel =
          selectedHazard.severity === 'Critical'
            ? t.actions.highRisk
            : selectedHazard.severity === 'Medium'
              ? t.actions.mediumRisk
              : t.actions.lowRisk;
        const confirmationsCount =
          selectedHazard.confirmations ??
          (selectedHazard.status === 'crowd_verified' ? 3 : 1);
        const resolvedCount = selectedHazard.resolved_count ?? 0;
        const isCrowdVerified =
          selectedHazard.status === 'crowd_verified' ||
          confirmationsCount >= 3;
        const confirmationsText = `${confirmationsCount} ${confirmationsCount === 1 ? 'confirmation' : 'confirmations'}`;
        const isConfirming = confirmingId === selectedHazard.id;
        const isResolving = resolvingId === selectedHazard.id;
        const hasValidPhoto =
          Boolean(selectedHazard.image_url?.trim()) &&
          !failedThumbIds[selectedHazard.id];
        const distMetersFromUser = computeDistanceMeters(
          userLocation.latitude,
          userLocation.longitude,
          selectedHazard.latitude,
          selectedHazard.longitude,
        );
        const distLabel =
          distMetersFromUser < 1000
            ? `${distMetersFromUser}m`
            : `${(distMetersFromUser / 1000).toFixed(1)}km`;

        return (
          <View
            style={[
              styles.selectedCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <View style={styles.selectedCardTop}>
              <View style={styles.selectedCategoryRow}>
                <HazardCategoryIcon
                  category={selectedHazard.category}
                  color={accent || '#EF4444'}
                  size={15}
                />
                <Text
                  style={[
                    styles.selectedCategoryText,
                    { color: accent || theme.text },
                  ]}
                  numberOfLines={1}
                >
                  {locale === 'bn'
                    ? meta?.nameBn
                    : meta?.name || selectedHazard.category}
                </Text>
              </View>

              <View style={styles.selectedBadgesRow}>
                {isCrowdVerified && (
                  <View
                    style={[
                      styles.verifiedPill,
                      {
                        backgroundColor: theme.verifiedBg,
                        borderColor: theme.verifiedBorder,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.verifiedPillText,
                        { color: theme.verifiedText },
                      ]}
                    >
                      {t.actions.crowdVerified}
                    </Text>
                  </View>
                )}
                <View
                  style={[
                    styles.riskPill,
                    {
                      backgroundColor: theme.riskBg,
                      borderColor: theme.riskBorder,
                    },
                  ]}
                >
                  <Text style={[styles.riskPillText, { color: theme.riskText }]}>
                    {riskLabel}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.selectedCloseBtn,
                    { backgroundColor: theme.closeBtnBg },
                  ]}
                  onPress={() => {
                    setSelectedHazardId(null);
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.selectedCloseText,
                      { color: theme.closeBtnText },
                    ]}
                  >
                    ×
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.selectedBodyRow}>
              <View style={styles.selectedTextCol}>
                <Text
                  style={[styles.selectedTitle, { color: theme.text }]}
                  numberOfLines={1}
                >
                  {selectedHazard.landmark_context || meta?.name}
                </Text>
                <Text
                  style={[styles.selectedMeta, { color: theme.textSecondary }]}
                  numberOfLines={1}
                >
                  {t.cityBadge} · {confirmationsText}
                  {selectedHazard.sub_tag ? ` · ${selectedHazard.sub_tag}` : ''}
                </Text>
              </View>

              {hasValidPhoto && selectedHazard.image_url && (
                <View
                  style={[
                    styles.evidenceThumbWrap,
                    { borderColor: theme.borderStrong },
                  ]}
                >
                  <Image
                    source={{ uri: selectedHazard.image_url }}
                    style={styles.evidenceThumbnail}
                    resizeMode="cover"
                    onError={() =>
                      setFailedThumbIds((prev) => ({
                        ...prev,
                        [selectedHazard.id]: true,
                      }))
                    }
                  />
                  <View style={styles.evidenceBadge}>
                    <Text style={styles.evidenceBadgeText}>
                      {locale === 'bn' ? '📷 প্রমাণ' : '📷 Photo'}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            <View
              style={[
                styles.distanceNoticeBar,
                {
                  backgroundColor: theme.noticeBg,
                  borderColor: theme.noticeBorder,
                },
              ]}
            >
              <MapUiIcon name="location" size={14} color={theme.noticeText} />
              <Text
                style={[styles.distanceNoticeText, { color: theme.noticeText }]}
                numberOfLines={1}
              >
                {isUserTrusted
                  ? `🛡️ Trusted 2x vote weight active (${distLabel} ${t.actions.away})`
                  : `Community verification active (${distLabel} ${t.actions.away})`}
              </Text>
            </View>

            <View style={styles.selectedActionsRow}>
              <TouchableOpacity
                style={[
                  styles.tappedRouteBtn,
                  {
                    borderColor: theme.primary,
                    backgroundColor: theme.primarySurface,
                  },
                ]}
                onPress={() =>
                  handleFindSafeRoute(
                    selectedHazard.latitude,
                    selectedHazard.longitude,
                    selectedHazard.landmark_context || meta?.name || 'Hazard',
                  )
                }
                disabled={routeLoading}
                activeOpacity={0.85}
              >
                {routeLoading ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <>
                    <MapUiIcon
                      name="git-branch"
                      size={15}
                      color={theme.primary}
                    />
                    <Text
                      style={[
                        styles.tappedRouteBtnText,
                        { color: theme.primary },
                      ]}
                      numberOfLines={1}
                    >
                      {t.actions.findRoute}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.confirmCardBtn,
                  {
                    backgroundColor: theme.verifiedBg,
                    borderColor: theme.verifiedBorder,
                  },
                ]}
                onPress={() => handleConfirmHazard(selectedHazard)}
                disabled={isConfirming}
                activeOpacity={0.85}
              >
                {isConfirming ? (
                  <ActivityIndicator size="small" color={theme.verifiedText} />
                ) : (
                  <Text
                    style={[
                      styles.confirmCardBtnText,
                      { color: theme.verifiedText },
                    ]}
                    numberOfLines={1}
                  >
                    👍 {t.actions.confirmHazard} ({confirmationsCount})
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.resolveCardBtn,
                  {
                    backgroundColor: theme.surfaceElevated,
                    borderColor: theme.borderStrong,
                  },
                ]}
                onPress={() => handleResolveHazard(selectedHazard)}
                disabled={isResolving}
                activeOpacity={0.85}
              >
                {isResolving ? (
                  <ActivityIndicator size="small" color={theme.text} />
                ) : (
                  <Text
                    style={[styles.resolveCardBtnText, { color: theme.text }]}
                    numberOfLines={1}
                  >
                    ✅ {t.actions.markCleared}
                    {resolvedCount > 0 ? ` (${resolvedCount})` : ''}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        );
      })()}

      <AlertsModal
        visible={alertsSheetOpen}
        onClose={() => setAlertsSheetOpen(false)}
        hazards={filteredHazards.map((h) => ({
          ...h,
          image_url: h.image_url ?? undefined,
        }))}
        isDarkMode={isNighttime}
        language={locale}
        onSelectHazard={(hazard) => {
          setAlertsSheetOpen(false);
          clearSafeRoute();
          setSelectedHazardId(hazard.id);
          webViewRef.current?.injectJavaScript(
            `window.focusHazard && window.focusHazard(${hazard.latitude}, ${hazard.longitude}); true;`,
          );
        }}
      />

      {/* Bottom 3-Tab Navigation Bar (Map, Alerts, + Report) */}
      <View
        style={[
          styles.bottomNav,
          {
            backgroundColor: theme.bottomNavBg,
            borderTopColor: theme.border,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => {
            setAlertsSheetOpen(false);
            setReportModalVisible(false);
          }}
          activeOpacity={0.8}
        >
          <View
            style={[
              styles.navIconPill,
              activeTab === 'map' && { backgroundColor: theme.primarySurface },
            ]}
          >
            <MapUiIcon
              name="map"
              size={20}
              color={activeTab === 'map' ? theme.primary : theme.navInactive}
            />
          </View>
          <Text
            style={[
              styles.navLabel,
              { color: theme.navInactive },
              activeTab === 'map' && {
                color: theme.primary,
                fontWeight: '600',
              },
            ]}
          >
            {t.tabs.map}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => {
            setReportModalVisible(false);
            setAlertsSheetOpen(true);
            loadHazards();
          }}
          activeOpacity={0.8}
        >
          <View
            style={[
              styles.navIconPill,
              activeTab === 'alerts' && {
                backgroundColor: theme.primarySurface,
              },
            ]}
          >
            <MapUiIcon
              name="notifications"
              size={20}
              color={activeTab === 'alerts' ? theme.primary : theme.navInactive}
            />
          </View>
          <Text
            style={[
              styles.navLabel,
              { color: theme.navInactive },
              activeTab === 'alerts' && {
                color: theme.primary,
                fontWeight: '600',
              },
            ]}
          >
            {t.tabs.alerts}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => {
            setAlertsSheetOpen(false);
            setReportModalVisible(true);
          }}
          activeOpacity={0.8}
        >
          <View
            style={[
              styles.navIconPill,
              activeTab === 'report' && {
                backgroundColor: theme.primarySurface,
              },
            ]}
          >
            <MapUiIcon
              name="add"
              size={22}
              color={activeTab === 'report' ? theme.primary : theme.navInactive}
            />
          </View>
          <Text
            style={[
              styles.navLabel,
              { color: theme.navInactive },
              activeTab === 'report' && {
                color: theme.primary,
                fontWeight: '600',
              },
            ]}
          >
            {t.tabs.report}
          </Text>
        </TouchableOpacity>
      </View>

      <FilterModal
        visible={filterModalOpen}
        onClose={() => setFilterModalOpen(false)}
        filters={hazardFilters}
        onApply={(nextFilters) => setHazardFilters(nextFilters)}
        isDark={isNighttime}
        language={locale}
      />

      <QuickReportModal
        visible={reportModalVisible}
        currentLocation={mapCenter}
        initialCoords={
          tappedLocation
            ? {
                latitude: tappedLocation.latitude,
                longitude: tappedLocation.longitude,
              }
            : null
        }
        onClose={() => {
          setReportModalVisible(false);
        }}
        onSubmitHazard={handleSubmitHazard}
        isDark={isNighttime}
        language={locale}
      />

      <AuthModal
        visible={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
        isDark={isNighttime}
        language={locale}
      />

      <ProfileModal
        visible={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        user={currentUser}
        totalReportsCount={userReportsCount}
        onSignOut={() => setCurrentUser(null)}
        isDark={isNighttime}
        language={locale}
      />
    </View>
  );
}
