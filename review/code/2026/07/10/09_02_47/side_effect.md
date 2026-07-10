# 부작용(Side Effect) Review

## 발견사항

- **[INFO]** attribution 필드가 오버로드된 `config: Record<string, unknown>` 매개변수에서 파생됨
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.ts:294-297` (`injectMemoryContext` 내 `llmContext` 조립)
  - 상세: `args.config.workflowId` / `args.config.nodeExecutionId` 를 읽어 `llmContext` 를 구성한다. `config` 파라미터는 단일-턴 경로(`applySingleTurnMemoryInjection`, ai-turn-executor.ts:1153)에서는 **사용자 authored 노드 config**, 멀티턴 재개 경로(`applyMultiTurnTurnMemory`, ai-turn-executor.ts:2275 `config: state`)에서는 **엔진 resume state 객체 전체**로 서로 다른 실체가 같은 이름/타입으로 전달된다. 두 실체를 구분 없이 `Record<string, unknown>` 으로 캐스트해 읽으므로, 이론상 노드 config 스키마가 향후 `workflowId`/`nodeExecutionId` 라는 키를 사용자 필드로 도입하면 misattribution(엉뚱한 workflow/nodeExecution 으로 usage 귀속) 이 발생할 수 있다. 현재 `ai-agent.schema.ts` 에는 해당 키가 없어 실질 충돌은 없고, `summaryModelConfigId`/`memoryKey`/`contextInjectionMode` 등 기존 필드들도 동일하게 `config` 오버로드 패턴을 이미 사용 중이라 이 diff 가 새로 만든 위험은 아니다 (기존 설계 관례의 연장).
  - 제안: 조치 불필요(기존 관례와 일관). 다만 향후 `ai-agent.schema.ts` 에 필드를 추가할 때는 `workflowId`/`nodeExecutionId`/`executionId` 를 예약어로 취급해 사용자 config 키와 충돌하지 않도록 인지해 둘 것.

- **[INFO]** `executionId` falsy 강제 변환 (`||` vs `??`)
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.ts:296`
  - 상세: `executionId: args.executionId || undefined` — `executionId` 는 인터페이스상 필수 `string` 이지만 멀티턴 호출부(`ai-turn-executor.ts:2289` `executionId: executionId ?? ''`)가 빈 문자열로 round-trip 시킨 값을 여기서 다시 `undefined` 로 되돌린다. 의도가 주석("첫 턴 등 미주입 시 undefined→NULL")으로 명시돼 있고 실제 실행 ID 가 falsy(빈 문자열 외 `0` 등)로 들어올 케이스가 없어 현재는 안전하다.
  - 제안: 조치 불필요. 타입을 `executionId?: string` 로 바꾸고 `?? undefined` 로 명시하면 의도가 더 드러나지만 필수 항목은 아님.

- **[INFO]** `llmService.chat` 3번째 인자(`context`) 를 통한 `llm_usage_log` DB write 는 fire-and-forget 이나 기존에 이미 존재하던 side-effect 경로
  - 위치: `codebase/backend/src/modules/llm/llm.service.ts:184-195` (diff 대상 외, 참조만) / 호출부 `codebase/backend/src/nodes/ai/shared/agent-memory-injection.ts:382-391`
  - 상세: 본 diff 는 새 side-effect 를 만들지 않는다 — `LlmService.chat` 은 diff 이전에도 매 호출마다 `void this.usageLogService.record(...)` 를 무조건 실행했고(요약 chat 호출도 포함, 이전엔 `workflowId/executionId/nodeExecutionId` 가 전부 `undefined`→NULL 로 기록됨), 본 diff 는 그 인자 값을 채워 넣을 뿐이다. `usageLogService.record` 내부는 자체 try/catch 로 감싸져 있어(`llm-usage-log.service.ts:38-44`) 실패해도 unhandled rejection 이나 chat 응답 경로에 영향이 없다.
  - 제안: 조치 불필요. 참고용 기록.

- **[INFO]** `BuildSummaryBufferArgs.llmContext` 는 optional 필드 추가, `AiTurnExecutor` 의 `llmContext` 는 순수 타입 주석 — 둘 다 시그니처/인터페이스 하위호환
  - 위치: `codebase/backend/src/nodes/ai/shared/agent-memory-injection.ts:279-287,309-312` / `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:481-491,2601`
  - 상세: `BuildSummaryBufferArgs.llmContext?: LlmCallContext` 는 optional 이라 미전달 호출부(예: 기존 다른 spec 케이스들, `agent-memory-injection.spec.ts` 의 다른 `it` 블록들)는 그대로 `undefined`→기존 동작 유지. `LlmService.chat(config, params, context?, opts?)` 의 `context` 파라미터도 이미 optional 로 존재했으므로 이번 3-arg 호출 전환은 새 시그니처를 만드는 것이 아니라 기존에 비어 있던 슬롯을 채우는 것. `ai-turn-executor.ts` 변경분은 `const llmContext = {...}` → `const llmContext: LlmCallContext = {...}` 로 런타임 동일, 컴파일 타임 excess-property check 만 추가된다.
  - 제안: 조치 불필요.

- **[INFO]** 신규 파일 `plan/in-progress/ai-usage-attribution-hardening.md`
  - 위치: 파일 5 (신규)
  - 상세: 저장소 관례상 `plan/in-progress/<name>.md` 위치가 맞고, worktree/branch/spec 참조 frontmatter 도 규약을 따른다. 코드 실행에 영향 없는 문서 파일.
  - 제안: 조치 불필요.

## 요약

이번 변경은 이미 존재하는 `LlmService.chat` 의 optional 3번째 인자(`LlmCallContext`) 를 여태 배선되지 않았던 호출 경로(AI Agent 자동 메모리 롤링 요약 압축 chat) 로 연결하고, 별도로 기존 resume-턴 attribution 코드에 명시 타입 주석을 붙이는 좁은 범위의 hardening 이다. 함수 시그니처는 전부 optional 필드 추가 또는 순수 타입 주석이라 기존 호출자에 대한 하위호환이 보장되고, 새로 발생하는 유일한 부작용(`llm_usage_log` DB insert 에 실 attribution 값이 채워짐)은 diff 이전에도 이미 실행되던 fire-and-forget 경로(NULL 값으로) 를 재사용할 뿐 새 네트워크 호출·새 전역 상태·새 파일시스템 접근을 만들지 않는다. 유일하게 짚을 만한 점은 attribution 소스가 되는 `config: Record<string, unknown>` 파라미터가 단일-턴/멀티턴 경로에서 서로 다른 실체(사용자 config vs 엔진 resume state)를 오버로드해서 나른다는 기존 설계 특성인데, 이는 이 diff 가 새로 도입한 문제가 아니라 이미 `summaryModelConfigId`/`memoryKey` 등에서 쓰이던 패턴을 그대로 확장한 것이다.

## 위험도

LOW
