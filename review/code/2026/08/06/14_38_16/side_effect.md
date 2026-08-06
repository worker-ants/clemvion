# 부작용(Side Effect) Review — round 11

## 방법론 메모

- 프롬프트가 전체 미포함으로 표시한 `.claude/hooks/_lib/review_guard.py`,
  `.claude/tests/README.md`, `.claude/tests/test_block_integrity.py`,
  `.claude/tests/test_review_guard_hardening.py` 는 `Read` 로 직접 열어 확인했다.
  `.claude/tests/test_review_gate_ci.py` 는 프롬프트가 516/829 줄만 실었으므로 나머지도
  `Read` 로 채웠다.
- 이번 라운드의 실제 diff 는 `git diff origin/main...HEAD -- <파일>` (판정 코드 5개 +
  워크플로 2개 + 스크립트 1개)와, 직전 커밋(`9a7b28764`, "10R")만의 diff 두 겹으로 확인했다 —
  10라운드가 이미 지나간 코드이므로 "이번에 새로 review 하는 것이 무엇인가"를 좁히기 위해서다.
- 아래 CRITICAL 은 **격리된 내 작업 디렉터리에서 실제로 재현**했다(작업 트리는 건드리지
  않음). 재현 커맨드와 출력을 그대로 남긴다.

---

## 발견사항

### [CRITICAL] `_origin_default_branch()`의 "Method 1이 정상 케이스를 공짜로 처리한다"는 전제가 새로 연결된 CI 소비자에서는 거짓이다 — 네트워크 히컵 한 번으로 CI 백스톱의 판정이 "미커버"→"통과"로 뒤집힌다

- 위치: `.claude/_shared/git_probe.py:46-85`(`_origin_default_branch`, 특히 74-77행의
  "Method 1 … covers the normal case for free" 주석), `.claude/_shared/git_probe.py:139-152`
  (`_default_branch`) — 호출부는 `.claude/hooks/_lib/review_guard.py:920`
  (`evaluate_review`) 과 `.claude/hooks/_lib/plan_guard.py:273`(`evaluate_plan`).
  트리거는 `.github/workflows/review-gate.yml:55-57`(`actions/checkout@v7,
  fetch-depth: 0`) → `scripts/check-review-gate.py:97`(`decision = evaluate(root)`).

- 상세:

  `_origin_default_branch`는 두 단계다 — Method 1 `git symbolic-ref --short
  refs/remotes/origin/HEAD`(로컬, 네트워크 없음), 실패하면 Method 2 `git remote show
  origin`(**네트워크 호출**, 2초 타임아웃). 주석은 "Method 1 이 정상 케이스를 공짜로
  처리한다"고 되어 있는데, 이는 `git clone` 이 만드는 로컬 클론에서만 참이다(`git clone`은
  원격이 알려준 HEAD 를 `refs/remotes/origin/HEAD` symbolic-ref 로 자동 기록한다).

  이번 PR 이 처음으로 이 함수를 **`actions/checkout`이 만드는 체크아웃**(CI 백스톱,
  `check-review-gate.py`)에 연결했다. `actions/checkout`은 `git clone`이 아니라
  `git init` + `git remote add` + `git fetch`로 구성되고, `git remote set-head`를
  호출하지 않는다 — 그래서 `refs/remotes/origin/HEAD`가 **존재하지 않는다**. 아래
  "재현" 절에서 `actions/checkout`과 동일한 절차(init+remote add+fetch, `git clone`
  아님)를 로컬에서 재현해 Method 1 이 항상 실패함을 확인했다.

  즉 CI 백스톱의 매 실행마다 `_default_branch()`가 **필연적으로 Method 2(네트워크 호출)로
  떨어진다** — 이 자체가 "의도치 않은 네트워크 호출"이다(점검 관점 7). 더 심각한 것은
  그 네트워크 호출이 실패했을 때다: `actions/checkout` 체크아웃에는 `refs/heads/main`/
  `refs/heads/master` 같은 **로컬 브랜치가 없다**(`refs/remotes/origin/main`만 있다,
  아래 재현에서 `rev-parse --verify refs/heads/main`이 `fatal: Needed a single
  revision`로 실패함을 확인). 따라서 `_default_branch()`의 "흔한 이름 프로브" 폴백도
  CI 체크아웃에서는 죽어 있는 코드다. 즉 CI 환경에서 `_default_branch()`가 성공하는
  유일한 경로는 **네트워크 호출**뿐이고, 그 호출이 실패하면 `_default_branch()`는
  `None`을 반환한다.

  `evaluate_review()`(review_guard.py:920-925)에서:
  ```python
  default = _default_branch(cwd)
  base = _merge_base(cwd, default) if default else None
  committed = _committed_code_changes(cwd, base) if base else []
  uncommitted = _uncommitted_code_changes(cwd)
  changed = sorted(set(committed) | set(uncommitted))
  if not changed:
      return ReviewDecision(False, "no codebase/ changes on this branch — allowed")
  ```
  `default is None` → `base is None` → `committed = []`. 신선하게 체크아웃된 트리는
  깨끗하므로 `uncommitted`도 `[]`. 결과: `changed = []` → **"코드 변경 없음 — 허용"** —
  실제로는 `codebase/**`를 바꾼 PR인데도 그렇게 답한다. `check-review-gate.py`는
  현재 관측 모드(하드 실패 아님)라 오늘 당장 빌드를 막지는 않지만, 이 층 전체의
  존재 이유가 바로 "이 PR 이 codebase/** 를 바꿨는데 커버 안 됐다"를 감지하는 것이므로
  이 경로에서는 **정확히 그 감지를 놓치고 조용히 "통과"로 집계**된다 — 지금 관측
  모드 데이터를 근거로 `--enforce` 전환을 결정하겠다는 계획(plan 문서 §마찰) 자체를
  오염시키고, `--enforce`가 켜지는 순간 이건 진짜 fail-open 우회가 된다.

  기존 테스트는 이 경로를 하나도 건드리지 않는다: harness 스위트 전체에 `git remote
  add`가 **0회** 등장한다(아래 재현의 grep 참고). `test_review_gate_ci.py`의 모든
  실물-git 테스트(`ReviewGateCliTest`, `TheRealGateIgnoresTheEnvironmentTest` 등)는
  `git init -b main`만 하고 `origin` remote를 전혀 구성하지 않는다 — 그러면
  `_origin_default_branch`의 "Step 0"(56-61행)이 즉시 `None`을 반환해 Method 1/2를
  건드리지 않고, `_default_branch`는 로컬 `main` 브랜치 프로브로 **우연히** 성공한다.
  즉 테스트가 초록인 이유가 "CI 체크아웃과 같은 git 위상에서 정답을 낸다"가 아니라
  "`origin`이 아예 없는, CI 와는 다른 위상을 굴린다"이다 — 지침이 말하는 "같은 이름을
  가졌지만 통과하는 이유가 다른 테스트"에 해당한다.

- 재현 (내 scratchpad, `mktemp -d`로 격리, 작업 트리 무변경):

  ```bash
  WORK=$(mktemp -d)
  # "origin" bare repo + main/feature 히스토리(codebase/ 변경 포함)
  git init --bare -b main "$WORK/origin.git"
  # ... seed: main에 codebase/a.ts, feature에 codebase/b.ts 커밋 후 origin에 push …

  # actions/checkout과 동일한 절차 — git clone이 아니라 init+remote add+fetch
  mkdir "$WORK/ci-checkout" && cd "$WORK/ci-checkout"
  git init -q
  git remote add origin "$WORK/origin.git"
  git -c protocol.version=2 fetch --no-tags --prune --no-recurse-submodules origin feature
  git checkout -q --detach FETCH_HEAD
  git fetch --no-tags origin main   # review-gate.yml의 "Fetch base ref" 스텝과 동일

  # .claude/hooks, .claude/_shared, scripts/check-review-gate.py 를 그대로 복사

  git diff --name-only origin/main...HEAD -- codebase/   # → codebase/b.ts (진짜 변경 있음)

  # Scenario A: origin 이 정상 도달 가능 (Method2 네트워크 호출 성공)
  python3 check-review-gate.py --root "$WORK/ci-checkout"
  # → review-gate: 미커버 — 1 codebase/ file(s) changed … no resolved review …  (정답)

  # Scenario B: 게이트 실행 시점에 origin 이 잠깐 도달 불가 (네트워크 히컵 시뮬레이션)
  git remote set-url origin "$WORK/does-not-exist.git"
  python3 check-review-gate.py --root "$WORK/ci-checkout"
  # → review-gate: 통과 — no codebase/ changes on this branch — allowed   (오답, 판정 뒤집힘)
  ```

  실제로 얻은 출력(그대로 붙임):
  ```
  === sanity: direct git diff origin/main...HEAD -- codebase/ ===
  codebase/b.ts

  ===== Scenario A: origin reachable (Method2 network call succeeds) =====
  review-gate: 미커버 — 1 codebase/ file(s) changed on this branch but no resolved review (review/code/**/SUMMARY.md) was found.
  review-gate: 관측 모드라 실패시키지 않습니다. …

  ===== Scenario B: origin unreachable when the gate runs (network blip) =====
  review-gate: 통과 — no codebase/ changes on this branch — allowed
  ```

  Method 1 이 `actions/checkout` 위상에서 항상 실패함을 별도로 확인:
  ```
  $ git symbolic-ref --short refs/remotes/origin/HEAD
  fatal: ref refs/remotes/origin/HEAD is not a symbolic ref   (rc=128)
  $ git rev-parse --verify refs/heads/main
  fatal: Needed a single revision                              (rc=128, 로컬 브랜치 없음)
  ```

  테스트 스위트에 `origin` remote 구성이 전무함을 확인:
  ```
  $ grep -rn "remote add" .claude/tests/*.py
  (결과 없음)
  ```

- 확신도: Method 1 이 `actions/checkout` 위상(= `git init`+`remote add`+`fetch`, `git
  clone` 아님)에서 실패한다는 것과 그로 인한 판정 뒤집힘은 로컬 재현으로 **실증**했다.
  실제 GitHub Actions 러너가 정확히 이 위상(별도 `git remote set-head` 스텝 없음)을
  만든다는 것은 `actions/checkout`의 공개된 동작이자 커뮤니티에 흔히 보고되는
  현상이지만, 이 저장소의 다른 미해결 항목("`Fetch base ref`가 실제로 필요한가")과
  마찬가지로 **실제 러너 없이는 100% 확정할 수 없다** — 다만 그 항목과 달리 이 발견은
  "Method 1 이 실패한다"는 전제 자체를 로컬에서 독립적으로 재현했고, "Method 2 가
  실패하면 판정이 뒤집힌다"는 인과를 실제 스크립트 실행으로 보였다는 점에서 더 강한
  증거를 갖는다.

- 제안: `_default_branch()`가 브랜치 기본 이름을 GitHub Actions 컨텍스트에서 **재추론**하지
  않게 한다 — CI 호출부(`check-review-gate.py`)가 `github.base_ref`를 이미 알고 있으므로
  (워크플로가 `Fetch base ref` 스텝에서 이미 `$BASE_REF`로 쓰고 있다), 그 값을
  `--base-ref` 인자나 환경변수로 게이트에 전달해 `_origin_default_branch()`의 네트워크
  의존을 CI 경로에서는 완전히 우회하는 편이 안전하다(로컬 훅 경로는 지금 그대로 둬도 됨,
  거긴 보통 `git clone`이라 Method 1 이 실제로 공짜다). 최소 조치로는 워크플로에
  `git remote set-head origin --auto` 한 스텝을 추가해 Method 1 을 CI 에서도 유효하게
  만들 수 있다. 어느 쪽이든, `origin` remote 를 실제로 구성한(그리고 `actions/checkout`
  위상을 흉내 낸) 회귀 테스트가 없으면 이 클래스는 다시 조용히 재발한다 — 이 브랜치가
  git 프로브 손-동기화에서 이미 세 번 겪은 것과 같은 "아무 테스트도 실행하지 않는 성공
  경로" 패턴이다.

---

### [INFO] `_default_branch()`의 `if True:` 는 리팩터 잔재 — 동작 변화는 없음

- 위치: `.claude/_shared/git_probe.py:139-146`
- 상세: 이전 버전은 `_origin_default_branch`가 옵셔널 임포트(실패 시 `None`)였을 때의
  `if resolver is not None:` 가드였다. 10R 에서 `_origin_default_branch`가 항상 존재하는
  직접 함수가 되면서 조건이 상수 `True`가 됐는데 `if` 블록 자체는 지우지 않았다. 기능
  변화는 없다(예외를 삼키는 `try/except Exception: pass`는 그대로) — 단지 다음에 이
  블록을 리팩터하는 사람이 "왜 조건이 없나"를 다시 추적해야 하는 죽은 분기다. 부작용
  관점에서 위험은 없으나 위 CRITICAL 을 고치는 김에 정리하면 좋다.
- 제안: `if True:` 블록을 제거하고 본문을 그대로 내어 쓴다.

---

### [INFO] `_shared/git_probe.py`의 신설 위임 함수들이 프로세스 전역 `sys.path`를 뮤테이트하는 기존 패턴을 그대로 물려받음 — 새 위험은 아님

- 위치: `.claude/hooks/_lib/branch_guard.py:25-32`, `.claude/hooks/_lib/plan_guard.py:52-61`
  (둘 다 `_CLAUDE_DIR`를 계산해 `sys.path.insert(0, _CLAUDE_DIR)`)
- 상세: `review_guard.py`는 `report_paths`/`block_integrity`를 쓰기 위해 이미 이 패턴을
  갖고 있었다(라운드 7 이전부터). 9R 에서 `branch_guard.py`/`plan_guard.py`도
  `_shared.git_probe`를 쓰려고 같은 패턴을 새로 얻었다 — 이 자체는 프로세스의
  `sys.path`(공유 인터프리터 전역 상태)를 임포트 시점에 변경하는 부작용이지만,
  `if _CLAUDE_DIR not in sys.path:` 로 멱등성이 보장되고, 세 훅 모두 별개
  서브프로세스(`python3 -m` 또는 훅 스크립트 자체)로 실행되므로 다른 세션과 상태를
  공유하지 않는다. 이전 버전(9R 이전)의 `_origin_default_branch`가 `importlib.util`로
  `branch_guard.py`를 파일 경로 재로딩하며 `sys.modules`를 영구 오염시키던 것(이번
  10R 커밋 메시지의 W2)에 비하면 훨씬 안전한 형태로 수렴했다. 새로 추가된 위험은 아니라
  CRITICAL/WARNING 은 아니지만, 점검 관점 "전역 변수" 항목에 해당하므로 기록해 둔다.
- 제안: 없음(현재 형태가 이 저장소의 `_lib` 네임스페이스 충돌 문제에 대한 합리적 타협).

---

## 요약

핵심 발견은 하나다 — 이번 PR 이 `_shared/git_probe.py`의 `_origin_default_branch()`를
처음으로 `actions/checkout` 이 만드는 체크아웃(CI 백스톱)에 연결하면서, 그 함수 내부
주석이 전제한 "로컬 symbolic-ref 로 공짜로 해결된다"가 깨졌다. `actions/checkout`
위상(로컬 재현으로 확인: `origin/HEAD` symref 없음, `refs/heads/main` 같은 로컬 브랜치도
없음)에서는 매 CI 실행마다 네트워크 호출(`git remote show origin`)에 의존하게 되고, 그
호출이 실패하면 `_default_branch()`가 `None`을 반환해 커밋된 변경분 비교 전체가
스킵되며 "코드 변경 없음 — 허용"으로 조용히 판정이 뒤집힌다 — 실제로 스크립트를 격리
환경에서 실행해 재현했다. 오늘은 관측 모드라 빌드를 막지는 않지만 (a) `--enforce` 전환
여부를 결정할 관측 데이터 자체를 오염시키고 (b) `--enforce` 가 켜지면 그대로 fail-open
우회가 된다. `origin` remote 를 구성하는 테스트가 harness 스위트에 전혀 없어(`grep`으로
확인, 0건) 850개 테스트가 전부 GREEN 인 채로 이 경로는 한 번도 실행되지 않는다 — "판정을
바꾸는 헬퍼를 어떤 테스트도 실행하지 않는다"는 이 브랜치가 반복해서 겪어 온 결함 클래스의
연장선이다. 그 외에는 이번 라운드의 변경(6번째 git 프로브 통합, `_origin_default_branch`의
가짜 seam 제거, resolution 마커 경로 4곳 정합성 고정)이 전역 상태·파일시스템·시그니처·
환경변수 축에서 새로운 위험을 추가하지 않았고, `sys.modules` 영구 오염 같은 기존 부작용은
오히려 이번 라운드에 제거됐다.

## 위험도

CRITICAL
