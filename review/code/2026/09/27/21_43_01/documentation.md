# 문서화(Documentation) 리뷰 — cross-workspace-refs

## 발견사항

- **[WARNING]** e2e 테스트 파일 헤더 주석이 존재하지 않는 plan 경로를 인용한다(과거에 이미 같은 패턴이 spec 문서에서 CRITICAL 로 지적·수정된 바로 그 결함)
  - 위치: `codebase/backend/test/cross-workspace-references.e2e-spec.ts:14` (함수/블록: 파일 최상단 모듈 독스트링, "옮겼다(`plan/complete/cross-workspace-refs.md` §실측 …)" 문장 — 이 파일은 신규 파일로 프롬프트 diff 가 생략돼 게이트 번호가 없어 실제 소스 줄 번호로 기재)
  - 상세: 이 줄은 "§실측" 근거로 `plan/complete/cross-workspace-refs.md` 를 인용하지만, 그 경로는 저장소에 **존재하지 않는다**(`plan/complete/` 에는 `spec-draft-cross-workspace-refs.md`·`spec-draft-cross-workspace-refs-2.md` 만 있다). 실제로 "거부를 기대한 18케이스 — 전부 RED" 실측이 적힌 곳은 `plan/in-progress/cross-workspace-refs.md:88` (`## 실측 — 고치기 전 코드`) 다. 같은 worktree 의 `review/consistency/2026/09/27/20_21_21/**` 가 이미 **정확히 같은 오기 패턴**(`plan/complete/cross-workspace-refs.md` 를 완료형으로 선인용)을 `spec/2-navigation/1-workflow-list.md` 에서 Critical 로 잡아냈고 `18f235a81` 로 고쳤다 — 그런데 그 수정 스코프는 spec 문서였고, 이번에 새로 작성된 이 e2e 스펙 파일의 동일 문구는 그 라운드에 포함되지 않아 같은 버그가 다른 자리에서 재발한 채로 남아 있다. 다음 사람이 이 주석을 따라가면 존재하지 않는 "완료된" plan 을 찾게 된다.
  - 제안: `plan/complete/cross-workspace-refs.md` → `plan/in-progress/cross-workspace-refs.md` 로 경로만 정정(§실측 섹션 위치는 그대로 맞다). `codebase/**` 는 developer 쓰기 범위이므로 planner 턴 불필요 — 이번 PR 안에서 바로 고칠 수 있다.

- **[INFO]** API 엔드포인트 문서(트리거·스케줄·알림 규칙·지식 베이스)가 새 400/404 교차 워크스페이스 거부를 아직 반영하지 않음 — 단, 의도적으로 순서를 미룬 상태
  - 위치: `spec/2-navigation/2-trigger-list.md` "연결 워크플로우(`workflowId`)" 필드 표(§2.3) · `spec/2-navigation/3-schedule.md` API 표 · `spec/2-navigation/9-user-profile.md` 알림 규칙 API(`POST /api/alerts` `workflowId`) · `spec/2-navigation/5-knowledge-base.md`
  - 상세: `grep` 으로 확인한 결과 네 문서 모두 `workflowId`/모델 설정 참조 필드를 서술하지만 "다른 워크스페이스면 400 `VALIDATION_ERROR`"(또는 404 `MODEL_CONFIG_NOT_FOUND`) 문구가 아직 없다. 이는 실제로는 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "교차 워크스페이스 참조 후속" 항목에 "구현이 착지한 **뒤**에 넣는다 — 먼저 넣으면 세 문서에도 `pending_plans` 가 필요해진다" 는 명시적 근거와 함께 후속 작업으로 등재돼 있다(같은 PR 이 만든 followups 파일 diff, "파일 28" 참조). 즉 누락이 아니라 계획된 순서 지연이며, `plan/in-progress/cross-workspace-refs.md` 의 `spec-impact: none` 판단과도 정합한다. 재확인용으로만 남긴다 — `--impl-done` 이전에 이 followups 항목이 실제로 등재됐는지 확인할 가치는 있으나(이미 diff 에 포함돼 확인됨), 이번 PR 을 막을 사유는 아니다.

- **[INFO]** JSDoc·인라인 주석 품질은 전반적으로 우수 — 별도 조치 불요
  - 위치: `codebase/backend/src/common/utils/reference-in-scope.ts`(`InvalidReference`, `throwInvalidReferences`, `assertReferenceInScope` 전부 독스트링 보유) · `codebase/backend/src/modules/workflows/workflows.service.ts`(`assertFolderInWorkspace`·`validateCanvasReferences`·`assertNewNodeIdsUnused`) · `codebase/backend/src/modules/nodes/nodes.service.ts`(`assertPlacementInWorkflow`) · `codebase/backend/src/modules/edges/edges.service.ts`(`assertEndpointsInWorkflow`) · `codebase/backend/src/modules/folders/folders.service.ts`(`assertParentInWorkspace`) · `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts`(`assertModelConfigRefsInWorkspace`) · `codebase/backend/src/modules/workflow-assistant/workflow-assistant-session.service.ts`(`assertLlmConfigInWorkspace`)
  - 상세: 각 신규 private 메서드가 "무엇을 왜"(spec 근거 `1-data-model.md` §1.1) + "종전 결함이 무엇이었는지"(FK 500·조용한 강등·다른 워크스페이스 실행 등 구체적 증상) + 예외 케이스(`null`=해제 통과, 모델 설정은 404 로 갈림)까지 서술한다. `llmService.resolveConfig`(워크스페이스+kind 필터, `model-config.service.ts:150` `MODEL_CONFIG_NOT_FOUND`)와 `getDepth`(다른 워크스페이스 부모를 "없음"으로 읽음) 등 주석이 언급하는 기존 동작을 직접 대조해 확인했고 모두 정확했다 — 오래된/부정확한 주석은 발견되지 않았다.

- **[INFO]** CHANGELOG 항목 — 기준 충족, 내용 정확
  - 위치: `CHANGELOG.md` "## Unreleased — 요청이 다른 워크스페이스의 워크플로 · 폴더 · 노드를 가리키면 400 이다" 항목
  - 상세: 이 변경은 API 응답 계약(400/404 추가, `details[].field`)이 바뀌는 제품 동작 변화이므로 CHANGELOG 상단 기준 1항("API 응답 · 에러 코드의 변화")에 정확히 해당한다. 항목이 트리거·스케줄·캔버스 저장·기타 참조·모델 설정 참조 넷으로 케이스를 나눠 서술하고 각 케이스의 종전 증상(실행됨·행이 옮겨짐·조용한 강등)을 구체적으로 적어 실제 diff(트리거/스케줄/워크플로/노드/엣지/폴더/알림/KB/어시스턴트 세션 서비스 변경)와 대조했을 때 누락된 케이스가 없다.

## 요약

핵심 신규 유틸(`reference-in-scope.ts`)과 이를 호출하는 9개 서비스 전부에 spec 근거·종전 결함 증상·예외 케이스를 명시한 JSDoc/인라인 주석이 충실히 달려 있고, CHANGELOG 항목도 기준에 정확히 부합한다. 유일한 실질 결함은 신규 e2e 스펙 파일(`cross-workspace-references.e2e-spec.ts:14`)이 존재하지 않는 `plan/complete/cross-workspace-refs.md` 를 인용하는 것 — 이 세션이 동일 patttern 을 spec 문서에서 이미 Critical 로 잡아 고친 뒤에도 새로 작성된 소스 파일에서 재발했다. API 문서(트리거/스케줄/알림/KB) 미러링 누락은 후속 plan 에 명시적으로 등재된 의도적 지연이라 막을 사유가 아니다.

## 위험도

LOW
