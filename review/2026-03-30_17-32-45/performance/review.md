## 성능 코드 리뷰

### 발견사항

---

**[WARNING] `generateTokens`에서 매 호출마다 불필요한 DB 조회 발생**
- 위치: `auth.service.ts` - `generateTokens()` 메서드
- 상세: `findOrCreatePersonalWorkspace` → `findPersonalWorkspace` (DB 조회 1회) → 존재 시 반환, 이후 `getMemberRole` (DB 조회 1회). 토큰 갱신(`refresh`)마다 최소 2번의 DB 쿼리가 실행됨. 워크스페이스 정보는 토큰 발급 시점에 이미 알고 있는 정적 데이터임에도 매번 조회함.
- 제안: 워크스페이스 ID와 role을 JWT payload에 포함시키는 현재 구조상, 로그인 시점에 한 번 조회한 뒤 refresh 토큰 갱신 시에는 기존 토큰의 payload에서 읽거나, 별도 캐싱 레이어(Redis 등)를 활용하는 것을 고려.

---

**[WARNING] `verifyEmail` 트랜잭션 내에서 `getRepository` 반복 호출**
- 위치: `auth.service.ts:93~115`
- 상세: `manager.getRepository(Workspace)`를 두 번(`create`, `save`), `manager.getRepository(WorkspaceMember)`를 두 번 호출. 각 호출마다 TypeORM 내부적으로 레포지토리 인스턴스를 조회하는 오버헤드 발생.
- 제안: 트랜잭션 시작 시 레포지토리를 변수에 할당하여 재사용:
  ```ts
  const workspaceRepo = manager.getRepository(Workspace);
  const memberRepo = manager.getRepository(WorkspaceMember);
  ```

---

**[WARNING] `findOrCreatePersonalWorkspace` 경쟁 조건(Race Condition) 및 중복 생성 위험**
- 위치: `workspaces.service.ts:55~64`
- 상세: `findPersonalWorkspace` 후 `createPersonalWorkspace`를 호출하는 패턴은 동시 요청 시 두 개의 워크스페이스가 생성될 수 있음. DB 레벨의 유니크 제약 없이 소프트웨어적 check-then-act는 TOCTOU 문제를 가짐. 또한 `verifyEmail`은 트랜잭션 내에서 직접 생성하면서, `generateTokens`는 이 서비스 메서드를 호출하는 이중 경로가 존재함.
- 제안: DB 유니크 제약(`ownerId + type = personal`) 추가 및 `INSERT ... ON CONFLICT DO NOTHING` 또는 `upsert` 방식을 활용하거나, 분산 락을 적용.

---

**[INFO] `verifyEmail`에서 트랜잭션 완료 후 `generateTokens` 호출 시 워크스페이스 재조회**
- 위치: `auth.service.ts:117`
- 상세: 트랜잭션에서 워크스페이스를 생성했음에도 `return this.generateTokens(userByToken)` 호출 시 `findOrCreatePersonalWorkspace`가 다시 DB를 조회함 (2 쿼리 추가). 방금 생성한 워크스페이스 정보를 이미 알고 있으므로 불필요한 조회.
- 제안: 트랜잭션에서 생성된 `saved` 워크스페이스와 role 정보를 `generateTokens`에 직접 전달하도록 메서드 시그니처를 확장하거나, 트랜잭션 반환값을 활용.

---

**[INFO] bcrypt `hash` 연산이 테스트에서 반복 실행**
- 위치: `auth.service.spec.ts` - `login`, `generateTokens` describe 블록
- 상세: 각 테스트마다 `bcrypt.hash('Test123!@#', 12)`를 직접 호출. bcrypt는 의도적으로 느린 알고리즘(rounds=12)이므로 테스트 실행 시간 증가. 두 테스트에서 동일한 입력으로 반복 해시 생성.
- 제안: `beforeAll`에서 한 번만 해시를 생성하거나, 테스트 환경에서 rounds를 1로 낮추거나, `bcrypt.hash`를 모킹:
  ```ts
  jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed' as never);
  ```

---

**[INFO] `slug` 생성 시 `uuidv4()` 중복 생성**
- 위치: `auth.service.ts:104`, `workspaces.service.ts:26`
- 상세: `verifyEmail` 트랜잭션 내에서 slug 생성을 위해 `uuidv4()`를 호출하고, `WorkspacesService.createPersonalWorkspace`도 내부적으로 동일한 로직을 가짐. 두 경로가 분리되어 코드 중복과 별도 UUID 생성 오버헤드가 있음 (미미하지만 논리적 중복).
- 제안: `verifyEmail`에서 직접 워크스페이스를 생성하는 대신 `WorkspacesService`의 트랜잭션 지원 메서드를 활용하도록 리팩토링하거나, 서비스 레이어에 `createPersonalWorkspaceWithManager(manager, ...)` 메서드 추가.

---

### 요약

전반적으로 코드의 정확성은 개선되었으나, 성능 측면에서 주요 병목은 **토큰 발급 경로(`generateTokens`)에서 발생하는 불필요한 반복 DB 조회**임. 특히 refresh 토큰 갱신 시마다 워크스페이스 조회(1회) + 멤버 role 조회(1회)가 추가되며, `verifyEmail` 완료 후에도 방금 생성한 워크스페이스를 다시 조회하는 비효율이 있음. `findOrCreatePersonalWorkspace`의 check-then-act 패턴은 동시성 환경에서 중복 생성 위험이 있어 DB 유니크 제약과 함께 사용되어야 함. 테스트 코드의 bcrypt 반복 연산은 CI 실행 시간을 불필요하게 늘리는 요인.

### 위험도

**MEDIUM**