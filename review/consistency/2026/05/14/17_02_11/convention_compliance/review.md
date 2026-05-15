## Convention Compliance Check 결과

**대상**: `plan/in-progress/spec-draft-conversation-thread.md` (spec draft 검토 모드)
**참조 규약**: `spec/conventions/node-output.md`, `spec/conventions/migrations.md`, `spec/conventions/cafe24-api-metadata.md`

---

### 발견사항

---

- **[WARNING]** `result.content` 필드명이 `output.result.response` 규약과 불일치
  - **target 위치**: 신규 `conversation-thread.md` §2.2 AI Agent 자동 누적 컨트랙트
    ```
    single-turn 최종 `result.content` → `ai_assistant` (1회)
    ```
  - **위반 규약**: `spec/conventions/node-output.md` §8.2 통일된 1차 네이밍
    > LLM의 응답 텍스트/객체 → `output.result.response` (ai_agent)
  - **상세**: 단일 turn의 text 파생 규칙에서 `result.content`를 참조하고 있으나, 정식 규약은 AI Agent 최종 응답 필드를 `output.result.response`로 정의한다. 구현 시 `result.content`를 읽으면 존재하지 않는 필드를 참조하게 됨.
  - **제안**: `conversation-thread.md` §2.2 및 §1.4 `text` 변환 규칙의 `ai_assistant final` 행을 `result.response` 로 수정:
    ```diff
    - | ai_assistant final | `result.content` 그대로 |
    + | ai_assistant final | `output.result.response` 그대로 |
    ```

---

- **[WARNING]** `output.result.messages` 가 정식 규약에 정의되지 않음
  - **target 위치**: 신규 `conversation-thread.md` §4 영속화 표
    ```
    output.interaction (presentation), output.messages / output.result.messages (AI 노드) 가 SoT
    ```
  - **위반 규약**: `spec/conventions/node-output.md` §4.3 Waiting 상태의 `output`
    > `ai_agent` (multi) → `{ messages }` (대화 누적, 런타임 상태)
    
    §8.2:
    > LLM의 응답 텍스트/객체 → `output.result.response`
  - **상세**: 규약은 멀티턴 대기 상태의 누적 메시지 배열을 `output.messages`로, 최종 LLM 응답을 `output.result.response`로 분리 정의한다. `output.result.messages`는 어느 Principle에도 등장하지 않는 미정의 경로다. SoT 명세에서 세 가지 경로를 혼용하면 구현 혼란을 초래.
  - **제안**: 영속화 표의 AI 노드 SoT를 규약 용어로 명확화:
    ```diff
    - `output.interaction` (presentation), `output.messages` / `output.result.messages` (AI 노드) 가 SoT
    + `output.interaction` (presentation), `output.messages` (멀티턴 대화 누적, waiting 상태) / `output.result.response` (single·multi-turn 최종 응답) (AI 노드) 가 SoT
    ```

---

- **[INFO]** `spec/4-nodes/3-ai/0-common.md` 섹션 번호 설명 문구 모호
  - **target 위치**: 변경안 §2 "기존 §10 CHANGELOG 직전(§10 → §11 로 밀고)에 §11 신설"
  - **위반 규약**: 직접 규약 위반은 아니나 문서 편집 지시가 불명확
  - **상세**: "§10 → §11 로 밀고 §11 신설"은 기존 §10(CHANGELOG)이 §11이 되고 새 절이 §11로 삽입된다는 의미인지, 아니면 새 절이 §10이 되고 CHANGELOG가 §11로 밀리는 의미인지 불분명. 두 해석 모두 "§11 신설"이 일관되지 않음.
  - **제안**: 편집 지시를 다음과 같이 명확화:
    ```diff
    - 기존 §10 CHANGELOG 직전(§10 → §11 로 밀고)에 §11 신설
    + 기존 §10 CHANGELOG 를 §11 로 변경하고, 새 §10 Conversation Context 를 그 앞에 삽입
    ```

---

- **[INFO]** `sanitizeLlmProvidedString`을 "규약"으로 지칭하나 `spec/conventions/`에 미등재
  - **target 위치**: 신규 `conversation-thread.md` §5.2 system_text 모드
    ```
    sanitizeLlmProvidedString 규약을 준용한다
    ```
  - **위반 규약**: 없음 (정식 규약 등재 누락)
  - **상세**: 본 draft가 `sanitizeLlmProvidedString`을 "규약"으로 참조하지만, `spec/conventions/` 하위 어디에도 해당 규약 문서가 없다. 코드 레벨 패턴이 컨벤션으로 오인될 수 있음.
  - **제안**: 표현을 "코드 레벨 sanitizer 패턴"으로 낮추거나, 향후 `spec/conventions/security-sanitization.md` 등으로 정식 등재. 지금은:
    ```diff
    - sanitizeLlmProvidedString 규약을 준용한다
    + `LlmService`의 user content sanitizer 와 동일한 방식으로 sanitize 한다 (상세는 구현 코드 참고)
    ```

---

### 요약

draft 전반은 `spec/conventions/node-output.md` 의 Principle 체계(Principle 2 meta 필드 배치, Principle 4.5 `interaction.type` 값, Principle 7 config echo 구분)를 올바르게 준수하고 있으며, 금지 경로(옛 `prd/`, `memory/`)나 구조 위반도 없다. 다만 `result.content` vs `output.result.response`(WARNING), `output.result.messages` 미정의 경로(WARNING) 두 항목이 구현 단계에서 field name 혼란을 야기할 수 있으며, 해당 부분을 수정한 후 spec 반영을 진행하는 것을 권장한다.

### 위험도

**LOW** — Critical 위배 없음. Warning 2건은 모두 field name 표현 수정으로 해소 가능하며 차단 사유에 해당하지 않음.