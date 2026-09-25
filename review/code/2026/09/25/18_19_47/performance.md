# 성능(Performance) 리뷰 — workspace-path-guard (5라운드)

## 발견사항

- **[INFO]** `RolesGuard` 경로 파라미터 루프의 순차 DB 조회 — 현재는 실질 영향 없음, 확장 시 주의
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts:156-163` (`for (const name of pathParamNames) { ... await this.assertMember(raw, userId, requiredRoles); }`)
  - 상세: 핸들러가 `@WorkspaceParam(...)`을 여러 개 소비하면 이 루프가 각 이름마다 `assertMember`(= `getMemberRole` DB 조회)를 **순차** `await`한다. `Promise.all` 로 병렬화하지 않았다. 다만 `workspaces.controller.ts` diff 전수를 보면 현재 모든 라우트가 `@WorkspaceParam('id')` 하나만 쓰므로(둘째 경로 파라미터인 `memberId`는 평범한 `@Param`), 지금 이 순간 실제 N+1 왕복은 발생하지 않는다.
  - 제안: 현재는 조치 불요. 다만 향후 한 핸들러가 워크스페이스 경로 파라미터를 2개 이상 받게 되면(예: 워크스페이스 간 이동 라우트) 이 루프가 그대로 요청당 DB 왕복 수를 늘리므로, 그때는 `Promise.all`로 바꾸는 것을 고려.

- **[INFO]** 가드 + 서비스 계층의 의도된 멤버십 이중/삼중 재조회 — 문서화된 트레이드오프이나 요청당 DB 비용 증가
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts` `assertMember` (경로 워크스페이스 라우트 매 요청 조회) + `codebase/backend/src/modules/workspaces/workspaces.service.ts` `assertMembership`/`assertAdmin`(예: 967-964 부근) + `transferOwnership`(722-756 부근, `getMemberRole` 사전 조회 → 트랜잭션 내 `pessimistic_write` 락 재조회)
  - 상세: 이번 PR로 `update`/`updateSettings`/`getSettings`/`remove`/`leave`/`transferOwnership`/`listMembers`/`addMember`/`updateMember`/`removeMember`/`listInvitations`/`createInvitation`/`resendInvitation`/`revokeInvitation` 등 15개 경로 워크스페이스 라우트 전부가 `RolesGuard`에서 `getMemberRole` 1회를 매 요청 무조건 수행하도록 바뀌었고, 서비스 계층은 "가드 인식이 깨졌을 때의 두 번째 선"이라는 명시적 이유로 `assertMembership`/`assertAdmin`을 통해 같은 조회를 **다시** 수행한다(코드 주석에 "요청당 멤버십 쿼리가 한 번 더 도는 것은 의도된 중복"이라고 명시). `transferOwnership`은 여기에 트랜잭션 내부의 락 재조회까지 더해져 한 요청에서 `getMemberRole`류 조회가 최대 3회(가드 1 + 서비스 사전조회 1 + 트랜잭션 락 조회 1) 발생한다.
  - 이 설계는 spec(`spec/data-flow/12-workspace.md` §Rationale)에서 "가드가 읽은 role 을 넘겨받으면 독립성을 잃는다"는 근거로 명시적으로 기각한 대안(가드→서비스 값 전달)의 결과이므로 재설계를 요구하지 않는다. 다만 관리자 작업(admin/owner 액션)뿐 아니라 `getSettings`·`listMembers`처럼 읽기 전용이면서 호출 빈도가 높을 수 있는 라우트에도 매 요청 DB 왕복이 추가됐다는 점은 트래픽이 늘면 체감될 수 있어 인지해 둘 필요가 있다.
  - 제안: 조치 불요(설계 의도). 다만 이 15개 라우트의 초당 호출량이 커지면 `getMemberRole` 결과를 요청 스코프(가드→서비스, 같은 HTTP 요청 내)로만 공유하는 좁은 캐시(예: `AsyncLocalStorage` 또는 request-scoped provider)를 검토할 여지는 있다 — 단, spec 이 이미 "값 전달은 독립성을 잃는다"고 기각했으므로 이는 spec 재검토가 선행돼야 하는 사안이다.

- **[INFO]** 동일 `ROUTE_ARGS_METADATA` 키에 대한 중복 `Reflect.getMetadata` 조회
  - 위치: `codebase/backend/src/common/decorators/workspace.decorator.ts` `handlerConsumesWorkspaceId`(62-81) / `workspaceParamNamesOf`(124-140) — 둘 다 `Reflect.getMetadata(ROUTE_ARGS_METADATA, controllerClass, methodName)` 를 독립적으로 호출
  - 상세: `RolesGuard.canActivate`에서 `@WorkspaceId()`·`@WorkspaceParam()`을 함께 소비하는 핸들러(예: 캐너리 테스트의 `both` 케이스)에 도달하면, 같은 요청 안에서 `workspaceParamNamesOf`가 한 번, 이어서 `consumesRequestContext()`(= `handlerConsumesWorkspaceId`)가 한 번 — 같은 컨트롤러·메서드에 대해 같은 메타데이터 키를 두 번 조회한다. `Reflect.getMetadata` 자체는 가벼운 연산(prototype chain 위의 단일 속성 조회)이라 측정 가능한 수준의 영향은 아니지만, 두 함수가 같은 원시 데이터를 각자 다시 읽고 다른 `factory`로 필터링하는 구조라 개념적으로 중복이다.
  - 제안: 조치 불요 수준(마이크로 최적화). 필요하면 두 판별을 하나의 `Reflect.getMetadata` 호출 결과를 공유해 `{ consumesRequestContext, pathParamNames }`를 함께 반환하는 헬퍼로 합칠 수 있으나, 가독성·독립적 반증 가능성(각 판별이 서로 다른 파일에서 별도로 반증됨) 대비 이득이 크지 않다.

- **[INFO]** 경로 워크스페이스 전환으로 읽기 전용 라우트에도 매 요청 DB 멤버십 조회가 신규 추가됨
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.controller.ts` `getSettings`(200-215 부근), `listMembers`(300-317 부근) — 둘 다 `@Roles()` 없이 `@WorkspaceParam('id')`만 사용
  - 상세: 종전에는 `@Param('id', ParseUUIDPipe)`라 `RolesGuard`가 이 값을 인식하지 못해(구 `handlerConsumesWorkspaceId`가 `@WorkspaceId()`만 인식) 가드 단계에서 멤버십을 조회하지 않고, 서비스 계층(`getWorkspaceSettings`/`listMembers`)의 자체 검사에만 의존했을 가능성이 높다. 이번 PR로 가드가 경로 값을 인식하면서 이 두 GET 라우트도 가드 단계에서 `getMemberRole` 조회가 추가되고, 서비스 계층 검사가 남아 있다면 위 항목과 마찬가지로 이중 조회가 된다. 보안 강화가 목적이므로 이 자체는 타당하지만, 목록/설정 조회처럼 폴링 빈도가 있을 수 있는 엔드포인트의 매 요청 DB 비용이 늘었다는 점은 캐패시티 계획에 반영할 가치가 있다.
  - 제안: 조치 불요(의도된 보안 강화). 트래픽이 실제로 문제가 되면 `getMemberRole` 조회 결과에 대한 짧은 TTL 캐시(역할 변경 시 무효화 필요)를 별도 작업으로 검토.

## 요약

이번 diff 의 핵심은 `RolesGuard`가 헤더/토큰 워크스페이스뿐 아니라 `@WorkspaceParam(...)`으로 받는 경로 워크스페이스도 매 요청 멤버십·역할을 판정하도록 확장한 것이다. 알고리즘적으로는 전부 O(1)~O(route 파라미터 수) 수준의 가벼운 연산(Reflect 메타데이터 조회, 4개 원소 역할 서열 비교)이라 복잡도 문제는 없다. 다만 보안 강화의 대가로 15개 워크스페이스 라우트에 "가드 1회 + 서비스 계층 1회(+ 필요 시 트랜잭션 락 재조회)"라는 의도된 DB 왕복 중복이 코드 전반에 도입됐고, 이는 spec 레벨에서 명시적으로 정당화된 트레이드오프다. 경로 파라미터 순회의 순차 `await`나 두 reflection 함수의 중복 메타데이터 조회는 이론적 최적화 여지이지만 현재 코드베이스의 실제 사용 패턴(핸들러당 워크스페이스 경로 파라미터 1개)에서는 관측 가능한 영향이 없다. Critical/Warning 급 성능 결함은 없으며, 전부 INFO 수준의 인지 사항이다.

## 위험도

LOW
