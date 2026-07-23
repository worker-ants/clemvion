# 문서화(Documentation) 리뷰 — mermaid-lint import fail-open (exit 3)

## 발견사항

- **[WARNING]** 신규 테스트 docstring 의 리뷰 인용 날짜가 실제 경로와 불일치
  - 위치: `.claude/tests/test_lint_mermaid_exit_codes.py` 모듈 docstring, "Why it matters (review/code/2026/07/17 §A W1(10_55_35), deferred there): ..."
  - 상세: 인용된 "10_55_35" 라운드는 실제로 `review/code/2026/07/18/10_55_35/`(SUMMARY.md 의 `W1`, concurrency reviewer 발견)에 존재한다. `2026/07/17` 은 하루 어긋난 날짜다. `git commit` 메시지(`fix(harness): ... (§A-1)`)와 `plan/in-progress/harness-guard-followups.md:87-96`("**10_55_35 라운드(마커-only 전환 리뷰) 잔여:** ... W1(10_55_35)")도 해당 항목이 07/18 라운드임을 뒷받침한다. 이 프로젝트는 리뷰 경로를 정확한 타임스탬프로 인용해 추적성을 확보하는 것이 확립된 관례(MEMORY.md 다수 항목이 `review/code/<정확한 경로>` 를 근거로 인용)이므로, 날짜 오기재는 향후 이 fix 의 배경을 추적하려는 사람을 잘못된 날짜 폴더로 보낸다.
  - 제안: docstring 의 `2026/07/17` 을 `2026/07/18` 로 정정.

- **[INFO]** `.githooks/pre-commit` 신규 exit-3 안내 메시지의 괄호 구성이 어색함
  - 위치: `.githooks/pre-commit` 신규 분기
    ```
    echo "mermaid-lint: skipped (tooling failed to load; reinstall with:" >&2
    echo "  (cd .claude/tools/mermaid-lint && npm install) )." >&2
    ```
  - 상세: 렌더링하면 `... reinstall with:\n  (cd .claude/tools/mermaid-lint && npm install) ).` 가 되어, 여는 괄호 하나에 대해 중첩된 `(cd ...)` 를 닫은 뒤 다시 " )." 로 바깥 괄호를 닫는 구조가 눈에 띄게 어색하다. 같은 fail-open 안내를 담는 자매 메시지(`lint_mermaid_posttooluse.py`)는 `"...(linter tooling failed to load — likely a corrupt node_modules). Run: (cd .claude/tools/mermaid-lint && npm install)"` 처럼 괄호를 즉시 닫고 "Run:" 을 괄호 밖으로 분리하는 깔끔한 패턴을 쓴다. 기능에는 영향 없고(커밋을 막지 않음) 테스트도 이 정확한 문구를 검증하지 않으므로(현재 `assertIn("skipped", ...)` 만 확인) 회귀로 잡히지 않는다.
  - 제안: 다른 소비처와 동일한 톤으로 통일 — 예: `"mermaid-lint: skipped (tooling failed to load). Reinstall with:"` + `"  (cd .claude/tools/mermaid-lint && npm install)"`.

- **[INFO]** `lint_mermaid_posttooluse.py` 모듈 상단 exit-code 계약 표에 새 세부 분기가 이름으로 등재되지 않음
  - 위치: `.claude/hooks/lint_mermaid_posttooluse.py:70-75` (모듈 docstring, 미변경)
    ```
    exit 0 → no problem (also: not markdown, or no mermaid block — fast path).
    exit 2 → mermaid parse error; stderr is shown to Claude so it can fix it.
    any other → treated as a runtime error; non-blocking (we fail open).
    ```
  - 상세: 이 표는 훅 자신이 harness 에 반환하는 계약(0/2/그 외)을 설명하며, exit 3 케이스도 결국 `return 0` 이므로 문구 자체는 여전히 정확하다(허위 아님). 다만 "no problem" 한 줄에 "deps not installed" 와 신규 "tooling broken(corrupt import)" 두 개의 구분된 fail-open 서브케이스가 묵시적으로 뭉뚱그려져 있어, 상단 docstring만 보는 독자는 tooling-broken 케이스의 존재를 놓칠 수 있다. 코드 본문의 `_EXIT_TOOLING_BROKEN` 상수 주석과 해당 분기 인라인 주석은 충분히 상세하므로 실질적 피해는 낮음.
  - 제안: (선택) "exit 0 → no problem, **including deps-not-ready and tooling-broken fail-open cases**" 정도로 한 구 추가.

## 요약

핵심 로직(`lint-mermaid.mjs`)의 Exit 코드 표 갱신, 4개 소비처(`.mjs`/`posttooluse.py`/`pre-commit`/2개 테스트 파일) 전반에 걸친 인라인 주석·docstring 은 fail-open 계약의 "왜"를 각 지점에서 반복해 설명할 만큼 충실하며, 새 테스트 파일(`test_lint_mermaid_exit_codes.py`)은 이전 리뷰 발견을 근거로 인용하는 좋은 추적성 관례를 따른다(단, 날짜 인용이 하루 어긋남). CHANGELOG.md 는 이 저장소에서 spec-linked 제품 변경에만 쓰이고 하니스/툴링 커밋(#976·#984·#986 등 선례)에는 적용된 적이 없어 갱신 불요가 맞고, 새 환경변수·공개 API·README 대상도 없다. 발견된 두 항목은 모두 비차단 수준(인용 날짜 오기재 1건, 메시지 문구 어색함 1건)으로 코드 동작에는 영향이 없다.

## 위험도

LOW
