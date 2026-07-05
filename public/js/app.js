/**
 * App Module — main application logic for the Pokemon Generator.
 * Handles state, API calls, event binding, and config generation.
 */

(function () {
  'use strict';

  // --- Version resolution from URL ---
  const VALID_VERSIONS = ['gen9', 'gen9a'];

  function versionFromPath() {
    const path = window.location.pathname.replace(/\/+$/, '');
    if (path === '/gen9') return 'gen9';
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
  const overlayClose = document.getElementById('overlay-close');
  const btnCopy = document.getElementById('btn-copy');
  const btnBatch = document.getElementById('btn-batch');
  const btnBatchCount = document.getElementById('btn-batch-count');
  const batchBadge = document.getElementById('batch-badge');
  const batchBadgeCount = document.getElementById('batch-badge-count');
  const batchModal = document.getElementById('batch-modal');
  const batchModalClose = document.getElementById('batch-modal-close');
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

  async function loadPokemonDetail(version, spNumber) {
    return fetchJSON(`/api/pokemon/${version}/${spNumber}`);
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

  // --- Config overlay ---
  async function openConfig(spNumber, dex, name) {
    overlayTitle.textContent = `#${String(dex).padStart(3, '0')} ${name}`;

    // Reset the selected form for each newly opened Pokémon.
    currentFormIndex = 0;

    // Show overlay immediately with loading state
    overlayBody.innerHTML = '<div class="grid-loader">Loading...</div>';
    UI.openOverlay('config-overlay');

    try {
      currentDetail = await loadPokemonDetail(currentVersion, spNumber);
      overlayBody.innerHTML = UI.renderConfigBody(currentDetail, options, currentFormIndex, currentVersion);
      CustomDropdown.initAll(overlayBody);
      attachConfigListeners();
    } catch (err) {
      overlayBody.innerHTML = '<p style="color:var(--danger);">Failed to load Pokémon data.</p>';
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

  // --- Attach listeners inside the config overlay ---
  function attachConfigListeners() {
    // Form selector — re-render the body for the newly selected form.
    const formSelect = document.getElementById('cfg-form');
    if (formSelect) {
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

    // Shiny toggle
    const shinyBtn = document.getElementById('cfg-shiny');
    if (shinyBtn) {
      shinyBtn.addEventListener('click', () => {
        const active = shinyBtn.classList.toggle('active');
        shinyBtn.setAttribute('aria-pressed', String(active));
      });
    }

    // Alpha toggle
    const alphaBtn = document.getElementById('cfg-alpha');
    if (alphaBtn) {
      alphaBtn.addEventListener('click', () => {
        const active = alphaBtn.classList.toggle('active');
        alphaBtn.setAttribute('aria-pressed', String(active));
        // Alpha requires at least 3V IVs — auto-set HP/Atk/Spe to 31 if all are 0
        if (active) {
          const ivStats = ['hp', 'atk', 'spe'];
          for (const s of ivStats) {
            const el = document.getElementById(`cfg-iv-${s}`);
            if (el && parseInt(el.value) === 0) {
              el.value = 31;
              const valEl = document.getElementById(`cfg-iv-${s}-val`);
              if (valEl) valEl.textContent = '31';
              el.style.setProperty('--iv-pct', '100%');
            }
          }
        }
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

      // For each select, mark options that are used in OTHER slots
      moveSelects.forEach((sel, idx) => {
        const options = sel.querySelectorAll('option');
        options.forEach(opt => {
          if (!opt.value) return; // skip "-- None --"
          const usedInOther = (opt.value in selected) && selected[opt.value] !== idx;
          // Add/remove a "used" marker text
          const cleanText = opt.textContent.replace(/ ✓$/, '');
          opt.textContent = usedInOther ? cleanText + ' ✓' : cleanText;
          opt.style.color = usedInOther ? '#7b8ab8' : '';
        });
      });
    }

    moveSelects.forEach((sel, idx) => {
      sel.addEventListener('change', () => {
        const chosen = sel.value;
        if (!chosen) { updateMoveIndicators(); return; }

        // If this move is already selected in another slot, clear that slot
        moveSelects.forEach((otherSel, otherIdx) => {
          if (otherIdx !== idx && otherSel.value === chosen) {
            otherSel.value = '';
          }
        });

        updateMoveIndicators();
      });
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
    const level = parseInt(document.getElementById('cfg-level').value) || form.levelMax || 100;
    const ability = document.getElementById('cfg-ability').value;
    const nature = document.getElementById('cfg-nature').value;
    const ball = document.getElementById('cfg-ball').value;
    const language = document.getElementById('cfg-language').value;

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

    // Moves
    const moves = [];
    for (let i = 1; i <= 4; i++) {
      const val = document.getElementById(`cfg-move${i}`).value;
      if (val) moves.push(val);
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
      sourceVersion: currentVersion === 'gen9a' ? '52' : '50',
      ball,
      ability: currentVersion === 'gen9a' ? '' : ability,  // ZA doesn't allow ability selection
      nature,
      friendship: '',
      evs,
      ivs,
      trainer,
      language,
      moves,
      _sprite: spriteUrl,
      _ballSlug: ball ? ball.toLowerCase().replace(/[éè]/g, 'e').replace(/[^a-z]/g, '') : '',
    };
  }

  // --- Copy single ---
  async function copySingle() {
    const config = buildConfig();
    if (!config) return;

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
  async function copyBatch() {
    if (batch.length === 0) {
      UI.showToast('Batch is empty');
      return;
    }
    const text = formatBatch(batch);
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
    if (badgeCount) badgeCount.textContent = count;
    if (badgeMini) badgeMini.textContent = count;

    if (count > 0) {
      batchBadge.classList.remove('hidden');
    } else {
      batchBadge.classList.add('hidden');
    }
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
  function clearBatch() {
    batch = [];
    updateBatchUI();
    UI.renderBatchList(batch, batchList);
    UI.showToast('Batch cleared');
  }

  // --- Remove single from batch ---
  function removeFromBatch(index) {
    batch.splice(index, 1);
    updateBatchUI();
    UI.renderBatchList(batch, batchList);
  }

  // --- Event bindings ---
  function init() {
    // Sync dropdown to the version resolved from the URL
    versionSelect.value = currentVersion;
    versionLogo.src = currentVersion === 'gen9a' ? '/img/za.png' : '/img/sv.png';

    // Version switch
    versionSelect.addEventListener('change', () => {
      currentVersion = versionSelect.value;
      searchInput.value = '';
      searchInputMobile.value = '';
      // Update version logo
      versionLogo.src = currentVersion === 'gen9a' ? '/img/za.png' : '/img/sv.png';
      // Reflect the version in the URL path without reloading the page
      if (VALID_VERSIONS.includes(currentVersion)) {
        history.pushState({ version: currentVersion }, '', `/${currentVersion}`);
      }
      loadPokemonList(currentVersion);
      loadOptions(currentVersion);
    });

    // Handle browser back/forward navigation
    window.addEventListener('popstate', () => {
      currentVersion = versionFromPath();
      versionSelect.value = currentVersion;
      versionLogo.src = currentVersion === 'gen9a' ? '/img/za.png' : '/img/sv.png';
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
    document.getElementById('overlay-close-bottom').addEventListener('click', closeConfig);

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
      UI.openOverlay('batch-modal');
    });

    // Batch modal close
    batchModalClose.addEventListener('click', () => UI.closeOverlay('batch-modal'));
    batchModal.querySelector('.overlay__backdrop').addEventListener('click', () => UI.closeOverlay('batch-modal'));

    // Copy all
    btnCopyAll.addEventListener('click', copyBatch);

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
    updateBatchUI();
  }

  // Start when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
