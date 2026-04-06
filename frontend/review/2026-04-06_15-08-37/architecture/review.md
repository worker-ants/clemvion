## 아키텍처 코드 리뷰 — `button-bar.tsx`

---

### 발견사항

- **[WARNING]** 타이머 만료 시 자동 액션 미실행
  - 위치: `useEffect` (countdown timer, line 56–68) + timeout render (line 98–105)
  - 상세: `remaining`이 0이 되면 시각적으로 "timed out" 상태를 표시하지만, `timeoutAction`에 따라 `onContinueClick()` 또는 cancel 콜백을 자동 호출하지 않는다. 부모가 타이머 만료를 감지할 방법이 없어 실행 흐름이 중단되고, 비즈니스 로직(timeout → 자동 continue/cancel)이 사실상 동작하지 않는다.
  - 제안: 타이머 만료 시 `onTimeoutAction` 콜백을 별도로 받거나, `remaining`이 0이 될 때 `timeoutAction` 값에 따라 `onContinueClick()`을 자동 호출하는 `useEffect`를 추가하라.

```tsx
useEffect(() => {
  if (remaining !== 0) return;
  if (timeoutAction === "continue") onContinueClick();
  // cancel의 경우 별도 onCancelClick 콜백 필요
}, [remaining]);
```

---

- **[WARNING]** 단일 책임 원칙(SRP) 위반 — 타이머 로직과 UI가 혼재
  - 위치: 컴포넌트 전체
  - 상세: `ButtonBar`가 (1) 카운트다운 타이머 관리, (2) 클릭 상태 추적, (3) 버튼 렌더링, (4) 링크/포트 분기 처리라는 네 가지 책임을 진다. 타이머 로직이 복잡해질 경우(pause, reset, sync with server) 컴포넌트 전체를 수정해야 한다.
  - 제안: 타이머 로직을 `useCountdown(timeout)` 커스텀 훅으로 분리하라. 클릭 상태 추적도 `useButtonClickState()` 훅으로 분리하면 테스트 용이성도 향상된다.

---

- **[WARNING]** `hasOnlyLinkButtons` 조건의 암묵적 비즈니스 규칙
  - 위치: line 71, line 140–151
  - 상세: "링크 버튼만 있으면 암묵적 Continue 버튼을 추가한다"는 비즈니스 규칙이 UI 컴포넌트 안에 하드코딩되어 있다. 이 규칙이 변경되거나 다른 조건이 추가될 때 컴포넌트 내부를 수정해야 한다(OCP 위반).
  - 제안: 이 로직을 부모(또는 상위 레이어)에서 판단하여 `showContinueButton: boolean` prop으로 내려받는 구조로 변경하라. 컴포넌트는 "어떻게 보여줄지"만 담당해야 한다.

---

- **[INFO]** 혼재된 버튼 컴포넌트 사용
  - 위치: line 122 (`<button>`), line 142 (`<Button>`)
  - 상세: 포트 버튼은 native `<button>`, Continue 버튼은 shadcn `<Button>`을 사용한다. 동일한 UI 레이어에서 두 가지 버튼 컴포넌트가 혼용되면 디자인 일관성 유지가 어렵고, 스타일 변경 시 두 곳을 수정해야 한다.
  - 제안: `STYLE_CLASSES`에 `variant` 방식을 통합하거나, 포트 버튼도 `<Button>` 컴포넌트에 `asChild` 또는 variant prop으로 통일하라.

---

- **[INFO]** `timeout` prop 변경에 대한 무반응
  - 위치: `useState` 초기값 (line 47–49)
  - 상세: `remaining`의 초기값이 `timeout` prop에서 한 번만 파생되므로, 부모가 `timeout`을 동적으로 변경해도 타이머가 리셋되지 않는다. 현재 사용 패턴에서는 문제가 없을 수 있지만, 이 제약이 명시되지 않았다.
  - 제안: `useEffect`로 `timeout` prop 변경을 감지하거나, props가 불변임을 JSDoc/주석으로 명시하라.

---

### 요약

`ButtonBar`는 UI 렌더링 범위 내에서 적절히 props 기반 설계를 따르고 있으나, 타이머 만료 시 자동 액션 미실행이라는 **핵심 비즈니스 로직 누락**이 가장 큰 문제다. 카운트다운 타이머 관리·클릭 상태·버튼 렌더링이 단일 컴포넌트에 혼재(SRP 위반)하고, 암묵적 Continue 버튼 로직이 UI 컴포넌트 내부에 하드코딩되어 확장성이 낮다(OCP 위반). 커스텀 훅 분리와 타임아웃 콜백 실행 보완이 선행되어야 한다.

### 위험도

**MEDIUM**