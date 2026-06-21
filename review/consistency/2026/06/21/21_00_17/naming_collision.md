## 발견사항

- **[INFO]** `AiMemoryManager` 클래스명 — 기존 `AgentMemoryService` 와의 의미 근접성
  - target 신규 식별자: `AiMemoryManager` (plan `02-architecture.md §M-1` 2단계 신설 collaborator 클래스, 파일 `ai-memory-manager.ts`)
  - 기존 사용처: `codebase/backend/src/modules/agent-memory/agent-memory.service.ts:141` — `class AgentMemoryService` (domain-layer 서비스); `codebase/backend/src/nodes/ai/shared/agent-memory-injection.ts:531` — `interface AgentMemoryScheduler` (narrowed structural interface)
  - 상세: `AgentMemoryService` 는 agent_memory 테이블 CRUD / recall / extract 를 담당하는 **도메인 모듈 서비스**이고, `AiMemoryManager` 는 노드 레이어의 working-memory 토큰 예산·롤링 요약·안정 프리픽스 빌드 로직을 핸들러에서 추출하는 **node-layer collaborator**다. 두 클래스는 레이어(domain vs node)와 책임(DB I/O vs 메모리 전략 계산)이 명확히 다르므로 **충돌은 없다**. 다만 이름 접두사(`Agent*` vs `Ai*`)가 혼재해 새로운 기여자가 두 개념을 혼동할 여지가 있다. 1단계 선례(`AiConditionEvaluator`) 가 `Ai-` 접두사 관행을 이미 수립했으므로 `AiMemoryManager` 는 그 관행을 일관되게 따른 명명이다.
  - 제안: 충돌이 아닌 INFO 수준 — 추가 조치 불요. 단 `AiMemoryManager` 의 doc-comment 에 "AI Agent node-layer 전용 working-memory 관리자. persistent 저장소 I/O 는 `AgentMemoryService` 가 담당한다"는 구분을 명시하면 혼동을 방지할 수 있다.

- **[INFO]** `AgentMemoryScheduler` 인터페이스와의 명칭 유사성
  - target 신규 식별자: `AiMemoryManager` (node-layer collaborator)
  - 기존 사용처: `codebase/backend/src/nodes/ai/shared/agent-memory-injection.ts:531` — `export interface AgentMemoryScheduler` (extract 큐 enqueue 전용 narrow interface)
  - 상세: `AgentMemoryScheduler` 는 `agentMemoryService` 의 narrowed structural adapter interface 이며, `AiMemoryManager` 가 추출한 뒤에는 내부 의존으로 감쌀 가능성이 높다. 두 이름이 같은 파일(`agent-memory-injection.ts`)에서 `ai-memory-manager.ts` 로 이동하는 과정에서 `AgentMemoryScheduler` 가 `AiMemoryManager` 내부 private 타입으로 이동할지 public re-export 로 남을지 설계 시 결정이 필요하다.
  - 제안: `AiMemoryManager` 가 `AgentMemoryScheduler` 를 내부적으로 사용한다면, public export 범위를 정리해 두 식별자가 혼재하지 않도록 정리 계획을 PR description 에 명시한다. 충돌은 아니므로 INFO 등급.

- **[INFO]** `agent-memory-injection.ts` 내 기존 공개 함수군 이동 여부 명확화
  - target 신규 식별자: `AiMemoryManager` (신설 class)
  - 기존 사용처: `codebase/backend/src/nodes/ai/shared/agent-memory-injection.ts` — `estimateTokensLanguageAware`, `estimateWorkingMemoryTokens`, `buildSummaryBufferUpdate`, `appendStablePrefix`, `compactMessagesToTail`, `selectVolatileTail`, `scheduleMemoryExtraction` 등 22개 이상 공개 함수·인터페이스 (현재 `ai-agent.handler.ts:44-48` 과 `information-extractor.handler.ts:28` 에서 import 중)
  - 상세: `AiMemoryManager` 추출 시 위 함수들을 class 메서드로 감쌀지, `agent-memory-injection.ts` 의 free-function 을 그대로 유지한 채 class 가 내부 호출만 할지 결정이 열려 있다. 함수 이름 자체는 충돌이 없으나, class 추출 후에도 기존 import 경로(`../shared/agent-memory-injection`)가 유효한지 확인이 필요하다. `information-extractor.handler.ts` 도 `scheduleMemoryExtraction` 을 직접 import 하므로, 이 함수가 이동되면 IE handler 도 함께 수정해야 한다.
  - 제안: 기존 public free-function 을 이동하는 경우 `agent-memory-injection.ts` 에 re-export shim 또는 별칭을 두어 `information-extractor.handler.ts` 의 기존 import 를 깨지 않도록 한다. 충돌 아님 — 이동 계획 명확화 권장.

## 요약

`spec/4-nodes/3-ai` 는 `AiMemoryManager` 추출(M-1 2단계)의 구현 기준이 되는 spec 영역이다. 이 spec 이 정의하는 config 필드(`memoryStrategy`, `memoryTokenBudget`, `memoryKey`, `memoryTopK` 등), 출력 meta 필드(`meta.memory.*`), enum 값(`summary_buffer`/`persistent`/`manual`) 는 모두 spec 과 구현이 이미 일치 상태로 존재하며 신규 식별자 충돌이 없다. 신규 도입되는 식별자는 사실상 `AiMemoryManager` 클래스명과 `ai-memory-manager.ts` 파일 경로뿐이며, 기존 `AgentMemoryService`(도메인 모듈)·`AgentMemoryScheduler`(narrow interface) 와 의미·레이어가 명확히 구분된다. 발견된 세 항목은 모두 INFO 수준이며 구현 착수를 차단하지 않는다.

## 위험도

NONE

STATUS: SUCCESS
