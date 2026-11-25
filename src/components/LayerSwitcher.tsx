import React, { useState } from 'react';
import { Layers, Shield, Grid, Navigation, X } from 'lucide-react';
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
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const options: { id: LayerMode; label: string; icon: React.ReactNode; desc: string }[] = [
    {
      id: 'auto',
      label: 'Авто-зум',
      icon: <Layers className="w-4 h-4" />,
      desc: currentZoom < 13 ? 'Зараз: Райони' : currentZoom < 16.5 ? 'Зараз: Зони черг' : 'Зараз: Вулиці',
    },
    {
      id: 'districts',
      label: 'Райони',
      icon: <Shield className="w-4 h-4" />,
      desc: '27 районів та громад',
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

  const currentOption = options.find((o) => o.id === mode) || options[0];

  return (
    <>
      {/* Mobile Toggle Button */}
      <div className="md:hidden absolute top-[102px] right-3 z-[1000] pointer-events-auto">
        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/95 backdrop-blur-md border border-slate-700/70 shadow-lg text-xs font-semibold text-slate-200 active:scale-95 transition-all"
        >
          <Layers className="w-3.5 h-3.5 text-amber-400" />
          <span>{currentOption.label}</span>
          <span className="text-[10px] text-slate-400 font-mono">z{Math.round(currentZoom)}</span>
        </button>

        {/* Mobile Dropdown Popover */}
        {isMobileOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs"
              onClick={() => setIsMobileOpen(false)}
            />
            <div className="absolute top-full right-0 mt-2 w-64 bg-slate-900/98 backdrop-blur-2xl p-2 rounded-2xl border border-slate-700/80 shadow-2xl z-50 flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between border-b border-slate-800 pb-2 mb-1">
                <span>Шари мапи</span>
                <button
                  onClick={() => setIsMobileOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {options.map((opt) => {
                const isActive = mode === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => {
                      onChangeMode(opt.id);
                      setIsMobileOpen(false);
                    }}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all ${
                      isActive
                        ? 'bg-amber-500 text-slate-950 font-semibold shadow-md'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <span className={isActive ? 'text-slate-950' : 'text-slate-400'}>
                      {opt.icon}
                    </span>
                    <div className="flex flex-col">
                      <span className="text-xs leading-none">{opt.label}</span>
                      <span
                        className={`text-[10px] leading-tight mt-0.5 ${
                          isActive ? 'text-slate-900 font-medium' : 'text-slate-400'
                        }`}
                      >
                        {opt.desc}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Desktop Panel */}
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
    </>
  );
};
