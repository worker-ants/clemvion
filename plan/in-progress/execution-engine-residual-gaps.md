---
worktree: spec-frontmatter-status-migration-027c17
started: 2026-05-29
owner: developer
---

# Plan — execution-engine 잔여 미구현 표면 (G1/G2/G3)

> `spec/5-system/4-execution-engine.md` 본문이 약속했으나 아직 미구현인 surface 를
> 추적하는 plan. 이 plan 의 존재로 엔진 spec frontmatter 가 `status: partial` +
> `pending_plans:` 유효성을 갖는다 (spec-impl-evidence §3).
>
> 트리거: PR #355 변경 7 조사 (project-planner, 2026-05-29) — 상세는
> `plan/complete/spec-update-workflow-resumable-execution-phase2-followup.md` 후속 /
> 본 마이그레이션 plan `spec-frontmatter-status-migration.md`.

## 배경

엔진은 Phase 0~3 + 변경 2.3 으로 대부분 구현됐으나, spec 본문에 "Phase 2/Phase 3
예정" 으로 명시된 다음 3개 surface 가 미구현이며 owning plan 이 없었다. 본 plan 이
이를 인수한다.

> **진행 상태 (2026-05-30)**: G3 구현 완료 (branch `claude/execution-engine-g3-seq-ttl`).
> 사용자 결정으로 G1·G2 는 착수하지 않고 아래 명시된 사유로 **차단(BLOCKED)** 처리.
> 본 plan 은 그대로 `plan/in-progress/` 에 유지되고, 엔진 spec frontmatter 도
> `status: partial` + 본 plan `pending_plans:` 유지. G1·G2 우선순위·진행 여부는
> 사용자 판단 대기.

## 미구현 항목

### G1 — WS `execution.start` graceful-shutdown gate (§11) — ⛔ BLOCKED
- spec `spec/5-system/4-execution-engine.md §11` 항목 1: SIGTERM 종료 중 새 Execution
  시작 거부를 HTTP (`POST /api/workflows/:id/execute`) 외에 WS `execution.start`
  명령에도 적용. 현재 backend `websocket.gateway.ts` 에 `execution.start`
  @SubscribeMessage 핸들러 자체가 부재 → gate 적용 대상 외.
- [ ] WS gateway 에 `execution.start` 핸들러 신설 (spec `3-workflow-editor/3-execution.md §8.2` 정의 기준)
- [ ] 종료 중 503 + `code: 'SERVER_SHUTTING_DOWN'` + `Retry-After` ack 반환 (HTTP gate 와 동일 의미)
- 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts`, `shutdown/shutdown-state.service.ts`
- **차단 사유 (2026-05-30 조사)**: gate 추가는 작지만, 그 전제인 `execution.start` 핸들러
  신설은 **net-new 기능**이다. spec `3-execution.md §8.2` 는 `{workflowId, input, fromNodeId?}`
  한 줄 정의만 제공하며 (a) ack/응답 형식, (b) `fromNodeId` 부분 실행 시맨틱(HTTP 진입점엔
  부재)이 미정의. ack 계약·`fromNodeId` 설계는 **project-planner 영역(spec 선행)**. spec
  확정 전 developer 단독 구현 불가. → spec 설계 후 별도 착수.

### G2 — errorPolicy `continue` 분기 on SIGTERM interrupt (§11) — ⛔ BLOCKED
- spec `§11` 항목 4: RUNNING 노드가 grace 내 미완료 시 현재는 errorPolicy 무관 전부
  `failed` 처리(Phase 1 stop 동등). `errorPolicy='continue'` 인 노드는 `failed`
  마킹 대신 다음 노드를 `execution-continuation` 큐로 enqueue 해야 함.
- [ ] `shutdown-state.service.ts` 의 drain timeout 처리에 errorPolicy 분기 추가
- [ ] `continue` 시 다음 노드 enqueue 경로 연결 + 테스트
- 위치: `codebase/backend/src/modules/execution-engine/shutdown/shutdown-state.service.ts`
- **차단 사유 (2026-05-30 조사)** — 3중 장애물:
  1. **전제 미해소**: errorPolicy schema 노출 선행 plan `parallel-p2.md §1` 이 아직
     `plan/in-progress/` (미완료). 본 plan 의 "착수 권장 조건" 미충족.
  2. **용어/구현 불일치**: spec §11 의 "`continue`" 는 추상 용어이고, 실제 node-common
     §2.4 정책 enum 은 `stop_workflow` / `skip_node` / `use_default_output` / `retry` /
     `route_to_error_port` 로 `continue` 값 자체가 없다 (engine `getErrorPolicyConfig` 가
     `node.config.errorHandling.policy` 읽음). 매핑 정의 필요.
  3. **인프라 부재**: 정상 흐름의 `skip_node`("계속 진행") 는 in-process pointer 전진일
     뿐 "다음 노드 enqueue" 가 아니며, interrupt 된 RUNNING(non-waiting) 노드를 다른
     인스턴스가 이어받는 cross-instance 재개 메커니즘이 없다 (`recoverStuckExecutions`
     는 heartbeat-stuck RUNNING 만, FAILED 는 미수거. `execution-continuation` 큐 +
     `applyContinuation` 은 WAITING_FOR_INPUT rehydration 전용). spec 대로면 **신규
     continuation type + cross-instance mid-execution 재개 인프라 + spec 설계**가 필요.

### G3 — `exec:cont:seq:<executionId>` Redis 키 TTL 정리 (§9.2) — ✅ DONE (2026-05-30)
- spec `§9.2`: continuation publish 의 monotonic seq 키가 executionId 종결 후에도
  TTL 없이 잔류 (동작 무영향이나 Redis 메모리 누수). Phase 3 후속 정리로 예정됨.
- [x] `continuation-bus.service.ts` 의 `nextSeq` 가 `INCR` 직후 같은 키에 **sliding-window
  `EXPIRE`** 설정 (`CONTINUATION_SEQ_TTL_SECONDS`, 기본 86400 = 24시간). 매 publish 가
  만료 시계를 갱신 → continuation 활성 동안 유지, 종결(publish 중단) 후 자연 소멸. EXPIRE
  실패는 유효 seq(INCR 성공)를 무효화하지 않도록 swallow.
- [x] 단위 테스트 추가 (`continuation-bus.service.spec.ts`): publish 마다 EXPIRE 호출,
  연속 publish sliding 갱신, EXPIRE 실패 시 정상 jobId 반환 — 전체 15 passed.
- [x] spec 병행 갱신: 엔진 `§9.2` + `spec/data-flow/3-execution.md §2.3` 의 "TTL 미설정 —
  Phase 3 후속" 서술을 sliding-window TTL 로 교체.
- 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-bus.service.ts`

## 완료 조건

- ~~G1/G2/G3 모두 구현 + 테스트~~ → 현재 **G3 만 완료**, G1·G2 BLOCKED. 엔진 spec 본문에
  G1/G2 관련 "Phase 2 예정" 문구가 남아있고 미구현 surface 가 잔존하므로 엔진 spec
  frontmatter 는 `status: partial` + 본 plan `pending_plans:` 유지 (spec-impl-evidence §3).
  G1·G2 가 모두 해소돼 본 plan 이 마지막 pending_plan 이 될 때 `status: implemented` 승격
  (spec-impl-evidence §3 (c) 가드).

## 비고

- 본 plan 은 frontmatter `pending_plans` 유효성의 근거이기도 하므로, 미구현이
  남아있는 한 `plan/in-progress/` 에 유지된다.
- G1/G2 는 grace-shutdown 동작이라 multi-instance e2e 인프라 의존 — 우선순위는
  운영 영향도에 따라 별도 판단.
