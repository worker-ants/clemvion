# 요구사항(Requirement) 리뷰 — 리뷰 게이트 CI 백스톱 6R

## 사전 안내 — 작업 방식

CONTEXT 가 명시한 "다음 층을 찾아라" 지시에 따라, 표준 9관점 코드 리뷰에 더해 **실제
우회 탐색**을 수행했다. 실 저장소 워킹트리는 건드리지 않았다 — `git archive HEAD` 로
격리된 사본을 `mktemp -d` 아래 새로 만들고, 이번 라운드에서 리뷰 대상인 9개 파일은
프롬프트 번들의 정확한 텍스트로 덮어써 "지금 리뷰되는 바로 그 내용"을 사본에 고정한
뒤 그 위에서만 뮤테이션을 실험했다. 절대경로만 썼고 `cd` 실패에 의존하지 않았다.

- 사본 위치: `/private/tmp/claude-501/.../scratchpad/ci-backstop-sandbox.pBtU8Q/repo`
  (세션 스크래치패드 하위, 실 저장소 밖)
- 베이스라인: 사본에 `git init` 후 스냅샷 커밋 → `test_review_gate_ci.py`(16) +
  `test_workflow_yaml_structure.py`(9) = 25 tests, 전부 OK.

### 부수 관찰 — 리뷰 도중 워킹트리 HEAD 가 실제로 전진했다 (작업 이상 없음, 정보성)

리뷰 착수 직후 실 워크트리에서 `git status`를 두 번 찍었는데, 첫 번째는
`.claude/tests/test_review_gate_ci.py`에 미커밋 diff(+57줄, `ReviewArtifactsStayTrackedTest`
클래스 신설)가, 두 번째(수 분 뒤)는 그 diff 가 커밋 `e46f5382c`(`"이 백스톱이 서 있는
전제를 가드 — review/** 가 추적된다는 사실"`)로 정착되어 clean 상태였다. 내용은 정확히
`.gitignore`가 `review/**`를 배제하고/커밋물이 실제로 추적되는지를 검증하는 새 테스트
클래스였다. 즉 **이 리뷰가 검토하는 번들(프롬프트 스냅샷)은 이미 한 커밋만큼 뒤처져
있다** — 다른 세션(developer)이 동시에 라운드 7 성격의 수정(gitignore/커밋 추적 전제
가드)을 병행 진행·커밋한 것으로 보인다. 내가 만든 변경이 아니다(그 시점까지 나는
스크래치패드 밖에 아무것도 쓰지 않았다). 코드 결함이 아니라 **push 전 재확인이 필요한
프로세스 관찰**로 기록한다 — 이 리뷰의 번들 스냅샷과 최신 HEAD 를 대조하지 않고
그대로 병합 판단에 쓰면 이미 처리된 항목을 다시 지적하거나, 반대로 그 사이 들어온
다른 변경을 놓칠 수 있다.

---

## 발견사항

- **[CRITICAL]** 6R 이 고정한 것은 전부 `review-gate.yml` **한 파일의 내용**이다 — `.github/workflows/` **디렉터리에 어떤 파일이 존재하는가** 자체는 아무 테스트도 제약하지 않는다. 이름과 job id 를 원본과 맞춘 "언제나 성공하는" 별도 워크플로 파일을 추가하면, 이번 라운드가 새로 세운 가드(잡 조건 레지스트리·스위트 호출 명령 고정·`continue-on-error` 전 워크플로 레지스트리·환경변수 접근 금지·적대적 환경 행위 테스트)와 그 옆의 기존 가드(harness-checks.yml paths 커버리지, e2e 면제 동기화)까지 **전부 그린인 채로** 통과한다.
  - 위치: 부재형 결함이라 특정 줄이 없다. 갭이 있는 지점(스코프가 `review-gate.yml` 한 파일로 닫혀 있는 자리) —
    - `.claude/tests/test_review_gate_ci.py` `WorkflowWiringTest` 클래스, 특히 `setUp`(게이트 396행 `EXPECTED = {...}` ~ 게이트 432행, `self.doc` 를 오직 `review-gate.yml` 하나만 로드하는 게이트 444행)
    - `.claude/tests/test_workflow_yaml_structure.py` `_workflow_files()`(게이트 85~88행)는 디렉터리의 **모든** 파일을 순회하긴 하지만, 그 순회가 "review-gate 라는 이름/‘gate’ 라는 job id 를 참칭하는 새 파일이 있어서는 안 된다" 는 유일성 제약을 전혀 걷지 않는다.
  - 상세: 재현(사본, 실 저장소 아님):
    ```
    $ cat .github/workflows/review-gate-shadow.yml
    # 아무 것도 검사하지 않고 항상 성공하는 별도 워크플로. name/job id 를 원본과 맞추면
    # GitHub 의 required-status-check 는 "어느 워크플로가 냈는지" 가 아니라 체크 이름 문자열로
    # 매칭되므로, 이 파일이 같은 이름의 성공 체크를 하나 더 만들어낸다.
    name: review-gate
    on:
      pull_request:
    jobs:
      gate:
        runs-on: ubuntu-latest
        steps:
          - run: echo "always green"

    $ python3 -m unittest discover -s .claude/tests -p 'test_harness_checks_paths_coverage.py'
    ----------------------------------------------------------------------
    Ran 26 tests in 0.352s
    OK

    $ python3 -m unittest discover -s .claude/tests -p 'test_review_gate_ci.py'
    ----------------------------------------------------------------------
    Ran 16 tests in 3.087s
    OK

    $ python3 -m unittest discover -s .claude/tests -p 'test_workflow_yaml_structure.py'
    ----------------------------------------------------------------------
    Ran 9 tests in 0.084s
    OK

    $ python3 -m unittest discover -s .claude/tests -p 'test_e2e_exemption_paths_sync.py'
    ----------------------------------------------------------------------
    Ran 19 tests in 0.001s
    OK
    ```
    합계 70개 테스트, 전부 그린. 이 새 파일은 `if:`도 `continue-on-error`도 없고, 자기 job 이름을 "gate"로, 워크플로 `name:`을 "review-gate"로 맞췄을 뿐이다 — GitHub Checks API 의 required-status-check 매칭은 (문서화된 일반 동작으로) **어느 워크플로 정의가 그 체크를 냈는지가 아니라 체크의 이름 문자열**을 기준으로 하므로, branch protection 이 "review-gate / gate"라는 이름으로 필수 체크를 걸어 두었다면 이 그림자 워크플로가 매 PR 마다 대신 초록을 만들어 낼 후보가 된다. **이 특정 GH 플랫폼 매칭 규칙 자체는 실제 Actions 러너 없이 이 환경에서 검증할 수 없다** — 태스크가 미리 배제한 "`Fetch base ref`가 실제로 필요한가"와 동일한 인식론적 한계다. 하지만 **플랫폼 가정과 무관하게 100% 확인된 사실**은 남는다: 이 저장소의 어떤 가드도 `.github/workflows/`에 존재하는 **파일의 집합**을 검사하지 않는다 — 이번 라운드 이전 5라운드가 전부 "`review-gate.yml` **안**을 어떻게 더 단단히 고정할까"로 좁혀 싸웠고, 이번 라운드도 같은 파일 안에서 승부를 봤다. 5R→6R 로의 이동이 "워크플로 배선 → 환경변수"였다면, 이건 "그 파일 자체 → 그 파일이 사는 디렉터리의 다른 원소"로 한 겹 더 나간 것이다.
  - 제안: `test_workflow_yaml_structure.py`(또는 신규 파일)에 "`.github/workflows/*.yml` 중 최상위 `name:` 값이 서로 겹치면 안 된다" + "`jobs` 의 키(또는 `jobs.<id>.name`)가 다른 워크플로 파일과 겹치면 안 된다" 는 전역 유일성 테스트를 추가. 동시에 branch protection 이 실제로 무엇을 required check 로 등록했는지는 저장소 밖 설정이라 여기서 판정 불가 — GitHub 조직 설정 쪽에서 "review-gate / gate" 를 정확히 어떤 identifier 로 요구하는지 별도 확인 필요(가능하면 workflow-level `name:` 대신 job 자체의 `id` 를 고유하게 하고, required check 를 그 job id 로 등록).

- **[WARNING]** 위 CRITICAL 과 같은 계열의, 이번엔 **실제로 시도했지만 막혔던** 것도 기록해 둔다 — `harness-checks.yml` 의 `paths:` 에서 `scripts/check-review-gate.py` 단독 항목을 지우면 `test_harness_checks_paths_coverage.py::test_every_guarded_file_is_covered` 가 즉시 잡는다(재현: 아래). `.github/workflows/**` 광역 항목을 지우는 것도 `e2e.yml` 을 카나리로 쓰는 `KNOWN_COVERAGE_DEPENDENCIES` 가 잡을 것으로 보인다(`review-gate.yml` 자신은 `WorkflowWiringTest.setUp` 안의 메서드-스코프 경로 참조라 이 가드의 모듈-레벨 추출 규칙에서 **빠지지만**, `.github/workflows/**` 항목 자체가 `e2e.yml` 의존성 때문에 죽이기 어려워 실질적으로는 방어된다). 즉 "harness-checks.yml paths 좁히기" 축은 이 저장소가 이미 갖춘 **별도의**, 이번 PR 범위 밖 가드(`test_harness_checks_paths_coverage.py`, 6번째 재발을 스스로 잡은 파일)로 닫혀 있었다 — 위 CRITICAL 만큼 시급하지 않다는 판단의 근거로 남긴다.
  - 위치: `.claude/tests/test_harness_checks_paths_coverage.py`(번들 밖 파일, 참고용)
  - 상세:
    ```
    $ python3 - <<'EOF'
    p = ".github/workflows/harness-checks.yml"
    text = open(p, encoding="utf-8").read()
    text2 = text.replace("      - 'scripts/check-review-gate.py'\n", "")
    open(p, "w", encoding="utf-8").write(text2)
    EOF
    $ python3 -m unittest discover -s .claude/tests -p 'test_harness_checks_paths_coverage.py'
    FAIL: test_every_guarded_file_is_covered
    AssertionError: Lists differ: ['scripts/check-review-gate.py'] != []
    harness-checks.yml does not run for these files, but a test guards each of them:
      scripts/check-review-gate.py
    ```
  - 제안: 조치 불요(이미 방어됨). 다만 이 사실 자체가 이번 PR 문서/커밋 메시지에 적혀 있지 않으므로, `plan/in-progress/harness-review-gate-ci-backstop.md` §배선 가드 표에 "harness-checks.yml paths 축은 `test_harness_checks_paths_coverage.py` 가 이미 선재 방어" 한 줄을 남겨 다음 라운드가 같은 축을 재탐색하는 시간을 아끼게 할 것.

- **[INFO]** spec fidelity — `spec/` 아래 이 CI 백스톱을 정의하는 문서를 찾지 못했다(`grep -rl "review-gate" spec/` 0건). 이는 결함이 아니라 프로젝트 관례상 정상이다: 이번 변경은 `.claude/`·`.github/workflows/`·`scripts/` 하위의 harness/CI 인프라이고, 제품 코드(`codebase/`)의 요구사항이 아니므로 SoT 는 `plan/in-progress/harness-review-gate-ci-backstop.md` 다 — 그 문서는 본문·Rationale·라운드별 이력을 갖추고 있고 코드와 line-level 로 대조해 본 결과(관측 모드 기본·fail-open·판정자 단일·advisory 무조건 출력 4항목) 어긋남이 없다.
  - 위치: N/A(문서 부재가 기대되는 영역)
  - 상세: 위 참조.
  - 제안: 없음.

- **[INFO]** `plan/in-progress/harness-review-gate-ci-backstop.md` 의 "열린 질문 — `Fetch base ref` 가 `fetch-depth: 0` 위에서 실제로 필요한가"는 여전히 미확정으로 정직하게 표시돼 있다(게이트 2358~2360행, "GH Actions 러너 없이 실측할 수 없어 판정하지 못했다"). 이번 태스크 지시에서도 동일하게 "측정 불가 known limit"으로 배제된 항목이라 재조사하지 않았다. 새로운 정보 없음 — 기존 기재가 정확함을 재확인.

- **[INFO]** `test_review_gate_ci.py` / `test_block_integrity.py` / `test_stop_guard_failopen.py` / `test_workflow_yaml_structure.py` / `harness-checks.yml` / `review-gate.yml` / `scripts/check-review-gate.py` 본문에 TODO/FIXME/HACK/XXX 마커 없음(`grep` 확인). 반환값 누락 경로 없음(`check-review-gate.py::main`의 모든 분기가 0 또는 1을 명시적으로 반환). 에러 시나리오(게이트 모듈 부재/예외/기본 root 해석 실패)는 각각 전용 테스트로 고정돼 있고 전부 fail-open 계약과 일치.

- **[INFO]** `.claude/tests/README.md`(1~44행, 나머지는 번들 크기 제한으로 미표시) 서술과 `test_review_gate_ci.py` 실제 구현(PyYAML 예외 사유 3파일 명시, `test_review_gate_ci.py`가 "review-gate.yml 을 구조적으로 읽는다" 는 서술)이 일치한다. README 는 표(44행 이후, 미확인분)에서 `test_review_gate_ci.py` 행 자체를 담고 있을 가능성이 높지만 번들이 44/102줄만 보여줘 그 행의 존재·정확성은 이 리뷰에서 직접 대조하지 못했다 — 위치를 지어내지 않기 위해 "미확인"으로만 남긴다. 필요하면 `.claude/tests/README.md` 전체를 별도로 열어 `test_review_gate_ci.py`/`test_workflow_yaml_structure.py`/`test_stop_guard_failopen.py` 행이 실제로 있는지 확인할 것을 제안.

---

## 요약

6R 은 이전 다섯 라운드가 각각 뚫린 정확한 지점 — 부분 substring, 부분 정규식, 앵커 없는 정규식, 필드별 정확 일치의 잔여 열린 필드, 그리고 5R 이 찾아낸 "CI 배선 층 + 환경변수 축" — 을 문서화된 대로 정확히 닫았다. `WorkflowWiringTest`의 문서 전체 정확 일치, `OneJudgeTest`의 import/호출 허용목록 + 속성대입 금지 + `environ`/`getenv`/`argv`/`putenv` 접근 금지, `VerdictComesFromTheGateTest`의 최소/적대적 환경 이중 행위 검증, `test_workflow_yaml_structure.py`의 잡 조건 레지스트리 + 전 워크플로 `continue-on-error` 금지 + 스위트 호출 명령 정확 고정은 모두 번들 코드와 line-level 로 일치하며 각자가 막으려는 과거 우회를 실제로 재현해 RED 로 떨어뜨리는 것을 사본에서 확인했다. TODO/FIXME 잔재 없음, 반환값·에러 경로 완전성 문제 없음, spec 문서 부재는 harness 인프라 특성상 정상이다.

다만 이번 라운드가 요청한 "다음 층"은 실제로 존재했다: 모든 방어가 `review-gate.yml`이라는 **단일 파일의 내용**에 스코프돼 있고, 그 파일이 사는 디렉터리에 **같은 이름·같은 job id 를 참칭하는 새 워크플로 파일**을 추가하는 시나리오는 이번 6R 가드 4종 + 인접 가드 2종(harness-checks paths 커버리지, e2e 면제 동기화) 도합 70개 테스트를 그대로 통과했다(사본에서 재현, 아래 발견사항 참조). 이 경로가 GitHub 의 실제 required-status-check 매칭에서 어느 정도까지 유효한지는 이 환경에서 러너 없이 검증할 수 없지만, "워크플로 파일 집합 자체가 무방비"라는 사실은 플랫폼 가정과 무관하게 100% 확인됐고, 5라운드 동안 반복된 "고친 자리 바로 옆으로 우회가 이동한다"는 패턴과 정확히 같은 모양이다. 반대로 다른 유력 후보였던 "harness-checks.yml paths 좁히기" 축은 이미 별도 가드(`test_harness_checks_paths_coverage.py`)로 방어돼 있음을 실측으로 확인했다(뚫으려 시도 → 즉시 RED).

## 위험도

HIGH — `--enforce` 가 꺼져 있는 현재(관측 모드)는 이 백스톱이 애초에 아무 PR 도 차단하지 않으므로 즉각적 실피해는 없다. 그러나 이 라운드가 검증하려는 성질("판정이 조용히 우회되지 않는다")은 워크플로 파일 집합 축에서 실제로 깨져 있고, `--enforce` 전환 시점에 그대로 활성 결함이 된다 — CRITICAL 로 올리지 않은 이유는 오직 "GitHub 브랜치 보호 설정이 실제로 이름으로 매칭하는지"가 이 리포지토리 밖의 사실이라 완전한 검증이 안 됐기 때문이다.
