# 요구사항(Requirement) 리뷰 — 인증 webhook 1MB body 게이트 (옵션 C) + 공개 webhook 보호 우회 fix

## 발견사항

### **[INFO]** 기능 완전성: WH-NF-02 옵션 C 전체 구현 확인
- 위치: `hooks-body-parser.ts`, `main.ts`, `public-webhook-throttle.guard.ts`, `http-exception.filter.ts`
- 상세: spec WH-NF-02 가 요구하는 세 경계가 모두 구현됐다.
  1. `/api/hooks/*` 라우트 스코프 1MB 파서 (`createHooksBodyParsers`) — `main.ts` 에서 hooks 파서를 전역보다 먼저 등록해 body-parser idempotency 가드로 전역 100KB 재파싱을 차단.
  2. non-webhook 라우트 100KB 전역 방어선 보존 (`createGlobalBodyParsers`) — `bodyParser: false` 로 Nest 기본 파서를 끄고 직접 등록해 non-hooks 본문 미파싱 함정 회피.
  3. 공개 webhook 32KB Guard(`PublicWebhookThrottleGuard`) 는 라우트 스코프 파서 위에서 별도 계층으로 유지.
- 제안: 없음.

### **[INFO]** 기능 완전성: 보안 버그 수정 (공개 webhook 보호 우회)
- 위치: `public-webhook-throttle.guard.ts` L72–74
- 상세: `select: { authConfigId: true }` partial projection 제거로 full entity 로드 전환. TypeORM partial projection 이 `authConfigId` 를 `null` 대신 비-null 로 잘못 반환해 모든 공개 webhook 이 인증 webhook 으로 오판되던 pre-existing 보안 버그가 수정됐다. W14 패턴(`req.__publicWebhookTrigger` 첨부)으로 HooksService 의 중복 DB 조회도 제거됐다.
- 제안: 없음.

### **[INFO]** 엣지 케이스: `captureRawBody` 빈 Buffer 처리 정확
- 위치: `hooks-body-parser.ts` L73
- 상세: `if (buf)` 조건은 빈 Buffer(`length === 0`)도 `rawBody` 에 세팅한다. JSDoc 주석이 "body-parser 는 빈 본문이라도 verify 를 호출할 수 있다 — 빈 Buffer도 그대로 세팅해 빈 본문 서명 검증이 rawBody 부재로 깨지지 않게 한다"고 명시해 의도가 분명하다. RESOLUTION W3 조치 결과이며 정확하다.
- 제안: 없음.

### **[INFO]** 엣지 케이스: `resolveHooksMaxBodyBytes` 검증 경계 완전
- 위치: `hooks-body-parser.ts` L192–202
- 상세: `0`, 음수, `NaN`, `Infinity`, 비숫자 문자열, 빈 문자열 모두 기본값(`HOOKS_MAX_BODY_BYTES`)으로 폴백한다. 소수점 값은 `Math.floor` 로 정수화. `HOOKS_MAX_BODY_BYTES_CEILING`(16MiB) 초과 시 클램프 + 경고 로그. 단위 테스트(`hooks-body-parser.spec.ts`) 가 모든 경계를 커버하고 있다.
- 제안: 없음.

### **[INFO]** 엣지 케이스: `measureBodyBytes` 보수적 차단
- 위치: `public-webhook-throttle.guard.ts` L131–143
- 상세: rawBody 우선 측정 → 직렬화 추정 → 직렬화 불가 시 `maxBodyBytes + 1` 로 보수적 차단. `body === undefined || body === null` 시 0 반환. 순환 참조 등 직렬화 예외도 catch 후 보수적으로 처리.
- 제안: 없음.

### **[INFO]** 에러 시나리오: `GlobalExceptionFilter` 의 4xx http-errors 매핑
- 위치: `http-exception.filter.ts` L104–117
- 상세: `mapHttpErrorLike` 가 `status` / `statusCode` duck-typing 으로 4xx 를 추출해 표준 봉투로 직렬화. 5xx·상태 부재는 null 반환 → generic 500 마스킹으로 내부 메시지 누출 차단. `getCodeFromStatus` 에 413 case 추가로 `PAYLOAD_TOO_LARGE` 코드 반환. `logger.warn` 으로 4xx http-error 원본 메시지를 로깅(운영 가시성 확보, RESOLUTION W5 조치).
- 제안: 없음.

### **[INFO]** spec fidelity: `WH-NF-02` / `§6` / `§8` / `error-handling §1.3` / `api-convention §5.3·§6` 전반 일치 확인
- 위치: `spec/5-system/12-webhook.md WH-NF-02`, `spec/5-system/3-error-handling.md §1.3·§1.7`, `spec/5-system/2-api-convention.md §5.3·§6`
- 상세: spec 문서들이 구현과 line-level 로 일치한다.
  - `HOOKS_MAX_BODY_BYTES` = 1MiB, `HOOKS_MAX_BODY_BYTES_CEILING` = 16MiB, `GLOBAL_MAX_BODY_BYTES` = 100KB: 구현 일치.
  - `createHooksBodyParsers` / `createGlobalBodyParsers` 함수명: 구현 일치.
  - `HOOKS_ROUTE_PREFIX = '/api/hooks'`: 구현 일치.
  - `413 PAYLOAD_TOO_LARGE`: api-convention §6 표 178행 일치, error-handling §1.3 표 47행 일치.
  - `PUBLIC_WEBHOOK_BODY_TOO_LARGE`: error-handling §1.7 표 138행 일치, webhook §8 일치.
  - `bodyParser: false` + hooks 먼저 등록 + 전역 명시 등록: spec WH-NF-02·§6 기술 일치.
  - `getCodeFromStatus(413) = 'PAYLOAD_TOO_LARGE'`: api-convention §5.3 기본값 테이블(162행) 일치.
- 제안: 없음.

### **[WARNING]** e2e 테스트 L — `requestId` 검증 누락
- 위치: `test/webhook-trigger.e2e-spec.ts` L327–328
- 상세: api-convention §5.3 은 "requestId: 모든 에러 응답에 항상 포함"을 명시한다. e2e L(공개 webhook 32KB 초과 → 413 PUBLIC_WEBHOOK_BODY_TOO_LARGE) 테스트가 `res.body.error.code` 만 단언하고 `requestId` 를 검증하지 않는다. K 테스트(413 PAYLOAD_TOO_LARGE)는 `requestId` 단언이 있다. 기능상 `GlobalExceptionFilter` 가 `HttpException` 경로로 `requestId` 를 발급하므로 런타임 동작은 정확하나, 회귀 가드 완전성이 부족하다.
- 제안: L 테스트에 `expect(res.body.error.requestId).toBeDefined()` 추가. M / N 테스트에도 동일 단언 추가 권장.

### **[INFO]** 비즈니스 로직: `preloadedTrigger` undefined vs null 구분 정확
- 위치: `hooks.service.ts` L612–617
- 상세: `preloadedTrigger !== undefined ? preloadedTrigger : await findOne(...)` 패턴이 "전달 안 됨(`undefined`) = 직접 조회, 전달됨(`null`) = 미존재 trigger"를 정확하게 구분한다. Guard 가 `null` 을 세팅하는 경우(trigger 미존재)를 올바르게 재사용한다.
- 제안: 없음.

### **[INFO]** 반환값: `canActivate` 모든 경로에서 적절한 값 반환
- 위치: `public-webhook-throttle.guard.ts` L53–124
- 상세:
  - `endpointPath` 미존재 → `true` (방어적 통과, 이미 기존 동작)
  - trigger DB 조회 예외 → `true` (fail-open, 주석 명시)
  - trigger 미존재 → `true` (HooksService 가 404 처리)
  - authConfigId 존재(인증 webhook) → `true`
  - 공개 webhook + body 초과 → `PayloadTooLargeException` throw
  - IP 미식별 → `true` (fail-open)
  - rate-limit 초과 → `HttpException` throw
  - rate-limit 통과 → `true`
  모든 분기가 명시적으로 처리됐다.
- 제안: 없음.

### **[INFO]** `PublicWebhookThrottleGuard` — trigger 조회 후 `req.__publicWebhookTrigger` 세팅 위치
- 위치: `public-webhook-throttle.guard.ts` L84
- 상세: `req.__publicWebhookTrigger = trigger` 가 `if (!trigger) return true` **전**에 위치해, trigger 가 null(미존재) 인 경우에도 req 에 `null` 이 첨부된다. 이는 `HooksService` 가 `preloadedTrigger !== undefined` 조건으로 null 을 올바르게 처리할 수 있게 한다. 의도적이고 정확하다.
- 제안: 없음.

### **[INFO]** WH-EP-04 form-urlencoded 지원 — 두 파서 모두 포함
- 위치: `hooks-body-parser.ts` L81–82
- 상세: spec WH-EP-04 ("JSON, form-urlencoded 요청 본문 수신 — 필수")에 따라 `json()` + `urlencoded()` 쌍이 모두 hooks 파서 및 전역 파서에 포함됐다. `extended: true` 로 중첩 객체 파싱 지원.
- 제안: 없음.

### **[INFO]** HMAC rawBody 보존 — `captureRawBody` 가 두 파서(hooks + 전역) 모두에 적용
- 위치: `hooks-body-parser.ts` L81–82, L106
- 상세: `buildBodyParsers` 공통 팩토리를 통해 hooks 파서와 전역 파서 모두 `verify: captureRawBody` 가 적용된다. `createGlobalBodyParsers` 가 rawBody 를 보존하는 것이 non-webhook 경로에서 불필요한 메모리 할당이지만 HMAC 경로(hooks 전용)와 코드 일관성을 위해 허용 가능하다. e2e J(512KB HMAC 202)가 hooks 파서의 rawBody 보존을 검증한다.
- 제안: 없음.

---

## 요약

WH-NF-02 옵션 C(인증 webhook 1MB 게이트 + 공개 webhook 32KB Guard 유지 + non-webhook 100KB 전역 방어선 보존)가 완전하게 구현됐으며, spec 문서(`12-webhook.md WH-NF-02·§6·§8`, `3-error-handling.md §1.3·§1.7`, `2-api-convention.md §5.3·§6`)와 line-level 로 일치한다. 공개 webhook 보호 우회 보안 버그(partial TypeORM projection 오동작)도 full entity 로드로 정확히 수정됐고, 에러 코드·반환값·엣지 케이스 처리 모두 적절하다. 유일한 미흡점은 e2e 테스트 L(public webhook 413)이 api-convention §5.3 에서 명시적으로 요구하는 `requestId` 필드를 단언하지 않는 것으로, 기능 동작은 정확하지만 회귀 가드 완전성이 부족하다(WARNING).

---

## 위험도

LOW
