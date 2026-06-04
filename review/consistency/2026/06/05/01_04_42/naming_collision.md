# 신규 식별자 충돌 검토 — `spec/5-system` (구현 완료 후 / --impl-done)

- **검토 모드**: 구현 완료 후 (`--impl-done`, scope=`spec/5-system`, diff-base=`origin/main`)
- **Target 문서**: `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md`, `spec/5-system/11-mcp-client.md`
- **diff 사실**: 현재 브랜치는 `origin/main` 과 동일 (HEAD `4c59fe5b`). `spec/5-system/` 의 워킹트리·커밋 diff 0건. 따라서 본 검토는 "이 spec 영역이 정의하는 식별자가 검색 코퍼스(spec/, plan/in-progress/, conventions/)의 기존 사용처와 충돌하는가" 를 전수로 확인하는 정적 충돌 검사로 수행함.
- **결론**: **BLOCK 사유 없음 (Critical 0건 / Warning 0건)**. 신규 식별자는 모두 코퍼스(특히 `spec/1-data-model.md`)와 정합하거나 코퍼스가 명시적으로 충돌을 사전 해소해 둠.

---

## 점검 결과 (관점별)

### 1. 요구사항 ID 충돌 — 없음
- graph-rag 가 신설한 ID 네임스페이스: `KB-GR-MD-*` / `KB-GR-EX-*` / `KB-GR-DM-*` / `KB-GR-SR-*` / `KB-GR-PA-*` / `KB-GR-UI-*` / `KB-GR-OB-*` / `NF-GR-*`. 모두 `KB-GR-` / `NF-GR-` prefix 로 격리되어 코퍼스의 기존 ID(예: `NAV-SC-*`, `INT-US-*`, `EIA-NX-*`, `CCH-SE-*`, `ND-BG-*`, `RR-PL-*`)와 prefix 단위로 겹치지 않음.
- auth 의 `§1.4.x` Rationale 라벨(1.4.A~1.4.I)은 문서 내부 로컬 라벨이라 cross-doc 충돌 대상 아님.

### 2. 엔티티/타입명 충돌 — 없음 (가장 핵심 점검 항목, clean)
graph-rag 가 "신규" 로 도입하는 엔티티 `Entity`(§2.3) / `Relation`(§2.4) / `ChunkEntity`(§2.5) 와 KnowledgeBase·Document 추가 컬럼(§2.1/§2.2)이 코퍼스의 `spec/1-data-model.md` 에 **이미 동일 이름·동일 의미로 canonical 정의**되어 있음:
- `spec/1-data-model.md §2.12.2 Entity`, `§2.12.3 Relation`, `§2.12.4 ChunkEntity` — graph-rag spec 의 §2.3~2.5 와 **필드·타입·제약(UNIQUE/PK)·인덱스가 전부 일치**. 동명이의(same name, different meaning)가 아니라 동일 도메인 객체의 SoT↔참조 관계.
- `§2.11 KnowledgeBase` 가 `rag_mode` / `extraction_llm_config_id` 컬럼을, `§2.12 Document` 가 `graph_extraction_status` 를 이미 보유. graph-rag spec 도 §2.1/§2.2 에서 "데이터 모델 §2.11/§2.12 가 canonical" 이라고 명시적으로 역참조 → 단일 진실 원칙 충족.
- MCP 측 `Cafe24McpToolProvider` / `MakeshopMcpToolProvider` / `McpToolProvider` / `McpClientService` / `KbToolProvider` 는 `AgentToolProvider` 인터페이스 구현체로 일관 명명되며 코퍼스(0-overview·ai-agent 영역)와 충돌 없음.
- 데이터 모델 Rationale 이 잠재 동명 충돌을 **선제적으로 분리 정의**해 둠 — `AuthConfigType` vs `IntegrationAuthType`(`api_key`/`bearer_token` 표기 겹침을 별 union 으로 분리), `WaitingInteractionType` vs `interactionType`(이름만 같은 별개 enum), `notification_secret_v2` vs `chat_channel_token_v2`(명명 패턴 동일·의미 비대칭 명시). 이번 target 이 이 경계를 새로 침범하지 않음.

### 3. API endpoint 충돌 — 없음
- 신규 endpoint 는 모두 영역 prefix 로 격리: auth `/api/auth/2fa/webauthn/**`, graph-rag `/api/knowledge-bases/:id/**`(re-extract, entities, relations, graph/stats, graph/visualization). 기존 `/api/auth/2fa/setup|verify|disable`(TOTP), `/api/auth/login/totp` 등과 path 충돌 없음.
- `/api/auth/2fa/webauthn/recovery-codes/regenerate` 는 의도적으로 TOTP `/api/auth/2fa/disable` 과 대칭 네임스페이스를 취하되 경로가 달라 충돌 아님(spec §5 명시).
- MCP 는 신규 노드/endpoint 가 아니라 기존 `Integration.service_type` 의 새 값(`mcp`)으로 등록 — 데이터 모델 §2.10 `service_type` enum 에 `mcp` 가 이미 등재되어 있어 정합.

### 4. 이벤트/메시지명 충돌 — 없음
- WebSocket 이벤트 `document:graph_started|_progress|_completed|_retry|_failed` 는 기존 `document:embedding_*` 패턴과 동형이되 `graph_` 세그먼트로 구분되어 충돌 없음. `document:graph_error` 는 union 에만 dead-declared(미emit)임을 spec 이 명시 — 신규 충돌 아님.
- 큐 이름 `graph-extraction` 은 기존 `document-embedding` 과 별개 큐. `login-history-pruner`, `pending-install-ttl`, `makeshop-token-refresh` 등 코퍼스 큐 이름과 겹치지 않음.
- `LoginHistory.event` 의 신규값 `webauthn_failed` 는 V058 CHECK 확장으로 추가, 기존 enum(login_success/login_failed/totp_failed/logout/session_revoked/token_reuse_detected)과 중복 아님.
- MCP `skipReason`(lower_snake_case 운영 진단 enum)과 `MCP_ERROR_CODES`(UPPER_SNAKE 에러 코드)는 spec §6.2 가 명명 규칙을 명시적으로 분리. `Integration.status_reason`(snake_case)과의 표기 일치는 의미를 캐리하기 위한 의도된 정합으로 코퍼스 §2.10(`status_reason snake_case` vs `OAUTH_* UPPER_SNAKE`)의 원칙과 동일.

### 5. 환경변수·설정키 충돌 — 없음
- auth: `WEBAUTHN_RP_ID`/`WEBAUTHN_RP_NAME`/`WEBAUTHN_ORIGIN`/`WEBAUTHN_ALLOW_FALLBACK` — `WEBAUTHN_` prefix 로 고유.
- mcp: `MCP_MAX_CONCURRENT_CONNECTIONS`/`MCP_ALLOW_INSECURE_URL` — `MCP_` prefix 로 고유. 기존 공용 키(`ENCRYPTION_KEY`, `FRONTEND_URL`, `process.env.TZ`)는 재사용(참조)일 뿐 재정의 아님.
- 설정 키 `rerank_mode`/`rerank_config_id`(RerankConfig 영역)와 graph 파라미터 `max_hops`/`vector_seed_top_k`/`expanded_chunk_limit` 는 별개 컬럼군으로 겹치지 않음.

### 6. 파일 경로 충돌 — 없음
- target 파일명 `spec/5-system/{1-auth,10-graph-rag,11-mcp-client}.md` 는 `5-system/` 의 `N-슬러그.md` 명명 컨벤션을 따르며 기존 번호(4-execution-engine, 8-embedding-pipeline, 9-rag-search, 13-replay-rerun, 14-external-interaction-api, 15-chat-channel, 16-system-status-api, 17-agent-memory)와 번호·이름 충돌 없음.
- 마이그레이션 버전: 코퍼스 전수 스캔 결과 각 `V0xx` 가 정확히 한 의미에 1:1 매핑(V025=graph_rag, V026/V027=graph 인덱스, V037=kb_retry_failed, V058=login_history CHECK, V072=integration store-identifier 통일 인덱스 등). 동일 버전번호가 서로 다른 마이그레이션에 재사용된 사례 없음.

---

## 비고
- 본 영역의 식별자는 데이터 모델(`spec/1-data-model.md`)이 SoT 로서 이미 흡수·정렬해 둔 상태라, target 3개 문서는 그 SoT 를 역참조하는 구조다. 따라서 "신규 도입" 처럼 보이는 엔티티·컬럼·이벤트도 코퍼스 기준으로는 기등록 식별자와 정합한다.
- diff-base 대비 변경 0건이라 "이번 변경이 새로 만든 충돌" 은 정의상 존재하지 않으며, 전수 정적 검사에서도 충돌 미발견.

## STATUS
STATUS: OK — Critical 0, Warning 0. 신규 식별자 충돌 없음 (BLOCK 사유 없음).
