# 보안(Security) 코드 리뷰

## 발견사항

### 파일 2: `backend/src/modules/integrations/third-party-oauth.controller.ts`

- **[WARNING]** 에러 응답에서 내부 예외 메시지가 그대로 노출될 수 있음
  - 위치: `cafe24Install` 핸들러 catch 블록 (라인 381~406)
  - 상세: `e.message ?? 'Install failed'` 패턴은 NestJS 예외 체인에서 파생된 임의 내부 메시지를 HTTP 응답 `message` 필드로 그대로 전달한다. 만약 하위 서비스에서 DB 연결 오류 문자열, 스택 경로, 또는 토큰 값 일부가 포함된 메시지를 throw하면 클라이언트(HTML 또는 JSON)에 그대로 노출된다.
  - 제안: catch 블록에서 예외 원인을 분류(known business error vs. unexpected)하고, 예상치 못한 예외는 서버 측 로거에만 기록하되 클라이언트에는 제네릭 메시지(`'Install failed'`)만 반환하도록 한다. `e.response?.code` 가 허용된 에러 코드 목록에 있을 때만 세부 정보를 노출하는 화이트리스트 방식이 적합하다.

- **[WARNING]** `oauthCallback` 핸들러의 catch 블록도 동일한 내부 메시지 노출 패턴
  - 위치: `oauthCallback` 핸들러 catch 블록 (라인 499~512)
  - 상세: `e.response?.message ?? e.message ?? 'OAuth failed'` 로 얻은 `message` 를 `renderCallbackHtml` 에 `error` 필드로 전달하며, 이 HTML 이 `postMessage` 페이로드로 부모 창에 전송된다. 예상치 못한 예외(DB 오류, 외부 API 오류 등)의 세부 메시지가 프론트엔드에 전달될 수 있다.
  - 제안: 알려진 OAuth 에러 코드(OAUTH_DENIED, OAUTH_STATE_MISMATCH 등)는 구조적으로 구분하고, 그 외 예외는 서버 로그에 상세를 남기고 클라이언트에는 `'OAuth failed'` 제네릭 메시지만 반환한다.

- **[INFO]** `install_token` 이 URL 경로에 포함되어 로그에 노출됨
  - 위치: `@Get('cafe24/install/:installToken')` 라우트 정의 및 주석 (라인 295~298)
  - 상세: 코드 자체에서도 주석으로 "install_token이 URL path에 노출되어 (logs / Referer) 추가 보호가 필요"함을 인지하고 있으며 Rate limit 으로 대응하고 있다. 토큰이 액세스 로그에 기록되면 인프라 운영자도 토큰을 볼 수 있다. `INSTALL_TOKEN_PATTERN` 검증과 DB 단일 행 조회로 토큰을 소비(1회성)하는 구조는 적절하지만, 로그 마스킹이 별도로 적용되지 않으면 불필요한 노출이 발생한다.
  - 제안: 웹 서버 액세스 로그에서 `/cafe24/install/:installToken` 경로의 토큰 부분을 마스킹하거나, 로그 레벨을 DEBUG로 제한하는 설정을 추가한다.

- **[INFO]** `isValidPostMessageOrigin` 함수의 경로 검사 로직 경계 케이스
  - 위치: `isValidPostMessageOrigin` 함수 (라인 534~551)
  - 상세: `parsed.pathname !== '/' && parsed.pathname !== ''` 조건으로 경로를 거부하나, `new URL('https://foo.com')` 의 경우 `pathname` 이 `'/'` 로 평가되어 올바르게 허용된다. `new URL('https://foo.com/')` 도 동일하게 `'/'`이다. 이 함수는 현재 올바르게 동작하고 있으나, URL 뒤에 포트가 붙는 케이스(`https://foo.com:8443`)도 `parsed.port`가 hostname에 분리되어 별도로 처리되므로 문제없다. 전반적으로 구현이 안전하다.
  - 제안: 현재 구현은 적절하다. 추가적으로 unit test에 `pathname` 이 있는 케이스를 포함하면 회귀 방지에 도움이 된다.

- **[INFO]** `provider` 파라미터에 대한 화이트리스트 검증은 적절히 구현됨
  - 위치: `oauthCallback` 핸들러 (라인 477~490)
  - 상세: `ALLOWED_OAUTH_PROVIDERS` 화이트리스트 기반 검증으로 임의 provider 값에 의한 오용이 차단된다. 문자열 비교 전에 타입 단언이 있으나, NestJS `@Param()` 데코레이터가 이미 string을 보장하므로 문제없다.
  - 제안: 현재 구현 적절. 변경사항 없음.

---

### 파일 9: `backend/src/nodes/presentation/carousel/carousel.schema.spec.ts`

- **[INFO]** `javascript:` 스킴 URL 차단 검증 테스트가 존재하며 보안 의식이 반영됨
  - 위치: `carousel.schema.spec.ts` 내 `'blocks disallowed URL schemes on link buttons'` 테스트 (라인 2279~2295)
  - 상세: `javascript:alert(1)` 과 같은 위험한 URL 스킴을 `validateCarouselConfig` 수준에서 차단하는 로직이 구현되어 있고, 이 테스트가 해당 방어를 검증한다. 프로덕션 코드의 `validateCarouselConfig` 에서 화이트리스트 기반 스킴 검사(`https://`, `http://` 등만 허용)가 이루어지는지 프로덕션 파일을 통해 추가 확인이 필요하다.
  - 제안: 현재 테스트 커버리지는 적절하다. 프로덕션 스키마에서 `vbscript:`, `data:` 등 다른 위험 스킴도 포함해 차단하는지 확인 권장.

---

### 나머지 파일들 (파일 1, 3, 4, 5, 6, 7, 8)

- **[INFO]** 변경 내용이 코드 포맷팅(코드 라인 재배열, 문자열 따옴표 스타일 통일)에 한정됨
  - 위치: `migrations.spec.ts`, `send-email.schema.spec.ts`, `if-else.schema.ts`, `parallel.schema.spec.ts`, `switch.schema.spec.ts`, `variable-declaration.schema.ts`, `variable-modification.schema.ts`
  - 상세: 모든 diff가 기능 변경 없는 순수 포맷팅(prettier 스타일 적용)이다. 로직 변경, 새로운 입력 처리, 보안 관련 코드 경로가 전혀 없다.
  - 제안: 보안 관점에서 검토 불필요.

---

## 요약

이번 변경 세트에서 실질적인 보안 위험은 `third-party-oauth.controller.ts` 에 집중된다. 가장 주목할 점은 `cafe24Install` 과 `oauthCallback` 두 핸들러의 catch 블록에서 예외의 `message` 필드를 여과 없이 HTTP 응답 또는 postMessage 페이로드로 전달하는 패턴이다. 이는 예상치 못한 내부 오류 발생 시 DB 오류 문자열, 파일 경로, 또는 민감한 데이터가 클라이언트에 노출될 수 있는 정보 누출(Information Disclosure) 위험이다. `isValidPostMessageOrigin` 함수는 wildcard 및 비-HTTPS origin을 명시적으로 거부하는 견고한 구현으로 postMessage 관련 CSRF/정보누출 위험을 잘 차단하고 있으며, provider 화이트리스트 검증과 Rate limiting 도 적절히 적용되어 있다. 나머지 파일들은 순수 포맷팅 변경으로 보안 위험이 없다.

## 위험도

MEDIUM
