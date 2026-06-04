# Testing Review — ai-context-memory (Phase B~F)

## 발견사항

### [INFO] spec 변경(conversation-thread.md)은 테스트 대상이 아님
- 위치: `spec/conventions/conversation-thread.md`
- 상세: 변경 내용은 `pending_plans` frontmatter 의 plan 파일명 업데이트(`ai-context-memory-auto.md` → `ai-context-memory-followup-v2.md`) 뿐이다. 메타데이터 변경이며 코드·동작에 영향 없음.
- 제안: 해당 없음.

---

### [INFO] 신규 테스트 파일 5개 — 핵심 경로 모두 단위 테스트 작성됨
- 위치:
  - `/codebase/backend/src/nodes/ai/ai-agent/ai-agent.memory.spec.ts` (12 케이스)
  - `/codebase/backend/src/nodes/ai/ai-agent/agent-memory-injection.spec.ts` (11 케이스)
  - `/codebase/backend/src/modules/agent-memory/agent-memory.service.spec.ts` (20 케이스)
  - `/codebase/backend/src/modules/agent-memory/queues/agent-memory-extraction.processor.spec.ts` (7 케이스)
  - `/codebase/backend/src/modules/agent-memory/queues/agent-memory-extraction.queue.spec.ts` (10 케이스)
- 상세: `summary_buffer` 전략(예산 미만 no-op, 예산 초과 압축, 캐시 보호 불변식, 빈 응답 graceful), `persistent` 전략(recall 주입, 스코프 키 resolve, 추출 enqueue), `manual` 하위호환, 큐 격리·graceful 실패 등 핵심 경로가 모두 커버된다.
- 제안: 해당 없음.

---

### [WARNING] `summary_buffer` multi-turn 경로 단위 테스트 미작성
- 위치: `ai-agent.memory.spec.ts`
- 상세: `summary_buffer` 케이스는 single-turn 2개만 존재한다(`describe('summary_buffer (single-turn)')`). `processMultiTurnMessage` 경유 시 multi-turn에서 `runningSummary`가 state에 올바르게 저장·재로드되어 압축이 매 turn 재적용되는 경로(spec §6.2 d.5: 매 turn 재적용)는 테스트되지 않는다. 핸들러 코드(`ai-agent.handler.ts:2340ff`)에 `summary_buffer` multi-turn 분기가 구현되어 있으나 검증 공백이다.
- 제안: `summary_buffer` + `multi_turn` 케이스 추가: 첫 turn에서 예산 초과 → `runningSummary` 저장 → 두 번째 turn에서 동일 thread를 재사용해 `runningSummary`가 stable prefix에 포함되는지 검증.

---

### [WARNING] `selectVolatileTail` 엣지 케이스 — 모든 turn이 요약된 경우 미검증
- 위치: `agent-memory-injection.spec.ts:76-79`
- 상세: `selectVolatileTail(turns, 1)` 케이스(seq 2, 3만 남음)는 있으나, `summarizedUpToSeq`가 마지막 turn의 seq 이상일 때(휘발성 꼬리가 0개인 경우) 결과가 빈 배열인지 검증이 없다. `buildSummaryBufferUpdate`의 `MIN_RECENT_RAW_TURNS(2)` 경계 보호가 실제로 작동하는 edge case다.
- 제안: `selectVolatileTail(turns, 3)` (마지막 seq = 3이면 결과가 빈 배열), `selectVolatileTail([], undefined)` 빈 배열 케이스 추가.

---

### [WARNING] `recall` 실패 시 graceful 처리가 `ai-agent.memory.spec.ts` 에서 검증 안 됨
- 위치: `ai-agent.memory.spec.ts`
- 상세: `agent-memory.service.spec.ts`에는 `임베딩/SQL 에러는 throw 하지 않고 빈 배열로 graceful` 케이스가 있으나, 핸들러 레벨에서 `agentMemoryService.recall`이 빈 배열을 반환할 때(=graceful 실패 경로) 핸들러가 정상 응답을 내보내는지 통합적 검증이 없다. 특히 `recall` 결과 0건 케이스는 "recalledCount=0" 테스트로 간접 커버되지만, recall 자체가 예외 발생 후 `[]`로 degrade 되는 경로(서비스 내부 catch → `[]` 반환)는 핸들러 수준 통합 케이스가 없다.
- 제안: `agentMemoryService.recall.mockRejectedValue(new Error('provider down'))` 설정 후 핸들러가 정상 응답을 반환하는지 검증하는 케이스 추가.

---

### [WARNING] 크로스 워크스페이스 격리(테넌트 분리) 단위 테스트 없음
- 위치: `agent-memory.service.spec.ts`
- 상세: `recall`/`saveMemories` 테스트는 `ws-1` 단일 워크스페이스만 사용하며, 다른 워크스페이스(`ws-2`)의 데이터가 SQL 파라미터에 포함되지 않는다는 직접 검증이 없다. `workspace_id = $2` SQL 파라미터 바인딩 검증 테스트(`params[1] === 'ws-1'`)가 있어 간접 커버는 되지만, `ws-2`로 요청 시 `ws-1` 데이터를 조회하지 않는다는 명시적 격리 케이스가 없다.
- 제안: `recall('ws-2', 'scope-1', 'q', ...)` 호출 시 SQL params에 `ws-2`가 바인딩되고 `ws-1`이 아닌지 검증하는 케이스 추가 (보안 격리 불변식 명시).

---

### [WARNING] `stripMemoryBlocks` multi-turn 누적 방지 케이스 미작성
- 위치: `agent-memory-injection.spec.ts`
- 상세: `stripMemoryBlocks`가 단일 적용에서 제거되는 것만 검증(line 65-73)한다. multi-turn에서 `appendStablePrefix` → `stripMemoryBlocks` → `appendStablePrefix`를 반복할 때 블록이 중첩 누적되지 않는다는 왕복(round-trip) 케이스가 없다. 핸들러 주석(`processMultiTurnMessageInner` 직전 `stripMemoryBlocks`)에서 이 순서가 핵심 불변식이므로 검증이 필요하다.
- 제안: `appendStablePrefix` 2회 연속 적용 후 블록 개수가 1개인지 검증하는 round-trip 케이스 추가.

---

### [INFO] `app.module.spec.ts` — `AgentMemory` 엔티티 ROOT_ENTITIES 등록 검증
- 위치: `/codebase/backend/src/app.module.spec.ts`
- 상세: `AgentMemory` 엔티티가 `REQUIRED_ENTITIES` 배열에 포함되어 있어 `TypeOrmModule` 루트 등록 누락에 의한 `No metadata for "AgentMemory" was found` 회귀를 자동 차단한다. 의도된 회귀 방지 커버리지.
- 제안: 해당 없음.

---

### [INFO] `ai-agent.schema.spec.ts` — 신규 Memory 필드 기본값·스키마 검증 완비
- 위치: `/codebase/backend/src/nodes/ai/ai-agent/ai-agent.schema.spec.ts`
- 상세: `memoryStrategy` 기본값(`manual`), `memoryTokenBudget` 기본값(`8000`), `summary_buffer`/`persistent` 수락, 알 수 없는 값 거부, JSON Schema `visibleWhen`/`group` 메타데이터 직렬화 등 모두 커버. 하위호환 불변식(기존 워크플로에 `memoryStrategy` 없을 때 `manual`로 파싱) 검증 포함.
- 제안: 해당 없음.

---

### [INFO] 프론트엔드 CT-S9~CT-S11 (`system_error`) 커버됨, CT-S12~CT-S14도 부분 커버됨
- 위치:
  - `use-execution-events.test.ts` (CT-S9, CT-S10, CT-S11 명시)
  - `execution-store.test.ts` (CT-S12의 `resumeFromAiRenderForm` Inv-7)
  - `assistant-presentations-block.test.tsx` (CT-S13)
- 상세: spec §9.10의 CT-S9~S13 회귀 시나리오 테스트가 실제 구현되어 있다. CT-S14(`render_form bypass` 시 cancelled 처리)는 `ai-agent.handler.test` + integration으로 위임되어 있으나 해당 파일이 변경 집합에 없음.
- 제안: CT-S14에 해당하는 handler 단위 테스트 추가 여부 확인 필요.

---

### [INFO] `AgentMemoryExtractionProcessor` — turns 빈 케이스·transcript 빈 케이스 분리 검증
- 위치: `agent-memory-extraction.processor.spec.ts:97-110`
- 상세: `turns: []` no-op, `system` turn 만 있는 경우의 빈 transcript → LLM 미호출, `workspaceId`/`scopeKey` 결손 등 graceful no-op 경로가 별도 케이스로 검증됨.
- 제안: 해당 없음.

---

### [INFO] Mock 적절성 — 의존성 모두 Jest mock으로 격리, 테스트 간 beforeEach로 리셋
- 위치: 전체 spec 파일
- 상세: `LlmService`, `DataSource`, `BullMQ Queue`, `ConversationThreadService`를 모두 Jest mock으로 주입하며 `beforeEach`에서 초기화한다. 테스트 간 상태 오염 없음. `ConversationThreadService`는 실제 구현을 사용(`new ConversationThreadService()`)해 thread mutation 검증이 실제 동작과 일치한다.
- 제안: 해당 없음.

---

### [INFO] e2e 테스트 미작성 — 신규 BullMQ 큐 실제 연결 경로 미검증
- 위치: `codebase/backend/test/`
- 상세: 기존 e2e 파일들에 `agent-memory`, `agentMemory`, `memoryStrategy`에 대한 테스트가 없다. 단위 테스트는 큐를 mock으로 대체하므로, BullMQ Redis 큐 실제 연결·워커 등록·추출 job 처리 end-to-end 경로는 검증되지 않는다. spec의 "hot path 비차단 invariant"가 실 Redis 환경에서 지켜지는지 검증이 없다.
- 제안: 단기: 현행 e2e 환경이 Redis를 포함하는 경우 `workflow-execution.e2e-spec.ts`에 `persistent` 전략 AI Agent 노드 실행 + 추출 job enqueue 시나리오 추가. 중기: spec §7 v2 로드맵 `memoryStrategy` e2e 시나리오.

---

## 요약

자동 컨텍스트 메모리(`summary_buffer` / `persistent`) 기능에 대해 60개 이상의 단위 테스트가 신규 작성되었으며, 핵심 불변식(캐시 보호, graceful 실패, 하위호환, 격리, enqueue 안전성)을 직접 검증한다. 테스트 구조는 단일 책임 분리(`injection.spec` / `service.spec` / `processor.spec` / `queue.spec` / `memory.spec`)가 명확하고 mock 격리가 적절하다. 주요 갭은 `summary_buffer` multi-turn 경로 미검증, `recall` 실패 graceful degrade 핸들러 수준 검증 부재, `stripMemoryBlocks` round-trip 케이스 누락이며, 이는 예산 초과 → 요약 → 재사용 핵심 흐름이 실제 multi-turn 환경에서 검증되지 않는다는 점에서 WARNING 수준이다. e2e 테스트가 전무하지만 신규 인프라(BullMQ 큐)를 고려하면 단기 미흡 수준이다.

## 위험도

MEDIUM
