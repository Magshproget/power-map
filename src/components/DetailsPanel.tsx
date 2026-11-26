import React, { useEffect, useMemo, useRef } from 'react';
import { X, Zap, Shield, Grid, Navigation, AlertTriangle, CheckCircle2, MapPin, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { SelectedFeature, ScheduleData, PowerStatus } from '../types';

interface DetailsPanelProps {
  feature: SelectedFeature | null;
  onClose: () => void;
  selectedHour: number;
  onChangeHour?: (hour: number) => void;
  schedule: ScheduleData | null;
  onSelectStreet?: (streetName: string) => void;
  isSaved?: boolean;
  savedCustomLabel?: string;
  onToggleSaved?: (feature: SelectedFeature, customLabel?: string) => void;
  hasSavedLocations?: boolean;
  isSearching?: boolean;
}

const MINOR_HOURS = Array.from({ length: 25 }, (_, h) => h).filter((h) => h % 3 !== 0);
const INTERMEDIATE_HOURS = [3, 9, 15, 21];
const MAJOR_HOURS = [0, 6, 12, 18, 24];

const DetailsPanelComponent: React.FC<DetailsPanelProps> = ({
  feature,
  onClose,
  selectedHour,
  onChangeHour,
  schedule,
  onSelectStreet,
  isSaved,
  savedCustomLabel,
  onToggleSaved,
  hasSavedLocations,
  isSearching,
}) => {
  const touchStartYRef = useRef(0);
  const touchStartXRef = useRef(0);
  const dragYRef = useRef(0);
  const isDraggingRef = useRef(false);
  const startedOnHandleRef = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dragYRef.current = 0;
    isDraggingRef.current = false;
    startedOnHandleRef.current = false;
    if (panelRef.current) {
      panelRef.current.style.transform = '';
      panelRef.current.style.transition = '';
    }
  }, [feature?.id]);

  const hourSlot = Math.floor(selectedHour) % 24;

  const { status, intervalsSummary, hourlyBars, groupDesc } = useMemo(() => {
    let computedStatus: PowerStatus = 'on';
    let computedIntervals: string[] = [];
    let computedBars: PowerStatus[] = new Array(24).fill('on');
    let computedDesc = '';

    if (feature?.group && schedule?.groups[feature.group]) {
      const gData = schedule.groups[feature.group];
      computedStatus = gData.hourly[hourSlot];
      computedBars = gData.hourly;
      computedDesc = gData.desc;
      computedIntervals = gData.intervals.map((i) => `${i.start} – ${i.end}`);
    } else if (feature?.groups && schedule?.groups) {
      const activeGroups = feature.groups.map((g) => schedule.groups[g]).filter(Boolean);
      const offCount = activeGroups.filter((g) => g.hourly[hourSlot] === 'off').length;

      if (offCount === 0) {
        computedStatus = 'on';
      } else if (offCount === activeGroups.length) {
        computedStatus = 'off';
      } else {
        computedStatus = 'maybe';
      }

      computedBars = Array.from({ length: 24 }, (_, h) => {
        const offs = activeGroups.filter((g) => g.hourly[h] === 'off').length;
        if (offs === 0) return 'on';
        if (offs === activeGroups.length) return 'off';
        return 'maybe';
      });
    }

    return {
      status: computedStatus,
      intervalsSummary: computedIntervals,
      hourlyBars: computedBars,
      groupDesc: computedDesc,
    };
  }, [feature, schedule, hourSlot]);

  if (!feature) return null;

  const handleTouchStart = (e: React.TouchEvent) => {
    const startedOnHandle = Boolean(
      (e.target as HTMLElement | null)?.closest('[data-sheet-drag-handle="true"]')
    );
    if (panelRef.current && panelRef.current.scrollTop > 0 && !startedOnHandle) return;
    touchStartYRef.current = e.touches[0].clientY;
    touchStartXRef.current = e.touches[0].clientX;
    dragYRef.current = 0;
    startedOnHandleRef.current = startedOnHandle;
    isDraggingRef.current = true;
    if (panelRef.current) {
      panelRef.current.style.transition = 'none';
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current || !panelRef.current) return;
    const currentY = e.touches[0].clientY;
    const currentX = e.touches[0].clientX;
    const deltaY = currentY - touchStartYRef.current;
    const deltaX = Math.abs(currentX - touchStartXRef.current);

    if (panelRef.current.scrollTop > 0 || (!startedOnHandleRef.current && deltaY < -4)) {
      isDraggingRef.current = false;
      dragYRef.current = 0;
      panelRef.current.style.transform = '';
      panelRef.current.style.transition = '';
      return;
    }

    if (deltaX > Math.abs(deltaY) && dragYRef.current === 0) {
      isDraggingRef.current = false;
      dragYRef.current = 0;
      panelRef.current.style.transform = '';
      panelRef.current.style.transition = '';
      return;
    }

    const clamped = deltaY > 0 ? deltaY : 0;
    dragYRef.current = clamped;
    panelRef.current.style.transform = `translate3d(0, ${clamped}px, 0)`;
  };

  const handleTouchEnd = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    startedOnHandleRef.current = false;
    const finalY = dragYRef.current;
    dragYRef.current = 0;

    if (panelRef.current) {
      panelRef.current.style.transition = 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)';
      panelRef.current.style.transform = 'translate3d(0, 0, 0)';
    }

    if (finalY > 65) {
      onClose();
    }
  };

  const handleTouchCancel = () => {
    isDraggingRef.current = false;
    startedOnHandleRef.current = false;
    dragYRef.current = 0;
    if (panelRef.current) {
      panelRef.current.style.transition = '';
      panelRef.current.style.transform = '';
    }
  };

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
      onTouchCancel={handleTouchCancel}
      className={`details-panel-drawer fixed inset-x-0 bottom-0 md:bottom-auto ${
        hasSavedLocations ? 'md:top-[148px]' : 'md:top-[88px]'
      } md:left-4 z-[1200] md:z-[1000] w-full md:w-96 bg-slate-900/98 p-3 md:p-5 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] md:pb-5 rounded-t-2xl md:rounded-3xl border-t md:border border-slate-700/80 shadow-[0_-8px_30px_rgba(0,0,0,0.85)] md:shadow-2xl flex flex-col gap-2 md:gap-4 pointer-events-auto max-h-[42dvh] md:max-h-[calc(100dvh-220px)] overflow-y-auto animate-in slide-in-from-bottom duration-200 ${
        isSearching ? 'hidden md:flex' : ''
      }`}
    >
      {/* Mobile Drawer Grab Bar & Drag Header */}
      <div
        data-sheet-drag-handle="true"
        className="w-full flex justify-center py-2 -mt-2 -mb-1 md:hidden shrink-0 cursor-grab active:cursor-grabbing touch-none"
      >
        <div className="w-12 h-1.5 bg-slate-500/80 rounded-full" />
      </div>

      {/* Header */}
      <div
        data-sheet-drag-handle="true"
        className="flex items-start justify-between gap-2 touch-none md:touch-auto"
      >
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
              type="button"
              onClick={() => onToggleSaved(feature)}
              title={isSaved ? 'Видалити з обраного' : 'Зберегти в обране'}
              className={`min-w-[44px] min-h-[44px] md:min-w-[40px] md:min-h-[40px] flex items-center justify-center rounded-xl transition-colors active:scale-95 ${
                isSaved
                  ? 'bg-amber-500/25 text-amber-400 border border-amber-500/50 hover:bg-amber-500/35'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800 bg-slate-800/40 border border-slate-700/50'
              }`}
            >
              <Star className={`w-5 h-5 md:w-4.5 md:h-4.5 ${isSaved ? 'fill-amber-400 text-amber-400' : ''}`} />
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            title="Закрити"
            className="min-w-[44px] min-h-[44px] md:min-w-[40px] md:min-h-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 bg-slate-800/40 border border-slate-700/50 transition-colors active:scale-95"
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
                type="button"
                key={tag}
                onClick={() => onToggleSaved(feature, isTagActive ? undefined : tag)}
                className={`min-h-[36px] text-[11px] md:text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
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

          <div className="flex items-center gap-1 shrink-0">
            {onChangeHour ? (
              <div className="flex items-center bg-slate-900/80 rounded-lg border border-slate-700/80 p-0.5">
                <button
                  type="button"
                  onClick={() => onChangeHour((hourSlot - 1 + 24) % 24)}
                  className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-white rounded active:scale-95 transition-colors"
                  title="Попередня година"
                  aria-label="Попередня година"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[10px] md:text-xs font-mono font-semibold text-white px-1">
                  {hourSlot.toString().padStart(2, '0')}:00
                </span>
                <button
                  type="button"
                  onClick={() => onChangeHour((hourSlot + 1) % 24)}
                  className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-white rounded active:scale-95 transition-colors"
                  title="Наступна година"
                  aria-label="Наступна година"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <span className="text-[10px] md:text-xs font-mono font-semibold text-white bg-slate-900/70 px-1.5 py-0.5 md:py-1 rounded-md md:rounded-lg border border-slate-700/70">
                {hourSlot.toString().padStart(2, '0')}:00
              </span>
            )}
          </div>
        </div>

        {groupDesc && (
          <div className="flex flex-col gap-0.5 border-t border-white/5 pt-1 text-[10px] md:text-xs">
            <div className="flex items-center justify-between text-slate-400 text-[9px] md:text-[10px]">
              <span>Львівобленерго {schedule?.date ? `(${schedule.date})` : ''}</span>
              {schedule?.updatedAt && (
                <span className="text-amber-400/90 font-mono font-medium">
                  Оновлено о {schedule.updatedAt}
                </span>
              )}
            </div>
            <p className="text-slate-200 leading-tight">{groupDesc}</p>
          </div>
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

        <div className="grid grid-cols-[repeat(24,minmax(0,1fr))] gap-0.5 h-6 md:h-7 rounded-md md:rounded-lg overflow-hidden bg-slate-950/80 p-0.5 border border-slate-800">
          {hourlyBars.map((slotStatus, h) => {
            const isCurrent = h === hourSlot;
            const bgClass =
              slotStatus === 'on'
                ? 'bg-emerald-500'
                : slotStatus === 'off'
                ? 'bg-rose-500'
                : 'bg-amber-500';

            return (
              <button
                type="button"
                key={h}
                onClick={() => onChangeHour?.(h)}
                title={`${h}:00 – ${h + 1}:00: ${
                  slotStatus === 'on' ? 'Є світло' : slotStatus === 'off' ? 'Немає світла' : 'Частково'
                }`}
                aria-label={`Година ${h}:00`}
                className={`h-full rounded-xs ${bgClass} transition-transform active:scale-95 ${
                  isCurrent ? 'ring-2 ring-white z-10 scale-105' : 'opacity-85 hover:opacity-100'
                }`}
              />
            );
          })}
        </div>

        {/* Precision Ruler Ticks */}
        <div className="relative w-full h-5 select-none mt-1">
          {MINOR_HOURS.map((h) => {
            const pct = (h / 24) * 100;
            return (
              <div
                key={`dp-tick-${h}`}
                className="absolute top-0 w-px h-1 bg-slate-800 pointer-events-none"
                style={{
                  left: `${pct}%`,
                  transform: 'translateX(-50%)',
                }}
              />
            );
          })}

          {INTERMEDIATE_HOURS.map((h) => {
            const pct = (h / 24) * 100;
            return (
              <div
                key={`dp-inter-${h}`}
                className="absolute top-0 w-px h-1.5 bg-slate-700 pointer-events-none"
                style={{
                  left: `${pct}%`,
                  transform: 'translateX(-50%)',
                }}
              />
            );
          })}

          {MAJOR_HOURS.map((h) => {
            const pct = (h / 24) * 100;
            const timeLabel = `${h.toString().padStart(2, '0')}:00`;
            const isFirst = h === 0;
            const isLast = h === 24;

            return (
              <div
                key={`dp-major-${h}`}
                className="absolute top-0 flex flex-col items-center pointer-events-none"
                style={{
                  left: `${pct}%`,
                  transform: isFirst ? 'translateX(0%)' : isLast ? 'translateX(-100%)' : 'translateX(-50%)',
                }}
              >
                <div
                  className="w-px h-1.5 bg-slate-500 mb-0.5"
                  style={{
                    alignSelf: isFirst ? 'flex-start' : isLast ? 'flex-end' : 'center',
                  }}
                />
                <span className="text-[9px] md:text-[10px] text-slate-400 font-mono leading-none">
                  {timeLabel}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Key streets in this zone */}
      {feature.streets && feature.streets.length > 0 && (
        <div className="flex flex-col gap-2 pt-2 border-t border-slate-800">
          <span className="text-xs font-semibold text-slate-300">Вулиці цієї зони:</span>
          <div className="flex flex-wrap gap-1.5">
            {feature.streets.map((st) => (
              <button
                type="button"
                key={st}
                onClick={() => onSelectStreet && onSelectStreet(st)}
                className="min-h-[36px] text-xs px-3 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700 transition-colors"
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

export const DetailsPanel = React.memo(DetailsPanelComponent);
