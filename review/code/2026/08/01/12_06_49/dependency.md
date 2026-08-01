# 의존성(Dependency) Review

## 실측 요약 (먼저)

`OneJudgeTest`("판정 로직은 스크립트에 없다")가 주장하는 성질을 실측으로 검증했다. 주장:
"`scripts/check-review-gate.py` 는 import/호출 허용목록으로 판정되며, 게이트(`review_guard`)에
위임하는 것 말고 자체 판단 연산(tree walk, 파일 open, `re`/`glob`/`subprocess` 등)을 하지 않는다."

**결과: 성질을 FALSE로 만드는 프로그램을 만들었고, 해당 테스트는 GREEN으로 남았다.**

실행 내용 (작업 트리는 건드리지 않고 scratch 사본에서 수행 — 아래 커맨드 참조):

1. `.claude/tests/_harness.py` + `.claude/tests/test_review_gate_ci.py` + `scripts/check-review-gate.py`
   만 별도 임시 디렉터리(`$SCRATCH/depcheck`)에 동일한 상대 경로로 복사.
2. `check-review-gate.py`의 `_ROOT_DEFAULT = os.path.dirname(...)` 줄 바로 앞에 한 줄 삽입:
   ```python
   os.path.dirname = os.walk  # 원래 os.walk 를 os.path.dirname 이름으로 재바인딩
   ```
3. `python3 -m unittest test_review_gate_ci.OneJudgeTest -v` 실행 결과:
   ```
   test_the_script_performs_no_judgement_operations_of_its_own ... ok
   Ran 1 test in 0.001s
   OK
   ```
   → 가드가 막으려는 "tree walk 연산"이 스크립트에 실제로 심겼는데도 GREEN.
4. 성질이 진짜로 깨졌는지 sanity check (`python3 scripts/check-review-gate.py --root <copy>`):
   ```
   TypeError: expected str, bytes or os.PathLike object, not generator
   ```
   → `os.path.dirname`이 실제로 `os.walk`를 가리키게 됐음을 확인(런타임에서 즉시 터짐).
5. 크래시 없이 같은 우회를 재현하기 위해 두 번째 사본(`$SCRATCH/depcheck2`)에서 대상을 바꿔
   (`_load_gate` 내부에서만 쓰이는) `os.path.join = os.walk`로 삽입:
   - `OneJudgeTest` → 다시 `ok` (GREEN).
   - 스크립트를 `--root <copy>`로 실행하면 크래시하지 않고 `review-gate: 게이트를 불러오지
     못했습니다 (ModuleNotFoundError: No module named 'review_guard')`를 찍고 **exit 0**로
     종료 — 정상적인 fail-open 케이스와 출력 모양이 구분되지 않는다.

**왜 통했는가 (정확한 진단).** `OneJudgeTest`는 두 종류의 AST 노드만 본다: (a) `Import`/
`ImportFrom` (허용된 import 집합과 대조), (b) `Call.func`를 점(dot) 표기로 풀어 허용된 호출
이름과 대조. `module.attr = other_object` 형태의 **Attribute를 타깃으로 하는 대입**은 둘
중 어디에도 걸리지 않는다 — import 문이 아니고, 우변의 `os.walk`도 `Call`로 감싸여 있지
않은 단순 값 참조이기 때문이다. 그 결과 이후 소스에 이미 존재하는, 텍스트상 허용된 호출
(`os.path.dirname(...)`, `os.path.join(...)`)이 **런타임에는 재바인딩된 임의 함수를 실제로
실행**하게 되는데, 정적 검사는 이름의 텍스트만 보고 통과시킨다.

대조로 확인한 것 — 이 가드가 실제로 잡는 경우: 같은 우회를 **bare name**(`print = ...`,
`os = ...` 같은 단일 `Name` 타깃)에 시도하면 `alias_of` 추적 로직이 정확히 잡아 RED가 된다
(코드 내 `for node in ast.walk(tree): if (isinstance(node, ast.Assign) and len(node.targets)==1
and isinstance(node.targets[0], ast.Name)): ...` 블록). **구멍은 정확히 `Attribute` 타깃
대입 한 종류로 국한된다.**

**정직한 한계 표시.** 두 변형 모두 같은 파일의 자매 클래스 `ReviewGateCliTest`(subprocess로
스크립트를 실제 실행하는 테스트들)는 대부분 같이 깨질 가능성이 높다 — 첫 변형은 즉시
크래시, 두 번째 변형은 `_load_gate`가 항상 fail-open으로 빠져 "통과"/"미커버" 문구를
기대하는 단언들이 못 만족될 것이다. 즉 **`OneJudgeTest` 하나만 보면 GREEN**이지만, 파일
전체를 `python3 -m unittest test_review_gate_ci` 로 통째 돌리면 다른 테스트가 우연히
연쇄적으로 잡아낼 개연성이 있다 — 이는 이 가드 자체의 설계가 잡은 것이 아니라, 다른
목적의 테스트가 부수적으로 걸린 것이다. `--enforce` 모드가 아직 꺼져 있는 채로 CI에 실린
데다, 공격자가 재바인딩 지점을 더 신중히 골라 다른 단언까지 우연히 안 건드리게 하면(예:
호출되지 않는 이름을 재바인딩하거나 원본을 저장해 뒀다가 필요한 순간만 위임) 전체 스위트를
안 건드리고 지나갈 여지도 있다 — 그 정도까지는 실증하지 않았다(수확체감 판단, 시간 배분).

## 발견사항

- **[WARNING]** `OneJudgeTest`의 import+호출 허용목록이 "Attribute 타깃 대입"류 재바인딩을
  놓친다 — `module.attr = 다른_객체` 형태는 판정 로직 어디에도 걸리지 않는다.
  - 위치: `.claude/tests/test_review_gate_ci.py:253` (`test_the_script_performs_no_judgement_operations_of_its_own`, 클래스 `OneJudgeTest`, 라인 220부터) — 특히 대입-별칭 추적 블록 `.claude/tests/test_review_gate_ci.py:288-293` (Name 타깃만 추적, Attribute 타깃은 건너뜀)과 Call 검사 블록 `:295-311`.
  - 상세: 이 가드는 자신의 docstring(`test_review_gate_ci.py:254-268`)에 "네 번 뚫렸다"고
    스스로 기록한 방어선이다(전체 grep → prose 제외 grep → 연산 금지목록 → import+호출
    허용목록). 이번 실측이 다섯 번째 우회다. 근본 원인은 매번 같다 — "상상한 우회만 막는다"는
    것. 이 가드의 목적은 "판정 로직 재구현/은닉 의존성 도입 방지"(`review_guard` 하나에만
    위임)라는 **의존성 거버넌스 그 자체**이므로 Dependency 리뷰 범위에 정확히 든다.
  - 제안: `ast.Assign`/`ast.AugAssign`에서 타깃이 `ast.Attribute`인 경우를 전부 무조건 위반으로
    처리한다(이 22줄짜리 스크립트는 어떤 모듈 속성에도 대입할 정당한 이유가 없다 — "인자를
    읽고, 게이트를 부르고, 출력한다"는 스스로의 선언과 일치). 화이트리스트를 늘리는 대신
    "이 스크립트가 할 수 있는 일의 형태"를 좁히는 이번 가드의 철학을 대입에도 그대로 적용하면
    이 클래스 전체가 닫힌다.

- **[INFO]** 새 의존성(PyYAML) 도입 자체는 건전하다 — 별도 결함 아님, 확인 결과만 기록.
  - 위치: `.github/workflows/harness-checks.yml:84-85` (`pip install "pyyaml>=6,<7"`), `.claude/tests/README.md:19-31`, `.claude/tests/test_review_gate_ci.py:344-353`.
  - 상세: (1) 신규 외부 패키지가 맞지만 **완전히 신규는 아니다** — `deps-security-checks.yml`이 이미 쓰던 정확히 같은 핀(`pyyaml>=6,<7`)을 재사용해 3개 워크플로에서 동일 버전 범위로 수렴돼 있다(불일치 없음). (2) 라이선스: PyYAML은 MIT — 프로젝트와 호환. (3) 취약점: 저장소 내 모든 PyYAML 사용처를 grep했고(`.claude/tests/test_workflow_yaml_structure.py`, `test_review_gate_ci.py`, `scripts/check-override-floors.py`, `scripts/check-pnpm-security-config.py`) 전부 `yaml.safe_load` 또는 `yaml.SafeLoader`의 서브클래스만 쓴다 — 신뢰 못 할 입력에 대한 `yaml.load(Loader=yaml.Loader)` 같은 위험한 사용은 없다. (4) 불필요 여부: 중복 키 검출은 stdlib `yaml` 파서가 없고(`safe_load`는 충돌을 조용히 버림) 손으로 파서를 새로 짜면 "그 파서 자체의 정확성"이 새 리스크가 된다는 논거가 README/워크플로 주석에 근거로 남아 있다(합리적). (5) 크기/빌드시간: CI 전용 설치 1스텝, 상용 코드/번들에는 영향 없음 — `scripts/check-review-gate.py`의 `_ALLOWED_IMPORTS`(`test_review_gate_ci.py:224`)에도 `yaml`이 없어, 게이트 판정 스크립트 자체는 PyYAML에 의존하지 않는다(테스트만 의존). (6) 호환성: pip 버전 범위 지정만 있고 lock 파일 개념은 없지만, 테스트 전용·CI 한정 사용이라 재현성 리스크는 낮다.

- **[INFO]** `.github/workflows/harness-checks.yml`의 stale 주석 — 버전 정책 문서화가 실제
  핀과 어긋난다(이번 라운드 diff 대상 아님, 기존 상태).
  - 위치: `.github/workflows/harness-checks.yml:75` (주석), `:76` (`actions/setup-python@v7`).
  - 상세: 주석은 "actions major policy consistent with the other workflows (v5/v6 line)"이라
    적혀 있으나, 실제 핀은 `@v7`이고 저장소의 **모든** 워크플로(`checkout`/`setup-python`/
    `setup-node`, e2e/frontend/packages/spec-link/web-chat/migration/deps-security 전부)가
    이미 `@v7`로 통일돼 있다(`grep -rn "uses: actions/" .github/workflows/*.yml` 로 확인,
    예외는 `actions/cache@v6` 하나뿐이고 그건 별도 액션이라 무관). 즉 주석이 가리키는
    "v5/v6 line"은 이제 존재하지 않는 과거 상태를 서술한다 — `git diff origin/main --
    .github/workflows/harness-checks.yml` 로 확인한 결과 이번 PR이 건드린 줄이 아니라
    선재하던 drift다.
  - 제안: 이 저장소는 정책 문서와 실제 핀의 불일치를 반복적으로 심각하게 다뤄 온 전례가
    있다(`test_router_safety_policy_doc.py` 등, README §관행). 사소하지만 다음에 이 파일을
    편집할 때 "v5/v6 line" 문구를 실제 정책(v7)로 정정할 것을 권한다. 차단 사유 아님.

- **[INFO]** `test_review_gate_ci.py`의 `OneJudgeTest._ALLOWED_IMPORTS`가 동일한 값으로 두 번
  선언돼 있다(복붙 잔재, 죽은 코드).
  - 위치: `.claude/tests/test_review_gate_ci.py:224`, `:227` (완전히 동일한 `_ALLOWED_IMPORTS = {...}` 두 줄, 사이에 같은 주석도 중복).
  - 상세: 기능상 무해(두 번째 대입이 첫 번째를 덮어쓸 뿐)하지만 허용목록 정의가 "짧고
    안정적"이라는 이 클래스의 자기 서술과 어긋나는 사소한 위생 문제. 의존성 리뷰 범위 밖에
    가까우나 허용목록 유지보수성과 맞닿아 있어 기록.
  - 제안: 중복 블록 하나 제거.

- **[INFO]** 내부 의존성(axis 8) — "origin 기본 브랜치 해석"이 4곳에 독립 구현돼 있는 상태는
  이미 알려져 있고 이번 PR 범위가 아니다.
  - 위치: `plan/in-progress/harness-review-gate-ci-backstop.md:137-143` (§신규 후속 defer).
  - 상세: `branch_guard._origin_default_branch()`(정본) / `review_guard._default_branch()` /
    `code_review_orchestrator._default_branch_ref()`(이번에 신설된 코드지만 이 8개 파일
    번들에는 포함되지 않음) / `consistency_orchestrator`의 리터럴 — 반환 계약이 달라 단순
    통합 불가하고 `_lib` 네임스페이스 충돌 해소가 선행돼야 한다고 plan 자체가 명시적으로
    defer 처리했다. 새로 발견한 문제가 아니라 이미 추적 중인 부채이므로 재상정하지 않음
    — 완결성을 위해 기록만.

## 요약

핵심 실측 결과 하나: 이 PR이 도입한 CI 백스톱의 "판정자는 하나" 불변식을 지키는
`OneJudgeTest`(허용된 import/호출만 쓴다는 4차 방어선)를, `module.attr = 다른_객체` 형태의
Attribute-타깃 재바인딩으로 성질을 깨뜨리면서도 GREEN으로 통과시켰다(두 가지 변형 모두 재현,
명령/출력 기록됨). 이는 "상상한 만큼만 강한 금지/허용목록"이라는 이 가드 자신의 교훈이
다섯 번째로 재확인된 사례이며, 수정 제안은 구체적이다(Attribute 타깃 대입 전체를 무조건
위반으로 판정). 그 외 이번 PR이 실제로 들여온 유일한 신규 외부 의존성인 PyYAML은 라이선스·
안전한 API 사용(`safe_load`/`SafeLoader`만)·버전 핀 재사용·게이트 스크립트 자체의 무의존성
유지라는 네 축 모두 건전하게 처리됐다. 나머지는 이번 diff 범위 밖의 선재 drift(액션 버전
주석)이거나 이미 문서화된 defer 항목으로, 차단 사유가 되는 발견은 없다.

## 위험도

LOW
