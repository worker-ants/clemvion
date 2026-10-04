---
id: "CLE-GLOSSARY-INT"
title: "용어 사전 — 통합"
type: "convention"
version: 2
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-GLOSSARY"
ancestors: ["CLE-VISION", "CLE-GLOSSARY"]
area: null
content_hash: "84792356481739968cac43221dd1d8c227e50b26b949e7681763cefd97f493e1"
read_as: "approved_fallback"
task: "CLE-T-V22XN8"
source_paths: []
mirror_sha256: "68f28379898915a3cada53ce14ddc760a1e6697296045f96bd243075184c39f5"
etag: "sha256-95238950b05b58d9a59b135b03a25c6c5626c698111a57a6d1e9381c4d1038d6"
---
## 개요

[용어 사전](CLE-GLOSSARY.md) 의 「통합」 영역 용어다. 표기 원칙 · 약어 · 상태값 표기와 표의 열 순서는 [용어 사전](CLE-GLOSSARY.md) 에 있다. 여러 영역에 걸친 같은 말은 [용어 사전 — 다의어 구분](CLE-GLOSSARY-POLY.md) 이 가른다.

표의 카탈로그 키 링크(`CLE-C24*` · `CLE-MKS*`)는 저장소 미러에 없는 NERV 문서다. 카탈로그 정본은 저장소 `codebase/api-catalogs/` 이고 NERV 문서는 그 사본이다.

## 용어

| 표준 용어 | 영문 · 코드 식별자 | 정의 | 쓰지 않는 표기 | 기준 문서 |
| --- | --- | --- | --- | --- |
| 통합 | Integration, `integration` | 외부 서비스 자격 증명과 연결 상태를 워크스페이스에 저장한 것. 노드와 AI 에이전트가 참조한다. | 연동, 외부 통합, Integration(본문) | [통합 관리](CLE-INT/CLE-INT-MANAGE.md) |
| 서비스 유형 | `service_type` | 통합이 연결하는 외부 서비스의 유형(google, github, http, database, email, webhook, mcp, cafe24, makeshop). 화면 라벨은 "서비스" 다. | serviceType(본문), 서비스 종류 | [서비스별 인증 방식과 자격 증명](CLE-INT/CLE-INT-AUTH.md) |
| 통합 인증 유형 | `auth_type` | 서비스별 인증 방식(oauth2, api_key, bearer_token, basic, connection_string, smtp, webhook_outbound, none). 화면 라벨은 "인증 유형" 이다. | 인증 방식(이 뜻으로) | [서비스별 인증 방식과 자격 증명](CLE-INT/CLE-INT-AUTH.md) |
| 자격 증명 | credentials | 외부 시스템에 접근하는 비밀 값 묶음. 통합은 이를 암호화해 저장하고 응답에서 가린다. | 자격증명, 인증 정보, credential(s)(본문) | [서비스별 인증 방식과 자격 증명](CLE-INT/CLE-INT-AUTH.md) |
| 공개 범위 | `Integration.scope` | 통합을 누가 쓸 수 있는지 정하는 값. 개인(`personal`)은 만든 사람만, 조직(`organization`)은 워크스페이스 멤버 전체가 쓴다. | scope(본문), 공유 범위, 범위 전환, Organization-scope, (Org) | [통합 관리](CLE-INT/CLE-INT-MANAGE.md) |
| 권한 범위 | OAuth scope, `credentials.scopes` | OAuth 동의로 받은 권한 목록. 화면 탭 이름은 "권한" 이다. | scope(본문), 사용 권한 scope | [OAuth 연결과 토큰 갱신](CLE-INT/CLE-INT-OAUTH.md) |
| 통합 소유자 | `created_by` | 개인 통합을 보고 바꿀 수 있는 유일한 사용자. 역할이 높아도 남의 개인 통합은 다루지 못한다. | 본인, 생성자 | [통합 관리](CLE-INT/CLE-INT-MANAGE.md) |
| 통합 상태 | `Integration.status` | 통합의 연결 상태. 값과 화면 라벨은 [용어 사전](CLE-GLOSSARY.md) 의 「상태값과 enum 표기」 에 있다. | 없음 | [통합 상태와 만료 알림](CLE-INT/CLE-INT-STATUS.md) |
| 상태 사유 | `status_reason` | 상태의 이유를 남기는 snake_case 코드. 값은 [용어 사전](CLE-GLOSSARY.md) 의 「상태값과 enum 표기」 에 있다. | 없음 | [통합 상태와 만료 알림](CLE-INT/CLE-INT-STATUS.md) |
| 만료 임박·주의 필요 | `expiring`, `attention` | DB 에 없는 화면 필터 값. 만료 임박은 만료가 가까운 연결이다. 주의 필요는 만료됨·오류·만료 임박을 합친 것이다. | Need attention(본문) | [통합 상태와 만료 알림](CLE-INT/CLE-INT-STATUS.md) |
| 연결 테스트 | test connection | 저장한 자격 증명으로 외부 서비스 접속을 확인하는 기능. 저장하기 전에 하는 것은 "저장 전 연결 테스트(`preview-test`)" 다. | ping, 사전 검증(이 뜻으로) | [통합 관리](CLE-INT/CLE-INT-MANAGE.md) |
| 통합 재인증 | reauthorize | OAuth 통합의 토큰을 새로 받아 되살리는 동작. OAuth 가 아닌 통합은 바로 연결됨으로 되돌린다. | 재인가, Reauthorize(본문), 재연결, 재인증(단독) | [OAuth 연결과 토큰 갱신](CLE-INT/CLE-INT-OAUTH.md) |
| 자격 증명 교체 | rotate credentials, `rotate` | OAuth 가 아닌 통합의 자격 증명을 새 값으로 바꾸는 동작. 연결 테스트를 통과해야 저장한다. | 자격 증명 회전, Rotate credentials, 회전(이 뜻으로) | [통합 관리](CLE-INT/CLE-INT-MANAGE.md) |
| 추가 권한 요청 | request scopes, `request-scopes` | 이미 있는 통합에 OAuth 권한을 더 받는 흐름. | Scope 추가 요청 | [OAuth 연결과 토큰 갱신](CLE-INT/CLE-INT-OAUTH.md) |
| 사용처 | usages, `usageKind` | 통합을 참조하는 워크플로우 노드 목록. 직접 참조(`direct`)와 MCP 참조(`mcp`)를 합친다. 화면 탭 이름은 "사용" 이다. | Usage 탭(개념 이름으로) | [통합 관리](CLE-INT/CLE-INT-MANAGE.md) |
| 삭제 차단 | delete blocked | 사용처가 남은 통합을 지우지 못하게 막는 규칙. | 없음 | [통합 관리](CLE-INT/CLE-INT-MANAGE.md) |
| 활동 로그 | activity log, `IntegrationUsageLog` | 노드가 통합을 부를 때마다 남기는 성공·실패·소요 시간 기록. 보존 기간이 있다. 화면 탭 이름은 "활동" 이다. | 사용 로그, usage log, Recent activity, 최근 호출 이력 | [통합 데이터와 흐름](CLE-INT/CLE-INT-DATA.md) |
| 호출 API 라벨 | `api_label` | 활동 로그에 남기는 호출 대상 식별자. Cafe24·MakeShop 은 카탈로그 키를 쓴다. | 없음 | [통합 데이터와 흐름](CLE-INT/CLE-INT-DATA.md) |
| OAuth 연결 흐름 | OAuth begin, callback | 팝업에서 OAuth 제공자 동의를 받고 콜백으로 토큰을 받는 흐름. | 없음 | [OAuth 연결과 토큰 갱신](CLE-INT/CLE-INT-OAUTH.md) |
| OAuth 제공자 | OAuth provider | 통합이 OAuth 동의를 받는 외부 서비스. 화면 라벨은 "제공자" 다. | 프로바이더(이 뜻으로) | [OAuth 연결과 토큰 갱신](CLE-INT/CLE-INT-OAUTH.md) |
| 통합 OAuth state | `integration_oauth_state` | 통합 연결의 인가 요청과 콜백을 짝짓는 일회용 행. 수명이 짧다. 소셜 로그인의 `auth_oauth_state` 와 다른 테이블이다. | OAuth state(단독) | [OAuth 연결과 토큰 갱신](CLE-INT/CLE-INT-OAUTH.md) |
| 미리보기 토큰 | `previewToken`, `integration_oauth_preview` | 새 OAuth 연결이 통합을 만들기 전까지 토큰을 맡겨 두는 수명이 짧은 참조. | integrationPreviewId, oauth_preview | [OAuth 연결과 토큰 갱신](CLE-INT/CLE-INT-OAUTH.md) |
| 토큰 자동 갱신 | token refresh | 만료가 다가오거나 401 을 받으면 OAuth 토큰을 새로 받는 동작. 갱신 경로는 `proactive`, `background`, `reactive_401` 세 가지다. | 401 자가 회복, 401 자동 회복 | [OAuth 연결과 토큰 갱신](CLE-INT/CLE-INT-OAUTH.md) |
| 자동 갱신 표시 | `autoRefresh` | 화면에 "Auto-renews" 를 보일지 정하는 응답 전용 값. 만료 스캐너의 갱신 가능 판정(`isRefreshCapable`)과 대상이 다르다(결정 항목 D41). | 없음 | [통합 상태와 만료 알림](CLE-INT/CLE-INT-STATUS.md) |
| 만료 스캐너 | `integration-expiry-scanner` | 토큰 만료·설치 기한·활동 로그 보존·Cafe24 백그라운드 갱신을 주기적으로 처리하는 작업 묶음. | 일일 스캐너, 매일 스캐너 | [통합 상태와 만료 알림](CLE-INT/CLE-INT-STATUS.md) |
| 만료 알림·조치 필요 알림 | `integration_expired`, `integration_action_required` | 통합이 만료 임계에 닿을 때와 오류로 바뀔 때 보내는 인앱 알림 두 종류. | passive 알림, active 알림 | [통합 상태와 만료 알림](CLE-INT/CLE-INT-STATUS.md) |
| 연속 네트워크 실패 | `consecutive_network_failures` | 노드 실행 중 연결 실패가 이어진 횟수. 정한 횟수에 이르면 통합 상태가 오류로 바뀐다. | 없음 | [통합 상태와 만료 알림](CLE-INT/CLE-INT-STATUS.md) |
| 설치 우선 흐름 | install-first | Cafe24 Private 앱과 MakeShop 이 외부 마켓 앱 설치로 연결을 시작하는 흐름. 통합은 설치 대기 상태로 먼저 생긴다. | 없음 | [OAuth 연결과 토큰 갱신](CLE-INT/CLE-INT-OAUTH.md) |
| 설치 토큰 | `install_token` | App URL 경로에 들어가 설치 대기 통합을 가리키는 토큰. | 없음 | [OAuth 연결과 토큰 갱신](CLE-INT/CLE-INT-OAUTH.md) |
| App URL·Redirect URI | `appUrl`, `callbackUrl` | 외부 마켓이 설치할 때 부르는 우리 서버 주소와 OAuth 콜백 주소. | 앱 URL | [OAuth 연결과 토큰 갱신](CLE-INT/CLE-INT-OAUTH.md) |
| 설치 시간 초과 | `install_timeout` | 정한 기한 안에 설치가 끝나지 않아 만료된 사유. Cafe24 Private 앱과 MakeShop 에 모두 적용한다. | 없음 | [통합 상태와 만료 알림](CLE-INT/CLE-INT-STATUS.md) |
| Cafe24 앱 유형 | `app_type`: public, private | Public 앱은 서버가 가진 공용 클라이언트를, Private 앱은 사용자가 입력한 클라이언트를 쓴다. | 미심사 앱, 비공개 앱, 앱스토어 등록 앱 | [OAuth 연결과 토큰 갱신](CLE-INT/CLE-INT-OAUTH.md) |
| 테스트 실행(Cafe24) | Test run | Cafe24 개발자 센터에서 Private 앱 설치를 시작하는 버튼. 에디터의 실행과 다르다. | 없음 | [OAuth 연결과 토큰 갱신](CLE-INT/CLE-INT-OAUTH.md) |
| 상점 식별자 | store identifier, `mall_id` | 외부 쇼핑몰의 상점 ID. Cafe24 는 `mall_id`, MakeShop 은 `shop_uid` 값을 같은 `mall_id` 컬럼에 둔다. | store-identifier, 매장 식별자 | [통합 데이터와 흐름](CLE-INT/CLE-INT-DATA.md) |
| 중복 사전 감지 | precheck | 상점 식별자를 입력할 때 같은 상점 통합이 이미 있는지 미리 알려 주는 조회. | 없음 | [통합 관리](CLE-INT/CLE-INT-MANAGE.md) |
| 통합 선택기 | `IntegrationSelector` | 노드 설정 패널의 통합 선택 드롭다운. | Integration 선택 드롭다운 | [통합 노드 공통](CLE-NODE-INT/CLE-NODE-INT-COMMON.md) |
| 삭제된 통합 표시 | Missing integration | 지워진 통합을 참조하는 노드에 캔버스가 붙이는 경고. | 없음 | [통합 노드 공통](CLE-NODE-INT/CLE-NODE-INT-COMMON.md) |
| 통합 암호화 키 | `INTEGRATION_ENCRYPTION_KEY` | 통합 자격 증명 컬럼을 암호화하는 키. 시크릿 저장소의 `ENCRYPTION_KEY` 와 다르다(결정 항목 D40). | 없음 | [시크릿 저장소](CLE-INT/CLE-INT-SECRET.md) |
| 사설망 허용 플래그 | `ALLOW_PRIVATE_HOST_TARGETS` | 셀프 호스팅에서 사설망 주소 차단을 끄는 설정. MCP 는 `MCP_ALLOW_INSECURE_URL` 을 따로 쓴다. | 없음 | [통합 노드 공통](CLE-NODE-INT/CLE-NODE-INT-COMMON.md) |
| 시크릿 저장소 | SecretStore, `secret_store` | 비밀을 AES-256-GCM 으로 암호화해 보관하고 `secret://` 참조로 가리키는 저장소. 통합 자격 증명과 인증 설정은 여기 두지 않는다. | Secret Store, secret store(본문) | [시크릿 저장소](CLE-INT/CLE-INT-SECRET.md) |
| 시크릿 참조 | secret ref, `secret://<scope>/<id>/<name>` | 시크릿 저장소 값을 가리키는 문자열. | ref(단독) | [시크릿 저장소](CLE-INT/CLE-INT-SECRET.md) |
| SecretResolver | `SecretResolver` | 시크릿 저장소를 읽고 쓰는 유일한 서비스. | 없음 | [시크릿 저장소](CLE-INT/CLE-INT-SECRET.md) |
| 저장소 예외 필드 | non-target fields | 시크릿 저장소 밖에 두기로 정한 비밀(인증 설정 `config`, 트리거 단위 토큰, 알림 서명 시크릿 v2 컬럼). 응답 노출 예외는 아니다. | 비대상(단독) | [시크릿 저장소](CLE-INT/CLE-INT-SECRET.md) |
| 24시간 유예 | 24h grace | 비밀을 바꾼 뒤 옛 값과 새 값을 함께 받는 기간. 이름의 시간은 기준 문서의 값이다. | 없음 | [시크릿 저장소](CLE-INT/CLE-INT-SECRET.md) |
| MCP | Model Context Protocol | LLM 이 쓸 도구·리소스를 외부 서버가 제공하는 프로토콜. 번역하지 않는다. | 없음 | [MCP 클라이언트](CLE-INT/CLE-INT-MCP.md) |
| 외부 MCP 서버 | MCP server, `service_type=mcp` | Streamable HTTP 로 연결하는 외부 MCP 통합. | Generic MCP server | [MCP 클라이언트](CLE-INT/CLE-INT-MCP.md) |
| 내부 MCP 브리지 | Internal MCP Bridge | Cafe24·MakeShop 통합을 외부 서버 없이 서버 프로세스 안에서 MCP 도구로 노출하는 방식. | Internal Bridge, MCP Bridge, MCP bridge, in-process bridge | [MCP 클라이언트](CLE-INT/CLE-INT-MCP.md) |
| MCP 지원 통합 | MCP-capable Integration | AI 에이전트 `mcpServers` 가 받는 통합. 외부 MCP 서버와 내부 MCP 브리지 통합을 함께 이른다. | MCP 서버(이 뜻으로) | [MCP 클라이언트](CLE-INT/CLE-INT-MCP.md) |
| 노출 도구 목록 | `enabledTools` | MCP 지원 통합마다 AI 에이전트에 보여 줄 도구를 좁히는 목록. 비어 있으면 전부 노출한다. | allowlist(본문) | [MCP 클라이언트](CLE-INT/CLE-INT-MCP.md) |
| 도구 설명 덮어쓰기 | `mcpServers[].toolOverrides` | MCP 도구의 설명을 바꾸는 설정. AI 에이전트 최상위의 옛 `toolOverrides` 는 제거했다. | 없음 | [MCP 클라이언트](CLE-INT/CLE-INT-MCP.md) |
| 도구 프로바이더 | `AgentToolProvider` | AI 에이전트 안에서 도구를 만들고 실행하는 구현 단위(지식 저장소·MCP·Cafe24·MakeShop). | provider(이 뜻으로 단독) | [MCP 클라이언트](CLE-INT/CLE-INT-MCP.md) |
| MCP 진단 | `meta.mcpDiagnostics` | AI 노드 출력에 남는 MCP 서버별 연결·호출 진단. | 없음 | [MCP 클라이언트](CLE-INT/CLE-INT-MCP.md) |
| Cafe24 | Cafe24, `cafe24` | Cafe24 쇼핑몰의 Admin API 통합. | 카페24(본문) | [Cafe24](CLE-C24) |
| MakeShop | MakeShop, `makeshop` | MakeShop 쇼핑몰의 Shop API 통합. | Makeshop, 메이크샵(본문) | [MakeShop](CLE-MKS) |
| Cafe24 리소스 | `Cafe24Resource` | Cafe24 Admin API 의 최상위 분류(store, product, order 등). | 카테고리(이 뜻으로), 18 카테고리 | [Cafe24 operation 메타데이터](CLE-C24-META) |
| MakeShop 섹션 | `MakeshopResource` | MakeShop Shop API 의 최상위 분류. 노드 설정에서는 resource 값이다. | 없음 | [MakeShop operation 메타데이터](CLE-MKS-META) |
| operation | operation, `Cafe24OperationMetadata` | 외부 API 호출 하나(메서드와 경로). 노드의 Operation 드롭다운 값이자 MCP 도구 하나다. | endpoint(같은 뜻으로), op(약어로) | [Cafe24 operation 메타데이터](CLE-C24-META) |
| operation ID | `id`, `operationId` | operation 식별자. Cafe24 는 우리가 정한 snake_case, MakeShop 은 공식 원형을 쓴다. | 없음 | [Cafe24 operation 메타데이터](CLE-C24-META) |
| 카탈로그 키 | catalog key, `cafe24.<resource>.<operation>` | 활동 로그와 드롭다운 라벨 조회에 쓰는 operation 문자열. | labelKey(본문) | [Cafe24 operation 메타데이터](CLE-C24-META) |
| API 카탈로그 | API catalog | 외부 쇼핑몰 API 의 operation 을 전부 적은 참조 문서 묶음. 행 목록 파일과 필드 수준 파일 두 층이다. | API 레퍼런스 카탈로그 | [Cafe24](CLE-C24) |
| 카탈로그 상태 | catalog status | 카탈로그 행의 구현 상태. 값은 [용어 사전](CLE-GLOSSARY.md) 의 「상태값과 enum 표기」 에 있다. 스펙 문서 상태와 다른 값이다. | 없음 | [Cafe24 operation 메타데이터](CLE-C24-META) |
| 카탈로그 동기 검사 | `catalog-sync` | 카탈로그 행과 백엔드 operation 메타데이터가 서로 맞는지 빌드에서 확인하는 검사. | 동기 보호, Sync Contract | [Cafe24 operation 메타데이터](CLE-C24-META) |
| 별도 승인 | restricted approval, `restrictedApproval` | Cafe24 가 따로 승인한 클라이언트만 쓸 수 있는 권한·operation 표시. 막지 않고 경고만 한다. | restricted scope, 본사 승인, partner approval | [Cafe24 별도 승인 scope](CLE-C24-SCOPES) |
| 조건부 필수 제약 | `constraints` | 필수 필드 목록으로 표현하지 못하는 OR·짝·함의 제약. | conditional constraints | [Cafe24 operation 메타데이터](CLE-C24-META) |
| Cafe24 요청 봉투 | request envelope | Cafe24 POST·PUT 본문을 `{ shop_no, request }` 로 감싸는 규칙. 노드 출력과 무관하다. | envelope(단독) | [Cafe24 operation 메타데이터](CLE-C24-META) |
| x-scope | `x-scope` | MakeShop operation 이 속한 권한 그룹(한글 그룹명). 실제 권한 토큰(`store.read` 등)과 다르다. | 없음 | [MakeShop operation 메타데이터](CLE-MKS-META) |
| 적립금·예치금 | points, credits, reserve, emoney | 쇼핑몰 회원 혜택 금액. Cafe24 는 mileage 리소스의 points·credits, MakeShop 은 reserve·emoney 다. MakeShop 의 "포인트" 는 적립금과 다른 개념이다. | 포인트(Cafe24 points 번역으로) | [Cafe24](CLE-C24) |

## Rationale

2026-10-02 에 [용어 사전](CLE-GLOSSARY.md) 한 문서의 「통합」 절에서 옮겼다. 나눈 이유와 표준을 고른 기준은 그 문서의 Rationale 에 있다.

### 정의 보정 (2026-10-03)

NERV Task `CLE-T-V22XN8` 가 정한 정의 보정을 반영했다.

- 개요의 안내 문단(영역 소개 · 열 순서)과 Rationale 의 분할 설명을 색인을 가리키는 한 줄로 줄였다. 같은 문단이 하위 문서 열 곳에 복사돼 있었다.
- 금지어를 정의에서 뺐다. 「서비스 유형」 의 「서비스 종류」, 「Cafe24」 · 「MakeShop」 의 한국어 서비스명, 「별도 승인」 의 「본사 승인」 이다(표기 원칙 6 · 12).
- 「자동 갱신 표시」 · 「통합 암호화 키」 의 결정 항목에 번호를 붙였다. D41(「자동 갱신」 의 두 판정), D40(통합 자격 증명 암호화 키 이름)이다.
- 정의에서 기준 문서의 수치(만료 임계 · 보존 기간 · 수명 · 횟수 · 토큰 길이 · 분류 개수)를 뺐다(색인 표기 원칙 14).
- 「통합 상태」 · 「상태 사유」 · 「카탈로그 상태」: 값 목록을 지우고 색인 「상태값과 enum 표기」 를 가리킨다.
- 개요에 카탈로그 키 링크가 저장소 미러에 없는 NERV 사본을 가리킨다고 적었다.
