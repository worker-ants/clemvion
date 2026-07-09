# 아키텍처(Architecture) Review — 워크스페이스 슬러그 라우팅 phase 2 (에디터 slug화)

### 발견사항

- **[WARNING]** 게이트 동작 로직이 공용 컴포넌트로 추출됐음에도, 정작 그 컴포넌트 자체를 겨냥한 단위 테스트가 없고 동일 행위 테스트가 두 소비처에 복붙돼 있다
  - 위치: `codebase/frontend/src/app/(main)/w/[slug]/__tests__/layout.test.tsx` ↔ `codebase/frontend/src/app/(editor)/w/[slug]/__tests__/layout.test.tsx`
  - 상세: `WorkspaceSlugGate`(`lib/workspace/workspace-slug-gate.tsx`)로 slug 해소·URL 우선 reconcile·무효-slug redirect·로딩 gate 로직을 단일화한 것은 SRP/DRY 관점에서 올바른 리팩터다. 그러나 그 행위(정합 시 렌더, 불일치 시 gate+reconcile, 무효 slug 시 redirect, 미로드 시 gate)를 검증하는 테스트는 `lib/workspace/__tests__/` 아래 `WorkspaceSlugGate` 자신을 대상으로 한 벌 존재하는 게 아니라, `(main)`·`(editor)` 두 layout 테스트 파일에 거의 동일한 mock 세팅(`next/navigation`·`use-workspaces`·`workspace-store`)과 4개 케이스가 그대로 중복돼 있다. 향후 게이트 행위가 바뀌면 두 파일을 항상 동기 수정해야 하고, 한쪽만 갱신하면 거짓 안전감을 준다. 로직 SoT 는 이미 한 곳으로 모았는데 검증 SoT 는 여전히 두 곳이라 추출의 이점(단일 지점 유지보수)이 테스트 계층에서는 상쇄된다.
  - 제안: `lib/workspace/__tests__/workspace-slug-gate.test.tsx` 를 신설해 위 4개 행위 케이스를 `WorkspaceSlugGate` 에 대해서만 한 벌로 유지하고, 두 layout 테스트는 "layout 이 `<WorkspaceSlugGate>` 를 실제로 배선하는지"만 확인하는 얇은 wiring 테스트(예: `WorkspaceSlugGate` 를 mock 해 `children` 이 그 안으로 전달되는지만 단언)로 축소한다.

- **[WARNING]** 두 개의 raw-href guard 테스트 파일이 스캐너 스캐폴딩을 그대로 중복 구현
  - 위치: `codebase/frontend/src/lib/workspace/__tests__/no-raw-editor-href.test.ts`, `codebase/frontend/src/lib/workspace/__tests__/no-raw-execution-href.test.ts`
  - 상세: 두 파일은 `collectSourceFiles`(재귀 디렉토리 스캔 + `__tests__`/`node_modules` 제외 + `.ts(x)` 필터), exemption 판정, self-test 구조(참/거짓 positive 표)를 각각 독립적으로 복붙해 유지한다. 이번 diff 에서 `no-raw-editor-href.test.ts` 가 신규 추가되며 이미 존재하던 `no-raw-execution-href.test.ts` 의 로직을 사실상 그대로 재구현했다. "raw href 리터럴 금지" 라는 동일한 아키텍처 fitness-function 클래스가 세 번째(예: 다른 경로 빌더 추가) 필요해지면 또 한 벌이 복붙될 가능성이 높다.
  - 제안: `collectSourceFiles`(+ 공통 exemption 판정 골격)를 `__tests__/href-guard-utils.ts` 같은 공유 헬퍼로 추출하고, 각 guard 파일은 자신의 regex + exemption 목록만 갖도록 축소한다.

- **[INFO]** `WorkspaceSlugGate` 의 무효-slug fallback 목적지가 `/dashboard` 로 하드코딩돼 있어 향후 세 번째 소비 컨텍스트가 생기면 재검토가 필요할 수 있음
  - 위치: `codebase/frontend/src/lib/workspace/workspace-slug-gate.tsx:34-39` (`router.replace(buildWorkspaceHref(fallback.slug, "/dashboard"))`)
  - 상세: 현재 `(main)`·`(editor)` 두 route group 모두 "무효 slug → 기본 워크스페이스 dashboard" 라는 동일 UX 로 합의됐고(plan 의 "무효 slug: (main)과 동일 default redirect" 결정), 그 결정을 게이트가 대신 상속하도록 설계한 것 자체는 의도된 선택이다. 다만 컴포넌트 계약상 fallback 목적지가 파라미터화돼 있지 않아, 만약 향후 다른 route group(예: 공유/뷰어 전용 컨텍스트)이 이 게이트를 재사용하는데 `/dashboard` 가 적절한 착지점이 아니라면 공용 컴포넌트를 수정하거나 우회해야 한다 — OCP 관점에서 약한 결합.
  - 제안: 당장 조치 불필요. 세 번째 소비처가 생길 때 `fallbackPath?: string` prop(기본값 `/dashboard`)으로 파라미터화하는 것을 고려.

- **[INFO]** 계층 분리와 순환 의존성 부재 — 긍정적 관찰
  - 위치: `codebase/frontend/src/lib/workspace/workspace-slug-gate.tsx`, `codebase/frontend/src/app/(main)/w/[slug]/layout.tsx`, `codebase/frontend/src/app/(editor)/w/[slug]/layout.tsx`
  - 상세: 추출된 `WorkspaceSlugGate` 는 `useParams().slug` 하나에만 의존하고 어느 route group(chrome)에 속하는지 전혀 알지 못한다 — 프레젠테이션(레이아웃/chrome)과 워크스페이스 컨텍스트 정합 로직(비즈니스 규칙)이 올바르게 분리됐다. 두 layout 은 `lib/workspace/*` 를 소비만 할 뿐 역방향 의존이 없어 순환 참조 위험이 없고, `(main)/w/[slug]/layout.tsx` 전후 diff 는 76줄 로직을 1줄 위임으로 축소해 실질적인 중복 제거 효과를 낸다.

- **[INFO]** `buildEditorHref` 는 기존 `buildExecutionHref` 패턴을 그대로 계승해 확장성 있게 설계됨
  - 위치: `codebase/frontend/src/lib/workspace/href.ts:41-52`
  - 상세: 새 헬퍼가 기존 `buildWorkspaceHref` 에 위임하는 얇은 함수이지만, 이는 우발적 중복이 아니라 "경로 조립 단일 진실 + 소스텍스트 기반 guard 테스트로 우회 금지"라는 이미 검증된 아키텍처 패턴(PR #865 broken-link 재발 방지)을 대칭적으로 재사용한 것이다. `no-raw-editor-href.test.ts` 가 이 계약을 CI 레벨에서 강제해, 향후 소비처가 늘어나도(트리거/스케줄/통합 카드 등) 리터럴 재산재 회귀를 구조적으로 차단한다 — 개방-폐쇄 원칙에 부합하는 확장 방식.

- **[INFO]** `WorkflowEditorLoader` 는 경로만 이동했을 뿐 로직 변경이 없으나, 같은 diff 안의 다른 페이지(`ExecutionListPage`)와 데이터 패칭 패턴이 상이함 (기존 부채, 이번 변경으로 신규 도입된 문제 아님)
  - 위치: `codebase/frontend/src/app/(editor)/w/[slug]/workflows/[id]/editor-loader.tsx`
  - 상세: 이 컴포넌트는 `useEffect` + `cancelled` 플래그로 수동 데이터 패칭·로딩/에러 상태·응답 shape 정규화(`res.data.data ?? res.data`)·노드/엣지 변환·i18n 을 한 컴포넌트에서 모두 처리한다. 반면 같은 diff 의 `ExecutionListPage`(`(main)/w/[slug]/workflows/[id]/executions/page.tsx`)는 `useQuery`(TanStack Query)로 캐싱·상태를 위임한다. 두 패턴이 같은 앱 내 공존하는 것 자체는 이번 변경이 만든 문제가 아니라(파일은 100% 동일 내용으로 경로만 이동), 에디터가 이제 `(main)` 과 같은 `w/[slug]` 네임스페이스로 편입돼 인접해졌으므로 컨벤션 정합화(react-query 로 통일)는 phase 2 이후 후속 리팩터 후보로 남겨둘 만하다. 이번 PR 을 막을 사유는 아니다.

### 요약

이번 변경의 핵심 아키텍처 결정 — `(main)/w/[slug]/layout.tsx` 의 slug 해소·URL 우선 reconcile·무효-slug redirect·gate 로직을 route-group 무관한 공용 `WorkspaceSlugGate` 로 추출해 `(editor)/w/[slug]/layout.tsx` 와 공유한 것 — 은 SRP/DRY·계층 분리·모듈 경계 관점에서 건전하며 순환 의존성도 없다. `buildEditorHref` 헬퍼와 대칭 guard 테스트(`no-raw-editor-href.test.ts`)로 raw 리터럴 재발을 구조적으로 차단한 접근도 기존에 검증된 패턴(`buildExecutionHref`/`no-raw-execution-href.test.ts`)을 일관되게 재사용한 것으로 확장성 있는 설계다. 다만 로직은 한 곳으로 모았음에도 그 로직을 검증하는 테스트는 두 layout 테스트 파일에 그대로 복제돼(WARNING) 유지보수 이점이 테스트 계층에서 상쇄되고, 두 raw-href guard 테스트 파일도 스캐너 스캐폴딩을 복붙 중복하고 있어(WARNING) 향후 유사 guard 추가 시 세 번째 복붙으로 이어질 여지가 있다. 두 사안 모두 정확성을 위협하지 않는 유지보수성 이슈이며 병합을 막을 정도는 아니다.

### 위험도
LOW
