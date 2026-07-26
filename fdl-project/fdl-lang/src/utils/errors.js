'use strict';

/**
 * Unified error class for every fdlc stage (lex, parse, semantic,
 * codegen). Keeps the message format consistent so the CLI only needs
 * one kind of try/catch to cover all stages.
 */
class CompileError extends Error {
  /**
   * @param {string} stage   stage name, e.g. 'lex' | 'parse' | 'semantic'
   * @param {string} message human-readable message
   * @param {number} line    line number (1-indexed)
   * @param {number} [col]   column number (1-indexed), optional
   */
  constructor(stage, message, line, col) {
    const where = col != null ? `${line}:${col}` : `${line}`;
    super(`fdlc ${stage} error at line ${where}: ${message}`);
    this.name = 'CompileError';
    this.stage = stage;
    this.line = line;
    this.col = col;
  }
}

module.exports = { CompileError };
