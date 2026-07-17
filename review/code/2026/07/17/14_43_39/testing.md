# 테스트(Testing) 리뷰

## 발견사항

- **[WARNING]** 신규 회귀 테스트 `PAIRS` 가 이번 fix 의 실제 적용 범위(7개 파일) 중 3개만 커버 — 나머지 4개는 동일 재발 위험에 무방비
  - 위치: `.claude/tests/test_summary_agent_contract.py:10`(자체 docstring의 "copy-pasted into 7 files" 주장) vs `:28-32`(`PAIRS` 는 `code-review-summary.md`/`consistency-summary.md`/`integration-risk-summary.md` 3개만 포함)
  - 상세: 실제로 "terminal 이라서 write 가 차단된다"는 반증된 설명은 이번 diff에서 `.claude/agents/*-summary.md` 3개뿐 아니라 `.claude/commands/ai-review.md`, `.claude/commands/consistency-check.md`, `.claude/commands/merge-coordinate.md`, `.claude/skills/merge-coordinator/SKILL.md` 총 7개 파일에 동일 패턴으로 있었고 이번 diff가 7곳 모두 correction 했다(직접 확인: 7개 파일 모두 옛 "terminal summary write 는 차단될 수 있고" 류 문구 → "basename 정확 일치 규칙" 류 문구로 변경됨). 그런데 신규 pin 테스트는 `.claude/agents/` 3개 파일만 지킨다. 게다가 `.github/workflows/harness-checks.yml` 의 `paths:` 트리거 목록(`.claude/agents/**`, `.claude/hooks/**`, `.claude/skills/**`, `.claude/tests/**`, `.claude/tools/**`, `.claude/workflows/**`, …)에는 `.claude/commands/**` 가 아예 없다 — 즉 `.claude/commands/ai-review.md` 등 3개 파일만 단독 수정되는 향후 PR 은 harness-checks CI 자체가 트리거되지 않아, 설령 테스트를 추가해도 자동 실행되지 않는다. 이 PR 자체가 "메커니즘 없는 prose 의무는 무너진다"는 교훈에서 출발했는데, 그 교훈이 이번 fix 의 62%(4/7 파일)에는 적용되지 않은 상태로 남는다.
  - 제안: (1) `PAIRS`(또는 별도 리스트)에 `.claude/commands/ai-review.md`, `.claude/commands/consistency-check.md`, `.claude/commands/merge-coordinate.md`, `.claude/skills/merge-coordinator/SKILL.md` 4개를 추가해 동일한 `assertNotIn("non-terminal", ...)` / basename 서술 검증을 확장. (2) `.github/workflows/harness-checks.yml` 의 `paths:` 에 `.claude/commands/**` 를 추가해 향후 해당 파일 단독 수정 시에도 CI가 트리거되도록 함. `plan/in-progress/harness-report-contract-followups.md` 에는 이 항목이 없으므로 새 후속 항목으로 등재하거나 이번 PR에서 바로 반영 권장.

- **[WARNING]** 이번 diff가 신규로 추가한 "커버리지 누락 표기" 안전장치 문구(허위 clean/BLOCK:NO 방지)가 테스트로 고정되지 않음
  - 위치: `.claude/agents/code-review-summary.md` §4 "forced 인데 결과 없음... 강제 화이트리스트 미이행이 clean 으로 읽히면 안 됩니다", `.claude/agents/consistency-summary.md` §4 "전문을 확보 못 한 checker 가 있으면... BLOCK: NO 는 거짓 음성", `.claude/agents/integration-risk-summary.md` §4 동일 패턴 — 대응 테스트는 `.claude/tests/test_summary_agent_contract.py`
  - 상세: 이 세 문구는 `forced-coverage-gate` 플랜(같은 diff에 포함된 `plan/complete/forced-coverage-gate.md`)이 막으려는 것과 정확히 같은 종류의 실패(강제 리뷰 대상 미이행이 "정상"으로 보이는 거짓 음성)를 요약 에이전트 레벨에서 막는 문구다. 그런데 `test_summary_agent_contract.py` 의 4개 테스트 중 어느 것도 이 문구의 존재를 검증하지 않는다 — 기존 테스트 스타일(`assertIn("basename", ...)` 등)을 그대로 재사용할 수 있는 저비용 케이스인데 누락됐다.
  - 제안: `test_every_definition_flags_missing_forced_coverage` 같은 5번째 테스트를 추가해 세 파일 모두 "거짓 음성"(또는 등가 키워드, 예: "clean 으로 읽히면 안" / "거짓 음성") 문구를 포함하는지 확인.

- **[INFO]** 사용하지 않는 루프 변수 `kind` (다른 3개 테스트와의 네이밍 비일관)
  - 위치: `.claude/tests/test_summary_agent_contract.py:61` — `for agent, _wf, kind in PAIRS:`
  - 상세: 같은 파일의 다른 3개 테스트(39, 51, 71행)는 세번째 튜플 원소를 안 쓸 때 관례대로 `_kind` 로 언더스코어 처리했는데, `test_every_definition_tells_the_agent_to_persist_missing_files` 만 `kind` 로 바인딩해 두고 실제로는 참조하지 않는다. 기능 결함은 아니나 "일부러 안 쓴다"와 "쓰려다 빠뜨렸다"를 구분할 수 없게 만드는 사소한 가독성 저하이며 린터(pyflakes/ruff) 도입 시 경고 대상.
  - 제안: `_kind` 로 통일하거나, 원래 의도가 role별 문구 차별화였다면 assertion 메시지에 `kind` 를 실제로 사용.

- **[INFO]** 사용하지 않는 `from pathlib import Path` import
  - 위치: `.claude/tests/test_summary_agent_contract.py:21`
  - 상세: `REPO_ROOT`(→ `AGENTS`, `WORKFLOWS`)는 이미 `_harness.REPO_ROOT` 가 반환하는 `Path` 인스턴스의 `/` 연산으로 구성되며, 파일 내 어디에서도 `Path(...)` 를 직접 호출하지 않는다. Dead import.
  - 제안: 21행 제거.

- **[INFO]** prose(문구) 어설션이 `.claude/tests/README.md` 의 명시 컨벤션과 상충 — 예외 근거는 테스트 자체 docstring에 있으나 README 는 갱신되지 않음
  - 위치: `.claude/tests/test_summary_agent_contract.py:1-15`(정당화 docstring) vs `.claude/tests/README.md` "Conventions for new tests" 마지막 줄 "Assert **structural / behavioral invariants**, not prose. The `.md` agent definitions and docs are allowed to read differently from their SSOT." / `test_agent_consistency.py:12-19` "Design note — NOT a content/verbatim check... Prose checklist wording is deliberately left unguarded."
  - 상세: 이번 신규 테스트는 정확히 README가 하지 말라고 명시한 것(마크다운 prose의 리터럴 부분 문자열 검사)을 한다. 근거는 타당하다 — 이 3개 파일은 "다른 파일과 달리 런타임에 LLM이 그대로 읽는 system prompt이지 해설이 아니다"라는 논지가 테스트 파일 자체 docstring에 잘 설명돼 있다. 다만 README의 "Conventions for new tests" 절이 이 예외를 반영하지 않은 채 그대로 남아있어, 이후 기여자가 README만 보고 (a) 이 테스트를 "컨벤션 위반"으로 오인해 약화/삭제하거나, (b) 반대로 이 패턴을 "SSOT와 다르게 읽혀도 되는" 일반 문서(예: `test_agent_consistency.py`가 커버하는 파일들)에 잘못 복제할 위험이 있다.
  - 제안: `.claude/tests/README.md` 의 컨벤션 절에 한 줄 추가 — "단, 요약 에이전트 정의(`code-review-summary.md` 등)처럼 문서 자체가 런타임 system prompt인 경우는 예외 — `test_summary_agent_contract.py` 참조."

## 검증 수행 내역 (참고)

- `python3 -m unittest discover -s .claude/tests -p 'test_summary_agent_contract.py' -v` → 4 tests OK.
- `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` (하네스 전체) → **247 tests OK**, 회귀 없음.
- `.claude/workflows/{ai-review,consistency-check,merge-coordinate}.js` 실측 grep → `test_workflows_actually_send_what_the_definitions_expect` 가 기대하는 `누락 파일 영속화` / `inlineReports` 문자열이 실제로 존재함을 확인 (테스트가 허위로 통과하는 게 아님).
- repo 전역 `non-terminal` / `terminal(...)sub-agent 라` grep → 실제 소스(비-리뷰산출물) 중 남은 곳은 `.claude/workflows/_lib/agent-return.mjs` 뿐이며, 이 파일은 **정정된(올바른) 설명**을 담은 근거 원본(실측표 소스)이라 문제 없음. 이번 diff가 다루는 7개 파일 밖에 반증된 문구가 잔존하는 곳은 없음(review 산출물 텍스트 매치 제외).
- e2e 면제 판단(diff 전체가 `.claude/**` + `plan/**`) — `PROJECT.md` 96·97행 화이트리스트에 부합, 별도 e2e 불필요 확인.

## 요약

이번 변경은 순수 문서/시스템 프롬프트 정정(3개 sub-agent 정의 + 4개 command/SKILL 문서에서 반증된 "terminal 위치 때문에 write 가 막힌다" 설명을 "정확한 basename 규칙" 설명으로 교체)과, 그 재발을 막기 위한 신규 회귀 테스트(`test_summary_agent_contract.py`) 추가로 구성된다. 신규 테스트는 실제로 동작하며(4/4 통과, 하네스 전체 247/247 통과, 워크플로 JS 파일과의 양방향 계약까지 검증), 격리성·가독성·이름 규약(subTest 활용, 설명적 테스트명) 모두 양호하고 `.claude/agents/**`·`.claude/workflows/**` 경로가 CI 트리거에 포함돼 있어 향후 회귀 시 자동으로 걸린다. 다만 테스트 자신의 docstring이 "반증된 설명이 7개 파일에 복제됐었다"고 명시하는데도 `PAIRS` 는 3개 파일만 지켜 나머지 4개(`.claude/commands/*.md` 3개 + `merge-coordinator/SKILL.md`)는 동일 재발에 무방비이며, 그중 `.claude/commands/**` 는 CI 트리거 경로에도 없어 이중으로 안전망이 비어 있다. 이번 diff가 함께 추가한 "커버리지 누락을 clean 으로 읽지 말라"는 신규 안전 문구 역시 테스트로 고정되지 않았다. 두 건 모두 이 PR/plan 계열이 스스로 경계하는 "메커니즘 없는 prose 의무" 패턴을 부분적으로 재생산한 것이라 지적 가치가 있으나, 애플리케이션 런타임 코드에는 영향이 없는 문서 범위 이슈라 심각도는 낮다. 그 외 unused variable/import 등은 사소한 정리 대상이다.

## 위험도
LOW
