# 유지보수성(Maintainability) 리뷰

## 검토 방법

이번 diff(`origin/main`(`8e0728a90`)..HEAD)는 `ws-event-types-extract` 리팩터(`websocket.service.ts`
의 값/타입 선언을 의존성-프리 모듈 `websocket-events.types.ts` 로 분리 + 25개 소비 지점 import
재배선)와, 그 위에 이미 두 차례 코드 리뷰 라운드(`19_27_37`, `20_05_17`)가 지적한 Warning 전부를
반영한 수정 커밋(`65da1a9d7`, `a6d764ac6`)을 포함한다. `review/**`·`plan/**` 문서는 프로세스
산출물이라 이전 두 라운드와 동일하게 소스 코드 유지보수성 관점 밖으로 판단해 대상에서 제외했다.

이전 두 라운드가 지적한 항목(클래스 JSDoc 고아화, `NotificationEventType` 이중 JSDoc, WARN #10
고아 주석, `websocket.gateway.ts` 순환 노드 누락, 회귀 가드 부재, `ExecutionChannelEvent` 3곳
`import type` 누락)은 현재 소스(`websocket-events.types.ts`, `execution-event-emitter.service.ts`,
`websocket.service.ts`, `websocket.gateway.ts`, `websocket-events.types.spec.ts`)를 직접 `Read`
하여 전부 실제로 반영됐음을 재확인했다. 이번 라운드는 그 위에서 새로 남은 것만 찾는다.

## 발견사항

- **[WARNING]** `import type` 통일 원칙이 이번 라운드에서도 4곳을 놓쳤다 — 직전 라운드가 정확히 같은 클래스의 결함 3곳을 찾아 고친 바로 그 파일들의 자매 지점
  - 위치:
    - `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts:5` (`ExecutionRoutingContext,`)
    - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:119` (`ChatChannelRoutingInfo,`)
    - `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:56-57` (`ToolCallCompletedPayload,` / `ToolCallStartedPayload,`)
  - 상세: `websocket-events.types.ts` 가 export 하는 이름 중 `ExecutionRoutingContext`·`ChatChannelRoutingInfo`·`ToolCallStartedPayload`·`ToolCallCompletedPayload` 는 전부 순수 `interface`(런타임 표현 없음)다. 실제 사용처를 대조하면 넷 다 타입 위치에만 쓰인다 — `ExecutionRoutingContext` 는 `execution-event-emitter.service.ts:191` 파라미터 타입, `ChatChannelRoutingInfo` 는 `execution-engine.service.ts:260,271` 반환 타입/캐스팅, `ToolCallStartedPayload`/`ToolCallCompletedPayload` 는 `ai-turn-executor.ts:789,854` 변수 타입 선언뿐이며 어디서도 값으로 참조되지 않는다(`grep -n "ExecutionEventType\."` 로 같은 파일에서 값으로 쓰이는 `ExecutionEventType`/`NodeEventType` 과 대비된다). 그런데도 이 넷은 각 파일에서 `ExecutionEventType`/`NodeEventType`(진짜 런타임 enum 값)과 **같은 value-import 문에** 섞여 있어 `import type` 이 빠져 있다.

    직전 라운드(`20_05_17` maintainability 리뷰, RESOLUTION W1)가 지적하고 고친 것이 정확히 이 클래스의 결함이다 — `ExecutionChannelEvent` 가 `WebsocketService`(값)와 분리되면서 순수 타입 statement 가 됐는데 `type` 키워드를 안 붙인 3곳(`chat-channel.dispatcher.ts` 등)을 찾아 통일했다. 그 RESOLUTION 은 "이 PR 이 세운 원칙이자 새 가드의 판별 기준(`isTypeOnly`)이므로 신호를 흐리게 두면 안 된다"고 명시했다. 그런데 그 스윕이 `ExecutionChannelEvent` 단독 import 3곳만 훑었고, `websocket-events.types.ts` 가 export 하는 나머지 7개 인터페이스 중 값과 **같은 import 문에 섞여** 있던 이 4곳은 대상에서 빠졌다 — 두 라운드 리뷰를 거치고도 남은, 같은 실패 패턴의 재발이다.
  - 기능 영향: 없음. `tsconfig.json` 에 `verbatimModuleSyntax`/`importsNotUsedAsValues` 가 꺼져 있고 `tsc` 는 사용처 기준으로 미사용 타입 import 를 알아서 erase 하며, `eslint.config.mjs` 에 `@typescript-eslint/consistent-type-imports` 류 규칙이 없어(grep 0건) lint 도 통과한다 — 즉 두 게이트(`tsc`/`eslint`) 모두 이 불일치를 잡지 못한다.
  - 왜 이번 턴에 정리할 가치가 있는가: 이 PR 이 신설한 회귀 가드(`websocket-events.types.spec.ts` 의 `valueEdgeToWebsocketService`)는 `import type` 여부(`isTypeOnly`)를 판별 기준으로 값 간선/비간선을 가른다. 지금 이 4곳처럼 "타입 전용인데 값 import 형태"인 상태가 프로젝트 관례로 남으면, 향후 실수로 이 4개 인터페이스 중 하나가 `websocket.service` 경유로 되돌아가도 같은 애매함이 반복된다 — 이 PR 이 명시적으로 세운 "값/타입을 statement 수준에서 명확히 가른다"는 원칙과 어긋난다.
  - 제안: 넷 다 `import { type ExecutionRoutingContext, ExecutionEventType, NodeEventType } from '../../websocket/websocket-events.types';` 형태(또는 별도 `import type { … }` 문)로 통일. 이미 같은 파일들의 다른 인터페이스(`ExecutionChannelEvent` 등)가 정답 형태를 보여주고 있어 기계적 1줄 수정이고 리스크 없음.

## 그 외 확인 — 새로 지적할 결함 없음

- `execution-event-emitter.service.ts` 의 `TERMINAL_SHAPE` 모듈 스코프 상수와 그 JSDoc 배치(클래스 JSDoc 위)는 직전 라운드 W2 지적대로 교정되어 있고, 이름·구조 모두 명확하다.
- `websocket-events.types.ts` 는 파일 전체가 export 전용(값 4 enum + 인터페이스/타입 8개)이고 각 export 마다 출처(spec 문서)·용도가 JSDoc 으로 설명되어 있어 가독성이 높다. `NotificationEventType` 이중 JSDoc, WARN #10 고아 주석은 확인 결과 모두 해소됨.
- `websocket-events.types.spec.ts` 의 `valueEdgeToWebsocketService`/`moduleSpecifiersOf` 는 분기가 여러 갈래(default/namespace/named/`export…from`/`import=require`)로 나뉘어 순환 복잡도가 다소 높지만, 각 분기가 대응하는 module-specifier 형태를 함수 상단 JSDoc 에서 정확히 열거하고 뮤테이션 테스트(RESOLUTION 기록 6/6, 4/4 RED)로 근거를 남겨 두어 복잡도가 정당화된다. 추가 조치 불필요.
- 나머지 22개 파일의 import 경로 교체는 전부 기계적 1:1 치환이며, 값(enum)과 타입을 이미 올바르게 가른 지점(`chat-channel.dispatcher.ts`, `interaction-stream.controller.ts`, `sse-adapter.service.ts`, `notification-fanout.service.ts`, `embedding.service.ts`, `graph-extraction.service.ts` 등)은 문제 없음.

## 요약

이 PR 은 두 차례의 코드 리뷰 라운드를 거치며 JSDoc 고아화, 순환 노드 누락, 회귀 가드 부재, 부분적
`import type` 누락 등 상당수의 유지보수성 결함을 실제로 해소했고, 그 반영 상태를 이번 라운드에서
소스 직접 대조로 재확인했다 — 새로 지적할 CRITICAL 급 결함은 없다. 다만 직전 라운드가 세우고 3곳에
적용한 "값/타입 import 를 statement 수준에서 명확히 가른다"는 원칙이, 같은 diff 안의 다른 4개
타입 전용 인터페이스(`ExecutionRoutingContext`·`ChatChannelRoutingInfo`·`ToolCallStartedPayload`·
`ToolCallCompletedPayload`)에는 적용되지 않고 남아 있다. 기능·컴파일에 영향은 없고 `tsc`/`eslint`
모두 잡지 못하는 순수 스타일 불일치이지만, 이 PR 스스로 세운 원칙이자 신설 회귀 가드의 판별
기준과 정확히 같은 축의 문제이므로 이번 턴에 함께 정리하는 편이 이후 재지적 비용보다 싸다.

## 위험도

LOW
