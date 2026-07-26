'use strict';

/**
 * Pure pointer-navigation math for fdl-lang (FDL-LANG-SPEC.md §2).
 *
 * This module does NOT emit any instruction text (no "rgt"/"lft"/
 * encoding strings) -- it only computes, given a starting and target
 * coordinate, which direction to move on each axis and how far. The
 * actual instruction-string formatting (§6 encoding, and the §2
 * distance-1 exception) is codegen/navigation.js's job, layered on
 * top of these pure numbers so each piece can be tested in isolation.
 *
 * Determinism rule (§2): move X axis first, then Y axis. For each
 * axis, compute the signed distance mod 200 in both directions and
 * take whichever is strictly shorter; on an exact tie (distance =
 * 100), move right (for X) or down (for Y).
 */

const GRID_SIZE = 200;

/**
 * Compute the shortest move on a single axis (mod GRID_SIZE).
 * @param {number} from current coordinate on this axis (0..199)
 * @param {number} to   target coordinate on this axis (0..199)
 * @param {string} posDir direction name for the "increasing" direction
 *                         (e.g. 'rgt' for X, 'dwn' for Y)
 * @param {string} negDir direction name for the "decreasing" direction
 *                         (e.g. 'lft' for X, 'up' for Y)
 * @returns {{ direction: string, distance: number } | null}
 *          null if `from === to` (no movement needed on this axis)
 */
function shortestAxisMove(from, to, posDir, negDir) {
  const distPos = ((to - from) % GRID_SIZE + GRID_SIZE) % GRID_SIZE; // moving in posDir
  const distNeg = ((from - to) % GRID_SIZE + GRID_SIZE) % GRID_SIZE; // moving in negDir

  if (distPos === 0) return null; // already aligned on this axis

  // Exact tie (distance = 100 each way): §2 says prefer the
  // "positive" direction (right for X, down for Y).
  if (distPos <= distNeg) {
    return { direction: posDir, distance: distPos };
  }
  return { direction: negDir, distance: distNeg };
}

/**
 * Compute the full navigation plan from (px, py) to (tx, ty),
 * following §2's "X axis first, then Y axis" rule.
 *
 * @returns {Array<{ direction: 'rgt'|'lft'|'dwn'|'up', distance: number }>}
 *          0, 1, or 2 moves (skips any axis where distance is 0).
 */
function planNavigation(px, py, tx, ty) {
  const moves = [];

  const xMove = shortestAxisMove(px, tx, 'rgt', 'lft');
  if (xMove) moves.push(xMove);

  const yMove = shortestAxisMove(py, ty, 'dwn', 'up');
  if (yMove) moves.push(yMove);

  return moves;
}

module.exports = { planNavigation, shortestAxisMove, GRID_SIZE };
