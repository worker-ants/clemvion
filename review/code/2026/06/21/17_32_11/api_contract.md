# API 계약(API Contract) 리뷰 결과

## 개요

변경 대상: M-2 IntegrationOAuthService provider 별 OAuthProviderStrategy 분리 (refactor).

이 변경은 `IntegrationOAuthService` 내부의 OAuth 프로토콜 로직을 provider 별 strategy 클래스로 분리하는 **순수 내부 리팩터링**이다. 커밋 메시지가 명시하듯 "외부 동작·API 계약 불변"이며, facade 클래스명·엔드포인트·요청/응답 형식·에러 코드·HTTP 상태 코드가 모두 유지된다.

---

## 발견사항

### [INFO] re-export 를 통한 기존 import 경로 보존 — 의도적이고 올바른 처리
- 위치: `integration-oauth.service.ts` 상단 88~89행
- 상세: `ALLOWED_OAUTH_PROVIDERS`, `OAuthProvider`, `Cafe24BeginMeta`, `MakeshopBeginMeta` 등 기존에 facade 에서 직접 export 하던 심볼들을 `oauth-providers/index.ts` 에서 canonical 정의한 후 facade 에서 re-export 유지한다. 컨트롤러·테스트의 기존 import 경로가 깨지지 않는다.
- 제안: 현재 처리가 적절하다. 추후 마이그레이션이 완료되면 facade re-export 를 제거하고 소비 측이 `oauth-providers` 에서 직접 import 하도록 점진적으로 정리할 수 있으나 현 시점 필수 아님.

### [INFO] 에러 코드·HTTP 상태 코드 동일성 확인됨 — breaking change 없음
- 위치: `cafe24-oauth.strategy.ts`, `cafe24-private.strategy.ts`, `cafe24-public.strategy.ts`, `makeshop.strategy.ts`, `standard-oauth.strategy.ts`
- 상세: 각 strategy 가 던지는 예외(`BadRequestException`, `InternalServerErrorException`)와 그 `code` 문자열(`CAFE24_INVALID_MALL_ID`, `CAFE24_PRIVATE_APP_CREDENTIALS_REQUIRED`, `OAUTH_CONFIG_MISSING`, `MAKESHOP_CREDENTIALS_REQUIRED`, `MAKESHOP_PKCE_REQUIRED`)이 리팩터링 이전 facade 인라인 코드와 동일하다. HTTP 400/500 매핑이 유지된다.
- 제안: 해당 없음.

### [INFO] TokenExchangeResult 인터페이스 이동 — 내부 타입, 외부 API 응답 아님
- 위치: `oauth-provider-strategy.ts` 1630~1637행 (신설), `integration-oauth.service.ts` 180~187행 (삭제)
- 상세: `TokenExchangeResult` 는 서비스 내부 구현 타입으로 외부 클라이언트에 직접 노출되지 않는다. HTTP 응답 스키마와 무관하다.
- 제안: 해당 없음.

---

## 요약

이 변경은 `IntegrationOAuthService` facade의 외부 API 계약(HTTP 엔드포인트 URL, 요청 파라미터, 응답 형식, 에러 코드, HTTP 상태 코드, 인증/인가 적용 방식)을 전혀 변경하지 않는 순수 내부 리팩터링이다. OAuth 프로토콜 결정(authorize URL 생성·scope 구분자·Basic auth vs body 인증·PKCE·토큰 만료 파싱·stub 결과)이 strategy 클래스로 이전되었으나, facade가 이를 위임하는 방식이기 때문에 기존 API 클라이언트 영향이 없다. 기존 테스트 import 심볼도 re-export 로 보존된다. breaking change 없음.

## 위험도

NONE

---

STATUS=success ISSUES=0
