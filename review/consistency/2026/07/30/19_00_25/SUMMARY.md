# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 CRITICAL 0건. 다만 rationale_continuity 가 독자적으로 MEDIUM 판정한
"§1.1 짝 전이 불변식 서술 vs DB 가드층 FAILED opt-in 파라미터화" 공백은 실제로 이미 한 차례(8R,
`2ca44b769`) CRITICAL 로 발현된 이력이 있는 층간 이음매를 다루므로 우선 처리를 권고한다.

## 전체 위험도

**MEDIUM** — Critical 없어 BLOCK 은 불필요하나, 같은 "retry 재진입 opt-in 전파" 이음매를 가리키는
WARNING 3건(불변식 문서 공백/명명 불일치/plan 백로그 미승격)이 서로 다른 checker 에서 독립적으로
수렴해 실질적 재발 리스크를 구성한다.

## Critical 위배 (BLOCK 사유)

없음 — 5개 checker 전원 CRITICAL 0건.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity | §1.1 "짝 전이는 방향과 무관하게 no-op" 불변식 콜아웃이 이번 diff 가 도입한 FAILED-소스 opt-in 짝 전이(DB 가드층 "terminal" 정의가 `allowRetryReentry` 에 따라 파라미터화됨)를 반영하지 않음 — 동일 층간 이음매가 실제 8R CRITICAL(커밋 `2ca44b769`, "retry 재진입 짝 전이가 DB 가드에 막혀 절대 persist 되지 않던 결함")로 이미 발현된 전력이 있어 문서 공백이 재발 위험을 구조적으로 남김 | `spec/5-system/4-execution-engine.md` §1.1, 84-95행(2026-07-27 콜아웃, 이번 diff 로 미변경) | 같은 diff 가 추가한 79-80행 신규 표 행 + 1357-1413행 신규 Rationale; 자매 문서 `spec/conventions/node-cancellation.md` §2.4 "park↔resume 짝 전이 terminal 가드"(동일 간극) | §1.1 콜아웃 끝에 각주 추가: "예외(2026-07-30): `retry_last_turn` 재진입(`allowRetryReentry` opt-in) 에 한해 FAILED 소스 행도 조건부로 잠금 대상에 포함된다(`NON_TERMINAL_OR_FAILED_STATUSES_SQL`) — 이 opt-in 을 state-machine 쪽에만 반영하면 8R CRITICAL 이 재발한다." `node-cancellation.md` §2.4 에도 상호참조 각주 병기 |
| 2 | naming_collision | retry 재진입 opt-in 플래그가 계층마다 다른 이름을 씀 — orchestrator 계층 `retryReentry` vs driver/state-machine 계층 `allowRetryReentry`. 이 이름 불일치가 10R CRITICAL(커밋 `3c306d593`, "opts→DB가드 번역 seam 무검증")의 근본 원인 중 하나였고, 버그 자체는 고쳐졌으나 다음 소비처 추가 시 동일 클래스 재발 여지가 명명 차원에 남음 | `ai-turn-orchestrator.service.ts` `opts?: { retryReentry?: boolean }` (`processAiResumeTurn:220`, `reparkAiResumeTurn:442`, `finalizeAiNode:1437`) | `state-machine.ts:57`(`TransitionOptions.allowRetryReentry`), `engine-driver.interface.ts`, `execution-engine.service.ts` 의 `allowRetryReentry` (같은 개념의 다른 이름) | 두 계층 property 이름을 `allowRetryReentry` 로 통일하거나, 번역 지점(`:223-224`, `:457`, `:1439`)에 "계층마다 이름이 의도적으로 다르다" 앵커 주석 추가. #1 과 같은 근본 이음매이므로 함께 처리 권장 |
| 3 | plan_coherence | 8R/9R ai-review 라운드의 WARNING 3건이 plan 마스터 백로그(#1~#34)에 승격되지 않음: 9R W1(재-park 로 도달 가능해진 stale `error`/`finishedAt`/`durationMs` 미정리, 마스터 #5 는 COMPLETED 시나리오만 커버), 9R W2(동시 재진입 소유권 모호성, 대응 항목 0건), 8R W2(`spawnedId` null-invariant 방어분기 미검증, 현재도 테스트 0건). 두 세션(`12_56_04`=8R, `15_33_04`=9R) 모두 `RESOLUTION.md` 부재 | `spec/5-system/4-execution-engine.md` §7.4/§7.5 (이번 diff 가 구현·문서화한 영역) | `plan/in-progress/retry-turn-terminal-guard.md` 마스터 코드 표(#1~#34) — 8R/9R 라운드 섹션·RESOLUTION.md 부재 | 마스터 표에 9R W1/9R W2/8R W2 3건 반영 + `review/code/2026/07/30/{12_56_04,15_33_04}/` 에 사후 `RESOLUTION.md`(또는 최소 plan 섹션) 작성 |
| 4 | cross_spec | `data-flow/3-execution.md` §3.1 Execution 상태 Mermaid 다이어그램이 신규 `failed → waiting_for_input` 전이("multi-turn 재진입에서 가장 흔한 경로")를 누락 — 이 다이어그램만 보는 독자는 `failed` 이후 유일한 비-종결 경로가 `running` 뿐이라고 오인 | `spec/5-system/4-execution-engine.md` §1.1 신규 전이표 행 + §7.5 신설 Rationale | `spec/data-flow/3-execution.md` §3.1 `stateDiagram-v2`(라인 241-258) + 라인 269 설명 문단 | 다이어그램에 `failed --> waiting_for_input: reparkAiResumeTurn 재진입 turn 계속 (opt-in allowRetryReentry)` edge 추가 + 라인 269 에 동일 opt-in 문구 병기 |
| 5 | cross_spec | AI Agent 노드 스펙 §7.9 "재진입 종결 후 graph 진행" 단락이 같은 파일 §12.8 신설 콜아웃(재진입 turn 이 계속되는 경우엔 종결 서술이 적용되지 않음)과 동기화되지 않아, 같은 문서 안에서 두 절이 서로 다른 완결성을 주장 | `spec/4-nodes/3-ai/1-ai-agent.md` §12.8 상단 신설 콜아웃 | 같은 파일 §7.9 "재진입 종결 후 graph 진행" 단락(라인 989, 이번 PR 미갱신). §7.9 는 타 spec 4곳이 앵커 인용(파급은 제한적) | §7.9 앞에 §12.8 과 동일한 "재진입 turn 이 계속되는 경우" 콜아웃(또는 최소 포인터) 추가 |
| 6 | convention_compliance (cross_spec 도 동일 사실을 INFO 로 독립 지적 — 등급 통합) | `node-output.md` §4.2.1 "보존 예외" 표가 `_retryState` 의 영속 위치를 `NodeExecution.outputData` 단 하나로 못박아, 이번 diff 가 신설한 2차 용법(spawn row `inputData._retryState`, delivery-claim 마커)을 반영하지 못함 — "`_retryState` 는 outputData 에만 존재" 단언이 더 이상 완전하지 않음 | `spec/5-system/4-execution-engine.md` 신설 Rationale "retry 재진입의 원자 claim"(1357행, 특히 1378-1384행 SQL) | `spec/conventions/node-output.md` §4.2.1 표(200-212행, 208행이 단일 위치 명시) | 표에 각주 추가: "spawn 된 재진입 row 의 `inputData._retryState` 는 별개 용도(2차 delivery-claim 마커) — [실행 엔진 §Rationale] 참조" 또는 "영속 위치" 열 자체를 완화 |
| 7 | plan_coherence | 이번 consistency-check 세션(`19_00_25`) 자체가 harness 컨텍스트 예산초과로 실제 target(`4-execution-engine.md`, `6-websocket-protocol.md`)을 프롬프트에서 누락한 채 시작 — 5개 checker 프롬프트 전원이 사전순 정렬로 무관 파일 3개(`1-auth.md`/`10-graph-rag.md`/`11-mcp-client.md`)만 받음. 이미 추적 중인 결함의 8번째 이상 재발 | 이 세션의 checker 프롬프트 번들(`spec/5-system/`, `plan/in-progress/**`) | `plan/in-progress/harness-review-gate-ci-backstop.md` "재발 관측(2026-07-28) — 6번째/7번째" 절 | 위 plan 문서에 오늘(세션 `19_00_25`) 재발 기록 추가. (완화: 5개 checker 전원이 워크트리 직접 Read + `git diff` 로 우회 확인을 완료해, 이번 세션 결론 자체의 신뢰성에는 영향 없음) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | `spec/data-flow/3-execution.md` "폐기된 서술" 목록의 `recoverStuckExecutions` 관련 문구가 PR3(2026-07-04, case-B re-drive 전환) 이후 기준으로 부분적으로 낡음(node_execution 정리를 "수행 안 함"이라 단언하나 실제로는 case-B 진입 시 한정 수행). 2026-07-30 12:38 세션도 동일 지적, "필수 아님"으로 분류돼 이번까지 미반영 상태 지속 | `spec/data-flow/3-execution.md` `## Rationale` "폐기된 서술" 목록 (이번 diff 스코프 밖) | project-planner 가 다음에 이 계열 spec 을 손볼 때 "node_execution 정리는 case B re-drive 진입 시 크래시 시점 구 RUNNING row 에 한해 수행한다" 로 갱신 검토 |
| 2 | naming_collision | 인접한 두 Rationale 절 제목이 "원자 claim" 문구를 공유(신설 "retry 재진입의 원자 claim" vs 기존 "재개 race 보장을 DB 원자 claim 으로") — 앵커 slug 충돌은 없고 본문도 명확히 구분되나, 목차만 훑으면 같은 절의 연속처럼 보일 소지 | `spec/5-system/4-execution-engine.md:1357`(신설) vs `:1415`(기존, 미변경) | (선택) 신설 절 제목에 "2차"/"spawn-row" 구분어 추가. 가독성 제안이며 target 결함 아님 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | `data-flow/3-execution.md` 다이어그램의 신규 전이 누락 + AI Agent §7.9/§12.8 콜아웃 미동기화 |
| rationale_continuity | MEDIUM | §1.1 불변식 콜아웃이 DB 가드층 FAILED opt-in 파라미터화를 미반영 — 실제 8R CRITICAL 로 발현된 이음매의 문서 공백 |
| convention_compliance | LOW | `node-output.md` §4.2.1 `_retryState` 영속 위치 레지스트리가 신규 2차 용법(spawn row `inputData`) 미반영 |
| plan_coherence | LOW | 8R/9R WARNING 3건 마스터 백로그 미승격(+RESOLUTION.md 부재) / 이번 세션 harness 예산초과 재발(8번째 이상) |
| naming_collision | LOW | retry opt-in 플래그 계층간 명명 불일치(`retryReentry` vs `allowRetryReentry`) — 10R CRITICAL 근본원인과 직결 |

## 권장 조치사항

1. (최우선 — MEDIUM 근거 해소) `spec/5-system/4-execution-engine.md` §1.1 콜아웃(84-95행)에 FAILED opt-in 파라미터화 예외 각주 추가 + `spec/conventions/node-cancellation.md` §2.4 에 상호참조 각주 병기. (WARNING #1)
2. retry 재진입 opt-in 플래그명을 `allowRetryReentry` 로 통일하거나, 계층간 명명 차이를 밝히는 앵커 주석을 번역 지점에 추가 — #1 과 동일한 이음매이므로 함께 처리. (WARNING #2)
3. `data-flow/3-execution.md` §3.1 다이어그램에 `failed → waiting_for_input` edge 추가. (WARNING #4)
4. `1-ai-agent.md` §7.9 에 §12.8 과 동일한 "재진입 turn 이 계속되는 경우" 콜아웃 추가. (WARNING #5)
5. `node-output.md` §4.2.1 표에 `_retryState` 2차 용법(spawn row `inputData`) 각주 추가. (WARNING #6)
6. `plan/in-progress/retry-turn-terminal-guard.md` 마스터 표에 9R W1/9R W2/8R W2 반영 + 해당 두 세션에 사후 `RESOLUTION.md`(또는 최소 plan 섹션) 작성. (WARNING #3)
7. `plan/in-progress/harness-review-gate-ci-backstop.md` 에 오늘 세션(`19_00_25`) 재발 기록 추가. (WARNING #7)
8. (낮은 우선순위) `data-flow/3-execution.md` "폐기된 서술" 문구를 PR3 이후 기준으로 갱신, 인접 Rationale 절 제목에 구분어 추가. (INFO #1, #2)