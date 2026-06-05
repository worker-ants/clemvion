# RESOLUTION — B3 O(n) 증분 코드리뷰

대상: review/code/2026/06/05/11_46_54/SUMMARY.md (4 reviewer, Critical 0, BLOCK:NO).

## 조치
| 발견 | 조치 |
|---|---|
| maintainability W — cut/remainingCount 변수 중복·네이밍 충돌 | `cutIdx` 단일 인덱스로 통일, while 조건 `uncompressed.length - cutIdx > MIN_RECENT_RAW_TURNS`, `remainingCount` 제거 |
| testing/maintainability INFO — 오라클 MIN_RECENT_RAW_TURNS 하드코딩 `2` drift | `MIN_RECENT_RAW_TURNS` export + 테스트가 import 해 사용(하드코딩 제거) |

## 보류 (경미, 백로그)
- testing INFO: runningSummary≠undefined sweep 케이스, `budget==currentTokens` 정확경계 단언 — 수학적 동치는 값 무관 성립이라 현 회귀핀으로 충분.
- maintainability INFO: 블록주석 2단락 분리, O(n) bound 의 renderThreadAsSystemText 의존 주석.

## TEST 결과 (maintainability fix 후 재수행, 전부 PASS)
- lint: PASS (lint-20260605-120635)
- unit: PASS — backend 6120+ / frontend 전체 GREEN, agent-memory-injection 31/31 (unit-20260605-120708)
- build: PASS (build-20260605-120743)
- e2e: PASS — 168 (docker, b3_e2e2)
