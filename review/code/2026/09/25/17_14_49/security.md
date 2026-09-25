# 보안(Security) 리뷰 — review/code/2026/09/25/17_14_49 (3라운드)

## 범위 요약

이번 changeset(`codebase/**` 27개 파일)의 핵심은 `RolesGuard` 가 **경로 파라미터로 받는 워크스페이스 ID**
(`@WorkspaceParam('id')`)도 헤더·토큰 컨텍스트와 동일하게 멤버십·역할 검증 대상으로 삼도록 확장한 것이다.
종전에는 `workspaces.controller.ts` 의 14개 라우트 + `AuthController.switchWorkspace` 1개가 평범한
`@Param('id', ParseUUIDPipe)` 로 워크스페이스 ID 를 받아, `RolesGuard` 가 이 값을 전혀 보지 않고
헤더·토큰의 워크스페이스만 검증했다 — 즉 `@Roles('owner')` 가 붙은 `transferOwnership` 조차 **경로의
대상 워크스페이스가 아니라 헤더/토큰의 워크스페이스**로 권한을 판정하는 구조적 결함이 있었다(서비스
계층의 2차 검증이 최종 방어선이었음). 이 PR 은 그 갭을 가드 레벨에서 구조적으로 닫는다.

핵심 로직(`RolesGuard.canActivate` / `assertMember`, `workspace.decorator.ts` 의
`WorkspaceParam`/`workspaceParamNamesOf`, `workspace-roles.ts` 의 서열 단일 진실)을 직접 추적하고,
`ParseUUIDPipe` 의 실제 NestJS 구현(`uuidRegExps.all`)을 `isUuidShaped` 의 정규식과 대조해 두 술어가
동일한 형태 판정을 한다는 것도 확인했다(가드가 "형식이 아니면 판정 없이 넘긴다"→파이프가 400을 낸다는
설계에 우회 가능성이 없음). 3라운드 changeset 이고, 1·2라운드가 이미 16건의 Warning(역할 서열 파편화,
거부 코드 통일, 데코레이터 판별 중복, 다중 `@WorkspaceParam` 순서 뮤턴트 등)을 처분했음을 RESOLUTION.md
로 확인했다 — 그 항목들은 재론하지 않는다.

## 발견사항

- **[WARNING]** 경로 워크스페이스 오용 방지의 유일한 회귀 방지망(`workspace-param-binding-guard.ts`)이 **이름 휴리스틱**에 의존한다 — 다른 이름의 워크스페이스 경로 파라미터는 CI·런타임 양쪽에서 조용히 새는 구조
  - 위치: `codebase/backend/src/repo-guards/__tests__/workspace-param-binding-guard.ts` 함수 `isWorkspaceIdName` (46번째 줄) — `return name === 'workspaceId' || name.endsWith('WorkspaceId');`
  - 상세: 런타임 인가(`RolesGuard.workspaceParamNamesOf`, `codebase/backend/src/common/decorators/workspace.decorator.ts` 124번째 줄)는 `@WorkspaceParam()` 데코레이터의 **factory identity** 로만 경로 워크스페이스를 인식한다 — 이름과 무관하다. 반면 이 인식이 깨지는 것(개발자가 실수로 `@WorkspaceParam` 대신 평범한 `@Param()` 을 다시 쓰는 것)을 잡는 **유일한 안전망**은 이 CI 정적 가드이고, 그 가드는 파라미터 식별자 또는 `@Param('<name>')` 문자열이 `workspaceId` 이거나 `*WorkspaceId` 로 끝나야만 위반으로 잡는다(파일 자체 docstring 이 "이름이 규칙 밖(`id` 등)이면 못 본다" 로 명시). 즉 미래에 누군가 워크스페이스 ID 를 담는 경로 파라미터를 예컨대 `@Param('resourceId') targetId: string` 처럼 관례 밖 이름으로 바인딩하면: (1) CI 가드는 위반으로 잡지 않고, (2) `RolesGuard.canActivate` 는 `workspaceParamNamesOf` 가 빈 배열을 돌려주므로 그 라우트를 "경로 워크스페이스 없음"으로 취급해, `@Roles()` 가 있으면 **헤더/토큰 워크스페이스**로(이 PR 이 막으려던 바로 그 cross-tenant 오판정), `@Roles()` 도 `@WorkspaceId()` 도 없으면 **아무 멤버십 검증도 없이 통과**시킨다(`roles.guard.ts` 174번째 줄 단축 통과). PR 자체 docstring(`roles.guard.ts` "라우트마다 사람이 데코레이터를 기억하는 opt-in 모델은 이미 최소 2회 누락됐다")이 지적한 것과 같은 실패 유형이 이름-의존 정적 가드로 다시 열려 있다.
  - 제안: 가능하면 이름 휴리스틱 대신 "`*.controller.ts` 의 모든 `@Param()` 데코레이터는 `id`/`Id` 로 끝나는 이름이거나 워크스페이스 관련 리소스 경로일 때 반드시 `@WorkspaceParam` 이거나 화이트리스트에 등재돼야 한다" 는 **fail-closed 허용목록** 방식(`param-uuid-pipe-guard.ts` 의 "허용목록 없이 술어로 가른다" 철학과는 반대 방향이 되지만, 이 가드는 인가 우회를 직접 막는 자리라 안전 방향이 다르다)으로 강화하거나, 최소한 이 한계를 `spec/data-flow/12-workspace.md` §Rationale 에 "새 워크스페이스 경로 파라미터를 추가할 때는 이름 규칙을 따르거나 리뷰에서 수동으로 `@WorkspaceParam` 사용을 확인해야 한다" 는 체크리스트 항목으로 명시해 리뷰 프로세스가 이 갭을 대신 메우게 한다.

- **[INFO]** `handlerConsumesWorkspaceId`/`workspaceParamNamesOf` 의 부분 파손은 부팅 캐너리가 못 잡는다(자체 문서화된 기존 한계, 이번 diff 로 범위만 확장)
  - 위치: `codebase/backend/src/common/decorators/workspace-reflection-canary.ts` (`assertWorkspaceIdReflectionWorks`, `total === 0` 판정)
  - 상세: 두 reflection 판별(`@WorkspaceId()` 소비 여부, `@WorkspaceParam()` 소비 여부)은 같은 `ROUTE_ARGS_METADATA` 를 같은 팩토리 identity 비교로 읽는다. 캐너리는 `total`(둘의 합집합)이 0일 때만 fail-closed 로 부팅을 멈춘다. 따라서 예컨대 향후 리팩터로 `extractWorkspaceParam` 팩토리 참조만 깨지고(예: 핸들러를 감싸는 새 데코레이터 도입으로 `Function.name` 소실이 경로 바인딩에만 영향) `extractWorkspaceId` 는 살아 있는 시나리오라면, `total` 은 여전히 0이 아니므로 캐너리는 통과하고 **경로 워크스페이스 인가 전체가 조용히 fail-open** 된다(모든 `@WorkspaceParam` 라우트가 `pathParamNames.length === 0` 으로 오판되어 `@Roles()` 가 있으면 헤더/토큰 워크스페이스로, 없으면 무검증 통과). 코드 자체 docstring 이 "부분 파손은 이 단언이 못 잡는다 — 알려진 한계라 숨기지 않고 적어 둔다" 로 이미 인정하고 있으므로 새 결함은 아니나, 이번 diff 로 이 한계가 적용되는 표면(경로 인가 전체)이 넓어졌다는 점은 기록해 둔다.
  - 제안: 조치 불요(기존에 수용된 트레이드오프) — 다만 두 카운트(`requestContext`, `pathParam`)를 부팅 로그에 분리해 남기는 이번 diff 의 설계(운영자가 급락을 관측 가능)가 이 한계에 대한 실질적 완화책이므로 그대로 유지할 것.

- **[INFO]** `RolesGuard`/`isUuidShaped`/`ParseUUIDPipe` 정합성 확인 — 우회 없음(검증됨, 조치 불요)
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts` 158-162번째 줄, `codebase/backend/src/common/utils/uuid.ts` `isUuidShaped`
  - 상세: 가드가 "형식이 아닌 경로 값은 판정하지 않고 넘긴다(`isUuidShaped` 가 false)"는 설계는, 뒤이어 도는 `@WorkspaceParam` 내장 `new ParseUUIDPipe()`(버전 미지정 → NestJS 기본값 `'all'`)가 반드시 400 으로 끊는다는 가정에 의존한다. NestJS 소스(`@nestjs/common/pipes/parse-uuid.pipe.js`)의 `uuidRegExps.all` 을 직접 대조한 결과 `isUuidShaped` 의 `UUID_SHAPE_PATTERN` 과 정확히 동일한 8-4-4-4-12 hex 형태 판정이라, 가드가 넘긴 값이 파이프를 통과해 인가 없이 핸들러에 도달하는 경로는 없다. 단위 테스트(`roles.guard.spec.ts` "가드는 파이프보다 먼저 돈다" describe 블록)와 e2e(`workspace-path-guard.e2e-spec.ts` "형식이 아닌 경로 값은 400")가 이를 직접 검증한다.

## 요약

이 PR 은 실질적인 cross-tenant 인가 우회(경로로 지정한 워크스페이스가 아니라 헤더/토큰의 워크스페이스로
`@Roles()` 를 판정하던 구조적 결함, 특히 `transferOwnership`·워크스페이스 삭제·멤버 관리 등 관리
라우트 15곳)를 가드 레벨에서 닫는 견고한 보안 하드닝이다. 핵심 로직은 멤버십/역할 판정 순서, 거부 코드
통일, nil UUID·형식 불량 값 처리, 다중 `@WorkspaceParam` 처리 등 엣지 케이스를 단위·e2e 양쪽에서
충실히 검증했고, `ParseUUIDPipe` 와 `isUuidShaped` 의 정합성도 실제 NestJS 구현과 대조해 확인했다.
새로 도입된 인젝션·하드코딩 시크릿·평문 전송·암호화 약화 이슈는 발견되지 않았다. 유일한 잔여 우려는
경로 기반 워크스페이스 인가 우회 방지의 CI 안전망(`workspace-param-binding-guard.ts`)이 이름 휴리스틱에
의존해 관례 밖 이름을 쓰는 미래의 실수를 잡지 못한다는 구조적 갭이며, 이는 이 PR 이 직접 만든 결함이
아니라 기존에도 있던(헤더 케이스) "opt-in 데코레이터, 사람이 기억해야 함" 패턴이 경로 케이스로 확장되며
같이 넓어진 잔여 위험이다.

## 위험도

LOW
