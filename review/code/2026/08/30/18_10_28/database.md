# 데이터베이스(Database) 리뷰

## 리뷰한 변경 요약

핵심 코드 변경은 `ExecutionEngineService.updateExecutionStatus` else 분기(`linkedNodeExec` 없이
RUNNING/COMPLETED/FAILED/CANCELLED 로 직접 마감하는 경로)의 guarded raw UPDATE
(`WHERE id=$1 AND status IN (비-terminal[,'failed'])... RETURNING id`)를, 트랜잭션 밖 단발
`executionRepository.query(...)` 에서 `this.dataSource.transaction(async (manager) => { manager.query(...) })`
안으로 옮긴 것이다 (`execution-engine.service.ts:8698-8734`). 목적은 `updateReturningRows` 가 튜플
shape 위반에 throw 할 때 그 throw 가 이미 실행된 UPDATE 자체를 롤백하게 만드는 것 — 종전엔
throw 해도 UPDATE 는 이미 커밋된 뒤라 DB 는 terminal 인데 종결 이벤트가 유실되고 그 실행은
stuck recovery(non-terminal 만 스캔)에도 안 잡히는 "가드가 만든 무기한 대기" 가 있었다.
부수적으로 두 분기(`linkedNodeExec`/else)가 공유하던 종결부(세그먼트 기록+메트릭 발행+return)를
`finishStatusTransition` private 헬퍼로 추출했다(`:8757-8768`) — 순수 리팩터, DB 관련 동작 변화 없음.

나머지 파일(`CHANGELOG.md`, `plan/in-progress/*.md` 2건, `spec/5-system/4-execution-engine.md`,
`spec/data-flow/3-execution.md`, `review/**` 하위 다수)은 이 코드 변경을 추적·문서화하는 산출물이며
DB 코드 자체의 변경은 아니다. `spec/5-system/4-execution-engine.md` §1.1 「원자성 보장」 문단과
`spec/data-flow/3-execution.md` §2.1 상태 전이 행이 이번 트랜잭션 래핑을 반영하도록 갱신됐는데,
실제 구현(위 8698-8734행)과 일치한다 — spec 이 구현을 정확히 서술한다.

## 발견사항

- **[INFO]** 단일 UPDATE 를 명시 트랜잭션으로 감싸 hot path 라운드트립이 늘어난다 (BEGIN/COMMIT 추가)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8698`
    (`let persisted = false;`) ~ `:8734` (`});`) — `updateExecutionStatus` else 분기
  - 상세: 종전에는 `executionRepository.query(...)` 단발 auto-commit UPDATE 1회 왕복이었는데,
    이제 `dataSource.transaction()` 으로 감싸 BEGIN+UPDATE+COMMIT(또는 ROLLBACK)이 되고, 그 구간
    동안 커넥션 풀에서 커넥션을 점유한다. `updateExecutionStatus` 는 "Execution 상태 전이의 단일
    choke point" 라 이 else 분기는 RUNNING/COMPLETED/FAILED/CANCELLED 최상위 종결을 포함해 매우
    빈번히 호출되는 hot path다. 단일 PK UPDATE(`WHERE id=$1`)는 이미 원자적이므로 이 래핑이 주는
    것은 "쓰기 원자성" 이 아니라 "쓰기 + shape 검증을 하나의 unit 으로 묶어 검증 실패 시 UPDATE 를
    되돌린다" 는 목적(주석에도 명시)이며, 이 목적이 라운드트립 비용을 상회한다고 판단한다.
  - 제안: 별도 조치 불필요. 목적(관측 불가능한 유실 방지, orphan terminal 방지)이 성능 비용보다
    명확히 크다. 커넥션 풀이 작은 배포 환경이면 이 choke point 의 처리량을 모니터링에 포함해 두는
    것을 권한다.

- **[INFO]** self-deadlock 방지가 코드 레벨 가드가 아니라 JSDoc 명시 + 수동 호출부 전수 대조에만 의존한다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8565-8570`
    (`updateExecutionStatus` JSDoc "호출 제약 — 자신의 트랜잭션 콜백 안에서 부르지 말 것")
  - 상세: else 분기와 `linkedNodeExec` 분기 둘 다 이제 내부에서 `dataSource.transaction()` 을
    연다. TypeORM 의 `dataSource.transaction()` 은 이미 열린 외부 트랜잭션에 합류(nest)하지
    않고 새 커넥션으로 독립 트랜잭션을 여므로, 만약 어떤 호출자가 자신의 트랜잭션 콜백 **안에서**
    같은 `Execution` 행에 대해 `updateExecutionStatus` 를 호출하면 두 커넥션이 같은 행을 잠그려
    해 self-deadlock 이 된다. JSDoc 이 이를 명시하고 현재 호출부 11곳이 전부 top-level 임을
    확인했다는 서술이 있으나(런타임 가드 아님), 이 확인은 이번 리뷰에서 재실행하지 않았고 향후
    새 호출부가 이 제약을 어겨도 컴파일 타임/런타임 어느 쪽도 막지 못한다 — 순수 문서 규약이다.
  - 제안: 조치 필수는 아니다(현재 위반 없음, 이 diff 가 만든 새 제약이며 문서화 자체는 적절한
    최소 대응). 다만 재발 방지를 원하면 `AsyncLocalStorage` 등으로 "현재 트랜잭션 콜백 안"
    여부를 런타임에 감지해 개발 환경에서만 assert 하는 정도의 저비용 가드를 고려할 수 있다.

- **[INFO]** SQL 인젝션 벡터 없음 확인 (오탐 방지 목적의 명시적 기록)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8711`
    (`AND status IN (${elseStatusesSql})`), 상수 정의 `:522-527`, `:543-551`
  - 상세: `elseStatusesSql` 은 `NON_TERMINAL_STATUSES_SQL` / `NON_TERMINAL_OR_FAILED_STATUSES_SQL`
    static 클래스 상수로, `Object.values(ExecutionStatus)`(고정 enum) 에서 파생되며 사용자 입력이
    전혀 개입하지 않는다. 나머지 8개 값(`execution.id`, `newStatus`, `activeRunningMs` 등)은
    전부 `$1`~`$8` 파라미터 바인딩이다. 인젝션 위험 없음 — 이번 diff 는 이 부분을 변경하지 않고
    UPDATE 를 트랜잭션으로 옮기기만 했다(`this.executionRepository.query` → `manager.query`,
    쿼리 문자열·바인딩 방식 동일).
  - 제안: 조치 불필요.

## DB 관점 개별 점검

- **트랜잭션 사용 적절성**: 타당하고 정확하다. 결과 shape 위반 throw 가 이제 실제 롤백을
  유발해, "DB 는 terminal 로 커밋됐는데 종결 이벤트는 유실되고 stuck recovery 에도 안 잡히는"
  정합성 결함(고아 상태)을 정확히 겨냥해 고쳤다. 같은 메서드의 `linkedNodeExec` 분기가 이미
  동일한 이유로 `dataSource.transaction` + `FOR UPDATE` 락을 쓰고 있어(`:8633-8653`), 이번
  변경으로 두 분기의 트랜잭션 사용 형태가 통일됐다.
- **트랜잭션 경계**: 부작용(메트릭 기록 `emitTerminalExecutionMetrics`, `recordRunningSegmentStart`,
  `finishStatusTransition` 경유)은 트랜잭션 콜백 밖에서 `persisted` 로컬 변수를 통해 실행된다 —
  트랜잭션을 불필요하게 오래 열어두지 않는 올바른 경계.
- **커넥션 관리**: TypeORM `dataSource.transaction()` 은 커넥션 pool 획득 → BEGIN → 콜백 →
  COMMIT/ROLLBACK → 커넥션 반환을 내부 `finally` 로 자동 처리한다. 명시적 해제 누락·누수 위험 없음.
- **인덱스**: `WHERE id = $1` (PK 단일 행 UPDATE) 로 변경 전과 동일 — 신규 인덱스 요구나 스캔
  패턴 변화 없음.
- **N+1**: 호출당 단일 쿼리로 변경 전과 동일 — 신규 N+1 없음. 반복문 내 호출 패턴 변화 없음.
- **마이그레이션 안전성**: 이번 diff 에 스키마 변경(migration 파일)이 없다 — 해당 없음
  (`git diff --stat` 로 변경 파일 29개 전수 확인, migration 디렉터리 포함 없음).
- **스키마 설계**: 테이블 구조·컬럼·관계 변경 없음 — 해당 없음.
- **대량 데이터**: PK 단일 행 UPDATE 이므로 대용량 테이블 스캔·페이지네이션과 무관.
- **테스트 검증**: `execution-engine.service.spec.ts` 에 추가된 두 테스트가 (a) 트랜잭션이 실제로
  열리는지, (b) UPDATE 가 그 트랜잭션 manager 를 경유하는지를 롤백 케이스·정상 케이스 양쪽에서
  고정한다. mock 이 `mockTxManagerQuery` → 기존 `mockExecutionRepo.query` 로 위임하는 구조라
  기존 단언을 보존하면서 "트랜잭션 경유 여부" 도 별도로 기록한다. plan 문서에 기록된 뮤테이션
  실측(트랜잭션 제거 → RED 2, 콜백 안 throw 삼킴 → RED 2)도 두 축이 실제로 회귀를 잡는다는
  근거로 타당하다(직접 재실행하지는 않았고 plan 서술을 근거로 신뢰).

## 요약

이번 변경은 `updateExecutionStatus` else 분기의 단일 guarded UPDATE 를 명시 트랜잭션으로 감싸,
shape-검증 실패(throw) 시 이미 실행된 UPDATE 를 함께 롤백시켜 "DB 는 terminal 인데 종결 이벤트가
영구히 안 나가는" 고아 상태를 막는다 — DB 정합성 관점에서 순수한 개선이다. 짝 전이(`linkedNodeExec`)
분기와 트랜잭션 사용 형태를 통일했고, 부작용은 트랜잭션 경계 밖에서 수행되며, 파라미터 바인딩과
enum 파생 static 상수만 문자열 보간에 사용해 SQL 인젝션 위험이 없다. 커넥션 관리는 TypeORM 표준
트랜잭션 패턴을 따라 획득/해제가 자동이라 누수 위험이 없다. 스키마·인덱스·N+1·대량 데이터·마이그레이션
관련 이슈는 이번 diff 범위에 없다. 유일한 트레이드오프는 고빈도 choke point 에 라운드트립이
늘어난다는 점과, self-deadlock 방지가 런타임 가드 없이 문서 규약에만 의존한다는 점이며 둘 다
INFO 수준으로 즉각 조치가 필요하지 않다.

## 위험도

NONE — 발견된 항목은 모두 정보성(INFO)이며, DB 정합성 관점에서는 기존 결함(트랜잭션 밖 UPDATE로
인한 롤백 불가)을 정확히 고친 개선이다.
