# 변경 범위 리뷰 — A2 contextScope 확장

**worktree**: `memory-autoinject-extend-e102af`
**range**: `git diff 9e65f853..HEAD`
**검토 기준**: contextScope inject 를 두 노드로 확장 + 공유 유틸 추출

---

## CRITICAL

없음.

---

## WARNING

### W1 — 프론트엔드 docs 에 5필드 중 2필드만 노출 (부분 누락)

- **위치**: `codebase/frontend/src/content/docs/02-nodes/ai.en.mdx`, `ai.mdx` (text_classifier / information_extractor 각 섹션)
- **상세**: schema 와 spec 에는 `contextScope` / `contextScopeN` / `contextInjectionMode` / `includeToolTurns` / `excludeFromConversationThread` 5필드가 추가됐다. 그러나 user-facing docs 에는 `contextScope` / `contextScopeN` 2개만 추가되고 `contextInjectionMode` / `includeToolTurns` / `excludeFromConversationThread` 3필드는 문서에 반영되지 않았다. AI Agent 섹션에는 이 5필드가 이미 문서화돼 있어 기준이 되는데, 두 신규 노드 docs 는 일관성이 없다.
- **제안**: `ai.en.mdx` / `ai.mdx` 의 text_classifier·information_extractor 파라미터 표에 나머지 3필드(`contextInjectionMode`, `includeToolTurns`, `excludeFromConversationThread`)를 추가하거나, 의도적으로 축약한 것이라면 spec text_classifier.md·information_extractor.md 와 동기화 이유를 명시.

---

## INFO

### I1 — memoryStrategy 관련 변경: 범위 내 (동작 불변, 참조/주석 정리만)

- **위치**: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.schema.ts`, `ai-agent.handler.ts`
- **상세**: `memoryStrategy` 필드 정의·동작 자체는 변경되지 않았다. schema 에서 contextScope 5필드를 `buildConversationContextSchemaFields(37, { gateOnManualMemoryStrategy: true })` 로 교체한 것은 AI Agent 의 기존 `visibleWhen: { field: 'memoryStrategy', equals: 'manual' }` 가드를 보존하면서 공유 fragment 로 이전한 것이며 동치(order 37-41, visibleWhen/options/hint 100% 보존). handler 의 `injectThreadContext` 에서 `memoryStrategy ∈ {summary_buffer, persistent}` 자동 메모리 분기 로직은 건드려지지 않았고, 주석에도 "자동 메모리 경로는 호출부(execute)가 strategy 로 분기" 명시. 범위 밖 변경 아님.

### I2 — information-extractor.component.ts `conversationThreadService` 주입 추가

- **위치**: `codebase/backend/src/nodes/ai/information-extractor/information-extractor.component.ts`
- **상세**: `createHandler: (deps) => new InformationExtractorHandler(deps.llmService)` → `deps.conversationThreadService` 추가. text_classifier 는 merge-base 이미 `conversationThreadService` 를 전달하고 있었고, information_extractor 만 누락 상태였다. 이번 inject 기능 배선에 필수 변경 — 범위 내. constructor 시그니처는 이전부터 optional parameter 로 선언돼 있었으므로 하위호환 변경이다.

### I3 — `buildSystemContextSchemaFields` order 인자 변경 (10→15, 9→14)

- **위치**: `information-extractor.schema.ts` (10→15), `text-classifier.schema.ts` (9→14)
- **상세**: Conversation Context 5필드(order+0..+4)가 System Context Prefix 앞에 삽입됨에 따라 기존 System Context order 를 5 밀어올린 것. UI order 충돌 방지를 위한 필수 조정 — 범위 내.

### I4 — `DEFAULT_CONTEXT_SCOPE_N` re-export 처리

- **위치**: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.schema.ts` (line 19-22)
- **상세**: `DEFAULT_CONTEXT_SCOPE_N = 20` 을 `SHARED_DEFAULT_CONTEXT_SCOPE_N` 의 re-export 로 교체. 기존 외부 참조 파일이 있을 경우 import 경로 변경 없이 동일 값을 유지해 하위호환 보존. 단일 진실 이전에 따른 정상 처리.

### I5 — spec 변경 범위 비례성

- **위치**: `spec/4-nodes/3-ai/0-common.md`, `spec/4-nodes/3-ai/2-text-classifier.md`, `spec/4-nodes/3-ai/3-information-extractor.md`, `spec/conventions/conversation-thread.md`, `spec/4-nodes/3-ai/1-ai-agent.md`
- **상세**: 모든 spec 변경은 A2 기능과 직결된다 — §10 inject 적용 범위 갱신, 두 노드 config 표 신규 5필드 추가, §2.3 로드맵 항목 채택 완료 처리. `1-ai-agent.md` 는 내부 앵커 링크(`#5-ai-agent-자동-주입` → `#5-contextscope-자동-주입-세-ai-노드-공통`) 단 1줄만 변경 — §5 헤더 변경에 따른 참조 정합 필수 수정. 범위에 비례.

---

## 요약

20개 파일 변경 중 범위 밖 변경은 발견되지 않았다. `memoryStrategy` 정의·동작은 완전히 불변이며 공유 fragment 로의 교체는 동치 리팩토링이다. `ai_agent` 동작 변경도 없고 순수한 추출·위임만 이뤄졌다. `information-extractor.component.ts` 의 `conversationThreadService` 주입은 inject 기능 배선에 필수다. 유일한 지적 사항은 W1 — 프론트엔드 docs 에 5필드 중 3필드(`contextInjectionMode`, `includeToolTurns`, `excludeFromConversationThread`)가 누락됐다는 것으로, 실제 기능(schema·handler·spec)에는 반영됐으나 사용자 문서화가 불완전하다. 기능·동작 자체를 블록할 수준은 아니나 릴리즈 전 보완이 권장된다.

---

## 위험도

LOW

---

BLOCK: NO
