## 발견사항

- **[WARNING]** `useEffect` 의존성 배열에 `remaining`이 포함되어 타이머가 매 tick마다 재생성됨
  - 위치: `useEffect` (L60–72)
  - 상세: `remaining`이 변경될 때마다 `clearInterval` → `setInterval`이 반복 호출됨. 이는 기능상 동작하지만 매 초마다 타이머 ID가 교체되는 불필요한 부작용을 유발하며, 빠른 re-render 환경에서 타이밍 불일치(1초보다 짧은 간격으로 tick 발생)가 생길 수 있음.
  - 제안: `remaining`을 의존성에서 제거하고 `useRef`로 초기값을 보관하거나, `setRemaining` 함수형 업데이트만 사용하고 effect를 마운트 시 단 한 번만 실행:
    ```ts
    useEffect(() => {
      if (!timeout || timeout <= 0) return;
      const timer = setInterval(() => {
        setRemaining((prev) => {
          if (prev === null || prev <= 1) { clearInterval(timer); return 0; }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }, []); // 마운트 시 한 번만
    ```

- **[WARNING]** `timeout` prop 변경 시 타이머가 리셋되지 않음
  - 위치: `useState` 초기화 (L52–54)
  - 상세: `remaining`의 초기값은 `useState`의 초기 인자로 설정되므로, 부모가 `timeout` prop을 변경해도 `remaining`은 갱신되지 않음. 부모가 다른 노드의 결과를 재사용하면서 `timeout`을 바꿀 경우 이전 타이머 값이 그대로 표시됨.
  - 제안: `useEffect`로 `timeout` prop 변경을 감지해 `remaining`을 동기화하거나, `key` prop으로 컴포넌트를 강제 재마운트.

- **[WARNING]** 타임아웃 만료 시 `onContinueClick`/`onPortButtonClick`이 호출되지 않음
  - 위치: `useEffect` 타이머 로직, `remaining <= 0` 렌더 분기 (L104–109)
  - 상세: `timeoutAction`이 `"continue"` 또는 `"cancel"`이어도 만료 시 UI만 변경하고 부모의 콜백을 전혀 호출하지 않음. 실행 엔진 측에서 타임아웃을 별도로 처리한다면 의도된 설계일 수 있으나, UI가 "continuing execution"이라고 표시하면서 실제 `onContinueClick`을 호출하지 않으면 표시와 동작이 불일치함.
  - 제안: 타이머 만료 시 `timeoutAction`에 따라 적절한 콜백을 호출하거나, 메시지를 "서버에서 자동 처리됨"으로 변경하여 혼란 방지.

- **[INFO]** `clicked` 상태가 부모 prop 변경에도 초기화되지 않음
  - 위치: `useState` (L55–59)
  - 상세: 부모가 동일 컴포넌트 인스턴스로 새 버튼 목록을 내려보낼 경우(예: 실행 재시작), `clicked` 상태가 남아 있어 즉시 "Button clicked" 상태로 렌더됨.
  - 제안: `buttons` prop의 변경을 감지해 `clicked`를 리셋하거나, 실행 ID 기반으로 `key`를 부여해 재마운트.

- **[INFO]** `link` 타입 버튼 클릭 후에도 다른 버튼이 활성화된 상태 유지
  - 위치: `handleClick` (L80–84)
  - 상세: `link` 버튼 클릭 시 `clicked` 상태를 설정하지 않아 이후에도 `port` 버튼과 `Continue` 버튼을 누를 수 있음. 링크를 여러 번 여는 것은 의도된 동작일 수 있으나, 같은 사용자 세션에서 링크 클릭과 포트 클릭이 모두 발생할 수 있음.
  - 제안: 의도가 명확하다면 주석으로 문서화. 링크 클릭 후 포트 버튼도 비활성화해야 한다면 상태 관리 추가 필요.

---

### 요약

`ButtonBar`는 UI 범위 내에서만 상태를 관리하며 전역 변수·파일시스템·네트워크 호출 등의 외부 부작용은 없음. 그러나 `useEffect` 의존성 배열에 `remaining`을 포함해 타이머가 매 tick마다 재생성되는 구조적 문제가 있고, 타임아웃 만료 시 UI 메시지와 실제 콜백 호출이 불일치하는 논리적 부작용이 존재함. `timeout` prop 변경 및 컴포넌트 재사용 시 stale 상태 잔존 문제도 있어, 실행 결과 패널에서 동일 컴포넌트를 재사용할 경우 잘못된 상태가 표시될 수 있음.

### 위험도

**MEDIUM**