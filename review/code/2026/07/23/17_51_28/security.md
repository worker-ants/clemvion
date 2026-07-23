# 보안(Security) 리뷰 — push-guard-worktree-scope (2차, 17_51_28)

대상: `.claude/hooks/guard_review_before_push.py`(worktree 스코프 확장 + `_run_gate` 리팩터), `.claude/tests/test_push_guard_worktree_scope.py`(신규 18건), `.claude/tests/README.md`, `plan/in-progress/push-guard-worktree-scope.md`, 그리고 1차 리뷰(17_28_02) 산출물 7개(`RESOLUTION.md`/`SUMMARY.md`/각 reviewer `.md`/`_retry_state.json`/`meta.json`).

이 변경은 웹앱이 아니라 **push 이전 코드 리뷰를 강제하는 내부 harness 게이트**를 다룬다. 위협 모델은 "외부 공격자"가 아니라 "게이트를 (의도치 않게 또는 의도적으로) 우회하려는 에이전트/커맨드"이며, 이번 diff 자체가 기존 false-ALLOW(리뷰 우회) 결함을 닫는 정합성 수정이다. 1차 리뷰(17_28_02)에서 이 관점의 유일한 WARNING(길이 상한 부재)이 나왔고, 이번 라운드는 그 fix 반영 여부를 실제 코드로 재검증한 결과다.

## 발견사항

- **[INFO]** 1차 리뷰 WARNING("`_mentions_branch`/`_push_targets` 에 길이 상한 없음 → O(n²) 잠재적 DoS/세션 행")이 실제로 해결됨을 코드로 확인
  - 위치: `.claude/hooks/guard_review_before_push.py` 439행(`_push_targets` 내부 `command = command[:_MAX_REDACTION_INPUT]`), 431-438행(docstring 이 truncation 근거 명시)
  - 상세: `_push_targets`가 진입 즉시 `command`를 파일의 기존 방어 상수 `_MAX_REDACTION_INPUT = 16_384`(129행)로 절단한 뒤에야 `_worktree_branches`/`_mentions_branch` 스캔에 넘긴다. `_is_git_push`가 이미 이 상한을 넘긴 커맨드를 "분석 불가 → block(=push 로 취급, 게이트 진행)"으로 처리(295-299행)하는 것과 별개로, `main()`이 `_push_targets`를 호출하기 전에 원문 커맨드를 그대로 넘기던 1차 라운드의 갭이 닫혔다. 절단은 branch 언급을 드롭만 할 수 있어(→ 그 branch 에 한해 pre-fix 동작) cwd 검사 자체는 절대 약화시키지 않는다는 성질도 유지된다.
  - 이 항목은 신규 결함이 아니라 **검증 완료 확인**이며 추가 조치 불필요.

- **[INFO]** `subprocess.run(["git", "worktree", "list", "--porcelain"], cwd=cwd, ...)` — 커맨드 인젝션 경로 없음
  - 위치: `.claude/hooks/guard_review_before_push.py` 357-367행(`_worktree_branches`)
  - 상세: 인자를 리스트로 전달하고 `shell=True`를 쓰지 않아 셸 메타문자 인젝션 표면이 없다. `cwd`가 존재하지 않거나 git 저장소가 아니어도 `FileNotFoundError`/비-0 종료 모두 `except Exception: return []` 및 `if out.returncode != 0: return []`(368-371행)로 안전하게 fail-open 흡수된다. `timeout=5.0`으로 wedge 된 저장소에서의 훅 행(hang)도 방지.
  - 조치 불요.

- **[INFO]** `_lib/review_guard.py`/`_lib/plan_guard.py`가 `cwd` 인자를 실제로 소비함을 직접 확인 — 1차 리뷰의 미해결 확인사항(diff 범위 밖) 해소
  - 위치: `.claude/hooks/_lib/review_guard.py` `evaluate_review()` 836-852행(`_repo_root(cwd)`, `_default_branch(cwd)`, `_merge_base(cwd, ...)`, `_committed_code_changes(cwd, base)`, `_uncommitted_code_changes(cwd)` 전부 전달받은 `cwd`로 git 서브프로세스를 실행), `_lib/plan_guard.py` `evaluate_plan()` 291-319행 동일 패턴
  - 상세: 1차 보안 리뷰(INFO)는 "`_accepts_cwd`가 시그니처만 검사하므로, 실제 `evaluate_review(cwd=...)`가 내부적으로 `cwd`를 무시하고 여전히 `os.getcwd()`/전역 상태를 쓴다면 이 fix가 닫으려던 false-ALLOW 구멍이 조용히 남는다"는 우려를 남겼다. 이번에 두 모듈을 직접 열어 확인한 결과, 두 `evaluate_*` 함수 모두 `cwd`를 전 파이프라인(저장소 루트 판별→기본 브랜치→merge-base→변경 파일 목록)에 실질적으로 전파한다 — probe-and-scope 설계가 실효성 있게 작동한다.
  - 부수 확인: `review_guard.py`의 `_resolution_marker_dir()`(756-763행)만 `CLAUDE_PROJECT_DIR`/`os.getcwd()`로 폴백하지만, 이는 push 게이트(`evaluate_review`)가 아니라 Stop 훅 전용 신호이며 docstring(791행)이 "It is deliberately NOT consulted by the push guard: pushing half-fixed code must still be blocked"라고 명시 — push 스코핑의 신뢰성에 영향 없음.

- **[INFO]** `base_cwd = payload.get("cwd") or os.getcwd()` — 신뢰 경계가 stdin JSON payload 의 `cwd` 필드로 확장됨(의도된 설계)
  - 위치: `.claude/hooks/guard_review_before_push.py` 532-539행(`main()`)
  - 상세: 이 fix 의 핵심 자체가 "훅 프로세스 자신의 `os.getcwd()` 대신 Bash 툴 호출의 실제 `cwd`를 신뢰"하는 것이므로 이는 의도된 변경이다. 이 훅은 이미 `tool_input.command`(즉 stdin payload 전체)를 신뢰 원본으로 삼고 있어(그 위에서 `_is_git_push` 판정), `payload["cwd"]`를 추가로 신뢰하는 것은 기존 신뢰 경계를 벗어나는 새로운 확장이 아니다. 다만 payload 에 `cwd` 키가 없으면(534행) 프로세스 자체 cwd 로 폴백하는데, 이 경로는 **이번 PR 이 고치려던 pre-fix 동작(false-ALLOW 가능)과 동일**하다 — 주석(532-533행)에 "그런 payload 는 기존과 동일하게 동작한다"고 명시된 의도된 트레이드오프다. Claude Code 의 PreToolUse(Bash) 훅 payload 는 통상 `cwd`를 항상 포함하므로 실무 영향은 낮다.
  - 제안(선택): harness 쪽에서 `cwd` 필드가 실제로 항상 채워지는지에 대한 관측/로깅이 있다면 이 fix 의 유효 커버리지를 더 신뢰할 수 있음. 코드 변경은 불요.

- **[INFO]** `traceback.print_exc(file=sys.stderr)` — 로컬 파일 경로 스택트레이스 노출 (기존 패턴, 신규 아님)
  - 위치: `.claude/hooks/guard_review_before_push.py` 44행(모듈 import 실패), 515행(`_run_gate` per-target 예외), 538행(`main()`의 `_push_targets` 예외)
  - 상세: 노출 정보는 로컬 워크트리 경로 수준으로 민감도가 낮고, 훅을 실행한 본인(에이전트/개발자) 만 stderr 를 본다. 신규 결함 아님.
  - 조치 불요.

- **[INFO]** target 단위 fail-open 루프(`except Exception: continue`)가 표면을 넓히지만 설계상 트레이드오프
  - 위치: `.claude/hooks/guard_review_before_push.py` 512-516행(`_run_gate`)
  - 상세: 특정 worktree(예: 손상된 `.git`)에서만 `evaluate_review(target)`/`evaluate_plan(target)`이 예외를 던지도록 만들 수 있다면 그 target 만 조용히 스킵되고 다른 target 은 정상 통과한다 — 로그상 "clean" 과 "예외로 스킵" 이 구분되지 않는다. 1차 리뷰에서 이미 지적된 항목이며 파일 전체의 "훅 오류로 세션을 멈추지 않는다" 철학과 일관된 의도된 설계다. `traceback.print_exc`는 호출되지만 어느 target 에서 실패했는지는 트레이스백 본문에서 추론해야 한다.
  - 제안(선택, 낮은 우선순위): 예외 스킵 시 어느 target 인지 stderr 에 명시하면 사후 진단이 쉬워짐.

## 인젝션/시크릿/인증/암호화 체크리스트

- SQL/XSS/LDAP 인젝션: 해당 없음(DB·웹 계층 없음).
- 커맨드 인젝션: 모든 `subprocess.run`이 리스트 인자 + `shell=True` 미사용. 확인.
- 경로 탐색: `os.path.realpath()`(441, 443행) 는 심볼릭 링크 정규화용 dedup 일 뿐 접근 제어 결정에 쓰이지 않음.
- 하드코딩된 시크릿: 코드·테스트·plan 문서·1차 리뷰 산출물 전 파일에서 API 키/비밀번호/토큰/인증서 없음.
- 인증/인가: 이 파일 자체가 "리뷰 안 된 push 차단" 컴플라이언스 게이트이며, 이번 diff 는 그 게이트의 커버리지 구멍(다른 worktree 에서 push 시 미검사=false ALLOW)을 닫는 방향. `BYPASS_REVIEW_GUARD`/`BYPASS_PLAN_GUARD` 는 기존부터 있던 명시적 escape hatch로 변경 없음, `_run_gate` 506행에서 여전히 존중됨.
- 정규식: `_BRANCH_CHAR = re.compile(r"[A-Za-z0-9._/-]")` 단일 문자 클래스, ReDoS 위험 없음. `_mentions_branch` 는 정규식이 아닌 `str.find` 기반 substring 스캔으로 지수적 백트래킹 자체가 불가능.
- 암호화: 해당 없음(암호화/해시 미사용).
- 에러 처리: stderr 노출 정보는 로컬 경로 수준, 민감 정보(자격증명 등) 없음.
- 의존성 보안: 표준 라이브러리(`subprocess`, `inspect`, `os`, `re`, `json`, `sys`, `traceback`)만 사용, 신규 서드파티 의존성 없음.
- 테스트 파일(`test_push_guard_worktree_scope.py`): 임시 디렉터리에 실 git 저장소를 만들어 서브프로세스로 훅을 실행. `env=dict(os.environ)`을 그대로 서브프로세스에 전달하지만 로컬 테스트 프로세스 환경이며 값을 로그/파일에 쓰지 않음. 시크릿 없음.
- 리뷰 산출물(`RESOLUTION.md`/`SUMMARY.md`/`_retry_state.json`/`meta.json`/개별 reviewer `.md`): 모두 로컬 절대경로(`/Volumes/project/...`)와 서술형 텍스트만 포함, 시크릿·자격증명 없음.

## 요약

1차 리뷰(17_28_02)에서 이 관점이 낸 유일한 WARNING — `_mentions_branch`/`_push_targets` 에 길이 상한이 없어 대형 커맨드 입력 시 O(n²) 알고리즘적 지연(이 훅이 모든 Bash 호출을 동기 게이팅하므로 곧 세션 행)으로 이어질 수 있다는 지적 — 이 `_push_targets` 진입 시 `_MAX_REDACTION_INPUT` 절단으로 실제 코드에 반영되어 있음을 확인했다. 아울러 1차 리뷰가 diff 범위 밖이라 미확인으로 남겼던 "`review_guard.py`/`plan_guard.py`가 `cwd` 를 실제로 소비하는가"도 직접 열람해 두 함수 모두 전달받은 `cwd`를 git 서브프로세스 체인 전체에 전파함을 확인했다 — `_accepts_cwd` probe-and-scope 설계가 실효성 있게 작동하며, 이번 PR 이 닫으려던 false-ALLOW 구멍이 실제로 닫혔다. 새로 추가된 worktree 토폴로지 코드(`_worktree_branches`/`_mentions_branch`/`_push_targets`/`_run_gate`)는 리스트-인자 subprocess(셸 인젝션 없음), fail-open 예외 처리, 하드코딩 시크릿 없음 등 이 저장소 harness 코드의 기존 보안 관례를 그대로 따른다. 남은 항목은 모두 INFO 수준(로컬 스택트레이스 노출, per-target fail-open 로그 구분 불가, payload `cwd` 부재 시 pre-fix 동작으로의 의도된 폴백)이며 이미 코드/문서에 근거가 남아 있거나 실무 영향이 낮은 설계상 트레이드오프다. CRITICAL·WARNING 모두 없음.

## 위험도

LOW
