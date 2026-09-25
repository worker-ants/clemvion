# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** OAuth 콜백 커밋 트랜잭션 — row lock 보유 중에 트랜잭션 밖 커넥션으로 추가 DB 조회를 수행
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts:415`(`getMemberRole` 호출부, `assertRequesterStillAllowed` 내부) 및 호출 지점 `codebase/backend/src/modules/integrations/integration-oauth.service.ts:816`(`await this.assertRequesterStillAllowed(integration, record);`)
  - 상세: `handleCallback` 은 `this.dataSource.transaction(async (manager) => { ... })` 블록 안에서 `repo.findOne({ ..., lock: { mode: 'pessimistic_write' } })` 로 `integration` 행에 `SELECT ... FOR UPDATE` 락을 잡는다(기존 코드, CONC H-3). 이번 변경이 그 락을 잡은 **직후**에 새로 추가한 `await this.assertRequesterStillAllowed(integration, record)` 를 끼워 넣었고, 이 함수는 `integration.scope === 'organization'` 인 경우 `this.workspacesService.getMemberRole(record.workspaceId, record.userId)` 를 호출한다. `WorkspacesService.getMemberRole` 은 `WorkspacesService` 에 주입된 **자신의** `memberRepository` 를 쓰며, 이는 `dataSource.transaction()` 콜백이 받은 `manager` 와 바인딩되어 있지 않다 — 즉 커넥션 풀에서 **별도 커넥션을 새로 획득**해 조회한다. 결과적으로 이 요청은 (a) 트랜잭션용 커넥션 1개를 락 보유 상태로 쥐고, (b) 그 안에서 role 조회용 커넥션을 1개 더 요청하는 패턴이 됐다. Organization 통합에 대한 동시 reauthorize/request-scopes 콜백이 많아 커넥션 풀이 거의 소진된 상황이면, "트랜잭션이 두 번째 커넥션을 못 구해 대기 ↔ 다른 요청도 같은 이유로 대기" 형태의 풀 기아(pool starvation)가 이론적으로 가능하고, 최소한 락 보유 구간(critical section)이 원격 조회 왕복만큼 늘어난다. 이 파일에서 `dataSource.transaction` 블록은 이 한 곳뿐이며, 트랜잭션 콜백 내부에서 트랜잭션 매니저가 아닌 다른 서비스의 리포지토리를 호출하는 패턴은 이번 diff로 새로 들어온 것이다(기존 코드는 락 이후 `repo.save(integration)` 한 번만 같은 매니저로 수행).
  - 제안: `getMemberRole` 조회를 같은 트랜잭션 스코프 안에서 수행하도록(`manager.getRepository(WorkspaceMember)` 로 조회하거나, `WorkspacesService` 에 `manager`/`queryRunner` 를 받는 오버로드를 추가) 바꾸면 커넥션 이중 점유를 없앨 수 있다. 최소한 role 조회를 락 밖(트랜잭션 시작 전)으로 옮길 수 없는지도 검토할 가치가 있다 — 다만 주석이 "락을 잡은 이 시점 값으로 인가를 다시 본다" 는 TOCTOU 방지 의도를 명시하고 있어 단순히 밖으로 빼면 그 의도가 깨진다는 점은 감안해야 한다.

- **[INFO]** 대규모 시그니처 변경(각 파일에서 `userId`/`role` 파라미터 신규 삽입) — 저장소 내부는 전부 갱신됨, 외부 확인 불가
  - 위치: `IntegrationsService.findAll/findById/getUsages/getActivity/testConnection/update/remove/requireModifiable`(`codebase/backend/src/modules/integrations/integrations.service.ts`), `IntegrationOAuthService.precheckCafe24Mall/precheckMakeshopShop`(`codebase/backend/src/modules/integrations/integration-oauth.service.ts:1978,2178`), `CandidateLookupService.fillCandidates/lookupIntegrations/lookupMcpServers`, `ExploreToolsService.listIntegrations`, `AssistantToolRouter.dispatchExplore`(`ExploreDispatchContext.userId` 필드 신설), `AssistantFinishGuard.evaluateReviewGuard`
  - 상세: 이 diff는 "요청자에게 보이는 것만 반환" 이라는 하나의 규칙을 위해 10개 이상의 public/internal 메서드 시그니처에 `userId`(일부는 `role` 도) 파라미터를 새로 끼워 넣었다. `grep` 으로 저장소 전체를 확인한 결과 이 메서드들의 모든 호출부(`integrations.controller.ts`, `assistant-tool-router.service.ts`, `workflow-assistant-stream.service.ts`, `assistant-finish-guard.service.ts`)는 이번 diff 안에서 함께 갱신되어 있고, diff 밖에 남은 미갱신 호출부는 발견되지 않았다. 다만 이 정도로 넓은 시그니처 변경은 diff에 포함되지 않은 외부 소비자(플러그인, 별도 스크립트 등)가 있다면 컴파일 타임에 드러나지 않을 수 있으니 참고용으로 남긴다 — 코드 자체는 일관적이다.

- **[INFO]** `update`/`updateScope`/`reauthorize`/`remove` 의 쓰기 방식이 `repository.save(entity)`(전체 엔티티 저장) 에서 `repository.update(judgedRow, columns)` + 별도 재조회로 전환됨
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts`(`update` — `requireModifiable`/`judgedRow`/`reloadOrNotFound` 도입부, `remove`, `updateScope`, `reauthorize`의 non-oauth-provider 분기)
  - 상세: TypeORM의 `UpdateQueryBuilder`(`repository.update()` 가 내부적으로 사용)는 `@UpdateDateColumn` 을 자동으로 채우도록 구현되어 있고(`node_modules/typeorm/.../UpdateQueryBuilder.js` 확인), `Integration` 엔티티에는 `@BeforeUpdate`/`@AfterUpdate` 리스너나 전역 `EventSubscriber` 가 없음을 확인했다 — 따라서 `save()` → `update()` 전환으로 인한 숨은 훅 손실은 없다. 다만 `update()` 의 새 경로는 `body.name === entity.name` 이면 **DB 쓰기 자체를 생략**한다(과거엔 무변경이어도 `save(entity)` 로 매번 UPDATE 를 실행했다) — 즉 이름이 그대로인 PATCH 요청에서는 이제 `updated_at` 이 갱신되지 않는다. 의도된 최적화로 보이나, `updated_at` 변경 여부에 의존하는 다른 코드(캐시 무효화, 동기화 로직 등)가 있다면 영향받을 수 있어 기록해 둔다. 저장소 내 검색으로는 그런 의존 코드를 찾지 못했다.

- 확인 후 문제 없음으로 판단한 항목(참고):
  - `IntegrationOAuthService` 생성자에 `@Optional() workspacesService?: WorkspacesService` 신규 주입 — `WorkspacesModule` 이 `@Global()` 이며 `IntegrationsModule` 이 이미 이를 import 하고 있어(순환 의존 없음) 런타임 DI는 정상 해결된다. 수동 생성(unit test) 시 미주입이면 `assertRequesterStillAllowed` 가 fail-closed(ADMIN_REQUIRED)로 동작하도록 별도 테스트가 커버한다.
  - 전역 변수 신설 없음 — `PRECHECK_IDENTITY_MASKED`, `INTEGRATION_USER_PARAM`, `ADMIN_ACTION_PHRASE`, `FORBIDDEN_*` 등은 모두 모듈 스코프의 불변 상수/함수이며 가변 전역 상태가 아니다.
  - 파일시스템·환경변수·외부 네트워크 호출 신규 도입 없음(`grep` 으로 `process.env`/`fs.`/`child_process` 등 확인, e2e 스펙의 `process.env.E2E_BASE_URL` 은 기존 e2e 스펙들과 동일한 기존 패턴).
  - `broadcastCredentialChange`(Redis pub/sub cache-invalidation) 호출 순서·조건은 이번 diff로 바뀌지 않았다(`remove()` 성공 후에만 발행, 기존과 동일).
  - `remove()`/`update()`/`updateScope()`/`reauthorize()` 의 조건부 `judgedRow`(scope 를 WHERE 절에 포함) 는 TOCTOU 방지를 위한 의도된 compare-and-set 이며, 동시성 하에서 실제로 지운 것과 다른 통합에 영향을 주지 않는다.

## 요약

핵심 기능(개인/조직 통합 가시성·권한 재판정)은 저장소 전체에 걸쳐 일관되게 배선되어 있고, 시그니처 변경의 모든 내부 호출부가 diff 안에서 함께 갱신된 것을 확인했다. 유일하게 실질적인 부작용 우려는 OAuth 콜백 커밋 트랜잭션(`pessimistic_write` 락 보유 구간) 안에서 트랜잭션 매니저와 무관한 별도 커넥션으로 `WorkspacesService.getMemberRole` 을 호출하게 된 점이다 — 기능적으로는 의도된 TOCTOU 방지(락을 잡은 시점 값으로 재판정)이지만, 락 보유 중 커넥션 풀에서 두 번째 커넥션을 추가로 점유하는 패턴은 고부하 시 풀 기아 위험을 만드는 잘 알려진 안티패턴이라 별도로 표시했다. 그 외 DB 쓰기 방식 전환(`save()` → 조건부 `update()`) 은 엔티티 리스너/구독자가 없어 훅 손실 없이 안전하며, 파일시스템·환경변수·외부 네트워크·전역 변수 측면에서는 새로운 부작용을 찾지 못했다.

## 위험도
MEDIUM
