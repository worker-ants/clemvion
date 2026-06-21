# 부작용(Side Effect) 리뷰

## 발견사항

### [INFO] 의도된 외부 상태 변이 — `injectMemoryContext` 내 ConversationThread in-memory mutate
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m1-memory-manager/codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.ts` 라인 240-247
- 상세: `injectMemoryContext` 는 요약이 발생했을 때 (`update.summarized === true`) `args.target?.conversationThread` 객체의 `runningSummary`/`summarizedUpToSeq` 필드를 직접 mutate 한다. 이 변이는 **의도된** 부작용이며 (spec conversation-thread §1.3·§4, 다음 turn multi-turn resume 에서 재사용), 핸들러에 있던 동일 코드를 verbatim 이동한 것이다. 그러나 `AiMemoryManager` 가 "무상태 collaborator" 라는 주석과 상충하는 외부 객체 변이가 이 메서드에 존재함을 명시한다. 호출 측에서 전달한 `target` 의 `conversationThread` 는 핸들러가 계속 참조하는 shared object 이므로 변이가 즉시 핸들러 쪽에도 반영된다 — 이것이 의도된 다음 turn 동작이다.
- 제안: 현행 유지 정당. 다만 "무상태 collaborator" 주석은 "실행별 인스턴스 상태(instance field) 없음" 의 의미임을 명확히 하는 것이 혼동을 줄인다. 이미 doc-comment 에 "실행별 가변 상태 0" 으로 기술되어 있어 이해 가능한 수준이다.

### [INFO] 외부 서비스 네트워크 호출 — `agentMemoryService.recall` 및 `llmService.resolveConfig` / `buildSummaryBufferUpdate`
- 위치: `ai-memory-manager.ts` 라인 186, 221, 227
- 상세: 이 호출들은 이미 핸들러에 존재하던 호출을 그대로 이동한 것이다. 새로 추가된 외부 호출은 없다. `recall` 실패는 try/catch 로 graceful degrade 된다. 네트워크 측면의 부작용 범위는 변경 전후 동일하다.
- 제안: 해당 없음.

### [INFO] `AiAgentHandler` 생성자 내 `AiMemoryManager` 인스턴스 생성 — NestJS DI 우회
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m1-memory-manager/codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` 라인 546-550
- 상세: `memoryManager` 는 NestJS `@Injectable()` 로 DI 되지 않고 생성자 내에서 `new AiMemoryManager(...)` 로 직접 생성된다. 이는 동일 패턴의 `conditionEvaluator = new AiConditionEvaluator()` 선례와 동형이다. 직접 인스턴스화이므로 NestJS lifecycle hook (`onModuleInit` 등) 이 발화하지 않는다 — `AiMemoryManager` 는 그런 hook 이 없으므로 문제없다. 단, 추후 `AiMemoryManager` 에 lifecycle hook 을 추가할 경우 DI 방식으로 전환해야 한다.
- 제안: 현행 유지 정당. `AiMemoryManager` 는 lifecycle hook 없는 순수 collaborator 이므로 직접 생성이 적절하다.

### [INFO] 공개 가시성 변경 — `resolveMemoryStrategy` / `injectMemoryContext` / `scheduleMemoryExtraction`
- 위치: `ai-memory-manager.ts` 전체 / `ai-agent.handler.ts` diff
- 상세: 핸들러에서 `private` 메서드였던 세 함수가 `AiMemoryManager` 의 `public` 메서드로 노출된다. 클래스 외부에서 이 메서드를 직접 호출하는 소비자가 생길 수 있으나, 현재 `AiMemoryManager` 는 `ai-agent.handler.ts` 생성자 내부에서만 생성되고 외부로 export 되지 않는 것이 아니라 `export class` 로 공개되어 있다. 그러나 실제 호출 지점은 `AiAgentHandler` 뿐이고, 테스트에서 직접 import 하는 경우는 graceful-degrade 용도로 제한될 것으로 보인다. 의도치 않은 호출자가 생기는 위험은 낮다.
- 제안: 향후 `AiMemoryManager` 를 `AiAgentHandler` 내부 전용으로 유지할 의도라면 `export` 를 제거하거나 별도 barrel 에서 제외하는 것을 고려할 수 있다. 현재는 테스트 접근성을 위해 `export` 가 적절하다.

## 요약

이번 변경은 `AiAgentHandler` 의 메모리 관련 3개 private 메서드(`resolveMemoryStrategy`, `injectMemoryContext`, `scheduleMemoryExtraction`)를 신설 `AiMemoryManager` collaborator 로 verbatim 이동한 순수 구조 리팩토링이다. 부작용 관점에서 새롭게 추가된 전역 변수, 파일시스템 조작, 환경 변수 읽기/쓰기, 이벤트 구조 변경은 전무하다. 외부 상태 변이(`conversationThread` mutate)와 네트워크 호출(`recall`, `buildSummaryBufferUpdate`)은 기존 코드에서 그대로 이어받은 의도된 부작용이다. `injectMemoryContext` / `scheduleMemoryExtraction` / `resolveMemoryStrategy` 의 호출 시그니처와 반환 타입은 핸들러 호출부에서 동일하게 유지된다. 공개 API(`AiAgentHandler` 의 `execute`/`processMultiTurnMessage` 등) 시그니처는 무변경이다.

## 위험도

NONE
