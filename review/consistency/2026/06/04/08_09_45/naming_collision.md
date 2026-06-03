# 신규 식별자 충돌 검토

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/4-nodes/3-ai/, diff-base=origin/main)
Target: `spec/4-nodes/3-ai/0-common.md`, `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/4-nodes/3-ai/2-text-classifier.md`, `spec/4-nodes/3-ai/3-information-extractor.md`

---

## 발견사항

**충돌 없음** — 아래는 INFO 레벨 일관성 보완 제안이다.

---

- **[INFO]** `memoryStrategy` 등 신규 config 필드 — PRD 테이블 등재 확인
  - target 신규 식별자: `memoryStrategy`, `memoryTokenBudget`, `memoryKey`, `memoryTopK`, `memoryThreshold`
  - 기존 사용처: `spec/4-nodes/_product-overview.md` ND-AG-27~30 행, `spec/5-system/17-agent-memory.md` §22, `spec/conventions/conversation-thread.md` §5.3, `spec/1-data-model.md` §2.23 (AgentMemory 엔티티)
  - 상세: 신규 필드들은 `spec/4-nodes/_product-overview.md` 의 ND-AG-27~30 요구사항 행과 `spec/5-system/17-agent-memory.md` 에서 동일 의미로 이미 정의·참조되고 있다. `memoryTopK` / `memoryThreshold` 는 KB 검색용 `ragTopK` / `ragThreshold` 와 이름이 유사하나 두 spec 모두 "검색 대상이 다르다(`agent_memory` vs `KnowledgeBase`), 독립 필드" 라고 명시하고 있어 의미 혼동 가능성을 이미 해소한 상태다.
  - 제안: 충돌 없음. `meta.memory.{strategy, summarized, recalledCount, tokenBudgetUsed}` echo 가 ND-AG-30 에서 정의되어 있으나 target spec (`1-ai-agent.md §7.1`) 에서도 동일하게 기술되어 있으므로 일관성 유지.

- **[INFO]** `contextScope` / `contextScopeN` / `contextInjectionMode` / `includeToolTurns` / `excludeFromConversationThread` — conversation-thread 규약과 정합
  - target 신규 식별자: 위 5 필드 (AI Agent 공통 §10)
  - 기존 사용처: `spec/conventions/conversation-thread.md` §5 (§5.1 messages 모드 매핑, §5.3 cap, §5.4) 에서 동일 필드명으로 정의 및 캡 테이블 기술. `spec/4-nodes/_product-overview.md` ND-AG-07 "대화 히스토리(컨텍스트) 관리 ✅" 하위
  - 상세: conversation-thread spec 의 §5 에 `contextScope`(line 223~225) 과 `memoryStrategy` 관련 설명이 이미 기술되어 있어 target spec 과 동일 의미로 일관성 있게 사용 중이다. 의미 충돌 없음.
  - 제안: 충돌 없음.

- **[INFO]** `includeSystemContext` / `systemContextSections` — 3 노드 공통 신규 필드
  - target 신규 식별자: `includeSystemContext`, `systemContextSections` (AI 공통 §11.1)
  - 기존 사용처: `spec/4-nodes/3-ai/2-text-classifier.md` line 32-33, `spec/4-nodes/3-ai/3-information-extractor.md` line 32-33 에 이미 동일 명칭으로 등재됨. `spec/4-nodes/0-overview.md` line 38 에서 `ai/shared/system-context-prefix.ts` 구현 경로로 참조됨.
  - 상세: target 인 `0-common.md §11` 이 3 노드 공통 정의의 단일 진실(SoT)로 선언되어 있고, 개별 노드 spec 파일들이 이를 참조하는 구조다. 다른 영역(navigation·integration 등)에서 동일 이름의 설정 필드가 사용되지 않으므로 충돌 없음.
  - 제안: 충돌 없음.

- **[INFO]** `presentationTools` / `PresentationToolDef` / `render_*` 도구 이름군
  - target 신규 식별자: `presentationTools` (config 필드), `PresentationToolDef` (구조체), `render_table` / `render_chart` / `render_carousel` / `render_template` / `render_form` (LLM 도구 이름)
  - 기존 사용처: `spec/4-nodes/6-presentation/0-common.md` §10 (line 278-282), `spec/4-nodes/_product-overview.md` ND-AG-26, `spec/conventions/conversation-thread.md` §1.2 (line 59), `spec/conventions/interaction-type-registry.md` line 44
  - 상세: `presentationTools` / `PresentationToolDef` / `render_*` 는 target (`1-ai-agent.md §1, §4.1`) 과 `spec/4-nodes/6-presentation/0-common.md §10` 이 교차 참조하는 구조로 정의되어 있다. 도구 이름 prefix `render_` 는 기존 `kb_` / `mcp_` / `cond_` / `tool_` 와 disjoint 하고, AI Agent §4 의 "접두사로 도구 카테고리를 명확히 구분하여 이름 충돌 방지" 정책이 명시되어 있다. 의미 충돌 없음.
  - 제안: 충돌 없음.

- **[INFO]** `meta.memory.compactedMessages` — 현재 PRD 항목 미등재
  - target 신규 식별자: `meta.memory.compactedMessages` (`1-ai-agent.md §6.2 d.6`)
  - 기존 사용처: `spec/4-nodes/_product-overview.md` ND-AG-30 에서는 `meta.memory.{strategy, summarized, recalledCount, tokenBudgetUsed}` 만 언급. `compactedMessages` 는 ND-AG-30 행에 열거되지 않음.
  - 상세: 의미 충돌은 없으나 PRD 항목(ND-AG-30)과 spec 본문 간 열거 불일치. `_product-overview.md` ND-AG-30 이 `compactedMessages` 를 포함하지 않아 표면적인 drift 가 존재함.
  - 제안: `spec/4-nodes/_product-overview.md` ND-AG-30 의 메타 필드 열거에 `compactedMessages?` 를 추가하거나, ND-AG-30 본문을 "상세: [Spec AI Agent §7.1]" 참조로 단순화해 중복 열거를 제거.

- **[INFO]** `AgentMemory` 엔티티 vs `agent_memory` 테이블명 일관성
  - target 신규 식별자: `agent_memory` (테이블 참조, `1-ai-agent.md §6.1` 등)
  - 기존 사용처: `spec/1-data-model.md §2.23` — 엔티티 이름 `AgentMemory`, 테이블 `agent_memory`. `spec/5-system/17-agent-memory.md` 동일.
  - 상세: target spec 이 `agent_memory` (snake_case 테이블명) 로 일관되게 사용하고 있어 데이터 모델 정의와 정합함. 충돌 없음.
  - 제안: 충돌 없음.

---

## 요약

`spec/4-nodes/3-ai/` target 문서들이 도입하는 신규 식별자(config 필드: `memoryStrategy`/`memoryTokenBudget`/`memoryKey`/`memoryTopK`/`memoryThreshold`/`contextScope`/`contextScopeN`/`contextInjectionMode`/`includeToolTurns`/`excludeFromConversationThread`/`includeSystemContext`/`systemContextSections`/`presentationTools`; 구조체: `PresentationToolDef`; LLM 도구명: `render_*` 5종; 메타 필드: `meta.memory.*`) 가운데 다른 영역에서 동일 이름으로 다른 의미로 사용되거나 endpoint/이벤트가 중복 정의된 사례는 발견되지 않았다. 관련 타 spec(`conversation-thread.md`, `17-agent-memory.md`, `presentation/0-common.md`, `_product-overview.md` 등)이 같은 식별자를 동일 의미로 교차 참조하는 구조로 일관성 있게 유지되고 있다. 유일한 INFO 는 `meta.memory.compactedMessages` 가 `_product-overview.md` ND-AG-30 열거에 누락된 사소한 drift 이며, 의미 충돌은 아니다.

---

## 위험도

NONE
