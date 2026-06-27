# Rationale 연속성 검토

검토 대상: `spec/7-channel-web-chat/` 전 spec 문서 및 대응 구현 diff (origin/main...HEAD)
검토 모드: `--impl-done` (구현 완료 후 검토)

---

## 발견사항

### [INFO] `isTextInputSurface` 추출 — Rationale §R6 "큐 게이팅" 원칙 정합
- **target 위치**: `codebase/channel-web-chat/src/lib/widget-state.ts` 신규 함수 `isTextInputSurface`, 동 함수 사용처(`panel.tsx`, `use-widget.ts` × 2개소)
- **과거 결정 출처**: `spec/7-channel-web-chat/1-widget-app.md §R6` — "큐 게이팅: 첫 표면이 `buttons`/`form` 이면 자유 텍스트가 제출 비대상이므로 큐를 폐기; 입력창(Composer)도 같은 조건으로 비활성화한다"
- **상세**: 구현 이전에는 `pending?.type === "buttons" || pending?.type === "form"` 조건이 세 곳에서 독립으로 중복돼 있었다. 이번 diff 는 그 세 곳을 `isTextInputSurface(pending)` 단일 함수로 통합해 판정 로직을 단일화했다. 이는 §R6 의 "큐 게이팅"이 submitMessage/flush effect/Composer 세 경로에 동일하게 적용돼야 한다는 원칙을 코드 레벨에서 단일 SoT 로 표현한 것이다. 기각된 대안이나 합의된 원칙과 충돌하는 요소가 없다.
- **제안**: 이상 없음. `isTextInputSurface` 의 docstring 이 §R6 를 명시적으로 참조하고 있어 Rationale 연결이 양호하다.

### [INFO] `teardownSession` 추출 — 종료 시퀀스 중복 제거, Rationale 연속성 정상
- **target 위치**: `codebase/channel-web-chat/src/widget/use-widget.ts` — `teardownSession` 콜백 신설, `handleEiaEvent` 및 `newChat` 에서 재사용
- **과거 결정 출처**: `spec/7-channel-web-chat/3-auth-session.md §3.1` — "종료(`completed`/`failed`/`cancelled`) 수신 시 위젯이 즉시 storage 항목을 제거한다(stale 토큰 잔존 금지)"; `1-widget-app.md §3.1` — 닫기(collapse)는 SSE 연결 유지, 대화 종료(end)는 토큰 invalidate 후 `[ended]`
- **상세**: 기존에 `handleEiaEvent` 와 `newChat` 양쪽에서 동일한 `closeStream → clearTimeout → clearSession` 3-step 이 중복 인라인돼 있었다. 리팩터로 이를 `teardownSession` 콜백으로 통합했다. 순서 의존성(W9: closeStream 먼저 → refreshTimerRef 정리 → clearSession)이 함수 내부로 캡슐화됐으며, 주석으로 순서 근거가 명시돼 있다. 이는 spec 결정(종료 시 storage 즉시 제거, 세션 지속과 대화 종료 분리)을 위반하지 않는 내부 구현 정리다.
- **제안**: 이상 없음.

### [INFO] `TERMINAL_EVENTS` 상수 추출 — 열거형 기각 패턴 없음, 단순화
- **target 위치**: `codebase/channel-web-chat/src/widget/use-widget.ts` 상단 `const TERMINAL_EVENTS`
- **과거 결정 출처**: `spec/7-channel-web-chat/0-architecture.md §3 EIA 매핑` — 종료 이벤트 열거(`execution.completed`/`execution.failed`/`execution.cancelled`)
- **상세**: 인라인 `if(name==="execution.completed"||name==="execution.failed"||name==="execution.cancelled")` 를 `TERMINAL_EVENTS` 배열 상수로 추출했다. spec 에 열거된 세 이벤트와 정확히 일치하며 새 종류를 추가하거나 기각된 값을 재도입한 것이 없다. TypeScript 의 `as const` + `as readonly string[]` 캐스팅은 타입 체커 우회를 위한 구현 세부이며 spec 결정 범위 밖이다.
- **제안**: 이상 없음.

### [INFO] `clearRefreshTimer` 추출 — 타이머 정리 패턴 Rationale 범위 외
- **target 위치**: `codebase/channel-web-chat/src/widget/use-widget.ts` — `clearRefreshTimer` 콜백 신설
- **과거 결정 출처**: `spec/7-channel-web-chat/3-auth-session.md §3 step 7` — "만료 30분 이내 진입 시 refresh 후 재예약"
- **상세**: `scheduleRefresh` 내, 언마운트 cleanup, `teardownSession` 세 곳에서 `clearTimeout` 인라인이 반복돼 있던 것을 `clearRefreshTimer` 로 단일화했다. 타이머 갱신 정책 자체(30분 이내 refresh, 재예약)는 변경되지 않았다. spec Rationale 에 기록된 결정과 충돌 없음.
- **제안**: 이상 없음.

---

## 요약

이번 diff(`webchat-widget-refactor`) 는 `spec/7-channel-web-chat/` 영역의 spec 결정·Rationale 을 뒤집거나 기각된 대안을 재도입한 부분이 없다. 변경 전체가 기존 결정(§R6 큐 게이팅, §3.1 종료 시 스토리지 정리, EIA 종료 이벤트 열거)을 그대로 유지하면서 세 곳에 분산돼 있던 중복 인라인 로직을 단일 함수(`isTextInputSurface`, `teardownSession`, `clearRefreshTimer`)로 리팩터한 구조 개선이다. 각 추출 함수의 주석은 대응 spec 절(§R6, W9 등)을 명시적으로 참조하고 있어 Rationale 연결 추적성도 양호하다. Rationale 연속성 관점에서 위험 요소가 발견되지 않는다.

---

## 위험도

NONE
