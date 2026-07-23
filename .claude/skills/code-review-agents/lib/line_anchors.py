"""True-source line anchors for reviewer prompt payloads.

Reviewers used to receive the changed-file payload as bare code fences with no
line numbers, so a finding's "위치" was whatever the model counted from the top
of the assembled `_prompts/<agent>.md` — a document that routinely runs past a
thousand lines. There was no way for the reviewer to know a real line number.

Measured on `review/code/2026/07/17/20_06_14/` (3 files, 1,385-line prompt):
every cited number, decoded as an offset into the assembled prompt, landed
inside the full-context block of the very file it was attributed to —
e.g. "hydration-coverage.test.ts line 1362" → prompt L1362 → that file's line
79, and the file is only 99 lines long. `output-shape.ts line 959-994` → that
file's lines 175-210; it is 488 lines long. Seven of seven cited numbers
decoded this way, which is what separates "counted the wrong document" from
"hallucinated a plausible number".

This module puts the real line number in a gutter so a cited location is
checkable against the source. Its one hard rule:

    **Never emit a number we are not sure about.**

A confidently wrong anchor is worse than no anchor — it is the failure this
module exists to remove. So every transformation here fails *open*: on anything
unexpected (an unparseable hunk header, a line count that disagrees with what
git declared, a combined/merge diff) the text is returned verbatim and
un-numbered rather than annotated on a guess.
"""

from __future__ import annotations

import re

# Gutter separator. The number is right-aligned to `width`, then this, then the
# original text verbatim. Diff body lines already begin with their own ' '/'+'/'-'
# marker, so no extra space is added after the bar.
GUTTER_SEP = "|"

# Never narrower than this, so the gutter stays a recognisable column even on
# short files.
MIN_GUTTER_WIDTH = 3

# `@@ -old_start[,old_count] +new_start[,new_count] @@ [section heading]`
# Deliberately anchored and strict: a combined ("@@@", merge) diff does not
# match, and an unmatched header disables annotation for that hunk.
_HUNK_RE = re.compile(r"^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@")

# Lines that mean "a new file's header block starts here", i.e. any open hunk
# has ended. `--- ` / `+++ ` are matched only in their file-header form; a diff
# body line for removed content is `-` followed by content, never `--- `.
_FILE_HEADER_PREFIXES = (
    "diff --git ",
    "diff --cc ",
    "diff --combined ",
    "index ",
    "--- ",
    "+++ ",
    "old mode ",
    "new mode ",
    "new file mode ",
    "deleted file mode ",
    "similarity index ",
    "dissimilarity index ",
    "rename from ",
    "rename to ",
    "copy from ",
    "copy to ",
    "Binary files ",
    "GIT binary patch",
)


def gutter_width(max_lineno: int) -> int:
    """Column width for the largest line number that will be shown."""
    return max(len(str(max(int(max_lineno), 1))), MIN_GUTTER_WIDTH)


def _gutter(lineno, width: int) -> str:
    """Render one gutter cell. `lineno` of None renders as blank (no number)."""
    cell = "" if lineno is None else str(lineno)
    return f"{cell:>{width}}{GUTTER_SEP}"


def number_source_lines(text: str, start: int = 1) -> str:
    """Prefix every line of `text` with its true 1-based source line number.

    `start` allows numbering a slice that does not begin at the top of the file.
    Returns `text` unchanged when it is empty.
    """
    if not text:
        return text
    lines = text.splitlines()
    if not lines:
        return text
    width = gutter_width(start + len(lines) - 1)
    return "\n".join(
        f"{_gutter(start + i, width)}{line}" for i, line in enumerate(lines)
    )


def _split_hunks(lines):
    """Split a unified diff into [(kind, payload)] segments.

    kind is 'other' (payload = list of verbatim lines) or 'hunk'
    (payload = (header_line, [body lines])). Purely structural — no validation.
    """
    segments = []
    pending = []
    i = 0
    n = len(lines)
    while i < n:
        line = lines[i]
        if _HUNK_RE.match(line):
            if pending:
                segments.append(("other", pending))
                pending = []
            body = []
            i += 1
            while i < n:
                nxt = lines[i]
                if _HUNK_RE.match(nxt) or nxt.startswith(_FILE_HEADER_PREFIXES):
                    break
                # Inside a hunk git always emits a leading ' ', '+', '-' or '\'.
                # A bare empty line therefore is not hunk content — in practice
                # it is the trailing element of `text.split("\n")` — so it ends
                # the hunk rather than being mistaken for an empty context line.
                if nxt == "":
                    break
                body.append(nxt)
                i += 1
            segments.append(("hunk", (line, body)))
            continue
        pending.append(line)
        i += 1
    if pending:
        segments.append(("other", pending))
    return segments


def _hunk_is_consistent(header: str, body) -> bool:
    """Does the hunk body contain exactly what its `@@` header declared?

    This is the self-check that lets us trust the numbers: git states the old
    and new line counts in the header, so we replay the body and compare. A
    mismatch means our understanding of the payload is wrong somewhere, and we
    then annotate nothing rather than annotate incorrectly.
    """
    m = _HUNK_RE.match(header)
    if not m:
        return False
    old_declared = int(m.group(2)) if m.group(2) is not None else 1
    new_declared = int(m.group(4)) if m.group(4) is not None else 1
    old_seen = new_seen = 0
    for line in body:
        marker = line[:1]
        if marker == " ":
            old_seen += 1
            new_seen += 1
        elif marker == "+":
            new_seen += 1
        elif marker == "-":
            old_seen += 1
        elif marker == "\\":
            # "\ No newline at end of file" — annotates the preceding line,
            # counts toward neither side.
            continue
        else:
            return False
    return old_seen == old_declared and new_seen == new_declared


def _max_new_lineno(segments) -> int:
    """Largest new-file line number any hunk will print (for gutter width)."""
    high = 1
    for kind, payload in segments:
        if kind != "hunk":
            continue
        m = _HUNK_RE.match(payload[0])
        if not m:
            continue
        new_start = int(m.group(3))
        new_count = int(m.group(4)) if m.group(4) is not None else 1
        high = max(high, new_start + max(new_count - 1, 0))
    return high


def annotate_unified_diff(text: str) -> str:
    """Put the new-file line number in the gutter of a unified diff.

    Context and added lines carry the line number they occupy **in the new
    file** — the number a reviewer gets when they open the file. Removed lines
    do not exist in the new file, so their gutter is intentionally blank; the
    diff's own `-` marker still identifies them.

    Fails open per hunk: a hunk whose header will not parse, or whose body does
    not match the counts git declared, is emitted verbatim with a blank gutter.
    """
    if not text:
        return text
    lines = text.splitlines()
    if not lines:
        return text

    segments = _split_hunks(lines)
    if not any(kind == "hunk" for kind, _ in segments):
        # Not a unified diff (or a format we do not model) — leave it alone
        # rather than dressing it up with a gutter that means nothing.
        return text

    width = gutter_width(_max_new_lineno(segments))
    blank = _gutter(None, width)
    out = []
    for kind, payload in segments:
        if kind == "other":
            out.extend(f"{blank}{line}" for line in payload)
            continue
        header, body = payload
        out.append(f"{blank}{header}")
        if not _hunk_is_consistent(header, body):
            out.extend(f"{blank}{line}" for line in body)
            continue
        new_no = int(_HUNK_RE.match(header).group(3))
        for line in body:
            marker = line[:1]
            if marker in (" ", "+"):
                out.append(f"{_gutter(new_no, width)}{line}")
                new_no += 1
            else:
                # '-' (not in the new file) and '\' (no-newline note).
                out.append(f"{blank}{line}")
    return "\n".join(out)


def truncate_to_line_boundary(text: str, max_chars: int):
    """Cut `text` to at most `max_chars`, never mid-line.

    Returns ``(kept_text, kept_line_count, total_line_count)``. Whole lines are
    kept so a gutter is never sliced in half — a half-written line number is
    precisely the kind of wrong anchor this module exists to prevent.
    """
    if max_chars is None or max_chars <= 0 or not text:
        return "", 0, len(text.splitlines()) if text else 0
    lines = text.splitlines()
    total = len(lines)
    if len(text) <= max_chars:
        return text, total, total
    kept = []
    used = 0
    for line in lines:
        cost = len(line) + (1 if kept else 0)
        if used + cost > max_chars:
            break
        kept.append(line)
        used += cost
    return "\n".join(kept), len(kept), total
