# 테스트(Testing) 리뷰 — CI 백스톱 8R

## 발견사항

- **[CRITICAL]** `plan_guard.py` 가 `review_guard.py` 의 round-7 "선행 공백" 결함을 그대로 재현하고 있다 — PUSH 게이트를 가짜로 차단시킨다
  - 위치: `.claude/hooks/_lib/plan_guard.py:107` (`_run_git`), 관련: `:149`(`_porcelain_path`), `:169`(`_uncommitted_changes`)
  - 상세: `review_guard.py` 의 `_run_git` 는 이번 라운드 이전(round 7)에 이미 `p.stdout.strip()` → `p.stdout.rstrip()` 로 고쳐졌다(`.claude/hooks/_lib/review_guard.py:245`) — `git status --porcelain` 의 가장 흔한 형태 `" M path"`(선행 공백)가 `.strip()` 에 의해 첫 글자를 잃는 결함이었다. 그런데 **같은 판정 계열의 자매 훅** `plan_guard.py` 는 사실상 동일한 `_run_git`/`_porcelain_path`/`_uncommitted_changes` 코드를 독립적으로 복제해 갖고 있고, 거기서는 아직도 `p.stdout.strip()`(107행) 이다. 이 저장소는 정확히 이 실패 유형("손-동기 쌍은 드리프트한다")을 `report_paths`/`retry_state`/doc-sync 매트릭스에서 이미 여러 번 겪었다고 스스로 기록해 왔는데, 같은 커밋에서 review_guard 쪽만 고치고 plan_guard 쪽은 남았다.
    실제로 **이 저장소의 지금 이 브랜치**에서 재현된다(작업 트리를 변경하지 않고 읽기 전용으로 확인):
    ```
    $ git status --porcelain -- plan/
     M plan/in-progress/harness-review-gate-ci-backstop.md
    $ python3 -c "import sys; sys.path.insert(0,'.claude/hooks/_lib'); import plan_guard as pg; \
                   print(pg._uncommitted_changes('.', 'plan/'))"
    ['lan/in-progress/harness-review-gate-ci-backstop.md']   # 'p' 유실
    ```
    별도의 임시 저장소로 end-to-end 도 확인했다(코드 변경 커밋 + plan 파일 미스테이지 편집, "제일 흔한 push 흐름"): `_linked_plans` 가 정상 매칭되는 상태에서 `evaluate_plan()` 이 `untouched=True`(push 차단) 를 반환했다 — plan 파일을 실제로 갱신(체크박스 `[x]`)했는데도 "갱신되지 않음" 으로 오판한다. `plan_guard.py` 자신의 모듈 docstring(41-42행)은 "이 게이트는 오탐 차단 방향으로 fail-open 한다: 파싱 실패는 always 'not blocked'" 라고 명시적으로 약속하는데, 이 버그는 그 약속을 정확히 반대로 뒤집는다(파싱 실패가 곧 **차단**을 낳는다).
    영향 조건: (a) `codebase/**` 변경이 브랜치에 있고, (b) 그 worktree 에 링크된 in-progress plan 이 있고, (c) 그 plan 파일이 **미스테이지 상태로 수정**돼 있으며 (d) `git status --porcelain -- plan/` 출력의 **첫 줄**이 그 파일이면(연결된 plan 은 보통 1개뿐이라 사실상 기본값) — push 가 항상 잘못 차단된다. 이 프로젝트 워크플로 자체가 "plan 파일을 고치고 커밋 전에 push" 를 흔히 겪는 형태라 크래프트된 공격이 아니라 일상 흐름이다.
  - 왜 아무 테스트도 못 잡았나: `test_plan_guard.py::EvaluatePlanDecisionTableTest` (25-148행) 는 `pg._branch_changes` 자체를 `mock.patch.object` 로 통째로 스텁하고 결정 테이블만 검증한다(27-36행) — `_run_git`/`_porcelain_path`/`_uncommitted_changes`/`_committed_changes` 는 파일 전체에서 **단 한 번도 직접 구동되지 않는다**(grep 0건). 정확히 `test_review_guard_hardening.py::UnstagedModificationKeepsItsPathTest` 자신의 docstring(662-665행)이 경고하는 그 실패 형태다 — "헬퍼가 아니라 실제 저장소를 만들어 구동한다 — `_porcelain_path` 만 직접 부르면 `.strip()` 이 어디서 일어나는지를 못 본다." review_guard 쪽은 round 7 에서 이 교훈으로 실제 git 저장소 테스트를 얻었지만, 같은 교훈이 plan_guard 로 전파되지 않았다.
  - 제안: `plan_guard._run_git` 의 `p.stdout.strip()` 을 `p.stdout.rstrip()` 으로 바꾸고(review_guard.py:245 와 동일 처방), `UnstagedModificationKeepsItsPathTest` 와 대칭인 실제-git-저장소 회귀 테스트를 `test_plan_guard.py` 에 추가할 것 — 특히 "plan 파일만 미스테이지로 수정 + codebase 변경 커밋됨" 조합에서 `evaluate_plan().untouched` 가 `False` 임을 고정. 방어적으로 `-c core.quotePath=false` 도 review_guard 와 짝을 맞추는 편이 이후 drift 를 막는다(현재는 plan/ 경로에 비-ASCII 파일명이 없어 도달 불가이지만, 이번 라운드가 review_guard 쪽에서 바로 그 "미측정이라 도달 불가지만 correctness 로 넣는다" 논리를 세웠다).

- **[WARNING]** 신규 회귀 테스트가 자기 docstring 이 설명하는 더 심각한 절반을 pin 하지 않는다
  - 위치: `.claude/tests/test_review_guard_hardening.py:707`(`test_a_non_ascii_path_survives_git_quoting`, `UnstagedModificationKeepsItsPathTest` 클래스 내)
  - 상세: 이 테스트의 docstring 은 두 결과를 명시한다 — (a) `_dirty_set` 에 실제 경로가 안 들어가 방금 편집한 파일이 "clean=오래됨" 으로 읽힘, (b) `_newest_commit_time` 이 인용된 문자열을 그대로 `git log -- <path>` 에 넘겨 매칭 실패 → `0.0` → **Gate 1 이 저장소의 아무 오래된 resolved 리뷰로나 통과시킨다**(코드 주석에도 동일하게 적혀 있다, `review_guard.py` 의 `_run_git` 위 주석). 그런데 테스트 본문(709-713행)은 `_uncommitted_code_changes`/`_dirty_set` 만 단언해 (a) 만 pin 한다. (b) — 실제로 더 위험한 "Gate 1 완전 우회" — 는 어느 테스트에도 없다.
    직접 실증: `-c core.quotePath=false` 를 제거한 뮤턴트로 임시 저장소를 만들어, 오래된(2020년) resolved 리뷰 + 새 커밋(비-ASCII 파일명)인 상태에서 `evaluate_review()` 를 돌리면 `blocked=False`("covered by a fresh resolved review") 가 나온다 — docstring 이 예고한 정확히 그 완전 우회다. 반대로 **현재 실제 코드**(픽스 적용됨)로 같은 시나리오를 돌리면 `blocked=True`("changed AFTER the most recent resolved review") 로 올바르게 차단된다 — 즉 수정 자체는 옳고 완전하지만, 그 사실을 지키는 회귀 테스트가 없다. 이 특정 수정은 단일 관문(`_run_git`)에 있어 오늘의 뮤턴트(플래그 제거)는 기존 (a)-단언 테스트만으로도 우연히 잡히지만, 그건 "관문이 하나뿐이라서" 이지 테스트가 (b)를 검증해서가 아니다 — 나중에 `_run_git` 을 호출부별로 분기하거나 이 결과 경로만 별도 처리하는 리팩터가 들어오면 (a) 는 GREEN 인 채 (b) 만 조용히 재발할 수 있다.
  - 제안: 같은 클래스에 `_committed_code_changes`/`_newest_commit_time` 경로(커밋된 비-ASCII 파일)를 통과하는 단언을 추가하거나, `evaluate_review()` 전체를 구동해 "오래된 resolved 리뷰 + 새 비-ASCII 커밋" 조합이 여전히 차단됨을 고정할 것 — 테스트가 자기 docstring 이 약속한 성질을 실제로 검증하도록.

- **[INFO]** 신규 회귀 테스트의 유효성이 앰비언트 git 설정에 결합돼 있다
  - 위치: `.claude/hooks/_lib/review_guard.py:224`(`_run_git`), `.claude/tests/test_review_guard_hardening.py:707`
  - 상세: `_run_git` 의 `subprocess.run` 은 `env=` 를 넘기지 않아 테스트 프로세스의 환경을 그대로 물려받는다. 코드 자체는 `-c core.quotePath=false` 를 명령줄에 직접 주므로(최고 우선순위) 실제 동작은 결정적이지만, "그 플래그를 제거하면 테스트가 실패하는가" 라는 뮤턴트 유효성은 **호스트의 전역/시스템 gitconfig 가 이미 `core.quotePath=false` 를 켜놓지 않았다는 가정**에 기댄다. 이 파일의 다른 헬퍼(`_git()`, `_write()`)는 git init/commit 호출에 `GIT_CONFIG_GLOBAL=os.devnull` 를 명시적으로 격리하는데(review_guard.py:224 인접 클래스들의 관행), `rg._run_git` 자체가 만드는 subprocess 호출에는 그 격리가 없다. 현재 이 저장소/이 머신에서는 문제가 재현되지 않음을 직접 확인했다(뮤턴트 테스트로 RED 확인 완료). 심각도는 낮지만, 이 스위트가 도처에서 지키는 "hermetic 하게" 관행과 비대칭이다.
  - 제안: 급하지 않음. `_run_git` 이 프로덕션에서 계속 앰비언트 환경을 쓰는 한 테스트만 격리해도 반쪽짜리이므로, 우선순위는 낮게 등재만 해 둘 것.

- **[INFO]** `.claude/tests/README.md` 의 `test_review_guard_hardening.py` 행이 이번 라운드의 신규 테스트를 반영하지 않았다
  - 위치: `.claude/tests/README.md:57`
  - 상세: 같은 diff 에서 `test_review_gate_ci.py`/`test_workflow_yaml_structure.py` 행은 라운드 5-8 변경을 아주 상세히 갱신했는데(README.md 의 해당 행들), `test_review_guard_hardening.py` 행은 예전 그대로다 — 새로 추가된 `test_a_non_ascii_path_survives_git_quoting`(C-quoting/비-ASCII 경로 회귀) 언급이 없다. `test_tests_readme_catalog.py` 는 파일당 행의 **존재**만 검사하고 행 **내용**의 완전성은 검사하지 않으므로 이 누락은 어떤 테스트로도 못 잡는다. 이 저장소가 반복해서 "손-동기 문서 쌍은 드리프트한다" 를 교훈으로 남겨온 만큼, 사소하지만 같은 클래스다.
  - 제안: 한 문장 추가해 최신화. 급하지 않음.

- **[INFO]** SUMMARY.md 위조 가능성(문서화된 기존 결함, 이번 라운드 발견)에 대한 캐너리 테스트가 없다
  - 위치: `plan/in-progress/harness-review-gate-ci-backstop.md:245`(§`⛔ --enforce 전환의 선행 조건`)
  - 상세: 이번 라운드에 새로 문서화된 관측 — 게이트는 "리뷰가 실제로 수행됐는가" 가 아니라 "산출물의 존재와 텍스트 형태" 만 보므로, 손으로 쓴 3줄짜리 `SUMMARY.md` 만으로 `--enforce` 통과가 가능함을 실증했다. 설계상 받아들여진 한계(플랜 문서가 (a)/(b)/(c) 세 대안을 놓고 아직 미결정이라고 명시)이지 이 라운드가 만든 결함은 아니다. 다만 이 저장소는 다른 "받아들여진 잔여 한계"(예: `test_block_integrity.py::SpecGlobCompilationIsBoundedTest.test_over_the_cap_matches_everything_not_nothing`, `test_push_guard_allowlist.py::KnownFalseNegativeTest`)를 **행동으로 고정하는 캐너리 테스트**를 남겨 왔는데, 이 잔여 한계는 prose 로만 존재하고 테스트가 없다. 지금의(의도된) 신뢰 모델을 못박아 두면, 나중에 누군가 "고쳤다" 고 착각하고 조용히 강화/약화시키는 것을 알아챌 수 있다.
  - 제안: 우선순위 낮음(설계 결정이 선행). 결정이 나기 전에 급히 테스트를 추가할 필요는 없으나, 결정이 내려질 때 함께 등재할 항목으로 기록해 둘 만하다.

## 요약

이번 라운드(8R) 자체가 손댄 코드(`review_guard.py` 의 `core.quotePath=false` 픽스 + 신규 테스트)는 견고하다 — 직접 뮤테이션 테스트로 양방향(픽스 있음/없음)을 실측해 회귀 테스트가 실제로 유효함을 확인했고, 심각한 절반(committed 경로의 Gate 1 완전 우회)도 코드 자체는 올바르게 닫혀 있음을 별도로 실증했다(다만 그 절반을 지키는 전용 단언은 없다 — WARNING). 그런데 이 CI 백스톱 계열을 넓게 훑는 과정에서, **이번 diff 밖에 있는 진짜 살아있는 결함**을 하나 찾았다: `plan_guard.py` 가 `review_guard.py` 의 round-7 "선행 공백" 결함을 그대로 복제해 갖고 있고, 이 저장소의 실제 작업 트리로 직접 재현된다. `test_plan_guard.py` 가 git 파싱 헬퍼를 전부 목으로 우회하기 때문에 이 결함은 어떤 테스트로도 검출되지 않는다. 이 저장소가 review_guard 쪽에서 8라운드에 걸쳐 배운 "행위 기반·실제 저장소 기반 테스트" 교훈이 자매 훅으로 전파되지 않은 사례이며, PUSH 게이트를 부당하게 차단하는 방향(오탐 차단)이라 조용히 넘어가기보다 지금 고치는 편이 낫다. 이 CRITICAL 을 제외하면 나머지는 문서 동기화·테스트 완전성 수준의 INFO/WARNING 이다.

## 위험도

CRITICAL
