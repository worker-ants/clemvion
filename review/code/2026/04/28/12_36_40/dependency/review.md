## 의존성 리뷰

### 발견사항

- **[WARNING]** `const PAGE_SIZE = 20` 선언이 import 문 사이에 위치
  - 위치: `frontend/src/app/(main)/llm-configs/page.tsx` (diff 기준 `import { toast } from "sonner"` 직후)
  - 상세: ES 모듈에서 `import` 선언은 파일 상단에 호이스팅되므로 런타임 오류는 없으나, ESLint `import/first` 또는 `no-restricted-syntax` 규칙 위반 가능성이 있고 가독성을 해침
  - 제안: `const PAGE_SIZE = 20` 을 모든 import 블록 아래로 이동

- **[INFO]** `Pagination` 컴포넌트가 `@/lib/i18n`의 `useT` 훅에 의존
  - 위치: `frontend/src/components/ui/pagination.tsx:5`
  - 상세: aria 레이블 국제화를 위해 i18n 컨텍스트 공급자가 렌더 트리에 반드시 존재해야 함. 현재 앱 구조에서는 항상 충족되지만, 미래에 이 컴포넌트를 Storybook이나 독립 테스트 환경에서 사용할 경우 의존성 누락으로 런타임 오류 발생 가능
  - 제안: 테스트 파일(`pagination.test.tsx`)이 이미 `useLocaleStore.setState({ locale: "en" })`로 이를 처리하고 있어 현재는 문제없음. 문서화 수준에서 명시 권장

- **[INFO]** `usePageParam` 훅이 Next.js `useSearchParams()`에 의존
  - 위치: `frontend/src/lib/hooks/use-page-param.ts:5`
  - 상세: Next.js App Router에서 `useSearchParams()`는 `<Suspense>` 경계가 없으면 정적 렌더링 시 경고 또는 오류를 발생시킴. 현재 페이지들이 `export const dynamic = "force-dynamic"` (integrations 등)을 사용하거나 이미 클라이언트 컴포넌트이므로 즉각적 문제는 없음
  - 제안: 현재 구조 유지 가능. 단, 향후 SSR 전환 시 상위에 `<Suspense>` 래핑 필요

- **[INFO]** `ChevronLeft` / `ChevronRight` lucide 아이콘 import가 각 페이지에서 제거되어 `Pagination` 컴포넌트로 통합
  - 위치: integrations/page.tsx, workflows/page.tsx, executions/page.tsx
  - 상세: 긍정적 변화. 트리 쉐이킹 관점에서 동일하나, 참조 지점이 단일화되어 번들 중복이 제거됨

- **[INFO]** 신규 외부 패키지 없음
  - 위치: 전체 변경사항
  - 상세: 이번 변경에서 새로 추가된 외부 npm 패키지는 없음. `lucide-react`, `next/navigation`, `react`, `@tanstack/react-query` 모두 기존 의존성이며, 내부 모듈 신설(`pagination.tsx`, `use-page-param.ts`)만 발생

---

### 요약

이번 변경은 외부 패키지를 일절 추가하지 않고 기존 의존성(`lucide-react`, `next/navigation`, `@/lib/i18n`) 만으로 공용 `Pagination` 컴포넌트와 `usePageParam` 훅을 신설했으며, 6개 페이지에 분산되어 있던 아이콘 import와 페이지 상태 관리 로직을 단일 지점으로 통합했다. 의존성 구조상 실질적 위험은 없으며, `llm-configs/page.tsx`의 import 블록 중간에 위치한 `const` 선언만 정리가 필요한 수준이다.

### 위험도

**LOW**