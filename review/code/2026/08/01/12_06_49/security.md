# 보안(Security) Review — CI 리뷰 게이트 백스톱 (round 3)

범위: `.claude/tests/README.md`, `.claude/tests/test_block_integrity.py`,
`.claude/tests/test_review_gate_ci.py`, `.claude/tests/test_stop_guard_failopen.py`,
`.github/workflows/harness-checks.yml`, `.github/workflows/review-gate.yml`,
`plan/in-progress/harness-review-gate-ci-backstop.md`, `scripts/check-review-gate.py`.

이 라운드의 요청대로, 가드/테스트마다 "정확히 무엇을 주장하는가"를 적고, 그 주장을
거짓으로 만들면서 **해당 테스트는 GREEN**인 최소 프로그램을 실제로 사본에서 실행해 확인했다.
실행 로그는 각 항목에 그대로 남긴다.

**작업 중 사고 1건과 즉시 원복**: 스크래치패드 디렉터리(`/private/tmp/claude-501/.../scratchpad`)가
여러 리뷰 에이전트가 공유하는 휘발성 디렉터리였고, 내가 만든 사본 디렉터리(`copy/`)가 두 번째
호출 사이에 사라져 있었다. `cd`가 조용히 실패하면서 뒤이은 heredoc 스크립트가 **실제 작업트리의
`scripts/check-review-gate.py`**에 4줄을 실제로 써버렸다(diff:
`+# control case...` / `+join = os.walk` / `+join('review')`). 발견 즉시 `git show
HEAD:scripts/check-review-gate.py` 원문을 `Read`→`Write`로 그대로 복원했고, `git status`/`git
diff`로 작업트리가 다시 깨끗함을 확인했다(아래 실행 로그에 포함). 이후의 모든 사본 작업은
호출마다 대상 디렉터리 존재를 먼저 확인하고 `cd` 대신 절대경로만 사용해 진행했다.

---

## 1. `OneJudgeTest` (`.claude/tests/test_review_gate_ci.py`) — "판정자가 하나"라는 주장이 속성-재바인딩에 뚫린다

**가드가 주장하는 성질**: `scripts/check-review-gate.py`는 `review_guard.evaluate_review()`
호출·인자 읽기·출력만 하고, 다른 "판정 연산"(파일 탐색, 다른 CVE/CI 판정 로직 등)을 갖지
않는다. 이 성질은 AST 를 파싱해 (a) import 된 최상위 모듈이 허용 목록 `_ALLOWED_IMPORTS`
안에 있는지, (b) 모든 `Call` 노드의 정본화된 호출명(별칭 해석 포함)이 `_ALLOWED_CALLS`
안에 있는지를 검사해서 강제한다(게이트 코드: `.claude/tests/test_review_gate_ci.py` 게이트
224-329, 특히 `_ALLOWED_CALLS` 정의 228-234, 별칭 추적 루프 288-293, 호출 검사 루프
295-311). 이 버전은 4번째 개정판이다 — 전체 grep → docstring 제외 grep → 연산 금지목록 →
지금의 import+호출 허용목록. 테스트 자신의 docstring 이 앞선 3개의 우회 사례를 명시한다.

**구성한 프로그램**: `scripts/check-review-gate.py`의 import 블록 바로 뒤에 아래 한 줄만
추가한다.

```python
sys.exit = os.system
```

이것은:
- 대입 **타깃**이 `sys.exit`라는 `ast.Attribute`다. 별칭 추적 루프(게이트 288-293)는
  `isinstance(node.targets[0], ast.Name)`인 경우만 취급하므로 Attribute 타깃 대입은
  아예 스캔 대상이 아니다 — allow/deny 어느 쪽으로도 걸리지 않는다.
- 대입 **우변**은 `os.system`이라는 단순 attribute 참조이지 `Call` 노드가 아니므로
  호출-스캔 루프(게이트 295-311)에도 걸리지 않는다.
- 파일 끝의 기존 정당한 호출부 `sys.exit(main())`(게이트 129-130)의 정적 이름은
  여전히 리터럴 `"sys.exit"`로 해석되고, 이는 `_ALLOWED_CALLS`에 있으므로 통과한다.

즉 **실행 시점에는** `sys.exit(main())`이 `os.system(main())`을 호출하도록 재바인딩되지만,
정적 검사기는 이 재바인딩 자체를 볼 수 있는 노드 형태를 전혀 스캔하지 않는다.

**실행 및 결과** (사본에서, 실제 작업트리는 손대지 않음 — 위 §사고 이후 절차):

```
$ python3 -m unittest discover -s .claude/tests -p 'test_review_gate_ci.py' -k OneJudgeTest -v
test_the_script_performs_no_judgement_operations_of_its_own (test_review_gate_ci.OneJudgeTest...) ... ok
Ran 1 test in 0.002s
OK
```

`OneJudgeTest`는 **그린**이다 — 이 테스트가 검사하겠다고 주장하는 바로 그 성질("판정
연산이 없다")이 거짓인 상태에서도.

**정직한 부기(part of "what I actually ran and printed")**: 같은 파일의 다른 클래스
`ReviewGateCliTest`는 실제로 서브프로세스로 스크립트를 실행하므로, 이 몽키패치가 적용된
스크립트를 실제로 돌리면 `main()`이 돌려주는 `int`(0 또는 1)를 `os.system()`에 넘기다가
`TypeError: expected str, bytes or os.PathLike object, not int`로 죽는다 — 그래서 파일
전체를 돌리면 10개 테스트가 실패한다. **그러나 이건 이 가드가 침입을 탐지해서가 아니라,
`sys.exit`와 `os.system`의 인자 개수/타입이 우연히 안 맞아서 생긴 부수 효과다.** 인자
형태가 우연히 맞는 다른 대상(예: 인자 없이 호출되는 지점, 또는 문자열을 받는 지점)으로
재바인딩했다면 `ReviewGateCliTest`도 조용히 통과했을 것이다 — 즉 "우연한 크래시가 이번엔
잡아줬다"이지 "가드가 이 클래스의 공격을 막는다"가 아니다. 대조군으로, 이 가드가 실제로
막아내는 형태도 확인했다(같은 사고 중 실제 저장소에서 우연히 재현): 지역 이름 별칭
`join = os.walk; join('review')`은 **잡힌다** — 별칭 테이블이 `Name→Name` 대입은 추적하므로
`join`이 `os.walk`로 정본화되어 `AssertionError: 'os.walk' not found in {...}`로 실패한다.
즉 가드의 경계는 정확히 "Name 대상 대입은 추적, Attribute 대상 대입(몽키패치)은 무시"이다.

**제안**: (1) 모듈 스코프에서 **Attribute를 대입 타깃으로 갖는 문장 자체를 금지**한다
(허용된 dotted 이름을 재바인딩할 합법적 이유가 이 스크립트엔 없다). (2) 더 근본적으로는
정적 AST 검사 대신(혹은 병행) 런타임에 `sys`/`os` 모듈을 프록시로 감싸 "허용된 심볼이
실행 중 재할당되지 않았다"를 어서션하는 회귀 테스트를 추가한다 — 이 클래스가 이미 4번
뚫린 이유가 "상상 못 한 우회는 못 막는다"는 점을 그 자신의 docstring이 인정하고 있으므로,
목록 확장보다 재바인딩 자체를 봉쇄하는 구조 변경이 다음 라운드에 더 안전하다.

---

## 2. `test_it_is_still_observation_only` (`.claude/tests/test_review_gate_ci.py` 게이트
430-454, 대상 `.github/workflows/review-gate.yml` 게이트 74) — 인용부호 분리로 리터럴
검사를 우회, `--enforce`가 조용히 켜진다

**가드가 주장하는 성질**: 이 CI 백스톱은 지금 **관측 전용**이어야 한다(`--enforce` 없이
호출). `--enforce`로 뒤집는 것은 워크플로 계약 변경이라 의도적 결정이어야 하고, 조용히
바뀌면 안 된다. 이전 라운드에서 `if:`→`env:` 이동, `run:`→`true` 치환으로 뚫린 자매
테스트(`WorkflowWiringTest`의 다른 케이스들)의 교훈을 받아, 이 테스트는 (1) 게이트를
호출하는 `run:` 문자열에 `--enforce` 리터럴이 없는지, (2) 모든 `env:` 값에도 없는지,
(3) 그 `run:` 문자열에 셸/GH 치환(`$`, `${{`)이 없는지를 검사한다(게이트 440-454).

**구성한 프로그램**: `.github/workflows/review-gate.yml`의 `run:` 한 줄만 바꾼다.

```yaml
      - name: Review coverage backstop
        run: python3 scripts/check-review-gate.py --enfor""ce
```

**실제 셸 동작 확인** (사본에서):

```
$ bash -c 'for a in --enfor""ce; do echo "[$a]"; done'
[--enforce]
```

bash는 인접한 빈 따옴표를 제거하고 토큰을 재결합하므로, 실행되는 인자는 문자 그대로
`--enforce`다. GitHub Actions의 `run:`은 정확히 이렇게(기본 셸 `bash`) 그 줄을 실행한다.

**PyYAML 파싱 확인** (테스트가 보는 것과 동일한 관측):

```
>>> yaml.safe_load(open('.github/workflows/review-gate.yml'))['jobs']['gate']['steps'][-1]['run']
'python3 scripts/check-review-gate.py --enfor""ce'
```

이 문자열은 리터럴 부분문자열 `"--enforce"`를 포함하지 **않는다** (`--enfor` + `""` +
`ce`로 쪼개져 있다) — `assertNotIn("--enforce", cmd)`가 통과한다.

**실행 및 결과**:

```
$ python3 -m unittest discover -s .claude/tests -p 'test_review_gate_ci.py' -k WorkflowWiringTest -v
test_a_step_actually_runs_the_script ... ok
test_checkout_fetches_full_history ... ok
test_it_is_still_observation_only ... ok
test_the_job_condition_exempts_dependabot ... ok
test_trigger_paths_cover_the_logic_it_depends_on ... ok
Ran 5 tests in 0.018s
OK
```

파일 전체(`ReviewGateCliTest` 포함 15개 전부)를 돌려도 **전부 그린**이다 — 이번엔 #1과
달리 사이드이펙트로 잡아주는 다른 테스트조차 없다. `ReviewGateCliTest`는 스크립트를
`subprocess.run([sys.executable, str(SCRIPT), ...])`로 **직접** 호출하지, YAML의 `run:`
문자열을 셸로 파싱해 실행하지 않기 때문에 이 워크플로-레벨 변조와 완전히 무관하다.

**의미**: 이 CI 잡은 현재 관측 모드(부작용 없음, `codebase/**` PR을 실패시키지 않음)로
문서화·설계돼 있다. 위 한 줄 변경은 이 계약을 **완전히, 그리고 어떤 테스트도 탐지하지
못한 채** 뒤집는다 — 이후 모든 PR에서 "리뷰 산출물이 같은 PR에 커밋되지 않은 435건 중
80건(18%, 실측치)"이 실패로 전환된다. 이는 정확히 이 저장소가 두 번(`if:`→`env:`,
`run:`→`true`) 이미 겪은 "리터럴 substring 검사는 문자열이 *어디* 있는지는 보지만 *셸이
그것을 어떻게 재조합하는지*는 못 본다"는 실패 클래스의 세 번째 사례다.

**제안**: 문자열을 정적으로 보지 말고, 실제 배선을 동적으로 검증한다 — 워크플로의
`run:` 문자열을 (env 포함해) 그대로 `subprocess.run(["bash", "-c", cmd], ...)`로 실행하되
`check-review-gate.py`를 자신의 `argv`를 기록하고 종료하는 스텁으로 바꿔치기한 뒤, 기록된
`argv`에 `--enforce`가 있는지를 확인한다. "구조로 판정한다 — substring이 아니라"는 원칙을
`if:`/`run:` 존재 여부에는 이미 적용했으면서, 그 문자열의 **셸 토큰화 결과**에는 아직
적용하지 않은 것이 이 우회의 근본 원인이다.

---

## 3. 그 밖의 관찰 (실행 검증은 안 했음 — 근거·범위 명시)

- `.github/workflows/review-gate.yml`의 `Fetch base ref` 스텝은 `${{ github.base_ref }}`를
  `run:`에 직접 보간하지 않고 `env: BASE_REF: ...` 경유 후 `"$BASE_REF"`로 인용해 사용한다
  (게이트 67-70). GitHub Actions 스크립트 인젝션 방지의 정석 패턴이고, 파일 자신의 주석이
  그 이유를 정확히 설명한다. **양호.**
- `permissions: contents: read`를 명시(게이트 41-42) — 새 워크플로에 최소 권한을 미리
  건 것으로 양호. `pull_request` 이벤트라 시크릿도 없다.
- `check-review-gate.py`는 예외를 전부 fail-open(exit 0)으로 삼는다(§3, §4 원칙) — 이는
  버그가 아니라 "백스톱이 자기 부재로 CI를 막으면 안 된다"는 명시적 설계이고, 이 계층이
  유일한 방어선이 아니라 심층방어라는 문서화된 전제와 일치한다. 다만 이 설계의 필연적
  귀결로 위 §1의 몽키패치처럼 게이트 함수 자체가 오염돼도(예: `review_guard` 모듈을 통째로
  악성 대체) 이 스크립트는 예외 없이 "정상 실행됐다"고 보고할 수 있다 — 그러나 그건 다른
  파일(`review_guard.py`)의 신뢰 경계이고 이번 diff 범위 밖이다.
- `test_review_gate_ci.py`에 `_ALLOWED_IMPORTS` 클래스 속성이 게이트 224행과 227행에
  **완전히 동일한 값으로 중복 선언**돼 있다(둘 다
  `{"__future__", "argparse", "os", "sys", "review_guard"}`). 보안 영향 없음(값이 같아
  덮어써도 의미 변화 없음) — 코드 위생 INFO.
- 하드코딩된 시크릿·평문 자격증명·SQL/커맨드 인젝션의 통상적 형태는 이 8개 파일 어디에도
  없다. 대상 자체가 애플리케이션 데이터가 아니라 CI/거버넌스 메타-코드라 OWASP Top 10의
  전형적 표면(SQLi, XSS, 세션관리 등)이 적용되지 않는다 — 이 라운드의 실질 위협 모델은
  "가드가 자기 자신이 막으려는 조작을 실제로 막는가"이고, 위 §1·§2가 그 답이다.

---

## 요약

이번 CI 백스톱(`review-gate.yml` + `check-review-gate.py`)은 관측 모드로 시작하고,
fail-open·판정 위임 단일화·봇 예외·`${{ }}` 간접 보간 같은 원칙은 올바르게 지켜졌다.
그러나 그 원칙들을 **고정하는 회귀 테스트 두 개는 실제로 뚫린다**: (1) `OneJudgeTest`의
import+호출 허용목록은 Attribute 대상 대입(몽키패치)을 전혀 스캔하지 않아 `sys.exit =
os.system` 한 줄로 "판정자가 하나"라는 핵심 불변식을 검사기 스스로는 탐지하지 못한 채
깨뜨릴 수 있다(다른 테스트가 우연한 인자-타입 불일치로 부수적으로 잡아줄 뿐). (2)
`test_it_is_still_observation_only`는 `run:` 문자열의 리터럴 부분문자열만 보므로,
`--enfor""ce`처럼 셸이 재조합할 인용부호 분리 한 번으로 "이 백스톱은 아직 관측 전용"이라는
검증을 통과시키면서 실제로는 하드 차단(`--enforce`)을 조용히 켤 수 있다 — 이쪽은 다른 어떤
테스트도 부수적으로도 잡아주지 않는다. 두 우회 모두 사본에서 실행해 확인했고, 실제
작업트리는 (중간에 발생한 스크래치패드 사고를 원복한 뒤) 손대지 않은 상태로 남겨뒀다.
현재 이 워크플로가 `--enforce` 없이 배포돼 있어 당장의 blast radius는 "PR을 실제로
막는다"가 아니라 "이 계층의 자기-보증 테스트가 신뢰할 수 없다"는 점에 있지만, 이 백스톱을
언젠가 켜기로 결정하는 순간 그 결정을 지키는 바로 그 테스트가 이미 무력화 가능한 상태다.

## 위험도

HIGH — 두 우회 모두 최소 변경(각각 한 줄)으로 재현 가능하고 실제로 실행해 확인했으며,
해당 회귀 테스트를 그린으로 유지한 채 이 라운드가 도입한 CI 계층의 핵심 불변식(판정자
단일화, 관측-전용 계약)을 무력화한다. 다만 (a) 워크플로가 현재 관측 모드라 프로덕션
차단에 즉시 영향은 없고, (b) 이 백스톱 자체가 "방어 심화"로 문서화된 부차 계층이며 로컬
push 훅이 여전히 1차 방어선이라는 점에서 CRITICAL까지는 아니라고 판단해 HIGH로 매겼다.
