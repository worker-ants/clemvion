# 신규 식별자 충돌 검토

> 검토 대상: `plan/in-progress/spec-draft-conversation-turn-render.md`
> 검토 모드: `--spec`
> 검토 일시: 2026-05-18

---

### 발견사항

- **[WARNING]** `data.fields` 키 이름이 기존 node-output.md §4.5 정의와 구조 불일치
  - target 신규 식별자: `data.fields` — draft §1.2 보강에서 `form_submitted → fields (key-value 또는 Record<string,unknown>)` 를 `ConversationTurn.data` 의 1급 필드로 명시
  - 기존 사용처: `spec/conventions/node-output.md §4.5` — `form_submitted` 의 `interaction.data` 를 `{ [fieldName]: value }` (flat object, 명시적 `fields` 키 없음) 로 정의
  - 상세: 기존 정의에서는 `data` 자체가 key→value 맵 (`{ name: "John", age: 30 }` 형태)이다. draft §1.2 보강은 이를 `data.fields` 라는 1급 키 안에 담는 형태로 표현하고 있다 (`form_submitted → fields (key-value 또는 Record<string,unknown>)`). `ConversationTurn.data` 가 `output.interaction.data` 의 snapshot 이라면, 두 정의의 구조가 달라진다 — `data = { name: "John" }` vs `data = { fields: { name: "John" } }`. draft §1.4 의 `text` 변환 규칙 표에서는 `data.fields` 키-값 표로 UI 를 그리도록 기술하고 있어 동일 해석이 반복된다.
  - 제안: `fields` 를 별도 wrapping key 로 도입할 경우 node-output.md §4.5 의 `form_submitted` data shape 도 동시에 개정해야 한다. 만약 `ConversationTurn.data` 가 `output.interaction.data` snapshot 과 동일 shape (flat object) 을 유지하고 UI 가 해당 object 를 "키-값 표" 로 렌더만 하는 것이라면 `fields` 라는 키 이름을 제거하고 "UI 는 `data` 의 각 key-value 를 표로 표시한다" 로 표현하는 쪽이 기존 정의와 정합을 유지한다.

- **[WARNING]** §11 UI 라벨 표현과 §1.4 / D5 표 간 상이 (`buttons` vs `button clicked`)
  - target 신규 식별자: `presentation_user` source 의 interaction 라벨 문자열
  - 기존 사용처: draft 자체의 D5 표 (§1 결정 섹션) 와 §3.1 §11.1 표가 동시에 다른 라벨 사용
  - 상세: D5 표(§1 결정 섹션 line 65)에서 `interaction.type` 라벨을 `buttons` / `form submitted` / `link continue` 로 표기하고, §11.1 표(§3.1 spec 변경 섹션 line 136)에서는 동일 UI 라벨을 `button clicked` / `form submitted` / `link continue` 로 표기한다. `buttons` 와 `button clicked` 는 같은 `button_click` interaction.type 에 대응하는 서로 다른 라벨 문자열이다. spec 내에서 동일 값의 UI 표현이 두 가지로 갈린다.
  - 제안: spec 내에서 단일 라벨로 통일한다. `button_click` 에 대응하는 UI 라벨은 `button clicked` (§11.1 형식) 또는 `buttons` (D5 형식) 중 하나만 채택하고 D5 표와 §11 표 모두 동일 값을 사용하도록 조정한다. §11.1 의 `button clicked` 가 더 서술적이어서 사용자 가독성이 좋다.

- **[INFO]** `§11` anchor 를 참조하는 cross-link 의 경로가 일부 상이
  - target 신규 식별자: `#11-미리보기-ui-렌더-규칙` anchor (conversation-thread.md §11)
  - 기존 사용처: draft 본문 내 §3.2 (websocket-protocol.md 개정), §3.3 (ai-agent.md 개정), §3.4 (ai-thread-source-mark.md 개정) 에서 각각 cross-link 를 생성
  - 상세: §3.4 (ai-thread-source-mark.md 개정) 의 cross-link 경로가 `../../spec/conventions/conversation-thread.md#11-...` 로 되어 있으나, 해당 plan 파일은 `plan/in-progress/` 에 위치하므로 spec 파일의 실제 상대 경로는 `../../spec/conventions/...` 이 아닌 다른 경로가 되어야 한다. §3.2 (websocket-protocol.md 기준 `../conventions/conversation-thread.md`) 와 §3.3 (ai-agent.md 기준 `../../conventions/conversation-thread.md`) 은 해당 spec 파일 위치 기준으로 올바르다. plan 파일 내 참조는 상대 경로가 아닌 절대 경로 표기나 메모 수준 표기를 사용하는 것이 혼선을 줄인다.
  - 제안: §3.4 의 plan 파일 내 cross-link 를 `spec/conventions/conversation-thread.md#11-...` (root-relative 형태) 또는 `[Spec Conversation Thread §11](../conventions/conversation-thread.md#11-미리보기-ui-렌더-규칙)` (plan 파일의 상대 위치 기준 `../spec/conventions/...`) 로 수정한다.

- **[INFO]** 기존 `§11.2.1 canvas 스펙` 참조와 신규 `§11` anchor 의 심리적 혼선 가능성
  - target 신규 식별자: `conversation-thread.md §11` 섹션 번호
  - 기존 사용처: `spec/1-data-model.md §2.6 Node.container_id` 필드 설명에 `§11.2.1 canvas 스펙 참조` 표현 존재 — 이는 `spec/3-workflow-editor/0-canvas.md` 의 §11.2.1 을 가리킴
  - 상세: 서로 다른 파일의 §11 이므로 기술적 식별자 충돌은 없다. 그러나 데이터 모델 spec 독자가 `§11` 이라는 숫자를 보았을 때 어느 파일의 §11 인지 문맥 없이 혼동할 여지가 있다. 실제 spec 참조는 항상 파일명을 동반하므로 실질적 충돌은 미미하다.
  - 제안: 우선순위 낮음. cross-link 시 항상 파일 경로를 명시하는 현행 관행이 유지되는 한 독자 혼선 최소화 가능. 별도 조치 불필요.

---

### 요약

target draft 가 도입하는 신규 식별자(`§1.5`, `§1.6`, `§11` anchor, `ConversationTurnCard` 컴포넌트명, `data.fields` 키)는 대부분 기존 spec 과 직접 충돌하지 않는다. 가장 주목해야 할 사항은 `data.fields` 키 명칭으로, draft 가 `ConversationTurn.data.fields` 를 `form_submitted` 의 1급 필드로 표현하는 반면 기존 `node-output.md §4.5` 는 `data` 자체를 flat key→value 맵으로 정의하고 있어 shape 불일치 가능성이 있다. 이 점은 spec write 전에 node-output.md §4.5 와의 정합을 명시적으로 확인하거나 §4.5 를 함께 개정해야 한다. 두 번째 WARNING 인 UI 라벨 표현(`buttons` vs `button clicked`) 은 동일 draft 문서 내부의 불일치로, 독자 혼선과 구현 단에서의 해석 차이를 유발할 수 있어 통일이 필요하다. 나머지 INFO 사항은 참조 경로 정확도와 심리적 혼선에 관한 것으로 차단 수준은 아니다.

---

### 위험도

LOW
