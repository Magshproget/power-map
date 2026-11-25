import React, { useState } from 'react';
import { Search, Zap, Clock, RefreshCw, X } from 'lucide-react';
import { ScheduleData, StreetItem, SelectedFeature } from '../types';
import streetsData from '../data/streets.json';
import districtsData from '../data/districts.json';
import zonesData from '../data/zones.json';

interface HeaderProps {
  schedule: ScheduleData | null;
  onRefresh: () => void;
  isLoading: boolean;
  onSelectFeature: (feature: SelectedFeature) => void;
}

export const Header: React.FC<HeaderProps> = ({
  schedule,
  onRefresh,
  isLoading,
  onSelectFeature,
}) => {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const streets = streetsData as StreetItem[];
  const districts = districtsData.features;
  const zones = zonesData.features;

  const filteredStreets = query.trim().length > 1
    ? streets.filter((s) => s.name.toLowerCase().includes(query.toLowerCase())).slice(0, 5)
    : [];

  const filteredDistricts = query.trim().length > 1
    ? districts.filter((d) => d.properties.name.toLowerCase().includes(query.toLowerCase())).slice(0, 3)
    : [];

  const filteredZones = query.trim().length > 1
    ? zones.filter((z) =>
        z.properties.name.toLowerCase().includes(query.toLowerCase()) ||
        z.properties.group.includes(query)
      ).slice(0, 4)
    : [];

  const hasResults =
    filteredStreets.length > 0 || filteredDistricts.length > 0 || filteredZones.length > 0;

  return (
    <header className="absolute top-4 left-4 right-4 z-[1000] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pointer-events-none">
      {/* Brand & Status Banner */}
      <div className="flex items-center gap-3 bg-slate-900/90 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-slate-700/60 shadow-xl pointer-events-auto">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
          <Zap className="w-5 h-5 fill-amber-400 text-amber-400" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-base text-white tracking-wide">
              СвітлоМапа <span className="text-amber-400 font-semibold text-sm">Львів</span>
            </h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              {schedule?.isLive ? 'LIVE' : 'Автономно'}
            </span>
          </div>
          <p className="text-xs text-slate-400 flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-slate-500" />
            <span>{schedule?.title || 'Графік відключень на сьогодні'}</span>
            {schedule?.updatedAt && (
              <span className="text-slate-500">• {schedule.updatedAt}</span>
            )}
          </p>
        </div>

        <button
          onClick={onRefresh}
          disabled={isLoading}
          title="Оновити графік"
          className="ml-2 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-all active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
        </button>
      </div>

      {/* Street & Zone Search Bar */}
      <div className="relative w-full md:w-96 pointer-events-auto">
        <div className="flex items-center bg-slate-900/90 backdrop-blur-md px-3.5 py-2.5 rounded-2xl border border-slate-700/60 shadow-xl focus-within:border-amber-500/60 focus-within:ring-2 focus-within:ring-amber-500/20 transition-all">
          <Search className="w-4 h-4 text-slate-400 shrink-0 mr-2.5" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            placeholder="Введіть вулицю або мікрорайон..."
            className="w-full bg-transparent text-sm text-white placeholder-slate-400 outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dropdown Results */}
        {isFocused && query.trim().length > 1 && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsFocused(false)}
            />
            <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900/95 backdrop-blur-xl border border-slate-700/70 rounded-2xl shadow-2xl overflow-hidden z-50 max-h-80 overflow-y-auto">
              {!hasResults ? (
                <div className="p-4 text-center text-sm text-slate-400">
                  Нічого не знайдено за запитом "{query}"
                </div>
              ) : (
                <div className="py-2">
                  {filteredDistricts.length > 0 && (
                    <div className="px-3 py-1">
                      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                        Райони
                      </div>
                      {filteredDistricts.map((d) => (
                        <button
                          key={d.id}
                          onClick={() => {
                            onSelectFeature({
                              type: 'district',
                              id: d.id,
                              name: d.properties.name,
                              groups: d.properties.primaryGroups,
                              streets: d.properties.keyStreets,
                              center: d.properties.center as [number, number],
                            });
                            setIsFocused(false);
                            setQuery('');
                          }}
                          className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-800 flex items-center justify-between text-sm text-slate-200 transition-colors"
                        >
                          <span className="font-medium">{d.properties.name}</span>
                          <span className="text-xs text-amber-400 font-mono">
                            {d.properties.primaryGroups.join(', ')}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {filteredZones.length > 0 && (
                    <div className="px-3 py-1 border-t border-slate-800/80 mt-1">
                      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                        Зони черг
                      </div>
                      {filteredZones.map((z) => (
                        <button
                          key={z.id}
                          onClick={() => {
                            onSelectFeature({
                              type: 'zone',
                              id: z.id,
                              name: z.properties.name,
                              districtName: z.properties.districtName,
                              group: z.properties.group,
                              streets: z.properties.streets,
                              center: z.properties.center as [number, number],
                            });
                            setIsFocused(false);
                            setQuery('');
                          }}
                          className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-800 flex items-center justify-between text-sm text-slate-200 transition-colors"
                        >
                          <div>
                            <div className="font-medium">{z.properties.name}</div>
                            <div className="text-xs text-slate-400">{z.properties.districtName}</div>
                          </div>
                          <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-400 font-mono text-xs border border-amber-500/30">
                            Черга {z.properties.group}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {filteredStreets.length > 0 && (
                    <div className="px-3 py-1 border-t border-slate-800/80 mt-1">
                      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                        Вулиці
                      </div>
                      {filteredStreets.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => {
                            onSelectFeature({
                              type: 'street',
                              id: s.id,
                              name: s.name,
                              districtName: s.district,
                              group: s.group,
                              center: [s.lat, s.lon],
                              buildings: s.buildings,
                            });
                            setIsFocused(false);
                            setQuery('');
                          }}
                          className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-800 flex items-center justify-between text-sm text-slate-200 transition-colors"
                        >
                          <div>
                            <div className="font-medium">{s.name}</div>
                            <div className="text-xs text-slate-400">
                              {s.district} • буд. {s.buildings}
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-300 font-mono text-xs border border-indigo-500/30">
                            Черга {s.group}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </header>
  );
};
