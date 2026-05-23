# API 계약(API Contract) 리뷰

**대상 PR**: render_form submit 흐름 — silent failure + dispatch fragility 종합 수정  
**리뷰 범위**: 4개 소스 파일 + 1개 plan 파일 + 내부 일관성 리뷰 산출물

---

## 발견사항

### [INFO] WS 이벤트명 불일치 — ack 이벤트 네이밍 패턴 비일관성

- 위치: `use-execution-interaction-commands.ts` L718 / `websocket.gateway.ts` L362
- 상세: 다른 명령의 ack 이벤트는 `execution.<command>.ack` 패턴을 따른다 (`execution.submit_message.ack`, `execution.click_button.ack`, `execution.end_conversation.ack`). 그러나 `execution.submit_form` 의 ack 이벤트는 `execution.form_submitted` 로 동사-과거형 패턴이 혼용된다. 이 패턴 불일치는 이번 변경에서 신규 도입된 것이 아니라 기존부터 존재했으나, 이번 변경에서 프론트엔드가 `execution.form_submitted` ack 이벤트를 직접 `once` 로 구독하는 로직을 추가하면서 계약의 일부로 더 명시화되었다.
- 제안: 향후 API 정리 시 `execution.submit_form.ack` 로 통일을 검토할 것. 이번 변경은 기존 패턴을 유지하므로 breaking change 아님, INFO 수준.

### [INFO] 외부 WS wire 와 내부 Bus 의 payload 분리 — 계약 문서화 누락 가능성

- 위치: `execution-engine.service.ts` L535~L172 (변경된 `registerContinuationHandlers`), `websocket.gateway.ts` L347~L394, `interaction.service.ts` L65~L78
- 상세: 외부 클라이언트(WS, REST 모두)는 `{ executionId, formData }` 를 그대로 전송한다. gateway/interaction-service 에서 `continueExecution(executionId, data.formData)` 를 호출하고, 내부 bus 에서는 `{ type: 'form_submitted', formData }` sentinel 로 wrap 된다. 이 두 레이어의 contract 분리는 명확하게 구현되어 있으며 외부 클라이언트에게는 아무 영향이 없다. 다만 `spec/5-system/6-websocket-protocol.md` 에 외부 wire contract 명문화가 계획(`plan/in-progress/render-form-submit-fix.md` §S 항목 3)되어 있으나, plan 의 TDD 체크리스트에서는 해당 spec 파일 작업이 "(해당 시)" 선택 사항으로 표기되어 있다. API 계약 관점에서 외부 클라이언트가 참조하는 WS protocol spec 에 payload shape 명문화가 누락될 경우 추후 혼선의 원인이 될 수 있다.
- 제안: `spec/5-system/6-websocket-protocol.md` 의 `execution.submit_form` 항목에 `{ executionId: string, formData: Record<string, unknown> }` payload shape 을 명문화하고, 내부 bus sentinel 과의 레이어 분리를 cross-ref 주석으로 명시할 것을 권장.

### [INFO] WS ack 실패 시 optimistic 메시지 유지 — REST API 경로와 롤백 동작 불일치

- 위치: `use-execution-interaction-commands.ts` (frontend) L721~L727
- 상세: 프론트엔드 WS 경로에서 ack 실패 시 `isWaitingAiResponse` 는 해제하되 optimistic `presentation` 메시지는 "재시도 안내 차원"으로 유지한다. 이는 `sendMessage` 의 ack 실패 동작(마찬가지로 user 메시지 유지)과 대칭적이다. 그러나 REST API 경로(`interaction.controller.ts` → `interaction.service.ts` → `continueExecution`)는 별도의 낙관적 UI 레이어가 없으므로 이 정책은 WS 클라이언트에만 해당된다. 계약 관점에서 두 경로(WS, REST) 사이의 클라이언트 경험 불일치가 존재하나, REST 경로는 서버사이드 / WS 경로는 UI-facing 으로 설계 의도가 다르므로 현재 구현은 허용 수준이다.
- 제안: 해당 동작 차이를 spec 의 §Rationale 또는 주석에 명시적으로 기록하여 추후 구현자의 혼선을 방지할 것.

---

## 요약

이번 변경의 핵심은 `execution.submit_form` → `continueExecution` → 내부 bus 경로에서 발생하던 dispatch fragility(form 필드명이 `type` 인 경우 silent drop)를 `{ type: 'form_submitted', formData }` sentinel wrap 으로 해결하고, 프론트엔드에 누락되어 있던 optimistic UI 를 추가한 것이다. API 계약 관점에서 외부 클라이언트(WS, REST)가 사용하는 wire format(`{ executionId, formData }`)은 변경 전후 완전히 동일하게 유지되어 하위 호환성이 보장된다. 인증/인가(userId 검증 + IDOR 차단)도 이전과 동일하게 적용되고 있다. 새로 도입된 `form_submitted` ack 이벤트 구독 방식은 기존 `once` 패턴과 일관된다. 발견된 3건은 모두 INFO 수준으로, 기존 ack 이벤트명 패턴 불일치(기존 코드), 외부 WS protocol spec 문서화 권장 사항, 그리고 WS/REST 경로 간 클라이언트 경험 차이 기록 권장 사항이며 즉각적인 차단 이유는 없다.

---

## 위험도

NONE (Breaking change 없음. 발견사항 3건 전부 INFO 수준)
