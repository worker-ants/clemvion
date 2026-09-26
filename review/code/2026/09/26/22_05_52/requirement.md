# 요구사항(Requirement) 리뷰 — canvas-save-typed

## 범위

`POST /workflows/:id/save` · `POST /workflows/:id/versions/:versionId/restore` 응답의 `CanvasSaveResultDto.nodes`/`.edges` 를
타입 없는 `Record<string, unknown>[]` 에서 기존 `NodeDto[]`/`EdgeDto[]` 참조로 광고를 정밀화하는 변경. 런타임 응답(엔티티 그대로
반환)은 그대로이고 OpenAPI 선언 + 회귀 가드(unit 캐너리 · e2e 계약 대조)만 추가된다.

## 검증 방법

프롬프트의 diff/컨텍스트에 더해 저장소 실제 파일을 직접 열어 대조했다: `workflow-response.dto.ts`, `node-response.dto.ts`,
`edge-response.dto.ts`, `node.entity.ts`, `edge.entity.ts`, `workflows.service.ts`(`saveCanvas`/`restoreVersion`/`syncNodes`/
`syncEdges`), `workflows.controller.ts`(두 엔드포인트 데코레이터), `response-contract.ts`(계약 검증자 구현 — `descend()` 가
배열 원소의 `$ref` 로 실제로 내려가는지), `spec/data-flow/11-workflow.md`, `spec/3-workflow-editor/5-version-history.md` §7.2/§7.3,
`swagger-dto-contract.spec.ts` 의 `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 목록, `plan/in-progress/spec-draft-nullable-notation-followups.md`.
저장소 파일은 읽기만 했고 뮤테이션(고쳐보기)은 하지 않았다 — `git status --short` 로 확인, 변경 없음.

## 발견사항

- **[INFO]** 기존에 얼려진 optional+nullable "금지 조합" drift(`NodeDto.description`/`containerId`/`toolOwnerId`,
  `EdgeDto.condition`)가 이번 두 엔드포인트 스키마에 처음 가시화된다.
  - 위치: `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts:80-85`(신규 `NodeDto[]`/`EdgeDto[]`
    선언), 근거는 `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts` 의
    `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 배열 — `node-response.dto.ts:NodeDto.containerId/description/toolOwnerId` ·
    `edge-response.dto.ts:EdgeDto.condition` 항목이 이 PR 이전부터 이미 클래스 단위로 얼려져 있음을 직접 확인했다.
  - 상세: 이 drift 는 `NodeDto`/`EdgeDto` 자체의 기존 결함이고 이번 PR 이 만든 것이 아니다. 새 노출 경로(save/restore)가
    생겨도 응답 계약 검증자(`response-contract.ts`)는 이 조합에서 부재·`null` 을 모두 허용하므로 e2e 대조를 막지 않는다 —
    plan(`plan/in-progress/canvas-save-typed.md` INFO 1)과 consistency-check(`review/consistency/2026/09/26/21_38_44/
    SUMMARY.md` 참고 1)가 이미 같은 결론으로 처분했고, 직접 열람으로 그 처분이 사실과 맞음을 재확인했다.
  - 제안: 조치 불필요 — 기존 drift 목록의 처분 범위이며 이 PR 의 책임이 아니다.

- **[INFO]** `ExportWorkflowDto.nodes`/`.edges` 는 이번 PR 범위 밖으로 **의도적으로** 남는다(같은 형태의 타입 없는 배열이지만
  export 포맷은 인덱스로 정규화돼 `NodeDto`/`EdgeDto` 를 그대로 재사용할 수 없음).
  - 위치: `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts:162-167`(`ExportWorkflowDto`,
    미변경) / 트래커 등재는 `plan/in-progress/spec-draft-nullable-notation-followups.md:1313-1320`.
  - 상세: `spec/2-navigation/1-workflow-list.md` §3.2 의 export/import 경계 서술과 정합적이라는 consistency-check 판단을
    직접 대조해 확인했다. `ImportNodeDto`/`ImportEdgeDto` 재사용 여부 등 선행 결정이 필요해 별도 항목으로 미루는 판단은
    합리적이다.
  - 제안: 조치 불필요(별도 트래커 항목으로 이미 등재됨, 확인만).

- **[INFO]** 트래커 항목 «`CanvasSaveResultDto.nodes`/`.edges` 가 타입 없는 객체 배열»(`spec-draft-nullable-notation-
  followups.md:1307`)은 아직 `[ ]`(미완료)로 남아 있다 — plan 본문은 "이 항목을 닫는다" 고 적지만 실제 체크박스는 아직
  안 닫혔다.
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:1307`.
  - 상세: 불일치처럼 보이지만 `plan/in-progress/canvas-save-typed.md` 자체 체크리스트에 "트래커 항목 닫기" 가 `[ ]`(미완료)로
    명시돼 있어 계획대로다 — `--impl-done` 이후 마무리 단계에서 닫을 항목으로 이미 구분돼 있다. 결함 아님, 정보성 기록.
  - 제안: 조치 불필요. `--impl-done` 이후 닫기 전에 이 항목이 실제로 `[x]` 로 바뀌는지만 확인.

## 상세 검증 결과 (문제 없음으로 확인된 항목)

- **엔티티-DTO 1:1 매핑**: `Node`/`Edge` 엔티티 컬럼(`node.entity.ts`, `edge.entity.ts`)이 `NodeDto`/`EdgeDto` 필드와
  정확히 1:1 이다(관계 필드 제외). `saveCanvas`(`workflows.service.ts:641-703`)는 엔티티를 가공 없이 그대로 반환하고
  `syncNodes`/`syncEdges`(`workflows.service.ts:1066-1157`)도 컬럼만 채우므로 새 선언이 실제 런타임 값과 어긋날 자리가 없다.
- **응답 자체는 불변**: `CanvasSaveResultDto` 는 `TransformInterceptor` 로 재래핑되지 않는다는 기존 주석(라인 67-69)이
  그대로 유지되고, 컨트롤러(`workflows.controller.ts:451-478`, `478-505`)도 서비스 반환값을 그대로 넘긴다 — 타입 선언만
  바뀌었을 뿐 wire 는 그대로라는 CHANGELOG 서술이 정확하다.
- **캐너리(unit) 유효성**: `response-contract.ts` 의 `descend()` 구현을 직접 읽어 배열 원소가 `$ref` 를 가리키면 실제로
  그 스키마로 내려가 재귀 검사함을 확인했다 — plan 의 M3 뮤턴트(`toolOwnerId` 선언 제거 → e2e 만 RED) 주장이 코드
  구현과 부합한다.
- **spec fidelity**: `spec/data-flow/11-workflow.md:53`(`Wf-->>C: 200 { workflow, nodes, edges }`)과
  `spec/3-workflow-editor/5-version-history.md` §7.2 의 `VersionSnapshot`(스냅샷 저장용, 응답 DTO 와 다른 스키마) ·
  §7.3(`응답: { workflow, nodes, edges } (saveCanvas 와 동일)`) 을 직접 열람했다. 두 문서 모두 최상위 키만 규정하고
  `nodes`/`edges` 원소 필드 형태를 규정하지 않으므로, 이번 타입 정밀화가 spec 본문과 충돌하지 않는다 — `spec_impact: none`
  판단이 타당하다.
- **엣지 케이스**: 신규 e2e(C·I)는 `assertMatchesContract` 이전에 `toHaveLength(5)`/`toHaveLength(2)` 로 원소 개수를
  먼저 고정해 "빈 배열이면 원소 대조가 vacuous" 케이스를 배제한다. 생성 경로(C, `manager.create`)와 갱신 경로(I,
  `restoreVersion` → 기존 행 재사용)를 각각 별도로 타므로 두 분기(신규/기존) 모두에서 `NodeDto`/`EdgeDto` 필드가 맞는지
  실제로 검증된다.
- **TODO/FIXME**: 신규·변경 코드에 없음.
- **회귀 없음 근거**: pre-existing `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 목록에 `node-response.dto.ts:NodeDto.containerId/
  description/toolOwnerId` · `edge-response.dto.ts:EdgeDto.condition` 이 이미 존재함을 직접 확인 — 이번 PR 이 새로
  만든 위반이 아니다.

## 요약

`CanvasSaveResultDto.nodes`/`.edges` 를 `NodeDto[]`/`EdgeDto[]` 로 정밀화하는 순수 타입-선언 강화 변경이다. 런타임 응답은
불변이고(엔티티 그대로 반환, `TransformInterceptor` 미개입), 엔티티 컬럼과 DTO 필드가 1:1 로 맞아 새 선언이 실측과 어긋날
지점이 없다. 신규 unit 캐너리(선언 회귀 방지)와 e2e(신규 노드 생성 경로 C·기존 노드 갱신 경로 I 양쪽)가 실제로 `$ref`
배열 원소 안까지 대조하는 `response-contract.ts` 구현을 직접 읽어 그 판별력 주장(뮤턴트 표)이 사실과 부합함을 확인했다.
관련 spec 문서(`data-flow/11-workflow.md`, `3-workflow-editor/5-version-history.md` §7.2/§7.3) 는 최상위 응답 키만
규정하고 원소 형태를 규정하지 않아 `spec_impact: none` 판단이 타당하다. 남는 항목(기존 optional+nullable drift 노출,
`ExportWorkflowDto` 범위 제외, 트래커 체크박스 미완료)은 모두 이미 의도적으로 처분됐거나 계획대로 후속 단계에 예정된
INFO 성 사항이며 코드 결함이 아니다.

## 위험도

NONE
