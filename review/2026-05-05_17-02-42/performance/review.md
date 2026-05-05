## 성능 코드 리뷰

### 발견사항

---

**[WARNING] E2E 테스트 — 동일 페이지 이중 axe 스캔**
- **위치**: `frontend/e2e/a11y/smoke.spec.ts` — `a11y smoke — login page` describe 블록
- **상세**: `"axe scan: critical 위반 0"` 테스트(L18)와 `"axe scan: 전체 위반 보고"` 테스트(L48)가 각각 독립적으로 `page.goto("/login")` → `new AxeBuilder({page}).withTags([...]).analyze()` 를 실행한다. axe-core 스캔은 전체 DOM을 순회하는 비용이 높은 연산으로, 동일 태그 셋으로 같은 페이지를 두 번 분석하는 것은 중복이다. `test.beforeEach` 또는 Playwright fixture로 스캔 결과를 공유하거나 두 assertion을 하나의 테스트로 통합하면 테스트 suite 실행 시간을 의미 있게 단축할 수 있다.
- **제안**:
  ```ts
  let scanResults: AxeResults;
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    scanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
  });
  test("axe scan: critical 위반 0", () => { /* scanResults 사용 */ });
  test("axe scan: 전체 위반 보고", () => { /* scanResults 사용 */ });
  ```

---

**[WARNING] `@radix-ui/react-focus-scope` devDependency 분류 오류 → 번들 리스크**
- **위치**: `frontend/package.json` L66, `frontend/src/components/ui/slide-drawer.tsx` L3
- **상세**: `@radix-ui/react-focus-scope@^1.1.8` 이 `devDependencies` 에 등록됐으나 `slide-drawer.tsx` 는 프로덕션 컴포넌트다. `devDependencies` 에 있는 패키지는 `npm install --omit=dev` (프로덕션 빌드) 환경에서 설치되지 않아 런타임 오류를 유발할 수 있다. 또한 package-lock 상 1.1.7(dialog/menu/popover nested), 1.1.8(dev top-level) 두 버전이 공존하여 번들에 양쪽이 포함될 가능성이 있다.
- **제안**: `dependencies` 로 이동하고, 가능하면 다른 Radix 패키지들이 이미 1.1.7을 사용 중이므로 버전 범위를 `^1.1.7` 로 통일해 중복 설치를 방지.

---

**[INFO] `aria-live` 빈번 업데이트 시 announce 폭증 가능성**
- **위치**: `frontend/src/components/editor/run-results/run-results-drawer.tsx` L288–L295
- **상세**: `role="status" aria-atomic="true" aria-live="polite"` 로 감싼 영역에 `statusLabel`과 노드 카운트(`completedNodes/totalNodes`)가 포함되어 있다. 워크플로 실행 중 노드가 연속으로 완료될 때마다 카운트가 증가하고, 각 상태 변경마다 스크린 리더가 전체 영역을 재읽는다. 짧은 시간 내 연속 갱신은 announce 큐에 쌓여 사용자 경험을 저하시킬 수 있다. 성능 자체보다 스크린 리더의 announce 처리 부하 문제다.
- **제안**: 노드 카운트 span을 `aria-live` 컨테이너 밖으로 분리하고 status(완료/실패/실행중 등 전환 시점)만 announce 범위에 포함하는 것을 검토.

---

**[INFO] `FocusScope` 닫힌 상태에서도 DOM에 상주**
- **위치**: `frontend/src/components/ui/slide-drawer.tsx` L57
- **상세**: `<FocusScope trapped={open}>` 은 `open=false` 일 때 트래핑을 해제하지만 컴포넌트 자체는 DOM에 유지된다. Radix FocusScope는 `trapped` 상태와 무관하게 포커스 이벤트 리스너를 등록할 수 있으므로, 드로어가 닫힌 상태에서도 문서 전체의 포커스 이벤트에 반응하는 미약한 오버헤드가 있다. 실제 지연이 체감될 수준은 아니나, `open` 이 false일 때 `null`을 반환하거나 조건부 렌더링으로 마운트 자체를 막는 방식이 더 명확하다.
- **제안**: `trapped={open}` 유지(현재 구현)는 허용 범위이나, 성능 민감 컨텍스트라면 `{open && <FocusScope>...</FocusScope>}` 형태로 전환 검토.

---

**[INFO] 다수 형식의 에러 조건 이중 평가 — 무시 가능 수준**
- **위치**: `login-form.tsx`, `register-form.tsx`, `reset-password-form.tsx`, `forgot-password-form.tsx` — `aria-invalid`/`aria-describedby` 패턴
- **상세**: `errors.email ? "true" : undefined` 와 `errors.email ? "email-error" : undefined` 가 같은 render 사이클에 두 번씩 평가된다. `errors.email` 은 단순 객체 프로퍼티 접근이므로 실질적 비용은 없다. 언급하는 이유는 패턴 일관성을 위해서이며, 실제 수정 불필요.

---

### 요약

이번 변경 세트는 a11y(접근성) 개선이 주목적으로, 성능에 직접 영향을 주는 알고리즘 변경이나 I/O 추가는 없다. 가장 실질적인 성능 이슈는 E2E 테스트에서 동일 페이지에 대한 axe 스캔을 중복 실행하는 것으로, CI 실행 시간을 불필요하게 늘린다. `@radix-ui/react-focus-scope`의 `devDependencies` 오분류는 프로덕션 빌드 환경에서 런타임 오류와 번들 이중 포함을 유발할 수 있으므로 수정이 필요하다. 나머지 변경들(ARIA 속성, i18n 키 추가, `nav`/`main` landmark, `CardTitle` 폴리모픽 프롭)은 성능 관점에서 무시할 수준이다.

### 위험도

**LOW**