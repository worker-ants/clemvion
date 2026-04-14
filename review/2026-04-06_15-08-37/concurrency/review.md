### 발견사항

- **[WARNING]** `setInterval` 재등록으로 인한 타이머 중복 실행 가능성
  - 위치: `useEffect` (deps: `[remaining, clicked]`)
  - 상세: `remaining`이 변경될 때마다 effect가 재실행되어 새 `setInterval`을 등록합니다. cleanup이 있어 이전 타이머는 해제되지만, React Strict Mode(개발 환경)에서는 effect가 두 번 실행되므로 타이머가 잠깐 두 개 동시에 동작할 수 있습니다. 실제로 `remaining`을 deps에 포함시킬 필요가 없습니다 — `setRemaining(prev => ...)` 함수형 업데이트를 사용하므로 최신 값을 deps 없이 참조할 수 있습니다.
  - 제안: deps를 `[clicked]`로만 줄이세요.
  ```tsx
  useEffect(() => {
    if (remaining === null || remaining <= 0 || clicked) return;
    const timer = setInterval(() => {
      setRemaining((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [clicked]); // remaining 제거
  ```

- **[WARNING]** 타임아웃 자동 동작 미실행 — 타이머 만료 시 side effect 없음
  - 위치: `useEffect` 전체 / `remaining <= 0` 렌더 분기
  - 상세: `remaining`이 0이 되면 UI는 "Timed out" 상태를 보여주지만, `timeoutAction === "continue"`일 때 `onContinueClick()`을 호출하거나 `timeoutAction === "cancel"`일 때 취소 콜백을 호출하는 로직이 없습니다. 타임아웃이 단순히 화면 표시에만 그치고 실제 실행 흐름에 영향을 주지 않습니다. 이는 기능 버그이자 경쟁 조건을 유발할 수 있습니다 — 타이머가 0이 된 후 사용자가 버튼을 클릭하면 `clicked` 상태가 없어 두 번 처리될 여지가 있습니다.
  - 제안:
  ```tsx
  useEffect(() => {
    if (remaining !== 0 || clicked) return;
    if (timeoutAction === "continue") {
      setClicked({ buttonId: "__timeout__", label: "Timed out", at: new Date().toISOString() });
      onContinueClick();
    }
    // cancel 처리도 여기서 수행
  }, [remaining, clicked, timeoutAction, onContinueClick]);
  ```

- **[INFO]** `handleClick`의 `clicked` 클로저 참조는 안전하나 useCallback deps 주의
  - 위치: `handleClick`, `handleContinue` (useCallback)
  - 상세: `clicked`를 deps에 포함하여 최신 값을 참조하므로 double-click guard는 정상 동작합니다. React의 단일 스레드 이벤트 처리 모델 덕분에 클라이언트 사이드 경쟁 조건은 없습니다. 다만 `setClicked(...)` 직후 `onPortButtonClick(btn.id)`를 호출하는 순서에서, 만약 콜백 내부에서 컴포넌트 unmount가 발생하면 setState on unmounted component 경고가 날 수 있으므로 ref로 mounted 상태를 추적하는 것이 견고합니다.
  - 제안: 필요 시 `useRef`로 mounted guard 추가.

---

### 요약

이 컴포넌트는 React의 단일 스레드 이벤트 모델 위에서 동작하므로 전통적인 스레드 경쟁 조건이나 데드락은 존재하지 않습니다. 그러나 `useEffect` deps에 `remaining`을 불필요하게 포함시켜 매 초마다 타이머를 재생성하는 구조적 낭비가 있으며, 가장 중요하게는 타임아웃 만료 시 `onContinueClick`/취소 콜백이 실제로 호출되지 않아 실행 흐름이 끊기는 기능 버그가 있습니다. 이 상태에서는 타이머가 0이 된 후에도 사용자가 버튼을 클릭할 수 있는 짧은 창이 존재하여 의도치 않은 중복 처리가 발생할 수 있습니다.

### 위험도

**MEDIUM**