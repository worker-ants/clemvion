## Side Effect 코드 리뷰

### 발견사항

---

**[WARNING] `sanitizeResponseHeaders` 시그니처 확장 — 기존 호출자 영향 없음이나 타입 widening**
- 위치: `sanitize-response-headers.util.ts`, `sanitizeResponseHeaders` 함수 선언
- 상세: 파라미터 타입이 `Headers | Record<string, string> | HeaderEntries` → `... | null | undefined`로 확장되었다. 기존 호출자는 모두 정상 동작하지만, `null`/`undefined`를 전달했을 때 빈 객체를 반환하는 무음 폴백(silent fallback)이 추가되었다. 실수로 `null`을 넘겨도 에러 없이 통과하므로, 누락 헤더가 조용히 버려질 수 있다.
- 제안: 호출 지점(`http-request.handler.ts`)에서는 항상 유효한 `res.headers`가 존재하므로 실질적 위험은 낮다. 다만 내부 JSDoc의 "mock-like inputs" 설명은 테스트 전용 경로임을 명확히 하고 있어 허용 범위로 볼 수 있다.

---

**[WARNING] `iterateHeaders` 내부: `source instanceof Headers` 분기 이후 `source === null` 제거 — 조건 순서 의존성**
- 위치: `sanitize-response-headers.util.ts:84–95`, `iterateHeaders` 함수
- 상세: 이전 코드는 `source !== null` 가드가 `Symbol.iterator` 체크 앞에 있었다. 변경 후 함수 상단에서 `null | undefined`를 먼저 차단하므로 후속 분기에서의 `null` 도달은 불가능하다. 그러나 `typeof source === 'object'` 두 번 평가로 분기가 다소 중복된다. 잠재적 부작용은 없으나 `typeof null === 'object'`임을 고려할 때, null 가드가 맨 앞에 없었다면 `Object.entries(null)` 로 런타임 오류가 발생할 수 있었다 — 현재 코드는 이를 올바르게 처리한다.
- 제안: 구조는 안전하다. 추가 개선이 필요하다면 두 번의 `typeof source === 'object'` 분기를 하나로 합칠 수 있다.

---

**[WARNING] `http-request.handler.ts`: `evaluatedRequestBody`/`cappedRequestBody`가 `execute()` 최상단에서 계산됨 — 인증 실패 시에도 body serialization 수행**
- 위치: `http-request.handler.ts:117–119`
- 상세: `serializeEvaluatedBody(body, bodyType)`와 `truncateBodyForOutput(evaluatedRequestBody)`가 인증 처리(`resolveIntegration`) 이전에 실행된다. 인증 실패로 early throw가 발생해도 body 직렬화는 이미 완료된 상태다. CPU 비용이나 메모리 점유가 문제될 수 있는 거대 body(최대 300KB+)가 throw path에서 불필요하게 처리된다.
- 제안: 실제 부작용(상태 변경, 외부 호출)은 없고 순수 계산이므로 위험도는 낮다. 성능 민감도에 따라 `fetch` 직전으로 이동 가능하나 현재 범위에서는 허용 가능하다.

---

**[WARNING] `buildConfigEcho()`에서 `rawConfig.bodyType`을 `requestBodyType` 소스로 사용**
- 위치: `http-request.handler.ts:326–331`, `requestBodyOutput` 람다
- 상세: `requestBodyType`은 `rawConfig.bodyType`(raw, 미평가 값)에서 읽힌다. 그런데 `evaluatedRequestBody`는 평가된 `body`와 평가된 `bodyType`을 기반으로 직렬화된다. 만약 `bodyType`이 표현식(`{{ $input.type }}`)이라면 `rawConfig.bodyType`은 `"{{ $input.type }}"`이 되지만, 실제 wire에 나간 body는 평가된 타입(예: `"json"`)으로 처리된다. `output.requestBodyType`과 실제 직렬화 방식이 불일치할 수 있다.
- 제안: `requestBodyType`은 `rawConfig.bodyType`이 아닌 평가된 `bodyType` 변수(line 97)에서 읽어야 한다:
  ```ts
  ...(bodyType !== undefined ? { requestBodyType: bodyType } : {}),
  ```

---

**[INFO] `send-email.handler.ts`: `rawConfig` 타입 캐스팅 제거**
- 위치: `send-email.handler.ts:92`
- 상세: `as Record<string, unknown>` 캐스팅 제거. `context.rawConfig`의 타입이 이미 `Record<string, unknown>`으로 선언되어 있다면 캐스팅 제거는 안전하다. `ExecutionContext` 인터페이스에서 `rawConfig`의 타입을 확인해야 하지만, 이 변경 자체는 런타임 동작에 영향을 주지 않는다.
- 제안: `ExecutionContext.rawConfig`가 `Record<string, unknown>` 또는 더 넓은 타입인지 확인 필요. 현재로서는 부작용 없음.

---

**[INFO] `http-request.handler.spec.ts`: `makeContext`에서 `rawConfig: Object.freeze({...rawConfig})`**
- 위치: `http-request.handler.spec.ts:7`
- 상세: 테스트용 `makeContext`에서 `rawConfig`를 `Object.freeze()`로 전달한다. 핸들러 내부에서 `rawConfig`를 변경하려는 코드가 있다면 strict mode에서 `TypeError`가 발생한다. 현재 핸들러는 `rawConfig`를 읽기만 하므로 문제없지만, 향후 핸들러가 `rawConfig`를 mutate하면 테스트만 실패하고 프로덕션은 통과하는 불일치가 생긴다.
- 제안: 의도적 방어 코드로 적절하다. 핸들러가 `rawConfig`를 immutable하게 다뤄야 한다는 계약을 강제한다.

---

**[INFO] `truncate-body.util.spec.ts`: 순수 포매팅 변경**
- 위치: 전체 diff
- 상세: `expect(Buffer.byteLength(...)).toBeLessThanOrEqual(...)` 호출의 줄바꿈 위치만 변경. 기능적 부작용 없음.

---

**[INFO] `http-request.schema.ts`: `config` 스키마에 `headers`/`queryParams`가 `z.array(z.unknown())`으로 추가**
- 위치: `http-request.schema.ts:51–53`
- 상세: 실제 `headers`/`queryParams` config 필드는 `Array<{key, value}>` 형태(keyValueSchema)이지만, output schema의 config echo에서는 `z.array(z.unknown())`으로 선언되었다. 유효성 검사는 passthrough로 느슨하게 처리되므로 런타임 오류는 없지만, 타입 정밀도가 낮다.
- 제안: 부작용은 없으나 향후 schema 기반 자동 문서화나 타입 추론에서 오해를 유발할 수 있다.

---

### 요약

이번 변경의 핵심은 `sanitizeResponseHeaders`의 null 허용 확장, `http-request.handler`에서 raw config echo + request/response body 노출, 그리고 send-email handler의 경미한 타입 캐스팅 제거다. 전반적으로 **의도하지 않은 전역 상태 변경, 파일시스템 부작용, 외부 네트워크 호출은 없다**. 가장 주목할 부작용 후보는 `requestBodyType`이 raw template 문자열(`{{ ... }}`)로 echo될 수 있는 불일치(WARNING 4번)이며, 나머지는 설계 의도 범위 내의 안전한 변경이다. 테스트 코드의 `Object.freeze` 패턴은 계약 강제 측면에서 긍정적이다.

### 위험도

**LOW**