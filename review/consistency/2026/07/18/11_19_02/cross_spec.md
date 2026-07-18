# Cross-Spec 일관성 검토 — `spec/4-nodes/3-ai` (--impl-prep)

## 검토 방법

target 영역 4개 문서(`0-common.md`/`1-ai-agent.md`/`2-text-classifier.md`/`3-information-extractor.md`, 총 ~2,780줄)를 전문 로드한 뒤, 다음 "다른 영역" spec 과 교차 대조했다:

- 데이터 모델: `spec/1-data-model.md` (Integration.service_type enum, AgentMemory §2.23, 인덱스)
- API/프로토콜: `spec/5-system/6-websocket-protocol.md` (submit_message/submit_form/end_conversation, interactionType, conversationConfig.pendingFormToolCall)
- 실행 엔진 상태 전이: `spec/5-system/4-execution-engine.md` (rawConfig snapshot, park/resume 언급 부분)
- MCP: `spec/5-system/11-mcp-client.md` (tool naming, enabledTools, payload budget, maxToolCalls)
- RAG: `spec/5-system/9-rag-search.md` (동적 점수 컷, ragTopK/ragThreshold, inject-cap)
- Agent Memory: `spec/5-system/17-agent-memory.md`
- Presentation 공통: `spec/4-nodes/6-presentation/0-common.md` §10 (render_* 계약)
- Conversation Thread: `spec/conventions/conversation-thread.md` (ConversationTurnSource, presentations[], 시각 매핑)
- node-output 컨벤션: `spec/conventions/node-output.md` (Principle 6 예약 포트어, Principle 3.2.1)
- interaction-type-registry: `spec/conventions/interaction-type-registry.md` (WaitingInteractionType 4값, AiAgentEndReason SoT 분리)
- cross-node-warning-rules: `spec/conventions/cross-node-warning-rules.md`
- 캔버스: `spec/3-workflow-editor/0-canvas.md` §12 (Tool Area 제거 상태)
- 노드 공통 프레임워크: `spec/4-nodes/0-overview.md` §1.3 (포트 ID slug-regex/UUID 모델)
- Cafe24/MakeShop 수치: `spec/4-nodes/4-integration/4-cafe24.md`, `5-makeshop.md`, `spec/0-overview.md`, `spec/2-navigation/4-integration.md`
- 요구사항 ID: `spec/4-nodes/_product-overview.md`, `spec/4-nodes/3-ai/_product-overview.md` (ND-AG-01~30)

## 발견사항

교차 영역 충돌은 발견되지 않았다. 아래는 잠재 충돌로 의심되어 조사했으나 **오탐으로 판정**한 항목이다 (기록용).

- **[INFO]** `ai_agent:too-many-conditions` warningRule 이 `cross-node-warning-rules.md` 레지스트리에 없음
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §5.1 (`최대 20개 조건 허용 (warningRules: ai_agent:too-many-conditions)`)
  - 조사 대상: `spec/conventions/cross-node-warning-rules.md`
  - 상세: 해당 레지스트리 문서는 스코프가 **`graphWarningRules`(cross-node, graph 전체 평가)** 로 한정되고(§1~§2), 단일 노드 config 만 보는 **`warningRules` mini-DSL**(예: `text_classifier:no-llm-provider`, `ai_agent:too-many-conditions`)은 애초 이 레지스트리의 등재 대상이 아니다. 실제로 등재된 유일한 AI Agent 항목(`ai_agent:tool-payload-budget`)은 async 통합 scope 조회가 필요해 backend-only graphWarningRule 로 승격된 예외 케이스(§5)다. 두 메커니즘의 분기(§2 표)가 명확해 실질 충돌이 아니다.
  - 제안: 조치 불필요 (오탐, false positive 로 기록).

## 요약

`spec/4-nodes/3-ai` 4개 문서는 데이터 모델(Integration.service_type, AgentMemory 테이블), WebSocket 프로토콜(interactionType 4값·submit_message/submit_form/end_conversation 명령·pendingFormToolCall 위치), MCP Client(도구 이름 규칙·enabledTools·payload 예산·maxToolCalls), RAG 검색(동적 점수 컷·ragTopK/ragThreshold 재해석), Agent Memory(§2.23 스키마·스코프 키·TTL), Presentation 공통(render_* 5종 카탈로그·defaults overlay·wire sentinel), Conversation Thread(ConversationTurnSource 5값·top-level presentations[] 필드·시각 매핑), node-output 컨벤션(Principle 6 예약 포트어·Principle 3.2.1 details 표준 필드), interaction-type-registry(WaitingInteractionType 4값 매트릭스·AiAgentEndReason 별도 SoT 분리), 캔버스(Tool Area 제거 상태), 요구사항 ID(ND-AG-01~30) 등 다른 모든 영역과 **문구·수치·상태값이 정확히 정합**한다. Cafe24 485 / MakeShop 161 operation 수치, `AI_AGENT_TOOL_COUNT_MAX=128` 등 노드 밖에서도 여러 차례 인용되는 수치도 전 인용처에서 일치했다. `toolNodeIds`/`Tool Area` 제거(재작성 예정) 상태 역시 `1-ai-agent.md`·`0-canvas.md`·양쪽 `_product-overview.md` 전부 동일하게 반영돼 있다. 유일하게 조사한 잠재 충돌(`ai_agent:too-many-conditions` 레지스트리 미등재)은 두 warningRule 메커니즘(mini-DSL vs graphWarningRules)의 스코프 차이에 따른 정상 상태로 판정했다. 결론적으로 본 target 은 구현 착수 전 cross-spec 관점에서 차단 사유가 없다.

## 위험도

NONE
