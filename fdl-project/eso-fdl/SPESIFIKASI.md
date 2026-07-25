# eso-fdl — Language Specification (v1.0.1)

This document freezes the esoteric core of FDL. Nothing here changes
without bumping the version number. Ergonomic features (variables,
labels, absolute goto, etc.) belong in **fdl-lang**, a separate
dialect that compiles down to this spec — not in eso-fdl itself.

> **v1.0.1 note:** this revision adds five clarifications of existing
> reference-interpreter behavior that were undocumented or ambiguous
> in v1.0. No behavior has changed — see `ERRATA.md` for the full
> rationale and empirical verification of each point. Changes are
> marked inline with **[v1.0.1]**.

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

**[v1.0.1] Case sensitivity:** instruction matching is
case-insensitive. Tokens are normalized to lowercase before being
compared against the keyword table above and against `/+` / `-/`.
`INC`, `Inc`, `RGT`, etc. are all valid and equivalent to their
lowercase form.

**[v1.0.1] `==` at EOF:** if stdin has already reached EOF when `==`
executes, the current cell is set to `0` for each remaining
repetition (not left unchanged, not an error).

## Repetition notation

Every instruction (except `/+` and `-/`) may be followed directly
(no space) by a repetition suffix:

- `"N` — repeat 2×N times
- `'N` — repeat (2×N − 1) times

**[v1.0.1] Chaining rule (corrected):** suffixes are chained left to
right by concatenating terms separated by a literal `-` character —
one `-` between *every* consecutive pair of terms, so an N-term chain
requires exactly N−1 dashes. The first term is always positive;
**every term after the first is negative**, regardless of its
position in the chain (this is *not* alternating +/−/+/−, contrary to
earlier phrasing). The final result is wrapped modulo 256 if negative
(256 is added repeatedly until the value is ≥ 0).

Example: `inc"15-'1` means `(2×15) - (2×1 - 1) = 30 - 1 = 29`
repetitions.

Example (3 terms): `inc"40-'2-"3` means
`(2×40) - (2×2-1) - (2×3) = 80 - 3 - 6 = 71` repetitions — note the
third term is subtracted, not added, and note the mandatory `-`
between the 2nd and 3rd term as well as between the 1st and 2nd.

## Tokenization rule

Tokens are split on whitespace **only**. This means:

- Every instruction, including its repetition suffix, must be
  followed by whitespace before the next instruction begins.
- `inc'1 =` is two instructions. `inc'1=` is a **syntax error** —
  the interpreter will report an unexpected character rather than
  silently reinterpreting it.
- **[v1.0.1]** Within a chained repetition suffix, a literal `-` is
  likewise mandatory between every pair of terms (see Repetition
  notation above). `inc"5'2` and `inc"40-'2"3` (missing one of the
  required dashes) are both syntax errors, not silently
  reinterpreted.

## Comments

A line whose first non-whitespace character is `#` is discarded
entirely.

## Errors

The reference interpreter reports the source line number for:
- unknown instructions
- malformed repetition notation
- unmatched `/+` / `-/`
- programs exceeding the token limit

**[v1.0.1] Exception — token length is NOT one of these:** a token
exceeding the 64-character limit (below) is silently truncated to its
first 64 characters and processed as-is; no error is reported for
this specific condition, despite the general principle above.
Implementations aiming for reference-compatibility must replicate
this silent truncation rather than erroring on it.

## Limits

- Grid: 200 × 200 cells
- Max tokens per program: 200,000
- Max token length: 64 characters (see Errors section above regarding
  truncation behavior when this is exceeded)

## What's intentionally NOT here

No variables, no named labels, no absolute jumps, no cell-to-cell
arithmetic beyond what loops can express. This is by design — see
fdl-lang for a dialect that adds these while compiling back down to
this instruction set.

## Changelog

- **v1.0.1** — clarified case-insensitivity, corrected the suffix
  chaining sign rule and mandatory-dash requirement, documented `==`
  behavior at EOF, and documented silent token-length truncation.
  No interpreter behavior changed; see `ERRATA.md` for verification.
- **v1.0** — initial frozen spec.
