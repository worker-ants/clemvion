# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-done`  
Target: `spec/3-workflow-editor/3-execution.md` (구현 diff 기준, V097 `workflow_test_dataset`)  
Diff base: `f34ae00dcd87dc25b5e5b0b5c96d033015612702`

---

## 발견사항

### 데이터 모델 충돌

- **[INFO]** `spec/1-data-model.md §1` ERD 트리에 `WorkflowTestDataset` 미등재
  - target 위치: 구현 diff `V097__workflow_test_dataset.sql`, entity `WorkflowTestDataset`
  - 충돌 대상: `spec/1-data-model.md §1` 엔티티 관계 개요 (`User ──── Workspace ──── Workflow` 트리)
  - 상세: `spec/1-data-model.md §2.13.3` 에 `WorkflowTestDataset` 상세 정의는 존재하지만, §1 ERD 트리(`Workflow` 하위 자식 목록)에 `WorkflowTestDataset (1:N)` 항목이 빠져 있어 전체 엔티티 그래프 개요가 불완전하다. `Workflow` 하위에 `Node`, `Edge`, `WorkflowVersion`, `Execution` 만 열거되고 `WorkflowTestDataset` 는 없다.
  - 제안: `spec/1-data-model.md §1` Workflow 하위 트리에 `└── WorkflowTestDataset (1:N, user-owned)` 행 추가 동기화.

### API 계약 충돌

- **[INFO]** `list` 쿼리: `andWhere` 조건에 `workspace` 공유본 필터가 `workspace_id` 격리와 분리
  - target 위치: `workflow-test-datasets.service.ts:85-88` `list` 메서드
  - 충돌 대상: `spec/3-workflow-editor/3-execution.md §9` GET API 설명 ("내 것 + 워크스페이스 공유본"), `spec/1-data-model.md §2.13.3`
  - 상세: 서비스 코드는 `.andWhere('d.workspace_id = :workspaceId')` 로 workspace 격리를 먼저 적용한 뒤 `.andWhere('(d.owner_id = :userId OR d.visibility = :workspace)')` 로 가시성을 필터한다. 이 조합은 `workspace` 공유본을 "같은 workspace_id 내" 로 한정하므로 spec 의 의도(워크스페이스 공유본 = 같은 워크스페이스 멤버에게만 노출)와 일치한다. 구현상 충돌은 없으나, spec §9 의 설명만으로는 "같은 workspace 내 공유본" 이라는 격리 전제가 명시되지 않아 향후 오독 여지가 있다.
  - 제안: `spec/3-workflow-editor/3-execution.md §9` GET 목록 설명에 "(같은 workspace 내)" 조건 인라인 명시 권장 (INFO 수준).

### 요구사항 ID 충돌

- 발견 없음. `R-2.2` 는 `spec/3-workflow-editor/3-execution.md` 내부에서만 사용되며 다른 영역의 동일 ID 와 충돌이 없다. V097 은 마이그레이션 번호 체계(V097) 상 순차적이며 기존 V096 다음이므로 충돌 없음.

### 상태 전이 충돌

- 발견 없음. `visibility` 는 `private` / `workspace` 두 값만 가지며, spec(`spec/1-data-model.md §2.13.3`), DB(`V097`, CHECK 제약), 엔티티(`TestDatasetVisibility` enum), DTO 간 완전히 일치한다.

### 권한·RBAC 모델 충돌

- **[INFO]** `spec/3-workflow-editor/3-execution.md §2.2` 에서 "워크스페이스 공유본은 워크스페이스 구성원에게 read-only 노출" 이라 기술하나 `@Roles('editor')` 가드가 적용됨
  - target 위치: `workflow-test-datasets.controller.ts` 전 엔드포인트 `@Roles('editor')`; `spec/3-workflow-editor/3-execution.md §2.2 R-2.2` ("Editor+ 전 작업")
  - 충돌 대상: `spec/2-navigation/9-user-profile.md §4.2` RBAC 매트릭스, `spec/3-workflow-editor/3-execution.md §9` ("Editor+")
  - 상세: `spec §2.2` 와 `R-2.2` 는 "Editor+ 전 작업" 이라 명시하고 구현도 `@Roles('editor')` 로 일치한다. 다만, `spec §2.2` 본문에서 "워크스페이스 구성원에게 read-only 노출" 이라는 표현이 Viewer 도 목록 조회 가능한 것처럼 읽힐 수 있다. 실제로는 Viewer 는 `@Roles('editor')` 가드에 막혀 접근 불가이므로 spec 표현과 구현 간 **모순은 없으나** 오독을 유발할 수 있다.
  - 제안: `spec/3-workflow-editor/3-execution.md §2.2` 의 "워크스페이스 구성원" 표현을 "워크스페이스 Editor+ 구성원" 으로 명확화 권장 (INFO 수준).

### 계층 책임 충돌

- 발견 없음. `WorkflowTestDatasetsModule` 은 backend Core API 계층에 배치되어 `spec/0-overview.md §2.3 Core API Service` 의 "CRUD" 책임에 부합한다. 프론트엔드 `workflowTestDatasetsApi` 는 `lib/api/` 계층에 위치하여 기존 API 클라이언트 패턴과 일치한다.

---

## 요약

구현(V097 `workflow_test_dataset` 마이그레이션, `WorkflowTestDatasets` 모듈, 프론트엔드 데이터셋 UI)은 `spec/3-workflow-editor/3-execution.md §2.2·R-2.2` 및 `spec/1-data-model.md §2.13.3` 의 선언과 전반적으로 일치한다. 데이터 모델(필드·타입·FK·UNIQUE 제약·인덱스), API 계약(경로·HTTP 메서드·요청·응답 shape·오류 코드), 권한 모델(Editor+ 전 작업, 소유자 전용 수정/삭제, clone 패턴) 모두 spec 과 코드 간 직접 모순이 없다. 유일한 실질적 갭은 `spec/1-data-model.md §1` ERD 트리에 `WorkflowTestDataset` 엔티티가 누락된 점으로, 이는 문서 동기화 누락(INFO)이며 기능 충돌이 아니다. RBAC 표현의 미세한 오독 가능성과 list 쿼리의 workspace 격리 전제 미명시도 INFO 수준 개선 사항이다.

---

## 위험도

LOW
