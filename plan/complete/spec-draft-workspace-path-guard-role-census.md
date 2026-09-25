---
title: 경로 워크스페이스 가드 — `@Roles` 라우트 수 실측 정정
status: complete
owner: project-planner
worktree: workspace-path-guard
spec_impact:
  - spec/data-flow/12-workspace.md
started: 2026-09-25
---

# 경로 워크스페이스 가드 — `@Roles` 라우트 수 실측 정정

같은 PR 의 spec 커밋 `e2e257707` 이 `spec/data-flow/12-workspace.md` §Rationale «가드 거부의 오류 코드» 에 «`@Roles()` 가 붙은 모든
라우트(2026-09-25 실측: `editor` 66 · `admin` 9 · `owner` 7 · `viewer` 5)» 와 «`editor` 라우트 66곳» 을 적었다. `/ai-review` 5라운드
(`review/code/2026/09/25/18_19_47` documentation WARNING)가 CHANGELOG 의 같은 수치를 짚었고, 다시 쟀더니 **결정 당시(main) 값부터 틀렸다**.

## 실측 (2026-09-25, AST — 주석 · 문자열 제외, `*.spec.ts` · `__tests__` · `__test-utils__` 제외)

`@Roles(...)` 데코레이터를 메서드 · 클래스에서 세고 최소 요구 역할로 분류했다(스크립트: 이 PR 의 scratch `count_roles.ts` — 여러 역할이면
가장 낮은 역할). 클래스 데코레이터는 0건.

| 기준 | editor | admin | owner | viewer | 합 |
| --- | --- | --- | --- | --- | --- |
| spec 이 적은 값 | 66 | 9 | 7 | 5 | 87 |
| `origin/main`(이 PR 전) | **63** | **9** | **3** | **4** | **79** |
| 이 PR 브랜치(머지 시점) | 63 | 17 | 4 | 4 | 88 |

차이 88 − 79 = 9 는 이 PR 이 경로 라우트에 붙인 `@Roles('admin')` 8 · `@Roles('owner')` 1(`remove`)과 같다 — `transferOwnership` 은 이미
`@Roles('owner')` 였다. spec 값이 어떻게 나왔는지는 재현하지 못했다(정규식으로 세면 주석 속 `@Roles(` 까지 잡힌다 — 추정이지 확인이 아니다).

## 변경 — `spec/data-flow/12-workspace.md` §Rationale «가드 거부의 오류 코드» 두 자리

원문은 취소선으로 남긴다(결정 턴에서 제시한 값이다). 결정은 바뀌지 않는다 — «적용 범위는 전역이다» 와 규칙 (나)의 근거는 수의 크기가
아니라 «전역이라는 사실» · «비멤버에게 editor 권한이 필요하다는 틀린 진술» 이다.

**전 (1)**:

> (2026-09-25 실측: `editor` 66 · `admin` 9 · `owner` 7 · `viewer` 5)와 헤더 위조 거부에 함께 적용된다

**후 (1)**:

> (2026-09-25 실측: ~~`editor` 66 · `admin` 9 · `owner` 7 · `viewer` 5~~ — 정정: 결정 당시 main 기준 `editor` 63 · `admin` 9 · `owner` 3 ·
> `viewer` 4, 합 79. 이 변경이 경로 라우트에 `admin` 8 · `owner` 1 을 붙여 합 88. AST 로 다시 셌다)와 헤더 위조 거부에 함께 적용된다

**전 (2)**:

> 헤더 위조 거부가 `editor` 라우트 66곳에서 `EDITOR_REQUIRED` 가 된다

**후 (2)**:

> 헤더 위조 거부가 `editor` 라우트 ~~66곳~~ 63곳에서 `EDITOR_REQUIRED` 가 된다

## Rationale

- **`--spec` `18_35_55` 결과**: BLOCK: NO. WARNING 1(구현 plan 에 5라운드 미기록)은 구현 plan 라운드 표에 반영했다. INFO 3(frontmatter
  제목 백틱)도 맞췄다.

- **왜 planner 턴인가**: 결정 턴(planner)이 쓴 Rationale 의 실측값이다. 자기-반증형 소정정은 developer 가 쓴 예고 · 트리거 문장에만
  해당하므로 이 정정은 `--spec` 을 거친다.
- **왜 원문을 남기나**: 사용자에게 제시한 결정 근거의 일부였다 — 같은 절이 이미 쓰는 원문 보존 관행(취소선 + 정정문)을 따른다.
- **`plan/complete/spec-draft-workspace-path-guard.md` 의 같은 수치는 고치지 않는다** — 결정 당시 기록이고, 정정은 spec 과 이 draft 가 남긴다.
- **CHANGELOG** 는 spec 이 아니라 이 턴과 별개로 머지 시점 값(88 · 63/17/4/4)으로 고쳤다(«판정과 수치는 main 대비 · 머지 시점»).
