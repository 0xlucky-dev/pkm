/**
 * Command Formatter module — produces %h format command strings
 * for the Discord bot from Pokemon configuration objects.
 *
 * Canonical line order:
 * %h Name (Gender) → Level → Shiny → .Version → Ball → Ability
 * → .Nature + Nature → Friendship → EVs → IVs → OT → OTGender → Language → moves
 *
 * NO held item (no @ item), NO Tera Type line.
 */

// Stat order and abbreviations used for EV/IV spreads
const STAT_ORDER = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
const STAT_ABBREV = { hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe' };

/**
 * Format an EV spread: only NON-ZERO stats, in stat order, joined by " / ",
 * each as "{value} {Abbrev}". Returns "" when all stats are zero.
 * e.g. { atk: 252, spa: 6, spd: 252 } -> "252 Atk / 6 SpA / 252 SpD"
 * @param {object} evs - StatBlock with keys hp, atk, def, spa, spd, spe
 * @returns {string}
 */
function formatEVs(evs) {
  return STAT_ORDER
    .filter((s) => evs[s] > 0)
    .map((s) => `${evs[s]} ${STAT_ABBREV[s]}`)
    .join(' / ');
}

/**
 * Format an IV spread: ALL six stats, in stat order, joined by " / ".
 * e.g. -> "31 HP / 31 Atk / 31 Def / 31 SpA / 31 SpD / 31 Spe"
 * @param {object} ivs - StatBlock with keys hp, atk, def, spa, spd, spe
 * @returns {string}
 */
function formatIVs(ivs) {
  return STAT_ORDER.map((s) => `${ivs[s]} ${STAT_ABBREV[s]}`).join(' / ');
}

/**
 * Generates the %h format block for a single Pokemon (the only output format).
 * @param {object} config - PokemonConfig object
 * @param {boolean} [includePrefix=true] - When true, first line starts with "%h ".
 *   Batch mode passes false for every block after the first.
 * @returns {string} block with no trailing newline
 */
function formatPercentH(config, includePrefix = true) {
  const lines = [];

  // Line 1: [%h ][Nickname(PokemonName) | PokemonName][ (Gender)] — NO held item segment
  let pokeName = config.nickname
    ? `${config.nickname}(${config.pokemonName})`
    : config.pokemonName;

  // If formName is set (non-default form), append it: e.g. "Floette-Eternal"
  if (config.formName) {
    const baseName = config.nickname ? config.pokemonName : pokeName;
    pokeName = config.nickname
      ? `${config.nickname}(${baseName}-${config.formName})`
      : `${pokeName}-${config.formName}`;
  }

  let line1 = '';
  const prefixMap = { '50': '%hsv ', '45': '%hswsh ', '47': '%hla ' };
  const prefix = prefixMap[config.sourceVersion] || '%h ';
  line1 = includePrefix ? `${prefix}${pokeName}` : pokeName;
  if (config.gender) line1 += ` (${config.gender})`;
  lines.push(line1);

  // Level — always
  lines.push(`Level: ${config.level}`);

  // Shiny — only when shiny (never print "Shiny: No")
  if (config.shiny) lines.push(`Shiny: Yes`);

  // Alpha — only when alpha is true
  if (config.alpha) lines.push('Alpha: Yes');

  // Source Version — only when set
  if (config.sourceVersion) lines.push(`.Version=${config.sourceVersion}`);

  // Ball — only when set
  if (config.ball) lines.push(`Ball: ${config.ball}`);

  // Ability — only when set
  if (config.ability) lines.push(`Ability: ${config.ability}`);

  // Nature — only when set: TWO lines
  if (config.nature) {
    lines.push(`.Nature=${config.nature}`);
    lines.push(`${config.nature} Nature`);
  }

  // Friendship — only when > 0
  if (config.friendship && parseInt(config.friendship) > 0) {
    lines.push(`Friendship: ${config.friendship}`);
  }

  // EVs — only when at least one EV is non-zero
  const evSpread = formatEVs(config.evs);
  if (evSpread) lines.push(`EVs: ${evSpread}`);

  // IVs — only when at least one IV is non-zero
  // If Alpha, force all IVs to 31 in output regardless of slider values
  const ivs = config.ivs;
  let outputIvs = ivs;
  if (config.alpha) {
    outputIvs = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };
  }
  const allIVsZero = STAT_ORDER.every(s => outputIvs[s] === 0);
  if (!allIVsZero) {
    lines.push(`IVs: ${formatIVs(outputIvs)}`);
  }

  // OT — only when set
  if (config.trainer && config.trainer.ot) lines.push(`OT: ${config.trainer.ot}`);

  // OTGender — only when set
  if (config.trainer && config.trainer.otGender) {
    lines.push(`OTGender: ${config.trainer.otGender}`);
  }

  // Language — always
  lines.push(`Language: ${config.language}`);

  // Moves — each selected move on its own line, hyphen prefix, NO space
  for (const move of config.moves) {
    if (move) lines.push(`-${move}`);
  }

  return lines.join('\n');
}

/**
 * Generates a batch %h command for multiple Pokemon. Only the FIRST block
 * carries the "%h " prefix; every subsequent block starts directly with the
 * Pokemon name. Blocks are concatenated in order.
 * @param {object[]} configs - one or more PokemonConfig objects, in order
 * @returns {string} concatenated blocks, no trailing newline
 */
function formatBatch(configs) {
  return configs
    .map((cfg, i) => formatPercentH(cfg, i === 0))
    .join('\n\n');
}

// Export for Node.js (Jest) and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    STAT_ORDER,
    STAT_ABBREV,
    formatEVs,
    formatIVs,
    formatPercentH,
    formatBatch,
  };
}
if (typeof window !== 'undefined') {
  window.formatPercentH = formatPercentH;
  window.formatBatch = formatBatch;
  window.formatEVs = formatEVs;
  window.formatIVs = formatIVs;
  window.STAT_ORDER = STAT_ORDER;
  window.STAT_ABBREV = STAT_ABBREV;
}
