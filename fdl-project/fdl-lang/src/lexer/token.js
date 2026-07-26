'use strict';

/**
 * Create a single token object.
 *
 * @param {string} type   one of the values from TokenType (see tokenType.js)
 * @param {*}      value  token payload: string for IDENT/RAW_BODY, number
 *                         for INT, null for punctuation/EOF
 * @param {number} line   1-indexed line number where the token starts
 * @param {number} col    1-indexed column number where the token starts
 */
function createToken(type, value, line, col) {
  return { type, value, line, col };
}

module.exports = { createToken };
