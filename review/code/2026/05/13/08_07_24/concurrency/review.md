### 발견사항

- **[WARNING]** diff 다이얼로그 오픈 중 폼 상태 변경 → API payload 불일치 가능성
  - 위치: `profile-info-card.tsx` (onConfirm 클로저, `name` 캡처) / `profile-preferences-card.tsx` (onConfirm 클로저, `patchPayload` 캡처)
  - 상세: `ConfirmDiffDialog` 가 열려있는 동안(`showDiff=true`) 부모 컴포넌트는 여전히 `mode="edit"` 상태다. `<Input>` 이 DOM 에 남아있고 다이얼로그는 `position:fixed` 오버레이이므로 포커스를 강제로 이동하면 뒤에 있는 `input` 에 여전히 타이핑이 가능하다. 이때 `name` / `tempTheme` / `tempLocale` state 가 변경되면 다이얼로그에 표시된 diff("이전 → 새") 와 실제 `mutation.mutateAsync` 에 넘어가는 값이 달라진다. `onConfirm` 클로저는 React re-render 마다 교체되므로 클로저 내 값은 최신이지만, 사용자가 확인한 diff 표시값은 이미 구형이다.
  - 제안: `showDiff(true)` 진입 시점에 `name` / `patchPayload` 를 별도 `confirmedPayload` 변수(또는 ref)에 스냅샷으로 저장하고 `onConfirm` 은 해당 스냅샷만 사용하도록 변경. 또는 `showDiff` 가 true 일 때 뒤의 폼 입력을 `disabled` 처리.

  ```tsx
  // profile-info-card.tsx — 수정 예시
  const confirmedNameRef = useRef<string>("");
  function handleSaveClick() {
    if (!dirty) { ... }
    confirmedNameRef.current = name;   // diff 표시와 API 페이로드 고정
    setShowDiff(true);
  }
  // onConfirm:
  onConfirm={async () => {
    await mutation.mutateAsync({ name: confirmedNameRef.current });
  }}
  ```

- **[INFO]** `change-password/page.tsx` — 성공 후 navigate 중 `setIsPending(false)` 호출
  - 위치: `change-password/page.tsx:75` (`finally { setIsPending(false) }`)
  - 상세: `router.push("/profile")` 호출 후 Next.js 페이지 전환이 진행 중인 시점에 `finally` 블록이 `setIsPending(false)` 를 호출한다. React 18 에서는 마운트 해제 중 setState 경고가 제거되었으므로 런타임 오류는 없으나, 엄밀히는 "이미 이동 중인 컴포넌트"에 상태를 쓰는 코드다. 실질적 영향은 없음.
  - 제안: `router.push` 이전에 `setIsPending(false)` 를 이동하거나, `AbortController` / unmount flag 패턴을 도입해 명시적으로 처리. 현 수준에서는 허용 가능.

- **[INFO]** `ConfirmDiffDialog` — `isPending` 해제 시점
  - 위치: `confirm-diff-dialog.tsx:38` (`finally { setPending(false) }`)
  - 상세: `onConfirm` (즉, `mutation.mutateAsync`) 성공 시 부모의 `onSuccess` 콜백에서 `setShowDiff(false)` → `setMode("view")` 가 먼저 실행되고, 이후 `finally` 블록이 `setPending(false)` 를 호출한다. 다이얼로그는 `!open` 이면 `return null` 로 처리되므로 컴포넌트는 트리에 존재하되 렌더 출력만 없는 상태다. React 는 이를 정상 처리하지만, 개념상 이미 닫힌 다이얼로그에 상태를 쓰는 것이므로 스타일 상 주의.
  - 제안: 현 구조에서는 허용 가능. 개선이 필요하다면 `useEffect` cleanup 에서 resolve pending promise 를 처리하는 방법이 있으나 오버엔지니어링 수준.

---

### 요약

이 변경 셋의 핵심 동시성 패턴(비동기 폼 제출 중 버튼 비활성화, TanStack Query `isPending` 가드, diff 다이얼로그 열림 중 취소 차단)은 모두 올바르게 구현되어 있다. 실질적 위험은 diff 다이얼로그가 열려 있는 동안 뒤에서 폼 값이 변경될 경우 확인 화면과 실제 API 페이로드 사이의 불일치가 발생할 수 있다는 점이며, 이는 모달 포커스 트랩이 완전하지 않은 접근성 구현 환경에서 재현 가능하다. 나머지 항목은 React 18 모델 안에서 안전하게 동작한다.

### 위험도

**LOW**