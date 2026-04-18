# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — i18n 핵심 인프라(`translate()`, locale store)에 대한 테스트 전무, i18n 안티패턴(문장 분리) 및 아키텍처 설계 이슈 다수 존재

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 | `translate(locale, key, params)` 핵심 함수에 대한 단위 테스트 전무. missing key → DEFAULT_LOCALE 폴백 → key 반환 체인 및 파라미터 보간(`{{ param }}`) 로직이 미검증 상태 | `src/lib/i18n/core.ts` | 정상 번역 / missing key 폴백 / 다국어 폴백 / 파라미터 보간 케이스를 포함한 전용 단위 테스트 작성 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 아키텍처 / 유지보수 | **i18n 문장 분리 안티패턴** — `attentionPrefix` + `attentionSuffix` 두 키로 문장을 쪼개고 중간에 동적 값 삽입. 언어마다 어순이 달라 번역 불가 상황 발생 가능. 기존 영어 단수/복수 처리(`integration` vs `integrations`)도 이 과정에서 소실됨 | `integrations/page.tsx` — attention banner | 단일 키 + 파라미터 보간으로 통합: `t("integrations.attentionBanner", { count: attentionCount })` |
| 2 | 아키텍처 | **Inner/Outer 컴포넌트 패턴 4중 반복** — `key={locale}` 강제 리마운트를 위한 Inner/wrapper 분리 패턴이 4개 폼 파일에 동일하게 중복됨 | `forgot-password-form.tsx`, `login-form.tsx`, `register-form.tsx`, `reset-password-form.tsx` | `withLocaleRemount<P>(Component)` HOC로 추상화 |
| 3 | 아키텍처 | **제네릭 UI 컴포넌트의 i18n 직접 의존** — 재사용 가능 UI 컴포넌트들이 `useT()`를 직접 호출해 i18n 시스템에 강결합. 테스트 시 locale store mock 필수 | `shared.tsx` (`KeyValueEditor`), `button-list-editor.tsx`, `field-help.tsx` | 번역된 문자열을 prop으로 주입받는 방식으로 변경하거나, 최소한 prop으로 override 가능하게 유지 |
| 4 | 아키텍처 / 의존성 | **`translate` 임포트 경로 불일치** — `editor-loader.tsx`만 내부 모듈 `@/lib/i18n/core`를 직접 참조, 나머지는 공개 API `@/lib/i18n` 사용 | `editor-loader.tsx` L1 | `import { translate } from "@/lib/i18n"`으로 통일 |
| 5 | 성능 / 유지보수 | **`useMemo([t])` 의존성의 안정성 불확실** — `useT()`가 렌더마다 새 `t` 참조를 반환하면 Zod 스키마가 매 렌더에 재생성되어 react-hook-form 내부 상태 재초기화 유발 가능 | `forgot-password-form.tsx`, `login-form.tsx`, `register-form.tsx`, `reset-password-form.tsx` | `useT()`가 `useCallback`으로 `t`를 안정화하는지 확인. 불확실하면 `useMemo(() => ..., [locale])`로 의존성 명시 |
| 6 | 부작용 | **`key={locale}` 폼 리마운트 시 상태 소멸** — 로케일 전환 시 폼 전체 상태(입력값, 에러, `isLoading`)가 초기화됨. 특히 `ResetPasswordForm`의 `setTimeout(() => router.push(...), 3000)` 진행 중 전환 시 타이머 유실 위험 | 4개 auth form 파일 | 폼 진행 중 로케일 변경 비활성화 또는 `isLoading`·`isSubmitted` 상태에서 locale switcher disabled 처리 |
| 7 | 테스트 | **locale store 동작 미검증** — localStorage 퍼시스트, `<html lang>` 속성 갱신, 초기값 결정 로직(user.locale → localStorage → `ko`) 테스트 없음 | `src/lib/stores/locale-store.ts` | zustand store 단위 테스트로 초기화 경로, localStorage 연동, lang 속성 갱신 검증 |
| 8 | 테스트 | **`getStatusLabel` 함수 테스트 없음** — 정적 `STATUS_LABEL` 객체에서 함수 호출로 인터페이스 변경, 전체 `ExecutionStatus` 값에 대한 올바른 label 반환 여부 미검증 | `src/lib/utils/execution-status.ts` | 모든 status 값 및 로케일별 출력값 검증 테스트 추가 |
| 9 | 테스트 | **`formatDuration` 동작 변경의 암묵적 처리** — `dashboard/page.tsx` 로컬 구현 제거 후 공유 유틸 교체로 출력 포맷 `"1.0s"` → `"1s"` 변경되었으나 `formatDuration` 자체 단위 테스트 없이 기존 테스트만 조용히 수정됨 | `execution-list-page.test.tsx:104`, `dashboard/page.tsx` | `formatDuration` 독립 단위 테스트 작성 (경계값: ms, 초, 분) |
| 10 | 테스트 | **`LocaleSync`, `DocHeader`, `DocBodyNotice` 신규 컴포넌트 테스트 없음** — `LocaleSync`는 user.locale→store 동기화 핵심 컴포넌트, `DocHeader`는 로케일별 title 분기 로직 포함 | `src/lib/i18n/locale-sync.tsx`, `src/components/docs/doc-header.tsx`, `src/components/docs/doc-body-notice.tsx` | `LocaleSync` — user.locale 변경 시 store 갱신 검증. `DocHeader` — 로케일별 title 렌더링 검증 |
| 11 | 문서 / 유지보수 | **보안·동작 WHY 주석 제거** — `// We intentionally don't show the error to prevent email enumeration`(보안 의도), `opacity-0 + pointer-events-none + aria-hidden` 조합 이유(접근성 설계), `integration-selector.tsx` fetch 중 깜빡임 방지 주석이 i18n 교체 과정에서 삭제됨 | `forgot-password-form.tsx`, `canvas-empty-state.tsx`, `integration-selector.tsx`, `security/page.tsx` | 코드 동작의 WHY를 설명하는 비기능 주석은 번역 작업과 무관하게 복원 |
| 12 | 문서 | **README에 신규 컴포넌트·`TFunction` 타입 미문서화** — `DocHeader`, `DocBodyNotice`, `@/lib/docs/locale`, `TFunction` 타입이 아키텍처 섹션에서 누락 | `frontend/README.md` — i18n Architecture 섹션 | 아키텍처 다이어그램에 신규 컴포넌트 추가, `TFunction` export 언급 추가 |
| 13 | 테스트 | **테스트 locale 상태 복원(`afterEach`) 누락** — `beforeEach`에서 `locale: "en"` 설정 후 `afterEach`에서 기본값(`ko`) 복원 없음. 동일 프로세스 내 다른 describe 블록 영향 가능성 | 모든 수정된 `__tests__/*.test.tsx` | `afterEach(() => useLocaleStore.setState({ locale: "ko" }))` 추가 또는 README 권장 패턴에 반영 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 동시성 | 비동기 콜백 진입 시점에 locale 스냅샷 캡처 — API 요청 진행 중 언어 전환 시 toast가 이전 locale로 표시될 수 있음 | `verify-email-content.tsx:34`, `accept-invitation-content.tsx:38`, `editor-loader.tsx:27` | 허용 가능한 트레이드오프. 의도된 동작임을 주석으로 명시하거나, toast 호출 직전에 `getState().locale` 재호출로 창 축소 |
| 2 | 부작용 | `STATUS_LABEL` export 제거 여부 미확인 — 다른 파일에서 `STATUS_LABEL`을 직접 import하면 빌드 오류 발생 가능 | `src/lib/utils/execution-status.ts` | 전체 코드베이스에서 `STATUS_LABEL` import 사용처 grep 확인 |
| 3 | 부작용 | `DocBodyNotice` 조건 분기 미확인 — 항상 렌더링되는 구조라면 한국어 사용자에게도 번역 안내 배너 노출 가능 | `docs/[...slug]/page.tsx` | `DocBodyNotice` 구현에서 `locale === 'ko'`일 때 `null` 반환하는지 검증 |
| 4 | 아키텍처 | `getStatusLabel` 내부에서 locale store 직접 참조 가능성 — 유틸리티 레이어가 UI 상태 스토어에 의존하면 레이어 결합도 문제 | `src/lib/utils/execution-status.ts` | `getStatusLabel(status, locale)` 형태로 locale을 인자로 받도록 설계 권장 |
| 5 | 범위 | `formatDuration` 추출이 동작 변경(`"1.0s"` → `"1s"`)을 동반하며 i18n PR에 포함됨 | `dashboard/page.tsx`, `execution-list-page.test.tsx` | 별도 리팩터링 PR로 분리하거나 변경 이유 명시 권장 |
| 6 | 성능 | `summaryCards` 배열이 매 렌더마다 재생성 — 현재 규모(4개)에서 영향 미미 | `dashboard/page.tsx` | `useMemo(() => [...], [t, summary])` 적용 가능하나 필수 아님 |
| 7 | 보안 | 서버 오류 메시지(`error.response?.data?.message`) 직접 UI 노출 — 기존 패턴 유지, 신규 취약점 아님 | `verify-email-content.tsx`, `accept-invitation-content.tsx`, `reset-password-form.tsx` | 허용 목록 기반 필터링 또는 번역된 일반 오류 메시지로 대체 (별도 작업) |
| 8 | 보안 | 번역 키 미등록 시 키 문자열(`"auth.verifyEmail.title"`)이 UI에 그대로 노출 — 앱 구조 정보 경미한 노출 | `README.md` (폴백 정책) | 프로덕션 빌드에서 키 누락 시 빈 문자열 또는 기본값 반환 처리 |
| 9 | 유지보수 | `missingSuffix` 번역 키가 앞 ID 슬라이스와 결합된다는 암묵적 형식 계약이 코드에 숨어있음 | `integration-selector.tsx` | 파라미터 보간 `t("...", { id: value.slice(0, 8) })`으로 변경 |
| 10 | 문서 | `LocaleSync` 마운트 위치(앱 루트 레이아웃)가 README에 미명시 | `frontend/README.md` | `<LocaleSync />` 설명에 마운트 위치 한 줄 추가 |
| 11 | 부작용 | React key prop이 번역 문자열에서 번역 키로 변경 → 로케일 전환 시 불필요한 재마운트 방지, 개선된 동작 | `dashboard/page.tsx:189`, `canvas-empty-state.tsx:70` | 조치 불필요 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| testing | MEDIUM | i18n 핵심 인프라(`translate`, locale store, 신규 컴포넌트) 테스트 전무 |
| architecture | MEDIUM | 문장 분리 안티패턴, Inner/Outer 4중 반복, 제네릭 UI의 i18n 강결합 |
| maintainability | MEDIUM | WHY 주석 삭제, 문장 분리, `useMemo([t])` 전제 조건 불명확 |
| performance | LOW | `useMemo([t])` 안정성, `key={locale}` 폼 리마운트 UX 비용 |
| side_effect | LOW | `key={locale}` 상태 소멸, `STATUS_LABEL` export 제거 여부 미확인 |
| documentation | LOW | 보안·동작 주석 삭제, README 신규 컴포넌트 미문서화 |
| scope | LOW | `formatDuration` 리팩터링이 i18n PR에 혼재 |
| concurrency | LOW | 비동기 콜백 내 locale 스냅샷 캡처 타이밍 |
| dependency | LOW | `editor-loader.tsx` 내부 모듈 직접 참조 |
| security | LOW | 서버 에러 메시지 직접 노출 (기존 패턴) |
| requirement | LOW | attention 배너 단수/복수 처리 손실 |
| database | NONE | 해당 없음 |
| api_contract | NONE | 해당 없음 |

---

## 발견 없는 에이전트

| 에이전트 | 사유 |
|----------|------|
| database | 순수 프론트엔드 i18n 작업으로 DB 변경 없음 |
| api_contract | 백엔드 API 엔드포인트·요청/응답 구조 변경 없음 |

---

## 권장 조치사항

1. **[Critical] `translate()` 단위 테스트 작성** — 폴백 체인(missing key → DEFAULT_LOCALE → key 반환) 및 파라미터 보간(`{{ param }}`) 검증 포함
2. **[Warning] attention 배너 문장 분리 → 단일 키 통합** — `t("integrations.attentionBanner", { count })` 형태로 복수형 처리 복원
3. **[Warning] locale store 및 신규 컴포넌트 테스트 추가** — `locale-store.ts`, `LocaleSync`, `DocHeader`, `DocBodyNotice`, `getStatusLabel` 대상
4. **[Warning] `editor-loader.tsx` import 경로 통일** — `@/lib/i18n/core` → `@/lib/i18n`
5. **[Warning] `useMemo([t])` 안정성 확인** — `useT()`의 `t` 참조 안정성 문서화 또는 `useMemo(() => ..., [locale])`로 의존성 명시
6. **[Warning] 삭제된 WHY 주석 복원** — 이메일 열거 방지 주석, `canvas-empty-state` 접근성 주석, `integration-selector` timing 주석
7. **[Warning] README 보완** — `TFunction` 타입, `DocHeader`/`DocBodyNotice`/`@/lib/docs/locale` 아키텍처 다이어그램 추가
8. **[Warning] Inner/Outer 패턴 HOC 추상화** — `withLocaleRemount<P>()` 도입으로 4개 파일 중복 제거
9. **[Info] `STATUS_LABEL` export 제거 여부 코드베이스 전체 grep 확인** — 빌드 오류 예방
10. **[Info] `DocBodyNotice` 조건 분기 확인** — 한국어 세션에서 `null` 반환하는지 검증
11. **[Info] 테스트 `afterEach` locale 복원 추가** — `useLocaleStore.setState({ locale: "ko" })`