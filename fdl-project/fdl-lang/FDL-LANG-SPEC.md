# fdl-lang — Language Specification (draft v0.1)

fdl-lang is a higher-level dialect that **compiles down to eso-fdl**.
Every fdl-lang program produces a valid eso-fdl token stream; the
eso-fdl interpreter never needs to change. fdl-lang exists purely to
make writing eso-fdl programs less painful — manual cell bookkeeping,
manual pointer navigation, manual zeroing loops.

## Design principle

Nothing in fdl-lang is "magic." Every construct below has a fixed,
predictable expansion into eso-fdl instructions. If you're ever
unsure what a line compiles to, you can always drop to `raw { ... }`
and write eso-fdl by hand.

## 1. Named variables (replaces manual cell bookkeeping)

```
var row
var col
var intensity
```

Each `var` reserves the next free cell in the grid (allocated
left-to-right, top-to-bottom, starting at (0,0), skipping cells
already used by earlier `var` declarations). The compiler tracks
which grid coordinate each name maps to — you never write `rgt`/`lft`
by hand again.

## 2. Automatic navigation

Any statement referencing a variable automatically emits the
`rgt`/`lft`/`up`/`dwn` instructions needed to move the pointer from
wherever it currently is (tracked at compile time) to that
variable's cell. You never manage the pointer manually.

## 3. Setting values (deterministic, not history-dependent)

```
set intensity = 8
```

Compiles to: navigate to `intensity`, zero the cell with a standard
clearing loop (`/+ dec -/`), then `inc` to the target value. Because
it always zeroes first, `set` never depends on what the cell held
before — this matters since eso-fdl cells persist across the whole
program.

```
add intensity, 8      # inc by N, no zeroing
sub col, 1             # dec by N, no zeroing
```

## 4. Cell-to-cell operations

```
copy dest, src   # dest = src (src is left unchanged; uses a hidden temp cell)
move dest, src   # dest = src, src becomes 0 (cheaper: no temp cell)
```

Both use the classic zeroing-and-transfer loop pattern; `copy` costs
one extra hidden temp cell per call site, `move` doesn't.

## 5. Loops

```
while row {
    ...
}
```

Compiles to `goto row` + `/+` before the body, and `goto row` + `-/`
after — the compiler automatically re-navigates back to `row`'s cell
after the body runs, wherever the body left the pointer.

```
for row = 32 {
    ...
}
```

Sugar for: `set row = 32` then `while row { ...; sub row, 1 }`.

## 6. I/O

```
print intensity            # = (print once)
print intensity x3         # ='2 (print 3 times — e.g. R=G=B)
read ch                    # ==
```

## 7. Escape hatch

```
raw {
    inc"40 = rgt
}
```

Anything inside `raw { }` is copied to the output token stream
verbatim (still eso-fdl syntax, still whitespace-delimited). Useful
for hand-tuned hot paths or constructs fdl-lang doesn't cover yet.

## 8. Comments

Same as eso-fdl: a line starting with `#` (after optional leading
whitespace) is discarded.

## What fdl-lang deliberately does NOT add

- No functions/procedures (no call stack model yet — future version)
- No arrays beyond the raw 2D grid itself
- No arithmetic expressions beyond literal set/add/sub (no `a + b`
  inline expressions) — compose with `copy`/`add` instead, for now

## Toolchain

```
fdlc program.fdl-lang -o program.fdl   # compiles fdl-lang -> eso-fdl
eso-fdl program.fdl                    # runs it, same interpreter as always
```

`fdlc` is a separate compiler (not yet implemented) that performs a
single pass: parse fdl-lang syntax, track the compile-time pointer
position and variable-to-cell map, and emit an eso-fdl token stream.
