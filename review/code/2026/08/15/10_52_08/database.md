# 데이터베이스(Database) 코드 리뷰

## 검토 대상 요약

`durationMs` 종결 이벤트(`completed`/`failed`/`cancelled`) 배관 PR — 4번째(신규 세션) DB 리뷰 라운드다. 이 diff 는 신규 마이그레이션·신규 컬럼·신규 인덱스를 만들지 않는다. 기존 `execution.duration_ms`(`INTEGER`, `codebase/backend/migrations/V001__initial_schema.sql:223`) 컬럼에 값을 채우는 배관이 전부다.

이전 세 라운드(`review/code/2026/08/15/09_58_24/database.md`, `10_18_38/database.md`, `10_34_51/database.md`)가 이미 이 표면을 상세히 검증했고, 그 산출물 자체가 이번 diff 에 포함돼 있다(리뷰 히스토리 파일). 이번 라운드는 (1) 그 결론들을 소스를 직접 열어 재검증하고, (2) 최신 커밋(`8a0c2348b`, 직전 라운드 `10_34_51` 의 WARNING 7건 조치분)까지 반영해 신규 diff 여부를 확인했다.

## 재검증 결과

- **CRITICAL (int4 오버플로) — 해소 확인.** `codebase/backend/src/shared/utils/terminal-duration.ts:87-90` 의 `TERMINAL_DURATION_MS_SQL` 이 `LEAST(2147483647, …)` 클램프 + `CASE WHEN … THEN NULL`(시계 역행)을 그대로 유지. `duration_ms INTEGER` 컬럼(≈24.8일 상한)에 대해 `::int` 캐스팅이 `integer out of range` 로 UPDATE 전체를 실패시켜 오래 대기한 실행(park/idle-wait/큐 대기/stalled)을 영구 고착시키던 결함이 saturate 로 교정된 상태를 소스에서 직접 확인했다.
- **SQL 인젝션 — 없음.** `TERMINAL_DURATION_MS_SQL` 은 하드코딩된 모듈 상수이고, 유일한 가변 요소 `:terminalFinishedAt` 은 5개 호출처(`execution-engine.service.ts:1038,1173,2830,2901,3354`) 전부 `.setParameter(TERMINAL_FINISHED_AT_PARAM, <Date>)` 로 바인딩된다. `WHERE`/`AND WHERE` 절도 기존과 동일하게 named parameter(`:id`, `:waiting`, `:...statuses` 등)를 유지한다. 문자열 concatenation 없음 — grep 으로 5곳 전수 확인.
- **트랜잭션 — 적절.** `cancelParkedExecution`(`execution-engine.service.ts:1023-1089`)·`markWebChatIdleTimeout`(`:1150-`)은 부모 `Execution` UPDATE + 자식 `NodeExecution` cascade UPDATE 를 `this.dataSource.transaction(...)` 으로 묶어 원자성을 확보한 상태 그대로다. `markExecutionCancelled`·`markQueueWaitTimeout` 은 단일 UPDATE 문이라 자체 원자적. `finalizeStalledExhausted`(`:3332-3400`)만 부모/자식 UPDATE 가 비-트랜잭션인데, 이는 이 PR 이 만든 구조가 아니라 기존 코드이고 함수 docstring 이 "기존 zombie double-drive 노출과 동일 class, 신규 회귀 아님" 을 스스로 인지·문서화한 상태(변경 없음, INFO 유지).
- **`RETURNING` + 파라미터 파싱 — 적절.** 5개 raw UPDATE 전부 `.returning(['id', 'duration_ms'])` 로 UPDATE 문장 안에서 값을 되받아 별도 SELECT 왕복을 만들지 않는다. `toFiniteNumber()`(`terminal-duration.ts:56-63`)가 pg 드라이버의 `numeric`/`bigint` 문자열 반환·`NaN`을 방어적으로 `null` 로 흡수한다.
- **인덱스 — 변경 없음, 기존 인덱스로 충분.** 각 UPDATE 의 `WHERE`/`AND WHERE` 는 PK(`id`) 또는 이미 인덱싱된 `status`(`idx_execution_status`, `V002__indexes.sql:19`)·`execution_id`(`idx_node_execution_execution`/`idx_node_execution_exec_status_active`) 조건이다. 이 PR 은 새 조건절을 추가하지 않았다.
- **N+1·대량 데이터 — 해당 없음.** 5개 raw UPDATE 와 JS 계산 경로(9곳, 최신 커밋에서 `NodeExecution` 8곳 오적용을 되돌려 `savedExecution` 1곳으로 교정 확인) 모두 실행(execution) 1건당 1회 호출되는 종결 경로다. 노드 순회·배치 루프 내부에서 신규 쿼리를 유발하지 않는다.

## 발견사항

- **[WARNING]** `duration_ms` 컬럼이 이제 "대기 시간"까지 담게 되어 기존 status-필터 없는 AVG 집계 쿼리를 오염시킨다
  - 위치: `codebase/backend/src/modules/dashboard/dashboard.service.ts:96` (`avg7d`), `codebase/backend/src/modules/statistics/statistics.service.ts:95`(요약), `:221`(Top workflows)
  - 상세: 이 PR 이전에는 park 취소·공개 위젯 idle-wait 회수·큐 대기 타임아웃·stalled 소진 4경로가 `duration_ms` 를 아예 쓰지 않아 `AVG(e.duration_ms) FILTER (WHERE e.duration_ms IS NOT NULL)` 집계에서 자연히 제외됐다. 이 PR 이 그 경로들에 값을 채우기 시작했는데, 그 값의 의미가 "실행 시간"이 아니라 **대기/idle 시간**(idle-wait grace 기본 1시간, park 은 무기한 대기 가능)이다. 위 두 소비처는 `e.status` 필터가 없어 앞으로 이 오염된 값이 그대로 대시보드/통계 평균에 섞여 들어간다 — 스키마(컬럼 하나가 두 가지 다른 의미를 담게 됨) 설계 관점의 실질적 회귀다. 직접 코드를 열어 대조한 결과 `alerts-evaluator.service.ts:165` 는 `e.status = :status`(`'completed'`) 필터가 있어 우연히 안전함을 확인했다 — 세 소비처 중 유일하게 필터가 있는 곳이다.
  - 제안: 이미 개발자 자신이 발견해 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` "⚠️ `duration_ms` 에 '대기 시간' 이 섞여 집계를 오염시킨다" 절에 소비처 3곳(대시보드·통계·프론트 실행 목록 Duration 컬럼)까지 정확히 등재하고 후속으로 이연했다(`10_34_51` W3). 근거·범위가 실측과 일치함을 이번 라운드에서 재확인했다. 이 PR 범위에서 즉시 고칠 필요는 없으나, 다음 착수 시 "집계 쿼리에서 대기-시간 생성 경로를 status/`error.code` 기준으로 제외" 또는 "순수 실행시간과 대기시간을 별도 컬럼으로 분리" 중 하나를 선택할 것 — 컬럼 하나에 이질적 의미를 섞는 현재 상태를 오래 끌수록 새 소비처가 계속 오염될 위험이 늘어난다.

- **[INFO]** retry-turn 재진입 시 DB 에 영속된 `durationMs`(COALESCE 로 보존된 최초 취소 시각 T1)와 emit payload 의 in-memory `durationMs`(재진입 시점 T2)가 어긋날 수 있다
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:643` (`durationMs: () => 'COALESCE(duration_ms, :newDurationMs)'`)
  - 상세: 이 CANCELLED 재진입 분기는 이번 diff 의 변경 대상이 아니다(이번 diff 의 hunk 는 L711 이후·L888 이후·L946 이후에 위치, 이 UPDATE 는 L637-651로 diff 밖). `stop()` 이 커밋한 T1 값을 DB 는 `COALESCE`로 보존하는데, 그 UPDATE 는 `.returning(...)` 이 없어 실제 persist 값을 되읽지 않고, 호출부의 in-memory `execution.durationMs`/`finishedAt`는 이번 시도(T2)의 값 그대로 emit 된다 — "DB=wire" 불변식이 이 경로에서만 깨질 수 있다. 개발자 스스로 발견해 같은 트래커 문서("retry-turn 재진입 시 DB 와 emit 의 `durationMs` 가 어긋난다", `10_34_51` W1)에 등재했고, "DB write 경로를 또 바꾸는 변경이라 서두르지 않는다"는 근거로 이 라운드에서 손대지 않기로 명시적으로 결정했다. 이 diff 자체가 만든 신규 결함이 아니라 pre-existing 코드이며, 이 PR 이 `durationMs` 를 실제로 소비 가능하게 만들면서 영향 범위가 커진 것뿐이라 조치 유예가 합리적이다.
  - 제안: 트래커 항목대로 `.returning(['duration_ms'])` 추가 + emit 값 자체를 단언하는 회귀 테스트를 후속 PR 에서 진행할 것(기존 테스트는 SQL 문자열 형태만 검증해 이 드리프트를 못 잡는다고 트래커가 이미 지적함).

## 요약

이 PR 의 신규 DB 표면(5개 raw UPDATE + `RETURNING`, `TERMINAL_DURATION_MS_SQL` 상수)은 파라미터 바인딩·트랜잭션 원자성·int4 클램프 모두 소스 레벨에서 재확인한 결과 견고하다. 1차 라운드가 잡았던 CRITICAL(int4 오버플로 → 영구 고착)은 saturate 클램프로 해소됐고, SQL 인젝션 표면은 없으며(리터럴 상수 + 전량 파라미터 바인딩), 두 단계 UPDATE 가 필요한 두 경로는 트랜잭션으로 원자화돼 있다. 유일하게 새로 강조할 지점은 기능 자체의 부작용인 데이터 의미 오염 — `duration_ms` 컬럼이 이제 "대기 시간"과 "실행 시간"을 함께 담아 status 필터 없는 AVG 집계(대시보드·통계) 쿼리 결과를 왜곡한다(WARNING). 다만 이는 개발자가 이미 자체 발견해 소비처 3곳까지 정확히 실측·등재하고 근거와 함께 이연한 상태이며, 이번 diff 의 신규 미검증 결함이 아니라 알려진·추적 중인 잔여 리스크다. retry-turn 재진입 시 DB/emit `durationMs` 드리프트(INFO)도 마찬가지로 pre-existing + 이미 트래커 등재. 신규 마이그레이션·인덱스 변경이 없어 무중단 배포 리스크도 없다. 전반적으로 DB 관점 위험도는 낮되, 등재된 데이터 오염 이슈가 다음 착수 순번에 실제로 반영되는지는 후속 세션에서 확인이 필요하다.

## 위험도

LOW
