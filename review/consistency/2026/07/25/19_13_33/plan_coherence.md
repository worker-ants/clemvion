# Plan 정합성 검토 — spec/conventions/ (--impl-prep)

## 발견사항

- **[CRITICAL]** 잔여 plan "Workflow 단위 timeout / graceful shutdown 의 노드 abort 통합" 항목이, 이미 구현·테스트된 `failed` 분류 계약과 target 문서 자신의 `cancelled` 분류 규칙을 정면 충돌시킨 채 미해결 상태로 남아있다
  - target 위치: `spec/conventions/node-cancellation.md` §5.1 ("`error.name === 'AbortError'` 인 throw 는 노드가 실패한 것이 아니라 중단된 것이므로 … `cancelled` 로 기록한다" — 예외 없는 일반 규칙) · §6 표 마지막 행 ("Workflow 단위 timeout / graceful shutdown 의 노드 abort" — 상태 `—`, "노드 abort 통합 미구현(Planned)")
  - 관련 plan: `plan/in-progress/node-cancellation-residual-signal-propagation.md` "잔여 항목" 4번째 불릿 — "Workflow 단위 timeout / graceful shutdown 의 노드 abort 통합 … 잔여는 진행 중 노드의 in-flight 외부 I/O 즉시 중단뿐"
  - 상세:
    - 이 항목을 문면 그대로("`abortSignal` 을 그래프/셧다운 경로에 연결") 구현하면, SIGTERM grace-timeout 또는 `EXECUTION_TIME_LIMIT_EXCEEDED` 로 진행 중 노드에 `abort()` 가 걸리고 핸들러가 `AbortError` 를 throw 하게 된다. node-cancellation.md §5.1 의 **일반 규칙**대로면 이 NodeExecution 은 `cancelled` 로 분류돼야 한다.
    - 그러나 `spec/5-system/4-execution-engine.md` §11(Graceful Shutdown, 이미 구현·`shutdown-state.service.spec.ts` 로 회귀 고정됨)은 "미완료 시: 해당 NodeExecution 을 **`failed` + `error.code='SERVER_INTERRUPTED'`** 로 마킹"이라고 **명시적으로, 예외 없이** 규정한다. `spec/1-data-model.md:473`·`spec/data-flow/3-execution.md:251,267,278,299` 의 상태 다이어그램도 전부 `running --> failed: SERVER_INTERRUPTED`(그리고 같은 문서에서 `EXECUTION_TIME_LIMIT_EXCEEDED` 도 동일하게 `failed`)로 고정돼 있고 `cancelled` 전이는 등장하지 않는다.
    - 실제 코드(`codebase/backend/src/modules/execution-engine/shutdown/shutdown-state.service.ts`)는 현재 `AbortController`/`abortSignal` 을 전혀 쓰지 않는다 — grace 경과 후 in-flight row 를 직접 SQL `UPDATE … SET status='failed', error={code:'SERVER_INTERRUPTED'} WHERE status='RUNNING'` 로 마킹할 뿐이다. 잔여 plan 항목대로 여기에 `abortSignal.abort()` 를 연결하면, 노드 핸들러가 던지는 `AbortError` 가 엔진의 표준 §5.1 경로를 타고 **별도로** `cancelled` 기록을 시도할 수 있어, `ShutdownStateService` 의 bulk `UPDATE`(=`failed`)와 **같은 row 를 서로 다른 최종 상태로 쓰려는 경합**이 생긴다. 어느 쪽이 이기든(가드 `WHERE status='RUNNING'` 때문에 먼저 쓰는 쪽이 이김) 결과가 타이밍에 좌우되는 비결정적 분류가 된다.
    - 이는 "구현하다 보니 자연히 정해지는" 세부사항이 아니라, **§11/§8 의 이미 합의·구현된 계약을 유지할지, 아니면 `cancelled` 로 재정의(→ `1-data-model.md`/`data-flow/3-execution.md` 상태 다이어그램·frontend status pill·Re-run 필터 등 cross-spec 파급)할지**를 정하는 선행 결정이다. 두 문서 어디에도 이 결정이 기록돼 있지 않다(engine spec Rationale "Durable Continuation & Graceful Shutdown" 절도 active-running under-count trade-off 만 다루고 이 분류 충돌은 언급 없음).
  - 제안: 착수 전 결정 필요 — (a) SIGTERM/timeout 유발 abort 는 §11/§8 기존 계약대로 `failed`+`SERVER_INTERRUPTED`/`EXECUTION_TIME_LIMIT_EXCEEDED` 를 유지하고 `abortSignal.abort()` 는 순수히 "외부 I/O 를 빨리 풀어주는" 부수 효과로만 쓰며 그로 인한 `AbortError` 가 §5.1 표준 분류 경로로 새지 않도록 격리한다 — 이 경우 §5.1 에 "단, 엔진/인프라가 유발한 shutdown·timeout abort 는 예외" 각주를 추가해야 한다, 또는 (b) 이 경로도 `cancelled` 로 통일하고 §11/§8/data-model/data-flow 의 기존 `failed` 서술·다이어그램·회귀 테스트(`shutdown-state.service.spec.ts`)를 함께 갱신한다. 결정 전에는 이 항목을 "구현 시작 가능한 단순 wiring" 으로 취급하지 말 것.

- **[WARNING]** 같은 파일(`shutdown-state.service.ts`)·같은 SIGTERM 흐름을 다루는 BLOCKED plan 과 교차 참조가 없음
  - target 위치: `plan/in-progress/node-cancellation-residual-signal-propagation.md` "잔여 항목" 4번째 불릿 및 "관련" 섹션
  - 관련 plan: `plan/in-progress/execution-engine-residual-gaps.md` G2 — "errorPolicy `continue` 분기 on SIGTERM interrupt (§11)" (BLOCKED, defer 확정 2026-07-03, 장애물: parallel-p2 errorPolicy schema 미노출·용어 불일치·cross-instance mid-execution 재개 인프라 부재)
  - 상세: G2 는 `shutdown-state.service.ts` 의 SIGTERM grace-timeout 처리(§11 항목4)에서 `errorPolicy='continue'` 인 노드를 다르게 다뤄야 한다는, 정확히 같은 코드 경로를 겨냥한 별도 BLOCKED 항목이다. node-cancellation 잔여 plan 은 이 파일에 abort 통합을 추가하려 하면서도 G2 의 존재·차단 사유를 언급하지 않는다. 두 plan 이 서로 모른 채 같은 파일을 각자 다른 시점에 건드리면, 어느 한쪽이 먼저 착수될 때 다른 쪽의 전제(예: G2 가 가정하는 "grace-timeout 마킹 로직의 현재 형태")를 깨뜨릴 수 있다.
  - 제안: 두 plan 문서의 "관련"/배경 섹션에 상호 포인터를 추가하거나, 최소한 node-cancellation 잔여 plan 착수 시 `execution-engine-residual-gaps.md` G2 상태를 재확인하도록 명시.

## 요약

target(`spec/conventions/node-cancellation.md`)과 이를 추적하는 `plan/in-progress/node-cancellation-residual-signal-propagation.md` 자체의 정합성(추적 plan 부재 문제, `partial` 상태 복귀 근거, RESOLUTION.md §C1 인용, best-effort 선례 인용 등)은 모두 사실관계가 맞고 stale 하지 않다. 다만 플랜이 남겨둔 6개 잔여 항목 중 "Workflow 단위 timeout / graceful shutdown 의 노드 abort 통합" 하나는, 문면상 단순 배선처럼 보이지만 실제로는 이미 구현·명세된 `failed`(SERVER_INTERRUPTED/EXECUTION_TIME_LIMIT_EXCEEDED) 상태 분류와 target 문서 자신의 `cancelled` 분류 규칙이 정면충돌하는 미해결 결정을 안고 있으며, 이 결정 없이 착수하면 비결정적 상태 기록(레이스)이나 조용한 spec 위반으로 이어질 수 있다. 추가로 같은 코드 영역을 겨냥한 BLOCKED plan(G2)과의 교차 참조 누락도 있다. 나머지 5개 잔여 항목(chat-channel/MakeShop/Cafe24 signal 전파, IE resume, 선형 경로 기전 규명)은 다른 in-progress plan 과의 충돌·중복 없이 정합하다.

## 위험도
HIGH
