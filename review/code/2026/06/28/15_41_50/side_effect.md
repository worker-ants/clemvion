# 부작용(Side Effect) 리뷰 — 인증 webhook 1MB body 게이트 + 공개 webhook 보호 우회 fix

## 발견사항

### **[WARNING]** `main.ts` — `rawBody: true` 제거로 `RawBodyRequest` 타입 계약 암묵적 파손
- 위치: `/codebase/backend/src/main.ts` `NestFactory.create(AppModule, { bodyParser: false })` (이전: `{ rawBody: true }`)
- 상세: `rawBody: true` 옵션은 NestJS가 `req.rawBody: Buffer`를 채우는 공식 계약(`RawBodyRequest<T>`)이다. 이 옵션을 제거하고 `captureRawBody` verify 콜백으로 대체하면 기능적으로는 동일하게 동작하지만, `RawBodyRequest` 타입을 소비하는 코드(`AuthConfigsService.verifyWebhookRequest`, Slack/Discord inbound)가 타입 시스템 관점에서 계약 파손 없이 동작하는 것을 컴파일 타임에 보장할 수 없다. 런타임에는 `captureRawBody`가 `req.rawBody`를 채우므로 실제 동작은 유지되나, 향후 `RawBodyRequest` 소비처가 추가될 때 `rawBody` 미설정 환경(예: 테스트 더블이 `bodyParser: false` 없이 생성된 경우)에서 회귀 위험이 있다.
- 제안: `main.ts` 주석에 "이 경로에서 `req.rawBody`는 `captureRawBody`(body-parser verify)로 채워지며 NestJS `RawBodyRequest` 소비처와 호환된다"를 명문화(이미 어느 정도 반영됨). 추가로 `hooks-body-parser.ts`의 `captureRawBody` 함수 시그니처에 채우는 필드명과 NestJS 계약과의 연관을 JSDoc으로 명시하여 미래 유지보수자의 오해를 방지한다.

---

### **[WARNING]** `GlobalExceptionFilter.mapHttpErrorLike` — 4xx http-error 메시지 직접 노출
- 위치: `/codebase/backend/src/common/filters/http-exception.filter.ts` `mapHttpErrorLike()` 내 `message: exception.message`
- 상세: `errStatus >= 400 && errStatus < 500` 범위의 모든 http-errors 객체 메시지가 응답 봉투에 그대로 실린다. 현재는 body-parser의 `PayloadTooLargeError`("request entity too large")만 이 경로를 타므로 메시지 내용 자체는 무해하다. 그러나 이 분기는 조건(`errStatus >= 400 && errStatus < 500`)상 413뿐 아니라 body-parser 외 다른 http-errors 라이브러리가 throw하는 400~499 전체에 열려 있으므로, 향후 새 미들웨어가 추가될 경우 내부 경로나 민감 정보가 포함된 메시지가 클라이언트에 노출될 수 있다.
- 제안: 단기에는 `logger.warn`으로 원본 메시지 가시성을 확보(이미 구현됨)하고 현행 유지. 중기에는 `message`를 상태 코드별 표준 문자열로 대체(예: 413이면 "Request body too large")하거나 sanitize 레이어를 추가하는 것을 고려.

---

### **[INFO]** `NestFactory.create` 옵션 변경 — 전역 파서 비활성화 부작용
- 위치: `/codebase/backend/src/main.ts` `{ bodyParser: false }`
- 상세: `bodyParser: false`는 NestJS가 기본으로 등록하는 전역 body-parser(json + urlencoded, 100KB)를 완전히 비활성화한다. 그 결과 `createGlobalBodyParsers()`를 명시적으로 등록하지 않으면 non-webhook 라우트 전체의 `req.body`가 `undefined`가 된다(`register 500` 회귀 위험). 현재 코드는 `app.use(...createGlobalBodyParsers())`를 올바르게 등록하고 있으나, 전역 파서 누락은 `e2e N` 테스트로만 회귀 가드된다. 향후 `main.ts` 리팩토링 시 전역 파서 등록 라인이 실수로 삭제되면 탐지가 늦어질 수 있다.
- 제안: 현행 유지. 다만 `createGlobalBodyParsers()` 등록과 `bodyParser: false` 설정을 동일 주석 블록 내에 묶어 "이 둘은 반드시 함께 있어야 한다"는 불변을 코드 위치로 명시하면 실수 가능성이 줄어든다(이미 어느 정도 반영됨).

---

### **[INFO]** `captureRawBody` — 전역 파서에도 rawBody 캡처 적용으로 의도치 않은 상태 변경
- 위치: `/codebase/backend/src/bootstrap/hooks-body-parser.ts` `createGlobalBodyParsers()` 내 `verify: captureRawBody`
- 상세: `createGlobalBodyParsers()`도 `captureRawBody`를 사용하므로 non-webhook 라우트(`/api/workflows`, `/api/workspaces` 등)의 모든 요청에서도 `req.rawBody`가 채워진다. 이 필드는 HMAC 검증 용도로 webhook 경로에서만 필요하며, 다른 라우트에서 `req.rawBody`가 예상치 못하게 채워지는 상태 변경이 발생한다. 현재 소비처가 없어 부작용은 없으나, 향후 non-webhook 서비스가 `req.rawBody`를 잘못 읽거나 해당 필드 존재를 전제로 로직을 추가할 경우 오작동 가능성이 있다.
- 제안: `createGlobalBodyParsers()`에서 `verify: captureRawBody`를 제거하거나 hooks 경로에서만 rawBody를 캡처하도록 분리하는 것이 이상적이다. 단, 현재 동작 변경 없음이 확인된 상태이므로 성능 및 메모리 영향이 미미한 범위에서 현행 허용도 가능. 명확한 의도를 JSDoc에 기술하길 권장.

---

### **[INFO]** `req.__publicWebhookTrigger` — req 객체 변이를 통한 Guard-Controller 암묵적 채널
- 위치: `/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` + `/codebase/backend/src/modules/hooks/hooks.controller.ts`
- 상세: `PublicWebhookThrottleGuard`가 `req.__publicWebhookTrigger`에 trigger 엔티티를 첨부하는 패턴은 요청 객체(`req`)를 공유 상태로 사용하는 암묵적 채널이다. `PublicWebhookReqExtension` 인터페이스를 export하여 타입 계약을 명시했으나, Guard가 실행되지 않는 경로(Guard를 건너뛰는 `@SkipGuard` 데코레이터, 인증 webhook 경로 등)에서 컨트롤러가 `req.__publicWebhookTrigger`를 소비하면 `undefined`가 된다. 현재 `HooksService.handleWebhook`이 `preloadedTrigger !== undefined ? preloadedTrigger : await findOne(...)` 패턴으로 안전하게 폴백하므로 즉각적인 부작용은 없다.
- 제안: 현행 유지. `preloadedTrigger` 폴백 패턴이 안전하게 구현되어 있으므로 Guard 미실행 시에도 안전하다. 다만 `PublicWebhookReqExtension`의 JSDoc에 "Guard 미실행 시 undefined임을 전제해야 한다"를 명시하면 미래 소비처의 실수를 방지할 수 있다.

---

### **[INFO]** `HooksService.handleWebhook` 시그니처 변경 — `preloadedTrigger?` 파라미터 추가
- 위치: `/codebase/backend/src/modules/hooks/hooks.service.ts` `handleWebhook(endpointPath, input, rawBody?, preloadedTrigger?)`
- 상세: 기존 시그니처 `(endpointPath, input, rawBody?)` 에서 `preloadedTrigger?: Trigger | null` 파라미터가 추가되었다. 선택적(`?`) 파라미터이고 기존 호출부(`HooksController`)가 명시적으로 전달하도록 이미 갱신되었으므로 기존 호출자에게 breaking change는 없다. 단, 외부 모듈이나 테스트에서 `handleWebhook`을 직접 호출하는 경우 새 파라미터 인지가 필요하다.
- 제안: 선택적 파라미터 추가이므로 기존 호출자에 영향 없음. 현행 유지.

---

### **[INFO]** `HOOKS_ROUTE_PREFIX` 상수 export — 하드코딩 `/api/hooks` 제거
- 위치: `/codebase/backend/src/bootstrap/hooks-body-parser.ts` `export const HOOKS_ROUTE_PREFIX = '/api/hooks'`
- 상세: 이전 `main.ts`에 하드코딩된 `/api/hooks` 문자열이 `HOOKS_ROUTE_PREFIX`로 외부화되었다. 이는 하드코딩 제거로 올바른 방향이나, 이 상수를 다른 위치(예: routing 설정, 테스트)에서도 사용해야 하는 경우 `bootstrap/` 레이어 외부 의존이 발생한다. 현재는 `main.ts`에서만 사용하므로 문제없다.
- 제안: 현행 유지. 향후 router module 등 다른 위치에서 이 경로를 참조할 경우 적절한 공유 상수 위치로 이동 고려.

---

### **[INFO]** `resolveHooksMaxBodyBytes` — `process.env` 읽기의 모듈 초기화 타이밍
- 위치: `/codebase/backend/src/bootstrap/hooks-body-parser.ts` `resolveHooksMaxBodyBytes(env = process.env)`
- 상세: `HOOKS_MAX_BODY_BYTES` 상수는 모듈 로드 시점에 값이 고정된다(`= 1024 * 1024`). 반면 `resolveHooksMaxBodyBytes()`는 호출 시점의 `process.env`를 읽으므로, 모듈 로드 후 환경 변수가 변경된 경우(테스트 환경에서 `process.env` 조작) 상수와 함수가 다른 값을 반환할 수 있다. 실제 운영에서는 앱 기동 후 환경 변수가 변경되지 않으므로 문제없다. 테스트에서는 `resolveHooksMaxBodyBytes({ HOOKS_MAX_BODY_BYTES: '...' })`로 env 주입 패턴을 사용하므로 기존 테스트도 안전하다.
- 제안: 현행 유지. env 주입 인터페이스가 이미 테스트 친화적으로 설계되어 있음.

---

### **[INFO]** `getCodeFromStatus(413)` 추가 — 기존 switch-case 분기 확장
- 위치: `/codebase/backend/src/common/filters/http-exception.filter.ts` `getCodeFromStatus` private 메서드
- 상세: `case 413: return 'PAYLOAD_TOO_LARGE'` 추가는 기존 패턴과 일관적이며 side effect 없음. `getCodeFromStatus`를 호출하는 모든 경로(HttpException, http-error-like)에서 413이 올바르게 매핑된다.
- 제안: 없음.

---

## 요약

이번 변경의 부작용 위험도는 전반적으로 낮다. 핵심 위험은 두 가지다: (1) `rawBody: true` 제거로 NestJS `RawBodyRequest` 공식 계약을 비공식 verify 콜백으로 대체하는 것은 런타임에 동작하나 타입 계약 명시성이 약해지며, 향후 소비처 추가 시 미설정 환경에서 회귀 위험이 있다. (2) `GlobalExceptionFilter.mapHttpErrorLike`가 4xx 전체(`errStatus >= 400 && errStatus < 500`)를 열어두어 현재는 무해한 body-parser 메시지만 노출되지만, 향후 다른 http-errors 미들웨어가 추가될 경우 민감 정보가 포함된 메시지가 클라이언트에 노출될 수 있다. `req.__publicWebhookTrigger` 채널은 `preloadedTrigger` 폴백으로 안전하게 처리되고 있으며, `bodyParser: false`로 인한 전역 파서 비활성화는 명시적 재등록으로 올바르게 처리되었다. `captureRawBody`가 non-webhook 라우트에도 적용되어 `req.rawBody`를 불필요하게 채우는 점은 현재 소비처가 없어 무해하나 의도치 않은 상태 변경이므로 중기 정리가 권장된다.

## 위험도

LOW

STATUS: SUCCESS
