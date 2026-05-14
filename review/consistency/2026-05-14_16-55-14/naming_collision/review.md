신규 식별자 전체를 기존 코퍼스와 대조합니다.

---

## 발견사항

### [INFO] `system` — ConversationTurnSource 값 vs AssistantMessage.role 값 중복

- **target 신규 식별자**: `ConversationTurnSource` enum 값 `'system'`
- **기존 사용처**: `spec/1-data-model.md §2.21 AssistantMessage.role` Enum — `user / assistant / tool / system`
- **상세**: 두 곳 모두 "시스템이 직접 주입하는 메시지"를 `'system'`으로 표현. TypeScript 타입 네임스페이스는 달라 런타임 충돌 없음. 그러나 문서·코드 리뷰 시 "turn.source = 'system'" vs "message.role = 'system'"의 의미 차이를 설명 없이 읽으면 혼동 가능.
- **제안**: v1 에서는 `source='system'` 이 자동 누적 경로 없이 "예약" 상태이므로 실질 노출 빈도가 낮음. 현행 명칭 유지하되 Conversation Thread spec §1.1 의 `system` row에 한 줄 주석 추가 권장 — "AssistantMessage.role='system'과 무관, 워크플로우 레벨 수동 push 전용."

---

### [INFO] `id: "default"` 문자열 상수 — port 예약어 `"default"`와 동일 값

- **target 신규 식별자**: `ConversationThread.id = "default"` (v1 고정값)
- **기존 사용처**: `spec/conventions/node-output.md Principle 6` — 시스템 포트 예약어 목록에 `"default"` 포함
- **상세**: 포트 ID 네임스페이스와 thread ID 네임스페이스는 완전히 분리되어 있어 런타임 충돌 없음. 다만 `$thread.id === 'default'` 를 expression 에서 다룰 때 "왜 default인가?"라는 질문이 반복될 수 있음.
- **제안**: spec §1.3 (ConversationThread 표)의 `id` 설명 셀에 "(v1 고정값 — port 예약어 'default'와 무관)" 1문구 보강. 코드 레벨에서는 `DEFAULT_THREAD_ID = 'default'` 상수로 추출하면 오독 방지.

---

### [INFO] `§11` 번호 — `spec/4-nodes/3-ai/0-common.md` 기존 §10 CHANGELOG 밀기

- **target 변경**: 기존 §10(CHANGELOG)을 §11로 밀고 새 §11(Conversation Context) 신설
- **상세**: 현행 spec의 §10 번호가 다른 spec 문서에 외부 링크(`0-common.md#10-changelog`)로 걸려 있다면 링크 깨짐 발생 가능. 본 코퍼스 내에서는 `0-common.md`의 CHANGELOG 섹션으로의 앵커 링크가 확인되지 않으므로 즉각 충돌 없음.
- **제안**: spec 반영 전 `grep -r "0-common.md#10" spec/` 로 한 번 점검 권장. 발견 시 앵커 갱신.

---

## 요약

신규 도입 식별자(`contextScope`, `contextScopeN`, `contextInjectionMode`, `includeToolTurns`, `excludeFromConversationThread`, `ConversationTurnSource`, `ConversationThread`, `ConversationTurn`, `$thread`, `conversationThread`, `MAX_INJECTED_TURNS`, `MAX_TURN_TEXT_CHARS`, `MAX_INJECTED_CHARS`, `ConversationThreadService`, `thread-renderer`, `meta.contextInjection`) 전체를 기존 코퍼스와 대조한 결과, CRITICAL/WARNING 수준 충돌은 없음. 식별된 세 건 모두 INFO — 타입 네임스페이스 분리로 런타임 안전하며, 소규모 문서 보강으로 오독 방지 가능한 수준.

## 위험도

**LOW**