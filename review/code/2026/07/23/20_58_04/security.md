### 발견사항

- **[CRITICAL]** `guard_review_before_push.py` 의 `_GIT_PUSH` blind 정규식이 **따옴표+공백 포함 `VAR=value` 접두**에서 push 를 전혀 탐지하지 못해, **mandatory review-before-push 게이트 전체가 조용히 우회**된다. 이번 diff(라운드 4, `test_line_anchors.py` fixture 결속 제거·§J 주석 위치 이동·`worktree-policy.md` 구분자 동기화)에도 이 패턴은 여전히 수정되지 않은 채 HEAD 에 남아 있다.
  - 위치: `.claude/hooks/guard_review_before_push.py:107-109` (`_GIT_PUSH = re.compile(r"(?:^|&&|;|\|)\s*(?:[A-Za-z_][A-Za-z0-9_]*=\S+\s+)*git\b[^&;|]*\bpush\b")`), 실사용 지점 `.claude/hooks/guard_review_before_push.py:534` (`if not _is_git_push(command): return 0` — REVIEW/PLAN 게이트를 아예 호출하지 않고 그대로 종료). 인지 주석은 이번 diff 로 올바른 위치(`_GIT_PUSH` 정의 바로 위, `:97-106`)로 옮겨졌으나 패턴 자체는 그대로다. 추적 근거: `plan/in-progress/harness-guard-followups.md` §J(라인 425 이하, 체크리스트 라인 479, 여전히 `[ ]` 미완료).
  - 상세: 직접 재현 확인(현재 HEAD 기준) — `GIT_SSH_COMMAND="ssh -i ~/.key" git push origin main`, `GIT_SSH_COMMAND='ssh -i ~/.key' git push origin main`, `GIT_AUTHOR_NAME="John Doe" git push --force origin main` 모두 `_is_git_push()` 가 `False` 를 반환한다(`\S+` 는 첫 공백에서 끊기므로 따옴표 안에 공백이 있으면 env-prefix 그룹이 성립하지 않고 뒤이은 `git\b` 앵커도 그 위치에서 매치되지 않는다). `main()` 흐름(`:533-536`)을 보면 탐지 실패 시 `except`/`finally` 의 fail-open 관측 로직(`outcome.degraded`, 배너 출력)도 거치지 않고 곧바로 `return 0` 하므로, **배너도 카운터 증가도 없이 완전히 침묵 상태로 게이트 전체가 우회**된다. 트리거 명령은 조작된 엣지케이스가 아니라 커스텀 SSH 키를 지정해 push 하는 일상적 형태이며, 이 저장소 자신의 테스트 컨벤션(`GIT_AUTHOR_DATE="…  …"` 류)에서도 공백 포함 따옴표 값이 실제로 쓰인다.
  - 이 결함은 이번 diff 가 새로 만든 것이 아니라(§C 라운드에서 `guard_default_branch_bash.py` 를 고치던 중 처음 실측·문서화됐고, 이번 라운드는 그 인지 주석 위치를 결함 지점(`_GIT_PUSH`)으로 올바르게 옮긴 것뿐이다) 3라운드 연속으로 CRITICAL 로 재확인됐고, `test_push_guard_allowlist.py` 의 byte-for-byte 핀 + 차등 코퍼스 때문에 핀 갱신·코퍼스 확장·뮤테이션을 동반하는 별건 PR 로 의도적으로 분리된 상태다(plan §J, "차단성, 최우선" 라벨). 은폐·회귀는 아니며 투명하게 추적되고 있으나, mandatory 리뷰 게이트가 완전 우회되는 CRITICAL 등급 결함이 여전히 라이브 코드에 미해결 상태로 남아 있다는 사실 자체는 이번 라운드 리뷰에서도 계속 상향 보고해야 한다.
  - 제안: plan §J 별건 PR("차단성, 최우선")을 지체 없이 착수해 `_GIT_PUSH` env 값 부분을 `(?:'[^']*'|"[^"]*"|[^\s'"]\S*)` 로 확장하고 `test_push_guard_allowlist.py` 핀·차등 코퍼스·뮤테이션 검증을 동반한다. `_SEGMENT_IS_GIT`(release 경로, 동일 `\S+` 이나 미매치=안전 방향이라 별개)는 건드리지 않는다 — 코드 주석이 이미 이를 명확히 구분해 두었다.

- **[INFO]** `guard_default_branch_bash.py` 의 세그먼트 분할·`VAR=value`(따옴표 값 포함) 접두 확장 — ReDoS 없음, 재검증 결과 이상 없음
  - 위치: `.claude/hooks/guard_default_branch_bash.py` (`_MUTATING` env-value 3-way alternation, `_SEGMENT_SPLIT`, `_is_mutating`)
  - 상세: env-value 대안 3종(`'[^']*'`/`"[^"]*"`/`[^\s'"]\S*`)이 첫 글자로 서로 배타적이라 백트래킹 시 탐색할 분할이 없고, 각 반복은 뒤따르는 필수 `\s+` 로 경계가 고정된다(중첩 quantifier 없음). `_SEGMENT_SPLIT` 도 리터럴/문자클래스 대안만 있는 비-중첩 정규식이다. 이전 라운드의 `BacktrackingTest`(subprocess+timeout, 최대 20만 문자급 적대적 입력)와 구조적 분석이 일치하며, 이번 라운드에서 코드 자체는 추가 변경이 없어 결론이 유지된다.
  - 제안: 조치 불필요.

- **[INFO]** `_is_mutating` 은 차단 권한이 없는 순수 advisory 신호 — 분류 갭이 보안적으로 악용 불가능
  - 위치: `.claude/hooks/guard_default_branch_bash.py` (`_is_mutating`, 세션당 1회 stdout reminder 전용). 실제 강제는 `guard_default_branch_edit.py`(Write/Edit 차단)와 `.githooks/pre-commit`(commit 차단) 두 개의 독립된 hard gate.
  - 상세: 인용문 무시(오탐)·간접 실행(`xargs`/`bash -c`) 미분류(미탐) 모두 문서·테스트로 명시적으로 인정된 한계이며, 이 훅은 절대 차단하지 않으므로 얻을 수 있는 이득이 없다. §J(차단형 게이트)와 구조적으로 다른 위험 등급이다.
  - 제안: 조치 불필요. 이 훅이 향후 차단 로직을 갖게 되는 회귀가 생기면 재검토 필요.

- **[INFO]** `test_line_anchors.py` 신규 `_pick_commit_fixture`/`_git` 헬퍼 — 커맨드 인젝션 표면 없음
  - 위치: `.claude/tests/test_line_anchors.py` (`_git(*args)` — `subprocess.run(["git", *args], ...)`, `_pick_commit_fixture`)
  - 상세: `_git` 은 `shell=True` 없이 인자 리스트로 호출되고, `_pick_commit_fixture` 가 넘기는 `sha` 는 `git log --format=%H` 출력(로컬 신뢰 값)에서만 오며 외부/사용자 입력이 아니다. 새로 추가된 로직(최근 40커밋 중 변경 라인 ≥80인 첫 커밋 선택)은 순수 로컬 git 조회이며 새 위험 표면을 열지 않는다.
  - 제안: 조치 불필요.

- **[INFO]** `worktree-policy.md`/plan 문서 갱신 — SPEC-DRIFT 해소 확인, 새 보안 이슈 없음
  - 위치: `.claude/docs/worktree-policy.md:73` (구분자 나열에 `&` 추가로 코드·테스트·docstring 과 동기화 완료), `plan/in-progress/harness-guard-followups.md` §J
  - 상세: 이전 라운드(20_33_56) WARNING 이었던 정책 문서의 `&` 누락은 이번 diff 로 해소됐다(직접 확인: 73행에 `&` 포함). §J 체크리스트는 여전히 미완료(`[ ]`)로, 위 CRITICAL 항목과 정합된 상태를 유지하고 있다(과장도 축소도 없음).
  - 제안: 조치 불필요, 문서-코드 정합 상태 유지.

- **[INFO]** 인젝션/하드코딩 시크릿/인증/암호화/의존성 — 이번 diff 범위 내 해당 없음
  - 위치: 리뷰 대상 전체(`.claude/hooks/guard_default_branch_bash.py`, `.claude/hooks/guard_review_before_push.py`(주석만), `.claude/tests/*`, `plan/**`, `review/code/2026/07/23/20_02_29/**`, `review/code/2026/07/23/20_33_56/**`)
  - 상세: 외부 입력을 실행하는 코드 경로 없음(정규식 매칭·문자열 분할·로컬 git 조회만 수행). 새 review 산출물(`_retry_state.json` 등)에 로컬 절대경로(`/Volumes/project/...`)가 포함되나 자격증명·토큰이 아니며 이 저장소의 기존 관행과 일치한다. 신규 의존성 없음(표준 라이브러리만 사용).
  - 제안: 조치 불필요.

### 요약

이번 라운드(4R)의 코드 변경 자체는 좁다 — `test_line_anchors.py` 의 HEAD-결속 fixture 제거(로컬 git 조회, 인젝션 표면 없음), `guard_review_before_push.py` 의 §J 인지 주석을 올바른 결함 지점(`_GIT_PUSH`)으로 옮긴 것, `worktree-policy.md` 구분자 서술 동기화뿐이며 이 변경들 자체에서 새로운 보안 결함은 발견되지 않았다. 다만 3라운드에 걸쳐 반복 확인된 CRITICAL 등급 사실 — `guard_review_before_push.py` 의 `_GIT_PUSH` 가 따옴표+공백 포함 env-prefix(`GIT_SSH_COMMAND="ssh -i ~/.key" git push` 같은 일상적 형태)에서 탐지에 완전히 실패해 mandatory review-before-push 게이트 전체가 배너 없이 조용히 우회된다는 사실 — 은 이번 diff 이후에도 HEAD 에 그대로 남아 있다(직접 재현·라인 확인 완료). 별건 PR(plan §J, "차단성 최우선")로 투명하게 추적되고 있어 은폐나 회귀는 아니지만, 실질적인 게이트 우회가 미해결 상태로 지속되고 있다는 사실은 이번 라운드에서도 계속 CRITICAL 로 표기해 후속 PR 착수를 압박할 필요가 있다. `guard_default_branch_bash.py`(soft nudge, 차단 권한 없음) 계열은 ReDoS·인젝션·오남용 관점에서 반복 검증돼 안전이 확인됐다.

### 위험도
CRITICAL
