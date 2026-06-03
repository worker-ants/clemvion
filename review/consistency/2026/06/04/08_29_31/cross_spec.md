# Cross-Spec 일관성 검토 결과

**검토 대상**: `spec/4-nodes/3-ai/` (0-common.md, 1-ai-agent.md)
**검토 모드**: 구현 완료 후 검토 (`--impl-done`, diff-base=origin/main)
**검토일**: 2026-06-04

---

## 발견사항

### [INFO] `0-common.md §10` 의 text_classifier / information_extractor inject 로드맵 표현 — conversation-thread 와 일치

- target 위치: `spec/4-nodes/3-ai/0-common.md §10` 첫 번째 단락
- 충돌 대상: `spec/conventions/conversation-thread.md §2.3`
- 상세: target 은 "자동 주입 (`contextScope` / `memoryStrategy` inject) 만 두 노드에 v2 예정" 이라 기술. `conversation-thread.md §2.3` 은 동일한 push vs inject 구분을 표로 정의하고 "자동 inject 확장은 분류·추출 노드에 아직 미적용 — 로드맵" 으로 기술. 두 문서가 동일한 사실을 서술하고 있으며 모순은 없다. 명칭·범위 기술이 정합한다.
- 제안: 상태 유지. INFO 수준으로 동기화 권장 사항 없음.

---

### [INFO] `0-common.md §11.4` 빌드 순서 — conversation-thread §5 주석 참조 정합

- target 위치: `spec/4-nodes/3-ai/0-common.md §11.4` 빌드 순서 블록
- 충돌 대상: `spec/conventions/conversation-thread.md §5`
- 상세: `0-common.md §11.4` 는 "본 ordering 의 단일 SoT 는 본 §11.4" 라고 선언하며 `conversation-thread.md §5` 는 thread injection 책임을 다루는 별도 영역이라 구분하고 있다. `conversation-thread.md §5.3` 의 cap 메커니즘은 `memoryStrategy: 'manual'` 한정이며, `0-common.md` 의 token-budget 압축 (§11.4 [5b]) 은 자동 전략 한정으로 상호 배타적으로 기술되어 있어 일관성이 확인된다.
- 제안: 상태 유지.

---

### [INFO] `1-ai-agent.md §1` 의 `contextInjectionMode` 설명 — `conversation-thread.md §5.1` 과 표현 차이

- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §1` `contextInjectionMode` 필드 설명
- 충돌 대상: `spec/conventions/conversation-thread.md §5.1`
- 상세: target 에서 `contextInjectionMode` 기본값이 `messages` 라고 기술 (`| contextInjectionMode | messages / system_text | | messages |`). `conversation-thread.md §5` 의 주입 모드 설명은 동일 필드를 설명하며 `messages` 가 기본임을 동일하게 기술한다. 모순 없음. 단, `messages` 모드의 `system_text` 안정 프리픽스 동작이 `1-ai-agent.md §6.1` 의 상세 설명과 `conversation-thread.md §5.1` 의 설명에서 단어 선택이 약간 다르다 — 의미 충돌은 없고 표현 차이만 존재한다.
- 제안: 동기화 권장하지 않음. 표현 차이는 각 SoT 문서의 관점 차이로 허용 범위.

---

### [INFO] `0-common.md §6` `meta.turnDebug` 구조 — `node-output.md Principle 2` 표에 미등재

- target 위치: `spec/4-nodes/3-ai/0-common.md §6` 토큰 회계 필드 표
- 충돌 대상: `spec/conventions/node-output.md Principle 2` (`meta` 는 "실행 메트릭"만 담는다 표)
- 상세: `node-output.md Principle 2` 의 LLM 계열 필수 필드 목록에는 `meta.model`, `meta.inputTokens`, `meta.outputTokens`, `meta.totalTokens`, `meta.thinkingTokens?`, `meta.toolCalls?`, `meta.contextInjection?` 가 열거된다. `0-common.md §6` 이 정의하는 `meta.turnDebug`, `meta.durationMs` 는 Principle 2 표에 없거나 다른 카테고리(공통)에 있다. `meta.durationMs` 는 Principle 2 "공통" 행에 있고, `meta.turnDebug` 는 Principle 2 표에 명시적 등재가 없다. 모순은 아니며 (Principle 2 표는 필수 필드 예시 수준), 각 노드의 추가 meta 필드를 금지하지 않는다. 하지만 Principle 2 표의 LLM 계열 행이 `meta.turnDebug` 를 명시하지 않아 drift 여지가 있다.
- 제안: `node-output.md Principle 2` 의 LLM 계열 meta 표에 `meta.turnDebug?` 항목을 추가하는 것을 권장 (INFO 수준, non-blocking).

---

### [INFO] `1-ai-agent.md §7` config echo 정책 — `node-output.md Principle 7` 선택적 echo 규약과 정합

- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §7` Config echo 정책 블록
- 충돌 대상: `spec/conventions/node-output.md Principle 7`
- 상세: target 은 `includeSystemContext` / `systemContextSections` 와 memory 5필드를 "default 값과 일치하면 echo 에서 생략" 이라고 기술. Principle 7 은 비민감 필드를 항상 echo 한다고 원칙화하며 `form.config.fields` 등을 예시로 드나, optional 필드를 조건부 생략하는 규약을 명시적으로 금지하지 않는다. `0-common.md §11.7` 이 동일 정책을 "Principle 7 의 optional 필드 echo 규약과 정합" 이라 단언한다. Principle 7 의 "항상 echo" 원칙과 optional 필드 생략의 정합성이 명시적으로 clarification 되어 있지 않아 잠재 모호성이 존재한다.
- 제안: `node-output.md Principle 7` 에 "optional 필드(기본값과 일치하는 경우 echo 생략 허용)에 대한 예외 주석"을 추가하면 drift 를 방지할 수 있다 (INFO 수준).

---

### [INFO] `1-ai-agent.md §4.1` `render_form` single-turn 에서 silent drop — `node-output.md §4.1` 상태 전이 다이어그램과 미언급

- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §6.1.d.ii`
- 충돌 대상: `spec/conventions/node-output.md Principle 4`
- 상세: target 은 single-turn 모드에서 `render_form` 호출 시 "schema 위반 처리" 와 동일하게 1회 재시도 후 silent drop 을 정의한다. `node-output.md Principle 4` 의 상태 전이 다이어그램은 `waiting_for_input` → `resumed` → `ended` 의 블로킹 흐름만 표시하며 이 특수 케이스를 언급하지 않는다. 직접 모순이 아닌 미기술 케이스다.
- 제안: 정보 충돌 없음. INFO 수준.

---

### [INFO] `1-ai-agent.md §7.9` `_retryState` 정의 — `node-output.md Principle 4.2.1` 과 정합 확인

- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §7.9`
- 충돌 대상: `spec/conventions/node-output.md Principle 4.2.1`
- 상세: target 의 `_retryState` 정의(shape / TTL / masking / lifecycle)가 `node-output.md §4.2.1` 의 `_retryState` 포함 필드 정의와 일치한다. `_resumeCheckpoint` 의 ai_agent 한정 적용도 양쪽에서 동일하게 기술된다. 모순 없음.
- 제안: 상태 유지.

---

### [INFO] `0-common.md §2` KB 연동 필드 `ragTopK` / `ragThreshold` — `17-agent-memory.md` 의 `memoryTopK` / `memoryThreshold` 와 독립성 명시

- target 위치: `spec/4-nodes/3-ai/0-common.md §2` KB 연동 표
- 충돌 대상: `spec/5-system/17-agent-memory.md §4`
- 상세: target 의 `ragTopK`/`ragThreshold` 는 KB 검색 파라미터이고, `1-ai-agent.md §1` 의 `memoryTopK`/`memoryThreshold` 는 persistent 메모리 회수 파라미터다. `17-agent-memory.md §4` 도 동일하게 "`memoryTopK`/`memoryThreshold` 는 persistent 메모리 회수 전용 — KB 검색용 `ragTopK`/`ragThreshold` 와 독립" 이라 명시한다. 일관성 있음.
- 제안: 상태 유지.

---

### [INFO] `1-ai-agent.md` `memoryStrategy` 필드 — `0-common.md §10` AI Agent 전용 범위와 정합

- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §1` `memoryStrategy` 필드
- 충돌 대상: `spec/4-nodes/3-ai/0-common.md §10` 공통 표
- 상세: `0-common.md §10` 의 `memoryStrategy` 행은 "AI Agent 한정 (text_classifier/information_extractor 는 v2)" 이라 명시하고, `1-ai-agent.md §1` 에서도 동일하게 AI Agent 전용으로 정의한다. `conversation-thread.md §1.3` 의 `runningSummary` / `summarizedUpToSeq` 도 `memoryStrategy ∈ {summary_buffer, persistent}` 전략에서만 set 이라 기술해 일관성이 있다.
- 제안: 상태 유지.

---

### [INFO] `1-ai-agent.md §7.5` `execution.user_message` WS 이벤트 — `6-websocket-protocol.md §4.4` 정합 확인

- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §7.5` 라이브 조기 노출 노트
- 충돌 대상: `spec/5-system/6-websocket-protocol.md §4.4`
- 상세: target 이 기술하는 `execution.user_message` 이벤트의 발생 시점, `nodeExecutionId` 의 의미, 권위 출처 정책이 `6-websocket-protocol.md §4.4` 의 동일 이벤트 정의와 상호 참조 구조로 일관성 있게 기술된다. `node-type 에 비의존적이라 information_extractor 에도 적용된다` 는 기술도 `6-websocket-protocol.md` 의 설계 의도와 정합한다.
- 제안: 상태 유지.

---

### [INFO] `1-ai-agent.md §1` `presentationTools[i].type` 중복 금지 — `spec/4-nodes/6-presentation/0-common.md` 과 약한 참조

- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §1` `presentationTools` 주석
- 충돌 대상: `spec/4-nodes/6-presentation/0-common.md §10`
- 상세: target 은 PresentationToolDef 의 schema, defaults overlay 규칙, tool parameters 단일 진실을 `spec/4-nodes/6-presentation/0-common.md §10` 에 위임한다. 해당 spec 이 존재하고 target 이 참조 구조를 올바르게 기술하고 있음을 확인했다. presentation spec 이 실제로 `§10.1 ~ §10.9` 의 세부 규약을 정의하고 있어야 하나, 본 cross-spec 검토 범위에서 presentation spec 내부의 완전성 여부는 별도 검토 대상이다.
- 제안: 상태 유지.

---

## 요약

`spec/4-nodes/3-ai/` 의 target 문서(0-common.md 의 §10~§11 신규 규약 + 1-ai-agent.md 의 memory 전략·System Context Prefix·render_* 도구 확장)는 `spec/conventions/conversation-thread.md`, `spec/conventions/node-output.md`, `spec/5-system/17-agent-memory.md`, `spec/5-system/6-websocket-protocol.md`, `spec/1-data-model.md` 와 직접 모순되는 충돌을 갖지 않는다. 각 영역의 SoT 선언이 명시적으로 분리돼 있고 상호 참조 구조가 일관된다. 발견된 사항은 모두 INFO 수준 — `node-output.md Principle 2` 의 LLM meta 표에 `meta.turnDebug` 등재 누락과 `Principle 7` 에 optional 필드 생략 허용 예외의 명시 부재 두 건이 미래 drift 예방 차원에서 동기화를 권장하나 현재 스펙 운영에 즉각적 장애를 야기하지 않는다.

## 위험도

NONE

---

STATUS: OK
