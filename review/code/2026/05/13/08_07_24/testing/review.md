## 발견사항

### **[CRITICAL] `@/lib/i18n` 미mock — 모든 테스트 파일 공통**
- **위치:** 4개 테스트 파일 모두 (change-password, confirm-diff-dialog, profile-info-card, profile-preferences-card)
- **상세:** 컴포넌트들이 `useT()`, `useLocale()` 를 필수로 호출하는데 어떤 테스트에도 `vi.mock("@/lib/i18n", ...)` 가 없음. vitest 전역 setup 파일에 i18n mock이 없다면 훅이 context/store 의존성으로 throw 할 수 있어 전체 test suite 가 런타임에 불안정해짐. 이중언어 regex (`/현재 비밀번호|current password/i`) 를 쓰는 것 자체가 반환값을 제어하지 못함을 암시함.
- **제안:** `vi.mock("@/lib/i18n", () => ({ useT: () => (key: string) => key, useLocale: () => "ko" }))` 를 모든 테스트 파일 상단에 추가하거나, vitest setup 파일에서 전역 mock 처리.

---

### **[WARNING] API 오류 경로 테스트 없음 — 3개 컴포넌트**
- **위치:**
  - `change-password.test.tsx` — `apiClient.post` reject 시나리오 없음
  - `profile-info-card.test.tsx` — `apiClient.patch` reject 시나리오 없음
  - `profile-preferences-card.test.tsx` — `apiClient.patch` reject 시나리오 없음
- **상세:** 3개 컴포넌트 모두 `catch (err) { toast.error(...) }` 경로가 있으나 이를 검증하는 테스트가 0개. 네트워크 오류 시 `toast.error` 호출 여부, `isPending` 이 `false` 로 복귀하는지, 버튼이 다시 활성화되는지 미검증.
- **제안:**
  ```ts
  it("shows error toast when API fails", async () => {
    (apiClient.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("500"));
    // ...submit...
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });
  ```

---

### **[WARNING] `getAllByRole("button")[1]` — 취약한 버튼 선택**
- **위치:**
  - `profile-info-card.test.tsx` L98–100
  - `profile-preferences-card.test.tsx` L117–119
- **상세:** diff 모달의 저장 버튼을 `screen.getAllByRole("button", { name: /저장|save/i })[1]` 로 선택함. DOM 순서가 바뀌거나(카드 버튼이 먼저 매칭되지 않을 경우) 테스트가 잘못된 버튼을 클릭하거나 index out of range 로 실패할 수 있음. `ConfirmDiffDialog` 내 저장 버튼에 `data-testid="diff-confirm-save"` 를 추가하면 결정론적으로 선택 가능.
- **제안:** `confirm-diff-dialog.tsx` 저장 버튼에 `data-testid="diff-confirm-save"` 추가 후 테스트에서 `getByTestId("diff-confirm-save")` 사용.

---

### **[WARNING] 로딩/pending 상태 미검증**
- **위치:** `change-password.test.tsx`, `profile-info-card.test.tsx`, `profile-preferences-card.test.tsx`
- **상세:** 제출 중 버튼이 `disabled` 되는지 검증하는 케이스가 없음. `confirm-diff-dialog.test.tsx` 에는 pending 중 버튼 비활성화 테스트가 있어 패턴이 존재하는데, 나머지 3개에는 적용되지 않음.
- **제안:** `change-password.test.tsx` 에 제출 후 버튼 disabled 확인 케이스 추가. `profile-info-card.test.tsx` / `profile-preferences-card.test.tsx` 도 mutation 중 [저장]/[취소] 비활성화 검증 추가.

---

### **[WARNING] `useLocale` 미mock — `ChangePasswordPage` outer wrapper**
- **위치:** `change-password.test.tsx` — `ChangePasswordPage` (outer)
- **상세:** export default 는 `const locale = useLocale(); return <ChangePasswordPageInner key={locale} />` 구조. `useLocale` 이 mock 되지 않아 실제 훅 구현에 의존하고 있음. i18n CRITICAL 과 연동되는 문제.

---

### **[WARNING] `onConfirm` 거부(rejection) 경로 미테스트 — `confirm-diff-dialog`**
- **위치:** `confirm-diff-dialog.test.tsx`
- **상세:** `handleConfirm` 이 `try/finally` 로 구현되어 `onConfirm` throw 시에도 `setPending(false)` 로 복귀하나, 이 경로를 검증하는 테스트가 없음. 취소 가능 여부나 재시도 가능 여부가 보장되지 않음.
- **제안:**
  ```ts
  it("re-enables buttons when onConfirm rejects", async () => {
    const onConfirm = vi.fn().mockRejectedValueOnce(new Error("fail"));
    renderWith({ onConfirm });
    fireEvent.click(screen.getByRole("button", { name: /저장|save/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /저장|save/i })).not.toBeDisabled());
  });
  ```

---

### **[INFO] `profile/page.tsx` 직접 테스트 없음**
- **위치:** `profile/page.tsx` (리팩토링 대상)
- **상세:** 기존 단일 Save 버튼 삭제, 카드 조립, `isError || !user` 가드 추가 등의 변경이 있으나 page 레벨 테스트가 없음. 카드 컴포넌트 단위 테스트는 있지만, 카드 합성·로딩/오류 상태·`useEffect` store 동기화 로직을 통합 검증하는 테스트는 부재.

---

### **[INFO] `fireEvent` 대신 `userEvent` 권장**
- **위치:** 전체 테스트 파일
- **상세:** `fireEvent.change` / `fireEvent.click` 은 실제 브라우저 이벤트 흐름(focus, blur, input, change 순서)을 시뮬레이션하지 않음. react-hook-form 은 blur 시 유효성 검사를 트리거하는데, `fireEvent` 는 이를 건너뜀. 현재 테스트는 `mode: "onSubmit"` 기본값이라 submit 전에만 검사하므로 동작하지만, 향후 `mode: "onChange"` 나 `mode: "onBlur"` 로 바뀌면 테스트가 false positive 를 낼 수 있음.

---

### **[INFO] 공백 트리밍 엣지 케이스 미커버**
- **위치:** `profile-info-card.test.tsx`
- **상세:** `dirty` 계산이 `.trim()` 비교를 하므로 `"Gehrig"` → `"Gehrig "` (trailing space) 는 dirty 하지 않음. 이 동작이 의도적인지 테스트에서 명시적으로 검증되지 않음.

---

## 요약

테스트 전략 자체는 탄탄하다. readonly 기본값, 편집 토글, 취소 원복, diff 모달 흐름, API 호출 검증까지 핵심 happy path 가 모두 커버되어 있고, `vi.hoisted` 를 활용한 Zustand store mock 패턴도 올바르다. 그러나 **`@/lib/i18n` hook 미mock** 이 CI 환경에서 실제 훅 구현에 따라 전체 suite 를 깨뜨릴 수 있는 가장 큰 위험이며, 세 컴포넌트 모두 API 오류 경로와 pending 상태가 미테스트로 남아 있다. diff 모달 저장 버튼을 `[1]` 인덱스로 선택하는 취약한 패턴도 `data-testid` 추가로 바로 해소할 수 있다.

## 위험도

**MEDIUM**