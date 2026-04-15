## 유지보수성 코드 리뷰

### 발견사항

---

**[INFO]** `toKeyValueEntries`에서 중복된 `queryParams` 처리 로직
- 위치: `http-request.handler.ts` — `execute()` 메서드 내 query params 처리 (L120–130)
- 상세: `toKeyValueRecord(config.queryParams)`로 이미 `Record<string, string>`으로 변환한 다음, 아래에서 다시 `Object.entries(queryParams)`로 순회한다. 중간 `Record` 단계가 불필요하다 — 직접 `toKeyValueEntries`를 쓰면 충분하다.
- 제안:
  ```ts
  const queryEntries = toKeyValueEntries(config.queryParams);
  // ...
  for (const [key, value] of queryEntries) { params.append(key, value); }
  ```

---

**[INFO]** `form-data`와 `x-www-form-urlencoded` body 처리 로직이 거의 동일
- 위치: `http-request.handler.ts` — `bodyType` 분기 처리 (L147–175)
- 상세: 두 분기 모두 `toKeyValueEntries(body)` → `for...of` → `formData.append(key, value)` 패턴을 그대로 반복한다. 유일한 차이는 `FormData` vs `URLSearchParams` 타입과 Content-Type 처리뿐이다. 지금은 2개이지만, 유사한 body type이 추가될 경우 패턴이 더 분산될 위험이 있다.
- 제안: (현재 2개 분기는 허용 범위이나) 향후 확장 시 `buildFormBody(type, body)` 헬퍼 분리를 고려.

---

**[INFO]** `toKeyValueEntries`의 Array/Object 분기에서 `null` 타입 체크 누락
- 위치: `http-request.handler.ts` — `toKeyValueEntries` 함수 (L315–316)
- 상세: `typeof value === 'object'` 체크가 `null`을 포함하지만, 상단에서 `value == null` 가드가 먼저 처리되므로 실질적 버그는 아니다. 그러나 TypeScript 관례상 `value !== null && typeof value === 'object'` 형태가 의도를 더 명확하게 표현한다.
- 제안:
  ```ts
  if (typeof value === 'object' && value !== null) { ... }
  ```

---

**[INFO]** `execute()` 함수 길이 과다
- 위치: `http-request.handler.ts` — `execute()` (L69~280, 약 210줄)
- 상세: URL 해석, 인증 처리, body 직렬화, SSRF 검사, fetch 실행, 응답 처리, 에러 로깅을 모두 한 함수에서 담당한다. 현재 로직은 이해 가능한 수준이지만, body type이나 인증 방식이 추가될수록 유지보수 비용이 급격히 증가한다.
- 제안: `buildRequestBody()`, `buildFetchOptions()` 같은 private 헬퍼를 분리하는 방향으로 중장기 리팩터링 고려.

---

**[INFO]** 테스트 간 `mockResponse` 보일러플레이트 과도한 중복
- 위치: `http-request.handler.spec.ts` — 신규 추가된 5개 테스트
- 상세: 각 테스트마다 동일한 `mockResponse` 객체 + `global.fetch = jest.fn()...` 코드가 반복된다. `beforeEach`에서 공통 설정을 하거나, `describe` 블록 단위로 묶으면 중복을 제거할 수 있다.
- 제안:
  ```ts
  function mockFetchOk(body = {}) {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, status: 200, json: jest.fn().mockResolvedValue(body),
    }) as unknown as typeof fetch;
  }
  ```

---

**[INFO]** 테스트 파일에 `Object.keys(headers).toHaveLength(1)` 단언 — 취약한 검증
- 위치: `http-request.handler.spec.ts` — `'should drop header rows with empty keys'` 테스트 (L245)
- 상세: `Content-Type` 등 내부적으로 추가될 수 있는 헤더가 생기면 이 단언이 깨진다. 헤더 수를 세는 것보다 빈 키가 없음을 직접 검증하는 편이 덜 취약하다.
- 제안:
  ```ts
  expect(headers['']).toBeUndefined();
  expect(Object.keys(headers).every(k => k.trim().length > 0)).toBe(true);
  ```

---

**[INFO]** 프론트엔드: `authentication` 변수 추출은 적절하나, `integrationId` 클리어 로직 부재
- 위치: `integration-configs.tsx` — `HttpRequestConfig` (L44–52)
- 상세: 인증 방식을 `integration`에서 `none`으로 변경해도 `config.integrationId` 값이 그대로 남는다. UI상 숨겨지지만, 백엔드로 전달되는 설정에 유령 값이 포함될 수 있다.
- 제안:
  ```ts
  onChange={(v) => {
    const update: Config = { ...config, authentication: v };
    if (v !== 'integration') delete update.integrationId;
    onChange(update);
  }}
  ```

---

### 요약

이번 변경의 핵심인 `toKeyValueRecord` / `toKeyValueEntries` / `stringifyScalar` 헬퍼 도입은 올바른 방향이며, 가독성과 일관성이 전반적으로 개선되었다. 단, `execute()` 함수가 여전히 지나치게 길고 다중 책임을 갖고 있어 향후 body type 확장 시 유지보수 부담이 커질 수 있다. 테스트 측면에서는 반복적인 `mockResponse` 보일러플레이트와 취약한 헤더 수 검증 단언이 중장기적으로 테스트 유지 비용을 높인다. 프론트엔드의 `integrationId` 잔류 문제는 데이터 정합성에 영향을 줄 수 있어 소규모 수정이 필요하다.

### 위험도

**LOW**