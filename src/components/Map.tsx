import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LayerMode, SelectedFeature, ScheduleData, PowerStatus } from '../types';
import districtsGeoJson from '../data/districts.json';
import zonesGeoJson from '../data/zones.json';
import streetsData from '../data/streets.json';

interface MapProps {
  layerMode: LayerMode;
  selectedHour: number;
  schedule: ScheduleData | null;
  selectedFeature: SelectedFeature | null;
  onSelectFeature: (feature: SelectedFeature) => void;
  onZoomChange: (zoom: number) => void;
}

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

const closeMapTooltips = (map: L.Map | null) => {
  if (!map) return;
  try {
    map.eachLayer((layer: any) => {
      if (layer && typeof layer.closeTooltip === 'function') {
        layer.closeTooltip();
      }
    });
  } catch {}
};

export const Map: React.FC<MapProps> = ({
  layerMode,
  selectedHour,
  schedule,
  selectedFeature,
  onSelectFeature,
  onZoomChange,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  const activeGroupRef = useRef<L.LayerGroup | null>(null);
  const [currentZoom, setCurrentZoom] = useState(12);
  const [mapViewportVer, setMapViewportVer] = useState(0);

  const hourSlot = Math.floor(selectedHour) % 24;

  // Helper to determine status color
  const getStatusColor = (status: PowerStatus, isBorder = false) => {
    if (status === 'on') {
      return isBorder ? '#059669' : '#10b981'; // Green / Emerald
    }
    if (status === 'off') {
      return isBorder ? '#dc2626' : '#ef4444'; // Red
    }
    return isBorder ? '#d97706' : '#f59e0b'; // Amber
  };

  const getStatusText = (status: PowerStatus) => {
    if (status === 'on') return 'Світло є';
    if (status === 'off') return 'Немає світла';
    return 'Частково вимкнено';
  };

  // Compute status for a group
  const getGroupStatus = (group: string): PowerStatus => {
    if (!schedule?.groups || !schedule.groups[group]) return 'on';
    return schedule.groups[group].hourly[hourSlot] || 'on';
  };

  // Compute composite status for a district
  const getDistrictStatus = (primaryGroups: string[]): PowerStatus => {
    if (!primaryGroups?.length || !schedule?.groups) return 'on';
    const statuses = primaryGroups.map((g) => getGroupStatus(g));
    const allOff = statuses.every((s) => s === 'off');
    const allOn = statuses.every((s) => s === 'on');
    if (allOff) return 'off';
    if (allOn) return 'on';
    return 'maybe';
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Constrain map strictly to Greater Lviv (fast tile loading, no unnecessary requests)
    const greaterLvivBounds = L.latLngBounds(
      [49.68, 23.74], // South-West (covers Pustomyty, Solonka, Sukhovolia, Rudne)
      [49.99, 24.28]  // North-East (covers Hrybovychi, Malehiv, Dublyany, Vynnyky, Davydiv)
    );

    const map = L.map(mapContainerRef.current, {
      center: [49.8397, 24.0297],
      zoom: 11.5,
      minZoom: 10.5,
      maxZoom: 18,
      maxBounds: greaterLvivBounds,
      maxBoundsViscosity: 0.9,
      zoomControl: false,
    });

    // Add standard OpenStreetMap tiles (free, reliable, complete Ukrainian streets & landmarks)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // Zoom control in bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const group = L.layerGroup().addTo(map);
    activeGroupRef.current = group;

    map.on('zoomstart', () => {
      closeMapTooltips(map);
    });

    map.on('zoomend', () => {
      const z = map.getZoom();
      setCurrentZoom(z);
      onZoomChange(z);
    });

    map.on('moveend', () => {
      setMapViewportVer((v) => v + 1);
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Re-build and render layers whenever map, mode, zoom, hour, schedule, or selection changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = activeGroupRef.current;
    if (!map || !group) return;

    // Clear previous layers and close tooltips
    group.clearLayers();
    closeMapTooltips(map);

    // Determine what to show
    let showDistricts = false;
    let showZones = false;
    let showStreets = false;

    if (layerMode === 'districts') {
      showDistricts = true;
    } else if (layerMode === 'zones') {
      showZones = true;
    } else if (layerMode === 'streets') {
      showZones = true;
      showStreets = true;
    } else {
      // Auto mode based on zoom:
      // zoom < 13: Clean district polygons
      // 13 <= zoom < 16.5: Clean outage zone polygons
      // zoom >= 16.5: Street-level markers in view
      if (currentZoom < 13) {
        showDistricts = true;
      } else if (currentZoom < 16.5) {
        showZones = true;
      } else {
        showZones = true;
        showStreets = true;
      }
    }

    // 1. Render Districts Layer
    if (showDistricts) {
      const dLayer = L.geoJSON(districtsGeoJson as any, {
        style: (feature) => {
          const dProps = feature?.properties;
          const status = getDistrictStatus(dProps?.primaryGroups || []);
          const isSelected = selectedFeature?.type === 'district' && selectedFeature.id === feature?.id;

          return {
            fillColor: getStatusColor(status),
            fillOpacity: isSelected ? 0.45 : 0.28,
            color: isSelected ? '#1e293b' : getStatusColor(status, true),
            weight: isSelected ? 3.5 : 2.5,
            dashArray: isSelected ? undefined : '5, 5',
          };
        },
        onEachFeature: (feature, layer) => {
          const dProps = feature.properties;
          const status = getDistrictStatus(dProps.primaryGroups);
          const statusText = getStatusText(status);

          layer.bindTooltip(
            `<div class="text-xs font-sans">
              <strong class="text-white text-sm">${dProps.name}</strong><br/>
              <span class="text-amber-400 font-mono">Черги: ${dProps.primaryGroups.join(', ')}</span><br/>
              <span class="${
                status === 'on' ? 'text-emerald-400' : status === 'off' ? 'text-rose-400' : 'text-amber-400'
              } font-semibold">${statusText}</span>
            </div>`,
            { className: 'custom-tooltip', sticky: false, direction: 'auto' }
          );

          layer.on({
            mouseover: (e) => {
              e.target.setStyle({ fillOpacity: 0.5, weight: 3.5 });
            },
            mouseout: (e) => {
              dLayer.resetStyle(e.target);
              layer.closeTooltip();
            },
            click: () => {
              closeMapTooltips(map);
              onSelectFeature({
                type: 'district',
                id: feature.id as string,
                name: dProps.name,
                groups: dProps.primaryGroups,
                streets: dProps.keyStreets,
                center: dProps.center,
              });
            },
          });

          // Show labels adaptively to avoid collisions at low zoom
          let shouldShowLabel = false;
          if (currentZoom >= 12.3) {
            shouldShowLabel = true;
          } else if (currentZoom >= 11.6) {
            shouldShowLabel = CORE_DISTRICT_IDS.has(feature.id as string) || MAJOR_SUBURB_IDS.has(feature.id as string);
          } else {
            shouldShowLabel = CORE_DISTRICT_IDS.has(feature.id as string);
          }

          if (dProps.center && shouldShowLabel) {
            const statusColor = status === 'on' ? '#10b981' : status === 'off' ? '#ef4444' : '#f59e0b';
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
          }
        },
      });

      group.addLayer(dLayer);
    }

    // 2. Render Outage Zones Layer
    if (showZones) {
      const zLayer = L.geoJSON(zonesGeoJson as any, {
        style: (feature) => {
          const zProps = feature?.properties;
          const status = getGroupStatus(zProps?.group);
          const isSelected = selectedFeature?.type === 'zone' && selectedFeature.id === feature?.id;

          return {
            fillColor: getStatusColor(status),
            fillOpacity: isSelected ? 0.5 : 0.3,
            color: isSelected ? '#0f172a' : getStatusColor(status, true),
            weight: isSelected ? 3.5 : 2,
          };
        },
        onEachFeature: (feature, layer) => {
          const zProps = feature.properties;
          const status = getGroupStatus(zProps.group);
          const statusText = status === 'on' ? 'Світло є' : 'Немає світла';

          layer.bindTooltip(
            `<div class="text-xs font-sans">
              <strong class="text-white text-sm">${zProps.name}</strong><br/>
              <span class="text-slate-300">${zProps.districtName}</span><br/>
              <span class="text-amber-400 font-mono font-semibold">Черга ${zProps.group}</span> • 
              <span class="${status === 'on' ? 'text-emerald-400' : 'text-rose-400'} font-bold">${statusText}</span>
            </div>`,
            { className: 'custom-tooltip', sticky: false, direction: 'auto' }
          );

          layer.on({
            mouseover: (e) => {
              e.target.setStyle({ fillOpacity: 0.6, weight: 3 });
            },
            mouseout: (e) => {
              zLayer.resetStyle(e.target);
              layer.closeTooltip();
            },
            click: () => {
              closeMapTooltips(map);
              onSelectFeature({
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

          // Add clean zone label badge at appropriate zoom
          if (zProps.center && currentZoom >= 13.2) {
            const statusColor = status === 'on' ? '#10b981' : '#ef4444';
            const labelIcon = L.divIcon({
              className: 'custom-div-icon',
              html: `<div class="zone-label-badge">
                <span class="status-indicator-dot" style="background-color: ${statusColor};"></span>
                <span>Черга ${zProps.group}</span>
              </div>`,
              iconSize: [0, 0],
              iconAnchor: [0, 0],
            });
            const marker = L.marker([zProps.center[0], zProps.center[1]], {
              icon: labelIcon,
              interactive: false,
            });
            group.addLayer(marker);
          }
        },
      });

      group.addLayer(zLayer);
    }

    // 3. Render Street Markers Layer (only when explicitly requested or at detailed zoom >= 16.5)
    if (showStreets) {
      const bounds = map.getBounds().pad(0.1);
      (streetsData as any[]).forEach((st) => {
        const isSelected = selectedFeature?.type === 'street' && selectedFeature.id === st.id;
        if (!isSelected && !bounds.contains([st.lat, st.lon])) return;

        const status = getGroupStatus(st.group);
        const color = getStatusColor(status, true);

        const marker = L.circleMarker([st.lat, st.lon], {
          radius: isSelected ? 8 : 4.5,
          fillColor: color,
          fillOpacity: 0.9,
          color: isSelected ? '#38bdf8' : '#ffffff',
          weight: isSelected ? 2.5 : 1,
        });

        marker.bindTooltip(
          `<div class="text-xs font-sans">
            <strong class="text-white">${st.name}</strong><br/>
            <span class="text-slate-400">${st.cityName && st.cityName !== 'Львів' ? st.cityName : st.district}</span><br/>
            <span class="text-amber-400 font-mono">Черга ${st.group}</span> • 
            <span class="${status === 'on' ? 'text-emerald-400' : 'text-rose-400'} font-semibold">${
            status === 'on' ? 'Є світло' : 'Немає'
          }</span>
          </div>`,
          { className: 'custom-tooltip' }
        );

        marker.on('click', () => {
          closeMapTooltips(map);
          onSelectFeature({
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
      });
    }

    // 4. If a zone is selected, render subtle markers for its key streets
    if (!showStreets && selectedFeature?.type === 'zone' && selectedFeature.streets?.length) {
      const zoneStreetNames = new Set(
        selectedFeature.streets.map((s: string) => s.toLowerCase().replace(/^(вул\.|просп\.|пл\.)\s*/, '').trim())
      );
      (streetsData as any[]).forEach((st) => {
        const norm = st.name.toLowerCase().replace(/^(вул\.|просп\.|пл\.)\s*/, '').trim();
        if (!zoneStreetNames.has(norm)) return;

        const status = getGroupStatus(st.group);
        const color = getStatusColor(status, true);

        const marker = L.circleMarker([st.lat, st.lon], {
          radius: 5,
          fillColor: color,
          fillOpacity: 0.95,
          color: '#ffffff',
          weight: 1.5,
        });

        marker.bindTooltip(
          `<div class="text-xs font-sans">
            <strong class="text-white">${st.name}</strong><br/>
            <span class="text-amber-400 font-mono">Черга ${st.group}</span>
          </div>`,
          { className: 'custom-tooltip' }
        );

        marker.on('click', () => {
          closeMapTooltips(map);
          onSelectFeature({
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
      });
    }

    // 5. Pin on Demand: Prominent glowing pin card for searched or selected street
    if (selectedFeature?.type === 'street' && selectedFeature.center) {
      const st = selectedFeature;
      const center = selectedFeature.center;
      const status = st.group ? getGroupStatus(st.group) : 'on';
      const statusColor = status === 'on' ? '#10b981' : status === 'off' ? '#ef4444' : '#f59e0b';
      const statusText = status === 'on' ? 'Світло є' : status === 'off' ? 'Немає світла' : 'Можливо';

      const pinIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div class="relative flex items-center justify-center pointer-events-none">
          <span class="absolute w-8 h-8 rounded-full animate-ping opacity-35" style="background-color: ${statusColor};"></span>
          <div class="relative flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-slate-900/95 backdrop-blur-md border-2 shadow-2xl" style="border-color: ${statusColor}; transform: translate(0, -60%);">
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
  }, [layerMode, currentZoom, schedule, selectedHour, selectedFeature, mapViewportVer]);

  // Pan to selected feature
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedFeature?.center) return;

    const [lat, lon] = selectedFeature.center;
    const targetZoom = selectedFeature.type === 'district' ? 13 : selectedFeature.type === 'zone' ? 14 : 16;
    map.flyTo([lat, lon], targetZoom, { duration: 1.2 });
  }, [selectedFeature]);

  return <div ref={mapContainerRef} className="w-full h-full relative" />;
};
