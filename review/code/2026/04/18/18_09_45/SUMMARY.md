파일 쓰기가 거부되어 결과를 직접 출력합니다.

---

# Code Review 통합 보고서

> **대상 브랜치**: `i18n`  
> **리뷰 일시**: 2026-04-18  
> **변경 범위**: 프론트엔드 i18n 도입 — 하드코딩된 문자열을 `useT()` / `translate()` 호출로 교체 (50개 파일)

---

## 전체 위험도
**MEDIUM** — 새로운 보안 취약점 없음. 단, 유틸리티 파일의 `"use client"` 추가로 인한 서버 컴포넌트 호환성 파괴 가능성, `formatDuration` 이중 구현의 동작 불일치, 영어 단수/복수 문법 손실이 실사용에서 노출될 수 있는 결함으로 식별됨.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 아키텍처 / 부작용 | `date.ts`, `execution-status.ts`에 `"use client"` 추가로 서버 컴포넌트에서 임포트 불가. 이 유틸리티를 사용하는 서버 컴포넌트가 존재하면 즉각적인 빌드/런타임 에러 발생 | `date.ts:1`, `execution-status.ts:1` | 서버 환경용 순수 함수(locale 파라미터 필수)와 클라이언트 전용 래퍼를 분리하거나, 스토어 접근을 컴포넌트 레이어로 이관하여 `"use client"` 의존 제거 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 유지보수성 / 아키텍처 | `formatDuration`이 `date.ts`와 `execution-status.ts` 두 곳에 중복 구현되며 동작이 다름. `date.ts`는 `Math.floor`(정수 초), `execution-status.ts`는 `toFixed(1)`(소수점). `2500ms`에 대해 각각 `"2s"` / `"2.5s"` 반환 → 대시보드와 실행 목록에서 동일 시간이 다르게 표시 | `date.ts:39`, `execution-status.ts:48` | 단일 정규 구현으로 통합하거나, 목적을 명확히 구분하는 이름 사용. `execution-status.ts`가 `date.ts`의 구현을 재사용하도록 리팩터링 권장 |
| 2 | 유지보수성 | `currentLocale()` 헬퍼가 `date.ts`와 `execution-status.ts`에 동일하게 중복 선언됨 | `date.ts`, `execution-status.ts` | `lib/i18n` 또는 `lib/stores/locale-store.ts`에서 `getCurrentLocale()`을 단일 export하고 두 파일에서 import |
| 3 | 요구사항 / 국제화 | `integrations/page.tsx` attention 배너에서 영어 단수/복수 처리 누락. `attentionCount === 1`일 때 "1 integrations need attention" 문법 오류 발생. `attentionSingle` 번역 키가 존재함에도 미사용 | `integrations/page.tsx:169-175` | `attentionCount === 1 ? t("integrations.attentionSingle") : t("integrations.attentionPrefix")` 분기 적용 |
| 4 | 국제화 안티패턴 | attention 메시지를 `attentionPrefix` + `attentionSuffix`로 분리한 패턴은 어순이 다른 언어에서 번역 불가. JSX 내 보간의 대표적 안티패턴 | `integrations/page.tsx` | `t("integrations.attentionBanner", { count: attentionCount })` 단일 보간 키로 교체 |
| 5 | UX / 아키텍처 | `ForgotPasswordForm`의 `key={locale}` 강제 리마운트로 로케일 변경 시 사용자 입력 내용 전체 소실. login/register/reset-password form에도 동일 패턴 적용됨 | `forgot-password-form.tsx:111-113` 외 auth form | Zod 스키마를 `useMemo([t])`로 격리 유지하되, `key` remount 대신 locale 변경 effect에서 `form.clearErrors()` + `form.trigger()` 재검증 방식 검토 |
| 6 | 문서화 | 다수의 의미있는 인라인 주석이 i18n 리팩터링 부수 효과로 삭제됨. 특히 `forgot-password-form.tsx`의 이메일 열거 방지 **보안 의도 주석** 삭제가 중요 | `forgot-password-form.tsx:~56`, `restore-confirm-dialog.tsx:~29`, `canvas-empty-state.tsx:~35`, `accept-invitation-content.tsx:~36`, `security/page.tsx:~44` | 삭제된 주석 복원, 특히 보안 의도 관련 주석은 필수 복원 |
| 7 | 문서화 | `@/lib/i18n` 신규 모듈의 공개 API 문서 부재: `useT` vs `translate` 사용 기준, 새 번역 키 추가 방법, 지원 로케일 목록, `LocaleSync` 역할이 어디에도 문서화되지 않음 | `frontend/src/lib/i18n/` | `frontend/src/lib/i18n/README.md` 또는 `index.ts` 상단에 사용 가이드라인 작성 |
| 8 | 테스팅 | `formatDate`의 `"date"` format 분기 암묵적 제거 — `"date"` 포맷과 default 포맷이 동등함을 검증하는 테스트 없음 | `date.ts:65-75`, `date.test.ts` | `expect(formatDate(d, "date", "en")).toBe(formatDate(d, undefined, "en"))` 테스트 추가 |
| 9 | 테스팅 | `verify-email-content`, `accept-invitation-content`, `editor-loader`의 비동기 i18n 처리 테스트 없음 — toast 메시지의 locale 정확성 검증 불가 | 해당 컴포넌트 `__tests__` 미존재 | 비동기 성공/실패 시 locale별 toast 메시지를 검증하는 테스트 파일 추가 |
| 10 | 테스팅 | 로케일 전환 시 Zod validation 메시지가 실제로 업데이트되는지 테스트 없음 | auth form 컴포넌트 테스트 미존재 | 로케일 변경 후 빈 폼 제출 시 올바른 언어의 오류 메시지가 표시되는지 검증 |
| 11 | 테스팅 | `i18n.test.ts`에서 필수 인터폴레이션 파라미터 누락 시 처리 미검증 — `{minutes}` 플레이스홀더가 런타임 UI에 그대로 노출될 수 있음 | `i18n/__tests__/i18n.test.ts` | 파라미터 누락 시 동작(플레이스홀더 유지 또는 safe fallback)을 명시적으로 테스트 |
| 12 | 성능 | `useMemo([t])`의 안정성이 `useT()` 구현에 의존 — `t`가 매 렌더마다 새 참조를 반환하면 Zod 스키마가 렌더마다 재생성됨 | `forgot-password-form.tsx` 외 auth form | `useT()`에서 `useCallback`으로 함수 참조를 안정화하거나, 의존성을 `t` 대신 `locale`로 변경 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 동시성 | async 함수 시작 시점에 locale 스냅샷 → await 중 locale 변경 시 toast 메시지가 이전 언어로 표시. 실용적으로 무시 가능한 edge case | `verify-email-content.tsx:37`, `accept-invitation-content.tsx:39`, `editor-loader.tsx:27` | 렌더 시점에 캡처된 `t` 클로저를 콜백에서 그대로 사용 (Rules of Hooks 위반 아님) |
| 2 | 테스팅 | `date.test.ts`에서 `formatDuration(5_000)` → `"5초"` 테스트가 스토어 기본값 `"ko"`를 암묵적으로 가정. 테스트 순서 변경 시 실패 가능 | `date.test.ts:59-61` | `useLocaleStore.setState({ locale: "ko" })`를 해당 테스트에 명시적으로 추가 |
| 3 | 유지보수성 | 7개 테스트 파일 각 `beforeEach`에 `useLocaleStore.setState({ locale: "en" })` 반복. 신규 테스트 추가 시 누락 위험 | 테스트 파일 7개 | `src/test/setup.ts`에 locale 초기화를 전역 `beforeEach`로 추가 |
| 4 | 성능 | 렌더마다 `useLocaleStore.getState().locale` + `translate()` 중복 호출. 20행 테이블에서 40회 이상 store read 누적 가능 | `date.ts`, `execution-status.ts` | 컴포넌트 최상단에서 locale을 한 번 읽어 유틸 함수에 명시적 전달 |
| 5 | 국제화 | `LocaleSync`가 `useEffect`로 locale을 복원하므로 첫 렌더는 항상 기본값 `"ko"`로 표시 (영어 사용자 locale flash) | `providers.tsx:54` | 서비스 특성에 따라 허용 가능. SSR에서 헤더/쿠키로 초기 locale 결정 고려 |
| 6 | 보안 | OAuth 콜백 오류 메시지와 서버 응답 오류 메시지를 직접 UI에 노출. XSS 위험 없으나 내부 정보 노출 가능. 기존 코드 패턴에서 비롯됨 | `callback-content.tsx:57`, `verify-email-content.tsx:43` 등 | 알려진 오류 코드를 화이트리스트로 번역 키에 매핑하거나 제네릭 메시지로 대체 |
| 7 | 문서화 | `ForgotPasswordFormInner` / `ForgotPasswordForm` 이중 컴포넌트 분리와 `key={locale}` 패턴의 이유 주석 없음 | `forgot-password-form.tsx:109-111` | `export function ForgotPasswordForm()` 위에 주석: `// key={locale} forces schema re-init so zod messages use the new locale` |
| 8 | 문서화 | 특수 플레이스홀더(`$now`, `$schedule.id`)가 치환되지 않아야 하는 이유가 테스트에 설명 없음 | `i18n/__tests__/i18n.test.ts` | 한 줄 주석으로 특수 플레이스홀더의 목적 설명 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| side_effect | MEDIUM (CRITICAL 포함) | `"use client"` 추가로 서버 컴포넌트 임포트 차단 가능성, 영어 단수/복수 손실, `formatDuration` 정밀도 불일치 |
| architecture | MEDIUM | 유틸리티→스토어 역방향 의존성, `formatDuration` 이중 구현, remount 과도한 부작용 |
| documentation | MEDIUM | i18n 모듈 공개 API 문서 부재, `"use client"` 제약 미고지, 의미있는 주석 다수 삭제 |
| performance | MEDIUM | 렌더마다 store read 반복, `useMemo([t])` 불안정, `"use client"` 서버 렌더링 최적화 손실 |
| testing | MEDIUM | `formatDuration` 동작 차이 미검증, 비동기 i18n 처리 테스트 누락, locale 전환 remount 테스트 누락 |
| scope | MEDIUM | 보안 의도 주석 삭제, `formatDuration` 출력 형식 변경이 i18n 작업에 혼입, `"use client"` 아키텍처 제약 |
| maintainability | MEDIUM | `formatDuration` 이중 구현, `currentLocale()` 헬퍼 중복, attention 메시지 분리 안티패턴 |
| requirement | MEDIUM | 영어 단수/복수 문법 오류, `formatDuration` 동작 불일치, `"use client"` 서버 제약 |
| security | LOW | 기존 패턴에서 비롯된 오류 메시지 직접 노출, 이번 PR이 새로 도입한 보안 문제 없음 |
| concurrency | LOW | 비동기 locale 스냅샷 타이밍, `key={locale}` remount 중 미완료 요청 |
| dependency | LOW | `utils`→`stores` 역방향 의존성, `"use client"` 서버 호환성 |
| database | NONE | 해당 없음 (DB 관련 코드 변경 없음) |
| api_contract | NONE | 해당 없음 (API 계약 변경 없음) |

---

## 발견 없는 에이전트

- **database** — 순수 프론트엔드 i18n 작업으로 DB 관련 코드 없음
- **api_contract** — 백엔드 API 엔드포인트, 요청/응답 스키마 변경 없음

---

## 권장 조치사항

1. **[즉시] 서버 컴포넌트 호환성 확인** — `date.ts`·`execution-status.ts`를 서버 컴포넌트에서 import하는 파일 전수 검색. 사용 중이라면 `locale` 파라미터를 필수로 받는 순수 함수로 분리하고 스토어 접근 제거.
2. **[긴급] 영어 단수/복수 처리 복원** — `integrations/page.tsx`에서 `attentionCount === 1` 분기 추가 (`attentionSingle` 키 이미 존재).
3. **[긴급] 보안 의도 주석 복원** — `forgot-password-form.tsx`의 이메일 열거 방지 주석, `restore-confirm-dialog.tsx`의 `window.location.reload()` 이유 주석 복원.
4. **[중요] `formatDuration` 통합** — 두 모듈의 이중 구현을 단일 구현으로 통합, 소수점 표시 정책 전체 통일.
5. **[중요] `currentLocale()` 중복 제거** — `lib/i18n` 또는 `lib/stores/locale-store.ts`에서 단일 export.
6. **[중요] attention 메시지 보간 패턴 수정** — prefix/suffix 분리 → `t("integrations.attentionBanner", { count })` 단일 보간 키 적용.
7. **[중요] 삭제된 주석 복원** — `accept-invitation-content.tsx`, `canvas-empty-state.tsx`, `security/page.tsx`의 아키텍처적 결정 설명 주석 복원.
8. **[권장] 테스트 locale 초기화 중앙화** — `src/test/setup.ts`에 `useLocaleStore.setState({ locale: "en" })` 전역 `beforeEach` 추가.
9. **[권장] `useT()` 참조 안정성 보장** — `useCallback`으로 함수 참조 안정화하거나 `useMemo` 의존성을 `locale`로 변경.
10. **[권장] i18n 모듈 문서화** — `frontend/src/lib/i18n/README.md` 작성.
11. **[참고] 누락 테스트 추가** — 비동기 컴포넌트 toast locale 검증, validation 메시지 locale 전환 검증, 인터폴레이션 파라미터 누락 처리 검증.