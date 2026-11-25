import React from 'react';
import { X, Zap, Shield, Grid, Navigation, AlertTriangle, CheckCircle2, MapPin } from 'lucide-react';
import { SelectedFeature, ScheduleData, PowerStatus } from '../types';

interface DetailsPanelProps {
  feature: SelectedFeature | null;
  onClose: () => void;
  selectedHour: number;
  schedule: ScheduleData | null;
  onSelectStreet?: (streetName: string) => void;
}

export const DetailsPanel: React.FC<DetailsPanelProps> = ({
  feature,
  onClose,
  selectedHour,
  schedule,
  onSelectStreet,
}) => {
  if (!feature) return null;

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
    <div className="absolute top-24 left-4 z-[1000] w-88 md:w-96 bg-slate-900/95 backdrop-blur-xl p-5 rounded-3xl border border-slate-700/70 shadow-2xl flex flex-col gap-4 pointer-events-auto max-h-[calc(100vh-180px)] overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-slate-800 border border-slate-700 text-amber-400">
            {feature.type === 'district' ? (
              <Shield className="w-5 h-5" />
            ) : feature.type === 'zone' ? (
              <Grid className="w-5 h-5" />
            ) : (
              <Navigation className="w-5 h-5" />
            )}
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              {feature.type === 'district'
                ? 'Адміністративний район'
                : feature.type === 'zone'
                ? 'Зона черги'
                : 'Вулиця'}
            </span>
            <h2 className="text-base font-bold text-white leading-tight">{feature.name}</h2>
            {feature.districtName && (
              <span className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3 text-slate-500" />
                {feature.districtName}
                {feature.buildings && ` • буд. ${feature.buildings}`}
              </span>
            )}
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Power status card */}
      <div className={`p-3.5 rounded-2xl border ${statusConfig.bg} flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          {statusConfig.icon}
          <div>
            <div className={`font-bold text-sm ${statusConfig.color}`}>
              {statusConfig.label}
            </div>
            <div className="text-xs text-slate-400">
              {feature.group ? `Черга ${feature.group}` : `Черги: ${feature.groups?.join(', ')}`}
            </div>
          </div>
        </div>

        <div className="text-right">
          <span className="text-xs font-mono text-white bg-slate-900/60 px-2 py-1 rounded-lg border border-slate-700">
            {Math.floor(selectedHour).toString().padStart(2, '0')}:00
          </span>
        </div>
      </div>

      {/* Official notice from Oblenergo */}
      {groupDesc && (
        <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-750 text-xs text-slate-300">
          <span className="text-slate-400 block mb-1 font-medium">Офіційний статус Львівобленерго:</span>
          <p className="font-medium text-white">{groupDesc}</p>
        </div>
      )}

      {/* 24-Hour Timeline */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center text-xs text-slate-400">
          <span className="font-semibold text-slate-300">Графік на 24 години:</span>
          <span>{intervalsSummary.length > 0 ? `Відключення: ${intervalsSummary.join(', ')}` : 'Без вимкнень'}</span>
        </div>

        <div className="grid grid-cols-12 gap-1 bg-slate-950/60 p-2 rounded-2xl border border-slate-800">
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
                className={`relative flex flex-col items-center justify-end h-8 rounded-lg ${bgClass} transition-all cursor-pointer ${
                  isCurrent ? 'ring-2 ring-white scale-105 z-10' : 'opacity-85 hover:opacity-100'
                }`}
              >
                <span className="text-[9px] font-mono font-bold text-slate-950 pb-0.5">
                  {h % 4 === 0 ? h : ''}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-[10px] text-slate-400 font-mono px-1">
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
