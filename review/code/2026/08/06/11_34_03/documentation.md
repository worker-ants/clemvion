# 문서화(Documentation) 리뷰 — CI 백스톱 라운드 6

## 발견사항

- **[WARNING]** `.claude/tests/README.md` 의 `test_workflow_yaml_structure.py` 카탈로그 행이 이 파일이 실제로 지키는 성질의 절반 이상을 빠뜨리고 있다 (stale).
  - 위치: `.claude/tests/README.md:44`
  - 상세: 이 행은 오직 2026-08-01 사고(중복 매핑 키 · `run`/`uses` 정확히 하나)만 서술한다. 그런데 `.claude/tests/test_workflow_yaml_structure.py` 소스에는 이 서술 이후 최소 세 개의 독립 테스트 클래스/메서드가 더 있다: `test_no_guard_workflow_swallows_its_own_failure`(`continue-on-error` 를 **모든** 워크플로·모든 job/step 에서 금지하고 `_MAY_SWALLOW` 로만 예외를 등재 — 이 자체가 review-gate.yml 4R 잔여 결함이 `harness-checks.yml` 로 옮겨갈 수 있음을 실측 후 만든 것, `.claude/tests/test_workflow_yaml_structure.py:139-182`), `test_job_conditions_are_registered`(`if:` 를 가진 job 을 화이트리스트로 강제, `.claude/tests/test_workflow_yaml_structure.py:193-210`), `test_the_harness_suite_is_invoked_over_every_test_file`(하네스 스위트를 실제로 부르는 명령과 `-p` 패턴이 파일 전부를 덮는지 고정, `.claude/tests/test_workflow_yaml_structure.py:217-232`). `git log --oneline -- .claude/tests/README.md` 로 확인하면 이 행은 5R 커밋(`8ce96e72b`)에서 다른 내용으로 손댔지만, 저 세 테스트를 도입한 `864b71a7b`("게이트 step 의 실패를 삼키는 키 3종 차단")·`14ca978c4`("실패를 삼키는 워크플로 가드를 전 워크플로로 확대")·`eeaf94503`(4R) 세 커밋에서는 이 README 행이 전혀 갱신되지 않았다.
  - 제안: 이 행에 continue-on-error 전역 금지(등재제 예외), job 조건 등재제, 하네스 스위트 invocation 커맨드 고정을 한두 문장으로 추가한다. 이 README 는 "카탈로그" 로서 유지보수자가 전체 소스를 읽지 않고 무엇이 지켜지는지 파악하는 자리인데, 지금은 이 파일이 막는 위험 중 가장 최근에 추가된(그리고 라운드 4R~6R 우회 이력과 직접 연결된) 부분이 안 보인다.

- **[WARNING]** `.claude/tests/README.md` 의 `test_review_gate_ci.py` 행이 `PyYamlPinsAgreeTest` 클래스를 전혀 언급하지 않고, `OneJudgeTest` 잔여 정적 검사의 설명도 실제 코드보다 좁다.
  - 위치: `.claude/tests/README.md:48`
  - 상세: (1) `test_review_gate_ci.py` 에는 `PyYamlPinsAgreeTest`(`.claude/tests/test_review_gate_ci.py:618`) 라는 별도 클래스가 있다 — 세 워크플로에 손으로 적힌 `pyyaml` 버전 pin 이 서로 갈리지 않는지 검사하며, 클래스 자체 docstring 이 "이 pin 쌍은 아직 묶여 있지 않았다" 는 위험을 명시적으로 서술한다. README 행에는 이 클래스에 대한 언급이 한 글자도 없다. (2) README 행은 `OneJudgeTest` 의 잔여 정적 검사를 "a small import/call surface, plus a ban on attribute assignment" 로만 요약하는데, 실제 `test_the_import_and_call_surface_stays_small`(`.claude/tests/test_review_gate_ci.py:265-366`) 은 그 외에도 (a) `getattr` 로 import 된 모듈의 속성을 꺼내는 우회 금지, (b) `environ`/`getenv`/`argv`/`putenv` 속성 **접근** 자체 금지(비-Call 형태라 호출 허용목록을 우회했던 5R 결함을 닫기 위해 추가된 것, 메서드 docstring 이 "5R 리뷰어 셋이 각각 다른 변형으로 실증했다" 라고 직접 서술)까지 정적으로 막는다. README 요약이 이 두 축을 빠뜨려, "정적 검사는 import/call 표면과 대입만 본다" 는 인상을 주는데 실제로는 환경 접근 축도 정적으로 닫혀 있다.
  - 제안: `PyYamlPinsAgreeTest` 한 문장 추가, `OneJudgeTest` 요약에 "getattr 모듈-속성 추출 금지 + `environ`/`getenv`/`argv`/`putenv` 접근 금지" 를 포함한다.

- **[WARNING]** `plan/in-progress/harness-review-gate-ci-backstop.md` 의 §배선 가드 섹션이 실제로 완료된 라운드 수보다 뒤처져 있다 — "네 라운드" 서술이 이미 반증됐다.
  - 위치: `plan/in-progress/harness-review-gate-ci-backstop.md:18` (요약 표: "배선 가드 경화 | **1R~4R 진행 중**"), `plan/in-progress/harness-review-gate-ci-backstop.md:20` (섹션 헤더: "**§배선 가드 — 네 라운드에 걸친 경화 이력.**"), `plan/in-progress/harness-review-gate-ci-backstop.md:32-36` ("4R 에서 결론: … 정적으로 부정을 증명하려는 시도는 4세대에 걸쳐 전부 반증됐다.")
  - 상세: `git log --oneline -- plan/in-progress/harness-review-gate-ci-backstop.md` 로 확인하면 이 파일은 `eeaf94503`(4R) 이후 단 한 번도 커밋되지 않았다. 그런데 저장소에는 이미 `8ce96e72b`("CI 백스톱 5R — 우회가 CI 배선 층과 환경변수 축으로 이동")가 **커밋돼 있고**, 이번 라운드(6R, 본 리뷰의 CONTEXT 가 명시)에서 job 조건 등재제·`continue-on-error` 전역 금지·하네스 스위트 invocation 고정·`environ`/`getenv`/`argv` 접근 금지·적대적 환경 행위 테스트까지 추가됐다. 플랜 문서만 읽는 독자는 "4R 에서 문서 전체 정확 일치로 바꿔서 끝났다" 로 이해하게 되는데, 실제로는 그 방어조차 review-gate.yml **밖으로**(harness-checks.yml 무력화·환경변수 축) 우회당해 5R·6R 이 추가로 필요했다는, 이 티켓의 핵심 교훈이 플랜 문서 자체에는 빠져 있다. 이 저장소가 스스로 반복 지적해 온 "plan 서술이 실제 상태와 어긋나면 다음 라운드 착수자가 이미 막힌 우회를 다시 여는 방향으로 오판할 수 있다" 는 위험과 정확히 같은 모양이다.
  - 제안: §배선 가드 표에 5R(우회: `harness-checks.yml` 무력화 + `os.environ` 비-Call 접근)·6R(현재 라운드: job 조건 등재제, `continue-on-error` 전역 금지, 스위트 invocation 커맨드 고정, `environ`/`getenv`/`argv` 금지, 적대적 환경 행위 테스트) 행을 추가하고, 상단 요약 표의 "1R~4R 진행 중" 을 실제 라운드 수로 갱신한다. 최소한 이번 라운드가 닫히는 시점에는 갱신이 필요하다.

- **[INFO]** `.github/workflows/review-gate.yml` · `.github/workflows/harness-checks.yml` · `scripts/check-review-gate.py` 자체의 인라인 주석/독스트링은 이번 변경분(job 조건 등재제, continue-on-error 전역 금지 등)의 근거를 각 파일에서 충실히 서술하고 있어 별도 지적 없음. `test_review_gate_ci.py`·`test_workflow_yaml_structure.py`·`test_block_integrity.py`·`test_stop_guard_failopen.py` 의 클래스/메서드 독스트링도 각 우회 라운드의 구체적 재현 형태를 코드 옆에 남겨 두어 "왜 이 형태로 검사하는가" 가 소스만 읽어도 복원 가능하다 — 이 리뷰의 주된 지적은 1차 소스(테스트 파일·워크플로·plan)가 아니라 그것들을 요약하는 2차 문서(README 카탈로그, plan 진행 요약)의 drift 다.

- **[INFO]** `CHANGELOG.md` 는 이 저장소에서 `codebase/` 제품 변경에만 쓰이는 관행으로 보인다(하네스 전용 PR 들 — 1R~5R 포함 — 이 전부 `CHANGELOG.md` 를 건드리지 않았다: `git log -- CHANGELOG.md` 대조 결과 harness(#1057 계열) 커밋 어느 것도 이 파일을 수정하지 않음). 따라서 이번 라운드도 CHANGELOG 갱신 불필요 — 관행과 일치.

## 요약

소스 코드(테스트 파일·워크플로 YAML·`check-review-gate.py`) 자체의 문서화 품질은 높다 — 각 우회 라운드가 왜 막혔고 무엇이 남았는지 코드 옆에 상세히 남아 있다. 문제는 그 위 계층인 두 개의 2차 문서다. `.claude/tests/README.md` 의 카탈로그 두 행(`test_workflow_yaml_structure.py`, `test_review_gate_ci.py`)이 실제 소스보다 뒤처져 있고(각각 3개 테스트, 1개 클래스+2개 정적 검사 축 누락), `plan/in-progress/harness-review-gate-ci-backstop.md` 의 §배선 가드 절은 이미 커밋된 5R 과 진행 중인 6R 을 반영하지 못한 채 "4R 에서 결론" 이 최종인 것처럼 읽힌다. `git log` 로 대조하면 세 곳 모두 대응 커밋이 이 문서들을 갱신하지 않은 사실이 확인된다. 기능적 영향은 없지만(테스트는 실제 소스를 검증하므로 안전은 유지된다), 이 티켓 자체가 "우회가 매 라운드 한 겹 밖으로 이동한다" 는 패턴을 주제로 삼고 있는데 그 이력을 추적하는 문서가 정확히 그 드리프트를 겪고 있다는 점은 이 PR 의 취지와 상충한다.

## 위험도

LOW
