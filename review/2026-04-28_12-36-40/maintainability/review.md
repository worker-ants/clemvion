## 발견사항

### **[WARNING]** `const PAGE_SIZE` 선언이 import 블록 중간에 위치
- 위치: `llm-configs/page.tsx` — `import { toast } from "sonner"` 다음, `import { Plus, ... }` 이전
- 상세: `const PAGE_SIZE = 20;`가 두 import 그룹 사이에 삽입되어 있습니다. JS 사양상 import 호이스팅으로 런타임 오류는 없지만, ESLint `import/first` 규칙 위반이며 모든 import를 파일 상단에 모아야 한다는 관례를 깨뜨립니다. 이 diff는 `toast` import 아래에 const를 추가한 흔적이 그대로 남은 것입니다.
- 제안: `PAGE_SIZE` 선언을 모든 import 아래로 이동

---

### **[WARNING]** 응답 정규화 로직 4곳에 중복
- 위치: `knowledge-bases/page.tsx` (컴포넌트 바디), `llm-configs/page.tsx` (컴포넌트 바디), `schedules/page.tsx` (queryFn 내부), `triggers/page.tsx` (queryFn 내부)
- 상세: 아래 패턴이 파일마다 재작성되어 있습니다.
  ```typescript
  const items = Array.isArray(body?.data)
    ? body.data
    : Array.isArray(body)
      ? body
      : [];
  const totalPages = Math.max(
    1,
    body?.pagination?.totalPages ??
      Math.ceil((body?.pagination?.totalItems ?? items.length) / PAGE_SIZE),
  );
  ```
  백엔드 응답 형식이 바뀌거나 버그가 발견되면 4군데를 동시에 수정해야 합니다. `schedules`/`triggers`에는 동일 내용의 주석(`// Backend (api-convention §5.2)`)도 중복되어 있습니다.
- 제안: `lib/api/utils.ts` 등에 `normalizePagedResponse<T>(body: unknown, pageSize: number): { items: T[]; totalPages: number }` 헬퍼를 추출하고 4곳에서 호출

---

### **[INFO]** `executions/page.tsx`만 `useState`로 페이지 관리
- 위치: `executions/page.tsx` 상단 — `const [page, setPage] = useState(1)`
- 상세: 나머지 7개 목록 페이지는 모두 `usePageParam`(URL 동기화)을 사용하지만, executions 페이지만 로컬 state를 씁니다. 브라우저 뒤로가기 시 페이지가 1로 초기화됩니다. 중첩 라우트 특성상 의도된 선택일 수 있으나 불일치가 있습니다.
- 제안: 의도된 선택이라면 코드 주석으로 이유를 명시; 그렇지 않으면 `usePageParam`으로 전환

---

### **[INFO]** `integrations/page.tsx`의 페이지 초기화 로직이 `usePageParam`과 중복
- 위치: `integrations/page.tsx` — `onPageChange={(next) => updateParam("page", next > 1 ? String(next) : null)}`
- 상세: `usePageParam.setPage`와 동일한 "page=1일 때 파라미터 삭제" 규칙을 인라인 람다로 재구현하고 있습니다. integrations 페이지가 자체 `updateParam`을 유지하는 구조적 이유가 있으므로 큰 문제는 아니지만, 규칙이 두 곳에 존재합니다.
- 제안: 변경 불필요하지만, 장기적으로 `updateParam`을 `usePageParam`의 `setPage`와 통합 고려

---

### **[INFO]** `PAGE_SIZE` 상수 4개 파일에 로컬 선언
- 위치: `knowledge-bases`, `llm-configs`, `schedules`, `triggers` 각 페이지 상단 — 모두 `const PAGE_SIZE = 20`
- 상세: 값이 동일하나 공유되지 않습니다. 현재는 페이지 크기가 별도로 조정될 수 있어 로컬 선언 자체는 허용 범위이지만, 기본값을 한 곳에서 관리하지 않아 전역 변경 시 수고가 증가합니다.
- 제안: `lib/api/constants.ts`에 `DEFAULT_PAGE_SIZE = 20` 추출 또는 현 구조 유지(수용 가능)

---

## 요약

공용 `Pagination` 컴포넌트와 `usePageParam` 훅의 도입은 이전에 각 페이지에 흩어져 있던 chevron 버튼 로직을 깔끔하게 통합했으며, 접근성 속성(aria-label, aria-current) 및 테스트 커버리지도 양호합니다. 주요 유지보수 부채는 **응답 정규화 로직의 4중 복제**로, 이 부분을 공통 헬퍼로 추출하면 향후 API 형식 변경에 대한 저항성이 크게 높아집니다. `llm-configs`의 import 순서 오염은 즉시 수정이 필요한 작은 결함입니다.

## 위험도

**LOW**