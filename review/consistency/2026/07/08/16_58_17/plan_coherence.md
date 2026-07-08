# Plan 정합성 검토 — spec/2-navigation/ (--impl-prep)

## 검토 대상
- Target: `spec/2-navigation/**` (18개 파일)
- 핵심 plan: `plan/in-progress/workspace-slug-routing.md` (본 worktree 의 착수 대상 — `/w/[slug]/...` URL 라우팅, 28 페이지 `(main)/*` → `(main)/w/[slug]/*` 이동)
- 참고: 전달된 prompt payload 의 "plan/in-progress 문서 모음" 섹션은 크기 제한으로 잘려 `workspace-slug-routing.md` 자체를 포함한 다수 plan 이 누락되어 있었다. 실제 `plan/in-progress/` 디렉터리를 직접 조회해 보완했다.

## 발견사항

- **[WARNING]** spec 반영 체크리스트가 실제 영향 범위보다 크게 좁음 — `_layout.md`/`11-error-empty-states.md`/`13-user-guide.md` 등이 누락
  - target 위치: `spec/2-navigation/_layout.md` §2.2(13개 메뉴 항목 경로 표, `/dashboard`·`/workflows`·`/triggers`·… 13종 bare path) · §3.1(알림 딥링크 라우트 표, `/integrations/<id>`·`/workflows/<id>`·`/profile`) · `spec/2-navigation/11-error-empty-states.md` frontmatter `code:` (`(main)/dashboard/page.tsx` 등 6개 리터럴 경로) 및 Rationale("대시보드(`/dashboard`)로 보낸다") · `spec/2-navigation/13-user-guide.md` §3(`/docs/[...slug]` 3-세그먼트 라우트 서술) + frontmatter `code:`(`(main)/docs/[...slug]/page.tsx`) · `spec/2-navigation/0-dashboard.md` §5("`/workflows/:workflowId/executions/:executionId`") · `spec/2-navigation/1-workflow-list.md` §2.6("`/workflows/:id/executions`") · 그리고 `0-dashboard`/`1-workflow-list`/`14-execution-history`/`15-system-status`/`16-agent-memory`/`2-trigger-list`/`3-schedule`/`4-integration`/`5-knowledge-base`/`6-config`/`7-statistics`/`9-user-profile` frontmatter `code:` 전체(예: `codebase/frontend/src/app/(main)/dashboard/page.tsx`)
  - 관련 plan: `plan/in-progress/workspace-slug-routing.md` Phase 1 체크리스트 항목 10 / "구현 단계" 항목 8 — "spec 반영(planner 위임): 9-user-profile §3 flip·12-workspace Rationale·10-auth-flow §7.2" 로 **3개 문서만** 명시
  - 상세: 계획 항목 2("git mv 28 페이지 `(main)/*` → `(main)/w/[slug]/*`")가 실행되면, 위에 나열한 문서들이 이미 서술하고 있는 bare 경로(`/dashboard`, `/workflows`, `/profile`, `/integrations/<id>` 등)와 frontmatter `code:` 리터럴/glob 경로가 전부 옛 위치를 가리키게 된다. 두 갈래 영향이 있다:
    (a) **build-gate 즉시 실패**: `status ∈ {partial, implemented}` spec 의 `code:` 글로브가 ≥1 파일 매치해야 하는 `spec-code-paths.test.ts`(spec-impl-evidence 컨벤션 §4)가, `(main)/profile/**` 같은 glob 이 이동 후 경로 `(main)/w/[slug]/profile/**` 와 세그먼트 불일치로 매치 실패해 깨진다 — 이는 계획 항목 8(TEST WORKFLOW·unit)이 실행되면 스스로 드러나 self-correcting 이지만, 체크리스트가 "9-user-profile·10-auth-flow 2건만" 이라 스코프를 과소평가하게 만든다.
    (b) **본문 prose 의 조용한 stale화(자동 검출 불가)**: `_layout.md` 는 밑줄 prefix 라 spec-impl-evidence 의 frontmatter/`code:` 가드 대상에서 **명시적으로 제외**(`spec-impl-evidence.md §1`)된다. 즉 §2.2 메뉴 경로 표·§3.1 알림 딥링크 표가 구현 후에도 옛 bare 경로를 계속 서술해도 **어떤 build 가드도 잡지 못한다**. 마찬가지로 `11-error-empty-states.md` Rationale 의 "대시보드(`/dashboard`)로 보낸다"·`0-dashboard.md`/`1-workflow-list.md` 의 실행 상세 경로 서술도 텍스트일 뿐이라 가드 대상이 아니다.
  - 제안: `workspace-slug-routing.md` 의 "구현 단계" §8(spec 반영) 을 최소 아래로 확장: (i) `spec/2-navigation/**` 전체의 frontmatter `code:` glob 을 `(main)/w/[slug]/...` 기준으로 일괄 정정(또는 `(main)/w/[slug]/**` 상위 glob 채택 검토), (ii) `_layout.md §2.2`/`§3.1` 의 경로 표 전체를 slug-aware 서술로 갱신(또는 "실제 URL 은 `buildWorkspaceHref` 로 slug 프리픽스가 붙는다"는 각주 추가), (iii) `11-error-empty-states.md` Rationale·`13-user-guide.md` §1/§3·`0-dashboard.md` §5·`1-workflow-list.md` §2.6 의 bare-path 서술 정정. 항목 0("consistency-check --impl-prep")의 스코프도 "9-user-profile·12-workspace·10-auth-flow" 3건에서 `spec/2-navigation/` 전체로 넓혀야 이 gap 이 사전에 잡힌다(본 리뷰가 그 넓은 스코프로 수행된 것과 동일 결론).

- **[INFO]** `spec-sync-user-profile-gaps.md` 트래커 체크박스 갱신이 계획에 명시돼 있지 않음
  - target 위치: `spec/2-navigation/9-user-profile.md` frontmatter `pending_plans: [plan/in-progress/spec-sync-user-profile-gaps.md]`
  - 관련 plan: `plan/in-progress/spec-sync-user-profile-gaps.md` 미구현 항목 "워크스페이스 전환 시 슬러그 URL 라우팅 (§3 `/w/[slug]/...`) — frontend: 별도 frontend PR" (체크박스 미체크 `[ ]`)
  - 상세: 같은 트래커의 다른 항목들(알림 설정·테마 System)은 완료 시 이 파일 안에서 `[x]` + 완료 노트로 갱신되는 패턴을 따랐다. `workspace-slug-routing.md` 의 체크리스트에는 이 트래커 파일을 완료 시점에 갱신(체크박스 + 잔여 항목 재계산, 전량 완료 시 `9-user-profile.md` status 승격 여부 확인)한다는 단계가 없다 — spec-status-lifecycle 가드가 "모든 pending_plans 가 complete 로 이동하면 implemented 로 승격 의무"를 강제하므로, 이 항목 하나만으로 status 승격이 되는 건 아니지만(다른 미구현 항목 — 아바타 업로드·일일 요약 토글 — 잔존) 트래커 정합을 위해 명시가 필요하다.
  - 제안: `workspace-slug-routing.md` §8/§10 spec 반영 단계에 "spec-sync-user-profile-gaps.md 슬러그 라우팅 항목 체크 + 잔여 항목 재확인" 1줄 추가.

- **[INFO]** 계획 문서 내부 수치 불일치 (target-plan 정합과는 무관, plan 자체 정확도)
  - target 위치: 해당 없음 (plan 자체 이슈)
  - 관련 plan: `plan/in-progress/workspace-slug-routing.md` "배경/현 모델" 절("href=\"/...\" ... **34개 파일**에 산재") vs Phase 1 체크리스트 항목 5("내부 (main) 링크 slug 화(**~24파일**, buildWorkspaceHref)")
  - 상세: 같은 문서 안에서 마이그레이션 대상 링크 파일 수가 34 vs ~24 로 불일치. 구현 중 실제 카운트로 수렴되겠지만, 완료 후 리뷰(ai-review/impl-done)에서 "34개 중 일부 누락" 식 오탐 판단 근거로 쓰일 수 있어 사전 정정 권장.
  - 제안: 실제 대상 파일 수를 재계산해 두 숫자를 통일.

## 요약
가장 실질적인 gap 은 `workspace-slug-routing.md` 의 "spec 반영" 단계가 9-user-profile/10-auth-flow 2~3개 문서만 명시하고 있는 반면, 실제로는 `spec/2-navigation/` 사실상 전체(특히 밑줄 prefix 라 build 가드 대상에서 제외되는 `_layout.md` 의 메뉴·알림 딥링크 경로 표)가 bare path 를 서술하고 있어 구현 후 조용히 stale 해질 위험이 크다는 점이다. `code:` frontmatter 쪽은 build-time 가드(`spec-code-paths.test.ts`)가 TEST WORKFLOW 단계에서 강제로 잡아주지만, `_layout.md`/Rationale 산문 서술은 어떤 가드도 잡지 못하므로 계획의 spec-reflection 스코프를 명시적으로 넓혀야 한다. 그 외 미해결 결정 충돌이나 선행 plan 미해소는 발견되지 않았다 — 관련 plan(`spec-sync-user-profile-gaps.md`, `spec-sync-workflow-list-gaps.md`, `spec-sync-auth-gaps.md` 등)과 워크스페이스/인증 메커니즘을 동시에 건드리는 다른 in-progress plan 은 없다.

## 위험도
MEDIUM
