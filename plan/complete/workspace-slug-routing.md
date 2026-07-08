---
worktree: workspace-slug-routing-de2b12
started: 2026-07-08
owner: developer
---

## Phase 1 구현 체크리스트 (2026-07-08 착수, 워크트리 de2b12)

> 접근: 한 PR(중간 상태가 빌드 불가라 슬라이스 불가). editor·auth·**docs 는 slug 밖 유지**.
> 리다이렉트 전략: `(main)/[...rest]` catch-all 클라이언트 리다이렉트가 구 무-slug 경로·알림
> 딥링크·로그인후 `/dashboard` 를 활성 slug 로 흡수(auth-group·root 코드는 무변경 — 순 효과가
> §7.2 를 만족). 내부 (main)→(main) 링크는 `buildWorkspaceHref` 로 직접 slug 화(플래시 회피).
> editor 링크(`/workflows/<id>` 정확히)는 bare 유지(phase 2).

### docs 는 phase 1 slug 밖 (결정 — Critical 해소)

**결정**: `/docs`(제품 유저 가이드)는 **워크스페이스 무관 콘텐츠**이고, 라우팅이 **서버 사이드
`redirect()`**(`docs/page.tsx`·`docs/[...slug]/page.tsx`·`localizedDocsHref`·`registry.ts`)로 절대
`/docs/<locale>/...` 를 조립한다. slug 화하려면 (a) docs `[...slug]` 파라미터를 워크스페이스
`[slug]` 와 충돌 회피 위해 리네임 + (b) 전 docs 서버 서브시스템에 워크스페이스 slug 를 스레딩해야
하는데, 워크스페이스마다 동일한 콘텐츠에 대해 리스크 대비 이득이 없다. → **docs 는 `(main)/docs`
유지**(editor·auth 처럼). `(main)/layout.tsx` 무변경으로 사이드바 chrome 은 그대로 상속, catch-all
은 specific route 우선이라 docs 를 자연 제외.

> **impl-prep(2026-07-08) Critical 해소**: consistency-check 가 잡은 유일 Critical =
> `[slug]`(`/w/[slug]`) vs docs `[...slug]` 파라미터 충돌은 **docs 를 옮기지 않으므로 발생 자체가
> 없다**(nesting 부재). 체크가 오히려 이 scope 결정을 독립 검증. 파라미터 리네임·`13-user-guide.md`
> 갱신 **불요**. 남은 findings 는 전부 plan 완결성 WARNING/pre-existing spec 갭 → §8 spec-sync 확장
> 으로 반영, FE 착수 블로커 아님. `slug` 는 이미 DB UNIQUE(`workspace.entity.ts:39`
> `@Column({unique:true})`·V001·data-flow-12 §2.1) → `/w/<slug>` 해소 무모호(WARNING#1 은
> 1-data-model §2.2 문서 갭, planner INFO). 실 재검증 게이트 = §9 `--impl-done`(코드+spec 대조).

### 링크 파일 수 (34 → 실제 편집 ~22)

raw grep 34개 절대링크 파일 중 **editor-internal `/workflows/<id>`**(dashboard·workflows page·
executions/page)·**auth-group**(callback·verify-email·login/register-form)·**docs-internal**
(registry·locale-sync·scope-list-panel `/docs/...`)는 bare 유지 → **편집 대상 ~22 파일**.

- [x] 0. consistency-check --impl-prep — BLOCK:YES(Critical 1) → **docs-exclusion 으로 해소**(위 참조). WARNING 은 §8 확장으로 흡수
- [x] 1. helper: `buildWorkspaceHref`(null-safe)·`useWorkspaceSlug`·`useWorkspaces` (+unit 8)
- [x] 2. git mv 26 페이지(docs 제외) `(main)/*` → `(main)/w/[slug]/*` (순수 rename 검증)
- [x] 3. `(main)/w/[slug]/layout.tsx` (resolve+reconcile gate); `(main)/layout.tsx` 무변경 (+unit 4)
- [x] 4. `(main)/[...rest]/page.tsx` catch-all 리다이렉트(query/hash 보존) (+unit 5)
- [x] 5. 내부 (main) 링크 slug 화(~27파일, buildWorkspaceHref; editor `/workflows/<id>`·auth·docs bare)
- [x] 6. switchWorkspace 네비게이션화(sidebar·create-team·accept-invite·settings → 새 slug dashboard) (+unit)
- [x] 7. AuthProvider: pathname `/w/` 면 persisted reconcile skip(URL 우선)
- [x] 8. TEST WORKFLOW ✅ lint(0 err)·unit(5093 pass)·build(route 충돌 0, `/[...rest]`·`/docs`·`/workflows/[id]` 공존)·e2e(backend 243 + FE Playwright 44, slug-routing 4종 신규) + 링크 회귀(profile·schedules·execution-detail 테스트가 slug href 단언)
- [x] 9. /ai-review(**4라운드, 전부 Critical 0**) + fix + /consistency-check --impl-done(BLOCK:NO)로 수렴. round1 6W·round2 4W·round3 6W(**real bug**: rerun-modal 재실행 slug 누락 → fix+테스트)·round4 2W(구조 후속 defer). 조치: security open-redirect 강화(backslash/제어문자)·DRY resolveFallbackWorkspace(3소비처)·use-workspaces/setWorkspaces/slug-branch 테스트·CHANGELOG·spec 각주. 각 라운드 RESOLUTION.md 기록. (주: 초회가 주간 한도로 중단→익일 재개; reviewer disk-write 갭은 저위험 기록)
- [x] 10. spec 반영 완료: 9-user-profile §3 flip·12-workspace Rationale(슬러그 라우팅 불변식)·10-auth-flow §7.2·`_layout §2.2/§3.1` 경로표·11-error §1.3(무효 slug=FE redirect)·0-dashboard·1-workflow-list·14-execution-history·15-system-status·16-agent-memory·4-ai-assistant·13-replay-rerun bare-path 각주 + frontmatter `code:` glob 일괄 미러(코드 커밋 포함) + spec-sync-user-profile-gaps 트래커 §3 체크

## 잔여(후속, 본 PR 범위 밖)
- editor(`/workflows/[id]`) slug화 = **phase 2**. docs(`/docs`)는 워크스페이스 무관이라 slug 밖 유지(설계).
- ai-review INFO(저우선): cafe24 `encodeURIComponent` 대칭·cafe24 `lastErrorMessage` i18n·`WORKSPACE_ROUTE_PREFIX` 상수화·`useActiveWorkspace()` 상위 훅 통합 — 별도 리팩터.

# 워크스페이스 슬러그 URL 라우팅 (`/w/[slug]/...`)

> spec: `spec/2-navigation/9-user-profile.md §3` — "전환 시 URL 경로에 워크스페이스 슬러그
> 반영(예: `/w/team-alpha/workflows`). 현재 `/w/[slug]` 라우트 부재, 슬러그는 데이터 필드만."
> 추적: `spec-sync-user-profile-gaps.md` (§3 슬러그 라우팅 항목).

## 배경 / 현 모델

- **워크스페이스 컨텍스트 = store + 헤더 + 토큰** (URL 무관):
  - `useWorkspaceStore.currentWorkspaceId`(localStorage 영속) + axios 인터셉터가 `X-Workspace-Id` 헤더 첨부.
  - 전환 = `switchWorkspace(id)` → `POST /auth/workspaces/:id/switch`(access token `activeWorkspaceId` 재발급, refresh 무회전) → `currentWorkspaceId` 갱신 → `providers.tsx` 구독이 쿼리캐시 클리어 + 전환 토스트. **네비게이션 없음**.
  - backend: header-first 하이브리드(전환기 하위호환) + 토큰 클레임 fallback (#859 data-flow-12 결정, `jwt.strategy`/`RolesGuard`/`workspace.decorator`).
- **라우트**: `src/app/(main)/*` 28 페이지(dashboard·workflows·triggers·schedules·integrations·knowledge-bases·models·statistics·web-chat·workspace·profile·agent-memory·system-status·authentication·invitations·docs). `(editor)/workflows/[id]` 별도 그룹. `(auth)/*` 로그인류.
- **내부 링크/네비**: `href="/..."` / `router.push("/...")` **34개 파일**에 산재(예: `href={\`/workflows/${id}\`}`).
- **middleware 없음**(`src/middleware.ts` 부재).
- `Workspace.slug` 필드는 store 타입·API 에 존재(데이터로만 사용).

## 목표 모델

- URL 이 활성 워크스페이스의 **단일 진실**: `/w/<slug>/workflows`, `/w/<slug>/triggers`, ….
- `/w/[slug]` 진입 시 layout 이 slug→워크스페이스 해소 + **멤버십 검증** + 활성 전환(store + 토큰 switch 정합) + 사이드바 데이터 스코프.
- 전환 = 새 slug URL 로 **네비게이션**(현재 store-only → route push).
- deep-link/북마크가 워크스페이스를 담아 공유 가능.

## 규모 (⚠ 대형 — 다중 PR 권장)

- 28 페이지 route-group 재배치 + 34 링크-파일 prefix 마이그레이션 + 신규 `[slug]` 해소 layout + redirect(구경로·`/`) + `switchWorkspace` 네비게이션화 + (선택) middleware + e2e/링크 회귀. **ripple 광범위**.

## 결정 확정 (2026-07-08 planner 분석 — #4 blocker 해소)

### ✅ #4 (토큰/헤더/URL 3중 소스) — **해소: 3중 소스 아님**
- **핵심**: URL slug 는 **backend 소스가 아니라 FE 라우팅 SoT** 다. `[slug]` 가 slug→워크스페이스 ID 로 해소해 **기존 흐름**(`store.currentWorkspaceId` → axios `X-Workspace-Id` 헤더(`client.ts:52-62`) + `switchWorkspaceApi` 토큰 재발급)을 구동할 뿐이다.
- **backend 무변경**: `WorkspaceId` 데코레이터·`RolesGuard` 는 그대로 header-first(`X-Workspace-Id`) → 토큰 클레임(`activeWorkspaceId` dual-read). 헤더가 URL-slug 에서 유래하는 값으로 바뀔 뿐, 우선순위/멤버십 검증(RolesGuard 403) 불변 → **#859 격리 모델·Rationale 무번복, 격리 회귀 위험 없음**.
- **localStorage**: 런타임 SoT → **초기 redirect 힌트**(`/` → `/w/<last-slug>/`)로 격하.
- **비멤버/무효 slug**: `[slug]` layout 이 해소 실패 시 사용자 default 워크스페이스 slug 로 redirect. 헤더 스푸핑은 backend RolesGuard 가 이미 403.

### 확정 (구현 기본값 — consistency-check --spec 2026-07-08 반영)
1. **route 구조**: `app/(main)/w/[slug]/...` 로 28 페이지 이동, `(main)/w/[slug]/layout.tsx` 가 slug 해소. **`(editor)`·`(auth)` 는 phase 1 slug 밖 유지**(에디터는 workflow id 로 스코프, 딥링크 redirect). editor slug화는 phase 2.
2. **redirect**: 구 무-slug 경로(`/workflows` 등)·`/` → 활성 slug 로 redirect. **주의: `src/proxy.ts`(Next 서버 미들웨어, 10-auth-flow §7.1)가 이미 존재** — "middleware 없음" 은 오기. Edge proxy 는 localStorage(활성 워크스페이스 SoT)를 못 읽으므로: **phase 1 = client `(main)` root layout 에서 redirect**(redirect-only 경로라 flash 허용) 또는 phase 2 = `has_session` 패턴의 **workspace-slug 힌트 쿠키** 추가(그때 data-flow-12 에 쿠키 정의). 알림 딥링크(`/workflows/<id>`)도 redirect 흡수(안전 — 알림은 항상 발사 시점 활성 워크스페이스 스코프, 8-notifications §1). 신규 링크는 slug-aware `buildWorkspaceHref(slug, path)` 헬퍼로 하드코딩 제거.
3. **slug 불변**: `workspace.slug` 는 **생성 시 `team-<uuid8>` 로 확정·이후 불변**(9-user-profile §4 "읽기 전용", `renameWorkspace` 는 name-only). **rename 이 URL 을 바꾸지 않음** → rename-redirect 불요(딥링크 안정). slug 는 이미 `GET /api/workspaces` 응답에 포함(확인) → backend 추가 불요.
4. **cold-load reconcile 방향 = URL 우선**: `[slug]` layout mount 시 resolved-id ≠ store/token 활성 id 면 **URL 이 우선**해 `switchWorkspace(resolvedId)` 로 store/token 재조정. (data-flow-12 §1.5 의 기존 reconcile-on-load(store 우선)를 "URL 있으면 URL 우선, 없으면 localStorage" 로 갱신 — 레이스 방지.)
5. **FE 멤버십 체크 = UX 전용**: `[slug]` layout 의 비멤버/무효 slug → default 워크스페이스 redirect 는 **UX 편의이며 인가 경계 아님**. 유일 강제 지점은 backend `RolesGuard`(403).

### ✅ #4 검증 (consistency-check --spec, rationale-continuity LOW)
- URL slug(FE 라우팅 SoT) vs 토큰 클레임(backend 인가 SoT)은 **계층이 다름** → #859 무번복. #859 가 실제 기각한 건 **token-first**(격리 회귀 → header-first 로 되돌림, commit `0ae4dad0e`).
- ⚠ **구현 가드**: `X-Workspace-Id` 헤더 첨부(`client.ts`)는 **어떤 최적화로도 제거 금지** — token-first 는 이미 격리 회귀로 기각된 사례. slug 라우팅은 헤더 첨부 지속 전제로 설계됨(헤더 제거는 본 범위 밖 별도 결정).

> **Next.js 주의**: `codebase/frontend/AGENTS.md` — 커스텀 Next.js. route group·layout·redirect·`proxy.ts` API 는 `node_modules/next/dist/docs/` 확인 후 작성.

## 구현 단계 (제안)

1. ~~**결정 확정**~~ ✅ 완료(2026-07-08 consistency-check --spec — #4 검증 LOW·번복 없음, 5항 확정).
2. `[slug]` 해소 layout + 워크스페이스 slug 조회(backend 응답에 slug 포함 확인/추가).
3. route-group 재배치(28 페이지) — `git mv` 로 history 보존, `git show` 검증.
4. 링크 마이그레이션(34 파일) — slug-aware `href` 헬퍼(`buildWorkspaceHref(slug, path)`) 도입해 하드코딩 절대경로 제거.
5. `switchWorkspace` → 새 slug 로 `router.push` + 토큰 switch 정합(순서: switch 성공 후 navigate).
6. redirect(구경로·`/` → 활성 slug) — middleware or root layout.
7. 알림 딥링크(`href.ts`) slug-aware or redirect 흡수.
8. spec 정합(planner): 9-user-profile §3 flip + **1-auth/data-flow-12 Rationale 보강**(URL slug=FE 라우팅 SoT≠backend 인가 SoT·header 유지 불변식·FE 멤버십=UX전용·reconcile URL 우선) + **10-auth-flow §7.2**(로그인 기본 redirect `/dashboard`→`/w/<slug>/dashboard`) + §1.5 reconcile 문구 갱신.
9. TEST: unit(라우팅/링크헬퍼/switch navigate) + e2e(전환→URL 반영·deep-link·redirect) + 링크 회귀.
10. /ai-review + /consistency-check --impl-done.

## 리스크

- **광범위 ripple**: 34 링크-파일 중 하나라도 누락 시 broken link(테스트 커버 필수 — slug-aware 헬퍼로 하드코딩 제거해 회귀 표면 축소).
- **3중 워크스페이스 소스**(URL slug / 헤더 / 토큰) 우선순위 미정의 시 격리 회귀(#859 e2e 워크스페이스 격리 회귀 선례) — 착수 전 정합 필수.
- 딥링크/북마크/알림 링크 하위호환.
- SSR/hydration + Next.js route-group 이동 시 layout 경계 변화.

## 비고

- **착수 전 결정 = 완료** (2026-07-08 consistency-check --spec: rationale-continuity LOW·번복 없음, cross-spec MEDIUM·CRITICAL 0 — 3 gap[proxy.ts middleware·slug 불변·reconcile 방향]을 위 §확정 에 반영). backend spec/코드 변경 불요(FE-only). 이제 구현 착수 가능.
- **구현은 대형 FE 재구조화**(28 페이지·34 링크·[slug] layout·redirect·switch 네비게이션) — 리스크 표면상 별도 focused 세션에서 phase 1(main 페이지 slug화 + redirect + switch) 착수 권장. 결정이 잠겼으므로 그 세션은 구현에 집중 가능.
- consistency 산출: `review/consistency/` 미기록(직접 Agent fan-out) — 본 plan §확정/§#4검증 이 결정 기록. spec 반영은 §8(구현 PR 동반).
