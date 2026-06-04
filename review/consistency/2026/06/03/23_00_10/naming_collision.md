# 신규 식별자 충돌 검토 결과

**검토 대상**: `spec/4-nodes/3-ai/` (diff-base=origin/main, --impl-done)
**검토 일시**: 2026-06-03

---

## 발견사항

### 발견 없음 (NONE 등급 항목)

분석 결과 아래 6개 관점 모두에서 충돌이 발견되지 않았다.

**1. 요구사항 ID 충돌**

target 에서 사용되는 `ND-AG-*` 번호들을 전수 비교했다. `ND-AG-26` 은 `spec/4-nodes/_product-overview.md` 와 `spec/4-nodes/3-ai/_product-overview.md` 양쪽에 동일한 의미(Presentation Tool Family)로 병존하며, 양측의 내용이 같은 기능을 가리킨다. 정의 중복이지만 의미 충돌이 아니다. `ND-AG-22` ~ `ND-AG-26` 은 두 파일 간 내용이 정합한다.

**2. 엔티티/타입명 충돌**

target 이 도입한 신규 타입·구조체명:
- `McpServerRef` — 기존 spec 어디서도 다른 의미로 쓰이지 않는다.
- `ConditionDef` — 기존 spec 어디서도 다른 의미로 쓰이지 않는다.
- `PresentationToolDef` — `spec/4-nodes/6-presentation/0-common.md` 에서 동일 개념의 cross-ref 로 참조되며, `codebase/backend/src/nodes/ai/ai-agent/ai-agent.schema.ts` 에서 `PresentationToolDef` 타입으로 구현되어 있다. 의미 충돌 없음.
- `PresentationPayload` — `spec/4-nodes/3-ai/1-ai-agent.md §7.10` 이 단일 진실로 명시하고, `spec/5-system/15-chat-channel.md` 등이 cross-ref로만 사용한다. 충돌 없음.

config 필드명:
- `includeSystemContext` / `systemContextSections` — `spec/4-nodes/3-ai/0-common.md §11.1` 이 3노드 공통으로 신설했으며, 기존 spec 어디서도 다른 의미로 쓰이지 않는다. 코드베이스 (`system-context-schema.ts`) 에도 동일 의미로 구현되어 있다.
- `memoryStrategy` / `memoryTokenBudget` / `memoryKey` / `memoryTopK` / `memoryThreshold` — 해당 키워드가 기존 spec 어디서도 다른 의미로 쓰이지 않는다. `spec/5-system/17-agent-memory.md` 가 단일 진실을 보유하며 target 이 참조만 한다.
- `contextScope` / `contextScopeN` / `contextInjectionMode` / `includeToolTurns` / `excludeFromConversationThread` — `spec/conventions/conversation-thread.md` 및 `spec/4-nodes/6-presentation/0-common.md` 에서 동일 의미로 참조된다. 충돌 없음.

`excludeFromConversationThread` 는 presentation 노드(§6-presentation/0-common.md §2.1)에도 같은 이름으로 존재하나 의미가 다소 다르다. AI 노드에서는 "AI node의 user/assistant turn을 thread에서 제외", presentation 노드에서는 "form 제출/버튼 클릭 interaction을 thread에서 제외"다. 그러나 두 맥락 모두 "이 노드 자신의 turn/interaction을 thread push에서 opt-out"이라는 상위 의미가 동일하고, `spec/conventions/conversation-thread.md §2.3`이 이 필드의 공통 의미를 명시하고 있다. 의미 충돌로 볼 수 없다.

**3. API endpoint 충돌**

target 문서(`spec/4-nodes/3-ai/`)는 신규 REST endpoint를 정의하지 않는다. 내부 노드 핸들러 로직 spec이므로 endpoint 충돌 해당 없음.

**4. 이벤트/메시지명 충돌**

`meta.interactionType: 'ai_form_render'` 와 `'ai_conversation'` 은 기존 `spec/conventions/interaction-type-registry.md` 의 `WaitingInteractionType` 4값 레지스트리에 이미 등록되어 있다. target 이 이 값들을 참조만 하며 새로 도입하지 않는다. 충돌 없음.

**5. 환경변수·설정키 충돌**

target 이 새로 정의하는 환경변수가 없다. `process.env.TZ` 참조는 기존 시스템 변수를 그대로 사용하는 것으로 신규 키 도입이 아니다.

**6. 파일 경로 충돌**

`spec/4-nodes/3-ai/0-common.md`, `1-ai-agent.md`, `2-text-classifier.md`, `3-information-extractor.md` 는 기존 파일들이며 이번 변경으로 신규 파일이 생성되지 않았다.

---

## 요약

`spec/4-nodes/3-ai/` 범위에서 target이 도입한 신규 식별자들(config 필드 `includeSystemContext`, `systemContextSections`, `memoryStrategy`, `memoryKey`, `memoryTopK`, `memoryThreshold`, `memoryTokenBudget`, 타입명 `McpServerRef`, `ConditionDef`, `PresentationToolDef`, `PresentationPayload`, 이벤트명 `ai_form_render`/`ai_conversation`, 요구사항 ID `ND-AG-22`~`ND-AG-26`)은 기존 spec 어디서도 다른 의미로 사용되지 않는다. `excludeFromConversationThread` 와 `render_*` 도구 이름들은 기존 spec(presentation 노드 공통, MCP 클라이언트 등)에서 동일 의미로 이미 참조되고 있어 정합성이 유지된다. 전 관점에서 충돌이 없다.

---

## 위험도

NONE
