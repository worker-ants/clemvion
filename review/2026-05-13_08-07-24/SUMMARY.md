# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 테스트 suite 전체를 깨뜨릴 수 있는 i18n mock 누락과 spec에 명시된 "모달 닫힘 시 theme store 원복" 조건 미충족이 핵심 위험. 나머지는 DRY 위반 중심의 LOW 수준.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `@/lib/i18n` (`useT`, `useLocale`) mock이 4개 테스트 파일 모두에 없음. 이중언어 regex(`/현재 비밀번호\|current password/i`)를 쓰는 것 자체가 반환값 미제어의 증거. vitest 전역 setup에 mock이 없다면 훅이 context 의존성으로 throw → test suite 전체 런타임 불안정 | `change-password.test.tsx`, `confirm-diff-dialog.test.tsx`, `profile-info-card.test.tsx`, `profile-preferences-card.test.tsx` 전체 | `vi.mock("@/lib/i18n", () => ({ useT: () => (key: string) => key, useLocale: () => "ko" }))` 를 각 파일 상단 또는 vitest setup 전역에 추가 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement / Concurrency | spec §2.0 "취소·모달 닫힘 시 항상 원복" 조건 미충족: diff 모달의 `onClose`가 `setShowDiff(false)`만 실행하고 `setThemeStore(user.theme)` 미호출. 카드 [취소]는 원복하지만 모달 dismiss 경로는 원복하지 않아 동작 불일치 | `profile-preferences-card.tsx` — `ConfirmDiffDialog onClose` | `onClose={() => { setShowDiff(false); setThemeStore(user.theme); }}` |
| 2 | Testing | API 오류 경로 테스트 전무 — 3개 컴포넌트 모두 `catch (err) { toast.error(...) }` 경로가 있으나 `mockRejectedValueOnce` 케이스 없음. `isPending` 복귀, 버튼 재활성화 모두 미검증 | `change-password.test.tsx`, `profile-info-card.test.tsx`, `profile-preferences-card.test.tsx` | 각 파일에 `apiClient.post/patch.mockRejectedValueOnce(new Error("500"))` + `expect(toast.error).toHaveBeenCalled()` 케이스 추가 |
| 3 | Testing | `ConfirmDiffDialog` `onConfirm` 거부 경로 미테스트. `finally { setPending(false) }` 경로가 있으나 reject 시 버튼 재활성화 검증 없음 | `confirm-diff-dialog.test.tsx` | `vi.fn().mockRejectedValueOnce(...)` + `expect(saveBtn).not.toBeDisabled()` 케이스 추가 |
| 4 | Testing | `ChangePasswordPage`의 outer wrapper가 `useLocale` 미mock — `key={locale}` 구조로 인해 실제 훅 구현에 의존 | `change-password.test.tsx` | Critical #1의 i18n 전역 mock 시 함께 해소 |
| 5 | Testing | loading/pending 상태 미검증 — `confirm-diff-dialog.test.tsx`에는 pending 중 버튼 비활성화 테스트가 있으나 나머지 3개 파일에는 없음 | `change-password.test.tsx`, `profile-info-card.test.tsx`, `profile-preferences-card.test.tsx` | 제출 직후 버튼 `disabled` 확인 케이스 추가 |
| 6 | Testing / Architecture | `getAllByRole("button", { name: /저장\|save/i })[1]` — DOM 순서 의존 취약 셀렉터. `??` fallback이 셀렉터 불확실성을 인정하는 표시. 버튼 순서 변경 시 잘못된 버튼 클릭 또는 `waitFor timeout`으로 진단 어려운 실패 발생 | `profile-info-card.test.tsx:98`, `profile-preferences-card.test.tsx:113` | `confirm-diff-dialog.tsx` 저장 버튼에 `data-testid="diff-confirm-save"` 추가 후 `getByTestId` 사용 |
| 7 | Maintainability / Architecture | `axiosMessage` 함수가 3개 파일에 완전 동일 복사. 에러 처리 정책 변경 시 3곳 동기화 필요. 보안 정책 변경 시 누락 파일 발생 위험 | `change-password/page.tsx:25`, `profile-info-card.tsx:38`, `profile-preferences-card.tsx:29` | `@/lib/api/errors.ts`(또는 `error-utils.ts`)로 추출 후 단일 export |
| 8 | Architecture | 자식 컴포넌트가 부모의 쿼리 키 문자열 `["user-profile"]`을 `invalidateQueries`에 직접 사용 — 암묵적 결합. 부모가 키를 변경하면 자식 invalidate가 조용히 실패 | `profile-info-card.tsx:57`, `profile-preferences-card.tsx:62` | `export const USER_PROFILE_QUERY_KEY = ["user-profile"]` 상수 공유 또는 부모가 `onSuccess` prop으로 invalidation 담당 |
| 9 | Security | `axiosMessage`가 `err.response?.data?.message`를 toast에 직접 노출. 백엔드가 내부 구현 세부사항이나 사용자 열거 가능 메시지를 반환할 경우 정보 노출 위험 | `change-password/page.tsx`, `profile-info-card.tsx`, `profile-preferences-card.tsx` | HTTP 상태 코드 기준 범주별 제네릭 메시지 선택(`401 → t("error.unauthorized")` 등). 백엔드가 안전한 메시지만 반환 보장 시 현행 유지 가능 |
| 10 | Security | 비밀번호 복잡도 요구사항 없음 — 길이(8~100자)만 검사. "12345678" 같은 약한 비밀번호 허용 | `change-password/page.tsx:44-47` | 대문자·숫자·특수문자 혼합 regex 또는 `zxcvbn` 기반 강도 피드백 추가 (백엔드 동일 규칙 전제) |
| 11 | Concurrency | diff 다이얼로그 열린 상태에서 뒤의 폼 입력 가능(포커스 강제 이동 시). 다이얼로그 표시 diff와 실제 `mutateAsync` payload 불일치 가능. 모달 포커스 트랩이 불완전한 환경에서 재현 가능 | `profile-info-card.tsx` / `profile-preferences-card.tsx` — onConfirm 클로저 | `setShowDiff(true)` 시점에 payload를 `confirmedPayloadRef`에 스냅샷 저장, `onConfirm`은 스냅샷만 사용. 또는 `showDiff=true` 중 폼 `disabled` 처리 |
| 12 | Side Effect | `onSuccess`에서 `invalidateQueries` 후 즉시 `setLocaleStore(patch.locale)` 호출 — refetch 완료 전 store 변경으로 `ProfilePage.useEffect`가 stale `user.locale`로 store를 덮어쓸 수 있음 (짧은 순간 이중 역방향 업데이트) | `profile-preferences-card.tsx:59-61` | `ProfilePage.useEffect`의 locale sync만 신뢰하고 `onSuccess`에서 `setThemeStore`만 직접 호출 검토 (즉각 UX 반영 요구 시 현행 유지 합리적) |
| 13 | Testing | `profile-preferences-card.test.tsx`에서 locale 변경 → diff 모달 → 확정 흐름에서 `setLocaleStore` 호출 검증 없음 (`setLocaleStoreMock` 정의되어 있으나 미사용) | `profile-preferences-card.test.tsx` | locale "ko"→"en" 변경 후 확정까지 진행하여 `setLocaleStoreMock("en")` 호출 검증 케이스 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Performance | `useQuery` `staleTime` 미설정(기본값 0ms) — 프로필 페이지 재진입 시마다 `/users/me` 재호출 | `profile/page.tsx` | `staleTime: 5 * 60 * 1000` 추가 |
| 2 | Architecture | `ServerTheme = "light" \| "dark"` 동일 타입이 두 파일에 중복 선언 | `profile/page.tsx:21`, `profile-preferences-card.tsx:18` | `@/lib/types/user.ts` 등 공유 모듈로 단일 정의 |
| 3 | Maintainability | `type FormValues = z.infer<typeof schema>` 가 컴포넌트 함수 내부에 선언 | `change-password/page.tsx:55` | 모듈 스코프(컴포넌트 밖)으로 이동 |
| 4 | Architecture | `key={locale}` 강제 리마운트 패턴 — locale 변경 시 폼 입력값 초기화 의존 관계가 암묵적 | `change-password/page.tsx:195` | 주석으로 의도 명시: `// locale change forces remount to re-derive i18n schema` |
| 5 | Security | `data-testid` 속성이 프로덕션 DOM에 잔존 — DOM 구조·필드명 외부 노출 | `confirm-diff-dialog.tsx:65,71`, `profile-info-card.tsx`, `profile-preferences-card.tsx` | `babel-plugin-react-remove-properties`로 프로덕션 빌드 시 제거 또는 `aria-label`/role 셀렉터 사용 |
| 6 | API Contract | `res.data.data ?? res.data` 이중 응답 포맷 처리 — 서버 응답 스키마 혼용 가능성 | `profile/page.tsx` | `apiClient` 인터셉터에서 정규화 처리 |
| 7 | API Contract | `name` dirty 판정은 `.trim()` 비교이나 PATCH payload는 raw 값 전송 — 공백만 추가 시 dirty=false, raw 공백 값 미전송 불일치 | `profile-info-card.tsx:51`, `mutation.mutateAsync` | `mutation.mutateAsync({ name: name.trim() })` |
| 8 | Maintainability | `if (patch.theme) / if (patch.locale)` — truthy 검사가 undefined 체크 의도를 불명확하게 표현 | `profile-preferences-card.tsx:73-74` | `if (patch.theme !== undefined)` / `if ('theme' in patch)` |
| 9 | Dependency | `import type React from "react"` 미사용 임포트 | `profile-info-card.test.tsx:4` | 해당 라인 제거 |
| 10 | Documentation | `useMemo` deps eslint-disable 억제 근거 미기재 — `themeLabel`/`localeLabel`이 `t`에만 의존한다는 안전 근거가 없음 | `profile-preferences-card.tsx` | 억제 라인 위에 근거 주석 추가, 또는 두 함수를 `useMemo` 내부에 인라인하여 suppression 제거 |
| 11 | Side Effect | `sidebar.profile` i18n 키 값 변경("Profile" → "My Profile") — 사이드바·팝업 메뉴 등 외부 consumer에 조용히 전파 | `en.ts:101`, `ko.ts:97` | `grep -r "sidebar\.profile"` 로 모든 사용처 확인 |
| 12 | Testing | `fireEvent` 사용 — 실제 브라우저 이벤트 흐름(focus/blur 순서) 미시뮬레이션. 현재 `mode: "onSubmit"` 에서는 무해하나 `onBlur` 모드 변경 시 false positive | 전체 테스트 파일 | `@testing-library/user-event` 의 `userEvent` 로 교체 권장 |
| 13 | Testing | `profile/page.tsx` 직접 테스트 없음 — 카드 조립·로딩/오류 상태·`useEffect` store 동기화 로직 미검증 | `profile/page.tsx` | page 레벨 통합 테스트 추가 |
| 14 | Testing | 동일 `waitFor` 블록을 분리 사용 — 첫 번째 완료 후 두 번째가 별도 폴링 사이클 시작, 불필요한 테스트 시간 증가 | `profile-info-card.test.tsx:99-106`, `profile-preferences-card.test.tsx:117-124` | 한 `waitFor` 블록으로 합치기 |
| 15 | Requirement | `confirmPassword` 빈 값 오류 메시지가 `t("profile.enterNewPassword")` — 어느 필드 오류인지 모호 | `change-password/page.tsx:48` | `t("profile.enterConfirmPassword")` 전용 키 추가 |
| 16 | Concurrency | 성공 후 `router.push` 중 `finally { setIsPending(false) }` 호출 — 이동 중 컴포넌트에 상태 쓰기 (React 18에서는 런타임 오류 없음) | `change-password/page.tsx:75` | `router.push` 이전에 `setIsPending(false)` 이동 또는 현행 허용 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Testing | **MEDIUM** | i18n mock 전무(CRITICAL), API 오류 경로 미검증, 취약한 버튼 셀렉터 |
| Requirement | **MEDIUM** | spec 명시 "모달 닫힘 시 theme 원복" 미충족, locale 확정 테스트 누락 |
| Security | **LOW** | 서버 에러 메시지 직접 노출, 비밀번호 복잡도 미검증 |
| Architecture | **LOW** | 쿼리 키 암묵적 결합, `axiosMessage` 3중 복제, 타입 중복 |
| Maintainability | **LOW** | `axiosMessage` 3중 복제, 취약한 버튼 셀렉터, eslint-disable 억제 |
| Concurrency | **LOW** | diff 다이얼로그 open 중 폼 수정 가능 → payload 불일치 |
| Performance | **LOW** | `staleTime` 미설정, eslint-disable 억제 패턴 |
| Side Effect | **LOW** | `setLocaleStore` 조기 호출, `sidebar.profile` 라벨 전파 |
| API Contract | **LOW** | name trim 미처리, 이중 응답 포맷 처리 |
| Documentation | **LOW** | eslint-disable 근거 미기재, `axiosMessage` 위치 포인터 없음 |
| Dependency | **LOW** | `axiosMessage` 3중 복제, 미사용 `import type React` |
| Scope | **LOW** | eslint-disable 억제, 미사용 임포트 |
| Database | **NONE** | 해당 없음 (프론트엔드 전용 변경) |

---

## 발견 없는 에이전트

| 에이전트 | 비고 |
|----------|------|
| Database | 변경 범위가 프론트엔드 전용, DB 관련 코드 없음 |

---

## 권장 조치사항

1. **[즉시] i18n mock 전역 추가** — vitest setup 파일 또는 4개 테스트 파일 상단에 `vi.mock("@/lib/i18n", ...)` 추가. CI 전체를 깨뜨릴 수 있는 유일한 CRITICAL 항목.

2. **[즉시] diff 모달 dismiss 시 theme store 원복** — `ConfirmDiffDialog`의 `onClose`에 `setThemeStore(user.theme)` 추가. spec §2.0 명시 조건 미충족.

3. **[단기] API 오류 경로 테스트 추가** — 3개 컴포넌트에 `mockRejectedValueOnce` 케이스 + `toast.error` 호출 검증. locale 확정 경로(`setLocaleStoreMock`) 검증도 함께.

4. **[단기] 취약한 버튼 셀렉터 교체** — `confirm-diff-dialog.tsx` 저장 버튼에 `data-testid="diff-confirm-save"` 추가 후 테스트 `getByTestId` 사용.

5. **[단기] `axiosMessage` 공유 유틸 추출** — `@/lib/api/errors.ts`로 추출. `axios` 직접 임포트 중복, 보안 정책 변경 시 drift 위험도 함께 해소.

6. **[단기] 쿼리 키 상수화** — `USER_PROFILE_QUERY_KEY` 상수로 부모-자식 암묵적 결합 제거.

7. **[중기] `name` PATCH payload trim** — `mutation.mutateAsync({ name: name.trim() })`. dirty 판정 기준과 실제 전송 값의 불일치 해소.

8. **[중기] `useQuery` staleTime 설정** — `staleTime: 5 * 60 * 1000` 추가로 페이지 재진입 시 불필요한 API 호출 제거.

9. **[중기] eslint-disable 억제 제거** — `themeLabel`/`localeLabel`을 `useMemo` 내부에 인라인하거나 `useCallback`으로 안정화. suppression 및 관련 의존성 문제 동시 해소.

10. **[선택] 비밀번호 복잡도 강화** — 백엔드 동일 정책 전제 하에 zod schema에 복잡도 regex 추가.