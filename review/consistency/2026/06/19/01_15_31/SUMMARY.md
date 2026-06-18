# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 구현 착수 차단 사유 없음.

## 전체 위험도
**LOW** — 경미한 frontmatter stale 참조(WARNING 2건) 외 Critical/중요 위배 없음. 모든 5개 checker 성공 완료.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | convention_compliance | `pending_plans` 에 완료 이동된 plan 경로 잔류 | `spec/5-system/4-execution-engine.md` frontmatter line 11 | `plan/complete/spec-sync-execution-engine-gaps.md` (이미 complete/ 로 이동됨) | frontmatter `pending_plans:` 에서 `plan/in-progress/spec-sync-execution-engine-gaps.md` 항목 제거. 나머지 3개 in-progress plan 은 유지, `status: partial` 그대로 |
| W-2 | plan_coherence | 동일 — `pending_plans` 에 완료된 plan 잔류 (W-1 과 동일 위배, 다른 각도에서 지적) | `spec/5-system/4-execution-engine.md` frontmatter `pending_plans:` | `plan/complete/spec-sync-execution-engine-gaps.md` | W-1 과 동일 조치로 해소 |

> W-1 / W-2 는 동일 위배를 convention_compliance 와 plan_coherence 두 checker 가 각각 지적한 것. 하나의 조치(해당 항목 제거)로 동시 해소.

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | cross_spec | `spec-sync-execution-engine-gaps.md` stale 참조 — 본문 §8 banner 의 in-progress 경로도 동반 검토 필요 | `spec/5-system/4-execution-engine.md` line 11, line 1039 | W-1 조치 시 §8 banner path 도 `plan/complete/` 로 정정하거나 제거 |
| I-2 | cross_spec | `exec-park-durable-resume.md` in-progress 잔류 — Phase B2b 완료됐으나 plan 파일 미이동 | `spec/5-system/4-execution-engine.md` frontmatter line 13 | PR3/PR4 미완 잔여 작업이 있다면 현 위치 유지 타당. 완전 완료됐으면 `plan/complete/` 이동 검토 |
| I-3 | cross_spec | 상태 머신(`Execution.status` 6종, `NodeExecution.status` 7종) — data-model 과 완전 일치 확인 | `spec/5-system/4-execution-engine.md` §1.1, §1.2 | 이상 없음 |
| I-4 | cross_spec | BullMQ 큐 3종 — `spec/0-overview.md` §2.6 과 완전 일치 확인 | `spec/5-system/4-execution-engine.md` §9.3 | 이상 없음 |
| I-5 | cross_spec | C-1 분할 서비스명 — `spec/4-nodes/3-ai/1-ai-agent.md` 와 일관 기술 확인 | `spec/5-system/4-execution-engine.md` §1.3, §Rationale | 이상 없음 |
| I-6 | rationale_continuity | per-node task queue 기각 / sticky fast-path 기각 원칙 유지 확인 | §4.2, §7.4, §Rationale | 이상 없음 |
| I-7 | rationale_continuity | `_resumeCheckpoint` 미영속 번복 — 새 Rationale 항목 명시 완료 | §Rationale "Multi-turn 재시작 재개" | 이상 없음 |
| I-8 | rationale_continuity | `WFI → failed` 전이 추가 — 번복 근거 명시 완료 | §1.1 상태 전이표, §Rationale | 이상 없음 |
| I-9 | rationale_continuity | C-1 god-class 분할 — spec 무변 주장이 frontmatter glob 과 정합 확인 | §Rationale "C-1 god-class strangler-fig 분할" | 이상 없음 |
| I-10 | convention_compliance | `id: execution-engine` 이 basename `4-execution-engine` 과 불일치 — 의무 아닌 권장 사항, 기존 선례 다수 존재 | frontmatter line 2 | 현행 유지. 수정 불요 |
| I-11 | plan_coherence | `exec-intake-queue-impl.md` PR2b(동시성 cap) 미착수 — spec §8 "Planned" 상태 | §8 동시 실행 cap | PR2b 착수 시 선행 의무(settings 키 스키마, `queued_at` 컬럼, maxConcurrentExecutions spec 등재) 이행 |
| I-12 | plan_coherence | `execution-engine-residual-gaps.md` G1/G2 BLOCKED — §11 미구현 surface 잔존 | §11 graceful-shutdown gate, errorPolicy SIGTERM 분기 | §11 영역 착수 시 차단 사유(spec 설계 미확정, parallel-p2.md §1 미완) 해소 필요. 본 impl-prep 대상에 §11 미포함이면 무시 |
| I-13 | plan_coherence | `exec-park-durable-resume.md` Phase B 완료 후 spec §4.x/§7.4/§7.5 재전환 반영 여부 추적 필요 | §4.x, §7.4, §7.5 | 해당 spec 갱신 완료 확인 후 plan 체크 처리 |
| I-14 | naming_collision | 신규 식별자 없음 — 기존 식별자 코퍼스 전수 교차 검색 결과 충돌 없음 | `spec/5-system/4-execution-engine.md` 전체 | 이상 없음 |
| I-15 | naming_collision | `EXECUTION_TIMEOUT` vs `EXECUTION_TIME_LIMIT_EXCEEDED` 의도적 분리 — spec 에 이미 명시 | §1054, §1435 | 이상 없음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | frontmatter `pending_plans` stale link 1건(INFO). 상태 머신·큐·서비스명 모두 cross-spec 일치 |
| rationale_continuity | NONE | 기각된 대안 재도입 없음. 모든 번복에 새 Rationale 명시 완료 |
| convention_compliance | LOW | `pending_plans` 완료 plan 잔류 1건(WARNING). 그 외 규약 준수 |
| plan_coherence | LOW | `pending_plans` 완료 plan 잔류 1건(WARNING, W-1과 동일). 미구현 surface(PR2b, G1/G2) INFO 추적 |
| naming_collision | NONE | 신규 식별자 없음. 기존 식별자 충돌 없음 |

## 권장 조치사항

1. **[즉시, 비차단]** `spec/5-system/4-execution-engine.md` frontmatter `pending_plans:` 에서 `plan/in-progress/spec-sync-execution-engine-gaps.md` 항목 제거. 본문 §8 banner 의 해당 path 참조도 함께 `plan/complete/` 로 정정하거나 제거. (W-1/W-2/I-1 동시 해소 — CI 차단은 아니나 plan 추적 신뢰성 개선)
2. **[착수 전 확인]** PR2b(동시성 cap) 구현 전 `exec-intake-queue-impl.md` 에 명시된 선행 의무 이행 확인. (I-11)
3. **[착수 전 확인]** §11(graceful-shutdown/errorPolicy) 구현 전 G1/G2 차단 사유 해소 확인. (I-12)
4. **[추적]** `exec-park-durable-resume.md` Phase B 완료 후 spec §4.x/§7.4/§7.5 재전환 반영 완료 여부 점검. (I-13)
