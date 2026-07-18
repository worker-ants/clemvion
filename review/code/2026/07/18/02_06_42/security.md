# 보안(Security) 리뷰 — harness-guard-followups (bootstrap / mermaid-lint 가드 / CI)

## 리뷰 대상

1. `.claude/tools/bootstrap-session.sh`
2. `.claude/hooks/lint_mermaid_posttooluse.py`
3. `.claude/hooks/_lib/mermaid_lint_ready.py`
4. `.githooks/pre-commit`
5. `.github/workflows/harness-checks.yml`
6. `.claude/tests/test_bootstrap_mermaid_install.py`
7. `.claude/tests/test_mermaid_lint_ready.py`

이 7개 파일은 로컬 개발 하네스(SessionStart bootstrap, git pre-commit hook, PostToolUse hook, 이들이 공유하는 readiness SoT, harness 자체를 지키는 CI, 그 테스트)로 외부 네트워크 요청을 받는 서비스가 아니며 사용자 데이터를 다루지 않는다. 리뷰는 이 파일들이 로컬 개발자 세션·CI 환경에서 갖는 신뢰 경계를 기준으로 수행했다.

## 발견사항

- **[INFO]** CI 워크플로에 명시적 최소권한 `permissions` 블록 부재
  - 위치: `.github/workflows/harness-checks.yml` (전체 — `permissions:` 키 없음)
  - 상세: `pull_request` 트리거 job 에 `permissions:` 블록이 없어 `GITHUB_TOKEN` 이 리포지토리/조직 기본 권한을 그대로 상속한다. 포크 PR 은 GitHub 이 자동으로 read-only 토큰을 강제하므로 실질 위험은 낮지만, 조직 기본값이 바뀌거나 이 워크플로에 step 이 추가될 때 과다 권한이 조용히 상속될 여지가 있다. 이 워크플로는 `${{ github.event.* }}` 를 `run:` 스텝에 직접 보간하지 않으므로(흔한 Actions script-injection 패턴) 그 계열 취약점은 없음을 확인했다.
  - 제안: `permissions: contents: read` 를 워크플로 최상단에 명시(least privilege 하드닝, 필수는 아님).

- **[INFO]** GitHub Actions 를 major-version 태그로 고정(커밋 SHA pin 아님)
  - 위치: `.github/workflows/harness-checks.yml:598,602,612` (`actions/checkout@v7`, `actions/setup-python@v6`, `actions/setup-node@v4`)
  - 상세: 태그는 재지정 가능한 참조라 공급망 이론상 위험이 있으나, 전부 GitHub 1st-party action 이라 실질 위험은 낮다.
  - 제안: 필요 시 커밋 SHA pin 전환 고려. 현재 리스크 수준에서 필수 아님.

- **[INFO]** `npm install --no-fund --no-audit --silent` 로 설치 시 취약점 감사 생략
  - 위치: `.claude/tools/bootstrap-session.sh:167`
  - 상세: `--no-audit` 는 설치 시점의 npm 취약점 경고를 억제한다. mermaid-lint 는 로컬 개발 전용 린트 도구(프로덕션 런타임 아님, 외부 입력을 처리하지 않음)라 blast radius 는 제한적이지만, 이 트리에 알려진 취약점이 있어도 어떤 개발자에게도 설치 시점에 표시되지 않는다.
  - 제안: 별도 주기적 job/`npm audit` 로 이 도구 트리를 감사할 것을 권장(이번 diff 를 막을 사안은 아님).

- **[INFO]** `lint_mermaid_posttooluse.py:_target_path` 가 예상 밖 payload 형태에서 미포착 예외 가능
  - 위치: `.claude/hooks/lint_mermaid_posttooluse.py:294-296`
  - 상세: `payload.get("tool_input") or payload.get("input") or {}` 의 값이 dict 가 아닌 truthy 값(예: 문자열)이면 뒤이은 `ti.get(...)` 에서 `AttributeError` 로 크래시하며 이를 감싸는 try/except 가 없다. 다만 이 스크립트 자신의 계약(파일 docstring)상 "0/2 이외의 임의 종료 코드는 런타임 오류로 간주해 non-blocking" 이므로 실제 영향은 hook 이 조용히 스킵되는 것뿐이며, 공격자가 얻는 이득이 없다(payload 는 Claude Code 하네스 자신이 구성하는 값이라 외부 신뢰 경계를 넘지 않는다).
  - 제안: `isinstance(ti, dict)` 가드를 추가하면 견고성은 개선되나 보안 우선순위는 낮음.

- **[INFO]** PID 재사용(ABA) 기반 lock steal 오탐 가능성 — 코드 내 이미 문서화·추적됨
  - 위치: `.claude/tools/bootstrap-session.sh:124-133` (`_lock_is_dead` 상단 주석, "W12, not fixed here")
  - 상세: `kill -0 "$owner"` 만으로 생존을 판정하므로 실제 소유자가 죽고 그 PID 가 무관한 프로세스에 재사용되면 steal 이 막힌다(lock 이 계속 wedge). 이는 반대 방향(죽은 소유자를 산 것으로 오판)이며 실패 방향이 세이프(설치가 중복/손상되지 않고 그냥 스킵됨)하다는 점, 로컬 단일 사용자 환경이라 공격자가 이 타이밍을 통제할 유효한 시나리오가 없다는 점에서 보안 취약점이라기보다는 신뢰성 이슈다. 코드 자체가 이미 이 한계를 인지·추적(`plan/in-progress/harness-guard-followups.md §A`) 하고 있어 새로운 발견이 아님을 확인차 기록.
  - 제안: 없음(이미 추적 중, fails safe).

## 확인된 견고한 지점 (긍정 관찰)

- 모든 `subprocess`/`node` 호출이 리스트 형태(`shell=True` 미사용, `eval` 미사용)로 구성되어 있어 파일 경로·payload 값에 셸 메타문자가 섞여도 인젝션이 발생하지 않는다 (`lint_mermaid_posttooluse.py`, 두 테스트 파일 전체).
- `.githooks/pre-commit` 의 스테이지 파일 목록은 `git diff --cached --name-only -z` + NUL 구분 읽기로 처리되어, 공백/개행이 포함된 파일명에도 word-splitting 인젝션이 없다.
- 하드코딩된 API 키/비밀번호/토큰/인증서는 7개 파일 전체에서 발견되지 않음(패턴 검색 확인).
- `_NODE_TIMEOUT`(20s), `timeout=5.0`(git rev-parse), `timeout=60`(테스트) 등 모든 서브프로세스 호출에 타임아웃이 걸려 있어 행(hang)에 의한 세션 잠금(DoS) 이 방지된다.
- 에러 메시지는 일반적인 문구만 stderr 에 출력하며 민감 정보(경로 외의 내부 상태·크리덴셜)를 노출하지 않는다. 모듈 import 실패 시의 `traceback.print_exc` 는 로컬 stderr 로만 향하고 원격에 노출되지 않는다.
- 테스트 파일들은 `tempfile.mkdtemp()`(모드 0700, 소유자 전용) 안에서만 동작해 다른 로컬 사용자에 의한 심볼릭 링크 공격 표면이 없다.
- `BYPASS_DEFAULT_BRANCH_GUARD=1`, `MERMAID_LINT_TOOL_DIR` 등 env 오버라이드는 전부 로컬 세션 범위이며, 이를 설정할 수 있는 행위자는 이미 로컬 셸 실행 권한을 가진 자이므로 별도의 권한 상승 경로를 열지 않는다. git hook 의 fail-open 설계(브랜치 가드 포함)는 이미 `--no-verify` 로 우회 가능한 클라이언트 사이드 계층임을 주석이 명확히 인지하고 있어 새로운 보안 경계 약화가 아니다.
- SQL/LDAP 인젝션, XSS, 평문 자격증명 전송, 안전하지 않은 해시/암호화 사용은 해당 없음(이 7개 파일 모두 DB·웹 렌더링·암호화 로직을 포함하지 않음).

## 요약

이번 변경분은 로컬 개발 하네스(세션 부트스트랩의 npm install 동시성 잠금, mermaid-lint 준비상태 공유 SoT, git pre-commit/PostToolUse 가드, 이를 검증하는 CI·테스트)로, 외부 신뢰 경계를 넘는 입력을 처리하지 않으며 전 파일에서 인젝션 벡터(subprocess 리스트 호출·NUL 구분 파일명 처리)·하드코딩 시크릿·안전하지 않은 암호화·에러 메시지 정보노출 문제가 발견되지 않았다. 지적한 항목은 모두 INFO 수준으로, CI 워크플로의 명시적 최소권한 선언 부재와 Actions 태그 pin(1st-party라 실질 위험 낮음), `npm install --no-audit` 로 인한 설치 시점 감사 생략, 그리고 코드 스스로 이미 문서화·추적 중인 PID 재사용 lock-steal 엣지케이스 정도이며, 어느 것도 즉각적인 조치나 차단을 요하지 않는다.

## 위험도

LOW
