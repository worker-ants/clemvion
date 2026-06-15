# Cross-Spec 일관성 검토 결과

검토 대상: `plan/in-progress/spec-draft-form-validation-enum.md`
검토 일시: 2026-06-15

---

## 발견사항

### 1. [INFO] chat-channel-adapter §4.1 step 4 — `maxLength` 추가 (target 제안)

- **target 위치**: Draft 변경 1 — `spec/conventions/chat-channel-adapter.md §4.1 step 4`
- **충돌 대상**: 없음
- **상세**: 현재 §4.1 step 4 열거는 `type/pattern/minLength`이며 `maxLength`·`min/max`가 누락되어 있다. Form spec (`spec/4-nodes/6-presentation/4-form.md §6.2`, line 333)과 EIA spec (`spec/5-system/14-external-interaction-api.md`, line 313)은 이미 `maxLength`·`min`/`max`(숫자 범위)·`pattern`을 완전 열거한다. target의 `maxLength·min/max(숫자 범위)` 추가는 이들 인접 spec의 정의와 일관된 방향이다.
- **제안**: 추가 채택 권장. 단, §4.1 step 4의 열거는 "provider native 검증 우선 활용 후 어댑터 schema 검증"으로 이어지는 문맥이므로 `min/max`가 숫자형 필드(`type: 'number'`) 한정임을 명시하면 독자 혼동을 줄일 수 있다 (Form spec §6.2 및 EIA §5.1과 정합).

---

### 2. [INFO] chat-channel-adapter §4.2 step 3 — `maxLength·min/max(숫자 범위)` 추가 (target 제안)

- **target 위치**: Draft 변경 2 — `spec/conventions/chat-channel-adapter.md §4.2 step 3`
- **충돌 대상**: 없음
- **상세**: 현재 §4.2 step 3 열거는 `type / pattern / minLength 등`이며 `maxLength`·`min/max`가 누락되어 있다. `validateFormSubmission` SoT(`codebase/channel-web-chat/...form-mode.ts`)가 min/max/pattern까지 적용하고, Form spec §6.2 (line 333~347)이 이를 정식 SoT로 문서화하고 있다. target의 확장은 인접 spec과 모순 없이 일관적이다.
- **제안**: 추가 채택 권장.

---

### 3. [INFO] websocket-protocol §4.2 VALIDATION_ERROR 행 — `maxLength·min/max·pattern` 추가 (target 제안)

- **target 위치**: Draft 변경 3 — `spec/5-system/6-websocket-protocol.md §4.2 VALIDATION_ERROR 행`
- **충돌 대상**: 없음 (인접 spec과 일치 방향)
- **상세**: 현재 WS §4.2 VALIDATION_ERROR 행 (`필수/type/minLength 등`)은 `maxLength`·`min/max`·`pattern`을 열거하지 않는다. 반면 EIA §5.1 (line 313)은 이미 `validation.minLength`/`maxLength`·`min`/`max`(숫자 범위)·`pattern`(정규식)·select/radio 선택지를 완전 열거하고, Form spec §6.2 (line 333)도 동일하다. 두 spec이 "EIA·WS·UI 3 경로 공통 검증"이라고 명시하고 있으므로 WS spec 행의 열거만 구식인 상태다. target의 갱신은 이 drift를 해소한다.
- **제안**: 추가 채택 권장. EIA spec의 전체 열거(`필수/type(email/number)/minLength/maxLength/min/max(숫자 범위)/pattern(정규식)/select·radio 선택지`)를 WS spec에도 동일하게 반영하면 "3 경로 공통 검증"이라는 Form spec §6.2의 단일 진실 선언과 완전히 일치한다. target 초안의 `필수/type/minLength·maxLength·min/max·pattern 등`은 `select/radio 선택지`를 생략하는데, 이 항목도 WS 경로에서 공통 검증되므로 추가를 검토할 수 있다.

---

### 4. [INFO] EIA §5.1과 WS §4.2 간 기존 drift — 본 draft scope 외

- **target 위치**: N/A (기존 상태 관찰)
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md §5.1` vs `spec/5-system/6-websocket-protocol.md §4.2 VALIDATION_ERROR`
- **상세**: target draft가 수정하기 **전** 현재 상태에서 EIA §5.1 (line 313)은 `min`/`max`·`pattern`을 이미 열거하는 반면, WS §4.2 VALIDATION_ERROR 행은 `minLength 등`만 열거하고 있어 두 spec 사이에 이미 drift가 존재한다. 이 drift는 target draft가 WS §4.2를 갱신함으로써 해소되므로 별도 조치 불필요 — draft가 통과하면 해소됨.
- **제안**: draft 적용 후 EIA §5.1의 `select/radio 선택지` 항목이 WS §4.2에 반영되지 않는 잔여 drift가 생길 수 있다. 발견사항 3의 제안 참조.

---

## 요약

target draft는 `chat-channel-adapter.md §4.1 step 4`, `§4.2 step 3`, `websocket-protocol.md §4.2 VALIDATION_ERROR` 세 곳의 검증 규칙 열거를 `min`/`max`·`maxLength`·`pattern` 포함으로 현행화하는 순수 문서 동기화다. 이 변경은 Form spec(`spec/4-nodes/6-presentation/4-form.md §6.2`)과 EIA spec(`spec/5-system/14-external-interaction-api.md §5.1`)이 이미 완전 열거한 내용과 충돌 없이 일치 방향이며, 데이터 모델·API 계약·요구사항 ID·상태 머신·RBAC 어떤 차원에서도 모순이 발견되지 않는다. 다만 WS §4.2 행에서 `select/radio 선택지` 항목이 초안에서 생략되어 EIA spec과의 잔여 불일치가 소규모 발생할 수 있으므로, 최종 draft 작성 시 보완을 권고한다.

---

## 위험도

NONE

---

STATUS: OK
