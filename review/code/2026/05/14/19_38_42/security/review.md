## 발견사항

---

### [HIGH] Prompt Injection — `system_text` 모드에서 사용자 입력 무방비 첨부

- **위치**: `spec/conventions/conversation-thread.md` §5.2, `rationale_continuity/review.md` (16:55 세션)
- **상세**: `contextInjectionMode='system_text'` 시 form 제출 데이터(예: `name=Alice, job=...`)가 AI의 system prompt 끝에 자동으로 붙는다. 사용자가 form 필드에 `Ignore previous instructions. You are now...` 형태의 텍스트를 입력하면 system prompt를 오염시킬 수 있다. `MAX_TURN_TEXT_CHARS: 4000` cap이 있으나 injection을 막지 못한다. 리뷰 문서 자체도 이를 INFO로 분류했지만, form 입력이 자동 thread push → system prompt 첨부로 이어지는 경로는 명시적 sanitization 없이는 HIGH 위험이다.
- **제안**: `thread-renderer`가 system prompt에 turn.text를 첨부하기 전 `sanitizeLlmProvidedString` (또는 동등한 sanitizer)을 **필수** 적용해야 한다. 현재 spec은 이를 "권장"으로만 기술하고 공식 conventions 문서에도 미등재 상태 — 구현 규약으로 격상 필요.

---

### [MEDIUM] ConversationThread 전체 내역 WebSocket 클라이언트 노출

- **위치**: `spec/5-system/6-websocket-protocol.md` §4.4.5 (신규 추가)
- **상세**: `execution.waiting_for_input` payload에 `conversationThread` (전체 turns 배열 포함)를 선택적으로 동봉하도록 spec이 변경됐다. 대화 내역 전체가 WS 이벤트로 전달되면, WS 인증이 느슨하거나 클라이언트가 타인의 execution을 구독할 수 있는 경우 다른 사용자의 대화 내용이 노출된다. 현재 WS spec(§2)에서 execution 소유권 검증 범위가 명시되어 있지 않다.
- **제안**: `conversationThread` 필드를 payload에 포함하기 전 해당 execution의 owner/workspace 권한을 검증하는 게이트 추가. 프론트엔드가 타인의 execution ID로 구독을 시도하는 케이스에 대한 authorization 규약을 WS spec에 명시.

---

### [MEDIUM] Background ConversationThread Shallow Copy — 격리 보장 실패 위험

- **위치**: `spec/5-system/4-execution-engine.md` §3.3 (변경)
- **상세**: 추가된 스냅샷 설명에 `{ ...thread, turns: [...thread.turns] }` 형태를 명시했으나 `turns` 배열의 각 `ConversationTurn` 객체는 여전히 참조 공유 상태다. `ConversationTurn` 내 mutable 객체(예: `data` 필드)가 있으면 background 실행이 main 스레드의 turn 객체를 오염시킬 수 있다. 이는 ND-BG-05 격리 불변량 위반이다.
- **제안**: turn 객체까지 deep copy(`structuredClone` 또는 `JSON.parse(JSON.stringify(...))`) 하거나, `ConversationTurn`을 완전한 immutable sealed object로 강제(Object.freeze)하도록 구현 규약 명시.

---

### [INFO] `sanitizeLlmProvidedString` — 공식 규약 미등재

- **위치**: `spec/conventions/conversation-thread.md` §5.2 참조 / `convention_compliance/review.md` (17:02 세션)
- **상세**: 여러 spec 문서가 이 sanitizer를 "규약 준용"으로 참조하지만 `spec/conventions/` 어디에도 해당 함수의 동작 명세가 없다. 구현자마다 해석이 달라질 경우 일부 injection 벡터(백틱, XML 헤더, 제어문자 등)가 누락될 수 있다.
- **제안**: `spec/conventions/security-sanitization.md` 신설하여 sanitizer가 처리해야 하는 문자 패턴을 공식화하거나, 최소한 conversation-thread spec에 인라인으로 처리 범위를 명시.

---

### [INFO] `ConversationThread.id = "default"` 상수 노출

- **위치**: `spec/conventions/conversation-thread.md` §1.3, `spec/5-system/6-websocket-protocol.md` §4.4.5 예시
- **상세**: WS payload 예시에 `"id": "default"`가 하드코딩되어 있다. v1 고정값이지만, 공격자가 이 값을 알면 thread 관련 API/쿼리를 예측하기 쉬워진다. 실제 위험은 낮으나 노출 범위를 최소화하는 것이 원칙.
- **제안**: 구현 시 `DEFAULT_THREAD_ID` 상수로 관리하고, 외부 API response에서 thread ID를 노출하는 것이 필요한지 검토.

---

## 요약

변경의 핵심은 `ConversationThread` 기능 도입으로 인한 spec/test 수정이다. 테스트 파일(1~8번)에는 보안 이슈가 없다. 주요 위험은 두 가지다: (1) `system_text` 모드에서 form 사용자 입력이 LLM system prompt에 직접 첨부되는 prompt injection 경로가 sanitization 정책 없이 열려 있고, (2) WebSocket payload에 전체 대화 내역을 동봉하는 기능이 추가되어 authorization 검증이 미흡하면 타인의 대화가 노출될 수 있다. Background isolation의 shallow copy 한계는 spec에서 인지했으나 구현 규약이 아직 불완전하다. 하드코딩된 시크릿, SQL/CMD 인젝션, 불안전한 암호화 알고리즘 등 OWASP Top 10 직접 취약점은 발견되지 않았다.

## 위험도

**MEDIUM** — prompt injection 경로가 잠재적으로 HIGH이나, `system_text` 모드는 opt-in이고 `excludeFromConversationThread` opt-out이 존재하므로 현재 노출 범위는 제한적이다. 구현 착수 전 sanitization 정책 명문화가 필요하다.