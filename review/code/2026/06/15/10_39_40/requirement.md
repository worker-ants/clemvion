# 요구사항(Requirement) Review

## 발견사항

### [WARNING] `copyName` 구현이 JSDoc 주석(충돌 시 "(Copy 2)" 재시도)과 불일치
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-test-dataset-22/codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.service.ts` L206-L211
- 상세: `copyName` 메서드 JSDoc 는 `"이름" → "이름 (Copy)" / 충돌 시 "이름 (Copy 2)" …` 라고 서술하지만, 실제 구현은 단순히 `base + ' (Copy)'` 를 반환할 뿐이다. "(Copy)" 이름이 이미 존재하면 `saveUnique` 에서 409 `DUPLICATE_NAME` 이 throw 되고, clone 을 요청한 사용자는 충돌 오류를 받게 된다. JSDoc 이 약속한 "(Copy 2)", "(Copy 3)" … 재시도 로직은 존재하지 않는다. clone 이 "항상 성공"해야 하는 UX(소유자 namespace 내 유일화)라는 주석 의도와 구현이 어긋난다.
- 제안: `copyName` 을 async 로 전환하거나 `clone` 메서드 내에서 이름 충돌을 반복 재시도하는 로직을 추가한다. 또는 JSDoc 주석을 "충돌 시 409 DUPLICATE_NAME 반환, 재시도는 클라이언트 책임" 으로 수정해 의도를 명확히 한다. 두 동작 중 하나로 일관성을 확보해야 한다.

---

### [WARNING] `spec-sync-form-gaps.md` 의 `validation.min`/`max`/`pattern` 항목이 되돌아감 — 이전 PR 구현 상태 역행
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-test-dataset-22/plan/in-progress/spec-sync-form-gaps.md` L21
- 상세: 이 diff 에 포함된 파일 7(`types.ts`)은 `FormModalField` 에서 `min?`/`max?`/`pattern?` 필드를 **제거**하고, 파일 8(`execution-engine.service.ts`)은 docstring 에서 `min`/`max`/`pattern` 을 "적용 규칙"에서 다시 "미적용 (Planned)"으로 되돌린다. 동시에 `spec-sync-form-gaps.md` 에서 `[x]` 상태이던 `§6.2 validation.min/max/pattern` 체크박스가 `[ ]` 로 되돌아갔다(파일 25). 이는 이전 PR(form-validation-minmax-pattern-81db34)에서 구현·검토 완료 처리된 기능이 이번 diff 에서 revert 된 것을 의미한다. 삭제된 plan 파일 23(`plan/complete/form-validation-minmax-pattern.md`)과 삭제된 review 산출물(파일 26~57)은 이전 PR 의 완료 증거였는데, 이들이 전부 삭제됐다.

  이전 PR 의 리뷰(22_49_26·23_05_30 SUMMARY/RESOLUTION)는 이 기능을 "LOW risk, 구현 완전" 으로 평가하고 완료 처리했다. 이번 diff 는 `exec-test-dataset` 작업인데, 그 안에 관계없는 `min`/`max`/`pattern` 서버측 검증의 revert 가 혼재한다.

  이 revert 가 의도적(예: rebase 충돌 해소, 병합 전략)이라면 plan 에 근거가 명시돼야 하고, 비의도적이라면 코드 결함이다.
- 제안: revert 의 의도 여부를 확인한다. 만약 비의도적 revert 라면 `FormModalField min?/max?/pattern?` 필드 복원, `form-mode.ts` 검증 로직 복원, docstring 복원, `spec-sync-form-gaps.md` 체크박스 `[x]` 복원이 필요하다. 의도적이라면 plan 에 근거를 기록하고 해당 plan 파일을 complete 에서 in-progress 로 재분류한 이유를 명시한다.

---

### [INFO] 기능 완전성 — `WorkflowTestDataset` CRUD·clone 구현 확인

spec §9 API 표의 5개 엔드포인트와 구현 대조:

| spec | 구현 | 일치 |
|------|------|------|
| `GET /api/workflows/:workflowId/test-datasets` | `@Get('workflows/:workflowId/test-datasets')` | 일치 |
| `POST /api/workflows/:workflowId/test-datasets` | `@Post('workflows/:workflowId/test-datasets')` | 일치 |
| `PATCH /api/test-datasets/:id` | `@Patch('test-datasets/:id')` | 일치 |
| `DELETE /api/test-datasets/:id` | `@Delete('test-datasets/:id')` | 일치 |
| `POST /api/test-datasets/:id/clone` | `@Post('test-datasets/:id/clone')` | 일치 |

spec `body { name, input, visibility? }` vs DTO `CreateWorkflowTestDatasetDto { name, input, visibility? }` — 일치.
spec `visibility 기본 private` vs 구현 `dto.visibility ?? TestDatasetVisibility.PRIVATE` — 일치.
spec `같은 이름 중복 시 409 DUPLICATE_NAME` vs 구현 `ConflictException({ code: 'DUPLICATE_NAME' })` — 일치.
spec `응답 항목에 isOwner 포함` vs 구현 `toDto: entity.ownerId === userId` — 일치.
spec `워크스페이스 read-only 공유본 비소유자 → 404 (존재 숨김)` vs 구현 `findAccessible: !isOwner && !WORKSPACE → NotFoundException` — 일치.
spec `Editor+ 전 작업` vs 구현 `@Roles('editor')` — 일치.

---

### [INFO] `spec-sync-execution-gaps.md` §2.2 항목 체크박스 — TEST WORKFLOW / ai-review / impl-done 미완료
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-test-dataset-22/plan/in-progress/spec-sync-execution-gaps.md` L901-L903
- 상세: §2.2 체크박스가 `[x]`로 완료됐으나 하위 항목 "TEST WORKFLOW", "/ai-review", "/consistency-check --impl-done" 이 모두 `[ ]` 미체크다. 이는 현재 진행 중인 리뷰 주기이므로 결함이 아니라 진행 상태의 정상 반영이다.
- 제안: 현 상태 정상. 본 리뷰가 /ai-review 완료의 일부다.

---

### [INFO] 엣지 케이스 — 목록 쿼리의 `workspace` 가시성 필터
- 위치: `workflow-test-datasets.service.ts` L83-L86
- 상세: 목록 쿼리 조건이 `d.owner_id = :userId OR d.visibility = 'workspace'` 이다. 이 조건은 **같은 워크스페이스의 모든 workspace 공유본**을 반환하므로, 내 워크플로우에 속하지 않는 다른 워크플로우의 workspace 공유본도 이론적으로 반환될 수 있다. 그러나 `d.workflow_id = :workflowId` 조건이 앞에 있어 워크플로우 범위로 이미 격리돼 있다. 문제 없음.

---

### [INFO] 엣지 케이스 — `data` 컬럼 기본값 `'{}'` 과 entity `default: {}`
- 위치: SQL V097 L59, entity L490-L491
- 상세: SQL migration 은 `DEFAULT '{}'`(JSONB literal)을 쓰고, TypeORM entity 는 `default: {}`(JS object)를 쓴다. TypeORM 이 빈 객체를 JSONB default 로 직렬화하면 동일하게 처리된다. create DTO 에서도 `dto.input ?? {}` fallback 이 있어 엣지 케이스 처리 완전.

---

### [INFO] TODO/FIXME — 없음
- 변경된 파일 전체에 TODO/FIXME/HACK/XXX 주석 없음.

---

### [INFO] 반환값 — 모든 코드 경로 적절
- `list`: 배열(빈 배열 포함) 반환.
- `create`, `update`, `clone`: 항상 `WorkflowTestDatasetDto` 반환 또는 예외 throw.
- `remove`: `void` 반환 또는 예외 throw.
- `findAccessible`: entity 반환 또는 404/403 예외. 가시성 미충족 → 404 (존재 숨김, spec 의도 일치).

---

### [INFO] 프론트엔드 API 클라이언트 경로 일치 확인
- `workflowTestDatasetsApi.list`: `GET /workflows/${workflowId}/test-datasets` — spec 일치 (`/api` prefix 는 전역 axiosClient 설정).
- `workflowTestDatasetsApi.update`: `PATCH /test-datasets/${datasetId}` — spec 일치.
- `workflowTestDatasetsApi.remove`: `DELETE /test-datasets/${datasetId}` — spec 일치.
- `workflowTestDatasetsApi.clone`: `POST /test-datasets/${datasetId}/clone` — spec 일치.

---

## 요약

이번 변경의 핵심인 `WorkflowTestDataset` 엔티티·서비스·컨트롤러·DTO·프론트엔드 통합 구현은 spec §2.2, §9 API 표, data-model §2.13.3, R-2.2 권한 모델을 전반적으로 정확히 이행하고 있다. 엔드포인트 경로·HTTP 메서드·에러 코드·visibility 기본값·UNIQUE 제약·isOwner 필드·Editor+ 인가가 모두 spec 과 일치한다. 주요 발견사항은 두 가지다. 첫째, `copyName` 메서드 JSDoc 이 "(Copy 2)" 재시도 로직을 약속하나 구현은 단순 suffix 추가만 하며 충돌 시 409 를 던지는 의도-구현 괴리(WARNING)다. 둘째, 이전 PR(form-validation-minmax-pattern)에서 완료 처리된 `FormModalField min?/max?/pattern?` 및 `validateFormSubmission` min/max/pattern 서버측 검증이 이번 diff 에서 revert 됐으며(types.ts 필드 제거, execution-engine.service.ts docstring 복구, spec-sync-form-gaps.md 체크박스 `[ ]` 복귀, plan/review 산출물 삭제), revert 의 의도·근거가 diff 내 어디에도 명시되지 않아 비의도적 rebase 충돌 결과일 가능성이 있다(WARNING). 이 두 사항을 제외하면 기능 완전성·에러 시나리오·데이터 유효성·비즈니스 로직·반환값 관점에서 요구사항 충족도가 높다.

## 위험도
MEDIUM
