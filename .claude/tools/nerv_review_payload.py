#!/usr/bin/env python3
"""리뷰 세션의 역할 리포트를 NERV `nerv_review_submit` 페이로드로 바꾼다.

NERV 정본 전환 단계 2(NERV Task `CLE-T-4ABTG7`)부터 리뷰 결과는 저장소 파일이 아니라 NERV 리뷰
레코드다. 오케스트레이터는 지금처럼 세션 디렉터리(`.review/<kind>/<시각>/`, gitignore 대상)에
역할마다 `<role>.md` 를 남긴다. 이 도구는 그 리포트를 읽어 역할별 제출 묶음을 JSON 으로 낸다.
제출은 기록 서브에이전트 `nerv-recorder` 가 역할마다 `nerv_review_submit` 을 불러 한다(결정 D7 역할별
제출 · D9 개정, NERV Task `CLE-T-CD9131`). 기록 서브에이전트를 쓸 수 없는 세션은 main 이 직접 낸다.
이 도구는 네트워크를 쓰지 않고 모델도 부르지 않는다.

    python3 .claude/tools/nerv_review_payload.py <session_dir> [--kind code|consistency|merge|spec_coverage]
                                                 [--keep-info]
    python3 .claude/tools/nerv_review_payload.py <session_dir> --out <file> --branch <b> --base <rev>
                                                 --head <rev> --mode <review|spec|prep|done|coordinate|audit>
                                                 [--task <KEY>] [--run <n>] [--changeset <path> ...]

`--out` 을 주면 제출 문서를 그 파일에 쓰고 stdout 에는 짧은 요약(역할 · 심각도별 발견 수 · 오류 · 경고)만
낸다. main 이 묶음 전문을 읽지 않게 하려는 모드다. 문서에는 `nerv-recorder` 가 그대로 낼 값이 다 있다.
  - `submit`: `kind` · `branch` · `base_sha` · `head_sha` · `changeset` · `task_id`. SHA 는 `git rev-parse`
    가 풀어 준 전체 값이다. 풀지 못하면 오류이고 짧은 SHA 를 늘리지 않는다. git 은 모두 세션 디렉터리의
    저장소에서 돌린다(도구를 부른 셸의 작업 디렉터리가 아니다. 셸이 다른 체크아웃으로 빠져 있어도 같은 값이 나온다).
    세션 디렉터리가 git 저장소 밖이면 값 문제가 아니라 그 사실을 오류로 낸다.
  - `base_sha` 는 `--base` 와 `--head` 의 merge-base 다. `--base origin/main` 처럼 앞서 나간 브랜치를 줘도
    base 쪽에 새로 들어온 변경이 `changeset` 에 역삭제로 섞이지 않는다.
  - `--branch` 가 이 저장소의 로컬 브랜치로 풀리면 `--head` 가 그 브랜치에 닿아야 한다. 다른 브랜치의 커밋이
    이 브랜치의 라운드로 묶이는 것을 막는다. 로컬에 없는 브랜치 이름이면 검사하지 않는다. 로컬 브랜치가 원격보다
    뒤처져 있으면(`--head origin/<브랜치>`) 올바른 제출도 이 오류가 된다. `--head` 를 브랜치 끝으로 주거나 로컬
    브랜치를 따라잡는다.
  - 역할 묶음마다 `idempotency_key`: `<task>:<kind>:<mode>:<head 앞 9자>:<role>:<내용 해시 8자>[:n]`. Task 가
    없으면 task 자리에 세션 시각(`<YYYYMMDD>-<hhmmss>`)을 쓰고, `--run` 이 2 이상이면 `:<n>` 을 붙인다.
    같은 초에 만든 세션은 디렉터리 이름에 `_<n>` 이 붙고(`13_40_14_2`) 시각도 `-<n>` 으로 끝난다(`20261010-134014-2`).
    내용 해시는 그 묶음(reviewer · summary · findings)의 해시다. 같은 파일을 다시 내면 같은 키라서 NERV 가
    재전송으로 묶고, 리포트를 고쳐 다시 내거나 스펙 초안을 고쳐 다시 검토하면(head 가 그대로여도) 키가
    바뀌어 새 제출로 기록된다. 내용이 같은데 새 제출로 내려면 `--run` 을 준다.
  - `changeset` 은 `--changeset`, 세션 `meta.json`, `git diff --name-only <base_sha>...<head_sha>` 순으로 채운다.
    셋 다 비면 오류다.
  - 오류가 있거나 강제 역할이 빠졌으면 `ok: false` 로 쓰고 `submit` 을 싣지 않는다. exit 1 이다.
  - 문서를 만들 수 없는 실패(세션 디렉터리 없음 · kind 미정)도 `{"version": 1, "ok": false, "errors": [...]}`
    를 `--out` 에 쓰고 exit 1 이다. 낡은 문서를 남기지 않는 규칙(앞 실행의 파일을 지운다 · exit 2 만 예외다 · exit 가
    0 일 때만 기록 에이전트에 넘긴다 · 이 도구의 문서가 아닌 파일은 거절한다)의 정본은 `_shared/out_doc.py`
    docstring 이다. `nerv_review_handoff.py pending --out` 도 같다.

출력(JSON):
    {"kind": "code", "session_dir": "...", "changeset": ["a/b.ts", ...],
     "submissions": [{"reviewer": {"role": "security", "risk": "low"},
                      "summary": "...", "findings": [{"severity": "warning", "title": "...",
                      "body": "...", "file": "a/b.ts", "line": 12, "suggestion": "...",
                      "category": "security"}]}],
     "missing_forced": [], "errors": [], "warnings": []}

`--out` 없이 부르면 위 모양을 stdout 에 내고, 제출하는 쪽이 `branch` · `base_sha` · `head_sha`(리뷰한 커밋) ·
`task_id` · `idempotency_key`(형식의 정본은 code-review-agents SKILL §4)를 붙인다. `changeset` 은 세션
`meta.json` 의 `files` 에서 경로만 뽑은 것이다(오케스트레이터는 `{"file_path": …}` 객체로 쓴다. 뽑을 수
없으면 키가 없고, 제출하는 쪽이 `git diff --name-only <base>...<head>` 로 채운다).

역할은 세션 `_retry_state.json` 의 `subagent_invocations` 가 정한다. 그 목록에 없는 `*.md`(예: 처리
중에 생긴 제안 파일)는 역할 리포트가 아니므로 내지 않고 `warnings` 에 남긴다. `errors` 가 있거나
`missing_forced` 가 비어 있지 않으면 exit 1 이다. 그대로 내면 라운드가 틀린다.
  - 강제 역할의 리포트가 빠졌다(`missing_forced`). 라운드가 `missing_roles` 로 남는다.
  - kind=code 인데 상태 파일이 없거나 역할 목록이 없다. 강제 역할 누락을 확인하지 못한다.
  - 낼 묶음이 하나도 없다.
  - 어느 역할의 위험도가 HIGH 인데 critical · warning 발견을 하나도 읽지 못했다.
  - kind=spec_coverage 인데 `SUMMARY.md` 가 없다.

kind 마다 리포트가 다르다(전환 4e 에서 merge · spec_coverage 를 더했다).
  - code · consistency · merge: 역할(리뷰어 · checker · analyzer)마다 `<role>.md`. merge 의 통합
    보고서 `SUMMARY.md` 는 analyzer 리포트를 합친 것이라 내지 않는다.
  - spec_coverage: 감사기(`spec-impl-coverage-auditor`) 하나가 `SUMMARY.md` 를 쓴다. 후보마다 발견
    하나를 역할 `spec_coverage` 로 낸다. **심각도는 모두 info 다** — 이 감사는 NLP 휴리스틱의 후보이고
    빌드를 막지 않는 보고형이다(`CLE-ENG-SPECEVIDENCE` R-9). 신뢰도는 태그 `confidence:<high|medium|low>`
    로 싣는다. info 라서 라운드를 막지 않는다. main 은 후보를 Task 로 올리거나 처분한다.
리포트 형식은 리뷰어 · checker 정의(`.claude/agents/*.md` §출력 형식)가 정본이다:
`- **[CRITICAL|WARNING|INFO]** 제목` 아래 `위치:` · `상세:` · `제안:` 하위 항목, `### 요약`, `### 위험도`.
kind=code · consistency 의 INFO 는 발견으로 내지 않고 그 역할 묶음의 `summary` 끝에 제목과 위치만 싣는다
(NERV Task `CLE-T-ZTTHXD`). 열린 발견은 처분할 때까지 다른 브랜치의 제출 응답에 `carried_over` 로 따라붙고,
처분 도구는 한 번에 한 건만 받는다. 그래서 INFO 를 발견으로 내면 라운드마다 처분 호출이 십여 번 늘거나,
열어 두면 응답이 커진다. 게이트는 INFO 를 보지 않는다. 예외로 `[SPEC-DRIFT]`(`tags: ["spec_drift"]`)
INFO 는 스펙 초안으로 처분해야 해서 발견으로 남긴다. 옮긴 수는 출력의 `info_in_summary` 다. 예전처럼
모두 발견으로 내려면 `--keep-info` 를 준다. INFO 의 본문 · 제안은 세션 디렉터리의 역할 리포트에 남는다.
`- **[SEV] 제목**` 처럼 굵게가 제목까지 감싼 줄도 발견으로 읽는다. 그 밖에 심각도 표지가 있는 줄은
`warnings` 에 줄 번호와 함께 남긴다. 조용히 버리면 발견이 빠진 채 라운드가 passed 가 된다.
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
from _shared import block_integrity, git_probe, out_doc, report_paths, session  # noqa: E402

KINDS = ("code", "consistency", "merge", "spec_coverage")
# 멱등 키의 mode 자리(code-review-agents SKILL §4).
MODES = ("review", "spec", "prep", "done", "coordinate", "audit")
# NERV 정책 `review_roles.code` 의 필수 역할. router 가 늘 강제하지만 `REVIEW_AGENTS` 로 좁히면 빠질 수
# 있어 kind=code 에서 빠지면 경고한다(라운드가 `missing_roles` 로 남는다).
NERV_REQUIRED_ROLES = ("security", "requirement", "scope", "side_effect", "maintainability", "testing")
_SPEC_DRIFT_RE = re.compile(r"\[?SPEC[-_ ]DRIFT\]?", re.I)
# spec-coverage 감사기 SUMMARY 의 모양(`.claude/agents/spec-impl-coverage-auditor.md` §출력 형식).
SPEC_COVERAGE_ROLE = "spec_coverage"
_COVERAGE_TIER_RE = re.compile(r"^##\s+후보\s*[—–-]\s*(high|medium|low)\s+confidence\b", re.I)
_COVERAGE_ITEM_RE = re.compile(r"^###\s+\d+\.\s+(.*\S)\s*$")
# 후보의 필드. 앞 둘은 본문, 마지막은 제안이 된다.
_COVERAGE_FIELDS = ("신호", "부재", "권고")
_COVERAGE_FIELD_RE = re.compile(r"^\s*[-*]\s+\*\*(" + "|".join(_COVERAGE_FIELDS) + r")\*\*\s*[:：]\s*(.*)$")
# 요약의 후보 수(`- 후보 high: 3`). 읽은 후보 수와 맞춰 본다.
_COVERAGE_COUNT_RE = re.compile(r"^\s*[-*]?\s*후보\s+(high|medium|low)\s*[:：]\s*(\d+)", re.I)
_COVERAGE_DIRECTION_RE = re.compile(r"\[(forward|reverse)\]", re.I)
# 세션 디렉터리 이름 → kind. 오케스트레이터가 `.review/<이름>/<Y>/<m>/<d>/<H_M_S>[_<n>]` 에 쓴다.
_DIR_KIND = {"code": "code", "consistency": "consistency", "merge": "merge",
             "spec-coverage": "spec_coverage"}
# 리포트가 아닌 세션 파일. `_` 로 시작하는 파일(상태 · 프롬프트)도 뺀다.
_NOT_REPORTS = {"SUMMARY.md", "RESOLUTION.md", "README.md"}

# 발견 줄. 정의의 형식(`**[SEV]** 제목`)과, 리뷰어가 흔히 쓰는 `**[SEV] 제목**` 을 함께 받는다(9월 역할
# 리포트 5,447개 중 187개가 뒤의 형식이었다. 2026-10-01 리뷰 실측).
_FINDING_RE = re.compile(
    r"^\s{0,3}(?:[-*]|\d+[.)])\s+\*\*\[(CRITICAL|WARNING|INFO)\](?:\*\*\s*(.*)|\s*(.*?)\*\*\s*(.*))$", re.I)
_HEADING_FINDING_RE = re.compile(r"^#{2,6}\s+\[(CRITICAL|WARNING|INFO)\]\s*(.*)$", re.I)
# 형식 밖 표지: `[` 나 `**` 바로 뒤(공백 허용)에 오는 심각도 단어. `[CRITICAL/HIGH]` · `[WARNING — 인증]` ·
# `[ CRITICAL ]` · `**CRITICAL**` 이 모두 걸린다(2026-10-01 리뷰 재현: 옛 `\[(CRITICAL|WARNING)\]` 는 넷 다
# 놓쳤다). `### 위험도` 의 맨 단어 `CRITICAL` 은 괄호 · 굵게가 아니라 걸리지 않는다.
_MARKER_RE = re.compile(r"(?:\[|\*\*)\s*(CRITICAL|WARNING)\b", re.I)
_HEADING_RE = re.compile(r"^#{1,6}\s")
# 리뷰어 · checker · analyzer 정의(`.claude/agents/*.md` §출력 형식)가 쓰는 하위 항목 이름. 모르는 이름은
# 앞 항목에 붙어 버리므로 정의에 이름이 늘면 여기도 는다(RealSessionShapeTest 가 대조한다).
LOCATION_FIELDS = ("위치", "target 위치")
LABELED_FIELDS = ("위반 규약", "과거 결정 출처", "관련 plan", "target 신규 식별자", "기존 사용처",
                  "변경 파일", "매트릭스 항목", "누락된 동반 갱신")
FIELD_NAMES = LOCATION_FIELDS + ("충돌 대상", "상세", "제안") + LABELED_FIELDS
_FIELD_RE = re.compile(r"^\s+[-*]\s+(" + "|".join(map(re.escape, FIELD_NAMES)) + r")\s*[:：]\s*(.*)$")
_LOCATION_RE = re.compile(r"`([^`\s]+?)(?::(\d+)(?:[-~]\d+)?)?`")
_RISK_RE = re.compile(r"\b(NONE|LOW|MEDIUM|HIGH|CRITICAL)\b")
_RISK_MAP = {"NONE": "low", "LOW": "low", "MEDIUM": "medium", "HIGH": "high", "CRITICAL": "high"}

# 길이 상한은 이 도구가 정한 값이다(NERV 서버 한도가 아니다). 2026-10-09 실측으로 NERV 는 1,000자가 넘는
# summary 를 받았다. 접힌 INFO 가 있으면 summary 는 요약(MAX_SUMMARY) + 빈 줄 + INFO 노트(MAX_INFO_NOTE)까지 간다.
MAX_TITLE = 300
MAX_BODY = 4000
MAX_SUGGESTION = 2000
MAX_SUMMARY = 1000
MAX_INFO_NOTE = 2000
INFO_TO_SUMMARY_KINDS = ("code", "consistency")
SPEC_DRIFT_TAG = "spec_drift"


class SessionError(Exception):
    """세션 디렉터리가 없거나 kind 를 정하지 못해 제출 묶음을 만들 수 없다. `build` 가 던지고 `main` 이 잡는다."""


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
    if fields.get("충돌 대상"):
        body_parts.append("\n".join(x for x in fields["충돌 대상"] if x).strip())
    for name in LABELED_FIELDS:
        if fields.get(name):
            body_parts.append(f"{name}: " + "\n".join(x for x in fields[name] if x).strip())
    if fields.get("상세"):
        body_parts.append("\n".join(x for x in fields["상세"] if x).strip())
    if not fields:  # 하위 항목 없이 산문으로 쓴 블록
        body_parts.append("\n".join(x.strip() for x in block if x.strip()))
    out = {
        "severity": severity.lower(),
        "title": _cap(re.sub(r"\s+", " ", title) or "(제목 없음)", MAX_TITLE),
        "body": _cap("\n\n".join(p for p in body_parts if p), MAX_BODY),
        "category": role,
    }
    # 구현이 아니라 스펙이 낡은 발견(requirement-reviewer 의 `[SPEC-DRIFT]`)은 NERV 분류에 그대로 싣는다.
    if _SPEC_DRIFT_RE.search(title):
        out["tags"] = [SPEC_DRIFT_TAG]
        out["area"] = "spec"
    suggestion = "\n".join(x for x in fields.get("제안", []) if x).strip()
    if suggestion:
        out["suggestion"] = _cap(suggestion, MAX_SUGGESTION)
    if path:
        out["file"] = path
    if line:
        out["line"] = line
    return out


def _is_foldable_info(finding: dict) -> bool:
    return finding["severity"] == "info" and SPEC_DRIFT_TAG not in (finding.get("tags") or [])


def fold_info(submission: dict) -> int:
    """`[SPEC-DRIFT]` 이 아닌 INFO 를 발견에서 빼서 `summary` 끝에 제목 · 위치로 싣는다. 옮긴 수를 낸다."""
    keep, moved = [], []
    for f in submission["findings"]:
        (moved if _is_foldable_info(f) else keep).append(f)
    if not moved:
        return 0
    items = []
    for f in moved:
        where = f.get("file", "")
        if where and f.get("line"):
            where += f":{f['line']}"
        items.append(f"{f['title']} ({where})" if where else f["title"])
    note = _cap(f"참고(INFO) {len(moved)}건: " + " · ".join(items), MAX_INFO_NOTE)
    base = submission.get("summary", "")
    submission["summary"] = f"{base}\n\n{note}" if base else note
    submission["findings"] = keep
    return len(moved)


def parse_report(text: str, role: str) -> tuple[dict, list[str]]:
    """리포트 본문 → (제출 묶음, 경고). 경고는 형식에서 벗어난 심각도 표지다."""
    lines = text.splitlines()
    findings: list[dict] = []
    warnings: list[str] = []
    starts: list[tuple[int, str, str]] = []
    for i, ln in enumerate(lines):
        m = _FINDING_RE.match(ln) or _HEADING_FINDING_RE.match(ln)
        if m:
            # `**[SEV]:** 제목` 은 뒤 형식으로 읽혀 제목 앞에 `:` 가 남는다. 걷는다.
            title = " ".join(g for g in m.groups()[1:] if g).lstrip(":：-— ").strip()
            starts.append((i, m.group(1), title))
        elif _MARKER_RE.search(ln):
            # 표 · 인용 줄도 센다. 9월 역할 리포트 5,457개 중 그런 줄은 1개(인용)라 경고가 흔하지 않고,
            # 빼면 표에 쓴 발견이 경고 없이 빠진다.
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


def _coverage_finding(candidate: dict) -> dict:
    """후보 하나(제목 · 신뢰도 · 필드)를 info 발견 하나로 바꾼다."""
    fields = candidate["fields"]
    signal, absence, advice = _COVERAGE_FIELDS
    body = "\n".join(f"{name}: {' '.join(fields[name]).strip()}" for name in (signal, absence) if fields.get(name))
    title = candidate["title"]
    out = {"severity": "info", "title": _cap(re.sub(r"\s+", " ", title), MAX_TITLE),
           "body": _cap(body or title, MAX_BODY), "category": SPEC_COVERAGE_ROLE,
           "tags": [SPEC_COVERAGE_ROLE, f"confidence:{candidate['tier']}"]}
    direction = _COVERAGE_DIRECTION_RE.search(title)
    if direction:
        out["tags"].append(direction.group(1).lower())
    if fields.get(advice):
        out["suggestion"] = _cap(" ".join(fields[advice]).strip(), MAX_SUGGESTION)
    path, line = _location(title)
    if path:
        out["file"] = path
    if line:
        out["line"] = line
    return out


def coverage_count_warnings(text: str, findings: list[dict]) -> list[str]:
    """요약이 센 후보 수보다 적게 읽었으면 경고한다. 형식이 어긋나면 후보가 조용히 0건이 된다."""
    claimed: dict[str, int] = {}
    for ln in _section(text.splitlines(), "요약"):
        m = _COVERAGE_COUNT_RE.match(ln)
        if m:
            claimed[m.group(1).lower()] = int(m.group(2))
    read: dict[str, int] = {}
    for f in findings:
        tier = next((t.split(":", 1)[1] for t in f["tags"] if t.startswith("confidence:")), "")
        read[tier] = read.get(tier, 0) + 1
    if not claimed:
        if not findings:
            return ["SUMMARY.md: 후보를 하나도 읽지 못했고 요약에 후보 수도 없다 — 감사기 출력 형식을 확인한다"]
        return []
    return [f"SUMMARY.md: 요약은 {tier} 후보 {n}건인데 {read.get(tier, 0)}건만 읽었다 — 후보 형식을 확인한다"
            for tier, n in claimed.items() if read.get(tier, 0) < n]


def parse_coverage_summary(text: str) -> dict:
    """spec-coverage 감사기 SUMMARY → 역할 `spec_coverage` 의 제출 묶음. 후보 하나가 info 발견 하나다."""
    lines = text.splitlines()
    findings: list[dict] = []
    tier: str | None = None
    current: dict | None = None
    field: str | None = None

    for ln in lines:
        m = _COVERAGE_TIER_RE.match(ln)
        if m:
            if current is not None:
                findings.append(_coverage_finding(current))
            current, field, tier = None, None, m.group(1).lower()
            continue
        if ln.startswith("## "):
            if current is not None:
                findings.append(_coverage_finding(current))
            current, field, tier = None, None, None
            continue
        m = _COVERAGE_ITEM_RE.match(ln)
        if m and tier:
            if current is not None:
                findings.append(_coverage_finding(current))
            current, field = {"title": m.group(1), "tier": tier, "fields": {}}, None
            continue
        if current is None:
            continue
        m = _COVERAGE_FIELD_RE.match(ln)
        if m:
            field = m.group(1)
            current["fields"].setdefault(field, []).append(m.group(2))
        elif field and ln.strip():
            current["fields"][field].append(ln.strip())
    if current is not None:
        findings.append(_coverage_finding(current))

    submission: dict = {"reviewer": {"role": SPEC_COVERAGE_ROLE}, "findings": findings}
    summary = " ".join(x.strip().lstrip("-* ").strip() for x in _section(lines, "요약") if x.strip())
    if summary:
        submission["summary"] = _cap(summary, MAX_SUMMARY)
    return submission


def kind_of(session_dir: str) -> str | None:
    parts = os.path.normpath(os.path.abspath(session_dir)).split(os.sep)
    # 시각 경로(<Y>/<m>/<d>/<H_M_S>[_<n>]) 바로 위가 kind 디렉터리다. 마지막 조각의 모양은 보지 않는다.
    if len(parts) >= 5:
        return _DIR_KIND.get(parts[-5])
    return None


def _load_json(path: str):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def _roles(session_dir: str, state) -> dict[str, str] | None:
    """역할 이름 → 세션의 리포트 파일 이름. 상태 파일에 역할 목록이 없으면 None.

    경로 해석은 강제 역할 검사(`report_paths.missing_reports`)와 같은 `report_paths` 를 쓴다. 따로
    풀면 둘이 갈린다. `output_file` 이 `/` 로 끝나면 이 함수만 빈 이름을 얻어 그 역할을 빼고, 검사는
    `<name>.md` 로 풀어 "있다" 고 봐서 강제 역할이 조용히 빠졌다(2026-10-01 리뷰 재현)."""
    if not isinstance(state, dict) or not isinstance(state.get("subagent_invocations"), list):
        return None
    roles = {name: os.path.basename(path) for name, path in report_paths.report_paths(session_dir, state).items()
             if isinstance(name, str)}
    return roles or None


def _result(kind: str, session_dir: str, *, submissions=(), missing=(), errors=(), warnings=(),
            changeset=None, info_in_summary: int = 0) -> dict:
    """`build` 가 돌려주는 모양. 모든 kind 가 이 한 곳에서 만든다."""
    out: dict = {"kind": kind, "session_dir": os.path.abspath(session_dir)}
    if changeset:
        out["changeset"] = list(changeset)
    out.update({"submissions": list(submissions), "missing_forced": list(missing),
                "errors": list(errors), "warnings": list(warnings), "info_in_summary": info_in_summary})
    return out


def _build_spec_coverage(session_dir: str, kind: str) -> dict:
    """spec_coverage 세션: 감사기가 쓴 SUMMARY.md 하나가 역할 하나다."""
    try:
        with open(os.path.join(session_dir, "SUMMARY.md"), encoding="utf-8", errors="replace") as f:
            text = f.read()
    except OSError:
        return _result(kind, session_dir,
                       errors=["SUMMARY.md 가 없다 — 감사기 결과를 main 이 기록했는지 확인한다"])
    submission = parse_coverage_summary(text)
    return _result(kind, session_dir, submissions=[submission],
                   warnings=coverage_count_warnings(text, submission["findings"]))


def build(session_dir: str, kind: str | None = None, *, keep_info: bool = False) -> dict:
    if not os.path.isdir(session_dir):
        raise SessionError(f"세션 디렉터리가 없다 — {session_dir}")
    kind = kind or kind_of(session_dir)
    if kind not in KINDS:
        raise SessionError("kind 를 정하지 못했다 — --kind 로 준다")
    if kind == "spec_coverage":
        return _build_spec_coverage(session_dir, kind)
    names = sorted(
        n for n in os.listdir(session_dir)
        if n.endswith(".md") and n not in _NOT_REPORTS and not n.startswith("_")
        and os.path.isfile(os.path.join(session_dir, n))
    )
    submissions: list[dict] = []
    errors: list[str] = []
    warnings: list[str] = []
    info_moved = 0

    state = _load_json(os.path.join(session_dir, "_retry_state.json"))
    roles = _roles(session_dir, state)
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
        if not keep_info and kind in INFO_TO_SUMMARY_KINDS:
            info_moved += fold_info(submission)
        submissions.append(submission)
        warnings.extend(w)
        # 위험도는 HIGH 인데 막는 발견이 하나도 안 읽혔으면 형식이 어긋나 발견이 빠졌을 공산이 크다.
        blocking = [f for f in submission["findings"] if f["severity"] in ("critical", "warning")]
        if submission["reviewer"].get("risk") == "high" and not blocking:
            errors.append(f"{name}: 위험도가 HIGH 인데 critical · warning 발견을 하나도 읽지 못했다 — 발견 형식을 확인한다")

    missing: list[str] = []
    if isinstance(state, dict):
        forced = state.get("agents_forced") or []
        missing = report_paths.missing_reports(session_dir, forced, state)
        # 리포트가 있어도 묶음에 안 들어갔으면 빠진 것이다(해석이 갈려도 조용히 지나가지 않게).
        submitted = {s["reviewer"]["role"] for s in submissions}
        missing += [r for r in forced if isinstance(r, str) and r not in submitted and r not in missing]
    if not submissions:
        errors.append("제출할 역할 리포트가 없다.")
    if kind == "code" and submissions:
        absent = [r for r in NERV_REQUIRED_ROLES if r not in {s["reviewer"]["role"] for s in submissions}]
        if absent:
            warnings.append(f"NERV 필수 역할이 묶음에 없다: {', '.join(absent)} — 라운드가 missing_roles 로 남는다")
    if kind == "consistency":
        # 통합 SUMMARY 가 checker 의 [CRITICAL] 을 낮춰 `BLOCK: NO` 라고 적은 경우. NERV 에는
        # checker 리포트가 그대로 올라가므로 판정은 서버가 바로잡는다. 다만 사람이 읽는 SUMMARY 가
        # 틀렸다는 사실은 제출 전에 알린다(`consistency-summary.md` §요약 지침 3).
        note = block_integrity.contradiction_note(session_dir)
        if note:
            warnings.append(f"SUMMARY.md: {note}")
    changeset = None
    meta = _load_json(os.path.join(session_dir, "meta.json"))
    files = meta.get("files") if isinstance(meta, dict) else None
    if isinstance(files, list) and files:
        paths = [f.get("file_path") if isinstance(f, dict) else f for f in files]
        if all(isinstance(x, str) and x for x in paths):
            changeset = paths
    out = _result(kind, session_dir, submissions=submissions, missing=missing, errors=errors,
                  warnings=warnings, changeset=changeset, info_in_summary=info_moved)
    return out


def session_stamp(session_dir: str) -> str | None:
    """세션 경로 `.review/<kind>/<Y>/<m>/<d>/<H_M_S>[_<n>]` → `<YYYYMMDD>-<hhmmss>[-<n>]`. Task 가 없는 멱등 키의 앞자리다.

    같은 초에 세션을 또 만들면 `create_session_dir` 가 `_2` · `_3` 을 붙인다. 접미사를 키에 남겨야 같은 초의
    두 세션이 같은 키로 묶이지 않는다. 경로는 이름을 만드는 모듈(`session.parse_session_dir`)이 읽는다."""
    parsed = session.parse_session_dir(session_dir)
    if parsed is None:
        return None
    year, month, day, hh, mm, ss, n = parsed
    return f"{year}{month}{day}-{hh}{mm}{ss}" + (f"-{n}" if n else "")


def content_digest(sub: dict) -> str:
    """역할 묶음 내용(reviewer · summary · findings)의 해시 앞 8자. 멱등 키에 들어가 내용이 바뀌면 키도 바뀐다."""
    payload = json.dumps(sub, ensure_ascii=False, sort_keys=True, default=str)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:8]


def _resolve_range(*, branch: str, base: str, head: str, cwd: str) -> tuple[str | None, str | None, list[str]]:
    """`--base` · `--head` · `--branch` → (`base_sha`, `head_sha`, 오류). 풀지 못한 값은 `None` 이다.

    git 은 `cwd`(세션 디렉터리)의 저장소에서 돈다. `base_sha` 는 `--base` 와 `--head` 의 merge-base 다."""
    if not git_probe.in_work_tree(cwd):
        return None, None, [f"세션 디렉터리가 git 저장소 안에 있어야 한다 — {cwd}. git 은 이 디렉터리에서 돈다"
                            "(도구를 부른 셸의 작업 디렉터리가 아니다)"]
    errors: list[str] = []
    head_sha = git_probe.resolve_commit(head, cwd)
    base_tip = git_probe.resolve_commit(base, cwd)
    if base_tip is None:
        errors.append(f"--base {base}: 커밋으로 풀지 못했다 — git rev-parse 가 아는 값을 준다")
    if head_sha is None:
        errors.append(f"--head {head}: 커밋으로 풀지 못했다 — git rev-parse 가 아는 값을 준다")
    base_sha = None
    if base_tip is not None and head_sha is not None:
        base_sha = git_probe.merge_base(base_tip, head_sha, cwd)
        if base_sha is None:
            errors.append(f"--base {base} 와 --head {head} 의 공통 조상을 찾지 못했다")
    if head_sha is not None and _branch_mismatch(branch, head_sha, cwd):
        errors.append(f"--head {head} 가 --branch {branch} 에 닿지 않는다 — 다른 브랜치의 커밋을 이 브랜치의 라운드로 "
                      "내지 않는다. --head 를 그 브랜치의 끝으로 주거나 --branch 를 리뷰한 브랜치로 맞춘다"
                      "(로컬 브랜치가 원격보다 뒤처졌으면 먼저 따라잡는다)")
    return base_sha, head_sha, errors


def _changeset(given: list[str] | None, from_build: list[str] | None, *, base_sha: str | None,
               head_sha: str | None, cwd: str) -> tuple[list[str] | None, list[str]]:
    """`--changeset` → 세션 `meta.json` → `git diff base_sha...head_sha` 순으로 채운 (changeset, 오류)."""
    errors: list[str] = []
    files = list(given) if given else from_build
    if not files and base_sha is not None and head_sha is not None:
        probe_errors: list[str] = []
        files = git_probe.branch_diff_files(base_sha, cwd, head=head_sha, on_error=probe_errors.append)
        errors.extend(f"changeset: git diff 가 실패했다 — {e}" for e in probe_errors)
    if base_sha is not None and head_sha is not None and not files:
        errors.append("changeset 이 비었다 — --changeset 으로 주거나 base...head 에 바뀐 파일이 있는지 확인한다")
    return files, errors


def _assign_keys(submissions: list[dict], *, slot: str, kind: str, mode: str, head_sha: str, run: int) -> None:
    """역할 묶음마다 멱등 키를 붙인다(형식의 정본은 code-review-agents SKILL §4)."""
    suffix = f":{run}" if run > 1 else ""
    for sub in submissions:
        sub["idempotency_key"] = (f"{slot}:{kind}:{mode}:{head_sha[:9]}:{sub['reviewer']['role']}"
                                  f":{content_digest(sub)}{suffix}")


def attach_submit(out: dict, *, branch: str, base: str, head: str, mode: str, task: str | None,
                  run: int, changeset: list[str] | None) -> dict:
    """`build` 결과에 제출 머리(`submit`)와 역할마다 멱등 키를 붙여 기록 서브에이전트가 그대로 낼 문서를 만든다.

    SHA 는 git 이 풀어 준 전체 값만 싣는다. git 은 세션 디렉터리의 저장소에서 돌린다(`_shared/git_probe`).
    바꾸지 못한 값이 있으면 `submit` 을 싣지 않고 `ok` 를 false 로 둔다.
    기록 서브에이전트(`nerv-recorder`)는 `ok` 가 false 이거나 `submit` 이 없으면 아무것도 내지 않는다."""
    cwd = out["session_dir"]
    base_sha, head_sha, errors = _resolve_range(branch=branch, base=base, head=head, cwd=cwd)
    files, changeset_errors = _changeset(changeset, out.get("changeset"), base_sha=base_sha, head_sha=head_sha, cwd=cwd)
    errors += changeset_errors
    slot = task or session_stamp(cwd)
    if slot is None:
        errors.append("멱등 키의 앞자리를 정하지 못했다 — --task 를 주거나 .review/<kind>/<Y>/<m>/<d>/<H_M_S>[_<n>] 세션을 준다")
    doc: dict = {"version": out_doc.VERSION, "ok": False, **out, "errors": [*out["errors"], *errors]}
    if doc["errors"] or out["missing_forced"]:
        return doc
    _assign_keys(doc["submissions"], slot=slot, kind=out["kind"], mode=mode, head_sha=head_sha, run=run)
    doc["submit"] = {"kind": out["kind"], "branch": branch, "base_sha": base_sha, "head_sha": head_sha,
                     "changeset": files, "task_id": task}
    doc["ok"] = True
    return doc


def _branch_mismatch(branch: str, head_sha: str, cwd: str) -> bool:
    """`branch` 가 이 저장소의 로컬 브랜치인데 `head_sha` 가 거기서 닿지 않으면 True. 로컬에 없으면 False(검사하지 않는다)."""
    tip = git_probe.local_branch_tip(branch, cwd)
    return tip is not None and not git_probe.is_ancestor(head_sha, tip, cwd)


def brief(doc: dict, out_path: str) -> dict:
    """`--out` 을 쓸 때 stdout 에 내는 짧은 요약. 발견 본문은 싣지 않는다."""
    counts: dict[str, int] = {}
    for sub in doc["submissions"]:
        for f in sub["findings"]:
            counts[f["severity"]] = counts.get(f["severity"], 0) + 1
    return {"ok": doc["ok"], "out": out_path, "kind": doc["kind"],
            "head_sha": (doc.get("submit") or {}).get("head_sha"),
            "roles": sorted(s["reviewer"]["role"] for s in doc["submissions"]),
            "findings": counts, "info_in_summary": doc["info_in_summary"],
            "missing_forced": doc["missing_forced"], "errors": doc["errors"], "warnings": doc["warnings"]}


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0], allow_abbrev=False)
    ap.add_argument("session_dir")
    ap.add_argument("--kind", choices=KINDS)
    ap.add_argument("--keep-info", action="store_true",
                    help="INFO 도 발견으로 낸다(기본은 [SPEC-DRIFT] 가 아닌 INFO 를 summary 에 싣는다)")
    ap.add_argument("--out", help="제출 문서를 이 파일에 쓰고 stdout 에는 요약만 낸다(nerv-recorder 입력)")
    ap.add_argument("--branch")
    ap.add_argument("--base", help="리뷰 기준 커밋(rev). git 이 전체 SHA 로 푼다")
    ap.add_argument("--head", help="리뷰한 커밋(rev). git 이 전체 SHA 로 푼다")
    ap.add_argument("--mode", choices=MODES, help="멱등 키의 mode 자리")
    ap.add_argument("--task", help="NERV Task 키. 없으면 멱등 키 앞자리에 세션 시각을 쓴다")
    ap.add_argument("--run", type=int, default=1, help="같은 head 를 다시 낼 때의 차수(2 부터 키에 붙는다)")
    ap.add_argument("--changeset", action="append", help="바뀐 파일. 여러 번 준다. 없으면 meta.json, 그다음 git diff")
    args = ap.parse_args(argv)
    if args.out:
        absent = [f"--{n}" for n in ("branch", "base", "head", "mode") if not getattr(args, n)]
        if absent:
            ap.error(f"--out 에는 {' '.join(absent)} 도 준다")
        if args.run < 1:
            ap.error("--run 은 1 이상이다")
        out_doc.begin_or_exit(ap, args.out)  # 인자 검사 뒤: 앞 실행의 문서를 치운다. 이 도구의 문서가 아닌 파일은 건드리지 않는다
    try:
        out = build(args.session_dir, args.kind, keep_info=args.keep_info)
    except SessionError as exc:
        if not args.out:
            raise SystemExit(f"nerv_review_payload: {exc}") from exc
        # 세션 디렉터리가 없거나 kind 를 정하지 못했다. 문서를 만들 수 없어도 `--out` 에는 이번 실행의 결과를 남긴다.
        return _write_out(args.out, _failed_doc(args.kind, args.session_dir, str(exc)))
    if not args.out:
        json.dump(out, sys.stdout, ensure_ascii=False, indent=1)
        sys.stdout.write("\n")
        # 그대로 제출하면 라운드가 틀린다(모듈 docstring). 알리고 실패한다.
        return 1 if out["missing_forced"] or out["errors"] else 0
    doc = attach_submit(out, branch=args.branch, base=args.base, head=args.head, mode=args.mode,
                        task=args.task, run=args.run, changeset=args.changeset)
    return _write_out(args.out, doc)


def _failed_doc(kind: str | None, session_dir: str, message: str) -> dict:
    """`build` 가 문서를 못 만들었을 때의 `--out` 문서. 모양은 `_result` 가 정한다(`brief` 가 읽는 키가 거기서 나온다)."""
    fields = _result(kind, session_dir, errors=[message])
    return out_doc.failure(fields.pop("errors"), **fields)


def _write_out(path: str, doc: dict) -> int:
    """`--out` 문서를 쓰고 요약을 stdout 에 낸다. 못 쓰면 그 사실을 알리고 실패한다."""
    summary = out_doc.write_with_summary(path, doc, brief(doc, path))
    json.dump(summary, sys.stdout, ensure_ascii=False)
    sys.stdout.write("\n")
    return 0 if summary["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
