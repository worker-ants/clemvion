# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** 공유 헬퍼 `assertLinkedTransitionApplied` 의 첫 파라미터(`applied`)가 호출부마다 다른 의미로 재사용된다
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:347`(정의), `:1454-1461`(호출부)
  - 상세: `assertLinkedTransitionApplied(applied, nodeExec, node, context, executionId, phase)` 는 원래 `updateExecutionStatus`(짝 전이 choke point)의 반환값을 그대로 소비하도록 설계됐다 — re-park(`:405`)·첫 turn park(`:507`)·RUNNING 재claim(`:1476`) 세 호출부는 실제로 그 DB 호출의 boolean 반환값을 그대로 넘긴다. 그런데 `finalizeAiNode` 의 "RUNNING 유지" 분기(`:1446-1461`)는 `updateExecutionStatus` 자체를 호출하지 않으므로, `assertExecutionNotCancelled` 를 try/catch 로 감싸 얻은 `cancelledExternally` 플래그를 반전(`!cancelledExternally`)해 넘긴다. 같은 파라미터 이름(`applied`)이 "DB 전이가 실제로 반영됐다"는 의미와 "취소가 관측되지 않았다"는 의미 두 가지로 쓰이는 셈이라, 이 헬퍼를 새로 소비하려는 사람(예: 후속 form/button PR, plan 의 "후속(본 PR 밖)" 항목이 이미 이 재사용 필요성을 언급함)이 계약을 오해하기 쉽다.
  - 제안: 파라미터명을 의미 중립적으로(`shouldProceed`/`notCancelled`) 바꾸거나, JSDoc 에 "이 값은 `updateExecutionStatus` 반환값뿐 아니라 임의의 '전이 유효' boolean 이어도 된다" 는 계약을 명시한다.

- **[WARNING]** `updateExecutionStatus` 의 두 분기(`linkedNodeExec` / else)에 동일한 4줄 마무리 블록이 그대로 중복된다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8201-8205` vs `:8245-8249`
  - 상세: `if (enteringRunning && persisted) { this.recordRunningSegmentStart(execution.id); } this.emitTerminalExecutionMetrics(execution, newStatus, persisted); return persisted;` 패턴이 두 분기 끝에 문자 그대로 반복된다. 이번 PR(WARNING #9 대응)이 새로 추가한 코드라 리팩터 여지가 있는 시점에 중복이 그대로 이식됐다.
  - 제안: 두 분기 모두 `persisted` 만 계산하도록 하고, 공통 후처리(`if (enteringRunning && persisted) recordRunningSegmentStart(...); emitTerminalExecutionMetrics(...); return persisted;`)를 함수 끝의 단일 지점 또는 사설 헬퍼로 옮긴다. (참고: 이 함수 자체의 더 큰 구조적 리팩터는 이전 라운드 `Warning #4` 로 이미 제안됐고 "선택, 미조치" 로 명시적으로 defer 된 상태 — 본 항목은 그와 별개로 **이번 diff 가 새로 만든** 지역적 중복이다.)

- **[INFO]** `finalizeAiNode` 가 계속 커지는 다중 책임 함수로 남아 있다
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:1310-1511` (FAILED 분기·RUNNING 유지 분기·RUNNING 재claim 분기·이벤트 emit 을 한 함수가 모두 처리)
  - 상세: 이번 diff 는 RUNNING 유지 분기에 `assertExecutionNotCancelled` try/catch + `assertLinkedTransitionApplied` 호출(`:1446-1464`)을, else 분기에 반환값 소비(`:1465-1484`)를 추가해 이미 200줄 안팎이던 함수의 분기 수를 늘렸다. 순환 복잡도가 계속 누적되는 지점이다.
  - 제안: 신규 CRITICAL/WARNING 으로 청구하지는 않는다 — 유사한 구조적 리팩터 제안(`updateExecutionStatus` 대상, Warning #4)이 이미 이전 라운드에서 "선택 사항" 으로 의도적으로 defer 됐다. 다만 다음 리팩터 라운드 후보로 `finalizeAiNode` 자체(FAILED 분기 vs COMPLETED 분기 분리)도 함께 재검토할 것을 권고한다.

- **[INFO]** `updateExecutionStatus` 계약을 설명하는 JSDoc 이 두 파일에 거의 동일한 문장으로 중복 유지된다
  - 위치: `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts:44-58`, `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8112-8123`
  - 상세: `@returns` 설명("`false` 는 …no-op 된 경우…")이 인터페이스 선언부와 구현부 양쪽에 손으로 동기화돼 있다. 실제로 이번 PR 이 고친 대상이 바로 이 문서 쌍의 드리프트(한쪽엔 "linkedNodeExec 분기는 항상 true" 라는 stale 문구가 남아 있었음)였다 — 같은 실패 패턴이 재발할 수 있는 구조는 그대로 남는다.
  - 제안: 한쪽(예: 인터페이스)만 정본으로 삼고 구현부는 `{@inheritDoc}` 류 참조로 축약하거나, 최소한 "이 문서는 X 와 동기화해야 함" 주석을 상호 배치한다.

- **[INFO]** `engine-driver.interface.ts` 클래스 JSDoc 에 손으로 계산한 멤버 수(14/9)가 다시 하드코딩됐다
  - 위치: `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts:36-41`
  - 상세: "현재 멤버 수(2026-07-26 실측): distinct 14 … AiTurn 합계 9" 라는 문장은, 이번 PR 이 고치고 있는 바로 그 문제(이전 "12/7" 표기가 stale 이 됨)와 동일한 패턴을 재도입한다. 다음에 멤버가 하나 더 추가되면 이 문장도 다시 stale 이 된다.
  - 제안: 수치를 문서에 못박기보다 "이 인터페이스에 멤버를 추가/제거하면 `## Rationale` §C-1 수치도 함께 갱신할 것" 같은 절차 문구로 대체하거나, 최소한 날짜만 남기고 정확한 개수는 생략한다.

- **[INFO]** 신규 e2e 테스트가 자신이 명시한 "고정 sleep 금지" 컨벤션과 다르게 고정 `setTimeout` 대기를 쓴다
  - 위치: `codebase/backend/test/execution-park-resume.e2e-spec.ts:1215` (`await new Promise((r) => setTimeout(r, 2_500));`)
  - 상세: 같은 테스트의 JSDoc(`:1101-1104`)과 `stub.client.ts` 의 WARNING #6 주석은 "고정 sleep 으로 타이밍을 맞추지 않는다(`node-cancellation-propagation.e2e-spec.ts` 선례)" 를 명시적 설계 원칙으로 내세우면서도, turn 종료 처리 완료를 기다리는 단계(`(3)`)에서는 결국 `1200ms + 여유` 로 계산된 고정 `2_500`ms sleep 을 쓴다. "값이 안 바뀐다"를 검증하는 negative assertion 이라 완전한 polling 대체가 어렵다는 정황은 이해되나, 파일 스스로 내세운 컨벤션과 문면상 어긋난다.
  - 제안: 가능하면 `node_execution` 이 terminal 상태(`cancelled`)로 안정될 때까지 poll 한 뒤 일정 grace 기간만 고정 대기로 남기거나, 최소한 주석에 "이 지점만은 negative-assertion 특성상 고정 대기가 불가피하다"는 예외 사유를 명시해 컨벤션 언급과의 외견상 모순을 없앤다.

## 요약

핵심 로직(`assertLinkedTransitionApplied` 추출, `NON_TERMINAL_STATUSES_SQL` 단일화, `markNodeCancelled` 재사용)은 이전 리뷰 라운드의 유지보수성 지적(WARNING #7/#8)을 잘 반영해 중복을 줄이는 방향으로 정리됐고, JSDoc 도 대체로 근거·소비 현황을 상세히 남겨 향후 추적이 쉽다. 다만 이번 diff 가 새로 추가한 코드 안에서 (1) 공유 헬퍼의 파라미터 의미가 호출부마다 갈라지는 지점, (2) `updateExecutionStatus` 두 분기의 4줄 마무리 블록이 그대로 복제된 지점이 남아 있어 소폭의 추가 정리 여지가 있다. `finalizeAiNode`/`updateExecutionStatus` 의 구조적 리팩터는 이미 별도 라운드에서 의도적으로 defer 됐으므로 재청구하지 않았다. 전반적으로 기능 위험도는 낮고 실무적으로 수용 가능한 수준이다.

## 위험도

LOW
