const fc = require('fast-check');

describe('test tooling setup', () => {
  test('jest runs correctly', () => {
    expect(1 + 1).toBe(2);
  });

  test('fast-check is available', () => {
    fc.assert(
      fc.property(fc.integer(), (n) => {
        return typeof n === 'number';
      })
    );
  });
});
