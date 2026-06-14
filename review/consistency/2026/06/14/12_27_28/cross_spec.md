# Cross-Spec 일관성 검토 결과

- 검토 대상: `spec/5-system/14-external-interaction-api.md`
- 검토 일시: 2026-06-14
- 검토 모드: spec draft (`--spec`)

---

## 발견사항

### [INFO] `3-error-handling.md` §1.3 note 가 EIA 진입점의 `STATE_MISMATCH` (409) 를 명시하지 않음
- **target 위치**: EIA §5.1 에러 표 — `409 Conflict` / `STATE_MISMATCH`
- **충돌 대상**: `spec/5-system/3-error-handling.md` §1.3 note (line 107) — "INVALID_EXECUTION_STATE 와 동일 의미의 REST 코드는 §1.3 의 `INVALID_STATE` (422)"
- **상세**: 3-error-handling.md note 107 은 `INVALID_EXECUTION_STATE`(WS) 의 REST 매핑을 `INVALID_STATE`(422) 하나만 언급한다. 실행 엔진 §7.5.1 은 "WS = `INVALID_EXECUTION_STATE` / REST `POST :id/continue` = 422 `INVALID_STATE` / EIA 외부 진입점 = 409 `STATE_MISMATCH`" 의 3-way 분리를 명문화하고 있고, EIA target spec §5.1 도 이를 채택한다. 3-error-handling.md note 만 읽으면 EIA REST 진입점도 `INVALID_STATE`(422) 를 쓴다고 오인할 수 있다. 모순이 아니라 누락.
- **제안**: `spec/5-system/3-error-handling.md` §1.3 note 107 에 "단 EIA 외부 진입점은 `STATE_MISMATCH` (409) 로 별도 매핑 — [실행 엔진 §7.5.1] / [EIA §5.1]" 을 보충 권장. EIA target 변경 불필요.

---

### [INFO] `3-error-handling.md` 에 EIA 전용 error code 들이 미등록
- **target 위치**: EIA §5.1 에러 표 — `SCOPE_MISMATCH` / `EXECUTION_NOT_FOUND` / `EXECUTION_TERMINATED` / `TOO_MANY_CONNECTIONS` 등
- **충돌 대상**: `spec/5-system/3-error-handling.md` §1.x 전체 테이블 — 상기 코드 부재
- **상세**: EIA §5.1 에서 정의하는 REST 오류 코드 다수가 3-error-handling.md 에 집계되지 않는다. `TOKEN_INVALID` / `TOKEN_EXPIRED` / `RATE_LIMITED` 는 기존 auth/global 코드로 재사용하나, `SCOPE_MISMATCH` / `EXECUTION_NOT_FOUND` / `EXECUTION_TERMINATED` / `TOO_MANY_CONNECTIONS` 는 신규 코드로 에러 카탈로그에 없다. 동작상 모순은 없으나 error-handling 을 단일 에러 카탈로그로 참조하는 독자에게 EIA 표면이 누락되어 보인다.
- **제안**: 3-error-handling.md 에 "EIA 전용 에러 코드는 [Spec EIA §5.1] 참조" cross-link 추가 권장. EIA target 변경 불필요.

---

### [INFO] `execution.ai_message` SSE wire 의 `message` 필드 표기 — WS spec 과 일치하나 payload 동일/비동일 경계가 약간 혼재
- **target 위치**: EIA §5.2 이벤트 목록 note — "각 이벤트의 페이로드는 WS §4.1·§4.4 와 동일"
- **충돌 대상**: `spec/5-system/6-websocket-protocol.md` §4.1 (line 189) — `execution.ai_message` payload `message` 필드 사용
- **상세**: EIA §6.5 및 §5.2 note 에서 "SSE wire 에서 어시스턴트 텍스트를 `message` 필드로 전송" 이라고 명시하고, WS spec §4.1 도 동일 필드명 `message` 를 사용하므로 실질 모순은 없다. 다만 EIA §5.2 의 "WS §4.1·§4.4 와 동일" 표현이 notification envelope 재구성 없이 fanout wire 그대로 전송되는 특성(§6.2 note)과 병존해 동일/비동일 범위가 약간 혼재한다. 기능상 무결.
- **제안**: EIA §5.2 의 해당 주석에 "이벤트 이름·payload 필드는 WS §4.1·§4.4 와 동일하나 notification envelope (`triggerId`·`workflowId`·`timestamp`) 없이 fanout wire 원형 전송" 으로 명확화 권장(선택).

---

### [INFO] `Trigger.config.interaction.triggerToken` 평문 보관 caveat 가 data-model 에 미반영
- **target 위치**: EIA §7.1 — "`config.interaction.triggerToken` 는 현재 JSONB 평문 (향후 secret store 통합 검토)"
- **충돌 대상**: `spec/1-data-model.md` §2.8 Trigger 테이블 `config` JSONB 설명
- **상세**: 1-data-model.md §2.8 의 `config` 컬럼은 EIA §7.1 로 cross-link 하지만 `triggerToken` 의 평문 보관 보안 caveat 를 data-model 단에서 반복하지 않는다. 모순은 없으나 데이터 모델 리뷰어가 해당 경고를 놓칠 수 있다.
- **제안**: 1-data-model.md §2.8 `config` JSONB 설명에 "(per_trigger token 은 현재 JSONB 평문 — EIA §7.1 security caveat 참조)" 짧은 주석 추가 권장(선택).

---

## 요약

`spec/5-system/14-external-interaction-api.md` (target) 는 데이터 모델(`spec/1-data-model.md`), 실행 엔진(`spec/5-system/4-execution-engine.md`), WebSocket 프로토콜(`spec/5-system/6-websocket-protocol.md`), Webhook(`spec/5-system/12-webhook.md`), Chat Channel(`spec/5-system/15-chat-channel.md`), API 규약(`spec/5-system/2-api-convention.md`), Auth(`spec/5-system/1-auth.md`) 와 전체적으로 정합하며 직접 모순은 발견되지 않는다. `STATE_MISMATCH`(409)/`INVALID_STATE`(422) 의 3-way 진입점 분리, `seq` 공유 정책, HMAC 알고리즘 표기 분리(R12), in-process trusted caller 예외(EIA-AU-08), notification_health 컬럼 확장 등 모두 cross-link 와 Rationale 로 상호 정당화되어 있다. 식별된 4건은 모두 INFO 수준의 누락·문서화 개선 제안이며, 어떤 것도 두 영역 중 하나의 작동을 막는 구조적 모순에 해당하지 않는다.

## 위험도

NONE
