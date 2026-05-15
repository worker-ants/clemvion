### 발견사항

---

**[CRITICAL] `@radix-ui/react-focus-scope`가 `devDependencies`에 잘못 배치됨**
- 위치: `package.json:65`, `slide-drawer.tsx:3`
- 상세: `SlideDrawer`는 런타임 컴포넌트이므로 `FocusScope`는 프로덕션 번들에 포함되어야 함. `devDependencies`에 넣으면 `next build` 프로덕션 빌드 시 `Module not found` 오류 발생. 현재 e2e 테스트가 dev 서버 기준이라 로컬에서는 통과하지만 CI 프로덕션 빌드에서 깨짐.
- 제안: `dependencies`로 이동

```json
// package.json
"dependencies": {
  "@radix-ui/react-focus-scope": "^1.1.8",
  ...
}
```

---

**[WARNING] "assertion 없음" 테스트가 항상 통과함 — CI 안전망 부재**
- 위치: `smoke.spec.ts:43-63`
- 상세: `test("axe scan: 전체 위반 보고 (assertion 없음)")` 은 `expect()` 호출이 없어 위반이 100개여도 GREEN. "baseline" 의도는 이해하나, CI에서 regression을 잡지 못함. 적어도 `serious` 이상 위반을 카운트로 soft-assert하거나 snapshot으로 고정해야 함.
- 제안:
```ts
// 최소한 카운트를 soft-assert로 고정
expect(results.violations.length).toBeLessThanOrEqual(KNOWN_BASELINE_COUNT);
```

---

**[WARNING] `webServer` 미설정 — dev 서버 미기동 시 silently fail**
- 위치: `playwright.config.ts`
- 상세: 주석에서 의도적으로 `webServer`를 제외했다고 설명하지만, CI 파이프라인에서 서버가 없으면 모든 테스트가 `ERR_CONNECTION_REFUSED`로 실패함. `forbidOnly: !!process.env.CI`로 CI 환경을 감지하고 있으면서 서버 기동은 외부 의존. Playwright 공식 권고와 다름.
- 제안: CI 단계에서 `webServer` 설정 또는 README/CI 스크립트에 명시적 사전조건 문서화 필요.

---

**[WARNING] `register` 페이지 테스트 커버리지가 `login` 페이지보다 얕음**
- 위치: `smoke.spec.ts:67-83`
- 상세: `login` describe는 critical 위반, h1 카운트, 전체 위반 보고 3개 테스트. `register`는 critical 위반, h1 카운트 2개만 존재. 비대칭 커버리지로 register 페이지 regression을 늦게 발견할 수 있음.
- 제안: `register` describe에도 동일한 3번째 test 추가.

---

**[WARNING] 새 컴포넌트(`SkipToMain`, `SlideDrawer` FocusScope)에 대한 단위 테스트 없음**
- 위치: `skip-to-main.tsx`, `slide-drawer.tsx`
- 상세: `SkipToMain`의 `href="#main-content"` 연결 동작, `SlideDrawer`의 focus trap (`trapped={open}`) 및 ESC 닫기는 a11y 핵심 동작임에도 `@testing-library/react` 단위 테스트가 없음. axe e2e는 DOM 구조만 확인하고 focus 흐름은 검증하지 않음.
- 제안:
```ts
// slide-drawer.test.tsx 예시
it("Escape 키로 닫힌다", async () => {
  render(<SlideDrawer open onClose={mockClose} title="Test">{...}</SlideDrawer>);
  await userEvent.keyboard("{Escape}");
  expect(mockClose).toHaveBeenCalledOnce();
});

it("열릴 때 포커스가 패널 내부로 진입한다", async () => {
  render(<SlideDrawer open onClose={mockClose} title="Test"><button>inner</button></SlideDrawer>);
  expect(document.activeElement).toBeInTheDocument();
});
```

---

**[WARNING] ARIA 에러 ID 고정값(`id="email-error"`)이 복수 인스턴스 시 충돌**
- 위치: `login-form.tsx:208`, `register-form.tsx:145,167`, `forgot-password-form.tsx:108`
- 상세: `id="email-error"` 등 고정 ID를 사용하여 `aria-describedby`로 연결. 동일 페이지에 두 Form이 존재하면 WCAG 4.1.1(Parsing) 위반이자 axe에서 `duplicate-id` 오류 발생. 현재 테스트는 단일 Form만 검사하므로 이를 탐지 못함.
- 제안: `React.useId()`로 교체 (`resetPasswordForm`은 이미 `useId`가 없어 동일 문제).

---

**[INFO] `service-picker-modal.tsx`와 `mcp-server-selector.tsx`의 `aria-label` 하드코딩**
- 위치: `service-picker-modal.tsx:37` (`"Close"`), `mcp-server-selector.tsx:124` (`"Remove"`)
- 상세: 다른 파일들은 `t("common.close")` i18n을 사용하는데 이 두 파일만 영문 하드코딩. ko 로케일에서 스크린 리더가 영문 발음. axe 스캔은 label 언어 불일치를 잡지 않으므로 테스트로 탐지 안됨.
- 제안: i18n key로 교체 + 테스트에 ko 로케일 시나리오 추가 검토.

---

**[INFO] `retries: 0` — CI 플레이크 위험**
- 위치: `playwright.config.ts:16`
- 상세: 주석에 "CI 도입 시 1~2로 올림"이라고 명시되어 있으나, `forbidOnly: !!process.env.CI`로 CI 환경 감지가 이미 적용된 상태. `retries: process.env.CI ? 1 : 0` 으로 일관성을 맞추는 것이 권장됨.

---

**[INFO] Playwright 브라우저 설치 스크립트 없음**
- 위치: `package.json`
- 상세: `@playwright/test` 추가 후 `npx playwright install`이 필요하지만 `postinstall` 스크립트나 CI 설명이 없음. 새 환경에서 `npm install` 후 바로 `npm run e2e` 시 실패.
- 제안: `"postinstall": "playwright install --with-deps chromium"` 또는 CI 문서화.

---

### 요약

이번 변경은 WCAG 2.1 AA 대응을 위한 포괄적인 a11y 개선으로, Playwright + axe-core e2e 인프라 도입과 30개 이상의 컴포넌트 ARIA 패치를 포함한다. 테스트 관점에서 가장 심각한 문제는 `@radix-ui/react-focus-scope`가 `devDependencies`에 잘못 배치되어 프로덕션 빌드를 깨뜨릴 수 있다는 점이며, "전체 위반 보고" 테스트가 assertion 없이 항상 통과한다는 점도 CI 안전망으로서 가치가 없다. `SkipToMain`과 `SlideDrawer` FocusScope의 핵심 a11y 동작(포커스 트랩, ESC 닫기, skip link 연결)에 대한 단위 테스트가 없어 e2e에서만 부분적으로 커버되고 있으며, 고정 ID(`id="email-error"`)는 복수 Form 사용 시 axe `duplicate-id` 위반을 유발할 수 있다.

### 위험도

**HIGH** — `@radix-ui/react-focus-scope` devDependencies 배치 오류가 프로덕션 빌드를 직접 깨뜨릴 수 있음.