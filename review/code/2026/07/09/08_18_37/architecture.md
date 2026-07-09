# Architecture Review — 슬러그 라우팅 round-2 (commit 6248480)

## 리뷰 범위

실질 코드 변경은 4개 TS 파일뿐이다(나머지 7개는 CHANGELOG/RESOLUTION/spec 문서):

- `codebase/frontend/src/lib/stores/workspace-store.ts` — `setWorkspaces` 폴백 로직을 `resolveFallbackWorkspace` 위임으로 교체
- `codebase/frontend/src/lib/workspace/resolve-fallback.ts` — 문서 주석 갱신(3번째 소비처 추가 명시)
- `codebase/frontend/src/lib/workspace/href.ts` — `buildWorkspaceHref` 에 backslash/제어문자(tab/CR/LF) 정규화 추가
- `codebase/frontend/src/lib/workspace/__tests__/href.test.ts` — 회귀 테스트 추가

전 라운드(0708 18:24 ai-review) 의 Warning(W3 DRY 미완성, W4 open-redirect 1차 방어) 을 좁게 완결하는 후속 커밋이다.

## 발견사항

- **[WARNING]** open-redirect 방어 로직이 두 모듈에 중복·비대칭으로 존재
  - 위치: `codebase/frontend/src/lib/workspace/href.ts`(`buildWorkspaceHref`, 본 diff에서 backslash/tab/CR/LF 정규화 추가) vs `codebase/frontend/src/components/ui/error-page.tsx:36-43`(`isSafeRedirectPath`, `pathname.startsWith("//")` 만 검사)
  - 상세: 둘 다 "내부 전용 경로인지" 를 판정하는 동일 클래스의 보안 경계(open-redirect 방어)이지만 별도 파일에 독립 구현되어 있다. 이번 라운드는 `buildWorkspaceHref` 만 WHATWG URL 의 backslash/제어문자 우회 클래스까지 정규화하도록 강화했고, `isSafeRedirectPath` 는 여전히 `//` 만 걷어낸다 — `pathname` 값이 `/\evil.com` 또는 `/\t/evil.com` 형태라면 `isSafeRedirectPath` 는 `true`(안전) 로 오판한다(같은 WHATWG 파서가 `\`/tab/CR/LF 를 `/` 와 동등 취급하는 것은 동일). 현재는 `isSafeRedirectPath` 의 입력이 `usePathname()`(same-origin 라우트) 이고, `/login?redirect=` 값을 실제로 소비해 navigate 하는 코드가 없어(로그인 성공 후 `login-form.tsx` 는 무조건 `/dashboard`) 실질 도달 불가하다 — 다만 `proxy.ts`/`auth-provider.tsx`/`(main)/error.tsx` 세 곳이 이미 "나중에 redirect 파라미터를 소비" 하는 배선을 깔아 둔 상태라, 향후 그 소비 로직이 추가되는 순간 이번에 고친 우회 클래스가 반대편에서 재현될 위험이 있다. 또한 보안 경계 함수(`isSafeRedirectPath`)가 UI 컴포넌트 파일(`components/ui/error-page.tsx`) 안에 정의되어 있어 레이어 책임(프레젠테이션 vs 횡단 관심사)도 다소 흐리다.
  - 제안: `isSafeInternalPath`/`sanitizeInternalPath` 류 단일 유틸을 `lib/` 레벨(예: `lib/utils/safe-path.ts`)로 추출해 `buildWorkspaceHref`·`isSafeRedirectPath`(및 향후 `redirect` 파라미터 소비 코드)가 공유하도록 통합. 최소한 이번 정규화 클래스(backslash/tab/CR/LF)를 `isSafeRedirectPath` 에도 동일 적용하는 후속 커밋을 권장.

- **[WARNING]** `workspace-store.ts` ↔ `resolve-fallback.ts` 간 type-only 순환 참조가 lint 로 강제되지 않음
  - 위치: `codebase/frontend/src/lib/stores/workspace-store.ts:5`(`import { resolveFallbackWorkspace } from "@/lib/workspace/resolve-fallback"`) ↔ `codebase/frontend/src/lib/workspace/resolve-fallback.ts:1`(`import type { WorkspaceSummary } from "@/lib/stores/workspace-store"`)
  - 상세: 커밋 메시지가 "type-only import 라 런타임 순환 없음" 이라고 명시하는데, 이는 정확하다(TS 는 `import type` 을 컴파일 시 완전히 소거). 다만 이 안전성은 **컨벤션에 의존**할 뿐 도구로 강제되지 않는다 — repo `eslint.config.mjs` 에 `@typescript-eslint/consistent-type-imports` 나 `import/no-cycle` 같은 규칙이 없다(확인함). 향후 누군가 `resolve-fallback.ts` 에 `WorkspaceSummary` 외에 store 의 런타임 값(예: 헬퍼 함수)을 추가로 참조하며 `import type` 을 빠뜨리면, 두 모듈 간 실제 런타임 순환 require 가 조용히 재도입될 수 있다.
  - 제안: `WorkspaceSummary` 타입을 `lib/workspace/types.ts` 같은 중립 위치로 옮겨 `workspace-store.ts`/`resolve-fallback.ts` 양쪽이 그 타입만 import 하도록 하면 형식적으로도 순환이 사라진다. 비용이 부담되면 최소한 `@typescript-eslint/consistent-type-imports`(`fixStyle: "inline-type-imports"`) lint 규칙 추가를 권장.

- **[INFO]** DRY 통합 자체는 아키텍처 개선으로 양호
  - 위치: `codebase/frontend/src/lib/stores/workspace-store.ts:44-48`(`setWorkspaces`), `codebase/frontend/src/lib/workspace/resolve-fallback.ts`
  - 상세: 동일한 "현재 id 유지, 없으면 첫 항목" 폴백 정책이 세 소비처(`[slug]` layout, `(main)/[...rest]` catch-all, `workspace-store.setWorkspaces`)에 흩어져 있던 것을 단일 순수 함수로 수렴시켰다. SRP(스토어는 상태만 소유, 정책은 도메인 함수가 소유)·단일 진실 원칙에 부합하며, 정책 변경 시 한 곳만 고치면 되는 구조로 확장성도 확보했다. `resolve-fallback.ts` 주석이 `useWorkspaceSlug`(다른 정책: first-workspace 폴백 없음)와의 구분을 명시해 정책 혼동도 미리 방지했다.

- **[INFO]** `buildWorkspaceHref` 가 "slug prefix 부여"와 "경로 안전성 정규화" 두 책임을 한 함수에서 겸함
  - 위치: `codebase/frontend/src/lib/workspace/href.ts:16-21`
  - 상세: 현재는 정규화 로직이 2줄 regex 로 작아 문제되지 않지만, 이번 라운드에서 이미 한 단계 더 복잡해졌다(선두 슬래시 정규화 → 제어문자 제거 + 백슬래시 정규화). 위 open-redirect 통합 제안과 맞물려, 정규화 부분을 별도 named 함수(`sanitizeInternalPath`)로 뽑아두면 `isSafeRedirectPath` 등 다른 소비처와의 공유·단위 테스트가 쉬워진다.
  - 제안: 상단 WARNING 항목과 함께 처리 — 별도 유틸로 추출.

## 요약

이번 커밋은 이전 라운드 ai-review Warning(DRY 미완결·open-redirect 1차 방어) 을 좁게 마무리하는 저위험 후속 diff로, `resolveFallbackWorkspace` 단일 진실 소스로의 수렴은 SRP/DRY 관점에서 명확한 개선이다. 다만 이 과정에서 (a) open-redirect 방어 로직이 `href.ts`와 `error-page.tsx` 두 곳에 비대칭 수준으로 중복 존재하는 기존 구조적 갭이 이번 강화로 오히려 두드러졌고(향후 `redirect` 쿼리 파라미터 소비 로직이 추가되면 재현 가능한 우회 클래스), (b) store↔workspace-lib 간 type-only 순환 참조가 lint 도구 없이 컨벤션에만 의존한다는 두 가지 architecture-level 리스크가 남아 있다. 둘 다 현재 시점에는 도달 불가/컴파일 타임 소거로 안전하지만, 향후 변경에 의해 실제 결함으로 발현될 수 있는 잠재 리스크이므로 별도 후속 커밋으로 정리를 권장한다.

## 위험도

LOW
