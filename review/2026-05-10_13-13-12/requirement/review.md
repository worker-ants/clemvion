분석이 완료되었습니다.

---

## 발견사항

### [WARNING] `sanitizeMessage` 미적용 — 에러 메시지 민감정보 노출 위험
- **위치**: `database-query.handler.ts` `mapDbError()` 함수, 그리고 catch 블록의 `IntegrationError` 분기
- **상세**: spec §5.3 표에 `output.error.message`는 "`sanitizeMessage` 로 password/secret 토큰 마스킹 적용 후 노출"이라고 명시되어 있다. 그러나 `mapDbError`는 `err.message`를 그대로 반환하고 `sanitizeMessage`를 호출하지 않는다. `sanitizeMessage`는 `integration-handler-base.ts`에 이미 구현되어 있고 `toLogError`(로깅 경로)는 이를 사용한다. 반면 `output.error.message`(워크플로우 expression으로 노출되는 경로)는 unsanitized 그대로다. PostgreSQL 드라이버는 연결 오류 시 `password authentication failed for user "alice"` 같은 메시지를 내놓을 수 있고, DSN 재구성 실패 시 자격증명 일부가 포함될 수 있다.
- **제안**: `mapDbError` 내부에서 `sanitizeMessage`를 import해 `message` 필드에 적용한다:
  ```ts
  import { sanitizeMessage, ... } from '../_base/integration-handler-base.js';
  
  const message = sanitizeMessage(err instanceof Error ? err.message : String(err));
  ```
  catch 블록의 `IntegrationError` 분기(`message: err.message`)도 동일하게 적용한다.

---

### [WARNING] 드라이버 간 "인증 실패" 에러 코드 불일치
- **위치**: `database-query.handler.ts` `MYSQL_CONNECTION_CODES` (`ER_ACCESS_DENIED_ERROR` → `DB_CONNECTION_ERROR`) vs `classifyPostgresSqlState` (class `28` → `DB_PERMISSION_DENIED`)
- **상세**: "잘못된 자격증명으로 연결 시도"라는 동일한 상황에서 드라이버에 따라 다른 코드가 반환된다.

  | 상황 | PostgreSQL | MySQL |
  |------|-----------|-------|
  | 잘못된 패스워드/사용자 | class 28 → `DB_PERMISSION_DENIED` | `ER_ACCESS_DENIED_ERROR` → `DB_CONNECTION_ERROR` |

  MySQL 쪽은 핸들러 주석("rotate credentials trigger correctly")으로 의도를 설명하지만, PostgreSQL class 28(`28000` invalid_authorization_specification, `28P01` invalid_password)은 MySQL과 동일한 "연결 시 인증 거부"임에도 `DB_PERMISSION_DENIED`로 분류된다. 또한 spec §6.2 표는 `DB_CONNECTION_ERROR`의 MySQL 힌트에 `ER_ACCESS_DENIED_ERROR`를 명시하지만 PostgreSQL class 28에 대한 언급이 없어 spec-code 정합성이 불완전하다. 워크플로우 작성자가 MySQL↔PostgreSQL을 교체할 때 에러 분기 로직이 달라진다.
- **제안**: 두 드라이버의 분류를 통일한다. 연결-시 인증 실패는 retry 정책과 자격증명 교체가 모두 관련된 상황이므로 `DB_CONNECTION_ERROR`로 통일(PostgreSQL class 28도 동일 처리)하거나, 또는 MySQL `ER_ACCESS_DENIED_ERROR`도 `DB_PERMISSION_DENIED`로 통일하는 방향 중 하나를 선택해 spec §6.2 표에 명시한다.

---

### [INFO] catch 블록 내 `IntegrationError` 분기가 도달 불가능한 코드
- **위치**: `database-query.handler.ts:174–180`
- **상세**: `resolveIntegration`과 `missingDbFields` 검사는 try 블록 **바깥**에 있으므로 여기서 던지는 `IntegrationError`는 catch 블록으로 오지 않는다(워크플로우 레벨 실패로 처리). try 블록 안의 `executeMysql`/`executePostgres`는 `IntegrationError`를 절대 던지지 않는다. 따라서 catch 내 `err instanceof IntegrationError` 분기는 현재 코드 구조에서 실행될 수 없다.
- **제안**: 제거하거나, 만약 미래 확장성을 고려한다면 주석으로 명시적으로 의도를 밝힌다. 현 상태는 독자를 혼란스럽게 한다.

---

### [INFO] `CONNECTION_ERRNOS`와 `MYSQL_CONNECTION_CODES` 중복 항목
- **위치**: `database-query.handler.ts` 두 Set 정의
- **상세**: `PROTOCOL_CONNECTION_LOST`, `PROTOCOL_SEQUENCE_TIMEOUT`, `PROTOCOL_PACKETS_OUT_OF_ORDER` 세 코드가 `CONNECTION_ERRNOS`에도, `MYSQL_CONNECTION_CODES`에도 존재한다. `classifyDbError`는 `CONNECTION_ERRNOS`를 먼저 체크하므로 `MYSQL_CONNECTION_CODES`의 해당 항목들은 절대 참조되지 않는다. 동작은 올바르지만 유지보수 혼란을 유발한다.
- **제안**: `MYSQL_CONNECTION_CODES`에서 `CONNECTION_ERRNOS`와 겹치는 세 항목을 제거하고 주석으로 "Shared codes are handled by CONNECTION_ERRNOS first"라고 명시한다.

---

### [INFO] PostgreSQL class 53 (insufficient_resources)이 `DB_QUERY_FAILED`로 낙하
- **위치**: `classifyPostgresSqlState` 함수
- **상세**: class 53은 `53100` (disk_full), `53200` (out_of_memory), `53300` (too_many_connections), `53400` (configuration_limit_exceeded)를 포함한다. `too_many_connections` 같은 케이스는 재시도 대상(retry-worthy)이지만 현재는 `DB_QUERY_FAILED` fallback으로 분류된다. 워크플로우 작성자가 재시도 정책을 `DB_CONNECTION_ERROR`에 걸어두면 이를 놓친다.
- **제안**: `if (klass === '53') return 'DB_CONNECTION_ERROR';` 추가를 검토한다.

---

## 요약

핵심 기능인 드라이버별 에러 코드 분류(`mapDbError`)와 4-enum 매핑 로직은 체계적으로 구현되어 있고, PostgreSQL SQLSTATE / MySQL `ER_*` / Node errno 각각에 대한 테스트 커버리지도 충분하다. 다만 spec이 명시한 `sanitizeMessage` 적용이 `output.error.message` 경로에서 누락된 점이 실질적인 민감정보 노출 위험이며, PostgreSQL class 28과 MySQL `ER_ACCESS_DENIED_ERROR`의 분류 불일치는 같은 비즈니스 시나리오에서 다른 드라이버를 사용하는 워크플로우 작성자를 혼란에 빠뜨릴 수 있다. 나머지 사항들은 동작 정확성에 영향이 없는 코드 품질·문서화 수준의 이슈다.

## 위험도

**MEDIUM** — `sanitizeMessage` 미적용으로 인한 민감정보 노출 가능성, 크로스 드라이버 에러 코드 불일치로 인한 워크플로우 분기 오동작 가능성.