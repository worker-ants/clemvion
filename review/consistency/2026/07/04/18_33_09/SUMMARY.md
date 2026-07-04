# Consistency Check SUMMARY — priority 3-tier impl-prep (--impl-prep spec/5-system/)

- **Mode**: `--impl-prep`. **Date**: 2026-07-04 18:33:09.
- **대상 구현**: priority 3-tier (triggerType threading) — exec-intake-followups 첫 항목.

## BLOCK: NO (5/5)

| Checker | Verdict | 핵심 |
| --- | --- | --- |
| cross_spec | **NO** | resolveExecutionRunPriority 이미 3-tier·Trigger.type 어휘 정렬. 수정 호출부 3(webhook hooks:195, chat-channel hooks:614, schedule schedule-runner:163). runNow(schedules:263)=manual 유지 필수(triggerId 경로로 바꾸면 회귀). EIA=범위 밖. |
| rationale_continuity | **NO** | runNow=manual 유지가 3 spec(§6.1.1·3-schedule·14-execution-history §2.4) invariant("executedBy 우선"). triggerType 확장은 2026-07-04 예고 후속. INFO: §4.3 표에 executedBy 우선 명문화 권장. |
| convention_compliance | **NO** | ExecuteOptions=내부 타입(swagger 무관). INFO: triggerType(priority 입력) vs triggerSource(실행이력 파생) 명명 유사 → JSDoc 구분. |
| plan_coherence | **NO** | 2026-07-04 후속 분리 항목. INFO: §9.3 큐 표도 flip 대상. |
| naming_collision | **NO** | ExecutionRunTriggerType/resolveExecutionRunPriority 선배선. INFO: 타입 재사용, ExecutionRunJob payload 미포함 경계 유지. |

## 구현 결정 (impl-prep INFO 반영)
- ExecuteOptions.triggerType?: **ExecutionRunTriggerType** (triggerId variant, 옵셔널). JSDoc 으로 triggerSource 와 구분.
- execute(): **executedBy 우선** → manual; else `options.triggerType ?? 'webhook'`.
- 호출부: hooks:195/614 → 'webhook', schedule-runner:163 → 'schedule'. runNow=manual(무변경).
- spec flip: §4 banner·§4.3(executedBy 우선 명문화)·§8 banner·§9.3 큐 표.
- ExecutionRunJob payload 에 triggerType 미포함(priority 계산 전용).

## 결론
BLOCK: NO. 자명한 developer 결정으로 구현 진행.
