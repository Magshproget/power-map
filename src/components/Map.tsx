import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LayerMode, PowerStatus, ScheduleData, SelectedFeature, StreetItem } from '../types';
import { useMapGeoData, useStreetsData } from '../services/geoDataService';
import { fetchStreetGeometry, getSynchronousCachedGeometry } from '../services/streetGeometry';

interface MapProps {
  layerMode: LayerMode;
  selectedHour: number;
  schedule: ScheduleData | null;
  selectedFeature: SelectedFeature | null;
  onSelectFeature: (feature: SelectedFeature) => void;
  onZoomChange: (zoom: number) => void;
}

const IS_MOBILE = typeof window !== 'undefined' && window.innerWidth < 768;
const INITIAL_ZOOM = IS_MOBILE ? 11.8 : 12.2;

const CORE_DISTRICT_IDS = new Set([
  'halitskiy',
  'zaliznichniy',
  'lychakivskiy',
  'sykhivskiy',
  'frankivskiy',
  'shevchenkivskiy',
]);

const MAJOR_SUBURB_IDS = new Set([
  'vynnyky',
  'briukhovychi',
  'rudne',
  'dublyany',
  'sokilnyky',
  'zymna_voda',
  'pustomyty',
]);

type LabelTier = '0' | '1' | '2';

const getLabelTier = (z: number): LabelTier => (z >= 12.3 ? '2' : z >= 11.6 ? '1' : '0');

const getStatusColor = (status: PowerStatus, isBorder = false) => {
  if (status === 'on') {
    return isBorder ? '#059669' : '#10b981';
  }
  if (status === 'off') {
    return isBorder ? '#dc2626' : '#ef4444';
  }
  return isBorder ? '#d97706' : '#f59e0b';
};

const getStatusText = (status: PowerStatus) => {
  if (status === 'on') return 'Світло є';
  if (status === 'off') return 'Немає світла';
  return 'Частково вимкнено';
};

const computeGroupStatus = (
  group: string | undefined,
  schedule: ScheduleData | null,
  hourSlot: number
): PowerStatus => {
  if (!group || !schedule?.groups || !schedule.groups[group]) return 'on';
  return schedule.groups[group].hourly[hourSlot] || 'on';
};

const computeDistrictStatus = (
  primaryGroups: string[],
  schedule: ScheduleData | null,
  hourSlot: number
): PowerStatus => {
  if (!primaryGroups?.length || !schedule?.groups) return 'on';
  const statuses = primaryGroups.map((g) => computeGroupStatus(g, schedule, hourSlot));
  const allOff = statuses.every((s) => s === 'off');
  const allOn = statuses.every((s) => s === 'on');
  if (allOff) return 'off';
  if (allOn) return 'on';
  return 'maybe';
};

interface LabelDotEntry {
  marker: L.Marker;
  kind: 'district' | 'zone';
  primaryGroups?: string[];
  group?: string;
}

interface StreetMarkerEntry {
  marker: L.CircleMarker;
  street: StreetItem;
}

const MapComponent: React.FC<MapProps> = ({
  layerMode,
  selectedHour,
  schedule,
  selectedFeature,
  onSelectFeature,
  onZoomChange,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const canvasRendererRef = useRef<L.Canvas | null>(null);

  // Persistent layer groups
  const districtsGroupRef = useRef<L.LayerGroup | null>(null);
  const zonesGroupRef = useRef<L.LayerGroup | null>(null);
  const streetsGroupRef = useRef<L.LayerGroup | null>(null);
  const selectionGroupRef = useRef<L.LayerGroup | null>(null);
  const labelsGroupRef = useRef<L.LayerGroup | null>(null);

  // Persistent GeoJSON layers & refs for in-place style/dot updates
  const districtsLayerRef = useRef<L.GeoJSON | null>(null);
  const zonesLayerRef = useRef<L.GeoJSON | null>(null);
  const labelDotEntriesRef = useRef<LabelDotEntry[]>([]);
  const streetMarkerEntriesRef = useRef<StreetMarkerEntry[]>([]);
  const openTooltipLayerRef = useRef<L.Layer | null>(null);

  // Adaptive zoom states (only change when thresholds are crossed)
  const [labelTier, setLabelTier] = useState<LabelTier>(() => getLabelTier(INITIAL_ZOOM));
  const [showZoneBadges, setShowZoneBadges] = useState<boolean>(() => INITIAL_ZOOM >= 12.2);
  const [mapViewportVer, setMapViewportVer] = useState(0);
  const [streetGeometry, setStreetGeometry] = useState<{
    streetId: string;
    lines: [number, number][][];
  } | null>(null);

  const hourSlot = Math.floor(selectedHour) % 24;

  // Refs for latest callbacks and state inside imperative Leaflet listeners
  const onSelectFeatureRef = useRef(onSelectFeature);
  onSelectFeatureRef.current = onSelectFeature;
  const onZoomChangeRef = useRef(onZoomChange);
  onZoomChangeRef.current = onZoomChange;
  const layerModeRef = useRef(layerMode);
  layerModeRef.current = layerMode;

  const latestStyleStateRef = useRef({
    hourSlot,
    schedule,
    selectedFeature,
  });
  latestStyleStateRef.current = { hourSlot, schedule, selectedFeature };

  const closeOpenTooltip = useCallback(() => {
    try {
      const layer = openTooltipLayerRef.current as any;
      if (layer && typeof layer.closeTooltip === 'function') {
        layer.closeTooltip();
      }
      openTooltipLayerRef.current = null;
    } catch {
      openTooltipLayerRef.current = null;
    }
  }, []);

  // Load map polygons & streets asynchronously via cached singleton service
  const mapGeo = useMapGeoData();
  const showStreets = layerMode === 'streets';
  const needStreets = showStreets || selectedFeature?.type === 'zone';
  const streetsData = useStreetsData(needStreets);

  // Layer visibility flags
  const showDistricts =
    layerMode === 'districts' || layerMode === 'streets' || layerMode === 'auto';
  const showZones =
    layerMode === 'zones' ||
    (layerMode === 'auto' &&
      (selectedFeature?.type === 'zone' || selectedFeature?.type === 'district'));

  // Scope key for zones: in 'zones' mode all 26 polygons remain mounted across selection/hour changes
  const zonesScopeKey = useMemo(() => {
    if (!showZones) return 'hidden';
    if (layerMode === 'zones') return 'all';
    if (selectedFeature?.type === 'zone') return `zone:${selectedFeature.id}`;
    if (selectedFeature?.type === 'district') return `district:${selectedFeature.id}`;
    return 'hidden';
  }, [showZones, layerMode, selectedFeature?.type, selectedFeature?.id]);

  // Dynamic style callbacks reading latestStyleStateRef (safe for both setStyle & Leaflet resetStyle)
  const getDistrictStyle = useCallback((feature: any): L.PathOptions => {
    const { hourSlot: h, schedule: sched, selectedFeature: sel } = latestStyleStateRef.current;
    const dProps = feature?.properties;
    const status = computeDistrictStatus(dProps?.primaryGroups || [], sched, h);
    const isSelected = sel?.type === 'district' && sel.id === feature?.id;

    return {
      fillColor: getStatusColor(status),
      fillOpacity: isSelected ? 0.45 : 0.28,
      color: isSelected ? '#1e293b' : getStatusColor(status, true),
      weight: isSelected ? 3.5 : 2.5,
      dashArray: isSelected ? undefined : '5, 5',
    };
  }, []);

  const getZoneStyle = useCallback((feature: any): L.PathOptions => {
    const { hourSlot: h, schedule: sched, selectedFeature: sel } = latestStyleStateRef.current;
    const zProps = feature?.properties;
    const status = computeGroupStatus(zProps?.group, sched, h);
    const isSelected = sel?.type === 'zone' && sel.id === feature?.id;

    return {
      fillColor: getStatusColor(status),
      fillOpacity: isSelected ? 0.55 : 0.35,
      color: isSelected ? '#0f172a' : getStatusColor(status, true),
      weight: isSelected ? 3.5 : 2,
    };
  }, []);

  // 1. Initialize Leaflet Map once with persistent Canvas renderer & mobile-safe tile config
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const greaterLvivBounds = L.latLngBounds(
      [49.58, 23.60],
      [50.04, 24.38]
    );

    const canvasRenderer = L.canvas({
      padding: 0.5,
      tolerance: IS_MOBILE ? 10 : 4,
    });
    canvasRendererRef.current = canvasRenderer;

    const map = L.map(mapContainerRef.current, {
      center: [49.8397, 24.0297],
      zoom: INITIAL_ZOOM,
      minZoom: 10.2,
      maxZoom: 18,
      maxBounds: greaterLvivBounds,
      maxBoundsViscosity: 0.75,
      zoomControl: false,
      preferCanvas: true,
      renderer: canvasRenderer,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      subdomains: ['a', 'b', 'c'],
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
      keepBuffer: IS_MOBILE ? 2 : 3,
      updateWhenZooming: false,
      updateWhenIdle: IS_MOBILE,
      updateInterval: IS_MOBILE ? 250 : 150,
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Order determines paint/stacking order
    districtsGroupRef.current = L.layerGroup().addTo(map);
    zonesGroupRef.current = L.layerGroup().addTo(map);
    streetsGroupRef.current = L.layerGroup().addTo(map);
    selectionGroupRef.current = L.layerGroup().addTo(map);
    labelsGroupRef.current = L.layerGroup().addTo(map);

    map.on('tooltipopen', (e: any) => {
      openTooltipLayerRef.current = e?.tooltip?._source || null;
    });
    map.on('tooltipclose', (e: any) => {
      if (openTooltipLayerRef.current === e?.tooltip?._source) {
        openTooltipLayerRef.current = null;
      }
    });

    map.on('zoomstart', () => {
      closeOpenTooltip();
    });

    let lastReportedZoom = Math.round(INITIAL_ZOOM);
    let lastTier: LabelTier = getLabelTier(INITIAL_ZOOM);
    let lastZoneBadges = INITIAL_ZOOM >= 12.2;
    let zoomRaf: number | null = null;

    const syncZoomThresholds = (forceNotify: boolean) => {
      const z = map.getZoom();
      const nextTier = getLabelTier(z);
      const nextBadges = z >= 12.2;
      const rounded = Math.round(z);

      if (nextTier !== lastTier) {
        lastTier = nextTier;
        setLabelTier(nextTier);
      }
      if (nextBadges !== lastZoneBadges) {
        lastZoneBadges = nextBadges;
        setShowZoneBadges(nextBadges);
      }
      if (rounded !== lastReportedZoom || forceNotify) {
        if (rounded !== lastReportedZoom) {
          lastReportedZoom = rounded;
          onZoomChangeRef.current(rounded);
        } else if (forceNotify) {
          onZoomChangeRef.current(rounded);
        }
      }
    };

    const handleZoomUpdate = () => {
      if (zoomRaf !== null) return;
      zoomRaf = requestAnimationFrame(() => {
        zoomRaf = null;
        syncZoomThresholds(false);
      });
    };

    map.on('zoom', handleZoomUpdate);
    map.on('zoomend', () => {
      if (zoomRaf !== null) {
        cancelAnimationFrame(zoomRaf);
        zoomRaf = null;
      }
      syncZoomThresholds(true);
    });

    map.on('moveend', () => {
      if (layerModeRef.current === 'streets') {
        setMapViewportVer((v) => v + 1);
      }
    });

    mapInstanceRef.current = map;

    // Automatically invalidate size whenever container resizes (orientation change, dynamic viewport)
    // Prevents black gap / unrendered tile areas at screen edges
    const handleMapResize = () => {
      map.invalidateSize({ debounceMoveend: true });
    };
    window.addEventListener('resize', handleMapResize);
    window.addEventListener('orientationchange', handleMapResize);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
      ro = new ResizeObserver(() => {
        map.invalidateSize({ debounceMoveend: true });
      });
      ro.observe(mapContainerRef.current);
    }

    // Trigger initial invalidation once layout settles
    const t1 = setTimeout(handleMapResize, 100);
    const t2 = setTimeout(handleMapResize, 350);

    return () => {
      if (zoomRaf !== null) cancelAnimationFrame(zoomRaf);
      window.removeEventListener('resize', handleMapResize);
      window.removeEventListener('orientationchange', handleMapResize);
      if (ro) ro.disconnect();
      clearTimeout(t1);
      clearTimeout(t2);
      districtsLayerRef.current = null;
      zonesLayerRef.current = null;
      labelDotEntriesRef.current = [];
      streetMarkerEntriesRef.current = [];
      openTooltipLayerRef.current = null;
      map.remove();
      mapInstanceRef.current = null;
      canvasRendererRef.current = null;
    };
  }, [closeOpenTooltip]);

  // 2. Mount/unmount Districts GeoJSON geometry ONLY when visibility or data changes
  useEffect(() => {
    const group = districtsGroupRef.current;
    const renderer = canvasRendererRef.current;
    if (!group || !renderer) return;

    group.clearLayers();
    districtsLayerRef.current = null;

    if (!showDistricts || !mapGeo?.districts) return;

    const dLayer = L.geoJSON(mapGeo.districts as any, {
      renderer,
      smoothFactor: IS_MOBILE ? 1.5 : 1.0,
      style: getDistrictStyle,
      onEachFeature: (feature: any, layer: L.Layer) => {
        const dProps = feature.properties;

        layer.bindTooltip(
          () => {
            const { hourSlot: h, schedule: sched } = latestStyleStateRef.current;
            const status = computeDistrictStatus(dProps.primaryGroups, sched, h);
            const statusText = getStatusText(status);
            return `<div class="text-xs font-sans">
              <strong class="text-white text-sm">${dProps.name}</strong><br/>
              <span class="text-amber-400 font-mono">Черги: ${dProps.primaryGroups.join(', ')}</span><br/>
              <span class="${
                status === 'on' ? 'text-emerald-400' : status === 'off' ? 'text-rose-400' : 'text-amber-400'
              } font-semibold">${statusText}</span>
            </div>`;
          },
          { className: 'custom-tooltip', sticky: false, direction: 'auto' }
        );

        layer.on({
          mouseover: (e: L.LeafletMouseEvent) => {
            (e.target as L.Path).setStyle({ fillOpacity: 0.5, weight: 3.5 });
          },
          mouseout: (e: L.LeafletMouseEvent) => {
            dLayer.resetStyle(e.target);
            layer.closeTooltip();
          },
          click: () => {
            closeOpenTooltip();
            onSelectFeatureRef.current({
              type: 'district',
              id: feature.id as string,
              name: dProps.name,
              groups: dProps.primaryGroups,
              streets: dProps.keyStreets,
              center: dProps.center,
            });
          },
        });
      },
    } as L.GeoJSONOptions);

    districtsLayerRef.current = dLayer;
    group.addLayer(dLayer);
    if (zonesLayerRef.current) {
      zonesLayerRef.current.bringToFront();
    }
    selectionGroupRef.current?.eachLayer((l: any) => l.bringToFront?.());
  }, [showDistricts, mapGeo, getDistrictStyle, closeOpenTooltip]);

  // 3. Mount/unmount Zones GeoJSON geometry ONLY when visibility, scope, or data changes
  useEffect(() => {
    const group = zonesGroupRef.current;
    const renderer = canvasRendererRef.current;
    if (!group || !renderer) return;

    group.clearLayers();
    zonesLayerRef.current = null;

    if (!showZones || zonesScopeKey === 'hidden' || !mapGeo?.zones) return;

    const isAutoMode = layerMode === 'auto';
    const sel = latestStyleStateRef.current.selectedFeature;
    const zonesDataToRender = isAutoMode
      ? {
          ...mapGeo.zones,
          features: mapGeo.zones.features.filter((f) => {
            if (sel?.type === 'zone') return f.id === sel.id;
            if (sel?.type === 'district') return f.properties?.districtId === sel.id;
            return false;
          }),
        }
      : mapGeo.zones;

    if (zonesDataToRender.features.length === 0) return;

    const zLayer = L.geoJSON(zonesDataToRender as any, {
      renderer,
      smoothFactor: IS_MOBILE ? 1.5 : 1.0,
      style: getZoneStyle,
      onEachFeature: (feature: any, layer: L.Layer) => {
        const zProps = feature.properties;

        layer.bindTooltip(
          () => {
            const { hourSlot: h, schedule: sched } = latestStyleStateRef.current;
            const status = computeGroupStatus(zProps.group, sched, h);
            const statusText = status === 'on' ? 'Світло є' : 'Немає світла';
            return `<div class="text-xs font-sans">
              <strong class="text-white text-sm">${zProps.name}</strong><br/>
              <span class="text-slate-300">${zProps.districtName}</span><br/>
              <span class="text-amber-400 font-mono font-semibold">Черга ${zProps.group}</span> • 
              <span class="${status === 'on' ? 'text-emerald-400' : 'text-rose-400'} font-bold">${statusText}</span>
            </div>`;
          },
          { className: 'custom-tooltip', sticky: false, direction: 'auto' }
        );

        layer.on({
          mouseover: (e: L.LeafletMouseEvent) => {
            (e.target as L.Path).setStyle({ fillOpacity: 0.65, weight: 3 });
          },
          mouseout: (e: L.LeafletMouseEvent) => {
            zLayer.resetStyle(e.target);
            layer.closeTooltip();
          },
          click: () => {
            closeOpenTooltip();
            onSelectFeatureRef.current({
              type: 'zone',
              id: feature.id as string,
              name: zProps.name,
              districtName: zProps.districtName,
              group: zProps.group,
              streets: zProps.streets,
              center: zProps.center,
            });
          },
        });
      },
    } as L.GeoJSONOptions);

    zonesLayerRef.current = zLayer;
    group.addLayer(zLayer);
    zLayer.bringToFront();
    selectionGroupRef.current?.eachLayer((l: any) => l.bringToFront?.());
  }, [showZones, layerMode, zonesScopeKey, mapGeo, getZoneStyle, closeOpenTooltip]);

  // 4. Mount/update adaptive label badges ONLY when visibility, zoom tier, or zone scope changes
  useEffect(() => {
    const group = labelsGroupRef.current;
    if (!group) return;

    group.clearLayers();
    labelDotEntriesRef.current = [];

    if (!mapGeo) return;

    const { hourSlot: h, schedule: sched, selectedFeature: sel } = latestStyleStateRef.current;
    const newEntries: LabelDotEntry[] = [];

    if (showDistricts) {
      for (const feature of mapGeo.districts.features) {
        const dProps = feature.properties;
        let shouldShowLabel = false;
        if (labelTier === '2') {
          shouldShowLabel = true;
        } else if (labelTier === '1') {
          shouldShowLabel =
            CORE_DISTRICT_IDS.has(feature.id) || MAJOR_SUBURB_IDS.has(feature.id);
        } else {
          shouldShowLabel = CORE_DISTRICT_IDS.has(feature.id);
        }

        if (dProps.center && shouldShowLabel) {
          const status = computeDistrictStatus(dProps.primaryGroups, sched, h);
          const statusColor = getStatusColor(status);
          const labelIcon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div class="district-label-badge">
              <span class="status-indicator-dot" style="background-color: ${statusColor};"></span>
              <span>${dProps.name}</span>
            </div>`,
            iconSize: [0, 0],
            iconAnchor: [0, 0],
          });
          const marker = L.marker([dProps.center[0], dProps.center[1]], {
            icon: labelIcon,
            interactive: false,
          });
          group.addLayer(marker);
          newEntries.push({
            marker,
            kind: 'district',
            primaryGroups: dProps.primaryGroups,
          });
        }
      }
    }

    if (showZones && zonesScopeKey !== 'hidden') {
      const isAutoMode = layerMode === 'auto';
      if (isAutoMode || showZoneBadges) {
        const features = isAutoMode
          ? mapGeo.zones.features.filter((f) => {
              if (sel?.type === 'zone') return f.id === sel.id;
              if (sel?.type === 'district') return f.properties?.districtId === sel.id;
              return false;
            })
          : mapGeo.zones.features;

        const placedCenters: [number, number][] = [];
        for (const feature of features) {
          const zProps = feature.properties;
          if (!zProps.center) continue;

          // Prevent label collisions: ensure badges don't overlap on lower zoom
          const curZoom = mapInstanceRef.current?.getZoom() ?? INITIAL_ZOOM;
          const minDist = curZoom >= 13 ? 0.012 : 0.026;
          const tooClose = placedCenters.some(
            ([cLat, cLng]) => Math.hypot(cLat - zProps.center[0], cLng - zProps.center[1]) < minDist
          );
          if (tooClose && !isAutoMode) continue;
          placedCenters.push([zProps.center[0], zProps.center[1]]);

          const status = computeGroupStatus(zProps.group, sched, h);
          const statusColor = status === 'on' ? '#10b981' : '#ef4444';
          const shortName = (zProps.districtName || zProps.name).replace(/\s*\(Черга [^)]+\)/, '');
          const labelIcon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div class="zone-label-badge">
              <span class="status-indicator-dot" style="background-color: ${statusColor};"></span>
              <span class="font-medium text-slate-100">${shortName}</span>
              <span class="text-amber-400 font-mono text-[9px] bg-slate-800/80 px-1 py-0.5 rounded">Ч.${zProps.group}</span>
            </div>`,
            iconSize: [0, 0],
            iconAnchor: [0, 0],
          });
          const marker = L.marker([zProps.center[0], zProps.center[1]], {
            icon: labelIcon,
            interactive: false,
          });
          group.addLayer(marker);
          newEntries.push({
            marker,
            kind: 'zone',
            group: zProps.group,
          });
        }
      }
    }

    labelDotEntriesRef.current = newEntries;
  }, [showDistricts, showZones, labelTier, showZoneBadges, layerMode, zonesScopeKey, mapGeo, mapViewportVer]);

  // 5. Recolor GeoJSON polygons & existing label dots IN PLACE on hour/schedule/selection change
  useEffect(() => {
    if (districtsLayerRef.current) {
      districtsLayerRef.current.setStyle(getDistrictStyle);
    }
    if (zonesLayerRef.current) {
      zonesLayerRef.current.setStyle(getZoneStyle);
    }

    const entries = labelDotEntriesRef.current;
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const el = entry.marker.getElement();
      if (!el) continue;
      const dot = el.querySelector('.status-indicator-dot') as HTMLElement | null;
      if (!dot) continue;

      if (entry.kind === 'district') {
        const status = computeDistrictStatus(entry.primaryGroups || [], schedule, hourSlot);
        dot.style.backgroundColor = getStatusColor(status);
      } else {
        const status = computeGroupStatus(entry.group, schedule, hourSlot);
        dot.style.backgroundColor = status === 'on' ? '#10b981' : '#ef4444';
      }
    }
  }, [
    hourSlot,
    schedule,
    selectedFeature?.id,
    selectedFeature?.type,
    showDistricts,
    showZones,
    mapGeo,
    zonesScopeKey,
    getDistrictStyle,
    getZoneStyle,
  ]);

  // 6. Street markers layer (Canvas renderer, viewport-culled; rebuild only on mode/pan/data)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = streetsGroupRef.current;
    const renderer = canvasRendererRef.current;
    if (!map || !group || !renderer) return;

    group.clearLayers();
    streetMarkerEntriesRef.current = [];

    if (!showStreets || !streetsData) return;

    const bounds = map.getBounds().pad(0.1);
    const { hourSlot: h, schedule: sched, selectedFeature: sel } = latestStyleStateRef.current;
    const entries: StreetMarkerEntry[] = [];

    for (let i = 0; i < streetsData.length; i++) {
      const st = streetsData[i];
      const isSelected = sel?.type === 'street' && sel.id === st.id;
      if (!isSelected && !bounds.contains([st.lat, st.lon])) continue;

      const status = computeGroupStatus(st.group, sched, h);
      const color = getStatusColor(status, true);

      const marker = L.circleMarker([st.lat, st.lon], {
        renderer,
        radius: isSelected ? 8 : 4.5,
        fillColor: color,
        fillOpacity: 0.9,
        color: isSelected ? '#38bdf8' : '#ffffff',
        weight: isSelected ? 2.5 : 1,
      });

      marker.bindTooltip(
        () => {
          const { hourSlot: curH, schedule: curSched } = latestStyleStateRef.current;
          const stStatus = computeGroupStatus(st.group, curSched, curH);
          return `<div class="text-xs font-sans">
            <strong class="text-white">${st.name}</strong><br/>
            <span class="text-slate-400">${st.cityName && st.cityName !== 'Львів' ? st.cityName : st.district}</span><br/>
            <span class="text-amber-400 font-mono">Черга ${st.group}</span> • 
            <span class="${stStatus === 'on' ? 'text-emerald-400' : 'text-rose-400'} font-semibold">${
            stStatus === 'on' ? 'Є світло' : 'Немає'
          }</span>
          </div>`;
        },
        { className: 'custom-tooltip' }
      );

      marker.on('click', () => {
        closeOpenTooltip();
        onSelectFeatureRef.current({
          type: 'street',
          id: st.id,
          name: st.name,
          districtName: st.district,
          cityName: st.cityName,
          group: st.group,
          center: [st.lat, st.lon],
          buildings: st.buildings,
        });
      });

      group.addLayer(marker);
      entries.push({ marker, street: st });
    }

    streetMarkerEntriesRef.current = entries;
    selectionGroupRef.current?.eachLayer((l: any) => l.bringToFront?.());
  }, [showStreets, mapViewportVer, streetsData, closeOpenTooltip]);

  // 7. Recolor street markers IN PLACE when hour/schedule/selection changes
  useEffect(() => {
    if (!showStreets) return;
    const entries = streetMarkerEntriesRef.current;
    for (let i = 0; i < entries.length; i++) {
      const { marker, street } = entries[i];
      const isSelected = selectedFeature?.type === 'street' && selectedFeature.id === street.id;
      const status = computeGroupStatus(street.group, schedule, hourSlot);
      const color = getStatusColor(status, true);
      marker.setStyle({
        radius: isSelected ? 8 : 4.5,
        fillColor: color,
        color: isSelected ? '#38bdf8' : '#ffffff',
        weight: isSelected ? 2.5 : 1,
      });
    }
  }, [showStreets, hourSlot, schedule, selectedFeature?.id, selectedFeature?.type]);

  // 8. Selection overlay: Zone key streets + Street polyline highlight & pin card
  useEffect(() => {
    const group = selectionGroupRef.current;
    const renderer = canvasRendererRef.current;
    if (!group || !renderer) return;

    group.clearLayers();

    // 8. Street Highlight & Pin on Demand (shows only when a street is selected/searched)
    if (selectedFeature?.type === 'street' && selectedFeature.center) {
      const st = selectedFeature;
      const center = selectedFeature.center;
      const status = st.group ? computeGroupStatus(st.group, schedule, hourSlot) : 'on';
      const statusColor = status === 'on' ? '#10b981' : status === 'off' ? '#ef4444' : '#f59e0b';
      const statusText = status === 'on' ? 'Світло є' : status === 'off' ? 'Немає світла' : 'Можливо';

      const currentStreetLines =
        streetGeometry?.streetId === st.id ? streetGeometry.lines : null;

      if (currentStreetLines && currentStreetLines.length > 0) {
        const smoothFactor = IS_MOBILE ? 1.5 : 1.0;

        const glowHalo = L.polyline(currentStreetLines as any, {
          renderer,
          smoothFactor,
          color: statusColor,
          weight: 10,
          opacity: 0.38,
          lineCap: 'round',
          lineJoin: 'round',
          interactive: false,
        });
        group.addLayer(glowHalo);

        const contrastCasing = L.polyline(currentStreetLines as any, {
          renderer,
          smoothFactor,
          color: '#0f172a',
          weight: 6,
          opacity: 0.85,
          lineCap: 'round',
          lineJoin: 'round',
          interactive: false,
        });
        group.addLayer(contrastCasing);

        const coreStroke = L.polyline(currentStreetLines as any, {
          renderer,
          smoothFactor,
          color: statusColor,
          weight: 3.5,
          opacity: 1,
          lineCap: 'round',
          lineJoin: 'round',
          interactive: false,
        });
        group.addLayer(coreStroke);
      }

      const pinIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div class="relative flex items-center justify-center pointer-events-none">
          <div class="relative flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-slate-900/95 border-2 shadow-2xl" style="border-color: ${statusColor}; transform: translate(0, -60%);">
            <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: ${statusColor};"></span>
            <div class="flex flex-col text-left whitespace-nowrap">
              <span class="text-xs font-bold text-white">${st.name}</span>
              <span class="text-[10px] text-amber-300 font-mono">Черга ${st.group || ''} • ${statusText}</span>
            </div>
          </div>
        </div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const pinMarker = L.marker(center, {
        icon: pinIcon,
        interactive: false,
        zIndexOffset: 1000,
      });

      group.addLayer(pinMarker);
    }
  }, [
    showStreets,
    streetsData,
    selectedFeature,
    streetGeometry,
    hourSlot,
    schedule,
    closeOpenTooltip,
  ]);

  // 9. Resolve street geometry lazily on demand whenever selected street changes
  useEffect(() => {
    let isCancelled = false;

    if (selectedFeature?.type === 'street' && selectedFeature.id) {
      const targetId = selectedFeature.id;
      const cached = getSynchronousCachedGeometry(selectedFeature);
      if (cached && cached.length > 0) {
        setStreetGeometry({ streetId: targetId, lines: cached });
      } else {
        setStreetGeometry(null);
        fetchStreetGeometry(selectedFeature).then((lines) => {
          if (!isCancelled && lines && lines.length > 0) {
            setStreetGeometry({ streetId: targetId, lines });
          }
        });
      }
    } else {
      setStreetGeometry(null);
    }

    return () => {
      isCancelled = true;
    };
  }, [selectedFeature?.id, selectedFeature?.name]);

  // 10. Pan / Fit Bounds to selected feature without double-jumping
  const lastCenteredFeatureRef = useRef<string>('');

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedFeature?.center) return;

    const featureKey = `${selectedFeature.type}_${selectedFeature.id}`;
    const currentStreetLines =
      selectedFeature.type === 'street' && streetGeometry?.streetId === selectedFeature.id
        ? streetGeometry.lines
        : null;

    if (currentStreetLines && currentStreetLines.length > 0) {
      const allPts = currentStreetLines.flat();
      if (allPts.length >= 2) {
        const bounds = L.latLngBounds(allPts as any);
        if (bounds.isValid()) {
          lastCenteredFeatureRef.current = featureKey;
          map.fitBounds(bounds, { padding: [65, 65], maxZoom: 16.5 });
          return;
        }
      }
    }

    // Only flyTo if not already centered on this feature
    if (lastCenteredFeatureRef.current === featureKey) return;
    lastCenteredFeatureRef.current = featureKey;

    const [lat, lon] = selectedFeature.center;
    const targetZoom =
      selectedFeature.type === 'district' ? 13 : selectedFeature.type === 'zone' ? 14 : 16;
    map.flyTo([lat, lon], targetZoom, { duration: 1.2 });
  }, [selectedFeature?.id, streetGeometry]);

  return <div ref={mapContainerRef} className="w-full h-full relative" />;
};

export const Map = React.memo(MapComponent);
