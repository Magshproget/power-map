// Incremental LOE streets crawler with checkpointing, rate-limiting and backoff
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const CACHE_FILE = path.join(rootDir, 'src/data/loe_verified_cache.json');
const STREETS_FILE = path.join(rootDir, 'src/data/streets.json');

// Load existing cache or initialize
let cache = {};
if (fs.existsSync(CACHE_FILE)) {
  try {
    cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    console.log(`[Cache] Loaded ${Object.keys(cache).length} cached street records.`);
  } catch (e) {
    cache = {};
  }
}

// Load streets
const streets = JSON.parse(fs.readFileSync(STREETS_FILE, 'utf8'));

// Save checkpoints safely
function saveState() {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
  fs.writeFileSync(STREETS_FILE, JSON.stringify(streets, null, 2), 'utf8');
}

process.on('SIGINT', () => {
  console.log('\n[Crawler] Interrupted. Saving state...');
  saveState();
  process.exit(0);
});

async function fetchStreetGroup(cityId, streetId) {
  const url = `https://power-api.loe.lviv.ua/api/pw_accounts?itemsPerPage=25&city.id=${cityId}&street.id=${streetId}`;

  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)',
          'Accept': 'application/ld+json'
        }
      });

      if (res.status === 200) {
        const data = await res.json();
        const members = data['hydra:member'] || [];
        if (members.length === 0) return { empty: true };

        const groupCounts = {};
        for (const m of members) {
          const g = m.chergGpv;
          if (g && g !== 'Не входить' && g !== 'Інший ОСР') {
            groupCounts[g] = (groupCounts[g] || 0) + 1;
          }
        }

        const sorted = Object.entries(groupCounts).sort((a, b) => b[1] - a[1]);
        if (sorted.length === 0) return { empty: true };

        return {
          primaryGroup: sorted[0][0],
          counts: groupCounts,
          totalAccounts: members.length
        };
      }

      if (res.status === 429) {
        const waitMs = attempt * 5000;
        console.log(`[Rate Limit 429] Street ${streetId}, attempt ${attempt}/5: waiting ${waitMs / 1000}s...`);
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }

      console.warn(`[HTTP ${res.status}] Street ${streetId}`);
      return null;
    } catch (err) {
      console.warn(`[Error] Street ${streetId} attempt ${attempt}:`, err.message);
      await new Promise(r => setTimeout(r, 4000));
    }
  }

  return null;
}

async function run() {
  console.log(`Starting crawler for ${streets.length} total streets...`);

  // Prioritize Lviv city streets first, then other settlements
  const indices = streets.map((_, i) => i);
  indices.sort((a, b) => {
    const isLvivA = !streets[a].cityName || streets[a].cityName === 'Львів' ? 0 : 1;
    const isLvivB = !streets[b].cityName || streets[b].cityName === 'Львів' ? 0 : 1;
    return isLvivA - isLvivB;
  });

  let processedInRun = 0;
  let updatedInRun = 0;
  let skippedCached = 0;

  for (let idx = 0; idx < indices.length; idx++) {
    const i = indices[idx];
    const st = streets[i];
    const cityId = st.cityId || 693;
    const key = `${cityId}_${st.id}`;

    // Skip if already in cache
    if (cache[key]) {
      skippedCached++;
      // Sync group if cache has primaryGroup
      if (cache[key].primaryGroup && st.group !== cache[key].primaryGroup) {
        st.group = cache[key].primaryGroup;
      }
      continue;
    }

    const result = await fetchStreetGroup(cityId, st.id);
    if (result && result.primaryGroup) {
      cache[key] = {
        name: st.name,
        primaryGroup: result.primaryGroup,
        counts: result.counts,
        total: result.totalAccounts,
        updatedAt: new Date().toISOString()
      };
      updatedInRun++;

      if (st.group !== result.primaryGroup) {
        console.log(`[Corrected] [${idx + 1}/${streets.length}] ${st.name} (${st.cityName || 'Львів'}): ${st.group} -> ${result.primaryGroup}`);
        st.group = result.primaryGroup;
      } else {
        console.log(`[Verified] [${idx + 1}/${streets.length}] ${st.name} (${st.cityName || 'Львів'}): ${result.primaryGroup}`);
      }
    } else {
      cache[key] = {
        name: st.name,
        primaryGroup: null,
        empty: true,
        updatedAt: new Date().toISOString()
      };
      console.log(`[Empty/Unmapped] [${idx + 1}/${streets.length}] ${st.name} (${st.cityName || 'Львів'})`);
    }

    processedInRun++;

    // Save checkpoint every 5 streets
    if (processedInRun % 5 === 0 || idx === indices.length - 1) {
      saveState();
      console.log(`[Checkpoint] Processed: ${processedInRun}, Updated: ${updatedInRun}, Total cached: ${Object.keys(cache).length}/${streets.length}`);
    }

    // Polite delay 3.8s to smoothly fit Cloudflare token bucket
    await new Promise(r => setTimeout(r, 3800));
  }

  saveState();
  console.log(`[Done] Crawler finished! Total cached: ${Object.keys(cache).length}, Updated in run: ${updatedInRun}`);
}

run().catch(console.error);
