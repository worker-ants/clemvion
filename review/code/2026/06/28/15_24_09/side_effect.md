# 부작용(Side Effect) 리뷰 — 인증 webhook 1MB body 게이트 + 공개 webhook 보호 우회 fix

## 발견사항

### **[WARNING]** `NestFactory.create` 옵션 변경 — `rawBody: true` 제거로 NestJS 공식 타입 계약 파괴
- 위치: `/codebase/backend/src/main.ts` — `NestFactory.create(AppModule, { bodyParser: false })`
- 상세: 기존 `rawBody: true` 옵션이 `bodyParser: false` 로 교체됨으로써 NestJS 의 공식 `RawBodyRequest<T>` 타입 계약이 런타임 수준에서 끊겼다. 런타임 동작은 `captureRawBody` verify 콜백이 `req.rawBody` 를 채우므로 현재는 정상 동작하지만, `AuthConfigsService.verifyWebhookRequest` 등 `RawBodyRequest` 를 import 해 타입 안전성에 의존하는 소비처가 타입 계약 파괴 상태로 동작한다. 향후 개발자가 `RawBodyRequest` 타입을 신뢰해 새 코드를 작성할 경우 컴파일 통과 후 런타임 `rawBody = undefined` 조용한 실패가 발생할 수 있다. 단, RESOLUTION(W2)에서 주석 명문화로 조치한 것으로 기록되어 있으나, 해당 주석이 타입 소비처들의 인터페이스를 직접 수정하지는 않으므로 근본적 타입 불일치는 잔존한다.
- 제안: `RawBodyRequest` 를 import 하는 모든 소비처(`AuthConfigsService.verifyWebhookRequest` 등)에서 로컬 타입 확장(`req: Request & { rawBody?: Buffer }`)으로 대체하거나, `captureRawBody` 가 채운다는 점과 NestJS 타입 계약 대신 직접 채움을 명문화한 별도 타입 선언 파일로 관리.

### **[WARNING]** `captureRawBody` — 빈 본문(`buf` falsy/빈 Buffer) 시 `rawBody` 미세팅 가능성
- 위치: `/codebase/backend/src/bootstrap/hooks-body-parser.ts` — `captureRawBody` 함수
- 상세: 원본 코드가 `if (buf && buf.length)` 조건을 사용해 빈 Buffer(`length === 0`)인 경우 `req.rawBody` 를 세팅하지 않는다. body-parser 는 빈 본문 요청에도 `verify` 콜백을 호출할 수 있으므로, 빈 본문 HMAC 서명 검증 요청에 대해 `rawBody` 가 `undefined` 로 남아 HMAC 검증 분기가 401 을 반환할 수 있다. 기존 `rawBody: true` 옵션은 빈 본문도 `Buffer.alloc(0)` 으로 세팅했던 동작과 다르다. RESOLUTION(W3)에서 `if (buf)` 로 수정 완료로 기재되어 있으나, 이 fresh review 의 diff 상 `hooks-body-parser.ts` 코드를 확인하면 `if (buf)` 조건이 적용되어 있으므로 실제 수정 여부를 아래 항목에서 구분한다.

  - **추가 확인**: 이 fresh review diff(`hooks-body-parser.ts`) 에서 `captureRawBody` 는 `if (buf)` 로 되어 있음 — RESOLUTION fix 가 반영된 상태. 따라서 현재 코드에서는 이 문제가 해소된 상태.

### **[INFO]** `req.__publicWebhookTrigger` — req 객체 변이를 통한 Guard-Service 암묵적 채널
- 위치: `/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` + `/codebase/backend/src/modules/hooks/hooks.controller.ts`
- 상세: `PublicWebhookThrottleGuard` 가 `req.__publicWebhookTrigger` 에 Trigger 엔티티를 첨부하는 패턴은 req 객체를 공유 상태 전달 채널로 사용하는 부작용이다. `PublicWebhookReqExtension` 인터페이스 export 로 타입 계약이 명시되어 암묵성이 경감되었고, Node.js 단일 스레드 모델에서 요청 간 교차 오염이 발생하지 않으므로 현재 위험도는 낮다. 그러나 Guard 가 없는 경로(예: 내부 직접 호출, 모킹 등)에서 `req.__publicWebhookTrigger` 가 `undefined` 임을 `preloadedTrigger !== undefined` 체크로 올바르게 처리하고 있다. 의도적 설계이며 안전.
- 제안: 현행 유지. `PublicWebhookReqExtension` 타입이 계약을 명시하므로 충분.

### **[INFO]** `resolveHooksMaxBodyBytes` — `process.env` 직접 읽기 (환경 변수 관점)
- 위치: `/codebase/backend/src/bootstrap/hooks-body-parser.ts` — `resolveHooksMaxBodyBytes(env = process.env)`
- 상세: 함수 기본 인수로 `process.env` 를 직접 참조한다. 이는 부트스트랩 시 1회 평가되어 모듈 로드 시점의 환경 변수 스냅샷을 사용한다. ConfigService 와 달리 NestJS DI 외부에서 env 를 직접 읽는 패턴이지만, 설계 의도가 JSDoc 에 명시되어 있고 부트스트랩 전용 함수이므로 적절하다. 런타임 env 변경 적용이 필요한 경우에는 재시작이 필요하나, body-parser limit 은 서버 기동 시 1회 결정되는 값이므로 문제없다.
- 제안: 없음. 주석에 "부트스트랩 시 1회 읽힌다" 명시로 충분.

### **[INFO]** `HOOKS_ROUTE_PREFIX = '/api/hooks'` 상수 export — 하드코딩 단일 진실 확보
- 위치: `/codebase/backend/src/bootstrap/hooks-body-parser.ts` — `export const HOOKS_ROUTE_PREFIX`
- 상세: 이전 리뷰(INFO 17)에서 `/api/hooks` 하드코딩 이슈로 지적되었으며, RESOLUTION 에서 `HOOKS_ROUTE_PREFIX` 상수로 export 하고 `main.ts` 가 이를 사용하는 방식으로 수정되었다. 단일 진실 원칙을 만족하며 향후 prefix 변경 시 한 곳만 수정하면 된다. 부작용 없음.
- 제안: 없음.

### **[INFO]** `GlobalExceptionFilter.mapHttpErrorLike` — 4xx http-errors 메시지 직접 응답 노출
- 위치: `/codebase/backend/src/common/filters/http-exception.filter.ts` — `mapHttpErrorLike` 메서드
- 상세: 4xx http-errors(body-parser `PayloadTooLargeError` 등) 의 `exception.message` 를 그대로 응답 봉투에 노출한다. 현재 발원처는 body-parser 뿐이고 메시지("request entity too large")는 무해하지만, 향후 다른 http-errors 미들웨어가 추가되면 내부 경로나 상세 정보가 포함된 메시지가 클라이언트에 노출될 수 있다. 이 경로에 `logger.warn` 이 추가된 점(RESOLUTION W5)은 운영 가시성을 확보하며 개선이다.
- 제안: 현재 수준에서 허용 가능. 향후 http-errors 의존 미들웨어 추가 시 메시지 sanitize 레이어(허용 목록 또는 고정 메시지) 도입 검토.

### **[INFO]** `captureRawBody` — 전역 파서에도 적용되어 non-webhook API 요청 전체에 rawBody Buffer 복사 발생
- 위치: `/codebase/backend/src/bootstrap/hooks-body-parser.ts` — `createGlobalBodyParsers` 에서 `verify: captureRawBody` 포함
- 상세: 전역 파서(`createGlobalBodyParsers`)도 `captureRawBody` verify 를 포함하므로, non-webhook API 요청(예: 관리자 API, 인증 API 등)에도 `req.rawBody` Buffer 복사가 발생한다. 전역 파서 한도가 100KB 이므로 단일 요청 메모리 영향은 제한적이지만, 요청 볼륨이 높은 환경에서는 GC 압력이 증가할 수 있다. HMAC 검증이 필요한 것은 `/api/hooks/*` 경로뿐이므로, 전역 파서에서 `verify: captureRawBody` 를 제거하는 것이 원칙적으로 더 정확하다. 그러나 RESOLUTION(INFO 7)에서 "100KB 한도라 영향 제한적, 현행 허용" 으로 처리되었다.
- 제안: 현행 허용. 요청 볼륨이 증가하면 `createGlobalBodyParsers` 에서 `verify` 를 제거하는 최적화를 고려.

### **[INFO]** `HooksService.handleWebhook` 시그니처 변경 — `preloadedTrigger?: Trigger | null` 추가
- 위치: `/codebase/backend/src/modules/hooks/hooks.service.ts` — `handleWebhook` 메서드
- 상세: 기존 3개 파라미터(`endpointPath`, `input`, `rawBody?`)에 `preloadedTrigger?: Trigger | null` 옵션 파라미터가 추가되었다. 옵션 파라미터이므로 기존 호출부(`HooksController` 외부에서 직접 호출하는 경우)에 하위 호환성이 유지된다. 미전달 시 `undefined` 로 폴백해 기존과 동일하게 직접 조회한다.
- 제안: 없음. 옵션 파라미터 추가는 하위 호환적이며 호출자 영향 없음.

### **[INFO]** `main.ts` 부트스트랩 미들웨어 등록 순서 — 의도치 않은 전역 상태 변경 여부
- 위치: `/codebase/backend/src/main.ts` — `app.use(HOOKS_ROUTE_PREFIX, ...createHooksBodyParsers())` + `app.use(...createGlobalBodyParsers())`
- 상세: 두 `app.use()` 호출은 Express 미들웨어 스택에 파서를 등록하는 부트스트랩 시 1회 동기 실행이다. hooks 파서를 전역 파서보다 먼저 등록해 `/api/hooks/*` 요청이 1MB 한도로 파싱된 후 body-parser 의 `req._body` idempotency 가드로 후행 전역 파서가 재파싱을 skip 하는 동작이 핵심이다. `req._body` 는 body-parser 내부 필드로, 라이브러리 버전 변경 시 이 동작이 깨질 수 있으나 body-parser 의 사실상 표준 동작이다.
- 제안: 없음. 주석에 의존성이 명시되어 있어 충분.

---

## 요약

이번 변경 세트의 부작용 관점 핵심 위험은 두 가지다. 첫째, `NestFactory.create` 에서 `rawBody: true` 를 `bodyParser: false` 로 교체함으로써 NestJS 공식 `RawBodyRequest<T>` 타입 계약이 파괴되었다(WARNING). 런타임 동작은 `captureRawBody` 가 `req.rawBody` 를 채우므로 정상이지만, 타입 소비처가 `RawBodyRequest` 임포트에 의존하는 경우 컴파일 타입 계약과 런타임 동작 간 불일치가 잠재적 유지보수 위험을 만든다. 둘째, `captureRawBody` 의 `if (buf && buf.length)` 조건(원본 코드)이 빈 본문 rawBody 미세팅 부작용을 유발할 수 있었으나(WARNING), RESOLUTION W3 에서 `if (buf)` 로 이미 수정되어 현재 diff 에 반영된 상태다. 나머지 발견사항은 INFO 수준으로, req 객체 변이를 통한 Guard-Service 채널(`__publicWebhookTrigger`)은 타입 계약(`PublicWebhookReqExtension`)으로 명시되어 암묵성이 경감되었고, 전역 파서의 rawBody 복사는 100KB 한도 내에서 허용 가능하며, `HooksService.handleWebhook` 시그니처 확장은 옵션 파라미터로 하위 호환적이다. 환경 변수(`HOOKS_MAX_BODY_BYTES`, `HOOKS_MAX_BODY_BYTES_CEILING`)는 부트스트랩 시 1회 읽히며 상한 클램프가 구현되어 OOM 위험이 경감되었다.

---

## 위험도

LOW

STATUS: SUCCESS
