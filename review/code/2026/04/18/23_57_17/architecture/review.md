## 아키텍처 코드 리뷰

### 발견사항

---

- **[WARNING]** 컨테이너 스코프 변수 게이팅 로직이 세 곳에 분산
  - 위치: `use-expression-suggestions.ts` (scopedRoots 필터), `variable-picker.tsx` (scopedBuiltIns 필터), `validate-scope.ts` (LOOP_ROOT_RE/ITEM_ROOT_RE 검사)
  - 상세: 어떤 변수가 어떤 컨테이너 타입에 속하는지에 대한 지식(`$loop` → loop, `$item/$itemIndex` → foreach)이 세 파일에 걸쳐 하드코딩으로 중복되어 있음. 새로운 컨테이너 스코프 변수(예: `$error`를 제공하는 `try-catch`)를 추가할 경우 최소 6~7개 파일을 수정해야 함.
  - 제안: `expression-constants.ts`에 컨테이너 스코프 변수의 선언을 중앙화. 아래와 같이 단일 구성 객체 패턴 도입 권장:
    ```ts
    // expression-constants.ts
    export interface ScopedVariableDef extends Suggestion {
      scopeKey?: keyof ContainerScope; // 'hasLoop' | 'hasItem'
    }
    ```
    이렇게 하면 필터링, 검증, UI 표시 모두 이 단일 선언을 참조할 수 있음.

---

- **[WARNING]** `variable-picker.tsx`의 JSX 내 IIFE 사용 — 안티패턴
  - 위치: `variable-picker.tsx`, Built-in variables 렌더링 블록
  - 상세: `{(() => { ... })()}` 패턴은 JSX 내에서 컴포넌트 로직과 렌더링을 혼합시키고, 가독성을 떨어뜨리며 React Devtools에서의 추적도 어렵게 만듦. `use-expression-suggestions.ts`의 동일한 필터링은 컴포넌트 바깥에서 깔끔하게 처리됨.
  - 제안: return 문 이전에 const 변수로 추출하거나 `useMemo`를 활용:
    ```tsx
    const scopedBuiltIns = useMemo(() =>
      BUILT_IN_PICKER_VARIABLES.filter((v) => {
        if (v.label === "$loop") return containerScope.hasLoop;
        if (v.label === "$item" || v.label === "$itemIndex") return containerScope.hasItem;
        return true;
      }),
    [containerScope]
    );
    ```

---

- **[WARNING]** `validate-scope.ts`에서 `g` 플래그가 있는 전역 정규식을 `.test()`와 함께 사용 — 상태 누수 위험
  - 위치: `validate-scope.ts`, `LOOP_ROOT_RE`, `ITEM_ROOT_RE`, `ITEM_INDEX_ROOT_RE` 선언 및 사용부
  - 상세: JavaScript에서 `g` 플래그를 가진 정규식 인스턴스는 `.test()` 호출 후 `lastIndex`가 전진하는 상태를 가짐. 현재 코드는 매 호출 후 `lastIndex = 0`으로 수동 리셋하지만, 이는 실수하기 쉬운 패턴. `.matchAll()`과 달리 `.test()`는 새로운 반복자를 생성하지 않으므로, 예외 경로에서 리셋이 누락되면 다음 호출에서 매칭 결과가 달라짐.
  - 제안: `test()`용 정규식은 `g` 플래그 없이 분리하거나, 함수 내부에서 `new RegExp()`로 인스턴스를 생성하여 전역 상태 의존성을 제거:
    ```ts
    const LOOP_ROOT_PATTERN = /(?<![A-Za-z0-9_$])\$loop(?![A-Za-z0-9_$])/;
    // test에는 g 없는 버전, matchAll에는 g 있는 버전 사용
    ```

---

- **[INFO]** `use-expression-context.ts` Hook의 책임 범위가 넓음
  - 위치: `use-expression-context.ts`, `useExpressionContext` 함수 전체
  - 상세: 단일 `useMemo` 블록 내에서 그래프 조상 계산, 키 disambiguate, 입력 스키마 해석, 테이블 컨텍스트 판별, 컨테이너 스코프 플래그 계산을 모두 수행. 현재 기능 범위에서는 관리 가능하지만 향후 기능 추가 시 비대해질 위험이 있음.
  - 제안: 장기적으로는 `useContainerScope`, `useAncestorNodes` 같은 세부 훅으로 분리를 고려할 수 있으나, 현재 규모에서는 필수 수준의 리팩터링은 아님.

---

- **[INFO]** `expression-constants.ts`에서 소비자별 변환(`BUILT_IN_PICKER_VARIABLES`)을 상수 파일이 담당
  - 위치: `expression-constants.ts`, `BUILT_IN_PICKER_VARIABLES` 선언
  - 상세: `BUILT_IN_PICKER_VARIABLES`는 `ROOT_VARIABLES`를 필터+맵한 파생 데이터로, `variable-picker.tsx`의 도메인 지식(`$input`, `$node`, `$var`를 제외하는 이유)을 상수 파일에 인코딩하고 있음. SRP 관점에서 미묘한 레이어 역전.
  - 제안: 경미한 수준의 문제이므로 즉각적인 수정보다는 향후 컨테이너 스코프 중앙화 작업 시 함께 정리 권장.

---

- **[INFO]** 순환 의존성 없음 — 의존성 그래프 양호
  - `reachable-nodes.ts` / `validate-scope.ts`는 외부 의존성 없는 순수 유틸리티, `use-expression-context.ts`가 이를 소비, UI 컴포넌트가 훅을 소비하는 단방향 구조. 

---

### 요약

전반적으로 레이어 분리가 명확하고 (`reachable-nodes.ts`의 순수 그래프 유틸리티, `validate-scope.ts`의 순수 검증 로직, `use-expression-context.ts`의 데이터 집계 훅, UI 컴포넌트), 순환 의존성이 없으며 테스트 커버리지도 충실하다. 핵심 아키텍처 문제는 **컨테이너 스코프 변수 게이팅 로직의 분산**이다 — `$loop`/`$item`/`$itemIndex`가 어떤 컨테이너 타입에 속하는지에 대한 도메인 지식이 `use-expression-suggestions.ts`, `variable-picker.tsx`, `validate-scope.ts` 세 곳에 동시에 하드코딩되어 있어 새로운 컨테이너 스코프 변수 추가 시 다중 파일 수정을 강요하는 OCP 위반이다. `expression-constants.ts`에 `scopeKey` 메타데이터를 추가하여 단일 진실의 원천(Single Source of Truth)으로 만드는 것이 권장된다.

### 위험도
**LOW**