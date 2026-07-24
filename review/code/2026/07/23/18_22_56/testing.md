# 테스트(Testing) 리뷰 — push 가드 worktree 스코프 (4차 라운드)

대상: `.claude/hooks/guard_review_before_push.py`, `.claude/tests/test_push_guard_worktree_scope.py`,
`.claude/tests/README.md`, `plan/in-progress/push-guard-worktree-scope.md`. 3차 리뷰(18_06_41, 커밋
`942412ea3`) 이후 실제 코드 변경은 `.claude/hooks/guard_review_before_push.py` **무변경**, 신규 테스트
`test_push_targets_crash_falls_back_to_cwd` 1건 + 기존 테스트 docstring 보강 1건뿐이다
(`git diff 942412ea3..89c3870b4 -- .claude/hooks .claude/tests` 로 직접 확인).

## 검증 방법 (직접 재현)

- `python3 -m unittest discover -s .claude/tests -p "test_push_guard_worktree_scope.py"` → **20 tests,
  OK**.
- `python3 -m unittest discover -s .claude/tests -p "test_*.py"` → 하네스 전체 **487 tests, OK**
  (plan/RESOLUTION 수치와 일치).
- 3차 리뷰 WARNING("`main()`의 `_push_targets` 폴백 무검증")이 이번 라운드에서 실제로 닫혔는지
  독립 mutation 으로 재확인: `.claude/hooks/guard_review_before_push.py`의
  `targets = [base_cwd]  # fail open to legacy single-worktree behaviour` 를
  `targets = []`로 치환(`cp` 백업 → 절대경로 원복, 이후 `git status --porcelain` 클린 확인) →
  신규 테스트 `test_push_targets_crash_falls_back_to_cwd` **단독으로 red**, 나머지 19건 + 전체
  스위트는 이 mutation 과 무관(정상 경로에서는 `_push_targets`가 애초에 raise 하지 않으므로
  dormant). plan 문서의 M7 주장과 실측이 정확히 일치함을 직접 확인했다.

## 발견사항

- **[INFO]** `test_push_targets_crash_falls_back_to_cwd`가 REVIEW 게이트의 차단만 단언하고, 같은
  폴백 경로가 PLAN 게이트에도 동일하게 적용되는지는 독립적으로 확인하지 않음
  - 위치: `.claude/tests/test_push_guard_worktree_scope.py:280-320`(신규 테스트), 특히
    `:319-320`(`assertEqual(r.returncode, 2, ...)` / `assertIn("review gate", r.stderr)`)
  - 상세: `main()`(`.claude/hooks/guard_review_before_push.py:535-539`)의 `except Exception:
    traceback.print_exc(...); targets = [base_cwd]` 는 REVIEW·PLAN 두 게이트 루프
    (`:542-549`, `:552-561`)가 공유하는 단일 `targets` 변수를 채운다. 코드 구조상 두 게이트가
    동일한 폴백 값을 받는 것이 자명하긴 하지만(같은 변수, 순차 소비), 신규 테스트는
    `STUB_PLAN_BLOCKED_PATHS=""`로 PLAN 을 항상 clean 으로 고정해 REVIEW 게이트가 이 폴백을
    이용해 block 하는 것만 증명한다. PLAN 게이트 쪽에서 같은 폴백이 발동하는 별도 시나리오
    (REVIEW clean, PLAN 만 fallback 대상에서 dirty)는 이 테스트에도, 다른 어떤 테스트에도 없다.
  - 제안: 우선순위는 낮음(공유 변수라 사실상 동일 경로). 완전성을 원한다면
    `STUB_PLAN_BLOCKED_PATHS=self.main_wt`로 설정한 대칭 케이스를 추가하거나, 기존 테스트에
    `self.assertIn(self.main_wt, r.stderr)`를 더해 폴백된 worktree 값 자체도 함께 고정할 것.

- **[INFO]** (3차 이전부터 반복 확인된 잔여 갭 — 재차 카탈로그, 신규 아님) `_worktree_branches`의
  detached-HEAD 파싱 분기·`_accepts_cwd`의 `inspect.signature()` 자체 실패 분기가 여전히 직접
  자극되지 않음
  - 위치: `.claude/hooks/guard_review_before_push.py:372-383`(porcelain 파싱 루프,
    `branch ` 줄이 없는 detached 항목), `:427-428`(`_accepts_cwd`의
    `except Exception: return False`)
  - 상세: 1~3차 리뷰가 이미 INFO로 분류하고 plan 문서(§3차 반영)에도 "급하지 않음/선택"으로
    명시적으로 defer 된 항목이다. 코드 리딩상 버그는 아님(다음 `worktree ` 줄이 `path`를
    덮어써 detached 항목이 파싱을 오염시키지 않음을 재확인)이나, 리팩터 시 조용히 깨질 수 있는
    지점이라는 점은 여전히 유효하다. 새 지적이 아니라 재확인 기록.
  - 제안: 3차 RESOLUTION 대로 미조치 유지 가능. 선택.

- **[INFO]** (반복, 신규 아님) `MentionsBranchTest`/`AcceptsCwdContractTest`의 모듈 로딩이
  `.claude/tests/README.md`의 `_harness.load_module_by_path` 컨벤션 대신 수동
  `sys.path.insert` + `importlib.import_module`을 사용
  - 위치: `.claude/tests/test_push_guard_worktree_scope.py:366-370`, `:403-410`
  - 상세: 1~2차에서 이미 지적되고 "낮은 가치/선택"으로 분류된 항목. 기능적 결함 없음
    (`sys.modules` 캐싱 덕에 정상 동작, 487건 그린으로 재확인). 재차 카탈로그.
  - 제안: 조치 불요.

## 강점 (변하지 않음, 재확인)

- 신규 테스트가 `assertIn(marker, src, "hook shape changed — update this patch point")`로 문자열
  치환 패치의 실패를 **조용한 no-op이 아니라 즉시 실패**로 전환한다 — 이 프로젝트가 과거 겪은
  "치환 실패한 뮤턴트가 색깔을 오염시키는" 클래스의 결함을 테스트 자신에게도 적용한 좋은 방어.
- 패치된 훅을 별도 파일(`hook_crashing_targets.py`)로 써서 원본 `self.hook`을 건드리지 않아
  다른 테스트와의 격리가 깨지지 않음. `tempfile.mkdtemp()` + `addCleanup(shutil.rmtree, ...)`
  스코프 안에 있어 정리도 보장됨.
- 이 테스트는 실제로 `main()`의 제어 흐름(REVIEW 게이트가 스텁 예외 없이, fallback 된 `targets`
  로 정상 실행)을 서브프로세스로 구동해 검증하므로, `_push_targets` 자체를 mock 하는 방식보다
  실제 동작에 더 가깝다.
- mutation 재현 결과 이 신규 테스트 1건이 M7을 단독으로 kill — 3차 리뷰가 지적한 "커버 주장은
  추론이 아니라 실측"이라는 교훈이 이번 라운드에서 실제로 지켜졌음을 직접 확인했다.
- 하네스 전체 회귀 없음(487/487).

## 요약

이번 4차 라운드에서 실제 코드 변경은 3차 WARNING("`main()`의 `_push_targets` 폴백 경로 무검증")을
닫는 테스트 1건뿐이며, 직접 mutation 재현(`targets = [base_cwd]` → `targets = []`)으로 그 테스트가
정확히 이 경로만을 pin 함을 확인했다 — plan 문서의 M7 주장과 실측이 일치한다. 새로 발견된 갭은
모두 INFO 수준으로, (1) 신규 테스트가 REVIEW 게이트 경로만 증명하고 PLAN 게이트가 같은 폴백을
공유한다는 사실을 별도 시나리오로 못박지는 않는다는 점(코드 구조상 위험은 낮음), (2) 1~3차에서
이미 저위험으로 분류·defer 된 잔여 갭(detached-HEAD 파싱, `_accepts_cwd`의 signature 조회 실패
분기, 테스트 모듈 로딩 컨벤션)의 재확인이다. Critical·신규 Warning 은 발견되지 않았고, 하네스
전체 487건이 회귀 없이 통과한다.

## 위험도

LOW
