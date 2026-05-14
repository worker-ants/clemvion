초안을 전부 읽었습니다. 이제 기존 `node-output.md` convention을 기준으로 비교 검토합니다.

---

## Convention Compliance Check — 결과

### 발견사항

---

- **[CRITICAL]** `output.meta.contextInjection` vs `meta.contextInjection` — 경로 불일치로 Principle 0 위반

  - **target 위치**: draft §5.3 Cap 설명 마지막 줄 (line 201)
  - **위반 규약**: `spec/conventions/node-output.md` **Principle 0** — `NodeHandlerOutput` 의 5필드는 `{ config, output, meta?, port?, status? }` 이며, `meta` 는 `output` 의 하위 필드가 아닌 **최상위 형제 필드**
  - **상세**: line 201 은 `output.meta.contextInjection: { scope, mode, injectedTurns, droppedTurns, totalInjectedChars }` 로 기술하고 있어 실행 메트릭을 `output` 안에 넣는 형태가 된다. 이는 Principle 1("output 은 비즈니스 결과물만 담는다")과 Principle 2("meta 는 실행 메트릭만 담는다")도 동시에 위반한다. 같은 draft 내 §3.3 (line 313) 은 `meta.contextInjection.droppedTurns` 로 올바르게 기술하고 있고, draft 자체 점검 포인트(line 507)도 `meta.contextInjection` 으로 표기하고 있어 line 201이 오기임이 명확하다.
  - **제안**: line 201을 `meta.contextInjection: { scope, mode, injectedTurns, droppedTurns, totalInjectedChars }` 로 수정한다.

---

- **[CRITICAL]** `conversation-thread.md §2.3` 의 "v1 은 `ai_agent` 만 자동 누적" — 핵심 결정 표 및 `0-common.md §11` 과 모순

  - **target 위치**: draft §1 (신규 `conversation-thread.md`) 내 §2.3 "다른 AI 노드 (v1 미적용)" (line 121–123)
  - **위반 규약**: 단일 진실 원칙 (CLAUDE.md §정보 저장 위치). 동일 batch 내 두 문서가 상충하는 spec을 정의함
  - **상세**: `conversation-thread.md §2.3` 은 "v1 은 `ai_agent` 만 자동 누적" 이라 쓰지만, 동일 draft의 핵심 결정 표(line 30)는 "v1: `ai_agent` 만 **주입** + **모든 AI 노드**의 turn 누적"으로 명확히 구분하고, `0-common.md §11` 변경안(line 244)도 "모든 AI 노드의 turn 누적(자동 push)은 v1부터 적용된다"고 기술한다. 구현자가 `conversation-thread.md §2.3`만 보면 `text_classifier` / `information_extractor` 의 push를 v1에서 빠뜨리게 된다.
  - **제안**: `conversation-thread.md §2.3` 을 다음으로 교체한다:
    ```markdown
    ### 2.3 다른 AI 노드 — turn 누적 (v1 적용) / 주입 (v2)
    
    `text_classifier`, `information_extractor` 는 v1 부터 turn 누적(push)을 수행하지만, thread 자동 **주입** (contextScope 설정 → LLM messages 재빌드)은 v2 에 추가된다.
    ```

---

- **[WARNING]** `meta.contextInjection` 에 config 값 (`scope`, `mode`) echo 포함 — Principle 2 적용 범위 경계

  - **target 위치**: draft §5.3 Cap 표 및 §1 `conversation-thread.md` §5.3
  - **위반 규약**: `spec/conventions/node-output.md` **Principle 2** — `meta` 는 실행 메트릭만 담는다. Principle 2 표의 항목은 모두 런타임 측정값(`durationMs`, `tokens`, `statusCode` 등)
  - **상세**: `meta.contextInjection.scope` 와 `meta.contextInjection.mode` 는 config 필드 `contextScope`/`contextInjectionMode` 의 단순 복사다. `injectedTurns`, `droppedTurns`, `totalInjectedChars` 는 런타임 계산값이므로 적절하다. `scope`/`mode` 는 이미 `$node["X"].config.contextScope` 로 접근 가능하므로 `meta` 에 중복 포함할 이유가 약하다. `meta.model` 이 유사 선례이지만, model 은 LLM 이 실제 사용한 값(override 가능)이어서 config echo와 성격이 다르다.
  - **제안**: `meta.contextInjection` 에서 `scope`, `mode` 를 제거하고 `{ injectedTurns, droppedTurns, totalInjectedChars }` 만 유지한다. 디버그 용도라면 `meta.contextInjection.appliedScope`/`appliedMode` 처럼 "실제 적용된" 값임을 명시하는 이름을 사용해 config echo 와 구분한다.

---

- **[INFO]** 신규 `spec/conventions/conversation-thread.md` — `## Rationale` 섹션 미포함

  - **target 위치**: draft §1 전체 구조 (§1–§8 구성, §8 은 CHANGELOG)
  - **위반 규약**: CLAUDE.md 명명 컨벤션 — "N-name.md 의 본문 끝에 `## Rationale` 섹션을 권장". 기존 `spec/conventions/migrations.md` 는 §7 폐기 대안(Rationale)을 포함한다.
  - **상세**: 설계 근거는 `ai-agent.md §12.1/12.2` 에 상세히 기술되어 있으나, convention 파일 자체를 독립적으로 읽는 독자(미래 유지보수자)는 근거를 찾지 못한다. `migrations.md` 의 전례에 비춰 convention 파일도 Rationale 섹션이 있는 편이 일관적이다.
  - **제안**: §8 CHANGELOG 앞에 간략한 `## Rationale` 섹션을 추가하거나, "설계 근거는 [Spec AI Agent §12.1](../4-nodes/3-ai/1-ai-agent.md#121-왜-conversationthread-를-1급-객체로-도입했는가) 참조" 한 줄 포인터라도 배치한다.

---

### 요약

전체적으로 규약 준수 수준은 높다. 신규 필드 명명(`contextScope`, `contextInjectionMode` 등), `interaction.type` 열거값(`form_submitted`/`button_click`/`button_continue`/`message_received`), 포트 활성화 모델, `config` echo 패턴 모두 Principle 준수가 확인된다. 다만 **CRITICAL 2건**이 있어 spec 반영 전 수정이 필요하다. 첫째, `output.meta.contextInjection` → `meta.contextInjection` 경로 수정(명백한 오기). 둘째, `conversation-thread.md §2.3`의 "v1은 ai_agent만 자동 누적" 문구가 핵심 결정 표 및 `0-common.md §11` 변경안과 정면 모순되므로 주입(inject)과 누적(push)을 구분하는 문구로 교체 필요.

### 위험도

**CRITICAL** — CRITICAL 2건이 미수정 상태로 spec에 반영되면 구현자가 `output.meta.*` 경로를 코드에 박거나 `text_classifier`/`information_extractor`의 v1 push를 누락할 위험이 있다.