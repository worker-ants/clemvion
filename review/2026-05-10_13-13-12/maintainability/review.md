### 발견사항

---

#### `database-query.handler.ts`

- **[WARNING]** `const driver = creds.driver ?? 'postgres'` 중복 선언
  - 위치: `execute()` 메서드 내 try 블록 (~line 155)과 catch 블록 (~line 170)
  - 상세: 동일한 식이 두 곳에서 선언된다. default 값이 바뀔 경우 두 곳을 동시에 수정해야 한다.
  - 제안: `creds`가 try/catch 이전에 이미 확정되므로, `const driver = creds.driver ?? 'postgres'`를 try 블록 진입 전으로 끌어올려 단일 선언으로 통합.

- **[WARNING]** `CONNECTION_ERRNOS`와 `MYSQL_CONNECTION_CODES`의 항목 중복
  - 위치: `CONNECTION_ERRNOS` Set, `MYSQL_CONNECTION_CODES` Set
  - 상세: `PROTOCOL_CONNECTION_LOST`, `PROTOCOL_SEQUENCE_TIMEOUT`, `PROTOCOL_PACKETS_OUT_OF_ORDER` 세 항목이 두 Set에 모두 존재한다. `classifyDbError`는 `CONNECTION_ERRNOS`를 먼저 확인하므로 `MYSQL_CONNECTION_CODES`의 해당 항목은 실질적으로 도달 불가능하다(dead code). 향후 `classifyDbError`의 순서가 바뀌면 의도치 않은 분류 변경이 발생한다.
  - 제안: `MYSQL_CONNECTION_CODES`에서 `PROTOCOL_*` 세 항목을 제거하거나, `CONNECTION_ERRNOS`에서 MySQL 전용 항목을 분리해 소유권을 명확히 한다.

- **[WARNING]** 분류 함수 반환 타입 유니언이 3곳에서 반복
  - 위치: `classifyDbError`, `classifyPostgresSqlState`, `classifyMysqlCode`의 반환 타입 선언
  - 상세: `'DB_QUERY_FAILED' | 'DB_CONNECTION_ERROR' | 'DB_CONSTRAINT_VIOLATION' | 'DB_PERMISSION_DENIED'` 유니언이 세 함수 모두에 반복된다. 새 에러 코드가 추가될 때 세 곳을 모두 수정해야 한다.
  - 제안: `type DbRuntimeErrorCode = 'DB_QUERY_FAILED' | 'DB_CONNECTION_ERROR' | 'DB_CONSTRAINT_VIOLATION' | 'DB_PERMISSION_DENIED'`로 추출 후 재사용.

- **[INFO]** `mapDbError` 반환 타입의 `code` 필드가 `string`으로 선언됨
  - 위치: `export function mapDbError` 시그니처
  - 상세: 내부에서 항상 위의 4개 코드 중 하나만 반환함에도 반환 타입이 `{ code: string; ... }`이다. `ErrorCodeValue`나 위 `DbRuntimeErrorCode`로 좁히면 호출 측에서 타입 안전성이 높아진다.

---

#### `database-query.handler.spec.ts`

- **[HIGH]** MySQL 통합 자격증명 객체가 5회 이상 복사됨
  - 위치: MySQL 관련 테스트 케이스들 (ER_DUP_ENTRY, PROTOCOL_CONNECTION_LOST, ER_TABLEACCESS_DENIED_ERROR, ER_ACCESS_DENIED_ERROR, 기존 MySQL SELECT 테스트 등)
  - 상세: 아래 객체가 각 테스트마다 그대로 붙여넣어진다. `ssl: 'disable'`과 `ssl: 'require'` 간 미묘한 차이가 있어 복사 오류가 숨어들기 쉽다.
    ```typescript
    credentials: { driver: 'mysql', host: 'h', port: 3306, database: 'd', username: 'u', password: 'p', ssl: 'disable' }
    ```
  - 제안: `makeService`의 `overrides` 기능을 활용한 `makeMysqlService(overrides?)` 헬퍼를 정의하거나, MySQL 자격증명 상수를 파일 상단에 선언하여 `makeService({ integration: { ...MYSQL_INTEGRATION_BASE, ... } })`로 재사용.

- **[WARNING]** 출력 타입 캐스팅 패턴 중복
  - 위치: 새로 추가된 각 에러 매핑 테스트 케이스
  - 상세: `as unknown as { port: string; output: { error: { code: string; details?: { driverCode?: string } } } }` 형태의 단언이 7회 이상 반복된다.
  - 제안: 파일 상단에 `type ErrorPortOutput = { port: string; output: { error: { code: string; message?: string; details?: { driverCode?: string } } } }` 타입을 정의해 재사용.

- **[INFO]** 각 테스트 말미의 `await handler.shutdown()` 반복
  - 위치: execute describe 블록 내 모든 테스트
  - 상세: `afterEach`에서 현재 테스트에 생성된 handler를 정리하면 누락 위험이 제거된다. 현재는 `await handler.shutdown()` 전에 assertion이 throw될 경우 shutdown이 스킵될 수 있다.
  - 제안: handler를 describe 스코프 변수로 선언하고 `afterEach(() => handler?.shutdown())`으로 처리.

---

#### `error-codes.ts`

- **[INFO]** `MAX_COLLECTION_RETRIES_EXCEEDED` 카테고리 미분류
  - 위치: `ErrorCode` 객체 내 LLM 섹션 이후
  - 상세: 다른 코드들은 카테고리 주석(HTTP, Database, Email, LLM 등) 아래 묶여 있으나 이 항목은 어느 그룹에도 속하지 않아 스캔 시 눈에 잘 안 띈다.
  - 제안: `// LLM` 그룹 내로 이동하거나 별도 `// LLM (retry)` 주석 추가.

---

### 요약

전반적인 유지보수성은 **양호**하다. `mapDbError`와 `classifyDbError` → `classifyPostgresSqlState` / `classifyMysqlCode`로 이어지는 분해는 명확하며, 스펙·코드·테스트 삼중 동기화도 충실하다. 주요 취약점은 두 가지다: 테스트 파일에서 MySQL 자격증명 블록이 5회 이상 복사되어 미묘한 불일치가 숨어들기 쉽다는 점, 그리고 `CONNECTION_ERRNOS`와 `MYSQL_CONNECTION_CODES`의 항목 중복이 `classifyDbError`의 실행 순서에 암묵적으로 의존하게 만들어 향후 리팩터링 시 분류 로직이 깨질 위험이 있다는 점이다. `const driver` 이중 선언과 반환 타입 유니언 반복은 소규모이지만 단일 변경점(DRY) 원칙에서 벗어난다.

### 위험도

**MEDIUM**