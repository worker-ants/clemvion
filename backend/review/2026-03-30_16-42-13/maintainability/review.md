## 유지보수성 코드 리뷰

---

### 파일 1: `workspace.decorator.spec.ts`

### 발견사항

- **[INFO]** `eslint-disable` 주석 과다 사용
  - 위치: 12-20라인
  - 상세: `unsafe-assignment`, `unsafe-argument`, `unsafe-member-access`, `unsafe-return` 등 5개의 eslint 억제 주석이 `getParamDecoratorFactory` 내에 집중되어 있음. NestJS 파라미터 데코레이터 메타데이터를 다루는 불가피한 패턴이지만, 이 복잡성이 외부로 노출되어 있음.
  - 제안: 타입 정의를 추가하여 억제 주석 수를 줄이거나, 별도 헬퍼 파일로 분리해 여러 데코레이터 테스트에서 재사용 가능하도록 구성.

- **[INFO]** `factory` 타입 선언의 `_data` 파라미터명
  - 위치: 28라인 (`let factory: (_data: unknown, ctx: unknown) => string`)
  - 상세: `_data`는 미사용 파라미터임을 나타내는 컨벤션이지만, 타입 선언에서는 단순히 `data`로 표기하거나 생략하는 것이 더 자연스러움.
  - 제안: `let factory: (data: unknown, ctx: unknown) => string` 또는 `(_: unknown, ctx: unknown) => string`

- **[INFO]** `createMockContext`의 위치
  - 위치: 33-39라인
  - 상세: `beforeEach` 아래에 헬퍼 함수가 선언되어 있어 `describe` 블록 내 순서가 직관적이지 않음. `beforeEach` 이전에 선언하면 흐름이 더 자연스러움.
  - 제안: `createMockContext`를 `beforeEach` 블록 위로 이동.

---

### 파일 2: `uuid-transform.spec.ts`

### 발견사항

- **[WARNING]** 하드코딩된 UUID 문자열 반복
  - 위치: 21, 71, 80, 97, 107라인
  - 상세: `'550e8400-e29b-41d4-a716-446655440000'`이 파일 전체에서 5회 반복됨. 이 값을 변경해야 할 경우 모두 수동으로 찾아 수정해야 함.
  - 제안: 파일 상단에 상수로 추출.
    ```typescript
    const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
    ```

- **[WARNING]** `validate` 옵션 객체 중복
  - 위치: 77-79, 88-90, 100-102라인
  - 상세: `{ whitelist: true, forbidNonWhitelisted: true }` 옵션이 세 테스트에서 동일하게 반복됨.
  - 제안: 상수로 추출하여 재사용.
    ```typescript
    const VALIDATE_OPTIONS = { whitelist: true, forbidNonWhitelisted: true };
    ```

- **[INFO]** 테스트 케이스들이 `describe` 블록 없이 단일 그룹에 혼재
  - 위치: 전체
  - 상세: DTO별(`CreateWorkflowDto`, `UpdateWorkflowDto`, `CreateNodeDto`, `CreateTriggerDto`), 관심사별(transform 동작 / validation 동작)로 구분이 없어 10개 케이스가 나열됨. 케이스가 증가할수록 탐색이 어려워짐.
  - 제안: 중첩 `describe` 블록으로 구조화.
    ```typescript
    describe('Transform behavior', () => { ... });
    describe('Validation behavior', () => { ... });
    ```

---

### 파일 3: `jwt.strategy.spec.ts`

### 발견사항

- **[WARNING]** `as never` 타입 캐스팅 반복 사용
  - 위치: 61, 63-64, 71, 75, 78, 84, 87-88, 93라인
  - 상세: `mockResolvedValue(mockUser as never)` 패턴이 9회 반복됨. `as never`는 타입 안전성을 완전히 포기하는 캐스팅으로, mock 타입 정의가 실제 서비스 반환 타입과 불일치함을 나타냄.
  - 제안: mock 객체에 적절한 타입을 지정하거나, jest의 `mockResolvedValue`에 제네릭을 활용.
    ```typescript
    usersService.findById.mockResolvedValue(mockUser as Awaited<ReturnType<UsersService['findById']>>);
    ```
    또는 mock 객체를 완전한 타입으로 정의.

- **[INFO]** `mockUser`, `mockWorkspace`의 불완전한 타입
  - 위치: 18-29라인
  - 상세: 실제 엔티티 타입(`User`, `Workspace`)을 사용하지 않아 타입 가드 없이 `as never` 캐스팅이 필요해짐. 향후 엔티티 필드 변경 시 테스트가 컴파일 오류 없이 통과될 수 있음.
  - 제안: `Partial<User>` 또는 실제 엔티티 타입으로 명시.

- **[INFO]** `validate` 호출 시 입력 객체 반복
  - 위치: 60, 70, 74, 78, 83, 87라인
  - 상세: `{ sub: 'user-uuid-1', email: 'test@example.com' }` 객체가 6번 중복됨.
  - 제안: 상수로 추출.
    ```typescript
    const validPayload = { sub: 'user-uuid-1', email: 'test@example.com' };
    ```

---

### 요약

세 파일 모두 테스트 목적과 구조는 명확하게 잡혀 있으며 커버리지도 충분한 편입니다. 다만 `jwt.strategy.spec.ts`의 `as never` 반복 캐스팅은 타입 안전성을 저해하는 구조적 문제이며, `uuid-transform.spec.ts`의 상수 및 validate 옵션 중복은 향후 변경 시 불일치 버그를 유발할 수 있는 유지보수 위험 요소입니다. `workspace.decorator.spec.ts`는 NestJS 메타데이터 접근의 불가피한 복잡성을 잘 캡슐화하고 있으나, 공유 헬퍼로 분리하면 다른 데코레이터 테스트 작성 시 재사용성이 높아집니다.

### 위험도

**LOW**