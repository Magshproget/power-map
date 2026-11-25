import React from 'react';
import { Bookmark, Home, Briefcase, Heart, X } from 'lucide-react';
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

  if (savedLocations.length === 0) {
    return (
      <div className="hidden md:block fixed top-20 left-4 z-[990] pointer-events-auto">
        <div className="flex items-center gap-2 bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/50 shadow-lg text-xs text-slate-400">
          <Bookmark className="w-3.5 h-3.5 text-amber-400/80" />
          <span>Зберігайте адреси (дім, робота) через «★ В обране» для швидкого моніторингу</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`fixed top-11 md:top-20 left-2 md:left-4 right-2 md:right-4 z-[990] items-center gap-1.5 md:gap-2 pointer-events-none overflow-hidden ${
        selectedFeatureId || isSearching ? 'hidden md:flex' : 'flex'
      }`}
    >
      <div className="flex items-center gap-1.5 md:gap-2 overflow-x-auto py-1 scrollbar-none pointer-events-auto max-w-full">
        <div className="flex items-center gap-1.5 px-2 py-1 md:px-2.5 md:py-1.5 bg-slate-900/90 backdrop-blur-md rounded-lg md:rounded-xl border border-slate-700/60 shadow-lg text-[11px] md:text-xs font-semibold text-slate-300 shrink-0">
          <Bookmark className="w-3 h-3 md:w-3.5 md:h-3.5 text-amber-400 fill-amber-400/30" />
          <span className="hidden sm:inline">Мої адреси:</span>
        </div>

        {savedLocations.map((loc) => {
          const status = getStatus(loc.feature);
          const isSelected = selectedFeatureId === loc.feature.id;

          const statusBadge = {
            on: {
              dot: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]',
              text: 'Світло є',
              textColor: 'text-emerald-400',
              border: isSelected ? 'border-emerald-500 ring-2 ring-emerald-500/30' : 'border-slate-700/60',
            },
            off: {
              dot: 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]',
              text: 'Вимкнено',
              textColor: 'text-rose-400',
              border: isSelected ? 'border-rose-500 ring-2 ring-rose-500/30' : 'border-slate-700/60',
            },
            maybe: {
              dot: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]',
              text: 'Можливо',
              textColor: 'text-amber-400',
              border: isSelected ? 'border-amber-500 ring-2 ring-amber-500/30' : 'border-slate-700/60',
            },
          }[status];

          const displayName = loc.customLabel || loc.feature.name;

          return (
            <div
              key={loc.id}
              onClick={() => onSelectLocation(loc.feature)}
              className={`group flex items-center gap-1.5 md:gap-2 px-2.5 py-1 md:px-3 md:py-1.5 rounded-lg md:rounded-xl bg-slate-900/90 hover:bg-slate-800/95 backdrop-blur-md border ${statusBadge.border} shadow-lg cursor-pointer transition-all shrink-0 active:scale-95`}
              title={`${loc.feature.name} (${loc.feature.group ? `Черга ${loc.feature.group}` : 'Район'}) — ${statusBadge.text}`}
            >
              {getLabelIcon(loc.customLabel)}

              <div className="flex flex-col text-left">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-xs text-white leading-tight max-w-[130px] sm:max-w-[170px] truncate">
                    {displayName}
                  </span>
                  {loc.feature.group && (
                    <span className="text-[10px] font-mono px-1 rounded bg-slate-800 text-amber-300/90 border border-slate-700/50">
                      Ч.{loc.feature.group}
                    </span>
                  )}
                </div>
                {loc.customLabel && (
                  <span className="text-[10px] text-slate-400 truncate max-w-[130px] sm:max-w-[170px]">
                    {loc.feature.name}
                  </span>
                )}
              </div>

              {/* Status indicator */}
              <div className="flex items-center gap-1 ml-1 pl-1.5 border-l border-slate-700/60">
                <span className={`w-2 h-2 rounded-full ${statusBadge.dot}`} />
                <span className={`text-[11px] font-medium hidden sm:inline ${statusBadge.textColor}`}>
                  {statusBadge.text}
                </span>
              </div>

              {/* Remove button */}
              <button
                onClick={(e) => onRemoveLocation(loc.id, e)}
                title="Видалити з обраного"
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded-md hover:bg-slate-700 text-slate-400 hover:text-white transition-opacity ml-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
