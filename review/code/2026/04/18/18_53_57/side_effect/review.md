## 발견사항

---

### [WARNING] 로케일 변경 시 폼 전체 언마운트/리마운트

- **위치**: `forgot-password-form.tsx`, `login-form.tsx`, `register-form.tsx`, `reset-password-form.tsx` — 각 파일 하단의 public export wrapper
- **상세**: `key={locale}`을 사용해 로케일 변경 시 내부 폼 컴포넌트를 완전히 언마운트·리마운트합니다. Zod 검증 메시지 갱신을 위한 의도된 패턴이지만, **사용자가 입력 도중 언어를 변경하면 폼의 모든 상태(입력값, 에러 메시지, `isLoading`, `isSubmitted` 등)가 소멸**됩니다. 특히 `ResetPasswordForm`은 `setTimeout(() => router.push("/login"), 3000)` 진행 중에 리마운트가 발생하면 타이머가 유실됩니다.
- **제안**: 폼 진행 중 로케일 변경을 비활성화하거나, 최소한 `isLoading`이나 `isSubmitted` 상태에서는 로케일 스위처를 disabled 처리하는 방어 로직 추가를 권장합니다.

---

### [WARNING] `STATUS_LABEL` → `getStatusLabel` 시그니처 변경

- **위치**: `executions/page.tsx` — import 구문
- **상세**: `execution-status` 유틸에서 `STATUS_LABEL` (객체 상수) 대신 `getStatusLabel` (함수)를 가져오도록 변경되었습니다. 이 diff에는 해당 유틸 파일의 변경이 포함되어 있지 않아, **다른 파일에서 `STATUS_LABEL`을 직접 import하고 있다면 런타임 또는 빌드 오류**가 발생할 수 있습니다.
- **제안**: `execution-status.ts`에서 기존 `STATUS_LABEL` export를 제거했는지, 다른 import 사용처가 없는지 codebase 전체를 grep으로 확인하세요.

---

### [WARNING] `DocBodyNotice` 무조건 렌더링

- **위치**: `docs/[...slug]/page.tsx` — `<DocBodyNotice />` 삽입
- **상세**: 이 컴포넌트는 diff에 정의가 없어 내부 로직을 확인할 수 없습니다. README 설명에 따르면 "영어 세션에서만 번역 진행 중 안내를 표시"해야 하는데, 해당 조건 분기가 컴포넌트 내부에 있지 않고 항상 렌더링되는 구조라면 **한국어 사용자에게도 불필요한 배너가 노출**될 수 있습니다.
- **제안**: `DocBodyNotice` 구현을 직접 확인하여 `locale === 'ko'`일 때 `null`을 반환하는지 검증하세요.

---

### [INFO] 비동기 콜백 내 로케일 캡처 타이밍

- **위치**: `verify-email-content.tsx:35`, `editor-loader.tsx:25`, `accept-invitation-content.tsx:39`
- **상세**: 비동기 함수 진입 시점에 `useLocaleStore.getState().locale`을 캡처합니다. 비동기 작업(API 호출) 완료 전 사용자가 로케일을 변경하면 **이전 로케일 기준의 toast 메시지**가 표시됩니다.
- **제안**: 수용 가능한 수준의 트레이드오프입니다. 단, 이 동작이 의도임을 주석으로 명시하면 유지보수에 도움이 됩니다.

---

### [INFO] `formatDuration` 동작 변경

- **위치**: `dashboard/page.tsx` — 로컬 함수 제거 후 `@/lib/utils/date`에서 import
- **상세**: `execution-list-page.test.tsx`에서 `"1.0s"` → `"1s"`로 기대값이 변경된 것으로 보아, 이동된 `formatDuration`의 출력 포맷이 소수점 없이 정수로 표시되도록 바뀌었습니다. 대시보드와 실행 목록 페이지가 동일 함수를 공유하게 되어 일관성은 향상되지만, **기존에 `"1.0s"` 형식을 기대하던 다른 스냅샷 테스트나 UI가 있다면 영향을 받습니다**.
- **제안**: 공유 `formatDuration`의 변경 범위를 전체 코드베이스에서 확인하세요.

---

### [INFO] `IntegrationSelector` `label` prop 기본값 제거

- **위치**: `integration-selector.tsx:17`
- **상세**: `label = "Integration"` 기본값이 제거되고, 컴포넌트 내부에서 `label ?? t("nodeConfigs.integrationSelector.label")`로 처리됩니다. 런타임 동작은 동일하지만, **TypeScript 타입상 `label`이 선택적 prop으로 유지되면서 기본값이 컴포넌트 시그니처에서 보이지 않게** 됩니다. 호출자 코드를 수정할 필요는 없으나, 새 기여자가 API를 이해하기 어려울 수 있습니다.
- **제안**: JSDoc 또는 인터페이스 주석으로 기본값 동작을 명시하는 것을 고려하세요.

---

### [INFO] React 조정 키 변경

- **위치**: `dashboard/page.tsx:189` (`card.label` → `card.labelKey`), `canvas-empty-state.tsx:70` (`step.title` → `step.titleKey`)
- **상세**: `key` prop이 번역된 문자열에서 번역 키 문자열로 변경됩니다. 번역 키는 로케일과 무관하게 안정적이므로, **로케일 변경 시 React가 기존 컴포넌트를 재사용(재조정)**합니다. 이전에는 로케일 변경 시 `key`가 바뀌어 불필요한 재마운트가 발생했을 수 있으므로, 오히려 개선된 동작입니다.

---

### [INFO] Zustand 스토어 직접 setState (테스트)

- **위치**: 모든 테스트 파일의 `beforeEach(() => { useLocaleStore.setState({ locale: "en" }); })`
- **상세**: 테스트 간 격리는 `beforeEach`로 보장되어 문제없습니다. 단, 테스트 종료 후 `afterEach`에서 기본값(`ko`)으로 복원하지 않으므로, 같은 프로세스 내 다른 `describe` 블록이 `beforeEach` 없이 로케일에 의존한다면 예상치 못한 영향을 받을 수 있습니다. 현재 코드 범위에서는 모든 테스트가 `beforeEach`를 명시하고 있어 즉각적인 문제는 없습니다.

---

## 요약

이번 변경의 핵심은 하드코딩된 문자열을 `useT()`/`translate()` 기반 i18n으로 교체하는 것으로, 전반적으로 부작용이 잘 통제되어 있습니다. 가장 주목할 부작용은 **auth 폼의 `key={locale}` 패턴**으로, 로케일 전환 시 폼 상태가 초기화되는 의도된 동작이지만 입력 도중 전환 시 UX 저하와 진행 중인 타이머 소멸 위험이 있습니다. `STATUS_LABEL` → `getStatusLabel` 시그니처 변경은 해당 export를 사용하는 다른 파일가 있을 경우 빌드 오류로 이어질 수 있어 별도 검증이 필요합니다. 나머지 변경은 텍스트 치환 수준으로 부작용 위험도가 낮습니다.

## 위험도

**LOW** (단, `STATUS_LABEL` export 제거 여부와 `DocBodyNotice` 조건 분기 미확인 시 MEDIUM으로 상향)