---
title: spec fix draft — swagger.md §5-4 "@Roles() 전제" 가 RolesGuard 재구성으로 깨짐
worktree: spec-small-followups
started: 2026-08-08
owner: project-planner
status: complete
priority: P2
spec_impact:
  - spec/conventions/swagger.md
---

## Overview

[`auth-workspace-membership-guard`](../complete/auth-workspace-membership-guard.md) 의 ai-review
(`review/code/2026/08/08/20_53_48`) WARNING #10 (API_CONTRACT / DOCUMENTATION) 을 처리하기
위한 spec 정정 draft. `spec/conventions/` 편집은 developer 권한 밖(CLAUDE.md: `spec/` 는
project-planner 트랙)이라 별도 draft 로 분리했다. `resolution-applier` 가 코드 쪽
(`@ApiForbiddenResponse` 부착)은 같은 PR 안에서 이미 처리했다 — 이 draft 는 규약 **문구**
확장만 다룬다.

## 분류

spec 결함 — `swagger.md §5-4` 체크리스트가 "`@Roles(...)` 가 붙은 엔드포인트만
`@ApiForbiddenResponse` 를 요구"한다는 **전제**로 적혀 있는데, 이번 P0 보안 fix
(`RolesGuard` 재구성, `d194fd72e`·`33c19abda`)로 그 전제가 깨졌다. 구현이 의도적으로 spec 을
개선한 SPEC-DRIFT 가 아니라, 보안 fix 의 부수 효과로 **규약 문서 자체가 낡은 케이스**다.

## 원본 발견사항

> SUMMARY#10 (API_CONTRACT / DOCUMENTATION): `swagger.md §5-4` 규약이 "`@Roles()` 가 붙은
> 엔드포인트만 `@ApiForbiddenResponse` 요구"를 전제하는데, 이번 fix 로 `@Roles()` 없이
> `@WorkspaceId()` 만 쓰는 라우트도 403 가능해져 전제가 깨짐 — 해당 규약 확장이 plan 에
> 미완료로 추적 중
>
> 위치: `spec/conventions/swagger.md:325`, 예: `edges.controller.ts` `findByWorkflow`,
> `nodes.controller.ts` `findByWorkflow`
>
> 제안: planner 턴에서 규약 문구를 "`@Roles()` 또는 `@WorkspaceId()` 를 소비하는
> 엔드포인트"로 확장 + 해당 라우트에 `@ApiForbiddenResponse` 부착 판정

plan 체크리스트(`auth-workspace-membership-guard.md` 2026-08-08 2차 impl-prep W1)가 이미 같은
갭을 "(a) 코드 = developer / (b) 규약 문구 = planner 트랙, 별 턴 필요"로 2파트로 나눠 추적 중이었다.
이 draft 는 그 (b) 파트를 처리한다.

## 실측 — 이번 fix 로 실제 깨진 전제 범위

`RolesGuard` 는 이제 `@Roles()` 유무와 무관하게 **`@WorkspaceId()` 를 소비하는 모든 라우트**에서
헤더가 토큰 확정값을 덮어쓸 때 멤버십을 재검증하고, 비멤버면 403 을 낸다
(`codebase/backend/src/common/guards/roles.guard.ts` docstring "두 검사는 독립이다" 참조).
즉 403 가능성은 이제 `@Roles()` 가 아니라 **`@WorkspaceId()` 소비 여부**로 결정된다.

plan 의 2026-08-08 전수 triage(데코레이터 기준 파싱)가 실측한 규모: HTTP 라우트 222건 중
`@WorkspaceId()` 를 소비하면서 `@Roles()` 가 없는 라우트 **73건**(`@Public` 제외, 클래스 레벨
상속 반영).

이 PR 에서 코드 쪽으로 이미 반영한 것 — 이 diff 가 건드린 5개 컨트롤러 안의 12곳
(`edges.controller.ts` `findByWorkflow`, `nodes.controller.ts` `findByWorkflow`,
`executions.controller.ts` `findOne`·`findByWorkflow`, `triggers.controller.ts`
`findAll`·`findOne`·`getHistory`, `knowledge-base.controller.ts` `findAll`·`findOne`·
`embeddingStats`·`findDocuments`·`findDocument`)에 `@ApiForbiddenResponse({ description:
'워크스페이스 멤버가 아님' })` 를 부착했다.

**남은 것**: 나머지 ~61건(73 - 12)은 이 diff 밖 컨트롤러(예: `workflows`, `folders`,
`schedules`, `model-config`, `integrations` 등)에 있다. 이 보안 fix PR 의 diff 를 문서
전용 편집으로 부풀리지 않기 위해 이번 PR 스코프에서 제외했다 — 별도 후속(코드모드 성격의
일괄 Swagger 주석 추가, 아래 제안 참조)으로 처리를 권장한다.

## 제안 변경

`spec/conventions/swagger.md` §5-4 (L321-326) 체크리스트 항목을 다음과 같이 확장한다.

**Before** (L325):
```markdown
- [ ] `@Roles(...)` 가 붙은 엔드포인트는 `@ApiForbiddenResponse` 도 추가
```

**After**:
```markdown
- [ ] `@Roles(...)` 가 붙었거나 `@WorkspaceId()` 를 소비하는 엔드포인트는
      `@ApiForbiddenResponse` 도 추가 — `RolesGuard` 는 `@Roles()` 유무와 무관하게
      워크스페이스 멤버십을 항상 검증하므로([`1-auth.md` §3.3](../../spec/5-system/1-auth.md),
      [`roles.guard.ts`](../../codebase/backend/src/common/guards/roles.guard.ts)
      docstring), `@WorkspaceId()` 만 쓰는 조회 엔드포인트도 403 을 낼 수 있다.
      `@Roles()` 가 있으면 설명에 "editor 이상 권한 필요"처럼 요구 역할을 명시하고,
      `@Roles()` 없이 `@WorkspaceId()` 만 쓰면 "워크스페이스 멤버가 아님"으로 통일한다.
```

Rationale 절 (문서 끝, 신설 또는 기존 절에 추가)에 배경 한 단락:

```markdown
### 5-4 확장 배경 (2026-08-08)

종전 §5-4 는 "`@Roles()` 가 있어야 403 이 가능하다"는 opt-in 가드 모델을 전제로 적혔다.
`auth-workspace-membership-guard` PR (보안 CRITICAL fix, `spec/data-flow/12-workspace.md`
§Rationale "멤버십 검증은 가드 1곳에서 — `@Roles()` 와 무관")이 이 모델을 opt-out 불가능한
가드로 재구성하면서 전제가 깨졌다. 이 정정은 그 결과를 규약 문서에 반영하는 것으로,
동작 변경이 아니라 **문서-구현 동기화**다.
```

## 기각된 대안

- **§5-4 를 그대로 두고 개별 라우트에만 예외적으로 부착** — 검토했으나 기각. 규약 문구
  자체가 판단 기준으로 쓰이는데("`@Roles(...)` 가 붙은 엔드포인트는") 실제 403 발생 조건과
  전제가 다르면 다음 신규 라우트 작성자가 규약을 그대로 따라도 계속 갭이 재발한다
  (이 PR 이 고치는 근본 결함과 같은 클래스의 실수 — "사람이 규칙을 기억해야 하는 opt-in"
  구조를 규약 레벨에서 반복하지 않는다).

## 반영 완료 (2026-08-08, planner 턴)

`/consistency-check --spec` **BLOCK: NO** (Critical 0 · WARNING 1 · INFO 9,
`review/consistency/2026/08/08/22_03_09`) 후 `spec/conventions/swagger.md` 에 반영했다.
검토 지적 3건을 반영해 draft 원안을 수정했다:

- **W1 (naming_collision)** — 신설 Rationale 헤딩을 `### 5-4 …` → **`### §5-4 …`** 로.
  기존 Rationale 헤딩 4개(`§0`·`§1-4`·`§5`)의 `§` 접두 컨벤션을 따르고, 본문 절
  `### 5-4. 새 엔드포인트 체크리스트` 와 grep·목차에서 구분되게 한다.
- **INFO 1·2 (cross_spec·plan_coherence)** — 근거 인용을 `1-auth.md §3.3` → **`data-flow/
  12-workspace.md §Rationale "멤버십 검증은 가드 1곳에서"**` 로 교체. 실측 확인 결과
  §3.3 은 header-first 우선순위만 서술하고 **무조건성을 명문화하지 않는다** — 정본이
  아닌 곳을 근거로 걸면 다음 사람이 §3.3 을 읽고 못 찾는다. 자매 정정 2건
  (`9-user-profile.md`·`11-error-empty-states.md`)이 이미 쓰는 인용 패턴과도 일치한다.
- **INFO 5** — 체크리스트 문구에 "`@Public()` 라우트는 대상 아님" 한 줄 추가.

## 후속 (이 draft 반영 후)

- ~~`resolution-applier` 재호출~~ → **moot (2026-08-10 실측).** 그 절차는 **아직 열려 있는
  세션**을 전제하는데, 원 PR `#1103` 은 2026-08-08 에 머지됐고 그 plan 도 이미
  `complete/` 에 있다. `RESOLUTION.md` 에 spec 반영 사실이 이미 2회 언급돼 있는 것도 확인했다
  (`review/**` 는 시점 기록이라 소급 갱신 대상이 아니다).
- ~~나머지 ~61개 라우트에 `@ApiForbiddenResponse` 부착 — 별도 plan 분리 권장~~ →
  **이미 승격됨.** [`spec-sync-stop-editor-and-forbidden-routes.md`](./spec-sync-stop-editor-and-forbidden-routes.md)
  §2 가 같은 작업을 실 체크박스로 갖고 있다(전수 스캔 + 코드모드 + 설명 문자열 통일).
  그 문서가 "종전엔 두 plan 의 **산문 권고**로만 있었다 — checker 가 유실 패턴을 지적해
  체크리스트로 승격한다" 고 명시한다. 여기 포인터를 남겨 두지 않으면 이 문서만 읽는 사람이
  "권고했는데 아무도 안 받았나" 로 오인한다.

> **이 plan 이 `in-progress/` 에 오래 남은 이유 (2026-08-10 규명)** — 앞선 세션이
> "미완 체크박스 2건이 남아 있다(실측)" 로 판정해 이동을 보류했는데, 그 2건은
> **코드펜스 안의 Before/After 예시**였다. 펜스를 구분해 재측정하니 **펜스 밖 미완 0건**이다.
> `plan_guard._all_checkboxes_done()` 도 펜스를 구분하지 않는 순수 라인 정규식이라 같은
> 함정을 갖는다(다만 이 문서는 `[x]` 가 0건이라 그 훅은 애초에 발화하지 않았다).
