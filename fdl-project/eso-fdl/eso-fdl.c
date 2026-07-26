/*
 * eso-fdl — Flat Dimensional Language (esoteric core), v1.1 "upgrade" branch
 * Reference interpreter written in C.
 *
 * Changes vs the frozen v1.0 spec interpreter:
 *   1. Memory grid is now dynamically allocated (heap, single flat buffer)
 *      instead of a fixed 200x200 static array, so its size is no longer
 *      baked into the binary.
 *   2. Default grid size is 4096x4096 (16,777,216 cells). Override with
 *      --grid=N on the command line (e.g. --grid=8192).
 *   3. The instruction buffer grows dynamically (realloc, doubling) instead
 *      of being capped at a fixed MAX_TOKENS.
 *   4. Hardened error handling: every malloc/realloc/fseek/fread result is
 *      checked; overly long tokens now error out instead of being silently
 *      truncated.
 *
 * Instruction set, tokenization rule, and repetition notation ("N / 'N)
 * are UNCHANGED from v1.0 — this is purely a memory/runtime upgrade, not
 * a language change. Existing .fdl programs run identically (aside from
 * having a much bigger grid to play with).
 *
 * Usage:
 *   ./eso-fdl program.fdl [--grid=N]
 *
 * Compilation:
 *   gcc -O2 -Wall -o eso-fdl eso-fdl.c
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>

#define DEFAULT_GRID_SIZE 4096
#define MIN_GRID_SIZE 16
#define MAX_GRID_SIZE 65536      /* sanity ceiling: 65536^2 = 4 GiB of cells */
#define INITIAL_TOKEN_CAP 4096
#define MAX_TOKEN_LEN 64

typedef enum {
    OP_INC, OP_DEC, OP_RGT, OP_LFT, OP_UP, OP_DWN,
    OP_PRINT, OP_READ, OP_LOOP_START, OP_LOOP_END
} OpType;

typedef struct {
    OpType op;
    int count;   /* number of repetitions (not used by start/end loops) */
    int jump;    /* loop pair index (only for loop start/end) */
} Instruction;

/* ---------- dynamic grid ---------- */

static unsigned char *grid = NULL;  /* flat buffer, size grid_size*grid_size */
static int grid_size = DEFAULT_GRID_SIZE;
static int px = 0, py = 0;

static inline unsigned char grid_get(int x, int y) {
    return grid[(size_t) y * grid_size + x];
}
static inline void grid_set(int x, int y, unsigned char v) {
    grid[(size_t) y * grid_size + x] = v;
}

static void *xmalloc(size_t n) {
    void *p = malloc(n);
    if (!p) {
        fprintf(stderr, "FDL error: out of memory (requested %zu bytes)\n", n);
        exit(1);
    }
    return p;
}

static void *xrealloc(void *old, size_t n) {
    void *p = realloc(old, n);
    if (!p) {
        fprintf(stderr, "FDL error: out of memory (requested %zu bytes)\n", n);
        exit(1);
    }
    return p;
}

/* ---------- util file & string ---------- */

static char *read_file(const char *path) {
    FILE *f = fopen(path, "rb");
    if (!f) {
        fprintf(stderr, "FDL error: unable to open file '%s'\n", path);
        exit(1);
    }
    if (fseek(f, 0, SEEK_END) != 0) {
        fprintf(stderr, "FDL error: unable to seek in file '%s'\n", path);
        exit(1);
    }
    long size = ftell(f);
    if (size < 0) {
        fprintf(stderr, "FDL error: unable to determine size of '%s'\n", path);
        exit(1);
    }
    if (fseek(f, 0, SEEK_SET) != 0) {
        fprintf(stderr, "FDL error: unable to rewind file '%s'\n", path);
        exit(1);
    }
    char *buf = xmalloc((size_t) size + 1);
    size_t got = fread(buf, 1, (size_t) size, f);
    if (got != (size_t) size) {
        fprintf(stderr, "FDL error: short read on '%s' (got %zu of %ld bytes)\n", path, got, size);
        exit(1);
    }
    buf[got] = '\0';
    fclose(f);
    return buf;
}

/* Remove lines that begin with '#' (after optional leading whitespace). */
static char *strip_comments(const char *src) {
    size_t len = strlen(src);
    char *out = xmalloc(len + 1);
    size_t oi = 0, i = 0;
    while (i < len) {
        size_t line_start = i;
        size_t j = i;
        while (j < len && src[j] != '\n') j++;
        size_t k = line_start;
        while (k < j && isspace((unsigned char) src[k])) k++;
        int is_comment = (k < j && src[k] == '#');
        if (!is_comment) {
            memcpy(out + oi, src + line_start, j - line_start);
            oi += (j - line_start);
        }
        if (j < len) out[oi++] = '\n';
        i = j + 1;
    }
    out[oi] = '\0';
    return out;
}

static void to_lower_str(char *dst, const char *src, size_t max) {
    size_t i = 0;
    for (; src[i] && i < max - 1; i++) dst[i] = (char) tolower((unsigned char) src[i]);
    dst[i] = '\0';
}

/* ---------- notation and repetition "N / 'N ---------- */

static int parse_repeat(const char *suffix) {
    if (suffix[0] == '\0') return 1;
    char buf[MAX_TOKEN_LEN];
    strncpy(buf, suffix, sizeof(buf) - 1);
    buf[sizeof(buf) - 1] = '\0';

    long sum = 0;
    int first = 1;
    char *p = buf;

    while (*p) {
        int sign = first ? 1 : -1;
        first = 0;

        char marker = *p;
        if (marker != '"' && marker != '\'') {
            fprintf(stderr, "FDL error: invalid repetition notation '%s'\n", suffix);
            exit(1);
        }
        p++;

        char *num_start = p;
        while (*p && isdigit((unsigned char) *p)) p++;
        if (p == num_start) {
            fprintf(stderr, "FDL error: expected digits after '%c' in repetition notation '%s'\n", marker, suffix);
            exit(1);
        }

        char saved = *p;
        *p = '\0';
        long n = atol(num_start);
        *p = saved;

        long contribution = (marker == '"') ? (2 * n) : (2 * n - 1);
        sum += sign * contribution;

        /* clamp early to avoid pathological overflow on huge digit runs */
        if (sum > 1000000000L || sum < -1000000000L) {
            fprintf(stderr, "FDL error: repetition count too large in '%s'\n", suffix);
            exit(1);
        }

        if (*p == '-') {
            p++;
        } else if (*p != '\0') {
            fprintf(stderr,
                    "FDL error: unexpected character '%c' in repetition notation '%s' "
                    "(missing whitespace before the next instruction?)\n", *p, suffix);
            exit(1);
        }
    }

    while (sum < 0) sum += 256;
    return (int) (sum % 256);
}

/* ---------- keyword matching ---------- */

static int match_keyword(const char *tok, OpType *op) {
    static const struct { const char *kw; OpType op; } table[] = {
        {"inc", OP_INC}, {"dec", OP_DEC},
        {"rgt", OP_RGT}, {"lft", OP_LFT}, {"dwn", OP_DWN},
        {"up", OP_UP},
        {"==", OP_READ}, {"=", OP_PRINT},
    };
    for (size_t i = 0; i < sizeof(table) / sizeof(table[0]); i++) {
        size_t kl = strlen(table[i].kw);
        if (strncmp(tok, table[i].kw, kl) == 0) {
            *op = table[i].op;
            return (int) kl;
        }
    }
    return -1;
}

/* ---------- CLI parsing ---------- */

static void parse_grid_arg(const char *arg) {
    /* expects "--grid=N" */
    const char *eq = strchr(arg, '=');
    if (!eq || !isdigit((unsigned char) eq[1])) {
        fprintf(stderr, "FDL error: invalid --grid argument '%s' (expected --grid=N)\n", arg);
        exit(1);
    }
    long n = atol(eq + 1);
    if (n < MIN_GRID_SIZE || n > MAX_GRID_SIZE) {
        fprintf(stderr, "FDL error: --grid=%ld out of range (%d..%d)\n", n, MIN_GRID_SIZE, MAX_GRID_SIZE);
        exit(1);
    }
    grid_size = (int) n;
}

/* ---------- program ---------- */

int main(int argc, char **argv) {
    const char *path = NULL;

    for (int i = 1; i < argc; i++) {
        if (strncmp(argv[i], "--grid=", 7) == 0) {
            parse_grid_arg(argv[i]);
        } else if (!path) {
            path = argv[i];
        } else {
            fprintf(stderr, "FDL error: unexpected argument '%s'\n", argv[i]);
            return 1;
        }
    }

    if (!path) {
        fprintf(stderr, "Usage: %s <file.fdl> [--grid=N]\n", argv[0]);
        fprintf(stderr, "  --grid=N   set grid size to NxN (default %d, range %d..%d)\n",
                DEFAULT_GRID_SIZE, MIN_GRID_SIZE, MAX_GRID_SIZE);
        return 1;
    }

    char *raw = read_file(path);
    char *clean = strip_comments(raw);
    free(raw);

    size_t token_cap = INITIAL_TOKEN_CAP;
    Instruction *prog = xmalloc(sizeof(Instruction) * token_cap);
    int *loop_stack = xmalloc(sizeof(int) * token_cap);
    size_t loop_cap = token_cap;

    int nprog = 0, sp = 0;
    char *cursor = clean;
    long line_no = 1;
    char tokbuf[MAX_TOKEN_LEN];

    for (;;) {
        /* skip whitespace, tracking line numbers */
        while (*cursor && isspace((unsigned char) *cursor)) {
            if (*cursor == '\n') line_no++;
            cursor++;
        }
        if (!*cursor) break;

        size_t tlen = 0;
        char *tok_start = cursor;
        while (*cursor && !isspace((unsigned char) *cursor)) {
            if (tlen < sizeof(tokbuf) - 1) tokbuf[tlen++] = *cursor;
            cursor++;
        }
        if ((size_t) (cursor - tok_start) >= sizeof(tokbuf)) {
            fprintf(stderr, "FDL error (line %ld): token too long (max %d chars)\n",
                    line_no, MAX_TOKEN_LEN - 1);
            return 1;
        }
        tokbuf[tlen] = '\0';
        char *tok = tokbuf;

        if ((size_t) nprog >= token_cap) {
            token_cap *= 2;
            prog = xrealloc(prog, sizeof(Instruction) * token_cap);
        }
        if ((size_t) sp >= loop_cap) {
            loop_cap *= 2;
            loop_stack = xrealloc(loop_stack, sizeof(int) * loop_cap);
        }

        char lower[MAX_TOKEN_LEN];
        to_lower_str(lower, tok, sizeof(lower));

        if (strcmp(lower, "/+") == 0) {
            prog[nprog].op = OP_LOOP_START;
            prog[nprog].count = 0;
            loop_stack[sp++] = nprog;
            nprog++;
        } else if (strcmp(lower, "-/") == 0) {
            if (sp == 0) {
                fprintf(stderr, "FDL error (line %ld): '-/' without a matching '/+'\n", line_no);
                return 1;
            }
            int open = loop_stack[--sp];
            prog[nprog].op = OP_LOOP_END;
            prog[nprog].jump = open;
            prog[open].jump = nprog;
            nprog++;
        } else {
            OpType op;
            int consumed = match_keyword(lower, &op);
            if (consumed < 0) {
                fprintf(stderr, "FDL error (line %ld): unknown instruction '%s'\n", line_no, tok);
                return 1;
            }
            prog[nprog].op = op;
            prog[nprog].count = parse_repeat(lower + consumed);
            nprog++;
        }
    }

    if (sp != 0) {
        fprintf(stderr, "FDL error: unclosed '/+' (missing '-/' before end of file, %ld total lines)\n", line_no);
        return 1;
    }

    free(clean);
    free(loop_stack);

    /* ---------- allocate grid & execute ---------- */

    size_t cells = (size_t) grid_size * (size_t) grid_size;
    grid = xmalloc(cells);
    memset(grid, 0, cells);
    px = 0;
    py = 0;

    int ip = 0;
    while (ip < nprog) {
        Instruction *ins = &prog[ip];
        switch (ins->op) {
            case OP_INC:
                grid_set(px, py, (unsigned char) ((grid_get(px, py) + ins->count) % 256));
                break;
            case OP_DEC: {
                int v = ((int) grid_get(px, py) - ins->count) % 256;
                if (v < 0) v += 256;
                grid_set(px, py, (unsigned char) v);
                break;
            }
            case OP_RGT:
                px = ((px + ins->count) % grid_size + grid_size) % grid_size;
                break;
            case OP_LFT:
                px = ((px - ins->count) % grid_size + grid_size) % grid_size;
                break;
            case OP_UP:
                py = ((py - ins->count) % grid_size + grid_size) % grid_size;
                break;
            case OP_DWN:
                py = ((py + ins->count) % grid_size + grid_size) % grid_size;
                break;
            case OP_PRINT:
                for (int i = 0; i < ins->count; i++) putchar(grid_get(px, py));
                break;
            case OP_READ:
                for (int i = 0; i < ins->count; i++) {
                    int c = getchar();
                    grid_set(px, py, (c == EOF) ? 0 : (unsigned char) c);
                }
                break;
            case OP_LOOP_START:
                if (grid_get(px, py) == 0) ip = ins->jump;
                break;
            case OP_LOOP_END:
                if (grid_get(px, py) != 0) ip = ins->jump;
                break;
        }
        ip++;
    }

    fflush(stdout);
    free(prog);
    free(grid);
    return 0;
}
