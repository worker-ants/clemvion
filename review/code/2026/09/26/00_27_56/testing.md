# 테스트(Testing) 리뷰 — integration-personal-owner (4라운드)

## 발견사항

- **[WARNING]** `WorkspacesService.getMemberRole` 의 신규 `manager` 분기가 어떤 테스트에서도 실제로 실행되지 않는다 — 전부 mock 이 대신한다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:116`-`127`(`getMemberRole(workspaceId, userId, manager?)`, `repo = manager ? manager.getRepository(WorkspaceMember) : this.memberRepository`)
  - 상세: 이 분기는 3라운드 CRITICAL(rotate 락 안 재판정이 두 번째 풀 커넥션을 빌려 옛 role 을 읽던 결함, R13/R14)의 수정 대상이다. 그런데:
    1. `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` — 이번 changeset 에 포함되지 않았고(파일 목록 27개에 없음), 기존 `getMemberRole` 테스트(325~338행)는 2-인자 오버로드만 커버한다. `manager` 를 넘겼을 때 `manager.getRepository(WorkspaceMember)` 를 실제로 타는지 검증하는 테스트가 없다.
    2. `integration-oauth.service.spec.ts` 의 새 테스트(`getMemberRole` 를 `jest.fn()` 으로 완전히 대체)와 `integrations.service.spec.ts` 의 `rotate` 테스트(`workspacesService = { getMemberRole: jest.fn() }`)는 **호출부**가 `manager` 형태의 3번째 인자를 넘기는지만 검증한다(`expect.objectContaining({ getRepository: expect.any(Function) })`). `WorkspacesService` 자체가 mock 이라 콜리(callee) 쪽 분기 로직은 전혀 실행되지 않는다.
    3. e2e(`integration-personal-owner.e2e-spec.ts`)와 기존 `integration-rotate-concurrency.e2e-spec.ts` / `integration-credentials.e2e-spec.ts` 어디에도 `POST /api/integrations/:id/rotate` 를 Organization 스코프 통합에 대해 호출하는 케이스가 없다(신규 e2e 의 `it.each` 목록에 `rotate` 가 빠져 있다) — `getMemberRole(ws, user, manager)` 가 실제 DB·실제 트랜잭션 매니저로 실행되는 유일한 두 지점(`rotate` 락 안 재읽기, OAuth 콜백 커밋 직전 재판정)이 자동화 테스트 스위트 전체에서 한 번도 real-object 로 실행되지 않는다.
  - 제안: `workspaces.service.spec.ts` 에 `manager` 를 넘겼을 때 `manager.getRepository` 가 호출되고 그 리포지토리로 조회하는지(그리고 `manager` 없을 때는 `this.memberRepository` 를 쓰는지) 확인하는 테스트를 추가하거나, 최소한 `integration-rotate-concurrency.e2e-spec.ts` 에 Organization 스코프 + 역할 강등 시나리오를 하나 추가해 실제 트랜잭션 매니저 경로를 e2e 로 통과시킨다.

- **[INFO]** e2e `integration-personal-owner.e2e-spec.ts` 는 `it.each` 목록에서 `POST /:id/rotate` 를 빼놓았다
  - 위치: `codebase/backend/test/integration-personal-owner.e2e-spec.ts` — "남의 personal 은 Owner 에게도 없는 통합과 같은 404" `it.each` 블록(`GET /:id` ~ `DELETE /:id`)
  - 상세: 이 PR 의 3라운드 CRITICAL 이 바로 `rotate` 경로(락 안 재판정)였는데, e2e 전수 목록(GET/:id, GET/:id/usages, GET/:id/activity, POST/:id/test, PATCH/:id, POST/:id/reauthorize, PATCH/:id/scope, DELETE/:id)에는 rotate 가 없다. 위 WARNING 과 합쳐 보면, "락 안 역할 재조회"라는 이 PR 의 핵심 보안 수정 지점이 e2e 계층에서 전혀 확인되지 않는다(단위 테스트는 mock 으로 통과).
  - 제안: rotate 는 자격 증명 교체를 요구해 e2e 구성이 다른 경로보다 번거롭지만(`http`/`bearer_token` 등 비-OAuth 통합이면 가능), 최소 "Organization 통합의 rotate — Editor 는 403 ADMIN_REQUIRED, Admin 은 200" 한 케이스만 추가해도 실제 DB·실제 `WorkspacesService` 경로를 태울 수 있다.

- **[INFO]** e2e 마지막 테스트가 앞선 테스트들이 쓰는 픽스처(`personalId`)를 지운다 — `describe` 내 암묵적 실행 순서 의존
  - 위치: `codebase/backend/test/integration-personal-owner.e2e-spec.ts` — 파일 끝 `it('생성자는 자기 personal 을 읽고 · 이름을 바꾸고 · 지운다', ...)`
  - 상세: 주석("**반드시 마지막**")으로 의도를 명시했고 Jest 는 기본적으로 `it` 를 선언 순서대로 순차 실행하므로 현재는 깨지지 않지만, 이 파일의 앞쪽 케이스들(`byId` 전수 404 검증, 재인증 403 검증)이 같은 `personalId`/`orgId` 를 계속 참조하는 구조라 테스트 격리 관점에서는 실행 순서에 대한 숨은 의존이다. 다른 e2e 파일이 이 파일과 병렬 실행되거나(워커 분리), 훗날 이 안에 새 `it` 를 끼워 넣는 사람이 순서를 깨뜨리기 쉽다.
  - 제안: 현재 구조를 유지해도 무방하나(설정 비용이 큰 e2e 액터 셋업을 공유하는 합리적 트레이드오프), 삭제 테스트를 별도 `describe`/파일로 분리하거나 최소한 각 `it` 상단에 "이 테스트는 `personalId`/`orgId` 가 아직 살아있음을 전제로 한다" 주석을 일관되게 남기면 유지보수 시 순서 파괴를 줄일 수 있다.

## 테스트 우수 사례 (참고)

- 컨트롤러 `:id` 라우트를 리플렉션으로 전수 세는 완결성 캐너리(`integrations.controller.owner.spec.ts`)가 공허성 가드(`expect(idRoutes.length).toBeGreaterThan(0)`)까지 갖춰, 새 `:id` 라우트가 판정 없이 추가되는 회귀 클래스를 구조적으로 차단한다.
- 34개 뮤턴트(P1~P20, R1~R14)를 예측→실측으로 전부 추적했고, SURVIVED 3건(P13·P18·P19)은 테스트를 보강해 재실행까지 마쳤다 — mutation-testing 규율이 이례적으로 철저하다.
- `integration-visibility.ts` 를 순수 함수로 분리해 `integration-visibility.spec.ts` 에서 독립적으로(서비스 mock 없이) 검증한 것이 가독성·격리 양쪽에 좋다.
- e2e 의 "목록 자체는 비어 있지 않다 — 공허성 가드"(`expect(ids).toContain(orgId)`) 주석은 이 저장소가 겪었던 vacuous-assertion 패턴을 의식적으로 피한 사례다.
- cafe24/makeshop precheck 의 `it.each(['남의 personal', '본인 personal', '남이 만든 organization'])` 행렬은 "충돌은 알리되 식별자만 가린다"는 미묘한 규칙을 표로 명확히 표현해 가독성이 좋다.

## 요약

핵심 가시성·인가 로직(`integration-visibility.ts`, `IntegrationsService`, `IntegrationOAuthService`)은 유닛·통합·e2e 3계층에 걸쳐 매우 촘촘히 테스트돼 있고, 34개 뮤턴트 전수 추적과 컨트롤러 라우트 완결성 캐너리까지 갖춰 이 PR 이 다루는 표면 자체의 회귀 방어력은 높다. 다만 3라운드 CRITICAL 의 수정 지점이었던 "같은 트랜잭션 커넥션으로 role 재조회"(`WorkspacesService.getMemberRole` 의 `manager` 분기)는 모든 소비 스펙이 `WorkspacesService` 를 통째로 mock 해서 호출 인자 형태만 확인할 뿐 콜리 쪽 실제 동작을 검증하지 못하고, e2e 도 rotate 경로를 아예 건드리지 않아 이 특정 분기는 스위트 전체에서 실제 객체로 실행된 적이 없다. 이는 바로 그 코드가 다음에 조용히 깨져도(예: `manager` 무시하고 항상 `this.memberRepository` 사용) 어떤 테스트도 잡지 못한다는 뜻이라 WARNING 으로 남긴다. 나머지는 e2e 테스트 순서 의존 같은 경미한 격리 이슈뿐이다.

## 위험도

LOW
