# 요구사항(Requirement) 충족 리뷰

대상: 워크스페이스 슬러그 URL 라우팅(`/w/[slug]/...`) PR 중 본 payload 에 포함된 43개 파일
(핵심 구현: `href.ts`/`use-workspace-slug.ts`/`use-workspaces.ts` + cafe24/makeshop pending-polling
hook 배선, docs mdx frontmatter, `spec/**` frontmatter `code:` 경로 미러, 이전 consistency-check
산출물, plan 체크리스트 갱신). 전체 PR 은 28페이지 이동·layout·catch-all 등을 포함하나 그 파일들은
본 payload 밖이라(다른 리뷰 슬라이스로 추정) 스코프에서 제외했다 — 단 `(main)/w/[slug]/layout.tsx`,
`(main)/docs/[...slug]` 존재 여부는 실제 저장소를 직접 확인해 정합성 판단에 참고했다.

## 발견사항

- **[WARNING]** `[SPEC-DRIFT]` `useWorkspaceSlug`/`buildWorkspaceHref`/`(main)/w/[slug]/layout.tsx` 가
  인용하는 `spec/2-navigation/9-user-profile.md §3` 본문이 여전히 "미구현(Planned)" 으로 서술
  - 위치: `codebase/frontend/src/lib/workspace/href.ts` JSDoc("URL 이 활성 워크스페이스의 **FE
    라우팅 SoT** 다 (spec/2-navigation/9-user-profile.md §3)"), `use-workspace-slug.ts` JSDoc(동일
    인용) vs `spec/2-navigation/9-user-profile.md` §3(153~155행): "현재 구현: ... URL 경로는
    워크스페이스에 따라 바뀌지 않는다" / "**미구현 (Planned)**: 전환 시 URL 경로에 워크스페이스
    슬러그 반영 ... 현재 `/w/[slug]` 라우트는 존재하지 않으며 슬러그는 데이터 필드로만 사용된다"
  - 상세: 코드는 이미 `/w/[slug]` 라우트·URL-우선 reconcile 을 구현했고 그 근거로 9-user-profile §3
    을 SoT 로 인용하지만, 정작 그 절 본문은 정반대(미구현·URL 불변)를 서술한다. 이는 실수가 아니라
    `plan/in-progress/workspace-slug-routing.md` 체크리스트 항목 10("spec 반영(planner 위임): ...
    9-user-profile §3 flip ...")이 아직 미체크(`[ ]`)인, **의도된 단계적 워크플로(코드 선행 →
    planner 가 spec flip)** 로 보인다 — CLAUDE.md 의 "developer 는 spec/ read-only, project-planner
    가 spec 갱신" 원칙과도 일치. 다만 이 PR 시점 기준으로 spec 본문과 코드가 line-level 로 정면
    모순되는 상태이므로 SPEC-DRIFT 로 명시 기록한다.
  - 제안: 코드는 유지. `project-planner` 가 `spec/2-navigation/9-user-profile.md` §3(153~155행)을
    "구현 완료 — URL 이 SoT" 로 flip(plan 항목 10 실행). 이미 plan 에 추적되고 있으므로 신규 작업
    아님 — 누락 없이 실제로 수행되는지만 확인.

- **[WARNING]** `[SPEC-DRIFT]` 이동된 페이지들의 spec 본문 bare-path 산문이 frontmatter `code:` 만큼
  갱신되지 않음(일부 표본)
  - 위치: `spec/2-navigation/15-system-status.md` 본문 "경로 `/system-status`."(파일 상단, frontmatter
    바로 아래)는 frontmatter `code:` 가 `(main)/w/[slug]/system-status/page.tsx` 로 갱신됐음에도 여전히
    구 bare path 를 서술. `spec/2-navigation/16-agent-memory.md` 본문("경로 `/agent-memory`.")도 동일
    패턴.
  - 상세: 이 gap 은 본 PR 이전 `review/consistency/2026/07/08/16_58_17/plan_coherence.md` 가 이미
    WARNING 으로 지적("spec 반영 체크리스트가 실제 영향 범위보다 좁음 — `_layout.md`/
    `11-error-empty-states.md`/`13-user-guide.md` 등이 누락")한 것과 동일 계열이며,
    `plan/in-progress/workspace-slug-routing.md` 체크리스트 항목 10 이 이를 "§8 spec 반영... 범위
    확장"으로 흡수하기로 명시했다(93~97행 근처, "`_layout.md §2.2/§3.1` 경로표 ... slug-aware 갱신").
    즉 이미 추적된 잔여 작업 — 새 발견이 아니라 확인용 재기록.
  - 제안: planner 단계에서 frontmatter 뿐 아니라 본문 산문(경로 언급)까지 함께 정정. 코드 변경 불요.

- **[WARNING]** cafe24/makeshop pending-polling hook 테스트가 "슬러그 있음" 분기를 검증하지 않음
  (엣지 케이스 커버리지 갭)
  - 위치: `codebase/frontend/src/lib/integrations/__tests__/use-cafe24-pending-polling.test.tsx`
    ("transitions on connected" 테스트, `mockReplace` 를 `"/integrations/int-1"` bare path 로만 단언)
    · `codebase/frontend/src/lib/integrations/__tests__/use-makeshop-pending-polling.test.tsx`
    (동일 패턴, `"/integrations/int-ms-1"`)
  - 상세: 두 훅 모두 이번 diff 에서 `slug = useWorkspaceSlug()` 를 추가하고
    `router.replace(buildWorkspaceHref(slug, ...))` 로 배선했다. 그러나 두 테스트 파일 모두
    `useWorkspaceStore.setState(...)` 를 호출하지 않아 store 기본값(`workspaces: []`,
    `currentWorkspaceId: null`)이 그대로 유지되고, `useParams` mock 도 `() => ({})` 라 URL 에도 slug
    가 없다 — 따라서 `useWorkspaceSlug()` 는 항상 `null` 을 반환하고 `buildWorkspaceHref` 는 항상
    bare-path fallback 분기만 실행된다. 실제 목적(활성 워크스페이스가 있을 때 `/w/<slug>/...` 로
    라우팅)을 검증하는 케이스가 이 두 훅의 자체 테스트 스위트에는 전혀 없다 — `href.test.ts` /
    `use-workspace-slug.test.tsx` 가 각 부품을 단위로는 검증하지만, 두 훅에서의 **합성**(올바른 인자
    순서로 호출되는지)은 아무 테스트도 실증하지 않는다. 예컨대 인자 순서가
    `buildWorkspaceHref(path, slug)` 로 뒤바뀌는 회귀가 있어도 두 스위트 모두 그대로 통과한다.
  - 제안: 각 테스트 파일에 `useWorkspaceStore.setState({ workspaces: [...], currentWorkspaceId: ...,
    loaded: true })` (슬러그 보유 워크스페이스)로 설정한 케이스를 1개씩 추가해
    `mockReplace` 가 `/w/<slug>/integrations/<id>` 형태로 호출되는지 단언.

- **[INFO]** `use-page-param.test.tsx` 에 추가된 `useParams: () => ({})` mock 이 불필요해 보임
  - 위치: `codebase/frontend/src/lib/hooks/__tests__/use-page-param.test.tsx` diff (4행)
  - 상세: `usePageParam`(`codebase/frontend/src/lib/hooks/use-page-param.ts`)은 `usePathname`/
    `useRouter`/`useSearchParams` 만 사용하고 `useParams`/`useWorkspaceSlug` 를 호출하지 않는다.
    이 mock 추가가 실제로 필요한 이유가 diff·훅 본문 어디에도 없다 — 아마 "next/navigation mock 에
    useParams 를 일괄 추가" 하는 codemod 의 부산물로 보인다. 동작에 영향은 없음(단순 미사용 mock).
  - 제안: 별도 조치 불요(harmless). 정리 차원에서 제거해도 무방.

- **[INFO]** cafe24 pending-polling 훅은 여전히 `encodeURIComponent(integrationId)` 를 적용하지 않음
  (makeshop 훅과 비대칭, 본 PR 이전부터 존재하던 상태 — 회귀 아님)
  - 위치: `codebase/frontend/src/lib/integrations/use-cafe24-pending-polling.ts`
    (`router.replace(buildWorkspaceHref(slug, \`/integrations/${integrationId}\`))`) vs
    `use-makeshop-pending-polling.ts` (`encodeURIComponent(integrationId)` + INFO4 주석)
  - 상세: 이번 diff 의 목적(슬러그 라우팅 배선) 범위 밖이라 이 PR 이 만든 문제는 아니다. 다만 diff 에
    노출된 두 코드가 나란히 보이는 김에 기록 — 두 훅을 동일 패턴으로 맞추는 후속 정리 여지가 있음.
  - 제안: 이번 PR 스코프 아님. 후속 정리 항목으로만 남김.

## 정상 확인된 항목

- `buildWorkspaceHref(slug, path)` — null/undefined slug → bare path 폴백, 선행 슬래시 정규화, 쿼리
  스트링 보존까지 `href.test.ts` 5개 케이스로 1:1 검증됨. 함수 시그니처·동작이 자체 JSDoc 과 정확히
  일치.
- `useWorkspaceSlug()` — "URL 파라미터 우선 → store 활성 워크스페이스 slug 폴백 → 둘 다 없으면 null"
  로직이 `use-workspace-slug.test.tsx` 3개 케이스(URL 우선·store 폴백·완전 부재)로 정확히 검증됨.
- `useWorkspaces()` — `enabled: !!user` 로 미인증 시 fetch 방지, `setWorkspaces` 로 store 동기화,
  `staleTime`/`queryKey` dedup 의도(레이아웃·사이드바·catch-all 공유) 대로 구현.
- `spec/**` frontmatter `code:` 경로 미러(0-dashboard·1-workflow-list·11-error-empty-states·
  14-execution-history·15-system-status·16-agent-memory·2-trigger-list·3-schedule·4-integration·
  5-knowledge-base·6-config·7-statistics·9-user-profile·discord/slack providers·1-auth·15-chat-channel·
  5-admin-console·channel-web-chat _product-overview·spec-impl-evidence·user-guide-evidence·
  data-flow/13-agent-memory) — 전부 실제 저장소의 `(main)/w/[slug]/...` 실존 경로와 일치 확인(직접
  `find` 로 대조). 기계적 path 미러라 기능적 위험 없음.
  - `spec/2-navigation/3-schedule.md`/`4-integration.md` 의 본문 코드 경로 언급(각주·Rationale)도
    frontmatter 와 함께 갱신되어 있어(다른 문서들과 달리) 산문까지 챙긴 사례로 확인됨.
- docs mdx(`system-status.en.mdx`/`system-status.mdx`) — frontmatter `code:` 만 변경, 본문 내용 무변경
  (콘텐츠 자체가 slug 라우팅과 무관하므로 타당).
- `naming_collision.md` 가 지적한 `/docs` `[...slug]` vs 워크스페이스 `[slug]` 충돌 — 실제로는 plan
  이 "docs 는 phase 1 slug 밖 유지" 로 스코프 결정해 해소됨을 직접 확인(`(main)/docs/[...slug]` 가
  `(main)/w/[slug]/docs/...` 로 이동하지 않고 그대로 존재 — nesting 자체가 없어 파라미터 충돌 발생
  안 함). plan 파일(파일 13) 의 "docs 는 phase 1 slug 밖 (결정 — Critical 해소)" 절과 일치.
- TODO/FIXME/HACK/XXX 주석: 본 payload 의 실 코드 변경분 어디에도 없음.
- 모든 코드 경로에서 반환값 정의(`buildWorkspaceHref`→string, `useWorkspaceSlug`→string|null,
  `useWorkspaces`→UseQueryResult)가 분기 누락 없이 일관됨.

## 요약

핵심 구현(`buildWorkspaceHref`/`useWorkspaceSlug`/`useWorkspaces`)은 명세된 동작(URL 우선·null-safe
폴백·query 보존)을 정확히 구현하고 자체 단위테스트로 충분히 커버한다. spec 프런트매터 `code:` 경로
미러는 전량 실제 파일 위치와 일치해 기계적 정합성에 문제가 없다. 다만 두 갈래 잔여 리스크가 있다 —
(1) `9-user-profile.md §3` 등 spec 본문 산문이 아직 "미구현" 을 서술해 코드와 정면 모순되는
SPEC-DRIFT 상태이나, 이는 plan 이 이미 인지·추적 중인 다음 단계(planner spec flip, 체크리스트 항목
10)이므로 코드 문제가 아니다; (2) cafe24/makeshop pending-polling 훅에 새로 배선된
`useWorkspaceSlug`→`buildWorkspaceHref` 합성 경로 자체("슬러그가 있을 때 실제로 `/w/<slug>/...` 로
리다이렉트하는지")를 검증하는 테스트가 두 훅의 자체 스위트 어디에도 없어(둘 다 우연히 fallback
분기만 실행), 향후 인자 순서 실수 같은 회귀를 이 스위트들이 잡지 못한다. CRITICAL 급 기능 결손은
발견되지 않았다.

## 위험도

LOW
