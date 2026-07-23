# 문서화(Documentation) 리뷰 — router_safety 정책 표 drift 수정

## 발견사항

- **[WARNING]** `router_safety.py` 의 "24 → 44 extensions" 정정이 자신이 SSOT 라고 선언한 **미러 문서(`README.md`) 쪽에는 반영되지 않음 — 이 changeset 이 고치려는 것과 동일한 결함이 다른 위치에 재발
  - 위치: `.claude/skills/code-review-agents/README.md:68` (해당 파일은 이번 diff 대상 3개 파일에 포함되지 않음 — `Read` 로 현재 워크트리에서 직접 확인)
  - 상세: `.claude/skills/code-review-agents/lib/router_safety.py` 의 docstring 은 "Source-code file (24 extensions below)" → "(44 extensions below)" 로 정정됐고(전체 파일 컨텍스트 36행), 새 테스트(`test_router_safety_policy_doc.py`)가 이 숫자와 `_SOURCE_CODE_EXTENSIONS`(44개) 를 대조하는 `test_table_states_the_real_extension_count` 를 추가했다. 그런데 정작 그 docstring 이 "정책의 단일 진실 원천" 이라 부르며 "표를 수정하면 양쪽을 같이 갱신한다" 고 명시한 미러 문서 `.claude/skills/code-review-agents/README.md` 의 "Router safety policy" 표(68행)는 여전히 `| 소스 파일 (24 확장자) | ...`로 **옛 숫자(24)를 그대로 유지**하고 있다. `git diff origin/main -- .claude/skills/code-review-agents/README.md` 는 빈 결과이므로 이번 PR 이 그 파일을 건드리지 않았음이 확인됨. 같은 파일 79행의 스펠아웃 리스트(`ts tsx js jsx ...`)는 이미 44개 항목이 맞게 들어있어(신규 테스트 `test_readme_list_is_exactly_the_constant` 가 검증) 겉보기엔 "README 는 최신"으로 보이지만, 68행 표의 **숫자 레이블만** 구시대 값으로 남아 있다.
  - 부가: 신규 가드 테스트의 `_readme_extension_list()` 는 79행의 스펠아웃 리스트만 파싱하고, 68행 표 셀의 `\d+ 확장자` 카운트는 검사하지 않는다. 즉 이번에 추가된 회귀 방지 테스트가 **이번에 남은 바로 그 drift 지점을 커버하지 못한다** — 다음에 확장자가 또 늘어나도 68행은 계속 소리 없이 stale 상태로 남을 수 있음.
  - 제안: (1) `README.md:68` 의 `24 확장자` → `44 확장자` 로 정정. (2) `test_router_safety_policy_doc.py` 에 README 68행 표의 카운트 숫자도 `len(extensions)` 와 대조하는 assertion 을 추가(현재 `_router_safety.py` 자체 표 카운트만 검사하는 `test_table_states_the_real_extension_count` 와 대칭되는 README 버전).

- **[INFO]** 신규 테스트 파일에 미사용 import
  - 위치: `.claude/tests/test_router_safety_policy_doc.py:29` (`from pathlib import Path`)
  - 상세: `Path` 는 import 만 되고 파일 전체에서 실제로 사용되지 않음(`SKILL_DIR` 등은 `REPO_ROOT / ...` 로 이미 `Path` 객체인 `REPO_ROOT` 를 통해 구성됨). 기능·문서 정확성에는 영향 없으나 lint 관점의 사소한 잔여물.
  - 제안: 미사용이면 제거.

## 문서 품질 확인 (변경분 상당수는 오히려 모범적)

- `router_safety.py` 모듈 docstring 의 정책 표는 여전히 정확히 최신 상수와 일치(확장자 44개 스펠아웃 리스트, `_SOURCE_FORCED_REVIEWERS` 6종, 리뷰어 로스터 등 모두 실제 코드와 대조 확인됨).
- `test_router_safety_policy_doc.py` 자체 docstring 은 "왜 이 테스트가 존재하는가"(24 vs 44 실측 drift, 발견 세션 `review/code/2026/07/23/15_59_54`, `/ai-review` INFO 3)를 구체적으로 기록하고, "Prose-checking on purpose" 컨벤션 예외를 `.claude/tests/README.md` 의 명시적 룰에 정확히 링크해 정당화함 — 사후 추적성이 매우 좋음.
- `.claude/tests/README.md` 신규 행(`test_router_safety_policy_doc.py`)은 기존 표 스타일·서술 밀도와 일치하며, 테스트가 실제로 검사하는 6개 assertion 을 빠짐없이 요약함.
- 코드 자체(로직) 변경은 없음 — 순수 문서 정정 + 회귀 가드 테스트 추가이므로 README/CHANGELOG/API 문서/설정 문서/예제 코드 항목은 대체로 해당 없음.

## 요약

핵심 변경은 `router_safety.py` docstring 표의 "24 extensions" → "44 extensions" 정정과, 향후 같은 drift 를 잡기 위한 신규 테스트(`test_router_safety_policy_doc.py`) + `.claude/tests/README.md` 목록 갱신이다. 새 테스트의 문서화 수준은 높고 근거도 구체적이나, 정작 그 docstring 이 스스로 "같이 갱신하라"고 명시한 미러 문서(`.claude/skills/code-review-agents/README.md` 68행)의 "24 확장자" 표기는 이번 PR 에서 갱신되지 않았고, 새 가드 테스트도 그 지점을 검사하지 않아 동일 클래스의 drift 가 한 곳에 재발/잔존한다. 기능(라우팅 로직)에는 영향이 없는 순수 문서 정합성 문제이므로 WARNING 수준으로 판단한다.

## 위험도
LOW
