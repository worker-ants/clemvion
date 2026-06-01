---
worktree: (assigned at impl-start)
started: 2026-05-31
owner: TBD
---

# Background context-key race — 선택적 후속 backlog

> **완료된 본체는 분리됨** (2026-06-01 split): background ExecutionContext Map 키 분리
> race 본 수정(PR #406, `pendingContinuations` 의 `contextKeyOf` 격리 + finally 정리)과
> ai-review INFO #1~#10 결정 기록은 [`plan/complete/background-context-key-race.md`](../complete/background-context-key-race.md).
> 본 문서는 그 PR 에서 **별 PR 로 미룬 선택적/조건부 후속**만 남긴 잔여 추적이다.
> 커밋된 약속이 아니라 "필요 시 검토" 수준 — 착수 시 worktree 로 승격.

## 선택적 backlog (별 PR — 미착수)

- [ ] **INFO#3**: `createContext` / 엔진 내부 부가 필드 options-bag 패턴 검토 (God Object 방지 규약과 정합).
- [ ] **INFO#7**: `setStructuredOutput`/`setEngineResolvedConfig` context 미존재 시 `logger.warn` 추가 (잘못된 키 진단성).
- [ ] **(검토)** background 본문 interactive 노드 fail-fast 가드 + 에러코드(`BACKGROUND_INTERACTIVE_UNSUPPORTED`) — spec(12-background §4/§6) 변경 동반, project-planner 선행. 현재는 격리+타임아웃으로 안전 종결만 보장 (완료 기록 §1 "잔여 한계" 참조).
