STATUS=success

===REPORT_MARKDOWN_BELOW===

# 보안(Security) 코드 리뷰

## 리뷰 범위

이번 변경은 애플리케이션 코드가 아니라 CI 하니스 인프라다: 3개 워크플로(`backend-checks.yml`, `deps-security-checks.yml`, `frontend-checks.yml`)가 각자 복제해 갖고 있던 `changes` 잡(경로 관련성 판정)을 `workflow_call` 방식의 공유 reusable workflow `.github/workflows/_changed-paths.yml` 로 추출하고, 그 배선을 실행 레벨로 고정하는 테스트(`test_changed_paths_reusable.py`) 와 갱신된 계약 테스트(`test_required_check_skip_jobs.py`)가 추가됐다. `.claude/tests/README.md` 는 문서 갱신뿐이다.

## 발견사항

- **[INFO]** 서드파티/공식 GitHub Action 이 커밋 SHA 가 아닌 이동 가능한 태그로 고정됨
  - 위치: `.github/workflows/_changed-paths.yml:57` (`uses: actions/checkout@v7`), 및 각 호출 워크플로의 `pnpm/action-setup@v6.0.9`, `actions/setup-node@v7`, `actions/setup-python@v7`
  - 상세: `@v7`/`@v6.0.9` 같은 태그는 상류 저장소가 태그를 재지정(retag)하면 다른 코드를 실행할 수 있어 공급망 공격 표면이 된다. 다만 이는 이번 diff 가 새로 도입한 패턴이 아니라 기존 3개 워크플로에 이미 있던 참조를 한 곳(`_changed-paths.yml`)으로 옮긴 것뿐이라 이번 변경이 만든 신규 취약점은 아니다. 다만 3곳에 흩어져 있던 것이 1곳으로 합쳐졌으므로, 이번 기회에 SHA 고정으로 강화하면 3개 워크플로가 동시에 이득을 본다.
  - 제안: 여유가 있을 때 `uses: actions/checkout@<commit-sha> # v7` 형태로 커밋 SHA 고정 검토(선택 사항, 이번 PR 필수 아님).

## 확인한 긍정적 보안 관행 (참고용, 조치 불요)

- `_changed-paths.yml` 의 `detect` 스텝은 `github.event.*`/`inputs.pathspecs` 값을 `run:` 문자열에 `${{ }}` 로 직접 끼워 넣지 않고 전부 `env:` 로 전달한다. 코드 주석에도 "스크립트 인젝션 회피" 라고 명시돼 있고 실제로 그렇게 구현돼 있다 — GitHub Actions 의 대표적인 script-injection(CWE-94 계열) 패턴을 정확히 회피했다.
- 셸 블록은 `set -euo pipefail` + 배열(`FILTERED+=("$spec")`) + `"${FILTERED[@]}"` quoting 을 써서 word-splitting/글로브 인젝션 없이 안전하게 인자를 전달한다. `test_globs_are_not_expanded_by_the_shell` 이 이를 실행 레벨로 고정한다.
- 빈 pathspec 입력을 fail-closed(`exit 2`)로 처리한다 — 빈 인자가 git pathspec 에서 "모든 경로"로 해석되어 게이팅이 무력화(사실상 항상 `relevant=true` 이지만, 반대 방향인 무비판적 `relevant=false` 전면 스킵보다는 안전하다는 게 이 저장소의 기존 논리)되는 것을 막는다. 빈 값이면 즉시 실패해 조용한 오판정을 방지.
- `!= 'false'` 로 게이팅(양성 목록이 아니라 음성 배제) 하여, `changes` 잡이 실패/에러여도 실제 검사가 **돌아가는 쪽**(fail-safe)으로 떨어진다 — 보안 검사(`deps-security-checks.yml` 의 audit/override-floors 포함)가 판정 실패로 조용히 스킵되는 실패 모드를 구조적으로 배제한다.
- 트리거가 `pull_request_target` 이 아니라 `pull_request`(bare) 이므로, 포크에서 들어오는 PR 은 기본적으로 저장소 시크릿에 접근할 수 없고 `GITHUB_TOKEN` 도 읽기 전용으로 제한된다 — 신뢰되지 않는 코드를 체크아웃/실행하는 이 워크플로들에 적절한 트리거 선택이다.
- 각 호출 워크플로의 pathspec 목록에 자기 자신(`.github/workflows/backend-checks.yml` 등)과 공유 워크플로(`.github/workflows/_changed-paths.yml`)·판정 스크립트(`scripts/ci-paths-changed.sh`) 자신을 포함시켜, 판정 로직/트리거 정의가 바뀌어도 그 변경을 검증하는 워크플로 자체가 스킵되지 않도록 했다 — "가드가 자기 자신의 변경에 무감각해지는" 클래스(`harness-checks.yml` 이 과거 여섯 번 겪은 것과 동일 클래스)를 CI 트리거 레벨에서도 선제 차단.
- `test_changed_paths_reusable.py` 는 로컬 저장소 자신의 신뢰된 YAML 에서 `run:` 블록을 뽑아 bash 로 실행하는 테스트 전용 헬퍼(`run_with`)를 쓴다. 외부 입력이 아니라 저장소 자신의 소스를 대상으로 하므로 인젝션 표면이 아니다.
- 새 로직에서 하드코딩된 시크릿·API 키·자격증명은 발견되지 않았고, SQL/커맨드/경로 탐색 등 애플리케이션 레벨 인젝션 대상 표면 자체가 이번 변경에 없다(순수 CI 배선 + 테스트).

## 요약

이번 변경은 3개 CI 워크플로가 중복 보유하던 "경로 관련성 판정" 잡을 하나의 `workflow_call` reusable workflow 로 추출하는 순수 리팩터링이며, 새로운 사용자 입력 처리 경로나 인증/인가 로직을 도입하지 않는다. 오히려 `${{ }}` 직접 보간 대신 `env:` 를 통한 값 전달, 배열 quoting, 빈 입력 fail-closed, `!= 'false'` fail-safe 게이팅, `pull_request`(비-target) 트리거 유지 등 GitHub Actions 인젝션/데드락/무언 스킵 클래스에 대한 방어가 코드와 테스트 양쪽에 명시적으로 박혀 있다. 발견된 사항은 액션 버전이 SHA 가 아닌 태그로 고정된 것 하나뿐이며 이는 사전에 존재하던 패턴을 옮긴 것으로 이번 diff 가 새로 만든 리스크가 아니다.

## 위험도

NONE
