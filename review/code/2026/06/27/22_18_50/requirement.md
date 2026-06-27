# 요구사항(Requirement) 리뷰 결과

검토 대상: Channel Web Chat — 위젯 리팩터(B) + 테스트 보강(C) (후속 커밋)
검토 일시: 2026-06-27
관련 spec: `spec/7-channel-web-chat/1-widget-app.md` (§2·§3·§3.1·§R6), `spec/7-channel-web-chat/3-auth-session.md` (§3)

---

## 발견사항

### [INFO] 기능 완전성 — isTextInputSurface 3곳 모두 적용 확인

- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` L327, L348 / `codebase/channel-web-chat/src/widget/components/panel.tsx` L112
- 상세: 이전 리뷰(22_08_42/requirement.md)에서 "submitMessage 즉시전송 경로(L305–309)·flush effect(L330) 에서 denylist 잔존" 이라는 stale 오탐이 있었다. 실제 소스 파일 확인 결과, `isTextInputSurface` 는 세 곳(submitMessage L327, flush effect L348, panel.tsx L112) 모두에 적용되어 있다. 텍스트표면 판정 3중 중복 제거 목표 완전 달성. 무조치.

### [INFO] [SPEC-DRIFT] `pending=null` 텍스트표면 취급 근거 spec 본문 미기재

- 위치: `codebase/channel-web-chat/src/lib/widget-state.ts` L30–31
- 상세: `isTextInputSurface(null)` 이 `true` 를 반환하는 동작은 JSDoc 에 "현행 동작 보존"이라 명시돼 있으며 테스트(`null(ai_conversation 도달 전 과도 상태) → 텍스트 표면(true)`)가 이를 검증한다. `spec/7-channel-web-chat/1-widget-app.md §2` 입력창 행은 "awaiting_user_message + ai_conversation 표면일 때만 자유 텍스트 입력 활성"으로 서술하며, `pending=null` 상태를 텍스트 표면으로 허용하는 이유(ai_conversation 진입 전 과도 상태)를 명문화하지 않는다.
- 판단: 코드 동작이 의도적이고 합리적이며(ai_conversation 과도 상태, 테스트 검증됨), spec 만 낡음.
- 제안: 코드 유지 + spec 반영. `spec/7-channel-web-chat/1-widget-app.md §2` 입력창 행에 `pending=null` 을 `ai_conversation` 과도 상태로 허용하는 이유 한 줄 추가 (planner 위임, 비차단).

### [INFO] 엣지 케이스 — C1 폐기(buttons/form 첫 표면) 커버리지 충분

- 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` — "C1 폐기: buttons 면 폐기" 테스트
- 상세: spec `1-widget-app §2·§R6` 의 "첫 표면이 buttons/form 이면 큐된 텍스트 폐기" 요건이 테스트로 검증됐다. SSE wire 형식(`interactionType/waitingNodeId/buttonConfig`)을 실제 사용하고 `interact` 미발생을 `NO_EXTRA_CALL_WAIT_MS` 대기 후 확인한다. `form` 표면 폐기는 별도 테스트로 없으나 `isTextInputSurface` 단위 테스트에서 `form → false` 를 검증하고, flush effect 는 동일 분기를 통과하므로 coverage 는 충분하다.

### [INFO] 에러 시나리오 — ERROR→ended + pending 해제 테스트 추가 확인

- 위치: `codebase/channel-web-chat/src/lib/widget-state.test.ts` — "ERROR(대기 중 pending 상태) → ended + pending 해제 + error"
- 상세: `buttons` pending 상태에서 ERROR 발생 시 `ended` 로 전이하며 `pending` 이 null 로 해제되고 `error` 가 설정됨을 검증한다. widgetReducer 의 ERROR 처리가 모든 pending 상태를 정리하는 것을 보여준다. spec `1-widget-app §3.1` 에 명시적 "ERROR 발생 시 pending 해제" 서술은 없으나 reducer 구현과 테스트가 일관된다.

### [INFO] ended 재open 동작 — spec 서술과 구현 일치 확인

- 위치: `codebase/channel-web-chat/src/lib/widget-state.test.ts` — "ended 재open: OPEN(ended 상태) → open=true, phase=ended 유지"
- 상세: OPEN 액션이 `collapsed` → `panel` 전이만 수행하고 `ended` 는 phase 변경 없이 `open=true` 만 세팅한다. spec `1-widget-app §3.1` 재open 항목("그대로")과 일치. `unread=0` 확인도 포함. 구현 올바름.

### [INFO] 토큰 갱신 타이머 테스트 — spec §3 step7 커버

- 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` — "fake timer: BOOTED 후 refresh delay 경과 → refresh-token 호출"
- 상세: spec `3-auth-session §3 step7`("만료 30분 이내 → POST .../refresh-token → 토큰 갱신")을 fake timer 로 결정적 검증한다. NINETY_MIN_MS(90분) 설정 후 61분 점프 → refresh 1회 이상 발화 확인. `>=1` 단언은 scheduleRefresh 재예약 시 2회째 경계 스침 가능성을 고려한 의도적 설계이며 주석으로 명시됨.

### [INFO] teardownSession 정리 순서 — spec 3-auth-session §3.1 step3 일치

- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` — `teardownSession` useCallback
- 상세: spec `3-auth-session §3.1` step3 "종료 수신 시 위젯이 즉시 storage 항목을 제거"요건을 teardownSession 이 closeStream → clearRefreshTimer → clearSession 순서로 처리한다. W9 순서 의존(sessionRef 무효화 전 SSE 닫기 → 타이머 정리 → storage 삭제) 이 JSDoc 에 명시되어 있으며 handleEiaEvent 종료분기·newChat 양쪽에서 사용한다.

### [INFO] TERMINAL_EVENTS 배열 — EIA 이벤트명 spec 일치

- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` — `TERMINAL_EVENTS` 상수
- 상세: `execution.completed`, `execution.failed`, `execution.cancelled` 세 이벤트명이 배열로 파생됐다. spec `3-auth-session §3 step8`("종료/completed → SSE 종료") 및 `0-architecture §3` EIA 매핑 표의 종료 이벤트와 일치한다. `as const` 튜플을 `.includes(string)` 에 쓰기 위한 `as readonly string[]` 캐스트에 이유 주석이 추가됐다(RESOLUTION #9 반영).

### [INFO] panel.tsx `!isEnded` 게이팅 — spec §3.1 "ended → 새 대화 시작 CTA" 일치

- 위치: `codebase/channel-web-chat/src/widget/components/panel.tsx` L106
- 상세: `!isEnded` 블록으로 Composer 를 아예 미렌더하고 "새 대화 시작" CTA 를 노출하는 것이 spec `1-widget-app §3.1` 의 `[ended] — transcript 읽기전용 + "새 대화 시작" CTA` 요건과 일치한다. panel.test.tsx 에서 `phase=ended → queryByLabelText("메시지 입력") toBeNull` + `getByText("새 대화 시작")` 으로 검증된다.

### [INFO] isTextInputSurface denylist — unknown interaction type 위험 수용 기록

- 위치: `codebase/channel-web-chat/src/lib/widget-state.ts` L31
- 상세: 구현이 `buttons`/`form` 이 아닌 모든 pending.type 을 텍스트 표면으로 허용한다. 미지의 새 타입이 서버에서 추가될 경우 텍스트 입력이 활성화될 수 있으나, JSDoc 에 명시된 대로 상류 `parseWaitingForInput` 가 unknown type 을 `ai_conversation` 으로 정규화하므로 런타임 위험은 낮다. pre-existing 동작이며 backlog §A 에 등록됨.

---

## 요약

본 후속 커밋(22_08_42 RESOLUTION 반영)은 `isTextInputSurface` 직접 단위 테스트 4케이스, ERROR→ended + pending 해제 reducer 테스트, ended 재open reducer 테스트, C1 buttons 폐기 통합 테스트, fake-timer 토큰 refresh 테스트를 추가했다. spec `1-widget-app §2·§3·§3.1·§R6`와 `3-auth-session §3` 의 핵심 요건(Composer 게이팅·C1 폐기·ended 전이·토큰 갱신)이 모두 코드와 테스트에 올바르게 반영됐다. 이전 리뷰에서 지적된 "submitMessage·flush effect denylist 잔존" 은 stale 오탐임을 소스 파일에서 직접 확인했다(`isTextInputSurface` 가 세 곳 전부에 적용됨). CRITICAL/WARNING 발견 없음. 유일한 잔여 사항은 `pending=null` 텍스트표면 취급 근거가 spec 본문에 미기재된 SPEC-DRIFT(INFO, planner 위임)이다.

## 위험도

NONE
