import React, { useEffect, useState } from 'react';
import { Play, Pause, RotateCcw, Clock } from 'lucide-react';
import { ScheduleData } from '../types';

interface TimeControllerProps {
  currentHour: number; // 0.0 .. 24.0
  onChangeHour: (h: number) => void;
  onSetNow: () => void;
  schedule: ScheduleData | null;
}

export const TimeController: React.FC<TimeControllerProps> = ({
  currentHour,
  onChangeHour,
  onSetNow,
  schedule,
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

  // Compute stats for current hour
  const groups = schedule?.groups ? Object.values(schedule.groups) : [];
  const offGroupsCount = groups.filter((g) => {
    const slot = Math.floor(currentHour) % 24;
    return g.hourly[slot] === 'off';
  }).length;

  return (
    <div className="absolute bottom-6 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-[720px] z-[1000] bg-slate-900/95 backdrop-blur-xl p-4 rounded-3xl border border-slate-700/70 shadow-2xl flex flex-col gap-3 pointer-events-auto">
      {/* Top row: Status, Time display, Controls */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center justify-center w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 hover:bg-amber-400 active:scale-95 transition-all shadow-lg shadow-amber-500/20 font-semibold"
            title={isPlaying ? 'Пауза' : 'Анімувати добу'}
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
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
              <strong className={offGroupsCount > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                {offGroupsCount}
              </strong>{' '}
              з {groups.length || 12} черг
            </span>
          </div>
        </div>

        {/* Selected Hour Clock Display */}
        <div className="flex items-baseline gap-1.5 bg-slate-800/90 px-4 py-1.5 rounded-2xl border border-slate-700/80">
          <span className="text-2xl font-bold font-mono text-white tracking-wider">
            {formatTime(currentHour)}
          </span>
          <span className="text-[11px] font-medium text-slate-400 uppercase">сьогодні</span>
        </div>
      </div>

      {/* Slider bar */}
      <div className="flex flex-col gap-1.5 px-1">
        <input
          type="range"
          min="0"
          max="23.5"
          step="0.5"
          value={currentHour}
          onChange={(e) => onChangeHour(parseFloat(e.target.value))}
          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500 focus:outline-none"
        />

        {/* Hours ticks */}
        <div className="flex justify-between text-[10px] text-slate-400 font-mono px-0.5 select-none">
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

      {/* Legend */}
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
          Клікніть на район або зону для деталей
        </span>
      </div>
    </div>
  );
};
