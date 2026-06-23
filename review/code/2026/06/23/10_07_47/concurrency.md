# 동시성(Concurrency) 리뷰 결과

## 발견사항

### 발견사항 1
- **[WARNING]** `useAppearanceDraft` — 렌더 중 두 개의 `setState` 연속 호출로 인한 이중 렌더 가능성
  - 위치: `/codebase/frontend/src/components/web-chat/use-appearance-draft.ts` 라인 21-24
  - 상세: `loadedId !== instanceId` 분기 내에서 `setLoadedId`와 `setDraftState`를 동기적으로 연속 호출한다. React 18 Concurrent Mode에서는 렌더 함수 중간의 setState 호출이 "이전 렌더를 버리고 재시작"하는 bailout을 유발하며, 이 bailout은 두 setState가 각각 배치되지 않고 개별 렌더를 야기할 수 있다. 공식적으로 React는 "storing information from previous renders" 패턴에서 렌더 중 하나의 setState만 권장한다. 두 setState가 있으면 조건 재평가 중 loadedId가 갱신됐지만 draftState는 아직 갱신되지 않은 찰나의 불일치 프레임이 발생할 수 있다. 실제로 동시 렌더러가 이 컴포넌트를 여러 번 호출하는 상황에서는 `draft`가 이전 `instanceId`의 데이터를 일시적으로 반영할 수 있다.
  - 제안: 두 상태를 하나의 객체로 합치거나 `useReducer`로 원자적으로 갱신하라. 예:
    ```ts
    const [state, setState] = useState(() => ({ id: instanceId, draft: readDraft(instanceId) }));
    if (state.id !== instanceId) {
      setState({ id: instanceId, draft: readDraft(instanceId) });
    }
    const draft = state.draft;
    ```
    이렇게 하면 단일 setState 호출로 id와 draft가 동시에 교체되어 불일치 프레임이 없다.

### 발견사항 2
- **[INFO]** `useCreateWebChat` — `onSuccess` 내 `invalidateQueries` fire-and-forget
  - 위치: `/codebase/frontend/src/components/web-chat/use-web-chat.ts` 라인 267-269
  - 상세: `onSuccess: () => { void queryClient.invalidateQueries(...); }` 패턴은 invalidation 완료를 기다리지 않는다. TanStack Query에서 `onSuccess`가 Promise를 반환하면 해당 Promise 해소를 기다린 후 mutation 상태가 `success`로 전환된다. 현재는 `void`로 무시하므로 mutation이 success 상태가 됐을 때 캐시 재조회가 아직 진행 중일 수 있다. `CreateWebChatDialog.submit()`에서 `onCreated(id)`가 호출되는 시점에 `useWebChatInstances`의 데이터가 갱신 전일 수 있어 새 인스턴스가 목록에 바로 보이지 않는 짧은 시간이 있다. 이는 UX 이슈이며 데이터 정합성 문제는 아니다.
  - 제안: `onSuccess`에서 Promise를 반환하면 TanStack Query가 자동으로 대기한다: `onSuccess: () => queryClient.invalidateQueries({ queryKey: WEB_CHAT_INSTANCES_KEY })`. `void` 제거만으로 해결된다.

### 발견사항 3
- **[INFO]** `CreateWebChatDialog.submit` — mutation 완료 후 상태 리셋의 비원자성
  - 위치: `/codebase/frontend/src/components/web-chat/create-web-chat-dialog.tsx` 라인 1390-1396
  - 상세: `mutateAsync` 완료 후 `onOpenChange(false)`, `setWorkflowId("")`, `setName("")`, `onCreated?.(id)`가 순차 호출된다. 각각은 별도의 React 상태 배치이므로 실제로는 React 18의 automatic batching에 의해 단일 플러시로 처리된다. 동시성 문제는 없으나, Dialog가 닫히는 중(`onOpenChange(false)`) 폼 상태가 아직 리셋되기 전이라 dialog re-open 시 이전 값이 잠깐 보일 가능성이 이론적으로 존재한다. 실용적 위험도는 낮다.
  - 제안: 필요하다면 `onOpenChange(false)`를 호출하기 전에 폼 상태를 먼저 리셋하거나, dialog의 `onOpenChange` 핸들러에서 폼을 리셋하는 패턴을 사용한다.

## 요약

이번 변경은 프론트엔드 단일 스레드(브라우저 이벤트 루프) 위에서 동작하는 React/TanStack Query 기반 UI 코드로, 멀티스레드 경쟁 조건·데드락·뮤텍스 등의 고전적 동시성 문제는 해당하지 않는다. 주요 주의 사항은 `useAppearanceDraft`에서 렌더 중 두 개의 setState를 연속 호출하는 패턴으로, React Concurrent Mode의 bailout/재렌더 시 `instanceId`와 `draft`가 순간적으로 불일치할 수 있다. 이는 React 권장 패턴에서 "단일 setState로 atomically 교체"하도록 명시하는 이유이기도 하므로 개선이 권장된다. 그 외 `invalidateQueries` fire-and-forget과 폼 리셋 순서는 INFO 수준 개선 사항이다. async/await 누락은 없으며 이벤트 루프 블로킹 코드도 없다.

## 위험도
LOW

STATUS=success ISSUES=2
