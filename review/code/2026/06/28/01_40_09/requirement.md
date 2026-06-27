# 요구사항(Requirement) 리뷰 결과

리뷰 대상: `webchat-usewidget-split` — `useWidget` God hook 분리 (B1)
분석 파일: use-pending-message-queue.ts/test, use-token-refresh.ts/test, use-widget.ts(발췌), plan 문서 2건, consistency 산출물

---

## 발견사항

### **[INFO]** `use-token-refresh.test.ts` — `sessionStorage` vs `localStorage` 스토리지 일치 여부
- 위치: `use-token-refresh.test.ts` L485 — `window.sessionStorage.getItem("clemvion-web-chat:session:t1")`
- 상세: 테스트는 `sessionStorage`를 확인한다. 그러나 현재 `session-store.ts`의 `getStorage()`는 `localStorage`를 기본 스토리지로 사용한다 (`typeof localStorage !== "undefined" ? localStorage : null`). PR #744에서 `localStorage → sessionStorage` 마이그레이션이 완료됐다면 `session-store.ts`가 `sessionStorage`를 사용하도록 변경됐어야 한다. 변경이 완료되어 있다면 테스트는 올바르다. 리뷰 대상 `session-store.ts` 스냅샷에서는 여전히 `localStorage`가 보이나, 이는 PR #744 이전 버전일 수 있으며 본 PR 범위 외의 파일이다. 실제로 `saveSession`이 `sessionStorage`를 사용하는지 런타임/테스트 환경에서 검증이 필요하다. 테스트가 `sessionStorage`를 단언하므로 `session-store.ts`도 동일하게 맞춰져 있어야 동작한다. 코드 자체 문제가 아닌 파일 간 정합성 관찰 사항.
- 제안: 현재 repo에서 `session-store.ts`가 `sessionStorage`를 사용하는지 확인하고, 불일치 시 `saveSession` 기본 스토리지를 `sessionStorage`로 전환하거나 테스트를 `localStorage`로 수정한다.

### **[INFO]** `use-token-refresh.ts` — `clientRef.current` null 체크: `scheduleRefresh` 는 `clientRef` null 시 silent no-op
- 위치: `use-token-refresh.ts` L48~53 (setTimeout 콜백 내 `if (!currentSession || !currentClient || !currentCfg || cancelledRef.current) return;`)
- 상세: 타이머 예약 시점에는 `clientRef.current`를 검사하지 않고 `scheduleRefresh` 초입에서는 `sessionRef.current`와 `cancelledRef.current`만 체크한 뒤 지연 없이 타이머를 건다. 타이머 발화 시점에 `clientRef.current`가 null이면 graceful return한다. 이는 의도적이며 정상 동작이지만, 테스트에서는 `clientRef.current`가 null인 경우를 별도로 다루지 않는다. 현재 구현 범위에서는 문제 없고 `useWidget`이 항상 `clientRef`를 주입하기 때문에 실질 위험 없음.
- 제안: 추가 테스트 필요 없음. 관찰 사항.

### **[INFO]** `usePendingMessageQueue` — `pending=null` + `awaiting_user_message` 상태에서의 `dispatch` 누락 단언
- 위치: `use-pending-message-queue.test.ts` L110~116 (`pending=null 인 awaiting_user_message → flush(텍스트 표면, nodeId 미동봉)`)
- 상세: 마지막 테스트 케이스는 `sendCommand`만 단언하고 `dispatch({ type: "USER_MESSAGE" })`는 검증하지 않는다. 구현(`use-pending-message-queue.ts` L55~57)에서는 두 작업이 항상 함께 발생하므로, 이 케이스에서도 `dispatch`가 호출된다. 테스트가 완전한 사후 조건을 다루지 않는다.
- 제안: 마지막 테스트에 `expect(dispatch).toHaveBeenCalledWith({ type: "USER_MESSAGE", text: "선행 텍스트" })` 단언 추가를 고려할 수 있으나, 비차단.

### **[INFO]** `use-widget.ts` — 마운트 effect에서 `clearRefreshTimer` 미호출 (이중 소유 정리)
- 위치: `use-widget.ts` 마운트 effect 클린업 (L1657~1661)
- 상세: 이전 코드에서는 마운트 effect 클린업에서 `clearRefreshTimer()`를 직접 호출했으나, 분리 후에는 주석(`// 갱신 타이머 정리는 useTokenRefresh 자체 unmount cleanup 이 단일 소유(이중 호출 제거)`)으로 제거됐다. `useTokenRefresh`의 `useEffect` 클린업 (`cancelledRef.current = true; clearRefreshTimer()`)이 동일 컴포넌트 언마운트 시 실행되므로 타이머 정리는 보장된다. 단일 소유 원칙은 올바르다. 기능 완전성 문제 없음.
- 제안: 관찰 사항, 수정 불필요.

### **[INFO]** spec 문서 `3-auth-session.md` — `code:` frontmatter에 신설 파일 미등재
- 위치: `spec/7-channel-web-chat/3-auth-session.md` frontmatter `code:` 목록
- 상세: `3-auth-session.md` frontmatter의 `code:` 배열에는 `use-widget.ts`만 있고, 새로 신설된 `use-token-refresh.ts`와 `use-pending-message-queue.ts`가 포함되지 않는다. 이는 코드 구현 오류가 아니라 spec frontmatter 메타 정합 누락이다 (consistency-check W-1 및 I-3과 유사 성격). 이미 consistency-check에서 `I-3: 4-security.md frontmatter code: 에 use-widget.ts 미등재(권장, planner)`가 발견됐으며 본 B1 scope 밖으로 분류됐다. 동일한 패턴이 `3-auth-session.md`에도 적용된다.
- 제안: [SPEC-DRIFT] — 코드 유지. `spec/7-channel-web-chat/3-auth-session.md` frontmatter `code:` 배열에 `codebase/channel-web-chat/src/widget/use-token-refresh.ts` 추가는 planner 후속 작업.

### **[INFO]** `use-pending-message-queue.ts` — `dispatch` 와 `sendCommand` 호출 순서 의도 명시
- 위치: `use-pending-message-queue.ts` L55~58
- 상세: `dispatch({ type: "USER_MESSAGE" })`가 `sendCommand(submit_message)`보다 먼저 호출된다. 이는 낙관적 UI 업데이트(사용자가 보내기 전 이미 버블 표시)를 위한 의도적 순서로 원래 `use-widget.ts`의 인라인 구현과 동일하다. 행동 보존 확인됨. 기능 완전성 문제 없음.

---

## 요약

본 변경은 `useWidget` God hook에서 `useTokenRefresh`와 `usePendingMessageQueue` 두 훅을 behavior-preserving 방식으로 분리한 리팩터링이다. spec `1-widget-app §R6` 및 `3-auth-session §3 step7`이 정의하는 핵심 동작—큐 flush(ai_conversation 표면), buttons/form 폐기, 토큰 자동 갱신 30분 lead 예약, 재귀 재예약, cancelled 가드, 언마운트 클린업—이 모두 신설 훅에 정확히 이식됐다. 하위호환 re-export(`use-widget.ts`에서 `refreshDelayMs`, `TOKEN_REFRESH_LEAD_MS`, `TOKEN_REFRESH_MIN_DELAY_MS` 재수출), `scheduleRefreshRef` 간접 ref 제거(stable `scheduleRefresh` 직접 호출로 대체), `clearQueue` newChat 연동(I1 보호)도 올바르게 구현됐다. 발견사항은 전부 INFO 등급이며 기능 완전성에 영향을 주지 않는다. 단, `sessionStorage` 저장 키 단언(`use-token-refresh.test.ts`)이 `session-store.ts`의 실제 스토리지 백엔드와 정합하는지 런타임 환경에서 확인이 필요하다(PR #744 반영 여부).

## 위험도

LOW
