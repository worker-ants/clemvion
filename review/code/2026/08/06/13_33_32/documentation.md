# 문서화(Documentation) Review — round 9

범위: `.claude/hooks/_lib/plan_guard.py`, `.claude/hooks/_lib/review_guard.py`,
`.claude/tests/README.md`, `.claude/tests/test_block_integrity.py`,
`.claude/tests/test_plan_guard.py`, `.claude/tests/test_review_gate_ci.py`,
`.claude/tests/test_review_guard_hardening.py`, `.claude/tests/test_stop_guard_failopen.py`,
`.claude/tests/test_workflow_yaml_structure.py`, `.github/workflows/harness-checks.yml`,
`.github/workflows/review-gate.yml`, `plan/in-progress/harness-review-gate-ci-backstop.md`,
`scripts/check-review-gate.py`. 큰 파일 3개(`review_guard.py`, `README.md`,
`test_block_integrity.py`)와 `test_review_gate_ci.py`(823줄 중 45줄만 프롬프트에 실림)는
`Read` 로 원본을 직접 열어 확인했다.

이 트리 전체는 이미 극단적으로 자기-문서화가 강한 코드베이스다(모든 헬퍼에 "왜"를 설명하는
docstring, 8라운드째 이어지는 plan 티켓의 라운드별 이력 테이블). 그래서 발견사항은 "문서가
없다"류가 아니라, 그 높은 기준 자체가 이번 라운드(8R, 커밋 `88ce9994d`)에서 일부 깨진
지점들이다 — 실제 git 이력(`git show 88ce9994d`)으로 하나하나 대조해 확인했다.

## 발견사항

- **[WARNING]** 정정 각주가 정정 대상 문장 자체를 고치지 않고 그 옆에 남겨, 존재하지 않는
  함수명이 여전히 본문에 살아있다.
  - 위치: `.claude/tests/test_review_guard_hardening.py:663-666`
    (`UnstagedModificationKeepsItsPathTest` 클래스 docstring)
  - 상세: 8R 커밋(`88ce9994d`, 커밋 메시지 "[W6·W7] 내가 이번 라운드에 쓴 문서 2건이 존재하지
    않는 함수명을 인용했다")이 이 docstring 에 각주를 추가했다. 그런데 그 각주는 원래 문장을
    고치지 않고 **뒤에 이어 붙이기만** 했다:
    ```
    663|    헬퍼가 아니라 실제 저장소를 만들어 `_changed_code_files` 까지 구동한다 —
    664|    `_porcelain_path` 만 직접 부르면 `.strip()` 이 어디서 일어나는지를 못 본다.
    665|    (초판 docstring 은 존재하지 않는 `_changed_code_files` 를 인용했다 — 실제로 구동하는
    666|    함수는 `_uncommitted_code_changes` 와 `_dirty_set` 이다.)
    ```
    663행은 지금도 `_changed_code_files` 를 실제로 구동하는 함수라고 **현재형으로 서술**하고,
    바로 다음 문장(665-666행)이 "그 이름은 틀렸다" 고 말한다. 즉 문서가 자기모순 상태로
    커밋됐다 — 정정이 "무엇이 틀렸는지" 만 기록했지 "무엇이 맞는지 로 문장 자체를 바꾸는" 일을
    하지 않았다. 이 저장소가 반복해서 "손-동기 쌍 drift"·"오래된 주석" 을 스스로 찾아 고치는
    문화라는 점을 고려하면 눈에 띄는 예외다. `grep -n '_changed_code_files' .claude/tests/test_review_guard_hardening.py`
    로 재현: 663·665행 2건이 여전히 남아 있다(실제 함수는 665-666행이 맞다고 말하는
    `_uncommitted_code_changes`/`_dirty_set`).
  - 제안: 663-664행을 "실제 저장소를 만들어 `_uncommitted_code_changes`/`_dirty_set` 까지
    구동한다 — `_porcelain_path` 만 직접 부르면 `.strip()` 이 어디서 일어나는지를 못 본다." 로
    직접 고치고, 665-666행의 각주(이제 불필요)는 제거하거나 "왜 실제 함수 이름으로 다시 썼는지"
    한 줄로 축약한다.

- **[WARNING]** README 테스트 카탈로그가 같은 라운드에 추가된 새 테스트 클래스를 반영하지
  않았다 — 자매 파일의 대응 행은 갱신됐는데 이 행만 빠졌다.
  - 위치: `.claude/tests/README.md:62` (`test_plan_guard.py` 행)
  - 상세: 8R 커밋은 `test_plan_guard.py` 에 `PorcelainPathSurvivesOnARealRepoTest` 클래스
    전체(실제 임시 git 저장소를 구동해 `_run_git`/`_porcelain_path`/`_uncommitted_changes`
    를 처음으로 실행하는, 이 라운드의 헤드라인 CRITICAL[C2] 를 닫는 테스트)를 신설했다
    (`git show 88ce9994d -- .claude/tests/test_plan_guard.py` 로 확인, +63줄). 그런데 같은
    커밋의 README 갱신은 커밋 메시지 자신이 밝히듯 "[W5] README 카탈로그 2행을 5R~8R 누적
    불변식으로 재작성" — `test_workflow_yaml_structure.py` 행과 `test_review_gate_ci.py` 행,
    딱 2행만 다시 썼다(`git show 88ce9994d -- .claude/tests/README.md`). `test_plan_guard.py`
    행(62행)은 이번 라운드 이전과 글자 하나 다르지 않다: "which in-progress plan a branch is
    linked to, and whether that plan was updated (or moved to `plan/complete/`) before the
    push" 뿐이고, 새 클래스도, "실제 저장소로 구동" 이라는 방법론도, 그것이 고치는
    C2(선행-공백 거짓-차단) 버그도 전혀 언급이 없다. 대조로 `test_review_guard_hardening.py`
    행(57행)은 정확히 이 방법론("The rebase case uses a **real temp git repo** — see the
    convention note below")을 이미 명시하고 있어, 두 자매 훅의 카탈로그 서술이 서로 다른
    수준으로 남았다. `test_tests_readme_catalog.py` 는 행의 **존재**와 **파일 실재**만 보고
    내용 정확성은 검사하지 않으므로(README 자신의 "Conventions" 절 서술과 일치), 이 gap 은
    어떤 가드로도 안 잡힌다.
  - 제안: 62행에 새 클래스의 존재와 그것이 실제 git 저장소를 구동해서 발견한 결함(7R 이 고친
    `review_guard._run_git` 의 `.strip()` 결함이 자매 훅 `plan_guard.py` 에는 안 전파돼
    그대로 살아있었다는 사실)을 한 문장으로 추가한다 — `test_review_guard_hardening.py` 행이
    쓰는 것과 같은 수준.

- **[WARNING]** 진행 중인 plan 문서의 라운드 이력이 실제 라운드 수보다 뒤처져 있고, 헤드라인
  결론이 문서에 반영되지 않았다.
  - 위치: `plan/in-progress/harness-review-gate-ci-backstop.md:18` (요약 배너),
    `:24-34`(라운드 이력 표, 7R 에서 끝남), `:60`(후속 항목 개수 표기)
  - 상세: 세 가지 독립된 staleness 가 겹쳐 있다.
    1. **18행** "배선 가드 경화 | **1R~6R 진행 중**" — 이 배너는 파일 자신의 본문(34행, 7R)과
       이미 어긋나 있었고, 8R 커밋 이후로는 두 라운드나 더 뒤처졌다. `git log --oneline`
       상으로 이 티켓 관련 커밋은 이미 8R(`88ce9994d`)까지 진행됐다.
    2. **라운드 이력 표(24-34행)** 는 1R부터 7R까지만 행이 있다. 이 표의 존재 이유(20-22행)는
       "매 라운드 뚫렸다" 는 사실을 라운드별로 고정하는 것인데, 8R 은 성격이 달랐다(우회 0건 +
       살아있는 결함 1건[C2, plan_guard.py 의 `.strip()` 자매 결함] + 설계 결정 1건[C1, 위조
       가능한 리뷰 산출물]) — 정확히 이 표가 기록해 온 것과 같은 종류의 사실인데도 행이
       없다. C1 은 234행 이하 별도 절(`⛔ --enforce 전환의 선행 조건`)에 기록됐지만, **C2(plan_guard.py
       자매 결함)는 이 plan 문서 전체에 단 한 번도 등장하지 않는다** —
       `grep -n "plan_guard" plan/in-progress/harness-review-gate-ci-backstop.md` 로 확인,
       매치는 관련 없는 106행 한 줄뿐. 8R 커밋 메시지의 결론 문장("가드 경화 경주는 여기서
       끝났다고 본다")도 plan 문서 어디에도 없다 — CLAUDE.md 의 "진행 중 작업 →
       `plan/in-progress/<name>.md`" 원칙대로라면 이런 라운드-종결급 결론이야말로 이 문서에
       남아야 할 정보인데, 지금은 git 커밋 메시지에만 존재한다.
    3. **60행** "신규 후속 (defer) — 아래 11건 + 기본 브랜치 해석 중복 1건" — 실제 번호 매긴
       항목은 1번부터 13번까지 있다(`grep -nE '^> [0-9]+\.' plan/in-progress/harness-review-gate-ci-backstop.md`
       로 확인). 8R 이 12번 항목(C-quoting 처분)을 갱신하면서 기존 12번(fresh-interpreter
       보일러플레이트)을 13번으로 밀었지만, 60행의 "11건" 표기는 그보다도 전부터(적어도
       12번이 신설된 시점부터) 이미 stale 했다 — 8R 이 건드린 자리 바로 앞인데 정정되지
       않았다.
  - 제안: 18행을 "1R~8R 완료, 우회 0 도달" 정도로 갱신하고, 24-34행 표에 8R 행(우회 대신
    "자매 훅 drift(C2) + 설계 결정(C1)")을 추가한다. C2 는 이 표 또는 그 아래 서술 어딘가에
    최소 한 줄로 등재한다. 60행의 "11건" 은 실제 개수(13)로 고친다.

## 요약

이 라운드(8R, 커밋 `88ce9994d`)는 실제 CRITICAL 버그(자매 훅 `plan_guard.py` 의 거짓-차단)를
잘 고쳤고 그 과정에서 매우 상세한 재현 절차와 근거를 코드 docstring/커밋 메시지에 남겼지만,
그 노력이 문서 표면 세 곳에서 완전히 반영되지 못했다: (1) 자기모순 상태로 남은 정정 각주
(`test_review_guard_hardening.py`), (2) 같은 커밋에서 신설한 테스트 클래스를 반영하지 않은
README 카탈로그 행, (3) 실제 라운드 수·핵심 결론·항목 개수 세 축 모두에서 뒤처진 plan 추적
문서. 셋 다 동작에는 영향이 없고(코드/테스트 자체는 정확하다) 가드로도 잡히지 않는 순수 문서
정확성 문제이며, 다음에 이 파일들을 여는 사람(다음 라운드 리뷰어 포함)을 오도할 수 있는
수준이라 WARNING 으로 판단했다. CRITICAL 은 없다.

## 위험도

LOW
