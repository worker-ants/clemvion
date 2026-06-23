# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [WARNING] useAppearanceDraft — 렌더 중 이중 setState 호출
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/frontend/src/components/web-chat/use-appearance-draft.ts` 라인 22-25
- 상세: `loadedId !== instanceId` 분기에서 `setLoadedId`와 `setDraftState`를 동일 렌더 중에 동시 호출한다. React 권장 "storing information from previous renders" 패턴을 의도했으나, 이 패턴은 상태 변수를 하나만 업데이트하고 즉시 `return`해야 한다. 두 `setState` 호출이 연속으로 일어나면 React Concurrent Mode에서 해당 렌더가 두 번 커밋될 수 있고, `setDraftState`가 호출된 후에도 현재 렌더에서 오래된 `draft` 값이 소비자에게 한 프레임 노출된다. 또한 `WebChatDetail`에 이미 `key={selected.id}`가 있어 인스턴스 전환 시 리마운트가 보장되므로, 이 패턴 자체가 불필요한 복잡도를 추가한다.
- 제안: `WebChatDetail key={selected.id}` 리마운트로 이미 충분하므로 `loadedId` 상태와 렌더-중 이중 setState 분기를 제거한다. 제거 불가라면 React 공식 예시처럼 분기 내 상태 업데이트를 하나로 합쳐 `return`하고, 외부 `draft` 초기화는 `useState` lazy init만 사용한다.

### [WARNING] useCreateWebChat — 클라이언트 측 UUID 생성이 endpointPath 충돌 위험 내포
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/frontend/src/components/web-chat/use-web-chat.ts` 라인 2263
- 상세: `endpointPath: crypto.randomUUID()`를 클라이언트가 생성해 POST body에 담는다. 서버가 이 값을 그대로 수락하면 다른 사용자가 같은 UUID를 의도적으로 보내 기존 인스턴스의 경로를 점유하는 충돌을 만들 수 있다. 또한 재시도(네트워크 실패)시 매번 다른 UUID가 생성돼 중복 트리거가 DB에 쌓일 수 있다.
- 제안: `endpointPath`는 서버가 생성하도록 이동하거나, 요청 성공 전까지 UUID를 고정(ref에 저장)한다.

### [WARNING] useWebChatInstances — 전역 react-query 캐시 키 충돌 가능성
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/frontend/src/components/web-chat/use-web-chat.ts` 라인 2207
- 상세: `WEB_CHAT_INSTANCES_KEY = ["web-chat-instances"]`는 기존 triggers 관련 쿼리 키(`["triggers", ...]`)와 분리되어 있어 직접 충돌은 없다. 그러나 `useCreateWebChat` onSuccess에서 `WEB_CHAT_INSTANCES_KEY`만 무효화하고 기존 triggers 목록 쿼리(`["triggers"]`)는 무효화하지 않는다. 따라서 트리거 관리 화면이 별도로 열려 있으면 신규 생성된 webhook이 즉시 반영되지 않아 두 뷰 간 상태 불일치가 발생한다.
- 제안: onSuccess에서 `["triggers"]` 프리픽스 키도 함께 무효화하거나, 단일 트리거 쿼리 키 체계를 재사용한다.

### [WARNING] useAppearanceDraft — localStorage 쓰기가 setState 업데이터 함수 내부에서 발생 (부작용 위치)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/frontend/src/components/web-chat/use-appearance-draft.ts` 라인 2029-2038
- 상세: `setDraftState((prev) => { ... localStorage.setItem(...); return next; })` 형태로 순수해야 할 업데이터 함수 안에서 localStorage 쓰기(부작용)를 수행한다. React는 StrictMode와 Concurrent Mode에서 업데이터 함수를 여러 번 실행할 수 있어, 단일 사용자 조작에 localStorage를 두 번 쓸 수 있다. 기능 자체는 동작하지만 React 순수성 계약을 위반한다.
- 제안: localStorage 쓰기를 `useEffect`로 이동하거나, setState 직후에 직접 호출하도록 분리한다 (`setDraftState(next); localStorage.setItem(...)` 형태).

### [INFO] sidebar.tsx — navItems 모듈 레벨 상수에 새 항목 추가
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/frontend/src/components/layout/sidebar.tsx` 라인 766
- 상세: `navItems`는 `as const satisfies` 타입 단언 배열이다. 새 항목 추가는 모든 사이드바 렌더링에 즉시 적용되는 공유 상태 변경이다. `"sidebar.webChat"` 번역 키가 ko/en 모두 추가되어 있어 런타임 누락은 없다. 의도된 변경이며 부작용 없음.
- 제안: 해당 없음.

### [INFO] useWorkflowOptions — 기존 ["workflows", "options"] 키와 workflows 목록 페이지 쿼리 키 분리 여부 확인 필요
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/frontend/src/components/web-chat/use-web-chat.ts` 라인 2241-2249
- 상세: `queryKey: ["workflows", "options"]`는 기존 workflows 목록 훅이 사용하는 키(`["workflows", "list"]` 등)와 다를 가능성이 높다. 이 경우 동일 API를 두 번 호출하는 캐시 중복이 발생할 수 있다. 기존 workflows 쿼리 키를 확인하지 못했으나, 의도치 않은 이중 네트워크 호출 가능성을 내포한다.
- 제안: 기존 workflow 목록 쿼리 키를 재사용하거나 공유 훅으로 추출한다.

### [INFO] CreateWebChatDialog — 성공 후 토스트 → onOpenChange(false) → setState 순서
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/frontend/src/components/web-chat/create-web-chat-dialog.tsx` 라인 1391-1397
- 상세: `onOpenChange(false)` 호출 후 `setWorkflowId("")`, `setName("")`을 호출한다. 다이얼로그가 언마운트되기 전(애니메이션 구간)에 state 업데이트가 일어나므로 일반적으로는 무해하다. 그러나 다이얼로그 컴포넌트가 controlled open으로 unmount되는 구현이라면 `setState`가 unmounted 컴포넌트에 호출될 수 있다 (React 18에서는 경고 제거됨, 누수 없음). 실질적 부작용 없음.
- 제안: 해당 없음.

### [INFO] 환경 변수 읽기 — NEXT_PUBLIC_WIDGET_CDN_BASE
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/frontend/src/lib/web-chat/widget-base.ts` (테스트에서 확인)
- 상세: `widget-base` 모듈이 `NEXT_PUBLIC_WIDGET_CDN_BASE` 환경 변수를 읽는다. 미설정 시 `window.location.origin`을 기본으로 사용한다. 환경 변수의 쓰기는 없으며, 읽기만 수행한다. SSR 컨텍스트에서는 `window`가 없어 `isWidgetHostingConfigured()`가 false를 반환하는 의도적 동작이다. 부작용 없음.
- 제안: 해당 없음.

---

## 요약

전체적으로 신규 파일 추가 위주의 변경이라 기존 코드에 대한 의도치 않은 부작용은 제한적이다. 주목할 부작용 위험은 두 가지다. 첫째, `useAppearanceDraft`에서 React 업데이터 함수 내 localStorage 쓰기(Concurrent Mode에서 이중 실행 가능)와 렌더 중 이중 setState(이미 `key` 리마운트로 커버되어 있어 불필요한 패턴)다. 둘째, `useCreateWebChat`에서 클라이언트 생성 UUID를 endpointPath로 사용해 재시도 시 중복 생성 가능성이 있다. 또한 트리거 생성 후 기존 triggers 쿼리 캐시를 무효화하지 않아 다른 트리거 관리 화면과 상태 불일치가 발생할 수 있다. i18n, 사이드바 navItems, 순수 함수 유틸리티(snippet/widget-base)는 부작용이 없다.

## 위험도

MEDIUM
