# 테스트(Testing) 리뷰 결과

## 발견사항

### [INFO] `isTextInputSurface` 단위 테스트 — 핵심 판정 함수의 직접 검증이 적절히 추가됨
- 위치: `/codebase/channel-web-chat/src/lib/widget-state.test.ts` L10–23
- 상세: `null`, `ai_conversation`, `buttons`, `form` 4가지 케이스를 모두 커버한다. 새로 추출된 헬퍼를 3곳(submitMessage, flush effect, panel Composer)이 공유하므로 이 단위 테스트가 있어야 회귀를 격리할 수 있다. 적절하다.
- 제안: 현행 유지. 다만 향후 새 `ExternalInteractionType`(예: `file`, `select`)이 추가될 때 이 테스트를 먼저 갱신해야 한다는 점을 JSDoc 또는 테스트 주석에 명시해두면 좋다.

---

### [INFO] `isTextInputSurface` — unknown/미래 타입에 대한 테스트 부재
- 위치: `/codebase/channel-web-chat/src/lib/widget-state.test.ts` L10–23
- 상세: 현재 구현은 denylist(`!== "buttons" && !== "form"`)이므로, 정의되지 않은 새 타입이 들어오면 `true`(텍스트 표면)로 판정한다. 이 동작이 의도된 것이라면(SUMMARY #8에서 "parseWaitingForInput이 upstream 차단" 설명), 테스트로 명시적으로 고정해 두는 것이 안전하다. 현재 테스트에서는 `unknown_type`/기타 문자열에 대한 케이스가 없다.
- 제안: `it("unknown type → 텍스트 표면(true) — denylist allowfall", () => { expect(isTextInputSurface({ type: "unknown" as any })).toBe(true); })` 케이스를 추가하면 denylist 의미를 문서화 겸 고정할 수 있다. INFO·비차단.

---

### [INFO] `ERROR(pending 상태)` reducer 테스트 — 기존 ERROR 테스트의 pending=null 케이스를 보완
- 위치: `/codebase/channel-web-chat/src/lib/widget-state.test.ts` L108–117
- 상세: 기존 "ERROR → ended + error" 테스트(L102–106)는 `initialState`(pending=null) 에서의 전이만 검증했다. 신규 테스트는 `pending=buttons` 상태에서 ERROR 시 `pending` 이 해제됨을 별도로 검증한다. 커버리지 갭이 실용적으로 보강됐다. 테스트 격리도 적절하다(reduce 헬퍼로 독립 상태 구성).
- 제안: 현행 유지.

---

### [INFO] `ended 재open` reducer 테스트 — OPEN 의 phase 분기 동작을 명시적으로 고정
- 위치: `/codebase/channel-web-chat/src/lib/widget-state.test.ts` L119–129
- 상세: `state.phase === "collapsed"` 일 때만 `"panel"`로 전이하는 OPEN 분기(widget-state.ts L98)가 `ended` 상태에서는 phase를 유지함을 직접 검증한다. `unread` 리셋도 단언하고 있어 의도가 명확하다. 테스트 준비 코드(reduce → ENDED → open=false 설정 → OPEN)가 상태 전이를 추적 가능하게 기술돼 있다.
- 제안: 현행 유지. `streaming`/`booting` phase에서 OPEN을 호출하는 케이스도 동일 동작이지만, 기존 테스트("START: eager 시작" 등)에서 간접 커버되므로 추가 불필요.

---

### [INFO] `panel.test.tsx` — `phase=ended` Composer 미렌더 테스트, 구현 게이팅과 정확히 대응
- 위치: `/codebase/channel-web-chat/src/widget/components/panel.test.tsx` L115–126
- 상세: `queryByLabelText("메시지 입력")` 로 Composer가 DOM에 없음을, `getByText("새 대화 시작")` 로 종료 화면 버튼 존재를 검증한다. `panel.tsx`의 `!isEnded && <Composer ...>` 게이팅을 정확히 반영한다. `queryBy` vs `getBy` 사용이 용도에 맞다.
- 제안: 현행 유지. 단, `"새 대화 시작"` 텍스트가 하드코딩 리터럴이므로 향후 i18n 변경 시 테스트가 깨질 수 있다. 중요도는 낮다.

---

### [INFO] `C1 폐기` 테스트 — `installControllableSse` 팩토리 사용, 기존 flush 테스트와 구조적 불일치
- 위치: `/codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` L248–275
- 상세: 기존 "C1 flush" 테스트(L197–245)는 테스트 내부에 `latestEs` 변수를 선언하는 패턴을 쓰고, 신규 "C1 폐기" 테스트는 `installControllableSse()` 팩토리를 사용한다. 동일한 `ControllableEventSource` 패턴에 의존하면서도 초기화 방식이 달라 일관성이 부족하다. 기능적으로는 문제 없다.
- 제안: 기존 "C1 flush" 테스트도 `installControllableSse()`를 쓰도록 리팩터하면 패턴이 통일된다. 단, 불필요한 diff를 피한다는 판단이 SUMMARY #11에 이미 기술되어 있어 비차단.

---

### [INFO] `C1 폐기` 테스트 — `setTimeout(r, NO_EXTRA_CALL_WAIT_MS)` 로 "발생하지 않음"을 검증하는 패턴
- 위치: `/codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` L273
- 상세: 부정 단언("interact 가 호출되지 않아야 함")을 실시간 대기로 검증한다. `NO_EXTRA_CALL_WAIT_MS` 값에 따라 테스트 속도와 신뢰성이 달라지며, CI 환경이 느릴 때 거짓 통과(false pass) 가능성이 있다. `vi.waitFor` 또는 fake timer 로 전환하면 더 결정적이지만, 이미 이 파일 전반에서 동일 패턴을 사용하고 있어 현재 변경 범위의 일관성은 유지된다.
- 제안: INFO·비차단. 장기적으로 부정 단언 테스트는 fake timer + `advanceTimersByTimeAsync`로 전환하는 것을 고려.

---

### [INFO] `fake timer` refresh 테스트 — `>= 1` 느슨한 단언, 재귀 재예약 의도 명시
- 위치: `/codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` L340–341
- 상세: `refreshCalls.length >= 1` 단언은 61분 점프 시 경계에서 2회째 재예약 발화 가능성을 고려한 것으로, RESOLUTION.md #13에서 주석 보강이 완료됐다. 재예약 동작 자체가 의도된 동작이므로 느슨한 단언이 적절하다.
- 제안: 현행 유지. 단, `shouldAdvanceTime: true` + `advanceTimersByTimeAsync` 조합이 RTL 내부 폴링과 상호작용할 수 있으므로, flaky 발생 시 `shouldAdvanceTime: false` + 수동 flush 전략으로 전환을 고려.

---

### [INFO] `fake timer` 테스트 — 독립적 fetch mock 인라인 정의, 중복 코드 존재
- 위치: `/codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` L299–325
- 상세: webhook POST 응답 구조(202, `executionId: "e1"`, `NINETY_MIN_MS`, `ENDPOINTS`)가 `installFetch`/`installControllableSse` 내부와 거의 동일하게 반복된다. `vi.useFakeTimers` 환경에서 기존 헬퍼를 재사용할 수 없어 분리한 것으로 보이나, 장기적으로 fixture 중복이 유지보수 부담이 된다.
- 제안: INFO·비차단. `installFetch({ withRefreshEndpoint: true })` 오버로드 패턴으로 추출 가능하나, 현 규모에서는 조치 불필요.

---

### [INFO] `phase=blocked` Panel 테스트 부재
- 위치: `/codebase/channel-web-chat/src/widget/components/panel.test.tsx`
- 상세: SUMMARY #14에서 이미 지적된 항목이다. `blocked` phase에서 Panel이 어떻게 렌더되는지(에러 메시지 표시, 위젯 미노출 등) 테스트가 없다. RESOLUTION.md에서 backlog 메모로 이관 처리됐다.
- 제안: 비차단. `plan/in-progress/web-chat-quality-backlog.md §C` backlog 메모에 기록됐으므로 추후 별도 PR에서 커버.

---

### [INFO] `teardownSession` 함수 — 단위 테스트 없음, 통합 경로에서 간접 커버
- 위치: `/codebase/channel-web-chat/src/widget/use-widget.ts` (teardownSession 함수)
- 상세: `teardownSession`은 `closeStream`, `clearRefreshTimer`, `clearSession` 세 단계를 순서 의존적으로 호출한다(W9). 별도 단위 테스트 없이 `newChat`·종료 이벤트 경로 통합 테스트(W7, fake-timer 테스트)에서 간접 커버된다. 순서 의존성 회귀를 가장 빠르게 잡는 경로는 단위 테스트이나, hook 내부 함수라 직접 테스트가 불가능한 구조다.
- 제안: INFO·비차단. 순서 의존성은 JSDoc으로 문서화됐고 통합 경로에서 커버되므로 현행 유지 가능.

---

## 요약

이번 변경은 테스트 관점에서 긍정적이다. `isTextInputSurface` 직접 단위 테스트 4케이스(null/ai_conversation/buttons/form), `ERROR(pending 상태)` reducer 케이스, `ended 재open` reducer 케이스, Panel `phase=ended` Composer 미렌더 테스트, C1 폐기 통합 테스트, fake-timer refresh 테스트가 모두 신규 추가됐으며 각각 비직관적 동작을 인라인 주석으로 충분히 설명한다. 테스트 격리도 적절하며(reduce 헬퍼, renderHook 독립 사용), 의도가 테스트명과 단언에서 명확히 드러난다. 커버리지 갭으로는 `phase=blocked` Panel 렌더(backlog 이관), unknown interaction type fallback 명시, `teardownSession` 순서 의존 직접 단위 테스트가 남아 있으나 모두 INFO·비차단 수준이다. Critical/Warning 발견 없음.

## 위험도

NONE

STATUS: SUCCESS
