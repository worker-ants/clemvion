# 테스트(Testing) 리뷰

## 발견사항

### [WARNING] `isError` 상태 분기 미검증 — ScopeListPanel·MemoryListPanel 공통
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/ai-mem-admin-frontend/codebase/frontend/src/app/(main)/agent-memory/components/__tests__/scope-list-panel.test.tsx`, `memory-list-panel.test.tsx`
- 상세: 두 패널 컴포넌트 모두 `isError` prop을 받지만, 어떤 테스트도 `isError=true` 시의 렌더링을 검증하지 않는다. baseProps에 `isError: false` 기본값이 있을 뿐이다. `isLoading` 분기는 테스트되나 `isError` 분기(에러 메시지/UI)는 전혀 커버되지 않아 에러 상태 회귀를 잡을 수 없다.
- 제안: 각 패널에 `isError=true` 케이스를 추가한다 — `screen.getByText("에러 메시지 텍스트")` 또는 `screen.queryBy*`로 에러 UI 존재 여부 확인.

### [WARNING] `agentMemoriesApi.listMemories` — `kind` 미지정 파라미터 경로 미검증
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/ai-mem-admin-frontend/codebase/frontend/src/lib/api/__tests__/agent-memories.test.ts`
- 상세: `listScopes` 테스트는 `q` 미지정 시 params에 `q` 키가 없음을 명시적으로 검증한다(87번째 줄). 반면 `listMemories`는 `kind` 미지정 케이스를 테스트하지 않는다. 구현(`agent-memories.ts` L57)이 동일 패턴(`...(kind ? { kind } : {})`)을 쓰므로 대칭적으로 검증해야 한다. 만약 향후 조건 분기가 변경되면 회귀를 잡을 수 없다.
- 제안: `"listMemories: kind 미지정이면 params 에 kind 키 없음"` 테스트 케이스 추가. `getMock`이 `{ params: { scopeKey: ..., limit: ..., offset: ... } }`(kind 없음)으로 호출됨을 확인.

### [WARNING] CORS `exposedHeaders` 설정 — 단위 수준 검증 부재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/ai-mem-admin-frontend/codebase/backend/src/main.ts`
- 상세: 이번 변경의 핵심 기능 버그 수정(`exposedHeaders: ['X-Deleted-Count']`)에 대한 단위 테스트가 없다. e2e(218) 통과로 동작은 확인됐으나, `main.ts`의 `defaultOptions()` 반환 객체에 해당 헤더가 포함됨을 명시적으로 고정하는 테스트가 없으면, 향후 리팩터링 시 해당 설정을 조용히 제거해도 unit 레벨에서 잡히지 않는다. `main.ts` 부트스트랩 테스트는 무거우나, `defaultOptions` 팩토리 함수를 별도 모듈로 추출하면 순수 단위 테스트가 가능하다.
- 제안: 단기 조치로는 `web-chat-cors.ts`의 `CorsOptionsLike` 타입 테스트(타입 레벨) 또는 통합 테스트에서 `Access-Control-Expose-Headers` 응답 헤더 존재 여부를 검증. 중기에는 `defaultOptions` 생성 로직을 순수 함수로 추출해 단위 테스트 추가.

### [INFO] `clearScope` — 방어 분기(flat-array) 미검증 (함수 공유 인지)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/ai-mem-admin-frontend/codebase/backend/src/modules/agent-memory/agent-memory-admin.service.spec.ts`
- 상세: W10 테스트는 `deleteMemory` describe 블록에 추가되어 `deletedRowCount` 헬퍼의 flat-array 분기를 커버한다. `clearScope`도 동일 함수를 호출하나, `clearScope` describe에는 flat-array 케이스가 없다. 헬퍼가 동일하므로 기능 회귀 위험은 낮지만, `clearScope` 계약을 보는 독자가 방어 분기 근거를 찾지 못할 수 있다.
- 제안: `clearScope` describe에도 flat-array 케이스 추가(`mockDataSource.query.mockResolvedValue([{ id: 'a' }])` → `expect(...).toBe(1)`). 또는 `deletedRowCount` 자체를 분리된 단위로 직접 테스트.

### [INFO] `isFetchingNextPage` 상태 미검증 — 두 패널 공통
- 위치: `scope-list-panel.test.tsx`, `memory-list-panel.test.tsx`
- 상세: `isFetchingNextPage: false`가 baseProps 기본값이나, `true` 일 때 버튼이 비활성화되거나 스피너가 표시되는 경우가 있다면 해당 분기가 테스트되지 않는다. `hasNextPage=true` + `isFetchingNextPage=true` 조합에서 "더 보기" 버튼 상태를 검증하는 케이스가 없다.
- 제안: 페치 중 UI 분기가 컴포넌트에 존재하면 추가 케이스 작성 권장.

### [INFO] `onKindFilterChange` 콜백 미검증 — MemoryListPanel
- 위치: `memory-list-panel.test.tsx`
- 상세: `onKindFilterChange: vi.fn()`이 baseProps에 정의되나, 어떤 테스트도 kind 필터 선택 시 이 콜백이 호출됨을 검증하지 않는다. 삭제 콜백, load more 콜백은 테스트됐으나 kind 필터 변경 콜백은 누락.
- 제안: kind 필터 UI 요소(드롭다운·버튼)를 `fireEvent.click`으로 조작하고 `onKindFilterChange`가 올바른 kind 값으로 호출됐는지 확인하는 테스트 추가.

### [INFO] ScopeListPanel 검색 폼 제출·입력 변경 미검증
- 위치: `scope-list-panel.test.tsx`
- 상세: `onSearchInputChange`와 `onSubmitSearch` 콜백이 baseProps에 정의됐으나, 검색어 입력 변경(`fireEvent.change`) 또는 폼 제출(`fireEvent.submit`) 시 각 콜백이 호출되는 케이스가 없다. 검색 기능의 회귀 보호가 없다.
- 제안: 검색 input에 `fireEvent.change` 후 `onSearchInputChange` 호출 확인, 폼 submit 시 `onSubmitSearch` 호출 확인 케이스 추가.

### [INFO] ScopeListPanel — 텍스트 기반 scope 클릭 locator 취약성
- 위치: `scope-list-panel.test.tsx` L65~69
- 상세: `fireEvent.click(screen.getByText("cust-1"))`으로 scope 선택을 검증하는데, "cust-1"이 scope 행 뿐 아니라 count 배지나 다른 UI 요소에도 출력되면 `getByText`가 여러 매치로 실패한다. 현재는 단일 scope 데이터라 문제없으나, 컴포넌트 렌더 구조 변경 시 깨질 수 있다.
- 제안: `getByRole('button', { name: 'cust-1' })` 또는 `getByTestId`를 사용하거나, scope 행에 `aria-label` 추가 후 role 기반 locator로 변경.

### [INFO] `agentMemoriesApi.remove` — 테스트 부재
- 위치: `agent-memories.test.ts`
- 상세: `agentMemoriesApi.remove(id)` 함수(`DELETE /agent-memories/:id`)에 대한 테스트가 없다. `clearScope`와 `listScopes`/`listMemories`는 커버됐으나 `remove`는 누락. 단건 삭제 경로는 이번 변경에서 추가된 것은 아니나, 파일 내 다른 메서드들이 이번에 테스트 추가됐으므로 일관성 측면에서 언급.
- 제안: `deleteMock.mockResolvedValue(fakeAxios(undefined))`로 `remove("mem-1")` 호출 후 `/agent-memories/mem-1` DELETE 요청 확인 케이스 추가.

## 요약

이번 변경에서 추가된 테스트(W8·W9·W10·W11)는 전반적으로 구조가 탄탄하다. 백엔드 `AgentMemoryAdminService` 서비스 spec은 listScopes·listMemories·deleteMemory·clearScope 주요 계약을 모두 커버하며, 프론트엔드 패널 컴포넌트는 Container/Presenter 패턴 덕분에 의존성 없이 순수 props 기반 단위 테스트가 가능하다. `baseProps()` 팩토리 패턴, `beforeEach` 초기화, vitest의 모듈 mock hoisting 사용도 적절하다. 그러나 두 가지 중요 갭이 존재한다: (1) `isError` UI 분기가 양쪽 패널 모두 미검증이고, (2) 이번 변경의 핵심 기능 수정인 CORS `exposedHeaders` 설정이 단위 수준에서 고정되지 않아 향후 회귀 위험이 있다. `listMemories` kind 미지정 파라미터 경로 누락, 콜백 미검증(kindFilter·검색)은 INFO 수준이다.

## 위험도
LOW
