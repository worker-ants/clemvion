## 의존성 코드 리뷰 결과

### 발견사항

- **[INFO]** `DataSource` 직접 주입 도입 (`auth.service.ts`)
  - 위치: `auth.service.ts:14`, `:32`
  - 상세: 기존에는 `WorkspacesService`를 통해 간접 접근하던 DB 레이어를 `DataSource`를 직접 주입받아 트랜잭션 내에서 엔티티 리포지토리에 직접 접근. 새로운 외부 패키지 추가는 없으며 `typeorm` 내부 심볼 재사용.
  - 제안: 특이사항 없음. `DataSource`는 NestJS+TypeORM 스택에서 트랜잭션 처리의 표준 패턴.

- **[WARNING]** `AuthService`가 `Workspace`, `WorkspaceMember` 엔티티에 직접 의존하는 레이어 경계 위반
  - 위치: `auth.service.ts:15-16`
  - 상세: `auth` 모듈이 `workspaces` 모듈의 내부 엔티티(`Workspace`, `WorkspaceMember`)를 직접 임포트. `AuthService`가 워크스페이스 생성 로직을 직접 수행하므로 `workspaces` 모듈의 도메인 로직이 `auth` 모듈에 중복 구현됨. 이는 `WorkspacesService.createPersonalWorkspace`와 동일한 로직의 복제.
  - 제안: 트랜잭션 범위가 필요하다면 `WorkspacesService`에 `EntityManager`를 파라미터로 받는 오버로드를 추가하거나, `AuthModule`이 `WorkspacesModule`의 내부 구현에 의존하지 않도록 경계를 유지하는 것이 바람직함:
    ```ts
    // workspaces.service.ts
    async createPersonalWorkspace(
      userId: string,
      userName: string,
      email: string,
      manager?: EntityManager,
    ): Promise<Workspace>
    ```

- **[WARNING]** 이메일 인증 후 워크스페이스 생성 로직의 이중화(duplication)
  - 위치: `auth.service.ts:107-128` vs `workspaces.service.ts:18-44`
  - 상세: `verifyEmail`의 트랜잭션 내부에서 slug 생성, workspace 생성, member 등록 로직을 직접 구현. `WorkspacesService.createPersonalWorkspace`와 완전히 동일한 로직이 두 곳에 존재. 향후 slug 생성 규칙이나 기본 설정이 바뀌면 두 곳을 동기화해야 함.
  - 제안: 위의 `EntityManager` 오버로드 방식으로 통합.

- **[INFO]** `findOrCreatePersonalWorkspace` 추가로 `generateTokens`의 null 방어 로직 제거
  - 위치: `auth.service.ts:307-316`
  - 상세: 기존의 `workspace?.id ?? ''` 같은 방어 코드가 제거되고 항상 workspace가 반환됨을 보장. `WorkspacesService` 의존성의 계약이 강화된 것으로 긍정적 변화.
  - 제안: 특이사항 없음.

- **[INFO]** 테스트에서 `DataSource` mock 등록
  - 위치: `auth.service.spec.ts:101-128`
  - 상세: `DataSource`를 NestJS DI 컨테이너에 mock으로 등록. `transaction` 콜백을 즉시 실행하는 방식은 올바른 패턴. 단, mock `getRepository`가 단일 인스턴스를 반환하므로 `Workspace`와 `WorkspaceMember` 구분 없이 같은 mock을 반환함.
  - 제안: 실제 코드에서 `getRepository(Workspace)`와 `getRepository(WorkspaceMember)`를 별도로 호출하므로, 엄밀한 테스트라면 엔티티 타입별로 다른 mock을 반환하도록 구성하는 것이 더 정확함:
    ```ts
    getRepository: jest.fn().mockImplementation((entity) => {
      if (entity === Workspace) return mockWorkspaceRepo;
      if (entity === WorkspaceMember) return mockMemberRepo;
    })
    ```

---

### 요약

이번 변경은 새로운 외부 패키지 추가 없이 기존 `typeorm`의 `DataSource`를 직접 활용한 것으로, 의존성 추가·버전 충돌·라이선스·취약점 측면의 문제는 없음. 주요 우려사항은 **내부 모듈 간 경계 위반**으로, `auth` 모듈이 `workspaces` 모듈의 엔티티를 직접 임포트하여 워크스페이스 생성 로직을 중복 구현한 점이 장기적인 유지보수 부담을 증가시킴. 트랜잭션 요구사항은 `WorkspacesService`에 `EntityManager` 파라미터를 옵셔널로 추가하는 방식으로 모듈 경계를 유지하면서 해결 가능함.

### 위험도

**MEDIUM** — 기능 동작에는 문제없으나 모듈 경계 위반과 로직 중복이 구조적 부채로 누적될 수 있음.