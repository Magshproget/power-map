const fs = require('fs');
const path = require('path');

const streets = [
  // Сихівський район
  { id: '1', name: 'просп. Червоної Калини', district: 'Сихівський район', group: '3.1', lat: 49.7905, lon: 24.0560, buildings: '1-135' },
  { id: '2', name: 'вул. Сихівська', district: 'Сихівський район', group: '3.2', lat: 49.7960, lon: 24.0670, buildings: '1-30' },
  { id: '3', name: 'вул. Драгана', district: 'Сихівський район', group: '3.1', lat: 49.7840, lon: 24.0530, buildings: '1-28' },
  { id: '4', name: 'вул. Скрипника', district: 'Сихівський район', group: '3.1', lat: 49.7830, lon: 24.0580, buildings: '1-39' },
  { id: '5', name: 'вул. Хуторівка', district: 'Сихівський район', group: '1.2', lat: 49.8010, lon: 24.0320, buildings: '1-50' },
  { id: '6', name: 'вул. Зубрівська', district: 'Сихівський район', group: '3.2', lat: 49.7990, lon: 24.0580, buildings: '1-36' },
  { id: '7', name: 'вул. Коломийська', district: 'Сихівський район', group: '3.1', lat: 49.7870, lon: 24.0620, buildings: '1-23' },
  { id: '8', name: 'вул. Вернадського', district: 'Сихівський район', group: '3.1', lat: 49.7800, lon: 24.0510, buildings: '1-42' },
  { id: '9', name: 'вул. Кавалерідзе', district: 'Сихівський район', group: '3.2', lat: 49.7930, lon: 24.0640, buildings: '1-27' },
  { id: '10', name: 'вул. Манастирського', district: 'Сихівський район', group: '3.2', lat: 49.7980, lon: 24.0530, buildings: '1-10' },

  // Франківський район
  { id: '11', name: 'вул. Наукова', district: 'Франківський район', group: '5.1', lat: 49.8030, lon: 24.0010, buildings: '1-116' },
  { id: '12', name: 'вул. Володимира Великого', district: 'Франківський район', group: '3.1', lat: 49.8110, lon: 23.9920, buildings: '1-125' },
  { id: '13', name: 'вул. Симоненка', district: 'Франківський район', group: '5.1', lat: 49.8050, lon: 23.9940, buildings: '1-13' },
  { id: '14', name: 'вул. Кульпарківська', district: 'Франківський район', group: '3.1', lat: 49.8150, lon: 23.9870, buildings: '1-230' },
  { id: '15', name: 'вул. Генерала Чупринки', district: 'Франківський район', group: '2.1', lat: 49.8290, lon: 24.0080, buildings: '1-130' },
  { id: '16', name: 'вул. Коновальця', district: 'Франківський район', group: '2.1', lat: 49.8270, lon: 23.9990, buildings: '1-118' },
  { id: '17', name: 'вул. Академіка Сахарова', district: 'Франківський район', group: '2.1', lat: 49.8240, lon: 24.0120, buildings: '1-82' },
  { id: '18', name: 'вул. Стрийська (Франківський)', district: 'Франківський район', group: '5.1', lat: 49.8070, lon: 24.0200, buildings: '45-115' },
  { id: '19', name: 'вул. Княгині Ольги', district: 'Франківський район', group: '3.1', lat: 49.8130, lon: 24.0040, buildings: '1-122' },
  { id: '20', name: 'вул. Рубчака', district: 'Франківський район', group: '5.1', lat: 49.8060, lon: 24.0110, buildings: '1-32' },

  // Шевченківський район
  { id: '21', name: 'просп. В. Чорновола', district: 'Шевченківський район', group: '2.2', lat: 49.8520, lon: 24.0240, buildings: '1-105' },
  { id: '22', name: 'вул. Гетьмана Мазепи', district: 'Шевченківський район', group: '1.1', lat: 49.8710, lon: 24.0320, buildings: '1-35' },
  { id: '23', name: 'вул. Грінченка', district: 'Шевченківський район', group: '1.1', lat: 49.8730, lon: 24.0450, buildings: '1-26' },
  { id: '24', name: 'вул. Варшавська', district: 'Шевченківський район', group: '2.2', lat: 49.8610, lon: 24.0150, buildings: '1-190' },
  { id: '25', name: 'вул. Топольна', district: 'Шевченківський район', group: '1.1', lat: 49.8700, lon: 24.0250, buildings: '1-40' },
  { id: '26', name: 'вул. Миколайчука', district: 'Шевченківський район', group: '1.1', lat: 49.8760, lon: 24.0480, buildings: '1-38' },
  { id: '27', name: 'вул. Замарстинівська', district: 'Шевченківський район', group: '2.2', lat: 49.8580, lon: 24.0300, buildings: '1-270' },
  { id: '28', name: 'вул. Панча', district: 'Шевченківський район', group: '2.2', lat: 49.8600, lon: 24.0210, buildings: '1-24' },
  { id: '29', name: 'вул. Шевченка (Рясне)', district: 'Шевченківський район', group: '4.1', lat: 49.8690, lon: 23.9550, buildings: '315-416' },
  { id: '30', name: 'вул. Величковського', district: 'Шевченківський район', group: '4.1', lat: 49.8750, lon: 23.9450, buildings: '1-60' },

  // Галицький район
  { id: '31', name: 'пл. Ринок', district: 'Галицький район', group: '1.2', lat: 49.8418, lon: 24.0315, buildings: '1-45' },
  { id: '32', name: 'просп. Свободи', district: 'Галицький район', group: '1.2', lat: 49.8410, lon: 24.0270, buildings: '1-45' },
  { id: '33', name: 'вул. Дорошенка', district: 'Галицький район', group: '1.2', lat: 49.8395, lon: 24.0240, buildings: '1-75' },
  { id: '34', name: 'вул. Івана Франка', district: 'Галицький район', group: '2.1', lat: 49.8340, lon: 24.0350, buildings: '1-160' },
  { id: '35', name: 'вул. Зелена (початок)', district: 'Галицький район', group: '2.1', lat: 49.8330, lon: 24.0400, buildings: '1-100' },
  { id: '36', name: 'вул. Коперника', district: 'Галицький район', group: '1.2', lat: 49.8370, lon: 24.0230, buildings: '1-60' },
  { id: '37', name: 'вул. Городоцька (початок)', district: 'Галицький район', group: '1.2', lat: 49.8420, lon: 24.0210, buildings: '1-85' },
  { id: '38', name: 'вул. Богдана Хмельницького (початок)', district: 'Галицький район', group: '6.2', lat: 49.8470, lon: 24.0350, buildings: '1-110' },
  { id: '39', name: 'вул. Гайдамацька', district: 'Галицький район', group: '6.2', lat: 49.8510, lon: 24.0340, buildings: '1-30' },
  { id: '40', name: 'вул. Снопківська', district: 'Галицький район', group: '2.1', lat: 49.8270, lon: 24.0360, buildings: '1-47' },

  // Залізничний район
  { id: '41', name: 'вул. Широка', district: 'Залізничний район', group: '1.1', lat: 49.8460, lon: 23.9680, buildings: '1-100' },
  { id: '42', name: 'вул. Сяйво', district: 'Залізничний район', group: '1.1', lat: 49.8420, lon: 23.9780, buildings: '1-25' },
  { id: '43', name: 'вул. Суботівська', district: 'Залізничний район', group: '1.1', lat: 49.8480, lon: 23.9620, buildings: '1-20' },
  { id: '44', name: 'вул. Любінська', district: 'Залізничний район', group: '3.1', lat: 49.8240, lon: 23.9650, buildings: '1-160' },
  { id: '45', name: 'вул. Івана Виговського', district: 'Залізничний район', group: '3.1', lat: 49.8210, lon: 23.9740, buildings: '1-89' },
  { id: '46', name: 'вул. Симона Петлюри', district: 'Залізничний район', group: '3.1', lat: 49.8180, lon: 23.9780, buildings: '1-45' },
  { id: '47', name: 'вул. Кульчицької', district: 'Залізничний район', group: '3.1', lat: 49.8220, lon: 23.9700, buildings: '1-18' },
  { id: '48', name: 'вул. Білогорща', district: 'Залізничний район', group: '6.1', lat: 49.8480, lon: 23.9350, buildings: '1-80' },
  { id: '49', name: 'вул. Городоцька (Залізничний)', district: 'Залізничний район', group: '6.1', lat: 49.8320, lon: 23.9600, buildings: '170-320' },
  { id: '50', name: 'вул. Патона', district: 'Залізничний район', group: '3.1', lat: 49.8250, lon: 23.9620, buildings: '1-37' },

  // Личаківський район
  { id: '51', name: 'вул. Личаківська', district: 'Личаківський район', group: '2.1', lat: 49.8390, lon: 24.0550, buildings: '1-260' },
  { id: '52', name: 'вул. Пасічна', district: 'Личаківський район', group: '2.1', lat: 49.8250, lon: 24.0750, buildings: '1-180' },
  { id: '53', name: 'вул. Погулянка', district: 'Личаківський район', group: '2.1', lat: 49.8290, lon: 24.0580, buildings: '1-45' },
  { id: '54', name: 'вул. Джорджа Вашингтона', district: 'Личаківський район', group: '5.2', lat: 49.8180, lon: 24.0720, buildings: '1-25' },
  { id: '55', name: 'вул. Медової Печери', district: 'Личаківський район', group: '5.2', lat: 49.8220, lon: 24.0850, buildings: '1-70' },
  { id: '56', name: 'вул. Майорівка', district: 'Личаківський район', group: '5.2', lat: 49.8200, lon: 24.0900, buildings: '1-40' },
  { id: '57', name: 'вул. Тракт Глинянський', district: 'Личаківський район', group: '4.2', lat: 49.8450, lon: 24.0800, buildings: '1-165' },
  { id: '58', name: 'вул. Богданівська', district: 'Личаківський район', group: '4.2', lat: 49.8520, lon: 24.0880, buildings: '1-50' },
  { id: '59', name: 'вул. Лисиничівська', district: 'Личаківський район', group: '4.2', lat: 49.8380, lon: 24.0950, buildings: '1-35' },
  { id: '60', name: 'вул. Вахнянина', district: 'Личаківський район', group: '2.1', lat: 49.8310, lon: 24.0620, buildings: '1-33' }
];

fs.writeFileSync(
  path.join(__dirname, '../src/data/streets.json'),
  JSON.stringify(streets, null, 2),
  'utf8'
);

console.log(`Saved ${streets.length} indexed streets.`);
