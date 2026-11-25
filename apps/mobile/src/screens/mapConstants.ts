import type {
  HazardCategory,
  HazardRecord,
} from '../../../../packages/shared/api-contract';

export const DHAKA_CENTER = {
  latitude: 23.7806,
  longitude: 90.407,
};

export const DHAKA_STREETS: Array<{
  label: string;
  latitude: number;
  longitude: number;
}> = [
  { label: 'Banasree Main Canal Road', latitude: 23.7639, longitude: 90.4314 },
  { label: 'Mohakhali Flyover Underpass', latitude: 23.7778, longitude: 90.4057 },
  { label: 'Banani Road 11 Bridge', latitude: 23.7937, longitude: 90.4066 },
  { label: 'Baridhara J-Block Link Road', latitude: 23.8035, longitude: 90.4227 },
  { label: 'Gulshan-2 Circle Avenue', latitude: 23.7947, longitude: 90.4143 },
  { label: 'Farmgate Footbridge Crossing', latitude: 23.7574, longitude: 90.3892 },
  { label: 'Karwan Bazar Kazi Nazrul Ave', latitude: 23.7516, longitude: 90.3929 },
  { label: 'Dhanmondi 27 Mirpur Road', latitude: 23.7548, longitude: 90.3761 },
  { label: 'Shahbagh Intersection', latitude: 23.7389, longitude: 90.3958 },
  { label: 'Malibagh Railgate Crossing', latitude: 23.7495, longitude: 90.4128 },
  { label: 'Rampura TV Center Road', latitude: 23.7652, longitude: 90.4221 },
  { label: 'Mirpur 10 Roundabout', latitude: 23.8069, longitude: 90.3687 },
  { label: 'Uttara Sector 7 Jasimuddin Ave', latitude: 23.8615, longitude: 90.4002 },
  { label: 'Motijheel Shapla Chattar', latitude: 23.7298, longitude: 90.4176 },
  { label: 'Jatrabari Flyover Entry', latitude: 23.7104, longitude: 90.4348 },
];

export interface CrossingSafetyMarker {
  id: string;
  name: string;
  type: 'zebra_crossing' | 'footbridge';
  status: 'safe' | 'unsafe';
  badgeLabel: 'Safe Crossing' | 'Unsafe Footbridge';
  latitude: number;
  longitude: number;
  note: string;
}

// FR-17: Key Dhaka intersection footbridge vs zebra crossing safety indicators
export const DHAKA_CROSSINGS: CrossingSafetyMarker[] = [
  {
    id: 'crossing-farmgate-zebra',
    name: 'Farmgate East Zebra Crossing',
    type: 'zebra_crossing',
    status: 'safe',
    badgeLabel: 'Safe Crossing',
    latitude: 23.7568,
    longitude: 90.3895,
    note: 'Signalized zebra crossing — safer alternative to unlit footbridge',
  },
  {
    id: 'crossing-shahbagh-zebra',
    name: 'Shahbagh Intersection Zebra Crossing',
    type: 'zebra_crossing',
    status: 'safe',
    badgeLabel: 'Safe Crossing',
    latitude: 23.7385,
    longitude: 90.3955,
    note: 'Police-monitored pedestrian crossing with bright street lighting',
  },
  {
    id: 'crossing-sciencelab-bridge',
    name: 'Science Lab Lit Footbridge',
    type: 'footbridge',
    status: 'safe',
    badgeLabel: 'Safe Crossing',
    latitude: 23.7393,
    longitude: 90.3834,
    note: 'LED-lit footbridge with active pedestrian flow and CCTV',
  },
  {
    id: 'crossing-banani-zebra',
    name: 'Banani Road 11 Zebra Crossing',
    type: 'zebra_crossing',
    status: 'safe',
    badgeLabel: 'Safe Crossing',
    latitude: 23.7932,
    longitude: 90.4063,
    note: 'Traffic-controlled surface crossing near Kakoli',
  },
  {
    id: 'crossing-newmarket-bridge',
    name: 'New Market Footbridge',
    type: 'footbridge',
    status: 'unsafe',
    badgeLabel: 'Unsafe Footbridge',
    latitude: 23.7336,
    longitude: 90.3842,
    note: 'Hawker congestion and dim stairwell lighting after 8 PM',
  },
];

export const DHAKA_SEED_HAZARDS: HazardRecord[] = [
  {
    id: 'seed-banani-crossing',
    category: 'unsafe_footbridge',
    severity: 'Medium',
    latitude: 23.7945,
    longitude: 90.4042,
    landmark_context: 'Banani Chairman Bari Footbridge',
    sub_tag: 'No Streetlights on Bridge',
    status: 'active',
    confirmations: 2,
    created_at: '2026-11-15T18:10:00.000Z',
  },
  {
    id: 'seed-mohakhali-dark',
    category: 'unlit_alley',
    severity: 'Medium',
    latitude: 23.7798,
    longitude: 90.3982,
    landmark_context: 'Mohakhali Wireless Gate Lane',
    sub_tag: 'Broken streetlights along 150m stretch',
    status: 'active',
    confirmations: 2,
    created_at: '2026-11-15T18:20:00.000Z',
  },
  {
    id: 'seed-baridhara-water',
    category: 'waterlogging',
    severity: 'Critical',
    latitude: 23.7824,
    longitude: 90.4215,
    landmark_context: 'Badda-Baridhara Link Canal Road',
    sub_tag: 'Knee-deep water (Engine stall risk)',
    status: 'active',
    confirmations: 2,
    created_at: '2026-11-15T18:30:00.000Z',
  },
  {
    id: 'seed-tejgaon-dark',
    category: 'unlit_alley',
    severity: 'Critical',
    latitude: 23.7662,
    longitude: 90.3915,
    landmark_context: 'Tejgaon Station Feeder Alley',
    sub_tag: 'Complete blackout after 8PM',
    status: 'active',
    confirmations: 2,
    created_at: '2026-11-15T18:40:00.000Z',
  },
  {
    id: 'seed-farmgate-crossing',
    category: 'unsafe_footbridge',
    severity: 'Critical',
    latitude: 23.7582,
    longitude: 90.3905,
    landmark_context: 'Farmgate Ananda Cinema Footbridge',
    sub_tag: 'Occupied by Addicts/Snatchers at Night',
    status: 'crowd_verified',
    confirmations: 5,
    created_at: '2026-11-15T18:45:00.000Z',
  },
  {
    id: 'seed-dhanmondi-pothole',
    category: 'pothole_manhole',
    severity: 'Critical',
    latitude: 23.7575,
    longitude: 90.3768,
    landmark_context: 'Dhanmondi 27 Mirpur Road Junction',
    sub_tag: 'Uncovered WASA Manhole',
    status: 'crowd_verified',
    confirmations: 6,
    created_at: '2026-11-15T19:00:00.000Z',
  },
  {
    id: 'seed-shahbagh-chanda',
    category: 'extortion_spot',
    severity: 'Critical',
    latitude: 23.7418,
    longitude: 90.3942,
    landmark_context: 'Kawran Bazar-Shahbagh Cargo Stand',
    sub_tag: 'Forced toll collection from delivery vans',
    status: 'active',
    confirmations: 2,
    created_at: '2026-11-15T19:15:00.000Z',
  },
  {
    id: 'seed-malibagh-pothole',
    category: 'pothole_manhole',
    severity: 'Medium',
    latitude: 23.7368,
    longitude: 90.4138,
    landmark_context: 'Malibagh-Shantinagar Flyover Ramp',
    sub_tag: 'Deep crater across left lane',
    status: 'active',
    confirmations: 2,
    created_at: '2026-11-15T19:30:00.000Z',
  },
  {
    id: 'seed-banasree-water',
    category: 'waterlogging',
    severity: 'Medium',
    latitude: 23.7635,
    longitude: 90.4312,
    landmark_context: 'Banasree Block-C Main Canal Road',
    sub_tag: 'Ankle-deep drainage overflow',
    status: 'crowd_verified',
    confirmations: 4,
    created_at: '2026-11-15T19:45:00.000Z',
  },
  {
    id: 'seed-gulshan-dark',
    category: 'unlit_alley',
    severity: 'Medium',
    latitude: 23.7985,
    longitude: 90.4152,
    landmark_context: 'Gulshan-2 Road 54 Pocket Lane',
    sub_tag: 'Unlit side lane near lake walk',
    status: 'crowd_verified',
    confirmations: 3,
    created_at: '2026-11-15T20:00:00.000Z',
  },
  {
    id: 'seed-mirpur-pothole',
    category: 'pothole_manhole',
    severity: 'Critical',
    latitude: 23.8065,
    longitude: 90.3692,
    landmark_context: 'Mirpur 10 Metro Pillar 252 Lane',
    sub_tag: 'Broken slab over open drain',
    status: 'crowd_verified',
    confirmations: 4,
    created_at: '2026-11-15T20:10:00.000Z',
  },
  {
    id: 'seed-uttara-crossing',
    category: 'unsafe_footbridge',
    severity: 'Medium',
    latitude: 23.8602,
    longitude: 90.4005,
    landmark_context: 'Uttara Jasimuddin Footbridge',
    sub_tag: 'Broken Railing / Steep Steps',
    status: 'active',
    confirmations: 2,
    created_at: '2026-11-15T20:20:00.000Z',
  },
  {
    id: 'seed-jatrabari-chanda',
    category: 'extortion_spot',
    severity: 'Critical',
    latitude: 23.7115,
    longitude: 90.4352,
    landmark_context: 'Jatrabari Wholesale Terminal Gate',
    sub_tag: 'Illegal night syndicate toll',
    status: 'crowd_verified',
    confirmations: 5,
    created_at: '2026-11-15T20:30:00.000Z',
  },
];

export const LIGHT_THEME = {
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
  bottomNavBg: '#FFFFFF',
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
  mapBg: '#E9E2D9',
};

export const DARK_THEME = {
  bg: '#0B1120',
  headerBg: '#161D2C',
  surface: '#161D2C',
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
  bottomNavBg: '#161D2C',
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
  mapBg: '#0B1120',
};

export const CATEGORY_META: Record<
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

export const MODULE_ORDER: HazardCategory[] = [
  'extortion_spot',
  'unlit_alley',
  'waterlogging',
  'pothole_manhole',
  'unsafe_footbridge',
];

export const UI_COPY = {
  en: {
    title: 'GoliSafe',
    mapOptions: 'Map options',
    viewMode: 'VIEW MODE',
    display: 'DISPLAY',
    devTools: 'DEVELOPER TOOLS',
  },
  bn: {
    title: 'GoliSafe',
    mapOptions: 'মানচিত্র অপশন',
    viewMode: 'ভিউ মোড',
    display: 'ডিসপ্লে',
    devTools: 'ডেভেলপার টুলস',
  },
};
