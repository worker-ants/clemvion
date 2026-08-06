# 성능(Performance) 리뷰 결과

## 검토 범위 메모

이번 changeset(9개 파일)은 전부 `.claude/tests/**` 하네스 자기-테스트, `.github/workflows/harness-checks.yml` / `review-gate.yml`, `scripts/check-review-gate.py`, `plan/in-progress/harness-review-gate-ci-backstop.md` — **CI 게이트/하네스 인프라 코드**다. 사용자 트래픽을 받는 런타임 hot path 가 아니라 "PR 마다 GitHub Actions 에서 한 번 도는" 코드이므로, 성능 관점의 기준은 프로덕션 서비스 코드와 다르게 — **CI 작업 시간 예산(각 워크플로 `timeout-minutes: 5`) 안에서 안전한가** — 적용했다. `.claude/tests/README.md` 는 문서/카탈로그일 뿐 실행 경로가 없어 성능 관점에서는 근거 자료로만 참조했다.

`review_guard.py`(실제 판정 로직 본체)는 이번 changeset 에 포함돼 있지 않아 — 참조만 되고 — 그 내부 알고리즘 복잡도는 평가 대상에서 제외했다.

## 발견사항

- **[INFO]** 테스트 클래스 `setUp()` 에서 훅 트리 전체를 매 테스트 메서드마다 `shutil.copytree` — 반복 I/O
  - 위치: `.claude/tests/test_review_gate_ci.py:46-50` (`ReviewGateCliTest.setUp`, `.claude/hooks` + `.claude/_shared` 전체 복사, 클래스 내 테스트 메서드 8개 × 1회씩)
  - 위치: `.claude/tests/test_stop_guard_failopen.py:70` (`StopGuardFailOpenTest.setUp`, `shutil.copytree(HOOKS_DIR, self.hooks)`, 클래스 내 테스트 메서드 약 14개 × 1회씩)
  - 상세: 두 클래스 모두 매 테스트 메서드 실행 전에 훅 디렉터리 전체를 새 임시 디렉터리로 복사한다. 격리(isolation)를 위한 의도된 설계이고 — 일부 테스트가 복사본의 `review_guard.py`/`plan_guard.py` 를 실제로 덮어쓰거나 삭제하므로(`os.remove(self.gate_module)`, 스텁 파일로 overwrite) 공유 fixture 를 그대로 재사용할 수는 없다 — 그 자체를 문제로 보기는 어렵다. 다만 클래스당 8~14회씩 디렉터리 트리 전체를 반복 복사하는 비용은 훅 트리 규모가 커질수록 선형으로 늘어난다.
  - 제안: 현재 규모(수십 개 파일)에서는 CI 5분 예산 대비 무해하지만, 훅 디렉터리가 계속 커지는 추세(이 저장소는 회귀마다 `_lib` 에 새 helper 모듈을 계속 추가하는 패턴)라면 `setUpClass` 에서 pristine 스냅샷을 한 번만 만들고 각 테스트가 그 위에 `copy2`/`copytree(dirs_exist_ok=True)` 로 필요한 파일만 덮어쓰는 방식, 혹은 변경 대상이 아닌 하위 트리(`_lib` 밖 파일들)만 심볼릭 링크로 공유하는 방식을 고려할 수 있다. 지금 당장 조치할 필요는 없음(관측 사항).

- **[INFO]** 워크플로 YAML 을 테스트 메서드마다 독립적으로 재파싱 — 캐싱 기회
  - 위치: `.claude/tests/test_workflow_yaml_structure.py` (`WorkflowStructureTest`, 특히 `test_no_duplicate_keys` L98-108, `test_every_step_has_exactly_one_of_run_or_uses` L110-122, `test_no_guard_workflow_swallows_its_own_failure` L139-182, `test_job_conditions_are_registered` L204-221, `test_step_conditions_are_registered` L223-243, `test_pull_request_trigger_shape_is_registered` L259-279, `test_workflow_and_job_identities_are_unique` L281-299)
  - 상세: `setUp()`(L92-96)은 파일 목록(glob)만 캐싱하고, 실제 `yaml.safe_load(path.read_text(...))` 파싱은 위 7개 테스트 메서드가 각자 다시 수행한다. 워크플로 파일 9개 × 테스트 메서드 7개 = 최대 63회의 독립 YAML 파싱이 발생하며 그중 어떤 결과도 재사용되지 않는다.
  - 제안: `setUpClass` 에서 `{path: yaml.safe_load(...)}` 매핑을 한 번만 만들어 모든 테스트가 공유하도록 하면 반복 파싱을 제거할 수 있다. 현재는 워크플로 파일이 9개뿐이고 각각 수십~백여 줄이라 절대 시간은 무시할 만한 수준(총합 수십 ms 미만으로 추정)이라 **차단 사유는 아니다**. 다만 이 클래스는 라운드마다 새 등재제 레지스트리(`_JOB_CONDITIONS`, `_STEP_CONDITIONS`, `_PULL_REQUEST_KEYS`, `_MAY_SWALLOW` 등)를 계속 늘려온 이력이 있고 — 워크플로 파일 수·항목 수가 앞으로도 늘어날 구조이므로, 이번에 캐싱 관성을 만들어 두면 향후 성장 시 재작업 비용을 아낀다.

- **[INFO]** 단일 AST 를 여러 번 순회 — 사소하지만 중복 순회
  - 위치: `.claude/tests/test_review_gate_ci.py:265-373` (`OneJudgeTest.test_the_import_and_call_surface_stays_small`)
  - 상세: 같은 `tree = ast.parse(SCRIPT.read_text(...))` 에 대해 import 수집(L286), 로컬 별칭 수집(L300), 호출 검사(L307), `getattr` 우회 검사(L327), 속성-대입 검사(L341) 총 5회의 독립적인 `ast.walk(tree)` 루프를 순차 실행한다.
  - 상세2: 대상 스크립트(`scripts/check-review-gate.py`)가 130줄 안팎으로 매우 작아 실질 비용은 무시할 수준이며, 각 순회가 서로 다른 목적(수집 대상이 다름)을 갖고 있어 하나로 합치면 가독성이 떨어질 수 있다. 순수 성능 관점의 이론적 낭비만 지적한다.
  - 제안: 조치 불필요. 대상 파일이 지금처럼 "인자를 읽고 게이트를 부르고 출력한다" 수준으로 작게 유지된다는 전제(테스트 docstring 이 명시)가 깨져 스크립트가 커지면 그때 하나의 `ast.walk` 로 합치는 리팩터를 고려.

- **[INFO]** 행위 검증(behavioral test) 전환으로 서브프로세스 스폰 수가 라운드마다 누적
  - 위치: `.claude/tests/test_review_gate_ci.py:512-582`(`VerdictComesFromTheGateTest.test_exit_code_is_a_pure_function_of_the_gate_verdict` — 환경 2종 × 케이스 4종 = 서브프로세스 8회), `.claude/tests/test_review_gate_ci.py:41-217`(`ReviewGateCliTest` 전체 — 테스트마다 `git init`/`commit`/`checkout` 등 git 서브프로세스 여러 회 + 대상 스크립트 서브프로세스 1회, 클래스당 8개 메서드)
  - 상세: 이번 라운드 컨텍스트가 명시하듯 "정적 부분일치 → 행위검증"으로 설계를 반전한 결과, `check-review-gate.py` 하나를 검증하기 위해 파일 전체에서 git 프로세스 스폰 + 파이썬 서브프로세스 스폰이 수십 회 발생한다(대략 `ReviewGateCliTest` 8×(git init+commit 2회 이상) + `VerdictComesFromTheGateTest` 8회 + `TheGateItselfDoesNotBranchOnCiEnvTest`/`ReviewArtifactsStayTrackedTest` 의 git 서브프로세스 여러 회). 이는 정확성(우회 원천 차단) 을 위한 의도된 트레이드오프이고 각 호출은 가볍다(수백 ms 이내로 추정) — `harness-checks.yml` 의 `timeout-minutes: 5` 대비 여유가 있다.
  - 제안: 지금은 문제없음. 다만 이 패턴(정적 검사 무력화 → 행위 검증으로 전환)이 반복될 성질의 것이므로, `harness-checks` 잡의 실제 wall-clock 시간을 주기적으로 관측해 5분 예산에 근접하면 그때 병렬화(`unittest` discover 를 여러 잡으로 분할)를 검토할 것을 권장. 지금 이 changeset 만으로는 예산 초과 위험이 낮다.

특기사항: `plan/in-progress/harness-review-gate-ci-backstop.md` 의 §신규 후속 7번 항목("`_rank_plan_text` 이중 read")은 `code_review_orchestrator.py`(이번 changeset 파일 목록 밖)의 I/O 중복을 이미 측정(≈3.5ms, 무해)하고 의도적으로 defer 한 상태라 이 리뷰에서 새 발견으로 세지 않았다 — 이미 저장소 안에서 추적되고 있는 항목임을 확인만 해 둔다.

## 요약

이번 changeset 은 런타임 서비스 코드가 아니라 CI 게이트/하네스 테스트 인프라이며, 시간/공간 복잡도 폭발, N+1 API 호출, 대규모 메모리 적재, 캐시 무효화 실패, 블로킹 I/O 병목 등 CRITICAL/WARNING 급 성능 결함은 발견되지 않았다. `scripts/check-review-gate.py` 본체는 인자 파싱 → 게이트 함수 1회 호출 → 출력의 단순한 선형 스크립트로 성능상 지적할 부분이 없다. 테스트 스위트 쪽에서는 (a) 클래스별 `setUp` 에서 훅 디렉터리를 테스트마다 반복 복사하는 점, (b) 워크플로 YAML 을 테스트 메서드마다 독립적으로 재파싱해 캐싱 기회를 놓치는 점, (c) 같은 AST 를 5회 순회하는 점, (d) 정적 검사에서 행위(서브프로세스) 검증으로의 설계 전환에 따라 서브프로세스 스폰 수가 라운드마다 누적되는 추세 — 를 관측했으나, 모두 대상 파일/스크립트 규모가 작고 CI 잡의 5분 타임아웃 대비 여유가 커서 지금 당장 차단할 사유는 없다. 다만 이 저장소가 이번 라운드처럼 "레지스트리를 계속 늘리는" 방식으로 가드를 경화해 온 이력을 볼 때, 워크플로/훅 트리 규모가 커질 경우를 대비해 YAML 파싱 캐싱과 `setUp` 복사 비용 절감은 선제적으로 손대 두면 향후 회귀 비용을 줄일 수 있는 지점으로 남겨둔다.

## 위험도

LOW
