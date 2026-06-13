# 유지보수성(Maintainability) 리뷰

## 발견사항

### [INFO] `getSortColumn` 과 `last_run` 분기 처리 방식의 불일치
- 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` — `findAll` 메서드 내 정렬 블록 (변경 diff 라인 +9 ~ +21)
- 상세: `getSortColumn`은 허용 목록(allowlist) 기반으로 컬럼명을 반환하는 private 메서드인데, `last_run`은 이 메서드를 우회해 `findAll` 내에서 직접 `if (sort === 'last_run')` 분기로 처리한다. 정렬 관련 로직이 두 곳(메서드 + 직접 분기)에 나뉘어 있어, 향후 정렬 옵션을 추가할 때 어느 쪽에 추가해야 하는지 판단 기준이 모호해진다.
- 제안: `getSortColumn`을 `getSortExpression(sort: string): { expr: string; nulls?: string }` 형태로 확장하거나, `last_run`도 메서드 내에서 처리해 정렬 관련 로직을 단일 지점에 응집시키는 것을 고려할 수 있다. 다만 subquery 길이가 길어 읽기 어려울 수 있으므로, 현재 코드에 달린 주석(`injection 안전`, spec 참조)이 의도를 충분히 보완하고 있어 즉각적인 리팩터링 필요성은 낮다.

### [INFO] `orderDir` 계산 로직의 중복 삼항 — 단순화 여지
- 위치: `workflows.service.ts` — `findAll` 내 `orderDir` 계산 (`order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'`)
- 상세: 이전 코드의 `order.toUpperCase() as 'ASC' | 'DESC'` 단언을 삼항으로 교체해 타입 안전성을 높였으나, `QueryWorkflowDto`에서 `order`를 이미 `'asc' | 'desc'` 리터럴 타입으로 제한한다면 삼항 없이 `order.toUpperCase() as 'ASC' | 'DESC'`가 동등하다. DTO 타입 수준에서 이미 값 범위가 보장된다면 방어 코드가 중복이 된다. 반면 DTO 외부에서 `findAll`이 직접 호출될 경로가 있다면 현재 방식이 더 안전하다.
- 제안: 수정 자체는 올바르다. DTO 레벨 검증이 있다는 주석 또는 타입 guard를 명시하면 이 삼항이 "방어 코드"임을 후임자가 바로 파악할 수 있다.

### [INFO] Frontend `queryFn` 내 `SORT_OPTIONS.find` 중복 탐색
- 위치: `codebase/frontend/src/app/(main)/workflows/page.tsx` — `queryFn` 내 `if (sortKey !== 'created')` 블록 (변경 diff 라인 +9 ~ +14)
- 상세: `sortKey`가 `SortKey` 타입이고 `SORT_OPTIONS`는 모든 `SortKey`를 커버하므로 `find`는 항상 값을 반환한다. `if (opt)`의 null guard는 실제로 도달 불가능한 방어 코드다. 코드 자체는 문제가 없으나 `opt`가 `undefined`일 수 있다는 암묵적 뉘앙스가 타입 정보와 어긋나 독자가 잠깐 멈추게 된다. 또한 `sortKey !== 'created'`인 경우에만 파라미터를 보내는 최적화 의도는 주석으로 설명되어 있지만, `created`가 기본값이라는 사실이 `SORT_OPTIONS` 정의 주석(`"created" 는 서버 기본값과 동일`)에만 있다.
- 제안: `sortKey !== 'created'` 대신 `'created'`를 `DEFAULT_SORT_KEY` 상수로 추출하거나, Map 자료구조로 `SORT_OPTIONS`를 색인화해 `find` 대신 직접 접근하면 O(n) 탐색을 O(1)로 줄일 수 있다. 다만 항목이 4개뿐이라 실성능 차이는 미미하므로 INFO 수준이다.

### [INFO] `hasActiveFilters` 계산식에서 정렬 상태(`sortKey`)가 제외됨
- 위치: `page.tsx` — `hasActiveFilters` 계산 (~라인 2486~2489)
- 상세: 비기본 정렬(`sortKey !== 'created'`)이 적용된 상태라도 `hasActiveFilters`가 `false`로 평가될 수 있다. 이 경우 "빈 상태" 화면에서 "필터를 조정해 보세요" 메시지 대신 "첫 워크플로우를 만들어 보세요" 안내가 나온다 — 정렬이 활성화된 상태에서도 비어 있다면 오해를 줄 수 있다. 반면 정렬은 결과 개수를 바꾸지 않으므로 제외가 의도적일 수 있다.
- 제안: 의도가 명확하다면 주석으로 "정렬은 빈 상태 감지에서 제외(결과 개수 불변)" 정도를 표기하면 독자 혼란을 방지한다.

### [INFO] 테스트 파일 — `mockClear` 반복 호출 패턴이 `beforeEach`와 중복
- 위치: `codebase/backend/src/modules/workflows/workflows.service.spec.ts` — 추가된 세 테스트 (`기본 sort`, `last_run sort`, `injection 차단`)에서 각각 `mockQueryBuilder.orderBy.mockClear()` 명시
- 상세: `beforeEach`에 `jest.clearAllMocks()`가 이미 있어 모든 mock이 각 테스트 전에 리셋된다. 명시적 `mockClear` 호출은 중복이다. 이전에 추가된 `ownership='all'` 테스트(라인 282~283)의 `.mockClear()` 패턴을 그대로 답습한 것으로 보인다.
- 제안: 새로 추가한 테스트 세 건에서 `mockQueryBuilder.orderBy.mockClear()` 제거를 고려한다. 기존 패턴과 일관성을 위해 유지할 수는 있지만 `jest.clearAllMocks()`와 중복이므로 혼란을 줄 여지가 있다.

### [INFO] 테스트 내 spec 섹션 참조(`§2.4`)가 테스트 설명 문자열에 직접 삽입됨
- 위치: `workflows.service.spec.ts` 라인 45 — `"§2.4 sort='last_run' → ..."`
- 상세: spec 섹션 번호를 테스트 이름에 포함하는 패턴은 이 파일 내에서 일관성이 없다(다른 테스트들은 동작 설명만 사용). spec 섹션 번호가 변경되면 테스트 설명도 업데이트해야 하는 결합이 생긴다.
- 제안: 명백히 악영향은 아니며 트레이서빌리티에 도움이 된다는 장점도 있다. 다만 파일 내 일부 테스트에만 이 패턴이 있으면 일관성이 떨어진다. 프로젝트 컨벤션으로 spec 참조를 테스트 이름에 넣기로 했다면 모든 spec 연관 테스트에 적용하거나, 그렇지 않다면 제거한다.

---

## 요약

이번 변경은 `last_run` 정렬을 backend에 추가하고 frontend에 정렬 드롭다운을 연동하는 범위로, 전반적으로 기존 코드 스타일을 잘 따르고 있다. 주요 우려는 정렬 로직이 `getSortColumn` 메서드와 `findAll` 내 직접 분기로 분산되어 향후 정렬 옵션 추가 시 변경 지점을 찾기 어려울 수 있다는 점이며(INFO), 나머지 사항은 불필요한 `mockClear` 중복, `find`의 null guard 논리적 불일치, `hasActiveFilters`에서 정렬 상태 누락 등 미세한 가독성·명확성 문제다. 크리티컬하거나 즉각적인 수정이 필요한 항목은 없다.

## 위험도

LOW
