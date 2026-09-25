# 동시성(Concurrency) 리뷰

## 발견사항

- **[CRITICAL]** `rotate()` 의 락-내부 재판정이 **행(scope)은 새로 읽지만 요청자 역할(role)은 요청 시작 시점의 stale 값을 그대로 재사용** — 연결 테스트(수 초) 동안 요청자가 강등돼도 통과한다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` — `rotate()` (파라미터 `userRole: string | null` 선언 1231행, 외부 연결 테스트 호출 1246행 `const test = await this.dispatchTest(...)`, 트랜잭션 내 재조회 1274행 `const fresh = await repo.findOne({ ..., lock: { mode: 'pessimistic_write' } })`, 재판정 1283행 `this.assertCanModify(fresh, userRole, 'rotate')`).
  - 상세: `rotate()`는 (1) 요청 시작 시점에 `assertCanModify(entity, userRole, 'rotate')`로 1차 판정 → (2) 실제 외부 접속 테스트(`dispatchTest`, 코드 주석 자체가 "실제 접속이라 수 초 걸린다"고 명시) → (3) 트랜잭션 안에서 `pessimistic_write`로 행을 다시 읽어 `isIntegrationVisibleTo(fresh, userId)` + `assertCanModify(fresh, userRole, 'rotate')`로 2차 판정을 한다. 그런데 2차 판정에 넘기는 `userRole`은 컨트롤러가 요청 최초 진입 시 `roleOf()`(=`resolveRole` → `workspacesService.getMemberRole`)로 **한 번만** 구한 값이고, `rotate()` 내부 어디에서도 다시 조회하지 않는다. `assertOrgScopeModifiable(scope, role)`은 scope·role 두 값 모두로 판정하는데, 2차 판정은 scope만 fresh이고 role은 요청 시작 시점 스냅샷이다.
    같은 파일의 주석(1258~1271행 부근)과 `plan/complete/rotate-lost-update.md` §D("함께 보는 것 — 락 안에서 권한도 다시 본다")는 "테스트가 도는 동안 scope 가 personal → organization 으로 바뀌면 비-admin 의 교체가 통과한다"는 **한 방향**(통합 쪽 상태 변화)만 명시적으로 다루고 고쳤다(대응 테스트: `integrations.service.spec.ts:1481` "락 안에서 권한을 다시 본다 — 테스트 동안 organization 으로 바뀌었으면 비-admin 은 거부"). 하지만 **반대 방향**(요청자 자신의 role 이 시험 도중 강등되는 경우, scope 는 organization 그대로)은 다루지 않았고, 이를 검증하는 테스트도 없다.
    같은 모듈의 자매 코드인 `integration-oauth.service.ts`의 재인증 콜백(`assertRequesterStillAllowed`, 405~425행)은 정확히 같은 문제를 커밋 직전에 `workspacesService.getMemberRole(record.workspaceId, record.userId)`(414~419행)로 **role 자체도 fresh 재조회**해 막는다 — `rotate()`만 이 처방이 빠져 있어 두 경로가 비대칭이다.
    실질 시나리오: Admin A가 organization-scope 통합의 credential rotate를 시작 → `dispatchTest` 실행 중(수 초) 다른 Owner/Admin이 A를 member로 강등 → `dispatchTest` 완료 후 트랜잭션에서 `fresh.scope`는 여전히 `organization`이라 `isIntegrationVisibleTo`는 통과(조직 통합은 전원에게 보임), `assertCanModify(fresh, 'admin' /* stale */, 'rotate')`도 통과 → 이미 권한을 잃은 A가 조직 통합의 자격 증명을 교체(rotate)해 커밋된다. 접근 제어가 경쟁 조건(TOCTOU)으로 우회되는 사례다.
  - 제안: `rotate()`의 트랜잭션 내부 재판정 직전에 `workspacesService.getMemberRole(workspaceId, userId)`(또는 동등한 fresh 조회)로 role을 다시 읽어 `assertCanModify(fresh, freshRole, 'rotate')`에 넘긴다. `integration-oauth.service.ts`의 `assertRequesterStillAllowed` 패턴을 그대로 재사용하거나 공유 헬퍼로 뽑아 두 경로가 같은 처방을 쓰도록 하는 편이 drift를 막는다. 강등 시나리오를 명시적으로 재현하는 단위 테스트(현재 `integrations.service.spec.ts:1481`의 거울상 — role 변경·scope 불변)도 추가해야 뮤테이션이 이 회귀를 잡는다.

- **[INFO]** OAuth 콜백 트랜잭션이 `pessimistic_write` 행 락을 잡은 채로 **다른 커넥션 풀 자원을 쓰는 추가 쿼리**(`workspacesService.getMemberRole`)를 기다린다 — 락 보유 시간 연장 + 커넥션 풀 이중 점유
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts` — `assertRequesterStillAllowed()` 정의(405~425행, 특히 `getMemberRole` 호출 414~419행), 호출부(816행, `dataSource.transaction` 안 `pessimistic_write` 락(807행) 획득 직후).
  - 상세: `assertRequesterStillAllowed`는 `record.userId`의 `Member` 조회를 `this.workspacesService.getMemberRole(...)`로 수행하는데, 이 호출은 트랜잭션의 `manager`가 아니라 기본 주입 리포지토리(별도 커넥션 풀 획득)를 쓴다. 즉 이미 `Integration` 행에 `pessimistic_write` 락을 걸어 커넥션 하나를 점유한 상태에서, 그 트랜잭션이 끝나기 전에 풀에서 **두 번째 커넥션**을 추가로 대기·점유한다. `app.module.ts`의 pg pool 기본값은 `max=10`(운영 env로 조정 가능, `database.poolMax`)이라, organization-scope 재인증 콜백이 동시에 몰리는 특수 상황에서는 "각 트랜잭션이 커넥션 1개를 쥔 채 2번째 커넥션을 서로 기다리는" 풀 기아(pool starvation) 위험이 이론상 존재한다. `connectionTimeoutMillis` 설정 덕분에 무한 대기는 아니고 타임아웃 오류로 끝나지만, 그 시점엔 이미 사용자에게 실패가 노출된다. 또한 이 추가 왕복만큼 `pessimistic_write` 락의 보유 시간이 늘어나 동시 재인증 콜백 간 대기 시간도 늘어난다.
  - 제안: 가능하면 `assertRequesterStillAllowed` 호출 시 `manager.getRepository(Member)` 등으로 **같은 트랜잭션 매니저**를 통해 조회해 추가 커넥션 점유를 피하거나, 최소한 이 경로의 동시성 볼륨이 pool 크기 대비 안전한지(운영 `pg_stat_activity` 관찰) 확인해 두는 것을 권장. CRITICAL은 아니며 현재 트래픽 규모에서는 실현 가능성이 낮지만, 풀 크기를 줄이거나 재인증 트래픽이 늘면 재검토가 필요하다.

## 검증 참고

- 저장소 파일은 읽기만 했고 뮤테이션·수정은 하지 않았다 (`git status --short` 로 별도 확인할 변경 없음 — 리뷰 중 어떤 파일도 쓰지 않음).
- 나머지 diff(`integration-response.dto.ts`, cafe24/makeshop precheck 관련 spec 3건, `integration-visibility.ts`/`.spec.ts`, `integrations.controller.ts`/`.owner.spec.ts`, `integrations.service.spec.ts`, `assistant-*`/`candidate-lookup`/`explore-tools`/`workflow-assistant-stream` 6건, e2e-spec, 프런트 mdx 문서 4건)는 순수 파라미터 전달(userId 스레딩)·판정 로직·문서 변경으로, 위 두 건 외에 경쟁 조건·데드락·비동기 오용은 발견되지 않았다. `update`/`remove`/`updateScope`는 판정과 조건부 쓰기(`judgedRow` + `affected===0` → 404) 사이에 유의미한 시간 간극(외부 I/O)이 없어 TOCTOU 위험이 낮다.

## 요약

이번 변경은 "personal vs organization 통합 가시성/권한" 기능 전반에 걸쳐 판정-후-사용(TOCTOU) 경쟁 조건을 상당히 의식적으로 처리했다 — `pessimistic_write` 행 락, 조건부 UPDATE/DELETE(`judgedRow` compare-and-set), OAuth 콜백 커밋 직전 fresh 권한 재조회(`assertRequesterStillAllowed`)가 모두 기존 CONC 이력(H-3)과 일관된 패턴으로 잘 구현되어 있다. 다만 그 처방이 **`rotate()` 한 곳에서는 절반만 적용**됐다 — 통합 행(scope)은 락 안에서 다시 읽지만 요청자의 역할(role)은 요청 시작 시점 스냅샷을 그대로 재사용해, 외부 연결 테스트가 도는 수 초 사이 요청자가 강등되면 이미 잃은 권한으로 조직 통합의 자격 증명을 교체할 수 있는 인가 우회 경쟁 조건이 남아 있다. 이 CRITICAL 항목의 수정(그리고 자매 경로와 동일한 fresh role 재조회로 통일)을 권고하며, 그 외 OAuth 콜백의 락-보유-중-추가 커넥션 사용은 낮은 위험의 INFO로 기록해 둔다.

## 위험도

CRITICAL
