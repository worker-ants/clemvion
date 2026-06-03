---
id: integration
status: implemented
code:
  - codebase/frontend/src/app/(main)/integrations/page.tsx
  - codebase/frontend/src/app/(main)/integrations/new/page.tsx
  - codebase/frontend/src/app/(main)/integrations/[id]/page.tsx
  - codebase/frontend/src/app/(main)/integrations/_shared/*.tsx
---

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

> **자동 갱신 통합 (`autoRefresh=true`, §9.1)**: 만료 임박 시에도 상태 텍스트는 `Connected` 를 유지하고, 작은 보조 라벨 `Auto-renews` 로 자동 갱신 사실을 알린다. 표의 `Expires in Nd` 는 `autoRefresh=false` 통합에만 적용된다.

### 2.3 검색·필터

| 컨트롤 | 동작 |
|--------|------|
| 검색 입력 | 별칭(`name`) ILIKE 부분 일치 |
| Scope 셀렉트 | `All` / `Personal` / `Organization` |
| 서비스 유형 칩 | 다중 선택 가능. 선택 없음 = 전체 |
| 상태 칩 | `All` / `Attention` / `Connected` / `Expiring` / `Expired` / `Error`. 단일 선택. `Expiring` = `status='connected' AND token_expires_at within 7d AND NOT integration.autoRefresh` — 자동 갱신 통합(§9.1)은 만료 임박 분기에서 제외 |

`Attention` 은 §2.4 배너와 동일한 합집합 — `Expired ∪ Expiring ∪ Error` — 을 단일 칩으로 노출한다. 한 칩만 누르면 "지금 손봐야 하는 통합" 을 모두 보여주는 게 사용자 멘탈 모델에 맞고, 단일 선택 칩 모델을 깨지 않으면서 합집합을 제공할 수 있는 유일한 표현이다 (Rationale "Attention 가상 필터값" 항 참고).

※ `expiring` 과 `attention` 두 값은 DB `Integration.status` Enum 에는 존재하지 않는 **가상 필터값(virtual filter)** 이다 — 백엔드 쿼리 빌더가 §9.1 의 `status` 파라미터를 받아 합집합 WHERE 절로 변환한다. DB Enum (`connected`/`expired`/`error`/`pending_install`) 자체를 확장하지 않는 것은 영속화되는 상태와 화면 필터링용 술어를 분리하기 위함이다. 두 가상값 모두 자동 갱신 통합(§9.1 `autoRefresh=true`) 을 만료 임박 분기에서 제외한다 (Rationale "자동 갱신 통합을 attention 술어에서 제외" 항 참고).

※ 상태 칩에 `pending_install` 은 포함하지 않는다 — 외부 흐름(Cafe24 Developers "테스트 실행") 진행 중 정상 전환 상태이며, 사용자가 명시적으로 필터링할 수요가 낮다. 별도 수요 발생 시 후속 plan 으로 재검토 (Rationale 참고).

모든 필터는 URL 쿼리 파라미터(`q`, `scope`, `serviceType`, `status`)로 동기화되어 공유/새로고침 시 복원된다.

### 2.4 "Need attention" 배너

- **포함 조건**: `status IN (expired, error)` OR `(status='connected' AND token_expires_at IS NOT NULL AND token_expires_at > NOW() AND token_expires_at <= NOW() + INTERVAL '7d' AND NOT integration.autoRefresh)`. `pending_install` 은 사용자가 외부(Cafe24 Developers)에서 흐름을 진행 중인 정상 상태로 보고 배너에서 제외 — `status_reason` 이 채워진 케이스도 동일. `install_timeout` 사유로 `expired` 가 된 Cafe24 Private 행은 attention 에 포함된다 (사용자 조치(삭제 후 재등록)가 필요한 정상 운영 신호). **자동 갱신 통합(`autoRefresh=true`, §9.1)** 은 만료 임박(7d 이내) 분기에서 제외 — 짧은-수명 토큰(예: cafe24 access_token 2h)의 거짓 양성 방지. autoRefresh 통합의 갱신이 실패해 `error(auth_failed)` 또는 `error(network)` 로 전이하면 그 행은 `status IN (expired, error)` 분기로 attention 에 그대로 포함되므로 사용자 신호 회귀는 없다 (§10.5).
- **표시 내용 (분해 카운트)**: 한 줄 요약 (`"통합 N건이 주의가 필요해요"`) + 그 아래에 분해 카운트 (`"만료 X · 만료 임박 Y · 오류 Z"`). 카운트가 0 인 카테고리는 표시하지 않는다.
- **톤 강조**: 기본 톤은 amber (warning). 분해 카운트의 `error ≥ 1` 이면 좌측 dot / border 색을 red 로 강조해 가장 시급한 사유를 시각적으로 알린다 — 텍스트는 동일.
- **클릭 동작**:
  - 합계 ≥ 2 → `?status=attention` 으로 URL 갱신 (§9.1 가상 필터값) → 같은 페이지에 합집합 결과 표시.
  - 합계 = 1 → 그 한 건의 detail 페이지(`/integrations/<id>`) 로 직접 이동. 필터링 단계는 우회한다 (UX 단축 — 1건이면 사용자가 어차피 그 건으로 갈 것).
- **0건이면 비표시**.
- URL 직접 진입 (`/integrations?status=attention`) 도 동일 합집합 결과를 보여준다 (`Attention` 칩이 활성화된 상태).
- **집계 범위 — 현재 페이지 한정**: 배너의 합계·분해 카운트·단일 건 점프 판정은 **현재 페이지의 rows 만** 보고 계산한다 (별도 카운트 API 를 호출하지 않음). 첫 페이지 30건을 채우는 attention 행이 더 있어도 배너에는 "30건" 까지만 표시된다. 사용자가 배너를 눌러 `?status=attention` 필터에 들어가면 그 다음부터는 페이지네이션을 따라 전체를 탐색한다. "총 attention 건수" 를 더 정확히 보고 싶을 때를 위한 별도 카운트 API 는 spec §11.4 사이드바 배지 카운트가 담당한다.

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

   > **별도 승인 필요 권한 안내** — 체크박스 옆 ⚠ 아이콘이 표시된 카테고리는 카페24 본사가 별도 승인한 클라이언트만 사용 가능하다 (Mileage / Notification / Privacy 의 R·W 전부, Store 안 일부 sub-resource). 명단의 SoT 는 [`spec/conventions/cafe24-restricted-scopes.md`](../conventions/cafe24-restricted-scopes.md). 체크 자체는 차단하지 않으나, 체크된 권한 중 별도 승인 대상이 1개 이상이면 폼 하단에 **inline alert (warning, amber 톤 — [`spec/0-overview.md §3.4`](../0-overview.md#34-상태-표시-패턴))** 를 영구 표시한다 — 미승인 상태로 진행하면 OAuth 단계에서 `invalid_scope` 또는 호출 시 `INSUFFICIENT_SCOPE (403)` 으로 실패할 수 있다. tooltip 문구·alert 본문 i18n 키는 같은 컨벤션 §4.1.
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

**헤더 메타 라인**: `<인증 유형> · <Scope> · <상태 배지> · <Last used …>` 형식. **자동 갱신 통합(`autoRefresh=true`, §9.1)** 은 상태 배지의 메인 라벨이 `Connected` 인 경우에 한해 그 옆에 작은 보조 라벨 `Auto-renews · next in <duration>` 을 회색 톤(muted)으로 노출한다 (예: `Auto-renews · next in 1h 24m`). `<duration>` 은 `token_expires_at - NOW()` 의 사람 친화 표기. `connected` 가 아닌 다른 상태(에러·만료·`pending_install` 등) 이거나 `autoRefresh=false` 면 보조 라벨은 표시하지 않는다.

헤더 아래 탭(앵커 기반 `#security`, `#usage`, …)으로 섹션을 스위치한다.

### 4.2 Overview 탭

| 요소 | 설명 |
|------|------|
| 기본 정보 | 서비스, 별칭, 생성자, 생성·수정일, 마지막 사용 시각, 마지막 회전 시각, **토큰 만료 시각** (`autoRefresh=true` 통합은 친화 표기 `in <duration> · auto-renews` 로 노출하고 절대시각은 행 호버 시 Tooltip 으로 강등; `autoRefresh=false` 는 절대시각 직접 표기) |
| Quick actions | `Test connection` (connected 한정), `Reauthorize`(OAuth · `pending_install` 또는 cafe24 private 에서 비활성 — §4.3 Reauthorize 상세 조건 참조. `autoRefresh=true` 통합이 `status='connected'` 인 동안에는 자동 갱신이 정상 동작 중이므로 사용자 액션 불필요 — 버튼은 활성 유지하되 hover 시 "Auto-renewing — manual reauthorization is not required" 안내), `Rotate credentials`(비OAuth), `Edit alias` |
| 상태 배지 | 현재 상태 + reason (`error(insufficient_scope)` 등) |
| 별칭 편집 | 인라인 편집, `PATCH /api/integrations/:id` |
| App URL 카드 (Cafe24 Private 한정) | `service_type='cafe24' AND credentials.app_type='private'` 일 때만 표시. **App URL** (`${APP_URL}/api/3rd-party/cafe24/install/:installToken`) 과 **Redirect URI** (`${APP_URL}/api/3rd-party/cafe24/callback`) 를 복사 버튼과 함께 노출한다. Cafe24 Developers Console 의 "앱 URL" 갱신용 — App URL HMAC 검증 실패 에러 페이지가 안내하는 비교 대상이 본 카드다. 신규 등록 흐름의 `Cafe24PrivatePending` 컴포넌트와 동일한 복사 UX 패턴 (라벨 + 모노스페이스 URL + 복사 버튼 + 1줄 안내) 재사용. 결정 근거는 Rationale "Cafe24 App URL 상세 페이지 표시" 항. |

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
| 별도 승인 ⚠ 배지 | 현재 scope · 권장 scope · 누락 scope 의 각 항목 옆에 backend 메타데이터의 `restrictedApproval` (또는 `oauth/begin` 응답의 동등 정보) 가 있는 scope/operation 만 ⚠ 배지 자동 노출. tooltip 본문은 [`cafe24-restricted-scopes.md §4.1`](../conventions/cafe24-restricted-scopes.md#41-사용자-안내-ui) 의 i18n 문구. `[Request scopes]` 버튼 위쪽에 "추가하려는 scope 중 N개는 카페24 별도 승인 필요" 보조 텍스트 (N=교집합 크기). `status_reason='oauth_invalid_scope'` 또는 `INSUFFICIENT_SCOPE` 응답의 `details.requiresCafe24Approval` 가 채워져 있으면 "이 권한은 카페24 별도 승인이 필요해요" 분기 메시지 추가 노출 (§10.4 참조) |
| `[Request scopes]` 버튼 | 체크된 추가 scope 와 함께 `POST /api/integrations/:id/request-scopes` 호출. 응답 분기는 아래 두 가지 — provider 분기는 backend 가 응답 shape 으로 결정하므로 frontend 는 응답 shape 만 보고 UI 를 분기한다. 응답 필드 전체 정의는 §9.2 참조. |

**분기 ① — 일반 OAuth provider (Google / GitHub / Cafe24 Public)**

- 응답: `authUrl` 포함 (기타 필드는 §9.2 참조).
- UI: 새 창으로 OAuth 팝업 열고 성공 토스트 ("Scope request window opened" / "권한 요청 창을 열었어요"). 팝업 닫힘 시 success 면 부모 페이지가 `credentials.scopes` 병합 결과를 refetch.

**분기 ② — Cafe24 Private**

- 응답: `{ mode: 'cafe24_private_pending', integrationId, appUrl, callbackUrl, scopesAdded: string[] }`.
- 사유: Private 앱은 우리 서버가 OAuth 를 시작할 수 없어 popup 진입점이 없다. Cafe24 Developers 의 앱 권한 설정에서 사용자가 직접 scope 활성화 후 "테스트 실행" 으로 재인증해야 한다 (Rationale "Cafe24 Private request-scopes 흐름" 항).
- UI: 공통 **Inline Alert** 패턴 ([`spec/0-overview.md §3.4`](../0-overview.md#34-상태-표시-패턴)) 의 warning(amber) 톤을 적용한다 — Scope 카드 안에 영구 표시, 다음 mutate 시 reset, refetch 미실행.
  - Title: "Cafe24 Developers 에서 권한을 추가해 주세요" / "Grant the additional scopes in Cafe24 Developers"
  - Description: "Cafe24 Developers 의 앱 권한 설정에서 추가 scope 를 활성화한 뒤 '테스트 실행' 을 다시 누르면 새 token 으로 갱신됩니다. (Private 앱은 외부에서 OAuth 화면을 띄울 수 없어 Cafe24 측 작업이 필요해요.)" / "Enable the additional scopes in your Cafe24 Developers app permission settings, then click 'Test run' again to refresh the token with the new scopes. (Private apps cannot initiate the OAuth flow externally, so the action must happen on Cafe24.)"
  - `scopesAdded` 가 비어 있지 않으면 그 목록을 작은 칩으로 alert 안에 나열 ("Scopes added: [scope_a] [scope_b]"). 빈 배열이면 칩 영역을 표시하지 않는다.
  - **즉시 토스트 (info 레벨)** — alert 표시와 동시에 한 번 띄워 응답이 왔음을 알린다 (도착 신호; 본문은 alert).
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
┌──────────────────┬──────────────────────────────┬─────────┬──────────┬───────────────────┐
│ At               │ API                          │ Status  │ Duration │ Error             │
├──────────────────┼──────────────────────────────┼─────────┼──────────┼───────────────────┤
│ 14:03 Apr 11     │ 상품 목록 조회               │ Success │ 412 ms   │ —                 │
│                  │ GET products                 │         │          │                   │
│ 13:55 Apr 11     │ POST                         │ Failed  │ 1203 ms  │ HTTP_5XX          │
│                  │ api.example.com/v1/users     │         │          │ HTTP 502 Bad Gate…│
│ 13:40 Apr 11     │ —                            │ Success │ 18 ms    │ —                 │
└──────────────────┴──────────────────────────────┴─────────┴──────────┴───────────────────┘
```

| 컬럼 | 내용 |
|------|------|
| At | 호출 시각 (상대 표기 + tooltip 절대 시각) |
| **API** | 라벨(굵게) + endpoint subtext(작게) 2줄 렌더. `apiLabel` 만 있으면 라벨 단독, `apiMethod`/`apiPath` 만 있으면 endpoint 한 줄 (`{method} {path}`), 둘 다 NULL 이면 `—`. 라벨은 frontend i18n dict 로 사람 친화 문구 (cafe24 catalog key → "상품 목록 조회" 등) 로 렌더 |
| Status | `Success` / `Failed` |
| Duration | `durationMs` 사람 친화 표기 (`412 ms` / `1.2 s`) |
| Error | 실패 행에서만 채워짐 — `error.code` + 첫 줄 메시지 (잘림). 빈 셀은 `—` |

- 데이터 출처: `GET /api/integrations/:id/activity?limit=20&days=7` (응답 shape 은 §9.3 참조)
- 실패 행 클릭 시 에러 요약 팝오버 표시 + `Execution detail →` 링크
- catalog 라벨 i18n: cafe24 의 `apiLabel` (`cafe24.<resource>.<operation>`) 은 `GET /api/integrations/services/cafe24/catalog` (§9.3) 응답의 `labelKey` 와 frontend i18n dict 를 결합해 KO/EN 라벨로 렌더. 다른 통합은 `apiLabel` 이 NULL 이라 endpoint 만 표시

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

테스트: `nodemailer` transporter 의 `verify()` 로 SMTP 연결·인증·(STARTTLS/TLS) 핸드셰이크를 검증한다. 실제 메일은 전송하지 않는다. 저장 전 사전 검증(`POST /api/integrations/preview-test`)·저장 후 테스트(`:id/test`)·rotate 세 경로 모두 동일하게 실제 SMTP `verify()` 를 수행한다 — Cafe24 의 사전 검증이 외부 호출을 하지 않는 것(§5.8)과 의도적으로 다르다 (SMTP 는 자격증명 자체가 외부 서버 인증을 거쳐야 검증되므로. [## Rationale](#smtp-연결-테스트를-verify-로-구현) 참조).

실패 결과 코드는 `IntegrationTestResult.code` 로 반환된다 — 노드 런타임 `output.error.code`([node-output §3.2](../conventions/node-output.md) envelope)와는 **별개 namespace** 이며 `MCP_CONNECT_FAILED` 와 동일 계열(값 형식은 동일 UPPER_SNAKE_CASE). 연결·인증·TLS 실패 시 `EMAIL_CONNECT_FAILED`(nodemailer 원본 메시지 동반), host 가 SSRF 가드에 차단되면 `EMAIL_HOST_BLOCKED`.

SMTP host 는 [HTTP Request 노드의 SSRF 가드](../4-nodes/4-integration/1-http-request.md#4-실행-로직)와 **동일한 메커니즘·플래그**를 공유한다 — 사설(RFC1918)·loopback·link-local·CGNAT·IPv6 사설 대역을 기본 차단하고, self-host 는 `ALLOW_PRIVATE_HOST_TARGETS=true` 로 opt-out 한다(내부 SMTP relay 보존). 연결 테스트와 send_email 노드 발송 양쪽에 동일 적용된다.

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
- **응답 shape (Cafe24 quirk)**: Cafe24 의 `/oauth/token` 응답은 OAuth 표준 `expires_in` (초) 을 돌려주지 않고 **`expires_at` (ISO8601 문자열)** 만 돌려준다. 단 `access_token` 자체가 JWT 라 `exp` claim 으로도 만료 시각을 알 수 있다. backend 의 token-exchange normalizer 는 **JWT `exp` 우선** → 표준 `expires_in` → cafe24 의 `expires_at` ISO (TZ designator 누락 시 `+09:00` 정규화) → 2h default 의 precedence 로 채택 ([Rationale "Cafe24 token 만료 SoT — JWT exp 격상"](#cafe24-token-만료-sot--jwt-exp-격상) 참고).

**Scope 권장 프리셋**

| 카테고리 | scope 값 (R / W) | 별도 승인 |
|---------|------------------|----------|
| Product | `mall.read_product` / `mall.write_product` | |
| Order | `mall.read_order` / `mall.write_order` | |
| Customer | `mall.read_customer` / `mall.write_customer` | |
| Category | `mall.read_category` / `mall.write_category` | |
| Promotion | `mall.read_promotion` / `mall.write_promotion` | |
| Mileage | `mall.read_mileage` / `mall.write_mileage` | ⚠ 필요 (R/W) |
| Shipping | `mall.read_shipping` / `mall.write_shipping` | |
| Sales report | `mall.read_salesreport` / — (write 없음) | |
| Translation | `mall.read_translation` / `mall.write_translation` | |
| Notification | `mall.read_notification` / `mall.write_notification` | ⚠ 필요 (R/W) |
| Application | `mall.read_application` / `mall.write_application` | |
| Store | `mall.read_store` / `mall.write_store` | ⚠ 일부 sub-resource |
| Design | `mall.read_design` / `mall.write_design` | |
| Community | `mall.read_community` / `mall.write_community` | |
| Collection | `mall.read_collection` / `mall.write_collection` | |
| Supply | `mall.read_supply` / `mall.write_supply` | |
| Personal | `mall.read_personal` / `mall.write_personal` | |
| Privacy | `mall.read_privacy` / `mall.write_privacy` | ⚠ 필요 (R/W) |

> "⚠" 표기된 카테고리는 카페24 본사가 별도 승인한 클라이언트만 사용 가능하다. 일반 사용자가 무심코 체크 후 OAuth 진행 시 `invalid_scope` 로 실패할 수 있어, UI 에서 체크박스 옆에 ⚠ 아이콘 + tooltip + 폼 하단 경고 배너로 인지를 보장한다. Store 의 "일부 sub-resource" 는 scope 단위가 아닌 operation 단위 (Activitylogs, Menus, Naverpay/Kakaopay setting, Paymentgateway 관련, Financials paymentgateway) 라 노드 Operation 드롭다운 ([Spec Cafe24 노드 §2](../4-nodes/4-integration/4-cafe24.md#2-설정-ui)) 의 ⚠ 라벨이 1차 안내 지점이다. 명단의 SoT 는 [`spec/conventions/cafe24-restricted-scopes.md`](../conventions/cafe24-restricted-scopes.md).

UI 는 카테고리 단위 체크박스(R / W 두 컬럼) + "고급" 토글 아래 개별 scope 추가 입력란.

**테스트 방법**: 저장된 `access_token` 으로 `GET https://{mall_id}.cafe24api.com/api/v2/admin/apps` 핑. 응답 200 + JSON 본문 확인.

- **Endpoint 선택 근거**: `/apps` 는 자기 앱 정보 조회로, 모든 cafe24 통합이 자기 앱이므로 scope 부족 위험이 가장 적다. 옛 `/store` 는 `mall.read_store` scope 가 없으면 403 으로 false negative 발생 ([Rationale "연결 테스트 endpoint 를 `/store` 에서 `/apps` 로 전환"](#연결-테스트-endpoint-를-store-에서-apps-로-전환) 참고).
- **401 자동 회복**: 응답 401 (`access_token time expired` 등) 시 `refresh_token` 으로 access_token 을 갱신한 뒤 1회 재시도. 재시도도 401 이면 `error(auth_failed)` 로 전이. §10.5 의 proactive `ensureFreshToken` 이 race condition (DB `expires_at` 미동기, 다중 인스턴스 등) 으로 빗나간 경우 자가 회복하기 위함 — `call()` 경로의 401 자동 회복 (§10.5) 과 동일 패턴.
- **403 처리**: status 격하하지 않고 `CAFE24_INSUFFICIENT_SCOPE` 메시지만 전달. 스코프 부족·앱 미설치는 사용자가 reauth/scope 추가로 해결.
- **transport 실패 카운터 제외**: 사용자가 직접 누른 진단용 호출이므로, `Integration.consecutive_network_failures` (§14.1) 합산 대상에서 제외. 이 카운터는 노드 실행 시점의 자동 호출만 합산한다.
- **사전 검증(`POST /api/integrations/preview-test`)**: 저장 전 자격 증명의 구조적 유효성만 검증하며, 외부 네트워크 호출은 수행하지 않는다 (§9.2 controller 의 throttle 20/min — 막 발급된 토큰이라 refresh 가 불필요).

**Rate Limit 정책**: Cafe24 leaky bucket. 응답 헤더 `X-Cafe24-Call-Remain`(재개까지 초), `X-Cafe24-Call-Usage`(%), `X-Api-Call-Limit`(현재/상한) 을 backend `Cafe24ApiClient` wrapper 가 모니터링. 429 응답 시 `X-Cafe24-Call-Remain` 값만큼 sleep 후 최대 2회 재시도. 노드 호출 / AI Agent MCP 호출 모두 같은 wrapper 를 통과해 동일 프로세스 인스턴스 내 Integration 단위로 leaky bucket 공유 — 같은 Integration 을 동시에 헤비하게 쓰면 양쪽이 함께 대기한다. 멀티 인스턴스 환경의 직렬화는 보장되지 않음 ([Spec Cafe24 §4.1](../4-nodes/4-integration/4-cafe24.md#41-rate-limit-처리-상세) 참조).

**AI Agent 노출**: `service_type='cafe24'` Integration 은 AI Agent 의 `mcpServers` 셀렉트에서도 선택 가능하며, 선택 시 백엔드의 `Cafe24McpToolProvider` 가 in-process `AgentToolProvider` 구현체로 동작해 18 카테고리의 Resource × Operation 을 MCP tool 로 노출한다. 도구 이름·allowlist 규약은 [Spec MCP Client §5](../5-system/11-mcp-client.md#5-도구-노출-모델) 그대로. 상세는 [Cafe24 노드 spec §"AI Agent 노출"](../4-nodes/4-integration/4-cafe24.md#8-ai-agent-노출-internal-mcp-bridge).

---

## 6. 상태 전이

```
  [pending_install] ──install callback success──▶ [connected]
          │                                       (install_token 보존)
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
          ├── install TTL 24h 만료 ──▶ [expired] (status_reason='install_timeout', install_token=NULL)
          │
          ├── callback 실패 (token exchange / state / row 조회) ──▶ [pending_install] (자기 루프, status_reason + last_error 갱신, status·install_token 보존)
          │
          └── manual delete ──▶ (삭제)
```

| 전이 | 트리거 이벤트 |
|------|--------------|
| pending_install → connected | Cafe24 Private 앱 "테스트 실행" → HMAC 검증 → OAuth callback 성공. `install_token` 은 **보존** (post-install navigation 의 식별 키로 계속 사용 — Rationale "Cafe24 App URL 재호출 흐름" 항 참조). |
| **pending_install → expired** | install_token 발급 후 24시간 내 callback 미성공 — 일일 스캐너가 `status='expired'`, `status_reason='install_timeout'`, `install_token=NULL` 로 자동 전이. 재시도하려면 사용자가 새로 통합을 등록한다 (단 private 앱은 reauthorize 불가 → 권장: 삭제 후 재등록) |
| **pending_install → pending_install (callback 실패 보존)** | OAuth callback 처리 중 token exchange 실패 / state mismatch / state expired 등이 발생하면 status 는 보존되고 `last_error` + `status_reason` (`oauth_token_exchange_failed` / `oauth_state_mismatch` / `oauth_state_expired` / `oauth_invalid_scope`, 모두 snake_case) 만 갱신된다. 사용자가 cafe24 측 설정을 고치고 "테스트 실행" 을 다시 누르면 새 OAuthState 가 생성되어 재시도 가능. `oauth_invalid_scope` 는 Cafe24 가 요청 scope 를 거부한 케이스이며 `last_error.details.requiresCafe24Approval` 에 영향 scope 가 동행된다 (§10.4 / [`cafe24-restricted-scopes.md §4.3`](../conventions/cafe24-restricted-scopes.md#43-에러-안내-에러-발생-후)). ※ row 자체가 사라진 `resource_not_found` 케이스는 갱신 대상이 없어 §10.4 "변경 불가" 행으로만 다룬다. |
| connected → error(auth_failed) | 노드 실행 중 **401** (cafe24: §10.5 의 refresh + 1회 재시도 후에도 401일 때만; 그 외 provider 는 즉시) **/ 403** (즉시), 또는 매일 스캐너 / 노드 실행 직전 토큰 갱신 시 `refresh_token` 자체 무효 (`invalid_grant`). |
| connected → error(insufficient_scope) | 노드 실행 중 403 + 서비스별 `missing_scope` 시그널 |
| connected → error(network) | 노드 실행 중 또는 토큰 갱신 중 transport 실패가 3회 연속 (V049 컬럼 `consecutive_network_failures` 카운터로 판정) |
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
| GET | `/api/integrations` | 목록 조회. 쿼리: `q`, `scope`, `serviceType`, `status`, `page`, `limit`. `status` 허용값 = `connected` / `expiring` / `expired` / `error` / `attention` — 이 중 `expiring` 과 `attention` 은 **가상 필터값** 으로 DB Enum 에는 없고 백엔드 쿼리 빌더가 합집합 WHERE 절로 변환한다. `expiring` = `status='connected' AND token_expires_at within 7d AND NOT integration.autoRefresh`, `attention` = `Expired ∪ Expiring ∪ Error` (`Expiring` 의 autoRefresh 제외가 자동 전파). 목록 응답의 각 row 는 상세 응답과 동일한 `IntegrationDto` 형식이라 derived 필드 `autoRefresh` 와 `appUrl` 이 모두 포함된다. 페이지네이션 응답 형식은 [API 규약 §5.2](../5-system/2-api-convention.md#52-목록-응답) 준수. |
| POST | `/api/integrations` | 연동 생성. OAuth는 `preview_token`으로 서버 임시 저장 토큰 참조 |
| GET | `/api/integrations/:id` | 상세 조회. credentials 는 마스킹. 응답 envelope 는 [API 규약 §5.1](../5-system/2-api-convention.md#51-단일-리소스) 의 `{ data: IntegrationDto }` 형식이며, `IntegrationDto` 는 다음 두 derived 필드를 포함한다 — (a) `appUrl: string \| null` — Cafe24 Private 통합 (`service_type='cafe24' AND credentials.app_type='private'`) 은 `${APP_URL}/api/3rd-party/cafe24/install/:installToken` 값, 그 외 통합은 `null`. `install_token` 자체는 응답에 별도 필드로 노출되지 않고 App URL path segment 안에만 포함된다 (식별자 분산 방지 — Rationale "Cafe24 App URL 상세 페이지 표시" 참조). (b) **`autoRefresh: boolean`** — 자동 갱신 가능 통합 식별자. 백엔드 service registry 의 `ServiceDefinition.supportsTokenAutoRefresh` (`codebase/backend/src/modules/integrations/services/service-registry.ts`) 에서 파생되는 derived 필드로 DB 컬럼이 아니며 매 응답 시점에 계산된다. 현재 `service_type='cafe24'`, `service_type='google'` 이 `true`, 그 외(`github` 포함 — Refresh ✗, §10.3) 는 `false`. 사이드바 카운트(§11.4) / `Need attention` 배너(§2.4) / `Expiring`·`Attention` 칩(§2.3) / 상세 페이지 헤더·Overview(§4.1·§4.2) 의 UI 분기 신호로 사용된다. 권한 레벨 무관 — 모든 인증된 요청에서 동일하게 포함된다. |
| PATCH | `/api/integrations/:id` | 별칭 등 메타 수정 |
| DELETE | `/api/integrations/:id` | 삭제 (사용처 있으면 409) |
| POST | `/api/integrations/:id/test` | 현재 저장된 자격 증명으로 연결 테스트. ※ `status='pending_install'` row 는 외부 호출 없이 `200 + { success:false, code:'INTEGRATION_INCOMPLETE' }` 로 즉시 거부 — 토큰 미발급 상태라 외부 API 호출 자체가 무의미. service_type 무관 status 기반 가드 (현재 `pending_install` 은 Cafe24 Private 전용이지만 향후 다른 provider 도입 시 자동 적용). UI 측 버튼 비활성 (§4.2) 의 백엔드 backstop. 응답 형식은 인접 가드 (`INTEGRATION_CREDENTIALS_UNREADABLE`, cafe24 incomplete credentials) 와 동일한 `IntegrationTestResult` shape — 자세한 근거는 Rationale "연결 테스트 endpoint 의 `pending_install` 가드 — 응답 형식" 참고. |
| GET | `/api/integrations/services` | 지원 서비스 메타데이터 (필드 스키마 포함) |

### 9.2 인증 / 회전 / Scope

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/integrations/oauth/begin` | OAuth 시작. body: `{ service, scopes[], mode, integrationId? }`. **Cafe24 Public**: `mall_id`, `app_type='public'` 추가 → `{ authUrl, state }` 반환 (popup 흐름). **Cafe24 Private**: `mall_id`, `app_type='private'`, `client_id`, `client_secret` 추가 → `{ mode:'cafe24_private_pending', integrationId, appUrl, callbackUrl }` 반환 (Integration `pending_install` 생성, popup 없음). ※ Cafe24 Private 응답의 `appUrl` 은 `${APP_URL}/api/3rd-party/cafe24/install/:installToken` 형식이다 — `installToken` 은 본 begin 호출이 발급한 **16바이트 base64url (22자, `^[A-Za-z0-9_-]{22}$`)** 로 Cafe24 Developers "앱 URL" 에 그대로 등록된다. ※ Cafe24 흐름 진입 시 (app_type 무관 — public/private 모두) 동일 `(workspaceId, mall_id)` 의 cafe24 Integration 중 다음 조건이 맞으면 begin 자체가 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED (409)` 으로 즉시 거부된다: **Public 흐름** — `status='connected'` row 존재 시 (Public 은 begin 단계에서 row 를 만들지 않으므로 V045 partial UNIQUE 가 finalize 단계로 미뤄지면 사용자가 OAuth 동의까지 마친 뒤에야 충돌이 드러난다 → begin 단계 SELECT 로 connected row 만 사전 차단). **Private 흐름** — `status='connected'` row 존재 시 동일 차단; 추가로 `status='pending_install'` 인 row 가 있고 `credentials.app_type='private'` 이면 새 row 를 만들지 않고 기존 row 를 reuse (`install_token` 보존, idempotent begin). **다른 status (`expired`/`error`)** 는 begin 단계에서 차단하지 않고 V045 partial UNIQUE 가 finalize 단계의 race backstop 으로 동일 409 코드로 변환한다 — 한 workspace 안에서 같은 mall_id 의 cafe24 통합은 최대 1행 (`spec/1-data-model.md §3` partial UNIQUE 참조) 이며 사용자는 기존 통합을 사용하거나 삭제 후 재등록한다. 자세한 근거는 Rationale "Cafe24 Public 흐름의 begin-time 사전 가드 추가" 항. |
| GET | `/api/integrations/cafe24/precheck` | 사용자가 mall_id 입력 단계에서 호출하는 사전 중복 감지. 쿼리: `mallId` (`^[a-z0-9-]{3,50}$`). 응답 DTO: `Cafe24PrecheckResultDto` (`ApiOkWrappedResponse` 래퍼) = `{ conflict: bool, existingIntegrationId?: string, existingName?: string, status?: 'connected'\|'pending_install'\|'expired'\|'error' }`. **인증된 사용자의 current workspace** (X-Workspace-Id 헤더 기준) **소속 cafe24 row 만 노출** — cross-workspace 접근 경로 아님. 자격 증명·토큰·timestamps 미노출. priority `connected > pending_install > error > expired` 로 가장 제한적인 row 만 반환. enum 범위 밖 transitional status (`initializing` 등) 가 들어오면 `status` 필드를 omit 해 frontend silent fallthrough 방지. **NestJS 라우트 선언 순서**: `:id` 동적 경로보다 앞에 선언해야 `cafe24` 가 UUID 로 해석되지 않는다 (코드 회귀 안전망은 controller 주석에 명시). **throttle 60/min** — 이 endpoint 전용 상한이며 일반 API rate limit 위에 더해지지 않고 본 값으로 대체된다 (`@Throttle` decorator). 사용자 입력 350ms debounce 기준 정상 호출 1~2회/입력으로 충분. 자세한 근거는 Rationale "precheck endpoint — mall_id 입력 단계 사전 감지 UX" 항. |
| GET | `/api/3rd-party/cafe24/install/:installToken` | Cafe24 Private 앱 App URL 엔드포인트. **두 가지 진입점에서 호출됨**: ① 초기 install — Cafe24 Developers "테스트 실행" → OAuth authorize 로 redirect. ② post-install navigation — 카페24 쇼핑몰 관리자의 "앱으로 가기" 버튼 → 우리 frontend 로 redirect. path 의 `:installToken` 은 oauth/begin 응답으로 받은 16바이트 base64url (22자, `^[A-Za-z0-9_-]{22}$`). 쿼리: `mall_id`, `timestamp`, `hmac` 등 Cafe24 표준 파라미터. **식별 절차**: `install_token` 으로 단일 row 조회 → 그 row 의 `client_secret` 으로 HMAC 1회 검증. status 분기: `pending_install` → Cafe24 authorize URL 로 `302`; `connected`/`error(*)`/`expired` → `${FRONTEND_URL}/integrations/<id>` 로 `302` (post-install navigation). `install_token` 은 통합 lifetime 동안 persistent 식별자 (callback 성공 시 NULL 처리 안 함). 에러: `CAFE24_INSTALL_MISSING_PARAMS`(400, `mall_id`/`timestamp`/`hmac` 누락), `CAFE24_INSTALL_INVALID_TOKEN`(404, 토큰 미존재 — TTL 만료 / 통합 삭제 — 단 직접 매칭 실패 시 `tryRecoverByMallId` 회복 흐름 fall-back 후 여전히 미매칭일 때), `CAFE24_INSTALL_INVALID_HMAC`(403), `CAFE24_INSTALL_REPLAY`(400, timestamp ±5분 초과), `CAFE24_INSTALL_RATE_LIMITED`(429, 같은 IP 의 조회/HMAC 실패가 임계치 초과 — enumeration 방어 lockout). **Rate limit**: IP별 `30/min` throttle (Layer 1 — 현재 pod별 in-memory; Redis 분산 store 이전은 후속 infra PR) + 실패 페널티 lockout (Layer 2 — Redis cross-pod). 상세·상수는 [Spec Cafe24 §9.8](../4-nodes/4-integration/4-cafe24.md#98-private-앱-app-url-hmac-검증) Rate limiting note 참조. |
| GET | `/api/3rd-party/:provider/callback` | OAuth 콜백 (§10) — `:provider ∈ {cafe24, google, github}` |
| POST | `/api/integrations/preview-test` | 저장 전 인증 정보로 연결 테스트. body: `{ service, authType, credentials }`. 외부 호출 여부는 service_type 별로 다름 — **Email(SMTP)**: 실제 `verify()` 외부 호출 (§5.5), **Cafe24**: 구조 검증만 (§5.8), 그 외: §5.x 각 정의 |
| POST | `/api/integrations/:id/reauthorize` | OAuth 재인증 authUrl 발급 |
| POST | `/api/integrations/:id/rotate` | 비OAuth 자격 증명 교체. body: 신규 credentials 객체. 내부적으로 테스트 → 성공 시만 커밋 |
| POST | `/api/integrations/:id/request-scopes` | 추가 scope 요청. body: `{ scopes: string[] }`. 응답 분기: 일반 provider — `{ authUrl }` (팝업 OAuth). **Cafe24 Private** — `{ mode: 'cafe24_private_pending', integrationId, appUrl, callbackUrl, scopesAdded }` (popup 없음, 사용자가 Cafe24 Developers 에서 권한 추가 후 "테스트 실행" 으로 재인증). 본 endpoint 가 내부적으로 cafe24 Private 분기를 자동 처리하므로 frontend 는 provider 분기 로직 없이 응답 shape 만 보고 UI 분기. |
| PATCH | `/api/integrations/:id/scope` | Personal ↔ Organization 전환 (Admin) |

### 9.3 사용처·활동

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/integrations/:id/usages` | 사용 중 워크플로우·노드 목록 |
| GET | `/api/integrations/:id/activity` | 최근 호출 이력. 쿼리: `limit`(기본 20, 최대 100), `days`(기본 7, 최대 30). 응답: `{ items: ActivityItem[], summary: { totalCalls, successRate, dailyCounts[] } }`. `ActivityItem` 의 필드는 아래 항목 (a) 참조 |
| GET | `/api/integrations/services/:type/catalog` | 서비스 타입별 API 카탈로그 조회. 응답: `{ operations: Array<{ key, method, path, labelKey, descriptionKey }> }`. `key` 는 §4.6 의 `apiLabel` 과 join key (cafe24 의 경우 `cafe24.<resource>.<operation>` — [`spec/conventions/cafe24-api-metadata.md`](../conventions/cafe24-api-metadata.md)). `method`/`path` 는 §4.6 표시용 endpoint subtext fallback. `labelKey`/`descriptionKey` 는 frontend i18n dict 가 사람 친화 라벨로 변환한다. **초기 응답 정책**: `:type='cafe24'` 만 backend 메타데이터에서 추출한 `operations[]` 를 채워 반환하고, `:type ∈ {http, database, email, webhook, mcp, google, github}` 은 빈 배열 (`{ operations: [] }`) 을 반환한다 — cafe24 외 통합은 활동 로그의 `apiLabel` 이 NULL 이라 catalog 매핑이 의미 없기 때문 (§4.6 의 endpoint-only fallback 으로 충분). 미지원 `:type` 은 일반 404. 모든 인증된 요청에서 접근 가능, workspace 격리 없음 (메타데이터는 동일 응답). 백엔드 응답 DTO 이름: `OperationCatalogDto` (기존 `ServiceCatalogDto` — `GET /api/integrations/services` 의 "서비스 종류 목록" — 와 명확히 구분). NestJS 선언 순서 — `:id` 동적 경로보다 앞, `services/:type` 단독 경로 (장래 추가 시) 보다 뒤. 기존 `cafe24/precheck` 사례와 동일 패턴. |

**(a) `ActivityItem` shape** (모든 통합 공통):

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | UUID | `integration_usage_log.id` |
| `integrationId` | UUID | `integration_usage_log.integration_id` |
| `nodeExecutionId` | UUID? | `integration_usage_log.node_execution_id` (있을 때) |
| `workflowId` | UUID? | 연관 워크플로우 (joined) |
| `status` | `'success' \| 'failed'` | 호출 결과 |
| `error` | `{ code, message } \| null` | 실패 시 코드 + 메시지 (sanitize 적용) |
| `durationMs` | number | 호출 소요 시간 |
| `at` | ISO8601 | 호출 시각 |
| **`apiLabel`** | string \| null | 통합별 channel 별 라벨 (catalog key 형식). 채우기 정책은 [`spec/4-nodes/4-integration/_product-overview.md §2.4`](../4-nodes/4-integration/_product-overview.md#24-사용처-추적-및-라이프사이클) 참조 — 요약: cafe24 는 `cafe24.<resource>.<operation>`, 나머지 3종은 NULL |
| **`apiMethod`** | string \| null | HTTP method / SQL 동사 / `SEND` 등 — 통합별 의미 다름 |
| **`apiPath`** | string \| null | host+path / driver / SMTP host 등 — 통합별 의미 다름 |

- 백엔드는 저장 시 `api_label`/`api_method`/`api_path` 컬럼에 각각 `varchar(128)`/`varchar(8)`/`varchar(256)` 한도로 저장하고, 한도 초과 시 끝에 `…` 를 붙여 잘라 보관한다 (`clampMessage` 패턴).

### 9.4 공통 응답 포맷

- 성공: `{ data: ... }` 또는 `{ data: ..., pagination: ... }` (기존 컨벤션 준수)
- 실패: `{ code, message, details? }`
  - `INTEGRATION_IN_USE` (409) — 삭제 차단
  - `INTEGRATION_TEST_FAILED` (422) — 연결 테스트 실패
  - `OAUTH_STATE_MISMATCH` (400)
  - `OAUTH_CONFIG_MISSING` (500)
  - `INSUFFICIENT_SCOPE` (403) — 노드 실행 중 감지 시 `Integration.status` 도 `error(insufficient_scope)` 로 갱신. 응답 `details` 는 다음 필드를 포함한다: `missingScopes: string[]` (Cafe24 응답에서 추출한 누락 scope 목록 — 본 코드 도입 시 신설된 필드), 그리고 `requiresCafe24Approval?: string[]` (Cafe24 통합에 한정 — `missingScopes` ∩ [`spec/conventions/cafe24-restricted-scopes.md`](../conventions/cafe24-restricted-scopes.md) **§1·§2 명단 전체** 의 교집합. §1 (scope 단위) 과 §2 (operation 단위, store 안) 양쪽을 모두 본다. 단 §2 항목들은 scope 자체가 일반 사용 가능 (`mall.read_store`/`mall.write_store`) 이라 `missingScopes` 가 그 scope 토큰만 갖고 있는 한 교집합은 비어있고, frontend 가 안내 메시지를 띄울 트리거는 §1 항목들이 주가 된다. 다른 provider 통합에서는 본 필드 자체를 omit). frontend 는 `requiresCafe24Approval` 가 비어있지 않으면 에러 메시지에 "이 권한은 카페24 별도 승인이 필요해요" 분기 메시지를 추가 노출한다. 본 보강은 기존 코드를 분기시키지 않는 추가 필드일 뿐 — 신규 에러 코드 미추가 (하위 호환 유지).
  - `CAFE24_INSTALL_MISSING_PARAMS` (400) — App URL 호출에 `mall_id` / `timestamp` / `hmac` 중 하나라도 누락. capability-token 가정(install_token 추측 불가) 에 영향 없는 파라미터 누락 분기로 별도 코드 (404/403 합산 정책과 무관 — Rationale 참조).
  - `CAFE24_INSTALL_INVALID_TOKEN` (404) — App URL 의 `install_token` 미존재 (통합 삭제 또는 24h TTL 만료로 소거). callback 성공만으로는 소거되지 않음 (post-install navigation 의 식별 키로 보존). 직접 매칭 실패 시 `tryRecoverByMallId` 회복 흐름 fall-back 후에도 미매칭이면 본 코드 반환 ([Rationale "Cafe24 install_token mismatch 회복 흐름"](#rationale) 참조).
  - `CAFE24_INSTALL_INVALID_HMAC` (403) — App URL HMAC 검증 실패
  - `CAFE24_INSTALL_REPLAY` (400) — App URL 의 timestamp 가 ±5분 윈도우 밖
  - `CAFE24_INSTALL_RATE_LIMITED` (429) — 같은 IP 의 install_token 조회/HMAC **실패**가 `INSTALL_FAIL_THRESHOLD` (window `INSTALL_FAIL_WINDOW_SEC`) 초과. token oracle enumeration 방어 lockout (Layer 2 — Redis cross-pod, 본 PR 구현). 성공한 install 은 카운트하지 않으므로 정상 사용자는 트리거되지 않는다. IP throttle(Layer 1, `30/min` per IP — 현재 pod별 in-memory, Redis 분산 store 는 후속) 과 함께 [Spec Cafe24 §9.8](../4-nodes/4-integration/4-cafe24.md#98-private-앱-app-url-hmac-검증) Rate limiting note 가 SoT.
  - `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` (409) — 동일 `(workspaceId, mall_id)` 에 이미 cafe24 Integration (`app_type` 무관 — public/private 모두) 이 존재. SQL UNIQUE 가 `service_type='cafe24'` 기준이므로 app_type 분리 보유 불가. **두 경로에서 동일 코드 반환**: ① Cafe24 Public/Private begin 의 사전 SELECT (connected row 만 차단), ② `POST /api/integrations` finalize 단계의 V045 partial UNIQUE 위반 (race backstop — `idx_integration_cafe24_workspace_mall` 의 `23505` 를 `throwIfUniqueViolation` 이 본 코드로 변환). 코드 이름의 `PRIVATE` 토큰은 historical artifact (신설 당시 Private 흐름 한정이었음) 이며 의미는 본 spec 정의에 따른다 — 클라이언트는 코드 이름이 아닌 본 의미(mall_id 기준 중복) 로 분기 (의미 기반 명명 선례 예외, Rationale "CAFE24_PRIVATE_APP_ALREADY_CONNECTED 코드명 유지 결정" 참조). swagger 규약(spec/conventions/swagger.md §2-4 — 중복/충돌은 409, `INTEGRATION_IN_USE(409)` 선례) 에 맞춤.

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
| Cafe24 `invalid_scope` (authorize / token exchange 단계 양쪽) | `Authorization rejected: invalid scope.` (안내 본문에 별도 승인 안내 분기) | **status 보존** + `status_reason='oauth_invalid_scope'` ([Spec Integration 데이터 모델 §2.10](../1-data-model.md#210-integration) status_reason 열거 참조) + `last_error.code='OAUTH_INVALID_SCOPE'` + `last_error.details.requiresCafe24Approval: string[]` (요청 scopes ∩ [`cafe24-restricted-scopes.md §1`](../conventions/cafe24-restricted-scopes.md#1-scope-단위-별도-승인-resource-전체-영향) 의 교집합) 기록. 통합 상세 페이지가 본 단서를 읽어 "이 권한은 카페24 별도 승인이 필요해요" 분기 메시지 노출. 진입 경로는 `oauth_token_exchange_failed` 와 분리 — 본 사유는 Cafe24 가 명시적으로 scope 거부한 케이스이고, `oauth_token_exchange_failed` 는 그 외 토큰 교환 실패 전부 (네트워크, 서버 오류, 알 수 없는 invalid_grant 등). |
| state mismatch / expired (state row 소비 후) | `Security validation failed.` / `OAuth state has expired.` | integrationId 가 식별되면 `status_reason='oauth_state_mismatch'` 또는 `oauth_state_expired` 만 기록, status 보존 |
| 토큰 발급 후 row 조회 실패 (resource not found) | `Integration not found.` | 변경 불가 (row 가 사라진 케이스. integrationId 만 식별, row 가 없으니 갱신 대상 없음) |
| 네트워크 오류 | `Connection error.` | integrationId 식별되면 `last_error` 만 기록, status 보존 |

### 10.5 토큰 자동 갱신

- Refresh token 보유 시 (provider 가 refresh_token 발급·갱신을 보장 — 현재 `cafe24`, `google`): 노드 실행 직전 만료 확인 → 만료됐으면 갱신 후 호출. 이 자동 갱신 가능 여부는 `IntegrationDto.autoRefresh: boolean` (§9.1) 로 클라이언트에 노출되어 상태 배지·attention 술어·Reauthorize hover 안내의 분기 신호로 쓰인다.
- **만료 시각 SoT**: Cafe24 의 `access_token` / `refresh_token` 은 JWT 이므로 **JWT `exp` claim** (RFC 7519, Unix epoch seconds — UTC absolute) 을 만료 시각의 single source of truth 로 사용한다. backend 의 token-exchange normalizer (`parseTokenExpiresAt`) 와 refresh path (`refreshAccessToken`) 는 내부적으로 `parseJwtExp(token)` 을 첫 단계로 호출해 결과를 최우선 채택하고, JWT 디코드가 비정상으로 null 인 경우에만 표준 `expires_in` → cafe24 한정 `expires_at` ISO (timezone designator 누락 시 `+09:00` KST 부여로 정규화) → 2h default 로 강하한다. ISO 의 timezone 모호성으로 `Integration.token_expires_at` 가 의도와 다른 epoch 로 저장돼 proactive refresh 와 워커 short-circuit 이 동시에 빗나가는 회귀 ([Rationale "Cafe24 token 만료 SoT — JWT exp 격상"](#cafe24-token-만료-sot--jwt-exp-격상) 참고) 의 영구 차단. JWT signature 검증은 본 용도에 불필요 (만료 시각 metadata 추출 목적; 토큰 진위는 Cafe24 API 호출 시점에 검증).
- **401 자동 회복 (`call()` 경로)**: proactive 갱신이 race condition (DB `expires_at` 미동기, 다중 인스턴스, NULL legacy row 등) 으로 빗나가 만료된 access_token 으로 Cafe24 API 호출이 401 을 받으면, `refresh_token` 으로 access_token 을 갱신한 뒤 동일 요청을 **1회만** 재시도. 재시도가 2xx 면 `status='connected'` 유지 (애초에 격하 없음). 재시도도 401 이면 토큰 자체 문제로 확정해 [Spec Cafe24 §6.1](../4-nodes/4-integration/4-cafe24.md#61-인증-실패-자동-status-전환) 의 `error(auth_failed)` 전이 발사. 403 은 본 자동 회복 대상 아님 (즉시 격하). 재시도 분기는 `refreshViaQueue` (`source='reactive_401'`) 를 거치며, cross-pod 직렬화는 `refreshAccessToken` 내부의 PostgreSQL `pessimistic_write` row lock 으로 보장된다. proactive/background 경로와 달리 BullMQ `jobId = integrationId` dedup 을 사용하지 않음 ([Rationale "reactive_401 jobId unique 화 — dedup 완전 우회"](#reactive_401-jobid-unique-화--dedup-완전-우회) 참조). 재시도 횟수는 정확히 1회 (429 rate limit 재시도와 별개 카운터). [§5.8 연결 테스트의 `pingConnection()`](#58-cafe24) 의 동일 패턴과 정책 통일. Rationale 의 "`call()` 의 401 자동 회복" 참고.
- **갱신 실패 시**: `refresh_token` 자체가 무효 (`invalid_grant`) 면 `error(auth_failed)` 로 전이 (옛 `expired` 분기는 폐기 — [Rationale "refresh 실패 시 status_reason 통일"](#rationale) 참고; cafe24 의 경우 본 격하 경로는 [§6.1 공통 격하 동작](../4-nodes/4-integration/4-cafe24.md#61-인증-실패-자동-status-전환) 에 명세). transport 실패가 3회 연속이면 `error(network)` 로 전이 (V049 카운터). `integration_expired` 알림은 `expired` 전이에만 발사하며 `error(*)` 전이는 UI 배지로만 표시 (§11 참고).
- 갱신 성공 시: `Integration.last_rotated_at` 도 함께 갱신해 백그라운드 갱신 스캐너의 cutoff 비교에 사용된다 (§11.1 `cafe24-background-refresh`).
- **원자 갱신**: 토큰 갱신 성공 시 `credentials.access_token` / `credentials.refresh_token` / `credentials.expires_at` / `Integration.token_expires_at` 4개 필드를 **동일 트랜잭션 내 원자 UPDATE**. partial write 시 다음 노드 실행이 inconsistent token state 를 사용하는 race condition 방지.
- **Cafe24 한정**: 갱신 endpoint 도 `https://{credentials.mall_id}.cafe24api.com/api/v2/oauth/token`. `mall_id` 누락 시 `INTEGRATION_INCOMPLETE` 로 즉시 실패. **백그라운드 갱신**: 6시간 주기 `cafe24-background-refresh` 잡 (§11.1) 이 `lastRotatedAt < now - 7d OR IS NULL` 인 connected cafe24 통합을 `cafe24-token-refresh` 큐로 enqueue 해 14일 idle 통합의 refresh_token 도 자동 갱신한다. **0d 만료 자가 회복**: 백그라운드 갱신이 도달하기 전 (또는 그 외 어떤 이유로) access_token 만료가 발생해 `connected-expiry` 일일 잡의 `0d` 임계에 매칭되면, scanner 가 cafe24 행을 `expired` 로 격하하는 대신 `cafe24-token-refresh` 큐로 enqueue 한다 (§11.1 표 참조). worker 가 refresh 성공 시 `last_rotated_at`/`token_expires_at` 갱신 후 `connected` 유지, `invalid_grant` 시 `error(auth_failed)` 전이. 본 정책으로 **cafe24 의 `expired` 상태는 사실상 `install_timeout` (Cafe24 Private 24h TTL) 한 가지 경로만 남는다** — refresh_token 유효 상태에서 access_token 만 만료된 케이스가 `expired` 로 격하되어 AI Agent/노드의 자가 회복 경로를 막던 회귀 해소. **멀티 인스턴스 race**: cafe24 refresh 호출의 직렬화 메커니즘은 source 에 따라 다르다.
- `proactive` / `background`: `cafe24-token-refresh` 큐의 `jobId = integrationId` dedup 으로 클러스터 전체 직렬화 — thundering herd / refresh_token rotation race 보호.
- `reactive_401`: BullMQ dedup 을 우회하는 unique jobId (`${integrationId}#reactive-${Date.now()}-${rand6}`) 사용. cross-pod 직렬화는 `refreshAccessToken` 의 `pessimistic_write` row lock 으로 폴백 보호. 완료된 proactive job 으로의 dedup 회귀를 영구 차단 ([Rationale "reactive_401 jobId unique 화 — dedup 완전 우회"](#reactive_401-jobid-unique-화--dedup-완전-우회) 참고).
참고: [Rationale "BullMQ cafe24-token-refresh 큐 — 멀티 인스턴스 race 해소"](#rationale).

---

## 11. 만료 스캐너 및 알림

> 만료 스캐너는 **네 개의 독립 BullMQ job** (`connected-expiry` / `pending-install-ttl` / `usage-log-prune` / `cafe24-background-refresh`) 으로 운영된다 — 각 job 은 자체 retry (`attempts: 3`, 60s exponential backoff) 와 큐 메트릭을 가지므로 한 패스의 실패가 다른 패스의 실행을 막지 않는다. Cafe24 Private 의 `pending_install` 24h TTL 만료는 `pending-install-ttl` job 이 담당. Cafe24 의 `refresh_token` 14일 만료 전 자동 갱신은 `cafe24-background-refresh` job 이 enqueuer 역할로 담당 (실제 갱신은 `cafe24-token-refresh` 큐의 worker — §10.5 참조). 상세 흐름·격리 정책은 [data-flow §1.4](../data-flow/5-integration.md#14-oauth-만료-스캐너-bullmq-integration-expiry) 참조.

> `service_type='mcp'` Integration 은 OAuth refresh token 흐름이 아니므로 `token_expires_at` 가 항상 NULL → 본 §11 의 임계치 알림 흐름은 적용되지 않는다. MCP 인증 실패는 노드 실행 시점에 401/403 으로 감지되어 `error(auth_failed)` 로 격하되며, 사용자는 `Rotate credentials` 로 토큰을 교체한다 (상세 [Spec MCP Client §8](../5-system/11-mcp-client.md#8-에러-처리)).

> `service_type='cafe24'` Integration 은 OAuth refresh token 을 보유하므로 본 §11 의 임계치 알림 흐름이 정상 적용된다. `token_expires_at` 가 만료 7일/3일/당일 임계에 도달하면 `integration_expired` 알림이 발사된다. Refresh 실패 시 §10.5 의 원자 갱신 정책이 partial write 를 방지하며, 갱신 실패한 토큰 셋은 그대로 expire 처리되어 사용자에게 reauthorize 권장.

### 11.1 스캐너 잡

네 개의 독립 BullMQ 잡. 각 잡은 enqueuer 역할만 하며 실제 갱신 작업은 큐의 worker 가 수행 (역할 분리). **주기 분리**:

- `connected-expiry` / `pending-install-ttl` / `usage-log-prune` — daily `0 0 * * *` UTC. 알림 빈도·24h TTL·90d retention 의 정량적 특성이 일일 cadence 와 일치.
- `cafe24-background-refresh` — **6h `0 */6 * * *` UTC**. refresh_token 14일 만기 사전 차단의 안전 마진 확보용 (자세한 근거는 [Rationale](#rationale) "`cafe24-background-refresh` 7일 임계 + 6h cron" 참조).

| Job name | 대상 | 동작 |
|----------|------|------|
| `connected-expiry` | `status NOT IN (expired, error, pending_install) AND token_expires_at IS NOT NULL` | `remain ≤ 0d`: `service_type='cafe24'` AND `credentials.refresh_token` 존재 행은 `cafe24-token-refresh` 큐 enqueue (jobId dedup — `cafe24-background-refresh` 와 동일 경로) + 알림. refresh 실패는 worker (`Cafe24TokenRefreshProcessor`) 가 `error(auth_failed)` 로 전이시키므로 본 잡은 status 변경 안 함. 그 외 (refresh_token 없는 provider) 는 종전대로 `status=expired` + 알림. `remain ≤ 3d` / `≤ 7d` → 알림만 (중복 방지 키, status 변경 없음). |
| `pending-install-ttl` | `status='pending_install' AND COALESCE(install_token_issued_at, created_at) < now-24h` (Cafe24 Private 한정) | `status='expired', status_reason='install_timeout', install_token=NULL` 으로 bulk UPDATE. **격리 수준**: PostgreSQL default READ COMMITTED + UPDATE … WHERE 의 row-level write lock 으로 충분. WHERE 절이 단일 행 단위로 매칭되고, `pending_install → expired` 전이는 idempotent (이미 expired 인 행은 WHERE 의 status 조건에서 자동 제외) 이라 동시 실행 (예: cron + 수동 호출) 시 한 cycle 의 일부 행을 두 잡이 나눠 처리하더라도 최종 상태는 동일. SERIALIZABLE / advisory lock 불필요. **알림 미발사** — 사용자가 외부 install 흐름 진행 중인 명시적 상태로 UI 배지 + 통합 상세 페이지로 통지 충분 (§11.2 + Rationale "install_timeout 알림 미발사" 참고). |
| `usage-log-prune` | `integration_usage_log.at < now-90d` | 행 삭제 (보존 정책) |
| `cafe24-background-refresh` | `status='connected' AND service_type='cafe24' AND (last_rotated_at < now-7d OR last_rotated_at IS NULL)` | `cafe24-token-refresh` 큐로 enqueue (`jobId = integrationId` dedup). 실제 refresh 는 `Cafe24TokenRefreshProcessor` worker 가 수행. 7일 임계 + 6h cron = refresh_token 14일의 50% 마진 (cron 누락 1회 흡수). scheduler ID `cafe24-background-refresh-daily` 는 historical 보존 — BullMQ idempotent upsert 활용 (ID 변경 시 옛 Redis entry 가 orphan 으로 잔존해 daily/6h 가 동시 fire 되는 회귀 위험). 자세한 근거는 [Rationale](#rationale) 참조. |

`connected-expiry` 흐름 의사코드:

```
for each integration:
  remain = token_expires_at - now()
  if remain <= 0d:
    if service_type='cafe24' AND credentials.refresh_token 존재:
      → cafe24-token-refresh 큐 enqueue (jobId=integrationId)
      → 알림 (status 변경 없음 — worker 가 결과에 따라 connected 유지/error 전이)
    else:
      → status=expired, 알림 (임계치: 당일)
  elif remain <= 3d → 알림 (임계치: 3일, 중복 방지 키 있음)
  elif remain <= 7d → 알림 (임계치: 7일, 중복 방지)
  else              → skip
```

### 11.2 알림 생성

두 가지 `Notification.type` 을 사용한다 — 분리 원칙은 **수동성 vs 능동성**:

#### `integration_expired` (passive — 만료 임박/도래)

| 상황 | 제목 | 메시지 | 수신자 |
|------|------|--------|--------|
| 7일 전 | `Integration expiring soon` | `"<name>" will expire on <date>.` | Personal: 소유자 / Organization: Admin 전원 |
| 3일 전 | `Integration expiring in 3 days` | 동일 | 동일 |
| 당일 | `Integration expired` | `"<name>" has expired. Reauthorize to continue using it.` | 동일 |
| 재인증 실패 | `Reauthorization failed` | `Failed to reauthorize "<name>".` | 동일 |

**중복 방지**: `(integration_id, threshold_key)`로 유니크 판정. 임계치별 최대 1회.

**발사 정책**: **refresh_token 없는 provider 의 `token_expires_at` 만료 (`status_reason='token_expired'`) 에만 발사**한다 (위 표의 7일/3일/당일 임계).

#### `integration_action_required` (active — 사용자 즉시 액션 필요)

| 상황 (`status_reason`) | 제목 | 메시지 | 수신자 |
|------|------|--------|--------|
| `auth_failed` | `Integration disconnected` | `"<name>" needs reauthorization — Cafe24 rejected the access token. Reconnect to resume.` | Personal: 소유자 / Organization: Admin 전원 |
| `insufficient_scope` | `Integration missing permissions` | `"<name>" is missing required scopes — open Settings → Integrations and re-grant access.` | 동일 |
| `network` | `Integration network failure` | `"<name>" failed 3 consecutive network calls. Check Cafe24 status or retry later.` | 동일 |

**중복 방지**: `(integration_id, status_reason)` 으로 유니크 판정 — 같은 사유로 같은 통합에 대해 최대 1회. 사용자가 재연결해 `connected` 로 회복하면 dedup 키 리셋.

> 24h 중복 방지(`hasRecentByResource`) 는 row 존재 여부로 판단하며, 사용자가 알림을 닫아 `dismissed_at` 이 채워진 row 도 카운트에 포함된다 ([`data-flow/8-notifications.md §4.4`](../data-flow/8-notifications.md#44-중복-방지-hasrecentbyresource-와의-관계)). 닫기는 표시 차원의 결정일 뿐 알림 재발사 빈도와 무관하다.

**발사 정책**: `Cafe24ApiClient.markAuthFailed` (auth_failed / insufficient_scope) 와 `recordNetworkFailure` (3회 누적 후 network) 안에서 발사. transition 이 **인-라인** 으로 알림을 emit 한다 — daily scanner 가 아닌 본 시점에서 1회.

**채널**: `notifyIntegrationExpiryByEmail` (옛 이름 그대로 재사용 — `integration_action_required` 에도 같이 적용) 활성화 시 `channel='both'`, 기본 `'in_app'`.

#### 알림 미발사 케이스

UI 배지 (사이드바 카운트 + 목록 카드 뱃지) 와 노드 에디터 경고 (§7.3) 로만 통지하며 별도 push 알림 미발사:
- **Cafe24 Private `install_timeout`** — 사용자가 외부 install 흐름 진행 중인 명시적 상태 ([Rationale "install_timeout 알림 미발사"](#rationale) 참고).

### 11.3 이메일 옵션

- 사용자별 프로필 설정에 `notifyIntegrationExpiryByEmail` 토글
- 활성화 시 `Notification.channel = 'both'`로 생성되어 `NotificationDispatcher`가 이메일 발송

### 11.4 UI 배지

- 사이드바 Integration 메뉴: `status IN (expired, error) OR (status='connected' AND token_expires_at IS NOT NULL AND token_expires_at > NOW() AND token_expires_at <= NOW() + INTERVAL '7d' AND NOT integration.autoRefresh)` 카운트 — §2.4 배너 포함 조건 및 §9.1 `?status=attention` 가상 필터값과 동일한 술어. `pending_install` 은 제외. **자동 갱신 통합(`autoRefresh=true`)** 은 만료 임박 분기에서 제외 (§2.4 와 동일 사유 — Rationale 참고).
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
- 신규 `IntegrationUsageLog` 엔티티 추가 (§2.10.1) — 노드 실행 완료 시 실행 엔진이 1건 기록. `api_label varchar(128)? / api_method varchar(8)? / api_path varchar(256)?` 컬럼 추가 — §4.6 Recent activity 탭의 API 컬럼 데이터 소스. 통합별 채우기 정책은 [`spec/4-nodes/4-integration/_product-overview.md` INT-US-05](../4-nodes/4-integration/_product-overview.md#24-사용처-추적-및-라이프사이클) 표
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
| `EMAIL_SEND_FAILED` | nodemailer 전송 실패 (send_email 노드) | Usage log `error.code` 기록 + `error` 포트 |
| `EMAIL_HOST_BLOCKED` | SMTP host 가 사설/loopback 이라 SSRF 가드에 차단 (기본 ON, `ALLOW_PRIVATE_HOST_TARGETS` opt-out) | send_email 노드는 `error` 포트 출력 / 연결 테스트는 `result.code` 반환 |
| `EMAIL_CONNECT_FAILED` | SMTP `verify()` 실패 (연결/인증/TLS) | **연결 테스트 전용** — `IntegrationTestResult.code` namespace (노드 런타임 `ErrorCode` enum 과 별개) |
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
| `cafe24` | 매 호출 (성공/실패 모두). AI Agent 의 `Cafe24McpToolProvider` 를 통한 호출도 동일 로그에 기록 — `node_execution_id` 는 호출 시점의 AI Agent NodeExecution. 메타도구는 미사용 ([Spec MCP Client §8.3 IntegrationUsageLog](../5-system/11-mcp-client.md#83-integrationusagelog)) |

### 14.2 워크플로우 에디터

- 노드 설정 패널에서 Integration 선택은 `IntegrationSelector` 공용 드롭다운을 사용한다 — `serviceTypes` prop으로 목록을 필터(Send Email은 `email`, Database는 `database`, HTTP의 `authentication='integration'` 모드는 `http`, Cafe24 노드는 `cafe24`, AI Agent 의 `mcpServers` 항목은 `['mcp', 'cafe24']`).
- AI Agent 의 `mcpServers` 셀렉트는 `service_type='mcp'` 와 `service_type='cafe24'` 를 모두 받는다 — 후자는 backend `Cafe24McpToolProvider` 가 in-process `AgentToolProvider` 구현체로 동작 ([Spec MCP Client §2.3 Internal Bridge](../5-system/11-mcp-client.md#23-internal-bridge-in-process)). UI 는 두 그룹을 시각적으로 분리 표시 (`🌐 Generic MCP (HTTP) servers` / `🛒 Cafe24 stores (Internal Bridge)`).
- AI Agent 노드는 Integration 노드와 달리 `mcpServers` 가 다중 선택 (multi-select) 이며, 서버별로 도구 allowlist·resource/prompt 노출 토글 UI 가 추가된다 — Cafe24 의 경우 도구 수가 많아(Resource × Operation = ~180) allowlist UI 가 카테고리 단위 grouping 으로 노출된다 (용어는 [Spec Cafe24 API 메타데이터 §8](../conventions/cafe24-api-metadata.md#8-allowlist-와의-관계) 기준; [Spec AI Agent](../4-nodes/3-ai/1-ai-agent.md), [Spec MCP Client §5.6](../5-system/11-mcp-client.md#56-도구-allowlist)).
- 연동 상태 배지를 함께 노출하며(§7.3), 해당 타입의 연동이 0건이면 `+ Create {Service} integration` CTA 링크를 select 아래에 표시(`/integrations/new?service=…&step=auth`).
- 삭제된 integrationId가 저장돼 있으면 `{id앞8자}… (missing)` 옵션을 추가해 값 보존.

### 14.3 감사 로그(AuditLog)

Integration 생성·삭제·회전·재인증·scope 전환 이벤트를 `resource_type='integration'`로 기록한다. `action`은 `integration.created`, `integration.deleted`, `integration.rotated`, `integration.reauthorized`, `integration.scope_changed`.


---

## Rationale

### SMTP 연결 테스트를 `verify()` 로 구현

종전 §5.5 는 "SMTP 핸드셰이크 + `NOOP`" 으로 기술됐으나, 실제로는 email 통합에 transport tester 가 없어 구조 검증(필드 존재·타입)만 통과하면 무조건 "성공" 을 반환했다 — 인증 실패한 자격증명도 "연결 성공" 으로 표시되는 운영 보고. `nodemailer` transporter 의 `verify()`(연결+인증+TLS 핸드셰이크)로 교체해 인증 실패를 사전에 정확히 surface 한다.

**preview-test 의 "외부 호출 없음" 원칙은 Cafe24 한정**(§5.8 — OAuth 토큰이 막 발급돼 구조 검증으로 충분)이며, Email 은 SMTP 인증이 외부 네트워크 없이 검증 불가하므로 명시적 예외다. 따라서 preview-test / `:id/test` / rotate 세 경로 모두 email 에서는 실제 `verify()` 를 수행한다.

### SMTP SSRF 가드를 http/db 와 동일 `ALLOW_PRIVATE_HOST_TARGETS` 로 통일

SMTP host 도 임의 사설/loopback 주소를 가리킬 수 있어 SSRF 표면이 된다. 별도 opt-in 플래그(`SMTP_BLOCK_PRIVATE_HOSTS` 안)를 신설하는 대신 **기존 `ALLOW_PRIVATE_HOST_TARGETS`(HTTP Request / Database Query 가 이미 사용)를 재사용**한다 — integration 노드 전반의 SSRF posture 를 일관되게(기본 차단·secure-by-default, self-host 만 opt-out) 유지하고, 노드별로 플래그가 갈리는 혼란을 막는다. 연결 테스트만 막고 실제 발송은 뚫리는 비대칭을 막기 위해 send_email 핸들러에도 동일 가드를 적용한다.

**코드명 `EMAIL_HOST_BLOCKED`**: HTTP 의 `HTTP_BLOCKED` 와 동일 메커니즘이지만, 차단 원인(host)·노드 도메인(email)을 명시하기 위해 `EMAIL_` prefix + `HOST_BLOCKED` 를 채택. enum 은 노드 카테고리별 prefix 가 SoT([error-codes.ts](../../codebase/backend/src/nodes/core/error-codes.ts))이므로 `HTTP_BLOCKED` 와 prefix 패턴이 갈리는 것은 의도된 도메인 구분이다.

**chat-channel 분류표 영향 없음**: `EMAIL_HOST_BLOCKED` 는 노드 레벨 `output.error.code`(또는 연결테스트 result.code)로만 surface 된다. send_email 실패가 워크플로 종료로 격상되면 execution 레벨 `error.code` 는 `ERROR_PORT_FALLBACK`(이미 [chat-channel-adapter §3.1](../conventions/chat-channel-adapter.md#31-execution-failed-분류-알고리즘) INTERNAL 군에 존재)이 되므로, [error-handling §1.4](../5-system/3-error-handling.md#14-워크플로우-실행-에러) 의 "enum 확장 시 분류표 검토 의무" 를 검토한 결과 분류표 행 추가는 불필요하다.

### 활동 로그 API 식별 — 3컬럼 (label/method/path) + catalog endpoint 신설

§4.6 Recent activity 탭이 시간·상태·소요·오류만 보여주고 **어떤 API 가 호출됐는지** 표시하지 못하면, cafe24 처럼 한 통합이 수십 endpoint 를 다루는 서비스에서 실패 행만 보고는 원인 API 를 식별할 수 없다. `integration_usage_log` 에 `api_label`/`api_method`/`api_path` 3컬럼을 두고 §4.6 표의 두 번째 컬럼으로 API 를 표시한다.

**왜 1개가 아닌 3컬럼인가**: 채우기 정책이 통합별로 비대칭이라 단일 컬럼으로 동등 표현이 불가능했다.

| 통합 | `api_label` | `api_method` | `api_path` |
|---|---|---|---|
| cafe24 | catalog key (`cafe24.<resource>.<operation>`) | operation 의 HTTP method | operation 의 path template (placeholder 그대로) |
| http-request | NULL | HTTP method | host + path (query string 제거) |
| database-query | NULL | SQL 동사 | driver (`postgres` / `mysql`) |
| send-email | NULL | `SEND` | SMTP host or NULL |

cafe24 만 catalog 라벨을 갖고 나머지 3종은 endpoint-only — 단일 `api` 컬럼으로 합치면 (a) cafe24 의 `(label, endpoint)` 2줄 표시가 깨지고, (b) 향후 method/path 별 인덱스·필터 (예: "최근 7일 5xx 응답만") 확장 여지가 사라진다. denormalize 비용은 통합당 최대 392 byte (128+8+256) 인데 단건 row 평균 200~500 byte 의 `error_message`/`error_code` 와 비교해 무시할 수준.

**왜 catalog endpoint 를 신설했나** — cafe24 라벨의 i18n 책임을 backend 가 아닌 frontend 에 두기 위해서다. backend 가 i18n 결과 (예: `"상품 목록 조회"`) 를 직접 `api_label` 에 적재하면 (a) UI 언어 변경 시 DB 의 옛 한국어 라벨이 영문 UI 에 그대로 노출되는 회귀가 영구화되고, (b) catalog 변경 시 DB 의 옛 라벨이 stale 해진다. 책임 분리는 다음과 같다:

- **DB** (`api_label`) — catalog key (`cafe24.<resource>.<operation>`) 만 저장. 언어 정보 없음.
- **Backend catalog endpoint** (`GET /api/integrations/services/:type/catalog`) — backend 메타데이터에서 `{ key, method, path, labelKey, descriptionKey }` 만 노출. `labelKey`/`descriptionKey` 는 dict lookup 키 (영문 ID).
- **Frontend i18n dict** — `labelKey` → KO/EN 사람 친화 라벨로 매핑. 사용자 언어 설정에 따라 동적 변환.

**왜 초기엔 cafe24 만 응답하나** — 나머지 3종은 활동 로그 `apiLabel` 이 NULL 이라 catalog lookup 자체가 발생하지 않는다 (frontend 의 §4.6 fallback 이 endpoint subtext 한 줄로 처리). 빈 배열을 응답해 endpoint 자체는 호출 가능하게 유지 — 향후 다른 서비스가 catalog 를 가질 때 추가 row 만 채우면 되도록.

**왜 http-request 의 path 에 query string 제거** — (a) 같은 endpoint 의 호출을 그룹화 (예: "최근 `GET api.example.com/v1/users` 50건") 하려면 query string 차이를 무시해야 하고, (b) query 에는 `api_key`/`token` 같은 자격증명이 흘러들어갈 위험이 큰데 활동 로그는 marshalling 안 하고 plain 저장되어 PII/secret 누출 위험이 있다. 두 사유 모두 query 제거 정책으로 해소.

**왜 database-query 의 path 에 driver 만** — SQL 본문은 (a) 길이 가변 (`varchar(256)` 초과 빈번), (b) 파라미터 인라인 시 PII 직접 노출, (c) 파싱 비용·정규화 책임 발생. driver 토큰 (`postgres` / `mysql`) 만 저장하면 §4.6 endpoint subtext 가 "어느 DB 였는지" 정도의 진단 신호로 충분하면서 위 3가지 위험 모두 회피.

**왜 send-email 은 recipient 를 저장 안 함** — 수신자 이메일 자체가 PII. SMTP host 만 path 에 저장해 "어느 메일 서버 였는지" 진단 신호만 노출. 수신자 마스킹된 디테일은 이미 `output.error.details.to` (5필드 envelope) 에서 별도 제공된다.

**§4.6 표 컬럼 정리 (Workflow/Node 컬럼 제거)** — 활동 탭 표는 At/Status/Duration/Error 컬럼만 둔다. `Workflow`/`Node` 정보는 (a) `Execution detail →` 링크에서 항상 도달 가능하고, (b) 활동 탭의 본질은 "어느 API 가 언제 실패했나" 진단이라 워크플로우/노드 식별은 한 단계 우회된 위치가 적합하다. 대신 두 번째 컬럼을 API 식별 정보로 할당해 진단 신호 밀도를 높인다.

### Attention 가상 필터값 — Expired ∪ Expiring ∪ Error 를 단일 칩으로 노출

§2.4 "Need attention" 배너의 클릭 동작이 spec 텍스트("`Expiring | Expired | Error` 로 자동 전환")와 구현 사이에서 어긋나 사용자가 알림에 표시된 항목을 필터 페이지에서 찾지 못하는 사례가 보고됐다. 원인은 (a) UI 의 상태 칩 모델이 단일 선택이라 세 상태를 동시에 전환할 표현이 없었고, (b) 구현이 차선책으로 `?status=expiring` 단일 필터로만 보냈기 때문이다. 본 spec 개정에서 두 가지를 정리한다.

**1. UI: `Attention` 칩 신설.** `Expired ∪ Expiring ∪ Error` 합집합을 단일 값으로 추가해 단일 선택 칩 모델을 유지하면서 합집합을 제공한다. 멀티 선택 칩 도입이나 `?status=expiring&status=expired` 같은 multi-value 쿼리도 검토했으나 (a) URL 공유성 저하, (b) 다른 단일 필터(`scope`, `q`)와의 일관성 깨짐, (c) 분석/감사 시 "사용자가 어떤 카테고리를 봤는지" 의 의도 신호가 흐려짐 으로 기각.

**2. 백엔드: 가상 필터값(virtual filter) 규약.** `Integration.status` DB Enum 은 `connected` / `expired` / `error` / `pending_install` 4개로 유지하고, API 필터의 `status` 파라미터 값 공간은 이를 포함하면서 추가로 `expiring`(이미 도입), `attention` 두 가상값을 갖는다. 가상값은 영속화되는 상태가 아니라 화면 필터링용 술어 — 백엔드 쿼리 빌더가 WHERE 절을 합성한다. 다음 두 원칙을 따른다:

- **이름 분리**: 가상값 이름은 DB Enum 과 겹치지 않는다 (`expiring`, `attention` 모두 DB 에 없음). 사용자가 칩 라벨에서 본 단어가 그대로 URL 파라미터로 들어간다.
- **DB 엔티티 비확장**: 가상값을 위해 Enum 을 늘리지 않는다 — 영속 상태와 화면 술어를 섞으면 state machine(§6) 이 비대해진다.

**3. 배너 톤·점프 동작 보강.** 분해 카운트(만료 X · 만료 임박 Y · 오류 Z) 를 한 줄에 표시해 어떤 카테고리가 몇 건인지 한눈에 보이게 한다. `error ≥ 1` 일 때 dot 색을 amber 에서 red 로 미세 강조 — 사용자가 "어떤 종류가 섞여있는지" 를 카피 읽기 전에 시각적으로 인지하게 한다. 합계 = 1 일 때는 필터링 단계가 잉여이므로 그 한 건의 detail 로 직접 점프 — 사용자가 어차피 그 건을 열어볼 것이므로 단축이 자연스럽다. "1건일 때만" 의 분기는 합계 ≥ 2 일 때 필터링이 필요한 일반 케이스와 명확히 분리된다 (필터링 → detail 의 한 클릭을 줄임).

### 자동 갱신 통합을 attention 술어에서 제외

§2.4·§11.4·§2.3 의 attention/expiring 술어는 `token_expires_at <= NOW() + INTERVAL '7d'` 단일 임계치만 사용했다. 그런데 **Cafe24 OAuth access_token 의 수명은 2시간** 이라 이 술어가 항상 true 가 되어, 자동 갱신이 정상 동작하는 통합도 사이드바 attention 카운트·"Need attention" 배너·`Expiring` 칩에 영구 포함됐다 (상세 페이지 헤더가 항상 "Expires today" 노란 톤으로 표시되어 사용자가 갱신 실패로 오독). 백엔드 자동 갱신(`cafe24-token-refresh` 큐 worker + `cafe24-background-refresh` 일일 잡 + `Cafe24ApiClient.ensureFreshToken` proactive 경로)은 모두 정상 동작 중이라 사용자 액션이 불필요한데도 attention 표시는 거짓 양성이었다.

**결정**: 응답 DTO 에 derived 식별자 `autoRefresh: boolean` (§9.1) 을 추가하고, 모든 attention 술어(§2.4 배너·§11.4 사이드바 카운트·§2.3 `Expiring` 칩·§9.1 `?status=expiring`·`?status=attention` 가상 필터) 에서 `autoRefresh=true` 행을 만료 임박 분기에서 제외한다. 동시에 상세 페이지 헤더(§4.1) 와 Overview 의 Token Expires 행(§4.2) 이 autoRefresh 사실을 보조 라벨/친화 표기로 알리도록 표현 정책을 명문화한다.

**왜 derived 필드인가**: `autoRefresh` 는 DB 컬럼이 아니라 `ServiceDefinition.supportsTokenAutoRefresh` (백엔드 service registry — 현재 `cafe24`/`google` 만 true) 에서 매 응답 시점에 계산된다. service 신설·정책 변경이 잦은 영역이라 영속화하지 않고 코드 한 곳에서 결정되도록 분리했다. 옛 attention 술어 SQL 에 `service_type IN ('cafe24', 'google')` 같은 하드코딩을 두는 안도 검토했으나 — (a) 신규 OAuth provider 추가 시마다 SQL 술어를 손대야 하고, (b) "왜 이 service 가 제외되는가" 의 의도가 SQL 에 묻혀 사라지므로 derived 플래그를 한 단계 거치게 했다.

**자동 갱신 통합의 실패 신호 보전**: 자동 갱신이 실패해 `error(auth_failed)` (invalid_grant) 또는 `error(network)` (transport 3회 연속 실패) 로 전이하면 그 행은 status 가 `error` 라 본 술어와 무관하게 `status IN (expired, error)` 분기로 attention 에 포함된다 — 사용자 신호 회귀 없음 (§10.5 의 전이 정책 + §11.2 `integration_action_required` 알림이 별도로 발사).

**Security 탭 Reauthorize 버튼은 비활성화하지 않음**: §4.2 Quick actions 의 Reauthorize 는 `autoRefresh=true` 통합에서도 hover 안내만 두고 활성 상태를 유지한다. 사용자가 scope 정리·credentials 재발급 등 명시 의도로 재인증을 누를 가치가 있기 때문 — 이는 `pending_install` / `install_timeout` 의 비활성 원칙(외부 흐름 진행 중 / 진입점 부재) 과 다른 사유다. `pending_install 은 필터 칩에 추가하지 않는다` Rationale 의 "사용자 액션 불필요한 정상 운영 상태를 attention 에서 빼는" 원칙과 같은 맥락에서 attention 술어는 제외하되, 사용자의 명시 의도 액션은 막지 않는다.

**과거 결정과의 호환**: `Attention 가상 필터값` 의 "**DB Enum 비확장 — 영속화되는 상태와 화면 필터링용 술어를 분리**" 원칙은 그대로 유지된다. `autoRefresh` 는 영속 상태가 아닌 derived 식별자라 같은 원칙 안에서 새 술어가 합성된다. `pending_install` 제외 도 같은 사상 — 외부 흐름 진행 중 정상 상태를 attention 에서 제외.

### 연결 테스트 endpoint 를 `/store` 에서 `/apps` 로 전환

§5.8 의 "테스트 방법" 은 옛 spec 에서 `GET /api/v2/admin/store` 로 정의되어 있었으나 운영 중 두 가지 false negative 가 보고됐다 — (a) cafe24 통합이 `mall.read_store` scope 를 포함하지 않으면 403 으로 실패해 "토큰은 유효한데 연결 테스트만 실패" 하는 혼란, (b) `/store` 가 store-level 메타데이터라 일부 운영자 권한에서 응답 shape 가 비결정적. 전환 후의 `GET /api/v2/admin/apps` 는 **자기 앱 정보 조회** 이며 모든 cafe24 통합이 자기 앱이므로 scope 부족 위험이 가장 적다 (Cafe24 OAuth 가 발급한 토큰이라면 본질적으로 자기 앱 정보 조회 권한은 항상 있음).

**다른 후보 검토**:
- `/scopes` — 토큰의 현재 scope 만 반환해 가볍지만, 응답 shape 가 단순 배열이라 "JSON 본문 200 OK" 검증의 형식적 의미가 약함.
- `/oauth/token` introspection — Cafe24 가 표준 introspection endpoint 를 제공하지 않음.
- `/products?limit=1` 류 도메인 호출 — scope 부족 위험이 가장 큼.

**transport 실패 카운터 제외**: §14.1 의 `consecutive_network_failures` 카운터는 노드 실행 경로의 자동 호출이 누적해 `error(network)` 로 격하시키는 운영 신호다. 사용자가 직접 누른 연결 테스트는 일회성 진단이라 합산하면 거짓 양성 (사용자 클릭만으로 격하) 위험이 커서 명시 제외. 이 결정은 `Cafe24ApiClient.pingConnection()` 의 "never throws + 메시지만 surface" 계약과 짝을 이룬다.

**401 자가 회복 정책의 통일**: `call()` 경로의 401 자가 회복 (Rationale "`call()` 의 401 자동 회복") 과 동일하게, ping 도 401 시 refresh 1회 재시도. proactive `ensureFreshToken` (§10.5) 이 race condition 으로 빗나간 stale token 을 자가 회복하는 같은 패턴.

### 연결 테스트 endpoint 의 `pending_install` 가드 — 응답 형식

`POST /api/integrations/:id/test` 는 `IntegrationsService.testConnection` 진입부에서 `status='pending_install'` row 를 외부 호출 없이 거부한다. `pending_install` 은 토큰 미발급 상태이므로 외부 API 호출 자체가 의미가 없고, UI 의 버튼 비활성 (§4.2 의 Test connection 비활성 조건) 이 우회된 API 직호출에 대한 backend backstop 이 필요했다.

**응답 형식 — 200 + `{ success:false, code:'INTEGRATION_INCOMPLETE' }` 채택**:

- **인접 가드와의 일관성**: 같은 endpoint 의 다른 가드 두 개가 모두 같은 모양이다 — (a) `INTEGRATION_CREDENTIALS_UNREADABLE` (`testConnection` 도입부의 복호화 실패 분기), (b) cafe24 `pingConnection` 의 `INTEGRATION_INCOMPLETE` (자격증명 필드 누락 분기, `cafe24-api.client.ts` `mapPingError`). 두 분기 모두 200 + `IntegrationTestResult` shape 으로 반환한다.
- **Endpoint 시맨틱**: `:id/test` 는 "검증" 이 아니라 "테스트를 수행하고 결과를 반환" 하는 endpoint. 결과 body 형식이 이미 `{ success, code, message }` 의 success/false 패턴이라 가드 결과도 같은 shape 으로 표현하는 게 자연스럽다.
- **Frontend 영향 0**: 사용자가 "Test Connection" 버튼을 눌렀을 때 결과 카드를 그대로 보여주는 기존 흐름이 새 분기에도 그대로 동작한다 — i18n 메시지·error toast 추가 없음.

**검토된 다른 안과 기각 사유**:
- `422 UnprocessableEntityException` — HTTP 시맨틱은 가장 정확하지만, frontend 가 IntegrationTestResult 카드와 별도 error toast 두 경로를 처리해야 하고, 기존 service 의 다른 throw 들 (rotate/scope/INVALID_CREDENTIALS) 이 모두 `400` 이라 status code 다양성을 도입하는 부담. 응답 형식 일관성을 우선해 200 + success:false 로 채택.
- `400 BadRequestException` — 기존 throw 패턴과는 일관하지만 HTTP 의미상 "input validation" 으로 읽혀 "resource state 거부" 와 mismatch. frontend UX 약화는 422 와 동일.

**service_type 무관 status 가드**: 현재 `pending_install` 은 Cafe24 Private 전용 status 지만, 가드는 service_type 을 보지 않고 status 만 본다 — 향후 다른 provider 가 같은 status 를 도입해도 자동 적용되며, 가드 코드는 단순한 한 줄 if. `Integration.status` enum 자체가 영속 상태의 SoT 라 status 만 보는 게 단일 진실 원칙에도 부합.

**§9.1 표 비고에 명시한 이유**: 별도 `§9.5 "Endpoint 보호 정책"` 절을 신설하는 안도 검토했으나, 본 가드 한 건만으로는 절을 새로 둘 정도의 규모가 아니고, 인접 endpoint 의 비고 (precheck 의 priority status, oauth/begin 의 idempotent 분기 등) 와 같은 표현 패턴이라 §9.1 표 비고 한 줄 + 본 Rationale 한 항이 가장 가벼운 SoT 배치다.

### Cafe24 Private 앱의 callback 실패는 왜 status 를 보존하나

`pending_install` 상태의 Integration 이 callback 처리 중 token exchange 실패 등으로 떨어졌을 때, 자연스러운 선택지는 `error(auth_failed)` 로 전이하는 것이다. 그러나 Private 앱은 `reauthorize` 액션이 불가능하다 — OAuth 재시작은 **Cafe24 Developers 의 "테스트 실행"** 만 정식 진입점이고, 그 진입점은 우리가 발급한 `install_token` 을 path 에 그대로 사용한다. status 를 `error` 로 바꾸면 (a) UI 가 "reauthorize" 액션을 권장하지만 실제로 그 액션이 무력하고, (b) 사용자는 cafe24 측 설정을 고친 뒤 다시 "테스트 실행" 을 누르는 외부 흐름을 진행 중인데 우리 화면이 이를 "error" 로 표기해 흐름 단계를 오인하게 된다. 따라서 callback 실패는 `status_reason` + `last_error` 만 채우고 status 는 `pending_install` 그대로 유지한다.

`status_reason` 의 저장값은 callback 에러 코드를 `snake_case` 로 표기한다 — DB 컬럼 컨벤션 전체가 `auth_failed`, `token_expired` 등 `snake_case` 인 것과 통일. 한편 API 응답·callback HTML 의 에러 코드는 `OAUTH_*`, `CAFE24_*` 같은 `UPPER_SNAKE_CASE` 를 유지한다 (HTTP 컨벤션). 동일 의미 두 표기는 §10.4 에서 매핑.

`last_error.code` 와 `status_reason` 이 같은 값을 중복 보존하는 이유: `last_error` 는 JSONB 라 보존 정책(향후 GDPR 등)에 따라 소거될 수 있다. `status_reason` 은 plain string 컬럼으로 더 가볍게 유지되며, "왜 이 상태에 있는지" 의 핵심 신호로 보존된다. `status_reason` 은 에러 분류 코드만 담아 민감 정보 미포함 → 평문 저장.

### OAuthState.mode='reauthorize' 를 초기 install 에도 재사용한 이유

Cafe24 Private 의 "테스트 실행" 흐름은 `pending_install` 행이 이미 존재하는 상태에서 OAuthState 를 새로 발급해 token 교환을 완료한다 — 의미상 "기존 행에 token 을 채운다" 라는 점에서 `mode='reauthorize'` 와 동일 (`mode='new'` 는 OAuthState 에 integrationId 가 없고 callback 이 previewToken 을 발급하는 다른 흐름). 별도 `mode='cafe24_private_install'` 을 신설하는 안도 검토했으나, callback 의 처리 분기가 동일 (integration row UPDATE) 이고 §10.2 step 4 가 이미 reauthorize 를 "기존 integrationId 의 credentials 갱신" 으로 정의하고 있어 enum 확장으로 얻는 이득이 없다. status 가 `pending_install` 이냐 `connected` 이냐에 따라 callback 의 후처리만 살짝 다를 뿐 (`installToken=null` 처리 등). 단, 향후 reauthorize 와 분리해야 할 동작이 늘어나면 별도 mode 신설 검토.

### CAFE24_PRIVATE_APP_ALREADY_CONNECTED 의 mall_id 비교 경로

**현행 (V045+)**: `mall_id` 가 plain 컬럼 (`integration.mall_id`) 으로 분리되어 — `credentials.mall_id` (encrypted JSONB) 와 동일 값을 plain 컬럼으로 복제 — SQL WHERE 절로 직접 필터링·UNIQUE 제약 강제가 가능. 부분 UNIQUE 인덱스 `(workspace_id, mall_id) WHERE service_type='cafe24' AND mall_id IS NOT NULL` 이 같은 workspace 내 중복 cafe24 통합 생성을 SQL constraint violation 으로 거부 (TOCTOU race 차단). begin 핸들러는 in-memory 사전 체크 (connected → 409 / pending → reuse 분기 판단) 와 함께 SQL UNIQUE 를 backstop 으로 사용 — 두 검사를 모두 통과한 동시 INSERT 는 `23505 unique_violation` 으로 변환되어 같은 409 응답을 받는다.

**옛 (V045 이전)**: `mall_id` 가 암호화 JSONB 안에만 있어 SQL 필터 불가. begin 시점에 (a) 동일 workspace 의 cafe24 통합을 SQL 로 조회한 뒤 (b) ORM 경계의 자동 복호화로 `credentials.mall_id` 와 in-memory 비교. (a) O(N) decrypt 비용 + (b) SELECT 와 INSERT 사이의 TOCTOU 윈도우 두 가지 운영 위험.

**전환기**: V045 이전 행은 `mall_id` 컬럼이 NULL — 부분 UNIQUE 가 그런 행을 비교 대상에서 제외하므로 새 행과 충돌하지 않는다. 옛 행은 callback / re-auth 시점에 plain 컬럼이 backfill 되어 점진적으로 인덱스 범위로 편입된다. begin 시점의 in-memory 비교도 동일 전환기 동안 `credentials.mall_id` fallback 을 둔다.

### install_token 을 App URL path 식별 키로 승격

원래 설계는 `GET /oauth/install/cafe24` 가 mall_id + HMAC 만 받고, 백엔드가 `pending_install` 행을 in-memory 로 100건 스캔하면서 mall_id 일치 candidates 의 client_secret 으로 HMAC 검증을 trial 했다. 두 가지 운영 위험이 누적됐다 — (a) 동일 mall_id 의 중복 `pending_install` 이 누적되면 HMAC 매칭이 비결정적이고 사용자가 보고 있는 행이 아닌 다른 행이 connected 처리될 수 있다, (b) `pending_install` 수가 커지면 O(N) 매칭 비용. App URL path 에 `install_token` 을 박으면 단일 row 조회로 고정되고, 토큰 자체가 random 이므로 추측 불가능한 식별자 역할도 겸한다. 옛 토큰 없는 경로는 별도 PR 로 즉시 제거됐다 (운영 등록자 0 인 시점에 정리 — 이후 등록자는 새 token-pathed URL 만 발급받는다).

(토큰을 16바이트 base64url 22자로 단축 — 보안 동등성은 본 섹션 "Cafe24 App URL 100자 한도 대응" 항 참조)

`install_token` 은 App URL path 에 공개 포함되는 식별자로 평문 저장 — credentials/last_error 암호화 정책 대상 아님.

### CAFE24_INSTALL_INVALID_TOKEN(404) 의 보안 전제

옛 `CAFE24_INSTALL_INVALID_HMAC(403, pending 미발견 포함)` 합산 정책은 토큰이 path 에 없던 시절 "어느 mall_id 에 pending 이 있는지" 정보가 응답 코드로 새지 않게 하는 안전망이었다. `install_token` 은 **128-bit 이상 random** (16바이트 base64url) 이라 추측 불가능 — URL path 자체가 capability token 처럼 동작한다. 이 전제 하에서 "토큰 미존재" 케이스를 `CAFE24_INSTALL_INVALID_TOKEN(404)` 로 분리해도 무의미한 enumeration 이 일어나지 않는다. **이 전제가 깨지면** (예: **96-bit (12바이트) 미만으로의 토큰 길이 단축**, PRNG 변경, install_token 노출 사고) 다시 403 으로 통합해야 한다.

### install endpoint rate limiting — Redis 분산 throttle + 실패 페널티

위 capability-token 가정은 install_token 추측 불가에 기반한 **암호학적 1차 방어**다. A-3 (ai-review W7) 는 그 위에 **운영 layer 의 defense-in-depth** 를 더한다 — 전제가 미래에 약화(토큰 단축·PRNG 변경·노출)되거나 공격자가 leak 된 토큰으로 대량 시도하는 경우의 비용을 높인다. 두 layer 모두 새 데이터 모델 없이 기존 Redis(nonce-cache 와 공유) 위에 얹는다.

- **출발점 (기존 — 그간 Rationale 공백)**: install endpoint 는 도입 시점부터 `@Throttle({ limit: 30, ttl: 60_000 })` 로 미인증 IP별 `30/min` throttle 을 갖고 있었다 (`UserThrottlerGuard` 의 IP fallback). 그러나 `ThrottlerModule` 기본 store 가 **pod별 in-memory** 라, 멀티 인스턴스/재배포 시 quota 가 인스턴스마다 분산돼 enumeration 방어가 약했다. 본 항이 그 출발점과 한계를 spec 에 명문화한다.
- **Layer 1 — 분산 throttle store (deferred — 후속 infra PR)**: 위 30/min 을 Redis store 로 백업해 클러스터 전역에서 quota 를 직렬화하는 개선. `@nestjs/throttler` 의 storage 는 **전역 단일 설정**이라 install 뿐 아니라 모든 throttled 엔드포인트(auth·precheck 등)에 동시 영향을 주고, Redis storage 어댑터(`@nest-lab/throttler-storage-redis`) 도입 또는 커스텀 storage 구현이 필요하다 — blast radius 가 install 범위를 넘으므로 **독립 검증 가능한 별 infra PR 로 분리**한다. degradation 설계(채택 시): Redis 미설정/장애 시 **in-memory store 로 fallback** — pod별로 격하되지만 throttle 자체는 유지(보호 0 이 되지 않음). nonce-cache(skip)와 degradation 방향이 다른 이유: throttle 은 in-memory 등가물이 존재하므로 끄지 않고 격하하는 게 우월하다. 본 PR(A-3)은 enumeration 방어를 cross-pod 로 완수하는 Layer 2 만 구현하고, Layer 1 분산화는 보강으로 후속한다.
- **Layer 2 — 실패 페널티 lockout**: install_token 조회/HMAC 검증 **실패** 요청만 IP별로 카운트(`cafe24:install:fail:{ip}`)해 임계치 초과 시 `429 CAFE24_INSTALL_RATE_LIMITED` 로 거절. **성공 install(302) 은 카운트 제외** — 핵심 비대칭: 정상 사용자는 유효 토큰으로 성공하므로 카운터가 거의 0, enumeration 은 정의상 대량 실패라 빠르게 임계치 도달. 이 "성공 제외" 가 정상 사용자 무영향과 enumeration 정조준을 동시에 달성하는 근거다. Redis 부재 시 **fail-open(skip)** — nonce-cache 와 동일하게 in-memory 등가물이 없는 순수 강화 layer 라, 끄고 ±5분 윈도우 + capability-token 으로 회귀하는 게 정상 install 차단보다 안전(가용성 우선). 이는 Layer 1(in-memory fallback) 과 **의도적으로 다른 degradation 경로** — Redis 없을 때 throttle(범용 보호)은 격하·유지, fail-penalty(보조 강화)는 끔.
- **Layer 3 (deferred)**: 전역 endpoint cap(`cafe24:install:global`) 으로 botnet 분산 enumeration 상한을 두는 layer 는 collateral DoS(한 공격자가 전체 install 마비) 위험이 있어 본 개정 범위 밖. 필요 시 후속.

상수(`INSTALL_FAIL_THRESHOLD=10`, `INSTALL_FAIL_WINDOW_SEC=600`)·키 구성·degradation 의 SoT 는 [Spec Cafe24 §9.8](../4-nodes/4-integration/4-cafe24.md#98-private-앱-app-url-hmac-검증) Rate limiting note 와 "관련 코드 상수" 테이블.

### install_token TTL 24h

**기존 spec §6 는 install timeout 시 `→ (삭제)` 를 명시했으나 본 개정에서 `→ expired (status_reason='install_timeout')` 로 번복한다.** 이유: 데이터 분석·감사 목적으로 보존이 유리하고, 사용자가 만료된 행을 보고 "왜 install 이 안 됐는지" 를 진단할 단서가 남아야 함. 자동 삭제는 더 이상 일어나지 않으며, manual delete 만 삭제 경로다.

Cafe24 Developers 의 앱 등록 → "테스트 실행" 까지의 사용자 작업 텀을 최대 1일로 가정한다. 더 길면 stale `pending_install` 행이 누적되어 §9.2 의 식별 키 룩업 성능과 §2.4 attention 카운트에 잡음. 더 짧으면 정상 흐름이 끊긴다 (사용자가 점심·미팅·휴일 사이클에 작업이 분할되기 쉬움). 24h 가 지나면 `status='expired'`, `status_reason='install_timeout'`, `install_token=NULL` 로 자동 전이. 만료된 행은 데이터 분석·감사 목적으로 삭제하지 않고 보존한다 (manual delete 별도).

**TTL 기준**: `install_token_issued_at` 컬럼 (V044) 을 기준으로 한다 — `created_at` 이 아닌 토큰 발급 시각. 변경 3 (중복 pending_install 재사용) 으로 같은 mall_id 의 begin 재호출이 기존 row 의 install_token 만 갱신할 때, 새 토큰이 발급되자마자 24h 카운트가 끝나 있는 문제를 해소. callback 성공 시 `install_token` 과 `install_token_issued_at` 모두 **보존**된다 — post-install navigation 의 식별 키이며, 24h TTL 스캐너는 `status='pending_install'` row 만 대상으로 하므로 connected 전이 후의 값이 잘못된 만료 처리에 영향을 주지 않는다. NULL 처리는 `pending_install → expired (install_timeout)` 만료 경로에서만 발생한다. 옛 (V044 이전) 행은 `install_token_issued_at` NULL — 스캐너 SQL 이 `COALESCE(install_token_issued_at, created_at)` 로 fallback 해 legacy 의미를 유지.

`status_reason='install_timeout'` 인 expired 행에서는 reauthorize 버튼이 **비활성** 이다 — Private 앱은 재인증 진입점이 없고 cafe24 "테스트 실행" 만 정식이다. 사용자는 행을 삭제 후 새로 등록한다.

### status_reason `oauth_token_exchange_failed` 와 auth 도메인의 `token_exchange_failed` 구분

소셜 로그인 흐름(`spec/2-navigation/10-auth-flow.md`) 의 URL param `error=token_exchange_failed` 와 본 spec 의 통합 callback `status_reason='oauth_token_exchange_failed'` 는 도메인이 다른 별개 신호다 — 전자는 user authentication 도메인, 후자는 integration credentials 도메인. 의도적으로 prefix `oauth_` 를 두어 grep·index 시 도메인 구분이 자명하도록 분리했다. 이름은 통일하지 않는다.

### Cafe24 Private 의 `connected → error(auth_failed)` 복구 경로

일반 OAuth provider 는 `expired → connected` 가 reauthorize 또는 자동 refresh 로 복구된다 (§6 / data-flow §3.1). **Cafe24 Private 앱은 reauthorize 진입점이 없고**, refresh 도 token endpoint 가 mall 별이라 일반 흐름이긴 하지만 만약 refresh 가 실패해 `error(auth_failed)` 로 떨어지면 **복구 유일 경로는 삭제 후 재등록** 이다. 이건 Private 앱의 구조적 제약 (우리 서버가 OAuth 를 시작할 수 없음) 의 당연한 귀결이며, §6 전이 표의 `expired/error → connected (reauthorize)` 항은 Cafe24 Private 에는 적용되지 않음. UI 의 reauthorize 버튼 비활성 (§4.2) 이 이 사실을 반영한다.

### `pending_install` 은 필터 칩에 추가하지 않는다

§2.3 상태 필터 칩은 `Connected / Expiring / Expired / Error` 4종 + All 로 운영된다. `Pending install` 은 사용자가 외부 흐름(Cafe24 Developers) 을 진행 중인 **정상 전환 상태** 로 보고 필터 칩에 추가하지 않는다. 별도 필터링 수요가 발생하면 후속 plan 으로 추가 검토.

### Cafe24 App URL 100자 한도 대응 — `/api/3rd-party/<provider>/` namespace 도입

운영 사용자가 Cafe24 Developers 의 앱 URL 입력 필드에서 "허용 길이 초과" 경고를 받아 Private 앱 연동이 막혔다. 수동 테스트 결과 100자 제한이며, 호스트 변동 가능성까지 감안해 90자를 마지노선으로 잡았다. 현행 `/api/integrations/oauth/install/cafe24/<64-hex>` 은 호스트 32자 가정 135자로 한도 초과.

**두 부분을 모두 단축**:

- **path namespace**: `/api/integrations/oauth/install/cafe24/...` (39자) → `/api/3rd-party/cafe24/install/...` (30자). 옛 namespace 는 "사용자가 호출하는 통합 관리 API" 와 "3rd party 가 호출하는 콜백·설치 API" 가 한 prefix 에 섞여 있던 구조. 3rd-party 의미가 명확한 prefix 로 분리하면 IP allowlist · rate limit · 미래 webhook receiver 같은 per-provider 처리가 sub-tree 단위로 모인다.
- **install_token**: 32바이트 hex (64자) → 16바이트 base64url no-padding (22자). 128-bit 엔트로피는 capability token 으로 충분 (NIST SP 800-63B §A.7 권장 96-bit 이상, OWASP capability token 가이드 128-bit 권장). 옛 256-bit 는 과잉.

**provider-grouped vs action-grouped**: `/api/3rd-party/cafe24/install/:token` (provider-grouped) 대신 `/api/3rd-party/install/cafe24/:token` (action-grouped) 도 검토. 두 안 모두 길이 동일. provider-grouped 채택 이유 — (a) 향후 Cafe24 webhook receiver 등을 추가할 때 `/api/3rd-party/cafe24/webhook` 처럼 같은 sub-tree 에 모임. action-grouped 면 webhook 이 또 다른 top-level segment 가 되어 비일관. (b) 새 provider 가 들어올 때 모듈 단위 (`Cafe24ThirdPartyController` 등) 매핑이 자연스럽다. (c) per-provider 미들웨어 (IP allowlist 등) prefix 가 한 곳.

**google/github callback 도 동시 이동**: cafe24 만 옮기면 callback 경로가 provider 별로 갈라져 비대칭 (`/api/3rd-party/cafe24/callback` vs `/api/integrations/oauth/callback/google`). 일관성 우선 + OAuth 콘솔 재등록을 한 번에 마치는 편이 운영상 깔끔. 운영 영향: Google Cloud Console / GitHub OAuth App / Cafe24 Developers 모두 새 redirect URI 등록 필요 (배포와 동시). 사용자 소셜 로그인용 redirect URI (`/api/auth/oauth/:provider/callback`) 는 **별개로 유지** — 두 URI 가 같은 OAuth 콘솔에 공존한다 (§10.1 참고 노트 참조).

**callback URL 표기 컨벤션**: spec 본문·표·다이어그램은 모두 파라메트릭 단일 형식 `/api/3rd-party/:provider/callback` (`:provider ∈ {cafe24, google, github}`) 만 사용한다. 컨트롤러 구현이 provider 별 분리 (3개) 인지 파라메트릭 (1개) 인지는 구현 세부 사항.

**옛 경로 미보전**: `/api/integrations/oauth/install/cafe24/:installToken` 및 `/api/integrations/oauth/callback/:provider` 핸들러는 즉시 제거. 운영자에게 OAuth 콘솔 갱신이 강제로 가시화되는 편이 누락 없이 안전. 이전 동일 패턴 (토큰 없는 경로 즉시 제거) 의 선례를 따른다.

**기존 `pending_install` 행 마이그레이션 생략**: 옛 64자 hex 토큰을 가진 행은 이미 옛 라우트와 결속되어 있고, 새 라우트는 22자 base64url 만 발급한다. 새 라우트로 호출 자체가 path-format mismatch 로 404 가 되므로 자연 만료 (24h install_timeout 스캐너) 에 맡긴다. 실제 영향 범위는 보고된 사례 자체가 "길이 초과로 등록 못 함" 상태였으므로 거의 0.

### Cafe24 App URL 재호출 흐름 — install_token persistent 격상

Cafe24 Developers Console 에 등록한 App URL 은 **두 가지 진입점** 모두에서 호출된다 — ① 초기 install (테스트 실행), ② **post-install navigation** (카페24 쇼핑몰 관리자의 "앱으로 가기" 버튼). ②번이 새로 발견된 요구사항으로, 옛 spec 의 single-use 가정 (callback 성공 시 `installToken=NULL` 소거) 과 충돌해 운영 사용자가 "앱으로 가기" 클릭 시 `404 CAFE24_INSTALL_INVALID_TOKEN` 을 받았다.

**결정**: `install_token` 을 통합 lifetime 동안 보존되는 persistent identifier 로 격상.

- `pending_install → connected` 전이 시 token 보존 (옛: NULL 처리 → 새: 그대로).
- `handleInstall` 이 status 분기 — `pending_install` → OAuth authorize, `connected`/`error(*)`/`expired` → 우리 frontend redirect.
- HMAC 검증은 두 분기 모두 유지 (Cafe24 출처 보증).
- V045 partial UNIQUE `(install_token) WHERE install_token IS NOT NULL` 은 변경 없음 — 한 워크스페이스 안에서 같은 token 이 한 row 에만 매핑되는 invariant 보존.

**옛 connected 행 호환**: 본 변경 이전에 connected 로 전환되어 token 이 이미 NULL 인 통합은 새 동작이 작동하지 않는다 ("앱으로 가기" 클릭 시 여전히 404). 마이그레이션 plan 없이 자연 해소 — 사용자가 통합을 삭제 후 재등록하면 새 token 이 발급되고 새 동작 적용. 옛 행을 위해 추가 마이그레이션 비용을 들이지 않는 이유는 (a) Cafe24 Private 통합 사용자 수가 적고, (b) 재등록 비용이 SQL 마이그레이션 작성·테스트 비용보다 낮으며, (c) 옛 행의 client_secret 이 credentials 에 그대로 있어 token 재발급 자체는 가능하나 그 시점부터 다시 "테스트 실행" 부터 시작해야 하므로 결국 사용자 작업이 필요해 자동화 가치가 낮다.

**NULL 처리 유지 경로**: `pending_install → expired (install_timeout)` 의 24h TTL 만료는 token 을 NULL 로 소거 유지 — 사용자가 새 통합을 등록해야 하므로 옛 token 무효화가 정당. 통합 삭제 시도 row 삭제로 token 자동 소멸.

**post-install navigation 의 redirect target**: `${FRONTEND_URL}/integrations/<id>` 로 통일. 사용자가 카페24 admin 에서 우리 앱으로 들어올 때 그 통합의 상태·diagnostic 을 바로 확인할 수 있는 화면. 단순 `${FRONTEND_URL}/` 으로의 redirect 도 검토했으나 (워크플로 목록 등) 통합 컨텍스트 보존이 더 유익.

### Cafe24 Private request-scopes 흐름

cafe24 Private 의 OAuth 시작은 우리 서버가 할 수 없어 `mode='reauthorize'` 에서 begin 이 `CAFE24_PRIVATE_APP_USE_TEST_RUN` 으로 거부한다. 옛 `/request-scopes` 는 내부적으로 begin 을 호출하며 mode `request_scopes` 도 같은 거부 분기에 걸려 동작 불가였다 (`CAFE24_INVALID_MALL_ID` 가 noise, 실제로는 Private 흐름이 막혀 있는 본질적 문제). 또한 옛 requestScopes 는 `entity.credentials.mall_id` 를 providerMeta 로 전달하지 않아 begin 의 cafe24 검증부가 missing mall_id 로 reject 도 함께 발생.

**결정**: `requestScopes` 가 cafe24 Private 을 감지하면 begin 우회 — 기존 `installToken` 보존 + `credentials.scopes` merge 갱신 + `{ mode: 'cafe24_private_pending', integrationId, appUrl, callbackUrl, scopesAdded }` 응답. 사용자가 Cafe24 Developers 의 앱 권한에서 추가 scope 활성화 후 "테스트 실행" 누르면 기존 install handler 가 작동 → callback → token 의 scope 가 확장된 새 token 으로 교체된다.

**왜 begin 우회인가**: begin 의 Private 거부는 정당 (OAuth 시작 불가). request-scopes 는 본질적으로 "OAuth 재시작 + 확장 scope" 인데, Private 에서는 Cafe24 측 진입점만 정식이므로 우리 화면은 안내만 담당. credentials.scopes merge 는 install handler 의 `OAuthState.requestedScopes` 채움에 영향을 주므로 사전에 갱신해 둔다.

**`request_scopes` 와 `reauthorize` 의 분리 유지**: 옛 코드는 두 mode 가 거의 동일 처리. 새 흐름에서도 Private 의 reauthorize 는 여전히 거부 (사용자가 reauthorize 의도로 누르면 안내 — Private 앱은 "테스트 실행" 만 정식). request_scopes 만 위 우회 분기로 처리.

**UI 안내 패턴 결정**: 분기 ② 응답(`cafe24_private_pending`) 에 대한 화면 표시는 modal/dialog 가 아닌 **inline alert + info 토스트** 로 정한다. modal 은 닫히면 잊혀지지만 Cafe24 측 작업(권한 활성화 → 테스트 실행)을 진행하는 동안 사용자가 안내를 계속 참조해야 한다 — 따라서 inline 으로 영구 표시. 본 분기에서는 부모 페이지의 refetch 콜백을 호출하지 않는다 — token 갱신은 Cafe24 측 후속 callback handler (`handleInstall` 의 status 분기) 가 담당하므로 즉시 refetch 해도 변화 없음. **횡단화**: 본 결정이 후속 화면(Public 폼의 별도 승인 경고, 향후 webhook signing key 회전 등) 에서 반복 등장하면서, alert ↔ toast 역할 분리·생존 주기·톤 매핑 같은 공통 규칙은 [`spec/0-overview.md §3.4 Inline Alert`](../0-overview.md#34-상태-표시-패턴) 로 일원화했다. 본 절은 분기 ② 의 콘텐츠(문구·`scopesAdded` 칩·refetch 미실행) 만 다루고, 패턴 자체는 §3.4 가 SoT. UI 매핑 표는 §4.4.

### Cafe24 install_token mismatch 회복 흐름

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

### Cafe24 Public app 가용성 — env 기반 노출

Cafe24 Public app 흐름은 우리 서버의 `CAFE24_CLIENT_ID` / `CAFE24_CLIENT_SECRET` env 가 등록된 경우에만 동작 (앱스토어 등록 앱의 OAuth client credentials). env 가 미설정이면 Public 옵션을 선택해도 begin 이 `OAUTH_CONFIG_MISSING` 으로 거부 — 사용자 입장에서 dead-end UX.

**결정**: `/api/integrations/services` 응답의 cafe24 항목에 `meta.publicAppAvailable: boolean` 노출. `CAFE24_CLIENT_ID && CAFE24_CLIENT_SECRET` 둘 다 set 이면 true. Frontend 의 신규 통합 폼이 false 일 때 Public 옵션 토글에서 제거 + 기본값 `private` 강제 + 안내 문구 갱신.

**Private 는 항상 노출**: env 와 무관. 사용자가 직접 client_id/secret 입력하므로 deployment 의 env 상태에 의존하지 않음. Public 만 env 게이트 (사용자 명시 결정).

**왜 server-side 게이트인가**: 클라이언트가 env 를 알 길이 없으므로 server 가 single source of truth. `meta` 객체에 담아 향후 다른 가용성 hints (예: GitHub Enterprise URL 설정 여부 등) 도 같은 통로로 노출 가능.

### BullMQ `cafe24-token-refresh` 큐 — 멀티 인스턴스 race 해소

[`spec/4-nodes/4-integration/4-cafe24.md` §9.6](../4-nodes/4-integration/4-cafe24.md#96-rate-limit-의-범위-한정) 가 "Redis 기반 분산 mutex 도입은 별도 spec 으로" 라는 미결로 남겼던 cross-pod refresh race 가 BullMQ 큐 도입으로 해소됐다. 새 큐 `cafe24-token-refresh` 가 `proactive` / `background` source 의 cafe24 refresh 호출을 `jobId = integrationId` dedup 으로 클러스터 전체에서 직렬화한다 (`reactive_401` source 는 unique jobId + PostgreSQL row lock 폴백을 사용하므로 본 항의 dedup 보장 대상이 아니다 — [Rationale "reactive_401 jobId unique 화 — dedup 완전 우회"](#reactive_401-jobid-unique-화--dedup-완전-우회) 참고).

**문제 정의 (옛 미결)**: 두 backend pod 이 같은 통합에 대해 동시에 refresh 를 시도하면 둘 다 Cafe24 `/oauth/token` 에 같은 old refresh_token 으로 요청을 보내 last-write-wins 로 한쪽 토큰이 orphan 되거나, Cafe24 의 rotation 정책에 따라 한쪽이 `invalid_grant` 401 을 받고 잘못 `error(auth_failed)` 격하될 수 있었다.

**채택 — BullMQ `jobId` dedup**:
- `proactive`/`background` source 의 동시 enqueue 가 `Queue.add({ jobId: integrationId })` 의 dedup 로 단일 worker 실행으로 모임. 모든 호출자가 `waitUntilFinished` 로 동일 worker 결과 공유. (`reactive_401` 은 이 invariant 의 대상이 아니며 unique jobId + DB lock 폴백을 사용 — [Rationale "reactive_401 jobId unique 화"](#reactive_401-jobid-unique-화--dedup-완전-우회) 참고)
- Worker (`Cafe24TokenRefreshProcessor`) 는 DB 재로드 + 재확인 short-circuit 후 `refreshAccessToken` 호출 → atomic 4-field UPDATE.
- proactive (API 호출 직전) + background (일일 스캐너) 양쪽 진입점이 동일 큐를 사용.

**검토 후 배제한 대안**:
- **PostgreSQL advisory lock** (`pg_advisory_xact_lock(hashtext(integrationId))`): 코드 단순하지만 lock 보유 중 HTTP 요청(Cafe24 endpoint)을 transaction 안에 묶어야 해 DB 커넥션 점유 시간이 늘고, BullMQ 가 이미 스택에 있어 별도 메커니즘 추가의 운영 부담이 더 큼.
- **Redis redlock**: 인프라 의존성 추가, BullMQ 와 Redis 를 공유하긴 하지만 별도 lock 메커니즘 운영.
- **In-memory mutex (`withIntegrationLock`) 유지만**: 옛 single-pod 한계 그대로. 멀티 pod 배포 시 race 미해소.

**경계**:
- 본 큐는 **refresh 호출의 cross-pod 직렬화**만 담당. API 호출 자체 (Cafe24 leaky bucket 관리) 는 여전히 `Cafe24ApiClient` in-memory mutex 가 같은 pod 내에서만 직렬화 — Cafe24 leaky bucket 이 per-mall quota 라 cross-pod 직렬화 불필요 (per-pod backoff 신호로 충분). 자세한 분리는 §9.6 참고.
- 큐 미바인딩 환경 (unit test) 에서는 fallback 으로 in-process `refreshAccessToken` 직접 호출. production wiring 은 항상 큐 경유.

### `cafe24-background-refresh` 7일 임계 + 6h cron

Cafe24 의 `refresh_token` 은 14일 유효이며, Cafe24 가 매 refresh 마다 새 refresh_token 을 발급 (rotation). 활성 통합 (주 1회 이상 사용) 은 매 사용 시점에 proactive refresh 가 일어나 사실상 영구 유효하다. 그러나 14일 이상 idle 인 통합은 refresh_token 까지 만료되어 사용자가 재인증해야 한다.

**결정**: `cafe24-background-refresh` 잡이 6시간 주기 (`'0 */6 * * *' UTC`) 로 `lastRotatedAt < now - 7d OR IS NULL` 인 connected cafe24 통합을 자동 refresh.

**임계 7일 + cron 6h 근거**:
- 7일 cutoff = refresh_token 14일 유효기간의 **50% 마진**. cron 6h 주기로 한 번 누락 (6h) 이 마진에 거의 영향을 주지 않음.
- 옛 정책 (10일 cutoff + 24h cron) 은 마진 3일. cron 한 번 누락 시 마진이 즉시 2일로 압박되어 BullMQ 인프라 장애 (Redis AUTH 누락 등) 가 24h 누적되면 잠재적 위험.
- 더 짧게 (예: 1h cron) 잡으면 쿼리 비용 (idle 통합 풀스캔) 누적 + cutoff 자체가 throttle 역할이라 과도.
- 더 길게 (예: 14일 cutoff) 잡으면 cron 한 번 누락만으로도 refresh_token 만기.

**scheduler ID 보존**:
- BullMQ scheduler ID `cafe24-background-refresh-daily` 는 historical 보존. BullMQ `upsertJobScheduler` 가 같은 ID 의 기존 entry 를 idempotent 갱신만 하므로 ID 변경 시 옛 Redis entry 가 orphan 으로 잔존해 daily/6h 가 동시 fire 되는 회귀 위험. 이름은 historical, 실제 주기는 6h.

**신규 통합 NULL 처리**:
- `integrations.service.create()` 가 cafe24 신규 통합 row 생성 시 `lastRotatedAt = new Date()` 로 명시 초기화.
- 옛 row 또는 다른 진입점에서 NULL 로 저장된 경우를 대비해 쿼리 조건이 `Or(LessThan(cutoff), IsNull())` belt-and-suspenders.

**경계**: 본 잡은 enqueuer 역할이며 실제 refresh 는 `cafe24-token-refresh` 큐의 worker 가 수행 (역할 분리). proactive call 과 같은 jobId dedup 으로 충돌 없이 협력. 다른 3개 스케줄러 (`connected-expiry` / `pending-install-ttl` / `usage-log-prune`) 는 daily 00:00 UTC 유지 — 작업 성격 (알림 / 24h TTL / 90d retention) 이 일일 cadence 와 일치.

### Cafe24 install_token mismatch 회복 흐름 — 보안 전제

`tryRecoverByMallId` (Rationale "Cafe24 install_token mismatch 회복 흐름" 의 회복 분기) 가 production 코드에 존재한다. 이는 옛 spec §9.8 의 "100건 스캔 + trial HMAC 폐기" 와 **표현상 충돌**하나 본질적으로 다른 경로다.

**구분**:
- 옛 폐기 흐름: install_token 자체가 없던 시절의 **모든 호출에 적용**되는 식별 전략. mall_id 만으로 매칭하고 HMAC trial 로 row 를 골랐다.
- 새 회복 흐름: **단일 row 조회 실패 시에만** fall-back 으로 작동. 정상 흐름은 install_token 단일 row 조회 그대로.

**보안 전제 — HMAC 검증 유지**: 회복 분기에서도 mall_id 매칭 후보 row 들의 client_secret 으로 HMAC 검증을 1회씩 수행. HMAC 통과는 client_secret 보유의 증명이므로 권한 escalation 없음. install_token capability-token 가정 ("CAFE24_INSTALL_INVALID_TOKEN(404) 의 보안 전제" 항) 은 본 회복 흐름이 깨뜨리지 않는다 — 옛 install_token 이 leak 되어도 HMAC 위조 없이는 회복 분기를 통과 못 함.

**DoS 보호**: 코드 상수 `RECOVERY_CANDIDATE_LIMIT = 5`. 후보 overflow 시 회복 포기 (404) — workspace 횡단으로 같은 mall_id 가 5개 이상이면 HMAC trial 자체를 거부해 amplification 차단. 정상 운영에서 같은 mall_id 의 cafe24 row 는 보통 1~2개라 영향 없음.

**로그 정책**: 회복 시도·결과 로그에서 cross-tenant Integration UUID 와 install_token prefix 를 제거. mall_id + status 만 로깅해 enumeration 단서를 줄임.

### refresh 실패 시 status_reason 통일

spec §6 가 옛 표기 `connected → expired | refresh fail` 로 명시했으나, 구현은 refresh 실패 시 `error(auth_failed)` 로 전이했었다. UI 분기·재인증 안내 문구·`Notification.type` 발사 정책 (§11.2) 에 일관성 결손.

**결정**: `error(auth_failed)` 채택. 옛 `expired (refresh_failed)` 분기 폐기. `expired` status 는 두 경로로 한정 — (1) refresh_token 없는 일반 OAuth provider (예: GitHub) 의 `token_expires_at` 만료 (`status_reason='token_expired'`), (2) Cafe24 Private 의 `pending_install → expired (install_timeout)`. 즉 본 변경은 cafe24 등 refresh_token 보유 provider 의 refresh 실패 경로에만 영향을 주고, `token_expires_at` 만료 자체 (§11.1 `connected-expiry` 스캐너) 는 그대로 유지된다.

**이유**:
- (a) UI 가 reauthorize 액션을 권장하기에 더 자연스러움. `expired` 는 "자동 재발급 시도 후 만료" 의미가 강해, terminal refresh_token 만료 (사용자 재인증 필요) 와 의미가 어긋남.
- (b) refresh_token 자체 만료 (terminal — Cafe24 가 14일 후 invalidate) 와 access_token 만료 (자동 회복 가능 — refresh 가능) 를 의미적으로 구분 보존. `error(auth_failed)` 는 전자 (사용자 액션 필요), `expired` 는 일반 OAuth provider 의 후자 신호로 분리.
- (c) transport 3회 → `error(network)` 와 같은 `error(*)` 도메인에서 일관 분류.

**데이터 모델 변경 없음** — `Integration.status_reason` 컬럼 값 정의만 갱신 (`spec/1-data-model.md §2.10` 참고): `expired` 의 사유에서 `refresh_failed` 제거, `error` 의 사유에 `auth_failed` / `insufficient_scope` / `network` 보존. `token_expired` 는 일반 OAuth provider 의 `expired` 경로 (refresh_token 없는 provider) 용으로 유지.

**알림 정책 (§11.2)**: `integration_expired` 알림은 `expired` 전이 중에서도 `token_expired` 경로에만 발사. `install_timeout` 도 `expired` 전이지만 별도 결정으로 미발사 — 아래 ["install_timeout 알림 미발사"](#install_timeout-알림-미발사) 항 참조. `error(*)` 전이는 별도 알림 없이 UI 배지로만 통지. 향후 별도 알림 타입 필요 시 `integration_action_required` 등 신설 검토.

### install_timeout 알림 미발사

`expirePendingInstalls()` (`codebase/backend/src/modules/integrations/integration-expiry-scanner.service.ts`) 는 bulk UPDATE 만 수행하고 `notificationsService.createMany` 호출이 없다.

**결정**: `pending_install → expired (install_timeout)` 전이는 `integration_expired` 알림 **미발사**.

**이유**:
- (a) **사용자 인지** — `pending_install` 상태는 사용자가 외부 흐름 (Cafe24 Developers 의 "테스트 실행") 을 직접 진행 중인 명시적 상태. 24h 안에 install 을 완료하지 못했다는 건 본인이 시작점·진행 상황을 알고 있을 가능성이 큼.
- (b) **UI 통지 충분** — 통합 상세 페이지의 status 배지 + 목록 페이지의 "Need attention" 배너로 통지. 별도 알림은 over-noise.
- (c) **일관성** — `pending_install` 의 다른 callback 실패 분기 (`oauth_token_exchange_failed`, `oauth_state_mismatch`, `oauth_state_expired`) 도 알림 미발사. install_timeout 만 발사하면 일관성 결손.
- (d) **"조용한 전이" 원칙의 연장선** — `install_token=NULL` 소거 (Rationale "install_token TTL 24h") 와 같은 결정 흐름. 외부 흐름 미완료가 자명한 상태 변화는 외부에서 들어오는 새 시도가 아닌 한 알림 가치 낮음.

**범위**: 본 결정은 `Notification.type='integration_expired'` 미발사만 다룬다. UI 배지·다음 install 시도 시 `install_token=NULL` 로 인한 404 등 다른 동작은 영향 없음.

### Cafe24 App URL 상세 페이지 표시

Cafe24 admin "앱으로 가기" / Cafe24 Developers "테스트 실행" 의 HMAC 검증 실패 에러 페이지(`renderInstallErrorHtml`) 는 사용자에게 "통합 상세 페이지에 표시된 URL 과 일치하는지 확인하세요" 라고 안내한다. 그러나 옛 상세 페이지에는 App URL 이 표시되지 않아 안내가 실효성을 잃었다 (App URL 호출이 `CAFE24_INSTALL_INVALID_HMAC` 으로 거부됐을 때 비교 기준이 없었다).

**해결안**: 상세 페이지 Overview 탭에 `Cafe24AppUrlCard` 를 추가해 App URL/Redirect URI 를 복사 버튼과 함께 노출 (§4.2 표 참조). 백엔드는 `IntegrationDto.appUrl: string | null` 필드를 Cafe24 Private 한정으로 계산해 응답에 포함하며, `install_token` 자체는 별도 필드로 노출하지 않는다 — App URL path segment 안에 이미 포함되며 별도 필드 노출은 (a) 중복, (b) 식별자가 두 곳에 분산되어 클라이언트가 어느 값으로 비교해야 할지 혼동, (c) 향후 path 형식 변경 시 양쪽 필드 동기화 부담, 세 가지 이유로 회피.

**새 등록 흐름과의 일관성**: `codebase/frontend/src/app/(main)/integrations/new/page.tsx` 의 `Cafe24PrivatePending` 컴포넌트와 동일한 복사 UX 패턴(라벨 + 모노스페이스 URL + 복사 버튼 + 1줄 안내) 을 재사용해 사용자 혼동을 줄인다.

**HMAC 검증 진단 로그 보강**: 본 변경과 함께 `handleInstall` 의 HMAC 실패 3 분기 (mall_id 불일치 / client_secret 부재 / HMAC 자체 불일치) 가 동일 `CAFE24_INSTALL_INVALID_HMAC` 응답을 반환하는 옛 동작은 유지하되 (응답 코드 단일화 정책 유지 — capability-token 가정 보호), `logger.warn` 로 어느 분기인지·URL mall_id 와 DB mall_id 의 일치 여부·DB app_type/status/status_reason·install_token prefix+suffix 4자를 기록한다. `client_secret` 자체는 절대 로그에 남기지 않는다 — `SECRET_LEAK_PATTERNS` 정책과 일관.

### HMAC 검증 알고리즘 — raw URL-encoded 값 보존

옛 구현이 HMAC 검증을 "Java `URLEncoder.encode(value, "UTF-8")` 호환 (공백 `+`)" 으로 처리했으나, 운영 환경에서 **신규 통합 직후 즉시 HMAC 실패** 가 재현됐다 (진단 로그가 `reason=hmac_verify_failed` 를 정확히 식별). mall_id / app_type / install_token / client_secret 모두 매칭하는데 HMAC 자체만 불일치 — 알고리즘 자체의 결함.

**근본 원인**: Cafe24 의 공식 `validationCheckHmac` Java 샘플은 `request.getQueryString()` 을 `&` 로 split → `=` 로 한 번만 split → TreeMap 에 **raw value 그대로** 저장한 뒤 concat 한다. 즉 **URL value 를 decode 하지 않으며 re-encode 도 하지 않는다**. 우리 SEC H-1 fix 는 "Cafe24 가 URLEncoder 를 호출한다" 라고 가정했지만, 실제로는 URL 의 raw byte sequence 를 그대로 HMAC 메시지에 넣는다.

**증거**: 사용자 보고 URL 의 `user_name=%EB%8C%80%ED%91%9C%20%EA%B4%80%EB%A6%AC%EC%9E%90` — Cafe24 가 공백을 `%20` 으로 보낸다. 만약 Cafe24 가 HMAC 계산에 URLEncoder 를 호출한다면 메시지 안의 값은 `%EB%8C%80%ED%91%9C+%EA%B4%80%EB%A6%AC%EC%9E%90` 가 되어야 하고, 그 결과 Cafe24 자신의 HMAC 도 자기네 URL 과 매칭이 안 되어 검증이 동작하지 않을 것이다. 따라서 Cafe24 는 raw 값을 사용한다 (이론적 추론 + 운영 재현 동시 확인).

**해결**: `buildHmacMessage` 가 `URLSearchParams` 로 decode 하지 않고 `rawQuery.split('&')` 로 직접 파싱해 key/value 의 raw byte string 을 그대로 보존한다. sort 는 key 만 알파벳 순. value 인코딩은 Cafe24 가 어떤 인코더로 URL 을 만들었든 무관 — byte 단위로 일치하기만 하면 된다.

```typescript
function buildHmacMessage(rawQuery: string): string {
  return rawQuery
    .split('&')
    .map((part) => {
      const eqIdx = part.indexOf('=');
      const key = eqIdx === -1 ? part : part.slice(0, eqIdx);
      return { key, raw: part };
    })
    .filter((p) => p.key.length > 0 && p.key !== 'hmac')
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map((p) => p.raw)
    .join('&');
}
```

raw 보존 대신 다양한 인코더(`encodeURIComponent` / `URLEncoder` 호환 / browser fetch encoding 등)를 시도하는 방식은, 후보 인코더가 매번 차이가 있어 (`%20` vs `+`, `*` vs `%2A`, `!` vs `%21` 등) 어느 하나로 매칭이 보장되지 않는다. Cafe24 자체도 향후 인코더를 바꿀 수 있다. raw byte 보존은 인코더 invariant 다.

**보안 영향 없음**: HMAC 자체의 cryptographic strength 는 변하지 않는다. capability-token 보호 ([Rationale "CAFE24_INSTALL_INVALID_TOKEN(404) 의 보안 전제"](#cafe24_install_invalid_token404-의-보안-전제)) 도 그대로. SEC H-2 (workspace 횡단 enumeration 방지) 도 그대로.

**테스트 보강**: 사용자 실제 URL (`user_name=...%20...` + 실제 timestamp 패턴) 의 회귀 보호 테스트 추가. 옛 `accepts HMAC for queries containing space-encoded values` 테스트는 `John+Doe` 형식을 사용했으나 — 그건 우리 옛 알고리즘의 self-fulfilling 검증 (compute 와 verify 가 같은 broken 알고리즘 사용) 이라 실제 Cafe24 동작 검증이 안 됐다. 새 테스트는 **Cafe24 가 보내는 형식 (`%20`) 그대로** raw query 를 만들어 검증한다.

### Cafe24 Public 흐름의 begin-time 사전 가드 추가

Public 흐름은 begin 단계에서 Integration row 를 만들지 않으므로 V045 partial UNIQUE 가 발사되는 시점이 `POST /api/integrations` finalize 단계로 미뤄진다. 사용자가 Cafe24 동의 페이지까지 마친 뒤에야 충돌이 드러나고, `IntegrationsService.throwIfUniqueViolation` 의 옛 분기는 `integration_workspace_name_unique` 만 처리해 `idx_integration_cafe24_workspace_mall` 위반은 raw `QueryFailedError` → 500 으로 빠지던 UX 결함이 있었다.

조치:

- **begin 단계 사전 가드** — Public 분기에도 Private 와 동일한 `(workspaceId, mall_id)` connected row 사전 SELECT 추가. `IntegrationOAuthService.findConnectedCafe24MallIntegration` 헬퍼로 두 흐름 공유.
- **race backstop 확장** — `throwIfUniqueViolation` 에 `idx_integration_cafe24_workspace_mall` 분기 추가. begin pre-check 통과 후 동시 INSERT race / finalize 시점 충돌도 동일 409 코드로 변환.

**다른 status (`pending_install`/`expired`/`error`) 가 begin 단계에서 차단되지 않는 이유**:

- `pending_install` 은 Private 흐름의 idempotent begin 정책 (같은 row 를 reuse 해 install_token 보존) 과 호환되어야 한다 ([CAFE24_PRIVATE_APP_ALREADY_CONNECTED 의 mall_id 비교 경로](#cafe24_private_app_already_connected-의-mall_id-비교-경로) 항 참조). Public 흐름은 begin 단계에서 row 를 만들지 않으므로 pending_install 이 있더라도 begin 자체는 무영향 — V045 가 finalize 단계에서 차단.
- `expired`/`error` 는 사용자의 재연동 의도를 반영해 begin 진입 자체는 허용하되, 한 workspace 안에서 같은 mall_id 의 cafe24 통합이 최대 1행이라는 invariant 는 V045 partial UNIQUE 가 finalize 단계에서 보장 (사용자는 기존 행을 먼저 삭제해야 새 통합 등록 가능).
- 결과적으로 모든 비-connected status 의 race / 충돌은 finalize 의 V045 backstop 이 동일 409 코드로 변환 → 클라이언트는 단일 분기.

### CAFE24_PRIVATE_APP_ALREADY_CONNECTED 코드명 유지 결정

본 코드를 Public 흐름에도 재사용하면서 `→ CAFE24_MALL_ALREADY_CONNECTED` rename 안이 제기됐으나 **기각**. 사유:

- **(a) 클라이언트 호환성** — 기존 클라이언트(프론트엔드, integration 사용자)는 코드의 *의미* (mall_id 기준 중복) 로 분기 처리하므로 이름 변경으로 얻는 가독성 이득은 없다. rename 시 deprecated 처리·alias 추가 등 호환성 부담만 발생.
- **(b) swagger 규약 정합** — `spec/conventions/swagger.md §2-4` 의 중복/충돌 409 정책과 `INTEGRATION_IN_USE(409)` 선례에 부합. 이름 토큰의 정확성보다 상태 코드·의미의 정확성이 우선.
- **(c) 의미 기반 명명 선례 예외** — 에러 코드 명명 규율(의미 기반 명명·rename 안정성·예외 레지스트리)의 정식 SoT 는 [`spec/conventions/error-codes.md`](../conventions/error-codes.md) (F-3 으로 격상). 본 (c) 는 그 §3 historical-artifact 레지스트리의 **도메인 근거** 다: `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 의 `PRIVATE` 토큰은 historical artifact (신설 당시 Private 흐름 한정이었으나 이후 app_type 무관으로 확장)이며, 클라이언트는 이름이 아닌 의미(mall_id 기준 중복)로 분기한다. 신규 코드는 이 예외를 선례로 삼지 않고 처음부터 의미 정확한 이름을 부여한다 (규율 본문은 [`error-codes.md §1·§3`](../conventions/error-codes.md)).

장기적으로 본 코드가 다른 mall_id 충돌 케이스 (예: cross-workspace 정책 변경) 와 분리해야 할 필요가 생기면 별도 코드 신설을 고려하되, 그 시점까지는 본 코드의 정의를 spec 으로 명확화해 유지한다.

### precheck endpoint — mall_id 입력 단계 사전 감지 UX

사용자가 mall_id 를 다 입력하기 전(타이핑 중)에 conflict 를 감지해 inline 경고 배너로 보여주는 read-only endpoint (`GET /api/integrations/cafe24/precheck`). begin 의 pre-check 와 동일한 SELECT 를 노출하되, 다음 설계 결정을 반영한다.

- **응답 shape 최소화** — `{ conflict, existingIntegrationId?, existingName?, status? }` 만 반환. 자격 증명·토큰·timestamps·workspace 메타 비포함.
- **노출 범위 격리** — 인증된 사용자의 current workspace (X-Workspace-Id 헤더 기준) 소속 cafe24 row 만 반환. cross-workspace enumeration 경로 아님. Organization-scope 도입 후에도 current workspace 의 정의가 변경되면 본 endpoint 가 자동 추종 (별도 RBAC 처리 불필요).
- **priority status 단일 반환** — `connected > pending_install > error > expired` 순서로 가장 제한적인 status 만 반환 (전체 row 목록이 아닌 단일 status). frontend i18n 메시지 분기 4종이 priority 순으로 일치.
- **enum 범위 밖 status 처리** — 미래에 추가될 수 있는 transitional status (예: `initializing`) 가 들어오면 `status` 필드를 omit. 강제 캐스팅으로 frontend 가 unknown enum 을 silent fallthrough 하는 위험 차단.
- **throttle** — 분당 60회. **이 endpoint 전용 상한** (일반 API rate limit 위에 더해지지 않고 본 값으로 대체 — `@Throttle` decorator). 사용자 입력 350ms debounce 기준 정상 호출 1~2회/입력으로 충분한 여유. mall_id 패턴 정규식 매칭이 frontend 에서 사전 1차 차단되므로 backend 호출 자체가 압축됨. brute-force enumeration 의 비용은 회당 1 SQL 조회 + JWT 검증으로 낮으나 throttle 이 backstop.

**O(N) 폐기와의 관계** — [install_token 을 App URL path 식별 키로 승격](#install_token-을-app-url-path-식별-키로-승격) 항에서 폐기된 "전방위 O(N) mall_id 스캔 + HMAC trial" 패턴과 본 endpoint 는 다르다. precheck 는 V045 plain mall_id 컬럼의 단일 인덱스 lookup (`(workspace_id, mall_id) WHERE service_type='cafe24'`) 으로 O(1) row 만 가져온다. legacy `mall_id IS NULL` fallback 만 backfill 완료 전 임시로 추가 쿼리 발행 — 향후 backfill 종료 시 제거된다 (구현 코드 주석 `findAllCafe24RowsForMall` 참조).

라우트 선언 순서 주의 — `@Get('cafe24/precheck')` 는 동적 경로 `@Get(':id')` 보다 **앞에** 선언되어야 NestJS 가 `cafe24` 를 `:id` 로 소비해 `ParseUUIDPipe` 위반 400 을 일으키지 않는다. controller 코드 주석에 회귀 안전망으로 명시.

### Cafe24 별도 승인 scope 의 식별·안내

**문제**: Cafe24 Admin API 중 mileage/notification/privacy 의 모든 scope 와 store 안 일부 operation (activitylogs, menus, naverpay/kakaopay/PG settings 등) 은 카페24 본사가 별도 승인한 클라이언트만 사용 가능하다. spec 에 이를 표현하는 차원이 없어 사용자가 위저드에서 일반 카테고리처럼 체크 → OAuth `invalid_scope` 거부 또는 호출 시 `INSUFFICIENT_SCOPE (403)` 으로 좌초. 원인 안내 장치 부재.

**채택**: backend 메타데이터의 `Cafe24OperationMetadata.restrictedApproval` 필드와 catalog 의 `restricted` 컬럼을 SoT 로 두고, UI 4 화면 (위저드 §3.2 / 통합 상세 §4.4 / Cafe24 노드 Operation 드롭다운 / AI Agent allowlist) 이 같은 필드를 읽어 ⚠ 배지·tooltip·경고 배너를 자동 렌더. 명단 자체의 진위 SoT 는 신규 컨벤션 [`spec/conventions/cafe24-restricted-scopes.md`](../conventions/cafe24-restricted-scopes.md). 에러 안내는 §10.4 의 `oauth_invalid_scope` 행과 §9.4 의 `INSUFFICIENT_SCOPE` 의 `details.requiresCafe24Approval` 보강 필드 2 경로로 분리 (OAuth 단계 vs 호출 단계).

차단 없이 안내만 하는 정책을 택했다 — 체크 시점에 진행을 막으면 이미 본사 승인을 받은 합법 사용자 케이스까지 막히므로, 차단 대신 amber 경고 배너로 인지를 강제한다. 신규 에러 코드(`CAFE24_APPROVAL_REQUIRED` 등) 추가 없이 `details.requiresCafe24Approval` 보강 필드 + `status_reason='oauth_invalid_scope'` enum 확장만으로 표현해 기존 `INSUFFICIENT_SCOPE (403)` / OAuth `invalid_scope` 처리 경로의 client 호환성을 유지한다. catalog 의 별도 컬럼 `restricted` 로 표현하며 `status` enum (`supported`/`planned`/`deprecated`) 은 직교 차원이라 확장하지 않는다.

**Trade-off / 미해결**:

- mileage resource 안의 `credits_*` (예치금) 가 정확히 `mall.read_mileage` 를 쓰는지 vs 별도 scope 인지의 공식 분리 확인은 사용자 자료 범위 밖. scope 단위 라벨링 (`level='scope'`) 을 mileage resource 전체에 적용. 향후 공식 문서로 분리 확인되면 정정 ([`cafe24-restricted-scopes.md §5`](../conventions/cafe24-restricted-scopes.md#5-명단-갱신-절차)).
- `paymentmethods_list` / `paymentmethods_paymentproviders_list` / `paymentmethods_paymentproviders_update_display` 는 별도 승인 여부 미확인 — 빈칸 유지.

### Cafe24 token 응답의 `expires_at` 처리

> **superseded** 본 항의 정책은 "[Cafe24 token 만료 SoT — JWT exp 격상](#cafe24-token-만료-sot--jwt-exp-격상)" 으로 흡수·격상됨.

**문제**: 사용자 보고 — 카페24 통합이 "정상(connected)" 으로 표시되는 상태에서 AI Agent MCP 호출이 `Cafe24 authentication failed (401) for mall <mall_id> — access_token time expired. (invalid_token)` 으로 401 을 받음. proactive refresh 가 동작해야 하는 시점에 동작하지 않음. 일일 백그라운드 잡도 안 살림.

**원인**: backend 의 OAuth callback `normalizeTokenResponse` 가 OAuth 표준 `expires_in` (초) 만 읽었는데, Cafe24 의 `/api/v2/oauth/token` 응답은 `expires_in` 을 돌려주지 않고 `expires_at` (ISO8601 문자열) 만 돌려준다. 결과적으로 신규 cafe24 통합의 `Integration.token_expires_at` 컬럼과 `credentials.expires_at` JSONB mirror 가 모두 NULL 로 저장됐다. 그 row 들에 대해:

- `Cafe24ApiClient.ensureFreshToken` 가 `expiresAtMs === null` 일 때 silently return → proactive refresh 영영 미발사.
- `connected-expiry` 일일 잡은 `token_expires_at IS NOT NULL` 만 후보로 보아 invisible.
- `cafe24-background-refresh` 는 `last_rotated_at < now - 10d OR IS NULL` 기준이라 신규 (=lastRotatedAt recent) 행을 안 잡음.

결과적으로 install 후 2h 경과 (Cafe24 의 실 access_token TTL) 부터 모든 API 호출이 401 로 좌초. 사용자가 직접 reauthorize 누르기 전까지 회복 경로 없음.

**픽스**:

- (A) **callback normalizer 보강** — `parseTokenExpiresAt(provider, data)` 가 `expires_in` 을 먼저 시도하고 cafe24 한정으로 `expires_at` ISO 문자열을 파싱한다. 둘 다 없으면 cafe24 의 documented access_token TTL 인 **2h default** 로 fallback. 다른 provider 는 옛 동작 (null) 유지.
- (B) **`ensureFreshToken` null 안전 보강** — 이미 NULL 로 DB 에 저장된 row 들의 자가 회복을 위해 `expiresAtMs === null` 을 "needs refresh" 로 해석. cafe24 의 access_token 은 항상 만료가 있어 NULL 은 정상 상태가 아니라는 가정. 다음 호출 시 자동으로 refresh + 4-field 원자 UPDATE 가 일어나 `token_expires_at` 가 채워진다.
- (C) **`Cafe24ApiClient.refreshAccessToken` 보강** — refresh 응답에서도 같은 quirk 가 있으므로 `expires_in` → `expires_at` → 2h fallback 순으로 파싱.

DB 마이그레이션으로 NULL row 의 `token_expires_at` 를 backfill 하는 방식은, (B) 의 자가 회복이 동일 효과를 내며 마이그레이션 없이 다음 호출에서 자동 적용되므로 불필요하다. cafe24 한정 별도 normalizer 분기도 `normalizeTokenResponse` 한 함수 안의 provider 분기로 충분해 추가 분리는 과잉이다.

**Trade-off / 잔여 위험**:

- Cafe24 가 향후 응답 shape 을 변경 (예: `expires_in` 도 같이 echo) 해도 본 픽스는 backward-compatible — 표준 필드를 먼저 시도하기 때문.
- (B) 의 null=needs-refresh 정책이 비정상 row (예: 데이터 손상으로 credentials 가 사라진 경우) 에 대해 refresh 시도 → refresh 자체가 실패하면 `error(auth_failed)` 로 격하. 옛 silent-skip 보다 진단성이 높아 trade-off 수용.

**테스트**:

- `integration-oauth.service.cafe24.spec.ts` — Cafe24 의 실제 응답 shape (`expires_at` ISO string, no `expires_in`) 에서 `tokenExpiresAt` 이 정확히 파싱되는지, 둘 다 없으면 2h fallback 인지 회귀 테스트 2건 추가.
- `cafe24-api.client.spec.ts` — `tokenExpiresAt === null` AND `credentials.expires_at` 미존재 row 가 다음 호출에서 자동으로 refresh + 4-field 원자 UPDATE 되는지 회귀 테스트 1건 추가.

### `call()` 의 401 자동 회복

**문제**: 사용자 보고 — 최초 OAuth 연동 직후 MCP/노드 호출은 정상이지만, access_token 만료 후 (refresh_token 유효) 다시 시도하면 401 받고 갱신 없이 즉시 `error(auth_failed)` 로 전이. 사용자가 재인증을 강제당함. 원인은 proactive `ensureFreshToken` (§10.5 첫 bullet) 이 다음 race window 에서 빗나갈 수 있어 만료된 token 으로 Cafe24 호출이 발사되는 것:

- NULL `expires_at` legacy row (callback fix 이전 생성된 통합 — 위 "Cafe24 token 응답의 `expires_at` 처리" 항 참고)
- 다중 인스턴스 cache 미동기 (한 pod 의 refresh 결과가 다른 pod 의 메모리에 즉시 반영되지 않음)
- DB write 와 wall clock 간 미세 어긋남 (60s window 직전 도달)

**결정**: §5.8 의 연결 테스트 (`pingConnection`) 가 이미 갖고 있는 "401 → refresh → 1회 재시도" 패턴을 [Spec Cafe24 §6.1](../4-nodes/4-integration/4-cafe24.md#61-인증-실패-자동-status-전환) 의 401 분기와 §10.5 의 reactive 회복 정책으로 정식 채택. 코드는 `Cafe24ApiClient.executeWithRateLimit()` 의 401 분기를 `pingConnection()` 과 동일하게 수정. 403 은 refresh 로 회복 불가이므로 즉시 격하 (기존 정책 유지).

검토 후 배제한 대안:

- proactive window 확대 (예: 60s → 5min) — race window 만 좁힐 뿐 근원 미해결. 다중 인스턴스 cache miss 는 window 크기와 무관하게 발생.
- 여러 번 재시도 (예: 3회 exponential backoff) — refresh_token 자체가 invalid 면 무한 retry 가 alert 폭탄 + Cafe24 rate limit 위반 (`/oauth/token` 자체에도 rate limit 존재). 1회로 충분 — 첫 401 + refresh 성공이면 재시도 1회, refresh 실패면 즉시 격하.
- 즉시 격하 유지하고 사용자가 재인증 — 정상 갱신 가능한 케이스가 false negative 로 사용자 friction 증가. UX 후퇴. `pingConnection()` 이 이미 자가 회복 패턴인 것과 정책 분기. **단 외부 MCP 서버 (Spec MCP Client §8.4 본문) 는 refresh_token 이 없어 즉시 격하 + 사용자 재인증이 여전히 유효한 채택안** — 본 자가 회복은 Cafe24 (`call()` 경로) 한정.

**§8.4 (MCP Client) 의 "운영 가시성 해친다" 우려에 대한 반박**: §8.4 는 외부 MCP 서버 (refresh_token 없는 토큰 모델) 의 race-of-clock 시나리오를 막기 위한 정책이다. cafe24 처럼 refresh_token 을 보유한 provider 의 401 자가 회복은:

- "토큰이 외부에서 일시 회복" 이 아니라 "우리 서버가 refresh 로 명시적 갱신" — race-of-clock 시나리오 자체가 발생하지 않음.
- refresh 가 토큰 lifecycle 의 정상 단계 — refresh_token 보유 provider 의 정상 운영 흐름.
- status 깜빡임 (`error ↔ connected` 왕복) 도 발생하지 않음 — 자가 회복은 격하 **전** 단계에서 일어나므로 `status='connected'` 가 유지될 뿐.

따라서 §8.4 정책은 외부 MCP 한정으로 유지하고, Internal Bridge 의 refresh_token 보유 provider 는 §6.1 의 자가 회복 정책을 적용한다.

**적용 범위**:

- `Cafe24ApiClient.call()` → `executeWithRateLimit()` (cafe24 노드 + AI Agent Internal MCP Bridge 양쪽)
- `pingConnection()` 은 이미 동일 패턴 (변경 없음, 정책 통일 완성)

**비적용 범위**:

- 외부 MCP 서버 (§8.4 본문 그대로 적용 — refresh_token 없음)
- 403 (스코프/권한 부족 — refresh 무의미)
- refresh 자체의 401/403 (이미 격하 트리거, 재시도 없음)
- 429 / 5xx / transport — 본 정책과 무관, 기존 흐름 유지

### Cafe24 token 만료 SoT — JWT exp 격상

**문제**: proactive refresh + 401 자가 회복 경로가 모두 갖춰진 상태에서도 같은 401 (`access_token time expired`) 가 반복될 수 있다. 추적 결과:

1. `parseTokenExpiresAt` 와 `refreshAccessToken` 의 `Date.parse(expiresAtStr)` 가 TZ-less ISO 를 서버 local time 으로 해석 (ECMA-262 사양). Cafe24 가 KST 의미로 TZ-less ISO 를 보내면 UTC 컨테이너에서 `tokenExpiresAt` 가 의도 시각과 다른 epoch 로 저장됨.
2. `Cafe24TokenRefreshProcessor.process` 의 short-circuit guard (`expiresAtMs - now > REFRESH_WINDOW_MS` → skip refresh) 가 1 의 잘못된 값을 신뢰 → L3 401 reactive 자가 회복이 enqueue 해도 worker 가 refresh 를 수행하지 않음 → caller 가 stale token 으로 retry → 두 번째 401 → `markAuthFailed`.

L1~L4 4-layer 방어가 *같은 잘못된 expiry* 를 신뢰하므로 모두 무력화.

**결정**: Cafe24 의 access_token / refresh_token 이 JWT 라는 사실에 근거해 **JWT `exp` claim** 을 single source of truth 로 격상. RFC 7519 정의상 Unix epoch seconds (UTC absolute) 이므로 TZ 모호성 원천 제거. 두 위치 모두 precedence 통일:

- `parseTokenExpiresAt(provider='cafe24', data)` — JWT exp → `expires_in` → `expires_at` ISO (TZ-less 면 `+09:00` 부여) → 2h default
- `Cafe24ApiClient.refreshAccessToken` 의 expiresAt 계산 — 동일 precedence
- `resolveTokenExpiry` (proactive refresh 경로 / BullMQ worker short-circuit 판정) — JWT exp → `Integration.tokenExpiresAt` → `credentials.expires_at`: TZ-bugged `tokenExpiresAt` 가 proactive refresh 경로에서도 무력화됨. 이로써 L3 reactive_401 이 아닌 L1/L2 proactive 경로에서도 JWT exp 가 ground truth 로 작동.

추가로 워커 short-circuit 의 잘못된 신뢰 차단:

- `Cafe24RefreshJobData.source` 에 `'reactive_401'` 값 추가 (의미: HTTP 401 을 empirical 하게 받아 강제 refresh 가 필요한 경로의 신호. 향후 다른 empirical 신호 경로가 생기면 `reactive_<signal>` 패턴으로 확장).
- `Cafe24TokenRefreshProcessor.process` 가 `source === 'reactive_401'` 이면 short-circuit skip — 본 source 는 *caller 가 empirical 401 을 받았다* 는 신호라 DB 의 `expires_at` 을 신뢰하면 안 됨. 기존 short-circuit (proactive 의 thundering herd 방지) 은 그대로 유효 — proactive/background 경로의 dedup 보증은 BullMQ jobId dedup (waiting/active 상태) 으로 유지되며 본 변경은 *완료된 job* 의 잔존 동작만 영향. ([BullMQ cafe24-token-refresh 큐 — 멀티 인스턴스 race 해소](#bullmq-cafe24-token-refresh-큐--멀티-인스턴스-race-해소) 의 확장)
- `Cafe24ApiClient.performAuthRefresh` 가 `refreshViaQueue` 호출 시 `'reactive_401'` 전달.

JWT exp 격상이 근본 해결인 이유 (부분 대안 배제):

- `parseTokenExpiresAt` 만 TZ 보정 (워커 short-circuit 그대로) — 옛 NULL 또는 잘못된 expiry 가 DB 에 이미 저장된 row 의 자가 회복이 안 됨. reactive_401 force 가 필요.
- 워커 short-circuit 만 제거 (JWT exp 미적용) — proactive 경로가 여전히 잘못된 expiry 로 skip → 매 호출이 401 → reactive_401 → refresh 라는 우회로만 남음. 정상 상태에서도 매 호출이 한 번씩 401 을 받는 retry 비용 발생.
- Cafe24 에 응답 형식 정규화 요청 — 외부 의존, 시간 무한. 우리 측에서 해결 가능.

**Trade-off / 잔여 위험**:

- JWT signature 검증 없음 — 본 용도 (만료 시각 추출) 에 불필요. Cafe24 가 token format 을 opaque 로 바꾸면 `parseJwtExp` 가 null 반환 → fallback chain 으로 정상 강하.
- TZ 보정 fallback (`+09:00`) 은 Cafe24 본사 운영 timezone 기준 합리적 추정. Cafe24 가 향후 UTC 로 변경해도 JWT exp 가 최우선이라 영향 없음.
- 기존 row 의 (잘못된) `tokenExpiresAt` 은 다음 reactive_401 refresh 사이클에 자동 정정.

**테스트**:

- `jwt-exp.spec.ts` 신규 — `parseJwtExp` 단위 (정상 / segment 오류 / base64 오류 / JSON 오류 / exp 누락 / exp 비-숫자 / null / undefined)
- `integration-oauth.service.cafe24.spec.ts` 보강 — JWT 우선 / JWT 비정상 시 ISO fallback / TZ-less ISO 의 KST 정규화
- `cafe24-api.client.spec.ts` 보강 — refresh 응답의 access_token JWT 우선 / stale tokenExpiresAt + 401 → reactive_401 worker 가 short-circuit 없이 refresh
- `cafe24-token-refresh.processor.spec.ts` 보강 — source='reactive_401' 일 때 fresh token 도 refresh / 'proactive' 는 종전 short-circuit
- `cafe24-token-refresh.processor.spec.ts` 추가 — TZ-bugged `tokenExpiresAt` + `credentials.expires_at` 이 양쪽 미래 값이어도 JWT exp 과거면 proactive/background source 에서 refresh 발동 (resolveTokenExpiry 의 JWT exp 최우선)
- `cafe24-token-refresh.processor.spec.ts` 보강 — JWT exp parse 실패 3 케이스 (opaque token / 손상 segments / payload exp 누락) 에서 tokenExpiresAt 미래여도 short-circuit 금지 (worker 가 `parseJwtExp` 단독 신뢰)
- `cafe24-api.client.spec.ts` 보강 — reactive_401 의 jobId 가 `${integrationId}#reactive-\d+-[a-z0-9]+$` 형식이며 `integrationId` 와 다름을 어서션

### reactive_401 jobId unique 화 — dedup 완전 우회

[Rationale "Cafe24 token 만료 SoT — JWT exp 격상"](#cafe24-token-만료-sot--jwt-exp-격상) 의 후속 보강. 다음 두 가지 잔여 결함을 다룬다:

**A. `removeOnComplete: { age: 0 }` 가 dedup 을 차단하지 못함**:

BullMQ `addStandardJob-9.lua:22-27` 의 dedup 분기:

```lua
jobId = args[2]
jobIdKey = args[1] .. jobId
if rcall("EXISTS", jobIdKey) == 1 then
    return handleDuplicatedJob(...)  -- 기존 job 그대로 반환, 신규 옵션 무시
end
```

같은 `jobId` 의 job 이 `waiting`/`active`/`completed`/`failed` 어떤 상태든 Redis 에 존재하면 `Queue.add()` 는 기존 job 참조를 반환하며 **신규 add 의 options 를 적용하지 않는다**. 따라서 옛 fix (`removeOnComplete: { age: 0 }` — reactive_401 완료 직후 자동 제거) 는 *이미 생성된 reactive_401 job 의 완료 이후 retention* 만 통제했고, proactive 가 `removeOnComplete: { age: 60 }` 로 완료 후 60s 잔존하는 동안 같은 `integrationId` 의 reactive_401 add 가 기존 proactive completed job 으로 dedup 되는 edge case 를 차단하지 못했다.

`Job.waitUntilFinished` 가 `scripts.isFinished(jobId)` 를 즉시 폴링해 completed 면 바로 resolve 하므로 worker 가 새로 실행되지 않고 caller 는 stale credentials 로 retry → 두 번째 401 → `markAuthFailed` 회귀.

**B. worker short-circuit 이 `resolveTokenExpiry` 의 폴백 chain 까지 신뢰**:

`Cafe24TokenRefreshProcessor.process()` 의 short-circuit 은 `resolveTokenExpiry(fresh)` 를 사용. 본 함수의 폴백 chain (JWT exp → `tokenExpiresAt` → `credentials.expires_at`) 은 JWT exp parse 실패 케이스 (`parseJwtExp` 가 비-JWT / payload exp 비-숫자 등으로 null 반환) 에서 TZ-bugged `tokenExpiresAt` 미래 값으로 강하한다. 이 미래 값을 worker 가 신뢰해 short-circuit 발사 → no-op 완료 → (A) 와 결합하여 후속 add() 가 dedup → refresh 무한 회귀.

**결정**:

1. **`reactive_401` jobId unique 화**: `${integrationId}#reactive-${Date.now()}-${rand6}` 형태로 BullMQ dedup 자체를 우회. cross-pod 직렬화는 `refreshAccessToken` 의 `dataSource.transaction({ lock: 'pessimistic_write' })` row lock 으로 폴백 보호. `proactive`/`background` 는 기존 `jobId = integrationId` dedup 유지 (thundering herd / refresh_token rotation race 보호).

2. **worker short-circuit 은 `parseJwtExp(access_token)` 만 신뢰**: JWT exp 가 null 이거나 과거면 short-circuit 발사 금지 → 항상 `refreshAccessToken` 시도. `tokenExpiresAt` / `credentials.expires_at` 폴백을 short-circuit 판정에서 제거 (caller-side `ensureFreshToken` 의 게이트는 `resolveTokenExpiry` 그대로 사용 — false positive 비용은 enqueue 한 번뿐이고 worker 가 JWT exp 로 재판정하므로 안전).

**기존 invariant 의 명시적 해제 범위 (Rationale Continuity)**:

- `withIntegrationLock` (in-memory mutex) 의 역할: 본 결정에서 reactive_401 의 동일 pod 내 in-process 직렬화 보조 수단으로 재등장. [Rationale "BullMQ cafe24-token-refresh 큐"](#bullmq-cafe24-token-refresh-큐--멀티-인스턴스-race-해소) 의 "배제한 대안 — In-memory mutex (`withIntegrationLock`) 유지만" 과 역할이 다르다. 그 배제는 *cross-pod race 미해소* 사유였고, 본 결정은 in-process 직렬화 + PostgreSQL row lock cross-pod 직렬화 *조합* 으로 reactive_401 의 직렬화 보장을 BullMQ 큐가 아닌 DB 레벨로 이동시킨 것. 기각 대안이 부활한 것이 아니라 *역할 분담* 의 재구성.

- `waitUntilFinished` 단일 worker 결과 공유 invariant (위 본문 채택 본문 참조): `reactive_401` source 에 한해 본 invariant 의 보장을 명시적으로 해제한다. 두 pod 의 reactive_401 worker 가 모두 실행되어 각자 Cafe24 `/oauth/token` 을 호출할 수 있으며, 한 pod 의 refresh 만 DB 에 반영되고 (PostgreSQL `pessimistic_write` row lock) 다른 pod 은 `invalid_grant` 격하 → `markAuthFailed` 까지 가는 fail-safe 결과를 감수한다. `proactive` / `background` source 는 invariant 유지.

**검토 후 배제한 대안**:

- `removeOnComplete: { age: 0 }` 로 reactive_401 완료 job 을 즉시 제거하는 방식 — BullMQ `addStandardJob` Lua script 의 dedup 분기는 `EXISTS jobIdKey` 면 신규 add 의 options 를 적용하지 않고 기존 job 을 그대로 반환하므로, 기존 completed job 으로의 dedup 자체는 차단하지 못한다. 근본 차단 불가.
- `Queue.removeJob(jobId)` 를 add 직전에 호출 — active 상태 job 도 삭제 가능해 in-flight refresh 를 중단시키는 부작용. unsafe.
- reactive_401 도 큐 우회하고 in-process `refreshAccessToken` 직접 호출 — 큐 일관성 (BullMQ retention/관측성) 손실. unique jobId 가 일관성 보존하면서 dedup 만 우회하는 더 좋은 절충점.

**Trade-off / 잔여 위험**:

- cross-pod 동시 reactive_401 빈도: proactive 가 정상 작동하면 reactive_401 발생 자체가 매우 드물어 cross-pod 동시 401 은 사실상 발생하지 않는다 (caller-side 401 자가 회복은 단일 호출 단위로 발사되고 1초 이내 완결). 발생하더라도 fail-safe.
- worker short-circuit 폴백 제거의 비용: JWT exp null 케이스에서 worker 가 Cafe24 `/oauth/token` 을 매번 호출. 그러나 BG cron 의 `lastRotatedAt < cutoff` 게이트 + caller-side `ensureFreshToken` 의 `REFRESH_WINDOW_MS` 게이트가 엔트리 throttle 역할을 하므로 호출 증가는 미미. 안전성 (refresh 회귀 영구 차단) 이 비용보다 큼.
- BG cron / proactive 가 잔존 TZ-bugged `tokenExpiresAt` row 를 자동 회복: worker 가 JWT exp 만 신뢰하므로 access_token 이 JWT 인 경우 정상 회복. JWT 가 아닌 access_token 케이스 (Cafe24 가 향후 opaque token 도입) 는 worker 가 항상 refresh 시도하는 경로로 폴백 — 잘못된 fresh 상태 신뢰 없음.

**테스트** (위 §테스트 목록 참조).
