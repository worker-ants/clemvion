# 동시성(Concurrency) Review

## 발견사항

- **[WARNING]** `finalizeAiNode` 의 "이미 RUNNING 유지" 분기(CRITICAL #1 fix)가 재도입한 좁은 TOCTOU(check-then-act) 창
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:1446-1464` (`if (savedExecution.status === ExecutionStatus.RUNNING) { ... }` 분기), 관측 함수는 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:7996-8024` (`assertExecutionNotCancelled`)
  - 상세: 이 분기는 (의도적으로) `updateExecutionStatus` choke point 를 타지 않는다 — Execution 을 RUNNING→RUNNING 으로 재전이시키지 않기 위해서다. 대신 `assertExecutionNotCancelled` 로 취소 여부를 재확인한 뒤 `assertLinkedTransitionApplied(!cancelledExternally, ...)` 를 호출하고, 그 다음 바로 `this.nodeExecutionRepository.save(nodeExec)` 로 COMPLETED 를 영속하고 이어서 `NODE_COMPLETED`/`EXECUTION_RESUMED` 를 emit 한다. 그런데 `assertExecutionNotCancelled` 는 `execution-engine.service.ts:8010-8013` 에서 보듯 **잠금 없는 단순 `SELECT`** 다(`FOR UPDATE` 아님). 반면 형제 분기인 `linkedNodeExec` 짝 전이(같은 파일 8159-8206행)는 정확히 이 문제를 `SELECT ... FOR UPDATE` 트랜잭션으로 닫아 커밋까지 잠금을 유지한다고 명시(`// 잠금이 커밋까지 유지되므로 검사-후-사용 race 도 닫힌다`, 8180행). "이미 RUNNING" 분기에는 그 대칭 보호가 없다 — `assertExecutionNotCancelled` 의 체크가 끝난 직후부터 `nodeExecutionRepository.save`/이벤트 emit 까지 사이에 `executions.service.ts` 의 `stop()`(단일 guarded UPDATE, 별도 트랜잭션)이 끼어들면, DB 는 이미 CANCELLED 인데 NodeExecution 은 COMPLETED 로 저장되고 `NODE_COMPLETED`/`EXECUTION_RESUMED` 가 그대로 emit 된다 — 이번 PR 이 명시적으로 없애려 한 "사후 오시그널" 이 훨씬 좁아진 창(체크 직후 ~ save 직전의 단일 이벤트 루프 턴)으로나마 재발할 수 있다. 신규 e2e(`execution-park-resume.e2e-spec.ts` 의 "턴 진행 중 …POST /stop" 케이스)나 단위 테스트(`assertExecutionNotCancelled` 를 reject 하도록 mock)는 전부 "체크 시점에 이미 취소됨" 매크로 레이스만 재현하고, "체크 통과 직후 취소가 끼어드는" 진짜 마이크로 레이스는 원천적으로 재현·검증하지 못한다(타이밍 마커로 통제 불가능한 창이라서).
  - 제안: 형제 분기와 대칭으로, `assertExecutionNotCancelled` 재확인과 `nodeExec` save 를 같은 트랜잭션의 `SELECT ... FOR UPDATE` 로 원자화하거나(Execution 행을 잠근 뒤 그 상태를 재확인하고 통과 시에만 nodeExec 를 save), 최소한 `nodeExec.save()` 직전에 짧은 재확인을 다시 넣어 창을 더 좁힌다. 완전한 원자성이 어렵다면 이 잔존 창을 코드 주석에 "알려진 한계"로 명시해 다음 리뷰에서 반복 지적되지 않도록 한다.

- **[INFO]** Form/Button interaction 4개 호출부는 여전히 `updateExecutionStatus` 짝 전이의 `false` 반환을 소비하지 않음(이미 추적됨)
  - 위치: `plan/in-progress/ie-resume-turn-boundary-cancel.md` "## 후속 (본 PR 밖)" 절이 `form-interaction.service.ts:110,325`, `button-interaction.service.ts:395,567` 을 명시적으로 추적
  - 상세: DB 자체는 이번 PR 의 `FOR UPDATE` 가드로 안전(짝 전이가 no-op 되면 lost-update 는 발생하지 않음)하지만, 짝 `NodeExecution` 이 terminal 마킹되지 않아 AI 경로와 달리 영구 RUNNING 으로 잔류할 수 있다는 점은 순수한 동시성 관점에서도 유효한 잔여 갭이다. 다만 plan 에 이미 "후속 PR" 로 명시 추적돼 있고 이번 PR 범위 밖으로 합의됐으므로 새 발견이 아니라 재확인 차원의 기록.
  - 제안: 추적된 대로 후속 PR 에서 `assertLinkedTransitionApplied` 로직을 순수 헬퍼로 재추출해 form/button 경로에도 적용.

## 요약

이번 diff 의 핵심은 `updateExecutionStatus` 의 `linkedNodeExec`(park↔resume 짝 전이) 분기가 그동안 무가드 full-entity save 였던 lost-update 를 `SELECT ... FOR UPDATE` 트랜잭션으로 닫은 것과, AI multi-turn 이 턴 경계에서 취소를 관측하지 못하던 갭을 `assertExecutionNotCancelled` turn-경계 가드로 메운 것이다. 짝 전이의 `false` 반환 계약을 `assertLinkedTransitionApplied` 로 단일화해 re-park/첫 turn park/retry-last-turn RUNNING 재claim 세 소비처에서 일관되게 취소 전파 + 짝 NodeExecution terminal 마킹을 수행하고, 관련 회귀(mutation 사각지대 nodeExec=null, segmentStartMs 유령 항목, outputData/error 잔존)까지 좁혀 닫은 점은 견고하다. 다만 이번 라운드에서 새로 추가된 `finalizeAiNode` "이미 RUNNING 유지" 분기(CRITICAL #1)는 형제 분기와 달리 행 잠금 없이 "재확인 → 곧바로 save/emit" 패턴이라, 체크 직후의 좁은 창에서 동일 클래스의 사후 오시그널이 이론상 재발할 수 있다 — 실질 위험도는 낮지만(창이 매우 좁고 실측 e2e/유닛 테스트 모두 이 마이크로 레이스를 검증하지 못함) 이 PR 의 설계 원칙("잠금이 커밋까지 유지되어 검사-후-사용 race 를 닫는다")과 비대칭적이라 명시적으로 남긴다. 나머지(form/button 미소비)는 이미 plan 에 추적된 기지 항목이라 INFO 로만 기록한다.

## 위험도

MEDIUM
