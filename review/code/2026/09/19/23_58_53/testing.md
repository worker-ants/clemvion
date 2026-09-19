# 테스트(Testing) 리뷰 — 연결 테스트 결과 코드 상수화 · literal union · 테스트 빈칸 셋 (2라운드)

## 검증 방법 메모

이 diff 는 1라운드 리뷰(`review/code/2026/09/19/23_34_45/`)에서 나온 WARNING 2건(W1: MakeShop
`pingConnection` 런타임 테스트 0건, W2: 타입 계약 테스트가 `TestGateCode` 를 누락)이 커밋
`287aa2b89` 로 반영된 뒤의 상태다. 프롬프트가 컨텍스트 예산으로 생략한 파일(`database-connection-tester.{ts,spec.ts}`,
`http-connection-tester.ts`, `integrations.service.{ts,spec.ts}`, `cafe24-api.client.ts`,
`makeshop-api.client.{ts,spec.ts}`)은 전부 `Read`/`grep` 으로 저장소에서 직접 열어 대조했다.
저장소 파일은 수정하지 않았다(`git status --short` 로 클린 확인 — 세션 출력 디렉터리만 untracked).

핵심 검증:
- `connection-test-codes.spec.ts` 의 `accepted` 6항목이 `IntegrationTestResultCode` 를 구성하는
  6개 부분 union 각각에서 **그 그룹에만 있는(다른 그룹과 겹치지 않는) 리터럴**을 하나씩 골랐음을
  각 union 정의(`connection-test-codes.ts`, `http-credentials.ts`, `mcp-test-connection.service.ts`,
  `cafe24-api.client.ts`, `makeshop-api.client.ts`)와 대조해 확인 — `TestGateCode` 몫으로 추가된
  `INTEGRATION_CREDENTIALS_UNREADABLE` 은 다른 다섯 그룹 어디에도 나타나지 않아 판별력이 있다(생존 뮤턴트
  없음).
- `integrations.service.spec.ts` 신규 테스트("자격증명을 복호화하지 못하면...")는 `IntegrationsService.testConnection`
  의 실제 분기 순서(`isUnreadableCredentials` 체크가 `pending_install` 체크·`entityTesters` 조회보다 먼저)와
  일치하고, `service.registerEntityTester` 가 테스트마다 새로 생성되는 `service` 인스턴스에 등록되므로 다른
  테스트로 전파되지 않음을 최상위 `beforeEach`(매 테스트 `service`/`integrationRepo` 재생성)로 확인했다.
- `makeshop-api.client.spec.ts` 신규 `describe('pingConnection ...')` 4건은 `mapPingError`/`rawPing`/
  `assertCredentials` 실제 분기(200 성공 · 자격증명 누락 `INTEGRATION_INCOMPLETE`(호출 전 차단) · 403
  `MAKESHOP_AUTH_FAILED`(refresh·markAuthFailed 미호출 단언) · fetch 예외 `MAKESHOP_TRANSPORT_FAILED`)와
  1:1 대응함을 소스 대조로 확인 — Cafe24 형제 spec 과 동등한 커버리지가 됐다.
- `database-connection-tester.spec.ts` 의 신규 `it.each` SSL 매핑(require/verify-full/disable)은
  `buildMysqlSsl`(`database-connection.ts:55-62`) 구현과 세 기대값 모두 정확히 일치 — postgres 쪽만
  있던 비대칭이 해소됐다.
- `database-connection-tester.ts` · `http-connection-tester.ts` · `integrations.service.ts` 의
  리터럴 → `CONNECTION_TEST_CODES.*` 치환 지점은 기존 spec(`database-connection-tester.spec.ts`,
  `http-connection-tester.spec.ts`, `integrations.service.spec.ts`)이 여전히 `code: 'DB_HOST_BLOCKED'` ·
  `code: 'HTTP_BLOCKED'` · `result.code).toBe('EMAIL_CONNECT_FAILED')` 등 **리터럴 문자열**로 단언하고
  있어(grep 으로 각 케이스 확인) 상수 오타·와이어 값 회귀를 그대로 잡아낸다.
- `database-driver-sockets.spec.ts` 의 `try { expect(...) } finally { ...destroy?.() }` 전환은
  실제로 방어력이 늘었다 — 이전 코드는 `expect().toBe('function')` 이 실패하면(assert 예외) 그 다음 줄의
  `destroy()` 가 실행되지 못해 loopback 소켓이 열린 채 남았는데, 새 코드는 단언 실패와 무관하게 `finally`
  에서 정리한다.

## 발견사항

- **[INFO]** 1라운드 WARNING 2건은 `287aa2b89` 로 정확히, vacuous 없이 닫혔다 — 재조사 결과 상기 "검증
  방법 메모" 대로 각 신규 테스트가 실제 분기와 1:1 대응했고, 판별력 없는 assertion(예: 항상 true 인 조건,
  분기를 못 가르는 mock)도 발견되지 않았다. 새로 격상할 사항 없음.
  - 위치: `codebase/backend/src/modules/integrations/connection-test-codes.spec.ts`(`accepted` 배열),
    `codebase/backend/src/modules/integrations/integrations.service.spec.ts`(596~616행대 신규 `it`),
    `codebase/backend/src/nodes/integration/makeshop/makeshop-api.client.spec.ts`(620~685행대 신규
    `describe('pingConnection (test-connection probe)')`)
  - 제안: 조치 불필요.

- **[INFO]** `database-connection-tester.spec.ts` 신규 `it.each(['require', ...], ['verify-full', ...], ['disable', undefined])`
  의 세 번째 케이스가 `%j`(JSON.stringify) 포맷 지정자로 `undefined` 를 넘겨 테스트 이름에 `(undefined)`
  가 문자 그대로 찍힌다(JSON.stringify(undefined) 자체는 `undefined` 값이라 `%j` 가 fallback 표시를
  쓴다) — 실행·판정에는 영향 없는 순수 가독성 이슈.
  - 위치: `codebase/backend/src/modules/integrations/database-connection-tester.spec.ts`
    (`it.each([...])('SSL %s → 노드와 같은 매핑(%j)', ...)` 블록, `disable` 행)
  - 제안: 선택 사항. `%j` 대신 `%p`(util.inspect) 로 바꾸거나 세 번째 행의 기대값을 `'undefined'` 문자열로
    사전 포맷해 두면 테스트 이름이 더 명확해진다. 기능적 결함 아님.

- **[INFO]** 타입 수준 계약 테스트(`connection-test-codes.spec.ts` `it('타입 수준 계약 (런타임 no-op)')`)는
  여전히 jest 런타임에서 no-op 이고 실제 가드는 별도 `tsc` 래칫 스크립트다 — 1라운드에서 이미 INFO 로
  기록되고 "조치 없음(build 단계에서 확인됨)" 으로 처분된 항목과 동일하며, 이번 라운드에도 코드 변화가
  없어 재조사할 새 사실이 없다. 재-flag 아님 — 컨텍스트 보존 목적으로만 언급.
  - 위치: `codebase/backend/src/modules/integrations/connection-test-codes.spec.ts`
  - 제안: 조치 불필요(이미 다뤄짐).

## 좋은 점 (회귀 안전성 재확인)

- `IntegrationTestResultCode` union 을 구성하는 6개 그룹 전부가 (a) 타입 계약 테스트에서 최소 1개 판별
  리터럴로, (b) 런타임 spec 에서 최소 1개 이상의 실제 분기 테스트로 각각 커버된다 — 1라운드가 지적한
  "타입은 좁혔는데 런타임이 안 따라간다" 축의 갭이 실제로 닫혔다.
- rotate() 의 "update 성공 뒤 재조회 null → 404" 신규 테스트는 `findOne` 을 `mockResolvedValueOnce` 두
  번으로 순서를 고정해 `requireEntity` 호출과 재조회 호출을 정확히 구분했고, 실제 `rotate()` 구현(1150행
  부근 `saved = affected ? await ...findOne(...) : null`)과 1:1 대응한다 — 이전부터 있던 "update 0행"
  케이스와 겹치지 않는 별개의 경합 시나리오다.
- 모든 신규 spec 블록은 파일 최상위 `beforeEach` 가 mock·서비스 인스턴스를 매 테스트 재생성하는 기존
  패턴을 그대로 따르고 있어, 테스트 간 격리가 깨질 소지(예: `registerEntityTester` 등록이 다음 테스트로
  누수)가 없다.

## 요약

1라운드 Testing 리뷰가 지적한 WARNING 2건(MakeShop `pingConnection` 런타임 테스트 부재, 타입 계약
테스트의 `TestGateCode` 누락 + 그 런타임 분기 미검증)은 이번 diff(커밋 `287aa2b89`)에서 실제 구현
분기와 정확히 대응하는, 판별력 있는 테스트로 닫혔다 — mock 이 실제 동작과 괴리되거나 assertion 이 vacuous
한 경우는 발견되지 않았다. `database-connection-tester.spec.ts` 의 mysql SSL 매핑 `it.each` 와
`database-driver-sockets.spec.ts` 의 `try/finally` 소켓 정리도 각각 실제 매핑 함수·소켓 누수 시나리오를
정확히 겨냥한다. 새로 발견한 Critical/Warning 은 없으며, 남은 항목은 테스트 이름 포맷팅 수준의 INFO
하나뿐이다.

## 위험도

NONE
