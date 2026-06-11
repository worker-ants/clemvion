# 데이터베이스(Database) 리뷰 결과

## 발견사항

변경 범위: `DB_HOST_BLOCKED` 에러 코드 신설 + `database-query.handler.ts` SSRF 가드 승격 로직 + 관련 테스트·스펙 동기화.

데이터베이스 쿼리 자체(인덱스, N+1, 트랜잭션, 마이그레이션, 스키마)에 대한 변경은 없다. 변경의 핵심은 DB 연결 전 SSRF 호스트 차단을 전용 에러 코드로 surface 하는 것이므로 DB 운영 관점에서 검토할 사항은 제한적이다.

### 개별 항목

- **[INFO]** SSRF 가드가 커넥션 풀 획득 전에 위치함 — 올바른 위치 확인
  - 위치: `database-query.handler.ts` execute 메서드 내 SSRF 가드 블록 (L1814-1823)
  - 상세: `assertSafeOutboundHostResolved(creds.host)` 호출이 `resolvePgPool` / `resolveMysqlPool` 전에 위치하므로 SSRF 차단 시 실제 TCP 커넥션이 열리지 않는다. 풀 생성 및 커넥션 소비 없이 즉시 `IntegrationError('DB_HOST_BLOCKED', ...)` 를 throw 하고 `port: 'error'` 로 라우팅하는 구조가 올바르다.
  - 제안: 추가 조치 불필요. 테스트(`expect(connectMock).not.toHaveBeenCalled()`)도 이 보장을 명시적으로 검증하고 있다.

- **[INFO]** 커넥션 풀 관리 변경 없음 — 기존 안전성 유지
  - 위치: `resolvePgPool` / `resolveMysqlPool` (변경 없음)
  - 상세: SSRF 차단 경로는 풀 캐시를 건드리지 않으므로 `POOL_MAX_CONNECTIONS=5` / `POOL_IDLE_TIMEOUT_MS=30_000` 설정, `finally { client?.release() }` 보장, credential 회전 evict 로직 등 기존 커넥션 관리에 영향이 없다.
  - 제안: 해당 없음.

- **[INFO]** 에러 메시지에서 host/IP 미노출 — 정찰 면 축소 적절
  - 위치: `database-query.handler.ts` IntegrationError 생성부 (L1818-1820)
  - 상세: `'Database host resolves to a private/loopback address blocked by SSRF policy.'` 로 일반화된 문구를 사용하며 원본 host 값을 포함하지 않는다. 테스트(`expect(out.output.error.message).not.toContain(host)` + `.toMatch(/SSRF policy/i)`)가 이를 검증한다. 서버 측 상세 정보는 `logUsage` 의 `toLogError` 경로로만 기록된다.
  - 제안: 해당 없음.

- **[INFO]** `DB_HOST_BLOCKED` 가 `mapDbError` 분기에 도달하지 않음 — 타입 안전성 확인
  - 위치: `database-query.handler.ts` catch 블록 에러 분기 (L1867-1873)
  - 상세: SSRF 차단 시 `IntegrationError('DB_HOST_BLOCKED', ...)` 를 throw 하므로 catch 블록에서 `err instanceof IntegrationError` 분기를 타고 `code: err.code` 가 그대로 surface 된다. `mapDbError` 의 `DbRuntimeErrorCode` 타입(`DB_QUERY_FAILED` / `DB_CONNECTION_ERROR` / `DB_CONSTRAINT_VIOLATION` / `DB_PERMISSION_DENIED`)에 `DB_HOST_BLOCKED` 를 추가하지 않은 것이 의도적이며 올바르다.
  - 제안: 해당 없음.

## 요약

이번 변경은 `DB_HOST_BLOCKED` 라는 전용 에러 코드를 추가해 Database Query 노드의 SSRF 차단 경로를 HTTP(`HTTP_BLOCKED`) / Email(`EMAIL_HOST_BLOCKED`) 과 대칭으로 맞추는 것이 전부이다. 실제 SQL 실행·인덱스·트랜잭션·마이그레이션·스키마·커넥션 풀·SQL 인젝션·페이지네이션에 대한 변경은 없다. SSRF 가드는 커넥션 풀 획득 전에 위치하므로 차단 시 TCP 연결이 열리지 않고, 에러 메시지에서 host/IP 를 노출하지 않는 설계 모두 DB 보안 관점에서 적절하다. 지적할 DB 위험 요소가 없다.

## 위험도

NONE
