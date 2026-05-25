# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-fix-graceful-shutdown-phase-scope.md`
검토 모드: spec draft 검토 (--spec)
검토 일시: 2026-05-25

---

## 발견사항

### 발견사항 1

- **[CRITICAL]** step 1 제안: `POST /api/executions/start` → `POST /api/workflows/:id/execute` 로 endpoint 명 교체 — spec 내부 단일 진실 충돌
  - target 위치: `## 제안 변경 / spec/5-system/4-execution-engine.md §11 step 1 보정` 제안 텍스트
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md §11` 본문 (현행) — `POST /api/executions/start` 가 SIGTERM gate 대상으로 명시되어 있음. `spec/3-workflow-editor/3-execution.md §(API 표)` 에는 `POST /api/workflows/:id/execute` 가 별개 표기로 등재됨
  - 상세: 현행 §11 step 1 은 `POST /api/executions/start` 를 503 gate 대상으로 명시한다. target 제안은 이를 이유 없이 `POST /api/workflows/:id/execute` 로 교체한다. 두 endpoint 명이 동일 진입점을 가리키는지, 아니면 다른 경로인지 spec 어디에도 명시적 정의·동치 선언·alias 관계가 없다. `spec/3-workflow-editor/3-execution.md` API 표는 `/api/workflows/:id/execute` 를 사용하고, `spec/4-nodes/7-trigger/0-common.md` 는 `POST /workflows/:id/execute` 를 사용하는 반면, §11 본문은 `POST /api/executions/start` 를 독자적으로 사용한다. 이 불일치가 지금까지 spec 내부 drift 로 잠재해 있었고 (C-1 발견의 배경일 가능성), target 제안은 §11 의 endpoint 명을 다른 spec 표기 중 하나로 교체하면서도 (a) 두 표기의 동치 여부 확인 없이, (b) Rationale 신규 작성 없이 진행한다. 만약 두 endpoint 가 서로 다른 경로라면 503 gate 범위가 변경되는 결정적 오류다. 동치라면 §11 에서 사용하는 표기를 바꾸는 이유와 어느 표기를 single source of truth 로 삼을지 Rationale 에 기술해야 한다.
  - 제안: target 을 반영하기 전에 두 endpoint 명이 (a) 동일 HTTP 핸들러에 매핑되는지, (b) 어느 쪽이 spec SoT 인지를 먼저 확인하고, 교체 사유와 함께 `spec/5-system/4-execution-engine.md §11` Rationale 에 `Phase 1 endpoint 명 정합 (2026-05-25)` 항목을 추가한다. 동치가 확인되면 `spec/3-workflow-editor/3-execution.md`, `spec/4-nodes/7-trigger/0-common.md`, `spec/5-system/4-execution-engine.md §11` 셋을 일관된 표기로 일괄 정합하는 별도 spec fix 를 함께 계획한다.

---

### 발견사항 2

- **[WARNING]** step 4 제안: `errorPolicy` 분기를 사실상 제거하는 "Phase 1 범위" 주석 삽입 — Durable Continuation Rationale 의 설계 원칙과 긴장
  - target 위치: `## 제안 변경 / spec/5-system/4-execution-engine.md §11 step 4 보정` 제안 텍스트
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md §Rationale "Durable Continuation & Graceful Shutdown (2026-05-24)"` — `errorPolicy` 분기(`stop → Execution failed`, `continue → 다음 노드 enqueue`) 는 동일 Rationale 이 채택한 §11 step 4 설계의 일부. 이 Rationale 은 기각 대안 2번("WAITING_FOR_INPUT → INTERRUPTED 신규 enum 도입") 처럼 변경 표면적을 최소화하는 원칙을 명시했다.
  - 상세: target 은 step 4 본문을 `errorPolicy` 분기 없이 "전체 `stop` 동등 처리" 로 단순화하는 텍스트로 교체하고 `continue` 분기를 Phase 2 로 미룬다고 주석을 달았다. 그런데 현행 §11 step 4 의 `errorPolicy` 분기는 Durable Continuation Rationale (2026-05-24) 이 §11 을 처음으로 spec 에 포함시키면서 확정한 설계다. 즉 "이미 기각된 대안을 재도입" 한 것은 아니지만, 확정된 설계의 일부 분기를 Phase 2 로 후퇴시키면서 Rationale 에 그 이유를 기재하지 않았다. continuation-queue 구현 선행 필요성이라는 기술적 근거가 있으나 이는 target 의 `## 현황 분석` 에만 있고 spec 본문의 Rationale 에는 없다. Durable Continuation Rationale 이 이미 `continue → 다음 노드 enqueue` 를 확정했으므로, 이를 Phase 2 로 미루는 결정은 spec Rationale 의 갱신을 수반해야 한다.
  - 제안: target 반영 시 `spec/5-system/4-execution-engine.md §Rationale` 에 `Graceful Shutdown Phase 1 범위 — errorPolicy continue 분기 후퇴 (2026-05-25)` 항목을 추가한다. 항목 내용: (a) `continue` 분기가 BullMQ `execution-continuation` 큐 (Phase 2) 구현 선행을 요구하므로 Phase 1 에서는 `stop` 동등 처리로 임시 한정, (b) Phase 2 구현 완료 시 §11 step 4 를 원래 설계(`stop/continue` 분기)로 복원하는 것이 이미 결정된 사항임을 명기. `## 주의사항` 의 "Phase 2 구현 시 … 명세에 맞게 갱신" 문장을 spec Rationale 에 이관하는 형태로 처리한다.

---

### 발견사항 3

- **[WARNING]** step 1 보정 제안의 WS gate 주석이 `execution.start` WS 명령 자체의 spec 위치를 특정하지 않음 — 향후 Phase 2 추적 불가
  - target 위치: `## 제안 변경 / §11 step 1 보정` 의 Phase 1 구현 범위 주석
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md §11 step 1` 현행 — `WS \`execution.start\`` 가 명시적으로 503 gate 대상으로 기록되어 있으며, 이 WS 명령의 정의 위치는 `spec/5-system/6-websocket-protocol.md` 로 추정됨
  - 상세: target 의 주석은 "WS `execution.start` 명령은 현재 미구현 상태이며 Phase 2 (continuation-queue 본구현) 에서 추가 예정" 이라고만 기술한다. 그런데 `spec/5-system/6-websocket-protocol.md` 에 이 WS 명령이 정의되어 있는지, 아직 미정의 상태인지가 명확하지 않다. WS gate 가 Phase 2 scope 라면 해당 사실을 WS 프로토콜 spec 에도 표기해야 drift 가 없다. 또한 "Phase 2" 를 트리거하는 plan 파일 참조가 없어 추적 고리가 끊겨 있다.
  - 제안: target 주석에 WS 프로토콜 spec (`spec/5-system/6-websocket-protocol.md`) 참조와 Phase 2 추적 plan (`plan/in-progress/workflow-resumable-execution.md` 또는 신규 plan) 링크를 추가한다. WS 프로토콜 spec 에도 `execution.start` 명령이 Phase 2 에서 추가될 예정임을 명기하는 Phase annotation 을 달아야 한다.

---

### 발견사항 4

- **[INFO]** `spec/1-data-model.md §2.13` 에 `WORKER_HEARTBEAT_TIMEOUT` 추가 — 기존 Rationale "Durable Continuation & Graceful Shutdown (2026-05-24)" 의 상위 spec 동반 갱신 목록과 일관
  - target 위치: `## 제안 변경 / spec/1-data-model.md §2.13 error.code 어휘 보완`
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md §Rationale "Durable Continuation & Graceful Shutdown (2026-05-24)"` — `spec/1-data-model.md §2.13` Execution.error 에 `SERVER_INTERRUPTED`, `RESUME_FAILED`, `RESUME_CHECKPOINT_MISSING`, `RESUME_INCOMPATIBLE_STATE` 4종 추가를 명시했음
  - 상세: Durable Continuation Rationale 이 이미 4종의 error code 를 §2.13 에 추가하도록 결정했다. target 은 여기에 `WORKER_HEARTBEAT_TIMEOUT` 을 추가로 포함한다. 이 추가 자체는 기각된 결정의 재도입이나 합의 원칙 위반이 아니며, `recoverStuckExecutions` 가 실제로 설정하는 코드를 spec 어휘에 반영하는 정합 보완이다. 다만 Rationale 에 `WORKER_HEARTBEAT_TIMEOUT` 신규 추가의 배경을 한 줄 기술하면 향후 독자가 "왜 이 코드가 Durable Continuation 항과 별개로 추가됐는가" 를 알 수 있다.
  - 제안: target 의 §2.13 보완과 함께 `spec/5-system/4-execution-engine.md §Rationale "Durable Continuation & Graceful Shutdown (2026-05-24)"` 의 "상위 spec 동반 갱신" 목록에 `WORKER_HEARTBEAT_TIMEOUT` 어휘 추가 항목을 보충 기재한다. 이는 선택적 개선이며 차단 요인이 아니다.

---

## 요약

target 문서는 Durable Continuation Rationale (2026-05-24) 이 확정한 §11 설계를 Phase 1 scope 로 한정하기 위해 두 곳(step 1 WS gate, step 4 `errorPolicy continue` 분기)을 후퇴시키는 변경을 제안한다. 발견사항 1(CRITICAL)은 endpoint 명 교체(`POST /api/executions/start` → `POST /api/workflows/:id/execute`)가 이유·동치 선언 없이 이루어지면서 spec 내부 단일 진실 충돌을 일으킨다는 점으로, 반영 전 두 표기의 동치 여부 확인과 Rationale 작성이 필수다. 발견사항 2(WARNING)는 `errorPolicy continue` 분기의 Phase 2 후퇴가 의도된 결정임에도 새 Rationale 없이 제안된 것으로, Durable Continuation Rationale 에 보완 항목을 추가해야 결정의 연속성이 보장된다. 발견사항 3(WARNING)은 WS gate Phase 2 계획의 추적 고리(plan 링크·WS 프로토콜 spec annotation) 부재, 발견사항 4(INFO)는 `WORKER_HEARTBEAT_TIMEOUT` 추가에 대한 Rationale 보충 권고다. 기각된 대안이 직접 재도입된 사례는 없으나, CRITICAL 1건(endpoint 명 동치 미확인)이 차단 요인이 된다.

---

## 위험도

HIGH
