# 문서화(Documentation) 리뷰 — push-guard-worktree-scope (2차, 17_51_28)

이번 diff 는 (1) `guard_review_before_push.py` 의 cross-worktree scoping fix 본체, (2) 신규 테스트
`test_push_guard_worktree_scope.py`, (3) 테스트 카탈로그 `README.md` 1행, (4) 신규 plan 문서, (5) 1차
리뷰(17_28_02)의 산출물 일체(SUMMARY/RESOLUTION/각 리뷰어 md/meta.json/_retry_state.json — 프로젝트
관례상 `review/` 는 커밋 대상)로 구성된다. 코드는 1차 리뷰 WARNING 1~5·7 을 반영해 `_run_gate()` 추출,
PLAN 스코핑 테스트, fail-open 테스트, `_accepts_cwd` 계약 테스트, 길이 상한을 추가한 상태다.

## 발견사항

- **[WARNING]** `_run_gate()` 신설 파라미터 `base_cwd` 가 함수 본문 어디에서도 쓰이지 않음 (dead parameter) — 인접 주석이 그 존재를 정당화하는 듯 보이지만 실제로는 아무 역할이 없음
  - 위치: `.claude/hooks/guard_review_before_push.py` 494행(`def _run_gate(evaluate, bypass_env, targets, base_cwd, is_blocked, render) -> bool:`), 509-510행(주석), 546행·557행(호출부 `base_cwd,`)
  - 상세: `grep -n "base_cwd"` 로 직접 확인한 결과 `_run_gate` 본문(494-520행) 안에서 `base_cwd` 를 참조하는 코드는 없다. 함수 바로 아래 주석("Unscoped legacy fallback evaluates the process cwd, so report that as the worktree rather than `base_cwd` (the payload's), which it never consulted.")은 *legacy fallback 분기가 왜 `base_cwd` 대신 `os.getcwd()` 를 쓰는가* 만 설명하고, **scoped 분기도 `base_cwd` 를 전혀 쓰지 않는다**(`target` 을 직접 쓴다)는 사실은 언급하지 않는다. 즉 이 주석을 읽은 독자는 "`base_cwd` 가 (적어도 한쪽 분기에서는) 뭔가에 관여한다"는 인상을 받기 쉽지만, 실제로는 6개 파라미터 중 유일하게 함수 본문에서 완전히 죽어 있는 파라미터다. 1차 리뷰(WARNING 4, 아키텍처/유지보수성)가 요구한 DRY 추출 자체는 정확히 수행됐지만, 그 리팩터링 과정에서 원래 두 호출부(REVIEW/PLAN 루프)에 있던 `base_cwd` 참조가 통째로 사라지면서 파라미터만 남은 것으로 보인다(회귀 방지용 안전 여유로 남겼을 수도 있으나 그 의도가 코드 어디에도 서술돼 있지 않다).
  - 제안: 정말 향후 확장을 위해 남겨둔 것이라면 docstring 에 "reserved for future per-gate cwd fallback" 같은 한 줄을 추가하거나, 아니면 파라미터를 제거해 시그니처를 실제 사용 범위와 일치시킬 것. 기능적 결함은 아니나(Python 은 미사용 인자를 에러로 취급하지 않음), 리팩터링 직후의 문서-코드 간극이라 지금 정리하는 비용이 가장 낮다.

- **[INFO]** (1차 리뷰 INFO 8 이월, 여전히 미반영·의도적 보류) 모듈 최상단 docstring 이 cross-worktree 평가 동작을 요약하지 않음
  - 위치: `.claude/hooks/guard_review_before_push.py` 1-24행 (module docstring) vs 316-349행 ("Which worktree(s) does this push publish?" 설계 블록)
  - 상세: 소스를 직접 열어 확인한 결과 최상단 docstring 은 여전히 "REVIEW gate / PLAN gate, 각각 하나의 override" 수준으로만 계약을 서술하며, 이번 PR 의 핵심(과거엔 cwd 만 봤다는 게 false-ALLOW 버그였고, 이제는 cwd + 언급된 branch 의 worktree 도 본다는 것)은 언급이 없다. `review/code/2026/07/23/17_28_02/RESOLUTION.md`(38행)가 이 항목을 "미조치 ... 비차단이며 리뷰어도 선택으로 분류" 로 명시적으로 보류했으므로 새 블로킹 사유는 아니지만, 코드가 다시 바뀌지 않는 한 이월된 사실 자체는 그대로 유효함을 재확인함.
  - 제안: (선택) 상단 docstring 에 "각 게이트는 cwd 뿐 아니라 push 명령이 이름을 언급한 다른 checked-out worktree 도 평가한다" 한 줄 추가.

- **[INFO]** (1차 리뷰 INFO 9 이월, 여전히 미반영·의도적 보류) `guard_review_before_stop.py` 가 이 fix 대상에서 제외된 이유가 어디에도 문장으로 없음
  - 위치: `.claude/hooks/guard_review_before_stop.py` 245행·262행 (`evaluate_review()`/`evaluate_plan()` 여전히 무인자 호출 — 직접 확인) / `.claude/hooks/guard_review_before_push.py` 316-349행 (신설 블록, Stop 훅 언급 없음) / `plan/in-progress/push-guard-worktree-scope.md` (Stop 훅 관련 서술 없음)
  - 상세: `grep -n "evaluate_review\|evaluate_plan" .claude/hooks/guard_review_before_stop.py` 로 재확인 — 245/262행에서 여전히 인자 없이 호출한다(cwd-only, 이번 fix 이전 동작 그대로). Stop 훅은 "지금 이 턴이 끝나는 worktree 자체"를 판정하는 것이라 다른 branch 를 지목할 대상 개념이 없어 구조적으로 스코프 밖이라는 설명은 합리적으로 보이지만, 그 판단이 코드·plan·이번 review 산출물 어디에도 문장으로 남아있지 않다. `RESOLUTION.md`(38행)가 이 항목도 명시적으로 보류했으므로 새 블로킹 사유는 아니다.
  - 제안: (선택) `guard_review_before_stop.py` 상단 또는 위 316행 블록에 "Stop 게이트는 대상 branch 개념이 없어(자기 turn 종료 판정) 이 스코프 밖" 한 줄.

## 검증한 항목 (문제 없음)

- 신규 헬퍼 4종(`_worktree_branches`/`_mentions_branch`/`_accepts_cwd`/`_push_targets`) 모두 실패 모드·설계 근거·실제 사고 사례(날짜 포함)를 담은 docstring 을 갖추고 있으며, 소스를 직접 읽고 대조한 결과 문서와 구현이 정확히 일치함(예: `_push_targets` docstring 의 "cwd first, de-duplicated" ↔ `targets = [cwd]` + `seen` set 구현).
- `.claude/tests/README.md` 신규 행이 실제 `test_push_guard_worktree_scope.py` 의 18개 테스트 메서드(1차 리뷰 반영으로 9→18건, 직접 카운트로 확인) 및 서술된 커버리지(false-ALLOW pin·경계 매칭·cwd 상시평가·blanket-block 아님·BYPASS 전파)와 1:1 대응.
- `plan/in-progress/push-guard-worktree-scope.md` 의 정량 주장 `harness 전체 485 passed` 를 `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` 로 직접 재실행해 **485 tests, OK** 로 실측 일치 확인.
- `CHANGELOG.md` 는 실제로 codebase(제품) 사용자 기능 변경만 기록하는 문서로 확인됨(헤더를 직접 열람 — 웹채팅 위젯·워크스페이스 라우팅 등 `spec/` 링크 항목만 존재). 이번 harness 전용 변경은 관례상 CHANGELOG 대상 밖 — 갱신 누락 아님(1차 documentation.md 의 판단 재확인).
- 1차 리뷰 산출물(`architecture.md`/`maintainability.md`/`security.md`/`performance.md`/`testing.md`/`scope.md`/`requirement.md`/`side_effect.md`)이 인용하는 소스 라인 번호는 `_run_gate` 추출 **이전**(커밋 `65e7626fb`) 시점 기준이라 현재 라인 번호와 다르지만, 각 문서가 자신을 "대상: 커밋 65e7626fb" 로 명시한 시점 스냅샷 감사 기록이므로 문제 아님 — CLAUDE.md 의 "review/ 는 커밋 대상" 관례와 일치하며 살아있는 문서로 오인될 위험도 낮음(문서 상단에 커밋 SHA 명시).
- `RESOLUTION.md` 의 WARNING 1~5·7 "반영" 서술을 소스와 대조: PLAN 스코핑(경로-키 `_PLAN_STUB` + 3건), fail-open 테스트 2건, `_run_gate()` 추출, `AcceptsCwdContractTest`, `_MAX_REDACTION_INPUT` 절단(439행 `command = command[:_MAX_REDACTION_INPUT]`) — 전부 실제 코드에 반영되어 있음을 직접 확인.
- `evaluate_review`/`evaluate_plan` 이 이미 `cwd: str | None = None` 시그니처임을 `_lib/review_guard.py:836`, `_lib/plan_guard.py:291` 에서 직접 확인 — `_accepts_cwd` probe-and-degrade 설계가 실제로 도달 가능한 경로임을 뒷받침.
- README API 문서·신규 환경변수 문서화 대상 없음(`BYPASS_REVIEW_GUARD`/`BYPASS_PLAN_GUARD` 는 기존 변수, `_REVIEW_MSG`/`_PLAN_MSG` 의 `worktree:` 라인 추가는 내부 stderr 포맷일 뿐 외부 계약 아님 — 1차 side_effect.md 가 이미 grep 으로 확인).

## 요약

핵심 문서화 자산(신규 헬퍼 docstring, 테스트 카탈로그, plan 설계 문서, mutation/pass-count 실측 주장)은 소스와 대조해 정확함을 직접 확인했고 전반적으로 매우 높은 수준을 유지한다. 이번 라운드에서 새로 눈에 띄는 것은 1차 리뷰 WARNING 4(DRY)를 해소하며 신설한 `_run_gate()` 의 `base_cwd` 파라미터가 실제로는 어디서도 쓰이지 않는데도 인접 주석이 그 존재에 의미가 있는 것처럼 읽히는 문서-코드 간극(WARNING) 하나뿐이며, 기능적 결함은 아니다. 나머지 두 항목(모듈 상단 docstring 미요약, Stop 훅 제외 근거 부재)은 1차 리뷰에서 이미 발견되어 의도적으로 보류된 INFO 로, 재확인 결과 여전히 사실이지만 새로운 차단 사유는 아니다.

## 위험도

LOW
