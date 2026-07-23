### 발견사항

- **[WARNING]** 동일 지침("게이트 숫자만 사용/조립 문서 줄 세지 말 것/모르면 지어내지 말고 Read·Grep 후 함수·클래스명으로")이 두 개의 독립된 소스에 서로 다른 워딩으로 중복 서술되며, 둘 사이의 일관성을 지키는 테스트가 없다.
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:435-454` (`LINE_ANCHOR_LEGEND`, 프롬프트에 동적으로 prepend) vs `.claude/agents/api-contract-reviewer.md:29-31` 등 13개 reviewer `.md` 파일의 "위치:" 블록(정적으로 system prompt에 내장)
  - 상세: 같은 turn 의 프롬프트 안에 "위치 표기 규약" 섹션(`LINE_ANCHOR_LEGEND`)과 reviewer 정의 파일의 "위치:" 지침이 **함께** 도달한다 — 사실상 같은 규칙을 다른 문장으로 두 번 말하는 셈이다. 이 diff 는 `test_line_anchors.py::ReviewerDefinitionContractTest.test_the_location_block_is_byte_identical_across_all_reviewers` 로 13개 `.md` 파일 **상호간** 워딩 일치는 테스트로 고정했지만, `.md` 워딩과 `LINE_ANCHOR_LEGEND` 워딩 **사이**의 일치는 아무 것도 검증하지 않는다. 향후 한쪽만 수정되면 두 지침이 미묘하게 어긋나는(예: 한쪽은 "함수·클래스·블록명" 세 항목을 언급하는데 다른 쪽은 두 항목만 언급) 방식으로 drift 할 수 있다.
  - 제안: 두 소스 중 하나를 SoT 로 정하고 나머지는 그것을 참조/생성하거나(예: `LINE_ANCHOR_LEGEND` 문자열의 핵심 3규칙을 상수로 뽑아 두 곳이 같은 리스트를 렌더링), 최소한 `ReviewerDefinitionContractTest` 에 `LINE_ANCHOR_LEGEND` 와의 핵심 문구 교차 검증 테스트를 추가한다.

- **[WARNING]** 게이트 오버헤드 반영 후 사이즈 상한 기본값(55,296 / 141,557)이 코드·README.md·SKILL.md 세 곳에 각각 하드코딩되어 있고, 세 곳의 일치를 검증하는 테스트가 없다.
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:72-74` (`DEFAULT_MAX_FILE_SIZE` / `DEFAULT_MAX_PROMPT_SIZE` 계산) vs `.claude/skills/code-review-agents/README.md:206-207` vs `.claude/skills/code-review-agents/SKILL.md:188-189`
  - 상세: 코드는 `_GUTTER_OVERHEAD = 1.08` 을 곱해 값을 **계산**하지만 두 문서는 그 결과값(`55296`, `141557`)을 **평문 숫자**로 옮겨 적었다. `_GUTTER_OVERHEAD` 나 base 값(51200/131072)이 다음에 재측정으로 바뀌면 두 문서를 손으로 동기화해야 하는데, 이를 강제하는 장치가 없다. 이 프로젝트는 바로 이런 종류의 코드-문서 drift 를 `test_doc_sync_matrix.py`, `test_agent_consistency.py` 같은 전용 테스트로 막아온 전례가 있어(그리고 이번 diff 자체도 `ReviewerDefinitionContractTest` 로 같은 클래스의 문제를 하나 더 막았다), 이 세 값에는 상응하는 가드가 없다는 게 눈에 띈다.
  - 제안: 두 마크다운 표의 값 옆에 "SSOT: 코드의 `DEFAULT_MAX_*_SIZE`" 주석을 남기거나(이미 `router_safety.py` SSOT 패턴을 README 에서 쓰고 있으므로 동일 패턴 재사용), 가능하면 문서 값을 코드에서 파싱해 비교하는 단위 테스트를 추가한다.

- **[INFO]** `line_anchors.py` 내 타입힌트 커버리지가 함수마다 고르지 않다.
  - 위치: `.claude/skills/code-review-agents/lib/line_anchors.py:77` (`_gutter(lineno, width: int) -> str` — `lineno` 는 `int | None` 이지만 미표기), `:233` (`truncate_to_line_boundary(text: str, max_chars: int):` — 반환 타입 미표기, 다른 함수들은 `-> str`/`-> int`/`-> bool` 표기)
  - 상세: 같은 모듈의 대다수 함수(`gutter_width`, `number_source_lines`, `_hunk_is_consistent`, `annotate_unified_diff` 등)는 파라미터·반환 타입을 온전히 표기했는데 이 두 곳만 부분적이다. 기능에 영향은 없으나 일관성 관점에서 사소한 흠이다.
  - 제안: `lineno: int | None`, `-> tuple[str, int, int]` 를 추가해 모듈 전체 표기 수준을 통일한다.

- **[INFO]** 13개 `*-reviewer.md` 의 "위치:" 3줄 블록은 hand-copy 로 유지되며, 문구를 다시 바꿀 때마다 13개 파일을 동시에 편집해야 한다.
  - 위치: `.claude/agents/api-contract-reviewer.md:29-31`, `.claude/agents/architecture-reviewer.md:29-31` 등 13개 파일 동일 위치 (전수: security/performance/architecture/requirement/scope/side-effect/maintainability/testing/documentation/dependency/database/concurrency/api-contract-reviewer.md)
  - 상세: 이미 이 codebase 는 "sub-agent 정의 = 모델이 실행하는 system prompt 이므로 문구 자체가 behavior" 라는 컨벤션을 갖고 있고(`.claude/tests/README.md` 의 "Deliberate exception" 문단), 이번 diff 가 추가한 `test_the_location_block_is_byte_identical_across_all_reviewers` 로 drift 는 이미 가드된다. 새 문제를 만든 것은 아니고 기존 패턴의 확장이므로 CRITICAL/WARNING 은 아니지만, 유지비용(13곳 동시 편집)은 그대로 남는다.
  - 제안: (수용 가능하면 유지) 향후 reviewer 수가 더 늘어나거나 문구가 자주 바뀐다면, `role_instructions.py` 처럼 이 3줄도 코드에서 렌더링해 `.md` 에 주입하는 방식(현재 이 diff 가 `LINE_ANCHOR_LEGEND` 에 대해 이미 하고 있는 것과 대칭적으로)으로 전환을 고려.

- **[INFO]** `build_files_section` 은 이번 diff 이전부터 이미 3가지 예산 분기(무제한/전체 초과/부분 배분)를 한 함수 안에서 처리하는 100줄 이상 함수였고, 이번 변경은 그 구조를 보존한 채(주석으로 명시: "Pre-existing shape, kept as-is so the change stays behaviour-preserving") 줄번호 부여·경계 보존 절단 호출을 끼워 넣었다.
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:466-578`
  - 상세: 새로 도입된 복잡도는 아니며 diff 자체는 오히려 `DIFF_HEADING`/`FULL_CONTEXT_HEADING`/`_truncated_note()` 상수·헬퍼로 기존에 3곳 흩어져 있던 매직 스트링을 통합해 DRY 를 개선했다(긍정적). 다만 함수 자체의 3-분기 구조는 여전히 한 함수 안에 있어 향후 또 다른 예산 규칙이 추가되면 가독성이 더 나빠질 수 있다.
  - 제안: 이번 PR 범위는 아니지만, 후속 리팩터링 시 세 분기(무제한/overflow-cut/remaining-budget-distribute)를 별도 helper 함수로 분리 고려.

### 요약

핵심 신규 코드인 `line_anchors.py` 는 명확한 네이밍(`gutter_width`, `annotate_unified_diff`, `truncate_to_line_boundary` 등), 짧고 단일 책임인 함수, 모든 실패 경로에 대한 "fail open, 모르면 원문 그대로" 원칙을 일관되게 지키는 잘 설계된 모듈이며, `test_line_anchors.py` 는 실제 git 히스토리를 재생해 검증하는 등 이 코드베이스의 테스트 관례를 잘 따른다. 오케스트레이터 변경도 기존에 3곳 흩어져 있던 트렁케이션/헤딩 매직 스트링을 상수·헬퍼로 통합해 오히려 DRY 를 개선했다. 다만 두 가지 구조적 중복 리스크가 새로 생겼다 — (1) 같은 "위치 표기" 규칙이 동적 legend(`LINE_ANCHOR_LEGEND`)와 13개 reviewer `.md` 파일에 서로 다른 워딩으로 이중 서술되며 그 사이의 일관성은 테스트되지 않고, (2) 재계산된 사이즈 상한 기본값이 코드와 두 문서(README/SKILL)에 각각 하드코딩되어 향후 재조정 시 수동 동기화가 필요하다. 둘 다 즉각적 결함은 아니지만 이 프로젝트가 이미 유사 클래스의 drift 를 전용 테스트로 막아온 전례에 비추면 갭으로 남는다.

### 위험도
LOW
