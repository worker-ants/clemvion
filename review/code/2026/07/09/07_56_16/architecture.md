# 아키텍처(Architecture) 리뷰

대상: 워크스페이스 슬러그 라우팅 phase 1 ai-review Warning 4건 조치 커밋
(`fa228b635a7f9581ed7db54c599e25c99b5ee3a8`). 이전 세션(2026-07-08 18:24) 아키텍처 리뷰가 지적한
WARNING("폴백/활성 워크스페이스 해소 로직이 `layout.tsx`·`[...rest]/page.tsx` 에 중복 구현")에 대한
후속 조치(`resolveFallbackWorkspace` 추출)가 핵심이며, 그 외 보안 fix(`buildWorkspaceHref` 정규화)와
신규 단위테스트 3종이 함께 묶여 있다. 판단의 완전성을 위해 diff 밖의 관련 소스
(`use-workspace-slug.ts`, `use-workspaces.ts`, `lib/stores/workspace-store.ts`)도 직접 열람해
통합 평가했다.

## 발견사항

- **[INFO(양호)]** 이전 WARNING("폴백 로직 중복")이 정확히 해소됨
  - 위치: `codebase/frontend/src/lib/workspace/resolve-fallback.ts`(신규),
    `codebase/frontend/src/app/(main)/w/[slug]/layout.tsx:100`,
    `codebase/frontend/src/app/(main)/[...rest]/page.tsx:100`
  - 상세: `workspaces.find((w) => w.id === currentWorkspaceId) ?? workspaces[0]` 표현식이
    두 route 컴포넌트에 각자 인라인돼 있던 것을, `href.ts` 와 동일한 패턴(작은 순수 함수 + 전용
    단위테스트 4개)으로 `resolveFallbackWorkspace()` 로 추출해 양쪽이 공유하도록 정확히 고쳤다.
    리뷰어가 제안한 방식 그대로 구현됐고, 두 호출부 모두 `git grep` 으로 대체 확인됨.
  - 조치 불요(양호 사례로 기록).

- **[WARNING]** DRY 정리가 부분적 — 동일 폴백 정책의 세 번째 구현이 `workspace-store.ts` 에 잔존
  - 위치: `codebase/frontend/src/lib/stores/workspace-store.ts` `setWorkspaces` (약 40-45행):
    `const stillExists = current && list.some((w) => w.id === current); const next = stillExists ? current : list[0]?.id ?? null;`
  - 상세: `resolve-fallback.ts` 의 JSDoc 은 "`[slug]` layout 의 폴백 리다이렉트와 `catch-all` 이
    **동일 규칙을 공유**하도록 단일 순수 함수로 추출 — 정책이 바뀔 때 한 곳만 고치면 되고, 두 지점이
    서로 다른 워크스페이스로 귀결되는 drift 를 막는다" 고 명시한다. 그러나 실제로는 논리적으로
    동일한 정책("현재 id 가 목록에 있으면 유지, 없으면 목록 첫 항목")의 **세 번째 구현**이
    `useWorkspaceStore.setWorkspaces` 내부에 별도로 존재하며 이번 추출에 포함되지 않았다. 지금은
    세 곳 모두 우연히 같은 규칙이라 무증상이지만, 이 정책이 향후 바뀌면(JSDoc 이 스스로 언급하는
    시나리오와 정확히 같은 종류의 변경) `resolveFallbackWorkspace()` 만 고치고 `setWorkspaces` 의
    인라인 구현을 놓치는 회귀가 재발할 수 있다 — 이번 리팩터가 막으려 했던 바로 그 drift 가 세 번째
    지점에서 그대로 남아 있는 셈이다. JSDoc 의 "단일 진실 공급원" 주장이 사실보다 넓게 서술돼 있어
    향후 유지보수자를 오도할 소지도 있다.
  - 제안: `setWorkspaces` 도 `resolveFallbackWorkspace(list, current)?.id ?? null` 로 위임하도록
    바꾸거나(단, `list` 가 비었을 때의 `null` 처리 확인 필요), 그럴 수 없는 이유가 있다면(예: store
    내부에서 순환 import 우려) JSDoc 을 "현재 2/3 호출부만 커버함, `workspace-store.setWorkspaces`
    는 별도 구현 유지"로 스코프를 축소해 오해를 방지할 것.

- **[INFO]** 유사하지만 의미가 다른 네 번째 변형 — `useWorkspaceSlug` 의 store-fallback 은 first-workspace
  로 떨어지지 않음
  - 위치: `codebase/frontend/src/lib/workspace/use-workspace-slug.ts:19-22`
    (`s.workspaces.find((w) => w.id === s.currentWorkspaceId)` — 매치 없으면 `null`, `workspaces[0]`
    폴백 없음)
  - 상세: 이 훅은 "URL 에 slug 세그먼트가 없을 때 store 의 활성 워크스페이스로 폴백"이 목적이라
    `resolveFallbackWorkspace` 와 의도적으로 다른 정책(첫 워크스페이스로 떨어지지 않고 정확한 매치만
    인정)을 쓴다 — 이는 버그가 아니라 올바른 설계 선택으로 보인다(사이드바 링크 등에서 근거 없이
    임의 워크스페이스로 유도하면 안 되므로). 다만 "`resolve*`/`fallback`" 계열의 유사 명명·유사
    로직이 이미 4곳(`layout.tsx`(구), `[...rest]`(구), `resolveFallbackWorkspace`(신규),
    `use-workspace-slug`, `workspace-store.setWorkspaces`)에 흩어져 있어 향후 합류점에서 혼동
    가능성이 있다.
  - 제안: 우선순위 낮음. 위 WARNING 정리 시 함께 JSDoc 에 "이 훅은 first-workspace 폴백을 하지
    않는다(의도적 차이)"를 한 줄 명시해 두면 향후 오해를 예방.

- **[INFO(양호)]** `buildWorkspaceHref` 오픈 리다이렉트 방어가 단일 경계 지점에 위치
  - 위치: `codebase/frontend/src/lib/workspace/href.ts:15`
  - 상세: `path.startsWith("/") ? path : "/"+path"` 를 `` `/${String(path).replace(/^\/+/, "")}` ``
    로 교체해 선두 슬래시를 하나로 정규화했다. 이 함수는 저장소 전체 ~30개 소비처의 유일한
    경로-빌더이므로, 정규화를 호출부마다 반복하지 않고 경계(boundary) 한 곳에 둔 것은 방어적
    프로그래밍 관점에서 적절한 위치 선정이다(호출부가 늘어나도 자동으로 방어를 상속). `href.test.ts`
    에 대응 회귀 테스트도 추가돼 있다.
  - 조치 불요(양호 사례로 기록).

- **[INFO]** 순환 의존성 없음 / 레이어 경계 유지 확인
  - 상세: `resolve-fallback.ts` 가 `lib/stores/workspace-store.ts` 에서 `WorkspaceSummary` 타입만
    import 하고(값 import 아님), 역방향 의존은 없음(`workspace-store.ts` 는 `zustand`/`zustand/middleware`
    만 import). `layout.tsx` 가 resolve→reconcile→membership-redirect→gate 를 계속 단일 지점에서
    담당해 하위 페이지의 라우팅 결합도가 낮게 유지되는 이전 리뷰의 "양호 사례" 평가도 이번 diff 로
    훼손되지 않았다.
  - 조치 불요.

## 요약

이전 아키텍처 리뷰가 지적한 핵심 WARNING(폴백 워크스페이스 해소 로직의 `layout.tsx`/`[...rest]/page.tsx`
간 중복)은 `resolveFallbackWorkspace()` 순수 함수 추출로 정확하고 관용적으로(`href.ts` 와 동일 패턴)
해소됐다. 다만 같은 정책의 세 번째 인라인 구현이 `workspace-store.ts` 의 `setWorkspaces` 에 남아 있어
"단일 진실 공급원"이라는 신규 헬퍼의 JSDoc 주장이 실제로는 2/3 지점만 커버하는 상태이며, 향후 폴백
정책이 바뀌면 이번에 막으려 했던 것과 동일한 종류의 drift 가 세 번째 지점에서 재발할 수 있다(WARNING,
현재는 규칙이 동일해 무증상). `buildWorkspaceHref` 의 오픈 리다이렉트 방어는 유일한 경로-빌더 경계에
위치해 모든 소비처에 자동 전파되는 적절한 설계이며, 순환 의존성·레이어 분리는 이번 diff 로 훼손되지
않았다. 전반적으로 이 커밋은 이전 리뷰 피드백을 충실히 반영한 낮은 위험도의 개선이다.

## 위험도

LOW
