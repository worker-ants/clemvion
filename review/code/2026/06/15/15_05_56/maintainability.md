# 유지보수성(Maintainability) 리뷰 — execution §1.3 single-node execution

## 발견사항

### [WARNING] `seedSingleNodePredecessorOutputs` 내 canonical 형식 판별 인라인 구현
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`, `seedSingleNodePredecessorOutputs` 메서드 내 `isCanonical` 판별 블록 (약 라인 397–403)
- 상세: `isCanonical` 체크는 `typeof storedOutput === 'object' && storedOutput !== null && !Array.isArray(storedOutput) && 'config' in storedOutput && 'output' in storedOutput` 조건으로 구성된다. 이 판별 로직은 `handler-output.adapter.ts` 에 이미 canonical 형식을 다루는 `adaptHandlerReturn` 이 있는 파일과 같은 영역에 인라인으로 존재한다. 동일하거나 유사한 canonical 체크가 다른 위치에도 필요해질 경우 중복 구현 및 불일치 위험이 발생한다. 또한 'config' 와 'output' 키 존재 여부만으로 canonical 여부를 판별하는 것은 약한 휴리스틱으로, 미래 스키마 변경 시 조용히 깨질 수 있다.
- 제안: `handler-output.adapter.ts` 에 `isCanonicalHandlerOutput(v: unknown): v is NodeHandlerOutput` 형태의 타입 가드 함수를 추출하고 `seedSingleNodePredecessorOutputs` 에서 이를 참조하도록 리팩터링한다. 어댑터 모듈이 canonical 형식의 단일 진실 역할을 하게 되어 유지보수성이 향상된다.

---

### [WARNING] `handleRunThisNode` 내 `useExecutionStore.getState()` 직접 접근 패턴
- 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx`, `handleRunThisNode` 콜백 내 라인 약 200–201
- 상세: 콜백 내부에서 `useExecutionStore.getState()`를 직접 호출해 현재 상태를 읽는다. 이 패턴은 React 렌더링 사이클 외부에서 스토어 상태를 읽는 방식으로, 같은 콜백에서 이미 `useExecutionStore((s) => s.startExecution)`를 훅으로 구독하는 패턴과 혼재된다. `useExecutionStore.getState()`는 Zustand의 바닐라 접근법으로 의도적 선택일 수 있으나, 동일 컴포넌트에서 훅 구독과 직접 `getState()` 두 패턴이 섞이면 코드 독자에게 의도가 불명확해진다. 기존 코드베이스에서 이 혼용이 일반적인 패턴인지 확인이 필요하다.
- 제안: `executionStatus`와 `executionId`를 의존성 배열에 포함하는 훅 구독 방식으로 통일하거나, 반대로 의도적으로 stale closure 회피 목적의 `getState()` 패턴임을 주석으로 명시하여 의도를 전달한다.

---

### [WARNING] `latestResult` 역방향 선형 탐색 — 대규모 nodeResults 시 성능 우려
- 위치: `codebase/frontend/src/components/editor/settings-panel/node-settings-panel.tsx`, `InfoTab` 함수 내 `useMemo` 블록
- 상세: `nodeResults` 배열 전체를 역방향으로 선형 탐색(`for (let i = nodeResults.length - 1; i >= 0; i--)`)하여 해당 `nodeId`의 마지막 결과를 찾는다. 실행이 반복될수록 `nodeResults` 배열이 증가할 경우 탐색 비용이 선형적으로 증가한다. `useMemo`로 메모이제이션되므로 실제 렌더링 비용은 줄어들지만, 의존성(`nodeResults, nodeId`)이 바뀔 때마다 전체 배열을 재탐색한다. nodeId별로 마지막 결과를 인덱싱하는 Map 형태의 파생 상태가 스토어 수준에 있으면 이 탐색 자체가 불필요해진다.
- 제안: 현재 v1 범위에서는 허용 가능하지만, `executionStore`에 `latestNodeResultMap: Map<string, NodeResult>` 를 추가하거나 셀렉터에서 미리 인덱싱하는 방향을 중기적으로 고려한다. 현재 코드에는 이 한계를 설명하는 주석이 없어 다른 개발자가 성능 특성을 파악하기 어렵다.

---

### [WARNING] `executeNode` 컨트롤러 메서드 길이 및 책임 분산 필요성
- 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts`, `executeNode` 메서드 (약 라인 936–998)
- 상세: 하나의 컨트롤러 메서드가 (1) graceful shutdown 게이트, (2) 워크플로우 존재 검증, (3) 노드 소속 검증, (4) previousExecutionId 워크플로우 소속 검증, (5) 입력 조립, (6) 실행 엔진 호출의 6가지 책임을 순차적으로 처리한다. 기존 `execute` 메서드와 구조적으로 유사하나 검증 로직이 두 단계 더 추가되었다. 현재 길이(약 62라인)는 가독성 한계에 근접해 있고, 각 검증 블록을 추출하면 단위 테스트 가능성도 높아진다.
- 제안: 노드 소속 검증과 previousExecutionId 검증을 별도의 private 헬퍼 메서드(예: `validateNodeBelongsToWorkflow`, `validatePreviousExecution`)로 추출한다. 이를 통해 컨트롤러 메서드의 주요 흐름이 한눈에 파악된다.

---

### [INFO] 이중 `await flushPromises()` 호출 패턴 — 테스트 코드 내 의도 불명확
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`, 단일 노드 실행 테스트 두 케이스 모두 (라인 약 181–182, 215–216)
- 상세: 두 테스트 케이스 모두 `await flushPromises()` 를 연속 두 번 호출한다. 왜 두 번이 필요한지에 대한 주석이 없다. 기존 테스트에서도 동일한 패턴이 사용된다면 코드베이스 관행이지만, 신규 작성한 코드에서 이유 없이 두 번 사용하면 독자가 의도를 추론해야 한다.
- 제안: 두 번 필요한 이유(예: "비동기 큐 drain 이후 백그라운드 태스크 체인 완료")를 한 줄 주석으로 명시한다. 또는 기존 동일 파일 패턴을 따른 것임을 확인하고 일관성으로 정당화한다.

---

### [INFO] `executeNode` API 함수의 빈 옵션 전달 — undefined 필드 직렬화
- 위치: `codebase/frontend/src/lib/api/workflows.ts`, `executeNode` 함수 (라인 약 1404–1408)
- 상세: `options` 가 미지정이더라도 `{ previousExecutionId: options?.previousExecutionId, input: options?.input }` 를 항상 body로 전달한다. 이 경우 `{ previousExecutionId: undefined, input: undefined }` 가 JSON.stringify 시 두 키가 제거되므로 기능상 문제는 없다. 그러나 `execute` 함수와 달리 `undefined` 필드를 명시적으로 전달하는 코드 형태가 달라 일관성이 떨어진다. `execute` 함수는 동일한 패턴을 사용하므로 코드베이스 관행이긴 하나, 팀 신규 합류자가 혼란스러울 수 있다.
- 제안: 현재 패턴은 기존 `execute` 함수와 동일하여 일관성은 있으므로 INFO 수준이다. 필요하다면 추후 `undefined` 필드를 제거하는 헬퍼 유틸을 통일해 적용한다.

---

### [INFO] `node-settings-panel.tsx` InfoTab 결과 표시 영역 — 에러/출력 둘 다 있을 때 레이아웃 검토
- 위치: `codebase/frontend/src/components/editor/settings-panel/node-settings-panel.tsx`, `InfoTab` JSX (라인 약 1340–1358)
- 상세: `latestResult.error` 가 있으면 에러 블록을 렌더하고, 에러 여부와 무관하게 출력 블록(`nodeResultOutput`)도 항상 렌더한다. 에러가 있어도 `outputData` 를 함께 표시하는 것이 의도라면 괜찮으나, 실패한 노드의 `outputData` 가 null/undefined 일 경우 `JSON.stringify(undefined, null, 2)` 가 `undefined` (문자열 없음)를 반환해 빈 `<pre>` 블록이 렌더된다. 이는 사용자에게 빈 영역으로 보인다.
- 제안: `latestResult.outputData != null` 인 경우에만 출력 블록을 렌더하거나, 빈 경우 "출력 없음" 텍스트를 표시하는 조건 분기를 추가한다.

---

## 요약

이번 변경은 §1.3 단일 노드 실행 기능을 백엔드(마이그레이션 V098, 엔티티, 서비스, 컨트롤러, DTO, 테스트)와 프런트엔드(API 클라이언트, 캔버스, 설정 패널, i18n)에 걸쳐 완결성 있게 구현하였다. 전반적으로 기존 코드베이스 패턴(dry_run/re_run_of 선례, Graceful Shutdown 게이트 재사용, 컨텍스트 서비스 기존 경로 재현)을 충실히 따르고 있어 일관성이 높다. SQL 마이그레이션 주석과 TypeScript 메서드 JSDoc이 충분히 작성되어 있어 의도 파악이 용이하다. 주요 개선 여지는 `seedSingleNodePredecessorOutputs` 내 canonical 판별 로직의 어댑터 모듈 추출(중복 방지), `handleRunThisNode` 내 혼재된 Zustand 접근 패턴의 명시화, 그리고 `executeNode` 컨트롤러 메서드의 검증 로직 분리이다. 이들은 기능 동작에는 영향이 없으나 미래 변경 시 안전성과 가독성에 영향을 준다.

## 위험도

LOW
