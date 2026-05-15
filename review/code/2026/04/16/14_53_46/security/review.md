### 발견사항

---

**[WARNING] 동적 import 경로에서의 경로 탐색 가능성**
- **위치**: `frontend/src/app/(main)/docs/[...slug]/page.tsx`, 동적 import 블록
- **상세**: URL 파라미터에서 파생된 `slugPath`를 그대로 동적 import 경로에 삽입하고 있어요.
  ```tsx
  const { default: MDXContent } = await import(
    `@/content/docs/${slugPath}.mdx`
  );
  ```
  `dynamicParams = false`와 `getDocBySlug` 검증이 1차 방어선이지만, 이는 빌드 타임 정적 파라미터 목록에 의존해요. 레지스트리 캐시가 오염되거나, `getDocBySlug` 구현에서 슬러그가 정규화 없이 통과되면 `../../` 형태의 경로 탐색이 시도될 수 있어요.
- **제안**:
  - `slugPath`에 `..`, `/` 등 비허용 문자가 없음을 import 전에 명시적으로 검증하세요.
  ```tsx
  const SAFE_SLUG_RE = /^[a-z0-9\-\/]+$/i;
  if (!SAFE_SLUG_RE.test(slug.join("/"))) notFound();
  ```
  - 또는 `import()` 대신 빌드 타임에 모든 MDX를 eager-import하는 맵 구조를 사용해 동적 경로 조합 자체를 제거하는 걸 권장해요.

---

**[WARNING] `docsHref` 프로퍼티에 대한 URL 스킴 검증 부재**
- **위치**: `frontend/src/components/editor/settings-panel/node-configs/shared/field-help.tsx`
- **상세**: `docsHref`가 anchor `href`에 그대로 바인딩되는데, 현재는 개발자가 하드코딩하므로 위험도가 낮지만, 향후 서버 응답이나 외부 데이터를 이 prop에 연결하는 확장이 생기면 `javascript:` URI를 통한 XSS가 가능해요.
  ```tsx
  <a href={docsHref} target="_blank" rel="noopener noreferrer">
  ```
- **제안**: 방어 코드를 지금 추가해 두는 것이 안전해요.
  ```tsx
  const safeDocs = docsHref?.startsWith("/") ? docsHref : undefined;
  ```
  또는 `/docs/`로 시작하는 상대 경로만 허용하는 화이트리스트 검증을 추가하세요.

---

**[INFO] 모듈 레벨 가변 카운터의 SSR 공유 위험**
- **위치**: `frontend/src/components/editor/settings-panel/node-configs/shared.tsx`, `checkboxIdCounter`
- **상세**: Node.js 서버 환경에서는 모듈이 요청 간 공유돼요. 이 컴포넌트가 서버 사이드 렌더링에서 실행될 경우 카운터 값이 요청 간 누적되어 ID가 비결정적으로 될 수 있어요. (기능 버그 및 hydration mismatch 원인)
- **제안**: `useId()` (React 18+)를 사용하면 SSR-safe한 고유 ID를 생성할 수 있어요.
  ```tsx
  const id = typeof label === "string"
    ? `cb-${label.replace(/\s+/g, "-").toLowerCase()}`
    : `cb-${useId()}`;
  ```

---

**[INFO] `gray-matter` 의존성 - 프로토타입 오염 이력**
- **위치**: `frontend/package.json`
- **상세**: `gray-matter` 4.x는 YAML 파싱에 `js-yaml`을 사용하는데, 신뢰할 수 없는 입력에 대한 프로토타입 오염 취약점 이력이 있어요. 현재 정적 파일만 처리하므로 위험도는 낮지만 주의가 필요해요.
- **제안**: `npm audit`으로 현재 버전의 CVE를 확인하고, 사용자 업로드 MDX 처리 기능 추가 시 별도의 샌드박스 처리를 도입하세요.

---

**[INFO] MDX 컴포넌트(`FieldTable`, `Callout` 등)의 미래 XSS 노출면**
- **위치**: `frontend/src/mdx-components.tsx` (레지스트리에서 주입되는 커스텀 컴포넌트)
- **상세**: 현재는 빌드 타임 정적 파일만 처리하므로 문제없어요. 그러나 향후 사용자 작성 MDX(예: 워크플로우 노트의 마크다운 지원)로 이 컴포넌트 시스템이 확장될 경우, `FieldTable`의 `description: React.ReactNode` 등 JSX를 받는 필드가 XSS 벡터가 될 수 있어요.
- **제안**: 현재 아키텍처에서 사용자 입력 MDX 처리가 설계되어 있지 않다면 문서에 명시해 두세요.

---

### 요약

이번 변경사항은 주로 정적 문서 시스템(MDX 기반 User Guide), 빈 캔버스 UI, 필드 도움말 Popover를 추가하는 내용이에요. 가장 주목해야 할 보안 이슈는 `[...slug]/page.tsx`에서 URL 파라미터를 동적 import 경로에 직접 조합하는 패턴으로, `dynamicParams = false`와 레지스트리 검증이 현재는 충분히 방어하고 있지만 레지스트리 구현의 슬러그 정규화 품질에 의존하는 설계예요. `docsHref` URL 스킴 미검증과 모듈 레벨 카운터 문제는 현재 즉각적인 위협은 아니지만 방어 코드 추가가 권장돼요. 전반적으로 외부 입력이 렌더링에 미치는 영향이 최소화된 설계이며, `rel="noopener noreferrer"` 적용 등 기본적인 보안 관례도 잘 지켜지고 있어요.

### 위험도

**LOW** (동적 import 경로 패턴은 MEDIUM 잠재 위험, 현재 완화 조건 충족 시 LOW)