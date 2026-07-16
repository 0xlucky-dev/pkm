/**
 * Resolves a valid gender value based on the Pokemon's species gender constraints.
 *
 * @param {Object} genderInfo - Species gender availability
 * @param {boolean} genderInfo.canBeMale - Whether the species can be male
 * @param {boolean} genderInfo.canBeFemale - Whether the species can be female
 * @param {boolean} genderInfo.isGenderless - Whether the species is genderless
 * @param {string} requestedGender - The user-requested gender ("M", "F", or "")
 * @returns {string} The resolved gender: "M", "F", or ""
 */
function resolveGender(genderInfo, requestedGender) {
  if (genderInfo.isGenderless) return '';
  if (!genderInfo.canBeMale) return 'F';
  if (!genderInfo.canBeFemale) return 'M';
  // If user hasn't picked, return empty = no gender in output
  return requestedGender || '';
}

// Export for Node.js (Jest) and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { resolveGender };
}
if (typeof window !== 'undefined') {
  window.resolveGender = resolveGender;
}
