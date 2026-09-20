# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** `outboundBlockReason` preflight 가 `AbortSignal.timeout` 생성 **뒤로** 이동해, 연결 테스트의 10초 예산을 SSRF 가드(DNS lookup)가 잠식한다
  - 위치: `codebase/backend/src/modules/integrations/http-connection-tester.ts:118-129` (`testHttpConnection`)
  - 상세: 이번 커밋(`840e8e7f9`)의 부모(`840e8e7f9^`)에서는 `const preflight = await outboundBlockReason(url);` 가 `const init: RequestInit = { ..., signal: AbortSignal.timeout(HTTP_TEST_TIMEOUT_MS) }` **이전**에 있었다(`git show 840e8e7f9^:codebase/backend/src/modules/integrations/http-connection-tester.ts` 로 확인). 이번 변경은 "던지지 않는다" tester 계약을 지키려고 preflight 호출을 `try` **안**으로 옮겼는데, `try` 는 `init`(과 그 안의 `AbortSignal.timeout(HTTP_TEST_TIMEOUT_MS)`) 생성 **뒤**에 시작한다(118-124행). `AbortSignal.timeout(ms)` 는 호출 시점부터 카운트다운을 시작하는 명세이므로, 이제 preflight(`assertSafeOutboundHostResolved` 의 실제 `dns.lookup`, `http-safety.ts:189`)가 소비하는 시간만큼 실제 `fetch` 에 남는 예산이 줄어든다. 이전에는 preflight 시간이 10초 예산과 무관했다. DNS 가 느리거나(사설 리졸버 재시도 등) 응답이 없을 때, 실제로는 연결이 성공했을 요청이 "The request timed out after 10 seconds" 로 오분류될 수 있다 — 사용자가 통합을 테스트할 때 신뢰하는 진단 메시지가 거짓이 된다.
  - 형제 코드와의 비교: `http-request.handler.ts` 는 SSRF 가드(350-414행)를 `AbortController`/`setTimeout` 생성(416행) **이전**에 실행해 이 문제가 없다. `database-connection-tester.ts` 도 가드가 `probePostgres`/`probeMysql` 호출(각 함수 내부에서 `connectionTimeoutMillis` 를 갖는 커넥션을 새로 만듦) **이전**에 끝난다. `http-connection-tester.ts` 만 이번 변경으로 형제들과 다른 타이밍 계약을 갖게 됐다.
  - 이 회귀를 잡는 테스트는 없다 — 새로 추가된 테스트(238-266행)는 가드를 동기 mock 으로 즉시 던지게 하므로 타이밍 변화가 드러나지 않는다.
  - 제안: `init`(과 `AbortSignal.timeout` 생성)을 preflight **통과 뒤**로 옮기거나, `fetch` 호출 직전에 `AbortSignal.timeout` 을 생성해 가드 시간이 전송 타임아웃 예산에 들어가지 않게 한다.

- **[WARNING]** 신설 `http-redirect.spec.ts` 가 `assertSafeOutboundHostResolved` 를 mock 하지 않아, 첫 테스트가 실제 DNS 조회를 수행한다
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-redirect.spec.ts:6-9` (jest.mock 팩토리), 실측 트리거는 `:23-26` (`'통과하면 null'` 테스트)
  - 상세: `jest.mock('./http-safety.js', () => ({ ...jest.requireActual('./http-safety.js'), assertSafeOutboundUrl: jest.fn() }))` 는 `assertSafeOutboundUrl` 만 mock 하고 `assertSafeOutboundHostResolved` 는 실물 그대로 남긴다. `outboundBlockReason`(`http-redirect.ts:30-39`, 이번 diff 로 catch 분기만 바뀌고 본문 흐름은 그대로)은 `assertSafeOutboundUrl(url)` 통과 후 `await assertSafeOutboundHostResolved(new URL(url).hostname)` 을 **awaited** 로 호출한다. 첫 테스트 `'통과하면 null'`(23-26행)은 `mockedUrlGuard.mockImplementation((u) => new URL(u))` 로 통과시키므로 실행이 그대로 실물 `assertSafeOutboundHostResolved('api.example.com')` 에 도달해, `node:dns/promises` 의 `lookup(hostname, { all: true })`(`http-safety.ts:189`)이 실제 네트워크/로컬 리졸버로 나간다. 나머지 두 테스트는 `assertSafeOutboundUrl` 을 동기적으로 던지게 해 이 지점에 도달하지 않으므로 영향이 없다.
  - 영향: 이 유닛 테스트가 네트워크/DNS 가용성에 의존하게 된다 — 에어갭·방화벽 샌드박스에서 `lookup` 이 멈추거나 느려지면 flaky/hang 을 유발할 수 있고(가드 자체는 DNS 실패 시 fail-open 이라 결과값은 우연히 맞겠지만, 그 경로에 도달하는 데 걸리는 시간은 보장되지 않는다), 순수 유닛 테스트를 표방하는 파일에서 의도치 않은 외부 서비스 호출이 발생한다(점검 관점 7).
  - 참고: 같은 diff 의 다른 spec 파일들(`database-connection-tester.spec.ts`, `http-connection-tester.spec.ts`)은 두 가드를 모두 `jest.fn()` 으로 완전히 대체해 이 문제가 없다. `http-request.handler.spec.ts`/`database-query.handler.handler.spec.ts` 의 `jest.fn(actual.X)`(실물 delegate) 패턴은 이번 diff 이전(`840e8e7f9^`)부터 이미 있던 것이라 이번 변경이 만든 것은 아니다 — 다만 같은 계열의 잠재 문제이므로 참고로 남긴다.
  - 제안: `assertSafeOutboundHostResolved` 도 `jest.fn()` 으로 mock 에 추가하고, `'통과하면 null'` 테스트에서 명시적으로 `mockResolvedValue(undefined)` 를 설정한다.

- **[INFO]** `outboundBlockReason` 의 "던지지 않는다" 암묵 계약이 깨짐 — 호출부는 둘 다 이번 diff 로 갱신되어 문제 없음
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-redirect.ts:30-39` (`outboundBlockReason`)
  - 상세: TS 시그니처(`Promise<string | null>`)는 그대로지만, 이전에는 어떤 오류든 문자열로 삼켜 반환했고 이제는 `SsrfBlockedError` 가 아니면 그대로 던진다. `grep` 으로 확인한 소비자는 `http-request.handler.ts`(`followRedirectsSafely` 경유, 446행 `try`/527행 `catch` 가 임의 예외를 `HTTP_TRANSPORT_FAILED` 로 흡수)와 `http-connection-tester.ts`(위 WARNING 항목의 `try`/`catch`) 둘뿐이며 둘 다 이번 diff 에서 함께 갱신됐다. 저장소 전체에 이 함수의 다른 소비자는 없다(grep 결과 0건). 새 계약 위반 자체는 발견되지 않았으나, 향후 세 번째 소비자가 추가될 때 "던지지 않는다" 는 옛 JSDoc 문구(`followRedirectsSafely` 의 JSDoc 은 "차단은 던지지 않고 반환" 이라고만 하고 이 신규 throw 경로는 언급하지 않음)만 보고 무방비로 호출할 위험이 남는다 — 코드 자체의 결함은 아니라 INFO 로 남긴다.

## 요약

새로 추가된 `SsrfBlockedError` 판별 분기 자체(`database-query.handler.ts`, `http-request.handler.ts`, `database-connection-tester.ts`)는 상태 변경·전역 변수·로그 호출 횟수 면에서 기존 단일 분기를 둘로 쪼갠 것뿐이라 부작용이 없다. 다만 "던지지 않는다" 계약을 지키려고 `outboundBlockReason` 호출 위치를 옮기는 과정에서 두 가지 실질적 부작용이 생겼다: (1) `http-connection-tester.ts` 에서 SSRF 가드가 이제 10초 전송 타임아웃 예산 안에서 실행돼 가드 지연이 오탐성 타임아웃으로 이어질 수 있고, (2) 신설된 `http-redirect.spec.ts` 가 `assertSafeOutboundHostResolved` 를 mock 하지 않아 유닛 테스트 중 실제 DNS 조회가 발생한다. 둘 다 이번 diff 가 직접 만든 신규 부작용이며(부모 커밋과 대조해 확인), 기존 리뷰·뮤턴트 테스트는 판정 분기의 정확성만 봤을 뿐 이 타이밍/네트워크 부작용은 잡아내지 못했다.

## 위험도

MEDIUM
