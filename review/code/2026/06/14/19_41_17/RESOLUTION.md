# RESOLUTION — ai-review 19_41_17 (EIA #604 후속 코드 품질)

RISK LOW · Critical 0 · WARNING 1 · INFO 11.

## WARNING
| # | 처리 | 근거 |
|---|------|------|
| 1 SPEC-DRIFT (spec §10 에 `terminal-revoke-reconciler.types.ts` 미등재) | **fix — spec-side (doc-sync PR #605)** | 코드는 올바름(notification-dispatcher.types 패턴, revert 오답). developer 는 spec read-only 라 §10 파일 목록 갱신을 동반 doc-sync PR #605(`docsync-6dd0f4`)에 추가 커밋(8b61d80d). 본 코드 PR 무변경. |

## INFO (비차단)
- I8 (DEV_EPHEMERAL_SECRET round-trip 미검증) — ephemeral 은 secret **출처**만 다르고 mint↔verify 로직은 기존 `iext_*` 테스트(TEST_SECRET)가 전수 커버. dev 전용 경로라 비차단. (선택 후속)
- I9/I10 (DB 인덱스) — `execution_token.executionId` = V060 `idx_execution_token_execution_id` 존재. reconcile 쿼리는 `execution_token` 주도(execution 은 PK join)라 `execution.status` 인덱스 불요. → 비차단.
- I1 (Redis fail-open) — EIA §8.3 인가 설계, R15 가 revoke-failure 메트릭/알람을 후속 observability 로 명시. → defer.
- I2/I10 (나머지 큐 상수 types 분리)·I3 (refreshPerExecution 이중 파싱)·I5/I6 (controller 방어코드·param naming) — **선존** 코드/본 PR 범위 밖 tech debt. → 후속.
- I4/I7 (테스트 매직넘버·헬퍼 shadowing)·I11 (per-jti 직렬 SET, 1~2건 무해) — 저우선. → 유지/선택.

## 검증
be lint(0)·unit(6926)·build·e2e(191) ✓. WARNING(spec) 은 PR #605 에서 해소 — 본 코드 PR 은 RISK LOW·코드 결함 0.
