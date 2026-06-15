# 신규 식별자 충돌 검토

대상: `spec/3-workflow-editor/3-execution.md` (impl-done, diff-base=f34ae00)

---

### 발견사항

- **[WARNING]** `DUPLICATE_NAME` 에러 코드가 전역 에러코드 컨벤션과 다름
  - target 신규 식별자: `'DUPLICATE_NAME'` — `workflow-test-datasets.service.ts` 에서 409 ConflictException 의 `code` 필드로 사용
  - 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/exec-test-dataset-22/codebase/backend/src/common/filters/http-exception.filter.ts` 99행, `src/common/swagger/error-response.dto.ts` 10행 — 전역 규약에서 409의 기본 코드는 `RESOURCE_CONFLICT`
  - 상세: `HttpExceptionFilter.getCodeFromStatus(409)` 는 `'RESOURCE_CONFLICT'` 를 반환한다. 하지만 서비스가 `new ConflictException({ code: 'DUPLICATE_NAME', ... })` 으로 직접 `code` 를 주입하면 필터의 `resp.code` 경로(`getCodeFromStatus` 우회)로 `DUPLICATE_NAME` 이 그대로 내려간다. 이 코드는 전역 표준 카탈로그(`VALIDATION_ERROR`, `RESOURCE_CONFLICT` 등)에 없는 도메인 전용 코드다. 스펙 `main.ts:64` 의 표준 코드 목록에도 미포함. 기술적으로 런타임 충돌은 아니나, 클라이언트가 `RESOURCE_CONFLICT` vs `DUPLICATE_NAME` 중 어느 것을 처리해야 하는지 혼동 가능하다.
  - 제안: (a) 전역 컨벤션을 따라 `RESOURCE_CONFLICT` 로 통일하거나, (b) `DUPLICATE_NAME` 을 공식 도메인 에러코드로 전역 카탈로그에 등록하고 `main.ts` Swagger 설명에 추가한다. spec 에서도 `§2.2` 표 내 409 응답 코드를 명시적으로 기재할 것.

- **[INFO]** `TestDatasetVisibility` 열거형 이름이 전역적으로 유일함을 확인
  - target 신규 식별자: `enum TestDatasetVisibility` (`workflow-test-dataset.entity.ts`)
  - 기존 사용처: `src/nodes/core/node-component.interface.ts` 248행의 `visibleWhen` DSL 주석에 "Visibility DSL" 이라는 표현이 존재하지만 동일한 이름의 타입이나 열거형은 없음. 기존 코드베이스에서 `DatasetVisibility`, `TestDatasetVisibility` 를 정의한 파일이 없음.
  - 상세: 충돌 없음. 다만 `visibleWhen` 관련 코멘트와 표면적으로 이름이 유사해 혼동할 여지가 매우 낮게 존재하나 타입 계층상 분리됨.
  - 제안: 현재 이름 유지 가능.

- **[INFO]** API 엔드포인트 경로 충돌 없음
  - target 신규 식별자: `GET /workflows/:workflowId/test-datasets`, `POST /workflows/:workflowId/test-datasets`, `PATCH /test-datasets/:id`, `DELETE /test-datasets/:id`, `POST /test-datasets/:id/clone`
  - 기존 사용처: spec `3-execution.md` §9 API 표 및 프론트엔드 `src/lib/api/workflow-test-datasets.ts` 에서 동일 경로를 사용 중이며 이는 신규 구현과 일치. 기존 다른 모듈에서 `/test-datasets` prefix 를 사용하는 컨트롤러 없음.
  - 상세: 중복 정의 없음.

- **[INFO]** 마이그레이션 번호 V097 충돌 없음
  - target 신규 식별자: `V097__workflow_test_dataset.sql`
  - 기존 사용처: `migrations/` 디렉토리 내 V096 이 마지막 기존 마이그레이션. V097 파일은 신규 파일 하나뿐.
  - 상세: 충돌 없음.

- **[INFO]** 엔티티·모듈·DTO 이름 충돌 없음
  - target 신규 식별자: `WorkflowTestDataset` (entity), `WorkflowTestDatasetsModule`, `WorkflowTestDatasetsService`, `WorkflowTestDatasetsController`, `CreateWorkflowTestDatasetDto`, `UpdateWorkflowTestDatasetDto`, `WorkflowTestDatasetDto`
  - 기존 사용처: `app.module.ts`, `app.module.spec.ts`, `root-entities.ts` 에서 임포트·등록 — 이는 신규 구현을 정확히 참조. 이외 동일 이름의 기존 정의 없음.
  - 상세: 충돌 없음. `workflow-test-datasets` 디렉토리명도 기존 모듈(`workflow-assistant`, `workflow-versions`, `workflows`)과 분리됨.

---

### 요약

신규 식별자 대부분은 충돌 없이 도입됐다. 유일한 주의 사항은 409 에러코드 `DUPLICATE_NAME` 이 전역 에러코드 컨벤션(`RESOURCE_CONFLICT`)과 다른 비표준 도메인 코드라는 점이다. 런타임에서 `HttpExceptionFilter` 의 `getCodeFromStatus` 를 우회하는 구조로 인해 실제로 클라이언트에 내려가지만, 전역 API 문서 카탈로그에 등록되지 않아 혼동을 유발할 수 있다. 나머지 식별자(테이블명, 엔티티명, 열거형, 마이그레이션 번호, 엔드포인트 경로)는 기존 정의와 충돌하지 않는다.

### 위험도

LOW
