STATUS=success side_effect review complete — 2 INFO, 0 WARNING/CRITICAL
===REPORT_MARKDOWN_BELOW===
# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 신규 테스트 헬퍼가 임시 디렉터리를 정리하지 않는다 (파일시스템 부작용)
  - 위치: `.claude/tests/test_pnpm_workspace_action.py:89` (`run_install()` 내부 `tmp = tempfile.mkdtemp()`)
  - 상세: `run_install()` 은 `InstallCommandTest` 의 4개 테스트(`test_pnpm_receives_frozen_lockfile_and_the_filter`, `test_the_filter_arrives_as_one_argument`, `test_a_scoped_package_name_survives_intact`, `test_the_filter_is_not_glob_expanded`)에서 각각 호출되는데, `tempfile.mkdtemp()` 로 만든 디렉터리(+ 그 안의 실행 가능 `pnpm` 스텁 파일)를 `shutil.rmtree()` 나 `tempfile.TemporaryDirectory()` 컨텍스트 매니저로 정리하지 않는다. `python3 -m unittest discover` 를 반복 실행하는 로컬 개발 환경에서는 시스템 임시 폴더에 디렉터리가 계속 누적된다. 다만 이 코드가 그대로 베낀 패턴은 이 저장소에 이미 존재한다 — `.claude/tests/test_changed_paths_reusable.py:57` 의 `run_with()` 도 동일하게 `tempfile.mkdtemp()` 를 정리 없이 쓴다. 즉 이번 PR 이 새로 도입한 결함이 아니라 기존 관례를 그대로 따른 것이다. CI 러너는 매 잡마다 폐기되는 환경이라 실질 영향은 낮지만, 로컬에서 harness 스위트를 자주 돌리는 워크플로에서는 조용히 디스크를 소모한다.
  - 제안: 새 파일이므로 `tempfile.TemporaryDirectory()` 컨텍스트 매니저로 바꿔 정리 책임을 명시적으로 지우는 편이 좋다(기존 패턴을 그대로 답습하기보다 이번 기회에 두 파일 모두 개선하는 것도 고려할 만하다). 급하지 않으면 후속 항목으로 남겨도 무방.

- **[INFO]** 셋업 3스텝 → composite action 1스텝 통합이 실패 파급 범위(blast radius)를 의도적으로 넓혔다
  - 위치: `.github/actions/pnpm-workspace/action.yml` (`runs.steps`, 특히 68~73줄 `Install workspace` 스텝) — 소비처는 `.github/workflows/backend-checks.yml`(79-82, 99-102, 121-124), `frontend-checks.yml`(60-65), `packages-checks.yml`(82-85), `spec-link-checks.yml`(68-71), `web-chat-checks.yml`(59-62, 88-91, 123-126) 등 9개 잡
  - 상세: 종전에는 `pnpm install --frozen-lockfile --filter "<scope>"` 한 줄이 워크플로마다 독립적으로 존재해 한 워크플로의 install 줄이 망가져도 그 워크플로만 영향을 받았다. 이번 변경으로 그 한 줄이 저장소 전체에서 이 액션 파일 하나뿐이 되어, 액션이 깨지면 9개 잡(사실상 모든 required-check 후보)이 동시에 영향을 받는 단일 장애점(single point of failure) 이 됐다. 이것은 명시적으로 의도된 설계이고(action.yml 헤더 주석·plan 문서에 근거가 적혀 있음), `test_pnpm_workspace_action.py`(실행 검증 + 뮤테이션 13/13 RED)와 `test_workflow_yaml_structure.py` 의 구조 검사 확장으로 상당히 촘촘하게 상쇄돼 있어 결함으로 보긴 어렵다. 다만 "의도치 않은 공유 상태 변경" 관점에서 이 PR 의 가장 큰 구조적 변화이므로 리뷰 기록으로 남긴다.
  - 제안: 별도 조치 불필요 — 이미 `ConsumerBindingTest`(소비처 8개 이상, 게이팅 일치, pathspec 등재)와 구조 검사 확장으로 완화돼 있음을 확인했다. 후속 셋업 변경 시 이 단일 지점의 파급을 계속 의식할 것.

## 확인했으나 문제 없음

- **환경 변수**: 액션의 `FILTER` env 는 `Install workspace` 스텝에만 스코프돼 있고 `${{ inputs.filter }}` 를 `run:` 문자열에 직접 보간하지 않는다(injection 회피, `test_run_block_never_interpolates_expressions`/`test_the_filter_reaches_the_step_through_env` 로 고정). job/workflow 레벨 env 오염 없음.
- **게이팅 붕괴 여부**: 호출부의 `uses: ./.github/actions/pnpm-workspace` 스텝에 붙는 단일 `if: needs.changes.outputs.relevant != 'false'` 는 GitHub Actions 의미상 composite action 내부의 모든 스텝을 함께 스킵시킨다 — 종전 3스텝 개별 게이팅과 동등하며 오히려 "하나만 빠뜨리는" 회귀 가능성을 구조적으로 제거했다.
- **checkout 순서**: 로컬 composite action 은 `uses: ./.github/actions/...` 해석에 체크아웃이 선행돼야 하는데, 확인한 모든 소비 워크플로에서 `actions/checkout@v7` 스텝이 액션 호출 직전에 유지돼 있다.
- **네트워크 호출**: `pnpm/action-setup@v6.0.9`·`actions/setup-node@v7` 는 종전과 동일한 액션·버전으로, 새 외부 호출이 추가되지 않았다(집중만 됐다).
- **캐시 키 드리프트**: `node-version: '24'`·`cache: 'pnpm'`·`cache-dependency-path: pnpm-lock.yaml` 값이 추출 전후 정확히 일치(`test_toolchain_pins_did_not_drift_in_the_extraction` 로 고정).
- **시그니처/인터페이스 변경**: `.github/actions/pnpm-workspace` 는 이 PR 에서 신설되는 내부 전용 인터페이스이고 외부 소비자가 없어 기존 호출자에 대한 breaking change 가 아니다. `filter` 입력이 `required: true` 라 호출부가 누락하면 YAML 파싱 단계에서 fail-closed(빈 `--filter` 로 전체 워크스페이스가 설치되는 것을 방지).
- **테스트 파일 전역 상수**: `REPO_ROOT`/`ACTION`/`WORKFLOWS`/`USES_PATH`/`STUB` 은 모두 읽기 전용 모듈 상수로, 다른 테스트 모듈의 전역 상태를 변경하지 않는다. `import _harness` 의 `sys.path` 부작용은 주석으로 명시적으로 표시돼 있고 이 저장소 테스트 스위트 전반의 기존 관례다.

## 요약

이번 변경은 CI 워크플로들이 복제하던 pnpm 셋업 3스텝을 composite action 하나로 추출한 리팩터링으로, 부작용 관점에서 가장 눈에 띄는 것은 (1) 신규 테스트 헬퍼의 임시 디렉터리 미정리(기존 관례를 답습한 경미한 파일시스템 부작용)와 (2) install 로직이 단일 지점으로 집중되며 실패 파급 범위가 넓어진 구조적 변화(의도적이며 실행 검증 테스트·뮤테이션·소비처 결속 테스트로 충분히 상쇄됨)뿐이다. 환경 변수 스코프, 게이팅 의미론, checkout 순서, 캐시 키, 외부 액션 버전 등 핵심 회귀 위험 지점은 모두 diff 와 신규 테스트로 명시적으로 고정돼 있어 의도치 않은 부작용은 발견되지 않았다.

## 위험도

LOW
