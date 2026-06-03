# PRD: 통합/연동

> 관련 문서: [제품 개요](../../0-overview.md) · [내비게이션](../../2-navigation/_product-overview.md) · [노드 시스템](../_product-overview.md) · [Spec 통합 화면](../../2-navigation/4-integration.md) · [Spec Knowledge Base](../../2-navigation/5-knowledge-base.md) · [Spec 마켓플레이스](../../2-navigation/8-marketplace.md)

---

## 1. 개요

외부 서비스와의 연동(Integration), AI 에이전트를 위한 지식 저장소(Knowledge Base), 그리고 생태계를 위한 마켓플레이스(Marketplace)에 대한 요구사항을 정의한다.

---

## 2. Integration (외부 서비스 연동)

### 2.1 연동 관리

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| INT-MG-01 | Third-party 서비스와의 연동 설정을 중앙에서 관리 | 필수 |
| INT-MG-02 | 연동 생성 시 서비스 유형 선택 후 인증 정보 입력 | 필수 |
| INT-MG-03 | 하나의 서비스에 대해 여러 계정/인스턴스의 연동 설정 가능 | 필수 |
| INT-MG-04 | 연동 설정에 별칭(이름) 부여하여 구분 | 필수 |
| INT-MG-05 | 연동별 상세 페이지 제공 (개요, 보안, 사용처, 최근 활동) | 필수 |
| INT-MG-06 | 자격 증명 회전(Rotation) 기능 — 비OAuth는 교체 폼, OAuth는 재인증. 연결 테스트 성공 시에만 저장 커밋, 마지막 회전 시각 표시 | 필수 |
| INT-MG-07 | Personal ↔ Organization 범위 전환 — Admin만 가능하며 확인 다이얼로그 필수. 기존 자격 증명 승계 | 필수 |
| INT-MG-08 | 추가 플로우는 목록 모달(서비스 선택) → 별도 페이지(`/integrations/new?service=…`) 하이브리드 구조로 제공 | 필수 |

### 2.2 인증 방식

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| INT-AU-01 | OAuth 2.0 인증 플로우 (Authorization Code, Client Credentials) | 필수 |
| INT-AU-02 | API Key 기반 인증 | 필수 |
| INT-AU-03 | Bearer Token 인증 | 필수 |
| INT-AU-04 | 토큰 자동 갱신 (OAuth Refresh Token) | 필수 |
| INT-AU-05 | 인증 정보 암호화 저장 | 필수 |
| INT-AU-06 | OAuth 연동 생성 시 사용자에게 scope 체크박스 선택 제공 (서비스별 권장 기본값 프리셋) | 필수 |
| INT-AU-07 | 노드 실행 중 `insufficient_scope` 감지 시 연동 상태를 `error(insufficient_scope)`로 전이하고, 상세 페이지에 누락 scope 배지 + "Scope 추가 요청" 액션 제공. `insufficient_scope` 는 공통 statusReason union·알림 인프라로 존재하나, 현재 이를 실제로 **감지·전이하는 실행 경로는 cafe24 한정** (`cafe24-api.client.ts` / `cafe24-mcp-tool-provider.ts`); 타 핸들러(http/database/email)로의 일반화는 미구현(Planned) | 필수 |
| INT-AU-08 | Basic Auth (username + password) 인증 지원 (HTTP/REST 연동용) | 필수 |
| INT-AU-09 | Connection String 기반 인증 지원 (Database) | 필수 |
| INT-AU-10 | SMTP 인증 (host/port/secure/user/pass) 지원 (Email) | 필수 |

### 2.3 상태 및 알림

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| INT-ST-01 | 연동 상태 Enum: `connected` / `expired` / `error` / `pending_install`. `error` 상태는 `statusReason` 머신 판독 값을 동반 — `auth_failed`, `insufficient_scope`, `network`, OAuth/Cafe24 install 관련 사유(`install_timeout`, `oauth_state_invalid`, `oauth_token_exchange_failed`, `oauth_invalid_scope` 등), 미분류 fallback `unknown_error`. union 밖 값은 `unknown_error` 로 정규화 (`integration-status-reason.ts`) | 필수 |
| INT-ST-02 | 만료 스캐너 Cron — 4개 독립 BullMQ 잡. `connected-expiry` / `pending-install-ttl` / `usage-log-prune` 은 daily 00:00 UTC (임계치 7일/3일/당일에 상태·알림 생성, 24h TTL sweep, 90d retention prune). `cafe24-background-refresh` 는 6h `0 */6 * * *` UTC — refresh_token 14일 만기 사전 차단용 (cafe24 한정, `lastRotatedAt < now-7d OR IS NULL` 대상). 자세한 분기는 [통합 §11.1](../../2-navigation/4-integration.md#111-스캐너-잡) | 필수 |
| INT-ST-03 | 사이드바 Integration 메뉴에 주의 필요(만료 임박/에러) 개수 배지 표시, 목록 카드와 상세 헤더에 상태 배지 노출 | 필수 |
| INT-ST-04 | 인앱 알림(종 드롭다운)에 만료 임박·재인증 실패 이벤트 표시. 사용자별 이메일 알림 토글을 옵션으로 제공 | 필수 |

### 2.4 사용처 추적 및 라이프사이클

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| INT-US-01 | 연동을 사용 중인 워크플로우·노드를 추적 (노드 `config.integrationId` 참조 기준, 활성/비활성 무관) | 필수 |
| INT-US-02 | 사용처가 존재하는 연동은 삭제 차단 — 사용 중 노드 목록을 표시하고 "먼저 연동을 교체하거나 노드를 제거" 안내 | 필수 |
| INT-US-03 | 연동이 `expired`/`error` 상태로 전이되면 이를 참조하는 노드의 워크플로우 에디터에 경고 뱃지 표시 | 필수 |
| INT-US-04 | 연동별 최근 호출 이력을 조회 가능하도록 `integration_usage_log` 기록 (노드 실행 시점마다 1건). 최근 7일 호출 수 차트 제공 | 필수 |
| INT-US-05 | `integration_usage_log` 기록 시 호출 대상 API 식별 정보 (`api_label`/`api_method`/`api_path`) 를 함께 저장하여, 통합 상세 §4.6 Recent activity 탭에서 어떤 API 가 호출됐는지 사용자가 식별 가능. 채우기 정책은 통합별로 비대칭 (아래 표) — **`integration_usage_log` 에 행을 쓰는 모든 실행 경로** (노드 핸들러 + AI Agent Internal Bridge MCP provider — 아래 "실행 경로" 참조) 는 `logUsage` 호출 시 `api` 식별 정보를 동반할 의무가 있다. 길이 한도 초과 시 백엔드가 끝에 `…` 를 붙여 자르고 저장 (`clampMessage` 패턴) | 필수 |

**활동 로그 API 식별 — 통합별 채우기 정책 (INT-US-05)**

| 통합 | `api_label` | `api_method` | `api_path` |
|---|---|---|---|
| cafe24 ([§4-cafe24.md](./4-cafe24.md)) | catalog key (`cafe24.<resource>.<operation>`) | operation 의 HTTP method (`GET`/`POST`/...) | operation 의 path template (placeholder 그대로 — `products/{product_no}`) |
| http-request ([§1-http-request.md](./1-http-request.md)) | NULL | HTTP method | host + path. query string 제거. baseUrl 없으면 path-only |
| database-query ([§2-database-query.md](./2-database-query.md)) | NULL | SQL 동사 (`SELECT`/`INSERT`/`UPDATE`/`DELETE`) — `queryType='raw'` 처럼 첫 토큰이 SQL 동사가 아닌 경우 NULL 폴백 | driver (`postgres` / `mysql`) |
| send-email ([§3-send-email.md](./3-send-email.md)) | NULL | `SEND` | SMTP host or NULL |

각 핸들러의 채우기 정책 상세는 해당 노드 spec 의 "활동 로그" 절 참조. 본 표가 단일 진실 — 위배는 [`spec/2-navigation/4-integration.md §4.6 / §9.3`](../../2-navigation/4-integration.md#46-recent-activity-탭) 의 UI 분기 (라벨 / endpoint / `—` fallback) 와 직접 어긋난다.

**실행 경로 (api 동반 의무의 적용 범위)** — `integration_usage_log` 에 행을 쓰는 코드 경로는 두 부류이며, **양쪽 모두** `logUsage` 호출 시 위 표대로 `api` 를 채울 의무가 있다:

1. **노드 핸들러 경로** — cafe24 / http-request / database-query / send-email 노드가 `IntegrationHandlerBase.logUsage` (`api` 인자 전달) 를 경유. base class 가 `api` 를 `IntegrationsService.logUsage` 로 forward.
2. **AI Agent Internal Bridge 경로** — AI Agent 노드에 연결된 통합을 MCP tool 로 노출하는 provider (현재 cafe24: `Cafe24McpToolProvider`) 가 노드 base class 를 거치지 않고 `IntegrationsService.logUsage` 를 **직접 호출**한다. cafe24 Internal Bridge 는 노드 핸들러와 **동일한 catalog key 형식** (`cafe24.<resource>.<operation>`) 으로 `api.label` 을 채운다.

> **누락 사각지대 주의**: Internal Bridge 경로는 노드 핸들러 base class 를 거치지 않으므로, `api` 채우기를 빠뜨려도 노드 핸들러 테스트는 통과한다. **신규 통합 실행 경로 (새 노드 핸들러 또는 새 Internal Bridge provider) 를 추가할 때 `logUsage` 호출의 `api` 동반은 필수 체크 항목이다.** 결정 근거: [`spec/2-navigation/4-integration.md ## Rationale`](../../2-navigation/4-integration.md#rationale).

### 2.5 Webhook 서비스 경계

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| INT-WH-01 | Integration의 Webhook 서비스는 **Outbound 전용** — 외부 엔드포인트로의 HTTP 호출 대상을 미리 정의 (URL, method, 기본 헤더, 서명 secret) | 필수 |
| INT-WH-02 | Inbound Webhook URL 발급은 Trigger(type=webhook)에서만 담당하며, Integration Webhook과 상호 참조·공유하지 않는다 | 필수 |

### 2.6 지원 서비스

> 워크플로우 내에서 Integration을 노드로 사용하는 방법은 [PRD 노드 시스템 §7 Integration 노드](../_product-overview.md#7-integration-노드-3종)를 참조한다.

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| INT-SV-01 | HTTP/REST — 범용 HTTP 요청 (GET, POST, PUT, DELETE 등) | 필수 |
| INT-SV-02 | Database — PostgreSQL, MySQL 등 직접 쿼리 | 필수 |
| INT-SV-03 | Email (SMTP) — 이메일 전송 | 필수 |
| INT-SV-04 | Webhook — 외부 이벤트 수신 | 필수 |
| INT-SV-05 | Cafe24 — 한국 이커머스 SaaS 의 Admin API (상품·주문·회원 등 18 카테고리). 같은 Integration 이 워크플로 노드와 AI Agent MCP 도구 양쪽에서 활용 ([Spec Cafe24 노드](./4-cafe24.md)) | 필수 |
| INT-SV-06 | Google — OAuth 2.0 기반 Google API 연동 (Drive / Sheets / Gmail send / Calendar scope). `service-registry.ts` 에 등록, 토큰 자동 갱신 지원 | 필수 |
| INT-SV-07 | GitHub — OAuth 2.0 또는 Personal Access Token(Bearer) 인증. repo / read:org / workflow / gist scope. `service-registry.ts` 에 등록 | 필수 |
| INT-SV-08 | MCP Server — 외부 MCP(Model Context Protocol) 서버 연동. `service-registry.ts` 에 등록 (`mcp`) | 필수 |

### 2.7 조직 레벨 연동

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| INT-OG-01 | 팀 워크스페이스에서 조직 레벨 연동 설정 생성 | 필수 |
| INT-OG-02 | 조직 연동은 해당 워크스페이스의 모든 멤버가 워크플로우에서 사용 가능 | 필수 |
| INT-OG-03 | 조직 연동의 생성/수정/삭제 권한은 관리자(Admin)에게만 부여 | 필수 |
| INT-OG-04 | 개인 연동과 조직 연동을 구분하여 표시 | 필수 |

---

## 3. Knowledge Base (지식 저장소)

### 3.1 문서 관리

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| KB-DC-01 | 지식 저장소에 문서를 업로드하여 관리 | 필수 |
| KB-DC-02 | 지원 형식: 텍스트(.txt), Markdown(.md), PDF(.pdf), CSV(.csv) | 필수 |
| KB-DC-03 | 문서를 컬렉션(폴더)으로 그룹화 | 필수 |
| KB-DC-04 | 문서 내용 미리보기 | 필수 |
| KB-DC-05 | 문서 추가/수정/삭제 | 필수 |
| KB-DC-06 | 문서 메타데이터 관리 (태그, 설명) | 권장 |

### 3.2 검색 모드

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| KB-MD-01 | KB 생성 시 검색 모드를 `vector` (default) / `graph` 중 선택 | 필수 |
| KB-MD-02 | 검색 모드는 **생성 시에만 결정, 사후 변경 불가** (모드 전환은 새 KB 생성으로 대체) | 필수 |
| KB-MD-03 | `graph` 모드는 vector seed → 그래프 확장 → rerank 의 Hybrid 흐름. 상세는 [PRD Graph RAG](../../5-system/10-graph-rag.md) | 필수 |

### 3.3 벡터 임베딩

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| KB-VE-01 | 문서 업로드 시 자동으로 벡터 임베딩 생성 | 필수 |
| KB-VE-02 | 임베딩 모델 선택 가능 (Config LLM 설정 연동) | 필수 |
| KB-VE-03 | 문서 수정 시 임베딩 자동 재생성 | 필수 |
| KB-VE-04 | 임베딩 처리 상태 표시 (대기/처리 중/완료/오류) | 필수 |
| KB-VE-05 | 청크(Chunk) 분할 전략 설정 (크기, 오버랩) | 권장 |

### 3.4 AI Agent 연동

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| KB-AG-01 | AI Agent 노드에서 참조할 Knowledge Base 컬렉션 선택 가능. 모드(`vector` / `graph`) 와 무관하게 동일 인터페이스 | 필수 |
| KB-AG-02 | 검색 시 유사도 임계값 설정 | 권장 |
| KB-AG-03 | 검색 결과 수(Top-K) 설정 | 권장 |
| KB-AG-04 | graph 모드 KB 의 그래프 검색 파라미터 (`maxHops`, `vectorSeedTopK`, `expandedChunkLimit`) 는 KB 단위에서만 제어. AI Agent 노드는 그대로 `ragTopK` / `ragThreshold` 만 노출 | 필수 |

---

## 4. Marketplace (마켓플레이스) — 미구현 (Planned)

> **구현 상태**: 본 §4 전체는 **현재 미구현(Planned)** 이다. 백엔드/프론트엔드에 marketplace 모듈·라우트·식별자가 전무하다 (2026-06-03 spec-vs-code audit 기준 0% 구현). 아래 표의 요구사항은 **목표 정의**이며, 코드 현실은 아직 어떤 surface 도 제공하지 않는다.

### 4.1 콘텐츠 유형

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| MP-CT-01 | 워크플로우 템플릿 — 즉시 사용/커스터마이즈 가능한 워크플로우 | 필수 |
| MP-CT-02 | AI Agent 프리셋 — 시스템 프롬프트, 모델 설정, 도구 구성 | 필수 |
| MP-CT-03 | Integration 플러그인 — 새로운 서비스 연동 확장 | 필수 |
| MP-CT-04 | 커스텀 노드 — 사용자 정의 노드 | 필수 |

### 4.2 소비(설치/사용)

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| MP-CS-01 | 카테고리/태그 기반 브라우징 | 필수 |
| MP-CS-02 | 검색 기능 (키워드, 필터) | 필수 |
| MP-CS-03 | 상세 페이지 (설명, 스크린샷, 사용법, 리뷰) | 필수 |
| MP-CS-04 | 원클릭 설치 | 필수 |
| MP-CS-05 | 설치된 항목 업데이트 관리 | 필수 |
| MP-CS-06 | 평점/리뷰 작성 및 조회 | 권장 |

### 4.3 게시(퍼블리싱)

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| MP-PB-01 | 자체 제작한 워크플로우/노드/Agent 프리셋을 마켓플레이스에 게시 | 필수 |
| MP-PB-02 | 게시 전 검증(Validation) 프로세스 | 필수 |
| MP-PB-03 | 버전 관리 (새 버전 게시, 이전 버전 유지) | 필수 |
| MP-PB-04 | 게시자 프로필 및 대시보드 | 권장 |
| MP-PB-05 | 게시물 통계 (다운로드 수, 평점 추이) | 권장 |
