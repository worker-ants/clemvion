# 유지보수성(Maintainability) 리뷰

## 발견사항

### [INFO] `use-widget.ts` — `startedRef` 가드 해제 책임이 `newChat` 에 분산
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget.ts` — `newChat` useCallback, `start` 함수
- 상세: `start()` 내부에서 `startedRef.current || sessionRef.current` 를 체크하는 guard 가 있으나, 이 guard 를 "뚫는" 리셋(`startedRef.current = false`)은 `newChat` 에서 수행된다. 가드 소유자(`start`)와 가드 해제자(`newChat`)가 다른 함수에 분산되어 있어, 향후 세 번째 재시작 경로(예: 에러 복구 후 재시도 버튼)가 추가될 때 리셋을 누락하기 쉽다.
- 제안: `resetAndStart()` 헬퍼로 "리셋 + 시작"을 하나의 단위로 캡슐화하거나, `start(force?: boolean)` 파라미터로 명시적 재시작 경로를 한 곳에 모으는 것을 고려한다.

### [INFO] `use-widget.ts` — `newChat` 콜백 내 5단계 순서 의존성 미문서화
- 위치: `newChat` useCallback (diff 기준 use-widget.ts `newChat` 구현부)
- 상세: `closeStream → clearTimeout(refreshTimerRef) → clearSession → sessionRef.current = null → startedRef.current = false → dispatch(NEW_CHAT) → start()` 의 실행 순서가 중요하다. `sessionRef` null 설정이 `start` guard 통과 여부에 직접 영향을 주고, `closeStream` 이 `sessionRef` 무효화 전에 와야 SSE 닫기가 안전하다. 이러한 순서 의존성이 주석 없이 나열되어 있어, 임의 순서 변경 시 버그가 조용히 유입될 수 있다.
- 제안: 각 단계 옆에 "이 순서를 바꾸면 X 버그" 수준의 한 줄 주석으로 의존 관계를 명시한다(이미 추가된 JSDoc 블록에 순서 설명이 있으나, `refreshTimerRef` clearTimeout 추가 이후 최신 순서를 반영해 업데이트 필요).

### [INFO] `use-widget.ts` — `submitMessage` 와 `panel.tsx` Composer `disabled` 의 이중 guard 연관성 미표시
- 위치: `submitMessage` useCallback, `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/components/panel.tsx` Composer disabled prop
- 상세: UI 레이어(`panel.tsx`)에서 `awaiting_user_message` 가 아니면 Composer 를 비활성화하고, 로직 레이어(`submitMessage`)에서도 `sessionRef.current && phase === "awaiting_user_message"` 를 체크해 silent drop 한다. 두 guard 가 서로를 모르는 채 독립적으로 작성되어 있어, 어느 한 쪽 조건이 완화될 때 다른 쪽의 의도가 파괴된다. 현재는 방어적 중복이지만 미래 유지보수에서 불일치 위험이 있다.
- 제안: 각 위치에 "UI guard 와 logic guard 가 함께 동작 — 양쪽 모두 변경 시 주의" 수준의 상호 참조 주석을 추가한다.

### [INFO] `panel.tsx` — Composer `disabled` 조건의 이중 체크 목적 불분명
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/components/panel.tsx` — Composer disabled prop
- 상세: `phase !== "awaiting_user_message" || pending?.type === "buttons" || pending?.type === "form"` 에서 `awaiting_user_message` 이면서 `buttons`/`form` 이 `pending` 에 있는 경우가 실제 상태기계상 가능한지 명시되어 있지 않다. 만약 상태기계가 이미 두 조건의 공존을 보장한다면 `phase` 체크만으로 충분하고, 독립적으로 발생할 수 있다면 그 이유가 문서화되어야 한다.
- 제안: 한 줄 주석으로 "awaiting_user_message 이어도 buttons/form pending 이면 텍스트 입력 비대상 — 상태기계 이중 방어" 등 의도를 명시하거나, 상태기계가 보장한다면 `phase` 단일 조건으로 단순화한다.

### [INFO] `use-widget-eager-start.test.ts` — `setTimeout(r, 20)` 매직 넘버(이미 상수 추출됨, 주석 보완 필요)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` — `NO_EXTRA_CALL_WAIT_MS = 20`
- 상세: 이번 변경에서 `NO_EXTRA_CALL_WAIT_MS = 20` 상수로 추출되어 개선되었다. 그러나 왜 20ms 인지(jsdom 마이크로태스크 flush 이후 추가 POST 없음을 확인하는 최소 대기 시간)에 대한 설명이 없다. CI 환경에 따라 flaky 해질 가능성은 남아 있다.
- 제안: 상수 선언 옆 주석에 "jsdom 비동기 flush 이후 추가 POST 없음 확인을 위한 최소 대기 — CI 부하가 높으면 값 조정 필요" 정도의 설명을 추가한다. `vitest` fake timer + `waitFor` 역-assertion 패턴으로 전환하면 시간 의존성을 완전히 제거할 수 있다.

### [INFO] `use-widget-eager-start.test.ts` — `90 * 60 * 1000` 매직 넘버(이미 상수 추출됨)
- 위치: 테스트 상단 `NINETY_MIN_MS = 90 * 60 * 1000` 및 사용처
- 상세: 이번 변경에서 `NINETY_MIN_MS` 상수로 추출된 것은 올바른 처리다. 다만 이 값이 `use-widget.ts` 의 `TOKEN_REFRESH_LEAD_MS = 30 * 60 * 1000` 와 연관된 의미(토큰 TTL 90분, 갱신 리드 30분)임을 파악하려면 코드를 추가로 탐색해야 한다.
- 제안: `NINETY_MIN_MS` 상수 선언 옆에 "토큰 TTL 90분(ms) — 테스트 fixture 용 만료 시각 계산" 주석을 한 줄 추가하면 충분하다.

### [INFO] `use-widget-eager-start.test.ts` — `installFetch` 내 fetch mock 구현 C1 테스트에서 중복
- 위치: C1 테스트 케이스 내 인라인 `vi.fn()` (라인 527–548)와 `installFetch` 함수
- 상세: C1 테스트와 W8 테스트는 webhook 응답 fixture 구조가 `installFetch` 와 거의 동일하지만, 세부 제어 필요로 인라인으로 재구현되어 있다. 응답 구조(`executionId`, `interaction`, `endpoints`)가 두 곳에 중복되어, 서버 응답 스키마가 변경될 때 둘 다 수정해야 한다.
- 제안: `installFetch(overrides)` 의 오버라이드 패턴을 더 유연하게 확장(`onPost?: (callCount: number) => Response`)하거나, 공통 응답 fixture 객체를 별도 상수로 추출해 두 케이스가 공유하도록 리팩터한다. 즉각 필수는 아니나, 테스트 수가 늘어나면 관리 부담이 커진다.

### [INFO] `eia-client.ts` — `openStream` 내 SSE 이벤트 이름 배열 하드코딩(이번 변경 직접 대상 아님)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/lib/eia-client.ts` — `openStream` 메서드
- 상세: SSE 이벤트 이름 배열이 하드코딩되어 있고, `eia-types.ts` 에 타입 정의가 있다면 중복이다. 새 이벤트 타입 추가 시 이 배열을 수동으로 동기화해야 한다. 이번 변경의 직접 대상은 아니나 기존 유지보수 취약점이다.
- 제안: `eia-types.ts` 에서 이벤트명 union/tuple 을 export 해 배열을 파생시킨다. 이번 PR 범위 밖이라면 `// TODO(I10): eia-types.ts union 에서 파생으로 전환` 주석 추가.

### [INFO] `widget-state.ts` — 파일 상단 주석의 phase 전환 흐름이 업데이트 완료, 일관성 확인됨
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/lib/widget-state.ts` — 파일 상단 주석
- 상세: `panel` 중간 phase 가 이번 변경 주석에서 제거되었고(`collapsed → (open) booting(eager 시작)`), `panel` 이 실제로는 코드 내에 여전히 존재하는 중간 상태다. 주석이 코드보다 단순화된 표현을 쓰고 있어, 신규 개발자가 `WidgetPhase` 에 `"panel"` 이 있는 것을 보면 주석과 코드가 다르다고 느낄 수 있다.
- 제안: 주석을 `collapsed → (open) panel(transient) → booting(eager, §R6) → streaming ↔ awaiting_user_message → ended` 형태로 `panel` 중간 단계를 `(transient)` 로 표시하면 코드와 주석이 정합성을 유지한다.

## 요약

이번 변경(lazy → eager start-on-open 전환)은 전반적으로 유지보수성 관점에서 양호한 품질이다. `startedRef` 가드 도입, `START` 액션 단순화, `firstMessage` 경로 제거 등으로 코드가 오히려 단순해졌고, 인라인 주석과 spec 참조(`§R6`)가 충분히 기록되어 의도 파악이 용이하다. 개선이 필요한 주요 포인트는 세 가지다: (1) `newChat` 에 분산된 `startedRef` 리셋 책임이 세 번째 재시작 경로 추가 시 누락될 수 있으며, (2) `newChat` 내 다단계 순서 의존성(특히 `refreshTimerRef` clearTimeout 추가 이후)의 최신 주석 보완이 필요하고, (3) `submitMessage` 와 `panel.tsx` Composer disabled 의 이중 guard 간 상호 참조가 없어 한 쪽 변경 시 다른 쪽 의도가 파괴될 위험이 잠재한다. 테스트의 매직 타임아웃 상수화는 이미 수행되어 개선되었으나 근거 주석 보완이 남아 있다. 전체 위험도는 즉각 결함이 없는 INFO 수준이다.

## 위험도

LOW

STATUS: SUCCESS
