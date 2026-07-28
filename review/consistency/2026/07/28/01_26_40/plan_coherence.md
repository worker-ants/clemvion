# Plan 정합성 검토 — spec/5-system/ (impl-done)

## 조사 방법 메모

프롬프트 payload 의 `spec/5-system/` 발췌는 1-auth.md·10-graph-rag.md·11-mcp-client.md 만 담고
있었고(예산 초과로 18개 파일 생략 — `4-execution-engine.md` 포함), `plan/in-progress/` 발췌도
47개 파일이 생략돼 있었다. 실제 diff(`git diff origin/main...HEAD --stat`)를 직접 실측한 결과
이번 PR 은 **`spec/5-system/` 이하 파일을 전혀 건드리지 않는다** — 변경은
`codebase/backend/.../retry-turn.service.ts`(+spec)·`CHANGELOG.md`·신규
`plan/in-progress/retry-turn-terminal-guard.md`·`review/code/**/RESOLUTION.md` 뿐이다. 이는
node-cancellation 계열(선행 PR #1019~#1023)의 연속 작업이므로, payload 에 포함된 3개 spec
파일(auth/graph-rag/mcp-client)은 이번 diff 와 무관함을 확인했고, 실제 관련 target 은
`spec/5-system/4-execution-engine.md`(생략됐던 파일)라 절대경로로 직접 열어 확인했다. plan 쪽도
누락된 파일 중 `node-cancellation-residual-signal-propagation.md`·
`spec-update-node-cancellation-shutdown-classification.md`·`ie-resume-turn-boundary-cancel.md`
가 이번 diff 와 직접 연결돼 있어 각각 전문을 직접 읽었다.

## 발견사항

### [WARNING] `spec/5-system/4-execution-engine.md` 자기모순이 미정정 — plan 이 이미 식별한 project-planner 위임이 실행되지 않았다

- **target 위치**: `spec/5-system/4-execution-engine.md` §1.1 상태 전이표 줄 77(`failed → running` 행) + `### \`failed → running\` 재진입 전이` 산문 줄 1454.
- **관련 plan**: `plan/in-progress/retry-turn-terminal-guard.md` `## project-planner 위임 (developer 권한 밖)` 절의 "spec 자기모순 정정" 항목(미체크 `[ ]`).
- **상세**: 줄 77/1454(2026-06-06 작성)는 "replay 가 RUNNING 으로 도는 도중 도착한 cancel 은 **graceful no-op**"이며 "**park 없이 그 turn 에서 종결되면 cancel 은 무효과로 흘려보내진다**"고 서술한다. 그런데 같은 문서 줄 79-92(2026-07-27, `#1023` — node-cancellation 위임 #6/#7 반영으로 신설)는 "짝 전이는 방향과 무관하게 no-op 이 될 수 있다"며, 이미 terminal(예: CANCELLED)인 행에 대한 어떤 마감 쓰기 시도도 조건부 UPDATE 로 막혀 취소가 **항상 보존**됨을 규정한다 — 직접 두 구절을 읽어 실제 상충을 확인했다. 코드 근거: 바로 이번 PR(`retry-turn.service.ts::finalizeGuarded`, `git diff` 로 실측)가 `failRetryExecution`/`completeRetryExecution` 양쪽에 `canTransition` 기반 guarded UPDATE 를 적용해 replay 가 **park 없이** COMPLETED/FAILED 로 자연 종결하려 해도 이미 CANCELLED 인 행을 덮어쓰지 못하게 막는다 — 즉 코드는 신설 서술(줄 79-92)이 맞고, 줄 1454 마지막 문장은 stale/반증됨. 이 사실은 developer 가 plan 에 이미 정확히 적어 두었으나(project-planner 위임 항목) 아직 실행되지 않아 target 문서에는 반영되지 않았다. 방치 시 향후 독자가 stale 문장("park 없이 종결되면 취소는 흘려보내진다")을 근거로 이번에 추가된 guard 를 "의도와 어긋난다"고 오판해 되돌릴 위험도 있다.
- **제안**: project-planner 턴에서 (1) 줄 1454 마지막 문장을 §DB 관측 가드(줄 79-92) 서술과 정합하도록 정정하거나 명시적 각주로 예외 처리하고, (2) `spec/conventions/node-cancellation.md:184` §6 구현 현황 표에 `retry-turn.service.ts`(`finalizeGuarded`) 행을 추가한다(plan 이 이미 제안한 내용 그대로). `retry-turn-terminal-guard.md` 의 `[ ] /consistency-check --impl-done` 체크 전에 이 정정을 선행하거나 최소한 후속 plan 으로 명시 등재할 것.

### [WARNING] 이번 PR 이 해소한 결함이 origin plan(`ie-resume-turn-boundary-cancel.md`)의 열린 체크리스트 항목을 실질적으로 닫았는데 그 plan 문서 자체는 갱신되지 않았다

- **target 위치**: (spec 아님 — plan 간 정합성 이슈) `plan/in-progress/ie-resume-turn-boundary-cancel.md` "8차 라운드(최종)" 절 줄 502-504, 그리고 그 원문인 7차 라운드 INFO #8(줄 432-436).
- **관련 plan**: `plan/in-progress/ie-resume-turn-boundary-cancel.md` 의 미체크 항목 "`(diff 밖, 같은 결함 클래스) retry-turn.service.ts::failRetryExecution` — ... 별도 PR 로 `updateExecutionStatus` 재배선."
- **상세**: 이 항목은 정확히 지금 diff(`retry-turn-terminal-guard.md`)가 다루는 대상이다 — `failRetryExecution`과 (티켓엔 없었으나 실측으로 추가 발견된) `completeRetryExecution` 을 `finalizeGuarded`/`updateExecutionStatus` 경유 guarded 전환으로 재배선했고 5라운드 리뷰로 수렴했다. `CHANGELOG.md` 신규 항목 7번은 "추적: `ie-resume-turn-boundary-cancel.md` · `retry-turn-terminal-guard.md`" 로 두 plan 을 교차 언급하지만, **`ie-resume-turn-boundary-cancel.md` 자신의 체크리스트 줄은 여전히 `[ ]` 미체크이고 본문도 "별도 PR 로 재배선(할 것)"을 여전히 미완료 과제처럼 서술**한다 — 실제로는 그 "별도 PR" 이 이미 존재하고 완료됐다. 두 plan 문서가 서로를 직접 링크(파일명 언급)하지도 않는다 — grep 으로 양방향 0건을 확인했다(`retry-turn-terminal-guard.md` 에 `ie-resume-turn-boundary-cancel` 문자열 없음, 역방향도 없음). 이 저장소의 같은 계열 plan(`node-cancellation-residual-signal-propagation.md` 등)은 완료된 하위 작업을 상위/형제 plan 에서 명시 취소선·체크 처리해 온 관행이 있어, 이번 누락은 그 관행에서 벗어난다.
- **제안**: `ie-resume-turn-boundary-cancel.md` 의 해당 체크리스트 줄(502-504)을 `[x]` 로 갱신하고 "→ `retry-turn-terminal-guard.md` 로 해소(2026-07-27)" 주석을 추가한다. `retry-turn-terminal-guard.md` Overview 에도 origin 링크(`ie-resume-turn-boundary-cancel.md` 7차/8차 라운드 INFO #8)를 명시하면 양방향 추적이 완성된다.

### [INFO] project-planner 위임이 이 도메인의 확립된 단일 집계 문서가 아니라 개별 plan 파일에 분산돼 스윕 누락 위험

- **target 위치**: 해당 없음(plan 구조 이슈).
- **관련 plan**: `plan/in-progress/retry-turn-terminal-guard.md` `## project-planner 위임` 절 vs `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md`(`#1`~`#7` 누적 위임 문서, node-cancellation 계열의 사실상 단일 창구).
- **상세**: 같은 계열의 형제 plan(`node-cancellation-residual-signal-propagation.md` 등)은 project-planner 위임 사항을 전부 `spec-update-node-cancellation-shutdown-classification.md` 에 번호(#2~#7)를 매겨 누적해 왔고, project-planner 가 그 한 문서만 스윕하면 되는 관행이 확립돼 있다(문서 자신도 "**미결은 이 문서 최상단의 (a)/(b) 택일 결정뿐**"이라고 스스로를 유일 창구로 규정). 이번 PR 은 동일 유형(§1.1 spec 자기모순 정정)의 위임을 그 관행을 따르지 않고 `retry-turn-terminal-guard.md` 자체의 새 절에만 남겼다 — 다음 project-planner 턴이 집계 문서만 확인하면 이 항목을 놓칠 수 있다.
- **제안**: `spec-update-node-cancellation-shutdown-classification.md` 에 "#8" 로 교차 등재하거나, 최소한 그 문서 상단에 `retry-turn-terminal-guard.md` 로의 포인터를 추가한다.

## 확인했으나 충돌 없음으로 판정한 항목 (참고)

- `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` 최상단의 미해결
  (a)/(b) 택일 결정("SIGTERM/timeout 유발 abort 를 `cancelled`/`failed` 중 무엇으로 분류할지")은
  이번 PR 과 **무관**함을 코드로 확인했다 — `finalizeGuarded` 의 guard 는 상태 특정적 예외
  (CANCELLED 전용 등)가 아니라 범용 `canTransition`/`ALLOWED_TRANSITIONS` 상태머신을 그대로
  재사용하므로, 그 택일 결정이 나중에 어느 쪽으로 나든 이 PR 의 guard 로직에는 영향이 없다.
  target 이 이 미해결 결정을 우회하거나 선점하지 않았다.
- `plan/in-progress/execution-engine-residual-gaps.md`(G1 철회/G2 BLOCKED/G3 완료)는 이번 diff 와
  겹치지 않는다(G2 는 `shutdown-state.service.ts` 대상이고 이번 PR 은 `retry-turn.service.ts`
  전용).
- `spec/5-system/4-execution-engine.md` frontmatter 의 `pending_plans`(execution-engine-residual-gaps.md·exec-intake-followups.md)는 이번 PR 로 갱신할 필요가 없다 — retry-turn-terminal-guard.md 는
  spec-impl-evidence 의 "promised-but-unimplemented" 추적 대상이 아니라 버그 수정 + spec-drift
  교정 plan 이라 `pending_plans` 편입 대상이 아니다.

## 요약

이번 PR(`retry-turn-cancel-guard-ba75a2`)은 `spec/5-system/` 이하 파일을 직접 변경하지 않았고,
node-cancellation 계열(선행 PR #1019~#1023)의 연속 작업으로서 코드(`retry-turn.service.ts`)만
건드렸다. 자체 plan(`retry-turn-terminal-guard.md`)이 이례적으로 꼼꼼해(5라운드 리뷰, 근거 실측)
target 문서의 실제 자기모순(§1.1 줄 77/1454 vs 줄 79-92)을 스스로 짚어내고 project-planner 위임
항목으로 남겼으나, 그 정정 자체는 아직 실행되지 않았다 — 이것이 이번 검토의 핵심 WARNING 이다.
추가로 이번 PR 이 실질적으로 완결한 작업(`completeRetryExecution`/`failRetryExecution` guarded
전환)이 origin plan(`ie-resume-turn-boundary-cancel.md`)의 열린 체크리스트 항목을 무효화했는데,
그 plan 문서 자체는 갱신되지 않아 두 plan 사이의 상호 참조가 CHANGELOG 를 통해서만 간접적으로
성립한다. `spec-update-node-cancellation-shutdown-classification.md` 최상단에 여전히 열려 있는
(a)/(b) SIGTERM/timeout 분류 결정은 이번 PR 과 무관함을 코드로 직접 확인했고, target 이 그 미해결
결정을 우회하거나 선점하는 사례는 발견되지 않았다. 즉 CRITICAL 급의 "미해결 결정 우회"는 없으나,
두 건의 실질적인 후속 반영 누락(WARNING)이 확인된다.

## 위험도

MEDIUM
