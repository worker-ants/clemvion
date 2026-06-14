# 정식 규약 준수 검토 — `spec/5-system/14-external-interaction-api.md`

검토 대상: `spec/5-system/14-external-interaction-api.md` (prompt 에 포함된 최신 버전 기준)
검토 모드: spec draft (--spec)
검토 일시: 2026-06-14

---

## 발견사항

### 1. **[CRITICAL]** `error.details` 구조 — 규약(배열)과 target(객체) 불일치

- **target 위치**: §5.1 "에러 응답" JSON 예시 블록
- **위반 규약**: `spec/5-system/2-api-convention.md §5.3`
  규약은 `details` 를 **배열** (`Array<{ field, message, code }>`) 로 정의한다. `GlobalExceptionFilter` 와 `ErrorResponseDto` 가 이 배열 형태를 직렬화한다.
- **상세**: target doc §5.1 은 `"details": { "fieldErrors": [...] }` — 객체 형태를 사용한다.
  이는 두 가지 위반을 만든다.
  1. `details` 의 타입이 배열 → 객체로 바뀐다. 기존 `error.details[0]` 로 파싱하는 클라이언트는 `undefined` 를 받는다.
  2. item 필드가 `{ reason, expected, actual }` 이지만 규약은 `{ message, code: "INVALID_FIELD" }` 이다.
  §3.2 EIA-IN-10 의 "400 + `details.fieldErrors` 반환" 문구 자체가 이 구조를 의도했음을 보여주지만, `api-convention §5.3` 갱신 없이 target doc 만 다른 구조를 채택하면 `GlobalExceptionFilter` 가 실제로 어느 형태를 emit 하는지 모호해진다.
- **제안 (option A — 규약 맞춤)**: §5.1 JSON 예시를 규약 배열 형식으로 변경한다.
  ```jsonc
  "details": [
    { "field": "amount", "message": "min_violated: expected>=100, actual=50", "code": "INVALID_FIELD" }
  ]
  ```
- **제안 (option B — 규약 갱신)**: `spec/5-system/2-api-convention.md §5.3` 에 "도메인별 structured details 허용" 조항을 추가하고, `EiaFieldError` shape (`{ field, reason, expected?, actual? }`) 를 `fieldErrors` 키 아래 객체로 확장하는 변형을 허용으로 등록한 뒤 target doc 를 그에 맞춘다.

---

### 2. **[CRITICAL]** 에러 코드 `VALIDATION_FAILED` — 규약 기본값 `VALIDATION_ERROR` 와 다름, 채택 근거 누락

- **target 위치**: §5.1 에러 표 1행 및 JSON 예시 블록 `"code": "VALIDATION_FAILED"`
- **위반 규약**: `spec/5-system/2-api-convention.md §5.3`
  > `code` 의 상태코드별 기본값: 400=`VALIDATION_ERROR`
  `spec/conventions/error-codes.md §2` — 에러 코드 rename 은 breaking change, 신규 코드는 처음부터 의미 정확한 이름을 부여해 후속 rename 압력을 만들지 않는다.
- **상세**: target doc 는 `VALIDATION_FAILED` 를 400 form-validation 코드로 사용한다. 규약 기본값 `VALIDATION_ERROR` 와 다르다. R13 (§Rationale) 은 EIA REST 표면에서 표면별 코드명을 쓸 수 있다고 선언하지만, 그 원칙은 WS 내부 코드 네임스페이스(`EXECUTION_*`, `INVALID_EXECUTION_STATE` 등)와 EIA 표면 코드(`STATE_MISMATCH`, `MESSAGE_TOO_LONG`) 의 divergence 를 설명한다. `VALIDATION_ERROR` 와 `VALIDATION_FAILED` 는 둘 다 외부 REST 표면 코드이므로 R13 의 "WS 내부 코드 vs EIA 표면 코드" 논리가 여기에는 적용되지 않는다. 채택 근거가 Rationale 에 없다.
- **제안**:
  - `VALIDATION_ERROR` 로 통일해 규약 기본값을 따르거나 (가장 간단),
  - `VALIDATION_FAILED` 를 유지하되 Rationale 에 근거(예: "form validation failure 와 schema validation error 를 구분하기 위해 별도 코드 사용")를 추가하고 `error-codes.md §3` 에 등록한다.

---

### 3. **[WARNING]** §5.2 "이벤트 종류" 인라인 목록에 `execution.node.cancelled` 누락

- **target 위치**: §5.2 "이벤트 종류" 인라인 열거 문단
- **위반 규약**: 문서 내부 일관성 — §11 WS↔SSE 매핑 표에는 `execution.node.cancelled` 가 SSE event 로 명시됨
- **상세**: §5.2 의 인라인 목록은 `execution.node.started / execution.node.completed / execution.node.failed / execution.node.skipped / ...` 를 열거하면서 `execution.node.cancelled` 를 빠뜨렸다. §11 매핑 표에는 이 이벤트가 존재한다. 독자가 §5.2 만 보면 해당 이벤트가 SSE 로 전달되지 않는다고 오해할 수 있다.
- **제안**: §5.2 이벤트 종류 목록에 `execution.node.cancelled` 를 추가한다.

---

### 4. **[WARNING]** `TOO_MANY_CONNECTIONS` 에러 코드 — 규약 미등록, 429 기본값(`RATE_LIMITED`)과 다름

- **target 위치**: §5.1 에러 표 429 행 주석 및 §8.4 Rate Limit 표
  > 구현된 유일한 429 는 SSE 동시연결 초과 (`TOO_MANY_CONNECTIONS`, §5.2)
- **위반 규약**: `spec/5-system/2-api-convention.md §5.3` — 429 기본값 `RATE_LIMITED`; `spec/conventions/error-codes.md §1·§2` — 신규 코드는 처음부터 명명하고 등록
- **상세**: `TOO_MANY_CONNECTIONS` 는 SSE 동시 연결 초과를 의미하는 별도 코드로 쓰이고 있으나, `api-convention §5.3` 의 "429 기본값 = `RATE_LIMITED`" 와 다르고, `error-codes.md §3` (historical-artifact 레지스트리)에도 등록되어 있지 않다. 클라이언트가 `RATE_LIMITED` 로 429 를 처리하면 SSE 연결 초과를 rate-limit 과 구분하지 못한다.
- **제안**: `TOO_MANY_CONNECTIONS` 를 `error-codes.md §3` 에 EIA 전용 코드로 등록하거나, `RATE_LIMITED` 로 통일해 규약과 정렬하고 §8.4 에 코드를 명시한다.

---

### 5. **[INFO]** 응답 DTO 파일 경로 — `swagger.md §5-1` 규약 패턴 미반영

- **target 위치**: §10 파일 구조 목록 내 `dto/` 항목들 (`interact.dto.ts`, `responses.dto.ts` 등)
- **관련 규약**: `spec/conventions/swagger.md §5-1`
  > `codebase/backend/src/modules/<module>/dto/responses/*-response.dto.ts`
- **상세**: §10 의 파일 구조에서 응답 DTO 는 `dto/responses.dto.ts` (단일 파일) 로 명시되어 있다. swagger.md §5-1 은 응답 DTO 를 `dto/responses/` 하위 복수 파일로 배치하도록 요구한다. 분리 없이 단일 파일에 모을 경우 spec 과 규약이 다른 구조를 가리키게 된다.
- **제안**: §10 파일 구조를 `dto/responses/interact-ack.response.dto.ts`, `dto/responses/execution-status.response.dto.ts` 등 규약 패턴으로 정정한다. 또는 단일 파일 사용 이유(소규모 DTO 집합)를 §10 주석으로 명시한다.

---

### 6. **[INFO]** (확인됨 PASS) `error.details` 예시에 `requestId` 포함

- **target 위치**: §5.1 JSON 예시 블록
- **관련 규약**: `spec/5-system/2-api-convention.md §5.3`
  > `requestId`: 모든 에러 응답에 항상 포함되는 추적용 UUID
- **상세**: target doc 가 `"requestId": "3f2a…"` 를 에러 예시에 포함한 것은 규약을 올바르게 따른다. 규약 준수. 추가 조치 불필요.

---

## 요약

정식 규약 준수 관점에서 두 건의 CRITICAL 이슈가 있다. (1) `error.details` 를 `api-convention §5.3` 이 정의한 배열 형태 대신 `{ fieldErrors: [...] }` 객체로 사용하고 있어, `GlobalExceptionFilter` 가 실제로 emit 하는 형태와 spec 이 충돌하거나 규약이 암묵적으로 확장된다. (2) `VALIDATION_FAILED` 코드가 규약 기본값 `VALIDATION_ERROR` 와 다르게 쓰이나 채택 근거가 Rationale 에 없다. WARNING 2건(SSE 이벤트 목록 누락, `TOO_MANY_CONNECTIONS` 미등록)과 INFO 1건(응답 DTO 파일 경로)은 내부 일관성 문제이나 외부 계약을 직접 깨지는 않는다. 토큰 실패 계열 401 통일(TOKEN_* prefix)·`requestId` 포함·`@ApiBearerAuth('interaction-token')` 지시는 규약을 올바르게 따른다.

## 위험도

**HIGH**
