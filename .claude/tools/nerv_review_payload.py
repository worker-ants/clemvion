#!/usr/bin/env python3
"""리뷰 세션의 역할 리포트를 NERV `nerv_review_submit` 페이로드로 바꾼다.

NERV 정본 전환 단계 2(NERV Task `CLE-T-4ABTG7`)부터 리뷰 결과는 저장소 파일이 아니라 NERV 리뷰
레코드다. 오케스트레이터는 지금처럼 세션 디렉터리(`.review/<kind>/<시각>/`, gitignore 대상)에
역할마다 `<role>.md` 를 남긴다. 이 도구는 그 리포트를 읽어 역할별 제출 묶음을 JSON 으로 낸다.
제출은 main 세션이 역할마다 `nerv_review_submit` 을 불러 한다(결정 D7 역할별 제출 · D9 NERV 쓰기는
main 만). 이 도구는 네트워크를 쓰지 않고 모델도 부르지 않는다.

    python3 .claude/tools/nerv_review_payload.py <session_dir> [--kind code|consistency|merge|spec_coverage]

출력(JSON):
    {"kind": "code", "session_dir": "...", "changeset": ["a/b.ts", ...],
     "submissions": [{"reviewer": {"role": "security", "risk": "low"},
                      "summary": "...", "findings": [{"severity": "warning", "title": "...",
                      "body": "...", "file": "a/b.ts", "line": 12, "suggestion": "...",
                      "category": "security"}]}],
     "missing_forced": [], "errors": [], "warnings": []}

main 이 붙이는 것: `branch` · `base_sha` · `head_sha`(리뷰한 커밋) · `task_id` · `idempotency_key`
(`<task>:<kind>:<head 앞 9자>:<role>`. 같은 키로 다시 내면 서버가 같은 제출로 본다). `changeset` 은
세션 `meta.json` 의 `files` 다(없으면 키가 없다. main 이 `git diff --name-only <base>..<head>` 로 채운다).

역할은 세션 `_retry_state.json` 의 `subagent_invocations` 가 정한다. 그 목록에 없는 `*.md`(예: 처리
중에 생긴 제안 파일)는 역할 리포트가 아니므로 내지 않고 `warnings` 에 남긴다. `errors` 가 있거나
`missing_forced` 가 비어 있지 않으면 exit 1 이다. 그대로 내면 라운드가 틀린다.
  - 강제 역할의 리포트가 빠졌다(`missing_forced`). 라운드가 `missing_roles` 로 남는다.
  - kind=code 인데 상태 파일이 없거나 역할 목록이 없다. 강제 역할 누락을 확인하지 못한다.
  - 낼 묶음이 하나도 없다. spec_coverage 세션은 `SUMMARY.md` 하나뿐이라 이 도구가 묶음을 만들지
    않는다(제출 절차는 NERV Task `CLE-T-VP5KDJ` 전환 4e 에서 정한다).
리포트 형식은 리뷰어 · checker 정의(`.claude/agents/*.md` §출력 형식)가 정본이다:
`- **[CRITICAL|WARNING|INFO]** 제목` 아래 `위치:` · `상세:` · `제안:` 하위 항목, `### 요약`, `### 위험도`.
그 형식에서 벗어난 심각도 표지는 `warnings` 에 줄 번호와 함께 남긴다. 조용히 버리면 발견이 빠진
채 라운드가 passed 가 된다.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys

_CLAUDE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _CLAUDE_DIR not in sys.path:
    sys.path.insert(0, _CLAUDE_DIR)
from _shared import block_integrity, report_paths  # noqa: E402

KINDS = ("code", "consistency", "merge", "spec_coverage")
# 세션 디렉터리 이름 → kind. 오케스트레이터가 `.review/<이름>/<Y>/<m>/<d>/<H_M_S>` 에 쓴다.
_DIR_KIND = {"code": "code", "consistency": "consistency", "merge": "merge",
             "spec-coverage": "spec_coverage"}
# 리포트가 아닌 세션 파일. `_` 로 시작하는 파일(상태 · 프롬프트)도 뺀다.
_NOT_REPORTS = {"SUMMARY.md", "RESOLUTION.md", "README.md"}

_FINDING_RE = re.compile(
    r"^\s{0,3}(?:[-*]|\d+[.)])\s+\*\*\[(CRITICAL|WARNING|INFO)\]\*\*\s*(.*)$", re.I)
_HEADING_FINDING_RE = re.compile(r"^#{2,6}\s+\[(CRITICAL|WARNING|INFO)\]\s*(.*)$", re.I)
_MARKER_RE = re.compile(r"\[(CRITICAL|WARNING)\]", re.I)
_HEADING_RE = re.compile(r"^#{1,6}\s")
_FIELD_RE = re.compile(r"^\s+[-*]\s+(위치|target 위치|상세|제안|충돌 대상)\s*[:：]\s*(.*)$")
_LOCATION_RE = re.compile(r"`([^`\s]+?)(?::(\d+)(?:[-~]\d+)?)?`")
_RISK_RE = re.compile(r"\b(NONE|LOW|MEDIUM|HIGH|CRITICAL)\b")
_RISK_MAP = {"NONE": "low", "LOW": "low", "MEDIUM": "medium", "HIGH": "high", "CRITICAL": "high"}

MAX_TITLE = 300
MAX_BODY = 4000
MAX_SUGGESTION = 2000
MAX_SUMMARY = 1000


def _cap(text: str, limit: int) -> str:
    text = text.strip()
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def _section(lines: list[str], name: str) -> list[str]:
    """`### <name>` 절의 본문 줄(다음 제목 전까지)."""
    out: list[str] = []
    inside = False
    for ln in lines:
        if _HEADING_RE.match(ln):
            if inside:
                break
            inside = ln.lstrip("#").strip().startswith(name)
            continue
        if inside:
            out.append(ln)
    return out


def _location(text: str) -> tuple[str | None, int | None]:
    for m in _LOCATION_RE.finditer(text):
        path = m.group(1)
        path = path[2:] if path.startswith("./") else path  # removeprefix 는 3.9+ (block_integrity 주석)
        if "/" in path or "." in path:
            return path, int(m.group(2)) if m.group(2) else None
    return None, None


def _finding(severity: str, title: str, block: list[str], role: str) -> dict:
    """한 발견 블록(첫 줄 다음 줄들)을 NERV 발견으로."""
    fields: dict[str, list[str]] = {}
    current = None
    for ln in block:
        m = _FIELD_RE.match(ln)
        if m:
            current = m.group(1)
            fields.setdefault(current, []).append(m.group(2))
        elif current:
            fields[current].append(ln.strip())
    location = " ".join(fields.get("위치") or fields.get("target 위치") or [])
    path, line = _location(location)
    body_parts = []
    if location:
        body_parts.append(f"위치: {location.strip()}")
    for name in ("충돌 대상", "상세"):
        if fields.get(name):
            body_parts.append("\n".join(x for x in fields[name] if x).strip())
    if not fields:  # 하위 항목 없이 산문으로 쓴 블록
        body_parts.append("\n".join(x.strip() for x in block if x.strip()))
    out = {
        "severity": severity.lower(),
        "title": _cap(re.sub(r"\s+", " ", title) or "(제목 없음)", MAX_TITLE),
        "body": _cap("\n\n".join(p for p in body_parts if p), MAX_BODY),
        "category": role,
    }
    suggestion = "\n".join(x for x in fields.get("제안", []) if x).strip()
    if suggestion:
        out["suggestion"] = _cap(suggestion, MAX_SUGGESTION)
    if path:
        out["file"] = path
    if line:
        out["line"] = line
    return out


def parse_report(text: str, role: str) -> tuple[dict, list[str]]:
    """리포트 본문 → (제출 묶음, 경고). 경고는 형식에서 벗어난 심각도 표지다."""
    lines = text.splitlines()
    findings: list[dict] = []
    warnings: list[str] = []
    starts: list[tuple[int, str, str]] = []
    for i, ln in enumerate(lines):
        m = _FINDING_RE.match(ln) or _HEADING_FINDING_RE.match(ln)
        if m:
            starts.append((i, m.group(1), m.group(2)))
        elif _MARKER_RE.search(ln) and not ln.lstrip().startswith(("|", ">")):
            warnings.append(f"{role}.md:{i + 1}: 발견 형식이 아닌 줄에 심각도 표지가 있다 — {ln.strip()[:80]}")
    for n, (i, severity, title) in enumerate(starts):
        end = starts[n + 1][0] if n + 1 < len(starts) else len(lines)
        block = []
        for ln in lines[i + 1:end]:
            if _HEADING_RE.match(ln):
                break
            block.append(ln)
        findings.append(_finding(severity, title, block, role))

    submission: dict = {"reviewer": {"role": role}, "findings": findings}
    risk_lines = _section(lines, "위험도")
    for ln in risk_lines:
        m = _RISK_RE.search(ln)
        if m:
            submission["reviewer"]["risk"] = _RISK_MAP[m.group(1)]
            break
    summary = " ".join(x.strip() for x in _section(lines, "요약") if x.strip())
    if summary:
        submission["summary"] = _cap(summary, MAX_SUMMARY)
    return submission, warnings


def kind_of(session_dir: str) -> str | None:
    parts = os.path.normpath(os.path.abspath(session_dir)).split(os.sep)
    # 시각 경로(<Y>/<m>/<d>/<H_M_S>) 바로 위가 kind 디렉터리다.
    if len(parts) >= 5:
        return _DIR_KIND.get(parts[-5])
    return None


def _load_json(path: str):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def _roles(state) -> dict[str, str] | None:
    """역할 이름 → 세션의 리포트 파일 이름. 상태 파일에 역할 목록이 없으면 None.

    `output_file` 은 오케스트레이터가 절대 경로로 쓴다. 세션 디렉터리 바로 아래 파일만 보므로 이름만
    쓴다."""
    invocations = state.get("subagent_invocations") if isinstance(state, dict) else None
    if not isinstance(invocations, list):
        return None
    roles: dict[str, str] = {}
    for inv in invocations:
        name = inv.get("name") if isinstance(inv, dict) else None
        if isinstance(name, str) and name:
            out = inv.get("output_file")
            roles[name] = os.path.basename(out) if isinstance(out, str) and out else f"{name}.md"
    return roles or None


def build(session_dir: str, kind: str | None = None) -> dict:
    if not os.path.isdir(session_dir):
        raise SystemExit(f"nerv_review_payload: 세션 디렉터리가 없다 — {session_dir}")
    kind = kind or kind_of(session_dir)
    if kind not in KINDS:
        raise SystemExit("nerv_review_payload: kind 를 정하지 못했다 — --kind 로 준다")
    names = sorted(
        n for n in os.listdir(session_dir)
        if n.endswith(".md") and n not in _NOT_REPORTS and not n.startswith("_")
        and os.path.isfile(os.path.join(session_dir, n))
    )
    submissions: list[dict] = []
    errors: list[str] = []
    warnings: list[str] = []

    state = _load_json(os.path.join(session_dir, "_retry_state.json"))
    roles = _roles(state)
    if roles is None:
        plan = [(n[:-3], n) for n in names]
        if kind == "code":
            errors.append("_retry_state.json 이 없거나 역할 목록(subagent_invocations)이 없다 — "
                          "강제 역할 누락을 확인하지 못했다")
        elif names:
            warnings.append("_retry_state.json 에 역할 목록이 없다 — 세션의 리포트 파일을 모두 역할로 본다")
    else:
        plan = sorted((role, name) for role, name in roles.items() if name in names)
        for name in names:
            if name not in roles.values():
                warnings.append(f"{name}: 이 세션이 부른 역할의 리포트가 아니다 — 제출하지 않는다")

    for role, name in plan:
        with open(os.path.join(session_dir, name), encoding="utf-8", errors="replace") as f:
            text = f.read()
        if not text.strip():
            warnings.append(f"{name}: 비어 있다 — 제출하지 않는다")
            continue
        submission, w = parse_report(text, role)
        submissions.append(submission)
        warnings.extend(w)

    missing: list[str] = []
    if isinstance(state, dict):
        missing = report_paths.missing_reports(session_dir, state.get("agents_forced") or [], state)
    if not submissions:
        why = (" spec_coverage 세션은 SUMMARY.md 하나뿐이라 이 도구가 묶음을 만들지 않는다"
               "(제출 절차는 전환 4e)." if kind == "spec_coverage" else "")
        errors.append("제출할 역할 리포트가 없다." + why)
    if kind == "consistency":
        # 통합 SUMMARY 가 checker 의 [CRITICAL] 을 낮춰 `BLOCK: NO` 라고 적은 경우. NERV 에는
        # checker 리포트가 그대로 올라가므로 판정은 서버가 바로잡는다. 다만 사람이 읽는 SUMMARY 가
        # 틀렸다는 사실은 제출 전에 알린다(`consistency-summary.md` §요약 지침 3).
        note = block_integrity.contradiction_note(session_dir)
        if note:
            warnings.append(f"SUMMARY.md: {note}")
    out: dict = {"kind": kind, "session_dir": os.path.abspath(session_dir)}
    meta = _load_json(os.path.join(session_dir, "meta.json"))
    files = meta.get("files") if isinstance(meta, dict) else None
    if isinstance(files, list) and files and all(isinstance(x, str) for x in files):
        out["changeset"] = files
    out.update({"submissions": submissions, "missing_forced": missing,
                "errors": errors, "warnings": warnings})
    return out


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0], allow_abbrev=False)
    ap.add_argument("session_dir")
    ap.add_argument("--kind", choices=KINDS)
    args = ap.parse_args(argv)
    out = build(args.session_dir, args.kind)
    json.dump(out, sys.stdout, ensure_ascii=False, indent=1)
    sys.stdout.write("\n")
    # 그대로 제출하면 라운드가 틀린다(모듈 docstring). 알리고 실패한다.
    return 1 if out["missing_forced"] or out["errors"] else 0


if __name__ == "__main__":
    sys.exit(main())
