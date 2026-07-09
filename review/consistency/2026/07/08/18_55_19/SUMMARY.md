# Consistency Check 통합 보고서

**BLOCK: NO**

## 전체 위험도
**LOW** — Critical 없음. 워크스페이스 슬러그 URL 라우팅(`/w/[slug]/**`) 마이그레이션은 핵심 결정(URL slug = FE 라우팅 SoT, backend header-first 불변, slug 불변, reconcile URL 우선)을 25개 spec 파일에 일관되게 반영했고, 남은 이슈는 전부 문서 완결성 수준(WARNING 2건)과 참고성(INFO 4건)이다.

## 프로세스 경고 — checker 2건 결과 파일 부재 (재시도 필요)

- `rationale_continuity` 와 `convention_compliance` 는 workflow manifest 상 `status=success` 로 보고되었으나, 지정된 `output_file`(`rationale_continuity.md`, `convention_compliance.md`)이 실제 디렉터리에 존재하지 않아 Read 불가 — **본 통합 보고서는 이 두 checker 의 발견사항을 반영하지 못했다.** (`_prompts/` 하위에 동명의 *prompt* 파일만 존재하며 이는 출력이 아니다.)
- **재시도 필요**: `rationale_continuity`, `convention_compliance` 두 checker 를 재실행해 실제 output 파일 생성 여부를 확인할 것. 재실행 전까지 본 통합본은 Rationale 연속성·Convention 준수 축의 판단이 누락된 상태임에 유의.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | 무효/비멤버 워크스페이스 slug 처리와 기존 403/404 에러 페이지 정책의 관계가 문서화되지 않음 — 이 문서만 보면 "존재하지 않는 slug = 404" 로 오해 가능 | `spec/2-navigation/11-error-empty-states.md` §1.2/§1.3 (frontmatter `code:` 만 slug 로 갱신, 본문 무변경) | `spec/2-navigation/9-user-profile.md` §3 (신설 — 무효/비멤버 slug 는 default 워크스페이스로 조용히 redirect, 인가 경계 아님) + 실 구현 `codebase/frontend/src/app/(main)/w/[slug]/layout.tsx`(`resolveFallbackWorkspace`) | `11-error-empty-states.md` §1.3 에 "워크스페이스 slug 해석 실패(무효/비멤버)는 404/403 이 아니라 FE 레벨 편의 redirect (인가 경계 아님, → 9-user-profile.md §3)" 각주 추가. 코드 변경 불요 |
| 2 | plan_coherence + cross_spec (통합) | 슬러그 마이그레이션 URL 산문 갱신 스윕이 형제 문서 간 불균일 — 일부는 frontmatter `code:` 만 바뀌고 본문 bare-path URL 산문은 그대로 | `spec/2-navigation/0-dashboard.md` §1/§4/§5, `1-workflow-list.md` §2.6 (plan item 10 이 명시적으로 지목, 아직 `[ ]`) 및 `spec/3-workflow-editor/4-ai-assistant.md` §4.1.2, `spec/5-system/13-replay-rerun.md` (plan 미추적, cross-spec 이 추가 발견) | 이미 slug 각주 처리된 형제 문서: `14-execution-history.md`, `15-system-status.md`, `16-agent-memory.md`, `_layout.md` §2.2/§3.1 | 4개 파일 전부에 형제 문서와 동일한 "활성 워크스페이스 slug 기준(`/w/<slug>/...`, cf. `_layout.md §2.2`)" 각주 추가 후 plan item 10 체크, 또는 의도적 미완결이면 plan 비고/spec Rationale 에 근거 기록 후 재스코프. 기능 영향 없음(catch-all 흡수로 런타임 정상) — 순수 문서 동기화 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | 이번 checker 에 전달된 target 문서 번들(7개)이 실제 diff 범위(25개 spec 파일)보다 좁아, 핵심 결정문(`9-user-profile.md §3`, `data-flow/12-workspace.md` 신규 Rationale)이 payload 에 누락됨 (checker 가 워킹트리 직접 diff 로 보완) | 프로세스 노트 — 특정 spec 파일 아님 | 다음 회차부터 orchestrator 가 target 번들 선정 시 `git diff --stat`(diff-base 기준) 전체를 포함하도록 점검 |
| 2 | naming_collision | 라우트 파라미터명 `slug` 가 워크스페이스 식별자(`w/[slug]`, `string`)와 기존 문서 경로(`docs/[...slug]`, `string[]`)라는 이질적 두 개념에 재사용됨. 부모 세그먼트가 달라 실제 라우팅 충돌 없음(빌드 route 충돌 0 실증), plan impl-prep 단계에서 이미 Critical 후보로 검토·해소됨 | `codebase/frontend/src/app/(main)/w/[slug]/**` vs `codebase/frontend/src/app/(main)/docs/[...slug]/page.tsx` | 조치 불요 (선택: 온보딩 문서에 "slug 의미 이원화" 한 줄 남기면 좋음) |
| 3 | naming_collision | 헬퍼 파일 베이스네임 `href.ts` 가 두 디렉터리에 중복 존재 — import 경로·export 함수명은 명확히 달라 실질 충돌 없음 | `codebase/frontend/src/lib/workspace/href.ts`(`buildWorkspaceHref`) vs `codebase/frontend/src/lib/notifications/href.ts`(`notificationHref`) | 조치 불요 (선택: `workspace-href.ts`/`notification-href.ts` 컨벤션 고려) |
| 4 | naming_collision | 훅 3종(`useWorkspaceStore`/`useWorkspaceSlug`/`useWorkspaces`)이 `useWorkspace*` 접두어를 공유해 표면적 혼동 가능 — 신규 두 훅 JSDoc 에 이미 상호 참조 명시로 완화됨 | `lib/stores/workspace-store.ts`, `lib/workspace/use-workspace-slug.ts`, `lib/workspace/use-workspaces.ts` | 조치 불요 — 이미 문서화로 완화됨 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 25개 spec 실사 결과 CRITICAL 없음. 무효/비멤버 slug 의 404/403 정책 미문서화(WARNING), 타 영역 2건 bare-path 잔존(INFO), payload 번들 협소(프로세스 INFO) |
| rationale_continuity | 재시도 필요 | output 파일 부재로 판단 불가 |
| convention_compliance | 재시도 필요 | output 파일 부재로 판단 불가 |
| plan_coherence | LOW | plan 의 5개 확정 결정 우회·번복 없음. plan item 10 이 지목한 `0-dashboard.md`/`1-workflow-list.md` bare-path 잔존만 유일한 갭(WARNING). 타 in-progress plan 과의 충돌 없음 |
| naming_collision | LOW | backend/API/ENV 변경 없음(FE-only 확인). `slug` 파라미터 재사용·`href.ts` 중복·`useWorkspace*` 훅 유사성 모두 실질 충돌 없이 INFO 수준, 대부분 이미 plan/JSDoc 으로 완화됨 |

## 권장 조치사항
1. (BLOCK 아님, 우선 권장) `rationale_continuity`·`convention_compliance` 두 checker 재실행 — output 파일 미생성으로 이번 통합본에서 두 축의 판단이 누락됨.
2. `0-dashboard.md`/`1-workflow-list.md`/`3-workflow-editor/4-ai-assistant.md`/`5-system/13-replay-rerun.md` 4개 파일에 형제 문서 동일 slug 각주 추가 후 plan item 10 체크 처리 (또는 재스코프 근거 기록).
3. `11-error-empty-states.md` §1.3 에 무효/비멤버 slug → FE redirect(인가 경계 아님) 각주 1줄 추가, `9-user-profile.md §3` 상호 참조.
4. 나머지 INFO 4건은 조치 불요 — 참고만.