# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

### 파일 3: docs-mobile-sidebar.tsx

- **[WARNING]** labeled break (`outer:`) 사용
  - 위치: `docs-mobile-sidebar.tsx` L560–568 (`outer: for ... break outer`)
  - 상세: JavaScript의 labeled break는 Go나 Java와 달리 JavaScript/TypeScript 코드베이스에서 매우 드물게 사용되며, 협업자가 처음 마주쳤을 때 가독성 저하를 유발한다. 기능적으로는 올바르나 관용적이지 않다.
  - 제안: `Array.prototype.flatMap`/`find` 조합으로 교체하거나, 별도 헬퍼 함수(`findActivePageInfo(sections, pathname, locale): { sectionLabel, pageTitle }`)로 추출해 early return 을 사용하면 중첩 + label 을 모두 제거할 수 있다.

  ```tsx
  // 개선 예시
  function findActivePageInfo(
    sections: DocsSection[],
    pathname: string,
    locale: Locale,
  ): { sectionLabel: string; pageTitle: string } {
    for (const section of sections) {
      for (const page of section.pages) {
        if (localizedDocsHref(page.slug, locale) === pathname) {
          return {
            sectionLabel: localizedSectionLabel(section.key, locale),
            pageTitle: localizedTitle(page.frontmatter, locale),
          };
        }
      }
    }
    return { sectionLabel: "", pageTitle: "" };
  }
  ```

- **[WARNING]** 인라인 Tailwind className 문자열 길이 과다
  - 위치: `docs-mobile-sidebar.tsx` L580 (button 의 className)
  - 상세: `"sticky top-0 z-30 -mx-4 flex w-[calc(100%+2rem)] items-center gap-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/95 px-4 py-2.5 text-sm backdrop-blur supports-[backdrop-filter]:bg-[hsl(var(--background))]/80"` 는 단일 줄 139자로, 변경 리뷰 시 diff에서 확인이 어렵다. 코드베이스 내 다른 복잡한 버튼들의 처리 방식과 일관성 비교가 필요하다.
  - 제안: 프로젝트 내 기존 패턴(cva 또는 상수 추출)을 따르거나, 적어도 논리적 그룹별로 템플릿 리터럴 여러 줄로 분리한다. 단, 이 프로젝트가 단순 인라인 className 을 전반적으로 허용하는 경우라면 INFO 수준으로 강등 가능.

- **[INFO]** `onClickCapture` 클로저 내 타입 좁히기 패턴의 명시성
  - 위치: `docs-mobile-sidebar.tsx` L742–745
  - 상세: `e.target instanceof Element && e.target.closest("a")` 패턴은 기능상 올바르고 간결하나, 팀 내 테스트 파일에서 이 동작을 검증하는 테스트가 존재(`drawer 안의 페이지 링크를 클릭하면 자동 close`)하므로 문서화는 충분하다. 인라인 주석도 있어 이해에 문제는 없다.
  - 제안: 변경 불요.

- **[INFO]** `usePathname` import 는 있으나 `pathname` 변수가 active-page 매칭에만 사용되고 실제 경로 변경 시 drawer close는 구현되지 않았음
  - 위치: `docs-mobile-sidebar.tsx` L537, JSDoc L529
  - 상세: JSDoc에 `usePathname 변경 시 자동 close (페이지 이동 후 drawer 가 남는 회귀 방지)` 라고 명시되어 있으나, 실제 구현에 이 동작을 수행하는 effect 가 없다. `pathname` 은 현재 페이지 매칭 계산에만 사용된다. click capture 를 통한 close 가 대신 구현되어 있으며, 주석(L607–608)에 그 이유(react-compiler setState-in-effect 규약)가 기록되어 있다. 그러나 JSDoc과 구현 사이의 불일치가 유지보수자를 혼란시킬 수 있다.
  - 제안: JSDoc 에서 `usePathname 변경 시 자동 close` 구문을 `drawer 안 링크 클릭 시 click capture 로 즉시 close (react-compiler setState-in-effect 규약으로 effect 추적 불가)` 로 수정한다.

### 파일 5: slide-drawer.tsx

- **[WARNING]** 매직 넘버: `h-[calc(100%-65px)]`
  - 위치: `slide-drawer.tsx` L1166
  - 상세: `65px` 는 헤더 높이(padding 포함)를 하드코딩한 값이다. 헤더의 `py-4 + border-b` 가 `65px` 가 되는 이유가 코드에서 추론되지 않으며, 헤더 높이 변경 시 이 숫자도 수동으로 동기화해야 한다.
  - 제안: CSS 변수나 named constant 로 추출하거나(`DRAWER_HEADER_HEIGHT = "65px"`), `flex` 레이아웃으로 헤더/컨텐츠를 분리해 고정값 의존을 제거한다:
    ```tsx
    // flex 방식 예시
    <div className="flex h-full flex-col">
      <div className="shrink-0 flex items-center justify-between border-b ...">
        {/* header */}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        {children}
      </div>
    </div>
    ```

- **[INFO]** 모듈-레벨 변경 가능 변수 (`openDrawerCount`)
  - 위치: `slide-drawer.tsx` L1070
  - 상세: `let openDrawerCount = 0` 는 모듈 싱글톤으로 동작하며, SSR/테스트 환경에서 모듈 캐시가 재사용되면 카운터가 잘못 유지될 수 있다. 현재 코드베이스 맥락(CSR only, `"use client"`)에서는 실질적 위험이 낮고 JSDoc 에 의도가 명시되어 있어 수용 가능한 수준이다.
  - 제안: 변경 불요. 단, 향후 SSR 적용 시 React context 혹은 `useRef` + custom hook 으로 이전 필요함을 주석에 추가하면 좋다.

### 파일 2: docs-mobile-sidebar.test.tsx

- **[INFO]** import 중복 — 동일 모듈에서 두 번 import
  - 위치: `docs-mobile-sidebar.test.tsx` L313–314
  - 상세:
    ```ts
    import type { DocsSection } from "@/lib/docs/registry";
    import type { DocsSearchEntry } from "@/lib/docs/registry";
    ```
    동일 경로에서 type import 를 두 줄로 분리했다. 기능에 영향은 없으나 컨벤션 일관성이 떨어진다.
  - 제안:
    ```ts
    import type { DocsSection, DocsSearchEntry } from "@/lib/docs/registry";
    ```

- **[INFO]** `afterEach` 에서 `useLocaleStore.setState({ locale: "ko" })` 재설정 필요성
  - 위치: `docs-mobile-sidebar.test.tsx` L397–401
  - 상세: `afterEach` 에서 locale 을 `"ko"` 로 reset 하는데 `beforeEach` 에서도 동일하게 설정한다. `afterEach` 의 reset 은 다음 `beforeEach` 전에 실행되므로 중복이다. 단, 명시적 방어적 코딩으로 의도한 것이라면 허용 가능.
  - 제안: `afterEach` 의 locale reset 제거를 고려한다. 단, 팀 정책이 afterEach 방어적 초기화라면 그대로 유지.

### 파일 1: docs/layout.tsx

- **[INFO]** Tailwind responsive 값 갭 불일치
  - 위치: `layout.tsx` L81
  - 상세: `gap-3` (모바일) → `lg:gap-6` (데스크탑) 로 변경되었다. 이전 코드는 `gap-6` 단일이었고 이를 모바일에서 `gap-3` 으로 줄인 이유가 주석 없이는 불명확하다. 자체적으로는 문제없으나 의도를 밝히면 이해에 도움이 된다.
  - 제안: 변경 불요. 선택적으로 인라인 주석 추가 가능: `{/* gap-3 모바일: 토글 bar 아래 article 간격; lg:gap-6 데스크탑: aside-article 간격 */}`.

### 파일 6/7: i18n dict (en/docs.ts, ko/docs.ts)

- **[INFO]** `mobileSidebarTitle` 값이 `title` 과 동일 (en: `"User Guide"`, ko: `"사용자 가이드"`)
  - 위치: `en/docs.ts` L1206, 1214 / `ko/docs.ts` L1265, 1273
  - 상세: `docs.title: "User Guide"` 와 `docs.mobileSidebarTitle: "User Guide"` 가 동일한 값이다. 향후 `title` 이 변경될 경우 `mobileSidebarTitle` 이 따라가지 않으면 불일치가 발생한다. 단, 두 키가 의미상 독립(하나는 페이지 타이틀, 하나는 drawer 헤더)이라면 의도적 분리로 볼 수 있다.
  - 제안: 변경 불요. 단, 두 값이 항상 동일해야 한다는 의도라면 `mobileSidebarTitle` 을 제거하고 `title` 을 drawer 에서 직접 사용하도록 정리하면 중복을 줄일 수 있다.

---

## 요약

전반적으로 코드 구조가 명확하고, 컴포넌트 분리, JSDoc, 인라인 주석, 테스트 커버리지가 잘 갖춰져 있다. 주요 유지보수 위험은 두 가지로 요약된다. 첫째, `docs-mobile-sidebar.tsx` 의 `outer: for` labeled break는 JavaScript/TypeScript 코드베이스에서 관용적이지 않아 팀 내 새 기여자의 가독성을 해친다. 헬퍼 함수 추출로 쉽게 해결 가능하다. 둘째, `slide-drawer.tsx` 의 `calc(100%-65px)` 매직 넘버는 헤더 높이와의 암묵적 결합을 만들어 미래 스타일 변경 시 silently break 될 수 있다. flex 레이아웃 전환으로 근본적으로 제거 권장한다. 그 외 발견사항은 INFO 수준으로 즉각적인 차단 이슈는 없다.

---

## 위험도

MEDIUM
