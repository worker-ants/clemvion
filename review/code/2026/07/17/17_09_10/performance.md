# 성능(Performance) 리뷰

## 발견사항

- **[INFO]** push 판별 훅은 모든 Bash 호출의 hot path — 순수 파이썬 `shlex` 토크나이저로 전환
  - 위치: `.claude/hooks/guard_review_before_push.py` `_is_git_push()` / `_tokenize()` (diff L260-307 부근)
  - 상세: 이 훅은 `.claude/settings.json` 에 `Bash` matcher 로 등록되어 세션의 **모든** Bash 툴 호출마다 새 파이썬 프로세스로 실행된다. 기존 구현은 컴파일된 정규식 `.search()` 1회 호출이었고, 신규 구현은 `"push" not in command` 조기-종료 가드를 통과한 경우에만 `shlex.shlex(posix=True, punctuation_chars=True)` 로 순수 파이썬 문자 단위 토크나이저를 돌린다. 순수 파이썬 구현은 C 로 구현된 `re` 모듈보다 상수 계수가 크므로, 커밋 메시지를 heredoc 으로 넘기는 이 저장소의 실제 패턴(`git commit -F - <<'EOF' ... EOF`, SUMMARY/RESOLUTION 본문 인용 등)처럼 명령 문자열이 수 KB 로 커지고 그 안에 "push" 라는 단어가 우연히 포함되는 경우(이 PR의 plan 문서 자체가 그런 예) 토크나이즈 비용이 발생한다. 다만 조기-종료 가드가 이미 존재하고, 알고리즘적으로 O(n)(명령 문자열 길이에 선형)이라 실사용 규모(명령 문자열 수십~수백 바이트, 큰 경우도 수 KB)에서 체감 지연은 미미하다.
  - 제안: 현재 조치 불요. 다만 조기-종료 문자열 검사가 단순 substring(`"push" in command`)이라 "pushed", "push_config" 등 무관한 부분일치에도 토크나이즈 경로에 진입한다 — 워드 바운더리 사전 검사(`\bpush\b`)를 추가하면 불필요한 진입을 더 줄일 수 있으나, 안전 방향(과소 최적화)이라 CRITICAL/WARNING 은 아니다.

- **[INFO]** `is_kept()` 가 워크트리마다 서브프로세스(`printf`|`grep`)를 fork
  - 위치: `.claude/tools/reap-merged-worktrees.sh` `is_kept()` (신설, pass-1 루프에서 워크트리당 1회 호출)
  - 상세: `--keep` 경로 집합이 보통 1개(세션 앵커 1곳)인 상황에서, 워크트리 개수만큼 `printf '%s\n' "$keep_paths" | grep -qxF -- "$1"` 파이프를 실행해 매 반복마다 `grep` 프로세스를 fork+exec 한다. 순수 bash 파라미터 확장(`case "$1" in $keep_paths) ... ;; esac` 류)으로도 서브프로세스 없이 처리 가능한 자리다.
  - 제안: 세션 시작마다 6시간 throttle 로 1회만 실행되고 워크트리 수도 통상 한 자릿수라 실측 비용은 무시할 수준 — 현재 스케일에서는 조치 불필요. 워크트리 수가 크게 늘어날 가능성이 있다면(대규모 공유 clone 등) bash-native 매칭으로 교체를 고려.

- **[INFO]** (Positive) `is_kept()` 스킵이 네트워크 호출(`gh_state`)보다 먼저 배치됨
  - 위치: `reap-merged-worktrees.sh` pass-1 루프 — cwd skip → `is_kept` skip → dirty skip → `gh_state`(= `gh pr view`, 네트워크 I/O) 순서
  - 상세: kept 워크트리는 `gh pr view` API 호출까지 도달하지 않고 조기 스킵되므로 불필요한 네트워크 라운드트립을 만들지 않는다. 저비용 로컬 체크(cwd 비교, keep-set 조회, `git status --porcelain`)를 고비용 네트워크 호출보다 먼저 배치한 순서는 성능 관점에서 바람직한 설계다. (결함이 아니라 확인된 좋은 패턴으로 기록)

- **[INFO]** 신규 통합 테스트 8건이 서브프로세스 체인을 늘려 하네스 스위트 실행 시간 소폭 증가
  - 위치: `.claude/tests/test_reap_merged_worktrees.py` — `--keep`/세션 앵커 관련 8건, 특히 `test_bootstrap_keeps_the_worktree_it_was_invoked_from`, `test_bootstrap_still_reaps_unrelated_merged_worktrees`
  - 상세: 각 테스트가 `setUp` 에서 임시 git repo 를 처음부터 생성(수 개의 git 서브프로세스) → 워크트리 2개 추가 → (두 건은) `bootstrap-session.sh` 를 앵커 워크트리에 설치(add/commit/status) → 실제 `bootstrap-session.sh` 를 서브프로세스로 실행(그 안에서 다시 reaper 를 nested bash 로 기동, reaper 는 내부적으로 `git worktree list`/워크트리별 `git status`/`gh` stub 호출 등을 재차 수행)까지 체이닝된다. 테스트당 서브프로세스 호출 수가 늘어 `python3 -m unittest discover -s .claude/tests` 총 실행 시간이 소폭 증가한다.
  - 제안: 이 파일은 원래도 "throwaway git repo with real worktrees" 를 쓰는 통합 테스트 패턴이므로 신규 8건도 기존 패턴을 그대로 따른 것이며, 세션 wedge 방지라는 가용성 회귀에 대한 방어라 트레이드오프가 타당하다. 조치 불필요 — 다만 향후 이 파일에 유사 패턴이 계속 누적되면 하네스 self-test 스위트의 CI 시간 증가를 모니터링할 필요는 있다.

## 요약

이번 변경은 정확성/하드닝 목적의 패치로, 두 핵심 로직 모두 (a) 세션 시작 시 throttle 되어 드물게 실행되거나(reaper·bootstrap 의 anchor 계산) (b) 매 Bash 호출마다 실행되지만 알고리즘적으로 선형(O(n))이며 기존에 있던 조기-종료 가드(`"push" not in command`)를 그대로 보존한다(push 판별 훅). N+1 형태의 반복 DB/API 호출, 캐싱 누락, 신설 블로킹 I/O, O(n²) 문자열 누적, 불필요한 선행 로딩 등 CRITICAL/WARNING 급 성능 결함은 발견되지 않았다. 오히려 `frozenset` 기반 O(1) 토큰/구분자 판별, kept-worktree 체크를 네트워크 호출(`gh pr view`) 이전에 배치한 순서 등은 성능을 의식한 설계로 평가된다. 유일한 유의점은 push 판별 훅이 모든 Bash 호출의 hot path 라는 점과 `is_kept()` 가 워크트리마다 서브프로세스를 fork 한다는 점인데, 둘 다 현재 스케일(짧은 명령 문자열, 한 자릿수 워크트리, 세션당 드문 reaper 호출)에서는 체감 영향이 미미해 INFO 수준에 그친다. 신규 통합 테스트 8건은 하네스 self-test 스위트의 실행 시간을 다소 늘리지만 회귀 방지 가치 대비 합리적인 트레이드오프다.

## 위험도

LOW
