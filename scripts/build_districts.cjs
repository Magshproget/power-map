const fs = require('fs');
const path = require('path');

const rawDistricts = JSON.parse(fs.readFileSync('/tmp/lviv_districts_raw.json', 'utf8'));
const rawSuburbs = JSON.parse(fs.readFileSync('/tmp/greater_lviv_suburbs.json', 'utf8'));

// District primary groups and metadata
const districtMeta = {
  halitskiy: {
    name: 'Галицький район',
    center: [49.838, 24.029],
    primaryGroups: ['1.2', '2.1', '6.2'],
    keyStreets: ['пл. Ринок', 'просп. Свободи', 'вул. Дорошенка', 'вул. Івана Франка', 'вул. Коперника', 'вул. Зелена (початок)', 'вул. Богдана Хмельницького']
  },
  frankivskiy: {
    name: 'Франківський район',
    center: [49.813, 24.001],
    primaryGroups: ['5.1', '3.1', '2.1'],
    keyStreets: ['вул. Наукова', 'вул. Володимира Великого', 'вул. Симоненка', 'вул. Кульпарківська', 'вул. Генерала Чупринки', 'вул. Коновальця', 'вул. Академіка Сахарова', 'вул. Княгині Ольги']
  },
  shevchenkivskiy: {
    name: 'Шевченківський район',
    center: [49.865, 24.015],
    primaryGroups: ['1.1', '2.2', '4.1'],
    keyStreets: ['просп. В. Чорновола', 'вул. Гетьмана Мазепи', 'вул. Грінченка', 'вул. Варшавська', 'вул. Топольна', 'вул. Миколайчука', 'вул. Замарстинівська', 'вул. Шевченка (Рясне)']
  },
  sykhivskiy: {
    name: 'Сихівський район',
    center: [49.792, 24.058],
    primaryGroups: ['3.1', '3.2', '1.2', '4.1'],
    keyStreets: ['просп. Червоної Калини', 'вул. Сихівська', 'вул. Драгана', 'вул. Скрипника', 'вул. Хуторівка', 'вул. Зубрівська', 'вул. Коломийська', 'вул. Вернадського', 'вул. Кавалерідзе']
  },
  zaliznichniy: {
    name: 'Залізничний район',
    center: [49.832, 23.955],
    primaryGroups: ['1.1', '3.1', '6.1'],
    keyStreets: ['вул. Широка', 'вул. Сяйво', 'вул. Суботівська', 'вул. Любінська', 'вул. Івана Виговського', 'вул. Симона Петлюри', 'вул. Кульчицької', 'вул. Білогорща', 'вул. Патона', 'вул. Городоцька']
  },
  lychakivskiy: {
    name: 'Личаківський район',
    center: [49.835, 24.085],
    primaryGroups: ['2.1', '4.2', '5.2'],
    keyStreets: ['вул. Личаківська', 'вул. Пасічна', 'вул. Погулянка', 'вул. Джорджа Вашингтона', 'вул. Медової Печери', 'вул. Майорівка', 'вул. Тракт Глинянський', 'вул. Богданівська']
  }
};

const allFeatures = [];

// 1. Add 6 core districts with clean official boundaries
for (const f of rawDistricts.features) {
  const meta = districtMeta[f.properties.id];
  if (!meta) continue;

  allFeatures.push({
    type: 'Feature',
    id: f.properties.id,
    properties: {
      id: f.properties.id,
      name: meta.name,
      center: meta.center,
      primaryGroups: meta.primaryGroups,
      keyStreets: meta.keyStreets,
      isSubdistrict: false
    },
    geometry: f.geometry
  });
}

// 2. Add 9 outer suburbs / Greater Lviv areas
for (const sub of rawSuburbs) {
  allFeatures.push({
    type: 'Feature',
    id: sub.id,
    properties: {
      id: sub.id,
      name: sub.properties.name,
      center: sub.properties.center,
      primaryGroups: sub.properties.primaryGroups,
      keyStreets: sub.properties.keyStreets,
      isSubdistrict: true
    },
    geometry: sub.geometry
  });
}

const collection = {
  type: 'FeatureCollection',
  features: allFeatures
};

fs.writeFileSync(
  path.join(__dirname, '../src/data/districts.json'),
  JSON.stringify(collection, null, 2),
  'utf8'
);

console.log(`Generated districts.json with ${allFeatures.length} real districts and suburbs.`);
