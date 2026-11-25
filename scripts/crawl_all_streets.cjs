const fs = require('fs');
const path = require('path');

const streets = JSON.parse(fs.readFileSync('/tmp/lviv_streets.json', 'utf8'));
const outputPath = path.join(__dirname, '../src/data/loe_streets_parsed.json');

async function fetchWithRetry(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (i === retries) throw err;
      await new Promise(r => setTimeout(r, 500));
    }
  }
}

async function run() {
  console.log(`Starting crawl of ${streets.length} streets from LOE API...`);
  const results = [];
  const concurrency = 25;

  for (let i = 0; i < streets.length; i += concurrency) {
    const batch = streets.slice(i, i + concurrency);
    const batchPromises = batch.map(async (st) => {
      try {
        const url = `https://power-api.loe.lviv.ua/api/pw_accounts?pagination=false&city.id=693&street.id=${st.id}`;
        const data = await fetchWithRetry(url);
        const members = data['hydra:member'] || [];
        const groupCounts = {};
        for (const m of members) {
          const g = m.chergGpv;
          if (g && g !== 'Не входить' && g !== 'Інший ОСР') {
            groupCounts[g] = (groupCounts[g] || 0) + 1;
          }
        }
        const sortedGroups = Object.keys(groupCounts).sort((a, b) => groupCounts[b] - groupCounts[a]);
        return {
          id: st.id,
          name: st.name,
          groups: sortedGroups,
          primaryGroup: sortedGroups[0] || '1.1',
          buildingCount: members.length
        };
      } catch (err) {
        return {
          id: st.id,
          name: st.name,
          groups: ['1.1'],
          primaryGroup: '1.1',
          buildingCount: 0
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    if (results.length % 200 === 0 || results.length === streets.length) {
      console.log(`Progress: ${results.length} / ${streets.length} streets processed.`);
    }
  }

  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`Finished! Saved ${results.length} streets to ${outputPath}`);
}

run().catch(console.error);
