# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-prep`
대상 영역: `spec/5-system/`
검토일: 2026-05-25

---

## 발견사항

### [INFO] `spec/5-system/1-auth.md` — 이메일 인증 엔드포인트 API 목록 미수록

- target 위치: `spec/5-system/1-auth.md §5 API 엔드포인트`
- 충돌 대상: `spec/2-navigation/10-auth-flow.md §2.5` — `GET /api/auth/verify-email?token={token}` 및 재발송 엔드포인트를 UI 흐름에서 참조
- 상세: `spec/5-system/1-auth.md §5` 의 공식 API 목록에 `GET /api/auth/verify-email` 와 이메일 재발송 엔드포인트가 없다. `spec/2-navigation/10-auth-flow.md §2.5` 는 이 두 엔드포인트를 실제 동작 흐름에서 사용한다. 실제 기능 구현은 존재할 가능성이 높지만 공식 spec 목록에서 누락되어 auth-flow spec 과 auth spec 사이에 reference 단절이 있다.
- 제안: `spec/5-system/1-auth.md §5` 에 `GET /api/auth/verify-email`, `POST /api/auth/resend-verification` 항목 추가 확인.

---

### [INFO] `spec/5-system/1-auth.md §2.1` — Access Token payload 의 `workspaceId` 필드와 요청별 컨텍스트 관계 미명시

- target 위치: `spec/5-system/1-auth.md §2.2 Access Token Payload`
- 충돌 대상: `spec/0-overview.md §6.1` — "X-Workspace-Id 는 서버가 자동 매핑한다" 명시; `spec/5-system/1-auth.md §3.3 API 인가 흐름` — "Token에서 workspaceId, role 추출"
- 상세: JWT payload 에 `workspaceId` 가 포함되어 있고 §3.3 에서 이를 인가에 활용한다고 기술된다. 그런데 `spec/0-overview.md` 에서는 "X-Workspace-Id 는 서버가 자동 매핑한다"는 설명이 있어, 클라이언트가 헤더로 워크스페이스를 지정하는지 JWT 에서 고정되는지 관계가 불명확하다. 사용자가 여러 워크스페이스에 속한 경우 토큰을 재발급하지 않고 컨텍스트를 전환하는 흐름이 기술되지 않았다.
- 제안: 워크스페이스 전환 시 token 재발급 여부, 또는 X-Workspace-Id 헤더가 JWT의 workspaceId를 override하는지 명시 보완.

---

### [INFO] `spec/5-system/1-auth.md §4.1` — AuditLog 액션 목록이 `spec/1-data-model.md §2.18` 와 부분 비일치

- target 위치: `spec/5-system/1-auth.md §4.1 기록 대상 액션`
- 충돌 대상: `spec/1-data-model.md §2.18 AuditLog`
- 상세: `spec/5-system/1-auth.md §4.1` 의 인증 카테고리에 `password_change`, `2fa_enable/disable` 이 기록 대상으로 나열된다. `spec/1-data-model.md §2.18` 의 AuditLog 엔티티는 이 이벤트 값들의 형식 제약을 별도로 열거하지 않는다. 의미 충돌은 아니지만 LoginHistory (§4.3 / §2.18.2) 와 AuditLog (§4.1 / §2.18) 의 경계가 "워크스페이스 컨텍스트 유무"로 구분된다는 원칙이 데이터 모델 정의에서는 보조 설명에만 있고 공식 AuditLog 테이블 제약에 반영되지 않았다.
- 제안: 동기화 권장 수준. `spec/1-data-model.md §2.18` 또는 AuditLog action enum 정의에 `password_change`, `2fa_enable`, `2fa_disable` 이 워크스페이스 컨텍스트를 가지는 이유를 짧게 주석.

---

### [INFO] `spec/5-system/10-graph-rag.md §6 WebSocket 이벤트` — 채널명 표기가 `spec/5-system/8-embedding-pipeline.md` 와 상이할 수 있음

- target 위치: `spec/5-system/10-graph-rag.md §6` — "채널은 `kb:{documentId}` (`spec/5-system/8-embedding-pipeline.md §8` 과 동일)"
- 충돌 대상: `spec/5-system/8-embedding-pipeline.md §8` (직접 확인은 불가하나 본문 자체 참조)
- 상세: Graph RAG spec 이 embedding-pipeline spec 의 채널 패턴과 동일하다고 명시하지만, 채널 식별자가 `kb:{documentId}` 인지 `document:{documentId}` 인지를 embedding-pipeline spec 의 실제 정의와 교차 확인하지 않으면 클라이언트 구독 코드가 두 이벤트 군을 같은 채널로 수신할 수 있는지 불분명하다.
- 제안: 구현 착수 전 `spec/5-system/8-embedding-pipeline.md §8` 에서 채널 패턴을 직접 확인하고 일치 여부 검증.

---

### [INFO] `spec/5-system/11-mcp-client.md §8.3` — `IntegrationUsageLog §2.10.1` 참조 필드 매핑의 `node_execution_id` nullable 여부 불명확

- target 위치: `spec/5-system/11-mcp-client.md §8.3 IntegrationUsageLog`
- 충돌 대상: `spec/1-data-model.md §2.10.1 IntegrationUsageLog`
- 상세: `spec/1-data-model.md §2.10.1` 의 `node_execution_id` 필드는 `FK → NodeExecution` 으로 기술되어 NOT NULL 이다. MCP 의 `tools/call` 이 AI Agent 노드 실행 범위에서 발생하므로 이론적으로는 항상 연결 가능하지만, 미래 확장(예: 테스트 연결 시 usage log 기록 여부)에서 NULL 처리가 필요할 수 있다. 현재는 일관성이 유지되나, §9 Test Connection 흐름에서 usage log 를 기록하지 않는다는 명시(`buildTools` 단계 미기록) 가 spec 에 있어 NO 충돌로 판단된다.
- 제안: 명시적 동기화는 불필요하나, Test Connection 호출에서 usage log 미생성임을 `spec/1-data-model.md §2.10.1` 의 NOTE 에 한 줄 추가 권장.

---

### [WARNING] `spec/5-system/1-auth.md §1.4.H` — WebAuthnModule 분리 결정이 `spec/5-system/1-auth.md §5 API 목록` 의 컨트롤러 host 설명과 구조 비일치 위험

- target 위치: `spec/5-system/1-auth.md §1.4.H` — "WebAuthnController 파일은 webauthn/ 폴더에 두지만 module 등록은 AuthModule 의 controllers 배열에 한다"
- 충돌 대상: `spec/5-system/1-auth.md §5 API 엔드포인트` — `/api/auth/2fa/webauthn/*` 경로들이 auth spec §5 에서 정의
- 상세: 직접 모순은 아니지만, Rationale §1.4.H 의 모듈 분리 결정 (WebAuthnController → AuthModule controllers 배열 등록) 이 본문 §5 API 목록이나 다른 spec 에서 참조될 때 "왜 auth 모듈에서 webauthn endpoint 를 서빙하는가"가 혼란을 줄 수 있다. 특히 개발자가 구현 착수 시 spec §5 만 읽고 WebAuthnController 가 WebAuthnModule 에 등록된다고 가정하면 Rationale §1.4.H 와 충돌한다.
- 제안: `spec/5-system/1-auth.md §5` 에 WebAuthn 엔드포인트 군 앞에 "(controller 파일: `auth/webauthn/webauthn.controller.ts`, module host: AuthModule — §1.4.H)" 인라인 참조 추가. 또는 §1.4.H 의 내용을 §1.4.4 직후 본문으로 격상.

---

### [WARNING] `spec/5-system/10-graph-rag.md §7` — `reextract_status` 컬럼명이 `spec/1-data-model.md §2.11` 의 정의와 불일치

- target 위치: `spec/5-system/10-graph-rag.md §7 에러 처리` — "`re-extract` 동시 호출: DB 컬럼 (`reextract_status`) atomic compare-and-swap 으로 차단, 409 `KB_REEXTRACT_IN_PROGRESS`"
- 충돌 대상: `spec/1-data-model.md §2.11 KnowledgeBase` — `reextract_status Enum idle / in_progress` 로 동일 컬럼 정의됨
- 상세: 컬럼명과 의미는 양쪽이 일치하나 Graph RAG spec 의 §7 은 `reextract_status` 를 단순히 언급만 하고, 데이터 모델 §2.11 이 canonical 정의를 보유하는 구조다. Graph RAG spec §2.1 의 KnowledgeBase 추가 컬럼 표에는 `reextract_status` 가 **없다** — `spec/1-data-model.md §2.11` 에만 존재한다. 즉, Graph RAG spec 의 자체 데이터 모델 섹션(§2.1)이 `reextract_status` 를 누락했고 §7 에서만 참조한다. 독자가 §2.1 을 SoT 로 보면 해당 컬럼의 존재 자체를 모르게 된다.
- 제안: `spec/5-system/10-graph-rag.md §2.1 KnowledgeBase 추가 컬럼` 표에 `reextract_status` 행 추가 또는 각주로 `spec/1-data-model.md §2.11` 을 SoT 로 명시.

---

### [WARNING] `spec/5-system/1-auth.md §3.1` — RBAC 권한 매트릭스의 `Auth Config` / `LLM Config` 행이 `spec/5-system/_product-overview.md` 와 일치 여부 미확인

- target 위치: `spec/5-system/1-auth.md §3.2 리소스별 권한 매트릭스` — `Auth Config: Owner=CRUD, Admin=CRUD, Editor=R, Viewer=R` / `LLM Config: 동일`
- 충돌 대상: `spec/0-overview.md §6.1` 구현 완료 항목에 "인증/인가(개인·팀 워크스페이스)" 가 포함되어 있으나, `spec/5-system/_product-overview.md` 가 별도 보안 요구사항을 정의하고 있다
- 상세: `spec/5-system/1-auth.md §3.2` 의 RBAC 매트릭스에서 `Auth Config` 와 `LLM Config` 의 Admin 권한이 `CRUD` 로 설정되어 있다. 이는 매우 민감한 자원(API Key, 인증 설정)에 Admin 이 완전한 쓰기 권한을 갖는다는 의미다. 동일한 리소스에 대한 권한 정의가 다른 spec 파일에 중복 정의되거나 워크스페이스 설정 화면 spec 에서 다르게 기술될 경우 모순이 발생한다. 본 검토 범위에서는 직접 충돌 파일을 확인하지 못했으나 잠재 위험이 있어 WARNING 으로 표기.
- 제안: `spec/2-navigation/` 의 LLM Config / Auth Config 화면 spec 에서 권한 서술이 있다면 §3.2 와 대조 확인.

---

### [WARNING] `spec/5-system/11-mcp-client.md §2.3` — Internal Bridge 의 `not_capable` skipReason 과 실제 provider 라우팅 규칙 간 구체 조건 미정의

- target 위치: `spec/5-system/11-mcp-client.md §6.2` — `skipReason` vocabulary 의 `not_capable: mcpServers 에 등록된 Integration 의 service_type 이 본 provider 가 처리할 대상 아님`
- 충돌 대상: `spec/5-system/11-mcp-client.md §3.1` — `service_type='mcp'` (외부 HTTP) 와 Internal Bridge service_type(현재 `cafe24`) 의 routing 분리
- 상세: `not_capable` skipReason 은 "provider 라우팅 정상 동작 확인용"으로 설명되나, McpToolProvider 가 어떤 service_type 을 처리하는지 (외부 HTTP transport `mcp` + Internal Bridge `cafe24`가 같은 provider 인지 다른 provider 인지)의 라우팅 경계가 §3.1 외에 명시적으로 정의되지 않았다. 구현 시 혼동의 여지가 있다.
- 제안: `spec/5-system/11-mcp-client.md §6.1` 또는 §3.1 에서 McpToolProvider 가 처리하는 service_type 집합을 명시 (`mcp` + `cafe24` + 향후 first-party bridge).

---

## 요약

`spec/5-system/` 영역은 인증(`1-auth.md`), Graph RAG(`10-graph-rag.md`), MCP 클라이언트(`11-mcp-client.md`) 등 주요 시스템 스펙으로 구성되며, 전반적으로 `spec/1-data-model.md`, `spec/0-overview.md`, `spec/2-navigation/10-auth-flow.md` 와의 참조 정합성은 높은 편이다. 다만 세 가지 WARNING 수준 항목이 존재한다: (1) `1-auth.md §1.4.H` WebAuthn 모듈 분리 결정이 §5 API 목록 독자에게 혼란을 줄 수 있는 구조적 문제, (2) `10-graph-rag.md §2.1` 의 KnowledgeBase 추가 컬럼 표에서 `reextract_status` 누락 — `spec/1-data-model.md §2.11` 과의 단절, (3) `11-mcp-client.md` 의 Internal Bridge provider 라우팅 경계 불명확. INFO 항목들은 API 목록 미수록, 토큰 payload 컨텍스트 전환 흐름 미명시, AuditLog 이벤트 카테고리 정의 산재 등이며 구현 실행 전 명확화를 권장한다. CRITICAL 수준의 직접 모순은 발견되지 않았다.

---

## 위험도

MEDIUM
