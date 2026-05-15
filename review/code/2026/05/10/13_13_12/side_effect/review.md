## 발견사항

### [CRITICAL] `DB_CONNECTION_FAILED` → `DB_CONNECTION_ERROR` 재명명: 무중단 확인 필요
- **위치**: `error-codes.ts:16` (rename), `spec/5-system/3-error-handling.md`
- **상세**: `ErrorCode.DB_CONNECTION_FAILED` 의 **값 문자열** 이 `'DB_CONNECTION_FAILED'` → `'DB_CONNECTION_ERROR'` 로 변경됨. 플랜 문서에 "사용처 없어 단순 rename" 이라 명시되어 있으나, 워크플로우 config JSON 에 expression 으로 저장된 문자열(`$node["X"].output.error.code === "DB_CONNECTION_FAILED"`)이나 프론트엔드 switch 문이 이 리터럴을 참조하고 있으면 컴파일 오류 없이 **조용히 분기 누락**된다. TypeScript enum 키 rename 은 타입 검사가 잡지만, 저장된 워크플로우 JSON 의 비교 문자열은 잡지 못한다.
- **제안**: `git grep -r "DB_CONNECTION_FAILED"` 로 전체 레포 스캔 후 0건인지 확인. DB 에 저장된 워크플로우 expression 에 대한 마이그레이션 스크립트 또는 런타임 alias 처리도 고려.

---

### [WARNING] 드라이버 간 인증 실패 분류 비일관성
- **위치**: `database-query.handler.ts` — `classifyPostgresSqlState` (class `28xxx` → `DB_PERMISSION_DENIED`) vs `MYSQL_CONNECTION_CODES` (`ER_ACCESS_DENIED_ERROR` → `DB_CONNECTION_ERROR`)
- **상세**: 의미상 동일한 "접속 시 인증 실패" 가 드라이버에 따라 다른 코드로 분류된다. PostgreSQL `28000` (invalid_authorization_specification) 은 `DB_PERMISSION_DENIED` 로, MySQL `ER_ACCESS_DENIED_ERROR` 는 `DB_CONNECTION_ERROR` 로 떨어진다. 크로스-드라이버 워크플로우를 만드는 작성자가 `output.error.code === "DB_PERMISSION_DENIED"` 에서 자격증명 교체 재시도 로직을 구성하면 MySQL 환경에서 분기가 발동되지 않는다.
- **제안**: spec §6.2 테이블에 이 비대칭을 명시적 노트로 추가하거나, PostgreSQL `28xxx` 도 `DB_CONNECTION_ERROR` 로 통일하는 방향 검토.

---

### [WARNING] `details.driverCode` 로 내부 DB 스키마 정보 노출
- **위치**: `database-query.handler.ts:mapDbError`, 출력 `output.error.details.driverCode`
- **상세**: `23505` / `ER_DUP_ENTRY` / `42501` 같은 드라이버 native code 가 `output.error` 에 포함되어 downstream 노드로 전달된다. 이 값이 프레젠테이션 노드나 HTTP 응답 노드를 통해 최종 사용자에게 그대로 노출되면 DB 제약 이름·테이블 구조 힌트가 될 수 있다. `output.error.message` 는 `sanitizeMessage` 처리가 언급되나 `details.driverCode` 는 sanitize 대상이 아니다.
- **제안**: 운영 가이드(spec 또는 주석)에 "driverCode 를 최종 사용자 응답에 직접 노출하지 말 것" 경고 추가.

---

### [INFO] `CONNECTION_ERRNOS` 와 `MYSQL_CONNECTION_CODES` 중복 항목
- **위치**: `database-query.handler.ts:458, 468` — `PROTOCOL_CONNECTION_LOST`, `PROTOCOL_SEQUENCE_TIMEOUT`, `PROTOCOL_PACKETS_OUT_OF_ORDER`
- **상세**: 세 코드가 두 Set 에 모두 존재한다. `classifyDbError` 에서 `CONNECTION_ERRNOS` 를 먼저 검사하므로 `MYSQL_CONNECTION_CODES` 의 동일 항목은 실행 불가 코드다. 결과는 동일(`DB_CONNECTION_ERROR`)하므로 동작 상 문제는 없지만, 이후 누군가 `MYSQL_CONNECTION_CODES` 의 해당 항목을 다른 분류로 바꿔도 `CONNECTION_ERRNOS` 가 먼저 적중해 반영되지 않는다.
- **제안**: `MYSQL_CONNECTION_CODES` 에서 세 항목 제거하거나 주석으로 "이미 `CONNECTION_ERRNOS` 에서 처리됨" 명시.

---

### [INFO] catch 블록 내 `instanceof IntegrationError` 분기가 실질적 사각지대
- **위치**: `database-query.handler.ts` — execute() catch 블록 `err instanceof IntegrationError` 체크
- **상세**: `IntegrationError` 를 throw 하는 경로(`resolveIntegration`, `missingDbFields`, `parseParameters`)는 모두 try 블록 **외부**에 위치한다. `executePostgres` / `executeMysql` 는 `IntegrationError` 를 throw 하지 않으므로, 현재 코드 기준으로 이 분기는 도달 불가다. 동작 문제는 없으나 dead code 로서 오해를 유발할 수 있다.
- **제안**: 주석으로 "방어적 보존 — 향후 try 블록 내에서 IntegrationError 가 발생할 경우를 대비" 설명 추가. 또는 현재 불필요하다면 제거 후 `mapDbError` 단독 사용.

---

## 요약

핵심 위험은 `DB_CONNECTION_FAILED` → `DB_CONNECTION_ERROR` 의 **값 문자열 변경**이다. TypeScript 타입 시스템은 이를 잡지만, DB 에 이미 저장된 워크플로우 expression 문자열은 잡지 못해 조용한 분기 누락이 발생할 수 있다. 나머지 변경(`mapDbError` 신규 함수 추가, `details.driverCode` echo, Set 기반 분류 로직)은 기존 출력 구조에 **additive** 하게 작용하고 공유 상태를 변경하지 않는다. 다만 드라이버 간 인증 실패 분류 비일관성은 스펙 문서에 명시가 필요하다.

## 위험도

**MEDIUM** — 코드 자체의 로직은 견고하나, `DB_CONNECTION_FAILED` 리터럴을 참조하는 저장 데이터/프론트엔드가 존재할 경우 런타임 분기 누락이 발생할 수 있으며 컴파일 타임에 감지되지 않는다.