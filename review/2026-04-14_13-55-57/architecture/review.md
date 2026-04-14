### 발견사항

---

**[WARNING] `renderOpFields`가 switch문으로 모든 operation 타입을 직접 처리 — 개방-폐쇄 원칙 위반**
- 위치: `transform/index.tsx`, `renderOpFields` 함수
- 상세: 새로운 operation 타입이 추가될 때마다 `index.tsx`, `defaults.ts`, `ops.tsx`, `apply-operation.ts`, `types/transform.ts` 총 5개 파일을 모두 수정해야 합니다. operation 타입이 런타임에 switch로 분기되는 패턴이 여러 계층에 중복 존재합니다.
- 제안: operation 레지스트리 패턴 도입 — 각 operation이 `{ defaultValue, renderFields, apply }` 를 함께 정의하는 맵을 두면 새 타입 추가 시 한 곳만 수정합니다. 단, 현재 11가지 타입에서 더 이상 확장이 없다면 오버엔지니어링이므로 확장 빈도에 따라 판단하세요.

---

**[WARNING] `TransformConfig`의 렌더 중 `queueMicrotask`로 setState 호출 — React 렌더링 모델 위반**
- 위치: `transform/index.tsx`, 91~99번째 라인
- 상세: 렌더 함수 본문에서 `ids.length !== operations.length` 조건 시 `queueMicrotask`로 `setIdState`를 호출합니다. 이는 React의 "렌더 중 사이드이펙트 금지" 원칙을 우회하는 패턴으로, Strict Mode에서 이중 렌더링 시 예측 불가능한 동작이 발생할 수 있습니다.
- 제안: `useEffect`로 id 동기화를 처리하거나, 부모로부터 stable id 생성을 `commit` 함수 내부에서만 수행하도록 리팩터링합니다. `addOperation`/`removeOperation` 호출 시점에 id를 함께 관리하면 렌더 중 분기 자체가 불필요해집니다.

---

**[WARNING] `applyOperation.ts`에서 `DATE_UNITS` 상수를 독립 선언 — `types/transform.ts`의 것과 중복**
- 위치: `apply-operation.ts` 10~17번째 라인, `types/transform.ts` 최하단
- 상세: `DATE_UNITS` 배열이 두 파일에 각각 정의되어 있습니다. 타입과 상수가 `types/transform.ts`에 집중되어 있는데 런타임 로직 파일에 동일 데이터가 복제되어 있어 변경 시 누락 위험이 있습니다.
- 제안: `apply-operation.ts`에서 `DATE_UNITS`를 `@/types/transform`에서 import하여 단일 소스로 통일합니다.

---

**[WARNING] `preview.tsx`가 전역 store(editor/execution)에 직접 의존 — 레이어 책임 혼재**
- 위치: `transform/preview.tsx`, 4~5번째 라인
- 상세: 순수 UI 컴포넌트인 `TransformPreview`가 `useEditorStore`, `useExecutionStore`를 직접 구독합니다. transform 설정 UI 모듈이 실행 결과 전역 상태에 결합되어 있어, 다른 맥락에서 재사용하거나 단독 테스트가 어렵습니다.
- 제안: `latestInput?: Record<string, unknown>` prop을 상위(`TransformConfig` 또는 설정 패널 루트)에서 주입받는 형태로 변경하여, store 의존을 컴포넌트 밖으로 끌어올립니다.

---

**[INFO] `ops.tsx`에 11개의 field 컴포넌트가 단일 파일에 집중**
- 위치: `transform/ops.tsx` 전체
- 상세: 파일이 현재 약 350줄이며 operation마다 독립적인 컴포넌트임에도 단일 파일로 유지됩니다. 지금은 관리 가능하지만 operation이 추가되면 빠르게 비대해집니다.
- 제안: 현재 규모에서는 허용 가능. operation 수가 15개 이상이 되면 `ops/rename-field.tsx`, `ops/string-op.tsx` 등 개별 파일로 분리를 고려하세요.

---

**[INFO] `ChipInput`의 comma 입력 처리 시 draft state 불일치**
- 위치: `chip-input.tsx`, `onChange` 핸들러 (쉼표 분기)
- 상세: 쉼표 입력 시 `setDraft(v.slice(0, -1))`를 먼저 호출하고 바로 `setDraft("")`를 호출하는 이중 setState가 발생합니다. 기능은 동작하지만 첫 번째 setState가 무의미하게 실행됩니다. 아키텍처 이슈는 아니며 코드 명확성 문제입니다.
- 제안: 첫 번째 `setDraft(v.slice(0, -1))` 호출을 제거하고 `setDraft("")`만 남깁니다.

---

### 요약

전반적으로 **레이어 분리(타입/로직/UI)와 단방향 데이터 흐름**은 잘 유지되어 있으며, prototype pollution 방어(`BLOCKED_KEYS`), 불변성(`structuredClone`) 등 핵심 안전 장치도 올바르게 구현되어 있습니다. 주요 아키텍처 위험은 두 가지입니다: (1) 렌더 중 `queueMicrotask`로 state를 변경하는 패턴은 React의 렌더링 보증을 깨며 Strict Mode에서 실제 버그로 발현될 수 있고, (2) `TransformPreview`의 전역 store 직접 구독은 해당 컴포넌트를 테스트 불가·재사용 불가 상태로 만들어 레이어 경계를 오염시킵니다. `DATE_UNITS` 중복과 switch 분산은 현재 규모에서 낮은 위험이지만 타입 추가 시 누락을 유발할 수 있습니다.

### 위험도

**MEDIUM**