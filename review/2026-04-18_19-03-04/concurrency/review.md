## 동시성 코드 리뷰

### 발견사항

- **[WARNING]** `t` 함수 참조의 불안정성으로 인한 memoization 무효화
  - 위치: `preview.tsx:68,82`, `node-settings-panel.tsx:188`
  - 상세: `useMemo`/`useCallback`의 의존성 배열에 `t`가 추가됨. `useT()`가 매 렌더마다 새 함수 참조를 반환할 경우, `[sampleText, t]` 의존성이 항상 변경된 것으로 판단되어 memoization이 전혀 작동하지 않음. 이는 "렌더마다 재계산"이라는 미묘한 성능 열화로 이어질 수 있으며, 변환 결과물이 비결정적으로 보이는 경우 디버깅이 어려움.
  - 제안: `useT()` 내부에서 `useCallback`으로 반환 함수를 안정화하거나, `t` 대신 `locale` 값을 의존성으로 사용할 것.

- **[INFO]** `useLocaleStore.getState()`의 비반응적(non-reactive) 읽기
  - 위치: `date.ts:14`, `execution-status.ts:29`
  - 상세: `currentLocale()` 함수가 React 렌더 사이클 외부에서 Zustand 스토어를 직접 읽음. JavaScript 단일 스레드 모델에서 race condition은 없으나, 이 함수를 통해 반환된 문자열을 캐싱하거나 메모이즈하는 상위 코드가 있다면 locale 변경 시 캐시가 stale 상태로 남을 수 있음.
  - 제안: 현재 코드처럼 호출 시점에 읽는 것은 의도적인 설계로 허용 가능하나, 호출자 레이어에서 `locale`을 명시적 파라미터로 전달하는 패턴(이미 옵셔널 파라미터로 지원 중)을 권장 사용 방식으로 문서화할 것.

- **[INFO]** `formatDuration` 두 구현체 간 포맷 불일치
  - 위치: `date.ts:28–32`, `execution-status.ts:42`
  - 상세: `date.ts`의 `formatDuration`은 정수 초를, `execution-status.ts`는 `seconds.toFixed(1)` 소수점 값을 `time.seconds` 번역 키에 전달함. 동시에 두 함수가 호출되는 UI(예: 실행 목록)에서 "5s"와 "5.0s"가 혼재할 수 있음. 동시성 버그는 아니지만 비결정적 UI 상태를 유발.

---

### 요약

변경사항의 핵심은 i18n 적용으로, JavaScript 단일 스레드 환경에서 고전적인 race condition이나 deadlock 위험은 없다. 주목할 점은 `useMemo`/`useCallback` 의존성 배열에 `t` 함수를 추가한 부분으로, `useT()`가 안정된 레퍼런스를 반환하지 않으면 memoization이 사실상 비활성화되어 렌더 사이클마다 불필요한 재계산이 발생할 수 있다. 또한 `getState()` 직접 접근 패턴은 의도적인 설계이나, 호출자가 이 비반응적 특성을 인지해야 한다.

### 위험도
**LOW**