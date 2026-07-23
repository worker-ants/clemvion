"""`router_safety.py`'s policy matrix (and README's mirror of it) must agree
with the constants they claim to describe.

The module docstring calls itself "정책의 단일 진실 원천" and README says
"정책 변경 시 두 곳을 같이 갱신하라" — a manual-sync obligation that nothing
enforced. It had already slipped: both tables advertised "24 extensions" while
`_SOURCE_CODE_EXTENSIONS` held **44**, stale since the set grew after
2026-05-16. Found by `/ai-review` on 2026-07-23 (INFO 3, session
`review/code/2026/07/23/15_59_54`).

The first version of this guard then missed half the defect: it checked the
docstring's count and README's *spelled-out list*, and described that as
covering "both docs" — while README's own table row still read "24 확장자" and
the suite stayed green. `/ai-review` caught it as CRITICAL on the very commit
meant to end this drift (session `review/code/2026/07/23/16_30_52`). Both counts
are now checked by name, plus a phrasing-agnostic sweep, because the original
miss came from grepping one spelling (`24 extensions`, `24개`) and never
matching the Korean `24 확장자`.

Prose-checking on purpose — the documented exception in `.claude/tests/README.md`
for documents that *are* the specification rather than a rendering of one. This
docstring is the stated SSOT for a policy that decides which reviewers run, so
its numbers and lists are load-bearing, not decoration.

Driven by subprocess: `router_safety` imports `skills/_lib.project_config`
while `_harness` binds `_lib` to the *hooks* package, and the two cannot both
own that name in one interpreter.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
import unittest

from _harness import REPO_ROOT

SKILL_DIR = REPO_ROOT / ".claude" / "skills" / "code-review-agents"
ROUTER_SAFETY = SKILL_DIR / "lib" / "router_safety.py"
README = SKILL_DIR / "README.md"
ORCH = SKILL_DIR / "scripts" / "code_review_orchestrator.py"


def _router_safety_values() -> dict:
    """Read the live constants out of `router_safety` via its own interpreter."""
    script = (
        f"import sys, json\n"
        f"sys.path.insert(0, {str(SKILL_DIR)!r})\n"
        f"sys.path.insert(0, {str(SKILL_DIR.parent)!r})\n"
        f"from lib import router_safety as rs\n"
        f"print(json.dumps({{"
        f"'extensions': sorted(rs._SOURCE_CODE_EXTENSIONS),"
        f"'source_forced': list(rs._SOURCE_FORCED_REVIEWERS),"
        f"'rules': [list(r[0]) for r in rs._RULES],"
        f"'rule_count': len(rs._RULES)}}))\n"
    )
    r = subprocess.run(
        [sys.executable, "-c", script],
        capture_output=True, text=True, cwd=str(REPO_ROOT),
    )
    if r.returncode != 0:
        raise AssertionError(f"could not load router_safety: {r.stderr[-1500:]}")
    return json.loads(r.stdout.strip().splitlines()[-1])


def _all_agents() -> list:
    r = subprocess.run(
        [sys.executable, "-c",
         f"import runpy, sys, json; sys.argv=['x'];"
         f"m=runpy.run_path({str(ORCH)!r}); print(json.dumps(m['ALL_AGENTS']))"],
        capture_output=True, text=True, cwd=str(REPO_ROOT),
    )
    if r.returncode != 0:
        raise AssertionError(f"could not load ALL_AGENTS: {r.stderr[-1500:]}")
    return json.loads(r.stdout.strip().splitlines()[-1])


def _tokens(text: str) -> set:
    """Extension/reviewer tokens out of a `a b · c d` style list."""
    return set(re.findall(r"[a-z0-9_]+", text.replace("·", " ")))


class PolicyMatrixMatchesConstantsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.values = _router_safety_values()
        # Cached like `values`: `_all_agents()` shells out, and the row-level
        # checks below consult it once per row.
        cls.agents = _all_agents()
        cls.doc = ROUTER_SAFETY.read_text(encoding="utf-8")
        cls.readme = README.read_text(encoding="utf-8")

    def _doc_extension_list(self) -> set:
        m = re.search(
            r"Source-code extensions counted by `_SOURCE_FORCED_REVIEWERS`:\n"
            r"((?:  .*\n)+)",
            self.doc,
        )
        self.assertIsNotNone(m, "docstring lost its source-extension list")
        return _tokens(m.group(1))

    def _readme_extension_list(self) -> set:
        m = re.search(r"소스 코드 확장자: `([^`]+)`", self.readme)
        self.assertIsNotNone(m, "README lost its source-extension list")
        return _tokens(m.group(1))

    def test_docstring_table_states_the_real_extension_count(self):
        """The drift this file exists for: the table said 24, the set had 44."""
        m = re.search(r"\| Source-code file \((\d+) extensions below\)", self.doc)
        self.assertIsNotNone(m, "policy table lost its source-code row")
        self.assertEqual(
            int(m.group(1)), len(self.values["extensions"]),
            "the docstring table's extension count no longer matches "
            "_SOURCE_CODE_EXTENSIONS",
        )

    def test_readme_table_states_the_real_extension_count(self):
        """README's table carries its own count, in Korean, in a separate row
        from the spelled-out list.

        The first version of this guard checked the docstring count and the
        README *list* and called that "both docs" — so README's table still read
        "24 확장자" and the guard passed. Caught by `/ai-review` (CRITICAL,
        session 2026/07/23/16_30_52) on the very commit that was supposed to end
        this drift.
        """
        m = re.search(r"\| 소스 파일 \((\d+) 확장자\)", self.readme)
        self.assertIsNotNone(m, "README lost its source-code policy row")
        self.assertEqual(
            int(m.group(1)), len(self.values["extensions"]),
            "README's table extension count no longer matches "
            "_SOURCE_CODE_EXTENSIONS",
        )

    def test_no_stale_extension_count_survives_anywhere(self):
        """Belt-and-braces across phrasings: any "(N 확장자)" or "(N extensions"
        in either document must be the real count.

        The miss above happened because a grep for `24 extensions` / `24개`
        never matched the Korean `24 확장자`. Enumerate the shapes instead of
        trusting one spelling.
        """
        expected = len(self.values["extensions"])
        for label, text in (("router_safety.py", self.doc), ("README.md", self.readme)):
            found = re.findall(r"\((\d+)\s*(?:확장자|extensions)", text)
            self.assertTrue(found, f"{label}: no extension count found at all")
            for n in found:
                self.assertEqual(
                    int(n), expected,
                    f"{label}: stale extension count {n} (real set has {expected})",
                )

    def test_docstring_list_is_exactly_the_constant(self):
        self.assertEqual(
            self._doc_extension_list(), set(self.values["extensions"]),
            "the docstring's spelled-out extension list drifted from "
            "_SOURCE_CODE_EXTENSIONS",
        )

    def test_readme_list_is_exactly_the_constant(self):
        self.assertEqual(
            self._readme_extension_list(), set(self.values["extensions"]),
            "README's spelled-out extension list drifted from "
            "_SOURCE_CODE_EXTENSIONS",
        )

    def test_readme_and_docstring_lists_agree(self):
        """README declares itself a mirror of the docstring; hold it to that."""
        self.assertEqual(self._doc_extension_list(), self._readme_extension_list())

    def test_source_row_reviewers_via_independent_parse(self):
        """The source-code row again, read by regex rather than the row parser.

        Overlaps `test_docstring_table_rows_match_their_rules_one_by_one` on
        purpose: every other row assertion depends on `_policy_rows`, so a bug
        that made it silently return the wrong rows would take those tests down
        with it. This one reaches the most important row by a different route.
        """
        m = re.search(
            r"\| Source-code file \(\d+ extensions below\)\s*\|([^|]+)\|", self.doc
        )
        self.assertIsNotNone(m)
        self.assertEqual(
            _tokens(m.group(1)), set(self.values["source_forced"]),
            "the policy table's forced-reviewer list drifted from "
            "_SOURCE_FORCED_REVIEWERS",
        )

    #: Marks the one table in each document that states the routing policy.
    #: Both files hold several unrelated tables (env vars, state schema), so the
    #: rows are anchored to the source-code row rather than "any markdown table".
    _POLICY_TABLE_ANCHOR = re.compile(r"소스 파일 \(\d+ 확장자\)|Source-code file \(\d+ extensions")

    def _policy_rows(self, text):
        """(trigger, forced) for each real row of the routing-policy table.

        Long triggers wrap onto a continuation line whose remaining cells are
        blank; those are not rows. Pairing a row to its `_RULES` entry by prose
        would be guesswork, so the tests below assert set- and count-level
        invariants instead — enough to catch a rule added, dropped, or
        re-targeted without the table following.
        """
        blocks, current = [], []
        for line in text.split("\n"):
            if line.startswith("|"):
                current.append(line)
            elif current:
                blocks.append(current)
                current = []
        if current:
            blocks.append(current)

        table = next(
            (b for b in blocks if any(self._POLICY_TABLE_ANCHOR.search(x) for x in b)),
            None,
        )
        self.assertIsNotNone(table, "routing-policy table not found")

        rows = []
        for line in table:
            cells = [c.strip() for c in line.strip("|").split("|")]
            if len(cells) < 2 or not cells[0] or not cells[1]:
                continue
            if cells[0].startswith("-") or cells[0] in ("Trigger",):
                continue
            rows.append((cells[0], cells[1]))
        return rows

    def _reviewers_named_in(self, cell: str) -> set:
        """Reviewer names a "Forced reviewers" cell actually declares.

        Parentheticals are dropped first: `requirement (+ documentation via doc
        rule above)` declares only `requirement`, the rest being a
        cross-reference to another row. Then intersected with the real roster,
        since raw tokenising would otherwise read "via"/"rule"/"above" as
        reviewer names.
        """
        return _tokens(re.sub(r"\([^)]*\)", " ", cell)) & set(self.agents)

    def test_docstring_table_has_a_row_per_rule(self):
        """`_RULES` + the source-code blanket rule + the unclassified fallthrough."""
        rows = self._policy_rows(self.doc)
        self.assertEqual(
            len(rows), self.values["rule_count"] + 2,
            f"policy table has {len(rows)} rows for "
            f"{self.values['rule_count']} rules — a rule was added or removed "
            f"without the table following",
        )

    def test_docstring_table_rows_match_their_rules_one_by_one(self):
        """Each row's reviewers, against the rule that row describes.

        Row 0 is the source-code blanket rule, rows 1..N are `_RULES` in order,
        the last is the unclassified fallthrough — verified positional, not
        guessed from prose.

        Replaces an earlier union-level check that compared *all* reviewer names
        at once. That was too weak to be worth having: deleting `documentation`
        from the "Package manifest" row left the union unchanged, because
        `documentation` also appears in the "Doc file" row, so the mutation
        passed. Caught by `/ai-review` (WARNING, session 2026/07/23/16_49_22),
        which reproduced it rather than merely asserting it.
        """
        rows = self._policy_rows(self.doc)
        rules = self.values["rules"]
        self.assertEqual(len(rows), len(rules) + 2, "row/rule count mismatch")

        self.assertEqual(
            self._reviewers_named_in(rows[0][1]), set(self.values["source_forced"]),
            "the source-code row's reviewers drifted from _SOURCE_FORCED_REVIEWERS",
        )
        for i, reviewers in enumerate(rules):
            trigger, forced = rows[i + 1]
            self.assertEqual(
                self._reviewers_named_in(forced), set(reviewers),
                f"docstring row {i + 1} ({trigger[:40]!r}) declares reviewers that "
                f"_RULES[{i}] does not force",
            )

    def test_readme_table_rows_match_the_docstring_row_by_row(self):
        """README calls itself a mirror — hold it to the cell contents, not just
        the row count.

        Row count alone let README's source row drop `testing` entirely while
        the suite stayed green (`/ai-review` WARNING, reproduced by mutation).
        """
        doc_rows = self._policy_rows(self.doc)
        readme_rows = self._policy_rows(self.readme)
        self.assertEqual(
            len(readme_rows), len(doc_rows),
            "README's router-safety table and the docstring's have different "
            "row counts — the declared mirror has drifted",
        )
        for i, (doc_row, readme_row) in enumerate(zip(doc_rows, readme_rows)):
            self.assertEqual(
                self._reviewers_named_in(readme_row[1]),
                self._reviewers_named_in(doc_row[1]),
                f"README policy row {i} names different reviewers than the "
                f"docstring's ({readme_row[0][:40]!r})",
            )

    def test_readme_source_row_matches_the_constant_directly(self):
        """Not only equal to the docstring — equal to the code.

        Without this, both documents drifting the same way would still pass the
        mirror check above.
        """
        rows = self._policy_rows(self.readme)
        self.assertEqual(
            self._reviewers_named_in(rows[0][1]),
            set(self.values["source_forced"]),
            "README's source-code row drifted from _SOURCE_FORCED_REVIEWERS",
        )

    def test_readme_rule_rows_match_their_rules_one_by_one(self):
        rows = self._policy_rows(self.readme)
        for i, reviewers in enumerate(self.values["rules"]):
            trigger, forced = rows[i + 1]
            self.assertEqual(
                self._reviewers_named_in(forced), set(reviewers),
                f"README row {i + 1} ({trigger[:40]!r}) declares reviewers that "
                f"_RULES[{i}] does not force",
            )

    #: Every doc that states how many reviewers are registered. The count is
    #: `len(ALL_AGENTS)` and lives in prose, so it drifts the same way the
    #: extension count did — found by sweeping for it after that defect, not by
    #: waiting for it to break.
    ROSTER_COUNT_DOCS = (
        SKILL_DIR / "SKILL.md",
        SKILL_DIR / "README.md",
        SKILL_DIR / "lib" / "router_safety.py",
        REPO_ROOT / ".claude" / "agents" / "review-router.md",
    )
    ROSTER_COUNT_RE = re.compile(r"디폴트 (\d+)개|default (\d+)[;,)]")

    def test_every_documented_reviewer_count_matches_all_agents(self):
        """The count is repeated in six places across four files.

        Same shape as the extension-count drift: a number restated in prose with
        nothing binding it to `ALL_AGENTS`. Asserted across every document that
        states it, so adding a reviewer fails here instead of leaving five
        stale copies behind.
        """
        expected = len(self.agents)
        seen = 0
        for path in self.ROSTER_COUNT_DOCS:
            text = path.read_text(encoding="utf-8")
            for m in self.ROSTER_COUNT_RE.finditer(text):
                n = int(m.group(1) or m.group(2))
                seen += 1
                self.assertEqual(
                    n, expected,
                    f"{path.name}: says {n} reviewers, ALL_AGENTS has {expected}",
                )
        self.assertGreaterEqual(
            seen, 6, f"only found {seen} reviewer-count claims — the sweep's "
            "patterns stopped matching, so it is no longer guarding anything",
        )

    def test_reviewer_roster_count_and_names_match_the_orchestrator(self):
        agents = self.agents
        m = re.search(
            r"Reviewer codes \(default (\d+);[^)]*\):\n((?:  .*\n)+)", self.doc
        )
        self.assertIsNotNone(m, "docstring lost its reviewer roster")
        self.assertEqual(
            int(m.group(1)), len(agents),
            "the docstring's reviewer count drifted from ALL_AGENTS",
        )
        self.assertEqual(
            _tokens(m.group(2)), set(agents),
            "the docstring's reviewer names drifted from ALL_AGENTS",
        )


if __name__ == "__main__":
    unittest.main()
