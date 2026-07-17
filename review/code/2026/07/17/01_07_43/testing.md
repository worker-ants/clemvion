# 테스트(Testing) 리뷰

대상: `/docs` 슬러그 무한 중첩 라우팅 버그 fix — e2e/unit 테스트 5개 파일 + 구현 3개 파일.

## 발견사항

- **[WARNING]** e2e "stale URL terminates on 404" 테스트가 실제 404 렌더링을 검증하지 않음
  - 위치: `codebase/frontend/e2e/workspaces/slug-routing.spec.ts` — `test("stale /w/<slug>/docs URL terminates on 404 instead of nesting forever", ...)` (라인 93-106)
  - 상세: 테스트 제목과 주석은 "404 로 종결"을 주장하지만 실제 assertion 은 `pathname` 이 늘어나지 않았다는 것(`toBe`, 세그먼트 개수)만 확인한다. `notFound()` 가 호출되어 실제로 `(main)/not-found.tsx` 바운더리가 렌더되어 사용자에게 404 콘텐츠가 보이는지는 검증하지 않는다. 만약 `notFound()` 가 아닌 다른 이유(예: 무한 루프가 아닌 조용한 blank 렌더)로 URL 이 고정되어도 이 테스트는 통과한다 — 회귀 가드로서의 정밀도가 제목보다 약하다.
  - 제안: `await expect(page.getByRole("heading", { name: /not.?found|404/i })).toBeVisible()` 류의 어써션을 추가해 실제 not-found UI 노출까지 증명. 최소한 `(main)/not-found.tsx` 가 렌더하는 대표 텍스트/role 을 확인.

- **[WARNING]** `sidebar-nav-href.test.tsx` 의 대규모 mock 보일러플레이트가 기존 `sidebar.test.tsx` 와 중복될 가능성
  - 위치: `codebase/frontend/src/components/layout/__tests__/sidebar-nav-href.test.tsx` 전체 (177 라인 중 대부분이 `vi.mock` 블록)
  - 상세: 파일 자체 주석이 "기존 `sidebar.test.tsx` 는 slug=null 이라 이 결함을 재현 못해 별도 파일로 세운다"고 명시한다. 즉 두 테스트 파일이 `next/navigation`·`next/link`·다수 store·`apiClient` 등 동일한 mock 세트를 각각 유지할 개연성이 높다. Sidebar 의 의존성(예: 새 store 훅 추가)이 바뀌면 두 파일을 동시에 고쳐야 하는 유지보수 부담이 생긴다.
  - 제안: 공용 `sidebar-test-utils.ts`(mock 팩토리 + `renderSidebar`)로 두 파일이 공유하는 구조로 리팩터링 권장. 이번 PR 을 막을 정도는 아니나 후속 정리 대상으로 표시할 가치가 있음.

- **[INFO]** `navItems.workspaceScoped` 불변식을 검증하기 위해 무거운 컴포넌트 렌더가 필요
  - 위치: `codebase/frontend/src/components/layout/sidebar.tsx` (라인 1449-1523, `navItems` 배열), `sidebar-nav-href.test.tsx`
  - 상세: `workspaceScoped` 는 순수 정적 데이터인데, 이를 검증하려면 `matchMedia`/`next/link`/`next/navigation`/5개 store/`react-query` 를 모두 mock 하고 실제 DOM 을 렌더해야 한다. `navItems`(또는 `docs` 항목의 `workspaceScoped` 값만이라도)를 export 하면 mock 없이 `expect(navItems.find(i => i.href === "/docs")?.workspaceScoped).toBe(false)` 같은 가벼운 순수 유닛 테스트로 핵심 불변식을 훨씬 저비용으로 고정할 수 있다. 현재 방식이 틀린 것은 아니지만(실제 렌더까지 검증하므로 오히려 더 강함), 유닛 테스트 용이성 관점에서 데이터 자체를 테스트 가능한 형태로 노출하는 대안도 고려할 만하다.

- **[INFO]** `sidebar-nav-href.test.tsx` 가 12개 `workspaceScoped:true` 항목 중 3개만 개별 스팟체크
  - 위치: `sidebar-nav-href.test.tsx` — `"워크스페이스 스코프 항목에는 활성 slug 를 붙인다"` 테스트 (dashboard/workflows/agentMemory 만 확인)
  - 상세: 나머지 9개 스코프 항목(`triggers`/`schedule`/`web-chat`/`integrations`/`knowledge-bases`/`models`/`authentication`/`statistics`/`system-status`)은 개별 검증되지 않는다. 다만 별도 테스트("어떤 nav 링크도 `/w/<slug>/docs` 형태를 만들지 않는다")가 렌더된 모든 `nav a` 의 href 를 순회하는 blanket 정규식 검증을 수행하므로, "docs 만 예외" 라는 핵심 회귀는 포괄적으로 커버된다. 개별 스팟체크가 3개뿐이라는 점만 참고 사항으로 남긴다.
  - 제안(선택): `document.querySelectorAll("nav a")` 순회 검증을 "모든 workspaceScoped 항목이 `/w/<slug>` 로 시작"까지 확장하면 spot-check 없이도 완전성 확보 가능.

- **[INFO]** 유닛 테스트의 `notFound()` mock 은 실제 Next 동작(digest 기반 special error)의 근사치이며, 이는 테스트 코드 자체 주석에 명확히 인지·기록되어 있고 e2e 로 실제 계층을 보강함
  - 위치: `codebase/frontend/src/app/(main)/__tests__/workspace-redirect.test.tsx` 상단 주석 (546-550라인) + `slug-routing.spec.ts` 신규 describe 블록 주석
  - 상세: 이는 결함이 아니라 모범 사례로 언급한다 — mock 의 한계를 정직하게 문서화하고, 실제 Next 라우트 매칭·`notFound()` 실동작이 필요한 부분은 브라우저 레벨 e2e 로 명시적으로 위임했다(`/docs` describe 블록 주석 "유닛 테스트는 useParams 를 mock 하므로 실제 Next 라우트 매칭과 notFound() 실동작을 증명하지 못한다"). 두 계층의 책임 분담이 테스트 설계상 우수한 패턴.

- **[INFO]** `renderSidebar()` 의 react-query 비동기 정착(settle) 시점을 명시적으로 기다리지 않음
  - 위치: `sidebar-nav-href.test.tsx` — `renderSidebar()` 헬퍼 (`await act(async () => { render(...) })`)
  - 상세: `unreadQuery`/`notifListQuery` 는 `apiClient.get` mock 이 resolve 된 뒤 상태 갱신이 일어나는데, 단일 `act` 틱 안에서 그 갱신이 완전히 정착한다는 보장이 없다. 현재 테스트들은 알림 카운트/목록을 단정하지 않아 실패로 이어지지는 않지만, 향후 act() 경고나 unmount 후 상태 갱신 경합의 잠재적 근원이 될 수 있다. 기존 `sidebar.test.tsx` 에서도 동일 패턴을 사용 중일 가능성이 높아(본 PR 이 그 패턴을 답습) 신규 결함은 아님.

## 회귀 테스트 검증

- `workspace-redirect.test.tsx` 의 기존 `"WorkspaceRedirect (catch-all)"` describe 블록(bare path, notification deep-link, invitations, 빈 rest, not-loaded) 은 전부 `rest[0] !== "w"` 케이스라 신규 `workspacePrefixed` 분기에 진입하지 않는다 — 회귀 위험 없음을 신규 `"'w' 로 시작하는 일반 경로(/web-chat)는 영향받지 않는다"` 테스트가 명시적으로 별도 확인한다. 좋은 패턴.
- `sidebar.tsx` 의 `slug=null`(미해소 워크스페이스) 케이스에서는 `workspaceScoped` 분기와 무관하게 `buildWorkspaceHref(null, href)` 와 `item.href` 가 동일한 bare 경로를 반환하므로, 기존 `sidebar.test.tsx`(본 diff 밖) 의 slug=null 어써션들은 그대로 유효할 것으로 판단된다(직접 실행 확인은 아님, 코드 추론).

## 엣지 케이스 커버리지 (양호)

`workspace-redirect.test.tsx` 신규 describe 는 `/w` 단독(1세그먼트), `/w/<slug>`(2세그먼트, dashboard forward), `/w/<slug>/docs`(3세그먼트, notFound), 이중 중첩(5세그먼트, notFound), store 미로드 상태에서의 root forward, query/hash 보존, prefix 오탐(`web-chat`) 까지 경계값을 폭넓게 다룬다. e2e 쪽도 사이드바 링크 자체·클릭 흐름·stale 북마크·워크스페이스 루트를 모두 커버해 유닛+e2e 이중 계층으로 실제 사용자 보고 시나리오를 재현·고정한다.

## 요약

이번 변경은 실제 브라우저 라우트 매칭이 필요한 버그(무한 슬러그 중첩)에 대해 유닛 테스트의 한계(`useParams` mock)를 스스로 인지하고 e2e 로 보강하는 이중 계층 테스트 전략을 취했으며, 엣지 케이스(단독 `/w`, 이중 중첩, prefix 오탐, query/hash 보존, store 미로드)를 폭넓게 커버해 테스트 설계 성숙도가 높다. 다만 stale URL e2e 테스트가 "404 종결"이라는 제목에 비해 실제 not-found UI 노출을 검증하지 않는 점, 그리고 신규 `sidebar-nav-href.test.tsx` 가 기존 sidebar 테스트와 상당한 mock 보일러플레이트를 중복 보유해 유지보수 부담을 늘릴 소지가 있는 점은 개선 여지가 있다. 두 사항 모두 병합을 막을 수준은 아니다.

## 위험도

LOW
