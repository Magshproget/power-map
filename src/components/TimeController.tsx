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
}

export const TimeController: React.FC<TimeControllerProps> = ({
  currentHour,
  onChangeHour,
  onSetNow,
  schedule,
  selectedFeature,
  onClearSelectedFeature,
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
    <div className="absolute bottom-6 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-[740px] z-[1000] bg-slate-900/95 backdrop-blur-xl p-4 rounded-3xl border border-slate-700/80 shadow-2xl flex flex-col gap-3 pointer-events-auto">
      {/* Top row: Controls, Context name, Clock */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center justify-center w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 hover:bg-amber-400 active:scale-95 transition-all shadow-lg shadow-amber-500/20 font-semibold"
            title={isPlaying ? 'Пауза' : 'Анімувати добу'}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-0.5" />
            )}
          </button>

          <button
            onClick={onSetNow}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 active:scale-95 transition-all"
            title="Перейти на поточний час"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
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
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-xs text-amber-300">
              <span>Графік: <strong>{selectedFeature.name}</strong></span>
              {selectedFeature.group && (
                <span className="font-mono text-amber-400">({selectedFeature.group})</span>
              )}
              {onClearSelectedFeature && (
                <button
                  onClick={onClearSelectedFeature}
                  className="hover:text-white p-0.5 rounded ml-1"
                  title="Повернутися до загального графіка міста"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ) : (
            <span className="text-xs text-slate-400 bg-slate-800/50 px-2.5 py-1 rounded-xl border border-slate-750">
              Загальний графік (Львів)
            </span>
          )}
        </div>

        {/* Selected Hour Clock Display */}
        <div className="flex items-baseline gap-1.5 bg-slate-800/90 px-3.5 py-1.5 rounded-2xl border border-slate-700/80">
          <span className="text-2xl font-bold font-mono text-white tracking-wider">
            {formatTime(currentHour)}
          </span>
          <span className="text-[11px] font-medium text-slate-400 uppercase">сьогодні</span>
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
              left: `calc(${(currentHour / 24) * 100}% - 7px)`,
            }}
          >
            <div className="w-3.5 h-5 bg-amber-400 rounded-full border-2 border-slate-950 shadow-[0_0_10px_rgba(251,191,36,0.8)]" />
          </div>
        </div>

        {/* Hours ticks */}
        <div className="flex justify-between text-[10px] text-slate-400 font-mono px-0.5 select-none pt-0.5">
          <span>00:00</span>
          <span>03:00</span>
          <span>06:00</span>
          <span>09:00</span>
          <span>12:00</span>
          <span>15:00</span>
          <span>18:00</span>
          <span>21:00</span>
          <span>24:00</span>
        </div>
      </div>

      {/* Legend & Hint */}
      <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
            <span className="text-slate-300">Світло є</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]"></span>
            <span className="text-slate-300">Немає світла</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></span>
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
