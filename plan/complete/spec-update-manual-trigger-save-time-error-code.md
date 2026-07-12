---
title: spec 반영 — Manual Trigger 저장 시점 파라미터 스키마 검증(INVALID_TRIGGER_PARAMETERS)
worktree: spec-update-manual-trigger-savetime-7f7f2d
started: 2026-07-09
owner: project-planner
status: complete
spec_area: spec/4-nodes/7-trigger/1-manual-trigger.md
spec_impact:
  - spec/4-nodes/7-trigger/1-manual-trigger.md
  - spec/data-flow/11-workflow.md
  - spec/data-flow/10-triggers.md
  - spec/5-system/3-error-handling.md
---

## 배경

`manual-trigger-default-param` 구현(PR: fix(manual-trigger) …)이 `saveCanvas` 에
저장 시점 파라미터 스키마 검증을 추가했다: `validateManualTrigger()` 가
`config.parameters` 구조 위반 시 `400 INVALID_TRIGGER_PARAMETERS`
(`details[]` 포함) 를 발행한다(spec §6 이 "handler.validate (저장 시점)" 로
규정한 검증을 실제 이행). 이 코드는 기존에 실행 경로(`POST /:id/execute`)에서만
문서화돼 있어, ai-review(W5) + consistency-check(cross_spec/convention/naming)
가 문서 미반영을 WARNING 으로 지적했다. **코드/이름 변경 불요 — 순수 문서 갱신.**

## 반영 대상 (project-planner)

- [x] `spec/4-nodes/7-trigger/1-manual-trigger.md` §6 에러코드 표: `invalid_schema`
      행의 "처리 위치" 에 **저장 시점(`POST /:id/save`, `workflows.service.ts
      validateManualTrigger`)** 발행 경로 추가 — 실행 경로 전용이 아님을 명시.
      단, `restoreVersion` 은 예외(과거 스냅샷 복원은 게이트 skip)임을 함께 기재.
- [x] `spec/data-flow/11-workflow.md` `POST /:id/save` 시퀀스: `400
      INVALID_TRIGGER_PARAMETERS` 분기 추가.
- [x] `spec/data-flow/10-triggers.md` L44-47 / `spec/5-system/3-error-handling.md`
      L155: 저장 경로도 동일 코드/헬퍼를 쓴다는 서술로 정정.
- [x] `spec/4-nodes/7-trigger/1-manual-trigger.md` frontmatter `code:` glob 에
      `codebase/backend/src/modules/workflows/workflows.service.ts` 포함 검토
      (저장 시점 검증 코드 링크) — convention_compliance WARNING.
- [x] (rationale_continuity WARNING) `restoreVersion` 이 저장 게이트를 skip 하는
      비대칭을 해당 spec 의 `## Rationale` 에 근거 기재.
- [x] (user_guide_sync WARNING) 유저 가이드
      `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` + `.en.mdx`
      Callout 을 저장 시점(`Save`) 거부 + 프론트 inline 에러로 갱신 — **same-turn
      처리 완료**(developer 소관 codebase content).
- [x] (re-review W5) spec §6 표·코드 주석의 "handler.validate (저장 시점)" 표현이
      실제로는 `WorkflowsService.validateManualTrigger()` 가 `validateTriggerParameterSchema`
      를 직접 호출하는 우회 구현임을 각주로 명시(네이밍 정정).

## 비고

전부 WARNING(비차단) — impl-done consistency `BLOCK: NO`. 코드는 이미 머지 가능
상태이며 본 항목은 spec 문서 완결성 후속.
