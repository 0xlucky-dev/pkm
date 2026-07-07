/**
 * Build a minimal move -> type mapping from Pokémon Showdown's moves.json.
 * Output: data/shared/move-types.json  { "Absorb": "Grass", ... }
 *
 * Run: node scripts/build-move-types.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const SHOWDOWN_URL = 'https://play.pokemonshowdown.com/data/moves.json';
const OUT_PATH = path.join(__dirname, '..', 'data', 'shared', 'move-types.json');

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  console.log('Fetching moves from Showdown...');
  const raw = await fetch(SHOWDOWN_URL);
  const moves = JSON.parse(raw);

  const mapping = {};
  for (const [, move] of Object.entries(moves)) {
    if (move.name && move.type) {
      mapping[move.name] = move.type;
    }
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(mapping, null, 0), 'utf-8');
  console.log(`Done — ${Object.keys(mapping).length} moves written to ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
