### 발견사항

---

**[INFO]** `useQuery` staleTime 미설정 — 마운트마다 불필요한 API 호출

- **위치**: `profile/page.tsx` — `useQuery` 설정
- **상세**: `staleTime` 기본값은 0ms이므로 사용자가 다른 페이지를 잠깐 방문하고 돌아올 때마다 `/users/me`를 재호출한다. 프로필 데이터는 자주 바뀌지 않으므로 이 비용은 순수 낭비다.
- **제안**:
  ```tsx
  useQuery<UserProfile>({
    queryKey: ["user-profile"],
    queryFn: ...,
    staleTime: 5 * 60 * 1000, // 5분
  });
  ```

---

**[INFO]** `themeLabel` / `localeLabel` 이 `useMemo` 의존 배열 외부에서 정의되어 eslint 억제로 은폐

- **위치**: `profile-preferences-card.tsx:119–133` — `diff` useMemo
- **상세**: `themeLabel`, `localeLabel` 두 함수가 컴포넌트 본문에서 매 렌더링마다 새로 생성되고, 그 안에서 `t`를 클로저로 참조한다. `diff` useMemo 의존 배열에는 `t`만 있고 `themeLabel`/`localeLabel`은 없는 채로 `// eslint-disable-next-line react-hooks/exhaustive-deps` 로 경고를 억제했다. `t`가 안정적인 참조를 유지하는 한 실제 클로저 문제는 발생하지 않지만, `t`의 안정성 보장이 명시적이지 않아 미래 리그레션 위험이 있다.
- **제안**: eslint 억제 대신 두 함수를 의존 배열에 명시하거나, `useCallback`으로 안정화하거나, `useMemo` 내부에 인라인한다.
  ```tsx
  const diff = useMemo(() => {
    const themeLabel = (v: ServerTheme) =>
      v === "dark" ? t("profile.themeDark") : t("profile.themeLight");
    const localeLabel = (v: Locale) =>
      v === "ko" ? t("profile.languageKorean") : t("profile.languageEnglish");
    ...
  }, [tempTheme, tempLocale, user.theme, user.locale, t]);
  ```

---

**[INFO]** `axiosMessage` 유틸이 3개 파일에 복제

- **위치**: `change-password/page.tsx:24`, `profile-info-card.tsx:37`, `profile-preferences-card.tsx:26`
- **상세**: 런타임 비용은 없으나, 동일한 함수가 세 번 인스턴스화되어 번들 크기를 소폭 증가시킨다. 모노레포 내에서 공통 유틸 경로로 분리하면 트리쉐이킹도 더 확실해진다.
- **제안**: `@/lib/api/axios-message.ts` 같은 공유 모듈로 추출 후 import.

---

**[INFO]** `ConfirmDiffDialog`의 `onConfirm` prop에 매 렌더링마다 새 인라인 화살표 함수

- **위치**: `profile-info-card.tsx:163`, `profile-preferences-card.tsx:220`
- **상세**: `onConfirm={async () => { await mutation.mutateAsync(...); }}` 형태로 렌더링마다 새 함수 참조가 생성된다. `ConfirmDiffDialog`가 `React.memo`로 감싸져 있지 않고, `showDiff=true` 구간에서만 렌더링되므로 실제 영향은 미미하지만 `useCallback`으로 명시하는 것이 의도를 더 명확히 한다.
- **제안**: 각 카드에서 `useCallback(async () => { ... }, [mutation, name])` 형태로 안정화.

---

**[INFO]** 테스트에서 `waitFor` 두 번 연속 호출로 폴링 비용 중복

- **위치**: `profile-info-card.test.tsx:99–106`, `profile-preferences-card.test.tsx:117–124`, `change-password.test.tsx:93–99`
- **상세**: 같은 비동기 흐름에서 완료되는 두 단언을 각각의 `waitFor`로 분리하면, 첫 번째 `waitFor` 완료 후 두 번째가 별도의 폴링 사이클을 시작한다. 테스트 시간을 불필요하게 늘린다.
- **제안**: 한 `waitFor` 블록에 합친다.
  ```tsx
  await waitFor(() => {
    expect(apiClient.patch).toHaveBeenCalledWith("/users/me", { name: "Gehrig Kim" });
    expect(toast.success).toHaveBeenCalled();
  });
  ```

---

### 요약

전반적인 성능 설계는 양호하다. `useMemo`로 diff/patchPayload를 메모화하고, Zustand 스토어를 셀렉터 단위로 구독하며, 카드별 독립 `useMutation`으로 상태를 격리한 구조는 불필요한 리렌더링을 잘 통제하고 있다. 실질적 개선 우선순위는 하나뿐이다 — `useQuery`에 `staleTime`을 추가해 프로필 페이지 재진입 시 발생하는 반복 API 호출을 줄이는 것. 나머지 항목(eslint 억제 은폐, 중복 유틸, 인라인 화살표 함수, 테스트 waitFor 분리)은 런타임 영향이 없거나 극히 미미한 수준이다.

### 위험도

**LOW**