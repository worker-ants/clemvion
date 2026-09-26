# Rationale 연속성 검토 — export-workflow-typed

## 검토 범위

- **scope**: `spec/2-navigation/` — 이 브랜치의 spec 델타는 0개 파일(정상, 코드 전용 PR).
- **구현 diff**: `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts`(+`ExportedNodeDto`/`ExportedEdgeDto` 신설, `ExportWorkflowDto.nodes`/`.edges` 타입 부여) + 캐너리(`workflow-response.dto.spec.ts`) + e2e(`workflow-crud.e2e-spec.ts`) + `CHANGELOG.md`.
- 대조 대상 Rationale: `spec/2-navigation/1-workflow-list.md` `## Rationale`(§1~§4) 및 §3.2 Export/Import 서술, 직전 PR(`canvas-save-typed`, 커밋 `4691166fb`)의 plan/commit 서술.

## 발견사항

없음 — 기각된 대안 재도입, 원칙 위반, 무근거 번복, invariant 우회 어느 항목도 해당하지 않음.

### 근거

1. **기각된 대안의 재도입 여부** — 해당 없음. `spec/2-navigation/1-workflow-list.md` `## Rationale`(§1~§4)은 "공유 워크플로우 정의", "import permissive config 정책", "폴더 계층 무결성", "태그 필터 단일화"만 다루며, export 응답 DTO 형태에 대한 기각 이력은 존재하지 않는다. `NodeDto`/`EdgeDto` 재사용 여부에 대한 Rationale 자체가 spec 어디에도 없다(`grep -rln "NodeDto\|EdgeDto" spec/` 0건) — 즉 이번 PR 이 뒤집을 "기존 합의"가 없다.

2. **합의된 원칙 위반 여부** — 해당 없음. 오히려 이번 구현은 기존 spec 서술과 정합적이다. `spec/2-navigation/1-workflow-list.md` §3.2(line 194-203)는 export 의 노드 간 참조가 "UUID 가 아니라 `nodes[]` 배열 index 기반"이라고 이미 명시하고 있고, 신설된 `ExportedNodeDto`/`ExportedEdgeDto`(`containerIndex`/`toolOwnerIndex`/`sourceNodeIndex`/`targetNodeIndex` 필드)는 이 서술을 정확히 그대로 구현한다. 코드에 남긴 주석("아래 두 DTO 는 `NodeDto`·`EdgeDto` 를 재사용하지 않는다 — export 는 UUID 를 싣지 않고...")도 이 spec 서술을 근거로 든다.

3. **결정의 무근거 번복 여부** — 해당 없음. 이번 PR 은 새로운 결정을 내린 것이 아니라 직전 PR(`canvas-save-typed`, 커밋 `4691166fb`)이 이미 계획해 둔 후속 작업의 실행이다. 그 커밋 메시지가 "트래커: 조사 중 발견한 `ExportWorkflowDto.nodes`/`.edges`(같은 결함, 인덱스 정규화 포맷이라 별도 DTO 필요) 등재"라고 명시적으로 남겼고, `plan/in-progress/export-workflow-typed.md`(실측 섹션)가 `ImportNodeDto`/`ImportEdgeDto`(요청 DTO) 대비 응답 전용 DTO 를 택한 이유(nullable 불일치, optional/required 불일치, enum 미보장)를 근거와 함께 기록했다. `--impl-prep` 검토(INFO 3)가 "코드에 재사용 안 하는 이유를 적으라"고 요구했고 실제로 코드 주석에 반영됐다(위 diff 확인).

4. **암묵적 가정 충돌 여부** — 해당 없음. `spec/2-navigation/1-workflow-list.md` §3.2 는 "Swagger 응답 DTO(`ExportWorkflowDto`)는 `formatVersion` 필드를 선언하지만 현재 export 구현은 이 필드를 emit 하지 않는다"는 기존 갭을 이미 "미구현(Planned)"으로 적어 두었고, 이번 PR 은 그 갭을 건드리지 않은 채(e2e 에서 `allowMissing: ['formatVersion']`) plan 에도 명시적으로 범위 밖("이 PR 은 건드리지 않는다")임을 남겼다 — 기존 invariant/갭 서술과 충돌 없음.

## 요약

이번 PR(export 응답 `nodes`/`edges` 의 `ExportedNodeDto`/`ExportedEdgeDto` 타입화)은 `spec/2-navigation/` 의 기존 `## Rationale` 어느 항목과도 충돌하지 않는다. 오히려 §3.2 가 이미 명시한 "export 는 index 기반 참조, UUID 미포함" 서술을 코드 레벨에서 정확히 구현한 것이며, `NodeDto`/`EdgeDto` 를 재사용하지 않기로 한 결정은 새로운 번복이 아니라 직전 PR(`canvas-save-typed`)이 plan/commit 에 미리 남겨 둔 후속 작업의 예정된 실행이다. 근거(요청 DTO 와의 nullable/optional 불일치, index vs UUID)는 plan 실측 섹션과 코드 주석 양쪽에 기록되어 있어 "무근거 번복"에도 해당하지 않는다. spec 문서 자체의 델타가 0인 것도 `spec_impact: none` 판단(§3.2 가 원소 타입까지는 서술하지 않으므로 이번 DTO 신설이 spec 서술과 모순되지 않는다는 근거)과 일치한다.

## 위험도

NONE
