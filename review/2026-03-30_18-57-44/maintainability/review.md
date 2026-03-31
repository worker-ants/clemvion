### 발견사항

**[INFO]** `node-configs` 파일들의 `key={i}` 사용
- 위치: `logic-configs.tsx`, `ai-configs.tsx`, `presentation-configs.tsx` 등 배열 렌더링
- 상세: 모든 동적 목록(조건, 카테고리, 필드 등)에서 배열 인덱스를 key로 사용. 항목 순서가 바뀌면 React 재조정 오류 발생 가능.
- 제안: `crypto.randomUUID()`나 `nanoid`로 생성한 ID를 항목 생성 시 부여하거나, 최소한 내용 기반 key 사용 (`key={cond.field + i}`)

**[INFO]** `Config = Record<string, unknown>` 타입이 모든 config 파일에 중복 선언
- 위치: `ai-configs.tsx:9`, `data-configs.tsx:9`, `flow-configs.tsx:7`, `integration-configs.tsx:8`, `logic-configs.tsx:9`, `presentation-configs.tsx:9`
- 상세: 동일한 `type Config`와 `type OnChange`가 6개 파일에 각각 선언됨.
- 제안: `shared.tsx` 또는 `types.ts`에서 export하여 공유

**[INFO]** `AuthProvider`에서 `setLoading`이 deps 배열에 포함되어 있으나 실제로 사용되지 않음
- 위치: `auth-provider.tsx:44`
- 상세: `useEffect`의 dependency array에 `setLoading`이 포함되어 있으나 `restoreSession` 함수 내에서 호출되지 않아 의도가 불명확함. 또한 로딩 상태가 초기화되지 않아 `isLoading`이 항상 초기값을 유지할 수 있음.
- 제안: `setLoading` deps 제거 또는 `restoreSession` 시작/종료 시 `setLoading(true/false)` 호출 추가

**[INFO]** `onNodesChange`의 `remove` 처리에서 `removedIds` 계산이 중복
- 위치: `editor-store.ts:70-76`
- 상세: `filteredChanges.filter(c => c.type === "remove").map(c => c.id)` 계산이 `edges` 필터링 내부에서 매 엣지마다 반복 실행됨.
- 제안: 변수로 추출하여 한 번만 계산
```ts
const removedIds = new Set(filteredChanges.filter(c => c.type === "remove").map(c => c.id));
return { edges: state.edges.filter(e => !removedIds.has(e.source) && !removedIds.has(e.target)), ... };
```

**[INFO]** `NodeSettingsPanel`에서 `SettingsTab`과 `CodeTab`이 각각 `useEditorStore.getState()`를 직접 호출
- 위치: `node-settings-panel.tsx:130`, `node-settings-panel.tsx:235`
- 상세: 컴포넌트 내부에서 store를 직접 명령형으로 조작하는 패턴이 두 곳에 분산되어 있음. 동일한 `pushUndo` + `setState` 패턴이 두 함수에 중복.
- 제안: `updateNodeData(nodeId, patch)` 같은 store action으로 추출하여 공유

**[INFO]** `CheckboxField`의 `id` 생성 방식이 레이블 충돌 가능
- 위치: `shared.tsx:121`
- 상세: `cb-${label.replace(/\s+/g, "-").toLowerCase()}`로 생성하면 동일 레이블이 여러 번 렌더링될 때 DOM id 중복 발생.
- 제안: `useId()` hook 사용 또는 `id` prop을 외부에서 주입

**[INFO]** `handleLogout`이 `async function` 선언이나 오류 처리 후 반드시 logout 실행
- 위치: `sidebar.tsx:50-58`
- 상세: 현재 구조는 명확하지만, `async function`을 이벤트 핸들러로 직접 사용하면 unhandled promise rejection 가능성 있음 (단, catch 블록으로 처리되어 실제 위험은 낮음).
- 제안: `onClick={handleLogout}` 대신 명시적 래핑은 불필요하지만, `void handleLogout()` 패턴 또는 `onLogout` 분리도 고려 가능

---

### 요약

전반적으로 코드는 잘 구조화되어 있으며, 책임 분리(Settings/Code/Info 탭 분리, shared 공통 컴포넌트 도입, NodeConfigRenderer 추상화)가 적절하게 이루어져 있습니다. 주요 유지보수성 리스크는 6개 config 파일에 동일한 `Config`/`OnChange` 타입이 중복 선언된 것과, 동적 목록에 배열 인덱스 key 사용, `editor-store.ts`의 `removedIds` 반복 계산 정도입니다. `AuthProvider`의 `setLoading` 미사용은 로딩 UI가 동작하지 않을 수 있는 버그로 이어질 수 있어 확인이 필요합니다. 전체적으로 위험도는 낮으며 코드 품질이 양호합니다.

### 위험도
**LOW**