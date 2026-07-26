'use strict';

/**
 * Repetition-count encoding for eso-fdl's "/'  suffix notation
 * (FDL-LANG-SPEC.md §6). Used by add/sub's count, set's final inc,
 * print xN, and (for distances >= 2 only -- see the §2 exception
 * handled separately in navigation.js) navigation distances.
 *
 * Rule:
 *   N == 0            -> the instruction is omitted entirely (no-op)
 *   N > 0 and N even   -> suffix "(N/2)
 *   N > 0 and N odd    -> suffix '((N+1)/2)
 *
 * This always produces a single suffix term (never a chain) for any
 * N in 0..=255. fdlc never emits chained suffixes of its own accord
 * -- chains are exclusively a raw(...) construct written by hand.
 */

const MIN_N = 0;
const MAX_N = 255;

/**
 * Encode a repeat count as an eso-fdl suffix string.
 * @param {number} n repeat count, must be an integer in 0..=255
 * @returns {string} e.g. '"4', "'17", or '' if n === 0 (meaning:
 *                   the caller should omit the instruction entirely)
 */
function encodeRepeat(n) {
  if (!Number.isInteger(n) || n < MIN_N || n > MAX_N) {
    // A caller passing an out-of-range N is an internal bug -- the
    // parser (grammar.js's INT_MIN/INT_MAX) should already have
    // rejected any such value from the user's source, so this is not
    // a CompileError (no source line to blame), just a plain
    // programming-error guard.
    throw new RangeError(`encodeRepeat: n must be an integer in ${MIN_N}..=${MAX_N}, got ${n}`);
  }
  if (n === 0) return '';
  if (n % 2 === 0) return `"${n / 2}`;
  return `'${(n + 1) / 2}`;
}

/**
 * Build a full instruction token from a keyword and repeat count,
 * e.g. buildInstruction('inc', 33) -> 'inc\'17'.
 * Returns null when n === 0, signaling that per §6 the instruction
 * should be omitted from the output entirely (not emitted as a
 * bare, suffix-less keyword).
 *
 * @param {string} keyword eso-fdl instruction keyword, e.g. 'inc', 'dec', '='
 * @param {number} n repeat count, 0..=255
 * @returns {string|null}
 */
function buildInstruction(keyword, n) {
  if (n === 0) return null;
  return keyword + encodeRepeat(n);
}

module.exports = { encodeRepeat, buildInstruction, MIN_N, MAX_N };
