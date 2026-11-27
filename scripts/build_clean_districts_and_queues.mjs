import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const DISTRICTS_FILE = path.join(rootDir, 'src/data/districts.json');
const ZONES_FILE = path.join(rootDir, 'src/data/zones.json');
const STREETS_FILE = path.join(rootDir, 'src/data/streets.json');

// Read clean template districts from /tmp/clean_districts.json
const cleanDistricts = JSON.parse(fs.readFileSync('/tmp/clean_districts.json', 'utf8'));
const streets = JSON.parse(fs.readFileSync(STREETS_FILE, 'utf8'));

function getStreetsForDistrict(districtName) {
  const normD = districtName.toLowerCase().replace(/[\s-]/g, '');
  return streets.filter((s) => {
    if (s.district === districtName) return true;
    if (s.cityName && s.cityName !== 'Львів') {
      const normCity = s.cityName.toLowerCase().replace(/[\s-]/g, '');
      if (normCity === normD || normD.includes(normCity) || normCity.includes(normD)) return true;
    }
    if (s.district) {
      const normDist = s.district.toLowerCase().replace(/[\s-]/g, '');
      if (normDist === normD) return true;
    }
    return false;
  });
}

const enrichedDistricts = [];
const enrichedZones = [];

for (const feature of cleanDistricts.features) {
  const dName = feature.properties.name;
  const dId = feature.id;
  const matched = getStreetsForDistrict(dName);

  const counts = {};
  for (const s of matched) {
    if (s.group) counts[s.group] = (counts[s.group] || 0) + 1;
  }

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const dominant = sorted.length > 0 ? sorted[0][0] : '1.1';
  const primaryGroups = sorted.slice(0, 4).map(([g]) => g);

  const queueBreakdown = sorted.map(([group, count]) => {
    const groupStreets = matched.filter((s) => s.group === group);
    return {
      group,
      count,
      percentage: Math.round((count / (matched.length || 1)) * 100),
      streets: groupStreets.slice(0, 20).map((s) => s.name),
    };
  });

  const keyStreets = feature.properties.keyStreets || matched.slice(0, 15).map((s) => s.name);

  // 1. District Feature
  const distFeature = {
    type: 'Feature',
    id: dId,
    properties: {
      id: dId,
      name: dName,
      center: feature.properties.center,
      dominantGroup: dominant,
      primaryGroups,
      queueBreakdown,
      keyStreets,
      isSubdistrict: false,
    },
    geometry: feature.geometry,
  };
  enrichedDistricts.push(distFeature);

  // 2. Matching Clean Zone Feature (100% natural boundary, no holes, no straight lines)
  const zoneFeature = {
    type: 'Feature',
    id: `zone-${dId}`,
    properties: {
      id: `zone-${dId}`,
      name: `${dName} (Черга ${dominant})`,
      areaName: dName,
      districtId: dId,
      districtName: dName,
      group: dominant,
      groups: primaryGroups,
      queueBreakdown,
      streets: keyStreets,
      center: feature.properties.center,
      isSubdistrict: false,
    },
    geometry: feature.geometry,
  };
  enrichedZones.push(zoneFeature);
}

fs.writeFileSync(
  DISTRICTS_FILE,
  JSON.stringify({ type: 'FeatureCollection', features: enrichedDistricts }, null, 2),
  'utf8'
);

fs.writeFileSync(
  ZONES_FILE,
  JSON.stringify({ type: 'FeatureCollection', features: enrichedZones }, null, 2),
  'utf8'
);

console.log(`Successfully generated ${enrichedDistricts.length} clean districts and zones.`);
