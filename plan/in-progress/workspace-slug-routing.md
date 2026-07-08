---
worktree: workspace-slug-routing-08a15a
started: 2026-07-08
owner: developer
---

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

## 결정 필요 (착수 전)

1. **route 구조**: (a) `app/w/[slug]/(main)/...` 로 `(main)` 트리 이동 vs (b) `app/(main)/w/[slug]/...`. `(editor)`·`(auth)` 는 slug 밖 유지? 에디터도 워크스페이스 스코프이므로 `/w/[slug]/workflows/[id]/edit` 로 넣을지.
2. **하위호환/redirect**: 구 `/workflows` 등 무-slug 경로 진입 시 → 활성 slug 로 redirect(middleware or layout). 북마크·외부링크·알림 딥링크(`href.ts` `/workflows/<id>`) 전부 재작성 or redirect 흡수?
3. **slug SoT**: slug 유일성·불변성(rename 시 URL 변경)·해소 실패(멤버 아님·삭제) UX(403/전환). backend `slug` 조회 엔드포인트/포함 응답 확인.
4. **토큰/헤더 모델과의 관계**: URL slug 가 SoT 가 되면 `X-Workspace-Id` 헤더/토큰 클레임과 3중 소스. 우선순위 재정의(#859 header-first 와 충돌 여부) — **planner + 1-auth/§data-flow-12 정합 검토 선행**.
5. **알림 딥링크**(`href.ts` `/workflows/<resource_id>`, `_layout.md §3.1`) — slug 없는 절대경로. slug-redirect 로 흡수 or href.ts 를 slug-aware 로.

## 구현 단계 (제안)

1. **결정 확정**(위 5항, planner 검토 — 특히 4·토큰 모델 정합).
2. `[slug]` 해소 layout + 워크스페이스 slug 조회(backend 응답에 slug 포함 확인/추가).
3. route-group 재배치(28 페이지) — `git mv` 로 history 보존, `git show` 검증.
4. 링크 마이그레이션(34 파일) — slug-aware `href` 헬퍼(`buildWorkspaceHref(slug, path)`) 도입해 하드코딩 절대경로 제거.
5. `switchWorkspace` → 새 slug 로 `router.push` + 토큰 switch 정합(순서: switch 성공 후 navigate).
6. redirect(구경로·`/` → 활성 slug) — middleware or root layout.
7. 알림 딥링크(`href.ts`) slug-aware or redirect 흡수.
8. spec §3 flip + 1-auth/data-flow-12 슬러그 SoT 정합(planner).
9. TEST: unit(라우팅/링크헬퍼/switch navigate) + e2e(전환→URL 반영·deep-link·redirect) + 링크 회귀.
10. /ai-review + /consistency-check --impl-done.

## 리스크

- **광범위 ripple**: 34 링크-파일 중 하나라도 누락 시 broken link(테스트 커버 필수 — slug-aware 헬퍼로 하드코딩 제거해 회귀 표면 축소).
- **3중 워크스페이스 소스**(URL slug / 헤더 / 토큰) 우선순위 미정의 시 격리 회귀(#859 e2e 워크스페이스 격리 회귀 선례) — 착수 전 정합 필수.
- 딥링크/북마크/알림 링크 하위호환.
- SSR/hydration + Next.js route-group 이동 시 layout 경계 변화.

## 비고

- 본 plan 은 **착수 전 결정(특히 §4 토큰/헤더/URL 3중 소스 우선순위)** 이 planner 검토를 요하므로, 코드 착수는 그 정합 확정 후. 세션 규모상 별도 focused 세션 권장.
