const fs = require('fs');
const path = require('path');

const allLoeStreets = JSON.parse(fs.readFileSync('/tmp/all_greater_lviv_streets.json', 'utf8'));
const existingCurated = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/streets.json'), 'utf8'));
const districts = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/districts.json'), 'utf8'));

// Map of curated streets by normalized name
const curatedMap = new Map();
for (const s of existingCurated) {
  const norm = s.name.toLowerCase().replace(/^(вул\.|просп\.|пл\.|проїзд|пров\.)\s*/, '').trim();
  curatedMap.set(norm, s);
}

// Map of district centers and primary groups
const districtMetaMap = new Map();
for (const d of districts.features) {
  districtMetaMap.set(d.properties.name, {
    center: d.properties.center,
    group: d.properties.primaryGroups[0] || '1.1',
    primaryGroups: d.properties.primaryGroups
  });
}

// Fallback district coordinates
const defaultCenters = {
  'Львів': [49.8397, 24.0297],
  'Винники': [49.8150, 24.1350],
  'Брюховичі': [49.9020, 23.9530],
  'Рудне': [49.8400, 23.8850],
  'Дубляни': [49.8980, 24.0880],
  'Малехів': [49.8780, 24.0680],
  'Рясне-Руське': [49.8650, 23.9150],
  'Лисиничі': [49.8350, 24.1020],
  'Підбірці': [49.8450, 24.1350],
  'Сокільники': [49.7780, 24.0150],
  'Зимна Вода': [49.8280, 23.8950],
  'Лапаївка': [49.8160, 23.8920],
  'Холодновідка': [49.8100, 23.9050],
  'Суховоля': [49.8520, 23.8450],
  'Скнилів': [49.8150, 23.9400],
  'Солонка': [49.7420, 24.0180],
  'Зубра': [49.7750, 24.0480],
  'Пустомити': [49.7150, 23.9050],
  'Наварія': [49.7350, 23.9250]
};

const defaultGroups = {
  'Львів': '1.1',
  'Винники': '4.2',
  'Брюховичі': '2.2',
  'Рудне': '1.1',
  'Дубляни': '2.2',
  'Малехів': '2.2',
  'Рясне-Руське': '4.1',
  'Лисиничі': '4.2',
  'Підбірці': '4.2',
  'Сокільники': '3.1',
  'Зимна Вода': '6.1',
  'Лапаївка': '1.1',
  'Холодновідка': '1.1',
  'Суховоля': '1.1',
  'Скнилів': '6.1',
  'Солонка': '3.1',
  'Зубра': '3.1',
  'Пустомити': '3.1',
  'Наварія': '3.1'
};

const processedStreets = [];
const seenIds = new Set();

// Helper to determine district in Lviv if possible
function guessLvivDistrict(name) {
  const n = name.toLowerCase();
  if (n.includes('сихів') || n.includes('калини') || n.includes('драган') || n.includes('скрипник') || n.includes('хуторів') || n.includes('зубрів') || n.includes('чукарін') || n.includes('коломий')) {
    return { district: 'Сихівський район', group: '3.1', center: [49.792, 24.058] };
  }
  if (n.includes('науков') || n.includes('великого') || n.includes('симонен') || n.includes('кульпарк') || n.includes('чупринк') || n.includes('коновальц') || n.includes('сахаров') || n.includes('ольги')) {
    return { district: 'Франківський район', group: '5.1', center: [49.813, 24.001] };
  }
  if (n.includes('чорновол') || n.includes('мазеп') || n.includes('грінчен') || n.includes('варшав') || n.includes('топольн') || n.includes('миколайчук') || n.includes('рясн') || n.includes('величков')) {
    return { district: 'Шевченківський район', group: '1.1', center: [49.865, 24.015] };
  }
  if (n.includes('ринок') || n.includes('свободи') || n.includes('дорошен') || n.includes('франка') || n.includes('коперник') || n.includes('підзамч') || n.includes('гайдамац') || n.includes('снопків')) {
    return { district: 'Галицький район', group: '1.2', center: [49.838, 24.029] };
  }
  if (n.includes('широк') || n.includes('сяйво') || n.includes('любінськ') || n.includes('виговськ') || n.includes('суботів') || n.includes('білогорщ') || n.includes('патон')) {
    return { district: 'Залізничний район', group: '1.1', center: [49.832, 23.955] };
  }
  if (n.includes('личаків') || n.includes('пасічн') || n.includes('погулянк') || n.includes('вашингтон') || n.includes('печер') || n.includes('майорівк') || n.includes('тракт')) {
    return { district: 'Личаківський район', group: '2.1', center: [49.835, 24.085] };
  }
  return { district: 'Львів', group: '1.1', center: [49.8397, 24.0297] };
}

for (const st of allLoeStreets) {
  if (seenIds.has(st.id)) continue;
  seenIds.add(st.id);

  const cleanName = st.name.trim();
  const norm = cleanName.toLowerCase().replace(/^(вул\.|просп\.|пл\.|проїзд|пров\.)\s*/, '').trim();

  // If we have curated coordinates & exact district for this street
  if (curatedMap.has(norm)) {
    const cur = curatedMap.get(norm);
    processedStreets.push({
      id: st.id,
      name: cur.name,
      district: cur.district,
      group: cur.group,
      lat: cur.lat,
      lon: cur.lon,
      cityId: st.cityId,
      cityName: st.cityName,
      buildings: cur.buildings || '1-100'
    });
    continue;
  }

  // Suburb streets
  if (st.cityName !== 'Львів') {
    const center = defaultCenters[st.cityName] || [49.8397, 24.0297];
    const group = defaultGroups[st.cityName] || '1.1';
    // Add tiny deterministic jitter so multiple streets in suburb don't have exact same point
    const hash = (st.id * 9301 + 49297) % 233280;
    const jitterLat = ((hash % 100) - 50) * 0.00015;
    const jitterLon = (((hash / 100) % 100) - 50) * 0.0002;

    processedStreets.push({
      id: st.id,
      name: `вул. ${cleanName}`,
      district: st.cityName,
      group: group,
      lat: Number((center[0] + jitterLat).toFixed(5)),
      lon: Number((center[1] + jitterLon).toFixed(5)),
      cityId: st.cityId,
      cityName: st.cityName,
      buildings: '1-60'
    });
    continue;
  }

  // Lviv city street
  const guess = guessLvivDistrict(cleanName);
  const hash = (st.id * 9301 + 49297) % 233280;
  const jitterLat = ((hash % 100) - 50) * 0.0002;
  const jitterLon = (((hash / 100) % 100) - 50) * 0.0003;

  processedStreets.push({
    id: st.id,
    name: `вул. ${cleanName}`,
    district: guess.district,
    group: guess.group,
    lat: Number((guess.center[0] + jitterLat).toFixed(5)),
    lon: Number((guess.center[1] + jitterLon).toFixed(5)),
    cityId: st.cityId,
    cityName: 'Львів',
    buildings: '1-80'
  });
}

const outputPath = path.join(__dirname, '../src/data/streets.json');
fs.writeFileSync(outputPath, JSON.stringify(processedStreets, null, 2), 'utf8');

console.log(`Generated complete streets.json with ${processedStreets.length} searchable streets.`);
