# Testing Review — cafe24 request envelope fix

## 발견사항

### [INFO] `DELETE` 메서드에 대한 envelope 비적용 테스트가 누락됨
- 위치: `cafe24-api.client.spec.ts` happy path describe 블록
- 상세: 커밋 메시지 및 plan 문서(`plan/in-progress/cafe24-request-envelope-fix.md`)에서 "DELETE 는 path-only (body 없음) 라 envelope 영향 없음"이라고 명시했지만, `executeWithRateLimit` 의 분기 조건은 `opts.body !== undefined && opts.method !== 'GET'` 이다. 따라서 `DELETE` 에 body 가 실수로 전달될 경우 envelope 이 적용된다. 이 경계 케이스에 대한 단언이 없다. 추가된 `GET — never wraps in envelope` 테스트는 GET 만 검증하며 DELETE 는 별도로 다루지 않는다.
- 제안: `it('DELETE — no body, envelope not applied')` 케이스를 추가하거나, body 가 있는 DELETE 호출 시 어떤 동작이 기대되는지(`body 무시` vs `envelope 적용`) 단언을 명시. plan 문서의 "DELETE 는 envelope 영향 없음" 설명이 구현 코드와 정확히 일치하는지 확인 필요.

### [INFO] `PATCH` 메서드에 대한 envelope 동작이 정의되지 않음
- 위치: `cafe24-api.client.ts` `Cafe24Method` 타입 정의 및 `executeWithRateLimit`
- 상세: `Cafe24Method = 'GET' | 'POST' | 'PUT' | 'DELETE'` 로 정의되어 현재는 PATCH 가 지원되지 않는다. 그러나 만약 미래에 추가될 경우 envelope 적용 여부가 테스트로 명시되어 있지 않다. 이 자체가 현재 버그는 아니지만, 메서드 목록 변경 시 회귀 위험이 있다.
- 제안: 현재 허용 메서드 목록(`GET | POST | PUT | DELETE`)을 테스트 파일 최상단 주석이나 별도 const 로 명시하여 새 메서드 추가 시 envelope 정책이 강제 검토되도록 구성.

### [WARNING] `wrapInCafe24Envelope` 단위 테스트가 없어 순수 함수 로직 검증이 통합 테스트에만 의존
- 위치: `cafe24-api.client.ts` line 2089-2096 (`wrapInCafe24Envelope` 함수)
- 상세: `wrapInCafe24Envelope` 는 module-private 순수 함수로, 현재 모든 검증이 fetch mock 을 통한 통합 시나리오(client.call → fetch body 검사)로 이루어진다. 구현이 단순하고 현재 4개 케이스가 전환 조건을 충분히 커버하지만, `shop_no` 가 `null` 로 전달되는 케이스(`shop_no: null`), `shop_no` 가 `0` 이나 `false` 같은 falsy 값인 케이스는 검증되지 않는다. 구현은 `undefined` 체크(`if (shop_no !== undefined)`)를 사용하므로 `null`·`0`·`''` 은 top-level 에 올라가지만, 이 동작이 Cafe24 API 관점에서 올바른지 테스트로 고정되어 있지 않다.
- 제안: `shop_no: null`, `shop_no: 0` 케이스에 대한 테스트 케이스를 `happy path` 블록에 추가하여 의도한 동작(`null`/`0`도 top-level 에 포함되는지, 또는 제외해야 하는지)을 명시적으로 고정.

### [INFO] 기존 `PUT — serialises body as JSON with content-type` 테스트 교체로 테스트 의도 범위 변경
- 위치: `cafe24-api.client.spec.ts` diff hunk (line 61-85)
- 상세: 이전 테스트는 `init.body === '{"product_name":"Updated"}'` 로 raw JSON 문자열 동등성을 검증했다. 교체된 테스트는 `JSON.parse(init.body)` 후 구조 동등성을 검증한다. 이 변경은 올바르며 envelope 로직 추가에 필수적이다. 그러나 Content-Type 헤더 검증이 첫 번째 케이스(PUT with shop_no)에만 남아있고 나머지 4개 케이스(PUT without shop_no, POST, PUT shop_no-only, GET)에는 Content-Type 검증이 생략되어 있다.
- 제안: 회귀 방지를 위해 POST 케이스 등 최소 한 케이스 더에 `Content-Type: application/json` 헤더 단언을 추가. 또는 공통 헬퍼로 묶어 중복 없이 검증.

### [INFO] `wrapInCafe24Envelope` 이 `body` 가 `undefined` 인 경우 호출되지 않음을 명시하는 타입 계약이 없음
- 위치: `cafe24-api.client.ts` line 1934-1937
- 상세: `opts.body !== undefined && opts.method !== 'GET'` 조건으로 guard 되어 있어 `wrapInCafe24Envelope` 는 반드시 정의된 body 로만 호출된다. 이 가드가 테스트에서는 암묵적으로 신뢰된다. GET 케이스에 body 를 강제로 전달하는 엣지 케이스 테스트가 없어, GET + body 조합의 동작(body 무시 여부)이 명시적으로 고정되지 않았다.
- 제안: `GET — body 가 있어도 무시됨` 케이스를 추가하거나, TypeScript 타입으로 `GET` 시 body 전달을 컴파일 타임에 차단.

### [INFO] `cafe24.handler.spec.ts` 의 기존 테스트가 변경 후 유효한지 직접 언급이 없음
- 위치: plan 문서 및 커밋 메시지
- 상세: 커밋 메시지에 "Existing `cafe24.handler.spec.ts` assertions remain valid because the handler→client contract is unchanged (flat body in)"이라고 기술되어 있다. 이는 맞는 판단이지만, handler spec 에서 client 로 전달되는 body 가 flat 임을 단언하는 케이스가 있다면 그 케이스가 실제로 통과하는지 명시적 회귀 체크가 이번 PR 의 테스트 범위에서 언급되지 않는다.
- 제안: PR/review 노트 또는 RESOLUTION.md 에 `cafe24.handler.spec.ts` 실행 결과(pass)를 기록하거나, CI 통과 확인을 명시.

### [INFO] 토큰 갱신 POST 요청에 envelope 이 비적용됨을 검증하는 테스트 부재
- 위치: `cafe24-api.client.ts` `refreshAccessToken` 메서드 (line 1661-1767)
- 상세: plan 문서에 "token refresh 는 form-urlencoded 라 envelope 무관"이라고 설명하지만, `refreshAccessToken` 은 `executeWithRateLimit` 가 아닌 별도 fetch 경로를 사용한다. 따라서 실제로 envelope 이 적용될 위험은 구조적으로 없다. 그러나 이 안전성에 대한 명시적 테스트("refresh POST body 는 form-urlencoded 이며 envelope 되지 않음")가 없어 미래 리팩토링 시 회귀 위험이 존재한다.
- 제안: 기존 token refresh 테스트에 refresh fetch 의 `Content-Type` 헤더가 `application/x-www-form-urlencoded` 이고 `body` 가 JSON 형태가 아님을 단언하는 assertion 을 추가하거나, 주석으로 별도 경로임을 강조.

---

## 요약

이번 변경에서 추가된 5개의 새 테스트 케이스(PUT with shop_no, PUT without shop_no, POST, PUT shop_no-only, GET no-envelope)는 `wrapInCafe24Envelope` 의 핵심 동작을 체계적으로 커버하며, 테스트 격리(`beforeEach` 에서 mock 초기화, `__resetCafe24LocksForTesting` 호출), 의존성 주입(`CAFE24_FETCH_IMPL` / `CAFE24_SLEEP_IMPL` 토큰), 가독성(주석으로 Cafe24 API 스펙 URL 및 동작 이유 명시) 측면에서 우수한 품질을 보인다. 기존 회귀 테스트(rate limiting, auth failure, network failure, token refresh)가 모두 유지되어 변경 사이드이펙트 위험이 낮다. 다만 `shop_no: null` / `shop_no: 0` 같은 falsy 엣지 케이스, DELETE + body 조합, GET + body 조합에 대한 명시적 테스트가 없고, `wrapInCafe24Envelope` 가 순수 함수임에도 통합 경로를 통해서만 검증된다는 점이 향후 보완 여지로 남는다. Content-Type 헤더 단언이 PUT with shop_no 케이스에만 있고 POST 등 다른 쓰기 케이스에 생략된 것도 소규모 회귀 리스크다. 전반적으로 변경 규모 대비 테스트 충실도는 높으며, 발견된 항목은 모두 INFO 또는 WARNING 수준의 보완 사항이다.

## 위험도

LOW
