"""`.claude/tools/nerv_record_verify.py` — `nerv-recorder` 의 기록을 NERV 에서 다시 읽어 문서와 대조한다.

NERV Task `CLE-T-CD9131`. 기록 서브에이전트는 반환의 건수를 틀렸고(`DONE=8/8` · `DONE=15/15`) 4.5KB 본문의 한 글자를
바꿔 보냈다("뮤턴트" → "뷰턴트"). main 은 그 수를 믿지 않고 이 도구로 대조한다. 여기서 고정하는 것:

  - SubmitTest — 역할은 문서 head 의 N1 라운드 `roles.reported` 로, 발견은 브랜치의 모든 상태 · 모든 쪽에서 제목으로 찾아
    필드 여섯 개(severity · body · suggestion · file · line · category)를 비교한다. 같은 제목이 여럿이면 head → 전부 일치 →
    category 순으로 고른다. 바뀐 값은 처음 달라지는 곳의 발췌만 싣고 본문 전문은 싣지 않는다. 응답에 없는 키와 역할 정보는
    `unverified` 이고 막지 않는다.
  - ResolveTest — 처분마다 resolution · rationale · commit_sha 를 비교한다. 기록이 없거나 처분이 붙지 않았으면 missing.
  - CliTest — 종료 코드(0 일치 · 1 불일치 · 2 인자 · 3 대조 불가)와 JSON 한 줄. 문서 형식 문제는 NERV 설정보다 먼저 알린다.
    실물 `pull.Nerv` 로 루프백 가짜 서버의 두 경로를 읽고, 오류 출력에 토큰이 없다.
  - SharedPathTest — REST 경로가 인계 도구 · push 게이트의 것과 같다.
"""

from __future__ import annotations

import contextlib
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
import urllib.parse
from pathlib import Path
from unittest import mock

import _harness

TOOL_PATH = _harness.CLAUDE_DIR / "tools" / "nerv_record_verify.py"
tool = _harness.load_module_by_path("nerv_record_verify_under_test", TOOL_PATH)

BRANCH = "feature"
HEAD = "ab" * 20
OLD_HEAD = "cd" * 20
BASE = "ef" * 20
FIX_SHA = "12" * 20


def fid(n: int) -> str:
    """UUIDv7 모양의 발견 ID. 앞 8자가 모두 같다(실제 NERV ID 처럼)."""
    return f"01a120ad-66cf-7198-a8f3-{n:012x}"


def finding(title, role="testing", **extra):
    f = {"severity": "warning", "title": title, "body": f"{title} 본문", "category": role,
         "suggestion": "제안", "file": "a.py", "line": 3}
    f.update(extra)
    return f


def record(n, f, *, head=HEAD, status="open", **extra):
    """문서의 발견 `f` 를 그대로 옮겨 적은 NERV 기록(발견 목록 REST 의 필드 이름)."""
    r = {"id": fid(n), "severity": f["severity"], "status": status, "category": f.get("category"),
         "title": f["title"], "detail_md": f.get("body"), "suggestion_md": f.get("suggestion"),
         "file_path": f.get("file"), "line_start": f.get("line"), "head_sha": head, "branch": BRANCH,
         "round_no": 1, "resolution_kind": None, "resolution_rationale": None, "resolution_commit": None}
    r.update(extra)
    return r


def payload(bundles: dict, **submit):
    s = {"kind": "code", "branch": BRANCH, "base_sha": BASE, "head_sha": HEAD, "changeset": ["a.py"],
         "task_id": "CLE-T-TEST01"}
    s.update(submit)
    return {"version": 1, "ok": True, "submit": s,
            "submissions": [{"reviewer": {"role": role, "risk": "low"}, "summary": "요약", "findings": fs,
                             "idempotency_key": f"k:{role}"} for role, fs in bundles.items()]}


def n1_item(reported, *, kind="code", head=HEAD):
    return {"kind": kind, "state": "passed", "round_no": 1, "head_sha": head,
            "roles": {"required": [], "reported": list(reported), "missing": []}}


class FakeNerv:
    """N1 과 발견 목록 두 경로에 답한다. 인프로세스 클라이언트(`get`)와 루프백 서버의 `route` 로 같이 쓴다."""

    project = "clemvion"

    def __init__(self, records=(), n1=None, *, page_size=100, n1_status=200, findings_status=200):
        self.records = list(records)
        self.n1 = n1
        self.page_size = page_size
        self.n1_status = n1_status
        self.findings_status = findings_status
        self.calls: list[str] = []

    def get(self, path):
        self.calls.append(path)
        return self.answer(path)

    def answer(self, path):
        parts = urllib.parse.urlsplit(path)
        query = urllib.parse.parse_qs(parts.query)
        if parts.path == "/api/v1/projects/clemvion/gates/reviews/check":
            items = [self.n1] if self.n1 is not None else []
            return self.n1_status, json.dumps({"branch": BRANCH, "head_sha": None, "items": items}).encode()
        if parts.path == "/api/v1/projects/clemvion/findings":
            if self.findings_status != 200:
                return self.findings_status, b'{"ok": false}'
            rows = [r for r in self.records if r["status"] == query["status"][0]
                    and r["branch"] == query["branch"][0]]
            start = int(query.get("cursor", ["0"])[0])
            end = start + self.page_size
            return 200, json.dumps({"items": rows[start:end],
                                    "next_cursor": str(end) if end < len(rows) else None}).encode()
        return 404, b"{}"

    def queries(self, suffix):
        return [urllib.parse.parse_qs(urllib.parse.urlsplit(p).query) for p in self.calls if
                urllib.parse.urlsplit(p).path.endswith(suffix)]


def verify_submit(doc, nerv):
    return tool.verify_submit(doc, nerv).as_dict()


class SubmitTest(unittest.TestCase):
    def setUp(self):
        self.a = finding("가드가 없다", "testing")
        self.b = finding("토큰이 샌다", "security", severity="critical")
        self.doc = payload({"testing": [self.a], "security": [self.b], "scope": []})
        self.records = [record(1, self.a), record(2, self.b)]

    def run_doc(self, records=None, n1=..., **kw):
        n1 = n1_item(["testing", "security", "scope"]) if n1 is ... else n1
        self.nerv = FakeNerv(self.records if records is None else records, n1, **kw)
        return verify_submit(self.doc, self.nerv)

    def test_everything_recorded_matches(self):
        out = self.run_doc()
        self.assertEqual(out, {"ok": True, "mode": "submit", "checked": 5, "missing": [], "altered": [],
                               "unverified": [], "errors": []})

    def test_the_round_is_asked_for_the_document_branch_kind_and_head(self):
        self.doc["submit"]["kind"] = "consistency"
        self.run_doc(n1=n1_item(["testing", "security", "scope"], kind="consistency"))
        (q,) = self.nerv.queries("/gates/reviews/check")
        self.assertEqual((q["branch"], q["kind"], q["head_sha"]), ([BRANCH], ["consistency"], [HEAD]))

    def test_a_role_missing_from_the_round_is_missing(self):
        out = self.run_doc(n1=n1_item(["testing", "scope"]))
        self.assertFalse(out["ok"])
        self.assertEqual(out["missing"], ["role:security"])

    def test_no_reported_roles_is_unverified_and_does_not_fail(self):
        no_roles = dict(n1_item([]), state="uncovered")
        del no_roles["roles"]
        for n1, needle in ((no_roles, "roles.reported"), (None, "kind=code")):
            with self.subTest(needle=needle):
                out = self.run_doc(n1=n1)
                self.assertTrue(out["ok"], out)
                self.assertEqual(len(out["unverified"]), 1)
                self.assertTrue(out["unverified"][0].startswith("roles: "), out)
                self.assertIn(needle, out["unverified"][0])

    def test_findings_are_read_in_every_status(self):
        # 처분된 발견도 기록이다. REST 는 status 를 하나만 받는다.
        for status in ("fixed", "dismissed", "wont_fix", "open"):
            with self.subTest(status=status):
                out = self.run_doc([record(1, self.a, status=status), record(2, self.b, status=status)])
                self.assertEqual(out["missing"], [])
        self.assertEqual(sorted(q["status"][0] for q in self.nerv.queries("/findings")),
                         sorted(tool.STATUSES))

    def test_every_page_is_read(self):
        filler = [record(10 + n, finding(f"다른 발견 {n}")) for n in range(4)]
        out = self.run_doc(filler + self.records, page_size=2)
        self.assertEqual(out["missing"], [])
        self.assertTrue(any("cursor" in q for q in self.nerv.queries("/findings")))

    def test_a_finding_without_a_record_is_missing(self):
        long_title = "아주 긴 제목 " * 10
        self.doc = payload({"testing": [self.a, finding(long_title)], "security": [self.b], "scope": []})
        out = self.run_doc([record(2, self.b)])
        self.assertFalse(out["ok"])
        shown = long_title.strip()[:tool.TITLE_SHOWN] + "..."
        self.assertEqual(out["missing"], ['testing "가드가 없다"', f'testing "{shown}"'])

    def test_a_one_letter_change_in_a_long_body_is_shown_as_a_short_excerpt(self):
        body = "가" * 2000 + "\n\n두 `clear` 호출을 지운 뮤턴트가 살아남는다." + "나" * 2000
        self.a["body"] = body
        out = self.run_doc([record(1, self.a, detail_md=body.replace("뮤턴트", "뷰턴트")), record(2, self.b)])
        self.assertFalse(out["ok"])
        (line,) = out["altered"]
        self.assertTrue(line.startswith(f"{fid(1)[-8:]} testing body "), line)
        self.assertIn("뮤턴트", line)
        self.assertIn("뷰턴트", line)
        self.assertLess(len(line), 200)
        printed = json.dumps(out, ensure_ascii=False)
        self.assertNotIn("가" * 100, printed)
        self.assertNotIn("나" * 100, printed)

    def test_each_field_is_compared(self):
        changes = {"severity": ("severity", "critical"), "body": ("detail_md", "다른 본문"),
                   "suggestion": ("suggestion_md", "다른 제안"), "file": ("file_path", "b.py"),
                   "line": ("line_start", 4), "category": ("category", "security")}
        self.assertEqual(set(changes), {doc_key for doc_key, _ in tool.SUBMIT_FIELDS})
        for field, (rec_key, value) in changes.items():
            with self.subTest(field=field):
                out = self.run_doc([record(1, self.a, **{rec_key: value}), record(2, self.b)])
                (line,) = out["altered"]
                self.assertTrue(line.startswith(f"{fid(1)[-8:]} testing {field} "), line)

    def test_surrounding_whitespace_and_null_are_not_changes(self):
        self.a.pop("suggestion")
        out = self.run_doc([record(1, self.a, detail_md=f"  {self.a['body']}\n", line_start=3), record(2, self.b)])
        self.assertTrue(out["ok"], out)

    def test_a_field_the_response_does_not_carry_is_unverified_not_altered(self):
        rec = record(1, self.a)
        del rec["suggestion_md"]
        out = self.run_doc([rec, record(2, self.b)])
        self.assertTrue(out["ok"], out)
        self.assertEqual(out["unverified"], ["suggestion: 응답에 suggestion_md 가 없다"])

    def test_the_record_at_the_document_head_is_preferred(self):
        # 앞 라운드에 같은 제목 · 같은 본문의 기록이 있어도 이번 head 의 기록이 바뀌었으면 잡는다.
        old = record(1, self.a, head=OLD_HEAD)
        new = record(3, self.a, detail_md="바뀐 본문")
        out = self.run_doc([old, new, record(2, self.b)])
        (line,) = out["altered"]
        self.assertTrue(line.startswith(f"{fid(3)[-8:]} testing body "), line)

    def test_among_equals_an_exact_record_is_preferred(self):
        other_file = record(1, self.a, file_path="other.py")
        exact = record(3, self.a)
        self.assertTrue(self.run_doc([other_file, exact, record(2, self.b)])["ok"])

    def test_among_inexact_records_the_same_category_is_preferred(self):
        other_role = record(1, self.a, category="security")
        same_role = record(3, self.a, detail_md="바뀐 본문")
        out = self.run_doc([other_role, same_role, record(2, self.b)])
        (line,) = out["altered"]
        self.assertTrue(line.startswith(f"{fid(3)[-8:]} testing body "), line)


class ResolveTest(unittest.TestCase):
    def setUp(self):
        self.doc = {"version": 1, "ok": True, "branch": BRANCH, "dispositions": [
            {"finding_id": fid(1), "resolution": "fixed", "commit_sha": FIX_SHA, "rationale": "고쳤다",
             "severity": "warning", "idempotency_key": "resolve:1"},
            {"finding_id": fid(2), "resolution": "wont_fix", "rationale": "다음 Task 로 넘긴다",
             "severity": "warning", "idempotency_key": "resolve:2"},
            {"finding_id": fid(3), "resolution": "escalated", "escalate_reason": "infra", "rationale": "도커",
             "severity": "critical", "idempotency_key": "resolve:3"},
        ]}
        f = finding("발견")
        self.records = [
            record(1, f, status="fixed", resolution_kind="fixed", resolution_rationale="고쳤다",
                   resolution_commit=FIX_SHA),
            record(2, f, status="wont_fix", resolution_kind="wont_fix", resolution_rationale="다음 Task 로 넘긴다"),
            record(3, f, status="open", resolution_kind="escalated", resolution_rationale="도커"),
        ]

    def run_doc(self, records=None):
        return tool.verify_resolve(self.doc, FakeNerv(self.records if records is None else records)).as_dict()

    def test_everything_recorded_matches(self):
        out = self.run_doc()
        self.assertEqual(out, {"ok": True, "mode": "resolve", "checked": 3, "missing": [], "altered": [],
                               "unverified": [], "errors": []})

    def test_each_field_is_compared(self):
        long_reason = "근거 " * 300
        self.doc["dispositions"][0]["rationale"] = long_reason
        self.records[0]["resolution_rationale"] = long_reason
        changes = {"resolution": ("resolution_kind", "dismissed"),
                   "rationale": ("resolution_rationale", long_reason.replace("근거", "근가", 1)),
                   "commit_sha": ("resolution_commit", "34" * 20)}
        self.assertEqual(set(changes), {doc_key for doc_key, _ in tool.RESOLVE_FIELDS})
        for field, (rec_key, value) in changes.items():
            with self.subTest(field=field):
                records = [dict(self.records[0], **{rec_key: value}), *self.records[1:]]
                out = self.run_doc(records)
                self.assertFalse(out["ok"])
                (line,) = out["altered"]
                self.assertTrue(line.startswith(f"{fid(1)[-8:]} {field} "), line)
                self.assertNotIn(long_reason.strip(), json.dumps(out, ensure_ascii=False))

    def test_an_unrecorded_disposition_is_missing(self):
        unresolved = dict(self.records[1], status="open", resolution_kind=None, resolution_rationale=None)
        out = self.run_doc([self.records[0], unresolved])
        self.assertFalse(out["ok"])
        self.assertEqual(out["missing"], [fid(2)[-8:], fid(3)[-8:]])


class CliTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(os.path.realpath(tempfile.mkdtemp()))
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)
        self.a = finding("가드가 없다")
        self.doc_path = self.tmp / "_nerv_payload.json"
        self.write(payload({"testing": [self.a]}))

    def write(self, doc):
        self.doc_path.write_text(json.dumps(doc, ensure_ascii=False) if not isinstance(doc, str) else doc,
                                 encoding="utf-8")

    def run_main(self, nerv, *args):
        out = io.StringIO()
        with mock.patch.object(tool.nerv_read, "client_from_env", return_value=nerv), \
                contextlib.redirect_stdout(out):
            code = tool.main(list(args) or ["submit", str(self.doc_path)])
        return code, out.getvalue()

    def run_cli(self, *args, env=None):
        return subprocess.run([sys.executable, str(TOOL_PATH), *args], capture_output=True, text=True,
                              timeout=60, env=env if env is not None else {"PATH": os.environ.get("PATH", "")})

    def test_exit_codes_follow_the_result_and_the_output_is_one_json_line(self):
        cases = {
            0: FakeNerv([record(1, self.a)], n1_item(["testing"])),
            1: FakeNerv([record(1, self.a, severity="info")], n1_item(["testing"])),
        }
        for expected, nerv in cases.items():
            with self.subTest(expected=expected):
                code, stdout = self.run_main(nerv)
                self.assertEqual(code, expected, stdout)
                self.assertEqual(stdout.count("\n"), 1)
                self.assertEqual(json.loads(stdout)["ok"], expected == 0)

    def test_unverified_alone_exits_zero(self):
        code, stdout = self.run_main(FakeNerv([record(1, self.a)], None))
        self.assertEqual(code, 0, stdout)
        self.assertTrue(json.loads(stdout)["unverified"])

    def test_a_failing_nerv_read_cannot_verify(self):
        for nerv in (FakeNerv([record(1, self.a)], n1_item(["testing"]), findings_status=503),
                     FakeNerv([record(1, self.a)], n1_item(["testing"]), n1_status=500)):
            with self.subTest(n1=nerv.n1_status, findings=nerv.findings_status):
                code, stdout = self.run_main(nerv)
                self.assertEqual(code, 3, stdout)
                out = json.loads(stdout)
                self.assertFalse(out["ok"])
                self.assertEqual(out["checked"], 0)
                self.assertTrue(out["errors"])

    def test_no_nerv_configuration_cannot_verify(self):
        r = self.run_cli("submit", str(self.doc_path))
        self.assertEqual(r.returncode, 3, r.stdout + r.stderr)
        out = json.loads(r.stdout)
        self.assertFalse(out["ok"])
        self.assertIn("NERV_SERVER", " ".join(out["errors"]))

    def test_a_document_that_is_not_ok_or_malformed_cannot_verify(self):
        good = payload({"testing": [self.a]})
        bad_bundle = json.loads(json.dumps(good))
        bad_bundle["submissions"][0]["reviewer"] = {}
        cases = {
            "ok 가 true": dict(good, ok=False),
            "version": dict(good, version=2),
            "JSON": "{nope",
            "submit 이 없다": {k: v for k, v in good.items() if k != "submit"},
            "reviewer.role": bad_bundle,
        }
        for needle, doc in cases.items():
            with self.subTest(needle=needle):
                self.write(doc)
                # NERV 설정이 없어도 문서 문제를 먼저 알린다.
                r = self.run_cli("submit", str(self.doc_path))
                self.assertEqual(r.returncode, 3, r.stdout + r.stderr)
                errors = " ".join(json.loads(r.stdout)["errors"])
                self.assertIn(needle, errors)
                self.assertNotIn("NERV_SERVER", errors)
        self.write({"version": 1, "ok": True, "branch": BRANCH, "dispositions": {}})
        r = self.run_cli("resolve", str(self.doc_path))
        self.assertEqual(r.returncode, 3, r.stdout)
        self.assertIn("dispositions", r.stdout)

    def test_usage_errors_exit_two(self):
        self.assertEqual(self.run_cli("submit", str(self.tmp / "none.json")).returncode, 2)
        self.assertEqual(self.run_cli("check", str(self.doc_path)).returncode, 2)

    def test_over_the_wire_with_the_real_client(self):
        nerv = FakeNerv([record(1, self.a, detail_md="다른 본문")], n1_item(["testing"]))
        with _harness.FakeNervServer(route=nerv.answer) as server:
            env = {"NERV_SERVER": server.url, "NERV_TOKEN": "tok-secret-9", "PATH": os.environ.get("PATH", "")}
            r = self.run_cli("submit", str(self.doc_path), env=env)
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        (line,) = json.loads(r.stdout)["altered"]
        self.assertTrue(line.startswith(f"{fid(1)[-8:]} testing body "), line)
        paths = [p for p, _ in server.requests]
        self.assertTrue(any(p.startswith("/api/v1/projects/clemvion/gates/reviews/check?") for p in paths), paths)
        self.assertTrue(any(p.startswith("/api/v1/projects/clemvion/findings?") for p in paths), paths)
        self.assertEqual({auth for _, auth in server.requests}, {"Bearer tok-secret-9"})

    def test_the_token_is_not_in_the_output_of_a_failed_read(self):
        with _harness.FakeNervServer(status=500, raw=b'{"ok": false}') as server:
            env = {"NERV_SERVER": server.url, "NERV_TOKEN": "tok-secret-9", "PATH": os.environ.get("PATH", "")}
            r = self.run_cli("submit", str(self.doc_path), env=env)
        self.assertEqual(r.returncode, 3, r.stdout + r.stderr)
        self.assertNotIn("tok-secret-9", r.stdout + r.stderr)


class SharedPathTest(unittest.TestCase):
    def test_rest_paths_match_the_other_readers(self):
        from _lib import review_guard

        handoff = _harness.load_module_by_path("nerv_review_handoff_for_verify",
                                               _harness.CLAUDE_DIR / "tools" / "nerv_review_handoff.py")
        self.assertEqual(tool.N1_PATH, review_guard.N1_PATH)
        self.assertEqual(tool.FINDINGS_PATH, handoff.FINDINGS_PATH)


if __name__ == "__main__":
    unittest.main()
