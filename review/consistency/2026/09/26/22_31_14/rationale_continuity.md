# Rationale 연속성 검토 — canvas-save-typed (`--impl-done`, scope=`spec/2-navigation/`)

## 검토 요약

- 공칭 target 은 `spec/2-navigation/`(코드 diff → 역-매핑 시 `1-workflow-list.md` frontmatter 의
  `code: codebase/backend/src/modules/workflows/dto/**` 글롭에 걸려 이 scope 로 잡혔다). 그러나 실제 diff
  (`CanvasSaveResultDto.nodes`/`.edges` 를 `NodeDto[]`/`EdgeDto[]` 로 타입 선언, `workflow-response.dto.ts`)는
  내용상 `spec/3-workflow-editor/0-canvas.md` · `5-version-history.md` §7.3 · `spec/data-flow/11-workflow.md` 영역이며,
  `spec/2-navigation/` 본문·Rationale 어디에도 이 DTO 의 원소 형태를 다루는 서술이 없다. scope(`spec/2-navigation`) 델타는
  실측대로 0파일이다.
- 두 스코프(공칭 target·실질 관련 spec) 의 `## Rationale` 을 모두 훑었다: `1-workflow-list.md`(1~4항) ·
  `2-trigger-list.md`(R-1~R-17) · `3-schedule.md` · `spec/0-overview.md` · `spec/1-data-model.md`(WorkflowVersion
  snapshot 정정 포함 전항) · `spec/3-workflow-editor/0-canvas.md`(R-1~R-5) · `2-edge.md`(R-1~R-3) ·
  `3-execution.md` · `4-ai-assistant.md` · `spec/4-nodes/*` 의 Rationale.
- 코드 확인(HEAD 워킹트리, 절대경로): `workflow-response.dto.ts` diff, `node-response.dto.ts`, `edge-response.dto.ts`,
  `spec/5-system/2-api-convention.md §5.4`, `plan/in-progress/canvas-save-typed.md`,
  `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 신규 항목(export DTO 분리 판단).

## 발견사항

- **[INFO]** §5.4 "optional+nullable 동시 선언 금지" 조합이 두 신규 엔드포인트 표면에 처음 노출됨 — 사전 triage 있음, 추가 조치 불요
  - target 위치: `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts`(`CanvasSaveResultDto.nodes`/`.edges`)
  - 과거 결정 출처: `spec/5-system/2-api-convention.md` §5.4 (289~291행) — "키 생략" 필드는 `@ApiPropertyOptional()` + `field?: T`(`| null` 금지), "상시 존재 null" 필드는 `@ApiProperty({nullable:true})` + `field: T | null`. 두 축을 동시에 쓰는 것(`?` + `| null`)은 "어느 쪽에서도 틀렸다"고 명시.
  - 상세: `NodeDto.description`/`.containerId`/`.toolOwnerId`, `EdgeDto.condition` 은 이미 `@ApiPropertyOptional({nullable:true})` + `field?: T | null` 조합이다. 이 조합 자체는 이번 PR 이전부터 존재했고(이번 diff 는 `node-response.dto.ts`/`edge-response.dto.ts` 를 건드리지 않음), 이번 PR 은 그 DTO 를 캔버스 저장·버전 복원 두 엔드포인트에 **처음** 연결해 노출 표면만 넓힌다. §5.4 의 소급 예외 목록(`mcpDiagnostics`, cafe24 `status`/`requiresCafe24Approval`, chat-channel `details.statusCode`)에는 이 필드들이 이름으로 올라 있지 않지만, `plan/in-progress/canvas-save-typed.md` 의 impl-prep 처분(INFO 1)에서 "기존 drift, 검증자가 그 조합을 보지 않아 e2e 대조를 막지 않음"으로 이미 검토·기록됐다.
  - 제안: 조치 불요(이미 트리아지됨). 다만 이 조합을 신규 표면에 노출할 때마다 같은 INFO 가 반복 발견되는 패턴이므로, 언젠가 `NodeDto`/`EdgeDto` 를 직접 손대는 PR 이 생기면 그때 §5.4 위반 자체를 정리하거나 grandfather 목록에 명시적으로 편입하는 편이 다음 checker 의 재조사 비용을 줄인다.

- **[INFO]** 공칭 target(`spec/2-navigation/`)과 실질 관련 spec 이 어긋난다 — harness scope 매핑 이슈, 내용 결함 아님
  - target 위치: 이 호출의 `## Target 문서` = `spec/2-navigation/`
  - 과거 결정 출처: 해당 없음(스펙 내용 문제가 아니라 `code:` frontmatter 역-매핑의 부작용)
  - 상세: `spec/2-navigation/1-workflow-list.md` 의 `code:` 가 `codebase/backend/src/modules/workflows/dto/**` 를 글롭으로 포함해, 실제로는 canvas 저장/복원(`spec/3-workflow-editor/` 영역) 전용 DTO 파일 변경이 워크플로우 목록 spec 소관으로 잡혔다. 내용 대조 결과 `spec/2-navigation/` 의 어떤 Rationale 도 이 변경과 무관했다(재도입·원칙 위반·무근거 번복 없음).
  - 제안: target 문서 수정 불필요. orchestrator 쪽에서 코드→spec 역매핑 시 파일 단위보다 세밀한 매핑(또는 실제 diff 심볼이 어느 스펙 문서 본문에 나타나는지)을 고려하면 향후 유사한 스코프 오배정을 줄일 수 있다 — 다만 이번 건은 결과에 영향 없음(BLOCK 대상 아님).

## 요약

이번 diff(`CanvasSaveResultDto.nodes`/`.edges` 를 `NodeDto[]`/`EdgeDto[]` 로 타입화)는 순수 OpenAPI 선언 정정이며, 서버가 실제로 돌려주던 값은 바뀌지 않는다(CHANGELOG 자체가 이를 명시). `spec/2-navigation/`·`spec/3-workflow-editor/`·`spec/1-data-model.md`·`spec/5-system/2-api-convention.md` 의 `## Rationale` 전체를 대조한 결과, 과거에 명시적으로 기각된 대안을 재도입하거나, 합의된 설계 원칙을 위반하거나, 근거 없이 과거 결정을 번복한 사례는 없었다. 유일하게 걸리는 지점(§5.4 optional+nullable 금지 조합의 신규 표면 노출)은 이번 PR 이 만든 것이 아니라 기존 DTO 의 pre-existing 상태이며, `--impl-prep` 단계에서 이미 INFO 로 triage 완료되어 재차단 사유가 아니다. Rationale 연속성 관점에서 이 변경은 안전하다.

## 위험도

NONE
