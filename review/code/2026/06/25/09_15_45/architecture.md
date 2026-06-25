# 아키텍처(Architecture) 리뷰

## 발견사항

- **[INFO]** `AI_MESSAGE` reducer 재사용으로 인한 행위 계약 모호성
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` — `else if (name === "execution.message")` 분기
  - 상세: `execution.message`(표시-전용 presentation 노드 자동 진행)를 처리할 때 기존 `AI_MESSAGE` reducer action을 재사용하고 `text: ""`로 비운다. 이는 단기적으로 동작하지만 reducer가 `AI_MESSAGE`에 대해 갖는 암묵적 불변식(AI 생성 메시지, turnCount 등)과 `execution.message`의 의미가 다르다. 현재 `text/presentations` 분리 렌더가 우연히 호환되는 것이다. 나중에 `AI_MESSAGE` reducer에 AI-전용 필드(예: turnCount 업데이트, AI 신뢰도 표시 등)가 추가되면 `execution.message` 경로에서 의도치 않게 영향을 받을 수 있다.
  - 제안: 단기 허용 가능(현재 구조에서 risk 낮음). 중장기적으로 `PRESENTATION_MESSAGE`(또는 `DISPLAY_MESSAGE`) 전용 action을 widget-state reducer에 도입해 AI_MESSAGE 계약과 명확히 분리하는 것이 OCP·SRP 관점에서 바람직하다. spec R18에 "위젯 reducer 재사용" 결정 근거가 이미 명시되어 있으므로, 분리 시 해당 결정도 갱신 필요.

- **[INFO]** `postCommand` 함수의 `action: string` 타입 — 오타 방지 타입 보강 가능
  - 위치: `codebase/frontend/src/components/web-chat/live-preview.tsx` `postCommand` 함수
  - 상세: `postCommand(action: string)`은 현재 호출부가 `postCommand("resetSession")` 단일이라 문제없지만, 향후 `"open"`/`"close"`/`"shutdown"` 등 다른 command가 추가될 때 문자열 오타를 컴파일 타임에 잡을 수 없다. 2-sdk spec §3의 `wc:command` action 목록이 union type으로 선언되어 있지 않아 프론트엔드와의 타입 계약이 느슨하다.
  - 제안: `type WcCommandAction = "open" | "close" | "show" | "hide" | "sendMessage" | "updateProfile" | "shutdown" | "resetSession"` literal union을 공용 web-chat 타입 모듈에 정의하고 `postCommand(action: WcCommandAction)`으로 강화. INFO 수준이므로 긴급하지 않음.

- **[INFO]** `ParsedAiMessage`와 `ParsedMessage`의 `presentations` 필드 타입 중복
  - 위치: `codebase/channel-web-chat/src/lib/eia-events.ts` `ParsedAiMessage`·`ParsedMessage` 인터페이스
  - 상세: 두 인터페이스가 동일 타입(`Array<Record<string, unknown>> | undefined`)과 동일 정규화 규약(빈 배열 → undefined)을 독립 선언한다. 추상화 레벨에서 공통 base가 존재함을 암시한다.
  - 제안: 현재 인터페이스가 2개라 중복이 미미하여 허용 가능. 3개 이상이 되거나 presentations 필드 구조가 바뀔 때 `interface WithPresentations { presentations?: Array<Record<string, unknown>>; }` base를 추출해 합성하는 것을 검토. 현재는 INFO.

- **[INFO]** `PRESENTATION_NODE_TYPES` Set과 노드 카테고리 사이의 암묵적 결합
  - 위치: `codebase/backend/src/common/constants/presentation.ts` 전체
  - 상세: `PRESENTATION_NODE_TYPES`는 string Set으로 `node.type` 문자열을 판별한다. 백엔드에 `NodeCategory.PRESENTATION` enum이 이미 존재하나(테스트 파일에서 `NodeCategory.PRESENTATION` 참조 확인), non-blocking presentation 구분에는 form 제외 목적으로 별도 Set이 필요했다. 다만 5번째 non-blocking presentation 노드 타입이 추가될 때 Set 갱신을 잊으면 해당 노드의 `execution.message`가 미발행된다.
  - 제안: JSDoc에 이미 form 제외 이유가 명시되어 있어 의도된 설계임은 분명하다. 향후 노드 핸들러가 `isDisplayOnly: true`처럼 메타데이터를 반환하도록 확장하는 방향이 OCP 측면에서 더 유연하다. 현재는 INFO.

## 요약

이번 변경은 세 가지 개선(presentation 노드 `execution.message` 이벤트 신설, 세션 초기화 command, 2-column 미리보기 레이아웃)을 일관된 아키텍처 결정 위에 구현한다. `PRESENTATION_NODE_TYPES`를 `common/constants`로 격리해 execution-engine→chat-channel 의존 방향 위반을 사전 차단한 점, `{config, output}` flat envelope를 변환 없이 위젯 렌더 경로에 재사용해 불필요한 변환 레이어를 제거한 점, `postCommand`가 `postBoot`와 동형의 widgetOrigin 가드를 따른 점은 모두 결합도·모듈 경계·일관성 측면에서 양호하다. `execution.message`를 SSE 표면에만 additive로 추가해 chat-channel(Telegram 등)의 중복 발화를 방지한 설계도 레이어 책임을 명확히 지킨다. CRITICAL 또는 WARNING 수준의 아키텍처 위반은 없으며, 발견된 INFO 4건은 모두 중장기 개선 관점의 제안으로 현재 코드 동결에 적합하다.

## 위험도

LOW
