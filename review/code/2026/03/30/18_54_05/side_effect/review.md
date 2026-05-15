## 리뷰 결과

### 발견사항

#### 파일 1: V003__add_trigger_category.sql

- **[WARNING]** `ALTER TYPE ... ADD VALUE`는 트랜잭션 내에서 실행 불가
  - 위치: Line 2
  - 상세: PostgreSQL에서 `ALTER TYPE ... ADD VALUE`는 트랜잭션 블록 안에서 실행되면 오류가 발생합니다. Flyway는 기본적으로 마이그레이션을 트랜잭션으로 감싸므로, 실행 시 `ERROR: ALTER TYPE ... ADD VALUE cannot run inside a transaction block`이 발생할 수 있습니다.
  - 제안: Flyway의 경우 파일 상단에 `-- flyway:nonTransactional` 어노테이션을 추가하거나, 마이그레이션 설정에서 해당 파일을 non-transactional로 처리해야 합니다.

- **[INFO]** enum 값 추가는 롤백 불가
  - 위치: Line 2
  - 상세: PostgreSQL에서 enum에 추가된 값은 제거할 수 없습니다. 마이그레이션 실패 후 롤백 시나리오에서 `'trigger'` 값이 DB에 남아 있을 수 있습니다.
  - 제안: 이 특성을 인지하고 다운 마이그레이션 스크립트에서 해당 enum 값 제거가 불가능함을 문서화하세요.

- **[INFO]** `BEFORE 'logic'` 순서 지정은 기능적으로 무의미할 수 있음
  - 위치: Line 2
  - 상세: PostgreSQL enum의 값 순서는 비교 연산자(`<`, `>`)에 영향을 줍니다. `node_category` enum에 순서 기반 비교를 사용하는 코드가 있다면 영향을 받을 수 있습니다.
  - 제안: `node_category` enum 값에 대해 순서 비교를 사용하는 코드가 없는지 확인하세요.

---

#### 파일 2: users.controller.ts

- **[INFO]** 인증 가드 누락 가능성
  - 위치: Line 10 (`@Get('me')`)
  - 상세: `@CurrentUser()` 데코레이터가 JWT payload를 주입하지만, 컨트롤러나 핸들러에 `@UseGuards(JwtAuthGuard)` 같은 가드가 명시적으로 선언되어 있지 않습니다. 글로벌 가드가 설정되어 있지 않다면 인증 없이 엔드포인트에 접근 시 `payload`가 `undefined`가 되어 `payload.sub` 참조에서 런타임 오류가 발생합니다.
  - 제안: 글로벌 가드 설정 여부를 확인하고, 없다면 `@UseGuards(JwtAuthGuard)`를 명시적으로 추가하세요.

- **[INFO]** user not found 시 404 대신 200 반환
  - 위치: Line 14-16
  - 상세: 인증된 사용자가 DB에 존재하지 않을 때 `{ data: null }`과 HTTP 200을 반환합니다. 이는 삭제된 계정으로 유효한 JWT를 가진 사용자가 오류 없이 통과되는 상황입니다.
  - 제안: `NotFoundException`을 throw하거나 401을 반환하는 것이 더 적절한 동작입니다.

---

#### 파일 3: users.controller.spec.ts

- **[INFO]** 테스트에서 인증 가드를 bypass하는 구조
  - 위치: `beforeEach` 모듈 설정
  - 상세: 테스트 모듈에서 가드가 오버라이드되지 않았습니다. 실제 코드에 가드가 있다면 테스트에서도 mock 처리가 필요합니다. 현재 구조는 가드 없이 컨트롤러를 직접 호출하므로, 가드 관련 동작은 검증되지 않습니다.
  - 제안: 인증 실패 시나리오 테스트 케이스 추가를 고려하세요.

---

### 요약

SQL 마이그레이션의 `ALTER TYPE ... ADD VALUE`가 트랜잭션 블록 내 실행 제한이라는 PostgreSQL 특성으로 인해 Flyway 실행 시 실패할 위험이 가장 큰 부작용입니다. `users.controller.ts`는 글로벌 가드 의존성과 user not found 처리 방식이 잠재적인 보안/동작 이슈를 내포하고 있으며, 테스트 코드는 기능적으로 올바르나 가드 관련 시나리오를 커버하지 않습니다. 전반적으로 의도치 않은 전역 상태 변경, 파일시스템, 네트워크 부작용은 없습니다.

### 위험도

**MEDIUM** — SQL 마이그레이션의 트랜잭션 블록 제한으로 인한 배포 실패 위험