# 유지보수성(Maintainability) 리뷰

## 발견사항

### 코드 파일

- **[INFO]** `use-widget.ts` — `start` 함수가 두 곳(`open`, `newChat`)에서 호출되는데, `newChat` 은 `startedRef.current = false` 로 직접 리셋한 뒤 `start()` 를 호출한다. `startedRef` 리셋 책임이 `newChat` 내부에 흩어져 있어, 이후 세 번째 호출 경로가 추가될 경우 리셋을 빠뜨리기 쉽다.
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget.ts` — `newChat`, `start` 함수
  - 상세: `start` 내부에서 guard(`startedRef.current || sessionRef.current`) 를 체크하는데, 그 guard 를 우회하는 리셋은 `newChat` 이 직접 수행한다. "가드 해제"와 "실행 재시작"이 두 함수에 걸쳐 있어 응집도가 낮다.
  - 제안: `resetAndStart()` 헬퍼로 리셋+시작을 한 단위로 캡슐화하거나, `start(force?: boolean)` 오버로드로 명시적 재시작 경로를 하나로 모으는 것을 고려한다.

- **[INFO]** `use-widget.ts` — `newChat` 콜백이 스트림 닫기·세션 저장소 정리·ref 리셋·상태 dispatch·start 호출까지 5단계 책임을 갖는다. 각 단계가 순서 의존적이지만 주석 없이 나열되어 있어 순서 변경 시 버그 위험이 있다.
  - 위치: `newChat` useCallback (라인 1463–1470)
  - 상세: `closeStream` → `clearSession` → `sessionRef.current = null` → `startedRef.current = false` → `dispatch(NEW_CHAT)` → `start()` 의 순서가 중요하다(세션 null 이 `start` guard 에 영향). 순서 의존성이 문서화되지 않았다.
  - 제안: 순서 의존적인 이유를 인라인 주석으로 명시하거나, 관련 초기화 단계를 `resetSession()` 헬퍼로 묶는다.

- **[INFO]** `use-widget.ts` — `submitMessage` 의 race condition 처리 주석("아직 세션이 없으면(시작 직후 race) 무시")이 사용자에게 조용한 no-op 을 줄 수 있다. `panel.tsx` 가 `awaiting_user_message` 에서만 입력창을 활성화하므로 실제 발생 가능성은 낮지만, 두 계층의 방어가 각기 다른 곳에 기술되어 있어 유지보수 시 한 쪽 변경이 다른 쪽 의도를 무효화할 수 있다.
  - 위치: `submitMessage` useCallback (라인 1427–1436), `panel.tsx` Composer `disabled` 조건
  - 상세: UI 수준과 로직 수준의 guard 가 분리된 것은 방어적 설계로 이해할 수 있으나, 중복 조건이 달라질 경우(예: panel 조건만 완화) silent drop 이 발생한다.
  - 제안: 두 guard 의 연관성을 각 위치에 상호 참조 주석으로 명시한다.

- **[INFO]** `panel.tsx` — `Composer` 의 `disabled` 조건(`phase !== "awaiting_user_message" || pending?.type === "buttons" || pending?.type === "form"`)에서 `awaiting_user_message` 이면서 `buttons`/`form` 인 경우가 논리적으로 가능한지 명확하지 않다. `awaiting_user_message` 와 `pending.type` 이 항상 일치한다면 phase 체크만으로 충분하고, 일치하지 않을 수 있다면 이유를 문서화해야 한다.
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/components/panel.tsx` — Composer disabled prop (라인 778–782)
  - 상세: 상태기계상 `awaiting_user_message` 이면 `pending` 이 설정되므로 이중 체크가 방어적 코드인지, 아니면 미래 상태 확장을 위한 여지인지 불분명하다.
  - 제안: 주석으로 이중 체크의 목적("버튼/폼 pending 일 때 입력창 비활성 — 추후 phase 확장 대비")을 한 줄로 명시하거나, 상태기계가 이미 보장한다면 `phase !== "awaiting_user_message"` 단일 조건으로 단순화한다.

- **[INFO]** `use-widget-eager-start.test.ts` — 하드코딩된 `setTimeout(r, 20)` (ms) 을 두 테스트에서 사용한다. 이 값이 CI 환경 부하에 따라 flaky 해질 수 있으며, 의도가 "추가 POST 없음을 확인"임에도 매직 넘버로 표현되어 있다.
  - 위치: 테스트 라인 907–908, 923–924
  - 상세: `20` 이라는 값의 근거가 없다. 더 빠르거나 느린 환경에서 오탐/미탐이 생길 수 있다.
  - 제안: `const NO_EXTRA_CALL_WAIT_MS = 20;` 등 상수로 추출하고, 왜 20ms 인지("jsdom 마이크로태스크 flush 이후") 주석으로 설명한다. `vitest` 의 `waitFor` + 역-assertion 패턴도 검토한다.

- **[INFO]** `use-widget-eager-start.test.ts` — `installFetch` 내부의 응답 fixture(`90 * 60 * 1000`)가 인라인 매직 넘버다. 단위는 ms 이며 "90분"을 의미하지만 코드만 봐서는 알 수 없다.
  - 위치: 테스트 라인 839, 915 (`90 * 60 * 1000`)
  - 상세: `use-widget.ts` 의 `TOKEN_REFRESH_LEAD_MS = 30 * 60 * 1000` 과 맥락 연관이 있으나 연결이 없다.
  - 제안: `const NINETY_MIN_MS = 90 * 60 * 1000;` 또는 테스트 상단 상수로 추출해 의도를 명확히 한다.

- **[INFO]** `eia-client.ts` — `openStream` 내부의 SSE 이벤트 이름 배열(`names`)이 하드코딩되어 있다. 새 이벤트 타입 추가 시 이 배열을 수동으로 갱신해야 하며, `eia-types.ts` 에 타입이 정의되어 있다면 중복이다.
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/lib/eia-client.ts` — `openStream` 메서드 (라인 178–187)
  - 상세: 이번 변경의 직접 대상은 아니지만, 기존 코드로서 유지보수 취약점이다. 이벤트 이름이 타입에서 파생되지 않아 타입 추가 후 여기를 빠뜨리면 이벤트가 무음 처리된다.
  - 제안: `eia-types.ts` 에서 이벤트 이름 union/tuple 을 export 하고 이 배열을 해당 타입에서 파생시킨다. (이번 PR 범위 밖이라면 TODO 주석 추가.)

### 스펙/문서 파일

- **[INFO]** `spec/7-channel-web-chat/1-widget-app.md` — 상태 다이어그램의 상태명이 `awaiting_user_input` 으로 기록되어 있으나(`[awaiting_user_input]`), 코드(`widget-state.ts`)의 실제 phase 값은 `awaiting_user_message` 다.
  - 위치: `spec/7-channel-web-chat/1-widget-app.md` 상태기계 다이어그램 (변경된 ASCII 다이어그램)
  - 상세: 오타 수준의 불일치이지만 spec 과 코드가 다른 이름을 쓰면 추후 검색/참조 시 혼란을 초래한다. `widget-state.ts` 는 `awaiting_user_message`, spec 다이어그램은 `awaiting_user_input`.
  - 제안: spec 다이어그램을 `awaiting_user_message` 로 수정한다.

## 요약

이번 변경은 lazy 시작에서 eager 시작으로의 구조 전환을 깔끔하게 수행했다. `startedRef` 가드를 도입해 중복 실행을 방지하고, `firstMessage` 경로를 제거하여 코드가 전반적으로 단순해졌다. 주석과 spec 참조(`§R6`) 가 충분히 기록되어 의도 파악이 쉬운 편이다. 다만 `newChat` 내 다단계 초기화 순서 의존성, `submitMessage` 와 `panel.tsx` 의 분리된 이중 guard, 테스트의 매직 타임아웃, spec 다이어그램 상태명 오타 등 소규모 유지보수성 개선 여지가 있다. 어느 항목도 즉각적 결함이 아니나, 코드베이스가 성장하면 혼란 지점이 될 수 있으므로 INFO 수준에서 기록한다.

## 위험도

LOW
