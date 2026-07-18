# Security Review — mermaid-lint 도구/훅 배선 (SessionStart bootstrap, PostToolUse hook, pre-commit hook)

## 스코프 및 전제

리뷰 대상 6개 파일은 로컬 git hook / Claude Code hook / 세션 부트스트랩 스크립트 및 그 테스트로,
모두 **단일 개발자(또는 신뢰된 팀)의 로컬 워크스테이션에서, 네트워크 요청 없이** 동작하는
devops 성격의 도구다. DB 쿼리, HTTP 엔드포인트, 사용자 인증 세션, 웹 렌더링이 없어 SQL
인젝션·XSS·LDAP 인젝션·CSRF 등 고전적 웹 OWASP 카테고리는 해당 표면 자체가 없다. 따라서
아래 발견사항은 "로컬 신뢰 경계 내 코드 실행 도구"라는 전제 위에서 커맨드 인젝션, 공급망
(supply-chain) RCE, 시크릿 하드코딩, 에러 정보 노출 위주로 평가했다.

## 발견사항

- **[WARNING]** 버전관리된 git hook 자동활성화 = 공급망 RCE 표면
  - 위치: `.claude/tools/bootstrap-session.sh` (`git -C "$main_root" config core.hooksPath .githooks`, 책임 1), `.githooks/pre-commit` 전체
  - 상세: SessionStart 시점에 사용자 확인 없이 저장소의 `core.hooksPath` 를 버전관리된 `.githooks` 로 자동 전환한다. 이후 그 워크트리에서 발생하는 모든 `git commit` 은 `.githooks/pre-commit` → `.claude/hooks/_lib/branch_guard.py` / `.claude/tools/mermaid-lint/lint-mermaid.mjs` 를 자동 실행한다. 이 파일들(또는 `npm install` 로 설치되는 mermaid-lint 의 전이 의존성) 중 하나라도 악의적 커밋/PR 로 오염되면, 그 다음 세션 시작이나 커밋 시점에 개발자·에이전트 머신에서 임의 코드가 조용히 실행되는 경로가 열린다. "훅이 자동으로 켜지게 만든다"는 기능 자체가 만드는 구조적 trade-off이며 이번 diff 가 새로 만든 버그는 아니지만, 이런 자동화가 늘어날수록(이번 PR 처럼) 그 표면도 함께 넓어지므로 의식적으로 기록해 둘 필요가 있다.
  - 제안: `main` 브랜치 보호(필수 리뷰) 가 이 경로의 유일한 방어선임을 문서화하고, `.githooks/**`·`.claude/hooks/_lib/branch_guard.py`·`.claude/tools/mermaid-lint/**` 변경에는 추가 검토를 요구하는 CODEOWNERS 규칙을 고려.

- **[INFO]** `npm install --no-audit` 로 의존성 취약점 감사 생략
  - 위치: `.claude/tools/bootstrap-session.sh:367` — `npm install --no-fund --no-audit --silent`
  - 상세: SessionStart 마다 무인으로 실행되는 유일한 설치 지점에서 `--no-audit` 을 명시해 npm 의 known-vulnerability 감사를 건너뛴다. mermaid-lint 툴의 의존성 트리에 알려진 취약점이 새로 생겨도 이 설치 시점에는 아무 신호가 없다.
  - 제안: CI 또는 주기적 job 에서 별도로 `npm audit`(혹은 Dependabot/Snyk 류) 를 `.claude/tools/mermaid-lint` 에 대해 실행. 재현성이 목적이라면 `npm install` 대신 `npm ci`(lockfile 불일치 시 실패, lockfile 변경 없음)로 바꾸는 것도 함께 검토할 가치가 있다.

- **[INFO]** 환경변수 오버라이드가 실행 대상 코드 경로를 바꿀 수 있음
  - 위치: `lint_mermaid_posttooluse.py:_resolve_tool_dir`(`MERMAID_LINT_TOOL_DIR`), `.githooks/pre-commit:481`(동일 변수), `bootstrap-session.sh`(`MERMAID_INSTALL_LOCK_GRACE_SEC`/`MERMAID_INSTALL_RETRY_SEC`)
  - 상세: `MERMAID_LINT_TOOL_DIR` 이 가리키는 디렉터리의 `lint-mermaid.mjs` 는 검증 없이 `node` 로 그대로 실행된다. 테스트/특수 레이아웃을 위한 의도된 오버라이드로 보이며, 공격자가 이미 세션 환경변수를 통제할 수 있어야만 의미 있는 경로라 실질 위험은 낮다.
  - 제안: 별도 코드 수정은 불필요. 다만 이 변수들이 외부 PR 이 주입 가능한 CI 워크플로 env 로 흘러들지 않도록 문서에 한 줄 명시 권장.

- **[INFO]** stdin/파일 읽기에 크기 상한 없음(이론적 DoS)
  - 위치: `lint_mermaid_posttooluse.py:_read_payload`(`sys.stdin.read()`) 및 `main()`의 대상 markdown 파일 `fh.read()`
  - 상세: 페이로드·대상 파일 크기 상한이 없어 매우 큰 입력이 주어지면 메모리를 소모할 수 있다. 다만 이 hook 은 harness 자신이 로컬로만 호출하므로 원격 공격 표면이 아니고, 실질 위험은 낮다.
  - 제안: 조치 불필요(로컬 신뢰 경계 내). 우려되면 `raw`/`content` 길이 상한만 방어적으로 추가.

- **참고(문제 아님) — subprocess 호출 전수가 커맨드 인젝션에 안전함**: 6개 파일의 모든 `subprocess.run`/`Popen` 호출이 list-형 argv 를 사용하고 `shell=True` 를 쓰지 않아, 파일 경로·PID·env 값에 셸 메타문자가 섞여도 인젝션으로 이어지지 않는다. `.githooks/pre-commit` 은 `git diff --cached --name-only --diff-filter=ACM -z` 의 NUL-구분 출력을 사용해 공백·개행이 포함된 파일명도 안전하게 처리한다. `bootstrap-session.sh` 의 lock owner PID 검증도 `case "$owner" in ''|*[!0-9]*) ... ;; *) kill -0 "$owner" ;; esac` 패턴으로 순수 숫자만 `kill -0` 로 넘겨 인젝션 여지가 없다.

## 확인했으나 해당 없음(negative findings)

- **하드코딩된 시크릿**: API 키·비밀번호·토큰·인증서 등 6개 파일 어디에도 없음.
- **SQL/LDAP 인젝션, 경로 탐색**: DB·LDAP 접근 없음. 파일 경로는 전부 tool call 이 이미 기록한 값이거나 git 내부 명령의 출력이라 임의 외부 입력에 의한 경로 탈출 표면이 없음.
- **인증/인가**: 이 변경 범위에 사용자 인증·세션·권한 검증 로직 자체가 없음. `branch_guard.py`/`BYPASS_DEFAULT_BRANCH_GUARD` 는 신원 기반 접근 제어가 아니라 워크플로 거버넌스 가드이며, 그 fail-open/bypass 는 설계상 의도된 탈출구이지 인가 우회 취약점이 아님.
- **암호화**: 해시/암호화 연산이 코드에 없음(해당 없음).
- **에러 처리**: 모든 예외 경로가 일반화된 메시지만 stderr 로 출력("mermaid-lint: skipped …", "install failed …")하고 스택트레이스·내부 경로·환경변수 값 등 민감정보를 노출하지 않음.
- **역직렬화**: `json.loads` 만 사용(코드 실행 가능한 `eval`/`pickle` 류 없음).

## 요약

리뷰 대상 6개 파일은 로컬 git hook 및 Claude Code 세션 부트스트랩을 다루는 devops 도구로, 하드코딩된 시크릿·인젝션 취약점·안전하지 않은 역직렬화·민감정보 노출 에러 처리 등 전형적인 CRITICAL/HIGH 급 결함은 발견되지 않았다. 모든 subprocess 호출이 list-argv·NUL-구분 파일명 처리 등 커맨드 인젝션에 안전한 관용구를 일관되게 사용하고 있어 코드 품질 자체는 양호하다. 다만 SessionStart 시점에 사용자 동의 없이 버전관리된 `.githooks` 를 자동 활성화하고 그 안에서 무인으로 `npm install --no-audit` 을 수행하는 구조는, 이 저장소가 신뢰하는 브랜치 보호·리뷰 프로세스에 전적으로 의존하는 공급망 신뢰 경계라는 점에서 WARNING 으로 명시적으로 기록해 둘 가치가 있다(이번 PR 이 만든 새 버그는 아니고, 기존 설계의 의식적 trade-off를 재확인한 것).

## 위험도

LOW
