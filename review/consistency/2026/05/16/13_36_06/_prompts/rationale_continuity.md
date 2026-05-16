# Rationale 연속성 Check Payload

본 파일은 orchestrator 가 Rationale 연속성 checker 용으로 작성한 입력입니다. target 문서가 기존 spec 의 `## Rationale` 에서 이미 기각·폐기된 결정을 다시 도입하거나 합의 원칙을 무시하지 않는지 분석한다.
sub-agent 의 system prompt 에 정의된 호출 규약·등급 기준·출력 형식을 그대로
따르되, 분석 시 아래 "점검 관점" 을 빠짐없이 적용하세요. 결과는 `output_file`
인자에 review.md 로 Write 하고 호출자에게는 STATUS 한 줄만 반환합니다.

## 점검 관점 (Rationale 연속성)

1. **기각된 대안의 재도입** — target 이 과거 Rationale 에서 명시적으로 거부한 대안을 다시 채택하고 있는가 (이유 명시 없이)
2. **합의된 원칙 위반** — Rationale 에 박혀있는 설계 원칙을 따르지 않고 있는가
3. **결정의 무근거 번복** — 과거 결정을 뒤집으면서 새 Rationale 를 함께 작성하지 않고 있는가
4. **암묵적 가정 충돌** — Rationale 에 기록된 시스템 invariant 를 우회하는 설계가 들어와 있는가

## 검토 모드
spec draft 검토 (--spec)

## Target 문서
경로: `spec/2-navigation/4-integration.md`

```
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
│  ⚠ 3 integrations need attention                        │
│     Expired 1 · Expiring 1 · Error 1 · Click to filter  │
│                                                         │
│  ┌──────────────────┐  ┌──────────────────┐             │
│  │ 🔍 Search...     │  │ Scope: All ▼     │             │
│  └──────────────────┘  └──────────────────┘             │
│  [All] [Google] [GitHub] [HTTP] [DB] [Email] [Webhook]
│  [All] [Attention] [Connected] [Expiring] [Expired] [Error] │
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
| 상태 칩 | `All` / `Attention` / `Connected` / `Expiring` (7일 이내) / `Expired` / `Error`. 단일 선택 |

`Attention` 은 §2.4 배너와 동일한 합집합 — `Expired ∪ Expiring ∪ Error` — 을 단일 칩으로 노출한다. 한 칩만 누르면 "지금 손봐야 하는 통합" 을 모두 보여주는 게 사용자 멘탈 모델에 맞고, 단일 선택 칩 모델을 깨지 않으면서 합집합을 제공할 수 있는 유일한 표현이다 (Rationale "Attention 가상 필터값" 항 참고).

※ `expiring` 과 `attention` 두 값은 DB `Integration.status` Enum 에는 존재하지 않는 **가상 필터값(virtual filter)** 이다 — 백엔드 쿼리 빌더가 §9.1 의 `status` 파라미터를 받아 합집합 WHERE 절로 변환한다. DB Enum (`connected`/`expired`/`error`/`pending_install`) 자체를 확장하지 않는 것은 영속화되는 상태와 화면 필터링용 술어를 분리하기 위함이다.

※ 상태 칩에 `pending_install` 은 포함하지 않는다 — 외부 흐름(Cafe24 Developers "테스트 실행") 진행 중 정상 전환 상태이며, 사용자가 명시적으로 필터링할 수요가 낮다. 별도 수요 발생 시 후속 plan 으로 재검토 (Rationale 참고).

모든 필터는 URL 쿼리 파라미터(`q`, `scope`, `serviceType`, `status`)로 동기화되어 공유/새로고침 시 복원된다.

### 2.4 "Need attention" 배너

- **포함 조건**: `status IN (expired, error)` OR `(status='connected' AND token_expires_at IS NOT NULL AND token_expires_at > NOW() AND token_expires_at <= NOW() + INTERVAL '7d')`. `pending_install` 은 사용자가 외부(Cafe24 Developers)에서 흐름을 진행 중인 정상 상태로 보고 배너에서 제외 — `status_reason` 이 채워진 케이스도 동일. `install_timeout` 사유로 `expired` 가 된 Cafe24 Private 행은 attention 에 포함된다 (사용자 조치(삭제 후 재등록)가 필요한 정상 운영 신호).
- **표시 내용 (분해 카운트)**: 한 줄 요약 (`"통합 N건이 주의가 필요해요"`) + 그 아래에 분해 카운트 (`"만료 X · 만료 임박 Y · 오류 Z"`). 카운트가 0 인 카테고리는 표시하지 않는다.
- **톤 강조**: 기본 톤은 amber (warning). 분해 카운트의 `error ≥ 1` 이면 좌측 dot / border 색을 red 로 강조해 가장 시급한 사유를 시각적으로 알린다 — 텍스트는 동일.
- **클릭 동작**:
  - 합계 ≥ 2 → `?status=attention` 으로 URL 갱신 (§9.1 가상 필터값) → 같은 페이지에 합집합 결과 표시.
  - 합계 = 1 → 그 한 건의 detail 페이지(`/integrations/<id>`) 로 직접 이동. 필터링 단계는 우회한다 (UX 단축 — 1건이면 사용자가 어차피 그 건으로 갈 것).
- **0건이면 비표시**.
- URL 직접 진입 (`/integrations?status=attention`) 도 동일 합집합 결과를 보여준다 (`Attention` 칩이 활성화된 상태).

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
| GET | `/api/integrations` | 목록 조회. 쿼리: `q`, `scope`, `serviceType`, `status`, `page`, `limit`. `status` 허용값 = `connected` / `expiring` / `expired` / `error` / `attention` — 이 중 `expiring` 과 `attention` 은 **가상 필터값** 으로 DB Enum 에는 없고 백엔드 쿼리 빌더가 합집합 WHERE 절로 변환한다 (`expiring` = `status='connected' AND token_expires_at within 7d`, `attention` = `Expired ∪ Expiring ∪ Error`). 페이지네이션 응답 형식은 [API 규약 §5.2](../5-system/2-api-convention.md#52-목록-응답) 준수. |
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

> 만료 스캐너는 **네 개의 독립 BullMQ job** (`connected-expiry` / `pending-install-ttl` / `usage-log-prune` / `cafe24-background-refresh`) 으로 운영된다 — 각 job 은 자체 retry (`attempts: 3`, 60s exponential backoff) 와 큐 메트릭을 가지므로 한 패스의 실패가 다른 패스의 실행을 막지 않는다. Cafe24 Private 의 `pending_install` 24h TTL 만료는 `pending-install-ttl` job 이 담당. Cafe24 의 `refresh_token` 14일 만료 전 자동 갱신은 `cafe24-background-refresh` job 이 enqueuer 역할로 담당 (실제 갱신은 `cafe24-token-refresh` 큐의 worker — §10.5 참조). 상세 흐름·격리 정책은 [data-flow §1.4](../data-flow/5-integration.md#14-oauth-만료-스캐너-bullmq-integration-expiry) 참조.

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

### Attention 가상 필터값 — Expired ∪ Expiring ∪ Error 를 단일 칩으로 노출 (2026-05-16)

§2.4 "Need attention" 배너의 클릭 동작이 spec 텍스트("`Expiring | Expired | Error` 로 자동 전환")와 구현 사이에서 어긋나 사용자가 알림에 표시된 항목을 필터 페이지에서 찾지 못하는 사례가 보고됐다. 원인은 (a) UI 의 상태 칩 모델이 단일 선택이라 세 상태를 동시에 전환할 표현이 없었고, (b) 구현이 차선책으로 `?status=expiring` 단일 필터로만 보냈기 때문이다. 본 spec 개정에서 두 가지를 정리한다.

**1. UI: `Attention` 칩 신설.** `Expired ∪ Expiring ∪ Error` 합집합을 단일 값으로 추가해 단일 선택 칩 모델을 유지하면서 합집합을 제공한다. 멀티 선택 칩 도입이나 `?status=expiring&status=expired` 같은 multi-value 쿼리도 검토했으나 (a) URL 공유성 저하, (b) 다른 단일 필터(`scope`, `q`)와의 일관성 깨짐, (c) 분석/감사 시 "사용자가 어떤 카테고리를 봤는지" 의 의도 신호가 흐려짐 으로 기각.

**2. 백엔드: 가상 필터값(virtual filter) 규약.** `Integration.status` DB Enum 은 `connected` / `expired` / `error` / `pending_install` 4개로 유지하고, API 필터의 `status` 파라미터 값 공간은 이를 포함하면서 추가로 `expiring`(이미 도입), `attention` 두 가상값을 갖는다. 가상값은 영속화되는 상태가 아니라 화면 필터링용 술어 — 백엔드 쿼리 빌더가 WHERE 절을 합성한다. 다음 두 원칙을 따른다:

- **이름 분리**: 가상값 이름은 DB Enum 과 겹치지 않는다 (`expiring`, `attention` 모두 DB 에 없음). 사용자가 칩 라벨에서 본 단어가 그대로 URL 파라미터로 들어간다.
- **DB 엔티티 비확장**: 가상값을 위해 Enum 을 늘리지 않는다 — 영속 상태와 화면 술어를 섞으면 state machine(§6) 이 비대해진다.

**3. 배너 톤·점프 동작 보강.** 분해 카운트(만료 X · 만료 임박 Y · 오류 Z) 를 한 줄에 표시해 어떤 카테고리가 몇 건인지 한눈에 보이게 한다. `error ≥ 1` 일 때 dot 색을 amber 에서 red 로 미세 강조 — 사용자가 "어떤 종류가 섞여있는지" 를 카피 읽기 전에 시각적으로 인지하게 한다. 합계 = 1 일 때는 필터링 단계가 잉여이므로 그 한 건의 detail 로 직접 점프 — 사용자가 어차피 그 건을 열어볼 것이므로 단축이 자연스럽다. "1건일 때만" 의 분기는 합계 ≥ 2 일 때 필터링이 필요한 일반 케이스와 명확히 분리된다 (필터링 → detail 의 한 클릭을 줄임).

(개정 전 텍스트는 "클릭 시 상태 필터를 `Expiring | Expired | Error`로 자동 전환" 한 줄로, 단일 선택 칩과 모순되는 의도만 남기고 구현 표현은 위임 상태였다. 본 개정으로 의도가 실제 구현 가능한 형태(`Attention` 단일 칩 + `?status=attention`)로 닫힌다.)

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

```

## 관련 Rationale 발췌

### Rationale 발췌

#### `spec/1-data-model.md` 의 Rationale

## Rationale

### Execution.execution_path → ExecutionNodeLog (V035 → V036)

옛 `execution.execution_path UUID[]` 컬럼은 단일 인스턴스 환경에서는 동작했으나, 다중 backend 인스턴스가 동시에 `array_append()` 로 갱신할 때 인스턴스 간 절대 순서가 보장되지 않았다. 대체 모델로 append-only 테이블 `execution_node_log` 를 도입했고, BIGSERIAL `id` 가 PostgreSQL sequence (concurrency-safe) 로 부여되므로 `(execution_id, id)` 정렬이 곧 노드 실행 순서가 된다.

이행은 lock 영향 최소화를 위해 두 단계로 분리되었다.

- `backend/migrations/V035__execution_node_log_create.sql` — 테이블 생성 + `UNNEST WITH ORDINALITY` 로 기존 array 데이터 이행. `executeInTransaction=false`.
- `backend/migrations/V036__execution_drop_execution_path.sql` — 컬럼 DROP. `lock_timeout=3s` 로 운영 영향 최소화.

설계·운영 세부는 [`spec/5-system/4-execution-engine.md §7.4`](./5-system/4-execution-engine.md) 참고. 외부 API 응답의 `executionPath: string[]` 시그니처는 유지되며, `findById` 가 본 테이블의 정렬 쿼리로 채운다.

### install_token 형식 (32byte hex → 16byte base64url, 2026-05-15)

옛 32바이트 hex (64자) 는 Cafe24 Developers App URL 입력 필드의 100자 한도를 path prefix 단축만으로는 못 맞춰 함께 단축. 16바이트 (128-bit) 면 capability token 으로 NIST/OWASP 권장 (96-bit 이상) 을 충분히 상회. DB 컬럼 `install_token` 은 `String?` 으로 길이 제약이 없어 schema 변경 불필요 — 마이그레이션 entry 신규 추가 없음. 상세 배경·대안 비교는 [Spec 통합 화면 §9.2 Rationale "Cafe24 App URL 100자 한도 대응" 항](./2-navigation/4-integration.md#rationale).

#### `spec/2-navigation/1-workflow-list.md` 의 Rationale

## Rationale

### 1. "공유 워크플로우" 의 정의 — 팀 워크스페이스 전체

NAV-WF-07 의 "공유" 기준으로 두 옵션을 검토했다:

- (a) **팀 워크스페이스에 속한 모든 워크플로우** = 공유 (선택)
- (b) `createdBy ≠ 현재 사용자` 또는 명시적 sharedWith 컬럼 = 공유 (폐기)

(a) 를 채택한 이유:

- PRD 의 NAV-WF-07 원문("팀 워크스페이스에서 공유된 워크플로우 구분 표시")이 워크스페이스 단위의 격리·공유를 전제로 하고 있어, 워크스페이스 = 공유 단위라는 정의와 자연스럽게 부합한다.
- 데이터 모델상 워크플로우 격리는 이미 `workspaceId` 로 처리되며(`backend/src/modules/workflows/entities/workflow.entity.ts`), `sharedWith` 컬럼이나 추가 마이그레이션 없이 구현 가능하다.
- (b) 는 같은 팀 안에서 "내 것" 과 "남의 것" 을 다시 분리하는 정의지만, 그 구분은 §2.3 의 **소유 필터** 가 담당하므로 뱃지에서까지 중복으로 표현할 필요가 없다.

결과적으로 뱃지(워크스페이스 = 공유)와 필터(작성자 단위 세분화)가 역할 분담된다.

#### `spec/2-navigation/10-auth-flow.md` 의 Rationale

## Rationale

### R-1. 인증 화면 배경 — 그라데이션 복원 (2026-05-15 롤백)

§1 배경 기술을 *"제품 브랜드 색상 또는 그래디언트"* (main 표현) 로 **복원**. 이전 Stage 1 (commit `b6267429`) 에서 *"`soil-50` 단색, 그라데이션 금지"* 로 구체화했으나, 동일자 §8 부분 롤백 (`spec/6-brand.md` R-13) 에서 `soil-50` 토큰이 §8.2 와 함께 폐기되어 본 표현도 함께 복원했다.

코드 상태: `frontend/src/app/(auth)/layout.tsx` 는 `bg-gradient-to-br from-[hsl(var(--background))] via-[hsl(var(--muted))] to-[hsl(var(--background))]` 패턴 — Shadcn neutral 그라데이션. 로고는 `#111e14` 라운드 컨테이너 안에 별도 배치 (그라데이션 위 dark surface 로 시인성 확보).

### R-2. `[Logo]` 자리 변종 명시 (2026-05-15 정정)

§1 의 `[Logo]` 플레이스홀더에 *"Full logo 변종 사용"* 명시. 이전 Stage 1 에서는 *"Full logo (light)"* 로 라이트 한정했으나, §8 부분 롤백 (`spec/6-brand.md` R-13) 에서 라이트/다크 자산 선택을 노출 자리의 surface 톤에 위임하는 형태로 바뀌어 본 행에서도 라이트 한정을 제거.

본 문서는 로고가 노출되는 **자리**를 정의하고, 자리에 들어가는 변종·라이트/다크 선택은 brand spec §8.4.1 매트릭스 + §8.4.6 의 노출 자리 규정을 따른다 (R-9 — 브랜드 spec 의 라우트 spec 우선권).

근거 출처: `spec/6-brand.md §8.4.1`, `§8.4.6`, `R-13`. 사전 일관성 검토 세션: `review/consistency/2026/05/15/18_36_51/` (Stage 1), `review/consistency/2026/05/15/23_45_11/` (롤백).

#### `spec/2-navigation/9-user-profile.md` 의 Rationale

## Rationale

### `/profile` 편집 인터랙션의 분리 (§2)

초기 와이어프레임은 사용자 정보·환경설정·비밀번호 변경을 한 페이지의 폼으로 묶고 하단 단일 `[Save Changes]` 버튼으로 모두 커밋하는 형태였다. 다음과 같은 footgun 이 식별되어 현재의 하이브리드 편집 패턴(인라인 토글 + sub-route + diff 확인 모달) 으로 개정했다.

- **이질적 변경의 의도 충돌** — 자격증명(비밀번호)·개인정보(이름·아바타)·환경설정(언어·테마) 은 위험 수준이 서로 다른데도 한 번의 클릭이 모두를 동시에 PATCH 하는 구조였다. 사용자 의도와 실제 결과가 어긋날 가능성이 컸다.
- **무방비 편집 활성화** — 모든 input 이 디폴트로 활성화되어 있어 단순 탐색 중에도 실수 입력이 그대로 저장 대상이 되었다.
- **세션 강제 종료 패턴과의 톤 불일치** — `/profile/sessions` 의 강제 종료는 이미 `RevokeConfirmDialog`(password/TOTP 재인증) 로 명시적 의도를 분리해 안전하게 운영 중인데, 같은 영역의 다른 민감 동작은 그 톤을 따르지 못하고 있었다.

해법으로 (a) `/profile` 을 디폴트 readonly 로 두고 카드 단위 [편집] 토글로 의도를 분리, (b) 저위험 항목(이름·환경설정) 도 저장 직전 변경 전·후 diff 확인 모달을 한 단계 거치게 해 실수 방지, (c) 고위험 항목(비밀번호) 은 별도 sub-route 진입 자체가 의도 표명 역할을 하도록 채택했다. 이메일은 기존 결정대로 "별도 변경 (확인 메일)" 으로 본 화면에서 분리한 상태를 유지한다.

폐기된 대안:

- **모달 일원화** — 모든 편집을 모달로 처리(인라인 토글 없음). 환경설정처럼 자주 만지는 항목까지 매번 모달이 떠야 해 마찰이 과도하다고 판단.
- **전 항목 sub-route** — 환경설정·이름까지 모두 별도 라우트로 분리. 라우팅·뒤로가기 비용이 가치 대비 과도. 위험 수준에 비례한 마찰이 더 합리적.
- **단일 페이지 + 섹션별 Save 버튼** — 폼은 그대로 두고 Save 만 섹션 단위로 쪼개기. "폼이 디폴트로 노출되어 무방비" 라는 핵심 문제를 해결하지 못함.

#### `spec/2-navigation/_layout.md` 의 Rationale

## Rationale

### R-1. 사이드바 로고 변종 규칙 (2026-05-15)

§2.1 로고 행에 expanded/collapsed 변종 규칙을 추가한 이유: 본 문서는 사이드바의 **자리**만 정의하고, 자리에 들어가는 로고 변종·색은 `spec/6-brand.md §8.4` (brand spec) 가 단일 진실로 결정한다. 본 행은 brand spec §8.4.6 의 결정(expanded → Full logo / collapsed → Icon mark)을 자리 정의에 반영한 것이다.

근거 출처: `spec/6-brand.md §8.4.6` (로고 노출 자리) 및 동 문서 R-9 (브랜드 spec 의 라우트 spec 우선권). 사전 일관성 검토 세션: `review/consistency/2026/05/15/18_36_51/`.

### R-2. §2.1 로고 행 정정 (2026-05-15 롤백)

§8.2 컬러 토큰 정식화 폐기(`spec/6-brand.md` R-13) 와 함께, 본 §2.1 의 *"Full logo (light)"* 표현에서 *(light)* 한정을 제거. 라이트/다크 자산 선택은 노출 자리(surface) 의 배경 톤에 따라 brand spec §8.4 가 결정한다. R-1 의 §8.4.6 참조는 본 롤백 후에도 유효하며, 다만 §8.4.6 표 자체가 *"라이트/다크 자산 선택은 노출 자리에 맞춤"* 표현으로 정정되었다.

사전 일관성 검토 세션: `review/consistency/2026/05/15/23_45_11/`.

#### `spec/3-workflow-editor/4-ai-assistant.md` 의 Rationale

## Rationale

본 spec 결정 사항의 배경·근거. memory/ 에 남아있던 작업 메모를 inline 흡수한 것이며, 폐기된 대안과 1회성 분석 자료는 `plan/complete/archive/from-memory/` 를 참조.

_원본 메모: memory/workflow-ai-assistant-decisions.md_

### Workflow AI Assistant — 기획 결정 메모

Workflow AI Assistant(에디터 내 채팅형 AI) 스펙 작성 시 사용자와 합의한 결정 사항을 구현자가 재참조할 수 있도록 정리한다.

#### 확정된 결정 사항

| 항목 | 결정 | 근거 |
|------|------|------|
| 제품 명칭 | **Workflow AI Assistant** / 워크플로우 AI 어시스턴트 | PRD/Spec/i18n 전 영역에서 통일 사용. "Copilot", "AI Workflow Builder" 후보는 기각 |
| PRD 배치 | `prd/2-workflow-editor.md` §10, 요구사항 ID 접두사 `ED-AI-*` | 에디터 내부 UI/UX가 주 영역이므로 에디터 문서에 포함. PRD 6에서는 cross-ref만 |
| 채팅 세션 영속화 | **서버 저장** (신규 엔티티 `AssistantSession`, `AssistantMessage`) | 페이지 새로고침·재접속 시 이어서 대화 지원. 관련: `spec/1-data-model.md` §2.20~2.21 |
| 변경 적용 방식 | 즉시 반영 + Undo (`editor-store` 재사용) | 기존 자동 저장/Ctrl+S 흐름과 일관. DB 영구 기록은 사용자의 Save를 통해서만 |
| 스트리밍 | SSE + `LLMClient.stream()` 신규 메서드 | 관련: `spec/5-system/7-llm-client.md` §8 |
| 스트리밍 v1 지원 provider | OpenAI, Anthropic만 | Google/Azure는 Tool-use 포맷 차이로 후속. 미지원 provider 선택 시 `ASSISTANT_STREAMING_UNSUPPORTED` 에러 |
| NodeSettings Panel과 동시 오픈 | **상호 배타** (Assistant 열면 Settings 닫힘) | MVP 단순화. 사용자 피드백에 따라 후속 버전에서 나란히 배치 가능 |
| Assistant의 편집 권한 | `editor` 역할 이상 | 기존 RBAC 규약 재사용 |

#### 구현 시 유의 사항 (승인된 기술 플랜 `~/.claude/plans/ui-partitioned-porcupine.md` 대비 변경점)

원래 기술 플랜에는 "채팅 히스토리는 in-memory only (MVP)"로 명시되어 있었으나, **기획 단계에서 서버 영속화로 변경**되었다. 따라서 다음 작업이 추가된다:

1. **DB 엔티티 2개 신규**: `AssistantSession`, `AssistantMessage` (Flyway 마이그레이션 필요)
2. **REST API 5개 신규**: `GET/POST/PATCH/DELETE /workflow-assistant/sessions`, `GET /workflow-assistant/sessions/:id`. SSE 엔드포인트는 `POST /workflow-assistant/sessions/:id/messages`로 경로 변경 (기존 플랜의 `/workflow-assistant/message`가 아님).
3. **백엔드 Service**: 세션/메시지 CRUD + 대화 컨텍스트 조립(최근 30턴 프롬프트 주입 룰).
4. **프론트엔드 스토어**: `assistant-store.ts`가 서버 세션 id를 들고 있어야 하며, 패널 오픈 시 `GET /sessions?workflowId=...`로 기존 세션을 로드.
5. **Cascade 삭제**: `Workspace` 삭제 → `Workflow` 삭제 → `AssistantSession` 삭제 → `AssistantMessage` 삭제. Flyway 마이그레이션에서 ON DELETE CASCADE FK 설정.

#### 미결 UX (발견 시 확인 필요)

- 세션 보관 기간/자동 archive 정책 — 현재 Spec은 "수동 삭제까지 영속". 향후 워크스페이스별 용량 제한과 연계 가능.
- 세션 공유/내보내기 — v1 스코프 밖 명시. 팀 워크스페이스 RBAC 선행 필요.
- Plan 카드의 step을 사용자가 직접 편집/체크 가능한지 — 현재 Spec은 "사용자 조작 불가, 진행도 표시 전용"(§3.3). 필요해지면 별도 RFC.

_원본 메모: memory/workflow-assistant-prompt-restructure.md_

### Workflow AI Assistant 시스템 프롬프트 재구조 (2026-04-22)

`backend/src/modules/workflow-assistant/prompts/system-prompt.ts` 를 5블록 구조로 재편한 작업의 핵심 결정 사항과 향후 주의점을 정리한다.

#### 왜 바꿨나

##### 이전 구조의 문제

1. **규칙 중복.** "plan-only vs execution turn" 분기가 5군데(L84/L85/L129/L138–153/L251)에 흩어져 LLM이 매 턴 파싱해야 했다. `planStepId` 태깅 규칙도 4군데, `get_node_schema` 선행 규칙도 4군데 반복.
2. **토큰/캐시 비효율.** 매 턴 변하는 `workflow snapshot JSON`(L121)과 `activePlanSection`(L87 근처)이 프롬프트 상단에 있어 provider prefix cache가 사실상 매 턴 무효화.
3. **시각적 우선순위 부재.** 섹션이 전부 `##` 동일 레벨, MUST/SHOULD 계층 구분 없음. 서술형 문장 안에 분기 로직이 숨어 있었음.
4. **부정문 지배.** DO NOT / NEVER / MUST NOT 위주. 긍정형 격언이 드물었다.
5. **예시 중복.** 6개 예시 중 3개가 사실상 같은 교훈(trigger 연결 + dynamic-ports + label/id) 반복.

#### 새 구조 (5블록)

1. **ROLE & TURN-OP PROTOCOL** — 역할 1문장 + 툴 호출 규약 + **turn 결정표** (Markdown table: `Turn type | Emit prose? | finish call? | Further tools | When it applies`)
2. **CONTRACTS (MUST)** — Node output contract (CONVENTIONS 0/1.1/2/8), Label vs identifier, Entry-point connectivity, Dynamic-ports (schema-first + stable ids), Plan gating (openQuestions / planStepId / completeness)
3. **EDIT PLAYBOOK** — Closing the turn, pendingUserConfig, Editing existing node's config, Layout guidance, Error handling, Examples (3개)
4. **REFERENCE** — Node catalog, Expression language
5. **DYNAMIC STATE** — Active plan context + Current workflow snapshot JSON (**반드시 프롬프트 끝에 위치**)

##### 주요 효과

- **Prefix cache 친화.** 정적 콘텐츠가 앞, 동적 상태가 뒤로 이동해 prefix-cache hit rate가 크게 개선될 것으로 기대.
- **규칙 단일 소스.** "Call `finish` immediately after `propose_plan`" 문구가 **딱 한 곳(turn 결정표)** 에만 존재. 다른 섹션에서는 "the decision table above" 로만 참조.
- **Expression reference 캐시.** `EXPRESSION_REFERENCE_CACHE` 모듈 스코프 변수로 한 번만 문자열화. 이전엔 매 턴 `getAllFunctionNames().sort().join()` 을 재실행.
- **예시 3개로 축소** — Ex1 단순 edit / Ex2 dynamic-ports+pendingUserConfig (label/id 동시 커버) / Ex3 openQuestions 포함 복잡 요청.

#### 새 구조를 고정하는 테스트

`system-prompt.spec.ts` 에 `5-block structural layout (cache-friendly ordering)` describe 블록 추가. 향후 변경 시 다음이 깨지면 안 된다:

- `## Expression language` 이후에 workflow snapshot JSON(`"nodes":[`) 이 위치.
- `## Expression language` 이후에 `## Active plan context` 위치.
- `Label vs identifier` (CONTRACTS) 는 `## Expression language` (REFERENCE) 보다 앞.
- Turn 결정표 헤더 `| Turn ... | ... prose ... | ... finish ...` 형태가 존재하고 `plan-only` / `execution` 두 턴 종류가 본문에 등장.
- `Call finish immediately after propose_plan` 정규식 매치가 **1회 이하** (중복 금지).

#### 보존한 계약 (기존 테스트가 보장하는 것)

다음은 절대 문구를 깨면 안 된다 (regex 매칭됨):

- `[dynamic-ports]` 카탈로그 마커
- P0 guard rail: `manual_trigger` entry-point / `openQuestions` finish 금지 / `get_node_schema` MANDATORY
- Label vs identifier 예시: `btn_approve`, `승인`, `interaction.data.buttonId`, `interaction.data.email`, `data["승인"]` 금지 사례
- `## Closing the turn ... execution turn` 헤더 (동일 라인에 두 문구)
- `pendingUserConfig`, 4종 selector: `integration-selector`, `llm-config-selector`, `kb-selector`, `workflow-selector`
- `TODO|placeholder` 금지 가드
- `## Expression language`, `validate()`, `INVALID_EXPRESSION`, `Optional chaining`, `` `??` ``, `Arrow`, `Template literal`
- `Editing an existing node's config`, `shallow-merged`, `[REDACTED]`, `minimum patch`, "keep .* id"
- Active plan rendering: `[x] s1 · add_node` / `[ ] s2 · add_edge` / `• [note] ...` / `awaiting approval` / XML fence `<user-request>...</user-request>`

#### 이번 작업에서 발견한 pre-existing 이슈

TEST WORKFLOW 중 다음 테스트가 **main 브랜치에서도 실패** 함을 확인 (git stash 로 재현):

- `backend/src/modules/workflow-assistant/tools/validate-expressions.spec.ts` — "accepts optional chaining" 케이스
- `backend/src/modules/workflow-assistant/tools/shadow-workflow.spec.ts` — "accepts add_node with optional chaining (supported syntax)"

원인은 `@workflow/expression-engine` 패키지의 optional chaining 파서가 한글 키 인덱싱(`$node["1depth 음식 종류"]?.output?.interaction?.data.field`)을 거부하는 것으로 보인다. 최근 커밋 `6f6cfe1 표현식에 ? 지원` 에서 도입하려던 수정이 불완전한 듯하다.

**이번 프롬프트 재구조 작업 범위 밖**이므로 별도 이슈로 처리해야 한다. 프롬프트 재구조는 이 실패들과 독립적으로 완결.

#### 유지보수 시 체크

- 섹션을 추가할 때 **블록 경계를 넘지 말 것.** 정적 내용은 BLOCK 1~4, 동적 내용은 BLOCK 5. 이 규율이 캐시 효과의 근간.
- `STATIC_BLOCK_1_*`, `STATIC_BLOCK_2_*`, `STATIC_BLOCK_3_*` 모듈 스코프 상수로 빌드 타임에 1회만 문자열화됨. 동적 값이 필요하면 이 상수에 넣지 말고 `buildSystemPrompt` 본체에서 조립.
- 새 규칙을 추가하기 전, **기존 섹션에 흡수 가능한지 먼저 검토.** 규칙을 여러 곳에 반복 넣으면 이번 리팩토링이 무효화된다.
- Harmony control token 경고(`<|channel|>` 등) 는 OpenAI gpt-oss 계열 대비 유산. 현 provider (OpenAI/Anthropic/Google) 모두에서 발생하지 않는다는 것이 확인되면 제거 가능.

_원본 메모: memory/workflow-assistant-self-review-and-error-hints.md_

### Workflow Assistant — 자체 점검 + 에러 풍부화 (2026-04-23)

Assistant 가 복합 워크플로우 (예: 설문조사) 를 만들 때 실패 tool call 이 연쇄적으로 발생하던 문제와, 완료 후 자체 점검이 없던 문제를 해결한다. 본 메모는 향후 유지보수 시 놓치면 안 되는 결정·제약을 정리한다.

#### Part A — Tool-call 오류 감소

##### 에러 풍부화 (ShadowResult 확장)

`ShadowResult` 에 optional 필드 추가:
- `knownTypes: string[]` (정렬, 최대 `KNOWN_TYPES_MAX=40`) — `UNKNOWN_NODE_TYPE`
- `suggestedType: string` — alias 맵 hit (`NODE_TYPE_ALIASES`) 우선, 없으면 Levenshtein ≤ 3
- `repeatCount: number` — 같은 label LABEL_CONFLICT 가 `LABEL_CONFLICT_REPEAT_THRESHOLD(=2)` 이상 반복 시
- `hint: string` — 복구 지침 한 문장. 세 케이스에서 set 될 수 있다 (JSDoc 에 명시):
  - UNKNOWN_NODE_TYPE (alias / Levenshtein / 후보 없음 별로 문구 다름)
  - LABEL_CONFLICT (repeatCount ≥ 2)
  - NODE_NOT_FOUND on add_edge (recentFailedAddNodeLabels 가 있을 때 cascading 힌트)

##### alias 별칭 정책

`NODE_TYPE_ALIASES` 는 `error_message | error | alert | notification | message | text → template`.
기준: LLM 이 "UI 메세지용 전용 노드" 가 있다고 가정해 만들어내는 타입명을 `template` 으로 라우팅.
반드시 `this.knownNodeTypes.has(aliasHit)` 를 확인한 뒤에만 suggestedType 으로 싣는다 (registry 변화 대응).

##### LABEL_CONFLICT ≠ 실패한 노드 생성

**규약**: `addNode()` 의 LABEL_CONFLICT 분기에서는 `recordFailedAddNode` 를 호출하지 않는다. 이유: LABEL_CONFLICT 는 "이름만 겹쳤을 뿐 타입·config 자체는 타당" 한 상태이므로, 이후 `add_edge` 가 NODE_NOT_FOUND 로 떨어졌을 때 cascading 힌트에 섞이면 "앞서 노드 생성이 실패했다" 는 잘못된 진단을 LLM 에 준다. 테스트: `shadow-workflow.spec.ts` "LABEL_CONFLICT does NOT poison the cascading NODE_NOT_FOUND hint".

##### LLM 제공 문자열 embedding 규약

LLM 이 자유 텍스트로 채우는 값(label, attemptedType) 을 힌트/에러 메세지에 embed 할 때는 **반드시** `sanitizeLlmProvidedString(value, maxLen)` 경유. 이 헬퍼가 제어 문자·개행 제거, 백틱·꺾쇠 중화, 길이 절단을 일관 처리한다. 이유: LLM 출력이 `\n## HACK` 같은 마크다운 헤더/인젝션을 품은 채 힌트로 재주입되면 다음 라운드 프롬프트에서 지시문으로 오해될 수 있다.

길이 상수:
- `ATTEMPTED_TYPE_MAX_LEN = 64` — node type 후보 embed
- `LABEL_HINT_MAX_LEN = 80` — NODE_NOT_FOUND 힌트 label 목록

##### schemaCache 정책

`workflow-assistant-stream.service.ts` 의 턴 스코프 `schemaCache: Map<string, { result, hits }>`.

카운트 규칙: **hits 값은 호출 순번 그 자체**. 첫 호출 후 1, 두 번째 2, 세 번째 3...
- hits=1 (첫 호출): 정상 실행, cache set
- hits=2 (두 번째): cached + `warning: 'REDUNDANT_SCHEMA_LOOKUP'` + `cached: true`
- hits ≥ 3 (`SCHEMA_LOOKUP_HARD_STOP`): `ok: false, error: 'REDUNDANT_SCHEMA_LOOKUP'` (hard stop)

이 상수를 변경할 때는 서비스 L137–142 주석 + L459–462 inline 주석 + 테스트 3회차 기대값을 모두 동시에 고친다.

#### Part B — 2-stage finish (self-review)

##### 흐름

LLM 이 `finish` 를 호출하면 서버는 아래 순서로 판정:

1. `evaluateFinishGuard` → `PLAN_NOT_COMPLETE` 면 block (기존 동작, 변경 없음).
2. 통과하면 `evaluateReviewGuard` → `WORKFLOW_REVIEW_REQUIRED` 면 block.
3. 둘 다 통과하면 `{ ok: true }` 로 finish 성공.

Review 는 **한 턴에 한 번만** 발동 (`state.reviewCompleted`, `state.reviewRoundCount < 2`). 두 번째 `finish` 는 review 를 건너뛰고 통과해, LLM 이 사용자에게 다음 턴에서 후속 지시를 받을 기회를 보장.

##### review skip 조건 (`shouldSkipReview`)

다음 중 하나라도 참이면 review 는 발동하지 않는다. **시스템 프롬프트의 Self-review 섹션 설명과 반드시 동기화 유지** (프롬프트·구현 drift 가 곧 LLM 혼란으로 이어짐):

- `state.reviewCompleted`
- `state.reviewRoundCount >= 2`
- `state.finishBlockCount > 0` — PLAN_NOT_COMPLETE 가 이미 발동했다면 LLM 은 한 라운드 feedback 을 받았으므로 review 는 중복
- `state.planClearedThisTurn`
- 이번 턴 성공 edit 이 0 — 실행 턴 아님
- non-trigger 노드 ≤ 1 — trivial 편집 (plan 유무 무관)

##### 체크리스트 항목 (`review-workflow.ts`)

Blocking:
- **UNRESOLVED_FAILED_CALLS** — `kind === 'edit'` 실패 중 같은 label(add_node) / id(update/remove) / source+target+port 튜플(add_edge, camelCase 도 포함) 로 성공 흔적이 없는 것. **`finish` / `explore` 계열은 제외** (review-guard feedback 이나 `REDUNDANT_SCHEMA_LOOKUP` 은 실패 의미가 아님).
- **`PORT_NOT_FOUND` (2026-04-23 추가, add_edge 단계에서 즉시 반환)** — UNRESOLVED_FAILED_CALLS 과는 다른 class. `ShadowWorkflow.addEdge` 가 `portResolver` (stream.service 에서 `resolveEffectiveOutputPorts` 기반 주입) 로 source/target 포트 존재성을 검사, 없는 포트면 즉시 `PORT_NOT_FOUND` + `portInfo.knownPorts` 로 reject. 사용자가 config update 실패로 생성되지 못한 동적 포트 (carousel 버튼 / switch case 등) 에 edge 를 붙이려는 실수를 첫 시도에서 catch. 컨테이너 loopback `emit` 포트는 여전히 허용 (spec §4.4).
- **ORPHAN_NODES** — trigger category 에서 BFS 도달 불가 + container emit loopback 조상도 미reachable. `byId` Map 은 `collectOrphans` 에서 1회 생성 후 인자로 주입 (O(N²) → O(N+E)).
- **DANGLING_OUTPUT_PORTS** (2026-04-23 추가) — `resolveEffectiveOutputPorts` 가 돌려주는 `isUserConfigured=true` 포트 중 outgoing edge 없는 것. "ORPHAN_NODES 는 입력 방향 reachability, 이 검사는 출력 방향 connectivity" 의 대칭 쌍. weak 포트 (`error`/`default`/`fallback`/`continue`/단일 static `out`) 는 제외 — terminal 노드는 정상 케이스. `nodeDefs` 가 `BuildReviewChecklistInput` 으로 주입되어야 작동; 빈 배열이면 no-op. 상한 `MAX_DANGLING_PORTS=20`.
- **FAKE_STEP_COMPLETION** — `planStepId` 또는 `planStepIds` 가 붙은 호출들이 step 에 연결되어 있으나 모두 `ok: false`.
- **PENDING_USER_CONFIG_UNMENTIONED** — pendingUserConfig 있는 노드의 label 이 assistantText 에 포함되지 않음.

Non-blocking:
- **REQUEST_COVERAGE_LOW** — originalRequest 의미 토큰과 노드 label 겹침 비율 < 30%. 경고만.

##### Port 해석 (resolve-dynamic-ports.ts)

`frontend/src/lib/node-definitions/resolve-dynamic-ports.ts` 의 로직을 backend 로 포팅한 `tools/resolve-dynamic-ports.ts` 가 SSOT. 6 종 `DynamicPortsSpec` (switch-cases, classifier-categories, ai-agent-conditional, info-extractor-mode, presentation-buttons, parallel-branches) 를 전부 지원. 반환 구조에 `isUserConfigured: boolean` 추가 — strong (user-authored) vs weak (framework-synthesized) 구분이 DANGLING_OUTPUT_PORTS 의 핵심 필터. Frontend 사본과 드리프트하지 않도록 `resolve-dynamic-ports.spec.ts` 에 kind 별 시나리오 미러 (16 테스트).

##### 프롬프트 인젝션 방어

`WORKFLOW_REVIEW_REQUIRED` payload 의 `originalRequest` 필드는 `truncateReviewOriginalRequest()` 로 `REVIEW_ORIGINAL_REQUEST_MAX_LEN=200` 자로 잘라 싣는다. 전체 원문은 system prompt 의 Active plan context 에 XML fence 로 이미 중화되어 주입되므로 review 쪽에는 요약만.

##### 프론트엔드 영향

`tool-call-badge.tsx` 는 `kind === 'edit' | 'explore'` 만 SSE 로 구독하므로 `finish` tool_result (`ok: false, error: 'WORKFLOW_REVIEW_REQUIRED'`) 는 UI 빨간 배지로 누출되지 않는다. 사용자는 review 라운드 중 LLM 이 추가로 부른 `get_current_workflow` / 수정 edit 배지 + Korean "검토 완료" 문장만 본다.

#### 유지보수 체크리스트

- `SCHEMA_LOOKUP_HARD_STOP` 변경 시: 상수 정의부 + 인라인 주석 + 테스트 기대값 3곳 동시 수정.
- `ShadowResult` 필드 추가/제거 시: JSDoc 블록 + 테스트 fixture + 후속 `detectPendingUserConfig` / `toChatMessages` rehydration 경로 확인.
- Review skip 조건 변경 시: `prompts/system-prompt.ts` Self-review 섹션 문구 동기화 (테스트 `system-prompt.spec.ts` "teaches the 2-stage finish self-review routine..." 가 고정).
- `NODE_TYPE_ALIASES` 변경 시: alias 가 registry 에 존재하지 않으면 Levenshtein fallthrough 로 빠지는지 회귀 확인 (`shadow-workflow.spec.ts` "falls through to Levenshtein when alias exists but not in knownTypes").
- `resolveEffectiveOutputPorts` 변경 시: **frontend `resolveDynamicPorts` 와 동일 동작** 을 유지하는지 확인. 두 파일이 각자의 spec 을 가지므로 어느 한쪽만 업데이트하면 review false positive/negative 가 생긴다. 새로운 `DynamicPortsSpec.kind` 추가 시 양쪽에 동시에 branch 추가.
- DANGLING_OUTPUT_PORTS 의 weak/strong 경계 변경 시: `resolve-dynamic-ports.spec.ts` 의 `isUserConfigured` 단언 + `review-workflow.spec.ts` "does NOT flag weak ports" 케이스 모두 업데이트.

#### Follow-up (스코프 밖, 별도 이슈)

- `ShadowResult` discriminated union 전환
- `ShadowWorkflow` SRP 분리 (`ShadowWorkflowErrorAdvisor`)
- `schemaCache` 응답 명시 구조 래핑 (`{ ok, data, cached, warning }`)
- CHANGELOG 정책 수립 후 본 변경 소급 반영

_원본 메모: memory/workflow-assistant-provider-quirks-and-review-always.md_

### Workflow Assistant — 프로바이더 이상동작 대응 + review 항상 발동 (2026-04-23)

초기 self-review + 에러 풍부화 배포 후 다양한 LLM 프로바이더에서 관찰된 이슈에 대한 2차 대응을 정리.

#### 1. 프로토콜 이상: tool_call + finishReason=stop (gpt-oss-120b)

##### 증상
gpt-oss-120b 같은 오픈소스 서빙이 edit tool 호출 후에도 `finish` tool 을 부르지 않고 `finishReason: 'stop'` 으로 round 를 종료. LLM text 채널에는 "다음 단계 진행 중" 같은 내레이션을 남겨 사용자는 "멈춤" 으로 체감.

##### 대응
`stream.service.ts` 루프 종료 조건 확장:
```ts
const hadSuccessfulEditThisRound = pendingResultsForLlm.some(...)
const shouldContinueLoop =
  pendingResultsForLlm.length > 0 &&
  (finishReason === 'tool_calls' ||
   (!finishResolved && hadSuccessfulEditThisRound));
```

**edit 가 실제로 성공한 round 에서만** round-trip. propose_plan / explore 만 있는 plan-only round 는 기존처럼 stop 으로 종료 (추가 round 의 ROI 없음).

##### 프롬프트 강화
`STATIC_BLOCK_3_EDIT_PLAYBOOK` Closing the turn 섹션:
- **Past tense only** — "진행 중", "차례대로", "다음 단계", "이어서 진행하겠습니다" 등 미래형 내레이션 금지 (포착된 실제 leak 패턴).
- **finish 필수** — tool 호출 후 반드시 `finish` 를 명시 호출해야 함을 강조. 서버의 round-trip 은 fallback 이며 의존 금지.

#### 2. Harmony control token 누수 (gpt-oss)

##### 증상
gpt-oss-120b 가 `<|channel|>final<|message|>...` 같은 내부 제어 토큰을 응답에 노출. OpenAI SDK 의 SSE 파서가 이를 파싱하다 "Failed to parse input at pos 0: ..." 로 throw → 사용자에게 raw `LLM_CONNECTION_ERROR` 노출.

##### 대응 (2계층)
`openai.client.ts`:
1. **Streaming stripping** — `delta.content` / tool_call arguments 에서 harmony 제어 토큰 제거. 패턴 2개 사용:
   - `HARMONY_CHANNEL_PREAMBLE_REGEX = /<\|channel\|>[\s\S]*?<\|message\|>/g` — preamble 전체 (channel 이름 포함) 한 번에.
   - `HARMONY_STANDALONE_TOKEN_REGEX = /<\|(channel|start|end|message|return|constrain|...)\|>/g` — 잔여 단독 토큰.
2. **Parse error 분류** — catch 블록에서 에러 메세지가 harmony 패턴 매치면 `LLM_OUTPUT_MALFORMED` 로 분류하고 사용자 친화적 한국어 안내문으로 치환. Raw 메세지는 UI 에 노출하지 않음 (로그에만).

#### 3. 에러 UI 시안성 개선

##### 증상
어시스턴트 패널 error box 가 `text-red-800/200` 탁한 shade 사용 → 배경과 대비 부족, 특히 11px 소형 텍스트에서 가독성 낮음.

##### 대응
`assistant-message.tsx` 의 error box 를 systemHint 패턴과 동기화:
- 본문 텍스트: `text-red-950 dark:text-red-50` + `font-medium` — "가장 짙은 shade / 가장 옅은 shade" 대비 극대화.
- 에러 코드 pill: 별도 shade 배경 (red-200 light / red-800 dark) + border 로 명확히 구분.
- 본문 글자 크기 `10px → 11px` 로 상향 (message.error 타이틀과 동일 레벨).
- 긴 영문 에러 메세지 대비 `break-all` 추가.

#### 4. Gemini-3-flash 존재하지 않는 노드 타입 발명

##### 증상
Gemini-3-flash 이 `음식 종류 선택` 같은 label 로 add_node 시도 — catalog 에 없는 type 을 기본 시나리오 표현으로 발명. 첫 `UNKNOWN_NODE_TYPE` 응답의 `suggestedType` / `knownTypes` 힌트도 무시하고 반복 재시도.

##### 대응
1. **`NODE_TYPE_ALIASES` 확장** — LLM 이 빈번히 발명하는 패턴을 실제 존재 타입으로 매핑 추가:
   - `user_input / input / question / prompt / survey / text_input` → `form`
   - `choice / choices / options / selection / selector / button_group / category / buttons` → `carousel`
   - `router / route / branch / conditional` → `switch` (boolean 은 `if_else`)
   - `email / send_mail / mail` → `send_email`
   - `display / show / render / result / output` → `template`

2. **프롬프트 강화** — `STATIC_BLOCK_3_EDIT_PLAYBOOK` Common pitfalls:
   - "Node types are a fixed catalog — do NOT invent new types based on your task wording." 추가.
   - 각 카테고리별 "흔한 오발명 → 실제 타입" 표 내장 (message/input/choice/branching/email 5계열).

3. **UNKNOWN_NODE_TYPE 시 suggestedType 을 알려주는 것에 더해 alias 매핑이 광범위해 대부분의 발명 패턴을 한 번에 교정**.

#### 5. Review guard 항상 발동 (사용자 요구 반영)

##### 증상
`finishBlockCount > 0` skip 조건 때문에 PLAN_NOT_COMPLETE 가 fire 한 다음에는 review 가 발동하지 않음. 사용자 보고: 복잡한 워크플로우에서 plan 가드를 통과한 뒤에도 orphan / pendingUserConfig 미안내 이슈가 여전히 발생.

##### 대응
`evaluateReviewGuard` 의 `shouldSkipReview` 에서 `finishBlockCount > 0` 체크 **제거**. 두 가드는 독립 계층으로 운영:
- PLAN_NOT_COMPLETE — plan 체크박스 충족성 (step ↔ tool call 매핑)
- WORKFLOW_REVIEW_REQUIRED — 워크플로우 품질 (orphan / 실패 미해결 / pendingUserConfig 안내 / fake step 완료)

Plan 가드가 fire 했다는 것은 LLM 이 한 번 보정 했을 뿐, 결과 워크플로우의 품질을 보장하지 않음. 두 가드 모두 fire 하는 3~4 round 시나리오가 현실적 정상 경로.

##### 남은 skip 조건 (최소 안전망)
- `reviewCompleted` / `reviewRoundCount >= 2` — 같은 턴 review 1회 상한
- `planClearedThisTurn` — 화제 전환
- 성공 edit 0 — 실행 턴 아님
- non-trigger 노드 ≤ 1 — trivial 편집 (ROI 낮음)

##### PENDING_USER_CONFIG_UNMENTIONED 상세화
details 문자열에 구체적 노드 label + 빠진 selector 목록을 인라인으로 실어, LLM 이 다음 라운드 한국어 마무리 메세지 작성 시 즉시 참조할 수 있게 함. 예:
> "SendEmail (Integration); AIAgent (LLM Config). In the next round, emit a Korean summary that names each listed node label verbatim..."

> **2026-04-24 업데이트 — 본 가드는 이제 "candidate 0 인 항목" 에만 발동한다.**
> spec ED-AI-39 로 in-message candidate picker 가 도입되어, 워크스페이스에
> 후보가 1건 이상 있으면 프런트 picker 가 UX 를 완결한다. LLM 의 한국어
> mention 은 후보 목록이 비어있어 **사용자가 직접 Integration/LLM/KB/워크플로
> 를 등록해야 하는 경우에만** 필요하다. 상세는
> *workflow-assistant-candidate-picker.md (본 Rationale 섹션 내)*.

#### 6. Plan-only 턴의 핑퐁 루프 차단 (gemini-3-flash-preview)

##### 증상
사용자 보고 (2026-04-23): 복합 설문조사 워크플로우 요청 → gemini-3-flash-preview 가
`propose_plan` 직후 `finish` 를 호출하지 않고 같은 턴에 수십 개의 edit 을 연쇄 발사.
프로바이더가 `finishReason: 'tool_calls'` 로 종료 → 서버가 round-trip → LLM 이
`PLAN_AWAITING_APPROVAL` 피드백을 보고도 또 edit 재시도 → `MAX_TOOL_LOOP_ROUNDS (50)`
도달 → 사용자 UI 에 "진행이 중단됐어요" + 수십 개의 빨간 배지.

##### 대응 (서버 강제)
`stream.service.ts` 의 `shouldContinueLoop` 판정 앞에 단락 가드 추가:
```ts
const planProposedPendingApproval = !!planForTurn && !planForTurn.approvedAt;
if (planProposedPendingApproval) finishReason = 'stop';
const shouldContinueLoop = !planProposedPendingApproval && ...;
```

- Plan 을 제안했는데 아직 미승인 → 이번 턴 내 round-trip 금지 (1 라운드 종료).
- `finishReason` 을 `'stop'` 으로 덮어써 클라이언트가 "승인 대기" UI 로 전환.
- 시스템 프롬프트의 "Plan-only turn | Call finish immediately after propose_plan"
  규칙을 서버가 실제로 enforce. LLM 이 규칙 준수하지 않아도 핑퐁 루프는 발생 안 함.

##### 호환성
- 정상 경로 (`propose_plan` → `finish` 한 라운드 내): `finishResolved=true`,
  `finishReason='stop'` 이 이미 내려가 있어 기존 `shouldContinueLoop=false` 로 자연 종료.
  가드는 중복 발동해도 동일한 최종 결과.
- `clear_plan` 이후 새 plan 없이 edit 만 하는 턴: `planForTurn=null` 이라 가드 미발동.
- History 에서 load 된 approved plan 실행 턴: `planForTurn=null`, 가드 미발동.

##### 회귀 테스트
`stream.service.spec.ts` — "does NOT round-trip when a plan was proposed and is
pending approval, even if the provider reports finishReason=tool_calls
(Gemini-3-flash pattern)". `chatStream` 호출 횟수 1 + `finishReason=stop` + error
이벤트 없음을 동시에 고정.

#### 7. Stall 자동 복구 (gpt-oss-120b 임의 중단)

##### 증상
gpt-oss-120b 가 pending step 이 남은 plan 실행 턴에서 tool call 을 하지 않고
텍스트만 뱉고 `finishReason: 'stop'` 으로 종료. 기존 "edit 성공 round 에만 round-trip"
가드로는 cover 되지 않아 턴이 조용히 끝남. frontend 는 `turnStalledHint` 로
"이어서 진행해줘" 안내를 띄우지만 사용자가 수동으로 follow-up 을 입력해야 했다.

##### 대응 (서버 자동 복구)
`stream.service.ts` 의 기존 `shouldContinueLoop` 뒤에 **stall 복구 블록** 추가:

```ts
const hasPendingActionableSteps = (() => {
  if (planPending || finishResolved) return false;
  if (pendingResultsForLlm.length > 0) return false;  // 이미 위 경로가 cover
  const ctx = findActivePlanContext(...);
  if (!ctx || ctx.status !== 'active') return false;
  return ctx.plan.steps
    .filter(s => s.action !== 'note')
    .some(s => !ctx.completedStepIds.has(s.id));
})();
if (hasPendingActionableSteps && consecutiveStallRounds < MAX_STALL_ROUNDS) {
  consecutiveStallRounds++;
  messages.push({ role: 'assistant', content: roundText });
  messages.push({ role: 'user', content: '이어서 진행해줘.' });
  continue;
}
```

- Text-only stall + pending plan → 서버가 user 역할의 nudge "이어서 진행해줘." 를
  messages 배열에 주입하고 루프 계속. LLM 은 다음 라운드에서 system prompt 의
  Active plan context + user nudge 를 보고 `[ ]` pending step 부터 resume.
- `MAX_STALL_ROUNDS = 2` 로 runaway 방지 — 2 번 연속 stall 하면 실제 막힌 상태로
  간주해 턴 종료 (MAX_TOOL_LOOP_ROUNDS=50 전에 탈출).
- 진척이 있는 라운드는 `consecutiveStallRounds = 0` 으로 리셋.
- 이 값 조정 시 `stream.service.spec.ts` "gives up after MAX_STALL_ROUNDS..." 고정
  테스트도 동시에 업데이트.

##### 호환성
- Plan-only 턴 (미승인): `planPending` 단락으로 stall 가드도 건너뜀 — 사용자 approve
  대기가 올바른 상태.
- 이미 finish 성공: `finishResolved=true` 로 제외.
- Pending step 없음: plan 완료 상태면 nudge 의미 없음 → 가드 비발동.
- `pendingResultsForLlm.length > 0` 인 경우: 기존 shouldContinueLoop 가 이미 cover.

##### 회귀 테스트
`stream.service.spec.ts` "auto-continue on stall with pending plan" describe:
- "auto-nudges LLM when a round ends text-only + stop + plan has pending steps"
- "gives up after MAX_STALL_ROUNDS (2) consecutive text-only stalls to prevent runaway loops"
- "does NOT auto-continue when plan has no pending actionable steps"

#### 8. UX: plan-only 자동 안내 hint 제거 (2026-04-23)

##### 증상
plan-only 턴에서 plan card 와 함께 "계획대로 진행해 주세요." systemHint 가 동시에
노출 → plan card 의 "계획대로 진행" 버튼 + 동일 문구의 info 박스가 중복 메시지로
인식. 사용자 피드백: 버튼이 이미 있으므로 hint 는 불필요.

##### 대응
`frontend/src/lib/stores/assistant-store.ts` 의 done 이벤트 systemHint 분기에서
`planApproveConfirm` 주입 조건을 제거. `turnStalledHint` / `turnCompletedHint` 만
유지. i18n 문자열 자체는 `approveActivePlan` 이 user 메시지로 전송할 때 사용하므로
유지.

#### 9. UX: 에러 버블에 "이어서 진행" 버튼 추가 (2026-04-23)

##### 증상
`ASSISTANT_TOO_MANY_TOOL_CALLS` 에러 발생 시 사용자가 입력창에 "이어서 진행해줘"
를 직접 타이핑해야 복구 가능.

##### 대응
- `continueAfterBudget` action 을 `assistant-store.ts` 에 추가 — `sendMessage`
  래퍼로 locale-aware 메시지 전송.
- `assistant-message.tsx` 에 `RESUMABLE_ERROR_CODES` 집합 (현재 `ASSISTANT_TOO_MANY_TOOL_CALLS`
  1 개) 을 정의, 에러 버블 아래에 "이어서 진행" 버튼 노출. `NO_LLM_CONFIG` /
  `STREAM_FAILED` 는 resume 불가이므로 버튼 없음.
- `assistant-panel.tsx` 가 `onContinueAfterBudget` 콜백을 `AssistantMessageView`
  로 주입해 snapshot 결합 유지 (plan approve 버튼과 동일 패턴).

#### 11. NODE_NOT_FOUND label-lookalike hint (2026-04-24)

##### 증상
LLM 이 `update_node` / `remove_node` / `add_edge` 의 `id` / `source_id` / `target_id`
자리에 사용자에게 보이는 **label** (예: `"SendEmail"`) 을 실수로 넣어
`NODE_NOT_FOUND` 가 연쇄 발생. 이로 인해 config patch 도 전혀 반영 안 되는
2차 증상까지 번짐.

##### 대응 (2-layer)
1. **시스템 프롬프트 강화** (`system-prompt.ts`):
   - Contracts 블록 "Label vs identifier" 섹션에 "Tool arguments: always
     reference a node by its UUID, never by its label" 하위 문단 추가.
     UUID 의 유일한 출처 2가지 (`result.id` / `currentWorkflow.nodes[*].id`)
     명시 + 위반 예 (`update_node({id: "SendEmail"})`) 포함.
   - "Labels are globally unique" 문장에 "유일성은 add_node 충돌 감지용 —
     UUID 대체 근거 아님" 단서 병기.

2. **서버 label-lookalike hint** (`shadow-workflow.ts`):
   - `buildLabelAsIdHint(value)`: shadow 에 `node.label === value` 인 노드가
     있으면 `[hint] Value "<label>" matches the label of an existing node
     (id: <uuid>). ... [/hint]` 형태의 복구 문자열 반환. `findByLabel` 위임으로
     순회 로직 중복 제거. `sanitizeLlmProvidedString` 으로 label 을
     C0+C1+Bidi+zero-width 까지 중화 + `JSON.stringify` 로 escape.
   - `updateNode` / `removeNode`: `NODE_NOT_FOUND` 분기에 바로 hint 부착.
   - `addEdge`: **cascading failed-add_node FIFO 가 먼저**. 비었을 때만
     source 우선 label-lookalike fallback (target 은 source 매치 없을 때만).
     두 힌트가 섞이지 않도록 단일 hint.

##### 호환성·주의
- `ShadowResult.hint` 는 기존부터 optional 필드. 기존 `NODE_NOT_FOUND` 소비자는
  hint 없이도 동일 동작.
- `value.length > LABEL_HINT_MAX_LEN * 4` 는 label 후보에서 제외 (Levenshtein
  유사 방어).
- `[hint] … [/hint]` 마커는 이번부터 label-lookalike 계열에만 적용. 기존
  cascading 힌트 등은 기존 형식 유지.

##### 관련 spec
- `spec/3-workflow-editor/4-ai-assistant.md` §4.4.1 "NODE_NOT_FOUND hint 규칙"
  에 cascading / label-lookalike 의 발동 조건·우선순위·보안 정책 정리.
- §8 "워크플로우 조립 규칙" 행에 "tool argument id 자리 UUID 전용" 한 문장
  추가.

##### 회귀 테스트
`shadow-workflow.spec.ts` → `NODE_NOT_FOUND label-lookalike hint` describe:
- update/remove/add_edge source/target 별 hint 부착
- 양측 label → source 단일 hint
- 공백 전용 id → hint 없음
- cascading FIFO 비어있을 때 label-lookalike fallback 반례
- cascading 우선순위 (FIFO 있으면 cascading hint)
- label sanitisation (newline, `<script>`)

`system-prompt.spec.ts` → "teaches that tool-argument id slots need UUIDs,
never node labels" 로 슬로건 고정 + `result.id` / `nodes[*].id` / "matches the
label of" 매칭.

관련 리뷰: `review/2026-04-24_18-27-09/`.

#### 10. Stall 자동 복구 UX — 메시지 박스 분리 + `auto_resume` SSE 이벤트 (2026-04-24)

##### 배경
§7 의 stall 복구가 발동하면 같은 `assistantText` 에 여러 라운드 텍스트가 누적되어
단일 `WorkflowAssistantMessage` row 로 저장된다. gpt-oss-120b 는 라운드 종료 직전
"계속 진행해도 될까요?" 같은 confirmation 문구를 반복적으로 뱉는 quirk 가 있어,
stall 전·후 라운드의 같은 문구가 한 버블 안에서 2~3번 겹쳐 UX 가 지저분해진다.

##### 대응
**구조적 해결** — 서버가 stall 복구로 추가 라운드를 시작하는 순간, 누적된 텍스트를
별도 row 로 먼저 persist 하고 커서를 리셋한다. 이후 라운드는 새 row 에 누적된다.
프론트에게는 `event: auto_resume` 을 발행해 "새 버블로 분리해 달라" 는 신호를 준다.

**엔티티 변경** — `WorkflowAssistantMessage` 에 3개 필드 추가:
- `autoResumed: boolean` — 이 row 가 복구로 인해 새로 시작된 row 이면 true
- `autoResumeReason: string | null` — 현재 `'stall_pending_steps'` 한 종류
- `autoResumeAttempt: number | null` — 1..MAX_STALL_ROUNDS

마이그레이션 `V020__assistant_message_auto_resume.sql` 로 기본값 false / null 로
기존 row 호환.

**stream.service 변경** — stall 복구 블록 (§7) 에서:
```ts
// 1) 현재까지의 assistant 텍스트를 "중간 row" 로 먼저 persist
await this.persistAssistantTurn(sessionId, assistantText, pendingToolCalls,
  planPersisted ? null : planForTurn, null, 'auto_resume_pending',
  /* resumeMeta */ { autoResumed: false, ... });
if (planForTurn) planPersisted = true;
// 2) 누적 커서 리셋 — 다음 라운드는 새 row
assistantText = ''; pendingToolCalls = [];
// 3) SSE 로 프론트에 신호
yield { event: 'auto_resume', data: { reason, attempt, max } };
// 4) 기존 nudge 주입 + continue
```

턴 종료 시점의 최종 persist 에는 `autoResumed: consecutiveStallRounds > 0` 를 전달.

**`persistAssistantTurn` 시그니처 확장** — 마지막 파라미터로 `resumeMeta` 를 받고
기본값으로 `{autoResumed: false, autoResumeReason: null, autoResumeAttempt: null}`
를 쓴다. 기존 호출부 변경 최소.

**Plan 중복 방지** — 같은 턴 안에 plan 이 최초로 emit 되는 row 에만 plan 을 싣고,
그 뒤로 분리된 row 는 `plan=null` 로 persist. 로컬 `planPersisted` 플래그로 관리.

##### 프론트 변경
- `AssistantSseEvent` union 에 `auto_resume` 추가 (api/assistant.ts)
- `AssistantDisplayMessage` 에 `autoResume?: {reason, attempt, max}` 추가
- `handleSseEvent` 는 그대로 유지하고, `sendMessage` 의 onEvent 콜백에서
  `auto_resume` 이벤트를 가로채 현재 `currentAssistantId` 를 새 UUID 로 갱신하면서
  새 assistant row 를 push.
- `hydrateMessage` 에서 서버의 `autoResumed=true` row 를 `autoResume` 메타로 복원.
- `assistant-message.tsx` 에서 `message.autoResume` 이 있으면 버블 위에 divider
  렌더 ("🔄 자동으로 이어서 진행했어요 (N/M)"). i18n `assistant.autoResumedHint`.

##### 호환성
- 기존 row (autoResumed=false) 는 divider 가 표시되지 않음 → 기존 세션 그대로.
- 정상 턴 (stall 없음): `persistAssistantTurn` 이 한 번만 호출되어 row 1개.
- stall 1회 복구: row 2개 (`auto_resume_pending` + 최종). 최종 row 에만 autoResumed=true.
- stall 2회: row 3개. 최종 row 에 autoResumedAttempt=2.
- `MAX_STALL_ROUNDS` 상한에 걸려 포기하는 경우: 마지막 row 도 autoResumed=true 로
  persist (포기 직전 "이어서 진행해줘" 가 주입되지 않았지만 텍스트가 새 버블로
  분리되는 것은 동일하게 유지 — 서버가 분리 persist 를 이미 수행했음).

##### 회귀 테스트
`stream.service.spec.ts` "auto-continue on stall with pending plan" describe 의
기존 3개 테스트에 다음 어서션 추가:
- `appendMessage` 호출 횟수가 (stall N회) + 1 개 (최종) 임을 확인.
- N+1 개 row 중 중간 row 들은 `finishReason='auto_resume_pending'`, `autoResumed=false`.
- 최종 row 는 `autoResumed=true`, `autoResumeReason='stall_pending_steps'`,
  `autoResumeAttempt=N`.
- SSE 이벤트 스트림에 `event: 'auto_resume'` 이 N회 포함, attempt 가 1..N 순증.
- plan 은 최초 emit 된 row 에만 실리고 이후 row 들의 plan=null.

`assistant-store.test.ts` — `auto_resume` 이벤트 수신 시 messages 배열에 새 row 가
추가되고 `streamingMessageId` 가 갱신되며, `autoResume` 메타가 세팅되는지 검증.

#### 유지보수 체크리스트

- `stripHarmonyTokens` 추가 제어 토큰 관찰 시 `HARMONY_STANDALONE_TOKEN_REGEX` 유니온에 추가.
- `NODE_TYPE_ALIASES` 에 새 alias 추가 시 `shadow-workflow.spec.ts` it.each 케이스에도 추가.
- Review skip 조건 변경 시 `system-prompt.ts` Self-review 섹션 문구 동기화.
- Error UI 스타일 변경 시 systemHint 와 스타일 일관성 유지 (dark/light 모두 950/50 대비 규약).
- Plan-only 가드 (`planProposedPendingApproval`) 의 단락 조건 변경 시 위 "호환성" 3개 시나리오
  모두 회귀 테스트로 고정되어 있는지 확인. `stream.service.spec.ts` 에서 `finishReason=stop`
- `MAX_STALL_ROUNDS` / stall 가드 조건 변경 시: "auto-continue on stall with pending plan"
  describe 의 3 테스트 (auto-nudge / max-stall / no-pending-steps) 동시 업데이트 +
  §10 의 row 분리 / auto_resume 이벤트 어서션도 같이 업데이트.
- `auto_resume` SSE event schema 변경 시: backend `AssistantStreamEvent` union,
  frontend `AssistantSseEvent` union, controller 가 단순 JSON.stringify 하므로
  별도 DTO 없음. `assistant.autoResumedHint` i18n 포맷 (`{{attempt}}/{{max}}`) 도
  페이로드 shape 에 묶여있으니 payload key 이름 변경 시 placeholder 동시 업데이트.
- `WorkflowAssistantMessage` 에 신규 필드 추가 시: migration SQL 과 entity 의
  nullable/default 가 일치해야 한다 (autoResumed default false, 나머지 null).
  `appendMessage` 의 `Partial<WorkflowAssistantMessage>` 수용 패턴 덕분에 서비스
  계층 호출부 변경은 불필요.
- `RESUMABLE_ERROR_CODES` 에 새 에러 코드 추가 시: (1) backend 가 실제로 해당 코드 발행하는지
  확인, (2) "이어서 진행해줘" follow-up 이 의미있는 복구인지 재검토, (3) `continueAfterBudget`
  대신 별도 resume 액션이 필요한지 판단.
  을 기대하는 기존 플래닝 관련 테스트들이 이 가드에 의해 영향받지 않아야 한다.

_원본 메모: memory/workflow-assistant-candidate-picker.md_

### Workflow Assistant — Candidate Picker 정책 결정 (2026-04-24)

#### 배경

2026-04-24 사용자 피드백: "메일전송 노드에 SMTP integration 을 설정해야 하는데, 설정된 항목이 있음에도 스스로 하지를 못해". 기존 정책은 시스템 프롬프트로 `integration-selector` 등 user-action widget 의 id 주입을 **명시적으로 금지** 했고, `PENDING_USER_CONFIG_UNMENTIONED` 리뷰 가드가 "마무리 메시지에 사용자 설정 안내" 를 강제하는 구조였다. 결과적으로 Assistant 는 워크스페이스에 단일 SMTP integration 이 있어도 자동 연결하지 않고 사용자에게 수동 설정을 미뤘다.

#### 최종 정책 (ED-AI-39)

**"설정 가능한 항목이 존재하면 사용자에게 명시적 확인 후 주입, 없으면 기존 안내 유지"** — 방향 B 채택:

- 백엔드 `add_node` / `update_node` 성공 응답의 `pendingUserConfig[i]` 에 **워크스페이스 후보 목록 (`candidates: CandidateEntry[]`)** 을 실어 프런트에 전달.
- 프런트는 해당 edit 버블 아래에 드롭다운 picker 렌더. 사용자 Confirm 클릭 시 `editor-store.updateNode` 로 즉시 반영 (LLM 경유 없음).
- 후보 0개: amber 안내 박스 + Settings 딥링크. 기존 수동 설정 경로 유지.
- 후보 1개도 자동 선택 금지 — 단일 option 드롭다운으로 사용자 확인 필수.
- 적용 scope: 4종 widget 전체 (`integration-selector` · `llm-config-selector` · `kb-selector` · `workflow-selector`).

#### 문서 변경 지도

| 문서 | 섹션 | 변경 요점 |
|------|------|-----------|
| `prd/2-workflow-editor.md` | §10.4 | `ED-AI-39` 신규 — 명시적 확인 + picker UX 의무. |
| `spec/3-workflow-editor/4-ai-assistant.md` | §3.2 | "Candidate picker" 행 추가. |
| | §3.3 | picker 접근성(aria, 키보드) 규정. |
| | §4.3 | 편집 도구 반환 shape 에 `pendingUserConfig?` 명시. |
| | §4.3.1 (신규) | `PendingUserConfigField` / `CandidateEntry` 타입, widget별 조회 범위·상한(20), 프런트 동작, LLM 계약. |
| | §5.3.1 | tool_call.data.result 설명에 `pendingUserConfig` 언급. |
| | §6.0 | rehydrate 시 canvas 현재 값 vs picker 상태 판정 규칙. |
| | §8 | "Selector 필드 정책" 행 추가 — LLM 은 id 빈 값 제출, closing mention 은 candidate 0 case 에만. |
| | §10 | `WORKFLOW_REVIEW_REQUIRED` 행에 `PENDING_USER_CONFIG_UNMENTIONED` 는 candidate 0 에만 발동함을 명시. |
| | §13 | `candidatePicker*` i18n 5키 추가. |
| | §14 | ED-AI-39 매핑. |

#### 구현자가 기억해야 할 계약 (요약)

1. **서버**: `collectPendingUserConfig` 는 기존처럼 schema 를 훑어 비어있는 selector 필드를 수집하되, 추가로 widget 별 저장소(integrationRepo / llmConfigRepo / kbRepo / workflowRepo) 를 워크스페이스 스코프로 쿼리해 `candidates` 를 채운다. 상한 20, connected/최근 등 정렬 규칙은 §4.3.1 표 그대로.
2. **LLM 프롬프트**: §8 "Selector 필드 정책" 행을 `STATIC_BLOCK_3_EDIT_PLAYBOOK` 에 투영. 기존 "You must NOT fill ... surface them in the closing message" 를 "Leave ids empty; server attaches candidates; mention only when candidates list is empty" 로 교체.
3. **Review guard**: `collectUnmentionedPendingUserConfig` 는 `candidates?.length === 0` 인 항목에 대해서만 missingFields 로 카운트. 후보가 1+ 인 항목은 guard 에서 제외.
4. **프런트 렌더**: `AssistantMessageView` 의 tool_call badge 그룹 아래, error bubble 이나 systemHint 보다 **위**에 picker 블록 배치. Confirm 시 `editor-store.updateNode(nodeId, { config: { [field]: selectedId } })` 호출. 이후 picker 는 "✓ 설정됨" 으로 고정 (Undo 로도 picker 상태를 되돌리지 않는다 — UX 복잡도 대비 실익 낮음).
5. **Rehydrate**: `hydrateMessage` 에서 `tool_calls[*].result.pendingUserConfig` 를 읽고, 해당 노드의 현재 canvas 값이 채워져 있으면 "✓ 설정됨", 비어있으면 interactive picker 로 복원. 판정은 editor-store 의 현재 노드 config 에서 `field` 경로를 dot-path 로 읽어 비교.

#### Out of scope (후속)

- Plan 카드 안 picker 통합 UI (현재는 edit 버블 전용).
- Picker 에서 "후보 인라인 등록 (Integration 등록 폼 임베드)" — 현재는 Settings 딥링크.
- Tool-area 노드의 `toolOwnerId` — user-action widget 이 아니라 이번 정책 대상이 아님.
- UI 컴포넌트 테스트 (RTL 환경 미도입).

#### 관련 메모

- *workflow-assistant-provider-quirks-and-review-always.md (본 Rationale 섹션 내)* — 기존 `PENDING_USER_CONFIG_UNMENTIONED` 동작 원본. 본 정책으로 "candidate 0 only" 로 축소됨을 인지.
- *workflow-ai-assistant-decisions.md (본 Rationale 섹션 내)* — Assistant 초기 설계 결정.

#### 실행 계획 (Spec 밖, 구현용)

구현은 `developer` skill 에서 수행. PRD/Spec 업데이트 완료했으므로 다음 단계:

1. Backend: `detect-pending-user-config.ts` 에 widget → repo 매핑 추가. `explore-tools.service` 의 로직 재사용 또는 새 `CandidateLookupService` 를 경유해 per-widget 조회.
2. Backend: `system-prompt.ts` 의 `STATIC_BLOCK_3_EDIT_PLAYBOOK` Selector 정책 블록 교체.
3. Backend: `review-workflow.ts` 의 `collectUnmentionedPendingUserConfig` 를 candidate 0 조건으로 좁힘.
4. Frontend: `assistant-store.ts` 에 picker state / confirm action / rehydrate 판정 추가. `assistant-message.tsx` 에 picker 컴포넌트 삽입.
5. i18n ko/en 사전 5키 추가.
6. 테스트: stream.service.spec 의 pendingUserConfig 기존 케이스를 candidates 포함으로 확장 + 새 review guard 완화 케이스 + frontend store 의 picker 상태 전이 테스트.

_원본 메모: memory/workflow-assistant-execution-tools-decisions.md_

### Workflow AI Assi

... (truncated due to size limit) ...
