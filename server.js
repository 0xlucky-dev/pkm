const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 4000;

const DATA_DIR = path.join(__dirname, 'data');

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

  res.json({ natures, balls, versionCodes });
});

// --- Catch-all 404 for unmatched API routes ---
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// --- Version-specific app routes ---
// These serve the SPA shell; the frontend reads the version from the URL path.
app.get('/gen9', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/gen9a', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Default route → gen9a (Legends Z-A)
app.get('/', (req, res) => {
  res.redirect('/gen9a');
});

// --- Static file serving ---
app.use(express.static(path.join(__dirname, 'public')));

// --- Start server ---
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Pokemon Generator server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
