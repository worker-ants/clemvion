---
id: data-model
status: implemented
code:
  - codebase/backend/src/modules/**/entities/*.entity.ts
  - codebase/backend/migrations/V*.sql
pending_plans:
  - plan/in-progress/exec-park-durable-resume.md
---

# Spec: 데이터 모델

> 관련 문서: [Spec 아키텍처 개요](./0-overview.md) · [PRD 개요](./0-overview.md) · [PRD 노드 시스템](./4-nodes/_product-overview.md)

---

## 1. 엔티티 관계 개요

```
User ──┬── Workspace (1:N)
       │       │
       │       ├── Folder (1:N, 자기참조 parent_id)
       │       ├── Workflow (1:N)
       │       │       ├── Node (1:N)
       │       │       ├── Edge (1:N)
       │       │       ├── WorkflowVersion (1:N)
       │       │       └── Execution (1:N)
       │       │               └── NodeExecution (1:N)
       │       │
       │       ├── Integration (1:N)
       │       └── IntegrationUsageLog (1:N)
       │       ├── Schedule (1:N)
       │       ├── Trigger (1:N)
       │       ├── KnowledgeBase (1:N)
       │       │       └── Document (1:N)
       │       │
       │       ├── AgentMemory (1:N)
       │       ├── LLMConfig (1:N)
       │       ├── RerankConfig (1:N)
       │       ├── AuthConfig (1:N)
       │       ├── AuditLog (1:N)
       │       ├── Notification (1:N)
       │       ├── SecretStore (1:N)
       │       └── AssistantSession (1:N)
       │               └── AssistantMessage (1:N)
       │
       └── WorkspaceMember (N:M via join)
```

---

## 2. 핵심 엔티티

### 2.1 User

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| email | String | 고유, 로그인 식별자 |
| password_hash | String | 비밀번호 해시 (bcrypt) |
| name | String | 표시 이름 |
| avatar_url | String? | 프로필 이미지 URL |
| locale | String | 언어 설정 (기본: "ko") |
| theme | Enum | light / dark |
| two_factor_enabled | Boolean | TOTP 2FA 활성 여부 (WebAuthn credential 등록 여부와는 독립 — WebAuthn 만 등록한 사용자는 이 값이 false) |
| two_factor_secret | String? | TOTP secret (otplib base32). 활성화 verify 전까지는 채워져 있어도 `two_factor_enabled = false`. 비활성 시 NULL |
| totp_recovery_codes | String[]? | TOTP 활성화 시점에 발급한 복구 코드 10개의 SHA-256 해시 배열. 사용 시 해당 항목 제거 |
| webauthn_recovery_codes | String[]? | WebAuthn 첫 credential 등록 시점에 발급한 복구 코드 10개의 SHA-256 해시 배열. 모든 credential 삭제 시 NULL 로 비움 — **이 NULL 화는 애플리케이션 레이어(`WebAuthnService.deleteCredential`) 의 책임이며 DB 트리거가 아니다.** 사용자가 명시적으로 "재발급" 시에도 갱신 |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

WebAuthn (Passkey/보안 키) credential 자체는 별도 엔티티 [§2.21 WebAuthnCredential](#221-webauthncredential) 에 보관한다. User 행에는 위 `webauthn_recovery_codes` 와 (간접적으로) credential 개수만 영향을 준다.

### 2.2 Workspace

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| name | String | 워크스페이스 이름 |
| type | Enum | personal / team |
| owner_id | UUID | FK → User |
| slug | String | URL 슬러그 |
| settings | JSONB | 워크스페이스 설정. 알려진 키: `timezone: string?` (IANA, NAV-SC-06 — 미설정 시 서버 default `process.env.TZ` → `UTC`. AI 노드의 System Context Prefix ([Spec AI 공통 §11.3](./4-nodes/3-ai/0-common.md#113-timezone-sot-정책)) 와 Schedule 의 default timezone 이 본 값을 참조); `interactionAllowedOrigins: string[]?` (External Interaction API 의 `/api/external/*` CORS allowlist 및 임베드 origin allowlist — [Spec EIA §8.5](./5-system/14-external-interaction-api.md#85-cors), [Spec Channel Web Chat 보안](./7-channel-web-chat/4-security.md). 위젯 hosted CDN origin 은 빌트인 허용, 본 목록은 BYO-UI 고객 도메인 등 추가 origin 용. **편집: `PATCH /api/workspaces/:id/settings`**(Admin+, [Spec 사용자/워크스페이스 §6.1·§4.3](./2-navigation/9-user-profile.md))) |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

### 2.3 WorkspaceMember

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace |
| user_id | UUID | FK → User |
| role | Enum | owner / admin / editor / viewer |
| invited_at | Timestamp | 초대 시각 |
| joined_at | Timestamp? | 합류 시각 |

### 2.4 Workflow

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace |
| name | String | 워크플로우 이름 |
| description | String? | 설명 |
| is_active | Boolean | 활성 상태 |
| tags | String[] | 태그 목록 |
| folder_id | UUID? | FK → Folder (정리용) |
| settings | JSONB | 워크플로우 레벨 설정 |
| current_version | Integer | 현재 버전 번호 |
| created_by | UUID | FK → User |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

### 2.5 Folder

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace |
| name | String | 폴더 이름 |
| parent_id | UUID? | FK → Folder (중첩 폴더 지원) |
| sort_order | Integer | 정렬 순서 (기본: 0) |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

**제약 조건:**
- `(workspace_id, parent_id, name)` UNIQUE — 같은 위치에 동일 이름 불가
- 중첩 깊이 제한: 최대 5단계

### 2.6 Node

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workflow_id | UUID | FK → Workflow |
| type | Enum | 노드 유형 (if_else, switch, loop, ..., ai_agent, text_classifier, information_extractor, http_request, ..., transform, code, carousel, table, chart, form, template) |
| category | Enum | trigger / logic / flow / ai / integration / data / presentation (7종 — `trigger` 는 V003 에서 추가, Manual Trigger 시작 노드용) |
| label | String | 사용자 지정 노드 이름 |
| position_x | Float | 캔버스 X 좌표 |
| position_y | Float | 캔버스 Y 좌표 |
| config | JSONB | 노드별 설정 값 |
| is_disabled | Boolean | 비활성 여부 |
| description | String? | 메모/설명 |
| container_id | UUID? | FK → Node. 컨테이너 노드(Loop/ForEach/Map) 내부에 배치된 경우. 엣지 연결/삭제로 자동 동기화(§11.2.1 canvas 스펙 참조). Background 는 컨테이너 멤버십을 사용하지 않고 `background` 포트 엣지로 본문을 식별한다 ([PRD 3 §4.12 ND-BG-05 대안 구현](./4-nodes/_product-overview.md#412-background) / [Spec 실행 엔진 §3.3](./5-system/4-execution-engine.md#33-background-실행)) |
| tool_owner_id | UUID? | FK → Node. AI Agent의 Tool Area에 등록된 경우 |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

**제약 조건:**
- `container_id`와 `tool_owner_id`는 동시에 값을 가질 수 없음 (CHECK 제약)
- `container_id`가 참조하는 노드의 type은 `loop`, `foreach`, `map` 중 하나여야 함 (Background는 도입 시 추가)
- `container_id` 체인은 순환하지 않아야 함 — 실행 시 `CONTAINER_CYCLE` 에러로 거부
- 트리거 카테고리 노드(`manual_trigger` 등)는 `container_id`를 가질 수 없음 — 실행 시 `CONTAINER_INVALID_CHILD` 에러로 거부
- `tool_owner_id`가 참조하는 노드의 type은 `ai_agent`여야 함

**Node.type 전체 목록:**

| category | type | 설명 |
|----------|------|------|
| logic | if_else | 조건 분기 |
| logic | switch | 다중 분기 |
| logic | loop | 반복 |
| logic | variable_declaration | 변수 선언 |
| logic | variable_modification | 변수 수정 |
| logic | split | 배열 분리 |
| logic | map | 배열 변환 |
| logic | filter | 배열을 조건에 따라 `match` / `unmatched` 두 포트로 분리 ([Spec Filter 노드](./4-nodes/1-logic/8-filter.md)) |
| logic | foreach | 순차 반복 |
| logic | parallel | 병렬 실행 |
| logic | merge | 데이터 합산 |
| logic | background | 백그라운드 실행 |
| flow | workflow | 서브 워크플로우 호출 |
| ai | ai_agent | AI Agent 실행 |
| ai | text_classifier | 텍스트 분류 |
| ai | information_extractor | 정보 추출 |
| integration | http_request | 범용 HTTP 요청 |
| integration | database_query | 데이터베이스 쿼리 |
| integration | send_email | 이메일 발송 (SMTP) |
| integration | cafe24 | Cafe24 Admin API (Resource × Operation 동적 폼). 같은 Integration 이 AI Agent MCP 도구로도 사용 ([Spec Cafe24 노드](./4-nodes/4-integration/4-cafe24.md)) |
| integration | makeshop | MakeShop Shop API (Resource × Operation 동적 폼, 7 섹션 161 REST). cafe24 와 동일하게 AI Agent MCP 도구로도 사용 ([Spec MakeShop 노드](./4-nodes/4-integration/5-makeshop.md)). `Node.type` 은 `VARCHAR(50)` 자유값이라 enum 마이그레이션 불필요. makeshop 통합 중복 방지는 통일 store-identifier partial UNIQUE 인덱스(§3 `idx_integration_workspace_service_mall`, V072)가 `(workspace_id, service_type, mall_id)` 기준으로 강제 (service_type 무관 — 신규 통합 인덱스 추가 불필요) |
| data | transform | 데이터 변환 (연산 체인) |
| data | code | JavaScript 코드 실행 |
| presentation | carousel | 캐러셀(슬라이드) 시각화 |
| presentation | table | 테이블 시각화 |
| presentation | chart | 차트 시각화 |
| presentation | form | 사용자 입력 폼 (Human-in-the-loop) |
| presentation | template | 템플릿 기반 콘텐츠 생성 |

### 2.7 Edge

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workflow_id | UUID | FK → Workflow |
| source_node_id | UUID | FK → Node (출력 노드) |
| source_port | String | 출력 포트 식별자 (예: "true", "false", "default", "out_0") |
| target_node_id | UUID | FK → Node (입력 노드) |
| target_port | String | 입력 포트 식별자 (기본: "in") |
| type | Enum | 엣지 유형: `data` (기본) / `error` (에러 포트 엣지) |
| condition | JSONB? | 엣지 조건 (조건부 라우팅용) |
| created_at | Timestamp | 생성 시각 |

**제약 조건:**
- `(source_node_id, source_port, target_node_id, target_port)` UNIQUE — 동일 연결 중복 방지
- 자기 자신으로의 연결 불가 (`source_node_id != target_node_id`)
- source_node와 target_node는 같은 workflow_id에 속해야 함

### 2.8 Trigger

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace |
| workflow_id | UUID | FK → Workflow |
| type | Enum | webhook / schedule / manual (chat-channel 은 별도 type 이 아니라 `webhook` 트리거의 `config.chatChannel` 변형 — [Spec Chat Channel](./5-system/15-chat-channel.md) 참조) |
| name | String | 트리거 이름 |
| is_active | Boolean | 활성 상태 |
| config | JSONB | 트리거별 설정. `notification` / `interaction` 서브 필드는 [Spec External Interaction API §7.1](./5-system/14-external-interaction-api.md#71-trigger-엔티티-확장) 참조. `chatChannel` 서브 필드 (외부 chat 플랫폼 어댑터) 는 [Spec Chat Channel §4.1](./5-system/15-chat-channel.md#41-triggerconfigchatchannel) 참조. 응답 DTO 전용 derived 필드 `hasBotToken: boolean` (`botTokenRef IS NOT NULL → true`) — DB 컬럼 아님, SoT [Spec Chat Channel §5.4.2](./5-system/15-chat-channel.md#542-응답-dto-derived-필드--hasbottoken) |
| endpoint_path | String? | Webhook URL 경로 (type=webhook) |
| auth_config_id | UUID? | FK → AuthConfig (Webhook 인증) |
| last_triggered_at | Timestamp? | 마지막 실행 시각 |
| notification_health | Enum | unknown / healthy / degraded. Outbound notification 발송 건강도. default=`unknown`. [Spec EIA §3.1 EIA-NX-07](./5-system/14-external-interaction-api.md#31-outbound-notification-notification-webhook) |
| notification_last_error | Text? | Outbound notification 최종 실패 시 마지막 에러 메시지 (truncate 가능) |
| notification_secret_v2 | Text? | Secret rotation 기간 (24h grace) 동안 사용되는 신규 secret (NOT NULL 이면 `config.notification.signing.secret` 와 둘 다 검증) |
| notification_rotated_at | Timestamp? | Secret rotation 시작 시각 (grace 종료 판정용) |
| chat_channel_health | Enum | unknown / healthy / degraded. Chat Channel 어댑터의 외부 채널 호출 건강도. default=`unknown`. [Spec Chat Channel §3.4 CCH-SE-01](./5-system/15-chat-channel.md#34-신뢰성--보안). `notification_health` 와 enum 값 집합이 동일 — 향후 공용 DB 타입 통합 검토 |
| chat_channel_last_error | Text? | Chat Channel 어댑터 외부 호출 최종 실패 시 마지막 에러 메시지 (truncate 가능) |
| chat_channel_setup_at | Timestamp? | `setupChannel()` 성공 시각. setup 미수행이면 NULL |
| chat_channel_token_v2 | Text? | Bot token rotation grace 기간 (24h) 동안 사용되는 신규 bot token reference. **Semantic 비대칭 주의**: `notification_secret_v2` (HMAC signing secret) 와 명명 패턴은 동일하나 의미는 다름 — `chat_channel_token_v2` 는 외부 provider bot token reference (예: 텔레그램 Bot API token). [Spec Chat Channel §4.2 / §R-K](./5-system/15-chat-channel.md#42-trigger-테이블-신규-컬럼) |
| chat_channel_rotated_at | Timestamp? | Bot token rotation 시작 시각 (grace 종료 판정용) |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

### 2.9 Schedule

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace |
| trigger_id | UUID | FK → Trigger |
| cron_expression | String | Cron 표현식 |
| timezone | String | 타임존 (IANA) |
| is_active | Boolean | 활성 상태 |
| next_run_at | Timestamp | 다음 실행 예정 시각 |
| last_run_at | Timestamp? | 마지막 실행 시각 |
| parameter_values | JSONB | 워크플로우 Manual Trigger 노드 스키마에 대응하는 파라미터 값 맵. 값 문자열에 `{{ $now }}`, `{{ $schedule.* }}` 등 제한 표현식 사용 가능. 기본값 `{}`. |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

### 2.9.1 Trigger ↔ Schedule 동기화 규칙

Schedule은 Trigger의 서브타입이다. 양쪽의 라이프사이클과 상태는 동기화된다.

| 이벤트 | 동작 |
|--------|------|
| Schedule 생성 | Trigger 자동 생성 (type=`schedule`, 동일 이름, 동일 워크플로우, is_active 동기화) |
| Schedule 이름 변경 | 연결된 Trigger 이름도 동기화 |
| Schedule is_active 변경 | 연결된 Trigger is_active도 동기화 (역방향도 동일) |
| Schedule 삭제 | 연결된 Trigger cascade 삭제 |
| Trigger(type=schedule) 삭제 | 연결된 Schedule cascade 삭제 |
| Trigger(type=schedule) 직접 생성 | 금지 — Schedule 화면에서만 생성 가능 |

**제약 조건:**
- Schedule.trigger_id는 NOT NULL — 반드시 Trigger와 1:1 매핑
- Trigger(type=schedule)는 반드시 1개의 Schedule을 가짐

---

### 2.10 Integration

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace |
| service_type | String | 서비스 유형 (google, github, http, database, email, webhook, mcp, cafe24, makeshop). `mcp` 의 사용처·credentials 스키마는 [Spec MCP Client](./5-system/11-mcp-client.md) · [Spec 통합 §5.6](./2-navigation/4-integration.md#56-mcp-server). `cafe24` 는 [Spec 통합 §5.8](./2-navigation/4-integration.md#58-cafe24) · [Spec Cafe24 노드](./4-nodes/4-integration/4-cafe24.md). `makeshop` 는 [Spec 통합 §5.9](./2-navigation/4-integration.md#59-makeshop) · [Spec MakeShop 노드](./4-nodes/4-integration/5-makeshop.md) — cafe24 와 동일하게 같은 Integration 이 워크플로 노드와 AI Agent MCP Bridge 양쪽에서 사용된다 ([Spec MCP Client §2.3 Internal Bridge](./5-system/11-mcp-client.md#23-internal-bridge-in-process)) |
| name | String | 사용자 지정 별칭 |
| auth_type | Enum | oauth2 / api_key / bearer_token / basic / connection_string / smtp / webhook_outbound / none. `none` 은 인증이 없는 공용 MCP 서버 등에 사용 |
| credentials | JSONB (encrypted) | 인증 정보 (암호화 저장). OAuth의 경우 `scopes: string[]` 포함 |
| scope | Enum | personal / organization |
| status | Enum | connected / expired / error / pending_install |
| install_token | String? | Cafe24 Private 앱 및 MakeShop ShopStore install-first 통합의 설치 흐름 식별 키 — `pending_install` 상태에서 사용; 그 외 service_type 은 NULL. `oauth/begin (app_type=private)` (cafe24) 또는 ShopStore install-first 시작 (makeshop) 시 **16바이트를 `base64url` (no padding, 22자) 인코딩**해 발급. 통합 lifetime 동안 **보존** (post-install navigation 의 식별 키 — App URL path segment) — callback 성공 시 보존, `pending_install → expired (install_timeout)` 24h TTL 만료 또는 통합 삭제 시에만 NULL/소거. 짧은 형식은 Cafe24 App URL 100자 한도 때문 (본 문서 Rationale "install_token 형식" 참조). 정식 라이프사이클은 [Spec 통합 화면 §6 상태 전이](./2-navigation/4-integration.md#6-상태-전이) 와 [§9.2 API](./2-navigation/4-integration.md#92-인증--회전--scope) 및 Rationale "install_token TTL 24h" |
| install_token_issued_at | Timestamp? | Cafe24 Private `install_token` 발급 시각. TTL 스캐너 (`pending-install-ttl` job) 가 `now - 24h` 와 비교해 만료 판단 — 초과 시 `status='expired', status_reason='install_timeout', install_token=NULL` 로 전이. 재사용/새 발급 시 갱신, **callback 성공 시 보존** (`install_token` 과 동행 — `spec/2-navigation/4-integration.md` Rationale "install_token TTL 24h" 참조). TTL 만료 / 통합 삭제 경로에서만 NULL 처리. 옛 (V044 이전) 행은 NULL → 스캐너가 `created_at` 으로 fallback 하여 동일 24h TTL 적용 (배포 직후 일괄 expired 처리 없음 — `created_at` 이 이미 24h 이상 지난 행만 자연스럽게 expired 됨). V044 추가 |
| mall_id | String? | 외부 상점 식별자의 plain projection. Cafe24 는 `credentials.mall_id`, **MakeShop 은 `credentials.shop_uid`** 를 동일 컬럼에 복제한다 — 통일 partial UNIQUE 인덱스 `(workspace_id, service_type, mall_id) WHERE mall_id IS NOT NULL` (§3 `idx_integration_workspace_service_mall`, V072) 가 SQL 레벨 중복 통합을 거부하고, 통일 lookup `(service_type, mall_id)` 가 decrypt 없이 O(1) 조회를 제공한다. service_type 를 키에 포함하므로 **신규 통합 추가 시 인덱스/마이그레이션 0건**. cafe24·makeshop 외 service_type 에서는 항상 NULL. 옛 (V045 이전) 행은 NULL — 다음 ORM save (callback / reauth) 시 backfill. **비즈니스 규칙**: 같은 workspace 내 같은 `(service_type, mall_id)` 의 통합은 최대 1행 — cafe24 는 `app_type` 무관 (한 mall 에 public·private 동시 보유 시 토큰·webhook 처리 주체가 분기되어 사용자 혼란·회계 충돌을 유발하므로 spec 차원에서 금지). 서로 다른 service 가 같은 mall_id 값을 가져도 무관. Public App 지원 시 재검토 대상. mall_id 컬럼은 V045 추가 / 통일 인덱스는 V072 |
| status_reason | String? | 상태별 사유 코드 (모두 `snake_case`). `error` → `insufficient_scope` / `auth_failed` / `network` / `unknown` (현행) — `credentials_unreadable` 은 기존 분기로 정합성 유지. `auth_failed` 는 401/403 외에 refresh `invalid_grant` 도 포함. `network` 는 transport 3회 연속 실패 카운터 (`consecutive_network_failures` 컬럼) 가 3 도달 시 전이. `expired` → `token_expired` (refresh_token 없는 provider 의 token_expires_at 만료) / `install_timeout` (Cafe24 Private 24h TTL). `pending_install` → callback 실패 분기 코드 (`oauth_token_exchange_failed`, `oauth_state_mismatch`, `oauth_state_expired`, **`oauth_invalid_scope`** — Cafe24 가 authorize/token exchange 단계에서 `invalid_scope` 응답을 돌려준 케이스. status 보존 + `last_error.details.requiresCafe24Approval` 동행 — 자세한 진입 경로·UI 분기는 [Spec 통합 화면 §10.4](./2-navigation/4-integration.md#104-에러-매핑) `Cafe24 invalid_scope` 행 + [`spec/conventions/cafe24-restricted-scopes.md §4.3`](./conventions/cafe24-restricted-scopes.md#43-에러-안내-에러-발생-후) 참고). `resource_not_found` 는 row 가 사라진 케이스라 DB 갱신 불가 → 후보값 제외 ([Spec 통합 화면 §10.4](./2-navigation/4-integration.md#104-에러-매핑)). `connected` → NULL. ※ DB 저장값은 `snake_case`, 동일 의미의 API 에러 코드는 `OAUTH_*` `UPPER_SNAKE_CASE` (의도적 분리) |
| consecutive_network_failures | int | 노드 실행 / 토큰 갱신 중 transport 실패 카운터. 성공 시 0 으로 리셋, 3 도달 시 `status='error', status_reason='network'` 로 전이 + 카운터 0 리셋. spec §6 `connected → error(network)` 전이의 구현 기반. V049 추가. NOT NULL DEFAULT 0 — 기존 행은 0 으로 backfill |
| token_expires_at | Timestamp? | 토큰 만료 시각 (OAuth) |
| last_used_at | Timestamp? | 마지막 노드 실행에서 사용된 시각 (캐시) |
| last_rotated_at | Timestamp? | 자격 증명 마지막 회전 시각 (OAuth 재인증 또는 비OAuth 교체) |
| last_error | JSONB? | 최근 호출 실패의 요약 `{ code, message, at, details? }`. `details` 는 자유 형식 `Record<string, unknown>` 으로 사유 별 추가 컨텍스트를 담는다 (예: `oauth_invalid_scope` 에서 `details.requiresCafe24Approval: string[]` — 요청 scopes ∩ [`cafe24-restricted-scopes.md §1`](./conventions/cafe24-restricted-scopes.md#1-scope-단위-별도-승인-resource-전체-영향) 의 교집합. 다른 status_reason 에서는 미사용 또는 별개 키 집합 — 새 사유 도입 시 본 spec 행에 키 정의를 inline 추가). API 응답의 `details` 키 집합과 형식적으로 같은 shape 이지만 DB 와 API 의 노출 정책은 각 spec 본문 (§10.4 등) 이 별도 통제 — 본 컬럼은 저장 책임만 진다. |
| created_by | UUID | FK → User |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

**제약조건**: `UNIQUE(workspace_id, name)` — 워크스페이스 내 별칭 유일성

**응답 DTO 전용 derived 필드**: `autoRefresh: boolean` 은 위 표의 DB 컬럼 목록과 별개로 API 응답(`IntegrationDto`) 에만 노출되는 derived 필드다 — `ServiceDefinition.supportsTokenAutoRefresh` (backend service registry — 현재 `cafe24` / `google` / `makeshop` 가 true (makeshop = auth-code+refresh)) 에서 매 응답 시점에 계산되며 DB 컬럼이 아니다. (`appUrl`·`autoRefresh` 등 service 별 derived 필드를 cafe24 하드코딩에서 service registry 기반 per-service 파생으로 일반화하는 작업은 makeshop 도입과 함께 진행 — [cafe24 백로그 C-6](../plan/in-progress/cafe24-backlog-residual.md), [통합 §9.2 IntegrationDto](./2-navigation/4-integration.md#9-api).) UI 의 attention/expiring 술어가 짧은-수명 토큰의 거짓 양성을 피하기 위해 사용하는 분기 신호. 정의·전체 동작은 [Spec 통합 화면 §9.1 API](./2-navigation/4-integration.md#9-api) 와 같은 문서의 Rationale "자동 갱신 통합을 attention 술어에서 제외" 참조.

### 2.10.1 IntegrationUsageLog

> 관련 문서: [Spec 통합 화면 §Recent activity](./2-navigation/4-integration.md) · [PRD 통합/연동 INT-US-05](./4-nodes/4-integration/_product-overview.md#24-사용처-추적-및-라이프사이클)

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| integration_id | UUID | FK → Integration (CASCADE) |
| node_execution_id | UUID | FK → NodeExecution |
| workflow_id | UUID | FK → Workflow (비정규화, 조회 최적화) |
| status | Enum | success / failed |
| error | JSONB? | 실패 시 에러 요약 `{ code, message }` |
| duration_ms | Integer | 호출 소요 시간 |
| at | Timestamp | 호출 시각 |
| api_label | varchar(128)? | 호출된 API 의 catalog key. cafe24 = `cafe24.<resource>.<operation>` ([cafe24-api-metadata §7.5](./conventions/cafe24-api-metadata.md#75-catalog-key-형식--활동-로그-api_label)); makeshop = `makeshop.<resource>.<operation>` ([makeshop-api-metadata](./conventions/makeshop-api-metadata.md)). http-request / database-query / send-email = NULL. 길이 초과 시 끝에 `…` truncate |
| api_method | varchar(8)? | HTTP method / SQL 동사 / `SEND` — 통합별 의미는 [`spec/4-nodes/4-integration/_product-overview.md` INT-US-05](./4-nodes/4-integration/_product-overview.md#24-사용처-추적-및-라이프사이클) 표 참조. NULL 허용 |
| api_path | varchar(256)? | endpoint path / driver token / SMTP host — 통합별 의미 다름 (INT-US-05 표). 길이 초과 시 끝에 `…` truncate. http-request 는 query string 제거, database-query 는 SQL 본문 미저장, send-email 은 수신자 미저장 (PII 보호) |

**보존 기간**: 90일. 일일 배치로 기한 초과 레코드 정리.

**인덱스**: `(integration_id, at DESC)` — 상세 페이지 최근 활동 조회용. `api_*` 컬럼은 현재 인덱스 없음 — 추후 method/path 별 필터 (예: "5xx 응답만" / "특정 endpoint 만") 가 필요해질 때 추가.

### 2.11 KnowledgeBase

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace |
| name | String | 컬렉션 이름 |
| description | String? | 설명 |
| embedding_model | String | 임베딩 모델 식별자 (default: text-embedding-3-small) |
| embedding_dimension | Integer? | 저장된 청크들의 벡터 차원. 첫 임베딩 후 자동으로 채워지고, KB 재임베딩 시 NULL 로 reset |
| chunk_size | Integer | 청크 크기 (기본: 1000) |
| chunk_overlap | Integer | 청크 오버랩 (기본: 200) |
| document_count | Integer | 문서 수 (캐시) |
| reembed_status | Enum | KB 전체 재임베딩 잠금 상태: `idle` / `in_progress` (default: idle). 진입 시 atomic compare-and-swap |
| rag_mode | Enum | 검색 모드: `vector` (default) / `graph`. **생성 시에만 결정, 사후 변경 불가** ([Spec Graph RAG](./5-system/10-graph-rag.md)) |
| extraction_llm_config_id | UUID? | `rag_mode = 'graph'` 일 때 그래프 추출에 사용할 LLMConfig (chat 모델). NULL 이면 워크스페이스 default LLMConfig |
| max_hops | Integer | graph 검색 시 그래프 확장 깊이 (1 또는 2, default 1). `vector` 모드에서는 무시 |
| vector_seed_top_k | Integer | graph 검색 시 vector seed 개수 (default 5). `vector` 모드에서는 무시 |
| expanded_chunk_limit | Integer | graph expansion 후 회수할 청크 상한 (default 15). `vector` 모드에서는 무시 |
| entity_count | Integer | KB 의 entity 총 수 (캐시). `vector` 모드는 항상 0 |
| relation_count | Integer | KB 의 relation 총 수 (캐시). `vector` 모드는 항상 0 |
| reextract_status | Enum | KB 전체 그래프 재추출 잠금: `idle` / `in_progress` (default: idle). `vector` 모드에서는 사용 안 함 |
| rerank_mode | Enum | 검색 후처리(리랭킹) 모드: `off` (default) / `cross_encoder` / `cross_encoder_llm` `(V082)`. **검색 시점 적용 — 사후 변경 가능, 재임베딩 불요** ([Spec RAG 검색 §3.3](./5-system/9-rag-search.md#33-검색-후처리--리랭킹-선택적)). `off` 면 아래 rerank_* 컬럼 무시. 두 모드 모두 구현됨 |
| rerank_config_id | UUID? | FK → RerankConfig. cross-encoder 리랭커 설정. NULL 이면 워크스페이스 default RerankConfig, 그것도 없으면 `off` 강등 |
| rerank_candidate_k | Integer | 리랭크에 투입할 1차 회수 후보 수 (default 50, 허용 범위 1~200). `rerank_mode = 'off'` 시 무시 |
| rerank_score_threshold | Float? | 리랭크 점수 동적 컷 임계 (NULL 이면 컷 없이 점수순 정렬 후 top-k). `rerank_mode = 'off'` 시 무시 |
| rerank_llm_config_id | UUID? | FK → LLMConfig. `rerank_mode = 'cross_encoder_llm'` 의 listwise grading LLM. NULL 이면 워크스페이스 default chat LLMConfig |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

### 2.12 Document

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| knowledge_base_id | UUID | FK → KnowledgeBase |
| name | String | 문서 이름 |
| file_type | Enum | txt / md / pdf / csv |
| file_url | String | 원본 파일 저장 경로 |
| file_size | Integer | 파일 크기 (bytes) |
| embedding_status | Enum | `pending` / `processing` / `completed` / `error` / `failed`. `error` = in-flight 재시도 중 일시 오류, `failed` = 최대 재시도 소진 또는 비재시도성 오류로 인한 최종 실패 |
| embedding_retry_count | Integer | 임베딩 재시도 누적 횟수. 성공 시 0 으로 리셋 |
| embedding_last_attempted_at | Timestamp? | 마지막 임베딩 시도 시각. stuck 회수 임계 비교에 사용 |
| embedding_error_message | Text? | 마지막 임베딩 오류 메시지 (sanitize 거친 사용자 노출용). 성공 시 NULL |
| graph_extraction_status | Enum? | `pending` / `processing` / `completed` / `error` / `failed`. `vector` 모드 문서는 NULL. 의미는 `embedding_status` 와 동일 |
| graph_retry_count | Integer | 그래프 추출 재시도 누적 횟수. 성공 시 0 |
| graph_last_attempted_at | Timestamp? | 마지막 그래프 추출 시도 시각 |
| graph_error_message | Text? | 마지막 그래프 추출 오류 메시지 |
| chunk_count | Integer | 생성된 청크 수 |
| tags | String[] | 태그 |
| metadata | JSONB | 메타데이터 |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

### 2.12.1 DocumentChunk

> 관련 문서: [Spec 임베딩 파이프라인](./5-system/8-embedding-pipeline.md)

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| document_id | UUID | FK → Document (CASCADE) |
| chunk_index | Integer | 청크 순서 (0-based) |
| content | Text | 청크 텍스트 원본 |
| embedding | Vector | 벡터 임베딩 (pgvector) |
| token_count | Integer | 청크의 토큰 수 |
| metadata | JSONB | `{ page?: number, section?: string }` |

**제약조건**: `UNIQUE(document_id, chunk_index)`

**인덱스**: 차원별 partial HNSW (V022 `vector` + V023 `halfvec` + V030–V032 후속 정비) — 유사도 검색 성능. 마이그레이션 상세는 [`spec/data-flow/6-knowledge-base.md §2.3`](./data-flow/6-knowledge-base.md) 및 `codebase/backend/migrations/V022_*.sql`, `V023_*.sql`, `V030_*.sql`–`V032_*.sql` 참조.

### 2.12.2 Entity

> 관련 문서: [Spec Graph RAG](./5-system/10-graph-rag.md). `rag_mode = 'graph'` 인 KB 에서만 사용된다.

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| knowledge_base_id | UUID | FK → KnowledgeBase (CASCADE) |
| name | String | 정규화된 entity 이름 (소문자·trim) |
| display_name | String | 사용자 표시용 원형 |
| type | Enum | `person` / `organization` / `concept` / `location` / `event` / `other` |
| description | Text? | LLM 추출 짧은 설명 |
| mention_count | Integer | KB 내 청크에서 언급된 횟수 (캐시) |
| last_seen_chunk_id | UUID? | 마지막 등장 청크 (FK → DocumentChunk) |
| created_at | Timestamp | 첫 추출 시각 |
| updated_at | Timestamp | 마지막 갱신 시각 |

**제약조건**: `UNIQUE(knowledge_base_id, name, type)`

**인덱스**: `(knowledge_base_id, type)`, `(knowledge_base_id, mention_count DESC)`

### 2.12.3 Relation

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| knowledge_base_id | UUID | FK → KnowledgeBase (CASCADE) |
| head_entity_id | UUID | FK → Entity |
| tail_entity_id | UUID | FK → Entity |
| predicate | String | 관계 서술어 (예: `founded`, `employs`). P0 free-form, snake_case 권장 |
| evidence_chunk_id | UUID? | 추출 근거 청크 (FK → DocumentChunk) |
| weight | Integer | 동일 (head, predicate, tail) 가 여러 chunk 에서 발견된 누적 횟수 |
| created_at | Timestamp | 첫 추출 시각 |
| updated_at | Timestamp | 마지막 갱신 시각 |

**제약조건**: `UNIQUE(knowledge_base_id, head_entity_id, predicate, tail_entity_id)`

**인덱스**: `(knowledge_base_id, head_entity_id)`, `(knowledge_base_id, tail_entity_id)`

### 2.12.4 ChunkEntity

| 필드 | 타입 | 설명 |
|------|------|------|
| chunk_id | UUID | FK → DocumentChunk (CASCADE) |
| entity_id | UUID | FK → Entity (CASCADE) |
| mention_text | String? | 청크에서 등장한 원형 표기 (정규화 전) |

**제약조건**: `PRIMARY KEY (chunk_id, entity_id)`

**인덱스**: `(entity_id)` — entity → chunk 역방향 회수 (검색 expansion 단계)

### 2.13 Execution

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workflow_id | UUID | FK → Workflow |
| trigger_id | UUID? | FK → Trigger (트리거에 의한 실행 시) |
| status | Enum | pending / running / completed / failed / cancelled / waiting_for_input |
| started_at | Timestamp | 실행 시작 시각 |
| finished_at | Timestamp? | 실행 종료 시각 |
| duration_ms | Integer? | 실행 소요 시간 (wall-clock, start→finish) |
| active_running_ms | Integer | 누적 active-running 시간(ms). active 세그먼트(worker 가 노드를 전진시킨 구간)의 합 — `waiting_for_input` park 시간 제외. 기본 0. §8 active-running 타임아웃(`EXECUTION_TIME_LIMIT_EXCEEDED`)의 측정 기준 ([4-execution-engine §8](./5-system/4-execution-engine.md#8-동시-실행-제한)) |
| input_data | JSONB? | 실행 입력 데이터 |
| output_data | JSONB? | 실행 최종 출력 데이터 |
| error | JSONB? | 에러 정보. 최초 failed NodeExecution의 에러를 참조/복사 (아래 참조). `error.code` 어휘는 각 노드 핸들러가 정의([Spec node-output Principle 3.2](./conventions/node-output.md#32-outputerror-표준-형태)) 외에 엔진 인프라 차원의 코드를 포함한다 — `SERVER_INTERRUPTED` (graceful shutdown 미완료 노드, [§11](./5-system/4-execution-engine.md#11-graceful-shutdown)), `WORKER_HEARTBEAT_TIMEOUT` (active 세그먼트 job 이 BullMQ stalled 재배달 attempts 소진 — terminal worker failure, [§7.1](./5-system/4-execution-engine.md#71-워커-크래시-복구--bullmq-stalled-job-target); 현 구현은 부팅 시 절대 30분 stale 일괄 fail, stalled-job 으로 대체 예정), `EXECUTION_TIME_LIMIT_EXCEEDED` (엔진 레벨 누적 active-running 시간 초과 — `waiting_for_input` 대기 제외, [§8](./5-system/4-execution-engine.md#8-동시-실행-제한)), `RESUME_FAILED` / `RESUME_CHECKPOINT_MISSING` / `RESUME_INCOMPATIBLE_STATE` (continuation rehydration 실패, [§7.5](./5-system/4-execution-engine.md#75-resume-after-restart-rehydration)) |
| executed_by | UUID? | FK → User (수동 실행 시) |
| parent_execution_id | UUID? | FK → Execution (서브 워크플로우 실행 시 부모 실행) |
| recursion_depth | Integer | 서브 워크플로우 호출 깊이 (root = 0) |
| re_run_of | UUID? | `REFERENCES executions(id) ON DELETE SET NULL`. Re-run 의 직계 부모 Execution. NULL 이면 본 실행이 chain 의 시작(원본). 정책·상세는 [Spec Re-run §9.1](./5-system/13-replay-rerun.md#91-executions-테이블-컬럼-추가) |
| chain_id | UUID? | **NULLABLE** (V067). 같은 Re-run chain 의 모든 실행을 묶는 식별자. 일반 실행(원본·sub-workflow·background)은 `chain_id = NULL`, re-run 으로 생성된 실행만 `chain_id = <chain root id>` (= 원본 실행 id) 로 설정된다. chain 전체 조회는 `id = rootId OR chain_id = rootId`. `re_run_of` 도 NULLABLE — re-run 행만 직계 부모 id 보유. chain 깊이 32 제한은 애플리케이션 레벨에서 enforce. v1 이 spec §9.1 의 NOT NULL/자기참조 모델에서 의도적으로 벗어난 근거는 [Spec Re-run §9.1](./5-system/13-replay-rerun.md#91-executions-테이블-컬럼-추가) 및 `migrations/V067__execution_re_run_chain.sql` 헤더 참조 |
| dry_run | Boolean | `NOT NULL DEFAULT false` (V068). dry-run re-run(RR-PL-01)으로 생성된 실행만 true. 엔진이 `createContext` 시점에 `variables.__dryRun` 으로 주입해 외부 부수효과 노드가 mock 출력을 반환하게 하며, rehydration 에서도 복원된다. 상세는 [Spec Re-run §7.2 / §9.2](./5-system/13-replay-rerun.md#92-dry-run-표기--nodeexecution-_dryrun--execution-dry_run-컬럼) |
| conversation_thread | JSONB? | `NULL` 허용 (V084). `waiting_for_input` park 진입 시 `ExecutionContext.conversationThread` 전체 스냅샷을 commit 하는 **durable resume 매체** — rehydration([§7.5](./5-system/4-execution-engine.md#75-resume-after-restart-rehydration))이 여기서 thread 를 무손실 복원(`runningSummary`/`summarizedUpToSeq` 포함). park 외 단계에서는 stale 가능(last-park-write). 실행 이력 timeline 의 분산 SoT(`NodeExecution.output_data`/`interaction_data`)와 목적·소비처가 분리된다. 정책·Rationale: [ConversationThread §4·§8.4](./conventions/conversation-thread.md#4-영속화) |
| user_variables | JSONB? | `NULL` 허용 (V085). `waiting_for_input` park 진입 시 `ExecutionContext.variables` 중 **시스템 `__*` 제외 사용자 정의분**(Variable Declaration/Modification 노드 값)을 commit 하는 durable resume 매체 — rehydration([§7.5](./5-system/4-execution-engine.md#75-resume-after-restart-rehydration))이 복원해 park 이전 변수를 park 이후 노드가 무손실 참조(`$var.X`). 시스템 `__*` 변수는 rehydration 이 별도 재주입하므로 미포함. park 외 단계 stale 가능(last-park-write). 상세: [실행 엔진 §6.1/§6.2/§7.5](./5-system/4-execution-engine.md#61-컨텍스트-구조) |

> 실행된 노드의 순서(옛 `execution_path UUID[]` 컬럼)는 별도 append-only 테이블 **ExecutionNodeLog** (§2.13.1) 가 보관한다. 다중 인스턴스에서 동시 INSERT 시 절대 순서를 보장하지 못하던 array 컬럼 모델은 V036 에서 DROP 되었고, V035 에서 도입된 `execution_node_log` 가 대체한다.

> **`dryRun` 응답 필드의 출처**는 위 `dry_run` DB 컬럼(V068)이다. 응답 DTO(`ExecutionDto.dryRun`)는 이 컬럼을 그대로 노출한다 — NodeExecution 집계가 아니다. (집계 방식은 부수효과 노드가 없는 dry-run 워크플로를 false 로 잘못 도출하므로 채택하지 않았다.) NodeExecution 수준의 `output_data._dryRun` 은 노드별 결과 표시용으로 별개다 ([Spec Re-run §9.2](./5-system/13-replay-rerun.md#92-dry-run-표기--nodeexecution-_dryrun--execution-dry_run-컬럼)).

### 2.13.1 ExecutionNodeLog

`(execution_id, id)` 정렬이 곧 노드 실행 순서. BIGSERIAL `id` 는 PostgreSQL sequence 가 부여하므로 다중 backend 인스턴스에서도 concurrency-safe 하다.

| 필드 | 타입 | 설명 |
|------|------|------|
| id | BIGSERIAL | PK. sequence 부여 순서가 곧 실행 순서 |
| execution_id | UUID | FK → Execution (ON DELETE CASCADE) |
| node_id | UUID | 실행된 노드 ID |
| created_at | TimestampTZ | append 시각 (기본 `NOW()`) |

**인덱스**: `(execution_id, id)` — 단일 execution 의 노드 순서 조회 (`findById` 가 `executionPath: string[]` 응답을 본 테이블의 정렬 쿼리로 채움).

### 2.14 NodeExecution

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| execution_id | UUID | FK → Execution |
| node_id | UUID | FK → Node |
| status | Enum | pending / running / completed / failed / cancelled / skipped / waiting_for_input. `cancelled` = 외부 `abortSignal` 로 노드 외부 I/O 가 중단되어 핸들러가 throw 한 `AbortError` 를 엔진이 분류한 상태 ([node-cancellation §5](./conventions/node-cancellation.md#5-aborterror-분류) / [실행 엔진 §1.2](./5-system/4-execution-engine.md#12-nodeexecution-상태)) |
| started_at | Timestamp | 실행 시작 시각 |
| finished_at | Timestamp? | 실행 종료 시각 |
| duration_ms | Integer? | 소요 시간 |
| input_data | JSONB | 노드 입력 데이터 |
| output_data | JSONB? | 노드 출력 데이터 |
| error | JSONB? | 에러 정보 `{ code, message, stack? }` |
| retry_count | Integer | 재시도 횟수 |
| interaction_data | JSONB? | 사용자 인터랙션 기록 — Form 제출 또는 버튼 클릭 정보. `{ interactionType: "form_submitted" \| "button_click" \| "button_continue", buttonId?, buttonLabel?, clickedAt, clickedBy }`. 여기의 `interactionType` 은 **수행된 user action 의 기록** enum 으로, 노드 대기 상태를 분류하는 `WaitingInteractionType` (`form`/`buttons`/`ai_conversation`/`ai_form_render`, [interaction-type-registry](./conventions/interaction-type-registry.md)) 과 **이름만 같고 별개 enum** 이다. 본 필드 + `output_data.messages` (AI 노드) 가 [ConversationThread](./conventions/conversation-thread.md) 의 분산 SoT — 실행 후 timeline UI 가 reconstruct |

**Execution.error ↔ NodeExecution.error 관계:**

| 항목 | 설명 |
|------|------|
| 원본 | NodeExecution.error — 개별 노드 실행 실패 시 기록 |
| 복사 | Execution.error — 워크플로우 실행이 `failed` 상태로 전이될 때, **최초 failed NodeExecution**의 에러 정보를 복사 |
| 구조 | `{ nodeId: "uuid", code: "ERROR_CODE", message: "에러 설명" }` |
| 용도 | 실행 목록에서 Execution 단위로 에러 원인을 즉시 파악 가능 (NodeExecution 조회 없이) |

### 2.15 WorkflowVersion

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workflow_id | UUID | FK → Workflow |
| version | Integer | 버전 번호 |
| snapshot | JSONB | 워크플로우 전체 스냅샷 (nodes, edges, settings) |
| change_summary | String? | 변경 사항 요약 |
| created_by | UUID | FK → User |
| created_at | Timestamp | 생성 시각 |

### 2.16 LLMConfig

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace |
| provider | String | 프로바이더 (openai, anthropic, local 등) |
| name | String | 사용자 지정 이름 |
| api_key | String (encrypted) | API Key (암호화 저장) |
| base_url | String? | 커스텀 엔드포인트 URL (로컬 모델용) |
| default_model | String | 기본 모델 ID |
| default_params | JSONB | 기본 파라미터 (temperature, max_tokens 등) |
| is_default | Boolean | 기본 프로바이더 여부 |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

### 2.16.1 RerankConfig

cross-encoder 리랭커 provider 설정 `(V081)`. chat/embedding 과 API shape(전용 `/rerank` 엔드포인트)가 달라 §2.16 LLMConfig 와 분리한 sibling 리소스 ([Spec LLM Client §3.6](./5-system/7-llm-client.md), [Spec RAG 검색 §3.3](./5-system/9-rag-search.md#33-검색-후처리--리랭킹-선택적)). 셀프호스팅(`tei`) 또는 외부 API(`cohere`) 를 지원하며, SSRF 가드·secret-store transformer 는 LLMConfig 와 동일 인프라를 재사용한다.

> **구현 상태**: 엔티티 + `cross_encoder` · `cross_encoder_llm` 두 모드가 모두 구현됨 (provider 1차 `tei`/`cohere`). 마이그레이션 — RerankConfig 테이블 `(V081)`, KnowledgeBase rerank_* 컬럼 (§2.11) `(V082)`.

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace |
| provider | String | **1차 구현: `tei`** (HF Text-Embeddings-Inference, 자가호스팅 `bge-reranker-v2-m3-ko` 등) · **`cohere`** (외부 API). **Planned(후속): `jina` / `voyage` / `local`(OpenAI-compatible `/rerank`) / `builtin`(Transformers.js 인프로세스)** — 모두 동일 `/rerank` HTTP 래퍼라 추가 비용 낮음 |
| name | String | 사용자 지정 이름 |
| api_key | String? (encrypted) | API Key (외부 provider 용, 암호화 저장). `tei`/`local` 은 선택 |
| base_url | String? | 자가호스팅 endpoint. `tei`/`local` 은 필수 (SSRF 가드 — `local`/`tei` 사설망 예외, [LLM Client §5.5](./5-system/7-llm-client.md)) |
| default_model | String | 기본 리랭커 모델 ID (예: `rerank-3.5` / `jina-reranker-v2-base-multilingual` / `bge-reranker-v2-m3` / `dragonkue/bge-reranker-v2-m3-ko`) |
| is_default | Boolean | 워크스페이스 기본 리랭커 여부 |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

### 2.17 AuthConfig

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace |
| name | String | 인증 설정 이름 |
| type | Enum | api_key / bearer_token / basic_auth / hmac |
| config | JSONB (encrypted) | 인증 설정 상세 (AES-256-GCM 암호화). type 별 스키마는 §2.17.1, 응답 마스킹은 §2.17.2 |
| ip_whitelist | String[]? | 허용 IP 목록 — 각 항목은 단일 IP 또는 CIDR 표기 (예: `10.0.0.0/8`, `2001:db8::/32`; 단일 IP 는 /32·/128 호스트로 취급). webhook 수신 시 `auth_config_id` 가 연결된 트리거에 한해 시행 ([Spec Webhook §3.2 WH-SC-09](./5-system/12-webhook.md#32-인증-및-보안)) |
| is_active | Boolean | 활성 상태. `false` 면 연결된 webhook 호출은 401 `AUTH_FAILED` |
| last_used_at | Timestamp? | 마지막 사용 시각. webhook 인증 성공 시 fire-and-forget UPDATE ([Spec Webhook §3.2 WH-SC-08](./5-system/12-webhook.md#32-인증-및-보안)) |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

#### 2.17.1 config 의 JSONB 스키마

`config` 는 `type` 에 따라 다른 형태를 가진다. 자동 발급되는 비밀 값은 제품이 생성하며 prefix 로 출처를 식별한다.

| type | config 스키마 | 자동 발급 |
|------|--------------|-----------|
| `api_key` | `{ key: string, headerName?: string = "X-API-Key" }` | `key` = `wfk_<hex24>` |
| `bearer_token` | `{ token: string }` | `token` = `wft_<hex32>` |
| `basic_auth` | `{ username: string, password: string }` | — (사용자 입력) |
| `hmac` | `{ secret: string, header: string = "X-Hub-Signature-256", algorithm: "sha256" \| "sha512" }` | `secret` = `whs_<hex32>` |

**비밀 값 prefix 규칙**: `wfk_` (api key) · `wft_` (bearer token) · `whs_` (hmac secret). prefix 로 로그·디버깅 시 자격증명 종류를 식별하되 평문 자체는 마스킹 (§2.17.2).

> AuthConfig 외 다른 도메인의 비밀·토큰 prefix 는 각 영역 spec 이 단일진실로 보유한다 — 외부 상호작용 API 의 `wsk_` (notification HMAC secret) · `iext_` (per-execution interaction JWT) · `itk_` (per-trigger interaction token) 은 [Spec EIA §인증](./5-system/14-external-interaction-api.md) 참조.

#### 2.17.2 마스킹·노출 정책

- API 응답에서 `config.key` / `config.token` / `config.secret` / `config.password` 는 항상 `***<last4>` 형태로 마스킹한다 (last4 부족 시 `***`).
- `config.username` / `config.header` / `config.headerName` / `config.algorithm` 은 평문 노출 (식별·검증 보조 메타이며 비밀이 아님).
- 평문 노출은 다음 3 경로만 허용한다:
  - `POST /api/auth-configs` (create) — 자동 발급된 값 1회 응답.
  - `POST /api/auth-configs/:id/regenerate` — 신규 값 1회 응답.
  - `POST /api/auth-configs/:id/reveal` — 현재 로그인 비밀번호 재확인 후 평문 1회 응답 (Admin+ 권한, `audit_log` 에 `auth_config.reveal` 기록 — [Spec 인증 §3.2](./5-system/1-auth.md#3-인가-authorization) · [§4.1](./5-system/1-auth.md#4-감사-로그-audit-log)).
- **본 §2.17.2 가 AuthConfig 마스킹 정책의 단일 진실** — 다른 문서(`spec/2-navigation/6-config.md`, `spec/conventions/secret-store.md`)는 본 절을 참조만 한다.

#### 2.17.3 Rationale (AuthConfig 도메인)

- **`hmac` type**: Webhook HMAC 서명 검증을 trigger inline `config.secret` 대신 AuthConfig 로 흡수 — 발행·회전(regenerate)·통계·RBAC·마스킹을 다른 인증 type 과 동일 라이프사이클로 일원화. 근거 상세는 [Spec Webhook Rationale R-A](./5-system/12-webhook.md#rationale).
- **`none` 미포함 (의도)**: AuthConfig.type 에는 `none` 이 없다. "인증 없음" 은 `Trigger.authConfigId IS NULL` 로 표현되며, AuthConfig row 자체가 `type='none'` 인 의미는 없다. 이는 §2.10 `Integration.auth_type='none'` (Integration 이 존재하되 자격증명 불요인 공용 MCP 서버 등) 과는 다른 개념 — AuthConfig 는 "row 부재 = 인증 없음", Integration 은 "row 존재 + auth_type=none". 두 도메인이 같은 단어를 다른 의미로 쓰지 않도록 AuthConfig 에서는 none 을 두지 않는다.
- **bearer_token 자동 발급 강제**: 기존 6-config 의 "자동 생성 또는 사용자 입력" 중 사용자 입력 옵션을 제거하고 자동 발급(`wft_<hex32>`)만 허용. 외부 호출자에게 발급하는 토큰은 제품이 충분한 엔트로피로 생성하는 게 일관적이며, 사용자 입력 토큰의 형식·엔트로피 검증 부담을 없앤다.
- **TypeScript 타입명 분리 (consistency W-10/W-11)**: `AuthConfig.type` (`api_key`/`bearer_token`/`basic_auth`/`hmac`) 과 §2.10 `Integration.auth_type` (`oauth2`/`api_key`/`bearer_token`/`basic`/...) 은 일부 문자열이 겹치지만 (`api_key`/`bearer_token`) 별개 도메인이다. 코드에서는 `AuthConfigType` 과 `IntegrationAuthType` 유니온을 분리 정의해 혼용 오염을 막는다. 특히 Basic 인증은 AuthConfig 가 `basic_auth` (인바운드 webhook용), Integration 이 `basic` (외부 서비스 연동용) 으로 **의도적으로 다른 표기** — 두 도메인의 자원 성격이 다름.
- **transformer 공유 (consistency I-6)**: `AuthConfig.config` 는 §2.10 `Integration.credentials` 와 동일한 `ENCRYPTION_KEY`·AES-256-GCM transformer 를 공유한다. `spec/conventions/secret-store.md` 의 `secret://` URI scheme 은 trigger ref 슬롯 전용이며 AuthConfig 는 자체 테이블 컬럼 transformer 라 본 scheme 을 사용하지 않는다.

### 2.18 AuditLog

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace |
| user_id | UUID | FK → User |
| action | String | 수행 액션 (workflow.create, trigger.update 등) |
| resource_type | String | 대상 리소스 유형 |
| resource_id | UUID | 대상 리소스 ID |
| details | JSONB | 변경 상세 |
| ip_address | String | 요청 IP |
| created_at | Timestamp | 발생 시각 |

> AuditLog는 워크스페이스 단위 리소스 변경을 기록한다. 워크스페이스 컨텍스트가 없는 인증 이벤트(로그인 성공/실패, 세션 강제 종료 등)는 별도의 **LoginHistory** 테이블에 보관한다.

### 2.18.1 RefreshToken

세션 단위는 `family_id` 다. refresh 회전 시 row가 새로 발급되지만 동일 family는 하나의 "디바이스 세션"으로 간주한다. 사용자에게 노출되는 "활성 세션" 은 `is_revoked = false` 인 같은 family의 가장 최신 row 메타데이터를 보여준다.

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| user_id | UUID | FK → User (cascade) |
| token_hash | String | SHA-256(refresh_token), UNIQUE |
| family_id | UUID | 세션 식별자 (회전 시에도 유지) |
| is_revoked | Boolean | 강제/자연 만료 여부 |
| expires_at | Timestamp | 만료 시각 (7일 기본, rememberMe 시 30일) |
| device_label | String? | UA에서 파생된 표시 라벨 ("Chrome on macOS") |
| user_agent | String? | 발급 시점 raw UA |
| ip_address | String? | 발급 시점 클라이언트 IP (CF-Connecting-IP 우선) |
| last_used_at | Timestamp? | refresh 호출마다 갱신 |
| last_used_ip | String? | 마지막 활동 IP |
| created_at | Timestamp | 발급 시각 |

### 2.18.2 LoginHistory

인증 이벤트(로그인 성공·실패, TOTP 실패, WebAuthn 실패, 로그아웃, 세션 강제 종료, refresh token 재사용 감지)를 사용자 단위로 시간순 기록한다. 사용자가 직접 본인 이력을 조회한다.

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| user_id | UUID? | FK → User (cascade). 실패한 로그인에서 매칭 사용자가 없는 경우 NULL 가능 |
| email | String | 시도된 이메일 (enumeration 추적용) |
| event | Enum | login_success / login_failed / totp_failed / **webauthn_failed** / logout / session_revoked / token_reuse_detected |
| ip_address | String? | 클라이언트 IP |
| user_agent | String? | raw UA |
| device_label | String? | UA에서 파생된 표시 라벨 |
| family_id | UUID? | 관련 세션의 family_id (해당 시) |
| failure_reason | String? | INVALID_PASSWORD / ACCOUNT_LOCKED / TOTP_INVALID / WEBAUTHN_INVALID / WEBAUTHN_COUNTER_REGRESSION 등 |
| created_at | Timestamp | 발생 시각 |

보존 정책: 180일 경과 row는 일일 배치로 자동 삭제.

CHECK 제약명은 `chk_login_history_event` 다 (V040 도입). WebAuthn 추가는 V058 에서 DROP CONSTRAINT + ADD CONSTRAINT 패턴으로 갱신한다.

### 2.19 Notification

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace |
| user_id | UUID | FK → User (수신자) |
| type | Enum | execution_failed / background_failed / schedule_failed / integration_expired / **integration_action_required** / marketplace_update / team_invite. **분리 원칙**: `integration_expired` 는 **수동성** — `token_expires_at` 만료 임계 (`status_reason='token_expired'`) 임박/도래를 알리는 passive notice. 사용자가 통합을 다시 쓰려 할 때만 행동 필요. `integration_action_required` 는 **능동성** — `error(auth_failed)` / `error(network)` / `error(insufficient_scope)` 같은 운영 중 발생한 장애로, 사용자가 즉시 손봐야 서비스가 복구되는 active alert. `install_timeout` (사용자가 외부 install 흐름 진행 중인 명시적 상태) 은 여전히 알림 미발사 (UI 배지만) — 사용자가 외부 흐름을 알고 있는 상태이므로 push 불필요. 자세한 임계·메시지는 [Spec 통합 §11.2](./2-navigation/4-integration.md#112-알림-생성) 참고. |
| title | String | 알림 제목 |
| message | String | 알림 내용 |
| resource_type | String? | 관련 리소스 유형 (workflow, integration 등) |
| resource_id | UUID? | 관련 리소스 ID |
| is_read | Boolean | 읽음 여부 (기본: false) |
| channel | Enum | in_app / email / both |
| email_sent_at | Timestamp? | 이메일 발송 시각 |
| dismissed_at | Timestamp? | 사용자가 닫은 시각 (NULL=visible, 채워짐=dismissed). 목록·미읽음 카운트에서 제외 — 자세한 dismiss 흐름·근거는 [data-flow/8-notifications.md §4](./data-flow/8-notifications.md#4-dismiss-흐름-사용자-액션) 참조 |
| created_at | Timestamp | 생성 시각 |

### 2.20 AssistantSession

Workflow AI Assistant의 채팅 세션. 단일 워크플로우 단위로 존재하며, 페이지 새로고침/재접속 시에도 이어서 대화할 수 있다. 상세: [Spec 3-workflow-editor/4: AI Assistant](./3-workflow-editor/4-ai-assistant.md).

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace (cascade 삭제) |
| workflow_id | UUID | FK → Workflow (cascade 삭제) — 세션은 단일 워크플로우에 종속 |
| user_id | UUID | FK → User — 세션 생성자 |
| title | String? | 세션 제목 (첫 메시지 요약 또는 사용자 편집) |
| llm_config_id | UUID? | FK → LLMConfig — 지정 없으면 workspace default 사용 |
| status | Enum | active / archived — archived는 UI 상에서 숨김 |
| message_count | Int | 메시지 수 캐시 (비정규화) |
| last_interaction_at | Timestamp | 마지막 메시지/도구 호출 시각 |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

### 2.21 WebAuthnCredential

사용자가 등록한 WebAuthn (Passkey · 보안 키 등) 인증기. 사용자당 다중 등록을 허용한다. 모든 등록·인증·삭제 시 [`spec/5-system/1-auth.md §1.4`](./5-system/1-auth.md#14-2fa-two-factor-authentication) 의 흐름을 따른다.

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| user_id | UUID | FK → User (cascade 삭제) |
| credential_id | String | UNIQUE. WebAuthn 표준 credential ID (base64url 인코딩). 가변 길이라 TEXT |
| public_key | Bytes | CBOR-COSE 직렬화 공개 키 (BYTEA) |
| counter | BigInt | replay 방어용 sign counter. 매 인증 후 갱신. 역행 시 fatal — 해당 credential **row 즉시 삭제** (suspend 컬럼 도입 금지, Rationale 1.4.E) + LoginHistory `webauthn_failed`(`WEBAUTHN_COUNTER_REGRESSION`) 기록 |
| transports | String[] | 표준 transport hints (`usb`, `nfc`, `ble`, `internal`, `hybrid`) |
| aaguid | UUID? | 인증기 모델 식별자 (선택) |
| device_name | String? | 사용자가 부여한 표시 이름 (최대 100자). 미설정 시 UI 는 transports + 등록일로 표시 |
| last_used_at | Timestamp? | 마지막 인증 성공 시각 |
| created_at | Timestamp | 등록 시각 |

WebAuthn challenge (등록·인증 시 클라이언트에 전달하는 random nonce) 는 **stateless JWT** 로 발급하고 별도 테이블에 보관하지 않는다. challenge JWT 의 만료는 5분, payload 는 `{ kind: 'webauthn_register'|'webauthn_auth', sub, challenge, exp }`. 자세한 근거는 [`spec/5-system/1-auth.md §1.4 Rationale 1.4.C`](./5-system/1-auth.md#rationale) 참고.

### 2.21.1 SecretStore

워크스페이스 단위 자격증명·시크릿의 암호화 보관소. [`spec/conventions/secret-store.md`](./conventions/secret-store.md) 의 단일 진실 (`SecretResolver` interface · `secret://` URI scheme · backend AES-256-GCM 백엔드).

| 필드 | 타입 | 설명 |
|------|------|------|
| ref | TEXT | PK. `secret://<scope>/<resourceId>/<name>` 형식 (예: `secret://triggers/{triggerId}/bot-token`) |
| workspace_id | UUID | application-level cascade — `TriggersService.delete()` / workspace 삭제 시 `deleteByPrefix` 로 정리 |
| encrypted | BYTEA | `[IV(12B) ‖ AES-256-GCM ciphertext ‖ authTag(16B)]` raw concat. AAD = `ref`. backend Node `crypto` 가 암복호화 — 기존 `ENCRYPTION_KEY` (LLM API key 와 공용 마스터키) 재사용, DB 는 ciphertext 만 본다 |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 마지막 rotation 시각 |

용도:
- `secret://triggers/{id}/bot-token` — Chat Channel adapter 봇 토큰 (provider 공통 — Telegram bot token / Slack `xoxb-*` / Discord bot token, [Chat Channel CCH-SE-03](./5-system/15-chat-channel.md#34-신뢰성--보안))
- `secret://triggers/{id}/bot-token.v2` — 봇 토큰 (24h rotation grace, [CCH-SE-04-C](./5-system/15-chat-channel.md#34-신뢰성--보안))
- `secret://triggers/{id}/inbound-signing` — Chat Channel inbound webhook 출처 검증용 자료 (provider 공통 슬롯). provider 별 의미: Telegram `setWebhook.secret_token` (server-issued shared secret) / Slack `X-Slack-Signature` HMAC key (provider-issued) / Discord application ed25519 public key. 검증 알고리즘 분기는 backend 의 provider 별 책임. SoT: [`conventions/chat-channel-adapter.md §2.3`](./conventions/chat-channel-adapter.md#23-chatchannelconfig)
- `secret://triggers/{id}/notification-signing` — EIA notification HMAC signing secret ([EIA §7.1](./5-system/14-external-interaction-api.md#71-trigger-엔티티-확장))
- `secret://triggers/{id}/notification-signing.v2` — EIA HMAC signing (24h rotation grace)

### 2.22 AssistantMessage

AssistantSession에 속하는 개별 메시지. 사용자 입력, assistant 응답, 도구 호출 결과를 시간 순서대로 기록한다.

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| session_id | UUID | FK → AssistantSession (cascade 삭제) |
| role | Enum | user / assistant / tool / system — 시스템 메시지는 감사/디버그용, 일반적으로 프롬프트 빌더가 매 요청마다 동적으로 조립하므로 저장되지 않음 |
| content | Text? | 사용자/어시스턴트 텍스트 본문. role=tool인 경우 null 가능 |
| tool_calls | JSONB? | role=assistant에서 함께 발행된 tool_call 목록. 각 항목: `{id, name, arguments, kind: 'explore'\|'plan'\|'edit', result, planStepId?}` |
| tool_call_id | String? | role=tool에서 어떤 tool_call의 결과인지 참조 |
| plan | JSONB? | `propose_plan` tool-call 발행 시 스냅샷. `{title, summary, steps[], openQuestions[], approvedAt?}` |
| usage | JSONB? | `{inputTokens, outputTokens, totalTokens, thinkingTokens?, model}` — role=assistant의 턴 종료 시점에만 채움 |
| finish_reason | String? | `stop` / `tool_calls` / `length` / `content_filter` / `aborted` — role=assistant에만 |
| created_at | Timestamp | 생성 시각 |

> `tool_calls[].result` 는 Shadow 검증 결과 또는 탐색 결과의 축약본을 담아 사용자가 히스토리에서 맥락을 재현할 수 있도록 한다. 단, 대용량 원본(예: 50MB 워크플로우)은 요약 형태로만 기록한다(§9.1).
### 2.23 AgentMemory

AI Agent 노드의 `memoryStrategy: 'persistent'` 전략에서 세션 간 추출 사실/선호를 영속하는 의미검색 메모리. pgvector 인프라(`DocumentChunk` §2.12.1 과 동일 확장)를 재사용하되 KnowledgeBase 와는 분리된 별도 테이블이다. SoT: [Spec Agent Memory](./5-system/17-agent-memory.md).

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace (CASCADE). 격리 의무 — 회수/추출은 항상 본 컬럼으로 필터 |
| scope_key | String | 메모리 스코프 키. AI Agent 노드의 `memoryKey` (Expression 평가값) 가 있으면 그 값, 없으면 `execution_id` ([Spec Agent Memory §스코프 키](./5-system/17-agent-memory.md)). `(workspace_id, scope_key)` 가 한 메모리 네임스페이스 |
| content | Text | 추출된 사실/선호 텍스트 원본 (회수 시 LLM 컨텍스트로 주입) |
| embedding | Vector | `content` 의 벡터 임베딩 (pgvector — `DocumentChunk.embedding` 과 동일 확장·차원 정책) |
| metadata | JSONB | `{ source_node_id?, source_execution_id?, kind?, … }` — 추출 출처·분류 메타. `kind ∈ fact/preference/entity` (추출 분류) |
| created_at | Timestamp | 추출 시각 (forgetting FIFO/LRU evict 기준) |
| updated_at | Timestamp | 마지막 갱신 시각 (의미 dedup UPDATE 시 갱신) |
| expires_at | Timestamp? | TTL 만료 시각 (nullable, NULL=무만료). `memoryTtlDays` set 시 `now() + ttlDays`. recall 은 미만료만, evict 는 만료 row 삭제 |

**의미 dedup/갱신**: 저장 시 cosine 유사도 ≥ `MEMORY_DEDUP_SIMILARITY = 0.85` 인 기존 fact 가 있으면 INSERT 대신 그 row UPDATE (같은 사실 최신화). **forgetting**: 만료 row 삭제(`expires_at < now()`) 후 `(workspace_id, scope_key)` 당 최신 `AGENT_MEMORY_MAX_PER_SCOPE = 1000` 건만 보존 — 초과 시 `created_at` 오래된 순으로 evict (FIFO/LRU). ([Spec Agent Memory §4](./5-system/17-agent-memory.md)).


---

## 3. 인덱스 전략

| 테이블 | 인덱스 | 목적 |
|--------|--------|------|
| Workflow | (workspace_id, is_active) | 워크스페이스별 활성 워크플로우 조회 |
| Workflow | (workspace_id, name) | 이름 검색 |
| Node | (workflow_id) | 워크플로우별 노드 조회 |
| Node | (container_id) | 컨테이너별 자식 노드 조회 |
| Node | (tool_owner_id) | AI Agent별 Tool Area 노드 조회 |
| Edge | (workflow_id) | 워크플로우별 엣지 조회 |
| Edge | (workflow_id, type) | 워크플로우별 엣지 유형 조회 |
| Edge | (source_node_id) | 노드별 아웃바운드 엣지 |
| Execution | (workflow_id, started_at DESC) | 워크플로우별 실행 이력 |
| Execution | (status) | 상태별 실행 조회 |
| Execution | (re_run_of) | Re-run 직계 부모 조회 (chain badge 의 부모 표시) |
| Execution | (chain_id, started_at) | Re-run chain 전체 조회 (`GET /api/executions/:id/chain` — [Spec Re-run §8.2](./5-system/13-replay-rerun.md#82-get-apiexecutionsexecutionidchain)) |
| NodeExecution | (execution_id) | 실행별 노드 실행 조회 |
| ExecutionNodeLog | (execution_id, id) | 단일 실행의 노드 진행 순서 조회 |
| Trigger | (workspace_id, type) | 유형별 트리거 조회 |
| Trigger | (workspace_id, endpoint_path) UNIQUE | Webhook URL 라우팅 (워크스페이스 단위 유니크) |
| Schedule | (next_run_at, is_active) | 스케줄러 다음 실행 대상 조회 |
| AuditLog | (workspace_id, created_at DESC) | 감사 로그 조회 |
| RefreshToken | (user_id, family_id) WHERE is_revoked = false | 사용자별 활성 세션 그룹 조회 |
| LoginHistory | (user_id, created_at DESC) | 사용자별 로그인 이력 조회 |
| LoginHistory | (email, created_at DESC) | 미가입 이메일 시도 추적 |
| WebAuthnCredential | (user_id) | 사용자별 credential 목록 조회 |
| WebAuthnCredential | (credential_id) UNIQUE | 인증 시 credential_id 로 row 조회 (WebAuthn 표준 요구) |
| Integration | (workspace_id, service_type) | 서비스별 연동 조회 |
| Integration | (workspace_id, name) UNIQUE | 워크스페이스 내 별칭 유일성 |
| AssistantSession | (workflow_id, status, last_interaction_at DESC) | 워크플로우별 최근 활성 세션 조회 |
| AssistantSession | (workspace_id, user_id, updated_at DESC) | 사용자별 세션 목록 |
| AssistantMessage | (session_id, created_at ASC) | 세션 내 메시지 시간순 페이징 |
| AgentMemory | (workspace_id, scope_key, created_at) | persistent 메모리 스코프별 회수·FIFO/LRU evict 조회 — `created_at` 을 포함해 evict 정렬을 인덱스로 커버 (workspace 격리 강제, V073) |
| AgentMemory | (workspace_id, scope_key, updated_at) | admin scope 목록(`GET /agent-memories/scopes`) 의 `MAX(updated_at)` 정렬을 index-only 로 커버 — created_at 인덱스와 직교 (CONCURRENTLY, V086) |
| AgentMemory | partial HNSW/IVFFlat (embedding) | pgvector 유사도 회수 — `DocumentChunk` 와 동일 차원별 partial 인덱스 정책 ([Spec Agent Memory §회수](./5-system/17-agent-memory.md)) |
| AgentMemory | partial (expires_at) `WHERE expires_at IS NOT NULL` | TTL evict 만료 스캔 가속. 무만료(NULL) row 제외로 인덱스 경량 (V080) |
| Integration | (workspace_id, status) | 만료/에러 상태 배지 카운트 + `pending_install` TTL 스캐너 조회 + 중복 방지 lookup 겸용 ([Spec 통합 화면 §6](./2-navigation/4-integration.md#6-상태-전이)) |
| Integration | (install_token) WHERE install_token IS NOT NULL | Cafe24 Private App URL (`/3rd-party/cafe24/install/:installToken`) 및 MakeShop ShopStore install-first App URL 의 단일 row 식별 — `pending_install` 상태에서 사용. NULL 비저장 부분 인덱스로 인덱스 크기 최소화. V043 |
| Integration | (workspace_id, service_type, mall_id) WHERE mall_id IS NOT NULL UNIQUE | 통합 store-identifier 중복 방지 — `idx_integration_workspace_service_mall`. **service_type 무관 — 신규 통합은 인덱스 추가 불필요**. 한 workspace 안에서 같은 (service_type, mall_id) 의 통합은 최대 1행 (cafe24 는 `mall_id`, makeshop 은 `shop_uid` 투영; public 과 private 동시 보유 불가). 서로 다른 service 가 같은 mall_id 값을 가져도 무관(정상). 옛 per-service UNIQUE (V046 cafe24 / V071 makeshop) 통일. V072 (V045 컬럼 추가와 분리 — CONCURRENTLY 와 ALTER 가 한 마이그레이션에 공존 불가) |
| Integration | (service_type, mall_id) WHERE mall_id IS NOT NULL | 통합 mall_id lookup — `idx_integration_service_mall`. mall_id 회복 검색 (cafe24 `tryRecoverByMallId` 류) 을 모든 service 로 일반화. 옛 cafe24 전용 lookup (V051 `idx_integration_cafe24_mall_id_partial`) 통일. **service_type 무관 — 신규 통합은 인덱스 추가 불필요**. V072 |
| Integration | (token_expires_at) | 만료 스캐너 배치 조회 |
| IntegrationUsageLog | (integration_id, at DESC) | 연동별 최근 호출 이력 |
| IntegrationUsageLog | (at) | 보존기간 초과 레코드 정리 배치 |
| Folder | (workspace_id, parent_id) | 워크스페이스별 폴더 조회 |
| Notification | (user_id, is_read, created_at DESC) WHERE dismissed_at IS NULL | 사용자별 visible 미읽음 알림 조회 (벨 배지·popover). partial 로 dismissed row 를 인덱스에서 배제해 크기를 작게 유지 — 자세한 라이프사이클은 [data-flow/8-notifications.md §4](./data-flow/8-notifications.md#4-dismiss-흐름-사용자-액션) |
| Notification | (workspace_id, created_at DESC) | 워크스페이스별 알림 조회 — partial 미적용 (향후 admin/감사 쿼리가 dismissed 포함 전체 row 를 볼 여지) |

## Rationale

### Execution.execution_path → ExecutionNodeLog (V035 → V036)

옛 `execution.execution_path UUID[]` 컬럼은 단일 인스턴스 환경에서는 동작했으나, 다중 backend 인스턴스가 동시에 `array_append()` 로 갱신할 때 인스턴스 간 절대 순서가 보장되지 않았다. 대체 모델로 append-only 테이블 `execution_node_log` 를 도입했고, BIGSERIAL `id` 가 PostgreSQL sequence (concurrency-safe) 로 부여되므로 `(execution_id, id)` 정렬이 곧 노드 실행 순서가 된다.

이행은 lock 영향 최소화를 위해 두 단계로 분리되었다.

- `codebase/backend/migrations/V035__execution_node_log_create.sql` — 테이블 생성 + `UNNEST WITH ORDINALITY` 로 기존 array 데이터 이행. `executeInTransaction=false`.
- `codebase/backend/migrations/V036__execution_drop_execution_path.sql` — 컬럼 DROP. `lock_timeout=3s` 로 운영 영향 최소화.

설계·운영 세부는 [`spec/5-system/4-execution-engine.md §7.4`](./5-system/4-execution-engine.md) 참고. 외부 API 응답의 `executionPath: string[]` 시그니처는 유지되며, `findById` 가 본 테이블의 정렬 쿼리로 채운다.

### install_token 형식

16바이트 (128-bit) 를 base64url (no padding, 22자) 로 인코딩한다. 32바이트 hex (64자) 는 Cafe24 Developers App URL 입력 필드의 100자 한도를 path prefix 단축만으로는 못 맞춘다. 16바이트 (128-bit) 면 capability token 으로 NIST/OWASP 권장 (96-bit 이상) 을 충분히 상회. DB 컬럼 `install_token` 은 `varchar(64)` (nullable) 로, 22자 토큰이 충분히 들어가므로 schema 변경 불필요 — 마이그레이션 entry 신규 추가 없음. 상세 배경·대안 비교는 [Spec 통합 화면 §9.2 Rationale "Cafe24 App URL 100자 한도 대응" 항](./2-navigation/4-integration.md#rationale).
