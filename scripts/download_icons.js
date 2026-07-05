/**
 * Download icon assets to public/icons/
 * Downloads ball icons from serebii.net and alpha icon from poke.zeldaxiaoma.com
 */
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ICONS_DIR = path.join(__dirname, '..', 'public', 'icons');

const BALL_NAMES = [
  'masterball', 'ultraball', 'greatball', 'pokeball', 'safariball',
  'netball', 'diveball', 'nestball', 'repeatball', 'timerball',
  'luxuryball', 'premierball', 'duskball', 'healball', 'quickball',
  'cherishball', 'fastball', 'levelball', 'lureball', 'heavyball',
  'loveball', 'friendball', 'moonball', 'sportball', 'dreamball',
  'beastball'
];

const DOWNLOADS = [
  // Ball icons from serebii
  ...BALL_NAMES.map(name => ({
    url: `https://serebii.net/itemdex/sprites/${name}.png`,
    filename: `${name}.png`
  })),
  // Alpha icon
  {
    url: 'https://poke.zeldaxiaoma.com/pokemon/icon/alpha-icon.png',
    filename: 'alpha-icon.png'
  }
];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const request = protocol.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }, (response) => {
      // Handle redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        download(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode} for ${url}`));
        return;
      }

      const file = fs.createWriteStream(dest);
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
      file.on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    });

    request.on('error', reject);
    request.setTimeout(15000, () => {
      request.destroy();
      reject(new Error(`Timeout downloading ${url}`));
    });
  });
}

async function main() {
  // Create icons directory
  if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
    console.log(`Created directory: ${ICONS_DIR}`);
  }

  let success = 0;
  let failed = 0;

  for (const { url, filename } of DOWNLOADS) {
    const dest = path.join(ICONS_DIR, filename);
    try {
      await download(url, dest);
      const stats = fs.statSync(dest);
      console.log(`✓ ${filename} (${stats.size} bytes)`);
      success++;
    } catch (err) {
      console.error(`✗ ${filename}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone: ${success} downloaded, ${failed} failed`);
}

main();
