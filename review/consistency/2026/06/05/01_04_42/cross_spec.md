# Cross-Spec 일관성 Check 결과

- **검토 모드**: 구현 완료 후 검토 (`--impl-done`, scope=`spec/5-system`, diff-base=`origin/main`)
- **Target**: `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md`, `spec/5-system/11-mcp-client.md`
- **대조 영역**: `spec/0-overview.md`, `spec/1-data-model.md`, `spec/2-navigation/0-dashboard.md`
- **판정**: **PASS** (Critical 0, Warning 0, Info 2)

target 3개 문서가 정의·참조하는 엔티티·API 계약·요구사항 ID·상태 머신·RBAC·계층 책임을 대조 영역과 교차 검증한 결과, **차단성(Critical) 또는 경고성(Warning) 충돌은 발견되지 않았다.** target 문서들은 데이터 모델·개요 문서와 단일 진실(single source of truth) 관계를 일관되게 유지하고 있다.

---

## 점검 관점별 결과

### 1. 데이터 모델 충돌 — 충돌 없음

target 3개 문서가 정의하는 엔티티/컬럼이 `spec/1-data-model.md` 의 canonical 정의와 **완전히 일치**한다.

| target 정의 | data-model canonical | 정합 |
|---|---|---|
| auth.md §1.4.1 `user.totp_recovery_codes` / `user.webauthn_recovery_codes` (SHA-256 해시 배열, 별도 분리) | §2.1 User `totp_recovery_codes` / `webauthn_recovery_codes` (NULL 화 책임 = 앱 레이어) | ✅ |
| auth.md §1.4.4 WebAuthnCredential (counter 역행 시 row 삭제, stateless JWT challenge) | §2.21 WebAuthnCredential (counter fatal → row 삭제, challenge stateless JWT 5분) | ✅ |
| auth.md §4.3 LoginHistory 이벤트 (`webauthn_failed` 추가, `WEBAUTHN_COUNTER_REGRESSION`, 180일 보존) | §2.18.2 LoginHistory event enum + failure_reason + 180일 | ✅ |
| graph-rag.md §2.1 KnowledgeBase 추가 컬럼 (`rag_mode`/`extraction_llm_config_id`/`max_hops`/`vector_seed_top_k`/`expanded_chunk_limit`/`entity_count`/`relation_count`) | §2.11 KnowledgeBase 동일 컬럼·default·불변 규칙 | ✅ |
| graph-rag.md §2.2 Document `graph_extraction_status` (5-enum, vector 모드 NULL) | §2.12 Document `graph_extraction_status` Enum? + `graph_retry_count`/`graph_last_attempted_at`/`graph_error_message` | ✅ |
| graph-rag.md §2.3~2.5 Entity / Relation / ChunkEntity (제약·인덱스) | §2.12.2~2.12.4 동일 PK·UNIQUE·인덱스 | ✅ |
| mcp-client.md §3 Integration `service_type='mcp'`, `auth_type`, credentials JSONB | §2.10 Integration `service_type` (mcp 포함), `auth_type` (none 포함), credentials encrypted | ✅ |
| mcp-client.md §8.3 IntegrationUsageLog `api_label varchar(128)?` / `api_method varchar(8)?` / `api_path varchar(256)?` | §2.10.1 IntegrationUsageLog 동일 타입·길이·truncate 규칙 | ✅ |

특히 graph-rag.md §2.2 와 data-model §2.12 는 `graph_extraction_status` 5-enum 의 의미(`error`=일시/`failed`=최종)를 양쪽에서 동일하게 기술하며, canonical 정의를 data-model 로 명시 위임하는 cross-reference 가 정확하다.

### 2. API 계약 충돌 — 충돌 없음

- auth.md §5 의 엔드포인트(`/api/auth/2fa/webauthn/*`, `/api/auth/login/totp` 등)와 graph-rag.md §5 (`/api/knowledge-bases/:id/re-extract`, `/entities`, `/relations`, `/graph/stats`), mcp-client.md §5 도구 명명(`mcp_<sid>__<toolName>`)은 모두 자기 영역 내부에서 정의되며 다른 영역의 동일 경로/메서드와 충돌하지 않는다.
- mcp-client.md §8.2 의 MCP 에러 코드(`MCP_*`, UPPER_SNAKE_CASE)와 §6.2 의 `skipReason`(lower_snake_case)은 §6.2 주석에서 명시적으로 표기 규칙을 분리하고 `node-output.md` Principle 3.2 의 `code` UPPER_SNAKE_CASE 규약과의 구분을 스스로 정당화한다 — 규약 영역과 충돌 없음.
- mcp-client.md §8.3 의 `tools/call` 1회당 1 IntegrationUsageLog 기록 패턴은 `4-nodes/4-integration/_product-overview.md INT-US-05` 를 SoT 로 명시 참조 — cross-cutting 계약을 재정의하지 않고 위임한다.

### 3. 요구사항 ID 충돌 — 충돌 없음

- graph-rag.md 는 `KB-GR-MD-*` / `KB-GR-EX-*` / `KB-GR-DM-*` / `KB-GR-SR-*` / `KB-GR-PA-*` / `KB-GR-UI-*` / `KB-GR-OB-*` / `NF-GR-*` prefix 를 사용한다. 이는 KB-Graph 전용 네임스페이스로, 다른 영역(`NAV-*`, `ED-AI-*`, `ND-*`, `INT-*`, `EIA-*`, `WH-*`, `CCH-*`)과 prefix 충돌이 없다.
- auth.md / mcp-client.md 는 형식적 요구사항 ID 를 부여하지 않아(§ 번호 기반) ID 충돌 가능성 자체가 없다.

### 4. 상태 전이 충돌 — 충돌 없음

- graph-rag.md §3.2/§7 의 Document `graph_extraction_status` 전이(`pending→processing→completed`, `error`(재시도 중)→`failed`(최종))는 data-model §2.12 의 `embedding_status` 5-enum 머신과 동일 의미로 정렬되며, graph-rag.md §2.2 가 "의미는 embedding_status 와 동일" 로 명시 위임한다.
- mcp-client.md §2.3/§8.4 가 참조하는 Integration status 전이(`expired`/`error(auth_failed)` 등)는 `2-navigation/4-integration.md` §6 상태 전이를 SoT 로 명시 위임하고, refresh+1회 재시도 자가 회복은 Cafe24 §6.1 로 위임 — 본 영역에서 상태 머신을 재정의하지 않는다.

### 5. 권한·RBAC 모델 충돌 — 충돌 없음

- auth.md §3.1 RBAC 역할(Owner/Admin/Editor/Viewer)은 data-model §2.3 WorkspaceMember.role enum(owner/admin/editor/viewer)과 정확히 일치한다.
- auth.md §3.2 의 "Auth Config Reveal (Admin+)" 행은 data-model §2.17.2 마스킹·노출 정책 (`POST /api/auth-configs/:id/reveal` = Admin+ + audit 기록)과 일치하며, auth.md 의 cross-reference(`data-model §2.17.2`)가 정확하다.
- auth.md §3.2 의 "System Status (모든 역할 R, 별도 admin 가드 없음)" 는 `16-system-status-api.md §4` 를 근거로 명시 — 동일 영역 내 위임이며 RBAC 매트릭스 모순 없음.

### 6. 계층 책임 충돌 — 충돌 없음

- auth.md §1.4.H 의 WebAuthn 도메인 모듈 분리(`AuthModule → WebAuthnModule` 단방향, controller host = AuthModule)는 자기 완결적 결정으로, overview/data-model 의 어떤 계층 분할 결정과도 어긋나지 않는다.
- mcp-client.md §2.3 Internal Bridge(in-process) vs §2.1 외부 HTTP transport 의 책임 경계 — SSRF/캐시/세션 정책이 transport 별로 명확히 분리되고, `0-overview.md §6.1` 의 "Cafe24·MakeShop Internal MCP Bridge 양방향 노출 구현 완료" 및 §6.3 "Bridge 패턴 확장(Shopify·Naver)" 분류와 정합한다.
- graph-rag.md 의 "PostgreSQL 관계형 + recursive CTE, 신규 의존성 0" 기술 결정은 `0-overview.md §2.6 Data Layer`(PostgreSQL/Vector DB) 및 §7 용어 정의(Graph RAG/Entity/Relation)와 일치한다.

---

## Info (비차단 관찰 — 차단 아님, 향후 참고)

### Info-1: graph-rag.md 의 `KnowledgeBase` 컬럼이 rerank 관련 컬럼을 언급하지 않음 (의도된 분리, 충돌 아님)

graph-rag.md §2.1 의 KnowledgeBase 추가 컬럼 표는 `rag_mode`~`relation_count` 까지만 나열하고, data-model §2.11 에 존재하는 `rerank_mode`/`rerank_config_id`/`rerank_candidate_k`/`rerank_score_threshold`/`rerank_llm_config_id` (RAG 검색 후처리, Planned)는 포함하지 않는다. 이는 graph-rag 가 자기 범위의 컬럼만 기술하고 rerank 는 `9-rag-search.md` 영역으로 위임하기 때문으로, graph-rag.md §3.4(KB-GR-SR-05)·§1 용어 disambiguation 에서 "centrality-weighted score blending(graph 내부 1차 정렬)" 과 "cross-encoder reranking(별개 2차 단계)" 를 명시적으로 구분하고 있어 **모순이 아니다.** data-model §2.11 이 두 영역의 컬럼을 통합 보유하는 것이 정상이며, target 문서의 부분 나열은 의도된 범위 한정이다.

### Info-2: target 문서들이 "미구현(Planned)" 항목을 inline 으로 정직하게 표기 (정합성 양호 신호)

`--impl-done` 모드 특성상 구현되지 않은 표면이 spec 본문에 남아 있는지 확인했다. 세 문서 모두 미구현 표면을 cross-spec 충돌 없이 명확히 마킹한다:
- auth.md §1.3 LDAP/SAML(미구현·Planned), §1.4.I `requiresTotp` 제거 종결
- graph-rag.md §3.7(`document:graph_error` dead-declared), §6 주석
- mcp-client.md §3.3 `cached_capabilities`(미구현), §6.2 외부 MCP 진단 미노출(Planned), §8.2 `MCP_TIMEOUT`(미구현)

이들 Planned 표기는 모두 자기 영역 내 `plan/in-progress/*` 추적 링크를 동반하며, data-model/overview 의 구현 상태 분류(`0-overview.md §6.1/§6.3`)와 모순되지 않는다 — 예: overview §6.1 의 "Graph RAG P0~P2 ✅ / §6.3 P2+ 후속 ❌" 분류가 graph-rag.md Overview 의 구현 상태 배너와 정확히 정렬된다.

---

## 결론

scope=`spec/5-system` 의 target 3개 문서는 대조 영역(`0-overview.md`, `1-data-model.md`, `2-navigation/0-dashboard.md`)과 데이터 모델·API 계약·요구사항 ID·상태 머신·RBAC·계층 책임 6개 관점 전부에서 **차단성/경고성 충돌이 없다.** cross-reference(특히 data-model 로의 canonical 위임)가 일관되게 유지되고 있으며, 미구현 표면도 충돌 없이 정직하게 마킹되어 있다.
