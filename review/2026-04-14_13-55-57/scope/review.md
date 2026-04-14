## 변경 범위(Scope) 리뷰

### 발견사항

- **[WARNING]** `DATE_UNITS` 상수 중복 정의
  - 위치: `apply-operation.ts:12-19`, `types/transform.ts` 말미
  - 상세: `apply-operation.ts`가 `DateUnit` 타입만 import하고 `DATE_UNITS`는 로컬에 별도 선언. `types/transform.ts`에 이미 동일한 값의 `DATE_UNITS`가 export되어 있음.
  - 제안: `apply-operation.ts`에서 로컬 선언 제거 후 `import { DATE_UNITS } from "@/types/transform"` 사용

- **[WARNING]** `preview.tsx`가 `nodeResults[i].inputData`를 참조
  - 위치: `preview.tsx:28-34`
  - 상세: `useExecutionStore`의 `nodeResults` 항목에 `inputData` 필드 접근. 이 필드가 execution store 타입에 새로 추가된 것이라면 해당 store 변경이 이 PR 범위에 포함되어야 하나 변경 파일 목록에 store 관련 파일이 없음. 실제로는 `undefined`로 평가될 가능성 있음.
  - 제안: execution store에 `inputData` 필드 추가 여부 확인. 없다면 `inputData` 접근 코드 제거 또는 해당 store 변경을 함께 포함.

- **[INFO]** `index.tsx`의 `queueMicrotask` 기반 ID 동기화 패턴
  - 위치: `index.tsx:95-104`
  - 상세: render 중 state sync를 피하려 `queueMicrotask`를 사용하는 비표준 패턴. 동작은 하지만 불필요하게 복잡하며 React strict mode에서 예측하기 어려운 동작을 유발할 수 있음. 기능 구현 범위를 초과하는 구현 복잡도.
  - 제안: `useEffect`로 대체하거나, ID를 `useMemo`로 operations 배열에서 직접 파생하는 단순한 접근 검토.

- **[INFO]** `ops.tsx` 내 `MiniSelect`, `FieldLabel`, `PathInput` 모듈-프라이빗 헬퍼
  - 위치: `ops.tsx:27-62`
  - 상세: 현재 범위에서 `ops.tsx` 전용으로 사용되므로 범위 초과는 아님. 단, 향후 다른 node config에서 재사용 가능한 컴포넌트이므로 shared 폴더 추출 가능성 있음. 현재로선 범위 내.
  - 제안: 해당 구현에서는 현행 유지 가능. (범위 위반 아님)

- **[INFO]** `apply-operation.ts`에서 `is_empty` 조건이 객체 타입을 처리하지 않음
  - 위치: `apply-operation.ts:134-140`
  - 상세: `is_empty`가 `""`, `null`, `undefined`, 빈 배열만 처리하며 빈 객체(`{}`)는 not empty로 평가됨. 스펙이 이를 명시하지 않으면 범위 이슈는 아니나 일관성 검토 필요.
  - 제안: 스펙 확인 후 필요하면 `Object.keys(v).length === 0` 케이스 추가.

---

### 요약

변경된 9개 파일은 모두 신규 파일(untracked)로 Transform 노드 UI 및 실행 로직 전체를 구성하는 일관된 범위 내 구현이다. 불필요한 기존 코드 수정이나 관련 없는 리팩토링은 없다. 주요 scope 이슈는 두 가지로, `DATE_UNITS` 중복 선언(types에서 import해야 할 것을 로컬 재선언)과 `preview.tsx`가 execution store의 `inputData` 필드에 의존하면서 해당 store 변경이 이번 변경 집합에 포함되지 않은 점이다. `queueMicrotask` 패턴은 범위를 벗어나지는 않으나 불필요한 복잡도를 도입한다.

### 위험도

**LOW**