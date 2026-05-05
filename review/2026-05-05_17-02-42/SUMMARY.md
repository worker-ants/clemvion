쓰기 권한이 필요합니다. 해당 경로에 파일을 작성할 수 있도록 허용해 주시면 SUMMARY.md를 저장하겠습니다.

허용이 어려운 경우, 아래에 통합 보고서 전문을 출력합니다.

---

# Code Review 통합 보고서

## 전체 위험도
**HIGH** — `@radix-ui/react-focus-scope`의 `devDependencies` 오분류로 프로덕션 빌드 실패 가능. 즉시 수정 필요.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Dependency / Build | `@radix-ui/react-focus-scope`가 `devDependencies`에 배치되었으나 프로덕션 컴포넌트(`slide-drawer.tsx`)에서 직접 import. `npm install --omit=dev` 환경에서 `Module not found` 오류 발생. | `package.json:65`, `slide-drawer.tsx:3` | `dependencies`로 이동. 버전 범위 `^1.1.7`로 통일해 lock 중복 해소 |
| 2 | A11Y / Requirement | `register-form.tsx`의 `termsAccepted` 체크박스에 `aria-invalid` + `aria-describedby="terms-error"` 연결 누락. `name`/`email`/`password` 패턴과 불일치. WCAG 1.3.1 / 4.1.3 요건 미충족. | `register-form.tsx` — 체크박스 `<input>` | `aria-invalid={errors.termsAccepted ? "true" : undefined}` + `aria-describedby={errors.termsAccepted ? "terms-error" : undefined}` 추가 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | A11Y / i18n | `aria-label` 영문 하드코딩 3곳. 동일 PR의 다른 컴포넌트들은 `t("common.close")` i18n 패턴 사용. 한국어 로케일에서 그대로 노출. | `slide-drawer.tsx:70`, `service-picker-modal.tsx:37`, `mcp-server-selector.tsx:124` | `useT()` 훅 추가 후 `t("common.close")` / `t("common.remove")` 사용. `common.remove` 키를 `en.ts`/`ko.ts`에 추가 |
| 2 | Testing | `"axe scan: 전체 위반 보고 (assertion 없음)"` 테스트가 `expect()` 없이 항상 통과. CI 회귀 감지 불가. dead test 영구 잔류 위험. | `smoke.spec.ts:43–63` | `test.skip()`으로 전환하거나 기준치 위반 수를 soft-assert로 고정 |
| 3 | Scope | `three` 패키지 버전 범위 변경(`^` → `~`)이 a11y 스코프와 무관하게 포함. 의도 불명확. | `package.json:58` | 별도 커밋/PR로 분리하거나 변경 이유 명시 |
| 4 | Architecture | `ServicePickerModal`이 `SlideDrawer`와 동일한 UI 패턴임에도 `role="dialog"` + `aria-modal` + `FocusScope` 미적용. 동일 레이어에서 a11y 수준 분화. | `service-picker-modal.tsx` 전체 | `role="dialog"`, `aria-modal`, `aria-labelledby`, 포커스 트랩 추가. 또는 `SlideDrawer` 재사용 |
| 5 | Architecture | `SkipToMain`(`href="#main-content"`)과 `MainContent`(`id="main-content"`)가 문자열 리터럴로 암묵적 결합. 한쪽 변경 시 조용히 깨짐. | `skip-to-main.tsx:15`, `main-content.tsx:11` | 공유 상수(`src/lib/constants/a11y.ts`)에 `MAIN_CONTENT_ID` 정의 |
| 6 | A11Y / Focus | `open=false` 시 `aria-hidden="true"`로 SR 격리하나, `FocusScope trapped={false}`여서 화면 밖 요소가 Tab 순서에 노출될 수 있음. | `slide-drawer.tsx:58–96` | 패널 루트에 `inert={!open}` 추가 |
| 7 | A11Y | `schedules/page.tsx` 버튼에 `title`과 `aria-label`이 동일 값으로 중복 선언. 스크린 리더 이중 읽기 가능성. | `schedules/page.tsx:1064–1077` | `title` 제거하고 `aria-label`만 유지 |
| 8 | Testing / CI | `playwright.config.ts`에 `webServer` 미설정. CI에서 dev 서버 미기동 시 `ERR_CONNECTION_REFUSED`로 전체 실패. | `playwright.config.ts` | CI 워크플로에 dev 서버 기동 단계(`wait-on`) 또는 `webServer` 설정 추가 |
| 9 | Testing | `SkipToMain` href 연결, `SlideDrawer` 포커스 트랩·ESC 닫기 등 핵심 a11y 동작에 대한 단위 테스트 없음. axe e2e는 포커스 흐름 검증 불가. | `skip-to-main.tsx`, `slide-drawer.tsx` | `@testing-library/react`로 ESC 닫기, 포커스 진입, skip link 연결 단위 테스트 추가 |
| 10 | A11Y / Testing | 폼 에러 ID(`id="email-error"` 등) 고정값. 동일 페이지에 Form 복수 존재 시 WCAG 4.1.1 위반 + axe `duplicate-id` 오류. | `login-form.tsx:208`, `register-form.tsx:145,167`, `forgot-password-form.tsx:108` | `React.useId()`로 교체 |
| 11 | Testing | axe 태그 배열 `["wcag2a","wcag2aa","wcag21a","wcag21aa"]`가 3곳에 복사. 변경 시 누락 위험. | `smoke.spec.ts:20, 47, 71` | 파일 상단에 `const WCAG_TAGS = [...] as const` 상수 추출 |
| 12 | A11Y | `FocusScope`의 `onMountAutoFocus`/`onUnmountAutoFocus` 미명시. 드로어 닫힘 시 트리거로 포커스 복귀 여부 미검증. | `slide-drawer.tsx` | 초기 포커스 및 반환 동작 명시적 처리 |
| 13 | Dependency | `@radix-ui/react-focus-scope` 1.1.7(내부 중첩) + 1.1.8(최상위 dev) 두 버전 공존. 번들 중복. | `package-lock.json` | `dependencies`로 이동 후 버전 범위 `^1.1.7`로 통일 |
| 14 | Concurrency | `document.body.style.overflow` 공유 DOM 상태 경합. 드로어 2개 동시 마운트 시 하나 닫히면 overflow 무조건 초기화. `FocusScope` 추가로 중첩 사용 가능성 증가. | `slide-drawer.tsx` — `useEffect` overflow 제어 | open 카운터 방식 보호 (count=0일 때만 복원) |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Documentation | `Stage 10` 참조 주석이 코드 전반에 산재. 단계 완료 이후 의미 소실. CLAUDE.md 규약 위반. | `playwright.config.ts:5`, `smoke.spec.ts:2`, `skip-to-main.tsx:6` 외 | 단계명 제거, WHY만 남김 |
| 2 | Documentation | README에 e2e 실행 방법 미반영. dev 서버 선행 기동, `PLAYWRIGHT_BASE_URL` 환경변수 안내 없음. | `package.json` 스크립트 | README에 e2e 실행 섹션 추가 |
| 3 | Side Effect | `CardTitle` ref 타입이 `HTMLParagraphElement` → `HTMLHeadingElement`로 변경. 기존 `ref` 캐스팅 소비자 있으면 타입 에러. | `card.tsx:26` | 프로젝트 전체에서 `CardTitle` ref 전달 코드 확인 |
| 4 | Side Effect | `<aside>` → `<nav>` 랜드마크 교체. `getByRole('complementary')` 테스트나 CSS 셀렉터 깨질 수 있음. | `sidebar.tsx` | 관련 테스트 및 CSS에서 `aside` → `nav` 의존성 확인 |
| 5 | A11Y / Perf | `aria-live="polite" aria-atomic="true"` 영역에 노드 카운트 포함. 빈번 업데이트 시 스크린 리더 announce 폭증 가능. | `run-results-drawer.tsx:288–295` | 노드 카운트 span을 `aria-live` 컨테이너 밖으로 분리 |
| 6 | Side Effect | `aria-live` 컨테이너에 `statusIcon` 포함. `aria-hidden` 미적용 시 SVG 경로 정보 announce 가능. | `run-results-drawer.tsx` | `statusIcon`에 `aria-hidden="true"` 적용 여부 확인 |
| 7 | Testing / CI | `retries: 0` + `forbidOnly: !!process.env.CI` 불일치. CI 환경 감지는 되나 retry 미적용. | `playwright.config.ts:16` | `retries: process.env.CI ? 1 : 0`으로 코드화 |
| 8 | Testing | register describe에 login 대비 테스트 1개 누락(전체 위반 보고). 비대칭 커버리지. | `smoke.spec.ts:64–84` | 세 번째 테스트 추가 또는 생략 이유 주석 명시 |
| 9 | Testing | `npx playwright install` 사전 실행 필요하나 `postinstall` 스크립트 없음. 새 환경 e2e 실패. | `package.json` | `postinstall` 스크립트 또는 CI/README 문서화 |
| 10 | Dependency | `axe-core` 4.11.1 → 4.11.4 패치 업그레이드. peer dep 충족 결과. Breaking change 없음. | `package-lock.json` | 현행 유지 |
| 11 | Dependency | `@axe-core/playwright` 라이선스 MPL-2.0(약한 카피레프트). dev-only라 배포 미포함. | `package.json` | 라이선스 정책 확인 |
| 12 | Security / CI | 실패 시 저장되는 trace/screenshot에 로그인 폼 입력값 포함 가능. CI 아티팩트 보존 정책 필요. | `playwright.config.ts:22–23` | CI 아티팩트 retention 최소화, 접근 권한 제한 |
| 13 | Documentation | `CardTitle` JSDoc이 구체 사용 파일명 참조. 컴포넌트 문서는 인터페이스만 기술해야 함. | `card.tsx:28–34` | 구체 파일명 제거, 일반화된 기술로 대체 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Dependency | **HIGH** | `@radix-ui/react-focus-scope` devDependencies 오분류, 버전 중복 |
| Architecture | **HIGH** | devDependencies 오분류, `ServicePickerModal` a11y 미완성, i18n 불일치 |
| Testing | **HIGH** | devDependencies 오분류, assertion 없는 테스트, 단위 테스트 부재, 고정 ID 중복 |
| Requirement | **HIGH** | devDependencies 오분류, `termsAccepted` ARIA 연결 누락, FocusScope 동작 미검증 |
| Side Effect | **MEDIUM** | devDependencies 오분류, FocusScope 닫힘 상태 포커스, `aside`→`nav` 교체 |
| Scope | **MEDIUM** | devDependencies 오분류, `three` 버전 변경 무관 포함, `termsAccepted` 누락 |
| Maintainability | **LOW** | aria-label i18n 불일치, axe 태그 중복, dead test 잔류 위험 |
| Concurrency | **LOW** | `document.body.style.overflow` 경합, fullyParallel + retries:0 플래키 |
| Performance | **LOW** | e2e 이중 axe 스캔, devDependencies 번들 리스크, aria-live 빈번 업데이트 |
| Documentation | **LOW** | Stage 참조 주석, README e2e 섹션 누락 |
| Security | **NONE** | 즉각적인 보안 취약점 없음 |
| API Contract | **NONE** | 해당 없음 |
| Database | **NONE** | 해당 없음 |

---

## 발견 없는 에이전트

| 에이전트 | 사유 |
|----------|------|
| **api_contract** | 변경사항 전체가 프론트엔드 UI/a11y. API 계약 변경 없음 |
| **database** | 변경사항 전체가 프론트엔드 UI/a11y. DB 관련 코드 없음 |

---

## 권장 조치사항

1. **[즉시]** `@radix-ui/react-focus-scope`를 `dependencies`로 이동. 버전 범위 `^1.1.7`로 통일.
2. **[즉시]** `register-form.tsx` `termsAccepted` 체크박스에 `aria-invalid` + `aria-describedby` 추가.
3. **[단기]** `slide-drawer.tsx`, `service-picker-modal.tsx`, `mcp-server-selector.tsx`의 `aria-label` 하드코딩을 i18n 키로 교체. `common.remove` 키 추가.
4. **[단기]** `slide-drawer.tsx` 닫힌 상태에 `inert={!open}` 추가.
5. **[단기]** "assertion 없음" 테스트를 `test.skip()` 또는 soft-assert로 전환. axe 태그 배열을 상수(`WCAG_TAGS`)로 추출.
6. **[단기]** `SkipToMain` ↔ `MainContent` ID 결합을 공유 상수(`MAIN_CONTENT_ID`)로 분리.
7. **[중기]** `playwright.config.ts`에 `retries: process.env.CI ? 1 : 0` 적용. CI에 dev 서버 기동 단계 추가.
8. **[중기]** 폼 에러 ID를 `React.useId()`로 교체.
9. **[중기]** `SkipToMain` / `SlideDrawer` 핵심 a11y 동작에 대한 단위 테스트 추가.
10. **[중기]** `ServicePickerModal`에 완전한 dialog a11y 패턴 적용.
11. **[중기]** 코드 전반의 `Stage 10` 참조 주석 제거. README에 e2e 실행 방법 추가.
12. **[장기]** `run-results-drawer.tsx` aria-live에서 노드 카운트 span 분리. `three` 버전 변경 별도 PR 분리.