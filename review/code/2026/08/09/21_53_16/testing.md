# 테스트(Testing) 리뷰

## 발견사항

- **[WARNING]** `test_toolchain_pins_did_not_drift_in_the_extraction` 이 실제로는 `uses:` 액션 버전을 고정하지 않는다 — 테스트 docstring·README 카탈로그 서술과 실제 검증 범위가 어긋난다
  - 위치: `.claude/tests/test_pnpm_workspace_action.py:170-185` (`WiringTest.test_toolchain_pins_did_not_drift_in_the_extraction`)
  - 상세: 이 테스트의 docstring 은 "`uses:` 스텝은 여기서 실행할 수 없으므로 핀 값만 정적으로 고정한다(액션 버전·node 버전·캐시 키)"라고 명시하고, `.claude/tests/README.md:49`(카탈로그 행)도 "the toolchain pins the extraction could have silently changed (action version, node 24, pnpm cache keyed on the lockfile)"라고 서술해 액션 버전이 핀돼 있음을 전제로 한다. 그런데 실제 단언은:
    - `actions/setup-node` 스텝을 `str(s.get("uses", "")).startswith("actions/setup-node")` 로만 찾고(174행), **버전(`@v7`)은 전혀 비교하지 않는다.**
    - `pnpm/action-setup` 스텝도 `startswith("pnpm/action-setup@")`(183행)로만 확인해 **"@" 뒤에 어떤 버전이 와도 통과**한다(`@v6.0.9` → `@v99.0.0` 로 바뀌어도 RED 가 되지 않는다).
    - `node["with"]["node-version"]`·`cache`·`cache-dependency-path` 만 값으로 고정돼 있고, 액션 자체의 버전 드리프트는 검증 밖이다.
    - `plan/in-progress/ci-required-check-skip-jobs.md` 가 적어 둔 뮤테이션 목록(13건: `--frozen-lockfile` 제거 · 필터 인용 제거 · env 미경유 · `required` 해제 · 캐시 키 드리프트 · `shell:` 제거 · 게이팅 누락 · pathspec 등재 누락 · 액션 내 중복 `run:` · `run`+`uses` 동시 · `continue-on-error` · 글롭 파손 · harness pathspec 제거)에도 **"액션 버전 드리프트"는 없다** — 실측이 이 갭을 뒷받침한다.
  - 제안: `node["uses"]`/해당 step 의 `uses` 값을 `assertEqual`로 정확히 고정하거나(`"actions/setup-node@v7"`, `"pnpm/action-setup@v6.0.9"`), docstring·README 카탈로그의 "액션 버전" 서술을 실제 검증 범위(존재 여부만 확인)에 맞게 낮춘다. 전자가 이 파일이 스스로 세운 목표("추출이 툴체인을 조용히 바꾸지 않았는지")에 더 부합한다.

- **[INFO]** `run_install()` 이 만든 임시 디렉터리가 정리되지 않는다
  - 위치: `.claude/tests/test_pnpm_workspace_action.py:83-99` (`run_install`)
  - 상세: `tempfile.mkdtemp()` 로 만든 디렉터리에 `pnpm` 스텁을 놓고 `subprocess.run` 을 실행하지만, `TemporaryDirectory` 컨텍스트 매니저나 `addCleanup(shutil.rmtree, tmp)` 없이 그대로 함수를 반환한다. `InstallCommandTest` 의 네 테스트가 매번 새 `mkdtemp()` 를 호출하므로 반복 실행마다 임시 디렉터리가 누적된다. CI 러너는 매번 새 컨테이너라 실질 영향이 없지만, 로컬 반복 실행(`run-test.sh` 를 여러 번 돌리는 개발 루프)에서는 `/tmp` 가 계속 쌓인다.
  - 제안: `tempfile.TemporaryDirectory()` 컨텍스트 매니저로 바꾸거나 호출부에서 `self.addCleanup(shutil.rmtree, tmp, ignore_errors=True)` 를 추가.

- **[INFO]** `next()` 를 기본값·설명 없이 사용해 실패 시 진단 메시지가 불명확함
  - 위치: `.claude/tests/test_pnpm_workspace_action.py:174`, `183`(같은 메서드), `.claude/tests/test_pnpm_workspace_action.py:246`(`ConsumerBindingTest.test_every_consumer_lists_the_action_in_its_pathspecs` 밖 `step = next(...)` — `test_the_filter_reaches_the_step_through_env`, 162행)
  - 상세: `next(s for s in steps if ...)` 형태가 매칭 실패 시 `StopIteration` 을 던진다. `unittest` 테스트 메서드 안에서는 이것이 일반 예외로 잡혀 "ERROR"로 보고되지만, `self.assertTrue`/`self.fail()` 과 달리 "무엇이 없어서 실패했는지"를 설명하는 메시지가 없다. `install_run_block()`(72-80행)은 이미 `assert len(runs) == 1, f"..."` 형태로 진단 메시지를 붙이는 더 나은 패턴을 같은 파일에서 쓰고 있어 일관성도 어긋난다.
  - 제안: `next(..., default=None)` + `self.assertIsNotNone(node, "actions/setup-node 스텝을 못 찾았다")` 형태로 실패 메시지를 명시.

- **[INFO]** `ConsumerBindingTest.consumers()` 가 `.yml` 확장자만 스캔해 `test_workflow_yaml_structure.py::_workflow_files()` 와 비대칭
  - 위치: `.claude/tests/test_pnpm_workspace_action.py:204-215` (`ConsumerBindingTest.consumers`, `WORKFLOWS.glob("*.yml")`)
  - 상세: 같은 계약(워크플로 전수 스캔)을 지키는 `test_workflow_yaml_structure.py::_workflow_files()` 는 `WORKFLOW_DIR.glob("*.y*ml")` 로 `.yml`/`.yaml` 둘 다 잡는데, 이 파일은 `*.yml` 만 본다. 지금 저장소 컨벤션이 전부 `.yml` 이라 실질 위험은 낮지만, 두 가드가 같은 "모든 워크플로" 라는 전제를 다른 glob 으로 구현하고 있어 향후 `.yaml` 파일이 하나라도 들어오면 이 클래스(`ConsumerBindingTest`)만 조용히 그 소비처를 놓친다 — 이 PR 이 반복해서 경계하는 "커버리지 갭" 클래스와 같은 모양이다.
  - 제안: `WORKFLOWS.glob("*.y*ml")` + suffix 필터로 통일하거나, 최소한 두 파일이 같은 glob 규약을 공유하도록 상수화.

## 요약

핵심 신규 파일 `test_pnpm_workspace_action.py`(259줄)는 이 저장소의 확립된 "받는 쪽이 실제로 무엇을 받았는지 검증하라" 원칙을 성실히 따른다 — `run:` 블록을 실제 bash 서브프로세스로 실행하고 PATH 스텁이 받은 `argv` 를 직접 세는 방식은 정적 grep 으로는 못 잡는 인용 누락·env 배선 단절·glob 조기확장 류의 결함을 실제로 잡아낸다. `--frozen-lockfile`·필터 격리·인젝션 회피(`env:` 경유)·필수 `filter` 입력·`shell:` 필수·소비처 게이팅/pathspec 등재 같은 핵심 계약은 실행 검증 또는 구조 검증으로 잘 고정돼 있고, `test_workflow_yaml_structure.py` 의 구조 검사(중복 키·`run`/`uses` 배타)를 composite action 층까지 확장한 것도 2026-08-01 사고 재발을 정확히 겨눈 타당한 스코프 확대다. vacuity 방지 바닥(`assertGreaterEqual(len(consumers), 8)`, `_action_files` 존재 단언)도 잘 갖춰져 있다. 다만 한 군데 실질적 갭이 있다: `test_toolchain_pins_did_not_drift_in_the_extraction` 은 스스로의 docstring 과 README 카탈로그가 약속하는 "액션 버전 핀"을 실제로는 검증하지 않는다(`startswith` 만 확인, 정확한 버전 문자열은 미비교) — `pnpm/action-setup@v6.0.9` 나 `actions/setup-node@v7` 이 다른 버전으로 조용히 바뀌어도 이 스위트는 RED 가 되지 않는다. 이는 이 PR 이 스스로 세운 "액션 버전은 정적으로 고정한다"는 문서화된 보장이 구현보다 넓은 경우다. 나머지는 리소스 정리·진단 메시지·glob 대칭성 수준의 사소한 개선점이며 기존 테스트 회귀·격리·가독성은 전반적으로 양호하다.

## 위험도

MEDIUM
