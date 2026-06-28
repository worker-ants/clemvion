# 동시성(Concurrency) 리뷰 결과

## 발견사항

해당 없음, 위험도 NONE

변경 범위(CHANGELOG.md, hooks-body-parser.ts/.spec.ts, http-exception.filter.ts/.spec.ts, main.ts, public-webhook-throttle.guard.ts, webhook-trigger.e2e-spec.ts)에 동시성 관련 코드가 없다.

세부 확인 사항:

- **hooks-body-parser.ts**: `createHooksBodyParsers` / `createGlobalBodyParsers` 는 순수 팩토리 함수 — 공유 가변 상태 없음. `captureRawBody` 는 body-parser 의 `verify` 콜백으로 요청마다 독립된 `req` 객체에 `rawBody` 를 기록하며, Node.js 단일 스레드 이벤트 루프 모델에서 교차-요청 경쟁 조건이 발생하지 않는다.
- **http-exception.filter.ts**: `catch()` 는 호출마다 지역 변수(`status`, `code`, `message`, `details`, `requestId`) 만 사용하며 모듈 수준 가변 상태를 전혀 공유하지 않는다. `uuidv4()` 는 각 요청마다 독립 호출된다.
- **main.ts 부트스트랩**: `app.use()` 미들웨어 등록은 시작 시 1회 동기 실행되며 이후 변경되지 않는다. 레이스 조건 없음.
- **public-webhook-throttle.guard.ts**: `canActivate()` 가 `async` / `await this.triggerRepository.findOne()` 을 사용하나, 조회 결과는 요청별 지역 변수 `trigger` 에만 보관되고 `req.__publicWebhookTrigger` (요청 전용 객체) 에 첨부된다. 모듈 수준 공유 상태 미변경. `quota.consumeStart(ip)` 는 Redis 기반으로 추론되며 원자성은 Redis 레이어가 보장한다. partial-select 버그 수정(`select: { authConfigId: true }` 제거)은 동시성 문제가 아닌 ORM projection 버그 수정이다.
- **e2e spec**: 테스트 픽스처 코드에 공유 가변 상태가 없고 각 `it` 블록은 독립 UUID 경로를 사용한다.

## 요약

이번 변경은 Express body-parser 를 라우트 스코프로 분리하고, 공개 webhook Guard 의 ORM partial-projection 버그를 수정하며, GlobalExceptionFilter 에 4xx http-errors 매핑을 추가하는 내용이다. 코드 전반에 걸쳐 공유 가변 상태 도입이 없고, async/await 는 각 요청 컨텍스트 내에서 올바르게 사용되며, 이벤트 루프 블로킹·데드락·경쟁 조건의 징후가 발견되지 않는다.

## 위험도

NONE
