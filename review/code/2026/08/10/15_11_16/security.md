# 보안(Security) Review

## 리뷰 범위

- `.claude/tests/test_pnpm_workspace_action.py` — 셋업 액션의 `run:` 블록을 실제 bash 로 실행해 인자를 검증하는 하니스 테스트
- `.github/actions/pnpm-workspace/action.yml` — `pnpm install` 에 `--strict-peer-dependencies` 추가
- `plan/in-progress/deps-peer-gating-and-eslint10.md` — 위 변경의 배경/실측 기록 (문서, 실행 코드 없음)
- `pnpm-workspace.yaml` — `peerDependencyRules` 를 비워 두기로 한 결정과 근거를 남긴 주석 추가 (실제 YAML 키 추가 없음)

## 발견사항

- **[INFO]** `--strict-peer-dependencies` 도입은 OWASP A06(취약/오래된 컴포넌트) 방지에 기여하는 강화 조치
  - 위치: `.github/actions/pnpm-workspace/action.yml:82`
  - 상세: `pnpm install` 에 `--strict-peer-dependencies` 를 추가해, 선언된 peer 요구사항(예: `#1049` 에서 `eslint-plugin-unicorn` 이 요구한 `eslint>=10.4`)을 충족하지 못한 채 설치가 조용히(경고만 내고) 통과하던 사고 클래스를 CI 실패로 승격시켰다. 미충족 peer 는 종종 호환성이 검증되지 않은 조합을 그대로 프로덕션에 반입하는 경로가 될 수 있어, 이번 변경은 공급망/의존성 무결성 관점에서 순수하게 방어적이다.
  - 제안: (해당 없음 — 개선 사항으로 기록)

- **[INFO]** 셸 인젝션 회피 패턴이 기존 규율을 그대로 따름
  - 위치: `.github/actions/pnpm-workspace/action.yml:79-82`
  - 상세: `${{ inputs.filter }}` 를 `run:` 문자열에 직접 보간하지 않고 `env: FILTER: ${{ inputs.filter }}` → `run: pnpm install --frozen-lockfile --strict-peer-dependencies --filter "$FILTER"` 로 전달한다. 이번 diff 는 플래그만 추가했을 뿐 이 패턴을 훼손하지 않았고, `.claude/tests/test_pnpm_workspace_action.py::test_run_block_never_interpolates_expressions`(파일 상단 클래스 `WiringTest`)가 `${{` 문자열 부재를 계속 단언해 회귀를 막는다. 새로 인젝션 표면이 생기지 않았다.
  - 제안: (해당 없음 — 확인 사항으로 기록)

- **[INFO]** `pnpm-workspace.yaml` 의 `peerDependencyRules` 억제 규칙을 의도적으로 비워 둔 결정은 fail-open 회피 관점에서 타당
  - 위치: `pnpm-workspace.yaml:124-138`
  - 상세: 착수 근거였던 `nunjucks → chokidar` 미충족이 실측(2026-08-10)에서 이미 사라졌음을 확인했고, 존재하지 않는 문제에 대한 억제 규칙을 미리 넣지 않았다. 문서화된 논거대로 "막을 대상이 없는 억제는 죽은 설정이며 향후 진짜 미충족을 조용히 덮는(fail-open) 위험"을 피한 것으로, `--strict-peer-dependencies` 게이트의 보호 범위를 불필요하게 좁히지 않는 결정이다.
  - 제안: 향후 `peerDependencyRules` 항목을 추가할 때는 문서에 이미 명시된 대로 "왜 안전한가"에 대한 실측 근거(예: 코드 경로 도달 불가)를 함께 남기는 관행을 유지할 것.

- **[INFO]** 테스트 하니스가 리포지토리 자체 파일(action.yml 의 `run:` 블록)을 bash 로 실행하지만 신뢰 경계 밖 입력은 없음
  - 위치: `.claude/tests/test_pnpm_workspace_action.py` 함수 `run_install`
  - 상세: `subprocess.run(["bash", "-c", install_run_block()], ...)` 는 저장소 자신의 액션 정의를 실행하는 것으로, 외부/사용자 입력이 셸 명령 문자열 자체에 섞이지 않는다. `FILTER` 값은 테스트 코드 내 리터럴(`"scope with space..."`, `"sentinel*"` 등)이며 `env=` 로만 전달되어 셸 인젝션 벡터가 아니다. CI 러너 밖 환경에서만 실행되는 로컬 unit 테스트이므로 프로덕션 신뢰 경계에 영향이 없다.
  - 제안: (해당 없음 — 확인 사항으로 기록)

## 요약

이번 변경 묶음은 기능 추가라기보다 CI 의존성 게이팅 강화(`pnpm install --strict-peer-dependencies` 도입)와 그 배경을 남기는 문서/테스트 갱신이다. 인젝션 벡터, 하드코딩된 시크릿, 인증/인가 로직, 평문 전송, 에러 메시지 노출 등 전형적인 보안 취약점 패턴은 발견되지 않았다. 기존에 확립된 `env:` 경유 셸 인젝션 방어 패턴이 그대로 유지되며, 새로 추가된 로직(peer dependency strict 모드)은 오히려 의존성 공급망 무결성을 높이는 방향으로 작용한다. `pnpm-workspace.yaml` 의 `peerDependencyRules` 를 실측 근거 없이 채우지 않기로 한 결정도 fail-open 을 피하는 타당한 판단으로 문서화돼 있다. 전반적으로 보안 관점의 새로운 위험은 확인되지 않았다.

## 위험도

NONE
