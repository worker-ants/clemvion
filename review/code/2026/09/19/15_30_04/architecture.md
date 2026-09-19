# 아키텍처 리뷰 — Database · HTTP 연결 테스터

## 발견사항

- **[INFO]** 공유 계약 타입(`IntegrationTestResult`)이 orchestrator(god service) 안에 정의돼 있고, 신규 순수 함수 모듈 둘이 그것을 역참조한다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:76`(선언) ← `codebase/backend/src/modules/integrations/database-connection-tester.ts:13`, `codebase/backend/src/modules/integrations/http-connection-tester.ts:14`(type-only import)
  - 상세: `database-connection-tester.ts`·`http-connection-tester.ts`는 "의존성 없는 순수 함수" 모듈을 지향해 노드 핸들러 쪽 로직(`database-connection.ts`·`http-credentials.ts`·`http-redirect.ts`)은 실제로 무의존으로 잘 뽑아냈다. 그런데 두 테스터가 돌려주는 결과 타입 `IntegrationTestResult`는 여전히 1600줄 넘는 `integrations.service.ts`가 소유한다. `import type`이라 런타임 순환은 없지만, 방향은 "하위 유틸이 상위 orchestrator의 타입에 의존"하는 역전된 모양이다. 앞으로 세 번째 테스터가 추가되면 같은 패턴이 반복돼 결합이 커진다.
  - 제안: `IntegrationTestResult`를 별도 파일(예: `integration-test-result.ts`)로 뽑아 `integrations.service.ts`와 테스터들이 동등하게 import하게 하면, 이번 PR이 이미 시작한 "의존성 없는 공유 모듈" 패턴과 일관된다.

- **[WARNING]** DB 커넥션 종료가 드라이버의 비공개 내부 구조(`connection.stream`)에 직접 접근한다 — 두 서드파티 라이브러리의 암묵적 계약에 결합
  - 위치: `codebase/backend/src/modules/integrations/database-connection-tester.ts:25-26`(`HasSocket` 타입), `:34-61`(`closeWithin`), `:115`(`openedConnection as unknown as HasSocket`)
  - 상세: `pg.Client`·mysql2 `Connection`의 공개 타입에는 `connection.stream`이 없다(코드 자체가 `as unknown as HasSocket`으로 타입 시스템을 우회). graceful close가 `DB_TEST_CLOSE_GRACE_MS` 안에 안 끝나면 두 드라이버 모두 같은 내부 필드 이름(`connection.stream.destroy`)에 기대어 소켓을 강제 파괴한다. 주석 자체가 "드라이버 내부 구조가 바뀌면 여기로 온다"고 인지하고 있고, 그 경우 폴백은 `logger.warn`만 남기고 소켓을 누출 상태로 둔다 — 결과(성공/실패 판정)는 바뀌지 않으므로 정합성 결함은 아니지만, pg·mysql2의 마이너 업그레이드 한 번으로 조용히 무력화될 수 있는 결합이다.
  - 제안: 최소한 두 드라이버 버전을 pin하거나, 이 가정이 깨졌을 때 알아챌 수 있는 spec/unit 테스트를 드라이버 업그레이드 CI 경로에 붙여 두면 회귀를 조기에 잡을 수 있다(지금은 `logger.warn`만 있어 프로덕션에서만 드러난다).

- **[INFO]** 동시성 게이트(`connectionTestLimit`)가 재진입(reentrancy)을 막는 구조적 장치 없이 "관례"로만 안전하다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:409-412`(필드 선언), `:975-976`(entity tester 경로), `:1550`(transport tester 경로)
  - 상세: 같은 `pLimit(2)` 인스턴스를 entity tester 경로와 transport tester 경로가 공유한다. 지금 등록된 entity tester(Cafe24 `cafe24Api.pingConnection`, MakeShop 대응)는 `dispatchTest`/`connectionTestLimit`을 다시 호출하지 않으므로 안전하지만, 이는 코드가 강제하는 게 아니라 "그렇게 짜지 않았다"는 관례에 의존한다. 향후 어떤 entity tester(또는 transport tester)가 내부적으로 기존 테스터를 합성해 `dispatchTest`를 다시 호출하면, 이미 슬롯을 하나 쥔 채로 같은 리미터에 재진입 요청을 넣게 되고, `CONNECTION_TEST_MAX_CONCURRENCY=2`가 포화된 상태에서는 교착(deadlock)으로 이어질 수 있다. 주석은 이 확장 시나리오를 명시적으로 예상하고 있다("확장점으로 들어오는 테스터도 기본적으로 묶는다").
  - 제안: 재진입을 감지해 즉시 실행하거나 에러를 던지는 가드(예: `AsyncLocalStorage` 플래그)를 넣거나, 최소한 `registerEntityTester`/`transportTesters` 등록부에 "이 콜백 안에서 다른 connection test를 호출하지 말 것"이라는 계약을 JSDoc으로 못박아 두면 다음 확장자가 실수하기 어려워진다.

## 긍정적으로 확인된 설계

- 순환 참조 회피가 의도적이고 잘 문서화됨: 노드 핸들러(`database-query.handler.ts`, `http-request.handler.ts`)는 `IntegrationsService`를 import하고, `IntegrationsService`는 새 테스터를 import한다. 테스터가 핸들러를 직접 import했다면 순환이 생겼을 것을, `database-connection.ts`·`http-credentials.ts`·`http-redirect.ts`를 "의존성 없는" 공유 커널로 뽑아 핸들러와 테스터 양쪽이 그것만 바라보게 했다(각 파일 최상단 주석이 이 설계 의도를 명시). 이는 DIP를 실질적으로 적용한 사례다.
- `appendQueryParams`·`resolveHttpCredentials`·`followRedirectsSafely`를 노드 실행 경로와 연결 테스트 경로가 그대로 공유하게 만들어, "테스트 통과 = 실행 성공"이라는 불변식을 코드 구조로 보장한다(주석에도 이 근거가 명시). 이런 종류의 의도치 않은 drift(테스트 따로, 실행 따로)를 아키텍처 차원에서 막는 좋은 선택이다.
- `IntegrationsService`(이미 1600줄대 god service)에 새 테스터 로직을 서비스 메서드로 더 추가하지 않고 별도 모듈(`database-connection-tester.ts`, `http-connection-tester.ts`)로 분리해 배선만 서비스에 남긴 점은 기존 email/mcp 테스터가 서비스 내부 메서드로 남아 있는 것과 대비되는 개선 방향이다.
- 동시성 상한(`pLimit`)을 도입한 근거(‘`dns.lookup`이 libuv 스레드풀을 점유해 무관한 작업까지 지연시킨다’)가 주석에 구체적 메커니즘과 함께 남아 있어, 다음 사람이 왜 2라는 숫자를 골랐는지 추적 가능하다.

## 요약

이번 변경은 새 연결 테스트 기능을 추가하면서 노드 실행 경로와의 순환 참조를 피하기 위해 공유 커널 모듈을 신중하게 설계했고(`database-connection.ts`·`http-credentials.ts`·`http-redirect.ts`), 그 결과 "테스트 통과 = 실행 성공"이라는 불변식이 코드 구조로 보장된다는 점에서 아키텍처적으로 견고하다. 다만 계약 타입(`IntegrationTestResult`)의 소유권이 여전히 god service 쪽에 남아 있는 점, DB 커넥션 종료 로직이 서드파티 드라이버의 비공개 내부 구조에 의존하는 점, 그리고 새로 도입한 프로세스 전역 동시성 게이트가 재진입을 구조적으로 막지 못하고 관례에 의존하는 점은 향후 확장 시 조용히 깨질 수 있는 잠재 리스크다. 모두 CRITICAL 수준은 아니며 현재 등록된 테스터 구성에서는 실제로 발현하지 않는다.

## 위험도
LOW
