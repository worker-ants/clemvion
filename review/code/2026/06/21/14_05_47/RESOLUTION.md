# RESOLUTION — refactor M-9 (extractRetryAfterMs 이동) ai-review 후속

원본 SUMMARY: `SUMMARY.md` (위험도 LOW, Critical 0 / Warning 1 / INFO 5).

## 조치 항목

| SUMMARY # | 분류 | 조치 |
|---|---|---|
| W1 (유지보수성 — `handleAiMessageTurn` ~345줄) | 범위 밖 (미조치) | **M-9 가 도입/변경한 코드 아님** — `ai-turn-orchestrator.service.ts` 의 기존 god-method 로, M-9 는 본 파일에서 import 1줄만 교체했다. 리뷰어도 "이번 PR 범위 밖의 기존 코드 문제 … 별도 이슈 추적" 으로 명시. 02-architecture 별 항목(엔진 분할 계열)에서 다룰 사안 |

## 후속 후보 (INFO — 비차단)

| SUMMARY # | 사유 |
|---|---|
| I1 (`isLlmRateLimit` 잔류) | `extractRetryAfterMs` 와 쌍이나 M-9 의 명시 대상은 `extractRetryAfterMs` 단일(plan M-9). `isLlmRateLimit` 도 `shared/utils/` 로 이동하는 건 후속 cleanup 후보 — 범위 확대 회피 |
| I2 (헤더 case 3종 수동 열거) | 이관 전 코드의 기존 동작 보존(byte-identical move). `toLowerCase()` 탐색 전환은 동작 변경이라 별도 |
| I3 (HTTP-date 테스트 ±500ms) | 기존 테스트 패턴 그대로 이관. 현 CI 에서 무결. fakeTimers 전환은 낮은 우선순위 |
| I4 (array 헤더 값 테스트 부재) | 이관 전에도 부재했던 케이스. 동작은 `typeof !== 'string' && !== 'number' → null` 로 커버됨(소스 주석) |
| I5 (`execution-engine.service.ts:62` 주석 언급) | 순수 historical 주석(C-1 step2 추출 기록) — import/사용 없음, 함수는 여전히 존재(위치만 이동)하므로 오해 소지 낮아 유지 |

## TEST 결과

- **lint**: 통과 (0 errors; `--fix` 는 변경 2개 핸들러 파일에만 한정)
- **unit**: 통과 (backend+frontend; retry-after.spec 이관분 + 4 importer 포함 9 suites 239 tests)
- **build**: 통과
- **e2e**: 통과 (`make e2e-test` 205 tests)

## 보류·후속 항목

- I1(`isLlmRateLimit` 이동) 은 동종 cleanup 후속 후보 (별도 plan 신설은 사용자 판단).
