import React, { useDeferredValue, useMemo, useState } from 'react';
import { Search, Zap, Clock, RefreshCw, X, MapPin, Layers, Shield, Grid, Navigation } from 'lucide-react';
import { ScheduleData, StreetItem, SelectedFeature, LayerMode } from '../types';
import { useMapGeoData, useStreetsData } from '../services/geoDataService';

interface HeaderProps {
  schedule: ScheduleData | null;
  onRefresh: () => void;
  isLoading: boolean;
  onSelectFeature: (feature: SelectedFeature) => void;
  layerMode?: LayerMode;
  onChangeLayerMode?: (mode: LayerMode) => void;
  currentZoom?: number;
  onSearchFocusChange?: (isSearching: boolean) => void;
}

const STOP_WORDS = new Set([
  'вул', 'вулиця', 'вулиці', 'просп', 'проспект', 'пл', 'площа', 'пров',
  'провулок', 'проїзд', 'бульв', 'бульвар', 'тракт', 'смт', 'с', 'село',
  'м', 'місто', 'район', 'р-н', 'рн', 'буд', 'будинок', 'д', 'номер', '№'
]);

const TITLE_EXPANSIONS: Record<string, string> = {
  'гетьм': 'гетьмана',
  'акад': 'академіка',
  'ген': 'генерала',
  'генерал': 'генерала',
  'генерала': 'ген',
  'кн': 'князя',
  'митр': 'митрополита',
  'проф': 'професора',
  'полк': 'полковника',
  'арх': 'архітектора',
  'дж': 'джорджа',
  'джордж': 'джорджа',
  'джорджа': 'дж',
  'т': 'тараса',
  'в': 'володимира',
  'і': 'івана',
  'св': 'святого',
  'ст': 'степана',
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
  if (TITLE_EXPANSIONS[w1] === w2 || TITLE_EXPANSIONS[w2] === w1) return 38;
  if (w1.startsWith(w2) && w2.length >= 2) return 25;
  if (w2.startsWith(w1) && w1.length >= 2) return 25;
  if (w1.includes(w2) && w2.length >= 4) return 15;
  if (w2.includes(w1) && w1.length >= 4) return 15;
  if ((w1.length === 1 && w2.startsWith(w1)) || (w2.length === 1 && w1.startsWith(w2))) {
    return 10;
  }
  return 0;
}

interface IndexedStreet {
  street: StreetItem;
  nameWords: string[];
  contextWords: string[];
  significantName: string;
  staticAdjustment: number;
}

function buildStreetIndex(streets: StreetItem[]): IndexedStreet[] {
  return streets.map((street) => {
    const nameWords = extractWords(street.name);
    const contextWords = extractWords(`${street.cityName || ''} ${street.district || ''}`);
    let staticAdjustment = 0;
    if (street.name.includes('-') || street.name.includes('/')) {
      staticAdjustment -= 35;
    }
    if (/\d/.test(street.name)) {
      staticAdjustment -= 30;
    }
    if (street.name.toLowerCase().includes('навпроти')) {
      staticAdjustment -= 40;
    }
    if (street.cityName === 'Львів' || street.district?.includes('Львів')) {
      staticAdjustment += 30;
    }
    return {
      street,
      nameWords,
      contextWords,
      significantName: nameWords.join(' '),
      staticAdjustment,
    };
  });
}

function scoreIndexedStreet(
  item: IndexedStreet,
  qWords: string[],
  querySignificant: string
): number {
  const { nameWords, contextWords, significantName, staticAdjustment } = item;

  let score = 0;
  for (let i = 0; i < qWords.length; i++) {
    const qw = qWords[i];
    let bestWordMatch = 0;
    for (let j = 0; j < nameWords.length; j++) {
      const m = wordsMatch(nameWords[j], qw);
      if (m > bestWordMatch) bestWordMatch = m;
    }
    if (bestWordMatch === 0) {
      for (let j = 0; j < contextWords.length; j++) {
        const m = wordsMatch(contextWords[j], qw);
        if (m > 0) {
          const scaled = Math.floor(m * 0.7);
          if (scaled > bestWordMatch) bestWordMatch = scaled;
        }
      }
    }
    if (bestWordMatch === 0) {
      return 0;
    }
    score += bestWordMatch;
  }

  if (significantName === querySignificant) {
    score += 200;
  } else if (significantName.startsWith(querySignificant)) {
    score += 120;
  } else if (nameWords[0] && qWords[0] && wordsMatch(nameWords[0], qWords[0]) > 0) {
    score += 60;
  }

  return score + staticAdjustment;
}

const LAYER_OPTIONS: { id: LayerMode; label: string; icon: React.ReactNode; desc: string }[] = [
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
    desc: '45 районів та громад',
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

const HeaderComponent: React.FC<HeaderProps> = ({
  schedule,
  onRefresh,
  isLoading,
  onSelectFeature,
  layerMode = 'auto',
  onChangeLayerMode,
  currentZoom = 12,
  onSearchFocusChange,
}) => {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [isFocused, setIsFocused] = useState(false);
  const [isMobileLayersOpen, setIsMobileLayersOpen] = useState(false);

  const mapGeo = useMapGeoData();
  const streetsData = useStreetsData(true);

  const indexedStreets = useMemo(
    () => (streetsData ? buildStreetIndex(streetsData) : []),
    [streetsData]
  );

  const indexedDistricts = useMemo(
    () =>
      (mapGeo?.districts.features || []).map((d) => ({
        feature: d,
        cleanName: cleanText(d.properties.name),
      })),
    [mapGeo]
  );

  const indexedZones = useMemo(
    () =>
      (mapGeo?.zones.features || []).map((z) => ({
        feature: z,
        cleanName: cleanText(`${z.properties.name} ${z.properties.districtName} ${z.properties.group}`),
      })),
    [mapGeo]
  );

  const resetScroll = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.body.scrollTop = 0;
      document.documentElement.scrollTop = 0;
    }
  };

  const handleOpenSearch = () => {
    setIsFocused(true);
    onSearchFocusChange?.(true);
  };

  const handleCloseSearch = () => {
    setIsFocused(false);
    onSearchFocusChange?.(false);
    resetScroll();
  };

  const formatSyncTime = (isoString?: string) => {
    if (!isoString) return null;
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return null;
      return d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return null;
    }
  };

  const syncTimeStr = formatSyncTime(schedule?.fetchedAt);
  const refreshTooltip = syncTimeStr
    ? `Оновити графік (перевірено о ${syncTimeStr})`
    : 'Оновити графік';

  const parsedQuery = useMemo(() => {
    const trimmed = deferredQuery.trim();
    if (trimmed.length < 2) return null;

    // Extract house/building number if entered e.g. "7а", "7-А", "15/2", "буд. 10"
    const bMatch = trimmed.match(/(?:^|\s)(?:буд\.?|будинок|д\.?|№)?\s*(\d+[-/0-9a-zA-Zа-яА-ЯіїєЇЄ]*)(?:\s|$)/i);
    const buildingNumber = bMatch && bMatch[1] && bMatch[1].length > 0 ? bMatch[1] : null;

    const allWords = extractWords(trimmed);
    let streetWords = allWords.filter((w) => !/^\d/.test(w));
    if (streetWords.length === 0) {
      streetWords = allWords;
    }

    return {
      qWords: streetWords,
      buildingNumber,
      querySignificant: streetWords.join(' '),
    };
  }, [deferredQuery]);

  const filteredStreets = useMemo(() => {
    if (!parsedQuery || parsedQuery.qWords.length === 0 || indexedStreets.length === 0) return [];
    const { qWords, querySignificant, buildingNumber } = parsedQuery;
    const matches: { s: StreetItem & { matchedBuilding?: string }; score: number }[] = [];

    for (let i = 0; i < indexedStreets.length; i++) {
      const item = indexedStreets[i];
      const score = scoreIndexedStreet(item, qWords, querySignificant);
      if (score > 0) {
        matches.push({
          s: {
            ...item.street,
            matchedBuilding: buildingNumber || undefined,
          },
          score,
        });
      }
    }

    matches.sort((a, b) => b.score - a.score);
    return matches.slice(0, 12).map((m) => m.s);
  }, [parsedQuery, indexedStreets]);

  const filteredDistricts = useMemo(() => {
    if (!parsedQuery || parsedQuery.qWords.length === 0) return [];
    const { qWords } = parsedQuery;
    return indexedDistricts
      .filter((d) => qWords.every((qw) => d.cleanName.includes(qw)))
      .slice(0, 5)
      .map((d) => d.feature);
  }, [parsedQuery, indexedDistricts]);

  const filteredZones = useMemo(() => {
    if (!parsedQuery || parsedQuery.qWords.length === 0) return [];
    const { qWords } = parsedQuery;
    return indexedZones
      .filter((z) => qWords.every((qw) => z.cleanName.includes(qw)))
      .slice(0, 5)
      .map((z) => z.feature);
  }, [parsedQuery, indexedZones]);

  const isSearchPending = query !== deferredQuery;
  const hasResults =
    filteredStreets.length > 0 || filteredDistricts.length > 0 || filteredZones.length > 0;

  const renderDropdown = () => (
    <>
      <div
        className="fixed inset-0 z-[1300] bg-black/60 pointer-events-auto md:bg-transparent"
        onClick={handleCloseSearch}
      />
      <div className="fixed inset-x-2 top-14 bottom-3 md:bottom-auto md:absolute md:inset-x-auto md:top-full md:left-0 md:w-full md:mt-2 bg-slate-900/98 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden z-[1350] md:max-h-96 flex flex-col pointer-events-auto animate-in fade-in zoom-in-95 duration-150">
        {!hasResults ? (
          <div className="p-4 text-center text-sm text-slate-400">
            {streetsData === null
              ? 'Завантаження бази вулиць...'
              : isSearchPending
              ? 'Пошук...'
              : `Нічого не знайдено за запитом "${query}"`}
          </div>
        ) : (
          <div className="py-2 pb-24 md:pb-4 overflow-y-auto flex-1">
            {filteredDistricts.length > 0 && (
              <div className="px-3 py-1">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Райони та поселення
                </div>
                {filteredDistricts.map((d) => (
                  <button
                    type="button"
                    key={d.id}
                    onClick={() => {
                      onSelectFeature({
                        type: 'district',
                        id: d.id,
                        name: d.properties.name,
                        groups: d.properties.primaryGroups,
                        dominantGroup: d.properties.dominantGroup,
                        queueBreakdown: d.properties.queueBreakdown,
                        streets: d.properties.keyStreets,
                        center: d.properties.center as [number, number],
                      });
                      handleCloseSearch();
                      setQuery('');
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-800 active:bg-slate-750 flex items-center justify-between text-sm text-slate-200 transition-colors"
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
                    type="button"
                    key={z.id}
                    onClick={() => {
                      onSelectFeature({
                        type: 'zone',
                        id: z.id,
                        name: z.properties.name,
                        districtName: z.properties.districtName,
                        group: z.properties.group,
                        groups: z.properties.groups,
                        queueBreakdown: z.properties.queueBreakdown,
                        streets: z.properties.streets,
                        center: z.properties.center as [number, number],
                      });
                      handleCloseSearch();
                      setQuery('');
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-800 active:bg-slate-750 flex items-center justify-between text-sm text-slate-200 transition-colors"
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
                      type="button"
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
                          buildings: s.matchedBuilding ? s.matchedBuilding : s.buildings,
                        });
                        handleCloseSearch();
                        setQuery('');
                      }}
                      className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-800 active:bg-slate-750 flex items-center justify-between text-sm text-slate-200 transition-colors gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate text-white text-xs sm:text-sm">{s.name}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5 truncate">
                          <span className="text-slate-300 font-medium">{locality}</span>
                          {s.matchedBuilding ? (
                            <>
                              <span>•</span>
                              <span className="text-amber-300 font-semibold">буд. {s.matchedBuilding}</span>
                            </>
                          ) : s.buildings ? (
                            <>
                              <span>•</span>
                              <span>буд. {s.buildings}</span>
                            </>
                          ) : null}
                        </div>
                      </div>
                      <span className="shrink-0 px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 font-mono text-[11px] sm:text-xs border border-amber-500/30 font-semibold">
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
    <header
      className={`fixed top-[calc(0.5rem+env(safe-area-inset-top,0px))] left-2 right-2 md:top-4 md:left-4 md:right-4 pointer-events-none ${
        isFocused ? 'z-[1400]' : 'z-[1200]'
      }`}
    >
      {/* MOBILE UNIFIED TOP BAR (< md or short landscape) */}
      <div className="mobile-header-bar flex md:hidden items-center gap-1.5 w-full pointer-events-auto">
        {/* Compact Logo Badge */}
        <div className="flex items-center gap-1 px-2 h-11 rounded-xl bg-slate-900/95 border border-slate-700/70 shadow-md shrink-0">
          <Zap className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
          <span className="font-bold text-[11px] text-white tracking-wide">
            Світло<span className="text-amber-400">Мапа</span>
          </span>
        </div>

        {/* Search Bar Input */}
        <div className={`relative flex-1 min-w-0 ${isFocused ? 'z-[1400]' : ''}`}>
          <div className="relative z-[1400] flex items-center h-11 bg-slate-900/98 px-2.5 rounded-xl border border-slate-700/70 shadow-md focus-within:border-amber-500/60 focus-within:ring-2 focus-within:ring-amber-500/20">
            <Search className="w-4 h-4 text-slate-400 shrink-0 mr-1.5" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={handleOpenSearch}
              onBlur={() => setTimeout(resetScroll, 120)}
              placeholder="Пошук вулиці..."
              className="w-full bg-transparent text-[16px] md:text-xs text-white placeholder-slate-400 outline-none truncate"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  handleCloseSearch();
                }}
                className="text-slate-400 hover:text-white p-1.5 -mr-1"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Mobile Search Dropdown */}
          {isFocused && query.trim().length > 1 && renderDropdown()}
        </div>

        {/* Mobile Layers Button (>= 44x44 tap target) */}
        {onChangeLayerMode && (
          <button
            type="button"
            onClick={() => setIsMobileLayersOpen((v) => !v)}
            title="Шари мапи"
            className={`w-11 h-11 flex items-center justify-center rounded-xl border shadow-md shrink-0 transition-colors active:scale-95 ${
              layerMode !== 'auto'
                ? 'bg-amber-500 text-slate-950 border-amber-400 font-semibold'
                : 'bg-slate-900/95 text-amber-400 border-slate-700/70 hover:bg-slate-800'
            }`}
          >
            <Layers className="w-4.5 h-4.5" />
          </button>
        )}

        {/* Mobile Refresh Button (>= 44x44 tap target) */}
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          title={refreshTooltip}
          className="w-11 h-11 flex items-center justify-center rounded-xl bg-slate-900/95 border border-slate-700/70 shadow-md text-slate-400 hover:text-white active:scale-95 disabled:opacity-50 shrink-0 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
        </button>

        {/* Mobile Layers Modal Dropdown */}
        {isMobileLayersOpen && onChangeLayerMode && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/45"
              onClick={() => setIsMobileLayersOpen(false)}
            />
            <div className="absolute top-full right-0 mt-2 w-64 bg-slate-900/98 p-2 rounded-2xl border border-slate-700/80 shadow-2xl z-50 flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between border-b border-slate-800 pb-2 mb-1">
                <span>Шари мапи (z{Math.round(currentZoom)})</span>
                <button
                  type="button"
                  onClick={() => setIsMobileLayersOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {LAYER_OPTIONS.map((opt) => {
                const isActive = layerMode === opt.id;
                return (
                  <button
                    type="button"
                    key={opt.id}
                    onClick={() => {
                      onChangeLayerMode(opt.id);
                      setIsMobileLayersOpen(false);
                    }}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors ${
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

      {/* DESKTOP TOP BAR (>= md and normal height) */}
      <div className="desktop-header-bar hidden md:flex items-center justify-between gap-3 pointer-events-none">
        {/* Brand & Status Banner */}
        <div className="flex items-center gap-3 bg-slate-900/95 px-4 py-2.5 rounded-2xl border border-slate-700/60 shadow-xl pointer-events-auto">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <Zap className="w-5 h-5 fill-amber-400 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base text-white tracking-wide">
                СвітлоМапа <span className="text-amber-400 font-semibold text-sm">Львів</span>
              </h1>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                  schedule?.isLive
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    schedule?.isLive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'
                  }`}
                />
                {schedule?.isLive ? 'LIVE' : 'Автономно'}
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
              <Clock className="w-3 h-3 text-slate-500 shrink-0" />
              <span>{schedule?.date ? `Графік на ${schedule.date}` : schedule?.title || 'Графік відключень'}</span>
              {schedule?.updatedAt && (
                <span className="text-amber-400 font-medium">• Оновлено о {schedule.updatedAt}</span>
              )}
              {syncTimeStr && (
                <span className="text-slate-500 text-[10px]">(перевірено {syncTimeStr})</span>
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            title={refreshTooltip}
            className="ml-2 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>

        {/* Desktop Search Bar */}
        <div className={`relative w-96 pointer-events-auto ${isFocused ? 'z-[1400]' : ''}`}>
          <div className="relative z-[1400] flex items-center bg-slate-900/95 px-3.5 py-2.5 rounded-2xl border border-slate-700/60 shadow-xl focus-within:border-amber-500/60 focus-within:ring-2 focus-within:ring-amber-500/20 transition-colors">
            <Search className="w-4 h-4 text-slate-400 shrink-0 mr-2.5" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={handleOpenSearch}
              onBlur={() => setTimeout(resetScroll, 120)}
              placeholder="Введіть вулицю або мікрорайон..."
              className="w-full bg-transparent text-sm text-white placeholder-slate-400 outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  handleCloseSearch();
                }}
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

export const Header = React.memo(HeaderComponent);
