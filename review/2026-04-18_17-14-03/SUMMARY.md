# Code Review 통합 보고서

## 전체 위험도
**HIGH** — locale 변경 시 API 중복 호출 및 폼 유효성 메시지 미갱신 버그가 실사용 시나리오에서 재현 가능하며, 다수의 테스트 누락과 구조적 결함이 동반됨

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Side Effect / Concurrency | `t` 함수가 `useEffect` 의존성 배열에 포함되어 locale 변경 시 이메일 인증·초대 수락 API가 재호출됨. `useT()`는 locale 변경마다 새 함수 참조를 반환하므로 일회성 작업 effect의 deps에 넣으면 중복 실행됨 | `verify-email-content.tsx:57`, `accept-invitation-content.tsx:58` | deps에서 `t` 제거. 에러 메시지는 `translate(currentLocale(), key)` 형태로 호출 시점에 처리하거나 `useRef`로 캡처 |
| 2 | Performance / Correctness | Zod 스키마가 컴포넌트 본문에 정의되어 매 렌더마다 재생성됨. `useForm`은 최초 마운트 시 resolver를 캡처하므로 이후 locale 변경 시 유효성 에러 메시지가 갱신되지 않음 | `forgot-password-form.tsx`, `login-form.tsx`, `register-form.tsx`, `reset-password-form.tsx` | `useMemo(() => buildSchema(t), [t])`로 메모이제이션. locale 전환 시 메시지 갱신이 필요하면 `key={locale}`로 폼 리마운트 검토 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `locale-store.ts` 테스트 파일 없음. localStorage 영속성, `document.documentElement.lang` 갱신, SSR 환경 가드, 잘못된 값 처리 등 사이드이펙트가 많은 모듈임에도 커버리지 부재 | `frontend/src/lib/stores/locale-store.ts` | `locale-store.test.ts` 신규 작성. `vi.stubGlobal` 패턴으로 사이드이펙트 격리 후 각 시나리오 커버 |
| 2 | Testing | `LocaleSync` 컴포넌트 테스트 없음. 앱 진입점에 등록된 컴포넌트로 localStorage 초기화와 `user.locale` 동기화 두 가지 핵심 사이드이펙트를 담당하나 회귀 검증 불가 | `frontend/src/lib/i18n/locale-sync.tsx` | `@testing-library/react`로 렌더링 후 store 상태 검증 |
| 3 | Testing | `formatDuration` 테스트 없음. `dashboard/page.tsx`에서 이관된 함수인데 `date.test.ts`에 전혀 커버되지 않음. ms/s/m 세 분기와 ko/en 번역 각각 미검증 | `frontend/src/lib/utils/date.ts` | `formatDuration(500, "en") → "500ms"`, `formatDuration(5000, "ko") → "5초"` 등 케이스 추가 |
| 4 | Testing | `termsAgreeHtml` null-byte sentinel 파싱 로직 테스트 없음. sentinel 누락·순서 역전 시 `parts[1]`, `parts[2]`가 `undefined`가 되어 런타임 오류 발생 가능 | `register-form.tsx:189-230` | 로직을 독립 유틸 함수로 추출 후 정상/sentinel 누락/순서 반전 케이스 단위 테스트 |
| 5 | Dead Code | `Section` 컴포넌트가 `t: TFunction` prop을 받아 `void t;`로 즉시 무시. 미완성 구현 잔재로 공개 API 오염, 불필요한 prop 드릴링 발생 | `integrations/page.tsx:371` | `t` prop과 `void t;` 모두 제거. 필요 시 `Section` 내부에서 `useT()` 직접 호출 |
| 6 | I18N Correctness | `STATUS_FILTERS`의 "all" 항목이 scope 필터용 키 `"integrations.scopeAll"`을 재사용. 현재는 번역 값이 동일하여 통과되나 향후 변경 시 silent bug | `integrations/page.tsx` — `STATUS_FILTERS[0]` | `"integrations.statusAll"` 전용 키 추가 및 dict 파일 반영 |
| 7 | Architecture | `date.ts`가 `"use client"` 없이 클라이언트 전용 store(`locale-store.ts`)를 임포트. Server Component에서 `timeAgo`/`formatDate` 호출 시 번들러 경계 오류 또는 locale 무시(항상 기본값 반환) | `src/lib/utils/date.ts:1-5` | `date.ts` 상단에 `"use client"` 추가하거나, `translate`/store 의존성을 분리해 서버·클라이언트 양쪽 사용 가능하게 유지 |
| 8 | Architecture | `i18n/index.ts`의 `"use client"` 선언이 순수 함수인 `translate()`의 RSC 사용을 차단. 메타데이터 생성 등 서버 번역이 필요한 경우 사용 불가 | `src/lib/i18n/index.ts:1` | `translate()` + 타입 + dict를 `"use client"` 없는 `core.ts`로 분리. `useT()`/`useLocale()`만 `"use client"` 파일에 유지 |
| 9 | I18N / UX | profile 페이지에서 locale이 `onChange` 시점(저장 전)에 즉시 store에 반영되어 저장 실패 시 서버 locale과 UI locale 불일치. 실패 후 자동 revert 로직 없음 | `profile/page.tsx:289-296` | `onChange`에서는 local state만 업데이트. `setLocaleStore`는 저장 성공 callback에서만 호출 |
| 10 | Architecture | `register-form.tsx`의 약관·개인정보처리방침 링크 렌더링에 null byte(`\u0000`) sentinel 기반 커스텀 파싱 사용. 복잡한 순서 판단 로직으로 번역 플레이스홀더 오류 시 링크 대상 뒤바뀜 위험 | `register-form.tsx:197-229` | `{termsLink}`, `{privacyLink}` 일반 플레이스홀더로 split하거나, `termsText`/`andText`/`privacyText` 3개 분리 키로 단순화 |
| 11 | Dependency | `formatDuration` 함수명 충돌. `date.ts` 버전은 null 미지원(`ms: number`), `execution-status.ts` 버전은 null 처리 + 소수점 초 포맷(`2.5s`). `dashboard/page.tsx`가 `date.ts` 버전으로 교체되어 null 케이스·소수점 포맷 누락 가능 | `date.ts:36` vs `execution-status.ts:31` | 함수명을 `formatDurationLocalized` 등으로 구분하거나 `execution-status.ts` 버전에 i18n 통합. dashboard에서 duration이 null인 케이스 확인 필요 |
| 12 | Maintainability | SSR 서버 스냅샷이 `"ko"`로 하드코딩되어 영어 선택 사용자의 경우 서버 렌더(한국어)와 클라이언트 결과(영어) 불일치로 hydration mismatch 발생 가능 | `i18n/index.ts` — `useT()` 내 `getServerSnapshot` | locale을 쿠키/헤더로 서버에서 읽어 전달하거나, 초기 렌더를 기본 locale로 통일하고 `useEffect`에서 전환하는 구조를 명시적으로 문서화 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `getPasswordStrength`에 `TFunction` 파라미터 추가 후 단위 테스트 없음. 5단계 강도 분기 미검증 | `register-form.tsx:34`, `reset-password-form.tsx:23` | 함수를 별도 파일로 분리 후 단위 테스트 작성 |
| 2 | Testing | `currentLocale()` 기본값 경로(`locale ?? currentLocale()`) 테스트 미작성. 모든 기존 테스트가 `locale` 파라미터를 명시적으로 전달하여 해당 경로 우회 | `date.ts:11-13` | `locale` 파라미터 없이 호출하는 테스트 케이스 추가 |
| 3 | Documentation | 핵심 공개 API(`translate()`, `useT()`, `useLocale()`, `TFunction`, `TranslationKey`)에 JSDoc 없음. 파라미터 설명, 폴백 동작 등 미문서화 | `i18n/index.ts` | 최소한 `translate()`와 `useT()`에 파라미터와 폴백 동작 설명 JSDoc 추가 |
| 4 | Documentation | `register-form.tsx`의 null byte sentinel 방식을 선택한 이유 주석 없음. 언어별 Terms/Privacy 순서가 달라질 수 있다는 맥락 불명확 | `register-form.tsx:197` | 블록 상단에 선택 이유와 sentinel 규칙 설명 주석 추가 |
| 5 | Documentation | Zod 스키마가 컴포넌트 내부에 정의된 이유(`t()` 호출 필요) 주석 없어 리뷰어가 성능 실수로 오해하기 쉬움 | 4개 auth form 컴포넌트 | `// defined inside component to use translated error messages via t()` 주석 추가 (또는 CRITICAL #2 수정으로 해결) |
| 6 | Documentation | spec/README에 i18n 아키텍처 및 번역 키 추가 방법 미문서화. 새 번역 키 추가 시 `dict/ko.ts`와 `dict/en.ts` 동시 수정 필요한 점이 팀 협업 시 누락 가능 | `spec/`, `README.md` | `spec/` 또는 `frontend/README.md`에 i18n 아키텍처와 번역 기여 가이드 추가 |
| 7 | API Contract | `user.locale` 필드에 대한 백엔드 API 계약 가정. `GET /users/me` 응답 스키마에 `locale` 필드 포함 여부 미확인 | `locale-sync.tsx:16`, `profile/page.tsx:63` | `GET /users/me` 응답 타입에 `locale?: Locale` 명시 여부 확인 |
| 8 | Scope | i18n과 무관한 코드 주석 삭제(`accept-invitation-content.tsx:39` 등) 및 한국어 주석의 영어 번역(`login-form.tsx:59`)이 이 PR에 혼입됨 | 다수 파일 | 코드 주석 변경은 별도 커밋으로 분리하거나 복원 |
| 9 | Performance | `dashboard/page.tsx`의 `summaryCards` 배열이 `useMemo` 없이 컴포넌트 본문에 선언되어 매 렌더마다 새 배열·객체 할당 | `dashboard/page.tsx` — `summaryCards` 정의 블록 | `useMemo([summary, t])`로 감싸기 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| testing | HIGH | locale-store·LocaleSync·formatDuration 테스트 누락, Zod 스키마 locale 전환 버그 무검증 |
| side_effect | HIGH | `t`를 useEffect deps에 포함 시 API 중복 호출, date.ts 전역 상태 암묵 의존 |
| performance | MEDIUM | Zod 스키마 매 렌더 재생성(CRITICAL), currentLocale() 반응성 없어 stale UI 발생 |
| architecture | MEDIUM | Zod 스키마 locale 전환 미반응, "use client" 경계 미분리, date.ts 계층 역전 |
| maintainability | MEDIUM | `t`의 useEffect 의존성 API 재호출, Section void t 잔재, SSR 스냅샷 하드코딩 |
| concurrency | MEDIUM | useEffect + t 조합 API 중복 호출, getState() 구독 없어 locale 변경 시 stale 렌더 |
| requirement | MEDIUM | Zod 스키마 locale 전환 미반응, STATUS_FILTERS 잘못된 키, Section void t |
| scope | MEDIUM | Section void t 미완성, STATUS_FILTERS 잘못된 키, null byte 파싱 취약 |
| documentation | MEDIUM | 핵심 공개 API JSDoc 부재, null byte sentinel 패턴 설명 없음 |
| security | LOW | "use client" 모듈 경계 혼용, 서버 에러 메시지 직접 노출 |
| dependency | LOW | date.ts "use client" 경계 문제, formatDuration 함수명 충돌 |
| api_contract | LOW | user.locale API 계약 가정(방어적 처리로 안전) |
| database | NONE | 해당 없음 (프론트엔드 전용 변경) |

---

## 발견 없는 에이전트

- **database** — 데이터베이스 관련 변경 없음

---

## 권장 조치사항

1. **[즉시]** `verify-email-content.tsx`, `accept-invitation-content.tsx`의 `useEffect` deps에서 `t` 제거 — locale 변경 시 인증/초대 API 중복 호출 차단
2. **[즉시]** 4개 auth form의 Zod 스키마를 `useMemo(() => buildSchema(t), [t])`로 메모이제이션 — locale 전환 시 유효성 메시지 미갱신 버그 수정
3. **[즉시]** `integrations/page.tsx` `Section` 컴포넌트에서 `t` prop과 `void t;` 제거
4. **[즉시]** `STATUS_FILTERS`의 "all" 항목 키를 `"integrations.statusAll"`로 분리, dict 파일 반영
5. **[필수]** `locale-store.ts`, `LocaleSync` 컴포넌트 테스트 작성 — 사이드이펙트 핵심 모듈 회귀 보호
6. **[필수]** `formatDuration` 테스트 추가 (ms/s/m 분기 × ko/en)
7. **[필수]** `register-form.tsx` null byte sentinel 로직을 별도 유틸 함수로 추출 + 테스트 (또는 `{termsLink}` 플레이스홀더 방식으로 단순화)
8. **[권장]** `profile/page.tsx`에서 `setLocaleStore` 호출을 저장 성공 callback으로 이동 — 저장 실패 시 locale 불일치 방지
9. **[권장]** `i18n/index.ts`를 `core.ts`(순수 함수, "use client" 없음)와 `hooks.ts`("use client")로 분리 — RSC 호환성 확보
10. **[권장]** `date.ts`에 `"use client"` 추가하거나 서버·클라이언트 locale 의존성 분리 — SSR 안전성 확보
11. **[선택]** `formatDuration` 함수명 충돌 해소 (`execution-status.ts`와 통합 또는 명칭 구분)
12. **[선택]** spec 또는 frontend README에 i18n 아키텍처 및 번역 키 추가 가이드 문서화