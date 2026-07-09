# 테스트(Testing) 리뷰

대상 커밋: `4647d3486f254f90cdaf86130e8801f6a46dc9b3` — 직전 리뷰(10:51:47) SUMMARY 의 Warning 3건(W1/W2/W3)에 대한 조치. dashboard row-click 신규 테스트 파일 1개 + 기존 3개 파일에 slug-aware 회귀 테스트/self-test 추가. 로직 변경은 `href.ts` JSDoc 정정뿐(순수 문서, 동작 불변).

## 검증한 것

- `buildExecutionHref`/`buildWorkspaceHref` 를 실제 소비하는 3개 페이지(`dashboard/page.tsx`, `executions/page.tsx`, `executions/[executionId]/page.tsx`)에서 grep 으로 실제 wiring 을 확인 — 새 테스트가 단언하는 slug-prefixed 경로가 실제 구현과 일치함(테스트가 tautological 하지 않고 진짜 회귀 가드로 기능함).
- `useWorkspaceSlug` 훅은 URL param(`useParams().slug`, SoT) → store 파생값 순으로 폴백하며, URL-param 우선순위 자체는 별도 파일 `use-workspace-slug.test.tsx` 에서 이미 커버됨을 확인. 이번 커밋의 페이지 레벨 테스트는 `useParams: () => ({})` 로 고정해 store-파생 분기만 exercising — 책임 분리가 적절하다(훅의 URL-vs-store 우선순위는 훅 단위테스트가, 페이지의 "row-click → buildExecutionHref 배선"은 페이지 테스트가 각각 담당).
- `useWorkspaceStore` 의 상태 필드는 `workspaces`/`currentWorkspaceId`/`loaded` 3개뿐(액션 함수 제외)이라, 각 테스트의 `setState({...})` 전체 재설정이 실제로 완전한 격리를 보장함(partial merge 누수 없음). `loaded` 필드는 `[slug]/layout.tsx` 에서만 소비되고 이번에 렌더링하는 page 컴포넌트 자체엔 영향 없음 — 회귀 위험 없음.
- vitest 설정(`globals: true`)으로 RTL auto-cleanup 이 전역 등록되어 테스트 간 DOM 잔존 문제 없음(사전 인프라, 이번 diff 무관).

## 발견사항

- **[INFO]** execution-detail prev/next 테스트에 경계값(첫/마지막 실행) 미검증
  - 위치: `codebase/frontend/src/app/(main)/w/[slug]/workflows/[id]/executions/__tests__/execution-detail-page.test.tsx` 신규 `describe("ExecutionDetailPage - prev/next navigation (slug-aware)")`
  - 상세: 이 describe 는 파일 내 prev/next 버튼에 대한 **최초** 테스트다(기존엔 prev/next 클릭 테스트 자체가 전무했음, slug 유무와 무관). 이번에 추가된 두 케이스는 모두 "인접 실행이 존재해 버튼이 enabled" 인 성공 경로만 다루고, `disabled={!adjacentQuery.data?.prev}` / `!adjacentQuery.data?.next}` 가 실제로 경계(가장 오래된 항목에서 Prev disabled, 가장 최신 항목에서 Next disabled)에서 true 가 되는지는 어느 테스트도 단언하지 않는다.
  - 제안: `it.each` 로 3-item 리스트에서 첫 번째/마지막 항목을 열었을 때 각각 Prev/Next 가 `toBeDisabled()` 인 케이스를 추가하면 이번에 새로 확보된 prev/next 커버리지가 더 견고해진다. 이번 커밋 스코프(W2 slug 회귀)를 넘어서는 항목이라 blocking 은 아님.

- **[INFO]** dashboard 회귀 테스트에 dangling `currentWorkspaceId` 케이스 부재
  - 위치: `codebase/frontend/src/app/(main)/w/[slug]/dashboard/__tests__/dashboard-page.test.tsx`
  - 상세: `useWorkspaceSlug` 의 store-폴백 분기는 `s.workspaces.find(w => w.id === s.currentWorkspaceId)` 로 조회하는데, `currentWorkspaceId` 가 목록에 없는 항목을 가리키는 상태(전환 도중 stale 참조 등)는 dashboard/list/detail 테스트 어디에도 없다. 다만 이 경우 결과적으로 `null` 이 되어 기존 "no active workspace" 케이스와 동일한 bare-path 분기를 타므로 실질적 위험은 낮다.
  - 제안: 선택적 하드닝. 현 상태로도 동작상 문제는 없음(no fallback 케이스가 사실상 이 케이스를 대신 커버).

- **[INFO]** `no-raw-execution-href` self-test 가 명시한 known blind spot(문자열 연결 `"..." + id + "..."`)
  - 위치: `codebase/frontend/src/lib/workspace/__tests__/no-raw-execution-href.test.ts` — `"문자열 연결(알려진 미탐지)"` 케이스
  - 상세: 테스트 자체는 올바르게 이 한계를 고정(pin)해 회귀 시 드러나게 했으므로 테스트 품질 문제는 아니다. 다만 근본 가드(정규식 소스텍스트 스캔)는 여전히 문자열 연결 형태의 향후 회귀를 잡지 못한다는 잔여 리스크를 명시적으로 남긴다 — 실제 코드베이스에 그런 패턴이 없는지 별도 확인(grep) 정도는 향후 참고.

## 관점별 평가

1. **테스트 존재 여부**: W2/W3 대상 3개 사이트(dashboard row-click, executions 목록 row-click, 실행상세 prev/next) 전부 slug-present 테스트가 신설/병기됨. 기존 vacuous(slug=null 폴백) 케이스 보존 + slug-존재 케이스 병기 방식이 적절 — 회귀 시나리오(PR #865: slug 를 빠뜨린 bare-push)를 정확히 재현.
2. **커버리지 갭**: 위 INFO 2건(prev/next 경계값, dangling workspace id) 외 뚜렷한 갭 없음. 순수 함수 레벨(`buildExecutionHref`/`buildWorkspaceHref`) 은 기존 `href.test.ts` 가 null/undefined/open-redirect 케이스까지 이미 폭넓게 커버 — 이번 페이지 레벨 테스트와 역할 중복 없이 상호 보완.
3. **엣지 케이스**: slug 존재/부재 양쪽 병기, guard self-test 의 true/false positive 양쪽 병기 — 이 커밋이 다루는 범위 안에서는 충실. 경계값(prev/next disabled)은 이번 스코프 밖으로 남음(INFO).
4. **Mock 적절성**: `next/navigation` 만 얕게 mock 하고 `useWorkspaceStore`/`useLocaleStore` 는 실제 Zustand 스토어를 `setState` 로 시딩 — selector 로직(`find`, `??`)까지 실제로 exercise 되어 mock 과 실제 동작의 괴리가 적다. API 클라이언트 mock 도 페이지가 실제 호출하는 메서드만 정확히 스텁.
5. **테스트 격리**: 신규/변경 파일 모두 `beforeEach` 에서 `vi.clearAllMocks()` + store 전체 재설정 — 순서 무관 독립 실행 가능. 특히 execution-list-page 는 이전 세션에서 지적된 "케이스 간 slug 상태 누수" 문제를 top-level `beforeEach` 에 워크스페이스 리셋을 추가해 구조적으로 해소.
6. **가독성**: 각 신규 테스트에 PR #865 배경과 "왜 이 케이스가 없으면 회귀가 조용히 통과하는지" 를 설명하는 한글 주석이 붙어 의도가 명확. self-test 의 known-limitation 주석도 우수한 사례.
7. **회귀 테스트**: 실제 페이지 구현(grep 확인)과 대조해 tautological 하지 않은 진짜 회귀 가드로 기능함을 확인. 기존 테스트(슬러그=null 폴백, 기타 라우팅 단언)는 그대로 유지되어 무효화되지 않음.
8. **테스트 용이성**: `useWorkspaceSlug` 훅 분리(URL-param vs store 우선순위)와 `buildExecutionHref`/`buildWorkspaceHref` 순수 함수 분리 덕에 페이지 테스트는 wiring 만, 훅/헬퍼 테스트는 각자의 로직만 검증하는 구조 — 관심사 분리가 잘 되어 있어 테스트 작성이 용이했음이 이번 diff 에서도 드러남.

## 요약

이번 커밋은 순수 테스트 보강 커밋으로, 직전 리뷰의 Warning 3건을 스코프에 맞게 정확히 조치했다. 신규 slug 회귀 테스트들은 실제 페이지 구현과 대조 검증한 결과 tautological 하지 않은 유효한 회귀 가드이며, 기존 vacuous 케이스와 병기해 회귀 방지 폭을 넓혔다. `no-raw-execution-href` self-test 는 정규식 가드 자체의 fail-open 위험(위반 없음=우연)을 정확히 겨냥해 true/false positive 를 고정했고, 알려진 탐지 한계(문자열 연결)도 투명하게 문서화했다. store/hook 실사용 + 관심사 분리 덕분에 mock 괴리·격리 문제가 없다. 남은 갭(prev/next 경계 disabled 상태, dangling workspace-id)은 이번 커밋 스코프 밖의 선택적 하드닝 수준으로 INFO 등급이며 블로킹 사유가 아니다.

## 위험도

LOW
