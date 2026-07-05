const { resolveGender } = require('../public/js/genderResolver');

describe('resolveGender', () => {
  test('genderless Pokemon returns empty string', () => {
    const genderInfo = { canBeMale: false, canBeFemale: false, isGenderless: true };
    expect(resolveGender(genderInfo, 'M')).toBe('');
    expect(resolveGender(genderInfo, 'F')).toBe('');
    expect(resolveGender(genderInfo, '')).toBe('');
  });

  test('female-only Pokemon returns "F"', () => {
    const genderInfo = { canBeMale: false, canBeFemale: true, isGenderless: false };
    expect(resolveGender(genderInfo, 'M')).toBe('F');
    expect(resolveGender(genderInfo, 'F')).toBe('F');
    expect(resolveGender(genderInfo, '')).toBe('F');
  });

  test('male-only Pokemon returns "M"', () => {
    const genderInfo = { canBeMale: true, canBeFemale: false, isGenderless: false };
    expect(resolveGender(genderInfo, 'M')).toBe('M');
    expect(resolveGender(genderInfo, 'F')).toBe('M');
    expect(resolveGender(genderInfo, '')).toBe('M');
  });

  test('dual-gender Pokemon returns the requested gender', () => {
    const genderInfo = { canBeMale: true, canBeFemale: true, isGenderless: false };
    expect(resolveGender(genderInfo, 'M')).toBe('M');
    expect(resolveGender(genderInfo, 'F')).toBe('F');
  });

  test('dual-gender Pokemon defaults to "M" when no gender requested', () => {
    const genderInfo = { canBeMale: true, canBeFemale: true, isGenderless: false };
    expect(resolveGender(genderInfo, '')).toBe('M');
    expect(resolveGender(genderInfo, undefined)).toBe('M');
    expect(resolveGender(genderInfo, null)).toBe('M');
  });
});
