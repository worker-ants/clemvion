# Cross-Spec 일관성 검토 결과

대상: `plan/in-progress/spec-update-workflow-resumable-execution-phase2-followup.md`
검토 시각: 2026-05-25
검토 모드: --spec (spec draft)

---

## 발견사항

### [WARNING] `spec/data-flow/0-overview.md §4` BullMQ 큐 카탈로그에 `execution-continuation` 미등재

- target 위치: 변경 1 제안 — `spec/5-system/4-execution-engine.md §9.3` 표, `execution-continuation` 큐를 정식 큐로 확정
- 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/workflow-resumable-execution-phase2-cont-64f537/spec/data-flow/0-overview.md §4 BullMQ 큐 카탈로그`
- 상세: `spec/data-flow/0-overview.md §4` 의 BullMQ 큐 카탈로그 표에는 `background-execution`, `document-embedding`, `graph-extraction`, `schedule-execution`, `alerts-evaluator`, `integration-expiry` 6개만 등재되어 있다. `execution-continuation` 큐가 §9.3 에서 확정·등재되더라도 이 카탈로그는 동기화되지 않은 상태로 남는다. 동일 파일 §1.2 "현재 등록된 큐" 목록도 동일하게 누락된다.
- 제안: `spec/5-system/4-execution-engine.md §9.3` 변경과 함께 `spec/data-flow/0-overview.md §4` 큐 카탈로그 표에 `execution-continuation` 행 추가 (`execution-engine.module.ts` / `ContinuationBusService` / `ContinuationProcessor` / 사용자 입력 fan-out 재개). §1.2 "현재 등록된 큐" 목록도 동기 갱신 필요.

---

### [WARNING] `spec/data-flow/0-overview.md §5` Continuation bus 설명이 "Redis pub/sub" 로 기술

- target 위치: 변경 1 제안 — `execution-continuation`이 BullMQ 영속 큐로 전환, 옛 Redis pub/sub `execution:continuation` 채널 대체
- 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/workflow-resumable-execution-phase2-cont-64f537/spec/data-flow/0-overview.md §5 다중 인스턴스·동시성 모델`
- 상세: `spec/data-flow/0-overview.md §5` 의 "Continuation bus" 설명은 "Redis pub/sub (`ContinuationBusService`) 로 동기화" 라고 기술되어 있다. 변경 1이 적용되면 이 설명은 틀린 기술이 된다 (BullMQ 큐로 전환됨). `spec/5-system/4-execution-engine.md §9.3` 에서 `execution-continuation` 이 BullMQ 큐로 확정되면 이 설명도 "BullMQ `execution-continuation` 큐" 로 갱신되어야 한다.
- 제안: 변경 1 적용 시 `spec/data-flow/0-overview.md §5` 의 Continuation bus 설명을 "BullMQ 영속 큐 `execution-continuation` (`ContinuationBusService`) 로 동기화" 로 갱신.

---

### [WARNING] `spec/data-flow/3-execution.md` §9.3 / §7.5 연동 참조 — 부분 동기화만 됨

- target 위치: 변경 1 제안 + 변경 2.1 제안 전반
- 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/workflow-resumable-execution-phase2-cont-64f537/spec/data-flow/3-execution.md`
- 상세: `spec/data-flow/3-execution.md` line 20 은 `spec/5-system/4-execution-engine.md §7.4 / §7.5` 를 cross-reference 하고, line 236 은 `execution-continuation` 의 BullMQ 전환 결정과 §7.5 rehydration 경로를 명시하고 있다. 변경 2.1 의 `§7.5.1 Publisher 측 사전 검증 — INVALID_EXECUTION_STATE` 신규 sub-section 이 추가되면 이 파일의 §7.5 cross-link 는 정합하지만, 변경 2.1 내용 자체 (DB lookup / BullMQ enqueue 전 검증) 가 data-flow 에 기술된 시퀀스 흐름과 맞는지 명시적 확인이 필요하다. `spec/data-flow/3-execution.md` 의 시퀀스 다이어그램이 BullMQ enqueue 전 검증 단계를 포함하고 있지 않을 가능성이 있다.
- 제안: 변경 2.1 채택 후 `spec/data-flow/3-execution.md` 의 버튼 클릭 / form 제출 흐름 다이어그램에 "Publisher 측 DB lookup → INVALID_EXECUTION_STATE 분기" 단계 추가 여부를 검토하고, 누락 시 동기 갱신.

---

### [INFO] `spec/5-system/4-execution-engine.md §11` Graceful Shutdown — `task-queue` 토큰 제거 후 잔여 참조 없음 (확인됨)

- target 위치: 변경 1 동반 갱신 — §11 항목 2 에서 `task-queue` 토큰 제거
- 충돌 대상: 없음 (확인됨)
- 상세: 워크트리 내 `spec/5-system/4-execution-engine.md §11 Graceful Shutdown` (line 974) 에 `BullMQ 'execution-continuation' / 'background-execution' / 'task-queue'` 표기가 존재하며, target 문서가 이 `task-queue` 토큰 제거를 제안한다. 워크트리 전체 spec 에서 `task-queue` 는 이 두 곳 (`§9.3` 표 행, `§11` 목록) 외에는 등장하지 않으므로 일괄 제거 후 다른 spec 의 잔여 충돌은 없다.
- 제안: 해당 없음. 변경 1 의 제안 그대로 처리.

---

### [INFO] `INVALID_EXECUTION_STATE` 코드 — `spec/5-system/3-error-handling.md §3` `INVALID_STATE` 와 명명 유사성 (기존 인지된 사항)

- target 위치: 변경 2.2 — `spec/5-system/6-websocket-protocol.md §4.2` 에러 코드 표에 "WS 전용 코드" 주석 추가
- 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/workflow-resumable-execution-phase2-cont-64f537/spec/5-system/3-error-handling.md` — 공용 422 `INVALID_STATE`
- 상세: 두 코드(`INVALID_EXECUTION_STATE` WS 전용, `INVALID_STATE` REST 공용 422)의 명명 유사성은 target 문서 자체가 "[W15]" 로 인식하고 있으며 변경 2.2 의 주석 추가로 명시적으로 문서화된다. 추가적인 cross-spec 충돌은 발생하지 않는다. 다만 변경 2.1 의 신규 sub-section (`§7.5.1`) 이 "WS 전용 코드 — REST 진입점은 422 `INVALID_STATE`" 라고 명시하므로, `spec/5-system/3-error-handling.md §3` 에 역방향 주석 ("WS에서는 동일 의미를 `INVALID_EXECUTION_STATE` 로 표기 — [실행 엔진 §7.5.1](./4-execution-engine.md#751-publisher-측-사전-검증--invalid_execution_state) 참조") 을 추가하면 양방향 가시성이 향상된다.
- 제안: 의무 아님. `spec/5-system/3-error-handling.md §3` `INVALID_STATE` 행에 선택적 cross-link 추가 권장.

---

### [INFO] `spec/0-overview.md §2.6 Data Layer` Redis 설명 — 이미 `execution-continuation` 반영됨 (동기화 완료)

- target 위치: 변경 1 (큐 확정)
- 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/workflow-resumable-execution-phase2-cont-64f537/spec/0-overview.md §2.6`
- 상세: 워크트리 내 `spec/0-overview.md §2.6` 의 Redis 설명은 이미 `BullMQ 큐 백엔드 (실행 태스크 / 'execution-continuation' / 'background-execution')` 로 갱신되어 있어 변경 1 과 일관된다. 이 항목에서 별도 조치 불필요.
- 제안: 해당 없음.

---

## 요약

Target 문서(spec-update-workflow-resumable-execution-phase2-followup)의 두 변경 제안은 `spec/5-system/4-execution-engine.md`·`spec/5-system/6-websocket-protocol.md` 두 파일에 국한되어 있으나, cross-spec 관점에서 `spec/data-flow/0-overview.md` 와의 동기화 누락이 CRITICAL 아닌 WARNING 수준으로 존재한다. 구체적으로 §4 BullMQ 큐 카탈로그에 `execution-continuation` 미등재, §5 Continuation bus 설명이 구형 Redis pub/sub 표기로 남아 있어 변경 1 적용 후 해당 파일이 stale 상태가 된다. 변경 2.1 의 `§7.5.1` 신규 sub-section 은 `spec/data-flow/3-execution.md` 의 시퀀스 흐름 다이어그램과의 정합 여부를 추가 확인해야 한다. CRITICAL 충돌(두 영역 중 하나가 작동 불가한 직접 모순)은 발견되지 않았다.

## 위험도

MEDIUM
