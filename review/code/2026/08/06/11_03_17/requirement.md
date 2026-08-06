# 요구사항(Requirement) 리뷰 — CI 백스톱 5R (`test_review_gate_ci.py` 재작성 + plan 갱신)

대상: `.claude/tests/test_review_gate_ci.py`(재작성), `plan/in-progress/harness-review-gate-ci-backstop.md`(갱신).
`.github/workflows/review-gate.yml` / `scripts/check-review-gate.py` 는 이번 라운드에 **변경되지
않았다**(`git diff 02138a898..eeaf94503` 로 확인 — 2R 이후 워크플로/스크립트 본체는 그대로이고,
매 라운드 바뀐 것은 이를 고정하는 **테스트**뿐이었다. 이는 프롬프트 HISTORY 서술과 일치한다).

CONTEXT 가 명시적으로 요구한 과업 — "모든 테스트가 GREEN 인 채로 SHIPPED BEHAVIOUR 를 바꿀 수
있는가" — 을 실제로 수행했다. 아래는 그 결과다.

## 발견사항

- **[CRITICAL] "판정자는 하나다" 를 지키는 두 가드(`OneJudgeTest` 정적 검사 + `VerdictComesFromTheGateTest` 행위 검사) 모두 `os.environ` 의 Subscript/Compare 접근을 놓친다 — GH Actions 기본 환경변수(`GITHUB_ACTOR` 등)로 조건화한 두 번째 판정자를 심어도 두 테스트 모두 GREEN 이다. 실제로 mutate 해서 검증했다.**
  - 위치: `.claude/tests/test_review_gate_ci.py:307-323`(`OneJudgeTest` 의 `ast.Call` 전용 검사 루프) 및 `.claude/tests/test_review_gate_ci.py:493,513,520`(`VerdictComesFromTheGateTest._CASES` + subprocess 호출); 주입 지점은 `scripts/check-review-gate.py:101-102`(`blocked = decision.blocked` 직후).
  - 상세:
    `OneJudgeTest.test_the_import_and_call_surface_stays_small` 은 스크립트의 AST 를 순회하며
    `ast.Call` 노드의 함수명만 허용 목록과 대조한다(`test_review_gate_ci.py:307-323`,
    `for node in ast.walk(tree): if not isinstance(node, ast.Call): continue`). `ast.Subscript`
    (`os.environ["X"]`)나 `ast.Compare`(`"X" in os.environ`)는 **Call 노드가 아니므로 이 루프에
    아예 진입하지 않는다** — 새 `import`도 새 `Call`도 없이 임의의 환경변수 값을 읽고 분기할 수
    있다.
    `VerdictComesFromTheGateTest`(같은 파일 477-527행)는 이를 "행위로" 막는다고 주장한다
    — 스텁 게이트의 `blocked`(env `STUB_BLOCKED` 로 제어) × `--enforce` 네 조합에 대해 종료
    코드가 순함수인지 확인한다(`_CASES`, 493행). 그러나 이 조합 공간은 **`STUB_BLOCKED` 와
    `--enforce` 두 축뿐**이고, subprocess 는 `env={**os.environ, "STUB_BLOCKED": ...}`
    (520행)로 **테스트 프로세스의 앰비언트 환경변수를 그대로 상속**한다. 로컬 개발 머신이나
    이 하네스 테스트가 실제로 도는 `harness-checks.yml` job 에는 `GITHUB_ACTOR` 가 있더라도
    그 값이 공격자가 심은 우회 목록과 우연히 일치할 이유가 없다 — 즉 이 축은 테스트가
    "커버한다"고 주장하지만 실제로는 **아무 값으로도 고정하지 않는 미검증 채널**이다.

    실제로 `scripts/check-review-gate.py` 를 다음과 같이 변형해(신규 `import` 0개, 신규
    `ast.Call` 0개, 속성 대입 0개) `blocked = decision.blocked` 직후에 삽입했다:
    ```python
    _CI_BYPASS_ACTORS = {"dependabot[bot]", "release-bot"}
    if "GITHUB_ACTOR" in os.environ and os.environ["GITHUB_ACTOR"] in _CI_BYPASS_ACTORS:
        blocked = False
    ```
    이 변형은 `OneJudgeTest`·`VerdictComesFromTheGateTest`·`WorkflowWiringTest`·
    `ReviewGateCliTest` 전부를 GREEN 으로 통과시키면서, `GITHUB_ACTOR=release-bot` 로 실행하면
    실제 게이트가 `blocked=True`(미커버) + `--enforce` 를 판정한 세션에서도 exit 0("통과")을
    낸다 — 정확히 이 라운드가 막으려는 "숨은 두 번째 판정자" 클래스다. `release-bot` 은 워크플로
    `if: github.actor != 'dependabot[bot]'`(잡 레벨 예외)에 걸리지 않으므로 실제 PR 트리거에서도
    이 잡은 정상 실행되고 스크립트만 조용히 통과 판정을 낸다. 재현 절차와 실제 명령/출력은
    맨 아래 "재현 절차" 참고.
  - 제안: 두 축 중 하나(또는 둘 다) 보강.
    1) **행위 축 보강(이 라운드 자신의 설계 철학과 일치)** — `VerdictComesFromTheGateTest` 의
       subprocess 호출을 `{**os.environ, ...}` 대신 **최소·명시 env**(`STUB_BLOCKED`/`PATH`/
       `HOME` 등 실행에 꼭 필요한 것만)로 바꾸거나, 최소한 GH Actions 기본 환경변수
       (`GITHUB_ACTOR`/`GITHUB_EVENT_NAME`/`GITHUB_REPOSITORY`/`GITHUB_HEAD_REF`/
       `GITHUB_REF`/`GITHUB_SHA`)를 각 조합마다 **임의의(비어있지 않은) 값**으로 채워 넣고도
       같은 순함수 표가 유지되는지 추가 서브테스트로 확인한다. 이러면 테스트 프로세스가 실제
       GH Actions job 안에서 돌든 로컬에서 돌든 무관하게 이 채널을 실질적으로 봉쇄한다.
    2) **정적 축 보강** — `OneJudgeTest` 의 `ast.Call` 전용 루프 옆에 `ast.Subscript`/
       `ast.Compare`(그리고 `ast.Attribute` 단독 접근) 중 베이스가 `os`(또는 다른 import 된
       모듈)로 귀결되는 노드를 같은 `_dotted`류 해석으로 잡아, `os.path.*` 처럼 이미 허용된
       것 외에는 거부한다. 단 `OneJudgeTest` 자신의 docstring 이 이미 "정적으로 부정을
       증명하는 것은 무한한 표면"이라 인정하므로, 1)이 더 근본적인 처방이다.
    참고: `os.environ` 자체를 스크립트가 전혀 읽지 않는 지금 시점 코드에는 이 결함이
    **없다** — 이번 항목은 "다음 변경이 이 클래스의 우회를 몰래 들여와도 현재 스위트가
    잡아내지 못한다"는 **가드/테스트의 완결성 결함**이며, 이 라운드의 커밋 메시지·docstring
    (`test_review_gate_ci.py:229-231`: "숨은 두 번째 판정자가 결과를 바꾸면 어떤 방식이든
    거기서 어긋난다")이 주장하는 보장 범위보다 실제 보장 범위가 좁다는 의도-구현 괴리이기도
    하다.

- **[INFO] `Fetch base ref` 스텝의 필요성 미검증은 plan 문서에 정직하게 열린 질문으로 남아있다.**
  - 위치: `plan/in-progress/harness-review-gate-ci-backstop.md:38-40`.
  - 상세: 프롬프트 CONTEXT 의 known limit (b)와 정확히 같은 내용이 plan 문서에 이미
    "GH Actions 러너 없이 실측할 수 없어 판정하지 못했다"로 기록돼 있다. 코드/문서 모두
    은폐 없이 열어뒀으므로 새 결함이 아니다.

- **[INFO] "기대값+워크플로 동시 편집" 한계도 `WorkflowWiringTest` 자신의 docstring(361-382행)이 인정한다.**
  - 위치: `.claude/tests/test_review_gate_ci.py:380-381`.
  - 상세: "배선을 바꾸면 여기 기대값도 같이 바꿔야 하고, 그 순간이 '이게 게이트를 끄는
    변경인가' 를 판단할 자리다" — 이 한계를 테스트가 막을 수 없다는 것을 스스로 서술한다.
    이는 CONTEXT known limit (a)와 동일하며, 리뷰 시점의 인간 판단(코드 리뷰)에 위임하는
    것이 유일한 처방이라 별도 결함으로 잡지 않는다.

- **[INFO] spec 문서 부재(정상)** — 이 변경은 `codebase/` 제품 기능이 아니라 `.claude/` 하네스
  자체 방어층이라 `spec/` 아래 대응 문서가 없다. 대신 `plan/in-progress/harness-review-gate-ci-backstop.md`
  가 요구사항의 단일 진실이며, 스크립트 docstring(`scripts/check-review-gate.py:1-47`)과
  플랜 문서의 서술(왜 관측 모드인지, 판정자가 하나인 이유, fail-open 근거)이 line-level 로
  거의 동일한 문구로 미러링돼 있어 기존 내용에 대해서는 drift 가 없다.

## 재현 절차 (실제 실행한 명령과 출력)

작업 트리는 건드리지 않았다. `mktemp -d` 로 격리된 사본에서만 수정했다(절대경로만 사용,
`cd` 미사용). 최종 `git status --short` 는 리뷰 세션 산출물 디렉토리 하나만 보여 원본 트리가
그대로임을 확인했다.

```
WORK=$(mktemp -d .../scratchpad/mutation-XXXXXX)
cp -R <repo>/.claude/hooks       $WORK/.claude/hooks
cp -R <repo>/.claude/_shared     $WORK/.claude/_shared
cp    <repo>/.claude/tests/_harness.py            $WORK/.claude/tests/
cp    <repo>/.claude/tests/test_review_gate_ci.py $WORK/.claude/tests/
cp    <repo>/.github/workflows/review-gate.yml    $WORK/.github/workflows/
cp    <repo>/scripts/check-review-gate.py         $WORK/scripts/
```

1) 베이스라인(무변형) — 대상 4개 클래스 전부 GREEN 확인:
```
$ python3 -m unittest discover -s $WORK/.claude/tests -p 'test_review_gate_ci.py' -v
... OneJudgeTest ... ok
... ReviewGateCliTest (7개) ... ok
... VerdictComesFromTheGateTest ... ok
... WorkflowWiringTest (2개) ... ok
Ran 14 tests ... FAILED (failures=1)   # PyYamlPinsAgreeTest 만 실패 — 다른 워크플로 파일을
                                        # 사본에 복사하지 않아서이며 이번 리뷰 대상과 무관
```

2) `scripts/check-review-gate.py` 의 `blocked = decision.blocked` 직후에 다음을 삽입
   (신규 `import` 0, 신규 `ast.Call` 0, 속성 대입 0):
```python
_CI_BYPASS_ACTORS = {"dependabot[bot]", "release-bot"}
if "GITHUB_ACTOR" in os.environ and os.environ["GITHUB_ACTOR"] in _CI_BYPASS_ACTORS:
    blocked = False
```

3) 변형 적용 후 같은 스위트 재실행 (GITHUB_ACTOR 미설정 — 테스트/개발 환경의 정상 조건) —
   결과는 1)과 **동일**, 대상 4개 클래스 전부 GREEN:
```
$ env -u GITHUB_ACTOR python3 -m unittest discover -s $WORK/.claude/tests -p 'test_review_gate_ci.py' -v
... OneJudgeTest ... ok
... ReviewGateCliTest (7개) ... ok
... VerdictComesFromTheGateTest ... ok
... WorkflowWiringTest (2개) ... ok
Ran 14 tests ... FAILED (failures=1)   # 위와 같은 무관 실패, 개수/내용 불변
```

4) 실제 프로덕션 조건(실 게이트가 blocked=True 를 낸 세션 + `--enforce`)을 스텁으로 재현해
   행위 차이를 직접 관측:
```
$ cat > $ROOT2/.claude/hooks/_lib/review_guard.py <<'PY'
class _D:
    push_blocks = False
    notes = ()
    reason = "실제 미커버 세션 (stub)"
    blocked = True
def evaluate_review(cwd=None, *, in_flight_ok=False):
    return _D()
PY

$ env -u GITHUB_ACTOR python3 $WORK/scripts/check-review-gate.py --root $ROOT2 --enforce
review-gate: 미커버 — 실제 미커버 세션 (stub)
review-gate: 이 PR 의 codebase/** 변경을 커버하는 해결된 리뷰가 커밋돼 있지 않습니다. ...
exit=1

$ GITHUB_ACTOR="release-bot" python3 $WORK/scripts/check-review-gate.py --root $ROOT2 --enforce
review-gate: 통과 — 실제 미커버 세션 (stub)
exit=0
```
   `GITHUB_ACTOR=release-bot` 는 워크플로의 잡 레벨 예외(`if: github.actor != 'dependabot[bot]'`)
   에 걸리지 않는 임의 값이므로, 실제 PR 트리거에서도 이 잡은 정상 실행되고 스크립트만
   조용히 통과 판정으로 뒤바뀐다 — **동일 게이트 판정, 다른 종료 코드**이며 이는
   `test_enforce_turns_the_same_verdict_into_a_failure`(94행 부근)가 "판정이 아니라 처분만
   바뀐다"고 못박은 것과 정확히 반대 방향의 결과다.

## 요약

이번 라운드(5R)에서 실제로 바뀐 것은 `.claude/tests/test_review_gate_ci.py`(재작성)와 plan
문서뿐이고, `.github/workflows/review-gate.yml`/`scripts/check-review-gate.py` 는 2R 이후
그대로다 — 이는 CONTEXT 서술과 일치한다. `WorkflowWiringTest` 의 워크플로 문서 전체 정확
일치는 지금까지의 4개 라운드 우회(부분 substring/정규식/필드 열림)를 모두 실제로 막는다:
직접 `EXPECTED` 를 건드리지 않고 워크플로만 바꾸면 어떤 첨가·삭제·변경도 실패한다. 그러나
"판정자가 하나다"라는 요구사항을 지키는 두 방어선 — 정적 `OneJudgeTest`(Call 노드만 검사)와
행위 `VerdictComesFromTheGateTest`(STUB_BLOCKED×--enforce 두 축만 고정) — 는 `os.environ` 의
비-Call 접근(Subscript/Compare)을 통한 앰비언트 환경변수 조건부 판정 주입을 놓친다. 실제로
`scripts/check-review-gate.py` 를 새 import·새 call·속성 대입 없이 변형해 이를 검증했다:
4개 대상 테스트 클래스가 전부 GREEN 을 유지한 채로, `GITHUB_ACTOR` 값에 따라 동일한
게이트 판정(blocked=True)이 `--enforce` 하에서 exit 1 대신 exit 0(통과)을 내도록 만들 수
있었다. 이는 라운드 자신이 "숨은 두 번째 판정자가 결과를 바꾸면 어떤 방식이든 거기서
어긋난다"고 주장하는 보장 범위보다 실제 커버리지가 좁다는 뜻이며, 현재 커밋된 스크립트
자체에는 이 결함이 없지만(스크립트는 `os.environ` 을 전혀 읽지 않는다) 향후 변경을
잡아내야 할 가드/테스트의 완결성 결함이다. 그 외 두 known limit((기대값+워크플로 동시 편집,
`Fetch base ref` 필요성 미검증)은 이미 코드·plan 문서가 정직하게 인정하고 있어 새 결함이
아니다.

## 위험도

HIGH — 현재 커밋된 프로덕션 스크립트에 활성 결함은 없으나(관측 모드이고 스크립트 자체는
`os.environ` 을 읽지 않는다), 이 라운드가 명시적으로 "판정자 단일성을 행위로 완전히 봉쇄했다"
고 주장하는 그 보장이 실제로는 뚫리며, 향후 이 스크립트에 GH Actions 기본 환경변수를 조건으로
쓰는 (악의적이든 부주의한 "이 actor 는 예외" 류의 실수든) 변경이 들어와도 이 라운드가 새로
추가한 두 방어선 중 어느 쪽도 잡아내지 못한다. CRITICAL 로 올리지 않은 이유는 shipped
behaviour(HEAD 의 실제 워크플로/스크립트) 자체는 아직 건전하기 때문이다.
