---
title: spec draft — 경로 파라미터 워크스페이스도 가드가 검사하고, 가드 거부는 코드를 갖는다
worktree: workspace-path-guard
started: 2026-09-25
completed: 2026-09-25
status: complete
owner: project-planner
spec_impact:
  - spec/data-flow/12-workspace.md
  - spec/5-system/3-error-handling.md
  - spec/5-system/1-auth.md
  - spec/conventions/error-codes.md
  - spec/conventions/swagger.md
  - spec/2-navigation/9-user-profile.md
  - spec/2-navigation/6-config.md
  - spec/5-system/13-replay-rerun.md
  - spec/5-system/2-api-convention.md
---

# spec draft — 경로 파라미터 워크스페이스도 가드가 검사하고, 가드 거부는 코드를 갖는다

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 항목 «경로 파라미터로 워크스페이스를 받는 라우트 13개가 가드 층
보호를 전혀 못 받는다»(developer + 설계 결정, 중간)의 **설계 결정 턴**이다. 그 항목의 스코프 조건 — «구조적 해법을 먼저 결정하고,
불가할 때에만 라우트별 수동 체크를 표준 패턴으로 승인» — 에 따라 결정을 먼저 spec 에 박고, 구현은 후속 developer PR 이 한다.

## A. 실측 (2026-09-25)

**바인딩 전수 — 15곳.** 핸들러 파라미터가 경로 `@Param` 에서 워크스페이스 ID 를 받는 자리(`scratchpad/path_ws_census.py`,
`@Param` 과 식별자가 다른 줄에 걸친 경우 포함):

| 컨트롤러 | 수 | 가드가 보는 워크스페이스 |
| --- | --- | --- |
| `workspaces.controller.ts` — `update` · `updateSettings` · `getSettings` · `remove` · `leave` · `listMembers` · `addMember` · `updateMember` · `removeMember` · `listInvitations` · `createInvitation` · `resendInvitation` · `revokeInvitation` | 13 | **없음** — `@Roles()` 도 `@WorkspaceId()` 도 없어 `handlerConsumesWorkspaceId` 단축 통과 |
| `workspaces.controller.ts` — `transferOwnership` (`@Roles('owner')`) | 1 | **헤더 · 토큰의 워크스페이스** — 핸들러가 다루는 경로 `:id` 가 아니다. 서비스가 경로 워크스페이스로 다시 막는다 |
| `auth.controller.ts` — `POST /auth/workspaces/:id/switch` (`targetWorkspaceId`) | 1 | 없음 — `auth.service` 가 `NOT_A_MEMBER` 로 막는다 |

**서비스 계층 판정 순서** — 11개 메서드를 파일:줄로 추적했다:

- **9개는 인가가 먼저다** — 워크스페이스가 없든 비멤버든 같은 403(코드는 라우트마다: `ADMIN_REQUIRED` · `NOT_A_MEMBER` ·
  `OWNER_REQUIRED` · `FORBIDDEN` · `admin_required`). `getMemberRole` 은 `workspace_member` 만 조회해 **부재 워크스페이스와 비멤버를
  구분하지 못한다** — 그래서 인가가 먼저인 한 존재 오라클이 없다.
- **2개에 존재 · 유형 오라클이 있다.** `leaveWorkspace` 는 워크스페이스 `findOne` → 404 → 개인 워크스페이스 403 을 멤버십 검사
  **전에** 하고, `addMemberByEmail` 은 `assertWorkspaceType('team')`(404 / `WORKSPACE_TYPE_MISMATCH`)을 `assertAdmin` **전에** 한다.
  비멤버가 «없음 · 개인 · 팀» 을 구분한다 — `removeMember` 가 닫은 것과 같은 클래스다.
- 취약점(인가 누락)은 없다. 결함은 **가드의 커버리지 모델**이다 — `plan/complete/auth-workspace-membership-guard.md` 의 모집단이
  «`@WorkspaceId()` 를 소비하는 라우트» 라 경로 라우트는 구성상 밖이었다.

## B. 결정 (사용자 결정 2026-09-25)

선택지 셋을 실측과 함께 제시했다:

1. 오라클 2곳만 서비스에서 고친다(인가 먼저) — 가드 확장은 문서화된 코드를 바꾸므로 보류.
2. 가드가 경로 파라미터도 검사한다 — 비멤버 응답이 코드 없는 403 으로 바뀐다.
3. **가드 확장 + 가드 거부에 코드 부여** — 경로 라우트의 거부 본문을 코드로 유지하고, 헤더 위조 경로까지 함께 코드를 갖는다.

**3 을 채택했다.** 이 draft 가 적는 spec 변경은 그 결정을 박는 것이다.

### B-1. 착지 방식 — spec 과 구현을 한 PR 에 싣는다 (`--spec` `14_38_28` Critical 대응)

아래 C 절은 **구현 뒤의 상태를 현재형으로** 적는다. 그래서 spec 반영 커밋(planner)과 구현 커밋(developer, D 절)을 **같은 PR** 에
싣는다 — main 에 들어가는 순간 현재형이 참이다. 이 저장소의 «계획(Planned)/미구현» 인라인 마커(선례: `1-auth.md` §1.3 · §4.1, `status: partial` 라이프사이클은
`spec-impl-evidence.md` §3)는
spec 이 구현보다 **먼저 main 에** 들어갈 때를 위한 것이고, 여기서는 그 창이 없다.

- **구현 없이 머지하지 않는다.** PR 체크리스트에 «D 절 구현 전부 · e2e» 를 두고, spec 반영 커밋만 있는 상태로는 PR 을 열지 않는다.
- 두 역할은 한 PR 안에서 순서대로 선다 — planner 턴(`--spec` BLOCK: NO → spec 반영 커밋) 뒤 developer 턴(`--impl-prep` → TDD →
  e2e → `/ai-review` → `--impl-done`). 역할 경계는 «누가 어느 파일을 쓰나» 이고, 커밋이 그것을 가른다.
- 대안(9개 파일에 Planned 마커 → 구현 PR 이 걷기)은 같은 문장을 두 번 고치고, 그 사이 main 의 spec 이 두 형태로 존재한다.

## C. spec 변경

### C-1. `spec/data-flow/12-workspace.md`

**(a) 본문 — 전환기 하위호환 문단**(«활성 워크스페이스는 access token 의 `activeWorkspaceId` 클레임으로…» 로 시작하는 문단)의 끝에
한 문장을 덧붙인다:

> **경로 파라미터로 워크스페이스를 받는 라우트**(`/workspaces/:id/...` · `/auth/workspaces/:id/switch`)는 헤더 · 토큰이 아니라
> **경로 값이 인가 대상**이다 — `RolesGuard` 가 그 워크스페이스의 멤버십 · 역할을 검사한다(아래 Rationale «경로 파라미터
> 워크스페이스도 가드가 본다»).

**(b) Rationale «멤버십 검증은 가드 1곳에서 — `@Roles()` 와 무관 (2026-08-08)» 의 «적용 범위»** 에 한 줄:

> (2026-09-25 보탬) 이 절의 모집단은 «워크스페이스 **컨텍스트**(헤더 · 토큰)를 소비하는 라우트» 였고, 경로 파라미터로
> 워크스페이스를 받는 라우트 15곳은 구성상 밖이었다 — 아래 «경로 파라미터 워크스페이스도 가드가 본다» 가 그 빈칸을 닫는다.

**(c) Rationale 신설 — «경로 파라미터 워크스페이스도 가드가 본다 (2026-09-25)»**:

> 위 «멤버십 검증은 가드 1곳에서» 는 헤더 · 토큰 컨텍스트만 봤다. 경로 `:id` 로 워크스페이스를 받는 라우트 15곳은 서비스 계층
> `assertMembership` · `assertAdmin` 에만 기댔다(2026-09-25 실측: 인가 누락은 없으나 2곳이 인가 전에 워크스페이스를 조회해
> 존재 · 유형 오라클). `@Roles('owner')` 가 붙은 `transferOwnership` 조차 가드는 **헤더 · 토큰의 워크스페이스**를 검사했다.
>
> **정정**: 워크스페이스를 경로로 받는 파라미터는 **`@WorkspaceParam('<name>')`** 로 바인딩한다. `RolesGuard` 는
> `@WorkspaceId()` 와 같은 방식(`ROUTE_ARGS_METADATA` 의 팩토리 identity)으로 그 소비를 인식하고, 등록된 이름의 경로 값을 인가
> 대상으로 쓴다. 경로 값은 토큰이 검증한 적이 없으므로 **멤버십을 항상 조회**한다. 역할 요구는 서비스 계층과 같게
> `@Roles()` 로 적는다(Owner/Admin 요구 라우트 · Owner 요구 라우트, 멤버면 되는 라우트는 `@Roles()` 없이).
>
> **74번째 라우트 문제는 데코레이터로 안 닫힌다 — 정적 가드가 닫는다.** `@WorkspaceParam` 도 라우트마다 쓰는 데코레이터라,
> 다음 경로 라우트가 평범한 `@Param('id')` 로 워크스페이스를 받으면 같은 빈칸이 생긴다(위 절이 «74번째 라우트에서 재발» 로 기각한
> 모양). 그래서 **컨트롤러 핸들러가 워크스페이스 ID 를 `@Param` 으로 바인딩하는 것을 저장소 가드가 금지한다.**
>
> **`@WorkspaceParam` 은 재기각된 «opt-in 마커» 가 아니다.** [`1-auth.md` §Rationale «부트 캐너리» (b)](../5-system/1-auth.md#부트-캐너리--workspaceid-reflection-자가검증-fail-closed-2026-08-09)
> 가 `SetMetadata` 마커를 재기각한 이유는, 마커가 값 바인딩 **옆에 따로** 다는 메타데이터라 빠뜨려도 라우트가 멀쩡히 돈다는
> 것이었다. `@WorkspaceParam` 은 핸들러가 워크스페이스 ID 를 **받는 방법 자체**다 — `@WorkspaceId()` 와 같은 자리이고, 가드는 (b)
> 가 택한 것과 같은 **소비 reflection**(팩토리 identity)으로 인식한다. 빠뜨릴 수 있는 것은 «데코레이터» 가 아니라 «같은 값을 평범한
> `@Param` 으로 받는 것» 이고, 그것을 위 정적 가드가 CI 에서 fail-closed 로 닫는다.
>
> **비대칭은 남는다(인정한다)**: 헤더 · 토큰 모델에서 `@WorkspaceId()` 대신 `req.user.workspaceId` 를 직접 읽는 라우트도 가드가
> 인식하지 못하는 같은 모양의 구멍인데, 그쪽에는 정적 가드가 없다. 이 결정의 범위 밖이라 트래커에 따로 등재한다.
>
> **가드는 파이프보다 먼저 돈다.** Nest 는 가드 → 파이프 순이라 가드가 받는 경로 값은 검증 전 원문이다. 가드는 헤더와 같은
> `isUuidShaped` 로 형식만 보고, 형식이 아니면 판정하지 않고 넘긴다 — 뒤의 `ParseUUIDPipe` 가 400 을 내고 핸들러는 돌지 않는다.
> 형식은 맞지만 RFC 밖인 값(nil UUID 등)은 가드가 멤버십을 조회해 **403** 이 된다(종전 `ParseUUIDPipe` 400).
>
> **서비스 계층 검사는 남는다 — 가드가 조용히 빠질 때의 두 번째 선이다.** 이 메서드들의 HTTP 밖 호출자는 없다(2026-09-25
> 실측: 내부 위임 `removeMember → leaveWorkspace` 하나 — 그것도 가드를 거친 HTTP 요청 안이다). 그러니 서비스 검사가 막는 것은
> «다른 호출 경로» 가 아니라 **가드의 인식이 깨져 단축 통과가 일어나는 경우**다(reflection 파손은 부트 캐너리가 막지만, 데코레이터를
> 빠뜨린 라우트는 정적 가드만 막는다). 오라클이 있던 두 메서드(`leaveWorkspace` · `addMemberByEmail`)도 인가를 앞으로 옮긴다 — 두
> 번째 선에도 같은 오라클이 남지 않게.

**(d) Rationale «`X-Workspace-Id` 헤더 vs `:id` 경로 파라미터 — UUID 검증 강도 비대칭 (2026-08-09)»** 의 «왜 경로 파라미터는 엄격해도
되는가» 문단 끝에 정정을 덧붙인다(원문은 유지 — 워크스페이스가 아닌 `:memberId` · `:invitationId` 에는 여전히 참이다):

> **(2026-09-25 정정 — 워크스페이스 `:id` 에 한해)** «`:id` 는 인가 판정의 입력이 아니라 리소스 지목» 은 워크스페이스 경로
> 파라미터에서 더는 참이 아니다 — 위 «경로 파라미터 워크스페이스도 가드가 본다» 가 그것을 인가 입력으로 바꿨다. 그래서 가드
> 단계의 술어는 헤더와 같은 `isUuidShaped` 이고(인가 결과 403 을 형식 오류 400 으로 바꾸지 않는다는 위 원리 그대로),
> `ParseUUIDPipe` 는 가드 **뒤**에서 형식 파손만 400 으로 거른다. 표의 «워크스페이스 `:id` 경로 파라미터» 행을 둘로 가른다 —
> 워크스페이스 `:id`(가드 `isUuidShaped` → `ParseUUIDPipe`, 두 단계)와 `:memberId` · `:invitationId`(`ParseUUIDPipe` 한 단계 그대로).
> 같은 절 «적용 범위» 의 «`@Roles()` 또는 `@WorkspaceId()` 를 쓰는 인증 라우트» 에 `@WorkspaceParam(...)` 을 병기한다.
> 같은 문단의 «없는 리소스는 어차피 404» 도 워크스페이스 `:id` 에는 예외다 — 부재 워크스페이스는 가드가 **403 `NOT_A_MEMBER`**
> 로 답해 존재가 새지 않는다(아래 (e)). `:memberId` · `:invitationId` 는 여전히 404 다(`--spec` `14_54_55` W1).

**(e) Rationale 신설 — «가드 거부의 오류 코드 (2026-09-25)»**:

> 위 절들은 가드 거부에 **코드를 지정하지 않았다** — 새 경로에만 코드를 붙이면 같은 실패가 경로에 따라 다른 본문을 낸다는 이유였다.
> 코드를 지정하지 않은 403 은 전역 필터가 기본값 **`FORBIDDEN`** 으로 채운다(`2-api-convention.md` «상태코드별 기본값») — 그러니 지금
> 가드 거부의 wire 코드는 `FORBIDDEN` 이다. 경로 라우트를 가드로 옮기면 그 라우트들이 서비스에서 내던 코드(`NOT_A_MEMBER` ·
> `ADMIN_REQUIRED` · `OWNER_REQUIRED`)가 `FORBIDDEN` 으로 바뀐다. 그래서 **가드의 모든 멤버십 · 역할 거부에 함께 코드를 붙인다**:
>
> | 거부 | 코드 |
> | --- | --- |
> | 대상 워크스페이스의 멤버가 아니다(헤더 위조 · 경로 워크스페이스 · 부재 워크스페이스 — 구분하지 않는다) | `NOT_A_MEMBER` |
> | 멤버지만 `@Roles()` 가 요구하는 최소 역할 미달 — `editor` / `admin` / `owner` | `EDITOR_REQUIRED` / `ADMIN_REQUIRED` / `OWNER_REQUIRED` |
>
> `@Roles('viewer')` 는 멤버십과 같다. 여러 역할을 주면 가장 낮은 역할이 요구다(계층 비교).
>
> **비멤버는 요구 역할과 무관하게 `NOT_A_MEMBER` 다.** 경로 라우트 중 Owner/Admin 을 요구하는 것에서 비멤버가 받는 코드가 서비스
> 시절의 `ADMIN_REQUIRED` · `OWNER_REQUIRED` 에서 `NOT_A_MEMBER` 로 바뀐다 — 이 draft 의 유일한 본문 변경 방향이다(아래 C-2 ·
> Rationale «비멤버 코드를 하나로»). 멤버가 받는 본문은 모두 보존된다.
>
> **적용 범위는 전역이다.** `RolesGuard` 는 `APP_GUARD` 라 이 표는 경로 라우트 15곳만이 아니라 `@Roles()` 가 붙은 **모든** 라우트
> (2026-09-25 실측: `editor` 66 · `admin` 9 · `owner` 7 · `viewer` 5)와 헤더 위조 거부에 함께 적용된다 — 그 라우트들의 역할 · 멤버십
> 거부 wire 코드가 `FORBIDDEN` 에서 위 코드로 바뀐다. 상태 코드는 403 그대로다.
>
> 가드 거부 중 **코드를 붙이지 않는 두 자리**가 남는다 — 미인증 요청이 `@Roles()` 라우트에 닿는 경우(`JwtAuthGuard` 가 먼저
> 401 을 내므로 실제로 닿지 않는다)와, `@Roles()` 라우트에 워크스페이스 컨텍스트가 전혀 없는 경우(가입 직후에도 토큰이 personal
> 워크스페이스를 갖는다). 도달 경로가 없어 이 결정의 범위 밖이다.

**(f) Rationale «URL slug = FE 라우팅 SoT (≠ backend 인가 SoT)»** — «인가는 여전히 위 header-first(`X-Workspace-Id`) → 토큰
클레임(`activeWorkspaceId`) 모델이 결정» 문장 뒤에 한정을 덧붙인다(위 (d) 와 같은 방식):

> (2026-09-25) 단, 경로 파라미터로 워크스페이스를 받는 라우트는 이 모델의 예외다 — 경로 값이 인가 대상이다(«경로 파라미터 워크스페이스도
> 가드가 본다»).

같은 절의 «`RolesGuard` 403 자체도 유지되나» · «헤더 스푸핑은 `RolesGuard` 가 … 403 으로 차단한다» 와 «UUID 검증 강도 비대칭» 절 끝
«비멤버 → 403» 에 코드를 병기한다 — «403 `NOT_A_MEMBER`».

### C-2. `spec/5-system/3-error-handling.md`

- §1.2 표 `ADMIN_REQUIRED` 행 설명: «…(`WorkspacesService.assertAdmin()` 발행)» → «…(`RolesGuard` 의 `@Roles('admin')` 미달 ·
  `WorkspacesService.assertAdmin()` 발행)».
- §1.2 표 `NOT_A_MEMBER` 행 설명에 «`RolesGuard` 의 멤버십 거부(헤더 위조 · 경로 워크스페이스 · 부재 워크스페이스 구분 없음)» 추가.
- §1.2 표에 행 둘 추가:
  - `EDITOR_REQUIRED` | Editor 권한 필요 | 워크스페이스 Editor 이상 역할 필요 시 발행되는 `FORBIDDEN` 의 컨텍스트 특화 코드(`RolesGuard` 의 `@Roles('editor')` 미달) | 403
  - `OWNER_REQUIRED` | Owner 권한 필요 | 워크스페이스 Owner 역할 필요(`RolesGuard` 의 `@Roles('owner')` 미달 · 워크스페이스 삭제 · 소유권 이전) | 403 — **지금 spec 어디에도 없는데 코드 · frontend(소유권 이전 토스트)가 쓴다**
- §1.3 «`X-Workspace-Id` 3분기» (3): «헤더 형식 유효하나 비멤버 → `RolesGuard` 의 **코드 없는 403**»(wire 로는 필터 기본값
  `FORBIDDEN`) → «… → `RolesGuard` 의 **`NOT_A_MEMBER`(403)**». 그 뒤의 «(3)에 전용 error code 를 붙이지 않는 이유는 …» 문장은 «가드 거부는 전 경로가 함께 코드를
  갖는다 — [data-flow §Rationale «가드 거부의 오류 코드»]» 로 교체.

### C-3. `spec/5-system/1-auth.md`

- §1.5.4(초대 발송 · 재발송 · 취소) 권한 실패의 코드: `forbidden` → **`ADMIN_REQUIRED`**. 지금 spec 은 `forbidden`, 코드는
  `admin_required` 로 이미 어긋나 있다 — 가드가 먼저 막게 되면 HTTP 응답은 `ADMIN_REQUIRED` 가 된다. 표 아래 «명명 —
  historical-artifact 예외» 각주가 `forbidden` 을 예로 드는 자리도 함께 정리한다(`--spec` `14_38_28` W3). frontend
  (`lib/api/invitations.ts` 의 `INVITATION_ERROR`)는 수락 흐름 코드 넷에만 분기하고 `forbidden` · `admin_required` 로는 분기하지 않는다
  — 이 변경이 frontend 동작을 바꾸지 않는다(2026-09-25 grep).
- 가드 Rationale 을 가리키는 링크 자리에 «경로 파라미터 워크스페이스도 가드가 본다» 를 함께 가리킨다.
- Rationale «부트 캐너리 — `@WorkspaceId` reflection 자가검증» 의 집합 정의(«`@WorkspaceId()` 를 소비하는 라우트») 에 «와
  `@WorkspaceParam(...)` 을 소비하는 라우트» 를 보탠다 — 가드가 인식하는 두 팩토리를 캐너리가 함께 센다(D-1).

### C-4. `spec/conventions/error-codes.md`

- **편집 형태**: 병합 행을 쪼개지 않는다. `forbidden` 은 나열에서 빼고 같은 셀의 «진실 · 이유» 서술에서도 «권한 부족» 을
  덜어낸다(나열만 빼면 셀 안이 어긋난다 — INFO 3). `admin_required` 註는 그 행 «진실» 셀 끝에 한정 문구로 붙인다.
- **동시 편집 주의**: `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` 가 같은 §3 표에 `AbortError` 행 신설을
  겨눈다 — 반영 시 최신본 기준으로 diff 를 다시 본다(`--spec` `14_38_28` W5).
- 소문자 역사적 예외 목록의 **`forbidden` 을 뺀다.** 그 근거 문서로 인용된 `1-auth.md §1.5.4` 의 «권한 부족 → `forbidden`» 은
  코드와 이미 어긋나 있었고(코드는 `admin_required` 를 던진다 — `code: 'forbidden'` 발행처 0건, 2026-09-25 grep), C-3 이 그 행을
  `ADMIN_REQUIRED` 로 고치면 근거도 사라진다.
- `admin_required` 에 註: «2026-09-25 이후 HTTP 로는 나가지 않는다 — 초대 라우트가 `RolesGuard` 의 `@Roles('admin')` 를 거치며
  `ADMIN_REQUIRED` 가 먼저 난다. 서비스 계층의 `admin_required` 는 가드가 빠졌을 때만 닿는 두 번째 선이다.» 그 행의 «별개 코드 …
  의도적 분리» 문장은 `workspace_not_found` · `user_not_found` 두 코드만 지목한다(`admin_required` 는 거기 없다 — `--spec` W3 의 전제를
  원문으로 확인) — 그래서 그 문장은 고치지 않고, `admin_required` 가 HTTP 에서 `ADMIN_REQUIRED` 로 수렴한다는 사실만 위 註로 적는다.

### C-5. `spec/conventions/swagger.md`

§5-4 새 엔드포인트 체크리스트의 `@ApiForbiddenResponse` 항목: «`@Roles(...)` 가 붙었거나 `@WorkspaceId()` 를 소비하는» →
«`@Roles(...)` 가 붙었거나 `@WorkspaceId()` · `@WorkspaceParam(...)` 을 소비하는». 같은 항목의 근거 설명문(«`RolesGuard` 는
`@Roles()` 유무와 무관하게 워크스페이스 멤버십을 항상 검증하므로 … `@WorkspaceId()` 만 쓰는 조회 엔드포인트도 403 을 낼 수
있다») 에도 `@WorkspaceParam(...)` 을 병기한다 — 조건절만 고치면 근거문과 어긋난다. 설명 통일 문구에 코드를 병기: 비멤버 «워크스페이스
멤버가 아님(`NOT_A_MEMBER`)», 역할 미달 «editor 이상 권한 필요(`EDITOR_REQUIRED`)» 형태.

### C-6. `spec/2-navigation/9-user-profile.md`

워크스페이스 설정 엔드포인트 표의 설정 GET «비-멤버 403» → «비-멤버 403 `NOT_A_MEMBER`»(서비스 시절 `FORBIDDEN` 이었다).

### C-7. `spec/2-navigation/6-config.md`

§A.4 «권한» 의 «Editor / Viewer … API 직접 호출 시 403 `FORBIDDEN`» → «… 403 `ADMIN_REQUIRED`». 그 라우트 다섯은 모두
`@Roles('admin')` 다(`auth-configs.controller.ts`) — 지금 wire 코드가 `FORBIDDEN` 인 것은 가드가 코드를 지정하지 않아서다.

### C-8. `spec/5-system/13-replay-rerun.md`

재실행 오류 표의 «403 `RERUN_PERMISSION_DENIED` — RR-PL-06 권한 미충족 (워크스페이스 멤버 아님 / Viewer / 다른 사용자의 실행이고
Owner/Admin 아님)» 을 거부 층별로 가른다:

| 403 | 코드 | 조건 |
| --- | --- | --- |
| 403 | `NOT_A_MEMBER` | 워크스페이스 멤버 아님 (`RolesGuard`) |
| 403 | `EDITOR_REQUIRED` | Viewer (`RolesGuard` — 라우트가 `@Roles('editor')`) |
| 403 | `RERUN_PERMISSION_DENIED` | 다른 사용자의 실행이고 Owner/Admin 아님 (RR-PL-06, 서비스) |

**이 표는 지금도 틀려 있다** — 재실행 라우트는 `@Roles('editor')` 라 비멤버 · Viewer 는 서비스의 `RERUN_PERMISSION_DENIED` 에 닿기
전에 가드의 `FORBIDDEN` 을 받는다. 이 변경이 그 두 칸의 코드를 정하면서 함께 바로잡는다.

같은 문서의 다른 두 자리도 함께(`--spec` `14_38_28` W2): §RR-PL-06 본문(권한 조건 두 줄)에 «첫 조건(멤버 · Editor 이상)은
`RolesGuard` 가 `NOT_A_MEMBER` · `EDITOR_REQUIRED` 로, 둘째 조건(작성자 또는 Owner/Admin)은 서비스가 `RERUN_PERMISSION_DENIED` 로
거부한다» 를 덧붙이고, §7 요약표 «회귀 잠금» 의 «권한 거부 (`RERUN_PERMISSION_DENIED`)» 를 «권한 거부 (`NOT_A_MEMBER` ·
`EDITOR_REQUIRED` · `RERUN_PERMISSION_DENIED`)» 로. chain 조회 표(«권한은 §RR-PL-06 과 동일» 의 403 행)는 **3분기가 아니다** —
그 라우트는 `@Roles()` 없이 `@WorkspaceId()` 만 써서(`executions.controller.ts` `getChain`) 가드는 멤버십만 본다. 기존 행(타인 실행 →
`RERUN_PERMISSION_DENIED`, 서비스)은 그대로 참이고, 헤더를 위조한 비멤버의 가드 거부 `NOT_A_MEMBER` 행 하나만 더한다.

### C-9. `spec/5-system/2-api-convention.md`

«`code` 의 상태코드별 기본값: … 403=`FORBIDDEN` …» 뒤에 한 줄: «`RolesGuard` 의 멤버십 · 역할 거부는 기본값이 아니라 전용 코드를
갖는다([3-error-handling §1.2](./3-error-handling.md)).»

**전수 방법(Critical 대응)** — `RolesGuard` 코드 부여가 전역이므로 spec 에서 역할 · 멤버십 거부의 **코드를 명시한** 자리를 전수로
셌다: `git grep` 으로 «403» 과 역할 어휘가 한 줄에 있고 백틱 코드가 있는 줄 · 표의 403 행 전부. 코드를 명시한 자리는
`1-auth §1.5.4`(C-3) · `13-replay-rerun`(C-8) · `6-config §A.4`(C-7) · `3-error-handling`(C-2) · `12-workspace`(C-1) · `2-api-convention`
(C-9) 여섯이다. **이 전수는 «기존 코드가 stale 해지는 자리» 의 모집단이다** — C-6 · C-7 처럼 코드 없이 «403» 만 적었다가 새로
코드를 병기하는 자리는 별도다(`14_54_55` INFO 1). «403» 만 적은 서술(예: `3-workflow-editor/3-execution.md` «서버도 `@Roles('editor')` 로 403») 은 상태가 그대로라 참이다.
WebSocket `FORBIDDEN`(`6-websocket-protocol`) · 외부 상호작용 토큰 오류는 `RolesGuard` 와 무관하다. e2e 는 403 을 상태로만 단언한다
(30곳, `FORBIDDEN` 코드 단언 0).

## D. 구현 요구 (후속 developer PR — 이 draft 는 spec 만 바꾼다)

1. `@WorkspaceParam('<name>')` 파라미터 데코레이터 + `RolesGuard` 인식(팩토리 identity · 등록 이름). 부트 캐너리
   (`assertWorkspaceIdReflectionWorks`)가 경로 소비자도 센다. 소비자 수가 늘므로 `plan/in-progress/nestjs-v12-coordinated-upgrade.md`
   §C 가 고정한 캐너리 기준값(142, 2026-09-24)을 착지 때 다시 재서 갱신한다(`--spec` `14_38_28` W6).
2. 15곳을 `@WorkspaceParam('id')` 로 — 역할 요구는 서비스와 같게 `@Roles()`.
3. 가드 거부 코드(C-1 (e) 표), 메시지는 서비스 계층과 같은 한국어.
4. **저장소 가드** — `@WorkspaceParam` 도 라우트마다 쓰는 데코레이터라, 이 가드가 opt-in 재발을 닫는 유일한 장치다(부트 캐너리는
   reflection 파손만 막고 «데코레이터를 안 쓴 라우트» 는 못 본다). 밀도는 부트 캐너리와 같게(`--spec` `14_38_28` W1):
   - **스캔 대상**: `codebase/backend/src/**/*.controller.ts` 전부(fixture 제외).
   - **판별 규칙**: `@Param(...)` 로 바인딩된 핸들러 파라미터의 **이름**이 `workspaceId` 이거나 `WorkspaceId` 로 끝나면 위반
     (`targetWorkspaceId` 포함 — 2026-09-25 전수 15곳이 모두 이 규칙에 걸린다). AST 로 본다 — 데코레이터와 식별자가 다른 줄에 걸친다
     (그 전수의 첫 정규식이 `new ParseUUIDPipe()` 의 괄호에서 끊겨 14곳을 놓쳤다).
   - **실패 방향**: fail-closed — 위반이 있으면 CI 실패, 허용목록은 두지 않는다. 가드 자신의 공허성 방지로 «`@WorkspaceParam` 소비
     핸들러 수 > 0» 을 함께 단언한다.
   - **한계(적어 둔다)**: 이름이 규칙 밖(`id` 등)이면 못 본다. 워크스페이스 ID 를 `id` 로 받는 형태가 생기면 이 규칙을 넓힌다.
   - 이름은 기존 `param-uuid-pipe-guard` 와 구분되게(예: `workspace-param-binding`). 그 가드의 스캔 모집단에서 `@WorkspaceParam` 으로
     옮긴 파라미터가 빠지는 것을 기록한다(INFO 6).
5. `leaveWorkspace` · `addMemberByEmail` 인가 선행.
6. frontend 는 지금 403 을 서버 메시지로 표시한다(`ERROR_KO` 에 `FORBIDDEN` · `ADMIN_REQUIRED` · `NOT_A_MEMBER` 매핑 없음). 새 코드를
   사용자 노출 코드로 등재할지는 구현 PR 이 정한다 — 등재하면 `ERROR_KO` 와 `backend-labels.test.ts` 의 `LOCALIZED_ERROR_CODES` 를 함께.
   단 그 등재는 트래커 항목 «`ERROR_KO` 의 API 에러 코드 매핑을 아무도 읽지 않는다»(읽기 배선의 프로덕션 호출부 0건)와 독립으로
   완결되지 않는다 — 등재해도 표시되지 않을 수 있다(`--spec` `14_38_28` W7).
7. e2e: 라우트 클래스(멤버 · Admin · Owner)마다 비멤버 `NOT_A_MEMBER` · 부재 워크스페이스도 같은 응답 · 역할 미달 코드 · 형식 파손
   400 · nil UUID 403 · 헤더 위조 `NOT_A_MEMBER`.
8. `roles.guard.ts` docstring 의 «가드 거부에 코드를 부여하려면 전 경로를 함께 바꿔야 한다(별도 작업)» 를 그 작업이 된 지금 형태로
   고친다(`--spec` `14_38_28` INFO 1). spec 의 새 교차 링크는 가독성을 위해 한 줄로 쓴다(여러 줄 링크의 앵커 검증 사각은 `#1235` 가
   이미 닫았다 — W4).

## Rationale

**왜 구조적 해법인가.** 트래커 스코프 조건과 `data-flow/12-workspace.md` §«멤버십 검증은 가드 1곳에서» 의 기각 대안(«73개 라우트에
`@Roles('viewer')` 부착 — 74번째 라우트에서 재발»)이 라우트별 패치를 이미 기각했다. 선택지 1(오라클 2곳만 서비스에서)은 그
패턴의 연장이라 사용자가 택하지 않았다.

**왜 코드를 붙이나(선택지 2 기각).** 가드로 옮기기만 하면 경로 라우트 13곳의 거부 본문이 서비스의 코드에서 코드 없는 403 으로
바뀐다. frontend 는 `OWNER_REQUIRED` 로 소유권 이전 토스트를 가른다(`workspace/settings/page.tsx`). 기존 가드 docstring 이 «가드
거부에 코드를 부여하려면 전 경로를 함께 바꿔야 한다(별도 작업)» 고 적어 둔 그 작업을 이번에 함께 한다.

**비멤버 코드를 하나로.** 두 규칙을 견줬다 — (가) «라우트 요구의 코드»(비멤버도 Admin 라우트에선 `ADMIN_REQUIRED`) ·
(나) «비멤버는 항상 `NOT_A_MEMBER`, 멤버의 역할 미달만 역할 코드». (가)는 경로 라우트의 서비스 시절 본문을 비멤버까지 그대로
두지만, 헤더 위조 거부가 `editor` 라우트 66곳에서 `EDITOR_REQUIRED` 가 된다 — 비멤버에게 «editor 권한이 필요하다» 는 틀린
진술이고, frontend 가 «이 워크스페이스에 더는 속하지 않는다» 를 알아챌 단일 신호를 잃는다. (나)를 택했다. 대가는 경로 라우트 중
Admin/Owner 요구 **10곳**(Admin 8 — `update` · `updateSettings` · `addMember` · `updateMember` · 초대 넷, Owner 2 — `remove` ·
`transferOwnership`)에서 **비멤버**가 받는 코드가 바뀌는 것이고, 비멤버는 그 화면에 도달하지 않는다. (15곳 = Admin/Owner 10 + 멤버면
되는 4 — `getSettings` · `leave` · `listMembers` · `removeMember` + 전환 1.)

**부재와 비멤버를 구분하지 않는다.** `getMemberRole` 이 `workspace_member` 만 보므로 둘 다 `NOT_A_MEMBER` 다 — 이것이 경로
라우트의 존재 오라클을 가드 층에서 닫는 성질이다.
