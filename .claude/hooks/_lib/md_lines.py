"""스펙 본문 마크다운의 줄 단위 판정: 코드 블록 울타리와 ATX 제목(NERV Task `CLE-T-NN0DVE`).

쓰는 곳은 둘이다. 초안 저장 훅의 날짜 제목 판정(`_lib/spec_heading.py`)과 미러 앵커 래칫
(`.claude/tools/nerv-mirror/anchor_check.py`)이다. 두 곳이 같은 규칙을 따로 구현하던 것을 여기로 모았다.

울타리(CommonMark 를 줄 단위로 옮겼다):
- 여는 울타리는 줄 앞 공백 0~3칸 뒤 ``` 이나 ~~~ 가 3개 이상인 줄이다. 백틱 울타리 뒤 info 문자열에 백틱이
  있으면 울타리가 아니다. 4칸 이상 들여 쓴 줄은 울타리가 아니다.
- 닫는 울타리는 여는 것과 같은 문자로 여는 것 이상 길이이고 뒤에 공백만 온다.
- 울타리 줄 자체는 내보내지 않는다.

닫히지 않은 울타리는 쓰는 곳마다 정책이 다르다. `unclosed_hides_rest` 로 고른다.
- True: CommonMark 대로 문서 끝까지 코드 블록이다. 렌더러가 그 뒤를 제목으로 만들지 않으므로 앵커도 없다
  (`anchor_check.py`).
- False: 그 울타리 안의 줄을 문서 끝에서 울타리 밖 줄로 다시 내보낸다. 실수로 연 ``` 하나가 뒤쪽 날짜 제목을
  모두 검사 밖으로 빼지 않게 하려는 것이다(`spec_heading.py`). 다시 내보낸 줄 안의 울타리 꼴 줄은 다시 판정하지
  않고 그대로 내보낸다.

ATX 제목: 줄 앞 공백 0~3칸 뒤 `#` 1~6개, 그 뒤가 줄 끝이거나 공백이다. 문구(`text`)는 앞뒤 공백과 닫는 `#`
열(앞에 공백이 있는 `#` 만의 꼬리)을 뗀 것이고 `#` 만 있는 줄은 None 이다. setext 제목(밑줄 `===` · `---`)은
세지 않는다. 스펙 문서는 ATX 제목만 쓴다.

표준 라이브러리만 쓴다. CI `spec-mirror-integrity` 잡은 sparse checkout 으로 이 폴더(`.claude/hooks/_lib`)를 받는다.
"""

from __future__ import annotations

import re
from collections.abc import Iterator

ATX_HEADING = re.compile(r"^ {0,3}#{1,6}(?:[ \t]+(?P<text>.*?))?(?:[ \t]+#+)?[ \t]*$")
FENCE = re.compile(r"^ {0,3}(?P<fence>`{3,}|~{3,})")


def _closes(line: str, m: re.Match[str] | None, fence: str) -> bool:
    if not m:
        return False
    run = m.group("fence")
    return run[0] == fence[0] and len(run) >= len(fence) and not line.strip()[len(run):].strip()


def _opens(line: str, m: re.Match[str] | None) -> bool:
    return bool(m) and not (m.group("fence")[0] == "`" and "`" in line[m.end():])


def lines_outside_fences(body: str, *, unclosed_hides_rest: bool) -> Iterator[tuple[int, str]]:
    """(본문 줄 번호, 줄) — 코드 블록 울타리와 그 안의 줄은 뺀다. 줄 번호는 1부터다.

    닫히지 않은 울타리 안의 줄은 `unclosed_hides_rest` 가 False 일 때만 문서 끝에서 원래 순서로 내보낸다.
    """
    fence: str | None = None
    inside: list[tuple[int, str]] = []
    for no, line in enumerate(body.splitlines(), 1):
        m = FENCE.match(line)
        if fence is not None:
            if _closes(line, m, fence):
                fence, inside = None, []
            else:
                inside.append((no, line))
            continue
        if _opens(line, m):
            fence = m.group("fence")
            continue
        yield no, line
    if fence is not None and not unclosed_hides_rest:
        yield from inside
