# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 1: execution-failure-classifier.spec.ts

- **[INFO]** 중복 테스트 커버리지 — `CODE_MEMORY_LIMIT` / `HTTP_BLOCKED` 가 두 곳에서 검증됨
  - 위치: 라인 176-178 (`it.each` 목록) + 라인 201-212 (별도 `it.each`)
  - 상세: `→ executionFailedInternal` 결과 검증은 상위 `it.each` 배열에 이미 포함되어 있고, 하위 블록은 동일 결과를 다시 단언한 뒤 warn-spy 비호출만 추가로 검증한다. 두 케이스의 `expect(result.key).toBe('executionFailedInternal')` 가 중복이다.
  - 제안: 하위 `it.each` 에서 `result.key` 단언을 제거하거나, 상위 목록에서 두 코드를 빼고 하위 블록에서만 검증해 의도를 단일화한다. 현재는 "키 분류" 와 "warn 없음" 두 관심사가 두 블록에 산재해 있어 변경 시 양쪽을 모두 수정해야 한다.

- **[INFO]** `warnSpy.mockRestore()` 가 `afterEach` 대신 테스트 본문에 인라인
  - 위치: 라인 54-60, 라인 216-231, 라인 237-241, 라인 327-344
  - 상세: spy 복원이 try/finally 없이 단순 라인으로 배치되어 있다. 단언 실패 시 `mockRestore()` 가 호출되지 않아 후속 테스트의 Logger.warn 동작이 오염될 수 있다. `Unknown fallback` describe 블록은 이 패턴을 3군데에서 반복한다.
  - 제안: `beforeEach`/`afterEach` 에서 spy 를 설정·해제하거나, 최소한 `try { ... } finally { warnSpy.mockRestore() }` 구조로 보호한다.

---

### 파일 2: execution-failure-classifier.ts

- **[INFO]** 변경 자체(2개 코드 추가 + 인라인 주석)는 간결하고 의도가 명확하다.
  - `CODE_MEMORY_LIMIT` 와 `HTTP_BLOCKED` 모두 spec 참조 주석이 충분하다.
  - 배열 순서(HTTP_BLOCKED 가 `CODE_EXECUTION_FAILED` 직후, `SUB_WORKFLOW_FAILED` 직전)는 기존 그룹핑 패턴(`CODE_*` → 비-HTTP 내부) 에서 소폭 어긋난다. `HTTP_BLOCKED` 는 HTTP 계열이지만 THIRD_PARTY 가 아니라 INTERNAL 에 등재되므로 발생하는 위치 어색함이다.
  - 제안(낮은 우선순위): 짧은 인라인 주석으로 현재 위치가 의도적임을 표시하거나, `HTTP_BLOCKED` 를 `ERROR_PORT_FALLBACK` 직전 등 HTTP 관련 코드들과 논리적으로 인접한 곳에 배치해 Set 내 시각적 일관성을 유지한다. 기능에는 영향 없음.

---

### 파일 3: error-codes.ts

- **[INFO]** 추가된 주석은 적절하고 기존 스타일(`EMAIL_HOST_BLOCKED` 인라인 주석 형식)과 일관된다.
  - 특이사항 없음. 변경이 최소적이며 유지보수성에 긍정적이다.

---

### 파일 4: code.handler.spec.ts

- **[INFO]** `classifyError` → `classifyCodeNodeError` 이름 변경 — 10개 호출처 일괄 갱신이 깔끔하게 처리되었다.
  - describe 블록 타이틀도 함께 갱신되어 일관성이 유지된다.
  - 변경 외 테스트 파일 전반의 유지보수성은 기존과 동일하다.

---

### 파일 5: code.handler.ts

- **[WARNING]** `LEGACY_TO_NORMALIZED` 상수가 사용 위치 아래에 선언되어 있어 코드 탐색을 저해함
  - 위치: `failure()` 내 `LEGACY_TO_NORMALIZED` 참조 (~1936줄) vs 상수 선언 (~1975줄)
  - 상세: TypeScript `const` 는 호이스팅이 없어 `failure()` 가 즉시 실행되지 않으므로 런타임 오류는 발생하지 않는다. 그러나 독자가 파일을 위에서 아래로 읽을 때 `failure()` 에서 상수를 참조하고, 이 상수의 정의를 찾으려면 한참 아래로 스크롤해야 한다. 기존 plan 항목(`LEGACY_TO_NORMALIZED` 파일 상단 이동)에서도 이 문제를 인지하고 있으나 "보류" 처리되었다. `RE_TIMED_OUT`, `RE_MEMORY_LIMIT`, `RE_ISOLATE_DISPOSED` 도 동일한 역전 배치 문제가 있다.
  - 제안: `LEGACY_TO_NORMALIZED`, `RE_*` 를 `CodeHandler` 클래스 선언 이전으로 이동한다. `classifyCodeNodeError` 함수와 함께 두면 논리적 응집성도 높아진다. 현재 plan 의 W4/INFO 항목에 이미 등록되어 있으므로 이번 PR 에서 처리하지 않아도 되나, 코드 네비게이션을 크게 저해하는 수준이다.

- **[INFO]** `classifyCodeNodeError` 반환 타입이 `string` 으로 넓게 선언되어 있다
  - 위치: `export function classifyCodeNodeError(... ): string`
  - 상세: 실제로는 `'EXECUTION_TIMEOUT' | 'EXECUTION_MEMORY_EXCEEDED' | 'CODE_RUNTIME_ERROR'` 세 값만 반환한다. 넓은 반환 타입은 `LEGACY_TO_NORMALIZED` 의 조회 결과가 `ErrorCodeValue` 임에도 `string` 키로 사용해야 하는 이유이기도 하다. `@internal` 함수이므로 좁은 유니온 타입으로 고정하면 매핑 테이블의 타입 안전성이 더 높아진다.
  - 제안: 반환 타입을 `'EXECUTION_TIMEOUT' | 'EXECUTION_MEMORY_EXCEEDED' | 'CODE_RUNTIME_ERROR'` 유니온으로 좁히면 `LEGACY_TO_NORMALIZED` 키도 유니온으로 고정 가능하다. `any` 캐스팅 테스트 픽스처 영향 확인 후 적용한다.

- **[INFO]** `execute()` 함수가 약 160줄에 달해 단일 함수 책임 범위를 초과한다
  - 위치: 라인 1747–1908
  - 상세: isolate 컨텍스트 구성, 호스트 콜백 주입, 부트스트랩 실행, 사용자 코드 실행, $vars 동기화, 성공 반환, 에러 분류·반환이 단일 함수에 혼재한다. 이는 기존 plan 의 W4 항목이며 현재 PR 범위 밖으로 분류되어 있다.
  - 제안: plan 항목(`W4 — execute() 헬퍼 분리`) 대로 후속 처리한다. 현재 PR 에서는 해결 불필요.

---

### 파일 6: http-request.handler.ts

- **[INFO]** 동일 파일 내 나머지 HTTP error code literal 들이 아직 `ErrorCode.*` 참조로 전환되지 않아 부분적 불일관성이 존재한다
  - 위치: `'HTTP_TRANSPORT_FAILED'`, `'HTTP_4XX'`, `'HTTP_5XX'` literal 사용처 다수
  - 상세: `HTTP_BLOCKED` 만 `ErrorCode.*` 참조로 전환된 상태라 파일 내 일관성이 부분적이다. 나머지 HTTP error code literal 들도 `ErrorCode.*` 로 통일하면 `error-codes.ts` 가 진정한 단일 진실 원천이 된다. 이번 PR 범위는 `HTTP_BLOCKED` 에 한정하므로 현재는 허용 가능하다.
  - 제안: `http-request.handler.ts` 내 나머지 error code literal 을 `ErrorCode.*` 로 일괄 전환하는 후속 항목을 plan 에 추가한다.

---

### 파일 7 & 8: plan 문서

- **[INFO]** 변경 내용이 명확하고 완료 근거가 상세하다. 기존 체크박스 미완료 항목과 완료 항목 구분도 일관된다.

---

## 요약

이번 변경은 `CODE_MEMORY_LIMIT`·`HTTP_BLOCKED` 를 classifier 에 등재하고, `classifyError` → `classifyCodeNodeError` 로 이름을 명확히 하며, `LEGACY_TO_NORMALIZED` 의 타입 안전성을 높이는 세 가지 항목을 처리한다. 변경 단위가 작고 의도가 주석으로 명확히 표현되어 있어 가독성이 좋다. 주요 유지보수성 리스크는 두 가지다: (1) `execution-failure-classifier.spec.ts` 에서 `CODE_MEMORY_LIMIT`·`HTTP_BLOCKED` 가 두 `it.each` 블록에 중복 열거되어 향후 코드 변경 시 두 곳을 모두 수정해야 하는 유지보수 부담이 생긴다. (2) `code.handler.ts` 에서 `LEGACY_TO_NORMALIZED` 등 모듈 상수가 사용 위치보다 아래에 선언되어 코드 탐색을 저해하며, 이는 기존 plan 항목으로도 인지된 사항이다. Critical 차단 항목은 없으며, 한 가지 WARNING 과 여러 INFO 수준의 개선 여지가 있다.

## 위험도

LOW
