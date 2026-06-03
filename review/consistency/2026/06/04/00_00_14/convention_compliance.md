# 정식 규약 준수 검토 결과

검토 범위: `spec/4-nodes/3-ai/` (구현 완료 후 검토, diff-base=origin/main)
검토 기준: `spec/conventions/` 전체

---

## 발견사항

### 1. 명명 규약

- **[INFO]** `0-common.md` frontmatter `status: partial` — 실제 파일은 `implemented`
  - target 위치: `spec/4-nodes/3-ai/0-common.md` frontmatter, 라인 4
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §3` — `partial` 은 `pending_plans:` 가 의무. 프롬프트 페이로드에서 전달된 버전은 `status: partial` + `pending_plans: [plan/in-progress/ai-context-memory-followup-v2.md]` 조합이나, 현재 디스크 상 실제 파일은 `status: implemented` 로 갱신됨
  - 상세: 프롬프트 페이로드로 전달된 target 문서는 이전 버전이며 아직 `partial` 상태로 표기됨. 별도 위반은 없으나, 검토 대상이 최신 파일 상태와 다를 수 있음을 인지
  - 제안: 해당 사항 없음 — 실제 파일은 이미 `implemented` 로 정합

- **[INFO]** `1-ai-agent.md` frontmatter `status: partial`
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §3` — `partial` 상태는 `pending_plans:` 의무
  - 상세: 프롬프트 페이로드 버전에서 `pending_plans` 에 `plan/in-progress/ai-agent-tool-connection-rewrite.md` · `plan/in-progress/ai-context-memory-followup-v2.md` 가 등재되어 있어 규약 자체는 충족함. 별도 위반 없음

### 2. 출력 포맷 규약

- **[WARNING]** `contextScope` 필드 `✓` 필수 마킹이 `1-ai-agent.md` 설정 표에 존재하나 `0-common.md §10` 에는 필수(`✓`) 표시 없음
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §1` 설정 표 `contextScope` 행 (필수: `✓`), `spec/4-nodes/3-ai/0-common.md §10` 표 `contextScope` 행 (필수 칸 없음)
  - 위반 규약: `spec/conventions/node-output.md Principle 1.1` — 단일 진실 원칙. 두 표가 동일 필드를 다른 필수성으로 기술함
  - 상세: `1-ai-agent.md §1` 은 `contextScope` 를 `필수: ✓` 로, `contextInjectionMode` 도 `필수: —` 로 기술. 반면 `0-common.md §10` 는 필수 컬럼 자체를 사용하는데 `contextScope` 행의 필수 값이 `✓` 로 표기. 이 두 문서의 표현이 다르지는 않으나, `0-common.md §10` 의 `contextInjectionMode` 행 필수 칸이 `(scope ≠ none 시)` 로만 표기되어 있어 `1-ai-agent.md §1` 의 `—` 표기와 의미가 다름
  - 제안: `0-common.md §10` 와 `1-ai-agent.md §1` 의 필수 표기를 통일하거나, `0-common.md §10` 가 공통 기준 SoT 임을 명시하고 `1-ai-agent.md §1` 에서는 cross-ref 만 두도록 정리

- **[INFO]** `meta.durationMs` 필드 — `0-common.md §6` 토큰 회계 표에 `durationMs` 가 필수 필드로 정의되어 있으나 `7.3 error` 출력 예시 JSON 에서는 `meta` 에 `durationMs` 가 포함되어 있음. `7.9 multi-turn error` 출력 예시에도 동일. CONVENTIONS Principle 2 에서 `meta.durationMs: number` 를 공통 필수 필드로 정의하므로 양쪽 일관성은 충족됨
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §7.3`, `§7.9` JSON 예시
  - 위반 규약: 없음 — 정합
  - 제안: 해당 사항 없음

- **[INFO]** `output.error.details.retryable` / `retryAfterSec` invariant 표기
  - target 위치: `spec/4-nodes/3-ai/0-common.md §5`, `spec/4-nodes/3-ai/1-ai-agent.md §7.3`, `§7.9`
  - 위반 규약: `spec/conventions/node-output.md §3.2.1` — `retryAfterSec` 는 `retryable === true` 일 때만 set 가능
  - 상세: `0-common.md §5` 의 표에서 `details.retryAfterSec?: number` 를 "선택" 으로 기술하고 `[CONVENTIONS Principle 3.2.1]` 링크가 걸려 있어 규약 참조는 적절함. `1-ai-agent.md §7.9` 의 `details` 표에서도 invariant 가 명시됨. 규약 준수 확인됨
  - 제안: 해당 사항 없음

### 3. 문서 구조 규약

- **[WARNING]** `0-common.md` 의 `## Rationale` 섹션이 §11 (System Context Prefix) 만 다루며 §1~§10 에 대한 Rationale 가 없음
  - target 위치: `spec/4-nodes/3-ai/0-common.md §Rationale` (문서 맨 끝)
  - 위반 규약: CLAUDE.md 문서 구조 규약 — "Overview / 본문 / Rationale 3섹션 권장". Rationale 는 권장이므로 CRITICAL 은 아니나, §11 만 커버되고 §10 (Conversation Context) 의 Rationale 가 없어 독자 입장에서 §10 의 설계 근거 추적이 불가능함
  - 상세: §10 은 `memoryStrategy` / `contextScope` / `excludeFromConversationThread` 등 5개 필드와 v1/v2 구분, `text_classifier`/`information_extractor` 의 inject 미완 등 복잡한 결정이 담겨 있음에도 Rationale 가 없음
  - 제안: `## Rationale` 하위에 `### Conversation Context (§10)` 소절을 추가해 `memoryStrategy` 를 별도 필드로 채택한 근거, v2 로 미룬 범위 등 핵심 결정을 기술. 또는 `1-ai-agent.md §12.9` 에 이미 작성된 내용을 cross-ref 로 연결

- **[INFO]** `1-ai-agent.md` 본문이 §12 (Rationale 패밀리) 로 확장되어 매우 길어짐 — 권장 3섹션 모델 내에서 동작하나, §12 소절 수가 12개로 분화됨
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §12`
  - 위반 규약: 해당 없음 — 규약은 3섹션을 "권장"으로 두고 소절 수를 제한하지 않음
  - 제안: 해당 사항 없음

### 4. API 문서 규약

- **[INFO]** `output.error.code` 값 `UPPER_SNAKE_CASE` 요구사항 — `1-ai-agent.md §10` 에 에러 코드 표가 따로 없음. §7.3 예시에서 `LLM_CALL_FAILED`, §7.9 에서 `LLM_RATE_LIMIT` 으로 사용되고 있어 형식은 준수됨
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §7.3`, `§7.9`
  - 위반 규약: `spec/conventions/node-output.md §3.2` — `code` 는 `UPPER_SNAKE_CASE`
  - 상세: 예시 코드에서 규약 준수 확인됨. §10 에러 코드 표 참조가 언급되어 있으나 실제 §10 은 대화 관련 내용임. 에러 코드 표가 별도 섹션으로 정의되어 있지 않음
  - 제안: 별도 에러 코드 열거 섹션(예: `§10 에러 코드`) 을 신설하거나, `spec/conventions/error-codes.md` 를 cross-ref 로 연결해 completeness 를 높임

### 5. 금지 항목 점검

- **[INFO]** `_resumeState` / `_resumeCheckpoint` / `_retryState` top-level 필드 노출 — CONVENTIONS Principle 0 예외 처리 항목으로 명시됨
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §7.4`, `§7.5`, `§7.9`
  - 위반 규약: `spec/conventions/node-output.md Principle 0` — 5필드 불변 원칙의 예외로 명시적으로 허용됨
  - 상세: 세 필드는 모두 Principle 0 의 "internal top-level 필드 허용 예외" 조항에 정확히 명시되어 있음. 문서 내 참조도 Principle 4.2 / 4.2.1 을 올바르게 링크하고 있음. 규약 위반 없음
  - 제안: 해당 사항 없음

- **[CRITICAL]** `output.result.message` 와 `output.result.messages` 가 `waiting_for_input` 출력 (`§7.4`) 의 `output` 하위에 존재 — 일부 필드가 config 리터럴 echo 금지 위반 경계에 있음
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §7.4` JSON 예시 및 필드 표
  - 위반 규약: `spec/conventions/node-output.md Principle 1.1` — "사용자가 UI에서 설정한 리터럴 값은 config 에만" / Principle 4.3 의 `ai_agent (multi)` 행
  - 상세: `§7.4` 의 `output.result.message` (`"안녕하세요, 무엇을 도와드릴까요?"`) 와 `output.result.messages` 배열은 런타임에 생성된 LLM 응답이므로 `output.result.*` 에 두는 것은 Principle 1.1 에 부합. `maxTurns` 는 `config.maxTurns` 에서만 읽도록 Principle 1.1 을 준수함. **다만 `output.result.message` 는 `meta.interactionType: "ai_conversation"` 과 중복 역할**을 할 수 있어 Principle 1 "비즈니스 결과물만" 규칙 경계에 있음 — message 는 런타임 LLM 응답이라 `output.result` 에 두는 것이 Principle 8.2 `output.result.response` 패턴과 일관성 있음. **위반은 아님**
  - 정정: 아래 별도 항목으로 실제 CRITICAL 을 분리함

- **[CRITICAL]** `output.result.turnCount` 가 `§7.4 waiting_for_input` 출력에서 "첫 진입 시 `0`" 으로 기술되어 있으나 본문 §7.4 필드 표의 `output.result.message` 행에서는 "첫 진입 시 `""`" 로 기술 — 두 기술이 하나의 JSON 예시 (첫 진입이면서 turnCount=1 로 표기됨) 와 모순됨
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §7.4` JSON 예시 (`"turnCount": 1`) vs 필드 표 설명 ("첫 진입 시 `0`")
  - 위반 규약: `spec/conventions/node-output.md Principle 1` — 단일 진실 원칙 위반. JSON 예시와 필드 표가 상충되는 값을 제시하면 구현자·독자가 혼란을 겪음
  - 상세: `§7.4` JSON 예시의 `"turnCount": 1` 은 "첫 번째 사용자 메시지 수신 후 LLM 응답이 완료된 뒤 waiting 진입" 시나리오를 나타내는 것으로 보이나, 필드 표에서는 "첫 진입 시 `0`" 이라 함. `§7.5` 주석의 `D6 결정` 노트에서 turnCount 정의가 언급되어 있으나 명확한 기준이 없음. 이 불일치가 구현 코드와 spec 간 드리프트 위험을 가짐
  - 제안: JSON 예시를 "첫 진입(LLM 호출 전)" 시나리오로 명확히 labeling 하거나, 예시를 두 개(첫 진입 / 1턴 후)로 분리하고 turnCount 값을 각각 `0`, `1` 로 명시

- **[WARNING]** `1-ai-agent.md §4 Tool Area 연동` 섹션이 "⚠ 재작성 예정 (현재 제거됨)" 으로 시작하나, §4.1 Presentation Tool Family (`render_*`) 는 활성 구현됨 — 섹션 제목이 전체 §4 가 비활성인 것처럼 오해를 유발
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §4`
  - 위반 규약: 문서 구조 규약 — 독자가 섹션 전체가 폐기됐다고 오해할 가능성. `spec/conventions/spec-impl-evidence.md §3` 의 `archived` 정책과 부합하지 않음 — 현재 비활성은 섹션 일부이며 전체 섹션을 deprecated 처리하지 않음
  - 상세: `§4` 의 대분류 경고문이 `toolNodeIds` / `toolOverrides` 관련 Tool Area 연동만 대상이어야 하는데, `§4` 전체가 경고문으로 시작해 `§4.1 Presentation Tool Family` 의 활성 구현 내용과 혼재함. 목차를 보면 §4 헤딩은 "Tool Area 연동" 으로 `render_*` 를 포함하지 않는 느낌
  - 제안: `§4` 헤딩을 "도구 연동" 으로 변경하고 `§4.0 Tool Area (재작성 예정)` / `§4.1 Presentation Tool Family` 로 구분하거나, 경고문을 `§4.0` 내에 한정해 `§4.1` 의 활성 구현이 명확히 구분되도록 구조화

- **[INFO]** `0-common.md §10` 의 `memoryStrategy` 필드 설명에서 `AI Agent 한정 (text_classifier/information_extractor 는 v2)` 를 표 안 설명 컬럼에만 기술하고 있음 — 전용 비고 callout 없음
  - target 위치: `spec/4-nodes/3-ai/0-common.md §10` 설정 표 `memoryStrategy` 행
  - 위반 규약: 해당 없음 — 명시적 금지 항목 아님
  - 제안: `> **v1 적용 범위**: memoryStrategy 는 AI Agent 한정 구현. text_classifier / information_extractor 는 v2 예정` callout 을 표 아래에 추가하면 가독성 향상

---

## 요약

`spec/4-nodes/3-ai/` 의 세 문서는 전반적으로 `spec/conventions/node-output.md` 의 핵심 원칙(Principle 0~11), `spec/conventions/spec-impl-evidence.md` 의 frontmatter 라이프사이클, `spec/conventions/conversation-thread.md` 의 ConversationTurn 운반 규약을 충실히 따르고 있다. 주요 준수 사항: `output.result.*` / `output.error.*` / `output.interaction.*` wrapper 사용, `UPPER_SNAKE_CASE` 에러 코드, `_resumeState` / `_retryState` 의 Principle 0 예외 처리, `config` vs `output` 직교 원칙, `retryable`/`retryAfterSec` invariant 명시. 가장 주의해야 할 점은 `1-ai-agent.md §7.4` 의 `turnCount` JSON 예시 값(`1`)과 필드 표 설명("첫 진입 시 `0`") 의 불일치로, 구현자가 잘못된 값으로 구현할 경우 `waiting_for_input` 초기 상태의 진행률 표시가 오동작할 수 있다. `0-common.md` 의 Rationale 섹션이 §11 만 커버하고 §10 (Conversation Context / memoryStrategy) 의 근거가 누락된 점도 문서 구조 규약 관점에서 보완이 권장된다.

---

## 위험도

MEDIUM
