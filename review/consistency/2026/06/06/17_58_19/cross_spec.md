# Cross-Spec 일관성 검토 결과

**검토 모드**: `--impl-prep` (구현 착수 전)
**Target**: `spec/5-system/4-execution-engine.md`
**검토 일시**: 2026-06-06

---

## 발견사항

### [INFO] Execution 상태 전이표 — `workflow-editor/3-execution.md` 와 서술 범위 차이

- **target 위치**: `spec/5-system/4-execution-engine.md §1.1` 전이표
- **충돌 대상**: `spec/3-workflow-editor/3-execution.md` §이벤트 목록 (`execution.resumed` 행)
- **상세**: `3-execution.md` 의 이벤트 목록에 `execution.resumed`(대기 후 재개)가 열거되어 있고 payload 가 `executionId` 단일 필드로 기술된다. 반면 `4-execution-engine.md §1.1` 은 `waiting_for_input → running` 전이를 "사용자 폼 제출·버튼 클릭·AI 대화 메시지 수신/대화 종료" 로 서술하는데, Phase B 이후 재개가 항상 rehydration 으로 일원화됐다는 맥락이 `3-execution.md` 에 반영되지 않았다. 모순은 아니지만 `execution.resumed` 이벤트가 `rehydration` 경로에서도 동일하게 발행되는지 여부가 `3-execution.md` 에서 불명확하다.
- **제안**: `3-execution.md §이벤트 목록` 의 `execution.resumed` 행에 "Phase B 이후 모든 재개가 rehydration 경로 — §7.5 참조" 크로스링크를 추가하는 것을 권장한다. Critical 수준은 아니다.

---

### [INFO] Workflow 노드 spec — `executeInline` park 시 `output` 형태 미기술

- **target 위치**: `spec/5-system/4-execution-engine.md §7.5` 중첩 sub-workflow 재개 절차 (exec-park D6)
- **충돌 대상**: `spec/4-nodes/2-flow/1-workflow.md §5.1` sync 정상 출력, §3 실행 흐름
- **상세**: `1-workflow.md §3` 의 sync 흐름은 `executeInline` 반환값을 `output: { result: <inlineResult> }` 로 래핑한다고 정의한다. `4-execution-engine.md §7.5` 의 frame-by-frame 재진입(`driveResumeFrame`)은 완료된 frame 의 sub-workflow 출력을 `injectInvokerOutput`으로 부모에 주입한다고 기술하나, 주입되는 값의 형태(`{ result: innerOutput }` 래핑 여부)가 `4-execution-engine.md` 에 명시되지 않아 구현 시 해석 의존성이 생긴다.
- **제안**: `4-execution-engine.md §7.5` frame-by-frame 재진입 절차의 "(b) 외곽 frame (bubble-up)" 행에 "sub-workflow 출력은 `1-workflow.md §5.1` 과 동일하게 `{ result: innerOutput }` 1단 래핑"임을 명시하면 구현 시 모호성이 제거된다.

---

### [INFO] `Execution.resume_call_stack` 컬럼 레이블 충돌 우려 — D6 레이블 namespace

- **target 위치**: `spec/5-system/4-execution-engine.md §7.5` 헤더 "(exec-park D6)"
- **충돌 대상**: `spec/4-nodes/3-ai/1-ai-agent.md` (동명 `D6` 레이블 — AI 노드 output 경로 단일화)
- **상세**: `4-execution-engine.md §7.5` 에서 "exec-park D6" 레이블이 사용된다. spec 본문에는 "AI 노드 spec 의 동명 D6 와 무관" 주석이 이미 인라인으로 삽입되어 있다. 모순은 없으며 독자가 혼동하지 않도록 경고를 제시한 것 자체가 충분하다. 현행 상태에서 실제 구현 차단 위험은 없다.
- **제안**: 현 주석이 충분하다. 추가 동기화 불요.

---

### [INFO] `NodeExecution.interaction_data.interactionType` — `WaitingInteractionType` 과의 이름 충돌 주석

- **target 위치**: `spec/1-data-model.md §2.14 NodeExecution` — `interaction_data` 필드 설명
- **충돌 대상**: `spec/conventions/interaction-type-registry.md` — `WaitingInteractionType` 정의
- **상세**: `1-data-model.md §2.14` 는 이미 "`interactionType` 은 수행된 user action 의 기록 enum 으로, 노드 대기 상태를 분류하는 `WaitingInteractionType` 과 이름만 같고 별개 enum" 임을 명시한다. 모순 없음. `4-execution-engine.md §1.3` 의 `interaction.type` 블로킹/재개 컨트랙트 표에서도 `form_submitted`/`button_click`/`button_continue`/`message_received` 가 동일하게 사용되어 정합성을 유지한다.
- **제안**: 정합. 추가 조치 불요.

---

### [INFO] `active_running_ms` 컬럼 — `Execution.error.code` 어휘 재확인

- **target 위치**: `spec/5-system/4-execution-engine.md §8` 타임아웃 동작 / `spec/1-data-model.md §2.13 Execution.error`
- **충돌 대상**: `spec/5-system/3-error-handling.md §1.4`
- **상세**: `4-execution-engine.md §8` 은 누적 active-running 시간 초과 시 `EXECUTION_TIME_LIMIT_EXCEEDED` 에러 코드를 발행하며, 이것이 Code 노드 스크립트 타임아웃 `EXECUTION_TIMEOUT` 과 다르다고 명시한다. `1-data-model.md §2.13 Execution.error.code` 어휘 목록에도 `EXECUTION_TIME_LIMIT_EXCEEDED` 가 인라인으로 열거되어 있어 정합하다. `3-error-handling.md §1.4` 에 이 코드가 반영돼 있는지는 목록 범위 밖이나, 단일 진실은 `4-execution-engine.md §8` 과 `1-data-model.md §2.13` 의 기술이 충분히 명시적이다.
- **제안**: `3-error-handling.md §1.4` 에 `EXECUTION_TIME_LIMIT_EXCEEDED` 코드가 열거되어 있는지 확인 후, 누락 시 동기화를 권장한다. 구현 차단 수준은 아니다.

---

## 요약

`spec/5-system/4-execution-engine.md` 는 Phase B(park 즉시 해제 + slow-path 일원화, PR-B1/B2a/B2b) 완료 시점 기준으로 `spec/1-data-model.md`, `spec/conventions/conversation-thread.md`, `spec/3-workflow-editor/3-execution.md`, `spec/4-nodes/2-flow/1-workflow.md`, `spec/5-system/6-websocket-protocol.md`, `spec/5-system/14-external-interaction-api.md` 와 데이터 모델·API 계약·상태 전이 측면에서 직접 모순이 없다. `resume_call_stack`(V087)·`conversation_thread`(V084)·`user_variables`(V085) 컬럼은 `1-data-model.md §2.13` 에 이미 반영됐고, `waiting_for_input` 상태 전이는 모든 관련 spec 에서 일관성 있게 기술된다. 발견된 4건은 모두 INFO 수준의 서술 보완·크로스링크 권고이며 구현을 차단하는 CRITICAL/WARNING 은 없다.

---

## 위험도

NONE

STATUS: OK
