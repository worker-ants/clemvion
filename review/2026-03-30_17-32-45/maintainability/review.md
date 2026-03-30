### 발견사항

---

**[WARNING] `verifyEmail`에서 워크스페이스 생성 로직 중복**
- 위치: `auth.service.ts` `verifyEmail()` 내 트랜잭션 블록 (L93~L128)
- 상세: `WorkspacesService.createPersonalWorkspace()`와 동일한 워크스페이스/멤버 생성 로직이 `AuthService` 트랜잭션 내에 인라인으로 복사되어 있음. slug 생성 방식, 필드 구성이 동일한 로직이 두 곳에 존재하여 한쪽 변경 시 다른 쪽이 누락될 위험이 있음.
- 제안: `WorkspacesService.createPersonalWorkspace()`가 EntityManager를 선택적으로 받도록 시그니처 변경하거나, `AuthModule`이 트랜잭션을 직접 관리하기보다 `WorkspacesService`에게 트랜잭션 컨텍스트를 전달하는 패턴 적용.

```ts
// WorkspacesService
async createPersonalWorkspace(
  userId: string, userName: string, email: string,
  manager?: EntityManager,
): Promise<Workspace> {
  const repo = manager ? manager.getRepository(Workspace) : this.workspaceRepository;
  // ...
}
```

---

**[WARNING] `AuthService`가 도메인 엔티티(`Workspace`, `WorkspaceMember`)에 직접 의존**
- 위치: `auth.service.ts` import (L14~L15), 트랜잭션 블록 전체
- 상세: `AuthService`가 `WorkspacesService`라는 추상화를 통해 워크스페이스를 다뤄야 하는데, 트랜잭션 처리를 위해 `Workspace`, `WorkspaceMember` 엔티티를 직접 import하고 조작함. 레이어 경계 위반으로 워크스페이스 도메인 변경 시 `AuthService`도 함께 수정해야 하는 결합도가 생김.
- 제안: `WorkspacesService`가 트랜잭션 매니저를 받을 수 있도록 확장하거나, 별도의 `WorkspaceCreationService`를 도입해 책임을 분리.

---

**[WARNING] 매직 넘버 분산**
- 위치: `auth.service.ts` 트랜잭션 블록 내 `uuidv4().substring(0, 4)` (L107)
- 상세: `4`라는 숫자가 `AuthService`와 `WorkspacesService.createPersonalWorkspace()` 양쪽에 각각 하드코딩되어 있음. `BCRYPT_ROUNDS`처럼 상수로 추출된 것과 불일치.
- 제안: `WorkspacesService`에 `SLUG_SUFFIX_LENGTH = 4` 상수 정의 후 공유.

---

**[WARNING] `as never` 타입 단언 남용**
- 위치: `auth.service.spec.ts` L342, L343
- 상세: `workspacesService.findOrCreatePersonalWorkspace.mockResolvedValue({ id: 'new-ws-uuid' } as never)` — `as never`는 타입 체크를 완전히 무력화하는 강력한 단언. 반환 타입이 `Workspace`임을 알 수 있는데 `as never` 대신 `as Workspace` 혹은 `Partial<Workspace>`를 쓰는 것이 의도를 명확히 하고 리팩터링 시 타입 오류를 잡아줌.
- 제안: `as Partial<Workspace>` 또는 목업 객체에 필요한 필드를 명시적으로 추가.

---

**[WARNING] Private 메서드 spying으로 내부 구현에 결합된 테스트**
- 위치: `auth.service.spec.ts` `verifyEmail` 테스트 블록 (L348, L368, L381)
- 상세: `jest.spyOn(service as never, 'findUserByVerifyToken' as never)` — private 메서드를 직접 spying하여 테스트가 내부 구현 세부사항에 결합됨. 메서드명 변경 또는 리팩터링 시 테스트가 타입 오류 없이 조용히 깨질 위험.
- 제안: `findUserByVerifyToken`이 내부적으로 `RefreshToken` 리포지토리의 매니저를 사용하므로, `mockRefreshTokenRepo.manager.getRepository`의 `findOne` mock을 통해 간접 제어하는 방식으로 교체.

---

**[INFO] `generateTokens` 테스트 describe 네이밍 불일치**
- 위치: `auth.service.spec.ts` L322 `describe('generateTokens (via login)', ...)`
- 상세: `generateTokens`는 private 메서드이고 실제로 `login`을 테스트하는데, describe 이름에 `(via login)` 부연이 필요한 것 자체가 테스트 구조의 어색함을 드러냄. 기존 `describe('login', ...)` 블록에 통합하는 것이 더 자연스러움.
- 제안: 해당 테스트 케이스를 기존 `describe('login')` 블록으로 이동.

---

**[INFO] `mockDataSource` 변수 선언 후 단일 테스트에서만 사용**
- 위치: `auth.service.spec.ts` L33, L133
- 상세: `mockDataSource`가 `verifyEmail` 테스트 하나에서만 `transaction` 호출 여부 확인에 쓰임. 해당 어설션의 가치가 낮음 — 트랜잭션이 호출됐다는 사실보다 결과(이메일 인증 완료, 토큰 반환)가 더 의미 있는 검증.
- 제안: `expect(mockDataSource.transaction).toHaveBeenCalled()` 제거 후 결과 중심 검증만 유지, 또는 트랜잭션 내 동작(user update 호출 여부)을 검증하도록 개선.

---

### 요약

전체적으로 코드는 읽기 쉽고 네이밍 컨벤션도 일관적이나, 가장 큰 유지보수성 문제는 **워크스페이스 생성 로직의 이중화**다. 트랜잭션 원자성을 확보하기 위해 `AuthService`가 `Workspace`/`WorkspaceMember` 엔티티를 직접 조작하는 선택이 레이어 경계를 깨뜨렸고, 그 결과 `WorkspacesService.createPersonalWorkspace()`와 동일한 로직(slug 생성, 엔티티 구성)이 두 곳에 존재한다. 테스트 코드는 `as never` 단언과 private 메서드 spying으로 타입 안전성과 리팩터링 내성이 일부 저하되어 있다. 이 문제들을 해소하려면 `WorkspacesService`가 EntityManager를 선택적으로 주입받는 패턴을 도입해 서비스 경계를 유지하면서도 트랜잭션 참여가 가능하도록 개선하는 것이 권장된다.

### 위험도

**MEDIUM**