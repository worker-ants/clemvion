# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-prep` (구현 착수 전 검토)
Target: `spec/5-system/` (전체 영역)
검토 기준일: 2026-05-25

---

## 발견사항

### [INFO] `spec/5-system/1-auth.md` §5 — `/api/auth/2fa/webauthn/availability` 엔드포인트 응답 래핑

- target 위치: `spec/5-system/1-auth.md §5` API 엔드포인트 표
- 충돌 대상: `spec/5-system/2-api-convention.md` (API 응답 표준 래퍼)
- 상세: `§5` 의 엔드포인트 표에서 `GET /api/auth/2fa/webauthn/availability` 응답이 `{ data: { enabled: boolean } }` 로 기술되어 있고 `§1.4.3` 에서는 `{ data: { enabled: boolean } }` 로 한 번 더 명시한다. API 규약 spec 과의 일치 여부를 코드 구현 시 확인해야 하지만, 현 draft 수준에서는 명시적 충돌 없음. 구현 전 `2-api-convention.md` 의 성공 응답 래퍼 패턴과 동일한지 확인 권장.
- 제안: 구현 시 `2-api-convention.md §4` 의 단일 객체 응답 패턴(`{ data: {...} }`)을 준수하는지 확인. 현재 spec 기술은 규약과 일치하므로 spec 수정 불필요.

---

### [INFO] `spec/5-system/1-auth.md §4.3` LoginHistory — `webauthn_failed` 이벤트와 `spec/1-data-model.md §2.18.2`

- target 위치: `spec/5-system/1-auth.md §4.3 로그인 이력 (LoginHistory)` 이벤트 테이블
- 충돌 대상: `spec/1-data-model.md §2.18.2 LoginHistory`
- 상세: `1-auth.md §4.3` 의 LoginHistory 이벤트 목록에 `webauthn_failed` 가 포함되어 있고, `1-data-model.md §2.18.2` 의 `event` Enum 열거값에도 `webauthn_failed` 가 동일하게 포함되어 있다. 두 spec 이 일치하므로 충돌 없음.
- 제안: 정보 일치 확인 완료. 별도 조치 불필요.

---

### [INFO] `spec/5-system/10-graph-rag.md §2.3 Entity.type` — Enum 정의 중복

- target 위치: `spec/5-system/10-graph-rag.md §2.3 Entity`
- 충돌 대상: `spec/1-data-model.md §2.12.2 Entity`
- 상세: `10-graph-rag.md §2.3` 의 Entity `type` 필드가 `String` 으로 표기되고 P0 enum 값(`person` / `organization` / `concept` / `location` / `event` / `other`)을 나열한다. `1-data-model.md §2.12.2` 는 동일 필드를 `Enum` 타입으로 정의하며 동일한 6가지 값을 명시한다. 두 정의는 의미상 일치하지만 타입 표기(`String` vs `Enum`)가 달라 독자에게 혼동을 줄 수 있다.
- 제안: `spec/5-system/10-graph-rag.md §2.3` 의 `type` 필드 타입 표기를 `Enum` 으로 통일하거나, `spec/1-data-model.md` 를 canonical SoT 로 명시하는 주석을 추가. 단, 기능적 충돌은 없으므로 INFO 등급 유지.

---

### [INFO] `spec/5-system/11-mcp-client.md §8.2` 에러 코드 — `INTEGRATION_NOT_CONNECTED` vs `MCP_CONNECT_FAILED`

- target 위치: `spec/5-system/11-mcp-client.md §2.1` (Streamable HTTP 표)
- 충돌 대상: `spec/5-system/11-mcp-client.md §8.2` 에러 코드 vocabulary
- 상세: `§2.1` 의 Streamable HTTP 표에서 "서버가 미지원 버전을 거부하면 `INTEGRATION_NOT_CONNECTED` 로 격하" 라고 기술되어 있으나, `§8.2` 의 에러 코드 vocabulary 에는 `INTEGRATION_NOT_CONNECTED` 가 정의되지 않고 동일 케이스가 `MCP_CONNECT_FAILED` 에 "프로토콜 버전 불일치 포함" 으로 수록되어 있다.
- 제안: `spec/5-system/11-mcp-client.md §2.1` 의 `INTEGRATION_NOT_CONNECTED` 를 `MCP_CONNECT_FAILED` 로 수정하여 §8.2 vocabulary 와 일치시킴. 동일 문서 내부 명명 불일치이므로 target spec 수정으로 해결 가능.

---

### [INFO] `spec/5-system/4-execution-engine.md §7.5` — `waiting_for_input → waiting_for_input` 전이와 `spec/1-data-model.md §2.13` Execution 상태 enum

- target 위치: `spec/5-system/4-execution-engine.md §1.1 허용되는 상태 전이` 표
- 충돌 대상: `spec/1-data-model.md §2.13 Execution.status Enum`
- 상세: `4-execution-engine.md §1.1` 은 `waiting_for_input → waiting_for_input` 전이(Rehydration)를 상태 전이 표에 포함시키며, `Execution.status enum 자체는 변경되지 않는다` 고 주석으로 명시한다. `1-data-model.md §2.13` 의 Execution 상태 enum은 `pending / running / completed / failed / cancelled / waiting_for_input` 6종으로 정의되어 있다. 두 정의 간 열거값 자체의 충돌은 없다. `error.code` 어휘에 Phase 2 신규 코드 (`RESUME_FAILED` / `RESUME_CHECKPOINT_MISSING` / `RESUME_INCOMPATIBLE_STATE`) 가 이미 데이터모델 §2.13 의 `error.code` 주석에 추가되어 있어 동기화 완료.
- 제안: 별도 조치 불필요. 현재 일치 상태.

---

### [WARNING] `spec/5-system/6-websocket-protocol.md §4.2` — `queued: boolean` 필드와 Phase 2 구현 범위 선행 정의

- target 위치: `spec/5-system/6-websocket-protocol.md §4.2` (plan 에 언급된 갱신 내용)
- 충돌 대상: `spec/5-system/4-execution-engine.md §7.4 / §7.5`
- 상세: plan (`workflow-resumable-execution.md Phase 0`) 에 따르면 `6-websocket-protocol.md §4.2` 에 `ack { queued: boolean }` 필드와 `RESUME_*` 3개 에러 코드가 이미 추가되어 있다. 이 필드들은 Phase 2 (BullMQ `execution-continuation` 큐) 구현이 완료되어야 실제로 사용되는 필드다. 구현 전 프론트엔드가 이 spec을 보고 `queued` 필드 수신을 기대하면, Phase 2 완료 이전 시점에 backend 가 항상 `queued: false` 혹은 필드 자체를 누락할 수 있어 클라이언트-서버 간 ack 계약 불일치가 발생할 수 있다.
- 제안: `6-websocket-protocol.md §4.2` 에 `queued` 필드와 `RESUME_*` 에러 코드가 "Phase 2 구현 완료 후 유효" 임을 명시하는 주석을 추가하거나, Phase 2 구현 시 backend 가 항상 `queued` 필드를 포함해 전송하도록 설계 문서에 명시. 코드 구현 착수 전에 프론트엔드 연동 팀과 Phase 2 완료 이전 `queued` 필드 기본값(`false`) 처리 방식을 합의해야 한다.

---

### [WARNING] `spec/5-system/4-execution-engine.md §7.5 Rehydration` — `NODE_EXECUTION_ID` 조회 절차와 `spec/2-navigation/` 영역 API 계약 미반영

- target 위치: `spec/5-system/4-execution-engine.md §7.5` + plan `2.4 nodeId → nodeExecutionId lookup`
- 충돌 대상: WS gateway REST 컨트롤러 (spec 미정의 영역)
- 상세: plan `2.4` 에서 WS gateway / REST 컨트롤러가 BullMQ enqueue 직전에 `execution_id + node_id + status='waiting_for_input'` 로 DB lookup 하여 `nodeExecutionId` 를 획득한 뒤, 0건 또는 다중 row 시 `INVALID_EXECUTION_STATE` 에러 코드를 반환한다고 명시하고 있다. 그런데 `INVALID_EXECUTION_STATE` 에러 코드는 현재 `spec/5-system/3-error-handling.md` 나 `spec/5-system/4-execution-engine.md` 의 에러 코드 어휘 목록에 등재되어 있지 않다.
- 제안: `spec/5-system/3-error-handling.md` 또는 `4-execution-engine.md §7.5` 의 에러 코드 어휘 절에 `INVALID_EXECUTION_STATE` 를 추가하고 반환 조건(0건 / 다중 `waiting_for_input` NodeExecution)을 기술. 구현 전에 spec을 보강해야 코드 리뷰 시 어휘 일치 여부를 검증할 수 있다.

---

### [INFO] `spec/5-system/` 전체 — 신규 BullMQ 큐 `execution-continuation` 와 `spec/0-overview.md §2.4 / §2.6`

- target 위치: `spec/5-system/4-execution-engine.md §9.2 / §9.3` (신규 큐 목록)
- 충돌 대상: `spec/0-overview.md §2.4 Execution Engine`, `§2.6 Data Layer`
- 상세: plan Phase 0 완료 항목에 `spec/0-overview.md §2.4 Rationale trade-off` 와 `§2.6 Data Layer Redis 항목` 이 BullMQ `execution-continuation` 큐를 반영하도록 갱신되었다고 명시한다. `spec/0-overview.md §2.6` 의 Redis 설명에 `execution-continuation` 큐가 이미 포함되어 있으므로 일치. 별도 충돌 없음.
- 제안: 별도 조치 불필요. Phase 0 spec 갱신이 완료된 상태.

---

### [INFO] `spec/5-system/4-execution-engine.md §11 Graceful Shutdown` — Phase 1 구현 범위 제한 (WS gate 미구현)

- target 위치: `spec/5-system/4-execution-engine.md §11`
- 충돌 대상: plan `Phase 1 scope` 주석
- 상세: plan `1.2` 에 "Phase 1 scope: HTTP gate 만 구현 (WS `execution.start` gate 는 WS 명령이 미구현 상태 — Phase 2 예정)" 이라는 제한이 명시되어 있다. `spec/5-system/4-execution-engine.md §11` 이 WS gate 포함 전체 5단계 graceful shutdown 을 기술하고 있다면, 구현이 spec 을 부분적으로만 만족하는 상태로 진행된다.
- 제안: `4-execution-engine.md §11` 에 WS gate 가 "Phase 2 이후 적용" 임을 주석으로 명시하거나, `plan/in-progress/workflow-resumable-execution.md §Phase 1` 에 spec §11 과의 차이를 명시. 임시 미구현 상태로 진행할 경우 추후 Phase 2 구현 시 spec 이 이미 완전 버전을 기술하고 있음을 확인 후 추가 구현만 하면 됨.

---

## 요약

`spec/5-system/` 전체 영역은 다른 spec 영역(`spec/1-data-model.md`, `spec/0-overview.md`, `spec/5-system/3-error-handling.md`, `spec/5-system/6-websocket-protocol.md`)과 전반적으로 정합성이 유지되고 있다. CRITICAL 급 충돌(작동 불가 수준)은 발견되지 않았다.

주의가 필요한 사항은 두 가지다. 첫째, `spec/5-system/11-mcp-client.md §2.1` 의 `INTEGRATION_NOT_CONNECTED` 에러 코드명이 동일 문서 §8.2 vocabulary 의 `MCP_CONNECT_FAILED` 와 명명 불일치(INFO)로 구현 시 혼란의 소지가 있다. 둘째, Phase 2 (BullMQ `execution-continuation` 큐) 구현 착수 시 WebSocket ack 의 `queued` 필드 기본값 처리와 `INVALID_EXECUTION_STATE` 에러 코드의 spec 등재가 선행되어야 한다(WARNING 2건). 나머지 사항은 명명 표기 비일관성(INFO) 수준이며 기능적 모순은 없다.

---

## 위험도

LOW

STATUS: OK
