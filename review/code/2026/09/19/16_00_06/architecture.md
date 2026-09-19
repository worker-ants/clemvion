# 아키텍처 리뷰 — Database·HTTP 통합 연결 테스트 실접속화

## 발견사항

- **[WARNING]** `registerEntityTester` 확장점의 "재진입 금지" 계약이 문서로만 존재하고 코드로 강제되지 않는다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:464-472` (계약 서술), `:984` (`connectionTestLimit(() => entityTester(entity))`), `:1570` (`connectionTestLimit(() => tester(authType, credentials))`)
  - 상세: `connectionTestLimit = pLimit(CONNECTION_TEST_MAX_CONCURRENCY)`(2슬롯)를 `dispatchTest`(transport tester)와 `testConnection`(entity tester)이 공유한다. JSDoc 은 "entity tester 는 `testConnection`/`previewTest`/`rotate` 를 되불러선 안 된다 — 같은 한도에 대한 중첩 대기는 슬롯이 모두 그 테스터에 잡히면 교착한다" 고 명시하지만, 이를 막는 런타임 가드(재진입 카운터, 별도 세마포어, 타입 레벨 제약)가 없다. 확장점(`registerEntityTester`)의 소비자는 정의상 이 모듈 밖의 인프라 모듈(Cafe24Module 등)이라 계약을 읽지 않고 위반할 개연성이 있고, 위반 시 증상이 "즉시 에러"가 아니라 "조용한 교착"이라 디버깅 비용이 크다. LSP 관점에서 보면 `EntityAwareTester` 인터페이스의 사전조건(비재진입)이 타입 서명에 드러나지 않는다.
  - 제안: 최소한 개발 모드에서 재진입을 감지해 즉시 throw 하는 가드(예: 현재 실행 중인 tester 집합을 추적)를 두거나, 세마포어 획득에 타임아웃을 둬 교착이 무한정 지속되지 않게 한다. 당장 아니라면 이 위험이 실제로 발생하는지 통합/e2e 테스트로 최소 한 번 가드해 두는 편이 안전하다.

- **[INFO]** 새로 공유되는 `clampMessage` 가 MCP 전용 네이밍의 상수에 계속 의존한다 — 도메인 경계와 이름이 어긋난다
  - 위치: `codebase/backend/src/modules/integrations/clamp-message.ts:1` (`import { MCP_ERROR_MESSAGE_MAX_LEN } from '../mcp/mcp-error-codes'`)
  - 상세: `clampMessage` 는 이번 PR 로 `integrations.service.ts` 의 private 함수에서 독립 모듈로 승격됐고, JSDoc 이 "email · database · http testers 의 connection-test 결과 메시지에도 같은 상한을 적용한다(consistency)" 고 명시한다 — 즉 지금은 서비스 유형을 가리지 않는 범용 유틸리티다. 그런데 그 상한값의 SoT(`MCP_ERROR_MESSAGE_MAX_LEN`)는 여전히 `modules/mcp/mcp-error-codes.ts` 라는 MCP 전용 서브모듈에 있고 이름도 `MCP_` 접두를 달고 있다. 결과적으로 `modules/integrations/database-connection-tester.ts`·`http-connection-tester.ts`·`clamp-message.ts` 세 파일이 "MCP 모듈"에 의존하는 모양이 된다 — 실제로는 `Integration.last_error`/`IntegrationUsageLog.error` 컬럼 폭이라는 통합 전반의 관심사인데, 이름과 소속이 그 범위를 반영하지 못한다. (이 상수 자체는 이번 PR 이전부터 존재했고 문제도 사전부터 있었지만, 이번 PR 이 그 소비처를 1개(`logUsage`)에서 4개 서비스 타입으로 넓히며 불일치를 더 눈에 띄게 만들었다.)
  - 제안: 상수를 이름·위치 모두 범용화(`modules/integrations/` 하위 또는 `common/` 로 이동 + `INTEGRATION_ERROR_MESSAGE_MAX_LEN` 류 이름)하거나, 최소한 `mcp-error-codes.ts` 의 이 export 옆에 "MCP 전용이 아니라 전 서비스 공용 SoT" 임을 재확인하는 주석을 강화한다.

- **[INFO]** 두 계층(노드 실행 / 통합 관리)이 공유하는 "리프" 모듈이 실행 계층 폴더 밑에 물리적으로 위치한다
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-credentials.ts`, `codebase/backend/src/nodes/integration/http-request/http-redirect.ts`, `codebase/backend/src/nodes/integration/database-query/database-connection.ts`
  - 상세: 세 파일 모두 "노드 핸들러와 연결 테스터가 같은 로직을 쓰게 하되, 핸들러가 `IntegrationsService` 를 import 하므로 반대 방향으로 가져오면 순환 import 가 된다"는 동일한 근거로 의존성 0(leaf)으로 추출됐다 — 실제로 그래프를 추적한 결과 순환은 없다(`database-connection-tester.ts`/`http-connection-tester.ts` → 이 leaf 파일들 → (더 이상 없음), `*.handler.ts` → 같은 leaf 파일들 + `IntegrationsService`). 설계 의도와 실행 결과 모두 건전하다. 다만 이 leaf 들은 이제 "노드 실행 계층 전용" 이 아니라 "노드 실행 계층 + 통합 관리 계층이 함께 쓰는 공유 커널"인데, 물리적 위치는 여전히 소비자 중 한쪽(`nodes/integration/*`) 안에 있다 — `modules/integrations`(관리/서비스 계층)가 `nodes/*`(실행 계층) 내부 파일을 세 곳에서 import하는 모양이 되어, 상위 계층이 하위 계층의 내부 구현 위치에 물리적으로 얹혀 있는 형태다. 지금 규모에서는 문제가 없지만, 공유 대상이 늘어나면 두 계층 중 누구 소유인지 혼동될 여지가 있다.
  - 제안: 지금 당장 옮길 필요는 없다 — 다만 다음에 같은 종류(예: MCP·Email 도 비슷한 leaf 를 뽑게 되는 경우)가 하나 더 생기면, `nodes/integration/_shared/` 류의 중립 위치로 모으는 편이 계층 경계를 명확히 유지한다.

- **[INFO]** `PreviewTestResultDto`/`TestConnectionResultDto` 의 `code` 필드가 공통 베이스 없이 두 클래스에 각각 선언된다
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:258` (`PreviewTestResultDto.code`), `:484` (`TestConnectionResultDto.code`)
  - 상세: 두 DTO 는 "형제 — 두 엔드포인트가 같은 `dispatchTest` 결과를 돌려준다"는 것을 스스로 문서화할 만큼 필드가 겹친다(`success`·`message`·이번에 추가된 `code`). 상속/믹스인 없이 독립 클래스로 유지돼 온 기존 패턴을 이번 PR 도 그대로 따랐다 — 새 결함은 아니지만 두 곳에 같은 JSDoc·데코레이터를 복제하는 비용이 이번 필드로 한 번 더 늘었다. NestJS/Swagger 데코레이터 기반 DTO 에서는 흔한 트레이드오프이므로 이번 PR 범위에서 고칠 사안은 아니다.
  - 제안: 조치 불요 — 향후 세 번째 형제 DTO가 생기면 공통 `BaseTestResultDto` 추출을 고려.

## 정합성 확인 (문제 없음 — 설계가 잘 된 지점)

- **전략 패턴 + 개방-폐쇄**: `IntegrationsService.transportTesters`(`Map<string, TransportTester>`, 생성자에서 mcp·email·database·http 등록)와 `entityTesters`(`registerEntityTester` 로 외부 모듈이 런타임 등록)는 신규 서비스 타입 추가 시 `dispatchTest`/`testConnection` 본문을 건드리지 않아도 되는 구조다. `dispatchTest`(`integrations.service.ts:1553-1576`) 자체 doc-comment 가 "stays closed against modification" 을 명시하고 실제로 그렇다.
- **의존성 역전**: Cafe24·MakeShop 전용 로직은 `IntegrationsModule` 이 `nodes/*` 를 직접 참조하지 않고, 해당 인프라 모듈이 부팅 시 `registerEntityTester` 로 자신을 등록하는 방향으로 뒤집혀 있다(`integrations.service.ts:459-462` 주석).
- **순환 의존 회피가 실제로 작동함**: `database-connection.ts`/`http-credentials.ts`/`http-redirect.ts`(의존성 0의 leaf)를 통해 `modules/integrations/*-tester.ts` 와 `nodes/integration/*.handler.ts` 가 같은 로직을 공유하면서도, import 그래프를 직접 추적한 결과 순환이 생기지 않는다 — 두 소비자 모두 leaf 를 향해 내려갈 뿐 leaf 는 아무것도 위로 참조하지 않는다. `clamp-message.ts` 추출도 같은 이유(테스터가 `integrations.service.ts` 를 다시 import 하면 순환)로 정당하다.
- **동시성 정책의 단일 진실 원천화**: `CONNECTION_TEST_MAX_CONCURRENCY`(=2)와 `pLimit` 래핑을 `IntegrationsService` 한 곳에 두고 모든 transport/entity tester 가 그 정책을 상속받는다 — 개별 테스터(`testDatabaseConnection`/`testHttpConnection`)는 동시성에 대해 아무것도 모른 채 순수 함수로 남아 있어 관심사 분리가 깔끔하다.
- **행위 패리티 보장 설계**: 노드 실행(`http-request.handler.ts`/`database-query.handler.ts`)과 연결 테스트가 같은 자격증명 해석·SSL 매핑·리다이렉트 로직을 공유하도록 명시적으로 설계돼, "테스트 통과 ≠ 실행 성공" 이라는 흔한 통합 테스트 함정을 구조적으로 차단한다.
- **레이어 책임 분리**: 컨트롤러(`integrations.controller.ts`)는 이번 PR 에서 Swagger 문서 문자열만 바뀌었고 로직 변경이 없다 — 프레젠테이션 계층이 여전히 얇다. 신규 테스터 두 개(`database-connection-tester.ts`, `http-connection-tester.ts`)는 NestJS DI 밖의 순수 async 함수로 작성돼 테스트 용이성과 계층 경계가 유지된다(다만 MCP/Email 테스터는 여전히 클래스 private 메서드라 스타일이 갈린다 — 기능 문제는 아님).

## 요약

이번 변경은 Database·HTTP 통합의 "구조 검증만 하고 성공 처리"하던 구멍을 실접속 검증으로 메우면서, 순환 의존 회피(leaf 모듈 추출)·전략 패턴 기반 확장점·동시성 정책 단일화라는 기존 아키텍처 골격을 정확히 지키는 방식으로 구현됐다 — 의도적인 설계 트레이드오프(테스터 재사용 위치, 동시성 공유)가 코드 주석에 근거와 함께 잘 남아 있다. 실질적으로 남는 리스크는 `registerEntityTester` 확장점의 "재진입 금지" 계약이 런타임으로 강제되지 않아 향후 확장 시 조용한 교착을 만들 수 있다는 점(WARNING) 하나이며, 나머지는 기존부터 있던 경미한 네이밍·DTO 중복 관찰(INFO)이다. CRITICAL 급 SOLID/결합도/순환 의존 위반은 발견되지 않았다.

## 위험도

LOW
