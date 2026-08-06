# 아키텍처(Architecture) 리뷰 — 2R (리뷰 게이트 CI 백스톱)

## 방법론 메모 (이 라운드가 요구한 것)

1R 서머리가 지목한 초점 — "가드/테스트가 그 자신이 지켜야 할 성질이 거짓인데도 통과하는가" —
을 실제로 실행해 검증했다. 아래 두 항목은 **직접 실행한 mutation 으로 재현**했다(추론이 아님).
검증 중 이 워크트리가 다른 리뷰어 서브에이전트와 **동시에 공유**되고 있다는 것도 관측했다 —
`scripts/check-review-gate.py` 와 `.github/workflows/review-gate.yml` 이 검증 도중 일시적으로
변형됐다가(다른 세션의 자체 mutation 실험으로 추정 — `getattr(__import__('os'), 'walk')` 우회가
`_load_gate()` 안에 잠깐 나타났다 사라졌고, `review-gate.yml` 의 `run:` 이 `true $GATE_FLAG` 로
잠깐 바뀌었다 원복됐다) 곧 원복됐다. 이 관측치들은 내가 만든 것이 아니고 git diff 로 원복을
확인했으므로, 아래 발견사항은 그 노이즈를 제외하고 **내 독립 scratch 사본**(`/private/tmp`)에서
재현한 것만 기재한다.

## 발견사항

- **[CRITICAL]** "판정자가 하나다"(OneJudgeTest)의 banned-call 스캔이 평범한 지역 변수 별칭 /
  `getattr` 간접 호출로 우회된다 — 3번 재작성된 이 가드의 4번째 우회.
  - 위치: `.claude/tests/test_review_gate_ci.py:261-268`(`alias_of` 구성 — `ast.Import`/
    `ast.ImportFrom` 노드만 채움), `:269-283`(banned-call 대조) — 함수
    `OneJudgeTest.test_the_script_performs_no_judgement_operations_of_its_own`.
  - 상세: `alias_of` 딕셔너리는 오직 `import`/`from ... import` 문에서만 채워진다. 따라서
    `walk = os.walk`(평범한 지역 변수 대입) 또는 `getattr(os, "walk")(...)`(속성 접근이
    아니라 함수 호출을 경유) 로 `os.walk` 를 부르면 `called` 집합에 `"os.walk"` 로 기록되지
    않는다 — `f.value` 가 `ast.Name` 이 아니라 값 자체가 되거나(`getattr` 케이스, Call 노드),
    이름 해석표에 아예 없는 로컬 식별자(`walk`)가 되기 때문이다.
    **실측**: `scripts/check-review-gate.py` 를 그대로 복제하고 `_load_gate()` 옆에
    `_second_judge(root)` 헬퍼를 추가했다 — `walk = os.walk` 로 얻은 참조로 저장소를 스스로
    walk 해 `SUMMARY.md` 개수를 센다. `review_guard` import·`evaluate_review` 호출은
    그대로 남겨 앞선 두 assertion(`review_guard` 가 import 됐는가, `evaluate_review` 속성이
    쓰였는가)도 통과하도록 만들었다. `main()` 안에서 `_own_count = _second_judge(root)` 로
    실제 호출까지 연결한 뒤 `OneJudgeTest` 를 이 mutant 에 대해 단독 실행 —
    `test_the_script_performs_no_judgement_operations_of_its_own` 는 **"ok"로 통과**했다
    (재현 가능, 아래 커맨드 로그 참고). 즉 "판정자는 evaluate_review 하나뿐" 이라는, 이 파일
    전체의 존재 이유인 그 불변식을 실제로 깨는 코드(두 번째 판정 로직을 만들어 병행 호출)를
    심어도 가드가 잡지 못한다. 같은 세션에서 다른 리뷰어가 `getattr(__import__('os'), 'walk')`
    형태로 **같은 클래스의 우회를 독립적으로 실증**한 흔적을 실시간으로 목격했다(git diff 로
    확인, 곧 원복됨) — 우연이 아니라 이 가드의 구조적 한계라는 뜻이다.
  - 제안: 정적 AST 스캔은 "상상 가능한 우회를 나열" 하는 방식이라 한계가 유한하고(이미 3회
    재작성 이력이 그 증거), alias/getattr/`__import__`/`eval` 전부를 한 번에 막으려면
    **행위 기반(dynamic) 가드**로 전환할 것 — 예: `unittest.mock.patch` 로 `os.walk` /
    `os.scandir` / `os.listdir` / `builtins.open` 을 실제 spy 로 감싼 채 `main()` 을
    in-process 호출하고 "한 번도 안 불렸다" 를 단언. 이름이 아니라 **실제 호출 여부**를 보므로
    별칭·간접호출에 영향받지 않는다. AST allowlist 는 "새 import 등장 시 리뷰를 강제" 하는
    1차 방어로는 유지해도 되지만, banned-call 검사는 이걸로 대체해야 이번 클래스의 우회가
    구조적으로 막힌다.

- **[WARNING]** `test_a_step_actually_runs_the_script` 가 여전히 substring 검사라서 "주석 안에
  스크립트 경로 문자열, 실제 `run:` 본문은 no-op" 조합을 통과시킨다 — 같은 클래스 docstring이
  선언한 "구조로 판정한다, substring 이 아니라"는 원칙이 이 메서드 하나에는 안 닿아 있었다.
  - 위치: `.claude/tests/test_review_gate_ci.py:325-326`(`_run_commands`), `:328-333`
    (`WorkflowWiringTest.test_a_step_actually_runs_the_script`).
  - 상세: **실측** — `review-gate.yml` 의 `Review coverage backstop` 스텝을
    ```yaml
    run: |
      # scripts/check-review-gate.py disabled pending investigation, see TODO-1234
      echo 'gate temporarily disabled'
    ```
    로 바꾼 사본을 만들고 `_harness.REPO_ROOT` 를 이 내용만 담은 임시 디렉터리로 몽키패치한
    뒤 이 테스트를 단독 실행 — **"ok"로 통과**했다. 즉 게이트가 전혀 실행되지 않는(주석에만
    이름이 남은) 워크플로에서도 이 wiring 테스트는 초록이다. 같은 클래스의 자매 테스트들
    (`test_the_job_condition_exempts_dependabot` 은 `self.job.get("if", "")`, ``
    `test_checkout_fetches_full_history` 는 `st.get("with", {}).get("fetch-depth")`,
    `test_trigger_paths_cover_the_logic_it_depends_on` 은 `self.on["pull_request"]["paths"]`
    리스트 멤버십) 은 전부 YAML 파스 트리의 구조를 보는데, 이 메서드만 `"scripts/…" in c`
    라는 순수 substring 검사로 남아 있다.
  - 제안: 자매 테스트들처럼 구조로 판정할 것 — 예컨대 `run:` 텍스트를 `shlex` 로 실제 파싱해
    (주석·개행 제거 후) 첫 실행 가능한 명령 토큰이 `python3 scripts/check-review-gate.py` 로
    시작하는지 확인하거나, 최소한 "그 문자열이 `#`로 시작하는 라인이 아닌 위치에 등장"을 확인.

- **[WARNING]** (연관, 낮은 확신도 — 미실행) `test_it_is_still_observation_only` 도 같은 근본
  원인(substring vs 구조)을 공유한다. `assertNotIn("--enforce", cmd)` 는 파일 리터럴 텍스트만
  본다. GitHub Actions 는 `run:` 안에서 리포지토리/조직 변수를 `${{ vars.X }}` 로 참조할 수
  있으므로, `run: python3 scripts/check-review-gate.py ${{ vars.ENFORCE_FLAG }}` 로 바꾸고
  `vars.ENFORCE_FLAG` 를 리포지토리 설정(이 파일 밖)에서 `--enforce` 로 두면, 이 파일의 diff
  에는 `--enforce` 라는 문자열이 전혀 등장하지 않은 채 관측→강제 전환이 일어난다.
  - 위치: `.claude/tests/test_review_gate_ci.py:368-374`.
  - 상세: GitHub 리포지토리 변수는 로컬에서 재현할 수 없어 **직접 실행 검증은 하지 못했다** —
    substring 로직만으로 추론한 이론적 경로임을 명시한다. 다만 근거는 위 두 항목과 동일한
    코드 패턴(`_run_commands()` 반환 문자열에 대한 순수 텍스트 검사)이라 신뢰도는 낮지 않다.
  - 제안: `Fetch base ref` 스텝이 이미 채택한 원칙("`${{ }}` 를 셸 명령에 직접 보간하지 않는다")
    을 이 스텝에도 명문화하고, 테스트에 `${{ }}` 표현식이 `run:` 안에 등장하면 그 자체를
    실패시키는 조항을 추가할 것.

- **[INFO]** (이미 추적·defer 확정 — 재확인만) origin 기본 브랜치 해석 로직이 4곳
  (`branch_guard._origin_default_branch`, `review_guard._default_branch`,
  `code_review_orchestrator._default_branch_ref`, consistency orchestrator 의 리터럴)에
  독립 구현돼 있다. `review-gate.yml`/`harness-checks.yml` 양쪽의 `paths:` 가
  `branch_guard.py` 를 별도로 등재해야 하는 것 자체가 이 결합의 증상이다.
  - 위치: `.github/workflows/review-gate.yml:28-31`, `plan/in-progress/harness-review-gate-ci-backstop.md`
    "신규 후속 (defer)" 절.
  - 상세: 4곳의 반환 계약이 다르고(`main` vs `origin/main`), 실제 통합에는 `_lib` 네임스페이스
    충돌 해소가 선행돼야 해 별도 범위로 이미 defer 돼 있다. 이번 PR 이 이 결합을 늘리지는
    않지만, 트리거 경로 목록을 손으로 동기화해야 하는 유지비를 다시 노출한다.
  - 제안: 추가 조치 불필요(이미 문서화·추적됨). 다섯 번째 소비자가 생기기 전에 통합 우선순위를
    올릴 것을 재확인.

- **[INFO]** `_load_gate()` 가 `sys.path.insert(0, lib)` 로 전역 가변 상태(모듈 검색 경로)를
  부작용으로 수정한다 — 서비스 로케이터를 흉내낸 암묵적 전역 상태 변경.
  - 위치: `scripts/check-review-gate.py:63-67`(`_load_gate`).
  - 상세: `.claude/hooks/_lib` 와 `.claude/skills/_lib` 의 이름 충돌 때문에 이 저장소 전역에
    이미 확립된 패턴이고(자매 테스트 스위트들도 동일 우회를 문서화), 스크립트가 단발성 CLI
    프로세스로만 실행되므로 실질 위험은 낮다.
  - 제안: 현행 유지 가능. `_lib` 네임스페이스 통합이 이뤄지면 자연히 해소되는 문제라 이번
    범위에서 손댈 필요 없음.

## 요약

`scripts/check-review-gate.py` 자체는 아키텍처적으로 정확하다 — 판정 로직을 전혀 재구현하지
않고 `review_guard.evaluate_review()` 하나에 전량 위임하는 얇은 어댑터로, 의존성 역전과 단일
책임을 정확히 지키며 이 저장소가 이미 두 번 겪은 로컬/CI drift(`report_paths`, `retry_state`)
재발을 구조적으로 막는다. 관측 모드 기본값, fail-open, advisory 의 판정-무관 출력도 모두 근거가
측정치로 뒷받침돼 있어 설계 결정으로서 타당하다. 다만 이 레이어의 실질적 안전판은 코드가 아니라
**그것을 지키는 테스트**이고, 이번 라운드에서 실제로 실행한 mutation 이 그 안전판 두 곳(가장
핵심적인 "판정자는 하나" 불변식을 지키는 `OneJudgeTest`, 그리고 워크플로가 실제로 게이트를
실행하는지를 확인하는 wiring 테스트)에서 **AST/substring 검사가 흔한 코드 패턴(변수 별칭,
getattr, YAML 주석) 앞에서 뚫리는 것을 재현**했다. 이미 3~4회 같은 패턴으로 우회당한 이력이 있는
클래스인 만큼, 정적 검사를 더 정교하게 다듬는 대신 행위 기반(behavioral) 검증으로 전환하는 것이
근본 해법이다. 그 외 duplication(기본 브랜치 해석 4곳)과 `sys.path` 부작용은 이미 인지·추적되고
있고 이번 변경이 악화시키지 않는다.

## 위험도

HIGH
