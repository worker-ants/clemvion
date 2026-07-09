---
title: spec 반영 — Manual Trigger 저장 시점 파라미터 스키마 검증(INVALID_TRIGGER_PARAMETERS)
worktree: (unstarted)
started: 2026-07-09
owner: project-planner
status: in-progress
spec_area: spec/4-nodes/7-trigger/1-manual-trigger.md
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

- [ ] `spec/4-nodes/7-trigger/1-manual-trigger.md` §6 에러코드 표: `invalid_schema`
      행의 "처리 위치" 에 **저장 시점(`POST /:id/save`, `workflows.service.ts
      validateManualTrigger`)** 발행 경로 추가 — 실행 경로 전용이 아님을 명시.
      단, `restoreVersion` 은 예외(과거 스냅샷 복원은 게이트 skip)임을 함께 기재.
- [ ] `spec/data-flow/11-workflow.md` `POST /:id/save` 시퀀스: `400
      INVALID_TRIGGER_PARAMETERS` 분기 추가.
- [ ] `spec/data-flow/10-triggers.md` L44-47 / `spec/5-system/3-error-handling.md`
      L155: 저장 경로도 동일 코드/헬퍼를 쓴다는 서술로 정정.
- [ ] `spec/4-nodes/7-trigger/1-manual-trigger.md` frontmatter `code:` glob 에
      `codebase/backend/src/modules/workflows/workflows.service.ts` 포함 검토
      (저장 시점 검증 코드 링크) — convention_compliance WARNING.
- [ ] (rationale_continuity WARNING) `restoreVersion` 이 저장 게이트를 skip 하는
      비대칭을 해당 spec 의 `## Rationale` 에 근거 기재.
- [ ] (user_guide_sync WARNING, re-review) 유저 가이드
      `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` + `.en.mdx` 의
      Callout 이 파라미터 이름 검증을 "실행 시점에만 거부" 로 읽히게 stale — 저장
      시점(`Save`)에도 즉시 거부됨을 반영(프론트 inline 에러 UI 포함).

## 비고

전부 WARNING(비차단) — impl-done consistency `BLOCK: NO`. 코드는 이미 머지 가능
상태이며 본 항목은 spec 문서 완결성 후속.
