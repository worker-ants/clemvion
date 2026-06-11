# 신규 식별자 충돌 검토 결과

검토 모드: 구현 착수 전 검토 (--impl-prep, scope=spec/5-system)
검토 대상: `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md`, `spec/5-system/11-mcp-client.md`

---

## 발견사항

### 이벤트/메시지명 충돌

- **[WARNING]** `document:graph_error` 이벤트 — 스펙 간 불일치
  - target 신규 식별자: `10-graph-rag.md §6` 는 이 이벤트를 "dead-declared (타입 union 에만 선언, 미emit)" 로 명시하고 이벤트 표에서 제외함
  - 기존 사용처:
    - `spec/5-system/6-websocket-protocol.md` 723행: `document:graph_started` / `_progress` / `_completed` / `_error` / `_retry` / `_failed` 를 열거형으로 나열해 공식 이벤트로 취급
    - `spec/2-navigation/5-knowledge-base.md` 182행: 동일하게 `_error` 를 열거 (dead-declared 표시 없음)
    - `spec/data-flow/6-knowledge-base.md` 289, 416행: `graph_error` 가 제거됐음을 주석으로 명시하나 6-websocket-protocol.md 와 5-knowledge-base.md 는 미갱신
  - 상세: `10-graph-rag.md` 와 `data-flow/6-knowledge-base.md` 는 `document:graph_error` 를 더 이상 유효한 emit 이벤트로 취급하지 않는다. 그러나 `6-websocket-protocol.md`(723행)와 `2-navigation/5-knowledge-base.md`(182행)는 여전히 `_error` 를 목록에 포함해 emit 가능한 이벤트인 것처럼 기술하고 있다. 소비자(프론트엔드) 가 `document:graph_error` 핸들러를 등록해도 실제로 서버가 emit 하지 않아 핸들러가 사문화된다. 반대로 누군가 이를 "구현해야 하는 미구현 이벤트"로 오해할 위험도 있다.
  - 제안: `spec/5-system/6-websocket-protocol.md` 723행 및 `spec/2-navigation/5-knowledge-base.md` 182행에서 `_error` 를 제거하거나 "(dead-declared, 미emit)" 주석을 추가해 `10-graph-rag.md §6` 의 설명과 일치시킨다.

---

### 요구사항 ID 충돌

- **[INFO]** `KB-GR-*` / `NF-GR-*` 요구사항 ID — 충돌 없음 확인
  - target 신규 식별자: `KB-GR-MD-01~03`, `KB-GR-EX-01~11`, `KB-GR-DM-01~04`, `KB-GR-SR-01~06`, `KB-GR-PA-01~03`, `KB-GR-UI-01~07`, `KB-GR-OB-01~03`, `NF-GR-01~05`
  - 기존 사용처: 다른 spec 파일에서 동일 prefix 로 사용 중인 ID 없음 (`spec/` 전수 검색 결과)
  - 상세: 충돌 없음.

---

### 엔티티/타입명 충돌

- **[INFO]** `Entity`, `Relation`, `ChunkEntity` (Graph RAG 신규 엔티티) — 충돌 없음 확인
  - target 신규 식별자: `Entity`, `Relation`, `ChunkEntity` (신규 DB 테이블 / 도메인 모델)
  - 기존 사용처: `spec/1-data-model.md` §2.23 이후 범위에 선언됨. 다른 스펙 파일들은 기존 엔티티(`KnowledgeBase`, `Document`, `DocumentChunk`)와 명확히 구분해 사용 중.
  - 상세: 충돌 없음. `Entity` / `Relation` 은 일반 영어 단어이지만 KB 컨텍스트 범위 안에서만 사용되어 혼동 위험 낮음.

- **[INFO]** `GraphTraversalSummary` — 단일 사용처, 충돌 없음
  - target 신규 식별자: `GraphTraversalSummary` (검색 응답 메타데이터 타입)
  - 기존 사용처: `spec/5-system/10-graph-rag.md §4.3`, `spec/data-flow/6-knowledge-base.md` 157행 — 동일 의미로 일관 사용
  - 상세: 충돌 없음.

---

### API 엔드포인트 충돌

- **[INFO]** Graph RAG API 엔드포인트 — 충돌 없음 확인
  - target 신규 식별자: `POST /api/knowledge-bases/:id/documents/:docId/re-extract`, `POST /api/knowledge-bases/:id/re-extract`, `GET /api/knowledge-bases/:id/entities`, `DELETE /api/knowledge-bases/:id/entities/:entityId`, `GET /api/knowledge-bases/:id/relations`, `DELETE /api/knowledge-bases/:id/relations/:relationId`, `GET /api/knowledge-bases/:id/graph/stats`, `GET /api/knowledge-bases/:id/graph/visualization`
  - 기존 사용처: `spec/2-navigation/5-knowledge-base.md` 220~221행 — 동일 경로가 동일 의미로 참조됨
  - 상세: 충돌 없음. `spec/2-navigation/5-knowledge-base.md` 와 `spec/data-flow/6-knowledge-base.md` 모두 target 과 일치하는 정의를 가짐.

- **[INFO]** Auth / WebAuthn 엔드포인트 — 충돌 없음 확인
  - target 신규 식별자: `POST /api/auth/2fa/webauthn/register/options`, `POST /api/auth/2fa/webauthn/register/verify`, `POST /api/auth/2fa/webauthn/authenticate/options`, `POST /api/auth/2fa/webauthn/authenticate/verify`, `POST /api/auth/2fa/webauthn/recovery`, `GET /api/auth/2fa/webauthn/credentials`, `PATCH /api/auth/2fa/webauthn/credentials/:id`, `DELETE /api/auth/2fa/webauthn/credentials/:id`, `POST /api/auth/2fa/webauthn/recovery-codes/regenerate`, `GET /api/auth/2fa/webauthn/availability`
  - 기존 사용처: 동일 엔드포인트가 다른 의미로 사용 중인 경우 없음
  - 상세: 충돌 없음.

---

### 환경변수·설정키 충돌

- **[INFO]** `WEBAUTHN_RP_ID`, `WEBAUTHN_RP_NAME`, `WEBAUTHN_ORIGIN`, `WEBAUTHN_ALLOW_FALLBACK` — 충돌 없음 확인
  - target 신규 식별자: 위 4개 환경변수
  - 기존 사용처: `spec/5-system/1-auth.md` §1.4.3 에만 선언, `codebase/backend/src/common/config/webauthn.config.ts` 에서 구현 — 동일 의미로 일관 사용
  - 상세: 충돌 없음.

- **[INFO]** `MCP_ALLOW_INSECURE_URL`, `MCP_MAX_CONCURRENT_CONNECTIONS` — 충돌 없음 확인
  - target 신규 식별자: 위 2개 환경변수
  - 기존 사용처: `spec/5-system/11-mcp-client.md` §3.2, §4.3 에만 선언. `spec/4-nodes/4-integration/1-http-request.md` 105행은 `ALLOW_PRIVATE_HOST_TARGETS` 와 `MCP_ALLOW_INSECURE_URL` 을 명시적으로 구분해 서로 다른 범위임을 기술
  - 상세: 충돌 없음.

---

### 이벤트/메시지명 충돌 (추가)

- **[INFO]** LoginHistory 이벤트 (`login_success`, `login_failed`, `totp_failed`, `webauthn_failed`, `logout`, `session_revoked`, `token_reuse_detected`) — 충돌 없음 확인
  - target 신규 식별자: 위 7개 LoginHistory 이벤트 값 (1-auth.md §4.3)
  - 기존 사용처: `spec/1-data-model.md` 656행, `spec/data-flow/2-auth.md` — 동일 의미로 일관 사용
  - 상세: 충돌 없음.

- **[INFO]** `document:graph_*` WebSocket 이벤트 패밀리 (started/progress/completed/retry/failed) — `document:embedding_*` 과 명명 일관성 유지 확인
  - target 신규 식별자: `document:graph_started`, `document:graph_progress`, `document:graph_completed`, `document:graph_retry`, `document:graph_failed`
  - 기존 사용처: `spec/5-system/8-embedding-pipeline.md` 에 대응하는 `document:embedding_*` 패밀리가 정의되어 있으며 1:1 대응 구조 — `6-websocket-protocol.md` 723행이 이를 명시
  - 상세: 충돌 없음. 명명 패턴 일관성 유지.

---

### 파일 경로 충돌

- **[INFO]** `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md`, `spec/5-system/11-mcp-client.md` — 기존 파일, 충돌 없음
  - target 신규 식별자: 해당 경로들
  - 기존 사용처: 기존에 존재하는 spec 파일들 (신규 생성 아님)
  - 상세: 경로 충돌 해당 없음.

---

## 요약

검토 범위(`spec/5-system/1-auth.md`, `10-graph-rag.md`, `11-mcp-client.md`)에서 신규 도입한 요구사항 ID, 엔티티명, API 엔드포인트, 환경변수, WebSocket 이벤트 식별자는 기존 spec 과 실질적 충돌이 없다. 다만 `document:graph_error` 이벤트의 처리 불일치가 한 건 발견되었다 — `10-graph-rag.md` 와 `data-flow/6-knowledge-base.md` 는 이 이벤트를 "dead-declared, 미emit" 으로 명시하지만 `spec/5-system/6-websocket-protocol.md`(723행)와 `spec/2-navigation/5-knowledge-base.md`(182행)는 여전히 emit 가능한 이벤트인 것처럼 열거하고 있어 구현 시 혼동 가능성이 있다. 이는 critical 수준의 충돌은 아니나, 프론트엔드 핸들러 등록 여부 결정 및 테스트 작성 시 오류를 유발할 수 있으므로 WARNING 으로 분류한다.

---

## 위험도

LOW
