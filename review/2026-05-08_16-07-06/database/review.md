## 발견사항

### 현재 변경사항 (파일 1–6, 8–36, 37, 39–42)

이 파일들의 변경은 **CONVENTIONS Principle 7 rawConfig echo** 리팩토링입니다. DB 쿼리 실행 경로, 트랜잭션, 스키마에는 영향이 없습니다.

---

### 파일 7: `database-query.handler.ts`

- **[INFO]** `rawConfig.query` (미평가 템플릿) 가 config echo 에 기록됨
  - 위치: `configEcho.query: rawConfig.query`
  - 상세: `{{ ... }}` 템플릿 문자열이 실행 결과의 `config.query` 필드에 저장됩니다. 실제 DB 쿼리 실행은 `config.query` (평가된 값) 와 `parseParameters(config.parameters)` 를 사용하므로 SQL 인젝션 위험은 없습니다. 그러나 템플릿 원문이 실행 로그·audit trail 에 남는다는 점은 정책 확인이 필요합니다.
  - 제안: 이 동작이 의도적임을 Principle 7 정책 문서에 명시 (이미 주석에 기술됨, 현 상태 수용 가능).

- **[INFO]** `queryType` 로컬 변수 제거
  - 위치: `-    const queryType = (config.queryType as string) ?? 'select';`
  - 상세: 제거된 변수가 echo 이외에 쿼리 실행 분기(예: SELECT vs INSERT 처리 방식 차이)에 사용되지 않는지 확인이 필요합니다. 현재 diff 범위에서는 echo 전용으로만 보이며 실행 로직에는 영향 없음.
  - 제안: 핸들러 전체 파일을 확인하여 `queryType` 이 실행 경로에서도 사용되지 않음을 확인할 것.

---

### 파일 38: `plan/in-progress/ai-review-deferred-items.md` — PR-B 데이터베이스 설계 (계획 문서)

이 파일은 **구현 예정 설계 계획**입니다. 실제 코드는 아니지만 DB 관점에서 잠재적 위험이 높아 검토합니다.

- **[WARNING]** 인덱스 생성 시 테이블 잠금 위험
  - 위치: `CREATE INDEX execution_node_log_execution_id_id_idx ON execution_node_log (execution_id, id);`
  - 상세: `execution_node_log` 가 대량 데이터 이행(`INSERT ... SELECT`) 이후에 인덱스를 생성합니다. 일반 `CREATE INDEX` 는 PostgreSQL에서 `ShareLock` 을 획득하여 해당 테이블에 대한 쓰기를 차단합니다. 마이그레이션이 프로덕션 트래픽 중에 실행되면 쓰기 지연이 발생합니다.
  - 제안: `CREATE INDEX CONCURRENTLY` 사용. 단, `CONCURRENTLY` 는 트랜잭션 블록 내에서 실행 불가하므로 마이그레이션을 두 단계로 분리 필요.

- **[WARNING]** 대량 데이터 이행 — 배치 없음
  - 위치: `INSERT INTO execution_node_log ... SELECT ... FROM execution e, UNNEST(e.execution_path) ...`
  - 상세: `execution` 테이블 규모에 따라 단일 `INSERT ... SELECT` 가 장시간 트랜잭션을 유지합니다. PostgreSQL은 이 기간 동안 `execution` 테이블에 `ShareUpdateExclusiveLock` 이 걸리고 WAL 이 대규모로 생성됩니다. 수백만 행 이상이면 타임아웃·OOM 위험이 있습니다.
  - 제안: 배치 마이그레이션 스크립트 (`LIMIT + OFFSET` 또는 cursor 방식) 를 별도 단계로 실행하거나, `execution_path` 컬럼을 즉시 DROP 하지 않고 데이터 이행 완료 후 별도 마이그레이션으로 분리.

- **[WARNING]** `ALTER TABLE execution DROP COLUMN execution_path` — 무중단 배포 위험
  - 위치: `ALTER TABLE execution DROP COLUMN execution_path;`
  - 상세: PostgreSQL 12+ 에서 컬럼 DROP 은 빠르지만 `ACCESS EXCLUSIVE LOCK` 을 짧게 획득합니다. 롤링 배포 중에는 **구버전 애플리케이션이 여전히 `executionPath` 컬럼을 참조할 수 있으므로** 컬럼 DROP 이 먼저 실행되면 구버전 인스턴스가 쿼리 오류를 냅니다.
  - 제안: Blue-green 배포 또는 3단계 무중단 마이그레이션 적용: ① 신버전 배포 (컬럼 읽기 제거), ② 데이터 이행 완료 확인, ③ 컬럼 DROP 마이그레이션 별도 실행.

- **[WARNING]** list 조회 N+1 위험 — 계획 내 인지되었으나 해결책 미확정
  - 위치: 계획 문서 §"회귀 위험 영역" — `executions.service.ts:251` list 조회
  - 상세: `executionPath` 를 `execution_node_log` 에서 채울 때 실행 목록 조회(`GET /executions`) 에서 실행별로 `execution_node_log` 를 개별 쿼리하면 N+1 이 발생합니다. 계획 문서가 이를 언급하고 "list 응답은 path 생략 또는 batch 조회" 를 권장하지만 확정되지 않았습니다.
  - 제안: list 엔드포인트에서는 `executionPath` 를 응답에서 제외하거나, `IN (execution_ids)` 배치 조회 후 메모리 그룹핑으로 채울 것. 구현 전 결정 확정 필요.

- **[INFO]** BIGSERIAL 순서 가정 — 동시성 환경에서의 미세한 edge case
  - 위치: `id 가 BIGSERIAL → INSERT 순서가 곧 실행 순서`
  - 상세: BIGSERIAL/SEQUENCE 는 uniqueness 는 보장하나 wall-clock 순서를 완벽히 보장하지 않습니다. 두 트랜잭션이 sequence 를 동시에 획득하면 낮은 ID 가 더 늦게 커밋될 수 있습니다. 단일 노드 순차 실행 워크플로에서는 실질적 문제가 아니지만, 병렬 노드 실행 경로 기록 시 순서가 비결정적이 될 수 있습니다.
  - 제안: 순서가 중요하다면 `created_at TIMESTAMPTZ DEFAULT clock_timestamp()` 와 `id` 복합 정렬 또는 명시적 `ord` 컬럼 추가 검토.

- **[INFO]** `node_id` 외래키 없음
  - 위치: `node_id UUID NOT NULL` (FK 미설정)
  - 상세: 노드가 삭제되어도 로그 참조 정합성 오류 없이 append-only 기록이 유지됩니다. 의도적인 설계로 보이며 감사 로그 관점에서 적절합니다.

---

## 요약

현재 변경사항(파일 1–7, 8–36)은 rawConfig echo 리팩토링으로 DB 쿼리 실행 경로에는 영향이 없습니다. `database-query.handler.ts` 는 echo 필드와 실행 경로가 분리되어 SQL 인젝션 위험이 없습니다. 데이터베이스 관점의 주요 위험은 계획 문서(파일 38)의 PR-B 설계에 있습니다. 대량 데이터 이행 시 배치 처리 미비, `CREATE INDEX CONCURRENTLY` 미사용으로 인한 쓰기 잠금, 롤링 배포 중 `DROP COLUMN` 타이밍 위험, list 조회 N+1 미확정이 구현 전 반드시 해결되어야 합니다.

## 위험도

**MEDIUM** (현재 변경 코드: LOW, 계획 문서 기준: MEDIUM — 계획이 그대로 구현되면 무중단 배포 위험 및 N+1 문제가 프로덕션 영향)