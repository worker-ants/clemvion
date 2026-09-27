---
title: "spec draft 2 — 구현 전 착지한 소속 검사 서술을 추적한다 (pending_plans · 시제 · 경로)"
status: in-progress
owner: project-planner
worktree: cross-workspace-refs
spec_impact:
  - spec/2-navigation/1-workflow-list.md
  - spec/3-workflow-editor/0-canvas.md
started: 2026-09-27
---

# spec draft 2 — 구현 전 착지한 서술의 추적(`pending_plans`) · 시제 · 경로

`--impl-prep` 재실행(`review/consistency/2026/09/27/20_21_21`)이 **BLOCK: YES**(Critical 1)다. 직전 planner 턴(`a8bfd1492`, draft
`plan/complete/spec-draft-cross-workspace-refs.md`)이 `spec/2-navigation/1-workflow-list.md` 에 넣은 서술이 **구현보다 먼저** 착지했는데:

- frontmatter `pending_plans:` 에 책임 plan 이 없다(`status: partial` 문서의 미구현 surface 는 `pending_plans` 로 추적 —
  `spec/conventions/spec-impl-evidence.md` §2.1).
- `## Rationale` §3 의 정정 단락이 아직 없는 `plan/complete/cross-workspace-refs.md` 를 인용하며 «더했다» 로 완료형이다.

> **`--spec` 1회차(`review/consistency/2026/09/27/20_35_40`) BLOCK: YES** — 같은 결함(구현 전 현재형 서술 + `pending_plans` 미추적)이
> 같은 원인 커밋 `a8bfd1492` 가 건드린 `0-canvas.md` §11.2.2 에도 있다. 그래서 대상을 그 커밋이 **규칙을 현재형으로 적은 문서 전부**로
> 넓혔다 — 그중 **frontmatter-evidence 가드가 추적하는 문서** 둘(`1-workflow-list.md` · `0-canvas.md`).
>
> **`--spec` 2회차(`20_45_35`) BLOCK: YES** — 2회차 draft 는 `1-data-model.md` 도 `status: partial` + `pending_plans` 로 바꾸며 «§3 이
> 승격을 가드로 강제한다» 를 근거로 댔는데 **거짓이었다**: 그 파일은 가드의 제외 목록(`spec-frontmatter-parse.ts` `EXCLUDE_BASENAMES` —
> `0-overview.md` · `1-data-model.md` · `6-brand.md`, `spec-impl-evidence.md` §1 «제외»)에 있어 네 가드 모두 순회하지 않는다. 그래서
> `1-data-model.md` 는 `data-flow/11-workflow.md` · `data-flow/12-workspace.md` 와 같은 **라이프사이클 비추적** 범주로 두고 frontmatter 를
> 건드리지 않는다 — 셋 모두 규칙을 현재형으로 적고, 구현과 같은 PR 로 착지한다.

## 변경안

1. `spec/2-navigation/1-workflow-list.md` frontmatter `pending_plans:` 에 `plan/in-progress/cross-workspace-refs.md` 를 더한다. §4 가드(`spec-pending-plan-existence.test.ts`)는
   in-progress 경로를 complete 로 치환해서도 찾으므로, 같은 PR 끝에서 plan 이 `complete/` 로 옮겨져도 이 항목은 유효하다.
2. `spec/3-workflow-editor/0-canvas.md` frontmatter `pending_plans:` 에 같은 경로를 더한다(`status: partial` 유지 — 이미
   `ai-agent-tool-connection-rewrite` 가 in-progress 라 이 plan 이 완료돼도 승격 조건이 아니다).
3. `1-workflow-list.md` `## Rationale` §3 정정 단락의 끝 문장을
   «`plan/in-progress/cross-workspace-refs.md` 가 생성에도 소속 검사를 더한다(같은 PR — spec 과 코드가 함께 착지) — 규칙은 데이터 모델
   §1.1.» 로 바꾼다(경로는 위 `pending_plans` 와 같은 표기, 시제는 현재형).

## Rationale

- **«(Planned)» 라벨을 달지 않는다** (`--impl-prep` `20_21_21` W1): spec 과 코드가 **같은 PR** 로 착지하므로 라벨은 머지 순간 거짓이
  되고 지우려면 planner 턴이 한 번 더 필요하다. 미구현 기간의 추적은 `pending_plans` 가 맡는다.
- **plan 경로를 마크다운 링크로 걸지 않는다** (`--spec` `20_35_40` W1): 같은 PR 끝에서 구현 plan 이 `complete/` 로 옮겨지면
  `plan/in-progress/…` 링크가 `spec-link-integrity` 가드에 깨진다. 백틱 경로를 `pending_plans` 와 **같은 in-progress 표기**로 두고, 추적은
  in-progress→complete 치환을 아는 `pending_plans` 가드가 맡는다.
- **W2**(PATCH `details[].field='parentId'` 가 현재 코드와 다름) — 구현 plan §처방이 «폴더 PATCH `parentId` 의 기존 거부도 같은 배열
  `details` 를 싣는다» 로 이미 적는다. spec 은 목표 상태다.
- **W3 · INFO 1**(트리거 · 스케줄 · 알림 규칙 API 문서에 §1.1 미러가 없음) — 규칙의 SoT 는 데이터 모델 §1.1 이고 그 문서들은 이 검사를
  부정하지 않는다. 한 줄 미러는 구현이 착지한 **뒤** planner 항목으로 넘긴다(지금 넣으면 세 문서에도 `pending_plans` 가 필요해진다) —
  트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 등재.
- **W4**(트래커가 «닫음» 을 아직 없는 경로로 적음) — `plan/**` 라 developer 가 고친다(«진행 — 이 PR» 로 낮추고 완료 커밋에서 «닫음»).
- **`--spec` `20_35_40` W2**(트래커가 이 draft 를 아직 없는 `plan/complete/spec-draft-cross-workspace-refs-2.md` 로 인용) — 이 draft 는 적용
  커밋에서 그 경로로 옮겨진다(1차 draft 와 같은 보존 관례). INFO 1(marketplace 선례 인용이 부정확 — 그 항목은 라벨과 `pending_plans` 를
  함께 쓴다) → 선례 문장을 지웠다.
- **`1-data-model.md` frontmatter 는 건드리지 않는다** (`--spec` `20_45_35` Critical): 위 인용 참조. 가드 대상으로 넣으려면
  `EXCLUDE_BASENAMES` 에서 빼는 규약 변경(`spec-frontmatter-parse.test.ts` 의 회귀 단언 포함)이 필요한데, 그것은 이 draft 의 범위가 아니다.
  §1.1 을 구현 plan 에 걸어 두는 추적은 구현 plan 자신(`plan/in-progress/cross-workspace-refs.md` §처방)이 맡는다.
