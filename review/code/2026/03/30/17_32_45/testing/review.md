## 테스트 코드 리뷰

### 발견사항

---

**[WARNING]** `verifyEmail` 트랜잭션 내부 동작 검증 부족
- 위치: `auth.service.spec.ts` - `verifyEmail` describe 블록
- 상세: `mockDataSource.transaction`이 호출되었는지만 확인하고, 트랜잭션 내에서 `User` 업데이트, `Workspace` 생성, `WorkspaceMember` 생성이 실제로 수행되었는지 검증하지 않음. 트랜잭션 내 `mockManager.getRepository`의 각 메서드 호출 여부가 어설션되지 않아 내부 로직 변경 시 테스트가 통과될 수 있음.
- 제안:
```typescript
it('should verify email and create workspace in transaction', async () => {
  // ...기존 코드...
  const result = await service.verifyEmail('valid-token');

  expect(mockDataSource.transaction).toHaveBeenCalled();
  // 트랜잭션 내 manager 동작 검증 추가 필요
  // mockManager를 캡처하여 getRepository(...).update, .save 등을 검증
});
```

---

**[WARNING]** `verifyEmail` - 이미 인증된 유저 처리 케이스 누락
- 위치: `auth.service.spec.ts` - `verifyEmail` describe 블록
- 상세: `emailVerified: true`인 유저가 검증 토큰을 재사용하려는 경우에 대한 테스트가 없음. `auth.service.ts`에서 이 케이스를 어떻게 처리하는지 명확하지 않고, 테스트로도 검증되지 않음.
- 제안: 이미 인증된 유저의 토큰 재사용 시 동작(성공 또는 에러)을 스펙으로 정의하고 테스트 추가.

---

**[WARNING]** `generateTokens` 내 `findOrCreatePersonalWorkspace` 실패 케이스 미커버
- 위치: `auth.service.spec.ts` - `generateTokens (via login)` describe 블록
- 상세: `findOrCreatePersonalWorkspace`가 예외를 던지거나 null/undefined를 반환할 때의 동작이 테스트되지 않음. `auth.service.ts:313`에서 반환값을 non-null로 가정하므로 런타임 오류 위험.
- 제안: workspace 생성 실패 시나리오 테스트 추가.

---

**[WARNING]** `workspaces.service.spec.ts` - `findOrCreatePersonalWorkspace` race condition 미검증
- 위치: `workspaces.service.spec.ts` - `findOrCreatePersonalWorkspace` describe 블록
- 상세: `findPersonalWorkspace` 호출 후 `createPersonalWorkspace` 호출 사이의 동시성 문제(TOCTOU)를 서비스가 처리하지 않음. 테스트도 이를 검증하지 않음. 실제 운영 환경에서 동일 유저의 중복 워크스페이스 생성 위험 존재.
- 제안: DB unique constraint로 처리하거나, 서비스 레벨에서 중복 처리 로직 추가 및 테스트.

---

**[INFO]** `auth.service.spec.ts` - `mockDataSource` 트랜잭션 구현의 `getRepository` 단일 mock 반환
- 위치: `auth.service.spec.ts` L101-125
- 상세: 트랜잭션 내 `manager.getRepository(User)`, `manager.getRepository(Workspace)`, `manager.getRepository(WorkspaceMember)` 모두 동일한 mock 객체를 반환. 엔티티별로 다른 mock을 반환해야 각 레포지토리 호출을 개별 검증 가능.
- 제안:
```typescript
transaction: jest.fn().mockImplementation((cb) => {
  const mockManager = {
    getRepository: jest.fn().mockImplementation((entity) => {
      if (entity === User) return mockUserRepo;
      if (entity === Workspace) return mockWorkspaceRepo;
      if (entity === WorkspaceMember) return mockMemberRepo;
    }),
  };
  return cb(mockManager);
}),
```

---

**[INFO]** `auth.service.spec.ts` - `jwtService` unused 변수 eslint 주석 유지
- 위치: `auth.service.spec.ts` L24
- 상세: `jwtService`가 `// eslint-disable-next-line @typescript-eslint/no-unused-vars` 주석을 유지하지만, `workspacesService`의 동일 주석은 이번 diff에서 제거됨. `workspacesService`는 `generateTokens` 테스트에서 실제로 사용되므로 제거가 맞지만, `jwtService`도 실제로 사용되지 않는지 확인 필요.
- 제안: `jwtService`를 실제로 사용하지 않는다면 변수 선언 자체를 제거하거나, 사용처를 추가.

---

**[INFO]** `workspaces.service.spec.ts` - `createPersonalWorkspace` slug 형식 검증 없음
- 위치: `workspaces.service.spec.ts` - `createPersonalWorkspace` describe 블록
- 상세: `slug` 생성 로직(`localPart-randomSuffix`)이 올바르게 동작하는지 검증하지 않음. 이메일 파싱, UUID suffix 생성 등의 엣지 케이스(`@` 없는 이메일, 특수문자 포함 이메일 등) 미검증.
- 제안: slug가 예상 패턴(`/^[a-z0-9]+-[a-z0-9]{4}$/`)을 따르는지 assertion 추가.

---

**[INFO]** `auth.service.spec.ts` - `verifyEmail` 성공 케이스에서 `findUserByVerifyToken` spy 사용
- 위치: `auth.service.spec.ts` L349
- 상세: private 메서드를 `as never`로 캐스팅하여 spy하는 방식은 리팩토링 시 취약. 메서드명 변경 시 컴파일 에러 없이 테스트가 조용히 깨질 수 있음.
- 제안: `refreshTokenRepo.manager.getRepository` mock을 통해 public 인터페이스 수준에서 테스트하거나, 해당 로직을 별도 서비스로 분리 고려.

---

### 요약

전반적으로 새로운 기능(`findOrCreatePersonalWorkspace`, `verifyEmail` 트랜잭션, `DataSource` 주입)에 대한 테스트가 추가되었고 기본 happy path와 주요 에러 케이스는 커버되어 있으나, **트랜잭션 내부 동작의 세밀한 검증 부재**가 가장 큰 문제입니다. 특히 `verifyEmail`의 트랜잭션 내에서 3개의 DB 작업(User 업데이트, Workspace 생성, WorkspaceMember 생성)이 실제로 수행되는지 검증하지 않아, 트랜잭션 구현이 변경되어도 테스트가 통과될 수 있습니다. 또한 단일 `getRepository` mock이 모든 엔티티에 동일하게 반환되어 엔티티별 검증이 불가능한 구조적 문제도 개선이 필요합니다.

### 위험도

**MEDIUM**