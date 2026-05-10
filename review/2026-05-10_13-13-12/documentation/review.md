## Documentation 리뷰

### 발견사항

---

**[WARNING]** `MYSQL_CONSTRAINT_CODES` / `MYSQL_PERMISSION_CODES` 상수에 doc 주석 없음
- 위치: `database-query.handler.ts` — `MYSQL_CONSTRAINT_CODES`, `MYSQL_PERMISSION_CODES` 정의부
- 상세: `CONNECTION_ERRNOS`와 `MYSQL_CONNECTION_CODES`는 각각 doc 주석이 있지만, 두 Set은 주석 없이 코드 나열만 있음. 향후 유지보수자가 `ER_FOREIGN_DUPLICATE_KEY_WITH_CHILD_INFO` 같은 비자명한 항목의 근거를 알기 어려움
- 제안:
  ```ts
  /**
   * MySQL constraint-related error codes → DB_CONSTRAINT_VIOLATION.
   * Covers unique / FK / not-null / check violations.
   * https://dev.mysql.com/doc/mysql-errors/en/server-error-reference.html
   */
  const MYSQL_CONSTRAINT_CODES = new Set([...]);
  ```

---

**[WARNING]** `CONNECTION_ERRNOS`와 `MYSQL_CONNECTION_CODES`의 중복 항목이 문서화되지 않음
- 위치: `database-query.handler.ts` — 두 Set 모두 `PROTOCOL_CONNECTION_LOST`, `PROTOCOL_SEQUENCE_TIMEOUT`, `PROTOCOL_PACKETS_OUT_OF_ORDER` 포함
- 상세: `classifyDbError`에서 `CONNECTION_ERRNOS` 체크가 먼저 실행되므로 `MYSQL_CONNECTION_CODES`의 `PROTOCOL_*` 항목은 실질적으로 dead entry임. 의도적인 방어 코딩인지, 실수인지 주석이 없어 불분명함
- 제안: `MYSQL_CONNECTION_CODES` 선언부에 한 줄 주석 추가:
  ```ts
  // PROTOCOL_* codes also appear in CONNECTION_ERRNOS (checked first in classifyDbError).
  // Listed here for completeness — MySQL-specific bucket.
  ```

---

**[WARNING]** 스펙 §6.2에서 PostgreSQL class `28` (`invalid_authorization_specification`) 누락
- 위치: `spec/4-nodes/4-integration/2-database-query.md` §6.2 표
- 상세: 핸들러 `classifyPostgresSqlState`는 class `28` → `DB_PERMISSION_DENIED`로 매핑하지만, 스펙 §6.2의 드라이버 힌트 컬럼에는 `42501`만 기재됨. 워크플로우 작성자가 `28xxx` (e.g. `28000`, `28P01`) 코드가 `DB_PERMISSION_DENIED`를 발생시킨다는 사실을 스펙에서 확인할 수 없음
- 제안: §6.2 표의 `DB_PERMISSION_DENIED` 행 수정:
  ```
  pg `42501`, `28xxx` (invalid_authorization_specification), mysql ...
  ```

---

**[INFO]** `classifyPostgresSqlState` 주석의 "class-23 fallback" 표현이 모호함
- 위치: `database-query.handler.ts:classifyPostgresSqlState` — `42501` 체크 바로 위 주석
- 상세: `"checked before the class-23 fallback"` → 42501은 class 42임. "class-based fallback logic"이 더 정확함. 현재 표현은 class 23(제약 위반)과 혼동될 수 있음
- 제안: `"checked before the class-based routing below"` 또는 `"must precede the generic class switch — class '42' would otherwise fall through to DB_QUERY_FAILED"`

---

**[INFO]** `classifyDbError`, `classifyMysqlCode` private 함수에 doc 주석 없음
- 위치: `database-query.handler.ts` — 두 함수 선언부
- 상세: `mapDbError`(public)는 상세한 JSDoc을 가지나, 실제 분류 로직을 수행하는 private 함수들은 주석 없음. 반환 타입 union이 복잡하여 간단한 한 줄 설명이 있으면 가독성 향상됨
- 제안: 각 함수에 한 줄 JSDoc. 강제적인 사항은 아니나 유지보수성에 기여함

---

**[INFO]** 스펙 §6.2의 MySQL 권한 코드 목록이 불완전
- 위치: `spec/4-nodes/4-integration/2-database-query.md` §6.2 표 `DB_PERMISSION_DENIED` 행
- 상세: 핸들러의 `MYSQL_PERMISSION_CODES`는 `ER_PROCACCESS_DENIED_ERROR`, `ER_KILL_DENIED_ERROR`도 포함하나 스펙에 미기재. "등" 처리로 암묵적 포함을 의도했다면 "등" 표현 명시 권장

---

### 요약

전반적으로 문서화 수준이 높다. `mapDbError`의 JSDoc은 4-enum 분류 논리, `details.driverCode` 조건부 포함 원칙, CONVENTIONS 참조까지 명확히 기술되어 있고, 스펙 §5.3의 JSON 예제에 `driverCode`가 반영되었으며 §5.3.4 신규 추가도 적절하다. 단, `MYSQL_CONSTRAINT_CODES`/`MYSQL_PERMISSION_CODES`의 doc 누락, `CONNECTION_ERRNOS`와 `MYSQL_CONNECTION_CODES` 간 중복 항목에 대한 의도 미명시, 스펙 §6.2에서 PostgreSQL class `28` 누락이 미래 유지보수 혼란의 소지가 있다.

### 위험도

**LOW**