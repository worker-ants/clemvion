# 아키텍처(Architecture) Review 결과

> 대상: 웹채팅 위젯 헤더 세션 컨트롤(새 대화/대화 종료) + `InteractionService.getStatus()` durable
> `conversationThread` 새로고침 히스토리 복원. 핵심 파일: `interaction.service.ts`,
> `conversation.ts`/`eia-types.ts`, `widget-state.ts`, `panel.tsx`, `use-widget.ts`.
> 참고: 본 diff 는 이미 2라운드 `/ai-review`(18_44_10)를 거쳐 아키텍처 관련 WARNING(phase 파생
> 위치 하드코딩)이 `isActiveConversationPhase` 를 `widget-state.ts` 로 이관하는 방식으로 이미
> 해소된 상태다. 아래는 그 이후 fresh 시점 기준 재점검 결과다.

## 발견사항

- **[INFO]** `waiting_for_input` wire-shape 빌더가 SSE/REST 두 경로에 독립적으로 손수 구현되어 있고, 이번 diff 가 그 중복에 필드 하나를 더 추가
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts` `getStatus()`(`base`/`buttonConfig`/`nodeOutput` 조립부) vs `codebase/backend/src/modules/execution-engine/{button-interaction,form-interaction,ai-turn-orchestrator}.service.ts` 의 SSE `waiting_for_input` emit 경로(둘 다 `cloneThread`/`interactionType`/`waitingNodeId`/`buttonConfig`/`nodeOutput` 형태를 각자 조립)
  - 상세: 주석에 "SSE 와 동일 wire shape" 이라고 명시돼 있지만, 실제로는 공유 빌더 함수가 아니라 두 모듈이 각자 손으로 같은 shape 을 재구현하는 기존 구조다(이번 diff 로 새로 생긴 문제는 아님). 이번 변경은 그 위에 `conversationThread` 필드 하나를 두 곳(REST 의 `base`, SSE 의 각 `*-interaction.service.ts`)에 수동으로 동기화해 추가했다 — 즉 기존의 "사람이 손으로 두 빌더를 맞춰야 하는" 위험 표면이 필드 1개만큼 넓어졌다. 현재는 JSDoc/주석과 unit 테스트로 방어하고 있으나, 향후 필드가 하나 더 늘면 같은 패턴이 반복될 개연성이 있다.
  - 제안: 즉시 조치 불필요(저위험, 테스트로 커버됨). 백로그로 `buildWaitingForInputWirePayload(nodeOutput, conversationThread, interactionType)` 같은 공용 순수 함수를 `shared/` 에 추출해 SSE emit 경로와 REST `getStatus` 가 같은 함수를 호출하도록 통합하면 이 클래스의 구조적 중복이 해소된다.

- **[INFO]** `TurnSource` 유니온이 서로 다른 두 개념(백엔드 wire enum vs 프런트 로컬 dispatch 마커)을 하나의 플랫 타입으로 합침
  - 위치: `codebase/channel-web-chat/src/lib/eia-types.ts` `TurnSource`(`"live" | "injected" | "presentation_user" | "ai_user" | "ai_assistant" | "ai_tool" | "system"`)
  - 상세: 5개는 백엔드 `ConversationTurnSource`(wire 계약, SoT `spec/conventions/conversation-thread.md`)이고 2개(`live`/`injected`)는 위젯 로컬 dispatch/레거시 fixture 전용 마커로 서로 출처와 수명주기가 다르다. 인터페이스 분리 관점에서는 두 타입(`WireTurnSource`/`LocalTurnSource`)으로 나누고 `ConversationTurn.source` 는 union 을 받되 경계(예: `threadToMessages` 진입점)에서만 두 종류를 합류시키는 편이 "wire 값에 로컬 마커가 섞여 들어올 수 없다"는 불변식을 타입 레벨에서 강제할 수 있다. 현재는 JSDoc 주석으로만 구분을 설명한다. 이미 이전 리뷰 라운드에서 INFO(#16)로 식별되어 "값 증가 시 분리 검토"로 명시적으로 defer 된 사항이라 이번엔 재차 확인만 한다.
  - 제안: 조치 불필요(기 defer 결정 존중). 향후 wire enum 값이 더 늘거나 두 마커가 실제로 오용되는 사례가 생기면 타입 분리를 재검토.

- **[INFO]** `useWidget` 훅의 세션 라이프사이클 ref(`startedRef`/`sessionRef`/`startGenRef`)가 계속 늘어나며 서로의 불변식을 함수 여러 곳에서 수동으로 맞춰야 함
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` (`startGenRef` 신설, `start()`/`teardownSession()`/`resetSessionRefs()`에 흩어진 3개 ref 조작)
  - 상세: 이번 PR 은 booting 중 종료/새 대화가 in-flight `start()` 를 되살리는 race 를 막기 위해 `startGenRef` 세대 카운터를 추가했다. 패턴 자체(단조 증가 세대 토큰으로 stale async 결과 무효화)는 React 에서 흔한 정석적 해법이라 문제는 아니다. 다만 `startedRef`(중복 시작 방지)·`sessionRef`(세션 존재 여부)·`startGenRef`(세대)가 각각 독립된 `useRef` 로 존재하고, `teardownSession`/`resetSessionRefs`/`start` 세 함수에 걸쳐 이 셋을 정확한 순서로 함께 갱신해야 race-safety 가 유지된다. 세 번째·네 번째 race 케이스가 추가로 발견될 때마다 같은 패턴(새 ref 추가 + 여러 함수에 조작 흩뿌리기)이 반복되면 훅의 암묵적 불변식이 늘어나 유지보수 난이도가 커질 소지가 있다.
  - 제안: 즉시 조치 불필요(현재 3개는 관리 가능한 수준이고 각 조작 지점에 근거 주석이 충실함). 향후 race guard 가 더 늘어난다면 이 셋을 `{ started, session, gen }` 형태의 단일 세션-라이프사이클 상태 객체로 캡슐화하는 소규모 리팩터를 backlog 로 고려할 것.

## 긍정적 관찰 (참고)

- `isActiveConversationPhase(phase)` 를 `panel.tsx` 하드코딩에서 `widget-state.ts` 로 이관해, `isTextInputSurface` 선례와 같은 방식으로 "phase 파생 로직은 상태 모듈에 단일화, 프레젠테이션은 결과만 소비" 라는 레이어 책임 분리가 잘 지켜지고 있다. 프레젠테이션(`panel.tsx`) → 도메인(`widget-state.ts`) 의존 방향도 올바르다(역방향 의존 없음).
- `panel.tsx` 의 `CONFIRM_COPY: Record<ConfirmKind, {...}>` 조회 테이블은 문구/확정 라벨/실행 액션 3중 분기를 데이터 주도 구조로 통합한 사실상 Strategy 패턴으로, 향후 세 번째 `ConfirmKind` 추가 시 변경 지점이 테이블 1곳으로 좁혀져 개방-폐쇄 원칙에 부합한다.
- 백엔드 `interaction.service.ts` 의 `base = { interactionType, waitingNodeId, ...(conversationThread ? {...} : {}) }` 선조립도 동일한 취지로 `buttons`/`else` 두 분기의 공통 필드 중복을 줄였다.
- `InteractCommand`(`end_conversation`/`cancel`) 를 신규 API 표면 없이 재사용해 `endConversation` 을 구현한 점, `ExecutionStatusDto.context` 를 breaking 없이 additive 하게 확장한 점은 기존 계약을 존중하는 확장 방식이다.
- 모듈 경계: `external-interaction` 모듈이 `Execution.conversationThread` 엔티티 필드를 읽기 전용으로 소비하는 방식은 기존 `outputData` 읽기와 동일한 구조를 재사용한 것으로, 이번 diff 가 새로운 순환 의존성이나 계층 위반을 도입하지 않았다.

## 요약

이번 변경은 기존 코드베이스의 확립된 패턴(phase 파생 단일화, 조회 테이블 기반 분기 통합, additive DTO 확장, 세대 토큰 race guard)을 일관되게 따르고 있으며, 이미 앞선 2라운드 리뷰에서 지적된 아키텍처 관련 WARNING(phase 파생 로직의 프레젠테이션 레이어 하드코딩)이 `widget-state.ts` 이관으로 해소된 상태다. 이번 fresh 점검에서 새로 발견한 항목은 모두 INFO 수준으로, (1) SSE/REST 두 경로가 같은 wire shape 을 독립적으로 손수 유지하는 기존 구조가 이번에 필드 1개만큼 더 확장된 점, (2) `TurnSource` 유니온이 백엔드 wire enum 과 프런트 로컬 마커를 한 타입에 합쳐둔 점(이미 defer 결정됨), (3) `useWidget` 훅의 세션 라이프사이클 ref 가 늘어나는 추세로, 셋 다 즉시 조치가 필요한 수준은 아니고 향후 유사 변경이 반복될 경우를 대비한 저위험 백로그 후보다. 순환 의존성, 레이어 책임 위반, 모듈 경계 침해는 발견되지 않았다.

## 위험도
LOW
