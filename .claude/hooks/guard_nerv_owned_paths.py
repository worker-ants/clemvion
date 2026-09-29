#!/usr/bin/env python3
"""PreToolUse hook — NERV 가 정본인 경로의 도구 편집을 막는다.

Registered in `.claude/settings.json` for `Write|Edit|MultiEdit|NotebookEdit`.
exit 0 → 허용, exit 2 → 차단(stderr 가 이유), 그 밖 → 런타임 오류로 보고 허용(fail-open).

NERV 정본 전환 단계 1(NERV Task `CLE-T-VA4YA1`)부터 스펙의 정본은 NERV 다. 저장소 `spec/`
의 미러는 `.claude/tools/nerv-mirror/pull.py` 만 쓴다(도구 호출이 아니라 파일을 직접 쓰므로
이 훅에 걸리지 않는다). 옛 `spec/<영역>/` 트리도 이 시점부터 동결된다.

막는 경로는 전환 단계를 따라 는다. 거버넌스 문서가 그 경로의 쓰기를 더는 안내하지 않을 때
더한다 — 먼저 막으면 문서가 시키는 일을 훅이 막는다.
- `spec/` — 단계 1(지금).
- `review/` — 단계 2(리뷰 전환: 리뷰 결과를 NERV 레코드로 낸다).
- `plan/` — 단계 3(plan 제거: 작업은 NERV Task 로 추적한다).

판정은 **대상 파일이 속한 체크아웃 루트 기준 상대 경로**다. main checkout 이든 워크트리든
`<루트>/spec/…` 이면 막는다. 루트는 대상 경로에서 위로 올라가며 처음 만나는
`.git`(디렉터리 또는 워크트리의 파일)이다. git 체크아웃 밖(scratchpad 등)은 대상이 아니다.

셸 편집(`sed -i`, 리다이렉트)은 이 훅이 보지 못한다. 그 구멍은 CI `spec-mirror-integrity`
(`pull.py --check`)가 막는다.

일회성 우회: `BYPASS_NERV_OWNED_PATHS=1`.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

OWNED_ROOTS = {
    "spec": "스펙은 NERV 가 정본이다. `/nerv:spec edit <KEY>` 로 초안을 쓰고, 미러는 "
            "`python3 .claude/tools/nerv-mirror/pull.py --task <CLE-T-…>` 로 갱신한다",
}


def _read_payload() -> dict:
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}


def _target(payload: dict) -> Path | None:
    tool_input = payload.get("tool_input") or payload.get("input") or {}
    value = (tool_input.get("file_path") or tool_input.get("path")
             or tool_input.get("notebook_path"))
    if not value:
        return None
    path = Path(value)
    if not path.is_absolute():
        path = Path(payload.get("cwd") or os.getcwd()) / path
    return Path(os.path.normpath(str(path)))


def checkout_root(path: Path) -> Path | None:
    """``path`` 를 담은 git 체크아웃 루트. 없으면 None."""
    for parent in [path, *path.parents]:
        if (parent / ".git").exists():
            return parent
    return None


def owned_root(path: Path) -> str | None:
    """``path`` 가 NERV 소유 경로면 그 첫 경로 조각(예: `spec`), 아니면 None."""
    root = checkout_root(path)
    if root is None:
        return None
    try:
        rel = path.relative_to(root)
    except ValueError:
        return None
    first = rel.parts[0] if rel.parts else ""
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
