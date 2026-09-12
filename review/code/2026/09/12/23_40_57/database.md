# 데이터베이스(Database) 리뷰

## 개요

이번 변경은 두 keyset 커서 디코더(`LoginHistoryService.decodeCursor`,
`BackgroundRunsService.decodeCursor`)에 커서의 **id 성분**을 `isUuidShaped()`로
검증하는 로직을 추가한다. 두 id 는 각각 `LoginHistory.id`, `NodeExecution.id`
(`@PrimaryGeneratedColumn('uuid')`) 에 TypeORM `QueryBuilder` named parameter
(`:cursorId`, `:lastId`)로 바인딩되는데, 검증 없이 비-UUID 문자열이 들어가면
Postgres 가 SQLSTATE `22P02`(invalid_text_representation)로 거부하고
`GlobalExceptionFilter` 가 이를 분류하지 못해 500 `INTERNAL_ERROR` 로 마스킹되던
결함을 고친다. CHANGELOG·plan 문서 갱신은 코드 변경의 관측 가능한 동작(계약)을
기록하는 부수 변경이다.

## 발견사항

- **[INFO]** DB 바인딩 전 입력 형태 검증 — 정상적으로 설계됨
  - 위치: `codebase/backend/src/modules/auth/login-history.service.ts:65` (`if (!isUuidShaped(id)) return null;`), `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:178` (`if (!isUuidShaped(parsed.i)) { throw new Error(...); }`)
  - 상세: 두 자리 모두 `uuid` 컬럼에 바인딩되는 값을 쿼리 실행 **이전에** 형태 검증한다. 술어로 엄격한 `isValidUuid`(RFC v1–v5) 대신 `isUuidShaped`(Postgres 가 실제로 파싱 가능한 canonical 8-4-4-4-12 hex 형태 전부)를 재사용한 점이 DB 관점에서 정확하다 — nil UUID·v6/v7 처럼 **Postgres 가 정상 조회하는 값**까지 애플리케이션 레벨에서 400/무시로 거부하는 과잉 검증을 피한다. 검증 강도를 실제 DB 파싱 규칙에 맞춘 사례.
  - 제안: 없음 (현행 유지 권장). 두 함수 모두 회귀 테스트 + 뮤테이션(조건 반전 포함)으로 고정되어 있어 별도 조치 불필요.

- **[INFO]** `GlobalExceptionFilter` 에 22P02 → 400 일괄 분기를 넣지 않은 결정은 타당
  - 위치: `plan/in-progress/keyset-cursor-uuid-validation.md` §A, `plan/in-progress/spec-draft-nullable-notation-followups.md` (won't-do 종결 항목)
  - 상세: 필터는 값의 출처(클라이언트 입력 vs 서버 내부 로직이 만든 값)를 모른다. 이미 필터가 23502(not-null 위반)를 "서버가 만든 잘못된 row"로 간주해 500 을 유지하는 것과 같은 원칙으로, 22P02 도 일괄 400 처리하면 서버 버그를 클라이언트 오류로 잘못 보고하게 된다. 각 입구(디코더)에서 조기 검증하는 현재 접근이 DB 에러 처리 설계상 더 안전하다 — 신호(500=미검증 입구 존재)를 보존하면서 실제 결함만 국소적으로 닫는다.
  - 제안: 없음. 결정에 동의.

- **[INFO]** SQL 인젝션 — 전 구간 파라미터화 확인
  - 위치: `codebase/backend/src/modules/auth/login-history.service.ts:122-127` (`qb.andWhere('(lh.created_at, lh.id) < (:cursorTs, :cursorId)', {...})`), `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:265-273` (`qb.andWhere('(...) ', { lastStartedAt, lastId })`)
  - 상세: 커서에서 추출한 값은 모두 TypeORM named parameter 로 바인딩되며 문자열 결합(concatenation)으로 SQL 에 삽입되지 않는다. 이번 변경 전후로 인젝션 벡터는 없었고, 새 검증 로직도 이 파라미터화 경로를 우회하지 않는다.
  - 제안: 없음.

- **[INFO]** 인덱스 — 기존 keyset 페이지네이션 인덱스가 이번 변경으로 영향받지 않음
  - 위치: `codebase/backend/migrations/V040__auth_session_metadata_and_login_history.sql` (`idx_login_history_user_created ON login_history (user_id, created_at DESC)`), `codebase/backend/migrations/V048__node_execution_parent_started_id_index.sql`
  - 상세: 이번 diff 는 `WHERE`/`ORDER BY` 절 자체를 바꾸지 않고 바인딩 **이전** 검증만 추가했다. 기존 복합 인덱스가 두 keyset 쿼리(`(user_id, created_at)`, `(parent_node_execution_id, started_at, id)` 계열)를 이미 지원하고 있어 새 인덱스가 필요 없다. 확인 목적으로 마이그레이션 파일을 열람했다.
  - 제안: 없음.

- **[INFO]** 부수 효과 — 잘못된 커서가 DB 왕복 없이 조기 차단됨
  - 위치: 위 두 `decodeCursor` 함수
  - 상세: 수정 전에는 비-UUID 커서가 쿼리 실행까지 도달해 Postgres 가 에러(22P02)를 던진 뒤 커넥션을 반환하는 흐름이었다. 수정 후에는 애플리케이션 레벨에서 즉시 거부되어 실패한 쿼리로 인한 불필요한 DB 왕복·커넥션 점유가 한 번 줄어든다 — 대량 트래픽 상황에서 악의적/오작동 클라이언트가 유효하지 않은 커서를 반복 전송할 때의 DB 부하 경감 효과가 있다.
  - 제안: 없음 (긍정적 부수 효과로 기록).

- **[INFO]** 두 디코더의 실패 계약 비대칭 — DB 이슈 아님, 이미 등재됨
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (신규 추가 체크리스트 항목), `plan/in-progress/keyset-cursor-uuid-validation.md` §C
  - 상세: `login-history` 는 무효 id 를 조용히 무시(1페이지 재반환)하고 `background-runs` 는 400 `INVALID_CURSOR` 를 던진다 — API 계약 일관성 문제이지 DB 정합성 문제는 아니다. 개발자가 스스로 문서화하고 planner 결정 항목으로 등재했으므로 이 리뷰에서 추가 조치는 불필요.
  - 제안: 없음 (참고용 기록).

트랜잭션·마이그레이션·스키마 설계·커넥션 풀·N+1 관점에서는 이번 변경이 손대는 코드가 순수 read-path 의 입력 검증 추가뿐이라 해당 사항이 없다(신규 쓰기 경로·신규 쿼리 형태·스키마 변경 없음).

## 요약

이번 diff 는 keyset 커서의 id 성분이 검증 없이 `uuid` 타입 컬럼에 바인딩되어 Postgres SQLSTATE 22P02 로 거부되고 이것이 `GlobalExceptionFilter` 의 사각지대를 통해 500 으로 마스킹되던 결함을, 두 입구(`login-history`·`background-runs`)에서 `isUuidShaped()` 로 사전 검증해 막는다. 검증 술어가 Postgres 의 실제 파싱 허용 범위(canonical shape, RFC variant 무관)에 정확히 맞춰져 있어 정상 조회 가능한 커서(nil UUID 등)를 과잉 거부하지 않으며, 모든 쿼리는 여전히 파라미터화된 상태로 SQL 인젝션 위험이 없다. 필터에 일괄 22P02→400 분기를 넣지 않고 각 입구에서 조기 검증하기로 한 설계 결정도 클라이언트/서버 기인 오류를 구분하지 못하는 필터의 한계를 정확히 인식한 타당한 선택이다. 기존 인덱스가 두 keyset 쿼리를 이미 지원하므로 성능·페이지네이션 관점에서도 새로운 리스크가 없고, 오히려 무효 커서를 DB 왕복 전에 차단해 부하를 소폭 경감한다. DB 관점에서 발견된 Critical/Warning 은 없다.

## 위험도

NONE
