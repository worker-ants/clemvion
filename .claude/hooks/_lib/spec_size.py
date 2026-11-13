"""스펙 문서 본문 크기 정책 상수 — 훅과 미러 검사가 함께 쓴다(NERV Task `CLE-T-H8JK7M`).

정본 서술은 `project-planner` SKILL 「문서 크기 한도」다. 값은 여기 한 곳에만 둔다.
"""

from __future__ import annotations

LIMIT = 20000
TARGET = 18000
# 카탈로그 사본(`CLE-C24-CATALOG` · `CLE-MKS-CATALOG` 와 하위 문서)은 생성기가 크기를 정한다.
EXEMPT_PREFIXES = ("CLE-C24-", "CLE-MKS-")
