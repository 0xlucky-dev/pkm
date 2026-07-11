require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 4000;
const DISCORD_INVITE_URL = process.env.DISCORD_INVITE_URL || 'https://discord.gg/R6nEKxkx5j';

const DATA_DIR = path.join(__dirname, 'data');

// --- Middleware (MUST be before all routes) ---
app.use(express.json());

// --- Helper ---
function readJSON(filePath, res) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.status(404).json({ error: 'Pokemon not found for this version' });
    } else {
      res.status(500).json({ error: 'Data unavailable' });
    }
    return null;
  }
}

// --- API Endpoints ---

// GET /api/versions — returns supported versions
app.get('/api/versions', (req, res) => {
  const data = readJSON(path.join(DATA_DIR, 'versions.json'), res);
  if (data !== null) res.json(data);
});

// GET /api/pokemon/:version — returns pokemon list for a version
app.get('/api/pokemon/:version', (req, res) => {
  const { version } = req.params;
  const filePath = path.join(DATA_DIR, version, 'pokemon-list.json');
  const data = readJSON(filePath, res);
  if (data !== null) res.json(data);
});

// GET /api/pokemon/:version/:id — returns pokemon detail
app.get('/api/pokemon/:version/:id', (req, res) => {
  const { version, id } = req.params;
  const filePath = path.join(DATA_DIR, version, 'pokemon', `${id}.json`);
  const data = readJSON(filePath, res);
  if (data !== null) res.json(data);
});

// GET /api/options/:version — returns natures, balls, and versionCodes
app.get('/api/options/:version', (req, res) => {
  const { version } = req.params;

  const natures = readJSON(path.join(DATA_DIR, 'shared', 'natures.json'), res);
  if (natures === null) return;

  const balls = readJSON(path.join(DATA_DIR, version, 'balls.json'), res);
  if (balls === null) return;

  const versionCodes = readJSON(path.join(DATA_DIR, 'shared', 'versionCodes.json'), res);
  if (versionCodes === null) return;

  const moveTypes = readJSON(path.join(DATA_DIR, 'shared', 'move-types.json'), res);
  if (moveTypes === null) return;

  res.json({ natures, balls, versionCodes, moveTypes });
});

// --- Proxy: POST /api/submit-order → pokemon.zeldaxiaoma.com/save_order.php ---
// Routes through the backend so the browser is never the direct caller
// (avoids CORS issues since save_order.php only whitelists same-origin requests).
app.post('/api/submit-order', async (req, res) => {
  const { command, version } = req.body || {};
  if (!command || typeof command !== 'string') {
    return res.status(400).json({ error: 'command field required' });
  }
  // Referer must match the version the command was built for (gen9/gen9a/
  // gen8/gen8a) so the upstream bot's per-version parser accepts it.
  const refererVersion = ['gen9', 'gen9a', 'gen8', 'gen8a'].includes(version) ? version : 'gen9';
  try {
    const https = require('https');
    const payload = JSON.stringify({ command, mode: 'home' });
    const options = {
      hostname: 'pokemon.zeldaxiaoma.com',
      path: '/pokemon/api/save_order.php',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'Referer': `https://pokemon.zeldaxiaoma.com/pokemon/?lang=en-US&version=${refererVersion}`,
        'Accept': '*/*',
      },
    };
    const upstream = https.request(options, (upstream_res) => {
      let data = '';
      upstream_res.on('data', (chunk) => (data += chunk));
      upstream_res.on('end', () => {
        try {
          res.json(JSON.parse(data));
        } catch {
          res.status(502).json({ error: 'Bad response from upstream', raw: data });
        }
      });
    });
    upstream.on('error', (err) => res.status(502).json({ error: err.message }));
    upstream.write(payload);
    upstream.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Catch-all 404 for unmatched API routes ---
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Serve index.html with {{DISCORD_INVITE_URL}} replaced by the env value,
// so the Discord invite link can be changed via .env without editing HTML.
function sendIndexWithEnv(res) {
  const filePath = path.join(__dirname, 'public', 'index.html');
  fs.readFile(filePath, 'utf-8', (err, html) => {
    if (err) return res.status(500).send('Failed to load page');
    const rendered = html.replace(/\{\{DISCORD_INVITE_URL\}\}/g, DISCORD_INVITE_URL);
    res.set('Content-Type', 'text/html');
    res.send(rendered);
  });
}

// --- Version-specific app routes ---
// /sv   -> Scarlet/Violet  (gen9)
// /za   -> Legends: Z-A    (gen9a)
// /swsh -> Sword/Shield     (gen8)
// /la   -> Legends Arceus  (gen8a)
app.get('/sv',   (req, res) => sendIndexWithEnv(res));
app.get('/za',   (req, res) => sendIndexWithEnv(res));
app.get('/swsh', (req, res) => sendIndexWithEnv(res));
app.get('/la',   (req, res) => sendIndexWithEnv(res));

// Legacy redirects
app.get('/gen9',  (req, res) => res.redirect(301, '/sv'));
app.get('/gen9a', (req, res) => res.redirect(301, '/za'));
app.get('/gen8',  (req, res) => res.redirect(301, '/swsh'));
app.get('/gen8a', (req, res) => res.redirect(301, '/la'));

// Default route → za (Legends Z-A)
app.get('/', (req, res) => {
  res.redirect('/za');
});

// Guard against directly requesting the raw index.html (which still
// contains the unreplaced {{DISCORD_INVITE_URL}} placeholder) — redirect
// to the versioned route instead so it goes through sendIndexWithEnv.
app.get('/index.html', (req, res) => res.redirect(301, '/za'));

// --- Static file serving (no cache for JS/CSS during dev) ---
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

// --- Start server ---
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Pokemon Generator server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
