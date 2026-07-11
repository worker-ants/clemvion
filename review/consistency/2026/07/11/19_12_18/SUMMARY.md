# Consistency Check 통합 보고서 (--impl-prep spec/5-system/, PR-2 EIA-RL-07 reaper)

**BLOCK: NO (PR-2 EIA-RL-07 reaper 영역 기준)** — journal 복구 결과 cross_spec 에 CRITICAL 1건이 있으나 **graph-rag(§10) KB 토큰 통계**의 pre-existing 이슈로, 본 PR-2(EIA §14 idle-wait reaper + execution-engine §4)와 **완전 무관·비중첩**. PR-2 영역(EIA/engine)은 Critical 0.

> **scope 편향 주의**: worktree 명 `llm-usage-doc-alignment` 이 orchestrator 타겟 선정을 llm-usage/graph-rag 로 편향시켜 `spec/5-system/` 전체가 딸려옴(plan_coherence INFO I2 가 동일 오탐 선례 기록). 실제 PR-2 는 EIA-RL-07 reaper 뿐.

## Critical (out-of-scope, 별건 flag)
- **[CRITICAL, graph-rag] `10-graph-rag.md` §3.2/§3.7/§5 의 "KB 토큰 통계" 요구사항이 `data-flow/7-llm-usage.md` invariant(GraphExtractionService context NULL) 와 충돌** — `LlmUsageLog` 스키마에 KB/document FK 없음, `getGraphStats` 토큰 필드 없음, UI 부재. spec 이 ✅(완료)로 선언했으나 구현 경로 없음. **PR-2 와 무관 → 별도 task 로 flag**(planner 가 §10 를 Planned/미구현으로 정정하거나 구현).

## PR-2 영역(EIA §14 / execution-engine §4) 판정
- **cross_spec**: EIA §5.1/5.3/5.4/5.5/5.6/7.5.1, execution-engine §1.1/§7.4/§7.5 정합 확인(§R9 coalesce/cancel 반영분). **reaper 관련 새 모순 0**.
- **naming_collision**: 요구사항 ID·endpoint·이벤트명·ENV·감사액션 신규 충돌 0. `WEBCHAT_IDLE_TIMEOUT`·reaper 명 관련 충돌 없음(WARNING 2건은 LlmUsageLog casing·GraphEntity — 무관).
- **convention_compliance**: 에러코드·DTO·봉투 정합. WARNING(auth §5 RPC 경로)·INFO 무관.
- **plan_coherence**: `spec-sync-external-interaction-api-gaps`(EIA-RL-07 등재처)와 정합. WARNING(rag-dynamic-cut stale)·INFO 무관.

## 무관 WARNING (PR-2 범위 밖, 미조치)
| # | 영역 | 발견 |
|---|------|------|
| W1 | auth §5 | 딥 RPC 경로 vs api-convention §2.2 예외 문구(규약 갱신 후속) |
| W2 | rag-dynamic-cut plan | 완료된 KB-GR-SR-05 stale TODO(#503) |
| W3 | graph-rag | `LLMUsageLog` casing 혼재(canonical `LlmUsageLog`) |
| W4 | graph-rag/data-model | Entity/Relation/ChunkEntity TypeORM 충돌 우회(`Graph` 접두) 미문서화 |

## 결론
PR-2(EIA-RL-07 reaper) 구현 착수 valid — 대상 영역 Critical 0. graph-rag CRITICAL 및 무관 WARNING 은 별건(spawn_task/후속 planner). journal 복구로 재판정 ([[feedback_workflow_disk_write_gap_false_counts]]).
