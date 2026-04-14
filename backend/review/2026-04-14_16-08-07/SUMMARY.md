# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** - 자기 참조 FK의 순환 참조/고아 레코드 위험 및 인덱스 잠금 이슈가 있으나, 애플리케이션 레이어 보완으로 완화 가능

---

## Critical 발견사항

없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture / Database | `ON DELETE SET NULL`로 인해 부모 삭제 시 자식 레코드가 고아 상태가 되어 타임라인 UI에서 루트 노드로 오인될 수 있음 | `ON DELETE SET NULL` | 부모-자식이 항상 같은 `workflow_execution`에 속한다면 `ON DELETE CASCADE` 검토. 부분 삭제 허용 시 애플리케이션 레이어에서 NULL 처리 로직 명시 필요 |
| 2 | Architecture / Security | 자기 참조 FK 구조에서 DB 레벨 순환 참조(A→B→A) 방지 불가. 무한 깊이 허용으로 재귀 쿼리 폭발 위험 | `REFERENCES node_execution(id)` | 애플리케이션 레이어에서 `parent_node_execution_id` 설정 시 순환 참조 검증 로직 추가 필수 |
| 3 | Requirement | 기존 `node_execution` 레코드에 대한 데이터 백필(backfill) 전략 명시 없음 | 파일 전체 | 신규 실행에만 적용되는 경우 주석으로 명시. 기존 이력 재구성이 필요하면 `UPDATE` 문 추가 |
| 4 | Testing | `parent_node_execution_id`를 사용하는 애플리케이션 계층(workflow.handler.ts 등)의 테스트 커버리지 미확인 | 연관 코드 전반 | 서브워크플로우 실행 시 올바른 값 설정, NULL인 루트 노드 정상 동작, `ON DELETE SET NULL` 동작 검증 테스트 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Performance / Database | `CREATE INDEX` 실행 시 `SHARE LOCK` 보유로 쓰기 블로킹 발생 가능 | `CREATE INDEX idx_node_execution_parent ...` | `CREATE INDEX CONCURRENTLY` 사용 검토 (단, Flyway 트랜잭션 설정 확인 필요: `mixed=true`) |
| 2 | Database / Performance | `parent_node_execution_id`는 대부분 NULL이므로 전체 인덱스가 비효율적 | `CREATE INDEX idx_node_execution_parent` | 부분 인덱스 사용: `WHERE parent_node_execution_id IS NOT NULL` |
| 3 | Concurrency / Performance | `ALTER TABLE ADD COLUMN`은 `ACCESS EXCLUSIVE LOCK` 획득. FK 제약 포함 시 전체 테이블 스캔 가능 | `ALTER TABLE node_execution ADD COLUMN ...` | 무중단 배포 환경이라면 FK를 `NOT VALID`로 추가 후 별도 `VALIDATE CONSTRAINT` 수행 고려 |
| 4 | Maintainability | `ON DELETE SET NULL`을 선택한 의도(CASCADE 대신)가 주석으로 명시되지 않음 | FK 정의 라인 | 인라인 주석 추가: `-- ON DELETE SET NULL: 부모 삭제 시에도 자식 실행 이력 보존` |
| 5 | Maintainability / Database | DB 스키마 수준의 컬럼 COMMENT 부재 | `ADD COLUMN parent_node_execution_id` | `COMMENT ON COLUMN node_execution.parent_node_execution_id IS '...'` 추가 |
| 6 | Performance | 대량 execution 삭제 시 `ON DELETE SET NULL` FK 트리거 비용 누적 가능 | FK 정의 | 이력 정리 배치 작업 시 청크 단위 삭제 또는 FK 일시 비활성화 전략 검토 |
| 7 | Architecture | 롤백 스크립트 부재 | 파일 전체 | `DROP INDEX`, `ALTER TABLE ... DROP COLUMN` 순서의 롤백 절차를 주석 또는 별도 파일로 준비 |
| 8 | Documentation | 인덱스 생성 이유에 대한 주석 부재 | `CREATE INDEX` 라인 | `-- Index for efficiently fetching all child executions by parent.` 주석 추가 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Architecture | MEDIUM | ON DELETE SET NULL 고아 레코드, 무한 재귀 중첩 위험 |
| Security | LOW | 순환 참조 방지 로직 필요, ON DELETE SET NULL 고아 레코드 접근 제어 |
| Requirement | LOW | 기존 데이터 백필 전략 미명시, 순환 참조 방지 메커니즘 없음 |
| Testing | LOW | 애플리케이션 계층 테스트 커버리지 확인 필요 |
| Maintainability | LOW | ON DELETE SET NULL 선택 근거 주석 없음, DB COMMENT 부재 |
| Database | LOW | ALTER TABLE 락 위험, 부분 인덱스 미사용, 트랜잭션 래핑 확인 필요 |
| Performance | LOW | CREATE INDEX CONCURRENTLY 미사용, 부분 인덱스 미사용 |
| Side Effect | LOW | CREATE INDEX 잠금, ON DELETE SET NULL 연쇄 UPDATE 비용 |
| Dependency | NONE | 자기 참조 FK는 표준 패턴, 외부 의존성 없음 |
| Concurrency | NONE | DDL 수준 락은 표준 동작, 코드 결함 아님 |
| Documentation | NONE | 기본 주석 충족, 보완 사항 권장 수준 |
| Scope | NONE | 단일 목적 변경, 범위 이탈 없음 |
| API Contract | NONE | 순수 DDL 변경, API 계약과 무관 |

---

## 발견 없는 에이전트

- **Scope** — 단일 목적 변경, 범위 이탈 없음
- **API Contract** — 순수 DDL 변경으로 API 계약과 무관
- **Dependency** — 외부 라이브러리 의존성 없음, 자기 참조 FK는 표준 패턴
- **Concurrency** — DDL 락은 표준 동작이며 코드 결함 아님
- **Documentation** — 기본 문서화 요건 충족

---

## 권장 조치사항

1. **[필수] 애플리케이션 레이어 순환 참조 방지 로직 구현** — `parent_node_execution_id` 설정 시 조상 체인을 검사하는 검증 로직 추가 (`workflow.handler.ts`)
2. **[필수] 애플리케이션 테스트 커버리지 보완** — `workflow.handler.spec.ts`에 서브워크플로우 실행 시 parent ID 설정, NULL 루트 동작, ON DELETE SET NULL 동작 시나리오 테스트 추가
3. **[권장] `ON DELETE CASCADE` vs `SET NULL` 정책 재검토** — 부모-자식 생명주기가 동일하다면 CASCADE가 더 안전. 현재 정책 유지 시 UI에서 `parent_node_execution_id IS NULL`인 레코드를 루트로 판단하는 로직 명확히 처리
4. **[권장] 부분 인덱스로 변경** — `WHERE parent_node_execution_id IS NOT NULL` 조건 추가로 인덱스 크기 및 쓰기 성능 개선
5. **[권장] `ON DELETE SET NULL` 선택 근거 주석 추가** — 마이그레이션 파일에 설계 의도 인라인 주석 명시
6. **[선택] 기존 데이터 백필 여부 명시** — 신규 실행에만 적용됨을 주석으로 확인하거나, 필요 시 UPDATE 문 추가
7. **[선택] 운영 환경 배포 시 락 최소화** — `CREATE INDEX CONCURRENTLY` 사용 및 낮은 트래픽 시간대 배포 고려