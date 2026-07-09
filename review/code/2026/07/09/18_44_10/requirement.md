# 요구사항(Requirement) 리뷰 결과

> 대상: 웹채팅 위젯 — 세션 컨트롤(새 대화/종료) + 새로고침 히스토리 복원
> (`plan/in-progress/webchat-session-controls-history-restore.md`)

## 검증 수행

- 백엔드 `interaction.service.spec.ts` 실행 확인: `31 passed`.
- 프런트 `conversation.test.ts` / `panel.test.tsx` / `use-widget-eager-start.test.ts` 실행 확인: `44 passed`.
- 관련 spec 3건(`spec/5-system/14-external-interaction-api.md`, `spec/7-channel-web-chat/1-widget-app.md`,
  `spec/7-channel-web-chat/3-auth-session.md`) 을 diff 및 line-level 대조.
- 인접 코드(비-diff, 참조용): `execution.entity.ts`(`conversationThread` 컬럼), `conversation-thread.types.ts`
  (`ConversationTurnSource` 5값), `eia-events.ts`(`parseWaitingForInput`), `widget-state.ts`(reducer/phase),
  `widget-app.tsx`(actions 전달 경로) 를 함께 확인.

## 발견사항

- **[INFO]** `endConversation` 명령 실패(catch) 경로가 unit 테스트로 검증되지 않음
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:406-433` (`endConversation`),
    `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:1579-1626` (신규 테스트 2건)
  - 상세: `endConversation` 은 `client.interact(...)` 가 reject 되어도(410/네트워크/409 STATE_MISMATCH 등)
    `catch` 에서 `console.warn` 만 남기고 이어서 `teardownSession()` + `dispatch({ type: "ENDED" })` 를
    무조건 수행하도록 설계돼 있다("명령 성패와 무관하게 optimistic 전이" — JSDoc·spec §3.1 표와 일치하는
    의도된 동작). 그러나 신규 테스트 2건은 모두 `client.interact` 가 성공(202)하는 경로만 다루고,
    실패 시에도 동일하게 `[ended]` 로 전이하고 세션이 정리되는지 검증하는 테스트가 없다. 로직 자체는
    spec·JSDoc 과 일치하지만 신규 분기(그것도 "실패해도 성공한 것처럼 동작"이라는, 실수하기 쉬운 반직관적
    분기)의 회귀 방지 커버리지가 비어 있다.
  - 제안: `client.interact` 를 reject 시키는 케이스를 하나 추가해 `catch` 이후에도 `phase === "ended"`,
    `sessionStorage` 정리, `console.warn` 호출을 단언할 것을 권장(차단 사유 아님).

- **[INFO]** `end_conversation` graceful 경로가 서버 409(STATE_MISMATCH)로 실패해도 클라이언트는 execution
  이 실제 종료됐다고 가정하지 않고 낙관적으로 `[ended]` 로 전이 — spec Rationale 에 이 특정 orphan 경로가
  명문화되어 있지 않음
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts` (`assertWaiting` →
    `end_conversation` 은 `execution.status !== WAITING_FOR_INPUT` 이면 409 던짐),
    `codebase/channel-web-chat/src/widget/use-widget.ts:406-424` (graceful 분기 + 무조건 낙관적 종료)
  - 상세: `graceful` 판정은 클라이언트가 마지막으로 관측한 `state.phase === "awaiting_user_message" &&
    state.pending?.type === "ai_conversation"` 로만 이뤄지고, 실제 서버 `Execution.status` 와의 race(예:
    클라이언트가 아직 받지 못한 최신 상태 변화)가 있으면 `end_conversation` 이 409 로 거부될 수 있다. 이
    경우 서버 execution 은 실제로 종료되지 않고 `waiting_for_input` 으로 계속 잔존하는데, 위젯은 그대로
    `[ended]` 로 전이해 사용자에게는 "종료됨"으로 보인다. 이 자체는 JSDoc·spec §3.1 표의 "명령 성패와
    무관하게 optimistic 하게... 전이" 문구로 이미 의도적으로 커버되고, 이번 diff 의 `consistency-check`
    가 병렬로 지적한 "새 대화(newChat)의 orphan waiting_for_input Execution" 케이스와 근본적으로 같은
    트레이드오프 계열이다. 다만 "새 대화" 쪽은 spec `1-widget-app.md` §3.1/새 대화 행에 "명시 종료 명령을
    보내지 않으므로... 무기한 보존"이라고 원인을 명문화한 반면, "대화 종료" 쪽의 이 특정 실패 경로(명령을
    보냈지만 서버가 거부한 경우)는 별도로 명문화돼 있지 않다.
  - 제안: 실제 발생 확률은 낮은 좁은 race(동일 탭·단일 클라이언트 세션 모델상 서버가 클라이언트 관측과
    다른 상태로 먼저 전이할 경로가 마땅치 않음)이므로 차단 사유는 아니다. 후속으로 spec Rationale 에
    "대화 종료 명령이 서버에서 거부돼도 위젯은 낙관적으로 종료 처리하며, 이 경우도 실행 row 는 다른
    orphan 경로와 동일하게 무기한 잔존한다"를 한 줄 병기하면 문서 완전성이 개선된다(코드 수정 불필요).

- **[INFO]** `USER_TURN_SOURCES` 에 `TurnSource` 유니언에 없는 `"user"` 리터럴이 방어적으로 포함되어
  JSDoc 서술과 불일치
  - 위치: `codebase/channel-web-chat/src/lib/conversation.ts:31` (`const USER_TURN_SOURCES = new
    Set<string>(["presentation_user", "ai_user", "user"]);`)
  - 상세: 바로 위 JSDoc 은 "사용자 발화로 취급하는 백엔드 `ConversationTurnSource`... `presentation_user`
    과 `ai_user`" 두 값만 언급하는데, 실제 `Set` 에는 `"user"` 세 번째 멤버가 추가돼 있다. `eia-types.ts`
    의 `TurnSource` 유니언(`live`/`injected`/backend 5값)에도 `"user"` 는 존재하지 않고, 코드베이스
    전체에서 실제로 `source: "user"` 를 생성하는 producer 도 없다(grep 결과 무). 즉 현재는 도달 불가능한
    방어적 fallback으로 보이며 기능 결함은 아니다.
  - 제안: 의도된 하위 호환/방어 코드라면 JSDoc 에 "user"(과거 fixture·외부 wire 호환) 를 명시하고, 아니면
    제거해 `TurnSource` 타입·주석·구현 3자를 일치시킬 것.

- **[INFO][SPEC-DRIFT 아님, 이미 해소 확인]** consistency-check 가 지적한 "새 대화" TTL/idle 문구 WARNING
  은 이번 diff 안에서 이미 수정 반영됨 — 재확인 완료
  - 위치: `spec/7-channel-web-chat/1-widget-app.md` §3.1 "새 대화 (restart)" 행
  - 상세: `review/consistency/2026/07/09/18_27_06/cross_spec.md` 의 WARNING #1("이전 execution 은
    TTL/idle 만료" 문구가 실행 엔진의 "waiting_for_input 무기한 보존" 불변식과 충돌)이 이번 diff 의
    `1-widget-app.md` 최종본에서 "위젯 측 **토큰만** TTL/idle 로 만료된다... Execution row 는... 무기한
    보존 불변식" 으로 정정 반영된 것을 spec 본문에서 직접 확인했다. 추가 조치 불필요.

## Line-level spec fidelity 검증 요약

- `interaction.service.ts` `getStatus()` 의 `conversationThread` 동봉 로직(`execution.conversationThread ??
  undefined`, buttons/form-ai_conversation 양 분기 `...(conversationThread ? { conversationThread } : {})`)은
  `spec/5-system/14-external-interaction-api.md` §5.3 콜아웃·R17 재조정 문구("`context.conversationThread`
  에는 durable 스냅샷을... SSE `waiting_for_input` 과 동일 wire 형식으로 동봉... `seq` 만은... SSE 가
  권위")와 필드명·조건(`waiting_for_input` 한정)·null 처리(`배포 이전 row / park 이력 없음`)까지 정확히
  일치한다.
- `conversation.ts` `roleOf`(`presentation_user`/`ai_user`→user, `ai_assistant`/`ai_tool`/`system`→assistant,
  `role` override 우선)는 `spec/7-channel-web-chat/1-widget-app.md` §2 메시지 리스트 행 및
  `spec/conventions/conversation-thread.md` §1.1 의 백엔드 `ConversationTurnSource` 5값 정의와 정확히
  일치하며, 백엔드 `conversation-thread.types.ts` 의 실제 유니언(5값, `system_error` 미포함)과도 일치한다.
- `eia-types.ts` `TurnSource` 확장(5값 추가 + 기존 `live`/`injected` 유지)은 wire 형태(SSE/`getStatus`)와
  로컬 라이브 dispatch 두 소스를 모두 수용해야 하는 요구와 부합한다.
- `panel.tsx`/`use-widget.ts` 의 헤더 세션 컨트롤(진행 중 phase 한정 노출, 2단계 confirm, graceful
  `end_conversation` vs 범용 `cancel` 분기)은 `spec/7-channel-web-chat/1-widget-app.md` §2 헤더 행·§3
  "헤더 세션 컨트롤" 문단·§3.1 "대화 종료"/"새 대화" 행과 트리거·명령·조건 모두 일치한다.
- backend `end_conversation` 은 `nodeId` 필수(`assertNodeId`)이고 프런트는 `!!state.pending?.nodeId` 가드
  후에만 graceful 커맨드를 만들어 계약이 정확히 맞물린다. `cancel` 은 `nodeId` 불필요 — 프런트 비-graceful
  분기도 `nodeId` 를 싣지 않아 일치.
- `1-widget-app.md`/`3-auth-session.md` 의 "새로고침 시 `waiting_for_input` 상태 한정 durable thread
  복원" 조건은 `use-widget.ts` `seedWaitingFromStatus`(`status.status === "waiting_for_input" &&
  status.context`)와 정확히 일치.

## 요약

핵심 두 기능(EIA `getStatus` 의 durable `conversationThread` 노출 + 웹채팅 헤더 세션 컨트롤/`endConversation`)
모두 구동 plan·갱신된 3개 spec 문서와 line-level 로 정확히 일치하며, 백엔드·프런트 신규 단위테스트(각각
31/44 통과 확인)도 실제로 통과한다. CRITICAL/WARNING 급 결함은 발견되지 않았다. 남은 항목은 전부 INFO 수준
— `endConversation` 실패 경로의 테스트 커버리지 부재, 그 실패 경로가 초래할 수 있는 좁은 orphan-execution
race 의 spec Rationale 미명문화, 그리고 도달 불가능해 보이는 방어적 `"user"` source 리터럴의 JSDoc 불일치.
consistency-check 가 지적했던 TTL/idle 문구 충돌은 이미 diff 내에서 정정된 것을 확인했다.

## 위험도

LOW
