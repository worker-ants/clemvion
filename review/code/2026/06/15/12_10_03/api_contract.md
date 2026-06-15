# API 계약(API Contract) Review

## 발견사항

### **[WARNING]** 목록 API 에 페이지네이션 미적용 — 소프트 리미트(200) 만 존재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-test-dataset-22/codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.service.ts` — `list()` 메서드, `.take(200)`
- 상세: `GET /api/workflows/:workflowId/test-datasets` 는 페이지네이션 파라미터(`page`, `limit`, `cursor` 등)를 전혀 받지 않는다. 서비스 레이어에서 `.take(200)` 하드코딩으로 DoS 를 방어하지만, 200건이 넘으면 응답이 자동으로 잘리고 클라이언트는 이 사실을 알 방법이 없다. 응답 DTO 에도 `total` / `hasMore` 등의 메타데이터가 없어 클라이언트가 데이터 완전성을 판단할 수 없다.
- 제안: (a) 데이터셋이 워크플로우당 소수라는 도메인 특성상 현 소프트 리미트가 실용적으로 충분하다면, 응답에 `{ data: [...], meta: { truncated: boolean } }` 또는 `X-Total-Count` 헤더를 추가해 잘림 여부를 노출할 것. (b) 범용 목록 API 표준에 맞추려면 `?limit=&offset=` 또는 커서 기반 페이지네이션을 도입할 것.

### **[WARNING]** `PATCH /test-datasets/:id` — 빈 바디 허용 시 no-op 202 대신 200 반환
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-test-dataset-22/codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.service.ts` — `update()`, UpdateWorkflowTestDatasetDto
- 상세: `UpdateWorkflowTestDatasetDto` 의 세 필드가 모두 optional 이므로 `{}` 빈 바디로 PATCH 를 보내면 실제 변경 없이 200 + 기존 엔티티 그대로 반환된다. HTTP 의미론상 PATCH 는 "부분 갱신" 이므로 이 자체가 금지는 아니나, 실수한 클라이언트는 성공 응답을 받고도 아무것도 갱신되지 않는 상황이 된다. API 계약 명세가 이 케이스를 명시적으로 다루지 않는다.
- 제안: UpdateWorkflowTestDatasetDto 에 `@ValidateIf(() => false)` 나 커스텀 validator 를 추가해 "적어도 하나의 필드가 제공되어야 함" 을 400 으로 반환하거나, 스펙 문서에 "빈 바디는 허용됨(no-op 200)" 임을 명시해 의도적 계약으로 확정할 것.

### **[INFO]** URL 경로 일관성 — 리소스 경로 두 패턴 혼재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-test-dataset-22/codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.controller.ts` — 전체 라우트 정의
- 상세: 목록/생성은 `workflows/:workflowId/test-datasets` (부모 리소스 명시), 수정/삭제/복제는 `test-datasets/:id` (독립 경로). REST 자원 계층 설계상 이는 의도된 trade-off(단일 ID 로 충분한 접근 vs. 부모 컨텍스트 명시)이나, 클라이언트 입장에서 "어떤 엔드포인트가 workflowId 를 필요로 하는가"가 직관적이지 않을 수 있다. 특히 워크스페이스 격리는 `X-Workspace-Id` 헤더로 처리되어 URL 경로에 드러나지 않는다.
- 제안: 현 설계가 의도적이라면 API 문서(Swagger)에 "PATCH/DELETE/clone 은 `:id` 만으로 workspace 격리가 헤더로 보장됨" 을 명시할 것. 장기적으로는 `workflows/:workflowId/test-datasets/:id` 계층 경로를 고려할 수 있으나, 현재도 spec §2.2 와 일치하는 설계로 보임.

### **[INFO]** `@ApiUnauthorizedResponse` 누락 — 일부 엔드포인트
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-test-dataset-22/codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.controller.ts` — `update`, `remove`, `clone` 액션
- 상세: `list` 와 `create` 에는 `@ApiUnauthorizedResponse({ description: '인증 실패' })` 가 선언되어 있으나, `update`, `remove`, `clone` 에는 없다. 실제 동작은 `@ApiBearerAuth` + Roles Guard 로 동일하게 인증을 요구하므로 Swagger 문서 누락이다.
- 제안: `@ApiUnauthorizedResponse` 를 컨트롤러 클래스 레벨에 공통으로 선언하거나, 누락된 세 액션에 추가할 것.

### **[INFO]** clone 시 이름 충돌 재시도 전략이 클라이언트 책임으로 위임
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-test-dataset-22/codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.service.ts` — `copyName()` 주석
- 상세: "이름 충돌 시 번호 증가('이름 (Copy 2)') 재시도는 클라이언트 책임" 이라는 정책이 주석으로만 존재하며 API 스펙 문서 및 Swagger 응답 설명에 반영되어 있지 않다. `POST /test-datasets/:id/clone` 의 `@ApiConflictResponse` 설명에 이 재시도 전략을 명시해야 클라이언트가 계약을 인지할 수 있다.
- 제안: `@ApiConflictResponse` 설명에 "이름 suffix 증가(`(Copy)` → `(Copy 2)` 등) 재시도는 클라이언트 책임" 을 명시할 것.

## 요약

이번 변경은 `workflow_test_dataset` 신규 테이블과 해당 CRUD + clone API 를 도입한다. 신규 엔드포인트이므로 기존 클라이언트에 대한 하위 호환성 파괴는 없다. API 버전 관리 체계 내에서 정상 추가다. HTTP 상태 코드(201, 200, 204, 403, 404, 409) 사용, 에러 응답의 `{ code, message }` 구조, JWT Bearer + Roles Guard 인증/인가는 모두 적절하다. `ParseUUIDPipe` 로 경로 파라미터 UUID 검증, class-validator 로 요청 바디 검증이 충분히 적용되어 있다. 주요 지적 사항은 목록 API 의 페이지네이션 부재(소프트 리미트 200이 클라이언트에게 불투명함), 빈 PATCH 바디의 no-op 동작이 계약 미명시, Swagger 문서의 `@ApiUnauthorizedResponse` 일부 누락 등 문서 수준의 이슈다. 보안상 중대한 취약점은 발견되지 않았다.

## 위험도

LOW
