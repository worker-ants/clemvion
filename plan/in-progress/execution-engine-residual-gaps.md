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

## 미구현 항목

### G1 — WS `execution.start` graceful-shutdown gate (§11)
- spec `spec/5-system/4-execution-engine.md §11` 항목 1: SIGTERM 종료 중 새 Execution
  시작 거부를 HTTP (`POST /api/workflows/:id/execute`) 외에 WS `execution.start`
  명령에도 적용. 현재 backend `websocket.gateway.ts` 에 `execution.start`
  @SubscribeMessage 핸들러 자체가 부재 → gate 적용 대상 외.
- [ ] WS gateway 에 `execution.start` 핸들러 신설 (spec `3-workflow-editor/3-execution.md §8.2` 정의 기준)
- [ ] 종료 중 503 + `code: 'SERVER_SHUTTING_DOWN'` + `Retry-After` ack 반환 (HTTP gate 와 동일 의미)
- 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts`, `shutdown/shutdown-state.service.ts`

### G2 — errorPolicy `continue` 분기 on SIGTERM interrupt (§11)
- spec `§11` 항목 4: RUNNING 노드가 grace 내 미완료 시 현재는 errorPolicy 무관 전부
  `failed` 처리(Phase 1 stop 동등). `errorPolicy='continue'` 인 노드는 `failed`
  마킹 대신 다음 노드를 `execution-continuation` 큐로 enqueue 해야 함 (Phase 2 큐
  영속화 완료로 이제 가능).
- [ ] `shutdown-state.service.ts` 의 drain timeout 처리에 errorPolicy 분기 추가
- [ ] `continue` 시 다음 노드 enqueue 경로 연결 + 테스트
- 위치: `codebase/backend/src/modules/execution-engine/shutdown/shutdown-state.service.ts`
- **전제 (consistency plan_coherence)**: errorPolicy 필드가 schema 에 노출돼 있어야 의미가 있다 — `parallel-p2.md §1` errorPolicy schema 노출 완료 후 착수 권장.

### G3 — `exec:cont:seq:<executionId>` Redis 키 TTL 정리 (§9.2)
- spec `§9.2`: continuation publish 의 monotonic seq 키가 executionId 종결 후에도
  TTL 없이 잔류 (동작 무영향이나 Redis 메모리 누수). Phase 3 후속 정리로 예정됨.
- [ ] `continuation-bus.service.ts` 의 `INCR` 후 적절한 `EXPIRE` 설정 (executionId
  최대 수명 + 여유). 또는 execution 종결 시 명시 `DEL`.
- [ ] 완료 시 `spec/data-flow/3-execution.md` (seq 키 "TTL 미설정 — Phase 3 후속" 서술) 병행 갱신.
- 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-bus.service.ts`

## 완료 조건

- G1/G2/G3 모두 구현 + 테스트 → 엔진 spec 본문의 "예정" 문구 제거 → 엔진 spec
  frontmatter 의 마지막 pending_plan 이 본 plan 이면 `status: implemented` 승격
  (spec-impl-evidence §3 (c) 가드).

## 비고

- 본 plan 은 frontmatter `pending_plans` 유효성의 근거이기도 하므로, 미구현이
  남아있는 한 `plan/in-progress/` 에 유지된다.
- G1/G2 는 grace-shutdown 동작이라 multi-instance e2e 인프라 의존 — 우선순위는
  운영 영향도에 따라 별도 판단.
