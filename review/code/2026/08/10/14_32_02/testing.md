# 테스트(Testing) 리뷰

## 조사 방법

프롬프트가 diff 를 생략한 파일(`code_review_orchestrator.py`, `.claude/tests/README.md`,
`test_review_prepare_single_session.py` 등)은 `git diff bfea0a10f...HEAD -- <path>` 로
직접 열람했고, `.claude/tests/test_line_anchors.py`·`test_review_prepare_single_session.py`
전문을 `Read` 했다. `cd .claude/tests && python3 -m pytest test_review_prepare_single_session.py -q`
로 신규 테스트 19건 전부 실행해 통과를 실측했고(`19 passed`), `test_line_anchors.py::CommitFixtureSelectionTest`
3건도 별도 실행해 통과를 확인했다. `git log -S`/`git show <commit>:<path>` 로 테스트 개수의 시계열
변화(17→19)를 커밋별로 대조했다.

이 changeset 은 `--prepare` 가 이 공유 워크트리의 미커밋 상태를 그대로 담기 때문에, 실제 작업 대상
8개 파일(`.claude/commands/ai-review.md`, `code-review-agents/README.md`·`SKILL.md`·
`scripts/code_review_orchestrator.py`, `.claude/tests/README.md`·`test_line_anchors.py`·
`test_review_prepare_single_session.py`, `plan/in-progress/harness-review-gate-followups.md`) 외에
다른 동시 세션이 이 worktree 에 남긴 `review/code/**`·`review/consistency/**` 산출물(마크다운/JSON
리포트) 70여 개가 함께 프롬프트에 실렸다. 이들은 테스트 가능한 소스 코드가 아니라 리뷰 결과물이므로
테스트 관점 평가 대상이 아니다 — 아래 발견사항은 실제 작업 대상 8개 파일에 한정한다.

## 발견사항

- **[WARNING]** `pick_commit_fixture` 의 신규 "삭제-전용 커밋 거르기" 가드를 직접 겨냥하는 테스트가 없다 — 같은 함수의 자매 가드(merge 커밋 거르기)는 전용 synthetic-repo 테스트를 갖고 있는데 이번 가드만 없다
  - 위치: `.claude/tests/test_line_anchors.py:110-119` (`pick_commit_fixture` 내부, `if any(_git("show", f"{sha}:{f}", cwd=cwd).strip() for f in sorted(files)):`), 비교 대상 `.claude/tests/test_line_anchors.py:539-629` (`CommitFixtureSelectionTest` — merge 커밋 케이스만 다룸)
  - 상세: `pick_commit_fixture` 의 docstring 은 지금까지 같은 클래스의 실패를 두 번 겪었다고 기록한다(문서-전용 커밋의 임계값 미달, merge 커밋의 `--numstat`/`--name-only` 불일치) — 그리고 이번 삭제-전용 커밋이 "세 번째 변종"이라고 스스로 적고 있다. 앞의 두 실패 중 merge 케이스는 `CommitFixtureSelectionTest._make_repo` 로 **직접 재현 가능한 purpose-built 저장소**를 만들어 `test_a_merge_commit_is_never_selected` 로 고정했는데, 그 클래스 docstring 이 이유를 명시한다: "이 저장소 자신의 히스토리에는 이 모양이 없다(squash merge) — 아무도 초록으로 유지할 수 없는 가드는 가드가 아니다." 그런데 이번 삭제-전용 가드는 그 원칙을 따르지 않는다 — 커밋 메시지(`ffb2cfbe5`)의 검증도 "수정 후 픽커가 `e4ce8adf8` 을 건너뛰고 `b35bd23ca` 를 고른다(실측)" 라는 **1회성 수동 관찰**뿐이고, 회귀 스위트 어디에도 이 분기를 결정적으로 재현하는 fixture 가 없다. `grep -in delet .claude/tests/test_line_anchors.py` 로 확인한 결과 "deletion"/"삭제" 를 언급하는 곳은 가드 자체의 주석 3곳뿐이다.
    현재의 "커버리지"는 실 저장소 히스토리에 의존하는 간접·우연적인 것이다 — `pick_commit_fixture()` 를 인자 없이 호출하는 `PromptPayloadIntegrationTest._prepare_commit()`/`GutterCorrectnessAgainstRealGitTest` 가 `FIXTURE_SEARCH_DEPTH=40` 범위 안에 실제 삭제-전용 커밋이 들어와 있을 때만 우연히 이 가드를 통과시켜 보게 되는데, docstring 이 근거로 든 `e4ce8adf8` 은 이후 커밋이 쌓이면서 결국 그 40-커밋 창 밖으로 밀려난다. 즉 이 가드를 무력화하는 뮤테이션(예: `any()`→`all()`, 블록 전체 삭제, 조건 반전)은 지금 당장은 `main...HEAD` 근처에서 우연히 잡힐 수 있어도, 시간이 지나면 회귀 스위트 전체가 그 결함에 대해 조용해진다 — 이 파일이 반복적으로 스스로 경계하는 정확히 그 패턴("어쩌다 초록"인 가드)이다.
  - 제안: `CommitFixtureSelectionTest` 에 `_make_repo` 와 대칭되는 헬퍼(예: `_make_deletion_only_repo`)를 하나 추가해 "최신 커밋이 파일을 대량 삭제만 하고 남은 콘텐츠가 없는" 저장소를 만들고, `pick_commit_fixture(cwd=repo)` 가 그 커밋을 건너뛰고 그 이전(내용이 남아있는) 커밋을 고르는지 결정적으로 단언한다. `test_the_repo_really_has_the_asymmetry` 와 대칭되는 비-vacuous 전제 확인(그 커밋에서 `_git("show", f"{sha}:{f}")` 가 전부 빈 문자열인지)도 함께 두면 이 클래스의 기존 규율과 일치한다. "테스트의 테스트"로 보이지 않는 이유: 새로 추가하는 것은 가드 로직에 대한 메타 테스트가 아니라, merge 케이스와 **동일한 지위의 세 번째 회귀 fixture**일 뿐이다 — 이미 이 파일이 "가드 하나당 purpose-built 저장소 하나"라는 관례를 스스로 세워 뒀고, 이번 항목만 그 관례에서 벗어났다.

- **[INFO]** plan 문서의 테스트 개수 서술(`17건`)이 같은 날 후속 커밋으로 이미 stale — 실제(HEAD)는 19건
  - 위치: `plan/in-progress/harness-review-gate-followups.md` (`test_review_prepare_single_session.py 17건, 뮤테이션 5/5 RED` 서술)
  - 상세: `git show 50d877bd9:.claude/tests/test_review_prepare_single_session.py | grep -c 'def test_'` = 17 로, 이 숫자는 router fail-closed 커밋(`50d877bd9`) 시점 기준으로는 정확했다. 그런데 같은 날 후속 커밋 `ffb2cfbe5`(리뷰 3건 반영 — `_warn_large_changeset` 호출부 call-site 단언 2건 추가)가 같은 파일에 테스트 2건을 더해 HEAD 기준 19건이 됐는데(`cd .claude/tests && python3 -m pytest test_review_prepare_single_session.py -q` 로 실측: `19 passed`), plan 문서의 "17건" 서술은 갱신되지 않았다. 실질 위험은 낮다(숫자가 근거로 쓰이는 결정이 없음) — 다만 이 저장소의 "plan 서술이 실제 상태와 어긋나면 안 된다" 는 반복 교훈에 정확히 해당하는 사소한 드리프트다.
  - 제안: "17건" 을 "19건"으로 갱신하거나, 정확한 시점을 특정하는 문구("router fail-closed 반영 시점 기준 17건")로 바꾼다. 급하지 않음.

- **[INFO]** (이전 라운드 지적, 여전히 open) `_bulleted_path_sample`/`_source_files_missing_from_changeset` 의 20개 초과 절단(`… 외 N개`) 분기가 여전히 미검증
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py` 의 `_bulleted_path_sample` (`_ROUTER_PATH_SAMPLE_MAX = 20`), 소비처 `DocsOnlyFramingIsCrossCheckedTest`(`.claude/tests/test_review_prepare_single_session.py`)는 `unseen` 이 1개인 케이스만 검증
  - 상세: `review/code/2026/08/10/14_09_31/testing.md` 가 이미 이 갭을 INFO 로 지적했고 `ffb2cfbe5` 는 그 라운드의 WARNING 4건은 전부 해소했지만 이 INFO(급하지 않음으로 명시)는 손대지 않았다 — 의도된 defer 로 보인다. `_bulleted_path_sample` 이 이제 두 호출부(소스 파일 목록, 누락 소스 목록)에서 공유되므로, 21개 이상 입력에 대한 회귀 1건만 추가해도 두 호출부를 동시에 커버한다.
  - 제안: 급하지 않음. 다음에 이 영역을 만질 때 `unseen`/`src_paths` 21개 이상 케이스 1건을 추가.

## Mock 적절성 / 테스트 격리

`_harness.run_in_orchestrator` 가 매 테스트를 fresh subprocess 인터프리터로 띄우는 구조는 hooks/skills
양쪽이 각자 `_lib` 라는 이름의 모듈을 갖고 있어 in-process import 시 충돌하는 문제를 피하면서, 동시에
`orch.load_config`/`orch.prepare_session`/`orch._default_branch_ref` 같은 모듈 전역을 몽키패치해도
테스트 간 상태가 새지 않게 만든다. `ForcedSetShrinksWithTheChangesetTest._forced` 의 docstring 이 첫
초안에서 이 함정에 실제로 걸렸던 이력을 남겨 둔 것도(정직한 실패 기록) 신뢰도를 높인다.
`PrepareEmitsExactlyOneSessionTest` 가 `orch.prepare_session` 을 완전히 페이크로 치환한 것은 이
스위트가 검증하려는 계약("changeset 을 쪼개지 않고 한 번만 호출한다")에 정확히 맞는 최소 mock 이고,
실제 세션 디렉터리 생성 부작용까지 검증할 필요가 없으므로 과잉이 아니다. `DocsOnlyFramingIsCrossCheckedTest`
도 `orch.get_git_branch_diff_files`/`orch._default_branch_ref` 만 치환하고 나머지 실제 로직
(`router_safety.source_files`, `build_router_prompt_body`)은 그대로 통과시켜 실제 동작과의 괴리가 없다.

## 엣지 케이스 · 회귀

경계값(`n==batch_size`, `batch_size=0`), vacuous 방지(`test_the_fixture_actually_discriminates` 가
"소스 파일만으로도 실제로 6개 reviewer 를 강제하는지"를 먼저 확인), git 실패 흡수
(`test_git_failure_is_absorbed_not_propagated`), base 미해결(`test_unresolvable_base_is_silent`)
등은 모두 겨냥이 정확하다. 회귀 스위트(`test_review_prepare_single_session.py` 19건,
`test_line_anchors.py::CommitFixtureSelectionTest` 3건)를 직접 실행해 이번 diff 반영 상태에서
전부 통과함을 실측했다. `.claude/tests/README.md` 카탈로그도 `test_review_prepare_single_session.py`
설명을 정확히 갖고 있어 `test_tests_readme_catalog` 류 동기화 가드와 어긋나지 않는다.

## 요약

핵심 변경(배치 분할 제거, `_warn_large_changeset` stderr 안내, router fail-closed 교차검사
`_source_files_missing_from_changeset`)은 `test_review_prepare_single_session.py` 19건으로
빈틈없이 커버되며, 직전 라운드가 지적한 "`_warn_large_changeset` 호출부 미관측" WARNING 은
stderr 포획 + call-site 단언 2건으로 정확히 해소됐고 실행으로 재확인했다. 반면 같은 커밋
(`ffb2cfbe5`)이 부수적으로 노출·수정한 `pick_commit_fixture` 의 삭제-전용 커밋 가드는, 같은 함수의
자매 가드(merge 커밋)가 갖고 있는 purpose-built synthetic-repo 회귀 테스트에 준하는 전용 커버리지가
없다 — 지금은 실 저장소 히스토리에 우연히 의존하고, 그 근거 커밋은 시간이 지나면 검색 창 밖으로
밀려난다. 이는 "테스트의 테스트"가 아니라 이 파일이 스스로 세운 관례(가드 하나당 fixture 하나)의
누락이므로 WARNING 으로 판정한다. 그 외에는 plan 문서 숫자 드리프트(17→19)와 이전부터 defer 된
20개 초과 절단 분기 미검증 정도의 INFO 뿐이다.

## 위험도

MEDIUM
