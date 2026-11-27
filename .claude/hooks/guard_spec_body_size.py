#!/usr/bin/env python3
"""PreToolUse hook — 본문이 한도(20,000자)를 넘는 NERV 스펙 초안 저장을 막는다.

Registered in `.claude/settings.json` for the NERV draft tool
(`mcp__nerv__nerv_spec_draft_upsert` · `mcp__plugin_nerv_nerv__nerv_spec_draft_upsert`).
exit 0 → 허용, exit 2 → 차단(stderr 가 이유), 그 밖 → 런타임 오류로 보고 허용(fail-open).

한도의 근거와 나누는 방법은 `project-planner` SKILL 「문서 크기 한도」가 정본이다. 글자수는 Python
`len(str)`(코드 포인트 수)이고 frontmatter 없는 본문만 센다. 한도 값은 `_lib/spec_size.py`
한 곳에 두고 미러 검사(`.claude/tools/nerv-mirror/size_check.py`)도 거기서 가져온다.

막지 않는 것:
- 카탈로그 사본(`CLE-C24-*` · `CLE-MKS-*`). codebase 정본에서 생성하므로 크기는 생성기가 정한다.
  같은 접두의 NERV 정본 규약 문서는 막는다(`_lib/spec_size.py` 의 `NOT_EXEMPT_KEYS` 와 그 설명).
  키는 `spec_id`(기존 문서) 또는 `key`(새 문서)로 본다. UUID 로 부른 카탈로그 문서는 가려내지 못해
  한도를 적용한다(카탈로그 사본은 `codebase/api-catalogs/README.md` 절차가 키로 저장한다).
- 본문이 없는 호출(되돌리기 `revert_to_version`, 메타만 고치는 호출).

이 훅은 에이전트의 MCP 호출만 본다. 사람이 웹에서 쓴 초안과 다른 경로로 저장한 초안은 CI 미러 검사
(`size_check.py`)가 미러를 받을 때 잡는다. 미러에 오지 않는 `NOT_EXEMPT_KEYS` 문서는 예외다. 그 문서를
훅 밖에서 저장하면 아무 검사도 잡지 못한다.

일회성 우회: `BYPASS_SPEC_SIZE_GUARD=1`.
"""

from __future__ import annotations

import os
import sys
import traceback

THIS_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, THIS_DIR)
from _lib.hook_input import read_payload  # noqa: E402
from _lib.spec_draft import META_FIELDS, body_of, draft_key, tool_input_of  # noqa: E402,F401  (META_FIELDS: 테스트가 본다)
from _lib.spec_size import LIMIT, TARGET, is_exempt  # noqa: E402


def main() -> int:
    if os.environ.get("BYPASS_SPEC_SIZE_GUARD") == "1":
        return 0
    payload = read_payload()
    tool_input = tool_input_of(payload)
    if tool_input is None:
        return 0
    body = body_of(tool_input)
    if body is None:
        return 0
    key = draft_key(tool_input)
    if is_exempt(key):
        return 0
    size = len(body)
    if size <= LIMIT:
        return 0
    print(
        "BLOCKED by .claude/hooks/guard_spec_body_size.py\n"
        f"  attempted: {payload.get('tool_name') or '(tool)'} on {key or '(new spec)'}\n"
        f"  reason:    본문 {size:,}자가 스펙 문서 한도 {LIMIT:,}자를 넘는다(목표 {TARGET:,}자 이하).\n"
        "  instead:   중복 · 작업 이력 서술을 걷어내고, 그래도 넘치면 주제별 하위 문서로 나눈다.\n"
        "             방법은 `.claude/skills/project-planner/SKILL.md` 「문서 크기 한도」.\n"
        "One-off override: BYPASS_SPEC_SIZE_GUARD=1",
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
