# 테스트(Testing) 리뷰 — trigger-history-dialog (PR #265 follow-up)

## 발견사항

### [INFO] 테스트 파일 신규 생성 — 6개 케이스 커버
- 위치: `codebase/frontend/src/components/triggers/__tests__/trigger-history-dialog.test.tsx`
- 상세: 컴포넌트 신설에 맞춰 테스트 파일도 함께 신설되었다. 타이틀 보간, empty 상태, 정상 리스트, 엔드포인트·limit 검증, `onOpenFullDetail` 조건부 노출, 로딩 스피너 등 핵심 경로 6개를 모두 커버한다.
- 제안: 없음.

### [WARNING] 에러 상태(isError) 테스트 케이스 누락
- 위치: `trigger-history-dialog.test.tsx` 전체
- 상세: 컴포넌트 구현체(`trigger-history-dialog.tsx` L1283-1285)에는 `isError` 분기가 존재하고 `triggers.history.loadFailed` 메시지를 렌더링한다. 그러나 테스트 파일에 API 호출이 reject 됐을 때의 에러 상태 케이스가 없다. 네트워크 오류나 4xx/5xx 응답 시 에러 메시지가 올바르게 렌더링되는지, 그리고 에러 이후 dialog 가 닫혀도 이상 동작 없이 리셋되는지가 검증되지 않는다.
- 제안: 다음 케이스를 추가한다.
  ```tsx
  it("API 오류 시 loadFailed 메시지를 노출한다", async () => {
    apiGetMock.mockRejectedValueOnce(new Error("network error"));
    renderDialog();
    await waitFor(() => {
      expect(screen.getByText(/failed to load history/i)).toBeInTheDocument();
    });
  });
  ```

### [WARNING] `onClose` 콜백 호출 시나리오 미검증
- 위치: `trigger-history-dialog.test.tsx`
- 상세: 닫기 버튼(`triggers.history.close`)을 클릭했을 때 `onClose` 콜백이 실제로 호출되는지 테스트하는 케이스가 없다. 또한 Dialog의 `onOpenChange` 핸들러(`if (!next) onClose()`)를 통한 닫기 경로도 미검증이다. `onClose` 는 `historyTarget` 를 `null`로 되돌려 Dialog를 언마운트하는 핵심 핸들러이므로 회귀 위험이 있다.
- 제안: 다음 케이스를 추가한다.
  ```tsx
  it("'Close' 버튼 클릭 시 onClose 가 호출된다", async () => {
    apiGetMock.mockResolvedValueOnce({ data: { data: [] } });
    const onClose = vi.fn();
    renderDialog({ onClose });
    await waitFor(() => screen.getByText(/close/i));
    fireEvent.click(screen.getByRole("button", { name: /^close$/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  ```

### [WARNING] `open=false` 상태에서 쿼리 비활성화 검증 없음
- 위치: `trigger-history-dialog.test.tsx`, 구현체 L1261 (`enabled: !!triggerId && open`)
- 상세: 구현체는 `open=false`일 때 쿼리를 `enabled: false`로 비활성화한다. 이 조건이 실제로 작동해 dialog가 닫혀 있는 동안은 API를 호출하지 않는지 검증하는 케이스가 없다. `open=false` 상태로 렌더링되었을 때 `apiGetMock`이 호출되지 않아야 한다는 점은 불필요한 네트워크 요청 방지와 직결된다.
- 제안: 다음 케이스를 추가한다.
  ```tsx
  it("open=false 이면 API 를 호출하지 않는다", () => {
    renderDialog({ open: false });
    expect(apiGetMock).not.toHaveBeenCalled();
  });
  ```

### [INFO] 로딩 테스트가 CSS 클래스에 의존 — 취약한 선택자
- 위치: `trigger-history-dialog.test.tsx` L1129 (`document.querySelector(".animate-spin")`)
- 상세: 로딩 스피너 존재 여부를 CSS 클래스 `.animate-spin`으로 판별하고 있다. 이 방식은 Tailwind 클래스명 변경이나 컴포넌트 구조 변경 시 false negative가 발생할 수 있다. Testing Library의 aria 기반 쿼리 또는 `data-testid`가 권장된다. 현재 코드는 `aria-label`이나 `data-testid`가 없으므로 단기간 수정이 어려울 수 있으나 기술 부채로 기록한다.
- 제안: `Loader2` 컴포넌트에 `aria-label="loading"` 또는 `role="status"` 를 추가하고 `screen.getByRole("status")`로 선택하는 방식으로 개선한다.

### [INFO] `rerender` 테스트에서 새 `QueryClient` 인스턴스 생성 — 캐시 공유 불가
- 위치: `trigger-history-dialog.test.tsx` L1084-1120 (`onOpenFullDetail` 조건부 노출 케이스)
- 상세: `rerender` 시 `new QueryClient()`로 새 인스턴스를 생성하고 있다. `QueryClientProvider`의 `client` prop이 바뀌면 내부 캐시가 초기화되어 기존 데이터가 사라지지만, 이 테스트는 빈 배열 응답이므로 실질적 문제는 없다. 다만 이미 `apiGetMock.mockResolvedValue` (once가 아닌 영속 mock)를 사용하고 있어 의도가 명확하지 않다. `renderDialog()` 헬퍼를 재사용하지 않고 직접 `render`/`rerender`를 사용하는 이 케이스는 패턴 일관성이 낮다.
- 제안: `render` 호출 시 헬퍼 외부에서 `QueryClient`를 미리 생성해 `render`와 `rerender` 간 공유하거나, 아니면 두 상태를 분리된 `it` 블록으로 나눠 각각 검증한다.

### [INFO] `page.tsx` — `TriggerHistoryDialog` 통합 시나리오가 기존 `triggers-page.test.tsx`에 없음
- 위치: `codebase/frontend/src/app/(main)/triggers/__tests__/triggers-page.test.tsx`
- 상세: `triggers-page.test.tsx`는 pagination·RBAC 관련 케이스만 다루며, 새로 추가된 "호출 이력" 메뉴 항목을 클릭했을 때 `TriggerHistoryDialog`가 열리는지 검증하는 통합 케이스가 없다. 기존 테스트는 `TriggerDetailDrawer`를 `vi.mock`으로 null 처리하지만 `TriggerHistoryDialog`에 대한 mock 선언 자체가 없다. 현재 코드에서 `TriggerHistoryDialog`는 null mock 없이 실제 컴포넌트가 렌더링되는데, 이는 이 컴포넌트가 의존하는 API mock이 `triggers-page.test.tsx`에 올바르게 설정되지 않으면 잠재적 test interference를 만들 수 있다.
- 제안: `triggers-page.test.tsx`에 다음 두 가지 중 하나를 추가한다.
  1. `vi.mock("@/components/triggers/trigger-history-dialog", () => ({ TriggerHistoryDialog: () => null }))` 을 상단에 추가해 페이지 테스트의 격리성을 확보한다.
  2. 또는 "호출 이력 메뉴 클릭 시 historyTarget 이 세팅된다" 케이스를 추가해 해당 통합 동작을 명시적으로 커버한다.

### [INFO] `status: "error"` 배지 분기 테스트 없음
- 위치: `trigger-history-dialog.tsx` L1305 (`entry.status === "error" || entry.status === "failed"`)
- 상세: 정상 응답 테스트는 `"success"`와 `"failed"` 상태만 포함한다. 구현체에는 `"error"` 값도 `"destructive"` 배리언트로 처리하는 분기가 있으나, 테스트에서 `"error"` 케이스는 검증되지 않는다. 또한 `"running"`, `"pending"` 등 그 외 status 값은 `"outline"` 배리언트로 fallback되는데, 이 경로도 미검증이다.
- 제안: 기존 정상 응답 테스트에 `"error"` 상태 항목을 추가하거나, 별도 케이스로 "알 수 없는 status 는 outline badge 로 표시된다"를 추가한다.

## 요약

`TriggerHistoryDialog` 컴포넌트에 대한 테스트 파일이 신설되었고 핵심 렌더링 경로 6개를 커버하는 것은 적절하다. 그러나 에러 상태 렌더링, `onClose` 콜백 호출 검증, `open=false` 시 쿼리 비활성화 확인 등 3개의 코드 경로가 테스트되지 않아 회귀 위험이 있다. 또한 기존 `triggers-page.test.tsx`에 `TriggerHistoryDialog` mock 처리가 없어 테스트 격리성이 미흡하고, 로딩 상태를 CSS 클래스로 검증하는 방식은 장기적으로 취약하다. 위험도가 높은 critical 버그는 없으나, 에러/onClose 케이스 누락은 프로덕션 회귀를 만들 수 있는 공백이다.

## 위험도

MEDIUM
