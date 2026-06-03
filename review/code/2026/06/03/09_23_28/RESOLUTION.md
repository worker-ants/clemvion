# RESOLUTION — 09_23_28

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| C-1       | FALSE POSITIVE | (코드 수정 없음) | spec 갱신 commit 83d60340 에 이미 적용됨. `6-websocket-protocol.md:488` §4.4 note = strip-only, `14-external-interaction-api.md:541` §6.5 = "fanout seam 에서 제거", `15-chat-channel.md` CCH-MP-01 = strip 노트. `:963` 의 "open item" 문자열은 "직전 open item 을 확정·대체한다"는 의도된 supersede 문구. reviewer 가 spec-draft-*.md 의 "Before" 블록(옛 open-item 텍스트)을 현행 spec 으로 오인한 것. **spec 파일 수정 불필요 — 이미 올바름.** |
| W-1/W-4   | 코드 | a2e367d7 | `emitNodeEvent` fanout publish 직전 `stripExternalOnlyFields` 적용 (방어심층화). 현재 node 이벤트에 `llmCalls` 는 없으나 미래 누출 경로를 `emitExecutionEvent` 와 동일 패턴으로 차단. |
| W-2       | 테스트 | a2e367d7 | `chat-channel.dispatcher.spec.ts` 에 `toChatChannelEvent(execution.ai_message)` 가 `llmCalls` 를 `EiaAiMessageEvent` 에 포함하지 않음을 단언하는 회귀 테스트 2건 추가. |
| W-3       | 테스트 | a2e367d7 | `sse-adapter.service.spec.ts` 에 어댑터가 payload 를 변형 없이 passthrough 함을 검증하는 테스트 추가 + strip 커버리지 소재 주석 명시. strip 자체는 fanout seam(websocket.service)에서 일어나므로 sse-adapter 단독 strip 테스트는 배제, `websocket.service.spec.ts` 의 'llmCalls strip' describe 가 egress 대표. |
| W-5       | 리팩토링 | a2e367d7 | `nextFanoutEvent` / `collectFanoutEvents` 헬퍼를 `describe('WebsocketService')` 최상위 스코프로 이동 — 두 내부 describe 의 중복 정의 해소. |
| I-2/I-9   | 문서 | a2e367d7 | `EXTERNAL_STRIPPED_FIELDS` / `stripExternalOnlyFields` JSDoc 에 "top-level 필드만 strip" + "배열 확장 시 WS spec §4.4 와 EiaAiMessageEvent 주석 동반 갱신" 한 줄 추가. |

## TEST 결과

- lint  : 통과
- unit  : 통과 (40 passed)
- build : 통과
- e2e   : 통과 (143/143)

## 보류·후속 항목

없음. 모든 Critical/Warning/INFO 항목 처리 완료.
