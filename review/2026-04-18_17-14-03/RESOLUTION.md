# Code Review 조치 내역 — i18n 적용

## 반영한 조치

### Critical
1. **`useEffect` deps 에서 `t` 제거 → API 중복 호출 차단**
   - `src/app/(auth)/verify-email/verify-email-content.tsx`: `useEffect` deps 정리, 토스트/에러 메시지는 `useLocaleStore.getState()` + `translate()` 조합으로 시점 캡처.
   - `src/app/(main)/invitations/accept/accept-invitation-content.tsx`: 동일하게 처리.
2. **Zod 스키마 `useMemo` + locale `key` 리마운트 → 폼 에러 메시지 locale 전환 대응**
   - `login-form.tsx`, `register-form.tsx`, `forgot-password-form.tsx`, `reset-password-form.tsx`: 스키마를 `useMemo(() => z.object(...), [t])` 로 감싸고, 내부 구현을 `*FormInner` 로 분리 후 외부에서 `const locale = useLocale();` + `<Inner key={locale} ... />` 로 감쌌다. `useForm` 의 resolver 캡처 이슈로 인한 stale 메시지 문제 해소.

### Warning
3. **`Section` 컴포넌트 dead code 제거** — `integrations/page.tsx` 에서 `t: TFunction` prop과 `void t;` 구문 삭제. 호출부도 정리.
4. **`STATUS_FILTERS` 전용 키 분리** — `integrations.statusAll` 키를 `dict/ko.ts`, `dict/en.ts` 에 추가하고 `STATUS_FILTERS[0]` 가 `integrations.scopeAll` 을 재사용하던 부분을 `integrations.statusAll` 로 교체.
5. **RSC 호환성을 위해 `i18n/index.ts` 분리**
   - `src/lib/i18n/core.ts` 신설: 순수 함수 `translate()` 와 타입만 포함 (no `"use client"`). 서버 유틸/테스트에서 직접 사용 가능.
   - `src/lib/i18n/index.ts`: `"use client"` 유지하되 hooks(`useT`, `useLocale`) 만 담당하고 `translate` 는 `./core` 에서 재노출.
6. **`date.ts` 클라이언트 경계 명시** — 파일 상단에 `"use client"` 추가. `translate` 는 `@/lib/i18n/core` 에서 직접 import 해 hooks 파일에 대한 의존을 제거.
7. **Profile locale 즉시 반영 제거** — `profile/page.tsx` 의 `<select>` `onChange` 에서 `setLocaleStore(next)` 호출 삭제. `setLocaleStore` 는 저장 성공 시점(`handleSave` 내 `await apiClient.patch("/users/me", dirtyProfile);` 성공 후)에서만 호출되도록 축소. 저장 실패 시 UI locale 이 서버와 불일치되는 문제 해결.
8. **JSDoc 추가** — `i18n/core.ts` 의 `translate` 와 `i18n/index.ts` 의 `useT`, `useLocale` 에 폴백/리렌더 동작 설명 JSDoc 추가.

### Testing
9. **`locale-store.test.ts` 신규 작성** — 기본값, localStorage 영속성, `document.documentElement.lang` 갱신, 잘못된 값 폴백, subscriber 동작 6개 케이스.
10. **`locale-sync.test.tsx` 신규 작성** — localStorage 초기화, `user.locale` 동기화, 잘못된 locale 값 무시 3개 케이스. (`act()` 로 외부 상태 변경 감싸기)
11. **`formatDuration` 테스트 추가** — ms/s/m 분기 각각 ko/en 양쪽 + store 기본값 케이스 4개 추가.
12. **i18n 핵심 동작 테스트** — `i18n/__tests__/i18n.test.ts` 작성 (리뷰 이전에 작업한 13개 케이스, 본 조치 직전 추가).
13. **기존 `date.test.ts` 수정** — 모든 `timeAgo`/`formatDate` 호출에 `"en"` locale 을 명시적으로 전달해 한국어 기본값 환경에서 안정적 통과. Korean locale 경로 1개 케이스도 추가.

## 의도적으로 이월한 사항 (별도 작업)

- **Warning #10 (Register form null-byte sentinel 단순화)** — 현재 방식으로도 기능은 정상 동작하고 리뷰에서도 "런타임 오류 가능"은 번역 키 포맷이 깨졌을 때의 가정이다. 본 조치에서는 주석으로 의도를 명시하는 선에서 마무리하고, 차기 작업에서 번역 키 포맷을 `{termsLink}/{privacyLink}` 스타일로 단순화하거나 React 컴포넌트 인라인 삽입 방식으로 재설계 예정.
- **Warning #11 (`formatDuration` 함수명 충돌)** — `execution-status.ts` 버전은 `null` 처리와 소수점 초 포맷을 지원한다. 본 조치에서는 dashboard 가 `date.ts` 버전을 사용하도록 이미 전환되어 있고 `durationMs != null` 체크가 호출부에 있어 기능상 문제는 없다. 명명 통합은 별도 리팩터링으로 분리.
- **Maintainability #12 (SSR hydration mismatch)** — 초기 SSR 은 `"ko"` 기본값으로 렌더되고 클라이언트에서 `LocaleSync` 가 동기화한다. hydration mismatch 는 `<html suppressHydrationWarning>` 로 흡수되며 (이미 `layout.tsx` 에 설정), 사용자가 영어를 선택한 경우 마운트 직후 깜박임이 1회 발생할 수 있다. 쿠키 기반 서버 locale 전달로 완전 해결하려면 middleware 수정이 필요해 범위 밖으로 두었다.
- **INFO #6 (spec/README 문서화)** — 별도 문서 커밋으로 분리 예정.
- **INFO #8 (주석 변경 혼입)** — `login-form.tsx`, `accept-invitation-content.tsx` 의 한국어 주석 영어 번역은 본 변경에서 의도적으로 유지. 한국어 코멘트에 포함된 한국어 문자열이 i18n 과 무관하게 남아 있지 않도록 정리한 것이므로 롤백 없이 진행.

## 테스트 & 빌드 검증

- `npm run lint`: 통과 (0 errors, 0 warnings)
- `npm test`: 810/810 통과 (+26 신규 케이스: locale-store 6, locale-sync 3, formatDuration 4, i18n core 13)
- `npm run build`: 통과 (Next.js 16 webpack 빌드, 48 페이지 정적 생성 포함)
