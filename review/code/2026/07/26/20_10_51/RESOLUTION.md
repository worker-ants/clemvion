# RESOLUTION — 20_10_51

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #1 (concurrency, WARNING) | 코드 | `66cc9962c` | 짝 전이 가드 no-op 시 짝 `NodeExecution` 을 `markNodeCancelled` 로 terminal 마킹(영구 RUNNING 잔류 차단). `markNodeCancelled` 를 `AiTurnEngineDriver` 로 노출 |
| #2 (testing, WARNING) | 코드 | `66cc9962c` | 세 번째 짝 전이 소비처(`finalizeAiNode` retry-last-turn 재진입 RUNNING 재claim)가 `false` 반환 계약을 소비하도록 수정 + 회귀 테스트 2건 추가 |
| #3 (architecture/documentation, WARNING) | 코드(JSDoc) | `66cc9962c` | `engine-driver.interface.ts` JSDoc 을 실제 소비 현황(AI 3곳만 소비, form/button 4곳 후속)에 맞게 정정 |
| #4 (requirement, WARNING) | 코드(JSDoc) | `66cc9962c` | `execution-engine.service.ts` `updateExecutionStatus` `@returns` 의 "linkedNodeExec 분기는 항상 true" 오기 정정 |
| #5 (documentation, WARNING) | 문서 | `acbdbb81e` | `CHANGELOG.md` 에 이번 데이터 정합성 결함 수정 Unreleased 절 추가 |
| #6 (documentation, INFO — WARNING 표 6번) | 코드(JSDoc) | `66cc9962c` | `reparkAiResumeTurn`/`emitAiWaitingForInput`/`handleAiMessageTurn` 3개 메서드에 `@throws {ExecutionCancelledError}` 추가 (commit 메시지에 `SUMMARY#6` 누락 — 본 표·`_resolution_state.json` 이 매핑의 SoT) |
| #7 (유지보수성, WARNING) | 코드 | `66cc9962c` | re-park/첫 turn park/RUNNING 재claim 3곳의 중복 가드를 `assertLinkedTransitionApplied` 헬퍼로 추출(naming_collision W4 가드 준수 — `mark<X>Cancelled` 접두 회피) |
| #8 (유지보수성, WARNING) | 코드 | `66cc9962c` | non-terminal status SQL 리터럴을 `NON_TERMINAL_STATUSES_SQL` 정적 상수로 단일 출처화 |
| #9 (부작용, WARNING) | 코드 | `66cc9962c` | `assertExecutionNotCancelled` 를 `CoreEngineDriver` → `AiTurnEngineDriver` 로 이동(ISP, 실제 호출자 단일) |

## TEST 결과

- lint  : 통과
- unit  : 통과 (backend 412 suites, 8289 tests — 1 skipped, 8288 passed; 신규 회귀 테스트 포함)
- build : 통과
- e2e   : 통과 (259/259)

## 보류·후속 항목

- INFO #1 (SPEC-DRIFT): `spec/conventions/node-cancellation.md` §2.3, `spec/5-system/4-execution-engine.md` §1.1 미반영 — 이미 `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` **#7** 절로 위임돼 있어 추가 조치 불요. `spec/` 은 수정하지 않았다(요청된 사전 컨텍스트대로).
- INFO #2 (요구사항/문서): plan 문서 "blast radius" 8건 → 7건 정정 완료 (`acbdbb81e`, `execution-engine.service.ts:8025` 는 JSDoc 예시라 실제 호출부 아님을 반영).
- INFO #3 (요구사항/DB): form/button interaction 5개 park 호출부의 `updateExecutionStatus` 반환값 미소비 — 이미 plan `## 후속 (본 PR 밖)` 절에 추적됨, 본 세션 조치 불요.
- INFO #4~#10: 낮은 우선순위 문서·리네이밍·테스트 보강 제안 — 자동 조치 대상 아님(INFO 는 추적만).
- INFO #11 (범위): `cafe24-backlog-residual.md` plan 편집 — diff 자체가 투명하게 근거 명시, 조치 불요.
- INFO #12 (DB): 신규 `FOR UPDATE` 쿼리 견고성 확인 — 조치 불요.
- 민감 변경 가드: 해당 없음 (DB 마이그레이션·외부 API 계약·인증·결제 변경 없음).
