## 발견사항

---

### [WARNING] `date.ts`와 `execution-status.ts`에 중복된 `formatDuration` 구현 존재
- **위치**: `date.ts:22-28`, `execution-status.ts:46-57`
- **상세**: 동일 함수명이 두 모듈에 별도 구현됨. `date.ts`는 `Math.floor`(정수 초), `execution-status.ts`는 `toFixed(1)`(소수점 초)으로 동작이 다름. `execution-list-page.test.tsx`에서 `"1.0s"` → `"1s"` 변경은 `execution-status.ts`의 `Number(seconds.toFixed(1))` 때문에 암묵적으로 변경됨. 두 구현의 차이가 테스트 문서화 없이 존재함.
- **제안**:
  ```ts
  // execution-status.test.ts에 추가
  it("formats seconds with decimal precision (1.5s not 1s)", () => {
    expect(formatDuration(1500, "en")).toBe("1.5s");
    expect(formatDuration(1000, "en")).toBe("1s");  // Number("1.0") === 1
  });
  ```
  두 구현 중 하나로 통합하고, 동작 차이를 명시적으로 테스트 문서화할 것.

---

### [WARNING] `formatDate`의 `"date"` format 분기 암묵적 제거 - 회귀 위험
- **위치**: `date.ts` diff, `date.test.ts:90-96`
- **상세**: 기존 `if (format === "date")` 분기가 제거됐으나 기본 분기와 동일 포맷을 사용하여 동작은 유지됨. 그러나 테스트가 이 동등성을 명시적으로 검증하지 않음. 추후 기본 포맷 변경 시 `"date"` 포맷이 의도치 않게 변경될 수 있음.
- **제안**:
  ```ts
  it("'date' format and default format produce identical output", () => {
    const date = "2026-01-15T12:00:00Z";
    expect(formatDate(date, "date", "en")).toBe(formatDate(date, undefined, "en"));
  });
  ```

---

### [WARNING] `ForgotPasswordForm`의 `key={locale}` 리마운트 패턴 미테스트
- **위치**: `forgot-password-form.tsx:129-131`, 대응 테스트 없음
- **상세**: 로케일 변경 시 폼 컴포넌트를 강제 리마운트하여 Zod 스키마 재생성을 트리거하는 패턴이 도입됨. 이 패턴은 `login-form.tsx`, `register-form.tsx`, `reset-password-form.tsx`에도 동일하게 적용되었을 것으로 보임. 그러나 로케일 변경 시 validation 메시지가 실제로 업데이트되는지 테스트가 없음.
- **제안**:
  ```tsx
  it("re-renders with new locale validation messages on locale switch", async () => {
    useLocaleStore.setState({ locale: "en" });
    render(<ForgotPasswordForm />);
    // locale switch
    act(() => useLocaleStore.setState({ locale: "ko" }));
    // submit empty form and check Korean error message
    fireEvent.submit(screen.getByRole("form"));
    expect(await screen.findByText("이메일을 입력해주세요")).toBeDefined();
  });
  ```

---

### [WARNING] `i18n.test.ts`에서 누락된 인터폴레이션 파라미터 처리 미검증
- **위치**: `i18n.test.ts` 전반
- **상세**: `translate("en", "time.minutesAgo", {})` 처럼 필수 파라미터가 누락됐을 때 `{minutes}` 플레이스홀더가 그대로 노출될 수 있음. 이 엣지 케이스가 테스트되지 않아 실제 런타임 UI에서 `"{minutes}m ago"` 같은 문자열이 노출될 수 있음.
- **제안**:
  ```ts
  it("leaves missing interpolation params as-is or returns safe fallback", () => {
    // @ts-expect-error — intentional missing param
    const result = translate("en", "time.minutesAgo", {});
    // Either "{minutes}m ago" or "m ago" — document the actual behavior
    expect(typeof result).toBe("string");
  });
  ```

---

### [WARNING] 비동기 컴포넌트의 i18n 처리에 대한 테스트 누락
- **위치**: `verify-email-content.tsx:37`, `accept-invitation-content.tsx:39`, `editor-loader.tsx:27`
- **상세**: 세 컴포넌트 모두 `useEffect` 내 async 함수에서 `useLocaleStore.getState().locale`을 호출하여 toast 메시지를 번역함. 이 패턴은 컴포넌트 렌더 시점이 아닌 비동기 실행 시점의 로케일을 사용함. 로케일이 비동기 실행 중 변경된 경우의 동작(race condition)과, 성공/실패 toast 메시지가 올바른 언어로 나타나는지 테스트가 없음.
- **제안**: `verify-email-content.tsx`, `accept-invitation-content.tsx`에 대한 테스트 파일 추가:
  ```tsx
  it("shows success toast in current locale after verification", async () => {
    useLocaleStore.setState({ locale: "en" });
    mockVerifyEmail.mockResolvedValue({ data: { data: { accessToken: "tok" } } });
    await renderComponent("?token=valid");
    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledWith(
      expect.stringContaining("verified") // en locale
    ));
  });
  ```

---

### [INFO] `useLocaleStore.setState` beforeEach 패턴 - 일관성 양호
- **위치**: 모든 변경된 테스트 파일의 `beforeEach`
- **상세**: 테스트 실행 순서에 무관하게 결정적 동작을 보장하는 올바른 패턴. Zustand 스토어는 모듈 싱글턴이므로 명시적 초기화가 필수이며, 모든 관련 테스트에 일관되게 적용됨.

---

### [INFO] `execution-list-page.test.tsx`의 text matcher 정규식 전환 - 적절
- **위치**: `execution-list-page.test.tsx:94`
- **상세**: `findByText("Test Workflow")` → `findByText(/Test Workflow/)` 변경은 `t("executions.listHeader", { name: workflowName })`으로 워크플로우 이름이 더 큰 문자열에 포함되었기 때문에 적절한 대응임.

---

### [INFO] `date.test.ts`의 `formatDuration` 로케일 기본값 테스트
- **위치**: `date.test.ts:59-61`
- **상세**: `formatDuration(5_000)`(locale 미전달)가 `"5초"`를 반환한다는 테스트가 있음. 이는 테스트 환경에서 스토어 기본값이 `"ko"`임을 전제함. 그러나 다른 테스트에서 `useLocaleStore.setState({ locale: "en" })`을 설정했다면 테스트 순서에 따라 이 테스트가 실패할 수 있는 **잠재적 테스트 격리 문제**가 있음.
- **제안**:
  ```ts
  it("uses locale defaults from the store when no locale is passed", () => {
    useLocaleStore.setState({ locale: "ko" }); // 명시적으로 설정
    expect(formatDuration(5_000)).toBe("5초");
  });
  ```

---

## 요약

i18n 전환에 따른 테스트 업데이트는 전반적으로 체계적으로 진행됨. 기존 테스트들은 `beforeEach`에 로케일 초기화를 추가하고, `i18n.test.ts`는 핵심 번역 함수에 대한 충분한 커버리지를 제공함. 주요 위험 요소는 두 가지임: (1) `date.ts`와 `execution-status.ts`에 중복 `formatDuration` 구현이 존재하여 향후 유지보수 혼란과 동작 불일치 위험이 있고, (2) `verify-email-content`, `accept-invitation-content`, `editor-loader`의 비동기 i18n 처리 및 auth 폼의 로케일 전환 리마운트 패턴에 대한 테스트가 없어 회귀 감지가 어려움. `date.test.ts`의 로케일 기본값 의존 테스트는 테스트 실행 순서에 따른 격리 문제 가능성이 있어 명시적 스토어 설정이 권장됨.

## 위험도

**MEDIUM**