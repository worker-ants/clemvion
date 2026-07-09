# 신규 식별자 충돌 검토 결과

검토 모드: `--impl-prep` (scope=`spec/2-navigation/`) — 워크스페이스 슬러그 URL 라우팅(`/w/[slug]/...`) 구현 착수 전 점검. target 은 아직 미수정 기존 spec(§`2-navigation/*`, 구현 대상 배경 문서)이며, 실제 "신규 식별자"는 `plan/in-progress/workspace-slug-routing.md` 에 정의된 구현 계획에서 도출된다.

## 발견사항

- **[CRITICAL]** 신규 라우트 세그먼트 `[slug]` 가 기존 `/docs` catch-all 파라미터 `[...slug]` 와 중첩 위치에서 동일 파라미터명으로 충돌
  - target 신규 식별자: `plan/in-progress/workspace-slug-routing.md` 가 도입하는 Next.js 동적 세그먼트 `app/(main)/w/[slug]/...` (워크스페이스 슬러그를 나타내는 문자열 파라미터 `slug`)
  - 기존 사용처: `spec/2-navigation/13-user-guide.md` — frontmatter `code:` (7행) `codebase/frontend/src/app/(main)/docs/[...slug]/page.tsx`, 본문 §1(27행) "`[...slug]/page.tsx`", §3(93행) "단일 catch-all `/docs/[...slug]` 라우트가 모든 문서 URL 을 처리한다"
  - 상세: 28페이지 route-group 재배치 이후 `docs/*` 페이지는 `(main)/w/[slug]/docs/[...slug]/page.tsx` 로 새 워크스페이스 슬러그 세그먼트 아래에 중첩된다. 같은 이름(`slug`) 의 동적 세그먼트가 상위(워크스페이스 slug, 단일 string)와 하위(문서 canonical 경로, catch-all string[]) 양쪽에 존재하면 Next.js 가 병합하는 `params` 객체에서 `slug` 키가 하위 catch-all 값으로 덮여, 상위 워크스페이스 slug 를 같은 키로 참조하는 코드(`useParams().slug` 등)가 오염된 값을 읽을 수 있다 — 의미가 다른 두 개념(워크스페이스 식별자 vs 문서 경로)이 같은 식별자명을 두고 경합하는 전형적 충돌.
  - **plan 자체가 이미 인지·완화**: `workspace-slug-routing.md` 상단 요약(10~14행)에 "docs catch-all 파라미터 `[...slug]`→`[...path]` 리네임(워크스페이스 `[slug]` 와 충돌 회피)" 이 명시돼 있어 구현자가 이 충돌을 알고 코드 레벨에서 rename 하기로 결정한 상태다. 다만 **plan 의 spec-sync 스코프(TL;DR 체크리스트 10번, "구현 단계" §8)가 `9-user-profile §3` · `data-flow/12-workspace Rationale` · `10-auth-flow §7.2/§1.5` 세 곳만 나열**하고 `13-user-guide.md` 의 frontmatter `code:` 경로(7행)·본문(27행·93행) 갱신을 포함하지 않는다. 코드에서 rename 이 반영돼도 spec 갱신 항목에 없으면 `13-user-guide.md` 가 실제 파일 경로/라우트명과 어긋난 채(`[...slug]` 잔존) 남을 위험이 있다.
  - 제안: plan 의 spec-sync 스텝(TL;DR #10, "구현 단계" §8)에 `13-user-guide.md`(frontmatter `code:` `docs/[...slug]` → `docs/[...path]`, 본문 §1·§3 의 `[...slug]` 표기 갱신)를 명시적으로 추가. 구현 시에도 rename 을 반영하는 커밋에 동봉해 spec-code drift 를 원천 차단.

- **[INFO]** URL 세그먼트 `/w/<slug>/workspace` — "workspace" 개념 이중 표기로 혼동 소지
  - target 신규 식별자: `(main)/w/[slug]/*` 프리픽스(워크스페이스 슬러그 라우팅 축약 `w`)
  - 기존 사용처: `codebase/frontend/src/app/(main)/workspace/` (워크스페이스 설정 페이지, 그대로 `(main)/w/[slug]/workspace/*` 로 이동 예정)
  - 상세: 최종 URL 이 `/w/team-alpha/workspace/...` 형태가 되어, 워크스페이스를 가리키는 두 표기(`w` 축약 프리픽스, `workspace` 설정 페이지 세그먼트)가 한 경로에 동시에 등장한다. 기능적 충돌(라우팅 정의 상 문제)은 아니나 사용자·문서 독자 입장에서 "w"와 "workspace"가 다른 대상을 가리키는지 혼동 가능.
  - 제안: 명명 자체를 바꿀 필요는 없으나(스코프상 변경 범위 밖), planner 가 §8 spec 반영 시 `9-user-profile.md`/`_layout.md` 예시 URL 문구에 `/w/<slug>/workspace/...` 형태를 명시적으로 한 번 보여줘 혼동 여지를 미리 해소할 것을 권장.

- **[INFO]** 신규 hook 명 `useWorkspaceSlug()` / `useWorkspaces()` 가 기존 `useWorkspaceStore` 와 이름이 유사해 혼동 가능(충돌 아님)
  - target 신규 식별자: plan TL;DR #1 `useWorkspaceSlug()` · `useWorkspaces()`
  - 기존 사용처: `codebase/frontend/src/lib/stores/workspace-store.ts:36` `export const useWorkspaceStore = create<WorkspaceState>()(...)`
  - 상세: 세 이름(`useWorkspaceStore`, `useWorkspaceSlug`, `useWorkspaces`) 이 모두 "workspace" 어근을 공유하고 단수/복수·의미(전체 store 접근 vs 현재 slug 파생값 vs 목록)가 미묘하게 달라 import 시 자동완성 오선택 위험이 있다. 실제 이름 충돌(동일 식별자 재사용)은 아니므로 CRITICAL/WARNING 대상은 아니다.
  - 제안: 구현 시 각 hook 상단에 1줄 JSDoc으로 역할을 구분(예: `useWorkspaceSlug` = 현재 URL 의 활성 slug 파생, `useWorkspaces` = 멤버십 워크스페이스 목록, `useWorkspaceStore` = 레거시/전역 상태 store)해 두면 충분.

기타 관점(요구사항 ID, API endpoint, 이벤트/메시지명, 환경변수·설정키)에서는 신규 도입 예정 식별자가 확인되지 않았거나(backend 무변경·신규 endpoint 없음), 확인된 범위에서 충돌이 발견되지 않았다. `Workspace.slug` 생성 규칙이 personal(`10-auth-flow.md §6.2`: 이메일 로컬파트+랜덤4자리)과 team(`data-flow/12-workspace.md:40`: `team-<uuid8>`)에서 서로 다른 점은 워크스페이스 **타입별** 규칙 차이이며 동일 식별자의 의미 충돌이 아니다(신규 결함 아님).

## 요약

핵심 발견은 신규 라우트 파라미터 `[slug]`(`/w/[slug]`)가 기존 `/docs/[...slug]` catch-all 파라미터와 중첩 시 동일 이름으로 경합하는 실질적 식별자 충돌이며, 이는 이미 구현 계획(`workspace-slug-routing.md`) 스스로가 인지해 `[...path]` 로 rename 하기로 결정한 상태다. 다만 그 rename 결정이 spec-sync 체크리스트(TL;DR #10 / §8)에 `spec/2-navigation/13-user-guide.md` 갱신 항목으로 반영되어 있지 않아, 코드가 rename 된 이후에도 spec 이 구 파라미터명(`[...slug]`)을 계속 서술하는 spec-code drift 로 남을 잔여 위험이 있다. 그 외 hook 명 유사성·URL 이중 표기는 실제 충돌이 아닌 명명 명료성 수준의 INFO 다. backend API·이벤트·환경변수 영역은 이번 phase 1(FE-only, backend 무변경)에서 신규 식별자가 없어 해당 없음.

## 위험도

MEDIUM
