# 부작용(Side Effect) 리뷰 결과

## 발견사항

- **[INFO]** 신규 테스트 헬퍼가 만든 임시 디렉터리를 정리하지 않음 (파일시스템 부작용)
  - 위치: `.claude/tests/test_changed_paths_reusable.py:57` (`run_with()` 함수, gate 57~62)
  - 상세: `run_with()`가 매 호출마다 `tempfile.mkdtemp()`로 임시 디렉터리(및 그 안의 `scripts/ci-paths-changed.sh` 스텁)를 만들지만 `tempfile.TemporaryDirectory()` 컨텍스트 매니저나 `addCleanup`/`shutil.rmtree` 로 정리하는 코드가 없다. `ArgumentSplittingTest`의 6개 테스트 메서드가 각각 `run_with()`를 1회 이상 호출하므로, 스위트를 실행할 때마다 OS 임시 디렉터리에 정리되지 않는 디렉터리가 누적된다.
  - 참고로 같은 저장소 `.claude/tests/` 안에 `tempfile.mkdtemp()`를 정리 없이 쓰는 파일이 다수 존재해(`test_block_integrity.py`, `test_branch_diff_shared.py`, `test_consistency_bundle_priority.py` 등) 이 패턴 자체는 이 diff 가 새로 도입한 리스크가 아니라 기존 관행을 답습한 것이다. 반면 같은 파일들 중 일부(`test_ci_paths_changed.py`, `test_consistency_orchestrator_state.py`, `test_check_e2e_playwright_config.py`)는 `TemporaryDirectory()`로 정리한다 — 이 신규 파일이 어느 쪽 관행을 따를지 리뷰 시점에 선택할 수 있었다.
  - 제안: CI 러너처럼 매 실행이 폐기되는 환경에서는 실질적 위험이 낮지만, 로컬 반복 실행 시 누적을 막으려면 `tempfile.TemporaryDirectory()`로 바꾸거나 `self.addCleanup(shutil.rmtree, tmp, ignore_errors=True)`를 추가하는 편이 안전하다. 필수 수정은 아님(기존 관행과 동일 수준).

- **[INFO]** `changes` 잡을 인라인 job → reusable workflow 호출로 전환하면서 GitHub 이 노출하는 체크 이름(잡 라벨)이 바뀔 수 있음 (인터페이스 변경)
  - 위치: `.github/workflows/backend-checks.yml:46-48`, `.github/workflows/deps-security-checks.yml:47-49`, `.github/workflows/frontend-checks.yml:28-30` (`changes:` 잡이 `uses: ./.github/workflows/_changed-paths.yml` 로 변경)
  - 상세: 종전에는 `changes` 잡이 워크플로 파일 내부에 인라인으로 스텝을 가졌고 `name: 변경 경로 판정`으로 노출됐다. 이번 변경으로 `changes` 잡이 reusable workflow(`_changed-paths.yml`)를 호출하는 형태가 되면서, GitHub Actions 는 통상 caller job 과 called job 의 이름을 조합해 체크 이름을 표시한다(`<caller job name> / <called job name>`). 이 저장소의 설계상 required status check 대상은 `changes` 자체가 아니라 `lint`/`unit`/`typecheck-ratchet` 등 리프 잡들이므로 브랜치 보호 규칙에 영향을 줄 가능성은 낮지만, 만약 어딘가(브랜치 보호 규칙 등 이 diff 밖의 GitHub 설정)에 `changes` 잡 이름 문자열이 그대로 등록돼 있다면 매칭이 깨질 수 있다.
  - 제안: 이 diff 자체에는 결함이 없으나, 머지 후 실제 GitHub Actions 실행에서 체크 이름 표시가 기대와 같은지 1회 육안 확인을 권장(코드 리뷰만으로는 GitHub UI 렌더링을 확정할 수 없음 — plan/research 문서에도 `Fetch base ref`류 항목처럼 "실제 러너에서만 확인 가능"이라고 명시된 전례가 있다).

## 정적 교차검증 (긍정 결과, 참고용)

리뷰 중 다음 두 가지 실제 부작용 가능성을 직접 열어 확인했고, 문제가 없음을 확인했다(발견사항 아님, 근거 기록):

1. `.claude/tests/test_workflow_yaml_structure.py`의 구조 가드(`_JOB_CONDITIONS`/`_STEP_CONDITIONS`/`_PULL_REQUEST_KEYS`/`test_workflow_and_job_identities_are_unique`)는 `WORKFLOW_DIR.glob("*.y*ml")`로 전 워크플로 파일을 순회하므로 신규 파일 `.github/workflows/_changed-paths.yml`도 자동 포함된다. 이 파일은 `on.workflow_call`만 갖고 `pull_request`/`if:`가 없어 각 등재제 검사에서 `continue`로 건너뛰며, `test_the_two_registries_agree`(이번 diff에 포함된 `test_required_check_skip_jobs.py`)가 `CONVERTED`↔`_SKIP_JOB_WORKFLOWS`↔`_PULL_REQUEST_KEYS` 3자 일치를 이미 강제하므로 등재 누락 위험이 없다.
2. `.github/workflows/harness-checks.yml`의 `paths:` 는 `.github/workflows/**`를 통째로 포함하고 있어(개별 파일 등재가 아님) 신규 `_changed-paths.yml` 파일도 자동으로 harness-checks CI 트리거 대상에 들어간다 — "가드 대상 파일 추가인데 CI paths 커버리지 갭"이라는 이 저장소의 반복 결함 클래스는 이번 건에서는 재현되지 않는다.

## 요약

이번 변경은 세 워크플로(`backend-checks.yml`/`deps-security-checks.yml`/`frontend-checks.yml`)에 복제돼 있던 `changes` 잡 wiring을 `_changed-paths.yml` reusable workflow 로 추출하고, 그에 맞춰 두 테스트 파일(`test_required_check_skip_jobs.py` 갱신, `test_changed_paths_reusable.py` 신설)을 정비한 순수 CI 인프라 리팩터링이다. 프로덕션 코드·공개 API·전역 상태·환경 변수·네트워크 호출 표면에는 손대지 않았고, `workflow_call` outputs → 호출부 `needs.changes.outputs.relevant` 배선, pathspec 목록에 `_changed-paths.yml` 자신을 등재하는 self-coverage, 기존 정적 워크플로 구조 가드(`test_workflow_yaml_structure.py`)와의 충돌 여부까지 직접 대조 확인했으며 회귀는 발견되지 않았다. 유일하게 실질적인 발견은 신규 테스트 헬퍼의 임시 디렉터리 미정리(기존 관행과 동일 수준, 저위험)와 reusable workflow 전환에 따른 GitHub 체크 이름 표시 변화 가능성(설계상 위험 낮음, 실 러너 확인 권장)이며 둘 다 INFO 등급이다.

## 위험도
LOW
