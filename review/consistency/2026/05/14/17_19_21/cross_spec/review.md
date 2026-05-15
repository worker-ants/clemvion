## 발견사항

---

### [WARNING] `meta.contextInjection` 가 `node-output.md` Principle 2에 미등록

- **target 위치:** `conversation-thread.md §5.3` — `meta.contextInjection: { appliedScope, appliedMode, injectedTurns, droppedTurns, totalInjectedChars }`
- **충돌 대상:** `node-output.md Principle 2` — LLM 계열 `meta` 필드 목록 (`meta.model`, `inputTokens`, `outputTokens`, `totalTokens`, `thinkingTokens?`, `toolCalls?`)
- **상세:** `conversation-thread.md §5.3`은 "`meta.contextInjection`은 Principle 2 (meta = 런타임 측정값) 정합"이라 명시하지만, 실제 `node-output.md` Principle 2의 LLM 계열 행에는 이 필드가 없음. 두 문서가 정합한다는 주장이 문서 레벨에서는 성립하지 않는 상태.
- **제안:** `node-output.md` Principle 2의 LLM 계열 행에 `meta.contextInjection?` 항목 추가

---

### [WARNING] `text_classifier` / `information_extractor` turn push 시 `text` 필드 변환 규칙 미정의

- **target 위치:** `conversation-thread.md §2.3` (v1 push 범위 = "모든 AI 노드") + `§1.4` (text 변환 규칙)
- **충돌 대상:** `node-output.md Principle 8.2` — LLM 계열 노드별 output 경로 정의
- **상세:** §1.4의 `ai_assistant final` text 규칙은 "`output.result.response` 그대로 (Principle 8.2 LLM 응답 텍스트 경로)"로 정의. 그러나 `text_classifier`의 최종 결과는 `output.result.category` / `output.result.categories`이고, `information_extractor`의 최종 결과는 `output.result.extracted`임(Principle 8.2). 이들 노드가 `ai_assistant` source로 turn을 push할 때 `text` 필드에 무엇이 들어가야 하는지 규칙이 없어, 구현 시 해석이 갈릴 수 있음.
- **제안:** §1.4 표에 `ai_assistant final (text_classifier)` → `category 또는 categories 직렬화` / `ai_assistant final (information_extractor)` → `중간 assistant 응답 본문` 행 추가

---

### [WARNING] `messages` 모드에서 `system` source → `role: 'system'` Anthropic API 비호환 정책 미결

- **target 위치:** `conversation-thread.md §5.1` messages 모드 매핑 표
- **충돌 대상:** LLM Client spec (`spec/5-system/7-llm-client.md`) — Anthropic API 메시지 구조
- **상세:** §5.1은 `system` source를 `role: 'system'`으로 매핑하나, 바로 아래 주석에서 "Anthropic API는 messages 배열 내 `role: 'system'` 미지원"을 인정. "v1 자동 push 없으므로 현재 실질 문제 없음"이라 하지만, 수동 push 경로(§1.1 `system` source 예약)나 v2 시 구현 갭이 발생. provider별 처리 정책(drop / system prompt append / system_text 폴백)이 spec 레벨에서 미결.
- **제안:** §5.1 주석에 Anthropic provider에서의 `system` turn 처리 정책 명시 — 예: "Anthropic 호환 provider는 `system` turn을 `system_text` 렌더 결과에 append하고 messages 배열에서 제외"

---

### [INFO] `excludeFromConversationThread` 가 `node-output.md` Principle 7 echo 목록에 미등재

- **target 위치:** `conversation-thread.md §2.4` — "각 노드에 공통 boolean config: `excludeFromConversationThread`"
- **충돌 대상:** `node-output.md Principle 7` — always echo 목록
- **상세:** Principle 7은 사용자가 UI에서 설정한 비민감 값을 `NodeHandlerOutput.config`에 echo하도록 정의하며 `maxTurns`, `maxCollectionRetries` 등을 예시로 나열. `excludeFromConversationThread`도 동일한 성격이나 목록에 없음.
- **제안:** Principle 7 always echo 예시 목록에 `excludeFromConversationThread` 추가

---

### [INFO] `$thread.text` 표현식이 `contextInjectionMode` 설정과 독립임을 expression-language spec에서 명시 필요

- **target 위치:** `conversation-thread.md §6` — `$thread.text` 반환값 = "system_text 렌더 결과"
- **충돌 대상:** `spec/5-system/5-expression-language.md §4.4`
- **상세:** `$thread.text`는 항상 system_text 렌더러를 사용하지만, 이 렌더러는 AI Agent 노드의 `contextInjectionMode` 설정과 무관하게 표현식 엔진이 독립 실행. 표현식을 평가하는 맥락(transform 노드 등)에서 이 사실이 불명확하면 혼란 가능.
- **제안:** expression-language spec §4.4에 "`$thread.text`는 AI Agent의 `contextInjectionMode` 설정과 무관하게 thread-renderer(§5.2 규칙)를 항상 사용한다" 한 줄 추가

---

### [INFO] presentation 노드 spec 에 `excludeFromConversationThread` 필드 반영 여부 확인 필요

- **target 위치:** `conversation-thread.md §2.4` — "각 노드에 공통 boolean config"
- **충돌 대상:** `spec/4-nodes/5-presentation/` 하위 각 노드 spec (form, carousel, table, chart, template)
- **상세:** convention은 모든 노드(presentation 포함)에 이 필드가 있어야 한다고 정의하나, presentation 노드 spec 문서들에 반영 여부를 현재 제공된 정보로 확인 불가. 구현 착수 전 누락 시 노드별 config 스키마와 UI 패널 정의가 어긋남.
- **제안:** 구현 착수 전 각 presentation 노드 spec의 config 필드 목록에 `excludeFromConversationThread: Boolean (default false)` 추가 확인

---

## 요약

`spec/conventions/conversation-thread.md` 는 전체적으로 기존 node-output.md, 데이터 모델, 실행 엔진 spec과 설계 방향이 일치하며 순환 참조나 도메인 모순은 없다. 단, **Principle 2에 `meta.contextInjection` 미등록**(W1), **`text_classifier` / `information_extractor` push text 변환 규칙 공백**(W2), **Anthropic API `system` turn 처리 정책 미결**(W3)의 세 가지 WARNING이 구현 시 해석 갈림 또는 provider별 버그로 이어질 수 있어 착수 전 해소가 권장된다.

## 위험도

**MEDIUM** — Critical 위배는 없으나, WARNING 3건이 모두 구현 착수 후 발견되면 핸들러 및 LLM Client 레이어에 역행 수정이 필요하다.