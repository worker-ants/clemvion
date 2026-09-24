# Cross-Spec 일관성 검토 — `spec/5-system` (impl-done, diff-base=origin/main)

## 검토 범위 확인

- `spec/5-system/**` 자체의 diff 는 0 (정상 — 이번 변경은 spec 을 건드리지 않는 코드 전용 PR).
- 실제 코드 diff(371줄 / 3파일)는 `codebase/backend/src/modules/workspaces/workspaces.service.ts`
  (+`.spec.ts`) · `codebase/backend/test/workspace-rbac.e2e-spec.ts` — `WorkspacesService.removeMember()`
  의 인가 검사 순서를 "대상 조회 → owner 판정 → assertAdmin" 에서 "요청자 멤버십(`NOT_A_MEMBER`)
  → 대상 조회 → self 위임 → admin 판정(`ADMIN_REQUIRED`) → owner 판정(`CANNOT_REMOVE_OWNER`)" 으로
  재배치한 것이다. 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/member-auth-order-8c4d1f`)
  절대경로로 `git diff origin/main`을 직접 확인했다.
- 관련 `plan/in-progress/member-auth-order.md` 와 트래커
  `plan/in-progress/spec-draft-nullable-notation-followups.md` (해당 항목, ~L4848-L4990)를 함께
  읽었다 — 이 변경이 다른 spec 영역(§3.2 RBAC 매트릭스, `data-flow/12-workspace.md`,
  `2-navigation/9-user-profile.md`, `3-error-handling.md`)과 어떻게 맞물리는지 developer 가
  이미 상세히 실측·근거를 남겨 두었다.

## 발견사항

- **[INFO] `3-error-handling.md`·`1-auth.md` 세 줄의 인용 경로가 이번 변경으로 낡았다 — 이미 추적 중**
  - target 위치: (코드) `codebase/backend/src/modules/workspaces/workspaces.service.ts` `removeMember()`
  - 충돌 대상:
    - `spec/5-system/3-error-handling.md:49` — `NOT_A_MEMBER` 발행 경로 열거("전환·탈퇴·멤버십 확인")에
      새 발행처(`removeMember` 의 비-멤버 차단)가 빠짐
    - `spec/5-system/3-error-handling.md:46` — `ADMIN_REQUIRED` 발행처를 `WorkspacesService.assertAdmin()`
      단수로 못박는데, `removeMember` 는 이제 `assertAdmin()` 을 호출하지 않고 `throwAdminRequired()` 를
      직접 던짐
    - `spec/5-system/1-auth.md:551` (§3.2 정정 노트) — "`removeMember()` 는 `assertAdmin(...)` 만
      요구한다" 는 근거 문장이 이제 사실이 아님(결론 "Admin 이 멤버 삭제 가능"은 그대로 참)
  - 상세: 세 곳 모두 **인용된 호출 경로**만 낡았고 최종 동작 계약(Admin+ 삭제 가능·owner 제외)은
    바뀌지 않았다. `spec/` 은 developer 쓰기 범위 밖이라 developer 가 직접 고치지 않고
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 항목으로 이미
    등재했다("`removeMember` 리팩터로 낡은 spec 서술 세 줄", 2026-09-24). 자기-반증형 소정정
    5조건도 함께 점검됐고(`1-auth.md:551` 문장은 developer 본인이 쓴 것이 아니라 §3.2 정정 노트라
    조건1 불충족) planner 턴으로 정확히 라우팅됐다.
  - 제안: 이번 PR 을 막을 이유는 아니다(BLOCK 사유 아님). 다음 planner 턴에서 위 세 줄만 국소
    정정하면 된다 — 별도 조치 불요, 추적 상태 확인 목적으로만 기록.

- **[INFO] 가드 계층이 경로-파라미터 워크스페이스 라우트(`removeMember` 포함 13개)를 커버하지
  않는다는 구조적 갭 — 별도 축으로 이미 분리 등재됨, 이번 diff 의 책임 범위 아님**
  - target 위치: `codebase/backend/src/modules/workspaces/workspaces.controller.ts` (`removeMember`
    등 `@Roles()`/`@WorkspaceId()` 미사용, `@Param('id')` 만 사용하는 13개 라우트)
  - 충돌 대상: `spec/data-flow/12-workspace.md` §"멤버십 검증은 가드 1곳에서 — `@Roles()` 와 무관"
    (2026-08-08) — "적용 범위: 워크스페이스 컨텍스트를 소비하는 인증된 라우트"를
    `@WorkspaceId()` 소비 여부로 **연산적으로** 정의하는데, `removeMember` 류는 워크스페이스
    스코프 리소스를 다루면서도 그 모집단 밖이라 가드 보호를 받지 못한다.
  - 상세: 이는 이번 diff 가 새로 만든 결함이 아니라 기존에 존재하던 가드 커버리지 모델의 구멍이며,
    이번 diff 는 그 구멍 중 `removeMember` **한 곳**만 서비스 계층 재배치로 메웠다(오라클 폐쇄).
    developer 가 §B-2 에서 2026-08-08 결정("73개 라우트 opt-in 마커 재발" 기각 사유)과 이 처방이
    같은 계열로 오인될 위험을 직접 검토했고, "가드가 경로 파라미터도 보게 할 것인가"라는 구조적
    결정을 요구하는 별도 항목(`경로 파라미터로 워크스페이스를 받는 라우트 13개가 가드 층 보호를
    전혀 못 받는다`, 스코프 조건 포함)으로 갈라 등재했다. 이번 PR 자체가 그 13개에 동일 패치를
    복제하는 선례로 오독되지 않도록 조건을 명시해 둔 점도 확인했다.
  - 제안: 조치 불요 — 이미 올바른 축으로 분리·등재. 다음 세션에서 그 항목 착수 시 "구조적 해법 우선"
    조건이 지켜지는지만 확인.

- **[INFO] 새 에러 코드 순서 변경이 다른 spec 서술과 모순되지 않음을 교차 확인**
  - target 위치: `removeMember()` 의 `throwAdminRequired()`/`throwCannotRemoveOwner()` 순서
  - 충돌 대상: `spec/5-system/1-auth.md` §3.2 각주("Admin 의 멤버 삭제는 대상이 Owner 인 경우
    거부된다 `CANNOT_REMOVE_OWNER`" — 주어가 **Admin**), `spec/data-flow/12-workspace.md` §1.6
    표(`owner / admin` 권한, owner 대상 제거 불가), `spec/2-navigation/9-user-profile.md` §4.1/§6.1
    ("제거: Admin+")
  - 상세: 세 문서 모두 "Admin(요청자)이 owner(대상)를 지울 수 없다"만 서술하고 "비-Admin 요청자가
    owner 를 지목했을 때 어떤 코드를 받는가"는 규정하지 않는다. 따라서 이번 변경(비-admin→owner
    지목 시 `CANNOT_REMOVE_OWNER` 대신 `ADMIN_REQUIRED`)은 기존 spec 문장 중 어느 것과도
    직접 모순되지 않는다 — 단지 위 [INFO] 항목의 두 줄(에러 코드 발행처 인용)만 갱신 대상이다.
  - 제안: 없음(정보성 확인).

## 요약

이번 PR 은 `spec/5-system` 을 직접 수정하지 않는 코드 전용 변경(`WorkspacesService.removeMember()`
인가 순서 재배치 — 존재/owner 오라클 폐쇄)이며, RBAC 매트릭스(§3.2)·`data-flow/12-workspace.md`
§1.6·`2-navigation/9-user-profile.md` §4.1/§6.1 이 서술하는 "Admin+ 가 멤버를 제거하되 owner 는
제외" 라는 최종 계약과 **모순되지 않는다**. 재배치로 인해 두 문서의 세 줄(`3-error-handling.md:46,49`,
`1-auth.md:551`)이 인용하는 **호출 경로**가 낡았으나, developer 는 이를 자신의 쓰기 범위 밖으로
정확히 식별해 planner 항목으로 이관했고, 더 큰 구조적 축(경로-파라미터 워크스페이스 라우트 13개의
가드 커버리지 갭)도 2026-08-08 기각된 "라우트별 opt-in" 패턴과 혼동되지 않도록 스코프 조건을 명시해
별도 항목으로 분리해 두었다. CRITICAL/WARNING 급 cross-spec 충돌은 발견되지 않았다.

## 위험도
LOW
