# 부작용(Side Effect) 리뷰 결과

리뷰 대상: `ai-usage-attribution-hardening-358929` — AI Agent 자동 메모리 롤링 요약 압축 chat 의
`llm_usage_log` attribution 배선 (`spec/data-flow/7-llm-usage.md §1.3`).

## 발견사항

- **[INFO]** 의도된 DB 기록 내용 변경 — 기존 NULL 컬럼이 채워짐
  - 위치: `codebase/backend/src/nodes/ai/shared/agent-memory-injection.ts` (`buildSummaryBufferUpdate` 의 `llmService.chat(...)` 3번째 인자), `codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.ts`, `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts`
  - 상세: `LlmService.chat(config, params, context?)` 의 `context` 파라미터는 이미 존재하던 optional 3번째 인자(`codebase/backend/src/modules/llm/llm.service.ts:154-197`)로, `usageLogService.record(...)`(fire-and-forget) 의 `workflow_id`/`execution_id`/`node_execution_id` 컬럼에만 영향을 준다 — 실제 provider HTTP 호출(`client.chat`)이나 재시도·타임아웃 로직에는 관여하지 않는다. 이번 diff 는 새 네트워크 호출이나 새 I/O 지점을 추가하지 않고, **이미 일어나던 동일 요약-압축 chat 호출 1건의 attribution 기록 내용만 NULL→값으로 채운다.** CHANGELOG 에 명시된 대로 Statistics `workflowId` 필터·Alerts 집계 결과가 이 시점 이후 기록되는 메모리 압축 사용량을 포함하도록 바뀌는데, 이는 명세된 의도이므로 버그는 아니다. 다만 "이 컬럼이 항상 NULL" 이라는 과거 전제로 작성된 하위 쿼리/대시보드가 있다면(현재 diff 범위 밖) 이번 변경으로 결과 셋이 달라질 수 있다는 점은 후속 소비자 관점에서 인지해 둘 만하다.
  - 제안: 별도 조치 불필요(의도된 동작). 참고용 기록.

- **[INFO]** 시그니처/인터페이스 변경은 모두 하위호환 optional 필드
  - 위치: `ai-memory-manager.ts` (`injectMemoryContext` args 의 `llmContext?: LlmCallContext`), `agent-memory-injection.ts` (`BuildSummaryBufferArgs.llmContext?: LlmCallContext`)
  - 상세: 두 함수 모두 새 필드가 optional 이고 미전달 시 `llmContext: undefined` 로 `llmService.chat` 에 그대로 전달돼 기존 NULL-attribution 동작을 보존한다(`agent-memory-injection.spec.ts` 의 "llmContext 미전달(하위호환) 시 chat 3번째 인자는 undefined" 테스트로 고정). diff 범위 밖의 다른 `buildSummaryBufferUpdate`/`injectMemoryContext` 호출부가 있다면(현재 조사 결과 `ai-memory-manager.ts` 1곳만 `buildSummaryBufferUpdate` 를 호출, `ai-turn-executor.ts` 2곳만 `injectMemoryContext` 를 호출) 모두 이번 diff 에서 함께 갱신되어 호출자 누락이 없다. `LlmService.chat` 자체의 시그니처(`config, params, context?, opts?`)는 이번 diff 에서 변경되지 않았다(사전 존재).
  - 제안: 조치 불필요.

- **[INFO]** `executionId` fallback 값의 미묘한 비대칭 (`undefined` vs `''`)
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` `applyMultiTurnTurnMemory` 호출부(diff 상 `@@ -2287,6 +2293,13 @@` 부근)
  - 상세: 동일 `executionId` 지역변수에서 `injectMemoryContext` 최상위 `executionId: executionId ?? ''` 와 새로 추가된 `llmContext.executionId: executionId ?? undefined` 가 서로 다른 기본값을 쓴다. `injectMemoryContext` 쪽은 (scope-key 조합 등에 쓰이는) 항상-string 계약을 유지하기 위해 `''` 로, `llmContext` 쪽은 `llm_usage_log` 에 빈 문자열 대신 진짜 NULL 이 적재되도록 `undefined` 로 - 각각의 목적에 맞게 의도적으로 분리된 것으로 보인다. 부작용은 없으나, 동일 소스 변수에서 두 개의 다른 fallback 규칙이 나란히 있어 향후 리팩터링 시 실수로 통일될 위험이 있다.
  - 제안: (선택) 두 줄 사이에 "fallback 값이 다른 이유" 짧은 주석을 남기면 회귀 방지에 도움.

- **[INFO]** 테스트 픽스처 보강은 기존(pre-diff) 프로덕션 부작용 경로를 새로 커버
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.spec.ts` (`threadFake` 에 `updateSummaryState: jest.fn()` 추가)
  - 상세: `AiMemoryManager.injectMemoryContext` 는 이번 diff 이전부터 `update.summarized && this.conversationThreadService && args.target` 조건에서 `conversationThreadService.updateSummaryState(...)` 를 호출해 in-memory thread 상태를 mutate 하고 있었다(`ai-memory-manager.ts:940-945`, 이번 diff 로 변경되지 않음). 새 테스트가 `target`/`conversationThreadService` 를 모두 채운 요약-트리거 시나리오를 실행하면서 이 기존 mutation 경로가 처음으로 `ai-memory-manager.spec.ts` 안에서 실행되어 mock 보강이 필요해진 것으로, **새로운 프로덕션 부작용이 아니라 기존 부작용의 테스트 커버리지 확장**이다.
  - 제안: 조치 불필요. 참고용 기록.

- **[INFO]** 타입 전용 import 경로 유지로 레이어 간 런타임 의존 없음
  - 위치: `ai-memory-manager.ts`, `agent-memory-injection.ts` 의 `import type { LlmService, LlmCallContext } from '.../llm.service'`
  - 상세: 두 파일 모두 `LlmCallContext` 를 기존 `import type` 문에 병기해 순수 타입으로만 사용한다(런타임 import 그래프 불변). `ai-turn-executor.ts` 의 `import { LlmService, LlmCallContext } from ...` 는 value-import 형태이지만, 이는 `LlmService` 가 이미 이 파일에서 (비-`@Injectable` 수동 생성 클래스의 생성자 파라미터 타입으로) value-import 되어 있던 기존 패턴에 `LlmCallContext` 를 추가한 것뿐이라 새로운 런타임 의존을 만들지 않는다(interface 는 컴파일 타임에 소거).
  - 제안: 조치 불필요.

## 요약

이번 diff 는 AI Agent 자동 메모리 롤링 요약 압축 chat 호출에 이미 존재하던 `LlmService.chat` 의 optional `context` 파라미터를 채워 넣는 배선 변경으로, 새로운 전역 상태·새 파일시스템 I/O·새 네트워크 호출·환경변수 접근·이벤트/콜백 변경을 도입하지 않는다. 함수 시그니처 변경은 전부 하위호환 optional 필드 추가이며, 관련된 모든 호출부(`ai-memory-manager.ts`→`agent-memory-injection.ts`, `ai-turn-executor.ts`→`ai-memory-manager.ts`)가 같은 diff 안에서 함께 갱신돼 누락이 없다. 유일한 실질적 "부작용"은 의도된 것 — 지금까지 NULL 로 적재되던 `llm_usage_log.workflow_id`/`execution_id`/`node_execution_id` 컬럼이 이 요약-압축 chat 호출분에 한해 채워지기 시작하는 것으로, CHANGELOG·plan 문서에 명시적으로 문서화돼 있다. `executionId` fallback 값의 `undefined`/`''` 비대칭은 사소한 가독성 이슈로 실제 결함은 아니다.

## 위험도

LOW
