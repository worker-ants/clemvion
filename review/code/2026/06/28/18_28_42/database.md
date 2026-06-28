# 데이터베이스(Database) 리뷰 결과

## 발견사항

### [INFO] `NOT IN (:...autoRefreshServiceTypes)` 파라미터 바인딩 — 빈 목록 방어 처리 적절
- 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` +122~138
- 상세: `autoRefreshServiceTypes` 가 비어있을 때 `NOT IN ()` 을 생성하지 않도록 `hasAutoRefreshTypes` 가드로 절 자체를 생략하는 처리가 있다. 일부 RDBMS(PostgreSQL 포함)에서 `NOT IN ()` 빈 목록은 문법 오류 또는 항상 TRUE 로 평가될 수 있어, 이 방어 로직은 올바르다. 현재 목록이 항상 비어있지 않다는 주석도 있으나, 미래에 registry 가 비워질 경우에도 안전하게 동작한다.
- 제안: 이상 없음.

### [INFO] 파라미터화된 쿼리 사용 — SQL 인젝션 위험 없음
- 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` +126~128, +161~171
- 상세: `NOT IN (:...autoRefreshServiceTypes)` 및 `autoRefreshParams` 는 TypeORM QueryBuilder 의 파라미터 바인딩을 사용한다. 서비스 타입 목록이 `SERVICE_REGISTRY` 정적 소스에서만 파생되므로 사용자 입력이 직접 SQL 에 삽입되는 경로가 없다. `EXPIRING_SOON_INTERVAL` 도 코드 상수이며 템플릿 리터럴로 SQL fragment 에 직접 삽입되지만, 사용자 제어 입력이 아니므로 SQL 인젝션 위험은 없다.
- 제안: 이상 없음.

### [INFO] `attention` 분기의 OR 합집합 내 서브절 인라인 — 쿼리 정합성 유지
- 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` +161~171
- 상세: `attention` 분기는 `(expired ∪ error ∪ connected)` OR 합집합을 단일 `andWhere` 호출로 생성한다. `autoRefresh` 제외 절(`AND i.service_type NOT IN (...)`)이 connected 서브절 **내부**에 인라인으로 삽입된다. 최상위 AND 로 걸면 expired/error 행까지 잘못 필터링되므로 인라인 방식이 논리적으로 맞다. 코드 주석에 이 설계 근거가 명시돼 있다.
- 제안: `AUTO_REFRESH_NOT_IN` 상수와 `autoRefreshParams` 를 두 경로(expiring 헬퍼, attention 인라인)가 공유하므로 파라미터 키 이름 불일치 위험이 제거됐다. 이상 없음.

### [INFO] 인덱스 관련 — 기존 쿼리 패턴 유지, 신규 인덱스 필요 없음
- 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` +119~171
- 상세: `i.service_type NOT IN (...)` 조건이 추가됐다. `service_type` 컬럼에 인덱스가 없다면 풀 스캔이 발생할 수 있으나, 이 조건은 이미 `i.status = 'connected'`, `i.token_expires_at IS NOT NULL`, `i.token_expires_at <= NOW() + INTERVAL '7 days'` 등 선택도 높은 조건 이후에 AND 로 결합되는 후위 필터다. 서비스 타입 수가 유한하고 소수(현재 3종)이므로 별도 인덱스 없이도 성능 영향은 미미할 가능성이 높다. 단, `integration` 테이블이 수십만 행 이상으로 커지는 경우 `service_type` + `status` 복합 인덱스를 검토할 수 있다.
- 제안: 현재 규모에서는 허용 범위. 테이블이 대형화되면 `(workspace_id, status, service_type)` 복합 인덱스 검토 권장.

---

## 요약

변경의 핵심 DB 관련 코드는 `integrations.service.ts` 의 `findAll` QueryBuilder 로직이다. `SERVICE_REGISTRY` 에서 동적으로 파생된 `autoRefreshServiceTypes` 를 TypeORM 파라미터 바인딩(`:...autoRefreshServiceTypes`)으로 `NOT IN` 절에 전달하므로 SQL 인젝션 위험이 없다. 빈 목록 방어(`hasAutoRefreshTypes` 가드), OR 합집합 내 서브절 인라인 설계(expired/error 행 오-필터링 방지), 파라미터 키 단일화(두 분기 동일 상수 참조)가 모두 적절하다. 마이그레이션 없는 순수 쿼리 로직 변경이므로 스키마 안전성 이슈는 없다. `service_type` 컬럼에 대한 인덱스 부재가 대형 테이블에서 문제가 될 수 있으나, 선행 고선택도 조건이 행 집합을 충분히 좁히므로 현재 운영 규모에서는 허용 범위다. 프론트엔드, 문서, 리뷰 산출물 파일들은 DB 레이어와 무관하다.

## 위험도

LOW
