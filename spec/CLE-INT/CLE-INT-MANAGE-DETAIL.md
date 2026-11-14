---
id: "CLE-INT-MANAGE-DETAIL"
title: "통합 관리 — 상세 화면"
type: "design"
version: 2
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-INT-MANAGE"
ancestors: ["CLE-VISION", "CLE-INT", "CLE-INT-MANAGE"]
area: "CLE-INT"
content_hash: "c8e46b372e34b5e545f330d3a617f418c10ae4916c5bcefc93536caa04914e3c"
read_as: "approved_fallback"
task: "CLE-T-ZCEZ46"
source_paths: []
mirror_sha256: "45b6a7cd9fb298ff03a03e23a972eef40d655c14917a8d46173322bcc9aa6124"
etag: "sha256-53cdc45e8724bec31b5448aacdba6a4966b02cd60f97a5d134eb7953826bb3f6"
---
## 개요

이 문서는 [통합 관리](CLE-INT-MANAGE.md) 의 하위 문서로 통합 상세 페이지의 머리, 재설치 대기 안내와 개요·보안·권한·사용·활동·위험 영역 탭을 정한다. 목록과 추가 화면은 [통합 관리 — 목록과 추가 화면](CLE-INT-MANAGE-LIST.md), 탭이 부르는 API 는 [통합 관리 — API 와 에러 코드](CLE-INT-MANAGE-API.md) 가 정한다.

## 상세 페이지

| 영역 | 위치 | 들어가는 요소 | 동작 |
| --- | --- | --- | --- |
| 뒤로 가기 | 맨 위 | `← Back to integrations` | 목록으로 |
| 제목 | 그 아래 | 상태 아이콘, 별칭 | |
| 메타 라인 | 제목 아래 | `<인증 유형> · <공개 범위> · <상태 배지> · <Last used …>` | 자동 갱신 보조 라벨은 [통합 상태와 만료 알림](CLE-INT-STATUS.md) |
| 생성 정보 | 메타 아래 | `Created by @<user>, <date>` | |
| 재설치 대기 안내 | 머리 아래, 탭 위 | 제목, 설명, 요청 시각 | `reinstallRequestedAt` 이 `null` 이 아닐 때만 보인다. [재설치 대기 안내](#재설치-대기-안내) |
| 탭 | 본문 위 | `Overview`·`Security`·`Scope & Permissions`·`Usage`·`Activity`·`Danger zone` | 앵커(`#security`, `#usage` 등)로 전환. `Danger zone` 은 공개 범위 전환이나 삭제 가운데 하나라도 할 수 있을 때만 보인다 |

변경 버튼(별칭 수정, 통합 재인증, 자격 증명 교체, 추가 권한 요청, 공개 범위 전환, 삭제)은 [권한](CLE-INT-MANAGE-PERM.md#권한) 표에서 그 동작을 할 수 있는 사람에게만 보인다. 연결 테스트처럼 조회성 동작은 누구에게나 보인다. 위험 영역 탭을 볼 수 없는 사람이 그 탭의 앵커로 들어오거나 공개 범위를 바꿔 탭이 사라지면 개요 탭을 보인다. 숨기는 경우와 비활성으로 두는 경우를 가르는 기준은 [Rationale 「통합 화면은 할 수 없는 변경 동작을 숨긴다」](#통합-화면은-할-수-없는-변경-동작을-숨긴다-2026-10-29) 에 있다.

### 재설치 대기 안내

통합에 재설치 대기 표시(`IntegrationDto.reinstallRequestedAt`)가 있으면 머리와 탭 사이에 인라인 안내를 보인다. 지금 표시가 생기는 통합은 Cafe24 Private 뿐이다. 표시의 뜻과 상태와의 관계, 유효 기간은 [상태 모델 「재설치 대기 표시」](CLE-INT-STATUS-MODEL.md#재설치-대기-표시), 남기고 지우는 규칙은 [재인증과 추가 권한 요청 「재설치 대기 표시」](CLE-INT-OAUTH-REAUTH.md#재설치-대기-표시) 가 정한다.

- 톤은 info(파랑)다. 표시는 상태가 아니라 다음에 할 일을 알리는 안내라서 상태 배지와 따로 둔다. 오류·만료됨 같은 상태 문제는 상태 배지가 경고 톤으로 따로 보인다.
- 제목: "Cafe24 Developers 에서 '테스트 실행'을 눌러 주세요" / `Click "Test run" in Cafe24 Developers`
- 설명: "재설치를 요청했어요. Cafe24 Developers 의 앱 화면에서 '테스트 실행'을 누르면 동의 화면이 열려요. 동의하면 새 토큰으로 바뀌어요. 요청은 24시간 동안 유효해요." / `Reinstall requested. Click "Test run" on your app in Cafe24 Developers to open the consent screen; once you approve, the integration switches to the new token. The request stays valid for 24 hours.` 그 전까지 지금 토큰으로 실행된다는 문장은 넣지 않는다. 오류·만료됨 행은 콜백이 성공하기 전까지 노드 실행이 계속 막힌다.
- 요청 시각: "요청 시각: <시각>" / "Requested at: <시각>". 시각은 `formatDate(…, "datetime")` 로 보인다.
- 콜백이 성공하면 표시가 지워져 다음 조회부터 안내가 사라진다. 24시간 안에 «테스트 실행» 을 하지 않으면 응답의 `reinstallRequestedAt` 이 `null` 이 되어 안내도 사라진다. 다시 하려면 통합 재인증이나 추가 권한 요청을 다시 누른다.
- 안내 영역은 `role="status"` 다. 탭 위에 있어 어느 탭을 열어도 보인다.

### 개요 탭

| 요소 | 설명 |
| --- | --- |
| 기본 정보 | 서비스, 별칭, 만든 사람, 생성·수정일, 마지막 사용 시각, 마지막 교체 시각, 토큰 만료 시각(자동 갱신 통합의 표기는 [통합 상태와 만료 알림](CLE-INT-STATUS.md)) |
| 빠른 동작 | `Test connection`(연결됨만), `Reauthorize`(OAuth, 비활성 조건은 [보안 탭](#보안-탭). 자동 갱신 통합이 연결됨인 동안에는 버튼을 활성으로 두되 hover 에 "Auto-renewing — manual reauthorization is not required" 를 보인다), `Rotate credentials`(OAuth 아님), `Edit alias` |
| 상태 배지 | 현재 상태와 사유(예: `error(insufficient_scope)`) |
| 별칭 편집 | 인라인 편집, `PATCH /api/integrations/:id` |
| App URL 카드 | `IntegrationDto.appUrl` 이 null 이 아닌 통합에만 보인다. 현재 Cafe24 Private(`service_type='cafe24' AND credentials.app_type='private'`)과 MakeShop ShopStore 설치 통합이다. App URL(`${APP_URL}/api/3rd-party/<provider>/install/:installToken`)과 Redirect URI(App URL 의 `/install/<token>` 을 `/callback` 으로 바꾼 값)를 복사 버튼과 함께 보인다. 문구는 서비스 유형별로 다르다. Cafe24 는 개발자 센터 «앱 URL» 갱신 안내(App URL HMAC 실패 에러 페이지가 비교 대상으로 가리키는 곳이 이 카드다), MakeShop 은 파트너센터 앱 설정 안내다. 새 등록 흐름의 설정 안내 화면과 같은 복사 UX(라벨, 모노스페이스 URL, 복사 버튼, 한 줄 안내)를 다시 쓴다 |

### 보안 탭

| 블록 | 설명 |
| --- | --- |
| Authentication | 인증 유형과 현재 자격 증명 메타(예: `Token preview: xoxb-****4f2a`). 원본 값은 복호화해 보이지 않는다 |
| Reauthorize (OAuth) | `[Reauthorize]` → `POST /api/integrations/:id/reauthorize`. 응답에 `authUrl` 이 있으면 팝업 OAuth 를 열고 성공하면 연결됨으로 돌아온다. Cafe24 Private 은 응답이 `cafe24_private_pending` 이라 팝업 없이 info 토스트("Cafe24 Developers 에서 '테스트 실행'을 눌러 주세요")를 보이고 통합을 다시 조회한다. 다시 조회한 화면에 [재설치 대기 안내](#재설치-대기-안내)가 나온다. Cafe24 Private 의 버튼 위 설명은 "재설치를 요청한 뒤 Cafe24 Developers 에서 '테스트 실행'을 누르면 토큰이 갱신돼요." 다. 비활성 조건은 아래 표 |
| Rotate credentials (OAuth 아님) | 인라인 폼. 기존 값은 가리고 토글로 교체 폼을 열어 새 값을 넣으면 `POST /api/integrations/:id/rotate` 가 안에서 연결 테스트를 하고 성공할 때만 저장한다. 실패하면 기존 자격 증명을 유지하고 통합 화면 공통 규칙으로 고른 문구를 토스트로 보인다([다국어와 화면 문구](../CLE-UI/CLE-UI-I18N.md) 규칙 5). 연결 테스트 실패(`INTEGRATION_TEST_FAILED`)는 그 매핑에 없는 코드라 에러 봉투의 `error.message`, 곧 테스트 결과의 `message` 가 보인다. 고를 문구가 없으면 기본 문구 «교체에 실패했어요» 를 보인다. 폼 필드는 서비스 스키마와 같다. 서버는 테스트가 성공하기 전까지 기존 자격 증명을 건드리지 않는다 |
| Last rotated | `last_rotated_at` 상대 시간과 절대 시간 |

통합 재인증 버튼은 아래 조건에서 막고 버튼 아래에 이유별 안내 문구를 보인다(`reauthorizeDisabledReason`). 위 행부터 판정해 처음 맞는 이유를 쓴다.

| 이유 값 | 조건 | 막는 이유 | 안내 문구 |
| --- | --- | --- | --- |
| `pending_install` | 설치 대기(서비스 무관) | 설치가 끝나지 않았다. 외부 «테스트 실행»·앱 설치가 정식 경로다 | "설치가 끝나지 않은 통합은 재인증할 수 없어요. 설치를 먼저 마쳐 주세요." |
| `install_timeout` | `status='expired' AND status_reason='install_timeout'` | 설치 기한이 지나 설치 토큰이 지워졌다. 상점 식별자를 비우므로 이 행을 지우지 않아도 같은 상점을 새로 등록한다. 이름은 그대로 남아 같은 이름으로 등록하면 409 `INTEGRATION_NAME_TAKEN` 이라 다른 이름으로 등록한다([OAuth 연결과 토큰 갱신](CLE-INT-OAUTH.md#만료된-설치-대기-행은-상점-자리를-놓는다-2026-10-29)) | "설치 시간이 지나 만료된 통합은 재인증할 수 없어요. 이 통합을 지우지 않아도 같은 상점을 새로 등록할 수 있어요. 이름이 겹치면 다른 이름으로 등록해 주세요." |
| `makeshop` | MakeShop 통합 | 서버가 통합 재인증을 시작할 수 없고 ShopStore 재설치도 기존 통합을 되살리지 않는다. 삭제 후 재등록한다 | "MakeShop 통합은 재인증할 수 없어요. 문제가 생기면 통합을 삭제한 뒤 다시 등록해 주세요. 상점에서 앱을 다시 설치해도 기존 통합은 복구되지 않아요." |
| `no_app_url` | App URL(`appUrl`)이 없는 Cafe24 Private 통합 | 설치 토큰이 없어 «테스트 실행» 이 이 행으로 돌아올 수 없다. 삭제 후 재등록한다 | "App URL 이 없어 재설치를 요청할 수 없어요. 통합을 삭제한 뒤 다시 등록해 주세요." |

- 설치를 마치고 App URL 이 있는 Cafe24 Private 통합은 버튼이 활성이다. 서버는 재설치 대기 표시만 남기고 사용자가 «테스트 실행» 을 누르면 App URL 이 OAuth 로 보낸다([재인증과 추가 권한 요청 「재설치 대기 표시」](CLE-INT-OAUTH-REAUTH.md#재설치-대기-표시)). 표시가 남아 있어도 버튼은 활성이고 다시 누르면 새 시각으로 표시를 다시 남긴다.
- 화면에서 막는 것과 별개로 서버도 `:id/reauthorize` 를 400 으로 거절한다. 거절하는 통합과 코드는 [재인증과 추가 권한 요청](CLE-INT-OAUTH-REAUTH.md#통합-재인증과-추가-권한-요청) 이 정한다. MakeShop 통합은 `MAKESHOP_CREDENTIALS_REQUIRED` 다([REQ-INTOAUTH-072](CLE-INT-OAUTH.md#요구사항), [MakeShop 은 삭제 후 재등록으로만 복구한다](CLE-INT-OAUTH-REAUTH.md#makeshop-은-삭제-후-재등록으로만-복구한다)). 가시성과 역할 판정(404·403)을 통과한 요청만 이 400 에 닿는다.

### 권한 탭

OAuth 통합에서만 보인다. 요소와 추가 권한 요청 응답 처리는 [재인증과 추가 권한 요청 「권한 탭」](CLE-INT-OAUTH-REAUTH.md#권한-탭-oauth-통합만) 이 정한다. 설치 기한이 지나 만료된 통합, MakeShop 통합, App URL 이 없는 Cafe24 Private 통합은 권한 요청 버튼도 막고 이유별 안내를 보인다(`requestScopesDisabledReason`). 이유는 `install_timeout`·`makeshop`·`no_app_url` 순서로 판정하고 통합 재인증 비활성 이유와 같은 순서다. 설치 기한 만료는 이 통합을 지우지 않고 필요한 권한으로 같은 상점을 새로 등록하라고 안내하고 나머지 둘은 삭제 후 재등록을 안내한다. 이유별 문구도 같은 절의 요소 표가 정한다. 추가 권한 요청이 `cafe24_private_pending` 으로 끝나면 통합을 다시 조회하므로 재설치 대기 표시가 남은 경우 [재설치 대기 안내](#재설치-대기-안내)가 바로 나온다.

### 사용 탭

"Used by 3 nodes across 2 workflows" 같은 요약 아래 워크플로우별로 사용 노드를 묶어 보인다. 각 행은 노드 라벨, 노드 ID, `[Open in editor →]` 링크다.

- 데이터는 `GET /api/integrations/:id/usages` 에서 온다([사용처 추적과 삭제 차단](CLE-INT-MANAGE-RUN.md#사용처-추적과-삭제-차단)).
- 워크플로우 활성 여부와 상관없이 모두 보인다. 워크플로우 이름 옆에 `(Active)`·`(Inactive)` 를 붙인다.
- «Open in editor» 는 워크플로우 에디터 URL 로 가서 그 노드를 선택한 상태로 연다.
- `usageKind='mcp'` 노드는 라벨 옆에 보조 톤의 `MCP` 배지를 붙인다. 통합을 직결 노드가 아니라 AI 에이전트의 MCP 도구로 쓴다는 뜻이다. `direct` 는 배지가 없다.

### 활동 탭

맨 위에 "Last 7 days: 124 calls · 98% success" 요약과 일별 호출 수 스파크라인을 두고 아래에 최근 20건 표를 둔다.

| 컬럼 | 내용 |
| --- | --- |
| At | 호출 시각. 상대 표기와 tooltip 절대 시각 |
| API | 라벨(굵게)과 endpoint 보조 문구(작게) 두 줄. `apiLabel` 만 있으면 라벨만, `apiMethod`·`apiPath` 만 있으면 endpoint 한 줄(`{method} {path}`), 둘 다 NULL 이면 `—` |
| Status | `Success` / `Failed` |
| Duration | `durationMs` 를 읽기 쉽게(`412 ms` / `1.2 s`) |
| Error | 실패 행에만 `error.code` 와 잘린 첫 줄 메시지. 비면 `—` |

예시:

| At | API | Status | Duration | Error |
| --- | --- | --- | --- | --- |
| 14:03 Apr 11 | **상품 목록 조회** / `GET products` | Success | 412 ms | — |
| 13:55 Apr 11 | `POST api.example.com/v1/users` | Failed | 1203 ms | `HTTP_502` HTTP 502 Bad Gate… |
| 13:40 Apr 11 | — | Success | 18 ms | — |

- 데이터는 `GET /api/integrations/:id/activity?limit=20&days=7` 에서 온다([사용처와 활동 API](CLE-INT-MANAGE-API.md#사용처와-활동-api)).
- 실패 행을 누르면 에러 요약 팝오버와 `Execution detail →` 링크를 보인다.
- 카탈로그 라벨: Cafe24 의 `apiLabel`(`cafe24.<resource>.<operation>`)은 `GET /api/integrations/services/cafe24/catalog` 응답의 `labelKey` 와 프런트엔드 i18n 사전으로 한국어·영어 라벨이 된다. MakeShop 도 같다(`makeshop.<resource>.<operation>`, `services/makeshop/catalog`). 그 밖의 통합은 `apiLabel` 이 NULL 이라 endpoint 만 보이고 세 값이 모두 NULL 이면 `—` 가 보인다. 통합마다 세 값을 무엇으로 채우는지는 [통합 데이터와 흐름 「호출 API 식별 채우기 규칙」](CLE-INT-DATA.md#호출-api-식별-채우기-규칙) 이 정한다.
- **연결 안 됨 안내**: 통합 상태가 연결됨이 아니면(오류, 만료됨, 설치 대기) 활동 목록과 빈 상태 위에 [인라인 안내](../CLE-UI/CLE-UI-LAYOUT.md) 를 보인다. 이 상태에서는 새 호출이 기록되지 않는다. AI 에이전트는 내부 MCP 브리지가 연결되지 않은 통합의 도구를 노출하지 않아 호출이 없고 직결 노드는 `INTEGRATION_NOT_CONNECTED` 로 바로 실패한다. 그래서 단순한 «활동 없음» 과 구분해 원인을 알린다. 톤은 오류가 red, 만료됨·설치 대기가 amber 로 헤더 상태 배지와 맞춘다. 안내에는 개요 탭으로 가는 «상태 확인» 버튼이 있다. 연결됨(만료 임박 포함)은 여전히 기록되므로 안내를 보이지 않는다. 설치 대기를 넣는 것은 주의 필요(설치 대기 제외)와 다른 축이다. «조치가 필요한가» 가 아니라 «활동 데이터가 왜 없는가» 를 설명한다.

### 위험 영역 탭

- `[Delete integration]` 버튼을 누르면 `GET /api/integrations/:id/usages` 를 확인한다. 사용처가 0건이면 확인 다이얼로그 뒤 `DELETE /api/integrations/:id` 를 부른다. 1건 이상이면 삭제 차단 다이얼로그에 사용처 목록과 안내를 보인다([사용처 추적과 삭제 차단](CLE-INT-MANAGE-RUN.md#사용처-추적과-삭제-차단)).
- 공개 범위 전환도 이 탭에 있다(관리자만).

공개 범위 전환 다이얼로그 문구:

> ⚠ Change scope from Personal to Organization?
>
> 기존 OAuth 토큰이 워크스페이스 전체 멤버에게 그대로 승계됩니다. 공유해도 문제가 없는 권한인지 확인해 주세요.
>
> [취소] [Change to Organization]

조직에서 개인으로 바꾸는 다이얼로그는 전환 전에 `GET /api/integrations/:id/usages` 를 확인한다. 워크플로우 작성자가 통합 소유자가 아닌 워크플로우(응답의 `authorIsIntegrationOwner` 가 `false`)가 있으면 그 목록과 함께 전환 뒤 그 워크플로우의 노드가 이 통합을 쓰지 못해 실행에서 실패한다는 안내를 보인다. 관리자가 확인하면 전환한다. 그런 워크플로우가 없으면 안내 없이 확인만 받는다. 통합을 만든 사람이 이미 워크스페이스를 나갔으면 서버가 전환을 409 `INTEGRATION_OWNER_NOT_MEMBER` 로 거절한다. 화면은 전환하지 않고 «이 통합을 만든 사람이 워크스페이스에 없어 개인 통합으로 바꿀 수 없어요. 조직 통합으로 두거나 삭제해 주세요.» 를 에러 토스트로 보인다. 확인 창과 경고 다이얼로그는 요청 전에 닫힌다. 이 문구는 에러 코드로 고른 사전 항목(ko/en)이고 [다국어와 화면 문구 규칙 5](../CLE-UI/CLE-UI-I18N.md#규칙) 의 «통합 화면 에러 응답 코드» 행을 따른다.

API 는 `PATCH /api/integrations/:id/scope`(관리자만)이고 전환 뒤 감사 로그 `integration.scope_changed` 를 남긴다. 서버는 사용처가 있어도 전환을 거절하지 않는다. 다이얼로그를 연 뒤에 생긴 사용처는 경고에 나오지 않는다. 통합을 만든 사람이 멤버가 아니라 거절한 전환은 감사 로그를 남기지 않는다. 전환 트랜잭션이 잠글 워크스페이스 행이 그 사이 지워졌으면 404 `RESOURCE_NOT_FOUND` 다. 워크스페이스와 함께 그 통합도 지워졌으므로 없는 통합과 같은 응답이다.

## 구현 위치

- `codebase/frontend/src/app/(main)/w/[slug]/integrations/[id]/**` (`reinstall-requested-notice.tsx`: 재설치 대기 안내, `scope-tab.tsx`: 권한 탭, `danger-tab.tsx`: 개인 전환 경고와 전환 거절 토스트, `security-tab.tsx`: 재인증 · 자격 증명 교체와 교체 실패 토스트)
- `codebase/frontend/src/app/(main)/w/[slug]/integrations/_shared/integration-permissions.ts` (화면의 변경 동작 판정 `integrationPermissions`·`hasDangerZoneAction`)
- `codebase/frontend/src/components/auth/role-gate.tsx` (역할 게이트 `RoleGate`·`useHasRole`)
- `codebase/frontend/src/lib/integrations/reauthorize.ts` (`reauthorizeDisabledReason`·`requestScopesDisabledReason`·`isRequestScopesDisabled`)
- e2e(화면의 역할 게이트): `codebase/frontend/e2e/integrations/role-gating.spec.ts`

## Rationale

### 통합 화면은 할 수 없는 변경 동작을 숨긴다 (2026-10-29)

통합 목록과 상세 화면은 지금 사용자가 역할이나 통합 소유 때문에 할 수 없는 변경 동작을 보이지 않는다. 할 수 있는지는 [권한](CLE-INT-MANAGE-PERM.md#권한) 표로 정한다.

- **동작 자체를 할 수 없는 역할이면 그 버튼을 숨긴다.** 목록 헤더와 빈 상태의 `[+ Add Integration]` 과 `N` 키, 상세의 변경 버튼(별칭 수정, 통합 재인증, 자격 증명 교체, 추가 권한 요청, 공개 범위 전환, 삭제), 위험 영역 탭이 해당한다. 위험 영역 탭은 공개 범위 전환과 삭제를 둘 다 할 수 없을 때 숨긴다.
- **한 화면에서 고를 수 있는 값 가운데 일부만 막히면 선택지를 숨기지 않는다.** 비활성으로 두고 이유를 보인다. 노드 설정 패널의 통합 선택기([「고르는 화면은 저장 검사를 통과할 통합만 고르게 한다」](CLE-INT-MANAGE-USE.md#고르는-화면은-저장-검사를-통과할-통합만-고르게-한다))와 추가 페이지 `scope` 의 `Organization` 비활성이 이 경우다. 숨기면 사용자는 그 값이 왜 없는지 알 수 없다.
- **두 방식은 막히는 범위로 가른다.** 동작 전체를 할 수 없으면 숨긴다. 같은 화면에서 고르는 값의 일부만 막히면 비활성으로 둔다. 상태 때문에 막는 경우(통합 재인증의 비활성 이유, 사용처가 남은 삭제)는 이 기준과 별개이고 지금처럼 이유를 보인다.
- **이 기준은 통합 목록·추가·상세 화면에 쓴다.** [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md#워크스페이스-관리-화면) 의 멤버 탭이 소유자가 아닌 관리자에게 관리자 선택지를 숨기는 것은 이 결정 밖이다. 다른 영역 화면(실행 이력, 재실행, 트리거 관리)과 기준을 맞추는 일은 여기서 정하지 않는다.
- **화면 제한은 편의이고 경계는 서버다.** 권한은 라우트 가드와 서비스 계층 판정이 지킨다. 그래서 화면 게이트는 서버의 역할 하한과 같은 배포에 들어가거나 그 뒤에 들어간다. 화면만 먼저 바뀌면 숨긴 동작을 API 로 계속 부를 수 있다.

받아들인 잔여: 추가 버튼, 변경 버튼, 위험 영역 탭을 숨기므로 뷰어와 편집자는 그 동작을 할 수 없는 이유를 화면에서 안내받지 않는다. 안내는 뷰어가 추가 화면 주소(`/integrations/new`)로 들어올 때만 보인다. 자기 역할은 [워크스페이스 관리 화면](../CLE-ACCT/CLE-ACCT-WS.md#워크스페이스-관리-화면) 의 개요 탭에서 본다.

### Cafe24 Private 통합 재인증을 열고 MakeShop 은 막는다 (2026-10-10)

이전에는 Cafe24 Private 통합의 통합 재인증 버튼을 모든 경우에 막았다. 우리 서버가 OAuth 를 시작할 수 없어서다. MakeShop 은 버튼을 둘지와 오류 뒤 복구 경로가 미결이었다. 2026-10-10 에 사용자가 두 서비스를 다르게 정했다.

- **Cafe24 Private 은 App URL 이 남아 있으면 버튼을 연다.** 서버가 재설치 대기 표시를 남기고 사용자가 «테스트 실행» 을 누르면 App URL 이 OAuth 로 보낸다. 응답에 `authUrl` 이 없어 열 팝업이 없으므로 화면은 토스트와 재설치 대기 안내로 다음 할 일을 알린다.
- **MakeShop 은 버튼을 막는다.** ShopStore 재설치가 설치를 마친 통합을 되살리지 않아 복구 경로가 삭제 후 재등록뿐이다. 이유와 기각한 선택지는 [재인증과 추가 권한 요청](CLE-INT-OAUTH-REAUTH.md#makeshop-은-삭제-후-재등록으로만-복구한다) 에 있다.
- **비활성 안내는 이유마다 따로 보인다.** 이유마다 사용자가 할 일이 다르다. 설치 대기는 설치를 마치면 된다. 설치 기한이 지난 행은 지우지 않고 같은 상점을 새로 등록하면 되고(2026-10-30 부터. 그 전에는 삭제 후 재등록으로 안내했다) App URL 이 없는 행은 삭제한 뒤 다시 등록해야 한다. App URL 이 없는 행이 모두 설치 기한이 지난 행은 아니어서 «설치 시간이 지나 만료» 라는 문구를 함께 쓸 수 없다. MakeShop 은 상점에서 앱을 다시 설치해도 복구되지 않는다는 점까지 알아야 한다.
- **재설치 대기 안내는 상태 배지와 따로 info 톤으로 둔다.** 표시는 상태가 아니라서 상태 배지로 보일 수 없다. 안내는 다음에 할 일을 알리는 것이고 오류·만료됨 같은 상태 문제는 상태 배지가 이미 경고 톤으로 보인다. 그래서 안내에 경고 톤을 겹치지 않는다. «표시가 있어도 지금 토큰으로 실행이 계속된다» 는 문장은 넣지 않는다. 오류·만료됨 행은 콜백이 성공할 때까지 노드 실행이 막힌다. 권한 탭의 인라인 안내는 요청 직후 그 탭에만 보이고 다음 요청 때 초기화된다. 표시는 콜백이 성공하거나 24시간이 지날 때까지 남으므로 탭 위에 따로 둔다.

### 상세 화면에 App URL 카드를 둔다

Cafe24 «앱으로 가기»·«테스트 실행» 의 HMAC 실패 에러 페이지(`renderInstallErrorHtml`)는 «통합 상세 페이지에 표시된 URL 과 일치하는지 확인하세요» 라고 안내한다. 그래서 개요 탭에 `Cafe24AppUrlCard` 를 두고 App URL·Redirect URI 를 복사 버튼과 함께 보인다. 백엔드는 `IntegrationDto.appUrl` 을 계산해 싣고 설치 토큰은 따로 노출하지 않는다. 경로 안에 이미 있고 식별자가 두 곳에 흩어지면 클라이언트가 어느 값으로 비교할지 헷갈리며 경로 형식이 바뀔 때 두 필드를 함께 맞춰야 하기 때문이다. 새 등록 흐름의 `Cafe24PrivatePending` 컴포넌트(`integrations/new/page.tsx`)와 같은 복사 UX 를 다시 써 혼동을 줄인다. HMAC 실패 로그 보강은 [OAuth 연결과 토큰 갱신](CLE-INT-OAUTH.md) 에 있다.

### 활동 탭의 API 라벨은 카탈로그 엔드포인트와 프런트엔드 i18n 으로 그린다

Cafe24·MakeShop 라벨을 사람이 읽는 문구로 바꾸는 책임을 백엔드가 아니라 프런트엔드에 둔다. 백엔드가 i18n 결과(예: `"상품 목록 조회"`)를 바로 `api_label` 에 넣으면 화면 언어를 바꿔도 DB 의 옛 한국어 라벨이 영어 화면에 그대로 나오고 카탈로그가 바뀌면 DB 의 옛 라벨이 낡는다. 그래서 DB 에는 언어 정보 없는 카탈로그 키만 두고 카탈로그 엔드포인트는 `{ key, method, path, labelKey, descriptionKey }` 만 내며 프런트엔드 i18n 사전(`cafe24Catalog`·`makeshopCatalog`)이 사용자 언어에 따라 바꾼다.

Cafe24·MakeShop 만 `operations` 를 채우는 이유는 다른 통합은 `apiLabel` 이 NULL 이라 카탈로그 조회가 일어나지 않아서다(endpoint 한 줄로 충분하다). 빈 배열을 돌려줘 엔드포인트는 계속 부를 수 있게 두면 다른 서비스가 카탈로그를 가질 때 분기만 채우면 된다.

활동 탭 표에서 `Workflow`·`Node` 컬럼은 뺐다. 그 정보는 `Execution detail →` 링크로 늘 닿을 수 있고 활동 탭의 본질은 «어느 API 가 언제 실패했나» 라는 진단이라 워크플로우·노드 식별은 한 단계 돌아간 자리가 맞다. 대신 두 번째 컬럼을 API 식별에 줘 진단 신호의 밀도를 높였다. 세 컬럼 설계의 이유는 [통합 데이터와 흐름](CLE-INT-DATA.md) 의 Rationale 에 있다.
