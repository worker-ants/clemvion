# Consistency Check 통합 보고서

**BLOCK: NO** — 확보된 3개 checker 결과에는 Critical 없음. 단, **cross_spec / convention_compliance 2개 checker 는 status=success 로 보고됐으나 output_file 이 실제로 디스크에 존재하지 않아 "재시도 필요"로 처리** — 아래 참고.

## 전체 위험도
**MEDIUM** — 확보된 3개 checker(rationale_continuity/plan_coherence/naming_collision) 자체는 WARNING 2건·Critical 0건으로 낮은 위험이나, **5개 중 2개(cross_spec, convention_compliance) 결과 미확보**로 전체 커버리지가 불완전해 최종 판정을 보류해야 함(호출자가 재실행 후 재통합 필요).

## 데이터 무결성 경고 (필독)

| Checker | manifest status | 실제 파일 상태 |
|---|---|---|
| cross_spec | success | **파일 없음** (`review/consistency/2026/07/16/23_36_57/cross_spec.md` 미생성) |
| convention_compliance | success | **파일 없음** (`review/consistency/2026/07/16/23_36_57/convention_compliance.md` 미생성) |

이는 알려진 "Workflow FS-write flakiness"(checker 가 success 로 보고되지만 output_file 을 실제로 쓰지 못하는 비결정적 현상)와 일치하는 패턴이다. 호출자는 이 2개 checker 를 **직접 Agent 재실행**해 output_file 존재를 확인한 뒤 본 요약에 재통합해야 완전한 BLOCK 판정이 성립한다. 아래 표는 3개 checker 결과만으로 작성됐다.

## Critical 위배 (BLOCK 사유)

*(없음 — 확보된 3개 checker 기준)*

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity | D3 — `10-parallel.md` L211 "옛 워크플로우 호환: waitAll:false 별도 마이그레이션 작업은 `parallel-p2-followups.md §2-E` 후속" 약속의 추적 주체(§2-E)가 완전히 유실(원 문서 `parallel-p2.md` 가 2026-05-30 커밋에서 통째로 삭제됨, archive 미보존). 현재 `parallel-p2-followups.md` 는 §2-E 없음, `waitAll` 문자열 자체가 등장 안 함 | draft "D3. plan 링크 경로 갱신" 절 / `spec/4-nodes/1-logic/10-parallel.md:211` | `plan/complete/parallel-p2-followups.md` (§2-E 부재) | 단순 링크 정정 전에 판단 확정 필요: (a) 런타임 reject 처리로 이미 충분하다면 L211 의 "별도 마이그레이션 작업 후속" 문장을 삭제하고 그 판단 근거를 `10-parallel.md ## Rationale`(§waitAll=false 근거)에 1~2문장 명시, 또는 (b) 여전히 유효하면 신규 plan 항목으로 재등재하고 그 경로로 링크 갱신. 어느 쪽이든 처리 근거를 Rationale 에 기록 |
| 2 | plan_coherence | D1 이 `rag-quality-improvement.md §7` 에 승계시켰다고 선언한 4개 미구현 표면 중 2개(① 멀티-KB 리랭크, ④ 자동 재임베딩 트리거)가 plan 본문에 실행 가능한 체크박스 없이 2026-07-16 요약 노트 문장에만 존재(③ D2 정량임계=§7.C, ② ef_search 튜닝=§7.E 는 정상 체크박스 존재) | draft D1 "근거" 3~4번째 bullet / `plan/in-progress/rag-quality-improvement.md §7` 머리말(L188-193) | `spec/5-system/9-rag-search.md §3.3.2` 및 `## Rationale`(멀티-KB 리랭크·재임베딩 트리거 "후속" 서술) | `rag-quality-improvement.md §7`(예: §7.E 또는 신규 §7.F)에 두 항목을 명시적 `[ ]` 체크박스로 추가 — D1 자신이 방지하려는 "체크박스 0건 상태에서 plan 이 complete 이동 → 거짓 `implemented` 승격" 위험을 내부에서 재현하지 않도록 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | D2 §3.3 "won't-do 정식 컨벤션 존재 여부" 자문에 이미 선례 존재 | `spec/5-system/6-websocket-protocol.md ## Rationale → ### R-wontdo-rawws-rest` (2026-07-08 결정) | D2 신규 Rationale 절에 이 선례를 명시 인용하고 동일하게 전용 anchor(`R-wontdo-cached-capabilities` 등) 부여. 여력 되면 `spec/conventions/spec-impl-evidence.md §3` 에 "절 단위 won't-do 표기" 관례 한 줄 정식 등재 |
| 2 | rationale_continuity | D1 — `9-rag-search.md ## Rationale` 4개 근거 항목 실측 대조 결과 재도입·번복 없음, `status: partial` 유지가 spec-impl-evidence R-5 원칙과 정합 | draft D1 절 | 경미 — `rag-quality-improvement.md §7` 에 멀티-KB 리랭크·재임베딩 트리거도 체크박스로 명문화 권장(WARNING #2 와 동일 조치로 해결됨) |
| 3 | rationale_continuity | D2 — `cached_capabilities`/`capabilities 캐시` grep 결과 `11-mcp-client.md` 단 1곳에만 존재, cross-spec 파급 없음 확인 | `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/2-navigation/4-integration.md` 등 | 없음 |
| 4 | plan_coherence | `execution-engine-residual-gaps.md` L56 이 이미 삭제된 `parallel-p2.md` 를 "아직 in-progress" 전제로 인용(stale, target 과 직접 무관) | `plan/in-progress/execution-engine-residual-gaps.md:56` | 본 PR 필수 처리 대상 아님. 다음 접촉 시 "defer 확정(2026-07-03)" 최신 문구로 정리 권장 |
| 5 | naming_collision | "won't-do" 표기는 신규 식별자가 아니라 기존 확립 컨벤션 재사용 확인(4개 spec + 3개 plan 문서에서 동일 의미로 이미 사용 중) | D2 §3.3 | 확립된 라벨 포맷 `_(비채택 won't-do)_` 그대로 적용해 grep 일관성 유지 권장 |
| 6 | naming_collision | D1/D3 경로 치환 대상 — `git status`/`grep` 실측과 완전 일치, 목적지 파일명 충돌(`parallel-p2-followups.md` vs `parallel-p2-followups-done.md`) 없음 | D1/D3 전체 | 없음 |
| 7 | naming_collision | `cached_capabilities` 필드명 단일 사용처, 신규 식별자 아님 | `spec/5-system/11-mcp-client.md:144,146,148,371` | 없음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | **재시도 필요** | status=success 보고됐으나 output_file 미생성(실제 파일 없음) — 재실행 필요 |
| rationale_continuity | MEDIUM | D3 §2-E 유실 커밋먼트(waitAll 마이그레이션 후속) 처분 미정 — WARNING. D1/D2 자체는 Rationale 연속성 이상 없음 |
| convention_compliance | **재시도 필요** | status=success 보고됐으나 output_file 미생성(실제 파일 없음) — 재실행 필요 |
| plan_coherence | LOW | D1 이 `rag-quality-improvement.md` 에 위임한 4건 중 2건이 체크박스 없이 서사적 선언으로만 존재 — WARNING. 나머지(plan rename·dead-link 5곳·pending_plans 소유권)는 실측과 완전 일치 |
| naming_collision | NONE | 신규 식별자 0건, "won't-do" 표기는 기존 컨벤션 재사용, 경로 치환 전부 실측과 일치 |

## 권장 조치사항

1. **(선행 — BLOCK 판정 완결 전 필수)** cross_spec / convention_compliance 2개 checker 를 직접 Agent 로 재실행하고, output_file 실제 생성을 `ls` 로 확인한 뒤 본 요약에 재통합할 것. 이 2개 결과 없이는 "BLOCK: NO" 는 잠정치다.
2. D3 — `10-parallel.md` L211 "waitAll:false 별도 마이그레이션 작업" 커밋먼트에 대해 유지/재등재 vs 폐기+Rationale 기록 중 하나를 명시적으로 결정하고 `## Rationale` 에 남길 것(단순 링크 정정만으로 처리하지 말 것).
3. D1 — `rag-quality-improvement.md §7` 에 멀티-KB 리랭크·자동 재임베딩 트리거 2건을 실행 가능한 `[ ]` 체크박스로 추가할 것.
4. D2 — §3.3 신규 Rationale 절에 `6-websocket-protocol.md#r-wontdo-rawws-rest` 선례를 명시 인용하고 동일 anchor 관례(`R-wontdo-*`)를 따를 것(권장, 차단 사유 아님).