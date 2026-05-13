# 코드 리뷰 조치 결과 — /profile 안전성 개선

> 리뷰 세션: `review/2026-05-13_08-07-24/SUMMARY.md`
> 대상 커밋: `a9ad7cdf` (spec) + `a35885bc` (구현) → 본 RESOLUTION 직후 한 커밋으로 정리

## 조치 요약

CRITICAL 1건, WARN 13건, INFO 16건 중 코드/테스트 변경이 필요한 항목을 일괄 처리. 정책 결정·기존 컨벤션 사안은 사유 명시 후 보류.

## 처리한 이슈

### CRITICAL

| # | 카테고리 | 조치 | 변경 위치 |
|---|----------|------|-----------|
| C1 | Testing | 4개 테스트 파일 모두에 `vi.mock("@/lib/i18n", ...)` 추가 — `ko` dict 를 lookup 해 한국어 라벨을 그대로 반환. zustand store(`useLocale`)의 `.subscribe/.getState` 의존성이 useT 자체를 mock 하면서 해소됨 | `confirm-diff-dialog.test.tsx`, `profile-info-card.test.tsx`, `profile-preferences-card.test.tsx`, `change-password.test.tsx` |

### WARN

| # | 카테고리 | 조치 | 변경 위치 |
|---|----------|------|-----------|
| W1 | Requirement / Concurrency | spec §2.0 "모달 닫힘 시 라이브 프리뷰 원복" 충족 — `ProfilePreferencesCard.handleDiffClose` 신설하여 `setThemeStore(user.theme)` 호출 후 `setShowDiff(false)` | `profile-preferences-card.tsx` |
| W2 | Testing | API 오류 경로 케이스 추가 (`mockRejectedValueOnce` + `toast.error` 호출 검증 + 편집 모드 유지 검증) | `profile-info-card.test.tsx`, `profile-preferences-card.test.tsx`, `change-password.test.tsx` |
| W3 | Testing | `ConfirmDiffDialog` `onConfirm` reject 후 confirm 버튼 재활성화 케이스 추가. 함께 `ConfirmDiffDialog.handleConfirm` 가 reject 를 swallow 하도록 변경(부모가 toast 처리 책임 — React event handler unhandled rejection 차단) | `confirm-diff-dialog.tsx`, `confirm-diff-dialog.test.tsx` |
| W4 | Testing | C1 의 i18n 전역 mock 에 `useLocale` 도 함께 mock 되어 `ChangePasswordPage` outer wrapper `key={locale}` 의존성 해소 | `change-password.test.tsx` |
| W5 | Testing | API 오류 케이스 안에서 submit 버튼 재활성화(`expect(submitBtn).not.toBeDisabled()`) 검증 추가 | `change-password.test.tsx` |
| W6 | Testing / Architecture | `ConfirmDiffDialog` 의 cancel/confirm 버튼에 `data-testid="diff-cancel"` / `data-testid="diff-confirm"` 부여. 모든 테스트의 `getAllByRole(...)[1]` 취약 셀렉터를 `getByTestId("diff-confirm")` 으로 교체 | `confirm-diff-dialog.tsx`, `profile-info-card.test.tsx`, `profile-preferences-card.test.tsx`, `confirm-diff-dialog.test.tsx` |
| W7 | Maintainability / Architecture | `axiosMessage` 3중 복제를 `@/lib/api/errors.ts` 단일 export 로 추출. 3개 컴포넌트가 모두 공유 모듈에서 import. `axios` 직접 import 도 함께 정리 | `lib/api/errors.ts` 신규, `change-password/page.tsx`, `profile-info-card.tsx`, `profile-preferences-card.tsx` |
| W8 | Architecture | 쿼리 키 암묵적 결합 해소 — `USER_PROFILE_QUERY_KEY` 상수를 `lib/api/users.ts` 에 추가. `ProfilePage`, `ProfileInfoCard`, `ProfilePreferencesCard` 모두 이 상수 import | `lib/api/users.ts`, `profile/page.tsx`, `profile-info-card.tsx`, `profile-preferences-card.tsx` |
| W11 | Concurrency | diff 모달 열린 사이의 폼 입력 → payload 불일치 위험 해소 — `confirmedNameRef` / `confirmedPatchRef` 로 모달 open 시점에 payload 스냅샷 캡처. `mutateAsync` 는 ref 값만 사용 | `profile-info-card.tsx`, `profile-preferences-card.tsx` |
| W13 | Testing | locale 변경(ko→en) → diff 확정 → `setLocaleStoreMock("en")` 호출 검증 케이스 추가 | `profile-preferences-card.test.tsx` |

### INFO (가벼운 정리)

| # | 조치 |
|---|------|
| I1 | `ProfilePage.useQuery` 에 `staleTime: 5 * 60 * 1000` 추가 — 페이지 재진입 시 불필요한 `/users/me` 호출 제거 |
| I2 | `ServerTheme` 타입을 `lib/api/users.ts` 로 이동, `ProfilePage` 와 `ProfilePreferencesCard` 가 공유 import |
| I3 | `ChangePasswordPage` 의 `FormValues` 를 모듈 스코프 `interface` 로 이동 |
| I4 | `ChangePasswordPage` outer wrapper 의 `key={locale}` 의도 주석 추가 (zod 스키마 재빌드 + 입력 초기화) |
| I7 | `ProfileInfoCard` PATCH payload 가 `name.trim()` 사용 — dirty 판정 기준과 전송 값 일치 |
| I8 | `if (patch.theme)` → `if (patch.theme !== undefined)` 로 의도 명시 (`ProfilePreferencesCard.onSuccess`) |
| I9 | `profile-info-card.test.tsx` 의 미사용 `import type React` 제거 |
| I10 | `useMemo` `eslint-disable-next-line react-hooks/exhaustive-deps` 억제 제거 — `themeLabel`/`localeLabel` 헬퍼를 `useMemo` 콜백 안으로 인라인 (`ProfilePreferencesCard`) |
| I14 | `waitFor` 분리 호출을 한 블록으로 합쳐 폴링 사이클 절감 (`profile-info-card.test.tsx`, `profile-preferences-card.test.tsx`) |
| I15 | `enterConfirmPassword` 별도 i18n 키 신설 (ko/en) — confirmPassword 빈 값 메시지가 "새 비밀번호 입력" 과 혼동되던 문제 해소 |
| I16 | `ChangePasswordPage.onSubmit` 의 `setIsPending(false)` 를 `router.push` 이전으로 이동 (성공·실패 양쪽). React 18 에서는 무해하나 의도 명시 |

### 추가 정리

- `ProfilePreferencesCard` 의 `useEffect` 동기화 제거 — `react-hooks/set-state-in-effect` lint 규칙 위반 + view 모드는 `user.theme/locale` 을 직접 표시하므로 useEffect 자체가 불필요. 동기화 정책은 주석으로 명시.
- 모든 컴포넌트의 `mutation.onError` 가 `setShowDiff(false)` 호출 — 에러 발생 시 모달 자동 닫고 form 으로 복귀해 사용자 재시도 경로 확보.

## 보류한 이슈 (사유 명시)

| # | 카테고리 | 사유 |
|---|----------|------|
| W9 | Security (백엔드 에러 메시지 toast 직접 노출) | 본 프로젝트 다른 컴포넌트(2FA, sessions 등)도 동일하게 `axiosMessage` 로 백엔드 메시지를 toast 노출. 패턴 자체를 바꾸려면 별도 정책 결정 + 전 영역 적용 필요. 본 작업 범위 밖. |
| W10 | Security (비밀번호 복잡도) | 백엔드 `change-password.dto.ts` 가 `min(8) max(100)` 만 검증. frontend 만 복잡도 강화하면 정합성 깨짐. spec 개정 + 백엔드 동기 변경이 선행되어야 함 — `project-planner` 사안. |
| W12 | Side Effect (`setLocaleStore` 조기 호출 race) | 즉각 UX 반영(toast 직후 locale 적용)을 위해 의도된 동작. 권장 사항도 "현행 유지 합리적" 명시. |
| I5 | Security (`data-testid` 프로덕션 잔존) | `babel-plugin-react-remove-properties` 도입은 build 설정 변경이라 본 작업 범위 밖. 별도 plan 가치 있음. |
| I6 | API Contract (`res.data.data ?? res.data`) | 기존 `apiClient` 응답 처리 컨벤션 (다른 페이지 동일). 인터셉터 정규화는 전 영역 영향 — 별도 작업. |
| I11 | Side Effect (`sidebar.profile` 라벨 변경 영향 grep) | `grep -rn "sidebar\.profile" frontend/src` 로 재확인 — 사이드바 팝업 1곳 만 사용. 영향 없음 확인 완료. |
| I12 | Testing (`fireEvent` → `userEvent`) | 본 작업 범위 외, 전체 테스트 코드 영향. 별도 마이그레이션 작업. |
| I13 | Testing (`profile/page.tsx` 직접 통합 테스트 추가) | 본 작업의 신규 카드 컴포넌트는 단위 테스트로 충분히 보호. page 레벨 통합 테스트는 가치 있으나 현재 다른 page (auth/sessions/security) 도 page-level 테스트가 없어 컨벤션상 본 작업의 필수 범위 밖. |

## 검증

- `cd frontend && npm run lint` — 0 errors
- `cd frontend && npx vitest run "src/app/(main)/profile"` — 27/27 통과
- `cd frontend && npx vitest run` — 1276/1277 (사전 회귀 1건은 `plan/in-progress/executions-list-test-regression.md` 로 분리, 본 변경과 무관)
- `cd frontend && npm run build` — 통과
- backend 변경 없음 → e2e 영향 없음
