---
title: 경로 워크스페이스 가드 — 오라클 실측 정정(두 메서드 → 세 메서드)
status: complete
owner: project-planner
worktree: workspace-path-guard
spec_impact:
  - spec/data-flow/12-workspace.md
started: 2026-09-25
---

# 경로 워크스페이스 가드 — 오라클 실측 정정

같은 PR 의 spec 커밋 `e2e257707` 이 `spec/data-flow/12-workspace.md` §Rationale «경로 파라미터 워크스페이스도 가드가 본다» 에
«2026-09-25 실측: … 두 메서드(`leaveWorkspace` · `addMemberByEmail`)가 인가 전에 워크스페이스를 조회해 … 존재 · 유형 오라클» 이라
적었다. 구현 뒤 `/ai-review` 4라운드(`review/code/2026/09/25/17_47_18` requirement WARNING)가 **세 번째**를 찾았다 — `transferOwnership`
은 트랜잭션 안에서 워크스페이스를 먼저 읽어 «없음 404 · 개인 `CANNOT_TRANSFER_PERSONAL` · 팀 비-owner `OWNER_REQUIRED`» 로 갈렸다.
실측으로 확인했다: 비멤버 · 비-owner 멤버 × 부재 · 개인 · 팀 6케이스 테스트가 수정 전 RED 6, 인가 선행을 넣은 뒤 GREEN(커밋
`1f616ef05`). 이 PR 전에는 가드가 `@Roles('owner')` 를 토큰 워크스페이스(누구나 personal 의 owner)로 판정해 HTTP 로도 샜다.

계획 단계 실측이 놓친 이유: 그 표는 «서비스가 인가 전에 조회하는가» 를 셌는데, `transferOwnership` 은 `@Roles('owner')` 가 붙어
가드가 막는 쪽으로 분류됐다 — 그 가드가 경로 워크스페이스를 보지 않는다는 사실(같은 절의 다음 문장)과 교차하지 않았다.

## 변경 — `spec/data-flow/12-workspace.md` §Rationale «경로 파라미터 워크스페이스도 가드가 본다» 두 문장

원문은 취소선으로 남긴다 — 결정 당시의 실측이고, 사용자는 그 실측을 보고 선택했다(아래 «기각된 대안» (1) 의 «2곳» 도 그 시점
기록이라 고치지 않는다).

**전 (1)**:

> 2026-09-25 실측: 인가 누락은 없었으나 두 메서드(`leaveWorkspace` · `addMemberByEmail`)가 인가 **전에** 워크스페이스를 조회해
> 비멤버가 «없음 · 개인 · 팀» 을 구분할 수 있었다(존재 · 유형 오라클).

**후 (1)**:

> 2026-09-25 실측: 인가 누락은 없었으나 ~~두 메서드(`leaveWorkspace` · `addMemberByEmail`)가~~ 세 메서드(`leaveWorkspace` ·
> `addMemberByEmail` · `transferOwnership`)가 인가 **전에** 워크스페이스를 조회해 비멤버가 «없음 · 개인 · 팀» 을 구분할 수 있었다
> (존재 · 유형 오라클). (2026-09-25 정정 — 셋째는 구현 뒤 리뷰가 찾았다: 트랜잭션 안에서 워크스페이스를 먼저 읽어 «없음 404 · 개인
> `CANNOT_TRANSFER_PERSONAL` · 팀 비-owner `OWNER_REQUIRED`» 로 갈렸고, 가드가 토큰 워크스페이스로 판정해 HTTP 로도 닿았다.
> 계획 단계 표는 `@Roles('owner')` 가 붙었다는 이유로 이 메서드를 가드 쪽으로 분류했다.)

**전 (2)**:

> 오라클이 있던 두 메서드도 인가를 앞으로 옮긴다 — 두 번째 선에도 같은 오라클이 남지 않게.

**후 (2)**:

> 오라클이 있던 ~~두~~ 세 메서드도 인가를 앞으로 옮긴다 — 두 번째 선에도 같은 오라클이 남지 않게. 트랜잭션 안에서 락을 잡고
> 재검사하는 자리(`leaveWorkspace` · `transferOwnership`)는 그 재검사를 남기고, 앞에 무락 인가 선행을 둔다.

**전 (3)** (같은 문단, 호출자 실측):

> 이 메서드들의 HTTP 밖 호출자는 없다(2026-09-25 실측: 내부 위임 `removeMember → leaveWorkspace` 하나 — 가드를 거친 HTTP 요청 안이다).

**후 (3)**:

> 이 메서드들의 HTTP 밖 호출자는 없다(2026-09-25 실측: 내부 위임 `removeMember → leaveWorkspace` 하나 — 가드를 거친 HTTP 요청 안이다.
> 셋째 `transferOwnership` 도 재확인했다 — 호출자는 컨트롤러 하나).

(`--spec` `review/consistency/2026/09/25/18_07_58` rationale_continuity WARNING 반영 — 셋째를 편입하면서 이 불변식을 재검증하지 않았다는
지적. 실측: `grep -rn "\.transferOwnership(" codebase/backend/src`(spec 제외) → `workspaces.controller.ts` 1건.)

## Rationale

- **`--spec` `18_07_58` 결과**: BLOCK: NO. WARNING 2 — (1) 위 «후 (3)» 로 반영, (2) 구현 plan 체크리스트 stale 은 그 plan 에서 갱신한다.
  INFO 2(서술 형식)는 아래 문구를 실제 편집 방식에 맞췄다.
- **왜 원문을 지우지 않나**: 결정 턴에서 사용자에게 제시한 실측이 «2곳» 이었다. 그 기록을 덮으면 결정의 근거가 사라진다 — 원문
  보존 원칙(인라인 취소선 + 정정문)을 따른다.
- **결정은 바뀌지 않는다**: 채택안(가드 확장 + 거부 코드)과 «오라클 자리는 서비스도 인가 선행» 원칙은 그대로고, 그 원칙을 적용할
  자리가 하나 늘었을 뿐이다.
- **기각된 대안 (1)** 의 «오라클 2곳만 서비스에서 고친다» 는 결정 당시 문구라 두 번째 정정을 하지 않는다 — 셋이었어도 같은 이유
  («74번째 라우트» 의 라우트별 패치)로 기각됐을 선택지다.
