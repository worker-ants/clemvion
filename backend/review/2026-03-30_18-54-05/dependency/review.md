### 발견사항

- **[INFO]** `@nestjs/testing` 사용은 기존 NestJS 프로젝트 의존성과 일치
  - 위치: `users.controller.spec.ts` L1
  - 상세: 별도 설치 불필요, `@nestjs/testing`은 devDependency로 이미 포함되어 있음
  - 제안: 없음

- **[INFO]** `JwtPayload` 타입을 `type import`로 처리
  - 위치: `users.controller.ts` L4, `users.controller.spec.ts` L4
  - 상세: `import type`을 사용하여 런타임 번들에 포함되지 않음. 올바른 패턴
  - 제안: 없음

- **[INFO]** `CurrentUser` 데코레이터는 내부 공통 모듈(`../../common/decorators`)에서 임포트
  - 위치: `users.controller.ts` L3
  - 상세: 외부 의존성 없이 내부 유틸리티 재사용. 적절한 내부 의존 구조
  - 제안: 없음

- **[INFO]** SQL 마이그레이션은 외부 의존성 없음
  - 위치: `V003__add_trigger_category.sql`
  - 상세: 순수 DDL 변경. Flyway/Flyway 네이밍 컨벤션(`V003__`) 준수 확인 필요
  - 제안: 마이그레이션 도구(Flyway 등)가 이미 프로젝트에 설정되어 있다면 문제없음

- **[WARNING]** `UsersController`가 인증 가드(Guard) 없이 노출될 가능성
  - 위치: `users.controller.ts` L7-8
  - 상세: `@UseGuards(JwtAuthGuard)` 또는 전역 가드 설정 여부 불명확. 의존성 관점에서 인증 모듈과의 결합이 누락되어 있을 수 있음. `CurrentUser` 데코레이터가 가드 없이 작동하면 `payload`가 `undefined`가 됨
  - 제안: 컨트롤러 또는 메서드 레벨에 `@UseGuards(JwtAuthGuard)` 명시적 선언 또는 `UsersModule`에서 전역 가드가 적용됨을 확인

- **[INFO]** 테스트에서 `mockResolvedValue(null)`을 `findById`에 적용할 때 `as never` 타입 캐스팅 불일치
  - 위치: `users.controller.spec.ts` L55
  - 상세: `mockUser as never`는 타입 불일치를 억제. `UsersService.findById`의 반환 타입이 `User | null`이라면 mock 타입도 맞춰야 함
  - 제안: `jest.fn().mockResolvedValue(mockUser as User)` 형태로 정확한 타입 사용

---

### 요약

이번 변경사항은 새로운 외부 의존성을 일절 추가하지 않으며, 기존 NestJS 생태계(`@nestjs/common`, `@nestjs/testing`) 및 내부 공통 모듈만을 활용합니다. SQL 마이그레이션은 PostgreSQL enum 확장으로 기존 마이그레이션 도구와 호환됩니다. 주요 의존성 위험은 없으나, `UsersController`의 인증 가드 의존 관계가 명시적으로 선언되지 않은 점은 보안 설정 누락으로 이어질 수 있어 확인이 필요합니다.

### 위험도

**LOW**