# Cross-Spec 일관성 검토 — `spec/5-system/` (EIA masking followups, impl-done)

## 발견사항

- **[CRITICAL] WS 라이브 이벤트의 `input` 값-마스킹이 2초마다 REST 폴링에 의해 되돌려진다 — "boundary masking parity" 무효화**
  - target 위치: `spec/5-system/6-websocket-protocol.md` §4.1 새 캐비엇 — "emit 의 `input` 은 마스킹하는데 REST `inputData` 는 안 하는 이유"(2026-08-17) 단락. 핵심 주장: *"WS node 이벤트의 `input` 은 어떤 소비자도 재제출하지 않는다(실측) — 표시 전용이라 마스킹해도 데이터가 오염되지 않는다."*
  - 충돌 대상:
    - `spec/5-system/14-external-interaction-api.md` §R17 잔여 ② — `NodeExecution.inputData`(REST)는 의도적으로 값-패턴 마스킹 **비대상**.
    - `spec/1-data-model.md` §2.14 NodeExecution `input_data` 행 — 마스킹 캐비엇 없음(자매 `output_data` 행에는 이번 diff 로 마스킹 캐비엇이 붙었으나 `input_data` 는 그대로).
    - `spec/3-workflow-editor/3-execution.md` §10.6.1 Input 탭 정의 — "노드에 전달된 inputData를 JSON 뷰어로 표시. 폴링으로 데이터 수신 전에는 'Loading...' 표시"(REST 폴링과 라이브 값이 **같은 값**이라는 전제로 서술되어 있고, 마스킹 유무 차이를 언급하지 않음).
    - 실제 코드(HEAD 워킹트리):
      - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:5936` (`NODE_STARTED` emit `input: nodeInput`, 주석: *"so the frontend can show input data on the detail panel without a separate REST refetch"*) 및 `:6121`(`NODE_COMPLETED` emit `input: nodeExecution.inputData`) — 이 `input` 은 `WebsocketService.maskWireEnvelope`(`deepRedactSecretsPreserving`, 이번 diff 신설)를 지나 **값-패턴 마스킹된다**(wire·fanout 공통, `websocket.service.spec.ts` "① emitNodeEvent — fanout 은 error 값 안의 토큰을 마스킹" 테스트가 `input` 도 함께 고정).
      - `codebase/backend/src/modules/executions/executions.service.ts` `toResponseExecution`/`findById` 의 `nodeExecutions[]` map — `outputData`/`error` 만 `maskIfPresent` 로 마스킹하고 **`inputData` 는 원문 그대로** REST 로 나간다(`executions.service.spec.ts` "⑤ findById — nodeExecutions[].outputData 도 마스킹" 테스트가 `expect(ne).toContain('admin:pw')` 로 이를 명시적으로 고정).
      - 프런트: `codebase/frontend/src/lib/websocket/use-execution-events.ts:744,794,887,992` — `node.started`/`node.completed`/`node.failed`/`node.cancelled` 수신 시 `inputData: payload.input`(**마스킹된 WS 값**)을 노드 결과 store 에 기록.
      - `codebase/frontend/src/lib/websocket/apply-execution-snapshot.ts:102` — `execution.nodeExecutions[]`(REST) 로부터 `inputData: ne.inputData`(**원문 REST 값**)를 **같은 store 슬롯**에 기록.
      - `codebase/frontend/src/app/(main)/w/[slug]/workflows/[id]/executions/[executionId]/page.tsx:109-151` — `executionQuery` 가 실행이 mid-flight(`running`/`waiting_for_input`) 인 동안 **2초 간격 `refetchInterval`** 로 `GET /api/executions/:id` 를 재폴링하고, 그 결과를 매번 `applyExecutionSnapshot()` 으로 같은 store 에 재적용한다. 바로 이 자리의 기존 주석이 *"WS 가 정상 동작하면 양쪽이 동일 state 를 set (idempotent)"* 라고 명시하는데, 이번 PR 이 WS 쪽만 마스킹하면서 그 전제가 깨졌다.
      - 소비 측: `codebase/frontend/src/components/editor/run-results/result-detail.tsx:336-337` 이 이 store 슬롯의 `result.inputData` 를 그대로 "Input" 탭에 렌더링.
  - 상세: `NodeExecution.inputData`(노드 하나의 입력값)는 REST 응답과 WS 라이브 이벤트 두 경로로 **완전히 동일한 프런트 store 필드**(`nodeResults[...].inputData`, Run Results 드로어 "Input" 탭)에 기록된다. 이번 PR 은 WS 쪽(`node.started`/`node.completed`/`node.failed`/`node.cancelled` payload 의 `input`)에는 값-패턴 마스킹을 새로 걸었지만, REST 쪽(`nodeExecutions[].inputData`)은 §R17 잔여 ②의 "재제출 위험" 논리를 근거로 의도적으로 비대상으로 남겼다. 그런데 그 "재제출 위험" 근거는 **Execution 레벨** `inputData`(Re-run 모달·에디터 "히스토리에서 불러오기")에 대한 것이지, **NodeExecution 레벨** `inputData`(이 표면)에 대한 것이 아니다 — NodeExecution.inputData 는 어떤 재제출 흐름에도 쓰이지 않는다(Re-run 은 `original.inputData`, 즉 Execution 레벨만 읽는다). 실행이 진행 중인 동안 프런트는 2초마다 REST 를 재폴링해 이 store 를 **원문 값으로 덮어쓰므로**, 사용자가 보는 "Input" 탭 값은 WS 이벤트 도달 순간에는 `***` 로 마스킹됐다가 그 다음 폴링 tick(≤2초 후)에 원문으로 되돌아가는 **flip-flop** 을 반복한다. 즉 이 PR 이 명시적으로 세우려던 "boundary masking parity"(뷰어 인구는 항상 마스킹된 값만 본다) 불변식이, 정작 이 값을 가장 많이 노출하는 표면(에디터 Run Results 드로어의 실시간 진행 중 실행)에서 사실상 무효화된다 — 마스킹이 "지속적"이 아니라 "다음 폴링까지"만 유효하다.
  - 제안: 다음 중 하나로 두 표면을 일치시킬 것.
    1. `NodeExecution.inputData` 도 REST 응답에서 동일하게 값-패턴 마스킹(`redactStoredDataForResponse`) — `MASKED_INPUT_DATA_REASON` 의 재제출 근거는 Execution 레벨에만 적용되고 NodeExecution 레벨엔 재제출 소비처가 없으므로 회귀 없이 적용 가능해 보인다(재확인 필요).
    2. 반대로 WS `node.*` emit 의 `input` 필드에서만 마스킹을 제외(REST 와 계약 일치) — 이 경우 §4.1 의 "output/input(node.completed)" 예시에서 `input` 을 제거하고 새 캐비엇 문단을 수정.
    어느 쪽이든 `spec/3-workflow-editor/3-execution.md` §10.6.1 Input 탭 정의에 "REST 폴링 값과 WS 라이브 값의 마스킹 정책이 다를 수 있다"는 캐비엇을 반드시 동반해야 하며, 결정 이후 `spec/1-data-model.md` §2.14 `input_data` 행에도 자매 `output_data` 행과 대칭되는 마스킹/비마스킹 각주를 추가할 것.

- **[INFO] WS §4 이벤트 표의 `execution.node.completed` 필드 목록이 §4.1 마스킹 캐비엇이 실제로 참조하는 `input` 필드를 누락**
  - target 위치: `spec/5-system/6-websocket-protocol.md` §4 이벤트 목록 표 — `execution.node.completed | { executionId, nodeId, nodeExecutionId, nodeLabel, output, duration }` 및 형제 3행(`started`/`failed`/`skipped`).
  - 충돌 대상: 같은 파일 §4.1 새 캐비엇("아래 열거는 대표 예시다: `error`(node.failed) · `output`/`input`(node.completed) · `message`(ai_message)") + 실제 코드(`execution-engine.service.ts` 의 `input`/`parentNodeExecutionId`/`status`/`startedAt`/`finishedAt` 등 표에 없는 추가 필드 다수, PR 이전부터 존재).
  - 상세: `spec/3-workflow-editor/3-execution.md` §8.1 은 이미 "이 표의 데이터 열은 예시일 뿐 계약이 아니다. SoT 는 WS §4.1" 이라고 명시적으로 비-정본 처리해 두었으므로 그쪽과의 충돌은 없으나, 정작 SoT 로 지목된 `6-websocket-protocol.md` §4 표 자체가 이번에 새로 의존하기 시작한 `input` 필드를 여전히 닫힌 목록으로 선언하지 않고 있다. PR 범위 밖의 선재 갭이지만, 이번 캐비엇 추가로 그 갭이 처음으로 "이 필드가 마스킹된다"는 구체 주장의 근거로 소비되기 시작했다.
  - 제안: §4 표의 `execution.node.*` 4행을 다른 종결 이벤트 행들처럼 `…필드 집합` 형태로 열어 두거나, `input`/`parentNodeExecutionId`/`status`/`startedAt`/`finishedAt` 을 명시적으로 추가.

## 요약

이번 diff 는 `spec/5-system/` 6개 문서 + `spec/1-data-model.md` + `spec/conventions/node-output.md` 에 걸쳐 EIA/WS/webhook/replay-rerun 마스킹 계약을 정합화하는 다회차 후속 작업의 마지막 라운드로, 문서 간 표면 개수·용어(`nodeName`→`nodeLabel`)·강제 캐비엇은 대부분 서로 잘 맞물려 있고 이전 라운드에서 지적된 `inputData` 재제출 오염 CRITICAL 도 올바르게 되돌려져 있다. 그러나 이번에 새로 도입한 "WS `node.*` emit 의 `input` 값-패턴 마스킹" 결정이 기존에 확립된 "REST `NodeExecution.inputData` 는 비마스킹" 결정과 **같은 프런트 store 슬롯**(Run Results 드로어 Input 탭)에서 충돌한다 — 두 표면 모두 spec 상 "의도된 설계"로 서술돼 있지만, 실제 코드를 추적하면 mid-flight 실행에서 2초 주기 REST 폴링이 WS 마스킹을 반복적으로 무효화해 "boundary masking parity" 라는 이번 작업의 핵심 보안 불변식이 정작 가장 많이 쓰이는 실시간 실행 화면에서 지속되지 않는다. 이는 spec 문서 두 곳(WS §4.1 · EIA §R17)의 개별적으로는 합리적인 결정이 프런트 데이터 흐름에서 만나며 생기는 전형적인 cross-spec 데이터 모델 충돌이며, impl-done 모드로 실제 코드(`use-execution-events.ts`/`apply-execution-snapshot.ts`/실행 상세 page.tsx 의 REST→store bridge)를 대조해 확인했다.

## 위험도

HIGH
