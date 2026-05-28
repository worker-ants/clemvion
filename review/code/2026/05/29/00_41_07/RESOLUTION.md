# RESOLUTION — eia-jti-tracking ai-review (2026-05-29 00:41)

대상 SUMMARY: `review/code/2026/05/29/00_41_07/SUMMARY.md`
원 구현 commit: `840db52d` (terminal revoke hoist + 단위 테스트)

## 조치 항목

| SUMMARY # | 카테고리 | 조치 | commit |
|---|---|---|---|
| W1 | 요구사항 | terminal revoke 를 triggerId 게이트보다 **위**로 재이동 — EIA-AU-04 는 triggerId 조건이 없으므로 모든 terminal event 에서 무조건 revoke 시도. `revokeAllForExecution` 에 token 0건 early-return 추가 → 수동/스케줄 실행은 단일 인덱스 SELECT 로 비용 제한 (DELETE skip). fanout spec 에 "triggerId 없는 terminal → revoke 호출" + "non-terminal + triggerId 없음 → revoke 미호출" 케이스 반영, token spec 의 empty-delete 테스트를 early-return 동작으로 갱신 | (본 commit) |
| W5 | 테스트 | `onModuleInit`(subscribe 1회) / `onModuleDestroy`(unsubscribe) / init 없이 destroy(no-op) 라이프사이클 케이스 3건 추가 | (본 commit) |
| W2 | 요구사항 | **spec 영역 — developer 권한 밖.** `spec/§5.1` 에 `TOKEN_REVOKED` 누락 + `SCOPE_MISMATCH` 403(spec)/401(impl) 불일치 → `plan/in-progress/spec-fix-eia-token-error-codes.md` 신설로 project-planner 이관 | (본 commit, plan 신설) |
| W3 / INFO#6 | 보안/요구사항 | **spec 정책 영역.** revoke fail-open 에스컬레이션 + 단일 RxJS 구독 신뢰성(outbox/after-commit) → 위 follow-up plan §3 에 포함 | (본 commit, plan 신설) |
| W4 | 보안 | 테스트 픽스처 `itk_secret` 네이밍 — 기존 코드, 블로커 아님. 본 변경 미포함, 보류 | — |
| W6 | 테스트 | 추가 조합 케이스 — W1 조치로 핵심 조합(terminal×triggerId 유무, non-terminal×triggerId 유무)은 커버. 잔여는 보류 | — |
| W7 | 유지보수성 | 중첩 describe 그룹화 — 라이프사이클은 별 describe 로 분리. 케이스 수준에서 추가 그룹화는 보류 (현 규모 불필요) | — |

## TEST 결과

- lint: 통과 (`run-test.sh lint` PASS)
- unit: 통과 — 5016 passed (`run-test.sh unit` PASS)
- build: 통과 (docker 이미지 포함, `run-test.sh build` PASS)
- e2e: 통과 — 127 passed, 회귀 0 (`run-test.sh e2e` PASS)

## 보류·후속 항목

- W2 / W3 / INFO#6 → `plan/in-progress/spec-fix-eia-token-error-codes.md` (project-planner, spec §5.1/§3.4/§9.3 수정 + 필요 시 guard·e2e 동기화 developer 위임).
- W4 / W6 / W7 → 경미. 후속 grooming 시 선택 처리.
