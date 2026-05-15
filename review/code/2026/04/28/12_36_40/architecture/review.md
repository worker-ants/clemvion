### 발견사항

---

**[WARNING]** API 응답 정규화 로직이 프레젠테이션 레이어에 분산·중복
- 위치: `knowledge-bases/page.tsx`, `llm-configs/page.tsx` (각 파일 내 동일 패턴 반복)
- 상세: 아래 방어적 분기가 컴포넌트 레이어에 직접 노출되어 있음. 이는 API 클라이언트(`/lib/api/*.ts`)가 응답 형태를 보장해야 할 책임을 프레젠테이션 레이어가 떠안은 것임.
  ```ts
  const collections = Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data)
      ? data
      : [];
  const totalPages = Math.max(1, data?.pagination?.totalPages ??
    Math.ceil((data?.pagination?.totalItems ?? collections.length) / PAGE_SIZE));
  ```
- 제안: API 클라이언트의 응답 타입을 `{ data: T[], pagination: Pagination }` 으로 명시적으로 고정하거나, 래퍼 함수에서 정규화. 컴포넌트는 항상 정형화된 값을 받아야 함.

---

**[WARNING]** 페이지 상태 관리 패턴이 페이지마다 불일치
- 위치: 전체 리뷰 대상 페이지 파일들
- 상세: 세 가지 서로 다른 패턴이 혼재함.
  1. `usePageParam` + URL 기반 (workflows, knowledge-bases, llm-configs, triggers, schedules)
  2. `updateParam` 직접 호출 (integrations — 자체 URL 관리 유지)
  3. `useState` 로컬 상태 (executions — URL에 반영되지 않아 브라우저 뒤로가기 시 페이지 리셋됨)
- 제안: `executions/page.tsx`도 `usePageParam`으로 통일. `integrations/page.tsx`는 기존 `updateParam` 체계가 더 복잡한 필터 URL을 통합 관리하므로 허용 가능하나, 팀 내 결정을 문서화할 것.

---

**[WARNING]** `queryFn` 내부에 비즈니스 로직 혼재 (schedules, triggers)
- 위치: `schedules/page.tsx:519-535`, `triggers/page.tsx:109-122`
- 상세: `totalPages` 계산이 데이터 패칭 함수 안에서 수행되어 레이어 책임이 모호함. `queryFn`은 서버 응답을 가져오는 역할만 해야 하며, `totalPages` 산출은 파생값 계산 영역(컴포넌트 또는 API 레이어)에서 처리해야 함.
- 제안: `queryFn`은 raw 응답을 반환하고, `totalPages`는 컴포넌트 본문에서 `useMemo` 또는 단순 파생값으로 계산.

---

**[WARNING]** `const PAGE_SIZE = 20;`이 `import` 문 사이에 삽입
- 위치: `llm-configs/page.tsx:14-17`
- 상세:
  ```ts
  import { toast } from "sonner";

  const PAGE_SIZE = 20;
  import {
    Plus,
  ```
  ES 모듈에서 `import`는 정적으로 호이스팅되므로 런타임에는 문제없지만, 번들러/린터에 따라 경고가 발생하며 가독성을 저해함.
- 제안: 모든 `import` 이후에 상수 선언 배치.

---

**[INFO]** `executions/page.tsx`의 로컬 `page` 상태가 URL에 반영되지 않음
- 위치: `executions/page.tsx:114`
- 상세: `const [page, setPage] = useState(1)` 사용. 사용자가 3페이지를 보던 중 뒤로가기 후 재방문 시 항상 1페이지로 초기화됨. 다른 페이지들과 UX 일관성 불일치.
- 제안: `usePageParam`으로 교체하면 URL 공유와 브라우저 히스토리 모두 지원됨.

---

**[INFO]** `Pagination` 컴포넌트의 `className` 기본값이 nullish coalescing으로 처리됨
- 위치: `pagination.tsx:62-65`
- 상세: `className ?? "flex flex-wrap ..."` 패턴은 `className=""`(빈 문자열) 전달 시 기본값을 사용하지 않음. 일반적인 Tailwind 컴포넌트 패턴(`cn(defaultClass, className)`)과 다름.
- 제안: `cn("flex flex-wrap items-center justify-center gap-2", className)` 방식이 더 일관적이며 오버라이드 시 merge도 용이함.

---

### 요약

이번 변경의 핵심 아키텍처 방향 — 공용 `Pagination` 컴포넌트 추출, `usePageParam` 훅으로 URL 상태 캡슐화 — 은 올바른 추상화다. 특히 `usePageParam`이 canonical URL 유지(`page=1` 파라미터 제거)까지 담당하는 점, 테스트가 regression 케이스를 문서화하는 점은 긍정적이다. 다만, API 응답 정규화 로직이 컴포넌트 레이어에 흩어져 있고 페이지 상태 관리 패턴이 아직 세 가지로 분기된 점이 구조적 부채로 남는다. 가장 시급한 것은 `Array.isArray(data?.data)` 분기를 API 클라이언트 레이어로 내려서 모든 페이지가 동일한 타입 보장 하에 동작하도록 하는 것이다.

### 위험도

**LOW** — 현재 동작에 회귀는 없으나, 응답 형태 불일치 방어 로직이 프레젠테이션 레이어 전반에 퍼져 있어 API 스펙 변경 시 누락 지점이 생길 가능성이 있음.