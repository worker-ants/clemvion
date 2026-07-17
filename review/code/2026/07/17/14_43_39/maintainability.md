# 유지보수성(Maintainability) 리뷰

## 대상

`.claude/agents/{code-review-summary,consistency-summary,integration-risk-summary}.md`,
`.claude/commands/{ai-review,consistency-check,merge-coordinate}.md`,
`.claude/skills/merge-coordinator/SKILL.md`, `.claude/tests/test_summary_agent_contract.py`(신규),
`plan/complete/forced-coverage-gate.md`(신규), `plan/in-progress/harness-report-contract-followups.md`(신규)

## 발견사항

- **[WARNING]** 신규 회귀 테스트가 이번 diff 로 수정된 7개 파일 중 3개만 커버 — 나머지 4개는
  동일 결함(오류 설명 재유입)에 무방비
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/summary-agent-terminal-fix-253ab6/.claude/tests/test_summary_agent_contract.py:28-32` (`PAIRS` — `code-review-summary.md`/`consistency-summary.md`/`integration-risk-summary.md` 3개만 등록)
  - 상세: 이 diff 는 "SUMMARY.md Write 차단이 terminal 위치 때문" 이라는 반증된 설명을 총
    7개 파일에서 동일하게 고친다 — `.claude/agents/` 3개 + `.claude/commands/{ai-review,consistency-check,merge-coordinate}.md` + `.claude/skills/merge-coordinator/SKILL.md`. 그런데 신규
    회귀 테스트(`test_no_definition_still_blames_terminal_position` 등)는 `PAIRS` 에 등록된
    `.claude/agents/` 3개 파일만 `assertNotIn("non-terminal", ...)` 로 가드하고, 나머지 4개
    파일(`ai-review.md:16`, `consistency-check.md:17`, `merge-coordinate.md:35`,
    `merge-coordinator/SKILL.md:63`)은 어떤 테스트도 참조하지 않는다(레포 전체에서
    `grep -rln "ai-review.md\|consistency-check.md\|merge-coordinate.md" .claude/tests/*.py`
    결과 0건, 직접 확인함). 이 테스트 파일 자신의 docstring 이 "반증된 메커니즘이 이미 7개
    파일에 복제돼 있었다" 고 명시하는데, 가드는 그 7개 중 3개만 덮는다 — 나머지 4개가 향후
    (예: `subagent-call-contract.md §7` 갱신 시) 다시 "terminal 이라서" 식 설명으로 회귀해도
    테스트가 잡지 못한다.
  - 제안: `PAIRS`(또는 별도 리스트)에 4개 command/SKILL 파일을 추가해 동일한
    `assertNotIn("non-terminal", ...)` / `assertIn("basename", ...)` 불변식을 적용하거나,
    최소한 `plan/in-progress/harness-report-contract-followups.md` 항목 3(문서 hub 통합)의
    범위에 이 4개 파일이 포함되도록 명시한다.

- **[INFO]** 동일한 설명 단락이 7개 파일에 거의 그대로 중복 — 원인이 된 결함 패턴 자체는
  이번 diff 에서도 해소되지 않고 유지됨
  - 위치: `.claude/agents/code-review-summary.md:19`, `.claude/agents/consistency-summary.md:27`,
    `.claude/agents/integration-risk-summary.md:19` (블록쿼트 3종 — 예시 파일명만 다름),
    `.claude/commands/ai-review.md:16`, `.claude/commands/consistency-check.md:17`,
    `.claude/commands/merge-coordinate.md:35`, `.claude/skills/merge-coordinator/SKILL.md:63`
  - 상세: "하네스가 SUMMARY.md basename Write 를 어떤 sub-agent 에게도 허용하지 않고(terminal
    여부와 무관 — subagent-call-contract.md §7 실측표) ... 디스크 단일 진실의 유일한 경로가
    main 의 이 Write 다" 라는 동일 논지의 문장이 7곳에 손으로 복붙돼 있다(단어 선택만 미세하게
    다름). 이는 정확히 이번 fix 가 고치는 버그의 재발 경로(같은 문장이 여러 파일에 퍼져 있어
    하나가 바뀌면 나머지가 조용히 낡음)를 그대로 남긴다. `plan/in-progress/harness-report-contract-followups.md` 항목 3 이 유사한 중복(“subagent-call-contract.md / code-review-agents SKILL.md
    / consistency-checker SKILL.md”)을 후속으로 이미 추적하지만, 그 항목이 지목한 3개 파일
    집합과 이번 diff 에서 실제로 중복되는 7개 파일 집합은 일치하지 않는다 — 이번 7개 파일
    묶음이 그 후속 항목의 범위에 명시적으로 포함되는지 확인이 필요하다.
  - 제안: 설명 전문을 `subagent-call-contract.md §7`(이미 canonical 링크 대상) 한 곳에 두고,
    7개 파일은 한 줄 요약 + 링크만 남기는 리팩터링을 후속 item 3 범위에 명시적으로 편입.

- **[INFO]** 미사용 import
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/summary-agent-terminal-fix-253ab6/.claude/tests/test_summary_agent_contract.py:21`
  - 상세: `from pathlib import Path` 를 import 하지만 파일 전체에서 `Path` 를 직접 참조하는
    곳이 없다(`REPO_ROOT`/`AGENTS`/`WORKFLOWS` 는 이미 `_harness.REPO_ROOT` 가 반환하는
    `Path` 인스턴스의 연산 결과일 뿐, `Path(...)` 호출이나 `: Path` 타입힌트가 없음). 같은
    디렉터리의 다른 테스트(`test_agent_consistency.py:27`, `test_orchestrator_state.py:24`)는
    `Path` 를 타입힌트(`md_path: Path`, `cwd: Path | None`)로 실제 사용한다 — 이 파일만
    미사용으로 남아 있어 lint(예: 향후 ruff/flake8 도입 시 F401) 대상이 된다.
  - 제안: `from pathlib import Path` 제거.

- **[INFO]** 동일 파일 내 미사용 루프 변수 네이밍 불일치
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/summary-agent-terminal-fix-253ab6/.claude/tests/test_summary_agent_contract.py:61`
  - 상세: `test_every_definition_tells_the_agent_to_persist_missing_files` 의
    `for agent, _wf, kind in PAIRS:` 에서 `kind` 는 본문 어디서도 사용되지 않는데(assert 문
    2개 모두 `agent`/`text` 만 참조) underscore prefix 가 빠져 있다. 같은 파일의 다른 3개
    테스트(라인 41, 52, 74)는 동일하게 미사용인 세 번째 튜플 원소를 각각 `_kind`/`_kind`/
    `_agent`,`_kind` 로 일관되게 underscore-prefix 한다 — 이 한 곳만 관례를 벗어난다.
  - 제안: `kind` → `_kind` 로 통일.

- **[INFO]** 테스트 스위트 문서(`README.md`)가 신규 테스트를 반영하지 않음 + prose 미검사
  컨벤션과의 긴장 미설명
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/summary-agent-terminal-fix-253ab6/.claude/tests/README.md` ("What's covered" 표, 23-29행)
  - 상세: 기존 12개 테스트 파일은 전부 이 표에 한 줄씩 등록돼 있는데, 이번에 추가된
    `test_summary_agent_contract.py` 는 표에 없다(diff 에 `README.md` 변경분 없음). 또한
    같은 README 의 "Conventions for new tests" 절은 "Assert structural / behavioral
    invariants, not prose. The `.md` agent definitions ... are allowed to read differently
    from their SSOT" 라고 명시하고, `test_agent_consistency.py` 항목도 "does **not** police
    prose wording" 을 특징으로 적는다. 반면 신규 테스트는 정확히 한국어 prose 부분 문자열
    (`"basename"`, `"non-terminal"`, `"누락 파일 영속화"`, `"인라인"`)을 직접 검사한다 — 이
    파일 자신의 docstring 은 그 이유(system prompt 는 "commentary 가 아니라" 런타임에 읽히는
    실행 사양)를 잘 설명하지만, 그 예외가 README 의 일반 컨벤션 절에는 반영돼 있지 않아
    향후 기여자가 "prose 는 안 본다" 는 문구만 보고 이 테스트를 관례 위반으로 오인하거나
    약화시킬 수 있다.
  - 제안: README 표에 `test_summary_agent_contract.py` 행 추가 + "Conventions" 절에
    "summary-agent 정의 3종은 실행되는 system prompt 라 예외적으로 prose 를 검사한다" 한 줄
    각주 추가.

- **[INFO]** 후속 계획 문서에 주제가 다른 항목이 섞여 있음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/summary-agent-terminal-fix-253ab6/plan/in-progress/harness-report-contract-followups.md:58-65` (항목 5)
  - 상세: 문서 제목·배경은 "하네스 report-contract 후속"(report-path 공유, 리포트 내용 검증,
    문서 hub 정리, cross-session 테스트 — 전부 `.claude/hooks`·`.claude/skills` Python 로직)
    으로 일관되지만, 항목 5(`sidebar-nav-href.test.tsx`/`sidebar.test.tsx` mock 중복, 프론트엔드
    테스트 코드)는 완전히 다른 계층(frontend 테스트)의 이슈다. 문서 자신도 "미룬 이유: 본
    버그와 무관" 이라고 인정한다. 주제가 섞인 durable 앵커 문서는 항목 1-4(하네스 Python)가
    끝나 문서를 닫을 시점에 무관한 항목 5 때문에 종결이 애매해지거나, 반대로 frontend 작업자가
    이 문서를 찾지 못해 항목 5 가 누락될 위험이 있다.
  - 제안: 항목 5 를 별도의 frontend 전용 followups 문서(또는 기존 frontend 관련 in-progress
    plan)로 분리.

## 요약

이번 변경은 대부분 markdown 시스템 프롬프트/커맨드 문서와 신규 회귀 테스트로, 반증된 설명("SUMMARY.md
Write 차단은 terminal 위치 때문")을 실측에 기반한 정확한 설명("basename 정확 일치, terminal 무관")으로
교정하고 "인라인 전문 authoritative + 누락 파일 영속화" 절차를 3개 summary agent 에 일관되게 추가한
품질이 양호한 diff다. 3개 agent 파일 간 reviewer/checker/analyzer 치환이 정확히 병렬 유지되고, 절차
번호("5번 Write") 참조도 6단계로 재번호된 뒤에도 어긋남 없이 일치한다. 다만 이 diff 자체가 고치는
버그의 근본 원인(같은 설명 문단이 여러 파일에 복붙되어 하나가 바뀌면 나머지가 조용히 낡는 패턴)은
7개 파일 전부에 여전히 남아 있고, 신규 회귀 테스트는 그중 3개(`.claude/agents/*.md`)만 가드해 나머지
4개(`.claude/commands/*.md`, `merge-coordinator/SKILL.md`)는 동일 재발에 무방비다 — 가장 눈에 띄는
개선 여지다. 그 외에는 미사용 import, 미사용 루프 변수 네이밍 불일치, 신규 테스트 파일의 README 목록
미등록, 후속 계획 문서의 주제 혼재 등 경미한 정리 대상뿐이며 기능·구조적 결함은 없다.

## 위험도

LOW
