import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type {
  CreateHazardRequest,
  HazardCategory,
  HazardRecord,
} from '../../../../packages/shared/api-contract';
import QuickReportModal from '../components/Report/QuickReportModal';
import { fetchHazards, submitHazard } from '../services/api';

type ViewMode = 'all' | 'pedestrian_night' | 'driver_biker';
type CategoryFilter = 'all' | HazardCategory;
type Locale = 'en' | 'bn';
type BottomTab = 'map' | 'alerts' | 'report';

const DHAKA_CENTER = {
  latitude: 23.7806,
  longitude: 90.407,
};

const LIGHT_THEME = {
  bg: '#F1F5F9',
  headerBg: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceElevated: '#F8FAFC',
  text: '#0F172A',
  textSecondary: '#64748B',
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',
  primary: '#2563EB',
  primarySurface: '#EFF6FF',
  primaryText: '#2563EB',
  statusBarStyle: 'dark-content' as const,
  pillBg: '#FFFFFF',
  pillText: '#64748B',
  localeText: '#0F172A',
  searchBg: '#F1F5F9',
  searchPlaceholder: '#64748B',
  filterBtnBg: '#FFFFFF',
  filterBtnBorder: '#E2E8F0',
  filterBtnIcon: '#0F172A',
  chipBg: '#FFFFFF',
  chipText: '#0F172A',
  controlBg: '#FFFFFF',
  controlBorder: '#E2E8F0',
  controlIcon: '#0F172A',
  bottomNavBg: 'rgba(255, 255, 255, 0.98)',
  navInactive: '#64748B',
  noticeBg: '#FFFBEB',
  noticeBorder: '#FDE68A',
  noticeText: '#B45309',
  verifiedBg: '#DCFCE7',
  verifiedBorder: '#86EFAC',
  verifiedText: '#15803D',
  riskBg: '#FEF3C7',
  riskBorder: '#FCD34D',
  riskText: '#B45309',
  closeBtnBg: '#F1F5F9',
  closeBtnText: '#64748B',
  alertCardBg: '#F8FAFC',
  mapBg: '#E9E2D9',
};

const DARK_THEME = {
  bg: '#0B1120',
  headerBg: '#0B1220',
  surface: '#131C31',
  surfaceElevated: '#1B2642',
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  border: '#263554',
  borderStrong: '#2E4066',
  primary: '#3B82F6',
  primarySurface: 'rgba(59, 130, 246, 0.22)',
  primaryText: '#93C5FD',
  statusBarStyle: 'light-content' as const,
  pillBg: '#1B2642',
  pillText: '#94A3B8',
  localeText: '#F1F5F9',
  searchBg: '#0F172A',
  searchPlaceholder: '#94A3B8',
  filterBtnBg: '#243254',
  filterBtnBorder: '#3B5284',
  filterBtnIcon: '#F8FAFC',
  chipBg: '#131C31',
  chipText: '#CBD5E1',
  controlBg: '#1B2642',
  controlBorder: '#2E4066',
  controlIcon: '#F1F5F9',
  bottomNavBg: 'rgba(19, 28, 49, 0.98)',
  navInactive: '#94A3B8',
  noticeBg: 'rgba(245, 158, 11, 0.14)',
  noticeBorder: 'rgba(245, 158, 11, 0.35)',
  noticeText: '#FCD34D',
  verifiedBg: 'rgba(22, 163, 74, 0.22)',
  verifiedBorder: 'rgba(74, 222, 128, 0.45)',
  verifiedText: '#86EFAC',
  riskBg: 'rgba(245, 158, 11, 0.18)',
  riskBorder: 'rgba(251, 191, 36, 0.45)',
  riskText: '#FCD34D',
  closeBtnBg: '#1B2642',
  closeBtnText: '#F1F5F9',
  alertCardBg: '#1B2642',
  mapBg: '#0B1120',
};

const CATEGORY_META: Record<
  HazardCategory,
  {
    name: string;
    nameBn: string;
    color: string;
    lightColor: string;
    surface: string;
    lightSurface: string;
    svgPath: string;
  }
> = {
  extortion_spot: {
    name: 'ChandaAlert',
    nameBn: 'চাঁদা সতর্কতা',
    color: '#EF4444',
    lightColor: '#B91C1C',
    surface: 'rgba(239, 68, 68, 0.18)',
    lightSurface: '#FEF2F2',
    svgPath:
      '<path d="M8.2 3h7.6L21 8.2v7.6L15.8 21H8.2L3 15.8V8.2L8.2 3Z"/><path d="M12 7.5v5.5"/><circle cx="12" cy="16.2" r="0.9" fill="currentColor"/>',
  },
  unlit_alley: {
    name: 'Dark-Zone Safety',
    nameBn: 'অন্ধকার গলি',
    color: '#A855F7',
    lightColor: '#6D28D9',
    surface: 'rgba(168, 85, 247, 0.18)',
    lightSurface: '#F5F3FF',
    svgPath:
      '<path d="M6 21V6.5a2.5 2.5 0 0 1 2.5-2.5H13"/><path d="M10.5 4h5l1.5 2.5h-8L10.5 4Z"/><path d="M4 21h5"/><path d="M16.5 10.5a3.5 3.5 0 1 0 3.5 4.2 2.8 2.8 0 0 1-3.5-4.2Z"/>',
  },
  waterlogging: {
    name: 'WaterLog',
    nameBn: 'জলাবদ্ধতা',
    color: '#3B82F6',
    lightColor: '#2563EB',
    surface: 'rgba(59, 130, 246, 0.18)',
    lightSurface: '#EFF6FF',
    svgPath:
      '<path d="M12 3.5 9.2 7.2a3.5 3.5 0 1 0 5.6 0L12 3.5Z"/><path d="M2.5 15c1.6 1.4 3.8 1.4 5.4 0 1.6-1.4 3.8-1.4 5.4 0 1.6 1.4 3.8 1.4 5.4 0"/><path d="M2.5 19.5c1.6 1.4 3.8 1.4 5.4 0 1.6-1.4 3.8-1.4 5.4 0 1.6 1.4 3.8 1.4 5.4 0"/>',
  },
  pothole_manhole: {
    name: 'Road Hazard',
    nameBn: 'সড়ক ঝুঁকি',
    color: '#F59E0B',
    lightColor: '#B91C1C',
    surface: 'rgba(245, 158, 11, 0.18)',
    lightSurface: '#FEF2F2',
    svgPath:
      '<path d="M7.5 3.5 3.5 20.5M16.5 3.5l4 17"/><ellipse cx="12" cy="14.5" rx="4.2" ry="2.6"/><path d="M12 4.5v3.5"/>',
  },
  unsafe_footbridge: {
    name: 'Safe Crossing',
    nameBn: 'নিরাপদ পারাপার',
    color: '#FB923C',
    lightColor: '#C2410C',
    surface: 'rgba(249, 115, 22, 0.18)',
    lightSurface: '#FFF7ED',
    svgPath:
      '<circle cx="12.5" cy="4.5" r="1.8"/><path d="M9.5 11.5 11.5 8h2l2 3.5"/><path d="m10.5 16.5 1.5-4.5 2 4.5"/><path d="M3.5 20h3M10.5 20h3M17.5 20h3"/>',
  },
};

const MODULE_ORDER: HazardCategory[] = [
  'extortion_spot',
  'unlit_alley',
  'waterlogging',
  'pothole_manhole',
  'unsafe_footbridge',
];

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

const UI_COPY = {
  en: {
    title: 'GoliSafe',
    city: 'Dhaka',
    searchPlaceholder: 'Search places or hazards',
    mapTab: 'Map',
    alertsTab: 'Alerts',
    reportTab: 'Report',
    nearbyAlerts: 'Nearby Alerts',
    noHazards: 'No matching hazards found in this area.',
    refresh: 'Refresh',
    mapOptions: 'Map options',
    viewMode: 'VIEW MODE',
    display: 'DISPLAY',
    devTools: 'DEVELOPER TOOLS',
  },
  bn: {
    title: 'GoliSafe',
    city: 'ঢাকা',
    searchPlaceholder: 'স্থান বা ঝুঁকি খুঁজুন',
    mapTab: 'মানচিত্র',
    alertsTab: 'সতর্কতা',
    reportTab: 'রিপোর্ট',
    nearbyAlerts: 'নিকটবর্তী সতর্কতা',
    noHazards: 'এই এলাকায় কোনো ঝুঁকি পাওয়া যায়নি।',
    refresh: 'রিফ্রেশ',
    mapOptions: 'মানচিত্র অপশন',
    viewMode: 'ভিউ মোড',
    display: 'ডিসপ্লে',
    devTools: 'ডেভেলপার টুলস',
  },
};

const LEAFLET_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background: #E9E2D9;
    }
    body.night-mode, body.night-mode #map {
      background: #0B1120;
    }
    body.light-mode .leaflet-tile-pane {
      filter: saturate(65%) brightness(92%) contrast(105%);
    }
    body.light-mode.high-contrast .leaflet-tile-pane {
      filter: saturate(85%) brightness(90%) contrast(120%);
    }
    body.night-mode .leaflet-tile-pane {
      filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%);
    }
    body.night-mode.high-contrast .leaflet-tile-pane {
      filter: invert(100%) hue-rotate(180deg) brightness(88%) contrast(115%) saturate(1.15);
    }
    .leaflet-control-attribution {
      background: rgba(255, 255, 255, 0.85) !important;
      color: #64748B !important;
      font-size: 9px !important;
      margin-bottom: 76px !important;
      border-top-left-radius: 6px;
    }
    body.night-mode .leaflet-control-attribution {
      background: rgba(19, 28, 49, 0.85) !important;
      color: #94A3B8 !important;
    }
    .leaflet-control-attribution a {
      color: #2563EB !important;
    }
    body.night-mode .leaflet-control-attribution a {
      color: #60A5FA !important;
    }
    .figma-marker-wrap {
      position: relative;
      width: 48px;
      height: 54px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .figma-marker-geofence {
      position: absolute;
      top: 2px;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      border: 1.5px dashed var(--pin-color);
      background: color-mix(in srgb, var(--pin-color) 16%, transparent);
      pointer-events: none;
    }
    .figma-marker-teardrop {
      position: relative;
      width: 34px;
      height: 34px;
      border-radius: 50% 50% 50% 6px;
      background: var(--pin-color);
      transform: rotate(-45deg);
      box-shadow: 0 5px 10px rgba(15, 23, 42, 0.35);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .figma-marker-core {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #FFFFFF;
      transform: rotate(45deg);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--pin-color);
    }
    body.night-mode .figma-marker-core {
      background: #0F172A;
      border: 1.5px solid rgba(255, 255, 255, 0.88);
    }
    .figma-marker-verified {
      position: absolute;
      top: 0;
      right: 2px;
      z-index: 3;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #15803D;
      border: 1.5px solid #FFFFFF;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #FFFFFF;
    }
    .current-loc-dot {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #2563EB;
      border: 3px solid #FFFFFF;
      box-shadow: 0 0 0 8px rgba(37, 99, 235, 0.25);
    }
  </style>
</head>
<body class="light-mode">
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const CATEGORY_META = ${JSON.stringify(CATEGORY_META)};

    const map = L.map('map', {
      center: [${DHAKA_CENTER.latitude}, ${DHAKA_CENTER.longitude}],
      zoom: 13,
      zoomControl: false,
      attributionControl: true
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    const userDotIcon = L.divIcon({
      className: '',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
      html: '<div class="current-loc-dot"></div>'
    });
    const userMarker = L.marker([${DHAKA_CENTER.latitude}, ${DHAKA_CENTER.longitude}], {
      icon: userDotIcon,
      interactive: false
    }).addTo(map);

    const hazardLayer = L.layerGroup().addTo(map);

    window.setMapTheme = function(isNight, isHighContrast) {
      document.body.classList.toggle('night-mode', !!isNight);
      document.body.classList.toggle('light-mode', !isNight);
      document.body.classList.toggle('high-contrast', !!isHighContrast);
    };

    window.recenterDhaka = function() {
      map.setView([${DHAKA_CENTER.latitude}, ${DHAKA_CENTER.longitude}], 13, { animate: true });
      userMarker.setLatLng([${DHAKA_CENTER.latitude}, ${DHAKA_CENTER.longitude}]);
    };

    window.focusHazard = function(lat, lng) {
      map.setView([lat, lng], 15, { animate: true });
    };

    window.renderHazards = function(hazards) {
      hazardLayer.clearLayers();
      if (!Array.isArray(hazards)) return;

      hazards.forEach(function(h) {
        if (typeof h.latitude !== 'number' || typeof h.longitude !== 'number') return;
        const meta = CATEGORY_META[h.category] || CATEGORY_META.pothole_manhole;
        const color = meta.color;
        const verifiedHtml = h.status === 'crowd_verified'
          ? '<div class="figma-marker-verified"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></div>'
          : '';

        const icon = L.divIcon({
          className: '',
          iconSize: [48, 54],
          iconAnchor: [24, 48],
          html:
            '<div class="figma-marker-wrap" style="--pin-color:' + color + ';">' +
              '<div class="figma-marker-geofence"></div>' +
              '<div class="figma-marker-teardrop">' +
                '<div class="figma-marker-core">' +
                  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                    meta.svgPath +
                  '</svg>' +
                '</div>' +
              '</div>' +
              verifiedHtml +
            '</div>'
        });

        const marker = L.marker([h.latitude, h.longitude], { icon: icon }).addTo(hazardLayer);

        marker.on('click', function() {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'select',
              id: h.id
            }));
          }
        });
      });
    };

    map.on('moveend', function() {
      const c = map.getCenter();
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'region',
          latitude: c.lat,
          longitude: c.lng
        }));
      }
    });
  </script>
</body>
</html>`;

export default function MapScreen() {
  const [hazards, setHazards] = useState<HazardRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [locale, setLocale] = useState<Locale>('en');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterSheetOpen, setFilterSheetOpen] = useState<boolean>(false);
  const [layersModalOpen, setLayersModalOpen] = useState<boolean>(false);
  const [alertsSheetOpen, setAlertsSheetOpen] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [highContrastMap, setHighContrastMap] = useState<boolean>(false);
  const [isNighttime, setIsNighttime] = useState<boolean>(false);
  const [demoMode, setDemoMode] = useState<boolean>(false);
  const [selectedHazardId, setSelectedHazardId] = useState<string | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState<boolean>(false);
  const [reportModalVisible, setReportModalVisible] = useState<boolean>(false);
  const [mapCenter, setMapCenter] = useState(DHAKA_CENTER);
  const [webViewReady, setWebViewReady] = useState<boolean>(false);
  const webViewRef = useRef<WebView>(null);

  const theme = isNighttime ? DARK_THEME : LIGHT_THEME;
  const copy = UI_COPY[locale];

  const loadHazards = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchHazards();
      setHazards(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHazards();
  }, [loadHazards]);

  const handleSubmitHazard = useCallback(async (payload: CreateHazardRequest) => {
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
    setReportModalVisible(false);
    Alert.alert(
      'Hazard Reported',
      'Thank you! Your hazard report is now visible on the Dhaka safety map.',
    );
  }, []);

  const filteredHazards = useMemo(() => {
    let list = hazards;

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

    const q = searchQuery.trim().toLowerCase();
    if (q.length > 0) {
      list = list.filter((h) => {
        const meta = CATEGORY_META[h.category];
        return (
          (h.landmark_context || '').toLowerCase().includes(q) ||
          (h.sub_tag || '').toLowerCase().includes(q) ||
          meta.name.toLowerCase().includes(q) ||
          h.severity.toLowerCase().includes(q)
        );
      });
    }

    return list;
  }, [hazards, viewMode, categoryFilter, searchQuery]);

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
    webViewRef.current.injectJavaScript(
      `window.setMapTheme && window.setMapTheme(${isNighttime}, ${highContrastMap}); true;`,
    );
  }, [isNighttime, highContrastMap, webViewReady]);

  const handleWebViewMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (
        msg?.type === 'region' &&
        typeof msg.latitude === 'number' &&
        typeof msg.longitude === 'number'
      ) {
        setMapCenter({ latitude: msg.latitude, longitude: msg.longitude });
      } else if (msg?.type === 'select' && typeof msg.id === 'string') {
        setSelectedHazardId(msg.id);
      }
    } catch {
      // Ignore malformed messages
    }
  }, []);

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

  const handleResetFilters = () => {
    setViewMode('all');
    setCategoryFilter('all');
    setSearchQuery('');
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
                {copy.city}
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
            placeholder={copy.searchPlaceholder}
            placeholderTextColor={theme.searchPlaceholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.trim().length > 0 && (
            <TouchableOpacity
              style={styles.searchClearBtn}
              onPress={() => setSearchQuery('')}
              activeOpacity={0.8}
            >
              <Text
                style={[styles.searchClearText, { color: theme.textSecondary }]}
              >
                Clear
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
              (filterSheetOpen || hasActiveFilter) && {
                borderColor: theme.primary,
                backgroundColor: theme.primarySurface,
              },
            ]}
            onPress={() => {
              setLayersModalOpen(false);
              setFilterSheetOpen((v) => !v);
            }}
            activeOpacity={0.8}
          >
            <Ionicons
              name="options-outline"
              size={18}
              color={
                filterSheetOpen || hasActiveFilter
                  ? theme.primaryText
                  : theme.filterBtnIcon
              }
            />
          </TouchableOpacity>
        </View>

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
                  {locale === 'bn' ? meta.nameBn : meta.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Optional Quick Filter Bar when Filter icon is toggled */}
        {filterSheetOpen && (
          <View
            style={[
              styles.inlineFilterCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <View style={styles.inlineFilterHeader}>
              <Text style={[styles.inlineFilterTitle, { color: theme.text }]}>
                Quick Filters
              </Text>
              <View style={styles.inlineFilterActions}>
                {hasActiveFilter && (
                  <TouchableOpacity onPress={handleResetFilters}>
                    <Text style={[styles.resetLink, { color: theme.primary }]}>
                      Reset
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setFilterSheetOpen(false)}>
                  <Text
                    style={[styles.closeX, { color: theme.textSecondary }]}
                  >
                    ×
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.inlineModePills}>
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
                      styles.modeChip,
                      {
                        backgroundColor: theme.surfaceElevated,
                        borderColor: theme.borderStrong,
                      },
                      active && {
                        borderColor: theme.primary,
                        backgroundColor: theme.primarySurface,
                      },
                    ]}
                    onPress={() => setViewMode(mode.id)}
                  >
                    <Text
                      style={[
                        styles.modeChipText,
                        { color: theme.textSecondary },
                        active && { color: theme.primaryText },
                      ]}
                    >
                      {mode.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </View>

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
            (layersModalOpen || highContrastMap || viewMode !== 'all') && {
              borderColor: theme.primary,
              backgroundColor: theme.primarySurface,
            },
          ]}
          onPress={() => {
            setFilterSheetOpen(false);
            setLayersModalOpen((v) => !v);
          }}
          activeOpacity={0.8}
        >
          <Ionicons
            name="layers-outline"
            size={19}
            color={
              layersModalOpen || highContrastMap || viewMode !== 'all'
                ? theme.primaryText
                : theme.controlIcon
            }
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

      {/* Selected Hazard Bottom Card (Figma .selected-marker-card) */}
      {selectedHazard && (() => {
        const meta = CATEGORY_META[selectedHazard.category];
        const accent = isNighttime ? meta?.color : meta?.lightColor;
        const riskLabel =
          selectedHazard.severity === 'Critical'
            ? 'High risk'
            : selectedHazard.severity === 'Medium'
              ? 'Moderate risk'
              : 'Low risk';
        const confirmationsText =
          selectedHazard.status === 'crowd_verified'
            ? '3 confirmations'
            : '1 confirmation';

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
                {selectedHazard.status === 'crowd_verified' && (
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
                      Crowd-Verified
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
                  onPress={() => setSelectedHazardId(null)}
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
              {copy.city} · Reported recently · {confirmationsText}
            </Text>

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
                style={[styles.distanceNoticeText, { color: theme.noticeText }]}
              >
                Within 150m required to vote (180m away)
              </Text>
            </View>

            <TouchableOpacity
              style={styles.viewDetailsBtn}
              onPress={() => setDetailModalVisible(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.viewDetailsBtnText}>View details</Text>
            </TouchableOpacity>
          </View>
        );
      })()}

      {/* Hazard Full Details & Confirm Modal */}
      <Modal
        visible={detailModalVisible && Boolean(selectedHazard)}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailModalVisible(false)}
      >
        {selectedHazard && (() => {
          const meta = CATEGORY_META[selectedHazard.category];
          const accent = isNighttime ? meta?.color : meta?.lightColor;
          return (
            <View style={styles.alertsBackdrop}>
              <View
                style={[
                  styles.detailSheet,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.alertsHeader,
                    { borderBottomColor: theme.border },
                  ]}
                >
                  <View style={styles.selectedCategoryRow}>
                    <HazardCategoryIcon
                      category={selectedHazard.category}
                      color={accent || '#EF4444'}
                      size={18}
                    />
                    <Text
                      style={[
                        styles.detailCategoryTitle,
                        { color: accent || theme.text },
                      ]}
                    >
                      {locale === 'bn' ? meta?.nameBn : meta?.name}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.layersCloseBtn,
                      {
                        backgroundColor: theme.closeBtnBg,
                        borderColor: theme.borderStrong,
                      },
                    ]}
                    onPress={() => setDetailModalVisible(false)}
                  >
                    <Text
                      style={[
                        styles.layersCloseText,
                        { color: theme.closeBtnText },
                      ]}
                    >
                      ×
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.detailBody}>
                  <Text style={[styles.detailTitle, { color: theme.text }]}>
                    {selectedHazard.landmark_context || meta?.name}
                  </Text>
                  <Text
                    style={[styles.detailMeta, { color: theme.textSecondary }]}
                  >
                    Severity: {selectedHazard.severity} · Status:{' '}
                    {selectedHazard.status}
                  </Text>
                  {selectedHazard.sub_tag ? (
                    <View style={styles.detailSubtagBadge}>
                      <Text style={styles.detailSubtagText}>
                        {selectedHazard.sub_tag}
                      </Text>
                    </View>
                  ) : null}
                  <Text
                    style={[
                      styles.detailCoords,
                      { color: theme.textSecondary },
                    ]}
                  >
                    Coordinates: {selectedHazard.latitude.toFixed(5)},{' '}
                    {selectedHazard.longitude.toFixed(5)}
                  </Text>
                  <Text
                    style={[styles.detailDescription, { color: theme.text }]}
                  >
                    Community-reported urban safety hazard in Dhaka. Exercise
                    caution when passing through this zone, especially after dark.
                  </Text>

                  <TouchableOpacity
                    style={styles.confirmHazardBtn}
                    onPress={() => {
                      setHazards((prev) =>
                        prev.map((h) =>
                          h.id === selectedHazard.id
                            ? { ...h, status: 'crowd_verified' }
                            : h,
                        ),
                      );
                      setDetailModalVisible(false);
                      Alert.alert(
                        'Confirmed',
                        'Thank you for verifying this hazard report.',
                      );
                    }}
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={18}
                      color="#FFFFFF"
                    />
                    <Text style={styles.confirmHazardBtnText}>
                      Still There · Confirm Hazard
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })()}
      </Modal>

      {/* Nearby Alerts Sheet Modal */}
      <Modal
        visible={alertsSheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setAlertsSheetOpen(false)}
      >
        <View style={styles.alertsBackdrop}>
          <View
            style={[
              styles.alertsSheet,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <View
              style={[styles.alertsHeader, { borderBottomColor: theme.border }]}
            >
              <Text style={[styles.alertsTitle, { color: theme.text }]}>
                {copy.nearbyAlerts} ({filteredHazards.length})
              </Text>
              <View style={styles.alertsHeaderActions}>
                <TouchableOpacity
                  style={[
                    styles.alertsRefreshBtn,
                    {
                      borderColor: theme.primary,
                      backgroundColor: theme.primarySurface,
                    },
                  ]}
                  onPress={loadHazards}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color={theme.primaryText} />
                  ) : (
                    <Text
                      style={[
                        styles.alertsRefreshText,
                        { color: theme.primaryText },
                      ]}
                    >
                      {copy.refresh}
                    </Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.layersCloseBtn,
                    {
                      backgroundColor: theme.closeBtnBg,
                      borderColor: theme.borderStrong,
                    },
                  ]}
                  onPress={() => setAlertsSheetOpen(false)}
                >
                  <Text
                    style={[
                      styles.layersCloseText,
                      { color: theme.closeBtnText },
                    ]}
                  >
                    ×
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <FlatList
              data={filteredHazards}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.alertsList}
              ListEmptyComponent={
                <Text
                  style={[
                    styles.emptyAlertsText,
                    { color: theme.textSecondary },
                  ]}
                >
                  {copy.noHazards}
                </Text>
              }
              renderItem={({ item }) => {
                const meta = CATEGORY_META[item.category];
                const accent = isNighttime ? meta.color : meta.lightColor;
                return (
                  <TouchableOpacity
                    style={[
                      styles.alertCard,
                      {
                        backgroundColor: theme.alertCardBg,
                        borderColor: theme.border,
                      },
                    ]}
                    onPress={() => {
                      setAlertsSheetOpen(false);
                      setSelectedHazardId(item.id);
                      webViewRef.current?.injectJavaScript(
                        `window.focusHazard && window.focusHazard(${item.latitude}, ${item.longitude}); true;`,
                      );
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={styles.alertCardTop}>
                      <View style={styles.selectedCategoryRow}>
                        <HazardCategoryIcon
                          category={item.category}
                          color={accent}
                          size={14}
                        />
                        <Text
                          style={[styles.alertCardCategory, { color: accent }]}
                        >
                          {locale === 'bn' ? meta.nameBn : meta.name}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.riskPill,
                          {
                            backgroundColor: theme.riskBg,
                            borderColor: theme.riskBorder,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.riskPillText,
                            { color: theme.riskText },
                          ]}
                        >
                          {item.severity}
                        </Text>
                      </View>
                    </View>
                    <Text
                      style={[styles.alertCardTitle, { color: theme.text }]}
                      numberOfLines={1}
                    >
                      {item.landmark_context || meta.name}
                    </Text>
                    <Text
                      style={[
                        styles.alertCardSub,
                        { color: theme.textSecondary },
                      ]}
                    >
                      {item.status} • {item.latitude.toFixed(4)},{' '}
                      {item.longitude.toFixed(4)}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>

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
            {copy.mapTab}
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
            {copy.alertsTab}
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
            {copy.reportTab}
          </Text>
        </TouchableOpacity>
      </View>

      <QuickReportModal
        visible={reportModalVisible}
        currentLocation={mapCenter}
        onClose={() => setReportModalVisible(false)}
        onSubmitHazard={handleSubmitHazard}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  headerPanel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    borderBottomWidth: 1,
    paddingHorizontal: 14,
    paddingBottom: 10,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  appHeader: {
    flexDirection: 'row',
    height: 28,
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  appTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  demoBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(245, 158, 11, 0.22)',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  demoBadgeText: {
    color: '#D97706',
    fontSize: 10,
    fontWeight: '700',
  },
  localePill: {
    height: 24,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  localePillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  locationPill: {
    height: 24,
    minWidth: 64,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationText: {
    fontSize: 12,
    fontWeight: '500',
  },
  searchBar: {
    flexDirection: 'row',
    height: 44,
    alignItems: 'center',
    gap: 8,
    paddingLeft: 14,
    paddingRight: 4,
    borderRadius: 14,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 6,
  },
  searchClearBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  searchClearText: {
    fontSize: 11,
    fontWeight: '600',
  },
  searchFilterBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
  },
  modulePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingLeft: 6,
    paddingRight: 11,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  moduleIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modulePillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  inlineFilterCard: {
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  inlineFilterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inlineFilterTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  inlineFilterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  resetLink: {
    fontSize: 11,
    fontWeight: '600',
  },
  closeX: {
    fontSize: 18,
    lineHeight: 18,
    fontWeight: '600',
  },
  inlineModePills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  modeChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  modeChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  mapControls: {
    position: 'absolute',
    right: 12,
    gap: 8,
  },
  mapControlBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 6,
    elevation: 4,
  },
  popoverBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.38)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingRight: 60,
  },
  layersCard: {
    width: 230,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 12,
    gap: 6,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  layersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  layersTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  layersCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  layersCloseText: {
    fontSize: 16,
    lineHeight: 18,
    fontWeight: '600',
  },
  layersSectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: 4,
  },
  layersOption: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 9,
    borderWidth: 1,
  },
  layersOptionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  selectedCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 84,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
  },
  selectedCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  selectedCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  selectedCategoryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  selectedBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selectedCloseBtn: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedCloseText: {
    fontSize: 16,
    lineHeight: 18,
    fontWeight: '600',
  },
  selectedTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  selectedMeta: {
    fontSize: 11.5,
  },
  verifiedPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  verifiedPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  riskPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  riskPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  distanceNoticeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  distanceNoticeText: {
    fontSize: 11.5,
    fontWeight: '600',
    flex: 1,
  },
  viewDetailsBtn: {
    marginTop: 6,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewDetailsBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  detailSheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1.5,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 28,
  },
  detailCategoryTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  detailBody: {
    paddingTop: 14,
    gap: 8,
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  detailMeta: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  detailSubtagBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(249, 115, 22, 0.18)',
    borderWidth: 1,
    borderColor: '#FB923C',
  },
  detailSubtagText: {
    color: '#EA580C',
    fontSize: 11.5,
    fontWeight: '600',
  },
  detailCoords: {
    fontSize: 11.5,
  },
  detailDescription: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
  confirmHazardBtn: {
    marginTop: 10,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  confirmHazardBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  alertsBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  alertsSheet: {
    maxHeight: '76%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1.5,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
  },
  alertsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  alertsTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  alertsHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  alertsRefreshBtn: {
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertsRefreshText: {
    fontSize: 11,
    fontWeight: '600',
  },
  alertsList: {
    paddingTop: 12,
    gap: 10,
  },
  emptyAlertsText: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 24,
  },
  alertCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  alertCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  alertCardCategory: {
    fontSize: 11,
    fontWeight: '700',
  },
  alertCardTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  alertCardSub: {
    fontSize: 11,
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
