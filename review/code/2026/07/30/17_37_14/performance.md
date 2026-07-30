# 성능(Performance) 리뷰 결과

## 대상
- `codebase/backend/src/modules/execution-engine/state/state-machine.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts`
- `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts`
- `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` (호출부 컨텍스트, 이번 diff 자체는 미변경)

리뷰 프롬프트가 5개 파일 모두 "전체 파일 컨텍스트"만 제공하고 unified diff 블록은 없어, 실제 변경분을
`git show 2ca44b769`(커밋 `fix(engine): retry 재진입 짝 전이가 DB 가드에 막혀 절대 persist 되지 않던 결함`)로
직접 확인했다. 게이트 숫자가 소스 파일의 실제 줄 번호와 일치함(예: `execution-engine.service.ts:513`/`534`)을
`Read`/`grep` 대조로 검증한 뒤 아래 위치를 인용한다.

## 변경 요약 (성능 관점에서 본 diff 성격)

1. `state-machine.ts` — `canTransition` 의 `allowRetryReentry` opt-in 분기에 `to === WAITING_FOR_INPUT` 조건 하나를 추가(단순 boolean OR 확장).
2. `execution-engine.service.ts` — 신규 `private static readonly NON_TERMINAL_OR_FAILED_STATUSES_SQL` 필드(534행) 추가 + `lockNonTerminalExecutionRow`/`tryLockActiveExecutionAndSaveNodeExec`/`updateExecutionStatus` else 분기가 `opts?.allowRetryReentry` 값에 따라 이미 존재하던 두 정적 SQL 리터럴 문자열 중 하나를 선택하도록 함.
3. `ai-turn-orchestrator.service.ts` — `reparkAiResumeTurn` 4개 호출부와 `tryLockActiveExecutionAndSaveNodeExec` 2개 호출부에 opts 객체를 관통 전달.
4. `engine-driver.interface.ts` — 타입 시그니처에 `opts?` 파라미터 추가(런타임 비용 0).

## 발견사항

- **[INFO]** 정적 SQL 리터럴 목록의 중복 계산은 클래스 로드 시 1회뿐 — 런타임 비용 없음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:513`, `:534` (`NON_TERMINAL_STATUSES_SQL` / `NON_TERMINAL_OR_FAILED_STATUSES_SQL` 선언)
  - 상세: 두 필드 모두 `Object.values(ExecutionStatus).filter(...).map(...).join(...)` 를 `private static readonly` 로 선언해 클래스 정의 시점(모듈 로드) 1회만 평가된다. 요청마다 재계산되지 않으므로 핫패스 비용은 0이며, 기존 `NON_TERMINAL_STATUSES_SQL` 과 동일한 패턴을 그대로 재사용했다(WARNING #8, 2026-07-26 선례). 두 목록이 소스상 별도 필드로 나뉘어 정의가 살짝 중복되지만 이는 유지보수성 이슈이지 성능 이슈는 아니다.
  - 제안: 조치 불요.

- **[INFO]** `lockNonTerminalExecutionRow`/`updateExecutionStatus` 의 opts 선택은 O(1) 삼항 연산 — 추가 DB 왕복 없음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8168-8184`(`lockNonTerminalExecutionRow`), `:8224-8253`(`tryLockActiveExecutionAndSaveNodeExec`), `:8354-8484`(`updateExecutionStatus`, else 분기 `elseStatusesSql` 선택 포함)
  - 상세: 세 지점 모두 이미 존재하던 단일 `SELECT ... FOR UPDATE` 또는 단일 `UPDATE ... WHERE status IN (...)` 쿼리는 그대로 유지한 채, `IN (...)` 절 안에 들어갈 두 정적 문자열 중 하나를 고르는 조건만 추가됐다. 트랜잭션 경계·쿼리 횟수·라운드트립 수 모두 변경 전과 동일하다. 쿼리 텍스트 자체는 호출마다 `executionId` 값이 파라미터(`$1`)로 분리돼 있고 `IN (...)` 리터럴은 opts 값에 따라 둘 중 하나로 고정되므로(값 자체가 매 호출 달라지지 않음) DB 쪽 plan cache 적중률에도 새로운 부담이 없다.
  - 제안: 조치 불요.

- **[INFO]** 호출부 관통 전달에 따른 소규모 객체 리터럴(`{ allowRetryReentry: true }` / `{ retryReentry: true }`) 할당은 핫루프가 아닌 turn 경계에서만 발생
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:237-243, 303-309, 321-327, 339-345`(`reparkAiResumeTurn` 4개 호출부), `:430-459`(`reparkAiResumeTurn` 정의 — `opts?.retryReentry ? { allowRetryReentry: true } : undefined`), `:1505-1508, 1597-1600`(`tryLockActiveExecutionAndSaveNodeExec` 2개 호출부)
  - 상세: 추가된 객체 리터럴은 AI 노드의 turn 경계(re-park/finalize)마다 최대 1회 생성되며, 이는 이미 LLM 호출(수백 ms~수 초) 및 DB 트랜잭션을 동반하는 저빈도 이벤트라 GC 압력이 무시할 수준이다. ForEach/Parallel 처럼 N회 반복되는 루프 안에서 호출되는 코드가 아니다.
  - 제안: 조치 불요.

## 관련 관찰 (참고, 발견사항 아님)

이번 커밋이 고친 결함(짝 전이가 DB 가드에서 항상 0행이라 retry 재진입이 구조적으로 100% 실패)은 수정 전에는
매 retry 시도마다 "쓸모없는 트랜잭션 1회(0행 매칭) + 이후 취소/실패 폴백 경로의 추가 DB 쓰기"라는 이중 비용을
치르고 있었다. 이번 fix 는 그 폴백 경로 진입 자체를 없애 오히려 리소스 낭비를 줄이는 방향이며, 새로운 알고리즘
비용·N+1·블로킹 I/O·대규모 메모리 할당을 추가하지 않는다.

## 요약

이번 변경은 이미 존재하던 두 정적 SQL 문자열(`NON_TERMINAL_STATUSES_SQL` / 신설된
`NON_TERMINAL_OR_FAILED_STATUSES_SQL`) 중 하나를 `opts.allowRetryReentry` 값에 따라 선택하도록 하고, 그
opts 를 호출 체인(orchestrator → engine)에 관통 전달하는 순수 동시성/정합성 버그 수정이다. 트랜잭션 경계, DB
쿼리 횟수, 반복문 구조, 캐싱 전략, 데이터 구조 선택 중 어느 것도 바뀌지 않았고, 추가된 비용은 클래스 로드 시
1회 문자열 조립과 turn 경계당 1회의 소규모 객체 리터럴 할당뿐이라 알고리즘 복잡도·메모리·I/O 어느 축에서도
유의미한 영향이 없다. N+1, 블로킹 I/O, 캐시 무효화, 지연 로딩 관점에서도 새로 도입된 안티패턴은 없다.

## 위험도

NONE
