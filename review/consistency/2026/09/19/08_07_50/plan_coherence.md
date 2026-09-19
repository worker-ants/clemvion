# Plan 정합성 검토 — spec/3-workflow-editor/ (--impl-prep)

## 발견사항

- **[WARNING]** `CONTAINER_*` 를 "에러 코드"로 서술 — 이미 등재된 정정 항목이 target 에 반영 안 됨
  - target 위치: `spec/3-workflow-editor/2-edge.md:202` (§6.1 "검증" 행), `spec/3-workflow-editor/0-canvas.md:633,635,636` (§11.2.2 "제약" 표)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` (2026-09-13 등재, 여전히 `- [ ]` 미해소) — "spec 6파일이 `CONTAINER_*` 를 «코드» 로 적는다 — 같은 저장소에 «맞게 적은» 선례가 있다" 항목이 정확히 이 두 파일(`2-edge.md:202` §6.1, `0-canvas.md:636` §11.2.2)을 지목
  - 상세: 실측(`execution-engine.service.ts:8017` `nodeExec.error = { message }`)상 `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT`/`CONTAINER_INVALID_CHILD`/`CONTAINER_CYCLE` 는 **메시지 접두**일 뿐 `.code` 필드로 방출되지 않는다. 그런데 target 은 여전히 "…에러로 실패"(`0-canvas.md:633`), "…에러로 거부"(`:635`), "검증 결과를 코드로"(`2-edge.md:202`) 형태로 서술해 코드처럼 읽힌다. plan 은 이미 처분 방향(정정 형식: `3-loop.md:189-191` 처럼 발행 문자열 전문을 인용하는 방식)까지 선례로 못박아 두었고 결정 자체는 남아 있지 않다 — 순수 실행 누락이다. 같은 클래스의 자매 문서(`4-execution-engine.md`, `4-nodes/1-logic/0-common.md`, `7-map.md`, `9-foreach.md`)도 동일하게 미해소 상태.
  - 제안: target 은 아직 미수정 상태이므로 이번 impl-prep 대상 작업이 이 두 파일을 건드리지 않는다면 그대로 두어도 되나, `pending_plans` frontmatter 에 `spec-draft-nullable-notation-followups.md` 가 빠져 있다(`2-edge.md`·`0-canvas.md` 모두 `ai-agent-tool-connection-rewrite.md`만 등재) — 두 파일 frontmatter 의 `pending_plans` 에 추가할 것. 실제 표현 정정은 그 plan 의 담당 몫.

- **[WARNING]** "강제 중단 (Force) = 즉시 중단" 서술이 이미 지적된 아키텍처 제약과 충돌 — 미해소 상태로 방치
  - target 위치: `spec/3-workflow-editor/3-execution.md:177` (§4 "실행 중단(Stop)" 표, "강제 중단" 행)
  - 관련 plan: `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` §"추가 위임 (2026-07-28 #9)" — "`spec/3-workflow-editor/3-execution.md §4`(`:170-178` 부근) '강제 중단(Force, 3초 이상 누르기)' 서술 — … `#8` 이 명문화한 '진행 중 turn 즉시 중단 불가(깨울 in-memory 코루틴 없음)' 아키텍처 제약과 어긋난다. 미구현/Planned 마커를 붙이거나, 실제 즉시-중단 구현 여부를 결정해 등재할 것" (여전히 `- [ ]`, 2026-07-28 등재 이후 미해소)
  - 상세: 이 plan 의 `#8` 이 이미 `4-execution-engine.md`/`node-cancellation.md` 에 "cancel 은 즉시 끊지 않는다 — turn 경계에서만 관측된다"는 어휘를 확정해 놓았는데, target 의 §4 는 "Stop 버튼 3초 이상 누르기 → 즉시 중단 (Force)"라고 단정해 그 확정된 아키텍처 제약과 정면으로 어긋나는 문장을 그대로 유지한다. plan 은 "미구현/Planned 마커를 붙이거나, 실제 동작을 결정해 등재"하라고 명시했는데 target 은 둘 중 어느 것도 하지 않은 채 결정되지 않은 질문에 대해 암묵적으로 "즉시 중단이 실제로 구현돼 있다"는 답을 내린 상태다.
  - 추가로 `spec/3-workflow-editor/3-execution.md` frontmatter 에는 `pending_plans` 필드 자체가 없어(파일 전체에 없음), 이 문서를 여는 사람이 이 미해소 항목의 존재를 알 방법이 없다.
  - 제안: (a) target 에 "미구현/Planned" 마커를 붙이거나 (b) 실제 강제 종료 시 어떤 신호 경로로 즉시 중단이 이뤄지는지(있다면) 실측해 등재하는 방향으로 plan #9 를 먼저 집행할 것. 이번 impl-prep 대상 작업 범위 밖이면 최소한 `pending_plans: [spec-update-node-cancellation-shutdown-classification.md]` 를 frontmatter 에 추가해 drift 를 명시적으로 추적할 것.

- **[INFO]** `entity-schema-declaration-drift.md`(현재 진행 plan)의 `workflow-assistant-session.entity.ts` 수정은 `4-ai-assistant.md` 의 `code:` glob 을 건드림 — 이미 알려진 결과, 문제 아님
  - target 위치: `spec/3-workflow-editor/4-ai-assistant.md` frontmatter `code: codebase/backend/src/modules/workflow-assistant/**/*.ts`
  - 관련 plan: `plan/in-progress/entity-schema-declaration-drift.md` (표 #1, `workflow-assistant-session.entity.ts` 인덱스 컬럼 정정) / 이 결과를 미리 예고한 것은 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "`WorkflowAssistantSession` 엔티티의 `@Index` 에 `userId` 가 빠졌다" 항목("고치면 그 파일이 `spec/3-workflow-editor/4-ai-assistant.md` 의 `code:` 에 걸려 `--impl-done` 범위가 는다")
  - 상세: 이번 `--impl-prep spec/3-workflow-editor/` 검토 자체가 왜 트리거됐는지 설명하는 연결고리다 — entity 파일 수정이 `4-ai-assistant.md` 의 `code:` glob 에 걸려 `--impl-done` scope 가 자동으로 이 spec 영역까지 확장된다. `entity-schema-declaration-drift.md` 는 `spec_impact: none` 이고 실제로 이 fix 는 `synchronize:false` 하의 선언 정정(동작 변화 없음)이라 `4-ai-assistant.md` 본문 내용을 바꿀 필요는 없어 보인다. 충돌은 아니지만, `--impl-done` 단계에서 이 spec 파일이 범위에 걸린다는 사실을 developer 가 인지하고 있어야 리뷰 게이트에서 놀라지 않는다.
  - 제안: 별도 조치 불요. `--impl-done` 실행 시 `4-ai-assistant.md` 가 diff-scope 에 포함되어도 "관련 없음"으로 정상 통과할 것으로 예상되나, 혹시 게이트가 이를 근거로 BLOCK 하면 이 INFO 를 근거로 반박 가능.

## 요약

`spec/3-workflow-editor/` 자체가 내리는 새로운 결정이 plan 의 미해결 항목과 정면 충돌하는 CRITICAL 사례는 없었다. 다만 두 건의 WARNING 은 실질적이다 — `spec-draft-nullable-notation-followups.md`(2026-09-13 등재)가 `2-edge.md`/`0-canvas.md` 의 `CONTAINER_*` "코드" 서술을 이미 결함으로 확정했고 정정 형식(선례 인용)까지 정해 두었는데도 target 은 아직 고쳐지지 않았으며, `spec-update-node-cancellation-shutdown-classification.md`(2026-07-28 등재)가 `3-execution.md` §4 "즉시 중단(Force)" 서술을 자신이 확정한 cancel 아키텍처 제약과 어긋난다고 지목했는데도 두 달 가까이 미해소다. 두 경우 모두 대상 spec 파일의 `pending_plans` frontmatter 가 해당 plan 을 누락해, 문서만 보고는 이 drift 의 존재를 알 수 없다는 공통 결함을 공유한다. `ai-agent-tool-connection-rewrite.md` 가 남긴 "도구 등록 모델 TBD" 등 실제 미해결 결정(a/b/c 택일)은 target(`0-canvas.md §12`, `1-ai-agent.md` 상호참조)이 "재작성 예정 (현재 제거됨)" 으로 정확히 보류 상태를 유지하고 있어 충돌이 없다. 현재 워크트리의 실작업(`entity-schema-declaration-drift.md`)은 이 spec 영역의 내용과 직접 충돌하지 않는다 — `4-ai-assistant.md` 의 `code:` glob 에 걸리는 부수효과만 있을 뿐 스펙 서술 자체에 손댈 필요는 없어 보인다.

## 위험도

MEDIUM
