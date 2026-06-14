# Cross-Spec 일관성 검토 결과

target: `spec/4-nodes/6-presentation/` (구현 완료 후 검토, diff-base=origin/main)

실제 변경된 spec 파일:
- `/Volumes/project/private/clemvion/spec/4-nodes/6-presentation/4-form.md`
- `/Volumes/project/private/clemvion/spec/5-system/14-external-interaction-api.md`
- `/Volumes/project/private/clemvion/spec/2-navigation/2-trigger-list.md` (anchor 픽스만)

---

## 발견사항

### 1. [INFO] chat-channel-adapter.md §4.1 step 4 / §4.2 step 3 — `min`/`max` 미반영

- **target 위치**: `spec/4-nodes/6-presentation/4-form.md` §6.2 검증 지점 주석 (신규 구현 목록에 `min`/`max`(숫자 범위)·`pattern` 추가)
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/conventions/chat-channel-adapter.md` §4.1 step 4 / §4.2 step 3
- **상세**: chat-channel-adapter.md §4.1 step 4 는 "client-side 검증 (전 필드 type/pattern/minLength — …)" 으로 기술하고, §4.2 step 3 는 "클라이언트-side 검증 (type / pattern / minLength 등)" 으로 기술한다. 두 절 모두 `min`/`max` 숫자 범위 검증을 명시하지 않는다. 본 PR 에서 `validateFormSubmission` 에 `min`/`max` 검증이 추가됐으므로, chat-channel multi-step 다단계 시퀀스에서도 `min`/`max` 위반 시 해당 필드 재질문 흐름이 작동한다. 그러나 adapter spec 의 step 4/step 3 열거에 `min`/`max` 가 없어 외부 어댑터 구현자가 해당 검증 흐름을 모를 수 있다. 코드·동작은 이미 일관되나(server-side chokepoint 공유), adapter 컨벤션 문서만 구식.
- **제안**: `spec/conventions/chat-channel-adapter.md` §4.1 step 4 와 §4.2 step 3 의 검증 항목 열거에 `min`/`max`(숫자 범위) 를 추가 동기화. 필수는 아니지만 문서 완전성에 기여.

---

### 2. [INFO] WS 프로토콜 §4.2 `VALIDATION_ERROR` 설명 — `min`/`max`·`pattern` 미반영

- **target 위치**: `spec/4-nodes/6-presentation/4-form.md` §6.2 검증 지점
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/5-system/6-websocket-protocol.md` §4.2 `VALIDATION_ERROR` 설명 ("submit_form 의 field 검증 실패 (필수/type/minLength 등)")
- **상세**: WS spec 의 `VALIDATION_ERROR` 에러 코드 설명은 "필수/type/minLength 등" 만 열거하며 `min`/`max`·`pattern` 이 신규 구현됐음을 반영하지 않는다. EIA spec (`14-external-interaction-api.md`) 은 이미 본 PR 에서 갱신됐으나, WS spec 는 갱신되지 않아 열거가 구식이다. 실제 동작(모든 검증이 chokepoint 공유)은 정합하므로 기능 충돌은 없고 문서 동기화 갭.
- **제안**: `spec/5-system/6-websocket-protocol.md` §4.2 `VALIDATION_ERROR` 행의 설명을 "필수·type·`minLength`/`maxLength`·`min`/`max`(숫자 범위)·`pattern`·select/radio 선택지" 로 갱신 동기화.

---

### 3. [INFO] `spec/conventions/chat-channel-adapter.md` — `FormModalField.min/max/pattern` 신규 필드 문서화 미반영

- **target 위치**: `codebase/backend/src/modules/chat-channel/types.ts` `FormModalField` (신규 필드 `min`, `max`, `pattern` 추가 — 이번 PR 코드 변경)
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/conventions/chat-channel-adapter.md` — `FormModalField` 의 명시적 필드 정의를 담지 않음. 단, `types.ts` 를 SoT 로 참조하는 구조이므로 spec-code 정합 문제는 아님.
- **상세**: `FormModalField` 의 `minLength`/`maxLength` 는 spec §3.3 cross-ref 와 함께 `types.ts` JSDoc 에 명시돼 있다. 신규 `min`/`max`/`pattern` 은 `types.ts` JSDoc 에 "§6.2 — 서버측 검증 전용" 주석과 함께 추가됐고 chat-channel-adapter spec 은 `types.ts` 를 암묵적으로 코드 SoT 로 두는 구조라 직접 충돌은 없다. 그러나 spec 에 FormModalField 필드 개요를 정리한 §3.3 스타일의 설명 섹션이 없어, 신규 필드의 "UI hint 미사용, 서버측 검증 전용" 정책이 spec 레이어에서 명문화되지 않은 상태.
- **제안**: `spec/conventions/chat-channel-adapter.md` 에 `FormModalField` 필드 개요 표 또는 note 를 추가해 `min`/`max`/`pattern` 이 "서버측 재검증 전용, modal UI hint 미사용" 임을 명문화. 또는 현 JSDoc-only 접근을 유지하고 spec 을 codebase SoT 로 위임한다는 주석 추가.

---

### 요약

이번 변경(form `validation.min`/`max` 숫자 범위·`pattern` 정규식 서버측 검증 구현 + spec 동기화)에서 `spec/4-nodes/6-presentation/4-form.md` 와 `spec/5-system/14-external-interaction-api.md` 는 서로 일관되게 갱신됐으며, 핵심 기능 모델(chokepoint 단일 검증, 3-경로 공통, FIRST 오류 정책, waiting_for_input 재제출 가능)은 기존 spec 과 충돌하지 않는다. 발견된 세 항목은 모두 INFO 등급으로, 인접 spec 문서(`chat-channel-adapter.md`, `6-websocket-protocol.md`)의 검증 항목 열거가 구식이 된 동기화 갭이다. 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 관점에서 직접 모순이나 잠재 충돌은 발견되지 않았다.

### 위험도
LOW
