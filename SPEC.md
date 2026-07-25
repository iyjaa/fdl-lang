# eso-fdl — Language Specification (v1.0, frozen)

This document freezes the esoteric core of FDL. Nothing here changes
without bumping the version number. Ergonomic features (variables,
labels, absolute goto, etc.) belong in **fdl-lang**, a separate
dialect that compiles down to this spec — not in eso-fdl itself.

## Memory model

- A 200×200 grid of unsigned bytes (0–255), all initialized to 0.
- A single pointer `(px, py)`, starting at `(0, 0)`.
- Movement wraps around on all four edges (modulo 200).

## Instructions

| Keyword | Effect |
|---|---|
| `inc` | Add to the current cell (wraps mod 256) |
| `dec` | Subtract from the current cell (wraps mod 256) |
| `rgt` | Move pointer right (x += n, wraps mod 200) |
| `lft` | Move pointer left (x -= n, wraps mod 200) |
| `dwn` | Move pointer down (y += n, wraps mod 200) |
| `up`  | Move pointer up (y -= n, wraps mod 200) |
| `=`   | Print the current cell as a character, n times |
| `==`  | Read one character from stdin into the current cell, n times |
| `/+`  | Loop start: if current cell is 0, jump past the matching `-/` |
| `-/`  | Loop end: if current cell is non-zero, jump back to the matching `/+` |

`n` above is 1 unless a repetition suffix is given.

## Repetition notation

Every instruction (except `/+` and `-/`) may be followed directly
(no space) by a repetition suffix:

- `"N` — repeat 2×N times
- `'N` — repeat (2×N − 1) times

Suffixes chain by alternating sign, e.g. `inc"15-'1` means
`(2×15) - (2×1 - 1) = 30 - 1 = 29` repetitions.

## Tokenization rule

Tokens are split on whitespace **only**. This means:

- Every instruction, including its repetition suffix, must be
  followed by whitespace before the next instruction begins.
- `inc'1 =` is two instructions. `inc'1=` is a **syntax error** —
  the interpreter will report an unexpected character rather than
  silently reinterpreting it.

## Comments

A line whose first non-whitespace character is `#` is discarded
entirely.

## Errors

The reference interpreter reports the source line number for:
- unknown instructions
- malformed repetition notation
- unmatched `/+` / `-/`
- programs exceeding the token limit

## Limits

- Grid: 200 × 200 cells
- Max tokens per program: 200,000
- Max token length: 64 characters

## What's intentionally NOT here

No variables, no named labels, no absolute jumps, no cell-to-cell
arithmetic beyond what loops can express. This is by design — see
fdl-lang for a dialect that adds these while compiling back down to
this instruction set.
