## 아키텍처 코드 리뷰

### 발견사항

---

#### 파일 1: `workspace.decorator.spec.ts`

- **[INFO]** 테스트 전용 헬퍼의 반복 생성 패턴
  - 위치: `getParamDecoratorFactory()` 함수 (전체)
  - 상세: `beforeEach`에서 매 테스트마다 `TestController` 클래스를 동적으로 생성하고 리플렉션으로 메타데이터를 추출하는 방식은 NestJS 내부 구현 세부사항에 의존하며, 불필요한 오버헤드가 발생합니다. `beforeAll`로 한 번만 실행해도 충분합니다.
  - 제안: `beforeEach` → `beforeAll`로 변경하여 불변하는 팩토리를 한 번만 추출

- **[INFO]** `eslint-disable` 주석 남용
  - 위치: 12~19라인
  - 상세: `any` 타입 우회를 위한 `eslint-disable` 주석이 5개 사용됩니다. 이는 타입 안전성 결여를 억압하는 방식으로, 테스트 코드의 신뢰도를 낮춥니다.
  - 제안: 리플렉션 결과에 명시적 타입 인터페이스를 정의하거나, `as` 캐스팅으로 의도를 명확히 표현

---

#### 파일 2: `uuid-transform.spec.ts`

- **[WARNING]** 테스트 파일의 위치가 도메인 경계를 위반
  - 위치: `src/common/dto/uuid-transform.spec.ts`
  - 상세: 이 파일은 `common/dto` 경로에 위치하지만, 실제로는 `CreateWorkflowDto`, `CreateNodeDto`, `CreateTriggerDto` 등 여러 도메인 모듈의 DTO를 직접 임포트합니다. `common` 레이어는 특정 도메인 모듈에 의존해서는 안 됩니다 — 이것은 레이어 역전(inverted layer dependency)입니다.
  - 제안: 테스트 대상이 UUID 변환 변환기(transformer) 자체라면, 변환기 전용 단위 테스트(`uuid-transform.pipe.spec.ts`)를 작성하고 도메인 DTO 통합 테스트는 각 모듈 하위로 이동

- **[INFO]** 테스트 케이스 커버리지 편중
  - 위치: 전체
  - 상세: `folderId`에 대한 테스트가 중심이며, `containerId`와 `toolOwnerId`는 변환 여부만 확인하고 유효성 검사(validation) 시나리오는 다루지 않습니다. 테스트 구조가 변환기 계약(contract)을 완전히 표현하지 못합니다.
  - 제안: 각 필드별로 변환 + 유효성 검사 시나리오를 대칭적으로 구성

---

#### 파일 3: `jwt.strategy.spec.ts`

- **[WARNING]** 퍼스널 워크스페이스 로직이 JWT Strategy에 위치하는 아키텍처 냄새
  - 위치: `strategy.validate()` 테스트 전반
  - 상세: 테스트 코드를 보면 `JwtStrategy.validate`가 `findPersonalWorkspace` + `getMemberRole`을 호출합니다. JWT 전략의 책임은 토큰 검증(authentication)이어야 하며, 워크스페이스 조회 및 역할 결정은 authorization/business 레이어의 책임입니다. 단일 책임 원칙(SRP) 위반이 테스트를 통해 드러나고 있습니다.
  - 제안: 워크스페이스 컨텍스트 주입은 별도의 Guard 또는 Interceptor로 분리하고, JWT Strategy는 `sub`/`email` 기반 사용자 검증에만 집중

- **[INFO]** `null as never` 타입 캐스팅 사용
  - 위치: `mockResolvedValue(null as never)` 패턴 (반복)
  - 상세: `jest.Mocked<T>`에서 반환값 타입 불일치를 `as never`로 우회하는 패턴입니다. 이는 타입 시스템이 서비스 반환 타입과 테스트 간 계약을 강제하지 못하게 만듭니다.
  - 제안: 서비스 메서드의 반환 타입을 `T | null`로 명확히 선언하거나, `mockResolvedValue(null as User | null)` 형태로 명시적 캐스팅

---

### 요약

세 파일 모두 기능적으로는 적절한 테스트를 제공하지만, 아키텍처 관점에서 두 가지 구조적 문제가 존재합니다. 첫째, `uuid-transform.spec.ts`가 `common` 레이어에서 도메인 모듈 DTO를 직접 의존하는 것은 레이어 경계 위반으로, `common` 모듈이 도메인 모듈에 역방향 의존성을 갖게 됩니다. 둘째, `JwtStrategy`가 워크스페이스 조회와 역할 결정을 담당하는 것은 SRP 위반이며, 이 책임은 Guard나 Interceptor로 분리되어야 합니다 — 이는 테스트 코드를 통해 드러나는 구현 레벨의 아키텍처 냄새입니다. 나머지 이슈들은 테스트 품질과 타입 안전성에 관한 INFO 수준 개선 사항입니다.

### 위험도

**MEDIUM**