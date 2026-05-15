## 발견사항

### [INFO] `mapDbError` 불필요한 `export`
- **위치**: `database-query.handler.ts` — `export function mapDbError(...)`
- **상세**: 테스트 파일이 `mapDbError`를 직접 import하지 않고 `handler.execute()`를 통해 간접 검증한다. 모듈 외부 노출 이유가 없다.
- **제안**: `export` 제거 → `function mapDbError(...)`. 내부 헬퍼 함수들과 일관성 유지.

---

### [INFO] `error-codes.ts` 주석이 프로젝트 정책보다 장황함
- **위치**: `error-codes.ts` — Database 섹션 5줄 블록 주석
- **상세**: `CLAUDE.md`는 "WHY가 non-obvious한 경우에만 한 줄 짧게" 정책. 현 주석은 SQLSTATE/MySQL 매핑 전략을 5줄로 설명하며 `database-query.handler.ts#mapDbError`를 참조한다. 내용 자체는 유효하나 분량이 정책을 벗어난다.
- **제안**: 한 줄로 압축 — 예) `// DB_* codes are classified from pg SQLSTATE / mysql2 ER_* / Node errno by mapDbError.`

---

### [INFO] `ER_ACCESS_DENIED_ERROR` → `DB_CONNECTION_ERROR` 매핑이 직관에 반함
- **위치**: `database-query.handler.ts` — `MYSQL_CONNECTION_CODES` Set
- **상세**: 권한 거부 오류(`ER_ACCESS_DENIED_ERROR`)가 `DB_CONNECTION_ERROR`로 분류된다. 코드 내 인라인 주석("bucket as connection rather than permission so retry policies that rotate credentials trigger correctly")이 이유를 설명하지만, 스펙 §6.2 표에는 `DB_CONNECTION_ERROR` 조건 설명에 "인증 거부"만 간략히 언급된다. 이 분류가 의도된 설계임을 명확히 하는 보강이 충분하다.
- **제안**: INFO 수준 — 실제 버그 아님. 스펙 §6.2의 `DB_CONNECTION_ERROR` 행에 "MySQL auth failure at handshake (`ER_ACCESS_DENIED_ERROR`)" 명시 추천 (이미 부분적으로 반영됨).

---

### [INFO] `CONNECTION_ERRNOS`와 `MYSQL_CONNECTION_CODES`에 코드 중복 존재
- **위치**: `database-query.handler.ts` — 두 Set 정의
- **상세**: `PROTOCOL_CONNECTION_LOST`, `PROTOCOL_SEQUENCE_TIMEOUT`, `PROTOCOL_PACKETS_OUT_OF_ORDER` 세 코드가 양쪽 Set에 모두 포함된다. `classifyDbError`에서 `CONNECTION_ERRNOS`가 먼저 체크되므로 `MYSQL_CONNECTION_CODES`의 해당 항목은 실질적으로 dead code다.
- **제안**: 해당 3개 코드를 `MYSQL_CONNECTION_CODES`에서 제거하거나, `CONNECTION_ERRNOS`에 추가된 이유 주석 추가.

---

### [INFO] 테스트에서 PostgreSQL 클래스 `08`, `28`, `57` 미검증
- **위치**: `database-query.handler.spec.ts`
- **상세**: 핸들러의 `classifyPostgresSqlState`는 `08xx`(connection_exception), `28xx`(invalid_authorization), `57xx`(operator_intervention) 클래스를 처리하지만, 테스트는 `23505`, `23503`, `42501`, `42601`만 커버한다. 핵심 연결 실패 경로(`ECONNRESET`)는 커버되지만, SQLSTATE `08006` 같은 pg 네이티브 커넥션 오류는 미검증.
- **제안**: 선택적 — `08006`(connection_failure), `28000`(invalid_authorization) SQLSTATE 케이스 추가 권장.

---

## 요약

변경 범위는 의도된 스코프(database_query 노드 에러 코드 세분화 + driver code 매핑 + spec 정합)를 충실히 따른다. `error-codes.ts` rename, 핸들러 `mapDbError` 구현, 테스트 9건 추가, spec 2개 파일 갱신, plan 상태 업데이트가 모두 계획 문서(Phase 1 §1.4)에 명시된 항목과 1:1 대응한다. 무관한 파일 수정, 불필요한 리팩토링, 요청 외 기능 추가는 없다. 다만 `mapDbError`의 불필요한 `export`와 `CONNECTION_ERRNOS`/`MYSQL_CONNECTION_CODES` 중복이 경미한 설계 노이즈로 남는다.

## 위험도

**LOW**