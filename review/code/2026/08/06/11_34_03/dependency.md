# 의존성(Dependency) 리뷰 — round 6, CI 백스톱 (review-gate.yml / check-review-gate.py)

## 발견사항

- **[WARNING]** 리뷰 프롬프트 번들이 `test_review_gate_ci.py`의 테스트 클래스 하나를 **아무 표시 없이** 통째로 누락시켰고, 그 뒤의 모든 게이트 줄 번호가 57줄 밀렸다 — 이 라운드의 리뷰 파이프라인 자체가 겪고 있는 결함.
  - 위치: 프롬프트 상 "파일 3: .claude/tests/test_review_gate_ci.py" 블록. `VerdictComesFromTheGateTest`(게이트 549~559, 실제 파일과 일치) 바로 다음이 프롬프트에서는 곧장 `class PyYamlPinsAgreeTest`(게이트 "561")로 이어진다. 그러나 실제 파일(`.claude/tests/test_review_gate_ci.py`, `Read`로 직접 확인)에는 그 사이에 **`class ReviewArtifactsStayTrackedTest`(실제 561~616행, 56줄)**가 통째로 존재하고, `PyYamlPinsAgreeTest`는 실제로 618행에서 시작한다. 파일 끝도 프롬프트는 게이트 "594"(`unittest.main()`)로 끝나지만 실제 파일은 651행(`wc -l` 확인) — 정확히 57줄 차이다.
  - 상세: 이 저장소의 다른 8개 리뷰 대상 파일은 전부 프롬프트의 마지막 게이트 번호가 `wc -l` 실측과 정확히 일치했다(예: `test_block_integrity.py` 844=844, `test_stop_guard_failopen.py` 276=276, `test_workflow_yaml_structure.py` 271=271, `harness-checks.yml` 105=105, `review-gate.yml` 74=74, `check-review-gate.py` 130=130, plan 문서 339=339). 유일하게 `test_review_gate_ci.py`만 어긋났고, 잘려나간 구간이 정확히 하나의 `unittest.TestCase` 클래스 크기와 일치한다. `README.md`(파일 1)는 잘릴 때 `"... (프롬프트 크기 제한으로 44/102 줄만 표시 — 나머지는 원본 파일 참조) ..."`라는 명시적 절단 표시를 남겼지만, 이번 누락에는 그런 표시가 전혀 없다 — grep으로 해당 구간 전체를 확인했다.
    누락된 `ReviewArtifactsStayTrackedTest`는 이 CI 백스톱 전체가 딛고 선 전제, 즉 **`review/**`가 `.gitignore`에 다시 걸리지 않고 git에 계속 추적되는지**를 고정하는 클래스다(`git check-ignore` + `git ls-files`로 실측). 이 라운드의 다른 서브에이전트들이 같은 번들을 받았다면, 이 안전장치 자체가 검토 사각지대에 들어갔을 가능성이 있다. 또한 plan 문서(파일 8, 실제 파일과 일치 확인됨)는 "`code_review_orchestrator.build_files_section`이 프롬프트 예산 초과 **파일**을 아무 표시 없이 통째로 누락시켰다 → 수정 완료"라고 적어 두었는데, 이번에 관측된 것은 파일 단위가 아니라 **파일 중간의 한 섹션**이 표시 없이 사라진 것이어서, 같은 결함 클래스의 다른 결(미수정 변형)일 가능성이 있다.
  - 제안: 프롬프트 조립 스크립트에서 파일-전체 절단뿐 아니라 파일 중간 구간 절단(혹은 클래스/함수 경계에서의 부분 생략)에도 동일한 절단 표시를 강제할 것. 이번 라운드 다른 리뷰어들의 산출물에 `ReviewArtifactsStayTrackedTest` 관련 코멘트가 있는지 대조해, 실제로 검토가 누락됐는지 확인 권장.

- **[WARNING]** `review-gate.yml`의 `paths:` 트리거가 `review_guard.py`/`check-review-gate.py`의 내부 모듈 의존 그래프를 **손으로 나열**하고 있고, 이 목록의 완전성을 지키는 테스트가 없다 — 이 저장소가 이미 6번 겪고 고친 "paths 커버리지 갭" 결함 클래스가 이 신규 워크플로에는 아직 이식되지 않았다.
  - 위치: `.github/workflows/review-gate.yml:28,31,32` (`on.pull_request.paths` 안의 `'.claude/hooks/_lib/review_guard.py'` / `'.claude/hooks/_lib/branch_guard.py'` / `'.claude/_shared/**'`)
  - 상세: 같은 목록 안에서 `.claude/_shared/**`는 글롭이라 그 디렉터리에 새 모듈이 추가돼도 자동으로 커버되지만, `.claude/hooks/_lib/` 쪽은 `review_guard.py`·`branch_guard.py` 두 파일명만 정확히 박아 뒀다(비대칭). 현재는 `review_guard.py`가 `_lib` 안에서 `branch_guard`만 import하므로(직접 `grep '^import\|^from'` 로 확인) 정확히 커버되지만, 향후 리팩터링으로 `_lib`에 세 번째 모듈이 추가되고 `review_guard.py`가 그걸 import하게 되면, 그 신규 파일만 단독으로 고친 PR은 `review-gate.yml`을 전혀 트리거하지 않는다 — CI 백스톱이 조용히 스킵된다. `harness-checks.yml`은 정확히 이 실패 클래스를 여섯 번 겪었고(`.githooks/**`, `.claude/_shared/**`, `.claude/workflows/**`, `.github/dependabot.yml`, `.github/workflows/e2e.yml`, `.claude/config/**`), 그걸 지키려고 `test_harness_checks_paths_coverage.py`라는 전용 완전성 가드를 만들었다. 그런데 이 가드는 **`harness-checks.yml`만** 스코프로 한다(`grep -n "review-gate" .claude/tests/test_harness_checks_paths_coverage.py`는 0건) — `review-gate.yml`에는 대응하는 가드가 없다. `WorkflowWiringTest`의 문서-전체 정확 일치 검사는 "지금 적힌 `paths:` 리스트가 하드코드된 기대값과 같은가"만 증명할 뿐, "그 리스트가 실제 import 그래프를 완전히 덮는가"는 증명하지 못한다 — 둘 다 손으로 고치면 여전히 통과한다.
  - 제안: `'.claude/hooks/_lib/review_guard.py'`·`'.claude/hooks/_lib/branch_guard.py'` 두 줄을 같은 목록의 `'.claude/_shared/**'`와 대칭으로 `'.claude/hooks/_lib/**'` 글롭으로 넓히거나(트리거가 넓어지는 방향은 안전한 방향), `test_harness_checks_paths_coverage.py`와 같은 원리로 `review_guard`/`check-review-gate.py`의 실제 import를 정적 분석해 `review-gate.yml`의 `paths:`를 검증하는 완전성 테스트를 추가.

- **[INFO]** PyYAML 핀이 정확 버전이 아니라 범위(`pyyaml>=6,<7`)이고, 이제 3곳(신규 `harness-checks.yml` 1곳 + 기존 `deps-security-checks.yml` 2곳)에 손으로 중복돼 있다 — 다만 이 PR이 그 드리프트를 실제로 막는 테스트(`PyYamlPinsAgreeTest`)를 함께 추가했다.
  - 위치: `.github/workflows/harness-checks.yml:87-88`(`pip install "pyyaml>=6,<7"`, 신규); `.claude/tests/test_review_gate_ci.py:618-647`(`class PyYamlPinsAgreeTest` — **실제 파일 기준 618행**. 프롬프트 게이트는 "561"로 표시되지만, 위 첫 번째 발견사항에서 밝힌 57줄 누락 때문에 어긋나 있어 `Read`로 직접 확인한 실제 줄 번호를 쓴다.)
  - 상세: 세 워크플로 파일에 걸쳐 같은 핀 문자열을 손으로 반복하는 구조는 이 저장소가 반복해서 겪은 "손-동기 쌍은 드리프트한다" 패턴(`report_paths`, `retry_state`, doc-sync 매트릭스와 동일 계열)이다. 이 PR은 그 패턴을 재현하는 대신, `PyYamlPinsAgreeTest.test_every_workflow_pins_the_same_version`으로 모든 워크플로의 `pyyaml` 핀 문자열이 정확히 하나로 일치하는지 검증한다(실행해 확인: 3곳 모두 `pyyaml>=6,<7`로 동일, `len(pins) == 1` 통과). 테스트 자신의 docstring이 "단일 진실화(`constraints.txt`)가 더 낫지만 세 워크플로의 설치 방식을 바꾸는 일이라 범위 밖"이라고 명시하고 있고, 이 판단에 동의한다 — 이번 라운드 차단 사유는 아니다.
  - 제안: 없음(향후 `constraints.txt` 단일화는 별도 작업으로 남겨도 무방).

- **[INFO]** 이 변경분은 **새 외부 의존성을 추가하지 않는다.**
  - 위치: `scripts/check-review-gate.py` (`import argparse, os, sys`만 — stdlib), `.claude/hooks/_lib/review_guard.py`/`branch_guard.py`, `.claude/_shared/report_paths.py`/`block_integrity.py` (전부 `grep '^import\|^from'`로 확인, 전부 stdlib)
  - 상세: `review-gate.yml`은 "표준 라이브러리만 쓴다 — 설치 단계 없음"이라고 스스로 문서화했고, 실제로 `pip install` 스텝이 없다. `harness-checks.yml`의 PyYAML은 신규 외부 의존이 아니라 `deps-security-checks.yml`이 이미 쓰던 것의 재사용이다(위 항목). 라이선스(PyYAML=MIT)·취약점 신규 노출 없음. YAML 파싱은 전부 `yaml.safe_load`/`SafeLoader` 서브클래스만 사용해(`scripts/check-override-floors.py:129`, `test_workflow_yaml_structure.py`) 알려진 `yaml.load()` 임의 코드 실행 취약점 클래스를 피한다.

- **[INFO]** GitHub Actions가 불변 커밋 SHA가 아니라 가변 메이저 태그(`@v7`)로 고정돼 있다 — 저장소 전체 관행이며 이 PR이 새로 만든 문제는 아니지만, `review-gate.yml`이 보안 관련 백스톱이라는 점에서 기록해 둔다.
  - 위치: `.github/workflows/review-gate.yml:55,59`(`actions/checkout@v7`, `actions/setup-python@v7`), `.github/workflows/harness-checks.yml:75,79,100`(`actions/checkout@v7`, `actions/setup-python@v7`, `actions/setup-node@v7`)
  - 상세: `grep -n "uses: actions" .github/workflows/*.yml` 로 저장소 전체 10개 워크플로를 대조한 결과 전부 동일하게 `@v7` 메이저 태그를 쓴다 — 이 PR만의 문제가 아니라 기존 관행이다. 다만 이번 라운드가 4~5R에 걸쳐 "`if:`/`continue-on-error`/스텝 목록/환경변수 접근"을 전부 막아 판정 로직 자체의 우회 표면을 좁혔음에도, 그 판정을 구동하는 Actions 자체의 공급망(태그가 가리키는 실제 코드)은 어떤 로컬 테스트도 관측하지 못한다 — `WorkflowWiringTest`는 YAML 텍스트만 비교하지, 태그가 가리키는 실행 코드는 검증할 수 없다. 저장소 전체 관행 변경은 이 PR 범위 밖이라 판단해 정보성으로만 기록한다.
  - 부수: `harness-checks.yml:77-78`의 주석 "actions major policy consistent with the other workflows (v5/v6 line)"은 stale하다 — 실제로는 모든 워크플로가 `v7`이다. `git blame`으로 확인: 주석은 2026-05-30 커밋, 태그는 2026-07-21 dependabot이 `v7`로 올렸는데 주석은 갱신 안 됨. 이 PR이 만든 drift는 아니고(해당 줄은 이번 diff에 없음), 이를 검증하는 테스트도 없다(`PyYamlPinsAgreeTest`/`WorkflowWiringTest`는 리터럴 YAML 값만 고정하지 prose는 안 본다). 우선순위 낮은 문서 정리 항목.

- **[INFO]** 내부 의존성 경로 선택이 신중하다 — 긍정적으로 기록.
  - 위치: `scripts/check-review-gate.py:55-59`(`_load_gate`가 `.claude/hooks/_lib`만 `sys.path`에 얹음)
  - 상세: 주석에 따르면 초판은 `hooks/`도 함께 얹었으나, 격리 프로세스로 `_lib`만으로 끝까지 도는 것이 실측으로 확인돼 최소 표면으로 좁혔다. `_lib`라는 이름이 `.claude/skills/_lib`와 충돌하는 문제는 plan 문서(`plan/in-progress/harness-review-gate-ci-backstop.md:88,154,165`)에 별도 범위로 이미 명시적으로 defer돼 있어, 이번 라운드에서 새로 지적할 항목은 아니다.

## 요약

이번 변경분 자체가 새로 끌어들이는 외부 의존성은 없고, 재사용한 PyYAML 핀은 오히려 이번 PR이 추가한 `PyYamlPinsAgreeTest`로 드리프트 방지가 강화됐다 — 순수 "패키지 의존성" 관점에서는 깨끗하다. 실질적으로 남는 두 가지는 (1) 이 라운드의 리뷰 프롬프트 번들 자체가 `test_review_gate_ci.py`의 한 테스트 클래스(`ReviewArtifactsStayTrackedTest`, CI 백스톱의 전제인 "review/ 추적 유지"를 고정하는 안전장치)를 표시 없이 누락시켜 게이트 번호가 57줄 밀린 것 — 리뷰 파이프라인의 신뢰성 문제이고, (2) `review-gate.yml`의 `paths:` 트리거가 `_lib` 디렉터리를 글롭이 아니라 개별 파일명으로 손으로 나열해, 이 저장소가 이미 6번 겪은 "paths 커버리지 갭" 클래스가 이 신규 워크플로엔 아직 이식된 가드 없이 재발할 여지를 남긴 것이다. 둘 다 오늘 당장 게이트를 무력화하지는 않지만, 전자는 이번 라운드 검토의 사각지대를, 후자는 미래 리팩터링에서 조용히 재발할 수 있는 트리거 완전성 갭을 가리킨다.

## 위험도

MEDIUM
