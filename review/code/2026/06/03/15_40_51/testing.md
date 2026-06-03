# 테스트(Testing) 코드 리뷰

## 발견사항

### [INFO] UpdateWorkspaceSettingsDto — 단위 테스트 부재
- 위치: `codebase/backend/src/modules/workspaces/dto/update-workspace-settings.dto.ts`
- 상세: DTO 자체의 class-validator 데코레이터(`@Matches`, `@ArrayMaxSize`, `@MaxLength`, `@IsArray`, `@IsString`)가 예상대로 동작하는지 검증하는 별도 단위 테스트가 없다. 현재 서비스 스펙에서 DTO 인스턴스를 직접 생성하거나 `class-validator`의 `validate()`를 호출하는 테스트가 없으므로, 정규식 엣지 케이스가 구현 코드 수준에서만 검증된다.
- 제안: `update-workspace-settings.dto.spec.ts`를 추가해 다음 케이스를 커버할 것: (1) 유효한 origin 목록, (2) path/query가 포함된 origin 거부, (3) 후행 슬래시 포함 origin(정규식 거부 여부), (4) 100개 초과 배열, (5) 2048자 초과 문자열, (6) 빈 배열 허용.

### [WARNING] 정규식과 실제 서비스 정규화 로직 간 불일치 — 테스트 커버 누락
- 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` (`updateWorkspaceSettings`), `update-workspace-settings.dto.ts` (`@Matches` 정규식)
- 상세: DTO의 `@Matches(/^https?:\/\/[^/\s?#]+$/i)` 정규식은 후행 슬래시(`/`)를 path로 간주해 거부한다. 그러나 서비스의 `o.replace(/\/$/, '')` 정규화는 후행 슬래시를 허용한다는 전제로 작성되어 있다. 즉, `https://example.com/`은 DTO 검증 단계에서 이미 거부되므로 서비스의 trailing slash 정규화 코드는 실질적으로 실행되지 않는다. 현재 서비스 스펙의 테스트(`merges interactionAllowedOrigins... normalizes trailing slash`)는 `https://example.com/`을 입력으로 주어 정규화를 검증하지만, 이 입력은 실제 요청 흐름에서 DTO 검증으로 이미 차단된다. 이는 mock 기반 서비스 테스트가 DTO 검증 레이어를 우회하기 때문에 발생하는 테스트-실제 동작 괴리다.
- 제안: (1) DTO 정규식이 trailing slash를 실제로 거부하는지 DTO 단위 테스트로 명확히 확인하고, (2) 만약 trailing slash를 허용하는 것이 의도라면 DTO 정규식을 `^https?:\/\/[^\s?#]+$`로 수정 후 서비스에서 정규화하도록 설계를 일치시키며, (3) e2e 또는 통합 테스트에서 trailing slash 입력에 대한 전체 흐름 결과를 검증할 것.

### [WARNING] 비멤버의 updateWorkspaceSettings 403 응답 코드 불일치 — 테스트 누락
- 위치: `codebase/backend/test/workspace-rbac.e2e-spec.ts` (G 테스트), `codebase/backend/src/modules/workspaces/workspaces.service.ts`
- 상세: e2e 테스트에서 비멤버(outsider)의 `PATCH /settings` 응답을 `ADMIN_REQUIRED`로 expect한다. 그러나 `assertAdmin()`은 내부적으로 `getMemberRole()`을 먼저 호출하고, 멤버가 아닌 경우와 role이 부족한 경우 모두 `ADMIN_REQUIRED`를 반환하는지 확인이 필요하다. 서비스 스펙 테스트에서는 "비멤버"(memberRepo.findOne → null) 케이스가 `updateWorkspaceSettings`에 대해 직접 테스트되지 않고, 오직 editor/viewer 케이스만 존재한다. `assertAdmin()`이 멤버 없음과 역할 부족을 같은 에러 코드로 처리하는지 단위 테스트로 커버되지 않는다.
- 제안: 서비스 스펙에 `memberRepo.findOne.mockResolvedValue(null)` 케이스(비멤버)에 대한 `updateWorkspaceSettings` 테스트를 추가해 반환 에러 코드가 `ADMIN_REQUIRED`인지 명시적으로 검증할 것.

### [WARNING] getWorkspaceSettings — 워크스페이스 미존재(WORKSPACE_NOT_FOUND) 케이스 테스트 누락
- 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` (`getWorkspaceSettings` 블록)
- 상세: `getWorkspaceSettings` 서비스 메서드는 멤버 확인 후 워크스페이스를 조회하며, 워크스페이스가 없으면 `NotFoundException(WORKSPACE_NOT_FOUND)`을 던진다. 그러나 스펙 테스트는 멤버+워크스페이스 존재, 멤버+키 부재, 비멤버 3가지만 커버하고 멤버이지만 워크스페이스가 삭제된 경우(findOne → null)는 테스트하지 않는다.
- 제안: `it('throws WORKSPACE_NOT_FOUND when workspace is deleted mid-flight', ...)` 케이스를 추가해 `memberRepo.findOne.mockResolvedValue({ role: 'viewer' })`이면서 `workspaceRepo.findOne.mockResolvedValue(null)`인 경우 `WORKSPACE_NOT_FOUND` 에러가 발생하는지 검증할 것.

### [WARNING] 컨트롤러 수준 테스트 부재
- 위치: `codebase/backend/src/modules/workspaces/workspaces.controller.ts` (신규 `updateSettings`, `getSettings` 엔드포인트)
- 상세: `updateSettings`와 `getSettings` 컨트롤러 메서드에 대한 컨트롤러 단위 테스트가 리뷰 대상 파일 중 존재하지 않는다. 현재 서비스 스펙과 e2e 스펙만 있어, 컨트롤러가 응답을 올바르게 매핑하는지(`{ data: { id, name, type, slug, settings } }` shape), `ParseUUIDPipe`가 잘못된 UUID에 400을 반환하는지 등을 컨트롤러 수준에서 검증하지 않는다.
- 제안: 기존 `workspaces.controller.spec.ts`에 `updateSettings`와 `getSettings` 케이스를 추가해 (1) 올바른 UUID + 유효 body → 서비스 호출 및 응답 shape 확인, (2) 잘못된 UUID → 400 검증.

### [INFO] 프론트엔드 EmbedOriginsCard/EmbedOriginsEditor — 컴포넌트 테스트 부재
- 위치: `codebase/frontend/src/app/(main)/workspace/settings/page.tsx` (`EmbedOriginsCard`, `EmbedOriginsEditor`)
- 상세: 신규 추가된 `EmbedOriginsCard`와 `EmbedOriginsEditor` 컴포넌트에 대한 React Testing Library 등의 컴포넌트 테스트가 없다. 클라이언트 사이드 검증 로직(`ORIGIN_PATTERN`, 중복 체크, 추가/삭제 상태 관리)과 `canEdit` 게이트 기반 UI 분기가 테스트로 커버되지 않는다.
- 제안: 다음 케이스를 포함하는 컴포넌트 테스트 추가를 고려할 것: (1) 유효하지 않은 origin 입력 시 toast.error 호출, (2) 중복 origin 추가 시 거부, (3) `canEdit=false`일 때 폼 미노출 확인, (4) 저장 성공 시 `queryClient.invalidateQueries` 호출, (5) 초기 origins 목록 렌더링.

### [INFO] workspacesApi.updateSettings — 반환 타입 불일치 (void vs workspace)
- 위치: `codebase/frontend/src/lib/api/workspaces.ts` (`updateSettings`)
- 상세: `updateSettings`는 `Promise<void>`로 선언되어 있지만, 실제 백엔드는 `{ data: { id, name, type, slug, settings } }`를 반환한다. 현재 프론트엔드에서 응답 데이터를 무시하므로 기능상 문제는 없으나, 타입이 실제 응답과 불일치해 추후 응답 활용 시 오류를 유발할 수 있다. 이 불일치를 검증하는 타입 레벨 테스트가 없다.
- 제안: API 클라이언트 레벨에서 반환 타입을 `Promise<WorkspaceDto>`로 수정하거나, 의도적으로 void로 유지하는 이유를 주석으로 명시할 것. 단위 테스트에서 응답 shape 검증 추가 고려.

### [INFO] e2e 테스트 — admin 역할자의 PATCH /settings 200 케이스 미커버
- 위치: `codebase/backend/test/workspace-rbac.e2e-spec.ts` (G 테스트)
- 상세: e2e 테스트(G)는 owner의 성공 케이스와 viewer/비멤버의 403 케이스를 검증하지만, admin 역할자가 PATCH /settings를 성공적으로 호출하는 케이스를 e2e 수준에서 검증하지 않는다. 서비스 스펙에서는 admin 케이스를 커버하지만, 실제 HTTP 요청 흐름에서 admin 토큰으로 200이 반환되는지는 확인하지 않는다.
- 제안: e2e 테스트 G에 admin을 초대하고 `PATCH /settings`를 호출해 200을 받는 케이스를 추가할 것.

---

## 요약

백엔드 서비스 및 e2e 수준의 테스트는 전반적으로 잘 구성되어 있다. RBAC 케이스(owner 성공, viewer/비멤버 403, GET 멤버 200)와 settings 머지/정규화 동작이 모두 커버된다. 다만 가장 주의해야 할 문제는 DTO 정규식(`@Matches`)과 서비스 trailing slash 정규화 코드 간의 논리적 불일치로, 현재 서비스 스펙 테스트가 실제 운영 흐름에서는 도달 불가한 입력을 mock으로 주입해 테스트하고 있어 커버리지가 과대 표시된 상태다. 또한 비멤버에 대한 `updateWorkspaceSettings` 에러 코드 검증 누락, `getWorkspaceSettings`의 WORKSPACE_NOT_FOUND 케이스 누락, 컨트롤러 단위 테스트 부재가 실용적 위험 요소다. 프론트엔드 컴포넌트 테스트는 완전히 부재하나 해당 레이어 테스트가 프로젝트 관행에 따라 선택적일 경우 INFO 수준으로 간주할 수 있다.

---

## 위험도

MEDIUM
