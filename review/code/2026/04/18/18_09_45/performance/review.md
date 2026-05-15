### 발견사항

---

**[WARNING] `currentLocale()` — 렌더마다 Zustand 스토어 읽기 발생**
- 위치: `src/lib/utils/date.ts`, `src/lib/utils/execution-status.ts`
- 상세: `timeAgo`, `formatDuration`, `formatDate`, `getStatusLabel` 각 함수가 locale 인자 없이 호출될 때마다 `useLocaleStore.getState().locale`을 실행합니다. 실행 목록 페이지처럼 20행 테이블에서 duration + status badge가 동시에 렌더되면 렌더 1회당 40회 이상의 store read + `translate()` 호출이 누적됩니다. Zustand `getState()`는 단순 클로저 읽기이므로 개별 비용은 낮으나, 대형 리스트에서 반복 패턴이 쌓이면 무시할 수 없는 오버헤드가 됩니다.
- 제안: 컴포넌트 최상단에서 locale을 한 번 읽어 유틸 함수에 명시적으로 전달하세요. 혹은 `translate` 결과를 `useMemo`로 캐싱하는 커스텀 훅(`useFormattedExecutions` 등)으로 감쌉니다.

```ts
// 컴포넌트 안에서 한 번만 읽기
const locale = useLocaleStore((s) => s.locale);
// 이후 formatDuration(ms, locale), getStatusLabel(status, locale)로 전달
```

---

**[WARNING] `useMemo` 의존성 배열의 `t` 함수 안정성 불확실**
- 위치: `src/components/auth/forgot-password-form.tsx`, `ForgotPasswordFormInner`
- 상세: `forgotPasswordSchema`가 `useMemo(() => z.object({...}), [t])`로 정의되어 있습니다. `useT()`가 매 렌더마다 새로운 함수 참조를 반환하면 `t`가 매번 변경된 것으로 간주되어 `useMemo`가 렌더마다 새 Zod 스키마를 생성합니다. Zod 스키마 생성은 비용이 있는 객체 구성 작업이므로, `useT()` 내부 구현에서 `useCallback` 또는 안정적인 참조 반환을 보장하지 않으면 메모이제이션이 무력화됩니다.
- 제안: `useT()` 구현에서 함수 참조가 locale이 바뀔 때만 변경되도록 `useCallback` 또는 `useMemo`로 안정화하거나, 스키마 의존성을 `t` 대신 `locale`로 변경합니다.

```ts
const locale = useLocale();
const forgotPasswordSchema = useMemo(
  () => z.object({ email: z.string().min(1, t("...")).email(t("...")) }),
  [locale], // t 대신 locale 의존
);
```

---

**[WARNING] `"use client"` 추가로 서버 컴포넌트 활용 차단**
- 위치: `src/lib/utils/date.ts`, `src/lib/utils/execution-status.ts`
- 상세: 두 유틸 파일에 `"use client"`가 추가되어 서버 컴포넌트에서 `formatDate`, `timeAgo` 등을 직접 사용할 수 없게 됩니다. 날짜 포매팅은 서버에서 처리 가능한 순수 연산임에도 클라이언트 번들에 강제 포함됩니다. 이는 초기 로드 시 서버 렌더링 최적화 기회를 상실시킵니다.
- 제안: locale 읽기를 파일 내부에서 하지 않고 호출부에서 주입하여 `"use client"` 의존을 제거합니다. 순수 함수 형태를 유지하고 스토어 접근은 컴포넌트 레이어에 위임합니다.

---

**[INFO] 모듈 레벨 상수 배열의 번역 키 패턴 — 불필요한 함수 호출 반복**
- 위치: `src/app/(main)/integrations/page.tsx`, `src/app/(main)/workflows/[id]/executions/page.tsx`, `src/components/layout/sidebar.tsx` 등
- 상세: `SCOPE_OPTIONS`, `FILTER_BUTTONS`, `navItems` 등이 `labelKey`를 가지고 렌더 시마다 `t(item.labelKey)`를 호출합니다. 배열 크기가 작아 현재 영향은 미미하지만, 동일 locale에서 같은 키가 반복 번역됩니다. `translate()` 내부에 결과 캐시가 없다면 누적 호출이 발생합니다.
- 제안: `translate()` 함수에 `Map<locale+key, result>` 형태의 인메모리 캐시를 추가하거나, 앱 초기화 시 전체 번역 맵을 flat 객체로 빌드합니다.

---

**[INFO] `key={locale}` 패턴으로 인한 폼 전체 언마운트**
- 위치: `src/components/auth/forgot-password-form.tsx` (`ForgotPasswordForm` wrapper)
- 상세: locale 변경 시 `ForgotPasswordFormInner` 전체가 언마운트/재마운트됩니다. 의도적인 폼 초기화 목적이나, locale 변경 빈도에 따라 불필요한 렌더 트리 재구성이 발생합니다. 같은 패턴이 `login-form`, `register-form`, `reset-password-form`에도 적용될 경우 영향 범위가 넓어집니다.
- 제안: locale 변경 시 `useEffect`로 `reset()` 만 호출하는 방식으로 대체하면 DOM을 유지하면서 폼 상태만 초기화할 수 있습니다.

---

### 요약

이번 i18n 도입 변경의 핵심 성능 리스크는 두 가지입니다. 첫째, `date.ts`와 `execution-status.ts`의 유틸 함수들이 locale 인자 없이 호출될 때마다 Zustand store read를 수행하는 구조로, 테이블/리스트 렌더 시 불필요한 반복 store 접근이 누적됩니다. 둘째, `useMemo([t])`의 안정성이 `useT()` 구현에 의존하므로 참조 불안정 시 Zod 스키마가 매 렌더마다 재생성될 위험이 있습니다. 나머지 변경들(labelKey 패턴, `"use client"` 추가, key 리마운트)은 구조적으로 허용 가능한 수준이나 장기적으로는 정리가 필요합니다.

### 위험도

**MEDIUM**