# 정식 규약 준수 검토 결과

검토 모드: `--impl-done`  
대상 spec: `spec/3-workflow-editor/3-execution.md`  
diff-base: `f34ae00dcd87dc25b5e5b0b5c96d033015612702`  
검토일: 2026-06-15

---

## 발견사항

### [INFO] create DTO 필드에 JSDoc 대신 @ApiProperty 직접 사용

- **target 위치**: `codebase/backend/src/modules/workflow-test-datasets/dto/create-workflow-test-dataset.dto.ts` 전 필드 (`name`, `input`, `visibility`)
- **위반 규약**: `spec/conventions/swagger.md §1-1` — "모든 필드에 JSDoc 추가 (한국어)" + "JSDoc 주석을 추가하고, 설명만으로 부족한 경우에만 `@ApiProperty({ ... })`로 보강"
- **상세**: `create-workflow-test-dataset.dto.ts` 와 `update-workflow-test-dataset.dto.ts` 의 각 필드에 한국어 JSDoc(`/** ... */`)이 없고 `@ApiProperty` 직접 선언만 있다. Swagger CLI 플러그인(`introspectComments: true`)이 활성화된 프로젝트에서 규약 §1-1 은 JSDoc 우선 → `@ApiProperty` 보강 패턴을 권장한다. 클래스 단위 JSDoc 1개만 존재하고 필드별 한국어 JSDoc 은 없다.
- **제안**: 각 필드 위에 한국어 JSDoc 을 추가한다. `@ApiProperty({ example: '로그인 성공 케이스', maxLength: 255 })` 는 유지하되 `/** 데이터셋 이름 (255자 이내, 같은 워크플로우 내 소유자 중복 불가) */` 같은 JSDoc 을 앞에 붙이는 것이 규약 패턴에 합치된다. 단 `@ApiProperty` 로 인해 플러그인 자동 추론이 이미 동작하므로 Swagger 문서에는 설명이 노출된다 — INFO 등급 이상 올릴 근거 없음.

### [INFO] 응답 DTO 클래스 이름이 파일명·기존 패턴과 형식 차이 있음

- **target 위치**: `codebase/backend/src/modules/workflow-test-datasets/dto/responses/workflow-test-dataset-response.dto.ts` — `export class WorkflowTestDatasetDto`
- **위반 규약**: `spec/conventions/swagger.md §5-1` — 응답 DTO 위치 규칙. 명시적 클래스명 규칙은 없으나 같은 모듈 내 기존 선례(workflows: `WorkflowDto`, agent-memory: `AgentMemoryDto` 등) 에서 파일명이 `<entity>-response.dto.ts` 이고 클래스명이 `<Entity>Dto` 패턴
- **상세**: 파일명은 `workflow-test-dataset-response.dto.ts` 이나 클래스 이름은 `WorkflowTestDatasetDto`(not `WorkflowTestDatasetResponseDto`). 선례와 동일 패턴이므로 실질적 불일치는 없다. 단 파일명에 `-response` 가 붙어 있어 클래스명에도 `Response` suffix 가 없음을 일관성 차원에서 언급.
- **제안**: 현 패턴(`WorkflowTestDatasetDto`)은 프로젝트 전반의 관례(`WorkflowDto`, `AgentMemoryDto`)와 일치하므로 변경 불필요. 정보 기록 수준.

### [WARNING] `@Controller()` 에 경로 prefix 없음 — 비표준 multi-root 구조

- **target 위치**: `codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.controller.ts` L398 — `@Controller()`
- **위반 규약**: `spec/5-system/2-api-convention.md §2.1` — `{base_url}/api/{resource}` 패턴. 동일 컨트롤러에 두 가지 resource path 루트(`workflows/:workflowId/test-datasets` 와 `test-datasets/:id`)가 혼재
- **상세**: 컨트롤러에 `@Controller()` prefix 가 없어 두 종류의 URL 패턴이 동일 컨트롤러에 섞여 있다. `GET/POST /api/workflows/:workflowId/test-datasets` 는 nested resource 패턴이고, `PATCH/DELETE/POST /api/test-datasets/:id` 는 최상위 resource 패턴이다. `spec/5-system/2-api-convention.md §2.2` 는 "중첩은 2단계까지" 허용하고 "3단계 이상은 최상위로 분리"를 명시하므로 `/test-datasets/:id` 로 분리한 것 자체는 규약에 부합한다. 그러나 한 컨트롤러에 두 루트 경로가 섞인 구조는 해당 규약의 표준 모듈 예제(`@Controller('workflows')`)와 형태가 다르며, 두 루트를 나누어 두 컨트롤러로 분리하거나, 혹은 명확한 prefix 로 일관성을 부여하는 것이 의도와 일치한다.
- **제안**: 기능적으로는 문제없으나, 유지보수성·가독성을 위해 두 resource path 를 별도 컨트롤러(`WorkflowTestDatasetsByWorkflowController`, `WorkflowTestDatasetsController`)로 분리하거나 규약 변경 없이 현재 구조를 Rationale 에 명시하는 것을 고려. API 동작 자체에는 영향 없으므로 WARNING 등급.

### [INFO] spec frontmatter `status: partial` + `pending_plans` 기존 plan 유효성

- **target 위치**: `spec/3-workflow-editor/3-execution.md` frontmatter — `status: partial`, `pending_plans: [plan/in-progress/spec-sync-execution-gaps.md]`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3` — `partial` 상태의 `pending_plans` 는 `plan/in-progress/` 또는 `plan/complete/` 에 실존 의무 (`spec-pending-plan-existence.test.ts` 가드)
- **상세**: 이번 diff 에서 `§2.2 저장` 기능을 `구현` 으로 표기하고 `code:` 에 `codebase/backend/src/modules/workflow-test-datasets/**` 와 `codebase/frontend/src/lib/api/workflow-test-datasets.ts` 가 추가됐다. `status` 는 여전히 `partial` 로 남아 있어, `spec-sync-execution-gaps.md` plan 이 아직 `in-progress/` 에 실존해야 한다. 이 plan 파일의 존재 여부는 build-time 가드(`spec-pending-plan-existence.test.ts`)가 자동 검증하므로 직접적 위반은 아니나, 구현 완료된 §2.2 surface 가 `partial` 상태를 유지하는 것이 의도인지 명확히 해야 한다.
- **제안**: `plan/in-progress/spec-sync-execution-gaps.md` 파일이 `plan/complete/`로 이동하지 않고 아직 진행 중 plan 이라면 현 상태 유지가 맞다. 단 §2.2 에 관한 surface 만 구현 완료됐고 plan 에 다른 미구현 항목이 남아 있다면 현 frontmatter 는 정확하다. 빌드 가드를 통과하면 규약 위반 아님.

### [INFO] 마이그레이션 명명: snake_case 설명자가 권장 집합 준수

- **target 위치**: `codebase/backend/migrations/V097__workflow_test_dataset.sql`
- **위반 규약**: 없음 (정보 확인 목적)
- **상세**: V097 은 main 의 최대값 V096 + 1 로 단조 증가하고(`migrations.md §2`), 설명자 `workflow_test_dataset` 은 권장 문자집합(영문 소문자 + 숫자 + `_`) 을 준수한다. alphanumeric suffix 없음. 규약 완전 준수.
- **제안**: 해당 없음.

---

## 요약

이번 구현(workflow-test-datasets 모듈, V097 마이그레이션, 프론트엔드 UI/API client, i18n 키) 은 정식 규약을 전반적으로 준수한다. 마이그레이션 명명 규약(`migrations.md`), spec-impl-evidence frontmatter 갱신, swagger 래퍼 헬퍼(`ApiCreatedWrappedResponse`, `ApiOkWrappedArrayResponse`, `ApiOkWrappedResponse`) 사용, 응답 DTO 위치(`dto/responses/`), i18n parity(`ko`/`en` 동시 추가) 모두 규약에 부합한다. 주목할 점은 `@Controller()` 에 경로 prefix 없이 두 루트 resource path 를 한 컨트롤러에 혼재시킨 구조(WARNING)와, create/update DTO 필드에 한국어 JSDoc 이 없이 `@ApiProperty` 만 사용한 점(INFO × 2)이다. WARNING 사항은 API 기능·계약에는 영향이 없으나 향후 유지보수 시 혼란을 줄 수 있다.

---

## 위험도

LOW
