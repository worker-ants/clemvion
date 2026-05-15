## 발견사항

### [CRITICAL] `workflows.service.spec.ts` — `andWhere` 목 상태 누적으로 `not.toHaveBeenCalledWith` 오탐 위험
- **위치**: `workflows.service.spec.ts`, `ownership is ignored in personal workspace` 테스트
- **상세**: `mockQueryBuilder`는 describe 블록 최상단의 공유 객체이고, `beforeEach`는 `TestingModule`만 재생성하고 jest mock의 call history를 초기화하지 않는다. `ownership='mine'` (team) 테스트가 먼저 실행되어 `andWhere('w.created_by = :userId', ...)` 가 호출된 뒤, personal workspace 테스트에서 `expect(mockQueryBuilder.andWhere).not.toHaveBeenCalledWith('w.created_by = :userId', ...)` 가 실행되면 이미 누적된 호출이 있어 assertion이 **false negative**로 통과하거나 **false positive**로 실패할 수 있다. Jest 프로젝트 설정에 `clearMocks: true`가 없다면 실제로 이 문제가 발생한다.
- **제안**: `beforeEach` 안에 `jest.clearAllMocks()` 추가 (또는 jest.config에 `clearMocks: true` 설정). 또는 각 ownership 테스트를 독립적인 `beforeEach`로 감싸는 `describe` 분리.

```typescript
beforeEach(async () => {
  jest.clearAllMocks(); // ← 추가
  const module: TestingModule = await Test.createTestingModule({
    ...
  }).compile();
  ...
});
```

---

### [WARNING] 컨트롤러 레벨 테스트 부재 — `@CurrentUser()` 추가 검증 없음
- **위치**: `workflows.controller.ts` `findAll` 메서드
- **상세**: `@CurrentUser() user: JwtPayload` 데코레이터가 추가되고 `user.sub`가 서비스로 전달되는 변경이 있으나, 컨트롤러 단위 테스트가 diff에 없다. JWT 페이로드에서 `sub`가 올바르게 추출되어 서비스에 전달되는지, 인증 없이 접근 시 올바른 HTTP 에러가 반환되는지 검증되지 않는다.
- **제안**: `WorkflowsController` 유닛 테스트에 다음 케이스 추가:
  - `findAll` 호출 시 `workflowsService.findAll`에 `user.sub`가 세 번째 인자로 전달되는지
  - 인증 토큰 없이 호출 시 401 응답

---

### [WARNING] DTO 유효성 검사 테스트 없음
- **위치**: `query-workflow.dto.ts` `ownership` 필드
- **상세**: `@IsIn(['mine', 'shared', 'all'])` 데코레이터가 추가되었지만 `ownership=invalid`, `ownership=MINE` (대소문자), `ownership=` (빈 문자열) 등 잘못된 값에 대해 400이 반환되는지 검증하는 테스트가 없다. 특히 `@IsOptional()`이 함께 있어서 빈 문자열 처리가 `folderId`의 `@Transform` 없이 어떻게 동작하는지 명확하지 않다.
- **제안**: DTO e2e 또는 유닛 테스트에 추가:

```typescript
it('ownership=invalid should fail validation', async () => {
  const dto = plainToInstance(QueryWorkflowDto, { ownership: 'invalid' });
  const errors = await validate(dto);
  expect(errors.some(e => e.property === 'ownership')).toBe(true);
});
```

---

### [WARNING] `workspacesService.findById` 예외 처리 테스트 없음
- **위치**: `workflows.service.ts` 85-98행
- **상세**: `ownership === 'mine' || ownership === 'shared'` 조건에서 `workspacesService.findById(workspaceId)`를 호출하는데, 이 호출이 예외를 던지거나 `null/undefined`를 반환하는 경우에 대한 테스트가 없다. 현재 코드는 `workspace?.type === 'team'` 옵셔널 체이닝으로 null을 처리하지만, `findById`가 `NotFoundException`을 throw하면 `findAll`도 예외를 전파하여 500이 될 수 있다.
- **제안**: 다음 케이스 추가:

```typescript
it('should propagate error when workspacesService.findById throws', async () => {
  mockWorkspacesService.findById.mockRejectedValueOnce(new Error('DB error'));
  await expect(
    service.findAll('ws-uuid-1', { page: 1, limit: 20, ownership: 'mine' }, 'user-1')
  ).rejects.toThrow();
});
```

---

### [WARNING] 프론트엔드 — 기존 pagination 테스트에서 `useWorkspaceStore` 상태 초기화 누락
- **위치**: `workflows-page.test.tsx`, `WorkflowsPage — pagination` describe
- **상세**: `page.tsx`는 이제 `useWorkspaceStore`로 `isTeamWorkspace`를 결정한다. pagination describe의 `beforeEach`는 workspace store를 초기화하지 않는다. ownership 테스트 suite가 먼저 실행된 경우(또는 다른 파일 순서로 인해) workspace store에 팀 워크스페이스 상태가 남아 있으면 pagination 테스트에서 ownership filter UI가 노출되어 예상치 못한 렌더링이 발생할 수 있다.
- **제안**: pagination describe의 `beforeEach`에 추가:

```typescript
useWorkspaceStore.setState({ workspaces: [], currentWorkspaceId: null, loaded: true });
```

---

### [WARNING] `ownership='all'` no-DB-hit 테스트가 predicate 미호출도 검증하지 않음
- **위치**: `workflows.service.spec.ts`, `ownership='all' does not consult workspace type` 테스트
- **상세**: `workspacesService.findById`가 호출되지 않음을 확인하지만, `andWhere`에 ownership predicate가 추가되지 않음도 함께 검증하지 않는다. 이 두 조건이 동시에 만족되어야 스펙을 완전히 충족한다.
- **제안**:

```typescript
expect(mockQueryBuilder.andWhere).not.toHaveBeenCalledWith(
  expect.stringContaining('created_by'),
  expect.anything(),
);
```

---

### [INFO] 워크스페이스 전환 시 ownership 상태 리셋 시나리오 테스트 없음
- **위치**: `workflows-page.test.tsx`
- **상세**: 팀 워크스페이스에서 `ownership=mine`을 선택한 후 개인 워크스페이스로 전환했을 때, `ownership` 상태가 `all`로 리셋되는지 확인하는 테스트가 없다. 현재 구현(`page.tsx`)에서는 워크스페이스 전환 후에도 `ownership` state가 `mine`으로 유지될 수 있고, UI만 숨겨질 뿐 query key에는 `ownership`이 포함되어 stale cache 이슈가 생길 수 있다. 다만 이는 프론트엔드 UX 레벨 이슈로 테스트 추가가 권장된다.

---

### [INFO] 기본 `findAll` 테스트에서 ownership predicate 미추가 명시적 검증 없음
- **위치**: `workflows.service.spec.ts`, `should return paginated workflows` 테스트
- **상세**: ownership 없이 호출하는 기본 테스트가 `andWhere`에 ownership predicate가 추가되지 않음을 명시적으로 assert하지 않는다. 동작 자체는 맞지만 이 케이스의 의도가 테스트 코드에 드러나지 않는다.

---

## 요약

핵심 비즈니스 로직(mine/shared/personal-ignore/all)에 대한 4개의 서비스 유닛 테스트와 3개의 프론트엔드 vitest 테스트가 추가되어 기본 커버리지는 양호하다. 그러나 `mockQueryBuilder`가 `describe` 블록 내에서 공유되고 `beforeEach`에서 명시적으로 초기화되지 않아, 테스트 실행 순서에 따라 `not.toHaveBeenCalledWith` 어서션이 오염될 위험이 존재한다(CRITICAL). 컨트롤러 레벨의 `@CurrentUser()` 통합 검증, DTO 유효성 실패 케이스, `findById` 예외 전파 케이스가 누락되어 있다. 프론트엔드는 pagination 테스트에서 workspace store 초기화가 빠져 있어 테스트 간 격리가 완전하지 않다.

## 위험도

**MEDIUM** — CRITICAL으로 표기한 mock 누적 문제가 실제 CI 환경에서 jest 설정에 따라 잠재적 false pass/fail을 유발할 수 있으나, 핵심 로직 자체의 테스트 의도는 올바르고 누락된 케이스들도 기능 오동작보다는 테스트 신뢰성 저하에 해당한다.