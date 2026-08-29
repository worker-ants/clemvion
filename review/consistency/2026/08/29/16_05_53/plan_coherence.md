# Plan 정합성 검토 — target: spec/conventions/ (--impl-done, diff-base=origin/main)

## 실측 메모 (판정 근거)

- `git diff --stat origin/main..HEAD` 실측 결과, 이번 diff 는 `spec/conventions/**` 를 **한 파일도 건드리지 않는다.**
  실제 변경분은 `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` / `spec-links.test.ts`
  (멀티라인 마크다운 링크 미탐지 사각지대 수정), `plan/in-progress/harness-review-gate-followups.md`
  (그 수정의 해소 기록), 그리고 `review/code/2026/08/29/{14_36_39,15_01_34,15_30_59,15_55_00}/**`
  (4라운드 코드 리뷰 산출물)뿐이다. bundler 가 `spec/conventions/` 를 target 으로 잡은 것은 그
  코드가 `spec/conventions/doc-sync-matrix.md §4` 가 서술하는 build-time 가드
  (`spec-link-integrity.test.ts`) 의 구현체이기 때문으로 보인다 — spec 본문 자체의 변경은 없다.
- `plan/in-progress/harness-review-gate-followups.md` 는 이 diff 가 고친 바로 그 결함
  ("`spec-link-integrity` 가 멀티라인 마크다운 링크를 통째로 못 본다")을 `[x]` 로 해소 기록하며,
  뮤테이션 실측(옛 구현 GREEN 침묵통과 / 새 구현 RED)까지 함께 실었다. diff 내용과 plan 서술이
  1:1 로 대응한다.

## 발견사항

- **[INFO]** `harness-review-gate-followups.md` frontmatter `worktree` 필드가 실제 작업 워크트리와 다르다
  - target 위치: (target 자체는 무관 — plan 문서 hygiene)
  - 관련 plan: `plan/in-progress/harness-review-gate-followups.md` frontmatter
    (`worktree: harness-review-ci-backstop-91f379`)
  - 상세: 이번 세션의 실제 작업은 `eslint10-upgrade-5e3cf9` 워크트리(현재 CWD)에서 이뤄졌고, 이
    diff 의 126줄 plan 갱신도 그 워크트리에서 커밋됐다. 그런데 이 문서의 frontmatter 는 여전히
    다른 워크트리(`harness-review-ci-backstop-91f379`)를 선언한다. 같은 저장소가 이미 겪은 클래스의
    drift 다 — `deps-peer-gating-and-eslint10.md` 자신도 §2 이후 작업이 `eslint10-upgrade-5e3cf9`
    로 옮겨오며 `worktree:` 필드를 갱신했고, 그 문서 안에 "이전 `--impl-done`(`01_30_29`) 이 정확히
    이 종류의 불일치를 INFO#9 로 짚었다" 는 자기 기록이 있다.
  - 비차단 근거: `deps-peer-gating-and-eslint10.md` 가 같은 워크트리(`eslint10-upgrade-5e3cf9`)를
    이미 `worktree:` 로 선언하고 있어, "한 워크트리의 여러 plan 중 하나만 매칭돼도 통과" 하는
    plan-lifecycle 게이트는 막히지 않는다(그 문서 자신의 서술). 따라서 CRITICAL/WARNING 이 아니라
    hygiene 메모.
  - 제안: `harness-review-gate-followups.md` 의 `worktree:` 를 실제 작업 워크트리로 갱신하거나,
    (원 티켓 소유 워크트리가 별도로 살아있다면) 최소한 "이 세션은 다른 워크트리에서 대신
    처리했다" 는 한 줄을 남겨 다음 사람이 두 워크트리 이름 사이에서 헷갈리지 않게 할 것.

## 그 외 확인했으나 문제 없음 (근거만 남김)

- **미해결 결정 우회 여부**: `harness-review-gate-followups.md` 에는 이번 diff 와 같은 파일
  (`extractLinks`)을 다루는 **아직 열린** 결정 2건이 있다 — "링크 추출을 `fromMarkdown` AST
  순회로 옮길지 판정" (`[ ]`, 3곳 CommonMark 이탈 지점을 근거로 제기됨)과 "링크 가드 통합층
  대칭성 2건" (`[ ]`, `LinkViolation.line` 통합 단언·ANCHOR 멀티라인 케이스). 실제 diff 는 두
  결정 중 어느 쪽도 선점하지 않는다 — 기존 정규식+마스킹 접근을 그대로 확장했을 뿐이고, AST
  전환 여부는 plan 이 명시적으로 "판정 필요" 로 열어 둔 채다. 즉 target 코드가 미해결 결정을
  우회해서 일방적으로 정한 바가 없다.
- **선행 plan 미해소**: 이 diff 가 전제하는 사전 조건(“멀티라인 링크 사각지대가 실재한다”)은
  `spec-sync-stop-editor-and-forbidden-routes.md` 에서 최초 발견돼 이미 `harness-review-gate-
  followups.md` 로 오너십이 이관된 상태였고(포인터만 남기고 "이관했다" 로 정리), 이번 diff 가
  그 이관된 항목을 실제로 해소했다. 선행 조건 미해소 없음.
- **후속 항목 누락**: 해소 기록이 plan 안에 "구현이 지켜야 했던 세 가지"(인라인 코드 제거·줄
  번호 재지도·펜스 자리 `]` 보존)와 역방향 검증(빈 줄 경계)까지 명시하고, 남은 두 건(AST 전환
  판정·통합층 대칭성)을 각각 별도 체크박스로 신규 등재해 뒀다 — 변경이 무효화하거나 새로
  만들어야 할 후속 항목 중 미기록된 것은 없다. `doc-sync-matrix.md §4` 표의 `spec-link-
  integrity.test.ts` 행 서술(2026-08-27 정정본)도 이번 수정 이후에도 여전히 정확하다 —
  구현 세부(줄 단위 vs 마스킹 전문 매칭)는 표가 서술하는 계약(“in-repo 링크 타겟 존재 + 앵커
  대조”) 자체를 바꾸지 않는다.
- **다른 plan 과의 충돌**: `deps-peer-gating-and-eslint10.md` (이 워크트리의 원 소유 plan)의
  열린 항목 3건(`cause` 비노출 계측 지점 · secret-resolver 형제 3→4곳 · 근거 서술 중복 정리)은
  이번 diff 범위 밖이며, diff 가 그 항목들의 전제나 결정에 개입하지 않는다. 충돌 없음.

## 요약

이번 diff 는 `spec/conventions/` 본문을 변경하지 않고, `doc-sync-matrix.md §4` 가 서술하는
build-time 링크 가드의 구현 결함(멀티라인 링크 미탐지)을 수정한다. 그 수정은
`plan/in-progress/harness-review-gate-followups.md` 가 사전에 추적하던 항목을 정확히 해소하며,
같은 문서가 열어 둔 두 후속 결정(AST 전환 여부·통합층 대칭성 보강)은 선점하지 않고 그대로
열어 뒀다 — 미해결 결정 우회·선행 plan 미해소·후속 항목 누락 어느 기준으로도 위반이 없다.
유일한 지적은 `harness-review-gate-followups.md` frontmatter 의 `worktree` 필드가 실제 작업
워크트리(`eslint10-upgrade-5e3cf9`)와 다르다는 hygiene 메모이며, 같은 워크트리를 선언하는
동반 plan(`deps-peer-gating-and-eslint10.md`)이 있어 게이트를 막지는 않는다.

## 위험도

LOW
