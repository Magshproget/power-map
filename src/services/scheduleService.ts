import fallbackSchedule from '../data/fallback_schedule.json';
import { ScheduleData, GroupSchedule, PowerStatus } from '../types';

function timeToFloat(str: string): number {
  const [h, m] = str.split(':').map(Number);
  return h + (m || 0) / 60;
}

function parseHtmlToSchedule(rawHtml: string): {
  groups: Record<string, GroupSchedule>;
  dateStr: string;
  title: string;
  updatedAt: string;
} | null {
  if (!rawHtml) return null;
  const lines = rawHtml
    .replace(/<[^>]+>/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const groups: Record<string, GroupSchedule> = {};
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
      const hourly: PowerStatus[] = new Array(24).fill('on');
      const intervals: { start: string; end: string; s: number; e: number }[] = [];

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
  return { groups, dateStr, title, updatedAt };
}

export async function fetchSchedule(): Promise<ScheduleData> {
  const basePath = (import.meta as any).env?.BASE_URL || '/';
  const cleanBase = basePath.endsWith('/') ? basePath : `${basePath}/`;

  // 1. Static JSON endpoints (auto-updated by GitHub Actions cron every 30 min)
  try {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const todayDateStr = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}`;

    const todayRes = await fetch(`${cleanBase}data/schedule.json?t=${Date.now()}`);
    if (todayRes.ok) {
      const data = await todayRes.json();
      if (data && data.groups && Object.keys(data.groups).length > 0) {
        // If today's date matches, return it
        if (data.date === todayDateStr) {
          return { ...data, isLive: true };
        }

        // If today's calendar date is advanced (e.g. past midnight), check if tomorrow's file has it
        try {
          const tomRes = await fetch(`${cleanBase}data/schedule_tomorrow.json?t=${Date.now()}`);
          if (tomRes.ok) {
            const tomData = await tomRes.json();
            if (tomData && tomData.date === todayDateStr && tomData.groups) {
              return { ...tomData, isLive: true };
            }
          }
        } catch {}

        return { ...data, isLive: true };
      }
    }
  } catch (err) {
    console.warn('Could not fetch data/schedule.json:', err);
  }

  // 2. Direct Lvivoblenergo API proxy (works in local development)
  try {
    const res = await fetch('/api/loe/menus?page=1&type=photo-grafic', {
      headers: { Accept: 'application/ld+json, application/json' },
    });

    if (res.ok) {
      const data = await res.json();
      const members = Array.isArray(data) ? data : data['hydra:member'] || [];
      const menuItems = members[0]?.menuItems || [];
      const todayItem = menuItems.find(
        (m: { name?: string }) => m.name?.toLowerCase() === 'today'
      ) || menuItems[0];

      const rawHtml: string = todayItem?.rawHtml || todayItem?.rawMobileHtml || '';
      const parsed = parseHtmlToSchedule(rawHtml);
      if (parsed) {
        return {
          date: parsed.dateStr,
          title: parsed.title,
          updatedAt: parsed.updatedAt || 'Сьогодні',
          groups: parsed.groups,
          isLive: true,
        };
      }
    }
  } catch (err) {
    // Expected on GitHub Pages due to browser CORS restriction
  }

  // 3. Bundled fallback data
  return {
    ...(fallbackSchedule as ScheduleData),
    isLive: false,
  };
}
