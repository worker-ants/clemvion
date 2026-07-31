# Side Effect 리뷰 보고서

## 발견사항

- **[INFO]** `collect_context()` 전 모드에 git diff 서브프로세스 호출이 새로 추가됨
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` 함수 `collect_context`(정의 434줄) 내부 `_rank_changed = _branch_changed_rels(diff_base, root)`(458줄) / `_rank_plan_text = ...`(459줄)
  - 상세: origin/main 기준 이전 코드에서는 `diff_base = args.diff_base or "origin/main"` 및 그것을 쓰는 git diff 호출이 `elif args.impl_done:` 분기 **안에서만** 계산됐다(직접 `git show origin/main:...` 로 대조 확인). 이번 변경으로 `diff_base`/`_branch_changed_rels(diff_base, root)`(내부에서 `git diff --no-renames --name-only <base>...HEAD -- .` subprocess 실행)와 `plan/in-progress/**` 전체 마크다운 텍스트 읽기(`_rank_plan_text`)가 함수 진입 직후 **`--spec`/`--plan`/`--impl-prep`/`--impl-done` 전 모드에 대해 무조건** 실행되도록 바뀌었다. 즉 이전엔 git 상태와 전혀 무관했던 `--spec`/`--plan` 모드도 이제 `origin/main` ref 해석에 암묵적으로 의존한다.
  - 근거: `.claude/skills/consistency-checker/SKILL.md`("이 base 는 전 모드 공통으로 번들 우선순위 산정에도 쓰인다")에 명시적으로 문서화돼 있고, `_branch_changed_rels`는 실패 시 빈 집합으로 조용히 폴백하도록 구현돼 있으며 `test_unknown_base_yields_empty_not_an_exception`(`test_consistency_bundle_priority.py`)로 그 fail-open 이 고정돼 있다. 의도된 확장으로 판단되며 CRITICAL/WARNING 요건은 아니지만, "이전에 git 을 참조하지 않던 코드 경로가 이제 외부 프로세스 호출에 의존" 이라는 점과 "plan_dir 마크다운을(우선순위 산정용 1회 + 번들 조립용 1회) 중복해서 읽는다"는 점은 side-effect 관점에서 인지해 둘 가치가 있다.
  - 제안: 의도된 설계라면 그대로 두되, `--spec`/`--plan` 모드에서 `origin/main` 이 fetch 되지 않은 환경(얕은 clone 등)에서도 항상 안전 폴백하는지 별도 회귀 테스트로 명시 고정 권장.

- **[INFO]** `evaluate_review()` 시그니처 변경 — 하위 호환 확인 완료
  - 위치: `.claude/hooks/_lib/review_guard.py` 함수 `evaluate_review`(정의 862~864줄, 게이트 조건 901줄), 호출부 `.claude/hooks/guard_review_before_stop.py:344`
  - 상세: `evaluate_review(cwd=None)` → `evaluate_review(cwd=None, *, in_flight_ok: bool = False)`. 새 파라미터는 키워드 전용이고 기본값이 "억제 안 함"(더 엄격한 방향)이라 하위 호환이다. 저장소 전체에서 실제 호출부를 확인한 결과: `guard_review_before_push.py`는 `_evaluate_over_targets`를 경유해 `evaluate(target)`처럼 위치 인자만 넘기므로(코드 자체는 이번 diff 에서 무변경) 자동으로 in-flight 억제를 적용받지 않고, `guard_review_before_stop.py:344`만 명시적으로 `in_flight_ok=True`를 전달한다. 이 시그니처 변경이 바로 이번 PR 의 핵심 수정(공유 함수의 무조건적 in-flight 억제가 push 하드게이트까지 최대 30분간 열어주던 결함, `plan/in-progress/harness-review-gate-ci-backstop.md` §관측(2))이며, `test_push_never_opts_into_the_in_flight_concession`/`test_stop_passes_in_flight_opt_in`/`EvaluateInFlightShortCircuitTest` 로 양방향이 고정돼 있다. 전체 테스트(`python3 -m unittest discover -s .claude/tests`, 702건, `OK`)를 직접 실행해 회귀 없음을 확인했다.
  - 제안: 없음 (검증 완료, 안전한 additive 변경).

- **[INFO]** 리뷰 세션 도중 `.claude/hooks/_lib/review_guard.py` 의 일시적·비커밋 변조 관측 — 이 diff 자체에 귀속할 근거는 없음
  - 위치: `.claude/hooks/_lib/review_guard.py`, `evaluate_review` 내부 `in_flight_ok` 게이트(901줄 부근)
  - 상세: 본 리뷰 중 전체 테스트 스위트(`python3 -m unittest discover -s .claude/tests`, 66.7초 소요)를 실행한 직후 `git status`로 이 파일이 **modified** 상태임을 관측했다. `git diff`는 이번 PR이 도입한 `if in_flight_ok and _code_review_in_flight(repo_root):` 가드가 `if _code_review_in_flight(repo_root):  # MUTATED: dropped in_flight_ok gate`로 되돌아간 내용을 보여줬다 — 정확히 이 PR이 고친 취약점이 재도입된 형태다. 곧이어 재확인하니 이미 HEAD와 동일하게 복구돼 있었고, 동일 커맨드를 단독으로 재실행해도 재현되지 않았다(폴링 스크립트로 확인, `FOUND=0`). 이 세션 `meta.json`과 산출물 디렉터리 타임스탬프를 보면 **14개 reviewer sub-agent(testing·concurrency 포함)가 같은 비격리 공유 워크트리에서 동시 실행 중**이며 `documentation.md`/`dependency.md`/`performance.md` 등이 리뷰 도중에도 계속 갱신되고 있었다 — 이 변조는 이 PR의 코드나 테스트 자체의 결정론적 결함이라기보다 **동시 실행 중인 다른 세션과의 경합**(예: plan 문서가 서술하는 "mutation N종 RED" 검증을 수작업 Edit로 재현 중인 sibling reviewer, 또는 sibling 이 같은 테스트 스위트를 병행 실행)일 가능성이 높다. 저장소 어디에도 "MUTATED" 리터럴을 생성하는 스크립트가 없고(전수 grep 확인), 동일 커맨드 재실행으로도 재현되지 않아 이 diff의 테스트 코드가 결정론적으로 실제 파일을 mutate-in-place 한다는 증거는 찾지 못했다.
  - 제안: 최종 확인 결과 현재 워크트리는 깨끗하며(`git status`/`git diff HEAD` 모두 빈 결과) HEAD와 정확히 일치하므로 이 리뷰 시점 기준 즉각 조치는 불요. 다만 (1) push/커밋 직전 `git status` 재확인을 권장하고, (2) `.claude/tests/` 내에 실제 hook 파일을 원본 경로에서(임시 복사본이 아니라) 직접 mutate-then-restore 하는 테스트가 있는지는 이 PR 범위를 벗어나는 별도 감사로 확인할 가치가 있다 — 이 프로젝트는 정확히 이 실패 클래스(가드 mutation 원복 관련 결함, 예: `test_stop_guard_failopen.py`/`test_guard_review_before_push_main.py`가 채택한 "임시 디렉터리로 복사 후 그 사본만 변경" 패턴)를 과거에 겪은 이력이 있다.

## 요약
이번 diff 의 핵심 변경 — `evaluate_review()`에 `in_flight_ok` 키워드 전용 파라미터 추가, 리뷰 프롬프트가 예산 초과로 파일을 조용히 누락시키던 것을 안내 문구로 명시화, consistency 번들 우선순위 산정 신설 — 은 모두 기존 호출부·시그니처를 하위 호환적으로 확장했으며, `review_guard.py`/`guard_review_before_stop.py`/`code_review_orchestrator.py`/`consistency_orchestrator.py`의 실제 diff(`git diff origin/main...HEAD`)를 직접 대조하고 저장소 전체 테스트(`python3 -m unittest discover`, 702건, `OK`)를 실행해 회귀가 없음을 확인했다. 새 전역 변수·의도치 않은 환경변수 읽기/쓰기·네트워크 호출·이벤트 콜백 변경은 발견되지 않았다. 유일하게 주목할 점은 (a) consistency 오케스트레이터의 번들 우선순위 산정이 이제 `--spec`/`--plan` 모드에도 무조건 git 서브프로세스 호출을 추가한다는 것(문서화·fail-open 테스트가 있어 위험은 낮음)과, (b) 리뷰 도중 공유 워크트리에서 이 PR이 고친 바로 그 코드가 일시적으로 원복(회귀)된 상태를 관측했으나 즉시 자연 복구됐고 재현되지 않았다는 점이다 — 후자는 14개 reviewer sub-agent가 동시에 같은 비격리 워크트리에서 실행 중인 정황과 맞물려 동시성 경합으로 추정되며, 이 diff 자체의 결함으로 귀속할 근거는 찾지 못했다(현재 워크트리는 HEAD와 완전히 일치하는 클린 상태로 확인 종료). 전반적으로 부작용 관점의 위험은 낮다.

## 위험도
LOW
