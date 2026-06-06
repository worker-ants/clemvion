# 아키텍처(Architecture) 리뷰

## 발견사항

### [WARNING] `useWidget` God Hook — 8개 관심사 단일 집중, 이번 변경으로 누적 심화
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget.ts` 전체 (~330줄)
- 상세: `useWidget` 훅이 (1) iframe bridge 수명 관리, (2) 임베드 보안 검증, (3) 세션 영속화·복원, (4) SSE 스트림 관리, (5) 토큰 자동 갱신 타이머, (6) 상태기계 디스패치, (7) 사용자 인터랙션 명령 처리, (8) eager 시작 가드(`startedRef`, `pendingSendRef`, C1 flush effect) — 8개 관심사를 단일 함수에서 관리한다. 이번 변경은 기존 흐름 수정 위주로 진행되었으나 `startedRef`, `pendingSendRef`, C1 `useEffect`, `newChat` 확장 등이 이 훅에 추가되어 누적 복잡도가 경계 수준에 있다. 단일 책임 원칙(SRP) 관점에서 훅 자체가 너무 많은 책임을 진다.
- 제안: 즉각 리팩터는 불필요하나, 토큰 갱신 로직(`scheduleRefresh`, `refreshTimerRef`)을 `useTokenRefresh` 별도 훅으로 추출하는 것이 가장 독립성이 높은 후보다. backlog 등록 권장(이미 plan에 W4로 기재됨).

### [WARNING] `newChat` — SRP 경계 초과 및 순서 의존성 취약
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget.ts` — `newChat` 콜백
- 상세: `newChat`이 `closeStream → refreshTimerRef 정리(W9) → clearSession → sessionRef=null → startedRef=false → dispatch(NEW_CHAT) → void start()` 6단계를 하나의 콜백에서 순서 의존적으로 처리한다. 각 단계의 순서가 중요(예: `sessionRef=null`이 `start()` guard에 영향, `closeStream` 이전 타이머 정리가 null된 ref 쓰기 방지)하지만 이 의존성이 코드 내에서 명확하게 드러나지 않는다. `start()` 가드의 리셋 책임이 `newChat` 내부에 분산되어, 향후 세 번째 호출 경로가 생길 경우 리셋을 누락하기 쉽다.
- 제안: 순서 의존적 단계 각각에 이유를 인라인 주석으로 명시(이미 W3/W9 처리로 주석 추가 완료됨 — 현 상태에서 주석 수준은 양호). 향후 복잡도 증가 시 `resetAndStart()` 헬퍼로 리셋+시작을 캡슐화 고려.

### [INFO] `start()` 공개 노출 — 인터페이스 분리 원칙(ISP) 위배 소지
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget.ts` 반환 객체 `actions.start`
- 상세: eager 시작 이후 `start`는 `open()` 내부에서만 호출되어야 하는 내부 함수임에도 `actions` 객체에 공개 노출된다. 주석("I3: start 는 open() 이 자동 호출 — 외부 직접 호출 불필요. 하위 호환 목적으로 노출 유지")으로 의도가 명시되어 있으나, ISP 관점에서 호출자가 필요하지 않은 API surface를 제공하는 것은 개선 여지가 있다.
- 제안: 하위 호환을 깨지 않는다면 향후 `start`를 `actions`에서 제거하거나 `deprecated` 주석 추가. 현재 주석 수준은 기능 결함 없음.

### [INFO] `panel.tsx` Composer disabled 조건 — `pending.type` 열거 allowlist 방식 미전환
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/components/panel.tsx` L104–114
- 상세: `phase !== "awaiting_user_message" || pending?.type === "buttons" || pending?.type === "form"` 조건에서 `"buttons"`, `"form"` 두 값이 blocklist 방식으로 명시된다. `ExternalInteractionType` 에 새 타입이 추가될 경우 이 조건 수정을 누락하면 의도치 않게 Composer가 활성화될 수 있다. 개방-폐쇄 원칙(OCP) 관점에서 확장 시 수정이 필요한 구조다.
- 제안: 값이 5개 이상으로 늘어나면 `phase !== "awaiting_user_message" || pending?.type !== "ai_conversation"` 형태의 allowlist 방식으로 전환. 현재 3개(`ai_conversation`/`buttons`/`form`) 고정이므로 즉각 변경 의무 없음.

### [INFO] `widget-state.ts` `panel` 중간 phase — spec 다이어그램과 코드 미묘한 불일치
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/lib/widget-state.ts` `OPEN` 케이스, `spec/7-channel-web-chat/1-widget-app.md` §3 다이어그램
- 상세: 갱신된 spec 다이어그램이 `[panel](transient)` 중간 단계를 표시하도록 수정되어 이전 리뷰 대비 개선됐다. 코드의 `OPEN → "panel"` 후 `START → "booting"` 전이 패턴과 spec 표현이 이제 더 일관적이다. 단 `panel` phase가 `WidgetPhase` union에 잔존하며 `CLOSE`/`NEW_CHAT` 처리에도 사용되므로 완전히 transient로 다루기 어려운 구조적 제약이 남아 있다.
- 제안: 현 상태 유지. `NEW_CHAT` 리듀서가 반환하는 `phase: "panel"`도 즉시 `start()` 가 `booting`으로 전환하므로 기능 결함 없음.

### [INFO] C1 flush `useEffect` — 레이어 책임 경계 적절
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget.ts` C1 flush effect
- 상세: `state.phase`/`state.pending` 변화를 감지해 `pendingSendRef`를 flush하는 `useEffect` 패턴은 React의 상태 반응성을 올바르게 활용한다. `pendingSendRef`(최신 1건 보관)의 단순 큐 설계는 필요 이상의 복잡도를 피한 적절한 추상화다. 비즈니스 로직(큐 flush)이 훅 내부에 위치하여 프레젠테이션(panel.tsx)과 데이터(session) 레이어 사이의 조율 역할을 잘 수행한다.
- 제안: 현 설계 유지. 큐가 최신 1건만 보관하는 제약은 단일 입력창 UX에서 합리적이나, 향후 다건 선입선출이 필요해지면 배열 큐로 교체 고려.

### [INFO] 순환 의존성 — 없음 확인
- 위치: 변경된 모든 파일
- 상세: `eia-client.ts` → (외부 fetch/EventSource만), `widget-state.ts` → `conversation`, `eia-types`, `use-widget.ts` → `eia-client`, `eia-types`, `eia-events`, `conversation`, `session-store`, `widget-state`, `host-bridge`. 단방향 의존성 그래프이며 순환 참조 없음.
- 제안: 현 구조 유지.

### [INFO] `EiaClient.startConversation` 타입 시그니처 — `firstMessage` 제거는 인터페이스 분리 원칙에 부합
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/lib/eia-client.ts` `startConversation` 메서드
- 상세: `payload` 타입에서 `firstMessage?: string` 필드를 제거한 것은 클라이언트 계약에서 더 이상 지원하지 않는 개념을 노출하지 않는 올바른 인터페이스 분리다. `[k: string]: unknown` 인덱스 시그니처 잔존으로 타입 강제가 완전하지 않으나(`firstMessage`를 넘겨도 런타임에서 그대로 직렬화됨), `use-widget.ts`에서 해당 필드를 전달하는 코드가 완전 제거되어 실질적 위험 없음.
- 제안: 타입 강제 강화가 필요하면 `Omit<..., 'firstMessage'>` 명시 또는 인덱스 시그니처 제거 고려. 현재 규모에서는 현행 유지 적절.

### [INFO] 상태기계 단일 진실 — `phase` 기반 UI 렌더 조건이 레이어 책임 분리에 부합
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/components/panel.tsx`, `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/lib/widget-state.ts`
- 상세: `WidgetState.phase`가 UI 렌더 조건의 단일 진실 역할을 하고, `panel.tsx`는 이 상태를 읽어 Composer 활성화 여부를 결정한다. 프레젠테이션 → 상태 단방향 의존이며 역방향 참조 없음. 상태기계(reducer)는 순수 함수로 동시성 위험 없음.
- 제안: 현 설계 유지.

---

## 요약

lazy(첫 텍스트 입력 시 시작) → eager(패널 open 시 즉시 시작) 모델 전환의 아키텍처적 완성도는 전반적으로 양호하다. 이전 리뷰(12_14_27)에서 지적된 C1 텍스트 유실 Critical이 `pendingSendRef` 큐 + flush effect로 해소됐고, W3(newChat 주석), W9(refreshTimerRef 정리)도 처리 완료됐다. 상태기계 단일 진실, 프레젠테이션-비즈니스-인프라 레이어 분리, 단방향 의존성 그래프는 모두 건전하게 유지된다. 잔존 구조적 우려는 두 가지다: (1) `useWidget` God Hook의 누적 복잡도가 경계 수준으로, 토큰 갱신 로직 분리를 backlog에 유지해야 하며, (2) `newChat`의 6단계 순서 의존성이 단일 콜백에 집중되어 향후 경로 추가 시 리셋 누락 위험이 있다 — 현재 주석으로 의도가 명시되어 기능 결함은 없으나 유지보수 주의 필요. `panel.tsx`의 pending.type blocklist 방식은 타입 확장 시 OCP 우려가 있으나 현재 규모에서 과도한 추상화 없이 적절하다.

## 위험도

LOW

STATUS: SUCCESS
