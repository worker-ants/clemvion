# Rationale 연속성 검토 결과

검토 모드: `--impl-done` (구현 완료 후)
대상 spec: `spec/3-workflow-editor/3-execution.md`
diff-base: `f34ae00dcd87dc25b5e5b0b5c96d033015612702`

---

## 발견사항

발견된 Rationale 연속성 위반 항목이 없습니다.

아래는 검토를 통해 확인된 정합 상태입니다.

### 확인 1 — R-2.2 권한 모델 정합 (INFO)
- target 위치: `V097__workflow_test_dataset.sql`, `workflow-test-dataset.entity.ts`, `workflow-test-datasets.service.ts`
- 과거 결정 출처: `spec/3-workflow-editor/3-execution.md ## Rationale > R-2.2` (2026-06-14)
- 상세: Rationale R-2.2 가 확정한 다섯 가지 결정 사항 — (1) 유저 귀속 기본(`visibility=private`), (2) 워크스페이스 공유는 read-only, (3) 타 구성원은 clone 으로 수정, (4) `(workflow_id, owner_id, name)` UNIQUE + workspace_id 비정규화, (5) Editor+ 전 작업 — 이 구현 코드에 빠짐없이 반영되어 있다. `service.ts` 의 `findAccessible(requireOwner=true)` 는 소유자 외 수정/삭제를 403으로 차단하고, `requireOwner=false` + 비공유 private 는 404로 존재를 은닉하는 것도 Rationale 의 출처 명확성·충돌 회피 원칙에 부합한다.
- 제안: 없음 (정합).

### 확인 2 — DB 컬럼명 `data` ↔ API 키 `input` 의도적 비대칭 (INFO)
- target 위치: `workflow-test-dataset.entity.ts` 라인 338 (`@Column({ name: 'data', type: 'jsonb' }) input`), `workflow-test-dataset-response.dto.ts` 라인 209
- 과거 결정 출처: `spec/1-data-model.md §2.13.3 WorkflowTestDataset` — "API surface 키는 `input` — TransformInterceptor 의 top-level `data` 키 래핑 휴리스틱 충돌 회피"
- 상세: `entity.input` / `dto.input` 키 선택이 기존 전역 `TransformInterceptor` `{data}` 래핑 규약(spec/5-system/2-api-convention.md §5, webhook.md §3.1 SoT)과 의도적으로 충돌을 피하기 위한 것이다. 이 결정은 data-model spec 에 이미 명시적으로 기록되어 있으며 구현이 그대로 따른다.
- 제안: 없음 (정합).

### 확인 3 — §6 브레이크포인트 로드맵 상태 유지 (INFO)
- target 위치: diff 에 포함된 구현 변경 사항 전체
- 과거 결정 출처: `spec/3-workflow-editor/3-execution.md ## Rationale > §6 브레이크포인트 약속 surface 의 v1 제외`
- 상세: 구현 diff 에는 브레이크포인트(`execution.continue` / `execution.step` / `execution.paused`) 관련 내용이 전혀 없다. 과거 Rationale 가 "v1 범위 밖, 별도 plan·spec 개정으로 재도입" 이라 기각한 결정이 이번 구현으로 번복되지 않았다.
- 제안: 없음 (정합).

### 확인 4 — "워크스페이스 전체 공유 기본" 대안의 재도입 여부 (INFO)
- target 위치: `create-workflow-test-dataset.dto.ts` 라인 171 (`visibility? default PRIVATE`), `workflow-test-datasets.service.ts` 라인 879
- 과거 결정 출처: R-2.2 — "워크스페이스 전체 공유를 기본으로 하면 타인의 임시 데이터셋이 목록을 오염시킨다" (명시적 기각)
- 상세: 구현은 `visibility` 기본값을 `private` 로 유지하며, DTO 의 optional `visibility?` 파라미터도 기본이 `PRIVATE` 이다. Rationale 에서 기각된 "공유 기본" 대안이 재도입되지 않았다.
- 제안: 없음 (정합).

### 확인 5 — "공유본 직접 수정" 허용 대안의 재도입 여부 (INFO)
- target 위치: `workflow-test-datasets.service.ts` `update()` — `findAccessible(..., requireOwner: true)` 호출
- 과거 결정 출처: R-2.2 — "공유본을 여러 명이 직접 수정하면 누구의 테스트인가 가 모호해지고 동시수정 충돌이 생긴다" (명시적 기각)
- 상세: 비소유자 수정은 403 으로 차단되어, Rationale 에서 기각된 "공유본 직접 수정" 대안이 재도입되지 않았다.
- 제안: 없음 (정합).

---

## 요약

구현 diff(`V097` 마이그레이션, `WorkflowTestDataset` 엔티티/서비스/컨트롤러/테스트) 전체를 `spec/3-workflow-editor/3-execution.md ## Rationale` (R-2.2, §6 브레이크포인트, partial 강등 Rationale) 및 `spec/1-data-model.md §2.13.3` 기록과 대조한 결과, 과거에 명시적으로 기각된 대안("공유 기본", "공유본 직접 수정")이 재도입된 사례가 없고, 합의된 invariant(소유자 단일 수정 권한, private 기본, clone-후-소유 패턴, Editor+ 통일, DB `data` ↔ API `input` 비대칭)가 모두 준수되며, 과거 결정을 번복하는 무근거 변경도 발견되지 않았다. Rationale 연속성 측면에서 이상 없음.

---

## 위험도

NONE
