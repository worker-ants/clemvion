# 아키텍처 리뷰 — Personal 통합 소유자 강제 (integration-personal-owner)

## 발견사항

- **[WARNING]** `resolveRole` + role 파라미터 threading 보일러플레이트가 컨트롤러 8곳에 반복 — 프레젠테이션 레이어에 크로스커팅 관심사가 누출
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts:227`(`oauthBegin`), `:462`(`update`), `:520`(`rotate`), `:552`(`reauthorize`), `:586`(`requestScopes`), `:619`(`updateScope`), `:650`(`remove`) — `:437`(`create`)는 기존 패턴
  - 상세: 이번 PR 은 기존에 `create`/`rotate`/`requestScopes`/`updateScope` 4곳에만 있던 "컨트롤러가 `IntegrationsService.resolveRole()` 을 호출해 역할을 얻고, 그 값을 서비스 메서드의 별도 인자로 넘긴다" 패턴을 `update`·`reauthorize`·`remove`·`oauthBegin`(조건부) 4곳에 새로 확장했다. 그 결과 지금은 8개 핸들러가 동일한 3~4줄(`resolveRole` 호출 → 결과를 서비스에 전달)을 그대로 반복한다. "요청자의 워크스페이스 역할을 알아낸다" 는 인가 로직의 일부인데, 컨트롤러(프레젠테이션 레이어)가 그 조회 책임을 떠안고 서비스에 값으로 전달하는 구조라, 새 mutating 엔드포인트를 추가할 때마다 이 보일러플레이트를 잊지 않고 복붙해야 한다.
  - 제안: `@CurrentUser()`/`@WorkspaceId()` 처럼 요청 컨텍스트에서 값을 뽑아주는 파라미터 데코레이터(`@CurrentRole()`)를 만들거나, `requireModifiable`/각 서비스 메서드가 멤버십 조회를 내부에서 직접 수행하도록 이관해 컨트롤러의 반복 조회를 제거.

- **[WARNING]** `oauth/begin` 의 `mode` 분기 인가 체크는 이 PR 이 도입한 라우트-완결성 캐너리의 보호망 밖에 있다
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts:226`(`if (mode !== 'new' && body.integrationId) { ... }`)
  - 상세: `:id` 경로 핸들러 전부는 `integrations.controller.owner.spec.ts` 의 리플렉션 전수 테스트(`Reflect.getMetadata(PATH_METADATA, ...)` 로 `:id` 를 포함하는 라우트를 모두 찾아 판정 표와 대조)가 "새 라우트가 표에 없으면 실패" 로 완결성을 구조적으로 보장한다. 반면 `POST /oauth/begin` 은 **하나의 고정 라우트** 안에서 `mode` 값에 따라 인가 필요 여부가 갈리는데, 이 분기의 완결성은 오직 수기로 작성한 개별 테스트(`integrations.controller.owner.spec.ts` 의 `describe('oauth/begin — …')`, `integration-personal-owner.e2e-spec.ts`)에만 의존한다. 향후 `OAuthBeginDto.mode` 에 새 값이 추가되면서 `integrationId` 를 소비하는데도 L226 의 `mode !== 'new'` 가드 갱신을 깜빡하면, 같은 라우트이므로 리플렉션 캐너리로는 절대 잡히지 않는다 — 이 PR 이 스스로 지적한 "판정이 핸들러별 호출이라 새 라우트가 판정 없이 들어올 수 있다" 는 위험이 라우트가 아니라 `mode` 분기 축에서 그대로 재현된다.
  - 제안: `integrationId` 를 소비하는 mode 집합을 `const MODES_REQUIRING_INTEGRATION_CHECK = ['reauthorize', 'request_scopes'] as const` 로 명시하고, `OAuthBeginDto.mode` 유니언을 소진하는 `switch`(default 에서 컴파일 타임 `never` 체크)로 바꾸면 새 mode 추가 시 가드 누락이 타입 에러로 드러난다.

- **[INFO]** `IntegrationsService` mutation 메서드의 위치 인자 목록이 계속 늘어난다 — Actor 값 객체 부재
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:801`(`update`), `:838`(`remove`), `:1213`(`rotate`), `:1426`(`reauthorize`), `updateScope`/`requestScopes` 인근
  - 상세: 이번 PR 이 `update`·`remove`·`reauthorize` 세 메서드에 `userRole` 을 추가로 얹으며 `(id, workspaceId, userId, userRole, body?)` 형태의 5-인자 시그니처가 늘었다. `plan/in-progress/integration-personal-owner-followup.md` 가 예고하는 "실행 시점 판정" 후속이 실현되면 또 다른 축(예: 실행 컨텍스트)이 이 목록에 얹힐 가능성이 있다. `userId`/`userRole` 타입이 달라(`string` vs `string | null`) 스왑은 타입 체커가 막아주지만, 호출부마다 인자 순서를 기억해야 하는 부담은 그대로다.
  - 제안: `{ userId, role }` 형태의 작은 Actor/RequestContext 값 객체로 묶어 시그니처 성장을 흡수하면 향후 축 추가에도 시그니처가 안정적으로 유지된다.

- **[INFO]** `getForExecution` 이 이번에 도입된 단일 가시성 체크포인트(`requireVisible`)를 우회하는, 문서화되고 추적된 예외로 남아 있다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:1543`(`getForExecution`) → `:1555`(`requireEntity`)
  - 상세: 사용자 대면 경로(`findById`/`getUsages`/`getActivity`/`testConnection`/`rotate`/`requestScopes`/`reauthorize`/`updateScope`) 전부가 이번 PR 로 `requireVisible`/`requireModifiable` 체크포인트로 일원화됐지만, 실행 엔진 전용 `getForExecution` 은 여전히 워크스페이스 스코프만 확인하는 구 경로(`requireEntity`)를 쓴다. 코드 JSDoc과 `plan/in-progress/integration-personal-owner-followup.md`(§실행 시점) 양쪽에 후속으로 명시돼 있어 의도된 잔여 경계이며 이번 diff 의 결함은 아니다. 다만 "가시성 판정은 한 곳을 거친다" 는 이번 PR 의 핵심 아키텍처 불변식이 모듈 경계 전체(실행 엔진 포함)를 아직 덮지 못했다는 사실은 표시해 둔다.

- **[INFO]** 통합 목록 조회 쿼리 구성이 두 서비스에 독립적으로 존재 — 공유되는 것은 가시성 절(clause)뿐
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:513`(`findAll`), `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts:169`(`listIntegrations`)
  - 상세: 두 서비스 모두 `Integration` 리포지토리에 직접 `createQueryBuilder('i')` 를 호출해 독립적인 쿼리를 구성한다(`ExploreToolsService` 가 여러 엔티티 리포지토리를 직접 주입받아 쓰는 것은 이 PR 이전부터의 기존 설계). 이번 PR 은 두 호출부 모두 공유 헬퍼 `integrationVisibilityClause`/`INTEGRATION_VIEWER_PARAM`(`integration-visibility.ts`)을 정확히 재사용해 가시성 **규칙 자체**의 중복은 피했다. 다만 "워크스페이스 통합 목록을 쿼리하는 방법" 이라는 더 넓은 로직은 여전히 두 곳에 따로 있어, 향후 가시성 규칙에 예외가 하나 더 필요해지면 두 호출부를 모두 손으로 찾아 갱신해야 한다.

## 긍정적으로 평가한 설계

- `integration-visibility.ts` 하나에 가시성 규칙을 boolean(`isIntegrationVisibleTo`)·SQL(`integrationVisibilityClause`) 두 표현으로 모으고, 양쪽을 각각 테스트(`integration-visibility.spec.ts`)로 고정한 것은 단일 진실 원천(SoT) 설계의 좋은 예다. 외부 의존성 없는 leaf 모듈이라 순환 의존 위험도 없다.
- `requireVisible`(보이는가 → 404) → `assertCanModify`/`requireModifiable`(바꿀 수 있는가 → 403) 로 이어지는 2단 체크포인트는 "가시성" 과 "인가" 두 관심사를 명확히 분리한 좋은 chokepoint 패턴이며, `assertCanModify(row, role, action)` 이 동작(action)을 매개변수로 받는 설계는 신규 mutation 종류 추가 시 분기 복제 없이 확장 가능한(OCP) 구조다.
- `pickPrecheckConflict` 추출로 cafe24/makeshop precheck 의 거의 동일하던 우선순위 판정 로직을 하나로 합친 것은 좋은 DRY 리팩터다.
- `integrations.controller.owner.spec.ts` 의 `:id` 라우트 리플렉션 전수 테스트는 "새 라우트가 판정 표에 없으면 실패" 라는 구조적 완결성 가드로, 향후 라우트 추가 시 판정 누락을 코드 레벨에서 방지하는 좋은 관행이다(다만 위 WARNING 처럼 `oauth/begin` 의 mode 분기는 이 보호망 밖에 있다).

## 요약

핵심 설계 — 가시성 규칙의 단일 소스(`integration-visibility.ts`)와 그것을 관통하는 `requireVisible`/`requireModifiable` 체크포인트, 그리고 라우트 완결성 캐너리 — 는 이 저장소의 기존 관행(chokepoint·fail-closed)에 부합하는 견고한 아키텍처다. 순환 의존이나 레이어 경계 위반, 심각한 SOLID 위반은 발견되지 않았다. 다만 (1) 컨트롤러의 `resolveRole` 보일러플레이트가 8곳으로 늘어난 것, (2) `oauth/begin` 의 mode 분기가 리플렉션 완결성 가드 밖에 있는 것, (3) 실행 엔진 경로가 여전히 구 체크포인트를 쓰는 것(추적됨), (4) 목록 쿼리 구성이 두 서비스에 나뉜 것은 향후 확장·유지보수 시 재발 가능한 마모 지점으로 표시해 둘 가치가 있다. 전부 즉시 차단 사유는 아니다.

## 위험도

LOW
