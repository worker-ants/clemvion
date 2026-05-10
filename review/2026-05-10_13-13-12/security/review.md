## 발견사항

---

### [WARNING] `mapDbError` 에서 드라이버 에러 메시지 무sanitize 노출
- **위치**: `database-query.handler.ts` — `mapDbError` 함수
- **상세**: `message = err instanceof Error ? err.message : String(err)` 가 드라이버 원문 메시지를 그대로 `output.error.message` 로 내보낸다. MySQL `ER_ACCESS_DENIED_ERROR` 는 `"Access denied for user 'u'@'hostname'"` 형태의 메시지를 생성해 내부 username·host 가 workflow output 에 노출된다. PostgreSQL constraint 위반 메시지도 테이블명·제약 이름을 포함한다(`"duplicate key value violates unique constraint \"users_pkey\""`). spec §6.2 와 §5.3 의 설명 중 "`sanitizeMessage` 로 password/secret 토큰 마스킹 적용 후 노출"이라고 명시되어 있으나, 실제 `mapDbError` 구현에 `sanitizeMessage` 호출이 없다 — spec 의도와 구현 사이에 간극이 존재한다.
- **제안**: `mapDbError` 내 `message` 반환 직전에 `sanitizeMessage` (또는 동등한 함수)를 적용한다. `toLogError` 로 로그는 이미 sanitize 하고 있으므로, 동일 함수를 `mapDbError` 에서도 호출하면 일관성을 확보할 수 있다.

---

### [INFO] `driverCode` echo 로 DB 엔진 유형 및 내부 스키마 정보 유추 가능
- **위치**: `database-query.handler.ts` — `mapDbError`, `classifyPostgresSqlState`
- **상세**: `details.driverCode: "23505"` / `"ER_DUP_ENTRY"` 등을 그대로 workflow output 에 노출하면 공격자가 코드 형식으로 백엔드 DB 엔진(PostgreSQL/MySQL)을 식별할 수 있다. `DB_PERMISSION_DENIED` + `driverCode: "42501"` 조합은 해당 테이블이 존재하되 접근 권한이 없다는 정보를 확인해 준다 — 정찰(Reconnaissance) 목적으로 활용될 수 있다. 이는 설계상 의도된 tradeoff이지만, threat model 에 따라 노출 범위를 재검토할 필요가 있다.
- **제안**: `driverCode` 노출이 외부 사용자(테넌트)에게도 보여야 하는지, 아니면 내부 운영자 로그에만 기록해야 하는지 정책을 명문화한다. 테넌트가 자신의 통합(Integration)만 사용할 수 있는 구조라면 현재 수준은 수용 가능하다.

---

### [INFO] PG 풀 idle 에러 무음 억제
- **위치**: `database-query.handler.ts:resolvePgPool` — `pool.on('error', () => {})`
- **상세**: idle 클라이언트의 모든 에러(TLS 인증서 만료, 네트워크 절단 등 보안 관련 이벤트 포함)가 완전히 억제된다. 프로세스 크래시 방지를 위한 처리이지만, 운영 시 보안 관련 연결 이상을 감지할 수 없다.
- **제안**: 빈 핸들러 대신 최소한 WARN 수준 로깅을 추가한다.
  ```ts
  pool.on('error', (err) => logger.warn('pg idle client error', { message: err.message }));
  ```

---

### [INFO] `{{ }}` 쿼리 템플릿 via SQL 인젝션 위험 (설계 수준)
- **위치**: 핸들러 설계 — `query` 필드에 `{{ }}` 표현식 허용
- **상세**: spec §1 및 §4에서 `query` 필드에 `{{ }}` 템플릿을 허용한다. 엔진이 표현식을 평가한 결과가 SQL 문자열에 직접 삽입되면, 신뢰할 수 없는 데이터를 query 본문에 바인딩할 경우 SQL 인젝션이 가능하다. `parameters` 배열은 드라이버의 prepared statement 로 안전하게 처리되지만, `query` 문자열 자체에 표현식 결과가 interpolation 되면 이 보호가 우회된다.
- **제안**: 문서에 "사용자 입력값을 `query` 필드의 `{{ }}` 내에 직접 삽입하지 말고, 항상 `parameters` 배열을 통해 바인딩하라"는 경고를 명시한다. 가능하다면 엔진 수준에서 `query` 필드의 expression 결과를 검증하거나, 쿼리 본문 삽입 패턴에 대한 lint 규칙을 적용한다.

---

## 요약

에러 코드 세분화(4-enum 분류 + `driverCode` echo)와 driver 매핑 로직의 구현 자체는 견고하다. parameterized query 사용으로 SQL 인젝션 방어가 올바르게 이루어지고 있고, SSL은 `require`/`verify-full` 모두 `rejectUnauthorized: true`를 강제해 MITM 방어가 강화되어 있으며, 자격증명은 config echo 에서 완전히 배제된다. 주요 보안 갭은 spec 이 명시한 `sanitizeMessage` 적용이 `mapDbError` 에 누락된 점으로, MySQL 인증 실패 메시지처럼 username·hostname을 포함한 드라이버 원문이 workflow output 에 그대로 노출될 수 있다.

## 위험도

**LOW** — SQL 인젝션·하드코딩 시크릿·인증 우회 등 OWASP Top 10 직접 해당 취약점은 없음. 에러 메시지 sanitize 누락(WARNING 1건)이 정보 노출 경로이며, 나머지는 설계 tradeoff 수준(INFO 3건).