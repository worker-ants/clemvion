# Requirement Review — impl-execution-editor-gaps

## 발견사항

### **[INFO]** SyntaxError 잡기가 `handleRunWithInput` 에 중복 잔존

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-execution-editor-gaps-02e316/codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` L196–198
- 상세: `jsonError != null` 이면 Submit 버튼이 disabled 되어 `handleRunWithInput` 이 실행 자체가 불가능하다. 그런데 함수 본문에는 여전히 `JSON.parse(jsonInput)` 이 있고 `catch (error) { if (error instanceof SyntaxError) { alert(...) } }` 분기가 살아 있다. 실행 경로상 이 분기에 도달하기 위해서는 `jsonInput` 이 유효한 JSON 으로 useMemo 평가를 통과했는데 `handleRunWithInput` 호출 사이에 값이 바뀌어야 하므로 실제 발생 가능성은 극히 낮다. 하지만 불일치 코드가 잔존해 의도를 오독하게 할 수 있다. 또한 spec §2.2 는 "실시간 검증"만 요구하므로 이 경로는 방어 코드로 남겨 두는 게 맞을 수도 있다 — 의도가 명확하지 않아 INFO 처리.
- 제안: `catch` 내 `SyntaxError` 분기를 제거하거나, 의도적 방어 코드임을 주석으로 명시.

---

### **[INFO]** `historyPickerOpen` 상태가 `runWithInputOpen` 닫힘 시 리셋되지만, dialog 밖 클릭(외부 닫기)에는 리셋 안 됨

- 위치: `editor-toolbar.tsx` L524–528 (runWithInputOpen 조건 렌더), 그리고 `handleClickOutside` useEffect
- 상세: `runWithInputOpen` 가 `false` 가 되면 전체 dialog DOM 이 사라지므로 `historyPickerOpen` 은 orphan 상태가 된다. 다음 번 dialog 열릴 때 `historyPickerOpen` 이 여전히 `true` 로 남아 있을 수 있다. 현재 Cancel 버튼과 submit 성공 시에는 `setHistoryPickerOpen(false)` 를 호출하지만, 배경(backdrop) 클릭이나 외부 이벤트로 `runWithInputOpen` 이 닫히는 경로가 있다면 (현재 dialog 에 backdrop click-away 없으나, 미래 확장 시) 이슈가 될 수 있다. 현재 구현 기준으로는 큰 문제가 없으나, `runWithInputOpen` 을 `false` 로 설정하는 단일 경로가 Cancel/submit 뿐이고 두 곳 모두 `setHistoryPickerOpen(false)` 를 호출하므로 실제 문제 없음. INFO.

---

### **[INFO]** `isEditableTarget` 의 `contenteditable=""` 처리 — spec 언급 없음

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-execution-editor-gaps-02e316/codebase/frontend/src/components/editor/workflow-editor.tsx` L261–263
- 상세: spec §10.12 는 "편집 가능한 필드(input/textarea/select/contenteditable)" 에서는 양보한다고만 명시. `contenteditable=""` (빈 문자열 attribute)을 editable 로 처리하는 것은 구현이 spec 보다 정교한 방어 코드다. jsdom 의 `isContentEditable` 미구현에 대한 workaround 주석도 달려 있어 의도적. 이는 코드가 더 정확하고 spec 이 덜 상세한 경우로 [SPEC-DRIFT] 에 해당할 수 있으나, spec 에서 굳이 이 수준의 attribute 세부 사항까지 기술할 필요는 없어 INFO 처리.

---

### **[WARNING]** `handleLoadFromHistory` 에서 `detail.inputData` 가 null/undefined 이면 `{}` 로 fallback — 그런데 spec 동작 설명은 "해당 실행의 `inputData` 적재" 만 명시

- 위치: `editor-toolbar.tsx` L181 (`detail.inputData ?? {}`)
- 상세: `executionsApi.getById` 가 반환하는 `ExecutionData.inputData` 의 타입은 `Record<string, unknown> | null | undefined` (api/executions.ts L156). null 인 경우 `{}` 를 textarea 에 채우는 것은 합리적 방어 처리이며 spec §2.2 는 null case 를 명시하지 않는다. 그러나 null inputData 를 가진 실행을 히스토리에서 선택했을 때 사용자는 `{}` 가 채워진 것을 보고 "이 실행의 입력 데이터가 `{}`였다"고 오인할 수 있다. 실제로 없는 입력 데이터인지 빈 객체 입력인지 구분 불가. 현재 spec 이 이를 명시하지 않아 WARNING (spec 이 침묵하는 영역).
- 제안: null/undefined inputData 인 실행을 히스토리 목록에서 보여줄지 결정이 필요하거나, `{}` fallback 대신 빈 상태를 명확히 표시하는 UX 검토.

---

### **[INFO]** `historyQuery` 의 query key 가 `workflowId` 를 포함하므로 다른 workflow 로 이동해도 stale 히스토리가 보이지 않음 — 정상

- 위치: `editor-toolbar.tsx` L95–103 (`queryKey: ["editor-run-history", workflowId]`)
- 상세: workflowId 별로 분리된 캐시 키. 별도 invalidation 없이 workflowId 변경 시 자동으로 다른 캐시 버킷을 사용. 기능상 올바름.

---

### **[INFO]** [SPEC-DRIFT] spec §10.12 표 설명과 구현 동작이 더 상세 — spec 는 이미 업데이트되어 있음

- 위치: `spec/3-workflow-editor/3-execution.md` §10.12 — 변경된 스펙 텍스트 (이번 PR 포함)
- 상세: spec 본문이 동일 PR 에서 이미 갱신됨("구현" 상태 표시, `contenteditable` 양보 동작 설명 추가). 코드와 spec 사이 미반영 gap 없음.

---

### **[WARNING]** `drawerExpanded` 는 `reset()` 및 `startExecution()` 에서 보존되지만, Zustand persist 없이 페이지 새로고침 시 기본값 `true` 로 초기화됨

- 위치: `execution-store.ts` L502 (`drawerExpanded: true`)
- 상세: `panelHeight` / `timelineWidth` 는 `localStorage` 에 저장되어 새로고침 후에도 유지된다. 반면 `drawerExpanded` 는 메모리 only 로 새로고침 시 항상 `true` 로 리셋된다. 이는 의도적 설계(주석에 "실행 라이프사이클과 무관한 UI 선호값" 으로 언급)지만, 사용자가 드로어를 접어 두고 페이지 새로고침 시 다시 펼쳐져 있을 수 있다. Spec §10.12 는 지속성 요구사항을 명시하지 않으므로 spec 위반은 아님. 다만 panelHeight/timelineWidth 와 일관성이 없는 UX. INFO 보다 WARNING 수준으로 표시 — 사람이 의도 확인 권장.
- 제안: 명시적 의도라면 주석에 "localStorage persist 비대상" 을 추가. 아니라면 localStorage 저장 추가.

---

### **[INFO]** `editor-toolbar-run-input.test.tsx` — `executionState.executionId` 필드가 mock 에 있지만 `useExecutionStore` mock 이 `status` 와 `startExecution` 만 노출

- 위치: `editor-toolbar-run-input.test.tsx` L119–125
- 상세: mock 의 `executionState` 에 `executionId: null as string | null` 가 선언되어 있으나, `useExecutionStore: selector => selector(executionState)` mock 에서는 selector 가 `executionId` 를 접근할 때 정상 반환됨 (객체 포함). 실제 컴포넌트에서 `isCancellable` 분기에 `executionId` 가 사용되는데, mock 에 포함되어 있어 정상 동작. 문제 없음.

---

### **[INFO]** `workflow-editor-shortcuts.test.ts` — `contenteditable=""` (빈 문자열) 케이스 미검증

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-execution-editor-gaps-02e316/codebase/frontend/src/components/editor/__tests__/workflow-editor-shortcuts.test.ts`
- 상세: `isEditableTarget` 의 3번째 분기 (`attr === ""`)는 테스트에 커버되지 않는다. jsdom workaround 로 추가된 분기인데 테스트가 없음. 기능 오류가 아니라 커버리지 누락.
- 제안: `el("div")` 에 `setAttribute("contenteditable", "")` 한 케이스를 추가하여 해당 분기 커버.

---

## 요약

구현 대상인 §10.12 단축키(Ctrl+Shift+R 드로어 토글, Escape 캔버스 복귀) 및 §2.2 Mock Input 개선(실시간 JSON 검증, Load from History)은 모두 기능적으로 완전히 구현되어 있다. `drawerExpanded` 를 store 로 승격한 설계는 단축키와 헤더 셰브론이 동일 상태를 공유해야 한다는 요구를 올바르게 충족한다. spec §10.12 는 같은 PR 에서 이미 "구현" 상태로 갱신되었으며 코드-spec 정합성도 유지된다. 주요 우려 사항은: (1) `handleRunWithInput` 내 SyntaxError 잡기가 실시간 검증과 중복 잔존(INFO), (2) `drawerExpanded` 가 localStorage 에 저장되지 않아 panelHeight/timelineWidth 와 UX 일관성이 없음(WARNING), (3) `isEditableTarget` 의 빈 `contenteditable` 분기 테스트 누락(INFO). 비즈니스 로직 오류나 spec 위반은 없다.

## 위험도

LOW
