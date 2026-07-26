# RESOLUTION — 01_09_42

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #1 (CRITICAL) | 코드 | `3578d3ef4` | `finalizeFailedExecution` 이 형제 `finalizeCancelledExecution` 과 동일하게 `updateExecutionStatus`(guarded UPDATE, `status IN (non-terminal)`) 경유로 FAILED 마킹하도록 전환. guarded UPDATE 에 `error` 컬럼 추가(회귀 없이 보존). `false` 반환(동시 cancel 선점) 시 FAILED 저장·`EXECUTION_FAILED` emit·`execution_failed` 알림 dispatch 를 모두 skip. 동시-cancel 선점 회귀 테스트 신규 추가 + mutation 확인(가드를 `if (false)` 로 무력화 → RED 재현 후 원복 완료). 기존 회귀 테스트 8건(ERROR_PORT_FALLBACK ×2, max-iteration, INVALID_CONTAINER_PARAM, CONTAINER_MISSING/MULTIPLE_EMIT ×2, background handler error)을 `mockExecutionRepo.save` 단언에서 guarded UPDATE(raw `query`) 단언으로 갱신 |
| #2 (W1) | 코드 | `3578d3ef4` | `ai-turn-orchestrator.service.ts:690` 근방 신규 주석의 `§732` 라인 참조(도입 시점부터 어긋남)를 로그 메시지 문자열(`ExecutionContext absent on LLM-resume`) 인용으로 교체. `§` 접두는 spec 섹션 전용 관례로 코드 라인에 쓰지 않는다는 원칙 재확인 |
| #3 (W2) | 코드 | `3578d3ef4` | `tryLockActiveExecutionAndSaveNodeExec` JSDoc 의 "아래 인라인 주석은 이제 부정확하니…" 자기모순 문장 제거(같은 diff 에서 이미 정정된 상태였음) |
| #4 (W3) | 코드 | `3578d3ef4` | `assertLinkedTransitionApplied` 중앙 JSDoc·`handleAiMessageTurn`/turn-경계 가드 지역 주석의 "네 소비처"/"호출부 4곳"(실제 6곳) 하드코딩을 개수-비의존 서술("아래 각 호출부 인라인 주석 참조")로 전환 — 향후 소비처 추가 시 재발 방지 |
| #5 (W4) | 코드 | `3578d3ef4` | `CHANGELOG.md` "Unreleased — AI multi-turn resume…" 섹션에 5·6차 라운드 신규 항목(turn 경계 가드·`isFailed` 분기 통일, `cancelParkedExecution` 원자화, `finalizeFailedExecution` Execution 레벨 lost-update 차단) 추가. 소비처 개수 표기를 "모든 짝 전이 관측 경로"로 전환 |
| #6 (W5) | 코드 | `3578d3ef4` | 신규 테스트 helper `makeQb`/`installTx`(cancelParkedExecution describe, 인자 순서 `execAffected, nodeAffected`)가 기존 `claimResumeEntry` describe 의 동명 helper(인자 순서 반대)와 충돌 — `makeCancelQb`/`installCancelTx` 로 개명 |
| #7 (W6) | 코드 | `3578d3ef4` | `cancelParkedExecution` 신규 원자화 트랜잭션의 "트랜잭션 자체 throw" 시나리오 테스트 추가 — `markWebChatIdleTimeout` 의 대응 테스트를 미러링(`dataSource.transaction` reject → catch 로 흡수, 호출자에 예외 전파 없음, emit 미발생) |
| #8 (W7) | 코드 | `3578d3ef4` | `handleAiMessageTurn` turn 경계 가드의 non-`ExecutionCancelledError`(일반 인프라 에러) rethrow 분기가 테스트되지 않아 mutation 사각지대였음 — `new Error('db down')` 주입 케이스 추가(원본 에러 그대로 전파 + 취소 마킹 경로 미진입 단언) |
| #9 (W8) | plan | (코드 변경 없음) | `handleAiMessageTurn` SRP 부채 심화(CRITICAL #1 fix 가 이미 과다 길이인 메서드에 인라인 절차를 얹음) — 회귀 위험 대비 이득 낮다고 판단, `plan/in-progress/ie-resume-turn-boundary-cancel.md` "6차 라운드 추가 후속" 절에 등재만 |

## TEST 결과

- lint  : 통과 (0 error, 기존 unrelated warning 2건만 잔존)
- unit  : 통과 (backend 412 suite / 8310 passed, 1 skipped — `execution-engine.service.spec.ts` 433 passed·`ai-turn-orchestrator.service.spec.ts` 87 passed 확인)
- build : 통과
- e2e   : 통과 (260 passed, `_test_logs/e2e-20260727-015838.log`)

## 보류·후속 항목

- SUMMARY#9 (`handleAiMessageTurn` SRP 부채) — `plan/in-progress/ie-resume-turn-boundary-cancel.md` "6차 라운드 추가 후속" 절
- INFO — `USER_MESSAGE` 라이브 시그널 secret 마스킹 비대칭 (security) — 동일 plan 절에 후속 등재 (구독 인가 스코프 확인 + 필요 시 `redactSecrets` 방어적 적용 검토)
- INFO — `NODE_CANCELLED` 재emit 멱등성 확인 필요 (side_effect) — 동일 plan 절에 후속 등재 (프론트엔드/알림 소비 측 멱등 처리 여부 별도 확인 권고)
- SPEC-DRIFT — 이번 라운드 신규 발견 없음. 기존 spec 위임(`spec-update-node-cancellation-shutdown-classification.md` #7)은 이미 완료 상태 유지, `spec/` 수정 없음
