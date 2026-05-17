# 신규 식별자 충돌 검토 — spec/4-nodes/3-ai/

> 검토 모드: --impl-prep (구현 착수 전)
> 검토 대상: `spec/4-nodes/3-ai/` (0-common.md, 1-ai-agent.md, 2-text-classifier.md, 3-information-extractor.md)

---

## 발견사항

### 1. 충돌 없음 — 기존 `completed` 포트 예약어

- **[WARNING]** `info_extractor` multi-turn 종결 포트 `completed` 가 AI Agent 포트 예약어 목록과 비대칭
  - target 신규 식별자: `info_extractor` §3.2 multi-turn 출력 포트 `completed`
  - 기존 사용처: `spec/4-nodes/3-ai/2-text-classifier.md` §3.2 포트 예약어 목록에는 `completed` 가 포함되어 있으나 (`out`, `error`, `default`, `done`, `user_ended`, `max_turns`, `completed`, `fallback`, `continue`, `__none__`), `spec/4-nodes/3-ai/1-ai-agent.md` §5 유효성 검증에 열거된 예약 포트 목록은 `out`, `in`, `error`, `user_ended`, `max_turns` 로만 구성되어 있어 `completed` 가 누락
  - 상세: `text_classifier` 스펙은 카테고리 id 가 `completed` 와 같은 이름을 갖지 못하도록 schema 가 거부한다고 명시한다. `ai_agent` 스펙은 `conditions[i].id` 가 예약 포트 (`out`/`in`/`error`/`user_ended`/`max_turns`) 와 충돌 불가라고만 명시하고 `completed` 는 열거하지 않는다. 실제로 `completed` 는 `information_extractor` 의 multi-turn 종결 포트이므로, 향후 ai_agent condition ID 에 `completed` 를 입력했을 때 충돌 여부가 규칙상 불명확해진다. 두 문서 간 예약어 목록 불일치.
  - 제안: `spec/4-nodes/3-ai/1-ai-agent.md` §5 유효성 검증 규칙의 예약 포트 목록에 `completed` 를 추가해 `information_extractor` 포트와 충돌 방지 원칙을 통일한다. (단, `ai_agent` 의 condition id 는 실행 중 동일 노드 내에서만 scope 가 적용되므로 다른 노드의 포트와 실제 충돌은 발생하지 않음 — naming 정책 불일치 수준.)

---

### 2. 충돌 없음 — `contextScope` / `contextScopeN` / `contextInjectionMode` 신규 도입

- **[INFO]** `contextScope`, `contextScopeN`, `contextInjectionMode` 필드가 세 AI 노드 공통 config 에 신규 추가
  - target 신규 식별자: `contextScope`, `contextScopeN`, `contextInjectionMode`, `includeToolTurns`, `excludeFromConversationThread` (spec/4-nodes/3-ai/0-common.md §10, 1-ai-agent.md §1)
  - 기존 사용처: 코퍼스 전체에 걸쳐 이 필드명이 다른 맥락에서 사용된 사례 없음. `spec/conventions/conversation-thread.md` 에서 단일 진실 공급원으로 명시되어 있으며 본 파일에서 forward-reference 가 일관.
  - 상세: 식별자 자체는 신규이고 기존 사용처가 없어 충돌하지 않는다. 다만 `contextScope: 'none' | 'thread' | 'lastN'` 이라는 타입 이름이 코퍼스에서 다른 의미로 사용된 사례는 없다.
  - 제안: 이슈 없음. 관련 spec `spec/conventions/conversation-thread.md` 가 단일 진실로 명시되어 있어 문서 구조도 적합하다.

---

### 3. 충돌 없음 — `_resumeState` 최상위 필드

- **[INFO]** `_resumeState` 가 multi-turn 출력 최상위 필드로 도입
  - target 신규 식별자: `_resumeState` (ai-agent §7.4, information-extractor §5.4 이하)
  - 기존 사용처: `spec/1-data-model.md` 의 `NodeExecution.output_data JSONB?` 필드 정의에는 `_resumeState` 에 대한 별도 명시 없음. `spec/conventions/node-output.md` Principle 4.2 에서 expression resolver 비노출 내부 필드로 약정되어 있다 (코퍼스 제공 범위 내 확인).
  - 상세: `_resumeState` 는 Node Output CONVENTIONS Principle 4.2 에 의해 expression autocomplete 에서 비노출로 처리되고, `adaptHandlerReturn` boundary 에서 DB 저장 시 strip 된다고 명시되어 있다. 타 영역에서 동일 키를 다른 의미로 사용하는 사례가 코퍼스 내에 없다.
  - 제안: 이슈 없음. DB strip 동작과 Principle 4.2 의 expression 비노출 계약이 명확히 기술되어 있다.

---

### 4. 충돌 없음 — `MAX_RESUME_RAG_SOURCES`, `MAX_TURN_DEBUG_HISTORY` 상수명

- **[INFO]** 구현 참조 상수 `MAX_RESUME_RAG_SOURCES = 200`, `MAX_TURN_DEBUG_HISTORY = 50` 이 spec 본문에 직접 노출
  - target 신규 식별자: `MAX_RESUME_RAG_SOURCES`, `MAX_TURN_DEBUG_HISTORY` (ai-agent.md §7.4)
  - 기존 사용처: 코퍼스에 동일 상수명 사용 사례 없음.
  - 상세: 구현 상수가 spec 본문에 박혀 있어 코드와 spec 간 값 불일치 위험은 있지만, 식별자 충돌 관점에서는 타 spec/plan 에서 같은 이름을 다른 의미로 정의한 사례가 없다.
  - 제안: 구현 상수를 spec 에 박는 패턴은 관리 부담이 생기지만 이는 일관성 문제이지 충돌 문제가 아님. 이슈 없음.

---

### 5. 충돌 없음 — `finalize_extraction` 도구 이름

- **[INFO]** `finalize_extraction` 이 information_extractor multi-turn 에서 LLM 노출 도구로 신규 정의
  - target 신규 식별자: `finalize_extraction` (information-extractor.md §4.2)
  - 기존 사용처: 코퍼스 내 `finalize_extraction` 이라는 이름을 다른 맥락에서 사용하는 사례 없음. `spec/5-system/11-mcp-client.md` 의 도구 이름 규칙(`mcp_<sid>__<toolName>`) 이나 `spec/4-nodes/3-ai/1-ai-agent.md` 의 `cond_*` / `kb_*` / `mcp_*` prefix 체계와 명확히 분리되어 있어 prefix 충돌 없음.
  - 상세: MCP 도구 이름(`mcp_<sid>__...`), KB 도구 이름(`kb_*`), 조건 도구(`cond_*`) 와 네이밍 스키마가 겹치지 않는다. `finalize_extraction` 은 내부 JSON Schema tool 이므로 외부 MCP 서버와도 격리된다.
  - 제안: 이슈 없음.

---

### 6. 충돌 없음 — `MAX_COLLECTION_RETRIES_EXCEEDED` 에러 코드

- **[INFO]** `MAX_COLLECTION_RETRIES_EXCEEDED` 신규 에러 코드 도입 (information-extractor 전용)
  - target 신규 식별자: `MAX_COLLECTION_RETRIES_EXCEEDED` (information-extractor.md §4.2, §5.6)
  - 기존 사용처: `spec/4-nodes/3-ai/1-ai-agent.md` §10 에러 코드 표에 열거된 코드 (`LLM_CALL_FAILED`, `LLM_RATE_LIMITED`, `LLM_RESPONSE_INVALID`, `TOOL_EXECUTION_FAILED`, `MAX_TOOL_CALLS_EXCEEDED`) 와 중복 없음. `text-classifier.md` §6 에러 코드 표와도 중복 없음.
  - 상세: 각 노드별 에러 코드가 고유하게 관리되고 있으며, 이 코드는 information_extractor 의 multi-turn max-retries 종결 경로에만 발화한다.
  - 제안: 이슈 없음.

---

### 7. 주의 — `max_retries` endReason 값이 포트 이름과 혼용

- **[WARNING]** information_extractor §5 케이스 색인에서 `max_retries` 가 종결 사유 label 로 사용되나 포트 이름은 `error`
  - target 신규 식별자: `endReason: 'max_retries'` (information-extractor.md §5.6), `output.error.code: 'MAX_COLLECTION_RETRIES_EXCEEDED'`
  - 기존 사용처: `spec/4-nodes/3-ai/0-common.md` §9 색인 표의 `info_extractor (multi)` 행에서 종결 종류 중 하나로 `max_retries` 가 나열됨. 동시에 `spec/4-nodes/3-ai/3-information-extractor.md` §3.2 포트 표에는 `max_retries` 포트 없이 `error` 포트만 정의되어 있고, `error` 포트 설명에 `MAX_COLLECTION_RETRIES_EXCEEDED` 를 포함한다고 명시.
  - 상세: 0-common.md §9 색인 표의 `info_extractor (multi)` "종결 (ended)" 열에 `§5.6 (completed / user_ended / max_turns / max_retries)` 로 표기되어 있어, `max_retries` 가 포트 이름처럼 보일 수 있다. 그러나 실제 포트는 `error` 이고 `endReason` / 에러 코드가 구분 방법이다. 색인 표의 표기가 포트 이름과 종결 사유를 동일 칸에 혼재해 구현자 오독 가능성이 있다.
  - 제안: `spec/4-nodes/3-ai/0-common.md` §9 색인 표의 `info_extractor (multi)` 행 종결 열 표기를 `§5.6 (completed / user_ended / max_turns) · §5.6 max_retries → error 포트` 형태로 보완하거나, `max_retries` 가 포트가 아닌 `endReason`/에러코드 구분자임을 명시하면 혼동 방지 가능.

---

### 8. 충돌 없음 — `buildMultiTurnSystemPrompt`, `buildFinalizationTool` 구현 내부 식별자

- **[INFO]** spec 본문에 구현 함수명 `buildMultiTurnSystemPrompt`, `buildFinalizationTool` 직접 노출
  - target 신규 식별자: 위 두 함수명 (information-extractor.md §4.2)
  - 기존 사용처: 코퍼스의 다른 spec 문서에 해당 함수명이 다른 의미로 사용된 사례 없음.
  - 상세: 식별자 충돌 관점에서는 문제 없음. 구현 함수명을 spec 에 박으면 리팩토링 시 spec 동기화 부담이 생기지만 이는 관리 문제이지 충돌 문제가 아니다.
  - 제안: 이슈 없음.

---

### 9. 충돌 없음 — `contextInjection` meta 필드

- **[INFO]** `meta.contextInjection` 신규 필드 (ai-agent §7.1)
  - target 신규 식별자: `meta.contextInjection` (ai-agent.md §7.1 필드 표)
  - 기존 사용처: 코퍼스에 `contextInjection` 을 `meta` 하위 필드로 정의한 다른 사례 없음.
  - 상세: `spec/1-data-model.md` `NodeExecution.output_data JSONB?` 의 자유형 컨테이너 안에 들어가는 필드이므로 DB 스키마 충돌 없음. `spec/conventions/conversation-thread.md §5.3` 에서 단일 진실 공급원으로 명시.
  - 제안: 이슈 없음.

---

## 요약

`spec/4-nodes/3-ai/` 가 이번 구현 착수 전 검토에서 도입하는 신규 식별자들(`contextScope*`, `_resumeState`, `finalize_extraction`, `MAX_COLLECTION_RETRIES_EXCEEDED`, `meta.contextInjection` 등)은 코퍼스 전체에서 동일 이름을 다른 의미로 사용하는 사례가 없어 실질적 충돌이 없다. 단, 두 가지 품질 개선 권고 사항이 있다. 첫째, `ai_agent` §5 예약 포트 목록에 `completed` 가 누락되어 `information_extractor` 의 동명 종결 포트와 명명 정책이 불일치한다(WARNING). 둘째, `0-common.md` §9 색인 표에서 `max_retries` 가 포트 이름처럼 오독될 수 있는 표기 모호성이 있다(WARNING). 두 항목 모두 런타임 동작에 영향을 주는 실제 충돌이 아니라 문서 명확성 수준의 사안이므로, 구현 착수를 차단하지 않는다.

## 위험도

LOW
