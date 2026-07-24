# 보안(Security) 리뷰 — push-guard-worktree-scope (3차, 18_06_41)

대상: `.claude/hooks/guard_review_before_push.py`(worktree 스코프 확장 + `_run_gate` 리팩터,
`base_cwd` 죽은 매개변수 제거分 포함), `.claude/tests/test_push_guard_worktree_scope.py`(신규
18건, `test_per_target_fail_open_still_checks_remaining_targets` 포함), `.claude/tests/README.md`,
`plan/in-progress/push-guard-worktree-scope.md`, 그리고 1차(17_28_02)·2차(17_51_28) 리뷰 산출물
전체(`RESOLUTION.md`/`SUMMARY.md`/각 reviewer `.md`/`_retry_state.json`/`meta.json`).

이 변경은 웹앱이 아니라 **push 이전 코드 리뷰를 강제하는 내부 harness 컴플라이언스 게이트**를
다룬다. 위협 모델은 "외부 공격자"가 아니라 "게이트를 (의도치 않게 또는 의도적으로) 우회하는
커맨드/에이전트"이며, 이 diff 자체가 기존 false-ALLOW(교차-worktree 리뷰 우회) 결함을 닫는
정합성 수정이다. 1차 리뷰가 낸 유일한 Security WARNING(길이 상한 부재)은 2차에서 코드 반영을
확인했고, 2차의 두 WARNING(Testing: per-target fail-open 무검증 / Maintainability: `base_cwd`
죽은 파라미터)은 Security 카테고리 자체 발견이 아니었지만, 그 fix 가 게이트 우회 표면에 영향을
주는지 이번 라운드에서 직접 재검증했다.

## 발견사항

- **[INFO]** 2차 WARNING 1(`_run_gate` per-target fail-open 불변식 무검증)이 실제 회귀 테스트로
  반영됨을 코드로 확인 — 이 불변식은 게이트 우회 표면과 직결되므로 Security 관점에서도 유의미
  - 위치: `.claude/hooks/guard_review_before_push.py:494-520`(`_run_gate`), `.claude/tests/test_push_guard_worktree_scope.py:246-261`(`test_per_target_fail_open_still_checks_remaining_targets`)
  - 상세: 2차 라운드는 mutation(`continue`→`return False`)을 적용해도 기존 38/38 테스트가 green 이었음을 실측했다 — 즉 "cwd(첫 target) 평가에서 예외가 나면 이후 target(실제 push 대상 worktree)을 검사하지 않고 게이트 전체를 통과"시키는 회귀를 어떤 테스트도 잡지 못했다. 이번 라운드에서 추가된 `test_per_target_fail_open_still_checks_remaining_targets`는 `raise_paths=[self.main_wt]`(cwd 가 예외를 던짐)와 `blocked_paths=[self.side_wt]`(두 번째 target 이 dirty)를 조합해, cwd 에서 예외가 나도 두 번째 target 이 여전히 평가되어 `returncode==2`가 됨을 단언한다. 이 테스트가 없으면 향후 리팩터가 `continue`를 실수로 `return`/`break`로 바꿔도 조용히 false-ALLOW 로 회귀할 수 있었는데, 이제 그 클래스가 핀 되었다.
  - 조치 불요 — 검증 완료 확인.

- **[INFO]** 2차 WARNING 2(`_run_gate`의 `base_cwd` 죽은 파라미터)가 실제로 제거됨을 확인
  - 위치: `.claude/hooks/guard_review_before_push.py:494`(`def _run_gate(evaluate, bypass_env, targets, *, is_blocked, render) -> bool:`), `:542-561`(호출부 두 곳, 위치 인자 없이 키워드 인자만 사용)
  - 상세: 시그니처에서 `base_cwd`가 사라졌고, 두 호출부(`_run_gate(evaluate_review, ...)` / `_run_gate(evaluate_plan, ...)`) 모두 이제 `is_blocked=`/`render=` 키워드 인자만 넘긴다. 죽은 파라미터 자체는 기능적 부작용이 없었지만(2차 side_effect 리뷰가 이미 확인), 코드-주석 간극이 향후 "scoped 분기가 `base_cwd`를 쓴다"는 오해로 이어질 잠재적 유지보수 리스크였다는 점에서 Security 관점의 명확성도 개선됨(unscoped legacy 분기가 `os.getcwd()`를 쓰는 이유에 대한 주석 511행과 실제 동작이 이제 완전히 일치).
  - 조치 불요.

- **[INFO]** 커맨드 인젝션 표면 없음 — `subprocess.run(["git", "worktree", "list", "--porcelain"], cwd=cwd, timeout=5.0)`
  - 위치: `.claude/hooks/guard_review_before_push.py:357-367`(`_worktree_branches`)
  - 상세: 인자는 고정 리스트, `shell=True` 미사용이라 셸 메타문자 인젝션 표면이 없다. `cwd`가 비-git 디렉터리이거나 존재하지 않아도 `except Exception: return []`(370-371행) 및 `returncode != 0` 체크(368-369행)로 fail-open 흡수되며, `timeout=5.0`으로 wedge 된 저장소에서의 훅 행(hang)을 방지한다. 이 subprocess 호출부는 이번 라운드에서 변경되지 않았다(1차·2차와 동일).
  - 조치 불요.

- **[INFO]** `_mentions_branch`/`_push_targets`의 길이 상한이 정확히 유지·핀됨
  - 위치: `.claude/hooks/guard_review_before_push.py:439`(`command = command[:_MAX_REDACTION_INPUT]`), `.claude/tests/test_push_guard_worktree_scope.py:275-309`(`test_oversized_command_still_checks_cwd`, `test_branch_mention_past_the_cap_is_not_scanned`)
  - 상세: 1차 라운드가 지적했던 "길이 상한 부재 → O(n²) DoS/훅 행" WARNING의 fix(진입부 truncation)가 이번 라운드에서도 그대로 유지되며, 이제는 상한을 넘긴 branch 언급이 실제로 드롭됨과(첫 테스트) 상한 안쪽 언급은 여전히 잡힘(대조 테스트)을 e2e 로 직접 단언한다 — 상한이 관측 가능해져 향후 회귀(상한 삭제 또는 과도한 절단)를 조용히 통과시키지 않는다. 절단은 branch 언급을 드롭만 하므로(→ 그 branch 에 한해 pre-fix 동작) cwd 검사 자체를 약화시키지 못하는 성질도 그대로다.
  - 조치 불요.

- **[INFO]** 게이트 우회 표면(BYPASS 변수) 변경 없음, scoped 대상에도 정상 적용됨을 재확인
  - 위치: `.claude/hooks/guard_review_before_push.py:506(`os.environ.get(bypass_env) == "1"`), `.claude/tests/test_push_guard_worktree_scope.py:184-203`(`test_bypass_still_applies_to_scoped_targets`)
  - 상세: `BYPASS_REVIEW_GUARD`/`BYPASS_PLAN_GUARD`는 게이트당 1회만 검사되어(target 별이 아님) bypass 시 스코프 확장된 target 전체를 건너뛴다 — 기존 escape-hatch 계약과 일치하며 이번 diff 로 약화되지 않았다.
  - 조치 불요.

- **[INFO]** `traceback.print_exc(file=sys.stderr)` — 로컬 파일 경로 스택트레이스 노출(기존 패턴, 신규 아님)
  - 위치: `.claude/hooks/guard_review_before_push.py:44`(import 실패), `:515`(`_run_gate` per-target 예외), `:538`(`main()`의 `_push_targets` 예외)
  - 상세: 노출 정보는 로컬 워크트리 절대경로 수준으로 민감도가 낮고, 이 훅을 실행한 본인(에이전트/개발자)만 stderr 를 본다. 자격증명·시크릿 노출 없음. 1·2차와 동일 결론.
  - 조치 불요.

## 인젝션/시크릿/인증/암호화 체크리스트

- SQL/XSS/LDAP 인젝션: 해당 없음(DB·웹 계층 없음).
- 커맨드 인젝션: 모든 `subprocess.run` 호출이 리스트 인자 + `shell=True` 미사용. 확인.
- 경로 탐색: `os.path.realpath()`(441·443행)는 심볼릭 링크 정규화용 dedup 일 뿐 접근 제어 결정에 쓰이지 않음. `os.path.isdir(path)`(444행)로 삭제된 worktree 항목을 스킵.
- 하드코딩된 시크릿: 코드·테스트·plan 문서·1·2차 리뷰 산출물 전체에서 `grep -RniE "api[_-]?key|secret|password|token|AKIA|BEGIN .*PRIVATE KEY"` 실행 결과 실제 시크릿 없음(매치는 "substring/tokenization" 프로즈뿐).
- 인증/인가: 이 파일 자체가 "리뷰 안 된 push 차단" 컴플라이언스 게이트이며, 이번 diff 는 그 게이트의 커버리지 구멍(cwd 와 다른 worktree 에서 push 시 미검사=false ALLOW)을 닫는 방향. 1·2차에서 지적된 두 잔여 위험(per-target fail-open 무검증, `_accepts_cwd` 계약 미고정)은 각각 `test_per_target_fail_open_still_checks_remaining_targets`와 `AcceptsCwdContractTest`로 이미 이전 라운드에 핀 되어 있고, 이번 라운드 코드에도 그대로 살아있음을 재확인.
- 정규식: `_BRANCH_CHAR = re.compile(r"[A-Za-z0-9._/-]")` 단일 문자 클래스, ReDoS 위험 없음. `_mentions_branch`는 정규식이 아닌 `str.find` 기반 substring 스캔.
- 암호화: 해당 없음(암호화/해시 미사용).
- 에러 처리: stderr 노출 정보는 로컬 경로 수준, 민감 정보(자격증명 등) 없음.
- 의존성 보안: 표준 라이브러리(`subprocess`, `inspect`, `os`, `re`, `json`, `sys`, `traceback`)만 사용, 신규 서드파티 의존성 없음.
- 리뷰 산출물(1·2차 `RESOLUTION.md`/`SUMMARY.md`/`_retry_state.json`/`meta.json`/개별 reviewer `.md`): 로컬 절대경로(`/Volumes/project/...`)와 서술형 텍스트만 포함, 시크릿·자격증명 없음.

## 요약

이번 3차 라운드는 1·2차 보안 리뷰가 각각 LOW로 판정한 상태에서 출발했고, 2차가 남긴 두 잔여
항목(Testing: `_run_gate` per-target fail-open 무검증 / Maintainability: `base_cwd` 죽은
파라미터)이 모두 코드에 실제 반영되었음을 직접 확인했다 — 특히 per-target fail-open 회귀 테스트는
"cwd 에러 시 실제 push 대상 worktree 검사를 건너뛰는" false-ALLOW 회귀를 이제 e2e 로 직접 잡아낸다.
새로운 커맨드 인젝션·시크릿 노출·인증 우회 결함은 발견되지 않았고, 길이 상한·bypass 존중·
fail-open 방향 등 이전 라운드가 확인한 안전 속성은 이번 diff 에서도 유지된다. CRITICAL·WARNING
모두 없음.

## 위험도

LOW
