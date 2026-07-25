#!/usr/bin/env bash
# eso-fdl empirical test suite for ERRATA.md (E1, E2, E3, E4, E5)
# Usage: ./run_tests.sh  (expects ../eso-fdl.c relative to this script,
#                          or set ESO_FDL_SRC to override)
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="${ESO_FDL_SRC:-$HERE/../eso-fdl.c}"
BIN="$HERE/eso-fdl"
PASS=0
FAIL=0

if [ ! -f "$SRC" ]; then
    echo "eso-fdl.c not found at $SRC (set ESO_FDL_SRC to override)"; exit 1
fi

gcc -O2 -Wall -o "$BIN" "$SRC" || { echo "build failed"; exit 1; }

check() {
    local name="$1" expected="$2" actual="$3"
    if [ "$expected" = "$actual" ]; then
        echo "PASS: $name"
        PASS=$((PASS+1))
    else
        echo "FAIL: $name (expected [$expected], got [$actual])"
        FAIL=$((FAIL+1))
    fi
}

# --- E1: case-insensitive instructions ---
printf 'InC"33\n=\n' > /tmp/e1.fdl
out=$("$BIN" /tmp/e1.fdl | od -An -tu1 | tr -d ' ')
check "E1 case-insensitivity (InC\"33 -> 66)" "66" "$out"

# --- E2: chaining is NOT alternating for 3+ terms ---
# inc"40-'2-"3  ->  80 - 3 - 6 = 71  (if truly alternating it would be 83)
printf 'inc"40-'"'"'2-"3\n=\n' > /tmp/e2.fdl
out=$("$BIN" /tmp/e2.fdl | od -An -tu1 | tr -d ' ')
check "E2 non-alternating chain (80-3-6=71, not 80-3+6=83)" "71" "$out"

# --- E3: literal '-' is mandatory between EVERY pair of chained terms ---
# Missing dash between 2nd and 3rd term must be a syntax error.
printf 'inc"40-'"'"'2"3\n=\n' > /tmp/e3.fdl
"$BIN" /tmp/e3.fdl > /tmp/e3.out 2> /tmp/e3.err
rc=$?
if [ "$rc" -ne 0 ] && grep -q "unexpected character" /tmp/e3.err; then
    echo "PASS: E3 missing dash between terms 2 and 3 -> syntax error"
    PASS=$((PASS+1))
else
    echo "FAIL: E3 missing dash between terms 2 and 3 should be a syntax error (rc=$rc)"
    FAIL=$((FAIL+1))
fi

# --- E4: token > 64 chars is silently truncated, not errored ---
long_ones=$(printf '1%.0s' $(seq 1 70))
printf 'inc"%s\n=\n' "$long_ones" > /tmp/e4.fdl
"$BIN" /tmp/e4.fdl > /tmp/e4.out 2> /tmp/e4.err
rc=$?
if [ "$rc" -eq 0 ] && [ ! -s /tmp/e4.err ]; then
    echo "PASS: E4 token >64 chars silently truncated (no error, exit 0)"
    PASS=$((PASS+1))
else
    echo "FAIL: E4 expected silent success, got rc=$rc stderr=$(cat /tmp/e4.err)"
    FAIL=$((FAIL+1))
fi

# --- E5: '==' at EOF sets cell to 0 ---
printf '==\n=\n' > /tmp/e5.fdl
out=$(printf '' | "$BIN" /tmp/e5.fdl | od -An -tu1 | tr -d ' ')
check "E5 read at EOF sets cell to 0" "0" "$out"

echo
echo "== $PASS passed, $FAIL failed =="
exit $FAIL
