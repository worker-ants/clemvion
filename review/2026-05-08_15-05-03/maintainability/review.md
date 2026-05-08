### 발견사항

---

#### [HIGH] `requestBodyOutput` 클로저와 catch 블록의 스프레드 로직 중복 (DRY 위반)
- **위치**: `http-request.handler.ts` — `requestBodyOutput` 클로저(try 블록 내부) vs catch 블록
- **상세**: `cappedRequestBody.value`, `rawConfig.bodyType`, `cappedRequestBody.truncated`를 조건부로 스프레드하는 동일한 패턴이 두 곳에 반복된다. `requestBodyOutput()` 헬퍼가 transport 실패 경로에서는 재사용되지 않고 동일 로직이 수동으로 다시 기술된다. 차이점은 `responseHeaders` 하나뿐이다.
- **제안**:
  ```ts
  const buildBodyOutputFields = (includeResponseHeaders?: Record<string, string>) => ({
    ...(cappedRequestBody.value !== undefined ? { requestBody: cappedRequestBody.value } : {}),
    ...(rawConfig.bodyType !== undefined ? { requestBodyType: rawConfig.bodyType } : {}),
    ...(cappedRequestBody.truncated ? { bodyTruncated: true } : {}),
    ...(includeResponseHeaders ? { responseHeaders: includeResponseHeaders } : {}),
  });
  // try: ...buildBodyOutputFields(responseHeaders)
  // catch: ...buildBodyOutputFields()
  ```

---

#### [WARNING] `iterateHeaders`의 `null` 반환이 두 가지 의미를 혼용
- **위치**: `sanitize-response-headers.util.ts` — `iterateHeaders` 함수
- **상세**: `null` 반환이 "입력 자체가 null/undefined"인 경우와 "iteration 프로토콜 없는 객체"인 경우를 동시에 표현한다. 두 의미가 다름에도 동일한 sentinel을 사용해 호출부에서 원인을 구분할 수 없다. 현실적으로 후자는 타입 시스템이 막아주지만 런타임 방어 목적이라면 의미 분리가 명확해야 한다.
- **제안**: `null` 대신 빈 이터러블을 반환하도록 단순화. `sanitizeResponseHeaders`에서 `if (entries === null) return out` 분기를 제거할 수 있어 가독성이 향상된다:
  ```ts
  function iterateHeaders(...): Iterable<[string, string]> {
    if (source == null) return [];
    ...
    return [];
  }
  ```

---

#### [WARNING] 프로덕션 JSDoc에 테스트 구현 세부사항 노출
- **위치**: `sanitize-response-headers.util.ts` — `sanitizeResponseHeaders` 함수 JSDoc
- **상세**: `"callers (handlers in test harnesses) may pass partial mocks that only stub .get()"` — 프로덕션 API 문서가 테스트 목(mock) 구현 제약을 설명 근거로 사용한다. 이는 프로덕션 코드가 테스트 인프라에 의존함을 시사하며, 코드 목적과 테스트 우회 동기를 뒤섞는다.
- **제안**: JSDoc을 프로덕션 의미로 한정: `"Returns an empty object when source cannot be iterated (null, undefined, or non-iterable)."` 테스트 관련 설명은 테스트 파일 주석으로 이동.

---

#### [WARNING] `execute` 메서드 과도한 길이 및 책임 혼재
- **위치**: `http-request.handler.ts` — `execute` 메서드 전체
- **상세**: 이번 변경으로 rawConfig 추출, configEcho 빌더 클로저 정의, body 직렬화·캡핑 로직이 메서드 최상단에 추가되었다. 이미 인증 해결, URL 빌드, 헤더 병합, 바디 직렬화, SSRF 검사, 리다이렉트 추적, 응답 파싱, 사용량 로깅을 모두 담당하던 메서드가 더 길어졌다.
- **제안**: `buildConfigEcho`, `serializeEvaluatedBody`처럼 `buildBodyOutputFields`를 모듈 레벨 순수 함수로 추출. `execute` 내부의 클로저(`buildConfigEcho`, `requestBodyOutput`)를 모듈 스코프 함수로 이동해 테스트 가능성과 가독성을 높인다.

---

#### [WARNING] 테스트 파일 내 `ExecutionContext` 생성 패턴 불일치
- **위치**: `http-request.handler.spec.ts` — 상단 `makeContext` 팩토리 vs 기존 `context` 상수
- **상세**: 파일 최상단에 새 `makeContext` 팩토리가 추가되었으나, 기존 테스트들은 여전히 수동으로 정의된 `const context` 상수를 사용한다. 같은 파일 내 두 가지 컨텍스트 생성 패턴이 공존해 새 테스트를 추가할 때 어느 패턴을 따라야 하는지 모호하다.
- **제안**: 기존 `context` 상수를 `makeContext()` 호출로 교체해 단일 패턴으로 통일.

---

#### [WARNING] 출력 스키마가 설정 스키마를 수동으로 미러링 (결합도 위험)
- **위치**: `http-request.schema.ts` — `httpRequestNodeOutputSchema` 내 `config` 부분
- **상세**: `config` 출력 스키마에 `headers`, `queryParams`, `body`, `bodyType`, `responseType`, `timeout`, `followRedirects`, `verifySsl` 필드가 추가되었다. 이는 `httpRequestNodeConfigSchema`의 필드를 수동으로 복사한 것으로, 설정 스키마 변경 시 출력 스키마도 함께 업데이트해야 하는 암묵적 결합이 생긴다.
- **제안**: `config` 출력을 `.passthrough().optional()`만으로 느슨하게 정의하거나, 공통 베이스 스키마를 추출해 양쪽이 참조하도록 구성. 현재 `.passthrough()`가 이미 있으므로 추가 필드 명시는 문서화 목적 외 실효가 제한적이다.

---

#### [INFO] `String(value)` 암묵적 강제 변환 — 설명 없음
- **위치**: `sanitize-response-headers.util.ts` — `for` 루프 내 `String(value)`
- **상세**: `HeaderEntries` 타입은 `Iterable<[string, string]>`으로 value가 이미 string이어야 한다. `String()` 래핑이 추가된 이유(런타임 방어? 타입 오류 억제?)가 코드에 설명되지 않아 미래 리더가 의도를 오해할 수 있다.
- **제안**: 추가한 의도가 있다면 한 줄 주석으로 명시. 의도 없는 방어적 캐스트라면 제거.

---

#### [INFO] `rawConfig ?? config` 폴백이 테스트 우회 목적으로 문서화
- **위치**: `http-request.handler.ts:113`, `send-email.handler.ts:89`
- **상세**: "purely for unit tests that bypass the engine" 주석이 프로덕션 분기의 존재 이유를 테스트로 정당화한다. 이상적으로는 테스트도 엔진과 동일하게 `rawConfig`를 제공해야 한다. `makeContext()`가 이미 이를 지원하므로 폴백 자체는 점차 불필요해질 수 있다.

---

#### [INFO] `ENG-RC-*` 주석이 파일 레벨과 describe 블록에 이중 기술
- **위치**: `http-request.handler.spec.ts` 하단 describe 블록
- **상세**: 동일한 3문장 설명이 describe 블록 상단 주석으로 반복된다. 한 곳(describe 이름 또는 주석 중 하나)만 유지하면 충분하다.

---

### 요약

전반적으로 CONVENTIONS Principle 7(raw config echo)을 체계적으로 구현한 변경이며, 보안(헤더 리댁션, body 캡), 관찰성(requestBody/responseHeaders 노출), 테스트 커버리지 모두 충실하다. 유지보수성 관점의 주요 위험은 두 곳이다: (1) transport 오류 경로에서 `requestBodyOutput` 헬퍼를 재사용하지 않아 동일한 스프레드 로직이 중복됐고, (2) 이미 비대한 `execute` 메서드에 클로저 2개와 직렬화 로직이 추가되면서 메서드 복잡도가 더 높아졌다. `sanitize-response-headers.util.ts`의 `null` 이중 의미와 프로덕션 JSDoc의 테스트 구현 언급도 제거할 필요가 있다.

### 위험도

**MEDIUM**