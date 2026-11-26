import React, { useEffect, useState } from 'react';
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

export const TimeController: React.FC<TimeControllerProps> = ({
  currentHour,
  onChangeHour,
  onSetNow,
  schedule,
  selectedFeature,
  onClearSelectedFeature,
  isSearching,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      onChangeHour((currentHour + 0.5) % 24);
    }, 1200);
    return () => clearInterval(interval);
  }, [isPlaying, currentHour, onChangeHour]);

  const formatTime = (hFloat: number) => {
    const totalMinutes = Math.round(hFloat * 60) % 1440;
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  // Compute 24-hour timeline slots
  const groupsList = schedule?.groups ? Object.values(schedule.groups) : [];
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

  const timelineSlots: { status: PowerStatus; tooltip: string }[] = Array.from({ length: 24 }, (_, h) => {
    if (selectedFeature?.group && schedule?.groups[selectedFeature.group]) {
      const g = schedule.groups[selectedFeature.group];
      const st = g.hourly[h];
      return {
        status: st,
        tooltip: `${h}:00 – ${h + 1}:00: ${st === 'on' ? 'Світло є' : 'Відключено (Черга ' + selectedFeature.group + ')'}`,
      };
    }

    if (selectedFeature?.groups && schedule?.groups) {
      const active = selectedFeature.groups.map((gid) => schedule.groups[gid]).filter(Boolean);
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

    // City-wide status
    const offCount = groupsList.filter((g) => g.hourly[h] === 'off').length;
    if (offCount === 0) {
      return { status: 'on', tooltip: `${h}:00 – ${h + 1}:00: Місто зі світлом (0 вимкнено)` };
    }
    if (offCount >= 4) {
      return { status: 'off', tooltip: `${h}:00 – ${h + 1}:00: Масові відключення (${offCount} черг вимкнено)` };
    }
    return { status: 'maybe', tooltip: `${h}:00 – ${h + 1}:00: Локальні вимкнення (${offCount} з ${totalGroups} черг)` };
  });

  // Current stats
  const currentSlot = Math.floor(currentHour) % 24;
  const offNowCount = groupsList.filter((g) => g.hourly[currentSlot] === 'off').length;

  return (
    <div
      className={`fixed bottom-2 md:bottom-6 left-2 right-2 md:left-1/2 md:-translate-x-1/2 md:w-[740px] z-[1000] bg-slate-900/95 backdrop-blur-xl p-2 md:p-4 rounded-xl md:rounded-3xl border border-slate-700/80 shadow-2xl flex-col gap-1 md:gap-3 pointer-events-auto ${
        selectedFeature || isSearching ? 'hidden md:flex' : 'flex'
      }`}
    >
      {/* Top row: Controls, Context name, Clock */}
      <div className="flex items-center justify-between gap-2 md:gap-3">
        <div className="flex items-center gap-1.5 md:gap-2.5">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center justify-center w-7 h-7 md:w-10 md:h-10 rounded-lg md:rounded-2xl bg-amber-500 text-slate-950 hover:bg-amber-400 active:scale-95 transition-all shadow-md font-semibold shrink-0"
            title={isPlaying ? 'Пауза' : 'Анімувати добу'}
          >
            {isPlaying ? (
              <Pause className="w-3.5 h-3.5 md:w-5 md:h-5 fill-current" />
            ) : (
              <Play className="w-3.5 h-3.5 md:w-5 md:h-5 fill-current ml-0.5" />
            )}
          </button>

          <button
            onClick={onSetNow}
            className="flex items-center gap-1 px-2 py-1 md:px-3 md:py-2 rounded-lg md:rounded-xl bg-slate-800 hover:bg-slate-700 text-[11px] md:text-xs font-medium text-slate-200 border border-slate-700 active:scale-95 transition-all shrink-0"
            title="Перейти на поточний час"
          >
            <RotateCcw className="w-3 h-3 md:w-3.5 md:h-3.5 text-amber-400" />
            <span>Зараз</span>
          </button>

          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/60 border border-slate-750 text-xs text-slate-300">
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
        <div className="hidden md:flex items-center gap-2">
          {selectedFeature ? (
            <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-xs text-amber-300">
              <span className="truncate max-w-[150px]">
                Графік: <strong>{cleanFeatureName}</strong>
              </span>
              {selectedFeature.group && (
                <span className="font-mono text-amber-300 font-bold px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700/60 shrink-0">
                  Ч.{selectedFeature.group}
                </span>
              )}
              {outageSummaryText && (
                <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 shrink-0">
                  {outageSummaryText === 'Без вимкнень' ? 'Без вимкнень' : `Вимкнення: ${outageSummaryText}`}
                </span>
              )}
              {onClearSelectedFeature && (
                <button
                  onClick={onClearSelectedFeature}
                  className="hover:text-white p-0.5 rounded ml-0.5"
                  title="Повернутися до загального графіка міста"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-800/50 px-2.5 py-1 rounded-xl border border-slate-750">
              <span>Загальний графік (Львів)</span>
              {schedule?.updatedAt && (
                <span className="text-amber-400/90 font-mono font-medium">• Оновлено о {schedule.updatedAt}</span>
              )}
            </div>
          )}
        </div>

        {/* Selected Hour Clock Display */}
        <div className="flex items-baseline gap-1 bg-slate-800/90 px-2.5 py-1 md:px-3.5 md:py-1.5 rounded-xl md:rounded-2xl border border-slate-700/80">
          <span className="text-sm md:text-2xl font-bold font-mono text-white tracking-wider">
            {formatTime(currentHour)}
          </span>
          <span className="text-[9px] md:text-[11px] font-medium text-slate-400 uppercase">сьогодні</span>
        </div>
      </div>

      {/* 24-Hour Color Timeline Bar + Slider overlay */}
      <div className="flex flex-col gap-1.5 px-1">
        <div className="relative w-full">
          {/* Segmented Color Bar (24 hours) */}
          <div className="grid grid-cols-[repeat(24,minmax(0,1fr))] gap-0.5 h-3.5 rounded-lg overflow-hidden bg-slate-800/90 p-0.5 border border-slate-700/70 shadow-inner">
            {timelineSlots.map((slot, h) => {
              const isHourActive = Math.floor(currentHour) === h;
              const bgClass =
                slot.status === 'on'
                  ? 'bg-emerald-500'
                  : slot.status === 'off'
                  ? 'bg-rose-500'
                  : 'bg-amber-500';

              return (
                <button
                  key={h}
                  onClick={() => onChangeHour(h)}
                  title={slot.tooltip}
                  className={`h-full rounded-sm ${bgClass} transition-all relative ${
                    isHourActive ? 'ring-2 ring-white scale-110 z-10' : 'opacity-85 hover:opacity-100'
                  }`}
                />
              );
            })}
          </div>

          {/* Interactive Range Slider overlaid on top */}
          <input
            type="range"
            min="0"
            max="23.5"
            step="0.5"
            value={currentHour}
            onChange={(e) => onChangeHour(parseFloat(e.target.value))}
            className="w-full absolute inset-0 opacity-0 cursor-pointer h-full z-20"
            title="Перетягніть для зміни часу"
          />

          {/* Visual pointer cursor */}
          <div
            className="absolute top-1/2 -translate-y-1/2 pointer-events-none transition-all z-30"
            style={{
              left: `${(currentHour / 24) * 100}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div className="w-4 h-6 bg-amber-400 rounded-full border-2 border-slate-950 shadow-[0_0_12px_rgba(251,191,36,0.9)] flex items-center justify-center">
              <div className="w-0.5 h-3 bg-slate-950/80 rounded-full" />
            </div>
          </div>
        </div>

        {/* Precision Ruler Ticks & Exact Hour Marks */}
        <div className="relative w-full h-5 select-none mt-1">
          {/* Minor 1-hour ticks */}
          {Array.from({ length: 25 }, (_, h) => {
            if (h % 3 === 0) return null;
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

          {/* Major 3-hour ticks with numbers */}
          {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => {
            const pct = (h / 24) * 100;
            const timeLabel = `${h.toString().padStart(2, '0')}:00`;
            const isFirst = h === 0;
            const isLast = h === 24;

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
                <span className="text-[10px] text-slate-400 font-mono leading-none">
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
