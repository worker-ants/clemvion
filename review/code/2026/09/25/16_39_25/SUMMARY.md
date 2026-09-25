# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0건, Warning 8건(전부 저위험/의도된 트레이드오프의 부산물 또는 국소 문서·테스트 갭). forced 화이트리스트(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 전원 결과 확보 완료 — 강제 목록 미이행 없음.

이번 changeset은 경로 파라미터(`@WorkspaceParam`)로 전달되는 워크스페이스 ID를 `RolesGuard`가 인가 대상으로 인식하지 못하던 기존 CRITICAL 급 결함(예: `transferOwnership`이 헤더/토큰 워크스페이스로 오판정)을 구조적으로 닫는 보안 강화 PR이며, 1라운드(`review/code/2026/09/25/16_03_32`, Warning 8건)의 처분(커밋 `37ee970a2`, `8d732756f`)이 이번 diff에 실제로 반영됨을 14개 reviewer가 모두 재확인했다. 이번 2라운드에서 새로 식별된 Warning 8건은 새로운 취약점이 아니라 (1) 이 PR이 막 통합한 "역할 서열 단일 SoT" 원칙이 인접 테이블(거부 코드/메시지, `ROLE_REQUIRED`)에는 아직 적용되지 않아 남은 이원화 표면, (2) 의도된 defense-in-depth(가드+서비스 이중 DB 조회, 전역 403 코드 변경)의 문서화·계측 공백, (3) 코드 중복(`decoratorCallName`), (4) 다중 `@WorkspaceParam` 불변식을 증명하지 못하는 테스트 형태, (5) 한 곳의 stale Swagger 문구, (6) `@Roles()` 오탈자 시 fail-open 가능성이다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture / Maintainability | `ROLE_REQUIRED`(거부 코드·메시지 맵)가 이 PR이 방금 통합한 역할 서열 SoT(`WORKSPACE_ROLE_LEVEL`)에서 파생되지 않은 별도의 손으로 쓴 리터럴이다. 두 테이블 키가 갈려도 컴파일·테스트가 못 잡고 `ROLE_REQUIRED[threshold] ?? NOT_A_MEMBER` 로 조용히 오답 코드/메시지를 준다 | `codebase/backend/src/common/guards/roles.guard.ts:42`, `:236` | `Record<keyof typeof WORKSPACE_ROLE_LEVEL, ...>` 로 타입을 좁히거나, 두 객체의 키 동등성을 단언하는 테스트 추가 |
| 2 | Maintainability | 가드 거부 코드·메시지 리터럴(`NOT_A_MEMBER`, `ROLE_REQUIRED`)이 `RolesGuard`와 `WorkspacesService`(`throwNotAMember`/`throwAdminRequired`)에 각각 독립 존재 — docstring은 결합을 인정하면서 공유 소스는 없음. 한쪽 문구가 바뀌면 다른 쪽은 조용히 갈라짐 | `roles.guard.ts:32-50` vs `workspaces.service.ts:678-679, 921-934` | `workspace-roles.ts` 옆에 code+message 공유 상수 테이블을 두고 양쪽이 참조하도록 통합 |
| 3 | Maintainability | `decoratorCallName` 헬퍼가 `param-uuid-pipe-guard.ts`와 신규 `workspace-param-binding-guard.ts`에 글자 그대로 동일하게 복제됨 | `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts:65-72`, `workspace-param-binding-guard.ts:47-54` | `common/__test-utils__/source-scan.ts`로 추출해 두 가드가 import |
| 4 | Testing | `RolesGuard`가 다중 `@WorkspaceParam`을 "전부" 검사한다는 유일한 테스트가 순서상 항상 마지막 파라미터에서 거부 사유가 나오도록 짜여 있어, "일부만 검사하고 통과시키는" 방향의 회귀(예: 마지막 항목만 검사)를 잡지 못함. plan 뮤턴트 표(M1~M17)에도 이 형태 뮤턴트 없음 | `codebase/backend/src/common/guards/roles.guard.spec.ts:692-704` | 순서를 뒤집은 케이스(`{a: 비멤버, b: owner}`) 추가 또는 양쪽 `getMemberRole` 호출 모두를 단언 |
| 5 | Documentation | `switchWorkspace`의 `@ApiOperation.description`이 "X-Workspace-Id 헤더 우선(header-first)" 동작을 여전히 광고하지만, 이 PR이 해당 라우트를 `@WorkspaceParam` 경로-only로 확정해 실제로는 헤더를 전혀 읽지 않음 — 이 PR이 세우는 불변식과 정면 배치. plan/spec 어디에도 잔여 항목으로 등재되지 않음 | `codebase/backend/src/modules/auth/auth.controller.ts:431` | 헤더 관련 문장을 삭제하거나 "경로 `:id`만 본다"로 정정 |
| 6 | API Contract | `@Roles()` 인자가 `string[]`로만 타입 검증되어, 오탈자·미등록 역할 문자열이 `workspaceRoleLevel`의 "미확인=0" 폴백과 결합해 **인가를 통과시키는 방향으로 fail-open**한다(요구 역할과 무관하게 멤버면 통과). 오늘 기준 `@Roles(` 94곳 전부 유효 리터럴이라 즉시 악용 경로는 없음 | `codebase/backend/src/common/guards/roles.guard.ts:30, 232-236`, `common/constants/workspace-roles.ts:16-21` | `Roles(...roles: WorkspaceRole[])`로 시그니처를 좁히거나, `assertMember` 호출 전 미등록 역할 문자열에 대해 boot-time/런타임 throw 추가 |
| 7 | Performance | 경로 워크스페이스 라우트 16곳(관리형 엔드포인트)에서 인가 판정이 가드+서비스 이중 DB 조회로 요청당 멤버십 쿼리가 1회→2회로 증가. 의도된 defense-in-depth로 문서화돼 있으나 수치화된 실측은 없음 | `roles.guard.ts:172-173`, `workspaces.service.ts:943-949, 951-957` | 부하 테스트로 p50/p99 지연 변화를 실측해 §Rationale에 수치 기록. 필요 시 가드가 조회한 role을 재사용하는 캐싱 검토(단, 독립 재검증이 필요한 자리는 유지) |
| 8 | Side Effect | `RolesGuard`가 던지는 `ForbiddenException` 코드(`NOT_A_MEMBER` 등) 변경이 `@Roles()`가 붙은 **저장소 전역 라우트**(editor 66·admin 9·owner 7·viewer 5)의 403 응답 본문에 적용됨 — 이 PR 표제(경로 가드)보다 블라스트 반경이 훨씬 넓음. spec Rationale로 정당화는 됐으나 CHANGELOG에 전역 영향 범위가 명시적으로 강조되지 않음 | `codebase/backend/src/common/guards/roles.guard.ts` (`assertMember`, `canActivate`) | CHANGELOG/API 버전 노트에 "모든 `@Roles()` 라우트의 403 코드가 바뀐다"를 명시적으로 남겨 좁은 변경으로 오인 방지 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Performance / Architecture / Side Effect / Maintainability / Database / Concurrency (6개 리뷰어 공통 관찰) | `RolesGuard`의 경로 파라미터 루프가 순차 `await`라 한 핸들러가 `@WorkspaceParam`을 둘 이상 쓰면 직렬 N+1 DB 왕복이 된다. 현재 전 라우트가 단일 파라미터(`id`)만 사용해 실질 위험 없음 | `roles.guard.ts:166-179` | 현재 조치 불요. "핸들러당 `@WorkspaceParam` 1개" 불변식을 주석/가드로 명시하거나, 다중화 시 `Promise.all` 병렬화 검토 |
| 2 | Security / Testing (공통) | `ROLE_REQUIRED[threshold] ?? NOT_A_MEMBER` 폴백은 현재 도메인 불변식상 도달 불가능해 보이는 죽은 코드(안전한 기본값 방향이라 결함 아님) | `roles.guard.ts` `assertMember` 마지막 줄 | 조치 불요. 필요 시 주석으로 도달 불가 이유를 명시하거나 `@Roles()` 등록 시점 검증으로 더 이른 실패 유도 |
| 3 | Performance | `RolesGuard.canActivate`가 요청마다 `Reflect.getMetadata`를 2회(이전 1회) 호출 — 전역 가드라 전량에 곱해지지만 개별 비용은 미미 | `roles.guard.ts:159-166` | 핸들러 단위 `WeakMap` 메모이제이션 고려(우선순위 낮음) |
| 4 | Security | 정적 가드 `workspace-param-binding`의 판정이 이름 휴리스틱(`workspaceId` 등 패턴)에만 의존 — 규칙 밖 이름(`id` 단독 등)으로 바인딩하면 놓칠 수 있음. 1라운드에서 이미 지적·수용된 알려진 한계 | `repo-guards/__tests__/workspace-param-binding-guard.ts` (`isWorkspaceIdName`) | 조치 불요(기존 수용 한계) |
| 5 | Architecture | `common/constants/workspace-roles.spec.ts`가 `modules/workspaces/dto/add-member.dto`를 역방향 import — 레이어 방향("common은 modules를 모른다")이 테스트 코드에서 깨짐(런타임 영향 없음) | `common/constants/workspace-roles.spec.ts:6` | 급하지 않음. 향후 `WORKSPACE_ROLES` 자체를 `common`으로 옮기고 DTO가 참조하는 방향으로 뒤집는 것을 고려 |
| 6 | Requirement (Process) | plan 체크리스트가 이미 통과한 TEST WORKFLOW·`/ai-review`·`--impl-done` 등을 미체크로 남김 — 1라운드 `RESOLUTION.md`는 이미 전체 테스트 통과를 기록 | `plan/in-progress/workspace-path-guard-impl.md` §체크리스트 | 이번 라운드 수렴 후 마무리 커밋에서 실제 상태로 갱신 |
| 7 | Requirement | `@WorkspaceId()` + `@WorkspaceParam()`을 함께 소비하는 핸들러의 "헤더 형식 불량" 조합 테스트 없음 — 현재 프로덕션 라우트 0곳이라 위험 낮음 | `roles.guard.ts` `canActivate` (`checkRequestContext` 분기) | 향후 이런 핸들러가 추가될 때 테스트/뮤턴트에 포함 |
| 8 | Side Effect | 가드-서비스 이중 멤버십 조회에 대한 "의도된 중복" 주석이 `workspaces.service.ts`에는 있으나 `auth.service.ts`(`switchWorkspace` → `resolveTokenWorkspaceContext`)에는 없어 다음 사람이 죽은 코드로 오판해 제거할 위험 | `auth.service.ts` `resolveTokenWorkspaceContext` | 동일 취지의 주석을 대칭적으로 추가 |
| 9 | Maintainability | `assertMember`라는 이름이 실제 책임(멤버십 + 역할 계층 판정)을 온전히 드러내지 않음 | `roles.guard.ts:220-237` | `assertMembershipAndRole` 등으로 개명 또는 호출부 주석 보강 |
| 10 | User Guide Sync | `auth-session-flow-change` trigger가 `auth.controller.ts` 변경으로 매칭되어 `07-workspace-and-team/*.mdx` 갱신을 요구하지만, 실측(spec draft §A "취약점 없음, 결함은 가드 커버리지 모델")·FE 기존 코드가 이미 이 거부 코드들을 소비 중임·spec 자체의 "backend 인가 모델 불변" 명시를 근거로 사용자 가시 흐름 변경이 아니라고 판단됨(e2e 몫은 충족) | `codebase/frontend/src/content/docs/07-workspace-and-team/` (미변경) | 확정적 갭 아님. 안전 마진을 위해 PR 본문/CHANGELOG에 "backend 인가 모델 불변이라 갱신 생략" 한 줄 권장(강제 아님) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 새 취약점 없음. 기존 CRITICAL 급 cross-tenant 인가 우회 결함을 구조적으로 닫음. INFO 2건(정적가드 이름 휴리스틱 한계, 폴백 죽은 코드)은 1라운드부터 알려진 한계 |
| performance | LOW | 경로 워크스페이스 16곳 인가 DB 조회 1→2회 증가(WARNING, 의도된 트레이드오프의 미계측). Reflection 호출 2배, 순차 루프는 INFO |
| architecture | LOW | `ROLE_REQUIRED`가 방금 통합한 역할 서열 SoT에서 파생 안 됨(WARNING). common→modules 역방향 테스트 의존, 다중 파라미터 시 잠재 N+1은 INFO |
| requirement | LOW | spec·plan·뮤턴트 표(M1~M17)와 라인 단위 정합. plan 체크리스트 미갱신, 헤더+경로 병용 테스트 공백은 INFO(process/코드 무관) |
| scope | NONE | 25개 파일 변경 전부 plan에 사전 명시되거나 1라운드에서 처분된 "계획된 결합". 스코프 이탈 없음 |
| side_effect | LOW | 403 코드 전역 변경(WARNING, 블라스트 반경). 가드-서비스 이중조회 비대칭 주석, export 함수 시그니처 변경(영향 없음 확인), 에러 우선순위 반전은 INFO |
| maintainability | LOW | 거부 코드/메시지 리터럴 중복(WARNING), `decoratorCallName` 복제(WARNING). 함수명·순차 루프 주석 부재는 INFO |
| testing | LOW | 다중 `@WorkspaceParam` "전부 검사" 불변식을 실제로 증명 못 하는 테스트(WARNING). 폴백 죽은 코드는 INFO. 1라운드 INFO 6/7 처분 확인 |
| documentation | LOW | `switchWorkspace` Swagger 문구가 이 PR이 세운 불변식과 배치(WARNING). CHANGELOG·spec Rationale·JSDoc은 상위권 수준으로 확인 |
| dependency | NONE | 새 외부 의존성 없음. `ADMIN_ROLES`/역할 서열 3곳 중복을 단일 소스로 통합(긍정적) |
| database | LOW | 스키마 변경 없음. 이중 조회는 유니크 인덱스 단건 조회이며 1라운드에서 이미 수용된 비용. 트랜잭션·락 순서 회귀 없음 |
| concurrency | NONE | 상태변경 메서드의 잠금 전략(순서 고정, 원자적 DELETE, TOCTOU 방지)은 이번 diff로 변경되지 않음. 이중조회는 무락 사전체크일 뿐 최종 결정은 락 안에서 남 |
| api_contract | LOW | `@Roles()` 미검증 문자열의 fail-open 가능성(WARNING). W1/W3/W4/W6(1라운드) 처분 확인 |
| user_guide_sync | NONE | frontend 코드 변경 없음. `07-workspace-and-team/` 미갱신은 실측 근거로 실제 갭 아님(INFO) 판단 |

## 발견 없는 에이전트

없음 — 14개 reviewer 전원이 최소 INFO 이상의 관찰을 보고했다(단, security/scope/dependency/concurrency/user_guide_sync는 위험도 NONE으로 실질적 결함은 없다고 확인).

## 권장 조치사항

1. (WARNING 6, API Contract) `Roles()` 시그니처를 `WorkspaceRole[]`로 좁히거나 미등록 역할 문자열에 대한 런타임 방어를 추가해 오탈자 fail-open 가능성을 구조적으로 차단.
2. (WARNING 1, Architecture/Maintainability) `ROLE_REQUIRED`를 `WORKSPACE_ROLE_LEVEL` 키에서 파생되도록 타입을 좁히거나 키 동등성 테스트를 추가해, 이 PR이 막 세운 "역할 서열 단일 SoT" 원칙을 완결.
3. (WARNING 4, Testing) `roles.guard.spec.ts`의 다중 `@WorkspaceParam` 테스트에 순서를 뒤집은 케이스를 추가해 "일부만 검사하는" 회귀를 실제로 잡도록 보강.
4. (WARNING 5, Documentation) `auth.controller.ts`의 `switchWorkspace` `@ApiOperation.description`에서 stale한 "헤더 우선" 문구를 정정.
5. (WARNING 2, Maintainability) 가드/서비스에 흩어진 거부 코드·메시지 리터럴을 공유 상수로 통합.
6. (WARNING 3, Maintainability) `decoratorCallName` 헬퍼를 `source-scan.ts`로 추출해 두 repo-guard 파일의 중복 제거.
7. (WARNING 7·8, Performance/Side Effect) 부하 테스트로 이중 DB 조회의 실제 지연 영향을 측정해 §Rationale에 기록하고, CHANGELOG에 403 코드 전역 변경 범위를 명시.
8. INFO 항목들(순차 N+1 루프 불변식 주석, `assertMember` 개명, plan 체크리스트 갱신, `auth.service.ts` 대칭 주석)은 우선순위 낮음 — 다음 관련 변경 시 함께 처리.

## 라우터 결정

- `routing_status=skipped` — 라우터 미사용, 전체 reviewer(14명) 실행됨.
- **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (forced 전원 결과 확보 완료 — 미이행 없음)
- **제외**: 없음(router 미사용이므로 skip 대상 없음)

관련 파일 (절대경로):
- /Volumes/project/private/clemvion/.claude/worktrees/workspace-path-guard/review/code/2026/09/25/16_39_25/security.md (이미 디스크 존재, 재작성 불필요)
- /Volumes/project/private/clemvion/.claude/worktrees/workspace-path-guard/review/code/2026/09/25/16_39_25/performance.md
- /Volumes/project/private/clemvion/.claude/worktrees/workspace-path-guard/review/code/2026/09/25/16_39_25/architecture.md
- /Volumes/project/private/clemvion/.claude/worktrees/workspace-path-guard/review/code/2026/09/25/16_39_25/requirement.md
- /Volumes/project/private/clemvion/.claude/worktrees/workspace-path-guard/review/code/2026/09/25/16_39_25/scope.md
- /Volumes/project/private/clemvion/.claude/worktrees/workspace-path-guard/review/code/2026/09/25/16_39_25/side_effect.md
- /Volumes/project/private/clemvion/.claude/worktrees/workspace-path-guard/review/code/2026/09/25/16_39_25/maintainability.md
- /Volumes/project/private/clemvion/.claude/worktrees/workspace-path-guard/review/code/2026/09/25/16_39_25/testing.md
- /Volumes/project/private/clemvion/.claude/worktrees/workspace-path-guard/review/code/2026/09/25/16_39_25/documentation.md
- /Volumes/project/private/clemvion/.claude/worktrees/workspace-path-guard/review/code/2026/09/25/16_39_25/dependency.md
- /Volumes/project/private/clemvion/.claude/worktrees/workspace-path-guard/review/code/2026/09/25/16_39_25/database.md
- /Volumes/project/private/clemvion/.claude/worktrees/workspace-path-guard/review/code/2026/09/25/16_39_25/concurrency.md
- /Volumes/project/private/clemvion/.claude/worktrees/workspace-path-guard/review/code/2026/09/25/16_39_25/api_contract.md
- /Volumes/project/private/clemvion/.claude/worktrees/workspace-path-guard/review/code/2026/09/25/16_39_25/user_guide_sync.md
- /Volumes/project/private/clemvion/.claude/worktrees/workspace-path-guard/review/code/2026/09/25/16_39_25/SUMMARY.md (Write 시도가 basename 차단으로 실패 — 위 전문을 호출자가 멱등 기록해야 함)
