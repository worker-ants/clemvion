# Architecture Review

## 발견사항

### 발견사항 1

- **[WARNING]** `UpdateTriggerDto`의 `endpointPath` — DTO가 수락하지만 서비스가 거부하는 누출 추상화(Leaky Abstraction)
  - 위치: `codebase/backend/src/modules/triggers/dto/update-trigger.dto.ts` `endpointPath` 필드, 특히 Swagger `description` 주석
  - 상세: DTO(프레젠테이션 레이어)는 `@IsUUID('4')`로 `endpointPath`를 유효한 업데이트 값으로 수락하지만, 주석에서 "생성 후 endpointPath 변경은 service 가 거부한다"고 명시한다. 불변성 제약은 비즈니스 규칙이므로 서비스 레이어가 시행하는 것 자체는 맞지만, DTO에서 해당 필드를 아예 받지 않거나 서비스 거부 응답(예: 409 IMMUTABLE_FIELD)을 명시적 오류 타입으로 정의해 API 소비자가 코드 레벨에서 인지하도록 해야 한다. 현재 구조는 클라이언트가 Swagger prose를 꼼꼼히 읽어야만 필드가 사실상 불변임을 알 수 있어 레이어 경계 책임 분리(OCP/ISP)가 모호하다.
  - 제안: (a) `UpdateTriggerDto`에서 `endpointPath`를 제거하거나, (b) 서비스 레이어에서 값이 전달될 때 `ENDPOINT_PATH_IMMUTABLE` 같은 명시적 예외를 던져 DTO 주석에 의존하지 않도록 할 것. 단, 이 변경은 기존 클라이언트 호환성을 파괴할 수 있으므로 minor 버전 사이클에서 처리하는 것을 권장.

### 발견사항 2

- **[INFO]** `CreateTriggerDto.type` — 열거형이 아닌 문자열 배열 `@IsIn(['webhook', 'manual'])`
  - 위치: `codebase/backend/src/modules/triggers/dto/create-trigger.dto.ts` L93–94
  - 상세: 트리거 타입을 `@IsIn` 에 하드코딩된 리터럴 배열로 강제한다. TypeScript 수준의 타입 안전성이 없어 새 타입 추가 시 DTO·서비스·스펙 등 여러 곳을 수동으로 동기화해야 하며, 컴파일 타임 누락 검출이 불가능하다. `schedule` 타입을 추가할 경우 이 배열만 고치고 다른 곳을 놓치는 사고가 발생할 수 있다.
  - 제안: `export const TRIGGER_TYPES = ['webhook', 'manual'] as const; export type TriggerType = typeof TRIGGER_TYPES[number];` 형태로 SOT(Single Source of Truth) 상수를 별도 파일에 선언하고 DTO와 서비스·엔티티가 공유하도록 리팩토링. 또는 기존 코드베이스에 TriggerType enum이 이미 있다면 해당 enum을 재사용.

### 발견사항 3

- **[INFO]** `WorkspaceInvitationsPrunerService` — 스케줄러와 워커를 단일 클래스에 결합
  - 위치: `codebase/backend/src/modules/workspaces/jobs/workspace-invitations-pruner.service.ts` 전체
  - 상세: 클래스가 `@Processor`(워커)이면서 `onModuleInit`에서 스스로를 스케줄링하는 이중 역할을 담당한다. 이는 `login-history-pruner`와 동일한 기존 패턴을 踏襲한 것으로 단기적으로 문제 없으나, 미래에 스케줄러만 별도 인스턴스로 분리하거나 `BullMQ Scheduler`를 독립 프로세스로 올려야 할 때 리팩토링 비용이 발생한다. 현재 두 책임이 함께 있어 단일 책임 원칙(SRP)이 완전히 충족되지는 않는다.
  - 제안: 현재 패턴은 단일 서비스 배포에서 충분히 실용적이므로 즉시 변경 불필요. 단, 향후 워커 인스턴스 수를 독립적으로 조정해야 하는 상황이 오면 스케줄러 등록 로직을 `AppModule.onApplicationBootstrap` 또는 별도 `PrunerSchedulerService`로 분리하는 것을 고려.

### 발견사항 4

- **[INFO]** `WorkspaceInvitationsPrunerService` — 구체 클래스에 직접 의존 (DIP)
  - 위치: `codebase/backend/src/modules/workspaces/jobs/workspace-invitations-pruner.service.ts` 생성자
  - 상세: `WorkspaceInvitationsService` 구체 클래스를 직접 주입한다. NestJS 관용 패턴이지만 엄격한 DIP(의존성 역전 원칙) 관점에서는 인터페이스(`IWorkspaceInvitationsService`)에 의존하는 것이 이상적이다. 현재로서는 테스트에서 `useValue: { pruneExpired: jest.fn() }`로 충분히 모킹되므로 실질적 문제는 없다.
  - 제안: 현 규모에서는 인터페이스 도입 오버헤드가 실익보다 크므로 현상 유지. 모듈 간 경계가 커지거나 서비스가 독립 패키지로 분리될 때 인터페이스 추출 고려.

### 발견사항 5

- **[INFO]** `endpointPath` UUID 강제 — DTO 레이어 적용 위치는 적절하나 서비스 레이어 이중 검증 여부 불명확
  - 위치: `create-trigger.dto.ts`, `update-trigger.dto.ts` — `@IsUUID('4')`
  - 상세: UUID 형식 강제는 프레젠테이션(DTO) 레이어에서 처리되어 레이어 책임이 명확하다. 그러나 서비스 레이어 또는 엔티티 레이어에서 동일 제약을 다시 검증하는지 여부가 이번 diff 에서 확인되지 않는다. ValidationPipe를 우회하는 경로(예: 내부 서비스 직접 호출)가 있다면 UUID가 아닌 값이 DB에 기록될 수 있다.
  - 제안: 서비스나 엔티티(TypeORM column decorator)에서 `endpoint_path`의 UUID 형식에 대한 DB 레벨 CHECK constraint 또는 추가 가드를 두는지 확인하고, 없다면 DB migration에 `CHECK (endpoint_path ~ '^[0-9a-f]{8}-...')` 형식의 제약 추가를 검토.

---

## 요약

이번 변경셋은 두 가지 독립적인 개선으로 구성된다. 첫째, webhook `endpointPath`를 v4 UUID로 강제하는 보안 강화(DTO·스펙·테스트 동기화)는 프레젠테이션 레이어에 올바르게 위치하고, 클라이언트·서버 역할 분담이 스펙과 코드 양측에 일관되게 기록되어 있다. 둘째, `WorkspaceInvitationsPrunerService`는 기존 `login-history-pruner` 패턴을 재사용해 스케줄러/워커 어댑터와 비즈니스 로직을 명확히 분리했으며, 모듈 등록과 테스트 구성도 NestJS 관용 방식을 충실히 따른다. 다만 `UpdateTriggerDto`가 서비스 레이어에서 거부할 `endpointPath` 필드를 여전히 수락하는 누출 추상화가 존재하며, 트리거 타입이 문자열 리터럴 배열로 관리되어 타입 안전성이 다소 취약하다. 전체적으로 레이어 경계, 결합도, 응집도 면에서 양호한 수준이며, 지적된 사항들은 소규모 리팩토링 수준이다.

---

## 위험도

LOW
