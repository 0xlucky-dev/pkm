/**
 * Pokemon Generator - Validation Module
 * Validates moves, level, IVs, EVs, and other Pokemon attributes.
 *
 * IV/EV limits are universal constants (same for every Pokemon).
 * StatBlock keys: hp, atk, def, spa, spd, spe
 */

const STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

const IV_MIN = 0;
const IV_MAX = 31;
const EV_MIN = 0;
const EV_MAX = 252;
const EV_TOTAL_MAX = 510;

/**
 * Validates a move selection.
 * @param {string[]} moves - Array of selected move names
 * @param {string[]} validMoveList - Array of valid move names for the selected form
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateMoves(moves, validMoveList) {
  const errors = [];

  if (!Array.isArray(moves)) {
    errors.push('Moves must be an array');
    return { valid: false, errors };
  }

  if (moves.length > 4) {
    errors.push(`Too many moves selected (${moves.length}), maximum is 4`);
  }

  const seen = new Set();
  for (const move of moves) {
    if (seen.has(move)) {
      errors.push(`Duplicate move: ${move}`);
    }
    seen.add(move);
  }

  for (const move of moves) {
    if (!validMoveList.includes(move)) {
      errors.push(`Invalid move: ${move} is not in the valid move list`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates a level value.
 * @param {number} level - The level to validate
 * @param {number} [levelMax=100] - Maximum allowed level (from the form's LevelMax)
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateLevel(level, levelMax) {
  if (levelMax === undefined || levelMax === null) {
    levelMax = 100;
  }

  const errors = [];

  if (!Number.isInteger(level)) {
    errors.push('Level must be an integer');
    return { valid: false, errors };
  }

  if (level < 1) {
    errors.push(`Level must be at least 1, got ${level}`);
  }

  if (level > levelMax) {
    errors.push(`Level must be at most ${levelMax}, got ${level}`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates an IV StatBlock.
 * Each of six stats (hp, atk, def, spa, spd, spe) must be an integer 0-31.
 *
 * @param {Object} ivs - StatBlock with keys hp, atk, def, spa, spd, spe
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateIVs(ivs) {
  const errors = [];

  for (const stat of STATS) {
    const value = ivs[stat];
    if (!Number.isInteger(value)) {
      errors.push(`${stat} IV must be an integer`);
    } else if (value < IV_MIN || value > IV_MAX) {
      errors.push(`${stat} IV must be ${IV_MIN}-${IV_MAX}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates an EV StatBlock.
 * Each of six stats must be an integer 0-252, and the total must be <= 510.
 * Returns descriptive error messages identifying violated constraints.
 * Does NOT mutate the input object.
 *
 * @param {Object} evs - StatBlock with keys hp, atk, def, spa, spd, spe
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateEVs(evs) {
  const errors = [];

  for (const stat of STATS) {
    const value = evs[stat];
    if (!Number.isInteger(value)) {
      errors.push(`${stat} EV must be an integer`);
    } else if (value < EV_MIN || value > EV_MAX) {
      errors.push(`${stat} EV must be ${EV_MIN}-${EV_MAX}`);
    }
  }

  const total = STATS.reduce((sum, s) => sum + (Number.isInteger(evs[s]) ? evs[s] : 0), 0);
  if (total > EV_TOTAL_MAX) {
    errors.push(`Total EVs (${total}) exceed maximum of ${EV_TOTAL_MAX}`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates and clamps a single EV stat change, ensuring per-stat (0-252) and
 * total (510) constraints are respected. Does NOT mutate the input object.
 *
 * @param {Object} evs - Current StatBlock { hp, atk, def, spa, spd, spe }
 * @param {string} changedStat - One of 'hp', 'atk', 'def', 'spa', 'spd', 'spe'
 * @param {number} newValue - The desired new value for changedStat
 * @returns {Object} A new StatBlock with the adjusted value
 */
function validateAndClampEVs(evs, changedStat, newValue) {
  const result = { ...evs };
  const clamped = Math.min(252, Math.max(0, newValue));
  result[changedStat] = clamped;

  const otherTotal = STATS.reduce(
    (sum, s) => sum + (s === changedStat ? 0 : result[s]),
    0
  );
  const total = otherTotal + clamped;

  if (total > EV_TOTAL_MAX) {
    result[changedStat] = Math.max(0, EV_TOTAL_MAX - otherTotal);
  }

  return result;
}

// Export for Node.js (Jest) and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    validateMoves,
    validateLevel,
    validateIVs,
    validateEVs,
    validateAndClampEVs,
    STATS,
    IV_MIN,
    IV_MAX,
    EV_MIN,
    EV_MAX,
    EV_TOTAL_MAX,
  };
}
if (typeof window !== 'undefined') {
  window.validateMoves = validateMoves;
  window.validateLevel = validateLevel;
  window.validateIVs = validateIVs;
  window.validateEVs = validateEVs;
  window.validateAndClampEVs = validateAndClampEVs;
}
