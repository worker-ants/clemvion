# 부작용(Side Effect) 리뷰

## 발견사항

### 파일 1: `codebase/backend/src/modules/llm/llm.service.spec.ts`

- **[INFO]** `jest.spyOn(global, 'setTimeout')` 은 각 테스트 케이스 내에서 spy 를 등록하지만, `afterEach` 에서 `jest.useRealTimers()` 만 호출하고 `setTimeoutSpy.mockRestore()` 는 호출하지 않는다.
  - 위치: 새로 추가된 각 `it(...)` 블록 내부 (예: 줄 66, 91, 117 기준 diff)
  - 상세: `jest.useFakeTimers()` / `jest.useRealTimers()` 쌍은 `beforeEach`/`afterEach` 에서 올바르게 관리되므로 타이머 자체는 정상 복원된다. 그러나 `jest.spyOn` 으로 등록된 `setTimeoutSpy` 는 `mockRestore()` 없이 테스트가 끝나면 spy 인스턴스가 GC 에 맡겨진다. fake timer 환경에서는 `jest.useRealTimers()` 가 `global.setTimeout` 을 실제 구현으로 교체하므로 spy 의 원래 구현 복원 여부가 타이머 복원 순서에 의존하게 된다. 같은 `describe` 블록 내의 세 케이스가 독립적으로 spy 를 생성하므로 현재 구조에서는 실질적 누출이 발생하지 않지만, 향후 테스트 추가 시 예상치 않은 spy 잔존 가능성이 있다.
  - 제안: 각 `it` 블록 말미 또는 `afterEach` 에서 `setTimeoutSpy.mockRestore()` 를 호출하거나, spy 를 `beforeEach` 레벨로 끌어올려 `afterEach` 에서 일괄 복원하도록 리팩터링한다.

- **[INFO]** `describe('Retry-After header behavior')` 블록 내 `const config = {...}` / `const params = {...}` 는 `describe` 스코프 변수로 선언되어 세 테스트 케이스가 공유한다.
  - 위치: diff 줄 40-48
  - 상세: 현재 두 상수 모두 primitive 값만 담은 object literal 로 테스트 간 직접 변경이 없어 실제 오염은 없다. 그러나 향후 테스트가 해당 객체를 직접 변형(push, delete 등)할 경우 공유 상태 오염이 발생한다.
  - 제안: `beforeEach` 내부에서 매 테스트마다 새 객체를 생성하거나 `Object.freeze` 를 적용해 실수에 의한 변형을 방지한다. 현재는 문제없으나 방어적 코드로 개선을 권장한다.

- **[INFO]** 기존 `withRetry` describe 블록에 있는 첫 번째 `it` (줄 594–622) 은 real timer 를 사용하고 타임아웃 30,000ms 가 명시되어 있다. 새로 추가된 `describe('Retry-After header behavior')` 의 `beforeEach`/`afterEach` 는 fake timer 를 사용한다. 두 그룹이 같은 `describe('withRetry')` 아래에 있어 `beforeEach` 혼용 오류 가능성을 검토했으나, fake timer 의 `beforeEach`/`afterEach` 는 중첩 `describe` 스코프에 국한되어 첫 번째 `it` 에 영향을 주지 않는다. 문제없음.

---

### 파일 2: `codebase/frontend/src/components/layout/sidebar.tsx`

- **[WARNING]** `toggleNotif` 내부에서 `setNotifOpen` updater 함수 안에 `setNotifFilter("all")` 을 호출하고 있다.
  - 위치: diff 줄 854-859 (`toggleNotif` useCallback 블록)
  - 상세: React 의 `setState` updater 함수 (`prev => ...`) 는 렌더링 phase 또는 배치 flush 중에 순수 함수로 호출되어야 한다. updater 내부에서 또 다른 `setState` (`setNotifFilter`)를 직접 호출하는 것은 React 공식 문서가 권장하지 않는 패턴이다. 특히 Concurrent Mode / Strict Mode 에서는 updater 가 두 번 호출될 수 있어 `setNotifFilter("all")` 이 중복 호출될 위험이 있다. 기능상 현재 환경에서는 `"all"` 로의 중복 설정이 幂等하여 실제 버그로 이어지지 않지만, 의도하지 않은 이중 상태 변경 패턴에 해당한다.
  - 제안: `toggleNotif` 를 updater-free 형태로 변경하거나 `flushSync` 를 활용하지 않는 이상, `setNotifOpen` 과 `setNotifFilter` 를 분리된 state 로 일반 호출하도록 수정하는 것이 안전하다. 예: `const toggleNotif = useCallback(() => { if (notifOpen) setNotifFilter("all"); setNotifOpen((prev) => !prev); }, [notifOpen]);` — 단, 이 경우 `notifOpen` 이 deps 에 포함되어야 한다.

- **[INFO]** `closeNotif` 는 `useCallback([], [])` 으로 빈 deps 배열이다. `setNotifOpen` 과 `setNotifFilter` 는 React 보장에 의해 stable identity 를 가지므로 deps 누락은 없다. 문제없음.

- **[INFO]** 기존에 제거된 `useEffect(() => { if (!notifOpen) setNotifFilter("all"); }, [notifOpen])` 은 `notifOpen` 이 `false` 가 될 때마다 추가 render 를 유발했다. 새 구현은 close 핸들러에서 동기적으로 두 상태를 함께 설정하므로 React 배치 업데이트에 의해 단일 render 로 합쳐진다. 렌더 횟수 관점에서 개선이다. 부작용 없음.

- **[INFO]** `useEffect(() => { ... closeNotif ... }, [userMenuOpen, notifOpen, workspaceMenuOpen])` 에서 `closeNotif` 가 deps 에 포함되지 않았다.
  - 위치: 전체 파일 컨텍스트 줄 1215-1237
  - 상세: `closeNotif` 는 `useCallback([], [])` 으로 stable 하므로 deps 누락이 실행 시점 버그를 유발하지 않는다. 그러나 eslint `react-hooks/exhaustive-deps` 규칙은 이를 경고할 수 있다. 기능상 문제없음.
  - 제안: exhaustive-deps 경고를 억제하거나 `closeNotif` 를 deps 에 추가하여 lint 일관성을 유지한다.

- **[INFO]** 변경된 코드에서 새로운 전역 변수, 환경 변수 읽기/쓰기, 네트워크 호출, 파일시스템 접근, 이벤트 핸들러 시그니처 변경은 없다. 외부로 노출된 `Sidebar` 컴포넌트의 props 시그니처도 변경되지 않았으며, 기존 `setNotifOpen(false)` 호출 위치를 `closeNotif()` 로 일괄 교체한 것은 동작을 확장(필터 리셋 추가)한 것이므로 의미상 breaking change 가 없다.

---

## 요약

백엔드 스펙 파일(`llm.service.spec.ts`) 의 변경은 테스트 전용 코드로, 프로덕션 상태에 직접적인 부작용이 없다. spy cleanup 누락이라는 경미한 테스트 위생 문제가 있으나 현재 구조에서 실제 오염은 발생하지 않는다. 프론트엔드 파일(`sidebar.tsx`) 의 변경은 `useEffect` 기반 cascading render 를 제거하고 close 핸들러 측에서 동기 상태 설정으로 대체한 것으로, 전반적으로 의도에 맞는 개선이다. 다만 `toggleNotif` 내 updater 함수 안에서 별도 `setState` 를 호출하는 패턴은 React Strict/Concurrent Mode 에서 이중 호출 가능성이 있어 경고 수준의 주의가 필요하다. 전역 변수 도입, 환경 변수 변경, 네트워크 호출 추가, 공개 API 시그니처 변경, 파일시스템 부작용은 두 파일 모두에서 발견되지 않았다.

---

## 위험도

LOW
