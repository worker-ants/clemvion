"""Tests for the spec mirror anchor link ratchet — `.claude/tools/nerv-mirror/anchor_check.py` and its
slug table `slug_ranges.py` (NERV Task `CLE-T-9X3K5D`).

고정하는 것:
- slug: 프런트 docs 가드(`spec-links.ts`, mdast + github-slugger 2.0.0)와 같은 값. 한글 · 날짜 괄호 ·
  `·` · `→` · `_` · 인라인 코드 · 강조 · 링크 · 엔티티 · 이스케이프 · 이모지 · 닫는 `#` 사례를 손으로
  고정했다(2026-11-28 mdast 로 확인한 값). 중복 제목은 문서 순서대로 `-1` · `-2` 다.
- 제목: ATX 만 센다. 코드 블록 안 `#` 줄 · `결정일:` 줄 · setext 밑줄은 제목이 아니다.
- 링크: 다른 미러 문서 링크 · 같은 문서 `](#…)` · 미러에 없는 키 링크를 본다. 코드 블록 · 인라인 코드
  안과 스펙이 아닌 대상은 보지 않는다. 카탈로그 사본은 보지 않는다. `%XX` 앵커는 풀어서 비교한다.
- 래칫: 기준선보다 많은 (문서, 대상#앵커) 쌍은 실패, 줄어든 항목은 알림만. `--update-baseline` 은
  줄이기만 하고 새 항목을 더하지 않는다. 줄 번호는 미러 파일 기준이다.
- slug 표는 오름차순이고 겹치지 않는다. node 와 github-slugger 가 있으면 표 전체와 미러 전체 제목
  slug 를 프런트 라이브러리로 직접 대조한다(없으면 건너뛴다).
- 실제 저장소 미러가 지금 검사를 통과하고, CI `spec-mirror-integrity` 잡이 sparse checkout 에서
  이 도구를 돌린다.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path

import _harness

TOOL_DIR = _harness.REPO_ROOT / ".claude" / "tools" / "nerv-mirror"
WORKFLOW = _harness.REPO_ROOT / ".github" / "workflows" / "spec-link-checks.yml"
FRONTEND = _harness.REPO_ROOT / "codebase" / "frontend"

anchor_check = _harness.load_module_by_path("anchor_check_under_test", TOOL_DIR / "anchor_check.py")
spec_heading = _harness.load_module_by_path(
    "spec_heading_under_test", _harness.REPO_ROOT / ".claude" / "hooks" / "_lib" / "spec_heading.py")
slug_ranges = _harness.load_module_by_path("slug_ranges_under_test", TOOL_DIR / "slug_ranges.py")


def slug_of(heading_md: str) -> str:
    return anchor_check.slug(anchor_check.heading_text(anchor_check.headings(f"# {heading_md}")[0]))


def write_mirror(root: Path, key: str, body: str, area: str | None = None) -> Path:
    folder = root / "spec" / (area or key.rsplit("-", 1)[0])
    folder.mkdir(parents=True, exist_ok=True)
    p = folder / f"{key}.md"
    p.write_text(f'---\nid: "{key}"\ntitle: "t"\n---\n{textwrap.dedent(body)}', encoding="utf-8")
    return p


class SlugTest(unittest.TestCase):
    # (제목 마크다운, mdast + github-slugger 값). 값은 2026-11-28 프런트 라이브러리로 확인했다.
    CASES = [
        ("나간 멤버의 개인 통합은 나갈 때 지운다 (2026-10-29)", "나간-멤버의-개인-통합은-나갈-때-지운다-2026-10-29"),
        ("`src/types/**` 도 범위에 넣은 이유", "srctypes-도-범위에-넣은-이유"),
        ("**강조** 와 _밑줄 강조_ 와 render_* 이름", "강조-와-밑줄-강조-와-render_-이름"),
        ("[링크 글자](CLE-X.md#y) 를 남긴다", "링크-글자-를-남긴다"),
        ("로그인 · 2단계", "로그인--2단계"),
        ("ACCOUNT_LOCKED 423 → 401", "account_locked-423--401"),
        ("R9. 리소스 설정", "r9-리소스-설정"),
        ("A &amp; B", "a--b"),
        ("제목 ##", "제목"),
        ("\\*별표\\* 이스케이프", "별표-이스케이프"),
        ("✅ 완료 🚀", "-완료-"),
        ("C# 언어", "c-언어"),
        ("snake_case_이름 과 __init__", "snake_case_이름-과-init"),
        ("``a `b` c`` 코드", "a-b-c-코드"),
        ("Ⓐ ½ ² 기호", "ⓐ---기호"),
        ("<br> 태그", "br-태그"),
        ("![그림](x.png) 설명", "그림-설명"),
        ("<https://example.com> 주소", "httpsexamplecom-주소"),
        ("끝 공백   ", "끝-공백"),
    ]

    def test_cases_match_frontend_slugger(self):
        for md, want in self.CASES:
            with self.subTest(md=md):
                self.assertEqual(slug_of(md), want)

    def test_duplicate_headings_get_numbered_in_order(self):
        body = "# 같다\n## 같다\n### 같다\n## 같다-1\n"
        # github-slugger: 같다, 같다-1, 같다-2, 그리고 이미 쓴 `같다-1` 은 `같다-1-1` 이 된다.
        self.assertEqual(anchor_check.heading_slugs(body), {"같다", "같다-1", "같다-2", "같다-1-1"})

    def test_empty_slug_is_not_an_anchor(self):
        self.assertEqual(anchor_check.heading_slugs("## ✅\n"), set())


class HeadingsTest(unittest.TestCase):
    def test_only_atx_outside_code(self):
        body = textwrap.dedent("""\
            # 하나
            결정일: 2026-11-28

            ```bash
            # 셸 주석
            ```
            ~~~
            ## 물결 안
            ~~~
            둘
            ---
            #해시만
            ####### 일곱
               ### 셋째
            """)
        self.assertEqual(anchor_check.headings(body), ["하나", "셋째"])

    def test_unclosed_fence_hides_rest(self):
        self.assertEqual(anchor_check.headings("# a\n```\n# b\n"), ["a"])

    def test_inline_backticks_after_fence_marker_is_not_a_fence(self):
        self.assertEqual(anchor_check.headings("``` a ` b\n# c\n"), ["c"])


class FenceParityTest(unittest.TestCase):
    """코드 블록 울타리 판정이 `_lib/spec_heading.py` 와 같은 입력에서 같은 제목 줄을 고르는지 본다."""

    # 닫는 울타리 길이 · 문자 · info 백틱 · 닫히지 않은 울타리 · 들여쓰기 경계를 모두 건드린다.
    BODIES = [
        "## 2026-01-01 밖\n",
        "```\n## 2026-01-02 안\n```\n## 2026-01-03 밖\n",
        "~~~\n## 2026-01-04 안\n```\n## 2026-01-05 안\n~~~\n## 2026-01-06 밖\n",
        "````\n```\n## 2026-01-07 안\n```\n````\n## 2026-01-08 밖\n",
        "``` a`b\n## 2026-01-09 밖(울타리 아님)\n",
        "   ```\n## 2026-01-10 안\n   ```  \n## 2026-01-11 밖\n",
        "    ```\n## 2026-01-12 밖(들여쓰기 코드)\n",
        "```\n## 2026-01-13 닫히지 않음\n",
        "```\n```x\n## 2026-01-14 안(닫는 울타리 아님)\n```\n",
    ]

    def test_same_date_headings_outside_fences(self):
        for body in self.BODIES:
            ours = [raw for raw in anchor_check.headings(body) if spec_heading._DATE.search(raw)]
            lib = [line for line in spec_heading.date_headings(body)]
            # `date_headings` 는 닫히지 않은 울타리 안의 날짜 제목도 센다(보수적). 그 경우만 다르다.
            unclosed = body.count("```") % 2 == 1 and "닫히지 않음" in body
            if unclosed:
                continue
            self.assertEqual([l.lstrip("# ").strip() for l in lib], [o.strip() for o in ours], body)


class LinksTest(unittest.TestCase):
    def test_finds_anchor_links_outside_code(self):
        body = textwrap.dedent("""\
            [a](../CLE-X/CLE-X-Y.md#제목) [b](#여기) [c](CLE-X-Y.md) [d](https://e.com/#x)
            `[e](#코드)`
            ```
            [f](#블록)
            ```
            """)
        self.assertEqual(anchor_check.anchor_links(body),
                         [(1, "../CLE-X/CLE-X-Y.md#제목"), (1, "#여기"), (1, "https://e.com/#x")])


class BrokenLinksTest(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.root, ignore_errors=True)

    def test_judges_each_kind(self):
        write_mirror(self.root, "CLE-T-TARGET", "## 있는 제목 (2026-10-29)\n## 같은\n## 같은\n", area="CLE-T")
        write_mirror(self.root, "CLE-T-SRC", textwrap.dedent("""\
            # 자기 제목
            [ok](CLE-T-TARGET.md#있는-제목-2026-10-29)
            [dup](CLE-T-TARGET.md#같은-1)
            [enc](CLE-T-TARGET.md#%EC%9E%88%EB%8A%94-%EC%A0%9C%EB%AA%A9-2026-10-29)
            [self](#자기-제목)
            [gone](CLE-T-TARGET.md#있는-제목)
            [selfgone](#없는-제목)
            [nodoc](CLE-T-NONE#무엇)
            [catalog](CLE-C24-CATALOG#5-coverage-matrix)
            [code](../../codebase/x.ts#L1)
            """), area="CLE-T")
        got = anchor_check.broken_links(self.root / "spec")
        # frontmatter 세 줄 + 여는 · 닫는 줄 = 4 줄 뒤가 본문 1 줄이다.
        self.assertEqual(got, [
            ("CLE-T-SRC", 10, "CLE-T-TARGET#있는-제목", "대상 문서에 그 제목이 없다"),
            ("CLE-T-SRC", 11, "CLE-T-SRC#없는-제목", "대상 문서에 그 제목이 없다"),
            ("CLE-T-SRC", 12, "CLE-T-NONE#무엇", "대상 문서가 미러에 없다"),
        ])

    def test_unreadable_mirror_file_is_skipped(self):
        bad = self.root / "spec" / "CLE-T" / "CLE-T-BAD.md"
        bad.parent.mkdir(parents=True)
        bad.write_text("frontmatter 없음\n[a](#b)\n", encoding="utf-8")
        self.assertEqual(anchor_check.broken_links(self.root / "spec"), [])


class RatchetTest(unittest.TestCase):
    B = [("S", 1, "T#a", "x"), ("S", 2, "T#a", "x"), ("S", 3, "T#b", "x"), ("R", 4, "T#c", "x")]

    def test_new_or_more_links_fail(self):
        fails, notes = anchor_check.judge(self.B, {"S": {"T#a": 1, "T#b": 1}})
        # `T#a` 가 기준선보다 하나 많으면 그 쌍의 줄을 모두 보인다(어느 것이 새것인지 모른다).
        self.assertEqual(fails, ["S:1: `T#a` — x", "S:2: `T#a` — x", "R:4: `T#c` — x"])
        self.assertEqual(notes, [])

    def test_fixed_links_only_note(self):
        fails, notes = anchor_check.judge(self.B[:1], {"S": {"T#a": 2, "T#b": 1}})
        self.assertEqual(fails, [])
        self.assertEqual(len(notes), 2)

    def test_update_only_shrinks(self):
        base = {"S": {"T#a": 1, "T#b": 3, "T#gone": 1}}
        self.assertEqual(anchor_check.updated(self.B, base), {"S": {"T#a": 1, "T#b": 1}})

    def test_main_cli(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            write_mirror(root, "CLE-T-A", "## 제목\n[x](#없다)\n[y](#없다)\n", area="CLE-T")
            base = root / "baseline.json"
            anchor_check.write_baseline({}, base)
            self.assertEqual(anchor_check.main(["--root", d], baseline_path=base), 1)
            anchor_check.write_baseline({"CLE-T-A": {"CLE-T-A#없다": 2}}, base)
            self.assertEqual(anchor_check.main(["--root", d], baseline_path=base), 0)
            write_mirror(root, "CLE-T-A", "## 제목\n[x](#없다)\n", area="CLE-T")
            self.assertEqual(anchor_check.main(["--root", d, "--update-baseline"], baseline_path=base), 0)
            self.assertEqual(anchor_check.load_baseline(base), {"CLE-T-A": {"CLE-T-A#없다": 1}})

    def test_baseline_file_shape(self):
        for src, refs in anchor_check.load_baseline().items():
            self.assertRegex(src, r"^CLE-[A-Z0-9-]+$")
            for ref, n in refs.items():
                self.assertRegex(ref, r"^CLE-[A-Z0-9-]+#.+$")
                self.assertGreater(n, 0)

    def test_real_mirror_passes(self):
        broken = anchor_check.broken_links(_harness.REPO_ROOT / "spec")
        fails, _ = anchor_check.judge(broken, anchor_check.load_baseline())
        self.assertEqual(fails, [])


def _node() -> str | None:
    node = shutil.which("node")
    if not node:
        return None
    r = subprocess.run([node, "-e", "require.resolve('github-slugger/package.json');"
                        "require.resolve('mdast-util-from-markdown')"],
                       cwd=FRONTEND, capture_output=True, text=True)
    return node if r.returncode == 0 else None


def _js_removed_ranges(node: str) -> list[list[int]]:
    """github-slugger `regex.js` 가 지우는 코드 포인트 범위. `slug_ranges.py` 를 다시 만들 때도 이 값을 쓴다."""
    script = textwrap.dedent("""\
        import {regex} from 'github-slugger/regex.js';
        const r = new RegExp(regex.source); const rem = []; let start = -1;
        for (let c = 0; c <= 0x110000; c++) {
          let gone = false;
          if (c < 0x110000) { const ch = String.fromCodePoint(c); gone = ch.replace(r, '') !== ch; }
          if (gone && start < 0) start = c;
          if (!gone && start >= 0) { rem.push([start, c - 1]); start = -1; }
        }
        process.stdout.write(JSON.stringify(rem));
        """)
    r = subprocess.run([node, "--input-type=module", "-e", script], cwd=FRONTEND,
                       capture_output=True, text=True, timeout=120)
    if r.returncode != 0:
        raise AssertionError(r.stderr[-2000:])
    return json.loads(r.stdout)


class SlugTableTest(unittest.TestCase):
    def test_table_sorted_and_disjoint(self):
        s, e = slug_ranges.STARTS, slug_ranges.ENDS
        self.assertEqual(len(s), len(e))
        for i in range(len(s)):
            self.assertLessEqual(s[i], e[i])
            if i:
                self.assertGreater(s[i], e[i - 1] + 1)

    def test_table_matches_installed_github_slugger(self):
        node = _node()
        if not node:
            self.skipTest("node 나 github-slugger 가 없다")
        version = json.loads(subprocess.run(
            [node, "-e", "process.stdout.write(require('fs').readFileSync("
             "require.resolve('github-slugger/package.json'), 'utf8'))"],
            cwd=FRONTEND, capture_output=True, text=True).stdout)["version"]
        self.assertEqual(version, slug_ranges.GITHUB_SLUGGER_VERSION)
        got = [list(x) for x in zip(slug_ranges.STARTS, slug_ranges.ENDS)]
        self.assertEqual(got, _js_removed_ranges(node))

    def test_real_mirror_headings_match_frontend_pipeline(self):
        """미러 전체 제목 slug 를 프런트 docs 가드와 같은 mdast + github-slugger 로 다시 구해 견준다."""
        node = _node()
        if not node:
            self.skipTest("node 나 mdast 가 없다")
        script = textwrap.dedent("""\
            import fs from 'node:fs';
            import { fromMarkdown } from 'mdast-util-from-markdown';
            import { toString as mdToString } from 'mdast-util-to-string';
            import GithubSlugger from 'github-slugger';
            const bodies = JSON.parse(fs.readFileSync(0, 'utf8')); const out = {};
            for (const [key, body] of Object.entries(bodies)) {
              const hs = []; (function walk(n) { if (n.type === 'heading') hs.push(n); (n.children || []).forEach(walk); })(fromMarkdown(body));
              const s = new GithubSlugger(); out[key] = hs.map(h => s.slug(mdToString(h))).filter(Boolean).sort();
            }
            process.stdout.write(JSON.stringify(out));
            """)
        import pull  # anchor_check 가 sys.path 에 넣은 같은 폴더의 미러 도구

        bodies = {p.stem: pull.split_frontmatter(p.read_text(encoding="utf-8"))[1]
                  for p in pull.mirror_files(_harness.REPO_ROOT / "spec")}
        r = subprocess.run([node, "--input-type=module", "-e", script], cwd=FRONTEND,
                           input=json.dumps(bodies), capture_output=True, text=True, timeout=120)
        self.assertEqual(r.returncode, 0, r.stderr[-2000:])
        want = json.loads(r.stdout)
        got = {k: sorted(anchor_check.heading_slugs(b)) for k, b in bodies.items()}
        self.assertEqual(got, want)


class WorkflowTest(unittest.TestCase):
    def _job(self):
        import yaml  # harness 테스트의 유일한 서드파티 예외(.claude/tests/README.md)

        return yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))["jobs"]["spec-mirror-integrity"]

    def test_ci_job_runs_anchor_check(self):
        runs = [s.get("run", "") for s in self._job()["steps"]]
        self.assertIn("python3 .claude/tools/nerv-mirror/anchor_check.py", runs)

    def test_anchor_check_runs_in_sparse_checkout(self):
        """CI 잡이 받는 경로만 있는 트리에서 import 오류 없이 돌고 실제 미러를 통과시킨다."""
        steps = [s for s in self._job()["steps"] if str(s.get("uses", "")).startswith("actions/checkout")]
        paths = steps[0]["with"]["sparse-checkout"].split()
        with tempfile.TemporaryDirectory() as d:
            for rel in paths:
                shutil.copytree(_harness.REPO_ROOT / rel, Path(d, rel), symlinks=True,
                                ignore=shutil.ignore_patterns("__pycache__"))
            r = subprocess.run([sys.executable, str(Path(d, ".claude/tools/nerv-mirror/anchor_check.py"))],
                               capture_output=True, text=True, cwd=d, timeout=60)
            self.assertEqual(r.returncode, 0, r.stdout[-2000:] + r.stderr[-2000:])


if __name__ == "__main__":
    unittest.main()
