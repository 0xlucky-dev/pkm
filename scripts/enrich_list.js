/**
 * enrich_list.js — enriches each version's pokemon-list.json with real sprite paths.
 *
 * For each version, reads data/{version}/pokemon-list.json, then for each entry
 * reads data/{version}/pokemon/{sp_number}.json and pulls forms[0].spriteNormal
 * and forms[0].spriteShiny, adding them as `sprite` and `spriteShiny` fields.
 *
 * Usage: node scripts/enrich_list.js
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const VERSIONS = ['gen9', 'gen9a'];

function enrichVersion(version) {
  const listPath = path.join(DATA_DIR, version, 'pokemon-list.json');

  if (!fs.existsSync(listPath)) {
    console.warn(`[${version}] pokemon-list.json not found, skipping.`);
    return;
  }

  const list = JSON.parse(fs.readFileSync(listPath, 'utf-8'));
  let enriched = 0;
  let missing = 0;

  for (const entry of list) {
    const detailPath = path.join(DATA_DIR, version, 'pokemon', `${entry.sp_number}.json`);

    if (!fs.existsSync(detailPath)) {
      missing++;
      continue;
    }

    try {
      const detail = JSON.parse(fs.readFileSync(detailPath, 'utf-8'));
      const form = detail.forms && detail.forms[0];
      if (form) {
        entry.sprite = form.spriteNormal || '';
        entry.spriteShiny = form.spriteShiny || '';
        enriched++;
      }
    } catch (err) {
      console.warn(`[${version}] Failed to read ${detailPath}: ${err.message}`);
      missing++;
    }
  }

  fs.writeFileSync(listPath, JSON.stringify(list, null, 2), 'utf-8');
  console.log(`[${version}] Enriched ${enriched} entries (${missing} missing/failed). Wrote ${listPath}`);
}

for (const version of VERSIONS) {
  enrichVersion(version);
}
