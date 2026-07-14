# Consistency SUMMARY — `--impl-done` (EIA 후속 F-1, nodeId 일치 검사)

- 모드: `--impl-done` scope=`spec/5-system/4-execution-engine.md`, diff-base=origin/main
- checker 5/5 완료

## BLOCK: NO

| checker | Critical | Warning | Info | 위험도 |
|---|---|---|---|---|
| cross_spec | 0 | 1 | 1 | LOW |
| rationale_continuity | 0 | 0 | 1 | NONE |
| convention_compliance | 0 | 0 | 1 | NONE |
| plan_coherence | 0 | 1 | 1 | LOW |
| naming_collision | 0 | 0 | 0 | NONE |
| **합계** | **0** | **2** | **4** | **LOW** |

## Critical: 없음 → 차단 없음

## Warning 처분 (2건 — 모두 same-turn 해소)

1. **[cross_spec]** `spec/data-flow/15-external-interaction.md` §1.2 dispatch 매핑 표가 `expectedNodeId`
   3번째 인자 미반영으로 stale. → **fix**: 표 4행에 `, expectedNodeId` + 설명·§7.5.1 링크 추가.
2. **[plan_coherence]** F-3(breaking-change 공지 결정)이 F-1 로 확장된 breaking 범위(nodeId 불일치)를
   미반영. → **fix**: F-3 절에 breaking 2건(표면 불일치 + nodeId 불일치) 누적 명시.

## Info (4건 — 조치/기록)
- [rationale] §7.5.1 nodeId 행 "근거" cross-ref 가 표면-매칭 Rationale 을 가리켜 부정확 → EIA §5.1 +
  InteractDto 계약으로 정정(fix).
- [cross_spec] `data-flow/14-chat-channel.md` STATE_MISMATCH 흐름 미기재 → 기존 완전성 갭, 비차단.
- 그 외 convention/plan INFO — 기존 관례 준수 확인.
