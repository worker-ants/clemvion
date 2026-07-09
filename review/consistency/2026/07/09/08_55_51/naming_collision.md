# 신규 식별자 충돌 검토 — spec/2-navigation/ (워크스페이스 슬러그 라우팅, impl-done)

검토 모드: --impl-done, scope=spec/2-navigation/, diff-base=origin/main
코드 기준: HEAD 워킹트리 (`/Volumes/project/private/clemvion/.claude/worktrees/workspace-slug-routing-de2b12`)

## 확인 범위

- `git diff origin/main --stat` 전체 256 files 중 `spec/2-navigation/*.md` 13개 + `spec/data-flow/12-workspace.md`(기존 파일 절 추가) + FE 신규 코드(`lib/workspace/href.ts`·`resolve-fallback.ts`·`use-workspace-slug.ts`·`use-workspaces.ts`, `(main)/w/[slug]/layout.tsx`, `(main)/[...rest]/page.tsx`) + 대량 `git mv`(`(main)/*` → `(main)/w/[slug]/*`, 콘텐츠 무변경).
- backend 코드 diff = 0 (이번 변경은 순수 FE 라우팅 재구조화 — 신규 endpoint/entity/DTO/ENV/이벤트 없음을 diff stat 로 확인).
- 신규 요구사항 ID 패턴(`grep -E '^\+' | grep -oE '[A-Z]{2,}-[A-Z0-9]+-?[0-9]*'`) 0건.

## 발견사항

- **[INFO]** URL 세그먼트 식별자 `slug` 의 두 도메인 중복 사용 (workspace vs. docs 콘텐츠)
  - target 신규 식별자: `/w/[slug]` (workspace 식별자, `useParams<{slug:string}>()`, 단일 세그먼트 string) — `codebase/frontend/src/app/(main)/w/[slug]/layout.tsx:31-32`, `codebase/frontend/src/lib/workspace/use-workspace-slug.ts:15-21`
  - 기존 사용처: `/docs/[...slug]` (문서 콘텐츠 경로 식별자, catch-all string[]) — `codebase/frontend/src/app/(main)/docs/[...slug]/page.tsx`, spec 문서화는 `spec/2-navigation/13-user-guide.md:93,97,139` (`parseDocsRoute`, `localizedDocsHref(slug, locale)`)
  - 상세: 두 라우트가 `(main)/` 하위 형제 트리라 Next.js 빌드 타임 경로 충돌은 없다(TEST WORKFLOW 로 `route 충돌 0` 확인됨, `plan/complete/workspace-slug-routing.md` 결정 로그에 "`[slug]` vs docs `[...slug]` 파라미터 충돌은 docs 를 옮기지 않으므로 발생 자체가 없음"이라고 이미 명시적으로 검토·기각됨). 다만 동일 파라미터명 `slug` 가 완전히 다른 의미(워크스페이스 식별자 vs. 문서 페이지 식별자)로 코드베이스 전역에 공존하는 점은 향후 `grep -rn "params.slug"` 류 코드 검색이나 두 도메인을 아우르는 공용 훅을 작성할 때 타입 혼동(하나는 `string`, 하나는 `string[]`) 위험을 남긴다. `useWorkspaceSlug()` 는 `typeof params.slug === "string"` 가드로 이미 이를 방어하고 있어 실질 버그는 없음.
  - 제안: 조치 불요(이미 설계 단계에서 인지·격리됨). 다만 `spec/data-flow/12-workspace.md` 의 신규 절("URL slug = FE 라우팅 SoT")에 `plan/complete/workspace-slug-routing.md` 의 이 결정("docs `[...slug]` 와 파라미터명은 겹치나 라우트 트리가 분리돼 충돌 없음")을 1줄 Rationale 로 미러링해두면, plan 문서를 보지 않는 향후 독자도 이 트레이드오프를 spec 만으로 확인할 수 있다.

## 요약

이번 target(`spec/2-navigation/`) 변경은 순수 FE 라우팅 재구조화(`(main)/*` → `(main)/w/[slug]/*` git-mv + slug 흡수 헬퍼 4종 신규)로, backend 코드·엔티티·DTO·API endpoint·이벤트·ENV/설정키는 diff 상 전혀 추가되지 않아 해당 카테고리의 충돌 위험은 없음(요구사항 ID 신규 부여도 0건). 신규 함수/훅 이름(`buildWorkspaceHref`·`resolveFallbackWorkspace`·`useWorkspaceSlug`·`useWorkspaces`)은 모두 새 `lib/workspace/` 디렉터리에 격리돼 기존 식별자와 충돌하지 않고, `Workspace.slug` 필드도 기존 데이터 모델(§2.2)의 재사용일 뿐 신규 도입이 아니다. 유일하게 주목할 점은 URL 파라미터명 `slug` 가 기존 `/docs/[...slug]` 콘텐츠 라우트와 이름은 같으나 의미가 다른 채로 공존한다는 것인데, 이는 설계 단계에서 이미 명시적으로 검토·기각(라우트 트리 분리로 실제 충돌 없음, TEST WORKFLOW 로 빌드 충돌 0 확인)되었고 코드도 타입 가드로 방어하고 있어 INFO 수준의 문서 보강 제안 외에 실질 위험은 없다.

## 위험도
NONE
