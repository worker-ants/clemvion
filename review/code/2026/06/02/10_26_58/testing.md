# Testing Review — cafe24-allowlist-ui

## 발견사항

### **[WARNING]** `commit`의 sameAsAll → undefined 역전 동작 미테스트
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-allowlist-ui/codebase/frontend/src/components/integrations/__tests__/cafe24-allowlist-editor.test.tsx`
- 상세: `commit()` 함수는 `next` 배열이 전체 id 집합과 동일할 때 `onChange(undefined as unknown as string[])`를 호출하여 default_true 의미를 복원한다. 이 역전 동작은 핵심 비즈니스 로직(spec §8.3 materialize 정책)임에도 테스트에 케이스가 없다. 예를 들어 명시 enabledTools가 5개인 상태에서 남은 1개를 다시 체크(on)하면 onChange가 `undefined`를 받아야 하는데 이 시나리오가 전혀 검증되지 않는다.
- 제안: `enabledTools={allIds에서 하나 빠진 배열}` 상태에서 빠진 op를 on으로 토글 시 `onChange(undefined)`가 호출되는지 검증하는 케이스 추가.

### **[WARNING]** `level === 'program'` restrictedApproval 배지 렌더 미테스트
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-allowlist-ui/codebase/frontend/src/components/integrations/__tests__/cafe24-allowlist-editor.test.tsx`
- 상세: `cafe24-allowlist-editor.tsx`는 `op.restrictedApproval.level !== 'scope'`이면 operation 행에 ⚠ 배지를 렌더한다. 즉 `level === 'program'`도 배지 대상이다(plan INFO #5 결정). 현재 테스트 픽스처는 `level: "scope"`와 `level: "operation"`만 커버하고 `level: "program"` 케이스가 없다. consistency-check INFO #5에서 명시적으로 결정한 동작이므로 회귀 위험이 있다.
- 제안: `OP_PROGRAM: Cafe24RestrictedApproval = { level: "program", ... }` 픽스처를 추가하고, 해당 op 행에 배지가 렌더되는지 검증.

### **[WARNING]** `McpServerSelector`의 Cafe24 확장 섹션(신규 expand/collapse + AllowlistEditor 연동) 테스트 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-allowlist-ui/codebase/frontend/src/components/integrations/mcp-server-selector.tsx`
- 상세: `mcp-server-selector.tsx`에 Cafe24 서버 전용 "Operations allowlist" 확장 섹션(chevron 토글 + `Cafe24AllowlistEditor` 임베드)이 추가됐다. 기존 `candidate-picker.test.tsx`와 `assistant-message.test.ts`는 이 신규 동작을 전혀 커버하지 않는다. `toggleExpanded`, `expanded Set` 상태, cafe24 서버 감지(`serviceType === 'cafe24'`) 로직, `patch(integrationId, { enabledTools: ... })` 연결, enabledTools 카운트 뱃지 표시 등의 분기가 단위 테스트 외부에 놓여 있다.
- 제안: `mcp-server-selector.tsx` 전용 테스트 파일(`__tests__/mcp-server-selector.test.tsx`)을 신설하거나 기존 picker 테스트에 cafe24 서버 시나리오 케이스 추가. 최소한 (1) cafe24 서버의 확장 버튼 클릭 → `Cafe24AllowlistEditor` 노출, (2) non-cafe24 서버에서 확장 버튼 미노출, (3) `enabledTools` 카운트 뱃지 표시/미표시 세 케이스를 권장.

### **[WARNING]** `cafe24-extras.ts` 공유 헬퍼 단위 테스트 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-allowlist-ui/codebase/frontend/src/lib/node-definitions/cafe24-extras.ts`
- 상세: `readCafe24Extras()`와 `resolveCafe24OperationLabel()`이 `cafe24-extras.ts`로 추출돼 두 컴포넌트가 공유한다. 하지만 이 헬퍼에 대한 독립 단위 테스트가 없다. `readCafe24Extras`의 structural narrowing(operationsByResource·plannedByResource 검사) 분기가 `cafe24-allowlist-editor.test.tsx`의 `seed(null)` 테스트를 통해 간접적으로만 검증된다. `resolveCafe24OperationLabel`의 locale 분기(en dict vs ko dict)와 dict miss fallback(raw key 반환)은 명시적으로 검증된 케이스가 없다.
- 제안: `src/lib/node-definitions/__tests__/cafe24-extras.test.ts` 신설. (1) `readCafe24Extras` — extras 없음, operationsByResource 없음, plannedByResource 없음, 유효한 extras 각 케이스. (2) `resolveCafe24OperationLabel` — ko 로케일 hit, en 로케일 hit, dict miss fallback.

### **[INFO]** 카테고리 헤더 체크박스의 indeterminate 상태 미테스트
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-allowlist-ui/codebase/frontend/src/components/integrations/__tests__/cafe24-allowlist-editor.test.tsx`
- 상세: `cafe24-allowlist-editor.tsx`는 카테고리 내 일부만 on일 때 헤더 체크박스에 `el.indeterminate = true`를 ref로 세팅한다. 현재 테스트는 all-on → 헤더 off 시나리오만 다루며, partial 상태(일부 on·헤더 indeterminate)에서 헤더 클릭 시 전체 on이 되는 동작을 검증하지 않는다. jsdom에서 `indeterminate` 속성이 DOM에 세팅되는지도 확인되지 않는다.
- 제안: `enabledTools={["product_list"]}` (product 카테고리 1/2 on) 상태에서 product 헤더의 `indeterminate` DOM 속성 검증, 그리고 헤더 클릭(e.target.checked=true) 시 product 전체가 on이 되는지 검증 케이스 추가.

### **[INFO]** `enabledTools={[]}` (빈 배열) 경계 케이스 미테스트
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-allowlist-ui/codebase/frontend/src/components/integrations/__tests__/cafe24-allowlist-editor.test.tsx`
- 상세: `enabledTools=[]`는 "모두 비활성(전부 차단)" 상태로 `undefined`(전부 허용)와 구별되는 명시적 빈 allowlist다. 이 경우 모든 체크박스가 unchecked여야 하고 카테고리 헤더도 unchecked여야 한다. 현재 테스트에 이 케이스가 없다.
- 제안: `enabledTools={[]}` 렌더 시 모든 체크박스가 unchecked인지 검증하는 케이스 추가.

### **[INFO]** 영어(en) 로케일에서의 렌더 미검증
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-allowlist-ui/codebase/frontend/src/components/integrations/__tests__/cafe24-allowlist-editor.test.tsx`
- 상세: 모든 테스트가 `beforeEach`에서 `locale: "ko"`로 고정된다. `resolveCafe24OperationLabel`의 en dict 분기는 컴포넌트 수준에서 전혀 커버되지 않는다. i18n 회귀 발견이 어렵다.
- 제안: 별도 `describe("en locale")` 블록에서 `locale: "en"`으로 세팅 후 최소 하나의 렌더 케이스 추가. fake labelKey 패턴이 이미 dict miss fallback을 사용하므로 체크박스 수 확인만으로도 충분하다.

### **[INFO]** 테스트 격리 — `originalDefs` 캡처가 모듈 로드 시점에 일어남
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-allowlist-ui/codebase/frontend/src/components/integrations/__tests__/cafe24-allowlist-editor.test.tsx` 라인 95
- 상세: `const originalDefs = useNodeDefinitionsStore.getState()`가 `describe` 블록 최상위(모듈 평가 시점)에서 실행된다. 다른 테스트 파일이 이 모듈보다 먼저 store를 오염시킨 채로 실행되면 `originalDefs`가 오염된 값을 캡처할 수 있다. 격리성이 test runner 실행 순서에 의존한다.
- 제안: `beforeAll(() => { originalDefs = useNodeDefinitionsStore.getState(); })` 또는 각 `afterEach`에서 `useNodeDefinitionsStore.setState(initialState)`처럼 known-clean 상태로 복원. 현재 코드는 실용적으로 대부분의 환경에서 안전하지만 잠재적 위험이 있다.

## 요약

`Cafe24AllowlistEditor` 컴포넌트에 대한 신규 테스트(6케이스)는 핵심 렌더·토글·loading 경로를 합리적으로 커버한다. 테스트 데이터 설계(fake labelKey로 dict miss fallback 활용, `seed()`로 store 직접 주입)는 명확하고 안정적이다. 그러나 세 가지 중요한 갭이 있다. 첫째, `sameAsAll` → `onChange(undefined)` 역전 동작이 검증되지 않아 default_true 복원 로직의 회귀를 잡을 수 없다. 둘째, `McpServerSelector`에 추가된 Cafe24 확장 섹션(expand/collapse, enabledTools patch 연결)이 테스트 밖에 있다. 셋째, 공유 헬퍼 `cafe24-extras.ts`의 독립 단위 테스트가 없어 structural narrowing 로직과 로케일 분기가 간접 경로로만 검증된다. `level='program'` 배지 렌더와 빈 allowlist 경계 케이스도 추가 권장된다.

## 위험도

MEDIUM
