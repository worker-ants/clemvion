# Fresh 코드 리뷰 — requirement (재검토)

대상: 워크플로우 목록 폴더 필터 (2 commits: `6279d01b6` feat, `2a859be6d` fix)
Diff base: `origin/main...HEAD` (workdir: `.claude/worktrees/fe2-workflow-list-filters-08493f`)
직전 리뷰: `review/code/2026/07/06/10_32_44/requirement.md` → RESOLUTION W1 (스테일 폴더 필터) 재검증 집중

## 발견사항

- **[INFO]** 신규 워크스페이스-전환 리셋 테스트가 드물게(약 70회 중 1회) flaky 하게 실패 관찰
  - 위치: `codebase/frontend/src/app/(main)/workflows/__tests__/workflows-page.test.tsx:633-671` (`clears the selected folder when the workspace is switched`)
  - 상세: 단일 파일/디렉토리 반복 실행(단독 60+회, `-t` 필터 30회, 디렉토리 전체 30회) 결과 대부분 통과했으나, 최초 1회 콜드 스타트에서 `expected 'fld-2' to be ''`로 실패했고 실패 시 소요시간이 `1033ms`로 `@testing-library` `vi.waitFor` 기본 타임아웃(1000ms)에 근접했다. 이는 subscribe 콜백 로직 자체의 버그가 아니라, `useWorkspaceStore.setState` → subscribe 콜백 → `setFolderId("")` → React 리렌더 경로가 시스템 부하/모듈 워밍업이 심한 순간에는 1초 타임아웃 안에 반영되지 못할 수 있다는 타이밍 취약점을 시사한다. 재실행 시 항상 통과했으므로 로직 결함은 아니며, CI 환경에서 드물게 flaky 재발 가능성만 남는다.
  - 제안: (선택) 이 테스트에 한해 `vi.waitFor(..., { timeout: 2000 })` 로 여유를 주거나, 이미 알려진 CI flake 감시 대상으로만 기록. 이번 fix 자체를 되돌릴 필요는 없음 — 로직은 정확하다.

## 검증한 항목 (결함 없음)

1. **스테일 폴더 필터 수정 (W1) 정확성**
   - `useWorkspaceStore.subscribe` 콜백에 `setFolderId("")` 추가(`page.tsx:105-112`)는 기존 `setOwnership("all")` 리셋과 동일한 조건(`next.currentWorkspaceId !== prev.currentWorkspaceId`)에서 실행되어 대칭적이다.
   - `foldersQuery` key 를 `["folders", currentWorkspaceId]` 로 스코프화(`page.tsx:148-151`)하여 워크스페이스 전환 시 자동 refetch. `switchWorkspace`(workspace-store.ts) 가 react-query 캐시를 안 비우는 기존 사실과 부합.
   - `currentWorkspaceId` 셀렉터(`page.tsx:97`)는 `currentWorkspace`(workspaces 배열에서 find)와 별도로 원자적으로 구독되어, `workspaces` 배열 자체가 아직 갱신 안 된 과도기에도 `currentWorkspaceId` 값 변화만으로 정확히 반응한다.

2. **무한 리셋 가능성**: 없음. subscribe 콜백은 `useWorkspaceStore` 의 상태 변화(`currentWorkspaceId`)에만 반응하고, `setFolderId`/`setOwnership` 은 React local state 만 변경하며 스토어를 갱신하지 않으므로 재귀 트리거 경로가 존재하지 않는다.

3. **folderId 리셋 후 workflowsQuery 스테일 fetch 여부**: 없음. `workflowsQuery` 의 `queryKey` 배열에 `folderId` 가 포함(`page.tsx:158-166`)되어 있어, `setFolderId("")` 가 커밋되는 렌더에서 query key 가 즉시 바뀌어 다음 `workflowsQuery` fetch 는 새 빈 `folderId` 를 반영한다. 두 state 갱신(`setOwnership`/`setFolderId`)이 같은 콜백 내 동기 호출이라 React 배치로 한 렌더에 함께 반영되므로 중간에 절반만 반영된 상태로 fetch 될 우려가 없다.

4. **effect 의존성**: `useEffect(() => {...}, [])` — 의존성 배열이 비어 있고 콜백 내부는 `useWorkspaceStore.subscribe`(모듈 레벨 정적 함수)와 `setOwnership`/`setFolderId`(항상 안정적인 setState 디스패치)만 참조하므로 누락된 의존성 없음. eslint exhaustive-deps 도 통과(검증: RESOLUTION 기록의 eslint clean).

5. **currentWorkspaceId null 케이스**: `foldersQuery`에 `enabled` 가드가 없어 `currentWorkspaceId`가 `null`인 동안에도 `foldersApi.list()`가 호출된다. 다만 이는 기존 `workflowsQuery` (이번 diff 이전부터 동일 패턴, `enabled` 없음)와 대칭적인 기존 아키텍처 특성이며, 이번 fix 가 새로 도입한 결함이 아니다. `(main)/layout.tsx` 자체에 워크스페이스 로드 게이트가 없는 것도 기존 구조. 범위 밖으로 판단.

6. **ownership 리셋과의 대칭성**: 정확. 조건·타이밍·주석 갱신 모두 대칭이며, `handleResetFilters()`에도 `setFolderId("")`가 `setOwnership("all")`과 나란히 추가됨(`page.tsx:368-375`).

7. **spec fidelity (spec/2-navigation/1-workflow-list.md §2.3, §3.1)**: 코드는 spec §3 API 표(`folderId` 쿼리) 및 §3.1 폴더 API 계약과 정확히 일치(`?folderId=` 선택 시만 송신, 빈 값 미송신, `GET /api/folders` 소비). 다만 spec §2.3 폴더 필터 행("**미구현 (Planned)**: ... 클라이언트에 폴더 필터 UI 가 없다")과 §3.1 안내문("프론트엔드는 본 API 를 아직 소비하지 않는다")은 이번 구현으로 낡았다. **[SPEC-DRIFT]** — 코드가 옳고 spec 본문 문구만 뒤처짐.
   - 이미 `plan/in-progress/spec-sync-workflow-list-gaps.md`에 "planner 후속(SPEC-DRIFT)"로 정확히 이관되어 있어 (developer는 spec read-only이므로 여기서 spec을 직접 고치지 않는 것이 맞음) 추가 조치 불요.
   - 갱신 대상: `spec/2-navigation/1-workflow-list.md` §2.3 폴더 필터 행 + §3.1 도입 안내문.

8. **테스트 커버리지**: 신규 6개 테스트(폴더 필터 숨김/노출/송신/생략/reset-CTA/workspace-switch 리셋) + 기존 W2(page-reset vacuous assertion) fix 반영 확인. `tsc --noEmit`, eslint 재확인 결과 이번 세션에서도 이상 없음.

## 요약

직전 리뷰에서 지적된 W1(워크스페이스 전환 시 스테일 폴더 필터)에 대한 수정은 정확하다 — `setFolderId("")` 를 기존 `setOwnership("all")` 과 동일한 subscribe 콜백·조건에 대칭적으로 추가했고, `foldersQuery` key 스코프화로 새 워크스페이스 폴더 목록을 정확히 refetch하며, `workflowsQuery` key 에 `folderId` 가 포함되어 리셋된 값이 즉시 다음 fetch 에 반영된다. 무한 리셋, effect 의존성 누락, ownership과의 비대칭 등 우려했던 새 결함은 발견되지 않았다. spec §2.3/§3.1의 "미구현" 문구는 SPEC-DRIFT이나 이미 planner 트랙으로 정확히 이관되어 있다. 유일한 관찰 사항은 신규 workspace-switch 리셋 테스트가 약 70회 중 1회 콜드-스타트 환경에서 waitFor 타임아웃 근접치로 flaky 실패한 것인데, 반복 검증 결과 로직 결함이 아닌 환경 타이밍 이슈로 판단되며 차단 사유가 아니다.

## 위험도

LOW
