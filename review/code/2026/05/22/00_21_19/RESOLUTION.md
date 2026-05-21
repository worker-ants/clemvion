# RESOLUTION — 00_21_19

Session: `review/code/2026/05/22/00_21_19`
Branch: `claude/llm-retry-after-a24e5e`
Date: 2026-05-22

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| W1 | 코드 | 707b19fc | `toHaveBeenCalledWith` → `toHaveBeenNthCalledWith(1, ...)` 3건 |
| W2 | 코드 | (보류) | cap 경계값(59s/60s) 테스트 추가 — 후속 plan 으로 추적 |
| W3 | 코드 | (보류) | `'rate limit'` 문자열 분기 테스트 케이스 추가 — 후속 plan |
| W4 | 코드 | (보류) | max-retry 소진 / non-429 즉시 throw 경로 테스트 — 후속 plan |
| W5 | 코드 | (보류) | `handleClickOutside` → `closeNotif` 필터 리셋 테스트 — 후속 plan |
| W6 | 코드 | 707b19fc | `toggleNotif` updater 에서 `setNotifFilter` 분리; `notifOpen` deps 추가 |
| W7 | 코드 | 707b19fc | `useEffect` handleClickOutside deps 에 `closeNotif` 추가 |
| W8 | 코드 | (보류) | 픽스처 중복 추출 (`retryConfig` / `successResponse`) — 후속 plan |
| W9 | 문서 | 707b19fc | `plan/in-progress/llm-retry-after.md` §ISSUE FIX 섹션 추가 |

## TEST 결과

- lint  : 통과
- unit  : 통과 (4293 passed)
- e2e   : 통과 (98/98)

## 보류·후속 항목

W2, W3, W4, W5, W8 은 테스트 커버리지 확장 항목으로 이번 closeout PR 범위를 벗어난다. 후속 plan (`plan/in-progress/llm-retry-after-test-coverage.md` 등) 에서 추적 권장.

- **W2** (경계값): `Retry-After: '59'` → 59_000ms 미 cap, `Retry-After: '60'` → 60_000ms 경계 테스트
- **W3** ('rate limit' 문자열): 429 코드 없이 메시지로만 rate-limit 을 알리는 에러 케이스
- **W4** (max-retry 소진): `attempt === maxRetries` 에서 최종 throw, non-429 에러 즉시 전파
- **W5** (sidebar 외부 클릭): `fireEvent.mouseDown(document.body)` → popover 닫힘 → 필터 "all" 리셋 확인
- **W8** (픽스처 중복): `describe('Retry-After header behavior')` 의 `config`/`params`/`successResponse` 공통 상수화
