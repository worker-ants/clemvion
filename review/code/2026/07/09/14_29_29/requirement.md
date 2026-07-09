# Requirement Review — buildEditorHref 콜사이트 slug 회귀 테스트 + sidebar 주석 (commit d8cf62554)

## 검증 방법
- 5개 변경 파일(dashboard-page.test.tsx, execution-list-page.test.tsx, workflows-page.test.tsx,
  sidebar.tsx, plan/in-progress/spec-sync-user-profile-gaps.md)의 diff + 전체 파일 컨텍스트 검토.
- 각 신규 테스트가 단언하는 콜사이트(dashboard/page.tsx, executions/page.tsx, workflows/page.tsx)를
  직접 Read/Grep 하여 `buildEditorHref(slug, …)` 배선이 실제로 일치하는지 line-level 대조.
- `vitest run`(3개 테스트 파일, 37 tests) / `eslint` / `tsc --noEmit` 실행으로 회귀 여부 확인.
- 관련 spec(`spec/2-navigation/_layout.md:85`, `spec/2-navigation/9-user-profile.md:158`)과
  sidebar.tsx 주석 문구의 정합성 대조.
- 직전 리뷰 라운드(`review/code/2026/07/09/14_06_57/SUMMARY.md`, `13_37_11`)와 이번 커밋의
  조치 범위 1:1 매칭 확인.

## 발견사항

- **[WARNING]** 커밋 메시지가 "RESOLUTION 기록"을 조치 근거로 명시하지만 실제 `RESOLUTION.md` 파일이
  존재하지 않는다.
  - 위치: `review/code/2026/07/09/14_06_57/`(SUMMARY.md 외 RESOLUTION.md 없음), 커밋 d8cf62554 diff
    (`git show --name-only`에도 RESOLUTION.md 미포함)
  - 상세: WARNING #1(콜사이트 7곳 중 5곳 테스트 부재)에 대해 이번 커밋은 3곳(dashboard/execution-list/
    workflows)만 조치하고 triggers/usage-node-list/overview-card 3곳은 "buildEditorHref unit+
    no-raw-editor-href guard+e2e 3중 안전망 커버로 defer — RESOLUTION 기록"이라고 명시했다. 그러나
    이 defer 결정을 기록해야 할 `RESOLUTION.md`가 해당 리뷰 디렉터리 어디에도 없다 — 결정 근거가 커밋
    메시지에만 존재해 plan-lifecycle/향후 fresh-review 감사 시 유실 위험이 있다(프로젝트 컨벤션상 미해결
    항목이 남으면 RESOLUTION.md 로 근거를 durable 하게 남기는 것이 관례).
  - 제안: 이번 라운드(또는 fresh review 이후)에 `review/code/2026/07/09/14_06_57/RESOLUTION.md`를
    작성해 3곳 defer 결정과 근거(unit+guard+e2e)를 기록.

- **[WARNING]** defer 근거로 든 "e2e 3중 안전망"이 실제로는 triggers/usage-node-list/overview-card
  콜사이트를 직접 커버하지 않는다.
  - 위치: `codebase/frontend/e2e/workspaces/slug-routing.spec.ts` (테스트 목록: deep-link 렌더·bare
    legacy 리다이렉트·root 리다이렉트·알림 딥링크 흡수·bare 에디터 경로 흡수·에디터 딥링크 해소 — 6개
    시나리오 전부 URL-레벨 deep-link/redirect 검증이며, triggers 페이지·`overview-card.tsx`·
    `usage-node-list.tsx`에서 "Open in Editor" 류 클릭을 거쳐 slug 가 실제로 실림을 검증하는 케이스는
    없음)
  - 상세: 실제 안전망은 (1) `buildEditorHref` 자체의 slug 유/무 단위 테스트(`href.test.ts`), (2)
    raw 리터럴 금지 정적 가드(`no-raw-editor-href.test.ts`) 두 가지뿐이다. (2)는 "헬퍼를 호출하는지"만
    검증하고 "호출 시 올바른 `slug` 변수가 전달되는지"는 검증하지 않는다(예: 콜사이트가
    `buildEditorHref(null, id)`처럼 잘못된 인자를 상수로 넘겨도 가드는 통과한다). 소스를 직접 대조한
    결과 triggers/page.tsx:716, usage-node-list.tsx:45,79, overview-card.tsx:154 모두
    `const slug = useWorkspaceSlug()`를 정확히 전달하고 있어 **현재 기능 결함은 없음**을 확인했으나,
    커밋 메시지의 "e2e 3중 안전망 커버" 표현은 실제 파일에 없는 커버리지를 주장하는 과장이다.
  - 제안: 커밋 메시지/RESOLUTION.md 작성 시 "e2e" 표현을 빼거나, `slug-routing.spec.ts`에 triggers/
    overview-card/usage-node-list 클릭 스루 케이스를 실제로 추가한 뒤 다시 표기.

- **[INFO]** `plan/complete/editor-slug-phase2.md`를 가리키는 전방 참조가 아직 존재하지 않는 경로다.
  - 위치: `plan/in-progress/spec-sync-user-profile-gaps.md:25`
  - 상세: "editor(`/workflows/[id]`)는 **phase 2 에서 slug 편입 완료**(`plan/complete/
    editor-slug-phase2.md` — …)"라고 기술하지만, 실제로는 `plan/in-progress/editor-slug-phase2.md`가
    아직 `in-progress/`에 있고 그 파일 자체의 `REVIEW WORKFLOW` 체크박스가 `[ ]`(미완료), `TEST
    WORKFLOW`가 `[~]`(부분)로 표시돼 있다. `plan/complete/editor-slug-phase2.md`는 아직 생성되지 않은
    경로를 가리키는 댕글링 참조다. (phase 1 plan은 `plan/complete/workspace-slug-routing.md`로 이미
    정상 이동돼 있어 대조군으로 확인함.)
  - 제안: phase 2 plan 이 REVIEW WORKFLOW(본 리뷰 포함)를 마치고 `plan/complete/`로 실제 이동하는
    시점에 함께 커밋되는 것이 정상 시퀀스이므로 즉각 조치 불필요 — 다만 이 노트가 참조하는 경로가
    같은 PR 내에서 실제로 존재하게 되는지 최종 커밋 시 확인.

- **[INFO]** `dashboard-page.test.tsx`의 신규 "recent-workflow" 테스트는 slug-active 케이스만
  단언하고, 같은 파일의 "recent executions row navigation" describe(양성/음성 페어: slug-active +
  "falls back to a bare path when no workspace is active")와 달리 no-slug fallback 케이스가 없다.
  - 위치: `codebase/frontend/src/app/(main)/w/[slug]/dashboard/__tests__/dashboard-page.test.tsx:53-81`
  - 상세: 기능 결함은 아니다(`buildEditorHref`의 null-slug fallback 은 `href.test.ts`에서 이미
    범용으로 커버됨) — 다만 같은 파일 내 다른 describe 블록의 "양성+음성 페어" 패턴과 비교하면
    커버리지 깊이가 얕다.
  - 제안: 필요 시 "no active workspace → bare `/workflows/wf-9`" 케이스를 대칭으로 추가.

- **[INFO]** `dashboard-page.test.tsx`의 `waitFor` import 가 사용되지 않는 미사용 import 경고
  (`@typescript-eslint/no-unused-vars`)를 발생시키지만, 이 import 라인은 이번 diff 의 변경 대상이
  아니다(diff 는 파일 끝에만 추가, import 줄은 손대지 않음) — 기존에 있던 사전 존재 이슈로, 본
  커밋이 introduce 한 회귀는 아니다.
  - 위치: `dashboard-page.test.tsx:2`
  - 제안: 이번 PR 스코프 밖이나, 후속 정리 시 제거 권장.

## 기능 검증 결과 (긍정)

- 3개 신규 테스트는 각각 실제 프로덕션 콜사이트와 line-level 로 정확히 대응한다:
  - `dashboard/page.tsx:233` `onClick={() => router.push(buildEditorHref(slug, workflow.id))}` ↔
    `dashboard-page.test.tsx` 신규 "recent-workflow click" 테스트.
  - `executions/page.tsx:171` "Open in Editor" 버튼 `onClick={() =>
    router.push(buildEditorHref(slug, workflowId))}` ↔ `execution-list-page.test.tsx` 신규 테스트.
  - `workflows/page.tsx:235` `createMutation.onSuccess → router.push(buildEditorHref(slug,
    workflow.id))` ↔ `workflows-page.test.tsx` 신규 "create-then-push" 테스트.
  - 격리 실행 결과 3개 테스트 파일 37/37 통과(vitest), 대상 파일 tsc/eslint 클린(사전 존재 warning
    1건 제외).
- `sidebar.tsx:442` 주석 변경("editor 등 slug 밖" → "slug 밖 라우트(docs 등)")은 갱신된 spec 본문과
  정확히 일치한다: `spec/2-navigation/_layout.md:85`와 `spec/2-navigation/9-user-profile.md:158`은
  이미 "에디터는 phase 2 에서 슬러그 편입 완료, docs/auth 만 slug 밖"으로 flip 되어 있다(선행 커밋
  e1be4bd81). 함수명·주석·실제 판정 로직(`pathname.startsWith(href) || pathname.startsWith(item.href)`)
  간 괴리 없음.
- TODO/FIXME/HACK/XXX 류 미완성 마커 없음.
- triggers/page.tsx, usage-node-list.tsx, overview-card.tsx 는 실제로 모두 `useWorkspaceSlug()` →
  `buildEditorHref(slug, …)`를 정확히 배선하고 있어(직접 확인), defer 대상 3곳에 현재 기능 결함은
  없다 — 결함이 아니라 "회귀 방지 테스트 커버리지"의 우선순위 트레이드오프 문제다.

## spec fidelity 요약

관련 spec: `spec/2-navigation/_layout.md` §해당 표 각주, `spec/2-navigation/9-user-profile.md` §3.
두 문서 모두 이미 "에디터 phase 2 slug 편입" 서술로 갱신되어 있고, 이번 커밋(테스트+주석+plan 노트)은
그 spec 서술과 코드 동작을 재확인/정합화하는 성격이라 spec 본문과 충돌하는 지점 없음. SPEC-DRIFT
없음.

## 요약

이번 커밋은 직전 라운드(`14_06_57`, Critical 0/Warning 2)의 WARNING #1(콜사이트 회귀 테스트 부재)과
WARNING #2(sidebar stale 주석) 조치를 목표로 하며, 조치한 3개 콜사이트(dashboard recent-workflow,
execution-list "Open in Editor", workflows create-then-push)는 실제 프로덕션 코드와 line-level 로
정확히 대응하고 전량 테스트 통과·타입/린트 클린을 확인했다. 다만 (1) 원래 지목된 5곳 중 3곳(triggers/
usage-node-list/overview-card)을 defer 하면서 근거로 든 "RESOLUTION 기록"이 실제로 작성되지 않았고,
(2) 같은 defer 근거의 "e2e 3중 안전망" 주장이 실제 e2e 스펙 커버리지보다 과장돼 있다(직접 소스 검증
결과 기능 결함 자체는 없음). (3) plan 노트의 `plan/complete/editor-slug-phase2.md` 참조는 아직
존재하지 않는 경로를 향한 전방 참조이나 이는 같은 작업 시퀀스의 자연스러운 후속 단계로 보인다.
치명적 기능 결함이나 spec 불일치는 없으며, 문서화/근거-기록 측면의 마무리 항목만 남아 있다.

## 위험도

LOW
