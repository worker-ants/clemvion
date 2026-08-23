# RESOLUTION — `23_29_27` (`--impl-done`, BLOCK: YES)

CRITICAL 1 · WARNING 2. **전부 처리**했다. 단 CRITICAL 은 checker 가 제시한 처방과
**다른 방식**으로 닫았고, 그 이유가 이 문서의 핵심이다.

## CRITICAL 1 — 지적은 맞았고, 처방은 틀렸다

### 지적: 맞다 (실측 확인)

`execution.node.completed`/`.failed` 는 같은 `NodeExecution.outputData` 를 **`output`**
이라는 다른 키로 envelope 최상위에 싣는다. emit **5곳** — `execution-engine.service.ts` 2
(COMPLETED · FAILED) · `form-interaction` · `button-interaction` · `ai-turn-orchestrator` —
전부 `emitNode` → `emitNodeEvent` → `toFanoutEnvelope` 를 지난다. 이 PR 의 배선은
`nodeOutput` 두 자리만 봤으므로 **`_retryState` 는 여기로 여전히 나간다.**

따라서 이 PR 이 spec 에 쓴 *"REST 와 SSE 는 같은 강도다"* 는 **구현보다 넓은 보장**이었다.

**왜 놓쳤나 — 질문이 한 칸 좁았다.** *"`nodeOutput` 이 어디 있나"* 를 물었고, 물었어야 할
질문은 *"`NodeHandlerOutput` 이 어느 문으로 나가나"* 였다. 키 이름이 다르면 grep 이
침묵한다. 2라운드 리뷰의 testing INFO 12 가 *"`nodeOutput` 을 싣는 이벤트는
`emitExecutionEvent` 뿐이라 위험 낮음"* 이라 했고 나는 그대로 받았는데, **그 전제가
틀렸다** — `emitNodeEvent` 는 `nodeOutput` 이 아니라 `output` 을 싣는다.

### 처방: 그대로 하면 깨진다 (실측)

checker 는 *"`envelope.output` 에도 `allowlistNodeOutputKeys` 를 적용하라"* 고 했다.
**정본 구현에 넣어 확인**했다(재현 아님 — `dist/` 의 실제 함수 호출):

| 입력 | 결과 |
|---|---|
| presentation 핸들러 출력 `{config, output, meta, status, _retryState}` | `{config, output, meta, status}` — 의도대로 |
| **버튼 재개 record** `{type, buttonId, buttonLabel, clickedAt, selectedItem, nodeOutput, _selectedPort}` | **`{}`** |

버튼 재개 record 는 `button-interaction.service.ts:180` 이 `outputData` 에 저장하는 실제
shape 이고, 13키 중 **하나도** 안 맞는다. carousel+buttons 는 presentation 타입이라
chat-channel dispatcher 의 sub-filter(`PRESENTATION_NODE_TYPES`)도 통과하므로 **외부 발송이
통째로 빈다**. 즉 `envelope.output` 은 `NodeHandlerOutput` 하나가 아니라 **이종 payload** 이고,
이 표면은 **키 목록이 아니라 shape 판별이 먼저인 별건**이다.

### 그래서 한 것: 보장을 좁히고, 안 닫은 방향을 캐너리로 고정

반쯤 추측한 좁히기를 보안 경계에 넣지 않는다 — fail-open 을 **fail-broken** 으로 바꿀 뿐이다.

1. **spec §R17**: 표를 두 행으로 갈랐다(waiting 두 자리 = fail-closed / `node.*` 의
   `envelope.output` = 잔여). *"REST 와 SSE 는 같은 강도다"* 를 **취소선으로 남기고**
   정정 블록에 emit 5곳·`{}` 실측을 실었다. 정확한 서술은 **"waiting 표면은 같은 강도,
   node 이벤트 표면은 아직 아니다"** 다.
2. **WS §4.4**: *"`nodeOutput` 키 집합은 공유하지 않는다"* 를 `waiting_for_input` 한정으로
   좁히고, `execution.node.*` 의 `envelope.output` 은 대상이 아님을 명시.
3. **CHANGELOG**: 정정 블록을 같은 방향으로 좁혔다.
4. **정본 트래커**: 신규 항목으로 등재 — emit 5곳(다시 찾지 말 것), `{}` 실측, 그리고
   **착수 시 먼저 답할 질문**(`outputData` 가 취하는 shape 이 몇 가지이고 런타임
   휴리스틱 없이 판별 가능한가; 못 하면 넣지 말 것).
5. **캐너리**: `websocket.service.spec.ts` 의
   `[잔여] execution.node.* 의 envelope.output 은 아직 allowlist 를 지나지 않는다` 가
   **현 상태를 단언**한다(`_retryState` 가 **존재함**을 확인). 후속이 이 표면을 닫으면
   여기가 RED 가 되고, **그 단언을 뒤집는 것이 그 작업의 일부**다. 이렇게 두지 않으면
   갭이 아무 데도 안 남아 다음 사람이 "REST 와 같은 강도" 로 읽는다.

### 체크박스 처분

기존 항목은 `[x]` 를 유지하되 제목을 **"`waiting_for_input` 표면 한정"** 으로 좁혔다 —
그 표면은 실제로 닫혔기 때문이다. `node.*` 표면은 되돌리는 대신 **새 항목으로 분리**했다.
(checker INFO 1 이 *"코드 수정 완료 시 그대로 유지, 미수정 시 되돌림"* 이라 했는데, 실제
상황은 **부분 완료**라 제3의 처분이 정확하다.)

## WARNING 1 — `egress-masking.md` §2 파이프라인 순서 stale

`spec/conventions/**` 는 **planner 소관**이고 이 턴의 spec 편집 권한 밖이다(§R17·WS §4.4 는
이 작업의 `spec_impact` 로 이미 planner 턴을 거쳤지만 conventions 는 별개 문서다).
정본 트래커에 항목으로 등재했다 — §2 순서에 allowlist 단계를 넣거나 §3 실례 목록에 등재.

## WARNING 2 — 인접 plan 의 "SSE·fanout 은 잔여" 서술이 거짓이 됐다

`spec-draft-eia-62-waiting-payload.md` 의 해당 문장을 취소선으로 남기고 후속 각주를 달았다
(저장소 관례: 원문 보존 + 각주). 각주는 **"닫혔다" 가 아니라 "waiting 한정으로 닫혔고
`node.*` 은 새 항목으로 서 있다"** 라고 적었다 — 같은 실수를 각주에서 반복하지 않기 위해.

## INFO

- **#1** — 체크박스 처분은 위에 적었다(부분 완료 → 제목 축소 + 신규 항목 분리).
- **#2** (키 목록 3중화), **#3** (Principle 0 거리감), **#4** (`title` 동명) — 앞선 라운드에
  이미 등재·처분된 항목의 연장이거나 조치 불요.
