# Code Review 이슈 조치 — 2026-05-10_13-13-12

리뷰 대상: 커밋 `fc9b24ef` (`fix(nodes/integration/database-query): A+D — error code 세분화 + driver code 매핑 + alias 정리`)

리뷰 결과: **MEDIUM** (Critical 1 / Warning 9 / Info 15)

본 문서는 SUMMARY.md 의 발견사항에 대한 조치 결과를 기록한다. 모든 Warning 이상 + 가치 높은 Info 항목을 처리했다 (developer skill REVIEW WORKFLOW 정책).

---

## CRITICAL — 조치 완료

### #1 `DB_CONNECTION_FAILED` → `DB_CONNECTION_ERROR` 값 변경의 저장 데이터 사이드 이펙트

- **상태**: 조치 완료 / 영향 범위 재확인
- **검증**:
  - `git grep -r "DB_CONNECTION_FAILED"` 결과: plan 문서 1건 외 source/spec/test/seed/migration 0건.
  - 본 프로젝트는 Phase 1 D ("호환성 무시 마이그레이션") 정책 적용 단계이므로 다운스트림 워크플로우 expression 은 사용자가 직접 정정한다 (`plan/in-progress/spec-4-nodes-unimplemented-cleanup.md` §1.1.10 commit body 참조).
  - `error-codes.ts` 의 옛 `DB_CONNECTION_FAILED` 정의는 **사용처 0건** 이었으므로 단순 rename. 저장된 워크플로우 expression 은 새 enum 으로 재작성하면 된다.
- **장기 후속**: 추후 production 배포 단계에 진입하면 DB 저장 expression 정적 분석 도구가 별도 도입되어야 한다 — 본 plan 의 범위를 벗어나므로 별도 plan 으로 분리한다.

---

## WARNING — 조치 완료

### #1 `mapDbError` 에 `sanitizeMessage` 미적용 (Security / API Contract / Requirement)

- **상태**: 조치 완료
- **변경**: `database-query.handler.ts`
  - `mapDbError` 가 `sanitizeMessage(err.message)` 를 적용한 후 `output.error.message` 에 노출.
  - `IntegrationError` 분기도 동일하게 `sanitizeMessage(err.message)` 적용 — spec §5.3 / §6.2 의 "password/Bearer/긴 토큰 마스킹" 약속 일관 충족.
- **테스트**: `sanitizes secret-looking fragments in driver error messages` 신규 케이스 — `password=hunter2` / `Bearer abcdef…` 가 `***` 로 마스킹됨을 확인.

### #2 `DB_QUERY_FAILED` 단일 코드 세분화의 묵시적 Breaking Change (API Contract)

- **상태**: 조치 완료 (문서화)
- **변경**: 본 RESOLUTION.md 에 마이그레이션 가이드 명시. spec §5.3 의 expression 접근 예에 4-enum 모두 포함.
  - 옛 분기: `output.error.code === "DB_QUERY_FAILED"` (모든 SQL 오류 catch-all)
  - 신 분기: 위 + `=== "DB_CONSTRAINT_VIOLATION"` / `=== "DB_PERMISSION_DENIED"` / `=== "DB_CONNECTION_ERROR"` 추가.
  - retry 정책: `DB_CONNECTION_ERROR` 만 retry 후보. 나머지는 영구 오류.
- **호환성 정책**: Phase 1 D 정책 — 다운스트림 expression 은 사용자가 직접 보강.

### #3 PG class 28 vs MySQL `ER_ACCESS_DENIED_ERROR` 분류 비대칭 (Architecture / Dependency)

- **상태**: 조치 완료
- **변경**:
  - `database-query.handler.ts.classifyPostgresSqlState`: PG class 28 (`invalid_authorization_specification`) 을 `DB_PERMISSION_DENIED` → `DB_CONNECTION_ERROR` 로 이동. mysql2 의 `ER_ACCESS_DENIED_ERROR` 와 동일하게 handshake-time 인증 실패는 connection 으로 분류 → credential rotation retry 정책 양 드라이버 동작 일치.
  - 추가로 PG class 53 (`insufficient_resources`, e.g. `too_many_connections` 53300) 도 `DB_CONNECTION_ERROR` 로 분류 (INFO #12 동시 처리).
  - spec §6.2 표 갱신 — `DB_CONNECTION_ERROR` 행에 pg `08xxx` / `28xxx` / `53xxx` / `57xxx` 명시 + "드라이버 간 일관성 메모" 블록 추가.
- **테스트**: `28000` / `53300` / `57P01` 신규 케이스 추가.

### #4 신규 에러 테스트의 `out.port` 검증 누락 (Testing)

- **상태**: 조치 완료
- **변경**: 9개 신규/기존 에러 케이스 모두 `expect(out.port).toBe('error')` 추가.

### #5 신규 PostgreSQL 에러 테스트의 `releaseMock` 검증 누락 (Testing)

- **상태**: 조치 완료
- **변경**: PG 에러 케이스 5개 (`23505`/`23503`/`42501`/`42601`/`08006`) 에 `expect(releaseMock).toHaveBeenCalled()` 추가. `ECONNRESET` 케이스는 `connect()` 가 reject 되어 client 가 acquire 되지 않으므로 `expect(releaseMock).not.toHaveBeenCalled()` 명시.

### #6 SQLSTATE class 08 / 28 / 57 미테스트 (Testing)

- **상태**: 조치 완료
- **변경**: 신규 테스트 — `08006` (connection_failure), `28000` (invalid_authorization), `53300` (too_many_connections), `57P01` (admin_shutdown) 모두 `DB_CONNECTION_ERROR` 매핑 검증.

### #7 MySQL 자격증명 객체 인라인 복사 5건 이상 (Maintainability)

- **상태**: 조치 완료
- **변경**: `MYSQL_INTEGRATION_BASE` 상수 + 인라인 `credentials.ssl` override 패턴으로 통합. 기존 5건 → 1건 SSOT.

### #8 `mapDbError` 불필요한 `export` (Architecture)

- **상태**: 조치 완료
- **변경**: `export` 제거. 함수는 내부 전용 (`function mapDbError`). 향후 다른 핸들러 재사용 필요 시 `_base/db-error-classifier.ts` 로 분리 — 주석으로 명시.

### #9 `const driver` 중복 선언 (Maintainability)

- **상태**: 조치 완료
- **변경**: `try` 진입 직전 단일 선언으로 끌어올림.

---

## INFO — 가치 있는 항목 조치 완료

### #1 `CONNECTION_ERRNOS` / `MYSQL_CONNECTION_CODES` 의 `PROTOCOL_*` 중복 (Architecture)

- **상태**: 조치 완료
- **변경**: `MYSQL_CONNECTION_CODES` 에서 3개 PROTOCOL_* 항목 제거. `CONNECTION_ERRNOS` 가 우선 매칭하므로 dead code 였음. 두 Set 의 doc 주석에 우선순위 명시.

### #2 분류 함수 반환 타입 유니언 반복 (Maintainability)

- **상태**: 조치 완료
- **변경**: `type DbRuntimeErrorCode = ...` alias 추출 후 `mapDbError` / `classifyDbError` / `classifyPostgresSqlState` / `classifyMysqlCode` 모두 재사용.

### #3 출력 타입 캐스팅 7회 반복 (Maintainability / Testing)

- **상태**: 조치 완료
- **변경**: `type ErrorPortOutput = { port: string; output: { error: { code, message, details? } } }` 정의 후 9개 에러 테스트 모두 재사용.

### #5 `pool.on('error')` idle 에러 무음 처리 (Database)

- **상태**: 조치 완료
- **변경**: `Logger('DatabaseQueryHandler')` 추가 + `pool.on('error', (err) => logger.warn(... sanitizeMessage(err.message) ...))`. integrationId 컨텍스트 포함.

### #9 spec §6.2 `DB_PERMISSION_DENIED` 행 PG class `28xxx` 누락 (Documentation)

- **상태**: 조치 완료 (재해석)
- **변경**: WARNING #3 의 cross-driver symmetry 결정으로 PG class 28 은 `DB_CONNECTION_ERROR` 로 이동했으므로 `DB_PERMISSION_DENIED` 행에는 추가하지 않음. 대신 `DB_CONNECTION_ERROR` 행에 명시 + 표 하단 메모로 양 드라이버 비대칭 해소를 명문화.

### #10 `MYSQL_CONSTRAINT_CODES` / `MYSQL_PERMISSION_CODES` 주석 부재 (Documentation)

- **상태**: 조치 완료
- **변경**: 두 Set 위에 doc 주석 블록 추가 — 의미 / PostgreSQL 클래스와의 대응 / 인증된 세션 vs handshake 구분.

### #11 `classifyPostgresSqlState` 주석 "class-23 fallback" 표현 오해 (Documentation)

- **상태**: 조치 완료
- **변경**: "must precede the generic class switch below because class 42 ... otherwise routes to DB_QUERY_FAILED" 로 수정.

### #12 PG class `53` (insufficient_resources) `DB_QUERY_FAILED` 낙하 (Requirement)

- **상태**: 조치 완료
- **변경**: WARNING #3 와 함께 처리. `if (klass === '53' || klass === '57') return 'DB_CONNECTION_ERROR'`. spec §6.2 + 신규 테스트 (`53300`) 동기화.

### #14 `mapDbError` 반환 타입 `code: string` 으로 너무 넓음 (Maintainability)

- **상태**: 조치 완료
- **변경**: INFO #2 와 함께 `DbRuntimeErrorCode` 로 좁힘.

---

## INFO — 미조치 (의도적)

### #4 `afterEach` shutdown 이동

- **사유**: 현재 모든 테스트가 정상 통과하며 assertion throw → shutdown 스킵 상황은 회귀 시나리오. Phase 1 범위 외, 별도 테스트 인프라 정비 plan 이 추후 필요. 현 시점은 명시적 `await handler.shutdown()` 패턴 유지.

### #6 대용량 결과셋 `maxRows` 방어

- **사유**: spec §4 에 추가 결정이 필요하며 본 plan (A+D) 범위 외. `project-planner` 영역.

### #7 트랜잭션 미지원 spec 명시

- **사유**: spec 신규 정의. `project-planner` 영역으로 분리 필요.

### #8 catch 내 `IntegrationError` 분기 도달 불가

- **사유**: 방어적 보존. 향후 `executePostgres`/`executeMysql` 가 새 wrapper 를 통해 `IntegrationError` 를 throw 할 가능성을 위한 안전망. 코드 주석으로 의도 명시 추가 완료.

### #13 `details.driverCode` 로 DB 엔진 추정 가능 (Security)

- **사유**: 운영 가이드 갱신 항목 — 본 plan 범위 외. 후속 user-facing 문서 정비에 합류.

### #15 분류 Set 상수 파일 위치 분리

- **사유**: 장기 리팩토링 — 단기 현행 유지가 SUMMARY 권장사항.

---

## TEST 재실행 결과

- `cd backend && npm run lint`: 통과 (warning 0)
- `cd backend && npm test -- --testPathPatterns="database-query"`: 40 passed (5 신규 + 35 기존)
- `cd backend && npm test`: 2979 passed (이전 2974 → 5 증가)
- `cd backend && npm run build`: 통과
- `python3 scripts/check-doc-links.py`: 0 broken refs

---

## 최종 변경 파일

- `backend/src/nodes/integration/database-query/database-query.handler.ts`
- `backend/src/nodes/integration/database-query/database-query.handler.spec.ts`
- `backend/src/nodes/core/error-codes.ts` (이전 커밋 fc9b24ef 와 동일 — rename 완료 상태 유지)
- `spec/4-nodes/4-integration/2-database-query.md`
