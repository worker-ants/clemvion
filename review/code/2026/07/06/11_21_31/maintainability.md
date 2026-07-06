# 유지보수성 리뷰 — 워크플로우 목록 단일 태그 필터 UI

대상 커밋: `2d0eb622c` (`fe-tag-filter-283723`, base `origin/main`)
대상 파일:
- `codebase/frontend/src/app/(main)/workflows/page.tsx`
- `codebase/frontend/src/app/(main)/workflows/__tests__/workflows-page.test.tsx`
- `codebase/frontend/src/lib/i18n/dict/ko/workflows.ts`
- `codebase/frontend/src/lib/i18n/dict/en/workflows.ts`
- `spec/2-navigation/1-workflow-list.md`

## 발견사항

- **[INFO]** reset 시 `debouncedTag` 를 즉시 클리어하는 것이 기존 `debouncedSearch` reset 패턴과 다름
  - 위치: `page.tsx:387-396` (`handleResetFilters`) vs `page.tsx:132-138`(search debounce effect)
  - 상세: 기존 `handleResetFilters` 는 `setSearch("")` 만 호출하고 `setDebouncedSearch("")` 는 부르지 않는다 — `debouncedSearch` 는 300ms 후 debounce effect 가 자동으로 `""` 로 따라간다. 이번 변경은 `setTagFilter("")` 와 `setDebouncedTag("")` 를 **함께** 즉시 호출한다(`page.tsx:393-394`). 동작 관점에서는 tag 쪽이 오히려 더 낫다 — `hasActiveFilters` 가 `!!debouncedTag` 를 참조하므로(`page.tsx:384`), `setDebouncedTag("")` 를 생략하면 300ms debounce 창 동안 EmptyState 가 "Reset Filters" CTA 를 순간적으로 계속 노출하는 깜빡임이 생긴다(검색 쪽은 이 깜빡임을 감수해온 기존 결함성 패턴). 다만 "동일 파일 내 같은 성격의 두 필터가 reset 처리 방식만 다르다"는 점은 향후 유지보수자가 의도된 개선인지 실수인지 헷갈릴 수 있다.
  - 제안: 코드 변경은 불필요(오히려 tag 쪽이 더 견고함). 다만 짧은 주석으로 "search 와 달리 debouncedTag 도 즉시 클리어해 reset 직후 잠깐의 CTA 깜빡임을 없앤다"는 의도를 남기면, 이후 리뷰어가 "왜 대칭이 아니지"라는 재조사 비용을 줄일 수 있다. (선택사항, 필수 아님)

- **[INFO]** tag Input 컨테이너 폭 클래스가 검색창과 다름
  - 위치: `page.tsx:433`(`relative flex-1 max-w-sm`, search) vs `page.tsx:474`(`relative w-44`, tag)
  - 상세: 검색창은 `flex-1 max-w-sm` 로 가변폭인 반면 태그 필터는 정렬 드롭다운(`w-44`, `page.tsx:457`)·폴더 드롭다운(`w-44`, `page.tsx:489`)과 동일한 고정폭 `w-44` 를 사용한다. 아이콘+`pl-9` 패턴 자체는 search 와 정확히 일치해 일관적이나, 폭만 다르다.
  - 상세: 이는 회귀가 아니라 "자유 텍스트 검색창은 넓게, 필터류(정렬/폴더/태그)는 고정폭 목록형으로 통일"이라는 기존 레이아웃 관례를 태그 필터에도 그대로 적용한 것으로 읽힌다 — 폴더 필터 PR(#830, `a9e2186ae`)에서도 동일하게 `w-44` 를 썼다. 의도적 일관성으로 판단되며 결함으로 보지 않는다.
  - 제안: 없음(참고 목적 기록).

## 확인된 정상 항목 (결함 아님)

- **태그 debounce effect vs 검색 debounce effect 미러링**: 두 effect(`page.tsx:132-138`, `page.tsx:141-147`) 모두 `setPageRef.current(1)` 를 사용해 `setPage` identity churn 으로 인한 debounce 연쇄 재발화 문제를 동일하게 회피한다. deps 배열도 각각 `[search]`/`[tagFilter]` 로 독립적이며 올바르다. 주석(`page.tsx:140`)도 "검색과 동일하게 debounce" 라고 명시해 의도가 분명하다.
- **Input UI 아이콘 패턴**: `Tag` 아이콘 + `aria-hidden` + `absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]` + `pl-9` 조합이 `Search` 아이콘 블록과 완전히 동일한 구조. `aria-label`(`t("workflows.tagFilter.aria")`) 도 함께 부여되어 접근성 측면에서 folder/sort 드롭다운과 동일 수준.
- **hasActiveFilters 대칭성**: `!!debouncedTag` 로 확정값 기준 판단, `!!debouncedSearch` 와 동일한 패턴(둘 다 raw 값이 아닌 debounced 값 참조) — 타이핑 중간에 필터가 활성화된 것처럼 EmptyState 가 깜빡이지 않도록 하는 의도가 search 와 정확히 일치.
- **쿼리 파라미터 송신 로직**: `if (debouncedTag) params.tag = debouncedTag;`(`page.tsx:208`) 가 `if (debouncedSearch) params.search = debouncedSearch;`(`page.tsx:188`), `if (folderId) params.folderId = folderId;`(`page.tsx:206`) 와 동일한 "빈 값 미송신" 관례를 그대로 따른다. queryKey 배열(`page.tsx:173-182`)에도 `debouncedTag` 가 정확히 포함되어 캐시 무효화가 올바르게 트리거된다.
- **i18n parity**: `ko/workflows.ts` 는 `as const`(`tagFilter: { aria, placeholder }`, 34-37행), `en/workflows.ts` 는 `Dict["workflows"]` 타입(동일 키, 34-37행) — 두 언어 모두 `aria`/`placeholder` 키가 정확히 대응하며 다른 필터 블록(`folderFilter`, `ownership`)과 동일한 서브객체 구조 컨벤션을 따른다. 신규 키 이외 기존 키 변경 없음.
- **네이밍**: `tagFilter`/`debouncedTag`(state), `workflow-tag-filter`(data-testid), `tagFilter.aria`/`tagFilter.placeholder`(i18n) 모두 `folderId`/`workflow-folder-filter`/`folderFilter.*` 네이밍 컨벤션과 결이 맞다. `tagFilter` vs `debouncedTag` 처럼 raw/debounced 두 변수의 이름이 `search`/`debouncedSearch` 와 동일한 접두사 규칙(`debounced` + 필터명)을 따른다.
- **중복 코드**: 두 debounce effect 는 구조가 거의 동일(각 6줄)하지만 공용 훅으로 추출하지 않은 것은 기존 코드베이스도 동일 트레이드오프(effect 2개, 각각 짧고 명확) — 3번째 debounce 필터가 추가되면 공통화를 고려할 만하나 현재 2개 수준에서는 추출 강제할 정도의 중복은 아니다.
- **함수 길이/복잡도**: `WorkflowsPage` 컴포넌트 자체가 이미 크지만(기존 구조), 이번 diff 로 추가된 순증분(state 2줄 + effect 6줄 + queryKey/params 각 1줄 + JSX 블록 14줄 + hasActiveFilters/reset 각 1줄)은 작고 지역적이며 새로운 조건 분기나 중첩을 만들지 않는다.
- **매직 넘버**: `300`(ms) 은 기존 search debounce 와 동일한 리터럴을 재사용(하드코딩이지만 기존 패턴을 그대로 따른 것이며 새로 도입된 매직 넘버 아님).
- **테스트**: 신규 `describe("WorkflowsPage — tag filter (NAV §2.3)")` 블록이 렌더링·debounce 송신·빈 값 미송신·활성 필터+reset 클리어까지 4개 케이스로 폴더 필터 테스트 블록과 동일한 스타일(동일 `beforeEach`/`afterEach` 셋업)을 따른다.

## 요약

이번 변경은 기존 검색 필터의 debounce/쿼리 전송/`hasActiveFilters` 패턴을 태그 필터에 정확히 미러링했고, i18n·네이밍·테스트 구조 모두 기존 컨벤션과 일관된다. 유일하게 눈에 띄는 지점은 reset 시 `debouncedTag` 를 즉시 클리어하는 것이 기존 `debouncedSearch` reset 방식과 다르다는 점인데, 이는 결함이 아니라 오히려 EmptyState CTA 깜빡임을 없애는 더 견고한 처리이며 코드 수정을 요구하지 않는다(선택적으로 의도를 밝히는 주석만 권장). Critical/Warning 급 유지보수성 결함은 발견되지 않았다.

## 위험도

NONE
