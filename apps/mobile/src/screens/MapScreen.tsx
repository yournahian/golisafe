import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type {
  CreateHazardRequest,
  HazardCategory,
  HazardRecord,
} from '../../../../packages/shared/api-contract';
import AlertsModal from '../components/Alerts/AlertsModal';
import {
  DEFAULT_HAZARD_FILTERS,
  FilterModal,
  type HazardFilterState,
} from '../components/Filter/FilterModal';
import QuickReportModal from '../components/Report/QuickReportModal';
import { TRANSLATIONS, type Language } from '../i18n/translations';
import {
  confirmHazard,
  fetchHazards,
  resolveHazard,
  submitHazard,
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
  buildCurvedDetourPolyline,
  computeDistanceMeters,
  computePolylineDistanceMeters,
  findNearbyCorridorHazards,
  resolveDhakaTappedLocation,
  type SafeRouteState,
  type TappedLocationState,
} from './mapGeoUtils';
import { styles } from './MapScreen.styles';
import { LEAFLET_HTML } from './mapTemplate';

type ViewMode = 'all' | 'pedestrian_night' | 'driver_biker';
type CategoryFilter = 'all' | HazardCategory;
type BottomTab = 'map' | 'alerts' | 'report';

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
  const [isNighttime, setIsNighttime] = useState<boolean>(true);
  const [demoMode, setDemoMode] = useState<boolean>(false);
  const [selectedHazardId, setSelectedHazardId] = useState<string | null>(null);
  const [reportModalVisible, setReportModalVisible] = useState<boolean>(false);
  const [tappedLocation, setTappedLocation] =
    useState<TappedLocationState | null>(null);
  const [activeRoute, setActiveRoute] = useState<SafeRouteState | null>(null);
  const [routeLoading, setRouteLoading] = useState<boolean>(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState(DHAKA_CENTER);
  const [webViewReady, setWebViewReady] = useState<boolean>(false);
  const webViewRef = useRef<WebView>(null);
  const layerToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const theme = isNighttime ? DARK_THEME : LIGHT_THEME;
  const copy = UI_COPY[locale];
  const t = TRANSLATIONS[locale];

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

  const clearSafeRoute = useCallback(() => {
    setActiveRoute(null);
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

  const handleFindSafeRoute = useCallback(
    async (destLat: number, destLng: number, targetLabel: string) => {
      setRouteLoading(true);
      const userLat = DHAKA_CENTER.latitude;
      const userLng = DHAKA_CENTER.longitude;
      const corridorHazards = findNearbyCorridorHazards(
        userLat,
        userLng,
        destLat,
        destLng,
        hazards,
      );
      const avoidedCount = Math.max(1, corridorHazards.length);

      let routeCoords: Array<[number, number]> | null = null;
      let distanceMeters = 0;
      let durationSeconds = 0;

      try {
        const osrmUrl = `https://router.project-osrm.org/route/v1/foot/${userLng},${userLat};${destLng},${destLat}?overview=full&geometries=geojson`;
        const response = await fetch(osrmUrl);
        if (response.ok) {
          const json = await response.json();
          const route = json?.routes?.[0];
          const rawCoords: Array<[number, number]> | undefined =
            route?.geometry?.coordinates;
          if (Array.isArray(rawCoords) && rawCoords.length >= 2) {
            routeCoords = rawCoords.map(([lng, lat]) => [lat, lng]);
            distanceMeters =
              typeof route.distance === 'number'
                ? route.distance
                : computePolylineDistanceMeters(routeCoords);
            durationSeconds =
              typeof route.duration === 'number'
                ? route.duration
                : Math.round(distanceMeters / 1.3);
          }
        }
      } catch {
        // Fall back to curved street detour polyline below
      }

      if (!routeCoords || routeCoords.length < 2) {
        routeCoords = buildCurvedDetourPolyline(
          userLat,
          userLng,
          destLat,
          destLng,
          corridorHazards,
        );
        distanceMeters = computePolylineDistanceMeters(routeCoords);
        durationSeconds = Math.round(distanceMeters / 1.3);
      }

      const distanceKm = (Math.max(150, distanceMeters) / 1000).toFixed(1);
      const durationMin = Math.max(2, Math.round(durationSeconds / 60));

      setActiveRoute({
        targetLabel,
        durationMin,
        distanceKm,
        avoidedCount,
        coords: routeCoords,
      });

      const payload = JSON.stringify(routeCoords);
      webViewRef.current?.injectJavaScript(
        `window.renderSafeRoute && window.renderSafeRoute(${payload}); true;`,
      );
      setRouteLoading(false);
    },
    [hazards],
  );

  const handleSubmitHazard = useCallback(
    async (payload: CreateHazardRequest) => {
      let createdRecord: HazardRecord;
      try {
        createdRecord = await submitHazard(payload);
      } catch {
        createdRecord = {
          id: `local-${Date.now()}`,
          category: payload.category,
          severity: payload.severity ?? 'Medium',
          latitude: payload.latitude,
          longitude: payload.longitude,
          landmark_context: payload.landmark_context,
          sub_tag: payload.sub_tag,
          status: 'active',
          created_at: new Date().toISOString(),
        };
      }

      setHazards((prev) => [createdRecord, ...prev]);
      setSelectedHazardId(createdRecord.id);
      clearTappedPinOnMap();
      setReportModalVisible(false);
      Alert.alert(
        'Hazard Reported',
        'Thank you! Your hazard report is now visible on the Dhaka safety map.',
      );
    },
    [clearTappedPinOnMap],
  );

  const handleConfirmHazard = useCallback(async (hazard: HazardRecord) => {
    setConfirmingId(hazard.id);
    const currentCount =
      hazard.confirmations ?? (hazard.status === 'crowd_verified' ? 3 : 1);
    try {
      const updated = await confirmHazard(hazard.id);
      const nextCount = updated.confirmations ?? currentCount + 1;
      const nextStatus =
        nextCount >= 3 ? 'crowd_verified' : (updated.status ?? hazard.status);
      setHazards((prev) =>
        prev.map((h) =>
          h.id === hazard.id
            ? { ...h, ...updated, confirmations: nextCount, status: nextStatus }
            : h,
        ),
      );
    } catch {
      const nextCount = currentCount + 1;
      const nextStatus =
        nextCount >= 3 ? 'crowd_verified' : hazard.status;
      setHazards((prev) =>
        prev.map((h) =>
          h.id === hazard.id
            ? { ...h, confirmations: nextCount, status: nextStatus }
            : h,
        ),
      );
    } finally {
      setConfirmingId(null);
    }
  }, []);

  const handleResolveHazard = useCallback(async (hazard: HazardRecord) => {
    setResolvingId(hazard.id);
    const currentResolved = hazard.resolved_count ?? 0;
    try {
      const updated = await resolveHazard(hazard.id);
      const nextResolved = updated.resolved_count ?? currentResolved + 1;
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
      const nextResolved = currentResolved + 1;
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
  }, []);

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
    let list = hazards.filter((h) => h.status !== 'resolved');

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
            DHAKA_CENTER.latitude,
            DHAKA_CENTER.longitude,
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
  }, [hazards, viewMode, categoryFilter, hazardFilters, searchQuery]);

  const searchSuggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length === 0) return [];

    const hazardMatches = hazards
      .filter((h) => h.status !== 'resolved')
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
          setSelectedHazardId(msg.id);
        } else if (
          msg?.type === 'mapTap' &&
          typeof msg.latitude === 'number' &&
          typeof msg.longitude === 'number'
        ) {
          setSelectedHazardId(null);
          setTappedLocation(
            resolveDhakaTappedLocation(
              msg.latitude,
              msg.longitude,
              DHAKA_CENTER,
            ),
          );
        }
      } catch {
        // Ignore malformed messages
      }
    },
    [],
  );

  const handleZoomIn = () => {
    webViewRef.current?.injectJavaScript('map.zoomIn(); true;');
  };

  const handleZoomOut = () => {
    webViewRef.current?.injectJavaScript('map.zoomOut(); true;');
  };

  const handleLocate = () => {
    setMapCenter(DHAKA_CENTER);
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

      {/* Top Header, Search Bar & Category Pills (Single View, zero extra top gap) */}
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
          <Ionicons
            name="search-outline"
            size={18}
            color={theme.textSecondary}
          />
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
            <Ionicons
              name="options-outline"
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
                    setTappedLocation(
                      resolveDhakaTappedLocation(
                        item.latitude,
                        item.longitude,
                        DHAKA_CENTER,
                      ),
                    );
                    webViewRef.current?.injectJavaScript(
                      `window.placeTappedPin && window.placeTappedPin(${item.latitude}, ${item.longitude}); window.focusHazard && window.focusHazard(${item.latitude}, ${item.longitude}); true;`,
                    );
                  }
                }}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={
                    item.kind === 'hazard'
                      ? 'warning-outline'
                      : 'location-outline'
                  }
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

        {/* Horizontal Category Pills with Exact Figma SVG Icons */}
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

      {/* Layer Status Toast */}
      {layerToast && (
        <View
          style={[
            styles.layerToastBadge,
            {
              top: topInset + 148,
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
          <Ionicons name="add" size={20} color={theme.controlIcon} />
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
          <Ionicons name="remove" size={20} color={theme.controlIcon} />
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
          <Ionicons
            name="layers-outline"
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
          <Ionicons
            name="locate-outline"
            size={20}
            color={theme.controlIcon}
          />
        </TouchableOpacity>
      </View>

      {/* Floating Map Options Popover Card (Layers button) */}
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

      {/* Tapped Map Location Action Card (Figma .tapped-location-sheet) */}
      {tappedLocation && !selectedHazard && (
        <View
          style={[
            styles.tappedLocationCard,
            {
              backgroundColor: theme.surface,
              borderColor: activeRoute ? '#10B981' : theme.primary,
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

          {activeRoute && (
            <View
              style={[
                styles.safeRouteBar,
                {
                  backgroundColor: theme.verifiedBg,
                  borderColor: theme.verifiedBorder,
                },
              ]}
            >
              <View style={styles.safeRouteInfo}>
                <View style={styles.safeRouteBadgeRow}>
                  <Text
                    style={[
                      styles.safeRouteBadgeText,
                      { color: theme.verifiedText },
                    ]}
                  >
                    🛡️ {t.actions.safeDetourActive}
                  </Text>
                </View>
                <Text
                  style={[styles.safeRouteMetaText, { color: theme.text }]}
                  numberOfLines={1}
                >
                  {activeRoute.durationMin} min · {activeRoute.distanceKm} km ·{' '}
                  {locale === 'bn'
                    ? 'সক্রিয় ঝুঁকি এড়িয়ে'
                    : 'Avoids active hazards'}
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.clearRouteBtn,
                  {
                    backgroundColor: theme.surfaceElevated,
                    borderColor: theme.verifiedBorder,
                  },
                ]}
                onPress={clearSafeRoute}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.clearRouteBtnText,
                    { color: theme.verifiedText },
                  ]}
                >
                  {t.actions.clearRoute}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.tappedLocationActions}>
            <TouchableOpacity
              style={[
                styles.tappedRouteBtn,
                {
                  borderColor: activeRoute ? '#10B981' : theme.primary,
                  backgroundColor: activeRoute
                    ? theme.verifiedBg
                    : theme.primarySurface,
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
                  <Ionicons
                    name="git-branch-outline"
                    size={16}
                    color={activeRoute ? theme.verifiedText : theme.primary}
                  />
                  <Text
                    style={[
                      styles.tappedRouteBtnText,
                      {
                        color: activeRoute ? theme.verifiedText : theme.primary,
                      },
                    ]}
                  >
                    {activeRoute
                      ? locale === 'bn'
                        ? 'পুনরায় হিসাব'
                        : 'Recalculate'
                      : t.actions.findRoute}
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

      {/* Selected Hazard Bottom Card (Figma .selected-marker-card) */}
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

        return (
          <View
            style={[
              styles.selectedCard,
              {
                backgroundColor: theme.surface,
                borderColor: activeRoute ? '#10B981' : theme.border,
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
                    clearSafeRoute();
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

            <Text
              style={[styles.selectedTitle, { color: theme.text }]}
              numberOfLines={1}
            >
              {selectedHazard.landmark_context || meta?.name}
            </Text>
            <Text style={[styles.selectedMeta, { color: theme.textSecondary }]}>
              {t.cityBadge} · Reported recently · {confirmationsText}
            </Text>

            {activeRoute ? (
              <View
                style={[
                  styles.safeRouteBar,
                  {
                    backgroundColor: theme.verifiedBg,
                    borderColor: theme.verifiedBorder,
                  },
                ]}
              >
                <View style={styles.safeRouteInfo}>
                  <View style={styles.safeRouteBadgeRow}>
                    <Text
                      style={[
                        styles.safeRouteBadgeText,
                        { color: theme.verifiedText },
                      ]}
                    >
                      🛡️ {t.actions.safeDetourActive}
                    </Text>
                  </View>
                  <Text
                    style={[styles.safeRouteMetaText, { color: theme.text }]}
                    numberOfLines={1}
                  >
                    {activeRoute.durationMin} min · {activeRoute.distanceKm} km ·{' '}
                    {locale === 'bn'
                      ? 'সক্রিয় ঝুঁকি এড়িয়ে'
                      : 'Avoids active hazards'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.clearRouteBtn,
                    {
                      backgroundColor: theme.surfaceElevated,
                      borderColor: theme.verifiedBorder,
                    },
                  ]}
                  onPress={clearSafeRoute}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.clearRouteBtnText,
                      { color: theme.verifiedText },
                    ]}
                  >
                    {t.actions.clearRoute}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View
                style={[
                  styles.distanceNoticeBar,
                  {
                    backgroundColor: theme.noticeBg,
                    borderColor: theme.noticeBorder,
                  },
                ]}
              >
                <Ionicons
                  name="location-outline"
                  size={14}
                  color={theme.noticeText}
                />
                <Text
                  style={[
                    styles.distanceNoticeText,
                    { color: theme.noticeText },
                  ]}
                >
                  Within 150m required to vote (180m {t.actions.away})
                </Text>
              </View>
            )}

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
                    <Ionicons
                      name="git-branch-outline"
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
        hazards={filteredHazards}
        isDarkMode={isNighttime}
        language={locale}
        onSelectHazard={(hazard) => {
          setAlertsSheetOpen(false);
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
            <Ionicons
              name="map-outline"
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
            <Ionicons
              name="notifications-outline"
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
            <Ionicons
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
      />
    </View>
  );
}
