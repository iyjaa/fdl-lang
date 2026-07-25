/*
 * FDL — Flat Dimensional Language
 * Official interpreter written in C.
 *
 * FDL is a Brainfuck-derived esoteric programming language featuring:
 *   1. A two-dimensional memory grid instead of a one-dimensional tape,
 *      with pointer wrap-around on all edges.
 *   2. A compact repetition syntax:
 *         "N  = execute 2N times
 *         'N  = execute (2N - 1) times
 *      Expressions can be chained, for example:
 *         inc"15-'1   -> executes 29 times.
 *
 * Usage:
 *   ./fdl program.fdl
 *
 * Compilation:
 *   gcc -O2 -Wall -o fdl fdl.c
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>
#define GRID_SIZE     200
#define MAX_TOKENS    200000
#define MAX_TOKEN_LEN 64
typedef enum {
    OP_INC, OP_DEC, OP_RGT, OP_LFT, OP_UP, OP_DWN,
    OP_PRINT, OP_READ, OP_LOOP_START, OP_LOOP_END
} OpType;
typedef struct {
    OpType op;
    int count;  /* number of repetitions (not used by start/end loops) */
    int jump;   /* loop pair index (only for loop start/end) */
} Instruction;
static unsigned char grid[GRID_SIZE][GRID_SIZE];
static int px = 0, py = 0;

/* ---------- util file & string ---------- */

static char *read_file(const char *path) {
    FILE *f = fopen(path, "rb");
    if (!f) {
        fprintf(stderr, "FDL error: unable to open file '%s'\n", path);
        exit(1);
    }
    fseek(f, 0, SEEK_END);
    long size = ftell(f);
    fseek(f, 0, SEEK_SET);
    char *buf = malloc((size_t) size + 1);
    if (!buf) { fprintf(stderr, "FDL error: out of memory\n"); exit(1); }
    size_t got = fread(buf, 1, (size_t) size, f);
    buf[got] = '\0';
    fclose(f);
    return buf;
}

/* Remove lines that begin with '#' (after optional leading whitespace). */
static char *strip_comments(const char *src) {
    size_t len = strlen(src);
    char *out = malloc(len + 1);
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
        while (*p && *p != '-') p++;
        char saved = *p;
        *p = '\0';
        long n = atol(num_start);
        *p = saved;
        long contribution = (marker == '"') ? (2 * n) : (2 * n - 1);
        sum += sign * contribution;
        if (*p == '-') p++;
    }
    while (sum < 0) sum += 256;
    return (int) sum;
}
/* ---------- keyword matching ---------- */
static int match_keyword(const char *tok, OpType *op) {
    static const struct { const char *kw; OpType op; } table[] = {
        {"inc", OP_INC}, {"dec", OP_DEC},
        {"rgt", OP_RGT}, {"lft", OP_LFT}, {"dwn", OP_DWN},
        {"up",  OP_UP},
        {"==",  OP_READ}, {"=", OP_PRINT},
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
/* ---------- program ---------- */
int main(int argc, char **argv) {
    if (argc < 2) {
        fprintf(stderr, "Usage: %s <file.fdl>\n", argv[0]);
        return 1;
    }
    char *raw   = read_file(argv[1]);
    char *clean = strip_comments(raw);
    free(raw);
    Instruction *prog = malloc(sizeof(Instruction) * MAX_TOKENS);
    int *loop_stack    = malloc(sizeof(int) * MAX_TOKENS);
    int nprog = 0, sp = 0;
    char *saveptr;
    char *tok = strtok_r(clean, " \t\r\n", &saveptr);
    while (tok) {
        if (nprog >= MAX_TOKENS) {
            fprintf(stderr, "FDL error: program is too long (max %d instructions)\n", MAX_TOKENS);
            return 1;
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
                fprintf(stderr, "FDL error: '-/' without a matching '/+'\n");
                return 1;
            }
            int open = loop_stack[--sp];
            prog[nprog].op = OP_LOOP_END;
            prog[nprog].jump = open;
            prog[open].jump  = nprog;
            nprog++;
        } else {
            OpType op;
            int consumed = match_keyword(lower, &op);
            if (consumed < 0) {
                fprintf(stderr, "FDL error: unknown instruction '%s'\n", tok);
                return 1;
            }
            prog[nprog].op    = op;
            prog[nprog].count = parse_repeat(lower + consumed);
            nprog++;
        }
        tok = strtok_r(NULL, " \t\r\n", &saveptr);
    }
    if (sp != 0) {
        fprintf(stderr, "FDL error: '/+' without a matching '-/'\n");
        return 1;
    }
    free(clean);
    free(loop_stack);
    /* ---------- execution ---------- */
    memset(grid, 0, sizeof(grid));
    px = 0;
    py = 0;
    int ip = 0;
    while (ip < nprog) {
        Instruction *ins = &prog[ip];
        switch (ins->op) {
            case OP_INC:
                grid[py][px] = (unsigned char) ((grid[py][px] + ins->count) % 256);
                break;
            case OP_DEC: {
                int v = ((int) grid[py][px] - ins->count) % 256;
                if (v < 0) v += 256;
                grid[py][px] = (unsigned char) v;
                break;
            }
            case OP_RGT:
                px = ((px + ins->count) % GRID_SIZE + GRID_SIZE) % GRID_SIZE;
                break;
            case OP_LFT:
                px = ((px - ins->count) % GRID_SIZE + GRID_SIZE) % GRID_SIZE;
                break;
            case OP_UP:
                py = ((py - ins->count) % GRID_SIZE + GRID_SIZE) % GRID_SIZE;
                break;
            case OP_DWN:
                py = ((py + ins->count) % GRID_SIZE + GRID_SIZE) % GRID_SIZE;
                break;
            case OP_PRINT:
                for (int i = 0; i < ins->count; i++) putchar(grid[py][px]);
                break;
            case OP_READ:
                for (int i = 0; i < ins->count; i++) {
                    int c = getchar();
                    grid[py][px] = (c == EOF) ? 0 : (unsigned char) c;
                }
                break;
            case OP_LOOP_START:
                if (grid[py][px] == 0) ip = ins->jump;
                break;
            case OP_LOOP_END:
                if (grid[py][px] != 0) ip = ins->jump;
                break;
        }
        ip++;
    }
    fflush(stdout);
    free(prog);
    return 0;
}
