# Cross-Spec 일관성 검토 — spec/4-nodes/3-ai

## 발견사항

- **[INFO]** `spec/5-system/6-websocket-protocol.md` 내 `§4.4` 섹션 번호 중복 (target 과 직접 관련 없는 사전 존재 결함)
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` 및 `0-common.md` 여러 곳이 `[WS §4.4](../../5-system/6-websocket-protocol.md#44-사용자-입력-대기-이벤트-상세-executionwaiting_for_input)` 형태로 다회 인용 (예: §4 Multi-turn 차단 모드, §6.1/§6.2 실행 로직, §7.10 등)
  - 충돌 대상: `spec/5-system/6-websocket-protocol.md` 자체 — `## 4. 이벤트 목록` 하위에 `### 4.4 사용자 입력 대기 이벤트 상세` (L378) 와 `### 4.4 알림 이벤트 (Server → Client)` (L747) 두 개의 `4.4` 서브섹션이 존재
  - 상세: 마크다운 앵커는 전체 헤딩 텍스트를 slug 화하므로 (`#44-사용자-입력-대기-이벤트-상세-...` vs `#44-알림-이벤트-server-→-client`) 실제 링크 해석에는 충돌이 없다 — target 의 인용은 모두 정확한 대상에 해당한다. 다만 문서 자체의 번호 체계가 사람이 읽을 때 "§4.4" 를 구두로 지칭하면 모호해질 수 있다. 이 결함은 target(`3-ai/**`) 의 변경으로 생긴 것이 아니라 `6-websocket-protocol.md` 쪽의 기존 번호 매김 문제이며, target 은 피해자(다회 참조자)일 뿐이다.
  - 제안: 본 리뷰 스코프(`spec/4-nodes/3-ai`) 밖이므로 target 수정 불필요. `6-websocket-protocol.md` 를 다루는 후속 작업에서 두 번째 `4.4`(알림 이벤트)를 `4.5` 로 재번호하는 것을 권장 (naming/문서 위생 차원, BLOCK 대상 아님).

## 검증한 교차 영역 (충돌 없음 확인)

아래 항목들은 target(`0-common.md`, `1-ai-agent.md`)이 참조·주장하는 내용을 실제 다른 spec 영역과 대조했으며, 전부 정합했다:

1. **Tool Area 제거 상태** — `spec/3-workflow-editor/0-canvas.md §12`(캔버스 UX) 와 `spec/4-nodes/_product-overview.md` / `spec/4-nodes/3-ai/_product-overview.md` 의 `ND-AG-06`/`ND-AG-10`/`ND-AG-21` 서술이 target 의 "재작성 예정(현재 제거됨)" 배너와 동일한 상태·근거로 동기화됨.
2. **MCP-capable service_type 화이트리스트** (`mcp`/`cafe24`/`makeshop`) — `spec/3-workflow-editor/4-ai-assistant.md §4.3.1`(`mcp-server-selector`) 이 동일 3종 whitelist 를 `MCP_CAPABLE_SERVICE_TYPES` SoT 로 명시, target 의 §1/§2 서술과 일치.
3. **대형 카탈로그 operation 수치** — Cafe24 **485**, MakeShop **161** 수치가 `spec/4-nodes/4-integration/4-cafe24.md`·`5-makeshop.md` 실측치와 target(`0-common.md §3`, `1-ai-agent.md §1/§4.2`) 인용치가 정확히 일치. `spec/5-system/11-mcp-client.md §5.8` 도 동일 수치로 교차 인용.
4. **MCP Client 스펙** (`spec/5-system/11-mcp-client.md`) §5.6 allowlist·§5.7 maxToolCalls 합산·§5.8 payload 예산·§6.2 mcpDiagnostics 구조 — target 의 §3(공통)·§4.2(payload 예산)·§7 출력 구조 서술과 필드명·의미 모두 일치.
5. **Agent Memory 스펙** (`spec/5-system/17-agent-memory.md`) — 데이터 모델(§1)·스코프 키(§2)·추출 파이프라인(§3, watermark/큐/dedup)·회수(§4, memoryTopK/memoryThreshold 독립성·data-fence)·격리(§5) 전부가 target 의 `memoryStrategy`/`memoryKey`/`memoryTopK`/`memoryThreshold`/`memoryTtlDays`/`embeddingModelConfigId`/`extractionModelConfigId`/`summaryModelConfigId` 필드 서술과 fallback 체인까지 정확히 대응.
6. **ConversationThread 스펙** (`spec/conventions/conversation-thread.md §1.2`) — `presentations?: PresentationPayload[]` 가 `source: 'ai_assistant'` 한정·`data?` 와 별개 top-level 필드임을 target(§4.1/§7.10)과 동일하게 서술. `render_form` 활성 판정(`pendingFormToolCall.toolCallId` 매칭) 로직도 양쪽 문서가 동일.
7. **Presentation 공통 스펙** (`spec/4-nodes/6-presentation/0-common.md §10.1~10.9`) — target 이 인용하는 모든 서브섹션(§10.1 Schema 단일 진실, §10.2 도구 카탈로그, §10.3 Defaults Overlay, §10.5 Schema 위반 처리, §10.6 Blocking vs Display-only, §10.8 클릭 user-message 합성, §10.9 wire format sentinel)이 실제로 존재하고 내용도 상호 참조와 부합.
8. **`endReason` SoT 분리 원칙** — `spec/conventions/interaction-type-registry.md §4` 와 실제 패키지 `codebase/packages/ai-end-reason/src/index.ts` 를 대조: `AiAgentEndReason` 유니온에 `'out'` 이 없고 `ConversationEndReason` 파생 유니온에서도 의도적으로 제외됨을 코드 주석이 명시 — target(`1-ai-agent.md §7` 상단 표)의 "`'out'` 이 패키지 도메인 밖" 주장과 정확히 일치.
9. **워크스페이스 timezone 설정** — `spec/1-data-model.md` Workspace `settings` 필드가 `NAV-SC-06` 요구사항 ID·target 의 System Context Prefix(§11.3 SoT precedence)를 상호 링크하며 정합. `spec/2-navigation/_product-overview.md` 의 `NAV-SC-06` 요구사항 항목과도 일치.
10. **Multi-turn `rawConfig` fresh-per-turn 정책** — `spec/5-system/4-execution-engine.md` (D3 결정, §6.1/§7.5) 가 target(`1-ai-agent.md §7` Config echo 정책 노트)의 "park 중 편집은 다음 turn 부터 반영" 서술과 동일한 의미·근거로 기술됨.
11. **요구사항 ID 재사용 여부** — `ND-AG-*` (06/10/15~22) 는 `spec/4-nodes/_product-overview.md` 와 `spec/4-nodes/3-ai/_product-overview.md` 두 곳에서만 사용되며 서로 동일한 의미로 미러링됨 (다른 영역에서 재사용/충돌 없음).

## 요약

`spec/4-nodes/3-ai/0-common.md`·`1-ai-agent.md` 가 인용하는 대다수의 cross-spec 링크(MCP Client, Agent Memory, Conversation Thread, Presentation 공통, 실행 엔진, 데이터 모델, interaction-type-registry, 캔버스, AI Assistant, Cafe24/MakeShop 통합, product-overview 요구사항 ID)를 직접 대조 검증한 결과, 데이터 모델·API 계약·요구사항 ID·상태 전이·계층 책임 어느 관점에서도 실질적 모순을 찾지 못했다. 이 spec 영역은 이미 다수의 리팩터/리뷰 사이클(M-1 god-handler 분할, `endReason` 패키지화, Tool Area 제거 공지 등)을 거치며 상호 참조가 매우 촘촘하게 동기화되어 있다. 유일한 특이사항은 target 과 무관한 `spec/5-system/6-websocket-protocol.md` 자체의 `§4.4` 섹션 번호 중복이며, 앵커 슬러그가 서로 달라 실질적 링크 오류는 없다(INFO, target 수정 불필요).

## 위험도
NONE
