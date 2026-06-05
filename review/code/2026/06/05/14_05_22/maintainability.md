# 유지보수성 코드 리뷰

- **대상**: `git diff 9e65f853..HEAD -- codebase/`
- **핵심 파일**: `shared/conversation-context-injection.ts`, `shared/conversation-context-schema.ts`
- **검토일**: 2026-06-05

---

## CRITICAL

없음.

---

## WARNING

### W1 — 동일 값 `20` 을 참조하는 상수가 두 곳에 독립 정의됨 (잠재 drift)

- **위치**: `shared/conversation-context-injection.ts:26` (`DEFAULT_CONVERSATION_CONTEXT_SCOPE_N = 20`) vs `shared/conversation-context-schema.ts:24` (`DEFAULT_CONTEXT_SCOPE_N = 20`)
- **상세**: 두 상수는 같은 값 `20` 을 가지며 논리적으로 동일한 "lastN 기본값"이다. 그러나 `injection.ts` 는 `schema.ts` 를 import 하지 않고 독립 선언한다. 헤더 주석("동치")으로 의도를 문서화했지만, 이는 텍스트 약속일 뿐 컴파일-타임 보장이 없다. 훗날 한쪽만 변경하면 schema 기본값과 handler fallback 이 조용히 어긋난다.
- **제안**: `injection.ts` 에서 `DEFAULT_CONVERSATION_CONTEXT_SCOPE_N` 을 삭제하고 `conversation-context-schema.ts` 의 `DEFAULT_CONTEXT_SCOPE_N` 을 직접 import 해서 사용한다. 둘은 peer 모듈(shared/shared)이므로 순환 의존 없음.

### W2 — `includeToolTurns` 필드가 text_classifier·information_extractor schema 에 추가됐으나 두 핸들러에서 읽히지 않음

- **위치**: `conversation-context-schema.ts:109-124` (5필드 fragment), `text-classifier.handler.ts`, `information-extractor.handler.ts` 전체
- **상세**: `buildConversationContextSchemaFields` 는 `includeToolTurns` 를 포함한 5필드를 일괄 노출한다. text_classifier·information_extractor 는 도구(tool) 호출 루프가 없으므로 이 필드가 UI 에 표시되지만 handler 에서 아무 효과가 없다. 사용자가 토글을 켜도 무시된다. 현재는 ai_agent 전용 의미를 가진 필드가 두 노드에 무의미하게 노출된다.
- **제안 A**: `buildConversationContextSchemaFields` 의 `opts` 에 `includeToolTurnsField?: boolean` 을 추가해 두 노드 호출 시 생략, 해당 필드를 반환 객체에서 제외한다. **제안 B**: `excludeFromConversationThread` 와 `includeToolTurns` 를 별도 `buildThreadPushSchemaFields` fragment 로 분리해 노드별 선택적 조합을 허용한다.

### W3 — multi-turn `executeMultiTurn` 의 no-inputField 조기 반환 경로가 context injection 을 건너뜀

- **위치**: `information-extractor.handler.ts:413-428` (early exit `if (!inputField)`)
- **상세**: inputField 없이 대기 상태를 반환하는 경로에서는 `injectConversationContext` 가 호출되지 않는다. 이후 재진입 시 `_resumeState.messages` 는 system 메시지만 담으므로 thread context 없이 LLM 에 보내진다. 헤더 주석("첫 진입 시 1회")이 이 경로를 명시하지 않아, 의도된 누락인지 버그인지 불명확하다.
- **제안**: 의도된 누락이라면 `// no-inputField: context injection is deferred to the first resume entry` 같은 주석으로 이유를 명시한다. 버그라면 해당 경로에도 injection 을 적용하되, 결과 messages 를 state 에 싣는다.

---

## INFO

### I1 — `injectConversationContext` 결과의 `.injection` 메타가 text_classifier·information_extractor 에서 묵살됨

- **위치**: `text-classifier.handler.ts:191`, `information-extractor.handler.ts:237`
- **상세**: 두 핸들러는 결과에서 `.messages` 만 사용하고 `.injection` (appliedScope/injectedTurns/…) 은 접근하지 않는다. ai-agent 는 이 메타를 `contextInjection` output field 에 포함한다. 현재로서는 단순 미구현 차이지만, ai-agent 와 두 노드 간 output schema 일관성 격차다.
- **제안**: 단기적으로는 무해하다. 두 노드의 output spec 에서도 `contextInjection` debug field 가 필요한지 확인해 정책을 통일한다.

### I2 — `DEFAULT_CONTEXT_SCOPE_N` re-export alias 가 불필요한 간접 계층을 만듦

- **위치**: `ai-agent.schema.ts:10,23` (`import { DEFAULT_CONTEXT_SCOPE_N as SHARED_DEFAULT_CONTEXT_SCOPE_N }` 후 동일 이름으로 재내보냄)
- **상세**: ai-agent.schema 가 외부에 동일 이름으로 재내보내는 것은 하위호환 목적으로 문서화됐다. 그러나 이 export 를 실제로 import 하는 곳이 handler 에 없다. re-export 가 순수 dead-code 인지 외부 소비자용인지 명시가 부족하다.
- **제안**: `grep -r "from.*ai-agent.schema.*DEFAULT_CONTEXT_SCOPE_N"` 로 실제 소비자를 확인하고, 없다면 alias 를 제거해 ai-agent.schema 의 표면을 줄인다. 있다면 JSDoc `@deprecated` 와 migration path 를 추가한다.

### I3 — `buildConversationContextSchemaFields` 가 `group` 파라미터를 노출하지 않음 (sister 헬퍼 `buildSystemContextSchemaFields` 와 불일치)

- **위치**: `conversation-context-schema.ts:45-48` vs `system-context-schema.ts:46-48`
- **상세**: `buildSystemContextSchemaFields(orderStart, group?)` 는 group 을 파라미터로 받아 필요하면 재정의할 수 있다. 반면 `buildConversationContextSchemaFields` 는 내부 `const GROUP = 'Conversation Context'` 로 하드코딩하고 파라미터를 받지 않는다. 현재 3 노드 모두 같은 그룹명을 쓰므로 문제없지만, 추후 다른 그룹명이 필요한 노드가 추가되면 API 를 변경해야 한다.
- **제안**: `opts` 에 `group?: string` 을 추가하거나, sister 헬퍼처럼 두 번째 positional 파라미터로 노출해 API 를 일관되게 한다.

### I4 — `selfNodeId: context.nodeId ?? ''` 가 두 핸들러에서 지역변수 `id` 와 독립적으로 반복됨

- **위치**: `text-classifier.handler.ts:69,182`, `information-extractor.handler.ts:155,229,440`
- **상세**: 두 핸들러 모두 `const id = context.nodeId ?? ''` 로 지역 변수를 선언하고, `injectConversationContext` 호출 시에는 `selfNodeId: context.nodeId ?? ''` 를 다시 inline 으로 쓴다. 동일 표현식이 3-4 회 등장한다.
- **제안**: `injectConversationContext` 호출 시 지역변수 `id` 를 재사용한다 (`selfNodeId: id`). 변경 비용이 낮고 일관성이 높아진다.

---

## 요약

이번 변경은 AI 카테고리 3 노드 공통 로직을 `shared/conversation-context-injection.ts` 와 `shared/conversation-context-schema.ts` 로 잘 추출했으며, ai-agent 에서 85줄의 private 메서드 및 55줄의 schema 중복을 제거한 점에서 유지보수성이 실질적으로 개선됐다. 문서 주석과 spec 참조도 충분하다. 다만 두 shared 파일 사이에 `DEFAULT_*` 상수가 복제 정의돼 drift 위험이 남고(W1), `includeToolTurns` 가 tool-loop 없는 두 노드에도 무조건 노출되어 사용자 혼란과 "옵션이 있는데 동작 안 함" 문제가 예상된다(W2). multi-turn no-inputField 경로의 injection 누락은 의도를 명시하지 않으면 추후 버그 리포트로 이어질 수 있다(W3). 나머지는 sister 헬퍼와의 API 미정렬 및 코드 중복으로 즉각적 장애는 없지만 점진적으로 정비할 가치가 있다.

## 위험도

MEDIUM

---

BLOCK: NO
