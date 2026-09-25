---
title: spec draft — 경로 파라미터 워크스페이스도 가드가 검사하고, 가드 거부는 코드를 갖는다
worktree: workspace-path-guard
started: 2026-09-25
owner: project-planner
spec_impact:
  - spec/data-flow/12-workspace.md
  - spec/5-system/3-error-handling.md
  - spec/5-system/1-auth.md
  - spec/conventions/error-codes.md
  - spec/conventions/swagger.md
  - spec/2-navigation/9-user-profile.md
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
> **가드는 파이프보다 먼저 돈다.** Nest 는 가드 → 파이프 순이라 가드가 받는 경로 값은 검증 전 원문이다. 가드는 헤더와 같은
> `isUuidShaped` 로 형식만 보고, 형식이 아니면 판정하지 않고 넘긴다 — 뒤의 `ParseUUIDPipe` 가 400 을 내고 핸들러는 돌지 않는다.
> 형식은 맞지만 RFC 밖인 값(nil UUID 등)은 가드가 멤버십을 조회해 **403** 이 된다(종전 `ParseUUIDPipe` 400).
>
> **서비스 계층 검사는 남는다** — HTTP 밖 호출자의 방어선이다. 오라클이 있던 두 메서드(`leaveWorkspace` · `addMemberByEmail`)도
> 인가를 앞으로 옮긴다(가드가 HTTP 에서 먼저 막아도, 가드를 우회하는 호출자에게 같은 오라클이 남지 않게).

**(d) Rationale «`X-Workspace-Id` 헤더 vs `:id` 경로 파라미터 — UUID 검증 강도 비대칭 (2026-08-09)»** 의 «왜 경로 파라미터는 엄격해도
되는가» 문단 끝에 정정을 덧붙인다(원문은 유지 — 워크스페이스가 아닌 `:memberId` · `:invitationId` 에는 여전히 참이다):

> **(2026-09-25 정정 — 워크스페이스 `:id` 에 한해)** «`:id` 는 인가 판정의 입력이 아니라 리소스 지목» 은 워크스페이스 경로
> 파라미터에서 더는 참이 아니다 — 위 «경로 파라미터 워크스페이스도 가드가 본다» 가 그것을 인가 입력으로 바꿨다. 그래서 가드
> 단계의 술어는 헤더와 같은 `isUuidShaped` 이고(인가 결과 403 을 형식 오류 400 으로 바꾸지 않는다는 위 원리 그대로),
> `ParseUUIDPipe` 는 가드 **뒤**에서 형식 파손만 400 으로 거른다. 표의 «워크스페이스 `:id` 경로 파라미터» 행은 두 단계가 된다.

**(e) Rationale 신설 — «가드 거부의 오류 코드 (2026-09-25)»**:

> 위 절들은 가드 거부를 **코드 없는 403** 으로 뒀다 — 새 경로에만 코드를 붙이면 같은 실패가 경로에 따라 다른 본문을 낸다는
> 이유였다. 경로 라우트를 가드로 옮기면 그 라우트들이 서비스에서 내던 코드(`NOT_A_MEMBER` · `ADMIN_REQUIRED` · `OWNER_REQUIRED`)가
> 코드 없는 403 으로 바뀐다. 그래서 **가드의 모든 멤버십 · 역할 거부에 함께 코드를 붙인다**:
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
> 가드 거부 중 **코드를 붙이지 않는 두 자리**가 남는다 — 미인증 요청이 `@Roles()` 라우트에 닿는 경우(`JwtAuthGuard` 가 먼저
> 401 을 내므로 실제로 닿지 않는다)와, `@Roles()` 라우트에 워크스페이스 컨텍스트가 전혀 없는 경우(가입 직후에도 토큰이 personal
> 워크스페이스를 갖는다). 도달 경로가 없어 이 결정의 범위 밖이다.

### C-2. `spec/5-system/3-error-handling.md`

- §1.2 표 `ADMIN_REQUIRED` 행 설명: «…(`WorkspacesService.assertAdmin()` 발행)» → «…(`RolesGuard` 의 `@Roles('admin')` 미달 ·
  `WorkspacesService.assertAdmin()` 발행)».
- §1.2 표 `NOT_A_MEMBER` 행 설명에 «`RolesGuard` 의 멤버십 거부(헤더 위조 · 경로 워크스페이스 · 부재 워크스페이스 구분 없음)» 추가.
- §1.2 표에 행 둘 추가:
  - `EDITOR_REQUIRED` | Editor 권한 필요 | 워크스페이스 Editor 이상 역할 필요 시 발행되는 `FORBIDDEN` 의 컨텍스트 특화 코드(`RolesGuard` 의 `@Roles('editor')` 미달) | 403
  - `OWNER_REQUIRED` | Owner 권한 필요 | 워크스페이스 Owner 역할 필요(`RolesGuard` 의 `@Roles('owner')` 미달 · 워크스페이스 삭제 · 소유권 이전) | 403 — **지금 spec 어디에도 없는데 코드 · frontend(소유권 이전 토스트)가 쓴다**
- §1.3 «`X-Workspace-Id` 3분기» (3): «헤더 형식 유효하나 비멤버 → `RolesGuard` 의 **코드 없는 403**» → «… → `RolesGuard` 의
  **`NOT_A_MEMBER`(403)**». 그 뒤의 «(3)에 전용 error code 를 붙이지 않는 이유는 …» 문장은 «가드 거부는 전 경로가 함께 코드를
  갖는다 — [data-flow §Rationale «가드 거부의 오류 코드»]» 로 교체.

### C-3. `spec/5-system/1-auth.md`

- §1.5.4(초대 발송 · 재발송 · 취소) 권한 실패의 코드: `forbidden` → **`ADMIN_REQUIRED`**. 지금 spec 은 `forbidden`, 코드는
  `admin_required` 로 이미 어긋나 있다 — 가드가 먼저 막게 되면 HTTP 응답은 `ADMIN_REQUIRED` 가 된다.
- 가드 Rationale 을 가리키는 링크 자리에 «경로 파라미터 워크스페이스도 가드가 본다» 를 함께 가리킨다.

### C-4. `spec/conventions/error-codes.md`

소문자 역사적 예외 목록의 `admin_required` 에 註: «2026-09-25 이후 HTTP 로는 나가지 않는다 — 초대 라우트가 `RolesGuard` 의
`@Roles('admin')` 를 거치며 `ADMIN_REQUIRED` 가 먼저 난다. 서비스 계층의 `admin_required` 는 HTTP 밖 호출자 방어선으로 남는다.»

### C-5. `spec/conventions/swagger.md`

§5-4 새 엔드포인트 체크리스트의 `@ApiForbiddenResponse` 항목: «`@Roles(...)` 가 붙었거나 `@WorkspaceId()` 를 소비하는» →
«`@Roles(...)` 가 붙었거나 `@WorkspaceId()` · `@WorkspaceParam()` 을 소비하는». 설명 통일 문구에 코드를 병기: 비멤버 «워크스페이스
멤버가 아님(`NOT_A_MEMBER`)», 역할 미달 «editor 이상 권한 필요(`EDITOR_REQUIRED`)» 형태.

### C-6. `spec/2-navigation/9-user-profile.md`

워크스페이스 설정 엔드포인트 표의 설정 GET «비-멤버 403» → «비-멤버 403 `NOT_A_MEMBER`»(서비스 시절 `FORBIDDEN` 이었다).

## D. 구현 요구 (후속 developer PR — 이 draft 는 spec 만 바꾼다)

1. `@WorkspaceParam(name)` 파라미터 데코레이터 + `RolesGuard` 인식(팩토리 identity · 등록 이름). 부트 캐너리
   (`assertWorkspaceIdReflectionWorks`)가 경로 소비자도 센다.
2. 15곳을 `@WorkspaceParam('id')` 로 — 역할 요구는 서비스와 같게 `@Roles()`.
3. 가드 거부 코드(C-1 (e) 표), 메시지는 서비스 계층과 같은 한국어.
4. 저장소 가드: 컨트롤러 핸들러가 워크스페이스 ID 를 `@Param` 으로 바인딩하지 않는다.
5. `leaveWorkspace` · `addMemberByEmail` 인가 선행.
6. frontend `ERROR_KO` 에 `EDITOR_REQUIRED` (user-facing 코드 매핑 가드).
7. e2e: 라우트 클래스(멤버 · Admin · Owner)마다 비멤버 `NOT_A_MEMBER` · 부재 워크스페이스도 같은 응답 · 역할 미달 코드 · 형식 파손
   400 · nil UUID 403 · 헤더 위조 `NOT_A_MEMBER`.

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
