---

## 발견사항

### [CRITICAL] `forgotPasswordSchema` / `loginSchema` / `registerSchema` / `resetPasswordSchema` 컴포넌트 내부 정의 — 로케일 전환 시 유효성 메시지 고정 버그

- **위치**: `forgot-password-form.tsx:42`, `login-form.tsx:44`, `register-form.tsx:55`, `reset-password-form.tsx:54`
- **상세**: Zod 스키마를 컴포넌트 함수 내부에서 `t()`와 함께 생성하는 구조입니다. `useForm({ resolver: zodResolver(schema) })`는 최초 렌더링 시 resolver를 캡처하므로, 이후 로케일이 변경되어 `t`가 새로운 번역 함수를 반환해도 이미 캡처된 스키마의 에러 메시지는 교체되지 않습니다. 결과적으로 로케일 전환 후에도 유효성 에러 메시지는 원래 언어로 표시됩니다.
- **제안**: 스키마를 `useMemo(() => buildSchema(t), [t])`로 메모이제이션하거나, `resolver` 갱신을 위해 `useForm`의 `resolver`를 외부에서 동적으로 교체하는 방식으로 수정. 해당 동작을 검증하는 테스트 추가 필요.

---

### [WARNING] `formatDuration` 함수 — 테스트 누락

- **위치**: `frontend/src/lib/utils/date.ts` (신규 export), `date.test.ts`
- **상세**: `dashboard/page.tsx`에서 로컬 정의를 제거하고 `date.ts`로 이관된 `formatDuration`이 `date.test.ts`에 전혀 테스트되지 않습니다. ms < 1000, 1초 이상, 1분 이상의 세 분기와 한국어/영어 번역 각각 검증이 필요합니다.
- **제안**:
  ```ts
  it("formats milliseconds", () => {
    expect(formatDuration(500, "en")).toBe("500ms");
    expect(formatDuration(5000, "en")).toBe("5s");
    expect(formatDuration(90000, "en")).toBe("1m 30s");
    expect(formatDuration(5000, "ko")).toBe("5초");
  });
  ```

---

### [WARNING] `locale-store.ts` — 테스트 없음

- **위치**: `frontend/src/lib/stores/locale-store.ts`
- **상세**: localStorage 영속성, `document.documentElement.lang` 갱신, SSR 환경 가드(`typeof window === "undefined"`), `initFromStorage`의 잘못된 값 처리 등 부수효과가 많은 모듈임에도 테스트 파일이 없습니다. 다른 스토어(`auth-store`, `editor-store` 등)는 모두 테스트가 존재합니다.
- **제안**: `locale-store.test.ts` 신규 작성. `vi.stubGlobal("localStorage", ...)`, `vi.stubGlobal("document", ...)` 패턴으로 사이드이펙트 격리 후 각 시나리오 커버.

---

### [WARNING] `LocaleSync` 컴포넌트 — 테스트 없음

- **위치**: `frontend/src/lib/i18n/locale-sync.tsx`
- **상세**: 앱 진입점(`providers.tsx`)에 등록된 컴포넌트로, localStorage 초기화와 `user.locale` 동기화 두 가지 사이드이펙트를 담당합니다. 양쪽 효과 모두 테스트되지 않아 로케일이 올바르게 초기화되는지 회귀 검증이 불가합니다.
- **제안**: `@testing-library/react`로 `renderHook` 또는 컴포넌트 렌더링 후 store 상태 검증.

---

### [WARNING] `STATUS_FILTERS`의 "all" 항목에 잘못된 번역 키 사용 (copy-paste 오류)

- **위치**: `frontend/src/app/(main)/integrations/page.tsx:57`
- **상세**: 
  ```ts
  const STATUS_FILTERS = [
    { value: "all", labelKey: "integrations.scopeAll" },  // ← scopeAll은 scope 필터용 키
  ```
  상태 필터의 "all"이 scope 필터와 동일한 키 `"integrations.scopeAll"`을 재사용합니다. 현재는 번역 값이 동일("All")하여 화면상 문제는 없지만, 향후 두 컨텍스트의 번역이 달라지면 오류가 됩니다. 어떤 테스트도 이 의미적 불일치를 잡지 못합니다.
- **제안**: `{ value: "all", labelKey: "integrations.statusAll" }` 전용 키 사용 및 dict 파일 추가.

---

### [WARNING] `termsAgreeHtml` 템플릿 분할 로직 — 테스트 없음

- **위치**: `frontend/src/components/auth/register-form.tsx:189-230`
- **상세**: null-byte 센티넬(`\u0000TERMS\u0000`, `\u0000PRIVACY\u0000`)로 번역 문자열을 분할하는 인라인 로직이 있습니다. 만약 번역 템플릿에 두 센티넬이 모두 없거나 순서가 다를 경우 `parts[1]`, `parts[2]`가 `undefined`가 되어 런타임 오류가 발생합니다. 이 분기 로직은 완전히 테스트되지 않습니다.
- **제안**: 이 로직을 독립 유틸 함수로 추출하고 단위 테스트 추가:
  ```ts
  // 정상 케이스, 센티넬 누락 케이스, 순서 반전 케이스 각각 테스트
  ```

---

### [WARNING] `getPasswordStrength` — `TFunction` 의존성 추가 후 테스트 없음

- **위치**: `register-form.tsx:34`, `reset-password-form.tsx:23`
- **상세**: 이 순수 함수에 `t: TFunction` 파라미터가 추가되어 테스트 시 mock이 필요해졌습니다. 기존에도 테스트가 없었으나 변경으로 인해 테스트 작성 필요성이 더 커졌습니다. 5단계 강도 분기(weak/fair/good/strong/very strong)가 검증되지 않습니다.
- **제안**: 함수를 컴포넌트 외부 파일로 분리하고 단위 테스트 작성.

---

### [WARNING] `currentLocale()` in `date.ts` — 비-React 컨텍스트에서의 동작 미검증

- **위치**: `frontend/src/lib/utils/date.ts:11-13`
- **상세**: `locale-store`는 `"use client"` 모듈이며, `currentLocale()`은 `useLocaleStore.getState()`를 직접 호출합니다. `date.test.ts`의 모든 테스트는 `locale` 파라미터를 명시적으로 전달하여 이 경로를 우회합니다. 따라서 파라미터 미전달 시 기본 locale 해석 경로(`locale ?? currentLocale()`)는 전혀 테스트되지 않습니다.
- **제안**: `locale` 파라미터 없이 호출하는 테스트 케이스 추가. 또는 `currentLocale` 의존성을 주입 가능하게 구조화.

---

### [INFO] `formatDate`의 `"date"` format 분기 묵시적 제거

- **위치**: `frontend/src/lib/utils/date.ts`
- **상세**: 원본 코드의 `if (format === "date") { ... }` 분기가 diff에서 삭제됐지만 `date.test.ts`는 여전히 `formatDate("...", "date", "en")`를 테스트합니다. 삭제 후 `"date"` 형식은 default 분기로 fallthrough되어 동일한 출력을 내므로 테스트는 통과하지만, 이 동작 변경이 의도적임을 명시하는 테스트나 주석이 없어 코드 의도 파악이 어렵습니다.

---

### [INFO] `Section` 컴포넌트의 `void t` — 사용되지 않는 prop

- **위치**: `frontend/src/app/(main)/integrations/page.tsx:375`
- **상세**: `Section` 컴포넌트에 `t: TFunction` prop이 추가됐지만 `void t`로만 처리됩니다. 이는 미완성 구현의 흔적으로 보이며, 테스트가 없어 추후 사용 여부도 확인이 안 됩니다.

---

## 요약

이번 i18n 적용 작업은 `translate()`, `isLocale()`, `timeAgo()` 등 핵심 유틸리티에 대한 기본 테스트가 잘 갖춰져 있습니다. 그러나 **Zod 스키마를 컴포넌트 내부에서 `t()`로 생성하는 패턴**은 React Hook Form의 resolver 캡처 특성과 충돌하여 로케일 전환 시 유효성 메시지가 갱신되지 않는 실제 버그를 만들어냅니다. 아울러 `formatDuration`, `locale-store`, `LocaleSync`는 사이드이펙트가 많은 모듈임에도 테스트가 전혀 없으며, `STATUS_FILTERS`의 copy-paste 오류와 `termsAgreeHtml`의 취약한 문자열 분할 로직은 현재 어떤 테스트로도 감지되지 않는 잠재적 결함입니다.

## 위험도

**HIGH**