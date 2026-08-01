# 유지보수성(Maintainability) Review

리뷰 대상: `.claude/tests/README.md`, `.claude/tests/test_block_integrity.py`,
`.claude/tests/test_review_gate_ci.py`, `.claude/tests/test_stop_guard_failopen.py`,
`.github/workflows/harness-checks.yml`, `.github/workflows/review-gate.yml`,
`plan/in-progress/harness-review-gate-ci-backstop.md`, `scripts/check-review-gate.py`.

작업 트리는 수정하지 않았다. 뮤테이션 실험은 별도 스크래치 디렉토리에 저장소 일부(`​.claude/`,
`scripts/`)를 복사해 그 사본에서만 수행했다:
`/private/tmp/claude-501/.../scratchpad/mtcopy`. `git status` 는 리뷰 시작 전과 동일하게
확인했으며 원본 저장소에는 어떤 변경도 가하지 않았다.

## 발견사항

- **[WARNING]** `OneJudgeTest` 가 이름/독스트링으로 약속하는 성질("판정자가 하나다 — 스크립트가
  자기 판정 로직을 새로 갖지 않는다")이 실제 구현이 검증하는 성질보다 넓다. 실제로는 "import
  모듈명 허용목록 + 호출 대상 이름 허용목록" 이라는 **순수 구문(syntax) 검사**이고, 허용된
  이름(`evaluate`, `_load_gate`, `main`)이 **진짜로 `review_guard.evaluate_review` 에 바인딩돼
  있는지는 검증하지 않는다** (data-flow/바인딩 검사 없음).
  - 위치: `.claude/tests/test_review_gate_ci.py:220` (`class OneJudgeTest`),
    `.claude/tests/test_review_gate_ci.py:253`
    (`def test_the_script_performs_no_judgement_operations_of_its_own`)
  - 상세: 사본에서 `scripts/check-review-gate.py` 를 다음 모양으로 교체했다 — `review_guard`
    는 여전히 import 하고(허용 목록 통과), `review_guard.evaluate_review` 를 죽은 참조로 한 번
    언급하고(`attrs` 검사 통과), 정작 `evaluate(root)` 함수는 **아무 호출도 하지 않고
    하드코딩된 `return False`("항상 allow")로 재구현**했다. `_load_gate` 도 이름은 그대로 두되
    반환값을 아무도 소비하지 않게 만들었다. 즉 "두 번째, 완전히 독립된 판정자"를 만들었는데 —
    이 테스트가 명시적으로 막겠다고 선언한 바로 그 결함 클래스다.
    ```
    def evaluate(root):
        return False  # "blocked" — 항상 allow, review_guard 호출 없음
    ```
    실행 결과:
    ```
    $ cd mtcopy/.claude/tests && python3 -m unittest test_review_gate_ci.OneJudgeTest -v
    test_the_script_performs_no_judgement_operations_of_its_own ... ok
    Ran 1 test in 0.001s
    OK
    ```
    스크립트를 실제로 돌려도(“관측” 이 아니라 `--enforce` 로!) 항상 통과로 답한다:
    ```
    $ python3 mtcopy/scripts/check-review-gate.py --root mtcopy --enforce
    review-gate: 통과 — mutated-judge: always allow (review_guard.evaluate_review never invoked)
    $ echo $?
    0
    ```
    `OneJudgeTest` 는 이 상태에서 **GREEN** 이다 — 이 클래스 하나만 실행하면 "판정자가 하나"라는
    이름의 성질이 거짓인 스크립트를 아무 문제 없다고 보고한다. (단, 공정하게 덧붙이면: 같은
    파일의 `ReviewGateCliTest` 쪽 행위 기반 테스트 8개는 이 극단적인 뮤턴트 — "항상 allow" —
    를 잡아낸다. `OneJudgeTest` 자체만 놓고 보면 자기 이름이 약속하는 불변식을 실제로는 지키지
    못한다는 뜻이다.)
  - 제안: 독스트링/테스트명이 주장하는 범위를 실제 검증 범위로 좁히거나("import·호출 이름의
    구문적 허용목록"이라고 명시), 혹은 `_load_gate`/`evaluate`/`main` 이 실제로
    `review_guard.evaluate_review` 를 리턴/호출하는지 최소한의 데이터플로 단언(예: `_load_gate`
    함수 본문이 `return review_guard.evaluate_review` 형태의 단일 `Return` 을 갖는지 AST 로
    확인)을 추가한다. 이 저장소는 이미 같은 부류 가드를 네 번 다시 썼다는 이력이 있으므로(주석에
    본인들이 기록), 다섯 번째 우회가 "이름만 같은 재구현"이라는 것을 지금 문서화해 두는 편이
    다음 라운드 비용을 줄인다.

- **[WARNING]** `_ALLOWED_IMPORTS` 클래스 속성이 **동일한 값으로 두 번 정의**돼 있다 — 복붙
  잔재로 보이는 죽은 코드.
  - 위치: `.claude/tests/test_review_gate_ci.py:224`, `.claude/tests/test_review_gate_ci.py:227`
    (`class OneJudgeTest` 본문)
  - 상세: 224행과 227행이 각각 동일한 주석(`# 스크립트가 실제로 쓰는 전부. …`)과 동일한
    `_ALLOWED_IMPORTS = {"__future__", "argparse", "os", "sys", "review_guard"}` 대입을 갖는다.
    파이썬 의미상 두 번째 대입이 첫 번째를 그대로 덮어써 동작에는 영향이 없지만, 리뷰어가
    "왜 두 번 있지? 값이 다른가?"를 매번 다시 확인해야 하는 잡음이고, 이 파일이 다루는 주제
    자체가 "허용 목록 하나의 정확성"이라는 점을 생각하면 그 목록 정의 자체가 중복돼 있는 것은
    특히 어색하다.
  - 제안: 227행의 중복 블록(주석+대입)을 삭제한다.

- **[WARNING]** "훅 사본을 만들고 `review_guard.py`/`plan_guard.py` 를 최소 스텁으로 덮어써
  서브프로세스로 실행한다"는 동일한 보일러플레이트가 서로 다른 두 파일, 세 곳에 손으로
  반복돼 있다.
  - 위치: `.claude/tests/test_block_integrity.py:390` (`NotesReachBothHooksTest._hook_env`),
    `.claude/tests/test_block_integrity.py:735` (`StopThrottleKeysOnTextTest.setUp`),
    `.claude/tests/test_stop_guard_failopen.py:66` (`StopGuardFailOpenTest.setUp`)
  - 상세: 세 곳 모두 "`tempfile.mkdtemp()` → `shutil.copytree(HOOKS_DIR, .../hooks)` →
    `_lib/review_guard.py` 를 문자열 스텁으로 덮어쓰기 → `_lib/plan_guard.py` 를
    `push_blocks` 프로퍼티를 갖는 최소 스텁으로 덮어쓰기 → `CLAUDE_PROJECT_DIR` 를 tmp 로
    지정해 서브프로세스 실행" 순서를 거의 그대로 반복한다. 이 저장소는 바로 이 파일들의
    독스트링에서 "~120줄 반복 대신 `_lib/failopen_state.py` 로 추출했다"는 식으로 중복 제거를
    가치로 명시하고 있는데, 정작 이 테스트 더블 보일러플레이트는 세 번째 사본이 생길 때까지
    합쳐지지 않았다.
  - 제안: `_harness.py` 에 `build_hook_sandbox(review_guard_src=None, plan_guard_src=None) ->
    (tmp, hooks_dir)` 류의 공용 헬퍼를 하나 추가해 세 곳에서 재사용한다. 넷째 사본이 또
    손으로 복붙되기 전에 닫는 편이 싸다(이 저장소가 스스로 기록한 패턴: "감사는 개별 사례를
    고치고, 구조는 클래스를 고친다").

- **[INFO]** `test_the_script_performs_no_judgement_operations_of_its_own` 하나가 서로 다른
  네 가지 구문 점검(모듈 import 허용목록 / 지역 별칭 역추적 / 호출 대상 허용목록 /
  `getattr(module, …)` 우회 탐지 / `attrs` 존재 확인)을 한 테스트 메서드 안에서 순서대로
  수행한다(약 80줄, `ast.walk` 4회).
  - 위치: `.claude/tests/test_review_gate_ci.py:253`
  - 상세: 각 점검이 서로 다른 실패 메시지를 갖고는 있지만, 테스트 하나가 실패했을 때 어느
    하위 점검이 깨졌는지는 트레이스백을 끝까지 읽어야 알 수 있다. 이 파일의 다른 클래스들은
    성질 하나당 메서드 하나로 쪼개는 패턴을 쓰고 있어(`WorkflowWiringTest` 등) 이 메서드만
    스타일이 다르다.
  - 제안: 필수는 아니지만, `_assert_imports_allowed`/`_assert_calls_allowed`/
    `_assert_no_getattr_bypass` 같은 private 헬퍼로 쪼개거나, 최소한 4개의 개별
    `subTest`/테스트 메서드로 나누면 실패 지점을 더 빨리 특정할 수 있다.

- **[INFO]** `timeout=120` 이라는 매직 넘버가 같은 파일 안에서 두 번 하드코딩돼 있다.
  - 위치: `.claude/tests/test_review_gate_ci.py:85` (`_run` 헬퍼), 및
    `.claude/tests/test_review_gate_ci.py:154` (`test_the_default_root_resolves_to_this_repository`,
    이 테스트는 `--root` 를 넘기지 않아야 하므로 `_run()` 을 못 쓰고 `subprocess.run` 을
    직접 호출한다)
  - 상세: 이 파일 자신의 `_run` 독스트링이 "손으로 다시 타이핑한 두 번째 `subprocess.run`" 이
    한쪽만 고치기 쉬운 모양이라고 스스로 지적하고 있는데(83번 줄 주변 주석), 정작 `timeout`
    값 자체는 상수로 뽑히지 않고 두 자리에 리터럴로 반복돼 있다.
  - 제안: 모듈 레벨 `_SUBPROCESS_TIMEOUT = 120` 상수로 뽑아 두 곳에서 재사용.

- **[INFO]** `README.md` 카탈로그의 일부 행(예: `test_override_floors.py`,
  `test_push_guard_allowlist.py` 행)이 한 마크다운 표 셀 안에 400단어 이상의 단일 문단으로
  들어있어, 표 형태임에도 한눈에 스캔하기 어렵다.
  - 위치: `.claude/tests/README.md` — "What's covered" 표, `test_override_floors.py` 행,
    `test_push_guard_allowlist.py` 행
  - 상세: 이는 이 저장소가 의도적으로 채택한 "왜"를 남기는 밀도 높은 엔지니어링 로그 스타일의
    연장이고(과거 회고 기록에도 이런 문서 밀도가 반복적으로 정당화돼 있음), 이번 변경이 새로
    도입한 문제는 아니다. 다만 계속 자라는 방향이라 스캔 비용이 누적된다는 점만 기록해 둔다.
  - 제안: 조치 불필요(기존 컨벤션과 일치). 다음에 표 전체를 다듬을 기회가 있다면 각 행을
    "한 줄 요약 + 세부는 각주/링크"로 나누는 것을 고려할 수 있다.

## 요약

핵심 로직 파일(`check-review-gate.py`, 두 워크플로 YAML)은 짧고 목적이 분명하며, 함수 길이·중첩
깊이·네이밍 모두 양호하다. 반면 이를 지키는 테스트 스위트(`test_review_gate_ci.py`)에는 유지보수성
관점에서 두 가지 실질적 문제가 있다: (1) `OneJudgeTest` 가 자신의 이름/독스트링이 약속하는 "판정자는
하나"라는 불변식을 실제로는 구문적 허용목록으로만 검증해, 허용된 이름을 재사용한 완전 재구현
스크립트에도 GREEN 을 낸다는 것을 사본에서 직접 재현했다(같은 파일의 행위 기반 테스트들은 이
극단적 사례를 잡아내므로 전체 스위트는 방어되지만, 이 클래스 자체의 보장 범위는 과대 주장돼 있다).
(2) 동일한 클래스 안에 완전히 동일한 `_ALLOWED_IMPORTS` 대입이 중복돼 있고, "훅 사본 + 스텁 게이트
모듈" 보일러플레이트가 두 파일 세 곳에 손으로 반복돼 있어 이 저장소가 스스로 반복적으로 언급하는
"중복은 drift 의 씨앗"이라는 원칙과 배치된다. 그 외에는 매직 넘버 중복 하나, 테스트 메서드 하나의
과다 책임 정도의 경미한 지적뿐이다.

## 위험도

MEDIUM
