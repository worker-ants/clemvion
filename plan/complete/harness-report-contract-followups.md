---
title: 하네스 report-contract 후속 — 경로 로직 공유·내용 검증·문서 hub 정리
worktree: report-paths-shared-0edbf0
started: 2026-07-17
owner: developer
status: complete
# `codebase/frontend/src/components/layout/**` 는 spec/2-navigation/_layout.md 의 `code:`
# glob 에 매칭되지만(변경 파일 3개는 그 아래 `__tests__/**`), 본 PR 은 assertion·동작 변경
# 없는 순수 mock/setup 추출 리팩터(vitest 11/11 동일 통과 재확인)라 spec 갱신 불필요.
spec_impact: none
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

- [x] **완료** — `.claude/_shared/report_paths.py` 신설, 세 곳이 사용.

> **"`_lib` 충돌로 공유 불가" 는 과장이었다 (정정)**: 프로덕션엔 충돌이 없다 — hooks 와
> orchestrator 는 **별개 프로세스**라 한 인터프리터에 공존하지 않는다. 충돌은 **테스트 프로세스
> 한정**이고 `_harness.load_module_by_path` 라는 확립된 탈출구가 이미 있었다. 워크플로(#960)는
> `import()` 자체가 막혀 정말로 불가능했지만 Python 은 된다 — 그 선례를 여기 적용하는 건
> "가능한데 안 하는 것" 을 선례로 포장하는 셈이었다.
>
> **드리프트는 가설이 아니라 이미 발생해 있었다**: 같은 빈 리포트를 `--verify-coverage` 는
> OK, `review_guard` 는 차단으로 판정했다(#962 에서 가드에만 `getsize>0` 을 넣고 CLI 는 안 고침).
> "change both" 주석을 달아뒀는데 **바로 다음 PR 에서 내가 어겼다.**

## 2. 리포트 **내용** 검증 (#962 W7 심화) — **won't-do (근거 있음)**

- [x] 판단 완료 → **채택하지 않는다.** 현행 "비어있지 않음" 에서 멈춘다.

실측(커밋된 리포트 4763개):

| 섹션 | 포함 비율 |
|---|---|
| `## 발견사항` | 97% |
| `## 위험도` | 98% |
| `## 요약` | 98% |

구조를 강제하면 **정상 리포트 ~130개(2~3%)를 거부**한다. 이건 게이트다 — 2~3% 오탐은
"CLI 는 OK 인데 push 가 막힌다" 를 상시화하고, 사람이 가드를 우회할 이유를 만든다.
그 대가로 얻는 건 이미 "비어있지 않음" 이 막고 있는 `touch` 공격의 약간 정교한 변종뿐이다.
게다가 섹션 헤더를 강제하면 reviewer 출력 포맷이 고정돼 그 자체가 새 제약이 된다.

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

- [x] **완료 — 이미 충족돼 있었다 (실측).** #963 이 "terminal" 오기를 일괄 정정하면서 각 문서를
      **§7 링크 + 1~2회 짧은 언급**으로 줄였다. 실측: commands 3개 각 `basename` 1회,
      SKILL 3개 각 1~2회 — 목표한 "요약 + 링크" 상태다. 장문 재서술은 남아있지 않다.

> **런타임 system prompt(`agents/**`)는 의도적 예외로 유지.** 에이전트는 링크를 따라가지
> 않는다 — 행동을 바꾸는 문구(어떤 파일은 쓸 수 있고 어떤 건 못 쓰는지)는 인라인이어야
> 실제로 읽힌다. 대신 `test_summary_agent_contract.py` 가 8개 파일의 재유입을 막으므로,
> 이 중복은 **기계적으로 고정된 중복**이지 방치된 drift 표면이 아니다.
> 코드 쪽 중복(`_lib/agent-return.mjs` ↔ 3 워크플로 미러)도 같은 성격 —
> `test_workflow_scripts.py` 가 drift 시 build fail.

## 4. cross-session `_newest_resolved_review_mtime` 통합 테스트 (#962 INFO#7)

- [x] **완료** — `test_forced_coverage_selection.py` (7건). 실 세션 디렉토리로 검증:
      미충족 세션 제외 · 더 최신 충족 세션이 통과(01_27_10→08_17_35 실사례 모양) ·
      순서 무관("newest **resolved**") · 빈 리포트가 세션을 구제하지 못함 · dirty RESOLUTION
      mtime 접힘. **전면 적용(grandfather 없음)의 안전 논거가 이제 mock 이 아니라 실측으로
      뒷받침된다.**

## 5. sidebar 테스트 mock 보일러플레이트 공유 헬퍼 (#958 W#4)

`sidebar-nav-href.test.tsx` 와 `sidebar.test.tsx` 가 ~100줄 mock 설정을 중복 보유.
`Sidebar` 의존성이 바뀌면 두 파일을 동시에 고쳐야 한다.

- [x] **부분 완료 (한계 기록)** — `sidebar-test-utils.tsx` 로 `stubMatchMedia`·`createWrapper`·
      `renderSidebar` 추출. 두 파일에서 ~30줄씩 제거.

> **`vi.mock` 팩토리는 추출할 수 없다 (실측).** vitest 는 모든 `vi.mock` 을 파일 import 위로
> 호이스팅하므로, 헬퍼에서 import 한 팩토리는 mock 실행 시점에 아직 초기화되지 않았다 —
> `ReferenceError: Cannot access '__vi_import_1__' before initialization`. 문서화된 우회는
> **팩토리마다 `await import()`** 인데, 중복 ~100줄을 간접성 ~50줄 + 더 미묘한 init 순서로
> 바꿀 뿐이라 채택하지 않았다. `Sidebar` 의존성이 늘면 두 파일 모두 `vi.mock` 을 추가해야
> 하는 비용은 **vitest 호이스팅이 부과하는 것이지 리팩터 누락이 아니다.**

## 종결 (2026-07-17)

5건 전부 처분 완료 — 2건 구현(§1·§4), 1건 부분+한계 기록(§5), 2건 근거 있는 종결(§2 won't-do,
§3 이미 충족). **미룬 항목 없음.**

가장 값진 소득은 §1 을 하다 발견한 것이다: "제약이라 못 한다" 고 두 번 인용해온 `_lib` 충돌이
실은 테스트 프로세스 한정이었고, 그 사이 **드리프트가 이미 실제로 발생**해 있었다
(`--verify-coverage` OK vs `review_guard` 차단). 상호 참조 주석은 바로 다음 PR 에서 깨졌다 —
주석은 메커니즘이 아니다.
