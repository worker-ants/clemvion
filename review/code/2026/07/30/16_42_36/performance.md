# 성능(Performance) 리뷰

## 발견사항

- **[INFO]** `applyRetryLastTurn` 재진입 경로에 새 DB 왕복(atomic UPDATE)이 1회 추가됨
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:331` (호출부), `:538` (`claimSpawnedRetryRow` 정의)
  - 상세: 이번 변경으로 `applyRetryLastTurn` 이 기존 `findOneBy`(SELECT) 이후 `claimSpawnedRetryRow`(신규 UPDATE, PK+status+jsonb_exists 조건)를 순차로 한 번 더 왕복한다. 다만 이 호출은 **retry-last-turn 이벤트 1건당 1회**이며 반복문(foreach/parallel/loop) 내부가 아니므로 N+1 패턴은 아니다. PK(`id`) 조건이라 인덱스 조회이고 트랜잭션도 아니라서 지연은 무시할 수준이며, 코드 주석이 "손상 판정보다 claim 이 먼저 실행돼야 한다"는 근거(ai-review CRITICAL #1/#2, 2026-07-28)를 상세히 남겨 의도된 정합성 트레이드오프임이 명확하다.
  - 제안: 별도 조치 불필요. 굳이 더 줄이려면 최초 `findOneBy` SELECT 와 `claimSpawnedRetryRow` UPDATE 를 단일 `UPDATE ... WHERE id=:id AND status='running' AND jsonb_exists(...) RETURNING *` 로 합쳐 왕복을 하나 줄일 수 있으나, 현재 구조는 "행 없음"/"RUNNING 아님"/"claim 실패" 각 사유별로 다른 로그 메시지를 남기기 위해 의도적으로 분리된 것으로 보이므로 이 재구성을 강제할 만큼의 실익은 없다.

- **[INFO]** 신규 정적 SQL 리터럴 상수(`NON_TERMINAL_OR_FAILED_STATUSES_SQL`) — 계산 비용은 프로세스당 1회, 문제 없음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:534`
  - 상세: `Object.values(ExecutionStatus).filter(...).map(...).join(', ')` 패턴이 기존 `NON_TERMINAL_STATUSES_SQL`(:513) 옆에 하나 더 추가됐다. 둘 다 `private static readonly` 클래스 필드라 클래스 정의 시점(모듈 로드 1회)에만 평가되고 요청마다 재계산되지 않는다 — 기존에 WARNING #8(2026-07-26)로 지적돼 상수화된 패턴을 그대로 재사용한 것이라 회귀가 아니다. `lockNonTerminalExecutionRow`(:8168)와 guarded UPDATE(:8460 부근) 두 소비처 모두 이 미리 계산된 문자열을 `opts.allowRetryReentry` 값에 따라 삼항 연산으로 선택만 하므로 호출 경로에 추가 연산이 없다.
  - 제안: 조치 불필요.

- **[INFO]** 파라미터 threading 변화(`opts?: { allowRetryReentry?: boolean }` / `{ retryReentry?: boolean }`)로 인한 신규 객체 리터럴 할당은 호출당 1개, 반복문 밖
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` — `reparkAiResumeTurn` 호출 4곳(원본 좌표 기준 240-245, 300-306, 318-324, 336-342 부근), `tryLockActiveExecutionAndSaveNodeExec` 호출 2곳(1505 부근, 1597 부근). `codebase/backend/src/modules/execution-engine/state/state-machine.ts:112-119` (`canTransition` 의 추가 `||` 분기).
  - 상세: `finalizeOpts`/`allowRetryReentry ? {...} : undefined` 형태로 작은 객체를 턴당 최대 1회 생성한다. GC 대상이 되는 단명 객체이나 크기·빈도 모두 미미해 실질적 성능 영향은 없다. `state-machine.ts` 의 `canTransition` 도 단순 boolean 비교 분기 추가로 O(1) 유지.
  - 제안: 조치 불필요.

## 요약

이번 변경은 `execution.retry_last_turn` 재진입의 FAILED→RUNNING/WAITING_FOR_INPUT 짝 전이가 DB 가드에 막혀 절대 persist 되지 않던 구조적 결함을 고치는 정합성(correctness) 중심 fix로, 알고리즘 복잡도·자료구조·캐싱 전략에 실질적 변화가 없다. 신규 SQL 문자열 상수는 기존 패턴(정적 필드, 1회 평가)을 그대로 재사용해 회귀가 없고, 반복문 내 DB 호출(N+1)이나 O(n²) 문자열 누적, 블로킹 동기 I/O, 불필요한 대규모 메모리 할당은 발견되지 않았다. 유일하게 언급할 만한 지점은 `applyRetryLastTurn` 에 추가된 atomic claim UPDATE 왕복 1회인데, retry 이벤트당 1회·PK 인덱스 조회·비루프 호출이라 성능에 미치는 영향은 무시할 수준이며 코드 내 주석이 그 필요성(과거 CRITICAL 버그 재발 방지)을 충분히 근거 짓고 있다. 전반적으로 성능 리스크는 낮다.

## 위험도
LOW
