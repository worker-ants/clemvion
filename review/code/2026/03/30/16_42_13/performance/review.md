## 성능 코드 리뷰 결과

### 발견사항

---

**파일 1: workspace.decorator.spec.ts**

- **[INFO]** `getParamDecoratorFactory()`가 `beforeEach`마다 호출되어 매 테스트마다 클래스 정의 + Reflect 메타데이터 조회를 반복 수행
  - 위치: `beforeEach(() => { factory = getParamDecoratorFactory(); })`
  - 상세: 4개의 테스트마다 `TestController` 클래스 선언, 데코레이터 실행, `Reflect.getMetadata` 호출이 발생. 데코레이터 팩토리는 불변이므로 반복 추출이 불필요함
  - 제안: `beforeAll`로 변경하거나 모듈 스코프에서 한 번만 추출

```ts
// 현재
beforeEach(() => {
  factory = getParamDecoratorFactory();
});

// 개선
beforeAll(() => {
  factory = getParamDecoratorFactory();
});
```

- **[INFO]** `createMockContext`가 매 호출마다 클로저 체인 객체를 새로 생성
  - 위치: `createMockContext` 함수 전체
  - 상세: `switchToHttp`, `getRequest` 등 중첩 함수 객체가 매 테스트마다 재할당. 규모 작아 실질적 영향은 없으나 구조적으로 불필요한 할당
  - 제안: 성능보다 가독성 우선이므로 현행 유지 가능, 다만 인지할 것

---

**파일 2: uuid-transform.spec.ts**

- **[WARNING]** `plainToInstance` + `validate` 조합을 각 테스트마다 독립 실행 — 동일 DTO 클래스에 대한 중복 메타데이터 처리 반복
  - 위치: 8개 테스트 케이스 전체
  - 상세: `class-transformer`의 `plainToInstance`는 내부적으로 메타데이터 리플렉션을 매번 수행. 동일 DTO(e.g. `CreateWorkflowDto`)에 대해 3~4회 반복 호출됨. 테스트 환경에서는 미미하지만 DTO 복잡도가 높아지면 영향 증가
  - 제안: 유사 케이스를 `it.each`로 통합하거나, 같은 DTO를 검증하는 케이스는 describe 블록으로 묶어 fixture 재사용 명확화

- **[INFO]** `validate()` 호출 시 매번 동일한 옵션 객체 리터럴 생성
  - 위치: `validate(dto, { whitelist: true, forbidNonWhitelisted: true })` — 3회 중복
  - 상세: 옵션 객체가 매 호출마다 새로 할당됨. 미미한 수준이지만 상수로 추출하면 의도도 명확해짐
  - 제안:
  ```ts
  const VALIDATE_OPTIONS = { whitelist: true, forbidNonWhitelisted: true };
  // ...
  const errors = await validate(dto, VALIDATE_OPTIONS);
  ```

---

**파일 3: jwt.strategy.spec.ts**

- **[WARNING]** `beforeEach`에서 매 테스트마다 NestJS `TestingModule` 전체를 생성/컴파일
  - 위치: `beforeEach(async () => { const module = await Test.createTestingModule(...).compile(); })`
  - 상세: `Test.createTestingModule().compile()`은 NestJS DI 컨테이너를 풀로 초기화하는 비용이 있음. 5개 테스트마다 반복 실행. `JwtStrategy`는 stateless하므로 모듈 재생성이 불필요
  - 제안: `beforeAll`로 변경하고, mock reset만 `beforeEach`에서 수행

```ts
beforeAll(async () => {
  const module = await Test.createTestingModule({ ... }).compile();
  strategy = module.get<JwtStrategy>(JwtStrategy);
  usersService = module.get(UsersService);
  workspacesService = module.get(WorkspacesService);
});

beforeEach(() => {
  jest.clearAllMocks();
});
```

- **[INFO]** `mockUser`, `mockWorkspace` 상수가 테스트 간 공유되나 일부 케이스에서 spread로 파생 객체 생성
  - 위치: `{ ...mockUser, emailVerified: false }`
  - 상세: 규모상 무시 가능한 수준이나 구조적으로 허용됨

---

### 요약

세 파일 모두 테스트 코드로, 프로덕션 성능에 직접 영향을 주지는 않습니다. 그러나 테스트 실행 속도와 리소스 효율 관점에서 공통적인 패턴 문제가 있습니다. 가장 주목할 점은 `jwt.strategy.spec.ts`에서 `beforeEach`마다 NestJS 모듈 전체를 컴파일하는 것으로, stateless 전략 클래스에는 불필요한 비용입니다. `workspace.decorator.spec.ts`도 마찬가지로 불변 팩토리를 매 테스트마다 재추출합니다. `uuid-transform.spec.ts`의 반복적인 validate 옵션 객체 생성은 경미한 수준이지만 상수 추출로 개선 가능합니다. 전반적으로 `beforeEach` → `beforeAll` 전환과 mock reset 분리 패턴을 적용하면 테스트 스위트 실행 시간을 단축할 수 있습니다.

### 위험도

**LOW**