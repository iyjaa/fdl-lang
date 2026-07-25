![License](https://img.shields.io/badge/license-MIT-green)
![Language](https://img.shields.io/badge/language-C-blue)
![Status](https://img.shields.io/badge/status-Active%20Development-orange)

# FDL — Flat Dimensional Language

> A Brainfuck-inspired esoteric programming language with a two-dimensional memory model.

FDL is an esoteric programming language created by **Izra**. Inspired
by Brainfuck, FDL extends the traditional one-dimensional tape into a
**200×200 two-dimensional memory grid**, allowing movement in four
directions while remaining fully **Turing-complete**.

The project is split into two layers:

| | Purpose |
|---|---|
| **[eso-fdl](./eso-fdl/)** ([`eso-fdl.c`](./eso-fdl/eso-fdl.c), [`SPESIFIKASI.md`](./eso-fdl/SPESIFIKASI.md)) | The frozen esoteric core (v1.0). Minimal, deterministic, spec-locked. This is "FDL" in the classic Brainfuck-derivative sense. |
| **[fdl-lang](./fdl-lang/)** ([`FDL-LANG-SPEC.md`](./fdl-lang/FDL-LANG-SPEC.md)) | An ergonomic dialect built on top — named variables, automatic pointer navigation, loops with names instead of raw `/+ -/`. Compiles down to eso-fdl; the eso-fdl interpreter is the only thing that ever actually executes. |

If you want the pure esolang experience (or you're golfing, or
exploring the minimal instruction set), use **eso-fdl** directly. If
you want to actually get something built in FDL without hand-managing
grid coordinates, write **fdl-lang** and compile it down.

---

## Why FDL?

Unlike Brainfuck's linear tape, FDL provides a flat memory space where
programs can move:

- Left
- Right
- Up
- Down

This allows algorithms to organize memory spatially instead of
sequentially — grids, images, matrices, and cellular-automaton-style
programs map naturally onto it.

---

## Features

- 200×200 two-dimensional memory grid (40,000 cells)
- Four-directional pointer movement
- Memory and pointer wrap-around on all edges
- Unsigned 8-bit cells (0–255)
- Compact repetition syntax
- Case-insensitive instructions
- Fully Turing-complete
- Lightweight interpreter written in C
- Source-line-aware error messages

---

## Memory Model

The memory consists of a fixed **200×200** grid.

```
(0,0) ─────────────► X
  │
  │
  │
  ▼
  Y
```

Every cell stores an unsigned 8-bit integer. When the pointer moves
beyond an edge, it automatically wraps around to the opposite side.

---

## Instruction Set (eso-fdl core)

| FDL | Brainfuck | Description |
|-----|-----------|-------------|
| `inc` | `+` | Increment current cell |
| `dec` | `-` | Decrement current cell |
| `rgt` | `>` | Move pointer right |
| `lft` | `<` | Move pointer left |
| `up` | — | Move pointer up |
| `dwn` | — | Move pointer down |
| `=` | `.` | Output current cell as a character |
| `==` | `,` | Read one character |
| `/+` | `[` | Begin loop (jump past `-/` if current cell is 0) |
| `-/` | `]` | End loop (jump back to `/+` if current cell is non-zero) |

### Repetition notation

Any instruction above (except `/+`/`-/`) can take a repetition
suffix instead of being written out repeatedly:

- `"N` — repeat 2×N times
- `'N` — repeat (2×N − 1) times
- Suffixes chain by alternating sign: `inc"15-'1` → 30 − 1 = 29 times

### ⚠️ Tokenization rule

Instructions are separated by **whitespace only** — including
between an instruction's repetition suffix and the next instruction.

```
inc'1 =     ✅ two instructions
inc'1=      ❌ syntax error — missing separator before '='
```

Full spec: see [`eso-fdl/SPESIFIKASI.md`](./eso-fdl/SPESIFIKASI.md).

---

## Examples

### Hello, World! (left → right)

```
inc"36
=
rgt
inc'51
=
rgt
inc"54
=
rgt
inc"54
=
rgt
inc'56
=
rgt
inc"22
=
rgt
inc"16
=
rgt
inc'44
=
rgt
inc'56
=
rgt
inc"57
=
rgt
inc"54
=
rgt
inc"50
=
rgt
inc'17
=
rgt
inc"5
=
```

Output:
```
Hello, World!
```

### ABCDE (left-right, up-down)

```
inc'33
=
rgt"1
inc"33
=
dwn"1
inc'34
=
lft
inc"34
=
up
inc'35
=
```

Output:
```
ABCDE
```

More examples (including PPM image generation using loops) live in
[`examples/`](./examples/).

---

## Building

```bash
gcc -O2 -Wall -o eso-fdl eso-fdl/eso-fdl.c
```

![License](https://img.shields.io/badge/license-MIT-green)
![Language](https://img.shields.io/badge/language-C-blue)
![Status](https://img.shields.io/badge/status-Active%20Development-orange)

# FDL — Flat Dimensional Language

> A Brainfuck-inspired esoteric programming language with a two-dimensional memory model.

FDL is an esoteric programming language created by **Izra**. Inspired
by Brainfuck, FDL extends the traditional one-dimensional tape into a
**200×200 two-dimensional memory grid**, allowing movement in four
directions while remaining fully **Turing-complete**.

The project is split into two layers:

| | Purpose |
|---|---|
| **[eso-fdl](./fdl-project/eso-fdl/)** ([`eso-fdl.c`](./fdl-project/eso-fdl/eso-fdl.c), [`SPESIFIKASI.md`](./eso-fdl/SPESIFIKASI.md)) | The frozen esoteric core (v1.0). Minimal, deterministic, spec-locked. This is "FDL" in the classic Brainfuck-derivative sense. |
| **[fdl-lang](./fdl-project/fdl-lang/)** ([`FDL-LANG-SPEC.md`](./fdl-project/fdl-lang/FDL-LANG-SPEC.md)) | An ergonomic dialect built on top — named variables, automatic pointer navigation, loops with names instead of raw `/+ -/`. Compiles down to eso-fdl; the eso-fdl interpreter is the only thing that ever actually executes. |

If you want the pure esolang experience (or you're golfing, or
exploring the minimal instruction set), use **eso-fdl** directly. If
you want to actually get something built in FDL without hand-managing
grid coordinates, write **fdl-lang** and compile it down.

---

## Why FDL?

Unlike Brainfuck's linear tape, FDL provides a flat memory space where
programs can move:

- Left
- Right
- Up
- Down

This allows algorithms to organize memory spatially instead of
sequentially — grids, images, matrices, and cellular-automaton-style
programs map naturally onto it.

---

## Features

- 200×200 two-dimensional memory grid (40,000 cells)
- Four-directional pointer movement
- Memory and pointer wrap-around on all edges
- Unsigned 8-bit cells (0–255)
- Compact repetition syntax
- Case-insensitive instructions
- Fully Turing-complete
- Lightweight interpreter written in C
- Source-line-aware error messages

---

## Memory Model

The memory consists of a fixed **200×200** grid.

```
(0,0) ─────────────► X
  │
  │
  │
  ▼
  Y
```

Every cell stores an unsigned 8-bit integer. When the pointer moves
beyond an edge, it automatically wraps around to the opposite side.

---

## Instruction Set (eso-fdl core)

| FDL | Brainfuck | Description |
|-----|-----------|-------------|
| `inc` | `+` | Increment current cell |
| `dec` | `-` | Decrement current cell |
| `rgt` | `>` | Move pointer right |
| `lft` | `<` | Move pointer left |
| `up` | — | Move pointer up |
| `dwn` | — | Move pointer down |
| `=` | `.` | Output current cell as a character |
| `==` | `,` | Read one character |
| `/+` | `[` | Begin loop (jump past `-/` if current cell is 0) |
| `-/` | `]` | End loop (jump back to `/+` if current cell is non-zero) |

### Repetition notation

Any instruction above (except `/+`/`-/`) can take a repetition
suffix instead of being written out repeatedly:

- `"N` — repeat 2×N times
- `'N` — repeat (2×N − 1) times
- Suffixes chain by alternating sign: `inc"15-'1` → 30 − 1 = 29 times

### ⚠️ Tokenization rule

Instructions are separated by **whitespace only** — including
between an instruction's repetition suffix and the next instruction.

```
inc'1 =     ✅ two instructions
inc'1=      ❌ syntax error — missing separator before '='
```

Full spec: see [`eso-fdl/SPESIFIKASI.md`](./fdl-project/eso-fdl/SPESIFIKASI.md).

---

## Examples

### Hello, World! (left → right)

```
inc"36
=
rgt
inc'51
=
rgt
inc"54
=
rgt
inc"54
=
rgt
inc'56
=
rgt
inc"22
=
rgt
inc"16
=
rgt
inc'44
=
rgt
inc'56
=
rgt
inc"57
=
rgt
inc"54
=
rgt
inc"50
=
rgt
inc'17
=
rgt
inc"5
=
```

Output:
```
Hello, World!
```

### ABCDE (left-right, up-down)

```
inc'33
=
rgt"1
inc"33
=
dwn"1
inc'34
=
lft
inc"34
=
up
inc'35
=
```

Output:
```
ABCDE
```

More examples (including PPM image generation using loops) live in
[`examples/`](./fdl-project/examples/).

---

## Building

```bash
gcc -O2 -Wall -o eso-fdl eso-fdl/eso-fdl.c
```

## Running

```bash
./eso-fdl program.fdl
```

Output is written to stdout — redirect it if you're generating binary
data (e.g. a PPM image):

```bash
./eso-fdl gradient.fdl > gradient.ppm
```

---

## Project Structure

```
fdl/
├── eso-fdl/
│   ├── eso-fdl.c
│   └── SPESIFIKASI.md      # eso-fdl frozen spec (v1.0)
├── fdl-lang/
│   └── FDL-LANG-SPEC.md    # fdl-lang draft spec
├── examples/
│   ├── hello.fdl
│   ├── abcde.fdl
│   ├── checkerboard.fdl
│   └── gradient32.fdl
├── README.md
└── LISENSI
```

---

## Roadmap

- [x] Core language specification
- [x] Official C interpreter
- [x] eso-fdl spec frozen at v1.0
- [x] Source-line error reporting
- [ ] fdl-lang specification v0.1 (draft complete, see `fdl-lang/FDL-LANG-SPEC.md`)
- [ ] fdl-lang compiler (`fdlc`)
- [ ] Optimizer
- [ ] Debugger / grid visualizer
- [ ] Standard library
- [ ] Syntax highlighting
- [ ] VS Code extension
- [ ] Playground
- [ ] Documentation website

---

## Contributing

Contributions are welcome.

Areas where help is appreciated:

- Documentation
- Examples
- eso-fdl interpreter improvements
- fdl-lang compiler implementation
- Performance optimizations
- Editor integrations
- Syntax highlighting
- Testing
- Playground
- Developer tools

Please open an Issue before implementing major changes.

---

## License

This project is licensed under the **MIT License**.

---

## Author

Created by **Izra**.

FDL is an experimental programming language exploring two-dimensional
memory navigation while preserving the minimalist philosophy of
Brainfuck.
