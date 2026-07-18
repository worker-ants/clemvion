# 동시성(Concurrency) 리뷰 — bootstrap-session.sh mermaid-lint 설치 가드 (lockfile-해시 결속)

대상: `.claude/tools/bootstrap-session.sh`, `.claude/tests/test_bootstrap_mermaid_install.py`,
`.claude/tests/README.md` (커밋 `ceee1fa5b` → `c5fdd1bb8` → `ead99225c`, origin/main 대비).

## 발견사항

- **[WARNING]** 리뷰 진행 중 대상 파일 자체가 실시간으로 동시 변형되는 것을 실측 — 리뷰/검증 하네스의 동시-쓰기 위생 문제
  - 위치: `.claude/tools/bootstrap-session.sh` (이 워크트리의 실제 워킹 트리 파일, 커밋 아님)
  - 상세: 리뷰 도중 `git diff HEAD -- .claude/tools/bootstrap-session.sh` 를 반복 확인한 결과, 파일이
    수 초 간격으로 최소 두 가지 서로 다른 단일-지점 변형 상태를 거쳤다가 원 상태(HEAD, 커밋
    `ead99225c`)로 자동 복원되는 것을 직접 관측했다: ① 142행 마커 기록이 post-install 재계산
    `printf '%s\n' "$(_lock_hash)"` 에서 install-전 `printf '%s\n' "$want_hash"` 로 되돌아가 바로 위
    5줄짜리 주석("Record the POST-install lockfile hash, recomputed here **rather than reusing the
    pre-install want_hash**")과 코드가 정면으로 모순되는 상태, ② 129행 lockfile-해시 불일치 검사가
    `elif false; then  # MUTATED: hash-mismatch check disabled` 로 무력화된 상태. ①이 살아있는 동안
    실제로 `python3 -m unittest discover -s .claude/tests -p test_bootstrap_mermaid_install.py` 를
    구동해 `test_npm_rewriting_lockfile_still_converges` 가 npm 3회 호출(무한 재설치 루프)로 FAIL
    하는 것까지 재현했다. 커밋 `ead99225c` 메시지가 자신도 "pre-install 해시 기록 뮤턴트에서 실패함을
    확인(비-vacuity)"이라 명시하고 있어, 이는 팬아웃의 다른 sub-agent(혹은 별도 프로세스)가 같은
    비-vacuity 뮤테이션 검증을 **이 워크트리의 실제 파일에 직접(lock 없이) in-place 패치**해 수행 중
    이었기 때문으로 강하게 추정된다. 수 초 후 재확인 시 `git status`/`git diff` 모두 완전히 클린한
    상태(HEAD 와 100% 일치)로 안정화됐고, 최종 상태에서 재구동한 11개 테스트는 전부 OK.
  - 상세2: 이 자체는 "코드 변경"의 결함이 아니라 — 최종·정착 상태의 `bootstrap-session.sh` 로직은
    올바르다 — **검증 하네스가 공유 워크트리 파일을 락 없이 동시-변형**한다는 프로세스 리스크다.
    이 리뷰처럼 동시에 다른 리뷰어/사람/CI 가 그 짧은 창을 읽으면 거짓 진단(정확히 이번에 내가
    처음 두 번 읽었을 때 빠질 뻔한 것)을 낳고, 만약 그 뮤테이션 하네스가 mid-mutation 에 예외·타임아웃
    ·OOM 으로 죽으면 **복원 없이 깨진 코드가 워킹 트리에 영구 잔류**할 수 있다 — 사용자 메모리에
    기록된 기존 사고(`feedback_mutation_harness_restore_cp_not_checkout` — "가드 mutation 검증 원복은
    cp+절대경로, git checkout 금지 — 한 세션에 두 번 미커밋 작업을 지웠다")와 정확히 같은 계열의
    재발 가능 지점을 실시간으로 다시 확인한 셈이다.
  - 제안: 뮤테이션 기반 비-vacuity 검증은 (a) 원본을 `cp` 로 절대경로 백업 후 `trap ... EXIT`/
    `try/finally` 로 실패해도 무조건 복원하거나, (b) 리뷰 중인 실제 워크트리가 아닌 전용 스크래치
    복사본에서 수행해 다른 동시 reader(다른 리뷰 sub-agent 포함)가 그 창을 절대 관측하지 못하도록
    격리할 것을 권장. 이 리뷰 결과 자체는 최종 안정 상태(클린, 테스트 전부 green)를 근거로 판정했다.

- **[INFO]** 마커-해시 결속 확장이 "최초 설치 한정" 동시-npm-install 경쟁창을 "lockfile 변경마다 재발"로 넓힘 — 이미 정직하게 공개·추적됨, 신규 결함 아님
  - 위치: `.claude/tools/bootstrap-session.sh` 74-85행 설계 노트, `plan/in-progress/harness-guard-followups.md` §G · §A-후속 I1
  - 상세: 새로 추가된 lockfile-해시 불일치 재설치 트리거(`need_install` 확장)는 보안 패치(Dependabot
    merge)가 기존 설치에도 전파되게 하려는 의도된 기능이다. 그 대가로, 이미 알려진 "여러 세션이 동시에
    `npm install` 할 수 있는 창(락이 의도적으로 없음 — 손수 짠 `mkdir` 락의 반복된 check-then-act
    TOCTOU 로 이전 라운드에 제거됨, 02_06_42 C1)"이 최초 설치 시점 1회성에서 **lockfile 이 바뀔
    때마다(정기 Dependabot merge 포함)** 재발하는 것으로 넓어진다. 최악의 경우 sibling 의 동시 쓰기가
    corrupt-but-marked 트리를 만들 수 있다는 것도 기존과 동일.
  - 검증: 코드 주석·`plan/in-progress/harness-guard-followups.md` §G("mermaid 설치에 진짜 동시성
    보장이 필요해지면 — fcntl.flock")·같은 파일 §A-후속 I1("hung npm install 의 blast radius 가
    락 제거로 세션 1개 → 동시 콜드스타트 전체로 확대") 세 곳에 이미 정직하게 문서화돼 있고 revisit
    조건까지 명시돼 있어, 새로 지적할 결함이 아니라 이미 알려진·추적된 채무임을 확인했다.
  - 남은 갭 (낮은 우선순위): 동시성 스트레스 테스트
    `test_concurrent_cold_start_converges_and_then_stops_reinstalling`(5-way 병렬 `Popen`)은 **최초
    설치(마커 없음)** 경로만 병렬로 검증한다. 이번에 넓어진 "마커는 있으나 lockfile 이 방금 바뀐"
    재설치 경로는 `test_lockfile_change_retriggers_install` 등 **순차** 테스트로만 검증되어, 병렬
    하에서의 수렴은 아직 실증되지 않았다. 같은 5-way `Popen` 패턴을 "기존 마커 有 + lockfile 변경
    직후 동시 기동" 케이스에도 추가하면 넓어진 재발 창에서도 수렴 속성이 유지됨을 실증할 수 있다.
    Blocking 아님.

- **[INFO]** 완료 마커 쓰기가 truncate+write 이지 rename 원자성이 아님 — 극히 희박한 torn-read, 기존 수용 리스크 범주 안
  - 위치: `.claude/tools/bootstrap-session.sh` 142행 `printf '%s\n' "$(_lock_hash)" > "$marker"` (쓰기)
    vs 129행 `[ "$(cat "$marker" 2>/dev/null)" != "$want_hash" ]` (판독)
  - 상세: `>` 리다이렉션은 `open(O_TRUNC)` + `write` 이며 원자적 `rename` 이 아니다. 한 세션이 마커를
    트렁케이트한 직후·새 내용을 쓰기 전 찰나에 다른 세션이 `cat "$marker"` 로 판독하면 빈 문자열을
    보고 해시 불일치로 오판해 불필요한(그러나 무해한) 재설치를 유발할 수 있다. 이미 설계 노트가 명시한
    "여러 세션이 동시에 npm-install 할 수 있다"는 수용된 잔여 리스크의 하위 사례이며, 최악의 영향도
    "중복 설치"로 동일해 이번 diff 가 새로 여는 위험은 아니다.
  - 제안 (선택, 저우선): 필요해지면 `printf ... > "$marker.tmp" && mv "$marker.tmp" "$marker"` 로
    바꿔 `rename` 원자성을 확보할 수 있다 — §G(`fcntl.flock` 전환) 시 자연히 함께 정리될 범위라 별도
    착수 불필요.

## 요약

이번 diff(마커를 `package-lock.json` 해시에 결속해 Dependabot 보안 패치가 기존 설치에도 전파되게
하는 기능 + 그 자기유발 W2 버그의 post-install 재계산 수정)는 **정착 상태 기준으로 동시성 결함이
없다** — 락을 의도적으로 뺀 근거(손수 짠 `mkdir` 락이 4라운드 연속 TOCTOU 재발)와, 락 없이도
"수렴(convergence)"만 보장한다는 약한 계약, 그리고 lockfile-해시 결속이 그 경쟁창을 "최초 설치
한정"에서 "재발성"으로 넓힌다는 트레이드오프까지 모두 코드 주석·`plan/in-progress/harness-guard-
followups.md` §G·I1 에 정직하게 문서화·추적돼 있고, 관련 단위/통합 테스트 11건이 정착 상태에서 전부
통과함을 직접 재실행으로 확인했다. 다만 리뷰 도중 이 파일이 다른 프로세스(십중팔구 형제 sub-agent의
비-vacuity 뮤테이션 검증)에 의해 lock 없이 실시간으로 in-place 변형됐다가 복원되는 것을 직접 목격했고,
그 창에서는 실제로 `test_npm_rewriting_lockfile_still_converges` FAIL(npm 3회 호출, 무한 재설치)까지
재현됐다 — 이는 "코드"가 아니라 "검증 하네스"의 동시-쓰기 위생 문제이지만, 이 저장소에 이미 기록된
동일 계열 사고(뮤테이션 원복 미비)와 같은 성격이라 WARNING 으로 표면화한다. 그 외에는 넓어진 재발
창에 대한 동시성 스트레스 테스트 갭, 마커 쓰기의 비원자성(torn-read) 두 가지를 INFO 로 남긴다 — 모두
이미 수용/추적된 리스크의 연장선이며 차단 사유는 아니다.

## 위험도

LOW
