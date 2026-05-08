## 발견사항

**[WARNING] `sanitize-response-headers.util.ts`의 신규 코드 경로에 대한 직접 유닛 테스트 부재**
- 위치: `sanitize-response-headers.util.ts` 전체 (대응 spec 파일 미제공)
- 상세: `null/undefined` 입력 처리, `Symbol.iterator` 미보유 mock 객체의 fallback(`iterateHeaders → null`), `String(value)` coercion 등 이번 PR에서 추가된 세 가지 코드 경로가 handler 통합 테스트를 통해서만 간접적으로 검증된다. `truncate-body.util.spec.ts`는 전용 unit spec이 있는데 반해, `sanitize-response-headers.util.spec.ts`는 diff에 포함되지 않았다.
- 제안: `sanitizeResponseHeaders(null)`, `sanitizeResponseHeaders(undefined)`, `sanitizeResponseHeaders({ get: () => null })` (iterator 미보유 mock), `sanitizeResponseHeaders([['x-api-key', 'val']])` (iterable tuple) 케이스를 직접 unit 테스트로 추가

---

**[WARNING] 기존 handler 테스트의 mock 헤더가 이번 변경과 묵시적으로 결합**
- 위치: `http-request.handler.spec.ts` 기존 `execute` describe 블록 내 `{ get: jest.fn().mockReturnValue(null) }` 사용 테스트들
- 상세: `sanitizeResponseHeaders`가 이제 항상 `responseHeaders` 키를 output에 포함시킨다(`requestBodyOutput()` 내부 spread). 기존 mock은 `instanceof Headers` 체크를 통과하지 못하고 `Symbol.iterator`도 없어 `iterateHeaders → null` 경로를 타므로 `responseHeaders: {}`가 된다. 기존 assertion은 이 필드를 검증하지 않으므로 무성으로 통과한다.
- 제안: 기존 테스트에 `expect(result.output.responseHeaders).toEqual({})` 단언 추가, 또는 모든 mock을 `new Headers()`로 교체하여 일관성 확보

---

**[WARNING] `x-www-form-urlencoded` / `raw` bodyType이 ENG-RC-* 스위트에 미포함**
- 위치: `http-request.handler.spec.ts` ENG-RC-* describe
- 상세: `serializeEvaluatedBody`는 `form-data`만 특수 처리하고 나머지는 body를 그대로 반환한다. `json`, `form-data`, GET(body 없음)은 테스트되지만 `x-www-form-urlencoded`(URLSearchParams 직렬화 후 body → string이지만 출력에는 원본 객체가 기록)와 `raw`(string passthrough)는 누락이다. 특히 `x-www-form-urlencoded`는 `serializeEvaluatedBody`가 객체를 그대로 반환하는 반면 실제 fetch body는 `URLSearchParams.toString()`이므로 echo와 wire 전송 값이 다르다 — 이 의도적 설계 결정이 테스트로 문서화되지 않는다.
- 제안: `bodyType: 'x-www-form-urlencoded'`로 POST 테스트 추가, `requestBody`가 `{ name: 'alice' }`(원본 객체) 형태임을 단언

---

**[WARNING] `body: null` 케이스 미테스트 (`undefined`와 구분되는 동작)**
- 위치: `http-request.handler.spec.ts` ENG-RC-*
- 상세: `serializeEvaluatedBody(null, 'json')`은 `null`을 그대로 반환한다. `truncateBodyForOutput(null)`은 `{ value: null, truncated: false }`를 반환하므로 `cappedRequestBody.value !== undefined`가 `true`가 되어 `requestBody: null`이 output에 포함된다. `undefined`는 제외되지만 `null`은 포함되는 이 비대칭이 테스트로 명시되지 않는다.
- 제안: `body: null`로 POST 요청 시 `result.output.requestBody`가 `null`임을 확인하는 케이스 추가, 또는 handler 내에서 `null`도 `undefined`와 동일하게 처리하는 정책 결정 후 명시

---

**[INFO] `makeContext` 헬퍼 설계 적절**
- 위치: `http-request.handler.spec.ts` 4번째 줄
- 상세: `Object.freeze`를 사용해 rawConfig의 우발적 변이를 방지하고, spread로 얕은 복사본을 만드는 패턴이 올바르다. `send-email.handler.spec.ts`의 동일 헬퍼와 구조가 일치해 패턴 일관성도 확보됨.

---

**[INFO] transport-error 포트에서 `responseHeaders` 부재 단언이 명시적**
- 위치: `http-request.handler.spec.ts:970`
- 상세: `expect(result.output.responseHeaders).toBeUndefined()` 단언이 handler catch 블록의 인라인 전개(responseHeaders 미포함)와 정확히 대응한다. 의도를 명확히 표현한 좋은 테스트 설계.

---

**[INFO] `truncate-body.util.spec.ts` 변경은 순수 포맷팅**
- 위치: `truncate-body.util.spec.ts` 전체 diff
- 상세: `toBeLessThanOrEqual()` 체이닝의 prettier 줄바꿈 정리만 포함. 기능 변경 없음.

---

## 요약

전체 테스트 커버리지는 ENG-RC-* 스위트가 7개 시나리오(raw config echo, GET 본문 생략, form-data, 헤더 redaction, 256KB cap, 비-2xx error port, transport 실패)를 추가해 핵심 동작을 잘 포괄한다. 다만 이번 PR에서 핵심 보안 로직을 담당하는 `sanitize-response-headers.util.ts`의 신규 코드 경로(null/undefined 처리, mock-compatible fallback)에 대한 전용 unit spec이 부재하고, `x-www-form-urlencoded` bodyType의 echo 의미론과 `body: null` 경계 케이스가 문서화되지 않으며, 기존 mock 헤더 패턴(`{ get: fn }`)이 이제 `responseHeaders: {}`를 조용히 생성하는 동작 변화가 기존 테스트에 반영되지 않은 점이 주요 리스크다.

## 위험도

**MEDIUM**