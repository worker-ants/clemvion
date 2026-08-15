# 데이터베이스(Database) 리뷰 — EIA 종결 이벤트 `durationMs` 배관

## 리뷰 범위

DB 관점에서 실질적 대상은 코드 4개다:

- `codebase/backend/src/shared/utils/terminal-duration.ts` (신규) — raw UPDATE 용 SQL 상수 + 파싱 헬퍼
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — raw `UPDATE ... RETURNING` 5경로 확장
- `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` — 엔티티 기로드 경로, JS 계산만
- 각 `*.spec.ts` (테스트, 프로덕션 쿼리 없음)

나머지(`chat-channel/*`, `types.ts`, `CHANGELOG.md`, `plan/**`, `review/**`)는 wire 타입/문서로 DB 와 무관해 제외했다. 프롬프트에서 크기 제한으로 생략된 파일 1(`execution-engine.service.ts`)·2(`.spec.ts`) 는 `git diff origin/main --` 로 직접 열어 대조했다. 엔티티(`execution.entity.ts`)·마이그레이션(`V001__initial_schema.sql`, `V083__execution_active_running_ms.sql`) 도 실제 컬럼 타입을 확인하려 직접 읽었다.

## 발견사항

- **[INFO]** 직전 리뷰 라운드(`09_58_24`)가 지적한 CRITICAL(`duration_ms` int4 상한 미클램프로 인한 UPDATE 실패·영구 고착) — **이 diff 에 이미 반영·검증됨**
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts:87-90` (`TERMINAL_DURATION_MS_SQL`)
  - 상세: `duration_ms` 컬럼은 `INTEGER`(int4, 최대 2147483647) 임을 `migrations/V001__initial_schema.sql:223`·`V083__execution_active_running_ms.sql:18` 로 직접 확인했다. 현재 SQL 상수는 `LEAST(2147483647, …)::int` 로 saturate 하고, 시계 역행(음수)은 `CASE WHEN … < started_at THEN NULL` 로 먼저 분기해 클램프보다 우선 처리된다 — 순서가 올바르다(음수 판정 → 클램프). 이전 버전이 썼던 `GREATEST(0, …)` 는 코드에 더 이상 존재하지 않고(`grep` 로 확인, 주석 안에만 역사적 언급으로 남음), 대신 `terminal-duration.spec.ts:125-133` 이 `LEAST(2147483647` 존재·`GREATEST(0` 부재·`THEN NULL` 존재를 문자열 단위로 고정해 회귀를 잡는다.
  - 제안: 없음(이미 조치·검증됨). 신규 CRITICAL 없음.

- **[INFO]** raw SQL 삽입은 파라미터 바인딩만 사용 — SQL 인젝션 표면 없음
  - 위치: `execution-engine.service.ts:1036-1043`(`cancelParkedExecution`), `:1171-1178`(`markWebChatIdleTimeout`), `:2828-2847`(`markExecutionCancelled`), `:2899-2904`(`markQueueWaitTimeout`), `:3352-3357`(`finalizeStalledExhausted`)
  - 상세: `.set({ durationMs: () => TERMINAL_DURATION_MS_SQL })` 로 삽입되는 문자열은 하드코딩 모듈 상수이고, 유일한 가변 값(`terminalFinishedAt`/`finishedAt`, 서버 생성 `Date`)은 5곳 전부 `.setParameter(TERMINAL_FINISHED_AT_PARAM, …)` 로 바인딩된다. `WHERE`/`AND WHERE` 도 기존과 동일하게 `:id`/`:waiting`/`:pending`/`In([...])` 파라미터 바인딩을 유지한다. 문자열 결합 없음.
  - 제안: 없음.

- **[INFO]** 컬럼명 하드코딩(`started_at`, `duration_ms`) — 엔티티 메타데이터와 실측 대조는 여전히 미검증 (기존 W7, 넘김 처리됨)
  - 위치: `terminal-duration.ts:88-89`, 사용처 `execution-engine.service.ts` 5곳의 `.returning(['id', 'duration_ms'])`
  - 상세: `execution.entity.ts:56`(`@Column({ name: 'started_at', ... })`)·`:62`(`@Column({ name: 'duration_ms', ... })`) 와 직접 대조해 현재는 일치함을 확인했다. 다만 SQL 문자열과 엔티티 컬럼명 사이에 정적 연결고리(예: 엔티티 메타데이터 기반 assertion)가 없어, 향후 컬럼명 변경(마이그레이션+엔티티 리네임) 시 이 SQL 이 조용히 깨질 수 있다. RESOLUTION.md(`09_58_24`)에 W7 로 이미 등재·"다음 편집 때" 로 유예된 항목과 동일하다.
  - 제안: 신규 조치 불필요(이미 트래킹됨). 다음에 이 파일을 편집할 때 엔티티 메타데이터 기반 assertion 추가를 권고.

- **[INFO]** SQL 식이 실제 Postgres 값 수준으로 검증된 적이 없음 (기존 W10, 넘김 처리됨)
  - 위치: `terminal-duration.spec.ts` 전체 — `TERMINAL_DURATION_MS_SQL` 관련 테스트가 전부 문자열 `toContain` 단언뿐
  - 상세: 클램프·NULL sentinel·EPOCH 계산이 실제 DB round-trip 으로 검증되지 않아, 부호 반전·단위 오류(초 vs 밀리초)·형변환 오류를 정적 문자열 검사가 놓칠 수 있다. RESOLUTION.md 가 이미 "가장 아프다" 로 자인하고 e2e `duration_ms >= 0` sanity 테스트를 트래커에 등재했다.
  - 제안: 신규 조치 불필요(이미 트래킹됨). 이 PR 범위에서 추가 요구하지 않음.

- **[INFO]** `markQueueWaitTimeout` 경로는 같은 컬럼(`duration_ms`)에 실행 소요시간이 아니라 **큐 대기 시간**을 싣는다(의도적, 문서화됨)
  - 위치: `execution-engine.service.ts:2892-2904` 주석 + `CHANGELOG.md` Unreleased 항목
  - 상세: `started_at` 이 admission(RUNNING 전이) 이전, 즉 큐 진입 시각으로 설정돼 있어 이 경로에서 `TERMINAL_DURATION_MS_SQL` 이 계산하는 값은 "큐 대기 ms"이지 "실행 ms"가 아니다. 같은 컬럼이 경로에 따라 다른 의미를 가지는 것은 스키마 관점에서 약한 비정규화/의미 중복이지만, EIA §6 계약("종결까지의 경과")과 코드 주석·CHANGELOG 양쪽에 명시돼 있어 은닉된 정보 손실은 아니다.
  - 제안: 없음(설계 의도로 이미 문서화됨). 향후 별도 컬럼 분리가 필요하면 스키마 변경 논의 대상.

## 그 외 점검 결과 (이슈 없음)

- **N+1**: 5개 raw UPDATE 경로 모두 execution 1건당 단일 UPDATE 문(`WHERE id = :id`)이며, 노드 순회·배치 루프 내부에서 호출되지 않는다. `RETURNING` 으로 값을 되받아 오히려 UPDATE 후 별도 SELECT 왕복을 없앴다.
- **트랜잭션**: `cancelParkedExecution`/`markWebChatIdleTimeout` 은 기존과 동일하게 `dataSource.transaction()` 으로 UPDATE 를 감싼다(이 PR 은 SET/RETURNING 절만 확장, 트랜잭션 경계는 불변). `markExecutionCancelled`/`markQueueWaitTimeout`/`finalizeStalledExhausted` 는 단일 UPDATE 문뿐이라 명시적 트랜잭션 없이도 원자성이 보장된다(Postgres 단일 문장은 암묵적 트랜잭션).
- **마이그레이션 안전성**: 이 diff 에 스키마 변경(신규 마이그레이션 파일)이 없다. `duration_ms` 컬럼은 기존 `V001`/`V083` 에서 이미 존재하며 nullable — 무중단 배포 리스크 없음.
- **인덱스**: 모든 쿼리가 PK(`id`) 로 단일 행을 특정하고 `status` 는 부가 필터라 추가 인덱스 필요 없음(WHERE 구조 자체는 이 PR 이 바꾸지 않았다).
- **커넥션 관리**: TypeORM `Repository`/`DataSource` 표준 경로만 사용, 수동 커넥션 획득/해제 없음. 이 PR 이 커넥션 관리 패턴을 바꾸지 않았다.
- **대량 데이터**: 전부 단일 행 point UPDATE, 페이지네이션·풀스캔과 무관.
- **`retry-turn.service.ts`**: raw SQL 경로 없음 — 전부 이미 로드된 엔티티에서 `resolveTerminalDurationMs()` 로 순수 JS 계산만 한다. `finalizeCancelledExecution`/`failFirstSegmentSetup` 등도 동일 패턴이라 DB 왕복 증가 없음.
- **`toFiniteNumber`**: `RETURNING` 원본 값(pg 드라이버가 타입에 따라 문자열을 줄 수 있음)을 방어적으로 숫자/`null` 로 좁혀 `NaN`/비정상 문자열이 DB 값으로 영속되거나 wire 로 나가는 경로를 차단한다.

## 요약

이번 변경은 스키마를 건드리지 않고(신규 마이그레이션 없음) 기존 raw `UPDATE ... RETURNING` 5경로에 `durationMs` 계산을 SQL 로 밀어넣는 배관 작업이다. 직전 리뷰 라운드가 지적한 유일한 CRITICAL(`duration_ms` int4 컬럼 상한 미클램프로 인한 UPDATE 실패·실행 영구 고착)은 `LEAST(2147483647, …)` 클램프로 이 diff 안에서 이미 수정·테스트로 고정되어 있음을 마이그레이션 파일·엔티티 정의와 직접 대조해 확인했다. SQL 삽입은 하드코딩 상수 + 파라미터 바인딩만 사용해 인젝션 표면이 없고, N+1·트랜잭션 경계·커넥션 관리·인덱스 사용 모두 기존 패턴을 유지한 채 SET/RETURNING 절만 확장했다. 남은 항목(컬럼명 하드코딩의 정적 검증 부재, SQL 값의 e2e 미검증, 큐 대기 시간과 실행 시간이 같은 컬럼을 공유하는 의미 중복)은 전부 프로젝트가 이미 근거와 함께 트래커에 등재·유예한 것으로, 이번 diff 를 막을 수준의 신규 결함이 아니다.

## 위험도

LOW
