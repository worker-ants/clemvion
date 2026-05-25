# Cross-Spec 일관성 검토 — `spec/5-system/`

검토 모드: `--impl-prep` (구현 착수 전)  
검토 일자: 2026-05-25  
대상 영역: `spec/5-system/` (1-auth.md, 10-graph-rag.md, 11-mcp-client.md 및 해당 영역 전체)

---

## 발견사항

### [INFO] `spec/5-system/1-auth.md` §5 API 목록에 `/api/auth/verify-email` 엔드포인트 미기재

- **target 위치**: `spec/5-system/1-auth.md §5 API 엔드포인트` 표
- **충돌 대상**: `spec/2-navigation/10-auth-flow.md §2.5` — `GET /api/auth/verify-email?token={token}` 가 이메일 인증 플로우에 명시됨
- **상세**: `1-auth.md §5` 의 API 목록에는 `/api/auth/register`, `/api/auth/login` 계열, `/api/auth/forgot-password`, `/api/auth/reset-password` 등이 열거되어 있으나 이메일 인증 엔드포인트(`GET /api/auth/verify-email`)가 누락되어 있다. `auth-flow.md §2.5` 에서는 해당 엔드포인트를 명시하며 인증 성공 시 자동 로그인·워크스페이스 생성 흐름까지 설명하고 있어, API 목록과 UI 플로우 spec 사이에 엔드포인트 목록 불일치가 발생한다.
- **제안**: `spec/5-system/1-auth.md §5` 에 `GET /api/auth/verify-email` 과 이메일 인증 재발송 엔드포인트를 추가하거나, 두 문서 간 참조 링크를 추가한다.

---

### [INFO] `spec/5-system/1-auth.md` §1.4.1 WebAuthn 복구 코드 발급 타이밍 — "첫 credential 등록" 조건의 데이터 모델 표현 부재

- **target 위치**: `spec/5-system/1-auth.md §1.4.1` 복구 코드 표, WebAuthn 행
- **충돌 대상**: `spec/1-data-model.md §2.21 WebAuthnCredential` / `spec/1-data-model.md §2.1 User`
- **상세**: `1-auth.md §1.4.1` 은 "첫 WebAuthn credential 등록 verify 성공 시점" 에 10개 복구 코드를 발급하고 `user.webauthn_recovery_codes` 에 SHA-256 해시 배열로 저장한다고 명시한다. `1-data-model.md §2.1 User` 에도 `webauthn_recovery_codes` 컬럼이 올바르게 정의되어 있다. 그러나 "첫 등록 여부" 를 애플리케이션 코드가 판단할 때의 기준 필드(WebAuthnCredential 개수 쿼리 or User 컬럼)가 스펙 문서 내 어디에도 명시되지 않아, 구현 시 `WebAuthnService.countCredentials()` 가 기준임을 auth.md Rationale 1.4.H 에서만 간접적으로 유추해야 한다. 직접 충돌은 아니나 구현 착수 시 모호성 원인이 될 수 있다.
- **제안**: `1-auth.md §1.4.4` 등록 흐름 또는 §1.4.1 표에 "첫 등록 여부 = `WebAuthnService.countCredentials() == 0` (등록 직전 시점)" 을 한 줄 추가한다.

---

### [INFO] `spec/5-system/10-graph-rag.md §6` WebSocket 채널명 표기 불일치 가능성

- **target 위치**: `spec/5-system/10-graph-rag.md §6` — "채널은 `kb:{documentId}`"
- **충돌 대상**: `spec/5-system/8-embedding-pipeline.md §8` (동일 채널 정의 참조 문구)
- **상세**: `10-graph-rag.md §6` 본문에 "채널은 `kb:{documentId}` (`spec/5-system/8-embedding-pipeline.md §8` 과 동일)" 라고 명시하고 있다. 두 spec 이 같은 채널 이름을 참조하는 구조이므로 `8-embedding-pipeline.md §8` 에서 채널명이 변경될 경우 `10-graph-rag.md` 도 함께 갱신돼야 하는 암묵적 의존이 형성된다. 현재 충돌은 없으나 단일 진실 원칙 관점에서 채널명의 SoT 문서를 명시하지 않아 관리 리스크가 존재한다.
- **제안**: `8-embedding-pipeline.md §8` 에 WebSocket 채널명을 canonical 정의로 명시하거나, `10-graph-rag.md §6` 에서 "SoT: 8-embedding-pipeline.md §8.N" 형식으로 정확히 참조한다.

---

### [INFO] `spec/5-system/11-mcp-client.md §8.2` 에러 코드 `MCP_HTTPS_REQUIRED` 와 API 규약의 SSRF 가이드 참조 불일치

- **target 위치**: `spec/5-system/11-mcp-client.md §3.2` — "본 룰은 [Spec API §SSRF 가이드](./2-api-convention.md) 의 일반화"
- **충돌 대상**: `spec/5-system/2-api-convention.md` (SSRF 가이드가 실제 존재하는지 확인 필요)
- **상세**: `11-mcp-client.md §3.2` 에서 SSRF 차단 정책을 "Spec API §SSRF 가이드 의 일반화" 라고 기술하며 링크를 두고 있다. 해당 링크가 실제 spec 의 어느 섹션을 가리키는지 `2-api-convention.md` 내에서 명시적으로 확인하지 못했다. 외부 링크가 존재하지 않는 섹션을 가리킬 경우 구현자가 기준 문서를 찾을 수 없다.
- **제안**: `spec/5-system/2-api-convention.md` 에 SSRF 방어 가이드 섹션이 없다면 신설하거나, `11-mcp-client.md §3.2` 의 링크를 실제 존재하는 섹션으로 수정한다.

---

### [INFO] `spec/5-system/1-auth.md §4.1` 감사 로그 대상 — `workflow.execute` 이중 정의 가능성

- **target 위치**: `spec/5-system/1-auth.md §4.1` 감사 로그 기록 대상, "워크플로우" 카테고리의 `workflow.execute`
- **충돌 대상**: `spec/1-data-model.md §2.18 AuditLog` — action 필드는 `String` 으로 자유 형식이며 별도 enum 정의 없음
- **상세**: `1-auth.md §4.1` 은 감사 로그의 `workflow.execute` 액션을 기록 대상으로 나열하고 있다. 그러나 실행(execution) 이벤트는 `AuditLog` 가 아닌 `Execution` / `NodeExecution` 테이블에서 직접 추적되는 것이 데이터 모델의 명시적 설계다. 실제로 `1-auth.md §4` 의 도입부에 "워크스페이스 컨텍스트가 없는 인증 이벤트는 LoginHistory" 라고 구분하고 있는데, workflow.execute 는 애매한 경계에 놓여 있다 — Execution 테이블로 이미 추적되는 이벤트를 AuditLog 에도 중복 기록할 것인지 여부가 불명확하다.
- **제안**: `1-auth.md §4.1` 에 `workflow.execute` AuditLog 기록이 "실행 완료/실패 이벤트가 아닌 실행 시작(수동 트리거) 액션만" 을 의미함을 명시하거나, Execution 테이블과의 중복 여부를 Rationale 에 기술한다.

---

### [INFO] RBAC `Viewer` 역할과 `Workflow 실행` 권한 행렬 — `spec/5-system/1-auth.md §3.2` 와 `spec/5-system/_product-overview.md` 간 암묵적 의존

- **target 위치**: `spec/5-system/1-auth.md §3.2` 리소스별 권한 매트릭스
- **충돌 대상**: `spec/2-navigation/_product-overview.md` (역할별 UI 접근 제어 부분), `spec/4-nodes/_product-overview.md`
- **상세**: `1-auth.md §3.2` 에서 `Workflow 실행` 권한이 Owner/Admin/Editor 에게만 부여되고 Viewer 는 `-` 로 표시된다. 동일 매트릭스에서 `Marketplace 설치` 도 Owner/Admin/Editor 에게 허용된다. 내비게이션 spec 이나 노드 spec 에서 이 권한 제한을 각각 구현해야 하는 구체적인 UI 접근 제어 규칙이 어느 spec 을 단일 진실로 삼는지 명시되어 있지 않다. 충돌은 아니나 구현 시 권한 체크 위치가 분산될 수 있다.
- **제안**: `1-auth.md §3.2` 에 "본 표가 RBAC SoT 이며 각 UI/API 는 본 표를 참조해 구현한다" 는 문구를 추가하거나, `spec/conventions/` 에 RBAC 권한 매트릭스 canonical 파일을 분리한다.

---

### [INFO] `spec/5-system/11-mcp-client.md §6.2` `serverSummaries[].serviceType` 필드 — Integration.service_type 값 집합과 동기화 필요

- **target 위치**: `spec/5-system/11-mcp-client.md §6.2 mcpDiagnostics.serverSummaries[].serviceType`
- **충돌 대상**: `spec/1-data-model.md §2.10 Integration.service_type` 값 목록: `google, github, http, database, email, webhook, mcp, cafe24`
- **상세**: `11-mcp-client.md §6.2` 에서 `serverSummaries[].serviceType` 은 `mcp / cafe24 / …` 의 예시 값을 나타내며, 주석에서 `cafe24` 와 `mcp` 를 언급하지만 나머지 `service_type` 값의 처리 방식(Internal Bridge 가 없는 `google`, `github` 등이 `mcpServers` 에 등록될 수 있는지)에 대한 명시가 없다. `data-model.md §2.10` 의 전체 service_type 목록과 `11-mcp-client.md §3.1` 의 "Internal Bridge 적용 service_type" 목록 간의 관계가 암묵적이다.
- **제안**: `11-mcp-client.md §3.1` 에 "mcpServers config 에 등록 가능한 service_type 은 `mcp` (외부 HTTP) 와 Internal Bridge 로 노출된 service_type (`cafe24` 등) 에 한정" 임을 명시하고, 다른 service_type 이 `mcpServers` 에 등록되면 `not_capable` skipReason 이 반환됨을 연결 설명한다.

---

## 요약

`spec/5-system/` 의 세 핵심 파일(`1-auth.md`, `10-graph-rag.md`, `11-mcp-client.md`)과 기존 `spec/**` 전반을 교차 분석한 결과, **CRITICAL 또는 WARNING 등급의 직접적 모순은 발견되지 않았다.** 데이터 모델(User, WebAuthnCredential, KnowledgeBase, Document, Integration)은 `spec/1-data-model.md` 와 `spec/5-system/` 파일들 사이에서 일관성을 유지하고 있으며, API 엔드포인트 목록도 중복 정의나 HTTP method 충돌 없이 분리되어 있다. RBAC 권한 매트릭스(`§3.2`)는 데이터 모델의 역할 enum과 부합하고, WebSocket 이벤트 패턴도 `6-websocket-protocol.md` 의 프레임 규약과 일관된다. 다만 이메일 인증 엔드포인트의 auth.md API 목록 누락, WebSocket 채널명 SoT 불명확, SSRF 가이드 참조 링크의 실존 여부 불확인, workflow.execute AuditLog 기록의 Execution 테이블 중복 모호성 등 **INFO 등급의 명명/참조 비일관성 6건**이 확인되며, 구현 착수 전 문서 정비 수준에서 해소 권장된다.

---

## 위험도

LOW
