#!/usr/bin/env python3
"""PreToolUse hook — NERV 가 정본인 경로의 도구 편집을 막는다.

Registered in `.claude/settings.json` for `Write|Edit|MultiEdit|NotebookEdit`.
exit 0 → 허용, exit 2 → 차단(stderr 가 이유), 그 밖 → 런타임 오류로 보고 허용(fail-open).

등록 명령은 이 파일이 없으면 통과한다(`test ! -f … || python3 …`). 하네스는 훅을
`$CLAUDE_PROJECT_DIR`(main checkout)에서 찾는데, 이 훅을 등록한 `settings.json` 을 읽은 워크트리
세션이 아직 pull 하지 않은 main checkout 을 만나면 python 이 "can't open file" 로 exit 2 를 내
모든 편집이 막힌다. 2026-10-01 이 PR 을 만들던 세션에서 실제로 그렇게 막혔다.

NERV 정본 전환 단계 1(NERV Task `CLE-T-VA4YA1`)부터 스펙의 정본은 NERV 다. 저장소 `spec/`
의 미러는 `.claude/tools/nerv-mirror/pull.py` 만 쓴다(도구 호출이 아니라 파일을 직접 쓰므로
이 훅에 걸리지 않는다). 옛 `spec/<영역>/` 트리도 이 시점부터 동결된다.

막는 경로는 전환 단계에 따라 늘어난다. 거버넌스 문서가 그 경로의 쓰기를 더는 안내하지 않을 때
더한다. 먼저 막으면 문서가 시키는 일을 훅이 막는다.
- `spec/` — 단계 1(지금).
- `review/` — 단계 2(리뷰 전환: 리뷰 결과를 NERV 레코드로 낸다).
- `plan/` — 단계 3(plan 제거: 작업은 NERV Task 로 추적한다).

판정은 **대상 파일이 속한 체크아웃 루트 기준 상대 경로**다. main checkout 이든 워크트리든
`<루트>/spec/…` 이면 막는다. 루트는 대상 경로에서 위로 올라가며 처음 만나는
`.git`(디렉터리 또는 워크트리의 파일)이다. 그 루트에 표지 파일 `MARKER`(미러 도구)가 있어야
이 저장소로 본다. 표지가 없는 다른 git 저장소와 git 체크아웃 밖(scratchpad 등)은 대상이 아니다.
경로는 `realpath` 로 풀고(`..` · 심볼릭 링크), 첫 경로 조각은 대소문자를 무시하고 비교한다.

셸 편집(`sed -i`, 리다이렉트)은 이 훅이 보지 못한다. CI `spec-mirror-integrity`
(`pull.py --check`)가 미러 파일의 손편집(본문 · frontmatter)과 위치 이동을 잡는다. 미러
파일의 추가 · 삭제와 옛 `spec/<영역>/` 트리의 셸 편집은 어느 층도 잡지 않는다.

일회성 우회: `BYPASS_NERV_OWNED_PATHS=1`.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

# 이 저장소를 알아보는 표지. main checkout 과 워크트리 모두 루트에 있다.
MARKER = Path(".claude", "tools", "nerv-mirror", "pull.py")
OWNED_ROOTS = {
    "spec": "스펙은 NERV 가 정본이다. `/nerv:spec edit <KEY>` 로 초안을 쓰고, 미러는 "
            "`python3 .claude/tools/nerv-mirror/pull.py --task <CLE-T-…>` 로 갱신한다",
}


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
    tool_input = payload.get("tool_input") or payload.get("input") or {}
    value = (tool_input.get("file_path") or tool_input.get("path")
             or tool_input.get("notebook_path"))
    if not value:
        return None
    path = Path(value)
    if not path.is_absolute():
        path = Path(payload.get("cwd") or os.getcwd()) / path
    return Path(os.path.realpath(path))


def checkout_root(path: Path) -> Path | None:
    """``path`` 를 담은 git 체크아웃 루트. 없으면 None."""
    for parent in [path, *path.parents]:
        if (parent / ".git").exists():
            return parent
    return None


def owned_root(path: Path) -> str | None:
    """``path`` 가 이 저장소의 NERV 소유 경로면 그 첫 경로 조각(예: `spec`), 아니면 None.

    ``path`` 는 `realpath` 로 푼 절대 경로다. 루트는 ``path`` 의 조상이라 상대 경로가 항상 나온다.
    """
    root = checkout_root(path)
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
    owned = owned_root(target)
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
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(0)
