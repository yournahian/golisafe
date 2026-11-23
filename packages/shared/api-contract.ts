export type HazardCategory =
  | 'pothole_manhole'
  | 'waterlogging'
  | 'unlit_alley'
  | 'unsafe_footbridge'
  | 'extortion_spot';

export type HazardSeverity = 'Low' | 'Medium' | 'Critical';

export interface HazardRecord {
  id: string;
  category: HazardCategory;
  severity: HazardSeverity;
  latitude: number;
  longitude: number;
  landmark_context?: string;
  sub_tag?: string;
  status: 'active' | 'pending' | 'verified' | 'crowd_verified' | 'resolved' | 'expired';
  confirmations?: number;
  resolved_count?: number;
  expires_at?: string;
  image_url?: string | null;
  reported_by?: string | null;
  created_at: string;
}

export interface CreateHazardRequest {
  category: HazardCategory;
  severity?: HazardSeverity;
  latitude: number;
  longitude: number;
  landmark_context?: string;
  sub_tag?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  display_name?: string;
  trust_score: number;
  reports_count: number;
  is_trusted: boolean;
  created_at?: string;
}

export interface SafeRouteOption {
  id: string;
  label: 'Safest Route' | 'Fastest Route';
  distanceMeters: number;
  durationSeconds: number;
  riskScore: number;
  hazardsNearRoute: number;
  coordinates: Array<[number, number]>;
}

