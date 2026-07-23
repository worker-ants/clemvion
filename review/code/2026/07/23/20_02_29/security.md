# 보안(Security) 리뷰 결과

## 리뷰 범위

`.claude/hooks/guard_default_branch_bash.py` 의 `_MUTATING` 정규식에 `VAR=value` 접두 스킵을
추가하고, 명령을 `&&`/`||`/`;`/`|`/개행으로 분리한 각 세그먼트의 첫 토큰에 기존 앵커 패턴을
적용하도록 바꾼 변경(+ 관련 테스트/문서/plan 갱신). 이 훅은 **PreToolUse(Bash) soft nudge** —
default branch 위에서 mutating 명령을 감지하면 세션당 1회 reminder 를 출력할 뿐, 어떤 것도
차단하지 않는다(실제 강제는 `guard_default_branch_edit.py`·`.githooks/pre-commit`).

## 발견사항

- **[INFO]** ReDoS(정규식 서비스 거부) 후보 여부 — 검증 결과 문제 없음
  - 위치: `.claude/hooks/guard_default_branch_bash.py:69` (`_MUTATING` 의 신규 `(?:[A-Za-z_][A-Za-z0-9_]*=\S+\s+)*` 접두 그룹), `:111` (`_SEGMENT_SPLIT`)
  - 상세: 동일 변경 계열(push 가드, `plan/complete/harness-push-guard-subcommand-detection.md`)이 과거 3라운드에 걸쳐 지수 백트래킹 CRITICAL 을 냈던 이력이 있어, 이번 `VAR=value` 반복 그룹과 세그먼트 분할 정규식도 같은 위험이 있는지 직접 실측했다. `A=11111 ` × 32,000 반복, `x`×80,000(공백 없는 단일 토큰), `;` 로 구분된 200,000 세그먼트 각각에 대해 실행 시간이 선형(수십 ms 이내)으로 증가함을 확인 — 지수 백트래킹 없음. 각 `VAR=value` 토큰이 뒤따르는 필수 `\s+` 로 모호성 없이 경계가 고정되고, `_SEGMENT_SPLIT` 은 리터럴 대안만 있는 비-중첩 정규식이라 구조적으로 안전하다. 이 훅은 모든 Bash 호출을 동기적으로 게이팅하므로 ReDoS 는 세션 정지로 이어질 CRITICAL 등급이었을 것이나, 실측상 해당 없음.
  - 제안: 없음 (검증 완료, 조치 불필요). 참고로 이 훅에는 push 가드처럼 입력 상한(16KB)이 없는데, 선형 스케일링이 확인됐으므로 이번 변경 범위에서는 문제가 되지 않는다 — 다만 향후 `_MUTATING` 에 중첩 quantifier(`(a+)+` 류)를 추가할 경우 재검증이 필요하다는 점만 기록해 둔다.

- **[INFO]** `_is_mutating` 은 차단 권한이 없는 순수 advisory 신호 — 우회 가능성이 보안적으로 무의미
  - 위치: `.claude/hooks/guard_default_branch_bash.py:114-119` (`_is_mutating`), 및 새 테스트 `AcknowledgedFalsePositiveTest`/`OutOfScopeTest` (`.claude/tests/test_guard_default_branch_bash_mutating.py:98-129`)
  - 상세: 세그먼트 분할이 인용을 모르는 점(`echo "a && rm -rf x"` 오탐), 간접 실행(`xargs`, `bash -c`, `find -exec`)을 분류하지 못하는 점 모두 문서·테스트로 명시적으로 인정된 한계다. 이 훅은 절대 차단하지 않고 세션당 1회 reminder 만 출력하므로, 이 한계를 악용해 "얻을 수 있는" 이득이 없다(실제 강제는 `guard_default_branch_edit.py`(Write/Edit 차단)와 `.githooks/pre-commit`(commit 차단) 두 개의 독립된 hard gate 가 담당). 즉 여기서 발견된 분류 갭은 보안 결함이 아니라 UX 트레이드오프다.
  - 제안: 없음. 다만 이 훅의 docstring/plan 서술이 앞으로도 "soft nudge, never blocks" 라는 계약을 유지하는지 — 즉 이 파일이 실수로 차단 로직을 갖게 되는 회귀가 생기면 그 순간부터 위 오탐/미탐 클래스가 실제 보안 영향(잘못된 차단 또는 잘못된 통과)을 가지므로, 그런 변경이 발생하면 이 리뷰의 결론을 재검토해야 한다.

- **[INFO]** (Diff 밖, 참고용) `_mark_warned`/`_already_warned` 의 `session_id` 를 검증 없이 `os.path.join` 에 사용
  - 위치: `.claude/hooks/guard_default_branch_bash.py:127-145` (전체 파일 컨텍스트 기준 — 이번 diff 의 변경 대상 아님, hunk 밖)
  - 상세: `session_id = payload.get("session_id") or payload.get("sessionId")` 를 `os.path.join(_state_dir(), session_id)` 에 그대로 사용한다. `session_id` 에 `../` 등이 포함되면 이론적으로 경로 이탈이 가능하나, 이 값은 Claude Code 하네스가 자체 발급해 PreToolUse payload 로 넘기는 내부 신뢰 값이며 원격/외부 사용자 입력이 아니다. 이번 변경(`_MUTATING`/`_SEGMENT_SPLIT`)과 무관하고 이 diff 가 건드리지 않은 기존 코드라 스코프 밖이지만, 완전성을 위해 기록한다.
  - 제안: 조치 불요 (스코프 밖, 신뢰 경계 내부). 추후 이 함수를 손볼 일이 있으면 `os.path.basename(session_id)` 정도의 방어적 정규화를 곁들이는 것을 고려할 수 있다.

- **[INFO]** 인젝션/시크릿/인증/암호화/에러 노출/의존성 항목 — 해당 없음
  - 위치: 리뷰 대상 6개 파일 전체 (`.claude/docs/worktree-policy.md`, `.claude/hooks/guard_default_branch_bash.py`, `.claude/tests/README.md`, `.claude/tests/test_guard_default_branch_bash_mutating.py`, `plan/complete/harness-push-guard-subcommand-detection.md`, `plan/in-progress/harness-guard-followups.md`)
  - 상세: SQL/XSS/커맨드 인젝션 표면 없음(외부 입력을 실행하는 코드 경로가 없고, 정규식 매칭·문자열 분할만 수행), 하드코딩된 시크릿 없음, 인증/인가 로직 변경 없음(이 훅은 애초에 인가 메커니즘이 아니라 넛지), 해시/암호화 사용 없음, 예외 처리는 기존과 동일하게 fail-open(`traceback.print_exc(file=sys.stderr)` 후 `sys.exit(0)`)이며 스택트레이스는 로컬 stderr 로만 가고 원격에 노출되지 않는다. 신규 의존성 없음(표준 라이브러리 `re`만 사용, 프로젝트 컨벤션 — 하네스 훅은 zero third-party dependency — 준수).
  - 제안: 해당 없음.

## 요약

이번 변경은 프로덕션 코드가 아니라 **로컬 개발 하네스의 non-blocking advisory 훅**(default branch 위에서 mutating Bash 명령을 감지해 세션당 1회 리마인더만 출력)의 분류 로직을 손보는 것으로, 외부 입력·네트워크·인증·암호화·시크릿과 접점이 없다. 가장 우려됐던 지점 — 동일 저장소의 push 가드가 과거 3라운드에 걸쳐 겪은 ReDoS(지수 백트래킹) CRITICAL 재발 가능성 — 은 새로 추가된 `VAR=value` 반복 그룹과 세그먼트 분할 정규식을 직접 실측(최대 20만 문자급 적대적 입력)해 선형 스케일링임을 확인했고, 문제되는 패턴이 없었다. 세그먼트 분할이 셸 인용을 모르는 한계(오탐)와 간접 실행을 못 잡는 한계(미탐)는 문서·테스트로 명시적으로 인정돼 있으나, 이 훅이 애초에 차단 권한이 없는 넛지이므로 보안적으로 악용 가능한 우회가 아니다. Diff 밖에서 발견한 `session_id` 의 미검증 경로 결합은 신뢰 경계 내부 값이라 실질 위험이 없고 이번 변경과 무관하다. 전반적으로 보안 관점에서 조치가 필요한 사항은 없다.

## 위험도

NONE
