# 아키텍처(Architecture) Review

## 발견사항

- **[WARNING]** HTTP 리다이렉트 추종 + 홉마다 SSRF 재검증 알고리즘이 노드 실행 경로와 연결 테스트 경로에 **두 번 구현**되어 있다 — 이 PR 이 다른 로직(자격증명 헤더 조립, DB 연결 옵션)에는 정확히 적용한 "노드·테스터 공유 모듈로 추출" 원칙이 이 부분에는 적용되지 않았다.
  - 위치: `codebase/backend/src/modules/integrations/http-connection-tester.ts` 의 `testHttpConnection` (게이트 146~168행, `while (res.status >= 300 && ... )` 루프) vs `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts:425-467` (기존 코드, 이번 diff 밖)
  - 상세: 두 구현 모두 "manual redirect + 홉마다 `assertSafeOutboundUrl`/`assertSafeOutboundHostResolved` 재검증 + 5홉 초과 시 차단" 이라는 동일한 보안-민감 알고리즘을 독립적으로 구현한다. 이미 비대칭 징후가 있다 — 핸들러는 홉 상한을 리터럴 `5` 로 하드코딩했고(`if (hops >= 5)`), 테스터는 이름 붙은 상수 `HTTP_TEST_MAX_REDIRECTS`(export 됨)를 쓴다. 같은 파일 안에서 `resolveHttpCredentials`/`buildPgConnection` 처럼 "공유 모듈로 뽑아 순환 import 없이 재사용" 하는 패턴을 명시적으로 적용해 놓고, 정확히 같은 이유(테스트 통과가 실행 성공을 뜻해야 한다)로 더 중요한 이 리다이렉트 로직만 손으로 복제한 것은 설계 원칙의 불일치다. 두 구현이 갈라지면(예: 핸들러 쪽만 홉 제한 로직을 수정하거나, relative Location 처리 방식이 바뀌면) 연결 테스트 통과가 더 이상 노드 실행 성공을 보장하지 않게 되는데, 이는 이 PR 의 스스로 밝힌 존재 이유(spec 인용: "테스트 통과가 실행 성공을 뜻하지 않는다" 문제를 없애는 것)를 정면으로 훼손하는 지점이라 INFO 가 아니라 WARNING 으로 본다.
  - 제안: 리다이렉트 루프(manual fetch 상태머신 + 홉 카운터 + 홉별 SSRF 재검증)를 `http-safety.ts` 또는 새 `http-redirect.ts` 같은 의존성 없는 공유 모듈로 추출해 핸들러와 테스터가 같은 함수를 호출하게 한다. 최소한 홉 상한(`5`)만이라도 핸들러가 `HTTP_TEST_MAX_REDIRECTS`(또는 이름을 바꾼 공용 상수)를 참조하도록 통일한다.

- **[INFO]** 두 신규 테스터 파일과 `integrations.service.ts` 사이의 순환-회피가 `import type` 소거에만 의존하며, 이를 강제하는 tooling 이 없다.
  - 위치: `codebase/backend/src/modules/integrations/database-connection-tester.ts:13`, `codebase/backend/src/modules/integrations/http-connection-tester.ts:10` (`import type { IntegrationTestResult } from './integrations.service'`) — 역방향으로 `integrations.service.ts:54-55` 가 두 테스터의 함수(값)를 import
  - 상세: `IntegrationTestResult` 타입이 "상위" 오케스트레이터인 `integrations.service.ts` 에 정의되어 있고, 그것을 의존하는 "하위" 테스터 모듈이 값(함수)은 위로, 타입은 아래로 주고받는 양방향 파일 쌍을 이룬다. 현재는 `import type` 이라 TS 가 런타임에서 소거하므로 순환 require 가 발생하지 않지만, 이 무결성은 사람이 계속 `type` 키워드를 붙이는 것에만 의존한다. `tsconfig.json` 은 `isolatedModules: true` 이지만 `verbatimModuleSyntax`나 `@typescript-eslint/consistent-type-imports` lint 규칙은 확인되지 않아, 누군가 실수로 값 import 로 바꾸면(혹은 `IntegrationTestResult` 에 런타임 상수를 추가하면) 조용히 순환 import 가 재도입될 수 있다. `database-connection.ts`/`http-credentials.ts` 에 적힌 "이 모듈은 의존성이 없어야 한다" 라는 불변식도 코드 주석으로만 존재하고 자동 가드(dependency-cruiser, import boundary lint 등)가 없다.
  - 제안: `IntegrationTestResult` 를 서비스 파일이 아니라 중립적인 타입 전용 모듈(예: `integration-test-result.ts`)로 옮겨 테스터·서비스 모두 그곳에서 가져오게 하면 파일 쌍의 양방향 참조 자체가 사라진다. 여력이 있으면 `@typescript-eslint/consistent-type-imports` 를 켜서 "type-only 소거로 순환을 막는다" 는 설계 의도를 도구가 함께 보증하게 한다.

- **[INFO]** `TransportTester` 맵에 등록된 `database` 엔트리가 시그니처를 맞추기 위한 어댑터 람다(`(_authType, credentials) => testDatabaseConnection(credentials)`)로 감싸져 있다 — Strategy 맵의 획일적 인터페이스에 `testDatabaseConnection` 하나만 맞지 않는 것으로, 지금은 사소하지만 세 번째로 authType 을 안 쓰는 테스터가 추가되면 같은 어댑터가 반복될 여지가 있다.
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` (게이트 407~410행, `transportTesters` 구성부)
  - 상세: 큰 문제는 아니며 `http`(`testHttpConnection` 자체가 `(authType, credentials)` 시그니처라 어댑터 불요)와 대비해 `database` 만 어댑터가 필요한 것은 함수 시그니처 설계의 사소한 비일관성이다.
  - 제안: 필요 시 `testDatabaseConnection` 도 `(authType, credentials)` 시그니처로 통일하거나, 현재처럼 어댑터로 두되 셋째 사례가 나오면 그때 통일을 재검토.

## 요약

이 PR 은 Database·HTTP 연결 테스트를 실제 왕복으로 승격시키면서, 노드 실행 경로(핸들러)와 연결 테스트 경로(테스터)가 같은 동작을 하도록 자격증명 조립(`http-credentials.ts`)과 DB 연결 옵션(`database-connection.ts`)을 의존성 없는 공유 모듈로 명시적으로 추출한 점이 돋보인다 — `IntegrationsService` ↔ 노드 핸들러 사이의 기존 참조 방향을 깨지 않으면서 순환 import 를 피한 설계이고, `clamp-message.ts` 분리·`transportTesters` Map 기반 Strategy 패턴(OCP)도 적절하다. 다만 정확히 같은 원칙이 적용됐어야 할 HTTP 리다이렉트 추종+홉별 SSRF 재검증 알고리즘은 핸들러와 테스터에 독립적으로 복제되어 있고 이미 상한값 표현(리터럴 vs 명명 상수)이 갈라지기 시작했다는 점이 이번 변경에서 가장 눈에 띄는 아키텍처 결함이다. 그 외 순환-회피 설계가 `import type` 소거와 주석-only 불변식에 의존해 도구적 강제가 없다는 점, `database` 테스터의 어댑터 람다는 경미한 관찰 사항이다. 리뷰 중 저장소 파일에 어떤 뮤테이션도 가하지 않았다(`git status --short` 로 별도 확인 불요 — Read/Bash 조회만 수행).

## 위험도
MEDIUM
