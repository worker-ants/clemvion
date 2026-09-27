---
title: "spec draft 2 — 1-workflow-list 의 소속 검사 서술을 구현 전 상태에 맞춘다 (pending_plans · 시제 · 경로)"
status: in-progress
owner: project-planner
worktree: cross-workspace-refs
spec_impact:
  - spec/2-navigation/1-workflow-list.md
started: 2026-09-27
---

# spec draft 2 — `1-workflow-list.md` 소정정

`--impl-prep` 재실행(`review/consistency/2026/09/27/20_21_21`)이 **BLOCK: YES**(Critical 1)다. 직전 planner 턴(`a8bfd1492`, draft
`plan/complete/spec-draft-cross-workspace-refs.md`)이 `spec/2-navigation/1-workflow-list.md` 에 넣은 서술이 **구현보다 먼저** 착지했는데:

- frontmatter `pending_plans:` 에 책임 plan 이 없다(`status: partial` 문서의 미구현 surface 는 `pending_plans` 로 추적 —
  `spec/conventions/spec-impl-evidence.md` §2.1).
- `## Rationale` §3 의 정정 단락이 아직 없는 `plan/complete/cross-workspace-refs.md` 를 인용하며 «더했다» 로 완료형이다.

## 변경안

1. frontmatter `pending_plans:` 에 `plan/in-progress/cross-workspace-refs.md` 를 더한다. §4 가드(`spec-pending-plan-existence.test.ts`)는
   in-progress 경로를 complete 로 치환해서도 찾으므로, 같은 PR 끝에서 plan 이 `complete/` 로 옮겨져도 이 항목은 유효하다.
2. `## Rationale` §3 정정 단락의 끝 문장을
   «`plan/in-progress/cross-workspace-refs.md` 가 생성에도 소속 검사를 더한다(같은 PR — spec 과 코드가 함께 착지) — 규칙은 데이터 모델
   §1.1.» 로 바꾼다(경로는 위 `pending_plans` 와 같은 표기, 시제는 현재형).

## Rationale

- **«(Planned)» 라벨을 달지 않는다** (같은 세션 W1): spec 과 코드가 **같은 PR** 로 착지하므로 라벨은 머지 순간 거짓이 되고 지우려면
  planner 턴이 한 번 더 필요하다. 미구현 기간의 추적은 `pending_plans` 가 맡는다 — 같은 문서가 이미 그 방식으로 `marketplace-and-plugin-sdk`
  를 추적한다.
- **W2**(PATCH `details[].field='parentId'` 가 현재 코드와 다름) — 구현 plan §처방이 «폴더 PATCH `parentId` 의 기존 거부도 같은 배열
  `details` 를 싣는다» 로 이미 적는다. spec 은 목표 상태다.
- **W3 · INFO 1**(트리거 · 스케줄 · 알림 규칙 API 문서에 §1.1 미러가 없음) — 규칙의 SoT 는 데이터 모델 §1.1 이고 그 문서들은 이 검사를
  부정하지 않는다. 한 줄 미러는 구현이 착지한 **뒤** planner 항목으로 넘긴다(지금 넣으면 세 문서에도 `pending_plans` 가 필요해진다) —
  트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 등재.
- **W4**(트래커가 «닫음» 을 아직 없는 경로로 적음) — `plan/**` 라 developer 가 고친다(«진행 — 이 PR» 로 낮추고 완료 커밋에서 «닫음»).
