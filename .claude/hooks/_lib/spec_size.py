"""스펙 문서 본문 크기 정책 상수 — 훅과 미러 검사가 함께 쓴다(NERV Task `CLE-T-H8JK7M`).

정본 서술은 `project-planner` SKILL 「문서 크기 한도」다. 값은 여기 한 곳에만 둔다.
"""

from __future__ import annotations

LIMIT = 20000
TARGET = 18000
# 카탈로그 사본(`CLE-C24-CATALOG` · `CLE-MKS-CATALOG` 와 하위 문서)은 생성기가 크기를 정한다.
EXEMPT_PREFIXES = ("CLE-C24-", "CLE-MKS-")
# 같은 접두를 쓰지만 NERV 가 정본인 규약 문서다(SKILL 「트리 규칙」). 한도를 적용한다.
# 이 문서들은 미러에 오지 않는다(`pull.py` 의 `is_excluded`). 그래서 초안 훅만 막고 CI 미러 래칫
# (`size_check.py`)은 보지 못한다. 훅 · 미러 검사의 docstring 은 이 설명을 가리키기만 한다.
NOT_EXEMPT_KEYS = ("CLE-C24-META", "CLE-C24-SCOPES", "CLE-MKS-META")


def is_exempt(key: str) -> bool:
    """카탈로그 사본이면 True. NERV 정본 규약 문서(`NOT_EXEMPT_KEYS`)는 접두가 같아도 False."""
    return key.startswith(EXEMPT_PREFIXES) and key not in NOT_EXEMPT_KEYS
