export type LayerMode = 'auto' | 'districts' | 'zones' | 'streets';

export type PowerStatus = 'on' | 'off' | 'maybe';

export interface OutageInterval {
  start: string;
  end: string;
  s: number;
  e: number;
}

export interface GroupSchedule {
  desc: string;
  intervals: OutageInterval[];
  hourly: PowerStatus[];
}

export interface ScheduleData {
  date: string;
  title: string;
  updatedAt: string;
  groups: Record<string, GroupSchedule>;
  isLive?: boolean;
  fetchedAt?: string;
}

export interface QueueBreakdownItem {
  group: string;
  count: number;
  percentage: number;
  streets: string[];
}

export interface DistrictProperties {
  id: string;
  name: string;
  center: [number, number];
  dominantGroup?: string;
  primaryGroups: string[];
  queueBreakdown?: QueueBreakdownItem[];
  keyStreets: string[];
}

export interface ZoneProperties {
  id: string;
  name: string;
  districtId: string;
  districtName: string;
  group: string;
  groups?: string[];
  queueBreakdown?: QueueBreakdownItem[];
  streets: string[];
  center: [number, number];
}

export interface StreetItem {
  id: string;
  name: string;
  district: string;
  group: string;
  lat: number;
  lon: number;
  buildings: string;
  cityId?: number;
  cityName?: string;
  polyline?: [number, number][][];
}

export interface SelectedFeature {
  type: 'district' | 'zone' | 'street';
  id: string;
  name: string;
  districtName?: string;
  cityName?: string;
  group?: string;
  groups?: string[];
  dominantGroup?: string;
  queueBreakdown?: QueueBreakdownItem[];
  streets?: string[];
  center?: [number, number];
  buildings?: string;
  polyline?: [number, number][][];
}

export interface SavedLocation {
  id: string;
  customLabel?: string;
  feature: SelectedFeature;
  createdAt: number;
}
