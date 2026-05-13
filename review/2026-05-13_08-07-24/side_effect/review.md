코드를 검토하겠습니다.

---

## 발견사항

### [WARNING] 테스트 내 `getAllByRole()[1] ?? getByRole()` fallback 패턴이 의도치 않은 버튼을 클릭할 수 있음
- **위치**: `profile-info-card.test.tsx` (L101–103), `profile-preferences-card.test.tsx` (L117–119)
- **상세**: `getAllByRole(...)[1]`이 `undefined`를 반환(버튼이 1개뿐)하면 nullish fallback이 `getByRole()`로 내려가는데, 이 경우 diff 다이얼로그의 확정 버튼이 아닌 카드 헤더의 [저장] 버튼을 클릭하게 된다. 이 경우 PATCH가 호출되지 않아 테스트가 실패하겠지만, 에러 메시지가 "wrong button clicked"가 아닌 `waitFor timeout`으로 나타나 진단이 어렵다.
- **제안**: `screen.getByTestId("diff-confirm-button")` 같은 명시적 `data-testid`를 `ConfirmDiffDialog`의 확정 버튼에 추가하여 버튼을 명확하게 특정할 것

---

### [WARNING] `onSuccess`에서 `setLocaleStore`를 직접 호출하는 순서 문제
- **위치**: `profile-preferences-card.tsx` (L59–61)
- **상세**: `mutation.onSuccess`에서 `queryClient.invalidateQueries` 후 즉시 `setLocaleStore(patch.locale)`를 호출한다. locale store 변경은 `useLocale` 기반의 컴포넌트 전체를 re-render 트리거하는데, query 재조회가 완료되기 전에 store 값이 변경된다. 이후 `ProfilePage.useEffect`가 query의 stale 값(`user.locale` = 이전 값)으로 `setLocaleStore`를 다시 호출할 가능성이 있다. 실제로는 invalidate 후 refetch가 빠르게 완료되고 새 locale을 가져오므로 최종 상태는 올바르지만, 짧은 순간 두 번의 반대 방향 store 업데이트가 발생한다.
- **제안**: `ProfilePage.useEffect`의 locale sync만을 신뢰하고, `onSuccess`에서는 `setThemeStore`만 직접 호출하는 것을 검토 (단, locale 변경이 UI에 즉시 반영되어야 하는 UX 요구가 있다면 현행 유지도 합리적)

---

### [WARNING] `ChangePasswordPage` 내부의 `type FormValues` 선언 위치
- **위치**: `change-password/page.tsx` (L56)
- **상세**: `type FormValues = z.infer<typeof schema>`가 `ChangePasswordPageInner` 함수 내부에 선언되어 있다. TypeScript 타입이므로 런타임 비용은 없지만, `schema`가 `useMemo` 의존성에 따라 재생성될 때 `useForm<FormValues>`의 resolver는 자동으로 갱신되지 않는다(react-hook-form은 초기화 시 resolver를 캡처). 외부 컴포넌트의 `key={locale}` 강제 리마운트로 실질적으로는 문제가 없으나, 이 의존 관계가 암묵적이다.
- **제안**: `schema`를 컴포넌트 외부 상수로 분리하거나, resolver 재초기화 필요성을 명시적으로 주석에 표기할 것

---

### [INFO] `sidebar.profile` i18n 키 값 변경의 묵시적 전파
- **위치**: `en.ts` (L101), `ko.ts` (L97)
- **상세**: `sidebar.profile` 값이 "프로필" → "내 프로필" / "Profile" → "My Profile"로 변경된다. 이 키를 참조하는 모든 컴포넌트(사이드바, 팝업 메뉴 등)가 변경된 텍스트를 표시하게 된다. 변경 자체는 의도적이지만, 리뷰된 파일 외부의 consumer가 있다면 조용히 라벨이 바뀐다.
- **제안**: `grep -r "sidebar.profile"` 또는 `grep -r "sidebar\.profile"` 으로 모든 사용처를 확인해 의도하지 않은 consumer가 없는지 검증

---

### [INFO] `axiosMessage` 유틸 함수 3중 복사
- **위치**: `change-password/page.tsx`, `profile-info-card.tsx`, `profile-preferences-card.tsx`
- **상세**: 동일한 `axiosMessage` 함수가 세 파일에 복사되어 있다. 행동 자체는 동일하므로 직접적인 부작용은 없으나, 향후 에러 처리 방식 변경 시 세 곳을 모두 수정해야 한다.
- **제안**: `@/lib/api/error-utils.ts` 등으로 추출하여 공유할 것

---

### [INFO] `dirty` 판별에서 `.trim()` 비교 사용
- **위치**: `profile-info-card.tsx` (L51)
- **상세**: `(name ?? "").trim() !== (user.name ?? "").trim()` — 이름 앞뒤의 공백 추가·제거는 변경으로 감지되지 않아 diff 모달이 열리지 않고 silently view 모드로 복귀한다. 의도적인 설계라면 문제없으나, 실제 PATCH 시에는 `{ name }` 그대로 전송되므로 trim 없이 전송되는 값과 dirty 판별 기준이 불일치한다.
- **제안**: `dirty` 기준과 PATCH payload 모두 동일하게 trim을 적용하거나, dirty 판별에서 trim을 제거할 것

---

## 요약

전반적으로 이번 변경은 `/profile` 페이지의 단일 Save 버튼 footgun을 해소하기 위한 설계가 명확하며, 의도된 부작용(live theme preview, cancel 시 원복, locale 변경 시 key 리마운트)은 모두 적절히 격리되어 있다. 가장 실질적인 위험은 테스트의 `getAllByRole()[1] ?? getByRole()` 패턴으로, 특정 조건에서 잘못된 버튼을 클릭해 테스트 의도를 검증하지 못하는 false-negative가 발생할 수 있다. `onSuccess`에서의 locale store 조기 업데이트는 짧은 순간의 이중 업데이트를 유발하지만 최종 상태는 올바르다. 나머지는 코드 품질 관점의 정보성 사항이다.

## 위험도

**LOW**