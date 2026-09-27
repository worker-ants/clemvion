# 문서화(Documentation) 리뷰 — cross-workspace-refs (3R)

## 컨텍스트

이번 라운드는 1R(`review/code/2026/09/27/21_43_01`, W1~W3 → `698ad8ab7`)·2R(`review/code/2026/09/27/22_11_22`,
W1 → `421b69088`, W2·W3 는 수렴 예외로 트래커 등재)에 이어지는 3R 이며, orchestrator 고지대로 이번 라운드의 새 코드
변경은 `workflows.service.spec.ts` 의 회귀 테스트 1건뿐이다. 아래는 전체 diff(문서 관점)를 다시 훑되, 이미 처분된
항목은 실제 코드 상태를 직접 대조해 처분이 유지되는지만 확인했다(재지적 없음).

## 검증한 것 (재지적하지 않는 이유)

- `spec/1-data-model.md` §1.1 의 "거부 응답" 문구 — 2R 이전 consistency checker(`20_05_26` WARNING, MEDIUM)가 지적한
  "top-level `VALIDATION_ERROR` 유지 + `details` 단일 객체" 불일치는 실제로 **배열**(`details: [{ field, message, code }]`)로
  정정돼 있고(`spec/1-data-model.md:74`), `throwInvalidReferences`(`codebase/backend/src/common/utils/reference-in-scope.ts:22`)의
  실제 구현과 일치한다. 재지적 없음.
- `spec/2-navigation/1-workflow-list.md` §3 Rationale "(2026-09-27 정정)" 문단 — `plan_coherence` WARNING(`20_21_21`,
  존재하지 않는 `plan/complete/cross-workspace-refs.md` 를 완료형으로 인용)은 draft 2 적용 뒤 `plan/in-progress/cross-workspace-refs.md`
  경로 · 현재형("더한다")으로 정정된 상태를 직접 확인했다(같은 파일 200행 부근). 재지적 없음.
- `codebase/backend/test/cross-workspace-references.e2e-spec.ts` 헤더 주석 — 1R W3(아직 e2e 헤더가 없던 시점에
  `plan/complete/cross-workspace-refs.md` 를 인용)은 현재 `spec/data-flow/12-workspace.md` Rationale 을 인용하도록
  고쳐져 있다. 재지적 없음.
- `plan/in-progress/cross-workspace-refs.md` `## --impl-prep · planner 턴 처분` 섹션 — consistency SUMMARY(`20_56_04`
  INFO 2, "2회차 사이클 미교차인용")가 지적한 갭은 현재 `20_21_21`·`20_35_40`·`20_45_35`·`20_56_04`·`21_03_31` 전 라운드가
  한 문단에 순서대로 기록돼 있다. 재지적 없음.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` — "이 PR 밖으로 넘기는 것" 두 항목(트리거 `config` 비밀
  참조, 이미 저장된 교차 행)이 실제로 "교차 워크스페이스 참조 후속" 트래커 항목(1488행)에 등재돼 있음을 확인했다(`plan_coherence`
  WARNING, `19_43_46`, 이미 해소).

## 발견사항

- **[INFO]** 신규 소속 검증이 적용된 필드들의 Swagger `@ApiProperty`/`@ApiPropertyOptional` 설명이 새 제약(같은 워크스페이스/워크플로 소속, 위반 시 400)을 언급하지 않는다
  - 위치: `codebase/backend/src/modules/folders/dto/create-folder.dto.ts`(`parentId`), `codebase/backend/src/modules/folders/dto/update-folder.dto.ts`(`parentId`), `codebase/backend/src/modules/workflows/dto/create-workflow.dto.ts`(`folderId`), `codebase/backend/src/modules/workflows/dto/update-workflow.dto.ts`(`folderId`), `codebase/backend/src/modules/edges/dto/create-edge.dto.ts`(`sourceNodeId`/`targetNodeId`), `codebase/backend/src/modules/alerts/dto/alert-rule.dto.ts`(`workflowId`) 등 — 이번 PR 이 검증을 추가한 모든 필드의 DTO. 이 DTO 파일들 자체는 이번 diff 에 포함되지 않았다(검증이 서비스 계층에서 이뤄지기 때문).
  - 상세: 이 프로젝트는 `nodes.service.ts`/`edges.service.ts` 등에 매우 상세한 JSDoc으로 새 규칙을 설명해 두었고 `spec/1-data-model.md` §1.1 도 정확하지만, OpenAPI(Swagger) 스키마 설명 자체는 이 새 비즈니스 규칙(400 거부 조건)을 담지 않는다. Swagger UI 로만 API 를 보는 소비자는 이 제약을 알 수 없다. 다만 이는 이미 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md` "교차 워크스페이스 참조 후속" planner 불릿)가 등재한 "API 문서 셋에 §1.1 미러" 항목(트리거·스케줄·알림 규칙 목록 spec 문서 대상)과 같은 클래스의 갭이며, "구현이 착지한 뒤 planner 턴으로" 라는 동일한 유예 근거가 적용될 수 있다.
  - 제안: 별도 조치 불요(이미 확립된 유예 패턴과 동형). 다음 planner 턴이 §1.1 미러를 넣을 때 Swagger `description` 필드도 함께 갱신 대상에 포함시키는 것을 권장.

- **[INFO]** `plan/in-progress/cross-workspace-refs.md` 체크리스트의 `/ai-review` 항목이 이번 라운드 진행 상태를 반영해 갱신돼야 한다
  - 위치: `plan/in-progress/cross-workspace-refs.md` `## 체크리스트` — `- [ ] /ai-review — 1R ... · 2R ... · 3R 진행`
  - 상세: 현재 "3R 진행" 으로 적혀 있어 진행 중임을 정확히 서술하고 있다(오류 아님) — 이번 3R 이 마무리되면(Critical/Warning 처분 확정) 이 줄과 `--impl-done` 줄을 그 결과로 갱신해야 한다는 점만 기록해 둔다.
  - 제안: 이번 라운드 RESOLUTION 작성 시 이 체크리스트 줄과 `## --impl-prep · planner 턴 처분`(또는 새 절)에 3R 결과를 한 줄 추가.

## 요약

CHANGELOG(`## Unreleased — 요청이 다른 워크스페이스의...`)는 프로젝트 기준(`CHANGELOG.md` 상단 "무엇이 항목을 만드는가" §1 제품 동작 변화)에 정확히 부합하고, 영향받은 모든 표면(트리거·스케줄·알림 규칙·캔버스 저장·폴더·모델 설정)을 필드 단위로 정확히 나열한다. 신설 유틸 `reference-in-scope.ts`와 각 서비스의 새 private 메서드(`assertEndpointsInWorkflow`·`assertPlacementInWorkflow`·`assertParentInWorkspace`·`assertModelConfigRefsInWorkspace`·`assertLlmConfigInWorkspace`·`validateCanvasReferences`)는 모두 "무엇을·왜·종전엔 어땠는지·spec 근거"를 갖춘 JSDoc을 달고 있고, 인라인 주석(`버전 복원에서도 건너뛰지 않는다` 등)은 실제 코드 배치(`if` 가드 밖에 위치)와 정확히 일치해 stale 하지 않다. spec 5개 파일(`1-data-model.md` §1.1 신설, `2-navigation/1-workflow-list.md`, `3-workflow-editor/0-canvas.md`, `data-flow/11-workflow.md`, `data-flow/12-workspace.md`)은 규칙·에러 형태·필드별 표를 구현과 대조 일치시켰고, 1~2R 및 5차례의 `--impl-prep`/`--spec` consistency 라운드가 지적한 모든 WARNING(details 배열 형태, plan 경로/시제 오기재, 트래커 미등재)이 실측으로 확인된 대로 정정돼 있다. e2e 스펙 헤더도 이제 존재하는 spec 문서를 인용한다. 새로 찾은 것은 DTO의 Swagger 설명이 새 검증 규칙을 반영하지 않는다는 INFO 하나뿐이며, 이는 이미 확립된 "구현 뒤 planner 턴에서 API 문서 미러" 유예 패턴과 같은 성격이라 차단 사유가 아니다.

## 위험도

NONE
