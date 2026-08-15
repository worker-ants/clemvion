# 데이터베이스(Database) 코드 리뷰

## 검토 대상 요약

`durationMs` 종결 payload 확장 PR (`origin/main` → HEAD, 5 커밋). DB 표면의 핵심은
`codebase/backend/src/shared/utils/terminal-duration.ts` 가 정의한 raw SQL 식
`TERMINAL_DURATION_MS_SQL` 과, 이를 `execution-engine.service.ts` 의 5개 엔티티-미로드
raw UPDATE 지점(`cancelParkedExecution`·`markWebChatIdleTimeout`·`markExecutionCancelled`·
`markQueueWaitTimeout`·`finalizeStalledExhausted`)에 `.set({ durationMs: () => ... })` +
`.setParameter(...)` + `.returning(['id', 'duration_ms'])` 로 배선한 것이다. 신규
마이그레이션·신규 컬럼은 없다(기존 `duration_ms INTEGER` 컬럼에 값만 채운다).

직전 라운드(`review/code/2026/08/15/09_58_24/database.md`)가 잡은 **CRITICAL(int4 오버플로,
상한 클램프 부재)** 은 이번 diff 의 커밋 `606f54418`("fix(eia): 내 SQL 이 24.8일 넘게 대기한
실행을 영구 고착시킬 수 있었다")에서 `LEAST(2147483647, …)` 클램프 + `CASE WHEN … < started_at
THEN NULL` 로 해소됐다. `terminal-duration.spec.ts` 의 `TERMINAL_DURATION_MS_SQL` 관련 3개
테스트(`LEAST(2147483647` 포함 단언, `GREATEST(0` 미포함 단언)가 이 수정을 정적으로 고정한다.
실제 코드(`terminal-duration.ts:87-90`)를 열어 클램프 문자열이 살아 있음을 확인했다.

## 발견사항

- **[WARNING]** `finalizeStalledExhausted` 내부 주석이 이번 PR 자신이 되돌린 옛 SQL 동작
  (`GREATEST(0, …)`)을 마치 현재 동작인 것처럼 여전히 서술한다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3352`
    (`finalizeStalledExhausted` 함수, `.set({ ... durationMs: () => TERMINAL_DURATION_MS_SQL })`
    블록 바로 위 주석)
  - 상세: 실제 사용되는 `TERMINAL_DURATION_MS_SQL`(`terminal-duration.ts:87-90`)은 이번 PR
    이(커밋 `606f54418`) `GREATEST(0, …)` → `CASE WHEN :terminalFinishedAt::timestamptz <
    started_at THEN NULL ELSE LEAST(2147483647, …) END` 로 완전히 교체했다. 시계 역행 시
    이제는 **`NULL`** 을 내고(`0` 이 아니다), 상한 클램프(`LEAST(2147483647, …)`)도 새로
    추가됐다. 그런데 `execution-engine.service.ts:3352` 의 주석은 "`GREATEST(0, …)` —
    시계 역행이 음수를 만들면 수신자의 산술이 깨진다" 라고 여전히 적혀 있어, **옛 식이
    지금도 쓰이는 것처럼** 읽힌다. `terminal-duration.ts` 쪽 docstring 은 같은 커밋에서
    "종전엔 `GREATEST(0, …)` 로 `0` 을 냈다" 는 과거형으로 정확히 갱신됐는데, 이 사용처
    주석만 갱신에서 빠졌다. 이 PR 자체가 W8 로 "같은 이상 상황에 경로마다 다른 신호(0 vs
    null)를 내면 안 된다" 는 교훈을 문서화했는데, 그 교훈이 적힌 자리 바로 옆 주석이
    반증된 옛 동작을 참으로 서술하는 형태다. 향후 이 5경로 패턴을 복제해 새 raw UPDATE
    를 추가하는 사람이 이 주석만 보고 "시계 역행 → 0" 이라고 오해하면, 이미 한 번 고친
    "경로마다 다른 sentinel" 문제가 재발할 수 있다.
  - 제안: 주석을 `terminal-duration.ts:80-83` 의 현재 서술("음수는 NULL, 종전엔
    GREATEST(0,…) 로 0 을 냈다")과 일치하도록 갱신하거나, 아예 지우고
    `{@link TERMINAL_DURATION_MS_SQL}` 링크만 남긴다(SQL 상수 쪽에 이미 정확한 설명이
    있으므로 중복 서술을 없애는 편이 drift 재발을 막는다).

- **[INFO]** SQL 인젝션·파라미터 바인딩은 안전
  - 상세: `TERMINAL_DURATION_MS_SQL` 은 코드 상수 문자열(사용자 입력 없음)이고, 그 안의
    `:terminalFinishedAt` 플레이스홀더는 5개 호출처 전부에서
    `.setParameter(TERMINAL_FINISHED_AT_PARAM, terminalFinishedAt)` 로 `Date` 객체를
    바인딩한다. `id`/`status`/`executionId` 등 나머지 조건절도 모두 named parameter를
    쓰며 문자열 concatenation 이 없다. `terminal-duration.spec.ts` 의
    `TERMINAL_DURATION_MS_SQL` describe 블록이 SQL 상수 선언과 실제 파라미터 이름 일치를
    정적으로 검증해 향후 이름 불일치(런타임 "파라미터 미바인딩")를 방지한다.

- **[INFO]** 트랜잭션 원자성 — 2곳 정상, 1곳은 기존 구조(비-신규 위험)
  - 상세: `cancelParkedExecution`·`markWebChatIdleTimeout` 은 부모 `Execution` UPDATE +
    자식 `NodeExecution` cascade UPDATE 를 `this.dataSource.transaction(...)` 으로 정확히
    묶고, `RETURNING` 값(`cancelledDurationMs`)을 트랜잭션 콜백 내부에서 캡처해 커밋 후
    best-effort emit 에 사용한다 — 스코프·순서 모두 올바르다. `markExecutionCancelled`·
    `markQueueWaitTimeout` 은 단일 UPDATE 문이라 그 자체로 원자적이다.
    `finalizeStalledExhausted` 만 부모/자식 UPDATE 가 트랜잭션으로 묶여 있지 않은데, 이는
    함수 docstring 이 스스로 "이미 문서화된 zombie double-drive 노출과 동일 class, 신규
    회귀 아님" 이라 명시한 **기존 구조**이며 이번 diff 는 여기에 `durationMs` SET 절/
    RETURNING 확장만 추가했을 뿐 트랜잭션 여부는 건드리지 않았다. 직전 라운드
    (`09_58_24/database.md`)도 동일하게 INFO 로 넘겼다 — 이번 라운드도 동일 판단 유지.

- **[INFO]** 마이그레이션·인덱스·N+1·커넥션 관리·대량 데이터 페이지네이션 — 해당 없음/영향 없음
  - 상세: 신규 컬럼·인덱스·테이블 없음(기존 `duration_ms INTEGER` 컬럼, `V001__initial_schema.sql:223`).
    모든 UPDATE 는 PK(`id`) 또는 이미 인덱싱된 조건(`status`, `execution_id`)으로 단건/소수
    row 를 대상으로 하는 조건부 UPDATE 라 N+1·대량 스캔 우려가 없다. `retry-turn.service.ts`
    쪽 변경은 전부 이미 로드된 엔티티에 대한 JS 계산(`resolveTerminalDurationMs`)이라 추가
    쿼리가 없다. 커넥션은 기존 `this.dataSource.transaction(...)`/repository 패턴을 그대로
    재사용해 별도 획득·해제 로직이 없다.

- **[INFO]** 이미 plan 에 등재된 후속 항목(이번 라운드가 새로 발견한 것 아님, 참고로 명시)
  - 상세: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` (`durationMs` 후속
    2건) 에 (a) `TERMINAL_DURATION_MS_SQL` 이 실제 Postgres 값 수준으로 검증된 적이 없고
    유일한 관련 e2e(`webchat-idle-reaper.e2e-spec.ts`)도 `duration_ms` 를 assert 하지
    않는다는 점, (b) SQL 문자열이 컬럼명 `started_at` 을 하드코딩해 엔티티 메타데이터와
    대조하는 assertion 이 없다는 점이 W10/W7 로 이미 기록돼 있다. 이번 PR 범위에서 막을
    필요는 없지만, 클램프 버그가 "리뷰로만" 잡혔던 이력(직전 라운드 CRITICAL)을 고려하면
    실측 안전망 부재는 재발 가능성이 낮지 않다 — 후속 착수 시 우선순위로 참고.

## 요약

이번 PR 의 핵심 DB 표면(raw SQL 식 + 5개 엔티티-미로드 UPDATE + `RETURNING`)은 파라미터
바인딩·트랜잭션 원자성·int4 클램프 모두 이번 라운드 시점에는 견고하다. 직전 라운드가 잡은
int4 오버플로 CRITICAL 은 실측 가능한 형태(`LEAST(2147483647, …)` + 테스트 3건)로 해소됐다.
유일하게 새로 발견한 문제는 `finalizeStalledExhausted` 주변 주석이 이번 PR 이 스스로 폐기한
옛 SQL(`GREATEST(0, …)`)을 현재형으로 서술해 향후 같은 패턴을 복제할 때 "경로마다 다른
sentinel" 회귀를 재유발할 수 있다는 점이다(WARNING). 마이그레이션·인덱스·N+1·커넥션 관리
관점에서는 이번 diff 가 만드는 새로운 위험이 없다.

## 위험도

LOW
