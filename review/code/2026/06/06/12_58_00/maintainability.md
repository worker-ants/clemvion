# 유지보수성(Maintainability) 리뷰

> 대상: webchat eager start (§R6)
> 생성일: 2026-06-06
> 세션 디렉토리: `review/code/2026/06/06/12_58_00/`

---

## 발견사항

### [WARNING] C1 flush effect 와 submitMessage 간 pending.type 판단 로직 중복
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget.ts` — `submitMessage` (약 246–250행) 및 C1 flush effect (약 271행)
- 상세: `state.pending?.type !== "buttons" && state.pending?.type !== "form"` 조건이 두 곳에 완전히 동일하게 반복된다. `panel.tsx` Composer disabled 조건(111–113행)에도 동일 패턴이 세 번째로 나타난다. 이 세 곳이 서로 독립적으로 유지되므로, 나중에 `pending.type` 이 `"carousel"` 같은 새 값으로 확장될 때 한 곳을 빠뜨리는 silent regression이 발생할 수 있다(이미 I6에서 백로그로 언급됨).
- 제안: `isTextInputSurface(pending: PendingInteraction | null): boolean` 같은 헬퍼를 `widget-state.ts` 또는 별도 유틸에 추출해 세 곳에서 공유. 타입 확장 시 한 곳만 수정하면 된다.

### [WARNING] newChat 콜백의 순서 의존적 6단계가 단일 함수에 집중
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget.ts` — `newChat` (313–327행)
- 상세: `closeStream → clearTimeout(timer) → clearSession → sessionRef.current=null → startedRef=false → pendingSendRef=null → dispatch → start` 의 8개 단계가 순서 의존적으로 나열된다. JSDoc 주석이 일부 이유를 설명하지만, 실제 주석이 가리키는 순서(`closeStream → 타이머 → clearSession → ref → dispatch → start`)와 코드 순서에 `pendingSendRef.current = null` 이 추가된 점이 주석과 완전히 일치하지 않아 유지보수 시 혼란 가능성이 있다. 순서 어긋남이 버그가 되는 조합이 많다.
- 제안: 6–8단계의 정지(teardown) 부분(`closeStream`부터 ref 초기화까지)을 `teardownSession()` 헬퍼로 추출. 주석과 코드 단계 목록을 동기화.

### [INFO] `start` 함수가 actions 반환 객체에 공개 노출되는데 JSDoc 설명이 TSDoc 형식 불일치
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget.ts` 464행
- 상세: `start` 함수 자체는 잘 문서화된 JSDoc 을 갖지만, 반환 객체 `actions` 의 타입이 inferred 이므로 `start` 가 외부 API로서 어떤 의미인지 타입 수준에서 알기 어렵다. I3 주석("open 이 자동 호출 — 외부 직접 호출 불필요")이 인라인으로 달렸지만, API 사용자가 타입 정의만 보면 인지하기 힘들다.
- 제안: `start`를 `actions` 에서 제거하거나(`@deprecated` 태그 한 릴리스 유지 후), 최소한 반환 타입을 명시 인터페이스로 선언해 `start`에 `@deprecated` JSDoc 추가.

### [INFO] 테스트 내 인라인 fetch mock 복잡도 — C1 테스트 케이스
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` — C1 테스트 (505–559행)
- 상세: C1 케이스는 `installFetch()` 공유 헬퍼를 사용하지 않고 자체 58줄짜리 `fetchMock` 함수를 인라인으로 정의한다. 이 mock은 `/interact` 엔드포인트도 처리하기 위해 `installFetch`와 다르게 작성됐지만, 두 구현의 `/api/hooks/` POST 분기 로직이 사실상 복사-변형이다. W8 테스트도 유사하게 별도 callCount 기반 fetch mock을 인라인으로 정의한다.
- 제안: `installFetch(overrides)` 에 `interactStatus?: number` 와 `webhookResponses?: Response[]` 같은 옵션을 추가해 C1/W8 도 공유 헬퍼로 처리. 반복 구조를 줄여 mock 유지보수 지점을 단일화.

### [INFO] ControllableEventSource 와 FakeEventSource 가 같은 파일에 중복 선언 가능성
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` — 373–388행
- 상세: `ControllableEventSource`(이벤트 주입 가능)와 `FakeEventSource`(noop)이 같은 파일에 함께 선언됐다. 다른 훅 테스트 파일에 유사한 FakeEventSource 구현이 존재할 경우 중복이 된다. 현재는 단일 파일 범위이므로 심각하지 않지만, 확장 시 테스트 유틸 파일 분리가 필요해진다.
- 제안: `test-utils/event-source.ts` 에 `ControllableEventSource` / `FakeEventSource` 를 공통 추출하면 다른 테스트에서도 재사용 가능.

### [INFO] panel.tsx Composer disabled 조건의 네이밍 추상화 부재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/components/panel.tsx` — 110–114행
- 상세: `phase !== "awaiting_user_message" || pending?.type === "buttons" || pending?.type === "form"` 조건이 Composer `disabled` prop에 직접 인라인됐다. 조건 자체는 주석으로 설명되지만, 의도(`composerDisabled`)를 나타내는 변수명 없이 JSX prop에 복잡한 표현식이 들어가면 읽기 흐름이 끊긴다.
- 제안: `const composerDisabled = phase !== "awaiting_user_message" || pending?.type === "buttons" || pending?.type === "form";` 로 추출해 `<Composer disabled={composerDisabled} .../>` 로 전달.

### [INFO] widget-state.ts 파일 헤더 주석 — phase 전이 다이어그램 간소화로 인한 정보 손실
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/lib/widget-state.ts` — 1–2행
- 상세: 변경 후 주석은 `panel(transient)` 을 명시하나 `streaming ↔ awaiting_user_message` 사이클과 `ended` 전이가 한 줄에 압축됐다. 원본 주석이 이미 1줄짜리 다이어그램이지만, `panel` 상태가 transient임을 명시한 점은 개선이다. 다만 `ended` 이후 `NEW_CHAT → collapsed` 복귀 경로가 생략돼 있어, 코드를 처음 보는 사람이 상태기계를 완전히 파악하기 어렵다.
- 제안: 큰 변경은 아니나 `// → ended → (NEW_CHAT) collapsed` 방향을 주석에 추가하면 복귀 경로를 즉시 알 수 있다.

---

## 요약

전반적으로 이번 변경(eager start §R6)은 유지보수성 관점에서 양호하다. 핵심 변경인 `startedRef` 가드, `pendingSendRef` 큐, START 액션의 무인자화 모두 의도가 명확하고, 새로 추가된 JSDoc과 인라인 주석이 "왜"를 충실히 설명한다. 가장 주의할 점은 `pending.type !== "buttons" && pending.type !== "form"` 조건이 `submitMessage`, C1 flush effect, `panel.tsx` 세 곳에 동일하게 중복돼 있다는 것으로, 타입 확장 시 누락 위험이 있다. `newChat` 콜백의 다단계 순서 의존성도 헬퍼 추출 없이 한 함수에 집중돼 향후 수정 시 순서 실수 가능성이 있다. 두 이슈 모두 이번 PR 수준에서는 기능상 문제가 없으나 중기적 리팩터 대상으로 백로그에 등록하는 것을 권장한다. 테스트 코드의 인라인 fetch mock 중복은 테스트 케이스 수가 늘어날수록 부담이 되므로 공유 헬퍼 확장을 검토하면 좋다.

---

## 위험도

LOW
