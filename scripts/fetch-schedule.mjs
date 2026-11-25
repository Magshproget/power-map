// Node.js script to fetch and parse the latest schedule from Lvivoblenergo API
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function timeToFloat(str) {
  const [h, m] = str.split(':').map(Number);
  return h + (m || 0) / 60;
}

function parseItem(item) {
  if (!item) return null;
  const rawHtml = item.rawHtml || item.rawMobileHtml || '';
  if (!rawHtml) return null;

  const lines = rawHtml
    .replace(/<[^>]+>/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const groups = {};
  let dateStr = new Date().toISOString().slice(0, 10);
  let title = 'Графік погодинних відключень';
  let updatedAt = '';

  for (const line of lines) {
    if (line.includes('Графік погодинних відключень на')) {
      title = line;
      const dMatch = line.match(/\d{2}\.\d{2}\.\d{4}/);
      if (dMatch) dateStr = dMatch[0];
    }
    if (line.includes('станом на') || line.includes('Інформація станом на')) {
      const uMatch = line.match(/\d{2}:\d{2}/);
      if (uMatch) updatedAt = uMatch[0];
    }

    const match = line.match(/Група\s+([1-6]\.[1-2])\.?\s*(.*)/i);
    if (match) {
      const group = match[1];
      const desc = match[2];
      const hourly = new Array(24).fill('on');
      const intervals = [];

      if (desc.includes('немає') || desc.includes('вимкнен')) {
        const timeMatches = [
          ...desc.matchAll(/з\s+([0-2]?[0-9]:[0-5][0-9])\s+до\s+([0-2]?[0-9]:[0-5][0-9])/g),
        ];
        for (const tm of timeMatches) {
          const start = tm[1];
          const end = tm[2];
          const s = timeToFloat(start);
          const e = timeToFloat(end);
          intervals.push({ start, end, s, e });
          for (let h = 0; h < 24; h++) {
            if (h >= Math.floor(s) && h < Math.ceil(e)) {
              hourly[h] = 'off';
            }
          }
        }
      }

      groups[group] = { desc, intervals, hourly };
    }
  }

  if (Object.keys(groups).length === 0) return null;

  return {
    date: dateStr,
    title,
    updatedAt: updatedAt || 'Сьогодні',
    groups,
    isLive: true,
    fetchedAt: new Date().toISOString(),
  };
}

async function main() {
  console.log('Fetching schedule from Lvivoblenergo API...');
  const url = 'https://api.loe.lviv.ua/api/menus?page=1&type=photo-grafic';

  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/ld+json, application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; PowerMapLviv/1.0)',
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    const members = Array.isArray(data) ? data : data['hydra:member'] || [];
    if (!members.length) throw new Error('No menu data');

    const menuItems = members[0]?.menuItems || [];
    const todayItem = menuItems.find((m) => m.name?.toLowerCase() === 'today') || menuItems[0];
    const tomorrowItem = menuItems.find((m) => m.name?.toLowerCase() === 'tomorrow');

    const todayParsed = parseItem(todayItem);
    const tomorrowParsed = parseItem(tomorrowItem);

    if (!todayParsed) {
      throw new Error('Failed to parse Today item from API');
    }

    // Target files
    const publicDataDir = path.join(rootDir, 'public', 'data');
    fs.mkdirSync(publicDataDir, { recursive: true });

    const schedulePath = path.join(publicDataDir, 'schedule.json');
    fs.writeFileSync(schedulePath, JSON.stringify(todayParsed, null, 2), 'utf-8');
    console.log(`Saved today schedule to ${schedulePath} (${todayParsed.title}, ${todayParsed.updatedAt})`);

    if (tomorrowParsed) {
      const tomorrowPath = path.join(publicDataDir, 'schedule_tomorrow.json');
      fs.writeFileSync(tomorrowPath, JSON.stringify(tomorrowParsed, null, 2), 'utf-8');
      console.log(`Saved tomorrow schedule to ${tomorrowPath} (${tomorrowParsed.title}, ${tomorrowParsed.updatedAt})`);
    }

    // Also update src/data/fallback_schedule.json
    const fallbackPath = path.join(rootDir, 'src', 'data', 'fallback_schedule.json');
    fs.writeFileSync(fallbackPath, JSON.stringify(todayParsed, null, 2), 'utf-8');
    console.log(`Updated fallback schedule at ${fallbackPath}`);

    console.log('Successfully fetched and updated schedule!');
  } catch (err) {
    console.warn('Warning: Could not fetch schedule from Lvivoblenergo API:', err.message);
    // Do not crash the build if API is temporarily unavailable
  }
}

main();
