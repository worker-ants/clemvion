# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CRITICAL 발견은 없으나, 이번 diff 로 새로 추가된 slug-aware 라우팅 경로(신규 `useWorkspaces` 훅, cafe24/makeshop pending-polling 훅의 slug-prefix 리다이렉트 분기)가 유닛·e2e 어느 층에서도 실제 값으로 검증되지 않는 테스트 커버리지 갭이 두 곳 있고, `buildWorkspaceHref` 의 오픈 리다이렉트 방어 공백·워크스페이스 폴백 로직 중복(DRY)·SPEC-DRIFT 2건이 함께 확인되어 WARNING 누적이 상당하다. 또한 라우터가 "success" 로 보고한 4개 reviewer(scope/side_effect/documentation/user_guide_sync)의 출력 파일이 디스크에 실존하지 않아 해당 관점의 검토 내용이 이번 보고서에 반영되지 못했다(§ 하단 비고).

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| — | — | 없음 | — | — |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | 신규 `useWorkspaces` 훅이 자체 단위테스트가 없고, 3개 소비처(catch-all page/`w/[slug]` layout/sidebar) 테스트가 전부 `useWorkspaces: () => ({})` 로 완전히 mock 되어 실제 구현(store 동기화 side-effect, `enabled: !!user` 게이트, `staleTime` dedup 의도)이 리포지토리 어디에서도 실행되지 않음 | `codebase/frontend/src/lib/workspace/use-workspaces.ts`(신규); `workspace-redirect.test.tsx`, `w/[slug]/__tests__/layout.test.tsx` | `use-workspaces.test.tsx` 추가해 (1) resolve 후 store 갱신 (2) `user` 없을 때 fetch 미호출 (3) 동일 queryKey dedup 을 단언. `workspace-store.test.ts` 에 `setWorkspaces` 유지/폴백 분기 케이스 추가 |
| 2 | testing / requirement / maintainability | cafe24/makeshop pending-polling 훅 테스트가 이번 diff 로 추가된 `useWorkspaceSlug()`→`buildWorkspaceHref()` slug-prefix 리다이렉트 분기를 실제로 exercise 하지 않음 — 두 테스트 파일 모두 store 를 세팅하지 않아 slug 가 항상 `null`, bare-path 폴백 분기만 실행. e2e(`slug-routing.spec.ts`)도 이 경로를 커버하지 않음 | `use-cafe24-pending-polling.test.tsx`("transitions on connected"), `use-makeshop-pending-polling.test.tsx`(동일) | `useWorkspaceStore.setState({ workspaces:[...], currentWorkspaceId:... })` 로 non-null slug 주입하는 케이스 1개씩 추가해 `mockReplace` 가 `/w/<slug>/integrations/<id>` 형태로 호출되는지 단언 |
| 3 | architecture | "폴백/활성 워크스페이스 해소"(`workspaces.find(w => w.id === currentWorkspaceId) ?? workspaces[0]`) 로직이 `layout.tsx` 와 `[...rest]/page.tsx` 에 동일 표현식으로 각자 재구현되어 DRY 위반 — 지금은 우연히 동일 규칙이나 향후 정책 변경 시 두 지점을 모두 갱신해야 하고 누락 시 catch-all 리다이렉트와 layout 멤버십-폴백이 서로 다른 워크스페이스로 귀결될 위험 | `codebase/frontend/src/app/(main)/w/[slug]/layout.tsx:53-61`, `codebase/frontend/src/app/(main)/[...rest]/page.tsx:30-33` | `resolveFallbackWorkspace(workspaces, currentWorkspaceId)` 순수 함수 또는 `useActiveOrFallbackWorkspace()` 훅으로 추출해 양쪽에서 공유(`href.ts` 와 동일 패턴: 작은 순수 함수 + 단위테스트) |
| 4 | security | 신규 공용 헬퍼 `buildWorkspaceHref` 가 protocol-relative(`//host`) 경로를 걸러내지 않음 — `path.startsWith("/")` 검사만으로는 `//evil.com/x` 도 통과. `slug` 없는 폴백 분기에서는 caller 가 넘긴 `path` 를 검증 없이 그대로 반환하므로, 향후 attacker-influenced 문자열(예: `(main)/[...rest]` catch-all 이 원본 rest 세그먼트를 그대로 넘기는 경우)을 흡수하면 `router.replace("//evil.com/...")` 형태의 오픈 리다이렉트로 이어질 수 있는 방어 공백 | `codebase/frontend/src/lib/workspace/href.ts` | 진입 시 선두 슬래시 정규화(`path.replace(/^\/+/, "/")`) 또는 `//` 시작 입력 명시적 거부·치환. slug 가 falsy 인 폴백 분기에도 동일하게 정규화된 값을 반환하도록 해 ~22개 이상 호출부 전체에 일관된 방어 제공. `(main)/[...rest]/page.tsx` catch-all 이 원본 URL 세그먼트를 이 함수에 넘기는지 별도 확인 권장 |
| 5 | SPEC-DRIFT | `[SPEC-DRIFT]` `useWorkspaceSlug`/`buildWorkspaceHref`/`(main)/w/[slug]/layout.tsx` 가 SoT 로 인용하는 `spec/2-navigation/9-user-profile.md §3` 본문이 여전히 "현재 구현: URL 경로는 워크스페이스에 따라 바뀌지 않는다" / "미구현(Planned)" 으로 서술 — 코드는 이미 URL-우선 slug 라우팅을 구현했으나 인용 대상 spec 본문이 정반대를 서술하는 정면 모순. `plan/in-progress/workspace-slug-routing.md` 체크리스트 항목 10(spec 반영, planner 위임)이 아직 미체크인 의도된 단계적 워크플로(코드 선행 → planner spec flip)로 판단됨 | `spec/2-navigation/9-user-profile.md §3`(153~155행) | 코드는 유지. `project-planner` 가 §3 을 "구현 완료 — URL 이 SoT" 로 flip(plan 항목 10 실행). 이미 plan 에 추적 중이므로 신규 작업 아님 — 누락 없이 실제 수행되는지만 확인 |
| 6 | SPEC-DRIFT | `[SPEC-DRIFT]` 이동된 페이지들의 spec 본문 bare-path 산문이 frontmatter `code:` 갱신만큼 따라가지 않음(표본: `15-system-status.md`/`16-agent-memory.md` 가 여전히 "경로 `/system-status`."/"경로 `/agent-memory`." 로 구 bare path 서술) — 이전 `review/consistency/2026/07/08/16_58_17/plan_coherence.md` 가 이미 WARNING 으로 지적한 잔여 작업과 동일 계열이며 plan 체크리스트 항목 10 이 이를 흡수하기로 명시(§8 spec 반영 범위 확장) | `spec/2-navigation/15-system-status.md`, `spec/2-navigation/16-agent-memory.md` (및 동일 패턴의 다른 이동 페이지들) | planner 단계에서 frontmatter 뿐 아니라 본문 산문(경로 언급)도 함께 정정. 코드 변경 불요 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | cafe24 훅이 makeshop 과 달리 `integrationId` 를 `encodeURIComponent` 하지 않는 인코딩 비대칭(pre-existing, 이번 diff 는 두 훅 모두 `buildWorkspaceHref` 로 감싸며 노출면만 유지) | `use-cafe24-pending-polling.ts` vs `use-makeshop-pending-polling.ts` | cafe24 훅에도 `encodeURIComponent(integrationId)` 적용해 makeshop 과 동일 방어 갖출 것 |
| 2 | security | cafe24 훅의 `lastErrorMessage` 가 백엔드 원문 에러(OAuth 트레이스 등)를 그대로 노출(pre-existing, 이번 diff 변경 범위 밖) — makeshop 은 `STATUS_REASON_I18N_KEY` 매핑으로 원문 노출 차단(W7 정책) | `use-cafe24-pending-polling.ts:666-671` | makeshop 과 동일한 i18n 매핑(또는 공용 매핑 모듈) 적용 검토 |
| 3 | security | URL `slug` 를 FE 라우팅 SoT 로 신뢰하되 백엔드 인가는 별도 header-first 메커니즘을 그대로 사용해 구조적으로 낮은 리스크. 다만 `(main)/w/[slug]/layout.tsx`(resolve+reconcile gate) 는 이번 payload 밖이라 잘못된 slug 진입 시 다른 워크스페이스 데이터가 순간 렌더링되는 race 여부는 직접 미확인 | `use-workspace-slug.ts`; `(main)/w/[slug]/layout.tsx`(별도 배치) | 별도 배치에서 layout.tsx 재검토(무효/무권한 slug 리다이렉트 안전성, 전환 중 데이터 노출 race) |
| 4 | architecture | `useWorkspaceSlug()` 가 URL 파라미터와 store fallback 을 한 훅에서 우선순위 병합(이중 SoT) — JSDoc·plan·유닛테스트로 의도는 명확하나, `switchWorkspace` 진행 중처럼 두 값이 잠깐 어긋나는 구간의 우선순위 계약이 암묵적 | `use-workspace-slug.ts:19-24` | 현재 JSDoc 으로 충분. 소비처가 계속 늘면(현재 30여 곳) `useActiveWorkspace()` 상위 훅으로 `{slug, id, role}` 단일 진입점 통합 검토 |
| 5 | architecture | OAuth polling 훅이 "폴링 상태 머신" 단일 책임에 라우팅(slug 해소) 책임을 추가로 흡수 — 단일 호출부뿐이라 현재는 문제 없음 | `use-cafe24-pending-polling.ts`, `use-makeshop-pending-polling.ts` | 현재 규모에선 리팩터 불요(과잉설계 방지). 3번째 OAuth provider 추가 시 "폴링"과 "이동 경로 계산" 분리 검토 |
| 6 | architecture | `useWorkspaces()` 의 `queryFn` 내부에서 `setWorkspaces` store 동기화 부수효과 수행 — React Query v5 `onSuccess` 제거 후 통용 패턴이라 위반은 아니나 캐시 정책 조합 시 타이밍 추론이 까다로워질 수 있음 | `use-workspaces.ts:19-24` | 그대로 유지 가능. 다른 엔티티로 확장 시 공통 `useQuerySyncedStore` 유틸 일반화 고려 |
| 7 | maintainability | 신규 hook 3종(`useWorkspaceSlug`/`useWorkspaces`/`useWorkspaceStore`) 이름 유사성 — JSDoc 상호 참조로 실질 위험은 완화됨(consistency-check naming_collision checker 도 동일 사안 INFO 로 이미 보고, 중복 확인) | `use-workspace-slug.ts`, `use-workspaces.ts`, `workspace-store.ts:36` | 현재 조치 불요. 추가 workspace hook 계획 시 네이밍 컨벤션(`useWorkspace*`=파생값, `useWorkspaces`=목록, `*Store`=전역상태) 문서화 검토 |
| 8 | maintainability | 라우트 프리픽스 `"/w/"` 매직 스트링이 `href.ts` 와 `auth-provider.tsx` 두 곳에 각각 하드코딩 | `href.ts:15`, `auth-provider.tsx:56` | `WORKSPACE_ROUTE_PREFIX` 상수로 단일화(우선순위 낮음) |
| 9 | maintainability | `useWorkspaceSlug` 의 `params &&` null 가드가 사실상 도달 불가능한 방어 코드(`useParams()` 는 항상 객체 반환) | `use-workspace-slug.ts:16-17` | `typeof params.slug === "string" ? params.slug : null` 로 단순화하거나 방어 목적 주석 추가 |
| 10 | requirement / testing | `use-page-param.test.tsx` 에 추가된 `useParams: () => ({})` mock 이 실제로 불필요(`usePageParam` 은 해당 훅을 소비하지 않음, 일괄 codemod 부산물로 추정) | `use-page-param.test.tsx` | 별도 조치 불요(harmless). 정리 차원에서 제거해도 무방 |
| 11 | testing | `buildWorkspaceHref` 단위테스트가 빈 문자열 slug(`""`), 빈 path(`""`) 등 저빈도 경계값을 다루지 않음 | `href.test.ts` | 우선순위 낮음 — 여유 있을 때 경계값 케이스 추가 |
| 12 | testing | `use-workspace-slug.test.tsx` 가 실제 zustand 싱글턴을 `reset()` 없이 직접 `setState` 로 전체 필드 나열해 재설정 — 현재 Vitest 설정에서는 파일 간 누수 없으나 스토어 shape 변경에 취약 | `use-workspace-slug.test.tsx` | `beforeEach` 에서 `useWorkspaceStore.getState().reset()` 후 필요 필드만 `setState` 하는 패턴으로 변경 검토(우선순위 낮음) |

## 정상 확인된 항목 (문제 없음)

- 핵심 구현(`buildWorkspaceHref`/`useWorkspaceSlug`/`useWorkspaces`)은 명세된 동작(URL 우선·null-safe 폴백·query 보존)을 정확히 구현하고 자체 단위테스트로 커버됨.
- `spec/**` frontmatter `code:` 경로 미러 20여 건 전량이 실제 `(main)/w/[slug]/...` 경로와 일치 확인(직접 `find` 대조).
- 이전 `--impl-prep` consistency-check 가 CRITICAL 로 지적한 `/docs` `[...slug]` vs 워크스페이스 `[slug]` 파라미터 충돌 — docs 를 slug 트리 밖에 유지하는 스코프 결정으로 근본 해소됨(architecture 리뷰 "양호 사례"로 기록).
- `layout.tsx` 가 resolve→reconcile→membership-redirect→gate 를 단일 게이트로 집중해 하위 30여 페이지가 라우팅 관심사를 신경 쓸 필요 없는 계층 분리 양호.
- 하드코딩 시크릿·SQL/커맨드 인젝션·안전하지 않은 암호화 패턴 없음(FE-only 순수 라우팅/링크-빌더 변경).
- TODO/FIXME/HACK/XXX 주석 없음.

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | `buildWorkspaceHref` 오픈 리다이렉트 방어 공백(WARNING) + cafe24/makeshop 비대칭 다수(INFO, pre-existing) |
| architecture | LOW | 워크스페이스 폴백 해소 로직 중복(WARNING) + 이중 SoT/책임 혼재 다수(INFO); docs 분리·layout 단일 게이트는 양호 사례 |
| requirement | LOW | SPEC-DRIFT 2건(9-user-profile §3, 이동 페이지 산문) + 폴링 훅 slug 분기 테스트 갭 재확인 |
| maintainability | LOW | 이름 유사성·매직스트링·도달불가 가드 등 INFO 다수; 핵심 신규 코드는 단일 책임·가독성 우수 |
| testing | MEDIUM | `useWorkspaces` 훅 완전 미검증(WARNING) + 폴링 훅 slug-prefix 분기 유닛/e2e 모두 미검증(WARNING) |
| scope | 확인불가 | manifest 는 `success` 로 보고했으나 `scope.md` 출력 파일이 디스크에 없음 — 내용 반영 불가, 재확인 필요 |
| side_effect | 확인불가 | manifest 는 `success` 로 보고했으나 `side_effect.md` 출력 파일이 디스크에 없음 — 내용 반영 불가, 재확인 필요 |
| documentation | 확인불가 | manifest 는 `success` 로 보고했으나 `documentation.md` 출력 파일이 디스크에 없음 — 내용 반영 불가, 재확인 필요 |
| user_guide_sync | 확인불가 | manifest 는 `success` 로 보고했으나 `user_guide_sync.md` 출력 파일이 디스크에 없음 — 내용 반영 불가, 재확인 필요 |

## 발견 없는 에이전트

해당 없음 — 실제로 내용을 읽을 수 있었던 5개 에이전트(security/architecture/requirement/maintainability/testing) 모두 최소 1건 이상의 INFO 이상 발견사항을 보고했다. (scope/side_effect/documentation/user_guide_sync 4개는 출력 파일 부재로 "발견 없음"인지 자체를 판정할 수 없다 — 위 비고 참조.)

## 권장 조치사항

1. **테스트 커버리지 보강(최우선)** — `use-workspaces.test.tsx` 신규 추가(store 동기화·`enabled` 게이트·dedup 단언) + `workspace-store.test.ts` 에 `setWorkspaces` 유지/폴백 케이스 추가.
2. **cafe24/makeshop pending-polling 훅에 slug-present 케이스 추가** — `useWorkspaceStore.setState(...)` 로 non-null slug 주입 후 `/w/<slug>/integrations/<id>` 리다이렉트를 실제로 단언(유닛 최소 1건씩, 가능하면 e2e 도 검토).
3. **`buildWorkspaceHref` 오픈 리다이렉트 방어 추가** — 선두 슬래시 정규화 또는 `//` 시작 입력 명시적 거부. slug 없는 폴백 분기에도 동일 적용.
4. **워크스페이스 폴백 해소 로직 공용화** — `resolveFallbackWorkspace` 순수 함수/훅으로 추출해 `layout.tsx`·`[...rest]/page.tsx` 양쪽 DRY 위반 해소.
5. **[SPEC-DRIFT] project-planner 위임** — `spec/2-navigation/9-user-profile.md §3` 및 이동 페이지들(`15-system-status.md`/`16-agent-memory.md` 등) 본문 산문을 구현 완료 상태로 flip(plan 항목 10 실행). 코드 revert 대상 아님.
6. **프로세스 확인** — scope/side_effect/documentation/user_guide_sync 4개 reviewer 가 매니페스트 상 `success` 이나 출력 파일이 디스크에 없다. 재실행하거나 harness 로그로 원인(write 차단/누락) 확인 후 필요시 재리뷰.
7. **저우선 정리(선택)** — cafe24 `encodeURIComponent(integrationId)` 적용, `"/w/"` 매직 스트링 상수화, `params &&` 도달불가 가드 단순화, `use-page-param.test.tsx` 불필요 mock 제거.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `user_guide_sync` (9명)
  - **제외**: 표 (5명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명 — 소스 코드/spec/문서 변경이 항상 트리거하는 안전 강제 규칙에 의해 router 추천과 무관하게 포함됨)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 — 이번 diff 범위(순수 FE 라우팅/링크 빌더·문서 산출물)에 성능 영향 관점 무관 |
  | dependency | router 판단 — 신규 외부 의존성 추가 없음 |
  | database | router 판단 — DB 스키마/쿼리 변경 없음(FE-only 변경) |
  | concurrency | router 판단 — 동시성/레이스 조건 관련 백엔드 로직 변경 없음 |
  | api_contract | router 판단 — API 계약(요청/응답 스키마) 변경 없음 |

**비고(출력 파일 누락)**: `scope`/`side_effect`/`documentation`/`user_guide_sync` 4개 reviewer 는 매니페스트 상 `success` 로 보고되었으나, 대응 출력 파일(`scope.md`/`side_effect.md`/`documentation.md`/`user_guide_sync.md`)이 세션 디렉터리에 실존하지 않아(디렉터리 리스팅 확인) 본 통합 보고서에 해당 관점의 발견사항을 반영하지 못했다. 이는 reviewer 자체의 실패라기보다 write 단계의 문제일 가능성이 있다 — 재실행 또는 로그 확인 권장(§권장 조치사항 6).