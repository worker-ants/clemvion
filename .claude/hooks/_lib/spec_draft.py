"""NERV 스펙 초안 저장 도구(`nerv_spec_draft_upsert`)의 입력을 읽는 함수 — 초안 훅들이 함께 쓴다.

쓰는 훅: `guard_spec_body_size.py`(본문 크기), `guard_spec_heading_date.py`(날짜 제목).
"""

from __future__ import annotations

BODY_FIELDS = ("body_markdown", "body_md")
# 본문이 아닌 문자열 필드. 알려진 본문 필드가 없을 때 나머지 문자열 중 가장 긴 값을 본문으로 본다.
# 대조할 정본은 NERV MCP 도구 `nerv_spec_draft_upsert` 의 inputSchema 다(ToolSearch 로 받는다).
# 새 메타 필드가 생기면 여기에 더한다. 빠뜨리면 그 필드의 긴 값이 본문으로 잡혀 오차단된다.
# `area` 는 옛 스키마의 필드다. 지금 스키마에는 없지만 남겨도 해가 없다.
META_FIELDS = (
    "spec_id", "key", "parent_id", "base_hash", "change_summary", "title", "type", "area",
    "finding_id", "idempotency_key",
)


def draft_key(tool_input: dict) -> str:
    """`spec_id`(기존 문서) 또는 `key`(새 문서). 둘 다 없으면 빈 문자열."""
    for name in ("spec_id", "key"):
        value = tool_input.get(name)
        if isinstance(value, str) and value:
            return value
    return ""


def body_of(tool_input: dict) -> str | None:
    """저장할 본문. `body_markdown` · `body_md` 중 문자열인 값의 최댓값(둘 다 주면 긴 쪽, 서버가 어느 쪽을 쓰든 막는다).

    둘 다 없으면 메타 필드를 뺀 문자열 필드 중 가장 긴 값을 본문으로 본다(필드 이름을 잘못 짐작해도
    가드가 조용히 꺼지지 않게). 문자열 필드가 없으면 None."""
    bodies = [tool_input.get(f) for f in BODY_FIELDS]
    bodies = [b for b in bodies if isinstance(b, str)]
    if not bodies:
        bodies = [v for k, v in tool_input.items() if k not in META_FIELDS and isinstance(v, str)]
    if not bodies:
        return None
    return max(bodies, key=len)
