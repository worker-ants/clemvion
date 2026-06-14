### 발견사항

- **[INFO]** `findAll` 에서 `order` 파라미터 처리 방식 변경
  - 위치: `workflows.service.ts` 라인 101-114 (diff 기준)
  - 상세: 기존 `order.toUpperCase() as 'ASC' | 'DESC'` 단순 캐스트에서 삼항식 `=== 'ASC' ? 'ASC' : 'DESC'` 로 교체됨. 'ASC' 이외의 모든 문자열이 'DESC' 로 폴백하는 동작이 기존과 동일하게 유지된다. private `getSortColumn` 은 여전히 허용 목록(allowlist) 방식이고 사용자 입력이 SQL 에 직접 반영되지 않는다. `last_run` 분기의 서브쿼리 문자열은 하드코딩이라 injection 면역.
  - 제안: 현재 동작 충분. `order` 기본값이 `'desc'`(소문자) 이므로 `orderDir` 폴백이 'DESC' 인 것은 의도와 일치.

- **[INFO]** `queryKey` 에 `sortKey` 추가 — React Query 캐시 키 확장
  - 위치: `page.tsx` 라인 139 (diff 기준)
  - 상세: `["workflows", debouncedSearch, filter, ownership, sortKey, page]` 로 키가 늘어남. 기존 `["workflows"]` prefix 를 공유하는 `invalidateQueries` 호출들(create/delete/duplicate/toggleActive)은 여전히 올바르게 전체 워크플로 캐시를 무효화한다 — 부작용 없음.
  - 제안: 이상 없음.

- **[INFO]** `resetFilters` 에 `setSortKey("created")` 추가
  - 위치: `page.tsx` 라인 338 (diff 기준)
  - 상세: 필터 리셋 시 정렬 상태도 초기화. 예상된 동작이며 다른 상태(`search`, `filter`, `ownership`, `page`)와 대칭적.
  - 제안: 이상 없음.

- **[INFO]** `SORT_OPTIONS` 모듈-스코프 상수 도입
  - 위치: `page.tsx` 라인 49-79 (diff 기준)
  - 상세: `const SORT_OPTIONS = [...]` 는 파일 최상위 레벨에 선언되어 모듈이 처음 로드될 때 한 번 생성된다. 모든 WorkflowsPage 인스턴스가 공유하지만 불변 배열이므로 의도치 않은 상태 공유 위험 없음. 렌더마다 재생성되지 않아 오히려 메모리 효율적.
  - 제안: 이상 없음.

- **[INFO]** 테스트 파일 `mockQueryBuilder.orderBy.mockClear()` 수동 호출
  - 위치: `workflows.service.spec.ts` 라인 37, 46, 61 (diff 기준)
  - 상세: `beforeEach` 에서 `jest.clearAllMocks()` 가 이미 실행되지만, 각 테스트 안에서 `await service.findAll(...)` 호출 전에 다시 `mockClear()` 한다. 이는 `beforeEach` 에서 다른 setup 코드(`mockRegistry.applyConfigDefaults.mockImplementation` 등)가 mockClear 후에 실행되기 때문으로, 이중 clear 자체는 무해하다. 단, `mockClear` 가 mock 구현은 초기화하지 않고(`mockReset` 과 다름) 호출 기록만 지우므로 `orderBy.mockReturnThis()` 초기 구현이 유지된다.
  - 제안: 이상 없음.

- **[INFO]** `last_run` sort 값이 `getSortColumn` allowlist 에 포함되지 않음 (의도적 설계)
  - 위치: `workflows.service.ts` `getSortColumn` private 메서드
  - 상세: `last_run` 은 `findAll` 에서 `if (sort === 'last_run')` 으로 먼저 분기되므로 `getSortColumn` 에 도달하지 않는다. allowlist 에 추가할 이유가 없고 추가하면 `w.last_run` 컬럼 조회 시도로 런타임 오류 발생 가능성이 있다 — 현재 설계가 올바름.
  - 제안: 이상 없음.

### 요약

이번 변경의 핵심은 워크플로 목록 정렬 기능 추가(`sort=last_run` subquery, `SORT_OPTIONS` UI 드롭다운)다. 서비스 레이어에서 사용자 입력(`sort`, `order`)이 SQL 에 반영되는 경로를 분석한 결과, `last_run` 분기의 서브쿼리 문자열은 하드코딩이고 `getSortColumn` 은 allowlist 방식으로 injection 을 차단한다. 전역 변수 도입이나 공유 상태 변경은 없으며, `findAll` 시그니처와 `QueryWorkflowDto` 는 변경되지 않아 기존 호출자(`WorkflowsController`)에 영향이 없다. 프론트엔드에서 `queryKey` 확장과 `SORT_OPTIONS` 모듈 상수 도입 모두 기존 캐시 무효화 로직과 호환된다. 의도치 않은 부작용은 발견되지 않았다.

### 위험도

NONE
