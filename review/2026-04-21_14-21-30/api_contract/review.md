### 발견사항

- **[WARNING]** `PATCH /workspaces/:id` — `name` 미전달 시 no-op 경로에서 권한 검증 없이 응답
  - 위치: `workspaces.controller.ts` — `update()` 메서드, `dto.name === undefined` 분기
  - 상세: `dto.name`이 없으면 `renameWorkspace`(Admin+ 검증 포함)를 거치지 않고 현재 워크스페이스를 그대로 반환한다. 즉, 어떤 인증된 사용자도 타인 워크스페이스의 정보를 `PATCH` 요청으로 조회할 수 있다. 멤버 여부조차 확인하지 않는다.
  - 제안: no-op 분기를 제거하거나, 최소한 `assertMembership`을 호출한 후 응답하도록 수정. `name`이 없는 `PATCH` 요청 자체를 `@ApiBadRequestResponse`로 차단하는 것이 더 깔끔하다.

- **[WARNING]** `PATCH /workspaces/:id` — no-op 응답이 `null`을 반환할 수 있음
  - 위치: `workspaces.controller.ts` L121-123
  - 상세: `findById`가 `null`을 반환하면 `{ data: null }`을 HTTP 200으로 내려보낸다. Swagger 문서에 명시된 `WorkspaceDto` 응답 스키마에 `null`이 포함되지 않아 계약 불일치 발생.
  - 제안: 워크스페이스가 없으면 `NotFoundException`을 던져서 `@ApiNotFoundResponse`가 실제로 작동하도록 일관성을 유지한다.

- **[WARNING]** `renameWorkspace` — 유효성 검증 순서 역전으로 불필요한 DB 조회 발생
  - 위치: `workspaces.service.ts` — `renameWorkspace()`
  - 상세: `assertAdmin` → `name` 길이 검증 → `findOne` 순서인데, `name`이 유효하지 않을 때도 `assertAdmin`(멤버 DB 조회)이 먼저 실행된다. 작은 비효율이지만 계약 관점에서 400 응답 전에 DB를 불필요하게 hit한다.
  - 제안: 이름 유효성 검증을 `assertAdmin` 앞으로 이동. 단, DTO에 이미 `@MinLength(2) @MaxLength(100)` 가드가 있으므로 서비스 레이어의 중복 검증은 제거를 고려.

- **[WARNING]** `renameWorkspace` — 이름 길이 초과 시 예외 타입 오용
  - 위치: `workspaces.service.ts` L267-270
  - 상세: 2자 미만이거나 100자 초과인 경우 `ConflictException` (HTTP 409)을 던진다. 이 오류는 입력값 검증 실패이므로 `BadRequestException` (HTTP 400)이 맞다. Swagger 문서도 `@ApiBadRequestResponse`로 선언하고 있어 실제 응답 코드(409)와 불일치.
  - 제안: `ConflictException` → `BadRequestException`으로 교체.

- **[INFO]** `DELETE /workspaces/:id` — `@ApiNoContentResponse` 대신 `@ApiOkWrappedResponse` 사용
  - 위치: `workspaces.controller.ts` — `remove()` 메서드
  - 상세: 삭제 성공 시 `{ data: { ok: true } }` 바디를 HTTP 200으로 반환하지만, REST 관례상 DELETE 성공은 204 No Content가 일반적이다. 다른 삭제 엔드포인트(`DELETE /invitations/:id`)는 `@ApiNoContentResponse`를 쓰면서 본 엔드포인트는 다른 패턴을 따라 불일치.
  - 제안: 프로젝트 전체 관례를 통일한다. `{ data: { ok: true } }` 패턴을 유지한다면 invitation revoke도 같은 형식으로 맞추고, 그렇지 않으면 204로 변경.

- **[INFO]** `POST /workspaces/:id/leave` — 동사형 URL
  - 위치: `workspaces.controller.ts` — `leave()` 메서드
  - 상세: REST 관례상 `/leave` 같은 동사형 서브리소스 경로는 권장되지 않는다. 그러나 멤버십 탈퇴를 `DELETE /workspaces/:id/members/me`와 같은 형태로 표현하는 것이 더 일관성 있다.
  - 제안: 현재 설계로 유지하거나, `DELETE /workspaces/:id/members/me`로 변경. 어느 쪽이든 문서 명시 필요.

- **[INFO]** 프론트엔드 `workspacesApi.delete` — 응답 미처리
  - 위치: `frontend/src/lib/api/workspaces.ts` — `delete()`
  - 상세: `await apiClient.delete(...)` 후 반환값을 무시한다. 현재 백엔드가 `{ data: { ok: true } }`를 반환하므로 타입 `Promise<void>`와 실제 응답이 불일치하나 프론트엔드에서 사용하지 않아 실질적 문제는 없다.
  - 제안: 백엔드가 204로 바뀔 경우 자동으로 해결된다.

- **[INFO]** 멤버 목록 API — 페이지네이션 없음
  - 위치: `workspaces.controller.ts` — `listMembers()`, `workspacesApi.listMembers()`
  - 상세: 전체 멤버를 한 번에 반환한다. 현재는 소규모 팀을 가정하는 듯하나, 계약에 페이지네이션 파라미터가 명시되지 않으면 나중에 추가 시 breaking change가 된다.
  - 제안: 초대 목록도 동일. 향후 페이지네이션 도입 가능성을 고려해 커서 기반 응답 구조를 미리 예약해두는 것을 고려.

---

### 요약

신규 추가된 `PATCH /workspaces/:id`, `DELETE /workspaces/:id`, `POST /workspaces/:id/leave` 엔드포인트는 전반적으로 기존 API 계약(envelope 응답 구조, JWT 인증, UUID 파라미터 검증)을 잘 따르고 있다. 다만 두 가지 즉각적인 수정이 필요하다: ① `name` 미전달 시 권한 검증 없이 워크스페이스 정보를 노출하는 no-op 분기는 멤버십 검증 없이 타인 리소스 조회를 허용하는 접근 제어 허점이고, ② 입력값 길이 초과 시 `ConflictException`(409) 대신 `BadRequestException`(400)을 던져야 Swagger 문서와 실제 응답 코드가 일치한다. 프론트엔드 API 클라이언트는 백엔드 계약을 정확히 반영하고 있으며, 삭제/탈퇴 후 워크스페이스 전환 로직도 올바르게 구현되어 있다.

### 위험도

**MEDIUM**