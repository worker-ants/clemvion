### 발견사항

---

**[WARNING] 문장 분리 방식의 i18n 안티패턴 — 언어 구조 의존성**
- 위치: `integrations/page.tsx` — `attentionPrefix` / `attentionSuffix`
- 상세: `<strong>{attentionCount}</strong> {t("integrations.attentionPrefix")} {t("integrations.attentionSuffix")}` 형태로 문장을 두 키로 분리하고, 그 사이에 동적 값을 삽입하고 있습니다. 이는 모든 언어가 동일한 어순을 가진다고 가정합니다. 예를 들어 한국어는 수량이 문장 앞에, 영어는 문장 중간에 오는 경우가 많아 어순이 다릅니다. 단수/복수 처리도 누락되어 있습니다.
- 제안: 단일 키 + 보간 파라미터로 통합하세요.
  ```tsx
  t("integrations.attentionBanner", { count: attentionCount })
  // ko: "{{count}}개의 인테그레이션이 주의가 필요합니다 (만료 예정, 만료됨, 오류). 클릭하여 필터링하세요."
  // en: "{{count}} integration(s) need attention ..."
  ```

---

**[WARNING] `translate` 임포트 경로 불일치 — 모듈 경계 일관성 저하**
- 위치: `editor-loader.tsx` vs `verify-email-content.tsx`, `accept-invitation-content.tsx`
- 상세: `editor-loader.tsx`는 `import { translate } from "@/lib/i18n/core"` (내부 모듈 직접 접근), 나머지 파일들은 `import { translate } from "@/lib/i18n"` (공개 인터페이스) 사용. `i18n/core.ts`는 내부 구현 모듈이고 `index.ts`가 공개 API 역할을 해야 합니다. 내부 모듈을 직접 임포트하면 모듈 경계가 무너집니다.
- 제안: `editor-loader.tsx`의 임포트를 `@/lib/i18n`으로 통일하세요.

---

**[WARNING] 반복되는 Inner/Outer 컴포넌트 분리 패턴 — DRY 원칙 위반**
- 위치: `forgot-password-form.tsx`, `login-form.tsx`, `register-form.tsx`, `reset-password-form.tsx` (총 4개 파일 동일 패턴)
- 상세: 각 폼마다 `ForgotPasswordFormInner` + `ForgotPasswordForm(key={locale})` 분리 패턴이 반복됩니다. 이 패턴의 목적(로케일 변경 시 Zod 스키마 재생성을 위한 강제 리마운트)은 같지만 코드가 4군데에 중복됩니다. 유지보수 비용이 증가합니다.
- 제안: HOC 또는 커스텀 훅으로 추상화하세요.
  ```tsx
  // with-locale-remount.tsx
  export function withLocaleRemount<P>(Component: React.ComponentType<P>) {
    return function WrappedComponent(props: P) {
      const locale = useLocale();
      return <Component key={locale} {...props} />;
    };
  }
  // 사용: export const ForgotPasswordForm = withLocaleRemount(ForgotPasswordFormInner);
  ```

---

**[WARNING] 제네릭 UI 컴포넌트의 i18n 직접 의존 — 응집도 경계 혼재**
- 위치: `shared.tsx` (`KeyValueEditor`), `button-list-editor.tsx`, `field-help.tsx`
- 상세: 범용 UI 컴포넌트들이 `useT()`를 직접 호출하여 i18n 시스템에 강결합됩니다. 이 컴포넌트들은 원래 프레젠테이션 레이어의 재사용 가능한 빌딩 블록인데, 번역 로직을 내부에 포함하면 다른 맥락에서 재사용하거나 테스트할 때 locale store mock이 필수가 됩니다. 실제로 여러 테스트가 `useLocaleStore.setState({ locale: "en" })` 설정을 추가해야 했습니다.
- 제안: 단순 `placeholder`, `label` prop으로 외부에서 번역된 문자열을 주입받는 방식으로 유지하거나, 적어도 기본값을 prop으로 override 가능하게 유지하세요.

---

**[INFO] 비동기 컨텍스트에서 로케일 캡처 시점 — 경쟁 조건 가능성**
- 위치: `verify-email-content.tsx`, `accept-invitation-content.tsx`, `editor-loader.tsx`
- 상세: `const currentLocale = useLocaleStore.getState().locale`을 비동기 함수 시작 시점에 캡처합니다. 네트워크 요청이 진행되는 동안 사용자가 언어를 변경하면 toast 메시지가 이전 언어로 표시될 수 있습니다. 실제 UX 영향은 미미하지만 잠재적 불일치가 존재합니다.
- 제안: 수용 가능한 트레이드오프이므로 변경 필수는 아닙니다. 단, `useLocaleStore.getState().locale`을 toast 호출 직전에 읽도록 이동하면 창 크기를 줄일 수 있습니다.

---

**[INFO] `getStatusLabel` 함수 시그니처 변경의 의도 불명확**
- 위치: `executions/page.tsx` — `STATUS_LABEL` → `getStatusLabel(status)`
- 상세: 정적 맵에서 함수 호출로 변경되었는데, `execution-status.ts`의 구현이 diff에 포함되지 않아 내부에서 `useLocaleStore.getState()`를 쓰는지 확인 불가합니다. 만약 함수 내부에서 locale store를 직접 읽는다면, 유틸리티 레이어에서 UI 상태 스토어에 의존하는 결합도 문제가 발생합니다.
- 제안: `getStatusLabel(status, locale)` 형태로 locale을 인자로 받도록 설계하는 것이 레이어 독립성 측면에서 더 바람직합니다.

---

**[INFO] `formatDuration` 이동은 적절 — 중복 제거 확인됨**
- 위치: `dashboard/page.tsx`
- 상세: 로컬 정의를 `@/lib/utils/date`로 이동한 것은 올바른 리팩터링입니다. 단, 테스트에서 `"1.0s"` → `"1s"` 변경이 관찰되는데, 이는 포맷 로직 변경에 의한 것이므로 의도된 변경인지 확인이 필요합니다.

---

### 요약

전반적인 i18n 아키텍처 설계(core/index 분리, translate vs useT 구분, TranslationKey 타입 안전성, 정적 배열의 key 기반 지연 번역)는 견고합니다. 다만 `attentionPrefix/Suffix`의 문장 분리 패턴은 언어 구조 의존성을 내포한 명확한 안티패턴이며, Inner/Outer 폼 분리의 4중 반복은 DRY 위반입니다. 제네릭 UI 컴포넌트들이 i18n에 직접 의존하면서 컴포넌트 재사용성과 테스트 독립성이 저하된 점, 그리고 `translate` 임포트 경로 불일치로 인한 모듈 경계 누수도 개선이 필요합니다.

### 위험도

**MEDIUM**