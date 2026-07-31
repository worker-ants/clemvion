# 성능(Performance) Review

> 참고: 라운드 7 — 직전 라운드 changeset 이 오구성(리뷰 산출물 번들링)돼 있어, 본 리뷰는 프롬프트에
> 잘린 파일(`review_guard.py`, `guard_review_before_push.py`, `code_review_orchestrator.py`,
> `consistency_orchestrator.py`)을 `Read` 로 직접 열어 전체 내용을 확인한 뒤 작성했다. 아래 수치는
> 대부분 이 저장소(현재 브랜치, `origin/main` 대비 112개 변경 파일, `review/code` 772개+
> `review/consistency` 732개 커밋된 세션)에서 직접 실행/계측한 값이며, 추정이 아니다.

## 발견사항

- **[WARNING]** `code_review_orchestrator.collect_change_infos` — 변경 파일마다 별도 `git` 서브프로세스를 다시 스폰하는 N+1 패턴 (배치 처리 가능한데 안 함)
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1292-1296` (루프 본체) — `diff_getter`/`content_getter` 는 `--branch`(`get_git_branch_diff:945`) · `--commit`(`get_git_commit_diff:899`, `get_file_at_commit:958`) · `--range`(`get_git_range_diff:922`) · 인자 없는 기본 경로(`get_git_diff_content:875`, `build_cli_change_info:978`) 전부에서 파일 1개당 `git diff`/`git show` 를 새로 실행한다.
  - 상세: `files = get_git_branch_diff_files(branch)` 로 변경 파일 목록은 **단 1회의** `git diff --name-only` 로 이미 얻어 놓고도, 뒤이어 `for fp in filtered: diff = diff_getter(fp) ...` 에서 파일마다 `git diff <branch>... -- <fp>` 를 처음부터 다시 실행한다(`--commit` 모드는 파일당 diff+content 2회). 이 저장소에서 직접 계측: `origin/main` 대비 112개 파일 기준 `get_git_branch_diff_files`(파일-목록, 서브프로세스 1회) = **0.015초**, 그런데 `collect_change_infos(--branch origin/main)`(파일당 재-diff, 서브프로세스 112회) = **1.633초** — 파일당 약 14.6ms, 약 **108배**. `--branch` 는 이 저장소 스스로가 "표준 절차"(커밋 후 리뷰는 `--branch <base>` 필수, `plan/in-progress/harness-review-gate-ci-backstop.md` §관측(1))라고 문서화한 경로라 매 리뷰 라운드가 이 비용을 지불한다. 파일 수가 큰 PR(같은 plan 문서가 언급하는 n=3000 스트레스 케이스 등)에서는 수십 초 단위로 벌어질 수 있다. 같은 저장소의 자매 함수 `consistency_orchestrator._branch_changed_rels`(`.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:204`)·`_collect_code_diff`(`:288`)는 정확히 이 반대 패턴 — "whole-repo 로 **한 번만** 호출해 하위 번들에서 재사용, subpath 파라미터를 넣으면 번들마다 git 재스폰"이라고 자체 docstring 에 명시 — 이라 고치는 방향의 레퍼런스가 같은 PR 안에 이미 있다.
  - 제안: `--branch`/`--range`/`--commit` 각각에서 전체 범위의 unified diff 를 **1회** 가져와(`git diff <range> --` 파일 필터 없이), `diff --git a/<path> b/<path>` 헤더 경계로 파일별 청크를 파싱해 나누는 방식으로 교체. `--commit` 모드의 `content_getter`(파일별 `git show <commit>:<path>`)도 동일하게 `git show --name-only`+`git archive`류 1회 호출이나, 최소한 파일 리스트가 크지 않다면 그대로 두되 diff 쪽만 먼저 배치화.

- **[WARNING]** `review_guard.evaluate_review()` — push/turn-종료마다 `review/` 전체 이력을 무조건 재스캔, 캐싱·조기종료 없음 + 동일 디렉터리 중복 walk
  - 위치: `.claude/hooks/_lib/review_guard.py` — `_iter_summaries:400`→`_newest_resolved_review_mtime:535`(Gate 1), `_iter_consistency_summaries:689`→`_newest_resolved_impl_done_mtime:729`(Gate 2), `_code_review_in_flight:774`. Stop 훅 쪽 별도 호출인 `_resolution_in_flight:852`(`.claude/hooks/guard_review_before_stop.py:397` 에서 호출)도 `review/code` 를 **또** 걷는다. push 쪽에서 여러 worktree 를 대상으로 하면 `_evaluate_over_targets:809`/`_run_gates:876`(`.claude/hooks/guard_review_before_push.py`) 가 target 개수만큼 `evaluate_review()` 자체를 반복 호출한다.
  - 상세: `_newest_resolved_review_mtime`/`_newest_resolved_impl_done_mtime` 는 필요한 값이 "가장 최근의 *resolved* 세션 하나"뿐인데도, `os.walk` 로 찾은 **모든** 커밋된 세션에 대해 매번 `_retry_state.json` 오픈+파싱, `RESOLUTION.md` 존재 확인, `SUMMARY.md` 전체 읽기+2회 라인 스캔(`_section_has_rows` ×2)을 반복하고 정렬 없이 max 만 취한다. 이 저장소에서 직접 계측: Gate 1(`_newest_resolved_review_mtime`, review/code 772세션) 0.08~0.26초, Gate 2(`_newest_resolved_impl_done_mtime`, review/consistency 732세션) 0.05~0.12초, `_resolution_in_flight` 의 별도 review/code 재순회 0.02초. 이 경로는 **매 `git push` 시도**(PreToolUse)와 **매 턴 종료**(Stop, throttle 은 "이미 nudge 했는지" 만 검사하고 `evaluate_review()` 호출 자체는 막지 않음 — `guard_review_before_stop.py:350` 의 `decision = evaluate_review(in_flight_ok=True)` 는 매 Stop 마다 무조건 실행된 뒤에야 `_nudge_once` 로 출력 여부만 걸러진다)에 무조건 실행되고, 상한 없이 `review/` 이력 총량에 선형 비례해 자란다 — `review/` 는 프로젝트 컨벤션상 영구 보존(gitignore 대상 아님, 오늘 기준 14,671개 파일)이므로 이 비용은 시간이 지날수록만 커진다. 흥미롭게도 **이번 라운드 자신의 신규 코드**(`_newest_resolved_impl_done_mtime:729` 의 `notes` 수집)는 정확히 이 함정을 피해 "채택된 세션 하나만" 검사하도록 의식적으로 설계됐다(주석 자체가 "전 이력 재경고는 +0.39초" 라고 명시) — 즉 고치는 패턴이 이미 같은 파일 안에 선례로 존재한다.
  - 제안: 세션 디렉터리명 자체가 타임스탬프(`<Y>/<m>/<d>/<H>_<M>_<S>`)이므로 최신순으로 정렬해 순회하고, 필요한 건 max 하나뿐이므로 "변경 코드 시각 이후의 resolved 세션 1개"를 찾는 즉시 조기 종료. `_code_review_in_flight`(evaluate_review 내부)와 `_resolution_in_flight`(Stop 훅에서 별도 호출) 의 `review/code` 이중 walk 는 한 번의 순회로 합치기.

- **[WARNING]** `merge_coordinator_orchestrator.py` — 동일 `git diff` 결과를 analyzer 프롬프트마다 재계산 (캐싱 부재)
  - 위치: `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py` — `format_branches_section:279`(브랜치마다 `branch_diff_stat:186` + `branch_touched_files:194`+`categorise_paths:202` 호출), `file_intersection_section:301`·`spec_plan_overlap_section:316`(브랜치마다 `branch_touched_files` 재호출), 이 전부가 `build_analyzer_prompt:366`→`prepare_session:390` 의 `for analyzer in ANALYZERS:`(4개 analyzer) 루프에서 analyzer 당 1회씩 다시 실행된다.
  - 상세: `(base, branch)` 쌍에 대한 `git diff --stat`/`git diff --name-only` 결과는 4개 analyzer 프롬프트 전체에서 동일한데, `format_branches_section` 이 analyzer 마다(4회) 브랜치별로 이 둘을 다시 호출하고, `file_intersection_section`(analyzer 2개가 사용)·`spec_plan_overlap_section`(analyzer 1개가 사용) 이 브랜치별 `branch_touched_files` 를 또 반복한다. N개 브랜치 기준 `branch_touched_files` 는 약 7N회, `branch_diff_stat` 은 약 4N회 실행되며 — 최소 필요량(브랜치당 1회씩, 2N)의 3~5배. `categorise_paths` 안의 `project_config.load(...)`(`:214`, `.claude/skills/_lib/project_config.py:124`)도 캐싱이 없어 이 호출들마다 `.claude.project.json` 을 매번 새로 열고 파싱한다. merge-coordinator 는 수동/드문 워크플로라 (push/turn-종료 훅만큼 빈번하지 않아) 절대 비용은 낮지만, 브랜치 수·diff 크기가 커지면 선형 이상으로 불어난다.
  - 제안: `--prepare` 진입 시 브랜치별로 diff-stat/touched-files/categorised-groups 를 한 번만 계산해 `branches_info[i]` 에 부착하고, 4개 프롬프트 빌더 전부가 그 캐시를 읽도록 변경.

- **[INFO]** `code_review_orchestrator.build_files_section` — reviewer 15명(14 reviewer + router) 각각을 위해 동일 파일 렌더링을 처음부터 재수행
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:509`(`build_files_section`), 호출부 `build_agent_prompt_body:712`·`build_router_prompt_body`(`prepare_session:1008` 의 `for agent in config["agents"]:` 루프, `:1018-1032`).
  - 상세: `change_infos`/`max_file_size`/`max_prompt_size` 는 15번의 호출 전부에서 동일하고 agent 별로 다른 건 헤더 텍스트 길이(수십~수백 byte, `max_prompt_size` 대비 무시할 수준)뿐인데, 파일별로 가장 비싼 단계인 `line_anchors.number_source_lines`/`annotate_unified_diff`(라인 넘버링·diff 주석, 예산과 무관한 순수 계산)까지 15회 전부 처음부터 다시 수행한다. 이 저장소 112개 파일 기준 실측: 1회 호출 12ms × 14 reviewer = 158ms. 지금 규모에선 작지만 캐싱 없이 순수 중복이며 파일 수·reviewer 수에 비례해 커진다.
  - 제안: 예산과 무관한 파일별 렌더링(번호 매김·diff 주석)은 `change_infos` 단위로 한 번만 계산해 재사용하고, 예산에 따라 달라지는 부분(파일별 포함/절단 여부, 마지막 slice)만 agent 별로 다시 계산.

- **[INFO]** 이미 팀이 실측·인지하고 의도적으로 defer 한 항목 — 재조사 결과 그대로이며 새 정보 없음 (참고용으로만 교차 확인)
  - `consistency_orchestrator.collect_context:412-415` 의 `_rank_plan_text` 이중 read — `plan/in-progress/harness-review-gate-ci-backstop.md` 자체가 "실측 규모 30개 430,929 bytes ≈3.5ms, 현재 무해, 5R 에서 코드 안 건드리기로 등재만" 이라 기록.
  - `build_files_section:509` 의 예산 전략 3갈래가 한 함수(~200줄)에 누적 — 가독성/유지보수 이슈로 이미 후속 3번에 등재. 알고리즘 자체(정렬 후 선형 스캔)는 현재 O(n log n) 수준으로 안전.
  - n≥3000 파일이면 헤더만으로 상한 초과 — 같은 문서 후속 4번, 실사용 규모 밖이라 P3.

## 요약

이번 라운드에서 새로 추가된 코드(`_shared/block_integrity.py`, `_shared/retry_state.py`, `ReviewDecision.notes`) 자체는 성능 관점에서 문제가 없다 — 오히려 `_newest_resolved_impl_done_mtime` 의 신규 `notes` 수집 로직은 "전 이력이 아니라 채택된 세션 하나만 검사"하도록 의식적으로 설계돼 있어(주석에 +0.39초 회귀를 피했다고 명시), 이 리뷰가 지적하는 것과 같은 종류의 함정을 스스로 피한 좋은 선례다. 다만 라운드 컨텍스트(직전 라운드 changeset 오구성으로 이 파일들을 사실상 처음 제대로 보는 리뷰)에 따라 전체 소스를 열어 확인한 결과, 세 갈래의 실질적 비효율이 측정됐다: (1) `code_review_orchestrator.collect_change_infos` 가 파일당 `git diff`/`git show` 를 새로 스폰하는 N+1 패턴(112파일 기준 약 108배, 이 저장소가 "표준"이라 부르는 `--branch` 경로에서 매번 발생), (2) `review_guard.evaluate_review()` 가 `git push`/턴-종료마다 무제한 성장하는 `review/` 이력 전체를 캐싱·조기종료 없이 재스캔(오늘 기준 세션 1,500개+에 0.1~0.3초, 동일 디렉터리를 함수별로 중복 순회), (3) `merge_coordinator_orchestrator.py` 가 동일 브랜치 diff 를 analyzer 4개분 반복 계산. 셋 다 정확성을 깨거나 무한 루프/타임아웃을 유발하지는 않고(모두 fail-open 설계 안에 있음) 현재 규모에서는 초 단위 이하로 억제되지만, 전부 "동일 입력에 대해 반복 재계산"이라는 같은 클래스이며 표준 캐싱/배치 호출로 손쉽게 제거 가능하고 리뷰 이력·PR 크기가 커질수록 비용이 선형 이상으로 늘어난다. `build_files_section` 의 15중 재렌더링은 현재 규모(158ms)에서는 경미하다.

## 위험도

MEDIUM
