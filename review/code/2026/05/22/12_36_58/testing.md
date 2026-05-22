# 테스트(Testing) 리뷰

## 발견사항

### [WARNING] `TriggerDeleteDialog` — 404 동시 삭제 경로 테스트 미구현
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/triggers-edit-delete-suite-a1548c/codebase/frontend/src/components/triggers/__tests__/trigger-delete-dialog.test.tsx`
- 상세: 커밋 메시지와 plan 문서에 "DELETE API 호출 4 시나리오"라고 명시되어 있으나, 실제 테스트 파일에는 4개 케이스 중 2개만 구현되어 있다. 구체적으로 ① 404 동시 삭제 시 `toastMessage` 호출 + `invalidateQueries` 경로, ② 일반 에러(5xx 등)에서 `toastError` 호출 경로가 누락되어 있다. `trigger-delete-dialog.tsx` 의 `onError` 핸들러에는 두 분기(404 silent invalidate / 그 외 `deleteFailed` toast)가 모두 존재하지만 테스트로 검증되지 않는다.
- 제안:
  ```
  it("404 응답 시 silent invalidate + notFoundOnDelete toast", async () => {
    apiDeleteMock.mockRejectedValueOnce({ response: { status: 404 } });
    // ... 이름 입력 후 클릭
    await act(async () => { /* flush */ });
    expect(toastMessage).toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });

  it("서버 오류 시 deleteFailed toast", async () => {
    apiDeleteMock.mockRejectedValueOnce({ response: { status: 500 } });
    // ... 이름 입력 후 클릭
    await act(async () => { /* flush */ });
    expect(toastError).toHaveBeenCalled();
  });
  ```

---

### [WARNING] `trigger-delete-dialog.test.tsx` — 삭제 성공 토스트(toastSuccess) 검증 누락
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/triggers-edit-delete-suite-a1548c/codebase/frontend/src/components/triggers/__tests__/trigger-delete-dialog.test.tsx` 92번째 줄
- 상세: "삭제 성공" 케이스가 `apiDeleteMock` 호출 여부만 검증하고, `toastSuccess` 호출 여부와 `onClose` 콜백 호출 여부를 검증하지 않는다. 이 두 가지는 `onSuccess` 내에 명시된 사이드 이펙트임에도 회귀 보호가 없다.
- 제안: `toastSuccess` mock 의 `toHaveBeenCalled()` 단언과 `onClose` spy 를 `renderDialog` 에 주입하여 호출 여부를 추가로 검증한다.

---

### [WARNING] 비동기 플러시 패턴 — `Promise.resolve()` 2회 반복 대신 `act` 사용 권장
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/triggers-edit-delete-suite-a1548c/codebase/frontend/src/components/triggers/__tests__/trigger-delete-dialog.test.tsx` 99-101번째 줄
- 상세: React Query의 mutation 비동기 흐름을 `await Promise.resolve()` 2번으로 드레인하는 패턴은 마이크로태스크 큐 깊이에 의존적이다. mutation 내부 구현이 바뀌거나 React 버전이 올라가면 불충분할 수 있다. RTL의 `act(async () => {})` 또는 `waitFor`를 사용하는 것이 안정적이다.
- 제안:
  ```ts
  fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
  await waitFor(() => {
    expect(apiDeleteMock).toHaveBeenCalledWith("/triggers/tr-1");
  });
  ```

---

### [WARNING] `triggers-page.test.tsx` — viewer 역할에서 삭제/토글 메뉴 항목 비노출 검증 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/triggers-edit-delete-suite-a1548c/codebase/frontend/src/app/(main)/triggers/__tests__/triggers-page.test.tsx` 477-489번째 줄
- 상세: viewer 케이스 테스트는 "⋮ 메뉴 버튼 자체가 보임"만 검증한다. viewer 가 메뉴를 열었을 때 "Delete"·"Activate/Deactivate" 항목이 실제로 숨겨지는지(즉 `canEdit` 가드가 동작하는지)는 검증하지 않는다. spec §2.1 의 수용 기준 "viewer 역할은 삭제 항목이 노출되지 않는다"가 테스트로 보호받지 못한다.
- 제안: viewer 케이스에서 메뉴 버튼을 클릭(userEvent.click)하고, `queryByText(/delete/i)`와 `queryByText(/activate/i)` 가 `toBeNull()`임을 추가 단언한다.

---

### [WARNING] `manual` 타입 본문 분기 테스트 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/triggers-edit-delete-suite-a1548c/codebase/frontend/src/components/triggers/__tests__/trigger-delete-dialog.test.tsx`
- 상세: `trigger-delete-dialog.tsx` 의 `confirmBody` 분기에는 `webhook`, `schedule`, `manual` 3 가지 경로가 있다. 테스트는 webhook과 schedule만 커버하며 manual 타입 본문 텍스트(workflowName 포함 여부) 검증이 없다. 커밋 메시지에 "type 별 본문 4 시나리오"라고 기재되어 있어 누락이 더욱 명확하다.
- 제안:
  ```ts
  it("manual 타입 본문 텍스트가 workflowName 을 포함한다", () => {
    renderDialog({
      id: "tr-3", name: "manual-entry", type: "manual",
      workflowName: "Approval WF",
    });
    expect(screen.getByText(/Approval WF/)).toBeInTheDocument();
  });
  ```

---

### [INFO] `dropdown-menu.tsx` 컴포넌트에 대한 단위 테스트 미존재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/triggers-edit-delete-suite-a1548c/codebase/frontend/src/components/ui/dropdown-menu.tsx`
- 상세: 신규로 추가된 `DropdownMenu` UI 프리미티브에 대해 `components/ui/__tests__/` 디렉토리에 테스트 파일이 없다. 기존 `button.test.tsx`, `badge.test.tsx` 등과 일관성이 떨어진다. 단, Radix UI 래퍼 성격이 강하고 스타일 조합 로직만 담고 있어 필수는 아니다.
- 제안: `variant="destructive"` 클래스 적용 여부, `inset` prop 에 따른 padding 클래스 확인 정도를 smoke 테스트로 추가하면 향후 스타일 회귀를 잡을 수 있다.

---

### [INFO] `renderDialog`의 `onClose` — 스파이가 아닌 no-op 콜백 사용
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/triggers-edit-delete-suite-a1548c/codebase/frontend/src/components/triggers/__tests__/trigger-delete-dialog.test.tsx` 37번째 줄
- 상세: `onClose={() => {}}` 로 고정되어 있어 onClose 호출 횟수·시점 단언이 불가능하다. 격리된 테스트 환경에서는 큰 문제가 없지만, 성공/실패 경로 모두 `onClose`가 올바르게 호출되는지를 검증하려면 `vi.fn()`으로 교체해야 한다.
- 제안: `renderDialog` 함수에 optional `onClose?: () => void` 파라미터를 추가하거나, 각 케이스에서 spy 를 직접 생성·전달한다.

---

### [INFO] schedule 케이스 — `nextRunAt` 값이 `formatDate` 를 거쳐 표시되는 실제 포맷 미검증
- 위치: `/Volumes/project/private/clemvion/.claire/worktrees/triggers-edit-delete-suite-a1548c/codebase/frontend/src/components/triggers/__tests__/trigger-delete-dialog.test.tsx` 65-77번째 줄
- 상세: schedule 케이스는 cron 문자열의 존재만 검증하고, `nextRunAt` ISO 문자열이 `formatDate` 유틸을 통해 사람이 읽을 수 있는 형태로 렌더링되는지는 확인하지 않는다. `formatDate` 가 빈 값을 반환하거나 오류를 던지더라도 현재 테스트로는 잡히지 않는다.
- 제안: `nextRunAt` 값의 렌더링 결과(예: 날짜 포함 텍스트 매처)를 검증하는 단언을 추가한다.

---

## 요약

이번 변경은 spec 에 정의된 핵심 사용자 흐름(이름 입력 confirm gate, 타입별 본문 분기, RBAC 가드)을 테스트로 잘 보호하고 있다. `trigger-delete-dialog.test.tsx` 를 신규 추가한 점, RBAC 케이스를 새 UI 패턴에 맞게 갱신한 점은 긍정적이다. 그러나 커밋 메시지에 "4 시나리오"라고 명시했음에도 404 동시 삭제 경로와 일반 에러 경로가 실제로 구현되지 않았고, `manual` 타입 분기 테스트도 누락되어 있다. 또한 viewer 가 메뉴를 열었을 때 삭제·토글 항목의 부재 자체를 직접 검증하지 않아 `canEdit` 가드 회귀를 잡기 어렵다. 비동기 플러시 패턴도 불안정한 관용구를 사용하고 있다. 전반적으로 핵심 happy path 는 커버되지만 에러 경로·경계 분기에 공백이 있다.

## 위험도

MEDIUM
