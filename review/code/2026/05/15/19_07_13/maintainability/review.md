# 유지보수성(Maintainability) 코드 리뷰

**리뷰 대상**: brand-refresh-7a3f12 브랜치 변경사항 (파일 1~10 핵심 구현 파일)
**리뷰 일시**: 2026-05-15

---

## 발견사항

### 코드 파일 (frontend/)

- **[WARNING]** `globals.css` — 동일한 HSL 값이 복수의 CSS 변수에 중복 할당되어 있음
  - 위치: `frontend/src/app/globals.css` `:root` 블록 (라이트 모드)
  - 상세: `--card`, `--secondary`, `--muted`, `--accent` 네 변수가 모두 동일 값 `106.7 31% 94.3%` (soil-100) 로 설정되어 있다. 다크 모드에서도 `--secondary`, `--muted`, `--accent` 가 동일 값 `133.8 27.7% 9.2%` (vine-dark-bg-elevated) 를 공유한다. 이는 중복 코드이기도 하지만, 나중에 card/muted/accent 를 각각 다른 토큰으로 분리해야 할 때 어느 변수를 바꿔야 하는지 불명확해지는 유지보수성 문제다.
  - 제안: `--card`, `--muted`, `--accent` 가 지금 동일하더라도 의도가 구별되면 주석으로 "intentionally same as --card for now" 같은 설명을 달거나, 장기적으로 각 의미에 맞는 토큰을 사용한다. 최소한 `--secondary-foreground` 와 `--accent-foreground` 가 동일 값 `143.5 60.5% 29.8%` 로 중복된 것도 동일한 방식으로 처리한다.

- **[WARNING]** `globals.css` — `--border` 와 `--input` 이 항상 동일 값으로 선언되어 있으나 별도 변수로 분리되어 있음
  - 위치: `:root` 블록 `--border: 90 14.8% 89.4%;` / `--input: 90 14.8% 89.4%;`, `.dark` 블록 동일 패턴
  - 상세: `--border` 와 `--input` 은 Shadcn 컨벤션상 별도 변수이지만 이 코드베이스에서는 항상 동일 값으로 설정된다. 미래에 두 값을 분리할 의도가 있다면 문제가 없으나, 그렇지 않다면 혼동 소지가 있다.
  - 제안: 두 값을 의도적으로 같게 유지하는 것이라면 주석으로 "same as --border — Shadcn convention requires separate declaration" 과 같이 이유를 명시해 유지보수자가 실수로 변경하지 않도록 가이드한다.

- **[INFO]** `logo.tsx` — `style` 객체가 두 렌더 경로(`theme === 'light'|'dark'` 단일 img, `theme === 'auto'` 듀얼 img)에서 중복 계산됨
  - 위치: `frontend/src/components/ui/logo.tsx` 43번 줄 (`const style = ...`), 그리고 두 `<img>` 에 동일 style 객체가 반복 전달
  - 상세: `style` 변수는 한 번 계산되어 `auto` 브랜치의 두 `<img>` 모두에 동일하게 전달되는 것은 괜찮다. 그러나 `draggable={false}` prop 역시 `<img>` 두 곳에 반복되며, `alt={resolvedAlt}` 와 `style={style}` 도 마찬가지다. 이 부분은 `auto` 케이스가 단순히 두 이미지를 렌더한다는 사실에서 비롯된 정상적 중복이지만, 미래에 prop 이 추가될 경우 두 `<img>` 를 모두 수정해야 함을 인지해야 한다.
  - 제안: 허용 범위 내이지만, 향후 `<img>` 공통 props 가 늘어날 경우 내부 `ImgElement` 또는 `commonImgProps` 객체로 추출하는 것을 고려한다.

- **[INFO]** `logo.tsx` — `LogoMark` 의 타입 정의가 `Omit<LogoProps, "variant">` 인데 JSDoc/주석이 없어 단독 소비자가 `Logo`와의 관계를 바로 파악하기 어려움
  - 위치: `frontend/src/components/ui/logo.tsx` 74-77번 줄
  - 상세: `LogoMark` 는 `Logo` 를 `variant="mark"` 로 고정한 convenience wrapper 다. 이 사실이 타입으로는 유추 가능하지만 명시적 설명이 없다. 한편 `Logo` 의 JSDoc 블록은 충실하게 작성되어 있어 `LogoMark` 와 불균형하다.
  - 제안: `LogoMark` 위에도 한 줄 JSDoc (`/** Convenience alias for <Logo variant="mark" />. */`) 을 추가한다.

- **[INFO]** `(auth)/layout.tsx` — Logo `size={200}` 이 매직 넘버로 하드코딩되어 있음
  - 위치: `frontend/src/app/(auth)/layout.tsx` 84번 줄 `<Logo variant="full" theme="auto" size={200} />`
  - 상세: `size` 값 200이 왜 200인지 주변 코드에서 설명이 없다. spec/6-brand.md §8.4.3 에 "풀로고 기준 160px 기본값" 이 있는데, 실제 auth 화면은 200을 사용하고 있어 의도적 오버라이드인지 실수인지 모호하다.
  - 제안: 변수 또는 상수로 이름을 부여하거나, 인접 주석에 "스펙 기본 160px 보다 큰 250px — 인증 화면 중앙 강조용" 과 같이 이유를 명시한다.

- **[INFO]** `sidebar.tsx` 변경부 — 사이드바 Logo `size={150}` 도 매직 넘버
  - 위치: `frontend/src/components/layout/sidebar.tsx` (collapsed=false 브랜치) `<Logo variant="full" theme="auto" size={150} />`
  - 상세: auth layout 의 200과 sidebar 의 150이 서로 다른 값이며, 두 곳 모두 출처가 불명확하다. spec §8.4.3 의 `full=160` 기본값과도 차이가 있다.
  - 제안: `ui/logo.tsx` 에 사전 정의된 상수(`LOGO_SIZE_SIDEBAR = 150`, `LOGO_SIZE_AUTH = 200`)를 두거나 spec 링크 주석을 추가해 나중에 크기를 조정할 때 한 곳만 수정하면 되게 한다.

- **[INFO]** `layout.tsx` (root) — OG/Twitter 메타데이터의 `description` 문자열이 최상위 `description` 과 중복 선언됨
  - 위치: `frontend/src/app/layout.tsx` `metadata.description`, `metadata.openGraph.description`, `metadata.twitter.description` 세 곳에 동일 문자열 `"AI가 엮고, 실행하고, 성장시키는 워크플로우 시스템"` 반복
  - 상세: 메타 설명을 변경할 때 세 곳을 모두 찾아 수정해야 한다. Next.js metadata 타입은 이 중복을 자동으로 처리하지 않는다.
  - 제안: `const APP_DESCRIPTION = "AI가 엮고, 실행하고, 성장시키는 워크플로우 시스템"` 상수를 파일 상단에 선언하고 세 곳에서 참조한다. 제목 문자열 `"Clemvion — Agentic Workflow"` 도 마찬가지로 `openGraph.title`과 `twitter.title`이 중복된다.

- **[INFO]** `logo.test.tsx` — 테스트 내 `as HTMLElement` 타입 단언이 두 곳에서 사용되어 있으나 불필요
  - 위치: `frontend/src/components/ui/__tests__/logo.test.tsx` 432번 줄 `(img as HTMLElement).style.width`, 445번 줄 `container.firstChild as HTMLElement`
  - 상세: `screen.getByRole("img")` 의 반환 타입은 이미 `HTMLElement` 이므로 첫 번째 단언은 불필요하다. 두 번째는 `firstChild` 가 `ChildNode | null` 이므로 단언이 필요하지만, non-null assertion 을 명시하거나 `querySelector` 로 더 명확히 접근할 수 있다.
  - 제안: `(img as HTMLElement).style.width` → `img.style.width` 로 정리한다. `container.firstChild as HTMLElement` 는 `container.querySelector("span")` 으로 대체하면 더 의도가 명확하다.

### 문서 파일 (plan/, README.md)

- **[INFO]** `plan/complete/spec-draft-brand-refresh.md` — 파일이 `plan/complete/` 에 있으나 내부에 미체크 체크박스(`[ ]`)가 다수 존재
  - 위치: `plan/complete/spec-draft-brand-refresh.md` `## 다음 액션` 섹션 체크박스들
  - 상세: CLAUDE.md plan 라이프사이클 규약에 따르면 `plan/complete/` 는 "모든 작업·체크리스트·후속 항목까지 끝난 plan 문서만" 위치해야 한다. `spec-draft-brand-refresh.md` 는 Stage 1 완료 후 archive 용으로 complete 폴더에 배치된 것으로 보이나, 내부 미체크 항목이 있다면 규약 위반이다.
  - 제안: 해당 파일 내 미완 항목이 실제로 `brand-refresh-impl.md` 로 이관 완료되었다면 체크박스를 `[x]` 로 표시하거나, 이관 완료 사실을 명시한다. 그렇지 않으면 `plan/in-progress/` 로 되돌린다.

- **[INFO]** `README.md` — 로고 이미지가 HTML `<img>` 태그로 삽입되어 있으나 일반적 README 관행은 Markdown 이미지 문법 사용
  - 위치: `README.md` 추가된 `<p align="left"><img ...></p>` 블록
  - 상세: `<p align="left">` HTML wrapper 와 `<img>` 를 사용하면 일부 Markdown 렌더러에서 예상대로 동작하지 않을 수 있다. GitHub README 는 HTML 을 지원하지만, 단순히 `![Clemvion — Agentic Workflow](frontend/public/logo.svg)` 마크다운 문법으로도 동일 결과를 얻을 수 있으며 더 가독성이 좋다.
  - 제안: `align="left"` 정렬이 반드시 필요하지 않다면 순수 Markdown 이미지 문법으로 교체한다. width 제어가 필요하다면 현재 HTML 방식도 허용 가능하며 이 경우는 유지해도 무방하다.

---

## 요약

전반적으로 이번 brand-refresh 변경은 유지보수성 측면에서 양호한 수준이다. `logo.tsx` 는 타입 정의, prop 설계, 상수 테이블(`ASSET_PATHS`, `DEFAULT_ALT`) 분리가 잘 되어 있고, `globals.css` 의 브랜드 토큰 주석(spec 섹션 참조)은 미래 기여자가 토큰 출처를 추적하는 데 크게 도움이 된다. 주요 우려 사항은 두 가지 WARNING 으로, CSS 변수 간 동일 값 중복 선언이 향후 토큰 분화 시 혼동을 줄 수 있다는 점이다. INFO 등급 항목들은 대부분 매직 넘버(로고 size 값), 문자열 상수 중복(메타데이터 description/title), 사소한 타입 정리에 해당하며, 기능적 결함보다는 장기 유지보수 비용을 높이는 코드 냄새(code smell) 수준이다. `plan/complete/` 배치 규약 이슈는 문서 관리 규약과 관련된 것으로, Stage 2 종료 전 정리가 권장된다.

---

## 위험도

LOW
