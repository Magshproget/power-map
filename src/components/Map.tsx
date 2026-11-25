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

  const districtsLayerRef = useRef<L.GeoJSON | null>(null);
  const zonesLayerRef = useRef<L.GeoJSON | null>(null);
  const streetsLayerGroupRef = useRef<L.LayerGroup | null>(null);

  const [currentZoom, setCurrentZoom] = useState(12);

  const hourSlot = Math.floor(selectedHour) % 24;

  // Helper to determine status color
  const getStatusColor = (status: PowerStatus, isBorder = false) => {
    if (status === 'on') {
      return isBorder ? '#10b981' : '#059669'; // Emerald
    }
    if (status === 'off') {
      return isBorder ? '#f43f5e' : '#e11d48'; // Rose
    }
    return isBorder ? '#f59e0b' : '#d97706'; // Amber
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

    const map = L.map(mapContainerRef.current, {
      center: [49.8397, 24.0297],
      zoom: 12,
      minZoom: 10,
      maxZoom: 18,
      zoomControl: false,
    });

    // Add CartoDB DarkMatter tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    // Zoom control in bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    map.on('zoomend', () => {
      const z = map.getZoom();
      setCurrentZoom(z);
      onZoomChange(z);
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update & Render Districts Layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (districtsLayerRef.current) {
      map.removeLayer(districtsLayerRef.current);
    }

    const dLayer = L.geoJSON(districtsGeoJson as any, {
      style: (feature) => {
        const dProps = feature?.properties;
        const status = getDistrictStatus(dProps?.primaryGroups || []);
        const isSelected = selectedFeature?.type === 'district' && selectedFeature.id === feature?.id;

        return {
          fillColor: getStatusColor(status),
          fillOpacity: isSelected ? 0.45 : 0.25,
          color: isSelected ? '#ffffff' : getStatusColor(status, true),
          weight: isSelected ? 3 : 2,
          dashArray: isSelected ? undefined : '4, 4',
        };
      },
      onEachFeature: (feature, layer) => {
        const dProps = feature.properties;
        const status = getDistrictStatus(dProps.primaryGroups);
        const statusText = status === 'on' ? 'Світло є' : status === 'off' ? 'Відключено' : 'Частково вимкнено';

        layer.bindTooltip(
          `<div class="text-xs font-sans">
            <strong class="text-white">${dProps.name}</strong><br/>
            <span class="${status === 'on' ? 'text-emerald-400' : status === 'off' ? 'text-rose-400' : 'text-amber-400'}">${statusText}</span>
          </div>`,
          { className: 'custom-tooltip', sticky: true }
        );

        layer.on({
          mouseover: (e) => {
            const target = e.target;
            target.setStyle({ fillOpacity: 0.5, weight: 3 });
          },
          mouseout: (e) => {
            dLayer.resetStyle(e.target);
          },
          click: () => {
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
      },
    });

    districtsLayerRef.current = dLayer;
  }, [schedule, selectedHour, selectedFeature]);

  // Update & Render Zones Layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (zonesLayerRef.current) {
      map.removeLayer(zonesLayerRef.current);
    }

    const zLayer = L.geoJSON(zonesGeoJson as any, {
      style: (feature) => {
        const zProps = feature?.properties;
        const status = getGroupStatus(zProps?.group);
        const isSelected = selectedFeature?.type === 'zone' && selectedFeature.id === feature?.id;

        return {
          fillColor: getStatusColor(status),
          fillOpacity: isSelected ? 0.6 : 0.4,
          color: isSelected ? '#ffffff' : getStatusColor(status, true),
          weight: isSelected ? 3 : 1.5,
        };
      },
      onEachFeature: (feature, layer) => {
        const zProps = feature.properties;
        const status = getGroupStatus(zProps.group);
        const statusText = status === 'on' ? 'Світло є' : 'Знеструмлено';

        layer.bindTooltip(
          `<div class="text-xs font-sans">
            <strong class="text-white">${zProps.name}</strong><br/>
            <span class="text-amber-400 font-mono">Черга ${zProps.group}</span> • 
            <span class="${status === 'on' ? 'text-emerald-400' : 'text-rose-400'} font-semibold">${statusText}</span>
          </div>`,
          { className: 'custom-tooltip', sticky: true }
        );

        layer.on({
          mouseover: (e) => {
            const target = e.target;
            target.setStyle({ fillOpacity: 0.7, weight: 3 });
          },
          mouseout: (e) => {
            zLayer.resetStyle(e.target);
          },
          click: () => {
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
      },
    });

    zonesLayerRef.current = zLayer;
  }, [schedule, selectedHour, selectedFeature]);

  // Update & Render Streets Markers Layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (streetsLayerGroupRef.current) {
      map.removeLayer(streetsLayerGroupRef.current);
    }

    const sGroup = L.layerGroup();

    (streetsData as any[]).forEach((st) => {
      const status = getGroupStatus(st.group);
      const isSelected = selectedFeature?.type === 'street' && selectedFeature.id === st.id;
      const color = getStatusColor(status, true);

      const marker = L.circleMarker([st.lat, st.lon], {
        radius: isSelected ? 9 : 6,
        fillColor: color,
        fillOpacity: 0.9,
        color: isSelected ? '#ffffff' : '#0f172a',
        weight: isSelected ? 3 : 2,
      });

      marker.bindTooltip(
        `<div class="text-xs font-sans">
          <strong class="text-white">${st.name}</strong><br/>
          <span class="text-slate-400">${st.district}</span><br/>
          <span class="text-amber-400 font-mono">Черга ${st.group}</span> • 
          <span class="${status === 'on' ? 'text-emerald-400' : 'text-rose-400'} font-semibold">${status === 'on' ? 'Є світло' : 'Немає'}</span>
        </div>`,
        { className: 'custom-tooltip' }
      );

      marker.on('click', () => {
        onSelectFeature({
          type: 'street',
          id: st.id,
          name: st.name,
          districtName: st.district,
          group: st.group,
          center: [st.lat, st.lon],
          buildings: st.buildings,
        });
      });

      sGroup.addLayer(marker);
    });

    streetsLayerGroupRef.current = sGroup;
  }, [schedule, selectedHour, selectedFeature]);

  // Layer Visibility Manager based on mode and current zoom
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const dLayer = districtsLayerRef.current;
    const zLayer = zonesLayerRef.current;
    const sGroup = streetsLayerGroupRef.current;

    if (!dLayer || !zLayer || !sGroup) return;

    // Remove all first
    if (map.hasLayer(dLayer)) map.removeLayer(dLayer);
    if (map.hasLayer(zLayer)) map.removeLayer(zLayer);
    if (map.hasLayer(sGroup)) map.removeLayer(sGroup);

    if (layerMode === 'districts') {
      dLayer.addTo(map);
    } else if (layerMode === 'zones') {
      zLayer.addTo(map);
    } else if (layerMode === 'streets') {
      zLayer.addTo(map);
      sGroup.addTo(map);
    } else {
      // Auto mode based on current zoom
      if (currentZoom < 13) {
        dLayer.addTo(map);
      } else if (currentZoom < 15) {
        zLayer.addTo(map);
      } else {
        zLayer.addTo(map);
        sGroup.addTo(map);
      }
    }
  }, [layerMode, currentZoom]);

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
