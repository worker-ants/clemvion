# Rationale 연속성 검토 결과

검토 모드: `--impl-done` (구현 완료 후, diff-base=main)
검토 대상: `spec/4-nodes/6-presentation/4-form.md` 구현 (EIA form 검증 경로)

---

## 발견사항

### 1. **[WARNING]** `VALIDATION_FAILED` → `VALIDATION_ERROR` 코드명 불일치 — spec 2곳 미갱신

- **target 위치**: `idempotency.interceptor.ts` 주석 변경 (diff: `VALIDATION_FAILED` → `VALIDATION_ERROR`), `interaction.controller.ts` API 문서 변경, `interaction.service.ts` 구현
- **과거 결정 출처**:
  - `spec/conventions/chat-channel-adapter.md §4.1 step 5` — `server-side 검증 실패 (400 VALIDATION_FAILED + fieldErrors)` 로 명시
  - `spec/conventions/chat-channel-adapter.md §4.2 step 5` — `EIA 가 server-side 검증 실패 (400 VALIDATION_FAILED + fieldErrors)` 로 명시
  - `spec/4-nodes/7-trigger/providers/slack.md:116` — `server-side 검증 실패 (EIA 400 VALIDATION_FAILED)` 로 명시
- **상세**: EIA spec(`spec/5-system/14-external-interaction-api.md §5.1`)은 `400 VALIDATION_ERROR`를 SoT 로 이미 확립해 둔 반면, `chat-channel-adapter.md`(§4.1·§4.2)와 `providers/slack.md`(§5.3)는 여전히 `VALIDATION_FAILED` + `fieldErrors` 구조를 참조하고 있다. 구현이 EIA spec 의 `VALIDATION_ERROR` + `details[]` 를 따르는 것은 EIA Rationale R8 과 정합하지만, 위 두 spec 파일은 기각된 이름을 여전히 사용 중이므로 어댑터 구현자가 `VALIDATION_FAILED` 코드와 `fieldErrors` 키를 기대하는 회귀를 유발할 수 있다. 구현 자체는 옳으나 spec 2곳의 코드명이 stale 하다.
- **제안**: `spec/conventions/chat-channel-adapter.md §4.1 step 5`, `§4.2 step 5` 의 `VALIDATION_FAILED + fieldErrors` → `VALIDATION_ERROR + details[]` 로 갱신. `spec/4-nodes/7-trigger/providers/slack.md:116` 동일 갱신. 이 변경은 신규 Rationale 없이 기존 EIA §5.1 cross-link 추가만으로 충분.

---

### 2. **[INFO]** WS ack 에러 코드 표(`spec/5-system/6-websocket-protocol.md §4.2`)에 `VALIDATION_ERROR` 항 미등재

- **target 위치**: `websocket.gateway.spec.ts` W-12 테스트 — `FormValidationError → ack { errorCode: VALIDATION_ERROR }` 를 검증
- **과거 결정 출처**: `spec/5-system/6-websocket-protocol.md §4.2` 에러 코드 표 — `INVALID_EXECUTION_STATE`, `EXECUTION_MESSAGE_TOO_LONG`, `EXECUTION_INTERNAL_ERROR`, `RESUME_*` 만 등재됨. `VALIDATION_ERROR` 는 없음.
- **상세**: 구현은 `FormValidationError` (typed `ExecutionError` 계층) 가 `buildContinuationErrorAck` 를 통해 `errorCode: 'VALIDATION_ERROR'` 로 surface 되도록 한다. WS spec §4.2 에러 코드 표는 typed `ExecutionError` 서브클래스의 `code` 가 ack 로 전파되는 패턴을 설명하지만 `VALIDATION_ERROR` 코드를 명시적으로 등재하지 않아 spec 독자가 이 코드가 WS ack 에 나올 수 있음을 인지하기 어렵다. 이는 결정의 번복이 아니라 등재 누락이다. `EXECUTION_MESSAGE_TOO_LONG` (typed error) 이 이미 표에 등재된 패턴과 동일하게 `VALIDATION_ERROR` 도 등재되어야 일관성이 유지된다.
- **제안**: `spec/5-system/6-websocket-protocol.md §4.2` 에러 코드 표에 `VALIDATION_ERROR` 행 추가: `submit_form` field 검증 실패 — publisher 측 동기 검증(`FormValidationError`, `spec/4-nodes/6-presentation/4-form.md §6.2`). `EXECUTION_MESSAGE_TOO_LONG` 과 동일 계층.

---

### 3. **[INFO]** `form.md` 에 `## Rationale` 섹션 부재 — 설계 결정 근거 미기록

- **target 위치**: `spec/4-nodes/6-presentation/4-form.md` 전체
- **과거 결정 출처**: 프로젝트 CLAUDE.md "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`" 단일 진실 원칙
- **상세**: `form.md` 에는 `## Rationale` 섹션이 없다. 구현 diff 에서 확립된 설계 결정들(FIRST 오류만 surface; publisher 측 동기 검증; file MIME·크기·개수 검증은 Planned; `coerceFormSubmission` 의 null→'' 정규화 정책)이 spec 본문 주석으로 산재해 있으나 Rationale 로 정리되어 있지 않다. 특히 "FIRST 오류만 반환" 정책은 `FormValidationError.toHttpDetails()` 의 "details 배열 길이 항상 1" 계약과 직결되는 중요한 결정이다 — 향후 "전체 오류 반환" 으로 바꾸는 제안이 들어올 때 이 결정이 왜 내려졌는지 추적 불가.
- **제안**: `form.md` 말미에 `## Rationale` 섹션 신설. 최소 포함 항목: (1) FIRST 오류 단일 반환 — 채팅 채널의 필드별 순차 재질문 흐름(`chat-channel-adapter.md §4.2 step 5`)이 `fieldErrors[0]` 만 사용하므로 전체 오류 배열이 불필요. (2) publisher 측 동기 검증 위치 선택 — continueExecution chokepoint 에서 3경로(UI WS·EIA REST·외부 WS) 공유. (3) file 검증 Planned defer 근거.

---

## 요약

구현 자체는 EIA spec(`spec/5-system/14-external-interaction-api.md`) Rationale R8(`VALIDATION_ERROR` 제외 idempotency)과 완전히 정합하며, 기각된 대안(`VALIDATION_FAILED` 이름, notification 응답으로 인터랙션 수신 R2, per-node 큐 등)을 재도입하지 않는다. 그러나 `VALIDATION_ERROR`/`details[]` 로의 코드명 확정을 반영하지 못한 spec 파일이 두 곳(`chat-channel-adapter.md §4.1·§4.2`, `providers/slack.md §5.3`) 남아 있어 어댑터 구현자 혼란의 여지가 있다. 또한 WS 에러 코드 표의 `VALIDATION_ERROR` 미등재와 `form.md` Rationale 부재가 미래 결정 번복 위험을 높인다. 이 세 항목 모두 구현 자체의 정확성 문제가 아닌 spec 정합 보완 사항이다.

---

## 위험도

LOW
