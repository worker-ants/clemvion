# Testing Review

## 발견사항

### 파일 1: `codebase/backend/src/modules/llm/llm.service.spec.ts`

---

**[WARNING]** `setTimeout` spy assertion 이 `toHaveBeenCalledWith` (포함 매처)를 사용하며 호출 순서를 특정하지 않음
- 위치: 신규 테스트 3건 전체 (라인 524, 549, 575)
- 상세: `expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 2_000)` 형태는 해당 인수 조합이 *어느 시점*에든 한 번이라도 호출되면 통과한다. 현재 코드에서는 `withRetry` 루프 1회만 실행되므로 실제로 문제가 없으나, 만약 향후 내부에 다른 `setTimeout` 호출이 추가된다면 오탐(false pass)이 발생할 수 있다. `toHaveBeenNthCalledWith(1, ...)` 또는 `toHaveBeenLastCalledWith(...)` 로 순서를 명시하는 것이 더 강건하다.
- 제안: `expect(setTimeoutSpy).toHaveBeenNthCalledWith(1, expect.any(Function), 2_000)` 처럼 첫 번째 호출임을 명시.

---

**[WARNING]** cap 경계값 테스트에서 정확히 60초 값(= cap 임계)은 미검증
- 위치: `it('caps Retry-After at 60_000ms ...')` (라인 552–577)
- 상세: 테스트는 100초(100,000ms → capped to 60,000ms)만 다룬다. `MAX_BACKOFF_MS = 60_000` 의 경계값인 정확히 60초(`Retry-After: '60'`)는 `Math.min(60_000, 60_000) = 60_000`이므로 실제로 capped 되지 않지만, 59초(`59_000ms`)는 그대로 통과해야 한다. 경계 미만 값이 cap 없이 그대로 사용되는지 확인하는 테스트가 없다.
- 제안: `Retry-After: '59'` → 59_000ms(캡 없음), `Retry-After: '60'` → 60_000ms(경계, cap = 통과) 케이스를 추가.

---

**[WARNING]** `withRetry`의 `rate limit` 키워드 분기가 새 테스트에서 커버되지 않음
- 위치: `llm.service.ts` 라인 298 (`lastError.message.toLowerCase().includes('rate limit')`)
- 상세: 기존 테스트는 `'429 Too Many Requests'` 메시지만 사용한다. `'rate limit exceeded'` 처럼 429 코드 없이 문자열로만 rate-limit 을 알리는 오류(일부 서드파티 SDK)에 대해서도 `withRetry` 가 동작함을 검증하는 케이스가 없다. `Retry-After header behavior` 내에서도 모두 `'429 Too Many Requests'` 에러만 사용한다.
- 제안: `makeRateLimitError` 로 생성한 에러 메시지를 `'rate limit exceeded'` 로 변경한 케이스를 최소 1건 추가하거나, 기존 `withRetry` describe 에 추가.

---

**[WARNING]** max-retry 소진 후 non-429 에러 시 즉시 throw 경로 테스트 부재
- 위치: `describe('withRetry', ...)` — 기존 + 신규 전체
- 상세: `withRetry` 는 non-rate-limit 에러에서 즉시 throw 하고, rate-limit 이라도 `attempt === maxRetries` 에서 throw 한다. 신규 테스트들은 모두 1회 실패 후 성공하는 시나리오만 다룬다. max retries(기본값 3) 까지 모두 rate-limit 에러가 발생해도 최종적으로 throw 되는지, 그리고 non-429 에러가 즉시 전파되는지 커버되지 않는다.
- 제안: `callCount <= maxRetries` 내내 `makeRateLimitError` 를 throw 하는 케이스(exhausted), 그리고 첫 번째 호출이 non-rate-limit 에러를 throw 하는 케이스를 `withRetry describe` 에 추가.

---

**[INFO]** 기존 `should retry on 429 errors` 테스트가 실제 타이머를 사용하며 30,000ms timeout 설정
- 위치: 라인 442–470, `, 30000` Jest timeout
- 상세: 이 테스트는 `jest.useFakeTimers()` 없이 실행되어 `withRetry` 내부의 `await new Promise((resolve) => setTimeout(resolve, delay))` 가 실제 시간을 기다린다 (2^0×1000=1000ms + 2^1×1000=2000ms = 3000ms 대기). 이 테스트만 실행하면 약 3초가 소요된다. fake timer 를 도입하거나 신규 `Retry-After header behavior` 테스트처럼 `advanceTimersByTimeAsync` 를 사용하면 수십 ms 로 줄일 수 있다. 현재는 테스트가 통과되므로 `WARNING` 이 아닌 `INFO` 로 분류하나, CI 피드백 속도 개선을 위해 리팩터 검토 권장.
- 제안: 기존 `should retry on 429 errors` 테스트에도 fake timer 도입. 또는 해당 케이스를 신규 `Retry-After header behavior` describe 안으로 통합.

---

**[INFO]** `chatStream` 메서드에 대한 단위 테스트 부재
- 위치: `llm.service.ts` 라인 119–169
- 상세: `chatStream` 은 streaming abort 처리, `done` 이벤트 시 usage 기록, `LLM_STREAMING_UNSUPPORTED` 예외 등 독립적인 코드 경로를 가지고 있다. 현재 spec 파일에는 `chatStream` 관련 테스트가 없다. 이번 변경과 직접 관련은 없으나 전체 커버리지 갭이다.
- 제안: `chatStream` describe 추가 — 스트리밍 미지원 시 예외, done 이벤트에서 usage 기록, abort 시 usage 미기록 등 최소 3 케이스.

---

**[INFO]** `disableInnerRetry` 옵션이 테스트되지 않음
- 위치: `llm.service.ts` 라인 101–103
- 상세: `chat` 과 `embed` 는 `opts.disableInnerRetry` 플래그로 `withRetry` 를 바이패스한다. 이 경로가 실제로 `withRetry` 를 우회하는지 검증하는 테스트가 없다. 429 에러 발생 시 retry 없이 즉시 throw 됨을 확인해야 한다.
- 제안: `disableInnerRetry: true` 로 `chat` 을 호출하고 429 에러가 한 번에 throw 되는지 확인하는 테스트 추가.

---

### 파일 2: `codebase/frontend/src/components/layout/sidebar.tsx` + `__tests__/sidebar.test.tsx`

---

**[WARNING]** `handleClickOutside` 경로에서 `closeNotif()` 호출 시 필터 리셋이 테스트되지 않음
- 위치: `sidebar.tsx` 라인 1223–1225; `sidebar.test.tsx` 전체
- 상세: 신규 변경의 핵심 의도는 `closeNotif()` 가 `setNotifOpen(false)` 와 `setNotifFilter("all")` 를 함께 수행한다는 것이다. 기존 테스트 파일의 5번째 케이스("notifFilter resets to 'all' after popover is closed and reopened")는 bell 버튼 재클릭으로 닫는 시나리오만 검증한다. `document` 외부 클릭 이벤트(`mousedown`)로 popover 가 닫혔을 때도 동일하게 필터가 리셋되는지는 커버되지 않는다. `toggleNotif` 과 `closeNotif` 는 두 개의 다른 코드 경로이므로 독립적으로 검증해야 한다.
- 제안: `fireEvent.mouseDown(document.body)` 로 외부 클릭을 시뮬레이션한 뒤 popover 를 재열기했을 때 필터가 "all" 로 돌아오는지 확인하는 테스트 추가.

---

**[INFO]** `closeNotif()` 와 `toggleNotif()` 를 직접 단위 테스트할 수 없는 구조
- 위치: `sidebar.tsx` — `Sidebar` 컴포넌트 내 클로저
- 상세: `closeNotif` / `toggleNotif` 가 컴포넌트 내부 `useCallback` 으로 정의되어 외부에서 직접 호출 불가능하다. 테스트는 필연적으로 UI 이벤트 → 핸들러 → 상태 변화 관찰 형태로 간접 검증된다. 이는 React 컴포넌트의 일반적 패턴으로 문제가 아니나, 핸들러를 별도 훅이나 helper 로 추출했다면 더 세밀한 유닛 테스트가 가능했을 것이다. 현재 구조에서는 통합 테스트 수준에서만 커버 가능.
- 제안: 현재 테스트 구조(통합 테스트 방식)로 충분하나, 향후 `closeNotif` 로직이 복잡해지면 custom hook 으로 추출 고려.

---

**[INFO]** `handleCtaClick` 에서 `href` 없는 경우(`notificationHref` 가 null 반환) 테스트 미비
- 위치: `sidebar.tsx` 라인 1208–1212; `sidebar.test.tsx`
- 상세: `handleCtaClick` 은 `closeNotif()` 를 `href` 유무와 관계없이 항상 호출한다. `resourceId` 가 없어 `href` 가 `null` 인 `integration_action_required` 알림에 대해 Reconnect 버튼 클릭 시 popover 가 닫히되 `router.push` 는 호출되지 않는지 검증하는 케이스가 없다.
- 제안: `resourceId: null` 인 `integration_action_required` 알림으로 Reconnect 클릭 후 `mockPush` 미호출 확인 테스트 추가.

---

## 요약

백엔드(`llm.service.spec.ts`) 쪽은 `extractRetryAfterMs` 의 단위 테스트가 매우 충실하고, 신규 `Retry-After header behavior` 테스트 3건은 fake timer 를 올바르게 적용해 실제 대기 없이 동작 분기를 검증한다. 구조적으로는 잘 격리되어 있다. 주된 갭은 (1) `setTimeout` spy assertion 이 호출 순서를 특정하지 않아 오탐 여지가 있다는 점, (2) cap 경계값(정확히 60s 미만) 케이스 누락, (3) `rate limit` 문자열 분기·max-retry 소진·`disableInnerRetry` 바이패스 경로가 미검증이라는 것이다. 기존 `should retry on 429` 테스트가 fake timer 없이 실제 3초를 소비하는 점도 개선 여지가 있다. 프론트엔드(`sidebar.tsx`) 쪽은 신규 `closeNotif/toggleNotif` 동작에 대한 테스트 5건이 추가되어 핵심 시나리오는 커버되나, `handleClickOutside` 경로로 닫힐 때 필터가 리셋되는지 검증하는 케이스가 누락되어 있다. 전반적으로 신규 변경의 핵심 요건은 테스트로 확인되었으나 경계값·예외 경로에 추가 보강이 권장된다.

## 위험도

MEDIUM
