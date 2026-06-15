# Cross-Spec 일관성 검토 결과

검토 모드: --impl-done  
대상 구현: `spec/3-workflow-editor/3-execution.md §2.2` (WorkflowTestDataset)  
diff-base: `f34ae00dcd87dc25b5e5b0b5c96d033015612702`

---

## 발견사항

### 발견사항 없음 — 5개 관점 모두 일치

아래는 각 관점별 검토 결과다.

---

#### 1. 데이터 모델 충돌 — INFO 수준 (의미적 주석, 모순 없음)

- **[INFO]** `spec/1-data-model.md §1 ER 다이어그램`에 `WorkflowTestDataset`가 미포함
  - target 위치: 구현 전체 (V097 마이그레이션, entity)
  - 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/exec-test-dataset-22/spec/1-data-model.md` §1 ER 다이어그램 (Workflow 하위 트리에 `WorkflowTestDataset` 항목 없음)
  - 상세: `spec/1-data-model.md §2.13.3`에 `WorkflowTestDataset` 엔티티 정의가 존재하고 내용도 구현과 일치하나, §1 ER 다이어그램 ASCII 트리에는 `Workflow` 하위에 `WorkflowTestDataset (1:N)`이 나열되지 않았다. 실제 모델 정의와 제약은 정확하게 기술되어 있어 구현을 막는 충돌은 아니다.
  - 제안: 다음 spec 갱신 시 §1 ER 트리에 `└── WorkflowTestDataset (1:N, via owner_id+workflow_id)` 추가.

---

#### 2. API 계약 충돌 — 없음

- `spec/3-workflow-editor/3-execution.md §9` API 표와 구현의 endpoint·method·request body·response shape 가 완전히 일치한다.
  - `GET /api/workflows/:workflowId/test-datasets` — list (Editor+)
  - `POST /api/workflows/:workflowId/test-datasets` — create, body `{ name, input, visibility? }` (Editor+)
  - `PATCH /api/test-datasets/:id` — update 소유자만 (Editor+)
  - `DELETE /api/test-datasets/:id` — remove 소유자만 (Editor+)
  - `POST /api/test-datasets/:id/clone` — clone (Editor+)
  - 프론트엔드 API 클라이언트(`/codebase/frontend/src/lib/api/workflow-test-datasets.ts`)도 동일한 URL 패턴을 사용한다.
  - 409 `DUPLICATE_NAME`, 403 (소유자 외 수정), 404 (비소유 private clone 존재 은닉) 모두 spec §9 기술과 일치.

---

#### 3. 요구사항 ID 충돌 — 없음

- 구현 코드에 새 요구사항 ID가 명시적으로 부여되지 않았다. `§2.2`, `R-2.2` 참조만 존재하며, 이는 `spec/3-workflow-editor/3-execution.md` 내부의 기존 섹션 번호를 재사용한다.
- 다른 영역(`spec/2-navigation/`, `spec/5-system/` 등)에서 `§2.2`·`R-2.2` 식별자가 별개 의미로 사용되는 충돌은 확인되지 않는다.

---

#### 4. 상태 전이 충돌 — 없음

- `TestDatasetVisibility` 열거형 (`private` / `workspace`)이 `spec/1-data-model.md §2.13.3` 정의 및 SQL 마이그레이션 V097 CHECK 제약과 일치한다.
- 소유자만 수정·삭제 / 비소유자는 clone → private 사본 생성 흐름이 spec R-2.2, spec §9, 서비스 로직(`findAccessible(requireOwner)`) 간에 모두 동일하게 기술되어 있다.
- `list` 쿼리의 가시성 조건 `(d.owner_id = :userId OR d.visibility = :workspace)` 는 "내 것(private 포함) + 워크스페이스 공유본" 정의와 일치한다.

---

#### 5. 권한·RBAC 모델 충돌 — 없음

- 구현: 모든 엔드포인트 `@Roles('editor')` 적용.
- spec 기술: `spec/3-workflow-editor/3-execution.md §9` "Editor+" 요구사항, `spec/3-workflow-editor/3-execution.md Rationale R-2.2` "Editor+ 전 작업".
- `spec/5-system/1-auth.md §3.2` RBAC 매트릭스에서 `@Roles('editor')` guard는 Owner·Admin·Editor 포함, Viewer 제외를 의미한다. 이는 Mock Input 자체가 에디터 surface이므로 Editor+ 제한과 일치한다.
- 신규 권한 구조(데이터셋 내부의 소유자 기반 write/delete, 비소유자 read-only + clone)는 RBAC 매트릭스에 추가되지 않아도 되는 엔티티 레벨 소유권 판별 — 워크스페이스 역할 가드와 직교하며 충돌하지 않는다.

---

#### 6. 계층 책임 충돌 — 없음

- 백엔드: `workflow-test-datasets` 독립 모듈 (NestJS module/controller/service/entity/DTO). `Workflow` 모듈에서 Repository만 주입. 공통 `@WorkspaceId()` / `@CurrentUser()` 데코레이터 사용.
- 프론트엔드: `/src/lib/api/workflow-test-datasets.ts` API 클라이언트 + `editor-toolbar.tsx` 통합. 에디터 toolbar 레이어에서만 소비 — 다른 화면과 책임 중복 없음.
- DB 마이그레이션: V097 단일 마이그레이션 파일, `spec/0-overview.md §2.8` Flyway forward-only 정책 준수 (`-- DOWN:` 주석 포함).

---

## 요약

구현(V097 마이그레이션 + `WorkflowTestDatasetsModule` 백엔드 + `editor-toolbar.tsx` 프론트엔드)은 `spec/3-workflow-editor/3-execution.md §2.2 / R-2.2`, `spec/1-data-model.md §2.13.3`, `spec/5-system/1-auth.md §3.2` RBAC 매트릭스와 전 영역에서 일관된다. 데이터 모델 정의·API 계약·권한 모델·상태 전이·계층 책임 모두 기존 spec과 충돌하지 않는다. 단 `spec/1-data-model.md §1 ER 다이어그램`에 `WorkflowTestDataset` 항목이 누락되어 있으나, 이는 도해 미갱신일 뿐 정의와 제약 내용은 §2.13.3에 정확하게 기술되어 있어 실질적 모순이 없다 (INFO).

---

## 위험도

LOW
