# Cross-Spec 일관성 검토 — `spec/5-system/` (SSE nodeOutput allowlist 확장, impl-done)

## 발견사항

- **[CRITICAL]** SSE/fanout `nodeOutput` allowlist가 `execution.node.completed`의 `output` 필드를 커버하지 않음 — "REST와 SSE는 같은 강도" 주장이 문서 내부 모순
  - target 위치:
    - `spec/5-system/14-external-interaction-api.md` §R17 표의 "SSE/fanout emit (`toFanoutEnvelope`)" 행 — "**fail-closed allowlist**... 같은 `nodeOutput` 이니 같은 강도여야 한다" / "**REST 와 SSE 는 같은 강도다.**"
    - `spec/5-system/6-websocket-protocol.md` §4.4 blockquote 신규 문구 — "외부로 나가는 clone 에만 fail-closed allowlist 가 걸려 엔진 내부 필드(`_retryState` 등)가 제거된다"
    - (동반) `CHANGELOG.md` — "**REST 와 SSE 의 강도는 같다.**", `plan/complete/sse-nodeoutput-allowlist.md` 위치 표(`form waiting → envelope.nodeOutput` / `buttons waiting → envelope.buttonConfig.nodeOutput`만 나열)
  - 충돌 대상: **같은 문서 영역의 기존(비수정) 내용**
    - `spec/5-system/6-websocket-protocol.md` §4.1 표, `execution.node.completed` 행: `payload = { executionId, nodeId, nodeExecutionId, nodeLabel, output, duration }`, `output` 은 `NodeHandlerOutput` 의 `output` 필드이며 "`output.error` 가 set 된 경우(예: AI Agent multi-turn 의 `port: 'error'` 종결)도 포함"이라고 명시.
    - `spec/5-system/14-external-interaction-api.md` §5.2 (SSE 이벤트 스트림) — `execution.node.completed` 를 SSE 표면에 노출되는 이벤트 종류로 명시 열거하고, "**모든 비차단 노드에 대한 디버깅 firehose**"이며 "**chat-channel adapter 는 종전대로 `execution.node.completed` 를 픽업**(§15 CCH-AD-07)"이라고 서술.
  - 상세: 코드(HEAD 워크트리, 절대경로로 확인)를 추적하면 `_retryState`(이 PR의 Rationale이 반복 인용하는, 이 취약점의 "현존 사례")는 `execution.node.completed`(=`NODE_COMPLETED`) emit 시 **`output: nodeExecution.outputData`** 로 실린다 — 4개 emit 사이트 전부 동일:
    - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:6112` 부근
    - `codebase/backend/src/modules/execution-engine/button-interaction.service.ts:573`
    - `codebase/backend/src/modules/execution-engine/form-interaction.service.ts:336`
    - `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:1628`

    이 필드명은 `output` 이며 `nodeOutput` 이 **아니다**. `emitExecutionEvent`(envelope flat-merge)를 거치면 최종 fanout envelope 은 `envelope.output` 이 된다. 그런데 이번 PR이 신설한 `allowlistFanoutNodeOutput`(`codebase/backend/src/modules/websocket/websocket.service.ts`)은 오직 두 자리만 검사한다:
    ```ts
    const top = envelope.nodeOutput;                    // ← execution.waiting_for_input 전용
    const bc = envelope.buttonConfig;                    // ← buttons waiting 전용
    if (bc ...) { const inner = bc.nodeOutput; ... }
    ```
    `envelope.output`(=`NODE_COMPLETED`가 나르는 `NodeHandlerOutput` 전체, `_retryState` 포함 가능)은 **전혀 검사되지 않는다**. `stripExternalOnlyFields`(deny-list, `llmCalls` 한 칸)도 `_retryState`를 걸러내지 않는다(이름이 다름). 결과적으로 AI Agent multi-turn이 retryable error로 `port: 'error'` 종결되면(§4.1이 명시하는 정확히 그 시나리오), `_retryState`가 **SSE 스트림(§5.2가 명시적으로 노출을 인정하는 표면)과 chat-channel dispatcher(둘 다 동일 `WebsocketService.executionEvents$`/`toFanoutEnvelope` fanout을 구독— `sse-adapter.service.ts`, `chat-channel.dispatcher.ts`)로 완전히 무필터 상태로 유출된다.**

    새로 추가된 캐너리 테스트(`websocket.service.spec.ts`, `node-output-allowlist.spec.ts`)와 chat-channel 렌더 보존 테스트는 전부 `ExecutionEventType.EXECUTION_WAITING_FOR_INPUT` + 필드명 `nodeOutput` shape만 검증한다 — `NodeEventType.NODE_COMPLETED` + 필드명 `output` shape는 한 번도 실행되지 않는다. `plan/complete/sse-nodeoutput-allowlist.md`의 "payload 는 envelope 에 평평하게 펼쳐진다... 그래서 위치가 REST 와 정확히 같다"는 표에도 `execution.node.completed`가 세 번째 위치로 등재되지 않았고, 직전 코드 리뷰(`review/code/2026/08/23/23_16_40/security.md`)도 "제3의 위치는 실측상 없다"고 명시적으로 결론 내렸는데 — 이는 §4.1/§5.2가 이미 문서화한 `execution.node.completed` 표면을 검토 대상에서 놓친 오판으로 보인다.

    즉 target 문서가 반복 주장하는 "REST 와 SSE 는 같은 강도다"는, **target 이 속한 같은 영역의 다른(비수정) spec 내용(§4.1 표·§5.2 SSE 카탈로그)과 정면으로 모순**된다 — SSE는 REST에 없는 per-node "firehose" 표면(`execution.node.completed`)을 추가로 갖고 있고, 그 표면은 이번 allowlist 확장이 닫지 않았다.
  - 제안:
    - (코드) `allowlistFanoutNodeOutput`에 세 번째 위치 — `NODE_COMPLETED`/`execution.message` 등 `output` 필드를 나르는 이벤트의 `envelope.output` — 를 추가로 좁히거나, 최소한 `envelope.output`이 `NodeHandlerOutput` shape일 때 `allowlistNodeOutputKeys`를 적용.
    - (spec) 수정 전까지 `spec/5-system/14-external-interaction-api.md` §R17의 "REST 와 SSE 는 같은 강도다" 서술과 `spec/5-system/6-websocket-protocol.md` §4.4의 "외부로 나가는 clone 에만... 엔진 내부 필드가 제거된다" 서술을 철회하고, `execution.node.completed`의 `output` 필드가 잔여 갭임을 §R17 표에 재등재.
    - `plan/complete/sse-nodeoutput-allowlist.md`는 이미 complete로 마감됐으므로, 정본 트래커(`plan/in-progress/spec-sync-external-interaction-api-gaps.md`)에 새 항목으로 등재하거나 developer 턴으로 재오픈이 필요.

- **[INFO]** `plan/in-progress/spec-sync-external-interaction-api-gaps.md`의 "SSE/fanout 의 `nodeOutput` 은 여전히 fail-open deny-list 다" 항목이 `[x]`(해소)로 체크됐으나, 위 CRITICAL이 사실이면 이 체크는 시기상조다.
  - target 위치: 해당 plan 파일 diff (이번 PR이 `[ ]` → `[x]`로 변경)
  - 충돌 대상: 위 CRITICAL 항목과 동일 근거
  - 상세: plan_coherence 계열 사안이라 cross_spec의 직접 관할은 아니지만, 위 CRITICAL이 유효하면 이 plan 체크박스도 함께 되돌려야 한다.
  - 제안: CRITICAL 처리 후 plan 체크박스 재조정.

## 요약

이번 diff는 REST `getStatus`와 SSE/fanout 사이의 `nodeOutput` 방어 강도 비대칭을 닫겠다고 주장하지만, 실제로 닫은 위치는 `execution.waiting_for_input` 이벤트가 나르는 `envelope.nodeOutput`/`envelope.buttonConfig.nodeOutput` 두 자리뿐이다. 같은 영역의 기존 spec(WS §4.1 표, EIA §5.2 SSE 카탈로그)이 이미 문서화하고 있는 세 번째 표면 — `execution.node.completed`가 나르는 `envelope.output`(AI Agent multi-turn retryable 종결 시 `_retryState` 포함 가능, SSE 스트림과 chat-channel dispatcher 양쪽에 그대로 fanout) — 은 이번 allowlist에 포함되지 않아 무필터 상태로 남았다. 그 결과 target이 EIA §R17·WS §4.4·CHANGELOG에서 반복 단언하는 "REST와 SSE는 같은 강도" 주장은 같은 영역의 다른 spec 내용과 직접 모순되며, 새로 추가된 테스트·직전 두 코드 리뷰 라운드 모두 이 표면을 검증하지 못해 문서의 잘못된 확신을 그대로 승인했다.

## 위험도

CRITICAL
