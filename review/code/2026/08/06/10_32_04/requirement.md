# 요구사항(Requirement) 리뷰 — 리뷰 게이트 CI 백스톱 (4R)

CONTEXT 로 명시된 임무("모든 테스트가 GREEN 인 채로 SHIPPED BEHAVIOUR 를 바꿀 수 있는가")를
실측했다. **두 개의 독립적인 우회를 찾았고 둘 다 실행으로 확인했다** — 각각 1~2줄 diff 로
`review-gate.yml` 을 영구히 무력화하는데 `test_review_gate_ci.py` 18개 테스트 전부, 그리고
`test_workflow_yaml_structure.py` 6개 전부 GREEN 이다.

## 재현 방법 (WORKING-TREE RULE 준수)

실제 워크트리는 건드리지 않았다. `mktemp -d` 로 만든 격리 디렉터리에 `.claude`/`.github`/
`scripts` 를 절대경로로 복사한 사본에서만 변형했다. 최종 `git status --porcelain=v1 -uall`
확인 결과 실제 저장소는 이 세션의 review 메타파일(`review/code/2026/08/06/10_32_04/*`) 외
어떤 변경도 없다.

---

## 발견사항

- **[CRITICAL]** `WorkflowWiringTest` 의 "실패를 못 내게 만드는 키" 방어가 **step 에만** 적용되고
  **job 레벨**엔 없다 — `continue-on-error: true` 를 `jobs.gate.timeout-minutes` 옆(스텝이 아니라
  잡 자체)에 한 줄 추가하면, `--enforce` 를 켠 뒤 게이트 스텝이 exit 1 을 내도 **잡 전체가
  성공으로 보고돼 PR 체크가 통과한다.** 3R 이 정확히 이 실패 클래스(`continue-on-error`)를
  스텝 레벨에서 닫았다고 문서화했는데(`_NEUTERING_KEYS` 의 docstring: "실측으로 이 스위트를
  통과했다"), 같은 키를 한 단계 위 스코프에 두면 같은 방식으로 다시 뚫린다.
  - 위치: `.claude/tests/test_review_gate_ci.py:405-406`(`self.job = self.doc["jobs"]["gate"]` 만
    잡히고 이후 아무 테스트도 `self.job` 의 미지 키를 검사하지 않는다), `:423`
    (`_NEUTERING_KEYS` 가 `step` 변수에만 적용, `test_the_gate_step_cannot_be_skipped_or_have_its_failure_swallowed`
    는 `step = self.steps[self._gate_step_index()]` 에서만 키를 검사), 대상 파일은
    `.github/workflows/review-gate.yml:45-47`(`gate:` / `runs-on:` / `timeout-minutes:` 블록).
  - 재현 명령·출력(격리 사본, 실제 워크트리 무변경):
    ```
    $ diff -u <원본>/.github/workflows/review-gate.yml <mutated>/.github/workflows/review-gate.yml
    @@ -45,6 +45,7 @@
       gate:
         runs-on: ubuntu-latest
         timeout-minutes: 5
    +    continue-on-error: true
         # 봇 PR 은 ...
    $ cd <mutated-repo> && python3 -m unittest discover -s .claude/tests -p 'test_review_gate_ci.py'
    ..................
    ----------------------------------------------------------------------
    Ran 18 tests in 2.758s
    OK
    ```
  - 제안: `_NEUTERING_KEYS` 검사를 `self.job` 자체에도 적용(`continue-on-error`/`if`/
    `timeout-minutes: 0` 등을 잡 레벨에서도 금지)하거나, 더 근본적으로 `self.job` 의 키 집합을
    `{"runs-on", "timeout-minutes", "if", "steps"}` 로 닫힌 목록 비교(exact set equality)해
    예상 밖의 신규 키가 추가되면 즉시 실패하게 만든다. round 4 스스로가 채택한 원칙("기대값
    전체를 적어두는 편이 유한하고 완전하다")을 `job` 딕셔너리 자체에는 적용하지 않은 것이
    이 구멍의 근본 원인이다.

- **[CRITICAL]** `test_trigger_paths_are_exactly_the_expected_set` 은 `self.on["pull_request"]`
  의 `paths` **키 값만** 정확 일치로 검사하고, `pull_request` 매핑 자체에 **다른 키가 있는지는
  전혀 보지 않는다.** `on.pull_request.branches`(또는 `branches-ignore`, `types`)를 `paths` 옆에
  형제 키로 추가하면 — GitHub Actions 스키마상 완전히 유효한 조합이며 `paths`/`branches` 는
  AND 로 결합된다 — 이 저장소의 실제 base 브랜치(`main`)와 절대 매치되지 않는 값
  (`this-branch-does-not-exist`)을 주는 것만으로 **이 워크플로가 어떤 실제 PR 에서도 영원히
  트리거되지 않는다.** 이건 hole A 와 달리 `--enforce` 를 켤 필요조차 없다 — **지금 관측
  모드에서도 백스톱 자체가 완전히 죽는다**(Actions 탭에 실행 기록조차 남지 않아 감지 방법이
  워크플로 파일을 직접 읽는 것뿐이다).
  - 위치: `.claude/tests/test_review_gate_ci.py:459`(`self.assertEqual(self.on["pull_request"]["paths"], self.EXPECTED_PATHS)`
    — `on["pull_request"]` 딕셔너리의 나머지 키에 대해서는 아무 단언도 없음), 대상 파일은
    `.github/workflows/review-gate.yml:22-24`(`on: / pull_request: / paths:` 블록).
  - 재현 명령·출력:
    ```
    $ diff -u <원본>/.github/workflows/review-gate.yml <mutated>/.github/workflows/review-gate.yml
    @@ -32,6 +32,8 @@
           - '.claude/_shared/**'
           - 'scripts/check-review-gate.py'
           - '.github/workflows/review-gate.yml'
    +    branches:
    +      - 'this-branch-does-not-exist'

     concurrency:
    $ cd <mutated-repo> && python3 -m unittest discover -s .claude/tests -p 'test_review_gate_ci.py'
    ..................
    ----------------------------------------------------------------------
    Ran 18 tests in 2.609s
    OK
    $ python3 -m unittest discover -s .claude/tests -p 'test_workflow_yaml_structure.py'
    ......
    ----------------------------------------------------------------------
    Ran 6 tests in 0.041s
    OK
    ```
    (전체 `.claude/tests/` 안에서 `review-gate.yml` 을 참조하는 파일은
    `test_review_gate_ci.py` 하나뿐임을 `grep -rn "review-gate.yml" .claude/tests/` 로 확인 —
    다른 어떤 스위트도 이 구멍을 우연히 잡지 않는다.)
  - 제안: `self.on["pull_request"]` 를 `{"paths": self.EXPECTED_PATHS}` 와 **키 집합까지 포함해**
    정확 일치로 비교한다(`assertEqual(self.on["pull_request"], {"paths": self.EXPECTED_PATHS})`).
    `branches`/`branches-ignore`/`types`/`tags` 등 트리거 자체를 조용히 좁히는 모든 형제 키가
    한 번에 막힌다.

- **[WARNING]** 위 두 구멍의 공통 근본 원인: 이번 라운드의 설계 원칙("패턴 매칭 대신 기대값
  전체를 정확 일치로 고정")이 **리프 값**(`run` 문자열, `if` 문자열, `concurrency` 딕셔너리,
  `paths` 리스트)에는 적용됐지만, 그 값들을 담는 **컨테이너(딕셔너리) 자체의 키 집합**에는
  적용되지 않았다. 즉 "이 키의 값이 정확히 X 다" 는 닫혀 있지만 "이 딕셔너리에 이 키들
  **밖에** 없다" 는 열려 있다 — 허용 목록(allow-list)이 값 축에서는 완전한데 키 축에서는
  없는 것과 같은 모양이다(`OneJudgeTest` 가 "호출 축은 여전히 금지 목록" 이라며 스스로 반성한
  4차 실패와 구조적으로 동일). `self.job`, `self.on["pull_request"]`, 그리고 `self.doc` 최상위
  (예: 새 `on.workflow_dispatch` 추가나 `permissions` 완화 같은 것도 같은 사각) 모두 이
  패턴에 노출돼 있다. 다른 신규 워크플로 wiring 테스트를 쓸 때도 "값 대조" 와 "키 집합 대조"
  를 세트로 요구하는 편이 이번처럼 라운드마다 하나씩 새로 찾는 것보다 싸다.
  - 위치: `.claude/tests/test_review_gate_ci.py:392-475`(`WorkflowWiringTest` 클래스 전체)
  - 제안: 코드 수정이 아니라 테스트 강화 항목이므로 `resolution-applier`/developer 턴에서
    `self.doc`·`self.job`·`self.on["pull_request"]` 각각에 대해 "알려진 키 집합과 정확히
    같다" 는 단언을 추가할 것을 권고.

- **[INFO]** 이 변경은 `spec/` 영역이 아니라 harness(`.claude/`) 자기 자신을 다루므로, 프로젝트
  관례상 `spec/` 문서가 존재하지 않는 것이 정상이다(관련 spec 없음). 대신 권위 문서는
  `plan/in-progress/harness-review-gate-ci-backstop.md`(파일 7)와
  `.claude/tests/README.md`(파일 1)이며, 둘 다 스크립트 docstring·테스트 내용과 line-level 로
  정합했다 — "판정자가 하나다"/"관측 모드가 기본"/"fail-open"/"advisory 는 판정과 무관" 네
  성질이 plan 문서, README 표, 스크립트 docstring, 테스트 클래스 docstring 네 곳 모두에서
  같은 근거(측정치 80/435, 18%, TTL 1800초 등)로 일관되게 서술된다. drift 없음.

- **[INFO]** TODO/FIXME/HACK/XXX 주석은 8개 리뷰 대상 파일 전체에서 0건(`grep -nE
  "TODO|FIXME|HACK|XXX"` 확인). `plan/in-progress/...md` 의 "신규 후속 (defer)" 11개 항목은
  숨겨진 TODO 가 아니라 명시적으로 범위 밖으로 티켓팅된 항목이라 이번 변경의 완전성 판단에
  영향 없음.

- **[INFO]** `scripts/check-review-gate.py` 자체(파일 8)의 표준 체크리스트 통과 확인:
  `main()` 의 모든 경로(gate 미로드/예외/미차단/차단+관측/차단+enforce)가 `int` 를 반환하고
  `sys.exit(main())` 로 소비된다(완전한 반환값 커버리지). fail-open 두 경로 모두
  `ReviewGateCliTest.test_a_missing_gate_module_does_not_fail_ci` /
  `test_a_gate_that_raises_does_not_fail_ci` 로 실제 프로세스 단위 테스트가 있다.
  `getattr(decision, "notes", ()) or ())` 는 `notes` 속성 부재·`None` 양쪽을 방어한다(엣지
  케이스 처리 적절).

## 요약

리뷰 대상 스크립트·워크플로 자체는 명시된 요구사항(판정자 위임, 관측 모드 기본, fail-open,
advisory 무조건 출력)을 정확히 구현하고 있고 plan/README 문서와도 완전히 정합한다. 다만 이번
라운드의 실제 임무 — "SHIPPED BEHAVIOUR 를 바꾸면서 테스트를 GREEN 으로 유지할 수 있는가" —
를 실행해 본 결과 **두 개의 재현 가능한 우회를 확인했다**: (1) `continue-on-error: true` 를
`review-gate.yml` 의 **스텝이 아니라 잡 레벨**에 한 줄 추가하면 `--enforce` 활성화 후에도
게이트 실패가 PR 체크에 반영되지 않는다, (2) `on.pull_request.branches` 를 `paths` 옆에 형제
키로 두 줄 추가하면 워크플로가 **지금 당장, enforce 여부와 무관하게** 어떤 실제 PR 에서도
영원히 트리거되지 않는다. 둘 다 `.claude/tests/test_review_gate_ci.py` 18개 전부와
`test_workflow_yaml_structure.py` 6개 전부를 GREEN 으로 통과했고, 다른 어떤 하네스 스위트도
`review-gate.yml` 을 참조하지 않아 우연히도 잡히지 않는다. 근본 원인은 동일하다: "정확 일치"
원칙이 리프 값에는 적용됐지만 그 값을 담는 딕셔너리(`self.job`, `self.on["pull_request"]`)의
**키 집합**에는 적용되지 않았다 — round 4 문서가 스스로 세 번 반증됐다고 적은 "부분 일치는
무한한 표면" 패턴이 컨테이너 레벨에서 그대로 재발한 것이다. 코드 자체가 아니라 그것을
지킨다고 주장하는 테스트의 커버리지 갭이므로, 다음 라운드는 정적 패턴을 더 추가하는 대신
`self.job`/`self.on["pull_request"]` 를 키 집합까지 포함한 정확 일치로 닫는 편이 이 클래스
전체를 유한하게 종결한다.

## 위험도

CRITICAL — 대상 컴포넌트의 존재 이유 자체가 "정규식 하나가 유일 판정자인 사각지대를 닫는
백스톱" 이고 이번 라운드는 "그 백스톱을 테스트가 못 잡게 우회할 수 있는가" 를 명시적으로
검증하는 라운드였다. 1~2줄 diff 로 재현 가능한 우회를 두 건 확인했고, 그중 하나(hole B)는
`--enforce` 활성화 여부와 무관하게 **지금 당장** 워크플로 전체를 영구 무력화하며 Actions 실행
기록조차 남기지 않는다. 실제로 악용됐다는 증거는 없으나(현재 `review-gate.yml` 본문에는 두
키 모두 없음), 방어가 "닫혔다" 고 주장하는 지점에서 이 정도로 얕은 시도로 뚫린다는 사실 자체가
이 라운드의 핵심 요구사항 미충족이다.

STATUS: SUCCESS
