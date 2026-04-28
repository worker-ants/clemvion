## 발견사항

---

### **[WARNING]** `setPage`가 `useEffect` 의존성 배열에 포함되어 이중 디바운스 유발

- **위치**: `workflows/page.tsx`, `useEffect([search, setPage])`
- **상세**: `usePageParam`의 `setPage`는 `[pathname, router, searchParams]`를 의존성으로 갖는 `useCallback`이다. `setPage(1)` 호출 시 URL이 변경되고(`?page=` 제거), `searchParams` 참조가 교체되어 `setPage` 자체의 identity가 새로 갱신된다. 이로 인해 "검색어 변경 → 300ms 후 setPage(1) → searchParams 변경 → effect 재실행 → 300ms 후 setPage(1) (no-op)" 흐름이 발생한다. page > 1 상태에서 검색어를 변경할 때 실질적인 디바운스가 300ms + 300ms(최대 600ms)로 두 배 늘어난다.
- **제안**: `setPage(1)`을 `useEffect` 내에서 직접 호출하는 대신, `page > 1`인 경우에만 실행되도록 조건을 추가하거나, `setPage`를 의존성에서 제외하고 `ref`로 캡처하는 패턴을 사용한다.

```ts
useEffect(() => {
  const timer = setTimeout(() => {
    if (page > 1) setPage(1); // page가 이미 1이면 URL 변경 없음
  }, 300);
  return () => clearTimeout(timer);
}, [search]); // setPage 제외, ref로 접근
```

---

### **[WARNING]** `totalPages` 폴백 로직이 전체 페이지 수를 과소 추정

- **위치**: `knowledge-bases/page.tsx:51-56`, `llm-configs/page.tsx:67-72`
- **상세**: 백엔드가 `pagination` 블록 없이 현재 페이지 데이터만 반환하는 경우, `Math.ceil(collections.length / PAGE_SIZE)`를 사용하는데, 현재 페이지 아이템 수는 항상 `≤ PAGE_SIZE`이므로 결과는 항상 `1`이 된다. 즉, 실제로 여러 페이지가 있어도 페이지네이션이 숨겨지는 동작은 새 코드에서도 동일하게 발생한다. `data` 자체가 배열인 레거시 응답 형식에서는 더욱 심각하다.
- **제안**: 폴백 계산 로직의 한계를 명확히 주석으로 문서화하고, `schedules/page.tsx`·`triggers/page.tsx`처럼 `queryFn` 내부에서 계산하여 실제 API 응답 전체를 참조하도록 통일한다.

---

### **[WARNING]** `const PAGE_SIZE = 20`이 `import` 문 사이에 위치

- **위치**: `llm-configs/page.tsx:15-16`
- **상세**: ESM에서 정적 `import`는 소스 내 위치와 무관하게 최상단으로 호이스팅되므로 런타임 오류는 없다. 그러나 대부분의 린터(ESLint `import/first` 규칙)가 이 패턴을 오류로 플래그한다. CI 린트 단계에서 빌드가 깨질 수 있다.
- **제안**: `PAGE_SIZE` 선언을 모든 `import` 문 아래로 이동한다.

---

### **[INFO]** `Pagination` 렌더링 가드 패턴 불일치

- **위치**: `integrations/page.tsx:300` vs. `knowledge-bases/page.tsx`, `llm-configs/page.tsx`, `schedules/page.tsx`, `triggers/page.tsx`
- **상세**: `integrations/page.tsx`는 `pagination && pagination.totalPages > 1`로 외부에서 렌더링을 차단하지만, 다른 페이지는 `<Pagination>` 컴포넌트 자체의 `if (totalPages <= 1) return null` 가드에만 의존한다. 동작은 동일하지만 코드 패턴이 일관되지 않다.
- **제안**: `integrations/page.tsx`의 외부 가드를 제거하거나, 나머지 페이지에도 동일한 외부 가드를 추가하여 일관성을 확보한다.

---

### **[INFO]** `schedules`·`triggers` 쿼리 반환 타입 변경

- **위치**: `schedules/page.tsx:491-521`, `triggers/page.tsx:79-128`
- **상세**: `useQuery<Schedule[]>`에서 `useQuery<{ items: Schedule[]; totalPages: number }>`으로 타입이 변경되었다. 컴포넌트 내부 전용 변경이므로 외부 파괴적 변경(breaking change)은 없다. 다만, 같은 `queryKey`를 참조하는 다른 컴포넌트나 테스트가 있다면 타입 불일치가 발생할 수 있다.
- **제안**: `["schedules"]`·`["triggers"]` queryKey를 사용하는 다른 컨슈머가 있는지 프로젝트 전체에서 검색하여 확인한다.

---

### **[INFO]** `workflows/page.tsx`: 페이지 상태 저장소 변경 (useState → URL param)

- **위치**: `workflows/page.tsx:44`
- **상세**: 이전에는 컴포넌트 언마운트 시 페이지가 1로 초기화되었지만, 이제 URL에 저장되어 뒤로 가기·새로고침 후에도 유지된다. 동작 변화 자체는 의도된 개선이지만, 이로 인해 브라우저 히스토리에 페이지 상태가 남아 "뒤로 가기" 시 사용자가 예전 페이지로 이동하는 UX가 생긴다. `router.replace`를 사용하므로 히스토리 스택을 오염시키지는 않는다. ✓

---

## 요약

이번 변경은 공용 `Pagination` 컴포넌트와 `usePageParam` 훅으로 여러 목록 페이지의 페이지네이션을 통일한 리팩터링으로, 구조적으로는 올바른 방향이다. 가장 주의할 부작용은 `workflows/page.tsx`의 `setPage`가 `useEffect` 의존성 배열에 포함되면서 발생하는 이중 디바운스이며, 검색어 변경 시 응답 지연을 체감할 수 있다. `llm-configs/page.tsx`의 `import` 순서 오류는 CI 린트를 깨뜨릴 가능성이 있어 조기에 수정이 필요하다. `totalPages` 폴백 로직은 레거시 API 호환을 위한 선택이지만, 그 한계가 문서화되지 않으면 향후 혼란을 줄 수 있다.

## 위험도

**LOW**