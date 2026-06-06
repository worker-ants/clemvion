# 신규 식별자 충돌 분석 — exec-park-durable-resume (spec/5-system)

검토 모드: `--impl-done`, scope=`spec/5-system`, diff-base=`origin/main`

---

## 발견사항

### 발견사항 1

- **[INFO]** `D6` 레이블 — exec-park Rationale 와 AI 노드 spec 동명 충돌 (자체 명시됨)
  - target 신규 식별자: `exec-park D6` — `spec/5-system/4-execution-engine.md` §Rationale 의 "중첩 sub-workflow blocking durable 영속" 결정 레이블
  - 기존 사용처: `spec/4-nodes/3-ai/1-ai-agent.md` 라인 749 (`D6 결정: waiting/resumed 의 messages/message/turnCount …`), `spec/4-nodes/3-ai/3-information-extractor.md` 라인 384, `spec/4-nodes/3-ai/2-text-classifier.md` 라인 350
  - 상세: AI 노드 spec 에서 `D6` 는 output 경로 통일 결정을 가리키는 레이블이며, 실행 엔진 spec 에서 `D6` 는 call stack 영속화 결정을 가리킨다. 두 문서가 서로 다른 의미로 동일 레이블을 사용한다.
  - 충돌 상태: 실행 엔진 spec 자체가 "*(레이블: `exec-park-durable-resume` plan 결정 D6 — AI 노드 spec 의 동명 `D6` 와 무관)*" 이라고 parenthetical 로 명시함. 즉 양쪽이 이미 인지한 상태.
  - 제안: 현재 inline 면책 주석은 적절한 해소다. 독립 문서 범위에서 각자 의미가 한정되므로 기능 충돌은 없다. 추가 조치 불필요.

### 발견사항 2

- **[INFO]** `interactionType` 필드명 — `NodeExecution.interaction_data` 의 기록 enum 과 `WaitingInteractionType` 의 대기 분류 enum 이 동명
  - target 신규 식별자: `spec/5-system/4-execution-engine.md` 에서 park 커밋 시 `interactionType` 을 `NodeExecution.outputData` 슬롯에 기록하는 새 흐름 추가
  - 기존 사용처: `spec/1-data-model.md` 라인 501 의 `NodeExecution.interaction_data.interactionType` ("form_submitted" | "button_click" | "button_continue"), `spec/conventions/interaction-type-registry.md` 의 `WaitingInteractionType` ("form" | "buttons" | "ai_conversation" | "ai_form_render")
  - 상세: `interactionType` 이라는 JSON 키가 두 맥락에서 다른 값 집합을 갖는다. `interaction_data.interactionType` 은 **수행된 user action** 기록용, `WaitingInteractionType` 은 **노드 대기 상태 분류**용. 값 집합이 다르고 저장 위치도 다르다.
  - 충돌 상태: `spec/1-data-model.md` 라인 501 이 "이름만 같고 별개 enum" 이라고 이미 명시해 인지된 상태.
  - 제안: 현재 주석으로 이미 명확히 구분됨. 추가 조치 불필요.

### 발견사항 3

- **[INFO]** `EXECUTION_TIMEOUT` vs `EXECUTION_TIME_LIMIT_EXCEEDED` — 유사명 신규 코드 도입, 혼동 가능성
  - target 신규 식별자: `EXECUTION_TIME_LIMIT_EXCEEDED` — 엔진 레벨 누적 active-running 타임아웃용 신규 에러 코드 (`spec/5-system/4-execution-engine.md` §8, `spec/5-system/3-error-handling.md` 라인 59)
  - 기존 사용처: `EXECUTION_TIMEOUT` — Code 노드 스크립트 실행 타임아웃 (`spec/4-nodes/5-data/2-code.md` 라인 246, 269, 286), `spec/5-system/3-error-handling.md` 라인 59
  - 상세: `EXECUTION_TIMEOUT` (기존) 과 `EXECUTION_TIME_LIMIT_EXCEEDED` (신규) 는 모두 "실행 타임아웃"을 연상시키나 의미가 다르다. 전자는 Code 노드 스크립트 단위, 후자는 엔진 레벨 누적 active-running 한도 초과다. 두 코드가 동시에 에러 페이로드에 등장할 수 있다 (`spec/5-system/14-external-interaction-api.md` 라인 532).
  - 충돌 상태: `spec/5-system/3-error-handling.md` 와 실행 엔진 §8 Rationale 가 이미 분리 의도를 명시("의미가 달라 코드 분리 — rename 아닌 의미 분리 신설"). 동일 식별자가 다른 의미로 재사용되는 것이 아니라 신규 식별자로 추가됨.
  - 제안: 혼동 예방을 위해 에러 처리 규약 (`spec/conventions/error-codes.md`) 또는 `spec/5-system/3-error-handling.md §1.4` 에 두 코드의 범위 구분 한 줄을 명시적으로 추가하면 좋다. 현재도 `spec/5-system/14-external-interaction-api.md` 에 인라인 설명이 있으나 단일 진실 위치에 두는 것이 바람직하다. 차단은 불필요.

---

## 요약

`spec/5-system` 의 exec-park-durable-resume 변경이 도입하는 신규 식별자(`conversation_thread`, `user_variables`, `resume_call_stack` DB 컬럼, `RESUME_FAILED` / `RESUME_CHECKPOINT_MISSING` / `RESUME_INCOMPATIBLE_STATE` / `EXECUTION_TIME_LIMIT_EXCEEDED` 에러 코드, `CALL_STACK_SCHEMA_VERSION` / `CHECKPOINT_SCHEMA_VERSION` / `RESUME_BULLMQ_ATTEMPTS` 상수, `active_running_ms` 컬럼, `EXECUTION_MAX_ACTIVE_RUNNING_MS` ENV 키)는 기존 사용처와 의미적으로 충돌하지 않는다. 우려 가능한 두 가지 동명 케이스(AI 노드 spec 의 `D6` 레이블, `interactionType` 필드명 dual enum)는 해당 spec 본문이 이미 명시적으로 구분 주석을 달고 있어 실질 혼선 위험이 낮다. `EXECUTION_TIME_LIMIT_EXCEEDED` 가 기존 `EXECUTION_TIMEOUT` 과 유사명인 점은 INFO 수준 경고로, 에러 코드 규약 문서에 분리 근거를 한 줄 추가하면 충분히 해소된다.

---

## 위험도

NONE
