# Cross-Spec 일관성 검토 — canvas-save-typed

## 대상

`plan/in-progress/canvas-save-typed.md` — `CanvasSaveResultDto.nodes`/`.edges` (백엔드
`codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts`) 를
`Record<string, unknown>[]` (`items: { type: 'object' }`) 에서 `NodeDto[]`/`EdgeDto[]` 로
선언만 바꾸는 작업. `POST /workflows/:id/save`(`saveCanvas`) · `POST
/workflows/:id/versions/:versionId/restore`(`restoreVersion`) 두 엔드포인트의 Swagger
응답 스키마에 영향. `spec_impact: none` 로 선언됨.

프롬프트 번들의 명목 target 은 `spec/2-navigation/` 이었으나, 번들 말미 "추가 Read 블록" 이
실제 구현 대상을 `plan/in-progress/canvas-save-typed.md` 로 지정해 그 plan 과 관련 코드·spec 을
직접 Read 해 검토했다.

## 검토 방법

- `plan/in-progress/canvas-save-typed.md` 전문
- 변경 대상: `workflow-response.dto.ts`(`CanvasSaveResultDto`/`ExportWorkflowDto`)
- 참조 대상: `node-response.dto.ts`(`NodeDto`) · `edge-response.dto.ts`(`EdgeDto`) ·
  `node.entity.ts` · `edge.entity.ts` · `workflows.service.ts`(`saveCanvas`/`restoreVersion`)
- spec: `spec/1-data-model.md` §2.6 Node / §2.7 Edge · `spec/data-flow/11-workflow.md` §1.1 ·
  `spec/3-workflow-editor/5-version-history.md` §7.2~7.4 · `spec/2-navigation/1-workflow-list.md`
  §3.2 (Export/Import) · `spec/conventions/swagger.md` §1-4 · `spec/5-system/2-api-convention.md`
  §5.4 · `plan/in-progress/spec-draft-nullable-notation-followups.md`(트래커 원 항목 +
  `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 스윕 이력)

## 발견사항

이번 변경 범위에서 CRITICAL/WARNING 급 cross-spec 충돌은 발견하지 못했다. 아래는 검토 중
확인한 두 가지 INFO 성격의 확인 사항이다 (조치 불필요, 기록 목적).

- **[INFO] `NodeDto`/`EdgeDto` 의 기존 §5.4 "금지 조합" 필드가 새 엔드포인트 스키마에 처음
  노출된다**
  - target 위치: `CanvasSaveResultDto.nodes: NodeDto[]` / `.edges: EdgeDto[]` (plan 방향 1)
  - 충돌 대상: `spec/5-system/2-api-convention.md` §5.4 (부재 표현 — `null` vs 키 생략) +
    `swagger-dto-contract.spec.ts` 의 `EXPECTED_OPTIONAL_NULLABLE_DRIFT`
  - 상세: `NodeDto.description`/`.containerId`/`.toolOwnerId` 와 `EdgeDto.condition` 은 이미
    `@ApiPropertyOptional({ nullable: true })` + `field?: T | null` 이라는, §5.4 가 명시적으로
    금지하는 조합으로 선언돼 있다. 다만 이 다섯 필드는 이미
    `swagger-dto-contract.spec.ts:405-407,365` 의 `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 목록에
    `파일:클래스.필드` 단위로 등재돼 얼려진 기존 drift 다 — 그 정적 가드는 DTO **클래스
    선언** 을 훑지 어느 엔드포인트가 그 클래스를 참조하는지는 보지 않으므로, `NodeDto`/
    `EdgeDto` 를 새 엔드포인트(`save`/`restore`) 에서 재사용해도 가드 목록을 다시 늘릴 필요는
    없다. `CanvasSaveResultDto.nodes`/`.edges` 가 종전 `items: { type: 'object' }` 였을 때는
    이 필드들이 응답 스키마 생성 시 그 아래로 내려가지 않아(트래커 원문 표현) 사실상 가려져
    있었는데, 이번 변경으로 두 엔드포인트의 OpenAPI 스키마에 처음 실제로 드러난다.
  - 제안: 본 plan 이 새로 만든 drift 가 아니므로 별도 조치는 불필요하다. 다만 구현자는
    `--impl-done` 전 `swagger-dto-contract.spec.ts`(정적) 와 `response-contract.ts` 기반 e2e
    가 두 엔드포인트에서도 기존과 동일하게 GREEN 인지 한 번 확인해 두면(가드가 클래스-키
    라는 가정이 실제로 맞는지) 재확인 비용이 거의 없다.

- **[INFO] `ExportWorkflowDto.nodes`/`.edges` 를 건드리지 않고 별도 트래커 항목으로 미루는
  것은 spec 과 정합적이다**
  - target 위치: plan §방향-5 ("`ExportWorkflowDto.nodes`/`.edges`... 새 항목으로 등재")
  - 충돌 대상: `spec/2-navigation/1-workflow-list.md` §3.2 (Export/Import JSON 포맷)
  - 상세: §3.2 는 export/import 의 노드 간 참조가 UUID 가 아니라 **`nodes[]` 배열 index**
    (`sourceNodeIndex`/`containerIndex` 등) 기반이라고 명시한다 — `NodeDto`/`EdgeDto` 는 UUID
    참조(`containerId`/`sourceNodeId` 등)를 쓰므로 그대로 재사용할 수 없는, 형태가 다른
    스키마다. plan 이 `ExportWorkflowDto` 를 이번 범위에서 제외하고 "새 DTO 가 필요하다" 고
    적은 것은 이 spec 서술과 맞는 판단이다.
  - 제안: 없음 (확인만).

## 요약

`canvas-save-typed` plan 은 `CanvasSaveResultDto` 의 `nodes`/`edges` 필드를 이미 엔티티
컬럼과 1:1 대응하는 기존 `NodeDto`/`EdgeDto` 로 재선언하는 순수 Swagger 계약 정밀화이며, 와이어
포맷·엔드포인트·권한·상태 전이·요구사항 ID 어느 것도 바꾸지 않는다. `spec/1-data-model.md` 의
Node/Edge 필드 정의, `spec/data-flow/11-workflow.md` §1.1 과 `spec/3-workflow-editor/
5-version-history.md` §7.3~7.4 의 `{ workflow, nodes, edges }` 응답 서술, `spec/2-navigation/
1-workflow-list.md` 의 `code:` 소유 범위(`modules/workflows/dto/**`) 어느 것과도 모순되지
않는다. `NodeDto`/`EdgeDto` 는 이미 `nodes`/`edges` 모듈의 공개 응답 DTO 로 다른 엔드포인트에서
쓰이고 있어, 이를 `workflows` 모듈의 캔버스 저장 응답에 재사용하는 것은 기존 계층 경계(각
스펙 문서의 `code:` glob 소유권)를 넘지 않는 자연스러운 재사용이다. 유일하게 짚을 만한 것은
`NodeDto`/`EdgeDto` 의 기존 §5.4 optional+nullable 조합 드리프트(이미 가드에 얼려진 항목)가
이번에 두 엔드포인트 스키마에 처음 가시화된다는 점인데, 가드가 DTO 클래스 단위로 동작하므로
새 실패를 만들 근거는 없다. Cross-Spec 관점에서 이 plan 을 그대로 진행해도 무방하다.

## 위험도

NONE
