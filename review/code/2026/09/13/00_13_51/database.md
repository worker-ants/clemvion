# 데이터베이스(Database) 리뷰

## 개요

이번 변경은 keyset 커서의 `id` 성분을 `isUuidShaped`(`codebase/backend/src/common/utils/uuid.ts`, 본 PR에서는 미변경·기존 함수 재사용)로 사전 검증해, 파싱 불가 문자열이 `uuid` 타입 컬럼(`LoginHistory.id`, `NodeExecution.id`)에 그대로 바인딩되어 Postgres SQLSTATE `22P02` → `GlobalExceptionFilter` 미분류 → 500 마스킹으로 이어지던 경로를 막는다. 대상:

- `codebase/backend/src/modules/auth/login-history.service.ts` `decodeCursor` — id 검증 추가, 실패 시 기존과 같은 처분(무시하고 1페이지)
- `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts` `decodeCursor` — `i` 검증 추가, 실패 시 기존과 같은 처분(400 `INVALID_CURSOR`)
- 그 외는 unit/e2e 테스트 추가와 plan/CHANGELOG 문서화

## 발견사항

### [INFO] 파라미터 바인딩은 변경 전후 모두 안전 — SQL 인젝션 관점에서는 해당 없음
- 위치: `codebase/backend/src/modules/auth/login-history.service.ts` (`decodeCursor`, `findForUser` 의 `qb.andWhere('(lh.created_at, lh.id) < (:cursorTs, :cursorId)', …)`), `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts` (`decodeCursor`, `fetchBodyPage` 의 `qb.andWhere('… ne.id > :lastId …', …)`)
- 상세: 커서의 `id`/`i` 는 변경 전에도 TypeORM 파라미터 플레이스홀더(`:cursorId`, `:lastId`)로 바인딩되고 있었다. 즉 이번 결함은 **SQL 인젝션이 아니라** 타입 캐스트 실패(문자열 → `uuid`)가 처리되지 않아 500 으로 마스킹되던 문제다. 이번 diff 는 쿼리 구성 방식을 바꾸지 않고 바인딩 전 입력 형태만 검증한다 — 파라미터화 원칙은 그대로 유지된다.
- 제안: 없음(현재 방식이 맞다). 참고로만 기록.

### [INFO] 술어 선택(`isUuidShaped` vs `isValidUuid`)은 DB 파싱 규칙과 정확히 정합
- 위치: `codebase/backend/src/modules/auth/login-history.service.ts:53-65`(diff 게이트 기준, `decodeCursor`), `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:165-180`(diff 게이트 기준, `decodeCursor`)
- 상세: `LoginHistory.id`/`NodeExecution.id` 는 `@PrimaryGeneratedColumn('uuid')` 이고 DB 컬럼 타입은 `uuid` 다. Postgres 의 `uuid` 타입은 RFC 버전/variant nibble 을 강제하지 않고 canonical 8-4-4-4-12 hex 형태만 요구한다(nil UUID, v6/v7 등도 파싱 성공). 여기서 `isValidUuid`(RFC v1–v5 한정) 대신 더 느슨한 `isUuidShaped` 를 쓴 것은 "DB 가 실제로 파싱 가능한가"를 정확히 반영하는 선택이라, 정상 조회 가능한 값(예: nil UUID 시드 데이터, 장래 UUIDv7 채택 시)을 오탐으로 거부하는 회귀를 막는다. 회귀 테스트(`uuid.spec.ts`, 각 서비스 `.spec.ts` 의 `[대조군]` 케이스)와 뮤테이션(M3/M4, 술어를 엄격하게 바꾸면 RED)으로 이 경계가 고정되어 있다.
- 제안: 없음. 설계가 타당하며 이미 검증됐다.

### [INFO] 마이그레이션/스키마 변경 없음 — 무중단 배포 리스크 해당 없음
- 위치: 해당 파일 없음 (본 diff 에 `migrations/` 변경 없음)
- 상세: `background-monitoring.e2e-spec.ts` 가 참조하는 V047/V048 인덱스(`idx_node_execution_background_run_id`, `idx_node_execution_parent_started_id`)의 `pg_index.indisvalid` 검증 테스트는 기존 코드로, 이번 diff 로 신규/변경되지 않았다. 이번 변경 자체는 애플리케이션 계층의 입력 검증만 추가하므로 마이그레이션 안전성 이슈가 없다.

### [INFO] 대량 데이터/페이지네이션 — keyset 방식 유지, 조기 실패로 불필요한 라운드트립 감소
- 위치: `codebase/backend/src/modules/auth/login-history.service.ts` `findForUser`, `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts` `fetchBodyPage`
- 상세: 두 조회 모두 `ORDER BY … LIMIT n+1` + 복합 키 비교(`(created_at, id) <` / `(startedAt > … OR (startedAt = … AND id > …))`) 로 keyset 페이지네이션을 구현하고 있다(offset 방식 아님 — 대용량 테이블에서 적절). 이번 변경은 이 쿼리 구조를 건드리지 않고, 잘못된 커서가 이 쿼리까지 도달해 Postgres 에러를 유발하기 전에 애플리케이션에서 조기 차단한다. 결과적으로 악의적/손상된 커서로 인한 불필요한 DB 왕복과 에러 로그 오염이 줄어든다 — 대량 트래픽 상황에서 근소하지만 긍정적인 효과.
- 참고(범위 밖, 새 결함 아님): `login_history` 의 기존 인덱스는 `idx_login_history_user_created(user_id, created_at)` 뿐이라 tie-breaker 인 `id` 가 인덱스에 포함되지 않는다. `created_at` 이 동일 밀리초로 다수 행이 겹칠 때만 영향이 있고 이번 diff 가 만든 회귀는 아니므로 새 이슈로 등재하지 않는다.

### [INFO] 트랜잭션/커넥션/N+1 — 영향 없음
- 상세: 변경된 두 `decodeCursor` 는 순수 함수(파싱+검증)이고 DB 호출을 포함하지 않는다. 트랜잭션 경계, 커넥션 풀 사용, 반복문 내 쿼리 패턴 어느 것도 이번 diff 로 바뀌지 않는다. `pruneOlderThanRetention`(배치 삭제 루프)는 diff 범위 밖(컨텍스트로만 노출)이며 이번 PR 에서 손대지 않았다.

### [INFO] 테스트가 mock 한계를 e2e 로 보완 — 데이터베이스 신뢰도 측면에서 바람직
- 위치: `codebase/backend/test/background-monitoring.e2e-spec.ts`(새 it 블록), `codebase/backend/test/session-revocation.e2e-spec.ts`(새 it 'F')
- 상세: unit 테스트는 `createQueryBuilder` mock 이라 "검증이 거부하는가"만 확인하고 "통과시켰을 때 실제 Postgres 가 22P02 를 내는지"는 검증하지 못한다. 두 e2e 테스트가 실제 Postgres 왕복으로 (a) 비-UUID 커서 → 기대한 상태 코드, (b) 유효 커서(nil UUID 포함) → 정상 완주 및 실제 필터링(대조군)까지 확인한다. DB 계층 신뢰성 검증으로 적절하다.

## 요약

이번 변경은 SQL 인젝션·스키마·트랜잭션·커넥션 관점에서 새로운 리스크를 만들지 않는다. 커서 id 는 변경 전후 모두 파라미터화된 쿼리로 바인딩되고 있었으며, 이번 diff 는 그 바인딩 전에 "Postgres 의 `uuid` 컬럼이 파싱 가능한 형태인가"만 확인하는 방어적 입력 검증을 추가한 것이다. 술어로 `isUuidShaped`(느슨한 형태 검증)를 선택해 nil UUID·v6/v7 등 DB 가 실제로 허용하는 값까지 오탐 거부하는 회귀를 피했고, 이는 스키마(`uuid` 타입 컬럼)와 정확히 정합하는 선택이다. 마이그레이션 변경이 없어 무중단 배포 리스크도 없고, keyset 페이지네이션 쿼리 구조 자체는 그대로 유지된다. mock 만으로는 확인할 수 없는 "실제 Postgres 가 22P02 를 내는가"라는 전제를 e2e 로 직접 검증한 점도 데이터베이스 신뢰성 측면에서 긍정적이다. 두 엔드포인트 간 실패 계약 비대칭(무시 vs 400)은 의도적으로 유지된 별도 제품 결정 사항으로 이미 트래커에 등재되어 있어 본 리뷰의 결함으로 보지 않는다.

## 위험도

NONE
