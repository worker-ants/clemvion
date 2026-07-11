# 테스트(Testing) 리뷰

## 발견사항

- **[WARNING]** `widget-state.test.ts` 의 "threadMessages 없는 WAITING" 케이스가 실제 프로덕션 dispatch 경로에서는 도달 불가능한 분기를 테스트함
  - 위치: `codebase/channel-web-chat/src/lib/widget-state.test.ts:358-363` (`it("threadMessages 없는 WAITING → 기존 messages 불변(표면만 갱신)"...)`)
  - 상세: `widgetReducer` 의 `WAITING` 케이스는 `action.threadMessages ? mergeMessages(...) : state.messages` 삼항으로 분기한다(`codebase/channel-web-chat/src/lib/widget-state.ts:134-136`). 그런데 `WAITING` 을 실제로 dispatch 하는 두 프로덕션 호출부(`use-widget.ts:148-154` SSE 경로, `use-widget.ts:225-241` getStatus seed 경로) 모두 예외 없이 `threadMessages: threadToMessages(conversationThread)` 를 채워 보낸다. `threadToMessages` 는 `if (!thread?.turns?.length) return [];` 로 **항상 배열(빈 배열 포함)을 반환**하며 `undefined` 를 반환하는 경로가 없다(`conversation.ts:50-51`). 따라서 실제로는 `action.threadMessages` 가 `undefined` 인 채로 `WAITING` 이 dispatch 되는 시나리오가 프로덕션에 존재하지 않고, `: state.messages` 분기는 사실상 도달 불가능한 방어 코드다. 테스트 코멘트("표면만 갱신")는 이것이 실사용 시나리오인 것처럼 서술하지만 실제로는 타입 레벨 optionality 만 검증한다.
  - 정작 실제로 흔히 발생하는 케이스 — `threadMessages=[]`(빈 스냅샷, 예: 신규 대화의 첫 `ai_conversation` waiting 이벤트로 `conversationThread` 에 turn 이 아직 없는 경우, local 도 아직 빈 상태) — 는 이 describe 블록에 없다. `mergeMessages([], [])` 는 `snapshot.length(0) >= local.length(0)` 이 참이라 **새 빈 배열 레퍼런스**를 반환하는데(`state.messages` 와 참조 불일치), 이는 test 1(빈 로컬+비어있지 않은 snapshot)과도, test 5(undefined)와도 다른 경로다.
  - 제안: `waiting(undefined)` 케이스를 유지하려면 코멘트를 "타입 레벨 방어 코드(현재 호출부에서는 도달 불가)"로 정정하고, 실제로 도달 가능한 `waiting([])`(빈 배열, local 도 빈 배열/비어있지 않은 배열 두 하위 케이스) 테스트를 추가한다.

- **[INFO]** `buttons`/`form` interactionType 복원 시 `threadMessages` 시드 여부는 여전히 미검증
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` "race fix: getStatus 가 buttons waiting 표면을 주면…" (기존 테스트, 미변경) vs 신규 "복원 통합" 테스트(`ai_conversation` 전용)
  - 상세: `parseWaitingForInput` 은 `interactionType` 과 무관하게 `conversationThread` 를 최상위에서 그대로 전달하므로(`eia-events.ts:36-53`), 실 백엔드에서는 이전 대화 히스토리가 있는 상태로 `buttons`/`form` waiting 이 도착하는 조합도 가능하다. plan 문서(`plan/in-progress/webchat-multiturn-restore-test.md`) 는 스코프를 ai_conversation 다중 turn 으로 의도적으로 좁혔으므로(carve-out), 결함이라기보다 잔여 갭으로 기록해 둘 가치가 있다.
  - 제안: 후속 plan 에 "buttons/form + 기존 threadMessages 시드" 케이스를 백로그로 남기거나, 현재 plan 배경 섹션에 명시적으로 out-of-scope 로 적어 추적 가능하게 한다(현재는 암묵적).

- **[INFO]** `mergeMessages` 함수 doc 코멘트와 실제 동작(전량 교체 vs 진짜 병합)의 불일치는 기존 소스에 있던 것으로, 이번 테스트가 실제 동작(길이 비교 기반 전량 채택/보존)을 정확히 고정함
  - 위치: `codebase/channel-web-chat/src/lib/widget-state.ts:181` (`/** thread snapshot 과 로컬 메시지를 합치되 중복(...)을 회피. */`)
  - 상세: 함수명·주석 모두 "병합(merge)"·"중복 회피" 를 암시하지만 실제 구현은 `snapshot.length >= local.length` 여부로 **양자택일**만 한다(인터리빙·중복 제거 로직 없음). 신규 테스트 5건은 이 실제 동작을 정확히 반영해 잘 고정했으나(코드 버그는 아님), 테스트 자체의 describe 제목("threadMessages 병합(mergeMessages, 복원 시드)")도 "병합" 이라는 표현을 그대로 차용해 함께 읽는 사람에게 실제로는 병합이 아니라 선택(selection) 이라는 점을 놓치게 할 수 있다.
  - 제안: 테스트 관점에서는 조치 불필요(코드 소스의 명명/주석 문제). 다만 코드 리뷰어에게 소스 주석 정정을 권고할 가치가 있다.

- **[INFO]** 새 통합 테스트("복원 통합")의 mock wire 형식이 실제 파서 계약과 정확히 일치함 — 긍정적 확인
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:387-448`
  - 상세: `context.conversationThread.turns[].source`(role 필드 없이 source 만) 형식이 `ConversationTurn`/`WaitingContext` 타입(`eia-types.ts:38-60,158-183`) 및 `roleOf`(`conversation.ts:42-46`, "명시 role 이 있으면 우선, 없으면 source 매핑" 로직)와 정확히 일치. `getStatus` 엔드포인트 매칭(`u.endsWith(".../executions/e1")`, GET 메서드 판별)도 `eia-client.ts:94-101` 의 실제 호출과 부합. mock 이 실제 동작과 괴리 없이 신뢰도 높게 구성됨.

## 요약

`widget-state.test.ts` 의 5개 신규 케이스는 이전까지 비공개·미검증이던 `mergeMessages` 의 4가지 길이 비교 분기(`>`, `<`, `==` 경계, 빈 local)를 참조 동일성까지 포함해 정확히 고정하고, mutation 관점에서도 `>=` 를 `>` 로 뒤집는 변이를 경계 테스트(test 3)가 즉시 잡아낼 만큼 촘촘하다. `use-widget-eager-start.test.ts` 의 신규 e2e-lite 통합 테스트는 저장 세션 복원 → `getStatus` 다중 turn 파싱 → `mergeMessages` → 렌더 상태까지의 전체 파이프라인을 실제 wire 계약과 정확히 일치하는 mock 으로 검증하며, 마커 strip·role 매핑·신규 webhook 미발사까지 한 번에 회귀 방지한다. 다만 `threadMessages` `undefined` 케이스는 실제 두 프로덕션 dispatch 호출부(`threadToMessages` 가 항상 배열을 반환) 관점에서 도달 불가능한 분기를 검증하는 반면, 정작 흔히 발생하는 "빈 배열 스냅샷" 조합은 커버되지 않아 테스트 커버리지 주장과 실제 프로덕션 코드 경로 사이에 미묘한 괴리가 있다. 전반적으로 테스트 격리(매 테스트 독립 fetch/EventSource stub, `afterEach` unstub, `sessionStorage.clear()`)와 가독성(한국어 주석으로 SoT·의도 명시)은 우수하다.

## 위험도

LOW
