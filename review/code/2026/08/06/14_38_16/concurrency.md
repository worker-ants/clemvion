# 동시성(Concurrency) Review

## 범위 확인

이번 라운드(10R 커밋 `9a7b28764`)의 실제 diff는 다음으로 좁다: `.claude/_shared/git_probe.py`,
`.claude/hooks/_lib/branch_guard.py`, `.claude/hooks/_lib/plan_guard.py`,
`.claude/tests/test_plan_guard.py`, `.claude/tests/test_review_guard_hardening.py`,
`.github/workflows/harness-checks.yml`, `plan/in-progress/harness-review-gate-ci-backstop.md`.
프롬프트에 전체 컨텍스트로 실린 `review_guard.py`(1007줄, `Read`로 직접 확인)·
`test_review_gate_ci.py`(829줄, 절단분 포함 전체 확인)·`test_block_integrity.py`·
`test_stop_guard_failopen.py`·`test_workflow_yaml_structure.py`·`review-gate.yml`·
`check-review-gate.py`는 이번 라운드에 변경되지 않았으나(git diff로 확인), 동시성 판단 시
"reachable 코드" 범위로 함께 읽었다.

전체 대상에 `thread|lock|mutex|semaphore|async|await|fcntl|multiprocess` 정규식 grep을
돌려 실제 동시성 프리미티브(스레드/락/코루틴)가 전무함을 확인했다 — 이 서브시스템은 훅
프로세스마다 별도 파이썬 인터프리터로 동기 실행되는 git 서브프로세스 호출의 연쇄일 뿐이다.
`asyncio`/`threading`/`multiprocessing` import 없음.

## 발견사항

- **[INFO]** `git_probe.py`의 `_origin_default_branch` 위임 구조 변경은 기존에 있던
  (미해가 되는 수준의) check-then-act 패턴을 제거했다 — 신규 결함 아님, 개선 방향.
  - 위치: `.claude/_shared/git_probe.py:41-90` (`_origin_default_branch` 정의부), 대비
    대상은 `git show 9a7b28764 -- .claude/_shared/git_probe.py`에서 삭제된 구버전
    `_origin_default_branch`(`sys.modules.get("_git_probe_branch_guard")` 후
    `if mod is None: ... sys.modules[...] = mod; spec.loader.exec_module(mod)`).
  - 상세: 구버전은 `branch_guard.py`를 매 호출마다 `importlib`로 다시 로드하는 비용을
    피하려고 `sys.modules`에 모듈 객체를 캐싱했다. 이 캐싱은 "확인 후 기록"(check-then-act)
    이라 이론상 동시 스레드에서 이중 `exec_module` 호출이 가능한 형태였다(다만 이 코드베이스
    전체에 `threading`이 전혀 없어 실제로는 도달 불가 — 각 훅 호출은 독립 프로세스). 이번
    변경으로 `_origin_default_branch`가 `git_probe.py`에 직접 정의된 일반 함수가 되면서
    그 캐싱 자체가 사라졌다. `_default_branch`는 매 호출마다 `_origin_default_branch(cwd)`를
    직접 호출하고, 그 함수는 여전히 매번 `git remote`/`git symbolic-ref`/(필요시)
    `git remote show origin` 서브프로세스를 새로 실행한다 — caching이 모듈 로드 오버헤드에만
    있었지 git 조회 결과 자체를 캐싱한 적이 없었으므로, 이번 제거로 인한 동작 변화나 성능
    회귀는 없다(구버전도 매 호출 `resolver(cwd)`로 git을 다시 조회했다). `python3 -m
    unittest discover -s .claude/tests -p 'test_plan_guard.py'` 33건 GREEN으로 위임 경로가
    정상 동작함을 재확인했다.
  - 제안: 조치 불필요. 참고로만 기록.

- **[INFO]** GH Actions `concurrency:` 블록(두 워크플로 모두 `cancel-in-progress: true`)은
  표준 패턴대로 워크플로별로 다른 `group` 접두사(`review-gate-${{ github.ref }}` vs
  `harness-checks-${{ github.ref }}`)를 쓴다 — 두 워크플로가 서로의 실행을 취소시키는
  교차 오염이 없다. `review-gate.yml` 쪽은 `test_review_gate_ci.py::WorkflowWiringTest`가
  문서 전체 정확일치로 이 블록을 고정한다(`concurrency.group`/`cancel-in-progress` 값
  포함). 이번 라운드 diff는 `harness-checks.yml`에 `permissions: contents: read`만
  추가했고 `concurrency:` 블록 자체는 손대지 않았다(동시성 범위 밖 — 권한 축소이지 동시
  실행 축이 아님).
  - 위치: `.github/workflows/harness-checks.yml:66-68`(기존 블록, 미변경),
    `.github/workflows/review-gate.yml:36-38`(기존 블록, 미변경).
  - 상세: `cancel-in-progress: true`는 같은 PR/ref에 연속 push가 오면 이전 실행을 취소하는
    표준 동작이고, 이 저장소의 다른 워크플로들도 동일 패턴을 쓴다. 신규 결함 없음.

- **[INFO] (범위 밖, 이미 문서화된 결정 — 재상정 아님)** `review_guard.py`의 in-flight
  억제(`_code_review_in_flight`, `_resolution_in_flight`)와 `.claude/hooks/_lib/
  failopen_state.py`의 스트릭 카운터를 동시성 관점에서 직접 읽었다. 둘 다 이번 라운드
  diff에 없고, 각각 이미 스스로 결함 등급을 낮춰 문서화하고 있어 CRITICAL/WARNING으로
  재상정하지 않는다:
  - `failopen_state.report()`의 docstring이 "Known residual (accepted): the
    read-increment-write of the streak is not locked, so two overlapping runs can
    lose one increment... Not worth `fcntl.flock` for an observability counter."라고
    스스로 명시한다(`.claude/hooks/_lib/failopen_state.py:115-119`). lost-update가
    실재하지만 대상이 판정(blocked 여부)이 아니라 관측용 스트릭 카운터이고, 배너 출력이
    쓰기보다 먼저 일어나도록 순서화돼 있어(`report()` 121번째 줄 이후 흐름) 핵심 신호(배너)
    자체는 경쟁에 영향받지 않는다.
  - `_resolution_in_flight`의 마커 디렉터리(`mark_resolution_in_flight.py`/
    `clear_resolution_in_flight.py`)는 `tool_use_id`별로 별도 파일에 쓰고 지우므로
    병렬 sub-agent 디스패치 간 파일 단위 경쟁이 구조적으로 없다. `os.listdir` 이후
    `open()` 사이에 파일이 지워지는 TOCTOU는 `_marker_epoch`/`_mtime`이 `OSError`를
    흡수해 0.0으로 안전하게 폴백한다(크래시 없음, 해당 마커는 "없음"으로 처리).
  - `plan/in-progress/harness-review-gate-ci-backstop.md` 항목 10에 `_shared/retry_state.py`
    의 `_retry_state.json` read-modify-write 무잠금 문제가 별도로 등재돼 있으나, 이는
    리뷰 오케스트레이터의 세션 상태(`agents_fatal` 등)에 관한 것으로 이번 CI 백스톱/git
    프로브 통합과는 다른 서브시스템이고, 이번 diff에 포함되지 않았다. 해당 항목은 이미
    "이번 PR이 만든 결함이 아니다"로 스스로 기록돼 있어 재상정하지 않는다.

이번 라운드 diff(git_probe.py/branch_guard.py/plan_guard.py 위임 정리, 두 테스트 파일,
harness-checks.yml의 permissions 추가) 안에서는 공유 가변 상태·락·스레드·async 코드가
전혀 도입되지 않았고, 제거된 유일한 패턴(구버전 모듈 캐싱)도 동시성 리스크를 낮추는
방향이었다. CRITICAL/WARNING 수준의 신규 동시성 결함을 찾지 못했다.

## 요약

이번 라운드는 세 훅 모듈이 각자 손으로 복제하던 git 프로브 6개를 `_shared/git_probe.py`로
완전히 통합하고, 그 통합이 유지되는지를 손으로 쓴 목록 대신 AST 비교로 도출하는 리팩터링이다.
변경된 코드 전부가 동기적 `subprocess.run` 기반 git 조회이며 스레드·락·async 프리미티브를
전혀 쓰지 않고, 각 훅 실행이 독립 프로세스라 프로세스 내부 경쟁 조건이 성립할 여지가 없다.
유일하게 제거된 패턴(구버전 `_origin_default_branch`의 `sys.modules` 캐싱)은 이론적으로도
약한 check-then-act였고 이번 삭제로 그마저 사라졌다. GH Actions `concurrency:` 그룹은
워크플로별로 올바르게 스코프돼 있고 정확일치 테스트로 고정돼 있다. 더 넓은 reachable
코드(`review_guard.py`의 in-flight 억제, `failopen_state.py`의 스트릭 카운터)에서 실재하는
lost-update 하나를 확인했지만, 이는 이번 diff 밖의 기존 코드이고 그 자신의 docstring이
"accepted, not worth fcntl.flock"이라고 근거와 함께 이미 하향해 둔 관측용 카운터에 국한돼
있어 판정 자체(blocked/allowed)에는 영향이 없다 — 재상정하지 않는다.

## 위험도

NONE
