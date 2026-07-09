# 부작용(Side Effect) Review 결과

> 대상: 웹채팅 위젯 세션 컨트롤(새 대화/대화 종료) + `getStatus` durable `conversationThread` 새로고침
> 히스토리 복원 (`interaction.service.ts`, `use-widget.ts`, `panel.tsx`, `widget-state.ts`, `conversation.ts`,
> `eia-types.ts` 등). 이번 세션은 3차(fresh) 리뷰 — 이전 두 라운드(18_44_10, 19_06_55)의 WARNING/INFO가 이미
> 코드에 반영된 상태에서 `--branch origin/main` 누적 diff 를 검토했다.

## 발견사항

- **[INFO]** `endConversation` 종료 순서 재배치(SSE 선차단 → optimistic ended → best-effort 명령)가 의도대로 중복 `conversationEnded` 이벤트를 차단
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:399-433` (`endConversation`), `:172-177` (`handleEiaEvent` TERMINAL_EVENTS 분기)
  - 상세: 이전 라운드(18_44_10 WARNING #1)에서 지적됐던 "명령 전송 후 teardown" 순서가 이번 diff 에서
    `resetSessionRefs()`(SSE `closeStream` 포함) → `dispatch(ENDED)` → `bridgeRef.sendEvent("conversationEnded")`
    → best-effort `client.interact()` 순으로 재배치됐다. 명령이 유발하는 terminal SSE 이벤트가 도착할 시점에는
    이미 스트림이 닫혀 있어 `handleEiaEvent` 의 `TERMINAL_EVENTS` 분기가 재진입하지 않는다. 또한 `endConversation`
    최상단의 `if (state.phase === "ended") return;` 가드가 이미 종료된 상태에서의 재호출(중복 클릭·SSE 가 먼저
    도착한 경우)도 차단한다. `use-widget-eager-start.test.ts` 신규 6개 케이스(graceful/cancel 분기, 410 실패,
    booting-중-gen guard)가 이 경로를 커버한다. 새 부작용은 확인되지 않음(참고로 기록).
  - 제안: 없음.

- **[INFO]** `startGenRef`(세대 토큰) 도입 — React ref 기반 인스턴스-scoped 상태, 전역 오염 아님
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:118-121`(`startGenRef` 선언), `:143`(`teardownSession`
    에서 증가), `:280-299`(`start()` 캡처·2회 재확인)
  - 상세: `newChat`/`endConversation`(teardownSession 경유)이 in-flight `start()`(webhook POST await 중)를
    무효화하기 위해 `useRef` 로 세대 카운터를 도입했다. `useRef` 는 훅 인스턴스에 격리된 상태로 모듈 전역이
    아니며, 다른 `useWidget()` 인스턴스나 컴포넌트 트리 외부에 영향을 주지 않는다. `teardownSession` 이 매번
    호출될 때마다(대화 종료·새 대화·SSE terminal 이벤트) gen 을 무조건 증가시키므로, 정상 종료 흐름에서도
    이후 `start()` 재호출(`newChat`)이 새 gen 을 다시 캡처해 정상 동작한다(신규 `startGenRef` 증가가 다음
    `start()` 호출 자체를 막지 않음 — `++startGenRef.current` 캡처 시점이 새 호출마다 갱신됨). 의도한 대로
    "옛 execution 이 되살아나는 race" 차단 목적에 국한된 부작용이며, 이번 diff 로 새로 추가된 신규 리스크는
    없음.
  - 제안: 없음.

- **[INFO]** 백엔드 `getStatus()` 응답 스키마 additive 확장 — 기존 호출자 영향 없음
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:256-297`
  - 상세: `context.conversationThread` 는 `waiting_for_input` 이고 durable thread 가 존재할 때만 조건부
    스프레드(`...(conversationThread ? { conversationThread } : {})`)로 추가되는 신규 optional 필드다. 기존
    필드(`interactionType`/`waitingNodeId`/`buttonConfig`/`nodeOutput`)는 무변경이고 `ExecutionStatusDto.context`
    타입은 이미 `Record<string, unknown> | null` 로 개방형이라 DTO/Swagger 시그니처 변경이 없다. `execution`
    엔티티를 로드하는 `this.executionRepository.findOne({ where: { id: ctx.executionId } })` 자체는 이번 diff 로
    변경되지 않았다(이미 `select` 제한 없이 전체 컬럼을 로드하던 쿼리) — 즉 `conversation_thread` jsonb 컬럼을
    새로 DB 에서 추가로 읽어오는 것이 아니라, 이미 로드돼 있던 값을 응답에 노출하기만 하는 변경이라 새로운
    DB I/O 부작용은 없다. 프런트도 `conversationThread` 부재(undefined)를 `threadToMessages` 가 빈 배열로
    graceful 처리해 독립 배포 조합(구버전 위젯 ↔ 신버전 백엔드 등)에서도 안전하다.
  - 제안: 없음(참고로 기록).

- **[INFO]** `PanelActions` 인터페이스에 `endConversation: () => void` 필수 필드 추가 — 시그니처 변경이나 영향 범위가 패키지 내부로 닫혀 있음
  - 위치: `codebase/channel-web-chat/src/widget/components/panel.tsx:19-22`(`PanelActions` 정의)
  - 상세: `Panel` 컴포넌트에 새 필수 prop 이 추가됐지만, `<Panel .../>` 을 렌더링하는 곳은
    `codebase/channel-web-chat/src/widget/widget-app.tsx:52`(`<Panel state={state} config={config} actions={actions} />`)
    한 곳뿐이며 `actions` 는 `useWidget()` 이 반환하는 객체를 그대로 spread 없이 통째로 전달한다. `use-widget.ts`
    의 `actions` 리터럴도 같은 diff 에서 `endConversation` 을 포함하도록 갱신됐다(`:555`). 테스트 파일
    (`panel.test.tsx`)의 `BASE_ACTIONS` 에도 `endConversation: vi.fn()` 이 추가돼 타입 불일치가 없다.
    `PanelActions`/`Panel` 은 채널 패키지 외부로 export 되지 않는 내부 컴포넌트라 다른 패키지(`frontend`,
    `backend`)에 파급되지 않는다.
  - 제안: 없음.

- **[INFO]** `TurnSource` union 확장(2값 → 7값) — 백엔드 `ConversationTurnSource` 와는 독립된 로컬 mirror 타입, cross-package 파급 없음
  - 위치: `codebase/channel-web-chat/src/lib/eia-types.ts:423-430`
  - 상세: `presentation_user`/`ai_user`/`ai_assistant`/`ai_tool`/`system` 5값을 기존 `live`/`injected` 에
    추가했다. `grep` 확인 결과 이 `TurnSource` 는 `channel-web-chat` 패키지 로컬 타입이며, 백엔드의 권위 타입
    `ConversationTurnSource`(`codebase/backend/src/shared/conversation-thread/conversation-thread.types.ts`)나
    프런트 메인 앱의 `frontend/src/lib/conversation/conversation-utils.ts` 의 동명 개념과 import 관계로 연결돼
    있지 않다(프로젝트의 기존 "mirror 는 의도적 비-공유" 컨벤션과 일치, `project_cafe24_makeshop_mirror_dedup_withdrawn`
    선례와 동일 패턴). 값 추가는 union 을 넓히는 방향이라 기존 `live`/`injected` 리터럴을 사용하던 코드 경로는
    무변경으로 동작한다(`roleOf` 는 `USER_TURN_SOURCES = {"presentation_user","ai_user"}` 에 없는 값은 그대로
    `"assistant"` 로 떨어져 이전 동작과 동일).
  - 제안: 없음.

- **[INFO]** `bridgeRef.current?.sendEvent("conversationEnded", { reason })` 에 신규 `reason` 값(`"user_ended"`) 이 추가 — host 소비 측 스키마는 이미 열려 있어 breaking 아님
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:432`
  - 상세: 기존에는 SSE `TERMINAL_EVENTS`(예: `execution.completed`/`execution.cancelled` 등 이벤트명 그대로)가
    `reason` 값으로 쓰였고, 이번 diff 로 사용자 트리거 종료 시 `"user_ended"` 라는 새 문자열이 추가됐다.
    `spec/7-channel-web-chat/2-sdk.md` 의 host↔iframe 이벤트 계약은 `data` 를 "이벤트별 페이로드"로만 서술해
    `reason` 값 자체를 닫힌 enum 으로 문서화하지 않았으므로, 신규 값 추가가 기존 host 통합 코드의 타입 단언을
    깨뜨릴 위험은 낮다(호스트가 `reason` 을 문자열 그대로 로깅/표시하는 것 이상으로 강타입 switch 를 걸어뒀다면
    영향 가능하나, 저장소 내 SDK 문서·타입에서 그런 제약은 발견되지 않음).
  - 제안: 호스트 통합 문서(`2-sdk.md`)에 `conversationEnded.reason` 이 열린 문자열 집합(SSE 이벤트명 또는
    `"user_ended"`/`"gone"`)임을 한 줄 명시하면 제3자 호스트 개발자의 예측 가능성이 높아진다(차단 사유는 아님).

## 요약

이번 라운드에서 새로 표면화된 CRITICAL/WARNING 급 부작용은 없다. 핵심 위험 지점이었던 `endConversation` 의
"명령-먼저 teardown-나중" 순서로 인한 `conversationEnded` 중복 발사는 이전 라운드 WARNING #1 반영으로 이미
SSE 선차단 + `phase==='ended'` 가드 구조로 해소됐고, 신규 도입된 `startGenRef` 세대 토큰도 `useRef` 기반 훅
인스턴스-scoped 상태라 전역 오염이 없으며 테스트(`use-widget-eager-start.test.ts` booting-중-gen-guard 케이스)로
검증돼 있다. 백엔드 `getStatus()` 의 `conversationThread` 노출은 이미 로드돼 있던 컬럼을 응답에 조건부로
추가하는 순수 additive 변경으로 신규 DB I/O 나 시그니처 파괴가 없고, `PanelActions`/`TurnSource` 시그니처·타입
확장도 영향 범위가 `channel-web-chat` 패키지 내부(또는 완전히 독립된 mirror 타입)로 닫혀 있어 다른 패키지에
파급되지 않는다. `conversationEnded.reason` 에 신규 값(`"user_ended"`)이 추가된 점만 host 문서화 관점에서
참고할 만하나 차단 사유는 아니다.

## 위험도
LOW
