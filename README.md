# fdl-lang
Flat Dimensional Language (FDL): A Brainfuck-derived esoteric programming language with a 2D memory model.
# Flat Dimensional Language (FDL)

Flat Dimensional Language (FDL) is an esoteric programming language created by Izra.

FDL is inspired by Brainfuck and is fully Turing-complete while introducing a two-dimensional memory model and a compact repetition syntax.

## Features

- 200×200 two-dimensional memory grid
- Four-directional pointer movement
- Memory and pointer wrap-around
- 8-bit cells (0–255)
- Compact repetition syntax
- Case-insensitive keywords
- Brainfuck-equivalent computational power

## Memory Model

FDL uses a 200×200 grid (40,000 cells).

Each cell stores an unsigned 8-bit integer (0–255).

The memory pointer starts at the top-left corner `(0,0)`.

Pointers wrap around when moving beyond the grid boundaries.

## Instructions

| FDL | Brainfuck | Description |
|-----|-----------|-------------|
| inc | + | Increment current cell |
| dec | - | Decrement current cell |
| rgt | > | Move pointer right |
| lft | < | Move pointer left |
| up | - | Move pointer up |
| dwn | - | Move pointer down |
| = | . | Output character |
| == | , | Read one character |
| /+ | [ | Begin loop |
| -/ | ] | End loop |

## Example

```fdl
inc"36
=
```

## Compilation

```bash
gcc -O2 -Wall -o fdl fdl.c
```

## Usage

```bash
./fdl program.fdl
```

## Project Status

FDL is currently under active development.

The language specification may evolve before the first stable release.

## Contributing

Contributions are welcome.

You can help by improving:

- Documentation
- Examples
- Interpreter
- Optimizations
- Editors and IDE support
- Syntax highlighting
- Playground
- Tooling

## License

This project is licensed under the MIT License.