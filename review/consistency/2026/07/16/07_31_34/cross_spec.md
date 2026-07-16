# Cross-Spec 일관성 검토 결과

- 대상: `spec/4-nodes/3-ai/0-common.md`, `spec/4-nodes/3-ai/1-ai-agent.md` (검토 모드: `--impl-prep`)
- 비교: prompt 에 포함된 `spec/0-overview.md` · `spec/1-data-model.md` + 저장소 내 실제 참조 spec 문서(RAG 검색·MCP Client·Conversation Thread·node-output·execution-engine·websocket-protocol·presentation 공통·AI Assistant·config·error-codes·node-common) 및 대응 backend 코드(schema/widget registry) 실측 대조.

## 발견사항

교차 영역 충돌은 발견되지 않았다. 검증한 주요 항목은 다음과 같다 (모두 정합 확인):

- **데이터 모델**: `Integration.service_type ∈ ('mcp','cafe24','makeshop')` (`spec/1-data-model.md` §2.10) ↔ target §3 McpServerRef 의 동일 집합 — 일치. `ModelConfig.kind ∈ (chat/embedding/rerank)` (§2.16) ↔ target 의 `llmConfigId`/`embeddingModelConfigId`/`summaryModelConfigId`/`extractionModelConfigId` 참조 — 일치. `AgentMemory` 가 엔티티 관계도(§1)에서 Workspace 1:N 자식으로 이미 반영 — target 의 스코프 키 `(workspace_id, memoryKey ?? execution_id)` 와 정합.
- **요구사항 ID**: `ND-AG-06`/`10`/`21` "Tool Area 제거됨" 표기가 `_product-overview.md` 와 target §4 박스가 이미 동일하게 갱신돼 있음 — 신규 충돌 아님. `spec/3-workflow-editor/0-canvas.md` §12 도 동일 "재작성 예정(제거됨)" 주석으로 동기화됨.
- **크로스 링크 무결성**: target 이 인용하는 타 영역 앵커(§) — `9-rag-search.md` §2.1/§3.4/§4.2, `11-mcp-client.md` §2.3/§5.2/§5.7/§5.8/§6.2/§7, `conventions/node-output.md` Principle 0/1.1/1.1.4/2/3.2.1/4.1/4.2/4.2.1/4.5/7, `4-execution-engine.md` §1.2/§1.3/§4/§6.1/§6.2/§7.4/§7.5/§8, `6-websocket-protocol.md` §4.4 (`conversationConfig.pendingFormToolCall`, `execution.user_message`, `execution.ai_message`), `6-presentation/0-common.md` §10.1~10.9, `3-workflow-editor/4-ai-assistant.md` §4.3.1(`pendingUserConfig`) — 전부 실존하며 target 의 서술과 의미가 일치.
- **잠재 충돌로 의심했으나 기 해소 확인**: `embeddingModelConfigId`/`summaryModelConfigId`/`extractionModelConfigId` 의 위젯(`embedding-config-selector`/`chat-config-selector`)이 AI Assistant candidate-picker 의 `UserActionWidget` 집합(`integration-selector`/`llm-config-selector`/`kb-selector`/`workflow-selector`/`mcp-server-selector`, `detect-pending-user-config.ts`)에 미등재된 점을 처음엔 cross-spec drift 로 의심했으나, `spec/3-workflow-editor/1-node-common.md` 의 위젯 카탈로그에 "AI Assistant candidate picker 비대상 (`UserActionWidget` 미등재)" 로 **명시적으로 문서화된 의도된 설계**임을 확인 — 충돌 아님.
- **RBAC**: target §2/§3 의 MCP-capable Integration 노출(cafe24/makeshop 그룹 아이콘, `service_type` 화이트리스트)이 `2-navigation/4-integration.md §14.2` 의 단일 진실과 동일 화이트리스트(`['mcp','cafe24','makeshop']`)를 그대로 참조 — 워크플로우 에디터 내 노드 config 레벨의 RBAC 변경 없음(기존 Editor+ 플로어 유지).

- **[INFO]** `NodeExecution.status` 데이터 모델 enum 에 `resumed` 미기재
  - target 위치: `1-ai-agent.md` §7.5 (`status: "resumed"`, transient), `0-common.md` §4 (Stage 2 공통 resume 컨트랙트)
  - 충돌 대상: `spec/1-data-model.md` §2.14 `NodeExecution.status` 컬럼 enum — `pending / running / completed / failed / cancelled / skipped / waiting_for_input` (`resumed` 없음)
  - 상세: `resumed` 는 `conventions/node-output.md` Principle 4.1 이 정의하는 **핸들러 output-level 전이 상태**(다른 blocking 노드들도 공유하는 기존 컨벤션)이며, DB `NodeExecution.status` 컬럼에 직접 저장되는 값이 아니라고 판단된다. target 이 새로 도입한 개념이 아니라 Form 등 기존 blocking 노드와 공유하는 이미 확립된 패턴이라 실질 충돌은 아니다. 다만 `1-data-model.md` §2.14 자체에는 이 transient 상태와 DB 컬럼의 관계를 명시하는 각주가 없어, 처음 읽는 사람이 두 문서를 나란히 보면 enum 누락처럼 보일 수 있다.
  - 제안: (선택) `1-data-model.md` §2.14 `NodeExecution.status` 행에 "`resumed` 는 handler-level transient 상태이며 본 컬럼에는 영속되지 않는다 — 상세: `conventions/node-output.md` Principle 4.1" 각주를 추가하면 문서 간 왕복 확인 비용을 줄일 수 있다. 기능적 차단 사항은 아니므로 본 구현 착수를 막을 필요는 없음.

## 요약

target(`spec/4-nodes/3-ai/0-common.md`, `1-ai-agent.md`)은 데이터 모델(Integration/ModelConfig/AgentMemory), 요구사항 ID(ND-AG-*), API/이벤트 계약(node-output Principle 체계, WebSocket §4.4, execution-engine 블로킹/재개 컨트랙트), RAG·MCP·Presentation·Workflow AI Assistant 등 인접 영역과 광범위하고 정밀하게 상호 참조되어 있으며, 실제 저장소의 다른 spec 문서·backend 코드(schema widget 등)와 대조한 결과 실질적 모순은 발견되지 않았다. 유일하게 의심됐던 항목(AI Assistant candidate-picker 위젯 미등재)도 이미 `1-node-common.md` 에 의도적 설계로 명문화되어 있어 해소된 것으로 확인했다. `NodeExecution.status` enum 관련 INFO 1건은 문서 편의성 차원의 권고이며 구현 착수를 차단하지 않는다.

## 위험도

NONE
