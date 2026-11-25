import React, { useState } from 'react';
import { Bookmark, Home, Briefcase, Heart, X, ChevronDown } from 'lucide-react';
import { SavedLocation, ScheduleData, PowerStatus, SelectedFeature } from '../types';

interface SavedLocationsBarProps {
  savedLocations: SavedLocation[];
  schedule: ScheduleData | null;
  selectedHour: number;
  selectedFeatureId?: string;
  onSelectLocation: (feature: SelectedFeature) => void;
  onRemoveLocation: (id: string, e: React.MouseEvent) => void;
  onOpenSearch?: () => void;
  isSearching?: boolean;
}

export const SavedLocationsBar: React.FC<SavedLocationsBarProps> = ({
  savedLocations,
  schedule,
  selectedHour,
  selectedFeatureId,
  onSelectLocation,
  onRemoveLocation,
  isSearching,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const hourSlot = Math.floor(selectedHour) % 24;

  const getStatus = (feature: SelectedFeature): PowerStatus => {
    if (feature.group && schedule?.groups[feature.group]) {
      return schedule.groups[feature.group].hourly[hourSlot] || 'on';
    }
    if (feature.groups && schedule?.groups) {
      const statuses = feature.groups.map((g) => schedule.groups[g]?.hourly[hourSlot] || 'on');
      if (statuses.every((s) => s === 'off')) return 'off';
      if (statuses.every((s) => s === 'on')) return 'on';
      return 'maybe';
    }
    return 'on';
  };

  const getLabelIcon = (label?: string) => {
    const l = (label || '').toLowerCase();
    if (l.includes('дім') || l.includes('дом') || l.includes('хата')) {
      return <Home className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
    }
    if (l.includes('робот') || l.includes('офіс') || l.includes('work')) {
      return <Briefcase className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
    }
    if (l.includes('батьк') || l.includes('мама') || l.includes('сім')) {
      return <Heart className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
    }
    return <Bookmark className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
  };

  const getStatusBadge = (status: PowerStatus, isSelected: boolean) => {
    switch (status) {
      case 'off':
        return {
          dot: 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]',
          text: 'Вимкнено',
          textColor: 'text-rose-400',
          border: isSelected ? 'border-rose-500 ring-2 ring-rose-500/30' : 'border-slate-700/60',
        };
      case 'maybe':
        return {
          dot: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]',
          text: 'Можливо',
          textColor: 'text-amber-400',
          border: isSelected ? 'border-amber-500 ring-2 ring-amber-500/30' : 'border-slate-700/60',
        };
      case 'on':
      default:
        return {
          dot: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]',
          text: 'Світло є',
          textColor: 'text-emerald-400',
          border: isSelected ? 'border-emerald-500 ring-2 ring-emerald-500/30' : 'border-slate-700/60',
        };
    }
  };

  const validLocations = savedLocations.filter(
    (loc) => loc && loc.feature && loc.feature.id && loc.feature.name
  );

  if (validLocations.length === 0) {
    return (
      <div className="hidden md:flex fixed top-[92px] left-4 z-[990] pointer-events-none">
        <div className="flex items-center gap-2 bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/50 shadow-lg text-xs text-slate-400 pointer-events-auto">
          <Bookmark className="w-3.5 h-3.5 text-amber-400/80" />
          <span>Зберігайте адреси (дім, робота) через «★ В обране» для швидкого моніторингу</span>
        </div>
      </div>
    );
  }

  const activeLoc = validLocations.find((loc) => loc.feature?.id === selectedFeatureId) || validLocations[0];
  const hasMoreThanOne = validLocations.length > 1;

  const renderChip = (loc: SavedLocation) => {
    const status = getStatus(loc.feature) || 'on';
    const isSelected = selectedFeatureId === loc.feature.id;
    const statusBadge = getStatusBadge(status, isSelected);
    const displayName = loc.customLabel || loc.feature.name;

    return (
      <div
        key={loc.id}
        onClick={() => {
          onSelectLocation(loc.feature);
          setIsDropdownOpen(false);
        }}
        className={`group flex items-center gap-1.5 md:gap-2 px-2.5 py-1 md:px-3 md:py-1.5 rounded-lg md:rounded-xl bg-slate-900/90 hover:bg-slate-800/95 backdrop-blur-md border ${statusBadge.border} shadow-lg cursor-pointer transition-all shrink-0 active:scale-95`}
        title={`${loc.feature.name} (${loc.feature.group ? `Черга ${loc.feature.group}` : 'Район'}) — ${statusBadge.text}`}
      >
        {getLabelIcon(loc.customLabel)}

        <div className="flex flex-col text-left">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-xs md:text-sm text-white leading-tight max-w-[130px] sm:max-w-[200px] truncate">
              {displayName}
            </span>
            {loc.feature.group && (
              <span className="text-[10px] md:text-xs font-mono px-1 rounded bg-slate-800 text-amber-300/90 border border-slate-700/50">
                Ч.{loc.feature.group}
              </span>
            )}
          </div>
          {loc.customLabel && (
            <span className="text-[10px] md:text-xs text-slate-400 truncate max-w-[130px] sm:max-w-[200px]">
              {loc.feature.name}
            </span>
          )}
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-1 ml-1 pl-1.5 border-l border-slate-700/60">
          <span className={`w-2 h-2 rounded-full ${statusBadge.dot}`} />
          <span className={`text-[11px] md:text-xs font-medium hidden sm:inline ${statusBadge.textColor}`}>
            {statusBadge.text}
          </span>
        </div>

        {/* Remove button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemoveLocation(loc.id, e);
          }}
          title="Видалити з обраного"
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded-md hover:bg-slate-700 text-slate-400 hover:text-white transition-opacity ml-0.5"
        >
          <X className="w-3 h-3 md:w-3.5 md:h-3.5" />
        </button>
      </div>
    );
  };

  return (
    <>
      <div
        className={`fixed top-14 md:top-[92px] left-0 md:left-4 right-0 md:right-auto z-[990] flex justify-center md:justify-start items-center pointer-events-none px-2 md:px-0 ${
          selectedFeatureId || isSearching ? 'hidden md:flex' : 'flex'
        }`}
      >
        <div className="flex items-center justify-center md:justify-start gap-1.5 md:gap-2 pointer-events-auto max-w-full">
          <div className="flex items-center gap-1 md:gap-1.5 px-2 py-1 md:px-2.5 md:py-1.5 bg-slate-900/95 backdrop-blur-md rounded-lg md:rounded-xl border border-slate-700/60 shadow-lg text-[11px] md:text-xs font-semibold text-slate-300 shrink-0">
            <Bookmark className="w-3 h-3 md:w-3.5 md:h-3.5 text-amber-400 fill-amber-400/30" />
            <span className="hidden sm:inline">Мої адреси:</span>
          </div>

          {/* Active / Selected Saved Address Chip */}
          {activeLoc && renderChip(activeLoc)}

          {/* More Addresses Dropdown Trigger */}
          {hasMoreThanOne && (
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              title="Всі збережені адреси"
              className={`flex items-center gap-1 px-2 py-1 md:px-2.5 md:py-1.5 rounded-lg md:rounded-xl backdrop-blur-md border shadow-lg text-[11px] md:text-xs font-bold transition-all active:scale-95 shrink-0 cursor-pointer ${
                isDropdownOpen
                  ? 'bg-amber-500 text-slate-950 border-amber-400'
                  : 'bg-slate-900/95 hover:bg-slate-800 text-amber-400 border-slate-700/70'
              }`}
            >
              <span>+{validLocations.length - 1}</span>
              <ChevronDown className={`w-3 h-3 md:w-3.5 md:h-3.5 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* POPUP DROPDOWN MODAL (Mobile: Center Modal, Desktop: Docked Dropdown Under Header) */}
      {isDropdownOpen && hasMoreThanOne && (
        <>
          <div
            className="fixed inset-0 z-[1250] bg-black/40 backdrop-blur-xs pointer-events-auto"
            onClick={() => setIsDropdownOpen(false)}
          />
          <div className="fixed top-24 md:top-[136px] left-2 right-2 md:left-4 md:right-auto max-w-sm md:w-96 md:max-w-none mx-auto md:mx-0 bg-slate-900/98 backdrop-blur-2xl border border-slate-700/80 rounded-2xl shadow-2xl p-2.5 z-[1300] flex flex-col gap-1 pointer-events-auto animate-in fade-in zoom-in-95 duration-150 max-h-80 md:max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-slate-800 text-[11px] md:text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              <span>Мої адреси ({validLocations.length})</span>
              <button
                onClick={() => setIsDropdownOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {validLocations.map((loc) => {
              const status = getStatus(loc.feature) || 'on';
              const isSelected = selectedFeatureId === loc.feature.id;
              const statusBadge = getStatusBadge(status, isSelected);
              const displayName = loc.customLabel || loc.feature.name;

              return (
                <div
                  key={loc.id}
                  onClick={() => {
                    onSelectLocation(loc.feature);
                    setIsDropdownOpen(false);
                  }}
                  className={`w-full text-left px-2.5 py-2 rounded-xl flex items-center justify-between transition-colors gap-2 cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500/15 border border-amber-500/40'
                      : 'hover:bg-slate-800 active:bg-slate-750 bg-slate-900/60 border border-slate-800/80'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {getLabelIcon(loc.customLabel)}
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-xs text-white truncate">
                          {displayName}
                        </span>
                        {loc.feature.group && (
                          <span className="text-[10px] font-mono px-1 rounded bg-slate-800 text-amber-300 font-semibold border border-slate-700/50 shrink-0">
                            Ч.{loc.feature.group}
                          </span>
                        )}
                      </div>
                      {loc.customLabel && (
                        <span className="text-[10px] text-slate-400 truncate">
                          {loc.feature.name}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-800/80 border border-slate-700/40">
                      <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dot}`} />
                      <span className={`text-[10px] font-semibold ${statusBadge.textColor}`}>
                        {statusBadge.text}
                      </span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveLocation(loc.id, e);
                      }}
                      title="Видалити"
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
};
