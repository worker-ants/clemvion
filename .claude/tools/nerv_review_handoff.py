#!/usr/bin/env python3
"""리뷰 처리 인계 파일 두 개를 만들고 검사한다 — main 세션과 `resolution-applier` 사이.

NERV 정본 전환 단계 2(NERV Task `CLE-T-4ABTG7`)부터 리뷰 발견과 처분은 NERV 레코드다. applier 에는
NERV 쓰기 도구가 없다(결정 D9). 그래서 applier 는 처분을 파일로 돌려주고, 기록은 main 이 부르는 기록
서브에이전트 `nerv-recorder` 가 한다(D9 개정, NERV Task `CLE-T-CD9131`).
두 파일은 LLM 이 손으로 옮겨 적지 않게 이 도구가 만들고 검사한다. 파일 형식의 정본은 이 docstring 이다.

    python3 .claude/tools/nerv_review_handoff.py fetch   <session_dir> --branch <b>
    python3 .claude/tools/nerv_review_handoff.py check   <session_dir>
    python3 .claude/tools/nerv_review_handoff.py pending <session_dir> --branch <b>

`fetch` — 이 브랜치의 열린 발견을 NERV REST(`GET /api/v1/projects/<p>/findings?branch=&status=open`)
로 읽어 `<session_dir>/_nerv_findings.json` 을 쓴다. 이미 사람에게 넘긴(escalated) 발견은 뺀다:

    {"version": 1, "branch": "...", "findings": [
      {"finding_id": "<전체 ID>", "severity": "critical|warning|info", "role": "security",
       "title": "...", "file": "a/b.ts", "line": 12, "detail": "...", "suggestion": "...",
       "round_no": 1, "head_sha": "...", "area": "codebase", "tags": []}]}

`check` — applier 가 쓴 `<session_dir>/_dispositions.json` 을 `_nerv_findings.json` 과 git 으로 검사한다:

    {"version": 1,
     "dispositions": [
       {"finding_id": "...", "resolution": "fixed", "commit_sha": "<40자>", "rationale": "..."},
       {"finding_id": "...", "resolution": "wont_fix|dismissed", "rationale": "..."},
       {"finding_id": "...", "resolution": "escalated",
        "escalate_reason": "user-decision|infra|e2e-fail-3x|sensitive-fix|spec", "rationale": "..."}],
     "spec_proposals": [{"finding_id": "...", "file": "_spec-proposal-<area>.md"}],
     "tests": {"lint": "pass", "unit": "pass", "build": "not_run", "e2e": "pass|fail|skipped",
               "e2e_log": "<경로>"}}

  - 처분 · 제안의 `finding_id` 는 `_nerv_findings.json` 에 있어야 하고 한 번씩만 나온다.
  - `fixed` 는 리뷰한 브랜치(`_nerv_findings.json` 의 `branch`, 이 저장소에 없으면 HEAD)에서 닿는 커밋의
    전체 해시(SHA-1 저장소에서는 40자)를 `commit_sha` 로 단다. 전체 해시의 정의는 `git_probe.is_full_commit_id` 하나다.
  - critical 발견은 `wont_fix` · `dismissed` 로 처분하지 않는다(사람 승인이 필요하다).
  - `spec_change` 는 applier 가 쓰지 않는다. 스펙 결함은 `spec_proposals` 로 넘기고 main 이 NERV 초안을
    저장한 뒤 `spec_change` 로 처분한다. 초안을 쓸 수 없으면 main 이 `escalated(spec)` 로 넘긴다.
  - 제안 파일은 세션 디렉터리 바로 아래 `_spec-proposal-<area>.md` 다. `<area>` 는 대상 NERV 스펙 키를
    소문자로 쓴 값이다(예: `cle-eng-reviewcite`, `[a-z0-9-]`). 스펙 하나에 파일 하나이고, 같은 스펙의 발견
    여럿이 한 파일을 가리켜도 된다. `_` 로 시작해야 제출 도구(`nerv_review_payload.py`)가 역할 리포트로
    읽지 않는다.
  - critical · warning 발견은 처분이나 제안 중 하나에 있어야 한다. info 는 `left_to_main` 으로 알린다.

`pending` — `_dispositions.json` 의 처분 중 NERV 에서 아직 열려 있고 처분이 붙지 않은 것만 낸다. 기록하는
쪽(`nerv-recorder`, 그것을 쓸 수 없는 세션은 main)은 이것만 `nerv_finding_resolve` 로 기록한다. applier 를 다시 부르거나 처분을 다시 기록할 때 이미 기록된
처분(사람이 NERV 에서 바꾼 것 포함)을 덮지 않는다. `_nerv_findings.json` 에 없는 ID 나 전체 ID 가
아닌 값은 "이미 기록됨" 으로 섞지 않고 `unknown` 으로 내며 exit 1 이다(`check` 를 먼저 돌린다).

`pending --out <file>` 은 그 처분을 기록 서브에이전트 `nerv-recorder` 가 그대로 낼 문서로 쓰고 stdout 에는
요약(`pending` · `by_resolution` · `items` · `already_recorded` · `unknown`)만 낸다. main 이 근거 문장까지 읽지
않게 하려는 모드다(NERV Task `CLE-T-CD9131`):

    {"version": 1, "ok": true, "branch": "...", "dispositions": [
      {"finding_id": "...", "resolution": "fixed", "commit_sha": "<40자>", "rationale": "...",
       "severity": "critical", "idempotency_key": "resolve:<finding_id>:fixed:<12자>"}],
     "already_recorded": ["..."], "unknown": []}

  - 처분마다 `nerv_finding_resolve` 인자(`finding_id` · `resolution` · `commit_sha` · `escalate_reason` ·
    `rationale`)만 남긴다. `severity` 는 `_nerv_findings.json` 에서 붙인다(critical 을 낮추는 처분은 사람
    승인을 받는다). 멱등 키는 그 인자의 해시라서 같은 처분을 다시 보내도 한 번만 기록된다.
  - 처분 목록은 쓰기 전에 `check` 의 검사를 모두 통과해야 한다(처분이 없는 발견을 세는 검사만 뺀다. 덜 모인
    목록에서 통과한 처분까지 막지 않으려는 것이다). 근거 · 40자 해시 · 브랜치 도달성 · critical 하향 거부를 main 이
    눈으로 다시 보지 않아도 되게 한다. 통과하지 못하면 `ok: false` 이고 `errors` 에 사유가 있다.
  - `unknown` 이 있으면 `ok: false` 이고 `dispositions` 는 비어 있다.
  - `items` 는 처분마다 `<발견 ID 끝 8자> <resolution> <severity>` 한 줄이다. main 이 분포를 본다.
  - 처분 문서를 만들 수 없는 실패(NERV 읽기 실패 · 설정 누락 · 인계 파일 문제)도 `{"version": 1, "ok": false,
    "errors": [...], "dispositions": [], ...}` 를 `--out` 에 쓰고 exit 1 이다. 낡은 문서를 남기지 않는 규칙(앞 실행의
    파일을 지운다 · exit 2 만 예외다 · exit 가 0 일 때만 기록 서브에이전트에 넘긴다 · 이 도구의 문서가 아닌 파일은
    거절한다)의 정본은 `_shared/out_doc.py` docstring 이다. `nerv_review_payload.py --out` 도 같다. 세션 디렉터리가
    없을 때는 인자 오류(exit 2)다.

출력은 JSON 이고, 문제가 있으면 exit 1 이다. 이 도구는 NERV 를 읽기만 한다(`_shared/nerv_read.py`).
`fetch` · `pending` 은 NERV 를 읽으므로 `NERV_SERVER` · `NERV_TOKEN`(선택 `NERV_PROJECT`)이 필요하다.
로컬은 `.claude/settings.local.json` 의 `env` 가 준다. `check` 는 네트워크를 쓰지 않는다.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys

_CLAUDE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _CLAUDE_DIR not in sys.path:
    sys.path.insert(0, _CLAUDE_DIR)
from _shared import git_probe, nerv_read, out_doc  # noqa: E402

VERSION = 1
FINDINGS_FILE = "_nerv_findings.json"
DISPOSITIONS_FILE = "_dispositions.json"

RESOLUTIONS = ("fixed", "wont_fix", "dismissed", "escalated")
# `pending --out` 이 처분마다 남기는 `nerv_finding_resolve` 인자.
RESOLVE_FIELDS = ("finding_id", "resolution", "commit_sha", "escalate_reason", "rationale")
ESCALATE_REASONS = ("user-decision", "infra", "e2e-fail-3x", "sensitive-fix", "spec")
SEVERITIES = ("critical", "warning", "info")
_UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
_PROPOSAL = re.compile(r"^_spec-proposal-[a-z0-9-]+\.md$")


class HandoffError(Exception):
    pass


# -- NERV 읽기 ----------------------------------------------------------------------

def open_findings(client, branch: str) -> list[dict]:
    """이 브랜치의 열린 발견 전부(커서를 따라간다). 처분이 붙은 것(escalated)도 섞여 있다."""
    try:
        return nerv_read.branch_findings(client, branch, "open")
    except nerv_read.NervRequestError as exc:
        raise HandoffError(str(exc)) from exc


def unresolved_findings(client, branch: str) -> list[dict]:
    """열린 발견 중 아직 처분이 붙지 않은 것. `fetch` 와 `pending` 이 같은 기준을 쓴다."""
    return [i for i in open_findings(client, branch) if not i.get("resolution_kind")]


def _normalize(item: dict) -> dict:
    return {
        "finding_id": str(item.get("id") or "").lower(),
        "severity": item.get("severity"),
        "role": item.get("category"),
        "title": item.get("title"),
        "file": item.get("file_path"),
        "line": item.get("line_start"),
        "detail": item.get("detail_md"),
        "suggestion": item.get("suggestion_md"),
        "round_no": item.get("round_no"),
        "head_sha": item.get("head_sha"),
        "area": item.get("area"),
        "tags": item.get("tags") or [],
    }


def fetch(session_dir: str, branch: str, client) -> dict:
    items = unresolved_findings(client, branch)
    doc = {"version": VERSION, "branch": branch, "findings": [_normalize(i) for i in items]}
    path = os.path.join(session_dir, FINDINGS_FILE)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
        f.write("\n")
    counts = {s: sum(1 for x in doc["findings"] if x["severity"] == s) for s in SEVERITIES}
    return {"ok": True, "file": path, "counts": counts}


# -- 검사 ------------------------------------------------------------------------------

def _load(session_dir: str, name: str) -> dict:
    path = os.path.join(session_dir, name)
    try:
        with open(path, encoding="utf-8") as f:
            doc = json.load(f)
    except OSError as exc:
        raise HandoffError(f"{name} 이 없다 — {exc.strerror}") from exc
    except ValueError as exc:
        raise HandoffError(f"{name} 이 JSON 이 아니다 — {exc}") from exc
    if not isinstance(doc, dict) or doc.get("version") != VERSION:
        raise HandoffError(f"{name} 의 version 이 {VERSION} 이 아니다")
    return doc


def _ancestor_target(branch, cwd: str) -> str:
    """fixed 커밋이 닿아야 하는 곳. 리뷰한 브랜치가 이 저장소에 있으면 그것, 없으면 HEAD.

    워크트리는 ref 를 공유하므로 짝 워크트리에서 다른 브랜치를 리뷰해도 브랜치 이름이 풀린다."""
    return f"refs/heads/{branch}" if git_probe.local_branch_tip(branch, cwd) is not None else "HEAD"


class _Claims:
    """처분 · 제안이 가리킨 발견 ID 를 검사하고 한 번씩만 받는다."""

    def __init__(self, severity: dict[str, str], errors: list[str]):
        self.severity = severity
        self.errors = errors
        self.seen: set[str] = set()

    def take(self, fid, where: str) -> bool:
        if not isinstance(fid, str) or not _UUID.match(fid):
            self.errors.append(f"{where}: finding_id 가 전체 ID 가 아니다 — {fid!r}")
            return False
        if fid not in self.severity:
            self.errors.append(f"{where}: {fid} 는 {FINDINGS_FILE} 에 없다")
            return False
        if fid in self.seen:
            self.errors.append(f"{where}: {fid} 가 두 번 나온다")
            return False
        self.seen.add(fid)
        return True


def _check_disposition(d, where: str, claims: _Claims, target: str, cwd: str) -> None:
    errors = claims.errors
    if not isinstance(d, dict):
        errors.append(f"{where}: 객체가 아니다")
        return
    fid = d.get("finding_id")
    known = claims.take(fid, where)
    res = d.get("resolution")
    if res not in RESOLUTIONS:
        errors.append(f"{where}: resolution 은 {', '.join(RESOLUTIONS)} 중 하나다 — {res!r}")
    if not isinstance(d.get("rationale"), str) or not d["rationale"].strip():
        errors.append(f"{where}: rationale 이 없다")
    if res == "fixed":
        sha = d.get("commit_sha")
        if not git_probe.is_full_commit_id(sha):
            errors.append(f"{where}: fixed 는 40자 commit_sha 를 단다 — {sha!r}")
        elif not git_probe.is_ancestor(sha, target, cwd):
            errors.append(f"{where}: commit_sha {sha[:12]} 가 리뷰한 브랜치({target})에서 닿지 않는다")
    if res == "escalated" and d.get("escalate_reason") not in ESCALATE_REASONS:
        errors.append(f"{where}: escalated 는 escalate_reason 을 단다({', '.join(ESCALATE_REASONS)})")
    if known and claims.severity.get(fid) == "critical" and res in ("wont_fix", "dismissed"):
        errors.append(f"{where}: critical 발견을 {res} 로 처분하지 않는다 — 사람 승인이 필요하다")


def _check_proposal(p, where: str, claims: _Claims, session_dir: str) -> None:
    if not isinstance(p, dict):
        claims.errors.append(f"{where}: 객체가 아니다")
        return
    claims.take(p.get("finding_id"), where)
    name = p.get("file")
    if not isinstance(name, str) or not _PROPOSAL.match(name):
        claims.errors.append(f"{where}: file 은 _spec-proposal-<area>.md 다([a-z0-9-]) — {name!r}")
    elif not os.path.isfile(os.path.join(session_dir, name)):
        claims.errors.append(f"{where}: {name} 이 세션 디렉터리에 없다")


def _list_field(doc: dict, key: str, errors: list[str], *, required: bool) -> list:
    value = doc.get(key) if required else (doc.get(key) or [])
    if not isinstance(value, list):
        errors.append(f"{key} 가 목록이 아니다")
        return []
    return value


def check(session_dir: str, *, coverage: bool = True) -> dict:
    """`_dispositions.json` 을 검사한다. `coverage=False` 면 "처분이 없다" 만 빼고 같은 검사를 한다.

    `pending --out` 이 쓴다. 기록 서브에이전트에 넘기는 처분은 전부 이 검사를 통과한 것이어야 하지만(근거 · 40자
    해시 · 브랜치 도달성 · critical 하향 거부), 처분이 아직 덜 모인 목록(applier 가 중간에 끝난 경우)에서 이미
    통과한 처분까지 막지는 않는다."""
    findings_doc = _load(session_dir, FINDINGS_FILE)
    disp_doc = _load(session_dir, DISPOSITIONS_FILE)
    severity = {f["finding_id"]: f.get("severity") for f in findings_doc.get("findings") or []
                if isinstance(f, dict) and isinstance(f.get("finding_id"), str)}
    errors: list[str] = []
    claims = _Claims(severity, errors)
    target = _ancestor_target(findings_doc.get("branch"), session_dir)

    dispositions = _list_field(disp_doc, "dispositions", errors, required=True)
    for n, d in enumerate(dispositions):
        _check_disposition(d, f"dispositions[{n}]", claims, target, session_dir)
    proposals = _list_field(disp_doc, "spec_proposals", errors, required=False)
    for n, p in enumerate(proposals):
        _check_proposal(p, f"spec_proposals[{n}]", claims, session_dir)

    if coverage:
        for fid, sev in severity.items():
            if fid not in claims.seen and sev in ("critical", "warning"):
                errors.append(f"{fid} ({sev}) 의 처분이 없다")
    left = [fid for fid, sev in severity.items() if fid not in claims.seen and sev not in ("critical", "warning")]
    return {"ok": not errors, "errors": errors, "left_to_main": left,
            "dispositions": len(dispositions), "spec_proposals": len(proposals)}


def pending(session_dir: str, branch: str, client) -> dict:
    known = {f.get("finding_id") for f in _load(session_dir, FINDINGS_FILE).get("findings") or []
             if isinstance(f, dict)}
    disp_doc = _load(session_dir, DISPOSITIONS_FILE)
    open_ids = {str(i.get("id") or "").lower() for i in unresolved_findings(client, branch)}
    todo, done, unknown = [], [], []
    for d in disp_doc.get("dispositions") or []:
        fid = d.get("finding_id") if isinstance(d, dict) else None
        if not isinstance(fid, str) or not _UUID.match(fid) or fid not in known:
            unknown.append(fid)
        elif fid in open_ids:
            todo.append(d)
        else:
            done.append(fid)
    out = {"ok": not unknown, "pending": todo, "already_recorded": done, "unknown": unknown}
    if unknown:
        out["errors"] = [f"{FINDINGS_FILE} 에 없거나 전체 ID 가 아닌 처분이 있다 — check 를 먼저 돌린다"]
    return out


def resolve_key(d: dict) -> str:
    """처분 하나의 `nerv_finding_resolve` 멱등 키. 기록할 인자가 같으면 같은 키다."""
    payload = json.dumps({k: d.get(k) for k in RESOLVE_FIELDS}, ensure_ascii=False, sort_keys=True)
    digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()[:12]
    return f"resolve:{d.get('finding_id')}:{d.get('resolution')}:{digest}"


def resolve_document(session_dir: str, branch: str, out: dict) -> dict:
    """`pending` 결과 → 기록 서브에이전트(`nerv-recorder`)가 그대로 낼 처분 문서.

    처분마다 `nerv_finding_resolve` 인자만 남기고 발견의 심각도와 멱등 키를 붙인다. 처분 목록은 여기서 `check`
    (처분이 없는 발견을 세는 검사만 뺀다)를 통과해야 한다. main 은 이 문서의 근거 문장을 읽지 않으므로 검사를
    선행 단계의 SKILL 문장에만 맡기지 않는다. `ok` 가 false 면 처분을 싣지 않는다(기록 서브에이전트는 아무것도
    기록하지 않는다)."""
    verdict = check(session_dir, coverage=False)
    severity = {f.get("finding_id"): f.get("severity")
                for f in _load(session_dir, FINDINGS_FILE).get("findings") or [] if isinstance(f, dict)}
    ok = bool(out["ok"] and verdict["ok"])
    errors = list(out.get("errors") or []) + list(verdict["errors"])
    rows = []
    if ok:
        for d in out["pending"]:
            row = {k: d[k] for k in RESOLVE_FIELDS if d.get(k) is not None}
            row["severity"] = severity.get(d["finding_id"])
            row["idempotency_key"] = resolve_key(d)
            rows.append(row)
    doc = {"version": out_doc.VERSION, "ok": ok, "branch": branch, "dispositions": rows,
           "already_recorded": out["already_recorded"], "unknown": out["unknown"]}
    if errors:
        doc["errors"] = errors
    return doc


def resolve_brief(doc: dict, path: str) -> dict:
    """`pending --out` 이 stdout 에 내는 요약. 근거 문장은 싣지 않는다.

    `items` 는 처분마다 `<발견 ID 끝 8자> <resolution> <severity>` 한 줄이다. main 이 근거 문장 없이도 어느
    발견이 어떻게 처분되는지(critical 이 낮아지지는 않는지) 볼 수 있게 한다. UUIDv7 은 앞자리가 같은 분에 생긴
    발견끼리 겹치므로 끝 8자를 쓴다."""
    by: dict[str, int] = {}
    for d in doc["dispositions"]:
        by[d["resolution"]] = by.get(d["resolution"], 0) + 1
    out = {"ok": doc["ok"], "out": path, "pending": len(doc["dispositions"]), "by_resolution": by,
           "items": [f"{str(d['finding_id'])[-8:]} {d['resolution']} {d.get('severity')}"
                     for d in doc["dispositions"]],
           "already_recorded": len(doc["already_recorded"]), "unknown": doc["unknown"]}
    if doc.get("errors"):
        out["errors"] = doc["errors"]
    return out


def _write_resolve_out(path: str, doc: dict) -> dict:
    """처분 문서를 `--out` 에 쓰고 stdout 요약을 돌려준다. 못 썼으면 요약의 `ok` 를 false 로 두고 사유를 덧붙인다."""
    return out_doc.write_with_summary(path, doc, resolve_brief(doc, path))


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0], allow_abbrev=False)
    ap.add_argument("command", choices=("fetch", "check", "pending"))
    ap.add_argument("session_dir")
    ap.add_argument("--branch")
    ap.add_argument("--out", help="pending 만: 처분 문서를 이 파일에 쓰고 stdout 에는 건수만 낸다(nerv-recorder 입력)")
    args = ap.parse_args(argv)
    if not os.path.isdir(args.session_dir):
        ap.error(f"세션 디렉터리가 없다 — {args.session_dir}")
    if args.command != "check" and not args.branch:
        ap.error(f"{args.command} 는 --branch 가 필요하다")
    if args.out and args.command != "pending":
        ap.error("--out 은 pending 에만 준다")
    if args.out:
        out_doc.begin_or_exit(ap, args.out)  # 인자 검사 뒤: 앞 실행의 문서를 치운다. 이 도구의 문서가 아닌 파일은 건드리지 않는다
    try:
        if args.command == "check":
            out = check(args.session_dir)
        else:
            client = nerv_read.client_from_env()
            if args.command == "fetch":
                out = fetch(args.session_dir, args.branch, client)
            else:
                out = pending(args.session_dir, args.branch, client)
                if args.out:
                    doc = resolve_document(args.session_dir, args.branch, out)
                    out = _write_resolve_out(args.out, doc)
    except (HandoffError, nerv_read.NervReadError, OSError) as exc:
        message = str(exc)
        out = {"ok": False, "errors": [message]}
        if args.out:
            # 처분 문서를 만들 수 없는 실패(NERV 읽기 · 설정 · 인계 파일). `--out` 에는 앞 실행의 문서가 아니라 이번 실패를 남긴다.
            out = _write_resolve_out(args.out, out_doc.failure(
                [message], branch=args.branch, dispositions=[], already_recorded=[], unknown=[]))
    json.dump(out, sys.stdout, ensure_ascii=False, indent=None if args.out else 1)
    sys.stdout.write("\n")
    return 0 if out.get("ok") else 1


if __name__ == "__main__":
    sys.exit(main())
