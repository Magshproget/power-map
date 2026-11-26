import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Clock, X } from 'lucide-react';
import { ScheduleData, SelectedFeature, PowerStatus } from '../types';

interface TimeControllerProps {
  currentHour: number; // 0.0 .. 24.0
  onChangeHour: (h: number) => void;
  onSetNow: () => void;
  schedule: ScheduleData | null;
  selectedFeature?: SelectedFeature | null;
  onClearSelectedFeature?: () => void;
  isSearching?: boolean;
}

const MAJOR_HOURS = [0, 3, 6, 9, 12, 15, 18, 21, 24];
const MINOR_HOURS = Array.from({ length: 25 }, (_, h) => h).filter((h) => h % 3 !== 0);

const TimeControllerComponent: React.FC<TimeControllerProps> = ({
  currentHour,
  onChangeHour,
  onSetNow,
  schedule,
  selectedFeature,
  onClearSelectedFeature,
  isSearching,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [draftHour, setDraftHour] = useState<number | null>(null);

  const hourRef = useRef(currentHour);
  hourRef.current = currentHour;
  const draftRef = useRef<number>(currentHour);
  const rafRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);

  const displayHour = draftHour ?? currentHour;

  useEffect(() => {
    if (!isPlaying) return;
    isDraggingRef.current = false;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setDraftHour(null);
    const interval = setInterval(() => {
      const next = (hourRef.current + 0.5) % 24;
      hourRef.current = next;
      onChangeHour(next);
    }, 1200);
    return () => clearInterval(interval);
  }, [isPlaying, onChangeHour]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const handleScrubChange = (val: number) => {
    isDraggingRef.current = true;
    draftRef.current = val;
    setDraftHour(val);

    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        onChangeHour(draftRef.current);
      });
    }
  };

  const commitScrub = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    onChangeHour(draftRef.current);
    setDraftHour(null);
  };

  const formatTime = (hFloat: number) => {
    const totalMinutes = Math.round(hFloat * 60) % 1440;
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const groupsList = useMemo(
    () => (schedule?.groups ? Object.values(schedule.groups) : []),
    [schedule]
  );
  const totalGroups = groupsList.length || 12;

  const selectedGroupSchedule =
    selectedFeature?.group && schedule?.groups
      ? schedule.groups[selectedFeature.group]
      : null;

  const outageIntervals = selectedGroupSchedule?.intervals || [];
  const outageSummaryText =
    outageIntervals.length > 0
      ? outageIntervals.map((i) => `${i.start}–${i.end}`).join(', ')
      : selectedGroupSchedule?.desc?.includes('є')
      ? 'Без вимкнень'
      : null;

  const cleanFeatureName = selectedFeature?.name
    ? selectedFeature.name.replace(/\s*\(Черга\s+[^)]+\)/gi, '').trim()
    : '';

  const timelineSlots: { status: PowerStatus; tooltip: string }[] = useMemo(
    () =>
      Array.from({ length: 24 }, (_, h) => {
        if (selectedFeature?.group && schedule?.groups[selectedFeature.group]) {
          const g = schedule.groups[selectedFeature.group];
          const st = g.hourly[h];
          return {
            status: st,
            tooltip: `${h}:00 – ${h + 1}:00: ${
              st === 'on' ? 'Світло є' : 'Відключено (Черга ' + selectedFeature.group + ')'
            }`,
          };
        }

        if (selectedFeature?.groups && schedule?.groups) {
          const active = selectedFeature.groups
            .map((gid) => schedule.groups[gid])
            .filter(Boolean);
          const offCount = active.filter((g) => g.hourly[h] === 'off').length;
          if (offCount === 0) {
            return { status: 'on', tooltip: `${h}:00 – ${h + 1}:00: Усі черги зі світлом` };
          }
          if (offCount === active.length) {
            return { status: 'off', tooltip: `${h}:00 – ${h + 1}:00: Усі черги знеструмлено` };
          }
          return {
            status: 'maybe',
            tooltip: `${h}:00 – ${h + 1}:00: Частково (${offCount}/${active.length} черг вимкнено)`,
          };
        }

        const offCount = groupsList.filter((g) => g.hourly[h] === 'off').length;
        if (offCount === 0) {
          return { status: 'on', tooltip: `${h}:00 – ${h + 1}:00: Місто зі світлом (0 вимкнено)` };
        }
        if (offCount >= 4) {
          return {
            status: 'off',
            tooltip: `${h}:00 – ${h + 1}:00: Масові відключення (${offCount} черг вимкнено)`,
          };
        }
        return {
          status: 'maybe',
          tooltip: `${h}:00 – ${h + 1}:00: Локальні вимкнення (${offCount} з ${totalGroups} черг)`,
        };
      }),
    [selectedFeature, schedule, groupsList, totalGroups]
  );

  const currentSlot = Math.floor(displayHour) % 24;
  const offNowCount = groupsList.filter((g) => g.hourly[currentSlot] === 'off').length;
  const thumbPct = (displayHour / 24) * 100;

  return (
    <div
      className={`fixed bottom-[calc(0.5rem+env(safe-area-inset-bottom,0px))] md:bottom-6 left-2 right-2 md:left-1/2 md:-translate-x-1/2 md:w-[780px] lg:w-[840px] max-w-[calc(100vw-2rem)] z-[1000] bg-slate-900/95 p-2 md:p-4 rounded-xl md:rounded-3xl border border-slate-700/80 shadow-2xl flex-col gap-1.5 md:gap-3 pointer-events-auto ${
        selectedFeature || isSearching ? 'hidden md:flex' : 'flex'
      }`}
    >
      {/* Top row: Controls, Context name, Clock */}
      <div className="flex items-center justify-between gap-2 md:gap-3">
        <div className="flex items-center gap-2 md:gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsPlaying((p) => !p)}
            className="flex items-center justify-center w-11 h-11 md:w-10 md:h-10 rounded-xl md:rounded-2xl bg-amber-500 text-slate-950 hover:bg-amber-400 active:scale-95 transition-colors shadow-md font-semibold shrink-0"
            title={isPlaying ? 'Пауза' : 'Анімувати добу'}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 md:w-5 md:h-5 fill-current" />
            ) : (
              <Play className="w-4 h-4 md:w-5 md:h-5 fill-current ml-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={onSetNow}
            className="flex items-center justify-center gap-1.5 min-h-[44px] px-3 md:min-h-0 md:px-3 md:py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 active:scale-95 transition-colors shrink-0"
            title="Перейти на поточний час"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            <span>Зараз</span>
          </button>

          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/60 border border-slate-750 text-xs text-slate-300 shrink-0">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>
              Вимкнено:{' '}
              <strong className={offNowCount > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                {offNowCount}
              </strong>{' '}
              з {totalGroups} черг
            </span>
          </div>
        </div>

        {/* Selected target indicator or city badge */}
        <div className="hidden md:flex items-center gap-2 min-w-0 shrink">
          {selectedFeature ? (
            <div className="flex items-center gap-1.5 lg:gap-2 px-2.5 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-xs text-amber-300 min-w-0">
              <span className="truncate max-w-[110px] lg:max-w-[160px]">
                Графік: <strong>{cleanFeatureName}</strong>
              </span>
              {selectedFeature.group && (
                <span className="font-mono text-amber-300 font-bold px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700/60 shrink-0">
                  Ч.{selectedFeature.group}
                </span>
              )}
              {outageSummaryText && (
                <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 shrink-0 truncate max-w-[180px]">
                  {outageSummaryText === 'Без вимкнень' ? 'Без вимкнень' : `Вимкнення: ${outageSummaryText}`}
                </span>
              )}
              {onClearSelectedFeature && (
                <button
                  type="button"
                  onClick={onClearSelectedFeature}
                  className="hover:text-white p-0.5 rounded ml-0.5 shrink-0"
                  title="Повернутися до загального графіка міста"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-800/50 px-2.5 py-1 rounded-xl border border-slate-750 shrink-0">
              <span>Загальний графік (Львів)</span>
              {schedule?.updatedAt && (
                <span className="text-amber-400/90 font-mono font-medium">• Оновлено о {schedule.updatedAt}</span>
              )}
            </div>
          )}
        </div>

        {/* Selected Hour Clock Display */}
        <div className="flex items-baseline gap-1 bg-slate-800/90 px-2.5 py-1.5 md:px-3 md:py-1.5 rounded-xl md:rounded-2xl border border-slate-700/80 shrink-0">
          <span className="text-sm md:text-2xl font-bold font-mono text-white tracking-wider">
            {formatTime(displayHour)}
          </span>
          <span className="text-[9px] md:text-[11px] font-medium text-slate-400 uppercase">сьогодні</span>
        </div>
      </div>

      {/* 24-Hour Color Timeline Bar + Slider overlay */}
      <div className="flex flex-col gap-1.5 px-1">
        <div className="relative w-full py-2 md:py-1">
          {/* Segmented Color Bar (24 hours) */}
          <div className="grid grid-cols-[repeat(24,minmax(0,1fr))] gap-0.5 h-4 md:h-3.5 rounded-lg overflow-hidden bg-slate-800/90 p-0.5 border border-slate-700/70 shadow-inner pointer-events-none">
            {timelineSlots.map((slot, h) => {
              const isHourActive = currentSlot === h;
              const bgClass =
                slot.status === 'on'
                  ? 'bg-emerald-500'
                  : slot.status === 'off'
                  ? 'bg-rose-500'
                  : 'bg-amber-500';

              return (
                <div
                  key={h}
                  title={slot.tooltip}
                  className={`h-full rounded-sm ${bgClass} relative ${
                    isHourActive ? 'ring-2 ring-white z-10' : 'opacity-85'
                  }`}
                />
              );
            })}
          </div>

          {/* Interactive Range Slider with >= 44px mobile touch hit target */}
          <input
            type="range"
            min="0"
            max="23.5"
            step="0.5"
            value={displayHour}
            onChange={(e) => handleScrubChange(parseFloat(e.target.value))}
            onPointerUp={commitScrub}
            onPointerCancel={commitScrub}
            onTouchEnd={commitScrub}
            onTouchCancel={commitScrub}
            onMouseUp={commitScrub}
            onKeyUp={commitScrub}
            onBlur={commitScrub}
            className="w-full absolute left-0 right-0 top-1/2 -translate-y-1/2 opacity-0 cursor-pointer h-11 z-20 touch-none"
            title="Перетягніть для зміни часу"
          />

          {/* GPU-translated visual pointer cursor (no layout left transitions) */}
          <div
            className="absolute inset-0 pointer-events-none z-30 transition-none overflow-visible"
            style={{
              transform: `translate3d(${thumbPct}%, 0, 0)`,
              willChange: 'transform',
            }}
          >
            <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-6 bg-amber-400 rounded-full border-2 border-slate-950 shadow-[0_0_12px_rgba(251,191,36,0.9)] flex items-center justify-center">
              <div className="w-0.5 h-3 bg-slate-950/80 rounded-full" />
            </div>
          </div>
        </div>

        {/* Precision Ruler Ticks & Exact Hour Marks */}
        <div className="relative w-full h-5 select-none mt-0.5">
          {MINOR_HOURS.map((h) => {
            const pct = (h / 24) * 100;
            return (
              <div
                key={`tick-${h}`}
                className="absolute top-0 w-px h-1 bg-slate-700/80 pointer-events-none"
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
            const isMobileVisible = h % 6 === 0;

            return (
              <div
                key={`major-${h}`}
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
                <span
                  className={`text-[10px] text-slate-400 font-mono leading-none ${
                    isMobileVisible ? 'inline' : 'hidden md:inline'
                  }`}
                >
                  {timeLabel}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend & Hint (desktop only to save mobile height) */}
      <div className="hidden md:flex flex-wrap items-center justify-between text-[11px] md:text-xs text-slate-400 gap-2 pt-1 border-t border-slate-800">
        <div className="flex flex-wrap items-center gap-2.5 md:gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2 md:w-2.5 h-2 md:h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
            <span className="text-slate-300">Світло є</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 md:w-2.5 h-2 md:h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]"></span>
            <span className="text-slate-300">Немає світла</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 md:w-2.5 h-2 md:h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></span>
            <span className="text-slate-300">Змішано / Можливо</span>
          </div>
        </div>

        <span className="hidden sm:inline text-[11px] text-slate-400">
          Клікніть на кольорову смугу для переходу на годину
        </span>
      </div>
    </div>
  );
};

export const TimeController = React.memo(TimeControllerComponent);
