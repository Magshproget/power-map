// Build 55 natural, smooth microdistrict & settlement outage zones (16 Lviv sectors + 39 settlements)
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

console.log(`Loaded ${originalDistricts.features.length} original districts/settlements and ${streets.length} streets.`);

// Helper to find streets and get top group
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

// Slice a polygon with a bbox
function sliceFeature(feature, bbox, newId, newName, districtName) {
  const poly = turf.bboxPolygon(bbox);
  const clipped = turf.intersect(turf.featureCollection([feature, poly]));
  if (!clipped || !clipped.geometry) return null;

  // Find streets inside this bbox
  const inBbox = streets.filter(
    (s) =>
      s.district === districtName &&
      s.lon >= bbox[0] &&
      s.lat >= bbox[1] &&
      s.lon <= bbox[2] &&
      s.lat <= bbox[3]
  );

  const { dominant, topGroups } = getStatsForStreets(inBbox);
  const centerPt = turf.pointOnFeature(clipped);

  return {
    type: 'Feature',
    id: newId,
    properties: {
      id: newId,
      name: `${newName} (Черга ${dominant})`,
      districtId: feature.properties.id || feature.id,
      districtName: newName,
      group: dominant,
      groups: topGroups,
      streets: inBbox.slice(0, 15).map((s) => s.name),
      center: [centerPt.geometry.coordinates[1], centerPt.geometry.coordinates[0]],
      isSubdistrict: true
    },
    geometry: clipped.geometry
  };
}

const newZones = [];
const newDistricts = [];

// Big BBox limits to avoid boundary issues
const MIN_LNG = 23.5, MAX_LNG = 24.5, MIN_LAT = 49.5, MAX_LAT = 50.2;

for (const f of originalDistricts.features) {
  const name = f.properties.name;
  const id = f.properties.id || f.id;

  if (name === 'Франківський район') {
    // 3 natural sectors:
    // 1. South (< 49.815): Наукова / Стрийська / В. Великого -> 3.1
    // 2. Middle (49.815 - 49.827): Новий Світ / Чупринки / Сахарова -> 5.1
    // 3. North (>= 49.827): Політехніка / Київська -> 2.1
    const s1 = sliceFeature(f, [MIN_LNG, MIN_LAT, MAX_LNG, 49.815], 'zone-frank-south', 'Наукова / Стрийська', name);
    const s2 = sliceFeature(f, [MIN_LNG, 49.815, MAX_LNG, 49.827], 'zone-frank-center', 'Чупринки / Сахарова', name);
    const s3 = sliceFeature(f, [MIN_LNG, 49.827, MAX_LNG, MAX_LAT], 'zone-frank-north', 'Політехніка / Київська', name);
    [s1, s2, s3].filter(Boolean).forEach((s) => {
      newZones.push(s);
      newDistricts.push(s);
    });
  } else if (name === 'Личаківський район') {
    // 3 sectors:
    // 1. South-East (lat < 49.835, lon >= 24.045): Пасічна / Вашингтона -> 6.1
    // 2. West (lon < 24.045): Погулянка / Личаківська -> 4.1
    // 3. North-East (lat >= 49.835, lon >= 24.045): Тракт Глинянський -> 3.1
    const s1 = sliceFeature(f, [24.045, MIN_LAT, MAX_LNG, 49.835], 'zone-lych-pasichna', 'Пасічна / Вашингтона', name);
    const s2 = sliceFeature(f, [MIN_LNG, MIN_LAT, 24.045, MAX_LAT], 'zone-lych-pohulyanka', 'Погулянка / Личаківська', name);
    const s3 = sliceFeature(f, [24.045, 49.835, MAX_LNG, MAX_LAT], 'zone-lych-trakt', 'Тракт Глинянський / Кривчиці', name);
    [s1, s2, s3].filter(Boolean).forEach((s) => {
      newZones.push(s);
      newDistricts.push(s);
    });
  } else if (name === 'Шевченківський район') {
    // 3 sectors:
    // 1. West (lon < 23.96): Рясне-1 та Рясне-2 -> 1.1 / 4.1
    // 2. Center (lon 23.96 - 24.03): Чорновола / Варшавська -> 4.1
    // 3. East (lon >= 24.03): Топольна / Мазепи / Замарстинів -> 3.1
    const s1 = sliceFeature(f, [MIN_LNG, MIN_LAT, 23.96, MAX_LAT], 'zone-shev-riasne', 'Рясне-1 та Рясне-2', name);
    const s2 = sliceFeature(f, [23.96, MIN_LAT, 24.03, MAX_LAT], 'zone-shev-chornovola', 'Чорновола / Варшавська', name);
    const s3 = sliceFeature(f, [24.03, MIN_LAT, MAX_LNG, MAX_LAT], 'zone-shev-topolna', 'Топольна / Мазепи', name);
    [s1, s2, s3].filter(Boolean).forEach((s) => {
      newZones.push(s);
      newDistricts.push(s);
    });
  } else if (name === 'Залізничний район') {
    // 3 sectors:
    // 1. North-West (lat >= 49.833, lon < 23.98): Левандівка / Білогорща -> 1.1
    // 2. South-West (lat < 49.833, lon < 23.98): Любінська / Виговського -> 2.1
    // 3. East (lon >= 23.98): Привокзальна / Городоцька -> 1.1
    const s1 = sliceFeature(f, [MIN_LNG, 49.833, 23.98, MAX_LAT], 'zone-zal-levandivka', 'Левандівка / Білогорща', name);
    const s2 = sliceFeature(f, [MIN_LNG, MIN_LAT, 23.98, 49.833], 'zone-zal-liubinska', 'Любінська / Виговського', name);
    const s3 = sliceFeature(f, [23.98, MIN_LAT, MAX_LNG, MAX_LAT], 'zone-zal-pryvokzalna', 'Привокзальна / Городоцька', name);
    [s1, s2, s3].filter(Boolean).forEach((s) => {
      newZones.push(s);
      newDistricts.push(s);
    });
  } else if (name === 'Сихівський район') {
    // 2 sectors:
    // 1. Central (lat < 49.805, lon >= 24.03): Сихів-Центр / Червоної Калини -> 6.1
    // 2. North / West: Хуторівка / Козельники -> 4.1
    const s1 = sliceFeature(f, [24.03, MIN_LAT, MAX_LNG, 49.805], 'zone-sykh-center', 'Сихів-Центр / Червоної Калини', name);
    const s2 = sliceFeature(f, [MIN_LNG, MIN_LAT, 24.03, MAX_LAT], 'zone-sykh-khutorivka', 'Хуторівка / Козельники', name);
    [s1, s2].filter(Boolean).forEach((s) => {
      newZones.push(s);
      newDistricts.push(s);
    });
  } else if (name === 'Галицький район') {
    // 2 sectors:
    // 1. North (lat >= 49.836): Старе Місто / Центр -> 4.1
    // 2. South (lat < 49.836): Цитадель / Снопків -> 2.1
    const s1 = sliceFeature(f, [MIN_LNG, 49.836, MAX_LNG, MAX_LAT], 'zone-hal-center', 'Старе Місто / Центр', name);
    const s2 = sliceFeature(f, [MIN_LNG, MIN_LAT, MAX_LNG, 49.836], 'zone-hal-south', 'Цитадель / Снопків', name);
    [s1, s2].filter(Boolean).forEach((s) => {
      newZones.push(s);
      newDistricts.push(s);
    });
  } else {
    // 39 Surrounding settlements keep their clean, intact boundaries
    const dStreets = streets.filter(
      (s) => s.district === name || (s.cityName && name.toLowerCase().includes(s.cityName.toLowerCase()))
    );
    const { dominant, topGroups } = getStatsForStreets(dStreets);
    const centerPt = turf.pointOnFeature(f);

    const feat = {
      type: 'Feature',
      id: f.id || id,
      properties: {
        id: f.id || id,
        name: `${name} (Черга ${dominant})`,
        districtId: id,
        districtName: name,
        group: dominant,
        groups: topGroups,
        streets: dStreets.slice(0, 15).map((s) => s.name),
        center: [centerPt.geometry.coordinates[1], centerPt.geometry.coordinates[0]],
        isSubdistrict: false
      },
      geometry: f.geometry
    };

    newZones.push(feat);
    newDistricts.push(feat);
  }
}

console.log(`\nGenerated ${newZones.length} smooth, natural zones.`);

fs.writeFileSync(
  ZONES_FILE,
  JSON.stringify({ type: 'FeatureCollection', features: newZones }, null, 2),
  'utf8'
);
fs.writeFileSync(
  DISTRICTS_FILE,
  JSON.stringify({ type: 'FeatureCollection', features: newDistricts }, null, 2),
  'utf8'
);

console.log(`Saved clean natural zones to ${ZONES_FILE} and ${DISTRICTS_FILE}`);
