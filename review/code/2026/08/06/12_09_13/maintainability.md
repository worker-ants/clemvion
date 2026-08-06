# 유지보수성(Maintainability) Review

## 발견사항

- **[WARNING]** `WorkflowStructureTest` 클래스가 이름이 약속하는 범위(YAML 구조 유효성)를 벗어나 8개의 이질적 불변식을 떠안았다
  - 위치: `.claude/tests/test_workflow_yaml_structure.py:91` (클래스 선언), 메서드는 `:98, :110, :139, :204, :223, :259, :281, :306`
  - 상세: 이 클래스는 원래(선행 커밋 `a441e7f76`) "중복 키 없음" · "step 은 run/uses 하나만" 두 가지 순수 YAML 구조 검사만 가졌다. 이번 라운드가 같은 클래스에 `continue-on-error` 전역 금지, job/step `if:` 등재제, `pull_request` 키 집합 등재제, 워크플로 identity 유일성, 스위트 호출 명령 커버리지까지 **6개 메서드·약 200줄**을 이어붙여 클래스가 91~322행(≈230줄)으로 늘었다. 뒤에 추가된 성질들은 "구조 유효성"이 아니라 "게이트가 조용히 꺼지지 않는가"라는 다른 관심사이고, 이 파일의 자매 클래스 `DetectorTest`처럼 이미 관심사별로 클래스를 분리하는 관행이 이 파일 안에도 있다. 클래스 이름과 실제 내용이 어긋나면, 다음에 이 클래스를 여는 사람이 "구조 검사만 있겠지" 라는 잘못된 기대로 새 게이트-무결성 검사를 엉뚱한 파일에 새로 만들 위험이 있다.
  - 제안: 게이트-무결성 계열 6개 메서드(`_MAY_SWALLOW` 이하)를 `WorkflowGateIntegrityTest` 같은 별도 클래스로 분리하고, `WorkflowStructureTest`는 원래 두 메서드(중복 키·run/uses)만 남긴다.

- **[WARNING]** `OneJudgeTest.test_the_import_and_call_surface_stays_small` 한 메서드가 서로 다른 6가지 정적 검사를 모두 수행한다
  - 위치: `.claude/tests/test_review_gate_ci.py:265`(메서드 시작)~`:378`(끝), 약 115줄
  - 상세: 한 테스트 메서드 안에서 (1) import 허용 목록 검사, (2) 지역 별칭 정본화, (3) 호출 허용 목록 검사, (4) `getattr`를 통한 모듈 속성 추출 금지, (5) 속성 대입(재바인딩) 금지, (6) `os.environ`/`from os import environ as _E` 접근 금지, (7) `evaluate_review` import 여부 확인까지 순차 수행한다. `ast.walk(tree)` 루프가 6번 반복되고 각각 다른 노드 타입·다른 실패 메시지를 낸다. 이 파일의 다른 클래스들(`WorkflowWiringTest`, `VerdictComesFromTheGateTest` 등)은 성질 하나당 메서드 하나를 쓰는 관행을 따르는데, 이 메서드만 예외적으로 한 함수에 6개 성질을 누적시켜 놓았다. 하나가 실패하면 `unittest`의 첫 실패 지점에서 멈추므로, 같은 실행에서 다른 5개 성질 중 무엇이 살아있는지 알 수 없고(예: import 검사가 막 실패한 커밋이 env-접근 회귀도 함께 갖고 있어도 후자는 드러나지 않는다), 실패 시 트레이스백의 메서드 이름(`test_the_import_and_call_surface_stays_small`)만으로는 정확히 어떤 성질이 깨졌는지 즉시 알 수 없다.
  - 제안: `test_import_surface_is_registered` / `test_call_surface_is_registered` / `test_getattr_cannot_extract_a_module_attribute` / `test_no_attribute_reassignment` / `test_no_environment_access` 등으로 분리. `tree = ast.parse(...)`는 `setUp`으로 올리면 중복 파싱 비용도 없다.

- **[WARNING]** "등재된 집합이 stale 하지 않은지" 검증하는 동일 관용구가 5곳에 손으로 반복돼 있다
  - 위치: `.claude/tests/test_workflow_yaml_structure.py:180`(`_MAY_SWALLOW - seen_exceptions`), `:220`(`_JOB_CONDITIONS`), `:242`(`_STEP_CONDITIONS`), `:278`(`_PULL_REQUEST_KEYS`); `.claude/tests/test_review_gate_ci.py:639`(`_ALLOWED - seen`)
  - 상세: 다섯 곳 모두 "레지스트리 순회 → 실제로 마주친 키를 `seen`에 적립 → `assertIn(key, REGISTRY, ...)`로 미등재 항목 차단 → 끝에 `assertEqual(REGISTRY.keys() - seen, set(), "...더 이상 존재하지 않는 항목이 남아 있다")`로 죽은 항목 차단" 이라는 같은 3단 패턴을 각자 손으로 재구현했다. 이 저장소 자신이 "손-동기 쌍은 드리프트한다"는 교훈을 이미 여러 번 문서화했는데(예: `report_paths`/`retry_state`), 이 5개 인스턴스도 손으로 유지되는 동일 로직이라 같은 위험군이다 — 여섯 번째 레지스트리가 새로 생기면 이 관용구를 다시 손으로 베낄 공산이 크고, 그 과정에서 메시지 문구나 비교 방향(`REGISTRY.keys() - seen` vs `seen - REGISTRY.keys()`)이 미묘하게 틀릴 여지가 생긴다.
  - 제안: `_harness.py` 또는 로컬 mixin에 `assert_registry_is_current(self, registry: set|dict, seen: set, label: str)` 같은 공유 헬퍼를 두고 5곳 모두 위임하게 한다. 로직 자체는 이미 올바르게 동작하므로 기능 변경이 아니라 순수 리팩터링.

- **[INFO]** `README.md`에 새로 추가된 표 행이 6개 이상의 서로 다른 성질을 줄바꿈 없는 단일 문단에 압축해, 스캔하기 어렵다
  - 위치: `.claude/tests/README.md:48`
  - 상세: `test_review_gate_ci.py` 행 하나가 "판정자 단일성 / 관측 모드 / fail-open / advisory 무조건 출력 / 워크플로 문서 전체 고정 / 행위 테스트" 6개 절을 굵게 표시된 인라인 레이블만으로 구분한 채 한 문단(공백 제외 약 1,900자)에 담았다. 같은 파일의 다른 행들(`test_override_floors.py` 등)도 밀도가 높은 편이라 이 스타일 자체는 이 저장소의 기존 관행과 일관되지만(8. 일관성 기준으로는 위반이 아님), 표라는 형식 안에서 셀 하나가 이 정도 길이가 되면 표 본연의 스캔 가능성이 떨어진다.
  - 제안: 급하지 않음 — 기존 관행과의 일관성을 우선하되, 다음에 이 행을 손댈 때는 문장 사이에 `<br>`나 세미콜론 대신 명시적 줄바꿈을 넣는 것을 고려.

- **[INFO]** 새로 추가된 클래스 앞에 이 파일의 나머지 클래스들과 다르게 빈 줄이 1개뿐이다
  - 위치: `.claude/tests/test_review_gate_ci.py:583~584` (`class TheGateItselfDoesNotBranchOnCiEnvTest` 앞)
  - 상세: 같은 파일의 다른 모든 top-level 클래스(40, 220, 380, 498, 643, 700행)는 앞에 빈 줄 2개(PEP8 표준, `black`/`flake8` 기본값과 일치)를 두는데, 이번에 추가된 이 클래스만 1개다. 사소하지만 이 저장소의 다른 harness 테스트 파일 전반이 지키는 스타일 컨벤션에서 벗어난 지점이고, `test_review_gate_ci.py` 안에서도 스스로 어긋난다.
  - 제안: 빈 줄 하나 추가. (부수적으로 `.claude/tests/test_review_gate_ci.py:236~237`의 `OneJudgeTest` 독스트링 뒤와 `.claude/tests/test_workflow_yaml_structure.py:122~123`의 메서드 사이에는 반대로 빈 줄이 2개 들어가 있어(클래스 바디 내부 관례상 보통 1개), 파일 안에서 빈 줄 규칙이 왔다갔다한다.)

- **[INFO]** `timeout=120`이 이름 없는 리터럴로 5회 반복된다
  - 위치: `.claude/tests/test_review_gate_ci.py:85, 154, 569, 690` (`timeout=120`), `:674` (`timeout=60`)
  - 상세: 서브프로세스 호출마다 동일한 타임아웃 값을 리터럴로 반복 기입했다. 값 자체를 바꿀 이유가 생기면 5곳을 모두 찾아 고쳐야 하고, 하나만 놓치면 그 자리만 다른 타임아웃으로 조용히 남는다. 기능상 문제는 없으나 매직 넘버 중복이다.
  - 제안: 모듈 상단에 `_SUBPROC_TIMEOUT = 120` 상수를 두고 재사용. (스크립트 하나만 호출하는 가벼운 CLI라 값이 자주 바뀔 여지는 낮지만, 이미 파일 안에서도 60과 120이 섞여 있어 왜 다른지 근거가 코드에 없다.)

## 요약

이번 라운드(리뷰 게이트 CI 백스톱 6R/누적 7R)의 핵심 코드(`scripts/check-review-gate.py`, `.github/workflows/review-gate.yml`)는 함수가 짧고 책임이 분명하며 매직 넘버·중복이 없어 유지보수성 관점에서 양호하다. 반면 그것을 지키는 하네스 테스트(`test_review_gate_ci.py`, `test_workflow_yaml_structure.py`)는 6라운드에 걸친 우회-대응 누적으로 "등재제(registry) + 죽은 항목 검출"이라는 동일 관용구가 5곳에 손으로 반복되는 중복, `WorkflowStructureTest`처럼 클래스 이름이 더 이상 실제 내용을 반영하지 못하는 응집도 저하, 6개 성질을 한 테스트 메서드에 몰아넣은 함수 비대화가 나타난다. 전부 동작을 바꾸지 않고 구조만 재배치하면 해소되는 수준이며, 각 항목의 존재 이유는 상세한 주석·docstring으로 이미 잘 기록돼 있어 "왜 이렇게 짜였는지"를 알기 어려운 문제는 아니다. 나머지(README 표 셀 밀도, 빈 줄 스타일, timeout 매직 넘버)는 사소한 스타일 지적이다.

## 위험도

LOW
