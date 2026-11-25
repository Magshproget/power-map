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
  { id: '11', name: 'вул. Чукаріна', district: 'Сихівський район', group: '1.2', lat: 49.7960, lon: 24.0450, buildings: '1-32' },
  { id: '12', name: 'вул. Полуботка Гетьмана', district: 'Сихівський район', group: '3.1', lat: 49.7890, lon: 24.0610, buildings: '1-21' },

  // Франківський район
  { id: '20', name: 'вул. Наукова', district: 'Франківський район', group: '5.1', lat: 49.8030, lon: 24.0010, buildings: '1-116' },
  { id: '21', name: 'вул. Володимира Великого', district: 'Франківський район', group: '3.1', lat: 49.8110, lon: 23.9920, buildings: '1-125' },
  { id: '22', name: 'вул. Симоненка В.', district: 'Франківський район', group: '5.1', lat: 49.8050, lon: 23.9940, buildings: '1-13' },
  { id: '23', name: 'вул. Кульпарківська', district: 'Франківський район', group: '3.1', lat: 49.8150, lon: 23.9870, buildings: '1-230' },
  { id: '24', name: 'вул. Генерала Чупринки', district: 'Франківський район', group: '2.1', lat: 49.8290, lon: 24.0080, buildings: '1-130' },
  { id: '25', name: 'вул. Коновальця Є.', district: 'Франківський район', group: '2.1', lat: 49.8270, lon: 23.9990, buildings: '1-118' },
  { id: '26', name: 'вул. Академіка Сахарова', district: 'Франківський район', group: '2.1', lat: 49.8240, lon: 24.0120, buildings: '1-82' },
  { id: '27', name: 'вул. Княгині Ольги', district: 'Франківський район', group: '3.1', lat: 49.8130, lon: 24.0040, buildings: '1-122' },
  { id: '28', name: 'вул. Рубчака І.', district: 'Франківський район', group: '5.1', lat: 49.8060, lon: 24.0110, buildings: '1-32' },
  { id: '29', name: 'вул. Стрийська', district: 'Франківський район', group: '5.1', lat: 49.8070, lon: 24.0200, buildings: '45-115' },

  // Шевченківський район
  { id: '40', name: 'просп. В. Чорновола', district: 'Шевченківський район', group: '2.2', lat: 49.8520, lon: 24.0240, buildings: '1-105' },
  { id: '41', name: 'вул. Гетьмана Мазепи', district: 'Шевченківський район', group: '1.1', lat: 49.8710, lon: 24.0320, buildings: '1-35' },
  { id: '42', name: 'вул. Грінченка Б.', district: 'Шевченківський район', group: '1.1', lat: 49.8730, lon: 24.0450, buildings: '1-26' },
  { id: '43', name: 'вул. Варшавська', district: 'Шевченківський район', group: '2.2', lat: 49.8610, lon: 24.0150, buildings: '1-190' },
  { id: '44', name: 'вул. Топольна', district: 'Шевченківський район', group: '1.1', lat: 49.8700, lon: 24.0250, buildings: '1-40' },
  { id: '45', name: 'вул. Миколайчука І.', district: 'Шевченківський район', group: '1.1', lat: 49.8760, lon: 24.0480, buildings: '1-38' },
  { id: '46', name: 'вул. Замарстинівська', district: 'Шевченківський район', group: '2.2', lat: 49.8580, lon: 24.0300, buildings: '1-270' },
  { id: '47', name: 'вул. Шевченка (Рясне)', district: 'Шевченківський район', group: '4.1', lat: 49.8690, lon: 23.9550, buildings: '315-416' },

  // Галицький район
  { id: '60', name: 'пл. Ринок', district: 'Галицький район', group: '1.2', lat: 49.8418, lon: 24.0315, buildings: '1-45' },
  { id: '61', name: 'просп. Свободи', district: 'Галицький район', group: '1.2', lat: 49.8410, lon: 24.0270, buildings: '1-45' },
  { id: '62', name: 'вул. Дорошенка П.', district: 'Галицький район', group: '1.2', lat: 49.8395, lon: 24.0240, buildings: '1-75' },
  { id: '63', name: 'вул. Івана Франка', district: 'Галицький район', group: '2.1', lat: 49.8340, lon: 24.0350, buildings: '1-160' },
  { id: '64', name: 'вул. Зелена', district: 'Галицький район', group: '2.1', lat: 49.8330, lon: 24.0400, buildings: '1-100' },
  { id: '65', name: 'вул. Коперника М.', district: 'Галицький район', group: '1.2', lat: 49.8370, lon: 24.0230, buildings: '1-60' },
  { id: '66', name: 'вул. Богдана Хмельницького', district: 'Галицький район', group: '6.2', lat: 49.8470, lon: 24.0350, buildings: '1-110' },

  // Залізничний район
  { id: '70', name: 'вул. Широка', district: 'Залізничний район', group: '1.1', lat: 49.8460, lon: 23.9680, buildings: '1-100' },
  { id: '71', name: 'вул. Сяйво', district: 'Залізничний район', group: '1.1', lat: 49.8420, lon: 23.9780, buildings: '1-25' },
  { id: '72', name: 'вул. Любінська', district: 'Залізничний район', group: '3.1', lat: 49.8240, lon: 23.9650, buildings: '1-160' },
  { id: '73', name: 'вул. Івана Виговського', district: 'Залізничний район', group: '3.1', lat: 49.8210, lon: 23.9740, buildings: '1-89' },
  { id: '74', name: 'вул. Білогорща', district: 'Залізничний район', group: '6.1', lat: 49.8480, lon: 23.9350, buildings: '1-80' },
  { id: '75', name: 'вул. Городоцька', district: 'Залізничний район', group: '6.1', lat: 49.8320, lon: 23.9600, buildings: '170-320' },

  // Личаківський район
  { id: '80', name: 'вул. Личаківська', district: 'Личаківський район', group: '2.1', lat: 49.8390, lon: 24.0550, buildings: '1-260' },
  { id: '81', name: 'вул. Пасічна', district: 'Личаківський район', group: '2.1', lat: 49.8250, lon: 24.0750, buildings: '1-180' },
  { id: '82', name: 'вул. Погулянка', district: 'Личаківський район', group: '2.1', lat: 49.8290, lon: 24.0580, buildings: '1-45' },
  { id: '83', name: 'вул. Джорджа Вашингтона', district: 'Личаківський район', group: '5.2', lat: 49.8180, lon: 24.0720, buildings: '1-25' },
  { id: '84', name: 'вул. Тракт Глинянський', district: 'Личаківський район', group: '4.2', lat: 49.8450, lon: 24.0800, buildings: '1-165' },

  // Приміські райони (Винники, Брюховичі, Рудне тощо)
  { id: '90', name: 'вул. Галицька (Винники)', district: 'Винники', group: '4.2', lat: 49.8150, lon: 24.1350, buildings: '1-110' },
  { id: '91', name: 'вул. Сухомлинського В. (Винники)', district: 'Винники', group: '4.2', lat: 49.8180, lon: 24.1290, buildings: '1-45' },
  { id: '100', name: 'вул. Курортна (Брюховичі)', district: 'Брюховичі', group: '2.2', lat: 49.9020, lon: 23.9530, buildings: '1-30' },
  { id: '101', name: 'вул. Львівська (Брюховичі)', district: 'Брюховичі', group: '2.2', lat: 49.9080, lon: 23.9480, buildings: '1-85' },
  { id: '110', name: 'вул. Огієнка (Рудне)', district: 'Рудне', group: '1.1', lat: 49.8400, lon: 23.8850, buildings: '1-45' },
  { id: '120', name: 'вул. Стрийська (Сокільники)', district: 'Сокільники', group: '3.1', lat: 49.7780, lon: 24.0150, buildings: '1-80' },
  { id: '121', name: 'вул. Садова (Сокільники)', district: 'Сокільники', group: '3.1', lat: 49.7820, lon: 23.9850, buildings: '1-40' },
  { id: '130', name: 'вул. Городоцька (Зимна Вода)', district: 'Зимна Вода', group: '6.1', lat: 49.8280, lon: 23.8950, buildings: '1-120' },
  { id: '131', name: 'вул. Тичини (Зимна Вода)', district: 'Зимна Вода', group: '1.1', lat: 49.8220, lon: 23.8850, buildings: '1-50' },
  { id: '140', name: 'вул. Лісна (Зубра)', district: 'Зубра', group: '3.1', lat: 49.7750, lon: 24.0480, buildings: '1-45' },
  { id: '150', name: 'вул. Шевченка (Дубляни)', district: 'Дубляни', group: '2.2', lat: 49.8980, lon: 24.0880, buildings: '1-75' },
  { id: '160', name: 'вул. Київська (Малехів)', district: 'Малехів', group: '2.2', lat: 49.8780, lon: 24.0680, buildings: '1-65' },
  { id: '170', name: 'вул. Незалежності (Рясне-Руське)', district: 'Рясне-Руське', group: '4.1', lat: 49.8650, lon: 23.9150, buildings: '1-55' },

  // Нове приміське кільце (Солонка, Давидів, Пустомити, Лапаївка тощо)
  { id: '180', name: 'вул. Стрийська (Солонка)', district: 'Солонка', group: '3.1', lat: 49.7420, lon: 24.0180, buildings: '1-90' },
  { id: '181', name: 'вул. Центральна (Солонка)', district: 'Солонка', group: '5.1', lat: 49.7450, lon: 24.0250, buildings: '1-60' },
  { id: '190', name: 'вул. Дорожна (Пасіки-Зубрицькі)', district: 'Пасіки-Зубрицькі', group: '3.1', lat: 49.7780, lon: 24.0820, buildings: '1-55' },
  { id: '191', name: 'вул. Лесі Українки (Пасіки-Зубрицькі)', district: 'Пасіки-Зубрицькі', group: '1.2', lat: 49.7810, lon: 24.0780, buildings: '1-40' },
  { id: '200', name: 'вул. Галицька (Давидів)', district: 'Давидів', group: '1.2', lat: 49.7480, lon: 24.1350, buildings: '1-120' },
  { id: '201', name: 'вул. Незалежності (Давидів)', district: 'Давидів', group: '4.2', lat: 49.7520, lon: 24.1400, buildings: '1-45' },
  { id: '210', name: 'вул. Геофізиків (Лапаївка)', district: 'Лапаївка', group: '1.1', lat: 49.8160, lon: 23.8920, buildings: '1-65' },
  { id: '211', name: 'вул. Залізнична (Лапаївка)', district: 'Лапаївка', group: '6.1', lat: 49.8140, lon: 23.8980, buildings: '1-40' },
  { id: '220', name: 'вул. Стуса (Холодновідка)', district: 'Холодновідка', group: '1.1', lat: 49.8100, lon: 23.9050, buildings: '1-50' },
  { id: '221', name: 'вул. Тіниста (Холодновідка)', district: 'Холодновідка', group: '6.1', lat: 49.8080, lon: 23.9120, buildings: '1-35' },
  { id: '230', name: 'вул. Залізнична (Суховоля)', district: 'Суховоля', group: '1.1', lat: 49.8520, lon: 23.8450, buildings: '1-80' },
  { id: '240', name: 'вул. Шевченка (Бірки)', district: 'Бірки', group: '4.1', lat: 49.9150, lon: 23.9180, buildings: '1-75' },
  { id: '250', name: 'вул. Шевченка (Лисиничі)', district: 'Лисиничі', group: '4.2', lat: 49.8350, lon: 24.1020, buildings: '1-90' },
  { id: '260', name: 'вул. Спортивна (Підбірці)', district: 'Підбірці', group: '4.2', lat: 49.8450, lon: 24.1350, buildings: '1-65' },
  { id: '270', name: 'вул. Вокзальна (Муроване)', district: 'Муроване', group: '2.2', lat: 49.8750, lon: 24.0950, buildings: '1-70' },
  { id: '280', name: 'вул. Львівська (Великі Грибовичі)', district: 'Великі Грибовичі', group: '2.2', lat: 49.9120, lon: 24.0450, buildings: '1-85' },
  { id: '290', name: 'вул. Грушевського (Пустомити)', district: 'Пустомити', group: '3.1', lat: 49.7150, lon: 23.9050, buildings: '1-140' },
  { id: '291', name: 'вул. Глинська (Пустомити)', district: 'Пустомити', group: '5.1', lat: 49.7180, lon: 23.9120, buildings: '1-70' }
];

fs.writeFileSync(
  path.join(__dirname, '../src/data/streets.json'),
  JSON.stringify(streets, null, 2),
  'utf8'
);

console.log(`Generated ${streets.length} indexed streets with accurate districts and groups.`);
