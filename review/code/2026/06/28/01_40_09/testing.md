# 테스트(Testing) 리뷰 결과

## 발견사항

### [INFO] `use-pending-message-queue.test.ts` — dispatch 호출 순서 검증 없음
- 위치: `/codebase/channel-web-chat/src/widget/use-pending-message-queue.test.ts` 63~64행
- 상세: flush 성공 케이스에서 `dispatch(USER_MESSAGE)`와 `sendCommand(submit_message)` 가 각각 올바르게 호출됨은 검증하나, 두 호출의 순서(dispatch 먼저인지 sendCommand 먼저인지)를 검증하지 않는다. 구현 코드(`use-pending-message-queue.ts` 286~289행)는 `dispatch` → `sendCommand` 순서지만, 이 순서는 UI 반영(낙관적 업데이트)보다 EIA 전송이 앞서는 회귀를 방지하는 데 중요하다.
- 제안: `vi.fn()` 의 `.mock.invocationCallOrder` 또는 직접 호출 카운터를 비교해 순서를 단언 추가.

### [INFO] `use-pending-message-queue.test.ts` — `sendCommand` 거부(reject) 시나리오 누락
- 위치: `/codebase/channel-web-chat/src/widget/use-pending-message-queue.test.ts` 전체
- 상세: 구현(`use-pending-message-queue.ts` 289행)은 `void sendCommand(...)` 로 reject 를 무시하지 않고 `use-widget.ts` 의 sendCommand 가 내부에서 ERROR 처리한다. 그러나 훅 단위에서 `sendCommand` 가 reject 할 때 `pendingSendRef` 가 이미 null 로 클리어된 상태에서 예외가 전파되지 않는지(UI 크래시 방지) 검증하는 케이스가 없다.
- 제안: `sendCommand.mockRejectedValue(new Error("network"))` 로 reject 케이스 1개 추가, `dispatch` 는 정상 호출됐고 예외가 바깥으로 전파되지 않는지 확인.

### [INFO] `use-token-refresh.test.ts` — `clientRef.current = null` 상태에서 타이머 발화 시 no-op 검증 없음
- 위치: `/codebase/channel-web-chat/src/widget/use-token-refresh.test.ts` 전체
- 상세: 구현(`use-token-refresh.ts` 751행)은 타이머 발화 직전 `currentClient == null` 이면 return 하는 가드를 포함한다. `세션 없으면 예약 no-op` 케이스(line 507~515)는 예약 단계에서 `sessionRef.current = null` 을 처리하나, 예약 이후(타이머 발화 시점)에 `clientRef.current` 가 null 이 되는 케이스(클라이언트 전환 race)는 커버되지 않는다.
- 제안: setup 후 `scheduleRefresh()` 호출, 그 후 `refs.clientRef.current = null` 설정, 타이머 점프 시 `refreshToken` 미호출 단언 테스트 1개 추가.

### [INFO] `use-token-refresh.test.ts` — 성공 후 재예약(재귀) 검증 부재
- 위치: `/codebase/channel-web-chat/src/widget/use-token-refresh.test.ts` 476~485행
- 상세: 구현은 `refreshToken` 성공 시 `scheduleRefresh()` 를 재귀 호출해 다음 만료 기준으로 재예약한다. `scheduleRefresh → delay(60m) 경과 시 refreshToken 호출` 케이스는 1회 발화만 단언하고, 2회 연속 타이머 점프를 했을 때 2회째에도 갱신이 발화되는지(재예약 체인)를 검증하지 않는다. `refreshToken` mock 이 매번 신선한 만료 시각을 반환하도록 설정되어 있어 재예약은 이론상 작동하지만 테스트로 검증되지 않는다.
- 제안: `OVER_SIXTY_MIN_MS × 2` 점프 후 `refreshToken.toHaveBeenCalledTimes(2)` 단언을 추가해 재귀 재예약 체인을 명시적 검증.

### [INFO] `use-token-refresh.test.ts` — `configRef.current = null` 가드 케이스 미검증
- 위치: `/codebase/channel-web-chat/src/widget/use-token-refresh.test.ts` 전체
- 상세: `세션 없으면 예약 no-op` 테스트에 준하여 `configRef.current = null` 이 된 경우(타이머 발화 시 config 미설정) 도 구현(`use-token-refresh.ts` 751행)이 no-op 으로 처리하는 가드가 존재한다. 대칭 케이스가 없다.
- 제안: 낮은 중요도이나 완결성을 위해 `refs.clientRef.current` null 케이스와 동일 패턴으로 1개 추가 가능(선택).

### [INFO] `use-widget.test.ts` — smoke 테스트가 `TOKEN_REFRESH_LEAD_MS` re-export 를 검증하지 않음
- 위치: `/codebase/channel-web-chat/src/widget/use-widget.test.ts` 940~944행
- 상세: 기존 테스트에서 `TOKEN_REFRESH_LEAD_MS` 를 import·검증했으나, 신규 smoke 테스트는 `refreshDelayMs` 와 `TOKEN_REFRESH_MIN_DELAY_MS` 만 확인한다. `use-widget.ts` 는 세 심볼 모두를 re-export(`TOKEN_REFRESH_LEAD_MS` 포함, line 997)하므로 하나가 누락됐다. 현재 코드는 re-export 하고 있어 런타임 문제는 없지만 smoke 범위가 불완전하다.
- 제안: smoke 테스트에 `TOKEN_REFRESH_LEAD_MS` import 및 타입/값 단언 1행 추가.

### [INFO] `use-pending-message-queue.ts` — `sendCommand` stable identity 위반 시 self-test 없음
- 위치: `/codebase/channel-web-chat/src/widget/use-pending-message-queue.ts` 296행 의존성 배열
- 상세: JSDoc(325~326행)에 "stable identity 전제(useWidget 에서 useCallback(…,[]))" 주석이 있으나, 테스트에서 이 전제를 검증하지 않는다. `vi.fn()` 은 호출마다 동일 참조이므로 불안정 참조 시뮬레이션이 불가능하다. 그러나 이 전제가 깨질 경우 effect 가 의도치 않게 재실행돼 이중 flush 가 발생한다.
- 제안: 테스트 레벨에서 직접 검증은 어렵지만, 매 렌더마다 새 함수를 넘기는 시나리오를 `renderHook` wrapper 로 흉내 내어 `sendCommand` 가 여러 번 교체되어도 flush 가 1회만 발생하는지 검증 가능(낮은 중요도, 선택).

### [INFO] 테스트 격리 — `window.sessionStorage.clear()` 범위
- 위치: `/codebase/channel-web-chat/src/widget/use-token-refresh.test.ts` 448~449행 `beforeEach`
- 상세: `scheduleRefresh → 갱신 + 저장 세션 갱신` 케이스(484행)가 `sessionStorage` 를 검증한다. `beforeEach` 에서 `sessionStorage.clear()` 를 호출해 격리하나, `afterEach` 에서는 정리하지 않는다. 이 테스트 파일이 다른 테스트 파일과 같은 jsdom 인스턴스를 공유할 경우, 이 파일의 테스트가 뒤에 실행되는 타 테스트의 `sessionStorage` 를 오염시킬 가능성이 이론적으로 존재한다. vitest 기본은 파일별 isolate 이므로 실제 문제가 아닐 가능성이 높으나, `afterEach(() => window.sessionStorage.clear())` 를 추가하면 명확해진다.
- 제안: `afterEach` 에 `window.sessionStorage.clear()` 추가(선택, 방어적 클린업).

## 요약

이번 변경은 `useWidget` God hook 에서 `useTokenRefresh` 와 `usePendingMessageQueue` 를 추출한 behavior-preserving 리팩터이며, 두 신규 훅 각각에 대한 독립 단위 테스트가 함께 추가됐다. 테스트 커버리지는 핵심 경로(flush/폐기/clearQueue/세션 없음/타이머 취소/언마운트/실패 무전파)를 잘 포괄하며, vitest fake timer와 `@testing-library/react renderHook`을 적절하게 활용해 비동기 타이머 시나리오까지 결정적으로 검증한다. `use-widget.test.ts` 는 re-export smoke로 합리적으로 축소됐고, 기존 `use-widget-eager-start.test.ts` 의 243개 테스트가 green 을 유지함으로써 동작 불변이 충분히 검증된 상태다. 발견된 항목은 전부 INFO 등급으로, 순서 검증 부재, 재귀 재예약 체인 미검증, re-export smoke 불완전, `sendCommand` reject 시나리오 누락 등 보완하면 테스트 완결성이 높아지나 현 상태로도 회귀 방지는 충분하다.

## 위험도

LOW

STATUS: SUCCESS
