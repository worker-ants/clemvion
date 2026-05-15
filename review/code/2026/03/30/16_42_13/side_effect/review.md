## 부작용 코드 리뷰 결과

---

### 파일 1: `workspace.decorator.spec.ts`

#### 발견사항

- **[INFO]** `getParamDecoratorFactory()` 내부에서 매번 새로운 `TestController` 클래스 정의
  - 위치: `beforeEach` → `getParamDecoratorFactory()`
  - 상세: `beforeEach`마다 호출되어 매 테스트마다 새 클래스를 정의하고 `Reflect.defineMetadata`가 호출됨. NestJS의 `reflect-metadata`는 전역 `Reflect` 객체에 메타데이터를 저장하므로, 클래스명이 동일하더라도 각 실행마다 새로운 클래스 참조가 생성되어 GC 전까지 메타데이터가 누적될 수 있음. 단, 클래스가 로컬 스코프이므로 실질적 오염은 제한적.
  - 제안: `beforeAll`로 변경하거나 `getParamDecoratorFactory()`를 모듈 레벨에서 한 번만 호출.

- **[INFO]** `eslint-disable` 주석 다수 사용
  - 위치: `getParamDecoratorFactory` 전반
  - 상세: `no-unsafe-assignment`, `no-unsafe-argument`, `no-unsafe-member-access`, `no-unsafe-return` 억제. 부작용 자체는 아니나 타입 안전성이 없는 메타데이터 접근이 런타임 오류 발생 시 조용히 실패할 수 있음.
  - 제안: `metadata` 타입을 `Record<string, { factory: (...args: unknown[]) => string }>` 형태로 단언하여 억제 주석 최소화.

---

### 파일 2: `uuid-transform.spec.ts`

#### 발견사항

- **[INFO]** 외부 DTO 클래스에 대한 `plainToInstance` 의존
  - 위치: 전체 테스트
  - 상세: `class-transformer`의 `plainToInstance`는 내부적으로 데코레이터 메타데이터(`reflect-metadata`)를 읽음. DTO 클래스의 데코레이터가 변경되면 이 테스트들이 무언의 영향을 받을 수 있음. 현재 코드 자체는 부작용 없음.

- **[WARNING]** `validate()` 옵션 `forbidNonWhitelisted: true` 적용 범위 불일치
  - 위치: 검증 테스트 케이스 (line 68~97)
  - 상세: 일부 단순 변환 테스트에서는 validation 없이 `plainToInstance`만 사용하고, 검증 테스트에서만 `whitelist: true, forbidNonWhitelisted: true`를 사용함. 실제 파이프라인에서 사용하는 옵션과 다를 경우 테스트가 실제 동작을 검증하지 못할 수 있음.
  - 제안: `ValidationPipe`의 실제 옵션과 일치시키거나, 옵션 상수를 공유.

---

### 파일 3: `jwt.strategy.spec.ts`

#### 발견사항

- **[INFO]** `ConfigService.get` mock이 항상 `'test-secret'` 반환
  - 위치: `beforeEach` > `ConfigService` 제공부
  - 상세: `PassportStrategy(JwtStrategy)` 초기화 시 `ConfigService.get('JWT_SECRET')`을 호출하는데, mock이 어떤 키든 동일 값을 반환함. 만약 전략이 여러 config 키를 사용하도록 변경될 경우 테스트가 오탐을 유발할 수 있음. 현재는 문제 없음.

- **[WARNING]** `getMemberRole`이 `null` 반환 시 `'owner'` 기본값 처리 검증 범위
  - 위치: 마지막 테스트 케이스 (`should default role to owner...`)
  - 상세: 이 동작이 실제 `jwt.strategy.ts` 구현에 하드코딩된 기본값인지, 아니면 워크스페이스 서비스가 보장해야 할 계약인지 불분명. `null` 반환을 `'owner'`로 변환하는 로직이 strategy에 존재한다면 `getMemberRole`이 null을 반환할 수 있는 시나리오(멤버십 없음 등)에서 권한 오류가 발생할 수 있음.
  - 제안: `null` 시 `UnauthorizedException`을 던지는 것이 더 안전한 설계인지 검토 필요.

- **[INFO]** `as never` 타입 단언 광범위 사용
  - 위치: 모든 `mockResolvedValue` 호출
  - 상세: mock 반환값의 타입 안전성을 완전히 포기. 실제 반환 타입과 맞지 않는 객체를 넘겨도 컴파일러가 잡지 못함.
  - 제안: `Partial<User>`, `Partial<Workspace>` 등으로 타입 단언을 좁히거나, 실제 엔티티 타입에 맞는 최소 객체 구성.

---

### 요약

세 파일 모두 테스트 코드로, 실제 전역 상태 변경·파일시스템·네트워크 호출 등의 심각한 부작용은 없음. 주요 위험 요소는 `jwt.strategy.spec.ts`에서 `getMemberRole null → 'owner'` 기본값 처리가 보안적으로 잘못된 권한 승격으로 이어질 수 있다는 점과, `uuid-transform.spec.ts`의 검증 옵션이 실제 파이프라인 설정과 다를 경우 테스트 신뢰도가 낮아질 수 있다는 점이며, 나머지는 타입 안전성 관련 코드 품질 사항임.

### 위험도

**LOW**