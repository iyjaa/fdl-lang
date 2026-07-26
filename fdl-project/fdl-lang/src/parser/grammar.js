'use strict';

/**
 * Numeric limits derived from FDL-LANG-SPEC.md.
 *
 * Kept separate from parser.js so that if a future spec revision
 * changes any of these bounds, there is exactly one place to edit.
 */

// General integer literals (var values, add/sub amounts, for's
// initial count, print's repetition count) must fit in a single
// eso-fdl cell: 0..=255.
const INT_MIN = 0;
const INT_MAX = 255;

// Coordinates passed to ptr.is(x, y) inside raw(...) must address a
// valid cell in the 200x200 grid: 0..=199 (not 0..=255).
const PTR_COORD_MIN = 0;
const PTR_COORD_MAX = 199;

module.exports = { INT_MIN, INT_MAX, PTR_COORD_MIN, PTR_COORD_MAX };
