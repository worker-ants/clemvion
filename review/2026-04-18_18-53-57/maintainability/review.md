### 발견사항

---

**[WARNING] 보안/동작 설명 주석 제거**
- 위치: `forgot-password-form.tsx`, `accept-invitation-content.tsx`, `canvas-empty-state.tsx`, `security/page.tsx`
- 상세: 번역 키 교체 과정에서 비기능적 맥락을 설명하는 주석들이 삭제됨. 특히 `// We intentionally don't show the error to prevent email enumeration`은 보안 설계 의도를 기록한 것으로, 추후 리뷰어가 "왜 에러를 숨기는가"를 오해하거나 실수로 노출시킬 수 있음. `canvas-empty-state.tsx`의 JSDoc도 `opacity-0 + pointer-events-none` 조합의 비직관적 이유를 설명했음.
- 제안: 코드 동작에 대한 WHY 주석은 번역 작업과 무관하게 유지

---

**[WARNING] i18n에 부적합한 문장 분리 (sentence splitting)**
- 위치: `integrations/page.tsx` (attentionPrefix/attentionSuffix), `dashboard/page.tsx` (`{card.change}% {t("dashboard.changeVsPrev")}`)
- 상세: 두 개의 분리된 키로 문장을 조합하는 방식은 언어마다 어순이 달라 번역이 불가능하거나 어색해짐. 특히 attention 배너는 기존 복수형 처리(`integration` vs `integrations`)가 사라진 채 두 키로 쪼개졌음.
- 제안: 파라미터 보간을 사용하는 단일 키로 통합: `t("integrations.attentionMessage", { count: attentionCount })`

---

**[WARNING] `type` 선언을 컴포넌트 함수 본문 안에서 사용**
- 위치: `forgot-password-form.tsx:46`, `reset-password-form.tsx:48` 등
- 상세: `useMemo` 블록 이후 `type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>`가 함수 본문 내에서 선언됨. TypeScript `type` 선언이 함수 스코프 안에 있는 것은 동작은 하지만 비표준 패턴이며, 해당 타입이 `useForm<ForgotPasswordFormValues>` 호출 이전에 있어야 한다는 순서 의존성이 숨겨짐.
- 제안: 스키마 타입을 모듈 레벨로 올리거나, `z.infer<ReturnType<typeof buildSchema>>`처럼 명시적으로 처리

---

**[WARNING] `useMemo([t])` - `t` 참조 안정성 불확실**
- 위치: `forgot-password-form.tsx`, `reset-password-form.tsx`, `login-form.tsx`, `register-form.tsx`
- 상세: Zod 스키마가 `useMemo(() => ..., [t])`로 메모화되어 있는데, `useT()`가 반환하는 `t`가 렌더마다 새 참조라면 메모이제이션 효과가 없음. 반면 `t`가 locale 변경 시만 갱신된다면 올바른 패턴. `useT`의 구현에 따라 이 가정이 성립하는지가 유지보수 시 명확하지 않음.
- 제안: `useT` 훅이 `useCallback`으로 `t`를 안정화한다는 점을 문서화하거나, 의존성 배열에 `locale`을 명시: `useMemo(() => ..., [locale])`

---

**[WARNING] 테스트에서 정확 일치 → 정규식 변경이 의도 불명확**
- 위치: `execution-list-page.test.tsx`, `chip-input.test.tsx`, `integration-selector.test.tsx`
- 상세: `getByText("1.0s")` → `getByText("1s")` 변경은 `formatDuration` 동작 변경을 반영하나, 그 이유가 i18n인지 버그 수정인지 불명확. `findByText("Completed")` → `findAllByText("Completed")` 변경은 "하나만 있어야 한다"는 기존 단언을 약화시킴.
- 제안: 동작 변경을 반영한 테스트 변경에는 짧은 주석으로 이유를 명시

---

**[INFO] Inner/Outer 래퍼 컴포넌트 패턴 - 일관성은 있으나 설명 부재**
- 위치: `forgot-password-form.tsx`, `reset-password-form.tsx`
- 상세: `key={locale}`로 locale 변경 시 폼을 완전히 재마운트하는 패턴. 동작상 유효하지만, 왜 `key` 기반 재마운트가 필요한지(react-hook-form이 Zod 에러 메시지를 locale 변경 후 다시 계산하지 않기 때문) 설명이 없으면 추후 개발자가 불필요하다고 판단해 제거할 수 있음.
- 제안: `// Force full remount on locale change so react-hook-form picks up re-computed Zod messages` 주석 1줄 추가

---

**[INFO] `TYPE_LABEL` → `TYPE_LABEL_KEY`, `label` → `labelKey` 네이밍 변경**
- 위치: `profile/alerts/page.tsx`, `integrations/page.tsx`, `executions/page.tsx`, `dashboard/page.tsx`
- 상세: 기존 `label: string` 필드가 `labelKey: TranslationKey`로 일관되게 변경됨. 네이밍 컨벤션이 프로젝트 전반에서 통일되어 있어 패턴을 바로 이해할 수 있음.

---

### 요약

전반적으로 i18n 도입의 구조적 설계(core/index 분리, `translate` + `getState()` 패턴, `labelKey` 컨벤션)는 일관성 있고 유지보수에 유리하다. 그러나 번역 키 교체 과정에서 비기능적 맥락을 설명하던 의미 있는 주석들이 다수 삭제되었고, 일부 문장이 두 개의 키로 쪼개져 다국어 확장 시 번역 불가 상황이 발생할 수 있다. `useMemo([t])` 패턴의 전제 조건이 `useT` 구현에 숨겨져 있어 추후 훅 변경 시 조용히 깨질 수 있다는 점도 문서화가 필요하다.

### 위험도

**MEDIUM**