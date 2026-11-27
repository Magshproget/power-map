// Build clean, natural Queue-First outage zones across Lviv and suburbs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as turf from '@turf/turf';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const DISTRICTS_FILE = path.join(rootDir, 'src/data/districts.json');
const ZONES_FILE = path.join(rootDir, 'src/data/zones.json');
const STREETS_FILE = path.join(rootDir, 'src/data/streets.json');

const originalDistricts = JSON.parse(fs.readFileSync(DISTRICTS_FILE, 'utf8'));
const streets = JSON.parse(fs.readFileSync(STREETS_FILE, 'utf8'));

console.log(`Loaded ${originalDistricts.features.length} original boundary templates and ${streets.length} streets.`);

function getStatsForStreets(matchedStreets) {
  const counts = {};
  for (const s of matchedStreets) {
    if (s.group) counts[s.group] = (counts[s.group] || 0) + 1;
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const dominant = sorted.length > 0 ? sorted[0][0] : '1.1';
  const topGroups = sorted.slice(0, 4).map(([g]) => g);
  return { dominant, topGroups, count: matchedStreets.length };
}

function sliceFeature(feature, bbox, newId, areaName, districtName, forceGroup = null) {
  const poly = turf.bboxPolygon(bbox);
  const clipped = turf.intersect(turf.featureCollection([feature, poly]));
  if (!clipped || !clipped.geometry) return null;

  const inBbox = streets.filter(
    (s) =>
      s.district === districtName &&
      s.lon >= bbox[0] &&
      s.lat >= bbox[1] &&
      s.lon <= bbox[2] &&
      s.lat <= bbox[3]
  );

  const { dominant, topGroups } = getStatsForStreets(inBbox);
  const group = forceGroup || dominant;
  const centerPt = turf.pointOnFeature(clipped);

  return {
    type: 'Feature',
    id: newId,
    properties: {
      id: newId,
      name: `Черга ${group} (${areaName})`,
      areaName,
      districtId: feature.properties.id || feature.id,
      districtName: areaName,
      group,
      groups: [group, ...topGroups.filter((g) => g !== group)],
      streets: inBbox.slice(0, 15).map((s) => s.name),
      center: [centerPt.geometry.coordinates[1], centerPt.geometry.coordinates[0]],
      isSubdistrict: true
    },
    geometry: clipped.geometry
  };
}

const newZones = [];

const MIN_LNG = 23.5, MAX_LNG = 24.5, MIN_LAT = 49.5, MAX_LAT = 50.2;

for (const f of originalDistricts.features) {
  const name = f.properties.name;
  const id = f.properties.id || f.id;

  if (name.includes('Франківськ')) {
    // 3 queue zones:
    // 1. South: Наукова / Стрийська -> 3.1
    // 2. Middle: Чупринки / Сахарова -> 5.1
    // 3. North: Політехніка / Київська -> 2.1
    const s1 = sliceFeature(f, [MIN_LNG, MIN_LAT, MAX_LNG, 49.815], 'zone-q3-1-naukova', 'Наукова / Стрийська', name, '3.1');
    const s2 = sliceFeature(f, [MIN_LNG, 49.815, MAX_LNG, 49.827], 'zone-q5-1-chuprynka', 'Чупринки / Сахарова', name, '5.1');
    const s3 = sliceFeature(f, [MIN_LNG, 49.827, MAX_LNG, MAX_LAT], 'zone-q2-1-polytech', 'Політехніка / Київська', name, '2.1');
    [s1, s2, s3].filter(Boolean).forEach((s) => newZones.push(s));
  } else if (name.includes('Личаківськ')) {
    // 3 queue zones:
    // 1. South-East: Пасічна / Вашингтона -> 6.1
    // 2. West: Погулянка / Личаківська -> 4.1
    // 3. North: Тракт Глинянський / Кривчиці -> 3.1
    const s1 = sliceFeature(f, [24.045, MIN_LAT, MAX_LNG, 49.835], 'zone-q6-1-pasichna', 'Пасічна / Вашингтона', name, '6.1');
    const s2 = sliceFeature(f, [MIN_LNG, MIN_LAT, 24.045, MAX_LAT], 'zone-q4-1-pohulyanka', 'Погулянка / Личаківська', name, '4.1');
    const s3 = sliceFeature(f, [24.045, 49.835, MAX_LNG, MAX_LAT], 'zone-q3-1-trakt', 'Тракт Глинянський / Кривчиці', name, '3.1');
    [s1, s2, s3].filter(Boolean).forEach((s) => newZones.push(s));
  } else if (name.includes('Шевченківськ')) {
    // 3 queue zones:
    // 1. West: Рясне-1 та Рясне-2 -> 1.1
    // 2. Center: Чорновола / Варшавська -> 4.1
    // 3. East: Топольна / Мазепи -> 3.1
    const s1 = sliceFeature(f, [MIN_LNG, MIN_LAT, 23.96, MAX_LAT], 'zone-q1-1-riasne', 'Рясне-1 та Рясне-2', name, '1.1');
    const s2 = sliceFeature(f, [23.96, MIN_LAT, 24.03, MAX_LAT], 'zone-q4-1-chornovola', 'Чорновола / Варшавська', name, '4.1');
    const s3 = sliceFeature(f, [24.03, MIN_LAT, MAX_LNG, MAX_LAT], 'zone-q3-1-topolna', 'Топольна / Мазепи', name, '3.1');
    [s1, s2, s3].filter(Boolean).forEach((s) => newZones.push(s));
  } else if (name.includes('Залізничн')) {
    // 3 queue zones:
    // 1. North: Левандівка / Білогорща -> 1.1
    // 2. South-West: Любінська / Виговського -> 2.1
    // 3. East: Привокзальна / Городоцька -> 1.1
    const s1 = sliceFeature(f, [MIN_LNG, 49.833, 23.98, MAX_LAT], 'zone-q1-1-levandivka', 'Левандівка / Білогорща', name, '1.1');
    const s2 = sliceFeature(f, [MIN_LNG, MIN_LAT, 23.98, 49.833], 'zone-q2-1-liubinska', 'Любінська / Виговського', name, '2.1');
    const s3 = sliceFeature(f, [23.98, MIN_LAT, MAX_LNG, MAX_LAT], 'zone-q1-1-pryvokzalna', 'Привокзальна / Городоцька', name, '1.1');
    [s1, s2, s3].filter(Boolean).forEach((s) => newZones.push(s));
  } else if (name.includes('Сихівськ')) {
    // 2 queue zones:
    // 1. Central/South: Сихів-Центр / Червоної Калини -> 6.1
    // 2. North/West: Хуторівка / Козельники -> 4.1
    const s1 = sliceFeature(f, [24.03, MIN_LAT, MAX_LNG, 49.805], 'zone-q6-1-sykhiv', 'Сихів-Центр / Червоної Калини', name, '6.1');
    const s2 = sliceFeature(f, [MIN_LNG, MIN_LAT, 24.03, MAX_LAT], 'zone-q4-1-khutorivka', 'Хуторівка / Козельники', name, '4.1');
    [s1, s2].filter(Boolean).forEach((s) => newZones.push(s));
  } else if (name.includes('Галицьк')) {
    // 2 queue zones:
    // 1. North: Старе Місто / Центр -> 4.1
    // 2. South: Цитадель / Снопків -> 2.1
    const s1 = sliceFeature(f, [MIN_LNG, 49.836, MAX_LNG, MAX_LAT], 'zone-q4-1-center', 'Старе Місто / Центр', name, '4.1');
    const s2 = sliceFeature(f, [MIN_LNG, MIN_LAT, MAX_LNG, 49.836], 'zone-q2-1-citadel', 'Цитадель / Снопків', name, '2.1');
    [s1, s2].filter(Boolean).forEach((s) => newZones.push(s));
  } else {
    // 39 Suburban settlements
    const cleanName = name.replace(/\s*\(Черга [^)]+\)/, '');
    const dStreets = streets.filter(
      (s) => s.district === cleanName || (s.cityName && cleanName.toLowerCase().includes(s.cityName.toLowerCase()))
    );
    const { dominant, topGroups } = getStatsForStreets(dStreets);
    const centerPt = turf.pointOnFeature(f);

    const feat = {
      type: 'Feature',
      id: f.id || id,
      properties: {
        id: f.id || id,
        name: `Черга ${dominant} (${cleanName})`,
        areaName: cleanName,
        districtId: id,
        districtName: cleanName,
        group: dominant,
        groups: [dominant, ...topGroups.filter((g) => g !== dominant)],
        streets: dStreets.slice(0, 15).map((s) => s.name),
        center: [centerPt.geometry.coordinates[1], centerPt.geometry.coordinates[0]],
        isSubdistrict: false
      },
      geometry: f.geometry
    };

    newZones.push(feat);
  }
}

console.log(`\nGenerated ${newZones.length} queue-first zones.`);

const finalGeoJson = {
  type: 'FeatureCollection',
  features: newZones
};

fs.writeFileSync(ZONES_FILE, JSON.stringify(finalGeoJson, null, 2), 'utf8');
fs.writeFileSync(DISTRICTS_FILE, JSON.stringify(finalGeoJson, null, 2), 'utf8');

console.log(`Saved queue-first zones to ${ZONES_FILE} and ${DISTRICTS_FILE}`);
