"""`.claude/tools/nerv_review_handoff.py` — main 과 `resolution-applier` 사이의 인계 파일.

NERV 정본 전환 단계 2(NERV Task `CLE-T-4ABTG7`). 두 LLM 이 손으로 옮겨 적던 발견 ID 와 처분을 이
도구가 만들고 검사한다. 여기서 고정하는 것:

  - `fetch` — NERV 의 열린 발견을 커서를 따라 모두 읽고, 이미 사람에게 넘긴 발견은 뺀다.
  - `check` — 처분 파일의 불변식(전체 ID · 한 번씩 · fixed 는 HEAD 에서 닿는 40자 해시 · escalated
    사유 · critical 하향 금지 · 제안 파일 이름과 존재 · critical/warning 전수 처분).
  - `pending` — NERV 에 이미 기록된 처분은 다시 내지 않는다.
  - CLI — 문제가 있으면 exit 1, 실물 `pull.Nerv` 로 loopback 가짜 서버를 읽는다.

클래스별 목록. `.claude/tests/README.md` 의 카탈로그 행은 요약이고 이 목록이 정본이다. 클래스를 더하면 여기를 먼저 고친다.

  - FetchTest — 커서를 따라 열린 발견을 모두 읽는다. 필드 이름을 인계 스키마로 바꾼다. escalated 는 뺀다. 응답 이상 · 끝나지
    않는 커서는 `HandoffError`.
  - CheckTest — `_dispositions.json` 불변식 전부(전체 ID · 한 번씩 · resolution · rationale · fixed 의 전체 해시와 도달성 ·
    escalate_reason · critical 하향 거부 · 제안 파일 이름 · 전수 처분). fixed 는 리뷰한 브랜치 기준으로 판정하고 없으면
    HEAD. 전체 해시의 정의는 `git_probe` 하나다.
  - PendingTest — NERV 에 이미 기록된 처분은 다시 내지 않는다. 모르는 ID 는 `unknown` 이고 exit 1.
  - PendingOutTest(NERV Task `CLE-T-CD9131`) — `pending --out` 이 `nerv_finding_resolve` 인자 · 심각도 · 멱등 키만 쓴다
    (인자가 바뀌면 키도 바뀐다). 요약은 근거 문장 없이 `<ID 끝 8자> <resolution> <severity>`. `check` 를 통과하지 못한
    목록은 `ok: false`. 덜 모인 목록은 통과한 것만 기록한다. NERV 설정 없음 · 읽기 실패 · 인계 파일 없음 · 쓸 수 없는 경로는
    앞 실행의 파일을 `ok: false` 문서나 보고된 오류로 바꾼다.
  - OutPathTest — 입력 파일을 `--out` 으로 줘도 거절하고 지키며(exit 2) `pending` 이 죽어도 앞 문서가 남지 않는다.
    문서 `version` 은 `out_doc.VERSION`. 도구에 자체 git 호출이 없다.
  - CliTest — 문제가 있으면 exit 1, `fetch` 는 `--branch` 필요, loopback 서버로 REST 경로와 인증 헤더 확인, 설정 누락은 크래시가
    아니라 오류.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import _harness

TOOL_PATH = _harness.CLAUDE_DIR / "tools" / "nerv_review_handoff.py"
tool = _harness.load_module_by_path("nerv_review_handoff_under_test", TOOL_PATH)

CRIT = "01a0f648-f601-7000-8000-000000000001"
WARN = "01a0f648-f602-7000-8000-000000000002"
INFO = "01a0f648-f603-7000-8000-000000000003"


def item(fid, severity, **extra):
    base = {"id": fid, "severity": severity, "status": "open", "category": "security",
            "title": f"{severity} 발견", "file_path": "codebase/a.ts", "line_start": 3,
            "detail_md": "상세", "suggestion_md": "제안", "round_no": 1, "head_sha": "ab" * 20,
            "area": "codebase", "tags": [], "resolution_kind": None}
    base.update(extra)
    return base


class FakeClient:
    project = "clemvion"

    def __init__(self, pages=None, *, status=200, raw=None):
        self.pages = pages if pages is not None else [[]]
        self.status = status
        self.raw = raw
        self.calls: list[str] = []

    def get(self, path):
        self.calls.append(path)
        if self.raw is not None:
            return self.status, self.raw
        n = len(self.calls) - 1
        nxt = f"c{n + 1}" if n + 1 < len(self.pages) else None
        return self.status, json.dumps({"items": self.pages[n], "next_cursor": nxt}).encode()


class _SessionCase(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(os.path.realpath(tempfile.mkdtemp()))
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)
        self.repo = _harness.make_temp_git_repo(self.tmp / "repo")
        (self.repo / "codebase").mkdir()
        (self.repo / "codebase" / "a.ts").write_text("a\n", encoding="utf-8")
        _harness.git_in(self.repo, "add", "-A")
        _harness.git_in(self.repo, "commit", "-qm", "fix")
        self.head = _harness.git_in(self.repo, "rev-parse", "HEAD").stdout.strip()
        self.sd = self.repo / ".review" / "code" / "2026" / "10" / "01" / "12_00_00"
        self.sd.mkdir(parents=True)

    def write_findings(self, *items):
        tool.fetch(str(self.sd), "feature", FakeClient([list(items)]))

    def write_dispositions(self, dispositions, proposals=(), **extra):
        doc = {"version": 1, "dispositions": list(dispositions), "spec_proposals": list(proposals)}
        doc.update(extra)
        (self.sd / "_dispositions.json").write_text(json.dumps(doc), encoding="utf-8")

    def fixed(self, fid, sha=None):
        return {"finding_id": fid, "resolution": "fixed", "commit_sha": sha or self.head, "rationale": "고쳤다"}


class FetchTest(_SessionCase):
    def test_writes_every_open_finding_across_pages(self):
        client = FakeClient([[item(CRIT, "critical")], [item(WARN, "warning")]])
        out = tool.fetch(str(self.sd), "feature", client)
        doc = json.loads((self.sd / "_nerv_findings.json").read_text(encoding="utf-8"))
        self.assertEqual([f["finding_id"] for f in doc["findings"]], [CRIT, WARN])
        self.assertEqual(out["counts"], {"critical": 1, "warning": 1, "info": 0})
        self.assertEqual(len(client.calls), 2)
        self.assertIn("cursor=c1", client.calls[1])
        for path in client.calls:
            self.assertIn("branch=feature", path)
            self.assertIn("status=open", path)

    def test_fields_are_renamed_to_the_handoff_schema(self):
        self.write_findings(item(WARN, "warning"))
        f = json.loads((self.sd / "_nerv_findings.json").read_text(encoding="utf-8"))["findings"][0]
        self.assertEqual(f["role"], "security")
        self.assertEqual((f["file"], f["line"]), ("codebase/a.ts", 3))
        self.assertEqual((f["detail"], f["suggestion"]), ("상세", "제안"))

    def test_findings_already_escalated_are_left_out(self):
        self.write_findings(item(CRIT, "critical", resolution_kind="escalated"), item(WARN, "warning"))
        doc = json.loads((self.sd / "_nerv_findings.json").read_text(encoding="utf-8"))
        self.assertEqual([f["finding_id"] for f in doc["findings"]], [WARN])

    def test_bad_responses_raise(self):
        for client in (FakeClient(status=503), FakeClient(raw=b"nope"), FakeClient(raw=b'{"items": 1}')):
            with self.subTest(client=client.status), self.assertRaises(tool.HandoffError):
                tool.fetch(str(self.sd), "feature", client)

    def test_a_cursor_that_never_ends_is_cut(self):
        class Loop(FakeClient):
            def get(self, path):
                self.calls.append(path)
                return 200, json.dumps({"items": [], "next_cursor": "again"}).encode()
        with self.assertRaises(tool.HandoffError):
            tool.fetch(str(self.sd), "feature", Loop())


class CheckTest(_SessionCase):
    def setUp(self):
        super().setUp()
        self.write_findings(item(CRIT, "critical"), item(WARN, "warning"), item(INFO, "info"))
        (self.sd / "_spec-proposal-auth.md").write_text("제안\n", encoding="utf-8")

    def errors(self):
        return tool.check(str(self.sd))["errors"]

    def test_a_complete_handoff_passes_and_leaves_info_to_main(self):
        self.write_dispositions([self.fixed(CRIT)],
                                [{"finding_id": WARN, "file": "_spec-proposal-auth.md"}])
        out = tool.check(str(self.sd))
        self.assertTrue(out["ok"], out["errors"])
        self.assertEqual(out["left_to_main"], [INFO])

    def test_each_broken_invariant_is_reported(self):
        ok_warn = {"finding_id": WARN, "resolution": "wont_fix", "rationale": "근거"}
        cases = {
            "전체 ID": [self.fixed(CRIT[:8]), ok_warn],
            "없다": [self.fixed(CRIT), ok_warn, {"finding_id": "01a0f648-0000-7000-8000-000000000009",
                                                 "resolution": "dismissed", "rationale": "x"}],
            "두 번": [self.fixed(CRIT), ok_warn, dict(ok_warn)],
            "resolution 은": [self.fixed(CRIT), dict(ok_warn, resolution="spec_change")],
            "rationale": [self.fixed(CRIT), dict(ok_warn, rationale=" ")],
            "40자": [self.fixed(CRIT, self.head[:12]), ok_warn],
            "닿지 않는다": [self.fixed(CRIT, "ab" * 20), ok_warn],
            "escalate_reason": [self.fixed(CRIT), dict(ok_warn, resolution="escalated")],
            "critical 발견을": [{"finding_id": CRIT, "resolution": "dismissed", "rationale": "x"}, ok_warn],
            "처분이 없다": [self.fixed(CRIT)],
        }
        for needle, dispositions in cases.items():
            with self.subTest(needle=needle):
                self.write_dispositions(dispositions)
                errors = self.errors()
                self.assertTrue(any(needle in e for e in errors), errors)

    def test_a_full_hash_is_whatever_git_probe_says_it_is(self):
        # "전체 해시" 의 정의는 `git_probe.is_full_commit_id` 하나다. SHA-256 길이(64자)는 형식 검사를 지나 도달성에서 걸린다.
        # 40자만 받는 자체 패턴이 남아 있으면 같은 값이 "40자" 오류로 먼저 걸린다.
        ok_warn = {"finding_id": WARN, "resolution": "wont_fix", "rationale": "근거"}
        self.write_dispositions([self.fixed(CRIT, "ab" * 32), ok_warn])
        errors = self.errors()
        self.assertTrue(any("닿지 않는다" in e for e in errors), errors)
        self.assertFalse(any("40자" in e for e in errors), errors)
        self.write_dispositions([self.fixed(CRIT, "AB" * 20), ok_warn])  # 대문자는 git 이 내는 모양이 아니다
        self.assertTrue(any("40자" in e for e in self.errors()))

    def test_the_reviewed_branch_target_is_resolved_through_git_probe(self):
        _harness.git_in(self.repo, "branch", "reviewed")
        cwd = str(self.sd)
        self.assertEqual(tool._ancestor_target("reviewed", cwd), "refs/heads/reviewed")
        for unknown in ("no-such-branch", "", None, 7):
            with self.subTest(branch=unknown):
                self.assertEqual(tool._ancestor_target(unknown, cwd), "HEAD")

    def test_escalated_with_a_reason_and_critical_escalation_pass(self):
        self.write_dispositions([
            {"finding_id": CRIT, "resolution": "escalated", "escalate_reason": "user-decision", "rationale": "x"},
            {"finding_id": WARN, "resolution": "escalated", "escalate_reason": "spec", "rationale": "x"},
        ])
        self.assertEqual(self.errors(), [])

    def test_fixed_commits_are_checked_against_the_reviewed_branch(self):
        """짝 워크트리에서 다른 브랜치를 리뷰해도 그 브랜치 기준으로 판정한다(워크트리는 ref 를 공유한다)."""
        _harness.git_in(self.repo, "checkout", "-q", "-b", "reviewed")
        (self.repo / "codebase" / "b.ts").write_text("b\n", encoding="utf-8")
        # 세션 디렉터리(.review/)는 추적하지 않는다 — `add -A` 면 브랜치를 오갈 때 지워진다.
        _harness.git_in(self.repo, "add", "codebase/b.ts")
        _harness.git_in(self.repo, "commit", "-qm", "fix on reviewed")
        on_branch = _harness.git_in(self.repo, "rev-parse", "HEAD").stdout.strip()
        _harness.git_in(self.repo, "checkout", "-q", "-")
        tool.fetch(str(self.sd), "reviewed", FakeClient([[item(CRIT, "critical"), item(WARN, "warning"),
                                                          item(INFO, "info")]]))
        ok_warn = {"finding_id": WARN, "resolution": "wont_fix", "rationale": "근거"}
        self.write_dispositions([self.fixed(CRIT, on_branch), ok_warn])
        self.assertEqual(self.errors(), [])
        tool.fetch(str(self.sd), "no-such-branch", FakeClient([[item(CRIT, "critical"), item(WARN, "warning")]]))
        self.assertTrue(any("HEAD" in e for e in self.errors()))

    def test_proposal_files_must_be_underscored_and_present(self):
        (self.sd / "spec-proposal-auth.md").write_text("x\n", encoding="utf-8")
        for name, needle in (("spec-proposal-auth.md", "_spec-proposal-<area>.md"),
                             ("_spec-proposal-../x.md", "_spec-proposal-<area>.md"),
                             ("_spec-proposal-Auth.md", "_spec-proposal-<area>.md"),
                             ("_spec-proposal-gone.md", "없다")):
            with self.subTest(name=name):
                self.write_dispositions([self.fixed(CRIT)], [{"finding_id": WARN, "file": name}])
                errors = self.errors()
                self.assertTrue(any(needle in e for e in errors), errors)

    def test_a_finding_in_both_a_disposition_and_a_proposal_is_a_duplicate(self):
        self.write_dispositions([self.fixed(CRIT), {"finding_id": WARN, "resolution": "wont_fix", "rationale": "x"}],
                                [{"finding_id": WARN, "file": "_spec-proposal-auth.md"}])
        self.assertTrue(any("두 번" in e for e in self.errors()))

    def test_missing_or_wrong_version_files_raise(self):
        with self.assertRaises(tool.HandoffError):
            tool.check(str(self.sd))  # _dispositions.json 없음
        self.write_dispositions([self.fixed(CRIT)])
        doc = json.loads((self.sd / "_dispositions.json").read_text(encoding="utf-8"))
        doc["version"] = 2
        (self.sd / "_dispositions.json").write_text(json.dumps(doc), encoding="utf-8")
        with self.assertRaises(tool.HandoffError):
            tool.check(str(self.sd))


class PendingTest(_SessionCase):
    def test_only_findings_still_open_and_unresolved_are_pending(self):
        self.write_dispositions([
            self.fixed(CRIT),
            {"finding_id": WARN, "resolution": "escalated", "escalate_reason": "infra", "rationale": "x"},
            {"finding_id": INFO, "resolution": "wont_fix", "rationale": "x"},
        ])
        # CRIT 은 아직 열림, WARN 은 이미 escalated 로 기록됨, INFO 는 이미 닫힘(목록에 없음).
        client = FakeClient([[item(CRIT, "critical"), item(WARN, "warning", resolution_kind="escalated")]])
        self.write_findings(item(CRIT, "critical"), item(WARN, "warning"), item(INFO, "info"))
        out = tool.pending(str(self.sd), "feature", client)
        self.assertTrue(out["ok"], out)
        self.assertEqual([d["finding_id"] for d in out["pending"]], [CRIT])
        self.assertEqual(sorted(out["already_recorded"]), sorted([WARN, INFO]))

    def test_unknown_or_malformed_ids_are_not_counted_as_recorded(self):
        self.write_findings(item(CRIT, "critical"))
        self.write_dispositions([self.fixed(CRIT), self.fixed("01a0f648-ffff-7000-8000-000000000000"),
                                 self.fixed(CRIT[:8])])
        out = tool.pending(str(self.sd), "feature", FakeClient([[item(CRIT, "critical")]]))
        self.assertFalse(out["ok"])
        self.assertEqual(out["unknown"], ["01a0f648-ffff-7000-8000-000000000000", CRIT[:8]])
        self.assertEqual(out["already_recorded"], [])


class PendingOutTest(_SessionCase):
    """`pending --out` — 기록 서브에이전트(`nerv-recorder`)가 그대로 낼 처분 인자를 파일에 쓴다(NERV Task `CLE-T-CD9131`).

    main 은 처분 전문을 읽지 않고 건수 요약만 받는다."""

    def setUp(self):
        super().setUp()
        self.out = self.sd / "_nerv_resolve.json"

    def run_pending(self, open_items):
        body = json.dumps({"items": open_items, "next_cursor": None}).encode()
        with _harness.FakeNervServer(raw=body) as server:
            env = {"NERV_SERVER": server.url, "NERV_TOKEN": "tok-9", "PATH": os.environ.get("PATH", "")}
            return subprocess.run([sys.executable, str(TOOL_PATH), "pending", str(self.sd), "--branch", "feature",
                                   "--out", str(self.out)], capture_output=True, text=True, timeout=60, env=env)

    def test_writes_only_resolve_arguments_with_keys_and_prints_counts(self):
        self.write_findings(item(CRIT, "critical"), item(WARN, "warning"), item(INFO, "info"))
        self.write_dispositions([
            self.fixed(CRIT),
            {"finding_id": WARN, "resolution": "escalated", "escalate_reason": "infra",
             "rationale": "도커가 죽었다", "note": "applier 메모"},
            {"finding_id": INFO, "resolution": "wont_fix", "rationale": "이미 닫힘"},
        ])
        r = self.run_pending([item(CRIT, "critical"), item(WARN, "warning")])
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        doc = json.loads(self.out.read_text(encoding="utf-8"))
        self.assertTrue(doc["ok"])
        self.assertEqual(doc["branch"], "feature")
        rows = {d["finding_id"]: d for d in doc["dispositions"]}
        self.assertEqual(set(rows), {CRIT, WARN})
        self.assertEqual(set(rows[CRIT]), {"finding_id", "resolution", "commit_sha", "rationale", "severity",
                                           "idempotency_key"})
        self.assertEqual(rows[CRIT]["severity"], "critical")
        self.assertEqual(rows[WARN]["escalate_reason"], "infra")
        self.assertNotIn("note", rows[WARN])
        self.assertRegex(rows[CRIT]["idempotency_key"], rf"^resolve:{CRIT}:fixed:[0-9a-f]{{12}}$")
        self.assertEqual(doc["already_recorded"], [INFO])
        summary = json.loads(r.stdout)
        # items 는 끝 8자를 쓴다. UUIDv7 은 앞자리가 같은 분의 발견끼리 겹친다(이 픽스처도 앞 8자가 같다).
        self.assertEqual(summary, {"ok": True, "out": str(self.out), "pending": 2,
                                   "by_resolution": {"escalated": 1, "fixed": 1},
                                   "items": [f"{CRIT[-8:]} fixed critical", f"{WARN[-8:]} escalated warning"],
                                   "already_recorded": 1, "unknown": []})
        self.assertNotIn("도커가 죽었다", r.stdout)

    def test_unknown_ids_write_a_not_ok_file_with_nothing_to_record(self):
        self.write_findings(item(CRIT, "critical"))
        self.write_dispositions([self.fixed(CRIT), self.fixed(CRIT[:8])])
        r = self.run_pending([item(CRIT, "critical")])
        self.assertEqual(r.returncode, 1, r.stdout)
        doc = json.loads(self.out.read_text(encoding="utf-8"))
        self.assertFalse(doc["ok"])
        self.assertEqual(doc["dispositions"], [])
        self.assertEqual(json.loads(r.stdout)["unknown"], [CRIT[:8]])

    def test_the_key_follows_the_recorded_arguments(self):
        a = self.fixed(CRIT)
        self.assertEqual(tool.resolve_key(a), tool.resolve_key(dict(a, note="무시되는 필드")))
        self.assertNotEqual(tool.resolve_key(a), tool.resolve_key(dict(a, rationale="다른 근거")))
        self.assertNotEqual(tool.resolve_key(a), tool.resolve_key(dict(a, commit_sha="cd" * 20)))

    # -- 처분 목록은 `check` 를 통과해야 문서가 된다 ------------------------------------------------

    def test_a_disposition_that_check_rejects_is_not_written_for_the_recorder(self):
        # main 은 근거 문장을 읽지 않는다. critical 을 낮추는 처분 · 엉뚱한 해시가 검증 없이 NERV 로 가면 안 된다.
        self.write_findings(item(CRIT, "critical"), item(WARN, "warning"))
        self.write_dispositions([
            {"finding_id": CRIT, "resolution": "dismissed", "rationale": "오탐이다"},
            self.fixed(WARN, sha="cd" * 20),
        ])
        r = self.run_pending([item(CRIT, "critical"), item(WARN, "warning")])
        self.assertEqual(r.returncode, 1, r.stdout)
        doc = json.loads(self.out.read_text(encoding="utf-8"))
        self.assertFalse(doc["ok"])
        self.assertEqual(doc["dispositions"], [])
        joined = " ".join(doc["errors"])
        self.assertIn("critical 발견을 dismissed", joined)
        self.assertIn("닿지 않는다", joined)
        summary = json.loads(r.stdout)
        self.assertFalse(summary["ok"])
        self.assertEqual(summary["pending"], 0)
        self.assertTrue(summary["errors"])

    def test_a_missing_rationale_or_reason_is_rejected_too(self):
        self.write_findings(item(WARN, "warning"), item(INFO, "info"))
        self.write_dispositions([
            {"finding_id": WARN, "resolution": "escalated", "rationale": "사유 없음"},
            {"finding_id": INFO, "resolution": "wont_fix"},
        ])
        r = self.run_pending([item(WARN, "warning"), item(INFO, "info")])
        self.assertEqual(r.returncode, 1, r.stdout)
        self.assertFalse(json.loads(self.out.read_text(encoding="utf-8"))["ok"])

    def test_a_list_that_is_not_complete_yet_still_records_what_passed(self):
        # applier 가 중간에 끝나 warning 하나의 처분이 아직 없다. 통과한 처분까지 막지는 않는다(처분이 없는 발견은 `check` 의 몫이다).
        self.write_findings(item(CRIT, "critical"), item(WARN, "warning"))
        self.write_dispositions([self.fixed(CRIT)])
        r = self.run_pending([item(CRIT, "critical"), item(WARN, "warning")])
        self.assertEqual(r.returncode, 0, r.stdout)
        doc = json.loads(self.out.read_text(encoding="utf-8"))
        self.assertTrue(doc["ok"])
        self.assertEqual([d["finding_id"] for d in doc["dispositions"]], [CRIT])
        self.assertEqual(tool.check(str(self.sd))["ok"], False)

    # -- 실패해도 `--out` 에는 이번 실행의 결과만 남는다 ---------------------------------------------

    def stale_out(self):
        self.out.write_text(json.dumps({"version": 1, "ok": True, "stale": True, "dispositions": [
            {"finding_id": WARN, "resolution": "fixed", "idempotency_key": "old"}]}), encoding="utf-8")

    def run_pending_without_nerv(self):
        return subprocess.run([sys.executable, str(TOOL_PATH), "pending", str(self.sd), "--branch", "feature",
                               "--out", str(self.out)], capture_output=True, text=True, timeout=60,
                              env={"PATH": os.environ.get("PATH", "")})

    def test_no_nerv_configuration_replaces_the_previous_file_with_a_not_ok_one(self):
        self.write_findings(item(WARN, "warning"))
        self.write_dispositions([self.fixed(WARN)])
        self.stale_out()
        r = self.run_pending_without_nerv()
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        doc = json.loads(self.out.read_text(encoding="utf-8"))
        self.assertFalse(doc["ok"])
        self.assertNotIn("stale", doc)
        self.assertEqual(doc["dispositions"], [])
        self.assertIn("NERV_SERVER", " ".join(doc["errors"]))
        summary = json.loads(r.stdout)
        self.assertFalse(summary["ok"])
        self.assertEqual(summary["out"], str(self.out))

    def test_a_failing_nerv_read_replaces_the_previous_file(self):
        self.write_findings(item(WARN, "warning"))
        self.write_dispositions([self.fixed(WARN)])
        self.stale_out()
        with _harness.FakeNervServer(raw=b"not json") as server:
            env = {"NERV_SERVER": server.url, "NERV_TOKEN": "tok-9", "PATH": os.environ.get("PATH", "")}
            r = subprocess.run([sys.executable, str(TOOL_PATH), "pending", str(self.sd), "--branch", "feature",
                                "--out", str(self.out)], capture_output=True, text=True, timeout=60, env=env)
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        doc = json.loads(self.out.read_text(encoding="utf-8"))
        self.assertFalse(doc["ok"])
        self.assertNotIn("stale", doc)

    def test_a_missing_handoff_file_replaces_the_previous_file(self):
        self.stale_out()  # _nerv_findings.json 도 _dispositions.json 도 없다
        body = json.dumps({"items": [], "next_cursor": None}).encode()
        with _harness.FakeNervServer(raw=body) as server:
            env = {"NERV_SERVER": server.url, "NERV_TOKEN": "tok-9", "PATH": os.environ.get("PATH", "")}
            r = subprocess.run([sys.executable, str(TOOL_PATH), "pending", str(self.sd), "--branch", "feature",
                                "--out", str(self.out)], capture_output=True, text=True, timeout=60, env=env)
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        doc = json.loads(self.out.read_text(encoding="utf-8"))
        self.assertFalse(doc["ok"])
        self.assertNotIn("stale", doc)

    def test_an_unwritable_out_path_is_reported_not_a_traceback(self):
        self.write_findings(item(WARN, "warning"))
        self.write_dispositions([self.fixed(WARN)])
        self.out = self.tmp / "no-such-dir" / "r.json"
        r = self.run_pending([item(WARN, "warning")])
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        self.assertNotIn("Traceback", r.stderr)
        self.assertIn("--out", " ".join(json.loads(r.stdout)["errors"]))

    def test_out_is_only_for_pending(self):
        r = subprocess.run([sys.executable, str(TOOL_PATH), "check", str(self.sd), "--out", str(self.out)],
                           capture_output=True, text=True, timeout=60)
        self.assertEqual(r.returncode, 2)
        self.assertFalse(self.out.exists())


class OutPathTest(_SessionCase):
    """`--out` 이 낡은 문서를 치우는 규칙(`_shared/out_doc.py`)을 이 도구가 어떻게 거는지."""

    def setUp(self):
        super().setUp()
        self.out = self.sd / "_nerv_resolve.json"
        self.write_findings(item(WARN, "warning"))
        self.write_dispositions([self.fixed(WARN)])

    def run_pending(self, target):
        env = {"NERV_SERVER": "http://127.0.0.1:9", "NERV_TOKEN": "tok-9", "PATH": os.environ.get("PATH", "")}
        return subprocess.run([sys.executable, str(TOOL_PATH), "pending", str(self.sd), "--branch", "feature",
                               "--out", str(target)], capture_output=True, text=True, timeout=60, env=env)

    def test_the_input_files_are_refused_as_an_out_path_and_survive(self):
        # `--out` 을 입력 파일로 잘못 주면 NERV 읽기가 실패하는 실행에서 applier 가 쓴 처분 파일이 사라졌다.
        for name in ("_dispositions.json", "_nerv_findings.json"):
            with self.subTest(name=name):
                target = self.sd / name
                before = target.read_bytes()
                r = self.run_pending(target)
                self.assertEqual(r.returncode, 2, r.stdout + r.stderr)
                self.assertIn("이 도구가 쓴 --out 문서가 아니다", r.stderr)
                self.assertEqual(target.read_bytes(), before)

    def test_the_previous_file_is_removed_before_the_work_so_a_crash_leaves_no_stale_document(self):
        # `pending` 이 잡히지 않는 예외로 죽는 경우. 시작할 때 지우는 호출이 없으면 앞 실행의 ok:true 문서가 남는다.
        self.out.write_text(json.dumps({"version": 1, "ok": True, "dispositions": []}), encoding="utf-8")
        with mock.patch.object(tool.nerv_read, "client_from_env", return_value=FakeClient()), \
                mock.patch.object(tool, "pending", side_effect=RuntimeError("boom")), \
                self.assertRaises(RuntimeError):
            tool.main(["pending", str(self.sd), "--branch", "feature", "--out", str(self.out)])
        self.assertFalse(self.out.exists())

    def test_the_documents_carry_the_shared_version(self):
        # 입력 파일의 VERSION 과 `--out` 문서의 version 은 다른 것이다. 문서는 `out_doc.VERSION` 을 쓴다.
        out = {"ok": True, "pending": [self.fixed(WARN)], "already_recorded": [], "unknown": []}
        with mock.patch.object(tool.out_doc, "VERSION", 7), mock.patch.object(tool, "VERSION", 1):
            self.assertEqual(tool.resolve_document(str(self.sd), "feature", out)["version"], 7)

    def test_the_tool_has_no_git_calls_of_its_own(self):
        # git 호출은 `_shared/git_probe` 의 공개 함수로만 한다. 비공개 `_run_git` 을 직접 부르거나 `git` 인자를 손으로 조립하면
        # 같은 질문("이 이름이 로컬 브랜치인가")이 도구마다 다른 구현이 된다.
        source = TOOL_PATH.read_text(encoding="utf-8")
        self.assertNotIn("subprocess", source)
        self.assertNotIn('"git"', source)
        self.assertNotRegex(source, r"git_probe\._")
        self.assertNotIn("_FULL_SHA", source)


class CliTest(_SessionCase):
    def run_cli(self, *args, env=None):
        return subprocess.run([sys.executable, str(TOOL_PATH), *args], capture_output=True, text=True,
                              timeout=60, env=env)

    def test_check_exits_one_on_problems_and_zero_when_clean(self):
        self.write_findings(item(WARN, "warning"))
        self.write_dispositions([])
        r = self.run_cli("check", str(self.sd))
        self.assertEqual(r.returncode, 1, r.stdout)
        self.write_dispositions([{"finding_id": WARN, "resolution": "wont_fix", "rationale": "x"}])
        r = self.run_cli("check", str(self.sd))
        self.assertEqual(r.returncode, 0, r.stdout)

    def test_fetch_needs_a_branch(self):
        r = self.run_cli("fetch", str(self.sd))
        self.assertEqual(r.returncode, 2)

    def test_fetch_over_the_wire(self):
        body = json.dumps({"items": [item(WARN, "warning")], "next_cursor": None}).encode()
        with _harness.FakeNervServer(raw=body) as server:
            env = {"NERV_SERVER": server.url, "NERV_TOKEN": "tok-9", "PATH": os.environ.get("PATH", "")}
            r = self.run_cli("fetch", str(self.sd), "--branch", "feature", env=env)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        path, auth = server.requests[0]
        self.assertTrue(path.startswith("/api/v1/projects/clemvion/findings?"), path)
        self.assertEqual(auth, "Bearer tok-9")
        doc = json.loads((self.sd / "_nerv_findings.json").read_text(encoding="utf-8"))
        self.assertEqual([f["finding_id"] for f in doc["findings"]], [WARN])

    def test_missing_configuration_is_an_error_not_a_crash(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            r = self.run_cli("fetch", str(self.sd), "--branch", "feature",
                             env={"PATH": os.environ.get("PATH", "")})
        self.assertEqual(r.returncode, 1, r.stderr)
        self.assertIn("NERV_SERVER", r.stdout)


if __name__ == "__main__":
    unittest.main()
