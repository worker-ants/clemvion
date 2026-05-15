# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** `globals.css` — 전역 CSS 변수 전면 교체로 인한 광범위한 시각적 부작용
  - 위치: `frontend/src/app/globals.css` `:root` 및 `.dark` 블록 전체
  - 상세: `--primary`, `--background`, `--foreground`, `--card`, `--secondary`, `--accent`, `--border`, `--input`, `--ring`, `--muted-foreground` 등 거의 모든 Shadcn CSS 변수의 HSL 값이 일괄 변경되었다. 이 변수들은 프로젝트 전체 컴포넌트(`Button`, `Card`, `Input`, `Dialog` 등 Shadcn UI 전체)에서 참조된다. 단순 brand 색상 교체이지만, 아직 시각 회귀 테스트(Playwright snapshot)가 없는 상태에서 실제 렌더 결과가 의도와 다를 가능성이 있다. `plan/in-progress/brand-refresh-impl.md §5` 에 회귀 테스트 항목이 미체크(`[ ]`) 상태로 남아있다.
  - 제안: 변경 전후 스냅샷 비교를 PR merge 전에 완료할 것. 특히 `--destructive`(라이트/다크 공통)와 `--ring` 은 색조가 크게 달라졌으므로 폼 에러·포커스 링 UI를 명시적으로 검증한다.

- **[WARNING]** `globals.css` — `@theme` 블록 신규 도입으로 Tailwind v4 전역 컬러 네임스페이스 오염
  - 위치: `frontend/src/app/globals.css` 신규 `@theme { ... }` 블록
  - 상세: `--color-vine-900` ~ `--color-vine-border` 총 9개의 Tailwind 컬러 토큰이 전역 `@theme`으로 등록된다. Tailwind v4의 `@theme`은 전역 디자인 토큰을 프로젝트 전체에 주입하므로, 기존 코드에서 우연히 동일 이름을 사용 중이라면 충돌이 발생할 수 있다. 또한 spec §8.2.3의 다크 모드 토큰(`vine-dark-*`)은 `@theme`에 등록하지 않기로 결정(주석 "Dark variants are NOT registered")했는데, 향후 다른 개발자가 `bg-vine-dark-accent` 처럼 클래스를 사용해도 조용히 무효화될 수 있다.
  - 제안: `@theme`에 등록한 토큰 목록을 `spec/6-brand.md` 또는 `spec/conventions/` 에 명시하여, 추후 등록·제외 기준을 단일 진실로 관리한다. 현재 주석으로만 이유가 서술되어 있다.

- **[WARNING]** `layout.tsx` — `metadata` 객체에 OG/Twitter 이미지로 SVG 파일 참조
  - 위치: `frontend/src/app/layout.tsx` `openGraph.images` 및 `twitter.images`
  - 상세: `opengraph-image.svg`를 OG 이미지로 선언했으나, Open Graph 프로토콜 및 Twitter Card 사양은 PNG/JPEG만 공식 지원한다. SVG를 사용하면 Facebook/Twitter/Slack 등 대부분의 소셜 미리보기가 이미지를 렌더링하지 않거나 깨진 상태로 보일 수 있다. 이는 외부 소셜 서비스의 크롤러 동작에 의도치 않은 부작용을 유발한다. `plan/in-progress/brand-refresh-impl.md §1.3`에 PNG 자산 생성이 미체크 상태이므로, 현재 배포 시 소셜 미리보기가 노출되지 않는 상태다.
  - 제안: Stage 2에서 `opengraph-image.png`(1200×630) 생성 완료 전까지 metadata의 OG/Twitter 이미지 선언을 비워두거나, 기존 PNG가 있다면 임시로 사용한다. 또는 `apple-icon.svg`도 `apple-touch-icon`은 PNG가 권장되므로 동일하게 검토가 필요하다.

- **[INFO]** `(auth)/layout.tsx` — 배경 클래스 변경으로 인한 Auth 페이지 전체 시각 부작용
  - 위치: `frontend/src/app/(auth)/layout.tsx` div 클래스
  - 상세: `bg-gradient-to-br from-[...] via-[...] to-[...]` 그라데이션 배경이 `bg-[hsl(var(--background))]` 단색으로 변경된다. 이는 `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email` 5개 페이지 모두에 영향을 준다. 의도된 변경이지만(spec §8.4.4 그라데이션 금지), 변경 전후 사용자 경험 차이가 크므로 시각 회귀 테스트 포함이 필요하다.
  - 제안: `plan/in-progress/brand-refresh-impl.md §5` Playwright 회귀 테스트에 5개 인증 페이지 모두 명시적으로 포함되어 있으므로, 해당 항목 완료 전 merge 금지를 PR 설명에 명기한다.

- **[INFO]** `sidebar.tsx` — 사이드바 로고 영역 DOM 구조 변경
  - 위치: `frontend/src/components/layout/sidebar.tsx` Logo 슬롯 (확장/축소 상태)
  - 상세: 기존 `<Link>` 안의 텍스트 노드(`{t("sidebar.productName")}`, `"C"`)가 `<Logo>`/`<LogoMark>` 컴포넌트로 교체된다. 텍스트 내용이 사라지고 `aria-label`로 대체되므로, 텍스트 기반 셀레터를 사용하는 e2e 테스트(예: `getByText('Clemvion')`)가 깨질 수 있다. 실제 텍스트를 탐색하는 Playwright 선택자가 있다면 갱신 필요.
  - 제안: e2e 테스트에서 사이드바 로고를 `aria-label` 기반으로 탐색하도록 업데이트한다(`getByRole('link', { name: 'Clemvion' })`).

- **[INFO]** `logo.tsx` — `ASSET_PATHS` 모듈 수준 상수로 정적 전역 상태 도입
  - 위치: `frontend/src/components/ui/logo.tsx` `ASSET_PATHS` 및 `DEFAULT_ALT` 상수
  - 상세: 두 상수는 모듈 수준에서 선언되어 모든 `Logo` 인스턴스가 공유한다. 현재는 순수 정적 데이터이므로 문제없으나, 향후 동적 CDN URL이나 환경별 경로를 삽입하려 할 때 이 상수를 직접 변경하면 전역 부작용이 발생할 수 있다.
  - 제안: 현재 사용 패턴에서는 허용 가능한 수준이다. 다만 경로 커스터마이징이 필요해지면 props를 통해 주입하거나 Context Provider를 사용하도록 주석으로 안내한다.

- **[INFO]** `layout.tsx` — `metadata` 객체의 아이콘 선언 방식 변경으로 브라우저 캐시 영향
  - 위치: `frontend/src/app/layout.tsx` `icons` 블록
  - 상세: Next.js의 자동 파일 기반 favicon 인식(`app/favicon.ico`, `app/icon.svg` 자동 탐지)에서 `metadata.icons` 명시적 선언으로 전환된다. 기존에 브라우저가 캐시한 `favicon.ico` 경로가 변경되므로, 재방문 사용자에게 일시적으로 구 favicon이 표시될 수 있다. `/favicon-16.svg`와 `/icon.svg`는 `public/` 경로인 반면, `apple-icon.svg`의 실제 파일 위치가 `app/` 또는 `public/` 인지 확인이 필요하다(Next.js `app/` 안의 파일은 정적 URL `/apple-icon.svg`로 서빙되지만, `public/`과 혼동될 수 있다).
  - 제안: 아이콘 파일들의 실제 위치(`app/` vs `public/`)를 주석으로 명시하거나, README/plan에 자산 경로 체계를 정리한다.

---

## 요약

이번 brand-refresh 변경은 전역 CSS 변수(`globals.css`)의 전면 교체, Tailwind `@theme` 신규 등록, Auth 레이아웃 재설계, 사이드바 로고 DOM 구조 변경, 그리고 `metadata` 아이콘/OG 선언 추가로 구성된다. 부작용 관점에서 가장 주목할 점은 세 가지다. 첫째, CSS 변수 전체 교체가 Shadcn UI 컴포넌트 전반에 의도치 않은 시각 회귀를 일으킬 수 있으며 아직 Playwright 스냅샷 테스트가 미완료 상태다. 둘째, OG/Twitter 이미지에 SVG를 사용하면 소셜 미리보기가 깨지는 외부 서비스 부작용이 발생할 수 있다. 셋째, `@theme` 전역 등록 토큰과 등록 제외된 다크 토큰의 경계 기준이 코드 주석 외에 단일 진실 문서로 관리되지 않아 유지 관리 혼란이 우려된다. 나머지 변경은 의도된 정적 데이터 추가 또는 레이아웃 구조 교체로, 계획된 범위 내의 부작용이다. 전체적으로 Stage 2 종료 조건(회귀 테스트, PNG 자산 생성) 완료 전 merge 시 외부 노출 품질 저하 위험이 있다.

---

## 위험도

MEDIUM
