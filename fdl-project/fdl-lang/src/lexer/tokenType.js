'use strict';

/**
 * All token types recognized by fdl-lang (see FDL-LANG-SPEC.md §0 and
 * the grammar EBNF).
 *
 * Note: `ptr`, `this`, `is` used inside raw(ptr.this()/ptr.is(x,y))
 * are deliberately NOT their own keywords -- they remain plain IDENT
 * tokens. Their special meaning is only interpreted by the parser,
 * not the lexer.
 */
const TokenType = Object.freeze({
  // keywords
  VAR: 'VAR', SET: 'SET', ADD: 'ADD', SUB: 'SUB',
  COPY: 'COPY', MOVE: 'MOVE', WHILE: 'WHILE', FOR: 'FOR',
  PRINT: 'PRINT', READ: 'READ', RAW: 'RAW',

  // literals & identifiers
  IDENT: 'IDENT',
  INT: 'INT',

  // punctuation
  SEMI: 'SEMI',       // ;
  LBRACE: 'LBRACE',   // {
  RBRACE: 'RBRACE',   // }
  LPAREN: 'LPAREN',   // (
  RPAREN: 'RPAREN',   // )
  COMMA: 'COMMA',     // ,
  EQUALS: 'EQUALS',   // =
  DOT: 'DOT',         // .

  // verbatim eso-fdl content inside raw(...) { ... } (§8)
  RAW_BODY: 'RAW_BODY',

  EOF: 'EOF',
});

const KEYWORDS = new Set([
  'var', 'set', 'add', 'sub', 'copy', 'move',
  'while', 'for', 'print', 'read', 'raw',
]);

module.exports = { TokenType, KEYWORDS };
