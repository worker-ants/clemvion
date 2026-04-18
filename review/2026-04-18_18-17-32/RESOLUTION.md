# Code Review 조치 내역 — i18n 2차 (편집기/[id] 페이지 마이그레이션 리뷰)

## 반영한 조치

### Warning
1. **두 `useEffect` 통합 (#6) + `setLocale`/`initFromStorage` 원자성 (#7, #17)**
   - `locale-sync.tsx`: 두 effect를 하나로 합치고 우선순위를 주석으로 명시 — `user.locale` 이 유효하면 그것을, 그렇지 않으면 `initFromStorage()` 로 폴백. 마운트 시 중복 `applyHtmlLang` / `localStorage` 호출을 제거.
   - `locale-store.ts`: `setLocale`, `initFromStorage` 모두 동일한 순서(`applyHtmlLang` → `localStorage` → `set`)로 통일. zustand subscriber 가 DOM·storage 가 반영된 상태를 본 뒤 state 변경 알림을 받도록 재정렬.

2. **interpolate 누락 파라미터 경고 (#8)** — `core.ts` 의 `interpolate` 가 `NODE_ENV === "development"` 에서 누락 키마다 `console.warn` 을 발생시킴. production 은 영향 없음.

3. **`Dict` 타입 분리 (#11)** — `src/lib/i18n/dict/types.ts` 신설. `ko.ts` 는 `Dict` 를 `types.ts` 에서 재노출하고, `en.ts` 는 더 이상 `ko.ts` 를 직접 import 하지 않음. 비대칭 언어 의존성 해소.

4. **정규식 매 호출 재생성 제거 (#12)** — `core.ts` 상단에 `INTERPOLATION_RE` 모듈 상수 추가. `interpolate` 가 이 상수를 재사용.

5. **ko locale 이중 순회 제거 (#13)** — `translate` 가 `locale === DEFAULT_LOCALE` 이면 폴백 `resolve` 호출을 건너뛰도록 변경.

6. **`applyHtmlLang` DOM 불필요 갱신 제거 (#14)** — 현재 `document.documentElement.lang` 과 값이 같으면 no-op. 잦은 setLocale 호출 시 MutationObserver 스팸 방지.

7. **서버 스냅샷 하드코딩 (#16)** — `i18n/index.ts` 의 `useT`/`useLocale` server snapshot 이 `DEFAULT_LOCALE` 상수 참조. 향후 기본 로케일 변경 시 자동 반영.

8. **JSDoc 보완 (#15, INFO #10, INFO #12, INFO #13)**
   - `dict/types.ts`, `core.ts` 의 `PathInto` / `INTERPOLATION_RE` / `translate` / `interpolate` 에 한 줄씩 설명 추가.
   - `locale-store.ts` 의 `applyHtmlLang` / `readStoredLocale` / catch 블록(`/* localStorage unavailable (e.g. private mode) */`) 이유 주석.
   - `en.ts` 상단에 "structural contract" 설명 주석.
   - `locale-sync.tsx` 에 우선순위/로그아웃 정책 JSDoc.

### Testing
9. **`locale-store.test.ts` 확장** — (Warning #3, #4, INFO #3)
   - `QuotaExceededError` 시 storage 예외를 throw 해도 state/DOM 은 업데이트되는 케이스.
   - 잘못된 값 폴백 시 `document.documentElement.lang === "ko"` 검증.
   - `afterEach` 에 `document.documentElement.lang = ""` 초기화 추가.

10. **`locale-sync.test.tsx` 확장** — (Warning #1, #2, #5, INFO #2)
    - mount 시 `document.documentElement.lang === "en"` 검증.
    - 사용자 로그아웃(`user → null`) 후 직전 locale 유지 확인.
    - 인증된 사용자 locale 양방향 전환(en ↔ ko) 검증.
    - `localStorage === "ko"` + `user.locale === "en"` 통합 시나리오 — 사용자 profile 이 localStorage 를 이긴다.
    - 알 수 없는 locale 값이 들어왔을 때는 기존 저장값을 유지.

### Requirement #9 — 로그아웃 locale 정책 명시
- `LocaleSync` JSDoc 에 "로그아웃 시 마지막 locale 유지" 정책을 문서화.
- 신규 테스트로 회귀 방어 (Testing #10 의 로그아웃 케이스).

## 이월한 사항

- **Architecture #10 (`i18n` → `auth` 의존)** — `LocaleSync` 는 `lib/i18n/` 에 위치하지만 `useAuthStore` 를 `useAuthStore((s) => s.user?.locale)` 로 selector 호출만 하고 domain 데이터를 저장/가공하지 않음. 즉 `i18n` 은 auth 에 대한 데이터 의존이 아닌 *구독* 의존이며, 반전하려면 콜백 주입 구조가 필요해 비용 대비 이득이 작다고 판단. 후속 대규모 리팩터링으로 분리.
- **Maintainability #15 의 `WidenString` 문서화** — `dict/types.ts` 로 이동하면서 유틸 타입에 6줄 JSDoc 추가. 이것으로 충족한다고 간주.
- **INFO #4 (`LOCALES` → `Locale` 타입 파생)** — 현재 `Locale = "ko" | "en"` 은 리터럴 유니온이고 `LOCALES` 는 런타임 값이라 분리되어 있음. 파생 타입(`type Locale = typeof LOCALES[number]`)으로 변경 시 `isLocale` narrowing 동작이 미묘하게 달라져 후속 작업으로 이월.
- **INFO #6 (SSR hydration mismatch)** — 쿠키 기반 로케일 협상은 middleware 수정을 수반하므로 별도 커밋으로 분리.
- **INFO #11 (spec/README i18n 문서화)** — 별도 DOCUMENTATION 작업으로 분리.
- **INFO #14 (`GET /users/me` 응답 `locale` 필드 API 계약)** — `isLocale` 가드로 방어 중이므로 즉각 조치 불필요. 백엔드 스키마 정비 시 정리.

## 테스트 & 빌드 검증

- `npm run lint` — 통과 (0 errors, 0 warnings)
- `npm test` — 817/817 통과 (신규 locale-store 7건, locale-sync 6건 포함)
- `npm run build` — 통과 (Next.js 16 webpack, 48 페이지 정적 생성)
