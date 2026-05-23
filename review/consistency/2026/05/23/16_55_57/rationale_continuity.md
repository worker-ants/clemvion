# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/multiturn-error-preserve.md`
검토 모드: spec draft 검토 (--spec)
검토 일시: 2026-05-23

---

## 발견사항

### [WARNING] `NodeHandlerOutput` 5필드 제약 — `_retryState` top-level 필드 추가의 Rationale 갱신 필요

- **target 위치**: plan §C "백엔드 의미" — "`_retryState` 의 handler return 위치 — `_resumeState` 와 동일하게 top-level`"
- **과거 결정 출처**: `spec/4-nodes/3-ai/1-ai-agent.md §7` 본문 서두 ("5필드 (`config`/`output`/`meta?`/`port?`/`status?`) 외 top-level 키 금지"), `spec/conventions/node-output.md Principle 0` ("이 5필드의 의미는 어떤 노드에서든 동일해야 합니다")
- **상세**: Principle 0 는 `NodeHandlerOutput` 의 5필드 외 top-level 키를 금지한다. `_resumeState` 는 이 규칙의 명시적 예외로 AI agent §7 본문 서두에 "top-level 에 위치하되 expression resolver 에서는 노출하지 않는다 — Principle 4.2" 라는 단서로 기재되어 있다. 그러나 `_retryState` 라는 두 번째 internal top-level 필드를 신설하는 것은 동일한 예외 처리이면서도 **AI agent §7 본문 서두가 현재 `_resumeState` 만 단수로 열거**하고 있어, 새 예외를 추가하려면 해당 서두와 Principle 0 의 예외 목록(또는 각주)을 함께 갱신해야 한다. plan 이 영향 spec 표에서 §7.4 갱신을 기술하고 있으나, §7 서두의 "5필드 외 top-level 키 금지" 조항이 `_retryState` 도 명시 예외로 등재되어야 함을 직접 언급하지 않는다.
- **제안**: `spec/4-nodes/3-ai/1-ai-agent.md §7` 서두 괄호 주석을 "(`_resumeState`, `_retryState` 는 multi-turn internal 전달 필드로 top-level 에 위치하되 expression resolver 에서는 노출하지 않는다 — Principle 4.2)" 로 갱신하고, Principle 0 참조 매트릭스에 `_retryState` strip 예외를 함께 기재한다.

---

### [WARNING] `execution.retry_last_turn` ack payload 에 `nodeId` 누락 — 기존 ack 패턴과의 비대칭

- **target 위치**: plan §C "새 WS 명령 `execution.retry_last_turn`" — "ack payload (성공): `{ executionId, nodeExecutionId, resumed: true }`"
- **과거 결정 출처**: `spec/5-system/6-websocket-protocol.md §4.2` 의 `execution.click_button.ack` — `{ executionId, nodeId, buttonId, resumed: true }` (nodeId 포함)
- **상세**: `click_button.ack` 는 `executionId` + `nodeId` + `buttonId` + `resumed` 4종을 반환한다. `retry_last_turn.ack` 는 `nodeId` 없이 `nodeExecutionId` 만 반환하도록 설계되어 있다. plan 은 "nodeExecutionId vs nodeId 사용 사유" 절에서 row 단위 식별자가 필요한 이유를 설명하지만, ack 에서 기존 명령들이 항상 포함시키던 `nodeId` 를 왜 생략하는지(클라이언트가 어떤 노드를 retry 했는지 확인할 때 `nodeExecutionId` 로 `nodeId` 를 다시 조회해야 함)에 대한 Rationale 이 없다. `click_button.ack` 의 `nodeId` 포함 패턴을 번복하고 있으나 그 사유가 명시적으로 기록되지 않았다.
- **제안**: plan §C ack 설계 비고에 "ack 에 `nodeId` 를 포함하지 않는 이유 — 클라이언트는 이미 `nodeExecutionId` 로 대상을 특정했으므로 redundant; 기존 명령들의 `nodeId` 포함은 nodeId 만으로 대상을 식별하는 구조에서 필요했던 것" 을 한 줄 추가하거나, 또는 `nodeId` 도 ack 에 포함시켜 기존 패턴을 유지한다.

---

### [WARNING] `system` source 재사용 기각 결정의 cross-ref 부재

- **target 위치**: plan §B "ConversationTurnSource 에 새 source `system_error` 추가" 및 §B Rationale "system_error vs `system` source 재사용"
- **과거 결정 출처**: `spec/conventions/conversation-thread.md §1.1` — `system` source 는 "예약 (v1 자동 누적 없음)" 이며, §9.1 시각 매핑 표에서도 "v1 자동 push 없음" 으로 명시됨
- **상세**: plan 의 Rationale 에서 `system` source 재사용 대신 `system_error` 를 신설한 이유를 적절히 기술하고 있다. 다만 현재 `spec/conventions/conversation-thread.md §1.1` 과 §8 Rationale 에는 `system` source 가 "v2 매뉴얼 system note 도입 시 활성화" 예약임이 기술되어 있고, `system_error` 는 다른 의미·인터랙션을 가지므로 별도 source 가 타당하다. 이 결정은 기존 Rationale 과 방향이 일치한다. 그러나 `spec/conventions/conversation-thread.md §8` Rationale 에 `system_error` 신설 결정과 `system` source 재사용 기각 사유를 2026-05-23 항으로 추가해야 한다 — plan 의 Rationale 절이 단독으로 기록하고 있어 spec 단일 진실 원칙 상 spec 문서에도 반영이 필요하다.
- **제안**: 영향 spec 표의 `spec/conventions/conversation-thread.md §10 CHANGELOG` 항에 이미 2026-05-23 row 추가가 명시되어 있으나, §8 Rationale 에도 `system_error` 신설 사유 한 항을 추가하도록 영향 spec 표에 명시한다.

---

### [INFO] `_retryState.expiresAt` TTL 60분 근거 — Rationale 에 명시 권장

- **target 위치**: plan §C "`_retryState` 포함 필드" 표 및 "R1 채택 사유" — "TTL — 기본 60분"
- **과거 결정 출처**: 기존 spec 어디에도 60분 값의 근거가 기록되지 않음
- **상세**: `install_token` 의 TTL 24h 는 `spec/2-navigation/4-integration.md` Rationale "install_token TTL 24h" 절에 선택 근거가 상세히 기술되어 있다. `_retryState` 의 TTL 60분은 plan 에서 "기본 60분" 으로만 언급되고, 그 값을 선택한 근거(예: provider rate limit 회복 통상 시간, UX 관점 상한 등)가 Rationale 에 없다. 기각된 대안(예: 30분, 24h)과의 비교도 없다.
- **제안**: plan §C Rationale 또는 "R1 채택 사유" 하위에 TTL 60분 선택 근거 한 문장 추가 ("provider rate limit 회복 상한 (통상 수 분~수십 분) 을 커버하되 stale state 누적 방지 균형") 및 기각된 대안 한 줄 기재.

---

### [INFO] `OQ2` retry 횟수 한도 미결 — `_retryState.expiresAt` 를 사실상의 한도로 간주하는 근거 명시 권장

- **target 위치**: plan §C "OQ2 (retry 회수 한도)" — "명시적 한도 없음 — provider 가 자체적으로 429 를 다시 던지면 그게 한도. `_retryState.expiresAt` (TTL 60분) 이 사실상 상한 역할"
- **과거 결정 출처**: 관련 선례 없음 (신규 결정)
- **상세**: TTL 이 사실상 한도 역할을 한다는 추론은 합리적이지만, TTL 이 만료되지 않은 상황에서 사용자가 retry 를 연속적으로 클릭해 LLM provider 에 단시간에 다수 요청을 보내는 케이스는 TTL 로 제한되지 않는다. plan 은 이를 "provider 가 다시 429 를 던지면 그게 한도" 로 처리한다고 기술하나, provider 가 429 를 주지 않는 5xx / network timeout 케이스에서는 사실상 무제한 retry 가 된다는 점이 Rationale 에서 의식적으로 수용했다는 기록이 없다.
- **제안**: plan §C OQ2 항 또는 Rationale 에 "5xx / timeout 케이스에서 무제한 retry 가능하나 `_retryState.expiresAt` TTL 안에서만 허용하며, 남용 방지가 필요하면 별 PR 에서 per-execution retry count 캡을 도입" 한 문장 추가.

---

### [INFO] `INVALID_RESUME_TOKEN` 에러 코드명 — 폐기된 `resumeToken` 필드 어휘 잔류

- **target 위치**: plan §C "에러 코드 3종 — `INVALID_RESUME_TOKEN`"
- **과거 결정 출처**: 동일 plan §C R1 결정 — "`resumeToken` 필드는 plan 초안에서 제거. WS payload 가 `nodeExecutionId` 만으로 충분히 식별 가능"
- **상세**: plan 자체에서 "R1 결정으로 token 필드 자체가 사라졌으나 에러 코드 이름은 `INVALID_RETRY_STATE` 보다 일반적 의미를 표현해 유지" 라고 명시적 Rationale 을 제공하고 있다. 이는 규칙 위반이 아니라 의식적 결정이다. 다만 이 사유를 plan 본문에만 두지 말고 영향 spec 표에 기재된 대로 `spec/5-system/6-websocket-protocol.md §4.2` 본문의 에러 코드 정의 옆에 함께 기재해야 spec 독자가 코드명의 이질감을 이해할 수 있다. plan 은 이미 "본 의미를 §4.2 에 명시" 라고 기술하므로 영향 spec 표에 반영 예정임이 확인된다.
- **제안**: 추가 조치 불필요 (plan 이 §4.2 명시를 이미 계획). 구현 시 누락 주의.

---

## 요약

target 문서(`multiturn-error-preserve.md`)는 기존 spec 의 Rationale 에서 명시적으로 기각된 대안을 재도입하는 CRITICAL 수준의 위반은 없다. R2(`status: 'waiting_for_retry'` 신설) 기각 결정은 plan 내 Rationale 에서 명확히 기술되었으며, 실행 엔진 §1.3 의 블로킹/재개 컨트랙트 및 Principle 5 port 활성화 모델과의 정합도 고려하고 있다. `system` source 재사용 기각 이유도 기존 `spec/conventions/conversation-thread.md §1.1` 의 "예약" 취지와 방향이 일치한다. 주요 WARNING 은 두 가지다: (1) `NodeHandlerOutput` Principle 0 의 5필드 예외 등록 — `_retryState` 를 top-level internal 필드로 추가하면서 §7 서두의 예외 목록에 `_retryState` 를 명시 등재하는 갱신이 영향 spec 표에 충분히 반영되지 않았다; (2) `retry_last_turn.ack` 에서 기존 명령들이 유지하던 `nodeId` 를 생략한 근거가 Rationale 에 기록되지 않았다. 두 WARNING 모두 spec 작성 단계에서 해소 가능한 수준이며, 구현 착수 전 영향 spec 갱신 시 함께 반영하면 된다.

---

## 위험도

MEDIUM
