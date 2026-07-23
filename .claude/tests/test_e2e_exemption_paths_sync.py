"""Guard: `e2e.yml`'s `paths-ignore` must stay inside PROJECT.md's e2e
exemption whitelist.

The two are a hand-synced pair. PROJECT.md §e2e 면제 화이트리스트 decides when a
*human or agent* may skip e2e; `.github/workflows/e2e.yml`'s `paths-ignore`
decides when *CI* skips it. Nothing bound them, and they had already drifted:
`.github/**` sat in the whitelist while the workflow lacked it, so every
CI-definition-only PR burned a full e2e run. That was fixed by hand in
`review/code/2026/07/23/16_02_39` I3 — value corrected, no guard added — and W3
of the same review deferred the guard rather than stack a third hand-written
parser onto a PR already criticised for two.

**The two directions are not equally dangerous, and this file treats them
differently.**

- `paths-ignore` WIDER than the whitelist → CI skips e2e for a change the
  policy says must run it. A real code change ships untested. **Hard failure.**
- `paths-ignore` NARROWER → CI runs e2e when it could have skipped. Wasteful,
  never unsafe. Allowed, but each such entry must be named in
  `UNMIRRORED_WHITELIST_ENTRIES` with a reason, so *adding* a whitelist entry
  forces a conscious decision about CI instead of silently diverging — which is
  exactly how the `.github/**` gap survived.

Parsing is stdlib-only (see `.claude/tests/README.md`) and both parsers take
**text**, not paths, so `ParserBoundaryTest` can pin the edges — inline
comments, quote styles, dedent — before the real files are ever read. Both
parsers also assert they found something, so a parser that silently returns
nothing fails loudly instead of passing vacuously.
"""

from __future__ import annotations

import re
import unittest

import _harness  # noqa: F401  — side effect: harness path setup

REPO_ROOT = _harness.REPO_ROOT
E2E_WORKFLOW = REPO_ROOT / ".github" / "workflows" / "e2e.yml"
PROJECT_MD = REPO_ROOT / "PROJECT.md"

WHITELIST_HEADING = "## e2e 면제 화이트리스트"

# Whitelist entries deliberately NOT mirrored into `paths-ignore`, with the
# reason each one stays out. Anything else missing from the workflow fails
# `test_every_whitelist_entry_is_mirrored_or_explained`.
UNMIRRORED_WHITELIST_ENTRIES = {
    # Root-level docs — the workflow's `*.md` entry already covers these.
    "CLAUDE.md": "covered by the workflow's `*.md` entry",
    "AGENTS.md": "covered by the workflow's `*.md` entry",
    "README.md": "covered by the workflow's `*.md` entry",
    "PROJECT.md": "covered by the workflow's `*.md` entry",
    # GitHub path filters do not let `*` cross `/`, so a root-level `*.mdx`
    # would match nothing: every .mdx in this repo lives under
    # codebase/frontend/src/content/docs/.
    "*.mdx": "a root-level `*.mdx` filter would match no file in this repo",
    # Exempt for a human reading a diff, but the guide pages feed the Next
    # build that e2e boots, and `e2e/workspaces/slug-routing.spec.ts` navigates
    # `/docs` — a page that stops rendering would surface only there. CI stays
    # conservative on purpose.
    "codebase/frontend/src/content/docs/**":
        "guide pages feed the Next build e2e boots; slug-routing.spec.ts hits /docs",
    # The whitelist exempts this *conditionally* ("사전 키만; 호출 코드 변경
    # 없음"). A path filter cannot check the condition, so mirroring it would
    # exempt more than the policy does.
    "codebase/frontend/src/lib/i18n/dict/**":
        "conditional exemption a path filter cannot express",
}


def _yaml_scalar(raw: str) -> str:
    """One `- value` item: strip quotes and any trailing comment.

    Quoted values end at the closing quote, so a `#` inside quotes is content.
    Unquoted values end at ` #`, matching YAML's rule that a comment needs
    preceding whitespace.
    """
    raw = raw.strip()
    if raw[:1] in ("'", '"'):
        quote = raw[0]
        end = raw.find(quote, 1)
        if end == -1:
            raise ValueError(f"unterminated quote in list item: {raw!r}")
        return raw[1:end]
    cut = raw.find(" #")
    if cut != -1:
        raw = raw[:cut]
    return raw.strip()


def parse_paths_ignore_blocks(text: str) -> list[list[str]]:
    """Every `paths-ignore:` list in a workflow, in file order.

    Deliberately not a YAML parser — it recognises exactly one shape (a
    `paths-ignore:` key followed by more-indented `- item` lines) and stops at
    the first line that is not that. A workflow written some other legal way
    would yield an empty block, which the non-vacuity tests catch.
    """
    blocks: list[list[str]] = []
    lines = text.split("\n")
    i = 0
    while i < len(lines):
        header = re.match(r"^(\s*)paths-ignore:\s*(#.*)?$", lines[i])
        if header is None:
            i += 1
            continue
        indent = len(header.group(1))
        items: list[str] = []
        i += 1
        while i < len(lines):
            line = lines[i]
            if not line.strip() or line.lstrip().startswith("#"):
                i += 1
                continue
            if len(line) - len(line.lstrip()) <= indent:
                break
            item = re.match(r"^\s*-\s+(.*)$", line)
            if item is None:
                break
            items.append(_yaml_scalar(item.group(1)))
            i += 1
        blocks.append(items)
    return blocks


def parse_exemption_whitelist(text: str) -> list[str]:
    """Backticked path patterns from PROJECT.md's exemption bullet list.

    Only the bullet list counts. The paragraph above it also carries backticked
    tokens (`.ts`, `Dockerfile`, …) but those name code that *forces* e2e — the
    exact opposite — so scanning the whole section would invert the meaning.
    Bullets carrying no backticks ("주석 전용 변경", "이미지·로고·폰트 등 정적
    자산") contribute nothing, which is correct: they are not path patterns.
    """
    start = text.find(WHITELIST_HEADING)
    if start == -1:
        raise ValueError(f"{WHITELIST_HEADING!r} not found in PROJECT.md")
    patterns: list[str] = []
    in_list = False
    for line in text[start:].split("\n")[1:]:
        if line.startswith("- "):
            in_list = True
            patterns.extend(re.findall(r"`([^`]+)`", line))
        elif in_list and line.strip():
            break
    return patterns


class ParserBoundaryTest(unittest.TestCase):
    """Edges pinned on injected text, before the real files are involved."""

    def test_reads_a_simple_block(self):
        text = "on:\n  push:\n    paths-ignore:\n      - 'a/**'\n      - 'b/**'\n"
        self.assertEqual(parse_paths_ignore_blocks(text), [["a/**", "b/**"]])

    def test_handles_every_quote_style(self):
        text = (
            "    paths-ignore:\n"
            "      - 'single/**'\n"
            '      - "double/**"\n'
            "      - unquoted/**\n"
        )
        self.assertEqual(
            parse_paths_ignore_blocks(text),
            [["single/**", "double/**", "unquoted/**"]],
        )

    def test_strips_inline_comments_but_not_hashes_inside_quotes(self):
        text = (
            "    paths-ignore:\n"
            "      - 'a/**'   # why a is exempt\n"
            "      - b/**  # why b is exempt\n"
            "      - 'lit#eral/**'\n"
        )
        self.assertEqual(
            parse_paths_ignore_blocks(text),
            [["a/**", "b/**", "lit#eral/**"]],
        )

    def test_skips_blank_lines_and_whole_line_comments(self):
        text = (
            "    paths-ignore:\n"
            "      - 'a/**'\n"
            "\n"
            "      # a note about b\n"
            "      - 'b/**'\n"
        )
        self.assertEqual(parse_paths_ignore_blocks(text), [["a/**", "b/**"]])

    def test_stops_at_the_next_key_at_or_below_the_block_indent(self):
        text = (
            "  push:\n"
            "    paths-ignore:\n"
            "      - 'a/**'\n"
            "    branches: [main]\n"
            "  pull_request:\n"
            "    paths: ['x/**']\n"
        )
        self.assertEqual(parse_paths_ignore_blocks(text), [["a/**"]])

    def test_reads_each_block_separately(self):
        text = (
            "  push:\n    paths-ignore:\n      - 'a/**'\n"
            "  pull_request:\n    paths-ignore:\n      - 'b/**'\n"
        )
        self.assertEqual(parse_paths_ignore_blocks(text), [["a/**"], ["b/**"]])

    def test_absent_key_yields_no_blocks(self):
        self.assertEqual(parse_paths_ignore_blocks("on:\n  push:\n"), [])

    def test_unterminated_quote_raises_rather_than_guessing(self):
        with self.assertRaises(ValueError):
            parse_paths_ignore_blocks("    paths-ignore:\n      - 'a/**\n")

    def test_whitelist_reads_only_the_bullet_list(self):
        text = (
            f"{WHITELIST_HEADING}\n\n"
            "코드 변경 (`.ts` / `.tsx` / `Dockerfile`) 이 포함되면 수행:\n\n"
            "- `*.md` · `*.mdx` 본문\n"
            "- `spec/**` · `plan/**`\n"
            "- 주석 전용 변경 (코드 라인 0줄)\n"
            "\n"
            "위 목록 밖이면 `.ts` 든 뭐든 면제 불가.\n"
        )
        self.assertEqual(
            parse_exemption_whitelist(text),
            ["*.md", "*.mdx", "spec/**", "plan/**"],
        )

    def test_whitelist_missing_heading_raises(self):
        with self.assertRaises(ValueError):
            parse_exemption_whitelist("# PROJECT\n\nno such section\n")


class WorkflowMirrorsWhitelistTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.blocks = parse_paths_ignore_blocks(
            E2E_WORKFLOW.read_text(encoding="utf-8")
        )
        cls.whitelist = parse_exemption_whitelist(
            PROJECT_MD.read_text(encoding="utf-8")
        )

    def test_parsers_found_something(self):
        """Non-vacuity: an empty parse would make every check below trivially
        pass, which is how a guard dies silently."""
        self.assertTrue(self.blocks, "no paths-ignore block parsed from e2e.yml")
        self.assertTrue(all(self.blocks), "a parsed paths-ignore block was empty")
        self.assertGreaterEqual(
            len(self.whitelist), 5, "suspiciously few whitelist patterns parsed"
        )

    def test_every_trigger_shares_one_paths_ignore(self):
        """`push` and `pull_request` each carry their own copy. They drift as
        easily as the workflow drifts from PROJECT.md — a pattern added to one
        would silently leave the other running e2e."""
        self.assertGreaterEqual(len(self.blocks), 2, "expected push + pull_request")
        first = self.blocks[0]
        for i, block in enumerate(self.blocks[1:], start=1):
            self.assertEqual(
                block, first,
                f"paths-ignore block {i} differs from the first — the workflow's "
                f"triggers disagree about what skips e2e",
            )

    def test_no_paths_ignore_entry_escapes_the_whitelist(self):
        """The unsafe direction. An entry here that PROJECT.md does not exempt
        means CI skips e2e for changes the policy says must run it."""
        extra = sorted(set(self.blocks[0]) - set(self.whitelist))
        self.assertEqual(
            extra, [],
            f"e2e.yml skips e2e for {extra}, which PROJECT.md §e2e 면제 "
            f"화이트리스트 does not exempt — CI would let untested code through. "
            f"Either add it to the whitelist (with justification) or drop it "
            f"from paths-ignore.",
        )

    def test_every_whitelist_entry_is_mirrored_or_explained(self):
        """The wasteful direction — allowed, but never silently.

        This is the check that would have caught `.github/**`: it sat in the
        whitelist, was absent from the workflow, and nothing said so.
        """
        mirrored = set(self.blocks[0])
        for pattern in self.whitelist:
            if pattern in mirrored:
                continue
            self.assertIn(
                pattern, UNMIRRORED_WHITELIST_ENTRIES,
                f"PROJECT.md exempts {pattern!r} from e2e but e2e.yml still runs "
                f"e2e for it. Mirror it into paths-ignore, or record why not in "
                f"UNMIRRORED_WHITELIST_ENTRIES.",
            )

    def test_unmirrored_list_has_no_stale_entries(self):
        """A pattern removed from PROJECT.md — or since mirrored — must not
        keep an excuse on file, or the list slowly becomes fiction."""
        mirrored = set(self.blocks[0])
        for pattern in UNMIRRORED_WHITELIST_ENTRIES:
            self.assertIn(
                pattern, self.whitelist,
                f"UNMIRRORED_WHITELIST_ENTRIES explains {pattern!r}, which is no "
                f"longer in PROJECT.md's whitelist — drop the entry.",
            )
            self.assertNotIn(
                pattern, mirrored,
                f"UNMIRRORED_WHITELIST_ENTRIES still excuses {pattern!r}, but "
                f"e2e.yml now mirrors it — drop the entry.",
            )

    def test_every_unmirrored_entry_states_a_reason(self):
        for pattern, reason in UNMIRRORED_WHITELIST_ENTRIES.items():
            self.assertTrue(
                reason and reason.strip(),
                f"{pattern!r} is excused without a reason",
            )


if __name__ == "__main__":
    unittest.main()
