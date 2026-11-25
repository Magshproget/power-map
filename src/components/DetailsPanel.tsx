import React, { useState, useRef } from 'react';
import { X, Zap, Shield, Grid, Navigation, AlertTriangle, CheckCircle2, MapPin, Star } from 'lucide-react';
import { SelectedFeature, ScheduleData, PowerStatus } from '../types';

interface DetailsPanelProps {
  feature: SelectedFeature | null;
  onClose: () => void;
  selectedHour: number;
  schedule: ScheduleData | null;
  onSelectStreet?: (streetName: string) => void;
  isSaved?: boolean;
  savedCustomLabel?: string;
  onToggleSaved?: (feature: SelectedFeature, customLabel?: string) => void;
}

export const DetailsPanel: React.FC<DetailsPanelProps> = ({
  feature,
  onClose,
  selectedHour,
  schedule,
  onSelectStreet,
  isSaved,
  savedCustomLabel,
  onToggleSaved,
}) => {
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartYRef = useRef(0);
  const touchStartXRef = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);

  if (!feature) return null;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (panelRef.current && panelRef.current.scrollTop > 0) return;
    touchStartYRef.current = e.touches[0].clientY;
    touchStartXRef.current = e.touches[0].clientX;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const currentY = e.touches[0].clientY;
    const currentX = e.touches[0].clientX;
    const deltaY = currentY - touchStartYRef.current;
    const deltaX = Math.abs(currentX - touchStartXRef.current);

    if (deltaX > Math.abs(deltaY) && dragY === 0) return;

    if (deltaY > 0) {
      setDragY(deltaY);
    } else {
      setDragY(0);
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragY > 65) {
      onClose();
    }
    setDragY(0);
  };

  const hourSlot = Math.floor(selectedHour) % 24;

  // Compute status for the selected hour
  let status: PowerStatus = 'on';
  let intervalsSummary: string[] = [];
  let hourlyBars: PowerStatus[] = new Array(24).fill('on');
  let groupDesc = '';

  if (feature.group && schedule?.groups[feature.group]) {
    const gData = schedule.groups[feature.group];
    status = gData.hourly[hourSlot];
    hourlyBars = gData.hourly;
    groupDesc = gData.desc;
    intervalsSummary = gData.intervals.map((i) => `${i.start} – ${i.end}`);
  } else if (feature.groups && schedule?.groups) {
    // For districts with multiple groups
    const activeGroups = feature.groups.map((g) => schedule.groups[g]).filter(Boolean);
    const offCount = activeGroups.filter((g) => g.hourly[hourSlot] === 'off').length;

    if (offCount === 0) {
      status = 'on';
    } else if (offCount === activeGroups.length) {
      status = 'off';
    } else {
      status = 'maybe';
    }

    // Composite 24h bar
    hourlyBars = Array.from({ length: 24 }, (_, h) => {
      const offs = activeGroups.filter((g) => g.hourly[h] === 'off').length;
      if (offs === 0) return 'on';
      if (offs === activeGroups.length) return 'off';
      return 'maybe';
    });
  }

  const statusConfig = {
    on: {
      label: 'Світло є',
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/20 border-emerald-500/30',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
    },
    off: {
      label: 'Відключено',
      color: 'text-rose-400',
      bg: 'bg-rose-500/20 border-rose-500/30',
      icon: <AlertTriangle className="w-5 h-5 text-rose-400" />,
    },
    maybe: {
      label: 'Часткове відключення',
      color: 'text-amber-400',
      bg: 'bg-amber-500/20 border-amber-500/30',
      icon: <Zap className="w-5 h-5 text-amber-400" />,
    },
  }[status];

  return (
    <div
      ref={panelRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
        transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      className="fixed inset-x-0 bottom-0 md:bottom-auto md:top-[136px] md:left-4 z-[1200] md:z-[1000] w-full md:w-96 bg-slate-900/98 md:bg-slate-900/95 backdrop-blur-2xl p-3 md:p-5 pb-4 md:pb-5 rounded-t-2xl md:rounded-3xl border-t md:border border-slate-700/80 shadow-[0_-8px_30px_rgba(0,0,0,0.85)] md:shadow-2xl flex flex-col gap-2 md:gap-4 pointer-events-auto max-h-[38vh] md:max-h-[calc(100vh-210px)] overflow-y-auto animate-in slide-in-from-bottom duration-200"
    >
      {/* Mobile Drawer Grab Bar */}
      <div className="w-full flex justify-center py-1.5 -mt-2 -mb-1 md:hidden shrink-0 cursor-grab active:cursor-grabbing">
        <div className="w-12 h-1.5 bg-slate-500/80 rounded-full" />
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 md:p-2.5 rounded-lg md:rounded-2xl bg-slate-800 border border-slate-700 text-amber-400 shrink-0">
            {feature.type === 'district' ? (
              <Shield className="w-4 h-4 md:w-5 md:h-5" />
            ) : feature.type === 'zone' ? (
              <Grid className="w-4 h-4 md:w-5 md:h-5" />
            ) : (
              <Navigation className="w-4 h-4 md:w-5 md:h-5" />
            )}
          </div>
          <div className="min-w-0">
            <span className="text-[9px] md:text-[11px] font-semibold text-slate-400 uppercase tracking-wider block leading-none mb-0.5">
              {feature.type === 'district'
                ? 'Адміністративний район'
                : feature.type === 'zone'
                ? 'Зона черги'
                : 'Вулиця'}
            </span>
            <h2 className="text-xs md:text-base font-bold text-white leading-tight truncate">{feature.name}</h2>
            {feature.districtName && (
              <span className="text-[10px] md:text-xs text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                <MapPin className="w-2.5 h-2.5 md:w-3 md:h-3 text-slate-500 shrink-0" />
                <span className="truncate">{feature.districtName}</span>
                {feature.buildings && <span className="shrink-0">• буд. {feature.buildings}</span>}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onToggleSaved && (
            <button
              onClick={() => onToggleSaved(feature)}
              title={isSaved ? 'Видалити з обраного' : 'Зберегти в обране'}
              className={`p-2 md:p-2 rounded-xl transition-all active:scale-95 ${
                isSaved
                  ? 'bg-amber-500/25 text-amber-400 border border-amber-500/50 hover:bg-amber-500/35'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800 bg-slate-800/40 border border-slate-700/50'
              }`}
            >
              <Star className={`w-5 h-5 md:w-4.5 md:h-4.5 ${isSaved ? 'fill-amber-400 text-amber-400' : ''}`} />
            </button>
          )}

          <button
            onClick={onClose}
            title="Закрити"
            className="p-2 md:p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 bg-slate-800/40 border border-slate-700/50 transition-all active:scale-95"
          >
            <X className="w-5 h-5 md:w-4.5 md:h-4.5" />
          </button>
        </div>
      </div>

      {/* Quick Tag Selector if saved */}
      {isSaved && onToggleSaved && (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-800/60 rounded-lg border border-slate-700/60">
          <span className="text-[9px] md:text-[11px] text-slate-400 font-medium mr-0.5">Мітка:</span>
          {['Дім', 'Робота', 'Батьки'].map((tag) => {
            const isTagActive = savedCustomLabel === tag;
            return (
              <button
                key={tag}
                onClick={() => onToggleSaved(feature, isTagActive ? undefined : tag)}
                className={`text-[10px] md:text-xs px-2 py-0.5 rounded-md md:rounded-lg border transition-all ${
                  isTagActive
                    ? 'bg-amber-500/25 border-amber-500/50 text-amber-300 font-semibold shadow-sm'
                    : 'bg-slate-800/80 border-slate-700/60 text-slate-400 hover:text-white hover:border-slate-600'
                }`}
              >
                {tag === 'Дім' ? '🏠 Дім' : tag === 'Робота' ? '💼 Робота' : '❤️ Батьки'}
              </button>
            );
          })}
        </div>
      )}

      {/* Power status card with integrated notice */}
      <div className={`p-2 md:p-3 rounded-xl border ${statusConfig.bg} flex flex-col gap-1.5`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {React.cloneElement(statusConfig.icon, { className: 'w-4 h-4 md:w-5 md:h-5' })}
            <div className="flex items-center gap-1.5">
              <span className={`font-bold text-xs md:text-sm ${statusConfig.color}`}>
                {statusConfig.label}
              </span>
              <span className="text-[10px] md:text-xs text-slate-400 font-medium">
                {feature.group ? `• Черга ${feature.group}` : `• Черги: ${feature.groups?.join(', ')}`}
              </span>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-[10px] md:text-xs font-mono font-semibold text-white bg-slate-900/70 px-1.5 py-0.5 md:py-1 rounded-md md:rounded-lg border border-slate-700/70">
              {Math.floor(selectedHour).toString().padStart(2, '0')}:00
            </span>
          </div>
        </div>

        {groupDesc && (
          <p className="text-[10px] md:text-xs text-slate-300 leading-tight border-t border-white/5 pt-1">
            <span className="text-slate-400">Львівобленерго: </span>
            {groupDesc}
          </p>
        )}
      </div>

      {/* 24-Hour Timeline */}
      <div className="flex flex-col gap-1 md:gap-2">
        <div className="flex justify-between items-center text-[10px] md:text-xs text-slate-400">
          <span className="font-semibold text-slate-300">Графік 24г:</span>
          <span className="truncate max-w-[190px] sm:max-w-none text-[9px] md:text-xs">
            {intervalsSummary.length > 0 ? `Вимкнення: ${intervalsSummary.join(', ')}` : 'Без вимкнень'}
          </span>
        </div>

        <div className="grid grid-cols-[repeat(24,minmax(0,1fr))] gap-0.5 h-4 md:h-6 rounded-md md:rounded-lg overflow-hidden bg-slate-950/80 p-0.5 border border-slate-800">
          {hourlyBars.map((slotStatus, h) => {
            const isCurrent = h === hourSlot;
            const bgClass =
              slotStatus === 'on'
                ? 'bg-emerald-500'
                : slotStatus === 'off'
                ? 'bg-rose-500'
                : 'bg-amber-500';

            return (
              <div
                key={h}
                title={`${h}:00 – ${h + 1}:00: ${
                  slotStatus === 'on' ? 'Є світло' : slotStatus === 'off' ? 'Немає світла' : 'Частково'
                }`}
                className={`h-full rounded-xs ${bgClass} transition-all ${
                  isCurrent ? 'ring-2 ring-white scale-110 z-10' : 'opacity-85 hover:opacity-100'
                }`}
              />
            );
          })}
        </div>
        <div className="flex justify-between text-[9px] md:text-[10px] text-slate-400 font-mono px-0.5">
          <span>00:00</span>
          <span>06:00</span>
          <span>12:00</span>
          <span>18:00</span>
          <span>24:00</span>
        </div>
      </div>

      {/* Key streets in this zone */}
      {feature.streets && feature.streets.length > 0 && (
        <div className="flex flex-col gap-2 pt-2 border-t border-slate-800">
          <span className="text-xs font-semibold text-slate-300">Вулиці цієї зони:</span>
          <div className="flex flex-wrap gap-1.5">
            {feature.streets.map((st) => (
              <button
                key={st}
                onClick={() => onSelectStreet && onSelectStreet(st)}
                className="text-xs px-2.5 py-1 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700 transition-colors"
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
