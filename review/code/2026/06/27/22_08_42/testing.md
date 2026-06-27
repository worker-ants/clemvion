# 테스트(Testing) 리뷰 결과

검토 대상: webchat-widget-refactor (behavior-preserving 리팩터 + 테스트 보강 C)
검토 일시: 2026-06-27

---

## 발견사항

### [INFO] `isTextInputSurface` 헬퍼에 대한 직접 단위 테스트 부재
- 위치: `codebase/channel-web-chat/src/lib/widget-state.ts` — `isTextInputSurface` 함수
- 상세: `isTextInputSurface(pending)` 는 3곳(submitMessage·flush effect·panel disabled)에서 공유되는 핵심 판정 함수다. 현재 테스트는 reducer/panel/hook 통합 경로를 통해 간접 검증하고 있지만, 헬퍼 자체의 단위 테스트가 `widget-state.test.ts` 에 없다. 향후 `ExternalInteractionType` 에 새 표면(예: `file_upload`, `calendar`)이 추가될 때 allowlist 누락을 즉시 포착하기 어렵다.
- 제안: `widget-state.test.ts` 에 `isTextInputSurface` 직접 단위 테스트 3~4건 추가(`null`, `"ai_conversation"`, `"buttons"`, `"form"` 각 케이스). 로직이 단순(2-line)하므로 비용 대비 효과가 높다.

---

### [INFO] `C1 flush` 테스트 — 기존 인라인 fetchMock과 새 `installControllableSse` 팩토리의 중복
- 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` — 기존 C1 flush 테스트(line 1163~1220) vs 신규 `installControllableSse` 사용 케이스(line 1222~1249)
- 상세: 기존 C1 flush 테스트는 `installControllableSse` 와 동일한 fetch/EventSource 설정을 인라인으로 직접 작성한다. 새 팩토리 `installControllableSse()` 가 추출됐음에도 기존 테스트는 리팩터되지 않아, 같은 setup 코드가 두 곳에 존재한다. 이는 기능 오류가 아니라 유지보수성 이슈다.
- 제안: 기존 C1 flush 테스트도 `installControllableSse()` 를 쓰도록 리팩터하면 setup 중복이 제거되고 테스트 의도가 더 명확해진다. 단, 현 상태에서 테스트 자체는 유효하게 동작한다.

---

### [INFO] `fake timer` 테스트 — `refreshCalls.length >= 1` 단언이 느슨함
- 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` — fake timer 테스트(line 1369~1417)
- 상세: `expect(refreshCalls.length).toBeGreaterThanOrEqual(1)` 는 1회 이상이면 통과한다. 타이머가 재귀 재예약(scheduleRefresh 내부 self-call)되면 2회 이상 호출될 수도 있어 단언이 정확하지 않다. 의도가 "1회 발화"라면 `toBe(1)` 이 더 정밀하다. 단, 재예약 타이밍이 fake timer 진행과 겹칠 수 있는 복잡성을 피하기 위한 의도적 선택일 가능성도 있다.
- 제안: 테스트 주석에 ">=1 이 의도적"임을 명시하거나, fake timer 범위를 정밀하게 조정해 `toBe(1)` 로 강화할 것을 고려한다.

---

### [INFO] `ended` 재open 테스트에서 `WAITING` 선행 액션이 불필요하게 복잡함
- 위치: `codebase/channel-web-chat/src/lib/widget-state.test.ts` — "ended 재open" 테스트(line 163~173)
- 상세: `ended` 상태를 만들기 위해 `WAITING → ENDED` 시퀀스를 사용한다. `initialState` 에 `phase: "ended"` 를 직접 override 하면 더 단순하고 의도가 명확하다(`widgetReducer({ ...initialState, phase: "ended", open: false }, { type: "OPEN" })`). 현재 방식은 WAITING 의 사이드이펙트(pending 설정)가 ENDED 에서 해제되는 흐름까지 검증하는 효과가 있으나, 테스트 이름("ended 재open")과는 약간의 괴리가 있다.
- 제안: 현 구현은 기능적으로 문제없다. 단순성을 원하면 직접 state override 방식으로 리팩터할 수 있다.

---

### [INFO] `panel.test.tsx` — `phase=blocked` 케이스에 대한 테스트 없음
- 위치: `codebase/channel-web-chat/src/widget/components/panel.test.tsx`
- 상세: `widgetReducer` 는 `blocked` phase 를 지원하며 `open=false` 로 전이한다. `Panel` 컴포넌트가 `phase=blocked` 일 때 어떤 UI를 렌더하는지(에러 메시지 노출 여부 등) 테스트가 없다. `isEnded` 조건이 `blocked` 에는 적용되지 않으므로 Composer 가 렌더될 가능성이 있다.
- 제안: `blocked` phase 에서의 Panel 렌더 동작을 테스트하는 케이스 추가를 검토한다(비차단 INFO).

---

### [INFO] `teardownSession` 헬퍼의 순서 보장 단위 테스트 없음
- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` — `teardownSession`
- 상세: `teardownSession` 은 `closeStream → clearRefreshTimer → clearSession` 순서 의존(W9)이 있음을 주석으로 명시한다. 그러나 이 순서 보장을 검증하는 테스트가 없다. 현재 `newChat()` / terminal event 경로를 통해 간접 검증하지만, 순서 역전 버그는 현 통합 테스트에서 포착하기 어렵다.
- 제안: 중·장기적으로 `teardownSession` 을 mock 기반 단위 테스트로 순서 검증하면 W9 회귀를 방지할 수 있다. 단, 현 훅 구조상 분리 난이도가 높으므로 B1(God hook 분리) 후속 PR 시 함께 다루는 것이 적합하다.

---

### [INFO] `ControllableEventSource.listeners` 가 마지막 리스너만 보관 — 다중 리스너 테스트 불가
- 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` — `ControllableEventSource` 클래스(line 995~1005)
- 상세: `listeners` 객체가 이벤트 타입별로 단일 함수만 저장(`this.listeners[type] = listener`)한다. `EiaClient.openStream` 이 같은 이벤트 타입에 복수 리스너를 등록하는 경우 마지막 것만 동작한다. 현재 구현에서 중복 등록이 없으므로 즉시 문제는 없으나, 미래 확장 시 잠재적 mock 괴리가 발생할 수 있다.
- 제안: 현 시점에서 실제 동작과의 괴리가 없으므로 INFO 유지. `EiaClient` 가 복수 리스너를 사용하게 되면 `Array<listener>` 로 전환 필요.

---

## 요약

이번 변경(B2/B3/B5/B6 리팩터 + C 테스트 보강)의 테스트 품질은 전반적으로 양호하다. 신규 추가된 5개 테스트(ERROR→pending 해제, ended 재open OPEN reducer, ended Composer 미렌더, C1 buttons 폐기, fake timer refresh)는 모두 명확한 의도·충분한 단언·적절한 격리를 갖추고 있다. 특히 `installControllableSse` 팩토리 추출로 SSE 제어 테스트의 재사용성이 향상됐고, `vi.useFakeTimers` 를 `try/finally` 로 안전하게 복원하는 패턴도 적절하다. 발견된 항목은 모두 INFO 수준이며 기능 정확성에 영향을 주지 않는다. 핵심 커버리지 갭으로는 `isTextInputSurface` 직접 단위 테스트 부재와 `phase=blocked` 케이스 미테스트가 있으나 비차단이다. `teardownSession` 순서 보장 검증은 B1 God hook 분리 후속 PR 에서 다루는 것이 자연스럽다.

## 위험도

NONE
