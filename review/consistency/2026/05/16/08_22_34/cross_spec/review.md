# Cross-Spec 일관성 검토 결과

검토 대상: `spec/4-nodes/3-ai/0-common.md`, `spec/4-nodes/4-integration/4-cafe24.md`, `spec/5-system/5-expression-language.md`, `spec/conventions/conversation-thread.md`

검토 모드: `--impl-prep` (구현 착수 전 검토)

---

## 발견사항

---

- **[WARNING]** `$now.iso` 표현식 — Cafe24 spec 에서 정의되지 않은 멤버 접근
  - target 위치: `spec/4-nodes/4-integration/4-cafe24.md` §2 설정 UI 예시 (`│ since [{{ $now.iso }}] │`), §5.1 출력 구조 예시 (`"since": "{{ $now.iso }}"`)
  - 충돌 대상: `spec/5-system/5-expression-language.md` §4.1 — `$now` 를 `String` (ISO 8601, UTC) 으로 정의. 멤버 속성 없음
  - 상세: 표현식 엔진에서 `$now` 는 `String` 스칼라값이다. `$now.iso` 는 문자열 위에 `.iso` 멤버 접근을 시도하므로 런타임에 `null` 또는 `undefined` 를 반환하거나 `EXPR_REFERENCE_ERROR` 를 발생시킨다. Cafe24 spec 예시는 "날짜 문자열을 얻는 방법"을 보여주기 위한 의도인 것으로 보이나, 올바른 표현식은 `{{ $now }}` (ISO 8601 문자열 그대로) 또는 `{{ formatDate($now, "YYYY-MM-DD") }}` 이다.
  - 제안: Cafe24 spec §2 UI 예시 및 §5.1 출력 예시의 `{{ $now.iso }}` 를 `{{ $now }}` 로 수정. 또는 표현식 언어 spec §4.1 에 `$now` 가 단순 String 임을 명시적으로 재확인하는 주석을 추가.

---

- **[WARNING]** `$schedule` 참조 변수 — 표현식 언어 spec 변수 목록 누락
  - target 위치: 직접 target 파일 아님 (간접 연관)
  - 충돌 대상: `spec/5-system/5-expression-language.md` §4.1 변수 목록 vs `spec/1-data-model.md` §2.9 (`{{ $schedule.* }}` 제한 표현식), `spec/5-system/4-execution-engine.md` §6.2 Schedule 어댑터 (`{ $now, $schedule: { id, cronExpression, timezone } }` 제한 컨텍스트)
  - 상세: `$schedule` 변수는 Schedule 파라미터 값 resolve 시 전용 제한 컨텍스트로 주입되어 사용된다. 그러나 `spec/5-system/5-expression-language.md` §4.1 의 내장 참조 변수 목록에는 `$schedule` 이 없다. 이 spec 을 구현하는 개발자가 `$schedule` 의 존재와 사용 범위(Schedule 파라미터 값에서만 허용, 워크플로 노드 config 에서는 불가)를 파악하지 못할 위험이 있다.
  - 제안: `spec/5-system/5-expression-language.md` §4.1 에 `$schedule` 항목 추가. `적용 범위: Schedule.parameter_values 에서만 사용 가능. 워크플로 노드 config 에서는 미지원` 주석과 함께. 속성 `{ id, cronExpression, timezone }` 명시.

---

- **[WARNING]** `NodeExecution.interaction_data` 의 키 이름 — 컨벤션과 불일치
  - target 위치: `spec/conventions/conversation-thread.md` §4 영속화, §1.4 `text` 변환 규칙 (간접 참조)
  - 충돌 대상: `spec/1-data-model.md` §2.14 NodeExecution — `interaction_data JSONB?: { interactionType: "form_submitted" | "button_click" | "button_continue", buttonId?, buttonLabel?, clickedAt, clickedBy }` vs `spec/conventions/node-output.md` §4.4/4.5 — `output.interaction.type` (중첩 객체, `type` 키) vs `spec/conventions/conversation-thread.md` §4 — `output.interaction` (`interaction.type` 로 참조)
  - 상세: `spec/1-data-model.md` 의 `interaction_data` 는 `interactionType` (flat, camelCase) 키를 사용하고 `clickedAt`, `clickedBy` 필드를 포함하는 반면, CONVENTIONS (`node-output.md`) 와 실행 엔진은 `output.interaction.type` (중첩 객체) / `output.interaction.data` / `output.interaction.receivedAt` 구조를 SoT 로 정의한다. `conversation-thread.md` §4 영속화 절도 `output.interaction` 을 SoT 로 명시하며 `interaction_data` 컬럼과의 매핑 관계를 설명하지 않는다. 구현 시 DB 컬럼 `interaction_data` 의 JSON shape 를 `output.interaction` shape 와 어떻게 매핑할지 혼란을 줄 수 있다.
  - 제안: `spec/1-data-model.md` §2.14 의 `interaction_data` 설명에 "저장 형식은 `output.interaction` 의 `{ type, data, receivedAt }` 구조를 그대로 보존 (CONVENTIONS §4.4/4.5 참조)" 를 명시하거나, flat `interactionType` 형식과 중첩 `interaction.type` 형식의 관계(DB 저장 포맷 vs 런타임 객체 포맷)를 명시적으로 기술.

---

- **[INFO]** `conversation-thread.md` §7 v2 로드맵의 `STORAGE_MAX_TURNS=500` 참조 — 구현 상수 정의 위치 불명확
  - target 위치: `spec/conventions/conversation-thread.md` §7 v2 로드맵 (`§STORAGE_MAX_TURNS=500 은 LRU style FIFO drop`)
  - 충돌 대상: `spec/5-system/4-execution-engine.md` — STORAGE_MAX_TURNS 상수 언급 없음
  - 상세: `STORAGE_MAX_TURNS=500` 이 v2 로드맵에 등장하나 해당 상수가 어느 파일/모듈에서 정의되어야 하는지 명시되지 않음. 구현 착수 시 실행 엔진 spec 에도 같은 cap 상수를 등록해야 할지 판단이 필요. v2 항목이므로 v1 구현 차단은 아니지만 일관성 관리를 위해 위치를 명시하는 것이 좋음.
  - 제안: `spec/5-system/4-execution-engine.md` 또는 `spec/conventions/conversation-thread.md` 중 한 곳에 `STORAGE_MAX_TURNS` 상수를 v1 cap 상수들(`MAX_INJECTED_TURNS`, `MAX_TURN_TEXT_CHARS`, `MAX_INJECTED_CHARS`) 과 동일 표로 통합 관리.

---

- **[INFO]** `spec/4-nodes/3-ai/0-common.md` §10 과 `spec/conventions/conversation-thread.md` — 동일 `contextScope` 필드 표가 두 곳에 중복 정의
  - target 위치: `spec/4-nodes/3-ai/0-common.md` §10 Conversation Context 필드 테이블 (5개 필드: `contextScope`, `contextScopeN`, `contextInjectionMode`, `includeToolTurns`, `excludeFromConversationThread`)
  - 충돌 대상: `spec/conventions/conversation-thread.md` §5 AI Agent 자동 주입 (동일 5개 필드의 타입·기본값 표)
  - 상세: 두 문서 간 타입·기본값 정의가 현재는 일치하지만, 두 곳이 독립적으로 관리되어 향후 한쪽만 갱신될 위험이 있다. `0-common.md` §10 은 노드 설정 관점의 요약, `conversation-thread.md` §5 는 단일 진실 공급원으로 명시되어 있으나 양쪽 모두 필드 테이블을 갖는다.
  - 제안: 현재 정합성은 유지되고 있으므로 즉각 수정 불필요. 다만 향후 필드 변경 시 두 문서를 반드시 동시 갱신하도록 `0-common.md` §10 의 필드 표 위에 "단일 진실: `spec/conventions/conversation-thread.md` §5" 명시적 노트 추가 권장.

---

## 요약

Cross-Spec 일관성 관점에서 CRITICAL 충돌은 없다. 가장 주요한 발견사항은 `spec/4-nodes/4-integration/4-cafe24.md` 의 UI/출력 예시에서 사용된 `{{ $now.iso }}` 표현식이 `spec/5-system/5-expression-language.md` 에서 정의한 `$now: String` 타입과 모순된다는 점(WARNING)이다. 구현 코드 작성 시 이 표현식을 그대로 따르면 런타임 오류가 발생하므로 어느 쪽을 수정할지 결정이 필요하다. 두 번째 WARNING 은 Schedule 파라미터에서만 허용되는 `$schedule` 변수가 표현식 언어 spec 의 변수 목록에 누락되어 있다는 점이다. 나머지 두 항목은 데이터 모델의 `interaction_data` 키 명명 비일관성(구현 시 매핑 혼란 가능)과 cap 상수 위치 불명확(v2 해당)에 관한 INFO 수준의 동기화 권장 사항이다.

---

## 위험도

MEDIUM
