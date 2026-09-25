---
title: 경로 파라미터 워크스페이스 가드 — impl-prep 경고 후속 spec 정정
status: complete
owner: project-planner
worktree: workspace-path-guard
spec_impact:
  - spec/2-navigation/9-user-profile.md
  - spec/5-system/1-auth.md
  - spec/5-system/2-api-convention.md
  - spec/conventions/swagger.md
  - spec/conventions/error-codes.md
started: 2026-09-25
---

# 경로 파라미터 워크스페이스 가드 — impl-prep 경고 후속 spec 정정

같은 PR 의 spec 커밋 `e2e257707`(planner) 뒤 구현 착수 전 `--impl-prep`(`review/consistency/2026/09/25/15_15_21`, BLOCK: NO)이
남긴 경고 중 **spec 쓰기가 필요한 셋**과 INFO 하나를 정정한다. 구현 plan: `plan/in-progress/workspace-path-guard-impl.md` §`--impl-prep` 경고 처리.

## 변경 1 — `spec/2-navigation/9-user-profile.md` §3 (W1, cross_spec)

`e2e257707` 이 `data-flow/12-workspace.md` «URL slug = FE 라우팅 SoT» 절에 «경로 파라미터로 워크스페이스를 받는 라우트는 이 모델의 예외다»
를 보탰는데, 같은 취지를 인용해 반복하는 이 줄은 «불변» 단언을 그대로 두었다.

**전**:

> - backend 인가 모델은 **불변**: header-first(`X-Workspace-Id`) → 토큰 클레임(`activeWorkspaceId`). URL slug 는 FE 라우팅 SoT 일 뿐 **backend 인가 SoT 가 아니다**(계층 분리 — [data-flow/12-workspace.md](../data-flow/12-workspace.md) Rationale).

**후**:

> - backend 인가 모델은 **불변**: header-first(`X-Workspace-Id`) → 토큰 클레임(`activeWorkspaceId`). URL slug 는 FE 라우팅 SoT 일 뿐 **backend 인가 SoT 가 아니다**(계층 분리 — [data-flow/12-workspace.md](../data-flow/12-workspace.md) Rationale). (2026-09-25) 단, 경로 파라미터로 워크스페이스를 받는 라우트(`/api/workspaces/:id/...` · 전환 `POST /api/auth/workspaces/:id/switch`)는 예외다 — 경로 값이 인가 대상이고 헤더 · 토큰은 쓰지 않는다([data-flow §Rationale "경로 파라미터 워크스페이스도 가드가 본다"](../data-flow/12-workspace.md#경로-파라미터-워크스페이스도-가드가-본다-2026-09-25)). 이 화면의 slug 해소와는 무관한 backend 계층의 예외다.

## 변경 2 — `spec/5-system/1-auth.md` §부트 캐너리 (b) (W2, rationale_continuity)

(a) 는 `e2e257707` 이 «2026-09-25 부터는 같은 방식으로 `@WorkspaceParam(...)` 소비도 판별한다» 로 갱신했는데, (b) 의 결론 문장 «캐너리는
호출부에 아무것도 요구하지 않으면서 같은 위험을 닫는다» 는 그대로다. `@WorkspaceParam` 은 호출부의 새 바인딩 규율이다 — 그 긴장을
12-workspace 가 해소한 논거로 역참조한다. 원문은 남긴다(참이던 서술이고, 헤더 · 토큰 모델에는 지금도 참이다).

**전** (마지막 문장):

> 캐너리는 호출부에 아무것도 요구하지 않으면서 같은 위험을 닫는다.

**후**:

> 캐너리는 호출부에 아무것도 요구하지 않으면서 같은 위험을 닫는다.
> (2026-09-25 보탬) 경로 파라미터 워크스페이스는 이 문장의 예외다 — 핸들러가 `@Param` 대신 `@WorkspaceParam(...)` 으로 받아야 가드가
> 인식한다. 이것을 이 절이 재기각한 opt-in 마커로 보지 않는 논거(값 바인딩 **그 자체**라 빠뜨리면 핸들러가 값을 못 받는다 · 빠뜨릴 수
> 있는 «같은 값을 평범한 `@Param` 으로 받는 것» 은 저장소 가드 `workspace-param-binding` 이 막는다 · 이름 규칙 밖은 못 보는 한계)는
> [data-flow §Rationale "경로 파라미터 워크스페이스도 가드가 본다"](../data-flow/12-workspace.md#경로-파라미터-워크스페이스도-가드가-본다-2026-09-25) 에 있다.

## 변경 3 — frontmatter `code:` 에 가드 등재 (W3, convention_compliance)

`spec-impl-evidence.md` §2.1 — `code:` 는 spec 이 약속한 surface 의 구현 경로다. 2026-09-25 실측: 이 PR 이 만들거나 고친 저장소 가드
셋이 **어느 spec 의 `code:` 에도 없다**(`grep -rn` 0건 — checker 는 «기존 가드는 예외 없이 등재» 라 적었으나 이 둘도 빠져 있었다).

- `spec/5-system/1-auth.md` — RBAC 가드 쪽 셋:
  - `codebase/backend/src/repo-guards/__tests__/workspace-param-binding*.ts` (신설 — 가드 본체 · 스펙)
  - `codebase/backend/src/repo-guards/__tests__/fixtures/workspace-param-binding/**` (대조군 fixture — 없으면 술어가 죽어도 통과한다. `swagger.md` 가 fixture 를 등재한 것과 같은 이유)
  - `codebase/backend/src/repo-guards/__tests__/workspace-roles-attachment.spec.ts` (기존 — `RolesGuard` 전역 등록 · 핸들러별 `@Roles` 고정. 이 PR 이 경로 15곳 표를 더했다)
- `spec/conventions/swagger.md` — `param-uuid-pipe` 가드는 §5-4 의 `@ApiParam({format:'uuid'})` 축을 강제한다:
  - `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe*.ts`
  - `codebase/backend/src/repo-guards/__tests__/fixtures/param-uuid-pipe/**`

## 변경 4 — `spec/conventions/error-codes.md` §5 머리말 (INFO 1, rationale_continuity)

`e2e257707` 이 §3 에서 `forbidden` 을 지우며 §5 로 옮기지 않았다 — 발행 이력이 없던 spec-drift 라 rename 이 아니기 때문이다. 그 기준을 §5
머리말에 적어 선례로 남긴다(«즉흥적 예외» 로 읽히지 않게).

**추가** (§5 첫 문단 뒤):

> **발행된 적 없는 코드는 이 표에 오지 않는다.** 코드베이스가 한 번도 내지 않았는데 spec 표에만 등재돼 있던 코드(spec-drift)는 rename
> 이 아니라 기록 오류다 — 등재 자체를 지우고, 지운 자리의 비고에 실측을 남긴다(예: 2026-09-25 `forbidden` — `code: 'forbidden'`
> 발행처 0건. 처리 기록은 §3 초대 모듈 코드 행의 비고에 있다).

## 변경 5 — `spec/5-system/2-api-convention.md` §2.3 (`--spec` `15_50_10` cross_spec WARNING 반영)

변경 1 과 같은 전파 누락의 세 번째 자리다 — `--spec` 이 잡았다. §2.3 은 «모든 리소스 API» 전칭으로 header-first → 토큰 클레임 모델을
서술한다. `e2e257707` 은 이 파일의 에러 코드 기본값 문단만 고쳤다.

**추가** (§2.3 첫 문단 끝, «…SoT 는 [`data-flow/12-workspace.md §1.5`](../data-flow/12-workspace.md).» 뒤):

> (2026-09-25) **예외 — 경로 파라미터로 워크스페이스를 받는 라우트**(`/api/workspaces/:id/...` · `POST /api/auth/workspaces/:id/switch`)는
> 경로 값이 인가 대상이고 헤더 · 토큰 컨텍스트를 쓰지 않는다([data-flow §Rationale "경로 파라미터 워크스페이스도 가드가 본다"](../data-flow/12-workspace.md#경로-파라미터-워크스페이스도-가드가-본다-2026-09-25)).

## Rationale

- **`--spec` `15_50_10` 결과**: BLOCK: NO. WARNING 1(cross_spec — `2-api-convention.md` §2.3 이 같은 모델을 전칭으로 반복)을 변경 5 로
  반영했다. 같은 모델을 인용만 하는 `_layout.md` · `0-dashboard.md` · `10-auth-flow.md` 는 서술을 복제하지 않아 대상이 아니라고 checker 가
  함께 확인했다.
- **왜 이 넷을 한 턴에 묶나**: 전부 `e2e257707` 이 착지시킨 결정의 **전파 누락**이고 새 결정이 아니다. 변경 1 · 2 는 같은 결정을 인용하는
  두 문서가 한쪽만 갱신된 상태, 변경 3 은 그 결정이 만든 가드의 추적 경로, 변경 4 는 같은 커밋의 처리 기준 명문화다.
- **변경 1 이 제품 정의를 바꾸지 않는 이유**: 이 화면의 동작(slug 해소 · URL 우선 reconcile)은 그대로다. 바뀐 것은 이 줄이 인용하는 backend
  계층 서술의 범위이고, 그 범위는 12-workspace 가 이미 정했다 — 미러를 맞춘다.
- **변경 2 에서 원문을 지우지 않는 이유**: 헤더 · 토큰 모델에서 캐너리는 여전히 호출부에 아무것도 요구하지 않는다. 예외를 덧붙이는 것이지
  반증이 아니다 — 12-workspace 가 같은 커밋에서 쓴 «(2026-09-25 보탬)» 각주와 같은 모양으로 둔다.
- **변경 3 의 범위**: checker 는 새 가드 하나만 짚었다. 같은 범주(이 PR 이 건드린 가드인데 `code:` 에 없음)를 전수로 열거하니 셋이다 — 하나만
  등재하면 «짚인 자리만 고친다» 가 된다. 이 PR 이 건드리지 않은 다른 미등재 가드가 있는지는 이 턴의 범위 밖이다(전수 조사는 하지 않았다).
- **기각한 대안**(이 턴에서 견줬다): 변경 3 을 `repo-guards/__tests__/**` 통째 glob 으로 — 저장소의 `code:` 에 등재된 **repo-guard 항목은**
  전부 개별 glob 이고(`swagger.md` 실측, checker 도 같은 관찰을 적었다 — 다른 영역의 디렉터리 glob 까지 부정하는 말이 아니다), 통째 glob 은
  무관한 가드 변경까지 `1-auth` 를 spec-linked 로 만들어 `--impl-done` 스코프를 부풀린다.
- **INFO 반영**(`15_50_10`): 변경 4 에 §3 처리 기록 역참조를 붙였다. 파일명 단/복수(INFO 5)는 이 draft 한 건이라 손대지 않는다.
