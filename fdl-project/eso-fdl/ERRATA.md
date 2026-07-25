# eso-fdl — Errata & Addendum to SPESIFIKASI.md (v1.0, frozen)

This document records the points where the behavior of the *reference
interpreter* (`eso-fdl.c`) is not fully covered, or is stated
ambiguously, by `SPESIFIKASI.md`. Since spec v1.0 is **frozen**, the
points below are written as an **addendum** (an official clarification
of existing interpreter behavior) rather than a behavior change.

---

## E1. Instructions are case-insensitive

**Status:** not mentioned anywhere in SPESIFIKASI.md.

Every token is passed through `to_lower_str()` before being matched
against the keyword table or against `/+` / `-/`. As a result, `INC`,
`Inc`, `iNc`, `RGT`, etc. are all valid and equivalent to their
lowercase form.

**Addition to the Instructions section:**

> Instruction matching is case-insensitive. Tokens are normalized to
> lowercase before being compared against the keyword table and
> against `/+` / `-/`. This applies to the keyword itself as well as
> to the repetition-suffix marker (`"`/`'` are unaffected since they
> aren't letters, but the keyword they're attached to — e.g.
> `INC"5` — is still recognized).

---

## E2. Suffix chaining is NOT strictly alternating for 3+ terms

**Status:** stated incorrectly/misleadingly in SPESIFIKASI.md.

The spec says "Suffixes chain by alternating sign," backed by a
2-term example (`inc"15-'1` → `30 − 1 = 29`) that is indeed consistent
with alternating signs. But the actual implementation in
`parse_repeat()`:

```c
int sign = first ? 1 : -1;
```

gives a **+** sign only to the first term, and a **−** sign to *every*
term after it — not an alternating +,−,+,−,... pattern.

**Distinguishing example:** for `inc"5-'2"3`:
- If truly alternating: `+30, −3, +6` = 30 − 3 + 6 = 33
- Actual interpreter behavior: `+30, −3, −6` = 30 − 3 − 6 = 21

**Correction to the Repetition notation section:**

> Suffixes are chained left to right. The first term is always
> positive; **every term after the first is negative**, regardless of
> its position in the chain (not alternating +/−/+/−). The final
> result is wrapped modulo 256 if negative (256 is added repeatedly
> until the value is ≥ 0).

---

## E3. The `-` character between suffix terms is syntactically mandatory

**Status:** only implied by the examples, never stated as a rule.

The suffix parser will error out if the character following a digit
sequence is neither `-` nor the end of the token:

```
FDL error: unexpected character '<c>' in repetition notation '<suffix>'
```

**Addition to the Repetition notation section:**

> A literal `-` character must appear between two suffix terms (not
> merely implied by "subtraction" semantics). `inc"5'2` (without a
> separating `-`) is a **syntax error**, not something interpreted as
> `inc"5 -'2` or automatically merged.

---

## E4. Tokens longer than 64 characters are silently truncated, not errored

**Status:** directly contradicts a principle stated by the spec itself.

The *Limits* section states "Max token length: 64 characters," and the
*Errors* section states the interpreter must report the line number
for conditions such as "programs exceeding the token limit" —
implying that a token violating this limit should also be reported as
an error. However, in `main()`:

```c
while (*cursor && !isspace((unsigned char) *cursor)) {
    if (tlen < sizeof(tokbuf) - 1) tokbuf[tlen++] = *cursor;
    cursor++;
}
```

The 65th character and beyond of a token are **discarded with no
message at all** — the cursor still advances, the excess characters
are simply dropped, and the resulting truncated token is what gets
matched/processed. This is silent truncation — precisely the opposite
of the philosophy stated in the Tokenization section ("the interpreter
will report an unexpected character rather than silently
reinterpreting it").

**Addition to the Errors/Limits section:**

> **Actual reference-interpreter behavior:** a token exceeding 64
> characters is silently truncated to its first 64 characters; no
> error is reported. Alternative implementations aiming for
> compatibility with the reference interpreter must replicate this
> behavior as-is, even though it contradicts the "no silent
> reinterpretation" spirit stated in the Tokenization section.
> *(Note: this is a strong candidate for a fix in a future non-frozen
> version, since it contradicts the spec's own stated principle — but
> for the frozen v1.0, this silent-truncation behavior is what's
> binding.)*

---

## E5. Behavior of `==` (read) at EOF

**Status:** not mentioned anywhere in SPESIFIKASI.md.

```c
int c = getchar();
grid[py][px] = (c == EOF) ? 0 : (unsigned char) c;
```

**Addition to the Instructions section, `==` row:**

> If stdin has already reached EOF when `==` executes, the current
> cell is set to `0` for each remaining repetition (not left
> unchanged, not an error).

---

## Summary of suggested changes to SPESIFIKASI.md

| # | Section to update | Type of issue |
|---|---|---|
| E1 | Instructions | Real feature, undocumented |
| E2 | Repetition notation | Description ("alternating") is incorrect/misleading |
| E3 | Tokenization rule / Repetition notation | Implicit rule, needs to be made explicit |
| E4 | Limits / Errors | Behavior contradicts the spec's own stated principle |
| E5 | Instructions (`==`) | Edge case undefined |

Since v1.0 is frozen, these points should be shipped as a **separate
errata document** (this one) rather than edited directly into
SPESIFIKASI.md — unless the project decides to release a v1.0.1 that
explicitly adds only clarifications without changing behavior.
