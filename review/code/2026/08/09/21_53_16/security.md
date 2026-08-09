# 보안(Security) 리뷰 결과

## 리뷰 범위

CI 인프라 리팩터 — pnpm workspace 셋업(3스텝: `pnpm/action-setup` + `actions/setup-node` +
`pnpm install --frozen-lockfile --filter`)을 신규 로컬 composite action
`.github/actions/pnpm-workspace/action.yml` 로 추출하고, 9개 잡(`backend-checks.yml` ×3,
`frontend-checks.yml`, `packages-checks.yml`, `spec-link-checks.yml`, `web-chat-checks.yml` ×3)이
`uses: ./.github/actions/pnpm-workspace` 로 호출하도록 전환. 부수적으로 harness 테스트
(`test_pnpm_workspace_action.py` 신설, `test_workflow_yaml_structure.py`/
`test_harness_checks_paths_coverage.py` 확장)와 plan 문서 갱신. 애플리케이션 코드(SQL/인증/암호화
경로) 변경은 없음 — CI/YAML/테스트 전용 diff.

### 발견사항

- **[INFO]** 셸 스크립트 인젝션 방어가 GitHub Actions 의 안전한 패턴(`env:` 경유)으로 올바르게
  구현되어 있고, 회귀를 막는 테스트까지 신설됨 — 취약점 아님, 긍정적으로 확인.
  - 위치: `.github/actions/pnpm-workspace/action.yml:69-73` (Install workspace 스텝),
    `.claude/tests/test_pnpm_workspace_action.py:148-159`
    (`test_run_block_never_interpolates_expressions`), `:161-168`
    (`test_the_filter_reaches_the_step_through_env`)
  - 상세: `filter` 입력을 `run:` 문자열에 `${{ inputs.filter }}` 로 직접 보간하지 않고
    `env: FILTER: ${{ inputs.filter }}` 로 넘긴 뒤 `run: pnpm install --frozen-lockfile --filter "$FILTER"`
    로 참조한다. `${{ }}` 를 `run:` 본문에 직접 삽입하면 그 값이 셸 스크립트 텍스트로 치환된
    "이후" 파싱되어 호출부가 넣은 문자열이 명령으로 실행될 수 있는 전형적인 GitHub Actions
    script-injection 벡터인데, env 경유 + 이중따옴표 참조는 그 값을 항상 opaque 데이터 인자로만
    취급해 이 클래스를 차단한다. 두 테스트가 이 불변식을 실행 기반으로 고정(`${{` 부재 단언 +
    `env.FILTER` 배선 단언)하고 있어 향후 회귀도 잡는다.
  - 제안: 없음(현 구현 유지). 다만 이 패턴을 이 저장소의 표준 관례로 `spec/conventions/` 또는
    액션 작성 가이드에 명문화해두면 향후 신규 composite action 작성 시 참조점이 된다(선택 사항).

- **[INFO]** 서드파티 GitHub Action 참조가 가변 버전 태그로 고정되어 있고, 추출로 인해 그 신뢰
  지점이 저장소 전역 9개 잡의 단일 소재지로 집중됨(공급망 리스크 blast radius 증가).
  - 위치: `.github/actions/pnpm-workspace/action.yml:53` (`uses: pnpm/action-setup@v6.0.9`),
    `.github/actions/pnpm-workspace/action.yml:55` (`uses: actions/setup-node@v7`)
  - 상세: 두 액션 모두 커밋 SHA 가 아니라 버전 태그로 핀되어 있다. 태그는 (특히 GitHub 공식
    조직이 아닌 `pnpm/action-setup` 처럼) 계정 탈취·의도치 않은 재태깅으로 이동 가능한 참조라
    "immutable pin" 보다 신뢰 경계가 넓다. 추출 전에는 이 참조가 워크플로마다 개별 사본으로
    복제돼 있었지만, 지금은 이 파일 하나가 9개 잡(대부분의 required-check 후보) 전체의 셋업
    체인을 결정한다 — 이 PR 의 자체 설계 문서(action.yml 헤더 주석, plan 문서)가 "설치 로직의
    파급이 뒤집혔다" 고 명시적으로 인지하고 있는 바로 그 축이 공급망 신뢰에도 동일하게 적용된다.
    이는 이 PR 이 새로 만든 취약점이 아니라 기존 관행(추출 전에도 태그 핀이었음)의 집중화이며,
    당장 익스플로잇 가능한 결함은 아니다.
  - 제안: (선택적 강화) 두 `uses:` 를 커밋 SHA 로 고정하고 주석에 대응 버전을 남기는 방식으로
    바꾸면 이 단일 파일이 9개 required-check 후보의 셋업 신뢰 루트가 된 것에 걸맞게 공급망
    표면을 좁힐 수 있다. 저장소 전역 관례(다른 워크플로들도 태그 핀)와 일관되므로 이 PR 단독
    스코프의 필수 수정 사항은 아니라고 판단, 후속 검토 항목으로만 남긴다.

- **[INFO]** `permissions:` 블록 비대칭(신규 편입 워크플로 4개 vs `harness-checks.yml` 만
  `contents: read` 명시)은 이 diff 가 만든 회귀가 아니며, plan 문서 자체에 이미 후속 항목으로
  기록되어 있어 별도 지적 불요.
  - 위치: `plan/in-progress/ci-required-check-skip-jobs.md` 하단 "INFO 1 — `permissions:`
    미선언 비대칭" 항목(작성자가 `git log -p` 로 회귀 아님을 확인, 후속으로 등재)
  - 상세: least-privilege 관점에서 유효한 관찰이지만 이번 diff 범위 밖(사전 존재 상태)이고
    이미 팀이 인지·기록한 상태라 중복 지적하지 않는다.

- **[INFO]** 신규 테스트(`test_pnpm_workspace_action.py`)가 `subprocess.run(["bash", "-c",
  install_run_block()], ...)` 로 저장소 자신의 `action.yml` 에서 읽은 `run:` 블록을 실행하지만,
  실행 대상이 신뢰된 저장소 파일(외부 입력 아님)이고 CI/테스트 하네스 목적에 부합하므로 인젝션
  이슈 아님.
  - 위치: `.claude/tests/test_pnpm_workspace_action.py:83-99` (`run_install`)
  - 상세: `pnpm` 스텁을 `tempfile.mkdtemp()` 로 만든 임시 디렉터리에 두고 PATH 선두에 붙여
    `bash -c`로 액션의 `run:` 스텝을 그대로 재현한다. 하드코딩된 필터 문자열만 넘기며 네트워크
    호출·비밀값 노출이 없다. 임시 디렉터리를 정리하지 않는 점은 리소스 누수이지 보안 결함은
    아니다.

- **[INFO]** 하드코딩된 시크릿·자격증명 없음. 이 diff 는 YAML(워크플로/액션)·Python 테스트·
  Markdown(README·plan)만 변경하며 인증/인가/암호화/에러 처리 로직 변경이 전무하다.

### 요약

이번 diff는 순수 CI 인프라 리팩터(중복 셋업 3스텝을 로컬 composite action으로 추출)와 그에
동반한 harness 테스트 확장이며, 애플리케이션 코드(SQL·인증·암호화·입력검증 경로)는 손대지
않는다. 가장 주의 깊게 봐야 할 지점 — composite action `run:` 블록에 신뢰 경계를 넘는 입력
(`inputs.filter`)이 `${{ }}` 직접 보간이 아니라 `env:` 경유로 전달되는지 — 은 올바르게 구현돼
있고, 실행 기반 테스트(`test_run_block_never_interpolates_expressions`,
`test_the_filter_reaches_the_step_through_env`)로 회귀까지 고정되어 있다. 서드파티 액션이
커밋 SHA 대신 버전 태그로 핀된 점은 추출로 인해 신뢰 지점이 9개 잡으로 집중된다는 점에서
공급망 리스크 표면이 개념적으로 넓어졌으나, 이는 이 diff가 새로 만든 결함이 아니라 저장소
전역의 기존 관행이 한 파일로 모인 결과이며 즉각적인 익스플로잇 경로는 없다. 하드코딩된
시크릿, 인젝션 취약점, 인증/인가 우회, 안전하지 않은 암호화·평문 전송, 민감정보 노출 에러
처리 등 다른 관점에서는 발견사항이 없다.

### 위험도

LOW
