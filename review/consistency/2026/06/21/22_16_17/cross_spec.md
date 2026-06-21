# Cross-Spec 일관성 검토 결과

**검토 모드**: 구현 완료 후 검토 (--impl-done, scope=spec/4-nodes/3-ai, diff-base=origin/main)
**Target**: `spec/4-nodes/3-ai` (0-common.md / 1-ai-agent.md / 3-information-extractor.md)
**검토일**: 2026-06-21

---

## 발견사항

### [INFO] ModelConfig 참조 관계 목록에 AI Agent 메모리 필드 미등재

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md §1` — `embeddingModelConfigId` / `summaryModelConfigId` / `extractionModelConfigId` 세 필드 (타입 `ModelConfig select`)
- **충돌 대상**: `spec/1-data-model.md §2.16 ModelConfig "참조 관계 (kind 별)"` (line 597)
- **상세**: `spec/1-data-model.md §2.16` 의 "참조 관계 (kind 별)" 블록은 ModelConfig 를 소비하는 모든 도메인을 열거한다. 현재 내용은 다음과 같다.
  - chat → `AI 노드 config.llmConfigId`·`AssistantSession.llm_config_id`·`llm_usage_log.llm_config_id`·`KnowledgeBase.extraction_llm_config_id`·`KnowledgeBase.rerank_llm_config_id`
  - embedding → `KnowledgeBase.embedding_model_config_id`
  - rerank → `KnowledgeBase.rerank_config_id`

  그러나 본 target spec(`agent-memory-model-select` plan 결과)이 새로 도입한 세 필드는 등재되지 않았다.
  - chat → (미등재) `AI 노드 config.summaryModelConfigId` / `AI 노드 config.extractionModelConfigId` (AI Agent 및 IE)
  - embedding → (미등재) `AI 노드 config.embeddingModelConfigId` (AI Agent 및 IE)

  이 필드들은 Node.config JSONB 에 저장되므로 실제 DB FK 는 없지만, 참조 관계 목록은 "논리적 참조자" 를 열거하는 문서상 SoT 다. 현재 `KnowledgeBase.embedding_model_config_id`(실제 FK) 와 `AI 노드 config.llmConfigId`(JSONB, FK 없음 — 명시) 가 함께 열거되어 있으므로, JSONB 참조도 등재 대상에 포함된다.
- **제안**: `spec/1-data-model.md §2.16` 의 참조 관계 블록에 다음 항목을 추가하여 동기화한다.
  - chat 참조자 목록에: `AI 노드 config.summaryModelConfigId`(JSONB, FK 없음) · `AI 노드 config.extractionModelConfigId`(JSONB, FK 없음)
  - embedding 참조자 목록에: `AI 노드 config.embeddingModelConfigId`(JSONB, FK 없음)

  작성 시 기존 `AI 노드 config.llmConfigId`(JSONB, FK 없음) 패턴의 노트 표기를 그대로 따른다. 변경은 data-model spec 이므로 project-planner 위임 필요.

---

### [INFO] ND-AG-30 요구사항 — `compactedMessages` 미열거

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md §7.1 meta.memory` 필드 정의 및 `§6.2 d.6`
- **충돌 대상**: `spec/4-nodes/_product-overview.md ND-AG-30` (line 221)
- **상세**: `_product-overview.md` 의 `ND-AG-30` 은 `meta.memory.{strategy, summarized, recalledCount, tokenBudgetUsed}` 를 열거한다. 그러나 `1-ai-agent.md §7.1` 의 `meta.memory` 설명 (및 `§6.2 d.6`) 에는 `compactedMessages?` 가 추가로 정의되어 있다. `ai-context-memory-followup-v2.md` 백로그에도 "ND-AG-30 열거에 `meta.memory.compactedMessages` 등재" 가 미완료 체크박스로 명시되어 있다. 실질적 기능 충돌은 없으나 요구사항 열거 불완전으로 추적성이 약하다.
- **제안**: `spec/4-nodes/_product-overview.md ND-AG-30` 설명에 `compactedMessages?` 를 추가하거나, 또는 `ai-context-memory-followup-v2.md` 의 해당 백로그 체크박스(`meta.memory.compactedMessages` 를 ND-AG-30 열거에 등재)를 plan 이행으로 처리한다. project-planner 위임 필요.

---

### [INFO] `spec/1-data-model.md §2.16` Workspace-embedded ModelConfig 참조 정책 설명 누락

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md §1` — `summaryModelConfigId` / `extractionModelConfigId` / `embeddingModelConfigId` 위젯 `chat-config-selector` / `embedding-config-selector`
- **충돌 대상**: `spec/3-workflow-editor/1-node-common.md §2.6.2 Widget 어휘` (line 268)
- **상세**: `1-node-common.md §2.6.2` 는 `chat-config-selector`·`embedding-config-selector` 위젯을 올바르게 정의하고 있어 target spec 과 일치한다. 단, 이 위젯들은 `AI Assistant candidate picker 비대상 (UserActionWidget 미등재)` 임을 node-common 에서 명시하는데, target의 AI Agent / IE spec 은 이 제약을 명시적으로 언급하지 않는다. 실제 기능 충돌은 없으나, 다른 `llm-config-selector`·`kb-selector` 등은 candidate picker 대상 여부를 해당 노드 spec 에서 명시하는 패턴을 따른다.
- **제안**: 기능·동작 상 모순이 없으므로 차단하지 않는다. 향후 AI Agent / IE spec 의 `embeddingModelConfigId`·`summaryModelConfigId`·`extractionModelConfigId` 필드 설명에 `AI Assistant candidate picker 비대상` 주석을 추가하면 일관성이 높아진다. 낮은 우선순위 정비 항목.

---

## 요약

`spec/4-nodes/3-ai` (0-common.md / 1-ai-agent.md / 3-information-extractor.md) 와 다른 spec 영역 간의 Cross-Spec 충돌은 CRITICAL 또는 WARNING 수준에서 발견되지 않았다. 발견된 세 건은 모두 INFO 수준으로, (1) `spec/1-data-model.md §2.16 ModelConfig 참조 관계` 목록이 신규 `embeddingModelConfigId`/`summaryModelConfigId`/`extractionModelConfigId` 필드를 미열거한 동기화 갭, (2) `ND-AG-30` 요구사항 설명에 `compactedMessages?` 미열거(기존 백로그 항목), (3) 모델 config selector 위젯의 AI Assistant candidate picker 비대상 여부를 노드 spec 에서 명시하지 않은 경미한 패턴 불일치다. 세 건 모두 기능 충돌이나 실행 불가 상황을 초래하지 않으며, 데이터 모델·API 계약·상태 전이·RBAC·계층 책임 관점에서 타 spec 과의 직접 모순은 없다.

---

## 위험도

LOW

STATUS: DONE
