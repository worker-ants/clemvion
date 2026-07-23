# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** 새 함수(`_routing_distrust_reason`)를 설명하는 26줄짜리 근거 주석이 그 함수와 무관한 상수(`BINARY_EXTENSIONS`) 바로 앞에 위치
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:77` (주석 시작) — 실제 함수는 `:403` 의 `_routing_distrust_reason`
  - 상세: "Caller-side trust check for a routing decision..." 로 시작하는 라우팅 신뢰성 근거 설명 블록(2026-07-23 인시던트 서술 포함)이 `_GUTTER_OVERHEAD`/`DEFAULT_MAX_FILE_SIZE` 정의 직후, `BINARY_EXTENSIONS` 딕셔너리 직전에 삽입되어 있다. 정작 이 근거를 담아야 할 코드(`_routing_distrust_reason`, `_apply_routing`)는 ~330줄 뒤에 있고, 그 함수의 docstring 은 훨씬 짧게 요약만 되어 있다. 파일을 처음 읽는 사람은 이 주석이 왜 `BINARY_EXTENSIONS` 앞에 있는지 맥락을 찾기 어렵고, 이후 누군가 `BINARY_EXTENSIONS` 를 옮기거나 삭제하면 이 주석만 고아 상태로 남을 위험이 있다.
  - 제안: 이 주석 블록을 `_routing_distrust_reason` 함수 바로 위(또는 `_apply_routing`)로 옮기거나, 핵심만 함수 docstring 에 흡수시키고 이 위치에는 짧은 포인터만 남긴다.

- **[WARNING]** "샘플 N개 + 나머지 개수 표기" 패턴이 서로 다른 상수·단위로 세 번째로 중복 등장
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:749-750` (`src_paths[:20]`, `"외 {…} - 20}개"`) vs `.claude/skills/code-review-agents/lib/router_safety.py:382-385`, `:395-398` (둘 다 `[:3]`, `"외 {…}건"`)
  - 상세: `router_safety.py` 안에 이미 "리스트를 3개까지 자르고 초과분을 `(외 N건)` 으로 덧붙인다"는 패턴이 두 군데(rule kind 1, rule kind 2) 있었는데, 이번 diff 로 `build_router_prompt_body` 에 같은 아이디어의 세 번째 구현이 추가됐다. 다만 한도가 `3` 이 아니라 `20`, 접미사가 `건`이 아니라 `개`로 서로 다르고 공유 헬퍼나 이름 붙은 상수가 없다. 세 곳 모두 매직 넘버(`3`, `20`)를 그대로 하드코딩하고 있어, 한도를 조정하거나 문구를 통일해야 할 때 세 곳을 각각 찾아 고쳐야 한다.
  - 제안: `_sample_with_more_note(items, limit, unit)` 같은 공용 헬퍼(또는 named constant)로 통합해 한도·문구가 한 곳에서만 정의되게 한다.

- **[WARNING]** JS 소스에서 함수 본문을 잘라내는 임시방편 파싱이 같은 테스트 파일 안에서 두 가지 방식으로 중복
  - 위치: `.claude/tests/test_router_decision_trust.py:181-182` (`WorkflowMirrorsPythonRuleTest.test_workflow_has_no_zero_reviewer_fallback`) 및 `:248-249` (`test_both_paths_agree_on_a_matrix_of_decisions`) — 둘 다 `js.index("function routingDistrustReason")` → `js.index("\n}", start)` 로 함수 본문 경계를 찾음. 같은 클래스의 `test_workflow_falls_back_to_every_invocation` (`:197-198`) 은 또 다른 방식(`js.index("if (distrust) {")` … `guard.index("} else {")`)으로 리전을 추출.
  - 상세: `"\n}"` 를 "최상위 들여쓰기 없는 닫는 중괄호"로 취급하는 이 휴리스틱은 현재 파일의 2-space 들여쓰기 관례에 암묵적으로 의존한다. 이 가정을 명시하는 주석이 없고, 동일 로직이 두 테스트 메서드에 그대로 복붙되어 있어 한쪽만 고치고 다른 쪽을 잊으면(예: 함수 포맷이 바뀌어 종료 지점이 어긋나는 경우) 두 테스트가 서로 다른 텍스트 범위를 검증하게 될 수 있다. 이 프로젝트가 이미 "손으로 짠 정밀 파서 대신 blind 정규식/공유 헬퍼로 유한한 표면에 가두라"는 교훈을 반복적으로 얻은 바 있다(PR #970/#971 계열).
  - 제안: `_extract_js_function(js_src, name)` 같은 공용 헬퍼 하나로 합치고, 그 안에 "2-space 들여쓰기·최상위 `}` 가 종료 마커" 라는 가정을 주석으로 명시한다.

- **[INFO]** 동일한 2026-07-23 인시던트 서술이 5개 파일에 거의 그대로 복붙됨
  - 위치: `.claude/skills/code-review-agents/lib/router_safety.py`(`source_files` docstring), `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py`(주석 2곳: `_routing_distrust_reason` 앞, `build_router_prompt_body` 안), `.claude/tests/README.md`(표 행), `.claude/tests/test_router_decision_trust.py`(모듈 docstring), `.claude/workflows/ai-review.js`(`routingDistrustReason` 앞 주석)
  - 상세: 이 프로젝트는 "왜"를 풍부하게 남기는 관례가 이미 확립돼 있어(각 spec/plan Rationale 섹션 등) 완전히 새로운 패턴은 아니지만, 같은 사건의 수치(파일 수·리뷰어 수 등)를 5곳에 각각 손으로 옮겨 적었다. 나중에 이 서술 중 하나라도 정정이 필요해지면 5곳을 모두 동기화해야 한다. 실제로 지금도 "4 code files"(router_safety.py) vs "a brand-new Python module plus two more .py files"(test 파일) 처럼 표현이 미묘하게 다르다(모순까지는 아니나 대조하기 어렵다).
  - 제안: 정본 서술은 한 곳(예: `code_review_orchestrator.py` 의 함수 docstring 또는 `test_router_decision_trust.py` 모듈 docstring)에만 상세히 두고, 나머지는 그 파일을 가리키는 짧은 참조로 대체하는 것을 고려.

- **[INFO]** `WorkflowMirrorsPythonRuleTest`/`RouterPromptStatesCompositionTest` 의 여러 테스트 메서드가 각각 독립적으로 `WORKFLOW.read_text()` 를 다시 읽음
  - 위치: `.claude/tests/test_router_decision_trust.py` — `test_workflow_has_no_zero_reviewer_fallback`, `test_workflow_checks_forced_reviewers_were_not_dropped`, `test_workflow_falls_back_to_every_invocation`, `test_workflow_actually_calls_the_rule_at_the_route_site`, `test_both_paths_agree_on_a_matrix_of_decisions` 모두 개별적으로 파일을 다시 읽는다.
  - 상세: 파일이 작아 성능상 문제는 없으나, `setUp`/클래스 속성으로 한 번만 읽어 공유하면 중복이 줄고 "왜 이 테스트만 다른 방식으로 읽나"를 고민할 필요가 없어진다.
  - 제안: 굳이 지금 고칠 필요는 없음(우선순위 낮음) — 향후 파일이 커지거나 테스트가 더 늘어나면 `setUpClass` 로 캐시 고려.

## 요약

이번 변경은 "라우터가 강제 리뷰어를 거짓/누락으로 반환하면 결정을 통째로 폐기한다"는 안전장치를 Python(`code_review_orchestrator.py`)과 JS(`ai-review.js`) 양쪽에 대칭적으로 추가하고, 두 구현을 차등 테스트(`test_router_decision_trust.py`)로 묶어 드리프트를 막는 구조가 잘 설계되어 있다. `router_safety.source_files()` 추출로 기존 중복 로컬 변수를 없애고 shadowing 을 피하는 이름(`changed_source`)으로 바꾼 점, 가드 클로즈 스타일로 `_apply_routing`/`routingDistrustReason` 을 짧고 얕게 유지한 점은 긍정적이다. 다만 (1) 새 근거 주석이 실제 대상 코드에서 멀리 떨어진 무관한 상수 옆에 놓여 있고, (2) "샘플 N개+나머지 표기" 패턴이 이름 없는 매직 넘버로 세 번째 변형까지 늘었으며, (3) 신규 테스트가 JS 소스를 텍스트로 잘라내는 임시 로직을 한 파일 안에서 두 가지 방식으로 중복 구현한 점은 향후 수정 시 동기화 부담과 취약성을 남긴다. 모두 치명적이지 않고 국소적인 개선 여지다.

## 위험도

LOW
