### 발견사항

- **[INFO]** JWT 서명 미검증 — 의도적 설계이나 신뢰 경계 명시 필요
  - 위치: `codebase/backend/src/modules/integrations/jwt-exp.ts` 전체 (`parseJwtExp` 함수)
  - 상세: `parseJwtExp`는 JWT payload를 서명 검증 없이 base64url 디코드만 수행한다. 코드와 문서에 "위조 방어 목적이 아님, 만료 시각 metadata 추출이 목적, 토큰 진위는 Cafe24 API가 호출 시점에 검증"이라는 근거가 명시되어 있다. 이는 합리적 설계 결정이다. 다만 이 함수가 향후 다른 맥락(예: 인가 판단, scope 추출 등)에서 재사용될 경우 서명 미검증이 보안 취약점이 될 수 있다.
  - 제안: 함수 시그니처 또는 모듈 수준에서 `// WARNING: signature not verified — for expiry extraction only` 와 같은 경고 주석을 추가해 미래 재사용 오용을 방지한다. 현재 용도에서는 문제 없다.

- **[INFO]** 테스트 코드의 시크릿 유사 값 — 실 시크릿 아님 확인
  - 위치: `integration-oauth.service.cafe24.spec.ts` 라인 208 (`client_secret: 'priv-secret'`), 라인 289 (`client_secret: 'priv-secret'`), `cafe24-api.client.spec.ts` 등
  - 상세: 테스트 픽스처에 `client_secret: 'priv-secret'`, `client_id: 'priv-cid'` 등 자격증명처럼 보이는 값이 있으나, 이들은 명백히 테스트 더미 값이며 실제 시크릿과 무관하다. 하드코딩된 운영 시크릿이 아님을 확인했다.
  - 제안: 조치 불필요. 테스트 환경에서의 더미 값 사용은 정상 패턴이다.

- **[INFO]** `mall_id` 가 로그/plan 파일에 평문 노출 (`gehrig0301`)
  - 위치: `plan/in-progress/cafe24-jwt-exp-fix.md` 라인 다수, `jwt-exp.spec.ts` 테스트 케이스 내 `mall_id: 'gehrig0301'`
  - 상세: 사용자 보고 원본에서 실제 mall 식별자(`gehrig0301`)가 plan 문서와 테스트 코드에 그대로 기재되었다. mall_id는 일반적으로 공개 식별자(쇼핑몰 도메인 prefix)이므로 시크릿은 아니나, 특정 사용자의 실 운영 데이터가 소스코드 이력에 영구 기록된다.
  - 제안: 테스트 코드의 `mall_id`는 `'test-mall'` 등 중립적인 픽스처 값으로 치환하는 것을 권장한다. plan 문서는 내부 추적용이므로 현재 수준에서 허용 가능하다.

- **[INFO]** `reactive_401` source에 의한 short-circuit 우회 — rate limiting 악용 가능성 검토
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-token-refresh.processor.ts` (변경 라인 ~1489), `cafe24-api.client.ts` `performAuthRefresh`
  - 상세: `source='reactive_401'`이면 워커의 short-circuit guard(토큰 신선도 확인)를 skip하고 항상 refresh를 시도한다. 이 경로는 `executeWithRateLimit`에서 Cafe24 API가 실제 401을 반환할 때만 진입하므로 외부 입력이 직접 이 source를 위조해 호출할 수 없다. 단, BullMQ 큐에 직접 접근 가능한 내부 공격자(예: Redis 직접 접근)가 `source='reactive_401'`로 job을 임의 enqueue하면 불필요한 refresh가 반복적으로 발생할 수 있다.
  - 제안: 위협 모델상 Redis 직접 접근은 인프라 침해 수준이므로 현재 설계에서 추가 방어는 과도하다. Redis 접근 제어(VPC 격리, 인증) 인프라 수준에서 통제되어야 함을 확인한다.

- **[INFO]** `removeOnComplete: { age: 0 }` — 감사 추적 부재
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts` (변경 라인 ~1291)
  - 상세: `reactive_401` source의 job은 완료 즉시 BullMQ에서 삭제된다. 이는 stale dedup 차단을 위한 의도된 설계이나, 운영 중 refresh 이력이 남지 않아 사후 감사/디버깅 시 해당 시점의 refresh 발생 여부를 확인하기 어렵다.
  - 제안: 애플리케이션 레벨 로그(`this.logger.log(...)`)가 worker에서 충분히 남는다면 수용 가능하다. 로그 retention 정책을 확인하여 감사 추적 공백이 없는지 점검을 권장한다.

### 요약

이번 변경은 Cafe24 OAuth 토큰 만료 시각 파싱 로직을 JWT `exp` claim 기반으로 격상하고, TZ-less ISO 파싱의 timezone 모호성 회귀를 KST 정규화로 차단하며, 401 자가 회복 경로(`reactive_401`)에서 워커 short-circuit을 우회하는 방어적 패턴을 추가한 변경이다. 보안 관점에서 하드코딩된 실 시크릿, SQL/커맨드 인젝션, 인증 우회, 평문 전송 등 OWASP Top 10 주요 취약점은 발견되지 않았다. JWT 서명 미검증은 명시적으로 설계 근거가 문서화되어 있고 토큰 진위 검증은 Cafe24 API 호출 시 위임되므로 현재 용도에서 보안 위험이 아니다. 테스트 코드의 실 mall_id(`gehrig0301`) 노출이 소스코드 이력에 기록되는 것은 개인정보 최소화 관점에서 경미한 주의 사항이나 위험도는 낮다. 전체적으로 보안 품질이 양호하며 운영 투입에 지장이 없는 수준으로 판단된다.

### 위험도

LOW
