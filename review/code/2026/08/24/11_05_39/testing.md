STATUS=success testing review complete (target: node-output-envelope — websocket.service.ts allowlist 확장 + spec.ts 캐너리)
===REPORT_MARKDOWN_BELOW===
# 테스트(Testing) 리뷰 — `envelope.output` allowlist 확장 (`node-output-envelope`)

## 범위 확인

이번 diff 19개 파일 중 실제 코드/테스트 파일은 2개뿐이다:

- `codebase/backend/src/modules/websocket/websocket.service.ts` — `allowlistFanoutNodeOutput` 을
  `narrowTopLevelNodeOutput(envelope, key)` 헬퍼로 리팩터하고, `nodeOutput` 뿐 아니라 `output`
  키에도 같은 allowlist 를 건다(`execution.node.completed`/`.failed` 표면).
- `codebase/backend/src/modules/websocket/websocket.service.spec.ts` — `#1208` 이 남긴
  `[잔여]` 캐너리(`envelope.output` 은 아직 안 좁힌다)를 뒤집어 `[캐너리]` 로 전환하고,
  `nodeOutputCache` flat 폴백 shape 를 고정하는 `[잔여 고정]` 테스트를 신규 추가.

나머지 17개 파일은 CHANGELOG·plan·consistency 리뷰 산출물(review/consistency/**)이라 테스트
관점 분석 대상이 아니다.

## 직접 실행 확인

로컬에서 두 spec 파일을 직접 실행해 실측했다(테스트 존재만 읽지 않고 실제 GREEN 을 확인):

```
websocket.service.spec.ts        : Tests: 58 passed, 58 total
chat-channel.dispatcher.spec.ts  : Tests: 43 passed, 43 total
```

`plan/in-progress/node-output-envelope.md` 의 `## 작업` 체크리스트는 `TEST WORKFLOW 4단계 +
ratchet` 과 `/ai-review` 를 아직 `[ ]` 로 두고 있다 — 즉 이 diff 시점에는 lint/unit-전체/
build/e2e ratchet 4단계가 이 변경분에 대해 아직 공식적으로 돌지 않았다. 위 두 spec 파일의
직접 실행은 그 공백을 부분적으로만 메운다(unit 레벨 2개 파일).

## 발견사항

- **[INFO]** `output` 경로(신규)가 chat-channel 렌더 4키(`rendered`/`payload`/`title`/`nodeType`)
  보존을 직접 단언하지 않는다 — `nodeOutput` 경로로만 검증됨
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.spec.ts:882` (`it.each` 4키
    보존 캐너리, `emitExecutionEvent`+`nodeOutput` 경유) vs `:925` (신규 `output` 경로 캐너리,
    `output`/`config` 두 키만 대조군으로 단언)
  - 상세: `allowlistNodeOutputKeys` 는 두 호출부(`nodeOutput` 키, `output` 키)에서 같은 함수를
    공유하므로 논리적으로는 한쪽에서 검증하면 다른 쪽도 보장된다. 다만 plan 문서
    (`plan/in-progress/node-output-envelope.md` "chat-channel `node.completed` 소비 경로도
    같은 13키로 덮인다" 서술)가 명시적으로 주장하는 그 사실 자체를 `output` 경로에서 직접
    단언하는 테스트는 없다. 이 작업 계열이 반복해 겪은 실패 패턴(어느 객체를 재는지 착각 —
    `#1208` 의 버튼 재개 record 오인, 이번 PR 이 스스로 기록한 M2 예측 실패)을 고려하면,
    `it.each` 4키 캐너리를 `output`/`nodeOutput` 두 경로 모두에 대해 파라미터화해 돌리는 비용은
    낮고 회귀 감지력은 명확히 올라간다.
  - 제안: 기존 `it.each(['rendered', 'payload', 'title', 'nodeType'])` 블록을
    `[key, useOutputPath]` 형태로 확장하거나, `execution.node.completed`(`output` 키) 버전을
    하나 더 추가.

- **[INFO]** `nodeOutput` 과 `output` 이 한 envelope 에 동시에 존재하는 케이스 미검증
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:192-199`
    (`allowlistFanoutNodeOutput` — `let next = narrowTopLevelNodeOutput(envelope, 'nodeOutput'); next = narrowTopLevelNodeOutput(next, 'output');` 순차 호출)
  - 상세: 이번 PR 이 추가한 것은 정확히 이 두 번째 호출(`'output'`)이다. 두 키가 같은
    envelope 에 동시에 존재하는 실제 상황은 없어 보이지만(각 이벤트 타입이 한쪽만 쓴다),
    "순차 적용이 서로 간섭하지 않는다"(예: 첫 narrow 결과가 두 번째 호출에 올바르게
    전달되는지, `next` 대신 실수로 `envelope` 를 다시 넘기는 회귀)를 잡는 테스트는 없다.
    낮은 위험이지만, 이 함수가 이번에 처음으로 "같은 헬퍼를 두 키에 연쇄 적용"하는 형태가
    됐다는 점에서 언급해 둔다.
  - 제안: 필수는 아님 — 두 키가 실제로 공존하는 emit 사이트가 생기면 그때 추가.

- **[INFO]** `WebsocketService` 계층과 `ChatChannelDispatcher` 계층을 잇는 통합 테스트 부재
  (이번 PR 이 만든 갭 아님 — 기존 아키텍처, 참고용)
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts:648-696`
    (`toChatChannelEvent` 를 손-조립 `ExecutionChannelEvent` 픽스처로 직접 호출)
  - 상세: `chat-channel.dispatcher.spec.ts` 는 `WebsocketService.emitNodeEvent` 를 전혀 거치지
    않고 `payload.output` 을 직접 만든 픽스처로 `toChatChannelEvent` 를 부른다. 즉
    `websocket.service.ts` 의 allowlist 필터링과 `chat-channel` 소비 로직이 실제로 한 번도
    같은 테스트 안에서 연결되지 않는다 — 두 계층이 "같은 13키 목록에 합의한다"는 사실은
    `websocket.service.spec.ts` 의 chat-channel 4키 보존 캐너리(수동으로 실 사용처를 grep 해
    옮겨 적은 값)에만 의존한다. 직접 실행 결과 두 spec 파일 모두 GREEN(58/58, 43/43)이지만,
    이는 "서로 독립적으로 각자의 픽스처에 맞다"는 것만 증명하고 "실제 파이프라인을 통과한
    output 이 dispatcher 가 기대하는 shape 과 일치한다"는 것은 증명하지 않는다.
  - 제안: 이번 PR 범위는 아니다(기존 구조). 다만 이 계열 작업이 반복적으로 "같은 사실이
    여러 SoT 에 분산돼 한쪽만 갱신되는" 패턴을 겪어 온 점을 고려하면, 언젠가
    `emitNodeEvent` → `toChatChannelEvent` 를 한 e2e/통합 테스트로 잇는 캐너리 하나를 두는
    것이 이 클래스의 회귀를 구조적으로 막는다.

## 확인된 강점

- **뮤테이션 테스트로 자기 예측을 검증**(`plan/in-progress/node-output-envelope.md` M1~M3
  표) — 실행 전에 예측을 적고 실측과 대조하는 방식으로, M2(`nodeOutput` 제거)에서 예측(2건
  RED)과 실측(1건 RED)이 갈린 이유(chat-channel 4키 캐너리가 *보존*만 단언하는 단방향
  가드라 필터 전체 제거에는 반응하지 않음)까지 정확히 분석·기록했다. 이 프로젝트에서 반복
  강조되는 "GREEN 은 증거가 아니다"를 실제로 실천한 사례.
- **대조군(control-group) 패턴 일관 적용** — 신규 캐너리(`:925`, `:976`)가 제거 단언
  (`not.toHaveProperty`)과 보존 단언(`toEqual`)을 항상 짝으로 둔다. "통째로 날려서 통과하는
  구현"을 배제하는 이 저장소의 알려진 vacuous-test 함정을 정확히 겨냥한 설계.
- **내부 WS 불변 검증이 신규 테스트에도 이어짐** — `:954-960` 이 `gateway.broadcastToChannel`
  mock 호출 인자로 wire envelope 은 필터링 안 됐음을 매번 재확인한다(이 작업의 안전 조건).
- **테스트 격리** — `beforeEach` 에서 매번 새 `WebsocketService` 인스턴스 + fake allocator를
  생성(`:51-57`), 전역/모듈 상태 공유 없음. `gateway` mock 도 매 테스트 리셋.
- **JSDoc 이 "왜 이 값을 골랐는지"까지 기록** — 예: `_retryState` 를 고른 이유가 "가상의
  필드가 아니라 현존하는 fail-open 사례"라는 근거까지 테스트 코드 안에 남겨, 다음 사람이
  임의로 fixture 값을 바꿔도 되는지 판단할 수 있게 함.
- **회귀**: 기존 `[잔여]` 캐너리를 삭제가 아니라 "뒤집기"로 처리(JSDoc 의 사전 계약 이행) —
  테스트 이력이 문서 역할을 겸함. 파일 전체에서 `_retryState`/`잔여` 참조가 새 동작과
  모순 없이 일관됨을 grep 으로 확인.

## 요약

핵심 변경(웹소켓 fanout envelope 의 `envelope.output` 도 기존 13키 allowlist 로 좁히는 것)에
대응하는 테스트는 존재하며, 직접 실행으로 GREEN(58/58)을 확인했다. 제거/보존 대조군, 내부
WS 불변 검증, 그리고 무엇보다 뮤테이션 테스트로 스스로의 예측을 검증하고 오답까지 투명하게
기록한 방식은 이 저장소 평균보다 높은 테스트 엄밀성을 보여준다. 남은 갭은 전부 INFO 수준이다:
(1) 신규 `output` 경로에서 chat-channel 4키 보존을 직접 단언하는 테스트가 없고 `nodeOutput`
경로 검증에만 기댄다, (2) 두 키가 한 envelope 에 동시에 있는 경우 미검증, (3)
`WebsocketService` allowlist 와 `ChatChannelDispatcher` 소비 로직을 잇는 통합 테스트가
구조적으로 없다(이 PR 이 만든 갭이 아니라 기존 아키텍처). Critical/Warning 급 결함은
발견하지 못했다.

## 위험도

LOW
