// Service for resolving and caching street polylines (OpenStreetMap geometry)
import preseededGeometries from '../data/preseededGeometries.json';

const memoryCache = new Map<string, [number, number][][]>();

// Initialize memory cache with preseeded geometries
try {
  const pre = preseededGeometries as unknown as Record<string, [number, number][][]>;
  Object.entries(pre).forEach(([key, val]) => {
    if (Array.isArray(val) && val.length > 0) {
      memoryCache.set(key, val);
    }
  });
} catch (e) {
  console.warn('Failed to parse preseeded geometries:', e);
}

const getCacheKey = (id: string, name: string, locality?: string) => {
  return `${id || ''}_${name}_${locality || ''}`;
};

const parseGeoJsonToLines = (geo: any): [number, number][][] => {
  if (!geo) return [];
  const gtype = geo.type;
  const coords = geo.coordinates;
  const lines: [number, number][][] = [];

  if (gtype === 'LineString' && Array.isArray(coords)) {
    lines.push(coords.map((c: [number, number]) => [c[1], c[0]]));
  } else if (gtype === 'MultiLineString' && Array.isArray(coords)) {
    coords.forEach((part: any) => {
      if (Array.isArray(part)) {
        lines.push(part.map((c: [number, number]) => [c[1], c[0]]));
      }
    });
  } else if (gtype === 'Polygon' && Array.isArray(coords) && coords[0]) {
    lines.push(coords[0].map((c: [number, number]) => [c[1], c[0]]));
  } else if (gtype === 'MultiPolygon' && Array.isArray(coords)) {
    coords.forEach((poly: any) => {
      if (Array.isArray(poly) && poly[0]) {
        lines.push(poly[0].map((c: [number, number]) => [c[1], c[0]]));
      }
    });
  }

  return lines;
};

export async function fetchStreetGeometry(street: {
  id?: string;
  name: string;
  cityName?: string;
  districtName?: string;
  center?: [number, number];
  polyline?: [number, number][][];
}): Promise<[number, number][][] | null> {
  if (street.polyline && street.polyline.length > 0) {
    return street.polyline;
  }

  const id = street.id || '';
  const locality = street.cityName || street.districtName || 'Львів';
  const key = getCacheKey(id, street.name, locality);

  // 1. Check ID in memory cache (or preseeded)
  if (id && memoryCache.has(id)) {
    return memoryCache.get(id)!;
  }

  // 2. Check compound key in memory cache
  if (memoryCache.has(key)) {
    return memoryCache.get(key)!;
  }

  // 3. Check sessionStorage
  try {
    const sessionItem = sessionStorage.getItem(`st_geo_${key}`);
    if (sessionItem) {
      const parsed = JSON.parse(sessionItem);
      if (Array.isArray(parsed) && parsed.length > 0) {
        memoryCache.set(key, parsed);
        if (id) memoryCache.set(id, parsed);
        return parsed;
      }
    }
  } catch {}

  // 4. Fetch dynamically from Nominatim OpenStreetMap
  try {
    const cleanName = street.name
      .replace(/^(вул\.|просп\.|пл\.|вулиця|проспект|площа)\s*/i, '')
      .replace(/["'«»]/g, '')
      .trim();

    if (!cleanName) return null;

    const query = `${cleanName}, ${locality}, Україна`;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      query
    )}&format=json&polygon_geojson=1&limit=4`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    clearTimeout(timeout);

    if (!response.ok) return null;
    const items = await response.json();
    if (!Array.isArray(items) || items.length === 0) return null;

    const collectedLines: [number, number][][] = [];

    for (const item of items) {
      const lines = parseGeoJsonToLines(item.geojson);
      for (const line of lines) {
        if (line.length >= 2) {
          // Verify point proximity to street.center if available (within ~6 km)
          if (street.center) {
            const [cLat, cLon] = street.center;
            const mid = line[Math.floor(line.length / 2)];
            const dLat = mid[0] - cLat;
            const dLon = mid[1] - cLon;
            const distSq = dLat * dLat + dLon * dLon;
            if (distSq > 0.0036) {
              // > ~6.5 km away, likely a different town
              continue;
            }
          }
          collectedLines.push(line);
        }
      }
    }

    if (collectedLines.length > 0) {
      memoryCache.set(key, collectedLines);
      if (id) memoryCache.set(id, collectedLines);
      try {
        sessionStorage.setItem(`st_geo_${key}`, JSON.stringify(collectedLines));
      } catch {}
      return collectedLines;
    }
  } catch (err) {
    // Network or abort error, fail silently to fallback pin marker
  }

  return null;
}
