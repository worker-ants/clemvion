---
worktree: workflow-resumable-execution-phase2-cont-64f537
started: 2026-05-25
owner: project-planner
status: pending
---

# Spec Update Proposal — workflow-resumable-execution Phase 2 follow-up

> Phase 2.8 / 2.9 의 spec 정합화. developer 가 implementation 중 발견했으나
> 직접 spec 수정 권한이 없어 project-planner 위임을 위해 작성. 본 worktree
> 는 같은 phase 의 implementation PR 이라 같은 PR 안에서 처리하거나 별 PR
> 로 분리 모두 가능.

## 동기

[`plan/in-progress/workflow-resumable-execution.md`](workflow-resumable-execution.md) §"Phase 2 진행 상태" 의
2.8 / 2.9 항목. impl-prep 검토(`review/consistency/2026/05/25/01_17_41/`,
`review/consistency/2026/05/25/07_12_25/`) 에서 두 WARNING 으로 식별됨.

## 변경 1 — `spec/5-system/4-execution-engine.md §9.3` `task-queue` 행 정정

### 현재

| 큐 이름 | 역할 | attempts | 비고 |
|---------|------|----------|------|
| `task-queue` | 노드 실행 태스크 (§4.2) — 구현 검증 후 본 행 확정/삭제 | 기존값 유지 | 기존 (현행 spec §4.2 에 큐 이름이 명시되지 않은 채로 운영 중 — Phase 2 구현 시 실제 이름 확인 후 §4.2 표 갱신) |

### 실제 코드 상태 (Phase 2 cont 시점)

`codebase/backend/src/modules/execution-engine/queues/` 의 실제 BullMQ 큐:
- `background-execution` (`BACKGROUND_EXECUTION_QUEUE` 상수, `background-execution.queue.ts`)
- `execution-continuation` (`CONTINUATION_EXECUTION_QUEUE` 상수, `continuation-execution.queue.ts`)

별도의 `task-queue` 는 **존재하지 않음**. 일반 노드 실행은 `runExecution` 의 in-process while-loop 에서 `executeNode` 호출 — 큐 미경유.

### 제안

`task-queue` 행을 **삭제**. 표는 정상 운영 중인 2개 큐만 남긴다:

| 큐 이름 | 역할 | attempts | 비고 |
|---------|------|----------|------|
| `execution-continuation` | 사용자 입력 fan-out (§7.4 / §7.5) | `RESUME_BULLMQ_ATTEMPTS` (기본 3) | Durable Continuation (2026-05-24) 으로 도입. 옛 Redis pub/sub `execution:continuation` 채널 대체 |
| `background-execution` | Background 노드 본문 실행 (§3.3) | 기존값 유지 | 기존 |

### 동반 갱신 (spec 본문)

- `spec/5-system/4-execution-engine.md §11 Graceful Shutdown` 항목 2의 ("BullMQ `execution-continuation` / `background-execution` / `task-queue` 의 active job 처리 중인 worker 는 ...") 에서 `task-queue` 토큰 제거.
- 다른 곳에서 `task-queue` 언급이 있는지 grep 확인 후 일괄 제거.

## 변경 2 — `INVALID_EXECUTION_STATE` 코드 spec 등재

### 동기

`spec/5-system/6-websocket-protocol.md §4.2` 의 버튼 클릭 에러 코드 표에는 `INVALID_EXECUTION_STATE` 가 등재되어 있으나 (`실행이 waiting_for_input 상태가 아님`), `spec/5-system/4-execution-engine.md §7.5` (rehydration) 에는 lookup 0건 / 다중 row 시점의 반환 정의가 누락. impl-prep `[W14]` / naming_collision 검토 발견.

또한 spec/5-system/3-error-handling.md 의 공용 422 `INVALID_STATE` 와 이름이 유사해 혼동 가능 (`[W15]`).

### 제안

#### 변경 2.1 — `spec/5-system/4-execution-engine.md §7.5` 끝에 신규 sub-section 추가

```markdown
### 7.5.1 Publisher 측 사전 검증 — `INVALID_EXECUTION_STATE`

§7.4 의 입력 receiver (controller / WS gateway) 가 publish 직전에 `nodeId →
nodeExecutionId` DB lookup 을 수행하는 단계에서, 다음 케이스는 BullMQ enqueue
를 **시도하지 않고** client 에 즉시 에러를 반환한다.

| 케이스 | 응답 | 원인 |
| --- | --- | --- |
| `execution_id + node_id + status='waiting_for_input'` 매칭 row 0건 | `INVALID_EXECUTION_STATE` | Execution 이 다른 상태(running / completed / cancelled / failed)거나 nodeId 미일치 |
| 동일 매칭 row 2건 이상 (invariant 위반) | `INVALID_EXECUTION_STATE` + logger.warn | 일반적으로 발생 불가. 발생 시 race 또는 데이터 손상 의심 |

`INVALID_EXECUTION_STATE` 는 **WS ack 전용 코드** — REST 진입점은 같은 의미로 422 `INVALID_STATE` ([Spec 에러 처리 §3-error-handling.md](./3-error-handling.md)) 를 반환한다 (REST 공용 카탈로그와의 이름 충돌 회피).

본 분류는 spec [§7.5 rehydration](#75-resume-after-restart-rehydration) 의 `RESUME_*` (worker 측 비동기 실패) 와 직교 — `INVALID_EXECUTION_STATE` 는 ack 동기 응답, `RESUME_*` 는 후행 `EXECUTION_CANCELLED` 이벤트.
```

#### 변경 2.2 — `spec/5-system/6-websocket-protocol.md §4.2` 에러 코드 표 주석 추가

기존 `INVALID_EXECUTION_STATE | 실행이 waiting_for_input 상태가 아님` 행의 설명에 다음 주석을 한 줄 덧붙인다:

> WS 전용 코드 — REST 공용 422 `INVALID_STATE` ([Spec 에러 처리 §3-error-handling.md](./3-error-handling.md)) 와 별개. 같은 의미를 두 layer 에서 다른 이름으로 표현하는 것은 historical artifact 이며, 동일 의미론을 의도한 것.

#### 변경 2.3 — Implementation 후행 작업 (별도 PR 권장)

현재 Phase 2 구현에서 `resolveWaitingNodeExecutionId` 는 throw 없이 `__no_node_exec__` sentinel 반환. spec 명시대로 client 에 `INVALID_EXECUTION_STATE` 를 동기 surface 하려면:

1. `ExecutionEngineService.continueX` 가 invalid lookup 시 `INVALID_EXECUTION_STATE` 코드의 에러 throw 로 전환 (또는 별도 validation 메서드 도입).
2. WS gateway 의 4개 handler 가 그 throw 를 catch 해 ack `error.code='INVALID_EXECUTION_STATE'` 로 변환.

본 PR (Phase 2 cont) 의 변경 표면을 키우지 않기 위해 별 PR 로 분리 권장. 현재 흐름은 lookup 실패 시 sentinel publish → worker rehydrateAndResume → `RESUME_CHECKPOINT_MISSING` 으로 surface (1-2초 지연되나 final 결과는 동일).

## 영향 범위

- `spec/5-system/4-execution-engine.md` §9.3 + §7.5 + §11 (작은 토큰 정정)
- `spec/5-system/6-websocket-protocol.md` §4.2 (주석 한 줄)
- Implementation 후행 작업 (변경 2.3) 은 별 PR

## 권고 후속 흐름

1. project-planner 가 본 plan 을 픽업 → `/consistency-check --spec` 으로 본 변경의 cross-spec 영향 점검.
2. spec/5-system/4-execution-engine.md / 6-websocket-protocol.md 직접 갱신.
3. (선택) 변경 2.3 의 implementation 후속 작업은 별 plan 으로 분리.

본 plan 완료 시 `git mv` 로 `plan/complete/` 이동.
