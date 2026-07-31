# 변경 범위(Scope) Review

## 발견사항

- **[CRITICAL]** 이번 PR 의 어떤 plan/커밋 메시지에도 언급되지 않은 ~1,300줄짜리 orphaned 파일이 통째로 추가됨
  - 위치: `.claude/skills/code-review-agents/scripts/_probe_main.py` (신규 파일 전체, git diff status `A`, 1,304줄)
  - 상세: `git diff dc81d21c9..HEAD --name-status` 기준 이번 브랜치에서 신규 추가된 파일인데, 그 파일을
    추가한 커밋(`d19e01880 fix(harness): 3R 리뷰 반영 …`)의 커밋 메시지, 두 plan 문서
    (`harness-consistency-summary-downgrade-rule.md`, `harness-review-gate-ci-backstop.md`),
    `SKILL.md`/`README.md` 어디에도 `_probe_main` 언급이 전혀 없다. `_probe_main.py` 를
    `code_review_orchestrator.py` 와 직접 `diff` 해보면 **두 파일이 다른 지점은 전부 이번 PR 이
    `code_review_orchestrator.py` 에 추가한 수정 사항(omission-notice 신설, 예산 계상 리팩터)이
    빠진 옛 코드**뿐이다 — 즉 `_probe_main.py` 는 이번 수정을 시작하기 전 `code_review_orchestrator.py`
    를 복사해 둔 **스냅샷/스크래치 파일**이고, 그 외 독자적인 내용은 0줄이다(단방향 diff 확인:
    `_probe_main.py` 에만 있는 줄은 전부 `code_review_orchestrator.py` 의 구-버전 코드).
    저장소 전체를 grep 해도 이 파일을 import 하거나 실행하거나 문서에서 가리키는 곳이 전혀 없다
    (`grep -rln "_probe_main"` → 이번 리뷰 세션의 메타파일 외 0건). 그럼에도 `if __name__ ==
    "__main__": main()` 가 있는 완전한 독립 실행 CLI 로, `py_compile` 로 문법도 정상이다 — 즉
    죽은 텍스트가 아니라 **실행 가능한 회귀 지뢰**다: 누군가 실수로 이 파일을 돌리면 이 PR 이
    막 고친 결함들(예산 초과 시 파일이 아무 안내 없이 통째로 누락되는 문제 등)이 그대로 재현된다.
    개발 중 "고치기 전/후 동작을 비교하려고 만든 로컬 사본"이 `git add` 범위에 휩쓸려 커밋된 것으로
    보이며, 이 PR 이 실제로 의도한 범위(번들 우선순위 재정렬·downgrade 금지+planner 인계·changeset
    경고·omission notice·in-flight 스코프 축소) 그 어디에도 속하지 않는다.
  - 제안: `_probe_main.py` 삭제. 비교용으로 남겨야 할 이유가 있었다면 저장소 밖(로컬 scratch)에
    두거나, 커밋 메시지/plan 에 존재 이유를 명시할 것 — 현재 상태로는 유지보수자가 이 파일을
    "진짜" 오케스트레이터의 대체본으로 오인할 위험도 있다.

- **[INFO]** 위 1건을 제외한 나머지 16개 변경 파일은 두 plan 문서
  (`plan/in-progress/harness-consistency-summary-downgrade-rule.md`,
  `plan/in-progress/harness-review-gate-ci-backstop.md`)에 기록된 항목과 1:1 로 대응하며 범위
  이탈이 없다: `evaluate_review(in_flight_ok=...)` opt-in 축소(`_lib/review_guard.py`,
  `guard_review_before_stop.py` 및 대응 테스트 3건), `prioritize_bundle_files` 4-tier 재정렬
  (`consistency_orchestrator.py` + `test_consistency_bundle_priority.py`), 기본 `--prepare`
  changeset 누락 경고(`code_review_orchestrator.py` 의 `warn_if_committed_work_is_missing` +
  `test_review_changeset_warning.py`), 리뷰 프롬프트 omission notice
  (`_omitted_content_note`/`_aggregate_omission_note` + `test_prompt_omission_notice.py`),
  consistency-summary 하향 금지 + planner 인계 경로(`consistency-summary.md`,
  `consistency-checker/SKILL.md`) 전부 커밋 메시지·plan 서술과 부합한다. 각 diff 에 formatting-only
  변경, 불필요한 리팩토링, 관련 없는 import/주석 변경, 설정 파일 변경은 확인되지 않았다
  (`git diff --stat` 상 `.claude/`·`plan/`·`review/` 외 경로 변경 0건, `.claude.project.json`/
  `settings.json` 등 설정 파일 변경 0건).

## 요약

이 PR 은 plan 문서에 미리 기록된 5개 하네스 결함(review-guard in-flight 스코프, consistency 번들
우선순위, changeset 누락 경고, 리뷰 프롬프트 omission notice, downgrade 금지+planner 인계)을
정확히 그 범위 안에서 고쳤고 각 변경이 대응 plan 항목·테스트와 촘촘히 연결되어 있어 범위 준수도가
매우 높다. 다만 마지막 커밋에서 `code_review_orchestrator.py` 의 수정 전 스냅샷으로 보이는
~1,300줄짜리 실행 가능한 orphaned 스크립트(`_probe_main.py`)가 아무 설명 없이 통째로 커밋에
섞여 들어갔다 — 이번 PR 의 의도된 범위와 무관한 단일 파일이지만 그 규모(diff 전체 순증가 2,749줄
중 1,304줄, 약 47%)와 위험성(구식 회귀 코드를 실행 가능한 채로 남김) 때문에 전체 판정을 좌우한다.

## 위험도

HIGH — 나머지 변경은 전부 범위 내지만, 삭제되어야 할 orphaned 실행 파일 1건이 diff 순증가분의
거의 절반을 차지하는 채로 병합 대기 중이다.
