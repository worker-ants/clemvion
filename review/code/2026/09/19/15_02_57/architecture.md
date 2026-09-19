# 아키텍처 리뷰 — Database · HTTP 연결 테스트

## 발견사항

- **[WARNING]** 이 PR 이 도입한 동시성 안전장치가 `registerEntityTester` 확장점을 관통하지 못한다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:1545`(`dispatchTest` 내부 `this.connectionTestLimit(() => tester(authType, credentials))`), 대조 `:974`(`return entityTester(entity);`), 확장점 선언 `:465`(`registerEntityTester(serviceType, tester)`)
  - 상세: 이 PR 의 핵심 설계는 "연결 테스트가 사용자가 준 host 를 `dns.lookup` 으로 풀어 libuv 스레드풀을 채울 수 있다"는 위험을 `CONNECTION_TEST_MAX_CONCURRENCY`(=2)로 막는 것이다. 그런데 그 래핑은 `transportTesters` 맵(mcp·email·database·http, 하드코딩된 4개)을 거치는 `dispatchTest` 경로에만 있다. `registerEntityTester` 로 등록되는 `entityTesters` 맵(Cafe24·MakeShop 이 현재 등록)은 `getConnectionTest`(974행)에서 동시성 제한 없이 직접 호출된다. 지금은 "호스트가 `*.cafe24api.com` 고정이라 안전하다"는 주석(§121-125 인근)으로 정당화되지만, 이 안전은 타입 시스템이나 구조가 아니라 **주석으로만 강제되는 관례**다. `registerEntityTester` 는 다른 모듈이 자유롭게 호출할 수 있는 공개 확장점(OCP 확장 지점)이므로, 향후 사용자가 host 를 입력하는 새 서비스가 이 경로로 등록되면 이 PR 이 막으려던 libuv 스레드풀 고갈이 조용히 재현된다 — 등록 시점에 이를 막는 가드(타입 구분·런타임 체크·린트 규칙 어느 것도)가 없다.
  - 제안: `EntityAwareTester` 등록 시 "host 가 고정(fixed)인지"를 타입이나 팩토리 함수로 명시하게 하거나, `registerEntityTester` 도 동일한 `connectionTestLimit` 을 기본 적용하고 필요한 경우에만 옵트아웃하도록 방향을 뒤집는다(안전 기본값 우선).

- **[WARNING]** HTTP 노드 실행과 연결 테스트가 자격증명 query parameter 를 URL 에 붙이는 방식이 서로 다르다 — 이 PR 이 명시적으로 막으려던 "테스트 통과 ≠ 실행 성공" 패턴의 축소판
  - 위치: `codebase/backend/src/modules/integrations/http-connection-tester.ts:39-48`(`withQuery` — `new URL(baseUrl); url.searchParams.set(key, value)`) vs `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts:265-273`(`credentials.queryParams` 를 `URLSearchParams().append` + 수동 `?`/`&` 문자열 접합으로 붙임)
  - 상세: `http-credentials.ts`(`resolveHttpCredentials`)는 "노드와 통합 연결 테스트가 **같은 방식으로** 자격증명을 붙이도록" 만든 공유 모듈이라고 스스로 문서화한다. 실제로 헤더 병합 순서(`defaultHeaders` < `headers`)는 두 경로가 동일하게 재사용해 통일됐다. 하지만 query 자격증명(`api_key`/`location: query`)을 URL 에 반영하는 마지막 단계는 공유되지 않고 각자 재구현됐다 — 노드는 `URLSearchParams.append`(같은 키가 이미 있으면 **중복 추가**), 테스터는 `URL.searchParams.set`(같은 키가 있으면 **대체**). `base_url` 에 우연히 같은 이름의 쿼리 파라미터가 이미 있는 경우, 연결 테스트가 통과해도 실제 노드 실행에서는 서버가 두 값을 다르게 해석할 수 있다 — 이 PR 의 존재 이유("연결 테스트가 노드와 다르게 붙이면 테스트 통과가 실행 성공을 뜻하지 않는다", `database-connection.ts`/`http-credentials.ts` 파일 상단 주석)가 스스로 인정하는 위험이 이 한 지점에서 미완결로 남았다.
  - 제안: URL 에 query 를 반영하는 마지막 단계(`withQuery` 상당)도 공유 모듈로 옮기거나, 최소한 두 구현이 같은 `URLSearchParams` 메서드(`set` 또는 `append`)를 쓰도록 통일한다.

- **[INFO]** DB 연결 닫기가 두 드라이버의 비공개 내부 프로퍼티(`connection.stream`)에 구조적으로 의존한다
  - 위치: `codebase/backend/src/modules/integrations/database-connection-tester.ts:25-26`(`type HasSocket = { connection?: { stream?: { destroy?: () => void } } }`), `:49`(`handle.connection?.stream?.destroy?.()`), `:100`(`opened as unknown as HasSocket`)
  - 상세: `pg`·`mysql2` 어느 쪽도 `connection.stream`을 공개 API 계약으로 문서화하지 않는다(내부 구현 세부). 주석이 이 사실을 인지하고 있고 타임아웃 시 강제 종료라는 부차 경로에만 쓰여 위험은 제한적이지만, 접근 전체가 optional chaining(`?.`)으로 감싸여 있어 드라이버 업그레이드로 이 내부 구조가 바뀌면 예외 없이 **조용히 no-op** 된다 — graceful close 가 실패해도 소켓이 파괴되지 않고, 그 사실을 알리는 에러나 테스트 실패 신호가 없다. `mysql2` 쪽은 `as unknown as HasSocket` 캐스팅으로 타입 체커의 구조적 검증까지 우회한다.
  - 제안: 드라이버 버전을 고정(lockfile)하는 것 이상으로, `closeWithin` 이 `destroy` 를 실제로 호출했는지(또는 호출 대상이 `undefined` 였는지)를 관측 가능하게 만들어(예: 로그 한 줄) 드라이버 업그레이드 시 이 안전판이 조용히 무력화되는 것을 조기에 감지할 수 있게 한다.

- **[INFO]** 순환 참조를 피하기 위한 "의존성 없음" 불변식이 코드 주석으로만 강제된다
  - 위치: `codebase/backend/src/nodes/integration/database-query/database-connection.ts:1-9`, `codebase/backend/src/nodes/integration/http-request/http-credentials.ts:1-10`
  - 상세: 두 파일 모두 "이 모듈은 의존성이 없어야 한다"는 아키텍처 불변식을 doc comment 로 명시한다 — `IntegrationsService`를 import 하는 핸들러 쪽으로 역참조가 생기면 순환 import 가 되기 때문이다. 타당한 설계지만, 이 불변식을 기계적으로 강제하는 장치(ESLint `import/no-cycle`, dependency-cruiser 등)가 저장소에 없다(`eslint.config.mjs` 확인). 향후 이 파일에 편의상 import 하나가 추가되면 컴파일은 통과할 수 있어도(타입 전용이 아닌 런타임 순환은 `undefined` 참조 등 미묘한 실패로 나타나기 쉽다) 발견이 늦어진다.
  - 제안: 최소한 이 두 파일에 한정해 `import/no-cycle` 또는 이에 준하는 정적 검사를 추가해 "이 모듈은 잎(leaf)이어야 한다"는 설계 근거를 리뷰 코멘트가 아닌 도구로 지킨다.

- **[INFO]** `transportTesters` 맵 안에서 구현 형태가 혼재한다(서비스 private 메서드 vs 독립 순수 함수 파일)
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:427-433`(맵 등록 — `testMcpTransport`/`testEmailTransport` 는 클래스 private 메서드 바인딩, `database`/`http` 는 `database-connection-tester.ts`/`http-connection-tester.ts` 의 독립 함수)
  - 상세: 같은 `Map<string, TransportTester>` 에 등록되는 네 항목이 두 가지 다른 배치 패턴을 취한다 — MCP·Email 은 `IntegrationsService` 내부 상태(로거·리포지토리 등)에 접근할 수 있는 private 메서드로, Database·HTTP 는 서비스 상태에 전혀 의존하지 않는 완전 독립 함수로 분리됐다. 후자는 노드 핸들러와의 로직 공유가 필요해 발생한 정당한 차이이지만, 이 구분 기준(왜 이 서비스는 파일을 분리하고 저 서비스는 안 하는지)이 코드 어디에도 명시적 규칙으로 남아 있지 않다 — 다음에 다섯 번째 transport tester 를 추가할 사람이 어느 패턴을 따를지 판단할 근거가 plan 문서(`plan/in-progress/integration-db-http-testers.md`)에는 있지만 소스 코드 자체에는 없다.
  - 제안: `integrations.service.ts` 의 `transportTesters` 초기화부 주석에 "노드 실행과 로직을 공유해야 하는 tester 는 독립 파일로, 그렇지 않으면 private 메서드로" 라는 한 줄 규칙을 남겨 다음 확장자의 판단 비용을 줄인다.

- **[INFO]** 공유 SSRF 가드 모듈의 위치가 실제 소비 범위보다 좁게 명명돼 있다
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-safety.ts`(모듈 경로), 신규 소비처 `codebase/backend/src/modules/integrations/database-connection-tester.ts:5`(`assertSafeOutboundHostResolved` import)
  - 상세: `assertSafeOutboundHostResolved`/`assertSafeOutboundUrl` 은 이미 HTTP 노드·Database 노드(사전 존재)에서 쓰이고 있었고, 이번 PR 로 Database·HTTP 연결 테스터까지 더해져 소비처가 4곳으로 늘었다. 그런데 모듈은 여전히 `nodes/integration/http-request/` 아래에 있어, 이름·위치가 "HTTP 전용" 임을 암시한다. (SMTP 쪽은 별도 구현 `smtp-host-guard.ts`를 쓰고 있어 이 모듈을 공유하지 않는다는 사실은 이미 트래커에 등재돼 있으므로 재-flag 하지 않는다.) 이 자체가 결함은 아니지만, 모듈 경계(파일 위치)가 실제 도메인 경계(HTTP 전용이 아니라 outbound-host 안전성 전반)와 어긋나는 상태가 이 PR 로 한 단계 더 굳어졌다.
  - 제안: 당장 이동을 요구하지는 않되, 다음에 이 모듈을 만지는 사람이 `nodes/integration/_shared/` 류의 중립적 위치로의 이동을 고려하도록 짧은 메모를 남겨 둘 가치가 있다.

## 정합성 확인 (문제 없음으로 판단)

- `transportTesters` 를 `Map<string, TransportTester>` 로 두고 `dispatchTest` 는 그 맵만 조회하는 구조는 개방-폐쇄 원칙을 잘 지킨다 — 주석(`integrations.service.ts:88-89`, "New services register a tester here so `dispatchTest` stays closed against modification")이 그 의도를 명시하고, 이번 PR 은 실제로 `dispatchTest` 본체를 고치지 않고 맵 등록만 추가해 그 계약을 지켰다.
- `database-connection.ts`/`http-credentials.ts`/`http-redirect.ts`/`clamp-message.ts` 로의 로직 추출은 노드 핸들러 → `IntegrationsService` 의존 방향과 충돌하지 않는 잎(leaf) 모듈을 만들어 순환 참조를 피한 정확한 리팩터다. `http-credentials.ts` 는 예외 대신 판별 유니언(`HttpCredentialsResult`)을 돌려주고 각 소비처(노드 핸들러는 `IntegrationError` 로, 테스터는 값 그대로)가 자기 계층의 실패 표현으로 변환하는 어댑터 역할을 정확히 수행한다 — 계층 간 예외 전파를 막는 좋은 경계.
- `rotate()` 의 부분 객체 `save({ id, ...changes })` + `Object.assign(entity, changes)` 로의 전환은, 오래 걸리는 연결 테스트 동안 `logUsage` 의 원자적 `update` 가 `save()`(전체 엔티티 저장)에 덮어써지는 stale-write 문제를 구조적으로 막는다 — 계층 경계 위반은 아니며 동시성 정합성 개선이다.
- `IntegrationTestResult` 를 두 신규 테스터 파일에서 `import type` 으로만 참조해 `integrations.service.ts` ↔ 테스터 파일 사이의 런타임 순환을 피한 점은 설계 의도(plan 문서)대로 실현돼 있다.

## 요약

이번 변경은 노드 실행 로직을 의존성 없는 공유 모듈로 정확히 추출해 순환 참조를 피하면서 Database·HTTP 연결 테스트를 새로 배선한 점, `Map` 기반 전략 패턴으로 `dispatchTest` 를 개방-폐쇄 원칙에 맞게 확장한 점에서 구조가 탄탄하다. 다만 이 PR 이 새로 세운 안전 불변식(동시 연결 테스트 상한)이 기존의 공개 확장점(`registerEntityTester`)까지는 미치지 못해, 향후 확장 시 이 PR 이 막으려던 자원 고갈 위험이 그 경로로 재발할 수 있는 구조적 틈이 남아 있다. 또한 "노드와 테스트가 같은 방식으로 동작해야 한다"는 이 PR 의 핵심 설계 목표가 헤더 병합에는 완전히 적용됐지만 query 파라미터 부착 방식에는 미치지 못해, 같은 클래스의 위험(테스트 통과 ≠ 실행 성공)이 좁은 범위로 남아 있다. 두 항목 모두 CRITICAL 은 아니지만 이 PR 의 목적과 정면으로 맞닿아 있어 WARNING 으로 등재한다.

## 위험도

MEDIUM
