# 유지보수성(Maintainability) Review

## 발견사항

- **[INFO]** `USER_TURN_SOURCES` 가 `Set<string>` 으로 선언되어 `TurnSource` 리터럴 유니온의 오탈자 방지 이점을 놓침
  - 위치: `codebase/channel-web-chat/src/lib/conversation.ts:33`
  - 상세: 같은 변경에서 `TurnSource`(`eia-types.ts:38-45`)가 7개 리터럴 유니온으로 확장되고 SoT JSDoc까지 붙었는데, `USER_TURN_SOURCES = new Set<string>([...])` 는 느슨한 `string` 타입이라 `"ai_uesr"` 같은 오타를 넣어도 컴파일 타임에 잡히지 않는다. 직전 라운드 리뷰(`review/code/2026/07/09/18_44_10/maintainability.md` INFO #1)에서 이미 지적됐고 RESOLUTION.md 의 반영/보류 목록 어디에도 이 항목 번호가 명시적으로 매칭되지 않아, 코드 확인 결과 실제로 미반영 상태다.
  - 제안: `new Set<TurnSource>([...])` 로 좁혀 타입 체커가 union 범위 밖 값을 즉시 거부하도록 한다. 5분 내 처리 가능한 저비용 개선.

- **[INFO]** `"user_ended"` 문자열 리터럴이 한 함수 안에서 4회 반복
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:425-430` (`endConversation`)
  - 상세: `command.reason`(2곳), `dispatch({ type: "ENDED", reason: ... })`, `bridgeRef.current?.sendEvent("conversationEnded", { reason: ... })` 모두 `"user_ended"` 를 하드코딩한다. 파일 내 다른 곳(`sendCommand` 의 `"gone"`)은 1회성이라 문제가 없었지만, 이번처럼 같은 스코프에서 4회 반복되면 향후 사유 문자열을 바꿀 때 한 곳을 놓칠 회귀 위험이 생긴다.
  - 제안: 함수 상단에 `const reason = "user_ended";` 로 한 번만 선언해 재사용.

- **[INFO]** `state.pending!.nodeId` 비-null 단언이 별도로 계산된 `graceful` 불리언에 의존
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:420-425`
  - 상세: `graceful` 계산 시 `!!state.pending?.nodeId` 로 이미 존재를 확인했지만, TS 제어 흐름 분석이 이 불리언을 거쳐서는 `nodeId` 존재를 좁혀주지 못해 `state.pending!.nodeId` 별도 단언이 필요하다. 현재 스코프에선 안전하지만 두 표현식이 물리적으로 갈라져 있어, 향후 조건 로직만 리팩터링되면 단언만 남고 보장이 깨질 수 있다. 직전 라운드에서도 동일하게 지적됐고 여전히 그대로다.
  - 제안: `const nodeId = state.pending?.nodeId;` 로 한 번 추출해 `graceful` 계산·`command` 조립 양쪽에서 재사용하면 단언이 국소화된다.

- **[INFO]** `conversation.ts` 파일 헤더 주석이 신규 5-source role 매핑을 반영하지 못해 stale
  - 위치: `codebase/channel-web-chat/src/lib/conversation.ts:1-5`
  - 상세: 파일 최상단 요약 주석의 마지막 줄이 `- source 마커(live/injected)로 시각 분기.` 로 남아있다. 실제로는 `roleOf` 가 `live`/`injected` 2값이 아니라 백엔드 5-source(`presentation_user`/`ai_user`/`ai_assistant`/`ai_tool`/`system`)를 user/assistant 로 축약하는 로직이 바로 아래(27-45행)에 상세 JSDoc과 함께 추가됐다. 함수 단위 문서는 정확하지만, 파일을 훑어보는 개발자가 헤더만 읽으면 오래된 2-source 모델로 오인할 수 있다.
  - 제안: 헤더 마지막 줄을 `roleOf`(5-source→user/assistant, 명시 role 우선) 요약으로 갱신하거나, 상세는 `roleOf` JSDoc 를 참조하도록 짧게 정리.

## 요약

이번 변경분은 직전 리뷰 라운드(18_44_10)에서 지적된 WARNING 5건(부작용 순서·아키텍처 위치·세션정리 중복·접근성 이름 충돌·3중 삼항 분기)이 모두 실제로 반영돼 있음을 코드 레벨에서 확인했다 — `resetSessionRefs()` 헬퍼로 `newChat`/`endConversation` 공용 정리 로직을 추출했고, `isActiveConversationPhase()` 를 `widget-state.ts` 로 이관해 phase 파생 로직 SoT 를 지켰으며, `CONFIRM_COPY` 조회 테이블로 문구·라벨·액션 3중 분기를 통합하고, confirm 버튼에 별도 `aria-label` 을 부여해 헤더 버튼과의 접근성 이름 충돌도 해소했다. 백엔드 `getStatus()` 도 공통 필드(`base`)를 선조립해 두 분기의 중복을 줄였다. 함수 길이·중첩 깊이 모두 무난한 수준이며(`getStatus` 최대 3단 중첩, `endConversation` ~25줄), JSDoc 에 "왜" 를 촘촘히 남기는 기존 코드베이스 관례도 신규 코드 전반에서 일관되게 유지된다. 남은 항목은 모두 INFO 수준(느슨한 `Set<string>` 타이핑, 문자열 리터럴 소반복, non-null 단언 국소화 여지, 파일 헤더 주석 staleness)으로 이전 라운드에서도 이미 저위험으로 분류됐던 것들이며 즉시 조치가 필요한 수준은 아니다.

## 위험도
LOW
