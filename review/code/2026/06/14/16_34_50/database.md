# Database Review

## 발견사항

### [INFO] idx_execution_trigger_started — partial 인덱스 설계 적절
- 위치: `spec/1-data-model.md` 신규 추가 행 (V096)
- 상세: `(trigger_id, started_at DESC) WHERE trigger_id IS NOT NULL` partial 인덱스는 AuthConfig 사용 내역 집계 쿼리 (`totalCalls` COUNT, `periodCounts` 롤링 윈도, `recentCalls` 최근 20건) 를 위한 설계다. `trigger_id IS NOT NULL` 조건으로 schedule/manual(NULL) 행을 인덱스에서 제외해 크기·write amplification 을 최소화하는 방식은 기존 NodeExecution 의 V095 partial 인덱스 패턴과 일관된다.
- 제안: 이상 없음. CONCURRENTLY 생성 여부가 명시되지 않았으나, 기존 V095 행에는 `CONCURRENTLY` 표기가 있다. V096 마이그레이션 SQL 작성 시 `CREATE INDEX CONCURRENTLY` 를 사용해 테이블 락 없이 생성할 것을 권장한다 (운영 중 Execution 테이블은 고빈도 INSERT 대상).

### [INFO] AuthConfig 사용 내역 집계 — 전용 로그 테이블 없이 Execution 재사용
- 위치: `spec/1-data-model.md` §2.13 AuthConfig 호출 집계 경로 (SoT callout)
- 상세: `totalCalls`/`periodCounts`/`recentCalls` 를 `Execution.trigger_id → Trigger.auth_config_id` 조인으로 산출하는 구조다. 한 AuthConfig 에 연결된 트리거가 N개이면 쿼리는 `trigger_id IN (subquery)` + 집계 형태가 된다. 신규 인덱스(`idx_execution_trigger_started`)가 이 경로를 커버하므로 성능 위험은 낮다.
- 제안: `recentCalls` 20건 조회는 `trigger_id IN (...) ORDER BY started_at DESC LIMIT 20` 패턴으로 인덱스를 효과적으로 탄다. 다만 authConfig 당 트리거 수가 매우 많은 경우(수백 개) `IN (...)` 절이 커질 수 있으므로, 향후 트리거 수 제한 정책을 spec 에 명시해 두면 좋다.

### [INFO] DTO 변경 — DB 무관
- 위치: `codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts`
- 상세: `@ApiProperty({ type: Number })` / `@ApiProperty({ type: String })` 추가와 JSDoc 주석 한국어화는 Swagger 문서 메타데이터 변경으로, DB 스키마·쿼리·마이그레이션과 무관하다.
- 제안: 해당 없음.

### [INFO] webhook.md 처리 흐름 변경 — DB 쓰기 경로 추가
- 위치: `spec/5-system/12-webhook.md` §7 step 7e, 8b
- 상세: `ExecutionEngineService.execute()` 3번째 인자에 `sourceIp`·`responseCode` 를 추가해 Execution 행의 `source_ip`/`response_code` 컬럼(V096)을 채우는 경로가 명문화됐다. 이 컬럼들은 `VARCHAR(45)`/`VARCHAR(10)` nullable 로 기존 행에 NULL 기본값을 가지며, 기존 인서트 경로를 변경하지 않는다.
- 제안: `source_ip` / `response_code` 컬럼 자체에 인덱스는 없다(집계 대상이 아님). 인증 설정 사용 내역 쿼리는 이미 `trigger_id + started_at` 인덱스로 행을 좁힌 후 `source_ip`/`response_code` 를 projection 하는 구조라 별도 인덱스 불필요 — 적절.

## 요약

이번 변경은 AuthConfig 사용 내역(`GET /api/auth-configs/:id/usage`) 의 `source_ip`/`response_code` 컬럼 추가(V096) 와 관련 인덱스(`idx_execution_trigger_started`) 설계를 spec 에 반영한 것이다. Partial 인덱스 설계는 기존 패턴과 일관되고 쿼리 접근 패턴을 정확히 커버한다. 마이그레이션 SQL 작성 시 `CONCURRENTLY` 옵션 적용만 확인하면 무중단 배포 안전성 요건을 충족한다. DTO 변경은 DB 와 무관하며, 전반적으로 DB 설계 위험도는 낮다.

## 위험도

LOW

STATUS=success ISSUES=0
