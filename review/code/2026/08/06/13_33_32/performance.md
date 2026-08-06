# 성능(Performance) Review — CI 백스톱 9R

## 발견사항

- **[WARNING]** `evaluate_review()` 가 매 호출마다 `review/code`·`review/consistency` 전체 이력을 선형 재스캔한다 — 캐시·조기종료 없음. 호출 지점이 이번 브랜치로 하나 더 늘었다(로컬 push + Stop(매 turn) + 신규 CI 백스톱).
  - 위치: `.claude/hooks/_lib/review_guard.py:438` (`_iter_summaries`, `os.walk` 전체), `:573` (`_newest_resolved_review_mtime`, 모든 세션에 대해 `_summary_is_resolved` 호출 후 max 취함 — 최신 것 찾으면 멈추지 않음), `:755`(`_iter_consistency_summaries`), `:795`(`_newest_resolved_impl_done_mtime`, 동일 패턴), `:1021-1022`(`evaluate_review` Gate 1 이 두 함수를 호출), `.claude/hooks/guard_review_before_stop.py:350`(`decision = evaluate_review(in_flight_ok=True)` — **매 Stop 이벤트마다 무조건 호출**. throttle(`_already_nudged`, 같은 파일 383행)은 재출력되는 *메시지*만 억제하고 이 계산 자체는 매번 다시 돈다).
  - 상세: `_iter_summaries`/`_iter_consistency_summaries` 는 `review/code`·`review/consistency` 트리 **전체**를 `os.walk` 하고, 발견한 모든 `SUMMARY.md` 에 대해 `_summary_is_resolved()`(`_retry_state.json` 파싱 + 리포트 존재 확인 + 필요시 SUMMARY 전문 읽기)를 실행한 뒤 그중 "resolved" 인 것들의 세션-디렉터리 타임스탬프의 max 를 구한다. **오직 가장 최신 1건만 필요한데도 이력 전체를 매번 훑는다.** 디렉터리 명명(`<Y>/<m>/<d>/<H>_<M>_<S>`)이 이미 시각순으로 정렬 가능함에도 `os.walk` 순서를 그대로 쓰고, "resolved 세션을 찾으면 중단" 같은 조기 종료도 없다.
    이 함수는 세 곳에서 소비된다: (1) 로컬 `git push` 훅(`guard_review_before_push.py`, 1회/push), (2) **Stop 훅 — 코드 변경이 있는 브랜치에서는 매 assistant turn 종료마다 무조건**(위 `:350`, throttle 미적용), (3) 이번 브랜치가 신설한 CI 백스톱(`scripts/check-review-gate.py` → `.github/workflows/review-gate.yml`, PR 이벤트마다). (2)가 특히 크다 — 코딩 작업 중인 브랜치에서는 "리뷰가 아직 안 됐다"는 답을 얻기 위해서도 매 턴 전체 이력을 다시 훑는다(짧은 값이 이미 알려진 값이라도 캐시가 없다).
  - **실측 (이 저장소, 읽기 전용 — 수정 없음)**:
    ```
    $ python3 -c "... rg._iter_summaries/_newest_resolved_review_mtime/_iter_consistency_summaries/_newest_resolved_impl_done_mtime/_spec_code_patterns/evaluate_review ..."
    _iter_summaries: 808 found in 0.0283s
    _newest_resolved_review_mtime: 0.1690s -> best=1785988361.0
    _iter_consistency_summaries: 738 found in 0.0177s
    _newest_resolved_impl_done_mtime: 0.1114s -> best=1785579995.0
    _spec_code_patterns: 505 patterns in 0.0331s
    evaluate_review total: 0.0928s -> blocked=False
    ```
    `origin/main` 실측: `review/code` 아래 `SUMMARY.md` 800개, `review/consistency` 아래 738개, `spec/**/*.md` 383개 — 전부 계속 증가 중(이 plan 문서 자체가 라운드마다 세션을 새로 쌓는 프로젝트).
  - **선형 증가 확인 (자체 임시 디렉터리, 저장소 미변경)**:
    ```
    n=  200  iter_summaries=0.0062s  newest_resolved_review_mtime=0.0133s  total=0.0195s
    n=  800  iter_summaries=0.0231s  newest_resolved_review_mtime=0.0519s  total=0.0750s
    n= 1600  iter_summaries=0.0478s  newest_resolved_review_mtime=0.1074s  total=0.1552s
    n= 3200  iter_summaries=0.0846s  newest_resolved_review_mtime=0.2307s  total=0.3154s
    ```
    (스크립트: `mktemp -d` 후 `review/code/<Y>/<m>/<d>/<H>_<M>_<S>_<i>/SUMMARY.md` n개 생성 → `_iter_summaries`/`_newest_resolved_review_mtime` 타이밍. 실제 저장소는 건드리지 않음.) n 을 4배 늘리면 시간도 정확히 ~4배 — 캐시·인덱스 없는 순수 O(N). `_retry_state.json` 이 없는 합성 코퍼스인데도(실저장소 값 0.169s 대비 0.052s@n=800) `_forced_coverage_missing` 의 JSON 파싱+리포트 존재확인 오버헤드가 세션당 추가로 붙는다는 것도 확인된다(약 3.25배 차).
  - 이 계산이 틀린 판정을 내는 것은 아니다(correctness 문제 아님) — 순수하게 지연시간 문제다. 하지만 매 turn(Stop) · 매 push · 매 PR CI 에서 반복되고, 코퍼스는 무기한 계속 자란다(이 저장소는 하루에도 여러 라운드 리뷰 세션을 쌓는다). 이번 브랜치는 그 위에 **PR마다 도는 새 소비자**(CI)를 추가해 같은 비용을 CI 러너에서도 매번 지불하게 만든다 — GitHub 러너는 로컬보다 캐시가 덜 따뜻하고, `fetch-depth: 0` 체크아웃 자체도 이력 크기에 비례해 커진다(이건 merge-base 계산에 필요한 correctness 요건이라 별도로 문제 삼지 않음 — plan 문서에 "실측 불가" 로 이미 등재돼 있음).
  - 제안: 세션 디렉터리 이름이 이미 `Y/m/d/H_M_S` 로 정렬 가능하므로, `os.walk` 대신 연도→월→일→세션을 **내림차순으로 순회하며 첫 resolved 세션을 찾는 즉시 반환**하도록 바꾸면(정상 상태에서는 "최신 세션이 resolved" 인 경우가 대부분이므로) 사실상 O(1)에 가까워진다. 상태 파일 기반 캐시(무효화 로직 필요)보다 단순하고 정확성 리스크가 없다. `_newest_resolved_impl_done_mtime` 도 동일 패턴.

- **[INFO]** Gate 2 가 Gate 1 이 이미 조회한 파일 부분집합에 대해 `git log` 를 한 번 더 돌린다 (중복 계산).
  - 위치: `.claude/hooks/_lib/review_guard.py:1021`(`newest_code = _newest_code_mtime(repo_root, changed, dirty)`) vs `:1044`(`newest_spec_code = _newest_code_mtime(repo_root, spec_linked, dirty)`, `spec_linked ⊆ changed`).
  - 상세: `spec_linked` 는 `changed` 의 부분집합인데, 그 부분집합의 author-date 최댓값을 구하려고 `_newest_commit_time`(`:337`)이 별도 `git log --format=%at HEAD -- <paths>` 서브프로세스를 다시 띄운다. `changed` 전체에 대해 이미 파일별 author-date 를 계산했다면(현재는 max 만 리턴하고 파일별 값을 버림) 재사용 가능. 파일 수·git 로그 규모가 크지 않은 한 체감 비용은 미미하지만(서브프로세스 1회 추가), "불필요한 연산" 항목으로 등재.
  - 제안: `_newest_commit_time` 을 `{path: author_date}` 맵을 반환하도록 바꾸고 Gate 1/Gate 2 가 한 번의 `git log` 결과를 공유하도록 하면 서브프로세스 호출이 절반으로 준다.

- **[INFO]** 하네스 테스트 스위트가 라운드마다 늘어나는 추세이고, 다수가 실제 git 저장소를 서브프로세스로 구동한다(멤버리 규칙 "헬퍼가 아니라 실제 저장소로 구동" 준수의 대가).
  - 위치: `.claude/tests/test_review_guard_hardening.py`, `test_plan_guard.py`(`PorcelainPathSurvivesOnARealRepoTest`), `test_review_gate_ci.py`, `test_stop_guard_failopen.py` 등 — 각 `setUp` 이 `git init` + 커밋을 서브프로세스로 실행.
  - 실측(이 저장소, 읽기 전용): `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` → **844 tests, 84.952s**. `harness-checks.yml` 의 `timeout-minutes: 5`(300s) 대비 아직 여유(≈28%)가 있지만, 8라운드에 걸쳐 매번 실제-저장소 기반 테스트가 추가돼 온 추세를 볼 때 감시할 값이다. 지금 당장 조치가 필요한 수준은 아니라 INFO.

- **[INFO]** `review-gate.yml` 의 `fetch-depth: 0`(전체 이력 체크아웃)은 `_merge_base`/`_newest_commit_time` 이 요구하는 correctness 전제이고, 저장소 이력이 자랄수록 체크아웃 자체도 선형으로 느려진다. `Fetch base ref` step 의 필요성은 실제 Actions 러너 없이 측정 불가하다고 이미 plan 문서(`plan/in-progress/harness-review-gate-ci-backstop.md:2518-2520`)에 등재돼 있으므로 재지적하지 않음 — 다만 위 첫 항목(전체 이력 스캔)과 합쳐지면 "PR마다 이력 크기에 비례해 느려지는 CI 게이트"라는 하나의 트렌드를 이룬다는 점만 기록.

## 요약

가장 눈에 띄는 성능 이슈는 `review_guard.evaluate_review()` 의 두 freshness 함수(`_newest_resolved_review_mtime`/`_newest_resolved_impl_done_mtime`)가 필요한 것은 "가장 최신 resolved 세션 1개"뿐인데도 `review/code`·`review/consistency` 이력 **전체**를 캐시나 조기종료 없이 매번 선형 재스캔한다는 점이다. 판정 자체는 틀리지 않으므로 correctness 결함은 아니지만, 이 계산은 로컬 push 뿐 아니라 **코드 변경이 있는 브랜치의 매 assistant turn(Stop 훅)마다 무조건** 돌고, 이번 브랜치가 신설한 CI 백스톱으로 인해 PR마다도 반복된다. 실측(이 저장소 800+738 세션, 505 spec 패턴)으로는 아직 ~0.09–0.17초 수준이지만, 자체 합성 벤치마크(own tmp dir, n=200→3200)로 확인한 성장 곡선은 순수 선형(4배 입력 → 4배 시간)이라 이력이 계속 쌓이는 이 프로젝트의 특성상 매 턴 체감 지연으로 이어질 방향이다. 세션 디렉터리명이 이미 시각순 정렬 가능하다는 점을 이용해 최신 것부터 순회하며 첫 resolved 세션에서 멈추는 방식으로 바꾸면 코드 변경 없이도(캐시 무효화 로직 불필요) 사실상 상수 시간으로 되돌릴 수 있다. 나머지 발견(Gate 2 중복 `git log`, 테스트 스위트 성장 추세, `fetch-depth: 0` 비용)은 부수적이며 즉각 조치가 필요한 수준은 아니다.

## 위험도

MEDIUM
