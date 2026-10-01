#!/usr/bin/env python3
"""리뷰 처리 인계 파일 두 개를 만들고 검사한다 — main 세션과 `resolution-applier` 사이.

NERV 정본 전환 단계 2(NERV Task `CLE-T-4ABTG7`)부터 리뷰 발견과 처분은 NERV 레코드다. NERV 쓰기는
main 세션의 MCP 호출로만 한다(결정 D9). 그래서 applier 는 처분을 파일로 돌려주고 main 이 기록한다.
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
     "tests": {"lint": "pass", "unit": "pass", "build": "pass", "e2e": "pass|fail|skipped",
               "e2e_log": "<경로>"}}

  - 처분 · 제안의 `finding_id` 는 `_nerv_findings.json` 에 있어야 하고 한 번씩만 나온다.
  - `fixed` 는 HEAD 에서 닿는 커밋의 전체 해시를 `commit_sha` 로 단다.
  - critical 발견은 `wont_fix` · `dismissed` 로 처분하지 않는다(사람 승인이 필요하다).
  - `spec_change` 는 applier 가 쓰지 않는다. 스펙 결함은 `spec_proposals` 로 넘기고 main 이 NERV 초안을
    저장한 뒤 `spec_change` 로 처분한다. 초안을 쓸 수 없으면 main 이 `escalated(spec)` 로 넘긴다.
  - 제안 파일은 세션 디렉터리 바로 아래 `_spec-proposal-<area>.md`(`<area>` 는 `[a-z0-9-]`)다.
    `_` 로 시작해야 제출 도구(`nerv_review_payload.py`)가 역할 리포트로 읽지 않는다.
  - critical · warning 발견은 처분이나 제안 중 하나에 있어야 한다. info 는 `left_to_main` 으로 알린다.

`pending` — `_dispositions.json` 의 처분 중 NERV 에서 아직 열려 있고 처분이 붙지 않은 것만 낸다. main 은
이것만 `nerv_finding_resolve` 로 기록한다. applier 를 다시 부르거나 처분을 다시 기록할 때 이미 기록된
처분(사람이 NERV 에서 바꾼 것 포함)을 덮지 않는다.

출력은 JSON 이고, 문제가 있으면 exit 1 이다. 이 도구는 NERV 를 읽기만 한다(`_shared/nerv_read.py`).
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.parse

_CLAUDE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _CLAUDE_DIR not in sys.path:
    sys.path.insert(0, _CLAUDE_DIR)
from _shared import git_probe, nerv_read  # noqa: E402

VERSION = 1
FINDINGS_FILE = "_nerv_findings.json"
DISPOSITIONS_FILE = "_dispositions.json"
FINDINGS_PATH = "/api/v1/projects/{project}/findings"
PAGE_LIMIT = 100
MAX_PAGES = 50  # 5,000건. 커서가 돌면 여기서 끊는다

RESOLUTIONS = ("fixed", "wont_fix", "dismissed", "escalated")
ESCALATE_REASONS = ("user-decision", "infra", "e2e-fail-3x", "sensitive-fix", "spec")
SEVERITIES = ("critical", "warning", "info")
_UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
_FULL_SHA = re.compile(r"^[0-9a-f]{40}$")
_PROPOSAL = re.compile(r"^_spec-proposal-[a-z0-9-]+\.md$")


class HandoffError(Exception):
    pass


# -- NERV 읽기 ----------------------------------------------------------------------

def open_findings(client, branch: str) -> list[dict]:
    """이 브랜치의 열린 발견 전부(커서를 따라간다)."""
    items: list[dict] = []
    cursor = None
    for _ in range(MAX_PAGES):
        query = {"branch": branch, "status": "open", "limit": str(PAGE_LIMIT)}
        if cursor:
            query["cursor"] = cursor
        path = FINDINGS_PATH.format(project=client.project) + "?" + urllib.parse.urlencode(query)
        try:
            status, body = client.get(path)
        except Exception as exc:  # noqa: BLE001 — 전송 실패
            raise HandoffError(f"NERV 발견 목록을 읽지 못했다 — {type(exc).__name__}: {exc}") from exc
        if status != 200:
            raise HandoffError(f"NERV 발견 목록 응답 {status}")
        try:
            doc = json.loads(body)
        except ValueError as exc:
            raise HandoffError("NERV 발견 목록 응답이 JSON 이 아니다") from exc
        page = doc.get("items") if isinstance(doc, dict) else None
        if not isinstance(page, list):
            raise HandoffError("NERV 발견 목록 응답에 items 가 없다")
        items.extend(x for x in page if isinstance(x, dict))
        cursor = doc.get("next_cursor")
        if not cursor:
            return items
    raise HandoffError(f"NERV 발견 목록이 {MAX_PAGES} 쪽을 넘는다 — 끊는다")


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
    items = [i for i in open_findings(client, branch) if not i.get("resolution_kind")]
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


def _is_ancestor(sha: str, cwd: str) -> bool:
    rc, _, _ = git_probe._run_git(["merge-base", "--is-ancestor", sha, "HEAD"], cwd)
    return rc == 0


def check(session_dir: str) -> dict:
    findings_doc = _load(session_dir, FINDINGS_FILE)
    disp_doc = _load(session_dir, DISPOSITIONS_FILE)
    severity = {}
    for f in findings_doc.get("findings") or []:
        if isinstance(f, dict) and isinstance(f.get("finding_id"), str):
            severity[f["finding_id"]] = f.get("severity")
    errors: list[str] = []
    seen: set[str] = set()

    def claim(fid, where) -> bool:
        if not isinstance(fid, str) or not _UUID.match(fid):
            errors.append(f"{where}: finding_id 가 전체 ID 가 아니다 — {fid!r}")
            return False
        if fid not in severity:
            errors.append(f"{where}: {fid} 는 {FINDINGS_FILE} 에 없다")
            return False
        if fid in seen:
            errors.append(f"{where}: {fid} 가 두 번 나온다")
            return False
        seen.add(fid)
        return True

    dispositions = disp_doc.get("dispositions")
    if not isinstance(dispositions, list):
        errors.append("dispositions 가 목록이 아니다")
        dispositions = []
    for n, d in enumerate(dispositions):
        where = f"dispositions[{n}]"
        if not isinstance(d, dict):
            errors.append(f"{where}: 객체가 아니다")
            continue
        fid = d.get("finding_id")
        known = claim(fid, where)
        res = d.get("resolution")
        if res not in RESOLUTIONS:
            errors.append(f"{where}: resolution 은 {', '.join(RESOLUTIONS)} 중 하나다 — {res!r}")
        if not isinstance(d.get("rationale"), str) or not d["rationale"].strip():
            errors.append(f"{where}: rationale 이 없다")
        if res == "fixed":
            sha = d.get("commit_sha")
            if not isinstance(sha, str) or not _FULL_SHA.match(sha):
                errors.append(f"{where}: fixed 는 40자 commit_sha 를 단다 — {sha!r}")
            elif not _is_ancestor(sha, session_dir):
                errors.append(f"{where}: commit_sha {sha[:12]} 가 HEAD 에서 닿지 않는다")
        if res == "escalated" and d.get("escalate_reason") not in ESCALATE_REASONS:
            errors.append(f"{where}: escalated 는 escalate_reason 을 단다({', '.join(ESCALATE_REASONS)})")
        if known and severity.get(fid) == "critical" and res in ("wont_fix", "dismissed"):
            errors.append(f"{where}: critical 발견을 {res} 로 처분하지 않는다 — 사람 승인이 필요하다")

    proposals = disp_doc.get("spec_proposals") or []
    if not isinstance(proposals, list):
        errors.append("spec_proposals 가 목록이 아니다")
        proposals = []
    for n, p in enumerate(proposals):
        where = f"spec_proposals[{n}]"
        if not isinstance(p, dict):
            errors.append(f"{where}: 객체가 아니다")
            continue
        claim(p.get("finding_id"), where)
        name = p.get("file")
        if not isinstance(name, str) or not _PROPOSAL.match(name):
            errors.append(f"{where}: file 은 _spec-proposal-<area>.md 다([a-z0-9-]) — {name!r}")
        elif not os.path.isfile(os.path.join(session_dir, name)):
            errors.append(f"{where}: {name} 이 세션 디렉터리에 없다")

    undisposed = [fid for fid, sev in severity.items() if fid not in seen and sev in ("critical", "warning")]
    for fid in undisposed:
        errors.append(f"{fid} ({severity[fid]}) 의 처분이 없다")
    left = [fid for fid, sev in severity.items() if fid not in seen and sev not in ("critical", "warning")]
    return {"ok": not errors, "errors": errors, "left_to_main": left,
            "dispositions": len(dispositions), "spec_proposals": len(proposals)}


def pending(session_dir: str, branch: str, client) -> dict:
    disp_doc = _load(session_dir, DISPOSITIONS_FILE)
    open_ids = {str(i.get("id") or "").lower() for i in open_findings(client, branch)
                if not i.get("resolution_kind")}
    todo, done = [], []
    for d in disp_doc.get("dispositions") or []:
        if not isinstance(d, dict):
            continue
        (todo if d.get("finding_id") in open_ids else done).append(d)
    return {"ok": True, "pending": todo, "already_recorded": [d.get("finding_id") for d in done]}


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0], allow_abbrev=False)
    ap.add_argument("command", choices=("fetch", "check", "pending"))
    ap.add_argument("session_dir")
    ap.add_argument("--branch")
    args = ap.parse_args(argv)
    if not os.path.isdir(args.session_dir):
        ap.error(f"세션 디렉터리가 없다 — {args.session_dir}")
    if args.command != "check" and not args.branch:
        ap.error(f"{args.command} 는 --branch 가 필요하다")
    try:
        if args.command == "check":
            out = check(args.session_dir)
        else:
            client = nerv_read.client_from_env()
            if args.command == "fetch":
                out = fetch(args.session_dir, args.branch, client)
            else:
                out = pending(args.session_dir, args.branch, client)
    except (HandoffError, nerv_read.NervReadError) as exc:
        out = {"ok": False, "errors": [str(exc)]}
    json.dump(out, sys.stdout, ensure_ascii=False, indent=1)
    sys.stdout.write("\n")
    return 0 if out.get("ok") else 1


if __name__ == "__main__":
    sys.exit(main())
