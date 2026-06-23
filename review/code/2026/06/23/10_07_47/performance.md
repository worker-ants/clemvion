# 성능(Performance) 리뷰 결과

## 발견사항

### 발견사항 1
- **[INFO]** `useWebChatInstances` — 클라이언트 측 중복 필터링 (type === "webhook")
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/frontend/src/components/web-chat/use-web-chat.ts` 라인 224
  - 상세: `useQuery`의 `queryFn` 내에서 이미 `{ params: { type: "webhook", limit: 100 } }`로 서버에 `type=webhook` 필터를 보내고 있다. 그럼에도 `useMemo`의 `filter`에서 `t.type === "webhook"`를 다시 검사한다. 이 조건은 항상 참이므로 불필요한 연산이다.
  - 제안: `filter` 조건에서 `t.type === "webhook"` 제거. `t.config?.interaction?.enabled` 체크만 유지.

### 발견사항 2
- **[INFO]** `useWebChatInstances` — `limit: 100` 하드코딩, 페이지네이션 부재
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/frontend/src/components/web-chat/use-web-chat.ts` 라인 214
  - 상세: 현재 규모(운영 콘솔)에서는 100건 제한이 충분하나, 대량 트리거 환경에서 전량 적재 후 클라이언트 필터링하는 패턴은 메모리 및 네트워크 비용 면에서 비효율적이다. 서버에 `interaction.enabled=true` 파라미터를 추가해 적재량을 최소화할 수 있다면 더 효율적이다. 현재 백엔드 API가 그 필터를 지원하지 않으면 중기 개선 사항으로 등록 필요.
  - 제안: 백엔드가 `interaction.enabled` 서버 필터를 지원하면 이를 활용해 전송량을 줄인다. 지원 전까지는 현행 유지 (INFO 수준).

### 발견사항 3
- **[INFO]** `useAppearanceDraft` — 렌더 중 동기 `localStorage.getItem` 호출
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/frontend/src/components/web-chat/use-appearance-draft.ts` 라인 2022-2025
  - 상세: 인스턴스 전환(`loadedId !== instanceId`) 감지 시 `readDraft(instanceId)`를 렌더 중 직접 호출하고, 그 안에서 `localStorage.getItem`이 실행된다. 이는 렌더 사이클 내 동기 I/O다. 단건 `getItem`은 수 마이크로초 수준이라 실제 병목이 되기 어렵지만, React Concurrent Mode의 렌더 재시도 시 같은 I/O가 여러 번 반복될 수 있다. 초기 마운트는 `useState` lazy initializer로 처리되어 1회 실행이 보장되므로 괜찮다.
  - 제안: 현재 구조에서 크리티컬하지 않음. 증분 2에서 인스턴스 전환 빈도가 높아지거나 상태가 무거워지면 `key` prop 리마운트 전략 또는 `useTransition`으로 전환을 고려한다.

### 발견사항 4
- **[INFO]** `InstallSnippetBox` — `useMemo` 의존성에 `draft` 객체 전체 포함 (참조 동일성)
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/frontend/src/components/web-chat/install-snippet-box.tsx` 라인 1631-1701
  - 상세: `useMemo`의 deps가 `[draft, endpointPath]`이며, `draft`는 `useAppearanceDraft`의 `setDraftState`가 항상 새 객체(`{ ...prev, ...patch }`)를 반환하므로 필드 값이 바뀔 때마다 참조가 달라진다. 이 점에서 `useMemo`의 재계산 타이밍은 적절하다. `buildWebChatSnippet`은 문자열을 생성하는 가벼운 순수 함수이므로 현행 설계는 문제 없다.
  - 제안: 현행 유지. 단, 증분 2에서 `draft` 필드가 많아지고 snippet 생성 비용이 커지면 개별 필드 deps로 세분화를 고려.

### 발견사항 5
- **[INFO]** `buildWebChatSnippet` — `JSON.stringify(boot, null, 2)` 가독성 포맷 사용
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/frontend/src/lib/web-chat/snippet.ts` 라인 3807
  - 상세: 설치 스니펫은 운영자가 복사해서 HTML에 붙여 넣는 정적 문자열이므로 가독성 있는 `null, 2` 포맷은 의도적 선택이다. 다만 필드 수가 늘어나면 스니펫 크기가 증가하고, 방문자 브라우저가 이를 파싱하는 비용이 소폭 상승한다. 현재 필드 수(최대 ~8개)에서는 무시할 수준이다.
  - 제안: 현행 유지 (운영자 UX 우선). 프로덕션 최적화 단계에서 minify 옵션 추가를 고려 가능.

### 발견사항 6
- **[INFO]** `createWrapper()` — 테스트마다 새 `QueryClient` 생성
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/frontend/src/app/(main)/web-chat/__tests__/web-chat-page.test.tsx` 라인 116-123
  - 상세: `renderPage()` 호출 시마다 `createWrapper()`가 신규 `QueryClient`를 생성한다. 테스트 격리 목적으로 올바른 패턴이나, `beforeEach`에서 동일한 `cleanup()`과 조합 시 테스트가 빠르게 마운트·언마운트를 반복한다. 테스트 환경에서는 성능 이슈가 아니다.
  - 제안: 현행 유지.

### 발견사항 7
- **[WARNING]** `useWorkflowOptions` — `CreateWebChatDialog` 마운트 시 항상 workflows API 호출
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/frontend/src/components/web-chat/create-web-chat-dialog.tsx` 라인 1380, `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/frontend/src/components/web-chat/use-web-chat.ts` 라인 2241-2249
  - 상세: `CreateWebChatDialog` 내 `useWorkflowOptions()`는 `enabled` 옵션 없이 항상 실행된다. Dialog가 닫힌 상태(`open=false`)에서도 컴포넌트가 DOM에 존재하면(`<Dialog>` Radix 구현에 따라) query가 발동할 수 있다. React Query의 `staleTime`이 지정되지 않아 기본값(0)이 적용되므로 Dialog를 열 때마다 workflows가 refetch된다. 현재 workflows 목록은 자주 바뀌지 않으므로 불필요한 네트워크 요청이 발생할 수 있다.
  - 제안: `useWorkflowOptions`에 `staleTime: 60_000` (또는 `enabled: open` prop 전달) 추가. `open` prop을 hook에 전달해 dialog가 열릴 때만 fetch 하는 방식도 유효하다.

### 발견사항 8
- **[INFO]** `WebChatPage` — 인스턴스 선택 시 `instances.find()` 를 매 렌더에 실행
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/frontend/src/app/(main)/web-chat/page.tsx` 라인 382
  - 상세: `const selected = instances.find((i) => i.id === selectedId) ?? instances[0] ?? null`은 `useMemo` 없이 매 렌더에 실행된다. `instances` 배열이 최대 100건(`limit: 100`) 중 interaction 활성 항목만 필터된 결과이므로 실제로는 수십 건 이내이고 O(n)이다. 운영 콘솔 규모에서는 문제없으나 리렌더가 잦은 경우(예: 색상 picker 입력)에는 `useMemo`로 감싸면 더 명확하다.
  - 제안: `useMemo(() => instances.find(...) ?? instances[0] ?? null, [instances, selectedId])`로 감싸 명시적 최적화 가능. 필수는 아님.

### 발견사항 9
- **[INFO]** `sidebar.tsx` — `currentWorkspace = workspaces.find(...)` 를 매 렌더에 실행
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/frontend/src/components/layout/sidebar.tsx` 라인 814
  - 상세: 이번 변경(`webChat` 메뉴 추가)과 직접 관련은 없으나, 사이드바 전체 리렌더 맥락에서 공유. `workspaces.find()`가 매 렌더에 실행되는 패턴은 기존 코드이므로 이번 변경의 범위 밖.
  - 제안: 해당 줄 리팩토링은 별도 이슈로 처리. 이번 변경에서는 성능 영향 없음.

---

## 요약

이번 변경은 프론트엔드 전용 운영 콘솔 기능(신규 백엔드 없음)으로, 전반적인 성능 설계는 양호하다. `InstallSnippetBox`의 `useMemo` 적용, `useAppearanceDraft`의 lazy initializer 패턴, React Query 캐시 활용은 모두 적절하다. 주목할 만한 약점은 `useWorkflowOptions`에 `staleTime`이 지정되지 않아 Dialog를 열 때마다 workflows가 refetch될 수 있는 점(WARNING)으로, `staleTime: 60_000` 추가로 쉽게 해소된다. 나머지 항목은 현행 운영 규모(수십 건 인스턴스)에서 실질적인 병목이 되지 않는 INFO 수준이다.

---

## 위험도

LOW
