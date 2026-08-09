# 보안(Security) 코드 리뷰

## 리뷰 범위

이번 변경 set 은 크게 두 갈래다.

1. **CI 인프라(required status check 데드락 해소)**: `.claude/tests/README.md`, `.claude/tests/test_ci_paths_changed.py`(신규), `.claude/tests/test_required_check_skip_jobs.py`(신규), `.claude/tests/test_workflow_yaml_structure.py`, `.github/workflows/deps-security-checks.yml`, `.github/workflows/frontend-checks.yml`, `.github/workflows/harness-checks.yml`, `scripts/ci-paths-changed.sh`(신규) — `on.pull_request.paths` 필터를 제거해 워크플로가 항상 실행되게 하고, `changes` 잡 + 신설 스크립트로 관련성을 판정해 각 잡의 **스텝만** `if:` 로 게이팅하는 구조.
2. **의존성 보안 패치(위 ①의 부수 효과로 발견)**: `codebase/channel-web-chat/package.json`, `codebase/frontend/package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `scripts/check-pnpm-security-config.py` — `dompurify` 3.4.12→3.4.13(GHSA-55q2-fjhq-7xh7), 전이 의존 `nanoid`에 `overrides: ^3.3.17`(GHSA-2v37-7h3g-55p8) 신설.

나머지(`plan/in-progress/*.md`, `review/code/2026/08/09/11_40_34/**`)는 작업 기록/이전 라운드 리뷰 산출물로 실행 코드가 아니다.

## 발견사항

- **[INFO]** GitHub Actions 스크립트 인젝션 클래스는 정석적으로 회피됨 (확인 사항, 결함 아님)
  - 위치: `.github/workflows/deps-security-checks.yml`(`changes` 잡의 `detect` 스텝 `env:`), `.github/workflows/frontend-checks.yml`(동일), `scripts/ci-paths-changed.sh` (BASE_SHA/HEAD_SHA 사용부)
  - 상세: `github.event.pull_request.base.sha`/`head.sha`/`github.event.before`/`after` 같은 이벤트 컨텍스트 값을 `run:` 블록 문자열에 `${{ }}` 로 직접 보간하지 않고 `env:` 매핑을 거쳐 셸 변수로 전달한다. 스크립트 내부에서도 `"$BASE_SHA"`, `"$HEAD_SHA"`, `"$MERGE_BASE"` 처럼 항상 큰따옴표로 인용해 `git merge-base`/`git diff --name-only ... -- "$@"` 에 넘긴다. 값 자체가 커밋 SHA(40자리 hex, GitHub 이 계산해 채움)라 임의 텍스트나 `--upload-pack=...` 같은 옵션 인젝션 형태로 대입될 수 없고, 설령 형식이 깨져도 인용된 위치이므로 워드 스플리팅/글로빙이 발생하지 않는다. `case "${GITHUB_EVENT_NAME:-}"`, `[[ "$BASE_SHA" =~ ^0+$ ]]` 등 나머지 셸 분기도 모두 인용·조건식 내부라 동일하게 안전하다.
  - 제안: 없음 — 현 구현 유지 권장.

- **[INFO]** 신설 `changes` 잡에 명시적 `permissions:` 블록 없음 (기존 관례, 이번 diff 가 새로 만든 갭 아님)
  - 위치: `.github/workflows/deps-security-checks.yml`(파일 전체 — `changes` 잡 포함), `.github/workflows/frontend-checks.yml`(동일)
  - 상세: 두 워크플로 모두 `permissions:` 키가 없어 리포지토리/조직 기본 `GITHUB_TOKEN` 권한을 그대로 상속한다. `pull_request_target` 이 아닌 `pull_request` 이벤트를 쓰므로 포크 PR 에서는 GitHub 이 강제로 read-only + 시크릿 미주입을 적용해 실질 위험은 낮고, `changes` 잡이 하는 일도 `actions/checkout` + 로컬 셸 스크립트뿐이라 토큰을 능동적으로 사용하지 않는다. 다만 이번 변경으로 이 잡이 (경로 무관하게) **모든 PR 에서 항상 실행**되도록 트리거 범위가 넓어졌으므로, 실행 빈도가 늘어난 만큼 최소 권한 명시의 가치도 함께 커졌다.
  - 제안: 여유가 있으면 `permissions: contents: read` 를 워크플로 최상위 또는 `changes`/각 잡에 명시. 이번 PR 의 핵심 스코프(스킵-잡 계약)와는 무관하므로 병합을 막을 사유는 아님.

- **[INFO]** 액션이 major 태그로 핀됨(SHA 핀 아님) — 저장소 전역 기존 관례, 이번 diff 가 새로 만든 문제 아님
  - 위치: `.github/workflows/deps-security-checks.yml`(`changes` 잡의 `actions/checkout@v7`), `.github/workflows/frontend-checks.yml`(동일)
  - 상세: `actions/checkout@v7` 등은 movable 태그라 태그가 재지정되면 공급망 공격 표면이 된다. 저장소 전역에 이미 동일 패턴이 광범위해 이 PR 이 새로 도입한 회귀는 아니다.
  - 제안: 전사적 SHA 핀 전환은 별도 트래킹(이번 PR 스코프 아님).

- **[INFO]** 의존성 보안 패치 자체는 정확·완결적 (긍정 확인)
  - 위치: `codebase/channel-web-chat/package.json:15`(`dompurify` 3.4.13), `codebase/frontend/package.json:47`(`dompurify` ^3.4.13), `pnpm-workspace.yaml`(`overrides.nanoid: ^3.3.17`), `scripts/check-pnpm-security-config.py:54`(`EXPECTED_OVERRIDES["nanoid"]`)
  - 상세: `dompurify` XSS 취약점(GHSA-55q2-fjhq-7xh7)이 patch 되는 3.4.13 으로 **두 소비처(channel-web-chat, frontend) 모두** 올라갔고(감사 결과가 한쪽만 보고했지만 lockfile 을 직접 대조해 나머지도 처리), `nanoid` 취약 버전(GHSA-2v37-7h3g-55p8, <3.3.17)이 전이 의존으로 고정된 `postcss@8.5.25 > nanoid@3.3.16` 경로에도 override 로 바닥을 걸어 두 경로 모두 안전 버전으로 수렴시켰다. `pnpm-workspace.yaml` 의 override 와 `check-pnpm-security-config.py` 의 `EXPECTED_OVERRIDES`(config-guard 잡이 검증)가 동기화되어 있어, 이후 누군가 override 를 지워도 CI 가 잡는다.
  - 제안: 없음.

- **[INFO]** fail-safe 방향이 보안 검사 실행을 축소하지 않음 (구조적 확인)
  - 위치: `scripts/ci-paths-changed.sh`(4개 fail-safe 분기 — schedule/workflow_dispatch, SHA 부재, merge-base 실패, git diff 실패), `.github/workflows/deps-security-checks.yml`(`audit`/`override-floors`/`config-guard` 잡의 `if: needs.changes.outputs.relevant != 'false'` 게이팅)
  - 상세: 판정이 불확실한 모든 경로가 `relevant=true`(검사를 **돈다**)로 수렴하고, 스텝 게이팅도 `== 'true'` 가 아니라 `!= 'false'` 로 되어 있어 `changes` 잡이 실패해도(출력이 빈 문자열) 실제 보안 검사(`pnpm audit`, `check-override-floors.py`, `check-pnpm-security-config.py`)는 여전히 돈다. 즉 이번 CI 배선 변경이 보안 게이트를 조용히 우회 가능하게 만드는 방향으로 뒤집힐 여지가 낮다. `.claude/tests/test_required_check_skip_jobs.py`/`test_ci_paths_changed.py` 가 이 방향을 뮤테이션 테스트로 고정하고 있다.
  - 제안: 없음.

인젝션(SQL/커맨드/경로), 하드코딩 시크릿, 인증/인가 우회, 세션 관리, 안전하지 않은 암호화/해시, 평문 전송, 민감정보 노출 에러 처리 관점에서는 해당 사항이 없었다 — 이번 diff 는 애플리케이션 런타임 코드(API/DB/인증 경로)를 건드리지 않고 CI 워크플로/하네스 테스트/의존성 버전 핀만 다룬다. `pnpm-lock.yaml` 변경분(sha512 integrity, 표준 npm 레지스트리 resolution, `libc:` 메타데이터 필드의 존재/부재 진동)도 검토했으며 비정상 registry URL·평문 http·의심스러운 tarball 참조는 없었다.

## 요약

이번 변경은 애플리케이션 코드가 아닌 GitHub Actions 워크플로 트리거 구조(paths 필터 → skip-job 패턴)와 그 회귀 방지 하네스 테스트, 그리고 부수적으로 발견된 `dompurify`/`nanoid` 의존성 취약점 패치로 구성된다. 이벤트 컨텍스트 값을 `env:` 간접화 + 인용을 통해 다루어 GitHub Actions 의 대표적 스크립트 인젝션 클래스를 정확히 회피했고, fail-safe 설계가 일관되게 "불확실하면 보안 검사를 돈다" 방향이라 이번 CI 재구조화가 보안 게이트 커버리지를 축소하지 않는다. 의존성 패치도 두 소비처·override·EXPECTED_OVERRIDES 세 지점이 정확히 동기화돼 있어 완결적이다. Critical/Warning 급 결함은 발견되지 않았으며, 최소 권한 `permissions:` 블록 부재와 액션 태그 핀(SHA 미고정)은 이전 리뷰 라운드부터 이어지는 저장소 전역의 기존 관례이자 낮은 실질 위험의 INFO 수준 개선 여지로만 기록한다.

## 위험도
NONE
