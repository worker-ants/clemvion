# Cross-Spec 일관성 검토 결과

**검토 모드**: `--impl-prep` (구현 착수 전 검토)
**Target**: `spec/5-system/4-execution-engine.md`
**검토일**: 2026-06-19

---

## 발견사항

### 발견사항 없음 — 교차 모순 0건

Target 문서(`spec/5-system/4-execution-engine.md`)와 관련 spec 영역 사이에서 아래 6개 관점을 전수 검토한 결과, **CRITICAL / WARNING 등급의 충돌이 발견되지 않았다.**

주요 검토 결과를 관점별로 기록한다.

---

### 1. 데이터 모델 충돌 — INFO 없음

- `spec/1-data-model.md §2.13 Execution` 상태 enum(`pending / running / completed / failed / cancelled / waiting_for_input`)과 `4-execution-engine.md §1.1 Execution 상태` 표가 완전 일치한다.
- `spec/1-data-model.md §2.14 NodeExecution` 상태 enum(`pending / running / completed / failed / cancelled / skipped / waiting_for_input`)과 `4-execution-engine.md §1.2 NodeExecution 상태` 표가 완전 일치한다.
- `spec/1-data-model.md §2.13` 의 `active_running_ms`, `conversation_thread`, `user_variables`, `resume_call_stack`, `dry_run`, `re_run_of`, `chain_id`, `single_node_id`, `previous_execution_id` 컬럼 정의가 엔진 spec §6.2·§7.5·§8 의 커밋 시점·용도 설명과 정합한다.
- `spec/1-data-model.md §2.14 NodeExecution` 의 `interaction_data` 필드 정의(`interactionType: "form_submitted" | "button_click" | "button_continue"`)와 엔진 spec §1.3 `interaction.type` enum이 일치한다. 데이터 모델이 "수행된 user action 의 기록 enum" 임을 명시하고, `WaitingInteractionType`(`form/buttons/ai_conversation/ai_form_render`)과 **별개 enum** 임을 정확히 표기하고 있다.

### 2. API 계약 충돌 — INFO 없음

- `spec/5-system/6-websocket-protocol.md §4.2` 의 WS 명령 목록(`execution.submit_form / click_button / submit_message / end_conversation / retry_last_turn`)과 엔진 spec §7.4 Continuation Bus 메시지 타입(`continue / cancel / button_click / ai_message / ai_end_conversation / retry_last_turn`) 이름이 다르지만, WS spec 본문이 양쪽의 매핑을 명시하고 있으며 의미 모순이 아닌 **레이어 구분**이다.
- `spec/5-system/14-external-interaction-api.md §5.1`의 `click_button` 명령 파라미터(`nodeId, buttonId`)와 WS spec §4.2 `execution.click_button` payload(`{ executionId, buttonId }`)가 일치한다.
- `spec/5-system/6-websocket-protocol.md §4.2`의 ack 형태와 엔진 spec §7.5.2 typed `ExecutionError` 계약이 정합한다(`success/error/errorCode` 평면 필드).

### 3. 요구사항 ID 충돌 — 해당 없음

Target 문서는 요구사항 ID를 새로 부여하지 않는다(시스템 spec 영역). 관련 요구사항 ID(`ND-BG-05`, `CCH-AD-05`, `EIA-NX-07` 등)는 각 원본 spec 영역이 소유하며, 엔진 spec은 cross-reference만 수행한다.

### 4. 상태 전이 충돌 — INFO 없음

- `spec/4-nodes/6-presentation/0-common.md §3 Blocking Mode 실행 흐름`의 상태 전이(`running → waiting_for_input → completed`) 및 `interactionType: "buttons"` 분기가 엔진 spec §1.1 전이 표, §1.3 CONVENTIONS §4.5 `button_click / button_continue` payload와 정합한다.
- `spec/conventions/interaction-type-registry.md §1.2` 매트릭스에서 `buttons` 값의 Backend emit 위치를 `ButtonInteractionService`(C-1 분할 후 엔진 위임)로 명시하고 있으며, 엔진 spec §1.3 구현 위치 주석("`waitForButtonInteraction`/`processButtonResumeTurn`은 `ButtonInteractionService`")과 일치한다.
- Execution `cancelled` vs NodeExecution `failed` 이분 정책(§7.5 rehydration 실패 케이스)이 `spec/1-data-model.md §2.13/§2.14`의 상태 enum 허용 범위 안에 있다.

### 5. 권한·RBAC 모델 충돌 — 해당 없음

Target 문서는 권한/RBAC 규칙을 정의하지 않는다. 실행 엔진은 워크스페이스·사용자 스코프를 호출 시 주입(`__workspaceId` 변수, `executedBy`, `triggerId`)받아 사용하며 자체 RBAC 정의가 없다.

### 6. 계층 책임 충돌 — INFO 없음

- C-1 분할(`NodeBootstrapService / AiTurnOrchestrator / FormInteractionService / ButtonInteractionService / RetryTurnService`)은 모두 `codebase/backend/src/modules/execution-engine/` 내부 이동이며, 엔진 spec frontmatter `code:` glob(`codebase/backend/src/modules/execution-engine/**`)이 자동 커버한다.
- `spec/conventions/interaction-type-registry.md §1.1/§1.2`의 `ButtonInteractionService` 등록 위치가 엔진 spec §1.3 "구현 위치" 주석과 정합한다.
- `spec/0-overview.md §2.4 Execution Engine`의 아키텍처 컴포넌트 설명(`Worker Pool`, `execution-run`/`execution-continuation` 큐, `waiting_for_input` park)이 엔진 spec §4·§4.x·§7.4와 모순 없이 일치한다.

---

## 요약

`spec/5-system/4-execution-engine.md`는 데이터 모델(`spec/1-data-model.md`), WebSocket 프로토콜(`spec/5-system/6-websocket-protocol.md`), External Interaction API(`spec/5-system/14-external-interaction-api.md`), Presentation 노드 공통(`spec/4-nodes/6-presentation/0-common.md`), Interaction Type Registry(`spec/conventions/interaction-type-registry.md`), 시스템 개요(`spec/0-overview.md`)와 교차 검토한 결과 직접 모순·정의 중복·상태 전이 불일치가 발견되지 않았다. C-1 god-class 분할(PR #622-#627)로 추출된 `ButtonInteractionService` 등의 협력 서비스 위치가 interaction-type-registry 매트릭스에 이미 반영되어 있고, `button_click`/`button_continue` interaction.type enum은 data-model·WS spec·presentation 공통 spec 세 영역이 일관되게 참조한다. 구현 착수를 차단할 cross-spec 위험이 없다.

---

## 위험도

NONE
