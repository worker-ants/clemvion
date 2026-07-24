# 테스트(Testing) 리뷰 — round 01_02_21

## 검증 방법

이 라운드의 프롬프트 diff 는 `review/code/2026/07/24/00_34_09/**` (직전 라운드가 남긴 RESOLUTION/SUMMARY/
`_retry_state.json`/8개 에이전트 리포트 + `meta.json`, 12개 파일) 만 게이트 번호와 함께 보여준다. 실제
커밋(`3dc3a160a`, HEAD)의 `git show --stat` 를 대조한 결과 이 커밋은 그 12개 리뷰 산출물 외에 **소스
3파일도 포함**한다 — `.claude/hooks/guard_review_before_push.py`(+47/-12), `.claude/tests/README.md`(±2),
`.claude/tests/test_push_guard_worktree_scope.py`(+90) — 그런데 이 3파일은 프롬프트 크기 제한으로
누락되어 게이트 번호가 전혀 없다. 다른 8명의 리뷰어(00_34_09 라운드의 requirement/testing/security 등)가
이미 문서화한 것과 같은 패턴이라, 동일하게 `git diff feda5b219..3dc3a160a -- <path>` 로 직접 재추출해
전문을 읽고, 실제로 `python3 -m unittest discover`(대상 파일 단독 + 전체 스위트)를 재실행해 회귀를 확인했다.
아래 소스 파일 인용 줄번호는 프롬프트 게이트가 아니라 현재 `.claude/tests/test_push_guard_worktree_scope.py`
/ `.claude/hooks/guard_review_before_push.py` 를 `Read`/`grep -n` 으로 직접 대조한 실측 줄번호다.

## 발견사항

- **[WARNING]** 신규 테스트가 `self.hook` 파일 핸들을 닫지 않아 `ResourceWarning: unclosed file` 발생 —
  같은 파일 안의 기존 관례(`with open(...)`)와 불일치
  - 위치: `.claude/tests/test_push_guard_worktree_scope.py:349`
    (`test_target_selection_failure_is_counted_not_silent` 안의
    `src = open(self.hook, encoding="utf-8").read()`)
  - 상세: 이번 fix 커밋(`3dc3a160a`, review 00_34_09 WARNING 2 대응)이 새로 추가한 이 테스트는 `self.hook`
    을 컨텍스트 매니저 없이 열어 `.read()` 만 호출한다. 실제로 재실행해 확인한 결과
    (`python3 -m unittest discover -s .claude/tests -p 'test_push_guard_worktree_scope.py' -v`) 이 테스트가
    실행되는 순간 `ResourceWarning: unclosed file <...guard_review_before_push.py...>` 가 출력된다(테스트
    자체는 `ok` 로 통과하지만 경고가 발생). 같은 파일 안에서 동일한 대상(`self.hook`)을 여는 다른 호출부
    (`test_push_guard_worktree_scope.py:417`, `AcceptsCwdContractTest` 근방)는 `with open(self.hook,
    encoding="utf-8") as f:` 로 정확히 컨텍스트 매니저를 쓰고, 파일 전체(`grep -n "open("`)를 봐도 5회의
    `open()` 호출 중 컨텍스트 매니저를 안 쓰는 곳은 이 한 줄뿐이다 — 즉 파일 자체의 기존 관례에서 벗어난
    신규 회귀다. 오늘은 기능적으로 무해하지만(CPython 은 결국 GC 로 회수), pytest/`-W error` 등으로 경고를
    에러로 승격하는 설정이 도입되면 이 테스트만 실패하게 되고, 이 하네스가 `python3 -m unittest discover`
    를 반복 호출하는 하나의 프로세스(다른 다수 테스트 파일과 같은 인터프리터)라는 점을 감안하면 자원 누수가
    누적되는 방향의 코드다.
  - 제안: `with open(self.hook, encoding="utf-8") as f: src = f.read()` 로 변경(파일 안의 기존 패턴과 통일).

- **[INFO]** review 00_34_09 WARNING 6(`result is None` 분기 미검증)이 코드/테스트 변경 없이 주석만으로
  "반영(문서화)" 처리됨 — 분기 자체는 여전히 테스트 커버리지 밖
  - 위치: `.claude/hooks/guard_review_before_push.py:646`(`_evaluate_over_targets` 안의
    `if result is None:`), 주석은 646-652행에 추가됨
  - 상세: 직전 testing.md(00_34_09) 는 두 옵션(a. 도달 불가능하면 제거+assert, b. 유효한 값이면 `None` 을
    반환하는 스텁 케이스를 테스트로 추가)을 제시했는데, 실제 조치는 둘 다 아니라 "왜 `answered` 를 세우지
    않는지" 를 설명하는 주석만 추가하는 제3의 경로를 택했다(코드 동작 변화 없음). `_REVIEW_STUB`/`_PLAN_STUB`
    은 여전히 `None` 을 반환하는 경로가 없어(직접 확인: `test_push_guard_worktree_scope.py:42-79`) 이 분기는
    오늘도 dead code 인 채로 어떤 테스트로도 실행되지 않는다. 설계 의도를 코드에 남긴 것 자체는 유효한
    개선이지만, "테스트로 고정" 이라는 원래 WARNING 의 핵심 요구(커버리지 확보)는 충족되지 않은 상태로
    남아 있다.
  - 제안: 급하지 않음(오늘 도달 불가능하다는 사실 자체는 다른 리뷰어들도 재확인함). 다만 향후 세 번째 게이트나
    `evaluate_*()` 시그니처 변경으로 이 분기가 살아날 가능성을 고려하면, `_REVIEW_STUB`/`_PLAN_STUB` 에
    `None` 반환 변형 하나만 추가해도 이 분기의 실제 동작(§E 배너·스트릭 모두 침묵)이 회귀 테스트로
    고정된다.

- **[INFO]** security.md/requirement.md(00_34_09)가 제안한 "알려진 잔여 갭"용 회귀 테스트(완전 bare push,
  cwd 가 이미 다른 worktree 안인 채로 branch/path 어느 것도 언급되지 않는 케이스)는 이번 fix 커밋에
  추가되지 않음 — 설계 주석(RESIDUAL GAP)으로만 남음
  - 위치: `.claude/hooks/guard_review_before_push.py:381-393`(`_push_targets` 위 설계 코멘트 블록의
    `RESIDUAL GAP (accepted)` 문단)
  - 상세: RESOLUTION.md(review/code/2026/07/24/00_34_09/RESOLUTION.md #1)는 이 케이스를 "설계 주석에
    RESIDUAL GAP 으로 명시" 했다고 밝히고 실제로 그렇다(646행 근방 아님, `_push_targets` 정의 앞
    381-393행에서 직접 확인). 그러나 security.md 가 제안한 "(3) 최소 비용 대안 — 알고 있는 갭을 회귀
    테스트로도 고정" 은 채택되지 않았다. cwd 는 항상 검사되므로 no-regression 이라는 설계 자체의 주장은
    맞지만, 이 갭이 향후 실수로 더 넓어지는지(예: 리팩터로 인해 cwd 검사마저 스킵되는지)를 잡아줄 pin
    테스트가 없다는 뜻이기도 하다.
  - 제안: 급하지 않음 — 순수 문서화 결정이며 이미 3라운드 이상 다수 리뷰어가 동일 지점을 지적·수용한
    상태. 여유 있을 때 "bare push, cwd already inside the other worktree" 시나리오를 만들어 "cwd 만
    평가되고 return code 는 그 cwd 상태에 따른다"(즉 회귀는 아니라는 것)를 명시적으로 pin 하는 테스트 1건
    추가를 고려.

## 검증한 항목 (실측으로 확인, 문제 없음)

- **회귀 재확인**: `python3 -m unittest discover -s .claude/tests -p 'test_push_guard_worktree_scope.py' -v`
  → **23 tests, 전량 ok**(RESOLUTION.md 의 "21 → 23건" 주장과 실측 일치). 전체 스위트
  `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` → **540 tests, 전량 OK**(RESOLUTION.md
  의 "540 passed" 주장과 일치). `test_line_anchors.py` 도 이번엔 실패 없이 통과 — HEAD 가 이제 2-parent
  머지가 아닌 일반 커밋(`3dc3a160a`)이 됐기 때문이라는 RESOLUTION.md 의 "INFO 8 은 오판이었다" 설명과
  정합적이다.
- **`_run_gate` 이름 drift 완전 해소**: `grep -n "_run_gate\b" .claude/hooks/guard_review_before_push.py
  .claude/tests/README.md .claude/tests/test_push_guard_worktree_scope.py` → **0건**. README(`:47`)와
  테스트 docstring(`:258`) 모두 `_evaluate_over_targets` 로 정정된 것을 직접 대조 확인.
- **`_ensure_on_path()` 헬퍼 적용 일관성**: `test_push_guard_worktree_scope.py:84-93` 에 멱등 헬퍼가
  정의되고, 이전 무가드 `sys.path.insert` 3곳(`:496`, `:533`, `:534`) 모두 이 헬퍼 호출로 교체됨을 확인 —
  side_effect.md(00_34_09) WARNING 이 완전히 해소됨.
  기존 다른 `sys.path.insert` 무가드 호출부가 파일 안에 더 남아있지 않은지도 grep 으로 재확인(0건).
- **`TARGET_SELECTION` 관측 배선의 설계 일관성**: `main()`(`:730-747`)의 새 `except Exception as exc:` 블록이
  `outcome.degraded.append(("TARGET_SELECTION", ...))` 을 호출하는 지점은 기존 `DETECTION` 실패 기록
  패턴(`:755` 부근, `outcome.degraded.append(("DETECTION", ...))`)과 구조적으로 대칭이고,
  `_lib/failopen_state.py::report()` 는 `degraded` 리스트를 `(label, reason)` 튜플의 제네릭 목록으로만
  다뤄(`_ALL_GATES` 멤버십 검사와 무관) `"TARGET_SELECTION"` 이라는 새 라벨을 추가해도 기존 리셋
  불변식(§E, gate 당 1회)을 깨지 않음을 코드 대조로 확인.
- **신규 테스트 `test_bare_push_from_another_worktree_is_scoped_by_path` 설계 검증(vacuous 아님)**:
  `setUp` 에서 `self.side_branch = "claude/side-task-abc123"`, `self.side_wt = os.path.join(self.tmp,
  "side")` 로 branch 이름과 worktree 디렉터리 이름이 문자열로 무관하게 설정돼 있어(`test_push_guard_
  worktree_scope.py:118-119`), 테스트 커맨드(`cd <side_wt 절대경로> && git push`, refspec 없음)는 branch
  이름 매칭으로는 원리적으로 통과할 수 없고 오직 새로 추가된 path 매칭 로직으로만 통과 가능 — 즉 이
  테스트는 실제로 이번에 추가된 코드 경로(`_mentions_branch(command, path)`)를 격리해서 검증한다.
- **fail-open 관측 테스트의 상태 격리**: `test_target_selection_failure_is_counted_not_silent` 는
  `CLAUDE_PROJECT_DIR=self.tmp` 로 streak 파일 경로를 격리하고(`:367`), `hook_crash_targets_observed.py`
  라는 별도 패치 파일에 소스를 복사해 실행 — 실제 프로젝트 상태(`.claude/state/push_guard_failopen.json`)를
  오염시키지 않음. 다른 테스트와의 실행 순서 의존성 없음(각 테스트가 독립된 `tempfile.mkdtemp()`).

## 요약

이번 라운드 자체의 diff(review/ 산출물 12파일)는 정적 문서이므로 "테스트" 관점에서 직접 검사할 코드는
없지만, 그 문서들이 서술하는 실제 fix 커밋(`3dc3a160a`)이 같은 커밋에 포함돼 있는데도 프롬프트에서
크기 제한으로 누락되어 있어 `git diff` 로 직접 재추출해 검증했다. RESOLUTION.md 가 주장하는 검증 결과
(신규 테스트 21→23건, 전체 540 passed, `_run_gate` 이름 정정, `_ensure_on_path` 멱등화, `TARGET_SELECTION`
관측 배선)는 전부 실제로 재실행/재대조해 사실임을 확인했다 — 이 감사 문서 체인은 신뢰할 만하다. 다만
그 fix 커밋 자체가 새로 추가한 테스트 하나(`test_target_selection_failure_is_counted_not_silent`)가
파일 핸들을 닫지 않아 `ResourceWarning` 을 유발하는 작은 회귀를 남겼는데, 이는 00_34_09 라운드의 8명
리뷰어(그 fix 이전 코드를 봤으므로) 누구도 볼 수 없었던 지점이라 이번 라운드에서 처음 발견된다. 그 외
남은 갭(`result is None` 분기의 테스트 미고정, RESIDUAL GAP 에 대한 pin 테스트 부재)은 모두 이전
라운드에서 이미 논의되고 의도적으로 낮은 우선순위로 defer 된 항목의 재확인이다. CRITICAL 은 없다.

## 위험도

LOW
