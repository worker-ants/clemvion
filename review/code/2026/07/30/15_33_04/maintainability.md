# 유지보수성(Maintainability) Review

대상 커밋: `2ca44b769` "fix(engine): retry 재진입 짝 전이가 DB 가드에 막혀 절대 persist 되지 않던 결함 (8R CRITICAL)"
(state-machine.ts / execution-engine.service.ts / ai-turn-orchestrator.service.ts / engine-driver.interface.ts 4개 소스 파일 변경. retry-turn.service.ts 는 이번 커밋에서 변경되지 않은 context 파일.)

## 발견사항

- **[WARNING]** `opts?.allowRetryReentry` 선택 삼항식이 동일 파일 안에서 손으로 2회 복제됨 — 이 파일이 바로 그 문제로 이전에 WARNING #8 을 받은 이력이 있는 자리
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8173-8175` (`lockNonTerminalExecutionRow` 의 `statusesSql`) 및 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8459-8461` (`updateExecutionStatus` else 분기의 `elseStatusesSql`)
  - 상세: `opts?.allowRetryReentry ? NON_TERMINAL_OR_FAILED_STATUSES_SQL : NON_TERMINAL_STATUSES_SQL` 3줄짜리 동일한 삼항식이 지역변수 이름만 바꿔 두 곳에 그대로 복제돼 있다. 이 파일은 정확히 "status SQL 리터럴 손 중복" 문제로 WARNING #8(2026-07-26, 8173 인근 주석 참조, `NON_TERMINAL_STATUSES_SQL` 상수화)을 받은 전례가 있는데, 이번 수정은 그 교훈을 새 상수(`NON_TERMINAL_OR_FAILED_STATUSES_SQL`) 자체에는 적용했으면서도 "어느 상수를 고를지 결정하는 로직"은 다시 손으로 복제했다. 이번에 고친 CRITICAL 버그 자체가 "새 소비처에 opts 배선을 빠뜨림"이었던 만큼, 향후 세 번째 guarded 지점이 추가될 때 이 삼항식을 빠뜨리거나 상수를 반대로 고르는 실수가 재발할 위험이 남는다.
  - 제안: `private resolveNonTerminalStatusesSql(opts?: { allowRetryReentry?: boolean }): string { return opts?.allowRetryReentry ? ExecutionEngineService.NON_TERMINAL_OR_FAILED_STATUSES_SQL : ExecutionEngineService.NON_TERMINAL_STATUSES_SQL; }` 같은 단일 헬퍼로 통합해 두 호출부가 한 줄만 쓰도록 정리 권장.

- **[WARNING]** `flag ? { allowRetryReentry: true } : undefined` boilerplate 가 한 파일 안에서 4회 반복
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:457` (`reparkAiResumeTurn`, `opts?.retryReentry ? { allowRetryReentry: true } : undefined`), `:1508`·`:1600`·`:1619` (`finalizeAiNode` 세 소비처, `allowRetryReentry ? { allowRetryReentry: true } : undefined`)
  - 상세: 이번 diff 는 `finalizeAiNode` 안에 이미 있던 1곳(1619)에 이어 같은 삼항식을 2곳 더 새로 추가했고(1508, 1600 — `tryLockActiveExecutionAndSaveNodeExec` 호출부), `reparkAiResumeTurn` 에도 4번째 변형(457)을 추가했다. "flag → opts 객체 변환"이라는 같은 개념이 4곳에 손으로 반복되며, `finalizeAiNode` 내부는 최소한 `allowRetryReentry` 지역변수(1439줄)를 공유해 재사용하지만 그 변수를 감싸는 삼항식 자체는 3번 다시 쓴다. 새 소비처 추가 시 이 변환을 빠뜨리면 이번 커밋이 고친 것과 동일한 클래스의 결함(opts 미배선 → DB 가드 항상 0행)이 재발할 수 있는 지점이다.
  - 제안: `private static toRetryReentryOpts(flag: boolean | undefined): { allowRetryReentry: boolean } | undefined` 같은 단일 변환 헬퍼(또는 `AiTurnOrchestrator` 내 private 메서드)로 통합해 4곳을 한 곳으로 좁히기를 권장.

- **[INFO]** 같은 커밋 안에서 새 `opts` 파라미터 문서화 스타일이 두 갈래로 갈림
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8158` (`lockNonTerminalExecutionRow` — `@param opts.allowRetryReentry` JSDoc 태그로 설명) vs `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8227-8232` (`tryLockActiveExecutionAndSaveNodeExec` — 파라미터 목록 내부의 `//` 인라인 주석으로 설명, 리딩 JSDoc 에는 `opts` 언급 없음) 및 `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:435-441` (`reparkAiResumeTurn` — 동일하게 인라인 주석 스타일)
  - 상세: 개념적으로 동일한 "retry reentry opt-in 파라미터 추가" 설명에 대해 한 곳은 JSDoc `@param` 태그, 나머지 두 곳은 파라미터 목록 안 인라인 주석을 쓴다. 두 스타일 모두 이 코드베이스에 이미 있는 기존 관례이므로 새로운 위반은 아니지만(예: 생성자 파라미터에 인라인 주석을 다는 관례가 이미 파일 상단에 다수 존재), 같은 커밋에서 3곳 중 1곳만 다른 스타일을 택해 한 눈에 훑기가 약간 어렵다.
  - 제안: 선택 사항 — 굳이 통일하지 않아도 무방하나, 다음 라운드에 손댈 때 한쪽(예: `@param`)으로 맞추면 좋음.

- **[INFO]** opts 필드명이 계층 경계마다 `retryReentry` / `allowRetryReentry` 로 갈림 (이번 diff 신규 아님, 기존 패턴 확장)
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:220` (`processAiResumeTurn`, `opts?: { retryReentry?: boolean }` — 이번 diff 이전부터 존재) → `:442` (`reparkAiResumeTurn`, 동일 필드명 신규 채택) → `:457` 에서 `{ allowRetryReentry: true }` 로 변환해 `codebase/backend/src/modules/execution-engine/state/state-machine.ts:57` (`TransitionOptions.allowRetryReentry`) 의 이름 체계로 갈아탐
  - 상세: orchestrator 계층은 `retryReentry`, state-machine/engine 계층은 `allowRetryReentry` 를 쓴다. 이번 diff 가 새로 만든 불일치는 아니고(`processAiResumeTurn`/`finalizeAiNode` 의 `retryReentry` 필드는 이전 라운드부터 있었음) 그 기존 패턴을 `reparkAiResumeTurn` 에도 동일하게 확장한 것뿐이라, 국소적으로는 일관성 있는 선택이다. 다만 경계마다 이름이 바뀌는 현상 자체는 다음에 이 흐름을 처음 읽는 사람에게 약간의 인지 비용을 준다.
  - 제안: 즉시 수정 불필요 — 후속 리팩터링 때 계층 간 이름을 통일하는 옵션 정도로 백로그에 남겨둘 만함.

## 요약

리뷰 대상 diff(state-machine.ts / execution-engine.service.ts / ai-turn-orchestrator.service.ts / engine-driver.interface.ts)는 전반적으로 가독성이 높고 네이밍이 목적을 잘 드러내며, 새로 추가된 로직(FAILED→WAITING_FOR_INPUT opt-in 확장, 3번째 DB 가드 소비처에 opts 전파) 각각은 짧고 함수 길이·중첩 깊이·순환 복잡도 모두 낮다. 매직 넘버는 없고, 기존 코드베이스의 두터운 "ai-review CRITICAL/WARNING #N (날짜)" 인라인 문서화 관례·opts 를 마지막 optional 파라미터로 두는 시그니처 관례·파라미터 목록 안 인라인 주석 관례를 일관되게 따른다. 다만 이번 수정이 "opt-in 플래그를 새 소비처로 전파"하는 작업이었던 만큼, 그 전파 로직 자체(`allowRetryReentry ? {...} : undefined` 류 삼항식)가 두 파일에 걸쳐 2회+4회 손으로 복제되는 패턴이 남았다 — 이는 정확히 이번에 고친 결함(opts 배선 누락)과 같은 실수 클래스를 다음 확장 시점에 다시 열어둘 수 있는 지점이라 WARNING 2건으로 기록한다. 둘 다 기능적 결함이 아니라 향후 유지보수 편의를 위한 소규모 추출(헬퍼 1~2개) 제안이다.

## 위험도
LOW
