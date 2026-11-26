import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Map } from './components/Map';
import { Header } from './components/Header';
import { TimeController } from './components/TimeController';
import { LayerSwitcher } from './components/LayerSwitcher';
import { DetailsPanel } from './components/DetailsPanel';
import { SavedLocationsBar } from './components/SavedLocationsBar';
import { fetchSchedule } from './services/scheduleService';
import { getCachedStreetsData, loadStreetsData } from './services/geoDataService';
import { LayerMode, SelectedFeature, ScheduleData, SavedLocation } from './types';

const STORAGE_KEY = 'power_map_saved_locations';

const getNowHour = () => {
  const d = new Date();
  return d.getHours() + d.getMinutes() / 60;
};

const loadSavedFromStorage = (): SavedLocation[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is SavedLocation =>
        Boolean(item && item.id && item.feature && item.feature.id && item.feature.name)
    );
  } catch {
    return [];
  }
};

export function App() {
  const [schedule, setSchedule] = useState<ScheduleData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedHour, setSelectedHour] = useState<number>(getNowHour);
  const [layerMode, setLayerMode] = useState<LayerMode>('zones');
  const [currentZoom, setCurrentZoom] = useState<number>(12);
  const [selectedFeature, setSelectedFeature] = useState<SelectedFeature | null>(null);
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>(loadSavedFromStorage);
  const [isSearching, setIsSearching] = useState(false);
  const selectionSeqRef = useRef(0);

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

  const handleSelectFeature = useCallback((feature: SelectedFeature) => {
    selectionSeqRef.current += 1;
    setSelectedFeature(feature);
  }, []);

  // Handle clicking a street name inside details panel
  const handleSelectStreetByName = useCallback(async (streetName: string) => {
    const seq = ++selectionSeqRef.current;
    try {
      const streets = getCachedStreetsData() ?? (await loadStreetsData());
      if (seq !== selectionSeqRef.current) return;
      const target = streetName.toLowerCase();
      const found = streets.find((s) => s.name.toLowerCase() === target);
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
    } catch (err) {
      console.error('Failed to resolve street:', err);
    }
  }, []);

  const handleToggleSaved = useCallback((feature: SelectedFeature, customLabel?: string) => {
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
      }
      return [
        ...prev,
        {
          id: `${feature.type}_${feature.id}_${Date.now()}`,
          customLabel,
          feature,
          createdAt: Date.now(),
        },
      ];
    });
  }, []);

  const handleRemoveSaved = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSavedLocations((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const handleCloseDetails = useCallback(() => {
    selectionSeqRef.current += 1;
    setSelectedFeature(null);
  }, []);

  const handleSetNow = useCallback(() => {
    setSelectedHour(getNowHour());
  }, []);

  const handleSearchFocusChange = useCallback((focused: boolean) => {
    setIsSearching(focused);
  }, []);

  const savedItem = selectedFeature
    ? savedLocations.find(
        (item) => item.feature.id === selectedFeature.id && item.feature.type === selectedFeature.type
      )
    : undefined;
  const isSelectedSaved = !!savedItem;
  const savedCustomLabel = savedItem?.customLabel;

  return (
    <div className="relative w-screen h-screen app-shell overflow-hidden bg-slate-950 select-none">
      {/* Top Header & Search */}
      <Header
        schedule={schedule}
        onRefresh={loadScheduleData}
        isLoading={isLoading}
        onSelectFeature={handleSelectFeature}
        layerMode={layerMode}
        onChangeLayerMode={setLayerMode}
        currentZoom={currentZoom}
        onSearchFocusChange={handleSearchFocusChange}
      />

      {/* Quick Saved Locations Status Bar */}
      <SavedLocationsBar
        savedLocations={savedLocations}
        schedule={schedule}
        selectedHour={selectedHour}
        selectedFeatureId={selectedFeature?.id}
        onSelectLocation={handleSelectFeature}
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
          onSelectFeature={handleSelectFeature}
          onZoomChange={setCurrentZoom}
        />
      </main>

      {/* Details Side Panel */}
      <DetailsPanel
        feature={selectedFeature}
        onClose={handleCloseDetails}
        selectedHour={selectedHour}
        onChangeHour={setSelectedHour}
        schedule={schedule}
        onSelectStreet={handleSelectStreetByName}
        isSaved={isSelectedSaved}
        savedCustomLabel={savedCustomLabel}
        onToggleSaved={handleToggleSaved}
        hasSavedLocations={savedLocations.length > 0}
      />

      {/* Bottom 24h Time Controller */}
      <TimeController
        currentHour={selectedHour}
        onChangeHour={setSelectedHour}
        onSetNow={handleSetNow}
        schedule={schedule}
        selectedFeature={selectedFeature}
        onClearSelectedFeature={handleCloseDetails}
        isSearching={isSearching}
      />
    </div>
  );
}

export default App;
