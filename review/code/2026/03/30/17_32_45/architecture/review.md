## 아키텍처 코드 리뷰

### 발견사항

---

**[CRITICAL] AuthService의 레이어 책임 위반 — 워크스페이스 생성 로직 직접 구현**
- 위치: `auth.service.ts` L93–122, `verifyEmail()` 내부
- 상세: `AuthService`가 `DataSource`를 직접 주입받아 `Workspace`, `WorkspaceMember` 엔티티를 직접 조작함. 이는 Auth 레이어가 Workspace 도메인의 영속성 세부사항(slug 생성, 멤버 추가)을 알아야 하는 SRP 위반이자 레이어 경계 침범임. 이 로직은 이미 `WorkspacesService.createPersonalWorkspace()`에 동일하게 존재함 (코드 중복).
- 제안: 트랜잭션이 필요하다면 `WorkspacesService`에 `EntityManager`를 받는 오버로드를 추가하거나, 별도 트랜잭션 경계를 처리하는 facade를 도입. `AuthService`는 `WorkspacesService`만 호출해야 함.

```typescript
// workspaces.service.ts
async createPersonalWorkspaceWithManager(
  userId: string,
  userName: string,
  email: string,
  manager: EntityManager,
): Promise<Workspace> { ... }
```

---

**[CRITICAL] `DataSource` 직접 주입 — 의존성 역전 원칙(DIP) 위반**
- 위치: `auth.service.ts` L29
- 상세: `AuthService`가 TypeORM의 구체 클래스인 `DataSource`에 직접 의존함. 이는 인프라 레이어의 구현체가 비즈니스 서비스 레이어로 누출된 것이며, 테스트 격리와 구현 교체를 어렵게 만듦.
- 제안: 트랜잭션 처리를 `WorkspacesService` 내부로 이동하거나, 트랜잭션 관리를 추상화한 인터페이스/헬퍼를 별도 계층에 제공.

---

**[WARNING] `verifyEmail`에서 워크스페이스 생성과 토큰 생성이 원자적이지 않음**
- 위치: `auth.service.ts` L93–127
- 상세: `dataSource.transaction()` 블록은 User 업데이트와 Workspace 생성을 포함하지만, 이후의 `generateTokens()`(RefreshToken 저장 포함)는 트랜잭션 밖에서 실행됨. 트랜잭션 성공 후 토큰 저장 실패 시 데이터 정합성 문제 발생 가능.
- 제안: RefreshToken 생성도 트랜잭션에 포함하거나, 실패 시 보상 트랜잭션(compensation) 전략을 명시적으로 문서화.

---

**[WARNING] `generateTokens()`에서 `findOrCreatePersonalWorkspace()` 호출 — Side Effect 내포**
- 위치: `auth.service.ts` L307–318
- 상세: 토큰 생성이라는 순수한 인증 작업(`generateTokens`)이 워크스페이스를 생성할 수 있는 부수 효과를 가짐. `refresh()` 호출 시에도 이 코드가 실행되므로, 토큰 갱신이 워크스페이스를 생성하는 예기치 않은 동작이 발생할 수 있음.
- 제안: `generateTokens()`에 워크스페이스 ID를 파라미터로 전달하거나, 워크스페이스 보장 책임을 호출 지점(login, verifyEmail)에서 명시적으로 처리.

---

**[WARNING] 워크스페이스 생성 로직 이원화 — DRY 위반**
- 위치: `auth.service.ts` L103–122 vs `workspaces.service.ts` L17–46
- 상세: slug 생성, workspace 생성, member 추가 로직이 두 곳에 동일하게 존재. `verifyEmail`의 트랜잭션 내부 코드가 `WorkspacesService.createPersonalWorkspace()`와 완전히 중복됨.
- 제안: 위 CRITICAL 항목 해결로 자연히 해소됨.

---

**[WARNING] `findOrCreatePersonalWorkspace()`의 Race Condition**
- 위치: `workspaces.service.ts` L53–62
- 상세: `findPersonalWorkspace()`와 `createPersonalWorkspace()` 사이에 동시 요청이 발생하면 중복 워크스페이스가 생성될 수 있음. DB 레벨의 unique constraint가 없다면 데이터 정합성 문제.
- 제안: `(ownerId, type)` 조합에 DB unique constraint 추가 후, upsert 패턴 또는 exception catch-and-return 방식 사용.

---

**[INFO] `AuthService` 생성자의 과도한 의존성**
- 위치: `auth.service.ts` L22–30
- 상세: `AuthService`가 `JwtService`, `ConfigService`, `UsersService`, `WorkspacesService`, `RefreshToken Repository`, `DataSource` 총 6개의 의존성을 가짐. 단일 서비스의 책임이 지나치게 넓은 신호.
- 제안: `TokenService`(토큰 생성/검증), `AuthFlowService`(login/register 플로우) 등으로 분리를 중장기적으로 고려.

---

**[INFO] 테스트에서 private 메서드 직접 spy — 테스트 아키텍처 경고**
- 위치: `auth.service.spec.ts` L346, 363, 381
- 상세: `jest.spyOn(service as never, 'findUserByVerifyToken' as never)`처럼 타입을 우회하여 private 메서드를 mock하는 패턴은 구현 세부사항에 강하게 결합된 테스트. 리팩토링 시 테스트가 깨지기 쉬움.
- 제안: `findUserByVerifyToken`을 테스트 가능하도록 Repository 레이어로 분리하거나, public 인터페이스를 통해 동일한 시나리오를 테스트.

---

### 요약

이번 변경의 핵심 문제는 **레이어 경계 붕괴**다. `AuthService`가 `DataSource`를 직접 주입받아 `Workspace`/`WorkspaceMember` 엔티티를 직접 조작함으로써, 이미 `WorkspacesService`에 존재하는 로직을 중복 구현하고 있다. 트랜잭션 원자성을 보장하려는 의도는 타당하나, 그 방법이 아키텍처 원칙을 심각하게 훼손한다. `generateTokens()`에 워크스페이스 생성 부수 효과가 내포된 설계도 refresh 흐름에서 예상치 못한 동작을 유발할 수 있다. `WorkspacesService`에 `EntityManager`를 수용하는 오버로드를 추가하는 방식으로 트랜잭션 원자성과 레이어 분리를 동시에 달성할 수 있다.

### 위험도

**HIGH**