# fdl-lang — Language Specification (draft v0.3)

fdl-lang is a higher-level dialect that **compiles down to eso-fdl
v1.0.1**. Every fdl-lang program produces a valid eso-fdl token
stream; the eso-fdl interpreter never needs to change. fdl-lang
exists purely to make writing eso-fdl programs less painful — manual
cell bookkeeping, manual pointer navigation, manual zeroing loops.

## Design principle

Nothing in fdl-lang is "magic." Every construct below has a fixed,
**deterministic** expansion into eso-fdl instructions: given the same
source file, `fdlc` must always emit byte-identical output. If you're
ever unsure what a line compiles to, you can always drop to
`raw(...) { ... }` and write eso-fdl by hand.

---

## 0. Lexical structure

- Statements end with `;`. Blocks are delimited by `{` and `}` and
  are **not** followed by a `;`.
- Identifiers: `[a-zA-Z_][a-zA-Z0-9_]*`, case-sensitive (unlike
  eso-fdl keywords, which are case-insensitive at the eso-fdl layer —
  fdl-lang identifiers are a compile-time-only concept and are not
  case-folded).
- Integer literals are decimal, unsigned, range **0–255** inclusive
  (the range of a single eso-fdl cell). A literal outside this range
  is a compile error.
- Comments: a line whose first non-whitespace character is `#` is
  discarded entirely — same rule as eso-fdl. There is no block-comment
  form.
- Whitespace (including newlines) is insignificant between tokens,
  except inside string-like constructs, of which fdl-lang currently
  has none.

## 1. Named variables (replaces manual cell bookkeeping)

```c
var row;
var col;
var intensity;
```

Each `var` reserves the next free cell in the grid. Cells are
numbered `index = y*200 + x` and allocated in **strictly increasing
index order**, starting at `index = 0` (i.e. `(0,0)`, then `(1,0)`,
… `(199,0)`, then `(0,1)`, `(1,1)`, …). The compiler maintains a
name→index map built in declaration order; redeclaring an existing
name is a compile error.

The **last cell of the grid, index 39999 = (199,199), is permanently
reserved** as the shared temp cell used by `copy` (see §4) and is
never assignable via `var`. This leaves 39,999 cells available for
user variables; declaring a 40,000th `var` is a compile error
("grid exhausted").

## 2. Automatic navigation

Any statement referencing a variable automatically emits the
`rgt`/`lft`/`up`/`dwn` instructions needed to move the pointer from
its current compile-time-tracked position to that variable's cell.
You never manage the pointer manually.

**Determinism rule (navigation order):** the compiler always moves
the **X axis first, then the Y axis**. For each axis, it computes the
signed distance mod 200 in both directions and takes whichever is
strictly shorter; on an exact tie (distance = 100), it moves **right**
(for X) or **down** (for Y). This guarantees that two variables at the
same pair of coordinates always produce the identical instruction
sequence regardless of program history.

Formally, to move from `(px, py)` to `(tx, ty)`:
```
dx_rgt = (tx - px) mod 200
dx_lft = (px - tx) mod 200
if dx_rgt <= dx_lft: emit  rgt<encoding of dx_rgt>   (see §6)
else:                emit  lft<encoding of dx_lft>
# analogous for dwn/up on the Y axis, evaluated after X is settled
```
If `dx_rgt == 0` (already aligned on that axis), no instruction for
that axis is emitted at all.

**Special case — distance of exactly 1:** navigation instructions
never carry a suffix when the computed distance is 1. `fdlc` emits
the bare instruction (`rgt`, `lft`, `up`, or `dwn`) with no `"`/`'`
suffix at all; an unsuffixed instruction implicitly means "repeat
once." This is an exception specific to navigation instructions —
it does **not** apply to `add`/`sub`/`set`/`print xN`, which always
use the full §6 encoding even when `N == 1`.

## 3. Setting values (deterministic, not history-dependent)

```c
set intensity = 8;
```

Compiles to, in order: (1) navigate to `intensity` (§2), (2) zero the
cell with the standard clearing loop `/+ dec -/`, (3) `inc` to the
target value (§6 encoding). Because it always zeroes first, `set`
never depends on what the cell held before — this matters since
eso-fdl cells persist across the whole program. Runtime cost of the
zeroing loop is proportional to whatever value the cell happened to
hold (worst case 255 iterations); this is a known, accepted cost of
determinism over performance.

```c
add intensity, 8;      # inc by N, no zeroing
sub col, 1;            # dec by N, no zeroing
```

`add`/`sub` never zero first — they navigate, then directly emit
`inc`/`dec` with the encoded repeat count (full §6 encoding, no
exception for `N == 1` — the §2 navigation exception applies only to
navigation instructions, not to `inc`/`dec`).

## 4. Cell-to-cell operations

```c
copy dest, src;   # dest = src; src is left unchanged (uses the reserved temp cell, §1)
move dest, src;   # dest = src; src becomes 0 (cheaper: no temp cell)
```

`move dest, src` compiles to: zero `dest`; then, alternating between
`src` and `dest` each iteration, `while src { dest++; src--; }` (in
raw terms: navigate to `src`, `/+`, `dec`, navigate to `dest`, `inc`,
navigate back to `src`, `-/`).

`copy dest, src` compiles to the same pattern but routes the drained
value through the reserved temp cell and then restores `src` from the
temp cell afterward:
```
zero dest; zero temp;
while (src) { dest++; temp++; src--; }
while (temp) { src++; temp--; }
```
This costs one full extra pass over the temp cell compared to `move`,
which is the reason `move` is offered as the cheaper alternative when
the source is known to be disposable.

`dest` and `src` must be distinct declared variables; `copy x, x` or
`move x, x` is a compile error (self-copy is meaningless and the
naive expansion above would zero the cell).

## 5. Loops

```c
while row {
    ...
}
```

Compiles to: navigate to `row`, `/+`, `<body>`, navigate to `row`
again, `-/`. The re-navigation before `-/` is mandatory and automatic
— the compiler always returns to the loop variable's cell after the
body runs, **regardless of where the body left the pointer**, because
`-/` tests whatever cell the pointer currently occupies. This holds
even when the body contains a `raw(...) { }` block (§8): the exit
`ptr` argument of that block tells `fdlc` where the pointer ends up,
and the loop's mandatory re-navigation back to `row` is computed from
that stated exit position exactly as it would be from any other
statement.

```c
for row = 32 {
    ...
}
```

Sugar for:
```c
set row = 32;
while row {
    ...
    sub row, 1;
}
```
The decrement is appended as the **last** statement of the expanded
body, after the user's own body statements, so a `for` loop always
counts down to zero and terminates after exactly the initial value's
number of iterations (assuming the body doesn't itself modify `row`).

## 6. Repetition encoding (used by every N-repeat construct above)

Whenever fdl-lang needs to emit "repeat instruction X exactly N
times" (for `add`/`sub`'s count, `set`'s final `inc`, and `print ...
xN` below), it uses this fixed encoding against eso-fdl's `"`/`'`
suffix notation:

- `N == 0`: the instruction is omitted entirely (no-op).
- `N > 0` and `N` even: emit suffix `"(N/2)`.
- `N > 0` and `N` odd: emit suffix `'((N+1)/2)`.

This always produces a single suffix term (never a chain) for any
`N` in `0..=255`, keeping compiler output compact and simple to
verify by hand. `fdlc` never emits chained suffixes (`"a-'b-...`) of
its own accord — chains are exclusively a `raw(...) { }` construct.

**Note:** navigation instructions (`rgt`/`lft`/`up`/`dwn`) also use
this encoding for any distance `N >= 2`, but distance `N == 1` is a
special case handled by §2 (bare instruction, no suffix) rather than
by this rule.

## 7. I/O

```c
print intensity;            # = (print once)
print intensity x3;         # emits `=` encoded for 3 reps via §6 -> '2
read ch;                    # ==
```

`print var xN` navigates to `var`, then emits `=` with the §6
encoding of `N`. `print var` alone is sugar for `print var x1`.
`read ch` navigates to `ch`, then emits `==` (always exactly one
repetition — `read ch xN` is not supported in this draft).

## 8. Escape hatch

```c
raw(ptr.this(), ptr.is(1, 0)) {
    inc"40 = rgt
}
```

Anything inside the `{ }` of a `raw(...)` block is copied to the
output token stream **verbatim** (still eso-fdl syntax, still
whitespace-delimited). `fdlc` does not parse, validate, or track
pointer/variable state through the contents of a `raw` block — it is
emitted as-is, and any syntax errors inside it are only caught later,
by the eso-fdl interpreter itself at runtime.

Because `fdlc` cannot see into the block body, it cannot know on its
own where the pointer is before or after the block runs. `raw(...)`
therefore takes **two mandatory arguments**, `raw(<entry>, <exit>) {
...}`, each of which is one of:

- `ptr.this()` — "the pointer is at whatever position the compiler
  is currently tracking; do not move it and do not change what is
  tracked." Used as the *entry* argument this means no navigation
  instruction is emitted before the block. Used as the *exit*
  argument this means the block is declared to leave the pointer
  exactly where it was on entry.
- `ptr.is(x, y)` — "the pointer's position is `(x, y)`." Used as the
  *entry* argument, `fdlc` first emits ordinary navigation (§2) from
  its currently tracked position to `(x, y)`, then emits the block's
  verbatim body. Used as the *exit* argument, `fdlc` simply records
  `(x, y)` as the new tracked pointer position for every statement
  that follows the block.

Example — entry uses the tracked position as-is, exit declares that
the block moved the pointer one cell right:

```c
raw(ptr.this(), ptr.is(1, 0)) {
    inc"40 = rgt
}
```

`fdlc` does **not** verify either argument against the actual
behavior of the verbatim body — it trusts both, exactly as written,
and resumes compile-time tracking (§2) from the stated *exit*
position for every statement after the block. Getting the *exit*
argument wrong will not be caught at compile time; it will silently
desynchronize `fdlc`'s pointer tracking from the true runtime pointer,
surfacing later as incorrect navigation in subsequent statements. The
programmer is responsible for keeping both arguments accurate.

## 9. Comments

Same as eso-fdl: a line starting with `#` (after optional leading
whitespace) is discarded. There is no fdl-lang-specific block comment.

---

## Grammar summary (informal EBNF)

```
program     := statement* ;
statement   := var_decl | set_stmt | add_stmt | sub_stmt
             | copy_stmt | move_stmt | while_stmt | for_stmt
             | print_stmt | read_stmt | raw_block ;

var_decl    := "var" IDENT ";" ;
set_stmt    := "set" IDENT "=" INT ";" ;
add_stmt    := "add" IDENT "," INT ";" ;
sub_stmt    := "sub" IDENT "," INT ";" ;
copy_stmt   := "copy" IDENT "," IDENT ";" ;
move_stmt   := "move" IDENT "," IDENT ";" ;
while_stmt  := "while" IDENT "{" statement* "}" ;
for_stmt    := "for" IDENT "=" INT "{" statement* "}" ;
print_stmt  := "print" IDENT ( "x" INT )? ";" ;
read_stmt   := "read" IDENT ";" ;
raw_block   := "raw" "(" ptr_arg "," ptr_arg ")" "{" <verbatim eso-fdl tokens> "}" ;
ptr_arg     := "ptr.this" "(" ")" | "ptr.is" "(" INT "," INT ")" ;

IDENT       := [a-zA-Z_][a-zA-Z0-9_]* ;
INT         := [0-9]+ ;   (* must resolve to 0..=255 unless otherwise constrained, see below *)
```

Note: the two `INT` values inside `ptr.is(x, y)` are grid coordinates
and are constrained to `0..=199` each (not `0..=255` — see compile
errors below), since they must address a valid cell in the 200×200
grid.

---

## Compile-time errors reported by `fdlc`

`fdlc` reports the source line number for:

- reference to an undeclared variable
- redeclaration of an already-declared variable name
- integer literal outside `0..=255` (for `var`/`set`/`add`/`sub`/`print xN` values)
- declaring more than 39,999 variables ("grid exhausted" — recall
  index 39999 is reserved, §1)
- `copy`/`move` with identical source and destination
- unclosed `{` (missing matching `}`) in any block, including `raw`
- a `raw(...)` block missing either the entry or exit `ptr` argument,
  or supplying more or fewer than two arguments
- `ptr.is(x, y)` with `x` or `y` outside `0..=199`
- any statement outside of a recognized form in the grammar above

`fdlc` does **not** validate the contents of a `raw(...) { }` block's
body (§8), nor does it verify that the block's *exit* `ptr` argument
matches what the body actually does at runtime; malformed eso-fdl
inside the body will only surface as a runtime error from the eso-fdl
interpreter, reported against the *compiled* `.fdl` file's line
numbers, not the original `.fdl-lang` source. An inaccurate *exit*
argument will not surface as an error at all — it silently
desynchronizes `fdlc`'s pointer tracking for the rest of the file
(§8).

---

## Worked example: echo one character, uppercased-by-2 trick aside

```c
var ch;

read ch;
print ch;
```

Compiles to (pointer starts at `(0,0)`, `ch` is allocated at `(0,0)`,
so no navigation instructions are needed for either statement):

```
==
=
```

## Worked example: countdown printer

```c
var n;
var bang;

set n = 3;
set bang = 33;   # '!' is ASCII 33

for n = 3 {
    print bang;
}
```

`n` → `(0,0)`, `bang` → `(1,0)`. `set n = 3` navigates to `(0,0)`
(no movement needed, already there), zeroes it, then `inc` encoded
for 3 via §6 (`3` is odd → `'2`). `set bang = 33` navigates one cell
right — distance 1, so per the §2 special case this emits the bare
instruction `rgt` (no suffix), then zeroes the cell, then `inc`
encoded for 33 (odd → `'17`). The `for` loop then re-navigates to
`n`'s cell for the loop test/decrement each iteration and to `bang`'s
cell for each `print`.

---

## What fdl-lang deliberately does NOT add

- No functions/procedures (no call stack model yet — future version)
- No arrays beyond the raw 2D grid itself
- No arithmetic expressions beyond literal `set`/`add`/`sub` (no
  `a + b` inline expressions) — compose with `copy`/`add` instead,
  for now
- No `if`/conditional other than `while`'s implicit zero-test —
  a one-shot conditional is expressible as a `while` whose body ends
  by forcing the loop variable to 0, but there is no dedicated `if`
  keyword in this draft

---

## Toolchain

```
fdlc program.fdl-lang -o program.fdl   # compiles fdl-lang -> eso-fdl
eso-fdl program.fdl                    # runs it, same interpreter as always
```

`fdlc` is a separate compiler (**not yet implemented** — see the
project README roadmap) that performs a single pass: parse fdl-lang
syntax, track the compile-time pointer position and variable-to-cell
map, and emit an eso-fdl token stream according to the deterministic
rules in §2 and §6 above.

## Changelog

- **v0.3** (this revision) — added a navigation-only exception:
  distance-1 moves emit a bare `rgt`/`lft`/`up`/`dwn` with no `"`/`'`
  suffix instead of the full §6 encoding; fixed the countdown-printer
  worked example accordingly (`rgt'1` → `rgt`), and removed the
  self-contradicting parenthetical note that flagged this as an open
  issue. Replaced the v0.2 "documentation comment" convention for
  `raw { }` pointer tracking with a mandatory, parsed `raw(entry,
  exit) { }` syntax using `ptr.this()` / `ptr.is(x, y)` for both the
  pointer position on entry to and on exit from a raw block; `fdlc`
  now emits navigation instructions for a `ptr.is(x, y)` entry
  argument and resumes tracking from the exit argument, though it
  still does not verify the exit argument's accuracy against the raw
  body's actual behavior. Added corresponding grammar rule (`ptr_arg`)
  and compile errors (missing/malformed `raw()` arguments,
  out-of-range `ptr.is` coordinates). Clarified that loop
  re-navigation (§5) is computed from a raw block's stated exit
  position like any other statement.
- **v0.2** — added lexical structure section; switched statement
  syntax to require `;` terminators (C/Rust-style); formalized the
  navigation determinism rule (X-then-Y, shortest distance,
  tie→right/down) which v0.1 left unspecified; formalized the §6
  repetition-encoding rule used by `add`/`sub`/`set`/`print xN` and
  by navigation distances, so that `fdlc` output is byte-for-byte
  deterministic; reserved a dedicated temp cell (199,199) for `copy`
  instead of an unspecified "hidden temp cell"; added compile-error
  list; added `raw { }` pointer-tracking caveat and documentation
  convention; added grammar summary and worked examples.
- **v0.1** — initial draft: variables, navigation, `set`/`add`/`sub`,
  `copy`/`move`, `while`/`for`, `print`/`read`, `raw { }` escape hatch.
