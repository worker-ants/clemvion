# 테스트(Testing) 리뷰 결과

> 대상: 웹채팅 위젯 세션 컨트롤(새 대화/대화 종료) + 새로고침 히스토리 복원
> (`plan/in-progress/webchat-session-controls-history-restore.md`, commits `256bba3f0`+`792eedb28`)

## 발견사항

- **[INFO]** `endConversation` graceful 분기의 "ai_conversation 이지만 nodeId 미확정" 경계 미검증
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:415-431` (`graceful` 판정, JSDoc 코멘트에 "waiting nodeId 확정 시" 명시), 대응 테스트 `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:487-` (`describe("useWidget — 대화 종료...)`)
  - 상세: `graceful = phase==='awaiting_user_message' && pending?.type==='ai_conversation' && !!pending?.nodeId` 세 조건 중 앞 두 개(비 `awaiting_user_message`, 비 `ai_conversation` 타입)는 각각 테스트로 커버되지만, "`ai_conversation` 타입인데 `waitingNodeId` 가 SSE payload 에 없는 경우"(→ `cancel` 로 폴백)는 테스트가 없다. `parseWaitingForInput`(`eia-events.ts:36`)의 `nodeId: ev.waitingNodeId` 는 optional 필드라 실제로 도달 가능한 wire 케이스이며, JSDoc 이 이 조건을 명시적 계약으로 문서화했는데 회귀 테스트가 없어 향후 조건 순서가 바뀌어도 (예: `pending?.type==='ai_conversation'` 만으로 graceful 처리하도록 실수로 단순화되어도) 잡아내지 못한다.
  - 제안: `getEs()?.emit("execution.waiting_for_input", { interactionType: "ai_conversation", nodeOutput: {...} /* waitingNodeId 생략 */ })` 형태로 nodeId 없는 ai_conversation waiting 케이스를 추가해 `command === "cancel"` 을 단언하는 테스트를 1건 보강.

- **[INFO]** `getStatus()`: waiting node 는 없지만 durable `conversationThread` 는 존재하는 조합 미검증
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:248-296` — `conversationThread` 변수는 `if (execution.status === WAITING_FOR_INPUT)` 블록 최상단에서 계산되지만, 실제 `context` 조립은 중첩된 `if (nodeExec?.node)` 안에서만 일어난다.
  - 상세: 기존 회귀 테스트("waiting_for_input — 대기 NodeExecution 없으면 currentNode/context null", `interaction.service.spec.ts:527`)는 `conversationThread` 를 지정하지 않은 채로만 이 분기를 검증한다. `nodeExec` 가 없고 `conversation_thread` 컬럼에는 값이 있는 조합(이론상 park 커밋과 waiting NodeExecution 커밋 타이밍이 어긋나는 극단 레이스, 혹은 데이터 정합성 결함)에서 durable thread 가 조용히 드롭되는지가 테스트로 고정돼 있지 않다. 실무적으로 도달 가능성은 낮지만(동일 park 트랜잭션에서 커밋되는 것이 설계 의도), 새 코드가 추가한 변수의 도달 범위를 명시적으로 고정하는 편이 안전하다.
  - 제안: 우선순위 낮음(현재 회귀 위험 낮음) — 필요 시 `nodeRepo.findOne.mockResolvedValue(null)` + `conversationThread: DURABLE_THREAD` 조합으로 `context` 가 여전히 `null` 임을 명시하는 테스트 1건 추가하면 향후 리팩터 시 안전망이 된다.

- **[INFO]** Panel↔useWidget 통합 지점(`widget-app.tsx`) 은 새 액션이 실제로 연결됐는지 별도 통합 테스트 없음
  - 위치: `codebase/channel-web-chat/src/widget/widget-app.tsx:52` (`<Panel ... actions={actions} />`, `useWidget().actions` 전체 spread)
  - 상세: `panel.test.tsx` 는 `Panel` 을 mock `actions`(`vi.fn()`)로 격리 테스트하고, `use-widget-eager-start.test.ts` 는 `useWidget()` 훅의 `endConversation` 을 직접 호출해 테스트한다. 두 계층이 각각 잘 커버되지만, "헤더 '대화 종료' 버튼 클릭 → 실제 `useWidget` 훅의 `endConversation` 이 실행되어 SSE 종료 + optimistic ended" 를 검증하는 `widget-app.test.tsx` 수준의 엔드투엔드 통합 테스트는 없다. `actions` 객체가 그대로 spread 되는 구조라 배선 실수(prop 이름 오타 등) 위험은 낮지만, 두 파일의 mock 이 실제 시그니처와 계속 동기화된다는 보장은 TypeScript 타입 체크에 의존한다.
  - 제안: 낮은 우선순위. 필요 시 `widget-app.test.tsx` 에 헤더 버튼 클릭 → `conversationEnded` bridge 이벤트 발사까지 확인하는 스모크 테스트 1건을 고려.

## 우수 사항 (참고)

- 신규 백엔드 테스트 4건(`interaction.service.spec.ts`)이 핵심 경로(ai_conversation 동봉·buttons 동봉·COMPLETED 시 미노출·null thread 시 키 생략)를 정확히 분리해 커버하며, `toMatchObject` + `not.toHaveProperty`/`not.toHaveBeenCalled()` 조합으로 "부재"까지 적극적으로 단언한다. `COMPLETED` 케이스가 `nodeRepo.findOne` 호출 여부까지 검증해 불필요한 쿼리 회귀도 가드한다.
- 프런트 `conversation.test.ts` 는 실제 wire 계약(5-source, `role` 없는 durable turn)을 정확히 재현해 이전에 존재했던 "테스트가 실제로 보내지 않는 `role` 필드를 먹여 통과하던" 결함(계획 문서에 명시됨)을 근본적으로 교정했고, `role` override 우선순위·`ai_tool`/`system` 축약까지 경계 케이스를 챙겼다.
- `panel.test.tsx` 신규 스위트는 `it.each` 로 3개 활성 phase 를 동시 커버하고, `ended`/`panel`(비활성) 을 별도 음성 테스트로 분리했으며, 확인바 확정/취소 두 경로 모두 라벨 충돌 없이(`aria-label` 분리) `getByRole` 로 명확하게 검증한다. `beforeEach(vi.clearAllMocks)` 로 테스트 간 mock 호출 카운트 오염을 방지해 격리성도 양호하다.
- `use-widget-eager-start.test.ts` 의 신규 5건은 graceful/cancel 라우팅 경계(ai_conversation vs buttons vs streaming), 명령 실패(410) 시 optimistic 유지, 그리고 booting 중 세대 토큰(gen guard) 레이스까지 실제 `fetchMock`/`EventSource` 스텁을 조합해 정밀하게 재현한다 — 특히 gen guard 테스트는 "뒤늦게 resolve 되는 webhook 이 이미 종료된 세션을 되살리지 않는다"는 비동기 레이스를 `resolveWebhook` 지연 resolve 패턴으로 정확히 시뮬레이션해 실제 동작과의 괴리가 없다. `afterEach(vi.unstubAllGlobals())` 로 전역 stub 오염도 차단된다.
- `endConversation` 을 만들 때 `useCallback` 의존성 배열(`[state.phase, state.pending, resetSessionRefs]`)이 실제 클로저 사용 값과 일치해 테스트 대상 함수가 최신 상태를 정확히 참조 — 의존성 주입/클로저 정확성이 테스트 신뢰도를 뒷받침한다.

## 요약

신규/변경 로직(백엔드 `getStatus()` durable thread 동봉, 프런트 `roleOf` 매핑, 헤더 세션 컨트롤 UI, `useWidget.endConversation` + gen guard)은 모두 대응하는 단위 테스트를 갖추고 있으며, 특히 이전 라운드 `/ai-review` WARNING(#1 경합, #6 catch 경로, #7 경계, #8/#9 회귀 가드)이 실제 테스트 추가로 반영된 흔적이 diff 에 뚜렷하다. Mock 은 fetch/EventSource/TypeORM repository 모두 손으로 구성한 얇은 stub 으로 실제 동작과 크게 괴리되지 않고, 전역 stub 은 `afterEach` 로 정리되어 테스트 격리도 양호하다. 발견된 갭은 모두 INFO 수준(도달 가능성 낮은 경계 조합 미검증)이며 present 코드의 정확성 자체를 의심할 근거는 없다. e2e 스킵 판단(plan 문서에 명시된 "additive read-only, 실행엔진 상태전이 무변경" 근거)도 변경 범위와 부합해 타당하다.

## 위험도
LOW
