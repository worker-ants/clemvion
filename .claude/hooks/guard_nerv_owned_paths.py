#!/usr/bin/env python3
"""PreToolUse hook — NERV 가 정본인 경로의 도구 편집을 막는다.

Registered in `.claude/settings.json` for `Write|Edit|MultiEdit|NotebookEdit`.
exit 0 → 허용, exit 2 → 차단(stderr 가 이유), 그 밖 → 런타임 오류로 보고 허용(fail-open).

등록 명령은 이 파일이 없으면 통과한다(`test ! -f … || python3 …`). 하네스는 훅을
`$CLAUDE_PROJECT_DIR`(main checkout)에서 찾는데, 이 훅을 등록한 `settings.json` 을 읽은 워크트리
세션이 아직 pull 하지 않은 main checkout 을 만나면 python 이 "can't open file" 로 exit 2 를 내
모든 편집이 막힌다. 2026-10-01 실측(Task `CLE-T-VA4YA1` 작업 세션이 재개 뒤 실제로 막혔다).

NERV 정본 전환 단계 1(NERV Task `CLE-T-VA4YA1`)부터 스펙의 정본은 NERV 다. 저장소 `spec/`
의 미러는 `.claude/tools/nerv-mirror/pull.py` 만 쓴다(도구 호출이 아니라 파일을 직접 쓰므로
이 훅에 걸리지 않는다). 옛 `spec/<영역>/` 트리는 이 시점부터 동결됐고 단계 5 에서 지웠다(원문은
git 이력).

전환 단계는 NERV Task `[전환 N]` 이 정의한다: 0 연동 설정(`CLE-T-0EZEYF`) · 1 spec 미러
(`CLE-T-VA4YA1`) · 2 리뷰 전환(`CLE-T-4ABTG7`) · 3 plan · review 제거(`CLE-T-FN2JWK`) ·
4a~4g 옛 트리를 읽던 표면 정리(4a 카탈로그 `CLE-T-BD48J3` · 4b 가이드 참조 `CLE-T-BDRZVX` ·
4c codebase 링크 `CLE-T-9AM31N` · 4d 거버넌스 경로 `CLE-T-BR8BNZ` · 4e 검토 코퍼스
`CLE-T-VP5KDJ` · 4f 개별 가드 `CLE-T-RXMB2X` · 4g 주석 래칫 `CLE-T-M7K35H`) · 5 옛 spec 트리
삭제(`CLE-T-7M4C4X`).

막는 경로는 전환 단계에 따라 늘어난다. 거버넌스 문서가 그 경로의 쓰기를 더는 안내하지 않을 때
더한다. 먼저 막으면 문서가 시키는 일을 훅이 막는다.
- `spec/` — 단계 1.
- `review/` — 단계 2(리뷰 결과를 NERV 레코드로 낸다. 로컬 산출물은 gitignore 대상 `.review/` 에
  쓴다). 옛 `review/` 는 단계 3 에서 지웠다. 이 차단은 그 트리가 다시 생기지 않게 한다.
- `plan/` — 단계 3(plan 제거: 작업은 NERV Task 로 추적한다. 옛 plan 원문은 git 이력에 있다).

판정은 **대상 파일이 속한 체크아웃 루트 기준 상대 경로**다. main checkout 이든 워크트리든
`<루트>/spec/…` 이면 막는다. 루트는 대상 경로에서 위로 올라가며 처음 만나는
`.git`(디렉터리 또는 워크트리의 파일)이다. 그 루트에 표지 파일 `MARKER`(미러 도구)가 있어야
이 저장소로 본다. 표지가 없는 다른 git 저장소와 git 체크아웃 밖(scratchpad 등)은 대상이 아니다.
경로는 `realpath` 로 풀고(`..` · 심볼릭 링크), 첫 경로 조각은 대소문자를 무시하고 비교한다.

셸 편집(`sed -i`, 리다이렉트)은 이 훅이 보지 못한다. 그 편집을 CI `spec-mirror-integrity`
(`pull.py --check`)가 어디까지 잡는지는 `pull.py` docstring 의 "보장 범위" 가 정본이다. 미러
파일 삭제는 어느 층도 잡지 않는다.

일회성 우회: `BYPASS_NERV_OWNED_PATHS=1`.
"""

from __future__ import annotations

import json
import os
import re
import sys
import traceback
from pathlib import Path

# 이 저장소를 알아보는 표지. main checkout 과 워크트리 모두 루트에 있다.
# 미러 도구를 옮기거나 이름을 바꾸면 이 훅이 조용히 꺼진다(fail-open). 그래서
# `test_guard_nerv_owned_paths.py` 가 실제 저장소에 이 파일이 있는지 본다.
MARKER = Path(".claude", "tools", "nerv-mirror", "pull.py")
OWNED_ROOTS = {
    "spec": "스펙은 NERV 가 정본이다. `/nerv:spec edit <KEY>` 로 초안을 쓰고, 미러는 "
            "`python3 .claude/tools/nerv-mirror/pull.py --task <CLE-T-…>` 로 갱신한다. "
            "옛 경로의 NERV 키는 미러 frontmatter `source_paths` 로 찾는다. 옛 문서 하나가 "
            "여러 키로 나뉘었을 수 있다(`grep -rl '<옛 경로>' spec/CLE-*`)",
    "review": "리뷰 결과는 NERV 레코드다. 역할마다 `nerv_review_submit` 으로 제출하고 발견은 "
              "`nerv_finding_resolve` 로 처분한다. 오케스트레이터 산출물(리포트 · SUMMARY)은 "
              "gitignore 대상 `.review/` 에 쓴다. 옛 `review/` 는 단계 3 에서 지웠다(원문은 git 이력)",
    "plan": "작업 추적은 NERV Task 다. `/nerv:next` 로 클레임하고 진행은 `nerv_task_heartbeat` "
            "(progress) · 릴리스 `state_note` 로 남긴다. 새 작업은 `nerv_task_create` 로 만든다. "
            "옛 `plan/` 은 단계 3 에서 지웠다(원문은 git 이력)",
}
# 짝 없는 서로게이트. 하네스(Node)는 이 문자를 U+FFFD 로 바꿔 쓴다. Python 은 이 문자가 든 경로를
# 파일 시스템에 넘기지 못한다(`UnicodeEncodeError`). 그대로 두면 그 예외가 fail-open 으로 통과한다.
_LONE_SURROGATE = re.compile("[\ud800-\udfff]")


def _read_payload() -> dict:
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return payload if isinstance(payload, dict) else {}


def _target(payload: dict) -> Path | None:
    """편집 대상 경로(`realpath`). 모양이 틀리면 None — 하네스가 보내지 않는 페이로드다."""
    # 키 집합은 형제 훅(`guard_default_branch_edit` · `lint_mermaid_posttooluse`)과 같다. Write ·
    # Edit · MultiEdit 는 `file_path`, NotebookEdit 는 `notebook_path` 를 쓴다. `path` · `input` 은
    # 형제 훅과 맞추려고 받는다. 받는 키가 늘면 막는 쪽으로만 넓어진다.
    tool_input = payload.get("tool_input") or payload.get("input") or {}
    if not isinstance(tool_input, dict):
        return None
    value = tool_input.get("file_path") or tool_input.get("path") or tool_input.get("notebook_path")
    if not isinstance(value, str) or not value or "\x00" in value:
        return None
    path = Path(_LONE_SURROGATE.sub("\ufffd", value))
    if not path.is_absolute():
        cwd = payload.get("cwd")
        base = cwd if isinstance(cwd, str) and cwd else os.getcwd()
        path = Path(_LONE_SURROGATE.sub("\ufffd", base)) / path
    return Path(os.path.realpath(path))


def _checkout_root(path: Path) -> Path | None:
    """``path`` 를 담은 git 체크아웃 루트. 없으면 None."""
    for parent in [path, *path.parents]:
        if (parent / ".git").exists():
            return parent
    return None


def _owned_root(path: Path) -> str | None:
    """``path`` 가 이 저장소의 NERV 소유 경로면 그 첫 경로 조각(예: `spec`), 아니면 None.

    ``path`` 는 `realpath` 로 푼 절대 경로다. 루트는 ``path`` 의 조상이라 상대 경로가 항상 나온다.
    """
    root = _checkout_root(path)
    if root is None or not (root / MARKER).is_file():
        return None
    parts = path.relative_to(root).parts
    first = parts[0].casefold() if parts else ""
    return first if first in OWNED_ROOTS else None


def main() -> int:
    if os.environ.get("BYPASS_NERV_OWNED_PATHS") == "1":
        return 0
    payload = _read_payload()
    target = _target(payload)
    if target is None:
        return 0
    owned = _owned_root(target)
    if owned is None:
        return 0
    print(
        "BLOCKED by .claude/hooks/guard_nerv_owned_paths.py\n"
        f"  attempted: {payload.get('tool_name') or '(tool)'} on {target}\n"
        f"  reason:    `{owned}/` 는 NERV 가 정본이라 도구로 고치지 않는다.\n"
        f"  instead:   {OWNED_ROOTS[owned]}.\n"
        "One-off override: BYPASS_NERV_OWNED_PATHS=1",
        file=sys.stderr,
    )
    return 2


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:  # noqa: BLE001 — 훅은 세션을 깨지 않는다
        traceback.print_exc(file=sys.stderr)
        sys.exit(0)
