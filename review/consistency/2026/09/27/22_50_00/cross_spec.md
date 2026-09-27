# Cross-Spec 일관성 검토 — `spec/2-navigation/1-workflow-list.md` (cross-workspace-refs, impl-done)

## 검토 방법

- scope 델타(`spec/2-navigation/1-workflow-list.md`)와 SoT 로 지목된 `spec/1-data-model.md §1.1`(신설) · `spec/data-flow/11-workflow.md §1.2/§2.1` · `spec/data-flow/12-workspace.md` Rationale · `spec/3-workflow-editor/0-canvas.md §8/§11.2.2`를 워크트리 절대경로로 직접 대조.
- 구현은 절대경로 `git diff origin/main`(`codebase/backend/src/modules/{folders,workflows,triggers,schedules,alerts,knowledge-base,workflow-assistant}`)로 확인 — `assertReferenceInScope` / `throwInvalidReferences`(`codebase/backend/src/common/utils/reference-in-scope.ts`), `WorkflowsService.assertFolderInWorkspace` · `validateCanvasReferences` · `assertNewNodeIdsUnused`, `FoldersService.assertParentInWorkspace`.
- 에러 코드(`VALIDATION_ERROR` + `details[].code='INVALID_FIELD'`)는 `spec/5-system/2-api-convention.md §5.3`(기존 generic 코드)와 대조 — 신설 코드 아님, 기존 코드 재사용 확인.
- 트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md`, `/ai-review` 3R(`review/code/2026/09/27/22_36_12`) 을 함께 읽어 "이미 발견·처분됨" 항목과 신규 발견을 구분.

## 발견사항

- **[WARNING]** target 문서 내부 Rationale §3 이 서로 다른 시점의 사실을 모순되게 서술 — 상호 참조 없음
  - target 위치: `spec/2-navigation/1-workflow-list.md` `## Rationale` §3 (2026-07-05 원문 불릿) vs 바로 아래 `(2026-09-27 정정)` 단락
  - 충돌 대상: 같은 문서 내부(§3 자체) + `spec/1-data-model.md §1.1`(신설 SoT)
  - 상세: 2026-07-05 원문 불릿은 "세 위반(같은 워크스페이스·순환·깊이) 모두 생성 경로와 동일한 `VALIDATION_ERROR` 를 재사용한다"고 적어, 폴더 **생성** 경로가 그 시점에 이미 "같은 워크스페이스" 위반을 검사했다는 인상을 준다. 그런데 바로 아래 2026-09-27 정정 단락은 "이 결정 뒤에도 **생성** 경로는 깊이만 봤다 — 다른 워크스페이스의 부모를 `getDepth` 가 «없음» 으로 읽어 깊이 1 로 통과시켰다"고 정반대 사실을 적는다. 즉 원문 불릿의 "같은 워크스페이스" 항목은 실제로는 이번 PR(cross-workspace-refs) 이전까지 코드에 없었다 — 두 단락이 서로를 가리키지 않아 독자가 타임라인을 오독하기 쉽다(원문을 읽으면 "이미 구현돼 있었다"로, 정정을 읽으면 "지금 처음 생겼다"로 읽힌다).
  - 이 항목은 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`("교차 워크스페이스 참조 후속" 항목, planner 불릿)에 "원문의 «같은 워크스페이스» 에 정정 단락을 가리키는 각주" 필요성으로 명시 등재되어 있다 — 신규 발견이 아니라 **아직 미집행 상태의 기지 항목**임을 확인.
  - 제안: 별도 조치 불요(이미 트래커 등재·계획됨). 다음 planner 턴에서 원문 불릿에 "(2026-09-27 정정 참고)" 각주만 추가하면 해소.

- **[WARNING]** §1.1 신설 규칙의 API 문서 미러가 4개 화면에서 아직 비어 있음 (구현은 이미 착지) — 이미 트래커에 등재된 지연 항목
  - target 위치: 해당 없음(이번 델타는 `1-workflow-list.md`만; 아래는 **같은 규칙**이 적용되는 다른 `spec/2-navigation/**` 화면)
  - 충돌 대상: `spec/2-navigation/2-trigger-list.md §3`(POST /api/triggers `workflowId`), `spec/2-navigation/3-schedule.md §4`(POST /api/schedules), `spec/2-navigation/9-user-profile.md`(POST /api/alerts `workflowId`), `spec/2-navigation/5-knowledge-base.md`(모델 설정 참조 필드)
  - 상세: `spec/1-data-model.md §1.1` 표는 "트리거 생성 `workflowId`·스케줄 생성 `workflowId`·알림 규칙 생성 `workflowId`"를 "워크스페이스" 범위로 명시하고, 구현 diff 는 실제로 `triggers.service.ts`·`schedules.service.ts`·`alerts.service.ts`·`workflow-assistant-session.service.ts`·`knowledge-base.service.ts` 전부에 검사를 추가했다(코드 diff 확인 완료). 그런데 이 4개 화면 문서의 API 표는 이번 PR 에서 갱신되지 않아 "새 400 `VALIDATION_ERROR`(교차 워크스페이스 `workflowId`)" 를 언급하지 않는다. 다만 **적극적으로 틀린 서술은 없다**(예: "임의 워크스페이스의 workflowId 허용" 같은 반대 주장은 없음) — 이는 모순이 아니라 누락이다.
  - 이 누락은 `plan/in-progress/spec-draft-nullable-notation-followups.md`("교차 워크스페이스 참조 후속" 항목의 planner 불릿: "API 문서 셋에 `spec/1-data-model.md` §1.1 한 줄 미러 … 구현이 착지한 뒤에 넣는다")에 **의도적 지연**으로 이미 명시돼 있다 — `--impl-prep`(`19_43_46`)·`--spec` 라운드에서도 같은 판단이 내려졌다(먼저 넣으면 3개 문서에 `pending_plans` 가 필요해진다는 이유). `/ai-review` 3R INFO #9("Swagger `@ApiProperty` 설명 미반영")도 같은 클래스 갭으로 이미 확인됨.
  - 제안: 별도 조치 불요 — 계획대로 다음 planner 턴에서 4개 문서 + Swagger description 을 함께 갱신.

- **[INFO]** 신설 `common/utils/reference-in-scope.ts` 가 `nodes/core/error-codes` 를 역방향 import — spec 문서 충돌은 아니나 §6 계층 책임 관점 기록
  - target 위치: 해당 없음(코드 전용, spec 서술 없음)
  - 충돌 대상: `codebase/backend/src/common/utils/password.util.ts:60-65` 주석 + `plan/complete/impl-details-code-wiring.md`(W3, 2026-09-11)가 문서화한 "`modules/` 는 canonical 상수, `common/` 은 리터럴 유지"라는 층 경계 결정. **`spec/conventions/**`에는 이 규칙이 성문화되어 있지 않음**(grep 0건) — code-only convention.
  - 상세: `reference-in-scope.ts` 가 `ErrorCode.INVALID_FIELD` 를 쓰려고 `nodes/core/error-codes` 를 import — 이 코드베이스에서 유일한 `common/` → `nodes/` 방향 import. 이미 `/ai-review` 3R(`review/code/2026/09/27/22_36_12`)이 WARNING #1로 정확히 같은 지점을 잡았고, "기능은 안 깨짐(문자열 값 동일) · 팀이 사전에 명시적으로 정한 층 경계 위반"으로 판정해 **수렴 예외로 처리**(codebase 수정 0, 트래커 등재)했다. `spec/**` 자체의 계층 문서(예: `spec/5-system/*` 아키텍처 설명)와 직접 모순되는 건 아니므로 CRITICAL/WARNING 격상 근거는 없다.
  - 제안: 이 checker 관점에서는 조치 불요(이미 code-review 트랙에서 수렴). 다음에 `common/` 상수 승격 작업을 할 때 이 사례를 편입.

## 검증하여 문제없음을 확인한 항목 (기록용)

- `spec/1-data-model.md §1.1` 신설 표와 `spec/2-navigation/1-workflow-list.md §3`(POST/PATCH `/api/workflows` `folderId`)·`§3.1`(POST/PATCH `/api/folders` `parentId`) 의 에러 코드·`details[].field` 표기가 구현(`WorkflowsService.assertFolderInWorkspace`, `FoldersService.assertParentInWorkspace`, `common/utils/reference-in-scope.ts`)과 **line-level 일치**.
- `details: [{ field, message, code: 'INVALID_FIELD' }]` 배열 형태는 `spec/5-system/2-api-convention.md §5.3`(기존 generic 코드) 그대로 재사용 — 신규 코드 충돌 없음, `code-codes.ts` 의 `INVALID_FIELD` 도 기존 상수.
- `workflows.module.ts`/`triggers.module.ts` 가 `Folder`/`Workflow` 엔티티를 **`TypeOrmModule.forFeature`(레포지토리 전용)**로만 주입 — 기존 `Integration` 주입과 동일 패턴(모듈 순환 회피 주석 포함), 계층 책임 결정과 불일치 없음.
- `spec/data-flow/11-workflow.md §1.2` 각주·§2.1 표, `spec/data-flow/12-workspace.md` 신설 Rationale, `spec/3-workflow-editor/0-canvas.md §8/§11.2.2` 모두 `spec/1-data-model.md §1.1` 을 SoT 로 참조하며 에러 코드·범위(워크스페이스 vs 같은 워크플로 vs 페이로드)가 서로 어긋나지 않음.
- 새 요구사항 ID 신설 없음(기존 `NAV-WF-07` 인용만) — 요구사항 ID 충돌 없음. RBAC(폴더 `editor`+) 미변경 — 권한 모델 충돌 없음. 상태 머신(트리거 cascade 등) 미변경 — 상태 전이 충돌 없음.

## 요약

이번 델타(`spec/2-navigation/1-workflow-list.md` 의 `folderId`/`parentId` 교차 워크스페이스 검증 서술)는 신설 SoT `spec/1-data-model.md §1.1` 및 그 미러 문서(`data-flow/11-workflow.md`·`data-flow/12-workspace.md`·`3-workflow-editor/0-canvas.md`)와 에러 코드·범위·계층 책임 전 축에서 정합하며, 구현(폴더·워크플로 서비스)과도 line-level 로 대조된다. CRITICAL 급 모순은 발견되지 않았다. 남은 두 WARNING(Rationale §3 원문-정정 단락 간 상호 참조 부재, 트리거·스케줄·알림·지식베이스 4개 화면 문서의 §1.1 미러 공백)은 **이미 developer 자신의 트래커(`spec-draft-nullable-notation-followups.md`)에 다음 planner 턴 작업으로 명시 등재된 기지 항목**이며 이번 PR 스코프 밖으로 의도적으로 분리된 것이라 이 PR 을 막을 사유는 아니다. 계층 경계 INFO(`common/` → `nodes/` 역방향 import) 역시 `/ai-review` 3R 에서 이미 수렴 예외로 확정됐다.

## 위험도

LOW
