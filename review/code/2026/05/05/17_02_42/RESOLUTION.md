# RESOLUTION — Stage 10 (Step A~E) 1차 ai-review 조치

대상 변경: Step A~E (커밋 70460a6 ~ e853715) — Playwright e2e 셋업, semantic
landmark, 폼 a11y, 아이콘 coverage, focus trap + aria-live.

원본 리뷰: `review/2026-05-05_17-02-42/SUMMARY.md`

전체 위험도(원본): **HIGH** (focus-scope devDeps 오분류 → build risk).
본 조치로 Critical 2건 + Warning 11건 + Info 4건 처리, 나머지는 사유 명시 deferred.

---

## Critical 조치 (2/2)

| # | 원본 | 조치 |
|---|---|---|
| C-1 | `@radix-ui/react-focus-scope` devDeps 오분류 — production build 시 Module not found 가능 | `dependencies` 로 이동, version `1.1.7` 핀 (transitive dialog/menu/popover 의 1.1.7 과 dedupe). `npm ls` 단일 1.1.7 확인. |
| C-2 | `register-form` termsAccepted 체크박스 aria-invalid + aria-describedby 누락 | termsAccepted 입력에 `aria-invalid` + `aria-describedby={termsErrorId}` 추가 (다른 필드와 동일 패턴). |

---

## Warning 조치 (11/14)

| # | 카테고리 | 조치 |
|---|---|---|
| W-1 | aria-label 영문 하드코딩 | slide-drawer / mcp-server-selector 의 `aria-label` 을 `t("common.close")` / `t("common.aria.removeIntegration")` 으로 i18n 화. service-picker-modal 도 i18n + 신규 키 `addIntegration` 추가. |
| W-2 | "assertion 없음" baseline 테스트 | `axe scan: 전체 위반 0 (회귀 감지)` 로 변경 — login 이 이미 0 위반이므로 0 강제. 향후 회귀 즉시 검출. |
| W-4 | ServicePickerModal 의 dialog/focus-scope 패턴 미적용 | FocusScope + role="dialog" + aria-modal + aria-labelledby + Esc 닫기 추가 (SlideDrawer 와 통일). |
| W-5 | SkipToMain ↔ MainContent ID 문자열 결합 | `frontend/src/lib/constants/a11y.ts` 신규 — `MAIN_CONTENT_ID` 단일 출처. 양쪽이 import. |
| W-6 | SlideDrawer 닫혔을 때 화면 밖 요소 Tab 노출 | 패널 루트에 `inert={!open ? "" : undefined}` 추가. React 19 ARIA 표준 prop 이지만 타입 정의 lagging 으로 ts-expect-error 한 줄. |
| W-7 | schedules.page 버튼 title + aria-label 중복 | `title` 제거, `aria-label` 만 유지. 스크린 리더 이중 읽기 회피. 관련 테스트도 `getByRole({ name })` 으로 갱신. |
| W-10 | 폼 에러 ID 고정값 → axe duplicate-id 위험 | login/register/forgot-password/reset-password 4 개 폼 모두 `useId()` 로 교체. |
| W-11 | axe 태그 배열 3곳 복사 | smoke.spec.ts 상단에 `WCAG_TAGS = [...] as const` 상수 추출 후 모든 케이스에서 재사용. |
| W-12 | FocusScope onMount/onUnmountAutoFocus 미명시 | JSDoc 으로 default 동작(자동 trigger 복귀)에 의존함을 명시. 명시적 핸들러는 반드시 필요한 경우에만 — 현재 default 가 의도된 동작. |
| W-13 | focus-scope 1.1.7 / 1.1.8 두 버전 공존 | C-1 dedupe 와 함께 해소 — 단일 1.1.7. |
| W-14 | `document.body.style.overflow` 경합 — 중첩 drawer race | 모듈 스코프 `openDrawerCount` + `lockBodyScroll`/`unlockBodyScroll` 도입. 카운트 0 일 때만 복원. |

### Deferred (3 건 + 사유)

| # | 사유 |
|---|---|
| W-3 (`three` ^→~) | **false positive** — `git diff 11ea4b1..HEAD frontend/package.json` 결과 `three` 변경 없음. 이전 커밋(`6df48d6 feat(graph-visualization)…`)에서 발생한 변경을 본 PR 범위로 오인. |
| W-8 (playwright webServer 미설정) | 본 작업은 로컬 e2e (사용자 dev 서버 별도 운영) 시나리오. CI 통합은 plan Out of scope 명시 — 후속 작업 영역. |
| W-9 (SkipToMain / SlideDrawer 단위 테스트) | Stage 10 spec 의 verification gate 는 e2e + VoiceOver. 단위 테스트 보강은 nice-to-have — 후속 audit 범위. |

---

## Info 조치 (4 건)

| # | 조치 |
|---|---|
| I-5 | run-results-drawer aria-live 영역에서 노드 카운트 span 분리 — 빈번 업데이트 announce 폭증 방지 |
| I-6 | run-results-drawer 의 statusIcon 컨테이너에 `aria-hidden="true"` 적용 |
| I-13 | CardTitle JSDoc 에서 구체 파일명(login/register) 제거 — 인터페이스 일반화 (이번 차에 함께) |
| (관련) | service-picker-modal 의 ServiceIcon 에도 `aria-hidden="true"` 추가 |

### Deferred (Info 9 건)

- I-1 (Stage 10 주석 산재): plan/리뷰 아카이브와의 cross-reference 가치 있음. Step H plan 종료 시 일괄 정리 검토.
- I-2 (README e2e 섹션): Step H 와 함께 정리.
- I-3 (CardTitle ref 타입 변경 시 소비자): 검색 결과 `ref` 전달 사용처 0곳 — 영향 없음 확인.
- I-4 (`<aside>`→`<nav>` 시맨틱 변경 영향): 관련 테스트 grep 결과 `getByRole('complementary')` 사용 0곳 — 영향 없음.
- I-7 (retries: process.env.CI ? 1 : 0): CI 통합 시점에 함께.
- I-8 (register 비대칭 커버리지): 대칭 회귀 테스트 추가 비용 vs 가치 — 후속.
- I-9 (postinstall playwright install): CI 도입 시.
- I-10 (axe-core 4.11.4 패치): 자동 수렴, 조치 불필요.
- I-11 (MPL-2.0 dev-only): 정책 OK.
- I-12 (CI 아티팩트 PII 보호): CI 도입 시점에.

---

## 변경 파일

- `frontend/package.json` / `frontend/package-lock.json` — focus-scope deps 이동 + 1.1.7 핀
- `frontend/src/lib/constants/a11y.ts` (신규) — `MAIN_CONTENT_ID`
- `frontend/src/lib/i18n/dict/{en,ko}.ts` — `addIntegration` / `removeIntegration` aria 키 추가
- `frontend/src/components/ui/{slide-drawer,skip-to-main}.tsx` — 헬퍼 / inert / FocusScope JSDoc / overflow 카운터
- `frontend/src/components/layout/main-content.tsx` — MAIN_CONTENT_ID import
- `frontend/src/components/auth/{login,register,forgot-password,reset-password}-form.tsx` — useId, termsAccepted aria
- `frontend/src/app/(main)/integrations/_shared/service-picker-modal.tsx` — dialog 패턴
- `frontend/src/components/integrations/mcp-server-selector.tsx` — i18n
- `frontend/src/app/(main)/schedules/page.tsx` — title 제거
- `frontend/src/app/(main)/schedules/__tests__/schedules-page.test.tsx` — getByRole 로 갱신
- `frontend/src/components/editor/run-results/run-results-drawer.tsx` — aria-live 분리, statusIcon aria-hidden
- `frontend/e2e/a11y/smoke.spec.ts` — WCAG_TAGS 상수, baseline → 회귀 강제

## 재검증

- lint 통과 (eslint 0 errors)
- vitest 102 suites / 1154 tests
- e2e 5/5 — login·register critical 0 + 전체 0
- build 성공
