"""스펙 본문에서 날짜가 붙은 제목을 찾는다(규약 CLE-ENG-SPECHEADING 규칙 1, NERV Task `CLE-T-6YGW3B`).

판정은 여기 한 곳에만 둔다. 쓰는 곳은 초안 저장 훅 `guard_spec_heading_date.py` 다.

날짜 제목: ATX 제목 줄(줄 앞 공백 0~3칸 뒤 `#` 1~6개와 공백)의 문구에 `YYYY-MM-DD` 꼴 날짜가 있는 것.
괄호 표기 `(2026-10-18)` 도 같다. 숫자가 앞뒤로 이어지면(`12026-10-180`) 날짜로 보지 않는다.

날짜 제목으로 세지 않는 것:
- 코드 블록(``` 또는 ~~~ 울타리) 안의 `#` 줄. 예제 · 셸 주석이다.
- 제목 아래 본문 줄 `결정일: YYYY-MM-DD`. 규칙 2 가 정한 자리다.
- setext 제목(밑줄 `===` · `---`). 스펙 문서는 ATX 제목만 쓴다.

날짜가 제목 이름의 일부인 경우(예: 날짜로 이름 붙인 외부 API 버전)도 날짜 제목으로 센다. 훅이 문서마다
기존 수를 기준으로 삼으므로(래칫) 이미 있는 제목은 막히지 않고, 새로 쓰는 제목은 규칙 1 을 따른다.
"""

from __future__ import annotations

import re

_HEADING = re.compile(r"^ {0,3}#{1,6}(?:[ \t]+(?P<text>.*))?$")
_FENCE = re.compile(r"^ {0,3}(?P<fence>`{3,}|~{3,})")
_DATE = re.compile(r"(?<!\d)\d{4}-\d{2}-\d{2}(?!\d)")


def date_headings(body: str) -> list[str]:
    """본문의 날짜 제목 줄을 나온 순서대로(앞뒤 공백을 뗀 줄)."""
    found: list[str] = []
    fence: str | None = None
    for line in body.splitlines():
        m = _FENCE.match(line)
        if fence is not None:
            # 닫는 울타리는 같은 문자로 여는 것 이상 길이이고 뒤에 공백만 온다.
            if m and m.group("fence")[0] == fence[0] and len(m.group("fence")) >= len(fence) \
                    and not line.strip()[len(m.group("fence")):].strip():
                fence = None
            continue
        if m:
            fence = m.group("fence")
            continue
        h = _HEADING.match(line)
        if h and _DATE.search(h.group("text") or ""):
            found.append(line.strip())
    return found


def strip_frontmatter(text: str) -> str:
    """미러 파일(`spec/**/<KEY>.md`)의 frontmatter 를 뗀 본문. frontmatter 가 없으면 그대로."""
    if not text.startswith("---\n"):
        return text
    end = text.find("\n---\n", 4)
    return text if end < 0 else text[end + 5:]
