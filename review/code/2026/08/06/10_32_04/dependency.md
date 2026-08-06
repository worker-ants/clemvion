# 의존성(Dependency) Review

## 실증 실험 요약 (YOUR JOB에 대한 답)

**질문**: 모든 테스트가 GREEN 인 채로 SHIPPED BEHAVIOUR 를 바꿀 수 있는가?
**답**: 조건부로 그렇다 — `PyYAML` 이라는 **단일 옵션 의존성의 부재**를 통해, `review-gate.yml`
의 배선(3R/4R 에서 겨우 봉인한 바로 그 구멍들)을 **다시 뚫어도 검출되지 않는 실행 조건**을
재현했다. 아래는 실행한 정확한 명령과 출력이다. 작업은 전부
`mktemp -d` 격리 디렉터리(`/private/tmp/.../scratchpad/depcheck`)에서 수행했고, 실제 저장소는
건드리지 않았다 — 종료 직전 `git status --porcelain` 로 확인(변경 없음, 세션 산출물 디렉터리
`review/code/2026/08/06/` 만 untracked 로 남음).

### 1단계 — 격리 venv 준비 (PyYAML 부재 시뮬레이션)

```
$ python3 -m venv $SCRATCH/venv
$ $SCRATCH/venv/bin/python3 -c "import yaml"
ModuleNotFoundError: No module named 'yaml'
```

### 2단계 — 저장소 스냅샷 (git archive, read-only)

```
$ cd <repo>; git archive HEAD | tar -x -C $SCRATCH/repo
```

### 3단계 — 회귀 재현: `continue-on-error: true` 를 `review-gate.yml` 사본에 재삽입

(4R 커밋 `864b71a7b` 가 정확히 이 키를 막았던 그 자리 — `Review coverage backstop` step.)

```python
needle = "      - name: Review coverage backstop\n        run: python3 scripts/check-review-gate.py\n"
replacement = "      - name: Review coverage backstop\n        continue-on-error: true\n        run: python3 scripts/check-review-gate.py\n"
```

### 4단계 — 대조군: PyYAML **있는** 상태(시스템 python3, yaml 6.0.3)로 같은 파일만 실행

```
$ cd $SCRATCH/repo_mut
$ python3 -m unittest discover -s .claude/tests -p 'test_review_gate_ci.py'
..............F...
FAIL: test_the_gate_step_cannot_be_skipped_or_have_its_failure_swallowed
AssertionError: 'continue-on-error' unexpectedly found in
  {'name': 'Review coverage backstop', 'continue-on-error': True, 'run': '...'}
Ran 18 tests in 2.291s
FAILED (failures=1)
```

의도대로 잡힌다 — 4R 가드가 살아있음을 확인(대조군).

### 5단계 — 실험군: **같은 변조**, PyYAML **없는** venv 로 **같은 명령**

```
$ $SCRATCH/venv/bin/python3 -m unittest discover -s .claude/tests -p 'test_review_gate_ci.py' -v
...
setUpClass (test_review_gate_ci.WorkflowWiringTest) ... skipped 'PyYAML 없음 — CI 는 설치한다'
Ran 11 tests in 2.309s
OK (skipped=1)
```

**exit 0, "OK".** `WorkflowWiringTest` 의 7개 메서드(`test_the_gate_step_runs_exactly_the_expected_command`,
`…cannot_be_skipped_or_have_its_failure_swallowed`, `…job_condition_is_exactly…`,
`…checkout_before_the_gate…`, `…trigger_paths_are_exactly…`, `…concurrency_is_pinned`,
`…still_observation_only`) 는 `setUpClass` 가 `unittest.SkipTest` 를 던지는 순간 **한 덩어리로
전부 스킵**된다 — 3R·4R 가 봉인한 배선 불변식 전부(`if:` 정확일치, `continue-on-error`/
`timeout-minutes` 부재, `paths:` 정확일치, `concurrency` 정확일치, gate 명령 정확일치)가 동시에
무력화되는데, 결과는 실패가 아니라 **`OK`** 다.

### 6단계 — "전체 스위트는 여전히 안전한가"도 실측 (정직한 반증)

문서화된 실제 CI/README 명령(`python3 -m unittest discover -s .claude/tests -p 'test_*.py'`)을
같은 PyYAML-부재 venv 로 전체 실행하면:

```
Ran 814 tests in 57.984s
FAILED (failures=21, errors=22, skipped=5)
$ echo $?  # 실제 프로세스 종료 코드(파이프 아님, 직접 캡처)
1
```

**즉 전체 스위트 명령으로는 이 우회가 성립하지 않는다.** `scripts/check-override-floors.py`
(`test_override_floors.py` 가 구동)가 `import yaml` 을 `try/except ImportError: sys.exit(2)` 로
감싸 **의도적으로** fail-closed 하고, 그 exit(2) 가 여러 테스트의 특정 출력-형태 단언과 어긋나
대량 실패를 낸다 — 이것이 오늘 전체 스위트를 RED 로 유지하는 **유일한** 안전망이다.
`test_workflow_yaml_structure.py` 도 `import yaml` 을 가드 없이 최상단에 두어 모듈 로드 자체가
실패(ERROR)한다. 이 두 파일은 결과적으로(그러나 **의도적으로 문서화되지 않은 채**) `PyYAML`
부재를 fail-loud 로 만든다.

**`test_review_gate_ci.py::WorkflowWiringTest` 만 다르다** — 유일하게 `try: import yaml except
ImportError: raise unittest.SkipTest(...)` 로 **fail-open**(무음 스킵)을 택했다. 오늘 전체
스위트가 안전한 건 이 파일의 설계 덕이 아니라, **무관한 옆 파일의 우연한 부작용** 덕이다.

## 발견사항

- **[CRITICAL]** `WorkflowWiringTest` 의 안전성이 우연한 곁다리 실패(`test_override_floors.py`)에
  전적으로 기대어 있다 — 자신의 방어선이 없다
  - 위치: `.claude/tests/test_review_gate_ci.py:394` (`setUpClass`, `except ImportError: raise
    unittest.SkipTest("PyYAML 없음 — CI 는 설치한다")`)
  - 상세: 이 파일의 docstring(494행 부근, `VerdictComesFromTheGateTest` 클래스 설명)과 CLASS
    docstring(361~373행, `WorkflowWiringTest`)은 명시적으로 "패턴 매칭은 세 번 뚫렸고, 이번엔
    기대값 전체를 정확 일치로 고정해 우회할 패턴이 아예 없다" 고 선언한다. 그런데 이 정확 일치
    검증 전체가 **하나의 옵션 pip 패키지 부재**로 조건 없이 스킵되도록 설계돼 있다. 위 5단계에서
    실증했듯, 이 파일만 단독 실행(타겟 재실행)하는 환경에 PyYAML 이 없으면 4R 가 막은
    `continue-on-error: true` 재삽입을 포함해 **7개 배선 불변식 전부**가 `OK` 로 통과한다. 이는
    이 라운드가 막으려던 것과 **정확히 같은 모양의 결함**을 한 계층 위(스크립트의 판정자가
    아니라, 그 판정자를 검증하는 테스트의 실행 여부)에서 재현한 것이다. 오늘은 우연히 옆 파일이
    막아주지만: (a) 그 옆 파일의 fail-closed 는 이 파일을 위해 설계된 게 아니라 자기 자신의
    관심사이고 문서화된 결합이 아니다, (b) 이 저장소는 타겟 재실행이 실제 관행이다(리뷰 게이트
    피드백에 "실패 reviewer 는 `REVIEW_AGENTS=a,b` 로 그 2명만" 이라는 패턴이 기록돼 있다 —
    같은 정신의 "이 파일만 재실행"은 CI 스크립트 분리나 로컬 디버깅에서 충분히 일어난다),
    (c) `test_override_floors.py` 가 언젠가 (선의로) 같은 skip 패턴을 채택하면 — 실제로 이
    저장소가 "PyYAML 없으면 조용히 넘어가자" 는 편의적 리팩터를 할 유인이 있다 — 전체 스위트도
    함께 무력화된다.
  - 제안: `WorkflowWiringTest.setUpClass` 를 스킵이 아니라 **fail-closed** 로 바꾼다.
    `scripts/check-override-floors.py` 가 이미 채택한 패턴(`except ImportError: sys.exit(2)`
    상당)을 그대로 따라 `self.fail("PyYAML 필요 — 배선 검증을 건너뛸 수 없다")` 또는 무조건
    `import yaml` (가드 없이, `test_workflow_yaml_structure.py` 와 동일)로 바꾸면, 부재 시
    이 클래스 자체가 **ERROR** 로 떨어져 스위트 전체가 RED 가 된다 — 다른 파일의 운에 기대지
    않는 자체 방어선이 생긴다. `raise unittest.SkipTest(...)` 로 "CI 는 설치한다" 고 낙관하는
    현재 주석은, 이 라운드가 반증하려던 바로 그 낙관이다.

- **[WARNING]** `pyyaml` 버전 고정 문자열이 3곳에 손으로 중복돼 있고 이를 묶는 테스트가 없다
  - 위치: `.github/workflows/harness-checks.yml:85` (`pip install "pyyaml>=6,<7"`) — 나머지 2곳은
    이번 diff 밖의 `.github/workflows/deps-security-checks.yml:58,92` (동일 리터럴)
  - 상세: `.claude/tests/README.md:68`(게이트 숫자 68) 이 "CI installs it (…), the same pin
    `deps-security-checks.yml` already uses" 라고 **재사용**을 근거로 든다. 그런데 그 재사용은
    사람이 문자열을 손으로 맞춘 것이지, 어느 테스트도 두 워크플로의 pin 문자열이 실제로 같은지
    비교하지 않는다. 이 저장소는 바로 이런 "아무것도 묶지 않는 손-동기 쌍" 이 실제로 드리프트한
    전례를 스스로 여러 번 기록해 두었다(`test_e2e_exemption_paths_sync.py` 의 존재 이유,
    `test_router_safety_policy_doc.py` 의 24 vs 44 drift 등, 둘 다 이 README 안에 있다). 오늘은
    3곳이 일치하지만, 한쪽만 버전을 올리면(예: PyYAML 7 대응) 조용히 갈라진다 — 결과는 즉시
    에러(`import yaml` 실패 없음, 그냥 다른 마이너 버전)라 티가 안 날 가능성이 높다.
  - 제안: 최소한 harness 자체 테스트에 "두 워크플로 파일의 `pyyaml` pin 문자열이 동일하다" 는
    한 줄짜리 정확 일치 어서션을 추가하거나(이 저장소가 선호하는 패턴), 더 근본적으로는
    `requirements-dev.txt`/`constraints.txt` 하나로 단일 진실화해 두 워크플로가 같은 파일을
    읽게 한다. 후자는 "hooks 는 zero third-party" 컨벤션을 깨지 않는다 — 설치는 CI/개발자
    셸에서 하는 것이지 hook 프로세스가 import 하는 게 아니다.

- **[INFO]** `harness-checks.yml` 은 "PyYAML 설치 → 테스트 실행" 순서 자체를 구조적으로 고정하지
  않는다
  - 위치: `.github/workflows/harness-checks.yml:84` (`Install PyYAML`) 와 `:87` (`Run harness
    unit tests`) — 두 step 사이의 순서
  - 상세: 이 워크플로 파일 자체에는(이번 diff 대상 8개 파일 범위 안에서) 두 step 의 상대
    순서를 정확 일치로 고정하는 `WorkflowWiringTest` 류 테스트가 없다(그런 테스트가 있는 건
    `review-gate.yml` 뿐이다). 순서가 뒤바뀌면 `import yaml` 이 실패하는데, 이는 위에서 확인한
    대로 `test_override_floors.py`/`test_workflow_yaml_structure.py` 를 통해 이미 fail-loud
    하므로 위험도는 낮다(그 자체로 CRITICAL 발견의 완화 근거는 아니다 — 순서 파괴는 스위트
    전체를 정지시키지, `review-gate.yml` 배선을 조용히 통과시키지 않는다). 참고용으로만 기록.
  - 제안: 없음(위 CRITICAL 항목의 해결이 이 항목도 사실상 흡수한다).

- **[INFO — 정상 확인]** 새 의존성 없음, 내부 의존 방향 건전
  - `scripts/check-review-gate.py` 는 `.claude/hooks/_lib/review_guard.py` 를 **재사용**한다
    (새 구현을 만들지 않음 — `report_paths`/`retry_state` drift 를 두 번 겪은 뒤의 명시적
    설계 결정, 파일 docstring 15~19행에 근거 기록). `review_guard.py` 자신과 그것이 import 하는
    `_shared/report_paths.py`, `_shared/block_integrity.py` 는 전부 표준 라이브러리만 사용함을
    직접 확인했다(`grep '^import\|^from'` 결과: `json/os/re/subprocess/sys/time/dataclasses/
    datetime` 뿐). `sys.path.insert(0, lib)` 로 `.claude/hooks/_lib` 를 **맨 앞**에 꽂아 셰도잉
    위험(동명의 전역 패키지가 먼저 잡히는 것)도 없다. `PyYAML` 자체는 MIT 라이선스로 프로젝트와
    호환되고, `>=6,<7` 핀은 `yaml.load` 의 임의 코드 실행 CVE 를 유발하는 구버전/`Loader` 미지정
    패턴과 무관(어느 소비 코드도 `safe_load` 이외의 API 를 쓰지 않음, 이번 diff 범위에서 직접
    `yaml.*` 를 호출하는 파일은 없고 `WorkflowWiringTest` 만 `yaml.safe_load` 사용 — 494행
    부근). 신규 npm/pnpm 패키지·번들 크기·빌드 시간에 영향 없음(파이썬/YAML 워크플로 전용).

## 요약

이번 diff 는 새 외부 의존성을 추가하지 않고 기존 `PyYAML` pin(`>=6,<7`)을 재사용하며, 그 pin
자체의 버전 고정·라이선스·취약점·내부 의존 방향은 전부 건전하다. 그러나 이번 diff 가 새로
도입한 `WorkflowWiringTest`(review-gate.yml 배선의 정확 일치 검증 — 이 저장소가 3라운드에 걸쳐
어렵게 도달한 방어)는 **그 검증 자체의 실행 여부를 단일 옵션 의존성(PyYAML)의 존재에 fail-open
(SkipTest)으로 결부**시켜 두었다. 실측 결과, 이 파일만 단독으로(타겟 재실행) PyYAML 부재
환경에서 돌리면 4R 이 막 봉인한 `continue-on-error: true` 재삽입을 포함해 배선 불변식 7개가
전부 무음 통과(`OK`)한다 — 전체 문서화된 CI 명령(`unittest discover … 'test_*.py'`)에서는
무관한 옆 파일(`test_override_floors.py`)의 **의도된** fail-closed 덕에 우연히 막히지만, 그
결합은 어디에도 문서화·테스트되어 있지 않아 다음 리팩터에서 조용히 사라질 수 있는 우연이다.
이는 이 라운드가 명시적으로 없애려던 "숨은 우회 표면" 을 스크립트 계층에서 테스트-실행-조건
계층으로 옮겨 놓은 것과 같다. 부수적으로 `pyyaml` 버전 pin 문자열이 두 워크플로 파일 3곳에
검증 없이 손-동기화돼 있다.

## 위험도

CRITICAL
