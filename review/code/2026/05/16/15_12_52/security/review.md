# 보안(Security) 코드 리뷰

## 리뷰 대상

- `backend/src/nodes/integration/cafe24/cafe24-api.client.spec.ts` (테스트 파일)
- `backend/src/nodes/integration/cafe24/cafe24-api.client.ts` (구현 파일)
- `plan/in-progress/cafe24-request-envelope-fix.md`
- `plan/in-progress/spec-update-cafe24-request-envelope.md`

---

## 발견사항

### [INFO] 테스트 픽스처에 평문 토큰 리터럴 사용
- 위치: `cafe24-api.client.spec.ts`, `makeIntegration()` — `credentials.access_token: 'access-token-1'`, `refresh_token: 'refresh-token-1'`, `credentials.client_secret` 등
- 상세: 테스트 픽스처에 사용된 `'access-token-1'`, `'refresh-token-1'`, `'env-id'`, `'env-secret'`, `'old-access'`, `'silently-refreshed'` 등의 값은 명백히 가짜 더미이며 실제 자격증명이 아니다. 테스트 환경 전용이며 프로덕션 시크릿이 아니므로 하드코딩된 시크릿 위험은 없다. 다만 `process.env.CAFE24_CLIENT_ID = 'env-id'` / `process.env.CAFE24_CLIENT_SECRET = 'env-secret'` 와 같이 환경변수를 직접 mutate 하고 `delete process.env.*` 로 정리하는 패턴은, 테스트 병렬 실행 시 다른 테스트가 잘못된 환경변수를 읽을 수 있는 레이스 컨디션을 유발할 수 있다. 이 자체가 시크릿 누출은 아니지만 신뢰도 높은 테스트 환경 격리를 위해 `jest.replaceProperty` 또는 `jest.spyOn(process, 'env', 'get')` 방식이 더 안전하다.
- 제안: 테스트에서 `process.env` 를 직접 mutate 하는 방식을 `jest.replaceProperty(process, 'env', { ...process.env, CAFE24_CLIENT_ID: 'env-id', CAFE24_CLIENT_SECRET: 'env-secret' })` 또는 `beforeEach`/`afterEach` 블록에서 `process.env` 백업/복원 방식으로 전환한다.

---

### [INFO] 에러 메시지에 mall_id 및 에러 코드 노출
- 위치: `cafe24-api.client.ts` — `Cafe24AuthFailedError` 생성자(라인 약 1313-1327), `Cafe24RateLimitedError` 생성자(라인 약 1299-1311), `markAuthFailed`(라인 약 1791-1815), `executeWithRateLimit` 내 `logger.warn`(라인 약 2018-2019)
- 상세: `Cafe24AuthFailedError.message` 에 `mallId`(쇼핑몰 식별자)와 Cafe24 에러 코드/메시지 요약이 포함된다. 이 에러는 MCP 호출자에게 전달될 것을 의도하고 있으며, 코드 주석에도 "MCP callers see the cause"라고 명시되어 있다. `summarizeCafe24ErrorBody` 는 최대 200자로 자르는 안전장치를 갖추고 있으며, `sanitizeLastErrorMessage` 로 로그 출력 전에 시크릿 패턴을 마스킹하는 것도 확인된다(SEC-C2 대응). 그러나 에러 객체 자체(`Cafe24AuthFailedError.responseBody`)는 마스킹되지 않은 원본 응답 body를 보유한다. Cafe24 가 비정상적으로 토큰 조각을 응답에 echo 하는 시나리오(코드 주석 `SEC-C2` 참고)에서 이 필드가 상위 레이어에서 직렬화/전달될 경우 시크릿이 유출될 수 있다.
- 제안: `Cafe24AuthFailedError` 의 `responseBody` 필드에도 `sanitizeLastErrorMessage` 를 적용하거나, 에러 생성자 내에서 `responseBody` 를 저장하기 전에 민감 패턴을 제거한다. 최소한 이 필드를 외부에 직렬화하는 모든 경로에 sanitize 가 적용됨을 보장해야 한다.

---

### [INFO] `wrapInCafe24Envelope` 에서 `shop_no` 이외의 예약 키 혼입 가능성
- 위치: `cafe24-api.client.ts` — `wrapInCafe24Envelope` 함수(라인 약 2089-2096)
- 상세: 현재 구현은 `shop_no` 만을 top-level 에 남기고 나머지를 `request:` 안에 넣는다. Cafe24 Admin API 문서에 따르면 일부 엔드포인트는 `shop_no` 외에도 top-level에 허용되는 필드가 있을 수 있다(예: 특정 API의 경우 `mall_id` 등). 만약 호출자가 실제로 `request:` 안에 넣어야 할 `shop_no` 라는 이름의 비즈니스 필드를 가지고 있다면(비록 현실적으로 희박하나), 의도치 않게 top-level로 승격된다. 이 자체가 보안 취약점이라기보다 데이터 오염이지만, 공격자가 `shop_no` 키를 제어할 수 있다면 envelope 구조를 오염시킬 수 있다.
- 제안: Cafe24 API 스펙을 확인하여 top-level에 허용되는 필드의 화이트리스트를 명시적으로 관리한다. 현재는 `shop_no` 단일 예외만 존재하므로 큰 위험은 없으나, 주석에 이 의도를 명확히 문서화하는 것이 향후 혼란을 방지한다(이미 주석이 잘 작성되어 있다).

---

### [INFO] `summarizeCafe24ErrorBody` 폴백에서 `JSON.stringify` 로 예상치 않은 내용 노출 가능
- 위치: `cafe24-api.client.ts` — `summarizeCafe24ErrorBody` 함수(라인 약 1338-1366)
- 상세: 알 수 없는 에러 body 형태에 대한 폴백으로 `JSON.stringify(body).slice(0, 200)` 를 수행한다. Cafe24 가 비정상적으로 응답 body에 인증 관련 데이터를 포함하는 경우, 이 폴백이 에러 메시지에 해당 데이터를 그대로 포함시킬 수 있다. `sanitizeLastErrorMessage` 가 로그 출력 전에 적용되므로 로그 레벨에서는 보호되지만, `Cafe24AuthFailedError.message` 에 포함되는 `summarizeCafe24ErrorBody` 출력 자체에는 sanitize 가 적용되지 않는다.
- 제안: `summarizeCafe24ErrorBody` 의 반환값에도 `sanitizeLastErrorMessage` 를 적용하거나, 에러 생성자에서 summary를 sanitize 한 뒤 메시지에 포함시킨다.

---

### [INFO] DELETE 메서드에 대한 envelope 적용 여부 명시적 검증 부재
- 위치: `cafe24-api.client.spec.ts` — 신규 추가된 테스트 케이스들
- 상세: 보안 관점에서 DELETE 메서드가 body를 가질 경우 envelope이 적용되는지 여부가 테스트에 명시적으로 검증되지 않는다. `plan` 문서에서 "DELETE 는 path-only (body 없음)"라고 명시하고 있으나, `executeWithRateLimit` 의 body 처리 조건이 `opts.method !== 'GET'` 이므로 DELETE에 body가 전달되면 envelope이 적용된다. 의도와 구현의 불일치가 잠재적 프로토콜 오용을 유발할 수 있다.
- 제안: DELETE에 body가 전달되는 경우의 동작을 테스트로 명시하거나, `opts.body !== undefined && (opts.method === 'POST' || opts.method === 'PUT')` 조건으로 변경하여 의도를 코드에 명확히 표현한다.

---

## 요약

이번 변경(Cafe24 Admin API POST/PUT 요청 본문의 `request` envelope 래핑)은 보안 측면에서 전반적으로 안전하게 구현되었다. 하드코딩된 실제 시크릿이 없으며, 토큰 인증 흐름과 인가 검증 로직은 기존 코드를 그대로 유지한다. SEC-C2 대응으로 `sanitizeLastErrorMessage` 를 logger 출력 경로에 적용한 것은 긍정적이다. 다만 `Cafe24AuthFailedError.responseBody` 와 `summarizeCafe24ErrorBody` 의 반환값이 에러 메시지에 포함될 때 sanitize 가 적용되지 않아, Cafe24 비정상 응답에서 시크릿이 에러 객체에 잔류할 수 있는 낮은 수준의 위험이 있다. 테스트 코드에서 `process.env` 를 직접 mutate 하는 방식은 병렬 테스트 격리에 취약할 수 있다. `wrapInCafe24Envelope` 함수 자체는 단순하고 안전하며, 인젝션 취약점·경로 탐색·LDAP 인젝션 등의 위험은 이 변경에서 발견되지 않는다.

## 위험도

LOW
