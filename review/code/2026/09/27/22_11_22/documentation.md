# 문서화(Documentation) 리뷰 — cross-workspace-refs (2라운드)

## 발견사항

- **[INFO]** 1라운드 W1(e2e 스펙 헤더의 존재하지 않는 plan 경로 인용)은 정정되어 있음 — 재발 없음
  - 위치: `codebase/backend/test/cross-workspace-references.e2e-spec.ts` 모듈 최상단 독스트링(파일 상단, `import` 직후)
  - 상세: 1라운드(`review/code/2026/09/27/21_43_01/documentation.md` W1)에서 `plan/complete/cross-workspace-refs.md`(존재하지 않는 경로)를 인용하던 문장이, 현재는 "실측은 `spec/data-flow/12-workspace.md` `## Rationale` «본문 참조 id 도 저장 전에 소속을 본다»"로 정정돼 있다. 해당 anchor(`### 본문 참조 id 도 저장 전에 소속을 본다 (2026-09-27)`, `## Rationale` 섹션 하위)가 `spec/data-flow/12-workspace.md`에 실제로 존재함을 확인했다(커밋 `698ad8ab7` 조치). 새 결함 아님 — 조치 확인용으로만 기록.

- **[INFO]** API 엔드포인트 문서(트리거·스케줄·알림 규칙·지식 베이스) 미러링은 여전히 의도적으로 이 PR 밖 — 재확인, 처분 유지
  - 위치: `spec/2-navigation/2-trigger-list.md` §2.3(`workflowId`) · `spec/2-navigation/3-schedule.md` API 표 · `spec/2-navigation/9-user-profile.md` 알림 규칙 API · `spec/2-navigation/5-knowledge-base.md`
  - 상세: `spec/1-data-model.md` §1.1(참조 소속 규칙 본문), `spec/data-flow/12-workspace.md` Rationale, `spec/2-navigation/1-workflow-list.md`(workflows/folders API 표), `spec/3-workflow-editor/0-canvas.md`(캔버스 저장)는 이번 PR에서 갱신됐지만, 트리거 목록·스케줄·알림 규칙·지식 베이스 API 문서의 필드 표에는 아직 "다른 워크스페이스면 400/404" 문구가 없다. 이는 `plan/in-progress/spec-draft-nullable-notation-followups.md`의 "교차 워크스페이스 참조 후속" 항목에 "구현이 착지한 뒤에 넣는다 — 먼저 넣으면 세 문서에도 `pending_plans` 가 필요해진다"는 명시적 근거와 함께 등재돼 있고, 1라운드 RESOLUTION.md에서도 "조치 불요 — 트래커에 등재된 의도적 범위 밖"으로 이미 처분됐다. 처분을 뒤집을 새 근거를 찾지 못했으므로 유지 — 재확인 목적으로만 기록.
  - 제안: 없음(이미 트래커에 등재, 후속 PR에서 처리 예정).

- **[INFO]** 신규 유틸·서비스 메서드의 JSDoc/인라인 주석 정확성 — 실제 엔티티/구현과 대조 확인, 이상 없음
  - 위치: `codebase/backend/src/common/utils/reference-in-scope.ts`(`InvalidReference`·`throwInvalidReferences`·`assertReferenceInScope`), `codebase/backend/src/modules/edges/edges.service.ts`(`assertEndpointsInWorkflow`), `codebase/backend/src/modules/nodes/nodes.service.ts`(`assertPlacementInWorkflow`), `codebase/backend/src/modules/folders/folders.service.ts`(`assertParentInWorkspace`), `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts`(`assertModelConfigRefsInWorkspace`), `codebase/backend/src/modules/workflow-assistant/workflow-assistant-session.service.ts`(`assertLlmConfigInWorkspace`)
  - 상세: (1) `edges.service.ts` 주석의 "없는 id 는 FK 위반(500)이었다"를 `Edge` 엔티티(`sourceNode`/`targetNode` `ManyToOne(..., { onDelete: 'CASCADE' })`)와 대조 — FK 제약이 실제로 있어 정확. (2) `folders.service.ts` 주석의 "FK 가 CASCADE 라 상대가 폴더를 지우면 이 폴더가 함께 지워진다"를 `Folder` 엔티티(`parent` `ManyToOne(..., { onDelete: 'CASCADE' })`)와 대조 — 정확. (3) `knowledge-base.service.ts`의 `assertModelConfigRefsInWorkspace` 가 재사용한다는 `findEntity(id, workspaceId, kind)` 시그니처와 `kind` 값(`'chat'`·`'rerank'`)을 실제 호출부(`create`/`update`)와 대조 — 일치. (4) `nodes.service.ts` 주석이 인용하는 "spec data-flow/11-workflow §1.2"(type·순환 검사는 실행 시점 몫) — 해당 섹션(`### 1.2 노드 컨테이너 / Tool Area 배치`) 실제 존재 확인. 오래된/부정확한 주석 없음.

- **[INFO]** CHANGELOG 항목 — 기준 충족·내용 정확, 형식도 기존 컨벤션과 일치
  - 위치: `CHANGELOG.md`(`## Unreleased — 요청이 다른 워크스페이스의 워크플로 · 폴더 · 노드를 가리키면 400 이다 (트리거로 남의 워크플로가 실행되던 결함)`)
  - 상세: API 응답 계약(400/404 신설, `details[].field`)이 바뀌는 제품 동작 변화로 상단 기준 1항에 해당. 네 항목(트리거·스케줄 `workflowId`/캔버스 저장/그 밖의 참조/모델 설정 참조)이 실제 diff의 9개 서비스 변경(alerts·edges·folders·knowledge-base·nodes·schedules·triggers·workflow-assistant-session·workflows)과 누락 없이 대응한다. 폴더 PATCH `parentId`처럼 "종전에도 400이었지만 `details[].field` 포맷만 새로 실린" 미묘한 케이스도 diff(구 코드 `details` 없는 400 → 신 코드 `assertParentInWorkspace`)와 대조해 정확히 서술됨을 확인했다.

## 요약

2라운드 diff를 문서화 관점에서 재검토한 결과 신규 CRITICAL/WARNING은 없다. 1라운드 W1(e2e 스펙의 존재하지 않는 plan 경로 인용)은 `spec/data-flow/12-workspace.md` Rationale로 정확히 정정되어 재발이 없음을 확인했다. 트리거·스케줄·알림·KB API 문서의 §1.1 미러링 누락은 여전히 존재하지만 트래커에 등재된 의도적 지연이며 그 처분을 뒤집을 근거는 찾지 못했다. 신규 유틸·서비스 메서드의 JSDoc·인라인 주석은 실제 엔티티(FK CASCADE)·서비스 시그니처(`findEntity` kind)·타 spec 섹션(§1.2)과 전부 대조해 정확함을 확인했고, CHANGELOG 항목도 기준·내용·형식 모두 부합한다.

## 위험도

NONE
