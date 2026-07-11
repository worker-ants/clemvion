# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** `newChat()` coalesce 분기가 `usePendingMessageQueue.clearQueue()` 를 건너뛰어 이전(리셋 전) 큐잉 텍스트가 흡수된 새 세션으로 유출될 수 있음
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` `newChat` (L1090-1109), 특히 L1092 `if (startedRef.current && !sessionRef.current) return;`
  - 상세: 정상 경로(확립 세션발 새 대화·미시작 상태발 새 대화)는 `resetSessionRefs()` 를 거치며 그 안의 `clearQueue()` 가 "이전 대화 텍스트 누수 차단"(코드 주석 I1, `use-pending-message-queue.ts` L35-36)을 명시적으로 보장한다. 그러나 신설된 **coalesce 조기 반환**(`booting` 중 host `resetSession`/newChat 흡수)은 `resetSessionRefs()` 자체를 호출하지 않으므로 `clearQueue()` 도 실행되지 않는다. 재현 시나리오: 패널 open→`booting`(webhook POST in-flight) 중 사용자가 텍스트를 보내면 `submitMessage()` 가 세션 미확립으로 `enqueue(text)` 경로를 타 `pendingSendRef.current` 에 보관된다(`use-widget.ts` L1017-1035). 이 상태에서 host `resetSession`(booting 은 UI 게이트 밖이라 유일하게 도달 가능한 진입점, `widget-state.ts` 갱신된 주석이 명시)이 호출되면 coalesce 로 조기 반환되어 큐가 비워지지 않고, booting 이 settle 되어 첫 `ai_conversation` waiting 이 도착하면 flush effect(`use-pending-message-queue.ts` L57-74)가 그 **리셋 이전에 입력된 텍스트**를 "새 대화"의 첫 사용자 메시지처럼 `submit_message` 로 전송한다. Coalesce 설계 의도("흡수된 booting 세션이 곧 새 세션")와 배치되는, 리셋 경계를 넘는 상태 누수다.
  - 제안: coalesce 조기 반환 직전에도 `clearQueue()` 를 호출(또는 `resetSessionRefs()` 를 얇게 쪼개 큐만 비우는 헬퍼를 coalesce 분기에서도 실행)해 "새 대화" 호출이 큐 무효화를 항상 보장하도록 통일.

- **[INFO]** `newChat()` 에 신규 네트워크 부작용(EIA `cancel` 명령) 추가 — host-facing 동작이 실질적으로 바뀜
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` L1098-1107
  - 상세: 이전에는(plan 문서 R-B1 인용) "새 대화"가 서버에 명시 종료를 보내지 않았으나, 본 변경으로 확립 세션발 `newChat()`(헤더 "새 대화" 버튼 및 host `resetSession` 커맨드 공용 경로)이 `client.interact(..., { command: "cancel", reason: "user_new_chat" })` 을 fire-and-forget 으로 발사한다. 시그니처(`newChat: () => void`, `actions.newChat`)는 불변이라 외부 호출자 관점 breaking 은 아니지만, 호출 시 부수적으로 서버 execution 을 취소하는 새로운 관측 가능한 서버측 부작용이 생겼다. `prevSession`/`client` 를 `resetSessionRefs()`(SSE 종료·세션 clear) **이전**에 로컬 상수로 캡처해 stale-ref 위험 없이 옛 세션 엔드포인트로만 스코프됐고, 실패는 `console.warn` 으로만 처리(로컬 재시작을 되돌리지 않음)해 catch 되지 않은 rejection 도 없다. plan/spec(`spec-draft-webchat-execution-residuals.md` R-B1, consistency-check BLOCK:NO)에 사전 승인된 의도된 변경이라 이 자체는 결함이 아니고, 리뷰 관점에서 "네트워크 호출 부작용 존재" 사실만 기록.

- **[INFO]** 테스트 헬퍼 `installFetch()` 변경이 이 파일의 모든 기존 테스트에 영향 — `/interact` 미기대 호출을 마스킹할 수 있음
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` L255-260(`installFetch` 내부에 `/interact` → 202 분기 추가)
  - 상세: `installFetch()` 는 이 diff 이전부터 이 파일의 다수 기존 테스트(`open() → 워크플로우 시작`, `open() 중복 호출`, 세션 복원 테스트 등)가 공용으로 쓰는 헬퍼다. 신규 분기는 `/interact` 요청을 전부 `202` 성공으로 응답하도록 바꿔, 만약 기존/다른 테스트에서 `submitMessage`/`clickButton`/`submitForm` 등이 의도치 않게 `sendCommand`(내부적으로 `client.interact` 호출)를 트리거해도 이전처럼 `Promise.reject(new Error("unexpected fetch ..."))` 로 드러나지 않고 조용히 성공 처리된다. `sendCommand` 자체가 이미 try/catch 로 감싸(`dispatch({type:"ERROR"})`) unhandled rejection 을 만들지는 않았으므로 실질 위험은 낮으나, "예상치 못한 `/interact` 호출"을 검증에서 걸러낼 여지가 diff 로 인해 줄었다(테스트 관측성 저하). 주석("call-count 는 응답 성패와 무관하므로 기존 interactCalls().length 단언에 영향 없음")은 호출 카운트 단언만 보증하며 이 관측성 저하까지 다루지는 않는다.
  - 제안: 필요 시 신규 R9 테스트 전용 fetch mock(현재 booting coalesce 테스트가 이미 별도 `fetchMock` 을 만든 것처럼)만 `/interact` 를 다루게 하고 공용 `installFetch()` 는 최소한으로 유지하는 대안도 고려 가능(선택 사항, 강제 아님).

## 확인된 항목 (부작용 없음)

- `widget-state.ts` 변경은 JSDoc 주석뿐이며 `isActiveConversationPhase`/reducer 로직·시그니처 무변경 — 런타임 부작용 없음.
- 신규 네트워크 호출(`cancel`)과 기존 SSE 스트림 종료(`closeStream`)의 순서가 안전 — 옛 세션 스트림은 cancel 발사 전에 이미 닫혀 있어 서버가 유발할 수 있는 terminal SSE 를 재수신해 `conversationEnded` 를 중복 발사할 경로가 없다.
- refs(`sessionRef`/`startedRef`/`clientRef`/`startGenRef`)는 모두 `useWidget()` 훅 인스턴스 스코프 — 전역 변수·모듈 레벨 공유 상태 도입 없음.
- `newChat`/`start`/`resetSessionRefs` 공개 시그니처(`actions.newChat` 등) 불변 — 기존 호출자(헤더 버튼, host bridge `resetSession` 커맨드, 하위호환 re-export) 영향 없음.
- 환경 변수·파일시스템 접근 신규 도입 없음(`sessionStorage` 관련 `clearSession`/`saveSession` 은 기존 경로 그대로, 이 diff 가 건드리지 않음).
- 재시도 double-fire 방지: coalesce 조건(`startedRef.current && !sessionRef.current`)이 `newChat()` 연속 호출(더블클릭 등)에서도 두 번째 cancel/POST 발사를 막는 것으로 확인.

## 요약
핵심 변경(`use-widget.ts` `newChat()`)은 booting 중 host `resetSession` 흡수(coalesce)와 확립 세션발 best-effort `cancel` 을 추가해 중복 webhook·서버 orphan 을 줄이려는 의도된 부작용 확장으로, 네트워크 호출 자체는 스코프·실패 처리·순서 모두 안전하게 설계됐다. 다만 coalesce 조기 반환 경로가 정상 경로와 달리 `clearQueue()` 를 생략해, booting 중 큐잉된 텍스트가 리셋 경계를 넘어 새(흡수된) 세션으로 유출될 수 있는 상태 누수 결함이 하나 발견됐다(WARNING). 그 외 테스트 헬퍼 공용 변경으로 인한 관측성 저하는 낮은 위험의 참고 사항이다.

## 위험도
MEDIUM
