# Rationale 연속성 검토 결과

검토 모드: impl-done (scope=spec/7-channel-web-chat/, diff-base=origin/main)
워킹트리: /Volumes/project/private/clemvion/.claude/worktrees/webchat-usewidget-split-5e9d26

---

## 변경 범위 요약

본 PR 의 변경은 `codebase/channel-web-chat/src/widget/` 안에서만 발생하며, spec 파일은 변경 없음.
변경 성격: `use-widget.ts` God hook 에서 두 관심사를 별도 훅으로 추출(리팩터링).

| 신규 파일 | 추출된 관심사 |
|---|---|
| `use-pending-message-queue.ts` | C1(§R6) 보류 메시지 큐 — enqueue/flush/discard |
| `use-token-refresh.ts` | per_execution 토큰 자동 갱신 타이머(3-auth-session §3 step7) |
| `use-pending-message-queue.test.ts` | 위 큐 단독 unit test |
| `use-token-refresh.test.ts` | 위 갱신 타이머 단독 unit test |

---

## 발견사항

### [INFO] 동작 동등성 확인 — 모든 Rationale 불변식 유지

- **target 위치**: `use-pending-message-queue.ts` 전체, `use-token-refresh.ts` 전체
- **과거 결정 출처**: `spec/7-channel-web-chat/1-widget-app.md §R6` (큐 gating), `spec/7-channel-web-chat/3-auth-session.md §R3·§R6` (per_execution 단일, sessionStorage, 갱신)
- **상세**: 추출 전후 동작이 동일함을 파일 단위로 확인했다.
  - **큐 gating(§R6)**: `awaiting_user_message` + `isTextInputSurface(pending)` 가 `true` 일 때만 flush, `buttons`/`form` 이면 폐기 — `use-pending-message-queue.ts:61-70` 에 그대로 보존.
  - **큐 1건 제한(§R6)**: `pendingSendRef.current = text` (최신 1건 덮어쓰기) — 동일.
  - **새 대화 큐 누수 차단(I1)**: `newChat` 경로에서 `clearQueue()` 호출 — `use-widget.ts:358`.
  - **토큰 갱신 lead(3-auth-session §3 step7)**: `TOKEN_REFRESH_LEAD_MS = 30 * 60 * 1000` — `use-token-refresh.ts:9`.
  - **최소 지연(W9 폭주 방지)**: `TOKEN_REFRESH_MIN_DELAY_MS = 5_000` — 동일.
  - **cancelled guard**: 추출 전 `useEffect` 지역 `let cancelled`를 `cancelledRef`로 교체 — 의미 동일, unmount cleanup 동작 보존.
  - **`clearRefreshTimer` idempotent(W9)**: `use-token-refresh.ts:52-58`, `teardownSession` 경로에서 호출 경로 동일.
  - **하위호환 re-export**: `use-widget.ts` 에서 `refreshDelayMs`, `TOKEN_REFRESH_LEAD_MS`, `TOKEN_REFRESH_MIN_DELAY_MS` 를 re-export — 기존 import 경로 보호.
- **제안**: 발견 사항 없음. 정보성 기재.

### [INFO] `SessionRef` 타입 alias → `PersistedSession` 직접 사용 — 정합

- **target 위치**: `use-widget.ts:72` (`type SessionRef = PersistedSession`)
- **과거 결정 출처**: `spec/7-channel-web-chat/3-auth-session.md §R6` — 세션 저장 shape 는 `sessionStorage` 기반 `PersistedSession`
- **상세**: 추출 전 로컬 `interface SessionRef { executionId, token, expiresAt, endpoints }` 가 `session-store.ts` 의 `PersistedSession` 과 동일 shape 임을 확인하고 타입 alias 로 교체. shape 차이 없음 — Rationale 불변식 위반 없음.
- **제안**: 발견 사항 없음.

### [INFO] `scheduleRefreshRef` 간접 참조 → `scheduleRefresh` 직접 호출 — 이전 설계 의도와의 관계

- **target 위치**: `use-widget.ts` diff(`scheduleRefreshRef.current()` → `scheduleRefresh()`)
- **과거 결정 출처**: 이전 `use-widget.ts` 의 `scheduleRefreshRef.current = scheduleRefresh` 패턴은 `useEffect` 클로저 안의 `cancelled` 를 capture 하면서 자기 재귀를 가능하게 하는 구조였다. Rationale 에 별도 명문화된 설계 결정이 아닌 구현 기법.
- **상세**: 추출 후 `useTokenRefresh` 가 `cancelledRef`(훅 자체 소유)로 동일 guard 를 제공하므로, `scheduleRefreshRef` 간접 참조의 원래 이유가 해소됐다. `scheduleRefresh` 는 `useCallback(…, [clearRefreshTimer, sessionRef, clientRef, configRef])` 로 stable identity — deps 전부 stable ref 이라 안전.
- **제안**: 발견 사항 없음.

---

## 요약

본 PR 은 `use-widget.ts` God hook 에서 두 관심사(보류 메시지 큐, 토큰 자동 갱신)를 별도 훅으로 추출한 순수 리팩터링이다. spec 파일은 변경이 없으며, `spec/7-channel-web-chat/` 의 어떤 `## Rationale` 항목에서도 기각 또는 합의된 결정이 번복되거나 위반되지 않았다. 큐 gating(§R6), tokens-only per_execution(§R3), sessionStorage(§R6), 타이머 cancelled/idempotent invariant(W9) 등 Rationale 에 박힌 모든 불변식이 추출 전후 동일하게 보존됐다. 하위호환 re-export 로 기존 import 경로도 보호한다.

## 위험도

NONE
