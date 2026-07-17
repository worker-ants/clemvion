# 동시성(Concurrency) 리뷰

## 발견사항

- **[INFO]** 이번 diff(세션 앵커 `--keep` 전달 + git-push 서브커맨드 파서 재작성) 자체는 동시성 결함을 도입하지 않으며, 오히려 기존 TOCTOU 노출 구간을 줄이는 방향이다.
  - 위치: `.claude/tools/reap-merged-worktrees.sh:100-105`(`is_kept`), `:204-208`(pass 1 루프에서의 호출 위치) / `.claude/hooks/guard_review_before_push.py`(`_tokenize`/`_git_subcommand`/`_is_git_push`/`_is_segment_boundary`, 전체)
  - 상세: `keep_paths` 는 인자 파서 단계(73-92행)에서 1회만 채워지는 프로세스-로컬 문자열이며 이후 read-only 로만 참조된다 — 여러 스레드/프로세스가 공유하는 가변 상태가 아니다. `is_kept()` 검사는 pass 1 루프에서 `current_top` skip(200-203행) 바로 다음, dirty-check(`git status --porcelain`, 210행)·`gh_state()` 호출(214행) **이전**에 위치한다. 즉 앵커로 지정된 워크트리는 아래 두 번째 항목에서 서술하는 TOCTOU 구간(더티 체크~실제 삭제) 자체를 애초에 타지 않게 되어, 이번 변경은 순수하게 위험을 줄이는 방향이다. `guard_review_before_push.py` 의 새 파서(`_tokenize`/`_git_subcommand`/`_is_git_push`/`_is_segment_boundary`)도 인자로 받은 문자열만 다루는 순수 함수이며 전역 가변 상태·파일 I/O·스레드/async 가 전혀 없다 — 매 Bash 호출마다 독립된 단일 프로세스로 실행되는 PreToolUse 훅이라 프로세스 내부 경쟁조건이 성립할 여지가 없다. `git diff`(merge-base `14bc86a53`..HEAD) 로 실제 변경 라인을 확인해 이 판단의 근거로 삼았다.
  - 제안: 없음(확인용, 조치 불필요).

- **[INFO]** reap 스로틀 마커는 check-then-act 이며 락이 없다 — 동시 SessionStart 시 "실 실행" 이 중복될 수 있다 (사전 존재, 이번 diff 미변경).
  - 위치: `.claude/tools/reap-merged-worktrees.sh:116-122`(스로틀 체크), `:268`(마커 touch)
  - 상세: 판정 순서는 "마커 mtime 읽기(118행) → MIN_INTERVAL 이내면 즉시 exit(119-121행) → 본문 전체(pass 1/2, 187-264행) 실행 → 마커 touch(268행)" 다. 이 프로젝트는 `EnterWorktree` 로 여러 워크트리에서 백그라운드 세션을 병행하는 것을 정석 워크플로로 문서화하고 있고(`worktree-policy.md`, 이번 plan 자체가 다루는 시나리오), 두 세션이 거의 동시에 SessionStart 되면(bootstrap→reaper) 둘 다 스로틀 체크를 통과해 본문을 동시에 밟을 수 있다 — check 와 act 사이에 상호배제가 전혀 없다(`flock`/`mkdir` 기반 원자적 락 등 어떤 기법도 안 쓰인다). 영향은 제한적이다: git 자체가 ref 갱신에 내부 락을 쓰므로 `.git` 객체 손상 위험은 낮고, 최악의 경우 `gh pr view` 중복 호출(레이트리밋 소비)이나 `cleanup-worktree.sh` 이중 호출(224행, 두 번째 호출은 "FAILED to remove" 로 무해하게 실패) 정도다.
  - 제안: 이번 diff 범위 밖(이번 PR 은 §① cwd/anchor 대리지표 문제만 다룸). 후속으로 스로틀 체크~마커 touch 구간을 `mkdir` 기반(POSIX 원자적, macOS 기본 셸엔 `flock(1)` 미탑재) 락 디렉터리로 감싸는 것을 고려할 만하다.

- **[INFO]** `gh_state()` 의 `gh pr view` 호출에 타임아웃이 없어 SessionStart 를 무기한 블록할 이론적 경로가 있다 (사전 존재).
  - 위치: `.claude/tools/reap-merged-worktrees.sh:125-130`(`gh_state`), 호출부 214행·245행·256행
  - 상세: `"$GH" pr view "$branch" --json state --jq .state 2>/dev/null || echo ""` 는 외부 프로세스를 상한 시간 없이 호출한다. `gh` 가 네트워크 정체·재인증 등으로 응답하지 않으면 이 호출 하나가 `bootstrap-session.sh` 를 통해 SessionStart 전체를 블로킹한다 — "항상 exit 0" 보장(스크립트 헤더 주석, 49행)은 끝나야 의미가 있는데, 애초에 안 끝나면 그 보장 자체가 무력화된다. 비동기 코드의 이벤트 루프 블로킹(워치독 부재)과 같은 카테고리의 셸 스크립트 아날로그다.
  - 제안: 이번 diff 범위 밖. 후속으로 `timeout <N>s "$GH" pr view ...` 워치독 wrapping 을 고려할 만하다.

- **[WARNING]** mermaid-lint `npm install` 은 모든 워크트리가 공유하는 단일 디렉터리에 대해 check-then-act 경쟁을 갖고 있다 (사전 존재, 이번 diff 미변경 — `--keep`/`is_kept` 로직과 무관한 섹션).
  - 위치: `.claude/tools/bootstrap-session.sh:33-42`
  - 상세: 주석이 명시하듯(13-14행) "node_modules is gitignored, so worktrees share this single copy" — `$tool_dir`(34행)는 `main_root` 기준 단일 경로이며 모든 워크트리·모든 세션이 같은 디렉터리를 공유한다. 두 세션이 거의 동시에 SessionStart 되고 아직 `node_modules` 가 없는 상태(최초 클론 직후 또는 삭제 후)라면, `[ ! -d "$tool_dir/node_modules" ]`(35행) 체크를 둘 다 통과해 **같은 디렉터리에 `npm install` 을 동시 실행**할 수 있다. npm 은 같은 대상 디렉터리로의 동시 설치에서 부분 쓰기·`ETXTBSY` 류 오류·손상된 `node_modules` 를 만드는 것으로 잘 알려져 있다. 실패해도 39-40행은 경고만 남기고 계속 진행("lint will fail open")하며, 설치가 손상됐지만 디렉터리 자체는 생성됐다면 다음 세션부터는 35행이 "이미 설치됨"으로 오판해 재설치를 시도하지 않는다 — 수동 개입(`rm -rf node_modules && npm install`) 전까지 mermaid lint 가 조용히 무력화된 상태로 남을 수 있다. 발동 창은 좁지만(최초 설치 시점 한정), 이 프로젝트가 여러 워크트리에서의 병렬 백그라운드 세션을 정석 워크플로로 문서화하고 있어(이번 plan 이 다루는 시나리오와 정확히 같은 트리거) 순수 이론적 사례로 보기는 어렵다.
  - 제안: 이번 PR 의 스코프(§① 세션 앵커, §② push 오탐)와 무관하므로 이 diff 에서 고칠 필요는 없다(scope 오염 방지). 별도 후속 항목으로 `mkdir` 기반 락, 또는 임시 디렉터리에 설치 후 `mv` 로 원자적 치환하는 방식을 고려할 만하다.

- **[INFO]** `--keep` 은 "이 세션 자신의" 앵커만 보호한다 — 동시에 열린 *다른* 세션의 앵커는 여전히 무방비 (이미 문서화된 알려진 한계, 신규 발견 아님).
  - 위치: `plan/in-progress/harness-session-anchor-guards.md` "알려진 한계" 절, `.claude/docs/worktree-policy.md` §7 "한계" 절
  - 상세: 이번 fix 는 "cwd 대리 지표" 문제(같은 세션 내 cwd≠anchor 분기)만 해결한다. 각 reaper 호출은 자신을 부른 세션의 `--keep` 인자만 알 수 있으므로, 세션 B 의 워크트리가 세션 A 의 reap 기준(merged+clean)을 만족하면 세션 A 의 reaper 는 세션 B 의 anchor 를 모르는 채로 여전히 지울 수 있다. plan·정책 문서 모두 "그 세션은 여전히 죽는다" 고 정직하게 명시하고 있어 은폐된 갭이 아니며, 코드·plan·정책 문서 세 곳의 서술이 서로 일치함을 확인했다.
  - 제안: 별도 조치 불필요. "살아있는 세션 앵커 레지스트리" 같은 전역 조정 메커니즘은 문서가 이미 "과하다" 고 판단해 기각한 상태이며, 이번 리뷰에서도 그 판단을 뒤집을 근거를 찾지 못했다.

- **[INFO]** 신규/리팩터된 테스트 헬퍼의 `subprocess.run` 호출에 명시적 timeout 이 없다.
  - 위치: `.claude/tests/test_reap_merged_worktrees.py:118-122`(`_run`, 이번 diff 에서 `cwd` 파라미터 추가), `:145-147`(`_run_bootstrap`, 이번 diff 신설)
  - 상세: 두 헬퍼 모두 `subprocess.run(..., capture_output=True, text=True)` 로 `timeout=` 인자가 없다. 대상 스크립트가 어떤 경로로든 멈추면(예: 위 항목들의 무-타임아웃 `gh` 호출이 테스트 환경에서 실제 `gh` 로 오염된 상태로 발동) 해당 테스트 프로세스가 무기한 블록되어 CI 러너 슬롯을 점유한다. 정상 경로에서는 `_GH_STUB`(테스트 스텁)이 즉시 반환하도록 작성돼 있어 발동하지 않는다.
  - 제안: 급하지 않음(기존 스타일과 동일한 패턴이라 이번 diff 만의 회귀는 아님). 여유가 되면 `subprocess.run(..., timeout=30)` 정도의 안전망 추가를 고려.

## 요약

이번 diff(세션 앵커 `--keep` 전달 체계 + git-push 서브커맨드 파서 재작성 + 대응 테스트·문서)는 그 자체로는 동시성 결함을 전혀 도입하지 않는다 — `keep_paths`/`is_kept()`·`_tokenize`/`_git_subcommand`/`_is_git_push` 모두 프로세스-로컬 상태만 다루는 순수·동기 로직이며, `is_kept()` 검사 위치는 오히려 기존 TOCTOU 구간(더티 체크~실제 삭제) 진입 전에 앵커를 걸러내 위험을 순감소시킨다(`git diff` 로 실제 변경분을 직접 대조 확인). 다만 리뷰 대상 파일에 전체 컨텍스트로 포함된 주변 코드에는 이번 diff 가 손대지 않은 사전 존재 동시성 갭이 몇 가지 눈에 띈다: reap 스로틀 마커의 check-then-act(락 없음), `gh pr view` 호출의 무-타임아웃, 그리고 특히 모든 워크트리가 공유하는 `mermaid-lint/node_modules` 디렉터리에 대한 `npm install` 의 동시-설치 경쟁(WARNING) — 이 프로젝트가 명시적으로 지원하는 "여러 워크트리에서 병행되는 백그라운드 세션" 워크플로 하에서 실제로 트리거 가능한 경로다. 모두 이번 PR 의 스코프(§① 세션 앵커, §② push 오탐) 밖이므로 이 세션에서 고칠 의무는 없지만, 이 plan 자체가 "동시 세션" 을 주제로 삼고 있는 만큼 후속 참고로 남긴다. `--keep` 이 "자기 세션의 anchor 만" 보호한다는 잔여 한계는 코드·plan·정책 문서 세 곳에서 일관되게 정직히 공개돼 있어 별도 조치가 불필요함을 확인했다.

## 위험도

LOW
