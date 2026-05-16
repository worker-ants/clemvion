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
| 상태 아이콘 | 🟢 connected / 🟡 expiring(7일 이내)·expired / 🔴 error(reason) / ⏳ pending_install |
| 서비스 아이콘 | 서비스 유형별 로고 |
| 별칭 | 사용자가 지정한 이름 (`Integration.name`) |
| 인증 유형 | auth_type을 대문자/공백 정리하여 표시 (`OAuth2`, `API Key`, `Bearer Token`, `Basic`, `Connection String`, `SMTP`, `Webhook Outbound`). `service_type='mcp'` 인 경우 `MCP Server`, `service_type='cafe24'` 인 경우 `Cafe24` 로 별도 라벨 |
| 상태 텍스트 | `Connected` / `Expires in Nd` / `Expired` / `Error: <reason>` / `Pending install` (보조 문구: "Complete Cafe24 Test Run to activate". `status_reason`/`last_error` 가 채워지면 카드 하단에 진단 단서 표시 — 예: `Last error: OAUTH_TOKEN_EXCHANGE_FAILED — Failed to exchange authorization code`) |
| Scope 섹션 | Organization / Personal 2개 섹션. 각 섹션 내 최신 생성순 정렬 |
| 더보기(⋮) | 상세 열기, 연결 테스트(연결됨에 한함), 재인증(OAuth · **비활성 조건**: §4.2 Reauthorize 행 참조 — 요약: `status='pending_install'`, `service_type='cafe24' AND credentials.app_type='private'` 전체 케이스, `expired AND status_reason='install_timeout'`), 삭제(차단 시 비활성). `pending_install` 의 ⋮ 메뉴는 **상세 열기 + 삭제만 활성** — 재인증은 cafe24 측 "테스트 실행" 재호출이 정식이며, 연결 테스트는 토큰이 없어 의미가 없다 |

### 2.3 검색·필터

| 컨트롤 | 동작 |
|--------|------|
| 검색 입력 | 별칭(`name`) ILIKE 부분 일치 |
| Scope 셀렉트 | `All` / `Personal` / `Organization` |
| 서비스 유형 칩 | 다중 선택 가능. 선택 없음 = 전체 |
| 상태 칩 | `All` / `Connected` / `Expiring` (7일 이내) / `Expired` / `Error`. 단일 선택 |

※ 상태 칩에 `pending_install` 은 포함하지 않는다 — 외부 흐름(Cafe24 Developers "테스트 실행") 진행 중 정상 전환 상태이며, 사용자가 명시적으로 필터링할 수요가 낮다. 별도 수요 발생 시 후속 plan 으로 재검토 (Rationale 참고).

모든 필터는 URL 쿼리 파라미터(`q`, `scope`, `serviceType`, `status`)로 동기화되어 공유/새로고침 시 복원된다.

### 2.4 "Need attention" 배너

- 조건: `status IN (expired, error)` OR `token_expires_at <= now() + 7d`. `pending_install` 은 사용자가 외부(Cafe24 Developers)에서 흐름을 진행 중인 정상 상태로 보고 배너에서 제외한다 — `status_reason` 이 채워진 케이스도 동일 (재시도가 cafe24 측에서 일어나므로 우리 화면의 attention 으로는 잡지 않음).
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
4. 팝업 콜백 페이지(`/api/3rd-party/:provider/callback`)가 토큰을 저장 후 `postMessage`로 부모창 알림
5. 부모창은 Step 3로 자동 전이

**OAuth2 흐름 (Cafe24 — Public 앱)** — `mall_id` 가 base URL 의 일부이고 authorize URL 도 mall 별로 다르므로 폼 흐름이 Google/GitHub 와 다르다. Public 앱은 Cafe24 앱스토어에 등록(또는 심사 대기)된 앱으로 서버 env 의 `CAFE24_CLIENT_ID`/`CAFE24_CLIENT_SECRET` 을 사용한다.

1. **사전 입력** (OAuth 버튼 누르기 전 필수):
   - `Mall ID` (예: `myshop` — `https://myshop.cafe24api.com` 의 hostname prefix). 형식: `/^[a-z0-9-]{3,50}$/` ([§5.8 credentials JSONB](#58-cafe24) validation rule).
   - `App type` 라디오: **Public** 선택.
2. **Scope 카테고리 프리셋** (체크박스, 카테고리 단위): Product (R/W), Order (R/W), Customer (R/W), Category (R/W), Promotion (R/W), Mileage (R/W), Shipping (R/W), Salesreport (R), Translation (R/W), Notification (R/W), 기타 카테고리는 "고급" 토글 아래. 각 체크박스가 Cafe24 scope (`mall.read_<category>` / `mall.write_<category>`) 와 매핑.
3. **[Connect with Cafe24]** 클릭 → 백엔드 `POST /api/integrations/oauth/begin` 호출. body:
   ```jsonc
   {
     "service": "cafe24",
     "mode": "new",
     "mall_id": "myshop",
     "app_type": "public",
     "scopes": ["mall.read_product", "mall.write_order", "..."]
   }
   ```
   응답으로 mall 별 authorize URL (`authUrl`) 수신.
4. 신규 팝업(600×700)으로 `https://{mall_id}.cafe24api.com/api/v2/oauth/authorize?...` 오픈.
   - **scope 인코딩** — Cafe24 는 RFC 6749 §3.3 의 공백 구분이 아닌 **콤마 구분**(`mall.read_product,mall.write_order`) scope 를 요구한다. 공백/`+` 으로 보내면 단일 scope 라도 `invalid_scope` 로 거부된다 (Cafe24 의 자체 규약 — `developers.cafe24.com` 공식 example 과 `cafe24-app/cafe24_app_sample` 의 `StoreToken.java#getCodeRedirectUrl` 가 모두 콤마 구분). 다른 OAuth provider (google, github) 는 공백 구분 유지.
5. 팝업 콜백 페이지(`/api/3rd-party/cafe24/callback`)가 토큰 저장 후 `postMessage` 로 부모창 알림.
6. 부모창은 Step 3 로 자동 전이.

**OAuth2 흐름 (Cafe24 — Private 앱)** — Cafe24 Developers 에서 생성한 **미심사(비공개) 앱**. Private 앱의 OAuth 흐름은 우리 서비스가 시작할 수 없고, **Cafe24 Developers 의 "테스트 실행"이 흐름을 시작**한다. Cafe24 는 우리 App URL 을 먼저 호출하며, 이후 동의 → callback 순으로 진행한다.

1. **사전 등록** (Cafe24 에서 테스트 실행하기 전 필수):
   - `Mall ID`, `App type = Private`, `Client ID`, `Client Secret`, scope 입력.
   - **[저장 및 설정 안내 받기]** 클릭 → `POST /api/integrations/oauth/begin` 호출. body:
     ```jsonc
     {
       "service": "cafe24",
       "mode": "new",
       "mall_id": "myshop",
       "app_type": "private",
       "client_id": "...",
       "client_secret": "...",
       "scopes": ["mall.read_product", "..."]
     }
     ```
   - 응답: `{ "mode": "cafe24_private_pending", "integrationId": "...", "appUrl": "https://<host>/api/3rd-party/cafe24/install/:installToken", "callbackUrl": "https://<host>/api/3rd-party/cafe24/callback" }`. `appUrl` 의 마지막 path segment 가 `install_token` (16바이트 base64url, 22자) 이며, Cafe24 Developers 의 "앱 URL" 에 그대로 등록한다. **Cafe24 App URL 입력 필드 100자 한도** 충족을 위해 경로·토큰 모두 단축됨 — Rationale "Cafe24 App URL 100자 한도 대응" 항 참조.
   - Integration 이 `status=pending_install` 상태로 즉시 생성된다 (토큰 없음).
2. **설정 안내 화면** 표시 (팝업 없음):
   - `App URL` 복사 버튼 — Cafe24 Developers 앱의 **앱 URL** 에 등록.
   - `Redirect URI` 복사 버튼 — Cafe24 Developers 앱의 **Redirect URI** 에 등록.
   - 안내: "① 위 URL 을 Cafe24 Developers → 내 앱 → 개발 정보에 등록하세요. ② 사용 권한(Scope) 이 요청한 scope 와 일치하는지 확인하세요. ③ 테스트 실행 버튼을 클릭하고 mall_id 를 입력하세요."
3. **Cafe24 "테스트 실행"** — Cafe24 가 App URL(`GET /api/3rd-party/cafe24/install/:installToken`) 를 호출. 쿼리 파라미터: `mall_id`, `shop_no`, `user_id`, `user_name`, `user_type`, `lang`, `nation`, `timestamp`, `hmac` (HmacSHA256 서명, §9.5 참조).
4. **App URL 처리** — 백엔드가 path 의 `install_token` 으로 단일 Integration 을 조회하고, 그 row 의 `client_secret` 으로 HMAC 을 1회 검증한다 (현행 in-memory 100건 스캔 대체). 검증 통과 후 row 의 status 에 따라 분기:
   - `pending_install` — OAuthState 생성 후 `https://{mall_id}.cafe24api.com/api/v2/oauth/authorize?...` 로 302 (초기 install 흐름).
   - `connected` / `error(*)` / `expired` — `${FRONTEND_URL}/integrations/<id>` 로 302 (**post-install navigation 흐름** — 카페24 쇼핑몰 관리자 화면의 "앱으로 가기" 버튼이 같은 App URL 을 사용하므로 이 분기가 필수. 자세한 근거는 Rationale "Cafe24 App URL 재호출 흐름" 항).
5. 쇼핑몰 관리자 **동의 화면** → 동의. (post-install navigation 분기는 동의 화면 없이 4번에서 바로 우리 화면으로 진입)
6. Cafe24 가 callback(`/api/3rd-party/cafe24/callback`)으로 code+state 전달 → 토큰 교환 → Integration `status: pending_install → connected`. `install_token` 은 **보존** (post-install navigation 의 식별 키로 계속 사용).
7. 사용자는 통합 목록에서 상태를 확인한다 (새로고침 또는 연결 상태 배지).

> **mall_id** 는 base URL 의 일부이며 authorize URL 도 mall 별로 달라, OAuth begin 단계에서 사용자가 선행 입력해야 한다 (Public/Private 모두 동일).

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
| Quick actions | `Test connection` (connected 한정), `Reauthorize`(OAuth · `pending_install` 또는 cafe24 private 에서 비활성 — §4.3 Reauthorize 상세 조건 참조), `Rotate credentials`(비OAuth), `Edit alias` |
| 상태 배지 | 현재 상태 + reason (`error(insufficient_scope)` 등) |
| 별칭 편집 | 인라인 편집, `PATCH /api/integrations/:id` |

### 4.3 Security 탭

| 블록 | 설명 |
|------|------|
| Authentication | `auth_type` 표시 + 현재 보유 자격 증명 메타 (예: `Token preview: xoxb-****4f2a`) — 원본 값은 복호화해 보여주지 않음 |
| Reauthorize (OAuth) | `[Reauthorize]` 버튼 → `POST /api/integrations/:id/reauthorize`에서 authUrl 수신 → 팝업 OAuth → 성공 시 상태 `connected` 복귀. **비활성 조건**: `status='pending_install'` (cafe24 Private 초기 install — "테스트 실행" 재호출이 정식); `status='expired' AND status_reason='install_timeout'` (Private install TTL 만료 — 삭제 후 재등록 권장); `service_type='cafe24' AND credentials.app_type='private'` 인 모든 케이스 (Private 앱은 우리 서버가 OAuth 를 시작할 수 없음) |
| Rotate credentials (비OAuth) | 인플레이스 폼. 기존 값은 마스킹, 토글로 교체 폼 오픈 → 새 값 입력 → `POST /api/integrations/:id/rotate` (내부적으로 연결 테스트 → 성공 시에만 commit). 실패 시 기존 자격 증명 유지 |
| Last rotated | `last_rotated_at` 상대 시간 + 절대 시간 |

비OAuth rotate 폼의 필드는 §5 서비스 스키마와 동일. 서버는 테스트 성공 전까지 기존 credentials JSON을 건드리지 않는다.

### 4.4 Scope & Permissions 탭 (OAuth 한정)

| 요소 | 설명 |
|------|------|
| 현재 scope 목록 | `credentials.scopes[]` 전체를 체크된 상태로 표시 |
| 권장 scope 목록 | 서비스별 프리셋. 현재 scope에 없는 항목은 체크 해제 상태 |
| 누락 scope 배지 | `status_reason = insufficient_scope`일 때 누락 scope 목록을 빨간 뱃지로 강조 |
| `[Request scopes]` 버튼 | 체크된 추가 scope 와 함께 `POST /api/integrations/:id/request-scopes` 호출. 응답 분기는 아래 두 가지 — provider 분기는 backend 가 응답 shape 으로 결정하므로 frontend 는 응답 shape 만 보고 UI 를 분기한다. 응답 필드 전체 정의는 §9.2 참조. |

**분기 ① — 일반 OAuth provider (Google / GitHub / Cafe24 Public)**

- 응답: `authUrl` 포함 (기타 필드는 §9.2 참조).
- UI: 새 창으로 OAuth 팝업 열고 성공 토스트 ("Scope request window opened" / "권한 요청 창을 열었어요"). 팝업 닫힘 시 success 면 부모 페이지가 `credentials.scopes` 병합 결과를 refetch.

**분기 ② — Cafe24 Private**

- 응답: `{ mode: 'cafe24_private_pending', integrationId, appUrl, callbackUrl, scopesAdded: string[] }`.
- 사유: Private 앱은 우리 서버가 OAuth 를 시작할 수 없어 popup 진입점이 없다. Cafe24 Developers 의 앱 권한 설정에서 사용자가 직접 scope 활성화 후 "테스트 실행" 으로 재인증해야 한다 (Rationale "Cafe24 Private request-scopes 흐름" 항).
- UI:
  - **inline alert (영구 표시, amber 톤)** — Scope 카드 안에 다음 안내를 고정 표시한다. modal 이 아니라 inline 인 이유는 사용자가 Cafe24 측 작업을 진행하는 동안 안내를 계속 참조하기 때문이다.
    - Title: "Cafe24 Developers 에서 권한을 추가해 주세요" / "Grant the additional scopes in Cafe24 Developers"
    - Description: "Cafe24 Developers 의 앱 권한 설정에서 추가 scope 를 활성화한 뒤 '테스트 실행' 을 다시 누르면 새 token 으로 갱신됩니다. (Private 앱은 외부에서 OAuth 화면을 띄울 수 없어 Cafe24 측 작업이 필요해요.)" / "Enable the additional scopes in your Cafe24 Developers app permission settings, then click 'Test run' again to refresh the token with the new scopes. (Private apps cannot initiate the OAuth flow externally, so the action must happen on Cafe24.)"
    - `scopesAdded` 가 비어 있지 않으면 그 목록을 작은 칩으로 alert 안에 나열 ("Scopes added: [scope_a] [scope_b]"). 빈 배열이면 칩 영역을 표시하지 않는다.
  - **즉시 토스트 (info 레벨)** — alert 표시와 동시에 한 번 띄워 응답이 왔음을 알린다. alert 가 안내 본문, 토스트는 도착 신호.
  - **다음 mutate 시 reset** — 새 요청 시작 직전에 alert 를 비워 옛 안내가 잔류하지 않게 한다.
  - **refetch 미실행** — Cafe24 측 후속 작업 완료까지 token 변화가 없으므로 본 분기에서는 부모 페이지의 refetch 콜백을 호출하지 않는다. token 갱신은 "테스트 실행" callback handler 가 별도 경로로 처리.

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
| `app_type` | enum `public` \| `private` | ✓ | × | Cafe24 앱 발급 형태. `public` = Cafe24 앱스토어 등록 앱(서버 env `CAFE24_CLIENT_ID/SECRET` 사용), `private` = Cafe24 Developers 에서 생성한 미심사(비공개) 앱(사용자가 client_id/secret 직접 입력) |
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
  [pending_install] ──install callback success──▶ [connected]
          │                                              │
          │ (Cafe24 private 앱 전용)        ┌────────────┘
          │                                 ▼
          │                    ──expire──▶ [expired] ──reauthorize success──┐
          │                        │                                         │
          │                        └──rotate success─────────────────────────┤
          │                     call fails                                    │
          │                        │                                          │
          │                        ▼                                          │
          │                [error(reason)] ──rotate/reauthorize success───────┘
          │
          ├── install TTL 24h 만료 ──▶ [expired] (status_reason='install_timeout')
          │
          ├── callback 실패 (token exchange / state / row 조회) ──▶ [pending_install] (자기 루프, status_reason + last_error 갱신, status 보존)
          │
          └── manual delete ──▶ (삭제)
```

> **번복 acknowledgment** (2026-05-14): 기존 spec §6 의 `pending_install → (삭제)` (install timeout 자동 삭제) 화살표는 본 개정에서 제거되고 `→ [expired]` 로 대체된다. 자동 삭제 경로는 없어지며, 삭제는 `manual delete` 경로로만 일어난다.

| 전이 | 트리거 이벤트 |
|------|--------------|
| pending_install → connected | Cafe24 Private 앱 "테스트 실행" → HMAC 검증 → OAuth callback 성공. `install_token` 은 **보존** (post-install navigation 의 식별 키로 계속 사용 — Rationale "Cafe24 App URL 재호출 흐름" 항 참조). |
| **pending_install → expired** | install_token 발급 후 24시간 내 callback 미성공 — 일일 스캐너가 `status='expired'`, `status_reason='install_timeout'`, `install_token=NULL` 로 자동 전이. 재시도하려면 사용자가 새로 통합을 등록한다 (단 private 앱은 reauthorize 불가 → 권장: 삭제 후 재등록) |
| **pending_install → pending_install (callback 실패 보존)** | OAuth callback 처리 중 token exchange 실패 / state mismatch / state expired 등이 발생하면 status 는 보존되고 `last_error` + `status_reason` (`oauth_token_exchange_failed` / `oauth_state_mismatch` / `oauth_state_expired`, 모두 snake_case) 만 갱신된다. 사용자가 cafe24 측 설정을 고치고 "테스트 실행" 을 다시 누르면 새 OAuthState 가 생성되어 재시도 가능. ※ row 자체가 사라진 `resource_not_found` 케이스는 갱신 대상이 없어 §10.4 "변경 불가" 행으로만 다룬다. |
| connected → error(auth_failed) | 노드 실행 중 401/403 또는 매일 스캐너 / 노드 실행 직전 토큰 갱신 시 `refresh_token` 자체 무효 (`invalid_grant`). (2026-05-16 갱신 — 옛 `connected → expired (refresh fail)` 경로를 본 행으로 통합; expired 는 이제 `pending_install → expired (install_timeout)` 한 경로만 사용. [Rationale "refresh 실패 시 status_reason 통일"](#rationale) 참고) |
| connected → error(insufficient_scope) | 노드 실행 중 403 + 서비스별 `missing_scope` 시그널 |
| connected → error(network) | 노드 실행 중 또는 토큰 갱신 중 transport 실패가 3회 연속 (PR #67 V049 컬럼 `consecutive_network_failures` 카운터로 판정) |
| expired/error → connected | `reauthorize` 또는 `rotate` 성공 (연결 테스트 통과). ※ Cafe24 Private 은 reauthorize 진입점이 없으므로 이 경로 적용 안 됨 — 삭제 후 재등록이 유일 복구 (## Rationale 참고) |
| **→ (삭제)** | **사용자가 명시적으로 Delete 액션을 수행한 경우에만**. 자동 삭제는 없음 (TTL 만료는 expired 로만 전이) |

`error` 상태에서는 `status_reason` 컬럼에 기계 판독 가능 값을 기록한다.

> `pending_install` 은 Cafe24 Private 앱 전용 상태. 이 상태의 Integration 은 노드·AI Agent 에서 사용할 수 없다 (`INTEGRATION_INCOMPLETE` — §4.2). 사용자가 Cafe24 에서 "테스트 실행" 을 완료해야 `connected` 로 전이한다. callback 시도가 실패해도 status 는 보존되어 재시도가 가능하며, 24시간 내 성공하지 못하면 `expired` 로 자동 전이된다 (install_timeout — `install_token` 도 NULL 로 소거).

> `status_reason='install_timeout'` 으로 expired 처리된 Cafe24 Private 행은 reauthorize 버튼이 **비활성** 이다 — Private 앱은 재인증 진입점이 없고 cafe24 "테스트 실행" 만 정식이다. 사용자는 행을 삭제 후 새로 등록한다.

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
| POST | `/api/integrations/oauth/begin` | OAuth 시작. body: `{ service, scopes[], mode, integrationId? }`. **Cafe24 Public**: `mall_id`, `app_type='public'` 추가 → `{ authUrl, state }` 반환 (popup 흐름). **Cafe24 Private**: `mall_id`, `app_type='private'`, `client_id`, `client_secret` 추가 → `{ mode:'cafe24_private_pending', integrationId, appUrl, callbackUrl }` 반환 (Integration `pending_install` 생성, popup 없음). ※ Cafe24 Private 응답의 `appUrl` 은 `${APP_URL}/api/3rd-party/cafe24/install/:installToken` 형식이다 — `installToken` 은 본 begin 호출이 발급한 **16바이트 base64url (22자, `^[A-Za-z0-9_-]{22}$`)** 로 Cafe24 Developers "앱 URL" 에 그대로 등록된다. ※ Cafe24 Private 흐름 진입 시 동일 `(workspaceId, mall_id)` 의 cafe24 Integration 이 이미 존재하면 (`app_type` 무관 — public 이든 private 이든) begin 자체가 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED (409)` 으로 즉시 거부된다. 한 workspace 안에서 같은 mall_id 의 cafe24 통합은 최대 1행 (`spec/1-data-model.md §3` partial UNIQUE 참조) — 사용자는 기존 통합을 사용하거나 삭제 후 재등록한다. |
| GET | `/api/3rd-party/cafe24/install/:installToken` | Cafe24 Private 앱 App URL 엔드포인트. **두 가지 진입점에서 호출됨**: ① 초기 install — Cafe24 Developers "테스트 실행" → OAuth authorize 로 redirect. ② post-install navigation — 카페24 쇼핑몰 관리자의 "앱으로 가기" 버튼 → 우리 frontend 로 redirect. path 의 `:installToken` 은 oauth/begin 응답으로 받은 16바이트 base64url (22자, `^[A-Za-z0-9_-]{22}$`). 쿼리: `mall_id`, `timestamp`, `hmac` 등 Cafe24 표준 파라미터. **식별 절차**: `install_token` 으로 단일 row 조회 → 그 row 의 `client_secret` 으로 HMAC 1회 검증. status 분기: `pending_install` → Cafe24 authorize URL 로 `302`; `connected`/`error(*)`/`expired` → `${FRONTEND_URL}/integrations/<id>` 로 `302` (post-install navigation). `install_token` 은 통합 lifetime 동안 persistent 식별자 (callback 성공 시 NULL 처리 안 함). 에러: `CAFE24_INSTALL_MISSING_PARAMS`(400, `mall_id`/`timestamp`/`hmac` 누락), `CAFE24_INSTALL_INVALID_TOKEN`(404, 토큰 미존재 — TTL 만료 / 통합 삭제 — 단 직접 매칭 실패 시 `tryRecoverByMallId` 회복 흐름 fall-back 후 여전히 미매칭일 때), `CAFE24_INSTALL_INVALID_HMAC`(403), `CAFE24_INSTALL_REPLAY`(400, timestamp ±5분 초과). |
| GET | `/api/3rd-party/:provider/callback` | OAuth 콜백 (§10) — `:provider ∈ {cafe24, google, github}` |
| POST | `/api/integrations/preview-test` | 저장 전 인증 정보로 연결 테스트. body: `{ service, authType, credentials }` |
| POST | `/api/integrations/:id/reauthorize` | OAuth 재인증 authUrl 발급 |
| POST | `/api/integrations/:id/rotate` | 비OAuth 자격 증명 교체. body: 신규 credentials 객체. 내부적으로 테스트 → 성공 시만 커밋 |
| POST | `/api/integrations/:id/request-scopes` | 추가 scope 요청. body: `{ scopes: string[] }`. 응답 분기: 일반 provider — `{ authUrl }` (팝업 OAuth). **Cafe24 Private** — `{ mode: 'cafe24_private_pending', integrationId, appUrl, callbackUrl, scopesAdded }` (popup 없음, 사용자가 Cafe24 Developers 에서 권한 추가 후 "테스트 실행" 으로 재인증). 본 endpoint 가 내부적으로 cafe24 Private 분기를 자동 처리하므로 frontend 는 provider 분기 로직 없이 응답 shape 만 보고 UI 분기. |
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
  - `CAFE24_INSTALL_MISSING_PARAMS` (400) — App URL 호출에 `mall_id` / `timestamp` / `hmac` 중 하나라도 누락. capability-token 가정(install_token 추측 불가) 에 영향 없는 파라미터 누락 분기로 별도 코드 (404/403 합산 정책과 무관 — Rationale 참조).
  - `CAFE24_INSTALL_INVALID_TOKEN` (404) — App URL 의 `install_token` 미존재 (통합 삭제 또는 24h TTL 만료로 소거). callback 성공만으로는 소거되지 않음 (post-install navigation 의 식별 키로 보존). 직접 매칭 실패 시 `tryRecoverByMallId` 회복 흐름 fall-back 후에도 미매칭이면 본 코드 반환 ([Rationale "Cafe24 install_token mismatch 회복 흐름"](#rationale) 참조).
  - `CAFE24_INSTALL_INVALID_HMAC` (403) — App URL HMAC 검증 실패
  - `CAFE24_INSTALL_REPLAY` (400) — App URL 의 timestamp 가 ±5분 윈도우 밖
  - `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` (409) — 동일 `(workspaceId, mall_id)` 에 이미 cafe24 Integration (`app_type` 무관 — public/private 모두) 이 존재. SQL UNIQUE 가 `service_type='cafe24'` 기준이므로 app_type 분리 보유 불가. swagger 규약(spec/conventions/swagger.md §2-4 — 중복/충돌은 409, `INTEGRATION_IN_USE(409)` 선례) 에 맞춤

---

## 10. OAuth 콜백 엔드포인트

Integration의 OAuth 인증 플로우에서 외부 제공자가 인증 완료 후 콜백하는 엔드포인트.

### 10.1 엔드포인트

```
GET /api/3rd-party/:provider/callback
```

| 파라미터 | 설명 |
|----------|------|
| `:provider` | OAuth 제공자 (`google`, `github`, `cafe24`) |
| `code` | Authorization Code |
| `state` | CSRF 방지 토큰 (서버 발급) |
| `error` | OAuth 에러 코드 (거부 등) |

> **참고**: 이 엔드포인트는 통합 연동용 OAuth 콜백이며, 사용자 소셜 로그인 콜백(`/api/auth/oauth/:provider/callback`)과 **별개**다. Google Cloud Console / GitHub OAuth App 에는 두 redirect URI 가 모두 등록되어 있어야 한다.

### 10.2 처리 플로우

1. **state 검증**: 서버가 `/oauth/begin`에서 발급한 state와 일치 여부 확인. 불일치 시 팝업에 `Security validation failed` 표시 후 종료
2. **error 파라미터 확인**: 존재 시 팝업에 `Authorization denied` 표시 후 종료
3. **Authorization Code → Token 교환**: provider별 토큰 엔드포인트에 code + client_secret 전송
4. **모드별 분기**:
   - `new`: Integration은 아직 없음 → 토큰을 임시 저장소(`oauth_preview`, TTL 10분)에 저장하고 `preview_token` 발급. 이후 `POST /api/integrations`에서 `preview_token`을 참조해 최종 생성
   - `reauthorize`: 기존 `integrationId`의 credentials를 새 토큰으로 교체, status를 `connected`로 복귀
     - ※ 단, integration 현재 status 가 `pending_install` 이면 callback 성공 시 `connected` 로, **실패 시 `pending_install` 유지** + `last_error`/`status_reason` 갱신 (cafe24 Private 초기 install 흐름 — 상세는 step 6).
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

6. **실패 처리**: handleCallback 내부에서 예외가 발생하면 컨트롤러는 동일한 callback HTML (`status: 'error'`, error message 포함) 을 반환한다. 팝업은 메시지 읽힘을 위해 **3~5초 지연 후 window.close()** (성공은 즉시). state 소비 이후의 예외는 `OAuthState.integrationId` 컨텍스트가 살아있으므로 백엔드가 해당 row 의 `last_error` + `status_reason` 을 갱신한다. status 보존 규칙은 §10.4 표가 정의 — 요약: **`pending_install` 은 `pending_install` 유지** (cafe24 Private 초기 install — 재시도 흐름 보존), **`connected` 의 reauthorize 실패 중 코드 교환 실패는 §10.4 표대로 `error(auth_failed)` 로 전이** (기존 정책), state mismatch/expired 등 state 단계 실패는 `last_error` 만 기록하고 status 보존.

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
| state 불일치 | `Security validation failed. Please try again.` | 변경 없음 (integrationId 식별 전 단계라 row 갱신 불가) |
| 사용자 거부 | `Authorization was denied.` | 변경 없음 |
| 코드 교환 실패 (mode=`reauthorize`, status=`connected`) | `Failed to connect to {provider}.` (auto-close 3~5초 지연 — 사용자가 메시지 읽도록) | `error(auth_failed)` + `last_error` 기록 |
| 코드 교환 실패 (mode=`reauthorize`, status=`pending_install` — Cafe24 Private 초기 install) | 동일 | **status 보존 (`pending_install` 유지)** + `status_reason='oauth_token_exchange_failed'` + `last_error.code='OAUTH_TOKEN_EXCHANGE_FAILED'` 기록. cafe24 측 설정 수정 후 재시도 가능 |
| state mismatch / expired (state row 소비 후) | `Security validation failed.` / `OAuth state has expired.` | integrationId 가 식별되면 `status_reason='oauth_state_mismatch'` 또는 `oauth_state_expired` 만 기록, status 보존 |
| 토큰 발급 후 row 조회 실패 (resource not found) | `Integration not found.` | 변경 불가 (row 가 사라진 케이스. integrationId 만 식별, row 가 없으니 갱신 대상 없음) |
| 네트워크 오류 | `Connection error.` | integrationId 식별되면 `last_error` 만 기록, status 보존 |

### 10.5 토큰 자동 갱신

- Refresh token 보유 시: 노드 실행 직전 만료 확인 → 만료됐으면 갱신 후 호출
- **갱신 실패 시 (2026-05-16 갱신)**: `refresh_token` 자체가 무효 (`invalid_grant`) 면 `error(auth_failed)` 로 전이 (옛 `expired` 분기는 폐기 — [Rationale "refresh 실패 시 status_reason 통일"](#rationale) 참고). transport 실패가 3회 연속이면 `error(network)` 로 전이 (PR #67 V049 카운터). `integration_expired` 알림은 `expired` 전이에만 발사하며 `error(*)` 전이는 UI 배지로만 표시 (§11 참고).
- 갱신 성공 시: `Integration.last_rotated_at` 도 함께 갱신해 백그라운드 갱신 스캐너의 cutoff 비교에 사용된다 (§11.1 `cafe24-background-refresh`).
- **원자 갱신**: 토큰 갱신 성공 시 `credentials.access_token` / `credentials.refresh_token` / `credentials.expires_at` / `Integration.token_expires_at` 4개 필드를 **동일 트랜잭션 내 원자 UPDATE**. partial write 시 다음 노드 실행이 inconsistent token state 를 사용하는 race condition 방지.
- **Cafe24 한정**: 갱신 endpoint 도 `https://{credentials.mall_id}.cafe24api.com/api/v2/oauth/token`. `mall_id` 누락 시 `INTEGRATION_INCOMPLETE` 로 즉시 실패. **백그라운드 갱신**: 일일 `cafe24-background-refresh` 잡 (§11.1) 이 `lastRotatedAt < now - 10d OR IS NULL` 인 connected cafe24 통합을 `cafe24-token-refresh` 큐로 enqueue 해 14일 idle 통합의 refresh_token 도 자동 갱신한다. **멀티 인스턴스 race**: 모든 cafe24 refresh 호출은 `cafe24-token-refresh` 큐의 `jobId = integrationId` dedup 으로 클러스터 전체 직렬화된다 ([Rationale "BullMQ cafe24-token-refresh 큐 — 멀티 인스턴스 race 해소"](#rationale) 참고).

---

## 11. 만료 스캐너 및 알림

> 만료 스캐너는 **네 개의 독립 BullMQ job** (`connected-expiry` / `pending-install-ttl` / `usage-log-prune` / `cafe24-background-refresh`) 으로 운영된다 — 각 job 은 자체 retry (`attempts: 3`, 60s exponential backoff) 와 큐 메트릭을 가지므로 한 패스의 실패가 다른 패스의 실행을 막지 않는다. Cafe24 Private 의 `pending_install` 24h TTL 만료는 `pending-install-ttl` job 이 담당. Cafe24 의 `refresh_token` 14일 만료 전 자동 갱신은 `cafe24-background-refresh` job 이 enqueuer 역할로 담당 (실제 갱신은 `cafe24-token-refresh` 큐의 worker — §10.5 참조). 상세 흐름·격리 정책은 [data-flow §1.4](../data-flow/integration.md#14-oauth-만료-스캐너-bullmq-integration-expiry) 참조.

> `service_type='mcp'` Integration 은 OAuth refresh token 흐름이 아니므로 `token_expires_at` 가 항상 NULL → 본 §11 의 임계치 알림 흐름은 적용되지 않는다. MCP 인증 실패는 노드 실행 시점에 401/403 으로 감지되어 `error(auth_failed)` 로 격하되며, 사용자는 `Rotate credentials` 로 토큰을 교체한다 (상세 [Spec MCP Client §8](../5-system/11-mcp-client.md#8-에러-처리)).

> `service_type='cafe24'` Integration 은 OAuth refresh token 을 보유하므로 본 §11 의 임계치 알림 흐름이 정상 적용된다. `token_expires_at` 가 만료 7일/3일/당일 임계에 도달하면 `integration_expired` 알림이 발사된다. Refresh 실패 시 §10.5 의 원자 갱신 정책이 partial write 를 방지하며, 갱신 실패한 토큰 셋은 그대로 expire 처리되어 사용자에게 reauthorize 권장.

### 11.1 스캐너 잡

네 개의 일일 BullMQ 잡 (`Cron: 0 0 * * *` UTC). 각 잡은 enqueuer 역할만 하며 실제 갱신 작업은 큐의 worker 가 수행 (역할 분리).

| Job name | 대상 | 동작 |
|----------|------|------|
| `connected-expiry` | `status NOT IN (expired, error, pending_install) AND token_expires_at IS NOT NULL` | `remain ≤ 0d` → `status=expired`, 알림. `remain ≤ 3d` / `≤ 7d` → 알림만 (중복 방지 키). |
| `pending-install-ttl` | `status='pending_install' AND COALESCE(install_token_issued_at, created_at) < now-24h` (Cafe24 Private 한정) | `status='expired', status_reason='install_timeout', install_token=NULL` 으로 bulk UPDATE. **알림 미발사** — 사용자가 외부 install 흐름 진행 중인 명시적 상태로 UI 배지 + 통합 상세 페이지로 통지 충분 (§11.2 + Rationale "install_timeout 알림 미발사" 참고). |
| `usage-log-prune` | `integration_usage_log.at < now-90d` | 행 삭제 (보존 정책) |
| `cafe24-background-refresh` | `status='connected' AND service_type='cafe24' AND (last_rotated_at < now-10d OR last_rotated_at IS NULL)` | `cafe24-token-refresh` 큐로 enqueue (`jobId = integrationId` dedup). 실제 refresh 는 `Cafe24TokenRefreshProcessor` worker 가 수행. 10일 임계 = refresh_token 14일 - 4일 안전 마진 ([Rationale](#rationale) 참조). |

옛 `connected-expiry` 흐름 의사코드 (참고):

```
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
| 당일 | `Integration expired` | `"<name>" has expired. Reauthorize to continue using it.` | 동일 |
| 재인증 실패 | `Reauthorization failed` | `Failed to reauthorize "<name>".` | 동일 |

**중복 방지**: `(integration_id, threshold_key)`로 유니크 판정. 임계치별 최대 1회.

**알림 발사 정책** (2026-05-16 정정): `integration_expired` 알림은 **refresh_token 없는 provider 의 `token_expires_at` 만료 (`status_reason='token_expired'`) 에만 발사**한다 (위 표의 7일/3일/당일 임계). 다음 전이는 **알림 미발사** — UI 배지 (사이드바 카운트 + 목록 카드 뱃지) 와 노드 에디터 경고 (§7.3) 로만 통지:
- **Cafe24 Private `install_timeout`** — 사용자가 외부 install 흐름 진행 중인 명시적 상태 ([Rationale "install_timeout 알림 미발사"](#rationale) 참고).
- **refresh 실패의 `error(auth_failed)`, transport 3회 실패의 `error(network)`, scope 부족의 `error(insufficient_scope)`** — 사용자 액션 필요한 `error(*)` 도메인. 향후 `Notification.type` 에 `integration_action_required` 같은 별도 타입 신설 검토.

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
- Integration 엔티티에 `install_token` (Cafe24 Private 흐름 식별 키, 16byte base64url 22자), `install_token_issued_at` (TTL 기준), `mall_id` (Cafe24 plain projection) 필드 추가 (데이터 모델 §2.10, V042–V045)
- `credentials` JSONB 규약에 `scopes: string[]` 포함 (OAuth 한정)
- 신규 `IntegrationUsageLog` 엔티티 추가 (§2.10.1) — 노드 실행 완료 시 실행 엔진이 1건 기록
- 인덱스 추가: `(workspace_id, name) UNIQUE`, `(workspace_id, status)`, `(token_expires_at)`, `IntegrationUsageLog (integration_id, at DESC)`, `(install_token) WHERE install_token IS NOT NULL` (V043), `(workspace_id, mall_id) WHERE service_type='cafe24' AND mall_id IS NOT NULL UNIQUE` (V046)

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
- AI Agent 노드는 Integration 노드와 달리 `mcpServers` 가 다중 선택 (multi-select) 이며, 서버별로 도구 allowlist·resource/prompt 노출 토글 UI 가 추가된다 — Cafe24 의 경우 도구 수가 많아(Resource × Operation = ~180) allowlist UI 가 카테고리 단위 grouping 으로 노출된다 (용어는 [Spec Cafe24 API 메타데이터 §6](../conventions/cafe24-api-metadata.md#6-allowlist-와의-관계) 기준; [Spec AI Agent](../4-nodes/3-ai/1-ai-agent.md), [Spec MCP Client §5.6](../5-system/11-mcp-client.md#56-도구-allowlist)).
- 연동 상태 배지를 함께 노출하며(§7.3), 해당 타입의 연동이 0건이면 `+ Create {Service} integration` CTA 링크를 select 아래에 표시(`/integrations/new?service=…&step=auth`).
- 삭제된 integrationId가 저장돼 있으면 `{id앞8자}… (missing)` 옵션을 추가해 값 보존.

### 14.3 감사 로그(AuditLog)

Integration 생성·삭제·회전·재인증·scope 전환 이벤트를 `resource_type='integration'`로 기록한다. `action`은 `integration.created`, `integration.deleted`, `integration.rotated`, `integration.reauthorized`, `integration.scope_changed`.


---

## Rationale

### Cafe24 Private 앱의 callback 실패는 왜 status 를 보존하나 (2026-05-14)

`pending_install` 상태의 Integration 이 callback 처리 중 token exchange 실패 등으로 떨어졌을 때, 자연스러운 선택지는 `error(auth_failed)` 로 전이하는 것이다. 그러나 Private 앱은 `reauthorize` 액션이 불가능하다 — OAuth 재시작은 **Cafe24 Developers 의 "테스트 실행"** 만 정식 진입점이고, 그 진입점은 우리가 발급한 `install_token` 을 path 에 그대로 사용한다. status 를 `error` 로 바꾸면 (a) UI 가 "reauthorize" 액션을 권장하지만 실제로 그 액션이 무력하고, (b) 사용자는 cafe24 측 설정을 고친 뒤 다시 "테스트 실행" 을 누르는 외부 흐름을 진행 중인데 우리 화면이 이를 "error" 로 표기해 흐름 단계를 오인하게 된다. 따라서 callback 실패는 `status_reason` + `last_error` 만 채우고 status 는 `pending_install` 그대로 유지한다. (참고: `review/consistency/2026/05/14/18_23_55`)

`status_reason` 의 저장값은 callback 에러 코드를 `snake_case` 로 표기한다 — DB 컬럼 컨벤션 전체가 `auth_failed`, `token_expired` 등 `snake_case` 인 것과 통일. 한편 API 응답·callback HTML 의 에러 코드는 `OAUTH_*`, `CAFE24_*` 같은 `UPPER_SNAKE_CASE` 를 유지한다 (HTTP 컨벤션). 동일 의미 두 표기는 §10.4 에서 매핑.

`last_error.code` 와 `status_reason` 이 같은 값을 중복 보존하는 이유: `last_error` 는 JSONB 라 보존 정책(향후 GDPR 등)에 따라 소거될 수 있다. `status_reason` 은 plain string 컬럼으로 더 가볍게 유지되며, "왜 이 상태에 있는지" 의 핵심 신호로 보존된다. `status_reason` 은 에러 분류 코드만 담아 민감 정보 미포함 → 평문 저장.

### OAuthState.mode='reauthorize' 를 초기 install 에도 재사용한 이유 (2026-05-14)

Cafe24 Private 의 "테스트 실행" 흐름은 `pending_install` 행이 이미 존재하는 상태에서 OAuthState 를 새로 발급해 token 교환을 완료한다 — 의미상 "기존 행에 token 을 채운다" 라는 점에서 `mode='reauthorize'` 와 동일 (`mode='new'` 는 OAuthState 에 integrationId 가 없고 callback 이 previewToken 을 발급하는 다른 흐름). 별도 `mode='cafe24_private_install'` 을 신설하는 안도 검토했으나, callback 의 처리 분기가 동일 (integration row UPDATE) 이고 §10.2 step 4 가 이미 reauthorize 를 "기존 integrationId 의 credentials 갱신" 으로 정의하고 있어 enum 확장으로 얻는 이득이 없다. status 가 `pending_install` 이냐 `connected` 이냐에 따라 callback 의 후처리만 살짝 다를 뿐 (`installToken=null` 처리 등). 단, 향후 reauthorize 와 분리해야 할 동작이 늘어나면 별도 mode 신설 검토.

### CAFE24_PRIVATE_APP_ALREADY_CONNECTED 의 mall_id 비교 경로 (2026-05-15 갱신)

**현행 (V045+)**: `mall_id` 가 plain 컬럼 (`integration.mall_id`) 으로 분리되어 — `credentials.mall_id` (encrypted JSONB) 와 동일 값을 plain 컬럼으로 복제 — SQL WHERE 절로 직접 필터링·UNIQUE 제약 강제가 가능. 부분 UNIQUE 인덱스 `(workspace_id, mall_id) WHERE service_type='cafe24' AND mall_id IS NOT NULL` 이 같은 workspace 내 중복 cafe24 통합 생성을 SQL constraint violation 으로 거부 (TOCTOU race 차단). begin 핸들러는 in-memory 사전 체크 (connected → 409 / pending → reuse 분기 판단) 와 함께 SQL UNIQUE 를 backstop 으로 사용 — 두 검사를 모두 통과한 동시 INSERT 는 `23505 unique_violation` 으로 변환되어 같은 409 응답을 받는다.

**옛 (V045 이전, 2026-05-14)**: `mall_id` 가 암호화 JSONB 안에만 있어 SQL 필터 불가. begin 시점에 (a) 동일 workspace 의 cafe24 통합을 SQL 로 조회한 뒤 (b) ORM 경계의 자동 복호화로 `credentials.mall_id` 와 in-memory 비교. (a) O(N) decrypt 비용 + (b) SELECT 와 INSERT 사이의 TOCTOU 윈도우 두 가지 운영 위험.

**전환기**: V045 이전 행은 `mall_id` 컬럼이 NULL — 부분 UNIQUE 가 그런 행을 비교 대상에서 제외하므로 새 행과 충돌하지 않는다. 옛 행은 callback / re-auth 시점에 plain 컬럼이 backfill 되어 점진적으로 인덱스 범위로 편입된다. begin 시점의 in-memory 비교도 동일 전환기 동안 `credentials.mall_id` fallback 을 둔다.

### install_token 을 App URL path 식별 키로 승격 (2026-05-14)

원래 설계는 `GET /oauth/install/cafe24` 가 mall_id + HMAC 만 받고, 백엔드가 `pending_install` 행을 in-memory 로 100건 스캔하면서 mall_id 일치 candidates 의 client_secret 으로 HMAC 검증을 trial 했다. 두 가지 운영 위험이 누적됐다 — (a) 동일 mall_id 의 중복 `pending_install` 이 누적되면 HMAC 매칭이 비결정적이고 사용자가 보고 있는 행이 아닌 다른 행이 connected 처리될 수 있다, (b) `pending_install` 수가 커지면 O(N) 매칭 비용. App URL path 에 `install_token` 을 박으면 단일 row 조회로 고정되고, 토큰 자체가 random 이므로 추측 불가능한 식별자 역할도 겸한다. 옛 토큰 없는 경로는 별도 PR 로 즉시 제거됐다 (운영 등록자 0 인 시점에 정리 — 이후 등록자는 새 token-pathed URL 만 발급받는다).

(2026-05-15 후속: 토큰을 16바이트 base64url 22자로 단축 — 보안 동등성은 본 섹션 "Cafe24 App URL 100자 한도 대응" 항 참조)

`install_token` 은 App URL path 에 공개 포함되는 식별자로 평문 저장 — credentials/last_error 암호화 정책 대상 아님.

### CAFE24_INSTALL_INVALID_TOKEN(404) 의 보안 전제 (2026-05-14)

옛 `CAFE24_INSTALL_INVALID_HMAC(403, pending 미발견 포함)` 합산 정책은 토큰이 path 에 없던 시절 "어느 mall_id 에 pending 이 있는지" 정보가 응답 코드로 새지 않게 하는 안전망이었다. 새 디자인에서 `install_token` 은 **128-bit 이상 random** (현행 16바이트 base64url, 2026-05-15 단축 이전엔 32바이트 hex 256-bit) 이라 추측 불가능 — URL path 자체가 capability token 처럼 동작한다. 이 전제 하에서 "토큰 미존재" 케이스를 `CAFE24_INSTALL_INVALID_TOKEN(404)` 로 분리해도 무의미한 enumeration 이 일어나지 않는다. **이 전제가 깨지면** (예: **96-bit (12바이트) 미만으로의 토큰 길이 단축**, PRNG 변경, install_token 노출 사고) 다시 403 으로 통합해야 한다.

### install_token TTL 24h (2026-05-14)

**기존 spec §6 는 install timeout 시 `→ (삭제)` 를 명시했으나 본 개정에서 `→ expired (status_reason='install_timeout')` 로 번복한다.** 이유: 데이터 분석·감사 목적으로 보존이 유리하고, 사용자가 만료된 행을 보고 "왜 install 이 안 됐는지" 를 진단할 단서가 남아야 함. 자동 삭제는 더 이상 일어나지 않으며, manual delete 만 삭제 경로다.

Cafe24 Developers 의 앱 등록 → "테스트 실행" 까지의 사용자 작업 텀을 최대 1일로 가정한다. 더 길면 stale `pending_install` 행이 누적되어 §9.2 의 식별 키 룩업 성능과 §2.4 attention 카운트에 잡음. 더 짧으면 정상 흐름이 끊긴다 (사용자가 점심·미팅·휴일 사이클에 작업이 분할되기 쉬움). 24h 가 지나면 `status='expired'`, `status_reason='install_timeout'`, `install_token=NULL` 로 자동 전이. 만료된 행은 데이터 분석·감사 목적으로 삭제하지 않고 보존한다 (manual delete 별도).

**TTL 기준 (2026-05-15 갱신)**: `install_token_issued_at` 컬럼 (V044) 을 기준으로 한다 — `created_at` 이 아닌 토큰 발급 시각. 변경 3 (중복 pending_install 재사용) 으로 같은 mall_id 의 begin 재호출이 기존 row 의 install_token 만 갱신할 때, 새 토큰이 발급되자마자 24h 카운트가 끝나 있는 문제를 해소. callback 성공 시 `install_token` 과 함께 `install_token_issued_at` 도 NULL 로 비워진다. 옛 (V044 이전) 행은 NULL — 스캐너 SQL 이 `COALESCE(install_token_issued_at, created_at)` 로 fallback 해 legacy 의미를 유지.

`status_reason='install_timeout'` 인 expired 행에서는 reauthorize 버튼이 **비활성** 이다 — Private 앱은 재인증 진입점이 없고 cafe24 "테스트 실행" 만 정식이다. 사용자는 행을 삭제 후 새로 등록한다.

### status_reason `oauth_token_exchange_failed` 와 auth 도메인의 `token_exchange_failed` 구분 (2026-05-14)

소셜 로그인 흐름(`spec/2-navigation/10-auth-flow.md`) 의 URL param `error=token_exchange_failed` 와 본 spec 의 통합 callback `status_reason='oauth_token_exchange_failed'` 는 도메인이 다른 별개 신호다 — 전자는 user authentication 도메인, 후자는 integration credentials 도메인. 의도적으로 prefix `oauth_` 를 두어 grep·index 시 도메인 구분이 자명하도록 분리했다. 이름은 통일하지 않는다.

### Cafe24 Private 의 `connected → error(auth_failed)` 복구 경로 (2026-05-14, 2026-05-16 갱신)

일반 OAuth provider 는 `expired → connected` 가 reauthorize 또는 자동 refresh 로 복구된다 (§6 / data-flow §3.1). **Cafe24 Private 앱은 reauthorize 진입점이 없고**, refresh 도 token endpoint 가 mall 별이라 일반 흐름이긴 하지만 만약 refresh 가 실패해 `error(auth_failed)` 로 떨어지면 **복구 유일 경로는 삭제 후 재등록** 이다. 이건 Private 앱의 구조적 제약 (우리 서버가 OAuth 를 시작할 수 없음) 의 당연한 귀결이며, §6 전이 표의 `expired/error → connected (reauthorize)` 항은 Cafe24 Private 에는 적용되지 않음. UI 의 reauthorize 버튼 비활성 (§4.2) 이 이 사실을 반영한다.

> **(2026-05-16 갱신)** 옛 표기는 `expired(refresh_failed)` 였으나 REQ HIGH-2 로 refresh 실패 전이가 `error(auth_failed)` 로 통일됨 — [Rationale "refresh 실패 시 status_reason 통일"](#refresh-실패-시-status_reason-통일-2026-05-16) 참고. 본문은 새 status 명을 사용하지만 복구 경로의 본질 (삭제 후 재등록) 은 변경 없음.

### `pending_install` 은 필터 칩에 추가하지 않는다 (2026-05-14)

§2.3 상태 필터 칩은 `Connected / Expiring / Expired / Error` 4종 + All 로 운영된다. `Pending install` 은 사용자가 외부 흐름(Cafe24 Developers) 을 진행 중인 **정상 전환 상태** 로 보고 필터 칩에 추가하지 않는다. 별도 필터링 수요가 발생하면 후속 plan 으로 추가 검토.

### Cafe24 App URL 100자 한도 대응 — `/api/3rd-party/<provider>/` namespace 도입 (2026-05-15)

운영 사용자가 Cafe24 Developers 의 앱 URL 입력 필드에서 "허용 길이 초과" 경고를 받아 Private 앱 연동이 막혔다. 수동 테스트 결과 100자 제한이며, 호스트 변동 가능성까지 감안해 90자를 마지노선으로 잡았다. 현행 `/api/integrations/oauth/install/cafe24/<64-hex>` 은 호스트 32자 가정 135자로 한도 초과.

**두 부분을 모두 단축**:

- **path namespace**: `/api/integrations/oauth/install/cafe24/...` (39자) → `/api/3rd-party/cafe24/install/...` (30자). 옛 namespace 는 "사용자가 호출하는 통합 관리 API" 와 "3rd party 가 호출하는 콜백·설치 API" 가 한 prefix 에 섞여 있던 구조. 3rd-party 의미가 명확한 prefix 로 분리하면 IP allowlist · rate limit · 미래 webhook receiver 같은 per-provider 처리가 sub-tree 단위로 모인다.
- **install_token**: 32바이트 hex (64자) → 16바이트 base64url no-padding (22자). 128-bit 엔트로피는 capability token 으로 충분 (NIST SP 800-63B §A.7 권장 96-bit 이상, OWASP capability token 가이드 128-bit 권장). 옛 256-bit 는 과잉.

**provider-grouped vs action-grouped**: `/api/3rd-party/cafe24/install/:token` (provider-grouped) 대신 `/api/3rd-party/install/cafe24/:token` (action-grouped) 도 검토. 두 안 모두 길이 동일. provider-grouped 채택 이유 — (a) 향후 Cafe24 webhook receiver 등을 추가할 때 `/api/3rd-party/cafe24/webhook` 처럼 같은 sub-tree 에 모임. action-grouped 면 webhook 이 또 다른 top-level segment 가 되어 비일관. (b) 새 provider 가 들어올 때 모듈 단위 (`Cafe24ThirdPartyController` 등) 매핑이 자연스럽다. (c) per-provider 미들웨어 (IP allowlist 등) prefix 가 한 곳.

**google/github callback 도 동시 이동**: cafe24 만 옮기면 callback 경로가 provider 별로 갈라져 비대칭 (`/api/3rd-party/cafe24/callback` vs `/api/integrations/oauth/callback/google`). 일관성 우선 + OAuth 콘솔 재등록을 한 번에 마치는 편이 운영상 깔끔. 운영 영향: Google Cloud Console / GitHub OAuth App / Cafe24 Developers 모두 새 redirect URI 등록 필요 (배포와 동시). 사용자 소셜 로그인용 redirect URI (`/api/auth/oauth/:provider/callback`) 는 **별개로 유지** — 두 URI 가 같은 OAuth 콘솔에 공존한다 (§10.1 참고 노트 참조).

**callback URL 표기 컨벤션**: spec 본문·표·다이어그램은 모두 파라메트릭 단일 형식 `/api/3rd-party/:provider/callback` (`:provider ∈ {cafe24, google, github}`) 만 사용한다. 컨트롤러 구현이 provider 별 분리 (3개) 인지 파라메트릭 (1개) 인지는 구현 plan 의 결정 사항.

**옛 경로 미보전**: `/api/integrations/oauth/install/cafe24/:installToken` 및 `/api/integrations/oauth/callback/:provider` 핸들러는 즉시 제거. 운영자에게 OAuth 콘솔 갱신이 강제로 가시화되는 편이 누락 없이 안전. 이전 동일 패턴 (2026-05-14, 토큰 없는 경로 즉시 제거) 의 선례를 따른다. 옛 토큰 없는 `/api/integrations/oauth/install/cafe24` 의 410 Gone hint 라우트는 현재 코드에 존재하지 않으며 (followup plan 의 가설적 항목이었음), 본 PR 의 변경과 무관.

**기존 `pending_install` 행 마이그레이션 생략**: 옛 64자 hex 토큰을 가진 행은 이미 옛 라우트와 결속되어 있고, 새 라우트는 22자 base64url 만 발급한다. 새 라우트로 호출 자체가 path-format mismatch 로 404 가 되므로 자연 만료 (24h install_timeout 스캐너) 에 맡긴다. 실제 영향 범위는 보고된 사례 자체가 "길이 초과로 등록 못 함" 상태였으므로 거의 0.

### Cafe24 App URL 재호출 흐름 — install_token persistent 격상 (2026-05-15)

Cafe24 Developers Console 에 등록한 App URL 은 **두 가지 진입점** 모두에서 호출된다 — ① 초기 install (테스트 실행), ② **post-install navigation** (카페24 쇼핑몰 관리자의 "앱으로 가기" 버튼). ②번이 새로 발견된 요구사항으로, 옛 spec 의 single-use 가정 (callback 성공 시 `installToken=NULL` 소거) 과 충돌해 운영 사용자가 "앱으로 가기" 클릭 시 `404 CAFE24_INSTALL_INVALID_TOKEN` 을 받았다 (2026-05-15 사용자 보고).

**결정**: `install_token` 을 통합 lifetime 동안 보존되는 persistent identifier 로 격상.

- `pending_install → connected` 전이 시 token 보존 (옛: NULL 처리 → 새: 그대로).
- `handleInstall` 이 status 분기 — `pending_install` → OAuth authorize, `connected`/`error(*)`/`expired` → 우리 frontend redirect.
- HMAC 검증은 두 분기 모두 유지 (Cafe24 출처 보증).
- V045 partial UNIQUE `(install_token) WHERE install_token IS NOT NULL` 은 변경 없음 — 한 워크스페이스 안에서 같은 token 이 한 row 에만 매핑되는 invariant 보존.

**옛 connected 행 호환**: 본 변경 이전에 connected 로 전환되어 token 이 이미 NULL 인 통합은 새 동작이 작동하지 않는다 ("앱으로 가기" 클릭 시 여전히 404). 마이그레이션 plan 없이 자연 해소 — 사용자가 통합을 삭제 후 재등록하면 새 token 이 발급되고 새 동작 적용. 옛 행을 위해 추가 마이그레이션 비용을 들이지 않는 이유는 (a) Cafe24 Private 통합 사용자 수가 적고, (b) 재등록 비용이 SQL 마이그레이션 작성·테스트 비용보다 낮으며, (c) 옛 행의 client_secret 이 credentials 에 그대로 있어 token 재발급 자체는 가능하나 그 시점부터 다시 "테스트 실행" 부터 시작해야 하므로 결국 사용자 작업이 필요해 자동화 가치가 낮다.

**NULL 처리 유지 경로**: `pending_install → expired (install_timeout)` 의 24h TTL 만료는 token 을 NULL 로 소거 유지 — 사용자가 새 통합을 등록해야 하므로 옛 token 무효화가 정당. 통합 삭제 시도 row 삭제로 token 자동 소멸.

**post-install navigation 의 redirect target**: `${FRONTEND_URL}/integrations/<id>` 로 통일. 사용자가 카페24 admin 에서 우리 앱으로 들어올 때 그 통합의 상태·diagnostic 을 바로 확인할 수 있는 화면. 단순 `${FRONTEND_URL}/` 으로의 redirect 도 검토했으나 (워크플로 목록 등) 통합 컨텍스트 보존이 더 유익.

### Cafe24 Private request-scopes 흐름 (2026-05-15)

cafe24 Private 의 OAuth 시작은 우리 서버가 할 수 없어 `mode='reauthorize'` 에서 begin 이 `CAFE24_PRIVATE_APP_USE_TEST_RUN` 으로 거부한다. 옛 `/request-scopes` 는 내부적으로 begin 을 호출하며 mode `request_scopes` 도 같은 거부 분기에 걸려 동작 불가였다 (2026-05-15 운영 사용자 보고 — `CAFE24_INVALID_MALL_ID` 가 noise, 실제로는 Private 흐름이 막혀 있는 본질적 문제). 또한 옛 requestScopes 는 `entity.credentials.mall_id` 를 providerMeta 로 전달하지 않아 begin 의 cafe24 검증부가 missing mall_id 로 reject 도 함께 발생.

**결정**: `requestScopes` 가 cafe24 Private 을 감지하면 begin 우회 — 기존 `installToken` 보존 + `credentials.scopes` merge 갱신 + `{ mode: 'cafe24_private_pending', integrationId, appUrl, callbackUrl, scopesAdded }` 응답. 사용자가 Cafe24 Developers 의 앱 권한에서 추가 scope 활성화 후 "테스트 실행" 누르면 기존 install handler 가 작동 → callback → token 의 scope 가 확장된 새 token 으로 교체된다.

**왜 begin 우회인가**: begin 의 Private 거부는 정당 (OAuth 시작 불가). request-scopes 는 본질적으로 "OAuth 재시작 + 확장 scope" 인데, Private 에서는 Cafe24 측 진입점만 정식이므로 우리 화면은 안내만 담당. credentials.scopes merge 는 install handler 의 `OAuthState.requestedScopes` 채움에 영향을 주므로 사전에 갱신해 둔다.

**`request_scopes` 와 `reauthorize` 의 분리 유지**: 옛 코드는 두 mode 가 거의 동일 처리. 새 흐름에서도 Private 의 reauthorize 는 여전히 거부 (사용자가 reauthorize 의도로 누르면 안내 — Private 앱은 "테스트 실행" 만 정식). request_scopes 만 위 우회 분기로 처리.

**UI 안내 패턴 결정 (2026-05-16 추가)**: 분기 ② 응답(`cafe24_private_pending`) 에 대한 화면 표시는 modal/dialog 가 아닌 **inline alert + info 토스트** 로 정한다. modal 은 닫히면 잊혀지지만 Cafe24 측 작업(권한 활성화 → 테스트 실행)을 진행하는 동안 사용자가 안내를 계속 참조해야 한다 — 따라서 inline 으로 영구 표시. toast 는 응답 도착 신호로만 사용 (alert 가 본문). alert 생존 주기는 "다음 요청 시작 직전 reset" — `useMutation` 의 `onMutate` 훅에서 비워 옛 안내가 새 요청과 섞이지 않게 한다. 본 분기에서는 부모 페이지의 refetch 콜백을 호출하지 않는다 — token 갱신은 Cafe24 측 후속 callback handler (`handleInstall` 의 status 분기) 가 담당하므로 즉시 refetch 해도 변화 없음. `scopesAdded` 는 alert 안의 칩 목록으로 표시하되 빈 배열이면 칩 영역 자체를 숨긴다. UI 매핑 표는 §4.4.

### Cafe24 install_token mismatch 회복 흐름 (2026-05-15 후속)

운영 사용자 보고 — 새 통합 등록 후 Cafe24 Developers 에 App URL 을 등록했는데, "테스트 실행" 시 우리 endpoint 가 `404 CAFE24_INSTALL_INVALID_TOKEN` 응답. 원인: 사용자가 신규 통합 폼을 여러 번 제출하면서 (예: client_secret 오타 수정) idempotent begin 의 credentials-change 분기로 install_token 이 재발급됨. 마지막에 본 URL 만 옳고, 그 사이 Cafe24 Developers 에 등록한 옛 URL 은 stale.

옛 동작은 단호한 404. 사용자는 통합 상세 페이지에서 현재 App URL 을 확인해 Cafe24 Developers 를 수동 갱신해야 회복 가능. UX 가 뚝뚝 끊기고 운영 문의가 잦음.

**결정**: `handleInstall` 의 install_token 직접 매칭 실패 시 회복 분기 추가.

1. 같은 mall_id 의 cafe24 row 들 조회 (V046 partial UNIQUE 로 보통 1~2건).
2. 각 row 의 `client_secret` 으로 HMAC trial 검증.
3. **정확히 1개** validates → 그 row 의 OAuth/navigation 흐름으로 fall-through.
4. 0개 또는 2개+ → 기존 404 흐름 + HTML 안내 페이지 (사용자가 통합 상세의 현재 App URL 로 갱신).

비용: O(N) HMAC verify (회복 분기에서만, 정상 흐름 zero impact). 옛 폐기된 "100건 mall_id 스캔 + trial HMAC" (Rationale "install_token 을 App URL path 식별 키로 승격" 항 참조) 과 형태는 비슷하나 (a) 호출 빈도가 낮고 (404 fallback only), (b) **같은 workspace 안에서는** V046 partial UNIQUE `(workspace_id, mall_id) WHERE service_type='cafe24' AND mall_id IS NOT NULL` 이 같은 mall_id row 를 최대 1개로 제한하며, 회복 분기 스캔이 workspace 횡단이라도 같은 mall_id 를 둘 이상 workspace 에서 동시 사용하는 케이스는 드물어 N=1~2 가 실무 값 ("구조적 상한 N≤2" 가 아니라 workspace-scoped 1개 보장 + 실무적으로 소수). 정상 식별은 여전히 install_token 단일 row 조회.

**TOCTOU 부재**: 회복 분기는 SELECT + HMAC verify 만 수행하는 read-only 조회로 INSERT/UPDATE 가 없어 race 자체가 발생하지 않는다. begin 핸들러의 V045 partial UNIQUE backstop (`CAFE24_PRIVATE_APP_ALREADY_CONNECTED` Rationale 참조) 은 INSERT 단계의 동시 신청 차단을 담당하는 보완 보증이며, 본 분기와는 다른 시점의 보증.

**보안 분석**: HMAC 위조에는 client_secret 이 필요. client_secret 보유자는 정상 흐름으로도 동일 행위 가능 → 회복 흐름이 추가 권한을 부여하지 않음. install_token capability-token 가정 ("CAFE24_INSTALL_INVALID_TOKEN(404) 의 보안 전제" 항 참조) 는 그대로 유지 — 옛 URL 이 leak 되어도 HMAC 위조 없이는 진행 불가.

**모호 케이스 (2개+ HMAC 매칭)**: 같은 mall_id 가 두 workspace 에 등록되어 있고 동일 client_secret 을 공유하는 경우 (드문 케이스 — 한 Cafe24 앱을 우리 서비스의 둘 이상 workspace 에서 동시에 사용). 어느 row 를 선택할지 결정 불가 → 회복 포기 + 404. 회복 운영로그 (`[cafe24-install-recovery] ambiguous: N rows passed HMAC`) 가 진단을 보조.

**HTML 에러 페이지**: 404 (회복 실패 포함) 시 요청의 `Accept: text/html` 일 때 minimal styled HTML 페이지 렌더. error code/message + 회복 안내 ("통합 상세 페이지에서 현재 App URL 을 확인해 Cafe24 Developers 를 갱신하세요"). API 클라이언트 (JSON 기대) 는 기존 JSON 응답 유지.

### Cafe24 Public app 가용성 — env 기반 노출 (2026-05-15 후속)

Cafe24 Public app 흐름은 우리 서버의 `CAFE24_CLIENT_ID` / `CAFE24_CLIENT_SECRET` env 가 등록된 경우에만 동작 (앱스토어 등록 앱의 OAuth client credentials). env 가 미설정이면 Public 옵션을 선택해도 begin 이 `OAUTH_CONFIG_MISSING` 으로 거부 — 사용자 입장에서 dead-end UX.

**결정**: `/api/integrations/services` 응답의 cafe24 항목에 `meta.publicAppAvailable: boolean` 노출. `CAFE24_CLIENT_ID && CAFE24_CLIENT_SECRET` 둘 다 set 이면 true. Frontend 의 신규 통합 폼이 false 일 때 Public 옵션 토글에서 제거 + 기본값 `private` 강제 + 안내 문구 갱신.

**Private 는 항상 노출**: env 와 무관. 사용자가 직접 client_id/secret 입력하므로 deployment 의 env 상태에 의존하지 않음. Public 만 env 게이트 (사용자 명시 결정).

**왜 server-side 게이트인가**: 클라이언트가 env 를 알 길이 없으므로 server 가 single source of truth. `meta` 객체에 담아 향후 다른 가용성 hints (예: GitHub Enterprise URL 설정 여부 등) 도 같은 통로로 노출 가능.

### BullMQ `cafe24-token-refresh` 큐 — 멀티 인스턴스 race 해소 (2026-05-16)

[`spec/4-nodes/4-integration/4-cafe24.md` §9.6](../4-nodes/4-integration/4-cafe24.md#96-rate-limit-의-범위-한정) 가 "Redis 기반 분산 mutex 도입은 별도 spec 으로" 라는 미결로 남겼던 cross-pod refresh race 가 PR #56 의 BullMQ 큐 도입으로 해소됐다. 새 큐 `cafe24-token-refresh` 가 모든 cafe24 refresh 호출을 `jobId = integrationId` dedup 으로 클러스터 전체에서 직렬화한다.

**문제 정의 (옛 미결)**: 두 backend pod 이 같은 통합에 대해 동시에 refresh 를 시도하면 둘 다 Cafe24 `/oauth/token` 에 같은 old refresh_token 으로 요청을 보내 last-write-wins 로 한쪽 토큰이 orphan 되거나, Cafe24 의 rotation 정책에 따라 한쪽이 `invalid_grant` 401 을 받고 잘못 `error(auth_failed)` 격하될 수 있었다.

**채택 — BullMQ `jobId` dedup**:
- 같은 통합에 대한 동시 enqueue 가 `Queue.add({ jobId: integrationId })` 의 dedup 로 단일 worker 실행으로 모임. 모든 호출자가 `waitUntilFinished` 로 동일 worker 결과 공유.
- Worker (`Cafe24TokenRefreshProcessor`) 는 DB 재로드 + 재확인 short-circuit 후 `refreshAccessToken` 호출 → atomic 4-field UPDATE.
- proactive (API 호출 직전) + background (일일 스캐너) 양쪽 진입점이 동일 큐를 사용.

**기각된 대안**:
- **PostgreSQL advisory lock** (`pg_advisory_xact_lock(hashtext(integrationId))`): 코드 단순하지만 lock 보유 중 HTTP 요청(Cafe24 endpoint)을 transaction 안에 묶어야 해 DB 커넥션 점유 시간이 늘고, BullMQ 가 이미 스택에 있어 별도 메커니즘 추가의 운영 부담이 더 큼.
- **Redis redlock**: 인프라 의존성 추가, BullMQ 와 Redis 를 공유하긴 하지만 별도 lock 메커니즘 운영.
- **In-memory mutex (`withIntegrationLock`) 유지만**: 옛 single-pod 한계 그대로. 멀티 pod 배포 시 race 미해소.

**경계**:
- 본 큐는 **refresh 호출의 cross-pod 직렬화**만 담당. API 호출 자체 (Cafe24 leaky bucket 관리) 는 여전히 `Cafe24ApiClient` in-memory mutex 가 같은 pod 내에서만 직렬화 — Cafe24 leaky bucket 이 per-mall quota 라 cross-pod 직렬화 불필요 (per-pod backoff 신호로 충분). 자세한 분리는 §9.6 참고.
- 큐 미바인딩 환경 (unit test) 에서는 fallback 으로 in-process `refreshAccessToken` 직접 호출. production wiring 은 항상 큐 경유.

### `cafe24-background-refresh` 10일 임계 (2026-05-16)

Cafe24 의 `refresh_token` 은 14일 유효이며, Cafe24 가 매 refresh 마다 새 refresh_token 을 발급 (rotation). 활성 통합 (주 1회 이상 사용) 은 매 사용 시점에 proactive refresh 가 일어나 사실상 영구 유효하다. 그러나 14일 이상 idle 인 통합은 refresh_token 까지 만료되어 사용자가 재인증해야 한다.

**결정**: 일일 `cafe24-background-refresh` 잡이 `lastRotatedAt < now - 10d OR IS NULL` 인 connected cafe24 통합을 자동 refresh.

**임계 10일 근거**:
- 14일 유효 - 4일 안전 마진 = 10일. 갱신 실패 / 큐 적체 / 일일 잡 한 번 누락 시에도 마감 전 재시도 여지.
- 더 짧게 (예: 매일) 잡으면 Cafe24 leaky bucket 에 불필요한 부담. 운영 부하 vs 안전 마진 trade-off.
- 더 길게 (예: 12일) 잡으면 안전 마진 부족.

**신규 통합 NULL 처리**:
- `integrations.service.create()` 가 cafe24 신규 통합 row 생성 시 `lastRotatedAt = new Date()` 로 명시 초기화 (PR #67 DB-1 fix).
- 옛 row (PR #67 이전) 또는 다른 진입점에서 NULL 로 저장된 경우를 대비해 쿼리 조건이 `Or(LessThan(cutoff), IsNull())` belt-and-suspenders.

**경계**: 본 잡은 enqueuer 역할이며 실제 refresh 는 `cafe24-token-refresh` 큐의 worker 가 수행 (역할 분리). proactive call 과 같은 jobId dedup 으로 충돌 없이 협력.

### Cafe24 install_token mismatch 회복 흐름 — 보안 전제 (2026-05-16)

`tryRecoverByMallId` (Rationale "Cafe24 install_token mismatch 회복 흐름" 의 회복 분기) 가 production 코드에 존재한다. 이는 옛 spec §9.8 의 "100건 스캔 + trial HMAC 폐기" 와 **표현상 충돌**하나 본질적으로 다른 경로다.

**구분**:
- 옛 폐기 흐름: install_token 자체가 없던 시절의 **모든 호출에 적용**되는 식별 전략. mall_id 만으로 매칭하고 HMAC trial 로 row 를 골랐다.
- 새 회복 흐름: **단일 row 조회 실패 시에만** fall-back 으로 작동. 정상 흐름은 install_token 단일 row 조회 그대로.

**보안 전제 — HMAC 검증 유지**: 회복 분기에서도 mall_id 매칭 후보 row 들의 client_secret 으로 HMAC 검증을 1회씩 수행. HMAC 통과는 client_secret 보유의 증명이므로 권한 escalation 없음. install_token capability-token 가정 ("CAFE24_INSTALL_INVALID_TOKEN(404) 의 보안 전제" 항) 은 본 회복 흐름이 깨뜨리지 않는다 — 옛 install_token 이 leak 되어도 HMAC 위조 없이는 회복 분기를 통과 못 함.

**DoS 보호**: 코드 상수 `RECOVERY_CANDIDATE_LIMIT = 5`. 후보 overflow 시 회복 포기 (404) — workspace 횡단으로 같은 mall_id 가 5개 이상이면 HMAC trial 자체를 거부해 amplification 차단. 정상 운영에서 같은 mall_id 의 cafe24 row 는 보통 1~2개라 영향 없음.

**로그 정책 (PR #67 SEC H-2)**: 회복 시도·결과 로그에서 cross-tenant Integration UUID 와 install_token prefix 를 제거. mall_id + status 만 로깅해 enumeration 단서를 줄임.

### refresh 실패 시 status_reason 통일 (2026-05-16)

spec §6 가 옛 표기 `connected → expired | refresh fail` 로 명시했으나, 구현은 refresh 실패 시 `error(auth_failed)` 로 전이했었다. UI 분기·재인증 안내 문구·`Notification.type` 발사 정책 (§11.2) 에 일관성 결손.

**결정**: `error(auth_failed)` 채택. 옛 `expired (refresh_failed)` 분기 폐기. `expired` status 는 두 경로로 한정 — (1) refresh_token 없는 일반 OAuth provider (예: GitHub) 의 `token_expires_at` 만료 (`status_reason='token_expired'`), (2) Cafe24 Private 의 `pending_install → expired (install_timeout)`. 즉 본 변경은 cafe24 등 refresh_token 보유 provider 의 refresh 실패 경로에만 영향을 주고, `token_expires_at` 만료 자체 (§11.1 `connected-expiry` 스캐너) 는 그대로 유지된다.

**이유**:
- (a) UI 가 reauthorize 액션을 권장하기에 더 자연스러움. `expired` 는 "자동 재발급 시도 후 만료" 의미가 강해, terminal refresh_token 만료 (사용자 재인증 필요) 와 의미가 어긋남.
- (b) refresh_token 자체 만료 (terminal — Cafe24 가 14일 후 invalidate) 와 access_token 만료 (자동 회복 가능 — refresh 가능) 를 의미적으로 구분 보존. `error(auth_failed)` 는 전자 (사용자 액션 필요), `expired` 는 일반 OAuth provider 의 후자 신호로 분리.
- (c) PR #67 의 REQ-C2 (transport 3회 → `error(network)`) 와 같은 `error(*)` 도메인에서 일관 분류.

**데이터 모델 변경 없음** — `Integration.status_reason` 컬럼 값 정의만 갱신 (`spec/1-data-model.md §2.10` 참고): `expired` 의 사유에서 `refresh_failed` 제거, `error` 의 사유에 `auth_failed` / `insufficient_scope` / `network` 보존. `token_expired` 는 일반 OAuth provider 의 `expired` 경로 (refresh_token 없는 provider) 용으로 유지.

**알림 정책 (§11.2)**: `integration_expired` 알림은 `expired` 전이 중에서도 `token_expired` 경로에만 발사. `install_timeout` 도 `expired` 전이지만 별도 결정으로 미발사 — 아래 ["install_timeout 알림 미발사"](#install_timeout-알림-미발사-2026-05-16) 항 참조. `error(*)` 전이는 별도 알림 없이 UI 배지로만 통지. 향후 별도 알림 타입 필요 시 `integration_action_required` 등 신설 검토.

### install_timeout 알림 미발사 (2026-05-16)

PR #75/#76 의 spec 표현 ("expired 전이 두 경로 — token_expired, install_timeout — 모두 발사") 이 코드 미확인 상태에서 기재된 오기. `expirePendingInstalls()` (`backend/src/modules/integrations/integration-expiry-scanner.service.ts:251-287`) 는 bulk UPDATE 만 수행하고 `notificationsService.createMany` 호출이 없으며, 본 결정으로 그 동작이 의도임을 명문화한다.

**결정**: `pending_install → expired (install_timeout)` 전이는 `integration_expired` 알림 **미발사**.

**이유**:
- (a) **사용자 인지** — `pending_install` 상태는 사용자가 외부 흐름 (Cafe24 Developers 의 "테스트 실행") 을 직접 진행 중인 명시적 상태. 24h 안에 install 을 완료하지 못했다는 건 본인이 시작점·진행 상황을 알고 있을 가능성이 큼.
- (b) **UI 통지 충분** — 통합 상세 페이지의 status 배지 + 목록 페이지의 "Need attention" 배너로 통지. 별도 알림은 over-noise.
- (c) **일관성** — `pending_install` 의 다른 callback 실패 분기 (`oauth_token_exchange_failed`, `oauth_state_mismatch`, `oauth_state_expired`) 도 알림 미발사. install_timeout 만 발사하면 일관성 결손.
- (d) **"조용한 전이" 원칙의 연장선** — `install_token=NULL` 소거 (Rationale "install_token TTL 24h") 와 같은 결정 흐름. 외부 흐름 미완료가 자명한 상태 변화는 외부에서 들어오는 새 시도가 아닌 한 알림 가치 낮음.

기각된 옵션 (install_timeout 알림 발사): UI 배지로 충분히 통지되는 자기-시작 상태에 알림을 더하면 over-noise. 향후 별도 도메인 알림 (예: `integration_action_required`) 신설 시 재검토 가능.

**범위**: 본 결정은 `Notification.type='integration_expired'` 미발사만 다룬다. UI 배지·다음 install 시도 시 `install_token=NULL` 로 인한 404 등 다른 동작은 영향 없음.
