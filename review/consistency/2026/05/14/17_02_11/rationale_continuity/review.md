제공된 기존 Rationale 발췌본과 target 문서를 대조 분석합니다.

---

## 발견사항

---

### [WARNING] Background "shallow copy" 와 격리 불변량(ND-BG-05) 간 긴장

- **target 위치**: §3.2 Background 격리 근거 / §4 수정 `spec/5-system/4-execution-engine.md` §3.3 — "conversationThread shallow copy"
- **과거 결정 출처**: PRD 3 §4.11 ND-BG-05 ("백그라운드 실패가 메인 흐름의 Execution 상태에 영향을 주지 않음") — target 문서 자체가 이를 근거로 인용
- **상세**:
  - target 은 "enqueue 시점 shallow snapshot 으로 복사" 라고 명시한 뒤 "background 안에서 발생한 turn 은 메인 thread 에 영향 없고, 그 반대도 마찬가지" 라고 단언한다.
  - 그런데 `ConversationThread.turns` 는 append 로 누적되는 **배열** 이다. Object 의 `shallow copy` 는 `turns` 배열의 참조만 복사하므로, background 가 `ConversationThreadService.append*` 를 통해 배열에 직접 push 하면 main thread 의 `turns` 가 함께 오염된다.
  - 진술된 격리("서로 영향 없음")를 달성하려면 최소 `{ ...thread, turns: [...thread.turns] }` 수준의 **배열까지 복사** 가 필요하다 ("deep-enough copy"). "shallow copy" 표현은 이를 보장하지 않는다.
  - ND-BG-05 는 "상태 격리" 를 invariant 로 선언했는데, target 이 그 invariant 를 근거로 인용하면서도 구현 명세는 격리를 보장하지 못하는 표현을 쓰고 있다.
- **제안**:
  - `spec/conventions/conversation-thread.md` §3.2 와 `spec/5-system/4-execution-engine.md` §3.3 의 "shallow copy" → "**turns 배열까지 복사하는 snapshot** (최소 `{ ...thread, turns: [...thread.turns] }`)" 으로 정정한다.
  - 또는 `ConversationThreadService.append*` 가 원본 배열을 mutate 하지 않고 새 배열을 반환(immutable append) 하는 방식으로 설계했음을 Rationale 에 명시해, shallow copy 만으로 격리가 보장됨을 논증한다.

---

### [INFO] `system` turn source → `role: 'system'` 매핑과 프로바이더 제약 미기재

- **target 위치**: `spec/conventions/conversation-thread.md` §5.1 messages 모드 매핑 표 — `system` → `role: 'system'`
- **과거 결정 출처**: `spec/3-workflow-editor/4-ai-assistant.md` Rationale — "스트리밍 v1 지원 provider OpenAI, Anthropic 만 / Google/Azure 는 Tool-use 포맷 차이로 후속", gpt-oss Harmony 제어 토큰 등 provider 이상동작 대응 기록
- **상세**:
  - Anthropic API 는 `messages` 배열 내에서 `role: 'system'` 을 지원하지 않는다 — system prompt 는 별도 파라미터(`system`)로만 전달 가능하다. 중간에 system 역할 메시지를 삽입하면 API 오류 발생.
  - 기존 Rationale 은 provider 호환성 이슈를 상세히 기록했음에도, target 의 §5.1 매핑 표는 이 제약을 언급하지 않는다.
  - v1 에서 `system` source 의 자동 push 가 없어("예약, v1 자동 누적 없음") 실제 문제가 발생하지 않는 것은 사실이나, 향후 v2 나 수동 push 경로에서 Anthropic 프로바이더를 쓸 경우 런타임 오류로 이어진다.
- **제안**:
  - §5.1 매핑 표 하단 또는 §5 서두에 한 줄 추가: "`system` source 를 `messages` 모드로 주입할 때 Anthropic API 는 `role: 'system'` 을 messages 배열에서 허용하지 않는다 — `system_text` 모드 또는 provider 별 분기 필요. v1 은 자동 push 없으므로 현재 실질 문제 없음."

---

### [INFO] `conversationHistory` / `historyCount` "deadweight" 주장에 대한 선행 Rationale 부재

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` 신설 §12.2 — "handler 코드가 한 번도 읽지 않는 deadweight"
- **과거 결정 출처**: 제공된 Rationale 발췌본 어디에도 `conversationHistory` / `historyCount` 의 도입 배경·설계 의도가 기록되어 있지 않음
- **상세**:
  - target §12.2 는 두 필드를 deprecate 하면서 "한 번도 읽지 않는 deadweight" 라고 규정한다. 이 주장이 사실이라면 과거 spec 에 이 필드들을 기재한 Rationale(도입 의도, 예상 동작) 도 존재해야 한다.
  - 현재 제공된 발췌본 안에는 해당 필드의 도입 Rationale 이 없어 번복 여부를 직접 확인할 수 없다 — 단, 만약 기존 spec 어딘가에 "conversationHistory 로 AI Agent 가 N개 이전 대화를 보관한다" 류의 설계 의도가 명문화되어 있다면 WARNING 으로 격상된다.
- **제안**:
  - `spec/4-nodes/3-ai/1-ai-agent.md` 의 현행 §12 이전 Rationale 섹션(존재할 경우) 또는 도입 commit message 를 확인한다.
  - 도입 배경 기록이 있다면 §12.2 에 "기존 설계 의도는 X 였으나, 구현 우선순위 변경으로 핸들러가 채택되지 않았고 이제 `contextScope` 로 대체" 형태로 역사를 이어 서술한다.
  - 없다면 현행 §12.2 서술로 충분하다.

---

## 요약

target 문서는 ConversationThread 라는 신규 개념을 도입하는 것이므로 기존 Rationale 와 직접 충돌하는 지점이 적다. 가장 주목할 부분은 **Background 격리 불변량(ND-BG-05)을 스스로 근거로 인용하면서 "shallow copy" 표현이 그 불변량을 실제로 보장하는지** 가 불명확하다는 점(WARNING)이다. `system` source 와 Anthropic 호환성 문제(INFO), `conversationHistory` 폐기 서술의 역사 단절(INFO) 은 치명적이지 않으나 Rationale 문서의 완결성 측면에서 보완이 권장된다.

## 위험도

**LOW** — CRITICAL 발견 없음. Warning 1건(구현 정합성 위험), Info 2건(문서 완결성). Background copy 의미 불명확성은 구현 단계에서 버그로 전환될 수 있으므로 spec 본문 반영 전 표현 정정이 권장된다.