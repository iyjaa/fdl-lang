'use strict';

const { CompileError } = require('../utils/errors');
const { VariableAllocator } = require('./variableAllocator');

/**
 * Maps fdl-lang variable names to their allocated grid cell.
 *
 * This is the only place that knows "this name means this cell" --
 * it wraps a VariableAllocator (which only hands out the *next*
 * free index) and adds the name -> cell bookkeeping plus the two
 * name-related compile errors from FDL-LANG-SPEC.md's error list:
 *   - redeclaration of an already-declared variable name
 *   - reference to an undeclared variable
 *
 * Anything else (self-copy in copy/move, walking the whole AST to
 * declare/check every variable) is validator.js's job, not this
 * file's -- this table is a dumb, focused lookup structure.
 */
class SymbolTable {
  constructor() {
    this.allocator = new VariableAllocator();
    this.table = new Map(); // name (string) -> { index, x, y }
  }

  /**
   * Register a new variable name and allocate its cell.
   * @param {string} name
   * @param {number} line  source line of the `var` declaration
   * @returns {{ index: number, x: number, y: number }} the allocated cell
   */
  declare(name, line) {
    if (this.table.has(name)) {
      throw new CompileError(
        'semantic',
        `redeclaration of variable '${name}' (already declared earlier in this file)`,
        line
      );
    }
    const cell = this.allocator.allocate(line);
    this.table.set(name, cell);
    return cell;
  }

  /**
   * Look up a previously declared variable's cell.
   * @param {string} name
   * @param {number} line  source line of the reference, for error reporting
   * @returns {{ index: number, x: number, y: number }}
   */
  lookup(name, line) {
    const cell = this.table.get(name);
    if (!cell) {
      throw new CompileError(
        'semantic',
        `reference to undeclared variable '${name}'`,
        line
      );
    }
    return cell;
  }

  /** True if `name` has already been declared. */
  has(name) {
    return this.table.has(name);
  }
}

module.exports = { SymbolTable };
