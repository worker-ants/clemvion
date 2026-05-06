파일들을 충분히 읽었습니다. 이제 동시성 관점에서 분석하겠습니다.

---

## 동시성 코드 리뷰

### 발견사항

- **[WARNING]** `ButtonBar`의 클릭 가드 — TOCTOU(Time-of-check-to-time-of-use) 패턴
  - 위치: `src/components/editor/run-results/button-bar.tsx:62–78`
  - 상세: `handleClick`과 `handleContinue` 모두 `if (disabled || clicked) return;`으로 보호하지만, `clicked`는 React state 스냅샷이다. React 18 Concurrent Mode에서는 여러 이벤트가 큐에 쌓인 뒤 일괄 처리될 때, 두 번째 이벤트 핸들러가 실행될 시점에 `setClicked()`의 결과가 아직 반영되지 않은 상태를 볼 수 있다. `handleClick(btnA)`와 `handleContinue()`가 동일 플러시 사이클 안에서 실행되면 두 콜백 모두 `clicked === null`을 보고 중복 실행될 수 있다.
  - 제안: `useRef`로 즉각적인 잠금을 추가한다.
    ```ts
    const pendingRef = useRef(false);
    const handleClick = useCallback((btn: ButtonDef) => {
      if (disabled || clicked || pendingRef.current) return;
      pendingRef.current = true;
      // ...
      setClicked({ ... });
    }, [...]);
    ```

- **[INFO]** `currentLocale()` — 모듈 싱글턴 Zustand 스토어 스냅샷 읽기
  - 위치: `src/lib/utils/date.ts:17–19`
  - 상세: `useLocaleStore.getState()` 호출은 모듈 수준 싱글턴에서 스냅샷을 읽는다. 현재 `"use client"` 지시어로 클라이언트 전용 코드임을 명시하고 있고 주석도 잘 설명되어 있으나, 만약 이 함수가 향후 SSR 경계를 통해 서버 컨텍스트에서 호출될 경우 요청 간 locale 상태 누수가 발생할 수 있다. 현재 구조에서는 문제없지만, 파일 최상단에 `"use client"`만으로는 런타임 단계에서 SSR 실수를 막지 못한다.
  - 제안: 위험 없음 — 현재 구조 유지. 단, 이 유틸을 서버 컴포넌트나 서버 액션에서 임포트하지 않도록 팀 컨벤션을 명시할 것.

- **[INFO]** `date.test.ts` — 병렬 테스트 파일 실행 시 스토어 상태 오염 가능성
  - 위치: `src/lib/utils/__tests__/date.test.ts:7–15`
  - 상세: `beforeEach`/`afterEach`에서 `useLocaleStore.setState()`를 직접 변경한다. Vitest는 기본적으로 파일 단위 병렬 실행을 하므로, 다른 테스트 파일이 같은 모듈 인스턴스의 `useLocaleStore`를 공유할 경우 상태가 간섭할 수 있다. 현재 `afterEach`에서 `locale: "ko"`로 복원하고 있으나, `beforeEach` 시점에 다른 파일의 테스트가 locale을 변경 중이면 경쟁이 발생한다.
  - 제안: Vitest의 `isolate: true` (기본값)가 켜져있으면 각 파일이 별도 워커에서 실행되므로 안전하다. 설정 확인 후 이상 없으면 무시해도 좋다.

- **[INFO]** `schedules/page.tsx` — 단일 `runNowMutation`으로 여러 행(row) 관리
  - 위치: `src/app/(main)/schedules/page.tsx:642–652, 1040–1042`
  - 상세: `runNowMutation`은 하나의 `useMutation` 인스턴스를 모든 행이 공유한다. `disabled={runNowMutation.isPending}`은 한 행이 pending이면 모든 행의 버튼을 비활성화하는데, 이는 의도된 동작이다. 그러나 `mutate()`가 호출된 직후~React 재렌더 사이에 다른 행의 버튼이 클릭되면 두 번째 `mutate()`도 실행될 여지가 있다. `toggleMutation`도 동일한 패턴이다.
  - 제안: TanStack Query `useMutation`의 `mutate()` 호출은 내부적으로 즉시 pending 상태로 전환하므로 실제 위험은 낮다. 현행 유지 가능.

---

### 요약

검토 대상 코드는 단일 스레드 브라우저 환경의 React 클라이언트 코드로, 대부분의 비동기 패턴이 TanStack Query와 React 표준 훅을 올바르게 활용하고 있다. 실질적인 동시성 위험은 낮으며, 가장 주목할 부분은 `ButtonBar`의 클릭 가드가 React state 스냅샷에 의존한다는 점으로, Concurrent Mode에서 이론적 TOCTOU 창이 존재한다. 백엔드(`expression-resolver.service.ts`)와 패키지(`evaluator.ts`) 파일은 현재 작업 디렉토리 외부에 위치해 접근이 불가했으므로 해당 파일들에 대한 서버 사이드 동시성(DB 트랜잭션, 비동기 락 등) 분석은 수행되지 않았다.

### 위험도

**LOW**