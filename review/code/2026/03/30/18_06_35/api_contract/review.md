### 발견사항

- **[WARNING]** `POST /:id/execute` 응답 구조 불일치
  - 위치: `workflows.controller.ts` - `execute()` 메서드
  - 상세: 기존 API 응답은 `{ data: T }` 래퍼를 사용하지만, execute 엔드포인트는 `{ data: { executionId } }` 이중 중첩 구조를 반환. 프론트엔드에서도 `(response.data as { data: { executionId: string } }).data`로 이중 언래핑하여 보완하고 있으나, 다른 엔드포인트와 패턴이 다름
  - 제안: `return { executionId }` 또는 `return { data: { executionId } }`로 통일. 현재 axios 클라이언트가 `response.data`를 반환하므로 `return { data: { executionId } }` 구조라면 클라이언트에서 `response.data.data.executionId`가 아닌 `response.data.executionId`로 접근해야 일관성 유지 가능

- **[WARNING]** `POST /:id/save` 엔드포인트 인증 누락
  - 위치: `workflows.controller.ts` - `saveCanvas()` 메서드
  - 상세: `@CurrentUser()` 데코레이터가 없어 사용자 인증 없이 워크플로우 저장이 가능. `execute()`는 `@CurrentUser()`를 통해 `user.sub`을 전달하지만 `saveCanvas()`는 `workspaceId`만 검증함
  - 제안: `@CurrentUser() user: JwtPayload` 파라미터 추가 및 소유권 확인 로직 추가

- **[WARNING]** `saveCanvas` API의 엣지 전략이 클라이언트 계약과 불일치
  - 위치: `workflows.service.ts` - `saveCanvas()`, `workflows.ts` (프론트엔드 API)
  - 상세: 서버는 엣지를 전량 삭제 후 재생성(delete-all-recreate) 전략을 사용하지만, 프론트엔드 `SaveCanvas` 요청 타입에는 `edges[].id` 필드가 없음. 서버의 `SaveCanvasEdgeDto`에도 `@IsOptional() id?` 필드가 있으나 실제로 사용되지 않아 클라이언트가 엣지 ID를 보낼 경우 무시됨. 엣지 ID가 매번 새로 생성되므로 참조 일관성 문제 가능
  - 제안: 클라이언트 타입과 서버 DTO 간 계약을 명확히 하거나, 엣지 ID를 클라이언트가 생성하여 서버에 전달하는 방식으로 통일

- **[INFO]** `POST /:id/execute` HTTP 상태 코드 202 Accepted 사용
  - 위치: `workflows.controller.ts` - `execute()` 메서드
  - 상세: `@HttpCode(HttpStatus.ACCEPTED)`를 사용하여 비동기 실행 의미를 올바르게 표현함. 그러나 실제로 `executionEngineService.execute()`는 현재 동기적으로 실행 완료 후 `executionId`를 반환하므로 의미론적 불일치 가능
  - 제안: 향후 비동기 처리 전환 계획이 없다면 `200 OK`를 사용. 비동기 처리 의도라면 현재처럼 `202`가 적절하나, 실행 엔진이 실제로 비동기가 되어야 함

- **[INFO]** `SaveCanvasNodeDto`의 `id` 필드 타입 검증 미흡
  - 위치: `save-canvas.dto.ts` - `SaveCanvasNodeDto.id`
  - 상세: `id` 필드가 `@IsString() @MaxLength(36)`로만 검증되며 UUID 형식 검증이 없음. 새로 생성된 노드 ID는 `crypto.randomUUID()`로 생성되므로 UUID 형식이나, 기존 노드 ID도 UUID이므로 `@IsUUID()`를 추가하는 것이 안전함
  - 제안: `@IsUUID()` 데코레이터 추가

- **[INFO]** `saveCanvas` 응답에 HTTP 상태 코드 명시 없음
  - 위치: `workflows.controller.ts` - `saveCanvas()` 메서드
  - 상세: `@HttpCode()` 데코레이터가 없어 기본 200이 사용됨. `POST` 요청에 200이 사용되는 것은 RFC 표준상 허용되나, 기존 `create()`가 `201 Created`를 사용하는 패턴과 다름. Upsert 시맨틱스이므로 200이 적절할 수 있으나 명시적으로 선언 권장

---

### 요약

이번 변경은 `POST /:id/execute`와 `POST /:id/save`라는 두 개의 신규 엔드포인트를 추가하고, 실행 엔진에 WebSocket 이벤트 발행 기능을 통합한 것이 핵심이다. API 계약 관점에서 가장 주목할 문제는 `execute` 응답의 이중 중첩 구조(`{ data: { executionId } }`)로 인해 프론트엔드에서 이례적인 이중 언래핑이 발생하는 점, 그리고 `saveCanvas` 엔드포인트에 `@CurrentUser()` 인증 데코레이터가 누락된 점이다. `saveCanvas`의 엣지 전략(전량 재생성)은 클라이언트 타입 정의와 계약 수준에서 명확히 문서화되지 않아 혼란 여지가 있다. 전반적으로 신규 엔드포인트의 기능적 구현은 양호하나, 인증 일관성과 응답 형식 통일성 측면에서 보완이 필요하다.

### 위험도
**MEDIUM**