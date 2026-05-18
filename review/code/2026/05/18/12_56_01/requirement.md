# 요구사항(Requirement) 리뷰 결과

## 발견사항

### conversation-utils.ts — threadTurnsToConversationItems

- **[WARNING]** `ai_assistant` / `ai_tool` 의 `turnIndex` 폴백 로직이 spec 의도와 불일치
  - 위치: `conversation-utils.ts` 신규 코드 `case "ai_assistant"` / `case "ai_tool"` — `const turn0 = turnIndex || 1;`
  - 상세: spec §1.1 "turn counter 는 ai_user 에서만 증가"에 따르면 ai_assistant / ai_tool 은 직전 ai_user 의 turnIndex 를 그대로 상속해야 한다. 그런데 `turnIndex || 1` 은 turnIndex 가 0(아직 첫 번째 ai_user 발생 전)일 때 임의로 1 을 할당한다. 즉 conversation 이 ai_assistant 로 시작하는 edge case(또는 연속된 ai_assistant without preceding ai_user)에서 turnIndex 가 1 로 설정되어 있지 않은 ai_user 와 1:1 매핑이 깨진다. `messagesToConversationItems` 의 동일 패턴(`currentTurn || 1`)도 존재하지만 여기서는 신규 경로이므로 일관성·정합성이 더 중요하다.
  - 제안: `turnIndex === 0` 일 때는 0 을 그대로 유지하거나, 스펙에서 "첫 턴 이전 assistant 는 존재하지 않는다"는 전제를 문서화. 또는 `const turn0 = turnIndex;` 로 유지하고 렌더 레이어에서 0 처리.

- **[WARNING]** `presentation_user` interactionType 추론 로직에 `buttonId` 없이 `url` 만 있는 경우 누락
  - 위치: `conversation-utils.ts` `case "presentation_user"` 블록 (interactionType 추론 삼항식)
  - 상세: 추론 조건이 `(url in data AND buttonId in data) → button_continue` / `(buttonId in data) → button_click` / `else → form_submitted` 순서다. spec/conventions/node-output.md §4.5 의 button_continue shape 는 `{ buttonId, buttonLabel, url }` 이지만, 만약 레거시 데이터에서 `url` 만 있고 `buttonId` 가 없을 경우 form_submitted 로 잘못 분류된다. 이 조건은 사실상 "url 과 buttonId 가 동시에 존재" 여야 button_continue 이고, url 만 존재하면 처리 불가하다. 현재 spec 이 buttonId 를 필수로 요구하므로 이론상 정상이지만, 인퍼런스 로직 자체에 방어 주석이 없어 확장 시 오해 가능성이 있다.
  - 제안: 조건에 주석으로 "url + buttonId 동시 필요" 명시. 또는 `url` 만 있는 케이스도 button_continue 로 처리하는 폴백 추가.

- **[WARNING]** `threadTurnsToConversationItems` 의 unknown `source` 값에 대한 처리 없음
  - 위치: `conversation-utils.ts` `for (const turn of turns)` switch 문
  - 상세: switch 에 `default` 케이스가 없다. 백엔드가 새로운 source 값(예: 미래 `ai_tool_call` 분기 등)을 보내거나, 데이터 손상으로 source 가 정의되지 않은 값이면 해당 turn 이 조용히 무시된다. 기능적으로는 skip 이 safe-fail 이지만, 개발자가 의도한 skip 인지 명시되지 않아 디버깅 시 혼란.
  - 제안: `default` 케이스 추가. 최소한 `console.warn` 또는 타입 단언 exhaust check (`const _: never = turn.source`).

- **[INFO]** `stripInlineMarkers` 가 null 입력을 처리하지 않음
  - 위치: `conversation-utils.ts` `stripInlineMarkers` 함수 — 시그니처 `s: string | undefined`
  - 상세: 함수 시그니처는 `string | undefined` 만 허용하나, 런타임에서 `null` 이 들어올 경우(legacy DB 데이터 등) `!s` 체크가 null 도 처리하므로 "" 반환으로 안전하다. 단, TypeScript 타입에 null 이 포함되지 않아 호출자가 null 를 명시적으로 다뤄야 하는 상황에 컴파일 오류가 발생한다. `messagesToConversationItems` 에서 `msg.content ?? ""` 대신 `stripInlineMarkers(msg.content)` 로 교체되었는데, msg.content 가 null 일 수 있으면 타입 오류 가능.
  - 제안: 시그니처를 `s: string | undefined | null` 로 확장하거나 호출 지점에서 `?? undefined` 처리.

---

### conversation-inspector.tsx — PresentationCardBody / PresentationDetail / SummaryView

- **[WARNING]** `PresentationDetail` 과 SummaryView 내 isPresentation 블록에 중복된 interactionLabelKey 계산 로직
  - 위치: `conversation-inspector.tsx` `PresentationDetail` 컴포넌트(라인 ~285-290) 와 SummaryView `isPresentation` 블록(라인 ~365-370)
  - 상세: interactionLabelKey 를 결정하는 삼항식이 두 군데에 완전히 동일하게 복제되어 있다. 새 interactionType 이 추가될 때 양쪽을 동시에 수정해야 하는 유지보수 위험이 있다. 단순 DRY 위반이지만, 비즈니스 로직(i18n 키 매핑)이 분산되어 있어 요구사항 관점에서 일관성 깨질 가능성이 있다.
  - 제안: `getInteractionLabelKey(interactionType)` 헬퍼 함수로 추출해 단일 진실 적용.

- **[WARNING]** `PresentationCardBody` 에서 `form_submitted` 외 알 수 없는 interactionType 에 대한 fallthrough
  - 위치: `conversation-inspector.tsx` `PresentationCardBody` 함수 — `button_click`, `button_continue` 체크 후 나머지를 form_submitted 로 처리
  - 상세: `interactionType` 이 세 값 중 하나가 아닌 경우(타입 시스템이 방어하나 data cast 경로로 올 수 있음) 자동으로 form_submitted 렌더로 처리된다. 이때 `entries.length === 0` 이면 "(no fields)" 를 표시하고, entries 가 있으면 key-value 표를 표시한다. 기능적으로 safe-fail 이지만, 예상치 않은 interactionType 이 들어올 때 오해의 소지가 있다.
  - 제안: 나머지 분기에 `// fallback: treat as form_submitted (key-value table)` 주석 추가. 또는 exhaustive check.

- **[INFO]** `isPresentation` / `isSystem` 블록에서 `handleClick` / `handleKeyDown` 이 item-specific 이 아닌 클로저 참조
  - 위치: `conversation-inspector.tsx` SummaryView `isPresentation` 블록 — `onClick={handleClick}`, `onKeyDown={handleKeyDown}`
  - 상세: SummaryView 의 item 순회 내에서 `handleClick` 과 `handleKeyDown` 은 map 외부에서 정의된 함수다. 이 함수들이 현재 순회 중인 `item` 을 클로저로 캡처한다면 동작하지만, 함수 정의가 보이지 않아 `item`을 올바르게 참조하는지 확인 필요. isSystem 블록에는 onClick/onKeyDown 이 없어 비대칭이다.
  - 제안: handleClick/handleKeyDown 가 현재 item 을 캡처하는지 확인 후, 필요시 `() => handleClick(item)` 형태로 명시.

---

### use-execution-events.ts — threadTurns 분기

- **[CRITICAL]** threadTurns 가 있을 때 이미 store 에 messages 가 있는 경우 중복 덮어쓰기 위험
  - 위치: `use-execution-events.ts` 신규 분기 — `if (threadTurns && threadTurns.length > 0) { ... setConversationMessages(items); }`
  - 상세: 기존 fallback 경로(`else if (convConfig?.messages)`)는 `conversationMessages.length === 0` 조건으로 재연결 시 중복 방지를 명시하고 있다. 그러나 새 threadTurns 분기는 이 가드가 없다. WebSocket 재연결(reconnect) 또는 EXECUTION_WAITING_FOR_INPUT 이벤트가 재emit 될 때 threadTurns 가 있으면 항상 `setConversationMessages(items)` 가 호출되어 기존 사용자 입력 이후 누적된 메시지를 덮어쓸 수 있다. 실제로 spec 코멘트에 "re-emit on reconnect would otherwise duplicate" 라고 명시되어 있는데, threadTurns 경로는 이 케이스를 처리하지 않는다.
  - 제안: `const { conversationMessages } = useExecutionStore.getState(); if (conversationMessages.length === 0) { setConversationMessages(items); }` 와 같이 동일한 중복 방지 가드 추가. 또는 snapshot 의 `nextSeq` 를 기반으로 덮어쓸지 판단.

- **[WARNING]** `conversationThread.turns` 가 존재하지만 빈 배열인 경우와 필드 자체가 없는 경우의 의미가 혼용될 수 있음
  - 위치: `use-execution-events.ts` — `const threadTurns = payload.conversationThread?.turns;` / `if (threadTurns && threadTurns.length > 0)`
  - 상세: `turns` 가 빈 배열(`[]`)이면 `threadTurns.length > 0` 이 false 가 되어 fallback 경로로 흐른다. 이 경우 대화 기록이 없는 fresh conversation 인지, 아니면 `turns` 필드가 구현 안 된 구버전 백엔드인지 구분이 안 된다. 구버전 백엔드에서 `conversationThread` 는 아예 없을 것이므로 현재 `?.` 접근으로 처리되지만, 배열은 있는데 비어있는 케이스(`{ turns: [] }`)는 의도 불명확.
  - 제안: 코드 주석에 "빈 배열 = conversation 시작 직후 no turns yet, fallback 을 통해 convConfig.messages 도 비어있을 것이므로 초기화 안 함이 옳다" 라는 설명 추가.

---

### conversation-inspector.test.tsx — 테스트 요구사항 커버리지

- **[WARNING]** `button_continue` 케이스에서 `url` 이 비어있는 edge case 테스트 없음
  - 위치: `conversation-inspector.test.tsx` `button_continue` 테스트 케이스
  - 상세: `PresentationCardBody` 에서 `url = (data.url as string | undefined) ?? ""` 처리를 하므로 빈 문자열이 렌더되는데, 이 케이스(url 없는 button_continue)가 테스트되지 않아 regression 위험.
  - 제안: `data: { buttonId: "go", buttonLabel: "Open" }` (url 없음) 케이스 추가해 빈 url 렌더 확인.

- **[WARNING]** `form_submitted` 에서 중첩 object 값(`typeof v === "object"`)의 JSON.stringify 렌더를 검증하는 테스트 없음
  - 위치: `conversation-inspector.test.tsx` `form_submitted` 테스트 케이스 — 현재 `{ name: "Alice", age: 30 }` 의 primitive 값만 검증
  - 상세: `PresentationCardBody` 의 form_submitted 렌더링에서 `typeof v === "object"` 이면 `JSON.stringify(v)` 를 표시하는 로직이 있으나, 이 경로를 테스트하는 케이스가 없다.
  - 제안: `data: { items: [1, 2, 3] }` 처럼 중첩 값을 포함한 케이스 추가.

- **[INFO]** `system` 아이템 테스트가 SummaryView 의 인라인 렌더(`<span>· {item.content}</span>`)와 SelectedItemDetail 의 `SystemDetail` 을 명시적으로 구분하지 않음
  - 위치: `conversation-inspector.test.tsx` system 아이템 테스트
  - 상세: 현재 테스트는 `/system note|시스템 알림/i` 와 `/안내 메시지/` 를 검증하는데, 두 render path(SummaryView 인라인 vs SelectedItemDetail)가 각각 올바르게 동작하는지 별도로 확인하지 않는다. 특히 SummaryView 인라인은 content 를 `{item.content}` 로 직접 출력하고, SelectedItemDetail 은 별도 SystemDetail 컴포넌트에서 출력한다.
  - 제안: 클릭하여 detail 열었을 때의 SystemDetail 렌더 검증 케이스 추가.

---

### conversation-utils.test.ts — threadTurnsToConversationItems 커버리지

- **[WARNING]** `ai_assistant` 가 첫 번째 turn 인 경우(ai_user 없이 시작) turnIndex 동작 테스트 없음
  - 위치: `conversation-utils.test.ts` `threadTurnsToConversationItems` describe 블록
  - 상세: "advances turnIndex only on ai_user" 테스트는 presentation 이 먼저 오는 케이스만 다룬다. ai_assistant 가 첫 turn 인 엣지 케이스에서 `turnIndex || 1` 로 turnIndex=1 이 되는데 이 동작이 명시적으로 테스트되지 않았다.
  - 제안: `[makeTurn({ source: "ai_assistant", text: "먼저 도착한 답변" })]` 케이스 추가.

- **[WARNING]** `data` 가 null 또는 완전히 없는 presentation_user turn 에 대한 interactionType 추론 테스트 없음
  - 위치: `conversation-utils.test.ts` `infers interactionType` 테스트
  - 상세: `data` 없는 presentation_user 는 `form_submitted` 로 분류되어 빈 entries 로 처리된다. 이 경로가 테스트되지 않아 regression 가능성.
  - 제안: `makeTurn({ source: "presentation_user", data: undefined })` 케이스 추가 → interactionType === "form_submitted" 검증.

- **[INFO]** `toolCallId` 가 없는 `ai_tool` turn 테스트 없음
  - 위치: `conversation-utils.test.ts`
  - 상세: 현재 테스트는 toolCallId 가 있는 경우만 다룬다. toolCallId 없는 tool turn 에서 ConversationItem 의 toolCallId 필드가 undefined 인지 확인하는 케이스가 없다.
  - 제안: toolCallId 없는 ai_tool turn 추가해 `items[0].toolCallId` === undefined 검증.

---

### plan/in-progress/conversation-turn-render.md — 미완료 작업 추적

- **[INFO]** Plan Phase 1 체크리스트 항목 중 "conversationThread.turns 를 노드 단위로 보유하는 selector 추가"가 이번 PR 에 포함되지 않음
  - 위치: `plan/in-progress/conversation-turn-render.md` Phase 1 체크리스트 — `execution-store.ts` 의 selector 추가 항목
  - 상세: plan 에는 `conversationThread.turns` 를 노드 단위로 보유하는 selector 추가가 명시되어 있으나, 이번 diff 의 `execution-store.ts` 변경에는 `presentation` 필드가 포함된 ConversationItem 타입 확장만 있고 thread-level selector 는 추가되지 않았다. 계획과 구현의 불일치.
  - 제안: 해당 항목이 의도적으로 이번 PR 에서 제외된 것이라면 plan 에 명시. 포함 의도라면 selector 구현 추가.

- **[INFO]** Phase 1 체크리스트의 "dev server 시나리오 재현" 항목이 미체크 상태
  - 위치: `plan/in-progress/conversation-turn-render.md` Phase 1 마지막 체크박스
  - 상세: 자동화 테스트로 커버되지 않는 수동 검증 항목이 plan 에 남아있다. PR merge 전 반드시 수행 필요.
  - 제안: merge 전 수동 검증 수행 확인.

---

## 요약

전체적으로 기능 완전성은 높고 spec 의 핵심 요구사항(source 별 시각 분기, PresentationCardBody, SystemDetail, stripInlineMarkers, threadTurnsToConversationItems)이 충실하게 구현되어 있다. 그러나 WebSocket 재연결 시 threadTurns 경로에서 기존 messages 를 무조건 덮어쓰는 것이 CRITICAL 이슈로, 기존 fallback 경로에 있던 중복 방지 가드가 신규 경로에 빠져있다. WARNING 수준으로는 ai_assistant/ai_tool 의 turnIndex 폴백 로직(spec §1.1 과 미묘한 불일치), interactionType 추론 중복, unknown source 에 대한 default 케이스 부재, 테스트에서 커버되지 않는 엣지 케이스(빈 url, 중첩 data, data-없는 presentation_user)가 발견되었다. Phase 2/3(백엔드 prefix 분리, 인라인 마커 제거)는 plan 에 명시된 대로 별도 PR 예정이며, 이번 PR 의 Phase 1 범위 자체는 spec 요구사항을 대체로 만족한다.

## 위험도

HIGH
