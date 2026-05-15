## 발견사항

### [WARNING] Phase 번호 기반 주석 — 시간 경과 후 맥락 소실
- **위치**: `ai-agent.thread.spec.ts` 파일 최상단 주석, `execution-engine.service.spec.ts` L1553 `// Phase 3 hook —`
- **상세**: "Phase 4a", "Phase 3 hook" 같은 구현 단계 번호는 plan 문서가 complete 로 이동하면 추적 불가한 dead reference가 됨
- **제안**: 단계 번호 대신 spec 섹션 참조로 교체 — `// spec/conventions/conversation-thread.md §2.2` 형식이 이미 코드 전반에 사용되어 일관성도 얻음

---

### [WARNING] v2 로드맵 언급에 트래킹 참조 없음
- **위치**: `conversation-thread.types.ts` L17 `// NOTE: ... multi-thread 는 v2 로드맵`, `ai-agent.handler.ts` `buildAiNodeRefFromContext` JSDoc `// (until engine ships richer node metadata ... v2)`, `ai-agent.schema.ts` `// Removal scheduled with conversation-thread v2 work`
- **상세**: "v2"가 세 곳에 등장하지만 plan 파일이나 스펙 섹션 링크가 없어 버전 기준이 무엇인지 불명확. `DEFAULT_THREAD_ID` 의 NOTE 주석은 특히 향후 코드 수정자가 "v2가 됐나?"를 판단할 방법이 없음
- **제안**: `spec/conventions/conversation-thread.md` 또는 plan 문서에 v2 스코프를 기술하고 여기선 `// multi-thread support: see spec/conventions/conversation-thread.md §Roadmap` 으로 연결

---

### [WARNING] deprecated 필드에 폐기 시점 태그 부재
- **위치**: `ai-agent.schema.ts` `conversationHistory`, `maxHistoryCount` — `deprecated: true` 메타 추가
- **상세**: `deprecated: true` 플래그와 "Removal scheduled" 주석이 추가됐지만 deprecated 된 버전 또는 날짜 정보가 없어, 미래 개발자가 "이미 제거 가능한가, 아직인가"를 판단하기 어려움
- **제안**: 주석에 `// Deprecated: 2026-05-14 (conversation-thread v1)` 형식으로 날짜 기록

---

### [WARNING] `ConversationThreadService` 공개 메서드 개별 JSDoc 부재
- **위치**: `conversation-thread.service.ts` — `appendPresentationInteraction`, `appendAiUserMessage`, `appendAiAssistantMessage`
- **상세**: 클래스 레벨 JSDoc은 훌륭하나 세 public 메서드에 개별 문서가 없음. `appendAiToolResult`·`getThread`·`getThreadExcludingNode`·`lastN` 은 JSDoc 또는 인라인 주석이 있어 일관성이 깨짐
- **제안**: 최소 한 줄 JSDoc으로 통일 — 예: `/** presentation 노드 resume 시 interaction 을 thread 에 push. opt-out 검사 포함. */`

---

### [WARNING] `background-execution.queue.ts` — 인라인 import 타입 패턴
- **위치**: `background-execution.queue.ts` `conversationThread` 필드 선언
- **상세**: `conversationThread: import('../...').ConversationThread` 는 파일 최상단 import 없이 타입을 인라인 참조하는 비표준 패턴. 다른 필드들은 모두 top-level import를 사용해 일관성이 깨지며 IDE 툴팁·자동완성에서 타입 경로가 노출됨
- **제안**: 파일 상단에 `import type { ConversationThread } from '../conversation-thread/conversation-thread.types';` 를 추가하고 필드 타입을 `ConversationThread` 로 변경

---

### [INFO] `ConversationTurnToolCall` 인터페이스 JSDoc 없음
- **위치**: `conversation-thread.types.ts` L28–32
- **상세**: 공개 인터페이스 중 이 타입만 JSDoc 없이 `id`, `name`, `arguments` 세 필드만 있음. 동일 파일 내 `ConversationTurn`, `ConversationThread` 는 필드별 JSDoc이 상세해 불일치
- **제안**: `/** LLM 도구 호출 식별자. source='ai_assistant' turn 의 toolCalls 배열 원소. */` 한 줄로 충분

---

### [INFO] `ApplyCapResult` 인터페이스 JSDoc 없음
- **위치**: `thread-renderer.ts` L85–89
- **상세**: `applyCap` 의 반환 타입인 공개 인터페이스에 설명이 없음. `applyCap` 함수 자체는 상세한 JSDoc을 보유해 대비됨
- **제안**: `/** applyCap 결과 — cap 후 유지된 turns, 제거 수, 합산 chars. */` 한 줄 추가

---

### [INFO] `ai-agent.handler.ts` — `buildAiNodeRefFromContext` 의 known limitation 트래킹
- **위치**: `ai-agent.handler.ts` `buildAiNodeRefFromContext` JSDoc
- **상세**: "Engine doesn't yet propagate label/type; fall back to nodeId for label" 라는 중요한 known limitation이 문서화되어 있으나 이 격차를 추적하는 plan/spec 참조가 없음. 다음 개발자가 수정할 때 찾기 어려움
- **제안**: `// TODO: spec/4-nodes/3-ai/0-common.md 에 engine label 전파 추적` 형식으로 연결 지점 명시

---

## 요약

ConversationThread 기능 도입에 대한 문서화 품질은 전반적으로 **높은 수준**이다. `ExecutionContext.conversationThread` 의 mutation 계약, `ConversationThreadService` 의 단일 진입점 원칙, thread isolation 이유(background cloning), 그리고 `applyCap` 의 3단계 cap 규칙이 JSDoc·인라인 주석·spec 참조를 통해 상세히 설명되어 있다. 한국어·영어 혼용 주석은 팀 컨벤션에 맞게 일관되며, `SoT: spec/conventions/conversation-thread.md` 패턴으로 단일 진실 원칙이 코드 문서에도 반영되어 있다. 개선이 필요한 부분은 Phase 번호·v2 로드맵 등의 시간 기반 참조가 미래에 dead reference가 될 가능성과, 일부 public interface/method의 JSDoc 누락으로 인한 일관성 저하이며, 모두 현재 기능 동작에는 영향 없는 유지보수 관점의 사항이다.

## 위험도

**LOW**