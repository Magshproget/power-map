const fs = require('fs');
const path = require('path');

const districts = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/districts.json'), 'utf8'));

// Each feature in districts is a real polygon from OpenStreetMap (no straight cuts!)
const zones = districts.features.map(f => {
  const p = f.properties;
  const mainGroup = p.primaryGroups[0] || '1.1';
  return {
    type: 'Feature',
    id: `zone-${p.id}`,
    properties: {
      id: `zone-${p.id}`,
      name: `${p.name} (Черга ${mainGroup})`,
      districtId: p.id,
      districtName: p.name,
      group: mainGroup,
      groups: p.primaryGroups,
      streets: p.keyStreets,
      center: p.center
    },
    geometry: f.geometry
  };
});

const collection = {
  type: 'FeatureCollection',
  features: zones
};

fs.writeFileSync(
  path.join(__dirname, '../src/data/zones.json'),
  JSON.stringify(collection, null, 2),
  'utf8'
);

console.log(`Generated clean zones.json with ${zones.length} natural polygons (zero straight cuts).`);
