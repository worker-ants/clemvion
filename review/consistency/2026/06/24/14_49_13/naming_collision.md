# 신규 식별자 충돌 검토 결과

대상: `plan/in-progress/spec-draft-m1-residual-sync.md`
검토 모드: spec draft (--spec)

---

## 발견사항

### 발견사항 없음 — 충돌 식별자 없음

target draft 가 도입하는 신규 식별자 전체를 아래 6개 관점으로 점검한 결과 **충돌 없음**.

#### 점검한 신규 식별자 목록

| 식별자 | 종류 | 편집 |
|---|---|---|
| `AiAgentHandler` | 클래스명 | 1-A 레이어 주석 |
| `AiTurnExecutor` | 클래스명 | 1-A, 1-B, 1-C |
| `AiConditionEvaluator` | 클래스명 | 1-A |
| `AiMemoryManager` | 클래스명 | 1-A, 1-D, 1-E, 1-F |
| `AiTurnOrchestrator` | 클래스명 | 1-A, 1-C |
| `executeSingleTurn` | 메서드명 | 1-B |
| `executeMultiTurn` | 메서드명 | 1-C |
| `processMultiTurnMessage` | 메서드명 | 1-C |
| `injectMemoryContext` | 메서드명 | 1-D, 1-E |
| `scheduleMemoryExtraction` | 메서드명 | 1-F |
| `ToolCallTrace` | 인터페이스명 | 1-G |
| `startedAt?` / `finishedAt?` | 필드명 | 1-G |
| `ai-agent/ai-turn-executor.ts` | 파일 경로 | 1-B, 1-C, 1-G |
| `ai-agent/ai-memory-manager.ts` | 파일 경로 | 1-D, 1-E, 1-F |
| `shared/agent-memory-injection.ts` | 파일 경로 | 1-D, 1-E, 1-F |
| `modules/execution-engine/ai-turn-orchestrator.service.ts` | 파일 경로 | 1-A, 1-C |

#### 관점별 결과

**1. 요구사항 ID 충돌**
target draft 는 요구사항 ID(ND-AG-* 등)를 신규 부여하지 않는다. doc-sync 편집만 수행. 충돌 없음.

**2. 엔티티/타입명 충돌**

- `AiTurnExecutor`, `AiConditionEvaluator`, `AiMemoryManager`, `AiTurnOrchestrator`, `AiAgentHandler` — 기존 spec `1-ai-agent.md` frontmatter `code:` (L5~15) 및 §6.1 단계 3.a (L373), §10 에러 분류 (L1104) 에 이미 등재된 이름과 **동일한 의미로 참조**. 새 의미를 부여하지 않고 기존 코드 구현체를 가리키는 참조만 추가. 충돌 없음.
- `ToolCallTrace` — `ai-turn-executor.ts:59` 의 `export interface ToolCallTrace` 가 단일 진실. spec 어디에도 동명 인터페이스가 다른 의미로 정의된 곳 없음. `LlmCallRecord` (`llm-call-record.ts`) 는 `llmCalls[]` 항목용 별개 타입이며 스펙 L1072 에서도 명시적으로 구분됨. 충돌 없음.
- `AiMemoryManager` vs `AgentMemoryService` — 이름이 근접하나 완전히 별개 클래스. `AiMemoryManager` = node-layer 오케스트레이터 (컨텍스트 조립·enqueue 담당), `AgentMemoryService` = module-layer 영속 I/O 담당. `ai-memory-manager.ts` JSDoc (L46-48) 에 레이어 분리가 이미 명시됨. spec 에서 `AgentMemoryService` 를 사용하는 문서(`3-information-extractor.md`, `data-flow/13-agent-memory.md`)는 다른 레이어를 기술하며 `AiMemoryManager` 와 교체 관계가 아님. 충돌 없음.

**3. API endpoint 충돌**
target draft 는 API endpoint 를 도입하지 않는다. 해당 없음.

**4. 이벤트/메시지명 충돌**
target draft 는 webhook·SSE·queue 이벤트명을 신규 도입하지 않는다. 해당 없음.

**5. 환경변수·설정키 충돌**
target draft 는 ENV var, config key 를 신규 도입하지 않는다. 해당 없음.

**6. 파일 경로 충돌**

- `ai-agent/ai-turn-executor.ts` — 실제 파일 `/codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` 존재 확인. spec frontmatter `code:` (L8) 에 이미 등재. 충돌 없음.
- `ai-agent/ai-memory-manager.ts` — 실제 파일 존재 확인. frontmatter `code:` (L7) 에 등재. 충돌 없음.
- `shared/agent-memory-injection.ts` — 실제 파일(`/codebase/backend/src/nodes/ai/shared/agent-memory-injection.ts`) 존재 확인. frontmatter `code:` (L12) 에 등재. `data-flow/13-agent-memory.md` (L38) 에도 동일 경로 참조. 충돌 없음.
- `modules/execution-engine/ai-turn-orchestrator.service.ts` — 실제 파일 존재 확인. frontmatter `code:` (L15) 에 등재. 충돌 없음.

**추가 확인 — `startedAt?`/`finishedAt?` 필드 의미 중복 여부**

편집 1-G 가 `ToolCallTrace` 에 추가하는 `startedAt?`/`finishedAt?` 는 `spec/5-system/6-websocket-protocol.md` §4.4 (L586, L605, L646) 에서 `tool_call_started`/`tool_call_completed` 이벤트의 같은 이름 필드와 **동일한 의미**(tool 실행 시작/종료 절대 시각 ISO8601)로 이미 정의되어 있으며, 코드 `ai-turn-executor.ts:65-68` 의 JSDoc 에도 "spec/5-system/6-websocket-protocol.md §4.4 정합"으로 명시됨. 이는 충돌이 아닌 일관된 동일 의미 참조. `llmCalls[].startedAt`/`finishedAt` (L1072 `LlmCallRecord`) 는 LLM 호출용 별개 타입의 필드로 `ToolCallTrace.startedAt`/`finishedAt` (tool 실행용) 과 동일 이름이지만 각자 다른 타입 컨텍스트에 속하며 spec L1072 및 WS §4.4 문서가 양자를 구분해 기술함. 의미 충돌 없음.

**추가 확인 — `scheduleMemoryExtraction` 이름 중복**

`AiMemoryManager.scheduleMemoryExtraction` (메서드) 와 `shared/agent-memory-injection.ts` 의 export function `scheduleMemoryExtraction` 는 동명이나, 전자가 후자를 내부적으로 `sharedScheduleMemoryExtraction` 별칭으로 import 해 위임한다(`ai-memory-manager.ts:17`). target draft 는 `AiMemoryManager.scheduleMemoryExtraction` (public 메서드) 를 doc 참조 진입점으로 기술하며, 공유 헬퍼는 "(공유 헬퍼는 `shared/agent-memory-injection.ts`)" 로 구분 표기함. spec 어디에도 두 이름을 다른 의미로 혼용하는 곳 없음. 충돌 없음.

---

## 요약

target draft(M-1 잔여 doc-sync 편집안)가 도입하는 모든 신규 식별자는 M-1 분할로 생성된 코드 구현체(`ai-turn-executor.ts`, `ai-memory-manager.ts`, `ai-condition-evaluator.ts`, `ai-turn-orchestrator.service.ts`, `agent-memory-injection.ts`)와 1:1 대응하며, 기존 spec 및 코드에서 다른 의미로 사용 중인 이름이 없다. `ToolCallTrace.startedAt/finishedAt` 과 `LlmCallRecord.startedAt/finishedAt` 는 동명 필드이지만 각각 별개 타입에 속하고 기존 WS spec §4.4 가 양자를 명확히 구분해 정의하므로 혼선 우려가 없다. 요구사항 ID·API endpoint·이벤트명·ENV var·설정키·파일 경로 관점에서도 신규 충돌은 발견되지 않았다.

## 위험도

NONE
