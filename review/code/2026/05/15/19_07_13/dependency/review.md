# 의존성(Dependency) Review

**대상 브랜치**: brand-refresh-7a3f12
**검토 일시**: 2026-05-15
**검토 범위**: brand refresh 관련 변경 (README.md, globals.css, layout.tsx, logo.tsx, sidebar.tsx, logo.test.tsx, plan/spec 문서)

---

## 발견사항

- **[INFO]** 새 외부 의존성 없음 — package.json 변경 없이 기존 패키지만 활용
  - 위치: `frontend/package.json` (변경 없음)
  - 상세: 이번 brand refresh 에서 추가된 외부 패키지가 전혀 없다. 새 `logo.tsx` 컴포넌트는 `react`(기존), `@/lib/utils/cn`(내부 유틸, `clsx` + `tailwind-merge` 기반) 만 사용하며 두 패키지 모두 이미 `package.json` 에 포함되어 있다. `logo.test.tsx` 역시 `vitest`, `@testing-library/react` 를 활용하는데 이들도 기존 devDependencies 에 있다.
  - 제안: 현 상태 유지. 추가 의존성이 없으므로 번들 크기·라이선스·취약점 측면에서 신규 리스크가 0이다.

- **[INFO]** `next/image` 대신 `<img>` 사용 선택 — 기존 의존성 활용 범위 축소
  - 위치: `frontend/src/components/ui/logo.tsx` L483–488 (`eslint-disable @next/next/no-img-element` 주석)
  - 상세: 컴포넌트는 `next/image`(Next.js 내장) 대신 native `<img>` 를 명시적으로 선택했다. 주석에 "SVG 는 next/image 가 unoptimized 통과이므로 최적화 이득 없음" 이라 근거를 적시했다. 기존 의존성(`next`)을 완전히 활용하지 않는 것이나, SVG 에 대한 판단으로는 타당하다. plan 문서(`brand-refresh-impl.md` §3)에서는 "Next.js `<Image>` 권장 (`unoptimized` 옵션 검토)" 으로 기술되어 있어 spec 의도와 구현 선택 간 미세한 편차가 있다.
  - 제안: 현재 선택은 SVG 특성상 합리적이나, plan 문서 §3 의 권장 사항을 "SVG 자산에는 `<img>` 사용, PNG/WebP 자산에는 `<Image>` 사용" 으로 명확화하면 혼선을 방지할 수 있다.

- **[INFO]** `@theme` 디렉티브 사용 — Tailwind v4 전용 기능
  - 위치: `frontend/src/app/globals.css` L229–241 (`@theme { ... }`)
  - 상세: `@theme` 블록은 Tailwind CSS v4 에서 도입된 CSS-native 테마 설정 방식이다. 현재 `tailwindcss: ^4.2.2` 가 설치되어 있으므로 버전 호환성 문제는 없다. 그러나 `^` 범위 지정이므로 v5.x 메이저 업그레이드 시 breaking change 가능성이 있다. 현재 사용 패턴(커스텀 색상 토큰 등록)은 Tailwind v4 문서의 정석적 용법이다.
  - 제안: 당장 조치 불필요. 추후 `tailwindcss` 메이저 업그레이드 시 `@theme` 블록 문법 변경 여부를 확인한다.

- **[INFO]** 내부 의존 관계 — `logo.tsx` 의 `cn` 유틸리티 참조
  - 위치: `frontend/src/components/ui/logo.tsx` L491 (`import { cn } from "@/lib/utils/cn"`)
  - 상세: 프로젝트 내부 유틸인 `cn` 함수(`clsx` + `tailwind-merge` 래퍼)를 참조한다. 경로 별칭(`@/`) 이 올바르게 설정되어 있어야 하며, `tsconfig.json` 의 `paths` 설정이 이미 존재한다고 가정하면 문제없다. `cn` 유틸은 `sidebar.tsx` 등 기존 컴포넌트에서도 같은 경로로 사용 중이므로 일관성이 있다.
  - 제안: 현 상태 유지.

- **[INFO]** `SVG` 아이콘 파일 직접 임베드 — 번들 크기 영향 없음
  - 위치: `frontend/src/app/layout.tsx` 의 `metadata.icons`, `frontend/public/` SVG 자산들
  - 상세: `logo.tsx` 는 `<img src="/logo.svg">` 방식으로 public 폴더의 SVG를 참조한다. 이는 JavaScript 번들에 포함되지 않고 별도 HTTP 요청으로 처리되므로 번들 크기 증가가 없다. SVG 는 벡터이므로 파일 크기도 작다. OG 이미지(`opengraph-image.svg`) 는 1200×630 크기이나 SVG 특성상 파일 크기는 최소이다.
  - 제안: 현 상태 적절. PNG 변환이 필요한 경우(apple-icon, OG) plan 에서 추적 중이다.

---

## 요약

이번 brand refresh 변경에서 새로 추가된 외부 의존성은 전혀 없다. `logo.tsx` 신규 컴포넌트는 이미 프로젝트에 포함된 `react`, `clsx`, `tailwind-merge` 만 사용하며, CSS 변경은 기존 Tailwind v4(`^4.2.2`) 의 `@theme` 디렉티브를 정석적으로 활용한다. 테스트 코드도 기존 devDependencies(`vitest`, `@testing-library/react`)에 의존하고 있어 신규 패키지 도입에 따른 라이선스·취약점·번들 크기·호환성 리스크가 없다. 내부 의존 관계 역시 기존 패턴(`@/lib/utils/cn`)을 따르고 있어 모듈 간 결합도 면에서 문제가 없다. 발견사항 4건은 모두 INFO 등급으로, 즉각적인 조치가 필요한 항목은 없다.

---

## 위험도

NONE
