# 부작용(Side Effect) 리뷰 — 인증 webhook 1MB body 게이트 + 공개 webhook 보호 우회 fix

## 발견사항

### **[WARNING]** `req.__publicWebhookTrigger` — 공유 req 객체 변이, 소비처 가정 고착화
- 위치: `/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` L84 (`req.__publicWebhookTrigger = trigger`)
- 상세: Guard 가 Express `req` 객체에 `__publicWebhookTrigger` 프로퍼티를 직접 기록한다. 이는 요청 객체라는 공유 상태에 의도적 변이를 일으키는 부작용이다. 현재는 `PublicWebhookReqExtension` 인터페이스 export 와 Controller 의 타입 교차(`& PublicWebhookReqExtension`)로 계약이 명시되어 있으므로, 정적 타입 체계 안에서 추적 가능하다. 그러나 이 Guard 가 미래에 다른 라우트에 추가될 경우, 해당 라우트의 Controller 가 `__publicWebhookTrigger` 를 읽지 않음에도 req 에 데이터가 첨부된 채 통과된다 — 데이터 오염이나 오독의 여지가 생긴다. trigger `null`(미존재)을 req 에 세팅하는 위치가 `if (!trigger) return true` **전**(`L84` → `L86` 순서)이어서, `null` 을 명시적으로 첨부한 뒤 통과시키는 동작이 의도적임은 주석에 명시됐다 — 이 순서가 뒤바뀌면 `preloadedTrigger === undefined` 조건이 잘못 판단될 수 있다.
- 제안: 현행 허용 가능한 수준. 이 Guard 가 새 라우트에 붙을 때마다 `PublicWebhookReqExtension` 소비 여부를 확인하는 팀 관행을 수립할 것. 복수 Guard 가 req 에 데이터를 첨부하는 패턴이 확대되면 `request-extensions.d.ts` 집계 모듈 도입을 권장한다.

### **[WARNING]** `GlobalExceptionFilter.mapHttpErrorLike` — 4xx 전체 범위 처리의 잠재적 범위 외 부작용
- 위치: `/codebase/backend/src/common/filters/http-exception.filter.ts` L109 (`errStatus >= 400 && errStatus < 500`)
- 상세: 현재 이 분기를 타는 오류는 body-parser 의 `PayloadTooLargeError`(413) 하나뿐이고, NestJS `HttpException` 분기가 400/401/403/404/409 등을 먼저 소비하므로 현재 런타임에서 범위 외 4xx 가 이 분기에 도달하는 경우는 없다. 그러나 이 필터는 `@Catch()` 전역 캐처로서 애플리케이션 전체의 예외를 수신한다. 향후 http-errors 를 직접 throw 하는 미들웨어·라이브러리가 추가되면, `exception.message` 를 그대로 응답에 포함하는 이 분기가 내부 경로나 구현 세부 정보를 클라이언트에 노출하는 부작용을 일으킬 수 있다. 예: helmet, multer, passport 같은 미들웨어는 http-errors 기반 4xx 를 throw 할 수 있고, 그 message 가 외부 노출될 수 있다.
- 제안: 단기 허용. 새로운 미들웨어·라이브러리 추가 시 해당 라이브러리가 http-errors 4xx 를 throw 할 수 있는지 확인하고, 필요하면 `message` 를 허용 목록 기반으로 교체하거나 제네릭 문자열로 대체하는 sanitize 레이어를 도입한다.

### **[INFO]** `captureRawBody` — 전역 파서에도 `rawBody` 첨부, non-webhook 라우트 req 객체 변이
- 위치: `/codebase/backend/src/bootstrap/hooks-body-parser.ts` L81-83 (`buildBodyParsers` — `createGlobalBodyParsers` 에도 `verify: captureRawBody` 적용)
- 상세: `req.rawBody = buf` 는 IncomingMessage 에 표준이 아닌 프로퍼티를 동적으로 추가하는 상태 변이다. hooks 파서(`createHooksBodyParsers`)에서 필요하지만, `createGlobalBodyParsers` 도 동일한 `buildBodyParsers` 로 생성되어 non-webhook 라우트(`/api/**` 중 `/api/hooks/*` 외)의 req 에도 `rawBody` 가 첨부된다. 기능적으로 부작용이 적지만, HMAC 검증이 필요 없는 non-webhook 라우트에서도 rawBody 가 첨부·유지된다는 점은 의도하지 않은 상태 확장이다. 이미 성능 리뷰에서 지적됐고, 100KB 상한과 GC 로 실질적 위험은 낮다.
- 제안: 현행 허용. 향후 hooks 경로 전용 `verify` 를 별도 분리해 `createGlobalBodyParsers` 에서 `verify` 를 제거하면 non-webhook 라우트의 req 변이가 해소된다.

### **[INFO]** `resolveHooksMaxBodyBytes` — `logger.warn` 사이드 이펙트 (순수 함수 외부 효과)
- 위치: `/codebase/backend/src/bootstrap/hooks-body-parser.ts` L50-53
- 상세: `resolveHooksMaxBodyBytes` 는 env 주입으로 테스트 가능한 구조이나, 내부에서 `logger.warn` 을 호출하는 사이드 이펙트가 있다. 단위 테스트가 ceiling 초과 케이스를 검증할 때 warn 로그가 발생한다. 테스트 환경에서 logger 를 mock 하지 않으면 불필요한 로그 출력이 발생하며, 이는 순수 함수 계약과 완전히 일치하지 않는다. 실제 운영에서는 의도된 경보이므로 유용하다.
- 제안: 선택적. 단위 테스트에서 `logger.warn` 을 spy/mock 처리하거나, 경보 콜백을 주입 가능하게 만드는 것을 고려할 수 있으나 현행 수준도 수용 가능하다.

### **[INFO]** `HooksService.handleWebhook` 시그니처 변경 — `preloadedTrigger?` 선택적 파라미터 추가
- 위치: `/codebase/backend/src/modules/hooks/hooks.service.ts` L86 (`preloadedTrigger?: Trigger | null`)
- 상세: 선택적 파라미터를 마지막에 추가했으므로 기존 호출부(`preloadedTrigger` 를 전달하지 않는 경우)에 대한 호환성은 유지된다. TypeScript 컴파일러가 모든 호출부를 타입 체계 안에서 검증하므로 깨진 호출자 위험은 없다. `undefined`(미전달)와 `null`(trigger 미존재)의 의미 구분이 존재해 호출부가 실수로 `null` 을 전달하면 "trigger 없음"으로 해석될 수 있으나, 기존 코드베이스에서 이 메서드를 `null` 인자로 직접 호출하는 경로는 Guard-Controller 경로 외에 없을 가능성이 높다.
- 제안: 현행 유지. 시그니처 변경은 하위 호환적이며, 주석과 JSDoc 이 `null`/`undefined` 구분을 충분히 설명한다.

### **[INFO]** `PublicWebhookReqExtension` 인터페이스 — export 로 인한 공개 API 확장
- 위치: `/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` L152-155
- 상세: `PublicWebhookReqExtension` 인터페이스를 export 해 모듈 외부(`HooksController`)가 import 한다. 이 인터페이스에 필드가 추가/변경되면 소비처에도 영향이 전파된다. 현재 소비처는 `hooks.controller.ts` 하나로 제한되어 있고, 인터페이스 자체가 단순(`__publicWebhookTrigger?: Trigger | null`)하므로 영향 범위가 좁다.
- 제안: 현행 유지.

### **[INFO]** `extractClientIp` — Guard 파일에서 re-export, 두 출처에서 호출 가능
- 위치: `/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` L166-174
- 상세: `extractClientIp` 함수가 Guard 파일에 `export` 되어 있어 외부에서도 접근 가능하다. 내부적으로는 `extractClientIpFromHeaders` 에 위임하는 thin wrapper 이므로 로직 중복이나 상태 변이는 없다. 단, `auth/utils/client-ip` 로 이동이 기술 부채로 추적 중이므로, 현재 export 를 소비하는 코드가 생기면 이동 후 경로 변경 부담이 증가한다.
- 제안: 현행 단기 허용. `auth/utils/client-ip` 이동 완료 전에 이 함수를 새로운 소비처에 추가하지 않을 것.

### **[INFO]** `hooks-body-parser.ts` 모듈 레벨 `Logger` 인스턴스 생성 — 모듈 로드 시 전역 레지스트리에 등록
- 위치: `/codebase/backend/src/bootstrap/hooks-body-parser.ts` L5 (`const logger = new Logger('HooksBodyParser')`)
- 상세: 모듈 로드 시점에 `new Logger(...)` 가 실행되어 NestJS Logger 레지스트리에 등록된다. 이는 모듈 수준 전역 상태 변이이나, NestJS 패턴에서 일반적인 관행이다. 테스트 격리 측면에서 logger spy/mock 를 하지 않으면 로그 출력이 발생할 수 있다.
- 제안: 현행 유지. NestJS Logger 표준 패턴과 일치한다.

---

## 요약

이번 변경의 부작용 관점 핵심 위험은 두 가지다. 첫째, `PublicWebhookThrottleGuard` 가 Express `req` 객체에 `__publicWebhookTrigger` 를 직접 기록하는 공유 상태 변이는 W14 패턴의 의도적 설계이나, Guard 적용 범위가 확대될 경우 소비하지 않는 라우트에도 데이터가 첨부된다는 부작용 노출 가능성이 있다(WARNING). 둘째, `GlobalExceptionFilter.mapHttpErrorLike` 가 4xx 전체 범위를 커버하는 구조는 현재 도달 가능한 경로가 body-parser 413 하나뿐이므로 안전하나, 향후 http-errors 기반 미들웨어 추가 시 `exception.message` 가 클라이언트에 직접 노출되는 의도치 않은 부작용 경로가 열릴 수 있다(WARNING). 나머지 발견 사항(captureRawBody 의 non-webhook req 변이, 시그니처 추가, export 확장)은 모두 INFO 수준이며 현재 범위에서 수용 가능하다. 전역 변수 신규 도입, 파일시스템 부작용, 환경 변수 무단 쓰기, 네트워크 호출 추가, 이벤트/콜백 변경은 이번 변경에서 발견되지 않았다.

---

## 위험도

LOW
