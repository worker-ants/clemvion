# Documentation Review

## 발견사항

### 1. 독스트링/JSDoc

- **[INFO]** `logo.tsx` 공개 컴포넌트에 JSDoc 없이 블록 주석(/* */) 형태로 문서화
  - 위치: `frontend/src/components/ui/logo.tsx` 라인 12-27
  - 상세: `Logo`, `LogoMark` 두 공개 컴포넌트 모두 JSDoc(`/** */`) 대신 일반 블록 주석으로 props를 설명한다. TSDoc/JSDoc 형식이 아니어서 IDE hover 문서 지원이 되지 않는다.
  - 제안: `/** @param variant ... @param theme ... */` 형식의 JSDoc으로 전환하거나, 현재 블록 주석 방식을 프로젝트 표준으로 명시. 최소한 `LogoProps` 인터페이스 각 필드에 JSDoc 코멘트 추가 권장.

- **[INFO]** `LogoMark` 함수에 개별 설명 없음
  - 위치: `frontend/src/components/ui/logo.tsx` 라인 76-78
  - 상세: `LogoMark`가 `Logo variant="mark"` 의 편의 래퍼라는 사실이 타입 정의(`LogoMarkProps = Omit<LogoProps, "variant">`)로만 유추 가능. 함수 위에 한 줄 주석도 없음.
  - 제안: `/** Convenience wrapper for <Logo variant="mark" />. */` 한 줄 추가.

---

### 2. README 업데이트

- **[INFO]** README 브랜드 링크 경로 갱신 완료 — 추가 조치 불필요
  - 위치: `README.md` 라인 6-8 (diff 기준)
  - 상세: `prd/brand.md` → `spec/6-brand.md` 경로 수정이 정상 반영됨. 로고 이미지 임베드도 추가됨(`frontend/public/logo.svg`).
  - 제안: 없음. 단, `plan/in-progress/brand-refresh-impl.md` §1.1 에서 `logo.svg`가 아직 신규 노드 그래프 SVG로 교체되지 않은 상태임을 고려하면 README에 삽입된 이미지가 현재 시점에 구 자산을 가리킬 수 있다. Stage 2 SVG 자산 완성 후 이미지가 올바른지 확인 필요.

- **[WARNING]** `plan/in-progress/brand-refresh-impl.md` §4.4 항목이 체크 완료 처리되었는지 불분명
  - 위치: `plan/in-progress/brand-refresh-impl.md` 라인 891-893
  - 상세: plan §4.4에서 `README.md` 헤더에 full logo SVG 임베드를 `[ ]` 미완 항목으로 명시하고 있으나, 실제 diff에서는 이미 `README.md`에 `<img>` 태그가 추가되어 있다. 체크박스가 갱신되지 않아 plan과 실제 구현 간 불일치가 발생.
  - 제안: `brand-refresh-impl.md` §4.4 의 해당 항목을 `[x]`로 체크 처리하여 plan 문서와 구현 상태를 동기화.

---

### 3. API 문서

- **[INFO]** API 엔드포인트 변경 없음 — 점검 불필요
  - 상세: 이번 변경 범위(브랜드 비주얼 자산·CSS 토큰·로고 컴포넌트·plan 문서)에 백엔드 API 변경이 포함되지 않아 API 문서 업데이트 필요 없음.

---

### 4. 주석 정확성

- **[INFO]** `globals.css` WCAG 주석이 변경된 수치와 일치
  - 위치: `frontend/src/app/globals.css` 라인 150-153 (diff 기준)
  - 상세: `--muted-foreground` 주석에 명시된 lightness 35% 값이 실제 선언값(`140 20% 35%`)과 일치. 다크 모드의 75% lightness 주석도 `138.5 25% 75%` 선언값과 일치함.
  - 제안: 없음.

- **[INFO]** `auth/layout.tsx` 주석이 변경 의도를 적절히 설명
  - 위치: `frontend/src/app/(auth)/layout.tsx` 라인 4-9 (diff 기준)
  - 상세: 그라데이션 제거 이유(`spec §8.4.4 prohibits gradient backgrounds`)와 배경색 변수 의미가 주석으로 명확히 기록됨. spec 참조 번호도 함께 제공.
  - 제안: 없음.

- **[INFO]** `logo.tsx` ASSET_PATHS 인라인 주석에 wordmark 단일-톤 이유 설명됨
  - 위치: `frontend/src/components/ui/logo.tsx` 라인 519-522
  - 상세: `wordmark: { light: "/logo-wordmark.svg", dark: "/logo-wordmark.svg" }` 로 light/dark가 동일 경로인 이유가 주석으로 설명됨. 올바른 주석 관행.
  - 제안: 없음.

---

### 5. 인라인 주석

- **[INFO]** `globals.css` `@theme` 블록에 다크 variant 미등록 이유 주석 포함
  - 위치: `frontend/src/app/globals.css` 라인 221-228 (diff 기준)
  - 상세: `Dark variants are NOT registered as separate Tailwind keys` 정책과 `spec R-10` 참조가 명시되어, 나중에 읽는 개발자가 의도를 파악할 수 있음.
  - 제안: 없음.

- **[INFO]** `layout.tsx` metadata 블록 `favicon.ico` 의도적 생략 이유 미설명
  - 위치: `frontend/src/app/layout.tsx` 라인 263-275 (diff 기준)
  - 상세: 주석에서 `favicon.ico is intentionally omitted — modern browsers prefer SVG` 와 PNG pending 이유가 잘 설명됨. 그러나 `apple-icon.svg`가 명시적으로 등록되었는데 plan(`brand-refresh-impl.md` §1.3)에서는 `apple-icon.png`(PNG)를 최종 산출물로 정의한다. SVG apple-icon을 임시 사용하는 것임을 코드 주석이 명시하지 않음.
  - 제안: `apple-icon` 항목 옆에 `// TODO: replace with PNG once raster tooling is available (brand-refresh-impl §1.3)` 주석 추가 권장.

- **[WARNING]** `logo.tsx` `theme === "auto"` 분기의 dual-render SSR 고려 사항 언급 부족
  - 위치: `frontend/src/components/ui/logo.tsx` 라인 553-571
  - 상세: `theme="auto"` 시 두 `<img>` 요소를 동시에 렌더하고 Tailwind `dark:hidden`/`hidden dark:block` 로 토글하는 패턴은 클라이언트 하이드레이션 불일치(hydration mismatch) 없이 동작한다는 장점이 있지만, 두 이미지가 모두 네트워크 요청을 발생시킨다는 잠재적 비용이 있다. 이 설계 선택의 트레이드오프가 주석에 없음.
  - 제안: `// Note: both assets are fetched regardless of active theme — acceptable for small SVGs (see logo.tsx module comment).` 정도의 간단한 주석 또는 모듈 상단 블록 주석에 trade-off 언급 추가.

---

### 6. 변경 이력 (CHANGELOG)

- **[WARNING]** 프로젝트에 CHANGELOG 파일이 별도로 존재하는지 확인 불가능하나, `spec/6-brand.md §9` 변경 이력 행 추가가 plan에 명시되어 있음
  - 위치: `plan/complete/spec-draft-brand-refresh.md` 라인 615
  - 상세: `§8 외 섹션...§9 변경 이력에 행 1개를 추가한다.`는 plan에 명시되어 있으나, 이번 diff 범위에 `spec/6-brand.md` 자체의 변경이 포함되지 않아 §9 업데이트 여부를 직접 확인할 수 없다. Stage 1 작업의 일환으로 처리되었어야 한다.
  - 제안: `spec/6-brand.md §9` 변경 이력 행이 실제로 추가되었는지 확인. 누락 시 보완 필요.

---

### 7. 설정 문서

- **[INFO]** 신규 Tailwind `@theme` 컬러 토큰 이름이 spec 참조와 함께 문서화됨
  - 위치: `frontend/src/app/globals.css` 라인 221-241 (diff 기준)
  - 상세: `vine-900` ~ `vine-border` 각 토큰이 `@theme` 블록에 등록되고, 블록 주석에 `spec §8.2.1 / §8.2.3` 참조가 포함되어 있어 설정 문서 역할을 충분히 함.
  - 제안: 없음.

- **[INFO]** 다크 모드 Tailwind 변종이 `@theme`에 미등록된 이유가 주석으로 설명됨
  - 위치: `frontend/src/app/globals.css` 라인 222-227 (diff 기준)
  - 상세: `spec R-10 + impl-prep INFO 10` 참조가 명시됨. 의사결정 추적 가능.
  - 제안: 없음.

---

### 8. 예제 코드

- **[INFO]** `logo.tsx` 사용 예제가 실제 사용처(sidebar, auth layout)에서 확인 가능
  - 위치: `frontend/src/components/layout/sidebar.tsx`, `frontend/src/app/(auth)/layout.tsx`
  - 상세: `<Logo variant="full" theme="auto" size={150} />`, `<Logo variant="full" theme="auto" size={200} />`, `<LogoMark theme="auto" size={32} />` 세 가지 실제 사용 예가 코드베이스 내에 존재. README나 Storybook 스토리는 없지만 실사용 예제로 대체 가능.
  - 제안: 향후 디자인 시스템 확장 시 Storybook 스토리 추가를 고려.

- **[INFO]** 테스트 파일(`logo.test.tsx`)이 사실상 사용 예제 역할 수행
  - 위치: `frontend/src/components/ui/__tests__/logo.test.tsx`
  - 상세: 8개 테스트 케이스가 `variant`, `theme`, `size`, `alt`, `className` 각 prop의 사용 방법을 명시적으로 보여줌. 독립적인 예제 코드 섹션 없이도 테스트에서 API를 파악할 수 있는 좋은 관행.
  - 제안: 없음.

---

## 요약

이번 brand-refresh 변경 세트는 전반적으로 문서화 수준이 양호하다. `globals.css`의 CSS 변수는 spec 토큰명과 섹션 번호를 주석으로 명시하여 추적성이 높고, `auth/layout.tsx`와 `sidebar.tsx`의 인라인 주석도 변경 의도를 충분히 설명한다. `logo.tsx` 컴포넌트는 블록 주석으로 props와 variant 의미를 잘 정리했으나 공식 JSDoc 형식이 아니어서 IDE hover 지원이 제한된다. 주요 미비점으로는 `plan/in-progress/brand-refresh-impl.md` §4.4 체크박스가 이미 완료된 README 변경에도 미갱신 상태인 점, `apple-icon.svg`가 임시 파일임을 코드에서 명시하지 않은 점, 그리고 `logo.tsx` `theme="auto"` 듀얼 렌더 패턴의 네트워크 비용 트레이드오프가 주석에 누락된 점이 있다. 이 세 항목은 WARNING 수준이며 즉각적 버그를 유발하지는 않으나 향후 유지보수 혼란을 일으킬 소지가 있다.

## 위험도

LOW
