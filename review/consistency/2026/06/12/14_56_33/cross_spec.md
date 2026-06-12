# Cross-Spec 일관성 검토 결과

**대상 문서**: `spec/5-system/15-chat-channel.md`
**검토 일시**: 2026-06-12
**검토 범위**: spec draft (--spec 모드)

---

## 발견사항

### [INFO] §5.5 응답 본문 shape 의 TransformInterceptor 래핑 여부 명시 부재

- **target 위치**: `spec/5-system/15-chat-channel.md` §5.5 케이스 매트릭스 — `{ executionId: 'ignored' }` 본문 표기
- **충돌 대상**: `spec/5-system/12-webhook.md` §3.1 — "전역 `TransformInterceptor` 가 `{ "data": { ... } }` 로 래핑", §7 step 10 — `202 Accepted + { data: { executionId, message } }` (일반 경로는 `{ data }` 래핑 명시)
- **상세**: target §5.5 표의 "본문" 컬럼은 `{ executionId: 'ignored' }` 와 `{ executionId }` 로 raw shape 만 기술한다. webhook spec §3.1 은 정상 경로 202 응답이 `TransformInterceptor` 에 의해 `{ "data": { executionId, message } }` 로 래핑됨을 명시한다. chat channel 경로의 `{ executionId: 'ignored' }` 가 동일하게 `{ "data": { executionId: 'ignored' } }` 로 래핑되는지, 또는 TransformInterceptor 를 우회하는지가 §5.5 에 명시되지 않았다. webhook §7 step 7f 에는 Slack/Discord provider-specific 응답은 "비-래핑 JSON" 임을 언급하지만, `executionId: 'ignored'` 케이스는 그 언급이 없다. target §4.1.1 각주 "구현 메모" 에서 hooks.service.ts 의 `state?.executionId ?? 'ignored'` 반환을 언급하지만 래핑 여부는 미언급.
- **제안**: target §5.5 의 "본문" 컬럼 헤더 또는 각주에 "정상 202 응답은 전역 `TransformInterceptor` 에 의해 `{ data: { executionId } }` 로 래핑됨 — webhook §3.1 과 동일" 을 명시. provider-specific 200 OK 응답 (Slack URL Verification 등) 은 TransformInterceptor 우회(직접 JSON 응답)임을 §5.5.1 에서 이미 설명하므로 나머지 202 케이스의 래핑 여부도 동일 기준으로 명시.

---

### [INFO] CCH-ERR-* §3.5 의 `UNKNOWN_PLACEHOLDER` 코드가 API Convention `details[].code` 의 `INVALID_FIELD` 패턴과 비일치

- **target 위치**: `spec/5-system/15-chat-channel.md` Rationale R-CC-15 (c) — "`UNKNOWN_PLACEHOLDER` 는 `VALIDATION_ERROR` 의 하위 세부 코드, §1.3 의 top-level error.code enum 에는 등재하지 않음"
- **충돌 대상**: `spec/5-system/2-api-convention.md` §5.3 — 검증 오류 `details` 항목은 `{ field, message, code: "INVALID_FIELD" }` 구조이며 `code` 필드는 `INVALID_FIELD` 고정
- **상세**: target R-CC-15 (c) 는 `languageHints` placeholder 등록 검증 실패 시 `VALIDATION_ERROR` (details[].code = `UNKNOWN_PLACEHOLDER`) 를 응답한다고 정의한다. 그러나 API Convention §5.3 의 `details` 항목 `code` 는 `INVALID_FIELD` 로 고정돼 있다. 두 spec 이 `VALIDATION_ERROR` 의 `details[].code` 필드에 서로 다른 값 (`UNKNOWN_PLACEHOLDER` vs `INVALID_FIELD`) 을 정의하고 있어, 구현 시 어느 쪽을 따를지 명확하지 않다. 이 불일치는 현재 프레임워크 레벨의 표준 validator 가 `INVALID_FIELD` 를 일관 사용하는 상황에서 도메인별 추가 코드를 허용하는지 여부를 spec 이 명시하지 않은 데서 발생한다.
- **제안**: (A) API Convention §5.3 에 "도메인 전용 details[].code 는 `INVALID_FIELD` 를 우선 쓰되, 의미 세분화가 필요한 경우 명시적으로 확장 가능" 조항을 추가하거나, (B) target R-CC-15 (c) 의 `UNKNOWN_PLACEHOLDER` 를 `INVALID_FIELD` 로 통일하고 `message` 필드로 의미를 설명. 양 방향 모두 INFO 수준 (컴파일 타임 오류 없음, 동작 차이 없음) 이나 API 소비자 SDK 가 `details[].code` 를 enum 으로 파싱한다면 문제가 될 수 있다.

---

### [INFO] §4.1 config 의 `botToken` 입력 전용 필드 — `spec/1-data-model.md §2.8 Trigger` 응답 DTO 계약과 명시적 교차 참조 부재

- **target 위치**: `spec/5-system/15-chat-channel.md` §4.1 `chatChannel.botToken` 주석 — "입력 전용 — POST /api/triggers 요청 body 한정. service 가 SecretResolver.store 로 옮긴 뒤 strip"
- **충돌 대상**: `spec/1-data-model.md §2.8 Trigger` `config` 필드 설명 — `chatChannel` 서브필드는 `spec/5-system/15-chat-channel.md §4.1` 참조 한 줄만 있고, strip 정책의 cross-link 없음
- **상세**: target §4.1 은 `botToken` 이 입력 전용(응답·DB JSONB 미노출)임을 명시한다. 데이터 모델 §2.8 의 Trigger config JSONB 설명에는 EIA 의 `notification.signing.secretRef` 와 동일 정책임을 언급하지만, `botToken` plaintext 의 strip 정책은 명시적으로 cross-link 되지 않는다. `spec/5-system/14-external-interaction-api.md §7.1` 은 notification secret 의 strip 정책을 EIA 도메인 단일 진실로 기술하며 데이터 모델에서 참조되나, chat channel 의 `botToken` strip 은 그 참조가 없다. 직접적인 모순은 아니나 명확한 동기화가 권장된다.
- **제안**: `spec/1-data-model.md §2.8` Trigger `config` 컬럼 설명의 `chatChannel` 참조 줄에 "`botToken` / `inboundSigningPlaintext` 는 입력 전용 — 응답·DB JSONB 에 미노출 (strip), `botTokenRef`/`inboundSigningRef` ref 만 보관 (CCH-SE-03)" 한 줄 추가 동기화 권장.

---

### [INFO] §5.4 `rotate-bot-token` 응답 200 OK — API Convention `{ data }` 래퍼 명시이나 `rotatedAt` 외 Planned 필드 부재 동기화 필요

- **target 위치**: `spec/5-system/15-chat-channel.md` §5.4 성공 응답 200 OK — `{ "data": { "rotatedAt": "<ISO8601>" } }` + "Planned 미구현" 언급
- **충돌 대상**: `spec/5-system/2-api-convention.md` §5.1 — `{ data }` 래퍼 + `TransformInterceptor` 규약
- **상세**: target §5.4 는 rotate-bot-token 성공 응답이 API Convention §5.1 의 `{ data }` 래퍼 + `TransformInterceptor` 를 따름을 명시하며 일치한다. "Planned 미구현" (`triggerId` / `chatChannelHealth` / `botIdentity` 3필드 동봉) 에 대한 형식 계약은 현재 미정의로, 향후 추가 시 API Convention 패턴 그대로 확장하면 되는 INFO 수준이다. 충돌은 없으며 동기화 메모로 유지.
- **제안**: `triggerId` / `chatChannelHealth` / `botIdentity` 3필드의 Planned 구현이 착수될 때, `spec/5-system/15-chat-channel.md §5.4` 의 응답 예시를 갱신하는 것으로 충분.

---

### [INFO] CCH-AD-07 `execution.node.completed` 이벤트 — EIA §6.1 outbound HTTP 화이트리스트와의 범위 경계 명시

- **target 위치**: `spec/5-system/15-chat-channel.md` CCH-AD-07 — "외부 HTTP webhook (EIA §6.1) 화이트리스트는 변경 없음 — 본 listener 는 chat-channel-internal 한정"
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md` §6.1 outbound HTTP webhook 화이트리스트 5종 (execution.waiting_for_input / ai_message / completed / failed / cancelled), R10 §chat-channel-internal 추가 listener 허용 범위 명시
- **상세**: target CCH-AD-07 과 EIA R10 양쪽 모두 "화이트리스트 5종 변경 없음, chat-channel-internal 한정" 을 명시하며 일치한다. EIA R10 은 "외부 HTTP webhook §6.1 화이트리스트 5종은 변경 없음 (chat-channel-internal 한정, 외부 SDK 미노출)" 로 target 과 정합. 충돌 없음. 단, convention `chat-channel-adapter.md §1.3` 에서 `ChatChannelInternalEvent` 의 구체 이벤트 목록이 EIA R10 및 CCH-AD-07 과 동기화됐는지 별도 확인이 권장됨.
- **제안**: `conventions/chat-channel-adapter.md §1.3 ChatChannelInternalEvent` 의 이벤트 목록과 CCH-AD-07 / EIA R10 의 허용 이벤트 목록이 일치하는지 검토. 현재 target 과 EIA는 정합 확인됨.

---

## 요약

`spec/5-system/15-chat-channel.md` (draft) 는 기존 spec 영역 (`spec/5-system/12-webhook.md`, `spec/5-system/14-external-interaction-api.md`, `spec/1-data-model.md`, `spec/conventions/secret-store.md`, `spec/conventions/conversation-thread.md`, `spec/5-system/2-api-convention.md`) 과 대부분 정합적이다. 데이터 모델 (`spec/1-data-model.md §2.8`) 의 신규 5개 Trigger 컬럼은 target §4.2 와 완전히 동기화됐고, EIA 의 `in_process_trusted` 예외 조항 (EIA-AU-08), 단일 sink `WebsocketService.executionEvents$` 정책 (EIA §R10), Webhook WH-EP-07 예외, secret-store 의 ref URI 패턴 모두 target 과 충돌 없이 상호 참조하고 있다. 발견된 4건은 모두 INFO 등급으로, (1) chat channel 202 응답에 TransformInterceptor 래핑 명시 여부 보완, (2) VALIDATION_ERROR 의 details[].code 값 (`UNKNOWN_PLACEHOLDER` vs `INVALID_FIELD`) 의 API Convention 과의 표기 불일치, (3) 데이터 모델에서 botToken strip 정책 교차 참조 부재, (4) rotate-bot-token Planned 필드의 미정의 형식 계약이다. CRITICAL 또는 WARNING 등급의 충돌은 없다.

## 위험도

LOW

---

STATUS: OK
