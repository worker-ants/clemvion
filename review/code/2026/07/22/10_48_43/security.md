# 보안(Security) 코드 리뷰

## 리뷰 대상
- `.claude/hooks/lint_mermaid_posttooluse.py`
- `.claude/tests/test_lint_mermaid_exit_codes.py` (신규)
- `.claude/tests/test_mermaid_lint_ready.py`
- `.claude/tools/mermaid-lint/lint-mermaid.mjs`
- `.githooks/pre-commit`

변경 요지: mermaid 린터(`lint-mermaid.mjs`)가 `jsdom`/`mermaid` 동적 import 에 실패했을 때(손상된/부분 설치된 `node_modules`) node 기본 종료코드 1(파싱 실패와 동일)로 죽던 것을, 새 종료코드 3("tooling broken")으로 구분하고, 두 소비자(Python PostToolUse 훅, bash pre-commit 훅)가 이를 파싱 오류와 별개로 fail-open(스킵) 처리하도록 한 변경.

### 발견사항

- **[INFO]** 신규 fail-open 경로가 보안 게이트가 아닌 구문 린터에 한정됨
  - 위치: `.claude/tools/mermaid-lint/lint-mermaid.mjs:1010-1023`, `:1041-1050`; `.claude/hooks/lint_mermaid_posttooluse.py:215-225`; `.githooks/pre-commit:1106-1114`
  - 상세: mermaid 린터는 `mermaid.parse()` 로 다이어그램 문법만 검사하며 콘텐츠 안전성(예: 렌더링 시 XSS)을 검증하는 보안 컨트롤이 아니다. 따라서 종료코드 3 을 통한 fail-open 이 남용되더라도(예: 공격자가 `node_modules` 를 의도적으로 손상시켜 항상 import 실패를 유발) 결과는 "문법 오류를 못 잡아낸다"는 정도이며, 인증 우회나 데이터 노출 같은 직접적 보안 영향은 없다. 다만 이 fail-open 트리거 조건(“jsdom/mermaid import 실패”)이 공급망 손상(예: 악성 postinstall 스크립트가 심어진 패키지가 `node_modules` 에 존재)의 신호일 수 있다는 점은 이 훅의 책임 범위 밖(별도 의존성 무결성 문제)이다.
  - 제안: 조치 불필요. 향후 이 린터가 콘텐츠 안전성 검증(예: 렌더링된 SVG 살균)까지 겸하게 될 경우, 그 때는 fail-open 정책을 재검토해야 한다는 점만 기록해 둘 것.

- **[INFO]** 종료코드 3 매직 넘버 — 향후 확장 시 충돌 여지
  - 위치: `.claude/tools/mermaid-lint/lint-mermaid.mjs:953` (`EXIT_TOOLING_BROKEN = 3`), Python 측 `.claude/hooks/lint_mermaid_posttooluse.py:38` (`_EXIT_TOOLING_BROKEN = 3`)
  - 상세: 두 언어(JS/bash 소비자, Python 소비자) 간에 하드코딩된 정수 상수로 계약을 공유한다. 현재는 `test_lint_mermaid_exit_codes.py` 가 실제 node 를 구동해 3 을 핀(pin)하고, `test_mermaid_lint_ready.py` 가 스텁으로 두 소비자의 분기 처리를 검증하므로 drift 는 테스트로 방지된다. 보안 취약점은 아니며, 유지보수성 관점의 참고사항.
  - 제안: 조치 불필요(이미 테스트로 크로스체크됨).

- **[INFO]** 예외 메시지(`e.message`)를 stderr 로 그대로 노출
  - 위치: `.claude/tools/mermaid-lint/lint-mermaid.mjs:1018-1021`, `:1045-1048`
  - 상세: `jsdom`/`mermaid` import 실패 시 Node 의 `ERR_MODULE_NOT_FOUND` 메시지(모듈 경로 등)를 stderr 에 그대로 출력한다. 이 값은 로컬 개발자 세션에서만 노출되고(원격 전송·로그 수집 없음), 민감정보(자격증명·세션 토큰 등)를 포함할 여지가 없는 순수 파일시스템 경로/모듈명 정보이므로 정보 노출 위험은 없음.
  - 제안: 조치 불필요.

### 인젝션/시크릿/인증/입력검증 관련 확인 사항 (문제 없음)
- 모든 서브프로세스 호출이 리스트 인자 방식(`subprocess.run(["node", script, os.path.abspath(target)], ...)`, `["git", "-C", workdir, ...]`)으로 `shell=True` 없이 실행되어 커맨드 인젝션 벡터가 없다.
- `.githooks/pre-commit` 의 `node "$mermaid_script" "${md_files[@]}"` 도 배열 확장이 올바르게 따옴표 처리되어 있고, 대상 파일 목록은 `git diff --cached --name-only --diff-filter=ACM -z` 의 NUL-구분 출력에서 파생되어 공백/특수문자 파일명에 대해서도 안전(기존 코드, 이번 diff 는 종료코드 분기만 추가).
- 하드코딩된 API 키/비밀번호/토큰 없음.
- 인증/인가 로직 변경 없음(로컬 git hook 으로, 원격 요청이나 권한 경계를 다루지 않음).
- 사용자(공격자) 제어 가능 입력이 이번 변경의 신규 분기(종료코드 3)에 영향을 주는 경로가 없음 — 이 분기는 마크다운 파일 내용이 아니라 `node_modules` 설치 상태(환경)에만 의존한다.
- 암호화/해시 관련 코드 없음. 평문 전송 이슈 없음(로컬 프로세스 간 stdin/stdout/exit code 통신뿐).
- 알려진 CVE 가 있는 의존성을 새로 추가하지 않음(기존 `jsdom`/`mermaid` import 실패 처리 로직 개선일 뿐).

### 요약
이번 변경은 mermaid 린터의 `node_modules` 손상 시나리오에서 발생하던 오탐(모든 마크다운 커밋/편집을 파싱 오류로 오인해 차단)을 명확한 종료코드(3)로 구분하고 fail-open 시키는 개발 도구 개선이다. 모든 서브프로세스 호출이 리스트 인자로 이루어져 커맨드 인젝션 벡터가 없고, 하드코딩된 시크릿·인증/인가 변경·평문 전송·안전하지 않은 암호화 사용이 없으며, 신규 fail-open 분기는 공격자 제어 입력이 아닌 로컬 환경 상태(의존성 설치 여부)에만 의존한다. 또한 우회 대상인 mermaid 린트 자체가 콘텐츠 안전성이 아닌 순수 구문 검사이므로, 설사 이 fail-open 경로가 (환경 손상을 통해) 남용되더라도 보안적으로 의미 있는 영향은 없다. 전반적으로 보안 관점에서 문제되는 패턴은 발견되지 않았다.

### 위험도
NONE
