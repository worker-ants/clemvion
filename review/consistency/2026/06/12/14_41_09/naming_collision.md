# 신규 식별자 충돌 검토 결과

대상: `spec/conventions/chat-channel-adapter.md`

---

## 발견사항

### 1. [WARNING] `EiaAiMessageEvent` 크로스-문서 명칭 불일치

- **target 신규 식별자**: `EiaEvent` (§1.2 inline union 타입)
- **기존 사용처**: `spec/5-system/15-chat-channel.md` line 654 (R-CC-16 §2 본문) — "Convention §1.2 `EiaAiMessageEvent` 의 `presentations?: PresentationPayload[]` 필드"
- **상세**: target 의 §1.2 는 EIA outbound 5종을 `type EiaEvent = ...` 의 inline union 으로 정의하며 `EiaAiMessageEvent` 라는 이름을 사용하지 않는다. 그러나 `15-chat-channel.md` R-CC-16 이 동 §1.2 를 참조하면서 "Convention §1.2 `EiaAiMessageEvent`" 로 호명한다. 코드베이스(`codebase/backend/src/modules/chat-channel/types.ts` line 316)에는 `EiaAiMessageEvent` 가 named interface 로 존재하여 실제로 충돌이 일어나지는 않지만, spec 독자 입장에서 §1.2 에 `EiaAiMessageEvent` 라는 이름이 없으므로 참조가 끊겨 혼동을 유발한다.
- **제안**: `15-chat-channel.md` R-CC-16 line 654 를 "Convention §1.2 `EiaEvent` (ai_message variant) 의 `presentations?: PresentationPayload[]` 필드" 로 수정하거나, target 의 §1.2 에 `type EiaAiMessageEvent` 를 별칭으로 명시해 cross-link 를 성립시킨다.

---

## 충돌 없음 확인 항목

1. **요구사항 ID 충돌**: target 이 새로 도입하는 Rationale ID `R-CCA-5`~`R-CCA-8` 은 `spec/5-system/15-chat-channel.md` 의 `R-CC-*` 패턴과 prefix 가 달라 충돌 없음. 기존 `R1`~`R4` 는 하위 호환 보존 상태이며 타 spec 에서 해당 파일의 `#r1`~`#r4` 앵커를 참조하는 외부 링크 없음.

2. **엔티티/타입명 충돌**: `ChatChannelAdapter`, `ChannelUpdate`, `ChannelMessage`, `ChannelButton`, `KeyboardHint`, `ChatChannelConfig`, `SetupResult`, `SendResult`, `ChannelAdapterRegistry`, `EiaEvent`, `ChatChannelInternalEvent`, `ExecutionFailureClass`, `classifyExecutionFailure`, `OpenFormModalParams`, `OpenFormModalResult`, `FormSubmissionResult` — 모두 `spec/conventions/chat-channel-adapter.md` 및 `codebase/backend/src/modules/chat-channel/` 스코프 안에서만 사용됨. 타 영역 spec 에서 동명 타입이 다른 의미로 사용되는 케이스 없음.

3. **API endpoint 충돌**: target 은 새 endpoint 를 정의하지 않음.

4. **이벤트/메시지명 충돌**: `execution.node.completed` 는 `ChatChannelInternalEvent` 로 별도 union 에 격리되어 EIA §6.1 외부 webhook 화이트리스트와 명확히 분리됨. 이벤트 타입 문자열 자체는 WS §4.4 기존 이벤트와 동일하나, 본 convention 이 해당 이벤트를 chat-channel-internal 전용 표면으로 별도 타입화하는 설계 근거(R-CCA-7)를 명시하고 있어 의미 충돌 없음.

5. **환경변수·설정키 충돌**: target 은 새 ENV var 또는 config key 를 도입하지 않음. `languageHints` 키 (`executionFailedThirdParty4xx` 등 6종) 는 `15-chat-channel.md §4.1.1` 표와 완전히 일치.

6. **에러 코드 참조**: §3.1 분류 표의 `CODE_MEMORY_LIMIT` 은 `spec/5-system/3-error-handling.md §1.4` (line 84) 가 동일 코드를 EIA-level Code 노드 에러로 명시하므로 충돌 없음.

7. **파일 경로 충돌**: `spec/conventions/chat-channel-adapter.md` 는 기존 파일을 갱신하는 것으로, frontmatter `id: chat-channel-adapter` 는 다른 convention 파일과 중복 없음.

---

## 요약

target `spec/conventions/chat-channel-adapter.md` 가 도입하는 식별자들은 타 spec 영역에서 다른 의미로 사용되는 동명 식별자와 충돌하지 않는다. 유일한 이슈는 `15-chat-channel.md` R-CC-16 이 target §1.2 의 union 타입명을 `EiaAiMessageEvent` 로 잘못 호명하는 크로스-문서 명칭 불일치로, spec 충돌은 아니나 독자 혼동 가능성이 있어 WARNING 으로 분류한다.

---

## 위험도

LOW
