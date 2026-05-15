### 발견사항

- **[CRITICAL]** `@radix-ui/react-focus-scope`가 `devDependencies`에 잘못 배치됨
  - 위치: `package.json:65`, `package-lock.json`
  - 상세: `FocusScope`는 `slide-drawer.tsx` 프로덕션 코드에서 import되어 런타임에 필요. `devDependencies`에 두면 프로덕션 빌드에서 누락될 수 있음.
  - 제안: `dependencies`로 이동

---

- **[WARNING]** `three` 패키지 버전 범위 변경이 a11y 작업과 무관하게 포함됨
  - 위치: `package.json:58`, `package-lock.json:55`
  - 상세: `"three": "^0.184.0"` → `"three": "~0.184.0"`. 캐럿(minor 업데이트 허용) → 틸다(patch 업데이트만 허용)로 축소. 이 PR의 a11y 작업 범위(Steps A–E)와 전혀 무관한 변경.
  - 제안: 의도된 변경인지 확인 후, 의도되었다면 별도 커밋/PR로 분리

---

- **[WARNING]** `register-form.tsx`의 `termsAccepted` 체크박스에 `aria-describedby` 연결 누락
  - 위치: `register-form.tsx` (변경 미포함 영역, 체크박스 `<input>`)
  - 상세: `name`, `email`, `password` 필드는 `aria-invalid` + `aria-describedby`가 세트로 추가되었으나, `termsAccepted` 체크박스 `<input>`에는 `aria-describedby="terms-error"`가 없음. 에러 단락에 `id="terms-error"`만 추가된 상태로 ARIA 연결이 끊어져 Step C 목표 미달성.
  - 제안: `termsAccepted` `<input>`에 `aria-describedby={errors.termsAccepted ? "terms-error" : undefined}` 추가

---

- **[WARNING]** `service-picker-modal.tsx`와 `mcp-server-selector.tsx`에서 `aria-label` 하드코딩
  - 위치: `service-picker-modal.tsx:36`, `mcp-server-selector.tsx:124`
  - 상세: 두 파일 모두 `aria-label="Close"` / `aria-label="Remove"`로 영어 하드코딩. 동일한 PR 내 다른 파일들(`authentication/page.tsx`, `llm-configs/page.tsx` 등)은 모두 `t("common.close")` 등 i18n 키를 사용. 일관성 결여이며 한국어 로케일에서 영어로 읽힘.
  - 제안: `t("common.close")` / `t("common.remove")` (또는 적절한 번역 키)로 교체

---

- **[WARNING]** `slide-drawer.tsx` Close 버튼 `aria-label` 하드코딩
  - 위치: `slide-drawer.tsx:72`
  - 상세: `aria-label="Close"` 영어 하드코딩. 컴포넌트가 이미 i18n 훅을 사용하지 않아 `useT()` 추가 필요. 위의 `service-picker-modal` 건과 동일한 문제.
  - 제안: `useT()`로 `t("common.close")` 사용

---

- **[INFO]** `package-lock.json`의 `axe-core` 버전 업그레이드 (4.11.1 → 4.11.4)
  - 위치: `package-lock.json:4942`
  - 상세: `@axe-core/playwright`의 peer dependency(`axe-core ~4.11.4`)로 인해 자동 업그레이드됨. 의도되지 않았지만 npm 의존성 해소의 자연스러운 결과이므로 문제 없음.

---

### 요약

이번 변경은 WCAG 2.1 AA 대응을 위한 a11y Steps A–E 범위(Playwright 셋업, semantic landmark, 폼 ARIA 연결, icon-only 버튼 aria-label, SlideDrawer 포커스 트랩)를 대체로 충실히 구현했다. 그러나 네 가지 범위 이탈/결함이 존재한다: ① `@radix-ui/react-focus-scope`를 프로덕션 코드에서 사용하면서 `devDependencies`에 배치한 빌드 오류 가능성, ② a11y와 무관한 `three` 버전 범위 축소, ③ Step C에서 `termsAccepted` 체크박스의 `aria-describedby` 연결 누락으로 인한 불완전 구현, ④ `service-picker-modal`, `mcp-server-selector`, `slide-drawer` 세 파일에서 `aria-label` 하드코딩으로 인한 i18n 일관성 파괴.

### 위험도

**MEDIUM** — `@radix-ui/react-focus-scope`의 `devDependencies` 오배치는 프로덕션 빌드 실패로 이어질 수 있음.