## 발견사항

---

### **[WARNING]** `DB_CONNECTION_FAILED` → `DB_CONNECTION_ERROR` 파괴적 이름 변경 — 퍼시스티드 의존성 누락

- **위치**: `error-codes.ts` diff, `ErrorCode.DB_CONNECTION_FAILED` 제거
- **상세**: plan 문서는 "사용처 없어 단순 rename"으로 기록하지만 TypeScript 컴파일 타임 참조만 스캔한 것으로 보임. DB에 저장된 워크플로우 expression(`$node["X"].output.error.code === "DB_CONNECTION_FAILED"`)은 런타임 문자열 비교이므로 컴파일러가 잡지 못함. 기존 워크플로우에서 이 코드를 분기 조건으로 사용하고 있을 경우 **조용히 분기 실패** (always-false).
- **제안**: 실사용 여부를 런타임 레벨까지 확인 필요 (`grep -r 'DB_CONNECTION_FAILED' .` 로 spec/prd/저장 워크플로우 포함 전수 탐색). 실제 저장 데이터가 없음이 보증되지 않는다면 `DB_CONNECTION_FAILED`를 `ErrorCode`에 `@deprecated` 주석과 함께 한 릴리즈 동안 유지 후 제거.

---

### **[WARNING]** PostgreSQL `28xxx` ↔ MySQL `ER_ACCESS_DENIED_ERROR` 드라이버 간 의미론적 불일치

- **위치**: `database-query.handler.ts`, `classifyPostgresSqlState` (class `28` → `DB_PERMISSION_DENIED`) vs `MYSQL_CONNECTION_CODES` (`ER_ACCESS_DENIED_ERROR` → `DB_CONNECTION_ERROR`)
- **상세**: 두 코드 모두 "잘못된 자격증명으로 인한 인증 실패" 시나리오이지만 서로 다른 canonical 코드를 반환함. MySQL을 PostgreSQL로 교체하는 워크플로우에서 재시도/분기 로직이 상이하게 동작.

  | 에러 시나리오 | PostgreSQL | MySQL |
  |---|---|---|
  | 잘못된 비밀번호 | `DB_PERMISSION_DENIED` (28P01) | `DB_CONNECTION_ERROR` (ER_ACCESS_DENIED_ERROR) |

- **제안**: MySQL `ER_ACCESS_DENIED_ERROR`를 `MYSQL_CONNECTION_CODES`에서 제거하고 `MYSQL_PERMISSION_CODES`로 이동하거나, 반대로 pg `28xxx`를 `DB_CONNECTION_ERROR`로 통일. spec §6.2의 `DB_CONNECTION_ERROR` 설명에 "인증 거부"가 포함되어 있으므로 MySQL 쪽이 더 spec에 충실함 — pg `28xxx` → `DB_CONNECTION_ERROR`로 교정이 더 일관됨.

---

### **[INFO]** `CONNECTION_ERRNOS`와 `MYSQL_CONNECTION_CODES` 집합 중복 항목

- **위치**: `database-query.handler.ts:450–474`
- **상세**: `PROTOCOL_CONNECTION_LOST`, `PROTOCOL_SEQUENCE_TIMEOUT`, `PROTOCOL_PACKETS_OUT_OF_ORDER` 3개 항목이 두 집합 모두에 존재. `classifyDbError`에서 `CONNECTION_ERRNOS` 체크가 먼저 실행되므로 `MYSQL_CONNECTION_CODES`의 해당 항목은 **도달 불가 코드**. 버그는 아니지만 향후 유지보수자에게 혼란을 줄 수 있음.
- **제안**: `MYSQL_CONNECTION_CODES`에서 중복 3개 제거 + 주석으로 "Node errno는 `CONNECTION_ERRNOS`에서 먼저 처리됨" 명시.

---

### **[INFO]** `mapDbError` 함수 export — 내부 API 커플링 표면 생성

- **위치**: `database-query.handler.ts`, `export function mapDbError`
- **상세**: 현재 이 함수를 임포트하는 소비자가 없어 보이지만 `export`로 공개되어 있어 향후 다른 핸들러(e.g. 향후 `sqlite`, `mssql` 지원 시)가 임포트할 수 있음. handler 파일에서 직접 export하면 "handler module = 실행 로직 단위"라는 암묵적 경계가 흐려짐.
- **제안**: 재사용 계획이 없다면 `export` 제거. 여러 드라이버 핸들러에서 공유할 계획이라면 `backend/src/nodes/integration/_base/db-error-mapper.ts` 같은 별도 모듈로 분리.

---

### **[INFO]** 드라이버 버전에 대한 암묵적 의존

- **위치**: `classifyPostgresSqlState` (SQLSTATE 5자 고정 길이 가정), `MYSQL_*_CODES` 집합
- **상세**: `pg` 드라이버의 `DatabaseError.code`가 SQLSTATE 5자라는 것, `mysql2`의 오류 코드가 `ER_*` 포맷이라는 것은 현재 드라이버 버전에 의존하는 암묵적 계약. `package.json`에 버전 범위가 느슨하게 고정되어 있을 경우 메이저 업그레이드 시 이 분류 로직이 조용히 실패할 수 있음.
- **제안**: 현재는 큰 리스크 아님(SQLSTATE는 ISO 표준, ER_* 코드는 mysql2에서 안정적). `package.json`에서 `pg`/`mysql2` 버전 범위가 major-locked(`^` 사용)인지 확인하는 정도로 충분.

---

### **[INFO]** 신규 외부 의존성 없음 — 의존성 증가 없음

- **위치**: 전체 diff
- **상세**: `import` 추가 없음. `pg`, `mysql2/promise`, `crypto`(Node.js 내장)는 기존 의존성. 번들 크기, 라이선스, 취약점 우려 없음.

---

## 요약

이 변경은 외부 패키지 의존성을 추가하지 않으며 기존 `pg`/`mysql2` 드라이버 인터페이스를 올바르게 활용하고 있다. 의존성 관점의 핵심 리스크는 `DB_CONNECTION_FAILED` → `DB_CONNECTION_ERROR` 이름 변경으로, TypeScript 빌드는 통과하더라도 데이터베이스에 저장된 워크플로우 expression에 잠재적 의미론적 브레이킹 체인지가 존재한다. 추가로 PostgreSQL과 MySQL 간 인증 실패 에러 코드 불일치가 크로스 드라이버 워크플로우 이식성을 해칠 수 있다. 나머지 항목들은 코드 품질 수준의 사소한 정리 사항이다.

## 위험도

**LOW** (저장 워크플로우 데이터에서 `DB_CONNECTION_FAILED` 미사용이 확인되는 경우) / **MEDIUM** (확인 불가한 경우)