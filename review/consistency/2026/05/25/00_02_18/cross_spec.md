# Cross-Spec 일관성 검토 — `spec/5-system/` (Durable Continuation & Graceful Shutdown)

검토 모드: `--impl-prep`, scope=`spec/5-system/`

대상 spec 의 핵심 변경: `spec/5-system/4-execution-engine.md` 에 BullMQ `execution-continuation` 큐 기반 Durable Continuation (§7.4 / §7.5), Graceful Shutdown (§11), `RESUME_*` / `SERVER_INTERRUPTED` / `SERVER_SHUTTING_DOWN` 에러 코드 신설. 동반 갱신: `spec/5-system/6-websocket-protocol.md §4.2`, `spec/1-data-model.md §2.13`, `spec/data-flow/3-execution.md`, `spec/0-overview.md`, `spec/4-nodes/6-presentation/0-common.md §10.9`.

---

## 발견사항

### [INFO] `SESSION_INTERRUPTED` 에러 코드 — plan 전용, spec 미수록

- target 위치: `plan/in-progress/workflow-resumable-execution.md Phase 1.3`
- 충돌 대상: `spec/5-system/4-execution-engine.md`, `spec/5-system/3-error-handling.md`, `spec/1-data-model.md §2.13`
- 상세: plan Phase 1.3 의 임시 보강 단계에서 `error.code='SESSION_INTERRUPTED'` 를 사용하도록 기술되어 있다. 그러나 spec 내의 에러 코드 어휘 (`spec/1-data-model.md §2.13 Execution.error.code`, `spec/5-system/3-error-handling.md`, `spec/5-system/4-execution-engine.md §11 / §Rationale`) 어디에도 `SESSION_INTERRUPTED` 는 정의되어 있지 않다. 공식 수록된 코드는 `SERVER_INTERRUPTED` / `RESUME_FAILED` / `RESUME_CHECKPOINT_MISSING` / `RESUME_INCOMPATIBLE_STATE` / `SERVER_SHUTTING_DOWN` 이다.
- 제안: plan Phase 1.3 이 구현될 경우 `SESSION_INTERRUPTED` 대신 `RESUME_CHECKPOINT_MISSING` 또는 `RESUME_FAILED` 를 재활용하거나, 신규 코드라면 `spec/5-system/4-execution-engine.md` 와 `spec/1-data-model.md §2.13` 에 명시적으로 등록해야 한다. Phase 1.3 자체가 Phase 2 적용 시 제거 예정(임시) 임을 감안하면, spec 에 추가 등록하지 않고 구현도 하지 않는 것이 선호된다. plan 본문의 "(본 단계는 Phase 2 가 같은 sprint 안에 진행될 경우 skip 가능)" 조건을 활용하는 쪽을 권장.

---

### [INFO] `SERVER_SHUTTING_DOWN` — `spec/5-system/3-error-handling.md` 미수록, API 규약 참조만 존재

- target 위치: `spec/5-system/4-execution-engine.md §11` (503 응답 + `error.code='SERVER_SHUTTING_DOWN'`)
- 충돌 대상: `spec/5-system/3-error-handling.md`, `spec/5-system/2-api-convention.md`
- 상세: `4-execution-engine.md §11` 이 `SERVER_SHUTTING_DOWN` 코드를 503 응답의 코드로 정의하며 "[Spec API 규약](./2-api-convention.md)" 을 표준 에러 shape 의 근거로 인용한다. 그러나 `2-api-convention.md` 에는 503 상황이나 `SERVER_SHUTTING_DOWN` 에 대한 구체적 언급이 없고, `3-error-handling.md` 에도 동 코드가 등재되지 않았다. 이는 기존 에러 카탈로그와의 불완전 동기화다.
- 제안: `spec/5-system/3-error-handling.md` 의 HTTP 503 항목 또는 인프라 에러 코드 섹션에 `SERVER_SHUTTING_DOWN` 을 1행 추가 등재. 또는 `4-execution-engine.md §11` 을 단독 SoT 로 명시하고 `3-error-handling.md` 에 교차 참조 한 줄 추가.

---

### [INFO] `execution.start` WS 명령의 503 처리 — `spec/3-workflow-editor/3-execution.md` 미언급

- target 위치: `spec/5-system/4-execution-engine.md §11` — "WS `execution.start` 가 503 Service Unavailable 응답"
- 충돌 대상: `spec/3-workflow-editor/3-execution.md §8 (실행 제어 명령 표)`, `spec/5-system/6-websocket-protocol.md §4.2`
- 상세: 실행 엔진 spec §11 은 graceful shutdown 중 WS `execution.start` 명령도 503 으로 거부한다고 기술한다. 그러나 WS 프로토콜(6-websocket-protocol.md §4.2) 와 워크플로우 에디터 실행 spec(3-workflow-editor/3-execution.md) 에는 서버 shutdown 중의 WS `execution.start` 거부 동작이 기술되어 있지 않다. `SERVER_SHUTTING_DOWN` 이 WS ack 에러로 어떻게 전달되는지(단순 503 HTTP disconnect 인지, WS ack payload 의 error 필드인지) 두 spec 간에 정의가 없다.
- 제안: `spec/5-system/6-websocket-protocol.md §4.2` 의 `execution.start` ack 에러 목록에 `SERVER_SHUTTING_DOWN` (graceful shutdown 중 거부) 을 추가하거나, `spec/5-system/4-execution-engine.md §11` 에 WS 거부 방식(예: HTTP 업그레이드 전 503 vs WS 연결 후 ack error)을 명시.

---

### [INFO] Graceful Shutdown 중 WAITING_FOR_INPUT 실행의 사용자 경험 — Chat Channel spec 미반영

- target 위치: `spec/5-system/4-execution-engine.md §11 step 3` — "WAITING_FOR_INPUT 상태의 Execution 은 건드리지 않음"
- 충돌 대상: `spec/5-system/15-chat-channel.md §3.2 CCH-CV-03`
- 상세: 실행 엔진 §11 은 graceful shutdown 중 `WAITING_FOR_INPUT` 인 Execution 을 DB 그대로 두고 in-memory resolver 만 소실시킨 뒤 §7.5 rehydration 으로 재개한다고 정의한다. Chat Channel spec CCH-CV-03 은 `waiting_for_input` 상태에서 사용자 메시지 도착 시 "인터랙션 명령으로 forwarding" 한다고 기술하나, 해당 forwarding 이 BullMQ continuation-queue 경유로 처리되는 새 경로를 명시하지 않는다. 기능적 충돌은 아니나, Chat Channel 어댑터가 내부적으로 BullMQ continuation-queue 를 사용한다는 사실이 CCH 쪽에서는 불투명하다.
- 제안: `spec/5-system/15-chat-channel.md §3.2 CCH-CV-03` 또는 §4 에 "인터랙션 forwarding 은 `InteractionService.interact()` 경유이며, 이 경로는 §7.4 의 BullMQ continuation-queue 를 사용해 rehydration 이 자동 지원됨" 한 줄 cross-reference 추가 (INFO 수준, 기능 동작은 현재도 일치).

---

### [INFO] `Execution.error.code` 어휘 — Rationale 의 4종과 §2.13 의 5종 표기 미세 불일치

- target 위치: `spec/5-system/4-execution-engine.md §Rationale "Durable Continuation"` 마지막 bullet — "신규 code 4종 (`SERVER_INTERRUPTED` / `RESUME_FAILED` / `RESUME_CHECKPOINT_MISSING` / `RESUME_INCOMPATIBLE_STATE`) 어휘 노트 추가"
- 충돌 대상: `spec/1-data-model.md §2.13` Execution.error.code 설명 — `SERVER_SHUTTING_DOWN` 을 포함해 5종이 기재됨
- 상세: Rationale 에서 "4종" 이라 표기하나 data-model §2.13 에는 `SERVER_SHUTTING_DOWN` 까지 포함한 5종이 열거되어 있다. Rationale 의 4종은 NodeExecution.error.code 의 추가분을 가리키고, `SERVER_SHUTTING_DOWN` 은 Execution.error.code 에도 쓰이는 별개의 코드라는 구분이 모호하다.
- 제안: Rationale 의 해당 bullet 을 "신규 NodeExecution 에러 코드 4종 (`SERVER_INTERRUPTED` / `RESUME_FAILED` / `RESUME_CHECKPOINT_MISSING` / `RESUME_INCOMPATIBLE_STATE`) + Execution 레벨 코드 1종 (`SERVER_SHUTTING_DOWN`)" 로 명확히 분리. 기능 정의는 양쪽 모두 존재하므로 INFO 수준.

---

### [INFO] `spec/4-nodes/6-presentation/0-common.md §10.9` — continuation bus payload 채널명 표기 동기화 필요

- target 위치: `plan/in-progress/workflow-resumable-execution.md Phase 0` 항목 "line 20 파일 참조, line 52 시퀀스 다이어그램 주석" 의 완료 확인
- 충돌 대상: `spec/4-nodes/6-presentation/0-common.md §10.9`
- 상세: plan Phase 0 에서 `spec/4-nodes/6-presentation/0-common.md §10.9` 의 "internal continuation bus payload SoT 의 채널명 표기" 가 갱신 완료로 체크되어 있다. 그러나 프롬프트에 포함된 prompt 내용(spec 본문 snapshot)에는 이 갱신이 직접 확인되지 않는다. 구현 착수 전에 해당 파일의 `execution:continuation` (옛 Redis pub/sub 채널명) 표기가 `execution-continuation` (BullMQ 큐명) 으로 실제 변경되었는지 최종 확인을 권장한다.
- 제안: 구현 착수 전 `spec/4-nodes/6-presentation/0-common.md §10.9` 의 채널명 표기를 직접 열람해 `execution-continuation` (BullMQ) 으로 되어있음을 확인. 여전히 `execution:continuation` (Redis pub/sub 표기) 이면 수정 후 착수.

---

### [WARNING] `spec/data-flow/3-execution.md` 시퀀스 다이어그램 — mermaid 자체는 여전히 옛 표기 가능

- target 위치: `plan/in-progress/workflow-resumable-execution.md Phase 0` — "line 165 mermaid 라벨 갱신" 완료로 표시
- 충돌 대상: `spec/data-flow/3-execution.md` mermaid 다이어그램
- 상세: plan Phase 0 의 체크 항목 중 "line 165 mermaid 라벨" 이 BullMQ 흐름으로 갱신되었다고 표시되나, Phase 3.2 에 "mermaid 자체를 BullMQ 흐름으로 재작성 (현재는 주석만 갱신)" 이 별도 후속으로 남아있다. 즉 현재 `spec/data-flow/3-execution.md` 의 mermaid diagram 내 상태 전이 레이블은 BullMQ 기준으로 업데이트됐지만, 다이어그램 구조(시퀀스 흐름 자체)는 아직 Redis pub/sub 패턴으로 남아있을 수 있다. 구현자가 spec 다이어그램을 참조할 때 구현과 불일치가 발생할 수 있다.
- 제안: 구현 착수 전 `spec/data-flow/3-execution.md` 의 mermaid 다이어그램이 BullMQ 큐 경유 흐름을 정확히 반영하는지 확인. 불일치 시 spec 수정(Phase 3.2 선행 실행) 후 착수. 단, Phase 3.2 가 "선택(선택)" 으로 분류된 만큼 다이어그램에 "* 주석: BullMQ 큐 기반으로 전환됨, 다이어그램 상세 갱신 예정" 한 줄로 현재 상태를 명시하는 것도 대안.

---

### [INFO] `retry-handler-followup.md §4.2` — spec 표기 업데이트 교차 의존

- target 위치: `plan/in-progress/workflow-resumable-execution.md §다음 단계 3.` — "`plan/in-progress/retry-handler-followup.md` 에 WARNING #2 는 본 작업으로 채널이 BullMQ 큐로 교체됨 한 줄 추가"
- 충돌 대상: `plan/in-progress/retry-handler-followup.md`
- 상세: `retry-handler-followup.md` 는 `_retryState` 와 관련해 `execution:continuation` (Redis pub/sub 채널) 표기를 사용하는 섹션(WARNING #2)을 보유할 수 있으며, 이를 BullMQ 큐 표기로 갱신해야 한다고 plan 에 명시되어 있다. 이 작업이 누락되면 retry-handler-followup 구현 착수 시 개발자가 옛 채널명을 참조하게 된다.
- 제안: 본 impl-prep 착수 직전 또는 Phase 0 완료 후 즉시 `plan/in-progress/retry-handler-followup.md` 에 해당 줄을 추가. plan 의 Phase 0 완료 표시 전에 이 교차 업데이트가 완료되어야 한다.

---

## 요약

`spec/5-system/4-execution-engine.md` 를 중심으로 한 Durable Continuation & Graceful Shutdown 변경은 다른 spec 영역들과의 **직접적인 데이터 모델·API 계약·상태 전이 충돌이 없다**. `spec/1-data-model.md §2.13`, `spec/5-system/6-websocket-protocol.md §4.2`, `spec/data-flow/3-execution.md` 가 모두 Phase 0 에서 동기화 완료된 것으로 표시되어 있으며, 핵심 설계 결정(BullMQ 영속 큐, WAITING_FOR_INPUT 무기한 보존, rehydration slow-path)은 Chat Channel(CCH-CV-03), EIA, Re-run spec 의 기존 결정과 의미론적으로 호환된다. 발견된 이슈는 모두 INFO 1건(SESSION_INTERRUPTED 미정의 임시 코드), INFO 3건(에러 코드 카탈로그 미동기화, WS 503 처리 미기술, 4종/5종 표기 불일치), WARNING 1건(mermaid 다이어그램 구조 미갱신 가능성), INFO 2건(채널명 최종 확인, plan 교차 업데이트) 으로 구성된다. CRITICAL 충돌은 없으며 구현 착수 차단 요소는 발견되지 않았다.

## 위험도

LOW

---

*생성: 2026-05-25, scope=spec/5-system/, mode=--impl-prep*
