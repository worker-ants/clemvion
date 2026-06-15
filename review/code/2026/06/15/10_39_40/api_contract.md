# API 계약(API Contract) 리뷰

## 발견사항

### **[WARNING]** `list` 엔드포인트에 페이지네이션 없음
- 위치: `/codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.controller.ts` L48-68 / `workflow-test-datasets.service.ts` L73-90
- 상세: `GET /workflows/:workflowId/test-datasets` 는 조건에 맞는 전체 행을 반환한다. 워크스페이스 공유본 + 본인 소유 모두를 한 번에 반환하므로, 데이터셋이 누적될수록 응답 크기가 무제한으로 커진다. 현재는 `limit` / `offset` / `cursor` 등 어떤 페이지네이션 파라미터도 없다.
- 제안: 단기적으로 서버 측 상한(`take(N)`)을 설정하거나, `?limit=&offset=` 쿼리 파라미터를 도입하고 응답을 `{ data: T[], total: number }` 형식으로 래핑한다. 에디터 UI 특성상 수십 건 수준이면 현재도 수용 가능하나, 스펙에 상한 명시가 없으면 미래 클라이언트가 페이지네이션 없음을 계약으로 가정할 수 있다.

### **[WARNING]** URL 네임스페이스 불일치 — 생성·조회 vs 수정·삭제·복제 경로가 분리됨
- 위치: `workflow-test-datasets.controller.ts` L48-141, `/codebase/frontend/src/lib/api/workflow-test-datasets.ts` L706-741
- 상세: 생성/목록은 `/workflows/:workflowId/test-datasets` 하위에 있고, 수정(PATCH)/삭제(DELETE)/복제(POST clone)는 최상위 `/test-datasets/:id`에 위치한다. REST 관례상 리소스 계층이 혼재한다. 단일 리소스 접근에는 최상위 `/test-datasets/:id` 를 쓰는 것이 합리적이지만, 생성/목록이 부모 리소스 하위에 있는 것과 섞이면 API 소비자가 경로 패턴을 예측하기 어렵다.
- 제안: 설계 의도(생성·목록은 workflowId 스코프, 단일 리소스 조작은 id 직접 참조)를 스펙·Swagger 문서에 명시적으로 기재하거나, 전체를 `/workflows/:workflowId/test-datasets/:id` 형태의 중첩 리소스로 통일하는 방안을 검토한다.

### **[WARNING]** `clone` 엔드포인트 이름 충돌 시 409 응답 없음
- 위치: `workflow-test-datasets.service.ts` L168-184, `workflow-test-datasets.controller.ts` L124-141
- 상세: `clone()` 은 `copyName()` 으로 " (Copy)" 접미사를 붙인 이름을 만들지만, 이미 "이름 (Copy)" 가 존재하면 `saveUnique()` 에서 `ConflictException(409)` 가 던져진다. 컨트롤러 Swagger 문서에 clone 엔드포인트의 `@ApiConflictResponse`가 없어 API 계약 문서가 불완전하다.
- 제안: `@ApiConflictResponse({ description: '동일 이름 복제본 이미 존재' })` 를 clone 핸들러에 추가한다. 서비스 레벨에서 " (Copy 2)", " (Copy 3)" 방식으로 자동 충돌 회피를 구현하거나, 클라이언트가 409를 처리하도록 계약을 명시한다.

### **[INFO]** `list` 응답이 `WorkflowTestDatasetDto[]` 를 직접 반환 (래핑 없음)
- 위치: `workflow-test-datasets.controller.ts` L56-58, `@ApiOkResponse({ type: [WorkflowTestDatasetDto] })`
- 상세: 생성(POST)과 복제(POST clone)는 `@ApiCreatedWrappedResponse`를 사용해 응답을 래핑하는 반면, `list`(GET)는 `@ApiOkResponse`로 배열을 직접 반환한다. 수정(PATCH)도 `@ApiOkWrappedResponse`를 사용한다. 목록 응답만 `TransformInterceptor` 의 top-level 래핑 유무가 다른 엔드포인트와 다를 수 있어 클라이언트 역직렬화 일관성에 영향을 줄 수 있다.
- 제안: 프로젝트 전반의 목록 응답 패턴(배열 직접 반환 vs `{ data: [] }` 래핑)을 확인하고, 이 엔드포인트가 그 패턴을 따르는지 검증한다. Swagger 문서도 실제 응답 형태와 일치시킨다.

### **[INFO]** `FormModalField` 에서 `min`, `max`, `pattern` 필드 제거 — 하위 호환성 고려 필요
- 위치: `codebase/backend/src/modules/chat-channel/types.ts` L207-217 (삭제된 라인)
- 상세: `min`, `max`, `pattern` 이 `FormModalField` 인터페이스에서 제거되었다. 이 인터페이스가 외부 채널(Discord, Slack 등) 에 노출되는 API 계약에 직접 포함된다면 breaking change가 된다. 주석("서버측 검증 전용", "modal UI hint 미사용")을 보면 외부 채널 payload 에는 노출되지 않았던 것으로 보인다.
- 제안: 이 필드들이 실제 API 응답·요청 스키마에 포함된 적이 있었는지 확인한다. 서버 내부 타입으로만 사용되었다면 breaking change 아님; 외부에 노출된 경우 deprecation 절차가 필요하다.

### **[INFO]** `update` body DTO 에 빈 오브젝트 허용 — 의미 없는 PATCH 가능
- 위치: `/codebase/backend/src/modules/workflow-test-datasets/dto/update-workflow-test-dataset.dto.ts`
- 상세: `UpdateWorkflowTestDatasetDto` 의 모든 필드가 `@IsOptional()` 이므로 빈 `{}` body 로 PATCH 요청이 통과한다. 서비스에서 `if (dto.name !== undefined)` 패턴으로 처리하므로 실질 변경 없이 성공 응답이 반환된다.
- 제안: 최소 하나의 필드가 존재해야 함을 검증하는 커스텀 데코레이터 또는 `AtLeastOneField` 가드를 추가하거나, 계약 문서에 "빈 body 도 200 성공이며 no-op" 임을 명시한다.

## 요약

이번 변경은 워크플로우 테스트 데이터셋 CRUD + clone API 를 신규 추가하는 것으로, 기존 엔드포인트를 변경하지 않으므로 하위 호환성 breaking change 는 없다. 인증(Bearer + `@Roles('editor')`)과 소유자 기반 인가, 에러 응답 코드(404/403/409/400)는 대체로 적절하게 구현되어 있다. 다만 목록 API에 페이지네이션이 없고, 생성·목록과 수정·삭제 URL 계층이 혼재하며, clone 엔드포인트의 Swagger 계약이 불완전한 점이 주요 개선 포인트다. `FormModalField` 의 필드 제거는 내부 타입 정리로 판단되나 외부 노출 여부를 확인할 필요가 있다.

## 위험도

LOW

STATUS=success ISSUES=4
