# Testing 리뷰

## 발견사항

### [WARNING] MemoryListPanel 컴포넌트 테스트 부재
- 위치: `codebase/frontend/src/app/(main)/agent-memory/components/memory-list-panel.tsx` (신규 파일, 198줄)
- 상세: kind 필터 select, load more 버튼, 단건 삭제 버튼, 로딩/에러/빈 상태, expiresAt 조건부 렌더링, `kindBadgeClass` fallback 등 분기가 많은 UI 로직이 있으나 해당 컴포넌트를 직접 테스트하는 spec이 없다. `agent-memory-page.test.tsx`가 간접 커버하지만 그 테스트는 clearScope 토스트 분기에만 집중하므로 MemoryListPanel 내부 상태 분기는 대부분 미검증.
- 제안: `memory-list-panel.test.tsx` 신설. 최소: (1) selectedScope=null → placeholder 렌더, (2) isLoading=true → 스피너, (3) memories.length=0 → empty 메시지, (4) kind='unknown' → FALLBACK_KIND_CLASS 적용, (5) hasNextPage=true → load more 버튼, (6) onRequestDeleteMemory 콜백 호출 검증.

### [WARNING] ScopeListPanel 컴포넌트 테스트 부재
- 위치: `codebase/frontend/src/app/(main)/agent-memory/components/scope-list-panel.tsx` (신규 파일, 148줄)
- 상세: 검색 form submit, scope 선택 클릭(onSelectScope), clear 버튼(onRequestClearScope), 로딩/에러/빈 상태, isActive 강조 등 제어 흐름이 다양하나 단위 테스트 없음. 두 패널 모두 page.tsx에서 추출된 A1 SRP 리팩터링의 산출물이므로 컴포넌트 수준 테스트가 특히 중요하다.
- 제안: `scope-list-panel.test.tsx` 신설. 최소: (1) isLoading → 스피너, (2) scopes=[] → 빈 상태 + Link 렌더, (3) scope 클릭 → onSelectScope 호출, (4) 삭제 버튼 → onRequestClearScope 호출, (5) selectedScope 일치 시 active 클래스 적용.

### [WARNING] deletedRowCount 비-튜플(flat array) 분기 미검증
- 위치: `codebase/backend/src/modules/agent-memory/agent-memory-admin.service.ts` L340-343, 대응 테스트: `agent-memory-admin.service.spec.ts`
- 상세: `deletedRowCount`는 "방어적으로 비-튜플(rows 배열 직접) 형태도 허용한다"는 명시적 계약이 있으나, 모든 mock이 `[[{ id }], count]` 튜플 형태만 사용한다. flat array(예: `[{ id: 'a' }]`) 반환 시 `Array.isArray(result[0])` → false 분기의 `return (result as ...).length` 경로는 사실상 dead code 처럼 남아있다.
- 제안: `deleteMemory`나 `clearScope`에 flat array mock 케이스 1건 추가. 예: `mockDataSource.query.mockResolvedValue([{ id: 'a' }])` 후 `affected === 1` 검증.

### [WARNING] agentMemoriesApi listScopes/listMemories 단위 테스트 부재
- 위치: `codebase/frontend/src/lib/api/__tests__/agent-memories.test.ts` (신규, clearScope 전용)
- 상세: 신규 테스트 파일이 `clearScope`의 X-Deleted-Count 헤더 파싱만 커버하고, `listScopes`, `listMemories`, `remove`(deleteMemory)는 테스트하지 않는다. `listScopes`/`listMemories`는 `normalizePagedResponse`를 거치는 응답 정규화 계약이 있어, 향후 API shape 변경 시 회귀를 검출할 회귀 테스트가 없는 상태.
- 제안: 기존 파일을 확장하거나 별도 파일에 `listScopes`·`listMemories` happy-path 각 1건씩 추가. `normalizePagedResponse` 통과 후 `{ data, pagination }` 구조 검증.

### [INFO] listScopes whitespace-only q 엣지 케이스 미검증
- 위치: `agent-memory-admin.service.ts` L377: `const q = opts.q?.trim()`
- 상세: `q = '   '` (공백 only)는 trim 후 empty string이 되어 falsy → filterSql 미적용(전체 조회)이 된다. 이는 의도된 동작이지만 명시적 테스트가 없어 서비스 계약이 문서화되지 않은 상태. 특히 listScopes 테스트가 q의 유무만 검증하고 공백 경계를 다루지 않음.
- 제안: `listScopes` describe 안에 `q=' '` 입력 시 filterSql 미포함·파라미터 3개(ws+limit+offset)인지 검증하는 케이스 추가.

### [INFO] 프론트엔드 page 테스트 — deleteMemory 플로우·에러 경로 미검증
- 위치: `codebase/frontend/src/app/(main)/agent-memory/__tests__/agent-memory-page.test.tsx`
- 상세: page.tsx 테스트가 clearScope 토스트 분기(성공/0건)만 커버하고, deleteMemory 뮤테이션(단건 삭제 success/NotFoundException), clearScope onError 핸들러(`toast.error`), 검색 submit 후 q 파라미터 갱신 등은 미검증. 특히 `onError: () => toast.error(...)` 경로는 아무 테스트에도 없다.
- 제안: (우선순위 낮음) clearScope error 케이스 1건(`deleteMock.mockRejectedValue(new Error(...))` → `toast.error` 호출 검증) 추가 권장.

### [INFO] controller spec — mockRes 타입 안전성
- 위치: `codebase/backend/src/modules/agent-memory/agent-memory.controller.spec.ts` L573-575
- 상세: `mockRes()`가 `{ setHeader: jest.Mock }` 만 구현한다. 현재 구현이 `setHeader`만 호출하므로 기능적으로 문제없으나, `import type { Response } from 'express'`를 사용하면서 `as unknown as Response` 캐스팅하므로 TypeScript 타입 검증이 우회된다. 추후 clearScope가 `res.status` 등 추가 메서드를 사용해도 컴파일 에러 없이 런타임에서만 실패할 수 있다.
- 제안: `Partial<Response>`로 타입을 명시하거나 `jest.createMockFromModule('express').Response` 활용. 현재 기능에는 영향 없으나 계약 명확성 향상.

## 요약

전체적으로 테스트 품질이 높다. 핵심 신규 로직(AgentMemoryAdminService 4개 메서드, controller X-Deleted-Count 헤더, api 클라이언트 헤더 파싱, page 토스트 분기)에 대한 단위 테스트가 잘 작성되어 있고, 각 테스트가 SQL 파라미터 바인딩·윈도우 함수 구조·워크스페이스 격리까지 직접 검증하는 점이 우수하다. 주요 우려는 A1 SRP 리팩터링으로 추출된 두 프론트엔드 컴포넌트(`ScopeListPanel`, `MemoryListPanel`)에 독립 테스트가 없어 컴포넌트 경계에서의 동작 보장이 취약한 것이다. `deletedRowCount`의 방어 분기 미검증도 계약 문서화 관점에서 보완 필요하다.

## 위험도

MEDIUM
