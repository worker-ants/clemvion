# 테스트 리뷰 — 워크플로우 목록 폴더 필터 UI (NAV §2.3)

대상: `.claude/worktrees/fe2-workflow-list-filters-08493f`, HEAD=6279d01b6, `git diff origin/main...HEAD`
핵심 파일: `codebase/frontend/src/app/(main)/workflows/__tests__/workflows-page.test.tsx` 신규 `describe("WorkflowsPage — folder filter (NAV §2.3)")`

18개 테스트 전부 통과 확인(`npx vitest run` 및 `--sequence.shuffle` 재확인 완료).

## 발견사항

- **[WARNING]** page-reset 단언이 실제 회귀를 잡지 못하는 구조 (기존 sort describe 와 동일한 사전 존재 결함, 이번 PR 이 그 패턴을 그대로 복제)
  - 위치: `workflows-page.test.tsx` `"sends ?folderId=<id> and resets to page 1 when a folder is selected"` (신규), 참고로 기존 `"resets page to 1 when the sort changes"` 도 동일 문제 보유
  - 상세: 테스트 mock 에서 `next/navigation` 의 `useRouter().replace` 는 `mockReplace = vi.fn()` 로 완전한 no-op 이고, `useSearchParams()` 는 고정된 `currentSearchParams` 변수를 반환한다(`beforeEach` 에서만 `new URLSearchParams()` 로 리셋, 클릭 핸들러가 이를 갱신하지 않음). `usePageParam()` 은 `page` 를 오직 `searchParams.get("page")` 로부터 파생하므로, 테스트에서 "2" 페이지 버튼을 클릭해도 `mockReplace` 가 `/workflows?page=2` 인자로 호출될 뿐 `currentSearchParams` 는 갱신되지 않는다. 직접 계측(`console.log`)으로 확인: 클릭 후 `currentSearchParams.toString()` 은 빈 문자열 그대로였다. 즉 컴포넌트가 관찰하는 `page` 값은 테스트 전체에서 시종 `1` 이며, "페이지 2로 이동 후 폴더 선택 → page=1 로 리셋" 검증은 애초에 `page` 가 `2` 로 바뀐 적이 없으므로 `setPage(1)` 호출 여부와 무관하게 항상 통과한다(즉 실제로 리셋 로직을 삭제해도 이 단언은 fail 하지 않는다).
  - 제안: `usePageParam`/`useSearchParams` mock 을 stateful 하게 만들어(`mockReplace` 구현이 `currentSearchParams` 를 실제로 갱신하도록) page 클릭이 실제로 `page` state 를 바꾸도록 해야 이 계열 테스트(sort/folder 공통)가 의미를 가진다. 최소한 회귀 방지 관점에서, `setPage` 호출 자체를 스파이해 `expect(mockReplace).toHaveBeenLastCalledWith(expect.stringContaining("?")` 없이 호출됐는지(= page 파라미터 delete 됨) 확인하는 방식으로 바꿀 수도 있다. 이번 PR 단독 결함이 아니라 기존 sort describe 에서 이미 존재하던 패턴을 그대로 답습한 것이므로, 최소 신규 테스트에서라도 동일 함정을 인지하고 고쳤으면 더 좋았을 것 — 다만 fix 범위가 이 PR 을 넘어 공용 mock 인프라에 걸쳐 있어 별도 후속으로 처리해도 무방.

- **[INFO]** `foldersResponse` mutable 변수 + `afterEach` 리셋 방식은 적절하고 실제로 격리를 보장함
  - 위치: `workflows-page.test.tsx:28-37`(mock 선언), `:500-520`(describe `beforeEach`/`afterEach`)
  - 상세: `vi.mock("@/lib/api/folders")` 가 클로저로 캡처한 `foldersResponse` 를 `beforeEach` 에서 명시적으로 채우고, `afterEach` 에서 `[]` 로 되돌려 다른 describe 로의 leak 을 차단한다. `--sequence.shuffle` 로 실행 순서를 무작위화해도 18/18 통과함을 재확인했다 — 순서 의존성 없음. `vi.clearAllMocks()` 가 `foldersApi.list` 의 호출 카운트만 초기화하고 `foldersResponse` 값 자체는 별도 `let` 이라 영향받지 않는 점도 올바르게 활용됨.

- **[INFO]** 커버리지는 요청된 5개 핵심 시나리오(select 렌더/미렌더, `?folderId` 전달, page 리셋 의도, reset-filters 클리어, 기본 all 미송신)를 모두 포함하며 구조적 누락은 없음
  - 위치: `workflows-page.test.tsx:503-637` 5개 `it` 블록
  - 상세: 폴더 0개 시 `data-testid="workflow-folder-filter"` 미존재, 폴더 존재 시 "All folders" sentinel(빈 value) + 옵션 렌더, 선택 시 `folderId=fld-2` 전달, 기본 선택 시 `folderId` undefined, `hasActiveFilters`→reset 버튼 노출 후 클릭 시 select 값 `""` 로 복귀까지 확인. 다만 위 WARNING 처럼 "page reset" 항목은 실질적으로 검증되지 않는 상태.

- **[INFO]** 기존 sort/ownership describe 의 `listSpy.mock.calls.at(-1)?.[0]` 패턴, `firstCallParams`/`lastParams` 캐스팅, `vi.waitFor` 사용 관례를 정확히 따름
  - 위치: `workflows-page.test.tsx:565-590`(folderId 전달 테스트), `:592-608`(기본 all 미송신 테스트)
  - 상세: sort describe 의 `"resets page to 1 when the sort changes"`, `"omits sort/order params on the default sort"` 와 완전히 동일한 구조(리스트 스파이 획득 → `mockClear()` → 액션 → `waitFor` → `at(-1)` 파라미터 단언)를 재사용해 일관성이 좋다. 가독성 측면에서도 각 테스트가 하나의 관찰 포인트에 집중하고 있어 의도가 명확하다.

- **[INFO]** `FolderData` 타입이 테스트 파일 내부에 로컬 재정의됨(실제 `folders.ts` export 와 별도)
  - 위치: `workflows-page.test.tsx:31` vs `codebase/frontend/src/lib/api/folders.ts:12-17`
  - 상세: 필드가 완전히 동일(`id/name/parentId?/sortOrder`)해 현재는 문제가 없으나, 실제 타입을 import 하지 않고 mock 파일에 복제했기 때문에 향후 `FolderData` 인터페이스가 변경되면(예: 필드 추가/이름 변경) 이 테스트 파일의 로컬 타입은 자동으로 따라가지 않아 타입 드리프트가 생길 수 있다. 다만 vi.mock 팩토리는 호이스팅되어 외부 스코프 참조에 제약이 있는 경우가 많아 의도적 회피일 가능성이 있음 — 사소한 유지보수 리스크로만 기록.

## 요약

폴더 필터 신규 테스트 5종은 렌더/미렌더, 쿼리 파라미터 전달·생략, reset-filters 상호작용 등 요청된 시나리오를 빠짐없이 다루고 있고, `foldersResponse` mutable mock + `afterEach` 리셋을 통한 describe 간 격리도 셔플 실행으로 실증 확인했으며 기존 sort/ownership describe 의 스파이 사용 패턴도 정확히 계승했다. 다만 "폴더 선택 시 page 1로 리셋" 단언은 테스트 하네스의 `useRouter().replace`/`useSearchParams()` mock 이 stateless(no-op)이기 때문에 실제로는 페이지가 2로 바뀐 적이 없는 상태에서 항상 참이 되는 구조적 결함이 있다 — 이는 이 PR 이 새로 만든 문제가 아니라 기존 sort describe 의 동일 테스트에서 이미 존재하던 패턴을 그대로 재사용한 것이며, 회귀를 실제로 잡지 못하는 무의미한(vacuous) 단언이라는 점에서 WARNING 으로 기록한다.

## 위험도

LOW
