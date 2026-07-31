"""A file dropped from a reviewer prompt must say so.

`build_files_section` fills the whole-file-content budget smallest-file-first
and stops at the first file that does not fit (`break`). Every LARGER file then
received its header and nothing else. When the review is prepared from explicit
file arguments there is no diff either, so those sections carried only the two
metadata lines — and a reviewer cannot tell "this file is empty" from "this file
was withheld", so it reports on the file as though it had read it.

Measured on `review/code/2026/07/31/11_07_48` — this repo's own review of the
branch that added this test: the changeset's two largest files,
`.claude/hooks/_lib/review_guard.py` and
`.claude/skills/code-review-agents/scripts/code_review_orchestrator.py`, came
out as 31-byte sections in **all 14** reviewer prompts with no marker of any
kind. They were that PR's two core files. Several reviewers rescued themselves
by running `git diff`, but that is per-reviewer and unreliable — the same
uneven-workaround pattern already recorded for the consistency bundler.

This is the code-review-side twin of the fix `test_consistency_context_budget`
pins on the consistency side: cut on file boundaries, and NAME what was cut.

Fresh-interpreter convention as in `test_consistency_context_budget`: importing
the orchestrator in-process collides on the name `_lib`.
"""

from __future__ import annotations

import json
import subprocess
import sys
import textwrap
import unittest

from _harness import REPO_ROOT

ORCH = (
    REPO_ROOT / ".claude" / "skills" / "code-review-agents" / "scripts"
    / "code_review_orchestrator.py"
)

_PREAMBLE = textwrap.dedent(
    f"""
    import importlib.util, json, re, sys
    spec = importlib.util.spec_from_file_location("orch", {str(ORCH)!r})
    orch = importlib.util.module_from_spec(spec)
    sys.modules["orch"] = orch
    spec.loader.exec_module(orch)

    def emit(value):
        sys.stdout.write("<<<" + json.dumps(value) + ">>>")

    def change_info(path, body):
        # Real builder, not a hand-rolled dict — the shape it produces is the
        # thing under test, and guessing it wrong hides real failures.
        return orch.build_cli_change_info(path, diff_content="", file_content=body)

    def sections(body):
        out = []
        for p in re.split(r"(?m)^### ", body)[1:]:
            name, _, rest = p.partition("\\n")
            out.append({{"name": name.strip(), "body": rest}})
        return out

    ARG = json.loads(sys.stdin.read() or "null")
    """
)


def run_in_orchestrator(snippet: str, arg=None):
    proc = subprocess.run(
        [sys.executable, "-c", _PREAMBLE + textwrap.dedent(snippet)],
        input=json.dumps(arg), cwd=str(REPO_ROOT),
        capture_output=True, text=True,
        # Sibling suites set one too — without it a hang in the target code
        # blocks the run forever instead of failing.
        timeout=30.0,
    )
    if proc.returncode != 0:
        raise AssertionError(proc.stderr[-3000:])
    out = proc.stdout
    return json.loads(out[out.index("<<<") + 3:out.rindex(">>>")])


def build(files, max_total):
    """Return per-section {name, body, has_content, has_notice}."""
    return run_in_orchestrator(
        """
        cis = [change_info(p, b) for p, b in ARG["files"]]
        body = orch.build_files_section(cis, 10_000_000, ARG["max_total"])
        out = []
        for s in sections(body):
            out.append({
                "name": s["name"],
                "size": len(s["body"]),
                "has_content": orch.FULL_CONTEXT_HEADING in s["body"]
                               and "```" in s["body"],
                "has_notice": "전혀 실리지 않았습니다" in s["body"],
            })
        emit(out)
        """,
        {"files": files, "max_total": max_total},
    )


SMALL = ("small.py", "x = 1\n")
BIG = ("big.py", "y = 2\n" * 4000)
BIGGER = ("bigger.py", "z = 3\n" * 5000)

# Content is included smallest-first and the loop `break`s at the first file
# that does not fit — that file still gets a TRUNCATED body (the `available >
# 200` branch), so it was never the silent one. The silent ones are the files
# AFTER the break, which the loop never reaches. That is the production shape
# too: 11 files, budget exhausted partway, the two largest left blank.
_CASE = [SMALL, BIG, BIGGER]
_MAX = 2000


class OmittedContentIsAnnouncedTest(unittest.TestCase):
    def test_file_after_the_break_is_named_not_left_blank(self):
        out = build(_CASE, max_total=_MAX)
        by = {s["name"].split(": ", 1)[1]: s for s in out}
        self.assertTrue(by["small.py"]["has_content"], "small file should fit")
        self.assertFalse(by["bigger.py"]["has_content"],
                         "the file past the break should carry no content")
        self.assertTrue(by["bigger.py"]["has_notice"],
                        "a dropped file must announce itself")

    def test_the_notice_names_the_path_to_read(self):
        body = run_in_orchestrator(
            """
            cis = [change_info(p, b) for p, b in ARG["files"]]
            emit(orch.build_files_section(cis, 10_000_000, ARG["max_total"]))
            """,
            {"files": _CASE, "max_total": _MAX},
        )
        self.assertIn("bigger.py", body)
        self.assertIn("Read", body, "the notice must tell the reviewer what to do")

    def test_no_section_is_left_unexplained(self):
        """The property that failed in production: a section with neither
        content nor an explanation. Asserted over ALL sections rather than a
        named one — the original bug dropped TWO files, so an assertion that
        happened to name the other would still have passed."""
        out = build(_CASE, max_total=_MAX)
        silent = [s["name"] for s in out
                  if not s["has_content"] and not s["has_notice"]]
        self.assertEqual(silent, [])

    def test_notices_are_paid_for_out_of_the_same_budget(self):
        """The notice is document text, so it must fit inside `max_total_size`.

        The first version of this feature appended notices AFTER the budget was
        spent, so a payload with many omissions overran its own cap — measured
        at 143,620 against a 143,605 cap (14 notices ≈ 2,042 chars). The
        existing `test_line_anchors` size-cap test caught it, but only by
        accident of repo state: it picks a real commit out of history, so which
        changeset it exercises drifts with every commit. This case is fixed
        input — it cannot stop exercising the overflow.
        """
        many = [(f"f{i:02d}.py", f"v{i} = 0\n" * 300) for i in range(20)]
        for max_total in (5_000, 8_000, 12_000):
            with self.subTest(max_total=max_total):
                body = run_in_orchestrator(
                    """
                    cis = [change_info(p, b) for p, b in ARG["files"]]
                    emit(orch.build_files_section(cis, 10_000_000,
                                                  ARG["max_total"]))
                    """,
                    {"files": many, "max_total": max_total},
                )
                notices = body.count("전혀 실리지 않았습니다")
                self.assertGreater(notices, 1,
                                   "case is vacuous unless notices accumulate")
                self.assertLessEqual(len(body), max_total)

    def test_many_files_collapse_to_one_notice_and_still_fit(self):
        """Reserving per-file notices only works while a budget for them exists.

        Past enough files the headers alone eat the cap, nothing gets content,
        and one notice per file overruns anyway — measured at 1,200 files:
        192,087 against the production 141,557 cap (1.36x). Reserving harder
        cannot fix that, so the notices collapse into a single aggregate one.

        The 20-file case above cannot see this: it never drives the budget
        negative. The two assertions together are the real contract — stay under
        the cap AND still tell the reviewer files were withheld. Dropping the
        notice entirely would satisfy the first and defeat the feature.
        """
        cap = 141_557  # DEFAULT_MAX_PROMPT_SIZE, the production value
        many = [(f"f{i:04d}.py", f"v{i} = 0\n" * 300) for i in range(1200)]
        body = run_in_orchestrator(
            """
            cis = [change_info(p, b) for p, b in ARG["files"]]
            emit(orch.build_files_section(cis, 10_000_000, ARG["max_total"]))
            """,
            {"files": many, "max_total": cap},
        )
        self.assertLessEqual(len(body), cap)
        self.assertIn("실리지 않았습니다", body)
        self.assertIn("Read", body)

    def test_diff_only_overflow_branch_also_announces(self):
        """`build_files_section` has TWO overflow paths and both can hide files.

        When headers + diffs alone exceed the cap, the function returns early on
        a separate branch that never looks at `full_content` — so no file got
        whole-file context and, before this, nothing said so. The first fix only
        touched the other branch, and the fixtures above never reach this one
        because they carry no diff.
        """
        files = [(f"d{i}.py", f"q{i} = 0\n" * 200) for i in range(4)]
        body = run_in_orchestrator(
            """
            cis = []
            for p, b in ARG["files"]:
                ci = change_info(p, b)
                ci["code"] = "@@ -1 +1 @@\\n+" + b   # force a large diff
                cis.append(ci)
            emit(orch.build_files_section(cis, 10_000_000, ARG["max_total"]))
            """,
            {"files": files, "max_total": 1500},
        )
        self.assertIn("어떤 파일의 전체 내용도 실리지", body)
        self.assertIn("Read", body)
        # No cap assertion here on purpose. This branch already overruns
        # `max_total_size` on origin/main — measured 1,681 against a 1,500 cap
        # for this same fixture — because its diff-trimming loop appends
        # `_truncated_note` / the "diff 생략" placeholder without charging their
        # length to `cut`. That is a separate pre-existing defect (tracked in
        # harness-review-gate-ci-backstop.md); this change budgets for the note
        # it adds and comes out marginally SMALLER (1,678). Asserting the cap
        # here would fail for a defect this test does not own.

    def test_silent_when_everything_fits(self):
        out = build([SMALL, ("small2.py", "b = 2\n")], max_total=1_000_000)
        self.assertTrue(all(s["has_content"] for s in out))
        self.assertFalse(any(s["has_notice"] for s in out),
                         "no omission notice when nothing was omitted")


if __name__ == "__main__":
    unittest.main()
