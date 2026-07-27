# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** `AiTurnEngineDriver` 안에서 `assert*` 접두 메서드 두 개가 서로 다른 실패 계약을 가진다 — 하나는 throw, 하나는 조용히 `false` 반환
  - 위치: `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts:134`(`assertExecutionNotCancelled`), `:183`(`assertActiveExecutionAndSaveNodeExec`) — 구현부: `execution-engine.service.ts:7996`, `:8049`
  - 상세: 이 코드베이스에서 `assert*` 접두는 관례적으로 "조건 위반 시 throw" 를 뜻한다(`assertTransition`, `assertExecutionNotCancelled` 모두 `Promise<void>` + throw). 그런데 이번 PR 이 추가한 `assertActiveExecutionAndSaveNodeExec` 는 같은 접두를 쓰면서도 `Promise<boolean>` 을 반환하고 실패 시 throw 하지 않는다 — 검사 실패를 호출부가 반환값을 확인해야만 알 수 있다. 실제로 이 PR 이 고친 CRITICAL #1(`finalizeAiNode` RUNNING 유지 분기가 짝 전이 가드를 거치지 않고 조용히 진행되던 결함)이 바로 "assert 라는 이름을 보고 안전하다고 오인해 반환값을 확인하지 않는" 부류의 실수였다. 같은 인터페이스 안에 이름은 같은 패턴(`assert*`)이지만 계약이 갈리는 두 멤버가 공존하면, 다음 소비처(예: plan 에 이미 예고된 form/button 후속 PR)가 다시 같은 실수를 반복할 위험이 있다.
  - 제안: `assertActiveExecutionAndSaveNodeExec` 를 `checkActiveAndSaveNodeExec`/`tryLockActiveExecutionAndSave` 처럼 "non-throwing, bool 반환" 임을 이름으로 드러내거나, 반대로 호출부가 반환값을 안 쓰면 컴파일 경고가 나도록 리턴 타입을 branded 타입으로 감싸는 방안을 검토한다.

- **[WARNING]** `updateExecutionStatus` 의 두 분기(`linkedNodeExec` / else)에서 잠금 SQL 리터럴과 마무리 4줄이 그대로 중복된다 (이전 라운드 WARNING #6 로 이미 지적됐으나 코드 변경 없이 plan 으로만 이관된 상태 — 여전히 남아 있음)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — SQL: `:8055-8061`(`assertActiveExecutionAndSaveNodeExec`) vs `:8232-8239`(`updateExecutionStatus` linkedNodeExec 분기), 사실상 동일한 `SELECT id FROM execution WHERE id = $1 AND status IN (${NON_TERMINAL_STATUSES_SQL}) FOR UPDATE` 쿼리 문자열이 두 곳에 손으로 복제됨. 마무리 블록: `:8249-8254`(linkedNodeExec 분기 끝) vs `:8293-8298`(else 분기 끝) — `if (enteringRunning && persisted) { recordRunningSegmentStart(...) } emitTerminalExecutionMetrics(...); return persisted;` 패턴이 두 곳에 그대로 반복.
  - 상세: `RESOLUTION.md`(`review/code/2026/07/26/22_11_22`)는 이 항목(#6)을 "문서/plan 로만 닫음, 코드 변경 없음" 으로 명시적으로 defer 했다 — 즉 알려진 채로 남겨둔 결정이다. 다만 이번 라운드에서 `assertActiveExecutionAndSaveNodeExec` 가 신설되며 같은 잠금 SQL 이 세 번째(엄밀히는 별 메서드에서의 두 번째) 인스턴스로 재등장했다는 점은 새로 확인된 사실이다 — 동일 SQL 을 손으로 유지하는 지점이 하나 더 늘어, 향후 가드 조건(예: 컬럼 추가)이 바뀔 때 한쪽만 갱신되는 drift 위험이 커졌다.
  - 제안: `SELECT ... FOR UPDATE` 잠금 조회를 `private lockNonTerminalExecutionRow(manager, executionId): Promise<boolean>` 같은 사설 헬퍼로 추출해 두 소비처가 공유하게 한다. 마무리 블록도 별도 이슈로 이미 추적 중이니 추가 조치 불요 — 다만 이번에 새로 생긴 SQL 중복은 같은 헬퍼 추출로 함께 해소 가능하다는 점을 명시해 둔다.

- **[INFO]** `assertLinkedTransitionApplied` 의 `executionId` 파라미터가 이미 `context.executionId` 로 중복 보유된 값이고, 바로 옆 `phase` 와 같은 타입(`string`)이라 위치 교환 실수를 컴파일러가 잡아주지 못한다
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:360-381`(정의, 시그니처 `(shouldProceed, nodeExec, node, context, executionId, phase)`), 호출부 4곳: `:418`, `:520`, `:1476`, `:1495`
  - 상세: `context: ExecutionContext` 는 `node-handler.interface.ts:36` 에서 `executionId: string` 을 필수 필드로 이미 갖고 있다. 그런데 `assertLinkedTransitionApplied` 는 `context` 와 별도로 `executionId` 를 다섯 번째 위치 인자로 또 받는다 — 같은 값을 두 경로로 전달하는 셈이라 향후 호출부가 `context` 만 바뀌고 `executionId` 는 안 바뀐 값을 넘기는 실수가 가능하다. 게다가 바로 뒤 여섯 번째 인자 `phase` 도 `string` 이라, 두 인자를 실수로 바꿔 호출해도(예: 리팩터 중 인자 순서 오기) 타입체커가 잡지 못하고 런타임에만 드러난다(현재 4개 호출부는 순서가 모두 올바름 — 잠재적 위험이지 현재 버그는 아님).
  - 제안: `executionId` 파라미터를 제거하고 함수 내부에서 `context.executionId` 를 쓰거나(중복 인자 제거), 최소한 `phase` 를 마지막이 아니라 boolean 바로 다음처럼 타입이 겹치지 않는 위치로 재배치해 인접 string 인자 쌍을 없앤다.

- **[INFO]** `assertLinkedTransitionApplied` 4개 호출부의 `phase` 문자열이 서로 다른 표기 관례를 쓴다
  - 위치: `ai-turn-orchestrator.service.ts:424`(`'AI turn — re-park'`, em-dash 구분), `:526`(`'첫 AI turn park'`, 구분자 없음), `:1482`(`'AI turn 종료 처리(RUNNING 유지)'`), `:1501`(`'AI turn 종료 처리(RUNNING 재claim)'`, 괄호 표기)
  - 상세: 네 값 모두 `ExecutionCancelledError` 메시지("Execution ... cancelled during ${phase}")에 그대로 삽입되는데, 명명 스타일이 "영어 표현 + em-dash", "한글 접두사 그대로", "한글 서술 + 괄호"로 제각각이다. 기능에는 영향 없으나 로그/에러 메시지를 grep 하거나 새 소비처를 추가할 때 일관된 포맷이 없어 패턴을 예측하기 어렵다.
  - 제안: 하나의 표기 규칙(예: `AI turn — <상세>` 형태로 통일)으로 맞춘다. 사소한 항목이라 강제 조치는 아니다.

- **[INFO]** `engine-driver.interface.ts` JSDoc 의 정확한 멤버 개수 하드코딩이 이번 PR 안에서만 두 번째로 다시 stale 화됐다 (이전 라운드 INFO 로 이미 지적, 미조치 상태 유지)
  - 위치: `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts:36-43`
  - 상세: "12/7"(원 리팩터) → "14/9"(2라운드 fix) → "15/10"(3라운드, 본 diff) 로 이미 두 번 갱신됐다. 매 라운드 신규 멤버가 추가될 때마다 이 숫자를 손으로 맞추는 구조라 다음 멤버 추가 시 또 stale 화될 것이 거의 확실하다 — 직전 라운드 review 가 정확히 이 패턴을 지적했음에도(INFO #12, `review/code/2026/07/26/22_11_22/maintainability.md`) 숫자를 갱신하는 방식으로만 대응해 근본 구조는 그대로다.
  - 제안: 정확한 개수 대신 "멤버 추가/제거 시 `## Rationale` §C-1 수치도 함께 갱신" 같은 절차 문구로 대체하거나, 개수 자체를 서술에서 제거한다(이미 이전 라운드가 제안한 방향과 동일 — 신규 청구 아님, 반복 확인 차원).

- **[INFO]** `finalizeAiNode`/`updateExecutionStatus` 는 계속 커지는 다중 책임 함수로 남아 있다 (이전 라운드에서 구조적 리팩터가 "선택 사항" 으로 명시적으로 defer됨 — 신규 청구 아님)
  - 위치: `ai-turn-orchestrator.service.ts:1327-1531`(`finalizeAiNode`, 약 200줄, FAILED/RUNNING 유지/RUNNING 재claim 세 분기 + 이벤트 emit 을 모두 처리), `execution-engine.service.ts:8174-8299`(`updateExecutionStatus`, 약 125줄, `assertTransition`+시간추적+두 갈래 영속 전략+메트릭 emit 5가지 책임)
  - 상세: 이번 diff 가 두 함수 모두에 분기·트랜잭션을 추가로 얹어 순환 복잡도가 한 단계 더 올라갔다. 다만 유사한 구조적 리팩터 제안(`updateExecutionStatus` 대상)이 이미 `RESOLUTION.md`(21_08_01, Warning #4) 에서 "SUMMARY 권장사항 자체가 (선택) 표기" 로 명시적으로 조치 보류됐다 — 재청구하지 않는다.
  - 제안: 다음 리팩터 라운드 후보로 계속 등재 권고(신규 조치 요구 아님).

## 요약

핵심 신규 로직(`assertLinkedTransitionApplied` 추출, `NON_TERMINAL_STATUSES_SQL` 단일화, `markNodeCancelled`/`assertActiveExecutionAndSaveNodeExec` 재사용, 파라미터명 `shouldProceed` 개정)은 이전 리뷰 라운드의 유지보수성 지적을 충실히 반영했고, JSDoc 도 근거·소비 현황·재현 시나리오를 상세히 남겨 추적성이 좋다. 신규로 확인한 것은 `assert*` 명명 관례가 이번 PR 안에서 "throw" 계약과 "bool 반환" 계약으로 갈라진 지점(같은 PR 이 고친 버그 클래스와 동형이라 주의가 필요)과, `assertActiveExecutionAndSaveNodeExec` 신설로 잠금 SQL 이 한 곳 더 손으로 복제된 지점이다. 나머지(4줄 마무리 블록 중복, 멤버 수 하드코딩, 함수 비대화)는 이전 라운드가 이미 발견해 의도적으로 defer 한 항목들로 재확인 성격이며 신규 위험을 추가하지 않는다. 전반적으로 기능 위험도는 낮고 코드는 실무적으로 수용 가능한 수준이다.

## 위험도

LOW
