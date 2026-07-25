# Flat Dimensional Language (FDL)

> A Brainfuck-inspired esoteric programming language with a two-dimensional memory model.

FDL (Flat Dimensional Language) is an esoteric programming language created by **Izra**. Inspired by Brainfuck, FDL extends the traditional one-dimensional tape into a **200×200 two-dimensional memory grid**, allowing movement in four directions while remaining fully **Turing-complete**.

FDL is designed to stay minimal, deterministic, and easy to implement while introducing new possibilities for memory navigation.

---

## Why FDL?

Unlike Brainfuck's linear tape, FDL provides a flat memory space where programs can move:

- Left
- Right
- Up
- Down

This allows algorithms to organize memory spatially instead of sequentially.

---

## Features

- 200×200 two-dimensional memory grid (40,000 cells)
- Four-directional pointer movement
- Memory wrap-around
- Pointer wrap-around
- Unsigned 8-bit cells (0–255)
- Compact repetition syntax
- Case-insensitive instructions
- Fully Turing-complete
- Lightweight interpreter written in C

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

Every cell stores an unsigned 8-bit integer.

When the pointer moves beyond an edge, it automatically wraps around to the opposite side.

---

## Instruction Set

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
| `/+` | `[` | Begin loop |
| `-/` | `]` | End loop |

---

## Example

```fdl
inc"36
=
```

Output

```

```

---

## Building

Compile the interpreter using GCC.

```bash
gcc -O2 -Wall -o fdl fdl.c
```

---

## Running

```bash
./fdl program.fdl
```

---

## Project Structure

```
fdl-lang/
├── fdl.c
├── README.md
├── LICENSE
└── examples/
```

---

## Roadmap

- [x] Core language specification
- [x] Official C interpreter
- [ ] Language specification v1.0
- [ ] Optimizer
- [ ] Debugger
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
- Interpreter improvements
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

FDL is an experimental programming language exploring two-dimensional memory navigation while preserving the minimalist philosophy of Brainfuck.