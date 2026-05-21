# 동시성(Concurrency) 리뷰

## 발견사항

### 파일 1: `codebase/backend/src/modules/llm/llm.service.spec.ts`

- **[INFO]** `jest.useFakeTimers()` / `jest.useRealTimers()` 쌍 관리 패턴
  - 위치: 새로 추가된 `describe('Retry-After header behavior')` 블록, `beforeEach`/`afterEach` (diff 라인 53-58)
  - 상세: `beforeEach`에서 `jest.useFakeTimers()`, `afterEach`에서 `jest.useRealTimers()`를 사용하는 패턴은 올바르다. 동일 파일의 기존 `listModels` 타임아웃 테스트는 `try/finally` 블록으로 복원하는 다른 방식을 사용하는데, 두 방식이 혼재하더라도 각 테스트가 독립적으로 타이머 상태를 복원하므로 실제 충돌 위험은 없다.
  - 제안: 일관성을 위해 기존 테스트의 `try/finally` 방식도 `beforeEach`/`afterEach`로 통일하는 것이 바람직하지만, 동시성 결함은 아니다.

- **[INFO]** `promise` 생성 후 `advanceTimersByTimeAsync` → `await promise` 순서
  - 위치: 세 개의 `it` 케이스 모두 (diff 라인 84-91, 110-116, 136-145)
  - 상세: fake timer 환경에서 `const promise = service.chat(...)` 로 Promise를 먼저 생성하고, `await jest.advanceTimersByTimeAsync(ms)` 로 내부 `setTimeout` 을 전진시킨 뒤 `const result = await promise`로 결과를 받는 패턴은 Jest fake timer의 표준적이고 올바른 사용 방식이다. async/await 누락이나 순서 역전 없음.

### 파일 2: `codebase/frontend/src/components/layout/sidebar.tsx`

- **[WARNING]** `setNotifOpen` updater 함수 내부에서 `setNotifFilter` 호출 (side effect in state updater)
  - 위치: `toggleNotif` useCallback (diff 라인 857-862, 전체 파일 라인 1177-1182)
  - 상세: React의 state updater 함수(`setNotifOpen((prev) => { ... })`)는 순수 함수여야 한다. 내부에서 `setNotifFilter("all")`이라는 다른 setState를 호출하는 것은 side effect 에 해당한다. React 18 Concurrent Mode와 Strict Mode에서는 updater 함수가 렌더링 안전성 검증을 위해 두 번 호출될 수 있으며, 이 경우 `setNotifFilter("all")`도 두 번 호출된다. 현재 `"all"`로 설정하는 동작은 멱등(idempotent)이므로 즉각적인 오동작은 없으나, 향후 updater 내부 로직이 복잡해지면 경쟁 조건 또는 예측 불가능한 렌더링 순서 문제로 발전할 수 있다.
  - 제안: updater 함수 밖으로 꺼내어 두 setState를 순차적으로 호출하도록 리팩터링한다.
    ```ts
    const toggleNotif = useCallback(() => {
      setNotifOpen((prev) => !prev);
      // notifOpen이 true(닫히는 방향)일 때만 필터 리셋이 필요하지만,
      // "all"로 리셋하는 것은 멱등이므로 항상 호출해도 무방하다.
      // 엄밀히 하려면 별도 ref나 플래그를 두거나 closeNotif 패턴을 유지한다.
    }, []);
    ```
    또는 `notifOpen` 상태를 직접 읽어서 분기하는 방식:
    ```ts
    const toggleNotif = useCallback(() => {
      if (notifOpen) {
        closeNotif();   // setNotifOpen(false) + setNotifFilter("all")
      } else {
        setNotifOpen(true);
      }
    }, [notifOpen, closeNotif]);
    ```
    이 경우 `notifOpen`을 deps에 포함해야 하며, 이미 정의된 `closeNotif`을 재활용할 수 있다.

- **[INFO]** `closeNotif` 패턴은 올바름
  - 위치: `closeNotif` useCallback (전체 파일 라인 1173-1176)
  - 상세: `setNotifOpen(false)`와 `setNotifFilter("all")`을 updater 함수 없이 순차 호출하는 `closeNotif`는 React 18 batching 환경에서도 단일 렌더 사이클로 묶이므로 정상적인 패턴이다.

- **[INFO]** `useEffect` 내 `closeNotif` 의존성 누락 가능성
  - 위치: `handleClickOutside` useEffect (전체 파일 라인 1218-1240)
  - 상세: deps 배열에 `closeNotif`가 없다(`[userMenuOpen, notifOpen, workspaceMenuOpen]`만 있음). `closeNotif`는 `useCallback(() => {...}, [])` 로 빈 deps로 선언되어 실제로 재생성되지 않으므로 stale closure 문제는 발생하지 않는다. 그러나 lint(`exhaustive-deps`) 규칙 관점에서는 경고가 발생할 수 있다.
  - 제안: deps 배열에 `closeNotif`를 추가한다. 동작상 문제는 없으나 명시성을 위해 권장한다.

---

## 요약

`llm.service.spec.ts`의 변경은 Jest fake timer를 활용한 비동기 retry 타이머 테스트로, `promise` 생성 → 타이머 전진 → `await` 순서가 올바르게 구성되어 있으며 동시성 결함이 없다. `sidebar.tsx`의 변경에서는 `toggleNotif` 내 `setNotifOpen` updater 함수 안에서 `setNotifFilter`를 호출하는 패턴이 React의 순수 updater 원칙을 위반한다. `setNotifFilter("all")`이 멱등적이라 즉각적인 버그는 없지만, React 18 Concurrent/Strict Mode에서 updater 함수가 복수 호출될 때 side effect가 예상 외로 반복될 수 있어 향후 위험 요소로 남는다. 이를 제외하면 전반적으로 동시성 위험도는 낮다.

## 위험도

LOW
