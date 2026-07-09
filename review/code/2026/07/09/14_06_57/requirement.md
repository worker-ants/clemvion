# 요구사항(Requirement) 리뷰 — ai-review WARNING 조치 커밋 (5c4ffd5b7)

## 검증 방법
- 9개 변경 파일(CHANGELOG.md + 8개 코드/테스트 파일) diff·전체 컨텍스트 정독.
- 직전 리뷰 라운드(`review/code/2026/07/09/13_37_11/`)의 SUMMARY.md 및 **개별 reviewer 산출물 전체**(architecture/maintainability/requirement/documentation/testing/scope/side_effect/user_guide_sync)를 직접 열람해, 이번 커밋이 "조치했다"고 주장하는 항목과 실제 존재했던 발견사항 전체를 대조.
- 실제 소스(`workspace-slug-gate.tsx`, `href.ts`, 양쪽 `layout.tsx`, `sidebar.tsx`)를 Read 하여 테스트가 기술하는 행위와 구현이 일치하는지 확인.
- `npx vitest run` (대상 10개 테스트 파일, 71 tests) — 전부 pass.
- `npx tsc --noEmit -p .` — 클린.
- `npx eslint` (변경 파일 전체) — 클린.
- `grep`으로 spec 참조 파일(9-user-profile/_layout/0-dashboard/1-workflow-list/14-execution-history/2-edge/12-workspace) 실존 확인.
- `buildEditorHref` 소비처 7곳을 grep 으로 재확인하고, 각 소비처의 테스트가 실제로 slug-활성 상태를 단언하는지 직접 Read 로 검증.

## 발견사항

- **[WARNING]** 이번 커밋이 "SUMMARY(Critical 0/Warning 5) 조치 완료"를 주장하나, 직전 라운드에 실제로 존재했던 **testing.md WARNING #2(전체 위험도 MEDIUM)** — `buildEditorHref` 콜사이트 다수에 slug-활성 회귀 단언 부재 — 는 그대로 방치됐다
  - 위치: `codebase/frontend/src/app/(main)/w/[slug]/dashboard/__tests__/dashboard-page.test.tsx`(recent-workflows row-click·create-then-push 미검증, execution row-click 만 존재) · `.../workflows/__tests__/workflows-page.test.tsx:153`(`useParams: () => ({})` 무-slug 상태에서 `expect(mockPush).toHaveBeenCalledWith("/workflows/new-wf")` — bare-fallback 경로로 우연히 통과) · `.../triggers/__tests__/triggers-page.test.tsx`(beforeEach 에 `slug:"team-1"` 워크스페이스 이미 주입돼 있음에도 워크플로우 링크 href 단언 자체가 없음) · `.../integrations/[id]/__tests__/danger-tab.test.tsx:23,144`(`useParams: () => ({})` 상태로 `toHaveAttribute("href","/workflows/wf-a")` — 역시 bare-fallback 으로만 통과) · `.../workflows/[id]/executions/__tests__/execution-list-page.test.tsx:196-201`("Open in Editor" 클릭 테스트가 `mockPush` 를 `"/workflows/wf-1"`(bare) 로만 단언, slug-활성 케이스 없음) · `components/triggers/cards/overview-card.tsx`(컴포넌트 테스트 파일 자체 부재).
  - 상세: 직전 13_37_11 라운드에서 `testing` reviewer 는 이 5~6개 콜사이트를 "raw-literal guard 는 리터럴 사용만 잡을 뿐 헬퍼에 잘못된 slug 변수를 넘기는 회귀(이 프로젝트가 PR #865/#866 에서 이미 겪은 클래스)는 못 잡는다"고 명시하며 MEDIUM 위험으로 분류했다. 그러나 `13_37_11/SUMMARY.md` 는 "`testing.md` 파일이 디스크에서 확인되지 않아 통합하지 못했다"고 (실제로는 파일이 존재했음에도) 잘못 보고했고, 이번 조치 커밋은 그 SUMMARY 를 기준으로 W1~W5(정확히는 architecture/maintainability 의 중복 WARNING 2건 + requirement 주석 1건 + documentation CHANGELOG 1건 + testing WARNING #1(`buildEditorHref` 직접 단위 테스트 부재)만 커버) 를 처리했다 — testing WARNING #2(콜사이트 회귀 커버리지)는 6개 항목 중 유일하게 누락됐다. 직접 재확인한 결과 `schedules-page.test.tsx`/`execution-list-page.test.tsx`(행 클릭 부분)만 slug-활성 상태에서 href 값을 단언하고, 나머지는 여전히 무-slug mock 환경에서 "우연히" bare-fallback 경로로 통과하거나 테스트가 아예 없다. 프로덕션 코드 자체(`buildEditorHref` 호출 인자)는 grep/직전 라운드 재확인으로 이미 정확함이 확인됐으므로 **현재 기능 결함은 아니나**, 이 PR 의 핵심 목표("헬퍼 오용에 의한 broken editor link 재발 방지")를 검증하는 회귀 안전망이 7개 콜사이트 중 5개에서 비어 있다.
  - 제안: `schedules-page.test.tsx:459-460`/`execution-list-page.test.tsx`(row-click 부분) 의 "slug-누락 회귀 가드" 패턴(워크스페이스 스토어에 slug 있는 워크스페이스 주입 후 href/push 값 단언)을 나머지 5개 파일(`dashboard-page.test.tsx`, `workflows-page.test.tsx`, `triggers-page.test.tsx`, `danger-tab.test.tsx`, `execution-list-page.test.tsx`"Open in Editor" 케이스)에 적용하고, `overview-card.tsx` 는 최소 렌더+href 단언 테스트를 신설. plan(`plan/in-progress/editor-slug-phase2.md`) `REVIEW WORKFLOW` 체크박스가 아직 미완료(`[ ]`) 상태이므로 다음 조치 라운드에서 이 항목을 명시적으로 반영할 것을 권장.

- **[INFO]** `sidebar.tsx:442` 의 stale 주석("editor 등 slug 밖")이 여전히 남아있음 — 조치 누락이 아니라 애초에 WARNING 이 아니었음(직전 라운드에서 INFO 로만 분류, "sidebar nav item 자체엔 에디터 캔버스 항목이 없어 vacuous"라 실동작 영향 없음)
  - 위치: `codebase/frontend/src/components/layout/sidebar.tsx:442`
  - 상세: 이번 커밋의 W3 는 `use-workspace-slug.ts` 코멘트만 정정했고(정확히 requirement WARNING 대상) `sidebar.tsx` 는 손대지 않았다. `13_37_11/SUMMARY.md` 의 "권장 조치사항"에는 두 파일이 함께 언급됐으나 발견사항 등급표에는 `sidebar.tsx` 가 INFO 로만 등재돼 있어, WARNING 만 조치한 이번 커밋 범위에서 빠진 것은 등급 기준상 타당하다.
  - 제안: 필수 아님. 다음에 이 파일을 만질 때 "에디터 등" 예시를 제거하거나 "catch-all 리다이렉트 전환 flash" 등으로 교체.

- **[INFO]** 긍정 확인 — W1(게이트 SoT 테스트), W2(guard 헬퍼 공유), W4(CHANGELOG), W5(`buildEditorHref` 단위 테스트) 는 모두 실제로 올바르게 구현·검증됨
  - `workspace-slug-gate.test.tsx` 의 4개 시나리오(정합 렌더/불일치 reconcile/무효 slug redirect/로딩)가 실제 `workspace-slug-gate.tsx` 구현(useEffect 2개 + `reconciled` 판정 + `role="status"` 로딩 게이트)과 line-level 로 일치하며, 두 layout(`(main)/w/[slug]/layout.tsx`, `(editor)/w/[slug]/layout.tsx`) 은 각각 `<WorkspaceSlugGate>{children}</WorkspaceSlugGate>` 1줄 위임으로 실제 배선을 확인.
  - `href-guard-utils.ts`(`collectSourceFiles`/`findRawHrefOffenders`)를 두 guard 테스트가 정확히 동일 시그니처로 import 해 중복이 제거됐고, `SRC` 앵커 계산(`__dirname` 로부터 3단계 상위)도 원본과 동일 위치(`lib/workspace/__tests__/`)라 값이 그대로 보존됨.
  - `buildEditorHref` 신규 테스트 3케이스(slug 있음/null/undefined)가 실제 `href.ts` 구현(`buildWorkspaceHref` 위임, slug 부재 시 bare fallback)과 정확히 일치.
  - `CHANGELOG.md` phase 2 항목이 참조하는 spec 문서(`9-user-profile.md §3`, `_layout.md §2.2/§3.1`, `0-dashboard.md`, `1-workflow-list.md`, `14-execution-history.md`, `3-workflow-editor/2-edge.md`, `data-flow/12-workspace.md`) 전부 실존 확인, 서술 내용(에디터 slug 편입·`WorkspaceSlugGate` 공유·`buildEditorHref`·catch-all 흡수·URL slug≠backend 인가 SoT 불변)도 실제 코드와 일치.
  - `npx vitest run`(대상 10파일) 71/71 pass, `tsc --noEmit` 클린, `eslint` 클린 — 회귀 없음.

- **[INFO] TODO/FIXME/HACK/XXX**: 이번 diff 범위 신규 도입 0건.

- **[INFO] spec fidelity**: 이번 커밋은 spec 파일을 전혀 건드리지 않는 순수 테스트/주석/CHANGELOG 변경이라 코드-spec line-level 불일치 위험 자체가 낮다. CHANGELOG 서술과 실제 spec 본문·코드 간 불일치는 발견되지 않았고, spec drift 로 볼 사안도 없다.

## 요약
`ai-review WARNING 조치` 커밋은 직전 라운드에서 SUMMARY 에 실제로 병합된(그리고 architecture/maintainability/requirement/documentation reviewer 가 독립적으로도 지적한) 4~5개 WARNING — 게이트 행위 테스트 중복(→`workspace-slug-gate.test.tsx` SoT 신설), guard 스캐닝 골격 중복(→`href-guard-utils.ts` 공유), stale 주석(`use-workspace-slug.ts`), CHANGELOG 누락, `buildEditorHref` 직접 단위 테스트 부재 — 를 모두 정확하고 검증 가능하게(vitest 71/71 pass, tsc/eslint 클린) 조치했다. 다만 같은 라운드에 존재했던 `testing.md` 의 MEDIUM-위험 WARNING(`buildEditorHref` 콜사이트 5~6곳의 slug-활성 회귀 테스트 부재)은 SUMMARY.md 의 병합 누락(파일이 디스크에 없다는 오보) 때문에 이번 조치 대상에서 빠졌고, 직접 재확인 결과 여전히 미해결 상태다 — 프로덕션 코드 자체는 정확하지만(이미 검증됨) 이 PR 의 핵심 목적인 "헬퍼 오용 회귀 방지" 안전망이 7개 콜사이트 중 5개에서 비어 있는 채로 남아, plan 의 `REVIEW WORKFLOW` 체크박스도 아직 미완료다.

## 위험도
MEDIUM
