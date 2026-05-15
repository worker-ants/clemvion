## 발견사항

### [LOW] 조건부 빈 객체 스프레드 — 불필요한 임시 객체 생성
- **위치**: `http-request.handler.ts` — `requestBodyOutput()` 함수 및 transport-error catch 블록
- **상세**: `...(cond ? { key: val } : {})` 패턴이 조건마다 빈 객체 리터럴(`{}`)을 생성한 뒤 스프레드 병합합니다. `requestBodyOutput()`은 최소 3개의 임시 객체를 생성하며, 이 함수가 success/error 두 경로 모두에서 호출됩니다. catch 블록에서는 `requestBodyOutput()`을 재사용하지 않고 동일 패턴을 인라인으로 다시 작성해 GC pressure가 중복됩니다.
- **제안**:
  ```typescript
  // 현재: 3개 임시 객체 + spread
  const requestBodyOutput = (): Record<string, unknown> => ({
    ...(cappedRequestBody.value !== undefined ? { requestBody: cappedRequestBody.value } : {}),
    ...(rawConfig.bodyType !== undefined ? { requestBodyType: rawConfig.bodyType } : {}),
    ...(cappedRequestBody.truncated ? { bodyTruncated: true } : {}),
    responseHeaders,
  });

  // 개선: 직접 할당
  const out: Record<string, unknown> = { responseHeaders };
  if (cappedRequestBody.value !== undefined) out.requestBody = cappedRequestBody.value;
  if (rawConfig.bodyType !== undefined) out.requestBodyType = rawConfig.bodyType;
  if (cappedRequestBody.truncated) out.bodyTruncated = true;
  ```
  catch 블록도 동일 헬퍼를 재사용해 코드 중복과 임시 객체 모두 제거 가능.

---

### [LOW] `truncateBodyForOutput` 가 SSRF 검사 이전에 실행됨
- **위치**: `http-request.handler.ts` — `execute()` 진입부 (라인 ~130)
- **상세**: `serializeEvaluatedBody` → `truncateBodyForOutput` 호출이 `assertSafeOutboundUrl` 이전에 위치합니다. SSRF 차단 시 수행된 직렬화·바이트 계산 작업이 전부 낭비됩니다. SSRF 차단 빈도가 낮으면 실제 영향은 미미하지만, 잠재적으로 큰 body를 직렬화한 뒤 예외로 버리는 구조입니다.
- **제안**: `cappedRequestBody` 계산을 `assertSafeOutboundUrl` 이후(또는 실제 응답을 받은 직후)로 이동하거나, `form-data` 직렬화만 선행하고 `truncateBodyForOutput`는 응답 직전으로 지연.

---

### [INFO] `typeof Headers !== 'undefined'` 매 호출마다 재평가
- **위치**: `sanitize-response-headers.util.ts` — `iterateHeaders()` 내부
- **상세**: 전역 `Headers` 의 존재 여부는 런타임 중 변하지 않으나 `iterateHeaders` 호출마다 평가됩니다. 노드 18+에서는 항상 `true`이므로 반복 체크가 무의미합니다.
- **제안**:
  ```typescript
  const HAS_HEADERS_API = typeof Headers !== 'undefined';
  // iterateHeaders 안에서: if (HAS_HEADERS_API && source instanceof Headers)
  ```

---

### [INFO] `String(value)` — 이미 string인 값에 불필요한 래핑
- **위치**: `sanitize-response-headers.util.ts` — `sanitizeResponseHeaders()` 루프 내 (`out[name] = isSensitiveHeaderName(name) ? REDACTED : String(value)`)
- **상세**: `Headers.entries()` / `Record<string, string>` / `Iterable<[string,string]>` 모두 이미 string 값을 반환합니다. `String(value)` 호출은 모든 비민감 헤더마다 발생하며, 실제 타입이 string이 아닌 경우는 테스트 목(mock) 시나리오에만 해당합니다. 일반 경로에서는 함수 호출 오버헤드가 불필요합니다.
- **제안**: 함수 시그니처의 엄격한 `string` 타입을 믿고 `value as string`으로 캐스팅하거나, mock 방어는 타입 가드로 분리.

---

### [INFO] `buildConfigEcho` 클로저가 `execute()` 호출마다 생성됨
- **위치**: `http-request.handler.ts` — `execute()` 내부 `buildConfigEcho` 정의
- **상세**: 함수 표현식 `const buildConfigEcho = () => ({...})` 가 `execute()` 호출마다 새 클로저를 할당합니다. 내부에서 캡처하는 변수(`rawConfig`, `rawUrl`)가 호출별로 다르므로 외부로 추출하기 어렵지만, 구조를 클래스 메서드나 단순 인라인 객체 리터럴로 대체하면 함수 객체 할당을 제거할 수 있습니다.

---

## 요약

변경된 코드는 I/O 바운드 HTTP 핸들러이므로 네트워크 레이턴시가 CPU 연산 시간을 압도합니다. 성능 이슈는 모두 미시 최적화 수준으로, `requestBodyOutput()` 의 반복 임시 객체 생성 패턴이 가장 실질적인 GC pressure 원인이지만 단일 요청 기준으로도 수십 개 객체에 불과합니다. `truncateBodyForOutput` 의 조기 실행은 SSRF 차단이 자주 발생하는 환경에서만 의미 있는 낭비입니다. 나머지는 코드 명확성 관점의 정리 사항에 가깝습니다.

## 위험도

**LOW**