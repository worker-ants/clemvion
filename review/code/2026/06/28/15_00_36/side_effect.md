# 부작용(Side Effect) 리뷰

## 발견사항

### [WARNING] `NestFactory.create` 옵션 `rawBody: true` 제거 — NestJS `RawBodyRequest` 타입 계약 파괴
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/main.ts` — `NestFactory.create(AppModule, { bodyParser: false })`
- 상세: 기존 `{ rawBody: true }` 옵션이 `{ bodyParser: false }` 로 교체됐다. NestJS `rawBody: true` 는 NestJS 내부에서 `RawBodyRequest` 인터페이스의 `rawBody: Buffer` 필드를 req 에 자동으로 첨부하는 공식 경로다. 이를 제거하면 NestJS 타입시스템 관점에서 `req.rawBody` 의 보장이 사라진다. `captureRawBody` verify 콜백이 동일 필드명을 채우므로 런타임 동작은 유지되지만, `AuthConfigsService.verifyWebhookRequest` 등 `RawBodyRequest` 타입을 기반으로 소비하는 코드는 컴파일 타입 계약이 깨진 채로 동작한다. 향후 NestJS 업그레이드나 다른 개발자가 `RawBodyRequest` 타입을 신뢰해 코드를 작성할 경우 조용한 실패가 발생할 수 있다.
- 제안: `AuthConfigsService.verifyWebhookRequest` 및 `RawBodyRequest` 를 import 하는 모든 코드에서 타입을 로컬 확장(`req: Request & { rawBody?: Buffer }`)으로 대체하고, `rawBody` 는 `captureRawBody` 가 채운다는 점을 주석으로 명시. e2e J(512KB HMAC 202)가 동작을 검증하지만 타입 계약 불일치는 별도 문서화가 필요.

### [WARNING] `captureRawBody` — 빈 바디(`buf.length === 0`) 케이스에서 `rawBody` 미세팅
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/bootstrap/hooks-body-parser.ts` — `captureRawBody` 함수 (`if (buf && buf.length)`)
- 상세: `captureRawBody` 가 `buf.length` 가 0 인 경우 rawBody 를 세팅하지 않는다. 빈 바디 요청에 대해 HMAC 서명 헤더가 있는 경우(`X-Hub-Signature-256`), rawBody 가 undefined 이므로 `AuthConfigsService.verifyWebhookRequest` 의 HMAC 검증 분기가 실패(401)할 수 있다. 정상적인 HMAC webhook 은 비어있지 않으므로 실위험은 낮지만, 빈 바디 HMAC 요청에 대한 동작이 기존 `rawBody: true` 방식과 달라지는 것은 암묵적 동작 변경이다.
- 제안: `if (buf) { (req as ...).rawBody = buf; }` 로 수정해 빈 바디도 `rawBody = Buffer.alloc(0)` 으로 세팅하도록 변경. HMAC 검증 로직이 빈 Buffer 를 올바르게 처리하는지 확인 필요.

### [INFO] `app.use('/api/hooks', ...)` 경로 하드코딩 — 향후 prefix 변경 시 불일치 위험
- 위치: `/Volumes/project/private/clemvion/.claire/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/main.ts` — `app.use('/api/hooks', ...createHooksBodyParsers())`
- 상세: `/api/hooks` 경로가 `main.ts` 에 하드코딩됐다. `app.setGlobalPrefix('api')` 는 이보다 뒤에 등록되지만, Express 레벨의 `app.use` 미들웨어는 NestJS global prefix 와 독립적으로 작동하므로 현재는 정확히 일치한다. 그러나 향후 global prefix 가 변경되거나 Controller 경로가 변경될 때 이 하드코딩된 경로와의 불일치가 발생할 수 있다.
- 제안: `HOOKS_ROUTE_PREFIX = '/api/hooks'` 를 `hooks-body-parser.ts` 에 export 상수로 추출하고 `main.ts` 에서 import 해 단일 진실 유지.

### [INFO] `GlobalExceptionFilter` — 4xx http-errors 의 `exception.message` 외부 노출
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/common/filters/http-exception.filter.ts` — 신규 4xx 분기 (`message = exception.message`)
- 상세: body-parser 의 `PayloadTooLargeError` 등 http-errors 계열 4xx 에러가 감지되면 `exception.message` 를 응답 body 에 그대로 포함한다. body-parser 의 메시지는 `"request entity too large"` 같이 무해하지만, 다른 서드파티 라이브러리가 4xx 를 던지면서 내부 경로나 스택 힌트가 포함된 메시지를 사용할 경우 외부로 누출될 수 있다. 4xx 분기에서 `this.logger.error` 가 호출되지 않아 서버 로그도 남지 않는다.
- 제안: 413 에 대해서는 `getCodeFromStatus` 에서 이미 `PAYLOAD_TOO_LARGE` 를 반환하므로 message 대신 고정 문자열 사용 가능. 최소한 `this.logger.warn` 으로 원본 메시지를 기록해 운영 가시성을 확보하는 것을 권장.

### [INFO] `PublicWebhookThrottleGuard` — full entity 로드로 불필요한 컬럼까지 메모리에 적재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts`
- 상세: `findOne({ select: { authConfigId: true } })` partial projection 버그를 수정하기 위해 full entity 로드로 전환했다. Guard 가 실제로 필요한 필드는 `authConfigId` 와 `type` 뿐이지만, full entity 로드로 `Trigger` 의 모든 컬럼(config JSONB 등)이 메모리에 적재된다. W14 패턴으로 `req.__publicWebhookTrigger` 에 첨부해 HooksService 가 재사용하므로 추가 DB 왕복은 없지만, HooksService 가 필요로 하는 범위 이상의 데이터가 req 에 첨부된다. partial projection 버그의 근본 원인(ORM의 NULL 컬럼 handling)이 해소되지 않은 채로 full load 로 우회한 것이므로, 추후 최적화 시 동일 버그 재발 가능성이 있다.
- 제안: 현재 구현은 안전하고 정확하므로 유지. 향후 성능 최적화 시 partial projection 을 재도입할 경우, TypeORM 에서 NULL 컬럼이 partial select 에서 undefined 로 반환되는 동작을 명시 검증하는 단위 테스트 추가 필요.

### [INFO] `resolveHooksMaxBodyBytes` — `process.env` 직접 참조, 런타임 변경 반영 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/bootstrap/hooks-body-parser.ts` — `resolveHooksMaxBodyBytes(env: NodeJS.ProcessEnv = process.env)`
- 상세: `main.ts` 에서 `createHooksBodyParsers()` 를 호출 시 env 를 인수 없이 전달해 `process.env` 를 직접 읽는다. 이는 부트스트랩 시 1회 평가되는 의도된 설계로, ConfigService 를 통하지 않는다. 런타임 중 `HOOKS_MAX_BODY_BYTES` 가 변경돼도 body-parser limit 에 반영되지 않는다. 이는 정상 동작이나, ConfigService 를 통한 다른 설정 로딩 패턴과 일관성이 없다.
- 제안: 이미 의도된 설계이므로 별도 조치 불필요. 주석에 "부트스트랩 시 1회 읽힌다" 를 명시하면 충분.

---

## 요약

이번 변경의 핵심 부작용은 `NestFactory.create` 옵션을 `rawBody: true` 에서 `bodyParser: false` 로 전환한 것이다. 런타임 동작(rawBody 첨부, body-parser 등록)은 `captureRawBody` 와 명시적 파서 등록으로 대체돼 기능상 유지되지만, NestJS 공식 `RawBodyRequest` 타입 계약이 파괴돼 향후 타입 기반 코드에서 혼동이 발생할 수 있다. `captureRawBody` 의 빈 바디 미세팅은 암묵적 동작 변경이며 에지 케이스 HMAC 실패 위험이 있다. `GlobalExceptionFilter` 의 4xx message 노출과 full entity 로드는 현실적 위험은 낮지만 로그 부재 및 데이터 최소화 원칙 위반이다. 의도하지 않은 전역 상태 변경, 전역 변수 도입, 파일시스템 부작용, 네트워크 호출은 없으며, 환경 변수 읽기는 설계상 명시적이다.

---

## 위험도

LOW
