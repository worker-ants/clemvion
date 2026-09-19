# 데이터베이스(Database) 리뷰

이번 diff 는 프로덕션 스키마·마이그레이션·엔티티 변경이 없다. 유일한 실질 변경은
`codebase/backend/test/entity-schema-declarations.e2e-spec.ts` 의 e2e 테스트 추가/리팩터(+ `plan/`, `review/` 문서)이며,
이 파일 자체가 트랜잭션 · 커넥션 · 파라미터화 쿼리를 직접 다루는 DB 코드이므로 그 관점에서 검토한다.
(`review/code/2026/09/20/01_00_21/**`, `review/consistency/2026/09/20/00_34_58/**` 는 리뷰/컨시스턴시 산출물 마크다운·JSON 이라
DB 관점이 성립하지 않아 제외.)

## 발견사항

- **[INFO]** 커넥션 관리 — 1라운드에서 지적된 `QueryRunner` 누수 위험(WARNING)은 이미 해소되어 있다
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:614-663` (`it('선언한 DB 기본값은...')`)
  - 상세: `qr.connect()` · `qr.startTransaction()` 이 `try` 블록 안으로 들어왔고(614→617-618), `finally` 는
    `if (qr.isTransactionActive) await qr.rollbackTransaction();` 로 방어한 뒤 중첩 `finally` 에서 `qr.release()` 를
    항상 호출한다(656-661). `connect()` 실패 · `startTransaction()` 실패 · 어서션 실패 세 경로 모두 `release()` 가
    스킵되지 않는 것을 확인했다. `review/code/2026/09/20/01_00_21/RESOLUTION.md` 의 W2 조치(`a71642fe0`)가 실제 코드에
    반영된 상태다. 재지적 불필요.
  - 제안: 없음(검증 기록).

- **[INFO]** 중첩 `finally` 의 이중 실패 시 원인 에러 유실 가능성 — 미해결이지만 극히 낮은 확률의 잔여 리스크
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:655-661` (`finally { try { rollbackTransaction() } finally { release() } }`)
  - 상세: `rollbackTransaction()` 이 던지고 그 직후 `release()` 도 던지면(예: 커넥션이 이미 죽어 있는 경우), JS 의 `finally`
    스킵 규칙에 따라 `release()` 의 예외가 `rollbackTransaction()` 의 원래 예외를 덮어써 테스트 실패 메시지가 실제 원인을
    가릴 수 있다. e2e 로컬 DB 환경에서 두 호출이 동시에 실패할 시나리오는 현실적으로 드물어 차단 사유는 아니다.
  - 제안: 조치 불요(수용 가능한 트레이드오프). 필요하면 `Promise.allSettled` 로 두 에러를 모두 보존하는 방식으로 개선 검토.

- **[INFO]** SQL 인젝션 — 신규 raw INSERT 는 전부 파라미터 바인딩 사용
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:619-630`
  - 상세: `user`/`workspace`/`workflow` 3 개 INSERT 모두 동적 값(email, owner_id, slug, workspace_id, created_by)을
    `$1`/`$2` 파라미터로 바인딩했고, 문자열 리터럴로 남긴 것은 고정 상수(`'default-probe'`, `'team'`)뿐이다. 인젝션 표면 없음.
    (참고: 같은 파일의 기존 헬퍼 `normalizedPredicate`/`normalizedCheck` 는 `where`/`expression` 을 문자열로 직접 이어붙이지만,
    이는 이번 diff 가 건드리지 않은 기존 코드이고 그 값이 엔티티 데코레이터의 컴파일타임 문자열에서만 오는 것을 코드 주석(297-299행)이
    명시한다 — 외부 입력 경로 없음.)
  - 제안: 없음.

- **[INFO]** 트랜잭션 격리 — 기본값 왕복 테스트의 원자성·격리는 적절
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:614-663`
  - 상세: 부모 3행(user→workspace→workflow, FK 의존 순서 준수) 생성부터 두 엔티티 `save` 까지 한 `QueryRunner` 트랜잭션
    안에서 수행되고 무조건 `rollbackTransaction()` 으로 정리된다. `SELECT now()` 를 같은 트랜잭션 안에서 호출해
    `lastInteractionAt` 과 비교하는 방식도 Postgres 의 `now()`(트랜잭션 시작 시각 고정) 의미론과 맞다. 공유 e2e DB 의
    `user`/`workspace`/`workflow` 실 테이블에 raw INSERT 하지만 rollback 으로 격리되며, 같은 파일의 다른 테스트들(`inRolledBackTx`)도
    동일 패턴을 이미 쓰고 있어 새로운 리스크 유형이 아니다(프로세스가 rollback 전에 강제 종료되는 잔존 리스크는 기존과 동일).
  - 제안: 없음.

- **[INFO]** 커넥션 풀 — 테스트마다 `new DataSource(readOnlyDataSourceOptions())` 로 별도 풀을 만들고 즉시 파괴
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:212-220` (헬퍼), `568-577`, `595-606`
  - 상세: 읽기 전용 세션(`default_transaction_read_only=on`)이 모듈 최상위 `ds` 와 다른 연결 옵션을 필요로 하므로 별도
    `DataSource`(=별도 풀)를 매번 초기화/파괴하는 것은 불가피한 설계다. 이번 diff 는 이 로직을 `readOnlyDataSourceOptions()`
    헬퍼로 중복 제거만 했을 뿐 패턴 자체는 기존 코드에 이미 있던 것이라 새로운 이슈가 아니다. 두 사용처 모두 `try/finally` +
    `isInitialized` 가드로 파괴가 누락되지 않는 것을 확인했다.
  - 제안: 없음.

- **[INFO]** 인덱스 · N+1 · 마이그레이션 안전성 · 대량 데이터 페이지네이션 — 해당 없음
  - 상세: 이 diff 는 인덱스/제약/컬럼 스키마를 만들거나 바꾸지 않고(마이그레이션 파일 변경 없음), 프로덕션 쿼리 경로도
    건드리지 않는다. 기존 인덱스·제약 비교 테스트(엔티티 메타데이터 순회 + 테이블당 쿼리)는 이번 diff 의 변경 대상이 아니고,
    스키마 객체 수가 유한(수십~수백 개) 한 CI 전용 일회성 비교라 프로덕션 대량 데이터 페이지네이션 관점이 성립하지 않는다.

## 요약

이번 변경은 프로덕션 스키마·쿼리·마이그레이션에 영향을 주지 않는 e2e 테스트 전용 diff 다. 유일한 실제 DB 관련 결함이었던
`QueryRunner` 커넥션 누수 위험(1라운드 WARNING #2)은 커밋 `a71642fe0` 로 이미 수정되어 이번 라운드의 코드에 반영돼 있음을
직접 확인했다. 신규 raw SQL 은 모두 파라미터 바인딩을 사용하고, 트랜잭션 경계·롤백·격리가 적절하며, 커넥션 해제도 실패
경로별로 보장된다. 남은 것은 실무적으로 무해한 INFO 수준 관찰(이중 실패 시 원인 에러 유실 가능성 등)뿐이며 이번 changeset 을
막을 이유가 없다.

## 위험도

NONE
