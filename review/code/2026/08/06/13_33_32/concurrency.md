# 동시성(Concurrency) Review — round 9

## 스코프 확인

`git diff origin/main...HEAD` 로 이번 브랜치 전체 diff, `git status`/`git diff`(작업트리)로
"round 9"(이번 세션)의 실제 증분을 각각 확인했다. round 9 의 실제 변경은:

- `.claude/hooks/_lib/plan_guard.py`, `.claude/hooks/_lib/review_guard.py`: 두 훅이 각각
  손으로 복제해 갖고 있던 다섯 개 git 프로브(`_run_git`/`_repo_root`/`_default_branch`/
  `_merge_base`/`_porcelain_path`)를 신규 `.claude/_shared/git_probe.py` 로 위임하는 **순수
  DRY 추출**. 로직 자체(구현)는 옮기기 전과 AST 동일 — 새 subprocess 호출도, 새 잠금도,
  새 스레드/async 코드도 추가되지 않았다.
- `.claude/tests/test_plan_guard.py`: 그 위임이 유지되는지(`is` 동일성 + 로컬 재정의 부재)
  고정하는 `GitProbesAreNotReDuplicatedTest` 신규 추가.

이 외 파일들(`review-gate.yml`/`harness-checks.yml`/`scripts/check-review-gate.py`/
`test_review_gate_ci.py` 등)은 이전 라운드(1R~8R)에서 이미 도입·검토된 것으로, 이번 라운드
diff 에는 포함되지 않는다(`git status` 로 확인 — uncommitted 변경은 `plan_guard.py`,
`review_guard.py`, `test_plan_guard.py`, 신규 `_shared/git_probe.py` 뿐).

## 점검한 것

1. **신규 공유 모듈 `_shared/git_probe.py` 자체의 동시성 성질** — 읽었다. 모듈 레벨 가변
   상태는 `_origin_default_branch`(import 시 1회 바인딩, 이후 불변) 하나뿐이고, 잠금·스레드·
   비동기 코드가 없다. `_run_git` 은 매 호출마다 독립된 `subprocess.run(..., timeout=5.0)` 이라
   호출 간 공유 상태가 없다 — 추출 전과 동일한 동기·단일 프로세스 실행 모델이다.

2. **`sys.path` 조작의 check-then-act 패턴** (`plan_guard.py`/`review_guard.py` 양쪽이
   `if _CLAUDE_DIR not in sys.path: sys.path.insert(0, _CLAUDE_DIR)` 를 각자 수행) — 이론상
   TOCTOU 형태이지만, 이 저장소의 실행 모델에서 각 훅은 스레드 없는 단일 프로세스로 실행되고
   두 모듈이 같은 프로세스에서 import 될 때도 CPython import 락이 모듈 최상위 코드 실행을
   직렬화하므로 실질적 경쟁이 성립하지 않는다. 새로 도입된 것도 아니다(기존 두 훅이 이미
   각자 이 패턴을 썼다 — 이번 추출로 `_shared` 를 위해 다시 반복됐을 뿐).

3. **GitHub Actions `concurrency:` 그룹** — `harness-checks.yml`(`harness-checks-${{
   github.ref }}`) 과 `review-gate.yml`(`review-gate-${{ github.ref }}`) 모두
   `cancel-in-progress: true` 로 같은 ref 에 대한 중복 실행을 취소한다. 두 워크플로 모두 이번
   PR 범위 안에 있지만, 이 블록 자체는 round 9 diff 밖(이전 라운드에 이미 존재)이다.
   `grep -L "concurrency:" .github/workflows/*.yml` 로 저장소의 모든 워크플로가 그룹을 갖고
   있음을 확인했다 — 이번에 추가된 신규 워크플로가 그룹 없이 들어와 동일 ref 에 대해 여러
   러너가 동시에 같은 `git fetch`/체크아웃을 밟는 사각을 만들지 않는다.

4. **`resolution_in_flight` 마커 메커니즘** (`.claude/hooks/mark_resolution_in_flight.py` /
   `clear_resolution_in_flight.py`, `review_guard._resolution_in_flight`) — round 9 diff 밖
   이지만 이 세션이 다루는 파일들과 강하게 연결돼 있어 함께 읽었다. 마커 파일명이
   `tool_use_id` 로 고유하므로 동시에 여러 `resolution-applier` 가 디스패치돼도(다른
   worktree/세션이 같은 `CLAUDE_PROJECT_DIR` 를 공유하는 경우 포함) 쓰기 경합이 없다. 읽기
   (`os.listdir` 후 개별 파일 열람)와 다른 프로세스의 동시 삭제(`clear_resolution_in_flight.py`)
   사이에 이론적 TOCTOU 는 있지만(파일이 listdir 이후 삭제되면 `open()` 이 `OSError` 로 실패)
   `_marker_epoch` 는 그 경로에서 예외를 잡지 않는 대신 `_resolution_in_flight` 의 바깥
   루프가 `except OSError: pass` 로 감싸므로 크래시 없이 그 마커만 무시하고 넘어간다 — 안전.

5. **`evaluate_review()` 내부의 순차 `git` 호출 다중성 (사전 존재, round 9 미변경)** — 정보용
   관찰. `evaluate_review` 는 `changed`(커밋분 diff + `git status`) 를 먼저 계산하고, 그 뒤
   별도의 `git status` 호출로 `dirty` 집합을 다시 구한다(라인 925-927 → 945, `review_guard.py`).
   두 호출 사이의 창(수 ms~수십 ms)에 `resolution-applier` 같은 동시 프로세스가 파일을 편집하면
   그 파일이 "changed" 목록과 "dirty" 목록 사이에서 잠깐 불일치할 수 있어, `_authoritative_code_time`
   이 그 파일을 clean(커밋 시각)으로 오분류할 여지가 이론적으로 있다. 다만 (a) 이 경합의
   최대 오차는 신선도 비교에서 한 파일의 편집 시각을 한 폴링 주기만큼 과거로 읽는 정도이고,
   (b) 이 가드는 "push 마다/turn 마다 재평가"되는 반복 게이트라 다음 호출에서 자연히
   교정되며, (c) 모듈 docstring 이 이미 "a strong nudge, not a precise oracle" 로 명시한
   fail-open 설계다. 이번 라운드가 만든 것도 악화시킨 것도 아니고(로직 이동 전과 완전히
   동일한 순서), 별도 조치 없이 기록만 남긴다.

## 검증 명령

```
$ git diff -- .claude/hooks/_lib/plan_guard.py .claude/hooks/_lib/review_guard.py .claude/tests/test_plan_guard.py
# → 다섯 함수의 로컬 정의 삭제 + `_shared.git_probe` 위임 대입 + 신규 회귀 테스트만.
# 로직·제어흐름 변경 없음 (diff 확인).

$ python3 -m unittest discover -s .claude/tests -p 'test_plan_guard.py' -v
# Ran 33 tests in 0.244s — OK
# (GitProbesAreNotReDuplicatedTest 포함 전체 GREEN — 공유 객체 동일성 확인)

$ grep -L "concurrency:" .github/workflows/*.yml
# (출력 없음 — 모든 워크플로가 concurrency 그룹을 갖는다)
```

## 발견사항

없음. round 9 diff(git 프로브 DRY 추출 + 배선 테스트)는 동시성 관련 코드를 추가하지
않았고, 추출 자체도 동시성 관점에서 안전하다(신규 잠금 불필요 로직, 신규 공유 가변 상태
없음). 함께 검토한 인접 코드(마커 메커니즘, CI concurrency 그룹, 순차 git 호출)에서도
새로 손볼 만한 결함은 찾지 못했다 — §5 는 정보성 관찰이며 이번 라운드가 만든 것도
악화시킨 것도 아니다.

## 요약

이번 라운드의 실제 변경은 두 훅(`plan_guard.py`, `review_guard.py`)이 손으로 복제해 온 다섯
개의 git 프로브 함수를 `.claude/_shared/git_probe.py` 하나로 위임하는 순수 리팩터링과, 그
위임이 유지되는지(객체 동일성 + 로컬 재정의 부재) 고정하는 배선 테스트뿐이다. 두 함수
집합 모두 잠금·스레드·async·풀링과 무관한 동기 subprocess 래퍼이고, 추출 과정에서 제어
흐름이나 호출 순서가 바뀌지 않았다(diff 로 확인). 이 세션이 함께 다루는 인접 파일들
(`review-gate.yml`/`harness-checks.yml` 의 `concurrency:` 그룹, `resolution_in_flight`
마커 메커니즘, `evaluate_review()` 내부의 순차 git 호출)도 점검했으나 모두 기존 설계(TTL
기반 재무장, ref 단위 workflow 취소, tool_use_id 키잉)로 이미 봉쇄돼 있거나 이번 diff 밖의
사전 존재 특성이라 새 조치가 필요하지 않다.

## 위험도

NONE
