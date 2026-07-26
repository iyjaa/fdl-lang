'use strict';

const { CompileError } = require('../utils/errors');
const { SymbolTable } = require('./symbolTable');

/**
 * Walks the AST produced by parser.js and:
 *   - declares every `var` (via SymbolTable.declare, which also
 *     allocates its cell and rejects redeclaration)
 *   - resolves every variable *reference* (via SymbolTable.lookup,
 *     which rejects references to undeclared variables)
 *   - rejects `copy x, x` / `move x, x` (self-copy/move, §4)
 *
 * This does NOT track pointer position or navigation -- that's
 * pointerTracker.js's job, run as a separate pass during codegen.
 * This pass is purely about "does every name resolve to a real,
 * distinct variable", independent of where the pointer physically
 * ends up.
 *
 * @param {object} program the Program AST node from parser.js
 * @returns {SymbolTable} the fully populated symbol table, reused
 *                        later by codegen to resolve names to cells.
 */
function validate(program) {
  const table = new SymbolTable();
  validateStatements(program.body, table);
  return table;
}

function validateStatements(statements, table) {
  for (const stmt of statements) {
    validateStatement(stmt, table);
  }
}

function validateStatement(stmt, table) {
  switch (stmt.type) {
    case 'VarDecl':
      table.declare(stmt.name, stmt.line);
      return;

    case 'SetStmt':
    case 'AddStmt':
    case 'SubStmt':
    case 'PrintStmt':
    case 'ReadStmt':
      table.lookup(stmt.name, stmt.line);
      return;

    case 'CopyStmt':
      table.lookup(stmt.dest, stmt.line);
      table.lookup(stmt.src, stmt.line);
      if (stmt.dest === stmt.src) {
        throw new CompileError(
          'semantic',
          `'copy ${stmt.dest}, ${stmt.src}' is invalid: source and destination must be distinct variables (self-copy, see §4)`,
          stmt.line
        );
      }
      return;

    case 'MoveStmt':
      table.lookup(stmt.dest, stmt.line);
      table.lookup(stmt.src, stmt.line);
      if (stmt.dest === stmt.src) {
        throw new CompileError(
          'semantic',
          `'move ${stmt.dest}, ${stmt.src}' is invalid: source and destination must be distinct variables (self-move, see §4)`,
          stmt.line
        );
      }
      return;

    case 'WhileStmt':
      table.lookup(stmt.name, stmt.line);
      validateStatements(stmt.body, table);
      return;

    case 'ForStmt':
      table.lookup(stmt.name, stmt.line);
      validateStatements(stmt.body, table);
      return;

    case 'RawBlock':
      // No variable references to check: the block body is verbatim
      // eso-fdl, and its entry/exit arguments are grid coordinates,
      // not variable names.
      return;

    default:
      throw new CompileError(
        'semantic',
        `internal error: validator has no case for AST node type '${stmt.type}'`,
        stmt.line
      );
  }
}

module.exports = { validate };
