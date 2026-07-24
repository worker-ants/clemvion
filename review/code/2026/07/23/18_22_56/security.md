# 보안(Security) 리뷰 — push-guard-worktree-scope (4차, 18_22_56)

대상: `.claude/hooks/guard_review_before_push.py` (worktree 스코프 확장 + `_run_gate` 추출,
전 라운드 WARNING 전부 반영된 최종 상태, 커밋 `89c3870b4`), `.claude/tests/test_push_guard_worktree_scope.py`
(20건, `test_push_targets_crash_falls_back_to_cwd` 신설분 포함), `.claude/tests/README.md`,
`plan/in-progress/push-guard-worktree-scope.md`, 그리고 1~3차(17_28_02/17_51_28/18_06_41) 리뷰
산출물 전체(`RESOLUTION.md`/`SUMMARY.md`/각 reviewer `.md`/`_retry_state.json`/`meta.json`).

이 변경은 웹앱이 아니라 **push 이전 코드 리뷰를 강제하는 내부 harness 컴플라이언스 게이트**를
다룬다. 위협 모델은 "외부 공격자"가 아니라 "게이트를 (의도치 않게 또는 의도적으로) 우회하는
커맨드/에이전트"이며, 이 diff 자체가 기존 false-ALLOW(교차-worktree 리뷰 우회) 결함을 닫는
정합성 수정이다. `.claude/hooks/guard_review_before_push.py`를 직접 열어 최종 상태(커밋
`89c3870b4`)를 확인했고, 1~3차 Security 리뷰가 각각 낸 결론(길이 상한 WARNING → 반영 확인,
이후 전부 LOW/INFO)과 `git diff 942412ea3..89c3870b4 --stat`으로 최종 커밋의 실제 변경분(테스트
1건 + 문서만, 훅 본체 무변경)을 직접 대조했다.

## 발견사항

- **[INFO]** 커맨드 인젝션 표면 없음
  - 위치: `.claude/hooks/guard_review_before_push.py:357-367` (`_worktree_branches` 내부 `subprocess.run(["git", "worktree", "list", "--porcelain"], cwd=cwd, timeout=5.0)`)
  - 상세: 인자는 고정 리스트이며 `shell=True`를 쓰지 않아 셸 메타문자 인젝션 표면이 없다. `cwd`가 존재하지 않거나 git 저장소가 아니어도 `returncode != 0` 체크(368-369행)와 `except Exception: return []`(370-371행)로 fail-open 흡수되고, `timeout=5.0`으로 wedge 된 저장소에서의 훅 행(hang)을 방지한다.
  - 조치 불요.

- **[INFO]** 새 branch-매칭 경로의 알고리즘적 DoS 우려(1차 Security WARNING)가 실제로 닫혀 있고 회귀 테스트로 고정됨
  - 위치: `.claude/hooks/guard_review_before_push.py:439` (`command = command[:_MAX_REDACTION_INPUT]`, `_push_targets` 진입부), `.claude/tests/test_push_guard_worktree_scope.py:322-356` (`test_oversized_command_still_checks_cwd`, `test_branch_mention_past_the_cap_is_not_scanned`)
  - 상세: 1차 라운드(17_28_02)가 지적한 "`_mentions_branch`/`_push_targets`가 이 파일의 다른 손수 작성 스캔과 달리 `_MAX_REDACTION_INPUT` 상한의 보호를 받지 않는다"는 WARNING은 진입부 truncation으로 반영되어 있고, 상한을 넘긴 branch 언급은 실제로 드롭되며(픽스 확인용 테스트) 상한 안쪽 언급은 여전히 잡힘(대조 테스트)을 e2e로 직접 단언한다. 절단은 branch 언급을 드롭할 뿐(→ 그 branch에 한해 pre-fix 동작) cwd 검사 자체는 절대 약화시키지 않는다 — cwd는 `targets = [cwd]`로 truncation 이전에 이미 포함된다.
  - 조치 불요 — 검증 완료.

- **[INFO]** 게이트 우회 표면(`BYPASS_REVIEW_GUARD`/`BYPASS_PLAN_GUARD`)이 scoped target 확장에도 그대로, 약화 없이 적용됨
  - 위치: `.claude/hooks/guard_review_before_push.py:506` (`if evaluate is None or os.environ.get(bypass_env) == "1": return False`), `.claude/tests/test_push_guard_worktree_scope.py:184-203` (`test_bypass_still_applies_to_scoped_targets`)
  - 상세: bypass 검사는 게이트당 1회이며(target별이 아님) 여러 worktree를 평가하도록 확장된 뒤에도 기존 escape-hatch 계약과 동일하게 동작한다. 확대된 스코프가 우회를 더 어렵게도, 더 쉽게도 만들지 않는다.
  - 조치 불요.

- **[INFO]** per-target fail-open 및 `main()`의 target-선택 폴백 — 두 개의 독립된 false-ALLOW 경로가 이번 브랜치 내에서 각각 발견·수정·테스트로 고정됨
  - 위치: `_run_gate`(`.claude/hooks/guard_review_before_push.py:494-520`) 의 `except Exception: continue`(516행) — `.claude/tests/test_push_guard_worktree_scope.py:246-261`(`test_per_target_fail_open_still_checks_remaining_targets`)로 고정. `main()`의 `_push_targets` 호출부(`:535-539`) 의 `except Exception: traceback.print_exc(...); targets = [base_cwd]` — `.claude/tests/test_push_guard_worktree_scope.py:280-320`(`test_push_targets_crash_falls_back_to_cwd`)로 고정.
  - 상세: 이 두 경로는 이름과 모양이 비슷하지만 서로 다른 지점이다(하나는 `_worktree_branches` 자체의 빈 리스트 반환, 다른 하나는 `_run_gate`의 target 루프 내 예외, 또 다른 하나는 `main()`의 `_push_targets` 호출 자체의 예외) — RESOLUTION.md(18_06_41) 스스로가 "2차에서 커버로 잘못 표기했던 경로가 실제로는 미검증이었다"를 mutation(`targets = [] `가 39/39 green으로 생존)으로 실측 발견·정정한 이력을 코드/테스트와 대조해 확인했다. 이 클래스 전체(cwd만 평가되고 실제 push 대상 worktree가 조용히 스킵되는 것)가 이 PR이 닫으려는 정확히 그 취약점이므로, 지금 두 경로 모두 회귀 테스트로 고정되어 있다는 점은 Security 관점에서 유의미하다.
  - 조치 불요 — 검증 완료.

- **[INFO]** `traceback.print_exc(file=sys.stderr)` — 로컬 파일 경로 스택트레이스 노출 (기존 패턴, 신규 아님)
  - 위치: `.claude/hooks/guard_review_before_push.py:44`(import 실패), `:515`(`_run_gate` per-target 예외), `:538`(`main()`의 `_push_targets` 예외)
  - 상세: 노출 정보는 로컬 워크트리 절대경로 수준으로 민감도가 낮고, stderr는 이 훅을 실행한 본인(에이전트/개발자)만 본다. 자격증명·시크릿 노출 없음.
  - 조치 불요.

## 인젝션/시크릿/인증/암호화 체크리스트

- SQL/XSS/LDAP 인젝션: 해당 없음 (DB·웹 계층 없음, 순수 로컬 CLI 훅).
- 커맨드 인젝션: 유일한 신규 `subprocess.run` 호출(`_worktree_branches`)이 리스트 인자 + `shell=True` 미사용. 확인.
- 경로 탐색: `os.path.realpath()`(441·443행)는 심볼릭 링크 정규화 목적의 dedup일 뿐 접근 제어 결정에 쓰이지 않는다. `os.path.isdir(path)`(444행)로 디스크에서 삭제된 worktree 항목을 스킵.
- 하드코딩된 시크릿: `guard_review_before_push.py`, `test_push_guard_worktree_scope.py`, `plan/in-progress/push-guard-worktree-scope.md`, 1~3차 review 산출물 전체에서 API 키/토큰/비밀번호/인증서 패턴 없음 (전부 서술형 텍스트·테스트 경로 문자열).
- 인증/인가: 이 파일 자체가 "리뷰 안 된 push 차단" 컴플라이언스 게이트이며, 이번 diff는 그 게이트의 기존 커버리지 구멍(cwd와 다른 worktree에서 push 시 미검사 = false ALLOW)을 닫는 방향의 수정. 이번 브랜치 안에서 발견된 두 잔여 fail-open 경로(per-target, target-선택 폴백)도 모두 반영·테스트 고정됨을 재확인.
- 정규식: `_BRANCH_CHAR = re.compile(r"[A-Za-z0-9._/-]")` 단일 문자 클래스, ReDoS 위험 없음. `_mentions_branch`는 정규식이 아닌 `str.find` 기반 선형 substring 스캔.
- 암호화: 해당 없음 (암호화/해시 미사용).
- 에러 처리: stderr 노출 정보는 로컬 경로 수준, 민감 정보(자격증명 등) 없음.
- 의존성 보안: 표준 라이브러리(`subprocess`, `inspect`, `os`, `re`, `json`, `sys`, `traceback`)만 사용, 신규 서드파티 의존성 없음.

## 요약

이번 4차 라운드는 1~3차 Security 리뷰가 이미 CRITICAL 0 / WARNING 0(3차 이후)으로 수렴시킨
상태에서 출발했고, 최종 커밋(`89c3870b4`)의 실제 변경분이 테스트 1건(`test_push_targets_crash_falls_back_to_cwd`)과
plan/RESOLUTION 문서뿐(훅 본체 `guard_review_before_push.py`는 이번 커밋에서 무변경)임을
`git diff`로 직접 확인했다. 소스를 처음부터 다시 읽어 대조한 결과, 1차가 지적했던 유일한
Security WARNING(길이 상한 부재로 인한 알고리즘적 DoS 가능성)은 truncation + 전용 회귀 테스트로
닫혀 있고, 커맨드 인젝션·경로 탐색·하드코딩된 시크릿·인증 우회·안전하지 않은 암호화·민감정보
노출 중 어느 범주에서도 새 결함은 없다. 이 PR이 실제로 닫은 두 개의 false-ALLOW 경로(per-target
fail-open, `main()`의 target-선택 폴백)는 모두 이번 브랜치 안에서 스스로 발견·수정·테스트로
고정되어 있다는 점에서, 게이트 자체의 보안 목적(리뷰 우회 차단)에 부합하는 방향으로 완결되어
있다. CRITICAL·WARNING 모두 없음.

## 위험도

LOW
