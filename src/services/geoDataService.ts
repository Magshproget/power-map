import { useEffect, useState } from 'react';
import { DistrictProperties, StreetItem, ZoneProperties } from '../types';

export interface GeoFeature<P> {
  type: 'Feature';
  id: string;
  properties: P;
  geometry: {
    type: string;
    coordinates: any;
  };
}

export interface GeoFeatureCollection<P> {
  type: 'FeatureCollection';
  features: GeoFeature<P>[];
}

export type DistrictsGeoJson = GeoFeatureCollection<DistrictProperties>;
export type ZonesGeoJson = GeoFeatureCollection<ZoneProperties>;

let districtsCache: DistrictsGeoJson | null = null;
let zonesCache: ZonesGeoJson | null = null;
let streetsCache: StreetItem[] | null = null;

let mapGeoPromise: Promise<{ districts: DistrictsGeoJson; zones: ZonesGeoJson }> | null = null;
let streetsPromise: Promise<StreetItem[]> | null = null;

function deduplicateZoneGeometries(
  districts: DistrictsGeoJson,
  zones: ZonesGeoJson
): ZonesGeoJson {
  const districtGeomById = new Map<string, GeoFeature<DistrictProperties>['geometry']>();
  for (const df of districts.features) {
    if (df.id && df.geometry) {
      districtGeomById.set(df.id, df.geometry);
    }
  }

  const sharedFeatures = zones.features.map((zf) => {
    const sharedGeom = districtGeomById.get(zf.properties.districtId);
    return sharedGeom ? { ...zf, geometry: sharedGeom } : zf;
  });

  return {
    type: 'FeatureCollection',
    features: sharedFeatures,
  };
}

export function loadMapGeoData(): Promise<{ districts: DistrictsGeoJson; zones: ZonesGeoJson }> {
  if (districtsCache && zonesCache) {
    return Promise.resolve({ districts: districtsCache, zones: zonesCache });
  }
  if (!mapGeoPromise) {
    mapGeoPromise = Promise.all([
      import('../data/districts.json'),
      import('../data/zones.json'),
    ]).then(([districtsMod, zonesMod]) => {
      const districts = ((districtsMod as any).default ?? districtsMod) as DistrictsGeoJson;
      const rawZones = ((zonesMod as any).default ?? zonesMod) as ZonesGeoJson;
      const zones = deduplicateZoneGeometries(districts, rawZones);
      districtsCache = districts;
      zonesCache = zones;
      return { districts, zones };
    }).catch((err) => {
      mapGeoPromise = null;
      throw err;
    });
  }
  return mapGeoPromise;
}

export function loadStreetsData(): Promise<StreetItem[]> {
  if (streetsCache) {
    return Promise.resolve(streetsCache);
  }
  if (!streetsPromise) {
    streetsPromise = import('../data/streets.json')
      .then((mod) => {
        const list = ((mod as any).default ?? mod) as StreetItem[];
        streetsCache = list;
        return list;
      })
      .catch((err) => {
        streetsPromise = null;
        throw err;
      });
  }
  return streetsPromise;
}

export function getCachedMapGeoData() {
  return districtsCache && zonesCache
    ? { districts: districtsCache, zones: zonesCache }
    : null;
}

export function getCachedStreetsData(): StreetItem[] | null {
  return streetsCache;
}

export function useMapGeoData() {
  const [data, setData] = useState<{ districts: DistrictsGeoJson; zones: ZonesGeoJson } | null>(
    () => getCachedMapGeoData()
  );

  useEffect(() => {
    if (data) return;
    let active = true;
    loadMapGeoData()
      .then((loaded) => {
        if (active) setData(loaded);
      })
      .catch((err) => {
        console.error('Failed to load map geodata:', err);
      });
    return () => {
      active = false;
    };
  }, [data]);

  return data;
}

export function useStreetsData(enabled = true) {
  const [streets, setStreets] = useState<StreetItem[] | null>(() => getCachedStreetsData());

  useEffect(() => {
    if (!enabled || streets) return;
    let active = true;
    loadStreetsData()
      .then((loaded) => {
        if (active) setStreets(loaded);
      })
      .catch((err) => {
        console.error('Failed to load streets data:', err);
      });
    return () => {
      active = false;
    };
  }, [enabled, streets]);

  return streets;
}
