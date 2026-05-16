# 아키텍처(Architecture) 리뷰

대상 커밋: `6ceebadd3c31fff8894670fb1c4eab4d5389ac65`
리뷰 파일:
1. `frontend/src/components/editor/settings-panel/node-configs/__tests__/cafe24-config.test.tsx` (신규)
2. `frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx` (수정)
3. `plan/in-progress/cafe24-fields-add-button-fix.md` (신규)

---

### 발견사항

- **[WARNING]** `Cafe24Config` 컴포넌트 내부에서 렌더 중 `setState` 호출 — 파생 상태 동기화 패턴의 책임 혼재
  - 위치: `integration-configs.tsx` L349-355 (`if (!objectsEqual(...)) { setFieldRows(...); setLastPropagated(...); }`)
  - 상세: React 공식 문서가 제시하는 "render 중 setState" 패턴은 동기화 목적으로 허용되지만, 이 로직이 컴포넌트 함수 본문 최상위에 인라인으로 존재한다. 결과적으로 `Cafe24Config`는 (1) 필드 UI 렌더링, (2) 외부 상태 감시, (3) 양방향 직렬화 변환이라는 세 가지 책임을 동시에 수행한다. 단일 책임 원칙(SRP) 측면에서 이 파생-상태 동기화 로직은 커스텀 훅(`useFieldRowsSync`)으로 분리하는 것이 더 명확하다.
  - 제안: 아래 시그니처의 커스텀 훅으로 추출한다.
    ```ts
    function useFieldRowsSync(
      externalFields: Record<string, unknown>,
    ): [Array<{key: string; value: string}>, (items: Array<{key: string; value: string}>) => Record<string, string>]
    ```
    이렇게 하면 `Cafe24Config`는 렌더 책임만 갖고, 동기화 로직은 독립 단위로 테스트·재사용 가능해진다.

- **[WARNING]** `objectsEqual`과 `fieldRowsToObject`가 `integration-configs.tsx` 모듈 최상위에 노출 — 모듈 경계 과소
  - 위치: `integration-configs.tsx` L301-322
  - 상세: `fieldRowsToObject`와 `objectsEqual`은 `Cafe24Config`에만 사용되는 순수 유틸 함수다. 동일 파일 내 다른 통합(Slack, HTTP 등) 컴포넌트들과 같은 네임스페이스에 존재하며, 파일이 성장할수록 유틸리티와 컴포넌트가 뒤섞인다. `integration-configs.tsx`가 이미 다수의 통합별 설정 컴포넌트를 포함하는 큰 파일임을 감안하면, Cafe24 전용 로직은 별도 파일(`cafe24-config.tsx` 또는 `cafe24/`)로 경계를 나누는 것이 바람직하다.
  - 제안: Cafe24 관련 타입·유틸·컴포넌트를 `node-configs/cafe24/` 하위 디렉토리로 분리하고, `integration-configs.tsx`에서 re-export한다. 현재 규모에서 강제하기보다는 다음 Cafe24 기능 확장 시점을 기준으로 분리를 트리거한다.

- **[WARNING]** 테스트 내 DOM 쿼리 취약성 — 구현 세부사항에 결합
  - 위치: `cafe24-config.test.tsx` L206-216 (`row.querySelector("button:not([data-state])")`, `candidateButtons[candidateButtons.length - 1]`)
  - 상세: 삭제 버튼을 찾는 로직이 DOM 트리 구조(부모 요소, `button:not([data-state])` 속성, 마지막 인덱스)에 의존한다. `KeyValueEditor`의 내부 레이아웃이 변경되면 테스트가 동작 변화 없이 깨진다. 이는 아키텍처 관점에서 테스트가 UI 구현 세부사항과 높은 결합도를 가짐을 의미한다.
  - 제안: `KeyValueEditor`의 삭제 버튼에 `data-testid="remove-row-{index}"` 또는 `aria-label`을 부여하고, 테스트는 그 명시적 셀렉터를 사용한다. 이렇게 하면 테스트-구현 결합도가 낮아지고 레이아웃 변경에 내성이 생긴다.

- **[INFO]** `lastPropagated` state 추적 방식 — `useRef` 대신 `useState` 선택의 근거 문서화
  - 위치: `integration-configs.tsx` L341-343 (주석)
  - 상세: 코드 주석에서 React 공식 문서를 인용해 `useState`를 선택한 이유를 설명하고 있다. 그러나 `lastPropagated`의 변경이 렌더를 트리거할 필요가 없다는 점에서 `useRef`가 더 의미적으로 정확하다. render 중 `setLastPropagated`를 호출하므로 React가 추가 렌더를 하지 않는다는 보장이 현재 패턴에 의존되어 있다. 미묘한 동시성 모드 엣지 케이스에서 동작 차이가 발생할 수 있다.
  - 제안: `lastPropagated`를 `useRef<Record<string, unknown>>`으로 변경하면 의도(렌더 트리거 없이 이전 값 추적)가 더 명확해진다. 단, 커스텀 훅으로 추출 시 해당 결정도 훅 내부로 캡슐화한다.

- **[INFO]** 레이어 책임은 적절하게 유지됨
  - 위치: 전체 변경
  - 상세: 백엔드 계약(`Record<string, unknown>`)은 `onChange` 업스트림으로 그대로 전달되고, UI 내부의 배열 표현(`Array<{key, value}>`)은 컴포넌트 경계 밖으로 노출되지 않는다. 프레젠테이션 레이어와 데이터 계층 간 변환 지점이 명확히 `handleFieldRowsChange` 한 곳에 집중된 점은 긍정적이다.

- **[INFO]** 확장성 — `SettingsTab` key 전략에 의존
  - 위치: `plan/in-progress/cafe24-fields-add-button-fix.md` L477
  - 상세: plan 문서가 "`SettingsTab`이 `selectedNodeId`로 keyed 되어 있어 노드 전환 시 unmount/remount"라는 외부 보장에 의존함을 명시하고 있다. 만약 이 key 전략이 변경되면 `fieldRows` state stale 문제가 재발한다. 이 의존성은 `Cafe24Config` 코드 내 주석에도 명시되어 있지 않다.
  - 제안: `Cafe24Config` 상단 주석에 "이 컴포넌트는 노드 전환 시 부모가 `key={selectedNodeId}`로 remount를 보장함을 전제한다"는 한 줄을 추가해 암묵적 전제를 명시적으로 문서화한다.

---

### 요약

이번 변경은 `Cafe24Config`에 로컬 `useState` 버퍼를 도입해 "추가" 버튼의 빈 행 소멸 버그를 올바르게 수정했다. 백엔드 계약과 UI 편집 표현의 이중 관리 문제를 컴포넌트 내부로 캡슐화하고, 외부 상태 변경(undo/redo) 대응 로직도 포함한 점은 설계 의도가 분명하다. 그러나 파생-상태 동기화, 직렬화 변환, 렌더링이라는 세 책임이 단일 컴포넌트에 혼재하며, Cafe24 전용 유틸 함수(`fieldRowsToObject`, `objectsEqual`)가 다수 통합을 담당하는 공유 파일에 섞여 있어 모듈 경계가 점차 흐려질 위험이 있다. 테스트는 커버리지 측면에서 충분하나 삭제 버튼 탐색 로직이 DOM 구조에 과도하게 결합되어 있어 리팩토링 내성이 낮다. 단기적으로 동작에 문제는 없으나, Cafe24 기능이 성장하는 시점에 커스텀 훅 추출 및 디렉토리 분리를 진행하는 것을 권장한다.

### 위험도

LOW
