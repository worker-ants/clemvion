# 보안(Security) 리뷰 결과

## 발견사항

- **[INFO]** HMAC prefix 충돌 — 문서화된 trade-off이나 보안 의미 명시 필요
  - 위치: `codebase/backend/src/modules/integrations/cafe24-install-nonce-cache.service.spec.ts` 라인 556–581
  - 상세: nonce 캐시 키에 HMAC 전체가 아닌 앞 8자(prefix)만 사용하는 설계가 테스트 코드에 명시적으로 문서화되어 있다. 테스트 주석은 "충돌 확률 64^8 = 2.8e14로 사실상 무시 가능"이라고 기술하지만, HMAC 값을 공격자가 반복 제출할 수 있는 시나리오에서 prefix 8자 충돌을 의도적으로 유발하면 정상적인 인스톨 요청이 replay로 잘못 판별될 수 있다(서비스 거부성 오용). 이는 **무결성 보호**가 아닌 **재전송(replay) 방어**가 목적인 nonce 캐시에서 키 공간이 단축된 것이며, 보안 가정이 코드·spec 문서 양쪽에 명확히 기록되어 있지 않을 경우 추후 변경 시 오해 소지가 있다.
  - 제안: nonce 키 구성 함수(프로덕션 코드)에 `// SECURITY NOTE: only first 8 chars of HMAC used as key suffix; see W-39 for rationale` 형태의 인라인 주석을 추가하여 의도적 trade-off임을 명확히 하고, spec 문서(cafe24 install nonce 관련 섹션)에도 해당 설계 결정을 기록한다.

- **[INFO]** Redis 오류 시 graceful degradation — replay 허용 fallback 동작이 명시적으로 문서화 필요
  - 위치: `codebase/backend/src/modules/integrations/cafe24-install-nonce-cache.service.spec.ts` 라인 503–511
  - 상세: Redis 연결 오류(`ECONNREFUSED`) 발생 시 `isReplay()`가 항상 `false`를 반환하도록 설계되어 있다. 이는 Redis 장애 시 replay 방어가 우회되는 것을 의미한다. 테스트는 이 동작을 "옛 정책(±5분 윈도우만)으로 fallback"이라고 주석 처리하고 있으나, 해당 fallback이 실제로 타임스탬프 기반 ±5분 윈도우 검증만으로 동작하는지, 아니면 모든 요청을 허용하는지 테스트만으로는 불명확하다. Redis 없이 동작 시 보안 수준 저하가 의도적 설계 결정인지 확인이 필요하다.
  - 제안: graceful degradation 시의 보안 수준(타임스탬프 범위 검증만 수행 vs. 전체 허용)을 spec과 코드 주석에 명시한다. 모니터링 알림 등을 통해 Redis 장애를 즉시 감지하도록 권장한다.

- **[INFO]** `cors-origins.spec.ts` — wildcard fallback 동작이 테스트에서 허용됨
  - 위치: `codebase/backend/src/common/utils/cors-origins.spec.ts` 라인 187–188
  - 상세: `CORS_ORIGINS` 미설정 + `FRONTEND_URL` 미설정 시 `getAllowedOrigins()`가 `['*']`를 반환하는 동작이 테스트에서 명시적으로 검증된다. 이 자체는 개발/테스트 환경 편의를 위한 설계이나, production 환경에서 wildcard가 반환될 경우 모든 origin에서의 요청이 허용된다. `assertCorsOriginsConfigured()`가 production에서 wildcard를 throw하는 로직(`라인 274–277`)은 올바른 방어선이나, 해당 함수가 실제로 앱 부트스트랩 시 반드시 호출되는지 확인이 필요하다.
  - 제안: `assertCorsOriginsConfigured()`가 NestJS 앱 bootstrap 또는 미들웨어 초기화 시점에 반드시 호출되는지 검토하고, 해당 호출이 누락될 경우 production wildcard CORS가 묵인될 수 있으므로 e2e 또는 smoke 테스트로 보장 여부를 확인한다.

- **[INFO]** `integrations.service.ts` — `pending_install` 상태 가드의 에러 메시지 노출
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` 라인 868–875
  - 상세: `pending_install` 상태일 때 반환하는 에러 응답의 `message` 필드에 내부 상태명(`pending_install`)이 그대로 포함된다(`'Integration is in pending_install state — complete the install flow before testing the connection.'`). 이 메시지가 API 응답으로 클라이언트에 그대로 전달될 경우 내부 상태 모델 정보가 외부에 노출된다. 현재 코드에서 이 응답이 HTTP 레이어에서 어떻게 직렬화되는지(별도 변환 레이어가 있는지) 확인이 필요하다.
  - 제안: 클라이언트에 노출되는 에러 메시지는 내부 상태명 대신 사용자 친화적 메시지(`'Integration setup is not complete. Please finish the installation process before testing the connection.'`)로 변환하거나, 내부 메시지와 외부 메시지를 분리하는 레이어를 확인한다.

- **[INFO]** `websocket.service.spec.ts` — `sanitizePayloadForWs`의 credential 키 매칭 패턴이 테스트 코드에서만 확인됨
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.spec.ts` 라인 1013–1034
  - 상세: WebSocket 페이로드 새니타이징이 `api_key` 같은 특정 키 이름 패턴으로만 동작한다. 테스트는 `api_key`와 `otherField`만 검증하며, `password`, `token`, `secret`, `access_token`, `refresh_token`, `client_secret` 등 다른 credential 패턴에 대한 테스트가 없다. 매칭 패턴이 불충분하면 민감 정보가 WebSocket 채널로 그대로 전달될 수 있다.
  - 제안: `sanitizePayloadForWs`의 매칭 패턴 목록(프로덕션 코드)을 검토하고, `password`, `token`, `secret`, `access_token`, `refresh_token`, `client_secret`, `private_key` 등 추가 패턴에 대한 테스트를 보강한다.

## 요약

이번 변경은 대부분 코드 포매팅(줄 길이 준수)과 테스트 커버리지 추가가 목적이며, 실질적인 보안 로직 변경은 `integrations.service.ts`의 `pending_install` 가드 추가와 `integrations.service.spec.ts`의 해당 테스트 보강에 집중되어 있다. `pending_install` 가드는 토큰이 발급되지 않은 상태에서 외부 프로브를 차단하는 적절한 방어선으로, 전반적인 구현 방향은 보안 측면에서 올바르다. 다만 nonce 캐시의 HMAC prefix 8자 설계, Redis 장애 시 replay 방어 우회, WebSocket 페이로드 새니타이징 패턴 완전성, CORS wildcard fallback 호출 보장 여부는 운영 환경에서 확인이 필요한 INFO 수준 항목이다. CRITICAL 또는 WARNING 등급의 취약점은 발견되지 않았으며, 하드코딩된 시크릿·SQL 인젝션·커맨드 인젝션·경로 탐색·안전하지 않은 암호화 알고리즘 등 주요 OWASP Top 10 항목에 해당하는 문제는 확인되지 않는다.

## 위험도

LOW
