# 테스트(Testing) 리뷰 — 연결 테스트 결과 코드 상수화 · literal union

## 발견사항

- **[WARNING]** MakeShop `pingConnection`/`mapPingError` 는 저장소 전체에서 런타임 테스트가 0건이다 — 형제 구현인 Cafe24 와 비대칭
  - 위치: `codebase/backend/src/nodes/integration/makeshop/makeshop-api.client.ts` (`mapPingError`, `pingConnection`) — 대응하는 `codebase/backend/src/nodes/integration/makeshop/makeshop-api.client.spec.ts` 에 `pingConnection`/`mapPingError`/`MAKESHOP_AUTH_FAILED`/`MAKESHOP_TRANSPORT_FAILED` 를 검색해도 매치 0건
  - 상세: 이번 PR 은 `MakeshopPingCode`(`'MAKESHOP_AUTH_FAILED' | 'MAKESHOP_TRANSPORT_FAILED' | 'INTEGRATION_INCOMPLETE'`)를 새로 export 해 `IntegrationTestResultCode` union 에 편입시켰다(파일 10 diff). 같은 패턴의 `Cafe24PingCode` 는 `cafe24-api.client.spec.ts`(`describe('pingConnection (test-connection probe)')`, 2150~2516행)에서 4개 코드 분기 전부를 `expect(result.code).toBe(...)` 리터럴로 고정하는데, MakeShop 쪽은 `pingConnection` 을 호출하는 테스트 자체가 `makeshop-api.client.spec.ts`·`integrations.service.spec.ts`·e2e 어디에도 없다(`grep -rln pingConnection` 결과 makeshop 쪽 spec 파일 매치 0). 타입을 좁혀도 그 타입이 실제로 맞물리는지 확인할 런타임 검증이 없어, `mapPingError` 안에서 코드 문자열을 잘못 적어도 어떤 테스트도 잡지 못한다. 이 갭은 이번 diff 가 만든 것은 아니지만(사전부터 있었음), 이번 PR 이 그 계약을 컴파일타임 union 으로 승격시키면서 런타임 비대칭을 더 두드러지게 만들었다.
  - 제안: `makeshop-api.client.spec.ts` 에 Cafe24 쪽과 대칭되는 `describe('pingConnection')` 블록을 추가해 `MAKESHOP_AUTH_FAILED`(401/403) · `MAKESHOP_TRANSPORT_FAILED`(네트워크 실패 · catch-all) · `INTEGRATION_INCOMPLETE`(자격증명 누락) 세 분기를 리터럴 문자열로 고정할 것. 이번 PR 범위 밖이면 최소한 plan 의 "테스트 빈칸" 목록(4번째 항목)으로 등재.

- **[WARNING]** 새 타입 수준 계약 테스트가 7개 생산자 중 `TestGateCode`(게이트 코드)를 빠뜨렸고, 그 런타임 분기도 어디서도 테스트되지 않는다
  - 위치: `codebase/backend/src/modules/integrations/connection-test-codes.spec.ts` `it('타입 수준 계약 (런타임 no-op)')` 의 `accepted` 배열(게이트 32~38행) + `codebase/backend/src/modules/integrations/integrations.service.ts` `testConnection` 의 `isUnreadableCredentials` 분기(`code: 'INTEGRATION_CREDENTIALS_UNREADABLE'`, 965행)
  - 상세: `plan/in-progress/connection-test-codes-and-gaps.md` 는 "타입을 좁히자 컴파일러가 일곱째(게이트 코드 `INTEGRATION_CREDENTIALS_UNREADABLE` · `INTEGRATION_INCOMPLETE`)를 찾아냈다"고 명시한다. 그런데 신설된 `connection-test-codes.spec.ts` 의 `accepted` 배열은 `DB_AUTH_FAILED`(TransportTestCode) · `MCP_TIMEOUT`(McpFailureCode) · `CAFE24_INSUFFICIENT_SCOPE` · `MAKESHOP_TRANSPORT_FAILED` · `INTEGRATION_AUTH_UNSUPPORTED`(HttpCredentialsResult) 다섯만 담아, `IntegrationTestResultCode` 를 구성하는 6개 부분 union 중 `TestGateCode` 하나가 어디서도 리터럴로 확인되지 않는다. 게다가 `INTEGRATION_CREDENTIALS_UNREADABLE` 은 `IntegrationsService.testConnection`(965행)에서 실제로 반환되는 값인데, `integrations.service.spec.ts` 의 `describe('testConnection')`(583~746행)에는 `pending_install`(`INTEGRATION_INCOMPLETE`) 분기 테스트는 있어도(676·720행) `isUnreadableCredentials` 분기 테스트가 전혀 없다(`grep -in unreadable` 매치 0). 즉 이 문자열은 타입 테스트도, 유닛 테스트도 어느 쪽도 고정하지 않는 유일한 생산자다.
  - 제안: (1) `accepted` 배열에 `{ code: 'INTEGRATION_CREDENTIALS_UNREADABLE' }` 한 항목을 추가해 6개 부분 union 전체가 최소 1개씩 커버되게 할 것. (2) `integrations.service.spec.ts` 의 `testConnection` describe 에 `entity.credentials` 가 unreadable sentinel 일 때 `code: 'INTEGRATION_CREDENTIALS_UNREADABLE'` 를 반환하는 테스트 1건 추가.

- **[INFO]** 타입 수준 계약 테스트는 jest 에서 항상 no-op — 문서화는 잘 돼 있으나 durability 리스크는 남는다
  - 위치: `codebase/backend/src/modules/integrations/connection-test-codes.spec.ts` `it('타입 수준 계약 (런타임 no-op)')`
  - 상세: 주석이 "강제하는 것은 jest 가 아니라 tsc(`check-backend-typecheck-ratchet.py`)"라고 명확히 밝히고 있어 오해의 소지는 낮다. 다만 `npm test`/`jest` 만 돌리는 워크플로(예: 부분 재실행)에서는 이 테스트가 항상 GREEN 이므로 "테스트가 통과했으니 안전하다"는 착시를 줄 수 있다 — 실제 가드는 별도 스크립트가 build 단계에서만 실행된다는 점을 CI 설정 쪽에서도 재확인해 둘 필요가 있다(이번 diff 범위 밖).

## 좋은 점 (회귀 안전성 확인)

- `database-connection-tester.ts` · `http-connection-tester.ts` · `integrations.service.ts` 의 리터럴 → `CONNECTION_TEST_CODES.*` 치환은 기존 spec (`database-connection-tester.spec.ts`, `http-connection-tester.spec.ts`, `integrations.service.spec.ts`)이 전부 **리터럴 문자열**로 `result.code` 를 단언하고 있어 (`toBe('EMAIL_HOST_BLOCKED')` 등) wire 값 회귀를 그대로 잡아낸다. 상수 오타가 있었다면 이 기존 테스트들이 먼저 깨졌을 것 — 실측 확인함.
- `integrations.service.spec.ts` 신규 테스트("update 는 1행을 바꿨는데 다시 읽기 전에 지워졌으면 404")는 `rotate()` 의 `update` 성공 뒤 재조회가 `null` 인 실제 미검증 분기(`integrations.service.ts:1152`)를 정확히 타겟한다. 기존 "affected:0" 404 테스트와 겹치지 않고, `findOne` 을 `mockResolvedValueOnce` 두 번으로 순서를 고정해 `requireEntity` 호출과 재조회 호출을 구분한 방식이 실제 코드 흐름(`requireEntity` → `update` → 재조회)과 정확히 일치함을 `integrations.service.ts` 원본 대조로 확인.
- `database-driver-sockets.spec.ts` 의 `try/finally` 리팩터는 단언 실패 시에도 소켓을 정리해 테스트 간 리소스 누수를 막는 개선. 기능 테스트는 아니지만 테스트 위생 측면에서 긍정적.
- `it.each` mysql SSL 매핑 테스트(`require`/`verify-full`/`disable`)는 실제 `buildMysqlSsl` 구현(`database-connection.ts:55-62`)과 대조해 세 기대값이 정확히 일치함을 확인 — vacuous 아님, DB 노드와의 파리티 실측 검증.
- `Cafe24PingCode`/`MakeshopPingCode` 타입 좁히기는 순수 컴파일타임 변경이며, Cafe24 쪽은 기존 `pingConnection` spec(4개 분기 전부 리터럴 검증)이 이미 회귀를 방지한다.

## 요약

이번 변경은 연결 테스트 결과 코드를 상수/literal union 으로 좁히는 리팩터로, 대부분 순수 타입 수준 변경이라 기존 테스트(리터럴 문자열 단언 위주)가 자연스럽게 회귀 방지망 역할을 한다. 신규로 추가된 `rotate()` 404 분기 테스트와 mysql SSL 매핑 테스트는 실제 미검증 코드 경로를 정확히 겨냥한 양질의 테스트다. 다만 이번 PR 이 스스로 "7개 생산자를 모았다"고 주장하는 타입 계약 테스트가 그중 하나(`TestGateCode`/`INTEGRATION_CREDENTIALS_UNREADABLE`)를 빠뜨렸고, 그 런타임 분기도 저장소 전체에서 테스트된 적이 없다는 점, 그리고 `MakeshopPingCode` 가 컴파일타임 계약에 편입됐음에도 `pingConnection` 자체는 (Cafe24 와 달리) 런타임 테스트가 전무하다는 점은 이번 작업의 "테스트 빈칸을 닫는다"는 목표와 직접 관련된 잔여 갭이다. Critical 은 없다.

## 위험도

LOW
