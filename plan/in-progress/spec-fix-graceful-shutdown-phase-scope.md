---
worktree: workflow-resumable-execution-6b105e
started: 2026-05-25
owner: resolution-applier
---
# Spec Fix Draft — Graceful Shutdown Phase Scope (C-1 / W-7)

## 원본 발견사항

SUMMARY#C-1: WS `execution.start` shutdown gate 누락 — spec §11 step 1 은 HTTP 및 WS 양 진입점 모두에 503 게이트를 요구하나 WS 경로에 `isShuttingDown` 체크 없음.

SUMMARY#W-7: spec §11 step 4 — grace 초과 후 errorPolicy `stop`/`continue` 분기 미구현 (현재 모든 row 일괄 FAILED).

## 현황 분석

### C-1 (WS gate)
- `websocket.gateway.ts` 에 `execution.start` WS 핸들러가 없음. WS 를 통한 신규 Execution 시작 진입점이 Phase 1 scope 에서 구현되지 않은 상태.
- spec §11 step 1: "POST /api/executions/start 및 WS `execution.start` 가 503 응답"으로 표현되어 있으나, WS `execution.start` 명령 자체가 현재 미구현 (Phase 2 예정).
- Phase 1 = HTTP gate 만 구현하는 것이 실제 구현 범위였음.

### W-7 (errorPolicy 분기)
- 현재 `markRemainingAsInterrupted` 는 모든 row 를 FAILED 로 일괄 마킹.
- spec §11 step 4: "errorPolicy 에 따라 처리 (stop → Execution failed, continue → 다음 노드 enqueue)" — 이는 Phase 2 continuation-queue 구현이 선행되어야 `continue` 분기에서 enqueue 가 가능함.
- Phase 1.2 구현은 `stop` 정책 동등 처리로, Phase 2 에서 `continue` 분기 구현 예정.

## 제안 변경

### spec/5-system/4-execution-engine.md §11 step 1 보정

현재:
```
1. **새 Execution 시작 거부**. `POST /api/executions/start` 및 WS `execution.start` 가 **503 Service Unavailable** 응답.
```

제안:
```
1. **새 Execution 시작 거부**. `POST /api/workflows/:id/execute` (HTTP) 가 **503 Service Unavailable** 응답. response body 는 표준 API 에러 shape (`{ error: { code: 'SERVER_SHUTTING_DOWN', message: '...' } }`, [Spec API 규약](./2-api-convention.md)), `Retry-After: <ceil(SIGTERM_GRACE_MS / 1000)>` 헤더 동봉. LB drain 동안 traffic 이 다른 인스턴스로 라우팅.
   > **Phase 1 구현 범위**: HTTP 진입점 gate 만 구현. WS `execution.start` 명령은 현재 미구현 상태이며 Phase 2 (continuation-queue 본구현) 에서 추가 예정.
```

### spec/5-system/4-execution-engine.md §11 step 4 보정

현재:
```
- 미완료 시: 해당 NodeExecution 을 `failed` + `error.code='SERVER_INTERRUPTED'` 로 마킹 후 Execution 도 노드의 errorPolicy 에 따라 처리 (`stop` → Execution `failed`, `continue` → 다음 노드 enqueue).
```

제안:
```
- 미완료 시: 해당 NodeExecution 을 `failed` + `error.code='SERVER_INTERRUPTED'` 로 마킹 후 Execution 도 `failed` 마킹.
  > **Phase 1 구현 범위**: errorPolicy 분기 없이 전체 `stop` 동등 처리. `continue` 정책 분기 (`다음 노드 enqueue`) 는 Phase 2 continuation-queue 구현 후 추가 예정.
```

### spec/1-data-model.md §2.13 error.code 어휘 보완 (W-21 연관)

`recoverStuckExecutions` 가 설정하는 `error.code='WORKER_HEARTBEAT_TIMEOUT'` 를 인프라 어휘에 추가.

현재:
```
엔진 인프라 차원의 코드를 포함한다 — `SERVER_INTERRUPTED` (...), `RESUME_FAILED` / ...
```

제안 (추가):
```
엔진 인프라 차원의 코드를 포함한다 — `SERVER_INTERRUPTED` (graceful shutdown 미완료 노드, §11), `WORKER_HEARTBEAT_TIMEOUT` (부팅 시 recovery — 30분 이상 heartbeat 없는 RUNNING Execution, §7.4), `RESUME_FAILED` / `RESUME_CHECKPOINT_MISSING` / `RESUME_INCOMPATIBLE_STATE` (continuation rehydration 실패, §7.5)
```

## 주의사항

- 모든 변경은 spec 작성자 (`project-planner`) 가 정식 반영 전 `/consistency-check --spec` 검증 필수.
- Phase 2 구현 시 step 1 WS gate + step 4 continue 분기를 함께 되돌려 명세에 맞게 갱신.
