## 발견사항

### [HIGH] 5개 페이지 컴포넌트에 테스트 없음
- **위치**: `integrations/page.tsx`, `knowledge-bases/page.tsx`, `llm-configs/page.tsx`, `schedules/page.tsx`, `triggers/page.tsx`
- **상세**: 페이지네이션 동작이 추가된 5개 페이지 모두 테스트가 없음. 특히 `triggers/page.tsx`는 탭/상태 필터 변경 시 `setPage(1)`을 명시 호출하는 로직이 있는데 이 동작이 검증되지 않음.
- **제안**: `workflows-page.test.tsx`와 동일한 패턴으로 각 페이지에 최소한 회귀 케이스(pagination 표시/숨김, 필터 변경 시 페이지 리셋) 추가

---

### [HIGH] `totalPages` 폴백 로직 버그 - 테스트 미커버
- **위치**: `knowledge-bases/page.tsx:55-60`, `llm-configs/page.tsx:70-75`, `schedules/page.tsx:520-527`
- **상세**: `pagination.totalPages`와 `pagination.totalItems` 모두 없을 때 `collections.length`(현재 페이지 아이템 수)로 `totalPages`를 계산함. PAGE_SIZE=20이고 마지막 페이지에 5개만 있으면 `Math.ceil(5/20)=1`이 되어 페이지네이션이 사라짐. 이 케이스를 커버하는 테스트 없음.
  ```typescript
  // collections.length는 전체 아이템 수가 아닌 현재 페이지 아이템 수
  Math.ceil((data?.pagination?.totalItems ?? collections.length) / PAGE_SIZE)
  ```
- **제안**: 이 시나리오를 명시적으로 테스트하거나, `totalItems` 없이는 totalPages를 1로 고정하는 방향으로 정책 통일

---

### [WARNING] `pagination.test.tsx` — `siblingCount`, `className` prop 미테스트
- **위치**: `pagination.tsx:6-11`
- **상세**: `siblingCount=0`, `siblingCount=2`, `className` 커스텀 등 공개 prop이 테스트에서 전혀 다루지 않음. `siblingCount=0`인 경우 ellipsis 위치 판단 로직(`sorted[i] < page`)이 경계에서 예상치 않게 동작할 수 있음.
- **제안**: `siblingCount`별 렌더 결과 스냅샷 또는 명시 케이스 추가

---

### [WARNING] `page > totalPages` 경계값 테스트 없음
- **위치**: `pagination.tsx:buildTokens`
- **상세**: URL에 `?page=99`가 있고 API가 `totalPages=3`을 반환할 때 컴포넌트 동작이 미검증. `buildTokens`에서 page가 totalPages를 초과하면 `isCurrent=true`인 토큰이 없어 현재 페이지 하이라이트가 사라짐.
- **제안**: `page > totalPages` 케이스 테스트 추가 (렌더 깨짐 없음 + 마지막 페이지 하이라이트 여부 확인)

---

### [WARNING] `integrations/page.tsx` — `usePageParam` 미사용, 동작 불일치
- **위치**: `integrations/page.tsx:308-313`
- **상세**: 다른 페이지들은 `usePageParam`의 `setPage`를 쓰지만 integrations만 `updateParam("page", next > 1 ? String(next) : null)`을 직접 사용. 기능적으로 동일하지만 동작 출처가 분산되어 있고 별도 테스트 없음.
- **제안**: `usePageParam`으로 통일하거나, integrations 페이지의 페이지네이션 동작 테스트 추가

---

### [WARNING] `executions/page.tsx` — URL 미동기화
- **위치**: `executions/page.tsx:100`
- **상세**: `const [page, setPage] = useState(1)`을 사용해 페이지 번호가 URL에 반영되지 않음. 다른 모든 페이지가 `usePageParam`을 써서 URL 동기화를 하는 것과 불일치. 뒤로 가기 후 재방문 시 페이지가 1로 초기화됨.
- **제안**: 의도적 설계라면 주석으로 명시, 아니라면 `usePageParam`으로 교체 후 테스트 추가

---

### [INFO] `workflows-page.test.tsx` — `cleanup()` 위치
- **위치**: `workflows-page.test.tsx:51`
- **상세**: `cleanup()`이 `beforeEach`에 위치해 있음. 표준은 `afterEach` (testing-library의 자동 cleanup과 중복될 수 있음). `pagination.test.tsx`는 `afterEach`에서 올바르게 호출.
- **제안**: `afterEach`로 이동

---

### [INFO] `WorkflowsPage` 테스트 — `usePageParam` 통합 미검증
- **위치**: `workflows-page.test.tsx`
- **상세**: 필터 변경 시 page가 1로 리셋되는 동작(`handleFilterChange`), debounced search 후 page 리셋 동작이 테스트되지 않음. `currentSearchParams`에 `page=3`을 세팅한 채로 필터를 변경하면 page가 초기화되는지 확인하는 케이스가 필요.
- **제안**: `currentSearchParams = new URLSearchParams("page=3")` 상태에서 필터 클릭 → `mockReplace` URL에 `page=` 없음 검증하는 테스트 추가

---

## 요약

`Pagination` 컴포넌트와 `usePageParam` 훅은 핵심 케이스를 잘 커버하는 테스트가 갖춰져 있고, `workflows-page.test.tsx`는 이전 파싱 버그에 대한 명확한 회귀 케이스를 포함한다. 그러나 페이지네이션이 적용된 5개 페이지 컴포넌트 중 workflows만 테스트가 있어 커버리지 편중이 심하다. 특히 `pagination.totalItems` 없이 `collections.length`로 `totalPages`를 계산하는 폴백 로직은 마지막 페이지에서 잘못된 결과를 낼 수 있으며 어떤 테스트도 이를 잡아내지 못한다.

## 위험도

**MEDIUM**