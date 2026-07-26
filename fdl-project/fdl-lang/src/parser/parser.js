'use strict';

const { TokenType } = require('../lexer/tokenType');
const { CompileError } = require('../utils/errors');
const { INT_MIN, INT_MAX, PTR_COORD_MIN, PTR_COORD_MAX } = require('./grammar');

/**
 * Recursive-descent parser for fdl-lang, following the EBNF grammar
 * in FDL-LANG-SPEC.md v0.3 ("Grammar summary").
 *
 * Scope of this parser: SYNTAX ONLY, plus literal-range checks that
 * don't need a symbol table (e.g. INT must be 0..=255, ptr.is
 * coordinates must be 0..=199). Checks that need to track declared
 * variables across statements -- undeclared variable, redeclaration,
 * copy/move x,x, grid exhausted -- are intentionally NOT done here;
 * those belong to the semantic stage (symbolTable.js / validator.js),
 * so the parser's errors stay purely about *form*, not *meaning*.
 *
 * AST node shapes produced (every node carries `line` for error
 * reporting):
 *   Program    { type:'Program', body:[Stmt] }
 *   VarDecl    { type:'VarDecl', name, line }
 *   SetStmt    { type:'SetStmt', name, value, line }
 *   AddStmt    { type:'AddStmt', name, value, line }
 *   SubStmt    { type:'SubStmt', name, value, line }
 *   CopyStmt   { type:'CopyStmt', dest, src, line }
 *   MoveStmt   { type:'MoveStmt', dest, src, line }
 *   WhileStmt  { type:'WhileStmt', name, body:[Stmt], line }
 *   ForStmt    { type:'ForStmt', name, value, body:[Stmt], line }
 *   PrintStmt  { type:'PrintStmt', name, count, line }   // count defaults to 1
 *   ReadStmt   { type:'ReadStmt', name, line }
 *   RawBlock   { type:'RawBlock', entry:PtrArg, exit:PtrArg, body, line }
 *   PtrArg     { kind:'this' } | { kind:'is', x, y }
 */
class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  // --- basic helpers ---

  peek(offset = 0) {
    return this.tokens[this.pos + offset];
  }

  atEnd() {
    return this.peek().type === TokenType.EOF;
  }

  advance() {
    const t = this.tokens[this.pos];
    if (t.type !== TokenType.EOF) this.pos++;
    return t;
  }

  check(type) {
    return this.peek().type === type;
  }

  /** Consume a token of type `type`, or throw a CompileError. */
  expect(type, contextMsg) {
    const t = this.peek();
    if (t.type !== type) {
      throw new CompileError(
        'parse',
        `expected ${type} ${contextMsg ? `(${contextMsg}) ` : ''}but got ${t.type}` +
          (t.value !== null && t.value !== undefined ? ` (${JSON.stringify(t.value)})` : ''),
        t.line, t.col
      );
    }
    return this.advance();
  }

  /** Validate a general INT literal's range (used by set/add/sub/for/print xN). */
  checkIntRange(token, min, max, label) {
    if (token.value < min || token.value > max) {
      throw new CompileError(
        'parse',
        `${label} must be in range ${min}..=${max}, got ${token.value}`,
        token.line, token.col
      );
    }
  }

  // --- entry point ---

  parseProgram() {
    const body = [];
    while (!this.atEnd()) {
      body.push(this.parseStatement());
    }
    return { type: 'Program', body };
  }

  parseStatement() {
    const t = this.peek();
    switch (t.type) {
      case TokenType.VAR: return this.parseVarDecl();
      case TokenType.SET: return this.parseSetStmt();
      case TokenType.ADD: return this.parseAddStmt();
      case TokenType.SUB: return this.parseSubStmt();
      case TokenType.COPY: return this.parseCopyStmt();
      case TokenType.MOVE: return this.parseMoveStmt();
      case TokenType.WHILE: return this.parseWhileStmt();
      case TokenType.FOR: return this.parseForStmt();
      case TokenType.PRINT: return this.parsePrintStmt();
      case TokenType.READ: return this.parseReadStmt();
      case TokenType.RAW: return this.parseRawBlock();
      default:
        throw new CompileError(
          'parse',
          `unexpected token ${t.type} at start of statement` +
            (t.value !== null && t.value !== undefined ? ` (${JSON.stringify(t.value)})` : ''),
          t.line, t.col
        );
    }
  }

  parseBlock() {
    this.expect(TokenType.LBRACE, 'block body');
    const body = [];
    while (!this.check(TokenType.RBRACE)) {
      if (this.atEnd()) {
        const t = this.peek();
        throw new CompileError('parse', "unclosed '{': reached end of file before matching '}'", t.line, t.col);
      }
      body.push(this.parseStatement());
    }
    this.expect(TokenType.RBRACE, 'end of block');
    return body;
  }

  // --- individual statements ---

  parseVarDecl() {
    const line = this.peek().line;
    this.advance(); // 'var'
    const name = this.expect(TokenType.IDENT, 'variable name').value;
    this.expect(TokenType.SEMI);
    return { type: 'VarDecl', name, line };
  }

  parseSetStmt() {
    const line = this.peek().line;
    this.advance(); // 'set'
    const name = this.expect(TokenType.IDENT, 'variable name').value;
    this.expect(TokenType.EQUALS);
    const valTok = this.expect(TokenType.INT, 'value');
    this.checkIntRange(valTok, INT_MIN, INT_MAX, 'set value');
    this.expect(TokenType.SEMI);
    return { type: 'SetStmt', name, value: valTok.value, line };
  }

  parseAddStmt() {
    const line = this.peek().line;
    this.advance(); // 'add'
    const name = this.expect(TokenType.IDENT, 'variable name').value;
    this.expect(TokenType.COMMA);
    const valTok = this.expect(TokenType.INT, 'amount');
    this.checkIntRange(valTok, INT_MIN, INT_MAX, 'add amount');
    this.expect(TokenType.SEMI);
    return { type: 'AddStmt', name, value: valTok.value, line };
  }

  parseSubStmt() {
    const line = this.peek().line;
    this.advance(); // 'sub'
    const name = this.expect(TokenType.IDENT, 'variable name').value;
    this.expect(TokenType.COMMA);
    const valTok = this.expect(TokenType.INT, 'amount');
    this.checkIntRange(valTok, INT_MIN, INT_MAX, 'sub amount');
    this.expect(TokenType.SEMI);
    return { type: 'SubStmt', name, value: valTok.value, line };
  }

  parseCopyStmt() {
    const line = this.peek().line;
    this.advance(); // 'copy'
    const dest = this.expect(TokenType.IDENT, 'destination variable').value;
    this.expect(TokenType.COMMA);
    const src = this.expect(TokenType.IDENT, 'source variable').value;
    this.expect(TokenType.SEMI);
    return { type: 'CopyStmt', dest, src, line };
  }

  parseMoveStmt() {
    const line = this.peek().line;
    this.advance(); // 'move'
    const dest = this.expect(TokenType.IDENT, 'destination variable').value;
    this.expect(TokenType.COMMA);
    const src = this.expect(TokenType.IDENT, 'source variable').value;
    this.expect(TokenType.SEMI);
    return { type: 'MoveStmt', dest, src, line };
  }

  parseWhileStmt() {
    const line = this.peek().line;
    this.advance(); // 'while'
    const name = this.expect(TokenType.IDENT, 'loop variable').value;
    const body = this.parseBlock();
    return { type: 'WhileStmt', name, body, line };
  }

  parseForStmt() {
    const line = this.peek().line;
    this.advance(); // 'for'
    const name = this.expect(TokenType.IDENT, 'loop variable').value;
    this.expect(TokenType.EQUALS);
    const valTok = this.expect(TokenType.INT, 'initial count');
    this.checkIntRange(valTok, INT_MIN, INT_MAX, 'for initial count');
    const body = this.parseBlock();
    return { type: 'ForStmt', name, value: valTok.value, body, line };
  }

  parsePrintStmt() {
    const line = this.peek().line;
    this.advance(); // 'print'
    const name = this.expect(TokenType.IDENT, 'variable name').value;

    let count = 1; // "print var" alone is sugar for "print var x1" (§7)
    if (this.check(TokenType.IDENT)) {
      // The lexer tokenizes "x3" as a single plain IDENT (see lexer.js);
      // the parser is what recognizes the x<digit+> pattern in this
      // position as a repetition suffix.
      const t = this.peek();
      const m = /^x([0-9]+)$/.exec(t.value);
      if (!m) {
        throw new CompileError(
          'parse',
          `expected ';' or a repetition suffix like 'x3' after print target, got identifier ${JSON.stringify(t.value)}`,
          t.line, t.col
        );
      }
      this.advance();
      count = parseInt(m[1], 10);
      if (count < INT_MIN || count > INT_MAX) {
        throw new CompileError(
          'parse',
          `print repetition count must be in range ${INT_MIN}..=${INT_MAX}, got ${count}`,
          t.line, t.col
        );
      }
    }
    this.expect(TokenType.SEMI);
    return { type: 'PrintStmt', name, count, line };
  }

  parseReadStmt() {
    const line = this.peek().line;
    this.advance(); // 'read'
    const name = this.expect(TokenType.IDENT, 'variable name').value;
    this.expect(TokenType.SEMI);
    return { type: 'ReadStmt', name, line };
  }

  /** ptr_arg := "ptr.this" "(" ")" | "ptr.is" "(" INT "," INT ")" */
  parsePtrArg() {
    const identTok = this.expect(TokenType.IDENT, "'ptr'");
    if (identTok.value !== 'ptr') {
      throw new CompileError(
        'parse',
        `expected 'ptr' in raw() pointer argument, got identifier ${JSON.stringify(identTok.value)}`,
        identTok.line, identTok.col
      );
    }
    this.expect(TokenType.DOT);
    const kindTok = this.expect(TokenType.IDENT, "'this' or 'is'");

    if (kindTok.value === 'this') {
      this.expect(TokenType.LPAREN);
      this.expect(TokenType.RPAREN);
      return { kind: 'this' };
    }
    if (kindTok.value === 'is') {
      this.expect(TokenType.LPAREN);
      const xTok = this.expect(TokenType.INT, 'x coordinate');
      this.checkIntRange(xTok, PTR_COORD_MIN, PTR_COORD_MAX, 'ptr.is x coordinate');
      this.expect(TokenType.COMMA);
      const yTok = this.expect(TokenType.INT, 'y coordinate');
      this.checkIntRange(yTok, PTR_COORD_MIN, PTR_COORD_MAX, 'ptr.is y coordinate');
      this.expect(TokenType.RPAREN);
      return { kind: 'is', x: xTok.value, y: yTok.value };
    }
    throw new CompileError(
      'parse',
      `expected 'ptr.this' or 'ptr.is' but got 'ptr.${kindTok.value}'`,
      kindTok.line, kindTok.col
    );
  }

  /** raw_block := "raw" "(" ptr_arg "," ptr_arg ")" "{" RAW_BODY "}" */
  parseRawBlock() {
    const line = this.peek().line;
    this.advance(); // 'raw'
    this.expect(TokenType.LPAREN, 'raw() entry/exit arguments');
    const entry = this.parsePtrArg();
    this.expect(TokenType.COMMA, 'raw() requires exactly two ptr arguments (entry, exit)');
    const exit = this.parsePtrArg();
    this.expect(TokenType.RPAREN);
    this.expect(TokenType.LBRACE, 'raw block body');
    // The lexer already captured the block's content verbatim as a
    // single RAW_BODY token (see lexer.js) -- we just consume it here
    // as-is, without parsing its contents.
    const bodyTok = this.expect(TokenType.RAW_BODY, 'verbatim eso-fdl body');
    this.expect(TokenType.RBRACE, "closing '}' of raw block");
    return { type: 'RawBlock', entry, exit, body: bodyTok.value, line };
  }
}

function parse(tokens) {
  const parser = new Parser(tokens);
  return parser.parseProgram();
}

module.exports = { parse, Parser };
