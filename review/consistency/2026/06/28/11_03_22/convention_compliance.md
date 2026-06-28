# 정식 규약 준수 검토 결과

**검토 대상**: `spec/5-system/12-webhook.md`
**검토 모드**: spec draft (--spec)
**검토 일시**: 2026-06-28

---

## 발견사항

### [CRITICAL] §5.2 400 응답 형식이 API 규약 에러 봉투(`error.code/message/requestId/details`)를 위반

- **target 위치**: `spec/5-system/12-webhook.md` §5.2 "400 응답 형식" (라인 312–324)
- **위반 규약**: `spec/5-system/2-api-convention.md §5.3 에러 응답`
- **상세**: 타깃 문서 §5.2 는 파라미터 검증 실패 400 응답을 아래와 같이 정의한다.

  ```json
  {
    "statusCode": 400,
    "message": "Invalid webhook payload",
    "errors": [
      { "field": "orderId", "reason": "missing_required" },
      { "field": "amount", "reason": "coerce_failed" }
    ]
  }
  ```

  그러나 프로젝트 공식 에러 봉투 규약(`api-convention §5.3`)은 다음 구조를 요구한다.

  ```json
  {
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "...",
      "requestId": "<uuid>",
      "details": [
        { "field": "orderId", "message": "This field is required", "code": "INVALID_FIELD" }
      ]
    }
  }
  ```

  타깃의 `statusCode` top-level 키, `errors` 배열 키 이름, `reason` 필드 키는 규약에 없는 형식이다. 규약은 `error.details[].reason` 대신 `error.details[].message` + `error.details[].code` 를 쓴다. 또한 `requestId` 가 빠져 있고 최상위 래퍼가 `error` 가 아닌 flat 구조다. 이 불일치가 그대로 구현되면 `GlobalExceptionFilter` 의 실제 출력과 spec 이 어긋나거나, 구현자가 spec 대로 커스텀 응답을 만들어 `GlobalExceptionFilter` 를 우회하게 된다.

- **제안**: §5.2 400 응답 형식을 공식 에러 봉투로 교체한다.

  ```json
  {
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Invalid webhook payload",
      "requestId": "<uuid>",
      "details": [
        { "field": "orderId", "message": "required field missing", "code": "INVALID_FIELD" },
        { "field": "amount", "message": "type coercion failed", "code": "INVALID_FIELD" }
      ]
    }
  }
  ```

  `GlobalExceptionFilter` 가 표준 봉투를 발행한다면 §5.2 의 400 응답도 그 봉투를 따른다는 주석("`GlobalExceptionFilter` 를 통해 발행됨")을 추가하면 독자 혼동을 방지할 수 있다. 만약 이 400 이 `GlobalExceptionFilter` 바깥(컨트롤러 직접 throw HttpException)에서 발행되는 경우에도 봉투 구조는 동일하게 맞춰야 한다.

---

### [WARNING] §5.2 에러 세부 필드 `reason` 키 — `error-codes.md` 명명 규약과 불일치

- **target 위치**: `spec/5-system/12-webhook.md` §5.2 `errors[].reason` 필드 (라인 319–321)
- **위반 규약**: `spec/conventions/error-codes.md §1` (의미 기반 명명), `spec/5-system/2-api-convention.md §5.3` (`details[].code`)
- **상세**: 타깃 §5.2 의 `reason` 값 `"missing_required"` / `"coerce_failed"` 는 `lower_snake_case` 이며, `error-codes.md §1` 이 요구하는 `UPPER_SNAKE_CASE` 에러 코드 표기가 아니다. 공식 봉투의 `details[].code` 필드는 `"INVALID_FIELD"` 처럼 `UPPER_SNAKE_CASE` 를 쓴다. `reason` 키 자체도 규약에 없는 신설 키다. 이대로 구현되면 `error-codes.md §3` 의 레지스트리에도 등록되지 않은 저규격 에러 코드가 wire 에 노출된다.
- **제안**: §5.2 의 `reason` 필드를 `code` 로 교체하고 값을 `UPPER_SNAKE_CASE` 로 변경한다(`"MISSING_REQUIRED_FIELD"`, `"TYPE_COERCION_FAILED"` 등). 신규 에러 코드는 `error-codes.md §1` 의 의미 기반 명명 원칙에 따라 이름을 부여하고, 필요 시 `error-codes.md §3` 레지스트리에 등재하거나 `ErrorCode` enum 에 추가한다.

---

### [WARNING] Rate limit 에러 코드 `PUBLIC_WEBHOOK_RATE_LIMIT` / `PUBLIC_WEBHOOK_HOURLY_LIMIT` — 도메인 레지스트리 미등록

- **target 위치**: `spec/5-system/12-webhook.md` §6 구현 파일 구조 (라인 342), §8 보안 고려사항 (라인 394)
- **위반 규약**: `spec/conventions/error-codes.md §1` (의미 기반 명명 + 적용 범위: 프로젝트 전체 에러 코드 문자열)
- **상세**: `PUBLIC_WEBHOOK_RATE_LIMIT` 과 `PUBLIC_WEBHOOK_HOURLY_LIMIT` 은 `UPPER_SNAKE_CASE` 라 표기 형식은 맞다. 그러나 `error-codes.md §1` 의 적용 범위는 "프로젝트 전체의 에러 코드 문자열(API·통합·OAuth 등에서 인라인 문자열 리터럴로 발행되는 코드 포함)" 이다. 이 두 코드는 `error-codes.md §3` 레지스트리에 없고, `codebase/backend/src/nodes/core/error-codes.ts` (`AUDIT_ACTIONS` 유사 union 위치) 에 추가 여부도 확인되지 않는다. `error-codes.md §4 내부 전용 분류 코드` 패턴도 아니다. 신규 에러 코드가 레지스트리에 등재 없이 spec 에 직접 등장하는 구조라 명명 일관성 추적이 불가능해진다.
- **제안**: 두 에러 코드를 `error-codes.md §3` 또는 별도 도메인 레지스트리(예: `3-error-handling.md §1` 카탈로그)에 공식 등재한다. 카탈로그 SoT 가 `3-error-handling.md §1` 이라면 해당 문서에 추가 후 본 webhook spec 에서 cross-link 를 달아준다. `error-codes.md §1` 에 따르면 코드 이름은 "의미(조건)를 기술" 해야 하며, `PUBLIC_WEBHOOK_RATE_LIMIT` 는 "공개 웹훅 IP 단위 분당 초과" 라는 조건을 잘 기술하므로 명명 자체는 수용 가능하다.

---

### [WARNING] §5.2 `WH-EP-05-2` 요구사항 ID와 §5.2 섹션 간 응답 형식 불일치 (이중 정의 위험)

- **target 위치**: `spec/5-system/12-webhook.md` §3.1 WH-EP-05-2 (라인 78), §5.2 "400 응답 형식" (라인 313–324)
- **위반 규약**: CLAUDE.md "단일 진실 원칙" — 동일 정보를 두 곳에 정의하면 diverge 위험
- **상세**: WH-EP-05-2 는 "required 파라미터 누락 또는 타입 강제 변환 실패 시 `400 Bad Request`와 누락 필드 목록 반환" 이라 간략히 기술하고, §5.2 가 구체 포맷을 정의한다. 그러나 §5.2 의 포맷이 `api-convention §5.3` 봉투를 따르지 않아(위 CRITICAL 참조), 두 spec 이 동시에 SoT 를 주장하는 상황이 된다. 만약 §5.2 를 규약 봉투로 수정하면 WH-EP-05-2 의 "누락 필드 목록" 언급이 `error.details[]` 로 자연스럽게 귀결되어 단일 진실이 유지된다.
- **제안**: CRITICAL 항(§5.2 포맷 수정)과 함께 처리하면 자연스럽게 해소된다. WH-EP-05-2 의 "누락 필드 목록 반환" 문구를 "누락 필드 목록 `error.details[]` 반환 (§5.2 및 [api-convention §5.3](./2-api-convention.md#53-에러-응답) 봉투 참조)" 로 구체화하면 단일 진실 구조가 명확해진다.

---

### [INFO] `AUTH_FAILED` 에러 코드 표기 — `error-codes.md §3` 레지스트리 미등록 여부 확인 권장

- **target 위치**: `spec/5-system/12-webhook.md` WH-SC-04, §3.1 API 명세, §4 인증 방식, §7 처리 흐름
- **위반 규약**: `spec/conventions/error-codes.md §1` 적용 범위
- **상세**: `AUTH_FAILED` 는 `UPPER_SNAKE_CASE` 로 명명 형식은 맞고, 의미 기반(인증 실패 단일 코드)이며 enumeration 방지 목적이 분명하다. 단 `error-codes.md §3` historical-artifact 레지스트리나 `3-error-handling.md §1` 카탈로그에서 공식 등재 여부를 확인하지 못했다. `lower_snake_case` 초대 코드처럼 breaking change 가 될 경우 §3 에 등재해야 한다. 현재로서는 CRITICAL/WARNING 수준은 아니지만 명시적 등재 여부를 확인할 것을 권장한다.
- **제안**: `3-error-handling.md §1` 카탈로그에 `AUTH_FAILED`(401) 항목 등재 여부를 확인하고, 없으면 추가한다. 본 webhook spec 에서 해당 카탈로그로 cross-link 를 달면 추적 완결성이 높아진다.

---

### [INFO] 문서 헤딩 구조 — "## Overview (제품 정의)" 안에 `---` 수평선이 불필요하게 삽입

- **target 위치**: `spec/5-system/12-webhook.md` 라인 44–46 (`## Overview (제품 정의)` 바로 아래 `---`)
- **위반 규약**: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" — 각 섹션이 `##` 헤딩으로 구분되므로, 섹션 헤딩 직후 수평선은 중복 구분이며 일관되지 않다
- **상세**: 다른 spec 문서에서는 섹션 시작 직후 `---` 를 두지 않는 것이 일반적이다. `## Overview` 헤딩 바로 아래 빈 줄 + `---` 가 있어 렌더링 시 두 번의 시각적 구분이 생긴다. 사소한 형식 일관성 문제.
- **제안**: `## Overview (제품 정의)` 아래의 `---` (라인 46)을 제거한다. 이후 `### 1. 개요` 시작 전 빈 줄만 남기면 된다.

---

## 요약

`spec/5-system/12-webhook.md` 는 명명 규약(`UPPER_SNAKE_CASE` 에러 코드), 문서 구조(Overview/본문/Rationale 3섹션), frontmatter(id/status/code/pending_plans) 측면에서 전반적으로 정식 규약을 잘 준수하고 있다. 가장 심각한 문제는 §5.2 파라미터 검증 실패 400 응답 형식이 `api-convention §5.3` 의 공식 에러 봉투 구조(`{ error: { code, message, requestId, details } }`)를 따르지 않고 독자적인 `{ statusCode, message, errors[].reason }` 구조를 정의한 점(CRITICAL)이다. 이와 연계해 `errors[].reason` 의 `lower_snake_case` 값이 `error-codes.md §1` 의 `UPPER_SNAKE_CASE` 명명 규율을 위반하고(WARNING), `PUBLIC_WEBHOOK_RATE_LIMIT` 등 신규 에러 코드가 공식 레지스트리에 등재되지 않은 상태로 spec 에 직접 등장하는 추적 공백(WARNING)이 있다. 이 CRITICAL 1건과 WARNING 2건을 수정하면 정식 규약과의 정합성이 크게 높아진다.

## 위험도

**HIGH**
