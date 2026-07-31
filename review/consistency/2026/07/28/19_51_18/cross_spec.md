# Cross-Spec 일관성 검토 — spec/5-system/ (impl-prep)

대상 파일: `spec/5-system/1-auth.md` · `spec/5-system/10-graph-rag.md` · `spec/5-system/11-mcp-client.md`
비교 대상: `spec/**` 전역 (`spec/1-data-model.md` · `spec/0-overview.md` · `spec/data-flow/**` · `spec/2-navigation/**` · `spec/4-nodes/**` · `spec/conventions/**`)

## 사전 확인

직전 라운드(`review/consistency/2026/07/28/17_21_27`)가 낸 CRITICAL 2건 —
① `1-auth.md §3.2` "멤버 관리" Admin 열 CRU(삭제 불가) vs 실제 구현/타 spec(CRUD, 삭제 가능) 모순,
② `10-graph-rag.md` Entity/Relation/ChunkEntity 도메인 용어 vs 실제 구현 클래스명(`GraphEntity` 등) 불일치 —
는 커밋 `71ce6c12b`(현재 HEAD)에서 이미 수정되었다. 아래는 그 수정본을 기준으로 한 재검토 결과다.

## 발견사항

- **[INFO]** MCP Client 도메인 에러 코드가 중앙 에러 카탈로그의 "도메인 spec 참조" 완결성 패턴에 미등재
  - target 위치: `spec/5-system/11-mcp-client.md §8.2` (에러 코드 vocabulary — `MCP_CONNECT_FAILED` / `MCP_LIST_FAILED` / `MCP_CALL_FAILED` / `MCP_TOOL_ERROR` / `MCP_TIMEOUT` / `MCP_AUTH_FAILED` / `MCP_HTTPS_REQUIRED` / `MCP_UNKNOWN_TOOL` / `MCP_RESPONSE_TOO_LARGE`, 모두 `UPPER_SNAKE_CASE`, SoT `mcp-error-codes.ts`)
  - 충돌 대상: `spec/5-system/3-error-handling.md §1` — 자신을 "제품 전체 에러 코드 카탈로그 SoT"로 선언하고, 정의 SoT 가 도메인 spec 에 있는 코드는 "도메인 spec 참조(정의는 도메인 spec, 본 §1 은 공용 카탈로그 가시성 등재만)" 패턴으로 §1.2.1(2FA/WebAuthn) · §1.5(WS commands) · §1.6(EIA REST) · §1.7(Webhook) · §1.8(KB/Graph RAG) · §1.9(워크스페이스 멤버 직접 추가) 를 이미 등재 완료했다(§Rationale "§1 카탈로그 완결성" 커밋 이력 다수).
  - 상세: 같은 §1 Rationale 이 "auth·KB 도메인 코드가 §1 에 미등재였다"를 결함으로 규정하고 6개 도메인에 대해 반복적으로 "완결성 pass"를 수행했음에도, `11-mcp-client.md §8.2` 는 그 대상에서 빠져 `§1.10 MCP Client 도메인 에러 코드` 같은 절이 아직 없다. 정의가 서로 다르거나 충돌하는 것은 아니며 — `INVALID_TOOL_ARGUMENTS` prefix-less 예외는 오히려 `conventions/error-codes.md` 가 `11-mcp-client.md §8.2` 를 정확히 인용해 잘 정합되어 있다 — 순수 등재 누락이다. 다만 기존 패턴이 명시적으로 "이런 종류의 갭은 닫는다"는 선례를 6회 반복했으므로 방치 시 재차 지적될 가능성이 높다.
  - 제안: `3-error-handling.md` 에 `§1.10 MCP Client 도메인 에러 코드 (도메인 spec 참조)` 절을 §1.9 와 동일 포맷(표 + "정의 SoT 는 11-mcp-client.md, 본 절은 가시성 등재" 안내)으로 신설. target(`11-mcp-client.md`) 자체 수정은 불필요.

## 교차 검증 상세 (충돌 없음 확인)

아래 항목은 CRITICAL/WARNING 후보로 점검했으나 모두 정합 확인됨 (근거만 남김):

- **RBAC — 멤버 관리 Admin 권한**: `1-auth.md §3.2`(수정 후 CRUD + owner 대상 각주) ↔ `data-flow/12-workspace.md §3.2`("admin ✓ (owner 제외)") ↔ `2-navigation/9-user-profile.md §4.1/§4.2`("제거 | Admin+", "멤버 관리 ✅/✅") — 3자 일치. 코드 실측(`WorkspacesService.removeMember` → `assertAdmin`, `ADMIN_ROLES=Set(['owner','admin'])`)과도 일치.
- **Graph RAG 엔티티 구현 식별자**: `10-graph-rag.md §2.3~2.5`("구현: GraphEntity/GraphRelation/GraphChunkEntity") ↔ `1-data-model.md §2.12.2~4`(동일 표기) ↔ 실제 `codebase/backend/src/modules/knowledge-base/entities/{entity,relation,chunk-entity}.entity.ts` 의 export 클래스명 — 3자 일치.
- **User/RefreshToken/LoginHistory/WebAuthnCredential 데이터 모델**: `1-auth.md` §1.1/§1.4/§2.3/§4.3 필드 서술(SHA-256 해시 토큰 3종, `family_id` 세션, WebAuthn 복구 코드 풀 분리, `chk_login_history_event` V040/V058) ↔ `1-data-model.md §2.1/§2.18.1/§2.18.2/§2.21` — 필드명·의미 전원 일치.
- **`activeWorkspaceId` 클레임 rename + dual-read 전환기 정책**: `1-auth.md §2.2` ↔ `data-flow/12-workspace.md`(`workspaceId` cross-ref 줄) — 일치.
- **재인증(`verifyReauth`) 에러 코드 카탈로그**: `1-auth.md §2.3`(`REAUTH_REQUIRED`/`PASSWORD_INVALID`/`TOTP_INVALID`/`REAUTH_NOT_AVAILABLE`) ↔ `3-error-handling.md §1.2.1` — 코드·status·설명 전원 일치.
- **초대 토큰 에러 코드 lowercase 예외**: `1-auth.md §1.5.4` ↔ `conventions/error-codes.md §3` historical-artifact 레지스트리 — 일치.
- **감사 액션 dot-prefix·시제 분류**: `1-auth.md §4.1/Rationale 4.1.A`(`user.*` 과거분사, `model_config.*`/`auth_config.*` 현재형 예외) ↔ `conventions/audit-actions.md §2.1~2.3` 표 — 일치.
- **KnowledgeBase graph 관련 컬럼**(`rag_mode`/`extraction_llm_config_id`/`max_hops`/`vector_seed_top_k`/`expanded_chunk_limit`/`entity_count`/`relation_count`/`reextract_status`): `10-graph-rag.md §2.1` ↔ `1-data-model.md §2.11` — 일치.
- **LLM 사용량 KB attribution 부재**("의도된 누락"): `10-graph-rag.md §8`/`KB-GR-EX-07`/`NF-GR-05` ↔ `data-flow/7-llm-usage.md §1.3`(`GraphExtractionService` context 전부 NULL) ↔ `1-data-model.md §2.24`(LlmUsageLog 에 KB/document FK 없음) — 일치.
- **WebSocket `KbEventType` union (11개, `document:graph_error` 제거 #443)**: `10-graph-rag.md §6` ↔ `data-flow/6-knowledge-base.md` ↔ `6-websocket-protocol.md` ↔ `8-embedding-pipeline.md` — 4자 일치.
- **`ragSources[]` 스키마 + `origin` 필드(`seed`/`expanded`)**: `10-graph-rag.md §4.3` ↔ `9-rag-search.md §4.1`(그래프 모드 origin 값 명시적으로 10-graph-rag.md §4.3 를 인용) — 상호 인용 일치.
- **`graph-extraction` BullMQ 큐 등록**: `10-graph-rag.md §3.1` ↔ `data-flow/0-overview.md §4` 큐 마스터 카탈로그(18개 목록에 포함) — 일치.
- **MCP Integration 모델**(`service_type='mcp'`, `auth_type`/`credentials` 스키마): `11-mcp-client.md §3.1~3.2` ↔ `2-navigation/4-integration.md §5.6` — 필드명·타입·필수여부 전원 일치.
- **Internal Bridge 401 자동 회복 예외**(cafe24 refresh_token 보유 provider): `11-mcp-client.md §8.4`/Rationale ↔ `2-navigation/4-integration.md Rationale "call() 의 401 자동 회복"` ↔ `4-cafe24.md §6.1` — 3자 일치.
- **Cafe24/MakeShop operation 수치**(485 / 161)와 `AI_AGENT_TOOL_COUNT_MAX`(128) 상호 참조: `11-mcp-client.md §5.8` ↔ `4-nodes/3-ai/1-ai-agent.md §4.2` ↔ `4-cafe24.md §지원 범위` ↔ `5-makeshop.md §지원 범위` ↔ `0-overview.md` — 전원 일치(485/161/128 세 수치 어긋남 없음).
- **`ALLOW_PRIVATE_HOST_TARGETS`(warn) vs `MCP_ALLOW_INSECURE_URL`(throw) 분류**: `11-mcp-client.md §3.2/Rationale` ↔ `1-http-request.md §4` ↔ `1-auth.md Production fail-closed Rationale` — 3자 일치, 상호 인용 정확.
- **`INVALID_TOOL_ARGUMENTS` prefix-less 예외**: `11-mcp-client.md §8.2` ↔ `conventions/error-codes.md §1` — 일치(인용 정확).
- **요구사항 ID 유일성**: `KB-GR-*`/`NF-GR-*` (10-graph-rag.md) 가 `spec/**` 다른 어떤 문서에서도 재사용되지 않음 확인 (grep 0건).

## 요약

target 3개 문서(`1-auth.md`/`10-graph-rag.md`/`11-mcp-client.md`)를 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 6개 관점에서 `spec/1-data-model.md`·`spec/0-overview.md`·`spec/data-flow/**`·`spec/2-navigation/**`·`spec/4-nodes/**`·`spec/conventions/**` 전역과 대조했다. 직전 라운드가 발견한 CRITICAL 2건(RBAC 멤버 삭제 권한, Graph RAG 엔티티 구현 식별자)은 커밋 `71ce6c12b` 로 이미 수정되었고, 그 수정이 참조하는 모든 타 영역(data-flow/workspace, user-profile, data-model)과 재검증 결과 완전히 정합한다. 그 외 광범위한 교차 검증(WebAuthn/세션/감사 로그 데이터 모델, KB graph 컬럼, LLM 사용량 attribution, WebSocket 이벤트 union, RAG 소스 스키마, MCP Integration 모델·401 회복 정책·도구 예산 수치·SSRF 플래그 분류)에서 CRITICAL/WARNING 급 모순은 발견되지 않았다. 유일한 잔여 발견은 INFO 등급 — MCP Client 의 에러 코드 카탈로그(§8.2)가 중앙 에러 카탈로그(`3-error-handling.md §1`)의 "도메인 spec 참조" 완결성 패턴에서 아직 등재되지 않은 것으로, 기능적 모순은 아니며 동일 문서가 이미 6개 자매 도메인에 대해 반복 수행한 등재 작업의 단순 누락이다.

## 위험도

LOW
