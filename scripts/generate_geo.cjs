const fs = require('fs');
const path = require('path');
const turf = require('@turf/turf');

const rawDistrictsPath = '/tmp/lviv_districts_raw.json';
const rawData = JSON.parse(fs.readFileSync(rawDistrictsPath, 'utf8'));

// District metadata & microzone specifications
const districtSpecs = {
  sykhivskiy: {
    name: 'Сихівський район',
    center: [49.792, 24.058],
    primaryGroups: ['3.1', '3.2', '1.2', '4.1'],
    splitAxis: 'lat', // split North to South
    zones: [
      {
        id: 'sykhiv-iskra',
        name: 'Сихів Північний (Іскра, Сихівська)',
        group: '3.2',
        streets: ['вул. Сихівська', 'вул. Зубрівська', 'вул. Манастирського', 'вул. Кавалерідзе'],
        sliceIndex: 2 // North slice
      },
      {
        id: 'sykhiv-center',
        name: 'Сихів Центр (Санта-Барбара, Драгана)',
        group: '3.1',
        streets: ['просп. Червоної Калини', 'вул. Драгана', 'вул. Скрипника', 'вул. Вернадського'],
        sliceIndex: 1 // Middle slice
      },
      {
        id: 'sykhiv-bodnarivka',
        name: 'Боднарівка & Хуторівка',
        group: '1.2',
        streets: ['вул. Хуторівка', 'вул. Стрийська (південь)', 'вул. Чукаріна', 'вул. Скорини'],
        sliceIndex: 0 // South slice
      }
    ]
  },
  frankivskiy: {
    name: 'Франківський район',
    center: [49.813, 24.001],
    primaryGroups: ['5.1', '3.1', '2.1'],
    splitAxis: 'lat',
    zones: [
      {
        id: 'frankivsk-kastelivka',
        name: 'Кастелівка & Сахарова',
        group: '2.1',
        streets: ['вул. Генерала Чупринки', 'вул. Коновальця', 'вул. Мельника', 'вул. Академіка Сахарова'],
        sliceIndex: 2 // North
      },
      {
        id: 'frankivsk-kulparkiv',
        name: 'Кульпарків & В. Великого',
        group: '3.1',
        streets: ['вул. Кульпарківська', 'вул. Володимира Великого (непарна)', 'вул. Боткіна'],
        sliceIndex: 1 // Middle
      },
      {
        id: 'frankivsk-naukova',
        name: 'Наукова & Симоненка',
        group: '5.1',
        streets: ['вул. Наукова', 'вул. Симоненка', 'вул. Володимира Великого (парна)'],
        sliceIndex: 0 // South
      }
    ]
  },
  shevchenkivskiy: {
    name: 'Шевченківський район',
    center: [49.865, 24.015],
    primaryGroups: ['1.1', '2.2', '4.1'],
    splitAxis: 'lon', // West to East
    zones: [
      {
        id: 'shevch-ryasne',
        name: 'Рясне-1 & Рясне-2',
        group: '4.1',
        streets: ['вул. Шевченка (Рясне)', 'вул. Величковського', 'вул. Брюховицька'],
        sliceIndex: 0 // West
      },
      {
        id: 'shevch-chornovola',
        name: 'Чорновола & Варшавська',
        group: '2.2',
        streets: ['просп. В. Чорновола', 'вул. Варшавська', 'вул. Панча', 'вул. Замарстинівська'],
        sliceIndex: 1 // Middle
      },
      {
        id: 'shevch-topolna',
        name: 'Топольна & Мазепи',
        group: '1.1',
        streets: ['вул. Гетьмана Мазепи', 'вул. Грінченка', 'вул. Миколайчука', 'вул. Топольна'],
        sliceIndex: 2 // East
      }
    ]
  },
  halitskiy: {
    name: 'Галицький район',
    center: [49.838, 24.029],
    primaryGroups: ['1.2', '2.1', '6.2'],
    splitAxis: 'lat',
    zones: [
      {
        id: 'halych-pidzamche',
        name: 'Підзамче & Гайдамацька',
        group: '6.2',
        streets: ['вул. Богдана Хмельницького (початок)', 'вул. Гайдамацька', 'вул. Клепарівська'],
        sliceIndex: 2 // North
      },
      {
        id: 'halych-center',
        name: 'Історичний центр & пл. Ринок',
        group: '1.2',
        streets: ['пл. Ринок', 'просп. Свободи', 'вул. Дорошенка', 'вул. Городоцька (початок)'],
        sliceIndex: 1 // Middle
      },
      {
        id: 'halych-snopkiv',
        name: 'Цитадель & Снопків',
        group: '2.1',
        streets: ['вул. Зелена (початок)', 'вул. Івана Франка', 'вул. Снопківська', 'вул. Дмитра Вітовського'],
        sliceIndex: 0 // South
      }
    ]
  },
  zaliznichniy: {
    name: 'Залізничний район',
    center: [49.832, 23.955],
    primaryGroups: ['1.1', '3.1', '6.1'],
    splitAxis: 'lat',
    zones: [
      {
        id: 'zalizn-levandivka',
        name: 'Левандівка',
        group: '1.1',
        streets: ['вул. Широка', 'вул. Сяйво', 'вул. Суботівська', 'вул. Повітряна'],
        sliceIndex: 2 // North
      },
      {
        id: 'zalizn-liubinska',
        name: 'Любінська & Виговського',
        group: '3.1',
        streets: ['вул. Любінська', 'вул. Івана Виговського', 'вул. Кульчицької', 'вул. Симона Петлюри'],
        sliceIndex: 1 // Middle
      },
      {
        id: 'zalizn-bilohorshcha',
        name: 'Білогорща & Скнилів',
        group: '6.1',
        streets: ['вул. Білогорща', 'вул. Городоцька (Залізничний)', 'вул. Скнилівська'],
        sliceIndex: 0 // South
      }
    ]
  },
  lychakivskiy: {
    name: 'Личаківський район',
    center: [49.835, 24.085],
    primaryGroups: ['2.1', '4.2', '5.2'],
    splitAxis: 'lat',
    zones: [
      {
        id: 'lychak-trakt',
        name: 'Тракт Глинянський & Лисиничі',
        group: '4.2',
        streets: ['вул. Тракт Глинянський', 'вул. Богданівська', 'вул. Лисиничівська'],
        sliceIndex: 2 // North
      },
      {
        id: 'lychak-pasichna',
        name: 'Пасічна & Погулянка',
        group: '2.1',
        streets: ['вул. Пасічна', 'вул. Погулянка', 'вул. Личаківська (центр)', 'вул. Вахнянина'],
        sliceIndex: 1 // Middle
      },
      {
        id: 'lychak-mayorivka',
        name: 'Майорівка & Вашингтона',
        group: '5.2',
        streets: ['вул. Майорівка', 'вул. Джорджа Вашингтона', 'вул. Медової Печери'],
        sliceIndex: 0 // South
      }
    ]
  }
};

const processedDistricts = [];
const processedZones = [];

for (const feature of rawData.features) {
  const distId = feature.properties.id;
  const spec = districtSpecs[distId];
  if (!spec) continue;

  const districtFeature = {
    type: 'Feature',
    id: distId,
    properties: {
      id: distId,
      name: spec.name,
      center: spec.center,
      primaryGroups: spec.primaryGroups,
      keyStreets: spec.zones.flatMap(z => z.streets)
    },
    geometry: feature.geometry
  };
  processedDistricts.push(districtFeature);

  // Compute bbox of the district
  const bbox = turf.bbox(feature); // [minX, minY, maxX, maxY] => [minLon, minLat, maxLon, maxLat]
  const [minLon, minLat, maxLon, maxLat] = bbox;

  // Split bounding box into 3 slices along splitAxis
  for (const zone of spec.zones) {
    let sliceBbox;
    const idx = zone.sliceIndex; // 0, 1, 2
    if (spec.splitAxis === 'lat') {
      const latStep = (maxLat - minLat) / 3;
      const sliceMinLat = minLat + idx * latStep - 0.0001;
      const sliceMaxLat = minLat + (idx + 1) * latStep + 0.0001;
      sliceBbox = [minLon - 0.001, sliceMinLat, maxLon + 0.001, sliceMaxLat];
    } else {
      const lonStep = (maxLon - minLon) / 3;
      const sliceMinLon = minLon + idx * lonStep - 0.0001;
      const sliceMaxLon = minLon + (idx + 1) * lonStep + 0.0001;
      sliceBbox = [sliceMinLon, minLat - 0.001, sliceMaxLon, maxLat + 0.001];
    }

    try {
      const clipped = turf.bboxClip(feature, sliceBbox);
      if (clipped && clipped.geometry && clipped.geometry.coordinates.length > 0) {
        // Calculate center of this zone
        const zoneCenter = turf.center(clipped).geometry.coordinates; // [lon, lat]
        processedZones.push({
          type: 'Feature',
          id: zone.id,
          properties: {
            id: zone.id,
            name: zone.name,
            districtId: distId,
            districtName: spec.name,
            group: zone.group,
            streets: zone.streets,
            center: [zoneCenter[1], zoneCenter[0]] // [lat, lon]
          },
          geometry: clipped.geometry
        });
      }
    } catch (err) {
      console.error(`Error clipping zone ${zone.id}:`, err);
    }
  }
}

const districtsCollection = {
  type: 'FeatureCollection',
  features: processedDistricts
};

const zonesCollection = {
  type: 'FeatureCollection',
  features: processedZones
};

fs.writeFileSync(
  path.join(__dirname, '../src/data/districts.json'),
  JSON.stringify(districtsCollection, null, 2),
  'utf8'
);

fs.writeFileSync(
  path.join(__dirname, '../src/data/zones.json'),
  JSON.stringify(zonesCollection, null, 2),
  'utf8'
);

console.log(`Generated: ${processedDistricts.length} districts and ${processedZones.length} zones.`);
