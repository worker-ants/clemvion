---
title: 하네스 report-contract 후속 — 경로 로직 공유·내용 검증·문서 hub 정리
worktree: (unstarted)
started: 2026-07-17
owner: developer
status: in-progress
---

## 배경

PR #958 → #960 → #962 로 이어진 "하네스 report 계약" 작업에서 **의도적으로 미룬** 항목의
durable 앵커. 각 PR 의 RESOLUTION 에 근거가 있으나 그 문서는 세션 산출물이라, 선행 plan 이
`complete/` 로 가면 추적이 끊긴다 — 그래서 여기로 이관한다.

선행: `plan/complete/forced-coverage-gate.md`, `plan/complete/harness-workflow-contract-fix.md`

## 1. report-path 해석 3곳 완전 공유 (#962 W5)

같은 규칙("세션 디렉토리 + `output_file` basename 재anchor")이 3곳에 독립 구현돼 있다:

- `.claude/hooks/_lib/review_guard.py` `_forced_coverage_missing()` — push/stop 게이트
- `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py` `_report_paths()`
- `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` `_report_paths()`

**두 강제 지점(가드·CLI)이 공유해야 하는 핵심 로직**이라 파일명 규칙이 바뀌면 판정이 조용히
어긋난다. 현재는 각 docstring 의 "change both" 상호 참조로만 묶여 있다.

- 제약: `.claude/skills/_lib`(project_config) 와 `.claude/hooks/_lib` 가 **같은 `_lib` 이름을
  두고 충돌**해 한 인터프리터에서 공존 못 한다 (`test_orchestrator_state.py` 헤더에 기록된
  기존 제약). 그래서 단순 import 로는 해결되지 않는다.
- [ ] 패키지 네이밍 정리 또는 제3의 공용 모듈 위치 결정 후 3곳 통합

## 2. 리포트 **내용** 검증 (#962 W7 심화)

현재 커버리지 판정은 "파일이 존재하고 **비어있지 않음**" 까지다(`touch security.md` 는 막힘).
리뷰어 제안은 최소 구조 검증(섹션 헤더 등)까지.

- 트레이드오프: 구조를 강제하면 리포트 포맷이 고정돼 reviewer 출력 형식 변경이 어려워진다.
- [ ] 최소 구조(예: `## 발견사항` 존재) 강제가 값어치 있는지 판단 → 필요 시 적용

## 3. 하네스 Write 차단 설명의 손복사 → hub canonical (#962 INFO#5 · #963 INFO#1)

같은 설명 문단이 **손으로 복붙되어 하나가 바뀌면 나머지가 조용히 낡는** 패턴. 실제로 반증된
"terminal 이라서 차단" 설명이 **8개 파일**에 복제돼 있었고(#963 에서 일괄 정정), `test_summary_
agent_contract.py` 는 그 재유입만 막을 뿐 **중복 자체는 그대로**다.

대상 파일 집합 (정정 시점 실측):

| 파일 | 성격 |
|---|---|
| `.claude/docs/subagent-call-contract.md` §7 | **SoT (실측표)** — hub 후보 |
| `.claude/agents/{code-review,consistency,integration-risk}-summary.md` | 런타임 system prompt |
| `.claude/agents/review-router.md` | 런타임 system prompt |
| `.claude/commands/{ai-review,consistency-check,merge-coordinate}.md` | slash command 절차 |
| `.claude/skills/{code-review-agents,consistency-checker,merge-coordinator}/SKILL.md` | 절차 SoT |
| `.claude/workflows/_lib/agent-return.mjs` 헤더 + 3 워크플로 미러 | 코드 주석 |

- [ ] `subagent-call-contract.md §7` 을 canonical 로 두고 나머지는 **요약 1줄 + 링크**만 남기기
- [ ] 단 **런타임 system prompt(agents/**)는 예외 검토** — 에이전트는 링크를 따라가지 않으므로
      행동을 바꾸는 문구는 인라인이어야 할 수 있다. 이 구분이 이 항목의 실질 난점이다.

## 4. cross-session `_newest_resolved_review_mtime` 통합 테스트 (#962 INFO#7)

"가장 최신 resolved 리뷰 선택" 로직이 전부 mock 이라, forced 게이트의 핵심 안전 논거
(**미충족 세션은 빠지고 더 최신의 충족 세션이 통과**)를 검증하는 실 파일 테스트가 없다.
`01_27_10`(미충족) → `08_17_35`(충족) 실사례가 정확히 이 모양.

- [ ] 미충족·충족 세션 2개를 tempdir 에 구성한 통합 테스트 1건

## 5. sidebar 테스트 mock 보일러플레이트 공유 헬퍼 (#958 W#4)

`sidebar-nav-href.test.tsx` 와 `sidebar.test.tsx` 가 ~100줄 mock 설정을 중복 보유.
`Sidebar` 의존성이 바뀌면 두 파일을 동시에 고쳐야 한다.

- 미룬 이유: 공유 헬퍼 추출은 본 버그와 무관한 기존 `sidebar.test.tsx` 를 함께 건드려야 해
  같은 리뷰의 "범위 오염" 지적과 상충했다.
- [ ] `sidebar-test-utils.ts`(mock 팩토리 + `renderSidebar`)로 추출
