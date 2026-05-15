### 발견사항

---

**[WARNING] `roleLabelKey` 함수 중복 정의**
- 위치: `sidebar.tsx:21-32`, `page.tsx:49-60`
- 상세: 동일한 `roleLabelKey(role: WorkspaceRole): TranslationKey` 함수가 두 파일에 독립적으로 존재. role → i18n key 매핑은 단일 진실 공급원이어야 함.
- 제안: `@/lib/utils/workspace.ts` 또는 `@/lib/i18n/workspace-keys.ts`에 공통 함수로 추출하고 양쪽에서 import.

---

**[WARNING] `update` 컨트롤러의 no-op 분기 — 서비스 책임 위반**
- 위치: `workspaces.controller.ts:116-127`
- 상세: `dto.name === undefined`일 때 컨트롤러가 직접 `findById`를 호출하고 응답을 조립하는 로직을 담당. 컨트롤러는 라우팅·인증·직렬화만 담당해야 하며, 비즈니스 분기는 서비스 레이어 책임. 또한 `ws`가 `null`이면 `{ data: null }`을 200으로 반환하는데, 이는 `@ApiNotFoundResponse` 계약과 불일치.
- 제안: `renameWorkspace`가 `name`을 필수로 받도록 하거나, DTO 검증에서 `name` 없는 요청을 400으로 차단. no-op 분기 자체를 제거하면 컨트롤러가 단순해짐.

```typescript
// 컨트롤러
async update(@CurrentUser() user: JwtPayload, @Param('id', new ParseUUIDPipe()) workspaceId: string, @Body() dto: UpdateWorkspaceDto) {
  const ws = await this.workspacesService.renameWorkspace(workspaceId, dto.name!, user.sub);
  return { data: { id: ws.id, name: ws.name, type: ws.type, slug: ws.slug } };
}
```

---

**[WARNING] `renameWorkspace`에서 이름 검증 실패 시 `ConflictException` 오용**
- 위치: `workspaces.service.ts:263-268`
- 상세: 이름 길이 검증 실패는 "충돌(Conflict, 409)"이 아닌 "잘못된 요청(Bad Request, 400)". `createTeam`도 동일 패턴으로 `ConflictException`을 사용 중. 기존 코드의 오류를 신규 코드가 그대로 복사함.
- 제안: `BadRequestException` 사용. DTO 레이어에서 `@MinLength(2)`, `@MaxLength(100)` 검증으로 처리하면 서비스 내 중복 검증도 제거 가능 (DTO의 `UpdateWorkspaceDto`는 이미 이 데코레이터를 가짐).

---

**[WARNING] `deleteWorkspace`에서 권한과 존재 확인 사이 race condition + 쿼리 비효율**
- 위치: `workspaces.service.ts:278-309`
- 상세: `getMemberRole` → `findOne` 순서로 workspace를 두 번 조회. `getMemberRole`에서 이미 workspace 존재를 간접 확인하지만, `findOne`이 `null`을 반환하는 경우(멤버는 있으나 workspace가 삭제된 극단적 race)를 위해 별도 쿼리 실행. `renameWorkspace`도 동일 패턴(assertAdmin + findOne = 2회 조회).
- 제안: workspace를 먼저 로드하고 membership을 join하거나, `assertAdmin`에 workspace 엔티티를 반환하도록 리팩토링.

---

**[INFO] `workspaceRole` prop이 `DangerZoneTab`에서 미사용**
- 위치: `page.tsx:DangerZoneTabProps` 인터페이스 및 구조분해
- 상세: `workspaceRole: WorkspaceRole`이 인터페이스에 선언되고 destructuring에도 포함되어 있으나 컴포넌트 본문에서 전혀 사용되지 않음. `isOwner`로 충분히 대체됨.
- 제안: `workspaceRole` prop 제거.

```typescript
// Before
function DangerZoneTab({ workspaceId, workspaceName, workspaceRole, isTeam, isOwner, onAfterMutation }: DangerZoneTabProps)
// After
function DangerZoneTab({ workspaceId, workspaceName, isTeam, isOwner, onAfterMutation }: DangerZoneTabProps)
```

---

**[INFO] `renderWorkspaceGroup`이 function이 아닌 render function 패턴**
- 위치: `sidebar.tsx:56-91`
- 상세: `renderWorkspaceGroup`은 JSX를 반환하는 일반 함수이지만 Props interface를 사용하는 컴포넌트 시그니처를 따름. React DevTools에서 추적되지 않고, 내부에서 `key={title}`을 직접 설정하나 `key`는 렌더링 호출부에서 설정해야 의미가 있음.
- 제안: `function WorkspaceGroup(props: WorkspaceGroupProps)`로 대문자 컴포넌트로 전환하거나, 단순 렌더 함수면 인라인으로 처리.

---

**[INFO] `WorkspaceInvitationSummary` 타입 파일 하단 배치**
- 위치: `workspaces.ts` 파일 하단
- 상세: `WorkspaceMemberSummary`는 파일 상단에 선언되나 `WorkspaceInvitationSummary`는 파일 맨 하단에 선언. 타입 선언 위치가 비일관적이어서 파일 전체를 스캔해야 타입을 찾을 수 있음.
- 제안: 모든 export interface를 파일 상단에 모으거나, 모두 하단에 모으는 것으로 통일.

---

**[INFO] `cn` import 미사용 가능성**
- 위치: `page.tsx` import
- 상세: `cn`이 import되어 있으나 실제 사용처는 `DangerZoneTab` 내부의 `cn("border-...")` 한 곳. 이는 `cn` 없이 string literal로도 충분. 불필요한 dependency를 줄이거나 실제로 다른 조건부 클래스 조합에서 사용하도록 확장.
- 제안: 현재 사용처는 그대로 두되, 실제로 `cn`이 필요한 조건부 조합이 아니라면 string literal로 대체.

---

### 요약

전체적으로 잘 구조화된 변경이며, 서비스-컨트롤러 레이어 분리, DTO 기반 검증, i18n 일관성 모두 양호하다. 주요 유지보수 위험은 두 가지다: `roleLabelKey` 함수 중복이 향후 role 추가 시 두 곳을 동시에 수정해야 하는 암묵적 의무를 만들며, 컨트롤러의 no-op 분기와 `ConflictException` 오용은 HTTP 계약 불일치를 일으켜 클라이언트 코드에서 혼란을 야기할 수 있다. `deleteWorkspace`의 이중 DB 쿼리는 성능보다 가독성 문제로, 의도가 숨겨진 코드가 된다. 나머지는 minor한 일관성 이슈로 현재 규모에서는 즉각적 위험은 낮다.

### 위험도

**LOW**