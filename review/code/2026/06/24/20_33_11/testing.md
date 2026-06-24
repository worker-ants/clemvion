# Testing Review — web-chat 콘솔 관리 기능 통합

## 발견사항

### **[INFO]** `useUpdateWebChatMeta` 실패 경로 테스트 누락
- 위치: `/codebase/frontend/src/components/web-chat/__tests__/use-web-chat.test.ts` — `useUpdateWebChatMeta` describe 블록
- 상세: `useUpdateWebChatAppearance` describe 에는 "PATCH 실패 시 mutation 이 reject 된다" 케이스가 존재하지만, `useUpdateWebChatMeta` describe 에는 동일한 reject 경로 케이스가 없다. 두 훅은 대칭 구조이므로 실패 경로도 대칭 검증이 바람직하다.
- 제안: `useUpdateWebChatMeta` describe 에 `patchMock.mockRejectedValue(new Error("fail"))` 케이스를 추가해 mutation reject 전파를 확인한다.

### **[INFO]** `toggleActive` 함수의 직접 단위 테스트 부재
- 위치: `/codebase/frontend/src/app/(main)/web-chat/page.tsx` — `WebChatDetail.toggleActive`
- 상세: `toggleActive`는 `page.tsx` 내부의 함수로, `useUpdateWebChatMeta` mock + toast 동작을 통합 렌더 없이 검증하는 케이스가 없다. 현재 테스트 스위트는 훅 레이어(`use-web-chat.test.ts`)와 다이얼로그 레이어(`web-chat-rename-dialog.test.tsx`, `trigger-delete-dialog.test.tsx`)를 커버하지만, `page.tsx`의 `toggleActive` 성공·실패 분기(toast 메시지 선택 로직)는 미검증이다.
- 제안: `WebChatDetail`의 toggle 흐름을 포함하는 통합 렌더 테스트를 `web-chat-page.test.tsx`로 추가하거나, `toggleActive`를 독립 유틸/훅으로 분리해 단위 테스트 용이성을 높인다. 단, 이 부분은 기존 훅 테스트로 핵심 PATCH 로직이 커버되므로 우선순위는 낮다.

### **[INFO]** `beforeunload` useEffect 테스트 부재
- 위치: `/codebase/frontend/src/app/(main)/web-chat/page.tsx` — `WebChatDetail` useEffect (isDirty 조건)
- 상세: `isDirty` 상태에서 `window.addEventListener("beforeunload", ...)` 등록, `!isDirty` 시 조기 반환·cleanup 경로가 테스트로 검증되지 않는다. JSDOM 환경에서 `beforeunload` 이벤트 리스너 등록/해제 여부를 직접 spy로 확인하는 케이스가 없다.
- 제안: `window.addEventListener` spy를 이용해 isDirty=true 시 핸들러 등록, isDirty=false 복원 시 핸들러 제거를 확인하는 테스트를 추가한다. 이 케이스는 회귀 방지 가치가 있다.

### **[INFO]** `needsOnboarding` 분기 렌더 테스트 부재
- 위치: `/codebase/frontend/src/app/(main)/web-chat/page.tsx` — `WebChatDetail`, `needsOnboarding = !instance.appearance`
- 상세: `instance.appearance`가 undefined인 경우 온보딩 배너가 렌더되는지, 값이 있는 경우 사라지는지를 검증하는 테스트가 없다. 간단한 조건 분기이지만 현재 전혀 커버되지 않는다.
- 제안: `WebChatDetail` 렌더 테스트에서 `appearance=undefined` / `appearance={...}` 두 케이스를 검증한다.

### **[INFO]** 목록 행 `lastTriggeredAt` 표시 분기 테스트 부재
- 위치: `/codebase/frontend/src/app/(main)/web-chat/page.tsx` — `WebChatPage` nav 목록 행
- 상세: `inst.lastTriggeredAt`이 있을 때 `timeAgo` 결과를 포함한 문자열 렌더, undefined 시 `neverTriggered` 키 문자열 렌더 분기를 검증하는 테스트가 없다.
- 제안: `WebChatPage` 렌더 테스트에서 두 분기를 확인한다. `timeAgo` 자체는 별도 유틸 테스트에서 커버되어야 하며, 여기서는 조건 분기 렌더 여부만 확인하면 충분하다.

### **[INFO]** `WebChatRenameDialog` — Enter 키 submit 경로 미검증
- 위치: `/codebase/frontend/src/components/web-chat/__tests__/web-chat-rename-dialog.test.tsx`
- 상세: `web-chat-rename-dialog.tsx`는 `onKeyDown` 핸들러에서 Enter 키로 submit을 트리거하지만, 테스트에서는 버튼 클릭 경로만 검증한다. Enter 키 동작이 실제로 submit을 호출하는지 미검증이다.
- 제안: `fireEvent.keyDown(nameInput(), { key: "Enter" })`로 Enter submit 경로를 추가한다.

### **[INFO]** `TriggerDeleteDialog` — `onDeleted`와 `onClose` 호출 순서 검증 없음
- 위치: `/codebase/frontend/src/components/triggers/__tests__/trigger-delete-dialog.test.tsx`
- 상세: 삭제 성공 시 `onDeleted?.()` → `toast.success` → `onClose()` 순서로 호출되지만, 기존 테스트는 각각 호출 여부만 확인하고 순서를 검증하지 않는다. 웹채팅 콘솔에서 `onDeleted` 내에서 queryClient invalidation + 선택 리셋이 수행되는 만큼, `onClose` 이전에 `onDeleted`가 호출됨을 보장하는 것이 방어적으로 유용하다.
- 제안: vitest의 mock call order 또는 `vi.fn()` + `mockImplementation`으로 순서를 명시적으로 확인한다. 단, 이는 구현 세부사항 과잉 결합 우려가 있으므로 필수는 아니다.

### **[INFO]** 인스턴스 0개 → 삭제 후 empty state 전환 통합 테스트 부재
- 위치: `page.tsx` — `onDeleted(() => setSelectedId(null))` 후 instances가 비어 empty state 렌더 전환
- 상세: 목록에 인스턴스가 1개 남은 상태에서 삭제가 완료되면 `selectedId=null` + 캐시 무효화로 EmptyState가 노출되어야 한다. 이 플로우를 검증하는 통합 테스트가 없다.
- 제안: `WebChatPage` 통합 테스트에서 1개 인스턴스 → 삭제 완료 → EmptyState 노출 흐름을 확인한다.

## 요약

핵심 신규 로직(useUpdateWebChatMeta PATCH 바디 구성·캐시 무효화, WebChatRenameDialog 상태 관리·no-op 가드, TriggerDeleteDialog onDeleted 콜백 분기)은 각각 독립된 단위 테스트로 잘 커버된다. `vi.hoisted` + module mock + QueryClient per-test 패턴으로 테스트 격리도 적절히 확보되었으며, `beforeEach` cleanup으로 잔류 DOM을 방지한다. 다만 `page.tsx`(`WebChatDetail`)에 집중된 `toggleActive`, `beforeunload` 핸들러, `needsOnboarding` 분기, 목록 행 lastTriggeredAt 분기는 렌더 단위 테스트가 전무해 회귀 안전망이 없다. `useUpdateWebChatMeta` 실패 경로도 대칭 훅(`useUpdateWebChatAppearance`) 대비 누락이다. 이들 갭은 즉각적인 버그 위험보다는 미래 회귀 시 발견 비용을 높이는 수준이므로 전반적 위험도는 낮다.

## 위험도

LOW
