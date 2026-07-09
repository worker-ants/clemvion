# 유지보수성(Maintainability) 리뷰 결과

검토 대상 43개 파일 중 실질적인 애플리케이션 코드는 `codebase/frontend/src/lib/workspace/{href.ts,use-workspace-slug.ts,use-workspaces.ts}`(신규) 와
`codebase/frontend/src/lib/integrations/{use-cafe24-pending-polling.ts,use-makeshop-pending-polling.ts}`(slug 스레딩 추가), 그리고 대응 테스트 파일들이다.
나머지(spec frontmatter `code:` 경로 일괄 정정, `review/consistency/**` 산출물, `plan/**` 체크리스트)는 기계적인 문자열 치환·문서 산출물이라 유지보수성 관점에서 실질적 코드 품질 이슈가 없다.

## 발견사항

- **[INFO]** 신규 hook 3종(`useWorkspaceSlug`/`useWorkspaces`/`useWorkspaceStore`) 이름 유사성
  - 위치: `codebase/frontend/src/lib/workspace/use-workspace-slug.ts`, `codebase/frontend/src/lib/workspace/use-workspaces.ts`, `codebase/frontend/src/lib/stores/workspace-store.ts:36`
  - 상세: 세 이름이 모두 "workspace" 어근을 공유하고 의미(현재 slug 파생값 / 멤버십 목록 fetch / zustand 전역 store)가 미묘하게 다르다. 각 파일에 역할을 설명하는 JSDoc 은 이미 붙어 있어(`use-workspace-slug.ts`: "cf. `useWorkspaceStore`... `useWorkspaces`..." 식 상호 참조) 실제 혼동 위험은 낮게 완화돼 있으나, import 자동완성 시 오선택 여지는 여전히 남는다. (consistency-check naming_collision checker 도 동일 사안을 INFO 로 이미 보고함 — 중복 확인.)
  - 제안: 현재 JSDoc 상호 참조로 충분히 완화됨. 추가 조치는 불필요하지만, 새 workspace 관련 hook 을 더 추가할 계획이라면 이름 프리픽스 컨벤션(`useWorkspace*` = 파생값, `useWorkspaces` = 목록, `*Store` = 전역 상태)을 `spec/conventions/` 나 코드 주석에 한 번 명문화해두면 향후 확장에 도움.

- **[INFO]** 라우트 프리픽스 `"/w/"` 매직 스트링이 두 곳에 각각 하드코딩
  - 위치: `codebase/frontend/src/lib/workspace/href.ts:15` (`` `/w/${slug}${clean}` ``) 및 `codebase/frontend/src/components/auth/auth-provider.tsx:56` (`pathname.startsWith("/w/")`, 이번 diff 범위 밖이지만 같은 기능 축)
  - 상세: 워크스페이스 슬러그 라우트의 세그먼트 이름(`w`)이 공유 상수 없이 두 파일에 리터럴로 중복된다. 현재는 두 곳뿐이라 실질 위험은 낮으나, 프리픽스가 바뀌면(`/w/` → 다른 이름) 한쪽만 갱신하고 다른 쪽을 놓칠 수 있는 drift 표면이다.
  - 제안: `href.ts` 에 `export const WORKSPACE_ROUTE_PREFIX = "/w/"` 상수를 두고 두 위치 모두 참조하도록 하면 단일 진실점이 된다. 다만 현재 diff 범위 최소화 관점에서는 지금 당장 조치할 필요는 없음(우선순위 낮음).

- **[INFO]** `useWorkspaceSlug` 의 `params &&` null 가드가 사실상 도달 불가능한 방어 코드
  - 위치: `codebase/frontend/src/lib/workspace/use-workspace-slug.ts:16-17`
    ```ts
    const params = useParams();
    const fromUrl =
      params && typeof params.slug === "string" ? params.slug : null;
    ```
  - 상세: Next.js `useParams()` 타입 시그니처는 항상 객체를 반환하며(`Params` 타입, null/undefined 아님) `params &&` 체크가 실질적으로 항상 truthy 다. 테스트(`use-workspace-slug.test.tsx`)도 `useParams` mock 이 항상 `{}` 이상을 반환하도록 돼 있어 이 분기를 검증하지 않는다. 방어 코드 자체가 해롭지는 않으나, 읽는 사람이 "params 가 falsy 일 수 있는 경우가 실제로 있나?" 하고 불필요하게 고민하게 만드는 사소한 인지 부하다.
  - 제안: `typeof params.slug === "string" ? params.slug : null` 로 단순화하거나, 방어 목적이 있다면 (예: 특정 레이아웃 밖에서 훅이 호출될 가능성) 그 이유를 주석 한 줄로 남길 것.

- **[INFO]** cafe24/makeshop pending-polling 테스트가 slug-프리픽스 분기를 실제로 exercise 하지 않음
  - 위치: `codebase/frontend/src/lib/integrations/__tests__/use-cafe24-pending-polling.test.tsx:14`, `use-makeshop-pending-polling.test.tsx:29` (둘 다 `useParams: () => ({})` 추가)
  - 상세: 두 테스트 파일 모두 `next/navigation` mock 에 `useParams: () => ({})` 만 추가해 `useWorkspaceSlug()` 가 항상 URL 쪽 slug 없이 store fallback(미설정 시 `null`) 을 타도록 고정한다. 그 결과 "connected 전환 시 라우팅" 테스트(`expect(mockReplace).toHaveBeenCalledWith("/integrations/int-1")`)는 계속 통과하지만, 실제 프로덕션에서 흔한 "slug 가 있을 때 `/w/<slug>/integrations/...` 로 라우팅되는지"는 이 두 파일에서 검증되지 않는다(그 분기 자체는 `href.test.ts`에서 별도로 커버됨). 향후 리더가 "이 훅이 워크스페이스 aware 라우팅을 통합 테스트한다"고 오해할 여지가 약간 있다.
  - 제안: 필수는 아님(단위는 `buildWorkspaceHref` 쪽에서 이미 커버) — 원한다면 두 polling 훅 테스트 중 하나에 `useParams: () => ({ slug: "team-a" })` 케이스를 한 건 추가해 "slug 존재 시 `/w/team-a/integrations/...` 로 라우팅"을 명시적으로 문서화하면 회귀 방지력이 조금 더 높아짐.

## 요약

신규 코드(`href.ts`, `use-workspace-slug.ts`, `use-workspaces.ts`)는 각각 10~30줄 내외의 단일 책임 함수/훅으로, JSDoc 이 목적·SoT spec 앵커·다른 유사 훅과의 관계까지 명시해 가독성과 의도 전달이 우수하다. cafe24/makeshop polling 훅에 대한 slug 스레딩 추가는 두 파일에 대칭적으로 적용되어 기존에 이미 결정된 "의도적 미러 중복" 패턴을 정확히 따랐고, 중첩·매직넘버·순환복잡도 문제는 발견되지 않았다. 발견된 사항은 전부 INFO 수준(이름 유사성 — 이미 JSDoc 으로 완화됨, `/w/` 리터럴 중복, 도달 불가능한 방어 코드, 테스트가 slug-프리픽스 분기를 직접 커버하지 않는 점)으로 즉시 조치가 필요한 항목은 없다. spec/plan/review 문서 diff 는 대부분 경로 문자열의 기계적 일괄 치환이라 유지보수성 리스크가 없다.

## 위험도

LOW
