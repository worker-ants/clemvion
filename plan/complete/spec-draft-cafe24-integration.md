---
worktree: cafe24-integration-a3f5e2
started: 2026-05-13
owner: project-planner
purpose: consistency-check 입력. 본 draft 통과 후 spec/ 본문에 반영
revision: v2 (1차 BLOCK 해소 — review/consistency/2026-05-13_23-08-00/)
---

# Spec Draft — Cafe24 Admin API Integration (옵션 A: Internal MCP Bridge)

> 본 문서는 **11개** spec 파일의 변경안을 하나의 draft 로 묶어 consistency-check 입력으로 사용한다. v1 의 BLOCK 결과(Critical 2 + Warning 11)를 반영해 v2 로 보강됨. 각 변경안은 "현재 → 변경 후 → 변경 사유" 미니 diff 형식. 신규 파일은 전체 내용을 포함한다.

## 핵심 결정 (요약)

- **옵션 A**: `service_type='cafe24'` Integration 1개 = (a) 워크플로 `cafe24` 노드 + (b) AI Agent MCP 도구. backend 의 `Cafe24McpBridge` 가 `IMcpClient` 를 **in-process** 로 구현.
- **앱 유형**: public(앱스토어) / private(자체 발급) 모두 지원. `credentials.app_type` 라디오.
- **Phase 1**: 18 카테고리 전부 커버. 단일 `cafe24` 노드 + Resource × Operation × Fields 동적 폼.
- **Rate Limit**: leaky bucket. `X-Cafe24-Call-Remain` 헤더 backoff + 429 시 헤더 값만큼 sleep 후 최대 2회 재시도. 노드 / MCP 호출 모두 같은 wrapper 공유.

## v2 BLOCK 해소 변경 요약

| BLOCK 항목 | 해소 위치 |
|---|---|
| **Critical-1** oauth/begin body 의 `mode` 누락 | 본 draft §2 §3.2 Cafe24 흐름 + §9.2 oauth/begin 표 갱신 |
| **Critical-2** 0-common.md scope note 의 cafe24 즉시 허위화 | 본 draft §4 갱신 범위 확장 (도입부 scope note + 진입 링크) |
| Warning-1 §5 캔버스 요약 표에 cafe24 누락 | §4 갱신 범위 확장 |
| Warning-2 mcp-client.md §1 transport 서술 허위화 | §7 갱신 범위에 §1 추가 |
| Warning-3 §14.1 usage 기록 cafe24 행 누락 | §2 갱신 범위 확장 |
| Warning-4 §10.1 callback provider 목록 cafe24 누락 | §2 갱신 범위 확장 |
| Warning-5 §9.2 oauth/begin cafe24 조건부 필드 누락 | §2 갱신 범위 확장 (Critical-1 과 병합) |
| Warning-6 AI Agent §2 설정 UI 라벨·필터 정책 | §8 갱신 범위 확장 |
| Warning-7 AI Agent 캔버스 요약 `{N} MCP` 카운트 정책 | §9 갱신 범위 확장 |
| Warning-8 `X-Cafe24-Call-Limit` 헤더명 오기 | §5 4-cafe24 §4.1 헤더명을 `X-Api-Call-Limit` 으로 수정 |
| Warning-9 4-cafe24.md `## Overview` 섹션 누락 | §5 신규 파일 본문 상단에 `## Overview` 추가 |
| Warning-10 ED-AI-39 mcpServers candidate 쿼리 필터 | **신규 §10** (`spec/3-workflow-editor/4-ai-assistant.md §4.3.1`) |
| Warning-11 Node.type 열거형에 cafe24 미등록 | **신규 §1b** (`spec/1-data-model.md §2.6` Node.type 표) |
| Warning-12 INTEGRATION_INCOMPLETE 공통 표 등록 확인 | 0-common.md §4.2 에 이미 등록됨 — false positive. §5 본문의 출처 표기 통일 |
| Warning-13 plan Phase 1 체크박스 미갱신 | `plan/in-progress/cafe24-integration.md` 별도 갱신 (draft 외) |

---

## §1 변경 — `spec/1-data-model.md` §2.10 (Integration)

### 현재 (line 246)

```text
| service_type | String | 서비스 유형 (google, github, http, database, email, webhook, mcp). `mcp` 의 사용처·credentials 스키마는 [Spec MCP Client](./5-system/11-mcp-client.md) · [Spec 통합 §5.6](./2-navigation/4-integration.md#56-mcp-server) |
```

### 변경 후

```text
| service_type | String | 서비스 유형 (google, github, http, database, email, webhook, mcp, **cafe24**). `mcp` 의 사용처·credentials 스키마는 [Spec MCP Client](./5-system/11-mcp-client.md) · [Spec 통합 §5.6](./2-navigation/4-integration.md#56-mcp-server). **`cafe24` 는 [Spec 통합 §5.8](./2-navigation/4-integration.md#58-cafe24) · [Spec Cafe24 노드](./4-nodes/4-integration/4-cafe24.md) — 같은 Integration 이 워크플로 노드와 AI Agent MCP Bridge 양쪽에서 사용된다 ([Spec MCP Client §2.3 Internal Bridge](./5-system/11-mcp-client.md#23-internal-bridge))** |
```

### 변경 사유

- `service_type` 은 String 컬럼이므로 enum 마이그레이션 불요.
- 신규 service_type 의 "어디서 정의되는가" 진입점을 명시.

---

## §1b 변경 (신규 — BLOCK 해소 W11) — `spec/1-data-model.md` §2.6 Node.type

### 현재 (line 139~167) — Node.type 전체 목록 표

```text
| integration | http_request | 범용 HTTP 요청 |
| integration | database_query | 데이터베이스 쿼리 |
| integration | send_email | 이메일 발송 (SMTP) |
| data | transform | 데이터 변환 (연산 체인) |
...
```

### 변경 후 — `cafe24` 행 추가

`send_email` 와 `transform` 사이에 행 삽입:

```text
| integration | http_request | 범용 HTTP 요청 |
| integration | database_query | 데이터베이스 쿼리 |
| integration | send_email | 이메일 발송 (SMTP) |
| integration | **cafe24** | **Cafe24 Admin API (Resource × Operation 동적 폼). 같은 Integration 이 AI Agent MCP 도구로도 사용** |
| data | transform | 데이터 변환 (연산 체인) |
```

### 변경 사유

- Node.type 열거형 표는 모든 노드의 single source of truth. 신규 노드 추가 시 반드시 등록되어야 코드 측 schema 와 정합.

---

## §2 변경 — `spec/2-navigation/4-integration.md`

### §2.2 항목 요소 — 인증 유형 라벨

**현재** (line 56 부근):

```text
| 인증 유형 | auth_type을 대문자/공백 정리하여 표시 (`OAuth2`, `API Key`, `Bearer Token`, `Basic`, `Connection String`, `SMTP`, `Webhook Outbound`). `service_type='mcp'` 인 경우 `MCP Server` 로 별도 라벨 |
```

**변경 후**:

```text
| 인증 유형 | auth_type을 대문자/공백 정리하여 표시 (`OAuth2`, `API Key`, `Bearer Token`, `Basic`, `Connection String`, `SMTP`, `Webhook Outbound`). `service_type='mcp'` 인 경우 `MCP Server`, **`service_type='cafe24'` 인 경우 `Cafe24` 로 별도 라벨** |
```

### §2.5 Add Integration 모달 (Step 1) — 서비스 카드 추가

**현재** 카드 7종: Google · GitHub · HTTP · Database · Email · Webhook · MCP.

**변경 후**: **Cafe24 카드 1개 추가** (총 8종). 정렬은 "first-party 서비스(Google/GitHub/Cafe24) → 범용(HTTP/Database/Email/Webhook) → 도구 확장(MCP)" 순.

```
┌─────────────────────────────────────────┐
│  Add Integration — Select a service     │
│                                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │ Google  │ │ GitHub  │ │ Cafe24  │   │  ← 신규
│  └─────────┘ └─────────┘ └─────────┘   │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │  HTTP   │ │Database │ │  Email  │   │
│  └─────────┘ └─────────┘ └─────────┘   │
│  ┌─────────┐ ┌─────────┐                │
│  │ Webhook │ │   MCP   │                │
│  └─────────┘ └─────────┘                │
└─────────────────────────────────────────┘
```

### §3.2 Step 2: 인증 정보 입력 — Cafe24 흐름 (신규 블록)

**추가**: 기존 "OAuth2 흐름 (Google/GitHub)" 블록 다음에 새 블록 "OAuth2 흐름 (Cafe24)" 추가.

```markdown
**OAuth2 흐름 (Cafe24)** — `mall_id` 가 base URL 의 일부이고 authorize URL 도 mall 별로 다르므로 폼 흐름이 Google/GitHub 와 다르다.

1. **사전 입력** (OAuth 버튼 누르기 전 필수):
   - `Mall ID` (예: `myshop` — `https://myshop.cafe24api.com` 의 hostname prefix)
   - `App type` 라디오: **Public** (Cafe24 앱스토어 공개 앱, 우리 서버 env 의 client_id/secret 사용) / **Private** (사용자가 자기 쇼핑몰 관리자에서 비공개 앱을 만들고 client_id/secret 을 직접 입력)
   - `App type = Private` 선택 시 `client_id`, `client_secret` 입력란이 폼에 추가 표시
2. **Scope 카테고리 프리셋** (체크박스, 카테고리 단위):
   - Product (read / write), Order (read / write), Customer (read / write), Category (read / write), Promotion (read / write), Mileage (read / write), Shipping (read / write), Salesreport (read), Translation (read / write), Notification (read / write), 기타 카테고리는 "고급" 토글 아래
   - 각 체크박스가 Cafe24 scope (`mall.read_<category>` / `mall.write_<category>`) 와 매핑
3. **[Connect with Cafe24]** 클릭 → 백엔드 `POST /api/integrations/oauth/begin` 호출. body:
   ```jsonc
   {
     "service": "cafe24",
     "mode": "new",                  // 'new' | 'reauthorize' | 'request-scopes' — §10.2 분기 필수
     "mall_id": "myshop",            // cafe24 한정 필수
     "app_type": "public",           // cafe24 한정 필수: 'public' | 'private'
     "client_id":     "...",         // app_type='private' 시 필수
     "client_secret": "...",         // app_type='private' 시 필수
     "scopes": ["mall.read_product", "mall.write_order", ...],
     "integrationId": "..."          // mode != 'new' 시 (reauthorize/request-scopes)
   }
   ```
   응답으로 mall 별 authorize URL 수신.
4. 신규 팝업(600×700)으로 `https://{mall_id}.cafe24api.com/api/v2/oauth/authorize?...` 오픈
5. 팝업 콜백 페이지(`/api/integrations/oauth/callback/cafe24`)가 토큰 저장 후 `postMessage` 로 부모창 알림
6. 부모창은 Step 3 로 자동 전이

> **사전 입력 → preview_token**: `app_type=private` 의 `client_id`/`client_secret`, 그리고 `mall_id` 는 OAuth 시작 시점부터 우리 서버의 임시 저장소(`oauth_preview`, TTL 10분) 에 보관되어 콜백 처리에서 활용된다 — token 교환 endpoint (§10.3) 가 `mall_id` 의존이므로 callback 흐름이 이 값을 읽어야 한다.
```

### §5.8 Cafe24 (신규)

기존 §5.6 MCP Server / §5.7 Webhook (Outbound) 다음에 §5.8 신설:

```markdown
### 5.8 Cafe24

한국 이커머스 SaaS Cafe24 의 Admin API ([공식 문서](https://developers.cafe24.com/docs/ko/api/admin/)) 통합. 하나의 Integration 이 (a) 워크플로의 [`cafe24` 노드](../4-nodes/4-integration/4-cafe24.md), (b) AI Agent 의 MCP 도구 ([§14.2 IntegrationSelector](#142-워크플로우-에디터)) 양쪽에서 사용된다.

**기본 메타**

| 필드 | 값 |
|------|----|
| `Integration.service_type` | `cafe24` |
| `Integration.auth_type` | `oauth2` |
| `Integration.scope` | `personal` / `organization` |

**credentials JSONB 스키마**

| 필드 | 타입 | 필수 | 비밀 | 설명 |
|------|------|------|------|------|
| `mall_id` | string | ✓ | × | Cafe24 쇼핑몰 식별자. base URL `https://{mall_id}.cafe24api.com/api/v2/admin/...` 구성 |
| `app_type` | enum `public` \| `private` | ✓ | × | Cafe24 앱 발급 형태. `public` = Cafe24 앱스토어 등록 앱(우리 env client_id/secret), `private` = 사용자가 자기 쇼핑몰 관리자에서 만든 비공개 앱 |
| `client_id` | string | `app_type='private'` 시 ✓ | × | Private 앱의 OAuth client_id |
| `client_secret` | string | `app_type='private'` 시 ✓ | 🔒 | Private 앱의 OAuth client_secret |
| `access_token` | string | ✓ | 🔒 | OAuth access token (2시간 유효) |
| `refresh_token` | string | ✓ | 🔒 | OAuth refresh token (14일 유효) |
| `scopes` | string[] | ✓ | × | 사용 권한 scope. `mall.read_<category>` / `mall.write_<category>` 형식 |
| `expires_at` | ISO8601 | ✓ | × | `access_token` 만료 시각. `Integration.token_expires_at` 컬럼과 동기화 |
| `user_id` | string | ✓ | × | 토큰을 발급받은 운영자 식별 (Cafe24 응답의 `user_id`) |

> `mall_id` 는 base URL 의 일부이며 authorize URL 도 mall 별로 달라, OAuth begin 단계에서 사용자가 선행 입력해야 한다 (§3.2 Cafe24 흐름 참조).

**OAuth 흐름의 차이점**

- Google/GitHub 처럼 정적 authorize URL 이 아니라 `https://{mall_id}.cafe24api.com/api/v2/oauth/authorize?response_type=code&client_id=...&state=...&redirect_uri=...&scope=...` 로 mall 마다 다른 URL.
- 토큰 교환 endpoint: `POST https://{mall_id}.cafe24api.com/api/v2/oauth/token` (Basic auth: `client_id:client_secret`).
- Refresh: 동일 endpoint, `grant_type=refresh_token`. 자동 갱신은 §10.5 흐름 그대로.

**Scope 권장 프리셋**

| 카테고리 | scope 값 (R / W) |
|---------|------------------|
| Product | `mall.read_product` / `mall.write_product` |
| Order | `mall.read_order` / `mall.write_order` |
| Customer | `mall.read_customer` / `mall.write_customer` |
| Category | `mall.read_category` / `mall.write_category` |
| Promotion | `mall.read_promotion` / `mall.write_promotion` |
| Mileage | `mall.read_mileage` / `mall.write_mileage` |
| Shipping | `mall.read_shipping` / `mall.write_shipping` |
| Sales report | `mall.read_salesreport` / — (write 없음) |
| Translation | `mall.read_translation` / `mall.write_translation` |
| Notification | `mall.read_notification` / `mall.write_notification` |
| Application | `mall.read_application` / `mall.write_application` |
| Store | `mall.read_store` / `mall.write_store` |
| Design | `mall.read_design` / `mall.write_design` |
| Community | `mall.read_community` / `mall.write_community` |
| Collection | `mall.read_collection` / `mall.write_collection` |
| Supply | `mall.read_supply` / `mall.write_supply` |
| Personal | `mall.read_personal` / `mall.write_personal` |
| Privacy | `mall.read_privacy` / `mall.write_privacy` |

UI 는 카테고리 단위 체크박스(R / W 두 컬럼) + "고급" 토글 아래 개별 scope 추가 입력란.

**테스트 방법**: 저장된 `access_token` 으로 `GET https://{mall_id}.cafe24api.com/api/v2/admin/store` 핑. 응답 200 + JSON 본문 확인.

**Rate Limit 정책**: Cafe24 leaky bucket. 응답 헤더 `X-Cafe24-Call-Remain`(재개까지 초), `X-Cafe24-Call-Usage`(%), `X-Api-Call-Limit`(현재/상한) 을 backend `Cafe24ApiClient` wrapper 가 모니터링. 429 응답 시 `X-Cafe24-Call-Remain` 값만큼 sleep 후 최대 2회 재시도. 노드 호출 / AI Agent MCP 호출 모두 같은 wrapper 를 통과해 Integration 단위로 leaky bucket 공유 — 같은 Integration 을 동시에 헤비하게 쓰면 양쪽이 함께 대기한다.

**AI Agent 노출**: `service_type='cafe24'` Integration 은 AI Agent 의 `mcpServers` 셀렉트에서도 선택 가능하며, 선택 시 백엔드의 `Cafe24McpBridge` 가 in-process `IMcpClient` 로 동작해 18 카테고리의 Resource × Operation 을 MCP tool 로 노출한다. 도구 이름·allowlist 규약은 [Spec MCP Client §5](../5-system/11-mcp-client.md#5-도구-노출-모델) 그대로. 상세는 [Cafe24 노드 spec §"AI Agent 노출"](../4-nodes/4-integration/4-cafe24.md#8-ai-agent-노출-internal-mcp-bridge).
```

### §9.2 인증/회전/Scope — oauth/begin body 의 cafe24 조건부 필드

**현재**:

```text
| POST | `/api/integrations/oauth/begin` | OAuth 시작 — state 발급, authUrl 반환. body: `{ service, scopes[], mode: 'new'\|'reauthorize'\|'request-scopes', integrationId? }` |
```

**변경 후**:

```text
| POST | `/api/integrations/oauth/begin` | OAuth 시작 — state 발급, authUrl 반환. body: `{ service, scopes[], mode: 'new'\|'reauthorize'\|'request-scopes', integrationId? }`. **`service='cafe24'` 시 추가 필수 필드: `mall_id`, `app_type: 'public'\|'private'`. `app_type='private'` 시 `client_id`, `client_secret` 추가 필수**. body 의 cafe24 한정 필드들은 `oauth_preview` 임시 저장소(TTL 10분)에 함께 보관되어 callback (§10.2) 에서 token 교환에 사용된다 |
```

### §10.1 callback `:provider` 허용값

**현재** (line 559 부근):

```text
| 파라미터 | 설명 |
|----------|------|
| `:provider` | OAuth 제공자 (`google`, `github`) |
```

**변경 후**:

```text
| 파라미터 | 설명 |
|----------|------|
| `:provider` | OAuth 제공자 (`google`, `github`, **`cafe24`**) |
```

### §10.3 provider 별 설정 — Cafe24 행

**현재**:

| Provider | Token URL | 기본 scope 프리셋 | Refresh |
|----------|-----------|-----------------|---------|
| Google | `https://oauth2.googleapis.com/token` | 사용자 체크박스 선택 결과 | ✓ |
| GitHub | `https://github.com/login/oauth/access_token` | `repo`, `read:org` | ✗ |

**변경 후**: Cafe24 행 추가.

| Provider | Token URL | 기본 scope 프리셋 | Refresh |
|----------|-----------|-----------------|---------|
| Google | `https://oauth2.googleapis.com/token` | 사용자 체크박스 선택 결과 | ✓ |
| GitHub | `https://github.com/login/oauth/access_token` | `repo`, `read:org` | ✗ |
| **Cafe24** | `https://{mall_id}.cafe24api.com/api/v2/oauth/token` | 사용자 체크박스(카테고리 R/W) 결과 | ✓ |

> **Cafe24 한정**: Token URL 이 `mall_id` 의존 변수. `oauth/begin` 시점에 사용자가 입력한 `mall_id` 를 `oauth_preview` 임시 저장소에 함께 저장하여 callback 의 token 교환에서 사용한다 (§10.2 4단계의 `new`/`reauthorize`/`request-scopes` 분기에 모두 적용).

### §10.5 토큰 자동 갱신 — Cafe24 한정 동작

**변경 없음**. 기존 흐름 그대로. 한 줄 추가:

```text
> **Cafe24 한정**: 갱신 endpoint 도 `https://{credentials.mall_id}.cafe24api.com/api/v2/oauth/token`. `mall_id` 누락 시 `INTEGRATION_INCOMPLETE` 로 즉시 실패.
```

### §11 만료 스캐너 — Cafe24 적용

**현재** (line 621): "service_type='mcp' Integration 은 OAuth refresh token 흐름이 아니므로 ... 적용되지 않는다."

**변경 후**: 한 줄 추가:

```text
> `service_type='cafe24'` Integration 은 OAuth refresh token 을 보유하므로 본 §11 의 임계치 알림 흐름이 정상 적용된다. `token_expires_at` 가 만료 7일/3일/당일 임계에 도달하면 `integration_expired` 알림이 발사된다.
```

### §14.1 노드 실행 엔진 — Cafe24 usage 기록 행 추가

**현재** (line 715 부근의 "핸들러별 usage 기록 시점" 표):

```text
| 노드 | Usage 로그 기록 조건 |
|------|---------------------|
| `send_email` | 매 호출 (성공/실패 모두) |
| `database_query` | 매 호출 (성공/실패 모두) |
| `http_request` | `authentication === 'integration'`인 경우에만 기록 (None/Custom은 Usage 대상 아님) |
```

**변경 후**: cafe24 행 추가.

```text
| 노드 | Usage 로그 기록 조건 |
|------|---------------------|
| `send_email` | 매 호출 (성공/실패 모두) |
| `database_query` | 매 호출 (성공/실패 모두) |
| `http_request` | `authentication === 'integration'`인 경우에만 기록 (None/Custom은 Usage 대상 아님) |
| **`cafe24`** | **매 호출 (성공/실패 모두). AI Agent 의 `Cafe24McpBridge` 를 통한 호출도 동일 로그에 기록 — `node_execution_id` 는 호출 시점의 AI Agent NodeExecution. 메타도구는 미사용** |
```

### §14.2 워크플로우 에디터 — IntegrationSelector 화이트리스트

**현재**:

```text
- 노드 설정 패널에서 Integration 선택은 `IntegrationSelector` 공용 드롭다운을 사용한다 — `serviceTypes` prop 으로 목록을 필터(Send Email은 `email`, Database는 `database`, HTTP의 `authentication='integration'` 모드는 `http`, AI Agent 의 `mcpServers` 항목은 `mcp`).
```

**변경 후**:

```text
- 노드 설정 패널에서 Integration 선택은 `IntegrationSelector` 공용 드롭다운을 사용한다 — `serviceTypes` prop 으로 목록을 필터(Send Email은 `email`, Database는 `database`, HTTP의 `authentication='integration'` 모드는 `http`, **Cafe24 노드는 `cafe24`**, **AI Agent 의 `mcpServers` 항목은 `['mcp', 'cafe24']`**).
- AI Agent 의 `mcpServers` 셀렉트는 `service_type='mcp'` 와 `service_type='cafe24'` 를 모두 받는다 — 후자는 backend `Cafe24McpBridge` 가 in-process `IMcpClient` 로 동작 ([Spec MCP Client §2.3 Internal Bridge](../5-system/11-mcp-client.md#23-internal-bridge)). UI 는 두 그룹을 시각적으로 분리 표시 (`Generic MCP servers` / `Cafe24 stores`).
- AI Agent 노드는 Integration 노드와 달리 `mcpServers` 가 다중 선택 (multi-select) 이며, 서버별로 도구 allowlist·resource/prompt 노출 토글 UI 가 추가된다 — Cafe24 의 경우 도구 수가 많아(Resource × Operation = ~180) allowlist UI 가 Resource 단위 grouping 으로 노출된다 ([Spec MCP Client §5.6 도구 allowlist](../5-system/11-mcp-client.md#56-도구-allowlist)).
```

### 변경 사유 (§2 전체)

- §2.2 라벨·§2.5 카드: 새 service_type 의 진입점.
- §3.2 Cafe24 흐름: mall_id / app_type / mode 입력의 선행 필요성 — Critical-1 해소.
- §5.8: 인증 스키마 single source of truth.
- §9.2 oauth/begin body cafe24 조건부 필드 — Warning-5 해소.
- §10.1 callback provider 목록 — Warning-4 해소.
- §10.3 / §10.5: 동적 endpoint·refresh 흐름.
- §11: 만료 스캐너 적용 명시.
- §14.1 usage 기록 — Warning-3 해소.
- §14.2: IntegrationSelector contract.

---

## §3 변경 — `spec/4-nodes/4-integration/_product-overview.md` §2.6 지원 서비스

### 현재

```text
| INT-SV-01 | HTTP/REST — 범용 HTTP 요청 (GET, POST, PUT, DELETE 등) | 필수 |
| INT-SV-02 | Database — PostgreSQL, MySQL 등 직접 쿼리 | 필수 |
| INT-SV-03 | Email (SMTP) — 이메일 전송 | 필수 |
| INT-SV-04 | Webhook — 외부 이벤트 수신 | 필수 |
```

### 변경 후 — INT-SV-05 추가

```text
| INT-SV-01 | HTTP/REST — 범용 HTTP 요청 (GET, POST, PUT, DELETE 등) | 필수 |
| INT-SV-02 | Database — PostgreSQL, MySQL 등 직접 쿼리 | 필수 |
| INT-SV-03 | Email (SMTP) — 이메일 전송 | 필수 |
| INT-SV-04 | Webhook — 외부 이벤트 수신 | 필수 |
| INT-SV-05 | **Cafe24 — 한국 이커머스 SaaS 의 Admin API (상품·주문·회원 등 18 카테고리). 같은 Integration 이 워크플로 노드와 AI Agent MCP 도구 양쪽에서 활용 ([Spec Cafe24 노드](./4-cafe24.md))** | 필수 |
```

---

## §4 변경 — `spec/4-nodes/4-integration/0-common.md` (3개 위치)

### §4.1 도입부 scope note (line 7~11) — BLOCK 해소 C2

**현재** (도입부):

```text
> **본 문서의 범위**: 워크플로 캔버스에 직접 배치되는 Integration 노드(HTTP Request, Database Query, Send Email)의 공통 규약을 다룬다. Integration 엔티티(`service_type='mcp'`)는 워크플로 노드로 노출되지 않고 AI Agent 노드 내부의 `mcpServers` 설정에서만 활용되며, 그 동작·도구 노출 모델은 [Spec MCP Client](../../5-system/11-mcp-client.md) 와 [Spec AI Agent](../3-ai/1-ai-agent.md) 에서 정의한다. 즉 Integration 엔티티는 (a) 본 문서의 노드와 (b) AI Agent MCP provider 두 가지 사용처를 가진다.
```

또한 도입부 노드 진입 링크:

```text
- [HTTP Request](./1-http-request.md)
- [Database Query](./2-database-query.md)
- [Send Email](./3-send-email.md)
```

**변경 후**:

```text
> **본 문서의 범위**: 워크플로 캔버스에 직접 배치되는 Integration 노드(HTTP Request, Database Query, Send Email, **Cafe24**)의 공통 규약을 다룬다. Integration 엔티티의 두 가지 사용 패턴: (a) 본 문서의 캔버스 노드 — `http_request` / `database_query` / `send_email` / `cafe24`. (b) AI Agent 노드 내부 `mcpServers` 에서 도구로 활용 — `service_type='mcp'` (외부 HTTP transport) 와 `service_type='cafe24'` (Internal Bridge transport, [Spec MCP Client §2.3](../../5-system/11-mcp-client.md#23-internal-bridge)). 동작·도구 노출 모델은 [Spec MCP Client](../../5-system/11-mcp-client.md) 와 [Spec AI Agent](../3-ai/1-ai-agent.md) 에서 정의한다. **`cafe24` 는 (a) 와 (b) 양쪽에서 사용되는 첫 사례**이며, 같은 Integration 1개가 두 경로에서 동시 노출된다.
```

링크 목록:

```text
- [HTTP Request](./1-http-request.md)
- [Database Query](./2-database-query.md)
- [Send Email](./3-send-email.md)
- **[Cafe24](./4-cafe24.md)**
```

### §4.2 §5 캔버스 요약 표 — Cafe24 행 추가 (BLOCK 해소 W1)

**현재**:

```text
| 노드 | 요약 포맷 | 예시 |
|------|-----------|------|
| HTTP Request | `{method} {url}` (URL 35자 초과 시 잘림) | `GET https://api.exam...` |
| Database Query | `{queryType} · {쿼리 첫 줄}` (잘림) | `SELECT · SELECT * FROM us...` |
| Send Email | `to: {수신자}`. 수신자 2명 초과 시 `+N` 표시 | `to: user@exam..., +2` |
```

**변경 후**:

```text
| 노드 | 요약 포맷 | 예시 |
|------|-----------|------|
| HTTP Request | `{method} {url}` (URL 35자 초과 시 잘림) | `GET https://api.exam...` |
| Database Query | `{queryType} · {쿼리 첫 줄}` (잘림) | `SELECT · SELECT * FROM us...` |
| Send Email | `to: {수신자}`. 수신자 2명 초과 시 `+N` 표시 | `to: user@exam..., +2` |
| **Cafe24** | **`{resource} · {operation}` (35자 초과 시 잘림)** | **`product · product_list`** |
```

### §4.3 §7 출력 구조 색인 — Cafe24 행

**현재**:

| 노드 | 정상 케이스 | 에러 케이스 | Pre-flight throw |
|------|-------------|-------------|---------------------|
| [http_request](./1-http-request.md#5-출력-구조) | §5.1 (`success`) | §5.3 (`error`) | §5.8 (URL 형식·SSRF 차단) |
| [database_query](./2-database-query.md#5-출력-구조) | §5.1 | §5.3 (`error`) | §5.8 (쿼리 검증 실패) |
| [send_email](./3-send-email.md#5-출력-구조) | §5.1 | §5.3 (`error`) | §5.8 (수신자 미설정) |

**변경 후**:

| 노드 | 정상 케이스 | 에러 케이스 | Pre-flight throw |
|------|-------------|-------------|---------------------|
| [http_request](./1-http-request.md#5-출력-구조) | §5.1 (`success`) | §5.3 (`error`) | §5.8 (URL 형식·SSRF 차단) |
| [database_query](./2-database-query.md#5-출력-구조) | §5.1 | §5.3 (`error`) | §5.8 (쿼리 검증 실패) |
| [send_email](./3-send-email.md#5-출력-구조) | §5.1 | §5.3 (`error`) | §5.8 (수신자 미설정) |
| **[cafe24](./4-cafe24.md#5-출력-구조)** | **§5.1 (`success`)** | **§5.3 (`error`)** | **§5.8 (Resource/Operation 검증·mall_id 누락)** |

### CHANGELOG 추가

```text
| 2026-05-13 | 도입부 scope note 에 cafe24 캔버스 노드 추가 + 진입 링크. §5 캔버스 요약 표 / §7 출력 색인에 cafe24 행 추가. cafe24 노드는 5필드 invariant + Principle 7 config echo 그대로 채택 (4-cafe24.md §5 참조). Integration 엔티티의 "캔버스 노드 + AI Agent MCP 도구" 첫 동시 사용 사례 |
```

### 변경 사유

- 도입부 scope note 가 "HTTP Request, Database Query, Send Email" 3개만 열거 + "mcp 만 비-캔버스" 라고 단정한 상태에서 cafe24 추가 시 즉시 허위화 → Critical-2 해소.

---

## §5 신규 — `spec/4-nodes/4-integration/4-cafe24.md`

새 파일 전체 내용 (`## Overview` 섹션 포함):

````markdown
# Spec: Cafe24

> 관련 문서: [Integration 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md) · [Spec 실행 엔진 §10](../../5-system/4-execution-engine.md#10-integration-handler-계약) · [Spec 통합 §5.8 Cafe24](../../2-navigation/4-integration.md#58-cafe24) · [Spec MCP Client §2.3 Internal Bridge](../../5-system/11-mcp-client.md#23-internal-bridge) · [CONVENTIONS](../../conventions/node-output.md) · [Cafe24 API Metadata 컨벤션](../../conventions/cafe24-api-metadata.md)

## Overview (제품 정의)

한국 이커머스 SaaS [Cafe24](https://developers.cafe24.com/docs/ko/api/admin/) 의 Admin API 를 워크플로와 AI Agent 양쪽에서 호출할 수 있게 한다.

- **사용자 가치**: 쇼핑몰 운영자가 상품·주문·회원·프로모션 등 모든 Admin API endpoint 를 워크플로 노드 1개로 호출 가능. 동시에 AI Agent 에 같은 Integration 을 도구로 부여하면 LLM 이 자연어로 "어제 미발송 주문 가져와줘" 와 같은 작업을 수행한다.
- **지원 범위**: Cafe24 Admin API 의 **18 카테고리 전부 (Store / Product / Order / Customer / Community / Design / Promotion / Application / Category / Collection / Supply / Shipping / Salesreport / Personal / Privacy / Mileage / Notification / Translation)**. 카테고리당 평균 ~10 operation = 총 ~180 endpoint 를 메타데이터 기반 동적 폼으로 표현한다.
- **이중 활용**: Cafe24 는 본 프로젝트에서 "같은 Integration 1개가 워크플로 캔버스 노드와 AI Agent MCP 도구 양쪽에 동시 노출되는" 첫 사례다. backend 의 `Cafe24McpBridge` 가 [Spec MCP Client §2.3](../../5-system/11-mcp-client.md#23-internal-bridge) 의 in-process `IMcpClient` 인터페이스를 구현하여 본 노드와 같은 메타데이터 테이블에서 MCP `tools/list` 응답을 생성한다.

---

## 1. 설정 (config)

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| integrationId | UUID | ✓ | — | `service_type='cafe24'` Integration ID ([공통 §1](./0-common.md#1-integration-참조)) |
| resource | Enum | ✓ | — | Cafe24 카테고리. 18 값: `store`, `product`, `order`, `customer`, `community`, `design`, `promotion`, `application` (**※ Cafe24 앱 관리 API — OAuth 앱 등록과 무관**), `category`, `collection`, `supply`, `shipping`, `salesreport`, `personal`, `privacy`, `mileage`, `notification`, `translation` |
| operation | String | ✓ | — | 선택한 `resource` 의 operation 식별자. 메타데이터 테이블 ([cafe24-api-metadata 컨벤션](../../conventions/cafe24-api-metadata.md))에 정의된 enum 중 하나 (예: `product_list`, `product_get`, `order_list`, `order_update_status`, ...) |
| fields | Record<string, unknown> | — | `{}` | 선택한 operation 의 입력 필드. 표현식 `{{ }}` 사용 가능. 각 operation 의 required/optional 필드는 메타데이터 테이블에서 정의 |
| pagination | object? | — | — | `{ limit?: number, offset?: number, cursor?: string }`. operation 이 페이지네이션을 지원하는 경우에만 사용. fields 와 분리해 표준화 |

표현식(`{{ }}`)은 `fields[*]` · `pagination.*` 모든 값에서 사용 가능.

> Source of truth: `backend/src/nodes/integration/cafe24/cafe24.schema.ts` (export `cafe24NodeConfigSchema`, `cafe24NodeMetadata`)

## 2. 설정 UI

```
┌──────────────────────────────────────────┐
│  Integration: [my-cafe24-shop ▼]         │
│                                          │
│  Resource:    [Product           ▼]      │
│  Operation:   [Search products   ▼]      │
│                                          │
│  ┌─ Required ─────────────────────────┐ │
│  │ shop_no       [{{ $input.shop }} ] │ │
│  └────────────────────────────────────┘ │
│                                          │
│  ┌─ Optional ─────────────────────────┐ │
│  │ category_no   [_________________ ] │ │
│  │ display       [☑ T  ☐ F          ] │ │
│  │ since         [{{ $now.iso }}    ] │ │
│  └────────────────────────────────────┘ │
│                                          │
│  ┌─ Pagination ───────────────────────┐ │
│  │ Limit: [50_]   Offset: [0__]       │ │
│  └────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

- Integration 드롭다운: `IntegrationSelector` 의 `serviceTypes=['cafe24']` 필터 (Cafe24 만 표시).
- Resource 드롭다운: 18 카테고리. 메타데이터에 정의된 라벨 표시 (예: `product` → "Product (상품)").
- Operation 드롭다운: Resource 변경 시 동적 갱신. 메타데이터의 (resource, operation) → label 매핑.
- Fields: Operation 선택 시 메타데이터의 입력 스키마(JSON Schema 호환 형식) 로 동적 폼 렌더. Required / Optional 두 그룹으로 분리.
- Pagination: operation 메타데이터에 `paginated: true` 가 있을 때만 표시.

## 3. 포트

### 3.1 입력 포트

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `in` | Input | data | false | 입력 데이터 (`$input` 으로 참조) |

### 3.2 출력 포트

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `success` | Success | data | false | Cafe24 API 2xx 응답 |
| `error` | Error | error | false | Cafe24 API 3xx/4xx/5xx, transport 실패, rate-limit 재시도 소진, 또는 메타데이터 검증 실패 |

`status` 는 비-블로킹 노드이므로 항상 생략 (Principle 0).

## 4. 실행 로직

[Integration 공통 §4 Handler 실행 세멘틱](./0-common.md#4-handler-실행-세멘틱) 의 6단계 계약을 따른다. 노드 고유 흐름:

1. **Config 정규화**: `resource` / `operation` 을 메타데이터에서 조회하여 `{ method, path, requiredFields, optionalFields, paginated, responseShape }` 해석. 미존재 시 throw `CAFE24_UNKNOWN_OPERATION`.
2. **Config echo 빌드** (Principle 7): `context.rawConfig` 를 그대로 spread — `resource`, `operation`, `fields`, `pagination` 의 `{{ }}` 표현식 보존. **자격증명은 echo 금지** — `integrationId` 만 echo.
3. **Integration 자격증명 해석**: `IntegrationsService.getForExecution(integrationId, workspaceId)` → `serviceType='cafe24'` 검증, `status='connected'` 검증. 실패 시 `INTEGRATION_NOT_FOUND` / `INTEGRATION_TYPE_MISMATCH` / `INTEGRATION_NOT_CONNECTED` ([공통 §4.2](./0-common.md#42-공통-에러-코드)).
4. **credentials 충족 검증** (공통 §4.2 `INTEGRATION_INCOMPLETE`): `mall_id`, `app_type`, `access_token`, `refresh_token` 누락 시 throw. `app_type='private'` 인데 `client_id`/`client_secret` 누락 시 동일.
5. **Required fields 검증**: 메타데이터의 `requiredFields` 에 명시된 키가 `config.fields` 에 모두 존재하는지 검증. 누락 시 throw `CAFE24_MISSING_FIELDS` (어느 필드인지 details 에 명시).
6. **토큰 만료 확인 및 갱신**: `Integration.token_expires_at` 가 만료됐거나 60초 내 만료 예정이면 자동 갱신 ([§통합 §10.5 토큰 자동 갱신](../../2-navigation/4-integration.md#105-토큰-자동-갱신)). 갱신 실패 시 status 를 `expired` 로 전이하고 throw `INTEGRATION_NOT_CONNECTED`.
7. **URL 구성**: `https://{credentials.mall_id}.cafe24api.com/api/v2/admin/{operation.path}` — `{path}` 는 메타데이터에 정의된 path template (예: `products/{product_no}`). path parameter 는 `fields` 에서 채움.
8. **Query / Body 구성**: 메타데이터의 `fieldLocation` (path / query / body) 에 따라 분배. `pagination.{limit, offset, cursor}` 는 항상 query.
9. **호출 (rate-limit-aware)**: `Cafe24ApiClient` wrapper 가 다음을 수행 — `Authorization: Bearer {access_token}` 헤더 부여 → fetch → 응답 헤더 `X-Cafe24-Call-Remain` 모니터링 → 429 응답 시 헤더 값(초) 만큼 sleep 후 재시도(최대 2회).
10. **응답 파싱**: JSON 본문을 그대로 `output.response` 에 보존. `meta.statusCode`, `meta.durationMs`, `meta.callUsage` (헤더 `X-Cafe24-Call-Usage`), `meta.callRemain` (헤더 `X-Cafe24-Call-Remain`).
11. **Usage 로깅** ([공통 §4 의 6단계 Usage 로깅](./0-common.md#4-handler-실행-세멘틱)): 성공·실패 무관 1건. `error.code` 는 §6 의 vocabulary.
12. **반환 분기**:
    - 2xx → §5.1 (`port:'success'`)
    - 3xx/4xx/5xx → §5.3 (`port:'error'`, `output.error.code` 는 §6 분류 (`CAFE24_404` / `CAFE24_422` / `CAFE24_AUTH_FAILED` / `CAFE24_RATE_LIMITED` / `CAFE24_4XX` / `CAFE24_5XX`))
    - transport 실패 → §5.3 (`output.error.code = 'CAFE24_TRANSPORT_FAILED'`, `meta.statusCode = 0`)

### 4.1 Rate Limit 처리 상세

| 헤더 | 의미 | 동작 |
|------|------|------|
| `X-Api-Call-Limit` | `현재/상한` (예: `1/40`) | 진단 메트릭으로만 보존 (`meta.callLimit`) |
| `X-Cafe24-Call-Usage` | 호출 사용률 (%) | `meta.callUsage` |
| `X-Cafe24-Call-Remain` | 재개까지 남은 시간 (초) | 429 시 sleep 시간 |
| `X-Cafe24-Time-Usage` | 처리시간 사용률 (%) | `meta.timeUsage` (있을 때) |
| `X-Cafe24-Time-Remain` | 처리시간 재개 시간 (초) | 429 시 sleep 보정 |

- **429 응답 시 정책**: `max(X-Cafe24-Call-Remain, X-Cafe24-Time-Remain)` 만큼 sleep. 최대 2회 재시도. 3번째 429 시 `output.error.code = 'CAFE24_RATE_LIMITED'` 로 error 포트 라우팅.
- **노드 / MCP Bridge 공유**: 같은 Integration credential 을 사용하므로 같은 leaky bucket. wrapper 의 sleep 은 process-level (Integration ID 별 in-memory mutex) → 한 노드가 sleep 중이면 동일 Integration 의 다른 호출도 자동 대기 (오버드라이브 방지).

## 5. 출력 구조

> CONVENTIONS Principle 11 포맷. JSON 예시는 `undefined` 필드 생략, 5필드 외 top-level 키 금지. `output.response` (Principle 8.2 의 HTTP 관용 네이밍 재사용). `meta.durationMs` 통일 ([공통 §6.1](./0-common.md#61-metaduration-vs-metadurationms-명명-통일)).
>
> `status` 는 비-블로킹 노드이므로 항상 생략.

### 5.1 Case: 2xx 성공 (port `success`)

```json
{
  "config": {
    "integrationId": "int_cafe24_myshop",
    "resource": "product",
    "operation": "product_list",
    "fields": {
      "shop_no": 1,
      "display": "T",
      "since": "{{ $now.iso }}"
    },
    "pagination": { "limit": 50, "offset": 0 }
  },
  "output": {
    "response": {
      "products": [
        { "product_no": 1001, "product_name": "샘플 상품", "price": "10000.00" }
      ],
      "links": [{ "rel": "next", "href": "/api/v2/admin/products?offset=50&limit=50" }]
    }
  },
  "meta": {
    "statusCode": 200,
    "durationMs": 320,
    "callUsage": 12,
    "callRemain": 0,
    "callLimit": "5/40"
  },
  "port": "success"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.integrationId` | UUID | config echo (Principle 7) | 사용자 입력 raw |
| `config.resource` | Enum | config echo | 18 카테고리 중 하나 |
| `config.operation` | string | config echo | operation 식별자 |
| `config.fields` | object | config echo | 사용자 입력 raw — `{{ }}` 보존 |
| `config.pagination?` | object | config echo | paginated operation 시 |
| `output.response` | unknown | runtime — Cafe24 응답 body | Cafe24 API 응답을 그대로 보존 (구조는 operation 별 차이) |
| `meta.statusCode` | number | engine inject (handler return) | HTTP 응답 status (2xx) |
| `meta.durationMs` | number | engine inject | 요청 시작부터 응답 수신까지의 ms |
| `meta.callUsage?` | number | runtime | `X-Cafe24-Call-Usage` 헤더 (%) |
| `meta.callRemain?` | number | runtime | `X-Cafe24-Call-Remain` 헤더 (초) |
| `meta.callLimit?` | string | runtime | `X-Api-Call-Limit` 헤더 (`현재/상한`) |
| `port` | `'success'` | handler return | 2xx 응답 분기 |

**Expression 접근 예**:
- `$node["X"].output.response.products[0].product_no` → 1001
- `$node["X"].meta.statusCode` → 200
- `$node["X"].config.resource` → `"product"`

### 5.3 Case: API 에러 또는 Transport 실패 (port `error`)

CONVENTIONS Principle 3.2 의 표준 envelope `output.error.{code, message, details?}`. 4xx/5xx 의 경우 서버가 돌려준 응답 body 는 `output.response` 에 보존 (디버깅).

#### 5.3.1 Cafe24 API 4xx / 5xx 응답

```json
{
  "config": {
    "integrationId": "...",
    "resource": "product",
    "operation": "product_get",
    "fields": { "product_no": 9999 }
  },
  "output": {
    "response": {
      "error": { "code": "404", "message": "Not Found", "more_info": "..." }
    },
    "error": {
      "code": "CAFE24_404",
      "message": "Cafe24 API returned 404 — Not Found",
      "details": {
        "statusCode": 404,
        "mallId": "myshop",
        "resource": "product",
        "operation": "product_get",
        "cafe24ErrorCode": "404",
        "cafe24Message": "Not Found"
      }
    }
  },
  "meta": { "statusCode": 404, "durationMs": 120, "callUsage": 13 },
  "port": "error"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.fields` | object | config echo | 호출 시도한 입력 (Principle 7 — `{{ }}` 보존) |
| `output.response` | unknown | runtime | 4xx/5xx 시에도 Cafe24 응답 body 보존 |
| `output.error.code` | string | handler return | §6 vocabulary |
| `output.error.message` | string | handler return | `Cafe24 API returned <status> — <statusText>` |
| `output.error.details.statusCode` | number | handler return | HTTP status |
| `output.error.details.mallId` | string | handler return | 호출 대상 mall_id (디버깅) |
| `output.error.details.resource` / `operation` | string | handler return | 호출 시도한 노드 설정 |
| `output.error.details.cafe24ErrorCode` / `cafe24Message` | string? | handler return | Cafe24 응답 body 의 `error.code` / `message` (있을 때) |
| `meta.statusCode` | number | handler return | HTTP 응답 status |
| `port` | `'error'` | handler return | 에러 분기 |

#### 5.3.2 Rate Limit 재시도 소진

```json
{
  "config": {
    "integrationId": "...",
    "resource": "product",
    "operation": "product_list",
    "fields": {}
  },
  "output": {
    "error": {
      "code": "CAFE24_RATE_LIMITED",
      "message": "Cafe24 leaky bucket exhausted after 2 retries",
      "details": {
        "retries": 2,
        "lastRetryAfterSec": 5,
        "mallId": "myshop"
      }
    }
  },
  "meta": { "statusCode": 429, "durationMs": 12500, "callUsage": 100, "callRemain": 5 },
  "port": "error"
}
```

> `config.fields` 가 `{}` 인 경우에도 명시적으로 echo 한다 (Principle 7 — 누락 ≠ undefined).

#### 5.3.3 Transport 실패 (네트워크 / 타임아웃)

```json
{
  "config": {
    "integrationId": "...",
    "resource": "order",
    "operation": "order_list",
    "fields": {}
  },
  "output": {
    "error": {
      "code": "CAFE24_TRANSPORT_FAILED",
      "message": "ECONNRESET",
      "details": { "mallId": "myshop", "resource": "order", "operation": "order_list" }
    }
  },
  "meta": { "statusCode": 0, "durationMs": 30000 },
  "port": "error"
}
```

### 5.8 Pre-flight throw (노드 실패)

다음은 모두 throw → 노드 실행 실패 처리 (CONVENTIONS Principle 3.1). 워크플로우 수준에서는 `error` 포트가 아닌 실행 실패로 표면화된다.

| 발생 조건 | 메시지 / 코드 | 시점 |
|-----------|----------------|------|
| `integrationId` 누락 | `Integration 을 선택해야 합니다.` | warningRule (캔버스 배지) + handler.validate |
| `resource` 누락 또는 enum 미일치 | `resource must be one of: store, product, order, ... (18 categories)` | handler.validate |
| `operation` 누락 또는 메타데이터에 미존재 | `CAFE24_UNKNOWN_OPERATION: operation "<value>" not defined for resource "<resource>"` | handler.execute |
| Integration `serviceType !== 'cafe24'` | `INTEGRATION_TYPE_MISMATCH` ([공통 §4.2](./0-common.md#42-공통-에러-코드)) | handler.execute |
| Integration `status !== 'connected'` | `INTEGRATION_NOT_CONNECTED` ([공통 §4.2](./0-common.md#42-공통-에러-코드)) | handler.execute |
| credentials 필수 필드 누락 (`mall_id`, `access_token`, `refresh_token`, app_type=private 시 `client_id`/`client_secret`) | `INTEGRATION_INCOMPLETE` ([공통 §4.2](./0-common.md#42-공통-에러-코드)) | handler.execute |
| operation 의 `requiredFields` 중 일부 누락 | `CAFE24_MISSING_FIELDS: missing required fields [field1, field2]` | handler.execute |
| `__workspaceId` 컨텍스트 누락 | `Missing workspace context — handler cannot resolve the integration` | handler.execute |

## 6. 에러 코드

런타임 (`port:'error'`) 에서 채워지는 `output.error.code` enum:

| 코드 | 조건 | `output.response` | `meta.statusCode` |
|------|------|-------------------|---------------------|
| `CAFE24_4XX` | `400 ≤ statusCode < 500` (404·422 외의 fallback) | 서버 body 보존 | 응답 status |
| `CAFE24_404` | Cafe24 응답 404 (자주 분기되는 케이스) | 서버 body 보존 | 404 |
| `CAFE24_422` | Cafe24 응답 422 (validation 실패) | 서버 body 보존 | 422 |
| `CAFE24_AUTH_FAILED` | 401 / 403. `Integration.status` 를 `error(auth_failed)` 로 atomic 전이 | 서버 body 보존 | 401 / 403 |
| `CAFE24_RATE_LIMITED` | 429 응답 + 재시도 소진 | 서버 body 보존 (있으면) | 429 |
| `CAFE24_5XX` | `500 ≤ statusCode < 600` | 서버 body 보존 | 응답 status |
| `CAFE24_TRANSPORT_FAILED` | `fetch` reject (DNS / 연결 거부 / 소켓 / `AbortController` timeout) | 미정의 | `0` |

Pre-flight throw 코드는 §5.8 참조 — `output.error.code` 가 아니라 노드 실행 실패로 분기되며, `IntegrationUsageLog` 의 `error.code` 로만 기록된다 (`CAFE24_UNKNOWN_OPERATION`, `CAFE24_MISSING_FIELDS`, `INTEGRATION_*`).

### 6.1 인증 실패 자동 status 전환

응답이 401/403 이면 다음을 동시에 수행 (Spec MCP Client §8.4 와 동일 정책):

1. `port: 'error'`, `output.error.code = 'CAFE24_AUTH_FAILED'` 로 분기
2. `IntegrationUsageLog.error.code = 'CAFE24_AUTH_FAILED'` 로 로그 기록
3. **`Integration.status` 를 `error` 로, `status_reason` 을 `auth_failed` 로 atomic UPDATE 전환** — 다음 노드 실행이 기동될 때 통합 관리 화면이 "Need attention" 배너로 자동 노출

자동 복구 없음 — 토큰이 다시 유효해지면 사용자가 명시적으로 `Reauthorize` 로 `connected` 복귀.

## 7. 캔버스 요약

[공통 §5](./0-common.md#5-캔버스-요약) — `Cafe24` 행 인용. 요약 포맷: `{resource} · {operation}` (예: `product · product_list`). 연결된 Integration 이 삭제된 경우 `⚠ Missing integration` (앰버색).

## 8. AI Agent 노출 (Internal MCP Bridge)

`Integration` 1개가 본 노드와 AI Agent 의 MCP 도구 양쪽에서 사용된다. 백엔드의 `Cafe24McpBridge` 가 [Spec MCP Client §2.3 Internal Bridge](../../5-system/11-mcp-client.md#23-internal-bridge) 의 in-process `IMcpClient` 인터페이스를 구현하여 본 노드와 동일한 메타데이터 테이블로부터 MCP `tools/list` 응답을 자동 생성한다.

### 8.1 도구 이름 매핑

| 노드 측 | MCP 측 |
|---------|--------|
| `resource='product'`, `operation='product_list'` | `mcp_<int8자>__product_list` |
| `resource='order'`, `operation='order_get'` | `mcp_<int8자>__order_get` |
| `resource='customer'`, `operation='customer_update'` | `mcp_<int8자>__customer_update` |

도구 이름 sanitize / 길이 규칙은 [Spec MCP Client §5.2 도구 이름 규칙](../../5-system/11-mcp-client.md#52-도구-이름-규칙) 그대로 적용. `<resource>_<operation>` 토큰 안에 underscore 가 1개 들어가는 점에 유의 — MCP §5.2 의 `__` 구분자 규칙은 server↔tool 의 첫 `__` 발생 위치로 split 하므로 충돌 없음.

### 8.2 메타도구 (resources / prompts) 미사용

Cafe24 MCP Bridge 는 `listTools` 만 보고하고 `resources` / `prompts` capability 는 **보고하지 않는다** — Cafe24 Admin API 는 도구 기반 RPC 모델이며 prompt 템플릿이나 read-only resource 모델이 없다. 따라서 `mcp_<sid>__list_resources` 등 메타도구는 노출되지 않는다 ([Spec MCP Client §5.1 노출 규칙](../../5-system/11-mcp-client.md#51-노출-규칙)).

### 8.3 allowlist (`mcpServers[].enabledTools`)

AI Agent config 의 `mcpServers[i].enabledTools` 는 `['product_list', 'order_list', ...]` 형식의 도구 이름 배열로 그대로 사용 ([Spec MCP Client §5.6](../../5-system/11-mcp-client.md#56-도구-allowlist)). UI 에서는 Resource 단위 grouping 으로 사용성 보강 — "Product (read/write 전부 허용)" 같은 short form 을 frontend 가 enabledTools 배열로 펼쳐 저장한다.

### 8.4 Rate Limit 공유

노드 호출 / MCP `tools/call` 모두 같은 `Cafe24ApiClient` wrapper 를 통과한다 → 같은 Integration credential 에 대한 leaky bucket 공유. AI Agent multi-turn 도중 LLM 이 빠르게 연속 호출하면 다른 워크플로의 같은 Integration 사용도 함께 대기한다 (process-level mutex). 격리는 Integration 단위 — 서로 다른 `mall_id` 의 Integration 간에는 공유되지 않는다.

### 8.5 IntegrationUsageLog

MCP 측 호출도 동일한 `IntegrationUsageLog` 에 기록된다 ([Spec MCP Client §8.3](../../5-system/11-mcp-client.md#83-integrationusagelog)). `node_execution_id` 는 호출 시점의 AI Agent NodeExecution. 통합 관리 상세 페이지의 Recent Activity 탭은 두 경로의 호출을 함께 표시한다.

---

## 9. Rationale

### 9.1 단일 노드 + 메타데이터 테이블

대안:
- (A) **endpoint 당 도메인 노드** (예: `cafe24_product_list`, `cafe24_order_get` 등 ~180개): 캔버스 가독성·노드 카탈로그가 무너짐.
- (B) **범용 HTTP 노드 + 인증만 등록**: 사용자가 매번 URL/method 구성 → UX 저하. rate-limit 헤더 처리 일반화 어려움.
- (C, 채택) **단일 노드 + Resource/Operation 동적 폼**: 캔버스 노드 1개 + 카테고리당 평균 ~10 endpoint 의 동적 폼. 신규 endpoint = 메타데이터 row 1 추가.

n8n / Make 의 Cafe24 노드 패턴과 동일한 결정.

### 9.2 Internal MCP Bridge

AI Agent 에서 Cafe24 를 도구로 쓰는 옵션 비교 (사용자 대화 로그):

- (A, 채택) Internal MCP Bridge — 같은 Integration 1개, in-process bridge. AI Agent spec/handler 변경 0.
- (B) 별도 외부 MCP 서버 + Integration 2번 등록 — credential 중복·운영 부담.
- (C) 일반 도구 재작성을 기다려 캔버스 노드를 Tool Area 등록 — `plan/in-progress/ai-agent-tool-connection-rewrite.md` 일정 종속. 단일 노드 1개를 도구화하면 (resource, operation) 1조합만 → 캔버스에 노드 다중 배치 필요. **옵션 A 채택 + 옵션 C 보완** (재작성 완료 후 합류).

### 9.3 노드의 Resource/Operation 메타데이터 위치

- spec 본문에 ~180개 enumeration 을 적지 않는다 — Cafe24 가 추가/변경할 때마다 spec drift 위험. spec 은 형식·예시·카테고리 18개만 명시.
- 정식 메타데이터는 [`spec/conventions/cafe24-api-metadata.md`](../../conventions/cafe24-api-metadata.md) 의 컨벤션을 따르는 backend metadata 모듈 (예: `backend/src/nodes/integration/cafe24/metadata/*.ts`) 에 저장. 신규 endpoint 추가 절차도 컨벤션에 정의.

### 9.4 Public + Private 앱 동시 지원

대화에서 사용자가 "둘 다 지원" 선택. 공개 앱(앱스토어 등록 전 단계)과 단일 mall private 앱 양쪽 모두 같은 spec 에서 처리. credentials JSONB 에 `app_type` 라디오 + private 시 `client_id`/`client_secret` 입력란.

### 9.5 5필드 invariant 준수

본 노드는 CONVENTIONS Principle 0~11 을 모두 준수한다:
- Principle 0: 5필드 (`config`/`output`/`meta`/`port`) — `status` 는 비-블로킹이므로 생략.
- Principle 1.1: config (raw) ↔ output (런타임) 직교.
- Principle 3: `port: 'error'` + `output.error.{code, message, details?}`.
- Principle 7: `config` 는 `context.rawConfig` echo. 자격증명은 echo 금지 (integrationId 만 echo).
- Principle 8.2: HTTP 관용 네이밍 `output.response` 재사용.

## 10. CHANGELOG

| 일자 | 변경 |
|------|------|
| 2026-05-13 | 신규 spec — Cafe24 Admin API 단일 노드 (Resource × Operation 동적 폼). AI Agent Internal MCP Bridge 노출 (§8). credentials 스키마는 [통합 §5.8 Cafe24](../../2-navigation/4-integration.md#58-cafe24) |
````

### 변경 사유 (§5 신규 파일)

- HTTP Request 등 다른 Integration 노드와 동일한 spec 구조.
- 메타데이터 enumeration 은 spec 외부로 분리 — drift 방지.
- v2: `## Overview` 섹션 추가 (W9), §4.1 헤더명 오기 수정 (W8: `X-Cafe24-Call-Limit` → `X-Api-Call-Limit`), §4 item 11 anchor 명시적 단계 참조 (Info-2), §5.3.2/5.3.3 `config.fields: {}` 명시 (Info-5), `resource='application'` 주석 (Info-3), §5.8 / §6.1 의 `INTEGRATION_*` 출처 표기 통일 (W12).

---

## §6 신규 — `spec/conventions/cafe24-api-metadata.md`

새 파일 전체 내용:

````markdown
# CONVENTION: Cafe24 API Metadata

> 관련 문서: [Spec Cafe24 노드](../4-nodes/4-integration/4-cafe24.md) · [Spec 통합 §5.8 Cafe24](../2-navigation/4-integration.md#58-cafe24) · [Spec MCP Client §2.3 Internal Bridge](../5-system/11-mcp-client.md#23-internal-bridge)

본 컨벤션은 Cafe24 Admin API 의 endpoint 매핑 메타데이터 형식을 정의한다. backend 의 `Cafe24` 노드 핸들러와 `Cafe24McpBridge` 양쪽이 **같은 메타데이터 테이블** 을 소비한다 — 신규 endpoint 추가는 메타데이터 row 1 추가로 끝나야 한다.

---

## 1. 디렉토리 구조

```
backend/src/nodes/integration/cafe24/metadata/
  index.ts             # 18 resource 의 종합 export
  store.ts             # Store (상점)
  product.ts           # Product (상품)
  order.ts             # Order (주문)
  customer.ts          # Customer (회원)
  community.ts         # Community (게시판)
  design.ts
  promotion.ts
  application.ts       # ⚠ Cafe24 앱 관리 API — OAuth 앱 등록과 무관
  category.ts
  collection.ts
  supply.ts
  shipping.ts
  salesreport.ts
  personal.ts
  privacy.ts
  mileage.ts
  notification.ts
  translation.ts
```

각 파일은 한 Resource 의 모든 Operation 메타데이터를 export 한다.

## 2. Operation 메타데이터 형식

```ts
interface Cafe24OperationMetadata {
  // 식별
  id: string;                    // 예: 'product_list'. resource 안에서 unique
  label: string;                 // UI 드롭다운 라벨 (한국어) 예: '상품 목록 조회'
  description: string;           // MCP tool description (영문 권장) 또는 다국어 키
  category: 'read' | 'write';    // scope 매핑 — mall.read_<resource> / mall.write_<resource>

  // HTTP 매핑
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;                  // path template. 예: 'products/{product_no}'

  // 입력 스키마
  requiredFields: string[];
  fields: {
    [fieldName: string]: {
      type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'enum';
      location: 'path' | 'query' | 'body';
      enum?: string[];
      description?: string;
      default?: unknown;
    };
  };

  responseShape?: 'list' | 'single' | 'empty';
  paginated?: boolean;
}
```

## 3. 예시 — `product` Resource 일부

```ts
export const productOperations: Cafe24OperationMetadata[] = [
  {
    id: 'product_list',
    label: '상품 목록 조회',
    description: 'List products in the mall. Supports filtering by category, display status, date range.',
    category: 'read',
    method: 'GET',
    path: 'products',
    requiredFields: ['shop_no'],
    fields: {
      shop_no:     { type: 'number',  location: 'query',  description: 'Multi-shop number (default 1)' },
      category_no: { type: 'number',  location: 'query',  description: 'Filter by category' },
      display:     { type: 'enum',    location: 'query',  enum: ['T', 'F'] },
      since:       { type: 'string',  location: 'query',  description: 'ISO8601 date — created_after' },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'product_get',
    label: '상품 단건 조회',
    description: 'Get a single product by product_no.',
    category: 'read',
    method: 'GET',
    path: 'products/{product_no}',
    requiredFields: ['product_no'],
    fields: {
      product_no:  { type: 'number',  location: 'path' },
      shop_no:     { type: 'number',  location: 'query' },
    },
    responseShape: 'single',
  },
  {
    id: 'product_update',
    label: '상품 수정',
    description: 'Update a product (name, price, display, stock, etc).',
    category: 'write',
    method: 'PUT',
    path: 'products/{product_no}',
    requiredFields: ['product_no'],
    fields: {
      product_no:    { type: 'number',  location: 'path' },
      product_name:  { type: 'string',  location: 'body' },
      price:         { type: 'string',  location: 'body', description: 'Decimal string (KRW)' },
      display:       { type: 'enum',    location: 'body', enum: ['T', 'F'] },
    },
    responseShape: 'single',
  },
];
```

## 4. 신규 endpoint 추가 절차

1. [Cafe24 공식 문서](https://developers.cafe24.com/docs/ko/api/admin/) 에서 endpoint 의 method / path / 필드 확인.
2. 해당 resource 의 metadata 파일에 §2 형식으로 row 1 추가.
3. `id` 는 `<resource>_<verb>` 형식 (예: `product_list`, `order_update_status`). 중복 금지 (resource 내).
4. `category` 는 read/write 결정 — scope 매핑에 사용.
5. 백엔드 단위 테스트가 자동으로 검증:
   - 모든 `id` 의 unique
   - 모든 `path` 의 `{placeholder}` 가 `fields` 에 정의됐는지
   - `requiredFields` 가 `fields` 의 키 부분집합인지
6. **spec 본문 수정 불요** — `4-cafe24.md` 는 형식만 정의.

## 5. MCP Bridge 와의 매핑

`Cafe24McpBridge.listTools()` 는 메타데이터 테이블을 순회하여 다음을 생성한다:

```ts
function operationToMcpTool(op: Cafe24OperationMetadata): McpTool {
  return {
    name: op.id,                                 // 'product_list'
    description: `${op.description}\n\n(Cafe24 ${op.method} ${op.path})`,
    inputSchema: {
      type: 'object',
      properties: Object.fromEntries(
        Object.entries(op.fields).map(([k, f]) => [k, fieldToJsonSchema(f)])
      ),
      required: op.requiredFields,
    },
  };
}
```

`Cafe24McpBridge.callTool(name, args)` 는 args 를 노드 핸들러의 `fields` 와 동일하게 처리하여 `Cafe24ApiClient` 로 위임 — **노드와 MCP 가 같은 호출 경로를 공유**.

## 6. allowlist 와의 관계

AI Agent `mcpServers[].enabledTools` 가 비어있으면 모든 operation 이 노출. 사용자가 `['product_list', 'product_get']` 로 좁히면 그 둘만 LLM tool 로 노출. UI 는 카테고리 단위 grouping (예: "Product (read 전부)" 체크 → 백엔드는 `['product_list', 'product_get']` 로 저장).

## 7. CHANGELOG

| 일자 | 변경 |
|------|------|
| 2026-05-13 | 신규 컨벤션 — Cafe24 API metadata 의 형식·디렉토리·추가 절차 정의 |
````

---

## §7 변경 — `spec/5-system/11-mcp-client.md`

### §1 개요 — Transport 서술 갱신 (BLOCK 해소 W2)

**현재** (line 16):

```text
- Streamable HTTP (SSE) **단일** transport — stdio·websocket 미지원
```

**변경 후**:

```text
- 외부 서버용 **Streamable HTTP (SSE)** transport (§2.1) + 내부 모듈용 **Internal Bridge** transport (§2.3). stdio·websocket 미지원
```

### §2 Transport — 분류 재구성

**변경 후**: §2 를 transport 카테고리 분류로 재구성. §2.1 외부 HTTP / §2.2 stdio 미지원 / **§2.3 Internal Bridge (신규)**.

```markdown
## 2. Transport

본 클라이언트는 두 종류의 transport 를 지원한다 — **외부 서버용 HTTP transport** 와 **내부 모듈용 Internal Bridge**. 두 transport 모두 `IMcpClient` 인터페이스를 구현하여 AI Agent 핸들러가 차이를 신경 쓰지 않는다.

### 2.1 Streamable HTTP (외부 서버용)

`service_type='mcp'` Integration 에 적용. MCP 의 **Streamable HTTP** transport 만 지원한다.

| 항목 | 동작 |
|------|------|
| 엔드포인트 | Integration `credentials.url` 의 단일 URL — 클라이언트 → 서버는 `POST`, 서버 → 클라이언트는 `GET` + `text/event-stream` |
| 세션 | 서버가 `Mcp-Session-Id` 응답 헤더로 발급하면 이후 모든 요청에 동일 헤더로 echo. 발급되지 않으면 stateless 모드 |
| 프로토콜 버전 | 클라이언트 SDK 가 협상. 서버가 미지원 버전을 거부하면 `INTEGRATION_NOT_CONNECTED` 로 격하 |
| 인증 | HTTP 헤더 (§3.2 `auth_type` 별 매핑) |

### 2.2 stdio 미지원 사유

- 멀티테넌트 백엔드에서 사용자별 subprocess 를 spawn 하는 비용·보안 부담
- 임의 명령 실행 권한 노출 위험
- 워크스페이스 공용 모델과 부정합

향후 데스크톱 bridge agent 등을 통해 우회적으로 stdio 서버를 노출하는 방안은 별도 spec 으로 분리한다.

### 2.3 Internal Bridge (in-process)

**일부 first-party Integration 은 외부 MCP 서버 없이 backend in-process 모듈로 MCP 인터페이스를 노출한다.** 이는 같은 Integration 이 워크플로 노드와 AI Agent 양쪽에서 사용되는 케이스의 표준 패턴이다.

| 항목 | 동작 |
|------|------|
| 적용 service_type | 현재 `cafe24` — 향후 first-party 통합(예: Shopify, Naver Smartstore)이 같은 패턴 사용 가능 |
| 구현 형태 | backend 모듈이 `IMcpClient` 인터페이스를 구현 (예: `Cafe24McpBridge`). HTTP fetch 가 아니라 직접 함수 호출 |
| connect / initialize | no-op — 메모리 안에서 즉시 사용 가능. `capabilities` / `serverInfo` 는 정적 상수 |
| 세션 | 노드 실행 단위 mutex 만 — `Mcp-Session-Id` 헤더 불필요 |
| 인증 | Integration 의 자체 인증 (예: Cafe24 OAuth) 을 그대로 활용. `credentials.url` / `auth_type` 표(§3.2) 는 적용되지 않음 |
| SSRF 검증 | 미적용 — 외부 fetch 가 없음. base URL 의 안전성 검증은 Integration 의 `service_type` 별 로직(예: Cafe24 의 `mall_id` 유효성)이 담당 |
| Rate Limit | Integration 의 자체 wrapper (예: Cafe24 의 `Cafe24ApiClient`) 가 처리. process-level mutex 로 노드 호출과 공유 |

**도구 노출**: §5 의 일반 모델을 그대로 적용. `Cafe24McpBridge.listTools()` 는 Cafe24 메타데이터 테이블에서 자동 생성된 도구 목록 반환 ([Spec Cafe24 §8.1](../4-nodes/4-integration/4-cafe24.md#81-도구-이름-매핑) · [Cafe24 API Metadata 컨벤션](../conventions/cafe24-api-metadata.md)).

**capability 보고**: Internal Bridge 별로 capability 가 다를 수 있다 — Cafe24 는 `tools` 만 보고, `resources` / `prompts` 미보고. AI Agent 는 §5.1 노출 규칙에 따라 메타도구를 생성하지 않는다.

**에러 처리**: §8 의 에러 vocabulary 그대로 적용. Cafe24 의 경우 `tool_result.error` 의 `code` 는 Cafe24 노드 §6 의 vocabulary (`CAFE24_AUTH_FAILED` 등)를 그대로 사용하며, `mcpDiagnostics.errors` 에는 동일하게 누적된다.

> Internal Bridge 도 §8.4 의 인증 실패 자동 status 전환 정책을 따른다 — 401/403 응답 시 `Integration.status = error(auth_failed)` 로 전이.
```

### §3.1 service_type 화이트리스트

**변경 후**: 표 본문은 외부 HTTP transport 한정으로 좁히고, Internal Bridge 추가 명시.

```markdown
### 3.1 service_type / auth_type

본 절(§3) 의 `service_type='mcp'` 와 `auth_type` / `credentials` 스키마는 **외부 HTTP transport (§2.1) 한정**이다. Internal Bridge (§2.3) 로 노출되는 service_type 은 자체 인증 모델을 사용한다 ([§2.3 Internal Bridge](#23-internal-bridge-in-process) 참조).

| 필드 | 값 (외부 HTTP) |
|------|----|
| `Integration.service_type` | `mcp` |
| `Integration.auth_type` | `bearer_token` / `api_key` / `none` |
| `Integration.scope` | 기본 `organization` (개인 등록 미지원) |

**Internal Bridge 적용 service_type** (현재):

| service_type | Bridge 구현 | spec |
|---|---|---|
| `cafe24` | `Cafe24McpBridge` | [Spec Cafe24 §8 AI Agent 노출](../4-nodes/4-integration/4-cafe24.md#8-ai-agent-노출-internal-mcp-bridge) |
```

### §3.2 SSRF 검증 — 외부 HTTP 한정 명시

**변경 후** — 박스 첫 줄에 적용 범위 명시:

```text
> **본 §3.2 의 URL 검증 / SSRF 정책은 외부 HTTP transport (§2.1) 한정.** Internal Bridge (§2.3) 는 외부 fetch 가 없으므로 적용되지 않는다.
>
> `url` 은 **HTTPS 강제** (테스트 연결 시 `https://` 시작 검증, 미충족 시 `MCP_HTTPS_REQUIRED`). 호스트가 다음 중 하나에 해당하면 동일한 코드로 차단된다 (SSRF 방어):
> [...기존 내용...]
```

### §4.1 Lifecycle — Internal Bridge 분기 한 줄

**추가** (§4.1 표 다음 한 줄):

```text
> **Internal Bridge (§2.3)**: connect / `initialize` / close 가 모두 no-op. `buildTools` 는 메모리에서 즉시 메타데이터 테이블 기반 도구 목록 생성. `tools/call` 은 직접 함수 호출. `(integrationId, executionId)` 캐시 규칙은 동일 적용 (Bridge 인스턴스가 같은 execution 내에서 1회 lazy init).
```

### §11 데이터 모델 영향

**변경 후**:

```text
신규 컬럼 / 신규 엔티티 **없음**. [Integration §2.10](../1-data-model.md#210-integration) 의 `service_type` String 컬럼에 다음 값들이 본 spec 의 영역에서 사용된다 — `mcp` (외부 HTTP transport), `cafe24` (Internal Bridge). 두 값 모두 String 컬럼이므로 enum 마이그레이션 불필요.
```

### §12 확장 포인트 — Internal Bridge 패턴

**추가** 한 줄:

```text
- **Internal Bridge 확장**: Shopify, Naver Smartstore 등 first-party 이커머스 통합이 `cafe24` 와 동일한 §2.3 패턴으로 추가 가능. backend 에 `<Service>McpBridge` 모듈 + 메타데이터 테이블을 두고 service_type 화이트리스트(§3.1) 에 추가.
```

---

## §8 변경 — `spec/4-nodes/3-ai/1-ai-agent.md`

### §1 mcpServers 설명

**현재** (table line 25):

```text
| mcpServers | McpServerRef[] | | `[]` | MCP 서버 참조 목록. [공통 §3](./0-common.md#3-mcp-서버-연결-ai-agent-전용) |
```

### 변경 후

```text
| mcpServers | McpServerRef[] | | `[]` | MCP-capable Integration 참조 목록. `service_type ∈ ('mcp', 'cafe24')` 모두 수용 — 후자는 backend `Cafe24McpBridge` 가 in-process `IMcpClient` 로 동작 ([Spec MCP Client §2.3 Internal Bridge](../../5-system/11-mcp-client.md#23-internal-bridge)). [공통 §3](./0-common.md#3-mcp-서버-연결-ai-agent-전용) |
```

### §2 설정 UI — "MCP Servers" 라벨·필터 정책 (BLOCK 해소 W6)

**현재** (line 86~87 부근):

```
│  ── MCP Servers ──                       │
│  [+ Add MCP Server]                      │
```

**변경 후**: UI 다이어그램 변경 + 본문 추가.

```
│  ── MCP Servers ──                       │
│  [+ Add MCP Server]                      │
│   🌐 Generic MCP (HTTP) servers          │
│   🛒 Cafe24 stores (Internal Bridge)     │
```

본문 추가 (§2 다이어그램 다음):

```text
- **"Add MCP Server" 클릭 시 노출되는 후보 목록**: `service_type='mcp'` 와 `service_type='cafe24'` 의 워크스페이스 Integration 을 함께 표시한다 ([Spec 통합 §14.2](../../2-navigation/4-integration.md#142-워크플로우-에디터)). UI 는 두 그룹을 시각적으로 분리:
  - `🌐 Generic MCP (HTTP) servers` — `service_type='mcp'`
  - `🛒 Cafe24 stores (Internal Bridge)` — `service_type='cafe24'`
- 추가 후 행 표시에 Bridge 종류 아이콘(🌐/🛒)을 prefix 로 부착.
- "Add MCP Server" 라벨은 "MCP-capable Integration" 의 의미로 사용 — 라벨 변경 없이 화이트리스트 확장 (사용자 학습 비용 최소화).
```

### 변경 사유 (§8 전체)

- §1: "MCP 서버 참조 목록" 의 ambiguity 제거.
- §2: 동일 셀렉트에 두 service_type 이 보이는 UI 정책을 spec 에 명시 — 후속 frontend 작업의 입력.

---

## §9 변경 — `spec/4-nodes/3-ai/0-common.md`

### §3 MCP 서버 연결

**변경 후**:

```text
## 3. MCP 서버 연결 (AI Agent 전용)

AI Agent 노드는 워크스페이스에 등록된 MCP-capable Integration 을 다중 선택해 도구로 사용한다. MCP-capable 의 범주에는 외부 MCP 서버 (`service_type='mcp'`) 와 backend in-process Internal Bridge 가 노출하는 Integration (`service_type='cafe24'`, 향후 확장 가능)이 모두 포함된다 — [Spec MCP Client §2.3 Internal Bridge](../../5-system/11-mcp-client.md#23-internal-bridge) 참조.

| 필드 | 타입 | 설명 |
|------|------|------|
| mcpServers | McpServerRef[] | 활용할 MCP-capable Integration 목록. `service_type ∈ ('mcp', 'cafe24')` 모두 수용. 서버별로 도구 allowlist·resource/prompt 노출 여부 설정 |
| maxToolCalls | Integer | 최대 도구 호출 횟수 (기본: 10). KB tool · MCP tool · 일반 tool 호출이 모두 합산됨 |

**McpServerRef 구조:**

| 필드 | 타입 | 설명 |
|------|------|------|
| integrationId | UUID | FK → Integration (`service_type ∈ ('mcp', 'cafe24')`). 워크스페이스에 등록된 MCP 서버 (외부 HTTP) 또는 Internal Bridge 적용 first-party Integration |
| enabledTools | String[]? | 일반 도구 allowlist. `['*']` 또는 미설정 = 전체 노출. 메타도구(resources/prompts)에는 영향 없음. Cafe24 의 경우 도구 수가 많아(~180) UI 는 Resource 단위 grouping 으로 노출 |
| includeResources | Boolean? | 서버가 `resources` capability 를 보고할 때 메타도구 노출 여부. 기본 `true`. Cafe24 Internal Bridge 는 `resources` 미보고이므로 무영향 |
| includePrompts | Boolean? | 서버가 `prompts` capability 를 보고할 때 메타도구 노출 여부. 기본 `true`. Cafe24 동일 |
| toolOverrides | { toolName: string; description?: string }[]? | 도구별 description 오버라이드 (이름 변경 불가) |

> 도구 이름·메타도구·실행 모델·에러 격리 정책의 단일 진실 공급원은 [Spec MCP Client](../../5-system/11-mcp-client.md). 본 표는 노드 설정 측면의 요약이다.
```

### §8 캔버스 요약 — `{N} MCP` 카운트 정책 (BLOCK 해소 W7)

**현재** (line 109):

```text
| AI Agent | `{mode} · {model}`. Tool Area에 등록된 도구 수가 있으면 `· {N} tools`, Knowledge Base 연결 시 `· {N} KB`, MCP 서버가 있으면 `· {N} MCP`, 조건이 있으면 `· {N} cond` 추가. ...
```

**변경 후**: `{N} MCP` 의 N 정의를 명시.

```text
| AI Agent | `{mode} · {model}`. Tool Area에 등록된 도구 수가 있으면 `· {N} tools`, Knowledge Base 연결 시 `· {N} KB`, MCP-capable Integration 이 있으면 `· {N} MCP` (외부 MCP server + Internal Bridge integration 합산 — 사용자 입장에서는 모두 "AI 가 호출하는 외부 도구 소스"이므로 카운트 일원화), 조건이 있으면 `· {N} cond` 추가. ...
```

### 변경 사유 (§9 전체)

- §3: 같은 셀렉트가 두 service_type 을 모두 수용한다는 contract 명시.
- §8: `{N} MCP` 가 외부 MCP + Cafe24 Internal Bridge 의 합산임을 spec 으로 박제 — frontend 가 분리 카운트하지 않게.

---

## §10 변경 (신규 — BLOCK 해소 W10) — `spec/3-workflow-editor/4-ai-assistant.md` §4.3.1

### 현재 (line 308 부근의 `pendingUserConfig` 구조 / line 1411 의 Rationale)

`collectPendingUserConfig` 는 비어있는 selector 필드를 수집하면서 widget 별 저장소(integrationRepo / llmConfigRepo / kbRepo / workflowRepo) 를 워크스페이스 스코프로 쿼리해 `candidates` 를 채운다. `mcpServers` widget 의 integrationRepo 쿼리 필터가 service_type 에 어떤 값을 넣는지가 spec 본문에 직접 명시되지 않았으나, ED-AI-39 Rationale 의 함의상 `service_type='mcp'` 가 암시됨.

### 변경 후 — 명시 추가

§4.3.1 의 `pendingUserConfig` 표 또는 표 직후 한 줄 추가:

```text
> **mcpServers widget 의 candidate 쿼리 service_type 필터**: `service_type ∈ ('mcp', 'cafe24')` — Internal Bridge ([Spec MCP Client §2.3](../5-system/11-mcp-client.md#23-internal-bridge)) 가 적용된 Cafe24 Integration 도 후보로 노출되어야 한다. 향후 Internal Bridge 적용 service_type 이 늘면 동시에 갱신. 출처: [Spec 통합 §14.2](../2-navigation/4-integration.md#142-워크플로우-에디터) (`serviceTypes` prop 화이트리스트의 single source of truth).
```

### 변경 사유

- Workflow AI Assistant 가 mcpServers 후보를 채워주는 흐름에서 cafe24 가 누락되면 사용자가 Cafe24 Integration 을 등록해놓고도 AI Assistant 가 그것을 후보로 제안하지 못함 → 실 사용성 저하.

---

## Rationale 통합

- `spec/4-nodes/4-integration/4-cafe24.md` §9 Rationale — 본 draft §5 마지막 절에 포함.
- `spec/5-system/11-mcp-client.md` — 별도 `## Rationale` 추가 안 함. §2.3 본문 안에 inline.
- `spec/2-navigation/4-integration.md` — 별도 `## Rationale` 추가 안 함. §3.2 본문 안에 inline.

---

## 영향 분석 / 마이그레이션 / 후속

### 데이터 마이그레이션

- **불필요**. `Integration.service_type` 은 String 컬럼이며 `'cafe24'` 값은 마이그레이션 없이 INSERT 가능.
- `Node.type` 도 String 컬럼 가정 (현 spec §2.6 에 enum 으로 명시되나 실제 DB 컬럼은 String — backend schema 확인 필요. 만약 PostgreSQL enum 이면 별도 ALTER TYPE 마이그레이션 필요 → implementation plan 에서 처리).
- 기존 `mcp` Integration 의 동작은 영향 없음 — §3.1 화이트리스트 확장만 일어남.

### 후속 implementation 산출물 (현 spec 작업 범위 외)

별도 worktree (`.claude/worktrees/cafe24-implementation-<slug>/`) 에서 새 plan 으로 진행:

1. **Backend**:
   - `backend/src/integrations/cafe24/oauth-provider.ts` — Cafe24 OAuth (begin / callback / refresh)
   - `backend/src/integrations/cafe24/cafe24-api-client.ts` — rate-limit-aware wrapper
   - `backend/src/integrations/cafe24/cafe24-mcp-bridge.ts` — `IMcpClient` 구현
   - `backend/src/nodes/integration/cafe24/cafe24.schema.ts` + `cafe24.handler.ts`
   - `backend/src/nodes/integration/cafe24/metadata/*.ts` — 18 카테고리 메타데이터
   - `Node.type` 컬럼이 PostgreSQL enum 이면 ALTER TYPE ADD VALUE 'cafe24' 마이그레이션
2. **Frontend**:
   - `/integrations/new` Step 2 폼 — mall_id + app_type + scope 카테고리
   - `cafe24` 노드 설정 패널 — Resource/Operation/Fields 동적 폼
   - AI Agent mcpServers 셀렉트 → service_type 화이트리스트 확장 (Generic/Cafe24 그룹 분리)
   - allowlist UI Resource grouping
   - Workflow AI Assistant `collectPendingUserConfig` 의 mcpServers 후보 쿼리 service_type 필터 갱신
3. **테스트**:
   - Cafe24 sandbox / 모킹 전략 (공식 sandbox 없으면 fixture 응답 기반)
   - e2e: 등록 → 호출 → 토큰 만료 → 재인증 → MCP 도구 호출

### Phase 2/3 (별도 plan)

- Phase 2: Cafe24 Webhook → Trigger 노드 새 source
- Phase 3: Cafe24 외 first-party 이커머스 통합 (Shopify 등) — 본 spec 의 §2.3 Internal Bridge 패턴 재사용

---

## consistency-check 입력 종료 (v2)

본 draft 의 모든 §1~§10 변경안은 한 묶음으로 spec write 직전에 `/consistency-check --spec` 의 입력이 된다. v2 는 v1 의 BLOCK (Critical 2 + Warning 11) 을 반영하여 보강됨.
