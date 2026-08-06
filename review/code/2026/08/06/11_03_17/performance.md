# 성능(Performance) Review

대상: `.claude/tests/README.md`, `.claude/tests/test_block_integrity.py`,
`.claude/tests/test_review_gate_ci.py`, `.claude/tests/test_stop_guard_failopen.py`,
`.github/workflows/harness-checks.yml`, `.github/workflows/review-gate.yml`,
`plan/in-progress/harness-review-gate-ci-backstop.md`, `scripts/check-review-gate.py`

이번 라운드(5R)는 리뷰 게이트의 훅-독립 CI 백스톱 배선을 "정확 일치 + 행위 검증"으로
경화한 변경이다. 실질 로직(`scripts/check-review-gate.py`)은 `review_guard.evaluate_review()`
에 위임하는 얇은 어댑터이고, 나머지는 테스트/워크플로/문서다. 알고리즘 복잡도·N+1·캐싱·
블로킹 I/O 관점에서 CRITICAL 급 결함은 없었다. 아래는 그 안에서 실측 가능한 관찰들이다.

## 작업 트리 관찰 (수정하지 않고 보고)

리뷰 도중 `git status` 를 확인한 결과 `.claude/tests/test_workflow_yaml_structure.py` 가
**이 리뷰의 프롬프트 페이로드(위 8개 파일)에 포함되지 않은 상태로 이미 수정(M)**되어 있었다
(`test_no_guard_workflow_swallows_its_own_failure` 라는 새 테스트 — `continue-on-error` 를
모든 워크플로/모든 job·step 에 대해 금지하고, `harness-checks.yml` 에 그 키가 들어가면
harness 스위트 전체가 조언으로 격하된다는 점을 별도로 고정하는 내용). 본 세션은 이 파일을
Read/Edit/Write 하지 않았고, 요청받은 대로 **고치지 않고 있는 그대로 보고**한다. 성능
관점에서는 이 파일 자체에 알고리즘적 문제는 없다(워크플로 파일 수만큼 순회하는 O(파일 수)
YAML 파싱). 다만 이 상태가 병렬로 진행 중인 다른 세션/에이전트의 작업인지, 혹은 리뷰 페이로드
구성 시점 이후에 반영된 후속 커밋 준비 중인 변경인지는 이 세션에서 판별할 수 없으므로 그대로
기록만 남긴다.

## 발견사항

- **[WARNING]** `evaluate_review()` 호출 빈도가 2배가 됐는데 실행시간/자원 사용을 재는 테스트가 없다
  - 위치: `scripts/check-review-gate.py:97` (`decision = evaluate(root)`),
    `.claude/tests/test_review_gate_ci.py:85` (`_run()` 의 `timeout=120`)
  - 상세: 이 PR 은 `review_guard.evaluate_review()` 의 **두 번째 정기 호출자**(로컬 push/stop
    훅에 이어 매 PR 의 CI)를 새로 추가한다. 그런데 `test_review_gate_ci.py` 를 포함해 이 diff
    어디에도 그 함수의 실행 시간이나 자원 사용에 상한을 두는 단언이 없다 — `_run()` 은
    `timeout=120`(초) 로만 걸러내므로, 수십 초대의 성능 회귀가 들어와도 스위트는 여전히
    green 이다. `evaluate_review()` 의 신선도 판정이 세션 디렉터리를 스캔한다는 점은
    `.claude/tests/README.md` 의 `test_forced_coverage_selection.py` 행("실제, non-mocked
    session dirs")과 `plan/in-progress/harness-review-gate-ci-backstop.md` 의 실측치
    (`origin/main` 이 `review/code` 아래 8,851개 파일 추적)로 이미 문서화돼 있어, 그 비용이
    저장소 히스토리와 함께 자란다는 전제는 근거 없는 추측은 아니다. 로컬 1회 + CI 1회로
    호출 빈도가 두 배가 된 지금이, 그 비용을 실측하고 (메모리 규약이 요구하는 대로) 옛-새
    크기 비교 방식의 성능 회귀 가드를 마련하기 좋은 시점이다.
  - 제안: `evaluate_review()` 호출부에 (advisory 로) wall-clock 측정을 남기거나, 세션 수를
    N/2N 으로 늘려 실행시간 배율을 확인하는 성능 회귀 테스트를 별도로 추가하는 것을 검토.
    다만 `review_guard.py` 자체는 이번 diff 파일 목록에 없어 내부 복잡도를 직접 확인하지는
    못했다 — 실측 전에는 심각도를 더 올리지 않는다.

- **[INFO]** `ReviewGateCliTest.setUp()` 이 테스트 메서드마다 트리 전체를 재복사
  - 위치: `.claude/tests/test_review_gate_ci.py:47-50` (`shutil.copytree` 2회, `ReviewGateCliTest`)
  - 상세: 이 클래스의 9개 테스트 메서드 각각의 `setUp` 이 `.claude/hooks`(28파일/392KB)와
    `.claude/_shared`(8파일/72KB) 전체를 매번 새로 `shutil.copytree` 한다. 심볼릭 링크를
    배제한 이유(주석: `_load_gate` 가 계산하는 경로가 실제 CI 체크아웃과 같은 모양이어야 함)는
    정당하지만, 다수 테스트가 실제로 건드리는 파일은 `review_guard.py` 하나뿐이다. 절대 비용은
    작지만(9회 × ~464KB, 다수의 소형 파일 syscall) 스위트가 커질수록 누적된다.
  - 제안: 베이스 트리 복사를 `setUpClass` 로 1회 옮기고 각 테스트가 필요한 파일만
    임시 디렉터리에 오버라이트하는 방식으로 바꾸면 격리를 유지하며 I/O 를 9× → 1× 로 줄일 수
    있다. 시급하지 않음.

- **[INFO]** 같은 AST 트리를 6회 독립 순회
  - 위치: `.claude/tests/test_review_gate_ci.py:286,300,307,327,341,353`
    (`OneJudgeTest.test_the_import_and_call_surface_stays_small`)
  - 상세: `ast.parse(SCRIPT...)` 로 만든 트리를 imports / 로컬 별칭 / calls / getattr /
    속성-대입 / attrs 수집, 총 6번의 독립된 `ast.walk(tree)` 로 순회한다. 대상 스크립트가
    130행 남짓이라 실측 비용은 무시할 수준이며 이 테스트의 목적(우회 형태별로 명확히 분리된
    검사)을 고려하면 지금 구조가 가독성상 더 낫다 — 조치 불필요, 다만 같은 패턴이 더 큰
    파일에 복제될 경우엔 단일 순회로 합치는 것을 고려할 만하다는 점만 기록.

- **[INFO]** `fetch-depth: 0` 전체 히스토리 체크아웃과 고정 `timeout-minutes: 5` 예산
  - 위치: `.github/workflows/review-gate.yml:47`(timeout-minutes), `:57`(fetch-depth: 0),
    `:67-70`(Fetch base ref 스텝)
  - 상세: `Fetch base ref` 스텝이 `fetch-depth: 0` 위에서 실제로 필요한지는 이미
    "실 러너 없이는 측정 불가"로 문서화돼 있어(`plan/in-progress/harness-review-gate-ci-backstop.md`
    의 "열린 질문") 재론하지 않는다. 다만 순수 성능 관점에서 남는 사실 하나: 전체 히스토리
    체크아웃 비용은 저장소가 자랄수록 늘어나는데, 이를 감지할 예산 임계 테스트나 모니터링이
    없다. Job 이 5분을 넘기면 게이트는 "판정"이 아니라 "CI 인프라 타임아웃"으로 죽고, 이
    경로는 스크립트 내부의 fail-open 계약(예외 시 exit 0) 밖이라 이 백스톱이 스스로 지키려는
    "조용히 꺼지지 않음" 불변식의 사각지대로 남는다. 지금 당장의 결함은 아니고 이번 diff 가
    새로 만든 것도 아니므로 조치 요구 없이 기록만 한다.

- **[INFO]** `plan/in-progress/harness-review-gate-ci-backstop.md` 후속 7번 — 기존 I/O 회귀는
  이번 diff 범위 밖
  - 위치: `plan/in-progress/harness-review-gate-ci-backstop.md:89-94` (후속 7번,
    `_rank_plan_text` 이중 read)
  - 상세: `collect_context` 가 랭킹용으로 `plan/in-progress/` 를 한 번 읽고
    `format_file_bundle` 이 같은 디렉터리를 다시 읽어 세션당 I/O 가 2배라는 기존 결함이 문서에
    적혀 있다. 실제 코드(`code_review_orchestrator.py`)는 이번 8개 리뷰 대상 파일에 없으므로
    이번 변경이 새로 만든 문제가 아니다. 이미 실측(30개 파일/430,929 bytes, ≈3.5ms, 무해)
    및 "5R 에서 코드를 더 건드리지 않기로 해 등재만 함" 으로 기록돼 있어 신규 결함으로
    보고하지 않고, 유실 방지 차원의 교차 참조만 남긴다.

## 요약

이번 변경의 실질 코드(`scripts/check-review-gate.py`)는 O(1) 어댑터이고, 워크플로 YAML 은
루프나 반복 호출이 없는 선언적 설정이라 알고리즘 복잡도·N+1·메모리·캐싱 관점에서 CRITICAL/
WARNING 급 결함은 발견되지 않았다. 가장 눈에 띄는 지점은 이번 PR 이 `evaluate_review()` 의
호출자를 하나 더 추가(로컬 훅 + CI)했는데도 그 함수의 실행 비용에 대한 테스트 커버리지가
전혀 없다는 것 — 배선 정확성은 4라운드에 걸쳐 매우 정교하게 굳혔지만 성능 축은 어느
라운드에서도 다뤄지지 않았다. 나머지는 테스트 스위트 자체의 I/O 관성(매 테스트 트리 재복사,
같은 AST 6회 순회)과 CI 체크아웃 비용 성장 같은 저위험 관찰이며, 다수는 이미 다른 문서에
측정·유예로 기록된 항목이라 이번 diff 의 신규 결함이 아니다. 리뷰 도중 페이로드에 없던
`.claude/tests/test_workflow_yaml_structure.py` 의 미커밋 수정을 관측했으나 본 세션은
건드리지 않았다(위 "작업 트리 관찰" 참조).

## 위험도

LOW
