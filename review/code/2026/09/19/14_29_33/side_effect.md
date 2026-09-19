# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 신규 프로세스 전역 동시성 제한이 기존 MCP·Email 커넥션 테스트에도 소급 적용된다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` — `connectionTestLimit` 필드 선언(약 405행), `transportTesters` 맵 구성(약 424~430행), `dispatchTest`(약 1541행) `return this.connectionTestLimit(() => tester(authType, credentials));`
  - 상세: `CONNECTION_TEST_MAX_CONCURRENCY = 2` 로 만든 `pLimit` 큐가 `database`·`http` 뿐 아니라 기존 `mcp`·`email` 테스터 호출까지 감싼다. `@Injectable()` 에 `scope` 지정이 없어 NestJS 기본(SINGLETON)이므로 프로세스 전체에서 공유되는 큐가 맞고(의도한 설계), DI 자체는 문제없음을 확인했다. 다만 이는 **기존 기능(mcp/email 연결 테스트)의 동작을 바꾸는 부작용**이다 — 이번 PR 의 표면적 목적(Database·HTTP 테스터 추가)과 무관하게, 이미 존재하던 두 서비스의 연결 테스트가 이제 다른 서비스의 연결 테스트 뒤에서 대기할 수 있다. 큐 길이 상한이 없다는 점은 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이미 후속 항목으로 등재돼 있어 알려진 리스크다.
  - 제안: 별도 조치 불필요(설계 의도 + 후속 트래킹 존재 확인). 다만 mcp/email 테스트에 대한 회귀 케이스가 기존 스위트에 있는지 — 이번 diff 의 동시성 unit 테스트(`integrations.service.spec.ts` `CONNECTION_TEST_MAX_CONCURRENCY` 케이스)가 4개 서비스 혼합 대기열도 검증하는지 재확인 권장.

- **[INFO]** `POST /integrations/preview-test` 가 이제 인증 안 된(워크스페이스 컨텍스트 없는) 사용자가 실제 외부 Database·HTTP 연결을 트리거하는 통로로 확장됨
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts` — `preview-test` 핸들러 docstring/`@ApiOperation.description` 변경분(147행 부근), 실질 트리거는 `integrations.service.ts` `dispatchTest` → `testDatabaseConnection`/`testHttpConnection`
  - 상세: 문서상으로도 "외부 네트워크 호출은 수행하지 않음" → "MCP·Email·Database·HTTP 는 실제로 접속"으로 명시적으로 바뀌었다. 이는 의도된 기능이지만 side-effect 관점에서는 이전에 무해했던 엔드포인트가 실제 outbound TCP 연결(DB 드라이버 연결, `fetch`)을 일으키는 엔드포인트로 바뀐 것이다. SSRF 가드로 사설/loopback 은 막히지만, 공인 host 로의 실제 연결 시도 자체는 막지 않는다. 이미 `/ai-review` 13_58_22 세션에서 security WARNING 으로 지적됐고 `spec-draft-nullable-notation-followups.md` 에 planner 결정 대기 항목("preview-test 가 인증된 사용자의 외부 연결 오라클")으로 등재돼 있다.
  - 제안: 이미 트래킹 중이므로 이번 리뷰에서 추가 조치 요구하지 않음. 재확인만.

- **[INFO]** `IntegrationsService.rotate()` 저장 방식이 전체 엔티티 `save` → 부분 컬럼 `save` + 로컬 `Object.assign` 뮤테이션으로 바뀜
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` `rotate()` 메서드 — `const changes = {...}; await this.integrationRepository.save({ id: entity.id, ...changes }); Object.assign(entity, changes);` (diff 상 1117~1125행 부근)
  - 상세: 함수 스코프 로컬 `entity` 객체에 대한 뮤테이션이라 공유 상태 오염은 없다. `Integration` 엔티티에 `EntitySubscriber`가 없음을 확인했으므로(`grep` 0건) partial-object `save()` 가 엔티티 인스턴스를 기대하는 subscriber/hook 을 건너뛰는 문제도 없다. 의도(동시 `logUsage` 원자적 update 컬럼 보호)와 실측(뮤턴트+e2e RED/GREEN, plan 문서에 기록)이 일치함을 확인했다. 다만 `toPublic(entity)` 가 돌려주는 응답에는 rotate 시작 시점에 조회한 `entity` 의 다른 컬럼(`lastUsedAt` 등)이 그대로 남는다 — 이는 이전 구현에서도 존재하던 staleness 이고 이번 변경이 새로 만든 것은 아니다.
  - 제안: 없음 — 정상적인 개선으로 판단.

- **[INFO]** HTTP 리다이렉트 추종 리팩터가 각 홉 사이에 `response.body?.cancel()` 호출을 새로 추가함
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-redirect.ts` `followRedirectsSafely()` (37행), 및 `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` 의 리다이렉트 루프를 대체한 자리
  - 상세: 기존 `http-request.handler.ts` 인라인 루프는 중간 리다이렉트 응답의 body 를 명시적으로 취소하지 않았다. 새 공유 함수는 다음 홉으로 넘어가기 전에 `await response.body?.cancel().catch(() => {})` 를 호출한다. 스트림 누수를 막는 방향의 부수효과 추가로, 리다이렉트 응답 body 는 원래도 읽지 않았으므로 관측 가능한 회귀는 없다.
  - 제안: 없음 — 개선으로 판단.

- **[INFO]** 공유 모듈 추출(`database-connection.ts`, `http-credentials.ts`, `http-redirect.ts`)의 시그니처·재-export 정합성 확인
  - 위치: `codebase/backend/src/nodes/integration/database-query/database-connection.ts`(신규), `database-query.handler.ts`(이동), `http-request/http-credentials.ts`(신규), `http-request.handler.ts`(이동)
  - 상세: `buildPgConnection`·`buildMysqlSsl`·`DbCredentials`·`resolveHttpCredentials` 를 각각 새 파일로 옮기고 원본 파일에서 재import 하는 구조다. `grep` 으로 `database-query.handler.ts` 를 외부에서 직접 import 해 위 심볼을 쓰는 다른 소비자가 없음을 확인했고(`database-query.component.ts` 하나만 `DatabaseQueryHandler` 클래스 import), `http-request.handler.ts` 의 리팩터 후 SSRF 차단 문구(`SSRF_BLOCKED_CLIENT_MESSAGE`)와 리다이렉트 홉 상한(5) 값이 원본과 동일함을 `git diff` 로 대조했다. 시그니처·동작 불일치 없음.
  - 제안: 없음 — 안전한 리팩터.

- **[INFO]** 신규 유닛 테스트의 전역 mock 정리 확인
  - 위치: `codebase/backend/src/modules/integrations/http-connection-tester.spec.ts` — `beforeEach`(43행)에서 `jest.spyOn(globalThis, 'fetch')`, `afterEach`(49행)에서 `fetchMock.mockRestore()`
  - 상세: `global.fetch`/`assertSafeOutboundHostResolved` 등은 모두 mock 되어 있고, 매 테스트 뒤 restore 되어 다른 스펙 파일로의 오염(부작용)이 없음을 확인했다. `database-connection-tester.spec.ts` 도 `pg`/`mysql2` 모듈 전체를 `jest.mock` 처리해 실제 네트워크·DB 연결이 유닛 테스트에서 일어나지 않는다.
  - 제안: 없음 — 정상.

## 요약

이번 변경은 Database·HTTP 통합에 실제 연결 테스터를 추가하고, 그 과정에서 노드 실행과 커넥션 매핑/SSRF/리다이렉트 로직을 공유 모듈로 추출했으며, `IntegrationsService.rotate()` 의 저장 방식과 프로세스 전역 동시성 제한(`pLimit(2)`)을 새로 도입했다. 리팩터로 이동된 함수들의 시그니처·문구·상수값은 원본과 동일함을 직접 대조해 확인했고, `rotate()` 의 부분 저장 전환은 로컬 스코프 뮤테이션이며 subscriber 부재를 확인해 안전하다. 신규 테스터는 실제 DB 연결·outbound HTTP 요청이라는 **의도된** 네트워크 부작용을 도입하지만 SSRF 가드로 사설 대상은 차단되며, 유닛 테스트에서는 전부 mock 처리돼 있어 테스트 자체의 부작용은 없다. 유일하게 주목할 만한 부작용은 신규 동시성 제한이 기존 MCP·Email 커넥션 테스트에도 소급 적용되는 점과, `preview-test` 엔드포인트가 이제 두 서비스 타입에 대해 실제 outbound 연결을 트리거하는 점인데, 둘 다 설계 의도이고 이미 plan 문서(`spec-draft-nullable-notation-followups.md`)에 후속 추적 항목으로 등재돼 있어 이번 리뷰에서 추가 차단 사유가 되지는 않는다.

## 위험도

LOW
