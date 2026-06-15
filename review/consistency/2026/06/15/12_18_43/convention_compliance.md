# 정식 규약 준수 검토 결과

검토 모드: `--impl-done` / scope: `spec/3-workflow-editor/3-execution.md` / diff-base: `f34ae00`

---

## 발견사항

### [INFO] DTO 필드에 JSDoc 주석 부재 — create/update DTO
- target 위치: `codebase/backend/src/modules/workflow-test-datasets/dto/create-workflow-test-dataset.dto.ts` 전체 필드 / `dto/update-workflow-test-dataset.dto.ts` 전체 필드
- 위반 규약: `spec/conventions/swagger.md §1-1` — "모든 필드에 JSDoc 추가 (한국어)" + CLI 플러그인이 `/** ... */` 주석을 `description` 으로 전환
- 상세: `name`, `input`, `visibility` 필드 모두 JSDoc 블록 주석이 없고 `@ApiProperty` 의 `description` 으로만 설명이 있거나(일부), 아예 description 자체가 없는 필드(`name` 에 example 만 존재)다. `swagger.md §1-1` 은 "모든 필드에 JSDoc 추가" 를 1차 패턴으로 규정하고 `@ApiProperty` 는 "설명만으로 부족한 경우" 의 보강으로 정의한다. CLI 플러그인이 활성화되어 있으므로 JSDoc 없이 `@ApiProperty({ example: ... })` 만 두는 것은 description 자동 생성을 포기하는 패턴이다.
- 제안: `create-workflow-test-dataset.dto.ts` 와 `update-workflow-test-dataset.dto.ts` 의 각 필드에 `/** 데이터셋 식별 이름 (워크플로우 내 소유자별 unique, 최대 255자) */` 형식의 한국어 JSDoc 블록 주석을 추가한다. 기존 `@ApiProperty` 는 example/enum/format 보강으로 유지한다.

---

### [INFO] 응답 DTO 파일명이 컨벤션 패턴과 소폭 어긋남
- target 위치: `codebase/backend/src/modules/workflow-test-datasets/dto/responses/workflow-test-dataset-response.dto.ts` (클래스명: `WorkflowTestDatasetDto`)
- 위반 규약: `spec/conventions/swagger.md §5-1` — 응답 DTO 위치 규약 `dto/responses/*-response.dto.ts`
- 상세: 파일명 `workflow-test-dataset-response.dto.ts` 는 규약을 따른다. 그런데 파일 내 export class 이름이 `WorkflowTestDatasetResponseDto` 가 아니라 `WorkflowTestDatasetDto` 다. 명시적 금지 사항은 아니지만, 프로젝트 전반의 패턴(`WorkflowDto`, `ExecutionDto` 등 응답 DTO 가 `Dto` suffix 로 통일)과 일치하며, 혼동 여지가 없으므로 INFO 수준으로 분류한다.
- 제안: 이대로 유지해도 규약 위반은 아니다. 만약 다른 모듈의 응답 DTO 가 `WorkflowResponseDto` 패턴을 쓴다면 일관성을 맞추기 위해 `WorkflowTestDatasetResponseDto` 로 rename 을 검토할 수 있다. 코드베이스 다수 모듈이 `Dto` suffix 를 응답 DTO 에 쓰므로 현행 유지가 더 자연스러울 수도 있다.

---

### [INFO] create DTO — `input` 필드에 `@IsNotEmpty()` 없이 `@IsObject()` 만 사용
- target 위치: `codebase/backend/src/modules/workflow-test-datasets/dto/create-workflow-test-dataset.dto.ts` L168
- 위반 규약: 직접적 conventions 위반은 아님. `spec/conventions/swagger.md §1` 의 취지(검증 데코레이터가 CLI 플러그인에 의해 API docs 로 연동되므로 의미 있는 제약을 명시) 관점의 INFO
- 상세: `input` 필드가 `Record<string, unknown>` 이므로 빈 객체 `{}` 도 유효하다. SQL 마이그레이션 DDL 에서 `data JSONB NOT NULL DEFAULT '{}'` 가 `{}` 를 기본값으로 두므로 빈 객체 허용은 의도된 것이다. 단 Swagger 문서에서 이 필드가 필수임이 명확하지 않을 수 있다.
- 제안: 현행 유지가 적절하다 (빈 객체 허용이 설계 의도). `@ApiProperty` 의 description 에 "빈 객체 허용" 또는 "Mock Input JSON ({}도 가능)" 을 추가하면 Swagger 문서 명확성이 올라간다.

---

### [WARNING] 서비스의 에러 코드 오브젝트 내 `FORBIDDEN` 코드가 기본값 코드와 중복
- target 위치: `codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.service.ts` L908–L912 (`findAccessible` 내 `ForbiddenException`)
- 위반 규약: `spec/conventions/error-codes.md §1` (의미 기반 명명), `spec/5-system/2-api-convention.md §5.3` (에러 응답 코드 기본값 — 403=`FORBIDDEN`)
- 상세: `ForbiddenException({ code: 'FORBIDDEN', message: '...' })` 에서 `code: 'FORBIDDEN'` 은 `api-convention.md §5.3` 의 "403 기본값" 과 동일하다. `GlobalExceptionFilter` 가 HTTP 상태코드로부터 이미 `FORBIDDEN` 을 자동으로 부여하므로, 인라인으로 `code: 'FORBIDDEN'` 을 명시하면 의미 부가가 없다. 반면 `ConflictException({ code: 'DUPLICATE_NAME' })` 는 기본값(`RESOURCE_CONFLICT`)과 다르게 의미 있는 커스텀 코드를 제공하므로 올바른 패턴이다. `FORBIDDEN` 인라인 명시는 중복이지만, `GlobalExceptionFilter` 가 코드 오브젝트를 어떻게 처리하느냐(덮어쓰기 vs 무시)에 따라 동작 차이가 생길 수 있어 WARNING 으로 분류한다.
- 제안: `ForbiddenException` 을 `throw new ForbiddenException('Only the owner can modify this dataset')` 처럼 단순 문자열로 throw 하거나, 또는 `code: 'DATASET_OWNER_REQUIRED'` 처럼 의미 있는 도메인 코드를 부여한다. 현재 `RESOURCE_NOT_FOUND` / `DUPLICATE_NAME` 처럼 의미 있는 코드를 쓰는 패턴과 일관성을 맞추기 위해서는 후자를 권장한다. 단 breaking change 여부는 프론트 코드가 `FORBIDDEN` 으로 분기하는지 확인 후 결정한다.

---

### [INFO] 컨트롤러에 `@ApiForbiddenResponse` 누락 — list 엔드포인트
- target 위치: `codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.controller.ts` L401–L420 (list 엔드포인트)
- 위반 규약: `spec/conventions/swagger.md §5-4` — "`@Roles(...)` 가 붙은 엔드포인트는 `@ApiForbiddenResponse` 도 추가"
- 상세: `list` 메서드에 `@Roles('editor')` 가 있으나 `@ApiForbiddenResponse` 가 없다. `create`, `update`, `remove`, `clone` 에도 동일하게 `@Roles('editor')` 가 있으며, `update` 와 `remove` 는 소유자 체크로 인해 비소유자에게 403 이 발생할 수 있으므로 `@ApiForbiddenResponse` 가 명시되어 있다. 그런데 `list` 와 `create` 에는 role 기반 403(`editor` 미만 역할)만 가능하고 소유자 403 은 없으므로, 최소한 role guard 기반 403 에 대한 `@ApiForbiddenResponse` 가 있어야 한다. `create` 와 `clone` 도 같은 이유로 포함 대상이다.
- 제안: `list`, `create`, `clone` 엔드포인트에 `@ApiForbiddenResponse({ description: 'Editor 이상 역할 필요' })` 를 추가한다. `update`, `remove` 는 이미 있으므로 해당 없음.

---

### [INFO] 마이그레이션 파일명 — 컨벤션 문자집합 권장 범위 내
- target 위치: `codebase/backend/migrations/V097__workflow_test_dataset.sql`
- 위반 규약: `spec/conventions/migrations.md §1` (명명 규약)
- 상세: `V097__workflow_test_dataset.sql` 은 권장 문자집합(영문 소문자 + 숫자 + `_`)을 따르고 snake_case 이다. 규약 준수 확인. 추가 확인 사항: 현재 브랜치에서 V097 이 main 의 max(V) + 1 인지는 diff 에서 확인 불가하나, 마이그레이션 파일 자체의 명명 패턴은 규약을 따른다.
- 제안: 없음 (참고 기록).

---

### [INFO] 응답 DTO 에 `readOnly: true` 미사용 — `id`, `createdAt`, `updatedAt`, `ownerId`, `isOwner`
- target 위치: `codebase/backend/src/modules/workflow-test-datasets/dto/responses/workflow-test-dataset-response.dto.ts`
- 위반 규약: `spec/conventions/swagger.md §1-5` — "서버 derived field (`hasBotToken`, `id`, `createdAt` 등) 는 응답 DTO 한정으로 `readOnly: true` 동반. SoT 는 본 절."
- 상세: `swagger.md §1-5` 가 `id`, `createdAt`, `updatedAt`, `isOwner` 같이 서버가 자동 생성·계산하는 파생 필드는 응답 DTO 에서 `readOnly: true` 를 명시해야 한다고 규정한다. 현재 응답 DTO 의 모든 필드가 `@ApiProperty` 에 `readOnly: true` 없이 선언되어 있다. 단 이 규약에서 "의무(MUST)" 강도는 `writeOnly` (비밀 입력) 에 더 집중되어 있고 응답 DTO 의 `readOnly` 는 "SoT 는 본 절" 이라는 표현으로 권장된다. 다른 모듈의 응답 DTO 적용 현황과 일관성을 유지하는 것이 바람직하다.
- 제안: `id`, `ownerId`, `createdAt`, `updatedAt`, `isOwner` 필드의 `@ApiProperty` 에 `readOnly: true` 를 추가한다. 다른 모듈의 기존 응답 DTO 가 이 패턴을 쓰지 않는다면 규약 갱신이 더 적절할 수도 있다.

---

### [INFO] `spec/3-workflow-editor/3-execution.md` 의 spec frontmatter `code:` 경로 — glob 포함
- target 위치: `spec/3-workflow-editor/3-execution.md` frontmatter line 13: `- codebase/backend/src/modules/workflow-test-datasets/**`
- 위반 규약: `spec/conventions/spec-impl-evidence.md §2` (frontmatter 스키마 — `code:` 필드)
- 상세: `spec-impl-evidence.md §2` 는 `code:` 에 "레포 루트 기준 상대경로" 이며 "glob 허용" 이라고 명시한다. 따라서 `codebase/backend/src/modules/workflow-test-datasets/**` 와 `codebase/frontend/src/lib/api/workflow-test-datasets.ts` 모두 유효한 glob/path 이다. 규약 준수 확인.
- 제안: 없음 (참고 기록).

---

### [INFO] API URL 구조 — `/test-datasets/:id` 패턴의 컨벤션 적합성
- target 위치: `workflow-test-datasets.controller.ts` — `PATCH test-datasets/:id`, `DELETE test-datasets/:id`, `POST test-datasets/:id/clone`
- 위반 규약: `spec/5-system/2-api-convention.md §2.1` (URL 구조 — 중첩 2단계까지)
- 상세: `GET/POST /api/workflows/:workflowId/test-datasets` 는 정상 중첩이다. `PATCH/DELETE /api/test-datasets/:id` 와 `POST /api/test-datasets/:id/clone` 은 `workflowId` 없이 최상위 분리된 형태인데, 이는 `api-convention §2.2` 의 "3단계 이상은 최상위로 분리" 예외 패턴과 일치한다. 단건 조작(PATCH/DELETE)에서 이미 `id` 로 리소스를 특정할 수 있으므로 최상위 분리는 적합하다. 규약 준수.
- 제안: 없음 (참고 기록).

---

## 요약

구현 코드(diff) 는 정식 규약의 핵심 구조를 전반적으로 준수한다. 마이그레이션 명명, API URL 패턴, 응답 래퍼 헬퍼(`ApiOkWrappedArrayResponse`, `ApiCreatedWrappedResponse`), 응답 DTO 위치(`dto/responses/`), spec frontmatter `code:` glob 사용이 모두 적절하다. WARNING 1건은 `ForbiddenException` 의 `code: 'FORBIDDEN'` 인라인 명시가 `GlobalExceptionFilter` 의 기본값과 중복되어 의미 없는 선언인 점으로, 프론트 코드와의 계약을 확인하지 않은 채 방치하면 오해를 유발할 수 있다. INFO 6건은 JSDoc 주석 부재, `@ApiForbiddenResponse` 부분 누락, 응답 DTO `readOnly` 미선언 등 Swagger 규약(`spec/conventions/swagger.md`)의 권장 패턴 이탈이며, 기능 정확성에는 영향이 없으나 API 문서 품질과 일관성 측면에서 보완이 권장된다.

---

## 위험도

LOW
