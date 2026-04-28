## 성능 리뷰 결과

---

### 발견사항

---

**[POSITIVE] 구 페이지네이션 대비 DOM 렌더 성능 대폭 개선**
- 위치: `workflows/page.tsx:470-506`, `workflows/[id]/executions/page.tsx:301-312`
- 상세: 기존 구현은 `Array.from({ length: totalPages }).map(...)` 으로 전체 페이지 수만큼 `<Button>`을 렌더했다(`totalPages=100` → 100개 DOM 노드). 신규 `Pagination` 컴포넌트는 ellipsis 처리로 항상 `O(2 * siblingCount + 5)` 이하의 버튼만 렌더한다. 이번 변경에서 가장 유의미한 성능 개선이다.

---

**[WARNING] `placeholderData: keepPreviousData` 누락 — 페이지 전환 시 레이아웃 시프트**
- 위치: `knowledge-bases/page.tsx:44`, `llm-configs/page.tsx:60`, `schedules/page.tsx:492`, `triggers/page.tsx:82`
- 상세: 페이지 전환 시 해당 페이지 캐시 항목이 없으면 `isLoading=true`로 전환되어 목록이 사라졌다가 재렌더된다. 이는 불필요한 CLS(Cumulative Layout Shift) 와 리렌더 사이클을 유발한다. 빠르게 여러 페이지를 탐색하는 시나리오에서 체감된다.
- 제안: 각 `useQuery`에 `placeholderData: (prev) => prev` 추가 (React Query v5):
  ```ts
  useQuery({
    queryKey: ["knowledge-bases", page],
    queryFn: ...,
    placeholderData: (prev) => prev,
  });
  ```

---

**[WARNING] `onPageChange` 인라인 함수 — 부모 리렌더마다 새 참조 생성**
- 위치: `integrations/page.tsx:308-311`
- 상세: `(next) => updateParam("page", next > 1 ? String(next) : null)` 는 매 렌더마다 새 함수 인스턴스를 생성한다. `Pagination`이 `React.memo`로 감싸지지 않은 상태에서 부모(IntegrationsPage)가 isFetching 상태 변경 등으로 리렌더되면 Pagination도 항상 리렌더된다. `updateParam` 함수 자체도 `useCallback` 없이 매 렌더마다 재생성된다.
- 제안: `updateParam`을 `useCallback`으로 안정화하고, 해당 핸들러도 별도 `useCallback`으로 추출:
  ```ts
  const updateParam = useCallback((key: string, value: string | null) => {
    ...
  }, [searchParams, router]);

  const handlePageChange = useCallback(
    (next: number) => updateParam("page", next > 1 ? String(next) : null),
    [updateParam],
  );
  ```

---

**[INFO] `buildTokens` 결과가 매 렌더마다 재계산**
- 위치: `pagination.tsx:67`
- 상세: `buildTokens(page, totalPages, siblingCount)` 는 `useMemo` 없이 렌더 본체에서 직접 호출된다. 입력 크기는 최대 `2 * siblingCount + 3` 이므로 연산 자체는 미미하지만, `Set` 생성 → 배열 스프레드 → sort → 토큰 배열 구성 순으로 매 렌더마다 4회 이상의 객체 할당이 발생한다.
- 제안: `useMemo` 적용 + `Pagination`에 `React.memo` 추가 시 실질 효과 발생:
  ```ts
  const tokens = useMemo(
    () => buildTokens(page, totalPages, siblingCount),
    [page, totalPages, siblingCount],
  );
  ```

---

**[INFO] `Pagination` 컴포넌트에 `React.memo` 미적용**
- 위치: `pagination.tsx:50`
- 상세: `Pagination`은 외부 상태 없이 props만 의존하는 순수 컴포넌트다. `React.memo` 없이는 부모가 리렌더될 때마다 (검색어 입력, isFetching 토글 등) 항상 함께 리렌더된다.
- 제안: `export const Pagination = React.memo(function Pagination(...) { ... })`

---

**[INFO] 목록 쿼리에 `staleTime` 미설정**
- 위치: `knowledge-bases/page.tsx:44`, `llm-configs/page.tsx:60`, `schedules/page.tsx:492`, `triggers/page.tsx:82`
- 상세: `staleTime` 기본값(0)이므로 탭 포커스 복귀, 창 전환 때마다 background refetch가 발생한다. `integrations/page.tsx`의 `services` 쿼리(`staleTime: 5 * 60 * 1000`)와 대조적으로 목록 쿼리는 무방비 상태다. 사용자가 여러 페이지를 탐색 후 돌아올 때 이전 페이지도 재fetch된다.
- 제안: `staleTime: 30_000`(30초) 수준을 기본값으로 고려.

---

**[INFO] `schedules/page.tsx`, `triggers/page.tsx` — `queryFn` 내 데이터 변환**
- 위치: `schedules/page.tsx:497-533`, `triggers/page.tsx:85-128`
- 상세: raw 응답 → 도메인 객체 변환이 `queryFn` 내부에서 수행된다. `select` 옵션과 달리 `queryFn` 결과는 캐시에 저장되므로, 변환 로직이 캐시 구조와 강결합된다. `select`를 쓰면 캐시에는 raw 응답이 저장되고 변환은 구독 시에만 발생해 캐시 재사용성이 높아진다.
- 제안: `select: (res) => ({ items: transformSchedules(res.data), totalPages: ... })` 형태로 이동. 비필수 개선.

---

**[INFO] `llm-configs/page.tsx` — `const PAGE_SIZE` 위치가 import 블록 중간**
- 위치: `llm-configs/page.tsx:14-16`
- 상세: `const PAGE_SIZE = 20;` 선언이 import 문 사이에 삽입되어 있다. 실행은 정상이나 ESLint import 순서 규칙 위반으로 빌드 경고를 유발할 수 있고 가독성을 해친다.
- 제안: import 블록 종료 후로 이동.

---

### 요약

이번 변경의 핵심 성능 개선은 구 페이지네이션의 "전체 페이지 수만큼 버튼 렌더" 패턴 제거로, 페이지가 많을수록 DOM 노드가 선형 증가하던 문제를 ellipsis 컴포넌트로 O(상수) 수준으로 억제한 것이다. 반면 신규 구현에서는 `placeholderData` 미설정으로 인한 페이지 전환 시 레이아웃 시프트, `React.memo` / `useMemo` 미적용으로 인한 불필요한 재계산, 인라인 핸들러 함수의 매 렌더마다 재생성 등이 보완 여지로 남아 있다. 모두 현재 규모에서는 체감 임계를 넘지 않지만, 목록 항목이 많거나 필터 인터랙션이 빈번한 시나리오에서는 누적 효과가 발생할 수 있다.

---

### 위험도

**LOW** — 기능 동작은 정확하며 구 코드 대비 명확한 성능 향상(DOM 노드 수 감소)이 있다. 지적된 이슈는 대규모 데이터 또는 고빈도 인터랙션에서만 체감 가능한 수준이다.