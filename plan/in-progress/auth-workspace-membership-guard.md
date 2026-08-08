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

## 체크리스트

- [ ] `/consistency-check --impl-prep spec/5-system/1-auth.md`
- [ ] 테스트 선작성 — 가드 단위(헤더 위조 → 403 / 헤더 부재 → 통과 / `@Public` → skip /
      역할 계층은 `@Roles()` 있을 때만) + 뮤테이션으로 non-vacuity 확인
- [ ] `RolesGuard` 재구성 + 두 곳의 거짓 주석(`roles.guard.ts` docstring ·
      `workspace.decorator.ts:16`) 정정
- [ ] mutation 15건 §3.2 대조 → 개별 `@Roles()` 판정·부착 (전부 부착이 답이 아님)
- [ ] **회귀 가드** — 새 라우트가 같은 갭을 만들면 실패하는 repo-guard 테스트.
      일회성 스크립트로 끝내면 74번째에서 재발한다
- [ ] e2e — 비멤버가 헤더 위조로 타 워크스페이스 리소스 접근 시 403 (권한 경계 =
      `PROJECT.md §e2e 작성 가이드` 의 e2e 대상)
- [ ] TEST WORKFLOW (lint / unit / build / e2e)
- [ ] `/ai-review` + Critical·Warning 해소
- [ ] `/consistency-check --impl-done spec/5-system/1-auth.md`

## Rationale

**왜 P0 인가.** cross-tenant 기밀성 침해이고, `rotateBotToken` 은 열람을 넘어 **채널 탈취급
mutation** 이다. `origin/main` 에 살아 있음을 실측 확인했다(이번 브랜치가 만든 것 아님).

**왜 spec 변경이 없나.** §3.3·§3.2 가 이미 멤버십·역할 검증을 요구한다. 구현이 그 계약을
어긴 것이라 developer 트랙에서 닫는다. 단 §3.2 대조 결과 **매트릭스에 없는 리소스**
(`edges`·`nodes`·`notifications` 등)가 나오면 그건 planner 위임 대상이다 — 그 시점에 분리한다.
