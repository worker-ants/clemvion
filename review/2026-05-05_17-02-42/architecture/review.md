## 발견사항

---

### **[CRITICAL] `@radix-ui/react-focus-scope`가 devDependencies에 등록되었으나 프로덕션 코드에서 사용**
- **위치**: `package.json:64` / `slide-drawer.tsx:4`
- **상세**: `FocusScope`는 `slide-drawer.tsx` (프로덕션 UI 컴포넌트)에서 import되지만, `package.json`의 `devDependencies`에 배치되어 있다. `npm install --production` 또는 CI 프로덕션 빌드 환경에서 해당 패키지가 설치되지 않아 런타임 오류가 발생한다.
- **제안**: `@radix-ui/react-focus-scope`를 `dependencies`로 이동

---

### **[WARNING] `SkipToMain` ↔ `MainContent` 간 암묵적 하드코딩 결합**
- **위치**: `skip-to-main.tsx:15` (`href="#main-content"`) / `main-content.tsx:11` (`id="main-content"`)
- **상세**: 두 파일이 문자열 리터럴 `"main-content"`로 암묵적으로 결합되어 있다. 한쪽에서 id를 변경하면 다른 쪽이 조용히 깨진다. 이는 SRP 위반 문제라기보다 모듈 경계가 불분명한 응집도 문제다.
- **제안**: 공유 상수 파일(예: `src/lib/constants/a11y.ts`)에 `MAIN_CONTENT_ID = "main-content"` 를 정의하고 양쪽에서 참조

---

### **[WARNING] `aria-label` i18n 처리 방식이 컴포넌트 간 불일치**
- **위치**: `slide-drawer.tsx:72` (`aria-label="Close"`), `service-picker-modal.tsx:39` (`aria-label="Close"`), `mcp-server-selector.tsx:121` (`aria-label="Remove"`)
- **상세**: 대부분의 컴포넌트는 `t("common.close")` / `t("common.aria.*")` 등 i18n 함수를 사용하지만, 위 세 곳은 영어 문자열을 하드코딩하고 있다. 동일한 레이어의 컴포넌트들이 서로 다른 전략을 사용하여 응집도가 낮아진다.
- **제안**: 세 컴포넌트 모두 `useT()` 훅을 도입하고 기존 i18n 키(`t("common.close")` 등)를 사용. `SlideDrawer`는 이미 `useT()`를 사용하지 않으므로 훅 추가 필요

---

### **[WARNING] `ServicePickerModal`의 a11y 업그레이드 미완성 — 아키텍처 일관성 위반**
- **위치**: `service-picker-modal.tsx` 전체
- **상세**: `SlideDrawer`는 이번 변경에서 `role="dialog"` + `aria-modal="true"` + `aria-labelledby` + `FocusScope` (포커스 트랩)을 갖춘 완전한 다이얼로그 패턴으로 업그레이드되었다. 반면 `ServicePickerModal`은 동일한 시각적 패턴(오버레이 + 패널)임에도 닫기 버튼의 `aria-label`만 추가되고 나머지는 미처리 상태다. 같은 레이어에서 같은 UI 패턴에 다른 a11y 수준이 적용되면 향후 유지보수에서 기준이 모호해진다.
- **제안**: `ServicePickerModal`에도 `role="dialog"`, `aria-modal`, `aria-labelledby`, 포커스 트랩 추가. 또는 `SlideDrawer`를 재사용하도록 리팩토링

---

### **[INFO] `register-form.tsx`의 `termsAccepted` 필드만 `aria-describedby` 누락**
- **위치**: `register-form.tsx` — 체크박스 `input` 요소
- **상세**: `name`, `email`, `password` 필드는 모두 `aria-invalid` + `aria-describedby`가 일관되게 추가되었지만, `termsAccepted` 체크박스에는 `aria-invalid`와 `aria-describedby="terms-error"`가 빠져 있다. 에러 `<p id="terms-error">`는 생성되지만 체크박스와 프로그래매틱으로 연결되지 않는다.
- **제안**: 체크박스 `input`에 `aria-describedby={errors.termsAccepted ? "terms-error" : undefined}` 추가

---

### **[INFO] 닫힌 상태의 `SlideDrawer` 내부 요소가 키보드 포커스에 노출될 수 있음**
- **위치**: `slide-drawer.tsx:61–67`
- **상세**: `open=false` 시 `aria-hidden="true"`로 SR에서 격리되지만, `FocusScope trapped={false}`이므로 시각적으로 `translate-x-full`로 숨겨진 요소들이 Tab 순서에 여전히 포함될 수 있다. 브라우저에 따라 off-screen 요소도 focusable 상태로 남는다.
- **제안**: `open=false` 시 패널 루트에 HTML `inert` 속성 추가 (`inert={!open}`)

---

## 요약

이번 변경은 Stage 10 a11y 기준선 구축이라는 점에서 방향성이 명확하고 전반적인 아키텍처 분리(테스트 레이어, UI 컴포넌트, i18n)는 적절하다. `CardTitle`의 `as` prop 폴리모픽 패턴, `SkipToMain`의 단일 책임 컴포넌트화, `RunResultsDrawer`의 `aria-live` 영역 추가는 모두 올바른 아키텍처 결정이다. 그러나 **`@radix-ui/react-focus-scope`가 `devDependencies`에 잘못 배치된 것은 프로덕션 빌드를 즉시 깨뜨리는 결정적 결함**이며, `aria-label` i18n 처리 비일관성과 `ServicePickerModal`의 불완전한 업그레이드는 동일 레이어 컴포넌트 간 기준이 분화되는 유지보수 부채를 생성한다.

## 위험도

**HIGH** — devDependency 분류 오류 단독으로 프로덕션 배포 실패를 유발할 수 있음