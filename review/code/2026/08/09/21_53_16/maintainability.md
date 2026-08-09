# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `STUB` 상수 + `argv()` 헬퍼가 기존 `test_changed_paths_reusable.py` 와 완전히 바이트 단위로 동일하게 중복됨(diff 로 확인, `diff -q` 결과 동일).
  - 위치: `.claude/tests/test_pnpm_workspace_action.py:57-61` (STUB 정의), `.claude/tests/test_pnpm_workspace_action.py:102-103` (`argv()` 정의). 비교 대상은 `.claude/tests/test_changed_paths_reusable.py:35-39, 72-73`(이번 diff 밖의 기존 파일).
  - 상세: 두 파일 모두 "받는 쪽이 실제로 무엇을 봤는지로 검증하라"는 같은 원칙을 실행 검증(bash 스텁 + `subprocess.run`)으로 구현하면서, `run:`/`action.yml` 블록을 추출해 돌리는 스텁 프로토콜(`ARGC=`/`ARG=` 포맷)과 그 출력을 파싱하는 `argv()` 를 각 파일에 독립적으로 다시 선언했다. 스텁 프로토콜을 바꿔야 할 일(예: NUL-safe 파싱, 특수문자 처리)이 생기면 두 파일을 手동으로 동기화해야 하고, 한쪽만 고치면 조용히 drift 한다 — 이 저장소가 반복해서 겪은 "커버리지 갭" 클래스와 결이 비슷한 위험이다(다만 지금 당장의 실패 시나리오는 아니다).
  - 제안: `.claude/tests/_harness.py` 또는 신규 `_run_block_argv.py` 같은 공유 모듈로 `STUB`/`argv()`(필요하면 "YAML 에서 유일한 `run:` 블록을 뽑아 bash 로 실행하고 인자를 회수한다"는 공통 로직까지)를 추출해 두 파일이 같은 구현을 import 하도록 하는 것을 고려. 지금 당장 위험도가 낮아 급하지 않지만, 이 실행-검증 패턴이 반복되는 추세(README 카탈로그에 이미 3개 스위트가 같은 기법을 씀)라 세 번째 사례가 추가되기 전에 추출하는 편이 싸다.

- **[INFO]** `run_install()` 이 만드는 임시 디렉터리(`tempfile.mkdtemp()`)가 정리되지 않음.
  - 위치: `.claude/tests/test_pnpm_workspace_action.py:89-92`(`tmp = tempfile.mkdtemp()` 이후 `shutil.rmtree`/`tearDown`/`addCleanup` 없음).
  - 상세: 테스트를 반복 실행할 때마다 `/tmp` 에 스텁 디렉터리가 하나씩 남는다. 다만 이 저장소의 테스트 스위트 전반이 같은 패턴(`tempfile.mkdtemp()` 후 미정리)을 광범위하게 쓰고 있어(`test_block_integrity.py`·`test_review_guard.py`·`test_retry_state_shared.py` 등 수십 개 파일) **이 diff 가 새로 만든 결함이 아니라 기존 컨벤션을 그대로 따른 것**이다. 회귀는 아니므로 이 diff 를 막을 사유는 아니고, 정보 제공 목적으로만 남긴다.

- **[INFO]** `.claude/tests/README.md` 신규 행이 표 셀 하나에 매우 긴 단일 문단(수백 단어)을 담고 있어 표 자체의 가독성은 낮다.
  - 위치: `.claude/tests/README.md`(신규 `test_pnpm_workspace_action.py` 행, 게이트 52번째 줄).
  - 상세: 다만 표의 다른 모든 기존 행(`test_ci_paths_changed.py`·`test_changed_paths_reusable.py`·`test_required_check_skip_jobs.py`·`test_review_gate_ci.py` 등)이 이미 같은 스타일(한 셀에 서사적 장문)을 쓰고 있어, 이번 추가는 **파일이 이미 확립한 컨벤션과 완전히 일관**된다. 새로운 이슈를 만든 것이 아니므로 감점 사유는 아니다.

## 요약

이번 변경은 8~9개 워크플로에 흩어져 있던 바이트-동일 pnpm 셋업 3단계를 composite action(`.github/actions/pnpm-workspace/action.yml`) 하나로 추출한 리팩터로, 워크플로 순 -41줄·게이팅 조건 반복 57→39곳이라는 실질적인 DRY 개선이다. 새 액션과 신규 테스트(`test_pnpm_workspace_action.py`)는 이 저장소가 이미 확립한 컨벤션(실행 검증 스텁 패턴, `_harness.REPO_ROOT` 사용 이유를 명시하는 방어적 주석, harness 커버리지 등록 3중 동반 갱신)을 정확히 따르고 있고, `test_workflow_yaml_structure.py` 의 구조 검사를 `.github/actions/**/action.yml` 까지 넓혀 액션 추출로 생긴 새 사각지대(2026-08-01 중복 `run:` 사고의 재발 가능 지점)를 스스로 메운 점이 특히 견고하다. 함수 길이·중첩 깊이·네이밍·기존 스타일 준수 모두 양호하며, 실질적 결함은 발견되지 않았다. 유일하게 주목할 점은 `STUB`/`argv()` 헬퍼가 기존 `test_changed_paths_reusable.py` 와 완전히 중복된다는 것인데, 위험도는 낮고(스텁이 안정적인 4줄짜리 bash) 이 저장소가 이미 데인 실패 클래스(등록 누락·drift)를 직접 유발하지는 않는다.

## 위험도

LOW
