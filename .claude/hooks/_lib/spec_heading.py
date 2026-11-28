"""스펙 본문에서 날짜가 붙은 제목을 찾는다(규약 CLE-ENG-SPECHEADING 규칙 1, NERV Task `CLE-T-6YGW3B`).

판정은 여기 한 곳에만 둔다. 쓰는 곳은 초안 저장 훅 `guard_spec_heading_date.py` 다.

날짜 제목: ATX 제목 줄(줄 앞 공백 0~3칸 뒤 `#` 1~6개와 공백)의 문구에 `YYYY-MM-DD` 꼴 날짜가 있는 것.
괄호 표기 `(2026-10-18)` 도 같다. 숫자가 앞뒤로 이어지면(`12026-10-180`) 날짜로 보지 않는다.

날짜 제목으로 세지 않는 것:
- 코드 블록(``` 또는 ~~~ 울타리) 안의 `#` 줄. 예제 · 셸 주석이다. 백틱 울타리 뒤 info 문자열에 백틱이
  있으면 울타리가 아니다(CommonMark).
- 제목 아래 본문 줄 `결정일: YYYY-MM-DD`. 규칙 2 가 정한 자리다.
- setext 제목(밑줄 `===` · `---`). 스펙 문서는 ATX 제목만 쓴다.

닫히지 않은 울타리: CommonMark 로는 문서 끝까지 코드 블록이지만 여기서는 울타리 뒤의 날짜 제목을 센다.
실수로 연 ``` 하나가 뒤쪽 제목을 모두 검사 밖으로 빼지 않게 하려는 것이다. 미러 기준도 같은 함수로 세므로
기존 문서의 래칫은 어긋나지 않는다.

울타리 · ATX 제목 판정은 `_lib/md_lines.py` 에 있고 미러 앵커 래칫(`anchor_check.py`)과 함께 쓴다. 이 모듈은
`unclosed_hides_rest=False` 로 부른다. 날짜는 닫는 `#` 열을 뗀 제목 문구에서 찾는다. 닫는 `#` 열에는 숫자가
없으니 떼기 전 줄에서 찾던 때와 결과가 같다.

날짜가 제목 이름의 일부인 경우(예: 날짜로 이름 붙인 외부 API 버전)도 날짜 제목으로 센다. 훅이 문서마다
기존 수를 기준으로 삼으므로(래칫) 이미 있는 제목은 막히지 않고, 새로 쓰는 제목은 규칙 1 을 따른다.
"""

from __future__ import annotations

import re

from _lib.md_lines import ATX_HEADING, lines_outside_fences

_DATE = re.compile(r"(?<!\d)\d{4}-\d{2}-\d{2}(?!\d)")


def date_headings(body: str) -> list[str]:
    """본문의 날짜 제목 줄을 나온 순서대로(앞뒤 공백을 뗀 줄). 닫히지 않은 울타리 안의 줄은 끝에 붙는다."""
    return [line.strip() for _, line in lines_outside_fences(body, unclosed_hides_rest=False)
            if _is_date_heading(line)]


def _is_date_heading(line: str) -> bool:
    h = ATX_HEADING.match(line)
    return bool(h and _DATE.search(h.group("text") or ""))


def strip_frontmatter(text: str) -> str:
    """미러 파일(`spec/**/<KEY>.md`)의 frontmatter 를 뗀 본문. frontmatter 가 없으면 그대로."""
    if not text.startswith("---\n"):
        return text
    end = text.find("\n---\n", 4)
    return text if end < 0 else text[end + 5:]
