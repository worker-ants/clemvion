---
id: "CLE-WEBCHAT-SECURITY-ORIGIN"
title: "웹채팅 보안 — CORS와 임베드 검증"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-WEBCHAT-SECURITY"
ancestors: ["CLE-VISION", "CLE-IX", "CLE-WEBCHAT", "CLE-WEBCHAT-SECURITY"]
area: "CLE-WEBCHAT"
content_hash: "8befff5849c036cd0eda2016d87024829bfa10200514260287bd7127e4aa426e"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "3c3682f0fdcdb1d935e62daba9aab12a9bdcd13c6eadc44d9f2001bfd7d24497"
etag: "sha256-961cac54deb65581126bbcfe1779c6df1b35955f44ce8ace086a3c5e9f42755d"
---
## 개요

이 문서는 [웹채팅 보안](CLE-WEBCHAT-SECURITY.md) 의 하위 문서로 위젯과 BYO-UI 가 쓰는 두 공개 표면의 CORS 정책과 무단 임베드를 막는 임베드 검증을 정한다. 두 층은 같은 워크스페이스 설정 키 `interactionAllowedOrigins` 를 쓰지만 목적과 빈 목록의 뜻이 다르다. 공개 웹훅 남용 방어·sanitize·iframe sandbox 는 부모 문서가 정한다. 이 문서가 다루는 요구사항 줄은 부모 문서의 요구사항 절에 있다.

## CORS

위젯이 보내는 `Origin` 은 사용 모드에 따라 다르다([웹채팅 구조](CLE-WEBCHAT-ARCH.md)). Hosted iframe 모드는 위젯 배포 주소(고정), BYO-UI 모드는 고객 도메인(워크스페이스마다 다름)이다.

- `/api/hooks/*`: EIA 가 정한 대로 제한 없는 CORS 를 유지한다.
- `/api/external/*`: 워크스페이스 `interactionAllowedOrigins` 기준의 동적 허용 목록이다. 위젯 배포 주소는 모든 워크스페이스에 공통이라 빌트인 상수로 항상 허용하고, `interactionAllowedOrigins` 는 그 밖의 origin(BYO-UI 자기 도메인, 임베드 제어)을 더한다. EIA 의 "설정하지 않으면 막는다" 원칙([External Interaction API](../CLE-IX/CLE-EIA.md))과의 경계가 이것이다.

### 구현

백엔드는 단일 CORS 레이어(`main.ts` 의 `app.enableCors(webChatCorsDelegate)`)에서 경로별로 나눠 `Access-Control-Allow-Origin` 헤더 충돌 없이 라우트마다 다른 정책을 돌려준다(`codebase/backend/src/common/cors/web-chat-cors.ts` 의 `createWebChatCorsDelegate`).

- `/api/hooks/*`(`HOOKS_PATH_RE`): `origin: true`, `credentials: false`. 위젯과 BYO-UI 는 credential 없이 POST 한다.
- `/api/external/executions/:id` 와 그 하위 경로(`EXTERNAL_EXEC_PATH_RE`, 현재 정규식 `/^\/api\/external\/executions\/([^/?]+)/` 는 상태 조회 `GET /api/external/executions/:id` 도 포함한다): `:id` 로 실행 → 워크플로우 → 워크스페이스를 역으로 찾는다(`codebase/backend/src/modules/web-chat-cors/web-chat-cors-origin.resolver.ts`, 60초 TTL 캐시). `WEB_CHAT_WIDGET_ORIGINS` 와 `interactionAllowedOrigins` 의 합집합에 `Origin` 이 있으면 돌려주고 없거나 찾지 못하면 막는다. preflight(OPTIONS)에서도 경로 파라미터로 동작하므로 토큰 없이 동적 CORS 가 된다(`credentials: false`).
- 그 밖의 라우트(내부 `/api/*`, 워크스페이스 JWT): 프론트엔드 허용 목록 `CORS_ORIGINS` → `FRONTEND_URL` + `credentials: true`(`codebase/backend/src/common/utils/cors-origins.ts`).
- `interactionAllowedOrigins` 는 [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md)의 워크스페이스 설정 키다. 워크스페이스 관리 화면 개요 탭(관리자 이상) → `PATCH /api/workspaces/:id/settings` 로 편집한다.
- `WEB_CHAT_WIDGET_ORIGINS` 는 위젯 배포 주소 origin 의 백엔드 env 키다(콤마 구분, `main.ts` → `parseWidgetOrigins`). 워크스페이스와 무관하게 항상 허용하는 고정 목록이며 [웹채팅 구조](CLE-WEBCHAT-ARCH.md)가 이 키를 참조한다. 샘플은 `codebase/backend/.env.example` 에 있다.
- **프론트엔드와 API 를 다른 origin 으로 나눠 배포할 때 주의**: 프론트엔드(위젯 동봉 origin)와 API 를 다른 도메인(예: `app.example.com` 과 `api.example.com`, 운영의 `workflow.getit.co.kr` 과 `workflow-api.getit.co.kr`)으로 나누면 위젯이 same-origin 동봉이어도 위젯(프론트엔드 origin) → `/api/external/*`(API origin) 호출이 cross-origin 이 된다. 이때 프론트엔드 origin 을 반드시 `WEB_CHAT_WIDGET_ORIGINS` 에 넣어야 SSE 와 토큰 갱신이 CORS 를 통과한다. 빠지면 `/api/external/*` 응답에 `Access-Control-Allow-Origin` 이 없어 막힌다. `/api/hooks/*` 는 제한이 없어 대화 시작만 통과하고 위젯은 환영 메시지만 뜬 채 SSE 이벤트를 받지 못해 대화와 라이브 미리보기가 멈춘다. 이 키는 나눠 배포할 때와 엣지 CDN 을 쓸 때만 채운다. same-origin 단일 배포라면 필요 없다.

## 임베드 검증

"이 워크스페이스의 봇 위젯은 정해진 호스트 도메인에서만 임베드할 수 있다" 를 워크스페이스 단위로 제어하는 soft 컨트롤이다. 문서를 워크스페이스별로 동적 렌더링하지 않으므로([웹채팅 구조](CLE-WEBCHAT-ARCH.md)) CSP `frame-ancestors` 동적 삽입은 v1 기본이 아니다.

1. **클라이언트 임베드 검증(v1 기본)**: 부팅 때 위젯이 `GET /api/hooks/:endpointPath/embed-config` 로 허용 목록을 조회한다(`EmbedConfigDto { allowlist, enforce }`, `EmbedConfigService`). 전역 `TransformInterceptor` 가 `{ data }` 봉투로 감싸므로([HTTP API 규약](../CLE-API/CLE-API-CONV.md), [OpenAPI 문서화](../CLE-API/CLE-API-SWAGGER.md)) wire 본문은 `{ data: { allowlist, enforce } }` 이고 위젯이 `data` 를 벗긴다. 호스트 origin(`window.location.ancestorOrigins[0]`, 지원하지 않으면 `document.referrer`)이 맞지 않으면 렌더를 거부하고 시작을 막는다. 위젯 상태는 `blocked` 이며 호스트 `show` 로도 풀리지 않는 정책 거부다. 상태 정의는 [웹채팅 위젯](CLE-WEBCHAT-WIDGET.md), 부팅 순서 안의 위치는 [웹채팅 인증과 세션](CLE-WEBCHAT-SESSION.md)의 시퀀스 0단계다.
   - `enforce=false` 이거나 허용 목록이 비었으면 통과한다(fail-open).
   - 호스트 origin 을 알아낼 수 없을 때(iframe sandbox·프라이버시 설정으로 `ancestorOrigins`·`referrer` 모두 쓸 수 없음)도 통과한다. 환경 때문에 못 알아낸 정당한 사용자를 막지 않는다.
   - **`/embed-config` 엔드포인트(공개·무인증)**: 존재하지 않는 `endpointPath`, DB 에러, 인증 웹훅(`authConfigId` NOT NULL) 모두 HTTP 200 `{ data: { allowlist: [], enforce: false } }` 로 똑같이 응답해 존재 여부(enumeration)와 허용 목록이 새지 않는다. `Cache-Control: public, max-age=300` 이라 워크스페이스 설정 변경은 CDN·브라우저 캐시에 따라 최대 5분 뒤 반영된다.
   - 이 조회는 `/api/hooks/:endpointPath` 아래 경로지만 웹훅 진입 엔드포인트의 "POST 전용" 규칙의 예외가 아니라 범위 밖이다([웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md)).
2. **API soft 필터(선택)**: 웹훅 시작 요청의 호스트 origin 을 서버가 허용 목록과 비교해 거부한다.
3. **hard `frame-ancestors`(opt-in)**: 강제 차단이 꼭 필요한 워크스페이스만 동적 문서 제공 비용을 감수하고 쓴다.

워크스페이스 설정은 CORS 와 같은 `interactionAllowedOrigins` 키 하나를 쓰고 별도 키를 만들지 않는다. BYO-UI 모드는 "서빙 origin = 호출 origin" 이라 CORS 와 임베드가 같은 도메인을 가리키고, Hosted iframe 모드에서만 서빙(위젯 배포 주소)과 호스트(고객)가 갈린다.

> **빈 목록의 뜻(층마다 다르다)**: `interactionAllowedOrigins` 가 비면 (a) 임베드 검증은 `enforce=false` → 모두 허용한다. (b) `/api/external/*` CORS 는 위젯 배포 주소만 허용한다(EIA 의 "설정하지 않으면 막는다" 와 맞음). "빈 목록 = 전체 개방" 이 아니다.

## 구현 위치

- `codebase/backend/src/common/cors/web-chat-cors.ts` (경로별 CORS)
- `codebase/backend/src/modules/web-chat-cors/**` (실행 → 워크스페이스 origin 해석)
- `codebase/backend/src/modules/hooks/embed-config.service.ts` (임베드 설정 조회)
- `codebase/backend/src/modules/hooks/dto/responses/embed-config-response.dto.ts`

## Rationale

### CORS 를 두 공개 표면으로 나눈다

공개 위젯은 `/api/hooks/*` 에 credential 없이 POST 하므로 모든 origin 허용으로 충분하다(credential 을 실은 와일드카드를 브라우저가 막는 문제와 무관하다). 토큰을 쓰는 `/api/external/*`(interact·stream·refresh)만 동적 허용 목록으로 좁힌다. 한 정책으로 합치면 hooks 를 허용 목록으로 묶어 정당한 공개 호출이 깨지거나 external 을 모두 열어 토큰 표면이 과하게 드러난다. 경로별로 나눠 최소 권한과 호환성을 함께 채운다.

### 임베드 검증은 soft 가 기본이고 hard `frame-ancestors` 는 opt-in 이다

봇이 공개라 임베드 허용 목록은 가벼운 오남용 차단일 뿐이다. hard `frame-ancestors` 를 강제하려면 워크스페이스마다 문서를 동적으로 렌더링해야 하는데, 위젯은 정적 CDN 자산 하나로 배포해 캐시와 호스팅 이점을 얻는 구조라([웹채팅 구조](CLE-WEBCHAT-ARCH.md)) 동적 CSP 삽입은 그 이점을 깬다. 그래서 v1 기본은 클라이언트 임베드 검증이고 강제 차단은 동적 문서 비용을 감수하는 opt-in 이다.

**인증 웹훅은 embed-config 에서 뺀다**: 임베드 제어는 공개 봇 전용이다. 인증 웹훅은 브라우저 임베드가 아닌 서버 간 채널이라 통제 대상이 아니며 존재 여부도 드러내지 않는다.

**빈 목록이 층마다 다르게 동작하는 것은 의도다**: CORS 는 토큰 표면(`/api/external/*`)을 지키는 경계라 설정이 없으면 닫고(위젯 배포 주소만), 임베드 검증은 가벼운 오남용만 막는 soft 컨트롤이라 설정이 없으면 정당한 사용자를 막지 않도록 연다.
