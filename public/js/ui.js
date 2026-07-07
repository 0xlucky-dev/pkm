/**
 * UI Module — handles DOM rendering, overlay management, and toast notifications.
 * Exposes utility functions consumed by app.js.
 */

const UI = (() => {
  // --- Toast ---
  let toastTimer = null;

  function showToast(message, duration = 2500, type = '') {
    const el = document.getElementById('toast');
    el.textContent = message;
    el.className = 'toast';
    if (type) el.classList.add('toast--' + type);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.classList.add('hidden'); }, duration);
  }

  // --- Overlay management ---
  function openOverlay(id) {
    const el = document.getElementById(id);
    el.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeOverlay(id) {
    const el = document.getElementById(id);
    el.classList.add('hidden');
    document.body.style.overflow = '';
  }

  // --- Gender code extraction ---
  function getGenderCode(spritePath) {
    if (!spritePath) return 'mf';
    const file = spritePath.split('/').pop() || '';
    const parts = file.split('_');
    const code = parts[4] || 'mf';
    return code.toLowerCase();
  }

  // --- Trait toggle icons (SVG) ---
  const ICON_SHINY = `<img src="/icons/shiny.svg" width="22" height="22" alt="Shiny" style="display:block;">`;

  const ICON_MALE = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <path fill="currentColor" d="M14.5 3a1 1 0 000 2h2.086l-3.51 3.51A6 6 0 1014.99 9.9L18.5 6.41V8.5a1 1 0 002 0v-4.5a1 1 0 00-1-1h-5zM10 10a4 4 0 110 8 4 4 0 010-8z"/>
  </svg>`;

  const ICON_FEMALE = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <path fill="currentColor" d="M12 2a6 6 0 00-1 11.917V16H9a1 1 0 000 2h2v2a1 1 0 002 0v-2h2a1 1 0 000-2h-2v-2.083A6 6 0 0012 2zm0 2a4 4 0 110 8 4 4 0 010-8z"/>
  </svg>`;

  const ICON_ALPHA = `<img src="/icons/alpha-icon.png" width="22" height="22" alt="Alpha" style="display:block;">`;

  // --- Build the top pill toggle row (Nickname + Gender + Shiny + Alpha) ---
  function buildTraitToggles({ canShiny, canAlpha, showMale, showFemale }) {
    const maleActive = showMale;
    const femaleActive = showFemale && !showMale;

    let genderHtml = '';
    if (showMale) {
      genderHtml += `
        <button type="button" class="icon-toggle icon-toggle--male${maleActive ? ' active' : ''}"
                data-gender="M" aria-pressed="${maleActive}" title="Male">
          ${ICON_MALE}
        </button>`;
    }
    if (showFemale) {
      genderHtml += `
        <button type="button" class="icon-toggle icon-toggle--female${femaleActive ? ' active' : ''}"
                data-gender="F" aria-pressed="${femaleActive}" title="Female">
          ${ICON_FEMALE}
        </button>`;
    }

    const shinyHtml = canShiny ? `
      <button type="button" class="icon-toggle icon-toggle--shiny" id="cfg-shiny"
              aria-pressed="false" title="Shiny">
        ${ICON_SHINY}<span>Shiny</span>
      </button>` : '';

    const alphaHtml = canAlpha ? `
      <button type="button" class="icon-toggle icon-toggle--alpha" id="cfg-alpha"
              aria-pressed="false" title="Alpha">
        ${ICON_ALPHA}<span>Alpha</span>
      </button>` : '';

    const nicknameHtml = `
      <div class="nickname-pill">
        <input type="text" id="cfg-nickname" placeholder="Enter nickname..." maxlength="12" autocomplete="off">
      </div>`;

    return `
      <div class="config-section">
        <div class="trait-toggles trait-toggles--single-row">
          ${nicknameHtml}
          ${genderHtml}
          ${shinyHtml}
          ${alphaHtml}
        </div>
      </div>`;
  }

  // --- Grid rendering ---
  function createPokemonCard(pokemon) {
    const card = document.createElement('div');
    card.className = 'poke-card';
    card.dataset.spNumber = pokemon.sp_number;
    card.dataset.dex = pokemon.dex;
    card.dataset.name = pokemon.name;

    let spriteUrl;
    if (pokemon.sprite) {
      spriteUrl = '/' + pokemon.sprite.replace(/^\/+/, '');
    } else {
      const dexStr = String(pokemon.dex).padStart(4, '0');
      spriteUrl = `/sprites/poke_capture_${dexStr}_000_mf_n_00000000_f_n.png`;
    }

    card.innerHTML = `
      <img class="poke-card__sprite" src="${spriteUrl}" alt="${pokemon.name}" loading="lazy"
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
      <div class="poke-card__sprite--placeholder" style="display:none;">
        <svg viewBox="0 0 100 100" width="48" height="48" aria-hidden="true">
          <circle cx="50" cy="50" r="48" fill="#2a3a4a" stroke="#3d4d5d" stroke-width="3"/>
          <rect x="2" y="48" width="96" height="4" fill="#3d4d5d"/>
          <circle cx="50" cy="50" r="12" fill="none" stroke="#3d4d5d" stroke-width="4"/>
          <circle cx="50" cy="50" r="6" fill="#3d4d5d"/>
        </svg>
      </div>
      <span class="poke-card__dex">#${String(pokemon.dex).padStart(3, '0')}</span>
      <span class="poke-card__name">${pokemon.name}</span>
    `;

    return card;
  }

  function renderGrid(pokemonList, container) {
    container.innerHTML = '';
    container._fullList = pokemonList;
    container._rendered = 0;
    renderNextBatch(container);
  }

  function renderNextBatch(container, batchSize = 42) {
    const list = container._fullList;
    if (!list) return;
    const start = container._rendered;
    const end = Math.min(start + batchSize, list.length);
    if (start >= end) return;

    const fragment = document.createDocumentFragment();
    for (let i = start; i < end; i++) {
      fragment.appendChild(createPokemonCard(list[i]));
    }
    container.appendChild(fragment);
    container._rendered = end;
  }

  // --- Helper: build a slider row for stats ---
  function buildSliderRow(id, label, min, max, value, cssClass) {
    const pct = max > 0 ? ((value - min) / (max - min)) * 100 : 0;
    const pctVar = cssClass === 'iv-slider' ? '--iv-pct' : (cssClass === 'ev-slider' ? '--ev-pct' : '--level-pct');
    return `
      <div class="config-slider-row ${cssClass}">
        <label>${label}</label>
        <span class="slider-value" id="${id}-val">${value}</span>
        <input type="range" id="${id}" min="${min}" max="${max}" value="${value}"
               style="${pctVar}: ${pct}%">
      </div>`;
  }

  // --- Config Overlay Body (zeldaxiaoma-style layout) ---
  function renderConfigBody(pokemonDetail, options, formIndex = 0, version = 'gen9') {
    const forms = pokemonDetail.forms || [];
    const activeIndex = (formIndex >= 0 && formIndex < forms.length) ? formIndex : 0;
    const form = forms[activeIndex] || {};
    const abilities = form.abilities || [];
    const moves = form.moves || [];
    const levelMax = form.levelMax || 100;
    const canShiny = form.canShiny !== false;
    const canAlpha = form.canAlpha === true;

    const { natures, balls } = options;

    // Determine sprite URL
    let spriteUrl = '';
    if (form.spriteNormal) {
      spriteUrl = '/' + form.spriteNormal.replace(/^\/+/, '');
    }

    // --- Hero section: sprite + name + form selector ---
    let formSelectorHtml = '';
    if (forms.length > 1) {
      let formOptionsHtml = '';
      for (let i = 0; i < forms.length; i++) {
        const label = (forms[i].formName && forms[i].formName.trim()) || `Form ${i + 1}`;
        formOptionsHtml += `<option value="${i}"${i === activeIndex ? ' selected' : ''}>${label}</option>`;
      }
      formSelectorHtml = `
        <div class="config-field hero-form-select">
          <select id="cfg-form">${formOptionsHtml}</select>
        </div>`;
    }

    const heroHtml = `
      <div class="config-hero config-hero--centered">
        <div class="config-hero__sprite-wrap">
          <img class="config-hero__sprite" src="${spriteUrl}" alt="${pokemonDetail.name}"
               onerror="this.style.display='none';">
          <img class="config-hero__pokeball" id="cfg-hero-ball-icon" src="/icons/pokeball.png" width="36" height="36" alt="Ball">
        </div>
        <h2 class="config-hero__name">${pokemonDetail.name}</h2>
        ${formSelectorHtml}
      </div>`;

    // --- Gender code from sprite ---
    const genderCode = getGenderCode(form.spriteNormal || '');
    const showMale = genderCode !== 'fo' && genderCode !== 'uk';
    const showFemale = genderCode !== 'mo' && genderCode !== 'uk';

    // Trait toggles (Nickname + Gender + Shiny + Alpha)
    const traitTogglesHtml = buildTraitToggles({ canShiny, canAlpha, showMale, showFemale });

    // --- Level slider ---
    const levelSliderHtml = `
      <div class="config-section">
        <div class="config-section__title">Level</div>
        <div class="config-slider-row level-slider">
          <span class="slider-value" id="cfg-level-val">${levelMax}</span>
          <input type="range" id="cfg-level" min="1" max="${levelMax}" value="${levelMax}"
                 style="--level-pct: 100%">
        </div>
      </div>`;

    // --- Friendship slider ---
    const friendshipHtml = `
      <div class="config-section">
        <div class="config-section__title">Friendship</div>
        <div class="config-slider-row level-slider">
          <span class="slider-value" id="cfg-friendship-val">0</span>
          <input type="range" id="cfg-friendship" min="0" max="255" value="0"
                 style="--level-pct: 0%">
        </div>
      </div>`;

    // --- Basic Info dropdowns ---
    let abilitiesHtml = '';
    for (const ab of abilities) {
      abilitiesHtml += `<option value="${ab}">${ab}</option>`;
    }

    let naturesHtml = '<option value="">-- None --</option>';
    for (const n of natures) {
      naturesHtml += `<option value="${n.name}">${n.name}</option>`;
    }

    let ballsHtml = '<option value="">-- None --</option>';
    for (const b of balls) {
      ballsHtml += `<option value="${b.name}">${b.name}</option>`;
    }

    const languages = ['English', 'Japanese', 'French', 'German', 'Italian', 'Spanish', 'Korean', 'ChineseS', 'ChineseT'];
    let langHtml = '';
    for (const l of languages) {
      langHtml += `<option value="${l}"${l === 'English' ? ' selected' : ''}>${l}</option>`;
    }

    const isZA = version === 'gen9a';

    // Floette-Eternal (670, form 5) cannot choose ball or nature in ZA
    const isLockedBall = isZA && pokemonDetail.id === 670 && form.formName === 'Eternal';

    const abilityFieldHtml = isZA ? '' : `
          <div class="config-field">
            <label for="cfg-ability">Ability</label>
            <select id="cfg-ability">${abilitiesHtml}</select>
          </div>`;

    let ballFieldHtml = '';
    let natureFieldHtml = '';
    if (isLockedBall) {
      ballFieldHtml = `
          <div class="config-field">
            <label>Ball</label>
            <div class="cd-btn" style="cursor:not-allowed;color:#ffffff;">ตัวพิเศษ เลือก Ball ไม่ได้</div>
            <select id="cfg-ball" style="display:none;"><option value=""></option></select>
          </div>`;
      natureFieldHtml = `
          <div class="config-field">
            <label>Nature</label>
            <div class="cd-btn" style="cursor:not-allowed;color:#ffffff;">ตัวพิเศษ เลือก Nature ไม่ได้</div>
            <select id="cfg-nature" style="display:none;"><option value=""></option></select>
          </div>`;
    } else {
      ballFieldHtml = `
          <div class="config-field">
            <label for="cfg-ball">Ball</label>
            <select id="cfg-ball">${ballsHtml}</select>
          </div>`;
      natureFieldHtml = `
          <div class="config-field">
            <label for="cfg-nature">Nature</label>
            <select id="cfg-nature">${naturesHtml}</select>
          </div>`;
    }

    const basicInfoHtml = `
      <div class="config-section">
        <div class="config-section__title">Basic Info</div>
        <div class="config-row">
          ${ballFieldHtml}
          ${natureFieldHtml}
        </div>
        <div class="config-row">
          ${abilityFieldHtml}
          <div class="config-field">
            <label for="cfg-language">Language</label>
            <select id="cfg-language">${langHtml}</select>
          </div>
        </div>
      </div>`;

    // --- IVs section (sliders) ---
    const statLabels = { hp: 'HP', atk: 'Attack', def: 'Defense', spa: 'Sp.Atk', spd: 'Sp.Def', spe: 'Speed' };
    const stats = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

    let ivSlidersHtml = '';
    for (const s of stats) {
      ivSlidersHtml += buildSliderRow(`cfg-iv-${s}`, statLabels[s], 0, 31, 0, 'iv-slider');
    }

    const ivsHtml = `
      <div class="config-section">
        <div class="config-section__title">IVs</div>
        ${ivSlidersHtml}
      </div>`;

    // --- EVs section (sliders) ---
    let evSlidersHtml = '';
    for (const s of stats) {
      evSlidersHtml += buildSliderRow(`cfg-ev-${s}`, statLabels[s], 0, 252, 0, 'ev-slider');
    }

    const evsHtml = `
      <div class="config-section">
        <div class="config-section__title">EVs <span class="stat-total" id="ev-total">Total: 0/510</span></div>
        ${evSlidersHtml}
      </div>`;

    // --- Moves (sorted A–Z for easier scanning) ---
    let movesOptionsHtml = '<option value="">-- None --</option>';
    const sortedMoves = [...moves].sort((a, b) => a.localeCompare(b));
    for (const m of sortedMoves) {
      movesOptionsHtml += `<option value="${m}">${m}</option>`;
    }

    const movesHtml = `
      <div class="config-section">
        <div class="config-section__title">Moves</div>
        <div class="moves-grid">
          <div class="config-field">
            <label for="cfg-move1">Move 1</label>
            <select id="cfg-move1">${movesOptionsHtml}</select>
          </div>
          <div class="config-field">
            <label for="cfg-move2">Move 2</label>
            <select id="cfg-move2">${movesOptionsHtml}</select>
          </div>
          <div class="config-field">
            <label for="cfg-move3">Move 3</label>
            <select id="cfg-move3">${movesOptionsHtml}</select>
          </div>
          <div class="config-field">
            <label for="cfg-move4">Move 4</label>
            <select id="cfg-move4">${movesOptionsHtml}</select>
          </div>
        </div>
      </div>`;

    // --- Trainer (collapsible) ---
    const trainerHtml = `
      <div class="config-section config-section--collapsible">
        <button type="button" class="config-section__toggle" id="trainer-toggle">
          <span class="config-section__title" style="margin-bottom:0;">Trainer</span>
          <span class="config-section__hint">ปกติไม่ต้องตั้ง bot จัดการให้อัตโนมัติ</span>
          <svg class="config-section__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <div class="config-section__content" id="trainer-content" style="display:none;">
          <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-top:12px;">
            <div class="nickname-pill">
              <input type="text" id="cfg-ot" placeholder="OT Name" maxlength="12" autocomplete="off" style="width:110px;">
            </div>
            <button type="button" class="icon-toggle icon-toggle--male" data-ot-gender="Male" aria-pressed="false" title="Male">
              <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M14.5 3a1 1 0 000 2h2.086l-3.51 3.51A6 6 0 1014.99 9.9L18.5 6.41V8.5a1 1 0 002 0v-4.5a1 1 0 00-1-1h-5zM10 10a4 4 0 110 8 4 4 0 010-8z"/></svg>
            </button>
            <button type="button" class="icon-toggle icon-toggle--female" data-ot-gender="Female" aria-pressed="false" title="Female">
              <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M12 2a6 6 0 00-1 11.917V16H9a1 1 0 000 2h2v2a1 1 0 002 0v-2h2a1 1 0 000-2h-2v-2.083A6 6 0 0012 2zm0 2a4 4 0 110 8 4 4 0 010-8z"/></svg>
            </button>
          </div>
          <select id="cfg-ot-gender" style="display:none;">
            <option value="">-- None --</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </div>
      </div>`;

    return `
      ${heroHtml}
      ${traitTogglesHtml}
      ${levelSliderHtml}
      ${friendshipHtml}
      ${basicInfoHtml}
      ${ivsHtml}
      ${evsHtml}
      ${movesHtml}
      ${trainerHtml}
    `;
  }

  // --- Batch list rendering ---
  function renderBatchList(batch, container) {
    if (batch.length === 0) {
      container.innerHTML = '<div class="batch-empty">ยังไม่มี Pokémon ใน batch</div>';
      return;
    }
    let html = '';
    for (let i = 0; i < batch.length; i++) {
      const item = batch[i];
      const spriteHtml = item._sprite
        ? `<img src="${item._sprite}" class="batch-item__sprite" width="36" height="36" alt="">`
        : '';
      const ballHtml = item._ballSlug
        ? `<img src="/icons/${item._ballSlug}.png" class="batch-item__ball" width="20" height="20" alt="">`
        : '';
      html += `
        <div class="batch-item">
          <div class="batch-item__info">
            ${spriteHtml}
            ${ballHtml}
            <span class="batch-item__name">${item.pokemonName}</span>
          </div>
          <button class="batch-item__remove" data-index="${i}" aria-label="Remove">&times;</button>
        </div>
      `;
    }
    container.innerHTML = html;
  }

  // --- Update EV total display (for slider-based EVs) ---
  function updateEvTotal() {
    const stats = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
    let total = 0;
    for (const s of stats) {
      const el = document.getElementById(`cfg-ev-${s}`);
      const val = el ? (parseInt(el.value) || 0) : 0;
      total += val;
    }
    const el = document.getElementById('ev-total');
    if (el) {
      el.textContent = `Total: ${total}/510`;
      el.className = total > 510 ? 'stat-total stat-total--over' : 'stat-total';
    }
  }

  return {
    showToast,
    openOverlay,
    closeOverlay,
    renderGrid,
    renderNextBatch,
    renderConfigBody,
    renderBatchList,
    updateEvTotal,
  };
})();

// Attach to window for app.js
window.UI = UI;
