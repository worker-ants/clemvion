# 신규 식별자 충돌 검토 — spec draft 2 (`cross-workspace-refs`)

## 개요

target(`plan/in-progress/spec-draft-cross-workspace-refs-2.md`)의 "변경안" 3개 항목을 각각 확인했다.

1. `spec/2-navigation/1-workflow-list.md` frontmatter `pending_plans:` 에 `plan/in-progress/cross-workspace-refs.md` 추가
2. `spec/3-workflow-editor/0-canvas.md` frontmatter `pending_plans:` 에 같은 경로 추가
3. `1-workflow-list.md` `## Rationale` §3 "(2026-09-27 정정)" 단락의 끝 문장을 완료형·`plan/complete/…` 경로에서 현재형·`plan/in-progress/…` 경로로 교체

세 항목 모두 **이미 존재하는 plan 경로를 참조·이동**하는 것이며, 새 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·설정키를 하나도 신설하지 않는다. 실제로 실측했다:

- `spec/2-navigation/1-workflow-list.md` frontmatter `pending_plans:` 현재 값은 `plan/in-progress/marketplace-and-plugin-sdk.md`, `plan/complete/workflow-duplicate-nodes-edges.md` 둘뿐 — target 이 더하려는 `plan/in-progress/cross-workspace-refs.md` 와 중복되지 않는다.
- `spec/3-workflow-editor/0-canvas.md` frontmatter `pending_plans:` 현재 값은 `plan/in-progress/ai-agent-tool-connection-rewrite.md`, `plan/complete/spec-sync-canvas-gaps.md` — 마찬가지로 중복 없음.
- `1-workflow-list.md` §3 Rationale 현재 문장(라인 200)은 `plan/complete/cross-workspace-refs.md` 를 인용 중 — target 이 이걸 `plan/in-progress/cross-workspace-refs.md` 로 바꾸는데, 두 경로 모두 **같은 작업**(`worktree: cross-workspace-refs`)을 가리키는 표기 차이일 뿐 별개 식별자의 충돌이 아니다.
- `plan/in-progress/cross-workspace-refs.md` 는 실재하는 구현 plan(현재 진행 중)이고, `plan/complete/cross-workspace-refs.md` 는 실재하지 않는다(`ls` 확인) — 즉 정정 방향(완료형→진행형, complete→in-progress)이 실제 파일 상태와 일치한다.

target 문서 자신의 파일 경로(`plan/in-progress/spec-draft-cross-workspace-refs-2.md`)도 확인했다. 1차 draft `plan/complete/spec-draft-cross-workspace-refs.md` 뒤를 잇는 번호-suffix 명명이며, 저장소에 이미 `plan/complete/spec-draft-chat-channel-drift-3.md` 같은 선례가 있어 동일 작업의 반복 draft에 숫자 suffix 를 붙이는 관례에 부합한다(컨벤션 위반 아님). `plan/complete/spec-draft-cross-workspace-refs-2.md` 는 아직 존재하지 않아 이동 시점 경로 충돌도 없다.

target draft 가 본문에서 언급하는 다른 식별자(`VALIDATION_ERROR`, `details[].code='INVALID_FIELD'`, 데이터 모델 §1.1 "참조의 소속" 등)는 모두 **이 draft 가 신설하는 것이 아니라** 선행 커밋 `a8bfd1492`(직전 planner 턴, 이미 `spec/1-data-model.md` §1.1 · `spec/5-system/2-api-convention.md` 등에 정착)가 도입한 기존 식별자를 그대로 인용한다. `INVALID_FIELD` 는 `codebase/backend/src/nodes/core/error-codes.ts`·`triggers.service.ts`·`validation.pipe.ts` 등 전역에서 이미 쓰이는 기존 에러 코드와 정확히 같은 의미로 재사용되므로 충돌이 아니다(신규 부여도 아님).

## 발견사항

없음 — 이 draft 는 신규 식별자를 도입하지 않는 순수 추적 메타데이터(frontmatter `pending_plans`)·시제/경로 정정 작업이라, 위 6개 점검 관점(요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수/설정키·파일 경로) 중 어느 것도 해당 사항이 없다.

## 요약

target 은 이미 존재하는 구현 plan 경로(`plan/in-progress/cross-workspace-refs.md`)를 두 spec 문서의 `pending_plans:` frontmatter 에 추가하고, 완료형으로 잘못 적혔던 한 문장을 진행형·정확한 경로로 정정하는 것이 전부다. 두 frontmatter 리스트 모두 기존 항목과 중복되지 않고, 인용하는 에러 코드·규칙 링크는 모두 선행 커밋이 이미 정착시킨 기존 식별자의 재사용이다. draft 자신의 파일명(`-2` suffix)도 저장소에 이미 있는 번호-suffix 관례(`spec-draft-chat-channel-drift-3.md`)와 부합해 명명 충돌이나 컨벤션 위반이 없다. 신규 식별자 충돌 관점에서는 지적할 사항이 없다.

## 위험도

NONE
