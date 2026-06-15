# 유지보수성(Maintainability) 리뷰 — execution §1.3 single-node execution (FRESH, post-resolution)

**리뷰 세션**: 2026-06-15 15:29:28
**대상**: execution §1.3 단일 노드 실행 — RESOLUTION 적용 후 fresh 검토
**이전 리뷰**: `review/code/2026/06/15/15_05_56/maintainability.md` (WARNING 4건, INFO 3건, 위험도 LOW)
**주요 변경**: W-13 해소 (`isCanonicalHandlerOutput` 타입 가드 추출) + W-4/W-14/W-15/W-16 주석 명시

---

## 발견사항

### [INFO] W-13 해소 확인 — `isCanonicalHandlerOutput` 타입 가드 추출 완료
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-single-node/codebase/backend/src/modules/execution-engine/handler-output.adapter.ts` L195-205
- 상세: `isCanonicalHandlerOutput(raw: unknown): raw is NodeHandlerOutput` 가 `handler-output.adapter.ts` 에 export 함수로 정의되어 있다. 내부적으로 `isNewShape(raw)` 에 위임하며 JSDoc 에 SoT 역할과 사용 사례(`seedSingleNodePredecessorOutputs`)가 명시되어 있다. `execution-engine.service.ts` 의 `seedSingleNodePredecessorOutputs` 는 이 export 를 참조해 인라인 중복이 제거됐다. 이전 W-13 은 완전히 해소됨.
- 제안: 없음.

### [INFO] W-4 해소 확인 — `getState()` 의도 주석 명시 완료
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-single-node/codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` L270-272
- 상세: `getState()` 직접 접근이 stale closure 회피를 위한 의도적 선택임을 주석으로 명시(`stale closure 아님 — 항상 live 스냅샷 / 자주 바뀌는 execution status 를 캔버스가 구독하지 않게 해 불필요한 re-render 를 피하려는 의도`). 코드 독자의 오해 가능성이 해소됨.
- 제안: 없음.

### [INFO] W-14 해소 확인 — TOCTOU 재확인 로직 추가 완료
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-single-node/codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` L278-279
- 상세: `saveWorkflow()` await 이후 `useExecutionStore.getState().status === "running"` 를 재확인하는 가드가 추가되어 있다. 저장 중 다른 경로로 실행이 시작된 경우의 중복 실행을 차단한다. 재확인 지점에 명시적 주석(`TOCTOU`)이 붙어 있어 의도가 명확하다.
- 제안: 없음.

### [INFO] W-15 해소 확인 — catch 블록 silent-fail 의도 주석 추가
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-single-node/codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` L290-292
- 상세: `catch (error)` 블록에 v1 범위 결정(`실패는 콘솔 로깅만 / 사용자 가시 토스트 피드백은 후속 과제`)이 주석으로 기록되어 있다. 의도 없는 무음 실패로 오해하지 않도록 근거가 명시됨.
- 제안: 없음.

### [INFO] W-16 해소 확인 — `InfoTab` `nodeId` prop 추가 배경 주석
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-single-node/codebase/frontend/src/components/editor/settings-panel/node-settings-panel.tsx` L493-494
- 상세: `InfoTab` 함수 선언 직전에 `nodeId` 가 §1.3 단일 노드 실행 결과 표시를 위해 추가됐음을 설명하는 주석이 있다. `useExecutionStore` 의 `nodeResults` 에서 해당 노드의 최신 결과를 찾는 목적도 기술되어 있다.
- 제안: 없음.

### [WARNING] `executeNode` 컨트롤러 메서드 길이와 책임 집중 — 이전 리뷰 W-4 상당 (DEFER 미해소)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-single-node/codebase/backend/src/modules/workflows/workflows.controller.ts` L359-421
- 상세: RESOLUTION 에서 W-1/W-2(레이어 위반 DEFER), W-3(SRP 누적 DEFER) 는 근거와 함께 보류됐다. `executeNode` 단일 메서드가 (1) graceful shutdown 게이트, (2) 워크플로우 소속 검증, (3) 노드 소속 검증, (4) previousExecutionId 소속 검증, (5) 입력 조립, (6) 엔진 호출의 6가지 역할을 62줄에 담고 있다. 이전 리뷰 시점과 구조 변동 없음. RESOLUTION 에서 기존 패턴(`nodeRepository` 직접 주입 선례)을 근거로 DEFER 처리됐으며 본 fresh 리뷰도 동일하게 WARNING 수준으로 유지한다. 기능 동작에는 영향 없음.
- 제안: 노드 소속 검증(`validateNodeBelongsToWorkflow`)과 이전 실행 검증(`validatePreviousExecution`)을 private 헬퍼로 추출하면 주 흐름 가독성이 향상됨. 단, DEFER 근거(기존 선례 일관)를 감안하면 별도 리팩토링 과제로 처리하는 것이 적절하다.

### [WARNING] `latestResult` 역방향 선형 탐색 — 이전 리뷰 W-3 상당 (INFO 유지)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-single-node/codebase/frontend/src/components/editor/settings-panel/node-settings-panel.tsx` L508-513
- 상세: `nodeResults` 배열 전체를 역방향으로 선형 탐색하여 해당 nodeId 의 최신 결과를 찾는다. `useMemo` 로 메모이제이션되어 있으나 `nodeResults` 참조가 바뀔 때마다 O(n) 재탐색이 발생한다. 탐색의 성능 특성에 대한 주석이 없어 유지보수자가 대규모 배열 시 복잡도를 파악하기 어렵다. 이전 리뷰에서 INFO 로 분류됐으나, 주석 미명시를 고려해 WARNING 으로 재평가한다. v1 실용 규모에서는 즉각 위험 없음.
- 제안: `useMemo` 블록 또는 인접 줄에 `// O(n) — nodeResults 가 큰 경우 executionStore Map 인덱스로 교체 고려` 1행 주석을 추가하면 충분하다.

### [INFO] `InfoTab` 출력 블록 — `outputData` null/undefined 시 빈 `<pre>` 렌더
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-single-node/codebase/frontend/src/components/editor/settings-panel/node-settings-panel.tsx` L591-597
- 상세: 에러 여부와 무관하게 출력 블록이 항상 렌더된다. `latestResult.outputData` 가 null/undefined 이면 `JSON.stringify(undefined, null, 2)` 가 `undefined`(JavaScript 값)를 반환해 실제 문자열이 비어 `<pre>` 태그가 빈 채로 표시된다. 실패한 노드의 outputData 가 null 인 경우 UX 상 빈 영역이 남는다. 이전 리뷰에서도 동일하게 지적됐으나 RESOLUTION 에서 미조치 상태.
- 제안: `{latestResult.outputData != null && (...)}` 조건 분기를 추가하거나, null/undefined 시 `"(출력 없음)"` placeholder 를 표시한다.

### [INFO] 이중 `await flushPromises()` — 테스트 의도 주석 없음 (이전 I-1 연속)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-single-node/codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` (단일 노드 실행 테스트 내 연속 두 번 호출)
- 상세: RESOLUTION 에서 미조치. 테스트 내 두 번 연속 `await flushPromises()` 호출에 이유가 설명되지 않는다. 이 파일의 기존 패턴인지 확인할 수 있으나, 신규 작성 블록에서 이유를 주석으로 명시하면 가독성이 향상된다.
- 제안: `// 비동기 체인 두 단계 drain — service.execute 의 Promise + 백그라운드 runExecution` 형태 주석 1행 추가.

### [INFO] `executeNode` API 클라이언트 — undefined 필드 명시적 전달 (이전 I-2 연속)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-single-node/codebase/frontend/src/lib/api/workflows.ts`
- 상세: `{ previousExecutionId: options?.previousExecutionId, input: options?.input }` 형태로 undefined 값을 포함한 객체를 전달한다. JSON.stringify 시 undefined 키가 제거되므로 기능 오류 없음. 기존 `execute` 함수와 동일한 코드베이스 패턴으로 일관성은 있다.
- 제안: 현행 유지 무방. 스타일 개선이 필요하다면 전체 API 클라이언트 레이어에서 일괄 적용 권장.

---

## 요약

RESOLUTION 조치(W-4/W-13/W-14/W-15/W-16)가 코드에 정확히 반영되어 있음을 확인했다. W-13 의 핵심인 `isCanonicalHandlerOutput` 타입 가드는 `handler-output.adapter.ts` 에 export 되어 `execution-engine.service.ts` 가 참조하며 도메인 지식이 단일 SoT 로 일원화됐다. `handleRunThisNode` 의 `getState()` 접근 의도 주석, TOCTOU 재확인, catch silent-fail 근거, `InfoTab` nodeId prop 배경 주석도 모두 코드에 존재한다. 잔존 유지보수성 이슈는 RESOLUTION 에서 DEFER 처리된 아키텍처 레이어 관련 사항(W-1/W-2/W-3 — `executeNode` 메서드 책임 집중, 컨트롤러 Repository 직접 주입)과 v1 범위에서 허용된 소규모 개선 여지(선형 탐색 주석 미기재, `outputData` null 시 빈 `<pre>`, 이중 `flushPromises` 주석)에 한정된다. 기능 구현 품질과 코드 가독성은 이전 리뷰 대비 향상됐으며 새로운 Critical 발견 없음.

---

## 위험도

LOW
