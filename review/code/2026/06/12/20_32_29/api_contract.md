# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** Swagger UI 게이팅 변경 — production 기본 비노출 적용
  - 위치: `codebase/backend/src/main.ts`, `codebase/backend/src/common/config/production-guards.ts`
  - 상세: `isSwaggerEnabled()` 함수를 통해 production 환경에서 `/docs` 엔드포인트가 기본 비활성화된다. `ENABLE_SWAGGER_IN_PROD=true` opt-in 시에만 노출. 기존에 production 에서 `/docs` 에 접근하던 도구·클라이언트가 있다면 이제 도달 불가(마운트 자체 미실행). `swaggerEnabled` 변수를 부팅 1회 평가해 마운트·로그 두 곳이 동일 값을 공유하므로 판정 불일치 없음.
  - 제안: `/docs` 는 정규 API 엔드포인트가 아니므로 하위 호환성 파급은 없음. 배포 runbook에 `ENABLE_SWAGGER_IN_PROD` 옵션을 명시하는 것을 권장.

- **[INFO]** `/api/auth/refresh` CSRF 차단 — allowlist 외 Origin 에 403 반환
  - 위치: `codebase/backend/src/modules/auth/auth.controller.ts` (`refresh` 메서드)
  - 상세: 기존에는 Origin 검증 없이 쿠키 토큰만 확인했으나, 이제 `isOriginAllowed(origin)` 로 Origin 을 CORS allowlist 와 대조해 불허 Origin 에 `ForbiddenException`(HTTP 403)을 throw 한다. 미설정/undefined Origin(same-origin, non-browser 도구)은 그대로 통과. 기존에 비표준 Origin 으로 `/auth/refresh` 를 호출하던 클라이언트(예: 직접 API 호출 스크립트)가 영향을 받을 수 있다.
  - 제안: 의도된 보안 강화. `ForbiddenException` → HTTP 403 은 스펙에 적절하다. `CORS_ORIGINS` allowlist 에 포함된 합법적 클라이언트는 영향 없음.

- **[INFO]** refresh 쿠키 path 변경 — `/` 에서 `/api/auth` 로 축소
  - 위치: `codebase/backend/src/modules/auth/utils/refresh-cookie.ts`, `auth.controller.ts`
  - 상세: `COOKIE_PATH` 가 `'/'` 에서 `'/api/auth'` 로 좁혀졌다. set/clear 양쪽이 동일 path 를 사용하므로 clear 동작은 유지된다. `SameSite` 가 환경변수(`COOKIE_SAMESITE`) 로 분리되어 기본값 `'none'` 이 유지되므로, 기존 cross-site 클라이언트 동작은 변경 없음. 단, path 축소로 `/api/auth` 하위 이외의 경로에서 refresh 쿠키가 첨부되지 않는데, 다른 엔드포인트는 Bearer access token 기반이므로 실제 영향 없음.
  - 제안: 하위 호환성 영향 없음. 변경 적절.

- **[INFO]** WebSocket 채널 신규 추가 — `workflow:<uuid>`, `notifications:<userId>`
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts`
  - 상세: 두 채널 타입이 `channelAuthorizers` 에 추가됐다. `workflow:` 는 IDOR 차단, `notifications:` 는 emit 미구현 상태에서 fail-closed 선제 차단. 기존 채널(`execution:`, `kb:`, `background:run:`)의 subscribe 응답 형식(`{ event: 'subscribed', data: { success, error? } }`)은 그대로 유지된다. 인가 거부 시 에러 메시지 문자열(`'Not authorized for this workflow'`, `'Not authorized for these notifications'`)이 응답 body 에 포함되므로, 클라이언트 코드가 이 문자열을 파싱한다면 계약 고정이 필요하다.
  - 제안: 신규 채널 추가이므로 기존 클라이언트에 breaking change 없음. 거부 메시지 문자열을 클라이언트가 의존한다면 상수·enum 으로 정의하는 것을 권장.

- **[INFO]** `workflow:` 채널 — 비-UUID 입력 조기 거부
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` (`workflow:` authorizer)
  - 상세: `isValidUuid(workflowId)` 실패 시 DB 조회 없이 `{ error: 'Not authorized for this workflow' }` 를 반환한다(`execution:` authorizer 와 동형). ID enumeration 을 DB 레벨 전에 차단하는 defense-in-depth 이며, subscribe 오류 응답 형식이 기존 채널과 일관되게 유지된다.
  - 제안: 정상. 기존 채널 패턴과 일관됨.

- **[INFO]** ReDoS 방어 — 기존 regex 조건 평가 동작 변경 가능
  - 위치: `codebase/backend/src/nodes/core/condition-evaluator.util.ts`, `filter.handler.ts`, `transform.handler.ts`
  - 상세: 길이 200 이내라도 ReDoS-unsafe 패턴(예 `(a+)+$`)이 `compileUserRegex` 에서 거부되어 해당 조건이 no-match(silent false)로 처리된다. Filter 의 `meta.invalidRegexPatterns` 필드에 거부된 패턴이 포함되므로, API 응답(`{ output, meta }`)을 통해 클라이언트가 감지 가능. 기존에 우연히 동작하던 ReDoS-unsafe 패턴을 조건으로 사용 중인 워크플로는 평가 결과가 달라진다.
  - 제안: `meta.invalidRegexPatterns` 를 통한 가시화가 제공되므로 API 계약 위반은 없음. 영향 배포 시 운영자 공지 권장.

## 요약

이번 변경은 refactor-04-security 작업의 M-1(Swagger 게이팅), M-5(CSRF/쿠키 강화), M-6(WebSocket IDOR 차단), M-3(ReDoS 방어) 를 구현한다. 외부 REST API 의 URL 구조, HTTP 상태 코드 체계, 인증 방식(Bearer/쿠키 분리)은 변경되지 않았다. 주목할 API 계약 변화는 `/api/auth/refresh` 의 Origin 검증 추가(allowlist 외 Origin 에 HTTP 403)와 refresh 쿠키 path 축소(`/` → `/api/auth`)인데, 두 변경 모두 의도된 보안 강화이며 정규 클라이언트(allowlisted origin 으로 호출)에게는 영향이 없다. WebSocket subscribe 응답 형식은 변경 없이 유지되며, 신규 채널 타입 추가는 순수 additive 변경이다. ReDoS-unsafe 패턴의 silent no-match 처리는 Filter `meta.invalidRegexPatterns` 로 클라이언트가 감지 가능하다. 전반적으로 breaking change 없음.

## 위험도

NONE
