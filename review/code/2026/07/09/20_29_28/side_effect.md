# 부작용(Side Effect) 리뷰 — fix-resume-turn-usage-log-attribution (#501 회귀 수정)

## 발견사항

- **[INFO]** `resumeState.nodeExecutionId` 가 `undefined` 로 명시적으로 set 될 수 있음
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:151` (`nodeExecutionId: ctx.nodeExec?.id`), `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4914` (`nodeExecutionId: opts?.nodeExecutionId`)
  - 상세: `ctx.nodeExec` 가 null 인 방어 경로(§7.5 rehydration 의 `nodeExec missing` 케이스)에서는 `nodeExecutionId: undefined` 가 `resumeState` 객체에 **키 자체로는 존재**하되 값이 `undefined` 로 주입된다. 소비처(`ai-turn-executor.ts:2684-2685`)가 `if (ctx.nodeExecutionId && ctx.workflowId)` falsy 게이트로만 쓰므로 현재는 동작에 영향 없음(기존에 필드 자체가 없던 것과 동등). `retry-turn.service.ts` 쪽은 `spawnedRow` 존재가 이미 앞단에서 보장돼 있어 undefined 유입 경로가 없음.
  - 제안: 별도 조치 불요 — 현재 유일 소비처가 truthy 게이트라 안전. 향후 `nodeExecutionId` 를 다른 방식(예: `'nodeExecutionId' in state` 존재 검사)으로 소비하는 코드가 추가되면 이 undefined-키 잔존이 함정이 될 수 있다는 점만 인지.

- **[INFO]** 의도된 신규 부작용 — resume/retry 턴에서 `IntegrationsService.logUsage()` DB 쓰기가 재개된다
  - 위치: 소비처 `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:2684-2685` (cafe24/makeshop/mcp provider 게이트), 쓰기 자체는 `IntegrationsService.logUsage`
  - 상세: 이번 diff 는 `buildRetryReentryState` 가 재구성하는 `resumeState` 에 `workflowId`/`nodeExecutionId` 를 재주입해, 기존에 조용히 skip 되던 `integration_usage_log` insert 가 멀티턴 2번째 이후 턴에서 다시 발생하게 만든다. 이는 회귀 수정의 **의도된 목적**(plan `fix-resume-turn-usage-log-attribution.md` 명시)이며 우발적 부작용이 아니다. 코드 자체가 새 네트워크 호출을 추가하지는 않는다 — 이미 나가던 외부 provider 호출에 대한 **기록 경로만** 복구한다.
  - 제안: 별도 조치 불요. 리뷰 관점에서 "의도치 않은 상태 변경"이 아님을 명시적으로 확인.

- **[INFO]** `resumeStateSchema` 필드 추가는 `.partial()` 적용으로 실질 optional — 런타임 영향 없음
  - 위치: `codebase/backend/src/modules/execution-engine/utils/resume-state.schema.ts:118` (`nodeExecutionId: z.string()`), 스키마 정의부는 `.partial().catchall(z.unknown())` 로 마감(`resume-state.schema.ts:157` 부근)
  - 상세: 이 스키마는 파일 상단 주석대로 런타임 `parse`/`safeParse` 에 쓰이지 않는(behavior-preserving) 타입 문서화 목적이므로, 필드 추가가 검증 로직에 영향을 주지 않는다. `retryStateSchema`/`resumeCheckpointSchema`(DB 영속 대상)에는 `nodeExecutionId` 가 **의도적으로 미포함** — checkpoint/retry persist 경로에 실수로 새 필드가 새지 않았음을 확인.
  - 제안: 없음.

- **[INFO]** `CREDENTIAL_CONTEXT_FIELDS` 배열에 `'nodeExecutionId'` 추가 — production 소비처 없음(테스트 오라클 전용)
  - 위치: `codebase/backend/src/modules/execution-engine/utils/resume-state.schema.ts:150-163`
  - 상세: grep 결과 이 상수는 `.spec.ts` 파일에서만 참조되고, `buildResumeCheckpoint`(execution-engine.service.ts:5008)는 이 배열을 참조하지 않고 자체 명시적 allow-list 리터럴을 사용한다 — 이미 `workflowId`/`nodeExecutionId` 를 포함하지 않는 형태로 변경 전부터 안전했다. 따라서 이 상수 추가가 실제 checkpoint 직렬화 로직에 영향을 주지 않는다.
  - 제안: 없음. 다만 이 상수가 향후 production 코드에서 실제 allow-list 로 재사용되게 되면 그 시점에 정합성 재검증 필요.

## 시그니처/인터페이스 변경 점검 (결과: 안전)

- `ReentryStateDriver.buildRetryReentryState` 의 `opts` 파라미터에 `nodeExecutionId?: string` 이 **추가적 optional 필드**로 확장됨 (`engine-driver.interface.ts:82`→`87`). 기존 시그니처와 호환(breaking 아님).
- 실제 구현체는 `ExecutionEngineService` 단 하나(`useExisting: ExecutionEngineService`)이며, 실 호출자는 `AiTurnOrchestrator.handleAiResumeTurn`(ai-turn-orchestrator.service.ts:151)과 `RetryTurnService.applyRetryLastTurn`(retry-turn.service.ts:2631 상당) 둘뿐 — grep 으로 전수 확인했고 두 곳 모두 이번 diff 에서 동시 갱신됐다. 누락된 호출자 없음.
- 테스트 mock 시그니처(`execution-engine.service.spec.ts:1531-1533`)도 동기화됨.
- DI 바인딩(`ENGINE_DRIVER` 토큰)·public 메서드 노출 범위·이벤트 emit 콜백(`emitExecution`/`emitNode`) 어디에도 변경 없음 — 이벤트 발생 시점·payload shape 은 그대로.

## 그 외 항목 (전역 상태·파일시스템·환경 변수·네트워크 호출)

- 전역 변수 신설/수정 없음.
- 파일시스템 부작용: `plan/in-progress/fix-resume-turn-usage-log-attribution.md` 신규 파일 1건 — 프로젝트 컨벤션상 의도된 계획 추적 문서이며 코드 실행 경로와 무관.
- 환경 변수 읽기/쓰기 없음.
- 신규 외부 네트워크 호출 없음 — 이미 존재하던 provider 호출의 **사용 로그 기록 경로만** 복구(위 INFO 항목 참고).
- 이벤트/콜백 변경 없음 — `EventEmitter` 호출부·이벤트 타입·payload 모두 diff 밖.
- `execution-engine.service.spec.ts` 의 `service` → `svcMetrics` 치환은 사전 존재하던 out-of-scope 참조 `ReferenceError` 테스트 버그 수정(plan 상 "부수 발견 — ISSUE FIX 정책")이며 production 코드에 영향 없음. 로컬 스코프의 이미 선언된 `svcMetrics: ExecutionEngineService` 변수(spec.ts:16660, `beforeEach` 에서 assign)를 가리키므로 안전.

## 요약

이번 변경은 `buildRetryReentryState` 공유 재구성기에 `workflowId`/`nodeExecutionId` context-binding 필드를 재주입하는 좁은 범위의 회귀 수정으로, 시그니처 변경은 optional 필드 추가에 그치고 실 호출자(2곳)·인터페이스·테스트 mock 이 모두 동기 갱신되어 breaking 요소가 없다. 신규 필드는 DB 영속 스키마(`resumeCheckpointSchema`/`retryStateSchema`)에는 의도적으로 배제되어 credential-strip allow-list 위반이 없음을 확인했고, 유일한 관측 가능한 부작용은 "의도된" 것 — 멀티턴 resume/retry 턴에서 그동안 조용히 누락되던 `integration_usage_log` 기록이 다시 발생하는 것으로, 이는 본 fix 의 목적 자체다. `nodeExec`/`spawnedRow` 가 null 인 방어 경로에서 `nodeExecutionId: undefined` 키가 명시적으로 얹히는 점은 현재 유일 소비처가 truthy 게이트라 실해가 없다. 전역 상태·파일시스템(신규 plan 문서 제외)·환경 변수·이벤트 발생에는 영향이 없다.

## 위험도

LOW
