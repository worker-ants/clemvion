---
worktree: g1-withdraw-ws-start-gate-d0f7c5
started: 2026-07-05
owner: project-planner
spec_impact:
  - spec/5-system/4-execution-engine.md
  - spec/5-system/2-api-convention.md
---

# spec-draft: G1 철회 — engine §11 의 stale WS `execution.start` gate 참조 정정

## 배경 (G1 필요성 평가 결론)

`execution-engine-residual-gaps.md` 의 **G1**(WS `execution.start` graceful-shutdown gate)을 "필요성부터 평가"(사용자 결정 2026-07-05)한 결과: **불필요 — 구현할 gap 이 아니라 engine §11 의 stale 서술**.

### 사실관계 (검증됨)

- **WS `execution.start` 는 이미 spec 에서 계획·미구현(Planned)으로 정식 분리돼 있다** — `6-websocket-protocol.md §4.2`(line 197·201·213-217)가 스키마(`{workflowId, input?, fromNodeId?, breakpoints?}`)·ack 형태까지 정의하되 **미구현(Planned)** 으로 명시하고, 같은 문서 Rationale(line 955-958)이 "삭제하지 않고 _(계획·미구현)_ 로 표기 분리" 를 **의도적 결정**으로 기록. `3-execution.md §8.2`(line 311)도 "실행 **시작**은 WS 명령이 아니라 REST … WS 명령은 채널 구독·입력 대기 상호작용에 한정" 으로 REST-only 확정, 명령 표에 `execution.start` 없음.
- **부분 실행(`fromNodeId`)은 이미 HTTP 로 동작** — `POST /api/workflows/:id/execute` body `input.fromNodeId`(`3-execution.md` line 40·330). "미정의" 아님.
- **HTTP 시작 진입점 2개는 이미 SIGTERM 503 gate 적용(Phase 1 완료)** — 실행 시작에 ungated 경로 없음.
- 따라서 G1 이 말하는 "WS `execution.start` gate 미적용" 은 실제 gap 이 아니다 — 시작은 REST 전용이고 그 경로는 이미 gated. WS 시작 경로는 존재하지 않는(indefinitely Planned) 미래 표면일 뿐.

### 실제 결함 (engine §11 국소)

`4-execution-engine.md §11` 만 낡았다:

1. **line 1226** — WS `execution.start` 명령을 **활성 503 gate 대상**으로 나열. 그러나 미구현이라 503 을 반환할 대상이 애초에 없다.
2. **line 1228** — (a) "WS `execution.start` 명령은 spec §8.2(`3-execution.md`)에 정의" 라는 **잘못된 cross-ref**(실제 정의처는 `6-websocket-protocol.md §4.2`), (b) "**Phase 2 에서 WS handler 신설 시 동일 gate 추가 예정**" 라는 **stale forward-ref** — Phase 2(continuation 큐)는 완료됐고 WS handler 는 신설되지 않았으며, WS-protocol spec 은 이를 (Phase 2 가 아니라) 무기한 Planned 로 재정의함.

`api-convention.md §10.3`(line 278) 도 `execution.start/stop/continue` 를 live "실행 제어" 명령처럼 나열 → Planned 표기 누락(경미).

## 결정

**G1 은 구현하지 않고 철회(WITHDRAWN)**하며, engine §11 의 stale 서술을 실제(REST 전용 시작 + WS 시작은 Planned)와 정합화한다. non-breaking(문서만). WS 시작 경로를 실제 도입하려면 별도 product 결정 + `6-websocket-protocol.md §4.2` Planned 승격이 선행 — 그때 동일 gate 를 함께 적용한다는 의도는 §11 에 보존.

## 변경

### 변경 1 — `4-execution-engine.md §11` line 1226 (503 gate 대상에서 WS 제거)

- 기존: "…HTTP 진입점(`POST /api/workflows/:id/execute`, 단일 노드 `POST /api/workflows/:id/nodes/:nodeId/execute`) **및 WS [`execution.start`](./6-websocket-protocol.md#42-실행-제어-명령-client--server) 명령**이 **503 Service Unavailable** 응답. …"
- 변경: "및 WS `execution.start` 명령" 구절 삭제 → "…HTTP 진입점(…)이 **503 Service Unavailable** 응답. …" (나머지 문장 동일)

### 변경 2 — `4-execution-engine.md §11` line 1228 (Phase 1 note 정정)

- 변경: "> **구현 범위**: HTTP 진입점(`POST /api/workflows/:id/execute` + 단일 노드 `POST /api/workflows/:id/nodes/:nodeId/execute`) gate 가 구현됨 — 실행 시작은 **REST 전용**이라 이 두 진입점으로 시작 gate 가 완결된다. WS `execution.start` 는 [6-websocket-protocol §4.2](../5-system/6-websocket-protocol.md#42-실행-제어-명령-client--server) 에 **계획·미구현(Planned)** 경로로만 정의돼 있고(WS gateway 에 핸들러 부재), 그 Planned WS 시작 경로가 향후 도입되면 동일한 SIGTERM 503 gate 를 함께 적용한다."
  - 주: §11 은 `4-execution-engine.md`(5-system) 내부라 상대경로 `./6-websocket-protocol.md`. (원문 line 1228 은 `../3-workflow-editor/...` 로 타 폴더를 참조했던 것.)

### 변경 3 — `api-convention.md §10.3` line 278 (Planned 표기)

- 기존: `| 실행 제어 | Client → Server | execution.start/stop/continue |`
- 변경: `| 실행 제어 | Client → Server | execution.start/stop/continue _(계획·미구현 — [6-websocket-protocol §4.2](./6-websocket-protocol.md#42-실행-제어-명령-client--server))_ |`
- 주: api-convention §10 전반의 WS 정합은 `spec-sync-websocket-protocol-gaps.md` 소관 — 본 변경은 execution.start 정합에 직접 관련된 최소 마커만.

### 변경 4 — plan `execution-engine-residual-gaps.md` G1 WITHDRAWN 처리

- G1 헤딩 `⛔ BLOCKED` → `⛔ WITHDRAWN (2026-07-05)`. 체크박스 2개는 표준 마커 유지(`[x]` — "철회로 종결" 명시. `[~]` 등 비표준 마커 미도입 — naming_collision INFO 반영). 철회 사유(위 결론) 기재. "진행 상태" 헤더·"완료 조건" 도 G1 철회 반영(남은 pending = G2 defer 뿐). engine spec frontmatter `status: partial` 은 G2 가 남아 유지.

### 변경 5 — `4-execution-engine.md` frontmatter `pending_plans` dangling 엔트리 제거 (plan_coherence WARNING)

- `pending_plans` 에서 `plan/in-progress/spec-sync-execution-engine-gaps.md` 제거 — 해당 plan 은 이미 `plan/complete/` 로 이동돼 in-progress 에 부재(dangling pointer, 선재 이슈). 나머지 3개(`execution-engine-residual-gaps.md`·`exec-intake-followups.md`·`exec-park-durable-resume.md`)는 모두 in-progress 실재 확인 → 유지. spec-impl-evidence §3 pending_plans 유효성 정합.

## Rationale

- **철회 근거**: G1 은 "미구현 약속" 이 아니라 engine §11 의 stale 서술이다. WS `execution.start` 는 `6-websocket-protocol.md §4.2` 가 스키마·ack 까지 갖춰 **의도적으로 Planned(미구현)** 로 분리한 표면이고(같은 문서 Rationale line 955-958 이 "삭제하지 않고 _(계획·미구현)_ 표기 분리" 를 명시 결정), 실행 시작은 `3-execution.md §8.2` 가 REST-only 로 확정했다. HTTP 시작 2진입점은 이미 SIGTERM 503 gate 완료라 ungated 시작 경로가 없다. → 구현할 gap 부재.
- **보존한 의도**: §11 의 "향후 WS 시작 경로 도입 시 동일 gate 적용" 의도는 삭제하지 않고 "Planned 경로 도입 시 동일 gate" 로 정확히 재서술(조건부 커밋 유지, 무근거 번복 아님).
- **기각 대안**: (a) WS `execution.start` 핸들러를 실제 신설해 gate — product driver 없음(프런트는 HTTP 시작, 이미 gated) + `6-websocket-protocol §4.2` Planned 승격이라는 상위 결정 선행 필요 → 과잉. (b) `6-websocket-protocol §4.2` 의 execution.start 정의를 삭제 — 그 문서 Rationale 의 "Planned 로 보존" 결정을 번복하므로 부적절. 채택안은 engine §11 만 실제(REST-only + WS Planned)와 정합화.
- **동반 정정**: api-convention §10.3 의 execution.start/stop/continue 를 Planned 로 마킹(경미, SoT 는 `6-websocket-protocol §4.2`), engine frontmatter 의 dangling `pending_plans` 엔트리(complete 로 이동된 plan) 제거.

## 체크리스트

- [x] /consistency-check --spec (본 draft) — BLOCK: NO (11_10_25, 5/5 clean; WARNING 2건 조치)
- [x] spec 반영 (변경 1·2·3·5) + plan G1 WITHDRAWN (변경 4)
- [ ] commit + PR (origin/main)
- [ ] memory
