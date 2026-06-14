# Code Review 통합 보고서 (fresh — W-3 rename + W-2 큐 모니터링 등재)

리뷰 범위: `3064c9c6..HEAD` (W-3 `RECONCILE_TERMINAL_STATUSES` rename, W-2 `system-status.constants`/e2e/0-overview 큐 등재, EIA R15 부팅정책 note).

## 전체 위험도
**LOW** — **Critical 0 · Warning 0**. 발견 전부 INFO. 즉각 수정 필요 항목 없음.

## Critical
없음.

## 경고 (WARNING)
없음.

## 참고 (INFO) — 처리
| # | 카테고리 | 발견 | 처리 |
|---|----------|------|------|
| 1 | SPEC-DRIFT | `terminal-revoke-reconcile` 큐가 `0-overview §4`·`16-system-status-api.md §1` 미등재 | `0-overview §4` 는 **본 PR 에서 추가됨**(L203). `16-system-status-api.md §1` 레지스트리 추가는 **후속 doc-sync**(INFO, 비차단). |
| 2 | SPEC-DRIFT | 코드 주석의 `EIA-RL-06`/`R15` 가 spec 본문에 부재(reviewer 추정) | **오확인** — spec 은 §3.4 `EIA-RL-06` 행·§Rationale R14/R15/R16 정의(커밋 5d5dfe18~). `--impl-done`(16_43_08, spec 본문 적재) BLOCK:NO 로 정합 입증. |
| 3 | 아키텍처 | 큐 상수를 `.service.ts` 에서 직접 import (types 파일 분리 관례와 일부 불일치) | login-history-pruner·notification-secret-rotator 등 형제도 `.service.ts` 에서 import — **established pattern**. types 분리는 선택 후속. |
| 4 | 유지보수성 | MONITORED_QUEUES 신규 항목 멀티행 형식 | Prettier 출력. 무관. |
| 5~9 | 테스트 | 다중 청크 집계·하한 clamp·만료토큰 delete 단언·job opts age 단언 갭(선택) | 핵심 경로 커버됨. **선택 보강** — 비차단. |
| 10 | 보안(선존) | JWT fallback secret 하드코딩 | **선존** — prod fail-closed. 본 diff 무관. 보안 백로그. |
| 11 | 아키텍처(선존) | DIP 구체 클래스 직접 주입 | 현 규모 허용. |

## 에이전트별 위험도
security/performance/requirement/scope/side_effect/documentation/dependency/database/concurrency/api_contract/user_guide_sync = **NONE**; architecture/maintainability/testing = **LOW**.

**판정: RISK LOW · Critical 0 · Warning 0 — 클린 리뷰.** push 가드 SUMMARY-only 통과 조건 충족(RESOLUTION 불요). INFO SPEC-DRIFT(16-system-status-api §1)·테스트 선택 보강은 비차단 후속.
