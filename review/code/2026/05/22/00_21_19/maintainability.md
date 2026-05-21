# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 1: codebase/backend/src/modules/llm/llm.service.spec.ts

- **[WARNING]** 테스트 픽스처(config/params) 중복 정의
  - 위치: diff 추가 블록 내 `describe('Retry-After header behavior')` (라인 40-48) 및 기존 파일 컨텍스트 라인 627-635
  - 상세: `config` 와 `params` 상수가 새로 추가된 `describe` 블록 내부에 정의되어 있는데, 기존 `withRetry` 상위 `describe` 내에 동일한 구조의 `config` 를 정의한 테스트('should retry on 429 errors')가 이미 존재한다. 두 블록이 동일한 `provider`, `defaultModel`, `apiKey` 값을 각자 선언하고 있어 공통 fixture 로 추출 가능한 중복이다.
  - 제안: `withRetry` describe 스코프 상단(또는 파일 상단 헬퍼 구역)에 공통 `retryConfig` / `retryParams` 상수를 한 번만 선언하고 재사용.

- **[WARNING]** 각 테스트 케이스 내부의 성공 응답 객체 중복
  - 위치: diff 추가 블록 라인 72-78, 99-105, 127-133 (성공 시 반환되는 동일한 객체 리터럴 3회)
  - 상세: `{ content: 'ok', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }, model: 'gpt-4o', finishReason: 'stop' }` 가 세 테스트 케이스 모두에서 인라인으로 반복된다. 값이 달라질 때 3곳을 모두 수정해야 하며, 수정 누락 위험이 있다.
  - 제안: describe 블록 상단에 `const successResponse = { ... }` 상수를 정의해 재사용.

- **[INFO]** `makeRateLimitError` 헬퍼 함수 위치 — 타입 어서션 노이즈
  - 위치: diff 추가 블록 라인 57-63
  - 상세: `as Error & { headers?: Record<string, unknown> }` 어서션은 기능에 문제가 없지만, 인라인 교차 타입보다 파일 상단에 named type alias 를 두면 동일 패턴을 다른 describe 에서도 재사용할 수 있고 가독성이 높아진다.
  - 제안: `type RateLimitError = Error & { headers?: Record<string, unknown> };` 를 파일 상단에 선언.

- **[INFO]** `jest.spyOn(global, 'setTimeout')` 사용 — 스파이 정리 없음
  - 위치: diff 추가 블록 라인 66, 92, 117
  - 상세: 각 테스트에서 `setTimeoutSpy` 를 생성하지만 `afterEach` 에서 `jest.restoreAllMocks()` 혹은 `setTimeoutSpy.mockRestore()` 를 명시적으로 호출하지 않는다. `jest.useFakeTimers()` / `jest.useRealTimers()` 쌍이 `afterEach` 에 있지만 스파이 복원은 별개이므로, 테스트 격리가 실제로는 의도대로 동작하더라도 관례적으로 명시적 복원이 권장된다.
  - 제안: `afterEach` 에 `jest.restoreAllMocks()` 추가 또는 각 테스트 내부에서 `setTimeoutSpy.mockRestore()` 호출.

- **[INFO]** 테스트 설명 문자열에 특수 기호(→, ≥) 혼용
  - 위치: diff 추가 블록 라인 65, 116
  - 상세: `'honors Retry-After=2 (delta-seconds) → 2000ms backoff'`, `'caps Retry-After at 60_000ms when provider asks for ≥60s'` 처럼 비-ASCII 특수 기호를 사용한다. 기존 파일 내 다른 테스트 설명은 ASCII 영문으로만 구성되어 있어 일관성이 약간 낮다. 터미널·CI 환경에 따라 출력이 깨질 수 있다.
  - 제안: ASCII 로 대체하거나 (`->`, `>=`), 반대로 파일 전체 관례로 굳힐 것인지 팀 내 명시적 합의 필요.

---

### 파일 2: codebase/frontend/src/components/layout/sidebar.tsx

- **[INFO]** `closeNotif` / `toggleNotif` 의도는 명확하나, `toggleNotif` 내부에서 `setNotifFilter("all")` 을 `setNotifOpen` 콜백 안에서 호출하는 패턴이 다소 비전형적
  - 위치: 전체 파일 라인 1174-1179
  - 상세: `setNotifOpen(prev => { if (prev) setNotifFilter("all"); return !prev; })` 는 기능적으로 올바르지만, 상태 updater 함수 내부에서 다른 setState 를 부르는 것은 React 공식 문서에서 권장하지 않는 패턴이다. 렌더링 경계에서 예외 없이 동작하지만, 코드를 처음 읽는 개발자가 updater 함수 내 side-effect를 예상하지 못할 수 있다.
  - 제안: `toggleNotif` 를 아래처럼 평이하게 분리해도 동일 효과:
    ```ts
    const toggleNotif = useCallback(() => {
      if (notifOpen) setNotifFilter("all");
      setNotifOpen((prev) => !prev);
    }, [notifOpen]);
    ```
    단, 이 경우 `notifOpen` 이 deps 배열에 추가돼야 하므로 트레이드오프(클로저 재생성 빈도)를 인지하고 선택.

- **[INFO]** `closeNotif` 의 eslint 주석이 구현 파일보다 diff 주석(패치 헤더)에만 설명됨
  - 위치: 전체 파일 라인 1167-1173 (주석 블록)
  - 상세: "lint 규칙 react-hooks/set-state-in-effect" 언급이 diff 상단 주석에는 있고 실제 파일 내 주석에도 포함되어 있어 적절하다. 이 부분은 잘 작성된 인라인 주석의 좋은 예이다.
  - 제안: 없음(양호).

- **[INFO]** `handleClickOutside` 의 `closeNotif` 의존성이 useEffect deps 배열에 누락
  - 위치: 전체 파일 라인 1215-1237
  - 상세: `useEffect` 의 deps 배열이 `[userMenuOpen, notifOpen, workspaceMenuOpen]` 인데, `closeNotif` 가 클로저로 캡처된다. `closeNotif` 는 `useCallback([], [])` 으로 안정적이라 실제 버그는 없지만, React exhaustive-deps lint 규칙을 활성화하면 경고가 발생한다. 명시적으로 deps 에 추가하면 의도가 더 명확해진다.
  - 제안: `}, [userMenuOpen, notifOpen, workspaceMenuOpen, closeNotif]);` 로 변경.

- **[INFO]** `Sidebar` 컴포넌트 전체 길이(약 460 라인)에 대한 경고
  - 위치: 전체 파일 라인 1045-1706
  - 상세: 이번 변경 자체가 길이를 늘린 것은 아니지만, 현재 `Sidebar` 함수가 단일 파일에서 notif 상태·workspace 스위처·user 메뉴·모바일 오버레이·미디어쿼리 동기화를 모두 담고 있다. 이번 PR 범위 밖이지만, 향후 `useNotifications` 같은 custom hook 으로 분리하면 각 책임이 명확해지고 테스트 단위도 작아진다.
  - 제안: 이번 변경과 무관하게 별도 리팩토링 task 로 추적 권장.

---

## 요약

`llm.service.spec.ts` 추가 블록은 테스트 의도가 명확하고 fake timer 패턴을 올바르게 사용하고 있으나, 동일한 픽스처 객체와 성공 응답 리터럴이 3개 테스트 케이스에 반복 선언되어 관리 비용이 불필요하게 높다. `sidebar.tsx` 의 변경은 `useEffect` 내 `setState` 를 이벤트 핸들러 측 동기 호출로 이전한 합리적인 개선이며, `useCallback` 메모이제이션도 적절하게 적용되었다. 다만 `toggleNotif` 내 updater 함수 중 다른 setState 를 호출하는 패턴과 `useEffect` deps 배열의 `closeNotif` 누락은 코드 독해 비용과 잠재적 lint 경고 요인이므로 정리를 권장한다. 전반적으로 두 파일 모두 기존 스타일·패턴과 일관성을 잘 유지하고 있으며 심각한 유지보수성 문제는 없다.

## 위험도

LOW
