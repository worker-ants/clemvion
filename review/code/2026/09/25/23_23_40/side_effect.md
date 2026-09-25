# 부작용(Side Effect) 리뷰 — integration-personal-owner

대상: `codebase/backend/src/modules/integrations/**`, `codebase/backend/src/modules/workflow-assistant/**` (base: `origin/main` 5ef43c29c).
검증: 프롬프트에 실린 diff 를 실제 파일(`Read`)·실제 diff(`git diff origin/main...HEAD -- <path>`)와 대조해 완전성을 확인했고, 저장소에는 어떤 파일도 쓰거나 되돌리지 않았다(`git status --short` 로 무변경 확인).

## 발견사항

- **[WARNING]** 403 거부 응답의 `code` 가 `FORBIDDEN` → `ADMIN_REQUIRED` 로 바뀐다 (API 계약 변경)
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:651-665`(`assertCanModify`/`throwAdminRequired`), 호출부 `:740`(`create`), `:1259`·`:1300`(`rotate`), `:1357`(`requestScopes`), `:1428`(`updateScope`)
  - 상세: `origin/main` 에서는 이 네 지점 모두 `throw new ForbiddenException({ code: 'FORBIDDEN', ... })` 였다(`git show origin/main:.../integrations.service.ts` 로 4곳 확인: 634/1106/1251/1327줄). 이번 변경은 공용 `ROLE_REQUIRED.admin`(`code: 'ADMIN_REQUIRED'`)을 스프레드하는 `throwAdminRequired`/`assertCanModify` 로 통일했다. 결과적으로 Organization 통합 생성·자격 증명 교체·scope 추가·scope 변경에서 Admin 미달일 때 클라이언트가 받는 `error.code` 값이 조용히 바뀐다. `error.code === 'FORBIDDEN'` 으로 분기하던 외부 API 소비자(사내 프런트 외의 서드파티 통합 등)가 있다면 그 분기가 깨진다.
  - 비고: `CHANGELOG.md` 39번째 줄 근처에 "이 모듈의 Admin 거부 코드가 `FORBIDDEN` 에서 `ADMIN_REQUIRED` 로 바뀐다" 라고 이미 명시적으로 기록돼 있어 **의도되고 문서화된** 변경이다. 다만 SUMMARY 집계 시 "인터페이스 변경" 관점에서 다시 놓치지 않도록 재확인 차 기록한다.
  - 제안: 이미 CHANGELOG 에 있으므로 추가 조치 불필요. 외부(사내 프런트 밖) API 문서·SDK 가 있다면 그쪽에도 동일 공지가 갔는지만 확인.

- **[INFO]** `update`/`remove`/`reauthorize` 컨트롤러 핸들러가 대상 행의 scope 를 알기도 전에 무조건 `roleOf()`(워크스페이스 멤버 role 조회 쿼리)를 먼저 호출한다
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts:489`(update), `:573`(reauthorize), `:662`(remove) — 각각 `const role = await this.roleOf(workspaceId, user);`
  - 상세: `roleOf` → `IntegrationsService.resolveRole` → `WorkspacesService.getMemberRole`(DB 조회, `integrations.service.ts:1873-1878`). `assertCanModify` 는 대상 행이 `scope === 'organization'` 일 때만 이 role 값을 실제로 쓴다(`integrations.service.ts:656`). 그런데 role 조회 자체는 대상 행이 personal 이든 organization 이든 **항상** 먼저 실행된다. `origin/main` 에서는 `update`·`remove`·`reauthorize` 세 핸들러에 role 조회가 전혀 없었다(`create`/`rotate`/`requestScopes`/`updateScope` 만 있었음) — 이번 PR 로 이 세 경로에 매 요청마다 DB 왕복 하나가 상시로 추가된다.
  - 제안: 기능적으로는 문제 없으나(정합성 버그 아님), 트래픽이 큰 워크스페이스에서 personal 통합 rename/삭제/재인증이 잦다면 불필요한 role 조회 비용이 누적된다. 서비스 계층에서 `requireVisible` 로 행을 먼저 읽고 `row.scope === 'organization'` 일 때만 지연 조회하도록 재구성하면 제거 가능 — 다만 컨트롤러가 role 을 미리 넘기는 현재 구조(라우트 가드와 대칭)를 깨야 하므로 이번 PR 범위의 필수 수정은 아니다.

- **[INFO]** 서비스 계층 다수 메서드 시그니처에 `userId`/`userRole` 매개변수 추가 (하위 호환 아님)
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` — `findAll`(:506-509), `findById`(:617-621), `update`(:833-838, `userRole` 추가), `remove`(:872-877, `userRole` 추가), `getUsages`(:942-945), `getActivity`(:1028-1031), `testConnection`(:1097-1100), `reauthorize`(:1459-1463, `userRole` 추가)
  - 상세: 전부 새 매개변수가 **필수**(optional 아님)로 삽입됐다. 저장소 전수 grep(`grep -rn "integrationsService\.(findById|findAll|getActivity|testConnection|getUsages|update|remove|rotate|requestScopes|updateScope|reauthorize)\("`)으로 확인한 결과 `integrations.controller.ts` 외 호출자는 없고, 그 컨트롤러는 이 diff 안에서 전부 동반 갱신됐다(파일 9 diff 확인). `IntegrationOAuthService.precheckCafe24Mall`/`precheckMakeshopShop` 도 `userId` 셋째 인자가 추가됐고 호출자는 컨트롤러 하나뿐임을 확인.
  - 제안: TS 컴파일이 누락된 호출자를 즉시 잡아주므로 실질 위험은 낮음. `as never`/`as any` 로 타입을 우회하는 테스트 더블(예: `integrations.controller.owner.spec.ts` 의 mock 객체 `{ begin, precheckCafe24Mall, precheckMakeshopShop } as never`)이 있으니, 프로덕션 코드 밖에서 유사하게 캐스팅해 호출하는 곳이 새로 생기면 이 안전망을 우회할 수 있다는 점만 유의.

- **[INFO]** `IntegrationOAuthService` 생성자에 새 optional 의존성 `workspacesService?: WorkspacesService` 주입
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts:392`
  - 상세: `IntegrationsModule` 이 이미 `WorkspacesModule`(`@Global()`, `WorkspacesService` export)을 import 하고 있어(`integrations.module.ts:11,47`) 프로덕션 DI 그래프는 정상 해결된다 — 순환 의존 없음(`WorkspacesModule` 은 `IntegrationsModule` 을 import 하지 않는다). `new IntegrationOAuthService(...)` 로 수동 생성하는 곳은 3개 spec 파일뿐이며 이번 diff 에서 필요한 곳(권한 재판정 테스트)은 `getMemberRole` mock 을 함께 넘기도록 갱신됐다. `@Optional()` 이라 주입 실패 시에도 예외 없이 `undefined` 가 되고, 이 경우 `assertRequesterStillAllowed` 는 fail-closed(Organization 통합 재판정 거부)로 동작하도록 설계돼 있어 조용한 인가 우회로는 이어지지 않는다.

- **[INFO]** `update()` 의 영속화 조건이 바뀌어, "이름 미변경" 요청에서 더 이상 DB 쓰기가 발생하지 않는다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:846` (`if (body.name === undefined || body.name === entity.name) return this.toPublic(entity);`)
  - 상세: `origin/main` 에서는 `body.name` 이 없거나 동일해도 `changes` 가 빈 객체인 채로 `repo.save(entity)` 가 항상 호출됐다(감사 로그만 스킵). TypeORM 의 `save()` 는 저장된 엔티티에 대해 전체 UPDATE 문을 내며 `@UpdateDateColumn` 이 있는 엔티티라면 실질 값 변화가 없어도 `updated_at` 이 갱신되는 경우가 일반적이다. 새 코드는 이 경로에서 아예 쓰기를 건너뛰므로, `PATCH /integrations/:id` 를 이름 변경 없이 호출했을 때 `updated_at` 이 더는 갱신되지 않을 수 있다. 기능적으로는 불필요한 쓰기를 없앤 개선으로 보이나, `updated_at` 을 신선도 지표로 관찰하는 다른 소비자(캐시 무효화, 동기화 잡 등)가 있다면 동작 차이가 생긴다 — 이 저장소 안에서 그런 소비자는 찾지 못했다.

- **[INFO]** `handleCallback` 이 커밋 직전(락 안)에 `assertRequesterStillAllowed` 를 새로 호출해, 이전엔 항상 성공하던 콜백이 이제 실패할 수 있다
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts:821`
  - 상세: begin 과 callback 사이(state TTL 동안)에 요청자의 역할이 강등되거나 대상 통합이 남의 personal 로 바뀐 경우, 이 새 판정이 `NotFoundException`/`ForbiddenException` 을 던지고 `integrationRepo.save()` 를 호출하지 않는다(`integration-oauth.service.spec.ts` 신규 테스트로 `save` 미호출 확인됨). 의도된 보안 수정이며 회귀 테스트로 커버되지만, "콜백은 항상 커밋한다" 는 이전 전제에 기대는 외부 관찰자(예: 이 흐름의 완료를 별도로 폴링/webhook 하는 코드)가 있다면 새로운 실패 분기를 처리해야 한다는 점을 기록한다. 저장소 내 grep 으로는 그런 별도 관찰자를 찾지 못했다.

- **[INFO]** 워크플로우 어시스턴트의 통합 후보/목록 조회가 요청자 가시성으로 필터링되도록 변경 — 같은 세션이라도 사용자별로 LLM 이 보는 후보가 달라진다
  - 위치: `codebase/backend/src/modules/workflow-assistant/tools/candidate-lookup.service.ts`(`lookupIntegrations`/`lookupMcpServers` 에 `userId` 추가, `IntegrationsService.findAll` 호출에 그대로 전달), `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts:186-198`(`listIntegrations` 에 `integrationVisibilityClause` 추가)
  - 상세: `workflow-assistant-stream.service.ts` 의 기존 `userId` 변수를 그대로 스레딩(신규 변수 아님, 섀도잉 없음 확인)해 `AssistantFinishGuard.checkFinish`·`AssistantToolRouter.dispatchExplore`·`ExploreDispatchContext` 까지 일관되게 전파됨을 확인했다. 남의 personal 통합이 도구 결과에서 조용히 빠지는 것은 에러가 아니라 목록 축소이므로, 이 assistant 가 이전엔 보이던 통합을 이제 "없다"고 판단해 다른 노드 설정을 제안할 수 있다 — spec 의도된 변경.

## 요약

핵심 side effect 는 두 갈래다. (1) 문서화된 것: Organization 통합 관련 4개 엔드포인트의 403 `error.code` 가 `FORBIDDEN → ADMIN_REQUIRED` 로 바뀌는 API 계약 변경이며, 이는 `CHANGELOG.md` 에 이미 명시돼 있어 의도된 변경으로 확인된다. (2) 문서화되지 않았지만 위험이 낮은 것들: 다수 서비스 메서드 시그니처에 `userId`/`userRole` 필수 매개변수가 추가됐으나 저장소 전수 grep 으로 누락된 호출자가 없음을 확인했고, `IntegrationOAuthService` 의 신규 optional DI(`WorkspacesService`)는 이미 `@Global` 모듈이 export 하므로 순환 의존이나 미해결 주입 문제가 없다. `update`/`remove`/`reauthorize` 세 경로에 매 요청 무조건 role 조회가 새로 붙어 personal 통합 대상 요청에도 여분의 DB 왕복이 상시 발생하는 점, `update()` 의 no-op 쓰기가 사라져 `updated_at` 갱신 시점이 달라지는 점, 콜백 커밋 직전 재판정으로 이전엔 항상 성공하던 흐름이 실패할 수 있게 된 점은 전부 이 PR 의 의도(§8 판정 재정합)에 부합하는 설계이고 테스트로 뒷받침되지만, 다음 사람이 "왜 갑자기 쿼리가 하나 늘었나/왜 업데이트가 실패하나" 를 조사할 때 참고하도록 side effect 로 기록해 둔다. 저장소를 뮤테이션하는 검증은 하지 않았다(diff/파일 읽기만 수행, `git status --short` 무변경 확인).

## 위험도

LOW
