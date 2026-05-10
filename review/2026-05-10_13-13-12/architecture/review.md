## 발견사항

### [WARNING] `mapDbError`를 handler 파일에서 export — SRP/모듈 경계 위반
- **위치**: `database-query.handler.ts` L422 (`export function mapDbError`)
- **상세**: `mapDbError`, `classifyDbError`, `classifyPostgresSqlState`, `classifyMysqlCode`, 그리고 세 개의 대형 `Set` 상수(MYSQL_CONNECTION_CODES 등)가 모두 핸들러 파일에 있고 일부는 `export`됨. 핸들러는 실행 조율 담당이고, 드라이버 에러 분류 로직은 별도 관심사(인프라 어댑터)임. 현재는 테스트가 handler 파일에서 `mapDbError`를 직접 import하지 않지만, 향후 다른 핸들러(e.g., ORM 기반 DB 접근)가 재사용하려 할 때 handler 모듈에 의존하게 되어 불필요한 결합이 발생함.
- **제안**: `db-error-classifier.ts` (또는 `_base/db-error-classifier.ts`) 로 분리. handler는 이를 import만 함. `mapDbError`의 `export`는 현재 handler 파일 내에서만 사용하므로, 분리 전까지는 `export` 제거가 낫다.

---

### [WARNING] `driver` 파라미터가 closed literal union — OCP 위반
- **위치**: `database-query.handler.ts` L422 `mapDbError(err, driver: 'postgres' | 'mysql')`
- **상세**: 세 번째 드라이버(MSSQL, SQLite, Oracle 등)를 추가하려면 `mapDbError` 시그니처, `classifyDbError` 분기, 그리고 타입 선언을 모두 수정해야 함. 개방-폐쇄 원칙상 분류 전략이 확장 가능한 구조여야 하는데, 현재는 `if (driver === 'postgres') ... else ... (mysql)` 분기로 고정되어 있음.
- **제안**: 드라이버별 분류 함수를 레지스트리(`Record<string, ClassifierFn>`)나 전략 객체로 관리. 단, 현재 지원 드라이버가 2종이고 추가 계획이 없다면 이 비용이 YAGNI에 해당할 수 있어 INFO 수준으로 낮출 수도 있음. 당분간 최소한 `classifyDbError` 내 코멘트로 확장 포인트를 명시하는 것이 적절함.

---

### [WARNING] `CONNECTION_ERRNOS`에 mysql2 프로토콜 코드 혼재 — 응집도 문제
- **위치**: `database-query.handler.ts` L461~475 (`CONNECTION_ERRNOS`) 및 L477~487 (`MYSQL_CONNECTION_CODES`)
- **상세**: `PROTOCOL_CONNECTION_LOST`, `PROTOCOL_SEQUENCE_TIMEOUT`, `PROTOCOL_PACKETS_OUT_OF_ORDER` 가 `CONNECTION_ERRNOS`와 `MYSQL_CONNECTION_CODES` 양쪽에 모두 존재함. `classifyDbError`는 `CONNECTION_ERRNOS`를 먼저 체크하므로, `MYSQL_CONNECTION_CODES`에 있는 세 코드는 mysql 분기에서 사실상 데드 코드임. 또한 `CONNECTION_ERRNOS`라는 이름은 Node.js errno(`ECONNRESET` 등)를 암시하는데, mysql2 내부 프로토콜 코드까지 포함하는 것은 이름과 책임이 어긋남.
- **제안**: `CONNECTION_ERRNOS`는 순수 Node.js errno로 한정하고, `MYSQL_CONNECTION_CODES`에서 중복 항목을 제거하거나, 두 Set을 명확히 역할로 구분한 뒤 comment로 "이 set은 드라이버 공통 Node errno" 표기 추가.

---

### [INFO] 대형 분류 테이블(Set 상수)이 핸들러 파일 말미에 위치
- **위치**: `database-query.handler.ts` L447~L570 (파일 하단 154줄)
- **상세**: MYSQL_CONSTRAINT_CODES에 12개 코드, MYSQL_PERMISSION_CODES에 6개 코드가 정적 데이터로 정의됨. 현재는 규모가 관리 가능하지만, 드라이버별 분류 테이블이 확장될수록 핸들러 파일의 가독성 저하. 이 데이터들은 코드가 아닌 구성(configuration)에 가까움.
- **제안**: 단기적으로 현 위치 유지 가능. 중장기적으로 위 WARNING의 분리 시 자연스럽게 해결됨.

---

### [INFO] `DB_CONNECTION_FAILED` → `DB_CONNECTION_ERROR` 명칭 변경이 spec 전반에 파급
- **위치**: `error-codes.ts` L15, `spec/5-system/3-error-handling.md`
- **상세**: plan 문서에 "사용처 없어 단순 rename"으로 기술되어 있어 파급 위험은 낮음. 다만, 외부 클라이언트나 workflow expression에서 `DB_CONNECTION_FAILED`를 하드코딩했다면 런타임 분기 실패로 이어짐. 코드 내 grep 검증이 완료되었다고 가정하나, 데이터베이스에 저장된 workflow 설정(expression 문자열)까지는 정적 분석으로 탐지 불가.
- **제안**: 추가로 production DB의 workflow node config 컬럼에서 `DB_CONNECTION_FAILED` 문자열 occurrence를 확인하는 마이그레이션 스크립트 또는 일회성 쿼리 실행 권장.

---

## 요약

`mapDbError` 와 드라이버별 분류 로직을 `database-query.handler.ts`에서 추출하여 구조화한 것은 올바른 방향이며, 4-enum 분류 체계(`DB_QUERY_FAILED` / `DB_CONNECTION_ERROR` / `DB_CONSTRAINT_VIOLATION` / `DB_PERMISSION_DENIED`)와 `driverCode` echo 설계는 워크플로우 저작자 입장에서 적절한 추상화 수준을 제공한다. 주요 아키텍처 우려는 분류 로직이 핸들러 파일에 혼재하여 SRP와 OCP를 부분적으로 위반한다는 점이며, `CONNECTION_ERRNOS`·`MYSQL_CONNECTION_CODES` 간 중복이 의도를 흐린다. 이는 현재 동작 정확성에는 영향이 없으나, 세 번째 드라이버 추가 시 변경 비용이 집중됨.

## 위험도

**LOW**