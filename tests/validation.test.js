const { validateIVs, validateEVs, STATS } = require('../public/js/validation');

describe('validateIVs', () => {
  test('accepts valid IVs (all zero)', () => {
    const ivs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    const result = validateIVs(ivs);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('accepts valid IVs (all max 31)', () => {
    const ivs = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };
    const result = validateIVs(ivs);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('accepts mixed valid IVs', () => {
    const ivs = { hp: 15, atk: 0, def: 31, spa: 20, spd: 5, spe: 28 };
    const result = validateIVs(ivs);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('rejects IV above 31', () => {
    const ivs = { hp: 32, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    const result = validateIVs(ivs);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0]).toContain('hp');
  });

  test('rejects negative IV', () => {
    const ivs = { hp: 0, atk: -1, def: 0, spa: 0, spd: 0, spe: 0 };
    const result = validateIVs(ivs);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('atk');
  });

  test('rejects non-integer IV', () => {
    const ivs = { hp: 0, atk: 0, def: 15.5, spa: 0, spd: 0, spe: 0 };
    const result = validateIVs(ivs);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('def');
    expect(result.errors[0]).toContain('integer');
  });

  test('reports multiple errors', () => {
    const ivs = { hp: 32, atk: -1, def: 0, spa: 50, spd: 0, spe: 0 };
    const result = validateIVs(ivs);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(3);
  });

  test('does not mutate input', () => {
    const ivs = { hp: 50, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    const copy = { ...ivs };
    validateIVs(ivs);
    expect(ivs).toEqual(copy);
  });
});

describe('validateEVs', () => {
  test('accepts valid EVs (all zero)', () => {
    const evs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    const result = validateEVs(evs);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('accepts valid EVs at max individual (252) with total <= 510', () => {
    const evs = { hp: 252, atk: 252, def: 6, spa: 0, spd: 0, spe: 0 };
    const result = validateEVs(evs);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('accepts EVs at exact total 510', () => {
    const evs = { hp: 252, atk: 252, def: 4, spa: 0, spd: 0, spe: 2 };
    const result = validateEVs(evs);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('rejects EV above 252', () => {
    const evs = { hp: 253, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    const result = validateEVs(evs);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0]).toContain('hp');
    expect(result.errors[0]).toContain('0-252');
  });

  test('rejects negative EV', () => {
    const evs = { hp: 0, atk: 0, def: -5, spa: 0, spd: 0, spe: 0 };
    const result = validateEVs(evs);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('def');
  });

  test('rejects total exceeding 510', () => {
    const evs = { hp: 252, atk: 252, def: 252, spa: 0, spd: 0, spe: 0 };
    const result = validateEVs(evs);
    expect(result.valid).toBe(false);
    const totalError = result.errors.find(e => e.includes('Total'));
    expect(totalError).toContain('510');
  });

  test('reports both per-stat and total errors', () => {
    const evs = { hp: 253, atk: 252, def: 252, spa: 0, spd: 0, spe: 0 };
    const result = validateEVs(evs);
    expect(result.valid).toBe(false);
    // Should have per-stat error for hp AND total error
    expect(result.errors.some(e => e.includes('hp'))).toBe(true);
    expect(result.errors.some(e => e.includes('Total'))).toBe(true);
  });

  test('rejects non-integer EV', () => {
    const evs = { hp: 0, atk: 0, def: 0, spa: 12.5, spd: 0, spe: 0 };
    const result = validateEVs(evs);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('spa');
    expect(result.errors[0]).toContain('integer');
  });

  test('does not mutate input', () => {
    const evs = { hp: 300, atk: 252, def: 252, spa: 0, spd: 0, spe: 0 };
    const copy = { ...evs };
    validateEVs(evs);
    expect(evs).toEqual(copy);
  });

  test('returns descriptive error messages', () => {
    const evs = { hp: 260, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    const result = validateEVs(evs);
    expect(result.valid).toBe(false);
    // Error message should identify the stat and the valid range
    expect(result.errors[0]).toMatch(/hp.*EV.*0-252/i);
  });
});
