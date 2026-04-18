## 발견사항

### [HIGH] `useT()`가 안정적 참조를 반환하지 않으면 `useMemo`·`useCallback` 무효화 발생

- **위치**: `preview.tsx` (L70, L85), `node-settings-panel.tsx` (L188), `editor-toolbar.tsx` (L130, L143)
- **상세**: `t`가 `useMemo`/`useCallback`의 의존성 배열에 추가되었는데(`[sampleText, t]`, `[..., t]`), `useT()`가 렌더마다 새 함수 참조를 반환하는 구조라면 모든 `useMemo`가 매 렌더마다 재계산되고 `useCallback`도 재생성된다. `preview.tsx`의 두 `useMemo`는 Transform 연산 적용·파싱처럼 비용이 있는 연산을 보호하기 위한 것인데, 메모이제이션 자체가 무력화될 수 있다.
- **제안**: `useT()`가 내부적으로 `useCallback` 또는 `useMemo`로 `t` 참조를 안정화하고 있는지 확인한다. 안정화되어 있지 않다면 다음 중 하나를 적용한다:
  1. `useT()` 내부에서 `return useCallback((key, params) => translate(locale, key, params), [locale])` 패턴으로 안정적 참조 반환
  2. `t`를 deps에서 제거하고 `useMemo` 내부에서 `useLocaleStore.getState().locale`을 직접 참조

---

### [WARNING] 순수 유틸리티 모듈에 `"use client"` 및 Zustand 스토어 의존성 추가

- **위치**: `date.ts` (L1-5), `execution-status.ts` (L1-6)
- **상세**: 두 파일 모두 `"use client"` 지시어와 `useLocaleStore.getState()` 호출이 추가되었다. 기존에는 서버·클라이언트 모두에서 사용 가능한 순수 함수였으나 이제 클라이언트 전용으로 제한된다. 또한 `getState()`는 렌더 사이클 외부에서 호출되므로 locale이 변경되어도 리액티브하게 반응하지 않는다 — 함수를 직접 호출하는 코드(컴포넌트 외부, 이벤트 핸들러 등)에서 스토어 변경이 반영되지 않을 수 있다.
- **제안**: 유틸리티 함수는 `locale` 파라미터를 필수로 받는 순수 함수로 유지하고, 스토어에서 locale을 읽는 책임은 호출 측(컴포넌트 또는 훅)에 위임한다. `"use client"` 제거 및 `currentLocale()` 헬퍼 삭제를 권장한다.

---

### [WARNING] `formatDuration` 동작 변경 — 소수점 처리 불일치

- **위치**: `execution-status.ts` (formatDuration), `date.ts` (formatDuration)
- **상세**: 기존 `execution-status.ts`의 `formatDuration`은 1초 이상~1분 미만 구간을 `seconds.toFixed(1)` (예: `"2.5s"`)으로 표시했으나, 변경 후 `date.ts`의 구현은 `Math.floor`를 사용하고 `execution-status.ts`는 `Number(seconds.toFixed(1))`를 i18n 템플릿에 전달한다. 두 곳에 같은 역할의 `formatDuration`이 존재하며 동작이 다르다. `formatDuration(2500, "en")`는 `execution-status.ts`에서 `"2.5s"`, `date.ts`에서 `"2s"`로 다르게 출력될 수 있다.
- **제안**: `formatDuration`을 `date.ts` 한 곳으로 통합하고 `execution-status.ts`에서 re-export하거나, 두 함수의 소수점 표시 정책을 명시적으로 분리한다.

---

### [INFO] `ops.tsx`에서 컴포넌트별 `useT()` 독립 구독 다수 생성

- **위치**: `ops.tsx` 내 11개 exported 컴포넌트 각각 `useT()` 호출
- **상세**: `RenameFieldFields`, `StringOpFields`, `MathOpFields` 등 각 컴포넌트가 `useT()`를 독립적으로 호출해 locale store를 각각 구독한다. 렌더링 시 한 번에 하나만 활성화되지만, locale 변경 시 각 구독이 별도 리렌더를 트리거한다. locale 변경 빈도가 낮아 실제 영향은 미미하다.
- **제안**: 필요 시 상위 `OperationCard`에서 `t`를 prop으로 전달하는 prop-drilling 방식으로 구독을 단일화할 수 있으나, 현 규모에서는 현행 유지도 무방하다.

---

### [INFO] `TabButton` 컴포넌트 추출로 `useT()` 호출 3회 분산

- **위치**: `node-settings-panel.tsx` (TabButton 컴포넌트)
- **상세**: 인라인 버튼을 `TabButton` 컴포넌트로 추출하면서 탭 3개가 각각 `useT()`를 호출한다. 부모에서 `t`를 prop으로 전달하면 구독 수를 줄일 수 있다.
- **제안**: 아키텍처적으로 허용 가능한 수준이나, `TabButton`이 `t` 함수를 prop으로 받도록 변경하면 구독을 부모 1개로 줄일 수 있다.

---

## 요약

이번 변경의 핵심 위험은 **`useT()`가 반환하는 `t` 함수의 참조 안정성**이다. `preview.tsx`의 `useMemo` 두 곳에 `t`가 의존성으로 추가되었는데, `t`가 렌더마다 새로 생성된다면 Transform 연산 적용 로직의 메모이제이션이 완전히 무력화되어 불필요한 재연산이 매 렌더마다 발생한다. 이와 별개로, 순수 유틸리티였던 `date.ts`·`execution-status.ts`에 `"use client"`와 스토어 의존성이 추가된 것은 서버 컴포넌트에서의 사용 가능성을 차단하고 테스트 격리성을 낮춘다.

## 위험도

**MEDIUM** — `useT()` 안정성 확인 전까지 `preview.tsx`의 메모이제이션 효과가 무력화될 가능성이 있으며, 유틸리티 함수의 클라이언트 전용화가 향후 확장성을 제한할 수 있다.