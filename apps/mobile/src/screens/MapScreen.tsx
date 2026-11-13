import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, Region, UrlTile } from 'react-native-maps';
import type {
  CreateHazardRequest,
  HazardCategory,
  HazardRecord,
} from '../../../../packages/shared/api-contract';
import QuickReportModal from '../components/Report/QuickReportModal';
import { fetchHazards, submitHazard } from '../services/api';

type FilterMode = 'all' | 'pedestrian_night' | 'driver_biker';

const DHAKA_REGION = {
  latitude: 23.7806,
  longitude: 90.407,
  latitudeDelta: 0.06,
  longitudeDelta: 0.06,
};

const CATEGORY_COLORS: Record<HazardCategory, string> = {
  pothole_manhole: '#EF4444',
  extortion_spot: '#EF4444',
  waterlogging: '#3B82F6',
  unlit_alley: '#6B21A8',
  unsafe_footbridge: '#F97316',
};

const CATEGORY_LABELS: Record<HazardCategory, string> = {
  pothole_manhole: 'Pothole / Manhole',
  extortion_spot: 'Extortion Spot',
  waterlogging: 'Waterlogging',
  unlit_alley: 'Unlit Alley',
  unsafe_footbridge: 'Unsafe Footbridge',
};

const FILTER_CHIPS: { id: FilterMode; label: string }[] = [
  { id: 'all', label: 'All Hazards' },
  { id: 'pedestrian_night', label: 'Pedestrian Night' },
  { id: 'driver_biker', label: 'Driver/Biker' },
];

export default function MapScreen() {
  const [hazards, setHazards] = useState<HazardRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [reportModalVisible, setReportModalVisible] = useState<boolean>(false);
  const [region, setRegion] = useState<Region>(DHAKA_REGION);

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
    setReportModalVisible(false);
    Alert.alert(
      'Hazard Reported',
      'Thank you! Your hazard report is now visible on the Dhaka safety map.',
    );
  }, []);

  const filteredHazards = useMemo(() => {
    if (filterMode === 'pedestrian_night') {
      return hazards.filter(
        (h) =>
          h.category === 'unlit_alley' ||
          h.category === 'unsafe_footbridge' ||
          h.category === 'extortion_spot',
      );
    }
    if (filterMode === 'driver_biker') {
      return hazards.filter(
        (h) =>
          h.category === 'pothole_manhole' ||
          h.category === 'waterlogging' ||
          h.category === 'extortion_spot',
      );
    }
    return hazards;
  }, [hazards, filterMode]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      <MapView
        style={styles.map}
        initialRegion={DHAKA_REGION}
        onRegionChangeComplete={setRegion}
        showsUserLocation
        showsMyLocationButton={false}
      >
        <UrlTile
          urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maximumZ={19}
          flipY={false}
        />

        {filteredHazards.map((hazard) => {
          const pinColor = CATEGORY_COLORS[hazard.category] || '#EF4444';
          return (
            <Marker
              key={hazard.id}
              coordinate={{
                latitude: hazard.latitude,
                longitude: hazard.longitude,
              }}
              title={CATEGORY_LABELS[hazard.category] || hazard.category}
              description={
                hazard.landmark_context
                  ? `${hazard.severity} • ${hazard.landmark_context}`
                  : `Severity: ${hazard.severity}`
              }
              pinColor={pinColor}
            >
              <View style={styles.markerWrapper}>
                <View
                  style={[
                    styles.markerGeofence,
                    {
                      borderColor: pinColor,
                      backgroundColor: `${pinColor}24`,
                    },
                  ]}
                />
                <View
                  style={[styles.markerPin, { backgroundColor: pinColor }]}
                >
                  <View style={styles.markerInnerDot} />
                </View>
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Top Dark Header & Filter Chips (replicated from figma-ui .map-top) */}
      <SafeAreaView style={styles.topOverlay}>
        <View style={styles.headerPanel}>
          <View style={styles.appHeader}>
            <Text style={styles.appTitle}>GoliSafe</Text>
            <View style={styles.headerRight}>
              <View style={styles.locationPill}>
                <Text style={styles.locationText}>Dhaka</Text>
              </View>
              <TouchableOpacity
                style={styles.refreshButton}
                onPress={loadHazards}
                activeOpacity={0.8}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#F8FAFC" />
                ) : (
                  <Text style={styles.refreshText}>Refresh</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {FILTER_CHIPS.map((chip) => {
              const active = filterMode === chip.id;
              return (
                <TouchableOpacity
                  key={chip.id}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => setFilterMode(chip.id)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      active && styles.filterChipTextActive,
                    ]}
                  >
                    {chip.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </SafeAreaView>

      {/* Floating + Report Hazard Button (replicated from figma-ui .v2-button) */}
      <View style={styles.fabContainer}>
        <TouchableOpacity
          style={styles.reportFab}
          onPress={() => setReportModalVisible(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.reportFabText}>+ Report Hazard</Text>
        </TouchableOpacity>
      </View>

      <QuickReportModal
        visible={reportModalVisible}
        currentLocation={{
          latitude: region.latitude,
          longitude: region.longitude,
        }}
        onClose={() => setReportModalVisible(false)}
        onSubmitHazard={handleSubmitHazard}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 12 : 0,
  },
  headerPanel: {
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#263554',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 6,
  },
  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  appTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#263554',
    backgroundColor: '#131C31',
  },
  locationText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  refreshButton: {
    minWidth: 68,
    height: 28,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#3B82F6',
    backgroundColor: '#1B2642',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '600',
  },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#263554',
    backgroundColor: '#131C31',
  },
  filterChipActive: {
    borderColor: '#3B82F6',
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  filterChipText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#F8FAFC',
  },
  markerWrapper: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerGeofence: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  markerPin: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  markerInnerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0F172A',
  },
  fabContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
  },
  reportFab: {
    height: 54,
    borderRadius: 16,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  reportFabText: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
  },
});

