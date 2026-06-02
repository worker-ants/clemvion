# 부작용(Side Effect) 리뷰

## 발견사항

### **[WARNING]** `commit()` 이 `onChange` prop 에 `undefined` 를 `string[]` 타입으로 위장해 전달
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-allowlist-ui/codebase/frontend/src/components/integrations/cafe24-allowlist-editor.tsx` L66
- 상세: `onChange(sameAsAll ? (undefined as unknown as string[]) : next)` — Props 인터페이스는 `onChange: (enabledTools: string[]) => void`로 선언하지만, 전체 선택 시 실제로는 `undefined`를 흘려보낸다. TypeScript 타입 안전망을 `as unknown as string[]` 으로 강제 우회한다. 상위 컴포넌트(`McpServerSelector`)는 `patch(ref.integrationId, { enabledTools: et })` 를 통해 이 값을 받아 `McpServerRef.enabledTools?: string[]` 필드에 저장하므로 런타임상 `undefined` 저장은 정상 동작한다. 그러나 Props 시그니처와 실제 호출이 어긋나기 때문에, 미래에 다른 부모가 이 컴포넌트를 사용할 때 `string[]` 을 기대하고 배열 메서드를 바로 호출하면 런타임 오류로 이어진다.
- 제안: Props 인터페이스를 `onChange: (enabledTools: string[] | undefined) => void` 로 변경해 실제 의미를 정직하게 표현한다. 이에 맞게 McpServerSelector 의 인라인 핸들러 타입도 확인·조정한다.

---

### **[INFO]** `readCafe24Extras()` 가 전역 Zustand 스토어를 직접 읽음 — React 렌더 외부 호출 시 반응성 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-allowlist-ui/codebase/frontend/src/lib/node-definitions/cafe24-extras.ts` L17-31
- 상세: 내부적으로 `getNodeDefinition("cafe24")`가 Zustand 스토어 스냅숏을 직접 읽는다. 컴포넌트 렌더 함수 안에서 호출되는 현재 구조(`Cafe24AllowlistEditor` 내부 `readCafe24Extras()`)는 스토어 변경에 따라 리렌더가 트리거되어 문제없다. 그러나 이 순수 함수처럼 보이는 헬퍼가 사실상 전역 상태에 의존한다는 점이 명시적이지 않아, 컴포넌트 외부(비React 맥락, useEffect 외부 등)에서 호출 시 실시간 업데이트를 받지 못한다는 숨겨진 가정이 존재한다.
- 제안: JSDoc에 "Zustand 스토어 스냅숏 직접 접근 — 컴포넌트 렌더 맥락 외 호출 시 반응성 없음"을 명시한다. (현재 용도에서는 문제없음)

---

### **[INFO]** 테스트에서 Zustand 스토어를 직접 `setState` 로 조작하며 원본 캡처 위치가 `describe` 블록 최상위
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-allowlist-ui/codebase/frontend/src/components/integrations/__tests__/cafe24-allowlist-editor.test.tsx` L223-233
- 상세: `originalLocale = useLocaleStore.getState().locale`과 `originalDefs = useNodeDefinitionsStore.getState()`를 describe 블록 본문 최상위(모듈 평가 시점)에서 캡처한다. 만약 이 테스트 파일보다 앞서 실행된 다른 테스트가 해당 스토어를 변경하고 복원하지 않으면 캡처된 "원본"이 오염된 상태일 수 있다. 그러나 `afterEach` 로 복원하는 구조이므로 이 파일 내 테스트 간에는 안전하다. 외부 오염 위험은 실제 테스트 실행 순서에 따라 결정된다.
- 제안: `originalLocale`/`originalDefs` 캡처를 `beforeAll` 내로 이동하거나, 테스트 프레임워크의 격리 옵션을 확인한다. 현재 구조는 낮은 위험이지만 명시적 격리가 더 안전하다.

---

### **[INFO]** `integration-configs.tsx` — 기존 `readCafe24Extras` · `resolveCafe24OperationLabel` 함수 제거, 공유 모듈로 교체
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-allowlist-ui/codebase/frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx`
- 상세: 동일한 로직을 `cafe24-extras.ts` 공유 헬퍼로 추출하여 `integration-configs.tsx`가 import로 전환되었다. 기존 두 private 함수의 시그니처·구현이 공유 모듈과 동일하므로 행동 변경 없음. 외부 호출자(이 파일을 import하는 측)에 노출된 API가 아니었으므로 breaking change 없음.
- 제안: 없음. 올바른 리팩터링.

---

### **[INFO]** `McpServerSelector` — `expanded` 상태가 MCP ref 목록 변경 시 stale 항목 보유 가능
- 위치: `/Volumes/project/private/clemvion/.claire/worktrees/cafe24-allowlist-ui/codebase/frontend/src/components/integrations/mcp-server-selector.tsx` L879-886
- 상세: `expanded` Set은 `integrationId` 를 키로 펼침 상태를 추적한다. 사용자가 MCP server를 제거(`remove()`)해도 `expanded`에서 해당 id가 자동 제거되지 않는다. 고아 항목이 Set에 남지만, 렌더링 시 `safe.map(ref => ...)` 범위 안에서만 `expanded.has(ref.integrationId)`를 체크하므로 UI 오동작은 없다. 메모리 누수도 아니다 — Set 항목이 증가해도 무한 누적은 아님. 단, 동일 id의 server가 다시 추가될 경우 이전 펼침 상태가 자동 복원되는 의도치 않은 부작용이 발생한다.
- 제안: `remove(integrationId)` 함수 내에서 `setExpanded(prev => { const n = new Set(prev); n.delete(integrationId); return n; })` 를 함께 호출하거나, 현재 동작이 UX 관점에서 허용 가능하다면 주석으로 명시한다.

---

## 요약

이번 변경의 핵심은 기존 `integration-configs.tsx` 내 private 헬퍼 두 개를 공유 모듈로 추출하고, 그 위에 `Cafe24AllowlistEditor` 컴포넌트를 신설하여 `McpServerSelector`에 연동한 것이다. 전역 변수 도입, 파일시스템 부작용, 네트워크 호출, 환경 변수 조작은 없다. 가장 주목할 부작용은 `onChange` Props 타입이 `string[]`으로 선언되어 있으나 실제로는 `undefined`를 전달하는 타입 위장으로, 현재 유일한 부모(`McpServerSelector`)에서는 `McpServerRef.enabledTools?: string[]`로 받으므로 런타임 오류가 없지만 Props 계약 위반이다. `expanded` stale-id 잔류 문제는 UX 엣지케이스이며 즉각 버그는 아니다.

## 위험도

LOW
