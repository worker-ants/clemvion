## 발견사항

### [WARNING] React hook 불완전 의존성 (`new/page.tsx`)
- **위치**: `frontend/src/app/(main)/integrations/new/page.tsx` — popup close detection `useEffect`
- **상세**: `eslint-disable-next-line react-hooks/exhaustive-deps` 주석으로 경고를 억제하면서 `clearOAuthTimeout`, `previewToken`, `setOauthError`, `toast` 등 4개 외부 참조가 의존성 배열에서 누락되어 있다. `oauthWaiting`이 변경되지 않는 한 `previewToken` 최신 값을 읽지 못하는 stale closure 위험이 있다.
- **제안**: `useCallback`으로 내부 핸들러를 감싸거나, `useRef`로 `previewToken` 최신 값을 포착한 후 `[oauthWaiting, clearOAuthTimeout]`을 명시적 의존성으로 유지한다.

---

### [INFO] 변수명 오타 — `samMall` (`integration-oauth.service.ts`)
- **위치**: `integration-oauth.service.ts` — `beginCafe24Private` 메서드 내 `const samMall = existing.filter(…)`
- **상세**: 동일 쇼핑몰의 기존 행을 필터링하는 변수명이 `samMall`로 작성되어 있다. `sameMall`의 오타로 보인다. 기능에는 영향 없으나 가독성이 떨어진다.
- **제안**: `const sameMall = …`으로 수정한다.

---

### [INFO] 테스트 픽스처 필드명 암묵적 교정 (`status-badge.test.tsx`)
- **위치**: `status-badge.test.tsx` — `row()` 헬퍼 `lastCheckedAt`·`expiresAt` → `lastUsedAt`·`lastRotatedAt`
- **상세**: 이번 변경과 직접 관련 없는 필드명 교정이 테스트 픽스처에 포함되어 있다. 실제 `IntegrationDto` 인터페이스에 `lastCheckedAt`·`expiresAt`가 없어서 타입 정합을 위한 수정으로 보이지만, 본 PR scope 외의 픽스처 수정이다.
- **제안**: 범위 측면에서 큰 문제는 아니며 타입 안전성을 높이는 방향이므로 유지해도 무방하다. 단, 이 교정이 의도된 것임을 commit message 또는 주석에 명시하면 히스토리 추적이 쉬워진다.

---

### [INFO] `process()` 내 `new Date()` 3회 분리 생성 (`integration-expiry-scanner.service.ts`)
- **위치**: `integration-expiry-scanner.service.ts` — `process()` 메서드
- **상세**: 이전에는 `run()`·`pruneUsageLogs()`가 단일 흐름으로 연결되었으나, 변경 후 세 메서드(`run`, `expirePendingInstalls`, `pruneUsageLogs`)가 각각 `new Date()`를 독립 생성한다. 같은 job 내에서 각 메서드의 기준 시각이 미세하게 달라질 수 있다.
- **제안**: 기능상 영향은 거의 없고 plan의 "독립 실행" 의도와 일치한다. 필요하다면 `const now = new Date()`를 한 번 생성하여 세 메서드에 전달하는 방식으로 일관성을 높일 수 있다.

---

## 요약

16개 소스 파일과 1개 plan 문서에 걸친 변경 전체가 `plan/in-progress/cafe24-pending-polish.md`의 변경 0~5 항목에 직접 대응한다. 관련 없는 파일 수정, 불필요한 리팩토링, 의도 외 기능 추가는 발견되지 않았다. 다만 `new/page.tsx`의 React hook 의존성 누락은 stale closure 버그로 이어질 수 있어 수정이 권장된다.

## 위험도

**LOW**