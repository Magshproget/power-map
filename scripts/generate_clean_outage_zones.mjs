// Generate exactly 12 cohesive outage group zones from all 3236 geocoded LOE streets
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

const districts = JSON.parse(fs.readFileSync(DISTRICTS_FILE, 'utf8'));
const streets = JSON.parse(fs.readFileSync(STREETS_FILE, 'utf8'));

console.log('Uniting district boundaries into metro envelope...');
let metroPoly = districts.features[0];
for (let i = 1; i < districts.features.length; i++) {
  try {
    metroPoly = turf.union(turf.featureCollection([metroPoly, districts.features[i]]));
  } catch (e) {}
}

const points = streets
  .filter((s) => s.lat && s.lon && s.group)
  .map((s) => turf.point([s.lon, s.lat], { group: s.group, name: s.name }));

const fc = turf.featureCollection(points);
const bbox = turf.bbox(metroPoly);
const expandedBbox = [bbox[0] - 0.02, bbox[1] - 0.02, bbox[2] + 0.02, bbox[3] + 0.02];

console.log(`Generating Voronoi over ${points.length} street points...`);
const voronoi = turf.voronoi(fc, { bbox: expandedBbox });

const groupCells = {};
const groupStreetNames = {};

for (let i = 0; i < voronoi.features.length; i++) {
  const cell = voronoi.features[i];
  if (!cell) continue;
  const pt = points[i];
  const g = pt.properties.group;
  if (!groupStreetNames[g]) groupStreetNames[g] = new Set();
  groupStreetNames[g].add(pt.properties.name);

  if (!groupCells[g]) groupCells[g] = [];
  groupCells[g].push(cell);
}

const groups = ['1.1', '1.2', '2.1', '2.2', '3.1', '3.2', '4.1', '4.2', '5.1', '5.2', '6.1', '6.2'];
const zoneFeatures = [];

for (const g of groups) {
  const cells = groupCells[g] || [];
  if (cells.length === 0) continue;

  console.log(`Unioning group ${g} (${cells.length} cells)...`);
  let u = cells[0];
  for (let i = 1; i < cells.length; i++) {
    try {
      u = turf.union(turf.featureCollection([u, cells[i]]));
    } catch (e) {}
  }

  try {
    const clipped = turf.intersect(turf.featureCollection([u, metroPoly]));
    if (!clipped || !clipped.geometry) continue;

    const simplified = turf.simplify(clipped, { tolerance: 0.00015, highQuality: false });

    // Pick the largest polygon component to guarantee the badge is placed inside its main mass
    let mainPolygon = simplified;
    if (simplified.geometry.type === 'MultiPolygon') {
      let maxArea = 0;
      for (const coords of simplified.geometry.coordinates) {
        const poly = turf.polygon(coords);
        const a = turf.area(poly);
        if (a > maxArea) {
          maxArea = a;
          mainPolygon = poly;
        }
      }
    }
    const centerPt = turf.pointOnFeature(mainPolygon);

    const keyStreets = Array.from(groupStreetNames[g] || []).slice(0, 15);

    zoneFeatures.push({
      type: 'Feature',
      id: `zone-group-${g.replace('.', '-')}`,
      properties: {
        id: `zone-group-${g.replace('.', '-')}`,
        name: `Черга ${g}`,
        districtId: `group-${g.replace('.', '-')}`,
        districtName: `Група ${g}`,
        group: g,
        groups: [g],
        streets: keyStreets,
        center: [centerPt.geometry.coordinates[1], centerPt.geometry.coordinates[0]]
      },
      geometry: simplified.geometry
    });
  } catch (err) {
    console.warn(`Clip error for group ${g}:`, err.message);
  }
}

console.log(`\nSuccess! Created ${zoneFeatures.length} cohesive outage group zones.`);

const finalZonesGeoJson = {
  type: 'FeatureCollection',
  features: zoneFeatures
};

fs.writeFileSync(ZONES_FILE, JSON.stringify(finalZonesGeoJson, null, 2), 'utf8');
console.log(`Saved clean 12 outage zones to ${ZONES_FILE}`);
