# 성능(Performance) Review

## 검증 방법 (측정 근거)

지시에 따라 "판독"이 아니라 "실측"을 우선했다. 실제로 수행한 것:

- `python3 -m unittest discover -s .claude/tests -p 'test_review_gate_ci.py'` 를 직접 실행 —
  13개 테스트 **1.978초** (subprocess 기동 비용이 지배적, `setUp` 의 디렉터리 복사 비용은
  하위 항목). vacuous 여부를 판정한 것이 아니라 실제 그린 상태의 실행 시간을 쟀다.
- `du -sh` / `find | wc -l` 로 `.claude/hooks`(28파일, 392K)와 `.claude/_shared`(8파일, 72K)
  크기를 실측 — `setUp` 이 매 테스트마다 복사하는 대상의 실제 규모.
- `grep -rn "fetch-depth"` 로 저장소 전체 workflow 를 스캔해 `review-gate.yml` 의
  `fetch-depth: 0` 이 `migration-check.yml`/`migration-recheck-on-main.yml` 에 이미 있는
  패턴인지 대조 — 신규 비용인지 기존 관행 재사용인지 구분.
- `migration-check.yml` 의 동일 패턴(체크아웃 후 별도 `Fetch base ref` 스텝) 주석을 직접
  읽어 "이미 unshallow 상태라 비용 미미" 라는 기존 근거를 확인.
- `grep -n "import re\|re\.compile\|re\.match\|re\.search\|re\.sub"` 로 이번 diff 4개 파일
  전체를 스캔 — 실제 regex 도입이 있는지 확인(결과: 없음. `test_review_gate_ci.py:209` 의
  `"re.compile"` 은 금지어 리스트의 **문자열 리터럴**이지 호출이 아님).
  `scripts/check-review-gate.py` 의 grep 매치는 `import review_guard` 문자열 안의 부분
  일치(`re`)일 뿐 실제 `re` 모듈과 무관함을 직접 읽어 확인.
- `git diff origin/main...HEAD --stat` / 파일별 `git diff` 로 이번 커밋(`f2896147b`)이 실제로
  건드린 라인만 분리 — `harness-checks.yml` 은 `paths:` 트리거 3줄 추가뿐이고, PyYAML
  설치 스텝·`block_integrity.py` 하향 감지 등은 **이전 커밋(`06c2651c9`)에서 이미 origin/main
  에 들어간 내용**임을 확인했다. `plan/in-progress/harness-review-gate-ci-backstop.md` 의
  결함 백로그(항목 1~12, `_rank_plan_text` 이중 read 등)도 마찬가지로 이전 라운드 기록이며
  이번 diff 가 건드리는 코드(`code_review_orchestrator.py` 등)가 아니다 — 스코프 밖으로
  제외했다.
- `test_it_is_still_observation_only`(gate `.claude/tests/test_review_gate_ci.py:262-265`)가
  실제로 실패할 수 있는지 검증: `review-gate.yml` 안에서 `--enforce` 문자열이 등장하는
  두 곳(gate 14, 18행)이 전부 `#` 로 시작하는 순수 주석 줄임을 `grep -n -- "--enforce"` 로
  확인했다. 이 테스트의 주석-제거 로직(`ln.lstrip().startswith("#")`)은 줄 전체가 주석일
  때만 걸러내므로, 만약 `run:` 라인에 실제로 `--enforce` 가 추가되면(주석이 아님) 그 줄은
  `self.code` 에 남아 `assertNotIn` 이 정확히 실패한다 — vacuous 하지 않음을 확인.

## 발견사항

- **[INFO]** 판정 로직 단일화 — 중복 연산·drift 위험을 설계로 차단 (문제 아님, 확인 사항)
  - 위치: `scripts/check-review-gate.py:69`(`import review_guard`), `:90`(`decision = evaluate(root)`)
  - 상세: 스크립트는 자체 트리 순회·정규식 생성·git 호출 없이 로컬 훅과 **동일한**
    `evaluate_review()` 를 1회 호출한다. "같은 판정을 두 곳에서 따로 계산"하는 것은 곧
    로컬/CI 값이 갈릴 수 있는 이중 계산 구조인데, 그 경로 자체가 없다. `os.walk`/`glob.*`/
    `re.compile`/`subprocess.*`/`open` 미호출은 `.claude/tests/test_review_gate_ci.py:189-224`
    (`OneJudgeTest`, AST 기반)가 고정하고, 실제로 `re`/`glob`/`subprocess` 모듈 자체가
    import 되지 않음을 직접 grep 으로 재확인했다(위 검증 항목 참고). 즉 이번 diff 에는
    reviewer 가 최근 다른 브랜치에서 지적했던 "이차(quadratic) regex" 류 위험이 애초에
    도입되지 않았다.
  - 제안: 없음 — 현행 유지.

- **[INFO]** `_load_gate()` 의 지연 import — 실패 시 비용 없이 fail-open
  - 위치: `scripts/check-review-gate.py:61-74`
  - 상세: `review_guard` import 는 `argparse` 로 인자 파싱이 끝난 뒤 `_load_gate()` 내부에서만
    일어나고, 실패 시 `None` 을 반환해 `main()` 이 즉시 `return 0` 한다(77-87행). 필요 시점까지
    무거운 import 를 미루는 지연 로딩이 이미 적용돼 있다.
  - 제안: 없음.

- **[INFO]** 신규 테스트 `ReviewGateCliTest.setUp` 의 반복 `shutil.copytree` — 실측상 현재는 무해
  - 위치: `.claude/tests/test_review_gate_ci.py:40-49`(`setUp`, 복사는 45-49행)
  - 상세: `ReviewGateCliTest` 의 테스트 메서드 7개 각각이 `setUp` 에서 `.claude/hooks`(28파일·
    392K)와 `.claude/_shared`(8파일·72K)를 새 임시 디렉터리로 복사한다(스위트 전체 최대
    14회). 실측(`python3 -m unittest discover -s .claude/tests -p 'test_review_gate_ci.py'`):
    13개 테스트 전체 1.978초로, subprocess(python3 인터프리터 기동 + git 커맨드) 비용이
    지배적이고 트리 복사는 현재 크기에서 병목이 아니다. 심볼릭 링크 대신 실제 복사를 쓰는
    이유는 주석(43-44행: "`_load_gate` 가 계산하는 경로가 실제 CI 체크아웃과 같은 모양이
    되어야 함")에 근거가 있고, 일부 테스트가 사본 파일을 삭제/치환하므로(`test_a_missing_gate_module_does_not_fail_ci`,
    `test_a_gate_that_raises_does_not_fail_ci`) 테스트 간 격리를 위해서도 개별 사본이
    구조적으로 필요하다 — 현재 설계가 정당하다.
  - 제안: 지금은 조치 불필요. 다만 `.claude/hooks`/`.claude/_shared` 가 향후 크게 늘어나면
    (수 MB 대) 스위트 실행 시간이 테스트 수에 선형 비례해 증가하므로, 그 시점엔
    `setUpClass` 1회 공유 복사 + 테스트별 필요한 파일만 override 하는 구조로의 전환을
    고려할 것.

- **[INFO]** `review-gate.yml` 의 `fetch-depth: 0` + 별도 `Fetch base ref` 스텝 — 신규 비용
  아니라 기존 관행 재사용
  - 위치: `.github/workflows/review-gate.yml:50`(`fetch-depth: 0`), `:56-58`(`Fetch base ref`)
  - 상세: 동일 패턴이 `.github/workflows/migration-check.yml:33-51` 에 이미 있고, 그 주석이
    "actions/checkout 의 fetch-depth: 0 이 전체 history 를 가져오지만 PR 컨텍스트에서
    `origin/<base>` ref 가 항상 set 되어 있지 않을 수 있어 명시적으로 fetch. … 이미
    unshallow 상태라 비용 미미" 라고 명시한다. `timeout-minutes: 5` 도 `harness-checks.yml`/
    `migration-check.yml` 과 동일 값으로, 이 저장소가 이미 검증한 패턴을 그대로 재사용한
    것이지 이번 PR 이 새로 발생시킨 CI 비용이 아니다.
  - 제안: 없음.

- **[INFO]** `harness-checks.yml` 의 이번 diff 분(`paths:` 트리거 1개 추가)은 런타임 성능과
  무관 — 확인만
  - 위치: `.github/workflows/harness-checks.yml:58-60`(`scripts/check-review-gate.py` 항목 추가)
  - 상세: `git diff origin/main...HEAD --stat` 로 확인한 결과 이 파일에서 이번 커밋이 바꾼
    부분은 CI 트리거 경로 3줄뿐이다. 같은 파일에 있는 PyYAML 설치 스텝(79-85행)은 이전
    커밋(`06c2651c9`)에서 이미 origin/main 에 들어간 것으로, 이번 diff 가 새로 추가한
    네트워크/설치 비용이 아니다.
  - 제안: 없음.

## 요약

이번 diff 는 리뷰 커버리지 게이트의 **CI 트리거 배선**(신규 워크플로 `review-gate.yml` +
스크립트 `check-review-gate.py` + 테스트 `test_review_gate_ci.py` + 문서/plan 갱신)이며,
판정 로직 자체는 기존 `review_guard.evaluate_review()`(이번 diff 밖, 불변)에 전량 위임한다.
핵심 스크립트(`check-review-gate.py`)는 인자 파싱 → 지연 import → 게이트 1회 호출 →
결과 출력이 전부인 O(1) 진입점이고, 반복문 내 DB/API 호출, 문자열 누적, 부적절한 자료구조,
캐시 무효화 문제 등 통상적인 성능 안티패턴이 들어설 자리가 구조적으로 없다(자체 판정
로직이 없다는 성질 자체가 `OneJudgeTest` 로 코드 레벨에서 강제된다). 신규 테스트 스위트의
반복적 디렉터리 복사·서브프로세스 기동은 실측(13 tests / 1.978s)상 현재 무해하며,
`fetch-depth: 0` + 별도 base-ref fetch 는 이 저장소가 `migration-check.yml` 에서 이미
검증해 둔 저비용 패턴의 재사용이다. CRITICAL/WARNING 급 성능 결함은 발견되지 않았다.

## 위험도

NONE
