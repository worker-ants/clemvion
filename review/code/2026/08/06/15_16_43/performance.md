# 성능(Performance) Review — round 12

대상: 11R CRITICAL(`actions/checkout` 위상에서 백스톱이 판정을 못 냄) 수정
(`4c221beca`) + 픽스처 `.git/config` 오염 사고 복구/경화(`9c270100f`), 그리고 이번
changeset 전체(`.claude/_shared/git_probe.py`, `branch_guard.py`, `plan_guard.py`,
`review_guard.py`, 관련 테스트, `review-gate.yml`, `harness-checks.yml`,
`check-review-gate.py`).

리뷰 방법: 프롬프트에 실린 전체 파일 컨텍스트를 검토하고, 프롬프트 예산으로 생략된
`review_guard.py`(52,120자)는 `Read`로 직접 열어 확인했다(`.claude/tests/README.md`·
`test_block_integrity.py`·`test_review_guard_hardening.py`도 생략 표시가 있었으나, 이번
라운드 diff — `9a7b28764..9c270100f` — 에 실제로 포함된 부분만 직접 `git diff`로 대조해
판단 범위를 좁혔다). 성능 주장은 전부 이 워크트리에서 직접 실행/측정했다(명령·출력 하단에
포함). 측정은 전부 읽기 전용이거나 `/private/tmp/.../scratchpad` 아래 `mktemp -d`한 별도
임시 클론에서 수행했고, 이 저장소의 작업 트리·`.git/config`는 건드리지 않았다(11R 사고 재발
방지 — 모든 임시 git 호출에 `git -C <절대경로>` + `GIT_CEILING_DIRECTORIES`를 사용).

## 발견사항

- **[WARNING]** `_default_branch()`가 여전히 매 호출마다 실패가 보장된 2초 네트워크 폴백을
  먼저 태우고 나서야 이번 라운드가 고친 로컬 폴백에 도달한다 — 10R·11R이 이미 지적한
  latency 문제가 **성능 축에서는 고쳐지지 않았는데도** 11R RESOLUTION은 "그 경로에 도달할
  일이 없어졌다"고 닫았다.
  - 위치: `.claude/_shared/git_probe.py:74-77`(`_origin_default_branch` Method 2,
    `git remote show origin`, `timeout=2.0`), `:139-168`(`_default_branch` — `try: d =
    _origin_default_branch(cwd)` 를 **무조건 먼저** 호출한 뒤에야 이번 라운드가 추가한
    `refs/remotes/origin/<name>` 로컬 폴백 루프(`:163-167`)로 내려온다). 호출부:
    `.claude/hooks/_lib/review_guard.py:920`(`evaluate_review`, "변경 없음" 조기 반환보다
    **앞**), `.claude/hooks/_lib/plan_guard.py:273`(`evaluate_plan`). 두 게이트 모두
    `.claude/hooks/guard_review_before_push.py:886-924`(`_run_gates`, push target마다
    `evaluate_review` → `evaluate_plan` 순차 호출)와
    `.claude/hooks/guard_review_before_stop.py:350,413`에서 **같은 프로세스 안에서 둘 다**
    호출된다.
  - 상세: 11R 성능 리뷰(`review/code/2026/08/06/14_38_16/performance.md` W4)가 이미
    `git remote show origin`의 실측 소요시간(2.6~3.7s)이 코드가 선언한
    `timeout=2.0`보다 길어 **정상 네트워크 상태에서도 항상 타임아웃-실패**한다는 것을
    측정해 뒀다. 11R의 처방(C1)은 그 뒤에 로컬 `refs/remotes/origin/<name>` 폴백을
    추가해 **판정 정확성**은 고쳤지만, `_default_branch()`의 첫 시도는 여전히
    `_origin_default_branch()`이고 그 안에서 Method 2가 여전히 먼저 실행된다 — 즉
    "그 경로에 도달할 일이 없어졌다"는 RESOLUTION의 표현은 **폴백이 실패로 끝나던 결과**에는
    맞지만 **그 폴백 자체가 여전히, 매번, 먼저 실행된다는 사실**에는 맞지 않는다. 이번
    라운드에서 직접 재측정:
    ```
    $ git remote -v
    origin  git@github.com:worker-ants/clemvion.git (fetch)
    $ time (git remote show origin >/dev/null 2>&1)
    real 2.58   user 0.02   sys 0.01

    $ python3 -c "
    import sys, time; sys.path.insert(0, '.claude')
    from _shared import git_probe as gp
    t0=time.time(); rc,out,err = gp._run_git(['remote','show','origin'], '.', timeout=2.0)
    print('rc=',rc,'elapsed=',round(time.time()-t0,3),'out=',repr(out[:40]))"
    rc= 1 elapsed= 2.004 out= ''
    ```
    즉 `_run_git`의 `subprocess.run(timeout=2.0)`이 매번 강제로 kill되고 `(1, "", "")`를
    돌려준다 — Method 2는 **네트워크가 정상인 이 환경에서도 단 한 번도 성공하지 못하고
    2초를 소모하기만 한다.** `actions/checkout` 위상(`init`+`remote add`+`fetch`, `git
    remote set-head` 없음 — 이번 라운드 자신의 주석이 명시)을 별도 `mktemp -d` 클론으로
    재현해 `_default_branch()` 전체를 실측:
    ```
    $ git -C "$WD" symbolic-ref --short refs/remotes/origin/HEAD
    fatal: ref refs/remotes/origin/HEAD is not a symbolic ref   # Method 1 실패 확인
    $ python3 -c "... gp._default_branch('$WD') ..."
    default_branch= main   elapsed= 2.057
    ```
    `refs/remotes/origin/main`은 이미 로컬에 존재하는데도(이 위상에서 `git fetch`로
    만들어짐 — 이번 라운드가 고친 폴백이 실제로 찾아내는 대상) `_default_branch()`가 그걸
    쓰기 **전에** 2초를 버린다. 이 비용은 조건부가 아니라 무조건이다 —
    `evaluate_review()`는 "codebase/ 변경 없음"으로 조기 반환하기 **전에** `_default_branch`
    를 호출하므로(review_guard.py:920, 조기 반환은 :927-928), 리뷰할 게 아무것도 없는 턴에도
    똑같이 지불한다. 그리고 `review_guard`/`plan_guard` 양쪽이 각자 독립적으로
    `_default_branch()`를 호출하며 캐시를 공유하지 않으므로(10R WARNING, 미해결 — 아래
    "이미 등재된 항목" 참조), `refs/remotes/origin/HEAD`가 없는 워크트리에서
    `git push` 한 번 = 로컬 훅에서 최대 **~4초**(리뷰 게이트 2s + plan 게이트 2s), 그리고
    `check-review-gate.py`(CI 백스톱, `evaluate_review`만 호출)는 `codebase/**` 또는
    `.claude/hooks/_lib/**`를 건드리는 **모든 PR마다** 최소 **~2초**를 이 죽은 네트워크
    시도에 쓴다 — `actions/checkout`이 `refs/remotes/origin/HEAD`를 절대 만들지 않는다는
    것이 이 라운드 자신이 밝힌 사실이므로, 이 CI 경로에서는 "가끔"이 아니라 **매번 확정**이다.
    5분 CI 타임아웃 대비 절대치는 작아 게이트를 무너뜨리지 않지만(그래서 CRITICAL은 아님),
    100% 회피 가능한 비용이 매 PR·매 push·매 turn-end에 영구히 누적된다는 점에서 WARNING으로
    유지한다.
  - 제안: (a) 가장 값싼 수정 — `review-gate.yml`의 "Fetch base ref" 스텝 뒤에
    `git symbolic-ref refs/remotes/origin/HEAD refs/remotes/origin/"$BASE_REF"` 한 줄을
    추가한다. 이미 알고 있는 `$BASE_REF`로 순수 로컬 연산이라 네트워크가 전혀 필요 없고,
    Method 1이 즉시 성공해 Method 2와 이번 라운드가 추가한 폴백 루프 전체를 건너뛴다.
    (b) 또는 `_default_branch()`에서 로컬 `refs/remotes/origin/<name>` 검사를 네트워크
    폴백보다 **먼저** 시도하도록 순서를 뒤집는다 — 정확성 손실이 없다(못 찾으면 다음
    단계로 그대로 진행). (c) Method 2의 `timeout`을 실측 지연(≥2.6s)보다 명백히 짧게(예:
    0.3~0.5s)줄여 "느리게 성공"이 애초에 불가능하다는 사실을 인정하고 빨리 실패하게
    만든다. (d) CI 호출부(`scripts/check-review-gate.py`)에는 워크플로가 이미 갖고 있는
    `github.base_ref`를 넘겨 git 프로빙 자체를 생략하는 경로를 추가.

- **[INFO]** 이번 라운드가 새로 추가한 `ActionsCheckoutTopologyTest`
  (`.claude/tests/test_review_guard_hardening.py`)는 위 latency 회귀를 잡지 못한다.
  - 위치: `test_review_guard_hardening.py`의 `ActionsCheckoutTopologyTest.setUp`/
    `test_the_default_branch_resolves_without_the_network` — origin URL을
    `https://invalid.invalid/nonexistent.git`로 바꾼 뒤 `_default_branch`/`evaluate_review`를
    호출한다.
  - 상세: `invalid.invalid`는 DNS 조회가 즉시(수십 ms) 실패하는 예약 도메인이라, 이 테스트는
    "네트워크 없이도 정답을 찾는가"(**정확성**)는 제대로 고정하지만 "네트워크가 있으나
    느린 실제 origin"(이 리포트 상단에서 측정한, 이 저장소가 실제로 겪는 케이스)의 **지연
    시간**은 재현하지 않는다. 향후 누군가 로컬 폴백을 네트워크 폴백보다 뒤로 다시 옮기는
    회귀를 내더라도 이 스위트는 여전히 GREEN이다(정답은 결국 같으므로) — 느려졌다는 사실만
    놓친다.
  - 제안: 차단 사유 아님(정확성 축은 이미 잘 고정돼 있고, CI 유닛테스트에 타이밍 단언을
    넣는 것은 일반적으로 flaky하다). 위 WARNING을 코드로 닫을 때, 회귀 여부는 "Method 2가
    아예 호출되지 않았다"를 `unittest.mock.patch`로 스텁해 호출 횟수/인자로 단언하는 편이
    타이밍보다 안정적이라는 점만 남겨둔다.

- **[INFO]** `_default_branch()`의 새 로컬 폴백 루프가 최악의 경우 `git rev-parse --verify`를
  4회 순차 spawn한다(이전엔 2회).
  - 위치: `.claude/_shared/git_probe.py:163-167`.
  - 상세: `("refs/remotes/origin/{}", "refs/heads/{}") × ("main", "master")` 이중 루프라
    최악의 경우(둘 다 없어야 도달하는 4번째) 서브프로세스 4개를 순차 spawn한다. 개별 호출은
    수 ms 수준(로컬 ref 조회, 네트워크 없음)이라 절대 비용은 위 WARNING(2초)에 비하면
    무시할 수준이고, 정확성을 위해 필요한 순서 의존 로직(로컬 `main`보다 `origin/<default>`가
    더 강한 주장이라는 것을 순서로 인코딩— RESOLUTION에 기록된 실제 뮤테이션 테스트로 고정됨)
    이라 배치 호출로 접기도 까다롭다. 차단 사유 아님, 기록만.

## 이미 등재돼 있어 재평가하지 않은 항목 (이번 라운드 diff 밖, 확인만)

- `review_guard.py`의 `review/code/**`·`review/consistency/**` 전체 무인덱스 선형 스캔
  (`_iter_summaries`/`_iter_consistency_summaries`, 로컬 훅과 CI 백스톱 양쪽에서 중복
  수행)은 10R·11R 성능 리뷰가 이미 WARNING으로 기록했고 이번 라운드 diff에 포함되지
  않았다(변경 없음) — 위 새 WARNING과 같은 호출 경로 위에 얹혀 누적 비용을 더 키우는 관계이나,
  이 라운드가 만들거나 악화시키지 않았으므로 다시 채점하지 않는다.
- `review_guard`/`plan_guard`가 같은 프로세스 안에서 `_repo_root`/`_default_branch`/
  `_merge_base`를 독립적으로 두 번 계산(캐시 없음)하는 것도 10R WARNING으로 이미 등재돼
  있다. 위 새 WARNING이 바로 이 중복 위에서 비용을 두 배(~4s)로 만드는 구체적 사례이므로
  본문에서 함께 인용했지만, "캐시 부재" 자체는 새 지적이 아니다.
- `_newest_commit_time`(`git log` 1회로 배치, N+1 아님), `_dirty_set`(Gate 1/2 간 `git
  status` 1회 재사용), `block_integrity.py`의 선형 정규식, `_glob_to_regex`의 와일드카드
  상한 — 전부 과거 라운드에서 실측 벤치마크로 이미 근거가 남아 있고 이번 diff로 바뀌지
  않았다. 재확인만 하고 새 지적 없음.
- `.git/config` 오염 복구용 픽스처 경화(`test_plan_guard.py`/`test_review_gate_ci.py`에
  `-C`+`GIT_CEILING_DIRECTORIES` 추가)는 순수 안전 조치로 런타임 성능에 영향 없음.

## 요약

이번 라운드의 본체 변경(`_default_branch()`가 `refs/remotes/origin/<name>`도 보게 한 것)은
11R CRITICAL(백스톱이 CI에서 아무 판정도 못 냄)을 올바르게 고쳤지만, 같은 함수에 대해 10R과
11R이 이미 실측으로 지적해 둔 지연(네트워크 폴백이 자신의 2초 타임아웃보다 항상 느려
사실상 상시 실패-후-대기 구간이 된다는 것)은 그대로 남아 있다. 11R RESOLUTION은 이 폴백을
"더 이상 도달할 일 없는 경로"로 닫았지만, 이번 라운드에서 코드 순서를 다시 추적하고 이
저장소의 실제 origin(`git@github.com:worker-ants/clemvion.git`)에 대해 직접 재측정한
결과 그 폴백은 여전히 매 `_default_branch()` 호출마다 **가장 먼저**, **무조건** 실행되며
2.0~2.6초를 소모한다 — 달라진 것은 "실패한 뒤" 벌어지는 일(이전엔 None, 지금은 로컬
폴백으로 정답)뿐이다. `actions/checkout`이 `refs/remotes/origin/HEAD`를 만들지 않는다는
사실은 이 라운드 자신이 재현·기록했으므로, `review-gate.yml`이 트리거되는 한 이 2초는
간헐적 리스크가 아니라 매 PR마다 확정 비용이다. 절대치가 5분 CI 타임아웃과 로컬 훅의
체감 지연 대비 작아 CRITICAL로 올리지는 않지만, `$BASE_REF`를 이용한 로컬
`symbolic-ref` 설정 한 줄로 완전히 없앨 수 있는 비용이 방치돼 있고, 새로 추가된 회귀
테스트(`ActionsCheckoutTopologyTest`)는 이 지연을 잡지 못하는 형태(DNS 즉시-실패 도메인
사용)로 작성돼 있어 재발해도 스위트가 계속 GREEN을 낼 것이라는 점을 함께 남긴다. 그 외
항목(리뷰 세션 전수 스캔, 두 훅의 git 프로브 중복)은 이전 라운드에서 이미 기록된 것으로
이번 diff가 만들거나 악화시키지 않아 재평가하지 않았다.

## 위험도

LOW
