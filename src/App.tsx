import React, { useState, useEffect, useCallback } from 'react';
import { Map } from './components/Map';
import { Header } from './components/Header';
import { TimeController } from './components/TimeController';
import { LayerSwitcher } from './components/LayerSwitcher';
import { DetailsPanel } from './components/DetailsPanel';
import { SavedLocationsBar } from './components/SavedLocationsBar';
import { fetchSchedule } from './services/scheduleService';
import { LayerMode, SelectedFeature, ScheduleData, StreetItem, SavedLocation } from './types';
import streetsData from './data/streets.json';

const STORAGE_KEY = 'power_map_saved_locations';

const loadSavedFromStorage = (): SavedLocation[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

export function App() {
  const [schedule, setSchedule] = useState<ScheduleData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize selectedHour to current local time in hours (e.g. 15.5 for 15:30)
  const getNowHour = () => {
    const d = new Date();
    return d.getHours() + d.getMinutes() / 60;
  };

  const [selectedHour, setSelectedHour] = useState<number>(getNowHour());
  const [layerMode, setLayerMode] = useState<LayerMode>('auto');
  const [currentZoom, setCurrentZoom] = useState<number>(12);
  const [selectedFeature, setSelectedFeature] = useState<SelectedFeature | null>(null);
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>(loadSavedFromStorage);
  const [isSearching, setIsSearching] = useState(false);

  // Save to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedLocations));
    } catch (err) {
      console.error('Failed to save locations to storage:', err);
    }
  }, [savedLocations]);

  // Load schedule
  const loadScheduleData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchSchedule();
      setSchedule(data);
    } catch (err) {
      console.error('Failed to load schedule:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadScheduleData();
  }, [loadScheduleData]);

  // Handle clicking a street name inside details panel
  const handleSelectStreetByName = (streetName: string) => {
    const streets = streetsData as StreetItem[];
    const found = streets.find((s) => s.name.toLowerCase() === streetName.toLowerCase());
    if (found) {
      setSelectedFeature({
        type: 'street',
        id: found.id,
        name: found.name,
        districtName: found.district,
        cityName: found.cityName,
        group: found.group,
        center: [found.lat, found.lon],
        buildings: found.buildings,
      });
    }
  };

  const handleToggleSaved = (feature: SelectedFeature, customLabel?: string) => {
    setSavedLocations((prev) => {
      const idx = prev.findIndex(
        (item) => item.feature.id === feature.id && item.feature.type === feature.type
      );
      if (idx >= 0) {
        if (customLabel !== undefined) {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], customLabel };
          return copy;
        }
        return prev.filter((_, i) => i !== idx);
      } else {
        return [
          ...prev,
          {
            id: `${feature.type}_${feature.id}_${Date.now()}`,
            customLabel,
            feature,
            createdAt: Date.now(),
          },
        ];
      }
    });
  };

  const handleRemoveSaved = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSavedLocations((prev) => prev.filter((item) => item.id !== id));
  };

  const savedItem = selectedFeature
    ? savedLocations.find(
        (item) => item.feature.id === selectedFeature.id && item.feature.type === selectedFeature.type
      )
    : undefined;
  const isSelectedSaved = !!savedItem;
  const savedCustomLabel = savedItem?.customLabel;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 select-none">
      {/* Top Header & Search */}
      <Header
        schedule={schedule}
        onRefresh={loadScheduleData}
        isLoading={isLoading}
        onSelectFeature={setSelectedFeature}
        layerMode={layerMode}
        onChangeLayerMode={setLayerMode}
        currentZoom={currentZoom}
        onSearchFocusChange={setIsSearching}
      />

      {/* Quick Saved Locations Status Bar */}
      <SavedLocationsBar
        savedLocations={savedLocations}
        schedule={schedule}
        selectedHour={selectedHour}
        selectedFeatureId={selectedFeature?.id}
        onSelectLocation={setSelectedFeature}
        onRemoveLocation={handleRemoveSaved}
        isSearching={isSearching}
      />

      {/* Layer Switcher */}
      <LayerSwitcher
        mode={layerMode}
        onChangeMode={setLayerMode}
        currentZoom={currentZoom}
      />

      {/* Main Interactive Map */}
      <main className="w-full h-full">
        <Map
          layerMode={layerMode}
          selectedHour={selectedHour}
          schedule={schedule}
          selectedFeature={selectedFeature}
          onSelectFeature={setSelectedFeature}
          onZoomChange={setCurrentZoom}
        />
      </main>

      {/* Details Side Panel */}
      <DetailsPanel
        feature={selectedFeature}
        onClose={() => setSelectedFeature(null)}
        selectedHour={selectedHour}
        schedule={schedule}
        onSelectStreet={handleSelectStreetByName}
        isSaved={isSelectedSaved}
        savedCustomLabel={savedCustomLabel}
        onToggleSaved={handleToggleSaved}
      />

      {/* Bottom 24h Time Controller */}
      <TimeController
        currentHour={selectedHour}
        onChangeHour={setSelectedHour}
        onSetNow={() => setSelectedHour(getNowHour())}
        schedule={schedule}
        selectedFeature={selectedFeature}
        onClearSelectedFeature={() => setSelectedFeature(null)}
        isSearching={isSearching}
      />
    </div>
  );
}

export default App;
