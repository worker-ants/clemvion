# 테스트(Testing) 리뷰

## 발견사항

- **[WARNING]** 두 번째 `import("mermaid")` catch 블록이 어떤 테스트에서도 실제로 실행되지 않는다 (dead branch under test)
  - 위치: `.claude/tools/mermaid-lint/lint-mermaid.mjs:1041-1050` (mermaid import try/catch) ↔ `.claude/tests/test_lint_mermaid_exit_codes.py:302-318` (`setUp`)
  - 상세: `test_lint_mermaid_exit_codes.py`의 `setUp`은 격리된 임시 디렉터리에 `node_modules/`(마커 파일만 있고 실제 패키지는 없음)를 만들어 `jsdom`과 `mermaid`가 **둘 다** 해석 불가능하게 만든다. 이 상태에서 스크립트를 실행하면 첫 번째 `await import("jsdom")`가 먼저 실패해 `process.exit(3)`으로 즉시 종료되므로, 그 뒤에 오는 두 번째 `try { await import("mermaid") } catch { ... exit(3) }` 블록은 실행 경로에 도달하지 못한다. 즉 "jsdom은 정상 설치됐지만 mermaid만 깨진" — PR 코멘트가 명시적으로 언급하는 "a dependency (jsdom / mermaid)가 하나만 실패"하는 부분 설치 손상 시나리오 — 는 어떤 테스트로도 실측되지 않는다. 이 두 번째 catch 블록에서 `process.exit(EXIT_TOOLING_BROKEN)`을 빠뜨리거나 메시지에 오타를 내는 회귀가 생겨도 현재 테스트 스위트는 이를 탐지하지 못한다(mutation testing 관점에서 이 블록은 "surviving mutant" 후보).
  - 제안: `setUp`에서 `jsdom`을 위한 최소 stub 패키지(`node_modules/jsdom/package.json` + no-op export 하나)를 배치해 `import("jsdom")`은 성공하도록 만들고, `mermaid`만 미설치 상태로 남겨 두 번째 catch 블록을 강제로 태우는 테스트 케이스(`test_mermaid_import_failure_exits_3`)를 별도로 추가할 것. 최소한 에러 메시지가 "could not import mermaid"(jsdom이 아니라)를 담고 있는지까지 검증하면 두 catch 블록의 attribution 정확성도 함께 고정된다.

- **[INFO]** "실제 postToolUse 훅 → 실제 is_ready → 실제 node → 손상된 실제 lint-mermaid.mjs" 전체 체인의 end-to-end 테스트는 없음
  - 위치: `.claude/tests/test_mermaid_lint_ready.py`의 `PostToolUseExecutionTest`(node를 bash stub으로 대체) vs `.claude/tests/test_lint_mermaid_exit_codes.py`(node는 실제이나 `lint_mermaid_posttooluse.py`를 거치지 않고 mjs를 직접 호출)
  - 상세: 두 파일이 각자 다른 이음매(seam)를 검증하는 분할 전략은 파일 상단 docstring에 의도적으로 문서화되어 있고("The other mermaid tests... deliberately stub `node`... This file is the complement"), 실용적인 트레이드오프로 보인다. 다만 "훅이 실제로 손상된 tree에 대해 node를 실행했을 때 정확히 fail-open 한다"는 완전한 통합 시나리오는 어느 한 테스트에도 그대로 존재하지 않는다(양쪽 세그먼트가 각각 옳다는 것으로부터 합성이 옳음을 추론하는 형태).
  - 제안: 우선순위는 낮음. 필요 시 `MERMAID_LINT_TOOL_DIR`을 `test_lint_mermaid_exit_codes.py`의 손상된 `tool_dir`로 지정해 `lint_mermaid_posttooluse.py`를 subprocess로 직접 구동하는 테스트 1개를 추가하면 완전한 삼각검증이 된다.

- **[INFO]** pre-commit/PostToolUse 모두 "ready + node exit 0(정상 통과)" 케이스에 대한 명시적 실행 테스트가 없음 (본 diff 이전부터 존재하던 갭)
  - 위치: `.claude/tests/test_mermaid_lint_ready.py`의 `PostToolUseExecutionTest`/`PreCommitExecutionTest` 클래스 전체
  - 상세: 두 클래스 모두 `not_ready`(스킵), `node_exit_code=1`(차단/실패), 그리고 이번에 추가된 `node_exit_code=3`(fail-open)만 있고, "ready 상태에서 린터가 실제로 통과(exit 0)하면 커밋/편집이 그대로 진행된다"는 가장 흔한 happy-path에 대한 실행 기반 회귀 테스트가 보이지 않는다. 이번 diff가 만든 갭은 아니지만, 관련 클래스를 만지는 김에 함께 메우기 좋은 지점이다.
  - 제안: 필수는 아니나, `node_exit_code=0`으로 `_run`을 호출해 `returncode == 0`이고 "skipped"/"aborted" 문구가 전혀 없음을 확인하는 테스트를 두 클래스 각각에 추가하는 것을 권장.

## 요약

이번 변경(exit code 3 "tooling broken" 도입과 4개 소비자 측 fail-open 처리)에 대한 테스트는 전반적으로 상당히 꼼꼼하다. `test_lint_mermaid_exit_codes.py`는 stub이 아닌 **실제 node**로 의존성 임포트 실패를 재현해 mjs 스크립트 자체의 exit code 계약(3 vs 1 vs 2, fast-path에서 exit 3이 스퓨리어스하게 발생하지 않음)을 고정하고, `test_mermaid_lint_ready.py`에 추가된 두 테스트는 node를 stub으로 대체해 Python/Bash 양쪽 소비자가 exit 3을 정확히 fail-open으로 분기 처리하는지(호출 횟수·반환 코드·stderr 문구까지) 각각 실행 기반으로 검증한다. 이 stub-vs-real 이원 전략과 매 테스트에 달린 "무엇을 왜 검증하는지 / 되돌리면 왜 깨지는지"를 설명하는 docstring은 회귀 방지·가독성 면에서 모범적이다. 다만 mjs 파일의 두 개 dynamic-import try/catch 블록 중 두 번째(`mermaid` 임포트 실패) 블록은 현재 테스트 환경 설정(jsdom·mermaid 둘 다 부재)에서 첫 번째 catch가 항상 먼저 걸려 실행 경로 자체에 도달하지 못하므로, 이 블록에 대한 실질적 커버리지는 없다 — 코드가 대칭적이라 현재는 문제가 없어 보이지만 향후 이 블록만 수정/삭제되는 회귀를 잡아내지 못한다. 이 갭 외에 나머지는 기존 테스트와의 격리·회귀 유효성 모두 양호하다.

## 위험도

LOW
