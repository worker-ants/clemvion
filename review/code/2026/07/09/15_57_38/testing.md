# 테스트(Testing) 리뷰 — buildEditorHref 콜사이트 slug 회귀 테스트 3곳

## 검증 사실

- 대상 3개 테스트 파일(`usage-node-list.test.tsx`, `overview-card.test.tsx`, `triggers-page.test.tsx` 추가분)을 실제로 `vitest run` 으로 실행 — **18/18 전부 통과** 확인 (신규 3건 포함).
- 커밋 메시지대로 production 코드(`usage-node-list.tsx`, `overview-card.tsx`, triggers `page.tsx`) 는 무변경, 테스트 전용 diff.
- 소스 확인: 세 콜사이트 모두 `useWorkspaceSlug()` → `buildEditorHref(slug, workflowId)` → `<Link href=...>` 패턴으로 이미 정확히 배선되어 있었음 (defer 사유와 일치).

## 발견사항

- **[INFO]** URL-우선 경로만 2/3 커버, store-폴백 경로는 1/3만 커버 (의도된 분산이나 명시 X)
  - 위치: `usage-node-list.test.tsx`/`overview-card.test.tsx` (params.slug 직접 mock) vs `triggers-page.test.tsx` (params `{}` + `setRole` 로 store 시딩)
  - 상세: `useWorkspaceSlug` 의 우선순위(`fromUrl ?? fromStore`, `use-workspace-slug.ts:24`)는 이미 자체 단위 테스트(`use-workspace-slug.test.tsx`)로 양쪽 분기가 커버돼 있음. 3개 콜사이트 테스트는 "URL 우선"과 "store 폴백" 두 경로를 우연히 나눠 커버하고 있어(전자 2곳, 후자 1곳) 결과적으로 콜사이트 배선이 두 소스 모두에서 정상 동작함을 교차 확인하는 효과가 있다. 다만 의도적 설계라기보다 기존 `triggers-page.test.tsx` scaffold(`useParams: () => ({})`) 재사용의 부산물로 보인다.
  - 제안: 현행 유지로 충분(회귀 가드 목적 달성). 후속에서 콜사이트 테스트를 늘릴 경우 "URL 우선 vs store 폴백" 두 경로를 의식적으로 배분하면 좋음.

- **[INFO]** slug 부재(null) 폴백 케이스는 콜사이트 레벨에서 미검증
  - 위치: 3개 신규 테스트 전부
  - 상세: `useWorkspaceSlug` 가 URL/store 양쪽 모두 slug 를 못 찾는 경우 `buildEditorHref` 는 bare path(`/workflows/<id>`)로 폴백하는데(catch-all 이 흡수), 이 폴백 자체는 `href.test.ts`/`use-workspace-slug.test.tsx` 에서 이미 충분히 단위 테스트됨. 콜사이트 3곳은 "slug 있음" happy path 만 검증한다.
  - 제안: 회귀 가드가 겨냥하는 버그 클래스(리터럴 경로로 slug 를 통째로 누락하는 PR #865/#866 유형)는 "slug-present" 케이스만으로 충분히 잡히므로 추가 불필요 판단. 다만 완결성을 원한다면 콜사이트별로 slug=null 1건씩만 추가해 폴백 배선도 콜사이트에서 직접 보증할 수 있음(중복이지만 저비용).

- **[INFO]** dialog variant 테스트의 링크 개수 미단언
  - 위치: `usage-node-list.test.tsx:77-83` (`getAllByRole("link")` + `toContain`)
  - 상세: `variant="dialog"` 테스트는 href 배열에 기대값이 "포함"되는지만 확인하고 정확히 1개인지는 확인하지 않는다. 현재 fixture 는 1개 workflow 라 실질적 위험은 낮음.
  - 제안: 필요 시 `expect(hrefs).toEqual(["/w/team-x/workflows/wf-1"])` 로 강화 가능(선택적).

- **[INFO]** 단일 항목(usages 배열 length=1) fixture 만 사용
  - 위치: `usage-node-list.test.tsx:61-68`
  - 상세: 여러 workflow 가 목록에 있을 때 각 항목이 독립적으로 자신의 `workflowId` 로 링크를 만드는지(다른 항목의 id 를 혼용하지 않는지)는 검증되지 않는다. `usages.map` 안에서 `w.workflowId` 를 그대로 쓰는 단순 구조라 실질 리스크는 낮음.
  - 제안: 선택적으로 2개 이상 항목 fixture 추가 시 클로저 버그(예: map 인덱스 혼동) 도 배제 가능.

## Mock 적절성 / 테스트 격리 평가

- `next/navigation` mock(`useParams`) 은 세 파일 모두 최소 범위로 필요한 것만 반환 — 과잉 mock 없음.
- `overview-card.test.tsx` 의 `useWorkspaceStore.setState(...)` 는 `beforeEach` 에서 전체 상태(workspaces/currentWorkspaceId/loaded)를 덮어써 이전 테스트 파일의 전역 zustand 상태 잔존 영향 없음.
- `triggers-page.test.tsx` 신규 `it` 은 기존 `setRole`/`mockTriggersResponse` 헬퍼를 그대로 재사용해 기존 테스트 스타일과 일관되고, 같은 `describe` 블록의 `beforeEach`(`useWorkspaceStore.getState().reset()`) 로 격리됨 — 신규 테스트가 다른 테스트에 상태를 흘리거나 흘려받지 않음.
- 세 파일 모두 독립 실행 가능(순서 의존 없음) — 실제 실행에서도 확인됨.

## 회귀 테스트 관점

- 세 테스트는 정확히 defer 됐던 3개 콜사이트의 "slug 누락 리터럴 회귀"(PR #865/#866 유형)를 직접 겨냥 — 향후 누군가 `buildEditorHref` 호출을 raw `` `/workflows/${id}` `` 리터럴로 되돌리면 이 3개 테스트가 즉시 fail 하여 정확한 회귀 감지 대상과 일치.
- 기존 테스트(`triggers-page.test.tsx` 의 pagination/RBAC/auth-column/deep-link describe 블록)는 신규 `it` 삽입 위치·전역 mock 변경이 없어 영향 없음 — 실행 결과로도 확인.

## 요약

3개 신규/추가 테스트는 production 코드 변경 없이 순수 회귀 가드를 보강하는 목적에 정확히 부합하며, 실제 `vitest run` 실행으로 18/18 통과를 확인했다. Mock 범위는 최소·적절하고 테스트 격리도 기존 파일의 `beforeEach`/`reset()` 패턴을 그대로 따라 안전하다. 다만 세 콜사이트 모두 "slug 존재" happy path 만 다루고 slug-null 폴백은 콜사이트 레벨에서 별도 검증하지 않는데, 이는 헬퍼(`href.ts`)와 훅(`use-workspace-slug.ts`) 단위 테스트에서 이미 커버되어 있어 실질적 갭은 아니다. 전반적으로 낮은 리스크의 견고한 테스트 전용 추가.

## 위험도

NONE
