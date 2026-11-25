import React, { useState, useMemo } from 'react';
import { Search, Zap, Clock, RefreshCw, X, MapPin, Layers, Shield, Grid, Navigation } from 'lucide-react';
import { ScheduleData, StreetItem, SelectedFeature, LayerMode } from '../types';
import streetsData from '../data/streets.json';
import districtsData from '../data/districts.json';
import zonesData from '../data/zones.json';

interface HeaderProps {
  schedule: ScheduleData | null;
  onRefresh: () => void;
  isLoading: boolean;
  onSelectFeature: (feature: SelectedFeature) => void;
  layerMode?: LayerMode;
  onChangeLayerMode?: (mode: LayerMode) => void;
  currentZoom?: number;
}

const STOP_WORDS = new Set([
  'вул', 'вулиця', 'вулиці', 'просп', 'проспект', 'пл', 'площа', 'пров',
  'провулок', 'проїзд', 'бульв', 'бульвар', 'тракт', 'смт', 'с', 'село',
  'м', 'місто', 'район', 'р-н', 'рн'
]);

const TITLE_EXPANSIONS: Record<string, string> = {
  'гетьм': 'гетьмана',
  'акад': 'академіка',
  'ген': 'генерала',
  'кн': 'князя',
  'митр': 'митрополита',
  'проф': 'професора',
  'полк': 'полковника',
  'арх': 'архітектора',
};

function cleanText(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/[’‘`ʼ]/g, "'")
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractWords(text: string): string[] {
  return cleanText(text)
    .split(' ')
    .map((w) => w.trim())
    .filter((w) => w.length > 0 && !STOP_WORDS.has(w));
}

function wordsMatch(w1: string, w2: string): number {
  if (w1 === w2) return 40;
  if (w1.startsWith(w2) && w2.length >= 2) return 25;
  if (w2.startsWith(w1) && w1.length >= 2) return 25;
  if (TITLE_EXPANSIONS[w1] === w2 || TITLE_EXPANSIONS[w2] === w1) return 35;
  if (w1.includes(w2) && w2.length >= 4) return 15;
  if (w2.includes(w1) && w1.length >= 4) return 15;
  if ((w1.length === 1 && w2.startsWith(w1)) || (w2.length === 1 && w1.startsWith(w2))) {
    return 10;
  }
  return 0;
}

function scoreStreet(street: StreetItem, query: string): number {
  const qWords = extractWords(query);
  if (qWords.length === 0) return 0;

  const nameWords = extractWords(street.name);
  const contextWords = extractWords(`${street.cityName || ''} ${street.district || ''}`);

  let matchedAll = true;
  let score = 0;

  for (const qw of qWords) {
    let bestWordMatch = 0;
    for (const tw of nameWords) {
      const m = wordsMatch(tw, qw);
      if (m > bestWordMatch) bestWordMatch = m;
    }
    if (bestWordMatch === 0) {
      for (const cw of contextWords) {
        const m = wordsMatch(cw, qw);
        if (m > 0) bestWordMatch = Math.max(bestWordMatch, Math.floor(m * 0.7));
      }
    }
    if (bestWordMatch === 0) {
      matchedAll = false;
      break;
    }
    score += bestWordMatch;
  }

  if (!matchedAll) return 0;

  const significantName = nameWords.join(' ');
  const querySignificant = qWords.join(' ');

  if (significantName === querySignificant) {
    score += 200;
  } else if (significantName.startsWith(querySignificant)) {
    score += 120;
  } else if (nameWords[0] && qWords[0] && wordsMatch(nameWords[0], qWords[0]) > 0) {
    score += 60;
  }

  if (street.name.includes('-') || street.name.includes('/')) {
    score -= 35;
  }
  if (/\d/.test(street.name)) {
    score -= 30;
  }
  if (street.name.toLowerCase().includes('навпроти')) {
    score -= 40;
  }

  if (street.cityName === 'Львів' || street.district?.includes('Львів')) {
    score += 30;
  }

  return score;
}

export const Header: React.FC<HeaderProps> = ({
  schedule,
  onRefresh,
  isLoading,
  onSelectFeature,
  layerMode = 'auto',
  onChangeLayerMode,
  currentZoom = 12,
}) => {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isMobileLayersOpen, setIsMobileLayersOpen] = useState(false);

  const layerOptions: { id: LayerMode; label: string; icon: React.ReactNode; desc: string }[] = [
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

  const streets = streetsData as StreetItem[];
  const districts = districtsData.features;
  const zones = zonesData.features;

  const filteredStreets = useMemo(() => {
    const q = query.trim();
    if (q.length < 2) return [];

    return streets
      .map((s) => ({ s, score: scoreStreet(s, q) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map((item) => item.s);
  }, [query, streets]);

  const filteredDistricts = useMemo(() => {
    const q = cleanText(query);
    if (q.length < 2) return [];
    const qWords = extractWords(query);

    return districts
      .filter((d) => {
        const dClean = cleanText(d.properties.name);
        return qWords.every((qw) => dClean.includes(qw));
      })
      .slice(0, 5);
  }, [query, districts]);

  const filteredZones = useMemo(() => {
    const q = cleanText(query);
    if (q.length < 2) return [];
    const qWords = extractWords(query);

    return zones
      .filter((z) => {
        const zClean = cleanText(`${z.properties.name} ${z.properties.districtName} ${z.properties.group}`);
        return qWords.every((qw) => zClean.includes(qw));
      })
      .slice(0, 5);
  }, [query, zones]);

  const hasResults =
    filteredStreets.length > 0 || filteredDistricts.length > 0 || filteredZones.length > 0;

  const renderDropdown = () => (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={() => setIsFocused(false)}
      />
      <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900/95 backdrop-blur-xl border border-slate-700/70 rounded-2xl shadow-2xl overflow-hidden z-50 max-h-80 md:max-h-96 overflow-y-auto">
        {!hasResults ? (
          <div className="p-4 text-center text-sm text-slate-400">
            Нічого не знайдено за запитом "{query}"
          </div>
        ) : (
          <div className="py-2">
            {filteredDistricts.length > 0 && (
              <div className="px-3 py-1">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Райони та поселення
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
                    <span className="font-medium flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      {d.properties.name}
                    </span>
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
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span>Вулиці ({filteredStreets.length})</span>
                </div>
                {filteredStreets.map((s) => {
                  const locality = s.cityName && s.cityName !== 'Львів' ? s.cityName : s.district;
                  return (
                    <button
                      key={s.id}
                      onClick={() => {
                        onSelectFeature({
                          type: 'street',
                          id: s.id,
                          name: s.name,
                          districtName: s.district,
                          cityName: s.cityName,
                          group: s.group,
                          center: [s.lat, s.lon],
                          buildings: s.buildings,
                        });
                        setIsFocused(false);
                        setQuery('');
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-800 flex items-center justify-between text-sm text-slate-200 transition-colors gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate text-white">{s.name}</div>
                        <div className="text-xs text-slate-400 flex items-center gap-1.5 truncate">
                          <span className="text-slate-300 font-medium">{locality}</span>
                          {s.buildings && (
                            <>
                              <span>•</span>
                              <span>буд. {s.buildings}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <span className="shrink-0 px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 font-mono text-xs border border-amber-500/30 font-semibold">
                        Черга {s.group}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );

  return (
    <header className="absolute top-2 left-2 right-2 md:top-4 md:left-4 md:right-4 z-[1000] pointer-events-none">
      {/* MOBILE UNIFIED TOP BAR (< md): ultra-compact single-row */}
      <div className="flex md:hidden items-center gap-1.5 w-full pointer-events-auto">
        {/* Compact Logo Badge */}
        <div className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-900/95 backdrop-blur-md border border-slate-700/70 shadow-md shrink-0">
          <Zap className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
          <span className="font-bold text-[11px] text-white tracking-wide">
            Світло<span className="text-amber-400">Мапа</span>
          </span>
        </div>

        {/* Search Bar Input */}
        <div className="relative flex-1 min-w-0">
          <div className="flex items-center bg-slate-900/95 backdrop-blur-md px-2 py-1.5 rounded-lg border border-slate-700/70 shadow-md focus-within:border-amber-500/60 focus-within:ring-2 focus-within:ring-amber-500/20">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0 mr-1.5" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setIsFocused(true)}
              placeholder="Пошук вулиці..."
              className="w-full bg-transparent text-xs text-white placeholder-slate-400 outline-none truncate"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="text-slate-400 hover:text-white p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Mobile Search Dropdown */}
          {isFocused && query.trim().length > 1 && renderDropdown()}
        </div>

        {/* Mobile Layers Button */}
        {onChangeLayerMode && (
          <button
            onClick={() => setIsMobileLayersOpen(!isMobileLayersOpen)}
            title="Шари мапи"
            className={`p-1.5 rounded-lg backdrop-blur-md border shadow-md shrink-0 transition-all active:scale-95 ${
              layerMode !== 'auto'
                ? 'bg-amber-500 text-slate-950 border-amber-400 font-semibold'
                : 'bg-slate-900/95 text-amber-400 border-slate-700/70 hover:bg-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
          </button>
        )}

        {/* Mobile Refresh Button */}
        <button
          onClick={onRefresh}
          disabled={isLoading}
          title="Оновити графік"
          className="p-1.5 rounded-lg bg-slate-900/95 backdrop-blur-md border border-slate-700/70 shadow-md text-slate-400 hover:text-white active:scale-95 disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
        </button>

        {/* Mobile Layers Modal Dropdown */}
        {isMobileLayersOpen && onChangeLayerMode && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs"
              onClick={() => setIsMobileLayersOpen(false)}
            />
            <div className="absolute top-full right-0 mt-2 w-64 bg-slate-900/98 backdrop-blur-2xl p-2 rounded-2xl border border-slate-700/80 shadow-2xl z-50 flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between border-b border-slate-800 pb-2 mb-1">
                <span>Шари мапи (z{Math.round(currentZoom)})</span>
                <button
                  onClick={() => setIsMobileLayersOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {layerOptions.map((opt) => {
                const isActive = layerMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => {
                      onChangeLayerMode(opt.id);
                      setIsMobileLayersOpen(false);
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

      {/* DESKTOP TOP BAR (>= md) */}
      <div className="hidden md:flex items-center justify-between gap-3 pointer-events-none">
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

        {/* Desktop Search Bar */}
        <div className="relative w-96 pointer-events-auto">
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

          {/* Search Dropdown on Desktop */}
          {isFocused && query.trim().length > 1 && renderDropdown()}
        </div>
      </div>
    </header>
  );
};
