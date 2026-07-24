# 보안(Security) 리뷰 — push-guard-worktree-scope (00_34_09, main 재구조화 흡수 후)

대상: `.claude/hooks/guard_review_before_push.py`(교차-worktree 스코핑 + #999/#1000 fail-open 관측 구조 재이식), `.claude/tests/test_push_guard_worktree_scope.py`, `.claude/tests/README.md`, `plan/in-progress/push-guard-worktree-scope.md`, 그리고 4라운드에 걸친 `review/code/2026/07/23/{17_28_02,17_51_28,18_06_41,18_22_56}/**` 산출물(신규 커밋 대상, 감사 기록).

이 변경은 웹앱이 아니라 **push 이전 코드 리뷰를 강제하는 내부 harness 게이트**다. 위협 모델은 "게이트를 (의도적으로 또는 우연히) 우회하는 경로가 남아있는가" 이며, 이번 diff 자체가 기존 false-ALLOW(리뷰 우회) 결함을 닫는 정합성 수정이다. 이미 4라운드 `/ai-review`(17_28_02 → 18_22_56)를 거쳐 C0/W7 → C0/W2 → C0/W2 → C0/W1(문서, 기능 무관)로 수렴했고, 그 뒤 origin/main 의 병렬 세션 리팩터(#999/#1000, fail-open 관측화)와 머지되어 `_run_gate` 가 `_evaluate_over_targets`/`_run_gates` 로 재이식됐다. 아래는 이번 최종 상태(머지 후 코드)를 직접 읽고 확인한 결과다.

## 발견사항

- **[WARNING]** 스코핑 수정이 "push 명령이 대상 branch 이름을 문자열로 언급하는" 경우에만 동작 — `cd <다른 worktree> && git push`(branch 미언급, upstream-tracking 의존) 는 여전히 원래의 false-ALLOW 로 새는 미문서화 잔여 갭
  - 위치: `.claude/hooks/guard_review_before_push.py` `_push_targets`(429-441행 부근, 현재 파일 기준 `_push_targets` 정의부)와 `_mentions_branch`(414-431행), 설계 코멘트 블록(344-376행)
  - 상세: 이 PR 이 닫으려는 구멍은 정확히 "에이전트가 `cd <다른-worktree> && git push origin <그 branch>` 를 실행하면 훅의 `cwd`(payload 필드, 이 명령이 실행되기 *이전* 시점의 디렉터리)가 실제 push 대상과 달라 게이트가 엉뚱한 worktree 를 본다"는 것이다(plan 문서 14-35행, `_push_targets` 위 설계 코멘트 347-360행이 이 threat model 을 그대로 서술). 수정은 이를 "체크아웃된 각 branch 에 대해, 그 이름이 **명령 텍스트에 리터럴로 등장하는가**"라는 blind substring 매칭으로 닫는다(`_mentions_branch`, `_push_targets`). 그런데 이 project 의 실제 워크플로에서 `git push` 는 최초 `git push -u origin <branch>` 로 upstream tracking 을 설정한 뒤에는 흔히 **branch 이름 없이** `git push` 만으로 이어진다(bare push / tracking branch 의존). 이 경우 `cd <다른-worktree> && git push` 조합에서 command 텍스트 어디에도 그 worktree 의 branch 이름이 등장하지 않으므로, `_worktree_branches` 가 그 worktree 를 발견해도 `_mentions_branch` 가 항상 False 를 반환해 `_push_targets` 는 `[cwd]` 만 돌려준다 — 즉 실제 push 대상(그 다른 worktree)은 **평가되지 않는다**. 이것은 이 PR 이 실증까지 남기며("2026-07-23 실측: clean cwd 에서 push 하면 게이트가 통째로 건너뛰어진다") 닫으려던 것과 **정확히 같은 클래스의 false ALLOW**다 — 다만 트리거 조건이 "explicit branch 명시 push"에서 "bare push"로 좁아졌을 뿐, 새 코드 이전과 동일하게 우회 가능하다.
    plan 문서(`plan/in-progress/push-guard-worktree-scope.md` 184-185행 "남은 갭(의도)")는 "체크아웃되지 않은 branch 를 push 하는 경우"만 의도된 잔여 갭으로 명시하고 있고, 이 다른 케이스(체크아웃은 됐지만 명령 텍스트에 이름이 없는 경우)는 plan·docstring·테스트 어디에도 언급이 없다. `.claude/tests/test_push_guard_worktree_scope.py` 를 전수 확인한 결과(`grep -n '"git push'`) 모든 e2e 케이스가 `git push origin {self.side_branch}` 또는 `git push origin HEAD`/`git push origin main` 처럼 **cwd 자신의 대상**이거나 **branch 이름을 명시**한 케이스만 다루며, "`cd` 로 다른 worktree 로 이동한 뒤 branch 이름 없이 bare `git push`" 조합은 어느 테스트에도 없다(cd 자체를 포함하는 커맨드 문자열 테스트가 0건 — `grep -n "cd \."` 결과 없음).
  - 제안: (1) 최소한 plan 문서의 "남은 갭(의도)" 절에 이 케이스를 명시적으로 추가해, "체크아웃 안 된 branch" 갭과 혼동되지 않게 감사 기록을 정확히 남길 것. (2) 가능하면 완화책 하나를 추가: `_mentions_branch` 를 branch 이름뿐 아니라 **worktree 디렉터리 경로(또는 그 마지막 path 세그먼트)**에 대해서도 적용하면, `cd .claude/worktrees/<task>-<slug>` 형태(이 저장소의 표준 워크트리 명명 관례, CLAUDE.md 명시)가 command 텍스트에 남는 한 branch 이름이 없어도 해당 worktree 가 target 에 포함된다 — "stricter, never weaker" 라는 이 파일의 기존 설계 원칙과 방향이 일치하고(과매칭은 게이트를 더 엄격하게만 만듦), blind-substring 철학도 그대로 유지된다. (3) 최소 비용 대안으로는 이 잔여 갭을 아는 상태에서 회귀 테스트 하나(bare push 로부터 실제로 새는 걸 보여주는, 현재는 xfail 성격의 pin)를 추가해 "알고 있는 갭"임을 코드 레벨에서도 감사 가능하게 고정.
  - 근거 심각도: CRITICAL 이 아니라 WARNING 인 이유 — (a) cwd 는 여전히 항상 평가되므로 이 갭이 있어도 **기존(수정 전) 동작보다 나빠지지 않는다**(no regression, strictly additive coverage라는 설계 자체 명시), (b) 이 PR 이 실제로 막는 대다수 시나리오(explicit branch 지정 push)는 정상 동작, (c) 이미 4라운드 리뷰·다수 독립 리뷰어가 이 특정 서브케이스를 짚지 않았다는 것은 실사용 빈도가 낮게 평가됐을 수 있음을 시사. 다만 이 게이트가 존재하는 **핵심 이유**(리뷰 우회 차단)와 정확히 같은 위협 클래스이므로 INFO 로 낮추지는 않는다.

- **[INFO]** (검증 완료) 1차 리뷰 WARNING — `_mentions_branch`/`_push_targets` 의 길이 상한 부재로 인한 O(n²) DoS 우려는 `_MAX_REDACTION_INPUT` truncation 으로 닫혔고 전용 회귀 테스트(`test_branch_mention_past_the_cap_is_not_scanned`, `test_oversized_command_still_checks_cwd`)로 고정됨을 직접 확인.
  - 위치: `.claude/hooks/guard_review_before_push.py` `_push_targets` 내부 `command = command[:_MAX_REDACTION_INPUT]`
  - 상세: cap 을 넘는 부분은 branch 스캔에서 제외되지만(→ 그 branch 에 한해 pre-fix 동작으로 저하), cwd 검사는 절대 약화되지 않는다. 이 truncation 자체가 위 WARNING 이 지적하는 문제(branch 텍스트 부재)와 유사한 방향의 저하이지만, 이쪽은 명시적으로 설계·테스트·plan 문서 모두에서 다뤄져 감사 가능하다는 점이 다르다.

- **[INFO]** (검증 완료) per-target fail-open + gate-당 1회 degraded 기록(#999 재이식) 두 불변식 모두 회귀 테스트로 고정
  - 위치: `.claude/hooks/guard_review_before_push.py` `_evaluate_over_targets`(598-636행)
  - 상세: 한 worktree 에서 `evaluate()` 가 예외를 던져도 `continue` 로 나머지 target 을 계속 검사하며(`test_per_target_fail_open_still_checks_remaining_targets`), 여러 target 이 동시에 실패해도 `outcome.degraded` 에는 gate 당 한 번만 기록돼 fail-open 스트릭 카운터가 부풀지 않는다(`test_degradation_is_counted_once_per_gate_not_per_target`). 두 요구사항이 상충할 수 있는 지점(첫 target 에서 return 하면 스코핑이 깨지고, target 마다 기록하면 관측 정책이 깨짐)을 하나의 루프에서 동시에 만족시키는 코드로, 실제로 두 값 모두 직접 실행해 확인 가능한 테스트가 있다.

- **[INFO]** (검증 완료) 커맨드 인젝션·경로 탐색·시크릿 하드코딩 표면 없음
  - 위치: `.claude/hooks/guard_review_before_push.py` `_worktree_branches`(`subprocess.run(["git", "worktree", "list", "--porcelain"], cwd=cwd, timeout=5.0, ...)`)
  - 상세: 리스트 인자 + `shell=True` 미사용으로 셸 인젝션 경로 없음. `cwd` 인자(payload 유래)가 존재하지 않는 경로여도 예외가 `except Exception: return []` 로 안전 흡수됨. `os.path.realpath()` 비교는 심볼릭 링크 정규화용 dedup 일 뿐 접근 제어 결정에 쓰이지 않음. `evaluate_review(cwd)`/`evaluate_plan(cwd)` 내부(`_lib/review_guard.py:836`, 서브프로세스 호출부 162-170행)도 `cwd=` 키워드 인자로 안전하게 전달되는 것을 직접 확인(diff 범위 밖이지만 대조 확인). 신규 서드파티 의존성 없음(표준 라이브러리만 사용) — 이 harness "훅은 순수 stdlib" 컨벤션과 일치.

- **[INFO]** (검증 완료) `BYPASS_REVIEW_GUARD`/`BYPASS_PLAN_GUARD` 우회 스위치가 scoped target 확장에도 약화 없이 그대로 적용됨
  - 위치: `.claude/hooks/guard_review_before_push.py` `_run_gates`(642행, 664행), 테스트 `test_bypass_still_applies_to_scoped_targets`
  - 상세: 환경변수 우회는 게이트 단위(REVIEW/PLAN) 전체를 건너뛰므로 target 이 몇 개든 동일하게 작동 — 신규 우회 표면이 생기지 않았다.

- **[INFO]** `traceback.print_exc(file=sys.stderr)` — 로컬 파일 경로가 포함된 스택 트레이스를 stderr 로 노출 (기존 패턴, 신규 아님)
  - 위치: `.claude/hooks/guard_review_before_push.py` 61, 623, 709, 721행
  - 상세: 노출 정보는 로컬 워크트리 파일 경로 수준으로 민감도가 낮고, 이 훅의 출력을 보는 것은 훅을 실행한 본인(에이전트/개발자)뿐이다. 조치 불요.

- **[INFO]** `review/code/**` 하위로 커밋되는 리뷰 산출물(RESOLUTION/SUMMARY/meta.json 등) 자체에는 시크릿·자격증명·개인정보 노출 없음을 확인
  - 위치: `review/code/2026/07/23/{17_28_02,17_51_28,18_06_41,18_22_56}/**`
  - 상세: 전부 텍스트 리뷰 서술과 테스트 카운트·mutation 결과 같은 감사 메타데이터이며, 토큰/키/자격증명 패턴 없음.

## 요약

이번 변경(및 그 위에 재이식된 #999/#1000 fail-open 관측 구조)은 웹 애플리케이션 취약점(SQLi/XSS/커맨드 인젝션/시크릿 하드코딩/인증 우회) 범주에서는 문제가 없으며, 1차 리뷰에서 지적된 길이 상한 부재(DoS 우려)와 per-target fail-open 누락은 이후 라운드에서 실제로 닫히고 회귀 테스트로 고정된 것을 코드 레벨에서 직접 확인했다. 다만 이 PR 의 핵심 threat model(“다른 worktree 로 `cd` 한 뒤 push 하면 훅이 엉뚱한 worktree 를 본다”)에 대한 방어가 **push 명령이 대상 branch 이름을 텍스트로 언급하는 경우로 한정**되어 있어, `cd <worktree> && git push`(bare, upstream-tracking 의존) 조합은 여전히 수정 전과 동일한 false-ALLOW 경로로 남아 있다 — 이는 새로운 취약점이 아니라 **이 PR 이 닫으려던 취약점의 부분적/미문서화된 잔여분**이다. cwd 는 항상 평가되므로 회귀(기존보다 나빠짐)는 아니지만, 게이트가 존재하는 이유와 정확히 같은 위협 클래스이므로 WARNING 으로 기록하고 plan 문서에 명시적 갭으로 남기거나 worktree 경로 매칭으로 보완할 것을 권고한다.

## 위험도

LOW
