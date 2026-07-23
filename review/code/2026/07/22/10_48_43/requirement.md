# 요구사항(Requirement) 리뷰 — mermaid-lint import fail-open (exit 3 분리)

## 컨텍스트

이 변경은 `plan/in-progress/harness-guard-followups.md` §A "10_55_35 라운드 잔여" 의
**W1(10_55_35)** 항목(`review/code/2026/07/18/10_55_35/concurrency.md` WARNING — corrupt-but-marked
`node_modules` 에서 `lint-mermaid.mjs` 의 가드 없는 top-level `await import("mermaid")`/`("jsdom")` 가
크래시 → exit 1 → pre-commit/PostToolUse 양쪽이 "진짜 mermaid 파싱 에러"로 오판해 매 markdown
커밋/편집을 잘못된 메시지로 차단)를 정확히 그 리뷰가 제안한 방식(제안 (1): import 를 try/catch 로
감싸 별도 exit code 로 분리 + 양쪽 소비처가 "툴링 깨짐 → fail open" 으로 처리)대로 구현한다. 의도와
구현이 정확히 일치한다.

실제로 `.claude/tests/test_lint_mermaid_exit_codes.py`(신규, 실 node 대상) +
`.claude/tests/test_mermaid_lint_ready.py`(신규 케이스 2건, stub node 대상) 17건 전부를 로컬에서
직접 실행해 통과를 확인했다(`pytest .claude/tests/test_lint_mermaid_exit_codes.py
.claude/tests/test_mermaid_lint_ready.py` → 17 passed). `bash -n .githooks/pre-commit` 도 통과.

## 발견사항

- **[WARNING]** 새로 도입된 exit code `3` 값이 3개 언어 경계(mjs/python/bash)에 독립적으로
  하드코딩돼 있는데, 이 저장소가 동일 문제 유형(cross-language 매직 값)에 대해 이미 확립한
  컨벤션인 "값 일치를 직접 검증하는 pinning 테스트"가 이 값에는 적용되지 않았다.
  - 위치: `.claude/tools/mermaid-lint/lint-mermaid.mjs:9` (`const EXIT_TOOLING_BROKEN = 3;`),
    `.claude/hooks/lint_mermaid_posttooluse.py:39` (`_EXIT_TOOLING_BROKEN = 3`),
    `.githooks/pre-commit:1113` (`if [ "$mermaid_rc" -eq 3 ]`)
  - 상세: `test_mermaid_lint_ready.py` 자신의 모듈 docstring 이 이미 "bash 파일과 python 파일은
    런타임 상수를 공유할 수 없다 — 저장소 컨벤션(cf. test_doc_sync_matrix, test_summary_agent_contract)
    으로 하드코딩 문자열이 `MARKER_NAME` 과 일치하는지 테스트가 단언한다"고 명시하고
    `ConsumerBindingTest` 로 그 컨벤션을 실제로 구현해 두었다. 그런데 이번 diff 가 도입한
    `EXIT_TOOLING_BROKEN = 3` 은 정확히 같은 구조의 문제(3개 파일에 독립적으로 박힌 매직 값)를
    가지면서도 이 컨벤션이 적용되지 않았다. 현재 존재하는 테스트는 (a) mjs 단독의 실제 exit code가
    3인지(`test_lint_mermaid_exit_codes.py`, 실 node), (b) python/bash 소비처가 stub node 로 3을
    주입받았을 때 fail-open 하는지(`test_mermaid_lint_ready.py`, stub node) 를 각각 **분리해서**만
    검증한다 — 세 파일이 서로 다른 값으로 갈라져도 이 둘의 조합만으로는 즉시 드러나지 않는
    경로가 있다(예: 향후 누군가 mjs 쪽만 다른 exit code로 바꾸면 (a)는 실패해 알아채겠지만, 반대로
    python/bash 소비처 쪽 리터럴만 실수로 다른 값으로 바뀌면 stub 테스트가 그 잘못된 값을 그대로
    주입해 "정상"으로 통과한다 — 즉 (b) 쪽은 mjs 의 실제 값과 무관하게 항상 그린이다).
  - 제안: `ConsumerBindingTest` 에 `EXIT_TOOLING_BROKEN`/`_EXIT_TOOLING_BROKEN` 값이 mjs 소스의
    `const EXIT_TOOLING_BROKEN = 3` 및 pre-commit 의 `-eq 3` 과 일치하는지 확인하는 케이스를
    추가(정규식으로 mjs/bash 소스에서 값을 추출해 python 상수와 비교), 혹은 실제 corrupt
    `node_modules` 를 만들어 python 훅/`pre-commit` 을 **진짜 mjs** 대상으로 end-to-end 실행하는
    통합 테스트를 추가.

- **[INFO]** 신규 테스트 docstring 의 출처 날짜가 실제와 다름
  - 위치: `.claude/tests/test_lint_mermaid_exit_codes.py:14` (`"review/code/2026/07/17 §A
    W1(10_55_35), deferred there"`)
  - 상세: 해당 라운드는 실제로 `review/code/2026/07/18/10_55_35/concurrency.md`(2026-07-18)이며,
    `plan/in-progress/harness-guard-followups.md` 도 "사용자 결정 2026-07-18" 직후 문단에서
    "10_55_35 라운드"를 언급한다 — `07/17` 이 아니라 `07/18`. `review/code/2026/07/17/` 아래에는
    `10_55_35` 라는 하위 폴더 자체가 존재하지 않음(확인함).
  - 제안: 주석의 날짜를 `07/18`로 정정(추적성 목적의 인용이라 틀리면 향후 근거 문서를 못 찾음).

- **[INFO]** plan 체크박스가 이 diff 에 포함되지 않아 여전히 미완료로 표시됨
  - 위치: `plan/in-progress/harness-guard-followups.md` `- [ ] **W1(10_55_35) — ...**` (§A 하위,
    약 89행)
  - 상세: 이번 diff 가 정확히 이 항목을 구현하지만 plan 체크박스는 여전히 `[ ]`이다(리뷰 대상 5개
    파일에 plan 파일은 포함돼 있지 않음). 이 프로젝트 컨벤션상 체크박스는 "수행 후에만 체크하고 그
    커밋에 포함"이 원칙이다.
  - 제안: 이 구현을 커밋하는 시점(또는 바로 다음 커밋)에 해당 체크박스를 `[x]`로 갱신.

- **[INFO]** 스코프 밖 잔존 엣지케이스 — import 이후 단계의 크래시는 여전히 오분류될 수 있음
  - 위치: `.claude/tools/mermaid-lint/lint-mermaid.mjs` — `new JSDOM(...)` 생성자 호출(93행 부근,
    try/catch 밖), `mermaid.initialize(...)` 호출; `.claude/hooks/lint_mermaid_posttooluse.py` 의
    "그 외 모든 non-0/2/3 코드 → 파싱 에러로 간주" 최종 fallthrough 분기.
  - 상세: 이번 fix 는 정확히 원 리뷰가 특정한 "동적 import 실패"만 커버한다. `await import(...)` 는
    성공했지만 이후 `new JSDOM(...)` 생성자나 `mermaid.initialize()` 자체가 (다른 이유로) 예외를
    던지는 경우, 또는 node 프로세스가 시그널로 종료돼 `proc.returncode` 가 음수인 경우는 여전히
    "mermaid 파싱 에러"로 오분류돼 커밋/편집이 차단될 수 있다. 원 리뷰의 재현 시나리오(의존성
    부재로 인한 `ERR_MODULE_NOT_FOUND`)를 정확히 좁게 해결한 것으로 보이며 의도적 스코프 축소로
    판단되지만, 완전한 커버리지는 아니다.
  - 제안: 즉각 수정 불요(원 리뷰 스코프 밖). 필요 시 별도 후속 항목으로 트래킹.

- **[INFO]** spec 문서 부재 (예상된 결과)
  - 위치: `spec/` 전체 grep — `mermaid`/`lint_mermaid_posttooluse`/`lint-mermaid.mjs` 관련 항목 없음
    (mermaid 를 언급하는 spec 문서들은 전부 diagram 예시로 사용할 뿐, 이 harness 훅 자체를 정의하지
    않음).
  - 상세: 이 변경은 제품 코드(`spec/` 로 정의되는 `codebase/**`)가 아니라 `.claude/` 하네스
    tooling 이다. CLAUDE.md 상 `spec/` 은 제품의 단일 진실이며 harness 규약은 각 스크립트의
    docstring/plan 문서가 SoT 역할을 한다. 따라서 point 9(spec fidelity) 관점에서 대상 spec 문서
    자체가 존재하지 않는 것이 정상이다.
  - 제안: 해당 없음(정보성).

## 요약

의도된 기능(corrupt-but-marked `node_modules` 에서의 의존성 import 실패를 "malformed mermaid
diagram" 오탐과 구분해 fail-open 시키는 것)을 mjs/python/bash 3개 소비처 전체에 걸쳐 정확히
구현했으며, 원 리뷰(`review/code/2026/07/18/10_55_35`)가 제안한 해법과 line-level 로 합치한다.
신규 테스트 17건을 실제로 실행해 통과를 확인했고(`test_import_failure_exits_3_not_1` 등 실 node
대상 테스트 포함), 회귀 시 실패하도록 설계된 pin 테스트도 타당하다. TODO/FIXME 류 미완성 표식은
없다. 잔여 이슈는 모두 비차단 성격이다 — 가장 눈에 띄는 것은 새 exit-code 3 값이 3개 언어 경계에
독립적으로 하드코딩됐는데, 저장소가 동일 유형 문제(MARKER_NAME)에 이미 적용한 "cross-language 값
일치 pinning 테스트" 컨벤션이 이 값에는 적용되지 않은 점(WARNING). 나머지는 문서 인용 날짜 오타,
plan 체크박스 미갱신, 스코프 밖 잔존 엣지케이스 등 정보성 항목이다.

## 위험도

LOW
