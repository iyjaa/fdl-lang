'use strict';

const { CompileError } = require('../utils/errors');

/**
 * Cell allocation for `var` declarations (FDL-LANG-SPEC.md §1).
 *
 * The grid is 200x200 = 40,000 cells, numbered:
 *   index = y * 200 + x
 * i.e. (0,0)=0, (1,0)=1, ... (199,0)=199, (0,1)=200, ...
 *
 * `var` declarations consume indices in strictly increasing order,
 * starting at 0. The LAST cell, index 39999 = (199,199), is
 * permanently reserved as the shared temp cell used by `copy` (§4)
 * and is never assignable via `var`. That leaves 39,999 cells
 * available for user variables.
 *
 * This module does ONLY the index <-> coordinate bookkeeping and the
 * "grid exhausted" limit check. It deliberately does NOT track
 * name -> index mappings or duplicate-name checks -- that's
 * symbolTable.js's job. Keeping this file narrow means the counting
 * logic can be tested in isolation from name-lookup logic.
 */

const GRID_SIZE = 200; // both width and height
const TOTAL_CELLS = GRID_SIZE * GRID_SIZE; // 40000
const RESERVED_TEMP_INDEX = TOTAL_CELLS - 1; // 39999 = (199, 199)
const MAX_USER_VARS = RESERVED_TEMP_INDEX; // 39999

/** Convert a flat grid index into { x, y } coordinates. */
function indexToCoords(index) {
  return { x: index % GRID_SIZE, y: Math.floor(index / GRID_SIZE) };
}

/** Convert { x, y } coordinates into a flat grid index. */
function coordsToIndex(x, y) {
  return y * GRID_SIZE + x;
}

/** Coordinates of the cell reserved for `copy`'s temp cell (§1, §4). */
const RESERVED_TEMP_CELL = indexToCoords(RESERVED_TEMP_INDEX); // { x: 199, y: 199 }

class VariableAllocator {
  constructor() {
    this.nextIndex = 0;
  }

  /**
   * Allocate the next free cell for a new `var` declaration.
   * @param {number} line source line of the `var` declaration, for
   *                      error reporting if the grid is exhausted.
   * @returns {{ index: number, x: number, y: number }}
   */
  allocate(line) {
    if (this.nextIndex >= MAX_USER_VARS) {
      throw new CompileError(
        'semantic',
        `grid exhausted: cannot declare more than ${MAX_USER_VARS} variables ` +
          `(index ${RESERVED_TEMP_INDEX} = (${RESERVED_TEMP_CELL.x}, ${RESERVED_TEMP_CELL.y}) ` +
          `is permanently reserved for the 'copy' temp cell, see §1)`,
        line
      );
    }
    const index = this.nextIndex;
    this.nextIndex++;
    const { x, y } = indexToCoords(index);
    return { index, x, y };
  }
}

module.exports = {
  VariableAllocator,
  indexToCoords,
  coordsToIndex,
  GRID_SIZE,
  TOTAL_CELLS,
  RESERVED_TEMP_INDEX,
  RESERVED_TEMP_CELL,
  MAX_USER_VARS,
};
