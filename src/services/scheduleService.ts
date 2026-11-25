import fallbackSchedule from '../data/fallback_schedule.json';
import { ScheduleData, GroupSchedule, PowerStatus } from '../types';

function timeToFloat(str: string): number {
  const [h, m] = str.split(':').map(Number);
  return h + (m || 0) / 60;
}

export async function fetchSchedule(): Promise<ScheduleData> {
  try {
    const res = await fetch('/api/loe/menus?page=1&type=photo-grafic', {
      headers: { Accept: 'application/ld+json, application/json' },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    const members = data['hydra:member'] || [];
    if (!members.length) throw new Error('No menu data');

    const todayItem = members[0]?.menuItems?.find(
      (m: { name?: string }) => m.name?.toLowerCase() === 'today'
    ) || members[0]?.menuItems?.[0];

    const rawHtml: string = todayItem?.rawHtml || todayItem?.rawMobileHtml || '';
    if (!rawHtml) throw new Error('No rawHtml');

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
      if (line.includes('станом на')) {
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

    if (Object.keys(groups).length > 0) {
      return {
        date: dateStr,
        title,
        updatedAt: updatedAt || 'Сьогодні',
        groups,
        isLive: true,
      };
    }
    throw new Error('Parsed 0 groups');
  } catch (err) {
    console.warn('Using fallback schedule data:', err);
    return {
      ...(fallbackSchedule as ScheduleData),
      isLive: false,
    };
  }
}
