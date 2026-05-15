## 발견사항

---

### [CRITICAL] `@radix-ui/react-focus-scope` 가 devDependencies에 배치
- **위치**: `frontend/package.json` — `devDependencies` 섹션
- **상세**: `FocusScope`는 `src/components/ui/slide-drawer.tsx` 라는 프로덕션 컴포넌트에서 직접 import됩니다. `devDependencies`에 놓이면 `npm ci --omit=dev` 후 빌드 시 resolve 실패가 발생할 수 있습니다. Next.js 의 CI/CD 파이프라인이 빌드 전 devDependencies를 제거하는 경우 실제 프로덕션 배포가 깨집니다.
- **제안**: `dependencies`로 이동
  ```json
  "dependencies": {
    "@radix-ui/react-focus-scope": "^1.1.8",
    ...
  }
  ```

---

### [CRITICAL] `termsAccepted` 체크박스의 ARIA 에러 연결 누락
- **위치**: `frontend/src/components/auth/register-form.tsx` — `termsAccepted` input 영역
- **상세**: 동일 파일 내 `name`, `email`, `password` 필드는 모두 `aria-invalid` + `aria-describedby`가 추가되었으나, `termsAccepted` 체크박스에는 누락됩니다. 에러 `<p id="terms-error">` 는 존재하지만 input과 프로그래매틱 연결이 없어 스크린 리더가 오류를 읽지 못합니다. 이 PR이 해결하려는 WCAG 1.3.1 / 4.1.3 요건을 충족하지 못합니다.
- **제안**:
  ```tsx
  <input
    type="checkbox"
    aria-invalid={errors.termsAccepted ? "true" : undefined}
    aria-describedby={errors.termsAccepted ? "terms-error" : undefined}
    {...register("termsAccepted")}
  />
  ```

---

### [WARNING] aria-label 하드코딩 영문 — i18n 미처리
- **위치**:
  - `slide-drawer.tsx` L67: `aria-label="Close"`
  - `service-picker-modal.tsx` L35: `aria-label="Close"`
  - `mcp-server-selector.tsx` L124: `aria-label="Remove"`
- **상세**: 동일 PR에서 추가된 다른 컴포넌트들 (`authentication/page.tsx`, `llm-configs/page.tsx` 등)은 `t("common.close")`, `t("common.delete")`를 사용합니다. 위 세 파일은 영문 리터럴로 하드코딩되어 한국어 로케일에서 "Close" / "Remove" 가 그대로 노출됩니다. i18n 요구사항과 불일치합니다.
- **제안**: `slide-drawer.tsx`와 `service-picker-modal.tsx`에 `useT()` 훅을 추가하고 `t("common.close")` 사용. `mcp-server-selector.tsx`는 `t("common.remove")` 또는 적절한 키 사용.

---

### [WARNING] FocusScope `autoFocus` / 포커스 복귀 동작 미확인
- **위치**: `frontend/src/components/ui/slide-drawer.tsx`
- **상세**: `FocusScope`는 `trapped={open}` 만 설정하고 `onMountAutoFocus` / `onUnmountAutoFocus` 는 설정하지 않습니다. Radix `@1.1.8` 기본 동작이 드로어 열림 시 첫 포커서블 요소로 이동하고, 닫힐 때 트리거로 복귀하는지 검증이 필요합니다. 버전에 따라 기본값이 다를 수 있어, 스크린 리더 + 키보드 사용자 흐름이 요구사항(`Stage 10 NF-A11Y`)에 명시된 포커스 복귀를 만족하지 못할 수 있습니다.
- **제안**: `onMountAutoFocus`를 명시하여 초기 포커스를 닫기 버튼이나 첫 포커서블 요소로 보내는지 확인하고, 필요 시 `returnFocus` 동작을 명시적으로 처리.

---

### [WARNING] "전체 위반 보고" 테스트 — assertion 없음으로 CI 게이트 무효
- **위치**: `frontend/e2e/a11y/smoke.spec.ts` L46–L66
- **상세**: `"axe scan: 전체 위반 보고 (assertion 없음)"` 테스트는 어떤 위반이 존재해도 항상 pass합니다. 주석에서 "점진적으로 0으로 끌어내릴 예정"이라고 명시하지만 이 테스트가 CI에 포함될 경우 regression을 감지하지 못하는 dead test가 됩니다. 현재 명칭과 구조로는 테스트 수는 늘어나지만 품질 게이트 역할을 하지 못합니다.
- **제안**: `test.skip()` 처리하여 CI에서 제외하거나, 별도 reporting 스크립트로 분리. 또는 Step F 도달 시 assertion을 추가하는 명확한 follow-up 이슈를 트래킹.

---

### [INFO] `three` 버전 범위 변경 — `^` → `~`
- **위치**: `frontend/package.json`
- **상세**: `"three": "^0.184.0"` → `"three": "~0.184.0"`. patch 릴리즈만 허용하도록 좁아졌습니다. 이 변경이 이번 a11y 스코프와 무관하게 포함된 이유가 PR 설명에 없어 의도가 불명확합니다.
- **제안**: 의도적인 변경이라면 커밋 메시지나 PR 설명에 이유 추가.

---

### [INFO] `schedules/page.tsx` — `title` + `aria-label` 중복
- **위치**: `frontend/src/app/(main)/schedules/page.tsx` L1064, L1074
- **상세**: 편집·삭제 버튼에 `title`과 `aria-label`이 동일한 값으로 설정됩니다. `aria-label`이 accessible name이 되므로 `title`은 중복이지만 기능상 문제는 없습니다. 다만 tooltip(`title`)이 스크린 리더에서 이중으로 읽힐 수 있습니다.
- **제안**: `title` 제거 또는 다른 설명으로 분리. 단, 우선순위 낮음.

---

## 요약

이번 변경은 WCAG 2.1 AA 적합성을 위한 광범위한 a11y 개선으로, 랜드마크 시맨틱(`<nav>`, `<main>`), 스킵 내비게이션, 폼 오류 ARIA 연결, 아이콘 버튼 레이블, 다이얼로그 포커스 트랩, 실행 상태 live region 등의 핵심 요구사항을 체계적으로 구현했습니다. 그러나 **`@radix-ui/react-focus-scope`의 devDependencies 배치**(프로덕션 빌드 파손 위험)와 **`register-form.tsx` `termsAccepted` 체크박스의 ARIA 에러 연결 누락**(이 PR이 달성하려는 WCAG 요건 미충족)이라는 두 가지 Critical 이슈가 있으며, 세 군데의 aria-label 하드코딩 영문 문자열이 i18n 일관성을 깨뜨리는 Warning도 수정이 필요합니다.

## 위험도

**HIGH**