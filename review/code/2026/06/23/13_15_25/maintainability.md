# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

### [WARNING] `postBoot` 함수가 컴포넌트 렌더 사이클 외부에서 `widgetOrigin` 클로저를 캡처
- 위치: `/Volumes/project/private/clemvion/codebase/frontend/src/components/web-chat/live-preview.tsx` L80–85 (`postBoot` 함수)
- 상세: `postBoot`는 컴포넌트 본문에 일반 함수로 선언되어 있어 매 렌더마다 재생성된다. 이 함수는 `widgetOrigin` 변수를 클로저로 캡처하는데, `widgetOrigin`이 실제로는 안정적 값이지만, `useCallback`으로 감싸지 않은 채 두 번째 `useEffect`(`[bootConfig, status]`)의 의존 배열에서 eslint-disable-next-line으로 억제된 채 사용된다. `eslint-disable-next-line react-hooks/exhaustive-deps` 주석이 두 곳(`L105`, `L111`)에 붙어 있어, 미래 유지보수 시 의존 배열과 실제 사용 변수 간 관계가 불투명해진다. `useCallback`으로 `postBoot`를 메모이제이션하거나, 함수를 effect 내부로 이전하면 eslint-disable 억제 없이 명확한 의존 관계를 표현할 수 있다.
- 제안: `postBoot`를 두 번째 `useEffect` 내부로 인라인하거나, `useCallback(postBoot, [widgetOrigin])` + `bootConfigRef` 패턴을 결합하여 eslint-disable 억제를 제거한다.

### [WARNING] plan 파일의 Phase 3 체크박스가 실제 구현 완료 상태를 반영하지 않음
- 위치: `/Volumes/project/private/clemvion/plan/in-progress/web-chat-console.md` L1411–1413
- 상세: Phase 3의 두 번째·세 번째·네 번째 항목(`콘솔 내 contained same-origin iframe 임베드`, `동봉 미설정 시 fallback`, `unit 테스트`)이 `[ ]`(미완) 상태이나, 실제 이번 커밋에서 `LivePreview` 컴포넌트(iframe 임베드 + wc:boot 전달 + fallback placeholder), `live-preview.test.tsx`(4개 테스트)가 모두 구현·완료되었다. plan과 구현 상태의 불일치는 이후 진척 파악이나 merge 시 혼란을 야기한다.
- 제안: 이번 커밋과 함께 해당 항목들을 `[x]`로 표시하거나, Phase 4의 ai-review 항목처럼 완료 상태를 명시한다.

### [WARNING] `copy-widget.mjs`에 하드코딩된 패키지 필터 문자열
- 위치: `/Volumes/project/private/clemvion/codebase/frontend/scripts/copy-widget.mjs` L14, L17
- 상세: `pnpm --filter channel-web-chat build`와 `pnpm --filter @workflow/web-chat build:loader`에서 패키지 이름이 하드코딩되어 있다. 패키지 이름이나 빌드 스크립트가 바뀌면 이 파일도 함께 수정해야 하는데, 해당 사실이 코드 내에 명시되지 않는다. 반면 경로 상수(`widgetDir`, `sdkDir` 등)는 명시적으로 선언되어 있어 일관성이 부족하다.
- 제안: 파일 상단에 상수(`WIDGET_PACKAGE_FILTER`, `SDK_PACKAGE_FILTER` 등)로 분리하거나, 주석에 해당 값이 어디(package.json의 name 필드)에서 유래하는지 명시한다.

### [WARNING] `getWidgetOrigin()`의 SSR 환경 처리와 기존 패턴의 미일관성
- 위치: `/Volumes/project/private/clemvion/codebase/frontend/src/lib/web-chat/widget-base.ts` L1252–1261
- 상세: 같은 파일 내 `getWidgetBase()`는 SSR(`window` 없음) 시 빈 문자열을 직접 반환하는 단순 패턴이다. 반면 `getWidgetOrigin()`은 `getWidgetBase()`를 호출한 후 이미 빈 문자열 방어(`if (!base) return ""`)를 수행하고, 그 위에 `new URL(base, ref)`에서 또 다른 `try/catch`를 추가한다. `getWidgetBase()`가 이미 절대 URL 또는 `""`을 반환하므로, 절대 URL에 `new URL(base, ref)`를 적용하면 `ref`는 무시된다. 즉 `ref` 변수와 `typeof window !== "undefined"` 분기가 불필요하게 추가된 복잡도이다.
- 제안: `getWidgetBase()`가 절대 URL을 반환함을 확인하고, `try { return new URL(base).origin; } catch { return ""; }` 로 단순화한다. `window.location.href`를 base로 넘기는 분기는 제거한다.

### [INFO] `live-preview.test.tsx`에서 `waitFor` import가 사용되지 않음
- 위치: `/Volumes/project/private/clemvion/codebase/frontend/src/components/web-chat/__tests__/live-preview.test.tsx` L2
- 상세: `import { ..., waitFor } from "@testing-library/react"` 에서 `waitFor`가 import되었으나 테스트 본문에서 사용되지 않는다. 미사용 import는 파일을 읽는 유지보수자가 해당 심볼이 어디서 쓰이는지 찾도록 유도하는 혼란 요소다.
- 제안: `waitFor` import를 제거한다.

### [INFO] `live-preview.tsx`에서 매직 넘버 `320` (px) 중복 사용
- 위치: `/Volumes/project/private/clemvion/codebase/frontend/src/components/web-chat/live-preview.tsx` L1117, L1123
- 상세: `min-h-[320px]`(컨테이너)와 `h-[320px]`(iframe)에 `320`이 Tailwind arbitrary value로 두 번 반복된다. `READY_TIMEOUT_MS`처럼 상수로 추출되어 있지 않아, 높이를 조정할 때 두 곳을 각각 수정해야 한다.
- 제안: CSS 변수 또는 Tailwind 커스텀 토큰으로 추출하거나, 최소한 하나의 값을 다른 값에서 파생시키는 구조로 정리한다.

### [INFO] `copy-widget.mjs` 최상위 레벨 실행 코드와 함수 정의의 혼재
- 위치: `/Volumes/project/private/clemvion/codebase/frontend/scripts/copy-widget.mjs` 전체
- 상세: 파일은 상수 선언 → `run()` 함수 정의 → 즉시 실행 코드(빌드·복사) 순으로 구성되어 있다. 빌드·복사 단계가 최상위 레벨에 순차적으로 흩어져 있어 단계별 경계가 불명확하다. `run()`을 제외하면 나머지 단계가 함수화 없이 모두 최상위에 있어, 향후 단계 추가나 오류 처리 세분화 시 구조 파악이 어려워진다. 현재 규모에서는 허용 범위이나 스크립트가 커질 경우 리팩터링 비용이 누적된다.
- 제안: `buildWidget()`, `buildSdkLoader()`, `copyArtifacts()` 형태의 함수로 단계를 분리하고 최하단에서 순차 호출하는 패턴을 고려한다. 현 규모에서는 INFO 수준이다.

---

## 요약

전반적으로 코드는 잘 구조화되어 있고, 주석·JSDoc·spec 참조가 충실하며, 상수 추출(`READY_TIMEOUT_MS`)과 역할 분리(두 개의 `useEffect`)도 적절하다. 가장 주의할 사항은 `LivePreview`의 `postBoot` 클로저 패턴으로, `eslint-disable` 억제가 두 곳에 걸쳐 있어 향후 hooks 의존 배열 오류를 정적 분석으로 잡지 못할 위험이 있다. plan 파일의 Phase 3 체크박스 불일치는 팀 진척 파악에 혼란을 주므로 조속히 갱신이 필요하다. `getWidgetOrigin()`의 불필요한 복잡도와 미사용 import, 매직 넘버 중복은 낮은 우선순위의 점진적 개선 대상이다.

## 위험도

LOW
