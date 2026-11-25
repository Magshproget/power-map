import { useState, useEffect, useCallback } from 'react';
import { Map } from './components/Map';
import { Header } from './components/Header';
import { TimeController } from './components/TimeController';
import { LayerSwitcher } from './components/LayerSwitcher';
import { DetailsPanel } from './components/DetailsPanel';
import { fetchSchedule } from './services/scheduleService';
import { LayerMode, SelectedFeature, ScheduleData, StreetItem } from './types';
import streetsData from './data/streets.json';

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
        group: found.group,
        center: [found.lat, found.lon],
        buildings: found.buildings,
      });
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 select-none">
      {/* Top Header & Search */}
      <Header
        schedule={schedule}
        onRefresh={loadScheduleData}
        isLoading={isLoading}
        onSelectFeature={setSelectedFeature}
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
      />

      {/* Bottom 24h Time Controller */}
      <TimeController
        currentHour={selectedHour}
        onChangeHour={setSelectedHour}
        onSetNow={() => setSelectedHour(getNowHour())}
        schedule={schedule}
        selectedFeature={selectedFeature}
        onClearSelectedFeature={() => setSelectedFeature(null)}
      />
    </div>
  );
}

export default App;
