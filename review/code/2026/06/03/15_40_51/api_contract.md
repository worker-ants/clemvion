# API 계약(API Contract) 리뷰

대상: `PATCH /api/workspaces/:id/settings`, `GET /api/workspaces/:id/settings` 신설
생성: 2026-06-03

---

## 발견사항

### [WARNING] `PATCH :id/settings` 응답 shape이 기존 `WorkspaceDto` 스키마와 불일치
- **위치**: `workspaces.controller.ts` `updateSettings()` 반환 객체 (diff +136~+144)
- **상세**: 기존 `PATCH :id`(renameWorkspace) 는 `{ id, name, type, slug }` 를 반환하며 Swagger 에서도 `WorkspaceDto` 로 선언됐다. 신규 `updateSettings` 는 `@ApiOkWrappedResponse(WorkspaceDto, …)` 로 선언하면서도 실제 응답에 `settings` 필드를 추가 (`{ id, name, type, slug, settings }`)한다. `WorkspaceDto` 에는 `settings` 필드가 없으므로 Swagger 스키마와 실제 응답이 불일치한다. 클라이언트가 Swagger 코드젠 타입을 사용한다면 `settings` 필드를 타입에서 얻지 못하며, 반대로 `settings` 를 기대하는 클라이언트는 스키마에서 존재 여부를 확인할 수 없다.
- **제안**: `WorkspaceDto` 에 `settings` 필드를 추가하거나(기존 응답 shape 에 `settings` 가 없었으므로 breaking change 주의), 또는 `WorkspaceWithSettingsDto` 같은 별도 응답 DTO 를 신설해 해당 엔드포인트에 적용. 프론트엔드 `workspacesApi.updateSettings` 가 `Promise<void>` 를 반환해 응답 body 를 무시하고 있으므로 현재 기능 영향은 없으나 계약 문서 불일치는 향후 소비자에게 오해를 유발한다.

---

### [WARNING] `GET :id/settings` 응답 Swagger 선언에 `UpdateWorkspaceSettingsDto` 재사용 — 입력 DTO를 출력 스키마로 사용
- **위치**: `workspaces.controller.ts` `getSettings()`, `@ApiOkWrappedResponse(UpdateWorkspaceSettingsDto, …)` (diff +154)
- **상세**: `UpdateWorkspaceSettingsDto` 는 요청 바디 DTO 이며 class-validator 데코레이터(`@IsArray`, `@Matches` 등)를 포함한다. 이를 응답 Swagger 스키마로 재사용하면 개념적으로 입력 계약과 출력 계약이 동일 DTO 를 공유하게 된다. 현재 필드가 `interactionAllowedOrigins: string[]` 하나라 실질적 오류는 없지만, 향후 요청 전용 필드(예: 검증 조건이 다른 필드)가 추가되면 즉시 불일치가 발생한다. 또한 Swagger UI 에서 요청/응답 스키마가 동일하게 표시되어 혼란을 준다.
- **제안**: `WorkspaceSettingsDto` (또는 `WorkspaceSettingsResponseDto`)를 응답 전용으로 별도 선언하고 `@ApiOkWrappedResponse` 에 적용.

---

### [WARNING] `PATCH :id/settings` 에러 코드 `ADMIN_REQUIRED` — 공식 에러 카탈로그 미등재 상태로 API 계약에 포함
- **위치**: `workspaces.service.ts` `assertAdmin()` (기존 코드), e2e 테스트 `viewerRes.body.error.code === 'ADMIN_REQUIRED'` (diff +492)
- **상세**: `ADMIN_REQUIRED` 는 기존 `assertAdmin()` 이 이미 발행하던 코드이나 `spec/5-system/3-error-handling.md §1.2` 공식 카탈로그에 미등재다. e2e 테스트가 `viewerRes.body.error.code === 'ADMIN_REQUIRED'` 를 assert 함으로써 이 코드가 공개 API 계약의 일부가 된다. 클라이언트가 이 코드를 사용해 분기 처리를 구현할 수 있는데, 카탈로그에 없으면 다른 도메인에서 동일 코드를 다른 의미로 재정의하거나 404 → `WORKSPACE_NOT_FOUND` 처럼 카탈로그에 명시된 코드만 처리하는 클라이언트가 403 을 범용 처리로 폴백할 수 있다. API 계약의 에러 코드가 SoT 에 없는 상태는 유지보수 위험이다.
- **제안**: `spec/5-system/3-error-handling.md §1.2` 에 `ADMIN_REQUIRED | 관리자 권한 필요 | role ∉ {owner, admin} | 403` 행을 공식 등재. 기존 403 응답은 `FORBIDDEN` 이 있으나 `ADMIN_REQUIRED` 는 더 구체적인 코드이므로 동시 등재 후 사용 위치별 통일도 결정 필요.

---

### [INFO] `PATCH :id/settings` 비멤버 접근 시 응답 코드 일관성 — `ADMIN_REQUIRED` vs `NOT_A_MEMBER`/`FORBIDDEN`
- **위치**: `workspaces.service.ts` `assertAdmin()`, e2e 테스트 비멤버 케이스 `expect(outsiderRes.body.error.code).toBe('ADMIN_REQUIRED')` (diff +499~+500)
- **상세**: 비멤버(다른 워크스페이스 owner)가 `PATCH :id/settings` 를 호출하면 `assertAdmin()` 이 멤버가 아님을 감지하고 403 `ADMIN_REQUIRED` 를 반환한다. 그러나 의미상 비멤버는 "권한 부족"이 아니라 "멤버가 아님"에 해당한다. 일부 엔드포인트(`deleteWorkspace`)는 유사 상황에서 `OWNER_REQUIRED`, `NOT_A_MEMBER` 로 세분화한다. `ADMIN_REQUIRED` 를 멤버 여부 검사에서도 반환하면 클라이언트가 "비멤버"와 "권한 부족" 을 구분할 수 없다.
- **제안**: `assertAdmin()` 내부에서 멤버 없음 / 역할 부족 케이스를 분리해 멤버가 없으면 `FORBIDDEN`(또는 `NOT_A_MEMBER`), 역할 부족이면 `ADMIN_REQUIRED` 를 반환하도록 개선하거나, 현 동작이 의도적이면 API 문서에 "비멤버도 403 ADMIN_REQUIRED" 임을 명시. 현재 e2e 가 두 케이스를 모두 `ADMIN_REQUIRED` 로 assert 하므로 일관성 자체는 있으나 의미론적 명확성 부족.

---

### [INFO] `UpdateWorkspaceSettingsDto` 에 `@IsOptional()` 없음 — 빈 body PATCH 불가
- **위치**: `update-workspace-settings.dto.ts` (diff 전체), `interactionAllowedOrigins: string[]` 필드
- **상세**: `interactionAllowedOrigins` 필드에 `@IsOptional()` 이 없으므로 `PATCH :id/settings` 호출 시 이 필드를 반드시 포함해야 한다. 현재 단일 필드 DTO 이므로 실질 문제는 없지만, 향후 설정 키가 추가될 때 부분 갱신(`interactionAllowedOrigins` 만 변경)이 불가능해져 DTO 전체를 수정해야 하는 계약이 된다. `description` 에 "기존 설정의 다른 키는 보존됩니다"라고 명시했으나 DTO 레벨에서는 전체 필드 전송을 강제하는 구조다.
- **제안**: 향후 확장성을 고려해 `@IsOptional()` 추가 및 undefined 시 기존 값 보존 로직 적용. 현재는 단일 필드라 즉각적 문제 없음.

---

### [INFO] `GET :id/settings` — `settings` 가 null인 경우 workspace 조회 후 반환값 보장
- **위치**: `workspaces.service.ts` `getWorkspaceSettings()` (diff +408~+413)
- **상세**: `workspace.settings?.interactionAllowedOrigins` 가 `Array.isArray` 검사를 통과하지 않으면 빈 배열 `[]` 을 반환한다. 이는 "미설정 = 빈 배열" 과 "명시적 빈 배열 설정" 이 동일하게 보인다는 의미다. API 계약 관점에서 클라이언트가 "설정 없음"과 "빈 목록 설정"을 구분해야 한다면 `null` vs `[]` 구분이 필요하다. 현재 plan 에 "빈 배열 = 추가 origin 없음"으로 정의되어 있으므로 둘의 구분이 중요하지 않을 수 있으나, Swagger `ApiOkWrappedResponse` 에서 반환 타입이 `UpdateWorkspaceSettingsDto` 이므로 `null` 케이스가 표현되지 않는다.
- **제안**: 현재 설계("빈 배열 = 미설정과 동일")가 의도적이라면 API 문서 `description` 에 명시. 구분이 필요하다면 `null | string[]` 반환 타입으로 변경.

---

## 요약

이번 변경은 `PATCH /api/workspaces/:id/settings`(Admin+)와 `GET /api/workspaces/:id/settings`(멤버) 두 엔드포인트를 신설하는 것으로, API 계약의 핵심 요소(인증/인가, URL 설계, 요청 검증, 페이지네이션 부재 적절)는 대체로 잘 구현되어 있다. 컨트롤러 레벨 `@UseGuards(JwtAuthGuard)` 가 클래스 전체에 적용되어 있고, UUID 파이프 검증, 배열 최대 크기 및 형식 정규식 검증도 충분하다. 그러나 두 가지 WARNING 이 API 계약 일관성에 영향을 준다: (1) `PATCH :id/settings` 실제 응답에 `settings` 필드가 포함되지만 Swagger 선언 스키마(`WorkspaceDto`)에는 없어 계약-구현 불일치가 발생하며, (2) `GET :id/settings` Swagger 선언에 요청 DTO(`UpdateWorkspaceSettingsDto`)를 응답 스키마로 재사용해 입출력 계약이 혼재된다. `ADMIN_REQUIRED` 에러 코드의 공식 카탈로그 미등재도 외부 클라이언트 통합 시 예측 가능성을 낮춘다. 하위 호환성 측면에서 기존 `PATCH :id`(rename) 와 경로가 분리되어 있고 기존 클라이언트에 대한 breaking change 는 없다.

---

## 위험도

MEDIUM
