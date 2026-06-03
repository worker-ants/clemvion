# Cross-Spec 일관성 검토 결과

**검토 모드**: 구현 착수 전 검토 (--impl-prep)
**대상**: `spec/4-nodes/3-ai/` (0-common.md §10-§11 신규 섹션 + 1-ai-agent.md memoryStrategy 확장)
**검토일**: 2026-06-03

---

## 발견사항

### 데이터 모델 충돌

- **[CRITICAL]** `spec/5-system/17-agent-memory.md` 파일이 존재하지 않음
  - target 위치: `spec/4-nodes/3-ai/0-common.md §10`, `1-ai-agent.md §1 (memoryStrategy 필드)`, `spec/1-data-model.md §2.23 AgentMemory`
  - 충돌 대상: `spec/5-system/` 폴더 — 파일 목록에 `17-agent-memory.md` 없음
  - 상세: target 문서(0-common.md §10, 1-ai-agent.md §1·§6.1)가 `[Spec Agent Memory](../../5-system/17-agent-memory.md)` 를 반복적으로 단일 진실 공급원으로 참조하나, `spec/5-system/` 에 해당 파일이 존재하지 않는다. 참조된 하위 섹션(`§스코프 키`, `§회수`, `§forgetting`, `§추출`)도 모두 dangling 링크. `spec/1-data-model.md §2.23 AgentMemory` 역시 동일 경로를 SoT 로 명시(`SoT: [Spec Agent Memory](./5-system/17-agent-memory.md)`)하므로 데이터 모델 문서도 orphan 참조를 보유한 상태다.
  - 제안: `spec/5-system/17-agent-memory.md` 를 신규 작성(project-planner 역할)해 스코프 키·회수·추출·forgetting 정책의 단일 진실을 확립한 뒤 구현에 착수할 것. 파일 부재 상태에서 구현하면 `memoryStrategy: 'persistent'` 의 핵심 동작(의미검색 회수 topK/threshold, AGENT_MEMORY_MAX_PER_SCOPE eviction, 비동기 추출 격리 invariant)이 spec 없이 코드로만 정의되어 사후 drift 검증이 불가능해진다.

---

### API 계약 충돌

- **[WARNING]** `memoryStrategy` 필드의 유효성(AI Agent 한정)과 `text_classifier`/`information_extractor` v2 로드맵 간 범위 불일치
  - target 위치: `0-common.md §10` — "AI Agent 한정 (text_classifier/information_extractor 는 v2)" 비고
  - 충돌 대상: `spec/conventions/conversation-thread.md §2.3` — `contextScope` 주입은 ai_agent 한정, push 는 3노드 모두 출하됨
  - 상세: `0-common.md §10` 의 공통 필드 표에 `memoryStrategy` 가 포함되어 있지만 "AI Agent 한정" 이라는 비고가 함께 붙어 있다. `conversation-thread.md §2.3` 은 contextScope inject 가 ai_agent 한정임을 명시하므로 memoryStrategy도 ai_agent 한정임을 검증 가능하다. 그러나 공통 §10 의 필드 표가 text_classifier/information_extractor 에도 동일 인터페이스를 "v2 에서 추가된다"고 기술하면서, 현 v1 구현 범위에서 두 노드에 memoryStrategy 필드가 config schema 에 포함되어야 하는지 여부가 불명확하다. 구현 착수 시 두 노드의 schema 에 memoryStrategy 를 포함해야 하는지, 아니면 ai_agent.schema.ts 에만 있어야 하는지 결정이 필요하다.
  - 제안: 0-common.md §10 에 "현재 v1 에서 schema 에 노출하는 노드: ai_agent 만. text_classifier/information_extractor 는 schema 에 없는 상태이며 v2 에서 추가" 라는 명시적 문구를 추가하거나, 각 노드 spec의 §1 설정 표에 memoryStrategy 행의 존재 여부를 명확히 기술할 것.

---

### 상태 전이 충돌

- **[WARNING]** `memoryStrategy` 와 `contextScope` 필드 간 무효화 관계가 두 문서에서 상충하는 서술로 기술됨
  - target 위치: `1-ai-agent.md §1` — `contextScope` 필드 비고: "**`memoryStrategy ≠ manual` 시 무효**"; `contextInjectionMode` 필드: "`memoryStrategy ∈ {summary_buffer, persistent}` 시에는 최근 원문 turn 의 주입 형식으로만 의미를 갖고"
  - 충돌 대상: `spec/conventions/conversation-thread.md §5` — `contextScope`/`contextInjectionMode` 를 5개 필드로 열거하면서 "memoryStrategy 비하위호환 선택 시 무효" 언급 없이 독립적으로 기술
  - 상세: conversation-thread.md §5 의 필드 표는 `contextInjectionMode: messages/system_text` 를 단순 설명하고, `memoryStrategy ∈ {summary_buffer, persistent}` 일 때 `contextInjectionMode` 가 "최근 원문 turn 주입 형식으로만 의미를 갖는다"는 세밀한 구분은 1-ai-agent.md §1 에만 있다. conversation-thread.md §5 를 기준으로 구현하는 사람은 이 미묘한 제한을 놓칠 수 있다. 단, 두 문서가 직접 모순되는 것은 아니며 1-ai-agent.md 가 더 상세한 계층이므로 완전한 충돌은 아님.
  - 제안: conversation-thread.md §5 또는 §7 v2 로드맵에 "memoryStrategy ≠ manual 시 contextScope 계열 4필드의 범위 선택 의미가 무효화되며, contextInjectionMode 는 최근 원문 turn 주입 형식으로만 의미를 갖는다 — 상세: [Spec AI Agent §1]" 크로스 레퍼런스를 추가할 것.

---

### 데이터 모델 / 계층 책임 충돌

- **[INFO]** `output.result.presentations[]` 위치가 두 spec 에서 미묘하게 다르게 기술됨
  - target 위치: `1-ai-agent.md §7.10` 및 §6.1.d.i — "ConversationTurn 의 **top-level `presentations[]`** 에 push (`data?` 가 아닌 별도 독립 필드)" + `output.result.presentations[]` 로 JSON 예시 기술
  - 충돌 대상: `spec/conventions/conversation-thread.md §1.2` ConversationTurn 표 — `presentations?` 필드를 `source='ai_assistant'` 한정 ConversationTurn top-level 필드로 정의. `spec/conventions/node-output.md Principle 0` — output/config/meta/port/status 5필드 외 구조에 대한 엄격한 규정
  - 상세: 1-ai-agent.md §7.10 의 JSON 예시에서 `output.result.presentations[]` 로 표기되어 있으나, §6.1.d.i 및 §4.1·§7.1 비고에서는 "ConversationTurn 의 top-level presentations[]" 라고 기술되어 있어 presentations 가 `output.result` 하위인지 ConversationTurn 의 top-level 인지 혼동이 생길 수 있다. 단, §7.10 의 실제 설명을 보면 `output.result.presentations[]` 는 node output 의 표현이고 ConversationTurn.presentations[] 는 thread 누적 표현이라 서로 다른 레이어임이 맥락상 파악 가능하다. 그러나 구현자가 두 곳을 동기화해야 하는 책임 경계가 불명확할 수 있다.
  - 제안: 1-ai-agent.md §7.10 또는 §7.1 비고에 "presentations payload 는 두 위치에 운반된다: (a) node output의 `output.result.presentations[]` — 직후 downstream 노드 접근용; (b) ConversationTurn.presentations[] — thread 누적 및 WS 라이브 표면. (a)와 (b)는 동일 data의 두 관점이며 단일 진실은 §7.10 PresentationPayload type" 이라는 명시적 구분을 추가.

- **[INFO]** `systemContextSections` 허용 값 목록이 spec 두 곳에 분리 기술됨
  - target 위치: `0-common.md §11.1` — 허용 값 `time / timezone / workspace / node` 정의
  - 충돌 대상: `1-ai-agent.md §1` 설정 필드 표 — 동일 필드를 동일 허용 값으로 재기술
  - 상세: 두 곳이 현재 동일 값 목록이라 모순은 없지만, 새 섹션 값이 추가될 때 두 곳을 동시 갱신해야 하는 drift 위험이 있다. 0-common.md §11.1 이 단일 진실임을 명확히 하고 1-ai-agent.md §1 의 해당 행은 "(허용 값 목록은 [공통 §11.1] 참조)" 로 대체하는 것이 drift 방지에 유리하다.
  - 제안: 1-ai-agent.md §1 의 `systemContextSections` 행에서 허용 값 목록(`time / timezone / workspace / node`)을 제거하고 "허용 값: [공통 §11.1 참조](./0-common.md#111-설정-필드-3-노드-공통)" 로 교체.

---

### 요구사항 ID 충돌

- **[INFO]** 신규 섹션(§10, §11)의 요구사항 ID 미부여
  - target 위치: `0-common.md §10·§11` 전체, `1-ai-agent.md §1 memoryStrategy/memory* 관련 필드`
  - 충돌 대상: `spec/4-nodes/3-ai/_product-overview.md` — AI 노드 요구사항 ID 체계 (ND-AG-* 등)
  - 상세: target 문서에 새로 기술된 `memoryStrategy`, `includeSystemContext`, `systemContextSections` 설정 필드 및 Conversation Context 자동 주입 기능에 대한 요구사항 ID 가 부여되지 않았다. 다른 AI Agent 설정 필드(예: ND-AG-06, ND-AG-10 등)는 이미 ID를 가지고 있어 일관성이 없다.
  - 제안: project-planner 가 구현 착수 전에 `_product-overview.md` 에 신규 기능에 대한 요구사항 ID 를 부여하고 spec 에 inline 할 것 (구현을 block 하지 않는 범위에서 병행 진행 가능).

---

## 요약

`spec/4-nodes/3-ai/` target 문서는 `spec/conventions/conversation-thread.md`, `spec/conventions/node-output.md`, `spec/1-data-model.md §2.23` 과 전반적으로 잘 정합된다. 가장 중대한 문제는 `spec/5-system/17-agent-memory.md` 파일의 부재로, `memoryStrategy: 'persistent'` 의 세션 간 추출/회수/forgetting 동작의 단일 진실이 없는 상태에서 구현에 착수하면 코드가 spec 의 유일한 진실이 되는 역전이 발생한다. 나머지 발견사항들(WARNING 2건, INFO 2건)은 기능 동작에 모순을 일으키지 않는 수준이지만 구현 중 오해나 drift의 씨앗이 될 수 있다. `17-agent-memory.md` 작성이 완료된 뒤 구현 착수를 권장한다.

---

## 위험도

**HIGH**

> (근거: `spec/5-system/17-agent-memory.md` CRITICAL 부재. `memoryStrategy: 'persistent'` 구현의 핵심 계약 — 스코프 키 네임스페이스, top-k 회수 파라미터, 비동기 추출 격리 invariant, AGENT_MEMORY_MAX_PER_SCOPE eviction — 이 spec 없이 코드로만 결정되는 상황. 나머지 WARNING/INFO 는 단독으로는 MEDIUM 이하이나 CRITICAL 과 복합될 경우 설계 표류가 가속될 수 있다.)
