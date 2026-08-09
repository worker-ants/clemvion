# 요구사항(Requirement) 리뷰 — pnpm-workspace composite action 추출

## 발견사항

- **[INFO]** `test_pnpm_workspace_action.py` 모듈 docstring 과 `.claude/tests/README.md` 카탈로그 행이
  실제 소비 잡 수를 과소 기술한다 — "8개 잡" / "eight jobs" 라고 쓰지만 실측 소비처는 **9개**다.
  - 위치: `.claude/tests/test_pnpm_workspace_action.py:1` (모듈 docstring 첫 줄
    `"""...action.yml — 8개 잡이 공유하는 셋업 액션.`), 같은 파일 `:218` 근방
    (`test_there_are_consumers` docstring "8개 잡을 위해 만든..."), `.claude/tests/README.md:52`
    (`the pnpm setup **eight jobs** share since the extraction`)
  - 상세: `grep -rn "uses: ./.github/actions/pnpm-workspace" .github/workflows/*.yml` 로 실측하면
    `backend-checks.yml`(lint·unit·typecheck-ratchet 3잡) · `frontend-checks.yml`(1) ·
    `packages-checks.yml`(1) · `spec-link-checks.yml`(1) · `web-chat-checks.yml`(3) = **9곳**이다.
    반면 `.github/actions/pnpm-workspace/action.yml` 자신의 헤더 주석과
    `plan/in-progress/ci-required-check-skip-jobs.md` 는 정확히 "9개 잡이 `uses:` 로 호출한다
    (바이트 동일 8 + backend `typecheck-ratchet`)" 라고 올바르게 적어 두 소스가 서로 다른 숫자를
    말한다. 기능적으로는 무해하다 — `ConsumerBindingTest.test_there_are_consumers` 는
    `assertGreaterEqual(len(self.consumers()), 8, ...)` 로 **최솟값(floor)** 만 걸어서 실제
    9개에서도 통과하고 vacuous 하지도 않다(로컬 재실행: 64 passed / 469 subtests). 다만 이 PR 이
    스스로 강조하는 원칙("문자열 존재가 아니라 실제 인자로 고정" · "요약 숫자로 판단하지 말 것")과
    같은 결의 정밀성 기준을 이 두 서술 자체가 못 지킨 자리다.
  - 제안: 두 곳의 "8개 잡" 표현을 "9개 잡(그중 8개는 `--filter` 인자만 다른 바이트 동일 형태)"
    또는 action.yml 헤더와 동일한 문구로 정정. 코드/테스트 로직 변경은 불필요.

## 확인한 사항 (문제 없음)

- `.github/actions/pnpm-workspace/action.yml`: `filter` input `required: true`, `env:` 경유로만
  `${{ inputs.filter }}` 을 셸에 전달(`run:` 문자열 직접 보간 없음 — 인젝션 방지),
  `--frozen-lockfile` 유지, `shell: bash` 명시, checkout 은 호출부 책임으로 위임 — 문서화된
  설계와 실제 YAML 이 정확히 일치한다.
- `test_pnpm_workspace_action.py`: 실제 `run:` 블록을 bash 서브프로세스로 실행해 `pnpm` 스텁이
  받은 `argv` 를 검증(문자열 grep 이 아니라 "받는 쪽 산출물" 검증) — `InstallCommandTest`
  4종(고정 인자 · 공백 포함 필터 1-arg 보존 · 스코프 패키지명 보존 · glob 미확장)과
  `WiringTest` 5종(required input · `${{` 미삽입 · env 경유 · 툴체인 핀 · `shell:` 존재)이 모두
  실측 통과.
- `ConsumerBindingTest`: 소비처(9곳) 전원이 `if: needs.changes.outputs.relevant != 'false'` 로
  정확히 게이팅되어 있고(`assertEqual` 로 문자열 exact match), 5개 소비 워크플로
  (`backend-checks.yml`·`frontend-checks.yml`·`packages-checks.yml`·`spec-link-checks.yml`·
  `web-chat-checks.yml`) 모두 자기 `changes` 잡 `pathspecs` 에
  `.github/actions/pnpm-workspace/action.yml` 을 새로 등재했다 — grep 으로 누락 없음을 확인.
  `deps-security-checks.yml` 의 `audit`/`override-floors` 두 잡은 `pnpm install` 자체를 하지
  않는 캐시-없는 `setup-node` 형태라 액션 대상에서 제외된 것이 맞다(action.yml 헤더의 "나머지
  5개 발산" 분류와 일치, 실측 확인).
- `test_workflow_yaml_structure.py`: `_steps()` 확장이 `runs.steps`(composite) 를 함께 순회해
  중복 키·`run`/`uses` 정확히 하나·`continue-on-error` 삼킴 금지 세 검사가 action.yml 내부까지
  실제로 미친다(로컬 실행으로 확인). 레지스트리 계열 테스트(`_PULL_REQUEST_KEYS` 등)는 의도대로
  워크플로 전용으로 남아 있어 action.yml 과 충돌하지 않는다. `_action_files()` 바닥 단언
  (`assertTrue(self.action_files, ...)`) 도 존재해 확장 자체의 vacuity 를 막는다.
- `test_harness_checks_paths_coverage.py`: 신규 `KNOWN_COVERAGE_DEPENDENCIES[".github/actions/**"]`
  항목이 실제로 `.github/actions/pnpm-workspace/action.yml` 을 (a) guarded target 으로 추출하고
  (b) `.github/workflows/**` 로는 커버되지 않으며(형제 디렉터리) (c) `.github/actions/**` 필터를
  제거하면 uncovered 로 떨어짐을 `test_each_historical_leak_is_load_bearing` 이 실측으로
  증명한다. `harness-checks.yml` 의 `changes.pathspecs` 에도 `.github/actions/**` 가 실제로
  추가돼 있어 순환이 닫힌다.
- 마이그레이션된 5개 워크플로에서 옛 3단계(`pnpm/action-setup` + `actions/setup-node` +
  `Install ... workspace`)가 잔존 없이 완전히 제거됐음을 grep 으로 확인(중복/누락 없음).
- 관련 `spec/` 문서는 없다(이 변경은 `.claude/`/`.github/` 하네스·CI 인프라이며 product spec
  대상이 아님) — 요구사항 검토 항목 9는 해당 없음(INFO 로도 별도 기재하지 않음, 프로젝트 관례상
  CI 배선은 `PROJECT.md`/plan 문서가 SoT).
- `plan/in-progress/backend-lint-gate-broken-on-main.md`, `ci-required-check-skip-jobs.md` 의
  체크박스·서술은 실제 커밋(`402063c79`, `6ff838ece`)과 일치하고 로컬 테스트 실행 결과와도
  부합한다.

## 요약

`.github/actions/pnpm-workspace/action.yml` composite action 추출과 이를 지키는 3종 하네스
가드(`test_pnpm_workspace_action.py` 실행 검증, `test_workflow_yaml_structure.py` 구조 검사
범위 확장, `test_harness_checks_paths_coverage.py` 커버리지 등재)는 의도한 기능(pnpm 설치
보일러플레이트 단일화 + 그 이동이 만든 가드 시야 사각지대 보상)을 빠짐없이 구현하고 있으며,
9개 소비 워크플로의 게이팅·pathspec 등재·인자 전달(env 경유, 인젝션 방지)이 모두 실측·로컬
테스트 통과로 뒷받침된다. 유일한 흠은 문서 정밀도 수준의 것으로, 테스트 파일 자체 docstring 과
README 카탈로그가 실제 소비 잡 수(9)를 "8개"로 과소 서술하는 자리가 두 곳 있으나 테스트 로직·
기능에는 영향이 없다(floor assertion 이라 vacuous 하지 않음).

## 위험도

LOW
