### 발견사항

- **[CRITICAL]** `guard_review_before_push.py` 의 `_GIT_PUSH` blind 정규식이 **따옴표+공백 포함 `VAR=value` 접두**에서 push 를 전혀 탐지하지 못해, **mandatory review-before-push 게이트 전체가 조용히 우회**된다. 이번 diff 는 이 결함을 **처음으로 문서화**하면서도 **고치지 않고** 별건 PR 로 미룬다.
  - 위치: `.claude/hooks/guard_review_before_push.py:96-98` (`_GIT_PUSH = re.compile(r"(?:^|&&|;|\|)\s*(?:[A-Za-z_][A-Za-z0-9_]*=\S+\s+)*git\b[^&;|]*\bpush\b")`), 실사용 지점 `.claude/hooks/guard_review_before_push.py:526` (`if not _is_git_push(command): return 0` — 게이트 전체를 건너뛴다). 이번 diff 가 추가한 인지 주석: `.claude/hooks/guard_review_before_push.py:141-148`(코드 변경 없음, cross-reference 주석만 추가). 근본 서술: `plan/in-progress/harness-guard-followups.md` §J (신규 섹션, diff 게이트 라인 425-455, 재현 표는 434-441).
  - 상세: 직접 실측(격리된 인터프리터에서 `_GIT_PUSH.search()` 재현)으로 확인했다.
    ```
    False | GIT_SSH_COMMAND="ssh -i ~/.key" git push origin main
    False | GIT_SSH_COMMAND='ssh -i ~/.key' git push origin main
    False | GIT_AUTHOR_NAME="John Doe" git push --force origin main
    True  | GIT_SSH_COMMAND=ssh git push origin main
    True  | git push origin main
    ```
    `\S+` 는 첫 공백에서 끊기므로 따옴표로 감싼 값에 공백이 있으면 `(?:VAR=value\s+)*` 그룹 자체가 성립하지 않고, 뒤이은 `git\b` 앵커도 그 위치에서 매치되지 않는다. `main()`(`guard_review_before_push.py:515-542`)의 흐름을 직접 확인한 결과, `_is_git_push()` 가 `False` 를 반환하면 526행에서 **곧바로 `return 0`** 하고 `_run_gates()`(REVIEW 게이트 + PLAN 게이트)는 아예 호출되지 않는다. 이 조기 return 은 `except`/`finally` 의 fail-open 관측 로직(`outcome.degraded`, `_report_fail_open`)도 거치지 않으므로 **배너도, 카운터 증가도 없이 완전히 침묵 상태로 게이트가 우회**된다 — "탐지 실패는 곧 게이트 실행 자체가 안 됨" 이라는, fail-open observability 정책(§E)이 커버하지 못하는 네 번째 경로다.
    트리거 커맨드는 조작된 엣지케이스가 아니라 커스텀 SSH 키를 지정해 push 하는 **일상적인 형태**(`GIT_SSH_COMMAND="ssh -i ~/.key" git push`)이며, 이 저장소 자신도 CI/로컬 워크플로에서 커밋 작성자·SSH 커맨드를 env var 로 지정하는 패턴을 테스트 컨벤션으로 문서화해 두고 있다(`GIT_AUTHOR_NAME`, `GIT_AUTHOR_DATE` 등 — `EnvPrefixTest` 케이스 참고). 즉 실제로 발생 가능한 입력이 리뷰-전-push 강제를 완전히 무력화한다.
    긍정적인 부분: 이번 diff 자체가 **이 결함을 처음 실측·문서화**했고(`RESOLUTION.md` §"리뷰가 놓친 것"), `plan/in-progress/harness-guard-followups.md` 체크리스트 최상단에 "J — 차단성, 최우선"으로 등록했으며, `_GIT_PUSH` 는 `test_push_guard_allowlist.py` 가 byte-for-byte 로 고정한 차등 코퍼스라 패치가 핀 갱신 + 코퍼스 확장 + 뮤테이션을 동반해야 한다는 이유로 **의도적으로 별건 PR 로 분리**한 것도 합리적인 변경 관리 판단이다. 이번 diff 는 이 결함을 **악화시키지 않았고 투명하게 노출**했다는 점에서 부정적으로만 볼 사안은 아니다. 다만 게이트가 **완전 우회**되는 CRITICAL 등급 결함이 알려진 채로 남아 있고, 별건 PR 착수 시점이 확정되지 않았으므로 리뷰 관점에서는 CRITICAL 로 등급을 매겨 우선순위를 명확히 해야 한다.
  - 제안: (1) 별건 PR(§J)을 이번 PR 과 최대한 가깝게 후속 착수 — "최우선"이라는 자체 라벨과 일치시킨다. (2) 임시 완화책으로 `_is_git_push` 탐지 실패 시에도 최소한 관측(예: `outcome.degraded` 에 "DETECTION MISS, treated as non-push" 같은 심각도 낮은 로그)을 남겨 완전 침묵을 줄이는 것을 고려. (3) `_redact_inert_text`/`_SEGMENT_IS_GIT`(134행)도 동일 `\S+` 패턴을 쓰지만 그쪽은 release 경로라 미매치=차단 유지이므로 안전 — 이 비대칭을 정확히 짚은 plan 서술은 맞다.

- **[INFO]** `guard_default_branch_bash.py` 의 `VAR=value` 접두 확장 정규식 — ReDoS 없음, 독립 검증 완료
  - 위치: `.claude/hooks/guard_default_branch_bash.py:96-117` (`_MUTATING`, 특히 98행 `^\s*(?:[A-Za-z_][A-Za-z0-9_]*=(?:'[^']*'|"[^"]*"|[^\s'"]\S*)\s+)*(?:`), `:146` (`_SEGMENT_SPLIT`), `:149-154` (`_is_mutating`)
  - 상세: 정규식 구조를 직접 분석했다 — env-value 대안 3종(`'[^']*'`, `"[^"]*"`, `[^\s'"]\S*`)은 첫 글자가 서로 배타적이라 백트래킹 시 탐색할 분할이 없고, 각 반복은 뒤따르는 필수 `\s+` 로 경계가 고정된다(중첩 quantifier 없음). `_SEGMENT_SPLIT` 도 리터럴/문자클래스 대안만 있는 비-중첩 정규식이라 구조적으로 선형이다. `BacktrackingTest`(subprocess+timeout, `test_guard_default_branch_bash_mutating.py`)와 `RESOLUTION.md` 의 실측(최대 20만 문자급 적대적 입력, 선형 스케일링)도 이 구조적 분석과 일치한다. 이 훅은 모든 Bash 호출을 동기적으로 게이팅하므로 ReDoS 였다면 CRITICAL(세션 정지)이었겠으나, 해당 없음.
  - 제안: 조치 불필요. 향후 `_MUTATING` 에 중첩 quantifier 를 추가할 경우에만 재검증.

- **[INFO]** `_is_mutating` 은 차단 권한이 없는 순수 advisory 신호 — 세그먼트 분할의 알려진 오탐/미탐(인용문 무시, heredoc 본문, 간접실행 `xargs`/`bash -c`, `$(...)` 커맨드 치환이 따옴표 값 내부에 있을 때 등)이 있어도 보안적으로 악용 불가능
  - 위치: `.claude/hooks/guard_default_branch_bash.py:149-154`(`_is_mutating`), 실제 강제는 `guard_default_branch_edit.py`(Write/Edit 차단) + `.githooks/pre-commit`(commit 차단) 두 개의 독립된 hard gate.
  - 상세: 이 훅은 절대 차단하지 않고(주석 5-9행, 183-224행 `main()` 로직 확인) 세션당 최대 1회 stdout 리마인더만 출력한다. 예로 `A="$(rm -rf x)" git status` 처럼 따옴표 값 내부의 커맨드 치환은 정규식이 이해하지 못해 분류되지 않지만, 이는 이미 인정된 "간접 실행은 스코프 밖"(`OutOfScopeTest`) 철학과 동일한 성격이고, 이 훅이 결과를 놓쳐도 리마인더가 안 뜨는 것 이상의 영향이 없다. 위 CRITICAL 항목(§J, 차단형 게이트)과 구조적으로 다른 위험 등급임을 재확인했다.
  - 제안: 조치 불필요. 단, 이 훅이 향후 차단 로직을 갖게 되는 회귀가 생기면 이 결론을 재검토해야 한다(이전 라운드 security 리뷰가 남긴 조건과 동일).

- **[INFO]** (diff 밖, 참고용) `_already_warned`/`_mark_warned` 의 `session_id` 를 검증 없이 `os.path.join` 에 사용
  - 위치: `.claude/hooks/guard_default_branch_bash.py:162-180` (전체 파일 컨텍스트 기준 — 이번 diff 의 변경 대상 아님)
  - 상세: `session_id = payload.get("session_id") or payload.get("sessionId")` 가 `os.path.join(_state_dir(), session_id)`(165, 175행)에 그대로 들어간다. `../` 등이 포함되면 이론적으로 경로 이탈이 가능하나 이 값은 하네스가 자체 발급하는 내부 신뢰 값이며, 이번 diff 가 건드리지 않은 기존 코드다.
  - 제안: 조치 불요(스코프 밖). 후속 변경 시 `os.path.basename(session_id)` 방어 정규화 고려.

- **[INFO]** 인젝션/하드코딩 시크릿/암호화/의존성 — 이번 diff 범위 내 해당 없음
  - 위치: 리뷰 대상 전체 (`.claude/docs/worktree-policy.md`, `.claude/hooks/guard_default_branch_bash.py`, `.claude/hooks/guard_review_before_push.py`(주석만), `.claude/tests/README.md`, `.claude/tests/test_guard_default_branch_bash_mutating.py`, `plan/**`, `review/code/2026/07/23/20_02_29/**`)
  - 상세: 외부 입력을 실행하는 코드 경로 없음(정규식 매칭·문자열 분할만 수행). 신규 테스트의 `subprocess.run([sys.executable, "-c", PROBE, path], ...)` 은 `shell=True` 없이 인자 리스트로 호출되고 `PROBE`/`path` 모두 정적·신뢰 값이라 커맨드 인젝션 표면 없음. 하드코딩된 시크릿·자격증명 없음(테스트의 `GIT_SSH_COMMAND="ssh -i ~/.key"` 류는 예시 명령 문자열일 뿐 실제 키 값이 아님). 신규 의존성 없음(표준 라이브러리 `re`/`subprocess`/`unittest` 만 사용). 예외 처리는 fail-open 이며 스택트레이스는 로컬 stderr 로만 향한다.
  - 제안: 해당 없음.

- **[INFO]** `review/code/2026/07/23/20_02_29/_retry_state.json` 에 로컬 절대경로(`/Volumes/project/private/clemvion/...`)가 그대로 커밋됨
  - 위치: `review/code/2026/07/23/20_02_29/_retry_state.json` 전체
  - 상세: 사용자명·로컬 디렉토리 구조가 노출되지만 자격증명·토큰류가 아니며, 이 저장소의 다른 review 산출물도 동일한 패턴(절대경로 기록)을 관행적으로 남긴다. 실질적 위험 없음.
  - 제안: 조치 불필요, 참고용.

### 요약

이번 diff 자체(`guard_default_branch_bash.py` 의 세그먼트 분할 + `VAR=value` 접두 확장, 관련 테스트·문서)는 **차단 권한이 없는 advisory 훅**의 분류 로직 개선으로, 독립적으로 재검증한 결과 ReDoS·인젝션·시크릿·인증 우회 문제가 없다. 그러나 이 diff 가 그 과정에서 처음으로 실측·문서화한 별도 사실 — `guard_review_before_push.py` 의 `_GIT_PUSH` 가 따옴표+공백 포함 `VAR=value` 접두(예: `GIT_SSH_COMMAND="ssh -i ~/.key" git push`)에서 **탐지 자체에 실패해 mandatory review-before-push 게이트 전체를 조용히 우회**시킨다는 점은, 직접 재현으로 확인한 결과 CRITICAL 등급의 실질적 보안 결함이다. `main()` 흐름을 확인하면 이 실패는 fail-open 관측 로직조차 거치지 않는 완전한 침묵 우회이며, 트리거 명령은 흔한 실사용 패턴이다. 이번 PR 은 그 결함을 고치지 않고(코드는 unchanged, cross-reference 주석만 추가) plan §J 로 "차단성 최우선" 별건 PR 을 등록해 투명하게 넘겼다는 점에서 은폐나 회귀는 아니지만, 알려진 채로 방치되는 기간의 리스크를 낮추기 위해 후속 PR 착수를 최우선으로 권고한다.

### 위험도
CRITICAL
