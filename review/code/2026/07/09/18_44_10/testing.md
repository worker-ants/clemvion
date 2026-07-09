# 테스트(Testing) 리뷰 결과

> 대상: 웹채팅 세션 컨트롤(새 대화/종료) + 새로고침 히스토리 복원 (`plan/in-progress/webchat-session-controls-history-restore.md`)
> 코드 파일: `interaction.service.ts`(+spec), `conversation.ts`(+test), `eia-types.ts`, `panel.tsx`(+test), `styles.ts`, `use-widget.ts`, `use-widget-eager-start.test.ts`

## 발견사항

- **[WARNING]** `endConversation` 명령 실패(catch) 경로 — optimistic teardown 이 테스트되지 않음
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:406-433` (`endConversation`) / 대응 테스트 `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:1593-1640`
  - 상세: JSDoc 에 "명령 성패와 무관하게 사용자 의도대로 optimistic 하게 로컬 세션을 정리하고 `[ended]` 로 전이한다... 명령 실패(410/네트워크)는 진단만 남긴다"고 명시된 핵심 계약이다. `client.interact()`(`eia-client.ts` 72-87행)는 `410`/비-2xx 응답 시 `EiaError` 를 throw 하므로 `try { await client.interact(...) } catch (e) { console.warn(...) }` 블록이 실제로 도달 가능한 경로인데, 신규 테스트 2건은 모두 `installControllableSse()` 의 `interact` mock 이 `{ ok: true, status: 202 }` 만 반환해 이 catch 경로를 전혀 exercise 하지 않는다. 이 분기가 깨져(예: `catch` 제거·await 순서 변경) 실패 시 로컬 종료가 막히면 사용자가 대화 종료 버튼을 눌러도 화면이 멈춘 채 남는 회귀가 unit 레벨에서 전혀 잡히지 않는다.
  - 제안: `installControllableSse`/`installFetch` 에 `interact` 실패(410 또는 network reject)를 시뮬레이션할 수 있는 옵션을 추가하고, "`client.interact` 가 실패해도 `phase` 는 `ended` 로 전이하고 `sessionStorage` 가 정리된다" 는 테스트를 추가할 것.

- **[WARNING]** graceful(`end_conversation`) vs `cancel` 분기의 경계 조건이 부분적으로만 커버됨
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:410-416` (`graceful = phase==='awaiting_user_message' && pending?.type==='ai_conversation' && !!pending?.nodeId`)
  - 상세: 3개 AND 조건 중 신규 테스트는 "전부 true(awaiting+ai_conversation+nodeId 有) → graceful" 과 "phase 자체가 다름(streaming) → cancel" 두 극단만 커버한다. 실무에서 더 흔히 틀리기 쉬운 경계 — **`awaiting_user_message` 인데 pending 이 `buttons`/`form`(ai_conversation 아님)** 또는 **`ai_conversation` 이지만 `nodeId` 미확정** — 은 어느 테스트도 exercise 하지 않는다. 이 조건이 실수로 `phase==='awaiting_user_message'` 만으로 단순화되면(버튼/폼 대기 중에도 `end_conversation` 을 잘못 전송) 백엔드가 이를 거부하거나 워크플로우가 잘못된 노드에서 재개를 시도할 수 있는데 이 회귀가 unit 에서 포착되지 않는다.
  - 제안: `pending: { type: "buttons", ... }` 상태에서 `endConversation()` 호출 시 `command.command === "cancel"` 임을 검증하는 테스트를 추가할 것 (boundary 케이스가 로직의 실질적 핵심).

- **[INFO]** `panel.test.tsx` — "대화 종료" 확인 바 취소(cancel) 경로 미검증(비대칭)
  - 위치: `codebase/channel-web-chat/src/widget/components/panel.test.tsx:1105-1151`
  - 상세: "'새 대화' 확인 → newChat 호출, '취소' → 아무 액션 없음" 테스트(1134행)는 취소 경로까지 검증하지만, "대화 종료" 쪽(1118행)은 확정(`wc-confirm-yes`) 경로만 있고 `wc-confirm-no` 클릭 시 `endConversation` 미호출 + 다이얼로그 닫힘을 검증하는 대응 테스트가 없다. 두 흐름이 `confirming` 하나의 state 로 동일 핸들러(`setConfirming(null)`)를 공유하므로 위험도는 낮지만, 커버리지 대칭성 관점에서 누락.
  - 제안: `'대화 종료' 취소 → endConversation 미호출` 테스트 1건 추가.

- **[INFO]** 헤더 세션 컨트롤 노출 조건 — `ACTIVE_PHASES` 3값 중 1값(`awaiting_user_message`)만 직접 테스트됨
  - 위치: `codebase/channel-web-chat/src/widget/components/panel.test.tsx:1068-1079`, `panel.tsx:14-18`(`ACTIVE_PHASES = ["booting","streaming","awaiting_user_message"]`)
  - 상세: "진행 중이면 노출" 테스트는 `awaiting_user_message` 만 렌더한다. `booting`/`streaming` 도 "진행 중"으로 분류되는데 별도 케이스가 없어, 예컨대 향후 `ACTIVE_PHASES` 배열에서 `booting`/`streaming` 이 실수로 빠져도 이 테스트 스위트가 잡지 못한다.
  - 제안: `it.each(["booting","streaming"])` 또는 개별 케이스로 최소 1개 추가 phase 를 커버.

- **[INFO]** `conversation.ts` `USER_TURN_SOURCES` 의 `"user"` 리터럴이 타입 union·문서·테스트 어디에도 없이 존재
  - 위치: `codebase/channel-web-chat/src/lib/conversation.ts:32` (`new Set<string>(["presentation_user", "ai_user", "user"])`) vs `eia-types.ts:38-46` (`TurnSource` union 은 `live/injected/presentation_user/ai_user/ai_assistant/ai_tool/system` 7값 — `"user"` 미포함)
  - 상세: `"user"` 는 위 JSDoc(29-30행, "form/carousel 등 presentation 제출과 AI 대화의 사용자 turn")에도 언급이 없고 `TurnSource` 타입에도 없어 정상 wire 경로로는 도달 불가능한 값으로 보인다(레거시 fixture 호환용으로 추정). `Set<string>.has()` 는 구조적으로 타입체크를 우회하므로 컴파일 타임에 걸러지지 않는다. 신규 `wire source → role 매핑` 테스트(`conversation.test.ts` 295-307행)도 이 값을 다루지 않아 죽은 코드인지 의도된 하위호환인지 테스트로 확인할 수 없다.
  - 제안: 의도된 하위호환이면 JSDoc 에 명시 + `it("source='user' → role user (레거시 호환)")` 1건 추가, 아니면 제거.

- **[INFO]** 백엔드 `getStatus` — `conversationThread` 가 non-`WAITING_FOR_INPUT` 상태에서 노출되지 않음을 보장하는 명시적 회귀 테스트 부재
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:250-183`(신규 `conversationThread` 조립은 `if (execution.status === WAITING_FOR_INPUT)` 블록 내부에 구조적으로 갇혀 있어 현재 코드상 leak 은 불가능) / 기존 테스트 `interaction.service.spec.ts:460-478`(`COMPLETED` 케이스는 `conversationThread` 필드를 아예 세팅하지 않은 execution 사용)
  - 상세: 이번 diff 의 JSDoc 자체가 "`conversationThread` 는 SSE 와 동일하게 공개 EIA 표면으로 흘러간다... 민감 중간결과를 기록하면 안 된다" 고 명시할 만큼 보안 민감 표면 확장이다. 현재는 if-block 구조로 안전하지만, 향후 리팩터링(예: 함수 추출·early return 재배치)으로 이 구조가 깨지면 `COMPLETED`/`FAILED` execution 이 과거에 채워둔 `conversationThread` 를 실수로 REST 표면에 노출할 위험이 있다. `COMPLETED` 케이스에 `conversationThread` 를 채운 execution 으로 "종료 상태에선 `context` 자체가 null 이라 conversationThread 도 당연히 없다" 를 명시적으로 assert 해두면 이 구조가 미래에도 지켜지도록 하는 안전망이 된다.
  - 제안: `COMPLETED`(또는 `FAILED`) + `conversationThread: DURABLE_THREAD` 를 세팅한 execution 으로 `r.context` 가 `null` 임을 확인하는 defense-in-depth 테스트 1건 추가(낮은 우선순위).

- **[INFO]** `panel.test.tsx` 확인 바 버튼 선택자가 CSS 클래스(`querySelector(".wc-confirm-yes"/".wc-confirm-no")`)에 의존
  - 위치: `codebase/channel-web-chat/src/widget/components/panel.test.tsx:864, 879, 884, 1129, 1144, 1149`
  - 상세: "대화 종료"라는 동일 라벨이 헤더 트리거 버튼과 확인 바 확정 버튼 양쪽에 존재해 접근성 쿼리(`getByRole`)만으로는 모호(ambiguous)하다는 실제 제약이 있어 CSS 클래스 selector 로 우회한 것은 이해할 만하나, Testing Library 관례상 `within(dialog).getByRole("button", { name: ... })` 로 스코프를 좁히는 편이 구현 세부사항(클래스명)에 덜 결합되고 접근성 트리 기준 검증에도 부합한다. 현재 방식은 `.wc-confirm-yes`/`.wc-confirm-no` 클래스명이 리팩터링되면(스타일만 바뀌어도) 테스트가 조용히 깨지거나, 반대로 실제 접근성 문제(예: 버튼에 `aria-label` 없음)를 놓칠 수 있다.
  - 제안: `import { within } from "@testing-library/react"` 후 `within(dialog).getByRole("button", { name: "대화 종료" })` 형태로 전환 고려(우선순위 낮음, 현재도 동작은 정확함).

## 요약

이번 변경은 3개 표면(백엔드 `getStatus` durable thread 노출, 프런트 `roleOf` wire-source 매핑, 위젯 헤더 세션 컨트롤/`endConversation`)에 걸쳐 신규 로직 각각에 대응하는 단위 테스트가 성실히 추가됐고, 특히 `conversationThread` null 미동봉을 `not.toHaveProperty` 로 엄격히 단언하거나 `[user-input]` strip·명시 `role` 우선순위 등 세부 계약을 정확히 캡처하는 등 품질이 양호하다. 다만 두 가지 실질적 갭이 있다 — (1) `endConversation` 이 명령 실패 시에도 optimistic 하게 로컬 종료를 진행한다는, 코드 주석에 명시된 핵심 견고성 계약이 어느 테스트로도 exercise 되지 않아 이 catch 경로의 회귀를 잡을 수 없고, (2) graceful(`end_conversation`) vs 범용(`cancel`) 라우팅의 3중 AND 조건 중 "awaiting 상태이지만 ai_conversation 이 아닌" 경계 케이스가 테스트되지 않아 커맨드 오라우팅 회귀 위험이 남는다. 그 외는 커버리지 대칭성·타입-구현 정합성·테스트 가독성 수준의 경미한 참고사항이다.

## 위험도
MEDIUM
