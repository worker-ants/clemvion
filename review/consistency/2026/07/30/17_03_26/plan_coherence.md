# Plan 정합성 검토 — spec/data-flow/ (impl-prep)

## 검토 대상 재확인

- 실제 target diff(HEAD `f71839fe6`) 는 `spec/data-flow/11-workflow.md` §1.5/§2.1/Rationale +
  `spec/2-navigation/1-workflow-list.md` §2.6/§3 — `POST /api/workflows/:id/duplicate` 가
  "메타 row 만 복제"에서 "nodes/edges 포함 캔버스 전체 복제"로 계약이 정정됨.
- 이 diff 를 직접 구동하는 plan 은 `plan/in-progress/workflow-duplicate-nodes-edges.md`
  (frontmatter `worktree: resumable-handler-generic-typing-3918dd` — 현재 세션과 일치).

## 발견사항

발견 없음 — CRITICAL/WARNING/INFO 어느 등급도 해당 사항이 없다. 근거:

1. **미해결 결정과의 충돌 없음** — `workflow-duplicate-nodes-edges.md` 는 "결정 필요"로 열어둔
   항목이 없다(사용자 합의형 결정 섹션 부재, 체크리스트만 존재). target 커밋이 내리는 유일한
   실질 결정("메타-only 서술은 제품 결정이 아니라 `db496a3c2` drift-sync 부작용")은 `git show
   db496a3c2` 로 실측 가능한 사실 정정이며, 이미 동일 plan 기반 이전 라운드
   (`review/consistency/2026/07/30/16_45_59/`, `--spec` 모드)에서 5개 checker 전원이 BLOCK:NO ·
   Plan Coherence 위험도 NONE(근접 후보 3건 — marketplace/node-output-redesign/
   ai-agent-tool-connection-rewrite — 전부 비저촉)으로 판정한 사안을 재확인한 것뿐이다.
2. **선행 plan 미해소 없음** — target 이 재사용하는 패턴(`importWorkflow()` 의 UUID 사전발급→
   참조재매핑→배치insert, `container_id`/`tool_owner_id` 재매핑)을 동시에 변경 중인 다른
   in-progress plan 없음(`workflows.service.ts`/`WorkflowsService`/`importWorkflow`/
   `exportWorkflow`/`container_id`/`tool_owner_id` 전수 grep — 대상 plan 자신 외 hit 없음).
   `workflow_version`/`trigger`/`workflow_test_dataset` 비승계 결정과 충돌하는 다른 plan 도 없음.
3. **후속 항목 누락 없음** — target 이 뒤집는 문구를 인용하던 다른 in-progress plan 은 없다
   (`nodes/edges 는 복제하지 않는다`/구 AS-IS 문구 참조 전무). `spec/data-flow/1-audit.md` 의
   `workflow.*` audit 액션 미구현 갭은 diff 이전부터 문서화된 시스템 전역 갭이라 본 변경이
   새로 만든 후속 항목이 아니다(별도 in-progress plan 도 없음 — 정상).

부차 확인(직접 저촉은 아니나 교차검증 목적):

- 이전 `--spec` 라운드가 제안한 INFO 6건(Trigger/WorkflowTestDataset 제외범위 명시,
  workflow-list §3 각주, Rationale 이관 문구 구체화, execution.md 인용 역할 한정,
  `@ApiOperation` 갱신 체크리스트화, `workflow` 테이블 "복제" 행 추가)이 실제 커밋 diff 와
  plan 체크리스트에 전부 반영됐음을 직접 대조로 확인 — plan 의 "INFO 6건은 전부 아래에
  반영했다" 서술은 사실이다(과장·stale claim 아님).
- `plan/complete/workflow-cap-validated-dto.md` 가 남긴 "import/duplicate 는 별도 DTO"
  메모는 `PATCH /api/workflows/:id` 의 strict-validated `WorkflowSettingsDto` 도입 맥락이다.
  `duplicate` 엔드포인트는 요청 DTO 자체가 없고(controller 확인, request body 미수신) 서버가
  기존 row 값을 그대로 복사하므로 이 메모는 현재 target 구현과 무관 — 저촉 아님.
- `plan/in-progress/node-output-redesign/README.md` 의 "Workflow(Sub-Workflow)" 노드 행이
  `spec/data-flow/11-workflow.md` 를 링크하지만 실제 해당 내용(`output.workflowId`/
  `output.status`)은 `spec/4-nodes/2-flow/1-workflow.md` 에 있다 — **사전에 존재하던 오링크**
  (`2d4775e28` 링크 무결성 커밋에서 발생, target diff 와 무관, target diff 가 만들지도 악화시키지도
  않음)이라 본 검토 범위(target 변경으로 인한 plan 저촉)에 해당하지 않아 등급 부여하지 않는다.

## 요약

target(`spec/data-flow/11-workflow.md`·`spec/2-navigation/1-workflow-list.md` 의 workflow
duplicate 계약 정정)은 이를 위해 작성된 `plan/in-progress/workflow-duplicate-nodes-edges.md`
의 §1.1~§1.4 TO-BE 를 문구 수준까지 정확히 구현한 결과물이며, 동일 plan 이 이미 `--spec` 단계
consistency-check(BLOCK:NO, Plan Coherence=NONE)를 통과했고 그때 나온 INFO 6건도 이번 커밋에
전부 반영되었음을 직접 diff 대조로 재확인했다. 32개 in-progress plan 전체를 키워드(복제/duplicate/
사본/재사용 등)와 구조적 표면(WorkflowsService/import·export/container_id/tool_owner_id/
workflow_version/workflow_test_dataset) 양쪽으로 훑었으나 target 과 충돌하는 미해결 결정, 미해소
선행조건, 누락된 후속 항목을 찾지 못했다. plan 자체의 체크리스트도 실제 상태(스펙 반영 완료 항목만
체크, 구현 항목은 미체크)와 정확히 일치한다. developer 는 plan 정합성 관점에서 구현 착수를 막을
사유가 없다.

## 위험도

NONE
