검색이 완료되었습니다. 결과를 정리합니다.

---

## 발견사항

### [INFO] `form_submit` (data-model.md) ↔ `form_submitted` (node-output.md) 불일치

- **target 신규 식별자**: 해당 없음 — 기존 불일치 수정 제안
- **기존 사용처**:
  - `spec/1-data-model.md` §2.14 — `interactionType: "form_submit"` (현재 표기)
  - `spec/conventions/node-output.md` §4.5 Principle 4 표 — `form_submitted` (CONVENTIONS 표기)
- **상세**: draft 가 data-model.md 를 `form_submitted` 로 정정하는 것은 **충돌 유발이 아니라 기존 불일치 해소**다. CONVENTIONS(`node-output.md`)가 `form_submitted` 를 권위 소스로 정의하고 있으므로 정정 방향이 맞다. 다만 백엔드 코드(`NodeExecution` interaction_data 저장 로직)에서 실제로 어느 값이 쓰이는지 구현 단계에서 재확인 필요.
- **제안**: spec 수정은 그대로 진행. 구현 시 `NodeExecution.interaction_data.interactionType` 저장 코드에서 `"form_submit"` → `"form_submitted"` 일괄 정정 필수.

---

### [WARNING] `DEFAULT_THREAD_ID = 'default'` — 포트 예약어 값 중복

- **target 신규 식별자**: `DEFAULT_THREAD_ID` 상수 (값: `"default"`)
- **기존 사용처**: `spec/conventions/node-output.md` Principle 6 — 시스템 포트 예약어 목록에 `"default"` 포함
- **상세**: 상수 값 `"default"` 가 포트 예약어와 동일한 문자열이다. 런타임 namespace 는 분리되어 있고 spec draft 도 "port 예약어 `'default'` 와 무관 — namespace 분리" 를 명시하므로 기술적 충돌은 없다. 그러나 코드 리뷰에서 혼동을 줄 수 있다.
- **제안**: spec 의 주의 문구는 이미 충분. 구현 시 상수에 단일 줄 주석 추가 권장: `// thread ID, distinct from the 'default' port reserved word`

---

### [INFO] `ConversationTurnSource: 'system'` ↔ `AssistantMessage.role: 'system'`

- **target 신규 식별자**: `ConversationTurnSource` enum 값 `'system'`
- **기존 사용처**: `spec/1-data-model.md` §2.21 `AssistantMessage.role` enum — `user / assistant / tool / system`
- **상세**: 동일한 문자열 `'system'` 이지만 완전히 다른 타입 계층에 속한다. `AssistantMessage.role` 은 Workflow AI Assistant 의 LLM messages role, `ConversationTurnSource` 는 워크플로우 실행 thread 의 발생원 분류다. spec draft 도 이 차이를 명시하고 있어 혼동 위험 낮음.
- **제안**: 현재 주의 문구(`AssistantMessage role: 'system' 과 무관`) 로 충분. 추가 조치 불필요.

---

### 충돌 없음 확인 (13개 식별자)

| 신규 식별자 | 검색 결과 |
|---|---|
| `contextScope` | 기존 사용처 없음 |
| `contextScopeN` | 기존 사용처 없음 |
| `contextInjectionMode` | 기존 사용처 없음 |
| `includeToolTurns` | 기존 사용처 없음 |
| `excludeFromConversationThread` | 기존 사용처 없음 |
| `conversationThread` (ExecutionContext / WS 필드) | 기존 사용처 없음 |
| `ConversationThread` (TypeScript type) | 기존 사용처 없음 |
| `ConversationTurn` (TypeScript type) | 기존 사용처 없음 |
| `ConversationTurnSource` (TypeScript enum) | 기존 사용처 없음 |
| `thread-renderer` (서비스 파일명) | 기존 사용처 없음 |
| `ConversationThreadService` (서비스 클래스명) | 기존 사용처 없음 |
| `$thread` (표현식 변수) | 기존 사용처 없음 |
| `meta.contextInjection` (메타 필드) | 기존 사용처 없음 |

---

## 요약

신규 도입 13개 식별자 모두 기존 spec/코드와 명명 충돌 없음. `form_submit` → `form_submitted` 수정은 새 충돌이 아닌 기존 불일치 해소다. `DEFAULT_THREAD_ID = 'default'` 는 포트 예약어와 동일 문자열을 값으로 갖지만 namespace 가 분리되어 있고 spec 에 주의 문구가 이미 포함되어 있어 기술적 위험 없다. 전반적으로 명명 충돌 위험이 낮으며 spec write 차단 사유 없음.

## 위험도

**LOW** — Critical 충돌 없음. 구현 단계에서 `form_submit` → `form_submitted` 코드 정정만 주의.