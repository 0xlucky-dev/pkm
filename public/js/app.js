/**
 * App Module — main application logic for the Pokemon Generator.
 * Handles state, API calls, event binding, and config generation.
 */

(function () {
  'use strict';

  // --- Version resolution from URL ---
  // Public URL paths use short game codes (/sv, /za, /swsh, /la) while the
  // internal version code (gen9, gen9a, gen8, gen8a) is used for API/data.
  const VALID_VERSIONS = ['gen9', 'gen9a', 'gen8', 'gen8a'];
  const VERSION_TO_PATH = { gen9: '/sv', gen9a: '/za', gen8: '/swsh', gen8a: '/la' };

  function versionFromPath() {
    const path = window.location.pathname.replace(/\/+$/, '');
    if (path === '/sv') return 'gen9';
    if (path === '/swsh') return 'gen8';
    if (path === '/la') return 'gen8a';
    return 'gen9a';
  }

  // --- State ---
  let currentVersion = versionFromPath();
  let pokemonList = [];
  let filteredList = [];
  let currentDetail = null; // full pokemon detail when overlay is open
  let currentFormIndex = 0; // selected form index for the open pokemon
  let options = null;       // { natures, balls, versionCodes }
  let batch = [];           // multi-trade batch (max 10)

  // --- DOM refs ---
  const versionSelect = document.getElementById('version-select');
  const versionLogo = document.getElementById('version-logo');
  const searchInput = document.getElementById('search-input');
  const searchInputMobile = document.getElementById('search-input-mobile');
  const gridEl = document.getElementById('pokemon-grid');
  const gridLoader = document.getElementById('grid-loader');
  const overlay = document.getElementById('config-overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlayBody = document.getElementById('overlay-body');
  const overlayClose = document.getElementById('overlay-close-bottom');
  const btnCopy = document.getElementById('btn-copy');
  const btnBatch = document.getElementById('btn-batch');
  const btnBatchCount = document.getElementById('btn-batch-count');
  const batchBadge = document.getElementById('batch-badge');
  const batchBadgeCount = document.getElementById('batch-badge-count');
  const batchModal = document.getElementById('batch-modal');
  const batchModalClose = document.getElementById('batch-modal-close');
  const btnBetaOrders = document.getElementById('btn-beta-orders');
  const batchList = document.getElementById('batch-list');
  const btnCopyAll = document.getElementById('btn-copy-all');
  const btnClearBatch = document.getElementById('btn-clear-batch');

  // --- API ---
  async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch ${url}`);
    return res.json();
  }

  async function loadPokemonList(version) {
    gridLoader.style.display = 'block';
    gridEl.innerHTML = '';
    try {
      pokemonList = await fetchJSON(`/api/pokemon/${version}`);
      filteredList = pokemonList;
      UI.renderGrid(filteredList, gridEl);
    } catch (err) {
      gridEl.innerHTML = `<p style="color:var(--danger);padding:20px;">Failed to load Pokémon list.</p>`;
    }
    gridLoader.style.display = 'none';
  }

  async function loadOptions(version) {
    try {
      options = await fetchJSON(`/api/options/${version}`);
    } catch (err) {
      options = { natures: [], balls: [], versionCodes: { Version_En: [], Version_Code: [] } };
    }
  }

  // --- Pokemon detail cache (version-keyed, avoids re-fetch on re-open) ---
  const detailCache = {};

  async function loadPokemonDetail(version, spNumber) {
    const key = `${version}/${spNumber}`;
    if (detailCache[key]) return detailCache[key];
    const data = await fetchJSON(`/api/pokemon/${version}/${spNumber}`);
    detailCache[key] = data;
    return data;
  }

  // --- Search / Filter ---
  function filterGrid() {
    const query = (searchInput.value || searchInputMobile.value).trim().toLowerCase();
    if (!query) {
      filteredList = pokemonList;
    } else {
      filteredList = pokemonList.filter((p) => {
        return p.name.toLowerCase().includes(query) ||
               String(p.dex).includes(query) ||
               String(p.dex).padStart(3, '0').includes(query);
      });
    }
    UI.renderGrid(filteredList, gridEl);
  }

  // --- Build move options once per version and cache ---
  // Avoids duplicating a 400+ option HTML string × 4 move selects in innerHTML.
  const moveOptionsCache = {};

  function buildMoveSelectNode(version) {
    if (moveOptionsCache[version]) return moveOptionsCache[version].cloneNode(true);

    const moveTypes = (options && options.moveTypes) || {};
    // Collect all moves from the current pokemon detail
    const allMoves = (currentDetail && currentDetail.forms &&
      currentDetail.forms[currentFormIndex] &&
      currentDetail.forms[currentFormIndex].moves) || [];

    const TYPE_ORDER = ['Normal','Fire','Water','Electric','Grass','Ice','Fighting','Poison','Ground','Flying','Psychic','Bug','Rock','Ghost','Dragon','Dark','Steel','Fairy','Unknown'];
    const movesByType = {};
    for (const m of allMoves) {
      const t = moveTypes[m] || 'Unknown';
      if (!movesByType[t]) movesByType[t] = [];
      movesByType[t].push(m);
    }
    const typesPresent = Object.keys(movesByType).sort((a, b) => {
      const idxA = TYPE_ORDER.indexOf(a), idxB = TYPE_ORDER.indexOf(b);
      return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
    });

    const sel = document.createElement('select');
    const none = document.createElement('option');
    none.value = ''; none.textContent = '-- None --';
    sel.appendChild(none);

    for (const t of typesPresent) {
      const grp = document.createElement('optgroup');
      grp.label = t; grp.dataset.type = t;
      for (const m of movesByType[t].sort((a, b) => a.localeCompare(b))) {
        const opt = document.createElement('option');
        opt.value = m; opt.textContent = m; opt.dataset.type = t;
        grp.appendChild(opt);
      }
      sel.appendChild(grp);
    }

    // Cache keyed by version+spNumber so different pokemon get their own options
    const cacheKey = `${version}/${currentDetail && currentDetail.id}/${currentFormIndex}`;
    moveOptionsCache[cacheKey] = sel;
    return sel.cloneNode(true);
  }

  function populateMoveSelects() {
    const cacheKey = `${currentVersion}/${currentDetail && currentDetail.id}/${currentFormIndex}`;
    // Build template once, then clone for each slot
    const template = moveOptionsCache[cacheKey] || (() => {
      const node = buildMoveSelectNode(currentVersion);
      moveOptionsCache[cacheKey] = node;
      return node;
    })();

    for (let i = 1; i <= 4; i++) {
      const placeholder = overlayBody.querySelector(`#cfg-move${i}`);
      if (!placeholder) continue;
      const clone = template.cloneNode(true);
      clone.id = `cfg-move${i}`;
      placeholder.parentNode.replaceChild(clone, placeholder);
    }
  }

  function renderOverlayBody() {
    overlayBody.innerHTML = UI.renderConfigBody(currentDetail, options, currentFormIndex, currentVersion);
    populateMoveSelects();
    CustomDropdown.initAll(overlayBody);
    attachConfigListeners();
  }

  // --- Config overlay ---
  async function openConfig(spNumber, dex, name) {
    overlayTitle.textContent = `#${String(dex).padStart(3, '0')} ${name}`;
    currentFormIndex = 0;

    const key = `${currentVersion}/${spNumber}`;
    const cached = detailCache[key];

    if (cached) {
      currentDetail = cached;
      renderOverlayBody();
      UI.openOverlay('config-overlay');
    } else {
      overlayBody.innerHTML = '<div class="grid-loader">Loading...</div>';
      UI.openOverlay('config-overlay');
      try {
        currentDetail = await loadPokemonDetail(currentVersion, spNumber);
        renderOverlayBody();
      } catch (err) {
        overlayBody.innerHTML = '<p style="color:var(--danger);">Failed to load Pokémon data.</p>';
      }
    }
  }

  function closeConfig() {
    UI.closeOverlay('config-overlay');
    currentDetail = null;
    // Collapse badge 2s after overlay closes
    if (batch.length > 0) {
      collapseBadge();
    }
  }

  // Swap the hero sprite between normal and shiny. Falls back to the normal
  // image when the current form has no shiny sprite, so the image never breaks.
  function updateHeroSprite(isShiny) {
    const img = document.getElementById('cfg-hero-sprite');
    if (!img) return;
    const normal = img.dataset.normal || '';
    const shiny = img.dataset.shiny || '';
    const target = (isShiny && shiny) ? shiny : normal;
    if (!target) return;
    img.src = target;
    img.style.display = '';
  }

  // --- Attach listeners inside the config overlay ---
  function attachConfigListeners() {
    // Form selector — custom dropdown wired to hidden <select>
    const formWrap = document.getElementById('cfg-form-wrap');
    const formBtn = document.getElementById('cfg-form-btn');
    const formMenu = document.getElementById('cfg-form-menu');
    const formSelect = document.getElementById('cfg-form');

    if (formBtn && formMenu && formSelect) {
      // Toggle open/close
      formBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = formWrap.classList.toggle('cd-open');
        formBtn.setAttribute('aria-expanded', String(isOpen));
      });
      // Close on outside click
      document.addEventListener('click', function closeForm(e) {
        if (!formWrap.contains(e.target)) {
          formWrap.classList.remove('cd-open');
          formBtn.setAttribute('aria-expanded', 'false');
          document.removeEventListener('click', closeForm);
        }
      });
      // Item click
      formMenu.querySelectorAll('.cd-item').forEach(item => {
        item.addEventListener('click', () => {
          const val = parseInt(item.dataset.value) || 0;
          formSelect.value = val;
          formBtn.querySelector('.cd-selected-label').textContent = item.textContent;
          formMenu.querySelectorAll('.cd-item').forEach(i => i.classList.remove('cd-item--active'));
          item.classList.add('cd-item--active');
          formWrap.classList.remove('cd-open');
          formBtn.setAttribute('aria-expanded', 'false');
          // Re-render body
          currentFormIndex = val;
          overlayBody.innerHTML = UI.renderConfigBody(currentDetail, options, currentFormIndex, currentVersion);
          populateMoveSelects();
          CustomDropdown.initAll(overlayBody);
          attachConfigListeners();
          UI.updateEvTotal();
        });
      });
    } else if (formSelect) {
      // Fallback for native select
      formSelect.addEventListener('change', () => {
        currentFormIndex = parseInt(formSelect.value) || 0;
        overlayBody.innerHTML = UI.renderConfigBody(currentDetail, options, currentFormIndex, currentVersion);
        CustomDropdown.initAll(overlayBody);
        attachConfigListeners();
        UI.updateEvTotal();
      });
    }

    // Level slider
    const levelSlider = document.getElementById('cfg-level');
    if (levelSlider) {
      levelSlider.addEventListener('input', () => {
        const val = levelSlider.value;
        document.getElementById('cfg-level-val').textContent = val;
        const pct = ((val - levelSlider.min) / (levelSlider.max - levelSlider.min)) * 100;
        levelSlider.style.setProperty('--level-pct', pct + '%');
      });
    }

    // Friendship slider
    const friendshipSlider = document.getElementById('cfg-friendship');
    if (friendshipSlider) {
      friendshipSlider.addEventListener('input', () => {
        const val = friendshipSlider.value;
        document.getElementById('cfg-friendship-val').textContent = val;
        const pct = (val / 255) * 100;
        friendshipSlider.style.setProperty('--level-pct', pct + '%');
      });
    }

    // IV sliders
    const ivInputs = overlayBody.querySelectorAll('.iv-slider input[type="range"]');
    ivInputs.forEach((input) => {
      input.addEventListener('input', () => {
        const valEl = document.getElementById(input.id + '-val');
        if (valEl) valEl.textContent = input.value;
        const pct = ((input.value - input.min) / (input.max - input.min)) * 100;
        input.style.setProperty('--iv-pct', pct + '%');
      });
    });

    // EV sliders with 510 total constraint
    const evInputs = overlayBody.querySelectorAll('.ev-slider input[type="range"]');
    evInputs.forEach((input) => {
      input.addEventListener('input', () => {
        // Enforce 510 total
        const stats = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
        let total = 0;
        for (const s of stats) {
          total += parseInt(document.getElementById(`cfg-ev-${s}`).value) || 0;
        }
        if (total > 510) {
          // Clamp this slider
          const excess = total - 510;
          input.value = Math.max(0, parseInt(input.value) - excess);
        }
        // Update display
        const valEl = document.getElementById(input.id + '-val');
        if (valEl) valEl.textContent = input.value;
        const pct = input.max > 0 ? (input.value / input.max) * 100 : 0;
        input.style.setProperty('--ev-pct', pct + '%');
        UI.updateEvTotal();
      });
    });

    // Shiny toggle — swap the hero sprite to the shiny image when available.
    const shinyBtn = document.getElementById('cfg-shiny');
    if (shinyBtn) {
      shinyBtn.addEventListener('click', () => {
        const active = shinyBtn.classList.toggle('active');
        shinyBtn.setAttribute('aria-pressed', String(active));
        updateHeroSprite(active);
      });
    }

    // Alpha toggle
    const alphaBtn = document.getElementById('cfg-alpha');
    if (alphaBtn) {
      alphaBtn.addEventListener('click', () => {
        const active = alphaBtn.classList.toggle('active');
        alphaBtn.setAttribute('aria-pressed', String(active));
      });
    }

    // Gender toggles — only one active at a time
    const genderBtns = overlayBody.querySelectorAll('.icon-toggle[data-gender]');
    genderBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.classList.contains('active')) return;
        genderBtns.forEach((b) => {
          b.classList.remove('active');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
      });
    });

    // Ball icon preview — update hero ball when selection changes
    const ballSelect = document.getElementById('cfg-ball');
    const heroBallIcon = document.getElementById('cfg-hero-ball-icon');
    if (ballSelect) {
      ballSelect.addEventListener('change', () => {
        const val = ballSelect.value;
        if (val) {
          const slug = val.toLowerCase().replace(/[éè]/g, 'e').replace(/[^a-z]/g, '');
          const src = `/icons/${slug}.png`;
          if (heroBallIcon) { heroBallIcon.src = src; }
        } else {
          if (heroBallIcon) { heroBallIcon.src = '/icons/pokeball.png'; }
        }
      });
    }

    // Trainer collapsible toggle
    const trainerToggle = document.getElementById('trainer-toggle');
    const trainerContent = document.getElementById('trainer-content');
    if (trainerToggle && trainerContent) {
      trainerToggle.addEventListener('click', () => {
        const section = trainerToggle.closest('.config-section--collapsible');
        const isOpen = section.classList.toggle('open');
        trainerContent.style.display = isOpen ? '' : 'none';
      });
    }

    // OT Gender icon toggles
    const otGenderBtns = overlayBody.querySelectorAll('[data-ot-gender]');
    const otGenderSelect = document.getElementById('cfg-ot-gender');
    otGenderBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const isActive = btn.classList.contains('active');
        otGenderBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
        if (!isActive) {
          btn.classList.add('active');
          btn.setAttribute('aria-pressed', 'true');
          if (otGenderSelect) otGenderSelect.value = btn.dataset.otGender;
        } else {
          if (otGenderSelect) otGenderSelect.value = '';
        }
      });
    });

    // Moves — prevent duplicates across slots
    const moveSelects = [
      document.getElementById('cfg-move1'),
      document.getElementById('cfg-move2'),
      document.getElementById('cfg-move3'),
      document.getElementById('cfg-move4'),
    ].filter(Boolean);

    function updateMoveIndicators() {
      // Collect currently selected moves across all slots
      const selected = {};
      moveSelects.forEach((sel, idx) => {
        if (sel.value) selected[sel.value] = idx;
      });

      // For each custom dropdown, update items with pink checkmark
      moveSelects.forEach((sel, idx) => {
        const wrap = sel.closest('.cd-wrap');
        if (!wrap) return;
        const items = wrap.querySelectorAll('.cd-item');
        items.forEach(item => {
          const val = item.dataset.value;
          if (!val) return;
          const usedInOther = (val in selected) && selected[val] !== idx;
          // Remove existing icon
          const existing = item.querySelector('.move-used-icon');
          if (existing) existing.remove();
          const nameSpan = item.querySelector('span');
          if (nameSpan) nameSpan.style.color = usedInOther ? '#c4388a' : '';
          if (usedInOther) {
            const icon = document.createElement('span');
            icon.className = 'move-used-icon';
            icon.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c4388a" stroke-width="3"><path d="M5 13l4 4L19 7"/></svg>`;
            item.appendChild(icon);
          }
        });
      });
    }

    moveSelects.forEach((sel, idx) => {
      sel.addEventListener('change', () => {
        const chosen = sel.value;
        if (!chosen) { updateMoveIndicators(); return; }

        // If this move is already selected in another slot, clear that slot + refresh its button
        moveSelects.forEach((otherSel, otherIdx) => {
          if (otherIdx !== idx && otherSel.value === chosen) {
            otherSel.value = '';
            // Refresh the other custom dropdown button
            const otherWrap = otherSel.closest('.cd-wrap');
            if (otherWrap) {
              const otherBtn = otherWrap.querySelector('.cd-btn');
              if (otherBtn) otherBtn.innerHTML = `<span class="cd-placeholder">-- None --</span><svg class="cd-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>`;
            }
          }
        });

        updateMoveIndicators();
      });
    });

    // Re-apply indicators when any move dropdown opens
    moveSelects.forEach(sel => {
      sel.addEventListener('cd-open', () => setTimeout(updateMoveIndicators, 10));
    });

    // Initial indicator state
    updateMoveIndicators();
  }

  // --- Build config object from form ---
  function buildConfig() {
    if (!currentDetail) return null;

    const forms = currentDetail.forms || [];
    const form = forms[currentFormIndex] || forms[0] || {};
    const spriteUrl = form.spriteNormal ? '/' + form.spriteNormal.replace(/^\/+/, '') : '';
    const spriteShinyUrl = form.spriteShiny ? '/' + form.spriteShiny.replace(/^\/+/, '') : '';
    const level = parseInt(document.getElementById('cfg-level').value) || form.levelMax || 100;
    const ability = (document.getElementById('cfg-ability') || {}).value || '';
    const nature = (document.getElementById('cfg-nature') || {}).value || '';
    const ball = (document.getElementById('cfg-ball') || {}).value || '';
    const language = (document.getElementById('cfg-language') || {}).value || 'English';

    // Form name for output (only for non-default forms)
    let formName = '';
    if (form.formName && form.formName !== 'Default Form' && form.formName.trim()) {
      formName = form.formName.trim();
    }

    // Nickname
    const nicknameEl = document.getElementById('cfg-nickname');
    const nickname = nicknameEl ? nicknameEl.value.trim() : '';

    // Shiny toggle
    const shinyEl = document.getElementById('cfg-shiny');
    const shiny = shinyEl ? shinyEl.classList.contains('active') : false;

    // Alpha toggle
    const alphaEl = document.getElementById('cfg-alpha');
    const alpha = alphaEl ? alphaEl.classList.contains('active') : false;

    // Gender (icon toggle buttons)
    const genderBtn = overlayBody.querySelector('.icon-toggle[data-gender].active');
    const requestedGender = genderBtn ? genderBtn.dataset.gender : '';

    const hasMale = !!overlayBody.querySelector('.icon-toggle[data-gender="M"]');
    const hasFemale = !!overlayBody.querySelector('.icon-toggle[data-gender="F"]');
    const genderInfo = {
      canBeMale: hasMale,
      canBeFemale: hasFemale,
      isGenderless: !hasMale && !hasFemale,
    };
    const gender = resolveGender(genderInfo, requestedGender);

    // Moves — deduplicated
    const moves = [];
    for (let i = 1; i <= 4; i++) {
      const val = document.getElementById(`cfg-move${i}`).value;
      if (val && !moves.includes(val)) moves.push(val);
    }

    // EVs
    const evs = {};
    const stats = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
    for (const s of stats) {
      evs[s] = parseInt(document.getElementById(`cfg-ev-${s}`).value) || 0;
    }

    // IVs
    const ivs = {};
    for (const s of stats) {
      const val = parseInt(document.getElementById(`cfg-iv-${s}`).value);
      ivs[s] = isNaN(val) ? 0 : val;
    }

    // Trainer
    const ot = document.getElementById('cfg-ot').value.trim();
    const otGender = document.getElementById('cfg-ot-gender').value;
    const trainer = {};
    if (ot) trainer.ot = ot;
    if (otGender) trainer.otGender = otGender;

    return {
      pokemonName: currentDetail.name,
      formName,
      nickname,
      gender,
      level,
      shiny,
      alpha,
      _version: currentVersion,
      sourceVersion: { gen9: '50', gen9a: '52', gen8: '44', gen8a: '47' }[currentVersion] || '50',
      ball,
      ability: (currentVersion === 'gen9a' || currentVersion === 'gen8a') ? '' : ability,  // ZA/LA don't allow ability selection
      nature,
      friendship: parseInt((document.getElementById('cfg-friendship') || {}).value) || 0,
      evs,
      ivs,
      trainer,
      language,
      moves,
      // Batch thumbnail follows the shiny choice when a shiny sprite exists.
      _sprite: (shiny && spriteShinyUrl) ? spriteShinyUrl : spriteUrl,
      _ballSlug: ball ? ball.toLowerCase().replace(/[éè]/g, 'e').replace(/[^a-z]/g, '') : '',
      // Metadata for %order suffix (version filtering / whitelist / banlist)
      _dex: currentDetail.dexNum || currentDetail.id,
      _formIndex: currentFormIndex,
    };
  }

  // --- Copy single ---
  // --- Version guard ---
  // A Pokémon belongs to the current version when it was built in that version
  // AND still exists in the currently loaded list. Prevents copying a command
  // whose Pokémon the target bot can't accept (e.g. an SV mon in a ZA order).
  function versionLabel(v) {
    return { gen9: 'Scarlet/Violet', gen9a: 'Legends: Z-A', gen8: 'Sword/Shield', gen8a: 'Legends Arceus' }[v] || v;
  }

  function getVersionLogoSrc(v) {
    return { gen9: '/img/sv.png', gen9a: '/img/za.png', gen8: '/img/swsh.png', gen8a: '/img/la.png' }[v] || '/img/sv.png';
  }

  function getVersionLogoSrc(v) {
    return { gen9: '/img/sv.png', gen9a: '/img/za.png', gen8: '/img/swsh.png', gen8a: '/img/la.png' }[v] || '/img/sv.png';
  }

  function findVersionMismatches(configs) {
    const validNames = new Set(pokemonList.map((p) => p.name));
    return configs.filter(
      (c) => c._version !== currentVersion || !validNames.has(c.pokemonName)
    );
  }

  async function copySingle() {
    const config = buildConfig();
    if (!config) return;

    // Guard: the open config is always built for the current version, but keep
    // a defensive check in case the list failed to load.
    if (findVersionMismatches([config]).length > 0) {
      UI.showToast(
        `${config.pokemonName} ไม่มีในเวอร์ชัน ${versionLabel(currentVersion)} — คัดลอกไม่ได้`,
        4000,
        'error'
      );
      return;
    }

    const text = formatPercentH(config, true);
    try {
      await navigator.clipboard.writeText(text);
      UI.showToast('Copied to clipboard!');
    } catch (err) {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      UI.showToast('Copied to clipboard!');
    }
  }

  // --- Add to batch ---
  function addToBatch() {
    const config = buildConfig();
    if (!config) return;

    batch.push(config);
    saveBatch();
    updateBatchUI();

    // Expand badge to show full text, then collapse after 2s
    expandBadge();

    // Flash green on Multi-Trade button
    btnBatch.classList.add('btn--flash-green');
    setTimeout(() => btnBatch.classList.remove('btn--flash-green'), 600);

    // Pop the batch badge
    batchBadge.classList.add('batch-badge-pop');
    setTimeout(() => batchBadge.classList.remove('batch-badge-pop'), 500);

    UI.showToast(`✓ เพิ่ม ${config.pokemonName} แล้ว (${batch.length} ตัว)`, 2500, 'success');
  }

  // --- Copy all batch ---
  // Build the expanded list respecting each item's qty counter.
  function expandedBatch() {
    const qtyCells = batchList.querySelectorAll('.batch-item__qty');
    return batch.flatMap((cfg, i) => {
      const qty = Math.max(1, parseInt((qtyCells[i] && qtyCells[i].value) || 1) || 1);
      return Array(qty).fill(cfg);
    });
  }

  // Format batch without any "%h " prefix (required by save_order.php).
  function formatBatchNoPrefix(configs) {
    return configs
      .map((cfg) => formatPercentH(cfg, false))
      .join('\n\n');
  }

  // --- Beta Orders — submit to save_order.php and show %order code ---
  // Builds a summary suffix for the %order code:
  //   v52:0655,1:0904,1:0670-5,2:0686,1:0675,1
  // Format: v{versionCode}:{dex[-formIndex],qty}...
  // Consecutive duplicates (same dex+form) are merged into a single entry with summed qty.
  function buildOrderSuffix(expandedConfigs) {
    if (!expandedConfigs.length) return '';
    const vCode = expandedConfigs[0].sourceVersion || '52';

    // Group sequential duplicates by dex+form
    const entries = [];
    for (const cfg of expandedConfigs) {
      const dex = String(cfg._dex || 0).padStart(4, '0');
      const formIdx = cfg._formIndex || 0;
      const key = formIdx > 0 ? `${dex}-${formIdx}` : dex;
      const last = entries[entries.length - 1];
      if (last && last.key === key) {
        last.qty++;
      } else {
        entries.push({ key, qty: 1 });
      }
    }

    return `v${vCode}:${entries.map(e => `${e.key},${e.qty}`).join(':')}`;
  }

  async function submitBetaOrder() {
    if (batch.length === 0) { UI.showToast('Batch is empty'); return; }
    const mismatches = findVersionMismatches(batch);
    if (mismatches.length > 0) {
      const names = [...new Set(mismatches.map((c) => c.pokemonName))].join(', ');
      UI.showToast(`มีตัวไม่ตรงเวอร์ชัน (${names}) — ลบออกก่อน`, 5000, 'error');
      return;
    }
    const expanded = expandedBatch();
    const command = formatBatchNoPrefix(expanded);
    btnBetaOrders.disabled = true;
    btnBetaOrders.textContent = '...';
    try {
      const res = await fetch('/api/submit-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, version: currentVersion }),
      });
      const data = await res.json();
      if (data.order) {
        const suffix = buildOrderSuffix(expanded);
        const code = `%order ${data.order} ${suffix}`;
        try {
          await navigator.clipboard.writeText(code);
        } catch {
          const ta = document.createElement('textarea');
          ta.value = code; ta.style.position = 'fixed'; ta.style.opacity = '0';
          document.body.appendChild(ta); ta.select();
          document.execCommand('copy'); document.body.removeChild(ta);
        }
        UI.showToast(`คัดลอกแล้ว: %order ${data.order}`, 5000, 'success');
      } else {
        UI.showToast(data.error || 'เกิดข้อผิดพลาด', 4000, 'error');
      }
    } catch (err) {
      UI.showToast('ส่งคำสั่งไม่สำเร็จ: ' + err.message, 4000, 'error');
    } finally {
      btnBetaOrders.disabled = false;
      btnBetaOrders.textContent = 'Beta Orders';
    }
  }

  async function copyBatch() {
    if (batch.length === 0) {
      UI.showToast('Batch is empty');
      return;
    }

    // Guard: block copy if any item doesn't belong to the current version.
    const mismatches = findVersionMismatches(batch);
    if (mismatches.length > 0) {
      const names = [...new Set(mismatches.map((c) => c.pokemonName))].join(', ');
      UI.showToast(
        `มี ${mismatches.length} ตัวไม่ตรงกับเวอร์ชัน ${versionLabel(currentVersion)} (${names}) — ลบออกก่อนคัดลอก`,
        5000,
        'error'
      );
      return;
    }

    const text = formatBatch(expandedBatch());
    try {
      await navigator.clipboard.writeText(text);
      UI.showToast('Batch copied to clipboard!');
    } catch (err) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      UI.showToast('Batch copied to clipboard!');
    }
  }

  // --- Update batch badge and counts ---
  let badgeCollapseTimer = null;

  function updateBatchUI() {
    const count = batch.length;
    btnBatchCount.textContent = count;

    const badgeCount = document.getElementById('batch-badge-count');
    const badgeMini = document.getElementById('batch-badge-mini');
    const badgeFull = document.getElementById('batch-badge-full');
    if (badgeCount) badgeCount.textContent = count;
    if (badgeMini) badgeMini.textContent = count;

    if (count > 0) {
      batchBadge.classList.remove('hidden');
    } else {
      batchBadge.classList.add('hidden');
    }
  }

  // Force the badge into its collapsed (mini) visual state without the
  // expand animation — used right after a page load/restore so a batch
  // brought back from localStorage doesn't flash the "just added" full text.
  function setBadgeMiniImmediate() {
    const full = document.getElementById('batch-badge-full');
    const mini = document.getElementById('batch-badge-mini');
    if (!full || !mini) return;
    clearTimeout(badgeCollapseTimer);
    batchBadge.classList.remove('batch-badge--expanded');
    batchBadge.classList.add('batch-badge--mini');
    full.classList.add('hidden');
    mini.classList.remove('hidden');
  }

  function expandBadge() {
    const full = document.getElementById('batch-badge-full');
    const mini = document.getElementById('batch-badge-mini');
    if (!full || !mini) return;

    // Show expanded
    batchBadge.classList.remove('batch-badge--mini');
    batchBadge.classList.add('batch-badge--expanded');
    full.classList.remove('hidden');
    mini.classList.add('hidden');

    // Don't auto-collapse here — wait until overlay closes
    clearTimeout(badgeCollapseTimer);
  }

  function collapseBadge() {
    const full = document.getElementById('batch-badge-full');
    const mini = document.getElementById('batch-badge-mini');
    if (!full || !mini) return;

    clearTimeout(badgeCollapseTimer);
    badgeCollapseTimer = setTimeout(() => {
      batchBadge.classList.remove('batch-badge--expanded');
      batchBadge.classList.add('batch-badge--mini');
      full.classList.add('hidden');
      mini.classList.remove('hidden');
    }, 2000);
  }

  // --- Clear batch ---
  // --- Batch persistence (localStorage) ---
  const BATCH_STORAGE_KEY = 'pkm_batch_v1';
  const BATCH_TTL_MS = 45 * 60 * 1000; // 45 minutes

  function saveBatch() {
    try {
      localStorage.setItem(BATCH_STORAGE_KEY, JSON.stringify({
        version: currentVersion,
        items: batch,
        savedAt: Date.now(),
      }));
    } catch (e) { /* storage full or blocked */ }
  }

  function loadBatch() {
    try {
      const raw = localStorage.getItem(BATCH_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      // Expire after TTL
      if (!saved.savedAt || (Date.now() - saved.savedAt) > BATCH_TTL_MS) {
        localStorage.removeItem(BATCH_STORAGE_KEY);
        return;
      }
      // Only restore if same version
      if (saved.version === currentVersion && Array.isArray(saved.items) && saved.items.length > 0) {
        batch = saved.items;
        updateBatchUI();
        setBadgeMiniImmediate();
        // Small pop animation so the user notices the restored badge,
        // without the full-text expand/collapse or a toast notification.
        batchBadge.classList.add('batch-badge-pop');
        setTimeout(() => batchBadge.classList.remove('batch-badge-pop'), 500);
      }
    } catch (e) {
      localStorage.removeItem(BATCH_STORAGE_KEY);
    }
  }

  function clearBatch() {
    batch = [];
    saveBatch();
    updateBatchUI();
    UI.renderBatchList(batch, batchList);
    UI.showToast('Batch cleared');
  }

  // --- Remove single from batch ---
  function removeFromBatch(index) {
    batch.splice(index, 1);
    saveBatch();
    updateBatchUI();
    UI.renderBatchList(batch, batchList);
  }

  // --- Event bindings ---
  function init() {
    // Sync dropdown to the version resolved from the URL
    versionSelect.value = currentVersion;
    versionLogo.src = getVersionLogoSrc(currentVersion);

    // Version switch
    versionSelect.addEventListener('change', () => {
      const previousVersion = currentVersion;
      currentVersion = versionSelect.value;
      searchInput.value = '';
      searchInputMobile.value = '';
      // A batch is tied to a single game version (different .Version code and
      // fields per version). Clear it on a real version change so Pokémon from
      // one game can't leak into another game's command.
      if (currentVersion !== previousVersion && batch.length > 0) {
        const removed = batch.length;
        clearBatch();
        UI.showToast(`สลับเวอร์ชันแล้ว — ล้างรายการ ${removed} ตัวออกจาก batch`, 3000);
      }
      // Update version logo
      versionLogo.src = getVersionLogoSrc(currentVersion);
      // Reflect the version in the URL path without reloading the page
      if (VALID_VERSIONS.includes(currentVersion)) {
        history.pushState({ version: currentVersion }, '', VERSION_TO_PATH[currentVersion]);
      }
      loadPokemonList(currentVersion);
      loadOptions(currentVersion);
    });

    // Handle browser back/forward navigation
    window.addEventListener('popstate', () => {
      const previousVersion = currentVersion;
      currentVersion = versionFromPath();
      versionSelect.value = currentVersion;
      // Same reasoning as the dropdown handler: never mix versions in one batch.
      if (currentVersion !== previousVersion && batch.length > 0) {
        clearBatch();
      }
      versionLogo.src = getVersionLogoSrc(currentVersion);
      searchInput.value = '';
      searchInputMobile.value = '';
      loadPokemonList(currentVersion);
      loadOptions(currentVersion);
    });

    // Search (both desktop and mobile inputs synced)
    let searchTimeout;
    function handleSearch(source) {
      const value = source.value;
      // Sync the other input
      if (source === searchInput) {
        searchInputMobile.value = value;
      } else {
        searchInput.value = value;
      }
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(filterGrid, 150);
    }
    searchInput.addEventListener('input', () => handleSearch(searchInput));
    searchInputMobile.addEventListener('input', () => handleSearch(searchInputMobile));

    // Grid card click (event delegation)
    gridEl.addEventListener('click', (e) => {
      const card = e.target.closest('.poke-card');
      if (!card) return;
      const spNumber = card.dataset.spNumber;
      const dex = card.dataset.dex;
      const name = card.dataset.name;
      openConfig(spNumber, dex, name);
    });

    // Close overlay
    overlayClose.addEventListener('click', closeConfig);
    overlay.querySelector('.overlay__backdrop').addEventListener('click', closeConfig);

    // Swipe down to close on mobile
    let touchStartY = 0;
    const overlayPanel = overlay.querySelector('.overlay__panel');
    overlayPanel.addEventListener('touchstart', (e) => {
      touchStartY = e.touches[0].clientY;
    }, { passive: true });
    overlayPanel.addEventListener('touchend', (e) => {
      const touchEndY = e.changedTouches[0].clientY;
      const diff = touchEndY - touchStartY;
      // If swiped down more than 100px from the top area (first 80px)
      if (diff > 100 && touchStartY < 80) {
        closeConfig();
      }
    }, { passive: true });

    // Copy button
    btnCopy.addEventListener('click', copySingle);

    // Batch button
    btnBatch.addEventListener('click', addToBatch);

    // Batch badge -> open batch modal
    batchBadge.addEventListener('click', () => {
      UI.renderBatchList(batch, batchList);
      // Sync version logo in batch modal header
      const batchLogo = document.getElementById('batch-version-logo');
      if (batchLogo) batchLogo.src = getVersionLogoSrc(currentVersion);
      UI.openOverlay('batch-modal');
    });

    // Batch modal close
    batchModalClose.addEventListener('click', () => UI.closeOverlay('batch-modal'));
    batchModal.querySelector('.overlay__backdrop').addEventListener('click', () => UI.closeOverlay('batch-modal'));

    // Copy all
    btnCopyAll.addEventListener('click', copyBatch);

    // Beta Orders — submit to save_order.php via server proxy
    btnBetaOrders.addEventListener('click', submitBetaOrder);

    // Qty input change (update batch._qty live so expandedBatch() picks it up)
    batchList.addEventListener('input', (e) => {
      const input = e.target.closest('.batch-item__qty');
      if (!input) return;
      const index = parseInt(input.dataset.index);
      if (batch[index]) {
        batch[index]._qty = Math.max(1, parseInt(input.value) || 1);
        saveBatch();
      }
    });

    // Clear batch
    btnClearBatch.addEventListener('click', clearBatch);

    // Batch item remove (delegation)
    batchList.addEventListener('click', (e) => {
      const btn = e.target.closest('.batch-item__remove');
      if (!btn) return;
      const index = parseInt(btn.dataset.index);
      removeFromBatch(index);
    });

    // Keyboard: Escape to close overlays
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (!overlay.classList.contains('hidden')) {
          closeConfig();
        } else if (!batchModal.classList.contains('hidden')) {
          UI.closeOverlay('batch-modal');
        }
      }
    });

    // Infinite scroll: load more cards when user scrolls near the bottom
    window.addEventListener('scroll', () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) {
        UI.renderNextBatch(gridEl);
      }
    });

    // Initial load
    loadPokemonList(currentVersion);
    loadOptions(currentVersion);
    loadBatch();
    updateBatchUI();
  }

  // Start when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
