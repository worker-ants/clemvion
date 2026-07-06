# 테스트 리뷰 (Fresh, resolution 후 재검토) — 워크플로우 목록 폴더 필터

대상: `.claude/worktrees/fe2-workflow-list-filters-08493f`, `git diff origin/main...HEAD` (2 commits: 6279d01b6, 2a859be6d)
핵심 파일: `codebase/frontend/src/app/(main)/workflows/__tests__/workflows-page.test.tsx`
직전 리뷰: `review/code/2026/07/06/10_32_44/testing.md` (W2 — page-reset 단언 vacuous)

## 검증 방법

1. `codebase/frontend` 에서 `../../node_modules/.bin/vitest run "src/app/(main)/workflows/__tests__/workflows-page.test.tsx"` 실행 — **19 passed** 확인 (일반 순서 1회, `--sequence.shuffle` 3회 반복 모두 19/19 통과, describe 간 leak 없음).
2. `page.tsx` 의 `useWorkspaceStore.subscribe` 콜백에서 `setFolderId("");` 를 실제로 삭제하고 재실행 → **`clears the selected folder when the workspace is switched` 단 하나만 실패**(`expected 'fld-2' to be ''`), 나머지 18개는 그대로 통과. 원본 복원 후 19/19 재확인.
3. 폴더 select `onChange` 핸들러의 `setPage(1);` 를 실제로 삭제하고 재실행 → **19/19 그대로 통과**(회귀 미포착). 원본 복원 후 19/19 재확인.
4. 두 실험 모두 `cp`/`python3` 치환 → 테스트 재실행 → 원본 파일 복원 순으로 진행, 최종 `git status --short` 로 워킹트리가 clean(신규 review 디렉토리 외 변경 없음) 임을 확인.

## 발견사항

- **[INFO]** "clears the selected folder when the workspace is switched" 테스트는 비-vacuous 임을 실증 확인
  - 위치: `workflows-page.test.tsx:633-671`, 대응 구현 `page.tsx:105-112` (`setFolderId("")` in subscribe 콜백)
  - 상세: `setFolderId("")` 를 콜백에서 제거한 변형 코드로 재실행한 결과 이 테스트만 정확히 실패했다(`AssertionError: expected 'fld-2' to be ''`). 나머지 18개 테스트는 이 변형과 무관하게 그대로 통과해, 테스트 격리도 문제없음을 함께 확인했다. RESOLUTION.md 의 "setFolderId 제거 시 fail = 비-vacuous" 주장은 사실과 일치한다.

- **[INFO]** "sends ?folderId=<id> on the first page when a folder is selected" 재작성은 folderId 단언 기준으로 정직해졌으나, page="1" 단언은 여전히 vacuous — 다만 이번엔 주석으로 정직하게 고지됨
  - 위치: `workflows-page.test.tsx:555-581`
  - 상세: 테스트명에서 오해를 부르던 "페이지 2 이동 후 리셋" 시나리오가 제거되고, 이제 `folderId=fld-2` 전달이 핵심 단언으로 명확히 분리됐다 — 이 부분은 `setFolderId` 관련 로직과 별개로 실제 폴더 선택 시 API 호출 파라미터를 검증하는 진짜 단언이다. 다만 `expect(String(lastParams?.page)).toBe("1")` 은 실험적으로 `onChange` 핸들러의 `setPage(1);` 호출을 제거해도 여전히 통과함을 확인했다 — `usePageParam`/`useSearchParams` mock 이 stateless 라 페이지 값이 애초에 항상 `"1"` 로 시작하기 때문(직전 리뷰 W2 가 지적한 것과 동일한 근본 원인, 이번엔 삭제되지 않고 형태만 남음). 테스트 코드 자체가 주석(`:577-580`)으로 "이 mock 은 static 이라 2→1 실제 전환은 검증 못 하고 emitted page param 만 확인한다"고 명시적으로 인정하고 있어, 리뷰 관점에서 오도(misleading)의 문제는 해소됐다고 판단한다 — 다만 이 단언 자체가 회귀 방지력을 갖는 것은 아니므로 "회귀 잡는 테스트"로 오인되지 않도록 계속 유의할 필요가 있다. RESOLUTION 도 이를 "setPage(1) 배선을 문서화하는 보조 단언"으로 정확히 스코프를 낮춰 기술했다 — 과대 주장 없음.
  - 결론: 직전 WARNING 이 지적한 "오해 유발"(vacuous 단언을 회귀 방지 단언처럼 서술) 문제는 해소됐다. 근본 원인(mock 이 stateless)은 여전히 남아있지만 이는 이 PR 범위를 넘는 공용 인프라 이슈로, RESOLUTION 이 명시한 대로 후속으로 분류하는 것이 합리적이다.

- **[INFO]** `foldersResponse` mutable mock 의 describe 간 leak 방지는 fresh 재검증에서도 충분함
  - 위치: `workflows-page.test.tsx:34-39`(mock 선언), `:499-521`(describe `beforeEach`/`afterEach`)
  - 상세: `--sequence.shuffle` 3회 반복 모두 19/19 통과. `afterEach` 의 `setFoldersResponse([])` 리셋이 다른 describe(pagination/ownership/search-filter/sort) 로의 폴더-필터 UI 노출 leak 을 실행 순서 무관하게 차단하고 있음을 재확인했다.

- **[INFO]** 신규 워크스페이스 전환 테스트의 `act()` 사용은 적절
  - 위치: `workflows-page.test.tsx:661-663`
  - 상세: `useWorkspaceStore.setState({ currentWorkspaceId: "ws-2" })` 를 `act(async () => {...})` 로 감싸 subscribe 콜백에 의한 state 업데이트를 React 테스트 규약에 맞게 처리하고 있다. (실험적으로 `setFolderId` 를 제거했을 때만 "not wrapped in act" 콘솔 경고가 발생했는데, 이는 비동기 setState 가 아예 발생하지 않아 act 경계 밖에서 다른 미해결 업데이트가 새어나온 부수효과로 보이며 정상 코드에서는 경고가 없다 — 실험 중에만 관찰된 현상으로 정상 동작에는 영향 없음.)

- **[INFO]** 커버리지: 새 커밋에서 추가된 워크스페이스 스코프 갭(2a859be6d) 에 대한 테스트가 정확히 대응
  - 위치: `page.tsx` 의 `foldersQuery` key `["folders", currentWorkspaceId]` 변경과 `folders.ts` API 레이어 변경(미확인 부분 추가 확인 완료 — `foldersApi.list()` 시그니처 자체는 인자를 받지 않으므로 워크스페이스 스코프는 서버 세션/헤더에 의존하는 기존 계약을 그대로 따름) 에 대해, 프런트 쪽 refetch-on-switch 동작은 query key 변경만으로 충분히 커버되며, 이 부분을 직접 검증하는 별도 테스트는 없으나 react-query 표준 동작(key 변경 시 refetch)이라 리스크가 낮아 생략이 합리적이다.

## 요약

두 가지 핵심 검증 질문 모두 명확한 결론을 얻었다. (1) 재작성된 "sends ?folderId=<id> on the first page..." 테스트는 folderId 단언 기준으로 정직하며, 오해를 유발하던 이전 "페이지 2 이동" 서술은 제거됐다 — 남은 page="1" 단언은 실험으로 여전히 vacuous 함을 확인했으나 테스트 스스로 그 한계를 주석으로 명시하고 있어 더 이상 오도하지 않는다. (2) 신규 "clears the selected folder when the workspace is switched" 테스트는 실제로 `setFolderId("")` 를 구현에서 제거하는 실험을 통해 비-vacuous 임을 실증했다 — 이 테스트를 제거된 코드로 돌리면 정확히 그 테스트 하나만 실패하고 나머지 18개는 영향받지 않아 격리도 양호하다. `foldersResponse` mutable mock 의 describe 간 leak 방지도 shuffle 3회 반복으로 재확인했다. 직전 리뷰의 WARNING(W2)은 완전히 근본 해결된 것은 아니지만(공용 mock 인프라 이슈는 의도적으로 범위 밖으로 남김), 오해를 유발하던 테스트명/서술 문제는 해소되어 리뷰 관점에서 수용 가능한 수준이다. 결함(Critical/Warning) 없음.

## 위험도

NONE
