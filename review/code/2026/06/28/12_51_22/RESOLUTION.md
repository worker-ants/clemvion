# RESOLUTION — 12_51_22

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #1 (WARNING) | 코드(문서) | (후속 커밋) | 429 행에 `Retry-After` 헤더 안내 추가 — spec `5-system/2-api-convention.md §7`("Rate Limit 초과 시 429 + Retry-After 헤더")와 정합. scope("instance-wide global")는 직전 커밋(34ce270e0)에서 이미 반영. KO/EN parity. |

## TEST 결과

- doc guard (`pnpm --filter frontend test -- triggers-coverage i18n docs`): 통과 (237 files / 4753 tests)
- lint/unit/build/e2e: 코드 변경 없음(MDX 문서 전용) — 화이트리스트 면제

## 보류·후속 항목 (non-blocking INFO)

- INFO #4 (`PUBLIC_WEBHOOK_BODY_TOO_LARGE` 에러 봉투 스키마 문서화): API 에러 봉투 일반 규약 문서의 영역. 본 trigger 페이지 범위 외 — 별도 패스에서 에러 코드 목록 동기화 시 처리.
- INFO #2/#3: 인증 1MB 게이트(`spec-sync-webhook-gaps.md`) / inbound rate-limit 60건/분(`spec-sync-external-interaction-api-gaps.md`) 구현 시 문서·수치 재검토 — 기존 plan 추적 중.
- INFO #6 (CHANGELOG): 본 PR 은 코드·spec 이 이미 확정한 상태의 문서 보정 — 동작 변경 없음, CHANGELOG 불필요.

## 수렴 판정

requirement reviewer 가 3개 라운드 연속 "모든 변경 spec SoT line-level 정합 (NONE risk)" 확인. 0 Critical 지속. 잔여 WARNING 은 선택적 문서 폴리시였고 본 라운드에서 spec-grounded 하게 해소. 나머지는 본 페이지 범위 외 INFO 로, 추가 라운드 없이 수렴.
