# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원이 성공적으로 실행되고 전문을 확보했다(재시도 필요 항목 없음). CRITICAL 로 분류된 위배는 없다. 다만 4/5 checker 가 독립적으로 수렴한 spec 자기모순(WARNING #1)이 있어 project-planner 후속 조치를 권고한다.

## 전체 위험도
**MEDIUM** — 이번 diff(`retry-turn.service.ts::finalizeGuarded` 신설, `spec/` 변경 0줄) 자체의 코드 정합성은 5개 checker 모두 위반 없음으로 확인했다. 위험의 실체는 코드가 아니라 문서다: `spec/5-system/4-execution-engine.md` §1.1 이 **같은 문서의 최신 절(#1023, 2026-07-27)·자매 컨벤션(`node-cancellation.md §2.4`)·이 기능 최초 도입 시점부터의 `6-websocket-protocol.md:375` 서술** 과 정반대로, "retry replay 가 park 없이 종결되면 cancel 은 무효과로 흘려보내진다"는 이제는 반증된 옛 결정을 여전히 단언하고 있다 — 이를 4개 checker(cross_spec/rationale_continuity/convention_compliance/plan_coherence)가 서로 다른 각도에서 독립적으로 짚어냈다. rationale_continuity 는 이 클래스의 결함(Stop 이 조용히 소실)이 최근 3 PR(#1021~#1023) 연속 재발한 이력을 근거로 HIGH 를 매겼다. 다행히 code 자체는 이미 옳은 (신) invariant 를 구현했고, 이 모순은 developer 가 스스로 `plan/in-progress/retry-turn-terminal-guard.md` 에 project-planner 위임으로 이미 기록해 두었다(단 아직 미실행, 그리고 아직 어떤 project-planner 집계 문서에도 정식 등재되지 않음). 즉석 BLOCK 사유는 아니지만 방치 시 재발 위험이 실질적이라 MEDIUM 으로 판정한다.

## Critical 위배 (BLOCK 사유)

없음 — 5개 checker 전원이 CRITICAL 등급 위배를 보고하지 않았다.

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| — | — | 해당 없음 | — | — | — |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, rationale_continuity, convention_compliance, plan_coherence (4개 독립 수렴) | `4-execution-engine.md` §1.1 이 "retry replay 가 park 없이 종결되면 cancel 은 무효과로 흘려보내진다"고 서술 — 이는 같은 문서 최신 절·자매 문서·원 기능 도입 서술·현재 코드/테스트 4가지 모두와 정반대다 | `spec/5-system/4-execution-engine.md` §1.1 상태 전이표 77행(`failed→running`) + Rationale "`failed → running` 재진입 전이" 1454행 (둘 다 2026-06-06/10 작성, 이후 미갱신) | (a) 같은 파일 79~92행 "짝 전이 DB 관측 가드"(2026-07-27, `#1023`), (b) `spec/conventions/node-cancellation.md` §2.4 + Rationale, (c) `spec/5-system/6-websocket-protocol.md:375`("replay 중 cancel" — 2026-05-30 원 기능 도입 시점부터의 서술), (d) 이번 PR 코드 `finalizeGuarded`+회귀 테스트(`retry-turn.service.spec.ts:789,805`) | project-planner 턴에서 77행/1454행의 "park 없이 종결되면 cancel 무효과" 서술을 삭제하고 "DB 에 이미 커밋된 cancel 은 park 도달 여부와 무관하게 항상 우선하며 자연 종결은 guarded 쓰기로 스킵된다"로 정정(81~92행 문구 재사용 가능). `spec-update-node-cancellation-shutdown-classification.md` 에 신규 위임 항목(#8)으로 등재 — 이 모순은 아직 어떤 project-planner 추적 문서에도 정식 등재돼 있지 않다(rationale_continuity 확인) |
| 2 | cross_spec, rationale_continuity, convention_compliance, plan_coherence (4개 독립 수렴) | `node-cancellation.md` §6 구현 현황 표 + frontmatter `code:` 목록이 §2.4 가드의 3번째 소비자(`retry-turn.service.ts`)를 반영 못함 — 계층 책임 서술이 코드보다 좁음 | `spec/conventions/node-cancellation.md` §6 표 184행 부근(`execution-engine.service.ts` 만 나열) + frontmatter `code:`(4~13행, 명시적 파일 나열) | `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`(`finalizeGuarded`, `completeRetryExecution`/`failRetryExecution` 소비). 두 구현의 메커니즘도 다름 — 기존은 `??` 앱레벨 병합, 신규는 SQL `COALESCE`(cross_spec 추가 근거) | §6 표에 `retry-turn.service.ts`(`finalizeGuarded`) 행 추가 + frontmatter `code:` 등재 + `COALESCE` vs `??` 메커니즘 차이 각주. WARNING #1 과 동일 project-planner 위임 항목(plan 최하단)에 이미 등재돼 있어 함께 처리 가능 |
| 3 | plan_coherence | 이번 PR 이 실질적으로 완결한 작업(`failRetryExecution`/`completeRetryExecution` guarded 전환)이 origin plan 의 열린 체크리스트 항목을 무효화했는데 그 plan 문서 자체는 갱신되지 않음 — 양방향 상호참조 0건(grep 확인) | `plan/in-progress/ie-resume-turn-boundary-cancel.md` "8차 라운드(최종)" 502~504행(원문 7차 라운드 INFO #8, 432~436행) — 여전히 `[ ]` 미체크, 본문도 "별도 PR 로 재배선(할 것)"을 미완료 과제처럼 서술 | `CHANGELOG.md` 신규 항목 7번(양쪽 plan 을 교차 언급하나 plan 문서끼리는 서로를 링크하지 않음), 이번 PR `retry-turn-terminal-guard.md` | 502~504행 체크리스트를 `[x]` 로 갱신 + "→ `retry-turn-terminal-guard.md` 로 해소(2026-07-27)" 주석 추가. `retry-turn-terminal-guard.md` Overview 에도 origin 링크 명시해 양방향 추적 완성 |
| 4 | convention_compliance | `retry-turn-terminal-guard.md` frontmatter `spec_impact: none` 이 본문(project-planner 위임으로 spec 정정 필요를 스스로 명시)과 자기모순 — plan 이 `complete/` 로 이동 시 Gate C(`spec-plan-completion.test.ts`)가 이 필드를 그대로 신뢰해 "spec 영향 없음"이 잘못 확정될 위험 | `plan/in-progress/retry-turn-terminal-guard.md` frontmatter `spec_impact: none` | 같은 파일 본문 "project-planner 위임(developer 권한 밖)" 절(spec 정정 요청) | plan 완료 처리 전에 `spec_impact` 를 `none` 에서 `spec/5-system/4-execution-engine.md`, `spec/conventions/node-cancellation.md` 목록으로 갱신 |
| 5 | cross_spec | `failRetryExecution` CANCELLED 분기가 emit 하는 `execution.cancelled` WS 페이로드에 `cancelledBy` 필수 필드 누락 (pre-existing — 이번 diff 가 그 라인을 손댔으나 갭을 새로 만든 것은 아님) | `retry-turn.service.ts` `failRetryExecution` 의 `eventEmitter.emitExecution(executionId, EXECUTION_CANCELLED, { status: finalStatus })` 호출 | `spec/5-system/6-websocket-protocol.md` §4.1(179행) — `cancelledBy: 'user'\|'system'\|'timeout'` 필수 닫힌 union. 다른 모든 `EXECUTION_CANCELLED` emit 경로는 `emitCancellationEvent` 헬퍼로 이 필드를 채우는데 이 경로만 미사용 | `failRetryExecution` 도 `emitCancellationEvent`(또는 동등 헬퍼) 재사용하도록 developer 후속 등재. 이미 `retry-turn-terminal-guard.md` 5R 섹션에 W1 로 등재·defer 됨 — 이번 검토는 spec 계약 위반이라는 사실을 재확인하는 역할 |
| 6 | naming_collision | consistency-check 하네스의 `--impl-done` 번들링이 이번 PR 의 실질 SoT(`spec/5-system/4-execution-engine.md`)를 컨텍스트 예산 초과로 통째로 누락시킴 — `target_path` 가 디렉터리 단위(`spec/5-system/`)로 해석되고 파일명이 문자열 사전순(`"1"<"2"<"4"`) 정렬되어 두 자리 번호 파일(`10-`,`11-`)이 먼저 실려 예산을 소진, 한 자리 번호의 실제 대상 파일이 뒤로 밀림. 5개 checker 전원이 이 문제를 겪고 절대경로 직접 Read 로 우회 | consistency-check 오케스트레이터/harness (이 PR 범위 밖 — target 코드 아님) | `spec/5-system/4-execution-engine.md`(정작 CHANGELOG 가 SoT 로 지목한 파일) | harness 유지보수: (a) code diff 가 매칭하는 spec frontmatter 파일을 디렉터리 전체보다 우선 포함, (b) 파일명 선행 숫자 기준 natural sort 채택, (c) 생략 목록에 비-경로 문자열(`_selectedPort`/`$trigger`/`$env`) 혼입 경로 점검. 이번 PR 자체 조치는 불요(모든 checker 가 실측으로 우회해 결론에 영향 없음을 확인) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | naming_collision | 실제 diff 의 유일한 신규 식별자 `finalizeGuarded`(private 메서드) — 기존 사용처·형제 메서드(`finalizeCancelledExecution` 등, 다른 클래스)와 이름 충돌 없음. 테스트의 `FinalizeSubject` 타입 재사용도 block-scope 격리되어 기존 컨벤션과 일관 | `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:437` | 조치 불요 |
| 2 | rationale_continuity | `finalizeGuarded` 는 기각된 대안(R2 `waiting_for_retry` 신설)을 재도입하지 않음. choke-point(`updateExecutionStatus`) 우회는 §7.5 "재개 race 보장을 DB 원자 claim 으로" Rationale 이 이미 세운 선례의 연장이라 원칙 위반 아님 | `4-execution-engine.md` Rationale §7.5(1354행)/R2(1412행) | 조치 불요 — 준수 확인 |
| 3 | convention_compliance | `spec/5-system/*.md` 전반의 "Overview" 표제 표기 불균일(`## Overview` vs `## 1. 개요` vs 없음) — SKILL.md 의 "권장"(MUST 아님) 조항, 이번 PR 과 무관한 기존 상태 | `spec/5-system/` 디렉터리 전체 | 시급하지 않음 — 향후 영역 전체 정리 시 통일 검토 |
| 4 | plan_coherence | project-planner 위임이 이 도메인의 확립된 단일 집계 문서(`spec-update-node-cancellation-shutdown-classification.md`, #1~#7 누적)가 아니라 `retry-turn-terminal-guard.md` 자체의 새 절에 분산 — 다음 project-planner 스윕이 놓칠 위험 | `plan/in-progress/retry-turn-terminal-guard.md` vs `spec-update-node-cancellation-shutdown-classification.md` | WARNING #1 정정과 함께 집계 문서에 `#8` 로 교차 등재하거나 포인터 추가 |
| 5 | plan_coherence | `spec-update-node-cancellation-shutdown-classification.md` 최상단의 미해결 (a)/(b) SIGTERM/timeout 분류 택일 결정은 이번 PR 과 무관함을 코드로 확인(`finalizeGuarded` 는 상태 특정적 예외가 아닌 범용 `canTransition`/`ALLOWED_TRANSITIONS` 재사용) | `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` 최상단 | 조치 불요 — 이번 PR 은 그 결정을 우회·선점하지 않음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | `4-execution-engine.md` §1.1 자기모순(3개 문서 대비) + node-cancellation.md §6 표 누락 + `cancelledBy` pre-existing 갭(재확인) |
| rationale_continuity | HIGH | 동일 자기모순을 "결정 번복 후 옛 Rationale 미정정"으로 규정, 최근 3 PR 연속 재발 이력 근거로 재발 위험 강조. 이 모순이 어떤 project-planner 문서에도 미등재라는 점 추가 확인 |
| convention_compliance | LOW | 동일 자기모순(spec-impl-evidence 관점) + `retry-turn-terminal-guard.md` `spec_impact: none` 자기모순(Gate C 리스크) 신규 발견 |
| plan_coherence | MEDIUM | 동일 자기모순(plan 미실행 관점) + `ie-resume-turn-boundary-cancel.md` 체크리스트 미갱신 + 위임 분산 |
| naming_collision | NONE | 실 diff 신규 식별자 충돌 0건. 대신 harness 번들링 결함(4-execution-engine.md 컨텍스트 누락) 발견 — 이 PR 범위 밖 |

## 권장 조치사항

1. **(최우선, project-planner 턴)** `spec/5-system/4-execution-engine.md` §1.1 77행 + Rationale 1454행의 "park 없이 종결되면 cancel 무효과" 서술을 79~92행(#1023)/`node-cancellation.md §2.4`/`6-websocket-protocol.md:375` 와 합치하도록 정정. — 4개 checker 독립 수렴, 재발 위험(HIGH) 근거로 최우선.
2. 같은 턴에 `spec/conventions/node-cancellation.md` §6 표 + frontmatter `code:` 에 `retry-turn.service.ts`(`finalizeGuarded`) 행 추가, `COALESCE`/`??` 메커니즘 차이 각주.
3. 위 두 항목을 `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` 에 `#8` 로 신규 등재(단일 집계 문서 관행 유지).
4. `plan/in-progress/retry-turn-terminal-guard.md` frontmatter `spec_impact: none` 을 정정 대상 spec 경로 리스트로 갱신(완료 처리 전, Gate C 오판 방지).
5. `plan/in-progress/ie-resume-turn-boundary-cancel.md` 체크리스트(502~504행)를 `[x]` 로 갱신 + 해소 주석 추가, `retry-turn-terminal-guard.md` Overview 에 origin 링크 추가.
6. **(developer 후속, 이미 추적 중)** `failRetryExecution` CANCELLED 분기가 `emitCancellationEvent` 재사용하도록 `cancelledBy` 채우기 — 신규 항목 아님, 기존 ai-review W1 트랙 유지.
7. **(harness 유지보수, 이번 PR 범위 밖)** consistency-check `--impl-done` 번들링을 natural sort + spec frontmatter 파일 우선순위로 개선 — 다음번엔 실제 충돌을 놓치고 "이상 없음"으로 오판할 수 있음.