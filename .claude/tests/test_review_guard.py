"""리뷰 커버리지 게이트(`.claude/hooks/_lib/review_guard.py`) — NERV 라운드(N1)로 판정한다.

NERV 정본 전환 단계 2(NERV Task `CLE-T-4ABTG7`)에서 판정 근거가 저장소 `review/**` 파일에서
NERV 리뷰 라운드로 바뀌었다. 여기서 고정하는 것:

  - 판정표 — 라운드 상태 · 라운드 head 의 소속 · 라운드 이후 커밋(merge 포함) · 처분 커밋의 소속 ·
    커밋 메시지의 발견 인용 · consistency 라운드 처분의 쓰임.
  - 판정 불가 — 서버 · 응답 · git 문제는 `GateUnavailable`, 설정 문제는 `GateMisconfigured`.
    통과로 돌려주지 않는다(호출자가 세야 fail-open 이 조용히 지나가지 않는다).
  - 서버 응답을 git 인자로 넘기기 전에 거른다.
  - 실제 전송 경로 — loopback 가짜 서버 + 실물 `pull.Nerv`(curl).

저장소는 매번 임시로 만든다(`_harness.make_temp_git_repo`). 판정표는 `client=` 대역으로,
전송 경로는 `_harness.FakeNervServer` 로 돈다.
"""

from __future__ import annotations

import json
import os
import shutil
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import _harness
from _lib import review_guard as rg


class FakeClient:
    """`pull.Nerv` 의 대역 — `project` 와 `get(path) -> (status, body)` 만 있으면 된다."""

    project = "clemvion"

    def __init__(self, item=None, *, extra=(), status=200, raw=None, exc=None):
        self.item = item
        self.extra = list(extra)
        self.status = status
        self.raw = raw
        self.exc = exc
        self.calls: list[str] = []

    def get(self, path):
        self.calls.append(path)
        if self.exc is not None:
            raise self.exc
        if self.raw is not None:
            return self.status, self.raw
        items = ([self.item] if self.item is not None else []) + self.extra
        return self.status, json.dumps({"branch": "feature", "items": items}).encode()


def code_item(state="passed", head=None, *, findings=(), round_no=1, reasons=(),
              missing=(), total=None, kind="code", reported=()):
    item = {
        "kind": kind, "state": state, "round_no": round_no, "head_sha": head,
        "reasons": list(reasons), "open": {"critical": 0, "warning": 0, "info": 0},
        "roles": {"required": [], "reported": list(reported), "missing": list(missing)},
        "findings": list(findings),
    }
    if total is not None:
        item["findings_total"] = total
    return item


_IDS = iter(range(1, 10_000))


def finding_id():
    """UUIDv7 모양의 발견 ID. 앞 8자를 일부러 같게 둔다(실제 NERV ID 처럼)."""
    return f"01a0f648-f6{next(_IDS):02x}-7000-8000-{0:012x}"


def fixed(sha, title="발견", *, fid=None, status="fixed"):
    return {"id": fid or finding_id(), "severity": "warning", "title": title, "status": status,
            "resolution": {"kind": status, "commit_sha": sha}}


class _RepoCase(unittest.TestCase):
    """main 에 커밋 하나, `feature` 브랜치에 codebase 커밋 하나. origin/main 은 main 이다."""

    def setUp(self):
        self.tmp = Path(os.path.realpath(tempfile.mkdtemp()))
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)
        self.repo = _harness.make_temp_git_repo(self.tmp / "repo")
        self.git("update-ref", "refs/remotes/origin/main", "HEAD")
        self.git("checkout", "-q", "-b", "feature")
        self.c1 = self.commit("codebase/backend/src/a.ts", "export const a = 1;\n")

    def git(self, *args):
        return _harness.git_in(self.repo, *args).stdout.strip()

    def commit(self, rel, body, msg="change"):
        path = self.repo / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(body, encoding="utf-8")
        self.git("add", "-A")
        self.git("commit", "-qm", msg)
        return self.git("rev-parse", "HEAD")

    def evaluate(self, client, **kw):
        return rg.evaluate_review(str(self.repo), client=client, **kw)


class ForcedRolesBeyondTheSixTest(_RepoCase):
    """(2b) 라운드가 본 파일이 강제하는 리뷰어 중 NERV 6역할 밖의 것이 라운드에 있어야 한다.

    NERV 정책 `review_roles.code` 는 변경 종류에 따라 붙는 역할(documentation · dependency ·
    database · api_contract)을 표현하지 못해 6역할만 센다(전환 단계 2). 이 검사가 그 축소를 닫는다
    (전환 4e). 판정의 입력은 merge-base..라운드 head 의 파일이다 — 라운드 뒤 커밋은 그 라운드가 본
    파일이 아니다.
    """

    def test_a_round_that_reviewed_a_doc_without_the_documentation_role_blocks(self):
        head = self.commit("CHANGELOG.md", "- 바뀐 것\n")
        d = self.evaluate(FakeClient(code_item("passed", head)))
        self.assertTrue(d.blocked)
        self.assertIn("강제 리뷰어 리포트가 없다: documentation", d.reason)

    def test_the_reported_role_satisfies_it(self):
        head = self.commit("CHANGELOG.md", "- 바뀐 것\n")
        d = self.evaluate(FakeClient(code_item("passed", head, reported=["documentation"])))
        self.assertFalse(d.blocked, d.reason)

    def test_every_missing_role_is_named(self):
        self.commit("codebase/backend/package.json", "{}\n")
        head = self.commit("codebase/backend/migrations/V1__init.sql", "select 1;\n")
        d = self.evaluate(FakeClient(code_item("passed", head)))
        self.assertTrue(d.blocked)
        for role in ("database", "dependency", "documentation"):
            with self.subTest(role=role):
                self.assertIn(role, d.reason)

    def test_a_reviewer_the_project_disabled_is_not_required(self):
        self.commit(".claude.project.json",
                    json.dumps({"agents": {"reviewers": {"documentation": False}}}))
        head = self.commit("CHANGELOG.md", "- 바뀐 것\n")
        d = self.evaluate(FakeClient(code_item("passed", head)))
        self.assertFalse(d.blocked, d.reason)

    def test_files_after_the_round_head_do_not_count(self):
        """라운드 뒤 문서 커밋은 그 라운드가 본 파일이 아니다(codebase 밖이라 설명도 필요 없다)."""
        self.commit("CHANGELOG.md", "- 라운드 뒤\n")
        d = self.evaluate(FakeClient(code_item("passed", self.c1)))
        self.assertFalse(d.blocked, d.reason)

    def test_base_files_merged_in_after_the_round_do_not_count(self):
        """리뷰 뒤 `git merge origin/main` 으로 최신화해도 main 쪽 파일은 라운드가 본 파일이 아니다.

        범위를 HEAD 기준 merge-base 로 잡으면 그 merge-base 가 main 의 새 커밋으로 올라가고, 두 점
        diff 가 main 에서 들어온 문서를 라운드 파일로 센다. 그러면 `CLE-ENG-MIGRATION` 과 PR 템플릿이
        안내하는 merge 최신화가 막힌다. 라운드 head 기준 merge-base 로 잡아야 한다."""
        self.git("checkout", "-q", "main")
        self.commit("CHANGELOG.md", "- main 의 문서\n")
        self.commit("codebase/backend/package.json", "{}\n")
        self.git("update-ref", "refs/remotes/origin/main", "HEAD")
        self.git("checkout", "-q", "feature")
        self.git("merge", "-q", "--no-edit", "main")
        d = self.evaluate(FakeClient(code_item("passed", self.c1)))
        self.assertFalse(d.blocked, d.reason)

    def test_the_branch_own_files_still_count_after_merging_the_base(self):
        """merge 최신화 뒤에도 라운드 전에 이 브랜치가 바꾼 문서는 그대로 센다(위 테스트의 반대쪽)."""
        head = self.commit("CHANGELOG.md", "- 이 브랜치의 문서\n")
        self.git("checkout", "-q", "main")
        self.commit("docs/main-only.md", "m\n")
        self.git("update-ref", "refs/remotes/origin/main", "HEAD")
        self.git("checkout", "-q", "feature")
        self.git("merge", "-q", "--no-edit", "main")
        d = self.evaluate(FakeClient(code_item("passed", head)))
        self.assertTrue(d.blocked)
        self.assertIn("강제 리뷰어 리포트가 없다: documentation", d.reason)

    def test_the_six_roles_are_left_to_the_server(self):
        """6역할은 서버가 `missing_roles` 로 판정한다. 여기서 다시 세면 대역의 빈 `reported` 가 막는다."""
        d = self.evaluate(FakeClient(code_item("passed", self.c1)))
        self.assertFalse(d.blocked, d.reason)

    def test_a_response_without_roles_passes_with_a_note(self):
        head = self.commit("CHANGELOG.md", "- 바뀐 것\n")
        item = code_item("passed", head)
        del item["roles"]
        d = self.evaluate(FakeClient(item))
        self.assertFalse(d.blocked, d.reason)
        self.assertTrue(any("roles.reported" in n for n in d.notes), d.notes)

    def test_an_unloadable_rule_module_is_a_configuration_error(self):
        head = self.commit("CHANGELOG.md", "- 바뀐 것\n")
        with mock.patch.object(rg, "_ROUTER_SAFETY", str(self.tmp / "missing.py")):
            with self.assertRaises(rg.GateMisconfigured):
                self.evaluate(FakeClient(code_item("passed", head)))

    def test_a_rule_module_that_breaks_after_loading_is_a_configuration_error(self):
        """불러오기는 됐는데 이름이 없거나 호출이 실패해도 설정 문제다.

        다른 예외로 새면 CI `check-review-gate.py` 가 일시 장애로 보고 통과시킨다. 2b 는 (3) · (4)
        보다 앞이라 그 뒤 검사까지 모두 건너뛴다."""
        head = self.commit("CHANGELOG.md", "- 바뀐 것\n")
        stubs = {
            "이름 없음": "X = 1\n",
            "호출 실패": ("RULE_REVIEWERS = ('documentation',)\n"
                      "def conditional_forced_agents(files, available):\n"
                      "    raise ValueError('boom')\n"),
        }
        for label, body in stubs.items():
            with self.subTest(label):
                stub = self.tmp / f"stub_{len(label)}_{abs(hash(label))}.py"
                stub.write_text(body, encoding="utf-8")
                with mock.patch.object(rg, "_ROUTER_SAFETY", str(stub)):
                    with self.assertRaises(rg.GateMisconfigured):
                        self.evaluate(FakeClient(code_item("passed", head)))

    def test_the_toggle_rule_matches_project_config(self):
        """`_enabled_reviewers` 는 `project_config.is_agent_enabled` 의 사본이다. 두 판정이 같아야 한다.

        `_lib` 이름이 훅 패키지와 겹쳐 같은 프로세스에서 둘을 함께 들이지 못한다. 그래서 project_config
        쪽은 하위 프로세스로 돌린다."""
        import subprocess  # noqa: PLC0415
        import sys  # noqa: PLC0415

        names = ["documentation", "dependency", "database", "api_contract"]
        shapes = {
            "없음": None,
            "깨진 JSON": "{",
            "루트가 리스트": "[]",
            "agents 가 null": json.dumps({"agents": None}),
            "reviewers 가 리스트": json.dumps({"agents": {"reviewers": []}}),
            "명시 false": json.dumps({"agents": {"reviewers": {"documentation": False}}}),
            "문자열 false": json.dumps({"agents": {"reviewers": {"documentation": "false"}}}),
            "0": json.dumps({"agents": {"reviewers": {"database": 0}}}),
            "null": json.dumps({"agents": {"reviewers": {"dependency": None}}}),
            "true": json.dumps({"agents": {"reviewers": {"api_contract": True}}}),
        }
        probe = (
            "import json, sys\n"
            f"sys.path.insert(0, {str(_harness.CLAUDE_DIR / 'skills')!r})\n"
            "from _lib import project_config as pc\n"
            "root, names = sys.argv[1], json.loads(sys.argv[2])\n"
            "cfg = pc.load(root)\n"
            "print(json.dumps([n for n in names if pc.is_agent_enabled(cfg, 'reviewers', n)]))\n"
        )
        for label, body in shapes.items():
            with self.subTest(label):
                root = self.tmp / f"cfg_{abs(hash(label))}"
                root.mkdir()
                if body is not None:
                    (root / ".claude.project.json").write_text(body, encoding="utf-8")
                out = subprocess.run([sys.executable, "-c", probe, str(root), json.dumps(names)],
                                     capture_output=True, text=True, check=True).stdout
                self.assertEqual(rg._enabled_reviewers(str(root), names), json.loads(out))

    def test_the_gate_uses_the_reviewer_rules_the_orchestrator_uses(self):
        """게이트가 불러오는 파일이 코드 리뷰 오케스트레이터가 쓰는 그 모듈이다(복사본이 아니다)."""
        import ast  # noqa: PLC0415

        orch = (_harness.CLAUDE_DIR / "skills" / "code-review-agents" / "scripts"
                / "code_review_orchestrator.py").read_text(encoding="utf-8")
        imported = {n.module for n in ast.walk(ast.parse(orch)) if isinstance(n, ast.ImportFrom)}
        self.assertIn("lib.router_safety", imported)
        self.assertEqual(Path(rg._ROUTER_SAFETY).resolve(),
                         (_harness.CLAUDE_DIR / "skills" / "code-review-agents" / "lib"
                          / "router_safety.py").resolve())


class DecisionTableTest(_RepoCase):
    def test_no_codebase_change_allows_without_asking_nerv(self):
        self.git("checkout", "-q", "main")
        self.git("checkout", "-q", "-b", "docs")
        self.commit("docs/x.md", "x\n")
        client = FakeClient(code_item("uncovered"))
        d = self.evaluate(client)
        self.assertFalse(d.blocked, d.reason)
        self.assertIn("변경이 없다", d.reason)
        self.assertEqual(client.calls, [], "변경이 없는데 NERV 를 불렀다")

    def test_uncommitted_codebase_edits_do_not_count(self):
        """push 는 커밋만 내보낸다. 작업 트리의 변경은 판정 대상이 아니다."""
        self.git("checkout", "-q", "main")
        self.git("checkout", "-q", "-b", "dirty")
        (self.repo / "codebase" / "z.ts").parent.mkdir(parents=True, exist_ok=True)
        (self.repo / "codebase" / "z.ts").write_text("x\n", encoding="utf-8")
        self.assertFalse(self.evaluate(FakeClient(code_item("uncovered"))).blocked)

    def test_uncovered_blocks_and_says_how_to_submit(self):
        d = self.evaluate(FakeClient(code_item("uncovered")))
        self.assertTrue(d.blocked)
        self.assertIn("nerv_review_submit", d.reason)
        self.assertIn("feature", d.reason)

    def test_pending_blocks_with_reasons_and_missing_roles(self):
        item = code_item("pending", self.c1, reasons=["open_warning", "missing_roles"],
                         missing=["testing"])
        item["open"]["warning"] = 2
        d = self.evaluate(FakeClient(item))
        self.assertTrue(d.blocked)
        self.assertIn("열린 warning", d.reason)
        self.assertIn("testing", d.reason)
        self.assertIn("warning 2", d.reason)

    def test_server_strings_are_folded_to_one_line(self):
        """서버가 준 문자열이 훅 stderr · CI 로그에 줄을 만들지 않는다."""
        item = code_item("pending", self.c1, reasons=["a\nFAKE: line"], missing=["x\r\ny"])
        d = self.evaluate(FakeClient(item))
        self.assertNotIn("\n", d.reason)
        self.assertNotIn("\r", d.reason)
        self.assertIn("a FAKE: line", d.reason)

    def test_unknown_reason_is_shown_verbatim(self):
        d = self.evaluate(FakeClient(code_item("pending", self.c1, reasons=["new_reason"])))
        self.assertTrue(d.blocked)
        self.assertIn("new_reason", d.reason)

    def test_passed_round_at_head_allows(self):
        d = self.evaluate(FakeClient(code_item("passed", self.c1)))
        self.assertFalse(d.blocked, d.reason)
        self.assertIn("passed", d.reason)

    def test_a_later_commit_outside_codebase_does_not_need_a_new_round(self):
        self.commit("docs/notes.md", "n\n")
        d = self.evaluate(FakeClient(code_item("passed", self.c1)))
        self.assertFalse(d.blocked, d.reason)

    def test_a_later_codebase_commit_recorded_as_a_fix_passes(self):
        c2 = self.commit("codebase/backend/src/a.ts", "export const a = 2;\n")
        d = self.evaluate(FakeClient(code_item("passed", self.c1, findings=[fixed(c2)])))
        self.assertFalse(d.blocked, d.reason)
        self.assertIn("처분 커밋", d.reason)

    def test_an_abbreviated_fix_sha_still_matches(self):
        c2 = self.commit("codebase/backend/src/a.ts", "export const a = 2;\n")
        d = self.evaluate(FakeClient(code_item("passed", self.c1, findings=[fixed(c2[:7])])))
        self.assertFalse(d.blocked, d.reason)

    def test_a_later_codebase_commit_that_is_not_a_fix_blocks(self):
        c2 = self.commit("codebase/backend/src/a.ts", "export const a = 2;\n")
        d = self.evaluate(FakeClient(code_item("passed", self.c1)))
        self.assertTrue(d.blocked)
        self.assertIn(c2[:12], d.reason)
        self.assertIn("nerv_finding_resolve", d.reason)

    def test_a_fix_sha_git_cannot_resolve_uniquely_does_not_count(self):
        """너무 짧은 축약은 git 이 풀지 않는다 — 앞글자가 같은 아무 커밋이나 설명하면 안 된다."""
        c2 = self.commit("codebase/backend/src/a.ts", "export const a = 2;\n")
        d = self.evaluate(FakeClient(code_item("passed", self.c1, findings=[fixed(c2[:3])])))
        self.assertTrue(d.blocked)

    def test_one_fix_does_not_explain_another_commit(self):
        c2 = self.commit("codebase/backend/src/a.ts", "export const a = 2;\n")
        c3 = self.commit("codebase/backend/src/b.ts", "export const b = 1;\n")
        d = self.evaluate(FakeClient(code_item("passed", self.c1, findings=[fixed(c2)])))
        self.assertTrue(d.blocked)
        self.assertIn(c3[:12], d.reason)
        self.assertNotIn(c2[:12], d.reason)

    def test_two_findings_fixed_by_one_commit(self):
        c2 = self.commit("codebase/backend/src/a.ts", "export const a = 2;\n")
        d = self.evaluate(FakeClient(code_item("passed", self.c1, findings=[fixed(c2, "앞"), fixed(c2, "뒤")])))
        self.assertFalse(d.blocked, d.reason)

    def test_a_commit_sha_on_a_non_fixed_disposition_explains_nothing(self):
        """서버가 wont_fix 처분에 commit_sha 를 담아 와도 그 커밋은 설명되지 않는다."""
        c2 = self.commit("codebase/backend/src/a.ts", "export const a = 2;\n")
        d = self.evaluate(FakeClient(code_item("passed", self.c1, findings=[fixed(c2, status="wont_fix")])))
        self.assertTrue(d.blocked)
        self.assertIn(c2[:12], d.reason)

    def test_a_fix_commit_from_another_branch_blocks(self):
        """NERV 는 발견을 지문으로 합친다. 다른 브랜치의 처분이 이 라운드에 fixed 로 보인다."""
        self.git("checkout", "-q", "main")
        self.git("checkout", "-q", "-b", "other")
        foreign = self.commit("codebase/backend/src/a.ts", "export const a = 9;\n")
        self.git("checkout", "-q", "feature")
        d = self.evaluate(FakeClient(code_item("passed", self.c1, findings=[fixed(foreign, "남의 수정")])))
        self.assertTrue(d.blocked)
        self.assertIn(foreign[:12], d.reason)
        self.assertIn("남의 수정", d.reason)

    def test_a_fix_commit_this_checkout_has_never_seen_blocks(self):
        d = self.evaluate(FakeClient(code_item("passed", self.c1, findings=[fixed("ab" * 20)])))
        self.assertTrue(d.blocked)
        self.assertIn("abababababab", d.reason)

    def test_a_fix_that_landed_on_main_and_was_merged_in_counts(self):
        """main 에서 고쳐 머지한 수정도 이 브랜치에서 닿으면 이 브랜치의 수정이다."""
        self.git("checkout", "-q", "main")
        on_main = self.commit("codebase/shared/x.ts", "x\n")
        self.git("update-ref", "refs/remotes/origin/main", "HEAD")
        self.git("checkout", "-q", "feature")
        self.git("merge", "-q", "--no-edit", "main")
        d = self.evaluate(FakeClient(code_item("passed", self.c1, findings=[fixed(on_main)])))
        self.assertFalse(d.blocked, d.reason)

    def test_merging_the_base_branch_does_not_count_its_commits(self):
        """`sync_with_base_branch` 가 만든 merge — main 의 codebase 커밋은 이 브랜치 변경이 아니다."""
        self.git("checkout", "-q", "main")
        self.commit("codebase/shared/y.ts", "y\n")
        self.git("update-ref", "refs/remotes/origin/main", "HEAD")
        self.git("checkout", "-q", "feature")
        self.git("merge", "-q", "--no-edit", "main")
        d = self.evaluate(FakeClient(code_item("passed", self.c1)))
        self.assertFalse(d.blocked, d.reason)

    def _merge_main_with(self, extra_rel=None):
        """main 에 커밋 하나를 더하고 feature 로 merge 한다. `extra_rel` 이면 merge 커밋에 파일을 끼운다."""
        self.git("checkout", "-q", "main")
        self.commit("codebase/shared/y.ts", "y\n")
        self.git("update-ref", "refs/remotes/origin/main", "HEAD")
        self.git("checkout", "-q", "feature")
        if extra_rel is None:
            self.git("merge", "-q", "--no-edit", "main")
        else:
            self.git("merge", "-q", "--no-commit", "main")
            path = self.repo / extra_rel
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("evil\n", encoding="utf-8")
            self.git("add", "-A")
            self.git("commit", "-qm", "merge main")
        return self.git("rev-parse", "HEAD")

    def test_code_slipped_into_a_merge_commit_blocks(self):
        """evil merge — merge 커밋 안에서만 바뀐 codebase/ 파일도 라운드 이후 변경이다."""
        merge = self._merge_main_with("codebase/backend/src/evil.ts")
        d = self.evaluate(FakeClient(code_item("passed", self.c1)))
        self.assertTrue(d.blocked)
        self.assertIn(merge[:12], d.reason)

    def test_a_merge_that_only_adds_files_outside_codebase_passes(self):
        self._merge_main_with("docs/evil.md")
        d = self.evaluate(FakeClient(code_item("passed", self.c1)))
        self.assertFalse(d.blocked, d.reason)

    def test_a_follow_up_commit_citing_a_fixed_finding_passes(self):
        """e2e 실패 뒤 후속 수정 — 처분은 commit_sha 하나만 받으므로 메시지 인용으로 묶는다."""
        c2 = self.commit("codebase/backend/src/a.ts", "export const a = 2;\n")
        fid = finding_id()
        self.commit("codebase/backend/src/a.ts", "export const a = 3;\n", msg=f"fix(a): finding {fid} e2e 후속")
        d = self.evaluate(FakeClient(code_item("passed", self.c1, findings=[fixed(c2, fid=fid)])))
        self.assertFalse(d.blocked, d.reason)
        self.assertIn("메시지 인용", d.reason)

    def test_two_follow_up_commits_citing_the_same_fixed_finding_pass(self):
        """`git show` 는 두 번째 레코드 앞에 줄바꿈을 붙인다 — 레코드 경계가 둘 다 풀려야 한다."""
        c2 = self.commit("codebase/backend/src/a.ts", "export const a = 2;\n")
        fid = finding_id()
        self.commit("codebase/backend/src/a.ts", "export const a = 3;\n", msg=f"fix: finding {fid} 1")
        self.commit("codebase/backend/src/a.ts", "export const a = 4;\n", msg=f"fix: finding {fid} 2")
        d = self.evaluate(FakeClient(code_item("passed", self.c1, findings=[fixed(c2, fid=fid)])))
        self.assertFalse(d.blocked, d.reason)

    def test_only_the_uncited_commit_among_several_is_named(self):
        c2 = self.commit("codebase/backend/src/a.ts", "export const a = 2;\n")
        fid = finding_id()
        self.commit("codebase/backend/src/a.ts", "export const a = 3;\n", msg=f"fix: finding {fid}")
        bare = self.commit("codebase/backend/src/b.ts", "export const b = 1;\n", msg="unrelated")
        self.commit("codebase/backend/src/a.ts", "export const a = 4;\n", msg=f"fix: finding {fid} again")
        d = self.evaluate(FakeClient(code_item("passed", self.c1, findings=[fixed(c2, fid=fid)])))
        self.assertTrue(d.blocked)
        self.assertIn(bare[:12], d.reason)
        self.assertIn("1개", d.reason)

    def test_many_unexplained_commits_are_summarised(self):
        shas = [self.commit("codebase/backend/src/a.ts", f"export const a = {i};\n") for i in range(7)]
        d = self.evaluate(FakeClient(code_item("passed", self.c1)))
        self.assertTrue(d.blocked)
        self.assertIn("외 2개", d.reason)
        self.assertEqual(sum(s[:12] in d.reason for s in shas), 5)

    def test_many_foreign_fixes_are_summarised(self):
        foreign = [f"{i:x}" * 40 for i in range(1, 8)]
        d = self.evaluate(FakeClient(code_item("passed", self.c1, findings=[fixed(s[:40]) for s in foreign])))
        self.assertTrue(d.blocked)
        self.assertIn("외 2건", d.reason)

    def test_a_listed_citation_covers_every_id_in_the_paragraph(self):
        """`finding <ID> · <ID>` — 한 커밋이 발견 여럿을 고치면 ID 를 한 문단에 나열한다."""
        c2 = self.commit("codebase/backend/src/a.ts", "export const a = 2;\n")
        f1, f2 = finding_id(), finding_id()
        self.commit("codebase/backend/src/a.ts", "x\n", msg=f"fix: follow-up\n\nfinding {f1} ·\n{f2}")
        d = self.evaluate(FakeClient(code_item("passed", self.c1, findings=[fixed("ab" * 20, fid=f1)])))
        self.assertTrue(d.blocked)  # f1 은 남의 커밋 처분이라 막힌다(아래와 대조)
        d = self.evaluate(FakeClient(code_item("passed", self.c1, findings=[fixed(c2, fid=f2)])))
        self.assertFalse(d.blocked, d.reason)

    def test_an_id_outside_the_finding_paragraph_is_not_a_citation(self):
        c2 = self.commit("codebase/backend/src/a.ts", "export const a = 2;\n")
        fid = finding_id()
        c3 = self.commit("codebase/backend/src/a.ts", "x\n", msg=f"fix: finding 설명만\n\n참고 {fid}")
        d = self.evaluate(FakeClient(code_item("passed", self.c1, findings=[fixed(c2, fid=fid)])))
        self.assertTrue(d.blocked)
        self.assertIn(c3[:12], d.reason)

    def test_the_citation_is_case_insensitive(self):
        c2 = self.commit("codebase/backend/src/a.ts", "export const a = 2;\n")
        fid = finding_id()
        self.commit("codebase/backend/src/a.ts", "x\n", msg=f"Finding {fid.upper()}")
        d = self.evaluate(FakeClient(code_item("passed", self.c1, findings=[fixed(c2, fid=fid)])))
        self.assertFalse(d.blocked, d.reason)

    def test_citing_a_finding_that_is_not_fixed_blocks(self):
        c2 = self.commit("codebase/backend/src/a.ts", "export const a = 2;\n")
        fid = finding_id()
        c3 = self.commit("codebase/backend/src/a.ts", "x\n", msg=f"fix: finding {fid}")
        open_finding = {"id": fid, "severity": "warning", "title": "열림", "status": "open"}
        d = self.evaluate(FakeClient(code_item("passed", self.c1, findings=[fixed(c2), open_finding])))
        self.assertTrue(d.blocked)
        self.assertIn(c3[:12], d.reason)
        self.assertIn("finding <발견 전체 ID>", d.reason)

    def test_citing_only_the_id_prefix_does_not_count(self):
        """UUIDv7 의 앞 8자는 같은 분의 발견끼리 겹친다 — 접두 인용은 인용이 아니다."""
        c2 = self.commit("codebase/backend/src/a.ts", "export const a = 2;\n")
        fid = finding_id()
        c3 = self.commit("codebase/backend/src/a.ts", "x\n", msg=f"fix: finding {fid[:8]}")
        d = self.evaluate(FakeClient(code_item("passed", self.c1, findings=[fixed(c2, fid=fid)])))
        self.assertTrue(d.blocked)
        self.assertIn(c3[:12], d.reason)

    def test_citing_a_finding_fixed_on_another_branch_does_not_count(self):
        """consistency 라운드의 남의 브랜치 처분은 막지 않지만 인용의 근거도 되지 않는다."""
        self.git("checkout", "-q", "main")
        self.git("checkout", "-q", "-b", "other")
        foreign = self.commit("codebase/backend/src/a.ts", "export const a = 9;\n")
        self.git("checkout", "-q", "feature")
        fid = finding_id()
        c2 = self.commit("codebase/backend/src/a.ts", "x\n", msg=f"fix: finding {fid}")
        cons = code_item("passed", self.c1, kind="consistency", findings=[fixed(foreign, fid=fid)])
        d = self.evaluate(FakeClient(code_item("passed", self.c1), extra=[cons]))
        self.assertTrue(d.blocked)
        self.assertIn(c2[:12], d.reason)

    def test_a_consistency_fix_commit_explains_a_later_commit(self):
        """`--impl-done` 발견을 고친 codebase/ 커밋 — 새 code 라운드 없이 통과한다."""
        c2 = self.commit("codebase/backend/src/a.ts", "export const a = 2;\n")
        cons = code_item("pending", None, kind="consistency", findings=[fixed(c2)])
        d = self.evaluate(FakeClient(code_item("passed", self.c1), extra=[cons]))
        self.assertFalse(d.blocked, d.reason)

    def test_a_foreign_consistency_fix_does_not_block(self):
        self.git("checkout", "-q", "main")
        self.git("checkout", "-q", "-b", "other")
        foreign = self.commit("codebase/backend/src/a.ts", "export const a = 9;\n")
        self.git("checkout", "-q", "feature")
        cons = code_item("passed", self.c1, kind="consistency", findings=[fixed(foreign)])
        d = self.evaluate(FakeClient(code_item("passed", self.c1), extra=[cons]))
        self.assertFalse(d.blocked, d.reason)

    def test_the_first_item_of_a_kind_is_the_one_judged(self):
        """N1 은 kind 마다 최신 라운드 하나를 준다. 같은 kind 가 또 오면 뒤의 것으로 바꾸지 않는다."""
        d = self.evaluate(FakeClient(code_item("passed", self.c1), extra=[code_item("uncovered")]))
        self.assertFalse(d.blocked, d.reason)

    def test_the_consistency_state_does_not_decide_the_push(self):
        cons = code_item("pending", self.c1, kind="consistency", reasons=["open_critical"])
        d = self.evaluate(FakeClient(code_item("passed", self.c1), extra=[cons]))
        self.assertFalse(d.blocked, d.reason)

    def test_a_round_whose_head_is_not_an_ancestor_blocks(self):
        """rebase · amend 로 라운드 head 가 브랜치에서 사라진 경우."""
        old = self.c1
        self.git("commit", "-q", "--amend", "-m", "amended")
        d = self.evaluate(FakeClient(code_item("passed", old)))
        self.assertTrue(d.blocked)
        self.assertIn("조상이 아니다", d.reason)

    def test_a_round_head_this_checkout_lacks_blocks(self):
        d = self.evaluate(FakeClient(code_item("passed", "cd" * 20)))
        self.assertTrue(d.blocked)
        self.assertIn("조상이 아니다", d.reason)

    def test_a_round_with_no_head_blocks(self):
        self.assertTrue(self.evaluate(FakeClient(code_item("passed", None))).blocked)

    def test_a_truncated_findings_list_is_mentioned_when_it_matters(self):
        self.commit("codebase/backend/src/a.ts", "export const a = 2;\n")
        d = self.evaluate(FakeClient(code_item("passed", self.c1, total=99)))
        self.assertTrue(d.blocked)
        self.assertTrue(any("99" in n for n in d.notes), d.notes)

    def test_a_truncated_findings_list_is_mentioned_on_a_pass_too(self):
        """잘린 목록이면 처분 커밋 소속 검사도 불완전하다. 통과에도 알린다."""
        d = self.evaluate(FakeClient(code_item("passed", self.c1, total=99)))
        self.assertFalse(d.blocked, d.reason)
        self.assertTrue(any("99" in n for n in d.notes), d.notes)

    def test_push_blocks_mirrors_blocked(self):
        d = self.evaluate(FakeClient(code_item("uncovered")))
        self.assertEqual(d.push_blocks, d.blocked)

    def test_the_query_names_the_branch_and_kind_and_no_head(self):
        """head_sha 를 넘기면 서버가 그 커밋의 라운드만 찾는다(자손이면 uncovered)."""
        client = FakeClient(code_item("passed", self.c1))
        self.evaluate(client)
        self.assertEqual(len(client.calls), 1)
        path = client.calls[0]
        self.assertTrue(path.startswith("/api/v1/projects/clemvion/gates/reviews/check?"), path)
        self.assertIn("branch=feature", path)
        self.assertIn("kind=code%2Cconsistency", path)
        self.assertNotIn("head_sha", path)

    def test_a_branch_name_with_a_slash_is_encoded(self):
        """이 저장소의 브랜치는 `claude/<task>-<slug>` 다."""
        self.git("branch", "-m", "claude/task-abc123")
        client = FakeClient(code_item("passed", self.c1))
        self.assertFalse(self.evaluate(client).blocked)
        self.assertIn("branch=claude%2Ftask-abc123", client.calls[0])

    def test_branch_head_and_base_can_be_given_explicitly(self):
        """CI 경로 — merge 커밋이 아니라 PR head 를 판정한다."""
        client = FakeClient(code_item("passed", self.c1))
        self.git("checkout", "-q", "--detach", "main")
        d = self.evaluate(client, branch="feature", head=self.c1, base_ref="origin/main")
        self.assertFalse(d.blocked, d.reason)
        self.assertIn("branch=feature", client.calls[0])


class UntrustedServerValuesTest(_RepoCase):
    """서버 응답의 sha 는 그대로 git 인자가 된다. 16진수가 아니면 커밋으로 보지 않는다."""

    def test_an_option_shaped_head_is_not_passed_to_git(self):
        with mock.patch.object(rg, "_run_git", wraps=rg._run_git) as spy:
            d = self.evaluate(FakeClient(code_item("passed", "--output=/tmp/x")))
        self.assertTrue(d.blocked)
        for call in spy.call_args_list:
            self.assertFalse(any("--output" in a for a in call.args[0]), call)

    def test_a_branch_name_as_head_is_not_resolved(self):
        """`main` 은 이 저장소에서 커밋으로 풀리지만 서버가 줄 값이 아니다.

        main 은 feature 의 조상이고 그 뒤 커밋(c1)은 처분 커밋이라, 풀어 주면 통과로 뒤집힌다 —
        거름이 판정을 바꾸는 입력이다(처분 없이 두면 다른 이유로 막혀 이 테스트가 공허해진다)."""
        d = self.evaluate(FakeClient(code_item("passed", "main", findings=[fixed(self.c1)])))
        self.assertTrue(d.blocked)
        self.assertIn("조상이 아니다", d.reason)

    def test_an_option_shaped_fix_sha_is_ignored(self):
        self.commit("codebase/backend/src/a.ts", "export const a = 2;\n")
        with mock.patch.object(rg, "_run_git", wraps=rg._run_git) as spy:
            d = self.evaluate(FakeClient(code_item("passed", self.c1, findings=[fixed("--all")])))
        self.assertTrue(d.blocked)
        for call in spy.call_args_list:
            self.assertNotIn("--all", call.args[0], call)


class UnavailableTest(_RepoCase):
    """판정하지 못하면 예외다. 통과(blocked=False)로 돌려주면 fail-open 이 세어지지 않는다."""

    def test_transport_failure(self):
        with self.assertRaises(rg.GateUnavailable) as cm:
            self.evaluate(FakeClient(exc=OSError("boom")))
        self.assertNotIsInstance(cm.exception, rg.GateMisconfigured)

    def test_any_non_200_with_a_valid_looking_body_is_not_an_answer(self):
        """429 · 302 에 판정처럼 생긴 본문이 와도 판정이 아니다(통과 라운드 본문으로 확인)."""
        for status in (503, 429, 302, 204):
            with self.subTest(status=status), self.assertRaises(rg.GateUnavailable) as cm:
                self.evaluate(FakeClient(code_item("passed", self.c1), status=status))
            self.assertNotIsInstance(cm.exception, rg.GateMisconfigured)

    def test_auth_and_project_errors_are_misconfiguration(self):
        for status in (401, 403, 404):
            with self.subTest(status=status), self.assertRaises(rg.GateMisconfigured):
                self.evaluate(FakeClient(code_item(), status=status))

    def test_malformed_bodies(self):
        for raw in (b"not json", b"[]", b'{"items": 3}', b'{"items": [{"kind": "consistency"}]}'):
            with self.subTest(raw=raw), self.assertRaises(rg.GateUnavailable):
                self.evaluate(FakeClient(raw=raw))

    def test_detached_head_without_a_branch(self):
        self.git("checkout", "-q", "--detach")
        with self.assertRaises(rg.GateUnavailable):
            self.evaluate(FakeClient(code_item("passed", self.c1)))

    def test_no_base_branch(self):
        self.git("update-ref", "-d", "refs/remotes/origin/main")
        self.git("branch", "-q", "-m", "main", "trunk")
        with self.assertRaises(rg.GateUnavailable):
            self.evaluate(FakeClient(code_item("passed", self.c1)))

    def test_an_explicit_base_that_does_not_exist(self):
        with self.assertRaises(rg.GateUnavailable):
            self.evaluate(FakeClient(code_item("passed", self.c1)), base_ref="origin/nope")

    def test_an_option_shaped_base_or_head_is_refused(self):
        with self.assertRaises(rg.GateUnavailable):
            self.evaluate(FakeClient(code_item("passed", self.c1)), base_ref="--all")
        with self.assertRaises(rg.GateUnavailable):
            self.evaluate(FakeClient(code_item("passed", self.c1)), head="--all")

    def test_missing_configuration(self):
        for env in ({}, {"NERV_SERVER": "https://nerv.example.invalid"}, {"NERV_TOKEN": "t"}):
            with self.subTest(env=sorted(env)), mock.patch.dict(os.environ, env, clear=True):
                with self.assertRaises(rg.GateMisconfigured) as cm:
                    rg.evaluate_review(str(self.repo))
                self.assertNotIn("t\n", str(cm.exception))

    def test_a_plain_http_remote_server_is_misconfiguration(self):
        env = {"NERV_SERVER": "http://nerv.example.invalid", "NERV_TOKEN": "tok"}
        with mock.patch.dict(os.environ, env, clear=True), self.assertRaises(rg.GateMisconfigured):
            rg.evaluate_review(str(self.repo))

    def test_not_a_git_repository_allows(self):
        d = rg.evaluate_review(str(self.tmp), client=FakeClient(code_item("uncovered")))
        self.assertFalse(d.blocked)


class RealTransportTest(_RepoCase):
    """실물 `pull.Nerv` + curl + loopback 가짜 서버. 토큰이 헤더로 가고 응답이 판정이 된다."""

    def _env(self, server, token="tok-123"):
        return {"NERV_SERVER": server.url, "NERV_TOKEN": token, "NERV_PROJECT": "clemvion",
                "PATH": os.environ.get("PATH", "")}

    def test_a_passed_round_over_the_wire(self):
        with _harness.FakeNervServer(code_item("passed", self.c1)) as server, \
                mock.patch.dict(os.environ, self._env(server), clear=True):
            d = rg.evaluate_review(str(self.repo))
        self.assertFalse(d.blocked, d.reason)
        self.assertEqual(len(server.requests), 1)
        path, auth = server.requests[0]
        self.assertEqual(auth, "Bearer tok-123")
        self.assertIn("branch=feature", path)

    def test_an_uncovered_round_over_the_wire(self):
        with _harness.FakeNervServer() as server, \
                mock.patch.dict(os.environ, self._env(server), clear=True):
            self.assertTrue(rg.evaluate_review(str(self.repo)).blocked)

    def test_401_over_the_wire_is_misconfiguration(self):
        with _harness.FakeNervServer(status=401, raw=b"{}") as server, \
                mock.patch.dict(os.environ, self._env(server), clear=True), \
                self.assertRaises(rg.GateMisconfigured):
            rg.evaluate_review(str(self.repo))

    def test_a_refused_connection_is_unavailable_not_misconfigured(self):
        with _harness.FakeNervServer() as server:
            url = server.url
        env = {"NERV_SERVER": url, "NERV_TOKEN": "t", "PATH": os.environ.get("PATH", "")}
        with mock.patch.dict(os.environ, env, clear=True), \
                self.assertRaises(rg.GateUnavailable) as cm:
            rg.evaluate_review(str(self.repo))
        self.assertNotIsInstance(cm.exception, rg.GateMisconfigured)

    def test_an_unloadable_client_is_misconfiguration(self):
        """pull.py 가 깨져 불러오지 못하면 고칠 때까지 계속 실패한다 — CI 가 실패로 본다."""
        with mock.patch.object(rg._nerv_read, "load_pull", side_effect=rg._nerv_read.NervReadError("깨짐")), \
                mock.patch.dict(os.environ, {"NERV_SERVER": "https://nerv.example.invalid", "NERV_TOKEN": "t"}, clear=True), \
                self.assertRaises(rg.GateMisconfigured):
            rg._client_from_env()

    def test_the_client_uses_the_short_hook_timeout(self):
        with mock.patch.dict(os.environ, {"NERV_SERVER": "https://nerv.example.invalid",
                                          "NERV_TOKEN": "t"}, clear=True):
            client = rg._client_from_env()
        self.assertEqual(client.max_time, rg.N1_MAX_TIME)
        self.assertLess(int(rg.N1_MAX_TIME), 60)


if __name__ == "__main__":
    unittest.main()
