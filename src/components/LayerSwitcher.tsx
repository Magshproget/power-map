import React from 'react';
import { Layers, Shield, Grid, Navigation } from 'lucide-react';
import { LayerMode } from '../types';

interface LayerSwitcherProps {
  mode: LayerMode;
  onChangeMode: (mode: LayerMode) => void;
  currentZoom: number;
}

export const LayerSwitcher: React.FC<LayerSwitcherProps> = ({
  mode,
  onChangeMode,
  currentZoom,
}) => {
  const options: { id: LayerMode; label: string; icon: React.ReactNode; desc: string }[] = [
    {
      id: 'auto',
      label: 'Авто-зум',
      icon: <Layers className="w-4 h-4" />,
      desc: 'Фокус на обраному (швидкий)',
    },
    {
      id: 'districts',
      label: 'Райони',
      icon: <Shield className="w-4 h-4" />,
      desc: '26 районів та громад',
    },
    {
      id: 'zones',
      label: 'Зони черг',
      icon: <Grid className="w-4 h-4" />,
      desc: 'Полігони груп 1.1–6.2',
    },
    {
      id: 'streets',
      label: 'Вулиці',
      icon: <Navigation className="w-4 h-4" />,
      desc: 'Точкові маркери вулиць',
    },
  ];

  return (
    <div className="hidden md:flex absolute top-24 right-4 z-[1000] bg-slate-900/90 backdrop-blur-md p-1.5 rounded-2xl border border-slate-700/60 shadow-xl flex-col gap-1 pointer-events-auto">
      <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
        <span>Шари мапи</span>
        <span className="text-[10px] text-slate-400 font-mono">z{Math.round(currentZoom)}</span>
      </div>

      <div className="flex flex-col gap-1">
        {options.map((opt) => {
          const isActive = mode === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => onChangeMode(opt.id)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all ${
                isActive
                  ? 'bg-amber-500 text-slate-950 font-semibold shadow-md'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <span className={isActive ? 'text-slate-950' : 'text-slate-400'}>
                {opt.icon}
              </span>
              <div className="flex flex-col">
                <span className="text-xs leading-none">{opt.label}</span>
                {opt.id === 'auto' && (
                  <span
                    className={`text-[10px] leading-tight mt-0.5 ${
                      isActive ? 'text-slate-900 font-medium' : 'text-amber-400/90'
                    }`}
                  >
                    {opt.desc}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
