# Dependency Review — round 9 (harness-review-ci-backstop)

## 스코프 확인

`git status`/`git diff --stat` 기준 이번 라운드(9R)의 실제 변경분은 4개 파일뿐이다(프롬프트에 실린 13개 파일 중 대부분은 이전 라운드에 이미 커밋된 컨텍스트):

- `.claude/hooks/_lib/plan_guard.py` (수정 — git 프로브 5개를 위임으로 교체)
- `.claude/hooks/_lib/review_guard.py` (수정 — 동일)
- `.claude/tests/test_plan_guard.py` (수정 — 위임 유지 회귀 테스트 추가)
- `.claude/_shared/git_probe.py` (신규, untracked)

외부 패키지 추가·버전 변경·`.github/dependabot.yml` 변경은 이번 라운드에 없다. `.github/workflows/*.yml` 의 `actions/*@v7` 핀은 저장소 전체(`.github/workflows/*.yml` 14개 파일)와 일치함을 `grep` 으로 확인했다 — 새 비일관성 없음. `scripts/check-review-gate.py` 는 `argparse`/`os`/`sys` 만 쓰는 표준 라이브러리 전용으로 이전 라운드부터 변경 없음. 따라서 이번 라운드의 의존성 관점 검토는 **내부 모듈 의존 관계(#8)** 로 좁혀진다.

## 발견사항

- **[WARNING]** 신규 `_shared/git_probe.py` 가 자신이 속한 패키지의 문서화된 의존 방향을 스스로 어긴다 — import 만으로 `hooks/_lib` 를 sys.path 에 주입
  - 위치: `.claude/_shared/git_probe.py:39-45` (특히 `41-42`: `sys.path.insert(0, _HOOKS_LIB)` 후 `from branch_guard import _origin_default_branch`)
  - 상세: `.claude/_shared/__init__.py` 는 이 패키지의 존재 이유를 명시한다 — "Neither `.claude/hooks/**` nor `.claude/skills/**` may own this: both are *consumers*." 그리고 `hooks/_lib` 와 `skills/_lib` 가 같은 이름(`_lib`)이라 한 인터프리터가 둘 다 import 하면 서로를 shadow 할 수 있어 `_shared` 를 **세 번째**, 중립적인 최상위 패키지로 뒀다고 스스로 설명한다.
    이번 라운드에서 신설된 `git_probe.py` 는 그 원칙을 정확히 반대 방향으로 깬다: `_default_branch()` 하나를 위해 모듈 최상단에서 `hooks/_lib` 를 `sys.path` 에 꽂고 `branch_guard` 를 import 한다. 실제로 재현했다(자체 mktemp 스크립트, 저장소 수정 없음):
      ```
      $ python3 - <<'EOF'
      import sys, os
      sys.path.insert(0, ".../.claude")
      before = list(sys.path)
      from _shared import git_probe
      added = [p for p in sys.path if p not in before]
      print(added)
      EOF
      ['.../.claude/hooks/_lib']
      ```
      `_shared.git_probe` 를 import 하기만 해도 — `_default_branch()` 를 실제로 호출하지 않아도, `branch_guard` 해석이 전혀 필요 없는 소비자라도 — `hooks/_lib` 가 그 프로세스의 `sys.path` 맨 앞에 영구히 꽂힌다. `_shared/__init__.py` 가 경고한 "hooks/_lib 와 skills/_lib 가 서로를 shadow" 하는 바로 그 위험을, `_shared` 소속 모듈 스스로가 부작용으로 만들어낸다.
      오늘은 실제 충돌이 없다(`hooks/_lib`·`skills/_lib` 디렉터리 내용을 `comm -12` 로 대조 — `__init__.py`/`__pycache__` 외 이름 겹침 0개, `Read`/`Bash` 로 직접 확인). 하지만 `_shared` 는 이미 `.claude/skills/**` 오케스트레이터 3곳(`code_review_orchestrator.py`, `consistency_orchestrator.py`, `merge_coordinator_orchestrator.py`)의 확립된 소비자이고, 이들이 쓰는 다른 `_shared` 멤버(`report_paths`, `retry_state`, `block_integrity`)는 전부 stdlib 전용이라 이 부작용이 없다. `git_probe` 는 병합 베이스·기본 브랜치 판정처럼 오케스트레이터에도 자연스럽게 끌릴 기능이라, 다음에 그 세 orchestrator 중 하나가 `_shared.git_probe` 를 끌어다 쓰는 순간 이 부작용이 skills 쪽 프로세스에서 처음으로 활성화된다.
  - 제안: `_origin_default_branch` 해석을 `git_probe.py` 임포트 시점이 아니라 `_default_branch()` **호출 시점**의 지연 import 로 옮기거나(부작용을 실제 필요한 경로로 좁힘), 혹은 `branch_guard._origin_default_branch` 자체를 `_shared` 쪽으로 옮겨 역방향 의존을 아예 없앤다. 최소한 `git_probe.py` 최상단 주석("because `_shared` must not require `hooks/_lib` to be on `sys.path` already")이 실제로는 자신이 그 경로를 sys.path 에 얹는다는 사실과 모순됨을 명시해 다음 편집자가 오해하지 않게 한다.

- **[WARNING]** `branch_guard` 임포트가 두 훅에 이제 죽은 코드로 중복 — 이번 라운드가 없애려던 바로 그 "손-동기 쌍 drift" 클래스의 잔재
  - 위치: `.claude/hooks/_lib/plan_guard.py:66-71`, `.claude/hooks/_lib/review_guard.py:124-129`
  - 상세: 두 파일 모두 예전부터 갖고 있던 모듈 최상단 블록
    ```python
    try:
        from branch_guard import _origin_default_branch  # type: ignore
    except Exception:
        _origin_default_branch = None  # type: ignore
    ```
    이 그대로 남아 있다. 그런데 이번 라운드에서 `_default_branch` 는
    `_default_branch = _git_probe._default_branch` 로 **위임**됐고, `git_probe.py` 는 자신만의 별도 `_origin_default_branch` (같은 이름, 다른 바인딩)를 갖고 있어 그것만 실제로 쓰인다. `grep -n "_origin_default_branch" .claude/hooks/_lib/{plan_guard,review_guard}.py` 결과 각 파일에서 그 이름은 이 4줄(정의 2줄)에만 등장하고, 다른 어디에서도 읽히지 않는다 — 완전히 죽은 바인딩이다.
    영향은 오늘 기능적으로 0이다(같은 스코프의 33개 `test_plan_guard.py` 테스트 + `review_guard`/`review_gate_ci` 관련 스위트 실행 결과 전부 `OK`, 별도로 재현·확인함). 다만 이 자체가, `git_probe.py` 의 독스트링이 명시적으로 경계하는 실패 클래스("the pair drifted... this repo has now recorded three times over" — `report_paths`, `retry_state`, doc-sync matrix)의 축소판이다: `branch_guard` 를 참조하는 코드 경로가 두 훅에 하나씩, 총 두 벌로 여전히 손-복제돼 있고 그중 한 벌(모듈 최상단의 로컬 바인딩)은 이미 미사용인데도 지워지지 않았다. 다음 편집자가 "이 훅이 기본 브랜치를 어떻게 얻나"를 확인하려다 이 죽은 블록을 살아있는 경로로 오인해 여기를 고치면, 실제 동작은 `git_probe.py` 쪽에서 정의되므로 아무 효과 없이 시간을 태우거나, 최악에는 두 바인딩이 다시 갈리는 새로운 drift 지점이 된다.
  - 제안: 이 4줄을 두 파일에서 제거한다(더는 참조되지 않음을 위 grep 로 확인). `_default_branch` 위임 도입 시점에 함께 지웠어야 할 잔재다.

## 요약

이번 라운드(9R)는 새 외부 패키지·버전 변경·`dependabot.yml` 변경이 전혀 없고, GitHub Actions 핀(`@v7`)은 저장소 14개 워크플로 전체와 일치해 새로운 버전/호환성 문제도 없다. 순수하게 내부 모듈 의존 구조(#8) 재배선 — `review_guard.py`/`plan_guard.py` 의 손-복제 git 프로브 5개를 `.claude/_shared/git_probe.py` 로 위임 통합 — 이며 그 자체의 목표(자매 훅 drift 재발 방지)는 33개 회귀 테스트로 잘 고정돼 있다. 다만 그 통합 방식이 두 가지 부작용을 남겼다: (1) 신규 `_shared/git_probe.py` 가 `_shared` 패키지 자신이 문서화한 "hooks/skills 어느 쪽도 소유하지 않는다" 원칙을 깨고 `hooks/_lib` 를 import 시점에 전역 `sys.path` 로 끌어들여, `_shared` 를 별도 최상위 패키지로 둔 이유였던 hooks_lib/skills_lib 이름충돌 위험을 스스로 재도입한다(오늘은 이름 겹침이 없어 잠재적이나, `_shared` 의 기존 확립 소비자가 `.claude/skills/**` 오케스트레이터 3곳이라 재활성화 경로가 구체적이다) — 실측 재현 완료. (2) `_default_branch` 위임 도입 후에도 두 훅 모두 예전의 로컬 `branch_guard` import 블록이 죽은 채로 남아, 이 PR 이 스스로 경계하는 "손-복제 쌍 drift" 클래스를 축소판으로 재생산한다. 둘 다 오늘의 게이트 판정(BLOCK/ALLOW)에는 영향이 없고 전 테스트가 GREEN 이라 verdict-affecting 결함은 아니다.

## 위험도

LOW
