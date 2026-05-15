### 발견사항

---

- **[CRITICAL]** Zod 스키마가 컴포넌트 내부에서 매 렌더마다 재생성됨
  - 위치: `forgot-password-form.tsx`, `login-form.tsx`, `register-form.tsx`, `reset-password-form.tsx` — 스키마 정의 블록
  - 상세: 이전에는 스키마가 모듈 최상단에서 한 번만 생성됐으나, `t()` 접근을 위해 컴포넌트 함수 내부로 이동하면서 매 렌더마다 `z.object({...})` 객체 전체를 새로 생성한다. Zod 스키마 생성 비용은 단순 객체 리터럴보다 높으며(validator 함수 할당, refine 등), `react-hook-form`의 `zodResolver(schema)` 역시 `schema` 참조가 바뀔 때마다 resolver를 재생성할 수 있다. 폼이 존재하는 동안 이 비용이 누적된다.
  - 제안: 스키마를 `useMemo`로 감싸거나, `t`를 인자로 받는 팩토리 함수를 `useMemo` 안에서 호출하도록 변경한다.
    ```typescript
    const forgotPasswordSchema = useMemo(
      () => z.object({ email: z.string().min(1, t("auth.validation.emailRequired")).email(t("auth.validation.emailInvalid")) }),
      [t]
    );
    ```

---

- **[WARNING]** JSX 내 IIFE가 매 렌더마다 실행되며 React 엘리먼트를 재생성
  - 위치: `register-form.tsx` — `termsAgreeHtml` 템플릿 파싱 블록 (약 40줄짜리 IIFE)
  - 상세: `{(() => { const template = t(...); ... })()}` 패턴은 렌더마다 문자열 분리, 인덱스 비교, 두 개의 `<Link>` 엘리먼트 재생성을 실행한다. 언어가 바뀌지 않는 한 결과는 동일하므로 불필요한 연산이다. `null` 바이트를 sentinel로 쓰는 방식도 가독성과 유지보수성이 낮다.
  - 제안: `useMemo([t])`로 감싸고, 더 간단한 분기 방식(번역 키를 이용한 정적 링크 배치)으로 대체하는 것을 검토한다.

---

- **[WARNING]** `date.ts`의 `currentLocale()`가 `getState()`를 직접 호출 — 반응성 없음
  - 위치: `src/lib/utils/date.ts` — `currentLocale()` 함수 및 이를 사용하는 `timeAgo`, `formatDuration`, `formatDate`
  - 상세: `useLocaleStore.getState()`는 Zustand 스토어의 스냅샷을 읽는다. 컴포넌트가 `locale` 파라미터 없이 `timeAgo(date)` 를 호출하면, 로케일이 변경돼도 해당 컴포넌트는 **리렌더되지 않는다**. 날짜 텍스트가 이전 언어로 남아있는 시각적 불일치(stale UI)가 발생하고, 이를 해결하기 위해 불필요한 강제 리렌더가 필요해질 수 있다.
  - 제안: 컴포넌트에서 `useLocale()` hook으로 locale을 구독한 뒤 명시적으로 전달하도록 한다. `currentLocale()` 내부 fallback은 서버 렌더 환경 전용으로만 사용을 제한한다.

---

- **[WARNING]** `dashboard/page.tsx`의 `summaryCards` 배열이 매 렌더마다 재생성됨
  - 위치: `dashboard/page.tsx` — `summaryCards` 정의 블록 (약 20줄)
  - 상세: `summaryCards`는 쿼리 데이터(`summary`)와 `t` 함수에만 의존하지만 컴포넌트 본문에 평문으로 선언되어 매 렌더마다 새 배열·객체를 할당한다. 쿼리 결과가 자주 갱신되는 대시보드 특성상 리렌더 빈도가 높다.
  - 제안: `useMemo([summary, t])`로 감싼다.

---

- **[INFO]** `Section` 컴포넌트에 `t` prop이 전달되나 내부에서 완전히 무시됨
  - 위치: `integrations/page.tsx` — `Section` 함수 선언 및 `void t;` 라인
  - 상세: `t` prop이 추가됐지만 `void t;`로 즉시 버려진다. prop 드릴링 비용(타입 체크, 호출 사이트 변경)은 발생하지만 실제로 활용되지 않는다. 향후 `Section` 내부에 번역이 필요한 텍스트가 추가될 때를 대비한 것으로 보이나, YAGNI 원칙에 어긋난다.
  - 제안: 당장 쓰지 않는다면 `t` prop을 제거하고, 필요해질 때 추가한다.

---

- **[INFO]** `getPasswordStrength`가 `t` 함수를 인자로 받아 매 키입력마다 호출
  - 위치: `register-form.tsx`, `reset-password-form.tsx` — `getPasswordStrength(password, t)` 호출
  - 상세: `t`가 `useCallback([locale])`로 안정화돼 있어 로케일 불변 시 참조가 유지되므로 치명적이진 않다. 그러나 강도 계산 결과를 `useMemo([password, t])`로 메모이즈하면 동일 비밀번호 + 동일 locale 조합에서 불필요한 재계산을 피할 수 있다.
  - 제안: `const strength = useMemo(() => getPasswordStrength(password, t), [password, t]);`

---

### 요약

이번 변경의 핵심 성능 문제는 **Zod 스키마를 컴포넌트 본문으로 이동**한 것이다. 모듈 레벨에서 한 번만 생성되던 스키마 객체들이 이제 매 렌더마다 새로 할당되며, `react-hook-form`의 resolver 재생성을 유발할 수 있다. `date.ts`의 `currentLocale()` 패턴은 반응성을 보장하지 않아 locale 변경 시 날짜 텍스트가 갱신되지 않는 스테일 UI 버그를 일으킨다. 나머지 이슈들(IIFE, summaryCards, 미사용 prop)은 부가적인 비용이지만 즉시 수정 가능하다. i18n 자체의 `useSyncExternalStore` + `useCallback` 구조와 Zustand 스토어 설계는 전반적으로 효율적이다.

### 위험도

**MEDIUM**