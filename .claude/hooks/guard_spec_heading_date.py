#!/usr/bin/env python3
"""PreToolUse hook — 날짜가 붙은 제목이 새로 생기는 NERV 스펙 초안 저장을 막는다.

Registered in `.claude/settings.json` for the NERV draft tool
(`mcp__nerv__nerv_spec_draft_upsert` · `mcp__plugin_nerv_nerv__nerv_spec_draft_upsert`).
exit 0 → 허용, exit 2 → 차단(stderr 가 이유), 그 밖 → 런타임 오류로 보고 허용(fail-open).

규칙의 정본은 규약 CLE-ENG-SPECHEADING 규칙 1 · 2 다(제목에 날짜를 넣지 않고 날짜는 제목 아래 첫 줄
`결정일: YYYY-MM-DD` 에 적는다). 날짜 제목 판정은 `_lib/spec_heading.py` 한 곳에 둔다(NERV Task
`CLE-T-6YGW3B`).

판정(래칫): 초안 본문의 날짜 제목 수가 기준보다 많으면 막는다. 기존 날짜 제목을 그대로 두거나 줄이는
초안은 통과한다. 날짜 제목은 문서마다 영역 Task 가 옮겨 가는 중이라(2026-11-27 미러 201편 · 551개)
전부 막으면 거의 모든 초안 저장이 막힌다.
- 기존 문서(`spec_id` 가 키): 기준은 같은 문서 미러 `spec/**/<KEY>.md` 의 날짜 제목 수다.
- 새 문서(`spec_id` 없음): 기준은 0 이다. 다만 `key` 가 미러에 있는 문서를 가리키면(이미 있는 문서를
  `spec_id` 없이 다시 저장하는 호출) 그 미러가 기준이다.

막지 않는 것(기준을 알 수 없어 통과한다):
- `spec_id` 가 UUID 이거나 미러에 없는 문서(카탈로그 사본 · 미러를 받기 전에 만든 문서).
- 본문이 없는 호출(되돌리기 `revert_to_version`, 메타만 고치는 호출).

미러는 구현 세션이 받은 버전의 스냅샷이라 NERV 최신 승인본보다 낡을 수 있다. 승인본에 날짜 제목이
더 생겼는데 미러가 그 전 버전이면 그 제목을 그대로 둔 초안도 막힌다. 그때는 `pull.py` 로 미러를 받거나
아래 우회를 쓴다. 이 훅은 에이전트의 MCP 호출만 본다. 사람이 웹에서 쓴 초안은 초안 검토가 본다.

일회성 우회: `BYPASS_SPEC_HEADING_GUARD=1`.
"""

from __future__ import annotations

import os
import re
import sys
import traceback
from pathlib import Path

THIS_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, THIS_DIR)
from _lib.hook_input import read_payload  # noqa: E402
from _lib.spec_draft import body_of, draft_key, tool_input_of  # noqa: E402
from _lib.spec_heading import date_headings, strip_frontmatter  # noqa: E402

_SPEC_KEY = re.compile(r"^CLE-[A-Z0-9]+(?:-[A-Z0-9]+)*$")
MAX_LISTED = 5


def _repo_root() -> Path:
    env = os.environ.get("CLAUDE_PROJECT_DIR")
    return Path(env) if env else Path(THIS_DIR).parents[1]


def _mirror_headings(key: str, root: Path) -> list[str] | None:
    """미러 `spec/**/<KEY>.md` 의 날짜 제목. 키 꼴이 아니거나 미러가 없으면 None.

    같은 키의 미러가 여러 곳에 있으면(옮기다 남은 사본) 경로 순서로 첫 파일을 본다."""
    if not _SPEC_KEY.match(key):
        return None
    matches = sorted((root / "spec").rglob(f"{key}.md"))
    if not matches:
        return None
    return date_headings(strip_frontmatter(matches[0].read_text(encoding="utf-8")))


def baseline_headings(tool_input: dict, root: Path) -> list[str] | None:
    """기준이 되는 날짜 제목 목록. 새 문서면 []. 기준을 알 수 없으면 None(통과)."""
    spec_id = tool_input.get("spec_id")
    if isinstance(spec_id, str) and spec_id:
        return _mirror_headings(spec_id, root)
    key = tool_input.get("key")
    if isinstance(key, str) and key:
        found = _mirror_headings(key, root)
        if found is not None:
            return found
    return []


def main() -> int:
    if os.environ.get("BYPASS_SPEC_HEADING_GUARD") == "1":
        return 0
    payload = read_payload()
    tool_input = tool_input_of(payload)
    if tool_input is None:
        return 0
    body = body_of(tool_input)
    if body is None:
        return 0
    base = baseline_headings(tool_input, _repo_root())
    if base is None:
        return 0
    now = date_headings(body)
    if len(now) <= len(base):
        return 0
    added = [h for h in now if h not in base] or now
    listed = "\n".join(f"             {h}" for h in added[:MAX_LISTED])
    more = f"\n             … 외 {len(added) - MAX_LISTED}개" if len(added) > MAX_LISTED else ""
    key = draft_key(tool_input) or "(new spec)"
    print(
        "BLOCKED by .claude/hooks/guard_spec_heading_date.py\n"
        f"  attempted: {payload.get('tool_name') or '(tool)'} on {key}\n"
        f"  reason:    날짜가 붙은 제목이 {len(base)}개에서 {len(now)}개로 늘었다(CLE-ENG-SPECHEADING 규칙 1).\n"
        f"  new:\n{listed}{more}\n"
        "  instead:   제목에서 날짜를 빼고 제목 바로 아래 첫 줄에 `결정일: YYYY-MM-DD` 로 적는다(규칙 2).\n"
        "             기준은 미러 `spec/**/<KEY>.md` 다. 미러가 낡았으면 `.claude/tools/nerv-mirror/pull.py` 로 받는다.\n"
        "One-off override: BYPASS_SPEC_HEADING_GUARD=1",
        file=sys.stderr,
    )
    return 2


if __name__ == "__main__":
    try:
        sys.exit(main())
    except SystemExit:
        raise
    except Exception:  # fail-open: 훅 오류로 저장을 막지 않는다
        traceback.print_exc(file=sys.stderr)
        sys.exit(0)
