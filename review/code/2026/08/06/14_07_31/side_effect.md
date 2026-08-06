# Side Effect Review — round 10 (CI 백스톱)

## 선행 확인 — 9R side_effect.md 의 두 WARNING 은 이번 라운드에 해소됨

- `_origin_default_branch` 죽은 바인딩(9R WARNING 1): `plan_guard.py`/`review_guard.py` 에 있던
  `try: from branch_guard import _origin_default_branch except: None` 블록이 이번 라운드에서
  아예 삭제됐다. `grep -n "_origin_default_branch" .claude/hooks/_lib/plan_guard.py
  .claude/hooks/_lib/review_guard.py` → 정의/사용 없음(0건). 대신 `_default_branch =
  _git_probe._default_branch` 로 위임하므로 해당 이름의 죽은 바인딩 자체가 사라졌다.
- `_shared/git_probe.py` 가 env 정적 스캐너 대상 밖(9R WARNING 2): `test_review_gate_ci.py` 의
  `TheGateItselfDoesNotBranchOnCiEnvTest` 가 이번 라운드에서 `_SCANNED_LIB` (hooks/_lib 3개) +
  `(_harness.CLAUDE_DIR / "_shared").glob("*.py")` 로 스캔 대상을 확장했다 — `git_probe.py` 가
  이제 포함된다. 실측: `python3 -m unittest ... test_review_gate_ci.py -v` 19 tests OK.

새 위임 모듈 자체가 새로운 부작용 표면이므로, 아래는 그 표면에서 발견된 것이다.

## 발견사항

- **[WARNING]** `_origin_default_branch` 의 `sys.modules` 캐싱이 표준적인 mock 지점을 조용히
  무력화한다 — 9R 이 없앤 "패치했는데 아무 효과 없다" 함정이 다른 메커니즘으로 재도입됨
  - 위치: `.claude/_shared/git_probe.py:35-59` (`_origin_default_branch`, 특히
    `49: mod = sys.modules.get("_git_probe_branch_guard")` ~
    `59: return getattr(mod, "_origin_default_branch", None)`). 호출 지점:
    `.claude/hooks/_lib/plan_guard.py:110` (`_default_branch = _git_probe._default_branch`),
    `.claude/hooks/_lib/review_guard.py:208` (동일).
  - 상세: `_origin_default_branch(cwd)` 는 `.claude/hooks/_lib/branch_guard.py` 를
    `importlib.util.spec_from_file_location` 으로 **별도 로드**해 `sys.modules` 에
    `"_git_probe_branch_guard"` 라는 합성 이름으로 영구 캐싱한다. 이 사본은 정상 경로로
    import 된 `branch_guard` 모듈(예: 훅이 `import branch_guard` 하거나 테스트가
    `from _lib import branch_guard as bg` 하는 것)과 **다른 모듈 객체**다. 이 저장소의
    문서화된 정본 해석기는 `branch_guard._origin_default_branch` 라고 여러 곳에 적혀
    있는데(plan_guard.py/review_guard.py 이전 버전 주석, `_shared/git_probe.py` 자신의
    docstring "`branch_guard`'s canonical default-branch resolver"), 실제로 `plan_guard`/
    `review_guard` 가 참조하는 것은 그 정본이 아니라 **git_probe 가 몰래 다시 로드한 별도
    사본**이다. 실증(스크래치 프로세스, 실제 저장소 경로 사용, 작업 트리 미변경):
    ```
    $ python3 - <<'PY'
    import sys, os
    from unittest import mock
    sys.path.insert(0, ".../.claude")
    sys.path.insert(0, ".../.claude/hooks/_lib")
    import plan_guard as pg, branch_guard as bg
    with mock.patch.object(bg, "_origin_default_branch", return_value="mocked-default"):
        print(pg._default_branch("..."))   # → "main", NOT "mocked-default"
    PY
    ```
    출력은 `main` — `bg._origin_default_branch` 를 목으로 바꿔도 `pg._default_branch()` 는
    전혀 영향받지 않는다(`gp._default_branch` 로도 동일 확인, `cached_mod is bg` → `False`).
    이것은 정확히 9R `side_effect.md` 가 WARNING 으로 적었던 "테스트가 의도한 이름을 패치했는데
    실제로는 아무것도 가로채지 못하는" 함정과 **같은 실패 서명**이다 — 9R 은 죽은 import
    바인딩이 원인이었고 이번 라운드에서 그건 삭제됐지만, 대체된 위임 설계(`git_probe` 의
    lazy-load-and-cache)가 **같은 함정을 다른 메커니즘으로** 재도입했다.
    현재 이 이름(`bg._origin_default_branch`)을 패치하는 테스트는 `test_branch_guard.py` 의
    `bg.evaluate()` 케이스 하나뿐이고, 그 테스트는 `bg.evaluate()` 자신의 로컬 호출을 검증하는
    것이라 이 캐싱과 부딪히지 않는다(`grep -rn "_origin_default_branch"
    .claude/tests/*.py` → 1건, 위 케이스). 즉 **지금 당장 살아있는 결함은 아니다** — 다음에
    누군가 `plan_guard`/`review_guard` 의 기본 브랜치 해석을 목으로 통제하려고 이 자연스러운
    이름을 패치하면 조용히 무시된다.
    두 번째 부수 효과: `sys.modules["_git_probe_branch_guard"]` 는 **프로세스 수명 내내
    남는 새 전역 상태**다. 프로덕션에서는 훅/CI 호출이 각각 새 프로세스라 문제 없지만, 846개+
    테스트가 한 프로세스에서 도는 하네스 스위트에서는 첫 호출 이후 그 캐시가 스위트 나머지
    전체에 남는다.
  - 제안: `_origin_default_branch` 를 캐시 없이 매번 다시 로드하거나(비용이 걱정되면
    `functools.lru_cache` 로 **의도를 명시**), 더 간단하게는 합성 모듈을 새로 만들지 않고
    `sys.path` 에 `_HOOKS_LIB` 를 넣은 뒤 `importlib.import_module("branch_guard")` 로
    **정본과 같은 이름/캐시 슬롯**을 쓰도록 바꾼다(이 경로는 이미 훅들이 쓰는 경로이므로 이름
    충돌 위험이 낮다 — `_shared` 소비자 중 하나인 skills 쪽만 별도 검증). 최소한
    `GitProbesAreNotReDuplicatedTest` 급의 테스트로 "`bg._origin_default_branch` 를 패치하면
    `git_probe._default_branch` 의 정본 브랜치 해석도 그 값을 쓴다" 를 고정해, 이 사실이
    조용히 반대로 남지 않게 한다.

- **[WARNING]** 같은 캐싱이 exec 실패를 프로세스 수명 동안 되돌릴 수 없게 고정한다
  (분리된 문제, 같은 근본 원인)
  - 위치: `.claude/_shared/git_probe.py:49-59`, 특히 `55: sys.modules["_git_probe_branch_guard"]
    = mod` 가 `56: spec.loader.exec_module(mod)` **앞**에 실행됨.
  - 상세: `sys.modules[name] = mod` 대입이 `exec_module()` 완료 **전**에 일어난다(데이터클래스가
    `sys.modules[cls.__module__]` 를 내부적으로 참조하므로 이 순서 자체는 올바르고 필요하다 —
    직접 재현: 이 대입을 빼면 `branch_guard.py` 의 `@dataclass` 데코레이터가
    `AttributeError: 'NoneType' object has no attribute '__dict__'` 로 즉시 죽는다). 문제는
    `exec_module` 이 **도중에 예외를 던지면**, 이미 `sys.modules` 에 등록된 반쯤 초기화된
    모듈 객체가 **영구히 캐싱된 채로 남는다**는 것 — 다음 호출은 `mod = sys.modules.get(...)` 가
    `None` 이 아닌 이 손상된 객체를 돌려주므로 `if mod is None:` 분기(재시도 경로)에 다시는
    들어가지 않는다. 실증(스크래치 사본, 작업 트리 미변경):
    ```
    # branch_guard.py 를 일시적으로 깨뜨림 → 첫 호출 실패 + sys.modules 에 캐싱됨:
    call #1 (branch_guard.py broken) -> resolver: None | cached in sys.modules: True
    # 파일을 원래 정상 내용으로 되돌린 뒤 재호출해도:
    call #2 (branch_guard.py repaired) -> resolver: None   # 영구히 복구 불가
    ```
    프로덕션 영향은 제한적이다 — 훅/CI 호출은 프로세스당 1회이므로 이 "영구 오염"은 그 1회
    실행에서 `main`/`master` 로컬 프로브 폴백으로 조용히 강등되는 정도로 끝난다(파일이 정말
    깨졌다면 그 자체가 더 큰 문제이기도 하다). 다만 (a) 같은 프로세스에서 반복 호출되는
    하네스 테스트 스위트, (b) 장차 이 모듈을 재사용할 수 있는 장기 실행 오케스트레이터
    프로세스에서는, 일시적 원인(디스크 경합, 동시 쓰기 중 읽기 등)으로 단 한 번 실패해도
    그 프로세스가 사는 동안 정본 origin 해석이 되돌릴 수 없이 로컬 프로브 폴백으로 고정되고,
    그 사실을 알리는 로그/경고가 전혀 없다.
  - 제안: `except Exception` 절에서 `sys.modules.pop("_git_probe_branch_guard", None)` 으로
    실패한 등록을 되돌려 다음 호출이 재시도하게 한다. (등록 자체를 없앨 수는 없다 — 위에서
    확인했듯 `@dataclass` 가 그것을 요구한다.)

## 실증 명령

```
$ grep -n "_origin_default_branch" .claude/hooks/_lib/plan_guard.py .claude/hooks/_lib/review_guard.py
.claude/hooks/_lib/plan_guard.py:110:_default_branch = _git_probe._default_branch  # (delegation, not the name itself)
# → 이름 자체(_origin_default_branch) 는 두 파일 어디에도 없음. 9R WARNING 해소 확인.

$ python3 -m unittest discover -s .claude/tests -p 'test_plan_guard.py' -v 2>&1 | tail -3
Ran 33 tests in 0.272s
OK

$ python3 -m unittest discover -s .claude/tests -p 'test_review_gate_ci.py' -v 2>&1 | tail -3
Ran 19 tests
OK
```

Mock-bypass·캐시-오염 두 실증 모두 `mktemp -d` 스크래치 프로세스에서 실행, 작업 트리는
건드리지 않았다(각 실증 스크립트와 결과는 위 발견사항 본문에 인용).

## 요약

이번 라운드의 신규 부작용 표면은 `.claude/_shared/git_probe.py` 하나다. 9R `side_effect.md` 가
남긴 두 WARNING(죽은 `_origin_default_branch` 바인딩, `_shared` 가 env 정적 스캔 밖)은 둘 다
이번 라운드에서 정확히 처리됐다(전자는 이름 자체를 삭제, 후자는 스캔 대상을 `_shared/*.py` 로
확장). 대신 그 자리를 대체한 위임 설계 — `git_probe._origin_default_branch` 가
`branch_guard.py` 를 합성 모듈 이름(`_git_probe_branch_guard`)으로 다시 로드해 `sys.modules` 에
영구 캐싱하는 방식 — 가 실측으로 확인한 두 개의 새 부작용을 낳았다: (1) 정본으로 문서화된
`branch_guard._origin_default_branch` 를 목으로 바꿔도 `plan_guard`/`review_guard` 의 실제
브랜치 해석에는 아무 영향이 없다(9R 이 없앤 것과 같은 실패 서명이 다른 메커니즘으로 재발),
(2) `exec_module` 실패 시 반쯤 초기화된 모듈이 영구 캐싱돼 그 프로세스 안에서는 파일이
복구돼도 재시도되지 않는다. 둘 다 판정 코드(`_default_branch` → `evaluate_plan`/
`evaluate_review`)에 닿아 있지만 현재 이를 트리거하는 테스트나 운영 경로는 없어(각 훅/CI
호출은 독립 프로세스) 살아있는 결함은 아니다 — 잠복이며, 이 브랜치가 9라운드째 쫓아온
"위임 지점에서 생기는 조용한 함정" 클래스의 새 표면으로 기록해 둔다. 그 외 시그니처·공개
인터페이스·환경변수·네트워크 호출·파일시스템 부작용은 이번 diff 범위(`git_probe.py` 신설,
`branch_guard.py`/`plan_guard.py`/`review_guard.py` 의 다섯 git 프로브 위임, 세 테스트 파일
추가)에서 새로 발생한 것이 없음을 직접 확인했다.

## 위험도

LOW
