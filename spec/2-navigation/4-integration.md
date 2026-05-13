# Spec: 통합 관리 화면

> 관련 문서: [PRD 내비게이션](./_product-overview.md#34-integration-통합) · [PRD 통합/연동](../4-nodes/4-integration/_product-overview.md) · [Spec 레이아웃](./_layout.md) · [데이터 모델 - Integration](../1-data-model.md#210-integration) · [데이터 모델 - IntegrationUsageLog](../1-data-model.md#2101-integrationusagelog) · [PRD 노드 시스템 §Integration 노드](../4-nodes/_product-overview.md#7-integration-노드-3종)

---

## 1. 라우트 구성

| 경로 | 설명 |
|------|------|
| `/integrations` | 연동 목록 (기본 진입점) |
| `/integrations/new?service=<type>&step=auth` | 연동 추가 위저드 — Step 1(서비스 선택)은 목록 모달에서 처리, Step 2(인증)부터 이 페이지로 진입 |
| `/integrations/[id]` | 상세 페이지 |

**설계 배경**: 서비스 선택 같은 가벼운 단계는 목록의 모달로 진입 비용을 낮추고, OAuth 팝업 복귀·딥링크가 필요한 인증 단계부터는 독립 라우트에서 상태를 복원한다.

---

## 2. 목록 페이지 (`/integrations`)

### 2.1 화면 구조

```
┌─────────────────────────────────────────────────────────┐
│  Integrations                    [+ Add Integration]    │
│                                                         │
│  ⚠ 3 integrations need attention  (expiring / error)   │
│                                                         │
│  ┌──────────────────┐  ┌──────────────────┐             │
│  │ 🔍 Search...     │  │ Scope: All ▼     │             │
│  └──────────────────┘  └──────────────────┘             │
│  [All] [Google] [GitHub] [HTTP] [DB] [Email] [Webhook]
│  [All] [Connected] [Expiring] [Expired] [Error]         │
│                                                         │
│  Organization                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ 🟢 Google - Team Account      OAuth2   Connected      ⋮ │ │
│  │ 🟡 Google - Drive        OAuth2   Expires in 2d  ⋮ │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                         │
│  Personal                                               │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ 🔴 GitHub - My Account   OAuth2   Auth failed    ⋮ │ │
│  │ 🟢 HTTP - Internal API   API Key  Connected      ⋮ │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 2.2 항목 요소

| 요소 | 설명 |
|------|------|
| 상태 아이콘 | 🟢 connected / 🟡 expiring(7일 이내)·expired / 🔴 error(reason) |
| 서비스 아이콘 | 서비스 유형별 로고 |
| 별칭 | 사용자가 지정한 이름 (`Integration.name`) |
| 인증 유형 | auth_type을 대문자/공백 정리하여 표시 (`OAuth2`, `API Key`, `Bearer Token`, `Basic`, `Connection String`, `SMTP`, `Webhook Outbound`). `service_type='mcp'` 인 경우 `MCP Server`, `service_type='cafe24'` 인 경우 `Cafe24` 로 별도 라벨 |
| 상태 텍스트 | `Connected` / `Expires in Nd` / `Expired` / `Error: <reason>` |
| Scope 섹션 | Organization / Personal 2개 섹션. 각 섹션 내 최신 생성순 정렬 |
| 더보기(⋮) | 상세 열기, 연결 테스트, 재인증(OAuth), 삭제(차단 시 비활성) |

### 2.3 검색·필터

| 컨트롤 | 동작 |
|--------|------|
| 검색 입력 | 별칭(`name`) ILIKE 부분 일치 |
| Scope 셀렉트 | `All` / `Personal` / `Organization` |
| 서비스 유형 칩 | 다중 선택 가능. 선택 없음 = 전체 |
| 상태 칩 | `All` / `Connected` / `Expiring` (7일 이내) / `Expired` / `Error`. 단일 선택 |

모든 필터는 URL 쿼리 파라미터(`q`, `scope`, `serviceType`, `status`)로 동기화되어 공유/새로고침 시 복원된다.

### 2.4 "Need attention" 배너

- 조건: `status IN (expired, error)` OR `token_expires_at <= now() + 7d`
- 클릭 시 상태 필터를 `Expiring | Expired | Error`로 자동 전환
- 배너는 해당 조건의 연동이 0건이면 비표시

### 2.5 Add Integration 모달 (Step 1)

```
┌─────────────────────────────────────────┐
│  Add Integration — Select a service     │
│                                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │ Google  │ │ GitHub  │ │ Cafe24  │   │
│  └─────────┘ └─────────┘ └─────────┘   │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │  HTTP   │ │Database │ │  Email  │   │
│  └─────────┘ └─────────┘ └─────────┘   │
│  ┌─────────┐ ┌─────────┐                │
│  │ Webhook │ │   MCP   │                │
│  └─────────┘ └─────────┘                │
└─────────────────────────────────────────┘
```

> 정렬: first-party 서비스(Google/GitHub/Cafe24) → 범용(HTTP/Database/Email/Webhook) → 도구 확장(MCP).

- 카드 클릭 시 `/integrations/new?service=<type>&step=auth` 로 라우팅. 모달은 자동 닫힘.
- 모달은 목록 페이지 상단에서만 열림 (키보드 `N` 단축키 허용).

---

## 3. 추가 페이지 (`/integrations/new`)

### 3.1 상태 기계

쿼리 파라미터 `step` 값으로 단계를 제어한다.

```
Step 2 auth     ──submit──▶ Step 3 test
  (폼 채움)                    (자동 실행)
     ▲                            │
     │                         success
     │                            ▼
     └───── edit/retry ──── Step 4 save
                              │
                           saved → /integrations/[id]
```

### 3.2 Step 2: 인증 정보 입력

좌측 헤더에 `← Back to list` / 서비스 로고·이름 / Step 진행 표시(`2 / 3`)를 배치한다. 입력 폼은 §5 서비스별 스키마를 따른다.

**공통 필드**
| 필드 | 필수 | 설명 |
|------|------|------|
| `name` | ✓ | 별칭. 워크스페이스 내 유일 |
| `scope` | ✓ | Personal / Organization (팀 워크스페이스일 때). Admin이 아니면 Organization 비활성 |

**OAuth2 흐름 (Google/GitHub)**
1. 사용자가 scope 체크박스로 권한 범위 선택 (§5 참조)
2. `[Connect with <Service>]` 클릭 → 백엔드 `POST /api/integrations/oauth/begin`으로 state 발급
3. 신규 팝업(600×700)으로 OAuth authorize URL 오픈
4. 팝업 콜백 페이지(`/api/integrations/oauth/callback/:provider`)가 토큰을 저장 후 `postMessage`로 부모창 알림
5. 부모창은 Step 3로 자동 전이

**OAuth2 흐름 (Cafe24)** — `mall_id` 가 base URL 의 일부이고 authorize URL 도 mall 별로 다르므로 폼 흐름이 Google/GitHub 와 다르다.

1. **사전 입력** (OAuth 버튼 누르기 전 필수):
   - `Mall ID` (예: `myshop` — `https://myshop.cafe24api.com` 의 hostname prefix). 형식: `/^[a-z0-9-]{3,50}$/` ([§5.8 credentials JSONB](#58-cafe24) validation rule).
   - `App type` 라디오: **Public** (Cafe24 앱스토어 공개 앱, 우리 서버 env 의 client_id/secret 사용) / **Private** (사용자가 자기 쇼핑몰 관리자에서 비공개 앱을 만들고 client_id/secret 을 직접 입력).
   - `App type = Private` 선택 시 `client_id`, `client_secret` 입력란이 폼에 추가 표시.
2. **Scope 카테고리 프리셋** (체크박스, 카테고리 단위): Product (R/W), Order (R/W), Customer (R/W), Category (R/W), Promotion (R/W), Mileage (R/W), Shipping (R/W), Salesreport (R), Translation (R/W), Notification (R/W), 기타 카테고리는 "고급" 토글 아래. 각 체크박스가 Cafe24 scope (`mall.read_<category>` / `mall.write_<category>`) 와 매핑.
3. **[Connect with Cafe24]** 클릭 → 백엔드 `POST /api/integrations/oauth/begin` 호출. body:
   ```jsonc
   {
     "service": "cafe24",
     "mode": "new",                  // 'new' | 'reauthorize' | 'request-scopes' — §10.2 분기 필수
     "mall_id": "myshop",            // cafe24 한정 필수
     "app_type": "public",           // cafe24 한정 필수: 'public' | 'private'
     "client_id":     "...",         // app_type='private' 시 필수
     "client_secret": "...",         // app_type='private' 시 필수
     "scopes": ["mall.read_product", "mall.write_order", "..."],
     "integrationId": "..."          // mode != 'new' 시 (reauthorize/request-scopes)
   }
   ```
   응답으로 mall 별 authorize URL 수신.
4. 신규 팝업(600×700)으로 `https://{mall_id}.cafe24api.com/api/v2/oauth/authorize?...` 오픈.
5. 팝업 콜백 페이지(`/api/integrations/oauth/callback/cafe24`)가 토큰 저장 후 `postMessage` 로 부모창 알림.
6. 부모창은 Step 3 로 자동 전이.

> **사전 입력 → preview_token**: `app_type='private'` 의 `client_id`/`client_secret`, 그리고 `mall_id` 는 OAuth 시작 시점부터 우리 서버의 임시 저장소(`oauth_preview`, TTL 10분) 에 보관되어 콜백 처리에서 활용된다 — token 교환 endpoint (§10.3) 가 `mall_id` 의존이므로 callback 흐름이 이 값을 읽어야 한다.

**비OAuth 흐름**
- 모든 필드를 폼에 입력 후 `[Continue]`로 Step 3로 전이

### 3.3 Step 3: 연결 테스트

- 자동으로 `POST /api/integrations/preview-test`를 호출 (DB 저장 없이 메모리상 자격 증명으로 검증)
- OAuth의 경우 팝업에서 이미 토큰 교환이 완료되었으므로 실제 API 핑(`/me` 또는 서비스별 동등 엔드포인트)
- 성공 시 `[Save integration]` 버튼 활성화
- 실패 시 에러 메시지 표시 + `[Back to auth]` 버튼으로 Step 2 복귀, 입력값은 유지

### 3.4 Step 4: 저장

- `POST /api/integrations`로 생성 요청 (OAuth는 토큰이 이미 서버 측 임시 저장소에 있고, `preview_token`만 전달)
- 성공 시 `/integrations/[id]`로 리다이렉트 + 토스트 `Integration created`
- 실패 시 폼은 Step 3 상태 유지

### 3.5 OAuth 팝업 복귀 처리

- 부모창이 `window.addEventListener('message', ...)`로 `oauth_callback` 이벤트 수신
- `integrationPreviewId`(DB 저장 전 임시 식별자)를 받아 Step 3 자동 진입
- 팝업이 5분 내 복귀하지 않으면 타임아웃 에러 표시, 사용자는 재시도 가능

### 3.6 이탈·복원

- 페이지 새로고침 시 쿼리 파라미터에서 `service`, `step`을 복원. 입력한 자격 증명은 보안상 복원하지 않고 Step 2로 리셋.
- `beforeunload`에서 입력 중인 자격 증명이 있으면 경고.

---

## 4. 상세 페이지 (`/integrations/[id]`)

### 4.1 레이아웃

```
┌──────────────────────────────────────────────────────────────┐
│ ← Back to integrations                                       │
│                                                              │
│ 🟢 Google - Team Account                                          │
│ OAuth2 · Organization · Connected · Last used 2m ago         │
│ Created by @alice, 2026-03-01                                │
│ ───────────────────────────────────────────────────────────  │
│                                                              │
│ [Overview] [Security] [Scope & Permissions] [Usage] [Activity] [Danger zone]
│                                                              │
│ (선택 탭 내용)                                                │
└──────────────────────────────────────────────────────────────┘
```

헤더 아래 탭(앵커 기반 `#security`, `#usage`, …)으로 섹션을 스위치한다.

### 4.2 Overview 탭

| 요소 | 설명 |
|------|------|
| 기본 정보 | 서비스, 별칭, 생성자, 생성·수정일, 마지막 사용 시각, 마지막 회전 시각, 토큰 만료 시각 |
| Quick actions | `Test connection`, `Reauthorize`(OAuth), `Rotate credentials`(비OAuth), `Edit alias` |
| 상태 배지 | 현재 상태 + reason (`error(insufficient_scope)` 등) |
| 별칭 편집 | 인라인 편집, `PATCH /api/integrations/:id` |

### 4.3 Security 탭

| 블록 | 설명 |
|------|------|
| Authentication | `auth_type` 표시 + 현재 보유 자격 증명 메타 (예: `Token preview: xoxb-****4f2a`) — 원본 값은 복호화해 보여주지 않음 |
| Reauthorize (OAuth) | `[Reauthorize]` 버튼 → `POST /api/integrations/:id/reauthorize`에서 authUrl 수신 → 팝업 OAuth → 성공 시 상태 `connected` 복귀 |
| Rotate credentials (비OAuth) | 인플레이스 폼. 기존 값은 마스킹, 토글로 교체 폼 오픈 → 새 값 입력 → `POST /api/integrations/:id/rotate` (내부적으로 연결 테스트 → 성공 시에만 commit). 실패 시 기존 자격 증명 유지 |
| Last rotated | `last_rotated_at` 상대 시간 + 절대 시간 |

비OAuth rotate 폼의 필드는 §5 서비스 스키마와 동일. 서버는 테스트 성공 전까지 기존 credentials JSON을 건드리지 않는다.

### 4.4 Scope & Permissions 탭 (OAuth 한정)

| 요소 | 설명 |
|------|------|
| 현재 scope 목록 | `credentials.scopes[]` 전체를 체크된 상태로 표시 |
| 권장 scope 목록 | 서비스별 프리셋. 현재 scope에 없는 항목은 체크 해제 상태 |
| 누락 scope 배지 | `status_reason = insufficient_scope`일 때 누락 scope 목록을 빨간 뱃지로 강조 |
| `[Request scopes]` 버튼 | 체크된 추가 scope와 함께 `POST /api/integrations/:id/request-scopes` 호출 → 반환된 authUrl 팝업 → 성공 시 credentials.scopes 병합 |

비OAuth 연동에서는 이 탭이 숨겨진다.

### 4.5 Usage 탭

```
Used by 3 nodes across 2 workflows

┌────────────────────────────────────────────────────────────┐
│ Workflow A (Active)                                        │
│  └─ Send Email message  (node id: abc)  [Open in editor →] │
│  └─ Lookup Google user   (node id: def)  [Open in editor →] │
│                                                            │
│ Workflow B (Inactive)                                      │
│  └─ Notify on failure   (node id: ghi)  [Open in editor →] │
└────────────────────────────────────────────────────────────┘
```

- 데이터 출처: `GET /api/integrations/:id/usages`
- 활성/비활성 무관하게 포함
- "Open in editor" 링크는 워크플로우 에디터 URL + 해당 노드 선택 상태로 진입

### 4.6 Recent activity 탭

```
Last 7 days: 124 calls · 98% success
(일별 호출 수 스파크라인 차트)

Recent calls (latest 20)
┌──────────────────┬──────────────┬────────────┬──────┬─────┐
│ At               │ Workflow     │ Node       │ ✓/✗  │ ms  │
├──────────────────┼──────────────┼────────────┼──────┼─────┤
│ 14:03 Apr 11     │ Workflow A   │ Email-send │  ✓   │ 412 │
│ 13:55 Apr 11     │ Workflow B   │ Google-fetch│  ✗   │ 1203│
└──────────────────┴──────────────┴────────────┴──────┴─────┘
```

- 데이터 출처: `GET /api/integrations/:id/activity?limit=20&days=7`
- 실패 행 클릭 시 에러 요약 팝오버 표시 + `Execution detail →` 링크

### 4.7 Danger zone 탭

- `[Delete integration]` 버튼
- 클릭 시 `GET /api/integrations/:id/usages`를 확인하여
  - 사용처 0건: 확인 다이얼로그 → `DELETE /api/integrations/:id`
  - 사용처 ≥ 1건: 삭제 **차단** 다이얼로그에 사용처 목록과 안내 메시지 표시 (§7)
- Personal ↔ Organization 전환도 이 탭에서 노출 (Admin만). 확인 다이얼로그 문구 §4.8.

### 4.8 Scope 전환 다이얼로그

```
⚠ Change scope from Personal to Organization?

기존 OAuth 토큰이 워크스페이스 전체 멤버에게
그대로 승계됩니다. 공유해도 문제가 없는 권한인지
확인해 주세요.

[취소]  [Change to Organization]
```

- API: `PATCH /api/integrations/:id/scope` (Admin만)
- 전환 후 감사 로그(AuditLog `integration.scope_changed`) 기록

---

## 5. 서비스별 인증 스키마

모든 스키마는 `Integration.credentials` JSONB에 저장된다. 민감 필드는 `write-only` — API 응답에서 마스킹된 프리뷰만 반환한다.

### 5.1 Google (OAuth2)

| 필드 | 타입 | 필수 | 비밀 |
|------|------|------|------|
| `scopes` | string[] | ✓ | × |
| `access_token` | string | ✓ | 🔒 |
| `refresh_token` | string | ✓ | 🔒 |
| `account_email` | string | ✓ | × |

scope는 서비스 번들 체크박스로 노출:

| 번들 | scope 값 |
|------|---------|
| Drive | `https://www.googleapis.com/auth/drive` |
| Sheets | `https://www.googleapis.com/auth/spreadsheets` |
| Gmail | `https://www.googleapis.com/auth/gmail.send` |
| Calendar | `https://www.googleapis.com/auth/calendar` |

테스트 방법: `tokeninfo` 엔드포인트 또는 선택된 첫 번들의 `/about` 핑.

### 5.2 GitHub

GitHub는 2개 `auth_type`을 선택 가능.

**OAuth2**
| 필드 | 타입 | 필수 | 비밀 |
|------|------|------|------|
| `scopes` | string[] | ✓ | × |
| `access_token` | string | ✓ | 🔒 |
| `login` | string | ✓ | × |

권장 scope: `repo`, `read:org`. 추가 옵션: `workflow`, `gist`.

**Personal Access Token (PAT)**
| 필드 | 타입 | 필수 | 비밀 |
|------|------|------|------|
| `token` | string | ✓ | 🔒 |

테스트: `GET https://api.github.com/user`.

### 5.3 HTTP/REST

`auth_type`을 `none` / `api_key` / `bearer` / `basic` 중 선택.

| 공통 필드 | 타입 | 필수 | 비고 |
|-----------|------|------|------|
| `base_url` | string | | 빈 값이면 노드 설정에서 URL 전체를 지정 |
| `default_headers` | Record<string,string>? | | 공용 헤더 |

**api_key**
| 필드 | 타입 | 필수 | 비밀 |
|------|------|------|------|
| `location` | enum `header` \| `query` | ✓ | × |
| `key_name` | string | ✓ | × |
| `value` | string | ✓ | 🔒 |

**bearer**
| 필드 | 타입 | 필수 | 비밀 |
| `token` | string | ✓ | 🔒 |

**basic**
| 필드 | 타입 | 필수 | 비밀 |
| `username` | string | ✓ | × |
| `password` | string | ✓ | 🔒 |

테스트: `base_url` 존재 시 `GET base_url`(혹은 사용자가 지정한 `test_path`) 200 기대. 미지정이면 테스트 단계를 건너뛰고 경고 배너.

### 5.4 Database

| 필드 | 타입 | 필수 | 비밀 |
|------|------|------|------|
| `driver` | enum `postgres` \| `mysql` | ✓ | × |
| `host` | string | ✓ | × |
| `port` | int | ✓ | × |
| `database` | string | ✓ | × |
| `username` | string | ✓ | × |
| `password` | string | ✓ | 🔒 |
| `ssl` | enum `disable` \| `require` \| `verify-full` | ✓ | × |

테스트: 연결 후 `SELECT 1` 실행. 실패 시 드라이버별 에러 메시지를 `error.code`에 정규화(`auth_failed`, `network`, `unknown`).

### 5.5 Email (SMTP)

| 필드 | 타입 | 필수 | 비밀 |
|------|------|------|------|
| `host` | string | ✓ | × |
| `port` | int | ✓ | × |
| `secure` | enum `none` \| `starttls` \| `tls` | ✓ | × |
| `username` | string | ✓ | × |
| `password` | string | ✓ | 🔒 |
| `default_from` | string | ✓ | × |

테스트: SMTP 핸드셰이크 + `NOOP` 명령. 실제 메일은 전송하지 않음.

### 5.6 MCP Server

AI Agent 노드가 활용하는 외부 [Model Context Protocol](https://modelcontextprotocol.io) 서버를 워크스페이스에 등록한다. 워크플로 노드로는 직접 노출되지 않으며, AI Agent 의 `mcpServers` 설정에서 참조된다 — 상세 동작·도구 노출 모델은 [Spec MCP Client](../5-system/11-mcp-client.md).

`auth_type`: `bearer_token` / `api_key` / `none` 중 선택.

**공통 필드**

| 필드 | 타입 | 필수 | 비밀 | 비고 |
|------|------|------|------|------|
| `url` | string | ✓ | × | Streamable HTTP 엔드포인트. **`https://` 강제** |
| `default_headers` | Record<string,string>? | | × | 모든 요청에 추가될 헤더 |

**bearer_token**

| 필드 | 타입 | 필수 | 비밀 |
|------|------|------|------|
| `token` | string | ✓ | 🔒 |

→ `Authorization: Bearer <token>` 자동 주입.

**api_key**

| 필드 | 타입 | 필수 | 비밀 |
|------|------|------|------|
| `header_name` | string | ✓ | × |
| `value` | string | ✓ | 🔒 |

→ `<header_name>: <value>` 자동 주입.

**none**

추가 필드 없음. 인증 없는 공용 MCP 서버용.

**테스트**: connect → MCP `initialize` 호출 → `capabilities` 와 `serverInfo` 수신. 성공 시 응답에 `{ capabilities, serverInfo, preview: { toolCount, resourceSupported, promptSupported } }` 포함하여 등록 후 노드 설정 UI 의 미리보기에 활용 ([Spec MCP Client §9](../5-system/11-mcp-client.md#9-연결-테스트-test-connection)).

> MCP 서버는 OAuth refresh token 을 보유하지 않으므로 `token_expires_at` 가 없고, 본 spec §11 만료 스캐너의 임계치 알림 흐름은 적용되지 않는다. 인증 실패(401/403)는 노드 실행 시점에 `error(auth_failed)` 로 격하되며 사용자가 rotate 를 통해 토큰을 교체한다.

### 5.7 Webhook (Outbound)

| 필드 | 타입 | 필수 | 비밀 |
|------|------|------|------|
| `url` | string | ✓ | × |
| `method` | enum `POST` \| `PUT` \| `PATCH` | ✓ | × (기본 `POST`) |
| `default_headers` | Record<string,string>? | | × |
| `signing_secret` | string? | | 🔒 |
| `signature_header` | string? | | × (기본 `X-Signature`) |

- `signing_secret` 지정 시 호출 페이로드를 HMAC-SHA256으로 서명해 `signature_header`에 첨부
- Inbound 수신 URL은 Trigger(type=webhook)에서 별도로 관리 — 본 연동과 공유하지 않음 (PRD INT-WH-02)

테스트: `url`에 빈 본문으로 헤드 요청(`HEAD`), 허용 안 될 경우 `POST {}` → 2xx/3xx 기대.

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
| `mall_id` | string | ✓ | × | Cafe24 쇼핑몰 식별자. base URL `https://{mall_id}.cafe24api.com/api/v2/admin/...` 구성. **Validation**: `/^[a-z0-9-]{3,50}$/` (소문자 영숫자·하이픈, 3~50자) — Cafe24 mall_id 자체 규약 + SSRF 방어 (다른 호스트 주입 차단) |
| `app_type` | enum `public` \| `private` | ✓ | × | Cafe24 앱 발급 형태. `public` = Cafe24 앱스토어 등록 앱(우리 env client_id/secret), `private` = 사용자가 자기 쇼핑몰 관리자에서 만든 비공개 앱 |
| `client_id` | string | `app_type='private'` 시 ✓ | × | Private 앱의 OAuth client_id |
| `client_secret` | string | `app_type='private'` 시 ✓ | 🔒 | Private 앱의 OAuth client_secret |
| `access_token` | string | ✓ | 🔒 | OAuth access token (2시간 유효) |
| `refresh_token` | string | ✓ | 🔒 | OAuth refresh token (14일 유효) |
| `scopes` | string[] | ✓ | × | 사용 권한 scope. `mall.read_<category>` / `mall.write_<category>` 형식 |
| `expires_at` | ISO8601 | ✓ | × | `access_token` 만료 시각. `Integration.token_expires_at` 컬럼과 §10.5 의 원자 갱신 정책으로 동기화 |
| `cafe24_operator_id` | string | ✓ | × | 토큰을 발급받은 Cafe24 운영자의 식별 (Cafe24 응답 body 의 `user_id` 값을 본 필드에 매핑 저장 — 내부 `User.id` UUID 와의 혼동 회피 위해 별도 명명) |

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

**Rate Limit 정책**: Cafe24 leaky bucket. 응답 헤더 `X-Cafe24-Call-Remain`(재개까지 초), `X-Cafe24-Call-Usage`(%), `X-Api-Call-Limit`(현재/상한) 을 backend `Cafe24ApiClient` wrapper 가 모니터링. 429 응답 시 `X-Cafe24-Call-Remain` 값만큼 sleep 후 최대 2회 재시도. 노드 호출 / AI Agent MCP 호출 모두 같은 wrapper 를 통과해 동일 프로세스 인스턴스 내 Integration 단위로 leaky bucket 공유 — 같은 Integration 을 동시에 헤비하게 쓰면 양쪽이 함께 대기한다. 멀티 인스턴스 환경의 직렬화는 보장되지 않음 ([Spec Cafe24 §4.1](../4-nodes/4-integration/4-cafe24.md#41-rate-limit-처리-상세) 참조).

**AI Agent 노출**: `service_type='cafe24'` Integration 은 AI Agent 의 `mcpServers` 셀렉트에서도 선택 가능하며, 선택 시 백엔드의 `Cafe24McpBridge` 가 in-process `IMcpClient` 로 동작해 18 카테고리의 Resource × Operation 을 MCP tool 로 노출한다. 도구 이름·allowlist 규약은 [Spec MCP Client §5](../5-system/11-mcp-client.md#5-도구-노출-모델) 그대로. 상세는 [Cafe24 노드 spec §"AI Agent 노출"](../4-nodes/4-integration/4-cafe24.md#8-ai-agent-노출-internal-mcp-bridge).

---

## 6. 상태 전이

```
          ┌─────────────────────────────┐
          ▼                             │
     [connected] ──expire──▶ [expired] ──reauthorize success──┐
          │                       │                            │
          │                       └──rotate success────────────┤
       call fails                                               │
          │                                                     │
          ▼                                                     │
     [error(reason)] ──rotate/reauthorize success──────────────┘
```

| 전이 | 트리거 이벤트 |
|------|--------------|
| connected → expired | 매일 스캐너 또는 노드 실행 중 토큰 갱신 실패 (refresh fail) |
| connected → error(auth_failed) | 노드 실행 중 401/403 |
| connected → error(insufficient_scope) | 노드 실행 중 403 + 서비스별 `missing_scope` 시그널 |
| connected → error(network) | 노드 실행 중 커넥션 실패가 3회 연속 |
| expired/error → connected | `reauthorize` 또는 `rotate` 성공 (연결 테스트 통과) |

`error` 상태에서는 `status_reason` 컬럼에 기계 판독 가능 값을 기록한다.

---

## 7. 사용처 추적 및 삭제 차단

### 7.1 사용처 조회 로직

- `GET /api/integrations/:id/usages`는 모든 워크플로우의 `Node.config`를 JSONB path 조회 (`config->>'integrationId' = :id`)
- 결과는 워크플로우 단위로 그룹화 `{ workflowId, workflowName, isActive, nodes: [{ id, label, type }] }[]`
- 응답에는 사용자가 볼 수 있는 워크스페이스의 워크플로우만 포함

### 7.2 삭제 차단 다이얼로그

```
Cannot delete "Google - Team Account"

This integration is still referenced by the following nodes:

Workflow A (Active)
  • Send Email message   (node id: abc)
  • Lookup Google user    (node id: def)
Workflow B (Inactive)
  • Notify on failure    (node id: ghi)

Please replace or remove these node references first.

[Close]   [Open Workflow A →]
```

- 서버 측 `DELETE /api/integrations/:id`도 동일 조건을 검증하여 409 Conflict 반환
- 응답 body: `{ code: 'INTEGRATION_IN_USE', usages: [...] }`

### 7.3 만료·에러 상태의 에디터 경고

연동이 `expired` 또는 `error`로 전이되면, 이를 참조하는 모든 노드는 워크플로우 에디터에서 경고 뱃지(🟡/🔴)와 툴팁 "Integration needs attention — open settings" 표시. 노드 설정 패널에서 상세 페이지로의 바로가기 링크 제공.

---

## 8. 권한 규칙

| 액션 | Personal | Organization |
|------|----------|-------------|
| 생성 | 모든 멤버 | Admin 이상 |
| 조회 | 본인 것만 | 모든 멤버 |
| 수정 (별칭) | 본인 것만 | Admin 이상 |
| Reauthorize | 본인 것만 | Admin 이상 |
| Rotate | 본인 것만 | Admin 이상 |
| Scope 추가 요청 | 본인 것만 | Admin 이상 |
| Personal↔Organization 전환 | — | Admin 이상 |
| 삭제 | 본인 것만 (사용처 없을 때) | Admin 이상 (사용처 없을 때) |
| 워크플로우 노드에서 사용 | 본인 것만 | 모든 멤버 |

---

## 9. API

### 9.1 목록·CRUD

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/integrations` | 목록 조회. 쿼리: `q`, `scope`, `serviceType`, `status`, `page`, `limit`. 페이지네이션 응답 형식은 [API 규약 §5.2](../5-system/2-api-convention.md#52-목록-응답) 준수 |
| POST | `/api/integrations` | 연동 생성. OAuth는 `preview_token`으로 서버 임시 저장 토큰 참조 |
| GET | `/api/integrations/:id` | 상세 조회 (credentials는 마스킹) |
| PATCH | `/api/integrations/:id` | 별칭 등 메타 수정 |
| DELETE | `/api/integrations/:id` | 삭제 (사용처 있으면 409) |
| POST | `/api/integrations/:id/test` | 현재 저장된 자격 증명으로 연결 테스트 |
| GET | `/api/integrations/services` | 지원 서비스 메타데이터 (필드 스키마 포함) |

### 9.2 인증 / 회전 / Scope

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/integrations/oauth/begin` | OAuth 시작 — state 발급, authUrl 반환. body: `{ service, scopes[], mode: 'new'\|'reauthorize'\|'request-scopes', integrationId? }`. **`service='cafe24'` 시 추가 필수 필드**: `mall_id`, `app_type: 'public'\|'private'`. `app_type='private'` 시 `client_id`, `client_secret` 추가 필수. body 의 cafe24 한정 필드들은 `oauth_preview` 임시 저장소(TTL 10분)에 함께 보관되어 callback (§10.2) 에서 token 교환에 사용된다 |
| GET | `/api/integrations/oauth/callback/:provider` | OAuth 콜백 (§10) |
| POST | `/api/integrations/preview-test` | 저장 전 인증 정보로 연결 테스트. body: `{ service, authType, credentials }` |
| POST | `/api/integrations/:id/reauthorize` | OAuth 재인증 authUrl 발급 |
| POST | `/api/integrations/:id/rotate` | 비OAuth 자격 증명 교체. body: 신규 credentials 객체. 내부적으로 테스트 → 성공 시만 커밋 |
| POST | `/api/integrations/:id/request-scopes` | 추가 scope 요청. body: `{ scopes: string[] }` → authUrl 반환 |
| PATCH | `/api/integrations/:id/scope` | Personal ↔ Organization 전환 (Admin) |

### 9.3 사용처·활동

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/integrations/:id/usages` | 사용 중 워크플로우·노드 목록 |
| GET | `/api/integrations/:id/activity` | 최근 호출 이력. 쿼리: `limit`(기본 20, 최대 100), `days`(기본 7, 최대 30). 응답: `{ items[], summary: { totalCalls, successRate, dailyCounts[] } }` |

### 9.4 공통 응답 포맷

- 성공: `{ data: ... }` 또는 `{ data: ..., pagination: ... }` (기존 컨벤션 준수)
- 실패: `{ code, message, details? }`
  - `INTEGRATION_IN_USE` (409) — 삭제 차단
  - `INTEGRATION_TEST_FAILED` (422) — 연결 테스트 실패
  - `OAUTH_STATE_MISMATCH` (400)
  - `OAUTH_CONFIG_MISSING` (500)
  - `INSUFFICIENT_SCOPE` (403) — 노드 실행 중 감지 시 `Integration.status`도 갱신

---

## 10. OAuth 콜백 엔드포인트

Integration의 OAuth 인증 플로우에서 외부 제공자가 인증 완료 후 콜백하는 엔드포인트.

### 10.1 엔드포인트

```
GET /api/integrations/oauth/callback/:provider
```

| 파라미터 | 설명 |
|----------|------|
| `:provider` | OAuth 제공자 (`google`, `github`, `cafe24`) |
| `code` | Authorization Code |
| `state` | CSRF 방지 토큰 (서버 발급) |
| `error` | OAuth 에러 코드 (거부 등) |

> **참고**: 사용자 로그인용 OAuth (`/api/auth/oauth/:provider/callback`)와 별개이다.

### 10.2 처리 플로우

1. **state 검증**: 서버가 `/oauth/begin`에서 발급한 state와 일치 여부 확인. 불일치 시 팝업에 `Security validation failed` 표시 후 종료
2. **error 파라미터 확인**: 존재 시 팝업에 `Authorization denied` 표시 후 종료
3. **Authorization Code → Token 교환**: provider별 토큰 엔드포인트에 code + client_secret 전송
4. **모드별 분기**:
   - `new`: Integration은 아직 없음 → 토큰을 임시 저장소(`oauth_preview`, TTL 10분)에 저장하고 `preview_token` 발급. 이후 `POST /api/integrations`에서 `preview_token`을 참조해 최종 생성
   - `reauthorize`: 기존 `integrationId`의 credentials를 새 토큰으로 교체, status를 `connected`로 복귀
   - `request-scopes`: 기존 `credentials.scopes`에 신규 scope 병합, access_token/refresh_token 갱신
5. **팝업 → 부모 창 알림**:

```javascript
window.opener.postMessage({
  type: "oauth_callback",
  provider: "google",
  status: "success",           // "success" | "error"
  mode: "new",                  // "new" | "reauthorize" | "request-scopes"
  previewToken: "tmp_...",      // mode=new일 때만
  integrationId: "uuid",        // mode=reauthorize/request-scopes
  error: null
}, window.location.origin);
window.close();
```

### 10.3 provider별 설정

| Provider | Token URL | 기본 scope 프리셋 | Refresh |
|----------|-----------|-----------------|---------|
| Google | `https://oauth2.googleapis.com/token` | 사용자 체크박스 선택 결과 | ✓ |
| GitHub | `https://github.com/login/oauth/access_token` | `repo`, `read:org` | ✗ |
| Cafe24 | `https://{mall_id}.cafe24api.com/api/v2/oauth/token` | 사용자 체크박스(카테고리 R/W) 결과 | ✓ |

> **Cafe24 한정**: Token URL 이 `mall_id` 의존 변수. `oauth/begin` 시점에 사용자가 입력한 `mall_id` 를 `oauth_preview` 임시 저장소에 함께 저장하여 callback 의 token 교환에서 사용한다 (§10.2 4단계의 `new`/`reauthorize`/`request-scopes` 분기에 모두 적용).

### 10.4 에러 매핑

| 에러 | 팝업 표시 | Integration 상태 |
|------|----------|----------------|
| state 불일치 | `Security validation failed. Please try again.` | 변경 없음 |
| 사용자 거부 | `Authorization was denied.` | 변경 없음 |
| 코드 교환 실패 | `Failed to connect to {provider}.` | reauthorize면 `error(auth_failed)` |
| 네트워크 오류 | `Connection error.` | 변경 없음 |

### 10.5 토큰 자동 갱신

- Refresh token 보유 시: 노드 실행 직전 만료 확인 → 만료됐으면 갱신 후 호출
- 갱신 실패 시: 상태 `expired` + `integration_expired` 알림 생성 (§11)
- **원자 갱신**: 토큰 갱신 성공 시 `credentials.access_token` / `credentials.refresh_token` / `credentials.expires_at` / `Integration.token_expires_at` 4개 필드를 **동일 트랜잭션 내 원자 UPDATE**. partial write 시 다음 노드 실행이 inconsistent token state 를 사용하는 race condition 방지.
- **Cafe24 한정**: 갱신 endpoint 도 `https://{credentials.mall_id}.cafe24api.com/api/v2/oauth/token`. `mall_id` 누락 시 `INTEGRATION_INCOMPLETE` 로 즉시 실패.

---

## 11. 만료 스캐너 및 알림

> `service_type='mcp'` Integration 은 OAuth refresh token 흐름이 아니므로 `token_expires_at` 가 항상 NULL → 본 §11 의 임계치 알림 흐름은 적용되지 않는다. MCP 인증 실패는 노드 실행 시점에 401/403 으로 감지되어 `error(auth_failed)` 로 격하되며, 사용자는 `Rotate credentials` 로 토큰을 교체한다 (상세 [Spec MCP Client §8](../5-system/11-mcp-client.md#8-에러-처리)).

> `service_type='cafe24'` Integration 은 OAuth refresh token 을 보유하므로 본 §11 의 임계치 알림 흐름이 정상 적용된다. `token_expires_at` 가 만료 7일/3일/당일 임계에 도달하면 `integration_expired` 알림이 발사된다. Refresh 실패 시 §10.5 의 원자 갱신 정책이 partial write 를 방지하며, 갱신 실패한 토큰 셋은 그대로 expire 처리되어 사용자에게 reauthorize 권장.

### 11.1 스캐너 잡

```
Cron: 0 0 * * *   (워크스페이스 타임존 00:00)
대상: Integration WHERE token_expires_at IS NOT NULL
로직:
  for each integration:
    remain = token_expires_at - now()
    if remain <= 0d   → status=expired, 알림 (임계치: 당일)
    elif remain <= 3d → 알림 (임계치: 3일, 중복 방지 키 있음)
    elif remain <= 7d → 알림 (임계치: 7일, 중복 방지)
    else              → skip
```

### 11.2 알림 생성

`Notification` 엔티티를 사용 (type = `integration_expired`).

| 상황 | 제목 | 메시지 | 수신자 |
|------|------|--------|--------|
| 7일 전 | `Integration expiring soon` | `"<name>" will expire on <date>.` | Personal: 소유자 / Organization: Admin 전원 |
| 3일 전 | `Integration expiring in 3 days` | 동일 | 동일 |
| 당일 | `Integration expired` | `"<name>" has expired. Reauthorize to continue.` | 동일 |
| 재인증 실패 | `Reauthorization failed` | `Failed to reauthorize "<name>".` | 동일 |

**중복 방지**: `(integration_id, threshold_key)`로 유니크 판정. 임계치별 최대 1회.

### 11.3 이메일 옵션

- 사용자별 프로필 설정에 `notifyIntegrationExpiryByEmail` 토글
- 활성화 시 `Notification.channel = 'both'`로 생성되어 `NotificationDispatcher`가 이메일 발송

### 11.4 UI 배지

- 사이드바 Integration 메뉴: `status IN (expired, error) OR (token_expires_at <= now() + 7d)` 카운트
- 목록 페이지: 카드 모서리 뱃지 + "Need attention" 배너 (§2.4)
- 상세 헤더: 상태 배지 + 만료 임박일 경우 `Expires in Nd` 표시

---

## 12. 화면 상태 (로딩·빈·에러)

| 상태 | 노출 |
|------|------|
| 목록 로딩 | 3×3 스켈레톤 카드 그리드 |
| 목록 빈 상태 | 아이콘 + "No integrations yet" + `[+ Add Integration]` |
| 목록 필터 결과 0 | "No integrations match your filters." + 필터 초기화 버튼 |
| 목록 조회 에러 | "Failed to load integrations." + `[Retry]` |
| 상세 로딩 | 헤더 스켈레톤 + 탭 스켈레톤 |
| 상세 not found | 404 페이지 + 목록으로 돌아가기 |
| 테스트 실행 중 | 버튼 `Testing...` + 스피너 |
| Rotate 진행 중 | 폼 disabled + 진행 배너 |
| 삭제 차단 | 모달 버튼 `Delete` disabled + 차단 사유 다이얼로그 |

---

## 13. 데이터 모델 영향 요약

- Integration 엔티티에 `status_reason`, `last_used_at`, `last_rotated_at`, `last_error` 필드 추가 (데이터 모델 §2.10)
- `credentials` JSONB 규약에 `scopes: string[]` 포함 (OAuth 한정)
- 신규 `IntegrationUsageLog` 엔티티 추가 (§2.10.1) — 노드 실행 완료 시 실행 엔진이 1건 기록
- 인덱스 추가: `(workspace_id, name) UNIQUE`, `(workspace_id, status)`, `(token_expires_at)`, `IntegrationUsageLog (integration_id, at DESC)`

---

## 14. 연관 동작

### 14.1 노드 실행 엔진

핸들러 실행 세멘틱과 공통 계약은 [Spec Integration 공통 §4](../4-nodes/4-integration/0-common.md#4-handler-실행-세멘틱)와 [Spec 실행 엔진 §10](../5-system/4-execution-engine.md#10-integration-handler-계약)에 정의되어 있다. 핵심 규약:

- 모든 Integration 핸들러는 `IntegrationsService.getForExecution(id, workspaceId)`로 credential을 해소하고, 호출 결과를 `IntegrationsService.logUsage(...)`로 기록한다.
- 엔진은 각 노드 실행 직전 `ExecutionContext.nodeExecutionId`를 주입하여 usage 로그의 귀속을 보장한다.
- 실패 시 핸들러는 `IntegrationError(code, message)`를 throw하며 `Integration.status`·`last_error`가 함께 갱신된다.

#### 에러 코드 vocabulary

| 코드 | 원인 | 영향 |
|------|------|------|
| `INTEGRATION_NOT_FOUND` | integrationId가 존재하지 않거나 타 워크스페이스 소속 | Usage 로그 기록(failed) + 노드 실패 |
| `INTEGRATION_TYPE_MISMATCH` | 참조 Integration의 `service_type`이 노드 기대와 불일치 | 위와 동일 |
| `INTEGRATION_NOT_CONNECTED` | Integration 상태가 `expired`/`error` | 위와 동일 |
| `INTEGRATION_INCOMPLETE` | credentials JSONB에 필수 필드 누락 | 위와 동일 |
| `INTEGRATION_CALL_FAILED` | 기타 분류 불가 실패 | 위와 동일 |
| `SMTP_SEND_FAILED` | nodemailer 전송 실패 | Usage log `error.code` 기록 |
| `DRIVER_NOT_SUPPORTED` | Database 핸들러에서 MySQL 등 미구현 드라이버 선택 | 위와 동일 |
| `INVALID_PARAMETERS` | Database `parameters`가 JSON 배열 문자열로 파싱되지 않음 | 위와 동일 |
| `HTTP_{status}` | HTTP 핸들러가 2xx 아닌 응답을 받음 | 위와 동일 (HTTP 노드는 `error` 포트로 출력) |
| `HTTP_TRANSPORT_FAILED` | HTTP 전송 실패(네트워크/타임아웃) | 위와 동일 |

#### 핸들러별 usage 기록 시점

| 노드 | Usage 로그 기록 조건 |
|------|---------------------|
| `send_email` | 매 호출 (성공/실패 모두) |
| `database_query` | 매 호출 (성공/실패 모두) |
| `http_request` | `authentication === 'integration'`인 경우에만 기록 (None/Custom은 Usage 대상 아님) |
| `cafe24` | 매 호출 (성공/실패 모두). AI Agent 의 `Cafe24McpBridge` 를 통한 호출도 동일 로그에 기록 — `node_execution_id` 는 호출 시점의 AI Agent NodeExecution. 메타도구는 미사용 ([Spec MCP Client §8.3 IntegrationUsageLog](../5-system/11-mcp-client.md#83-integrationusagelog)) |

### 14.2 워크플로우 에디터

- 노드 설정 패널에서 Integration 선택은 `IntegrationSelector` 공용 드롭다운을 사용한다 — `serviceTypes` prop으로 목록을 필터(Send Email은 `email`, Database는 `database`, HTTP의 `authentication='integration'` 모드는 `http`, Cafe24 노드는 `cafe24`, AI Agent 의 `mcpServers` 항목은 `['mcp', 'cafe24']`).
- AI Agent 의 `mcpServers` 셀렉트는 `service_type='mcp'` 와 `service_type='cafe24'` 를 모두 받는다 — 후자는 backend `Cafe24McpBridge` 가 in-process `IMcpClient` 로 동작 ([Spec MCP Client §2.3 Internal Bridge](../5-system/11-mcp-client.md#23-internal-bridge)). UI 는 두 그룹을 시각적으로 분리 표시 (`🌐 Generic MCP (HTTP) servers` / `🛒 Cafe24 stores (Internal Bridge)`).
- AI Agent 노드는 Integration 노드와 달리 `mcpServers` 가 다중 선택 (multi-select) 이며, 서버별로 도구 allowlist·resource/prompt 노출 토글 UI 가 추가된다 — Cafe24 의 경우 도구 수가 많아(Resource × Operation = ~180) allowlist UI 가 Resource 단위 grouping 으로 노출된다 ([Spec AI Agent](../4-nodes/3-ai/1-ai-agent.md), [Spec MCP Client §5.6](../5-system/11-mcp-client.md#56-도구-allowlist)).
- 연동 상태 배지를 함께 노출하며(§7.3), 해당 타입의 연동이 0건이면 `+ Create {Service} integration` CTA 링크를 select 아래에 표시(`/integrations/new?service=…&step=auth`).
- 삭제된 integrationId가 저장돼 있으면 `{id앞8자}… (missing)` 옵션을 추가해 값 보존.

### 14.3 감사 로그(AuditLog)

Integration 생성·삭제·회전·재인증·scope 전환 이벤트를 `resource_type='integration'`로 기록한다. `action`은 `integration.created`, `integration.deleted`, `integration.rotated`, `integration.reauthorized`, `integration.scope_changed`.
