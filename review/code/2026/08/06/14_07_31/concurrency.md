# 동시성(Concurrency) Review — 리뷰 게이트 CI 백스톱 (round 10)

## 조사 방법 메모

이 라운드의 실제 "판정 코드" (`review_guard.py`, `plan_guard.py`, `branch_guard.py`,
`_shared/git_probe.py`, CI 워크플로/스크립트)는 전부 **단일 프로세스·단일 스레드**로
동기 실행되는 CLI/훅/GitHub Actions step 이다. 이 전제를 짐작이 아니라 실측으로 확인했다:

```
$ grep -rln "ThreadPoolExecutor\|import threading\|concurrent\.futures\|multiprocessing\|fcntl\.flock\|asyncio" .claude scripts \
    | grep -v __pycache__ | grep -v /node_modules/
.claude/tools/bootstrap-session.sh          # 셸 스크립트, 세션 부트스트랩 — 이번 리뷰 대상 밖
.claude/hooks/_lib/failopen_state.py        # 아래 참조 — fcntl.flock 은 "쓰지 않기로 했다"는 주석일 뿐
.claude/_shared/retry_state.py              # 이번 15개 파일 목록 밖 (plan 문서 §후속10 에 이미 등재된 결함)
```

`.claude/hooks`, `.claude/_shared`, `.claude/skills`, `scripts` 전체에 실제 스레드/멀티프로세스
사용은 없다. 따라서 "두 스레드가 동시에 이 함수를 부른다" 류의 고전적 race 는 이 코드베이스에서
**도달 불가**이고, 실제로 발생 가능한 동시성은 (a) 서로 다른 프로세스(로컬 push 훅 vs CI job vs
동시에 켜진 다른 워크트리 세션)가 **같은 파일**을 시차를 두고 읽고/쓰는 경우, (b) 한 프로세스
안에서 같은 작업 트리에 대해 **여러 개의 독립적인 git 스냅샷**을 순차 질의하는 경우, 두 가지뿐이다.
아래 발견사항은 전부 이 두 축을 따라간다.

## 발견사항

- **[INFO]** `_origin_default_branch` 의 `sys.modules` 캐시는 check-then-act 라 스레드 안전하지 않다 (도달 불가로 확인됨)
  - 위치: `.claude/_shared/git_probe.py:49-59` (`mod = sys.modules.get(...)` → `if mod is None:` → `sys.modules["_git_probe_branch_guard"] = mod` → `spec.loader.exec_module(mod)`)
  - 상세: 두 호출이 겹치면 둘 다 `mod is None` 을 보고 `branch_guard.py` 를 각각 `exec_module` 할 수 있는 고전적 lazy-singleton race다. 다만 위 실측대로 이 저장소의 어떤 호출부(`review_guard._default_branch`/`plan_guard._default_branch`/`branch_guard` 자신)도 스레드나 멀티프로세스로 이 함수를 동시에 부르지 않는다 — 각 훅/CI step 은 별도 프로세스로 한 번씩 동기 실행된다. 같은 파일이 이미 "Measured before adding it" (git_probe.py:74-78, non-ASCII 경로 0개 실측) 관행을 스스로 쓰고 있으므로, 같은 기준으로 이것도 오늘은 잠복(latent)이지 활성 결함이 아니라고 적어둔다.
  - 제안: 지금 고칠 필요 없음. 다만 이 모듈에 향후 스레드/파이프라인 병렬화(`Workflow` tool 의 fan-out 등)가 도입되면 가장 먼저 깨질 자리이므로, 그때는 `importlib.util.module_from_spec` 대신 프로세스 시작 시 1회 로드 또는 `threading.Lock` 가드로 바꿔야 한다는 점만 기록.

- **[INFO]** fail-open 스트릭 카운터의 read-increment-write 는 잠금이 없다 — 단, 이미 문서화·수용된 결정이고 판정(block/allow)에는 영향 없음
  - 위치: `.claude/hooks/_lib/failopen_state.py:61-88` (`state_path`/`read_streak`/`write_streak`), 근거 주석은 `:115-119`
  - 상세: `report()` 는 `streak = read_streak(state_name) + 1` 후 `write_streak(...)` 하는 전형적 read-modify-write이며 파일 잠금이 없다. push 훅과 Stop 훅이 같은 워크트리에서 거의 동시에 실행되거나(예: 사용자가 `git push` 직후 곧바로 턴을 종료), 다른 세션이 같은 `CLAUDE_PROJECT_DIR/.claude/state` 를 공유하는 워크트리 구성이면 한쪽 증가분이 유실될 수 있다. 그러나 이 카운터는 **관측용 스트릭**(3연속 fail-open 시 경고 문구를 강하게 낼지 결정)일 뿐, 실제 push/turn-end 를 막을지 여부(`ReviewDecision.blocked`)는 전혀 읽지 않는다. 코드 자체가 이 트레이드오프를 정확히 서술하고("Known residual (accepted)"), 배너를 쓰기 **전**이 아니라 쓴 뒤에 write 하도록 순서까지 잡아 "쓰기가 지든 실패하든 1차 신호(배너)는 반드시 나간다"는 조건을 이미 만족시킨다.
  - 제안: 조치 불필요 — 이미 결정된 사항. 판정 코드(HIGH/CRITICAL 대상)가 아니라 관측 코드이므로 `fcntl.flock` 을 넣지 않기로 한 기존 판단에 동의.

- **[INFO]** `evaluate_review()` 안에서 작업 트리에 대해 **두 번의 독립적인 `git status --porcelain` 스냅샷**을 순차로 뜬다 — 동시 외부 편집 시 dirty/clean 판정이 두 시점 사이에서 갈릴 수 있는 좁은 창
  - 위치: `.claude/hooks/_lib/review_guard.py:923-925` (`_committed_code_changes`/`_uncommitted_code_changes` → `changed` 계산, `codebase/` 로 scoped 된 `git status`) 그리고 `:941-943`/`:946` (`dirty = _dirty_set(repo_root)` — 전체 저장소 대상 별도 `git status`, `_newest_code_mtime` 에 전달)
  - 상세: 두 호출은 서로 다른 `git status` 프로세스이므로 원자적 단일 스냅샷이 아니다. 정상 흐름(사용자가 혼자 `git push` 하거나 턴을 종료하는 순간)에서는 그 사이에 파일을 바꿀 다른 행위자가 없어 무해하지만, 이 모듈이 명시적으로 다루는 바로 그 시나리오 — `resolution-applier` 서브에이전트가 `codebase/**` 를 백그라운드에서 편집하는 동안 Stop 훅이 같은 턴에 발화하는 경우 — 는 두 `git status` 호출 사이에 파일이 dirty→clean 또는 그 역으로 넘어갈 수 있는 정확히 그 창이다. 넘어가면 `_authoritative_code_time` 이 mtime 대신 commit-time(또는 그 반대)을 골라 신선도 판정이 몇 초 어긋날 수 있다. 다만 (a) 이 저장소에 스레드/멀티프로세스가 없다는 것을 위에서 실측했고, (b) `resolution-applier` 의 실제 편집과 Stop 훅 프로세스 실행은 순차 이벤트(SubagentStop 이 끝나야 다음 턴이 시작)이지 진짜 OS 레벨 동시 실행이 아니어서, 실제로 이 창이 열려 있는 시간은 두 subprocess 호출 간 수십 ms 뿐이다. 살아있는 결함이라기보다 "완전한 원자적 스냅샷은 아니다"라는 설계 여백에 가깝다.
  - 제안: 급하지 않음. 굳이 닫는다면 `_dirty_set` 호출 결과에서 `codebase/` 접두 부분집합을 뽑아 `changed` 계산에도 재사용하면(현재 이미 있는 "One `git status` shared across every freshness query below" 주석의 범위를 앞단까지 넓히는 것) 이 창 자체가 사라진다 — 다만 이건 최적화이자 강화이지, 지금 당장 재현 가능한 오탐/누락 사례는 없다.

- **[INFO]** `resolution-applier` 마커 파일명이 `tool_use_id` 부재 시 상수(`"nouseid"`)로 겹칠 수 있다 — fail-open 계약상 안전한 방향으로만 영향
  - 위치: `.claude/hooks/mark_resolution_in_flight.py:69` (`tool_use_id = str(payload.get("tool_use_id") or "nouseid")`)
  - 상세: 두 번의 `resolution-applier` 디스패치가 (문서상 "harness-issued" 라 사실상 일어나지 않는다고 가정된) `tool_use_id` 없이 겹치면 같은 `nouseid` 마커 파일에 각각 쓴다 — 나중 쓰기가 이긴다. 그러나 `clear_resolution_in_flight.py:42` 는 `tool_use_id` 가 falsy 면 아예 아무 것도 지우지 않고 `return 0` 하므로, 이 충돌의 유일한 효과는 "억제가 TTL(1800초) 까지 조금 더 오래 유지된다"이지 push 게이트를 허위로 여는 방향(=push 는 이 신호를 아예 안 읽는다, `_resolution_in_flight` 는 Stop 전용)도, Stop 넛지를 허위로 억제해 리뷰가 영구히 스킵되는 방향도 아니다.
  - 제안: 조치 불필요. 코드 스스로 "ids are harness-issued" 를 전제로 명시했고 그 전제가 깨져도 fail-open 방향만 바뀐다.

- **정상 확인(발견 아님)** CI 워크플로의 `concurrency:` 그룹이 올바르게 걸려 있고 정확일치 테스트로 고정돼 있다
  - 위치: `.github/workflows/review-gate.yml:36-38`, `.github/workflows/harness-checks.yml:66-68`
  - 상세: 둘 다 `group: <workflow>-${{ github.ref }}` + `cancel-in-progress: true` 로 같은 ref 에 대한 중복 실행을 취소한다. `review-gate.yml` 쪽은 `.claude/tests/test_review_gate_ci.py:407-459` 의 `WorkflowWiringTest.test_the_whole_workflow_matches_the_expected_wiring` 가 워크플로 문서 **전체**를 리터럴로 고정하므로 `concurrency:` 블록만 조용히 지우거나 `cancel-in-progress: false` 로 약화시키는 변경은 이 테스트를 즉시 RED 로 만든다. 두 잡 모두 읽기 전용(`permissions: contents: read` 또는 아예 쓰기가 없음)이라 취소돼도 손상될 공유 상태가 없다.

## 요약

이 라운드에서 리뷰 대상인 판정 코드(`review_guard.py`/`plan_guard.py`/`branch_guard.py`/
`_shared/git_probe.py`/CI 워크플로·스크립트)는 전부 프로세스당 1회, 단일 스레드로 동기 실행되며
(`.claude/hooks`, `.claude/_shared`, `.claude/skills`, `scripts` 전역에 스레드·멀티프로세스
사용이 없음을 grep 으로 실측 확인), 실제 PR 판정을 뒤집을 수 있는 살아있는 race condition 은
발견되지 않았다. 발견된 4건은 모두 INFO 수준의 잠복/설계 여백으로, (1) `git_probe` 의
`sys.modules` 캐시가 이론상 스레드-불안전하지만 오늘 이 코드베이스엔 스레드가 없어 도달 불가,
(2) fail-open 스트릭 카운터의 lost-update 는 코드 스스로 "허용된 잔여 위험"으로 이미 문서화했고
판정 자체(`ReviewDecision.blocked`)에는 영향 없음, (3) `evaluate_review()` 내부의 두 번의 독립
`git status` 스냅샷이 이론적으로 dirty/clean 판정을 좁은 창에서 흔들 수 있으나 재현 가능한
활성 결함은 아님, (4) 마커 파일명 충돌 가능성은 fail-open 계약상 안전한 방향으로만 작동한다.
CI 워크플로의 `concurrency:` 취소 그룹은 올바르게 설정돼 있고 전체-문서 정확일치 테스트로
회귀가 잠긴다.

## 위험도

LOW
