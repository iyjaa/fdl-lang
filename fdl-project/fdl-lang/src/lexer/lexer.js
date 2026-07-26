'use strict';

const { TokenType, KEYWORDS } = require('./tokenType');
const { createToken } = require('./token');
const { CompileError } = require('../utils/errors');

/**
 * Lexer for fdl-lang (see FDL-LANG-SPEC.md §0 - Lexical structure).
 *
 * Minor deviation from the spec text:
 *   Spec §0 says "a line whose first non-whitespace character is #
 *   is discarded entirely" -- taken literally that only allows
 *   standalone comment lines. But the worked example in §7
 *   (`set bang = 33;   # '!' is ASCII 33`) uses a trailing comment.
 *   This lexer follows the more useful behavior: `#` discards the
 *   rest of the line no matter where it appears, not just at the
 *   start of a line.
 *
 * Special handling of raw(...) { ... } (§8):
 *   The content inside a raw block's { } is RAW eso-fdl (using
 *   characters like '"', "'" that are not part of fdl-lang's own
 *   grammar). This lexer is stateful: once the `raw` keyword is
 *   seen, it tracks the paren depth of the raw(...) arguments. Once
 *   those arguments are closed and the next '{' is found, the lexer
 *   switches into "raw capture" mode: every character up to the
 *   matching '}' is taken verbatim as a single RAW_BODY token.
 */

function isDigit(ch) {
  return ch >= '0' && ch <= '9';
}

function isIdentStart(ch) {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_';
}

function isIdentPart(ch) {
  return isIdentStart(ch) || isDigit(ch);
}

/**
 * Tokenize fdl-lang source into an array of tokens.
 * Each token: { type, value, line, col } (see token.js)
 */
function tokenize(source) {
  const tokens = [];
  let i = 0;
  let line = 1;
  let col = 1;
  const n = source.length;

  // State machine for recognizing when we're inside raw(...) { <body> }
  // rawState: null | 'inArgs' | 'awaitingBrace' | 'capturingBody'
  let rawState = null;
  let rawParenDepth = 0;

  function peek(offset = 0) {
    return source[i + offset];
  }

  function advance() {
    const ch = source[i];
    i++;
    if (ch === '\n') {
      line++;
      col = 1;
    } else {
      col++;
    }
    return ch;
  }

  while (i < n) {
    const ch = peek();

    // --- Raw-body capture mode ---
    if (rawState === 'capturingBody') {
      const startLine = line;
      const startCol = col;
      let body = '';
      while (i < n && peek() !== '}') {
        body += advance();
      }
      if (i >= n) {
        throw new CompileError(
          'lex',
          "unterminated raw(...) { } block: reached end of file before matching '}'",
          startLine, startCol
        );
      }
      tokens.push(createToken(TokenType.RAW_BODY, body.trim(), startLine, startCol));
      rawState = null;
      continue; // the closing '}' is tokenized normally as RBRACE next
    }

    // Whitespace -- not significant (§0).
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
      advance();
      continue;
    }

    // Comment: '#' discards the rest of the line.
    if (ch === '#') {
      while (i < n && peek() !== '\n') advance();
      continue;
    }

    const startLine = line;
    const startCol = col;

    // Integer literal (multi-digit, not one digit at a time!)
    if (isDigit(ch)) {
      let numStr = '';
      while (i < n && isDigit(peek())) {
        numStr += advance();
      }
      tokens.push(createToken(TokenType.INT, parseInt(numStr, 10), startLine, startCol));
      continue;
    }

    // Identifier or keyword
    if (isIdentStart(ch)) {
      let name = '';
      while (i < n && isIdentPart(peek())) {
        name += advance();
      }
      if (KEYWORDS.has(name)) {
        tokens.push(createToken(name.toUpperCase(), name, startLine, startCol));
        if (name === 'raw') {
          rawState = 'inArgs';
          rawParenDepth = 0;
        }
      } else {
        tokens.push(createToken(TokenType.IDENT, name, startLine, startCol));
      }
      continue;
    }

    // Single-character punctuation
    switch (ch) {
      case ';':
        advance();
        tokens.push(createToken(TokenType.SEMI, ';', startLine, startCol));
        continue;
      case '{': {
        advance();
        tokens.push(createToken(TokenType.LBRACE, '{', startLine, startCol));
        if (rawState === 'awaitingBrace') rawState = 'capturingBody';
        continue;
      }
      case '}':
        advance();
        tokens.push(createToken(TokenType.RBRACE, '}', startLine, startCol));
        continue;
      case '(': {
        advance();
        tokens.push(createToken(TokenType.LPAREN, '(', startLine, startCol));
        if (rawState === 'inArgs') rawParenDepth++;
        continue;
      }
      case ')': {
        advance();
        tokens.push(createToken(TokenType.RPAREN, ')', startLine, startCol));
        if (rawState === 'inArgs') {
          rawParenDepth--;
          if (rawParenDepth === 0) rawState = 'awaitingBrace';
        }
        continue;
      }
      case ',':
        advance();
        tokens.push(createToken(TokenType.COMMA, ',', startLine, startCol));
        continue;
      case '=':
        advance();
        tokens.push(createToken(TokenType.EQUALS, '=', startLine, startCol));
        continue;
      case '.':
        advance();
        tokens.push(createToken(TokenType.DOT, '.', startLine, startCol));
        continue;
      default:
        throw new CompileError('lex', `unexpected character '${ch}'`, startLine, startCol);
    }
  }

  if (rawState !== null) {
    throw new CompileError('lex', 'unterminated raw(...) { } block: reached end of file', line, col);
  }

  tokens.push(createToken(TokenType.EOF, null, line, col));
  return tokens;
}

module.exports = { tokenize };

// Run directly: `node lexer.js program.fdl-lang` to see the resulting
// token stream (handy for debugging the lexer itself before the
// parser exists).
if (require.main === module) {
  const fs = require('fs');
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('usage: node lexer.js <file.fdl-lang>');
    process.exit(1);
  }
  const source = fs.readFileSync(filePath, 'utf8');
  try {
    const tokens = tokenize(source);
    for (const t of tokens) {
      const val = t.value === null ? '' : JSON.stringify(t.value);
      console.log(`${String(t.line).padStart(3)}:${String(t.col).padEnd(3)} ${t.type.padEnd(9)} ${val}`);
    }
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
