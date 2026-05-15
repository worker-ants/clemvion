### 발견사항

---

**[WARNING] `axiosMessage` 유틸리티 3중 복제**
- 위치: `change-password/page.tsx`, `profile-info-card.tsx`, `profile-preferences-card.tsx` — 동일 구현 3곳
- 상세: Axios 에러 메시지 추출 로직이 세 파일에 copy-paste되어 있다. 수정이 필요할 때 3곳을 모두 찾아 동기화해야 하는 DRY 위반.
- 제안: `@/lib/api/errors.ts`(또는 `@/lib/api/utils.ts`)로 추출 후 단일 export.

---

**[WARNING] 자식 컴포넌트가 부모의 쿼리 키를 직접 참조 — 숨겨진 결합**
- 위치: `profile-info-card.tsx:57`, `profile-preferences-card.tsx:62` → `queryKey: ["user-profile"]`
- 상세: `page.tsx`에서 정의한 쿼리 키 문자열을 자식 카드 컴포넌트가 `invalidateQueries`로 직접 호출한다. 부모가 키를 바꾸면 자식의 invalidate가 조용히 실패한다. 컴포넌트 경계를 넘는 암묵적 결합.
- 제안: 쿼리 키를 상수로 공유(`export const USER_PROFILE_QUERY_KEY = ["user-profile"]`)하거나, 부모가 `onSuccess` 콜백을 prop으로 내려줘 invalidation 책임을 부모에서 담당.

---

**[WARNING] `useMemo` deps 불완전 — eslint-disable 억제**
- 위치: `profile-preferences-card.tsx:131` (`eslint-disable-next-line react-hooks/exhaustive-deps`)
- 상세: `themeLabel`/`localeLabel` 인라인 함수가 deps에서 누락된 채 억제되어 있다. `t`가 deps에 있으므로 실제로는 안전하지만, 이 패턴은 함수를 컴포넌트 외부나 `useCallback`으로 분리했으면 억제 자체가 불필요했다.
- 제안: `themeLabel`/`localeLabel`을 `useCallback` 또는 컴포넌트 외부 순수 함수로 격리 → suppress 제거.

---

**[WARNING] `ProfilePreferencesCard` 책임 과다 — 단일 책임 위반 경계**
- 위치: `profile-preferences-card.tsx` 전체
- 상세: 하나의 컴포넌트가 ① UI 렌더링, ② API mutation, ③ 글로벌 theme store 조작, ④ 글로벌 locale store 조작, ⑤ live preview 임시 state 격리를 모두 담당한다. 현재 규모에서는 관리 가능하지만, 추가 preference 항목(알림, 타임존 등)이 생기면 컴포넌트가 급격히 비대해진다.
- 제안: 당장 분리 필요는 없으나, `useProfilePreferences()` custom hook으로 mutation·store 동기화 로직을 추출하면 컴포넌트는 순수 UI로 축소됨.

---

**[INFO] `ServerTheme` 타입 중복 정의**
- 위치: `profile/page.tsx:21`, `profile-preferences-card.tsx:18` — 동일 `type ServerTheme = "light" | "dark"`
- 상세: 같은 도메인 타입이 두 파일에 각각 선언되어 있다. 불일치 가능성은 낮지만 불필요한 중복.
- 제안: `@/lib/types/user.ts` 같은 공유 모듈로 단일 정의.

---

**[INFO] `type FormValues` 컴포넌트 내부 선언**
- 위치: `change-password/page.tsx:55` — `type FormValues = z.infer<typeof schema>` (함수 바디 내부)
- 상세: TypeScript 타입이 컴포넌트 함수 내부에 선언되어 있어 외부에서 참조 불가. 현재는 단독 사용이라 무해하지만, 관례상 모듈 스코프 선언이 가독성과 재사용성에 유리.
- 제안: `useMemo` 블록 바깥(모듈 탑레벨 또는 컴포넌트 밖)으로 이동.

---

**[INFO] `ChangePasswordPage`의 `key={locale}` 강제 리마운트 패턴**
- 위치: `change-password/page.tsx:195` — `<ChangePasswordPageInner key={locale} />`
- 상세: locale 변경 시 내부 컴포넌트를 완전히 파괴·재생성해 `useMemo`의 schema를 갱신하는 workaround다. 비밀번호 변경 폼 사용 중 언어 전환이 일어나면 입력값이 초기화된다. 의도된 트레이드오프지만 문서화되지 않은 아키텍처 부채.
- 제안: schema를 locale-independent하게 구성(에러 메시지를 validation 시점에 t()로 생성)하거나, key 패턴을 유지하되 `// locale change forces remount to re-derive i18n schema` 주석으로 의도를 명시.

---

**[INFO] 테스트의 버튼 인덱스 의존 — 취약한 셀렉터**
- 위치: `profile-info-card.test.tsx:99`, `profile-preferences-card.test.tsx:118`
  ```ts
  screen.getAllByRole("button", { name: /저장|save/i })[1] ?? screen.getByRole(...)
  ```
- 상세: `[1]`번째 버튼을 선택하는 것은 DOM 순서에 의존한다. Dialog 내부 버튼과 카드 내부 버튼이 같은 이름을 공유할 때 발생하는 구조적 문제. `??` fallback은 셀렉터 불확실성을 인정하는 표시.
- 제안: Dialog 저장 버튼에 `data-testid="diff-dialog-confirm"` 추가 후 `getByTestId`로 선택. 다른 testid들과 일관성 확보.

---

### 요약

이번 리팩토링은 단일 Save 버튼 안티패턴을 카드별 인라인 토글 + diff 확인 모달 + 전용 sub-route 로 성공적으로 분해했다. `ConfirmDiffDialog`는 `DiffEntry[]` 인터페이스 기반으로 재사용 가능하게 잘 설계되었고, 테마 live preview의 임시 state 격리와 외부 변경 시 view 모드 한정 동기화(`useEffect + mode === "view"` 조건) 는 의도를 정확히 구현했다. 주요 아키텍처 부채는 세 곳의 `axiosMessage` 복제, `["user-profile"]` 쿼리 키의 부모-자식 간 암묵적 결합, `ServerTheme` 타입 중복으로 모두 즉시 수정 가능한 LOW 수준이다. `ProfilePreferencesCard`의 책임 집중은 현재 규모에서는 허용 범위이나 향후 preference 확장 시 custom hook 추출이 권장된다.

### 위험도

**LOW**