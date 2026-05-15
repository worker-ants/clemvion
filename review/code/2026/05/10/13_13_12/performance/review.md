## 발견사항

---

### **[INFO]** 중복 Set 멤버 — `classifyMysqlCode` 내 3개 코드 dead code

- **위치**: `database-query.handler.ts` — `CONNECTION_ERRNOS` (L457~469) 및 `MYSQL_CONNECTION_CODES` (L471~481)
- **상세**: `PROTOCOL_CONNECTION_LOST`, `PROTOCOL_SEQUENCE_TIMEOUT`, `PROTOCOL_PACKETS_OUT_OF_ORDER` 세 항목이 `CONNECTION_ERRNOS`와 `MYSQL_CONNECTION_CODES` 양쪽에 모두 존재한다. `classifyDbError`는 `CONNECTION_ERRNOS.has(driverCode)` 를 먼저 체크하므로, MySQL 드라이버 경로에서 이 세 코드는 항상 앞 분기에서 처리되어 `classifyMysqlCode`까지 도달하지 않는다. 성능상 무해하지만(Set lookup은 O(1)) `MYSQL_CONNECTION_CODES` 내 해당 항목은 실질적으로 dead code다.
- **제안**: `MYSQL_CONNECTION_CODES`에서 세 코드를 제거하거나, 두 Set의 역할을 주석으로 명확히 구분해 유지보수 시 의도를 명시. 단, 동작 변경 없음.

---

### **[INFO]** `creds.driver ?? 'postgres'` 이중 평가

- **위치**: `database-query.handler.ts` — try 블록 (드라이버 분기) + catch 블록 (에러 분류)
- **상세**: `creds.driver ?? 'postgres'` 가 try/catch 각각에서 별도로 평가된다. 실제 비용은 단순 nullish coalescing이므로 무시 가능하지만, 의미적으로 동일한 값이 두 번 계산된다.
- **제안**: `const driver = creds.driver ?? 'postgres'` 를 try/catch 블록 바깥(공통 스코프)에 한 번만 선언. 가독성 개선 효과도 있음.

---

### **[INFO]** 테스트 코드 내 MySQL 인테그레이션 설정 반복

- **위치**: `database-query.handler.spec.ts` — MySQL 관련 테스트 케이스들 (5회 이상 반복)
- **상세**: MySQL 드라이버 설정 객체(`{ driver: 'mysql', host: 'h', port: 3306, ... }`)가 각 test case마다 인라인으로 복제되어 있다. 테스트 파일 크기가 증가했고, 추후 필드 추가 시 모든 복제본을 수정해야 한다. 런타임 성능과는 무관하나, 테스트 실행 시 반복적인 동일 객체 생성이 발생한다.
- **제안**: 파일 상단에 `const mysqlCreds = { driver: 'mysql', ... }` 상수를 선언하여 `makeService({ integration: { ..., credentials: mysqlCreds } })`로 공유.

---

## 요약

이번 변경의 핵심인 `mapDbError` / `classifyDbError` / `classifyPostgresSqlState` / `classifyMysqlCode` 함수들은 모두 모듈 레벨 `Set` 상수(초기화 1회)를 활용한 O(1) 조회와 O(1) 문자열 슬라이스로 구성되어 있어 성능적으로 최적에 가깝다. 이 코드는 **에러 경로(catch block)에서만 실행**되므로 정상 실행 경로의 핫패스에 전혀 영향을 주지 않는다. 발견된 사항들은 모두 INFO 수준으로, 동작 정확성이나 성능에 실질적 영향이 없는 코드 구조 개선 제안이다.

## 위험도

**NONE**