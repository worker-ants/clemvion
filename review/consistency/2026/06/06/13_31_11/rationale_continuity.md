# Rationale 연속성 검토 결과

검토 대상: `spec/5-system/4-execution-engine.md`
검토 모드: `--impl-prep` (구현 착수 전)
검토 일시: 2026-06-06

---

## 발견사항

이번 검토는 `fix-carousel-waiting-status` plan 의 구현 착수 직전 검토로, plan 이 수정하려는 영역(스냅샷 정규화 — `executions.service.findById`, `apply-execution-snapshot.ts`)과 spec `§1.1`/`§1.2` 상태 머신, `§6.2` 저장 전략 Rationale 사이의 충돌을 집중 점검했다.

- **[INFO]** `§1.2` NodeExecution 상태 설명에 plan 이 전제하는 intra-row 불일치 케이스 기술 없음
  - target 위치: `spec/5-system/4-execution-engine.md §1.2` `waiting_for_input` 상태 행 및 §1.1 원자성 보장 비고
  - 과거 결정 출처: 본 문서 `## Rationale` — `waiting_for_input → failed 전이 추가` 항, `§1.1` "원자성 보장" 비고
  - 상세: spec 의 `§1.1` 원자성 보장 비고는 "`running ↔ waiting_for_input` 전이는 짝이 되는 NodeExecution 상태 변경과 단일 DB 트랜잭션"으로 명문화한다. plan 이 지적하는 회귀 — `executeNode` 분기에서 `outputData` 만 저장하고 status 전이는 `waitForButtonInteraction` 호출 후에야 발생하는 **intra-row 시간 창** — 은 이 원자성 보장의 예외 케이스(트랜잭션 내부이지만 두 save 사이의 중간 상태가 외부 snapshot 에 노출될 수 있는 윈도우)이며, spec 본문이 이 케이스를 명시하지 않는다. fix 의 **read-side 정규화**(스냅샷 서비스에서 비terminal + `outputData.status==='waiting_for_input'` 시 status 를 `waiting_for_input` 으로 surface)는 기존 원자성 원칙을 우회하거나 위반하는 것이 아니라 read 경로의 defensive normalization 이므로 Rationale 위반은 없다. 다만 이 normalization 결정의 근거를 spec `§1.1` 원자성 비고 또는 `§6.2` 저장 전략에 한 줄 기록해 두면 후속 독자가 "왜 read-side 에서 status 를 재작성하는가"를 이해할 수 있다.
  - 제안: 구현 후 spec `§1.1` 원자성 보장 비고 또는 `§6.2` "노드 완료 시" 행에 "read-path normalization: `outputData.status==='waiting_for_input'` + 비terminal row 는 스냅샷 서비스가 status 를 `waiting_for_input` 으로 surface (intra-row window 보정)"를 INFO 수준 주석으로 추가하는 후속 spec 갱신을 `project-planner` 에 위임한다.

- **[INFO]** PR-B1·PR-B2a park-release 전환 이후 `apply-execution-snapshot.ts` 방어 로직의 spec 기술 부재
  - target 위치: `spec/5-system/4-execution-engine.md §4.x` (waiting_for_input park), `§7.5` rehydration
  - 과거 결정 출처: 본 문서 `## Rationale` — `park 즉시 해제 + slow-path 일원화 (Phase B)` 항 (단계 롤아웃 설명)
  - 상세: Phase B park-release 이후 WS `waiting_for_input` 이벤트가 스냅샷보다 먼저 도착하는 경쟁 조건은 단계 롤아웃의 자연스러운 결과다. spec Rationale 은 park-release 를 결정으로 기록했으나, 그 결과로 frontend 가 event-before-snapshot 레이스를 처리해야 한다는 파생 요구사항은 아직 spec 에 기술되지 않았다. plan 의 frontend fix — WS event 가 먼저 set 한 waiting 상태를 snapshot 이 wipe 하지 않도록 `apply-execution-snapshot.ts` 방어 — 는 이 파생 요구를 구현하는 것으로, 기존 결정(park-release + 단일 slow-path 일원화)을 번복하지 않는다. 번복이 아닌 파생 구현이므로 Rationale 충돌 없음. 단, spec 에 이 frontend 방어 결정의 근거가 남지 않는다는 점은 INFO 수준 gap 이다.
  - 제안: 구현 완료 후 spec `§7.5` rehydration 또는 `§4.x` park 절에 "frontend snapshot 정합: WS event 가 snapshot poll 보다 선행 도착할 수 있으므로 apply-execution-snapshot 은 waiting 상태를 snapshot 이 되돌리지 않도록 방어한다"를 짧게 기록하는 후속 spec 갱신을 `project-planner` 에 위임한다.

---

## 요약

`spec/5-system/4-execution-engine.md` 의 Rationale 에는 (a) `waiting_for_input ↔ running` 단일 트랜잭션 원자성 원칙, (b) park-release + slow-path 일원화 결정, (c) per-node task queue 기각, (d) BullMQ 영속 continuation 채택 등 핵심 설계 원칙이 명문화되어 있다. 금번 `fix-carousel-waiting-status` plan 의 수정 내용(read-side 스냅샷 정규화 + frontend waiting-state wipe 방어)은 이 결정들을 번복·우회하거나 기각된 대안(per-node task queue, in-memory only resolver 등)을 재도입하지 않는다. 두 개의 INFO 항목은 구현 완료 후 spec 에 파생 결정을 보완 기록하면 해소될 정도의 문서 gap 이다. CRITICAL·WARNING 수준의 Rationale 연속성 충돌은 발견되지 않았다.

---

## 위험도

NONE

---

STATUS: OK
