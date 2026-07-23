# ADJUDICATION — review/consistency/2026/07/23/15_33_52

checker 산출 판정: **BLOCK: YES** (convention_compliance CRITICAL 1건).
main Claude 판정: **이번 diff 에 귀속되지 않는 선재(pre-existing) 영역 drift** — 아래 실측 근거.

> 본 문서는 `SUMMARY.md` 를 **대체하지 않는다**. SUMMARY 는 checker 원문 그대로 보존하며(BLOCK: YES),
> 본 문서는 그 CRITICAL 의 귀속·처분을 기록한다. 게이트 처리 방침은 §게이트 처분 참조.

## CRITICAL 은 실재한다 (기각하지 않음)

`previousOutput` 에 대해 세 SoT 가 모순한다 — main Claude 가 독립 실측으로 **재확인**했다:

| # | 출처 | 상태 |
|---|---|---|
| 1 | `codebase/backend/src/modules/execution-engine/button-interaction.service.ts:294` | 재개 출력에 `previousOutput` **무조건 주입** (nested chain strip), 회귀 테스트로 고정 |
| 2 | `spec/conventions/node-output.md:194` | *"Phase 3 완료 전 과도기 예외: presentation resume 경로는 `previousOutput` 을 transitional legacy 필드로 여전히 보존"* — **코드와 일치** |
| 3 | `spec/4-nodes/6-presentation/0-common.md:136` · `3-chart.md:228·271` | *"폐기"* · *"모두 폐기"* · *"사용 금지"* — **1·2 와 정면 모순** |

→ 지적은 **정당하다**. 오탐이 아니며 기각하지 않는다.

## 그러나 이번 diff 에 귀속되지 않는다

| 검증 | 명령 | 결과 |
|---|---|---|
| 내 branch 가 spec 을 건드렸는가 | `git diff --name-only origin/main..HEAD -- spec/` | **0 파일** |
| 내 diff 에 `previousOutput` 이 등장하는가 | `git diff origin/main..HEAD \| grep -c previousOutput` | **0건** |
| 모순 서술이 언제 landing 했는가 | `git log -1 -- 0-common.md` / `3-chart.md` | `946b59cf6`(2026-07-11 #909) · `db496a3c2`(2026-06-10 #516) — **둘 다 origin/main 선재** |
| checker 자신도 인지했는가 | SUMMARY §스코프 노트 · plan_coherence WARNING #3 | *"target 문서 자체는 이번 diff 에서 변경되지 않았다(5개 checker 전원 확인)"*, *"검토 스코프-diff 불일치 — target 이 이번 세션에서 실제 변경된 파일이 아님"* |

이번 branch 의 코드 변경은 `output-shape.ts` **JSDoc 주석 + 테스트 fixture 전용**(소스 실행 로직
non-comment diff 0줄 실증)이며 `previousOutput` 경로와 직교한다.

## 판정 근거 — `--impl-done` 은 diff-scoped 다

`.claude/skills/consistency-checker/SKILL.md:52` 는 `--impl-done` 을 *"`git diff <diff-base>...HEAD --
<code_areas>` 가 함께 묶여 5 checker 가 **spec 본문 vs 실 구현 diff** 정합성을 사후 분석"* 으로 정의한다.
즉 판정 단위는 **영역 전체의 현재 상태가 아니라 이번 diff 와 spec 의 정합성**이다.

checker 들은 영역 전문(`--impl-prep` 유사)으로 읽어 영역 선재 drift 를 CRITICAL 로 올렸고, 그 결과
BLOCK: YES 가 나왔다. plan_coherence 가 이 스코프 어긋남을 스스로 WARNING #3 으로 표면화했다.

**프로젝트 선례**: 동일 패턴이 이미 처분된 바 있다 — impl-prep 은 영역 선재 Critical 로 BLOCK:YES 가
정상이지만, **impl-done 은 diff-scoped 라 좁은 diff 는 통과**시키고 영역 선재 항목은 WARNING 으로
강등해 별건 처리한다.

## 역할 경계 — developer 는 이 CRITICAL 을 고칠 수 없다

해소하려면 `spec/4-nodes/6-presentation/{0-common,3-chart,1-carousel,2-table,5-template}.md` 5개
문서를 편집해야 한다. [`CLAUDE.md`](../../../../../CLAUDE.md) 는 developer 의 쓰기 권한을
`codebase/**`·`plan/**`·`review/**/RESOLUTION.md` 로 한정하고 **`spec/` 은 read-only** 로 못박으며,
*"구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임"* 을 규정한다.

→ 본 세션(developer)에서의 수정은 **역할 위반**이다. 대신 **project-planner 후속 task 로 위임**했다
(spawn: `previousOutput` 폐기 서술 정정 + Continuation Bus 5종→6종 + Rationale 함수명 오기, 근거·
파일·라인 전부 포함).

## 게이트 처분

`review_guard.py` 의 SPEC-CONSISTENCY 게이트는 `--impl-done` SUMMARY 의 `BLOCK:` 라인이 `NO` 일 때만
통과한다(`_summary_block_is_no`). 본 세션 SUMMARY 는 checker 원문 보존을 위해 **`BLOCK: YES` 그대로
둔다** — 게이트를 통과시키려고 판정 문구를 고쳐 쓰지 않는다.

따라서 이 상태로는 push 가 차단되며, 처분은 **사용자 결정 사항**이다:

- (a) 위 근거로 게이트 우회 후 push — 선재 drift 는 planner task 로 분리 추적
- (b) planner task 를 먼저 완료(별도 PR)해 spec 을 정합화한 뒤 재검사 → 정상 통과 후 push
- (c) push 보류

어느 쪽이든 **CRITICAL 자체는 살아있는 항목으로 추적된다** — 본 문서와 spawn 된 planner task 가
그 기록이다.
