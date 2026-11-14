---
id: "CLE-INT-STATUS-DISPLAY"
title: "통합 상태와 만료 알림 — 화면 표시와 주의 필요"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-INT-STATUS"
ancestors: ["CLE-VISION", "CLE-INT", "CLE-INT-STATUS"]
area: "CLE-INT"
content_hash: "7451d961c42ba64aee2ea29a73fad8bfccbd0a6aa608d1e49076b9c99ca7748f"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "fee120c7e46dc1ff19674527f5dfbae2e88e45614e996a397b47b052b1844481"
etag: "sha256-2a84692442cf512ffd25b27d8431e222b0f7990f6d73a62db7b0cce0ae8c9dc2"
---
## 개요

이 문서는 [통합 상태와 만료 알림](CLE-INT-STATUS.md) 의 하위 문서로 통합 목록 · 상세 · 사이드바의 상태 표시와 «주의 필요» 판정(가상 필터 `expiring`·`attention`), 주의 필요 배너와 사이드바 배지를 정한다. 상태 값과 전이는 [상태 모델](CLE-INT-STATUS-MODEL.md) 이 정한다.

## 상태 표시와 주의 필요

### 목록과 상세의 상태 표시

| 상태 | 목록 아이콘 | 상태 문구 |
| --- | --- | --- |
| 연결됨 | 🟢 | `Connected` |
| 만료 임박(7일 이내) | 🟡 | `Expires in Nd` |
| 만료됨 | 🟡 | `Expired` |
| 오류 | 🔴 | `Error: <reason>` |
| 설치 대기 | ⏳ | `Pending install`. 보조 문구 "Complete Cafe24 Test Run to activate" |

- `status_reason`·`last_error` 가 채워지면 카드 아래에 진단 단서를 보인다. 예: `Last error: OAUTH_TOKEN_EXCHANGE_FAILED — Failed to exchange authorization code`.
- 상세 헤더의 상태 배지는 현재 상태와 사유를 함께 보인다(예: `error(insufficient_scope)`). 만료가 가까우면 `Expires in Nd` 를 보인다.
- 자동 갱신 표시(`autoRefresh`, [통합 관리](CLE-INT-MANAGE.md) 의 `IntegrationDto`)가 true 인 통합은 만료가 가까워도 상태 문구를 `Connected` 로 두고 작은 보조 라벨 `Auto-renews` 를 붙인다. `Expires in Nd` 는 `autoRefresh=false` 통합에만 쓴다.
- 상세 헤더는 자동 갱신 통합이 `Connected` 일 때만 배지 옆에 회색 보조 라벨 `Auto-renews · next in <duration>` 을 보인다(예: `Auto-renews · next in 1h 24m`). `<duration>` 은 `token_expires_at - NOW()` 를 사람이 읽기 쉽게 쓴 값이다. 다른 상태이거나 `autoRefresh=false` 면 보이지 않는다.
- 상세 개요 탭의 토큰 만료 시각은 자동 갱신 통합이면 `in <duration> · auto-renews` 로 쓰고 절대 시각은 행에 마우스를 올릴 때 tooltip 으로 보인다. `autoRefresh=false` 면 절대 시각을 바로 쓴다.

### 주의 필요 판정

화면 필터에는 DB 상태에 없는 가상 값 두 개가 있다. 만료 임박(`expiring`)과 주의 필요(`attention`)다. 백엔드 쿼리 빌더가 목록 API 의 `status` 파라미터를 받아 합집합 WHERE 절로 바꾼다. DB 상태 enum 은 넓히지 않는다.

| 값 | 조건 |
| --- | --- |
| `expiring` | `status='connected' AND token_expires_at within 7d AND NOT autoRefresh` |
| `attention` | `status IN (expired, error)` OR (`status='connected' AND token_expires_at IS NOT NULL AND token_expires_at > NOW() AND token_expires_at <= NOW() + INTERVAL '7d' AND NOT autoRefresh`) |

- 설치 대기는 두 값 모두에서 뺀다. 사용자가 외부(Cafe24 개발자 센터, ShopStore)에서 흐름을 진행하는 정상 상태로 본다. 사유가 채워진 설치 대기도 같다.
- `install_timeout` 으로 `expired` 가 된 행은 주의 필요에 들어간다. 설치가 끝나지 않아 다시 등록해야 하는 운영 신호다. 사용자는 이 행을 지우지 않고 같은 상점을 새로 등록한다. 등록 방법과 이름 충돌은 [상태 전이](CLE-INT-STATUS-MODEL.md#상태-전이) 의 `pending_install` → `expired` 행에 있다. 새로 등록해도 만료 행은 지울 때까지 주의 필요에 남는다. 화면 안내가 삭제를 시키지 않으면서 이 신호를 남기는 이유는 [OAuth 연결과 토큰 갱신](CLE-INT-OAUTH.md#만료된-설치-대기-행은-상점-자리를-놓는다-2026-10-29) 의 2026-10-30 번복에 있다.
- 자동 갱신 통합은 만료 임박 분기에서 뺀다. Cafe24 access token(2시간)처럼 수명이 짧은 토큰의 거짓 양성을 막는다. 자동 갱신이 실패해 `error(auth_failed)`·`error(network)` 가 되면 `status IN (expired, error)` 분기로 그대로 들어가므로 사용자 신호가 사라지지 않는다.
- 재설치 대기 표시는 두 값 모두의 조건에 쓰지 않는다([재설치 대기 표시](CLE-INT-STATUS-MODEL.md#재설치-대기-표시)).
- 목록 상태 칩은 `All` / `Attention` / `Connected` / `Expiring` / `Expired` / `Error` 이고 하나만 고른다. 설치 대기 칩은 두지 않는다.

### 주의 필요 배너

- 표시 조건: 위 `attention` 조건에 맞는 통합이 있을 때. 0건이면 보이지 않는다.
- 내용: 한 줄 요약(`"통합 N건이 주의가 필요해요"`)과 그 아래 분해 카운트(`"만료 X · 만료 임박 Y · 오류 Z"`). 0건인 카테고리는 빼고 보인다.
- 톤: 기본은 amber(경고)다. 오류가 1건 이상이면 왼쪽 점과 테두리를 red 로 강조한다. 문구는 같다.
- 클릭: 합계가 2건 이상이면 URL 을 `?status=attention` 으로 바꿔 같은 페이지에 합집합을 보인다. 1건이면 필터 단계를 건너뛰고 그 통합 상세(`/integrations/<id>`)로 바로 간다.
- URL 로 바로 들어와도(`/integrations?status=attention`) 같은 결과를 보이고 `Attention` 칩이 켜진다.
- 집계 범위는 현재 페이지다. 배너의 합계, 분해 카운트, 1건 이동 판정은 현재 페이지 행만 보고 계산하며 별도 카운트 API 를 부르지 않는다. 첫 페이지 30건이 모두 주의 필요면 그 뒤 행이 더 있어도 배너는 30건까지만 보인다. 배너를 눌러 필터로 들어가면 그다음은 페이지를 넘기며 전체를 본다. 전체 개수는 사이드바 배지가 맡는다.

### 사이드바 배지

- 사이드바 통합 메뉴에 `attention` 조건과 같은 술어로 센 개수를 보인다. 설치 대기는 빼고 자동 갱신 통합은 만료 임박 분기에서 뺀다.
- 목록 카드 모서리에도 배지를 보인다.

통합이 `expired`·`error` 가 되면 그 통합을 참조하는 노드에 에디터 경고가 붙고, 상세 화면 활동 탭에 «연결 안 됨» 안내가 붙는다. 두 표시는 [통합 관리](CLE-INT-MANAGE.md) 가 정한다.

## 구현 위치

- `codebase/frontend/src/app/(main)/w/[slug]/integrations/page.tsx` (목록·배너·칩)
- `codebase/frontend/src/lib/integrations/*.ts`

## Rationale

### 주의 필요를 가상 필터 값 하나로 노출한다

«주의 필요» 배너를 눌렀을 때 정의(만료 임박·만료됨·오류로 전환)와 구현이 어긋나, 배너에 보인 항목을 필터 페이지에서 찾지 못한다는 보고가 있었다. 원인은 둘이었다. 상태 칩이 하나만 고르는 모델이라 세 상태를 한 번에 켤 표현이 없었고, 구현이 차선책으로 `?status=expiring` 하나만 보냈다.

- **`Attention` 칩을 새로 둔다.** 만료됨·만료 임박·오류의 합집합을 값 하나로 더해 단일 선택 모델을 유지하면서 합집합을 준다. 다중 선택 칩이나 `?status=expiring&status=expired` 같은 다중 값 쿼리도 검토했다. URL 공유가 불편해지고, 다른 단일 필터(`scope`, `q`)와 일관성이 깨지며, «사용자가 어떤 카테고리를 봤는지» 라는 분석 신호가 흐려져 기각했다.
- **가상 필터 값 규약.** DB 상태 enum 은 네 값으로 두고 API 필터의 `status` 값 공간만 `expiring`·`attention` 두 가상 값으로 넓힌다. 가상 값 이름은 DB enum 과 겹치지 않아 칩 라벨의 단어가 그대로 URL 파라미터가 된다. 영속 상태와 화면 술어를 섞으면 상태 기계가 비대해지므로 enum 을 넓히지 않는다.
- **배너 톤과 이동.** 분해 카운트를 한 줄에 보여 어떤 카테고리가 몇 건인지 한눈에 보이게 한다. 오류가 있으면 점 색을 red 로 올려 문구를 읽기 전에 알아보게 한다. 합계가 1건이면 필터 단계가 쓸모없으므로 그 통합 상세로 바로 간다. 2건 이상은 필터가 필요한 일반 경우라 분기가 분명히 갈린다.

### 자동 갱신 통합을 주의 필요에서 뺀다

주의 필요와 만료 임박 술어는 원래 `token_expires_at <= NOW() + INTERVAL '7d'` 하나만 봤다. Cafe24 access token 수명은 2시간이라 이 술어가 늘 참이 되어, 자동 갱신이 정상인 통합도 사이드바 카운트와 배너와 `Expiring` 칩에 계속 들어갔다. 상세 헤더도 늘 «Expires today» 노란 톤이라 사용자가 갱신 실패로 잘못 읽었다. 백엔드 자동 갱신(`cafe24-token-refresh` 큐 워커, 6시간 주기 `cafe24-background-refresh`, `Cafe24ApiClient.ensureFreshToken` 호출 직전 갱신)은 모두 정상이라 사용자 조치가 필요 없었는데도 거짓 양성이었다.

그래서 응답에 파생 값 `autoRefresh` 를 두고 모든 주의 필요 술어(배너, 사이드바 카운트, `Expiring` 칩, `?status=expiring`·`?status=attention`)에서 `autoRefresh=true` 행을 만료 임박 분기에서 뺀다. 상세 헤더와 개요 탭은 자동 갱신 사실을 보조 라벨과 친화 표기로 알린다.

- **파생 값인 이유**: `autoRefresh` 는 DB 컬럼이 아니라 서비스 레지스트리의 `supportsTokenAutoRefresh` 에서 응답마다 계산한다(현재 `cafe24`·`google`·`makeshop` 이 true). 서비스 추가와 정책 변경이 잦은 영역이라 영속화하지 않고 코드 한 곳에서 정한다. 술어 SQL 에 `service_type IN ('cafe24', 'google')` 같은 하드코딩을 두는 안도 검토했다. 새 OAuth 제공자를 더할 때마다 SQL 을 고쳐야 하고, «왜 이 서비스를 빼는가» 라는 의도가 SQL 에 묻혀 기각했다.
- **실패 신호는 남는다**: 자동 갱신이 실패해 `error(auth_failed)`·`error(network)` 가 되면 상태가 `error` 라 이 술어와 상관없이 주의 필요에 들어간다. 조치 필요 알림도 따로 나간다.
- **통합 재인증 버튼은 막지 않는다**: 자동 갱신 통합에서도 개요의 통합 재인증은 활성으로 두고 hover 안내만 붙인다. 권한 범위 정리나 자격 증명 재발급처럼 사용자가 의도해 누를 가치가 있다. 설치 대기와 `install_timeout` 의 비활성(외부 흐름 진행 중, 진입점 없음)과는 이유가 다르다. 주의 필요 술어에서는 빼되 사용자의 명시 동작은 막지 않는다. 이 원칙은 서버가 통합 재인증을 시작할 수 있는 서비스에 한한다. MakeShop 은 통합 재인증 경로가 없어 버튼을 막고 삭제 후 재등록을 안내한다. App URL 이 없는 Cafe24 Private 행도 같은 이유로 막는다(2026-10-10).
- **기존 결정과의 관계**: «DB enum 은 넓히지 않고 영속 상태와 화면 술어를 나눈다» 는 원칙은 그대로다. `autoRefresh` 는 영속 상태가 아닌 파생 값이라 같은 원칙 안에서 술어를 합성한다. 설치 대기를 빼는 것도 같은 생각이다.

### 설치 대기는 필터 칩에 넣지 않는다

설치 대기는 사용자가 외부 흐름(Cafe24 개발자 센터, ShopStore)을 진행 중인 정상 전환 상태로 보고 상태 칩에 넣지 않는다. 따로 거를 수요가 생기면 후속 작업으로 검토한다.
