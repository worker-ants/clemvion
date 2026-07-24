# 보안(Security) 코드 리뷰

## 대상
- `.claude/hooks/guard_review_before_push.py` (PreToolUse Bash hook — `git push` 차단 게이트)
- `.claude/tests/test_push_guard_worktree_scope.py`
- `.claude/tests/README.md`

## 리뷰 요약 관점
이 변경은 로컬 개발 harness 의 pre-push 가드에 "worktree scoping" (cwd 뿐 아니라 push 가 실제로 publish 하는 다른 worktree 도 평가)을 추가한 것이다. 외부 네트워크 입력을 다루지 않고, DB·웹·인증 시스템과 무관하며, 취급하는 유일한 "입력"은 같은 세션의 Claude Code 가 실행하려는 로컬 Bash 커맨드 문자열(JSON stdin)이다. 이 관점에서 OWASP Top10/전통적 웹 취약점 카테고리 대부분은 해당 사항이 없다. 아래는 이 파일들에 실제로 적용 가능한 항목만 분석했다.

### 발견사항

- **[INFO]** `subprocess` 호출은 전부 list-argv 형태이며 `shell=True` 를 쓰지 않음 — 커맨드 인젝션 없음 (검증됨)
  - 위치: `.claude/hooks/guard_review_before_push.py:441` (`_worktree_branches`, `subprocess.run(["git", "worktree", "list", "--porcelain"], cwd=cwd, ...)`), `.claude/tests/test_push_guard_worktree_scope.py:96`~`98` (`_git` 헬퍼)
  - 상세: 두 파일 모두 `subprocess.run` 을 리스트 인자로만 호출하고 셸 문자열 결합을 하지 않는다. `cwd=` 값은 로컬 Claude 세션이 이미 신뢰하는 worktree 경로(`payload["cwd"]`, `git worktree list` 출력)에서만 오며, 문자열 결합으로 셸에 전달되는 경로가 없어 셸 인젝션 표면이 없다.
  - 제안: 없음 (양호한 패턴 — 유지 권장, 향후 이 파일을 수정할 때 `shell=True` 를 도입하지 않도록 주의).

- **[INFO]** 손으로 짠 정규식 기반 push 탐지(`_GIT_PUSH`)의 ReDoS 가능성을 실측 검증 — 현재 선형(linear) 시간
  - 위치: `.claude/hooks/guard_review_before_push.py:101` (`_GIT_PUSH = re.compile(...)`), 호출부 `.claude/hooks/guard_review_before_push.py:364` (`_is_git_push`)
  - 상세: `_GIT_PUSH` 는 `_is_git_push()` 안에서 **길이 캡(`_MAX_REDACTION_INPUT`) 적용 이전**, 즉 임의 길이의 원본 커맨드 문자열 전체에 대해 실행된다(322~325행: `"push" not in command` 체크 후 바로 `_GIT_PUSH.search(command)`, 길이 캡 체크는 그 다음인 326행). 이 hook 은 매 Bash 호출을 동기적으로 게이팅하므로, 만약 이 정규식에 파국적 backtracking(ReDoS) 이 있다면 세션 전체가 멈추는 문제가 될 수 있다(파일 주석 자체가 과거 3라운드에 걸쳐 다른 부분에서 이런 결함을 반복 발견했다고 명시). 직접 다음 두 적대적 패턴으로 검증했다: (1) `"A=B " * n` (환경변수 대입부의 반복 매칭 실패 유도), (2) `"git " * n` / `"git;" * n` (git\b 뒤 실패하는 `[^&;|]*\bpush\b` 스캔 반복 유도). n=1,000~160,000 까지 모두 **선형** 시간(밀리초 단위, 배율 증가에 비례)으로 확인됨 — 현재 이 패턴에는 파일이 우려하는 종류의 지수적 backtracking 이 없다.
  - 제안: 새 결함은 아니며 현재 안전함을 확인한 것 — 다만 이 정규식이 길이 캡 **이전에** 무제한 입력에 대해 실행된다는 사실은 향후 이 정규식을 수정할 사람에게 명시적으로 알려지지 않고 있다(주석은 `_redact_inert_text`/`_commit_heredoc_spans` 쪽의 캡만 강조). `_GIT_PUSH` 자체를 향후 변경할 때는 동일한 차등(differential) ReDoS 벤치마크를 재실행하거나, 최소한 `_GIT_PUSH.search(command)` 호출도 `_MAX_REDACTION_INPUT`로 선-절단하는 것을 고려할 만하다(현재는 안전하므로 강제 아님, WARNING 아닌 INFO로 하향).

- **[INFO]** Fail-open 설계 + 인증 없는 `BYPASS_*` 환경변수 우회 — 의도된 트레이드오프, 위협 모델상 수용 가능
  - 위치: `.claude/hooks/guard_review_before_push.py:707` (`BYPASS_REVIEW_GUARD`), `:729` (`BYPASS_PLAN_GUARD`), 및 gate import/평가 실패 시 fail-open 경로 전반(`:661`~`:756`, 특히 `except Exception` 블록들)
  - 상세: 이 hook 은 "리뷰/plan 갱신 없이 push 하지 못하게" 막는 정책 게이트이지만, (a) 게이트 모듈 import 실패, `evaluate_*()` 예외, push 탐지 자체의 예외 등 어떤 내부 오류든 **fail-open**(exit 0, push 허용)하고, (b) `BYPASS_REVIEW_GUARD=1`/`BYPASS_PLAN_GUARD=1` 환경변수만 세팅하면 게이트가 인증·감사 없이 전부 스킵된다. 전통적인 웹/서버 애플리케이션이었다면 이는 "인증 우회" 로 CRITICAL 감이지만, 이 hook 의 위협 모델은 "같은 로컬 세션·같은 신뢰 도메인의 개발자/에이전트가 실수로 리뷰를 건너뛰는 것을 막는 워크플로 가드"이지 외부 공격자로부터 시스템을 지키는 보안 경계가 아니다 — bypass 를 설정할 수 있는 주체는 이미 그 push 를 실행할 권한을 가진 바로 그 프로세스다. docstring 이 이 트레이드오프와 관측성 보완(§E: fail-open 을 카운트·에스컬레이션)을 상세히 설명하고 있어 의도적 설계로 판단된다.
  - 제안: 코드 변경 요구 없음. 다만 이 hook 을 향후 "진짜" 보안 경계(예: CI 서버, 다른 신뢰 도메인의 자동화)로 재사용/이식할 경우, fail-open + 무인증 env-var 우회 조합은 그 맥락에서는 부적절할 수 있다는 점을 문서에 한 줄 남겨두는 것을 권장(현재 docstring 은 "이 리포지토리의 로컬 개발자 워크플로" 라는 전제를 암묵적으로만 깔고 있음).

- **[INFO]** 예외 시 `traceback.print_exc(file=sys.stderr)` 로 전체 스택트레이스 노출 — 낮은 민감도
  - 위치: `.claude/hooks/guard_review_before_push.py:104`(import 실패), `:682`(`_evaluate_over_targets` 내부), `:739`(`_push_targets` 실패), `:754`(`main()` 최상위 catch)
  - 상세: 내부 오류 발생 시 전체 traceback(로컬 파일 경로·모듈 구조 포함)을 stderr 로 출력한다. 이는 로컬 개발자 자신의 터미널/에이전트 세션에만 노출되며 외부로 전송되지 않으므로 정보 노출 위험은 낮다. 다만 일반 원칙(에러 메시지에 민감정보 미노출)의 관점에서 언급.
  - 제안: 없음(현재 노출 대상이 코드 소유자 본인뿐이라 실질 위험 없음). 이 hook 이 다른 사용자 대상 출력 채널로 옮겨질 경우에만 재검토 필요.

## 검토했으나 해당 없음으로 판단한 항목
- SQL/LDAP/경로 탐색 인젝션: DB·LDAP·파일 경로 조립 로직 없음(대상 없음).
- XSS: 웹 렌더링 경로 없음(대상 없음).
- 하드코딩된 시크릿: 두 파일 모두 API 키/비밀번호/토큰 없음(테스트 파일의 `t@example.com`, `git config user.email` 은 git 테스트용 더미 값).
- 암호화/해시: 해당 코드 경로 없음.
- 의존성 보안: 두 파일 모두 표준 라이브러리(`re`, `subprocess`, `json`, `os`, `inspect`, `traceback`, `unittest`, `tempfile`, `shutil`)만 사용, 신규 서드파티 의존성 도입 없음(`.claude/tests/README.md` 도 "표준 라이브러리만" 원칙을 재확인).

## 요약
이 변경은 로컬 harness 의 push-전 정책 게이트에 worktree 스코핑을 추가하는 방어적 자동화 코드로, 외부 공격자 입력을 다루지 않고 셸 인젝션(list-argv subprocess 일관 사용), SQL/XSS 등 전통적 인젝션 표면이 없으며 신규 서드파티 의존성도 도입하지 않는다. 손으로 짠 정규식 기반 push 탐지의 ReDoS 우려는 적대적 입력으로 직접 실측하여 현재 선형 시간임을 확인했다. 유일하게 주목할 부분은 fail-open 정책과 `BYPASS_REVIEW_GUARD`/`BYPASS_PLAN_GUARD` 무인증 우회인데, 이는 문서화된 의도적 설계이고 위협 모델(같은 신뢰 도메인의 로컬 개발자 워크플로 가드, 진짜 보안 경계 아님)상 수용 가능하다. 코드 자체를 반드시 수정해야 할 CRITICAL/WARNING 급 보안 결함은 발견되지 않았다.

### 위험도
NONE
