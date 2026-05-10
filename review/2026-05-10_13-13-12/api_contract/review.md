### 발견사항

- **[WARNING]** `DB_CONNECTION_FAILED` → `DB_CONNECTION_ERROR` 이름 변경 (Breaking)
  - 위치: `error-codes.ts` diff, `-  DB_CONNECTION_FAILED: 'DB_CONNECTION_FAILED'` → `+  DB_CONNECTION_ERROR: 'DB_CONNECTION_ERROR'`
  - 상세: 워크플로우 expression에서 `$node["X"].output.error.code === "DB_CONNECTION_FAILED"` 로 분기하던 클라이언트는 조용히 매칭 실패. plan 문서는 "사용처 없어 단순 rename" 이라 기술하나, 핸들러 내 emission 여부와 워크플로우 expression 레벨 사용 여부는 별개이므로 외부 사용 여부를 확인할 수 없음.
  - 제안: 최소 1 릴리즈 동안 두 값을 `ErrorCode` 객체에 공존시키거나, 마이그레이션 가이드 없이 즉시 제거했다면 CHANGELOG에 명시적 breaking note 추가.

- **[WARNING]** 기존 `DB_QUERY_FAILED` 단일 코드에서 세분화로 인한 묵시적 Breaking Change
  - 위치: `database-query.handler.ts` → `mapDbError` / `classifyDbError`
  - 상세: 이전에는 constraint violation·permission denied 모두 `DB_QUERY_FAILED` 로 떨어졌으나, 이제 각각 `DB_CONSTRAINT_VIOLATION` / `DB_PERMISSION_DENIED` 로 분류됨. `=== "DB_QUERY_FAILED"` 로 일반 실패를 포괄 처리하던 워크플로우 expression은 이 두 경우를 더 이상 잡지 못함.
  - 제안: spec §6.2 에서 이미 "매핑 안 되는 모든 케이스의 fallback" 으로 명시했으나, 클라이언트/워크플로우 마이그레이션 가이드(기존 `DB_QUERY_FAILED` 분기에 새 코드 추가 필요)를 별도로 제공해야 함.

- **[WARNING]** `output.error.message` sanitization 미적용 가능성
  - 위치: `database-query.handler.ts` → `mapDbError` 함수, `const message = err instanceof Error ? err.message : String(err)`
  - 상세: spec §5.3 필드 표에는 "`sanitizeMessage` 로 password/secret 토큰 마스킹 적용 후 노출" 이라 기술되어 있으나, `mapDbError` 는 raw `err.message` 를 그대로 반환. DB 드라이버 에러 메시지에 connection URI(`postgresql://user:password@host/db`) 나 credential 조각이 포함될 수 있어 API response에 민감 정보가 노출될 위험이 있음.
  - 제안: `mapDbError` 내부 또는 호출부에서 `sanitizeMessage(message)` 적용 여부 확인 후 누락 시 추가. `toLogError` 는 이미 sanitize 를 적용하므로 동일 함수 또는 동등 로직 적용 필요.

- **[INFO]** MySQL `ER_ACCESS_DENIED_ERROR` → `DB_CONNECTION_ERROR` 분류 의미 불일치 가능성
  - 위치: `database-query.handler.ts` → `MYSQL_CONNECTION_CODES` Set
  - 상세: access denied는 의미상 permission 거부이나 핸들러에서 `DB_CONNECTION_ERROR` 로 분류. 코드 내 주석("retry policies that rotate credentials trigger correctly")으로 설계 의도를 설명하나, `DB_PERMISSION_DENIED` 를 구독하는 클라이언트가 MySQL auth 실패를 이 코드로 기대하면 놓치게 됨.
  - 제안: spec §6.2 `DB_CONNECTION_ERROR` 드라이버 힌트에 `ER_ACCESS_DENIED_ERROR` 가 나열되어 있으나, `DB_PERMISSION_DENIED` 항목에는 없음 — 이미 스펙에 반영되었으므로 스펙 자체에 "MySQL auth-time access denial은 CONNECTION_ERROR 로 분류됨 (credential rotation 목적)" 을 명시적 note로 추가하면 혼동 방지.

- **[INFO]** `details` 필드의 조건부 존재(presence) 계약
  - 위치: `database-query.handler.ts` → `mapDbError` 반환 타입, spec §5.3 필드 표
  - 상세: `details` 는 driver code 가 없을 때 **키 자체가 생략**되는 반면, 있을 때는 `{ driverCode: string }` 만 포함. 클라이언트가 `details?.driverCode` 옵셔널 체이닝을 사용해야 함. 이는 CONVENTIONS Principle 11 준수이며 스펙에 문서화되어 있으므로 계약상 문제 없음.

- **[INFO]** API 버전 변경 없는 계약 변경
  - 위치: 전반적 변경
  - 상세: 노드 실행 출력 계약(`output.error.code` 가능 값 집합, `output.error.details` 신규 필드)이 변경되었으나 버전 관리(API version bump, deprecated 마킹) 없이 적용. 워크플로우 실행 API는 노드 output 구조를 그대로 노출하므로 간접적 API 계약 변경에 해당.

---

### 요약

이번 변경은 노드 에러 출력 계약을 `DB_QUERY_FAILED` 단일 코드에서 4종으로 세분화하는 의미 있는 개선이며, 스펙·코드·테스트가 일관되게 동기화된 점은 긍정적이다. 그러나 `DB_CONNECTION_FAILED` → `DB_CONNECTION_ERROR` 리네임과 기존 `DB_QUERY_FAILED` 포괄 분기 클라이언트에 대한 묵시적 breaking change가 마이그레이션 가이드 없이 즉시 적용되며, `mapDbError` 내 `sanitizeMessage` 미적용 가능성은 API response에 DB 자격증명이 노출될 위험이 있어 배포 전 확인이 필요하다.

### 위험도
**MEDIUM** — breaking change 두 건은 워크플로우 expression 수준에서 조용히 실패하며, sanitize 누락 가능성이 동반될 경우 민감 정보 노출로 격상될 수 있음.