const {
  STAT_ORDER,
  STAT_ABBREV,
  formatEVs,
  formatIVs,
  formatPercentH,
  formatBatch,
} = require('../public/js/commandFormatter');

describe('commandFormatter', () => {
  describe('STAT_ORDER and STAT_ABBREV', () => {
    test('STAT_ORDER has six entries in correct order', () => {
      expect(STAT_ORDER).toEqual(['hp', 'atk', 'def', 'spa', 'spd', 'spe']);
    });

    test('STAT_ABBREV maps correctly', () => {
      expect(STAT_ABBREV).toEqual({
        hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe',
      });
    });
  });

  describe('formatEVs', () => {
    test('returns empty string when all EVs are zero', () => {
      expect(formatEVs({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 })).toBe('');
    });

    test('formats only non-zero stats in order', () => {
      expect(formatEVs({ hp: 0, atk: 252, def: 0, spa: 6, spd: 252, spe: 0 }))
        .toBe('252 Atk / 6 SpA / 252 SpD');
    });

    test('formats single non-zero stat', () => {
      expect(formatEVs({ hp: 252, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }))
        .toBe('252 HP');
    });

    test('formats all six stats when all non-zero', () => {
      expect(formatEVs({ hp: 4, atk: 4, def: 4, spa: 4, spd: 4, spe: 4 }))
        .toBe('4 HP / 4 Atk / 4 Def / 4 SpA / 4 SpD / 4 Spe');
    });
  });

  describe('formatIVs', () => {
    test('always formats all six stats', () => {
      expect(formatIVs({ hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }))
        .toBe('31 HP / 31 Atk / 31 Def / 31 SpA / 31 SpD / 31 Spe');
    });

    test('formats mixed IV values', () => {
      expect(formatIVs({ hp: 31, atk: 0, def: 31, spa: 31, spd: 0, spe: 31 }))
        .toBe('31 HP / 0 Atk / 31 Def / 31 SpA / 0 SpD / 31 Spe');
    });

    test('formats all zeros', () => {
      expect(formatIVs({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }))
        .toBe('0 HP / 0 Atk / 0 Def / 0 SpA / 0 SpD / 0 Spe');
    });
  });

  describe('formatPercentH', () => {
    const baseConfig = {
      pokemonName: 'Charizard',
      gender: '',
      level: 100,
      shiny: false,
      sourceVersion: '',
      ball: '',
      ability: '',
      nature: '',
      friendship: null,
      evs: { hp: 0, atk: 0, def: 0, spa: 252, spd: 4, spe: 252 },
      ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
      trainer: { ot: '', otGender: '' },
      language: 'English',
      moves: ['Flamethrower', 'Air Slash'],
    };

    test('produces basic output with prefix', () => {
      const result = formatPercentH(baseConfig);
      const lines = result.split('\n');
      expect(lines[0]).toBe('%h Charizard');
      expect(lines[1]).toBe('Level: 100');
      expect(lines).toContain('EVs: 252 SpA / 4 SpD / 252 Spe');
      expect(lines).toContain('IVs: 31 HP / 31 Atk / 31 Def / 31 SpA / 31 SpD / 31 Spe');
      expect(lines).toContain('Language: English');
      expect(lines).toContain('-Flamethrower');
      expect(lines).toContain('-Air Slash');
    });

    test('no trailing newline', () => {
      const result = formatPercentH(baseConfig);
      expect(result.endsWith('\n')).toBe(false);
    });

    test('includePrefix=false omits %h prefix', () => {
      const result = formatPercentH(baseConfig, false);
      const lines = result.split('\n');
      expect(lines[0]).toBe('Charizard');
    });

    test('gender is appended when set', () => {
      const config = { ...baseConfig, gender: 'F' };
      const result = formatPercentH(config);
      expect(result.split('\n')[0]).toBe('%h Charizard (F)');
    });

    test('shiny line appears only when shiny is true', () => {
      const configShiny = { ...baseConfig, shiny: true };
      expect(formatPercentH(configShiny)).toContain('Shiny: Yes');
      expect(formatPercentH(baseConfig)).not.toContain('Shiny');
    });

    test('sourceVersion line only when set', () => {
      const config = { ...baseConfig, sourceVersion: 'SV' };
      expect(formatPercentH(config)).toContain('.Version=SV');
      expect(formatPercentH(baseConfig)).not.toContain('.Version');
    });

    test('ball line only when set', () => {
      const config = { ...baseConfig, ball: 'Master Ball' };
      expect(formatPercentH(config)).toContain('Ball: Master Ball');
      expect(formatPercentH(baseConfig)).not.toContain('Ball:');
    });

    test('ability line only when set', () => {
      const config = { ...baseConfig, ability: 'Solar Power' };
      expect(formatPercentH(config)).toContain('Ability: Solar Power');
      expect(formatPercentH(baseConfig)).not.toContain('Ability:');
    });

    test('nature produces two lines when set', () => {
      const config = { ...baseConfig, nature: 'Timid' };
      const result = formatPercentH(config);
      expect(result).toContain('.Nature=Timid');
      expect(result).toContain('Timid Nature');
      // .Nature= must come before Nature line
      const lines = result.split('\n');
      const dotNatureIdx = lines.indexOf('.Nature=Timid');
      const natureIdx = lines.indexOf('Timid Nature');
      expect(dotNatureIdx).toBeLessThan(natureIdx);
      expect(natureIdx - dotNatureIdx).toBe(1);
    });

    test('friendship line only when set', () => {
      const config = { ...baseConfig, friendship: 255 };
      expect(formatPercentH(config)).toContain('Friendship: 255');
      expect(formatPercentH(baseConfig)).not.toContain('Friendship:');
    });

    test('friendship 0 is still included (falsy but set)', () => {
      const config = { ...baseConfig, friendship: 0 };
      expect(formatPercentH(config)).toContain('Friendship: 0');
    });

    test('EVs line omitted when all zero', () => {
      const config = { ...baseConfig, evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 } };
      expect(formatPercentH(config)).not.toContain('EVs:');
    });

    test('IVs line always present', () => {
      expect(formatPercentH(baseConfig)).toContain('IVs:');
    });

    test('OT and OTGender only when set', () => {
      const config = { ...baseConfig, trainer: { ot: 'Ash', otGender: 'Male' } };
      expect(formatPercentH(config)).toContain('OT: Ash');
      expect(formatPercentH(config)).toContain('OTGender: Male');
      expect(formatPercentH(baseConfig)).not.toContain('OT:');
      expect(formatPercentH(baseConfig)).not.toContain('OTGender:');
    });

    test('moves use dash with no space', () => {
      const result = formatPercentH(baseConfig);
      expect(result).toContain('-Flamethrower');
      expect(result).toContain('-Air Slash');
      expect(result).not.toContain('- Flamethrower');
    });

    test('empty moves are skipped', () => {
      const config = { ...baseConfig, moves: ['Flamethrower', '', 'Air Slash', ''] };
      const result = formatPercentH(config);
      expect(result).toContain('-Flamethrower');
      expect(result).toContain('-Air Slash');
      // Should not have empty move lines
      const lines = result.split('\n');
      const moveLines = lines.filter((l) => l.startsWith('-'));
      expect(moveLines).toHaveLength(2);
    });

    test('canonical line order is maintained', () => {
      const fullConfig = {
        pokemonName: 'Gardevoir',
        gender: 'F',
        level: 50,
        shiny: true,
        sourceVersion: 'SV',
        ball: 'Love Ball',
        ability: 'Trace',
        nature: 'Modest',
        friendship: 200,
        evs: { hp: 252, atk: 0, def: 0, spa: 252, spd: 4, spe: 0 },
        ivs: { hp: 31, atk: 0, def: 31, spa: 31, spd: 31, spe: 31 },
        trainer: { ot: 'Dawn', otGender: 'Female' },
        language: 'English',
        moves: ['Moonblast', 'Psychic', 'Calm Mind', 'Mystical Fire'],
      };

      const lines = formatPercentH(fullConfig).split('\n');
      expect(lines[0]).toBe('%h Gardevoir (F)');
      expect(lines[1]).toBe('Level: 50');
      expect(lines[2]).toBe('Shiny: Yes');
      expect(lines[3]).toBe('.Version=SV');
      expect(lines[4]).toBe('Ball: Love Ball');
      expect(lines[5]).toBe('Ability: Trace');
      expect(lines[6]).toBe('.Nature=Modest');
      expect(lines[7]).toBe('Modest Nature');
      expect(lines[8]).toBe('Friendship: 200');
      expect(lines[9]).toBe('EVs: 252 HP / 252 SpA / 4 SpD');
      expect(lines[10]).toBe('IVs: 31 HP / 0 Atk / 31 Def / 31 SpA / 31 SpD / 31 Spe');
      expect(lines[11]).toBe('OT: Dawn');
      expect(lines[12]).toBe('OTGender: Female');
      expect(lines[13]).toBe('Language: English');
      expect(lines[14]).toBe('-Moonblast');
      expect(lines[15]).toBe('-Psychic');
      expect(lines[16]).toBe('-Calm Mind');
      expect(lines[17]).toBe('-Mystical Fire');
      expect(lines).toHaveLength(18);
    });

    test('no @ item segment in output', () => {
      const result = formatPercentH(baseConfig);
      expect(result).not.toContain('@');
    });

    test('no Tera Type line', () => {
      const result = formatPercentH(baseConfig);
      expect(result).not.toContain('Tera Type');
      expect(result).not.toContain('Tera');
    });
  });

  describe('formatBatch', () => {
    const config1 = {
      pokemonName: 'Pikachu',
      gender: 'M',
      level: 50,
      shiny: false,
      sourceVersion: '',
      ball: '',
      ability: 'Static',
      nature: '',
      friendship: null,
      evs: { hp: 0, atk: 0, def: 0, spa: 252, spd: 4, spe: 252 },
      ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
      trainer: { ot: '', otGender: '' },
      language: 'English',
      moves: ['Thunderbolt', 'Volt Tackle'],
    };

    const config2 = {
      pokemonName: 'Eevee',
      gender: 'F',
      level: 5,
      shiny: true,
      sourceVersion: '',
      ball: '',
      ability: 'Adaptability',
      nature: 'Jolly',
      friendship: null,
      evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
      ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
      trainer: { ot: '', otGender: '' },
      language: 'Japanese',
      moves: ['Quick Attack'],
    };

    test('first block has %h prefix, rest do not', () => {
      const result = formatBatch([config1, config2]);
      const lines = result.split('\n');
      expect(lines[0]).toBe('%h Pikachu (M)');
      // Find the Eevee line
      const eeveeLine = lines.find((l) => l.includes('Eevee'));
      expect(eeveeLine).toBe('Eevee (F)');
      expect(eeveeLine).not.toContain('%h');
    });

    test('single config batch still has prefix', () => {
      const result = formatBatch([config1]);
      expect(result.startsWith('%h ')).toBe(true);
    });

    test('no trailing newline', () => {
      const result = formatBatch([config1, config2]);
      expect(result.endsWith('\n')).toBe(false);
    });

    test('blocks are joined by newline', () => {
      const result = formatBatch([config1, config2]);
      // The result should contain both Pokemon
      expect(result).toContain('Pikachu');
      expect(result).toContain('Eevee');
    });
  });
});
