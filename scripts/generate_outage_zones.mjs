// Generate accurate outage group zones (GeoJSON) from 3236 geocoded streets and district bounds
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

console.log(`Loaded ${districts.features.length} districts and ${streets.length} streets.`);

const updatedDistricts = JSON.parse(JSON.stringify(districts));
const generatedZones = [];

for (const d of updatedDistricts.features) {
  const dName = d.properties.name;
  const dId = d.properties.id || d.id;

  // Match streets belonging to this district or settlement
  const dStreets = streets.filter((s) => {
    if (s.district === dName) return true;
    if (s.cityName && dName.toLowerCase().includes(s.cityName.toLowerCase())) return true;
    return false;
  }).filter((s) => s.lat && s.lon && s.group);

  if (dStreets.length === 0) {
    console.log(`[Keep single] ${dName}: no streets mapped, keeping district poly`);
    generatedZones.push({
      type: 'Feature',
      id: `zone-${dId}`,
      properties: {
        id: `zone-${dId}`,
        name: dName,
        districtId: dId,
        districtName: dName,
        group: d.properties.primaryGroups?.[0] || '1.1',
        groups: d.properties.primaryGroups || ['1.1'],
        streets: d.properties.keyStreets || [],
        center: d.properties.center || [49.83, 24.0]
      },
      geometry: d.geometry
    });
    continue;
  }

  // Count groups in this area
  const groupCounts = {};
  for (const s of dStreets) {
    groupCounts[s.group] = (groupCounts[s.group] || 0) + 1;
  }

  // Sort groups by frequency
  const sortedGroups = Object.entries(groupCounts).sort((a, b) => b[1] - a[1]);
  // Update district primaryGroups with real top groups
  d.properties.primaryGroups = sortedGroups.slice(0, 5).map(([grp]) => grp);

  const dominantGroup = sortedGroups[0][0];

  // If district only has 1 group or <= 3 streets, keep as 1 single zone
  if (sortedGroups.length === 1 || dStreets.length <= 3) {
    console.log(`[Single group] ${dName} -> Group ${dominantGroup} (${dStreets.length} streets)`);
    generatedZones.push({
      type: 'Feature',
      id: `zone-${dId}-${dominantGroup.replace('.', '-')}`,
      properties: {
        id: `zone-${dId}-${dominantGroup.replace('.', '-')}`,
        name: `${dName} (Черга ${dominantGroup})`,
        districtId: dId,
        districtName: dName,
        group: dominantGroup,
        groups: [dominantGroup],
        streets: dStreets.slice(0, 10).map((s) => s.name),
        center: d.properties.center || [dStreets[0].lat, dStreets[0].lon]
      },
      geometry: d.geometry
    });
    continue;
  }

  // Multi-group district: generate Voronoi partition
  try {
    const points = dStreets.map((s) =>
      turf.point([s.lon, s.lat], { group: s.group, name: s.name })
    );
    const fc = turf.featureCollection(points);
    const bbox = turf.bbox(d);
    const expandedBbox = [bbox[0] - 0.015, bbox[1] - 0.015, bbox[2] + 0.015, bbox[3] + 0.015];
    const voronoi = turf.voronoi(fc, { bbox: expandedBbox });

    const groupPolys = {};
    const groupStreetNames = {};

    for (let i = 0; i < voronoi.features.length; i++) {
      const cell = voronoi.features[i];
      if (!cell) continue;
      const pt = points[i];
      const g = pt.properties.group;
      if (!groupStreetNames[g]) groupStreetNames[g] = new Set();
      groupStreetNames[g].add(pt.properties.name);

      try {
        const clipped = turf.intersect(turf.featureCollection([cell, d]));
        if (clipped && clipped.geometry) {
          if (!groupPolys[g]) groupPolys[g] = [];
          groupPolys[g].push(clipped);
        }
      } catch (e) {}
    }

    let zonesAddedForDistrict = 0;

    for (const [g, polys] of Object.entries(groupPolys)) {
      if (polys.length === 0) continue;

      try {
        let unitedGeom;
        if (polys.length === 1) {
          unitedGeom = polys[0];
        } else {
          unitedGeom = turf.union(turf.featureCollection(polys));
        }

        if (!unitedGeom || !unitedGeom.geometry) continue;

        // Simplify slightly to keep payload compact and 60fps fast
        const simplified = turf.simplify(unitedGeom, { tolerance: 0.0001, highQuality: false });
        const center = turf.centerOfMass(simplified);

        const streetList = Array.from(groupStreetNames[g] || []);
        generatedZones.push({
          type: 'Feature',
          id: `zone-${dId}-${g.replace('.', '-')}`,
          properties: {
            id: `zone-${dId}-${g.replace('.', '-')}`,
            name: `${dName} (Черга ${g})`,
            districtId: dId,
            districtName: dName,
            group: g,
            groups: [g],
            streets: streetList.slice(0, 10),
            center: [center.geometry.coordinates[1], center.geometry.coordinates[0]]
          },
          geometry: simplified.geometry
        });
        zonesAddedForDistrict++;
      } catch (uErr) {
        console.warn(`Union error for ${dName} ${g}:`, uErr.message);
      }
    }

    console.log(`[Partitioned] ${dName} -> ${zonesAddedForDistrict} outage zones created`);
  } catch (err) {
    console.warn(`Voronoi error for ${dName}:`, err.message);
  }
}

console.log(`\nDone! Total generated zones: ${generatedZones.length}`);

// Write files
const finalZonesGeoJson = {
  type: 'FeatureCollection',
  features: generatedZones
};

fs.writeFileSync(ZONES_FILE, JSON.stringify(finalZonesGeoJson, null, 2), 'utf8');
fs.writeFileSync(DISTRICTS_FILE, JSON.stringify(updatedDistricts, null, 2), 'utf8');
console.log(`Saved to ${ZONES_FILE} and ${DISTRICTS_FILE}`);
