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
}

export interface DistrictProperties {
  id: string;
  name: string;
  center: [number, number];
  primaryGroups: string[];
  keyStreets: string[];
}

export interface ZoneProperties {
  id: string;
  name: string;
  districtId: string;
  districtName: string;
  group: string;
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
}

export interface SelectedFeature {
  type: 'district' | 'zone' | 'street';
  id: string;
  name: string;
  districtName?: string;
  cityName?: string;
  group?: string;
  groups?: string[];
  streets?: string[];
  center?: [number, number];
  buildings?: string;
}

export interface SavedLocation {
  id: string;
  customLabel?: string;
  feature: SelectedFeature;
  createdAt: number;
}
