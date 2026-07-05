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

> **진행 상태 (2026-07-05 갱신)**: G3 구현 완료. **G1 철회(WITHDRAWN)** — "필요성부터 평가"(사용자
> 결정 2026-07-05) 결과 구현할 gap 이 아니라 engine §11 의 stale 서술로 판명(상세 아래 G1 절).
> engine §11 stale 참조 정정 + api-convention §10.3 Planned 마킹으로 종결(PR — spec-only).
> **G2 는 defer 확정**(사용자 2026-07-03) 유지. 따라서 남은 pending = G2 뿐이나, engine spec
> frontmatter 는 G2 미해소로 `status: partial` + 본 plan `pending_plans:` 유지. G2 가 해소돼
> 본 plan 이 마지막 pending 이 될 때 `status: implemented` 승격(spec-impl-evidence §3 (c)).

## 미구현 항목

### G1 — WS `execution.start` graceful-shutdown gate (§11) — 🚫 철회(WITHDRAWN, 2026-07-05)
- [x] **철회로 종결** — 구현하지 않음. G1 은 "미구현 약속"이 아니라 engine §11 의 stale 서술이었다.
- [x] **철회로 종결** — 아래 근거로 gate 신설 불요.
- **철회 근거 (2026-07-05 "필요성 평가")**:
  1. WS `execution.start` 는 `6-websocket-protocol.md §4.2` 가 스키마(`{workflowId, input?, fromNodeId?, breakpoints?}`)·ack 형태까지 갖춰 **의도적으로 계획·미구현(Planned)** 로 분리한 표면이다(같은 문서 Rationale line 955-958 이 "삭제하지 않고 _(계획·미구현)_ 표기 분리"를 명시 결정). 실행 **시작은 REST 전용** — `3-execution.md §8.2`(line 311) 확정, 명령 표에 `execution.start` 없음.
  2. 부분 실행(`fromNodeId`)은 이미 HTTP 로 동작(`POST /api/workflows/:id/execute` body `input.fromNodeId`) — "미정의" 아님(구 차단 사유의 (b) 오인).
  3. HTTP 시작 2진입점은 이미 SIGTERM 503 gate 완료(Phase 1). ungated 시작 경로 없음 → gate 할 실제 gap 부재.
  4. 실제 결함은 engine §11 이 (a) WS `execution.start` 를 활성 503 gate 대상으로 나열하고 (b) "Phase 2 에서 WS handler 신설 예정"이라는 stale forward-ref(Phase 2 완료됐으나 미신설, WS-protocol spec 은 무기한 Planned 로 재정의)를 남긴 것뿐. → **engine §11 을 실제(REST-only + WS Planned)와 정합화**로 종결(PR spec-only).
  5. WS 시작 경로를 실제 도입하려면 별도 product 결정 + `6-websocket-protocol §4.2` Planned 승격 선행. 그때 동일 gate 를 함께 적용한다는 의도는 §11 에 보존됨.
- 위치(참고, 미변경): `codebase/backend/src/modules/websocket/websocket.gateway.ts`
- ~~**차단 사유 (2026-05-30 조사)**~~ (철회로 대체): gate 추가는 작지만, 그 전제인 `execution.start` 핸들러
  신설은 net-new 기능이라 봤던 구 판단. 재평가 결과 net-new 기능 자체가 불요(위 근거).

### G2 — errorPolicy `continue` 분기 on SIGTERM interrupt (§11) — ⛔ BLOCKED

> **2026-06-04 — execution-level intake 큐 재정의와의 관계**: G2 의 "장애물 3 — cross-instance mid-execution 재개 인프라 부재"는 [`exec-park-durable-resume.md`](./exec-park-durable-resume.md) "## PR3 — 크래시 RUNNING 세그먼트 멱등 재개"(§7.5 case B re-drive, **완료 2026-07-04**)로 **부분 해소**된다. 단 G2 본질인 `errorPolicy='continue'` 분기(장애물 1·2: schema 노출·용어 매핑)는 **defer 확정**(사용자 결정 2026-07-03)으로 별개로 남는다 — 크래시 re-drive 가 인프라 토대를 제공하되 G2 자체를 닫지는 않는다.

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

- ~~G1/G2/G3 모두 구현 + 테스트~~ → 현재 **G3 완료 · G1 철회(WITHDRAWN 2026-07-05)**,
  **G2 만 잔존(defer 확정)**. G2 의 `errorPolicy='continue'` interrupt 분기가 미구현 surface 로
  남아있으므로 엔진 spec frontmatter 는 `status: partial` + 본 plan `pending_plans:` 유지
  (spec-impl-evidence §3). **G2 가 해소돼 본 plan 이 마지막 pending_plan 이 될 때** `status: implemented`
  승격 (spec-impl-evidence §3 (c) 가드).

## 비고

- 본 plan 은 frontmatter `pending_plans` 유효성의 근거이기도 하므로, 미구현이
  남아있는 한 `plan/in-progress/` 에 유지된다.
- G2 는 grace-shutdown 동작이라 multi-instance e2e 인프라 의존 — 우선순위는
  운영 영향도에 따라 별도 판단. (G1 은 철회로 종결.)
