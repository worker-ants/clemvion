# 요구사항(Requirement) 리뷰 — 인증 webhook 1MB body 게이트 + 공개 webhook 보호 우회 fix

## 발견사항

### **[INFO]** 기능 완전성: WH-NF-02 옵션 C 3-레이어 경계 전체 구현 확인

- 위치: `codebase/backend/src/bootstrap/hooks-body-parser.ts`, `codebase/backend/src/main.ts`, `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts`, `codebase/backend/src/common/filters/http-exception.filter.ts`
- 상세: spec WH-NF-02 가 요구하는 세 경계가 모두 구현됐다.
  1. `/api/hooks/*` 라우트 스코프 1MB 파서(`createHooksBodyParsers`) — `main.ts` L167 에서 hooks 파서를 전역보다 먼저 등록해 body-parser idempotency 가드로 전역 100KB 재파싱 차단.
  2. non-webhook 라우트 100KB 전역 방어선 보존(`createGlobalBodyParsers`) — `bodyParser: false` 로 Nest 기본 파서를 끄고 직접 명시 등록해 non-hooks 본문 미파싱 함정 회피(WH-NF-02 명시 요구사항).
  3. 공개 webhook 32KB Guard(`PublicWebhookThrottleGuard`) 별도 계층 유지 — `DEFAULT_MAX_BODY_BYTES = 32 * 1024` spec §4 와 일치.
- 제안: 없음.

### **[INFO]** 기능 완전성: 공개 webhook 보호 우회 보안 버그 수정

- 위치: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` L72–74
- 상세: `select: { authConfigId: true }` partial projection 제거 후 full entity 로드 전환. TypeORM partial projection 이 `authConfigId` 를 `null` 대신 비-null 로 잘못 반환해 모든 공개 webhook 이 인증 webhook 으로 오판되던 pre-existing 보안 버그가 수정됐다. W14 패턴(`req.__publicWebhookTrigger` 첨부)으로 HooksService 의 중복 DB 조회도 제거됐다. e2e L 케이스가 이 회귀 가드를 커버한다.
- 제안: 없음.

### **[WARNING]** 이전 리뷰(15_41_50/requirement.md)의 오탐 — L 테스트 `requestId` 검증 누락 주장은 사실 아님

- 위치: `codebase/backend/test/webhook-trigger.e2e-spec.ts` L333
- 상세: 이전 requirement 리뷰(15_41_50/requirement.md)는 "e2e 테스트 L — `requestId` 검증 누락"을 WARNING 으로 보고했다. 그러나 현재 코드에서 L 테스트 L333 에는 `expect(res.body.error.requestId).toBeDefined()` 단언이 이미 존재한다. M 테스트(L351)·N 테스트(L366)도 동일하게 `requestId` 단언을 포함하고 있다. 이전 리뷰가 RESOLUTION 적용 후 갱신된 코드를 반영하지 못한 것으로 보인다. api-convention §5.3 요구사항("requestId: 모든 에러 응답에 항상 포함")은 K/L/M/N 테스트 모두에서 검증된다.
- 제안: 이전 리뷰의 WARNING 은 오탐으로 처리. 별도 조치 불필요.

### **[INFO]** 엣지 케이스: `captureRawBody` 빈 Buffer 처리 정확

- 위치: `codebase/backend/src/bootstrap/hooks-body-parser.ts` L74
- 상세: `if (buf)` 조건은 빈 Buffer(`length === 0`)도 truthy 이므로 `req.rawBody` 에 세팅된다. JSDoc L65–66 이 "body-parser 는 빈 본문이라도 verify 를 호출할 수 있다 — 빈 Buffer(`length === 0`)도 그대로 세팅해, 빈 본문 서명 요청의 HMAC 검증이 `rawBody` 부재로 깨지지 않게 한다"고 명시하며, 인라인 주석 L73 이 "`buf.length` 체크 재도입 금지"를 명문화했다. RESOLUTION W3 조치 완료.
- 제안: 없음.

### **[INFO]** 엣지 케이스: `resolveHooksMaxBodyBytes` 경계값 처리 완전

- 위치: `codebase/backend/src/bootstrap/hooks-body-parser.ts` L44–57
- 상세: `0`, 음수, `NaN`, `Infinity`, 비숫자 문자열, 빈 문자열 모두 `HOOKS_MAX_BODY_BYTES`(기본값)로 폴백한다. 소수점은 `Math.floor` 로 정수화. `HOOKS_MAX_BODY_BYTES_CEILING`(16MiB) 초과 시 클램프 + 경고 로그. spec WH-NF-02 의 "상한 `HOOKS_MAX_BODY_BYTES_CEILING` 16MiB — 과도한 override 로 인한 OOM 방지 클램프" 요구사항과 일치.
- 제안: 없음.

### **[INFO]** 엣지 케이스: `measureBodyBytes` 보수적 차단

- 위치: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` L131–143
- 상세: rawBody 우선 측정 → 직렬화 추정 → 직렬화 불가 시 `maxBodyBytes + 1` 로 보수적 차단. `body === undefined || body === null` 시 0 반환. 순환 참조 등 직렬화 예외도 catch 후 보수적으로 처리.
- 제안: 없음.

### **[INFO]** 에러 시나리오: `GlobalExceptionFilter` 의 4xx http-errors 매핑

- 위치: `codebase/backend/src/common/filters/http-exception.filter.ts` L104–117
- 상세: `mapHttpErrorLike` 가 `status`/`statusCode` duck-typing 으로 4xx 를 추출해 표준 봉투로 직렬화. 5xx·상태 부재는 null 반환 → generic 500 마스킹으로 내부 메시지 누출 차단. `getCodeFromStatus` 에 `case 413: return 'PAYLOAD_TOO_LARGE'` 추가로 api-convention §5.3 기본값 테이블("413=`PAYLOAD_TOO_LARGE`") 일치. `logger.warn` 으로 4xx http-error 원본 메시지를 로깅(운영 가시성 확보, L75–76).
- 제안: 없음.

### **[INFO]** spec fidelity: WH-NF-02 / spec §6·§8 / error-handling §1.3·§1.7 / api-convention §5.3·§6 전반 일치

- 위치: `spec/5-system/12-webhook.md WH-NF-02`, `spec/5-system/3-error-handling.md §1.3·§1.7`, `spec/5-system/2-api-convention.md §5.3·§6`
- 상세:
  - `HOOKS_MAX_BODY_BYTES = 1024 * 1024`(1MiB): spec WH-NF-02 "인증 webhook 1MB" 일치.
  - `HOOKS_MAX_BODY_BYTES_CEILING = 16 * 1024 * 1024`(16MiB): spec WH-NF-02 "상한 16MiB" 일치.
  - `GLOBAL_MAX_BODY_BYTES = 100 * 1024`(100KB): spec WH-NF-02 "전역 100KB 방어선" 일치.
  - `createHooksBodyParsers` / `createGlobalBodyParsers`: spec WH-NF-02 함수명 명시 일치.
  - `HOOKS_ROUTE_PREFIX = '/api/hooks'`: spec WH-NF-02 라우트 prefix 일치.
  - `413 PAYLOAD_TOO_LARGE`: api-convention §6 표 / error-handling §1.3 표 일치.
  - `PUBLIC_WEBHOOK_BODY_TOO_LARGE` 413: error-handling §1.7 표 L138 / webhook §8 일치.
  - `DEFAULT_MAX_BODY_BYTES = 32 * 1024`(32KB): spec §4 body 32KB 일치.
  - `bodyParser: false` + hooks 먼저 등록 + 전역 명시 등록: spec WH-NF-02 기술 일치.
  - `getCodeFromStatus(413) = 'PAYLOAD_TOO_LARGE'`: api-convention §5.3 기본값 테이블 일치.
- 제안: 없음.

### **[INFO]** 비즈니스 로직: `preloadedTrigger` undefined vs null 구분 정확

- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` L104–109
- 상세: `preloadedTrigger !== undefined ? preloadedTrigger : await findOne(...)` 패턴이 "전달 안 됨(`undefined`) = 직접 조회, 전달됨(`null`) = 미존재 trigger"를 정확하게 구분한다. Guard 가 `null` 을 세팅하는 경우(trigger 미존재)도 올바르게 재사용한다. JSDoc 주석 L85 가 이 의미 구분을 명시한다.
- 제안: 없음.

### **[INFO]** 반환값: `canActivate` 모든 경로에서 적절한 값 반환

- 위치: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` L53–124
- 상세:
  - `endpointPath` 미존재 → `true` (방어적 통과 L63)
  - trigger DB 조회 예외 → `true` (fail-open L80, 주석 명시)
  - trigger 미존재 → `true` (HooksService 가 404 처리 L86)
  - `authConfigId !== null`(인증 webhook) → `true` (L89)
  - 공개 webhook + body 초과 → `PayloadTooLargeException` throw (L94–99)
  - IP 미식별 → `true` (fail-open L106)
  - rate-limit 초과 → `HttpException` throw (L110–122)
  - rate-limit 통과 → `true` (L124)
  모든 분기가 명시적으로 처리됐다.
- 제안: 없음.

### **[INFO]** `req.__publicWebhookTrigger` 세팅 위치 — null 케이스도 올바르게 처리

- 위치: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` L84·L86
- 상세: `req.__publicWebhookTrigger = trigger` 가 `if (!trigger) return true` **전**에 위치(L84)해, trigger 가 null(미존재)인 경우에도 req 에 `null` 이 첨부된다. HooksService 가 `preloadedTrigger !== undefined` 조건으로 null 을 "trigger 미존재"로 올바르게 처리한다. 의도적이고 정확하다.
- 제안: 없음.

### **[INFO]** WH-EP-04 form-urlencoded 지원 — 두 파서 모두 포함

- 위치: `codebase/backend/src/bootstrap/hooks-body-parser.ts` L81–84
- 상세: spec WH-EP-04 ("JSON, form-urlencoded 요청 본문 수신 — 필수")에 따라 `json()` + `urlencoded()` 쌍이 모두 hooks 파서 및 전역 파서에 포함됐다. `extended: true` 로 중첩 객체 파싱 지원. `buildBodyParsers` 공통 팩토리로 중복 없이 구성.
- 제안: 없음.

### **[INFO]** HMAC rawBody 보존 — `captureRawBody` 가 두 파서 모두에 적용

- 위치: `codebase/backend/src/bootstrap/hooks-body-parser.ts` L82–83
- 상세: `buildBodyParsers` 공통 팩토리를 통해 hooks 파서와 전역 파서 모두 `verify: captureRawBody` 가 적용된다. NestJS `rawBody: true` 옵션이 채우던 동일 필드명(`req.rawBody`)을 captureRawBody 가 채우므로 HMAC 검증 경로(`AuthConfigsService.verifyWebhookRequest`)가 런타임에서 유지된다. JSDoc L60–63 이 이 연속성을 명시한다.
- 제안: 없음.

### **[INFO]** [SPEC-DRIFT] `spec/5-system/12-webhook.md` frontmatter `code:` 에 `hooks-body-parser.ts` 이미 등재 확인

- 위치: `spec/5-system/12-webhook.md` frontmatter L10
- 상세: 일관성 리뷰(15_41_51/cross_spec.md)는 `hooks-body-parser.ts` 가 frontmatter `code:` 목록에 없다고 보고했으나, 실제 현재 `spec/5-system/12-webhook.md` frontmatter L10 에는 `- codebase/backend/src/bootstrap/hooks-body-parser.ts` 가 이미 포함돼 있다. RESOLUTION 적용 후 반영된 상태이며 추가 조치 불필요.
- 제안: 없음. 일관성 리뷰의 INFO 발견은 오탐.

---

## 요약

WH-NF-02 옵션 C(인증 webhook 1MB 게이트 + 공개 webhook 32KB Guard 유지 + non-webhook 100KB 전역 방어선 보존)가 완전하게 구현됐으며, spec 문서(`12-webhook.md WH-NF-02·§6·§8`, `3-error-handling.md §1.3·§1.7`, `2-api-convention.md §5.3·§6`)와 line-level 로 일치한다. 공개 webhook 보호 우회 보안 버그(TypeORM partial projection 오동작)도 full entity 로드로 정확히 수정됐다. 에러 코드·반환값·엣지 케이스 처리 모두 spec 과 일치하며, e2e K/L/M/N 테스트가 `requestId` 단언을 포함해 api-convention §5.3 의 "모든 에러 응답에 requestId 포함" 요구사항을 완전히 검증하고 있다. 이전 리뷰(15_41_50/requirement.md)가 WARNING 으로 보고한 "L 테스트 requestId 누락"은 현재 코드에서 이미 수정된 오탐이다.

---

## 위험도

NONE

STATUS: SUCCESS
