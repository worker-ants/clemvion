# 데이터베이스(Database) 코드 리뷰

## 검토 대상 요약

`durationMs` 종결 이벤트(`completed`/`failed`/`cancelled`) 배관 PR 의 3번째 리뷰 라운드다.
DB 관련 핵심 표면은 두 이전 라운드(`review/code/2026/08/15/09_58_24/database.md`,
`review/code/2026/08/15/10_18_38/database.md`)에서 이미 상세히 다뤘다 — 신규 마이그레이션·
신규 컬럼/인덱스는 없고, 기존 `Execution.duration_ms`(`INTEGER`) 컬럼에 값을 채우는
것이 전부다. 이번 라운드의 실제 신규 diff(직전 라운드 이후 커밋 `6bedc7e3c`)는:

1. `execution-engine.service.ts` 9곳의 in-memory `durationMs` 대입을
   `nodeExecution.finishedAt.getTime() - nodeExecution.startedAt.getTime()` 손계산에서
   `resolveTerminalDurationMs(...)` 헬퍼 경유로 교체 (직전 라운드 W1 — grep 이 멀티라인
   표현식을 놓쳐 6곳만 전환했던 것을 9곳으로 정정).
2. `finalizeStalledExhausted` 의 raw UPDATE `.set()` 블록 위 주석을, 이미 대체된 옛 SQL
   (`GREATEST(0, …)`)을 현재형으로 설명하던 것에서 현재 동작(`음수는 NULL, 상한은
   saturate`)과 일치하도록 정정 (직전 라운드 W6).
3. `chat-channel.dispatcher.ts` 의 `durationMs` 캐스팅 타입을 `number | null` 로 확장
   (W8 — DB/SQL 표면과 직접 관련은 없으나 wire 계약 정합).
4. `spec/5-system/14-external-interaction-api.md` 의 JSON 예시 trailing comma 수정 (W7,
   문서).

이 4가지는 모두 **JS 레벨 값 계산 방식 교체 + 주석/타입 정정**이며, 새 SQL 문·새 파라미터
바인딩·새 트랜잭션 경계를 만들지 않는다. `executionRepository.query(...)`/`QueryBuilder`
쪽 5개 raw UPDATE(`cancelParkedExecution`·`markWebChatIdleTimeout`·`markExecutionCancelled`·
`markQueueWaitTimeout`·`finalizeStalledExhausted`)의 SQL 본문·파라미터·트랜잭션 구조는
이번 커밋에서 변경되지 않았다.

## 이전 라운드 대비 검증 (fresh review)

- **CRITICAL (int4 오버플로, `09_58_24` 라운드)** — `TERMINAL_DURATION_MS_SQL` 에
  `LEAST(2147483647, …)` 클램프 + 시계 역행 시 `CASE WHEN … THEN NULL` 처리가 적용된
  상태를 `codebase/backend/src/shared/utils/terminal-duration.ts:87-90` 에서 직접 확인.
  `terminal-duration.spec.ts` 의 `TERMINAL_DURATION_MS_SQL` describe 블록(문자열
  `LEAST(2147483647` 포함·`GREATEST(0` 미포함 단언)이 회귀를 정적으로 고정한다. 해소 확인.
- **WARNING (`10_18_38` 라운드, 주석 drift)** — `execution-engine.service.ts` 의
  `finalizeStalledExhausted` 함수 내 `.set({ durationMs: () => TERMINAL_DURATION_MS_SQL })`
  블록 바로 위 주석이 `음수(시계 역행)는 NULL, int4 상한은 saturate — 근거는 헬퍼 JSDoc
  참조.` 로 갱신됐음을 실측 확인(`grep -n` 으로 대조). 해소 확인.
- **트랜잭션 원자성** — `cancelParkedExecution`·`markWebChatIdleTimeout` 은 부모
  `Execution` UPDATE + 자식 `NodeExecution` cascade UPDATE 를
  `this.dataSource.transaction(...)` 으로 묶은 상태 유지. `markExecutionCancelled`·
  `markQueueWaitTimeout` 은 단일 UPDATE 문이라 자체 원자적. `finalizeStalledExhausted` 만
  부모/자식 UPDATE 가 비-트랜잭션이지만, 이는 이 PR 이 만든 구조가 아니라 기존 코드이고
  함수 docstring 이 스스로 "이미 문서화된 zombie double-drive 노출과 동일 class, 신규
  회귀 아님" 이라 인지·수용한 상태다. 두 이전 라운드와 동일하게 INFO 로 유지한다(신규
  변경 없음, 재론 불필요).
- **SQL 인젝션·파라미터 바인딩** — `TERMINAL_DURATION_MS_SQL` 은 하드코딩된 모듈 상수이고
  가변 요소(`:terminalFinishedAt`)는 5개 호출처 전부 `.setParameter(...)` 로 `Date` 객체
  바인딩. `WHERE`/`AND WHERE` 도 named parameter(`:id`, `:waiting`, `:...statuses` 등)
  유지. 문자열 concatenation 없음. 변경 없음 — 안전.
- **N+1·인덱스·대량 데이터·커넥션 관리** — 모든 UPDATE 는 PK(`id`) 또는 이미 인덱싱된
  조건(`status`, `execution_id`)으로 단건/소수 row 대상. 이번 커밋이 in-memory JS 계산
  경로에서 바꾼 9곳도 전부 실행(execution)/노드(node execution) 1건당 1회 호출되는 종결
  경로이며 반복 루프 내부에서의 신규 쿼리 유발이 없다. 해당 없음.

## 발견사항

이번 라운드가 새로 발견한 DB 관점 Critical/Warning 은 없다.

- **[INFO]** 남은 후속 항목은 이미 `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
  ("`durationMs` 후속 2건")에 등재돼 있고 이번 diff 의 신규 발견이 아니다 — 참고로만 명시.
  - `TERMINAL_DURATION_MS_SQL` 이 실제 Postgres 값 수준으로 검증된 적이 없다(단위 테스트는
    문자열 `toContain` 뿐, 유일한 관련 e2e `webchat-idle-reaper.e2e-spec.ts` 도
    `duration_ms` 를 assert 하지 않는다). 부호·단위·클램프 오류를 잡을 안전망 부재.
  - SQL 문자열이 컬럼명 `started_at` 을 하드코딩 — 엔티티 메타데이터 대조 assertion 없음.
  - 둘 다 이번 PR 범위 밖으로 이미 트래커에 등재됐고, 클램프 버그가 "리뷰로만" 잡혔던
    이력(1차 라운드 CRITICAL)을 고려하면 우선순위 있는 후속으로 남겨 둘 가치가 있다(제안
    반복이 아니라 상태 확인 목적의 기록).

## 요약

3번째 리뷰 라운드 시점 기준, 이 PR 의 DB 표면(5개 엔티티-미로드 raw UPDATE + `RETURNING`,
9개 in-memory JS 계산 경로)은 파라미터 바인딩·트랜잭션 원자성·int4 클램프 모두 견고한
상태로 수렴했다. 1차 라운드가 잡은 CRITICAL(int4 오버플로)과 2차 라운드가 잡은
WARNING(주석 drift)은 실측 가능한 형태로 해소를 확인했다. 이번 라운드의 실제 신규
변경(9곳 JS 계산 헬퍼 전환, 주석/타입 정정)은 새 SQL·새 트랜잭션 경계를 만들지 않아
신규 DB 리스크가 없다. `finalizeStalledExhausted` 의 비-트랜잭션 이중 UPDATE 는 여전히
기존 구조로 남아 있으나 세 라운드 모두 동일하게 pre-existing·수용된 위험으로 판단했다.

## 위험도

LOW
