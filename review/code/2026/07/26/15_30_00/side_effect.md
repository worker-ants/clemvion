# 부작용(Side Effect) Review — linear-cancel-mechanism (5R, W19 해소 검증)

## 방법론 메모

이번 라운드 `_prompts/side_effect.md` 의 diff 페이로드는 24개 파일 전부
`review/code/2026/07/26/{13_47_42,14_45_30}/*` — 즉 이전 두 라운드의 리뷰 산출물
(md/json)이 신규 커밋된 것뿐이고, 실제 프로덕션 코드 diff(W19/W20 수정 커밋)는
포함돼 있지 않다(리뷰 changeset 이 직전 검토 코드를 제외하는 기존 패턴과 동일 —
`feedback_review_changeset_excludes_prior_reviewed_code`). 오케스트레이터 지시대로
`codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 와
연관 소비자(frontend, chat-channel, notification-fanout, SSE)를 `Read`/`Grep` 으로
직접 열어 현재 HEAD 기준 실제 소스를 대조했다. 아래 위치 표기는 게이트 숫자가
아니라 **각 파일의 실제 줄 번호**(직접 확인)다.

## W19 재검증 결과 — (a) terminal 마감: 해소 확인

`execution-engine.service.ts` `executeNode` catch 블록, `ExecutionCancelledError`
분기(5822-5845행):

```ts
if (err instanceof ExecutionCancelledError) {
  nodeExecution.status = NodeExecutionStatus.CANCELLED;
  nodeExecution.finishedAt = new Date();
  nodeExecution.durationMs = ...
  await this.nodeExecutionRepository.save(nodeExecution);
  await this.eventEmitter.emitNode(executionId, node.id, NodeEventType.NODE_CANCELLED, {...});
  throw err;
}
```

직전 라운드(4R, `14_45_30/side_effect.md`)가 지적한 "`ParkReleaseSignal` 처럼 아무
저장·emit 없이 재throw"하던 결함은 완전히 해소됐다 — `isAbortError` 분기(5768-5796행)
와 대칭으로 `status=CANCELLED` + `finishedAt`/`durationMs` 계산 + `save()` (DB 반영이
emit 보다 먼저 완료) + `NODE_CANCELLED` emit 을 **모두 수행한 뒤** re-throw 한다.
회귀 테스트(`execution-engine.service.spec.ts:5745-5814`)도 옛 vacuous 단언
(`not.toBe(FAILED)`)을 `toBe(CANCELLED)` + `finishedAt instanceof Date` + `emitNodeEvent`
호출 양성 단언으로 강화했고, `executeImpl` 호출 1회(재시도 없음, W20과 정합)까지
확인한다. **더 이상 다루지 않는다.**

## (b) 신규 `NODE_CANCELLED` emit 이 만드는 부작용 — 없음 확인

- **중복 emit 없음**: `ExecutionCancelledError` 는 이 분기에서 잡힌 뒤 `throw err`
  로 상위(`workflow.handler.ts` → `executeNode` 호출 스택 → `runExecution`/
  `runNodeDispatchLoop`)로 전파되는데, 상위 catch 들은 전부 재throw 만 하고
  같은 `NodeExecution` row 에 대해 추가 save/emit 을 하지 않는다 — 직접 확인:
  - `workflow.handler.ts:195-197`(`if (err instanceof ExecutionCancelledError) throw err;`) — 아무 emit 없음.
  - `execution-engine.service.ts:7629-7631`(`runContainer` catch, W9) — `ExecutionCancelledError` 는 즉시 재throw, FAILED 마킹/emit 경로(7632행~)에 도달하지 않음. 이 분기는 컨테이너 자신의 row 를 다루므로 애초에 Sub-Workflow 노드 row 와 무관.
  - `executeWithRetry` 재시도 제외(W20, `:6187`) — `ExecutionCancelledError` 는 재시도 루프를 다시 돌지 않으므로 `executeNode` catch 진입 자체가 1회로 유계.
- **구독자 영향 없음**: `emitNode`→`websocketService.emitNodeEvent`(`websocket.service.ts:529-560`)는 (1) wire broadcast, (2) `executionEventSubject` fanout 두 경로로 나가는데, 두 내부 구독자를 직접 확인했다.
  - `ChatChannelDispatcher.SUBSCRIBED_EVENTS`(`chat-channel.dispatcher.ts:28-39`)에 `execution.node.cancelled` 가 없다 — `handleEvent` 최상단 `if (!SUBSCRIBED_EVENTS.has(event.eventType)) return;`(`:94`)로 즉시 스킵. 태스크가 요청한 "chat-channel 어댑터 영향"은 **없다**(원천적으로 node-level cancelled 이벤트를 구독하지 않음 — 기존부터 `isAbortError` 분기도 동일하게 무시됐다).
  - `NotificationFanoutService.FANOUT_EVENTS`/`TERMINAL_EVENTS`(`notification-fanout.service.ts:17-29`)도 `execution.node.cancelled` 를 포함하지 않는다 — 토큰 revoke·outbound notification 어느 쪽도 트리거되지 않음.
  - `SseAdapterService`(`sse-adapter.service.ts:66`)는 `executionEvents$` 전체를 필터 없이 버퍼링·replay 하므로 이 이벤트도 SSE 버퍼에 들어가지만, 이는 `isAbortError` 분기가 이미 만들던 것과 동일한 이벤트 타입·shape 이 한 번 더 발생하는 것뿐이라 **신규 소비 로직 추가나 스키마 가정 변화가 아니다**.
  - frontend 유일한 실제 소비자 `use-execution-events.ts:941-983`(`handleNodeCancelled`) — 기존부터 `execution.node.cancelled` 를 구독 중이므로(이미 `isAbortError` 분기가 그 바인딩을 만듦) 새 리스너 등록이 필요 없다. `updateNodeStatus`(`execution-store.ts:570-575`)는 `Map.set` 으로 해당 nodeId 항목을 통째로 교체하므로(병합 아님) stale 필드가 섞일 위험도 없다.
- **순서**: `save()` → `emitNode()` → `throw err` 순서가 `isAbortError` 분기와 동일해 "DB 반영 후 알림" 불변식이 유지된다. 노드 레벨 이벤트는 항상 스택을 더 거슬러 올라가 발행되는 execution 레벨 `execution.cancelled`(`finalizeCancelledExecution` 경유)보다 **먼저** 나가는 구조 — 프론트가 execution-level cancelled 를 먼저 받고 그 뒤 특정 노드가 여전히 `running` 으로 보이는 순간이 생기지 않는다(child-before-parent 순서 보장, 이는 이번 diff 가 새로 만든 게 아니라 기존 `isAbortError` 패턴을 그대로 재사용해서 얻는 효과).

## (c) `error` 봉투 비대칭 — 의도된 설계, 소비자 영향 없음(INFO 1건)

`isAbortError` 분기는 `error: { code: 'AbortError', message: err.message }` 를
payload 에 싣고(`:5771,5787`), `ExecutionCancelledError` 분기는 `error` 키 자체를
아예 넣지 않는다(`:5833-5842`에 `error` 필드 없음) — 코드 주석(`:5819-5821`)이
"W15 의 노출 차단 취지 유지"라고 명시하듯 의도적이다(내부 message 에 executionId
가 포함되는 문제는 이전 라운드 security/side_effect 리뷰에서 이미 다뤄졌으므로
재론하지 않음).

소비자 영향을 직접 확인했다 — **문제 없음**:
- frontend `handleNodeCancelled`(`use-execution-events.ts:949,954-957`)의 타입은
  `error?: string | { message?: string }` 로 이미 optional 이고,
  `errorMessage = typeof payload.error === "string" ? payload.error : payload.error?.message;`
  는 `payload.error` 가 `undefined` 여도 옵셔널 체이닝으로 안전하게 `undefined` 를
  만든다 — throw/crash 없음. `updateNodeStatus`/`addNodeResult` 모두 `error: undefined`
  를 그대로 저장(교체)할 뿐 별도 분기 실패가 없다.
- 회귀 테스트(`execution-engine.service.spec.ts:5789-5798`)가 정확히 이 비대칭을
  "내부 message 가 payload 문자열에 등장하지 않는다"로 고정해 재발을 방지한다.

다만 **[INFO]** 아래 계약 문서 관점 관찰은 남긴다 — 코드 결함은 아니고 이번
side-effect 리뷰의 "인터페이스 변경" 관점에서 기록만 해 둔다:

- 위치: `spec/5-system/6-websocket-protocol.md:186`
- 상세: `execution.node.cancelled` 행이 `{ executionId, nodeId, nodeExecutionId, nodeLabel, error }` 를 payload shape 로, "노드 실행이 외부 `abortSignal` 로 중단됨(`error.name === 'AbortError'`)"·"생산자: Parallel `cancel-others-on-fail` / 사용자 cancel" 로 서술한다 — 이는 `isAbortError` 분기만 반영한 원래 정의다. 이번 W15/W19 로 §2.3 노드-경계 cancel 가드가 발생시키는 `ExecutionCancelledError`(Sub-Workflow 재귀 취소 등)도 같은 이벤트 타입의 **두 번째 생산자**가 됐고, 이 경로는 `error` 필드를 아예 싣지 않는다 — 문서가 명시한 payload shape·생산자 목록과 실제 구현이 어긋난다. 위에서 확인했듯 현재 실제 소비자(frontend, SSE passthrough)는 모두 `error` 부재를 안전하게 처리하므로 **런타임 영향은 없다**. 다만 향후 이 spec 문서만 보고 새 소비자(예: 외부 webhook, 별도 SSE 클라이언트)를 만들면 "cancelled 이벤트는 항상 `error.code==='AbortError'` 를 갖는다"고 오해할 수 있다.
- 제안: 필수 아님(런타임 무해) — 문서 갱신 시 `error` 를 optional 로, 생산자 목록에 "§2.3 노드-경계 cancel 가드(Sub-Workflow 등 협조적 취소)"를 추가하는 정정을 권장. 이 문서 동기화는 documentation reviewer 영역과 겹치므로 그쪽에서 이미 다루고 있다면 중복 조치 불요.

## 추가로 확인한 부수 관찰 (INFO, 신규 결함 아님)

- **[INFO]** `save()`/`emitNode()` await 가 예외를 던지면 원래의 `ExecutionCancelledError`(`err`)가 마스킹되고 `throw err;` 에 도달하지 못한 채 다른 예외가 대신 전파되는 구조적 특성이 `ExecutionCancelledError` 분기에도 그대로 적용된다.
  - 위치: `execution-engine.service.ts:5822-5845`(`ExecutionCancelledError` 분기 전체).
  - 상세: 이 패턴은 `isAbortError` 분기(`:5768-5796`)에 이미 존재하던 것과 완전히 동일한 구조(같은 `await` 순서, 같은 마스킹 가능성)이며, 이번 diff 가 새로 도입한 리스크가 아니라 기존에 검토·수용된 패턴을 두 번째 분기에도 대칭 적용한 것뿐이다. 다만 이 마스킹이 발생할 수 있는 표면(코드 경로 수)이 1개에서 2개로 늘었다는 점만 기록해 둔다 — 별도 조치를 요구하는 수준은 아니다(WS/DB 계층의 일시적 장애 시에만 발현되는 드문 경로이고, 두 분기 모두 동일한 위험 등급이므로 이번 결함 등급을 올리지 않음).

## 요약

W19(취소된 Sub-Workflow 노드가 영구 `running` 잔류 + terminal 이벤트 부재)는
`executeNode` 의 `ExecutionCancelledError` 분기가 `isAbortError` 분기와 대칭으로
`CANCELLED` 마킹 + `finishedAt`/`durationMs` + `NODE_CANCELLED` emit 을 수행하도록
고쳐져 **완전히 해소**됐다 — 회귀 테스트도 vacuous 하던 옛 단언을 양성 단언으로
교체해 재발 방지선을 확보했다. 이번 라운드에서 집중 검증한 (a)~(c) 전부 결과가
양호하다: (a) 노드는 실제로 CANCELLED terminal 상태로 마감된다. (b) 새로 발행되는
`NODE_CANCELLED` 는 기존 `isAbortError` 분기가 이미 등록해 둔 동일 이벤트 타입·
동일 구독자 집합을 재사용할 뿐이라 중복 emit·신규 구독자 영향·순서 역전이 전혀
없다 — 특히 `ChatChannelDispatcher`/`NotificationFanout` 은 애초에 `execution.node.*`
레벨 이벤트를 구독하지 않아(SUBSCRIBED_EVENTS/FANOUT_EVENTS 어디에도 없음) 이번
변경으로 영향받는 표면이 아예 없다. (c) `error` 봉투를 싣지 않는 비대칭은 W15 의
내부 message 노출 차단 취지를 유지하기 위한 의도된 선택이며, 유일한 실제 소비자
(frontend `handleNodeCancelled`)가 이미 `error` 를 optional 로 다루고 있어 소비자
영향이 없다. 다만 `spec/5-system/6-websocket-protocol.md:186` 의 WS 프로토콜 문서가
이 두 번째 생산자·`error` 필드 부재 케이스를 반영하지 못해 문서-구현 drift 가
있다는 점은 INFO 로 남긴다(런타임 무해, 문서 정합 관점).

## 위험도

NONE
