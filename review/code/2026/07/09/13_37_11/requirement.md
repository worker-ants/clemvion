# 요구사항(Requirement) 리뷰 — 에디터 슬러그 라우팅 phase 2

## 검증 방법
- 28개 변경 파일 diff/전체 컨텍스트 정독.
- `git show --stat`으로 rename(구 `(editor)/workflows/[id]` → `(editor)/w/[slug]/workflows/[id]`) 실제 반영 확인.
- `grep`으로 raw `/workflows/${id}` 리터럴 잔존 여부 전수 재확인(guard 테스트 신뢰만 하지 않고 직접 검증).
- 관련 unit 테스트 4개 파일(no-raw-editor-href, no-raw-execution-href, (editor) layout.test, (main) layout.test) 및 schedules-page.test 실행 — 전부 pass (27+23 tests).
- `tsc --noEmit` 클린 확인.
- catch-all(`(main)/[...rest]/page.tsx`), 사이드바 워크스페이스 스위처, `useWorkspaceSlug` 훅 등 diff 밖 연관 코드까지 추적해 회귀 여부 확인.

## 발견사항

- **[WARNING]** `use-workspace-slug.ts` 주석이 phase 2 이후 사실과 어긋남 (diff 밖, 갱신 누락)
  - 위치: `codebase/frontend/src/lib/workspace/use-workspace-slug.ts:10`
  - 상세: "slug 세그먼트가 없는 라우트(editor 등)에서는 store 의 `currentWorkspaceId` → slug 로 폴백" 이라는 주석이 남아있다. 그러나 이번 PR 로 에디터(`/workflows/[id]`)는 이제 `(editor)/w/[slug]/workflows/[id]` 아래라 slug 세그먼트를 **가진다** — "editor 등" 예시가 더 이상 정확하지 않다. 이 파일은 `buildEditorHref` 소비처들이 의존하는 slug 해석 훅이라 이번 변경과 직접 관련 있는데도 plan 의 S5("가드/헬퍼 주석 갱신") 범위(`no-raw-execution-href.test.ts`·`editor-toolbar.tsx`·`href.ts`)에서 이 파일만 누락됐다.
  - 기능상 영향은 없음(로직 자체는 URL 우선 → store 폴백으로 여전히 올바르게 동작, 실측 확인됨) — 코드 개발자·리뷰어를 오도할 수 있는 문서적 괴리.
  - 제안: 주석에서 "editor 등" 예시를 제거하거나 "docs 등"으로 교체.

- **[INFO]** 사이드바 활성-메뉴 판정 주석도 동일 계열의 stale 문구 (diff 밖)
  - 위치: `codebase/frontend/src/components/layout/sidebar.tsx:442`
  - 상세: `// slug 라우트에선 \`/w/<slug><href>\`, editor 등 slug 밖에선 bare href 로 활성 판정.` — 에디터가 이제 slug 아래이므로 이 예시도 부정확. 다만 사이드바 nav item 자체에 에디터 캔버스 항목이 없어(참조 대상은 `/workflows` 목록 항목) 판정 로직 자체가 잘못 동작하지는 않는다(bare-fallback 조건이 에디터 케이스에 대해 그냥 vacuous 해질 뿐) — 순수 주석 정밀도 문제.
  - 제안: 주석에서 에디터 언급 제거(범용 "catch-all 리다이렉트 전환 flash" 등으로 교체) 또는 무시 가능.

- **[INFO] `[SPEC-DRIFT]` 아님 — 정밀도 저하 수준의 잔여 표현** (spec fidelity, 회색지대에 가까움)
  - 위치: `spec/2-navigation/9-user-profile.md §3` (해당 diff 상단 미변경 문장), `spec/data-flow/12-workspace.md` "URL slug = FE 라우팅 SoT" 절 도입부
  - 상세: "`(main)/w/[slug]` layout 이 slug 를 워크스페이스로 해소해 ... 흐름을 구동한다"는 문장이 그대로 남아있다. 실제로는 이 로직이 `WorkspaceSlugGate` 로 추출되어 `(main)`·`(editor)` 양쪽 layout 이 공유한다. 각 문서 모두 **바로 다음 문장(들)**에서 에디터 편입·공유 게이트를 명시적으로 설명하므로 독자가 오도되지는 않지만, 이 특정 문장만 놓고 보면 "(main) 전용"처럼 읽힐 여지가 있다.
  - 코드가 옳고 이 표현은 단지 서술 범위가 좁을 뿐이라 spec 결함이라 보기 어려운 회색지대 — CRITICAL 대상 아님.
  - 제안(원하면): "`WorkspaceSlugGate`(공용, (main)/(editor) 공유)가 slug 를 워크스페이스로 해소해"로 표현 확장. 필수는 아님.

- **[INFO] 긍정 확인 — spec fidelity 라인 매칭 양호**
  - `spec/2-navigation/9-user-profile.md §3`, `_layout.md §2.2/§3.1`, `0-dashboard.md`, `1-workflow-list.md`, `14-execution-history.md`, `data-flow/12-workspace.md` Rationale, `3-workflow-editor/2-edge.md` frontmatter `code:` 경로 — plan(`editor-slug-phase2.md`) S7 체크리스트가 명시한 대상 전부 실제 diff 에 반영됐고, "에디터 = slug 밖(phase 1)" 서술이 전부 "에디터도 phase 2 부터 slug 기준"으로 정정됨. `grep`으로 spec/ 전체에서 stale "phase 1 에서 slug 밖" 류 잔존 문구 0건 확인.

- **[INFO] 긍정 확인 — 하위호환·라우트 공존·guard 실효성**
  - 구 `(editor)/workflows/[id]/{page,editor-loader}.tsx` 는 git mv 로 완전히 제거됐고(잔존 파일 없음, `find` 로 확인), bare `/workflows/<id>` 는 기존 범용 `(main)/[...rest]` catch-all(하드코딩 예외 없음)이 그대로 흡수 — phase 1 인프라 변경 없이 phase 2 요구사항(S6) 충족.
  - `no-raw-editor-href.test.ts` guard 가 실제로 스코핑 누락 2곳(executions 목록 "Open in Editor")을 발굴해 이관시켰음이 plan 구현 노트로 실증 — 가드가 명목상이 아니라 실제 가치를 냄.
  - `buildEditorHref`/`buildExecutionHref` 소비 사이트 전수(`dashboard`·`workflows`·`triggers`·`schedules`·`usage-node-list`·`overview-card`·`executions`) 재확인 결과 raw 리터럴 잔존 0건(helper/api/notifications 예외만 남음) — 직접 grep 으로 가드 테스트와 독립적으로 재확인.
  - 두 라우트 그룹의 `/w/[slug]/workflows/[id]` 공존(에디터) vs `/w/[slug]/workflows/[id]/executions`((main)) 은 `tsc --noEmit` 클린 + 관련 unit 전부 pass 로 구조적 충돌 없음 재확인.
  - "에디터 내 워크스페이스 전환 → 새 slug dashboard 이동" 잠금 결정은 사이드바 스위처(`sidebar.tsx:178-179`, `router.push(buildWorkspaceHref(target.slug, "/dashboard"))`)가 라우트 무관 범용 동작이라 별도 구현 없이 자동 충족됨을 확인.

- **[INFO] TODO/FIXME/HACK/XXX**: 이번 diff 범위(phase1→phase2 커밋 구간) 신규 도입 0건.

## 요약
에디터 캔버스를 `/w/<slug>/workflows/<id>` 로 편입하는 phase 2 구현은 계획된 작업 표면(S1-S7)을 빠짐없이 커버했다 — 공용 `WorkspaceSlugGate` 추출·(main)/(editor) 양쪽 소비·`buildEditorHref` 헬퍼·대칭 guard 테스트(`no-raw-editor-href`)·9개 소비처 slug화(가드가 스코핑 누락 2곳까지 실제로 발굴)·구 bare 경로의 범용 catch-all 흡수·연관 spec 문서 6종 정정까지 line-level 로 코드와 일치한다. 실제로 unit 테스트(guard 2종 + layout 2종 + schedules-page, 총 4파일 50 테스트)를 재실행해 전부 pass, `tsc --noEmit` 클린을 직접 재확인했고, 소비처 grep 으로 raw 리터럴 잔존이 없음을 가드 테스트에 의존하지 않고 독립 검증했다. 유일한 흠은 이번 diff 범위 밖에 남은 2건의 stale 주석(`use-workspace-slug.ts`·`sidebar.tsx`)으로, 둘 다 기능적 결함은 아니고 문서적 정밀도 문제이며, spec 본문 자체는 CRITICAL 급 불일치 없이 정합하다.

## 위험도
LOW
