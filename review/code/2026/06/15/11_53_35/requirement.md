# Requirement Review — Workflow Test Datasets (§2.2)

리뷰 대상: 23개 파일 (migration, entity, service, controller, module, DTO, e2e, frontend API, toolbar UI, i18n, docs, spec, plan)
Spec SoT: `spec/3-workflow-editor/3-execution.md §2.2 / §9 / R-2.2`, `spec/1-data-model.md §2.13.3`

---

## 발견사항

### [INFO] `list` 쿼리 — `owner_id OR visibility=workspace` 조건이 다른 유저 private 항목 필터로 충분한지
- 위치: `workflow-test-datasets.service.ts` L648–658 (`list` 메서드 `.andWhere(...)`)
- 상세: 쿼리 조건 `(d.owner_id = :userId OR d.visibility = 'workspace')` 에서 `workspace_id` 와 `workflow_id` 는 상위 `.where` / `.andWhere` 에 이미 걸려 있어 교차 워크스페이스 누출은 없다. Workspace isolation 은 `workspaceId` 필터에 의해 보호된다. 정상.

### [INFO] `findAccessible` — `requireOwner=false` (clone) 시 소유자인 private 본인 접근 가능
- 위치: `workflow-test-datasets.service.ts` L1699–1716
- 상세: `requireOwner=false` 이고 `isOwner === true` 면 `!isOwner && entity.visibility !== WORKSPACE` 조건이 false 라 통과된다. 소유자가 자신의 private 데이터셋을 clone 하는 경우 정상이며, 테스트(self-clone spec)도 이를 커버한다.

### [INFO] `copyName` — 255자 경계 처리
- 위치: `workflow-test-datasets.service.ts` L1785–1788
- 상세: `base.length > max` 에서 max = 248(`255 - len(" (Copy)")`). 255자 이름은 248자로 잘린 뒤 suffix 추가되어 255자를 초과하지 않는다. 경계값 처리 정상.

### [INFO] `CreateWorkflowTestDatasetDto.input` — `@IsObject()` 에 `@IsNotEmpty()` 부재
- 위치: `create-workflow-test-dataset.dto.ts` L479
- 상세: `input` 필드에 `@IsObject()` 만 적용. 빈 객체 `{}` 는 유효하므로 `{}` 전달 시 DB 에 `{}` 저장 — 서비스 단에서도 `dto.input ?? {}` 로 처리. spec 이 `input = Mock Input JSON` 이라 빈 객체 허용은 합리적이며 API 문서도 `additionalProperties: true` 로 명시. 이슈 없음.

### [WARNING] e2e 테스트 E: cross-workspace IDOR — 기대 응답 코드 `[403, 404]` 양수 허용
- 위치: `workflow-test-dataset.e2e-spec.ts` L2206
- 상세: 테스트가 `expect([403, 404]).toContain(res.status)` 로 403 또는 404 를 모두 PASS 로 허용한다. 실제 서비스 `findAccessible` 에서 `workspaceId` 로 행 조회 시 다른 워크스페이스이면 행이 없어 404 가 반환된다. 403 은 이 경로에서 불가능하다 (데이터가 없으므로 `ForbiddenException` 도달 불가). 따라서 404 만 가능한데 `[403, 404]` 허용 — 테스트가 실제 동작을 과도하게 허용한다. spec 은 "IDOR: 404" 를 의미하지만 양쪽 다 허용해 일관성이 낮다.
  - 제안: `expect(res.status).toBe(404)` 로 단정하거나, 설계 의도대로 404 만 명시.

### [INFO] `editor-toolbar.tsx` — `handleSaveDataset` 에서 `jsonError != null` 중복 가드
- 위치: `editor-toolbar.tsx` L2651, L2854
- 상세: `handleSaveDataset` 내부 early return (`if ... jsonError != null ...`) 와 버튼 `disabled={savingDataset || jsonError != null || datasetName.trim() === ""}` 이 이중 가드. 중복이지만 방어적 코딩으로 이슈 없음.

### [INFO] `datasetsQuery` — `enabled` 조건에 `runWithInputOpen` 포함
- 위치: `editor-toolbar.tsx` L2631–2635
- 상세: `enabled: !!workflowId && runWithInputOpen && datasetPickerOpen` 로 다이얼로그가 닫히면 쿼리가 비활성화된다. 다이얼로그 닫을 때 `datasetPickerOpen` 을 false 로 리셋하므로 의도에 부합하며 불필요한 네트워크 요청이 없다.

### [INFO] plan/in-progress 참조 오류 — `data-model §2.13.2` vs 실제 `§2.13.3`
- 위치: `plan/in-progress/spec-sync-execution-gaps.md` L3545 (`§2.13.2 동기화` 표현)
- 상세: plan 본문에 "data-model §2.13.2 동기화" 라고 적혀 있으나 실제 spec 에 추가된 섹션은 `§2.13.3 WorkflowTestDataset`. spec/1-data-model.md 에서 §2.13.2 는 `ExecutionToken` 이다. plan 메모가 잘못된 섹션 번호를 참조. 코드 동작에는 영향 없으나 plan 문서 추적이 어렵다.
  - 제안: plan 파일 `§2.13.2` → `§2.13.3` 으로 정정.

### [INFO] spec `3-execution.md` 변경 분류 — frontmatter `pending_plans` 에 `exec-test-dataset` plan 미포함
- 위치: `spec/3-workflow-editor/3-execution.md` frontmatter `pending_plans`
- 상세: 변경 후에도 `pending_plans: [plan/in-progress/spec-sync-execution-gaps.md]` 만 남아있고, §2.2 저장 항목이 구현 완료로 표기됐다. `spec-sync-execution-gaps.md` 에 해당 항목이 `[x]` 체크돼 있어 추적은 가능하다. 별도 `exec-test-dataset` plan 파일은 생성되지 않았고 기존 plan 에 인라인으로 기록한 형태 — 이는 plan 정책 허용 범위.

---

## Spec Fidelity (spec 본문 일치 검토)

### spec §9 API 경로 vs 컨트롤러 라우트

| spec §9 항목 | 컨트롤러 구현 | 일치 |
|---|---|---|
| `GET /api/workflows/:workflowId/test-datasets` | `@Get('workflows/:workflowId/test-datasets')` | ✅ |
| `POST /api/workflows/:workflowId/test-datasets` body `{ name, input, visibility? }` | `CreateWorkflowTestDatasetDto.name/input/visibility?` | ✅ |
| `PATCH /api/test-datasets/:id` body `{ name?, input?, visibility? }` | `UpdateWorkflowTestDatasetDto` 전부 optional | ✅ |
| `DELETE /api/test-datasets/:id` | `@Delete('test-datasets/:id')` | ✅ |
| `POST /api/test-datasets/:id/clone` | `@Post('test-datasets/:id/clone')` | ✅ |
| 같은 이름 중복 시 `409 DUPLICATE_NAME` | `saveUnique` → `ConflictException({ code: 'DUPLICATE_NAME' })` | ✅ |
| 소유자 아닌 경우 `403` | `ForbiddenException` | ✅ |
| Editor+ 전 작업 | `@Roles('editor')` 전 엔드포인트 | ✅ |

### spec data-model §2.13.3 vs SQL migration + entity

| spec 필드 | migration | entity | 일치 |
|---|---|---|---|
| id UUID PK | ✅ | ✅ | ✅ |
| workflow_id FK Workflow CASCADE | ✅ | ✅ (name 매핑) | ✅ |
| owner_id FK User CASCADE | ✅ | ✅ | ✅ |
| workspace_id FK Workspace CASCADE | ✅ | ✅ | ✅ |
| visibility Enum private/workspace default private | ✅ | ✅ | ✅ |
| name Varchar(255) | ✅ | ✅ | ✅ |
| data JSONB (API key `input`) | ✅ `data` column | entity `@Column({ name: 'data' }) input` ✅ | ✅ |
| created_at/updated_at TimestampTZ | ✅ | ✅ | ✅ |
| UNIQUE(workflow_id, owner_id, name) | ✅ | `@Unique(['workflowId','ownerId','name'])` ✅ | ✅ |
| index(owner_id, workflow_id) | ✅ | `@Index(['ownerId','workflowId'])` ✅ | ✅ |
| index(workspace_id, visibility) | ✅ | `@Index(['workspaceId','visibility'])` ✅ | ✅ |

### R-2.2 권한 모델 vs 서비스 구현

| R-2.2 규칙 | 구현 | 일치 |
|---|---|---|
| 생성 시 항상 요청 유저 소유(`ownerId = userId`) | `create` 에서 `ownerId: userId` 고정 | ✅ |
| 기본 private | `visibility: dto.visibility ?? PRIVATE` | ✅ |
| 목록: 내 것 + 워크스페이스 공유본 | `owner_id = :userId OR visibility = 'workspace'` | ✅ |
| 수정/삭제: 소유자만 | `findAccessible(requireOwner=true)` → ForbiddenException | ✅ |
| 비소유 private clone 시도 → 404 (존재 은닉) | `requireOwner=false` 에서 `!isOwner && !WORKSPACE` → NotFoundException | ✅ |
| clone 사본: 요청자 소유 + private | `ownerId: userId, visibility: PRIVATE` | ✅ |
| isOwner 응답 포함 | `toDto` 에서 `isOwner: entity.ownerId === userId` | ✅ |

---

## 요약

이번 변경은 spec/3-workflow-editor/3-execution.md §2.2 와 spec/1-data-model.md §2.13.3 에 정의된 워크플로우 테스트 데이터셋 저장·권한 모델을 전 레이어(DB migration, entity, service, controller, DTO, frontend API client, toolbar UI, i18n, e2e, docs)에 걸쳐 완전히 구현했다. API 경로·HTTP status code·UNIQUE 제약·visibility enum·FK cascade·isOwner 필드·Editor+ 권한 모두 spec 본문과 line-level 로 일치한다. e2e 7개 시나리오가 invariant A–G 를 커버하며, 서비스 단위 테스트도 CRUD·clone·에러 경로를 포괄한다. 발견된 경미한 사항은: (1) e2e 테스트 E 에서 `[403, 404]` 양수 허용 — 실제로는 404 만 가능하므로 과도한 허용 (WARNING), (2) plan 파일의 `§2.13.2` 오타 (INFO). 기능 완전성과 spec 충실도 측면에서 전체적으로 높은 품질이다.

---

## 위험도

LOW
