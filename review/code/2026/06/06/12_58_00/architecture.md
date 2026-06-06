# 아키텍처(Architecture) 리뷰

## 발견사항

### [INFO] eager start 모델 전환 — 상태기계·레이어 책임 일관성 유지
- 위치: `codebase/channel-web-chat/src/lib/widget-state.ts` `WidgetAction` union, `codebase/channel-web-chat/src/widget/use-widget.ts` `start()`, `codebase/channel-web-chat/src/widget/components/panel.tsx` Composer `disabled`
- 상세: `START` 액션에서 `userText` 제거 → 상태기계가 사용자 입력값을 직접 보유하지 않는 방향으로 단순해졌다. `Composer` 비활성 조건이 `phase !== "awaiting_user_message"` 기준으로 집중되어, 프레젠테이션 레이어가 상태(`WidgetState`)를 단방향으로 소비하는 올바른 구조를 유지한다. 레이어 분리(프레젠테이션 → 상태기계 → 인프라)는 이번 변경 후에도 유효하다.
- 제안: 현 설계 유지.

### [INFO] `startedRef` + `sessionRef` 이중 가드 — 중복 시작 방지 패턴 올바름
- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` `start()` 함수
- 상세: `if (startedRef.current || sessionRef.current) return` 이중 가드는 (1) 중복 `open()` 호출, (2) 세션 복원 후 재open 두 경로를 모두 방어한다. 실패 시 `startedRef.current = false` rollback 패턴도 일관되게 적용되어 재시도 경로가 열려 있다. React `useRef` 기반 비동기 부작용 가드로서 관용적이고 적절한 패턴이다.
- 제안: 현 설계 유지.

### [WARNING] `useWidget` God Hook — 누적 관심사 집중, 이번 변경으로 `pendingSendRef` 큐가 추가됨
- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` 전체 (약 400줄 추정)
- 상세: 이전 리뷰(12_14_27)에서도 지적된 사항이나, 이번 변경(C1 resolution)으로 `pendingSendRef` 큐와 flush `useEffect` 가 추가되어 관심사가 9개로 증가했다. (1) iframe bridge, (2) 보안 검증, (3) 세션 영속화, (4) SSE 스트림, (5) 토큰 갱신 타이머, (6) 상태기계 디스패치, (7) 사용자 인터랙션, (8) eager 시작 가드, (9) booting 중 메시지 큐(C1). `pendingSendRef` 큐 로직은 단일 훅 내에서 `submitMessage` 콜백 + 별도 `useEffect` 두 곳에 분산되어 있어 큐 동작을 파악하려면 두 위치를 동시에 추적해야 한다. 기능적 결함은 아니나 훅의 복잡도 임계점을 넘어가고 있다.
- 제안: `pendingSendRef` + flush effect 를 `usePendingMessageQueue(phase, pending, sessionRef, sendCommand)` 같은 전용 훅으로 추출하면 큐 책임을 캡슐화하고 `useWidget` 의 관심사 집중을 줄일 수 있다. 즉각 필수는 아니나 backlog 등록 권장. 이번 변경 범위 내에서는 현 구조를 유지해도 무방하다.

### [INFO] C1 flush effect — 의존성 배열 설계
- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` C1 `useEffect` (flush effect)
- 상세: `useEffect(() => { ... }, [state.phase, state.pending, sendCommand])` 에서 `sendCommand` 가 `useCallback` 으로 메모이즈되어 있어 불필요한 재실행은 없다. `state.phase` 와 `state.pending` 두 값이 독립적으로 변경될 수 있어 의존성 배열이 최소 필요값을 정확히 포함하고 있다. `pendingSendRef` 는 ref 이므로 의존성 배열에 포함하지 않아도 되는 올바른 패턴이다.
- 제안: 현 설계 유지.

### [INFO] `newChat` 다단계 순서 의존성 — 주석 명시로 SRP 경계 완화
- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` `newChat` 콜백
- 상세: 이번 변경에서 `newChat` 에 `refreshTimerRef` clearTimeout(W9)과 `pendingSendRef.current = null`(I1 누수 방지) 이 추가되어 순서 의존 단계가 7단계로 늘었다. 단, 코드 내 순서 의존성 주석("W9: newChat 직후 만료될 수 있는 토큰 갱신 타이머 정리", "I1: 이전 대화 booting 중 큐된 텍스트..." 등)이 추가되어 유지보수 시 맥락을 파악할 수 있다. SRP 위반 수준은 낮고, 향후 복잡도 증가 시 `resetConversation()` 헬퍼 추출을 검토할 수 있다.
- 제안: 현 수준으로 충분. backlog에 헬퍼 추출 가능성 메모.

### [INFO] `Composer` disabled 조건의 denylist 방식 — 확장성 주의
- 위치: `codebase/channel-web-chat/src/widget/components/panel.tsx` Composer `disabled` prop
- 상세: `pending?.type === "buttons" || pending?.type === "form"` 으로 denylist 방식 열거. `ExternalInteractionType` 이 현재 3종(`ai_conversation`/`buttons`/`form`)이므로 현 규모에서는 적절하다. 신규 interaction type 추가 시 이 조건을 함께 수정해야 함을 인식하고 있다(I6 backlog). 과도한 추상화 없이 현재 규모에 맞는 선택이다.
- 제안: type 이 5개 이상으로 늘어날 경우 `pending?.type !== "ai_conversation"` allowlist 방식으로 전환 고려 (기존 지적과 동일, backlog 유지).

### [INFO] 순환 의존성 — 신규 추가 파일 포함 없음 확인
- 위치: `use-widget-eager-start.test.ts`, `panel.test.tsx` (신규), `use-widget.ts` (수정)
- 상세: `use-widget-eager-start.test.ts` 는 `useWidget` 을 import 하는 테스트 파일이므로 프로덕션 의존성 그래프에 영향이 없다. `panel.test.tsx` 도 동일. `use-widget.ts` 의 신규 import 없음 — 기존 ref/hook API 만 사용. 순환 참조 없음 유지.
- 제안: 현 구조 유지.

### [INFO] `EiaClient.startConversation` 타입 시그니처 — 인터페이스 분리 원칙 준수
- 위치: `codebase/channel-web-chat/src/lib/eia-client.ts` `startConversation` payload 타입
- 상세: `firstMessage?: string` 제거 후 `{ profile?: Record<string, unknown>; [k: string]: unknown }` 로 정리. 더 이상 지원되지 않는 개념을 타입 경계에서 노출하지 않는 올바른 인터페이스 분리다. index signature `[k: string]: unknown` 는 향후 필드 추가의 탈출구로 적절히 유지된다.
- 제안: 현 설계 유지.

### [INFO] `panel` 중간 phase — spec 다이어그램과 코드 간 미묘한 drift (이전 리뷰와 동일)
- 위치: `codebase/channel-web-chat/src/lib/widget-state.ts` `OPEN` 핸들러, `spec/7-channel-web-chat/1-widget-app.md` 상태기계 다이어그램
- 상세: `open() → START → booting` 사이에 `panel` 중간 상태가 존재하나 spec 다이어그램에는 미표현. 이번 변경(resolution)에서 `widget-state.ts` 파일 상단 주석에 `panel(transient)` 이 명시되어 코드 레벨에서는 개선되었다. spec 다이어그램 갱신은 spec-drift backlog(W2/I1)로 위임된 상태이며, 기능 결함은 아니다.
- 제안: spec 다이어그램 갱신 backlog 유지. 코드 레벨 문서화는 충분하다.

---

## 요약

이번 변경은 이전 리뷰(12_14_27) Critical/Warning 해소를 위한 resolution 커밋(6a4af359)에 해당한다. C1(booting 중 텍스트 유실) 수정으로 `pendingSendRef` 큐와 flush effect 가 추가되었고, W5-W10 테스트 보강과 W9 타이머 정리가 적용되었다. 아키텍처 관점에서 상태기계·레이어 분리·단방향 의존성 원칙은 모두 유지되며, 신규 파일(`panel.test.tsx`, `use-widget-eager-start.test.ts`)은 테스트 계층에만 속해 프로덕션 의존성 그래프에 영향이 없다. 주요 아키텍처 주의사항은 `useWidget` 훅의 관심사 집중이 이번 C1 큐 추가로 한 단계 더 심화된 점이다 — 기능 결함 수준은 아니나 `usePendingMessageQueue` 추출을 backlog에 등록하는 것이 권장된다. 전반적으로 이전 리뷰의 아키텍처 WARNING들이 적절히 해소되었고, 나머지 미해결 사항(God Hook, spec 다이어그램 drift)은 INFO/backlog 수준으로 관리되고 있다.

## 위험도

LOW

STATUS: SUCCESS
