---
title: "@Roles() 미부착 라우트의 워크스페이스 멤버십 검증 누락 — cross-tenant 노출 (security CRITICAL)"
worktree: auth-workspace-membership-guard-2b94db
started: 2026-08-08
owner: developer
status: in-progress
priority: P0
spec_impact: none
---

## Overview

[`spec-sync-auth-gaps.md`](spec-sync-auth-gaps.md) 의 **[보안·별도 트랙]** 항목을 이관해
전용 plan 으로 분리한다. 그 plan 은 `owner: planner` 이고 감사 로깅 계열 항목을 담는데,
본 건은 developer 트랙의 P0 이라 한 plan 에 묶으면 push 게이트 연결(`worktree:`)이 충돌한다.

출처: `review/code/2026/08/01/13_46_48/security.md` **CRITICAL**
(`#1081` audit-logging PR 의 리뷰가 diff 밖에서 발견 — 그 PR 이 만든 결함이 아니다).

## 확정된 공격 경로 (2026-08-08 실측)

세 조각이 맞물린다:

| # | 위치 | 사실 |
|---|---|---|
| 1 | `auth/strategies/jwt.strategy.ts:56-64` | 토큰 클레임 워크스페이스의 **멤버십을 검증**해 `request.user.workspaceId` 를 확정한다. **이 값은 안전하다** |
| 2 | `common/decorators/workspace.decorator.ts:18-19` | `headers['x-workspace-id'] \|\| request.user?.workspaceId` — **헤더가 이기고, 검증이 없다** |
| 3 | `common/guards/roles.guard.ts:51-53` | `requiredRoles` 가 비면 `return true`. 멤버십 조회(`:66-70`)는 그 아래라 **`@Roles()` 없는 라우트에선 절대 실행되지 않는다** |

⇒ 인증된 아무 사용자가 `@Roles()` 없는 라우트에 `X-Workspace-Id: <피해자 워크스페이스>` 를
붙이면, 서비스 쿼리가 그 워크스페이스로 스코프돼 **cross-tenant 열람·조작**이 된다.

**두 곳의 주석이 자기 구현과 반대로 적혀 있다** — 이 결함이 오래 안 보인 이유다:

- `roles.guard.ts:33-38` docstring: "사용자가 워크스페이스 멤버가 아니면 거부" (무조건적 서술)
- `workspace.decorator.ts:16`: "헤더 스푸핑(비멤버)은 RolesGuard 가 403 으로 차단한다"

둘 다 `@Roles()` 가 있는 라우트에서만 참이다.

### spec 은 이미 이 동작을 요구한다 (⇒ spec 변경 불요, `spec_impact: none`)

[`spec/5-system/1-auth.md` §3.3](../../spec/5-system/1-auth.md) API 인가 흐름:

> 2. 활성 워크스페이스·role 확정 — … 워크스페이스 컨텍스트는 **header-first** …
> 3. 요청 리소스가 해당 워크스페이스에 속하는지 확인
> 4. 역할이 해당 액션에 대한 권한을 가지는지 확인

§3.2 매트릭스도 모든 리소스에 최소 `R`(Viewer) 을 요구한다 — **비멤버 열은 아예 없다.**
즉 이것은 spec 갱신 건이 아니라 **문서화된 계약을 구현이 어긴 것**이다.

## 전수 triage (2026-08-08, 데코레이터 기준 파싱)

HTTP 라우트 **222건** 중 `@WorkspaceId()` 를 소비하면서 `@Roles()` 가 없는 것 **73건**
(`@Public` 제외, 클래스 레벨 상속 반영). 재현: `.claude/`… 밖 일회성 스크립트가 아니라
아래 §5 회귀 가드로 코드베이스에 고정한다.

> **첫 파싱이 0건이었다(vacuous).** `@WorkspaceId()` 가 데코레이터 블록이 아니라
> **파라미터 목록**에 있어 놓쳤다. 하한 단언(`scanned < 100 → exit 1`)이 잡았다.
> 리뷰어가 손으로 지목한 4개 파일(triggers·schedules·workflows·model-config)이
> 수정된 파서에서 전부 재현되는 것으로 교차 검증했다.

결함이 **둘**이고 처방이 다르다:

### (1) cross-tenant — 73건 전부 (비멤버 접근)

`RolesGuard` 구조 수정으로 일괄 차단. 개별 라우트 편집 불요.

### (2) intra-tenant — mutation 15건 (멤버이지만 viewer 가 쓰기)

멤버십을 고쳐도 **남는다**. §3.2 매트릭스 대조 후 개별 `@Roles()` 부착 필요:

| verb | 위치 | 핸들러 |
|---|---|---|
| Post | `edges/edges.controller.ts:59` | `create` |
| Delete | `edges/edges.controller.ts:87` | `remove` |
| Post | `executions/executions.controller.ts:119` | `stop` |
| Post | `integrations/integrations.controller.ts:178` | `oauthBegin` |
| Post | `integrations/integrations.controller.ts:406` | `testConnection` |
| Post | `integrations/integrations.controller.ts:461` | `reauthorize` |
| Post | `integrations/integrations.controller.ts:482` | `requestScopes` |
| Patch | `integrations/integrations.controller.ts:517` | `updateScope` |
| Post | `knowledge-base/knowledge-base.controller.ts:422` | `search` |
| Post | `nodes/nodes.controller.ts:87` | `create` |
| Patch | `nodes/nodes.controller.ts:114` | `update` |
| Delete | `nodes/nodes.controller.ts:133` | `remove` |
| Post | `notifications/notifications.controller.ts:128` | `markAllRead` |
| Post | `notifications/notifications.controller.ts:150` | `dismissAll` |
| Post | `triggers/triggers.controller.ts:229` | `rotateBotToken` |

**주의 — 전부가 결함은 아니다.** `notifications.markAllRead`/`dismissAll` 은 호출자 본인의
알림을 대상으로 하는 user-scoped 쓰기일 수 있고, `knowledge-base.search` 는 POST 지만
의미가 조회다. **각 건을 서비스 구현까지 읽고 §3.2 의 어느 행인지 판정**한 뒤 부착한다 —
일괄 `@Roles('editor')` 는 정당한 viewer 동작을 깨뜨린다.

## 설계 — 왜 "라우트마다 데코레이터" 가 아니라 가드 수정인가

리뷰어가 두 안을 제시했고, 후자를 택한다:

- (A) 73개 라우트에 `@Roles('viewer')` 부착 — **opt-in 모델의 연장**. 이미 최소 2회 누락됐고,
  새 라우트가 생길 때마다 사람이 기억해야 한다. 74번째가 또 빠진다.
- (B) `RolesGuard` 를 "역할 계층 검사만 `@Roles()` 에 의존, **멤버십 검사는 항상**" 으로 재구성
  — opt-out 이 구조적으로 불가능해진다.

**(B) 의 blast radius 를 좁히는 핵심 관찰**: 헤더가 **없으면** 워크스페이스 컨텍스트는
`request.user.workspaceId` 이고 그건 `jwt.strategy` 가 이미 멤버십 검증한 값이다. 즉
**새로 검사할 것이 없다.** 검증이 필요한 유일한 경로는 **헤더가 존재할 때**다.

⇒ 규칙: **워크스페이스 컨텍스트가 토큰이 확정한 값과 다르면 멤버십을 검증한다.**

이 규칙은 정상 클라이언트에 대해 **동작 보존**이다 — 정상 클라이언트는 자기가 멤버인
워크스페이스만 헤더로 보낸다. 깨지는 것은 위조뿐이다.

`RolesGuard` 가 전역 `APP_GUARD`(`app.module.ts:204`)이므로 아래를 반드시 보존한다:

- `@Public` 라우트 / `request.user` 부재 → **skip** (인증 판정은 `JwtAuthGuard` 소관)
- 워크스페이스 컨텍스트가 없는 라우트(`@WorkspaceId()` 미사용) → 종전대로 통과

## ⛔ 차단 — `--impl-prep` BLOCK: YES (2026-08-08, `review/consistency/2026/08/08/18_47_21`)

**구현 착수가 막혔다.** Critical 1건이고 근본 원인이 `spec/` 텍스트라 developer 권한 밖이다
(CLAUDE.md: 구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임).

### Critical — spec 5곳이 이 취약점을 "이미 차단됨" 으로 기정사실화

코드 주석 2곳(`roles.guard.ts` docstring · `workspace.decorator.ts:16`)의 거짓 서술이
**spec 레이어에도 복제**돼 있다. 직접 실측 확인:

| 위치 | 서술 |
|---|---|
| `spec/data-flow/12-workspace.md:22` | "헤더 스푸핑은 RolesGuard 멤버십 검증이 403 으로 차단" |
| `spec/data-flow/12-workspace.md:293` | "헤더 스푸핑(비멤버 워크스페이스 지정)은 `RolesGuard` 의 멤버십 검증이 403 으로 차단하므로" |
| `spec/data-flow/12-workspace.md:317` | "`RolesGuard` 403 은 **무번복**이다" (Rationale 하드윈 선언) |
| `spec/data-flow/12-workspace.md:322` | "헤더 스푸핑은 `RolesGuard` 가 이미 403 으로 차단한다" |
| `spec/2-navigation/11-error-empty-states.md:72` | "헤더 스푸핑 등 실제 인가는 backend `RolesGuard` 403 이 담당" |

> checker 는 4곳을 들었고 `:317` 은 실측에서 추가로 확인했다.
>
> **이것이 이 취약점이 오래 안 보인 구조적 이유다** — 코드·spec 양쪽이 "차단된다" 고
> 적고 있어, 어느 레이어를 읽어도 갭이 드러나지 않았다.

**판단이 갈리는 지점 (사용자/planner 결정)**: 본 PR 의 fix 가 완료되면 위 문장들은
**사후적으로 참이 된다.** 따라서 (a) spec 을 건드리지 않고 구현으로 참을 만드는 것과
(b) fix 착지 전까지 현황을 조건부로 반영하는 것 중 택일이다. checker 는 (b) 를 권고했다.
`:317` 의 "무번복" 은 Rationale 하드윈 선언이라 (b) 를 택하면 그 표현 자체를 손봐야 한다.

### 해소 경로

- [x] **project-planner 턴 완료 (2026-08-08)** — draft
      [`spec-draft-workspace-header-membership-invariant.md`](spec-draft-workspace-header-membership-invariant.md)
      → `/consistency-check --spec` **BLOCK: NO** (Critical 0 · WARNING 3, `20_10_14`) → spec 반영.
      **정정은 5곳이 아니라 6곳이었다** — `--spec` WARNING #1 이 `spec/2-navigation/9-user-profile.md:158`
      ("**유일 강제 지점**은 backend `RolesGuard` 403")을 추가 발견했다. 내가 첫 checker 가 준
      목록의 파일 2개만 grep 하고 **저장소 전수 grep 을 하지 않은** 탓이다. 하필 내가 고치던
      `11-error-empty-states.md:72` 가 그 절을 "상세" 로 직접 링크하므로, 5곳만 고쳤다면
      **한 홉 뒤에서 미정정 절대 서술로 되돌아갔다.**
      처분 방침은 시한부 현황 노트가 아니라 **불변식 명문화** — 구현이 이어서 착지하므로
      "현재 미차단" 문구는 같은 PR 안에서 stale 해진다. 자세한 근거·기각 대안은 draft 참조.
      반영된 WARNING 3건: W1 6번째 위치 · W2 `@Public()`/`@WorkspaceId()` 미소비 라우트 제외
      스코프 명시 · W3 `swagger.md §5-4` 체크리스트 전제 붕괴 등재.

> **구현 착수 가능 상태다.** 단 `--impl-prep` 를 **재실행**해야 한다 — 종전 `18_47_21` 산출물은
> spec 정정 전 상태라 stale 이고, 게이트는 fresh `BLOCK: NO` 리포트만 인정한다.

## 체크리스트

- [x] `/consistency-check --impl-prep spec/5-system/` — **BLOCK: YES** (Critical 1,
      `review/consistency/2026/08/08/18_47_21`). checker 5/5 success. 위 §차단 참조.
      *(`--impl-prep` 는 파일이 아니라 디렉터리를 받는다 — `1-auth.md` 로 첫 호출이 거부됐다.)*
- [x] 테스트 선작성 — 가드 단위(헤더 위조 → 403 / 헤더 부재 → 통과 / `@Public` → skip /
      역할 계층은 `@Roles()` 있을 때만) + 뮤테이션으로 non-vacuity 확인. `roles.guard.spec.ts`
      21건(2026-08-08) + `workspace-context.util.spec.ts` 6건(2026-08-08 리뷰 fix, 아래
      "회귀 가드" 항목 참조).
- [x] `RolesGuard` 재구성 + 두 곳의 거짓 주석(`roles.guard.ts` docstring ·
      `workspace.decorator.ts:16`) 정정. `workspace.decorator.ts` 는 ai-review WARNING #4
      (`review/code/2026/08/08/20_53_48`)로 `7fb8a6c8c` 에서 완료 — 두 곳 모두 "`@Roles()`
      유무와 무관하게 항상" 수준으로 정정됐다.
- [x] **403 error code 결정** (impl-prep W2) — **`FORBIDDEN` 유지, `NOT_A_MEMBER` 도입 안
      함.** 근거(`roles.guard.ts:78-81` docstring 에 이미 명문화): `@Roles()` 라우트의 비멤버
      거부도 종전부터 코드 없는 403 이라, 새 경로에만 코드를 붙이면 동일한 실패가 `@Roles()`
      유무에 따라 다른 body 를 내게 된다. `spec/5-system/3-error-handling.md §1.2` 의 발행처
      한정·L497 완결성 선언 모두 stale 해지지 않는다 — `--impl-done` 대상에 추가 불요.
      (ai-review INFO #7 이 이 결정과 체크리스트 상태 불일치를 지적 — 본 커밋으로 동기화.)
- [x] mutation 15건 §3.2 대조 → 개별 `@Roles()` 판정·부착 (전부 부착이 답이 아님). 8건은
      `@Roles()` 부착(아래), 2건(`notifications`)·5건(`integrations`)은 부착 안 함(아래
      기존 체크 항목). 8건 부착 목록: `edges` `create`/`remove`, `nodes`
      `create`/`update`/`remove` (`editor`), `executions` `stop` (`editor`), `triggers`
      `rotateBotToken` (`editor`), `knowledge-base` `search` (`viewer`, POST 지만 의미상
      조회). 8+2+5=15 로 cardinality 일치.
- [x] **`integrations` 4건은 §3.2 단독 대조 금지** (impl-prep W1) — **준수 완료.** 아래
      "`integrations` 5건 판정" 항목에서 실제로 2축 매트릭스로 판정했고 §3.2 단독 대조는
      쓰지 않았다. `oauthBegin`·`reauthorize`·`requestScopes`·`updateScope` 는
      [`spec/2-navigation/4-integration.md §8`](../../spec/2-navigation/4-integration.md)
      (L773-783) 의 **액션별 Personal vs Organization 세분화 매트릭스**도 함께 봐야 한다.
      §3.2 의 `Integration (Org) → Editor=R` 만 보고 일괄 부착하면 **Personal-scope 통합을
      소유한 Editor/Viewer 의 정당한 자가서비스(재인증·rotate)를 막는 회귀**가 된다.
      → Organization=Admin+ / Personal=소유권 검사 병행이 방향
- [x] **`notifications.markAllRead`/`dismissAll` 판정 완료 (2026-08-08)** — **`@Roles()` 부착
      안 한다.** `notifications.service.ts:129-143` 실측: `markAllRead(workspaceId, userId)` 가
      `where workspace_id = :workspaceId` **AND** `andWhere user_id = :userId` 로 필터한다 →
      user-scoped 쓰기다. 멤버십 검사(가드 fix)만으로 충분하고, `@Roles('editor')` 를 붙이면
      **자기 알림을 읽음 처리하려는 viewer 를 잘못 막는다**. `dismissAll` 도 같은 형태.
- [x] **`integrations` 5건 판정 — `@Roles()` 부착 안 한다 (2026-08-08)**.
      `4-integration.md §8` 실측(L770-783)은 **액션별 Personal/Organization 2축 매트릭스**다:
      Reauthorize·Rotate·Scope 추가 요청 = Personal "본인 것만" / Organization "**Admin 이상**".
      즉 컨트롤러 `@Roles('editor')` 는 **양방향으로 틀리다** — Organization 엔 과관대(Admin+
      필요), Personal 엔 무관(소유권 검사 사안). 이 2축 판정은 요청 대상 통합의 scope 를 알아야
      하므로 **서비스 레이어 소관**이고, 가드는 멤버십까지만 본다.
      > **범위 밖 발견 (별 티켓 후보)**: 자매 mutation 4곳(`integrations.controller.ts`
      > :358·:386·:426·:552)의 기존 `@Roles('editor')` 도 §8 의 Organization=Admin+ 대비
      > **과관대**일 수 있다. 서비스가 자체 scope 검사를 하는지 확인이 선행돼야 하고, 본 P0
      > (비멤버 차단)와 결함 클래스가 다르므로 여기서 확대하지 않는다.
- [x] **회귀 가드** — 새 라우트가 같은 갭을 만들면 실패하는 repo-guard 테스트.
      일회성 스크립트로 끝내면 74번째에서 재발한다.
      배치: `codebase/backend/src/repo-guards/__tests__/` (impl-prep INFO 4 권고 — 기존 컨벤션).
      **완료 (2026-08-08, `c435a2aa6`, ai-review WARNING #8)** —
      `workspace-roles-attachment.spec.ts`: (1) `RolesGuard` 가 `APP_GUARD` 로 전역 등록돼
      있는지 고정(cross-tenant 73건 클래스는 이 한 줄로 구조적으로 닫힘 — 74번째 라우트는
      자동으로 보호됨), (2) intra-tenant 확정 8곳의 `@Roles()` 메타데이터를 reflection 으로
      직접 고정(사람 판정이라 일반화 불가, 스팟 고정).
- [x] **주석에 "token-first 회귀 아님" 명시** (impl-prep INFO 2) — 채택안(헤더가 토큰과
      다르면 멤버십 검증)은 `data-flow/12-workspace.md` Rationale 이 **기각한 token-first
      (헤더 완전 무시)와 다르다.** header-first 는 유지된다. 구분을 적어두지 않으면 다음
      리뷰가 기각된 대안의 재도입으로 오독한다. `roles.guard.ts` docstring "이는 header-first
      를 유지한다 — 기각된 token-first(헤더 완전 무시)로의 회귀가 아니다" 로 이미 명시됨.
- [ ] **`@ApiForbiddenResponse` 부착 + `swagger.md §5-4` 규약 확장** (2차 impl-prep W1) —
      규약(`spec/conventions/swagger.md:322`)은 "`@Roles(...)` 가 붙은 엔드포인트는
      `@ApiForbiddenResponse` 도 추가" 로 **`@Roles()` 를 전제로** 적혀 있다. 이 fix 후에는
      `@WorkspaceId()` 만 쓰는 라우트도 403 을 낼 수 있어 **전제가 깨진다** → 그대로 두면
      OpenAPI 문서에서 403 이 계속 누락된다.
      2파트로 갈린다: **(a) 데코레이터 부착 = 코드**(developer) — **완료 (2026-08-08,
      `4c199813c`, ai-review WARNING #10)**: 이 diff 가 건드린 5개 컨트롤러의
      `@WorkspaceId()`-only 라우트 12곳에 부착. 저장소 전체 73건 중 나머지 ~61건은 이 diff
      밖이라 스코프 제외 — 아래 spec draft 의 "후속" 절 참조.
      **(b) §5-4 문구를 `@WorkspaceId()` 소비 라우트 전체로 확장 = `spec/conventions/` 편집**
      (planner 트랙) — **draft 작성 완료 (2026-08-08, `a228d22bf`)**:
      [`spec-fix-swagger-forbidden-response.md`](spec-fix-swagger-forbidden-response.md).
      (b) 는 신규 요구를 담으므로 `eia-context-schema-followups` 가 확정한 경계상 "동반 SoT
      sync" 가 아니다 → **별 planner 턴 + `--spec` 필요** — draft 는 작성됐으나 아직
      `/consistency-check --spec` 미통과·미반영. planner 턴 완료 후 본 항목 `[x]`.
      `--impl-done` 대상에 `spec/conventions/swagger.md` 포함할 것.
- [x] e2e — 비멤버가 헤더 위조로 타 워크스페이스 리소스 접근 시 403 (권한 경계 =
      `PROJECT.md §e2e 작성 가이드` 의 e2e 대상). **완료 (2026-08-08, `fee24683d`, ai-review
      WARNING #6)** — `workspace-rbac.e2e-spec.ts` 케이스 I: `@Roles()` 없는 GET 라우트
      (`GET /workflows`·`GET /workflows/:id`, `@WorkspaceId()` 만 사용)에 헤더 위조로
      비멤버 접근 시 403, 자기 워크스페이스는 200 유지 확인.
      **이 e2e 자체가 2차 실 회귀를 잡았다** — `system-status.e2e-spec.ts`(기존 스위트)가
      `@Roles()` 도 `@WorkspaceId()` 도 안 쓰는 전역 API 에 헤더가 실려도 영향 없어야 한다는
      계약을 이미 갖고 있었는데, FE `apiClient` 가 모든 요청에 `X-Workspace-Id` 를 습관적으로
      붙이는 탓에(`lib/api/client.ts`) 헤더가 토큰과 다르면 그 전역 API 까지 403 을 내고
      있었다 — plan 의 "워크스페이스 컨텍스트가 없는 라우트는 종전대로 통과" 불변식 위반.
      `039c490a9`(`handlerConsumesWorkspaceId` reflection 도입)로 수정, 재실행 시
      backend e2e 46 suites/261 tests 전부 통과 + frontend playwright 51 passed.
- [x] TEST WORKFLOW (lint / unit / build / e2e)
      > ⛔ **`lint` 은 선재 결함으로 막혀 있다** — `origin/main` 의 backend eslint 가
      > **79파일 / 224건** 실패한다(`prettier/prettier` 123 · `no-unnecessary-type-assertion`
      > 54 · `no-unsafe-*` 43). 그중 **78파일이 이 브랜치 diff 밖**이다.
      > 정황: `#1076`(prettier 3.8.4→3.9.6)·`#1079`(typescript-eslint 8.61→8.65)가 Actions
      > 꺼진 기간에 무검증 머지됐다.
      > **사용자 결정(2026-08-08): 별 PR 로 분리** →
      > [`backend-lint-gate-broken-on-main.md`](backend-lint-gate-broken-on-main.md).
      > 그 PR 머지 후 이 브랜치를 rebase 하고 lint 를 재수행한다.
      > 이 브랜치가 diff+ai-review resolution 로 변경한 backend 13파일 + frontend 2파일은
      > `npx eslint` **전부 exit 0**(전체 lint 게이트가 아니라 변경 파일 targeted 실행).
      > **unit**: backend 전체 `pnpm --filter backend test` 416 suites / 8463 tests 통과.
      > frontend `pnpm --filter frontend test` 는 이 브랜치와 무관한 pre-existing 1건 실패
      > (`Gate C spec_impact` — `plan/complete/harness-review-gate-ci-backstop.md` 가
      > frontmatter `spec_impact` 를 선언하지 않음, `cdf3b6832`(harness 백로그, 이 브랜치
      > 시작 전 이미 main 에 있었음)에서 유입 — 이 diff 가 만들지도 건드리지도 않음).
      > **build**: `nest build`(tsc) — e2e docker 빌드 단계에서 통과 확인(`handlerConsumes
      > WorkspaceId` 의 `Function` 타입 완화로 최초 1회 타입에러 잡고 수정, `c1142bfc3`).
      > **e2e**: 위 항목 참조 — 통과.
- [x] `/ai-review` + Critical·Warning 해소 — **완료 (2026-08-08)**.
      `review/code/2026/08/08/20_53_48` SUMMARY: Critical 0, WARNING 10. `resolution-applier`
      가 코드 항목 9건 fix + spec 항목 1건(WARNING #10 (b) 규약 문구 확장) draft 위임.
      `review/code/2026/08/08/20_53_48/RESOLUTION.md` 참조.
- [ ] `/consistency-check --impl-done spec/5-system/1-auth.md`

## Rationale

**왜 P0 인가.** cross-tenant 기밀성 침해이고, `rotateBotToken` 은 열람을 넘어 **채널 탈취급
mutation** 이다. `origin/main` 에 살아 있음을 실측 확인했다(이번 브랜치가 만든 것 아님).

**왜 spec 변경이 없나 (본 plan 기준).** §3.3·§3.2 가 이미 멤버십·역할 검증을 요구한다. 구현이
그 계약을 어긴 것이라 developer 트랙에서 닫는다. spec 6곳의 **거짓 서술** 정정은 별 planner
턴에서 이미 처리했다(`d194fd72e`) — 그건 이 plan 의 `spec_impact` 가 아니라 draft 쪽 소관이다.

~~단 §3.2 대조 결과 **매트릭스에 없는 리소스**(`edges`·`nodes`·`notifications` 등)가 나오면
그건 planner 위임 대상이다.~~ → **해소 (2026-08-08, 2차 impl-prep INFO 2 + 직접 실측)**:
`spec/data-flow/11-workflow.md:216` 외부 의존 표가 "Auth / Workspace | RBAC 검사 |
**editor 이상이 CRUD 가능**" 으로 워크플로우 그래프 리소스를 이미 커버한다 → `edges`·`nodes`
의 `editor` 판정에 근거가 있고 **planner 위임 불필요**. `notifications` 는 user-scoped 로
판정돼 `@Roles()` 대상이 아니다(위 체크리스트). 즉 매트릭스 공백은 없었다.
