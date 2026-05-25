# Rationale 연속성 검토 결과

**검토 모드**: spec draft 검토 (--spec)
**Target**: `plan/in-progress/spec-update-workflow-resumable-execution-phase2-followup.md`
**검토 시각**: 2026-05-25

---

## 발견사항

### 1. [INFO] 변경 1 — `task-queue` 행 삭제는 기존 Rationale 와 완전 정합

- **target 위치**: plan 문서 "변경 1" — `spec/5-system/4-execution-engine.md §9.3` `task-queue` 행 삭제 및 §11 Graceful Shutdown 항목 2 토큰 제거
- **과거 결정 출처**: 
  - `spec/5-system/4-execution-engine.md §Rationale "Durable Continuation & Graceful Shutdown (2026-05-24)"` — "4. (채택) BullMQ 영속 `execution-continuation` 큐 + §7.5 rehydration 경로. 이미 `background-execution` 큐로 동일 패턴이 검증됨."
  - `spec/0-overview.md §Rationale "실행 엔진: Redis 큐 + 분산 워커 풀"` — "BullMQ `execution-continuation` … `background-execution` … 같은 Redis 재사용해 net 부담이 낮다."
  - `review/consistency/2026/05/25/07_12_25/SUMMARY.md` I6 — "`§9.3 BullMQ 큐 목록` `task-queue` 행에 '구현 검증 후 확정/삭제' 미확정 표기 잔류"
- **상세**: worktree spec `§9.3`의 `task-queue` 행은 이미 "구현 검증 후 본 행 확정/삭제"라는 미확정 표기로 등록된 상태였다. target 이 코드베이스 사실(`background-execution` + `execution-continuation` 두 큐만 존재, 일반 노드 실행은 in-process while-loop)을 근거로 해당 행을 삭제하는 것은 기각된 대안의 재도입이 아니다. `task-queue`가 별도 BullMQ 큐로 존재한다는 가정은 spec 어디에서도 합의된 결정으로 채택된 적이 없었으며, 미확정 표기 자체가 "확인 후 삭제 가능성"을 명시하고 있었다.
- **제안**: 현재 제안대로 진행 가능. 다만 `spec/5-system/4-execution-engine.md §Rationale`에 "2026-05-25: `task-queue` 행 삭제 — Phase 2 cont 코드베이스 확인 결과 해당 큐 미존재. 일반 노드 실행은 `runExecution` in-process while-loop 경유" 한 줄을 남기면 미래 독자에게 근거가 명확해진다.

---

### 2. [INFO] 변경 2.1 — `§7.5.1` 신설은 기존 Durable Continuation Rationale 의 자연스러운 확장

- **target 위치**: plan 문서 "변경 2.1" — `spec/5-system/4-execution-engine.md §7.5` 끝에 `§7.5.1 Publisher 측 사전 검증 — INVALID_EXECUTION_STATE` 신설
- **과거 결정 출처**:
  - `spec/5-system/4-execution-engine.md §7.4` (worktree) — "입력 receiver → enqueuer: … 0건 또는 다중 row 이면 즉시 client 에 에러 (`INVALID_EXECUTION_STATE`)"
  - `review/consistency/2026/05/25/07_12_25/SUMMARY.md` W14 — "`INVALID_EXECUTION_STATE` 반환 조건 불완전, codebase 미구현"
  - `Durable Continuation & Graceful Shutdown (2026-05-24)` Rationale — "입력 receiver 책임" 원칙 암묵 포함
- **상세**: `§7.4` 본문은 "0건 또는 다중 row → 즉시 `INVALID_EXECUTION_STATE`"를 이미 명시했으나 각 케이스의 구체적 의미와 에러 반환 조건이 누락되어 있었다 (W14). target 의 `§7.5.1` 신설은 이 기술 갭을 채우는 것으로, 기존 원칙(항상 enqueue 전에 DB lookup 검증)과 충돌하지 않는다. 기각된 대안(publish 후 worker 에서 검증) 재도입도 아니며, "신규 인프라 도입 없음" 원칙도 계승한다.
- **제안**: 현재 제안대로 진행 가능.

---

### 3. [WARNING] 변경 2.1 — `INVALID_EXECUTION_STATE`를 "WS ack 전용 코드"로 확정하는 것이 기존 합의에 없던 새 결정이나 Rationale 부재

- **target 위치**: plan 문서 "변경 2.1" `§7.5.1` 신규 텍스트 — "`INVALID_EXECUTION_STATE` 는 **WS ack 전용 코드** — REST 진입점은 같은 의미로 422 `INVALID_STATE` … 를 반환한다 (REST 공용 카탈로그와의 이름 충돌 회피)."
- **과거 결정 출처**:
  - `spec/5-system/3-error-handling.md` 공용 422 `INVALID_STATE` 카탈로그 — REST 422 코드로 존재
  - `spec/5-system/6-websocket-protocol.md §4.2` — `INVALID_EXECUTION_STATE`를 WS ack 표에 기술 (현재 "WS 전용"이라는 명시 없음)
  - `review/consistency/2026/05/25/07_12_25/SUMMARY.md` W15 — "`INVALID_EXECUTION_STATE` (WS 전용) vs `INVALID_STATE` (REST 공용 422) — 유사 이름 혼동 가능성"
- **상세**: "WS ack 전용"이라는 분류는 spec 어디에도 기존에 합의된 결정이 아니었다. W15 가 혼동 가능성을 지적했으나, "WS 전용으로 결정"한다는 의미는 아니었다. target이 이 분류를 새로 채택한다면 그에 따른 Rationale 가 필요하다: (a) 왜 WS/REST 두 layer 에서 다른 이름을 유지하는가, (b) 통일하는 대안(REST도 `INVALID_EXECUTION_STATE` 사용하거나 WS도 `INVALID_STATE` 사용) 이 왜 기각되는가. target 의 `변경 2.2` 비고 문구("historical artifact")가 암묵적 설명을 담고 있으나, spec Rationale 섹션에 공식 등재되지 않는다면 미래 독자에게 결정 근거가 유실될 위험이 있다.
- **제안**: `spec/5-system/4-execution-engine.md §Rationale` 에 또는 `spec/5-system/6-websocket-protocol.md §Rationale` 에 "WS/REST 이름 분리 유지 이유" 한 단락을 추가한다. target 의 변경 2.2 비고 문구 내용("WS 전용 코드 — REST 공용 422 `INVALID_STATE` 와 별개. 같은 의미론을 의도한 것, historical artifact")을 Rationale 로 공식화하면 충분하다.

---

### 4. [INFO] 변경 2.2 — `6-websocket-protocol.md §4.2` 주석 추가는 W15 권고의 직접 이행

- **target 위치**: plan 문서 "변경 2.2" — `spec/5-system/6-websocket-protocol.md §4.2` `INVALID_EXECUTION_STATE` 행에 주석 한 줄 추가
- **과거 결정 출처**: `review/consistency/2026/05/25/07_12_25/SUMMARY.md` W15 — "`§4.2` 에러 코드 표에 'WS 전용, REST `INVALID_STATE` 와 별개' 주석 한 줄 추가" 권고
- **상세**: W15 권고의 직접 이행이며 기존 Rationale 와 충돌하지 않는다. 다만 "historical artifact" 표현은 미래 독자가 "그러면 이름을 통일해야 한다"고 오해할 수 있다. "의도적 분리 유지 (WS layer 에서 REST 공용 코드 재사용 시 클라이언트 error routing 혼동 위험)" 정도의 표현이 더 명확하다.
- **제안**: 주석 문구에서 "historical artifact"를 "의도적 분리 — WS ack error 와 REST 422 error 의 routing 분기가 클라이언트에서 동일 코드를 다르게 처리해야 하는 혼동 회피" 로 보완 권장 (또는 Rationale 에 이유를 기술하고 이 주석에서는 Rationale 링크를 거는 방식).

---

### 5. [INFO] 변경 2.3 — 구현 후행 작업 분리는 Durable Continuation Rationale 의 "변경 표면 최소화" 원칙과 정합

- **target 위치**: plan 문서 "변경 2.3" — `resolveWaitingNodeExecutionId` throw 전환을 별 PR 로 분리 권장
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md §Rationale "Durable Continuation & Graceful Shutdown (2026-05-24)"` — "신규 인프라 도입 없음", 변경 표면 최소화 기조
- **상세**: 현재 구현이 sentinel publish → worker rehydrateAndResume → `RESUME_CHECKPOINT_MISSING` 으로 surface 하는 것은 1-2초 지연이 있지만 최종 결과는 동일하다는 target 의 판단은 Durable Continuation Rationale 의 "변경 표면 최소화" 기조와 부합한다. 단, spec `§7.5.1` 에 "client 에 즉시 `INVALID_EXECUTION_STATE`를 반환한다"고 규범적으로 기술한 뒤 실제 구현이 달라진다면 spec-impl 갭이 생긴다.
- **제안**: `§7.5.1` 신설 텍스트에 "Phase 2 cont 시점의 구현은 sentinel publish 경로로 우회 — 후속 PR 에서 동기 반환으로 전환 예정 (`plan/in-progress/` 추적)"이라는 구현 현황 인라인 노트를 추가한다.

---

### 6. [INFO] `§9.3` 표의 `execution-continuation` 행 비고 표현이 target 제안 표와 기존 worktree spec 표 사이에 미세한 차이 존재

- **target 위치**: plan 문서 "변경 1" 제안 표 — `execution-continuation` 행 비고 "Durable Continuation (2026-05-24) 으로 도입. 옛 Redis pub/sub `execution:continuation` 채널 대체"
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md §9.3` (worktree 현재) — 동일 내용이 이미 기재되어 있음
- **상세**: target 이 제안하는 `execution-continuation` 행 비고 표현은 worktree 현재 spec `§9.3`의 표기와 실질적으로 동일하다. `task-queue` 행 삭제 후 나머지 두 행이 그대로 유지되는 것을 target 이 명시하고 있어 기존 합의와 충돌 없다. 다만 `background-execution` 행의 "기존값 유지"는 실제 `attempts` 값이 명시되어 있지 않아 독자 혼동 가능성이 있다.
- **제안**: `background-execution` 행의 "기존값 유지" 대신 실제 설정값(또는 코드 상수명)으로 채울 것을 권장. 미확정이면 "코드 상수 (`BACKGROUND_EXECUTION_QUEUE_ATTEMPTS`) — spec 본문 §3.3 참조" 형식으로 추적 가능하게 남긴다.

---

## 요약

Target 문서 (`plan/in-progress/spec-update-workflow-resumable-execution-phase2-followup.md`) 의 두 변경 모두 기존 Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의된 invariant 를 위반하지 않는다. 변경 1(`task-queue` 삭제)은 prior review I6 의 직접 이행이며 Durable Continuation Rationale 의 "채택: BullMQ `execution-continuation` + `background-execution` 두 큐" 결정과 정합한다. 변경 2(`INVALID_EXECUTION_STATE` spec 등재)는 prior review W14/W15 의 직접 이행이며 기각된 대안 재도입 없음. 단, 변경 2.1 에서 "`INVALID_EXECUTION_STATE` = WS ack 전용 코드"를 새롭게 확정하는 부분에 Rationale 공식 등재가 없어 WARNING 수준의 결정 무근거 번복 위험이 존재한다 — 이는 "WS/REST 두 layer 에서 다른 이름을 유지하는 이유"를 spec Rationale 에 한 단락으로 기술함으로써 해소 가능하다. 변경 2.3 의 구현 후행 분리는 "spec 에 동기 반환 규범 기술 후 구현은 지연" 이라는 spec-impl 갭을 낳으므로 구현 현황 인라인 노트 추가가 권장된다.

---

## 위험도

LOW
