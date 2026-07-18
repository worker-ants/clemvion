# 문서화(Documentation) 리뷰 — bootstrap mermaid-lint install guard (plan §A)

> 컨텍스트: 리뷰 대상 7개 파일은 `plan/in-progress/harness-guard-followups.md` §A 의 최종 상태이며,
> 이미 두 차례 리뷰 라운드(`review/code/2026/07/17/20_06_45` 자기리뷰, `review/code/2026/07/18/00_59_56`
> 14-리뷰어 전수)를 거쳐 그때 지적된 Critical/Warning(W1~W13)이 코드·테스트·주석으로 전부 반영됐다.
> 이번은 "수정 후 fresh 재검증" 라운드다 — 아래는 그 전제 위에서 수행한 **독립** 재검토이며, 이미 알려져
> 의도적으로 미조치된 항목은 새로 escalate 하지 않고 재확인만 했다.

## 발견사항

- **[WARNING]** `test_concurrent_sessions_install_at_most_once`의 메서드명과 `README.md` 서술이 이미
  강화된 불변식과 자기모순
  - 위치: `.claude/tests/test_bootstrap_mermaid_install.py:190`(메서드명), `:196`(docstring),
    `:211`(assertion) / `.claude/tests/README.md:34`
  - 상세: 이 테스트는 00_59_56 라운드 W9 로 `assertLessEqual(npm_calls, 1)` → `assertEqual(npm_calls, 1)`
    (정확히 1회 설치 완료)로 강화됐고, 테스트 자신의 docstring 도 "W9: asserts EXACTLY one install, not
    merely 'at most one'" 라고 명시적으로 대조까지 한다. 그런데 메서드 이름은 여전히
    `..._at_most_once`(≤1 — "5개 세션 전원이 설치를 스킵"해 설치가 아예 안 일어나도 참이 되는, 이 PR
    전체가 없애려던 바로 그 무신호 실패도 통과시키는 예전의 약한 의미)이고, `.claude/tests/README.md:34`
    의 서술("5 concurrent sessions → at most one install")도 같은 옛 표현을 그대로 쓴다(git log 확인:
    이 README 행은 `d31f99a11`에서 작성된 후 이후 W9 강화 시점까지 한 번도 갱신되지 않았다). 이 저장소가
    이미 한 번 겪은 "코드/docstring 은 고치고 이름/요약은 안 고쳐 자기모순이 남는" 패턴(W10의
    "rmdir's" 사례와 같은 계열)이 이번엔 식별자·README 축에서 재발한 사례다.
  - 제안: 메서드명을 `test_concurrent_sessions_install_exactly_once` 류로 바꾸고, README.md:34 의
    "at most one install"을 "exactly one install (and it must complete)"로 정정.

- **[WARNING]** `.githooks/pre-commit` 상단 요약 주석이 이번 diff 가 신설한 세 번째 공유 SoT 를 나열하지 않음
  - 위치: `.githooks/pre-commit:10-13`(헤더) vs `:49`(guard 2 인라인 주석, 이번 diff 로 추가)
  - 상세: 헤더는 "Both guards delegate to shared logic ... branch policy in
    `.claude/hooks/_lib/branch_guard.py`, mermaid parsing in
    `.claude/tools/mermaid-lint/lint-mermaid.mjs`"로 공유 모듈을 정확히 2개만 나열한다. 그러나 이번
    diff 로 guard 2(mermaid 검사)의 판정 기준이 세 번째 공유 모듈
    `.claude/hooks/_lib/mermaid_lint_ready.py`(신설, readiness SoT)로 바뀌었다 — 바로 아래 인라인
    주석(:49)은 이를 정확히 설명하지만, 파일 맨 위 요약만 훑는 신규 기여자는 이 새 의존성의 존재를
    놓칠 수 있다. `bootstrap-session.sh`의 "Three responsibilities"→"Four responsibilities" 누락이
    이미 20_06_45 라운드에서 지적·수정된 것과 정확히 같은 클래스의 문제가 형제 파일(pre-commit)에서
    반복된 사례.
  - 제안: 헤더에 "readiness in `.claude/hooks/_lib/mermaid_lint_ready.py`" 한 구절 추가.

- **[WARNING]** `bootstrap-session.sh` 내부의 "known limitation" 인용 표기가 비일관 — 라운드명 누락 1건
  - 위치: `.claude/tools/bootstrap-session.sh:114`("(W1)") vs `:98`("W12, 00_59_56 review"),
    `:132`("W2, ... 00_59_56 review, not fixed here")
  - 상세: 같은 파일 안에서 두 "Known limitation" 인용은 "W번호, 00_59_56 review" 형식으로 출처 라운드를
    명시하는데, 세 번째 인용(:114, grace-truncation 버그 설명)만 라운드명 없이 "(W1)"이라고만 쓴다.
    이 diff 이력에는 서로 다른 두 리뷰 라운드(20_06_45, 00_59_56)가 각자 독립적으로 1부터 번호를
    매겼고("WARNING #N" vs "WN"), 실측 결과 두 라운드 모두 자기 번호 "6"을 서로 다른 발견에 붙였다
    (20_06_45 의 "WARNING #6"=테스트 env 구성 중복 제거, 00_59_56 의 "W6"=bootstrap 책임#2 추출 제안,
    현재 plan §G) — 번호만으로는 라운드를 특정할 수 없음이 실제로 확인된다. `:114`의 "(W1)"도 같은
    위험에 노출된다(00_59_56 의 W1 이 맞지만 그렇게 표기돼 있지 않다).
  - 제안: `:114`에도 ", 00_59_56 review"를 붙여 같은 파일의 나머지 두 인용과 표기를 통일.

- **[INFO]** `.claude/tests/README.md`(리뷰 대상 파일셋 밖)의 `test_mermaid_lint_ready.py` 행이 이후
  추가된 실행 기반 테스트 클래스를 반영하지 않음
  - 위치: `.claude/tests/README.md:35`
  - 상세: 이 행은 `d31f99a11`에서 작성돼 `IsReadyTest`/`ConsumerBindingTest`(소스 텍스트 검사)만
    서술한다. 이후 `e8a056fec`(00_59_56 W8 조치)가 실행 기반 회귀 테스트 두 클래스
    (`PostToolUseExecutionTest`, `PreCommitExecutionTest` — "소스에 `is_ready(tool_dir)` 문자열이
    있다"는 `assertIn`이 `if not is_ready` → `if is_ready` 같은 불리언 반전 뮤턴트는 못 잡는다는 것을
    실제로 재현해 잡는 클래스들)를 추가했지만 README 행은 갱신되지 않았다. 차단 사유 아님(README 표
    자체가 CI 강제 대상이 아니고 이미 여러 파일이 이 표 밖에 있다 — 20_06_45 라운드 INFO#2 기존 관찰과
    동일 계열).
  - 제안: 후속 편집 시 "실행 기반 회귀(스텁 node 로 PostToolUse/pre-commit 을 서브프로세스로 구동해
    가짜 통과를 재현해 잡는다)" 한 구절 추가.

- **[INFO]** 리뷰 라운드 번호 인용 관례가 문서화되지 않아 파일 간 혼동 소지
  - 위치: `.claude/tests/test_bootstrap_mermaid_install.py:100,193,215,268,312`,
    `.claude/tests/test_mermaid_lint_ready.py:37,77,131,203`
  - 상세: 실측 결과 이 diff 전체는 "WARNING #N"(spelled-out) = 20_06_45 라운드, 맨숫자 "WN" =
    00_59_56 라운드라는 규칙을 일관되게 따르지만, 이 규칙 자체는 어디에도 명시돼 있지 않다(위 항목처럼
    두 라운드가 같은 숫자를 다른 발견에 독자적으로 붙인다). 앞으로 세 번째 라운드가 이 스타일을
    무의식중에 깨거나(예: 또 "WARNING #6"을 재사용) 새 기여자가 세 소스를 못 가르는 위험이 있다.
  - 제안: 우선순위 낮음. 재작업 시 라운드명을 병기하거나(위 항목처럼), 최소한 review 세션 경로 하나를
    모듈 docstring 등에 SoT 로 남기는 것을 고려.

- **[INFO]** (00_59_56 라운드에서 이미 INFO 로 지적·의도적으로 미조치 — 재확인만) 부분 설치 케이스가
  `lint_mermaid_posttooluse.py`의 모듈 docstring·사용자 노출 메시지에는 아직 반영 안 됨
  - 위치: `.claude/hooks/lint_mermaid_posttooluse.py:27`(모듈 docstring), `:122`(실제 stderr 메시지)
    vs `:117`(인접 인라인 주석)
  - 상세: `is_ready()`는 "미설치" 뿐 아니라 "부분 설치"도 함께 fail-open 시키고, 바로 그 지점의 인라인
    주석(:117)은 "Deps not installed *or only partially*"라고 정확히 서술한다. 그러나 모듈
    docstring(:27)과 실제 사용자에게 보이는 메시지(:122)는 여전히 "not installed"로만 남아 있다 —
    오류는 아니고("npm install 재실행" 해법 문구는 여전히 유효) 영향도 작지만, node_modules 가 이미
    (부분적으로) 존재하는데 "미설치"로 안내받는 개발자가 잠깐 혼란을 겪을 수 있다. 00_59_56 라운드가
    정확히 이 gap 을 INFO 로 지적하고 "우선순위 낮음"으로 의도적으로 미조치했으며, 이번 라운드에서도
    해당 코드 변경이 없어 그대로 유효하다(새 발견 아님, 재확인용으로만 기재).
  - 제안: 우선순위 낮음. 여유 있을 때 두 문구에 "(or only partially installed)"를 덧붙여 인라인 주석과
    정합.

## 확인했으나 결함 없음 (선택 검증)

- `mermaid_lint_ready.py` 모듈 docstring의 "세 곳이 합의해야 한다"는 서술을 `ConsumerBindingTest`의
  3개 테스트(`test_bootstrap_writes_the_shared_marker_name`/`test_precommit_reads_via_the_shared_helper`/
  `test_posttooluse_imports_is_ready`)와 대조 — 정확히 1개 writer + 2개 reader로 일치.
- `lint_mermaid_posttooluse.py`의 "형제 훅과 동일한 명시적 fail-open 관례"라는 주석 주장을
  `guard_default_branch_edit.py`/`guard_review_before_push.py`의 실제 import 블록과 직접 대조 —
  `traceback.print_exc()` 후 fail-open 패턴이 정확히 일치함을 확인.
- `plan/in-progress/harness-guard-followups.md` §A·§G 가 코드 주석이 인용하는 W2/W12/W6 내용과
  일치하는지 원문 대조 — 정확히 일치(근거 날조 없음).
- CHANGELOG.md 미갱신은 결함 아님 — 전수 확인 결과 이 파일은 `spec/` 연동 제품 변경에만 쓰이는
  컨벤션이며 순수 harness 변경(`.claude/`, `.githooks/`, `.github/`)이 여기 실린 전례가 없다.

## 요약

7개 파일은 이미 두 차례 리뷰 라운드(자기리뷰 20_06_45 → 14-리뷰어 전수 00_59_56)를 거친 뒤의 상태로,
그때 지적된 Critical/Warning(W1·W3·W7~W13, W2·W12는 알려진 한계로 명시)이 코드·테스트·주석 라인
단위로 정확히 반영돼 있음을 재확인했다. 신규 로직 대부분에 "왜"를 설명하는 정밀한 인라인 주석이
붙어 있고, 알려진 한계도 plan 문서와 정확히 대응하는 문구로 남아 있어 문서화 수준 자체는 여전히
높다. 이번 독립 재검토에서 이전 두 라운드가 놓친 6건을 새로 발견했다 — 그중 3건은 WARNING: ①
동시성 테스트가 이미 "정확히 1회"로 강화됐음에도 메서드명·README 서술이 옛 "at most one" 표현에
머물러 스스로의 docstring 과 모순, ② `.githooks/pre-commit` 헤더가 이번 diff 로 신설된 세 번째 공유
SoT(`mermaid_lint_ready.py`)를 나열하지 않아 `bootstrap-session.sh`에서 이미 한 번 고쳐진 것과 같은
클래스의 문제가 형제 파일에서 재발, ③ 같은 파일 안에서 "known limitation" 인용 표기가 비일관해(2건은
라운드명 명시, 1건은 미명시) 서로 다른 두 리뷰 라운드가 독자적으로 매긴 동일 번호("6" 등)가 실제로는
다른 발견을 가리킴이 실측으로 확인됨. 나머지 3건은 INFO(README의 후속 테스트 클래스 미반영, 암묵적
인용 관례, 이전 라운드가 이미 저우선순위로 남긴 부분설치 메시지 정밀도)로 기능·차단에 영향 없는
정밀도/추적성 문제다. CHANGELOG 미갱신·신규 spec 문서 부재는 이 저장소의 기존 컨벤션(harness/tooling
변경은 두 대상 밖)과 일치해 결함이 아니며, README·CLI 사용법은 테스트 스위트 자체가 실행 가능한 예제
역할을 이미 충분히 하고 있어 별도 예제 문서가 필요하지 않다. 전체적으로 병합을 막을 사유는 없다.

## 위험도

LOW
