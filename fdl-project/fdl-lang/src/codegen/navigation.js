'use strict';

const { planNavigation } = require('../semantic/pointerTracker');
const { encodeRepeat } = require('./encoder');

/**
 * Turns a navigation plan (from pointerTracker.js) into actual eso-fdl
 * instruction strings, applying:
 *   - §6's general "/'  repetition encoding, for distance >= 2
 *   - §2's special case: distance == 1 emits a BARE instruction
 *     (e.g. "rgt", not "rgt'1") -- an unsuffixed instruction implicitly
 *     means "repeat once". This exception applies ONLY to navigation
 *     instructions (rgt/lft/up/dwn), never to inc/dec/=/etc, which
 *     always use the full §6 encoding even when N == 1.
 */

/**
 * Build the instruction strings needed to move the pointer from
 * (fromX, fromY) to (toX, toY).
 *
 * @returns {string[]} 0, 1, or 2 instruction strings, e.g.
 *   []                    if already at the target
 *   ["rgt"]               distance 1 (bare, no suffix -- §2 exception)
 *   ["rgt\"4"]            distance 8 (normal §6 encoding)
 *   ["rgt", "dwn'2"]      two axes, one bare + one encoded
 */
function buildNavigationInstructions(fromX, fromY, toX, toY) {
  const moves = planNavigation(fromX, fromY, toX, toY);
  return moves.map(({ direction, distance }) => {
    if (distance === 1) return direction; // §2 exception: bare instruction
    return direction + encodeRepeat(distance);
  });
}

module.exports = { buildNavigationInstructions };
